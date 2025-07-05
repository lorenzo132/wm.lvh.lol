import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, MapPin, Calendar, X, Video } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (media: MediaItem) => void;
}

const MediaModal = ({ media, isOpen, onClose, onDownload }: MediaModalProps) => {
  if (!media) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-background border-border">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="p-6 pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-semibold">{media.name}</DialogTitle>
                {media.type === 'video' && (
                  <Badge variant="secondary">
                    <Video className="w-3 h-3 mr-1" />
                    Video
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onDownload(media)}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Media Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Media Viewer */}
            <div className="flex-1 flex items-center justify-center bg-black/20 p-4">
              <div className="max-w-full max-h-full flex items-center justify-center">
                {media.type === 'video' ? (
                  <video
                    src={media.url}
                    controls
                    className="max-w-full max-h-full rounded-lg shadow-2xl"
                    autoPlay={false}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={media.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                )}
              </div>
            </div>

            {/* Media Info Sidebar */}
            <div className="w-80 bg-card border-l border-border p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Details</h3>
                  <div className="space-y-3">
                    {media.date && (
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Date Taken</p>
                          <p className="text-sm text-muted-foreground">{formatDate(media.date)}</p>
                        </div>
                      </div>
                    )}

                    {media.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Location</p>
                          <p className="text-sm text-muted-foreground">{media.location}</p>
                        </div>
                      </div>
                    )}

                    {media.size && (
                      <div>
                        <p className="text-sm font-medium">File Size</p>
                        <p className="text-sm text-muted-foreground">
                          {(media.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    )}

                    {media.dimensions && (
                      <div>
                        <p className="text-sm font-medium">Dimensions</p>
                        <p className="text-sm text-muted-foreground">
                          {media.dimensions.width} × {media.dimensions.height}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {media.tags && media.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-1">
                      {media.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaModal;