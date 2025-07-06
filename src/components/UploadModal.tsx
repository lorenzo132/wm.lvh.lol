import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, X, Calendar, MapPin, Tag, Image, Video, ChevronDown, Check, Plus } from "lucide-react";
import { MediaItem } from "@/types/media";
import { uploadFiles } from "@/utils/api";
import { loadMediaFromServer } from "@/utils/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void;
}

interface FileWithMetadata {
  file: File;
  preview: string;
  name: string;
  location: string;
  date: string;
  tags: string;
  customName: string;
  photographer?: string;
}

const UploadModal = ({ isOpen, onClose, onUpload }: UploadModalProps) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({
    location: "",
    date: new Date().toISOString().slice(0, 16),
    tags: "",
    photographer: ""
  });
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [existingPhotographers, setExistingPhotographers] = useState<string[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [photographerOpen, setPhotographerOpen] = useState(false);
  const [bulkLocationOpen, setBulkLocationOpen] = useState(false);
  const [bulkPhotographerOpen, setBulkPhotographerOpen] = useState(false);
  const [fileLocationOpen, setFileLocationOpen] = useState<{ [key: number]: boolean }>({});
  const [filePhotographerOpen, setFilePhotographerOpen] = useState<{ [key: number]: boolean }>({});
  const [bulkLocationSearch, setBulkLocationSearch] = useState("");
  const [bulkPhotographerSearch, setBulkPhotographerSearch] = useState("");
  const [fileLocationSearch, setFileLocationSearch] = useState<{ [key: number]: string }>({});
  const [filePhotographerSearch, setFilePhotographerSearch] = useState<{ [key: number]: string }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [index: number]: { loaded: number; total: number } }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing media data for autocomplete
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const mediaItems = await loadMediaFromServer();
        const locations = [...new Set(mediaItems.map(item => item.location).filter(Boolean))];
        const photographers = [...new Set(mediaItems.map(item => item.photographer).filter(Boolean))];
        setExistingLocations(locations);
        setExistingPhotographers(photographers);
      } catch (error) {
        console.error('Failed to load existing media data:', error);
      }
    };

    if (isOpen) {
      loadExistingData();
    }
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    selectedFiles.forEach((file) => {
      // Prevent duplicates: check if file with same name and size already exists
      if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
        return;
      }
      if (file.type.startsWith('image/')) {
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
            location: bulkMode ? bulkMetadata.location : "",
            date: bulkMode ? bulkMetadata.date : fileDate.toISOString().slice(0, 16), // Format for datetime-local input
            tags: bulkMode ? bulkMetadata.tags : "",
            photographer: bulkMode ? bulkMetadata.photographer : ""
          };
          setFiles(prev => [...prev, fileWithMetadata]);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        // Generate a thumbnail from the video
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.currentTime = 1; // Try to get a frame at 1 second
        video.onloadeddata = () => {
          // Seek to 10% of duration if possible
          if (video.duration && video.duration > 2) {
            video.currentTime = Math.max(1, video.duration * 0.1);
          }
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const preview = canvas.toDataURL('image/png');
            // Extract date from file metadata or use current date
            const fileDate = file.lastModified ? new Date(file.lastModified) : new Date();
            const fileWithMetadata: FileWithMetadata = {
              file,
              preview,
              name: file.name,
              customName: file.name.replace(/\.[^/.]+$/, ""),
              location: bulkMode ? bulkMetadata.location : "",
              date: bulkMode ? bulkMetadata.date : fileDate.toISOString().slice(0, 16),
              tags: bulkMode ? bulkMetadata.tags : "",
              photographer: bulkMode ? bulkMetadata.photographer : ""
            };
            setFiles(prev => [...prev, fileWithMetadata]);
          }
          URL.revokeObjectURL(videoUrl);
        };
        // Fallback: if seeking fails, use the first frame
        video.onerror = () => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const preview = e.target?.result as string;
            const fileDate = file.lastModified ? new Date(file.lastModified) : new Date();
            const fileWithMetadata: FileWithMetadata = {
              file,
              preview,
              name: file.name,
              customName: file.name.replace(/\.[^/.]+$/, ""),
              location: bulkMode ? bulkMetadata.location : "",
              date: bulkMode ? bulkMetadata.date : fileDate.toISOString().slice(0, 16),
              tags: bulkMode ? bulkMetadata.tags : "",
              photographer: bulkMode ? bulkMetadata.photographer : ""
            };
            setFiles(prev => [...prev, fileWithMetadata]);
          };
          reader.readAsDataURL(file);
        };
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    });
    // Clear the file input after processing
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileMetadata = (index: number, field: keyof FileWithMetadata, value: string) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, [field]: value } : file
    ));
  };

  const handleBulkMetadataChange = (field: keyof typeof bulkMetadata, value: string) => {
    setBulkMetadata(prev => ({ ...prev, [field]: value }));
    setFiles(prevFiles => prevFiles.map(file => ({ ...file, [field]: value })));
  };

  const createNewLocation = (location: string, isBulk: boolean = false, fileIndex?: number) => {
    if (!location.trim()) return;
    
    let formattedLocation = location.trim();
    
    // Check if location already has country code format (city, CC)
    const locationPattern = /^[^,]+,\s*[A-Z]{2}$/;
    if (!locationPattern.test(formattedLocation)) {
      // Auto-detect country code using geocoding API
      detectCountryCode(formattedLocation).then(countryCode => {
        if (countryCode) {
          const finalLocation = `${formattedLocation}, ${countryCode}`;
          
          // Add to existing locations if not already present
          if (!existingLocations.includes(finalLocation)) {
            setExistingLocations(prev => [...prev, finalLocation]);
          }
          
          // Update the appropriate metadata
          if (isBulk) {
            handleBulkMetadataChange('location', finalLocation);
            setBulkLocationSearch("");
            setBulkLocationOpen(false);
          } else if (fileIndex !== undefined) {
            updateFileMetadata(fileIndex, 'location', finalLocation);
            setFileLocationSearch(prev => ({ ...prev, [fileIndex]: "" }));
            setFileLocationOpen(prev => ({ ...prev, [fileIndex]: false }));
          }
        } else {
          toast.error(`Could not detect country for "${formattedLocation}". Please try a different city name.`);
        }
      }).catch(error => {
        console.error('Geocoding error:', error);
        toast.error(`Failed to detect country for "${formattedLocation}". Please try again.`);
      });
      return; // Exit early, the async function will handle the rest
    }
    
    // If already in correct format, proceed normally
    if (!existingLocations.includes(formattedLocation)) {
      setExistingLocations(prev => [...prev, formattedLocation]);
    }
    
    // Update the appropriate metadata
    if (isBulk) {
      handleBulkMetadataChange('location', formattedLocation);
      setBulkLocationSearch("");
      setBulkLocationOpen(false);
    } else if (fileIndex !== undefined) {
      updateFileMetadata(fileIndex, 'location', formattedLocation);
      setFileLocationSearch(prev => ({ ...prev, [fileIndex]: "" }));
      setFileLocationOpen(prev => ({ ...prev, [fileIndex]: false }));
    }
  };

  const detectCountryCode = async (cityName: string): Promise<string | null> => {
    try {
      // Use Nominatim API to geocode the city
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'MediaGallery/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const countryCode = result.address?.country_code?.toUpperCase();
        
        if (countryCode && countryCode.length === 2) {
          return countryCode;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const createNewPhotographer = (photographer: string, isBulk: boolean = false, fileIndex?: number) => {
    if (!photographer.trim()) return;
    
    const trimmedPhotographer = photographer.trim();
    
    // Add to existing photographers if not already present
    if (!existingPhotographers.includes(trimmedPhotographer)) {
      setExistingPhotographers(prev => [...prev, trimmedPhotographer]);
    }
    
    // Update the appropriate metadata
    if (isBulk) {
      handleBulkMetadataChange('photographer', trimmedPhotographer);
      setBulkPhotographerSearch("");
      setBulkPhotographerOpen(false);
    } else if (fileIndex !== undefined) {
      updateFileMetadata(fileIndex, 'photographer', trimmedPhotographer);
      setFilePhotographerSearch(prev => ({ ...prev, [fileIndex]: "" }));
      setFilePhotographerOpen(prev => ({ ...prev, [fileIndex]: false }));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (!password.trim()) {
      toast.error("Upload password is required");
      return;
    }

    setIsUploading(true);
    setUploadProgress({});

    try {
      // Extract dimensions for all files before upload
      const filesWithDimensions = await Promise.all(
        files.map(async (fileData) => {
          let dimensions;
          if (fileData.file.type.startsWith('image/')) {
            dimensions = await getImageDimensions(fileData.preview);
          } else if (fileData.file.type.startsWith('video/')) {
            dimensions = await getVideoDimensions(fileData.preview);
          }
          return { ...fileData, dimensions };
        })
      );

      // Upload files one by one with progress
      for (let i = 0; i < filesWithDimensions.length; i++) {
        const fileData = filesWithDimensions[i];
        const formData = new FormData();
        formData.append('files', fileData.file);
        formData.append('password', password);
        formData.append('metadata', JSON.stringify({
          name: fileData.customName || fileData.name,
          date: fileData.date,
          location: fileData.location,
          tags: typeof fileData.tags === 'string' ? fileData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
          photographer: fileData.photographer || '',
          dimensions: fileData.dimensions,
        }));

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload', true);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(prev => ({
                ...prev,
                [i]: { loaded: event.loaded, total: event.total }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(prev => ({
                ...prev,
                [i]: { loaded: fileData.file.size, total: fileData.file.size }
              }));
              resolve();
            } else {
              reject(new Error(xhr.statusText));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Upload failed'));
          };

          xhr.send(formData);
        });
      }

      onUpload();
      toast.success(`Successfully uploaded ${files.length} file${files.length !== 1 ? 's' : ''}`);
      handleClose();
    } catch (error) {
      let errorMsg = "Failed to upload files";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null && 'error' in error) {
        errorMsg = error.error;
      }
      toast.error(errorMsg);
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
    setPassword("");
    setBulkMode(false);
    setBulkMetadata({
      location: "",
      date: new Date().toISOString().slice(0, 16),
      tags: "",
      photographer: ""
    });
    setBulkLocationSearch("");
    setBulkPhotographerSearch("");
    setFileLocationSearch({});
    setFilePhotographerSearch({});
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
          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="upload-password" className="text-sm font-medium">
              Upload Password *
            </Label>
            <div className="relative">
              <Input
                id="upload-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter upload password"
                className="pr-10 bg-background/50"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          {/* Bulk Upload Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="bulk-mode"
              checked={bulkMode}
              onChange={(e) => setBulkMode(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="bulk-mode" className="text-sm font-medium">
              Bulk Upload Mode
            </Label>
          </div>

          {/* Bulk Metadata (shown when bulk mode is enabled) */}
          {bulkMode && files.length > 0 && (
            <Card className="p-4 bg-gradient-card border-border">
              <h3 className="font-semibold mb-3">Bulk Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="bulk-location" className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Location
                  </Label>
                  <Popover open={bulkLocationOpen} onOpenChange={setBulkLocationOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={bulkLocationOpen}
                        className="w-full justify-between bg-background/50"
                      >
                        {bulkMetadata.location || "Select location..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search locations or type city name (e.g., Berlin)..." 
                          value={bulkLocationSearch}
                          onValueChange={setBulkLocationSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No location found.</CommandEmpty>
                          <CommandGroup>
                            {existingLocations.map((location) => (
                              <CommandItem
                                key={location}
                                value={location}
                                onSelect={(currentValue) => {
                                  handleBulkMetadataChange('location', currentValue);
                                  setBulkLocationOpen(false);
                                  setBulkLocationSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    bulkMetadata.location === location ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {location}
                              </CommandItem>
                            ))}
                            {bulkLocationSearch.trim() && !existingLocations.includes(bulkLocationSearch.trim()) && (
                              <CommandItem
                                value={`create-${bulkLocationSearch}`}
                                onSelect={() => createNewLocation(bulkLocationSearch, true)}
                                className="text-primary"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create "{bulkLocationSearch.trim()}" (auto-detect country)
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="bulk-date" className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Date & Time
                  </Label>
                  <Input
                    id="bulk-date"
                    type="datetime-local"
                    value={bulkMetadata.date}
                    onChange={(e) => handleBulkMetadataChange('date', e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <Label htmlFor="bulk-tags" className="text-sm font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Tags
                  </Label>
                  <Input
                    id="bulk-tags"
                    value={bulkMetadata.tags}
                    onChange={(e) => handleBulkMetadataChange('tags', e.target.value)}
                    placeholder="nature, sunset, mountains"
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <Label htmlFor="bulk-photographer" className="text-sm font-medium flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    Photographer
                  </Label>
                  <Popover open={bulkPhotographerOpen} onOpenChange={setBulkPhotographerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={bulkPhotographerOpen}
                        className="w-full justify-between bg-background/50"
                      >
                        {bulkMetadata.photographer || "Select photographer..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search photographers..." 
                          value={bulkPhotographerSearch}
                          onValueChange={setBulkPhotographerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No photographer found.</CommandEmpty>
                          <CommandGroup>
                            {existingPhotographers.map((photographer) => (
                              <CommandItem
                                key={photographer}
                                value={photographer}
                                onSelect={(currentValue) => {
                                  handleBulkMetadataChange('photographer', currentValue);
                                  setBulkPhotographerOpen(false);
                                  setBulkPhotographerSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    bulkMetadata.photographer === photographer ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {photographer}
                              </CommandItem>
                            ))}
                            {bulkPhotographerSearch.trim() && !existingPhotographers.includes(bulkPhotographerSearch.trim()) && (
                              <CommandItem
                                value={`create-${bulkPhotographerSearch}`}
                                onSelect={() => createNewPhotographer(bulkPhotographerSearch, true)}
                                className="text-primary"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create "{bulkPhotographerSearch.trim()}"
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </Card>
          )}

          {/* File Picker */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-gallery-accent transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.svg,.ico,.avif,.heic,.heif,.jfif,.pjpeg,.pjp,.raw,.arw,.cr2,.nrw,.k25,.dng,.nef,.orf,.sr2,.pef,.raf,.rw2,.rwl,.srw,.bay,.erf,.mef,.mos,.mrw,.srw,.x3f,.mp4,.mov,.avi,.wmv,.flv,.webm,.mkv,.m4v,.3gp,.ogg,.ogv,.mts,.m2ts,.ts,.m2v,.f4v,.f4p,.f4a,.f4b,.divx,.asf,.rm,.rmvb,.vob,.dat,.mpe,.mpg,.mpeg"
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
                            <Badge className="absolute top-1 left-1 bg-gallery-accent text-xs z-10">
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
                          className="absolute top-1 right-1 w-6 h-6 z-20"
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

                        {!bulkMode && (
                          <>
                            <div>
                              <Label htmlFor={`location-${index}`} className="text-sm font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Location
                              </Label>
                              <Popover 
                                open={fileLocationOpen[index] || false} 
                                onOpenChange={(open) => setFileLocationOpen(prev => ({ ...prev, [index]: open }))}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={fileLocationOpen[index] || false}
                                    className="w-full justify-between bg-background/50"
                                  >
                                    {fileData.location || "Select location..."}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput 
                                      placeholder="Search locations or type city name (e.g., Berlin)..." 
                                      value={fileLocationSearch[index] || ""}
                                      onValueChange={(value) => setFileLocationSearch(prev => ({ ...prev, [index]: value }))}
                                    />
                                    <CommandList>
                                      <CommandEmpty>No location found.</CommandEmpty>
                                      <CommandGroup>
                                        {existingLocations.map((location) => (
                                          <CommandItem
                                            key={location}
                                            value={location}
                                            onSelect={(currentValue) => {
                                              updateFileMetadata(index, 'location', currentValue);
                                              setFileLocationOpen(prev => ({ ...prev, [index]: false }));
                                              setFileLocationSearch(prev => ({ ...prev, [index]: "" }));
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                fileData.location === location ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {location}
                                          </CommandItem>
                                        ))}
                                        {(fileLocationSearch[index] || "").trim() && !existingLocations.includes((fileLocationSearch[index] || "").trim()) && (
                                          <CommandItem
                                            value={`create-${fileLocationSearch[index]}`}
                                            onSelect={() => createNewLocation(fileLocationSearch[index] || "", false, index)}
                                            className="text-primary"
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create "{(fileLocationSearch[index] || "").trim()}" (auto-detect country)
                                          </CommandItem>
                                        )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
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

                            <div>
                              <Label htmlFor={`photographer-${index}`} className="text-sm font-medium flex items-center gap-1">
                                <Image className="w-3 h-3" />
                                Photographer
                              </Label>
                              <Popover 
                                open={filePhotographerOpen[index] || false} 
                                onOpenChange={(open) => setFilePhotographerOpen(prev => ({ ...prev, [index]: open }))}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={filePhotographerOpen[index] || false}
                                    className="w-full justify-between bg-background/50"
                                  >
                                    {fileData.photographer || "Select photographer..."}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput 
                                      placeholder="Search photographers..." 
                                      value={filePhotographerSearch[index] || ""}
                                      onValueChange={(value) => setFilePhotographerSearch(prev => ({ ...prev, [index]: value }))}
                                    />
                                    <CommandList>
                                      <CommandEmpty>No photographer found.</CommandEmpty>
                                      <CommandGroup>
                                        {existingPhotographers.map((photographer) => (
                                          <CommandItem
                                            key={photographer}
                                            value={photographer}
                                            onSelect={(currentValue) => {
                                              updateFileMetadata(index, 'photographer', currentValue);
                                              setFilePhotographerOpen(prev => ({ ...prev, [index]: false }));
                                              setFilePhotographerSearch(prev => ({ ...prev, [index]: "" }));
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                fileData.photographer === photographer ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {photographer}
                                          </CommandItem>
                                        ))}
                                        {(filePhotographerSearch[index] || "").trim() && !existingPhotographers.includes((filePhotographerSearch[index] || "").trim()) && (
                                          <CommandItem
                                            value={`create-${filePhotographerSearch[index]}`}
                                            onSelect={() => createNewPhotographer(filePhotographerSearch[index] || "", false, index)}
                                            className="text-primary"
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create "{(filePhotographerSearch[index] || "").trim()}"
                                          </CommandItem>
                                        )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </>
                        )}

                        {bulkMode && (
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">
                              Using bulk metadata for location, date, and tags
                            </p>
                          </div>
                        )}
                      </div>

                      {isUploading && uploadProgress[index] && (
                        <div className="col-span-full flex flex-col gap-1 mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                              {((uploadProgress[index].loaded / 1024 / 1024).toFixed(2))} MB / {((uploadProgress[index].total / 1024 / 1024).toFixed(2))} MB
                              <span className="mx-1">&bull;</span>
                              {((uploadProgress[index].total - uploadProgress[index].loaded) / 1024 / 1024).toFixed(2)} MB left
                            </span>
                          </div>
                          <div className="w-full bg-border rounded h-2 overflow-hidden">
                            <div
                              className="bg-gallery-accent h-2 transition-all"
                              style={{ width: `${Math.min(100, (uploadProgress[index].loaded / uploadProgress[index].total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
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