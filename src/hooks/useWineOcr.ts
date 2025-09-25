import { useCallback, useMemo, useRef, useState } from 'react';
import { ProcessingTableRow, ProcessingResult } from '../types';
import { uploadImages, processOcr, compareBatch, OcrProcessStatusItem, CompareMatchItem, healthCheck } from '../api/wineOcrClient';
import { useDrive } from './useDrive';

export type WizardStep = 1 | 2 | 3 | 4;

export interface FilterState {
	status?: 'failed' | 'uploaded_to_drive' | 'ocr_done' | 'uploaded' | 'llm_done' | 'formatted';
	needsReview?: boolean;
	search?: string;
}

export const useWineOcr = () => {
	const [step, setStep] = useState<WizardStep>(2);
	const [rows, setRows] = useState<ProcessingTableRow[]>([]);
	const [uploading, setUploading] = useState(false);
	const [ocrLoading, setOcrLoading] = useState(false);
	const [compareLoading, setCompareLoading] = useState(false);
	const [ocrStarted, setOcrStarted] = useState(false);
	const [compareStarted, setCompareStarted] = useState(false);
	const [ocrLocked, setOcrLocked] = useState(false);
	const [compareLocked, setCompareLocked] = useState(false);
	const [uploadMs, setUploadMs] = useState<number | null>(null);
	const [ocrMs, setOcrMs] = useState<number | null>(null);
	const [compareMs, setCompareMs] = useState<number | null>(null);
	const [healthLoading, setHealthLoading] = useState(false);
	const [healthStatus, setHealthStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const cancellationRef = useRef<{ cancelled: boolean }>({ cancelled: false });
	const [filter, setFilter] = useState<FilterState>({});
	const { state: drive, uploadToFolder, moveToFolder, copyToFolder } = useDrive();

	const reset = useCallback(() => {
		setStep(2);
		setRows([]);
		setError(null);
		setHealthStatus(null);
		setOcrStarted(false);
		setCompareStarted(false);
		setOcrLocked(false);
		setCompareLocked(false);
		setUploadMs(null);
		setOcrMs(null);
		setCompareMs(null);
		cancellationRef.current.cancelled = false;
	}, []);

	const cancel = useCallback(() => {
		cancellationRef.current.cancelled = true;
		setOcrLoading(false);
		setCompareLoading(false);
	}, []);

	const checkHealth = useCallback(async () => {
		setHealthLoading(true);
		setError(null);
		try {
			const res = await healthCheck();
			setHealthStatus(typeof res === 'string' ? res : (res?.status || 'ok'));
		} catch (e: any) {
			setError(e?.message || 'Health check failed');
		} finally {
			setHealthLoading(false);
		}
	}, []);

	const handleUpload = useCallback(async (files: File[]) => {
		setError(null);
		setUploading(true);
		const t0 = performance.now();
		try {
			const uploads = await uploadImages(files);
			const list = Array.isArray(uploads) ? uploads : [];
			if (list.length === 0) throw new Error('Upload did not return any items');
			// robust mapping: normalize basenames to align rows and responses
			const normalize = (name?: string) => (name || '').split(/[\\/]/).pop()!.toLowerCase();
			const fileByBase = new Map<string, File>();
			files.forEach(f => fileByBase.set(normalize(f.name), f));
			const newRows: ProcessingTableRow[] = list.map((u, idx) => {
				const base = normalize(u.filename);
				const srcFile = fileByBase.get(base) || files[idx] || files[0];
				const preview = u.previewUrl || (srcFile ? URL.createObjectURL(srcFile) : undefined);
				return {
					id: u.id,
					userId: 'me',
					filename: u.filename,
					baseName: base,
					originalBaseName: normalize(srcFile?.name),
					status: 'uploaded',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					previewUrl: preview,
					originalFile: srcFile,
					result: undefined
				};
			});
			setRows(prev => {
				const merged = [...prev, ...newRows];
				return merged;
			});
			// reset flags for new session
			setOcrStarted(false);
			setCompareStarted(false);
			setOcrLocked(false);
			setCompareLocked(false);
			// Upload to Drive (input and upload) if linked
			if (drive.linked && drive.structure?.inputId && drive.structure?.uploadId) {
				for (const row of newRows) {
					if (!row.originalFile) continue;
					try {
						const inputId = await uploadToFolder(row.originalFile, drive.structure.inputId);
						const uploadId = await uploadToFolder(row.originalFile, drive.structure.uploadId);
						setRows(prev => prev.map(r => r.id === row.id ? ({ ...r, driveIds: { ...r.driveIds, input: inputId, upload: uploadId } }) : r));
					} catch (e) {
						console.error('Drive upload failed for', row.filename, e);
					}
				}
			}
			setStep(3);
		} catch (e: any) {
			setError(e?.message || 'Upload failed');
		} finally {
			setUploading(false);
			setUploadMs(Math.max(0, Math.round(performance.now() - t0)));
		}
	}, [drive.linked, drive.structure, uploadToFolder]);

	const runOcr = useCallback(async () => {
		setError(null);
		setOcrLoading(true);
		setOcrStarted(true);
		cancellationRef.current.cancelled = false;
		const t0 = performance.now();
		try {
			const ids = rows.map(r => r.id);
			if (ids.length === 0) throw new Error('No files to process');
			const raw: any = await processOcr(ids);

			if (Array.isArray(raw) && raw.length > 0 && (raw[0] as OcrProcessStatusItem).id !== undefined) {
				const ocrStatuses = raw as OcrProcessStatusItem[];
				setRows(prev => prev.map(r => {
					const status = ocrStatuses.find(s => s.id === r.id);
					if (!status) return r;
					return {
						...r,
						status: status.status === 'failed' ? 'failed' : 'ocr_done',
						updatedAt: new Date().toISOString(),
						result: {
							id: r.id,
							fileId: r.id,
							ocrText: status.ocrText || '',
							topMatches: [],
							selectedOption: '',
							correctionStatus: 'NHR',
							finalOutput: '',
							approved: false,
							timestamps: { ocrDone: new Date().toISOString() }
						}
					};
				}));
			} else if (raw && Array.isArray(raw.results)) {
				const results = raw.results as Array<{ original_filename: string; new_filename: string; formatted_name: string }>;
				setRows(prev => {
					const usedIndexes = new Set<number>();
					return prev.map((r) => {
						const normalize = (name?: string) => (name || '').split(/[\\/]/).pop()!.toLowerCase();
						const rBase = r.baseName || normalize(r.filename);
						let matchIndex = results.findIndex(x => rBase === normalize(x.new_filename) || rBase === normalize(x.original_filename));
						if (matchIndex === -1) {
							for (let i = 0; i < results.length; i++) {
								if (!usedIndexes.has(i)) { matchIndex = i; break; }
							}
						}
						if (matchIndex === -1) return r;
						usedIndexes.add(matchIndex);
						const res = results[matchIndex];
						return {
							...r,
							serverFilename: res.new_filename,
							status: 'ocr_done',
							updatedAt: new Date().toISOString(),
							result: {
								id: r.id,
								fileId: r.id,
								ocrText: res.formatted_name,
								topMatches: [],
								selectedOption: '',
								correctionStatus: 'NHR',
								finalOutput: '',
								approved: false,
								timestamps: { ocrDone: new Date().toISOString() }
							}
						};
					});
				});
			} else {
				throw new Error('Unexpected OCR response format');
			}
			// lock OCR after one run regardless of result
			setOcrLocked(true);
			setOcrLocked(true);
			setOcrMs(Math.max(0, Math.round(performance.now() - t0)));
		} catch (e: any) {
			setError(e?.message || 'OCR failed');
			setOcrLocked(true);
			setOcrMs(Math.max(0, Math.round(performance.now() - t0)));
		} finally {
			setOcrLoading(false);
		}
	}, [rows]);

	const runCompare = useCallback(async () => {
		setError(null);
		setCompareLoading(true);
		setCompareStarted(true);
		const t0 = performance.now();
		try {
			const ids = rows.filter(r => r.status !== 'failed').map(r => r.id);
			if (ids.length === 0) throw new Error('No successful OCR items to compare');
			const raw: any = await compareBatch(ids);

			if (raw && Array.isArray(raw.results)) {
				const results = raw.results as Array<{ image: string; matches: { orig: string; final: string; candidates: Array<{ gid?: string; text: string; score: number; reason: string }>; validated_gid?: string; need_human_review?: boolean; nhr?: boolean } }>;
				const normalize = (name?: string) => (name || '').split(/[\\/]/).pop()!.toLowerCase();
				setRows(prev => prev.map(r => {
					const rBase = r.baseName || normalize(r.filename) || normalize(r.serverFilename);
					const found = results.find(x => normalize(x.image) === rBase || normalize(x.image) === normalize(r.serverFilename));
					if (!found) return r;
					const sorted = [...(found.matches.candidates || [])].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
					const topMatches = sorted.slice(0, 3).map(c => ({ option: c.text, score: Number(c.score) || 0, reason: c.reason }));
					const best = topMatches[0];
					const needsReview = Boolean(found.matches.need_human_review || (found.matches as any).nhr);
					let correctionStatus: ProcessingResult['correctionStatus'] = 'NHR';
					if (needsReview) {
						// Low score ⇒ search_failed; OCR said no label ⇒ ocr_failed
						const ocrNoLabel = (found.matches.orig || '').toLowerCase().includes('no label');
						if (ocrNoLabel) correctionStatus = 'ocr_failed';
						else correctionStatus = 'search_failed';
					} else {
						correctionStatus = 'approved';
					}
					const result: ProcessingResult = {
						...(r.result as ProcessingResult),
						ocrText: found.matches.orig || r.result?.ocrText || '',
						topMatches,
						selectedOption: needsReview ? 'NHR' : (best?.option || 'NHR'),
						finalOutput: needsReview ? '' : (found.matches.final || best?.option || (r.result?.finalOutput || '')),
						matchConfidence: best?.score,
						needsReview,
						validatedGid: found.matches.validated_gid,
						correctionStatus
					};
					return { ...r, status: 'formatted', result };
				}));
				setStep(4);
			} else {
				console.error('Unexpected compare response:', raw);
				throw new Error('Unexpected Compare response format');
			}
			setCompareLocked(true);
			setCompareMs(Math.max(0, Math.round(performance.now() - t0)));
		} catch (e: any) {
			setError(e?.message || 'Compare failed, try again');
			setCompareLocked(true);
			setCompareMs(Math.max(0, Math.round(performance.now() - t0)));
		} finally {
			setCompareLoading(false);
		}
	}, [rows]);

	const uploadResultToDrive = useCallback(async (fileId: string) => {
		const row = rows.find(r => r.id === fileId);
		if (!row || !drive.structure) return false;
		try {
			setError(null);
			// ensure we have an upload Drive ID; if missing, push original file now
			let uploadDriveId = row.driveIds?.upload;
			if (!uploadDriveId && row.originalFile && drive.structure.uploadId) {
				uploadDriveId = await uploadToFolder(row.originalFile, drive.structure.uploadId);
				setRows(prev => prev.map(r => r.id === row.id ? ({ ...r, driveIds: { ...r.driveIds, upload: uploadDriveId! } }) : r));
			}
			if (row.result?.correctionStatus === 'NHR' || row.result?.needsReview) {
				const reason = (row.result?.correctionStatus || '').toLowerCase().replace(/\s+/g, '_');
				let target: string | undefined;
				switch (reason) {
					case 'search_failed': target = drive.structure.nhrSearchFailedId; break;
					case 'manual_rejection':
					case 'manual_fail': target = drive.structure.nhrManualFailId; break;
					case 'ocr_failed':
					case 'ocr_fail': target = drive.structure.nhrOcrFailId; break;
					case 'other':
					case 'others': target = drive.structure.nhrOthersId; break;
					default: target = drive.structure.nhrOthersId; break;
				}
				if (!target) throw new Error('Missing NHR target folder');
				if (row.originalFile) {
					await uploadToFolder(row.originalFile, target);
				} else if (uploadDriveId) {
					await copyToFolder(uploadDriveId, target, row.filename);
				} else {
					throw new Error('No source file for upload');
				}
			} else {
				// approved → output
				if (!drive.structure.outputId) throw new Error('Missing output folder id');
				if (row.originalFile) {
					await uploadToFolder(row.originalFile, drive.structure.outputId);
				} else if (uploadDriveId) {
					await copyToFolder(uploadDriveId, drive.structure.outputId, row.filename);
				} else {
					throw new Error('No source file for upload');
				}
			}
			setRows(prev => prev.map(r => r.id === fileId ? ({ ...r, status: 'uploaded_to_drive' }) : r));
			return true;
		} catch (e: any) {
			setError(e?.message || 'Drive upload failed');
			return false;
		}
	}, [rows, drive.structure, uploadToFolder, copyToFolder]);

	const updateResult = useCallback((fileId: string, updates: Partial<ProcessingResult>) => {
		setRows(prev => prev.map(r => r.id === fileId && r.result ? ({ ...r, result: { ...r.result, ...updates } }) : r));
	}, []);

	const clear = useCallback(() => setRows([]), []);

	const filteredRows = useMemo(() => {
		return rows.filter(r => {
			if (filter.status && r.status !== filter.status) return false;
			if (filter.needsReview !== undefined && (r.result?.needsReview || false) !== filter.needsReview) return false;
			if (filter.search) {
				const text = `${r.filename} ${r.result?.ocrText || ''} ${r.result?.finalOutput || ''}`.toLowerCase();
				if (!text.includes(filter.search.toLowerCase())) return false;
			}
			return true;
		});
	}, [rows, filter]);

	const exportCsvData = useCallback(() => {
		const headers = ['Filename','OCR Text','Selected Match','Top3','Confidence','Needs Review','Validated GID'];
		const lines = [headers.join(',')];
		// Export all uploaded rows (unfiltered)
		rows.forEach(r => {
			const top3 = (r.result?.topMatches || []).slice(0,3).map(m => `${m.option} (${m.score.toFixed(2)})`).join(' | ');
			const row = [
				r.filename,
				JSON.stringify(r.result?.ocrText || ''),
				JSON.stringify(r.result?.selectedOption || ''),
				JSON.stringify(top3),
				String(r.result?.matchConfidence ?? ''),
				(r.result?.needsReview ? 'Yes' : 'No'),
				JSON.stringify(r.result?.validatedGid || '')
			];
			lines.push(row.join(','));
		});
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'wine-ocr-results.csv';
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}, [rows]);

	const canRunCompare = useMemo(() => {
		const anyOcrDone = rows.some(r => r.status === 'ocr_done' || r.status === 'formatted' || r.status === 'uploaded_to_drive');
		return anyOcrDone && !compareLocked;
	}, [rows, compareLocked]);

	return {
		// state
		step,
		rows: filteredRows,
		allRows: rows,
		uploading,
		processing: ocrLoading || compareLoading,
		ocrLoading,
		compareLoading,
		ocrStarted,
		compareStarted,
		ocrLocked,
		compareLocked,
		canRunCompare,
		uploadMs,
		ocrMs,
		compareMs,
		healthLoading,
		healthStatus,
		error,
		filter,
		// actions
		setStep,
		setFilter,
		healthCheck: checkHealth,
		handleUpload,
		runOcr,
		runCompare,
		uploadResultToDrive,
		updateResult,
		cancel,
		reset,
		clear,
		exportCsvData,
	};
};
