import { useState } from "react";
import { Download, ImageOff, Play, Trash2, Pencil, Image as ImageIcon } from "lucide-react";
import { MediaItem } from "@/types/media";
import { usePreview } from "@/hooks/use-preview";

interface MediaCardProps {
  media: MediaItem;
  onView: (media: MediaItem) => void;
  onDownload: (media: MediaItem) => void;
  onDelete?: (media: MediaItem, password: string) => Promise<void>;
  onEdit: (media: MediaItem) => void;
  showManagement?: boolean;
}

const MediaCard = ({ media, onView, onDownload, onDelete, onEdit, showManagement }: MediaCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  // Never download a video to make a preview. Missing posters get a placeholder.
  const source = media.thumbnail || (media.type === 'image' ? media.url : undefined);
  const { imageRef, containerRef, status } = usePreview(source);
  const handleDelete = async () => {
    const password = prompt('Enter upload password to delete this file:');
    if (!password || !onDelete) return;
    setIsDeleting(true);
    try { await onDelete(media, password); }
    finally { setIsDeleting(false); }
  };
  return (
    <article className="media-card group">
      <button ref={containerRef} className="media-preview" onClick={() => onView(media)} aria-label={`Open ${media.name}`}>
        <span className="preview-placeholder" aria-hidden="true">
          {media.type === 'video' ? <Play /> : status === 'error' ? <ImageOff /> : <ImageIcon />}
          {status === 'error' && <span>Preview unavailable</span>}
          {!source && <span>Open video</span>}
        </span>
        {source && <img ref={imageRef} alt={media.name} decoding="async" width="640" height="480"
          className={`preview-image ${status === 'loaded' ? 'is-loaded' : ''}`} />}
        {media.type === 'video' && <span className="video-indicator"><Play size={12} fill="currentColor" /> Video</span>}
        <span className="preview-open">{media.type === 'video' ? 'Watch video' : 'View photo'}</span>
      </button>
      <div className="media-caption">
        <div className="min-w-0">
          <button onClick={() => onView(media)} className="media-name" title={media.name}>{media.name}</button>
          <p className="media-meta">{media.photographer || (media.type === 'video' ? 'Video' : 'Photo')}
            {!!media.size && <><span aria-hidden="true"> · </span>{(media.size / (1024 * 1024)).toFixed(1)} MB</>}
          </p>
        </div>
        <button className="icon-action" onClick={() => onDownload(media)} aria-label={`Download ${media.name}`} title="Download original"><Download size={16} /></button>
      </div>
      {showManagement && <div className="flex gap-3 pb-3 text-sm">
        <button className="flex items-center gap-1" onClick={() => onEdit(media)}><Pencil size={14} /> Edit</button>
        {onDelete && <button className="flex items-center gap-1 text-destructive" onClick={handleDelete} disabled={isDeleting}><Trash2 size={14} />{isDeleting ? 'Deleting…' : 'Delete'}</button>}
      </div>}
    </article>
  );
};
export default MediaCard;
