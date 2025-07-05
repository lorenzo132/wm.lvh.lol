import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SortAsc, SortDesc, Upload, Filter, Calendar, X } from "lucide-react";

interface GalleryHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchSuggestions: string[];
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  onDateSearch: () => void;
  sortBy: 'date' | 'location' | 'name';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'date' | 'location' | 'name', order: 'asc' | 'desc') => void;
  onUpload: () => void;
  totalItems: number;
}

const GalleryHeader = ({
  searchTerm,
  onSearchChange,
  searchSuggestions,
  dateFilter,
  onDateFilterChange,
  onDateSearch,
  sortBy,
  sortOrder,
  onSortChange,
  onUpload,
  totalItems
}: GalleryHeaderProps) => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="bg-gradient-card border border-border rounded-xl p-6 shadow-card-gallery">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-md">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Media Gallery
          </h1>
          <p className="text-muted-foreground">
            {totalItems} items in your collection
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* Search with Autocomplete */}
          <div className="relative flex-1 lg:w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
              <Input
                placeholder="Search media, location, photographer..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  // Delay closing to allow clicking on suggestions
                  setTimeout(() => setSearchOpen(false), 150);
                }}
                className="pl-10 bg-background/50 border-border focus:border-gallery-accent transition-colors"
              />
            </div>
            
            {/* Autocomplete Dropdown */}
            {searchOpen && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-1">
                  {searchSuggestions
                    .filter(suggestion => 
                      suggestion.toLowerCase().includes(searchTerm.toLowerCase()) && 
                      suggestion.toLowerCase() !== searchTerm.toLowerCase()
                    )
                    .slice(0, 10)
                    .map((suggestion) => (
                      <button
                        key={suggestion}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                        onClick={() => {
                          onSearchChange(suggestion);
                          setSearchOpen(false);
                        }}
                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                      >
                        {suggestion}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="w-40 bg-background/50 border-border focus:border-gallery-accent transition-colors"
              placeholder="Filter by date"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onDateSearch}
              className="bg-background/50 hover:bg-gallery-hover"
              disabled={!dateFilter}
            >
              <Search className="h-3 w-3 mr-1" />
              Search
            </Button>
            {dateFilter && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDateFilterChange("")}
                className="h-8 w-8 hover:bg-gallery-hover"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value: 'date' | 'location' | 'name') => onSortChange(value, sortOrder)}>
              <SelectTrigger className="w-32 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              className="bg-background/50 hover:bg-gallery-hover"
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            <Button
              onClick={onUpload}
              className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-elegant"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryHeader;