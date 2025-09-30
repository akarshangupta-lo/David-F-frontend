import React, { useCallback, useRef, useState } from 'react';
import { Upload, Image, X, AlertCircle } from 'lucide-react';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  uploading: boolean;
  disabled?: boolean;
  onPreviewFile?: (file: File) => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ 
  onFilesSelected, 
  uploading, 
  disabled = false,
  onPreviewFile
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateFiles = useCallback((files: File[]): { valid: File[], errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 100;

    if (files.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return { valid, errors };
    }

    files.forEach((file, index) => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`File ${index + 1}: ${file.name} - Invalid file type. Only JPEG, PNG, and WebP are allowed.`);
        return;
      }
      
      if (file.size > maxSize) {
        errors.push(`File ${index + 1}: ${file.name} - File too large. Maximum 10MB allowed.`);
        return;
      }

      valid.push(file);
    });

    return { valid, errors };
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    setError(null);
    setSelectedFiles(valid);
  }, [validateFiles]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled || uploading) return;
    
    handleFiles(e.dataTransfer.files);
  }, [handleFiles, disabled, uploading]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || uploading) return;
    handleFiles(e.target.files);
  }, [handleFiles, disabled, uploading]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = useCallback(() => {
    if (selectedFiles.length === 0) return;
    onFilesSelected(selectedFiles);
    setSelectedFiles([]);
    setError(null);
  }, [selectedFiles, onFilesSelected]);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${dragActive 
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
          }
          ${disabled || uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled || uploading}
          ref={inputRef}
        />
        
        <div className="space-y-3">
          <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
            <Upload className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              Drop wine label images here
            </p>
            <p className="text-sm text-gray-500">
              or click to select files (max 100 images, 10MB each)
            </p>
          </div>
          <div className="flex justify-center space-x-1 text-xs text-gray-400">
            <span>JPEG</span>
            <span>•</span>
            <span>PNG</span>
            <span>•</span>
            <span>WebP</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Upload Error</p>
              <pre className="text-sm text-red-700 whitespace-pre-line mt-1">{error}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h3>
            {/* <button
              onClick={clearFiles}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Clear All
            </button> */}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => {
              const objectUrl = URL.createObjectURL(file);
              return (
                <div key={index} className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2">
                  <img
                    src={objectUrl}
                    alt={file.name}
                    className="h-10 w-10 object-cover rounded border cursor-pointer"
                    onClick={() => onPreviewFile && onPreviewFile(file)}
                  />
                  <span className="text-sm text-gray-700 flex-1 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={clearFiles}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear All
            </button>
            <button
              onClick={uploadFiles}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-900 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Images'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};