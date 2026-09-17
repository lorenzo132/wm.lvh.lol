import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, MapPin, Calendar, X, Video, Share2 } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (media: MediaItem) => void;
}

const MediaModal = ({ media, isOpen, onClose, onDownload }: MediaModalProps) => {
  if (!media || !isOpen) return null;

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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: media.name,
          url: media.url,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(media.url);
        alert('Link copied to clipboard!');
      } catch (err) {
        alert('Failed to copy link.');
      }
    } else {
      alert('Sharing not supported.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-7xl w-[calc(100%-2rem)] h-[90dvh] p-0 bg-background border-border flex overflow-hidden">
        <div className="flex flex-col h-full w-full">
          {/* Header */}
          <DialogHeader className="p-4 pr-12 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-lg font-semibold break-all text-left">{media.name}</DialogTitle>
                {media.type === 'video' && (
                  <Badge variant="secondary">
                    <Video className="w-3 h-3 mr-1" />
                    Video
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleShare}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
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
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto">
            {/* Media Viewer */}
            <div className="flex-1 min-h-[35vh] md:min-h-0 w-full flex items-center justify-center bg-black/95 overflow-hidden">
              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                {media.type === 'video' ? (
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="none"
                    poster={media.thumbnail}
                    className="block max-w-full max-h-full object-contain mx-auto"
                    autoPlay={false}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={media.name}
                    className="block max-w-full max-h-full object-contain mx-auto"
                  />
                )}
              </div>
            </div>

            {/* Media Info Sidebar */}
            <div className="w-full md:w-72 shrink-0 bg-card border-t md:border-t-0 md:border-l border-border p-5 md:overflow-y-auto">
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

                {media.photographer && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Photographer</h3>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {media.photographer}
                      </Badge>
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
