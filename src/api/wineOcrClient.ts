// wineOcrClient.ts
// -----------------------------
// Types
// -----------------------------
export interface UploadResponseItem {
  id: string;
  filename: string;
  previewUrl?: string;
}

export interface OcrResponse {
  results: Array<{
    original_filename: string;
    new_filename: string;
    formatted_name: string;
  }>;
}

export interface CompareResponse {
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

export interface CompareMatchItem {
  id: string;
  ocrText: string;
  topMatches: { option: string; score: number; reason: string }[];
  matchConfidence?: number;
}

// -----------------------------
// Config
// -----------------------------
const BASE_URL =
  (import.meta as any).env.VITE_RENDER_URL ||
  (import.meta as any).env.VITE_API_URL ||
  "http://localhost:8000";
const CLEAN_BASE = String(BASE_URL).replace(/\/+$/, "");

// -----------------------------
// Helpers
// -----------------------------
function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  message = "Request timed out"
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(message), ms);
  return fn(controller.signal).finally(() => clearTimeout(timeout));
}

async function postJson<T>(
  path: string,
  body: any,
  timeoutMs = 60000
): Promise<T> {
  const url = `${CLEAN_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if ((import.meta as any).env.VITE_ACCESS_TOKEN)
    headers["Authorization"] = `Bearer ${
      (import.meta as any).env.VITE_ACCESS_TOKEN
    }`;
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await withTimeout(
      (signal) =>
        fetch(url, {
          method: "POST",
          headers,
          body: body instanceof FormData ? body : JSON.stringify(body),
          mode: "cors",
          credentials: "omit",
          signal,
        }),
      timeoutMs
    );
  } catch (e: any) {
    const errMsg =
      e?.name === "AbortError"
        ? "Request timed out"
        : e?.message || "Failed to fetch";
    throw new Error(errMsg);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      detail = (data && (data.detail || data.message)) || detail;
    } catch {}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

async function getJson<T>(path: string, timeoutMs = 15000): Promise<T> {
  const url = `${CLEAN_BASE}${path}`;
  let response: Response;
  try {
    response = await withTimeout(
      (signal) =>
        fetch(url, { method: "GET", mode: "cors", credentials: "omit", signal }),
      timeoutMs
    );
  } catch (e: any) {
    const errMsg =
      e?.name === "AbortError"
        ? "Request timed out"
        : e?.message || "Failed to fetch";
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

// -----------------------------
// API Calls
// -----------------------------
export async function healthCheck(
  timeoutMs = 15000
): Promise<{ status: string } | string> {
  try {
    return await getJson<{ status: string } | string>("/health", timeoutMs);
  } catch {
    return getJson<{ status: string } | string>("/", timeoutMs);
  }
}

function asArray<T>(val: any): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val == null) return [];
  return [val as T];
}

function normalizeUploadItems(
  raw: any,
  sourceFiles: File[]
): UploadResponseItem[] {
  const candidates = [
    raw,
    raw?.items,
    raw?.uploads,
    raw?.files,
    raw?.data,
    raw?.results,
    raw?.files_uploaded,
  ];
  for (const c of candidates) {
    const arr = asArray<any>(c);
    if (arr.length === 0) continue;
    if (typeof arr[0] === "string") {
      return arr.map((id: string, i: number) => ({
        id,
        filename: sourceFiles[i]?.name || `file_${i + 1}`,
      }));
    }
    if (typeof arr[0] === "object") {
      const mapped: UploadResponseItem[] = [];
      arr.forEach((obj: any, i: number) => {
        const id =
          obj.id || obj.fileId || obj.uuid || obj._id || obj.uploadId;
        const filename =
          obj.filename || obj.name || sourceFiles[i]?.name || `file_${i + 1}`;
        if (id || filename) {
          mapped.push({
            id: String(id ?? `${Date.now()}_${i}`),
            filename,
            previewUrl: obj.previewUrl,
          });
        }
      });
      if (mapped.length > 0) return mapped;
    }
  }
  if (raw && (raw.id || raw.fileId || raw.uuid)) {
    return [
      {
        id: String(raw.id || raw.fileId || raw.uuid),
        filename:
          raw.filename || raw.name || sourceFiles[0]?.name || "file",
      },
    ];
  }
  return [];
}

export async function uploadImages(
  files: File[],
  timeoutMs = 120000
): Promise<UploadResponseItem[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  let raw: any;
  try {
    // Backend endpoint is POST /upload-images
    raw = await postJson<any>("/upload-images", form, timeoutMs);
  } catch (e) {
    console.error("Upload failed:", e);
    throw e;
  }
  let normalized = normalizeUploadItems(raw, files);
  if (normalized.length < files.length) {
    const existingNames = new Set(normalized.map((n) => n.filename));
    const extras: UploadResponseItem[] = [];
    files.forEach((f, i) => {
      if (!existingNames.has(f.name)) {
        extras.push({ id: `${Date.now()}_${i}`, filename: f.name });
      }
    });
    normalized = [...normalized, ...extras];
  }
  if (normalized.length === 0) {
    console.error("Unexpected upload response shape:", raw);
    throw new Error(
      "Upload succeeded but response format was unexpected. Check console for details."
    );
  }
  return normalized;
}

export async function processOcr(
  ids: string[],
  timeoutMs = 300000
): Promise<OcrResponse> {
  // Backend: POST /process-ocr
  return postJson<OcrResponse>("/process-ocr", { ids }, timeoutMs);
}

export async function compareBatch(
  ids: string[],
  timeoutMs = 180000
): Promise<CompareResponse> {
  // Backend: POST /compare-batch
  return postJson<CompareResponse>("/compare-batch", { ids }, timeoutMs);
}

export async function getCompareResults(timeoutMs = 15000): Promise<any> {
  // Backend: GET /get-compare-results
  return getJson<any>("/get-compare-results", timeoutMs);
}

export async function exportCsv(
  payload: any,
  timeoutMs = 60000
): Promise<Blob> {
  // Keep this pointing at /export if you later add an export endpoint server-side.
  const url = `${CLEAN_BASE}/export`;
  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }),
    timeoutMs
  );
  if (!response.ok) throw new Error(`Export failed: HTTP ${response.status}`);
  return response.blob();
}

// -----------------------------
// New API Calls (match your FastAPI)
// -----------------------------

// Upload to Drive (backend endpoint: POST /upload-to-drive)
export async function uploadToDriveApi(
  payload: any,
  timeoutMs = 60000
): Promise<any> {
  return postJson<any>("/upload-to-drive", payload, timeoutMs);
}

// Upload to Shopify (backend endpoint: POST /upload-to-shopify-batch)
export async function uploadToShopifyBatch(
  payload: any,
  timeoutMs = 60000
): Promise<any> {
  return postJson<any>("/upload-to-shopify-batch", payload, timeoutMs);
}

// Refresh Shopify cache (backend endpoint: POST /refresh-shopify-cache)
export async function refreshShopifyCache(
  timeoutMs = 15000
): Promise<any> {
  // Backend defines POST /refresh-shopify-cache — use GET or POST depending on your backend.
  // Your backend has POST /refresh-shopify-cache, but it doesn't require a body. We'll call POST.
  const url = `${CLEAN_BASE}/refresh-shopify-cache`;
  let response: Response;
  try {
    response = await withTimeout(
      (signal) =>
        fetch(url, { method: "POST", mode: "cors", credentials: "omit", signal }),
      timeoutMs
    );
  } catch (e: any) {
    const errMsg = e?.name === "AbortError" ? "Request timed out" : (e?.message || 'Failed to fetch');
    throw new Error(errMsg);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  try {
    return (await response.json()) as any;
  } catch {
    return (await response.text()) as any;
  }
}
