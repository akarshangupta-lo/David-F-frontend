// src/hooks/useDrive.ts
import { useCallback, useState } from "react";

export interface DriveState {
  linked: boolean;
  ensuring?: boolean;
  error?: string | null;
  structure?: Record<string, string>;
}

const API_BASE = import.meta.env.VITE_RENDER_URL || "http://localhost:8000";

/* ------------------ Hook ------------------ */
export const useDrive = () => {
  const [state, setState] = useState<DriveState>({ linked: false });

  /** Step 1: Connect Google Drive */
  const connectDrive = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, ensuring: true, error: null }));

      const res = await fetch(`${API_BASE}/init-drive`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to start Drive connection: ${res.status}`);
        
      }

      // Backend may return redirect URL for Google OAuth
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // If backend auto-handles OAuth
        await checkDriveStatus();
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        ensuring: false,
        error: e?.message || "Drive connection failed",
      }));
      throw e;
    }
  }, []);

  /** Step 2: Check Drive status (returns boolean) */
  const checkDriveStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/drive-status`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to check Drive status: ${res.status}`);
      }

      const data = await res.json();
      const linked = !!data.linked;

      setState({
        linked,
        ensuring: false,
        error: null,
        structure: data.structure || {},
      });

      return linked;
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        ensuring: false,
        error: e?.message || "Drive status check failed",
      }));
      return false;
    }
  }, []);

  /** Step 3: Upload file via backend */
  const uploadToDrive = useCallback(
    async (file: File, newName?: string): Promise<void> => {
      if (!state.linked) throw new Error("Drive not connected");

      const formData = new FormData();
      formData.append("file", file);
      if (newName) formData.append("new_name", newName);

      const res = await fetch(`${API_BASE}/upload-drive`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Drive upload failed: ${res.status}`);
      }
    },
    [state.linked]
  );

  return { state, connectDrive, checkDriveStatus, uploadToDrive };
};
