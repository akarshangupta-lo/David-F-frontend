// src/hooks/useDrive.ts
import { useCallback, useState, useEffect } from "react";
import { DriveState, DriveStructure, DriveUploadRequest, DriveUploadResponse, DriveFileSelection } from "../types/drive";

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

  /** Step 3: Upload file to Google Drive */
  const uploadToDrive = useCallback(
    async (selections: DriveFileSelection[]): Promise<DriveUploadResponse> => {
      if (!state.linked) throw new Error("Drive not connected");

      const userId = getUserId();
      if (!userId) {
        setState(prev => ({
          ...prev,
          error: 'No user ID found. Please reconnect to Google Drive.'
        }));
        throw new Error("User ID not found");
      }

      // Validate NHR reasons are provided when needed
      for (const selection of selections) {
        if (selection.target === 'nhr' && !selection.nhr_reason) {
          throw new Error('NHR reason is required for NHR uploads');
        }
      }

      const payload: DriveUploadRequest = {
        selections
      };

      const res = await fetch(`${API_BASE}/upload-to-drive?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Drive upload failed: ${res.status}`);
      }

      const data: DriveUploadResponse = await res.json();
      
      if (data.success && data.drive_file) {
        const driveFile = data.drive_file; // Ensure we have a non-undefined value
        setState(prev => ({
          ...prev,
          lastUploadedFiles: [driveFile]
        }));
      }

      return data;
    },
    [state.linked]
  );

  return { state, connectDrive, checkDriveStatus, uploadToDrive };
};
