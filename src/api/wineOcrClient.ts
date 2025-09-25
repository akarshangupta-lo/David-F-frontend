export interface UploadResponseItem {
	id: string;
	filename: string;
	previewUrl?: string;
}

export interface OcrProcessStatusItem {
	id: string;
	status: 'queued' | 'processing' | 'ocr_done' | 'failed';
	ocrText?: string;
	errorMessage?: string;
}

export interface CompareMatchItem {
	id: string;
	ocrText: string;
	topMatches: { option: string; score: number; reason: string }[];
	matchConfidence?: number;
}

const BASE_URL = (import.meta as any).env.VITE_RENDER_URL || (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';
const CLEAN_BASE = String(BASE_URL).replace(/\/+$/, '');

function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, message = 'Request timed out'): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(message), ms);
    return fn(controller.signal)
        .finally(() => clearTimeout(timeout));
}

async function postJson<T>(path: string, body: any, timeoutMs = 60000): Promise<T> {
	const url = `${CLEAN_BASE}${path}`;
	const headers: Record<string, string> = {
		'Accept': 'application/json'
	};
	if ((import.meta as any).env.VITE_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${(import.meta as any).env.VITE_ACCESS_TOKEN}`;
	if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
        response = await withTimeout(
            (signal) => fetch(url, {
                method: 'POST',
                headers,
                body: body instanceof FormData ? body : JSON.stringify(body),
                mode: 'cors',
                credentials: 'omit',
                signal
            }),
            timeoutMs
        );
    } catch (e: any) {
        // Network/CORS/timeout
        const errMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Failed to fetch');
        throw new Error(errMsg);
    }

	if (!response.ok) {
		let detail = `HTTP ${response.status}`;
		try { const data = await response.json(); detail = (data && (data.detail || data.message)) || detail; } catch {}
		throw new Error(detail);
	}
	return response.json() as Promise<T>;
}

async function getJson<T>(path: string, timeoutMs = 15000): Promise<T> {
	const url = `${CLEAN_BASE}${path}`;
    let response: Response;
    try {
        response = await withTimeout(
            (signal) => fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', signal }),
            timeoutMs
        );
    } catch (e: any) {
        const errMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Failed to fetch');
        throw new Error(errMsg);
    }
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	try {
		return (await response.json()) as T;
	} catch {
		return (await response.text()) as unknown as T;
	}
}

export async function healthCheck(timeoutMs = 15000): Promise<{ status: string } | string> {
    try {
        return await getJson<{ status: string } | string>('/health', timeoutMs);
    } catch {
        return getJson<{ status: string } | string>('/', timeoutMs);
    }
}

function asArray<T>(val: any): T[] {
	if (Array.isArray(val)) return val as T[];
	if (val == null) return [];
	return [val as T];
}

function normalizeUploadItems(raw: any, sourceFiles: File[]): UploadResponseItem[] {
	// Try common wrappers
	const candidates = [raw, raw?.items, raw?.uploads, raw?.files, raw?.data, raw?.results];
	for (const c of candidates) {
		const arr = asArray<any>(c);
		if (arr.length === 0) continue;
		// If array of strings (ids)
		if (typeof arr[0] === 'string') {
			return arr.map((id: string, i: number) => ({ id, filename: sourceFiles[i]?.name || `file_${i + 1}` }));
		}
		// If array of objects
		if (typeof arr[0] === 'object') {
			const mapped: UploadResponseItem[] = [];
			arr.forEach((obj: any, i: number) => {
				const id = obj.id || obj.fileId || obj.uuid || obj._id || obj.uploadId;
				const filename = obj.filename || obj.name || sourceFiles[i]?.name || `file_${i + 1}`;
				if (id || filename) {
					mapped.push({ id: String(id ?? `${Date.now()}_${i}`), filename, previewUrl: obj.previewUrl });
				}
			});
			if (mapped.length > 0) return mapped;
		}
	}
	// Single object with id
	if (raw && (raw.id || raw.fileId || raw.uuid)) {
		return [{ id: String(raw.id || raw.fileId || raw.uuid), filename: raw.filename || raw.name || sourceFiles[0]?.name || 'file' }];
	}
	return [];
}

export async function uploadImages(files: File[], timeoutMs = 120000): Promise<UploadResponseItem[]> {
	const form = new FormData();
	files.forEach(f => form.append('files', f));
	let raw: any;
	try {
        raw = await postJson<any>('/upload-images', form, timeoutMs);
	} catch (e) {
		// Fallback to alternate path used by some backends
        raw = await postJson<any>('/upload', form, timeoutMs);
	}
    let normalized = normalizeUploadItems(raw, files);
    // If backend returned fewer items than uploaded, fabricate placeholders for the rest
    if (normalized.length < files.length) {
        const existingNames = new Set(normalized.map(n => n.filename));
        const extras: UploadResponseItem[] = [];
        files.forEach((f, i) => {
            if (!existingNames.has(f.name)) {
                extras.push({ id: `${Date.now()}_${i}`, filename: f.name });
            }
        });
        normalized = [...normalized, ...extras];
    }
	if (normalized.length === 0) {
		console.error('Unexpected upload response shape:', raw);
		throw new Error('Upload succeeded but response format was unexpected. Check console for details.');
	}
	return normalized;
}

export async function processOcr(ids: string[], timeoutMs = 300000): Promise<OcrProcessStatusItem[]> {
	return postJson<OcrProcessStatusItem[]>('/process-ocr', { ids }, timeoutMs);
}

export async function compareBatch(ids: string[], timeoutMs = 180000): Promise<CompareMatchItem[]> {
	return postJson<CompareMatchItem[]>('/compare-batch', { ids }, timeoutMs);
}

export async function exportCsv(payload: any, timeoutMs = 60000): Promise<Blob> {
	const url = `${CLEAN_BASE}/export`;
	const response = await withTimeout(
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}),
		timeoutMs
	);
	if (!response.ok) throw new Error(`Export failed: HTTP ${response.status}`);
	return response.blob();
}
