import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingTableRow, FileUpload, ProcessingResult, ApiError } from '../types';

export const useFileProcessing = () => {
  const [files, setFiles] = useState<ProcessingTableRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const uploadFiles = useCallback(async (selectedFiles: File[]) => {
    setUploading(true);
    setUploadProgress({});

    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`files`, file);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 0
        }));
      });

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const uploadedFiles: FileUpload[] = await response.json();
      
      // Convert to ProcessingTableRow format
      const tableRows: ProcessingTableRow[] = uploadedFiles.map(file => ({
        ...file,
        result: undefined
      }));

      setFiles(prev => [...prev, ...tableRows]);

      // Start monitoring progress for each file
      tableRows.forEach(file => {
        startStatusMonitoring(file.id);
      });

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [API_BASE_URL]);

  const startStatusMonitoring = useCallback((fileId: string) => {
    const eventSource = new EventSource(`${API_BASE_URL}/status/${fileId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        
        setFiles(prev => prev.map(file => {
          if (file.id === fileId) {
            return {
              ...file,
              status: update.status,
              errorMessage: update.errorMessage,
              result: update.result,
            };
          }
          return file;
        }));

        if (update.status === 'uploaded_to_drive' || update.status === 'failed') {
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  }, [API_BASE_URL]);

  const updateFileResult = useCallback((fileId: string, updates: Partial<ProcessingResult>) => {
    setFiles(prev => prev.map(file => {
      if (file.id === fileId && file.result) {
        return {
          ...file,
          result: {
            ...file.result,
            ...updates
          }
        };
      }
      return file;
    }));
  }, []);

  const retryFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/retry/${fileId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || 'Retry failed');
      }

      // Restart monitoring
      startStatusMonitoring(fileId);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [API_BASE_URL, startStatusMonitoring]);

  const saveResults = useCallback(async () => {
    try {
      const approvedFiles = files.filter(file => file.result?.approved);
      
      const response = await fetch(`${API_BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results: approvedFiles.map(file => file.result)
        }),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || 'Save failed');
      }

      // Update all saved files to uploaded_to_drive status
      setFiles(prev => prev.map(file => {
        if (file.result?.approved) {
          return {
            ...file,
            status: 'uploaded_to_drive'
          };
        }
        return file;
      }));

      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }, [API_BASE_URL, files]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadProgress({});
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    files,
    uploading,
    uploadProgress,
    uploadFiles,
    updateFileResult,
    retryFile,
    saveResults,
    clearFiles,
  };
};