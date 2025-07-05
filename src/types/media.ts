export interface MediaItem {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  type: 'image' | 'video';
  date?: string;
  location?: string;
  size?: number; // in bytes
  dimensions?: {
    width: number;
    height: number;
  };
  tags?: string[];
}

export type SortBy = 'date' | 'location' | 'name';
export type SortOrder = 'asc' | 'desc';