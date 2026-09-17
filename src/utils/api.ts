// Keep every media operation on the same backend, including development uploads.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001')).replace(/\/+$/, '');
export const resolveMediaUrl = (url: string): string => new URL(url, `${API_BASE_URL || window.location.origin}/`).href;

export interface FileInfo {
  id?: string;
  name?: string;
  url: string;
  thumbnail?: string;
  type?: string;
  date?: string;
  location?: string;
  size: number;
  dimensions?: { width: number; height: number };
  tags?: string[];
  photographer?: string;
  mimetype?: string;
  uploadedAt: string;
  filename: string;
}
export interface UploadResponse { success: boolean; files: FileInfo[]; message: string; }
export interface FilesResponse { files: FileInfo[]; }
export type UploadMetadata = Partial<Pick<FileInfo, 'name' | 'date' | 'location' | 'tags' | 'photographer' | 'dimensions'>>;

export const uploadFiles = (
  files: File[], password: string, metadata?: UploadMetadata[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadResponse> => new Promise((resolve, reject) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  if (metadata) formData.append('metadata', JSON.stringify(metadata));
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE_URL}/api/upload`);
  // Authenticate before the server accepts any multipart file data. Encode Unicode passwords.
  xhr.setRequestHeader('Authorization', `Bearer ${encodeURIComponent(password)}`);
  xhr.timeout = 15 * 60 * 1000;
  xhr.upload.onprogress = event => {
    if (event.lengthComputable) onProgress?.(event.loaded, event.total);
  };
  xhr.onload = () => {
    let result: UploadResponse & { error?: string };
    try { result = JSON.parse(xhr.responseText); }
    catch { reject(new Error('The upload server returned an invalid response.')); return; }
    if (xhr.status < 200 || xhr.status >= 300 || result.success !== true) {
      reject(new Error(result.error || `Upload failed (${xhr.status}).`));
    } else resolve(result);
  };
  xhr.onerror = () => reject(new Error('Unable to reach the upload server.'));
  xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
  xhr.onabort = () => reject(new Error('Upload cancelled.'));
  xhr.send(formData);
});

export const getFiles = async (): Promise<FilesResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/files`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch files (${response.status}).`);
  }
  const result = await response.json();
  if (!Array.isArray(result.files)) throw new Error('Invalid media collection response.');
  return result;
};

async function mutateFile(method: 'PUT' | 'DELETE', filename: string, body: object): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(filename)}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}
export const deleteFile = (filename: string, password: string) => mutateFile('DELETE', filename, { password });
export const updateFile = (filename: string, updates: Partial<FileInfo>, password: string) => mutateFile('PUT', filename, { ...updates, password });
export const getFileUrl = (filename: string) => `${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
