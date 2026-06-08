export interface FileUploadRequest {
  filename: string;
  mimeType: string;
  size: number;
}

export interface FileUploadResponse {
  uploadUrl: string;
  fileId: string;
  key: string;
}

export interface FileConfirmResponse {
  publicUrl: string;
}
