// Use the current origin for API calls in production, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export interface UploadedFile {
  originalName: string;
  filename: string;
  url: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
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

export const uploadFiles = async (
  files: File[],
  password: string,
  metadata?: any[]
): Promise<UploadResponse> => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  formData.append('password', password);
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  const uploadUrl = `${API_BASE_URL}/api/upload`;
  console.log('Uploading to:', uploadUrl);
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    console.log('Upload response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Upload error details:', error);
    throw error;
  }
};

export const getFiles = async (): Promise<FilesResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/files`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch files: ${response.status}`);
  }

  return response.json();
};

export const deleteFile = async (filename: string, password: string): Promise<{ success: boolean; message: string }> => {
  console.log('Deleting file:', filename);
  console.log('Password provided:', password ? '***' : 'none');
  console.log('API Base URL:', API_BASE_URL);
  
  const deleteUrl = `${API_BASE_URL}/api/files/${encodeURIComponent(filename)}`;
  console.log('Delete URL:', deleteUrl);
  
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  console.log('Delete response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.log('Delete error response:', errorData);
    throw new Error(errorData.error || `Failed to delete file: ${response.status}`);
  }

  return response.json();
};

export const getFileUrl = (filename: string): string => {
  return `${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
}; 