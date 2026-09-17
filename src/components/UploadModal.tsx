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
import { toLocalDateTime, toStoredDate } from "@/utils/dates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void | Promise<void>;
  locations: string[];
  photographers: string[];
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

const UploadModal = ({ isOpen, onClose, onUpload, locations, photographers }: UploadModalProps) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({
    location: "",
    date: toLocalDateTime(new Date()),
    tags: "",
    photographer: ""
  });
  const [existingLocations, setExistingLocations] = useState<string[]>(locations);
  const [existingPhotographers, setExistingPhotographers] = useState<string[]>(photographers);
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

  const previewUrls = useRef(new Set<string>());
  const uploadInProgress = useRef(false);
  const uploadedAny = useRef(false);
  useEffect(() => {
    const urls = previewUrls.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadInProgress.current) return;
    const knownFiles = new Set(files.map(item => item.file.name + ':' + item.file.size));
    const selected: FileWithMetadata[] = [];
    for (const file of Array.from(event.target.files || [])) {
      const key = file.name + ':' + file.size;
      if (knownFiles.has(key)) continue;
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error('Unsupported file type: ' + file.name);
        continue;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.error(file.name + ' exceeds the 200 MB limit.');
        continue;
      }
      knownFiles.add(key);
      // Selection never depends on browser video codecs, seeking, or canvas decoding.
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      if (preview) previewUrls.current.add(preview);
      selected.push({ file, preview, name: file.name, customName: file.name.replace(/\.[^/.]+$/, ''),
        location: bulkMode ? bulkMetadata.location : '',
        date: bulkMode ? bulkMetadata.date : toLocalDateTime(new Date(file.lastModified || Date.now())),
        tags: bulkMode ? bulkMetadata.tags : '', photographer: bulkMode ? bulkMetadata.photographer : '' });
    }
    setFiles(current => [...current, ...selected]);
    event.target.value = '';
  };

  const releasePreview = (item: FileWithMetadata) => {
    if (item.preview) { URL.revokeObjectURL(item.preview); previewUrls.current.delete(item.preview); }
  };
  const removeFile = (index: number) => {
    if (uploadInProgress.current) return;
    releasePreview(files[index]);
    setFiles(current => current.filter((_, i) => i !== index));
    setFileLocationOpen({}); setFilePhotographerOpen({});
    setFileLocationSearch({}); setFilePhotographerSearch({});
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

  const createNewLocation = (location: string, isBulk = false, fileIndex?: number) => {
    const value = location.trim();
    if (!value) return;
    setExistingLocations(current => current.includes(value) ? current : [...current, value]);
    if (isBulk) {
      handleBulkMetadataChange('location', value);
      setBulkLocationSearch(''); setBulkLocationOpen(false);
    } else if (fileIndex !== undefined) {
      updateFileMetadata(fileIndex, 'location', value);
      setFileLocationSearch(current => ({ ...current, [fileIndex]: '' }));
      setFileLocationOpen(current => ({ ...current, [fileIndex]: false }));
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
    if (uploadInProgress.current || !files.length) return;
    if (!password.trim()) { toast.error('Upload password is required'); return; }
    if (files.some(item => !item.customName.trim())) { toast.error('Please enter a name for each file.'); return; }
    uploadInProgress.current = true;
    setIsUploading(true);
    setUploadProgress({});
    const completed = new Set<File>();
    try {
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        const dimensions = item.file.type.startsWith('image/') ? await getImageDimensions(item.preview) : undefined;
        await uploadFiles([item.file], password, [{
          name: item.customName.trim(), date: toStoredDate(item.date), location: item.location,
          tags: item.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          photographer: item.photographer || '', dimensions,
        }], (loaded, total) => setUploadProgress(current => ({ ...current, [i]: { loaded, total } })));
        completed.add(item.file);
        uploadedAny.current = true;
      }
      toast.success('Successfully uploaded ' + completed.size + ' file(s)');
      await onUpload();
      onClose();
    } catch (error) {
      // Retrying a partially failed batch must not upload successful files twice.
      files.filter(item => completed.has(item.file)).forEach(releasePreview);
      setFiles(current => current.filter(item => !completed.has(item.file)));
      setUploadProgress({});
      toast.error(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      uploadInProgress.current = false;
      setIsUploading(false);
    }
  };

  const getImageDimensions = (src: string): Promise<{ width: number; height: number } | undefined> => new Promise(resolve => {
    const image = document.createElement('img');
    const finish = (dimensions?: { width: number; height: number }) => {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      resolve(dimensions);
    };
    const timeout = window.setTimeout(() => finish(), 5000);
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish();
    image.src = src;
  });

  const handleClose = () => {
    if (uploadInProgress.current) return;
    if (uploadedAny.current) { void onUpload(); return; }
    setFiles([]);
    setPassword("");
    setBulkMode(false);
    setBulkMetadata({
      location: "",
      date: toLocalDateTime(new Date()),
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
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload Media</DialogTitle>
        </DialogHeader>

        <fieldset disabled={isUploading} className="space-y-6 min-w-0">
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
              onChange={(e) => {
                setBulkMode(e.target.checked);
                if (e.target.checked) setFiles(current => current.map(item => ({ ...item, ...bulkMetadata })));
              }}
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
                                Create "{bulkLocationSearch.trim()}"
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
                  <Card key={fileData.file.name + '-' + fileData.file.size} className="p-4 bg-gradient-card border-border">
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
                          aria-label={`Remove ${fileData.name}`}
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Metadata Form */}
                      <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                            Create "{(fileLocationSearch[index] || "").trim()}"
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
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
