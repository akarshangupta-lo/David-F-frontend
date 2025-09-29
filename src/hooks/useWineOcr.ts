import { useCallback, useMemo, useRef, useState } from 'react';
import { ProcessingTableRow, ProcessingResult } from '../types';
import {
  uploadImages,
  processOcr,
  compareBatch,
  exportCsv,
  uploadToDriveApi,
  uploadToShopifyBatch,
  refreshShopifyCache,
  healthCheck
} from "../api/wineOcrClient";
import { useDrive } from './useDrive';
import { DriveUploadSelection } from '../types/drive';

export type WizardStep = 1 | 2 | 3 | 4;

export interface FilterState {
  status?: 'failed' | 'uploaded_to_drive' | 'ocr_done' | 'uploaded' | 'llm_done' | 'formatted';
  needsReview?: boolean;
  search?: string;
}

export const TIME_PER_IMAGE_SECONDS = 15;

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds} sec` : `${seconds} sec`;
};

const calculateEstimatedTime = (imageCount: number): number => {
  return imageCount * TIME_PER_IMAGE_SECONDS;
};

interface OcrResponse {
  results: Array<{
    original_filename: string;
    new_filename: string;
    formatted_name: string;
  }>;
}

interface CompareResponse {
  results: Array<{
    image: string;
    matches: {
      orig: string;
      final: string;
      candidates: Array<{
        gid?: string;
        text: string;
        score: number;
        reason: string;
      }>;
      validated_gid?: string;
      need_human_review?: boolean;
      nhr?: boolean;
    };
  }>;
}

interface ApiError extends Error {
  message: string;
}

function isCompareResponse(obj: any): obj is CompareResponse {
  return obj && Array.isArray(obj.results);
}

export const useWineOcr = () => {
  const [step, setStep] = useState<WizardStep>(2);
  const [rows, setRows] = useState<ProcessingTableRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

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
  const { state: drive, uploadToDrive } = useDrive();

  // ----------------------
  // Basic controls
  // ----------------------
  const resetBatch = useCallback(() => {
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
    setSuccessMessage(null);
    setRefreshResult(null);
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
    } catch (error: unknown) {
      const err = error as ApiError;
      setError(err.message || 'Health check failed');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ----------------------
  // Upload images (to backend upload endpoint)
  // ----------------------
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
        const userId = localStorage.getItem('wine_ocr_user_id') || 'me';
        return {
          id: u.id,
          userId,
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

      setRows(prev => [...prev, ...newRows]);

      // reset flags for new session
      setOcrStarted(false);
      setCompareStarted(false);
      setOcrLocked(false);
      setCompareLocked(false);

      // Upload to Drive folders (input) if drive linked - best-effort, not blocking
      if (drive.linked) {
        for (const row of newRows) {
          if (!row.originalFile) continue;
          try {
            const uploadResponse = await uploadToDrive([{
              image: row.filename,
              selected_name: row.filename, // keep original name
              target: 'output'
            }]);
            if (uploadResponse.success && uploadResponse.drive_file) {
              setRows(prev => prev.map(r => r.id === row.id ? ({
                ...r,
                driveIds: { ...r.driveIds, input: uploadResponse.drive_file?.id },
                driveLinks: { ...r.driveLinks, input: uploadResponse.drive_file?.webViewLink }
              }) : r));
            }
          } catch (e) {
            console.error('Drive upload failed for', row.filename, e);
          }
        }
      }

      setStep(3);
    } catch (error: unknown) {
      const err = error as ApiError;
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadMs(Math.max(0, Math.round(performance.now() - t0)));
    }
  }, [drive.linked, uploadToDrive]);

  // ----------------------
  // OCR processing
  // ----------------------
  const runOcr = useCallback(async () => {
    setError(null);
    setOcrLoading(true);
    setOcrStarted(true);
    cancellationRef.current.cancelled = false;
    const t0 = performance.now();

    try {
      const ids = rows.map(r => r.id);
      if (ids.length === 0) throw new Error('No files to process');

      const estimatedTime = calculateEstimatedTime(ids.length);
      console.log(`Processing ${ids.length} images. Estimated time: ${formatTime(estimatedTime)}`);

      const raw = await processOcr(ids) as OcrResponse;

      if (!raw.results || raw.results.length === 0) {
        throw new Error('OCR returned no results');
      }

      const results = raw.results;
      const usedIndexes = new Set<number>();
      setRows(prev => prev.map((r) => {
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
      }));

      setOcrLocked(true);
      setOcrMs(Math.max(0, Math.round(performance.now() - t0)));
    } catch (error: unknown) {
      const err = error as ApiError;
      setError(err?.message || 'OCR failed');
      setOcrLocked(true);
      setOcrMs(Math.max(0, Math.round(performance.now() - t0)));
    } finally {
      setOcrLoading(false);
    }
  }, [rows]);

  // ----------------------
  // Compare / Match
  // ----------------------
  const runCompare = useCallback(async () => {
    setError(null);
    setCompareLoading(true);
    setCompareStarted(true);
    const t0 = performance.now();
    try {
      const ids = rows.filter(r => r.status !== 'failed').map(r => r.id);
      if (ids.length === 0) throw new Error('No successful OCR items to compare');

      const raw = await compareBatch(ids) as CompareResponse | any[];

      if (isCompareResponse(raw)) {
        const results = raw.results;
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
            const ocrNoLabel = (found.matches.orig || '').toLowerCase().includes('no label');
            correctionStatus = ocrNoLabel ? 'ocr_failed' : 'search_failed';
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
      } else if (Array.isArray(raw)) {
        console.warn('Compare returned array, adapt handling here if needed:', raw);
      } else {
        throw new Error('Unexpected Compare response format');
      }

      setCompareLocked(true);
      setCompareMs(Math.max(0, Math.round(performance.now() - t0)));
    } catch (error: unknown) {
      const err = error as ApiError;
      setError(err?.message || 'Compare failed, try again');
      setCompareLocked(true);
      setCompareMs(Math.max(0, Math.round(performance.now() - t0)));
    } finally {
      setCompareLoading(false);
    }
  }, [rows]);

  // ----------------------
  // Upload a single result to Drive (existing single-file function)
  // ----------------------
  const uploadResultToDrive = useCallback(async (fileId: string) => {
    const row = rows.find(r => r.id === fileId);
    if (!row) {
      setError('Upload failed: File not found');
      return false;
    }
    if (!row.result) {
      setError('Upload failed: File has no processing result');
      return false;
    }

    try {
      setError(null);
      const selectedName = row.result.finalOutput || row.result.selectedOption;
      const safeName = (selectedName || 'unnamed')
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') + '.jpg';

      const isNHR = row.result.correctionStatus === 'NHR' || row.result.needsReview;
      const selection: DriveUploadSelection = {
        image: row.originalBaseName || row.filename,
        selected_name: safeName,
        target: isNHR ? 'nhr' : 'output',
      };

      if (isNHR) {
        const nhrReason = (row.result.correctionStatus || '').toLowerCase();
        selection.nhr_reason =
          ['search_failed', 'ocr_failed', 'manual_rejection', 'others'].includes(nhrReason)
            ? nhrReason as DriveUploadSelection['nhr_reason']
            : 'others';
      }

      const uploadResponse = await uploadToDrive([selection]);
      if (uploadResponse.success) {
        setRows(prev => prev.map(r =>
          r.id === fileId
            ? {
              ...r,
              status: 'uploaded_to_drive',
              driveIds: { ...r.driveIds, target: uploadResponse.drive_file?.id },
              driveLinks: { ...r.driveLinks, target: uploadResponse.drive_file?.webViewLink }
            }
            : r
        ));
        return true;
      }
      if (uploadResponse.error) {
        setError(`Drive upload failed: ${uploadResponse.error}`);
        return false;
      }
      return true;
    } catch (error: unknown) {
      const err = error as ApiError;
      console.error('Drive upload error:', err);
      setError(err.message || 'Drive upload failed');
      return false;
    }
  }, [rows, uploadToDrive]);

  
// ----------------------
// Upload to Drive & Shopify (batch)
// ----------------------
const uploadToDriveAndShopify = useCallback(
  async (selections: DriveUploadSelection[]) => {
    setGlobalUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const userId = localStorage.getItem("wine_ocr_user_id") || "me";

      // Drive
      const drivePayload = { user_id: userId, selections };
      const driveRes = await uploadToDriveApi(drivePayload);

      // Shopify
      const shopifySelections = selections.map((s) => ({
        image: s.image,
        selected_name: s.selected_name,
        gid: (s as any).gid,
      }));
      const shopRes = await uploadToShopifyBatch(shopifySelections);

      // ✅ Success if both return 200 OK
      setSuccessMessage(
        `✅ Successfully uploaded ${selections.length} item(s) to Drive & Shopify`
      );

      // Update rows with Drive info if available
      if (driveRes?.files_organized) {
        const mapping = driveRes.files_organized;
        setRows((prev) =>
          prev.map((r) => {
            const found = mapping.find(
              (m: any) =>
                m.ocr_filename === r.serverFilename || m.filename === r.filename
            );
            if (!found) return r;
            return {
              ...r,
              status: "uploaded_to_drive",
              driveIds: {
                ...r.driveIds,
                target: driveRes.upload_result?.drive_file_id || r.driveIds?.target,
              },
              driveLinks: {
                ...r.driveLinks,
                target: driveRes.upload_result?.webViewLink || r.driveLinks?.target,
              },
            };
          })
        );
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "❌ Upload to Drive/Shopify failed");
    } finally {
      setGlobalUploading(false);
    }
  },
  []
);


  // ----------------------
  // New: Refresh Shopify Cache
  // ----------------------
  const refreshShopify = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setRefreshResult(null);
    try {
      const res = await refreshShopifyCache();
      // res may be { message, cache_file, ... } or similar
      if (res && typeof res === 'object') {
        const msg = res.message || JSON.stringify(res);
        setRefreshResult(msg);
      } else {
        setRefreshResult(String(res));
      }
    } catch (error: any) {
      setError(error?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ----------------------
  // Update result
  // ----------------------
  const updateResult = useCallback((fileId: string, updates: Partial<ProcessingResult>) => {
    setRows(prev => prev.map(r => r.id === fileId && r.result ? ({ ...r, result: { ...r.result, ...updates } }) : r));
  }, []);

  const clear = useCallback(() => setRows([]), []);

  // ----------------------
  // Export CSV (keeps previous behavior)
  // ----------------------
  const exportCsvData = useCallback(() => {
    const headers = ['Filename','OCR Text','Selected Match','Top3','Confidence','Needs Review','Validated GID'];
    const lines = [headers.join(',')];
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

  // ----------------------
  // Filtering and derived flags
  // ----------------------
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

  const canRunCompare = useMemo(() => {
    const anyOcrDone = rows.some(r => r.status === 'ocr_done' || r.status === 'formatted' || r.status === 'uploaded_to_drive');
    return anyOcrDone && !compareLocked;
  }, [rows, compareLocked]);

  // ----------------------
  // Returned API
  // ----------------------
  return {
    // state
    step,
    rows: filteredRows,
    allRows: rows,
    uploading,
    globalUploading,
    successMessage,
    refreshing,
    refreshResult,
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
    drive,
    // actions
    setStep,
    setRows,
    setFilter,
    reset: resetBatch,
    cancel,
    checkHealth,
    handleUpload,
    runOcr,
    runCompare,
    uploadResultToDrive,
    uploadToDriveAndShopify,
    refreshShopify,
    updateResult,
    clear,
    exportCsvData,
  };
};
