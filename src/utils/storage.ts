import { MediaItem } from "@/types/media";

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