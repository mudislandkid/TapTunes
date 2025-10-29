import { memo } from 'react'
import { motion } from 'framer-motion'
import { Music, Heart, Play, MoreHorizontal, Edit, FolderPlus, Trash2, Download, Sparkles, ListMusic } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Track } from '../../types/media'
import {
  staggerContainer,
  fadeInUp,
  buttonPulse
} from '../../lib/animations'

interface TrackListViewProps {
  tracks: Track[]
  apiBase: string
  onPlayTrack: (track: Track) => void
  formatDuration: (seconds: number) => string
  onEditTrack?: (track: Track) => void
  onAddToFolder?: (track: Track) => void
  onAddToPlaylist?: (track: Track) => void
  onDeleteTrack?: (track: Track) => void
  onDownloadTrack?: (track: Track) => void
  onEnhanceMetadata?: (track: Track) => void
}

export const TrackListView = memo(function TrackListView({
  tracks,
  apiBase,
  onPlayTrack,
  formatDuration,
  onEditTrack,
  onAddToFolder,
  onAddToPlaylist,
  onDeleteTrack,
  onDownloadTrack,
  onEnhanceMetadata
}: TrackListViewProps) {
  return (
    <motion.div 
      className="space-y-2"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {tracks.map((track, index) => (
        <motion.div
          key={track.id}
          variants={fadeInUp}
          transition={{ delay: index * 0.05 }}
        >
          <motion.div>
            <GlassCard className="p-4 hover:bg-slate-800/60 transition-all group cursor-pointer">
              <div className="flex items-center space-x-4">
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center overflow-hidden"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  {track.coverArt ? (
                    <img
                      src={`${apiBase}${track.coverArt}`}
                      alt={`${track.album} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-5 h-5 text-slate-300" />
                  )}
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-slate-100 truncate">{track.title}</h3>
                    {Boolean(track.isLiked) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Heart className="w-4 h-4 text-red-500 fill-current" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 truncate">{track.artist} • {track.album}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {track.genre && (
                      <Badge variant="outline" className="text-xs">
                        {track.genre}
                      </Badge>
                    )}
                    {track.year && (
                      <span className="text-xs text-slate-400">{track.year}</span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-slate-400">
                  {formatDuration(track.duration)}
                </div>

                <motion.div
                  className="opacity-70 group-hover:opacity-100 transition-opacity flex space-x-1"
                  initial={{ opacity: 0.7 }}
                  whileHover={{ opacity: 1 }}
                >
                  <motion.div
                    variants={buttonPulse}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className="h-8 w-8 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30"
                      title={`Play "${track.title}"`}
                    >
                      <Play className="w-4 h-4 text-blue-300" />
                    </Button>
                  </motion.div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-slate-600/40"
                        title="More options"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="glass-card border-slate-700/50 bg-slate-800/95 backdrop-blur-xl" 
                      align="end"
                    >
                      {onEnhanceMetadata && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onEnhanceMetadata(track);
                          }}
                          className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Enhance Metadata
                        </DropdownMenuItem>
                      )}
                      {onEditTrack && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onEditTrack(track);
                          }}
                          className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Track
                        </DropdownMenuItem>
                      )}
                      {onAddToFolder && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onAddToFolder(track);
                          }}
                          className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50"
                        >
                          <FolderPlus className="w-4 h-4 mr-2" />
                          Add to Folder
                        </DropdownMenuItem>
                      )}
                      {onAddToPlaylist && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onAddToPlaylist(track);
                          }}
                          className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50"
                        >
                          <ListMusic className="w-4 h-4 mr-2" />
                          Add to Playlist
                        </DropdownMenuItem>
                      )}
                      {onDownloadTrack && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onDownloadTrack(track);
                          }}
                          className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      )}
                      {(onEditTrack || onAddToFolder || onAddToPlaylist || onDownloadTrack) && onDeleteTrack && (
                        <DropdownMenuSeparator className="bg-slate-600/50" />
                      )}
                      {onDeleteTrack && (
                        <DropdownMenuItem 
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onDeleteTrack(track);
                          }}
                          className="text-red-400 hover:bg-red-900/20 focus:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Track
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  )
})