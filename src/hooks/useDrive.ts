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
  userId?: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL;
const USER_ID_KEY = 'wine_ocr_user_id';

/* ------------------ User ID Management ------------------ */
const getUserId = () => localStorage.getItem(USER_ID_KEY);
const setUserId = (userId: string) => localStorage.setItem(USER_ID_KEY, userId);
const clearUserId = () => localStorage.removeItem(USER_ID_KEY);

/* ------------------ Hook ------------------ */
export const useDrive = () => {
  const [state, setState] = useState<DriveState>({ linked: false });

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const driveConnected = params.get('drive_connected');
    const driveError = params.get('drive_error');
    const userId = params.get('user_id');

    if (driveConnected === 'success') {
      if (!userId) {
        setState(prev => ({ 
          ...prev, 
          linked: false, 
          ensuring: false, 
          error: 'No user ID received from OAuth callback' 
        }));
        return;
      }
      
      // Store user ID and update state
      setUserId(userId);
      setState(prev => ({ 
        ...prev, 
        linked: true, 
        ensuring: false, 
        error: null, 
        userId 
      }));
      
      await checkDriveStatus(); // Verify and get folder structure
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (driveError) {
      clearUserId();
      setState(prev => ({ 
        ...prev, 
        linked: false, 
        ensuring: false, 
        error: decodeURIComponent(driveError),
        userId: null
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
      const userId = getUserId();
      if (!userId) {
        setState(prev => ({
          ...prev,
          linked: false,
          error: 'No user ID found. Please reconnect to Google Drive.'
        }));
        return false;
      }

      const res = await fetch(`${API_BASE}/drive-status?user_id=${userId}`, {
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
        structure,
        error: backendError
      } = data;

      // Validate the required folders exist in the structure
      const requiredFolders = ['root', 'input', 'output', 'upload'];
      const missingFolders = requiredFolders.filter(folder => !structure?.[folder]);

      if (missingFolders.length > 0) {
        setState({
          linked: false,
          folder_structure_cached,
          pickle_file_exists,
          ensuring: false,
          error: `Missing required folders: ${missingFolders.join(', ')}. Please reconnect to Drive.`,
          structure: undefined,
          userId
        });
        return false;
      }

      setState({
        linked: !!linked,
        folder_structure_cached,
        pickle_file_exists,
        ensuring: false,
        error: backendError || null,
        structure,
        userId
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

      const userId = getUserId();
      if (!userId) {
        setState(prev => ({
          ...prev,
          error: 'No user ID found. Please reconnect to Google Drive.'
        }));
        throw new Error("User ID not found");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId);
      if (newName) formData.append("new_name", newName);

      const res = await fetch(`${API_BASE}/upload-drive?user_id=${userId}`, {
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
