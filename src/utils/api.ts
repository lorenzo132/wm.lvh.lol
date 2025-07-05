const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface UploadedFile {
  originalName: string;
  filename: string;
  url: string;
  size: number;
  mimetype: string;
}

export interface FileInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface UploadResponse {
  success: boolean;
  files: UploadedFile[];
  message: string;
}

export interface FilesResponse {
  files: FileInfo[];
}

export const uploadFiles = async (files: File[]): Promise<UploadResponse> => {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed: ${response.status}`);
  }

  return response.json();
};

export const getFiles = async (): Promise<FilesResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/files`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch files: ${response.status}`);
  }

  return response.json();
};

export const deleteFile = async (filename: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete file: ${response.status}`);
  }

  return response.json();
};

export const getFileUrl = (filename: string): string => {
  return `${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
}; 