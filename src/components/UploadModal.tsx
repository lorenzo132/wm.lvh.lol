import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Upload, X, Calendar, MapPin, Tag, Image, Video } from "lucide-react";
import { MediaItem } from "@/types/media";
import { uploadFiles } from "@/utils/api";
import { toast } from "sonner";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (mediaItems: MediaItem[]) => void;
}

interface FileWithMetadata {
  file: File;
  preview: string;
  name: string;
  location: string;
  date: string;
  tags: string;
  customName: string;
}

const UploadModal = ({ isOpen, onClose, onUpload }: UploadModalProps) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    selectedFiles.forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          
          // Extract date from file metadata or use current date
          const fileDate = file.lastModified ? new Date(file.lastModified) : new Date();
          
          const fileWithMetadata: FileWithMetadata = {
            file,
            preview,
            name: file.name,
            customName: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            location: "",
            date: fileDate.toISOString().slice(0, 16), // Format for datetime-local input
            tags: ""
          };
          
          setFiles(prev => [...prev, fileWithMetadata]);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileMetadata = (index: number, field: keyof FileWithMetadata, value: string) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, [field]: value } : file
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsUploading(true);

    try {
      // Upload files to server
      const fileList = files.map(fileData => fileData.file);
      const uploadResponse = await uploadFiles(fileList);

      // Create media items with server URLs
      const mediaItems: MediaItem[] = await Promise.all(
        files.map(async (fileData, index) => {
          const uploadedFile = uploadResponse.files[index];
          
          // Get image/video dimensions
          let dimensions;
          if (fileData.file.type.startsWith('image/')) {
            dimensions = await getImageDimensions(fileData.preview);
          } else if (fileData.file.type.startsWith('video/')) {
            dimensions = await getVideoDimensions(fileData.preview);
          }

          const mediaItem: MediaItem = {
            id: `upload-${Date.now()}-${index}`,
            name: fileData.customName || fileData.name,
            url: uploadedFile.url,
            thumbnail: fileData.preview,
            type: fileData.file.type.startsWith('video/') ? 'video' : 'image',
            date: new Date(fileData.date).toISOString(),
            location: fileData.location || undefined,
            size: uploadedFile.size,
            dimensions,
            tags: fileData.tags ? fileData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined
          };

          return mediaItem;
        })
      );

      onUpload(mediaItems);
      toast.success(uploadResponse.message);
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload files");
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = src;
    });
  };

  const getVideoDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      video.src = src;
    });
  };

  const handleClose = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload Media</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Picker */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-gallery-accent transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-gallery-accent/10 rounded-lg flex items-center justify-center">
                <Upload className="w-6 h-6 text-gallery-accent" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Choose files to upload</h3>
                <p className="text-sm text-muted-foreground">
                  Select images and videos from your device
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                Select Files
              </Button>
            </div>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Selected Files ({files.length})</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {files.map((fileData, index) => (
                  <Card key={index} className="p-4 bg-gradient-card border-border">
                    <div className="flex gap-4">
                      {/* Preview */}
                      <div className="relative w-20 h-20 flex-shrink-0">
                        {fileData.file.type.startsWith('video/') ? (
                          <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                            <Badge className="absolute -top-1 -right-1 bg-gallery-accent text-xs">
                              Video
                            </Badge>
                          </div>
                        ) : (
                          <img
                            src={fileData.preview}
                            alt={fileData.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 w-6 h-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Metadata Form */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`name-${index}`} className="text-sm font-medium">
                            Display Name
                          </Label>
                          <Input
                            id={`name-${index}`}
                            value={fileData.customName}
                            onChange={(e) => updateFileMetadata(index, 'customName', e.target.value)}
                            placeholder="Enter display name"
                            className="bg-background/50"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`location-${index}`} className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Location
                          </Label>
                          <Input
                            id={`location-${index}`}
                            value={fileData.location}
                            onChange={(e) => updateFileMetadata(index, 'location', e.target.value)}
                            placeholder="e.g., Paris, France"
                            className="bg-background/50"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`date-${index}`} className="text-sm font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Date & Time
                          </Label>
                          <Input
                            id={`date-${index}`}
                            type="datetime-local"
                            value={fileData.date}
                            onChange={(e) => updateFileMetadata(index, 'date', e.target.value)}
                            className="bg-background/50"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`tags-${index}`} className="text-sm font-medium flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Tags
                          </Label>
                          <Input
                            id={`tags-${index}`}
                            value={fileData.tags}
                            onChange={(e) => updateFileMetadata(index, 'tags', e.target.value)}
                            placeholder="nature, sunset, mountains"
                            className="bg-background/50"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Separate tags with commas
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {isUploading ? "Uploading..." : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;