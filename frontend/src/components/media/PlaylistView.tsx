import { memo } from 'react'
import { motion } from 'framer-motion'
import { Music, Trash2, Play, Edit3 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import type { Playlist, Track } from '../../types/media'
import {
  staggerContainer,
  scaleIn,
  cardHover
} from '../../lib/animations'

interface PlaylistViewProps {
  playlists: Playlist[]
  apiBase: string
  onPlayPlaylist?: (playlist: Track[]) => void
  onEditPlaylist?: (playlist: Playlist) => void
  onDeletePlaylist: (playlistId: string) => void
  formatDuration: (seconds: number) => string
}

export const PlaylistView = memo(function PlaylistView({
  playlists,
  apiBase,
  onPlayPlaylist,
  onEditPlaylist,
  onDeletePlaylist,
  formatDuration
}: PlaylistViewProps) {
  const handlePlayPlaylist = async (playlistId: string) => {
    try {
      // Fetch playlist with tracks
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch playlist')
      }
      const data = await response.json()

      // Play the playlist with tracks
      if (data.tracks && data.tracks.length > 0) {
        onPlayPlaylist?.(data.tracks)
      } else {
        console.warn('Playlist has no tracks')
      }
    } catch (error) {
      console.error('Error playing playlist:', error)
    }
  }
  return (
    <motion.div 
      className="space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((playlist, index) => (
          <motion.div
            key={playlist.id}
            variants={scaleIn}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <motion.div
              variants={cardHover}
              whileHover="hover"
              whileTap="tap"
            >
              <GlassCard className="p-6 hover:bg-slate-800/60 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center">
                    <Music className="w-8 h-8 text-purple-400" />
                  </div>
                  
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card border-slate-700/50">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Delete Playlist</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete "{playlist.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeletePlaylist(playlist.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>
                </div>
                
                <h3 className="font-semibold text-slate-100 mb-2">{playlist.name}</h3>
                {playlist.description && (
                  <p className="text-sm text-slate-300 mb-3 line-clamp-2">{playlist.description}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{playlist.trackCount} tracks</span>
                  <span>{formatDuration(playlist.duration)}</span>
                </div>
                
                {playlist.tags && playlist.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {playlist.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => handlePlayPlaylist(playlist.id)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditPlaylist?.(playlist)}
                    className="glass-card border-slate-600/50"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
})