export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveUploadResponse {
  success?: boolean;
  error?: string;
  target?: string;
  drive_file?: DriveFile;
}

export interface DriveUploadRequest {
  user_id: string;
  target_folders?: string[];
}

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
  lastUploadedFiles?: DriveFile[];
}