import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import GalleryHeader from "@/components/GalleryHeader";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";
import UploadModal from "@/components/UploadModal";

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

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

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
  }, [mediaItems, searchTerm, sortBy, sortOrder]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <GalleryHeader
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredAndSortedMedia.map((media) => (
                <MediaCard
                  key={media.id}
                  media={media}
                  onView={handleViewMedia}
                  onDownload={handleDownloadMedia}
                  onDelete={handleDeleteMedia}
                />
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


      </div>
    </div>
  );
};

export default Index;