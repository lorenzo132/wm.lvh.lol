import { MediaItem } from "@/types/media";
import { getFiles, deleteFile, getFileUrl } from "./api";

// Only fetch media from the backend
export const loadMediaFromServer = async (): Promise<MediaItem[]> => {
  try {
    const serverFiles = await getFiles();
    // Map backend data to MediaItem[]
    const mediaItems: MediaItem[] = serverFiles.files.map(fileInfo => ({
      id: fileInfo.id || fileInfo.filename,
      name: fileInfo.name || fileInfo.filename.replace(/\.[^/.]+$/, ""),
      url: getFileUrl(fileInfo.filename),
      thumbnail: fileInfo.thumbnail,
      type: fileInfo.type || (fileInfo.filename.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/) ? 'video' : 'image'),
      date: fileInfo.date || new Date(fileInfo.uploadedAt).toISOString(),
      location: fileInfo.location,
      size: fileInfo.size,
      dimensions: fileInfo.dimensions,
      tags: fileInfo.tags,
      photographer: fileInfo.photographer,
      mimetype: fileInfo.mimetype,
      uploadedAt: fileInfo.uploadedAt,
      filename: fileInfo.filename,
    }));
    // Sort by upload date (newest first)
    mediaItems.sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return dateB - dateA;
    });
    return mediaItems;
  } catch (error) {
    console.error("Failed to load media from server:", error);
    return [];
  }
};

// Delete file from server
export const deleteMediaFromServer = async (media: MediaItem, password: string): Promise<boolean> => {
  try {
    // Extract filename from URL
    const filename = media.url.split('/').pop();
    if (!filename) {
      throw new Error('Invalid file URL');
    }
    const result = await deleteFile(filename, password);
    return result.success;
  } catch (error) {
    console.error("Failed to delete media from server:", error);
    return false;
  }
};