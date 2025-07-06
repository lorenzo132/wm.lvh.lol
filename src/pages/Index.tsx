import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import GalleryHeader from "@/components/GalleryHeader";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";
import UploadModal from "@/components/UploadModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleMedia } from "@/data/sampleMedia";
import { MediaItem, SortBy, SortOrder } from "@/types/media";
import { loadMediaFromServer, deleteMediaFromServer } from "@/utils/storage";
import { hasUploadPassword } from "@/utils/passwordManager";

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editMedia, setEditMedia] = useState<MediaItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', location: '', tags: '', photographer: '', date: '', password: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  const locations = useMemo(() => [...new Set(mediaItems.map(item => item.location).filter(Boolean))], [mediaItems]);
  const photographers = useMemo(() => [...new Set(mediaItems.map(item => item.photographer).filter(Boolean))], [mediaItems]);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editPhotographerOpen, setEditPhotographerOpen] = useState(false);

  // Load media from server and localStorage on component mount
  useEffect(() => {
    const loadMedia = async () => {
      try {
        const serverMedia = await loadMediaFromServer();
        setMediaItems(serverMedia);
      } catch (error) {
        console.error("Failed to load media from server:", error);
        setMediaItems([]);
      }
    };

    loadMedia();

    // Check if password is configured
    if (!hasUploadPassword()) {
      console.warn("VITE_UPLOAD_PASSWORD environment variable is not set. Upload functionality will be disabled.");
    }
  }, []);

  // Filter and sort media items
  const filteredAndSortedMedia = useMemo(() => {
    let filtered = mediaItems.filter((media) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        media.name.toLowerCase().includes(searchLower) ||
        media.location?.toLowerCase().includes(searchLower) ||
        media.photographer?.toLowerCase().includes(searchLower) ||
        media.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );

      // Date filter
      let matchesDate = true;
      if (dateFilter && media.date) {
        const mediaDate = new Date(media.date);
        const filterDate = new Date(dateFilter);
        matchesDate = mediaDate.toDateString() === filterDate.toDateString();
      }

      return matchesSearch && matchesDate;
    });

    // Sort the filtered items
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date || '').getTime();
          bValue = new Date(b.date || '').getTime();
          break;
        case 'location':
          aValue = a.location || '';
          bValue = b.location || '';
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [mediaItems, searchTerm, dateFilter, sortBy, sortOrder]);

  // Extract unique values for search autocomplete
  const searchSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    
    // Add unique locations
    const locations = [...new Set(mediaItems.map(item => item.location).filter(Boolean))];
    suggestions.push(...locations);
    
    // Add unique photographers
    const photographers = [...new Set(mediaItems.map(item => item.photographer).filter(Boolean))];
    suggestions.push(...photographers);
    
    // Add unique dates (formatted as readable strings)
    const dates = [...new Set(mediaItems.map(item => {
      if (item.date) {
        return new Date(item.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return null;
    }).filter(Boolean))];
    suggestions.push(...dates);
    
    // Add unique tag names
    const tags = [...new Set(mediaItems.flatMap(item => item.tags || []))];
    suggestions.push(...tags);
    
    return suggestions;
  }, [mediaItems]);

  // Group media items by date and location
  const groupedMedia = useMemo(() => {
    const groups: { [key: string]: MediaItem[] } = {};
    
    filteredAndSortedMedia.forEach((media) => {
      const date = media.date ? new Date(media.date).toDateString() : 'Unknown Date';
      const location = media.location || 'Unknown Location';
      const groupKey = `${date} - ${location}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(media);
    });
    
    return groups;
  }, [filteredAndSortedMedia]);

  const handleSortChange = (newSortBy: SortBy, newSortOrder: SortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  const handleViewMedia = (media: MediaItem) => {
    setSelectedMedia(media);
    setIsModalOpen(true);
  };

  const handleDownloadMedia = (media: MediaItem) => {
    // In a real app, this would trigger an actual download
    toast.success(`Downloading ${media.name}...`);
    
    // Simulate download
    const link = document.createElement('a');
    link.href = media.url;
    link.download = media.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = () => {
    // Check if password is configured
    if (!hasUploadPassword()) {
      toast.error("Upload password not configured. Please set VITE_UPLOAD_PASSWORD in your .env file.");
      return;
    }

    // Always open upload modal directly - password will be entered there
    setIsUploadModalOpen(true);
  };

  const handleUploadComplete = async () => {
    const serverMedia = await loadMediaFromServer();
    setMediaItems(serverMedia);
    setIsUploadModalOpen(false);
    toast.success('Gallery updated with new uploads!');
  };

  const handleDeleteMedia = async (media: MediaItem, password: string) => {
    try {
      const success = await deleteMediaFromServer(media, password);
      if (success) {
        setMediaItems(prev => prev.filter(item => item.id !== media.id));
        toast.success(`${media.name} deleted successfully`);
      } else {
        toast.error('Failed to delete media');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete media');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMedia(null);
  };

  const handleEditMedia = (media: MediaItem) => {
    setEditMedia(media);
    setEditForm({
      name: media.name || '',
      location: media.location || '',
      tags: (media.tags || []).join(', '),
      photographer: media.photographer || '',
      date: media.date ? new Date(media.date).toISOString().slice(0, 16) : '',
      password: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSave = async () => {
    setIsSavingEdit(true);
    // TODO: Call backend to save changes
    setTimeout(() => {
      setIsSavingEdit(false);
      setIsEditModalOpen(false);
      toast.success('Media updated (mock)!');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <GalleryHeader
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchSuggestions={searchSuggestions}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              onDateSearch={() => {
                // The date filtering happens automatically, but this provides user feedback
                // You could add a toast notification here if desired
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              onUpload={handleUpload}
              totalItems={filteredAndSortedMedia.length}
            />
          </div>
          

        </div>

        {/* Gallery Grid */}
        <div className="mt-8">
          {filteredAndSortedMedia.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <div className="w-12 h-12 bg-muted-foreground/20 rounded-lg" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No media found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? `No results for "${searchTerm}"` : "Start by uploading some media"}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMedia).map(([groupKey, groupMedia]) => (
                <div key={groupKey} className="mb-10">
                  {/* Group Header */}
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground">{groupKey.split(' - ')[0]}</h2>
                    <h3 className="text-lg font-medium text-muted-foreground">{groupKey.split(' - ')[1]}</h3>
                  </div>
                  
                  {/* Media Grid for this group */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {groupMedia.map((media) => (
                      <MediaCard
                        key={media.id}
                        media={media}
                        onView={handleViewMedia}
                        onDownload={handleDownloadMedia}
                        onDelete={handleDeleteMedia}
                        onEdit={handleEditMedia}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media Modal */}
        <MediaModal
          media={selectedMedia}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onDownload={handleDownloadMedia}
        />

        {/* Upload Modal */}
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleUploadComplete}
        />

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                label="Name"
                value={editForm.name}
                onChange={e => handleEditFormChange('name', e.target.value)}
                placeholder="Name"
              />
              {/* Location Autocomplete */}
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <Popover open={editLocationOpen} onOpenChange={setEditLocationOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editLocationOpen}
                      className="w-full justify-between bg-background/50"
                    >
                      {editForm.location || "Select location..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search locations..."
                        value={editForm.location}
                        onValueChange={v => handleEditFormChange('location', v)}
                      />
                      <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                          {locations.map((location) => (
                            <CommandItem
                              key={location}
                              value={location}
                              onSelect={(currentValue) => {
                                handleEditFormChange('location', currentValue);
                                setEditLocationOpen(false);
                              }}
                            >
                              <Check className={"mr-2 h-4 w-4 " + (editForm.location === location ? "opacity-100" : "opacity-0")}/>
                              {location}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {/* Date/Time Picker */}
              <div>
                <label className="block text-sm font-medium mb-1">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={editForm.date}
                  onChange={e => handleEditFormChange('date', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              {/* Tags input remains free text for now */}
              <Input
                label="Tags"
                value={editForm.tags}
                onChange={e => handleEditFormChange('tags', e.target.value)}
                placeholder="Tags (comma separated)"
              />
              {/* Photographer Autocomplete */}
              <div>
                <label className="block text-sm font-medium mb-1">Photographer</label>
                <Popover open={editPhotographerOpen} onOpenChange={setEditPhotographerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editPhotographerOpen}
                      className="w-full justify-between bg-background/50"
                    >
                      {editForm.photographer || "Select photographer..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search photographers..."
                        value={editForm.photographer}
                        onValueChange={v => handleEditFormChange('photographer', v)}
                      />
                      <CommandList>
                        <CommandEmpty>No photographer found.</CommandEmpty>
                        <CommandGroup>
                          {photographers.map((photographer) => (
                            <CommandItem
                              key={photographer}
                              value={photographer}
                              onSelect={(currentValue) => {
                                handleEditFormChange('photographer', currentValue);
                                setEditPhotographerOpen(false);
                              }}
                            >
                              <Check className={"mr-2 h-4 w-4 " + (editForm.photographer === photographer ? "opacity-100" : "opacity-0")}/>
                              {photographer}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                label="Password"
                type="password"
                value={editForm.password}
                onChange={e => handleEditFormChange('password', e.target.value)}
                placeholder="Upload password"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={isSavingEdit} className="bg-gradient-primary">
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default Index;