import { useState, useMemo, useEffect, useDeferredValue, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import GalleryHeader from "@/components/GalleryHeader";
import MediaCard from "@/components/MediaCard";
const MediaModal = lazy(() => import("@/components/MediaModal"));
const UploadModal = lazy(() => import("@/components/UploadModal"));
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronDown, Check, ChevronLeft, ChevronRight, MapPin, Images, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaItem, SortBy, SortOrder } from "@/types/media";
import { loadMediaFromServer, deleteMediaFromServer, updateMediaOnServer } from "@/utils/storage";
import { toLocalDateTime, toStoredDate } from "@/utils/dates";

const PAGE_SIZE = 24;

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
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

  const refreshMedia = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try { setMediaItems(await loadMediaFromServer()); }
    catch { setLoadError(true); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void refreshMedia(); }, [refreshMedia]);

  // One shortcut listener for the gallery, rather than two listeners per item.
  useEffect(() => {
    const update = (event: KeyboardEvent) => setShowManagement(event.ctrlKey && event.shiftKey);
    const reset = () => setShowManagement(false);
    document.addEventListener('keydown', update);
    document.addEventListener('keyup', update);
    window.addEventListener('blur', reset);
    return () => {
      document.removeEventListener('keydown', update);
      document.removeEventListener('keyup', update);
      window.removeEventListener('blur', reset);
    };
  }, []);

  useEffect(() => { setPage(1); }, [deferredSearch, dateFilter, sortBy, sortOrder]);

  // Filter and sort media items
  const filteredAndSortedMedia = useMemo(() => {
    const searchLower = deferredSearch.trim().toLowerCase();
    const filtered = mediaItems.filter((media) => {
      // Search filter
      const matchesSearch = (
        media.name.toLowerCase().includes(searchLower) ||
        media.location?.toLowerCase().includes(searchLower) ||
        media.photographer?.toLowerCase().includes(searchLower) ||
        media.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );

      // Date filter
      let matchesDate = true;
      if (dateFilter) {
        const mediaDate = new Date(media.date || '');
        const filterDate = new Date(dateFilter + 'T00:00:00');
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
          aValue = new Date(a.date || '').getTime() || 0;
          bValue = new Date(b.date || '').getTime() || 0;
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
  }, [mediaItems, deferredSearch, dateFilter, sortBy, sortOrder]);

  // Extract unique values for search autocomplete
  const searchSuggestions = useMemo(() => {
    const suggestions: string[] = [];

    // Add unique locations
    const locations = [...new Set(mediaItems.map(item => item.location).filter(Boolean))];
    suggestions.push(...locations);

    // Add unique photographers
    const photographers = [...new Set(mediaItems.map(item => item.photographer).filter(Boolean))];
    suggestions.push(...photographers);

    // Add unique tag names
    const tags = [...new Set(mediaItems.flatMap(item => item.tags || []))];
    suggestions.push(...tags);

    return [...new Set(suggestions)];
  }, [mediaItems]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedMedia.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const groupedMedia = useMemo(() => {
    const groups: { key: string; date: string; location: string; items: MediaItem[] }[] = [];
    const dateGroups = new Map<string, typeof groups[number]>();
    const visible = filteredAndSortedMedia.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    visible.forEach(media => {
      const parsed = new Date(media.date || '');
      const date = Number.isNaN(parsed.getTime()) ? 'Undated' : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const location = media.location || 'No location';
      const key = JSON.stringify([date, location]);
      const last = sortBy === 'date' ? dateGroups.get(key) : groups[groups.length - 1];
      // Contiguous groups preserve the selected global name/location ordering.
      if (last?.key === key) last.items.push(media);
      else {
        const group = { key, date, location, items: [media] };
        groups.push(group);
        dateGroups.set(key, group);
      }
    });
    return groups;
  }, [filteredAndSortedMedia, currentPage, sortBy]);

  const changePage = (next: number) => {
    setPage(next);
    document.getElementById('gallery-results')?.scrollIntoView({ block: 'start' });
  };

  const handleSortChange = (newSortBy: SortBy, newSortOrder: SortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  const handleViewMedia = (media: MediaItem) => {
    setSelectedMedia(media);
    setIsModalOpen(true);
  };

  const handleDownloadMedia = async (media: MediaItem) => {
    toast.success(`Downloading ${media.name}...`);

    try {
      // For cross-origin URLs (like S3), we need to fetch and create a blob
      const response = await fetch(media.url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();

      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;

      // Get file extension from URL or mimetype
      const urlExt = media.url.split('.').pop()?.split('?')[0] || '';
      const filename = `${media.name}.${urlExt}`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(media.url, '_blank', 'noopener,noreferrer');
      toast.error('Download failed, opened in new tab instead');
    }
  };

  const handleUpload = () => {
    setIsUploadModalOpen(true);
  };

  const handleUploadComplete = async () => {
    setIsUploadModalOpen(false);
    await refreshMedia();
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
      toast.error(error instanceof Error ? error.message : 'Failed to delete media');
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
      date: media.date ? toLocalDateTime(media.date) : '',
      password: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editMedia || isSavingEdit) return;
    if (!editForm.name.trim()) {
      toast.error('Please enter a media name.');
      return;
    }
    if (!editForm.password) {
      toast.error('Password is required to save changes.');
      return;
    }
    setIsSavingEdit(true);
    const updates = {
      name: editForm.name.trim(),
      location: editForm.location,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      photographer: editForm.photographer,
      date: editForm.date === toLocalDateTime(editMedia.date || '') ? editMedia.date || '' : toStoredDate(editForm.date),
    };
    try {
      const success = await updateMediaOnServer(editMedia, updates, editForm.password);
      if (success) {
        // The mutation already succeeded; a second GET must not turn it into a failure.
        setMediaItems(items => items.map(item => item.id === editMedia.id ? { ...item, ...updates } : item));
        setIsEditModalOpen(false);
        toast.success('Media updated!');
      } else {
        toast.error('Failed to update media.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update media.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gallery-shell">
        <GalleryHeader
          searchTerm={searchTerm} onSearchChange={setSearchTerm} searchSuggestions={searchSuggestions}
          dateFilter={dateFilter} onDateFilterChange={setDateFilter}
          sortBy={sortBy} sortOrder={sortOrder} onSortChange={handleSortChange}
          onUpload={handleUpload} totalItems={mediaItems.length}
        />
        <main id="gallery-results" className="gallery-results" aria-busy={isLoading}>
          <div className="results-bar"><span>{searchTerm || dateFilter ? 'Search results' : 'All media'} <span className="result-badge">{filteredAndSortedMedia.length.toLocaleString()}</span></span>
            {(searchTerm || dateFilter) && <button onClick={() => { setSearchTerm(''); setDateFilter(''); }} className="text-sm text-muted-foreground hover:text-foreground">Clear filters</button>}
          </div>
          {isLoading ? <div className="media-grid" role="status" aria-label="Loading media">{Array.from({ length: 8 }, (_, i) => <div key={i} className="gallery-skeleton"><div /><span /></div>)}</div>
            : loadError ? <div className="gallery-empty" role="alert"><RotateCcw /><h2>Unable to load your collection</h2><p>Please try again in a moment.</p><Button variant="outline" onClick={refreshMedia}>Try again</Button></div>
            : filteredAndSortedMedia.length === 0 ? <div className="gallery-empty"><Images /><h2>{searchTerm || dateFilter ? 'No matching moments' : 'Your collection starts here'}</h2><p>{searchTerm || dateFilter ? 'Try another search or clear your filters.' : 'Upload photos and videos to bring your gallery to life.'}</p><Button variant="outline" onClick={searchTerm || dateFilter ? () => { setSearchTerm(''); setDateFilter(''); } : handleUpload}>{searchTerm || dateFilter ? 'Clear filters' : 'Upload media'}</Button></div>
            : <>
              <div className="space-y-10">
                {groupedMedia.map((group, index) => <section key={group.key + index} aria-label={group.date + ', ' + group.location}>
                  <div className="group-heading"><h2>{group.date}</h2><span className="group-location"><MapPin size={13} />{group.location}</span><span className="group-rule" /><span className="group-count">{group.items.length}</span></div>
                  <div className="media-grid">{group.items.map(media => <MediaCard key={media.id} media={media} onView={handleViewMedia} onDownload={handleDownloadMedia} onDelete={handleDeleteMedia} onEdit={handleEditMedia} showManagement={showManagement} />)}</div>
                </section>)}
              </div>
              <nav className="gallery-pagination" aria-label="Gallery pages">
                <span aria-live="polite">Showing {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()} to {Math.min(currentPage * PAGE_SIZE, filteredAndSortedMedia.length).toLocaleString()} of {filteredAndSortedMedia.length.toLocaleString()}</span>
                {totalPages > 1 && <div className="flex items-center gap-3"><Button variant="outline" size="icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={16} /></Button><span>Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}><ChevronRight size={16} /></Button></div>}
              </nav>
            </>}
        </main>
        <footer className="gallery-footer"><span>wm. gallery</span><span>Keep the moments that matter.</span></footer>

        {/* Media Modal */}
        <Suspense fallback={<div className="dialog-loading" role="status">Opening...</div>}>
        {isModalOpen && <MediaModal
          media={selectedMedia}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onDownload={handleDownloadMedia}
        />}

        {/* Upload Modal */}
        {isUploadModalOpen && <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleUploadComplete}
          locations={locations}
          photographers={photographers}
        />}
        </Suspense>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Media Preview */}
              {editMedia && (
                <div className="flex justify-center mb-2">
                  {editMedia.type === 'image' ? (
                    <img
                      src={editMedia.url}
                      alt={editMedia.name}
                      className="max-h-48 rounded shadow"
                    />
                  ) : editMedia.type === 'video' ? (
                    <video
                      src={editMedia.url}
                      controls
                      preload="none"
                      className="max-h-48 rounded shadow"
                    />
                  ) : null}
                </div>
              )}
              <Input
                aria-label="Name"
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
                              <Check className={"mr-2 h-4 w-4 " + (editForm.location === location ? "opacity-100" : "opacity-0")} />
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
                aria-label="Tags"
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
                              <Check className={"mr-2 h-4 w-4 " + (editForm.photographer === photographer ? "opacity-100" : "opacity-0")} />
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
                aria-label="Password"
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
