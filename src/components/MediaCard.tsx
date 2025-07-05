import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, MapPin, Calendar, Video, Eye, Trash2 } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaCardProps {
  media: MediaItem;
  onView: (media: MediaItem) => void;
  onDownload: (media: MediaItem) => void;
  onDelete?: (media: MediaItem) => void;
}

const MediaCard = ({ media, onView, onDownload, onDelete }: MediaCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="group overflow-hidden bg-gradient-card border-border hover:border-gallery-accent transition-all duration-300 animate-fade-in shadow-card-gallery hover:shadow-glow">
      <div className="relative aspect-square overflow-hidden">
        {/* Media Preview */}
        <div className="relative w-full h-full bg-muted">
          {!imageError ? (
            <img
              src={media.thumbnail || media.url}
              alt={media.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted">
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
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(media);
                }}
                className="bg-white/90 text-black hover:bg-white transition-transform hover:scale-105"
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
                className="bg-white/90 text-black hover:bg-white transition-transform hover:scale-105"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(media);
                  }}
                  className="bg-red-500/90 text-white hover:bg-red-600 transition-transform hover:scale-105"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
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