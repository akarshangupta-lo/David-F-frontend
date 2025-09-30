// src/hooks/useDrive.ts
import { useCallback, useState } from "react";

// -----------------------------
// Types
// -----------------------------
export interface DriveUploadSelection {
  image: string;
  selected_name: string;
  target: string;
  nhr_reason?: string;
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
  message: string;
  uploaded_files: UploadedFile[];
  user_id: string;
  success_count: number;
  errors?: string[];
  error_count?: number;
}

// -----------------------------
// Hook state
// -----------------------------
interface DriveState {
  linked: boolean;
  ensuring: boolean; // ✅ restored so frontend compiles
  error?: string;
  lastUploadedFiles: UploadedFile[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// -----------------------------
// Helpers
// -----------------------------
function getUserId(): string | null {
  // Prefer explicit user_id if available, else fall back to "user"
  const id = localStorage.getItem("user_id");
  if (id) return id;

  const raw = localStorage.getItem("user");
  if (raw) {
    try {
      return JSON.parse(raw).id ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

// -----------------------------
// Hook
// -----------------------------
export function useDrive() {
  const [state, setState] = useState<DriveState>({
    linked: false,
    ensuring: false, // ✅ default
    error: undefined,
    lastUploadedFiles: [],
  });

  // ✅ no-op placeholder for compatibility (so WineOcrWizard.tsx won’t break)
  const connectDrive = useCallback(async () => {
    console.warn("connectDrive is deprecated and not used anymore.");
  }, []);

  // check drive status
  const checkDriveStatus = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return { authenticated: false };

    const res = await fetch(`${API_BASE}/is-authenticated?user_id=${userId}`, {
      credentials: "include",
    });
    if (!res.ok) return { authenticated: false };

    const data = await res.json();
    setState((prev) => ({ ...prev, linked: data.authenticated }));
    return data;
  }, []);

  // upload to drive
  const uploadToDrive = useCallback(
    async (selections: DriveUploadSelection[]): Promise<DriveUploadResponse> => {
      if (!state.linked) throw new Error("Drive not connected");

      const userId = getUserId();
      if (!userId) {
        setState((prev) => ({
          ...prev,
          error: "No user ID found. Please reconnect to Google Drive.",
        }));
        throw new Error("User ID not found");
      }

      if (selections.some((s) => s.target === "nhr" && !s.nhr_reason)) {
        throw new Error("NHR reason is required for NHR selections");
      }

      const payload: DriveUploadRequest = { user_id: userId, selections };

      const res = await fetch(`${API_BASE}/upload-to-drive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);

      const data: DriveUploadResponse = await res.json();

      if (data.success_count > 0 && data.uploaded_files?.length) {
        setState((prev) => ({
          ...prev,
          lastUploadedFiles: data.uploaded_files,
        }));
      }

      return data;
    },
    [state.linked]
  );

  return { state, connectDrive, checkDriveStatus, uploadToDrive };
}
