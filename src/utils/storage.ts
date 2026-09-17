import { MediaItem } from "@/types/media";
import { getFiles, deleteFile, updateFile, resolveMediaUrl } from "./api";
import { validDate } from "./dates";

// Only fetch media from the backend
export const loadMediaFromServer = async (): Promise<MediaItem[]> => {
  try {
    const serverFiles = await getFiles();
    // Map backend data to MediaItem[]
    const mediaItems: MediaItem[] = serverFiles.files.map(fileInfo => ({
      id: fileInfo.id || fileInfo.filename,
      name: fileInfo.name || fileInfo.filename.replace(/\.[^/.]+$/, ""),
      url: resolveMediaUrl(fileInfo.url),
      thumbnail: fileInfo.thumbnail ? resolveMediaUrl(fileInfo.thumbnail) : undefined,
      type: fileInfo.type === 'video' || fileInfo.mimetype?.startsWith('video/') ? 'video' : 'image',
      date: fileInfo.date === '' ? undefined : validDate(fileInfo.date)?.toISOString() || validDate(fileInfo.uploadedAt)?.toISOString(),
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
      const dateA = new Date(a.date || '').getTime() || 0;
      const dateB = new Date(b.date || '').getTime() || 0;
      return dateB - dateA;
    });
    return mediaItems;
  } catch (error) {
    console.error("Failed to load media from server:", error);
    throw error;
  }
};

// Delete file from server
export const deleteMediaFromServer = async (media: MediaItem, password: string): Promise<boolean> => {
  try {
    // Use the filename property from the backend
    const filename = media.filename;
    if (!filename) {
      throw new Error('Invalid file: missing filename property');
    }
    const result = await deleteFile(filename, password);
    return result.success;
  } catch (error) {
    console.error("Failed to delete media from server:", error);
    throw error;
  }
};

// Update media on server
export const updateMediaOnServer = async (
  media: MediaItem,
  updates: Partial<MediaItem>,
  password: string
): Promise<boolean> => {
  try {
    const filename = media.filename;
    if (!filename) throw new Error('Invalid file: missing filename property');
    const result = await updateFile(filename, updates, password);
    return result.success;
  } catch (error) {
    console.error("Failed to update media on server:", error);
    throw error;
  }
};
