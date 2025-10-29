import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, Music, Clock, Radio } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { fadeInUp, buttonPulse } from '../lib/animations'

interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  trackType?: 'file' | 'stream'
  filePath: string
  sourceUrl?: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  folderId?: string
  isLiked?: boolean
  coverArt?: string
  createdAt: string
  updatedAt: string
}

interface QuickPlayLibraryProps {
  apiBase: string
  onPlayTrack: (track: Track) => void
  onSwitchToLibrary?: () => void
}

export default function QuickPlayLibrary({ apiBase, onPlayTrack, onSwitchToLibrary }: QuickPlayLibraryProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecentTracks = async () => {
    try {
      const response = await fetch(`${apiBase}/media/tracks?limit=5&sortBy=created`)
      const data = await response.json()
      setTracks(data.tracks || [])
    } catch (error) {
      console.error('Failed to fetch recent tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentTracks()
  }, [apiBase])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/30 animate-pulse">
            <div className="w-8 h-8 bg-slate-700 rounded"></div>
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-slate-700 rounded w-3/4"></div>
              <div className="h-2 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8">
        <Music className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No tracks uploaded yet</p>
        <p className="text-xs text-slate-500 mt-1">Upload some music in the Library tab</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tracks.map((track, index) => (
        <motion.div
          key={track.id}
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ delay: index * 0.1 }}
        >
          <motion.div
            variants={buttonPulse}
            whileHover="hover"
            whileTap="tap"
            className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all group cursor-pointer"
            onClick={() => onPlayTrack(track)}
          >
            <motion.div
              className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-600 rounded flex items-center justify-center overflow-hidden"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              {track.coverArt ? (
                <img
                  src={`${apiBase}${track.coverArt}`}
                  alt={`${track.album} cover`}
                  className="w-full h-full object-cover"
                />
              ) : track.trackType === 'stream' ? (
                <Radio className="w-3 h-3 text-purple-400" />
              ) : (
                <Play className="w-3 h-3 text-slate-300 ml-0.5" />
              )}
            </motion.div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-slate-100 truncate group-hover:text-white transition-colors">
                {track.title}
              </h4>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="truncate">{track.artist}</span>
                <span>•</span>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(track.duration)}</span>
                </div>
              </div>
            </div>

            <motion.div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.1 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayTrack(track)
                }}
              >
                <Play className="w-3 h-3" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      ))}
      
      {tracks.length >= 5 && (
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.6 }}
          className="pt-2"
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-slate-400 hover:text-slate-200"
            onClick={() => onSwitchToLibrary?.()}
          >
            View all tracks →
          </Button>
        </motion.div>
      )}
    </div>
  )
}