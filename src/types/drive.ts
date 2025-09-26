export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveUploadResponse {
  success?: boolean;
  error?: string;
  drive_file?: DriveFile;
}

export interface DriveUploadSelection {
  image: string;
  selected_name: string;
  target: 'output' | 'nhr';
  nhr_reason?: 'search_failed' | 'ocr_failed' | 'manual_rejection' | 'others';
}

export interface DriveUploadRequest {
  user_id: string;
  selections: DriveUploadSelection[];
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