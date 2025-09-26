// src/hooks/useDrive.ts
import { useCallback, useState, useEffect } from "react";

export interface DriveStructure {
  root: string;
  input: string;
  output: string;
  upload: string;
  nhr: {
    root: string;
    search_failed: string;
    ocr_failed: string;
    manual_rejection: string;
    others: string;
  };
}

export interface DriveState {
  linked: boolean;
  ensuring?: boolean;
  error?: string | null;
  structure?: DriveStructure;
  folder_structure_cached?: boolean;
  pickle_file_exists?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL;


/* ------------------ Hook ------------------ */
export const useDrive = () => {
  const [state, setState] = useState<DriveState>({ linked: false });

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const driveConnected = params.get('drive_connected');
    const driveError = params.get('drive_error');

    if (driveConnected === 'success') {
      setState(prev => ({ ...prev, linked: true, ensuring: false, error: null }));
      await checkDriveStatus(); // Verify and get folder structure
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (driveError) {
      setState(prev => ({ 
        ...prev, 
        linked: false, 
        ensuring: false, 
        error: decodeURIComponent(driveError)
      }));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Check for OAuth callback on mount
  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

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
      
      // Extract main status fields and debug info
      const {
        linked = false,
        folder_structure_cached = false,
        pickle_file_exists = false,
        debug = {}
      } = data;

      // Get structure from debug info if available
      const structure = debug.drive_structure || {};

      setState({
        linked: !!linked,
        folder_structure_cached,
        pickle_file_exists,
        ensuring: false,
        error: null,
        structure
      });

      return !!linked;
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
