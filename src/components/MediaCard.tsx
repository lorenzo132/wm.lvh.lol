import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, MapPin, Calendar, Video, Eye, Trash2, Edit } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaCardProps {
  media: MediaItem;
  onView: (media: MediaItem) => void;
  onDownload: (media: MediaItem) => void;
  onDelete?: (media: MediaItem, password: string) => Promise<void>;
  onEdit: (media: MediaItem) => void;
}

const MediaCard = ({ media, onView, onDownload, onDelete, onEdit }: MediaCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Generate video thumbnail
  useEffect(() => {
    if (media.type === 'video' && !media.thumbnail && !videoThumbnail) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadeddata = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            setVideoThumbnail(thumbnailUrl);
          }
        } catch (error) {
          console.error('Failed to generate video thumbnail:', error);
        }
      };
      
      video.onerror = () => {
        console.error('Failed to load video for thumbnail generation');
      };
      
      video.src = media.url;
      video.load();
    }
  }, [media.type, media.thumbnail, media.url, videoThumbnail]);

  // Handle Ctrl+Shift key combination for showing delete button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        setShowDeleteButton(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) {
        setShowDeleteButton(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!onDelete) return;
    
    const password = prompt('Enter upload password to delete this file:');
    if (!password) return;
    
    setIsDeleting(true);
    try {
      await onDelete(media, password);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file. Please check your password.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Determine the image source for the preview
  const getImageSource = () => {
    if (media.type === 'video') {
      return media.thumbnail || videoThumbnail || media.url;
    }
    return media.thumbnail || media.url;
  };

  return (
    <Card className="group bg-gradient-card border-border hover:border-gallery-accent transition-all duration-300 animate-fade-in shadow-card-gallery hover:shadow-glow">
      <div className="relative aspect-square overflow-hidden">
        {/* Media Preview */}
        <div className="relative w-full h-full bg-muted rounded-inherit overflow-hidden">
          {!imageError ? (
            <img
              src={getImageSource()}
              alt={media.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 rounded-inherit ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted rounded-inherit">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-muted-foreground/20 rounded-lg flex items-center justify-center">
                  {media.type === 'video' ? (
                    <Video className="w-6 h-6 text-muted-foreground" />
                  ) : (
                    <div className="w-6 h-6 bg-muted-foreground/40 rounded" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{media.name}</p>
              </div>
            </div>
          )}

          {/* Video Badge */}
          {media.type === 'video' && (
            <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0">
              <Video className="w-3 h-3 mr-1" />
              Video
            </Badge>
          )}

          {/* Overlay with Controls */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 p-4 z-10">
            <div className="flex gap-2 flex-wrap justify-center max-w-full">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(media);
                }}
                className="bg-white/95 text-black hover:bg-white transition-transform hover:scale-105 shadow-lg border border-gray-200 min-w-fit"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(media);
                }}
                className="bg-white/95 text-black hover:bg-white transition-transform hover:scale-105 shadow-lg border border-gray-200 min-w-fit"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              {showDeleteButton && onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600/95 text-white hover:bg-red-700 transition-transform hover:scale-105 shadow-lg border border-red-500 min-w-fit"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
              {showDeleteButton && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(media);
                  }}
                  className="bg-blue-600/95 text-white hover:bg-blue-700 transition-transform hover:scale-105 shadow-lg border border-blue-500 min-w-fit"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Media Info */}
        <div className="p-4">
          <h3 className="font-semibold text-foreground truncate mb-2">{media.name}</h3>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {media.date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(media.date)}</span>
              </div>
            )}
            
            {media.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{media.location}</span>
              </div>
            )}
          </div>

          {media.size && (
            <p className="text-xs text-muted-foreground mt-2">
              {(media.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MediaCard;