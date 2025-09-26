export interface User {
  id: string;
  email: string;
  googleId: string;
  createdAt: string;
}

export interface FileUpload {
  id: string;
  userId: string;
  filename: string;
  driveFileId?: string;
  status: FileStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  previewUrl?: string; // data URL for client preview
}

export type FileStatus = 
  | 'uploaded' 
  | 'ocr_done' 
  | 'llm_done' 
  | 'formatted' 
  | 'uploaded_to_drive' 
  | 'failed';

export type CorrectionStatus = 
  | 'NHR' 
  | 'search_failed' 
  | 'ocr_failed' 
  | 'manual_rejection' 
  | 'other' 
  | 'approved';

export interface WineMatch {
  option: string;
  score: number;
  reason: string;
}

export interface ProcessingResult {
  id: string;
  fileId: string;
  ocrText: string;
  topMatches: WineMatch[];
  selectedOption: string;
  correctionStatus: CorrectionStatus;
  finalOutput: string;
  approved: boolean;
  needsReview?: boolean; // flag surfaced in UI
  matchConfidence?: number; // aggregate confidence
  validatedGid?: string; // backend validated_gid for the chosen match
  timestamps: {
    uploadStart?: string;
    ocrDone?: string;
    llmDone?: string;
    formatted?: string;
    uploadedToDrive?: string;
  };
}

export interface ProcessingTableRow extends FileUpload {
  result?: ProcessingResult;
  serverFilename?: string; // filename used by backend after processing/renaming
  originalFile?: File; // original file blob for Drive upload
  driveIds?: {
    input?: string;
    upload?: string;
    output?: string;
    nhr?: string;
    target?: string;
  };
  driveLinks?: {
    input?: string;
    upload?: string;
    output?: string;
    nhr?: string;
    target?: string;
  };
  baseName?: string; // normalized client filename (lowercased, no path)
  originalBaseName?: string; // normalized original File.name
}

export interface ApiError {
  detail: string;
  status: number;
}