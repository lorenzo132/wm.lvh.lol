import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Plus, Search, X, Aperture, Moon, Sun } from "lucide-react";
import { SortBy, SortOrder } from "@/types/media";
import { useTheme } from "@/hooks/use-theme";

interface GalleryHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchSuggestions: string[];
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (sortBy: SortBy, order: SortOrder) => void;
  onUpload: () => void;
  totalItems: number;
}

const GalleryHeader = ({ searchTerm, onSearchChange, searchSuggestions, dateFilter, onDateFilterChange,
  sortBy, sortOrder, onSortChange, onUpload, totalItems }: GalleryHeaderProps) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header>
      <div className="gallery-masthead">
        <a href="/" className="gallery-brand" aria-label="WM Gallery home"><Aperture size={24} strokeWidth={1.6} /><span>wm<span className="brand-dot">.</span></span><span className="brand-divider" /><span className="brand-label">Gallery</span></a>
        <span className="masthead-note">A collection of moments</span>
        <div className="masthead-actions">
          <button
            type="button"
            className="icon-action"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Button onClick={onUpload} className="upload-button"><Plus className="h-4 w-4 mr-2" />Upload media</Button>
        </div>
      </div>
      <div className="gallery-heading"><div><p className="eyebrow">THE COLLECTION</p><h1>Media library<span className="brand-dot">.</span></h1></div>
        <p className="collection-count"><strong>{totalItems.toLocaleString()}</strong> {totalItems === 1 ? 'moment' : 'moments'} collected</p>
      </div>
      <div className="gallery-toolbar">
        <div className="gallery-search"><Search size={18} aria-hidden="true" /><Input aria-label="Search media" placeholder="Search names, places, people…" value={searchTerm} onChange={e => onSearchChange(e.target.value)} list="media-suggestions" />
          {searchTerm && <button className="icon-action" onClick={() => onSearchChange('')} aria-label="Clear search"><X size={16} /></button>}
          <datalist id="media-suggestions">{searchSuggestions.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 12).map(s => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="toolbar-filters">
          <Input type="date" aria-label="Filter by date" value={dateFilter} onChange={e => onDateFilterChange(e.target.value)} className="date-filter" />
          {dateFilter && <button className="icon-action" onClick={() => onDateFilterChange('')} aria-label="Clear date filter"><X size={16} /></button>}
          <span className="toolbar-divider" />
          <select aria-label="Sort media by" value={sortBy} onChange={e => onSortChange(e.target.value as SortBy, sortOrder)} className="sort-select">
            <option value="date">Date taken</option><option value="location">Location</option><option value="name">Name</option>
          </select>
          <button className="icon-action" onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')} aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'} title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>{sortOrder === 'asc' ? <ArrowUp size={17} /> : <ArrowDown size={17} />}</button>
        </div>
      </div>
    </header>
  );
};

export default GalleryHeader;
