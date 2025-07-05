import { MediaItem } from "@/types/media";
import { getFiles, deleteFile, getFileUrl } from "./api";

const STORAGE_KEY = "gallery-media-items";

export const saveMediaToStorage = (mediaItems: MediaItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mediaItems));
  } catch (error) {
    console.error("Failed to save media to storage:", error);
  }
};

export const loadMediaFromStorage = (): MediaItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load media from storage:", error);
  }
  return [];
};

export const clearMediaStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear media storage:", error);
  }
};

// Load media from server and merge with local metadata
export const loadMediaFromServer = async (): Promise<MediaItem[]> => {
  try {
    const serverFiles = await getFiles();
    const localMedia = loadMediaFromStorage();
    
    // Create a map of local media by filename for quick lookup
    const localMediaMap = new Map<string, MediaItem>();
    localMedia.forEach(media => {
      // Extract filename from URL
      const filename = media.url.split('/').pop();
      if (filename) {
        localMediaMap.set(filename, media);
      }
    });

    // Merge server files with local metadata
    const mergedMedia: MediaItem[] = serverFiles.files.map(fileInfo => {
      const localMedia = localMediaMap.get(fileInfo.filename);
      
      if (localMedia) {
        // Use local metadata but update URL to point to server
        return {
          ...localMedia,
          url: getFileUrl(fileInfo.filename),
          size: fileInfo.size
        };
      } else {
        // Create new media item from server file
        const isVideo = fileInfo.filename.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/);
        return {
          id: `server-${Date.now()}-${Math.random()}`,
          name: fileInfo.filename.replace(/\.[^/.]+$/, ""), // Remove extension
          url: getFileUrl(fileInfo.filename),
          type: isVideo ? 'video' : 'image',
          date: new Date(fileInfo.uploadedAt).toISOString(),
          size: fileInfo.size
        };
      }
    });

    // Sort by upload date (newest first)
    mergedMedia.sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    return mergedMedia;
  } catch (error) {
    console.error("Failed to load media from server:", error);
    return loadMediaFromStorage(); // Fallback to local storage
  }
};

// Delete file from server and remove from local storage
export const deleteMediaFromServer = async (media: MediaItem, password: string): Promise<boolean> => {
  try {
    console.log('Deleting media:', media);
    console.log('Media URL:', media.url);
    
    // Extract filename from URL
    const filename = media.url.split('/').pop();
    console.log('Extracted filename:', filename);
    
    if (!filename) {
      throw new Error('Invalid file URL');
    }

    const result = await deleteFile(filename, password);
    console.log('Delete API result:', result);
    
    // Only remove from local storage if the server deletion was successful
    if (result.success) {
      // Remove from local storage
      const localMedia = loadMediaFromStorage();
      const updatedMedia = localMedia.filter(item => item.id !== media.id);
      saveMediaToStorage(updatedMedia);
      console.log('Removed from local storage');
    }
    
    return result.success;
  } catch (error) {
    console.error("Failed to delete media from server:", error);
    return false;
  }
};