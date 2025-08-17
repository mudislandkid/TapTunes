import { memo } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Grid, List } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { GlassCard } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { fadeInUp, springConfig } from '../../lib/animations'

interface MediaSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (sort: string) => void
  filterGenre: string
  onGenreFilterChange: (genre: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  genres: string[]
  activeTab: string
}

export const MediaSearch = memo(function MediaSearch({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterGenre,
  onGenreFilterChange,
  viewMode,
  onViewModeChange,
  genres,
  activeTab
}: MediaSearchProps) {
  return (
    <motion.div variants={fadeInUp} transition={{ delay: 0.2 }}>
      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, ...springConfig }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search tracks, artists, albums..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 glass-card border-slate-600/50"
              />
            </div>
          </motion.div>

          {/* Filters and Controls */}
          <motion.div 
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, ...springConfig }}
          >
            {/* Sort */}
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="w-32 glass-card border-slate-600/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-card border-slate-700/50">
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="album">Album</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Genre Filter */}
            {activeTab === 'tracks' && (
              <Select value={filterGenre} onValueChange={onGenreFilterChange}>
                <SelectTrigger className="w-32 glass-card border-slate-600/50">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-700/50">
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres.map(genre => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* View Mode Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-600/50">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('list')}
                className={`rounded-none ${viewMode === 'list' ? 'bg-slate-700' : 'bg-transparent'}`}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('grid')}
                className={`rounded-none ${viewMode === 'grid' ? 'bg-slate-700' : 'bg-transparent'}`}
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </GlassCard>
    </motion.div>
  )
})