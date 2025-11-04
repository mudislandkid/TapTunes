import { motion } from 'framer-motion'
import { Play, Music, Clock, Radio } from 'lucide-react'
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
  fileName?: string
  originalName?: string
  fileSize?: number
  mimeType?: string
  folderId?: string
  isLiked?: boolean
  coverArt?: string
  createdAt?: string
  updatedAt?: string
}

interface QuickPlayLibraryProps {
  apiBase: string
  playlist: { tracks: Track[] } | null
  currentTrackIndex: number
  onPlayTrack: (track: Track) => void
}

export default function QuickPlayLibrary({ apiBase, playlist, currentTrackIndex, onPlayTrack }: QuickPlayLibraryProps) {
  const tracks = playlist?.tracks || []

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8">
        <Music className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No playlist playing</p>
        <p className="text-xs text-slate-500 mt-1">Play a playlist, folder, or album to see tracks here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {tracks.map((track, index) => {
        const isCurrentTrack = index === currentTrackIndex

        return (
          <motion.div
            key={track.id}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ delay: index * 0.05 }}
          >
            <motion.div
              variants={buttonPulse}
              whileHover="hover"
              whileTap="tap"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-all group cursor-pointer ${
                isCurrentTrack
                  ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/50'
                  : 'bg-slate-800/30 hover:bg-slate-800/50'
              }`}
              onClick={() => onPlayTrack(track)}
            >
              <motion.div
                className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-600 rounded flex items-center justify-center overflow-hidden flex-shrink-0"
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
                  <Play className={`w-3 h-3 ml-0.5 ${isCurrentTrack ? 'text-purple-300' : 'text-slate-300'}`} />
                )}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-mono">{index + 1}.</span>
                  <h4 className={`text-sm font-medium truncate transition-colors ${
                    isCurrentTrack ? 'text-purple-100' : 'text-slate-100 group-hover:text-white'
                  }`}>
                    {track.title}
                  </h4>
                </div>
                <div className={`flex items-center space-x-2 text-xs ${
                  isCurrentTrack ? 'text-purple-300' : 'text-slate-400'
                }`}>
                  <span className="truncate">{track.artist}</span>
                  {track.duration > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(track.duration)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isCurrentTrack && (
                <div className="flex-shrink-0">
                  <div className="flex space-x-0.5">
                    <motion.div
                      className="w-0.5 h-4 bg-purple-400 rounded"
                      animate={{ scaleY: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
                    />
                    <motion.div
                      className="w-0.5 h-4 bg-purple-400 rounded"
                      animate={{ scaleY: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-0.5 h-4 bg-purple-400 rounded"
                      animate={{ scaleY: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}