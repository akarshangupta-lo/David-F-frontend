// src/hooks/useDrive.ts
import { useCallback, useState } from "react";

/* -----------------------------
   Types (frontend-friendly shapes)
   ----------------------------- */
export interface DriveUploadSelection {
  image: string;
  selected_name: string;
  target: string;
  nhr_reason?: string;
  gid?: string;
}

export interface DriveUploadRequest {
  user_id: string;
  selections: DriveUploadSelection[];
}

export interface UploadedFile {
  filename: string;
  target: string;
  drive_id: string;
  web_view_link: string;
}

export interface DriveUploadResponse {
  message?: string;
  uploaded_files?: UploadedFile[];
  user_id?: string;
  success_count?: number;
  errors?: string[];
  error_count?: number;
  // Backwards-compatible fields your backend may return
  files_organized?: any;
  upload_result?: any;
}

/* -----------------------------
   Hook state
   ----------------------------- */
export interface DriveState {
  linked: boolean;
  ensuring?: boolean;
  error?: string | null;
  lastUploadedFiles?: UploadedFile[];
}

const API_BASE = (import.meta as any).env.VITE_API_URL || (process.env as any).NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/* -----------------------------
   Helpers
   ----------------------------- */
function getUserId(): string | null {
  console.group('🔍 getUserId Debug');
  
  // Check all possible storage locations
  const uid = localStorage.getItem("user_id");
  const raw = localStorage.getItem("user");
  const legacy = localStorage.getItem("wine_ocr_user_id");
  
  console.log('Storage State:', {
    "user_id": uid,
    "user": raw ? JSON.parse(raw) : null,
    "wine_ocr_user_id": legacy,
    "all_keys": Object.keys(localStorage)
  });

  // Prefer explicit stored user_id
  if (uid) {
    console.log('✅ Using user_id:', uid);
    console.groupEnd();
    return uid;
  }

  // Then try parsing user object
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        console.log('✅ Using parsed user object id:', parsed.id);
        console.groupEnd();
        return String(parsed.id);
      }
      console.log('⚠️ User object found but no id:', parsed);
    } catch (e) {
      console.error('❌ Failed to parse user object:', e);
    }
  }

  // fallback to legacy key
  if (legacy) {
    console.log('✅ Using legacy key:', legacy);
    console.groupEnd();
    return legacy;
  }

  console.log('❌ No user ID found in any location');
  console.groupEnd();
  return null;
}

/* -----------------------------
   Hook implementation
   ----------------------------- */
export function useDrive() {
  const [state, setState] = useState<DriveState>({
    linked: false,
    ensuring: false,
    error: null,
    lastUploadedFiles: [],
  });

  /**
   * Check /auth/status on backend to determine whether the current user has Drive linked.
   * Sets ensuring=true while the check is in flight.
   */
  const checkDriveStatus = useCallback(async (): Promise<any> => {
    console.group('🔄 checkDriveStatus Debug');
    
    const userId = getUserId();
    console.log('🆔 User ID Check:', { userId });
    
    if (!userId) {
      console.log('❌ No user ID found, marking as not linked');
      setState(prev => ({ ...prev, linked: false, ensuring: false, error: null }));
      console.groupEnd();
      return { authenticated: false };
    }

    try {
      setState(prev => ({ ...prev, ensuring: true, error: null }));
      const url = `${API_BASE}/auth/status?user_id=${encodeURIComponent(userId)}`;
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) {
        // Try drive-status endpoints for backwards compatibility
        try {
          const fallback = await fetch(`${API_BASE}/drive-status?user_id=${encodeURIComponent(userId)}`, { method: "GET", credentials: "include" });
          if (!fallback.ok) {
            throw new Error(`Auth status check failed: ${res.status}`);
          }
          const dataFallback = await fallback.json();
          setState(prev => ({ ...prev, linked: !!dataFallback.authenticated, ensuring: false, error: null }));
          return dataFallback;
        } catch (err: any) {
          setState(prev => ({ ...prev, linked: false, ensuring: false, error: err?.message || "Auth status failed" }));
          return { authenticated: false };
        }
      }
      const data = await res.json();
      setState(prev => ({ ...prev, linked: !!data.authenticated, ensuring: false, error: null }));
      return data;
    } catch (err: any) {
      setState(prev => ({ ...prev, linked: false, ensuring: false, error: err?.message || "Auth status failed" }));
      return { authenticated: false };
    }
  }, []);

  /**
   * Upload to /upload-to-drive
   */
  const uploadToDrive = useCallback(async (selections: DriveUploadSelection[]): Promise<DriveUploadResponse> => {
    console.group('🚀 uploadToDrive Debug');
    console.log('Initial State:', { state, selections });

    if (!state.linked) {
      console.error('❌ Drive not connected');
      console.groupEnd();
      throw new Error("Drive not connected");
    }

    const userId = getUserId();
    console.log('🆔 Retrieved User ID:', userId);
    
    if (!userId) {
      console.error('❌ No user ID found');
      setState(prev => ({ ...prev, error: "No user ID found. Please sign in." }));
      console.groupEnd();
      throw new Error("User ID not found");
    }

    // validate NHR selections
    if (selections.some(s => s.target === "nhr" && !s.nhr_reason)) {
      throw new Error("NHR reason is required for NHR selections");
    }

    const payload: DriveUploadRequest = { user_id: userId, selections };

    console.log('📤 Sending Request:', {
      url: `${API_BASE}/upload-to-drive`,
      payload
    });

    const res = await fetch(`${API_BASE}/upload-to-drive`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log('📥 Response:', {
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries())
    });

    if (!res.ok) {
      let text = await res.text().catch(() => "");
      console.error('❌ Upload Error Response:', { status: res.status, text });
      
      try {
        const json = JSON.parse(text || "{}");
        console.error('Parsed Error:', json);
        const errMsg = json?.error || `HTTP ${res.status}`;
        console.groupEnd();
        throw new Error(errMsg);
      } catch (e) {
        console.error('Failed to parse error response:', e);
        console.groupEnd();
        throw new Error(`Drive upload failed: ${res.status}`);
      }
    }

    const data = (await res.json()) as DriveUploadResponse;

    // update lastUploadedFiles if backend returned uploaded_files
    if (data.success_count && data.uploaded_files && data.uploaded_files.length > 0) {
      setState(prev => ({ ...prev, lastUploadedFiles: data.uploaded_files }));
    } else if (data.uploaded_files && data.uploaded_files.length > 0) {
      setState(prev => ({ ...prev, lastUploadedFiles: data.uploaded_files }));
    }

    return data;
  }, [state.linked]);

  // Provide simple noop connectDrive so older code that imports this won't break.
  // Your flow uses unified auth: sign-in on frontend hits backend /auth/init and /auth/callback -> no manual connect required.
  const connectDrive = useCallback(async () => {
    // deprecated / no-op in unified flow.
    console.info("connectDrive() no-op (unified Google + Drive flow). Use GoogleSignIn to trigger auth.");
    return;
  }, []);

  return {
    state,
    connectDrive,
    checkDriveStatus,
    uploadToDrive,
  };
}
