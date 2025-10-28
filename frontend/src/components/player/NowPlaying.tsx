import { memo } from 'react'
import { motion } from 'framer-motion'
import { Music, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import AudioVisualizer from '../AudioVisualizer'
import ProgressBar from '../ProgressBar'
import VolumeControl from '../VolumeControl'
import { fadeInUp, buttonPulse } from '../../lib/animations'
import type { PlaybackState, PlaybackMode, RepeatMode } from '../../types/app'

interface NowPlayingProps {
  playbackState: PlaybackState
  playbackMode: PlaybackMode
  isShuffled: boolean
  repeatMode: RepeatMode
  volume: number
  needsUserInteraction: boolean
  audioElement: HTMLAudioElement | null
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onSeek: (time: number) => Promise<void>
  onShuffleToggle: () => void
  onRepeatModeChange: () => void
  onVolumeChange: (volume: number) => void
}

export const NowPlaying = memo(function NowPlaying({
  playbackState,
  playbackMode,
  isShuffled,
  repeatMode,
  volume,
  needsUserInteraction,
  audioElement,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeek,
  onShuffleToggle,
  onRepeatModeChange,
  onVolumeChange
}: NowPlayingProps) {
  return (
    <motion.div 
      className="lg:col-span-2"
      variants={fadeInUp}
    >
      <motion.div>
        <GlassCard className="p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Album Art */}
            <div className="relative">
              <div className="w-64 h-64 bg-gradient-to-br from-slate-800/40 to-slate-700/40 rounded-3xl flex items-center justify-center border border-slate-600/30">
                {playbackState.currentTrack ? (
                  <div className="text-center">
                    <Music className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-slate-100">
                        {playbackState.currentTrack.title}
                      </h2>
                      {playbackState.currentTrack.artist && (
                        <p className="text-slate-200">
                          {playbackState.currentTrack.artist}
                        </p>
                      )}
                      {playbackState.currentTrack.album && (
                        <p className="text-sm text-slate-300">
                          {playbackState.currentTrack.album}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Music className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-200">No track playing</p>
                    <p className="text-sm text-slate-300 mt-2">Scan an RFID card to begin</p>
                  </div>
                )}
              </div>
              
              {/* Animated ring for playing state */}
              {playbackState.isPlaying && (
                <motion.div
                  className="absolute inset-0 border-2 border-purple-400/50 rounded-3xl"
                  animate={{ 
                    scale: [1, 1.02, 1],
                    opacity: [0.5, 0.8, 0.5]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}
            </div>

            {/* Audio Visualizer */}
            <AudioVisualizer 
              isPlaying={playbackState.isPlaying} 
              size="md"
              audioElement={audioElement}
              style="bars"
            />

            {/* Progress Bar */}
            <div className="w-full max-w-md">
              <ProgressBar
                progress={playbackState.progress || 0}
                duration={playbackState.duration || 0}
                currentTime={playbackState.currentTime || 0}
                onSeek={onSeek}
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center space-y-4 w-full max-w-md">
              {/* Playback Controls Row */}
              <div className="flex items-center space-x-3">
                {/* Secondary Controls */}
                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onShuffleToggle}
                    className={`glass-card h-10 w-10 ${isShuffled ? 'bg-blue-500/20' : ''}`}
                  >
                    <motion.div
                      animate={isShuffled ? { rotate: [0, 10, -10, 0] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <Shuffle className="w-4 h-4" />
                    </motion.div>
                  </Button>
                </motion.div>

                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevious}
                    className="glass-card h-12 w-12"
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={playbackState.isPlaying ? {
                    boxShadow: [
                      "0 0 0 0 rgba(59, 130, 246, 0.4)",
                      "0 0 0 10px rgba(59, 130, 246, 0)",
                      "0 0 0 0 rgba(59, 130, 246, 0)"
                    ]
                  } : {}}
                  transition={{
                    repeat: playbackState.isPlaying ? Infinity : 0,
                    duration: 2
                  }}
                >
                  <Button
                    onClick={playbackState.isPlaying ? onPause : onPlay}
                    className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg"
                  >
                    <motion.div
                      key={playbackState.isPlaying ? 'pause' : 'play'}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {playbackState.isPlaying ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Play className="w-8 h-8 ml-1" />
                      )}
                    </motion.div>
                  </Button>
                </motion.div>

                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    className="glass-card h-12 w-12"
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                </motion.div>

                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRepeatModeChange}
                    className={`glass-card h-10 w-10 relative ${
                      repeatMode === 'off'
                        ? ''
                        : repeatMode === 'one'
                          ? 'bg-purple-500/30 border border-purple-400/50'
                          : 'bg-blue-500/30 border border-blue-400/50'
                    }`}
                  >
                    <motion.div
                      animate={repeatMode !== 'off' ? { rotate: 360 } : {}}
                      transition={{ duration: 0.6 }}
                      className="relative"
                    >
                      <Repeat className={`w-4 h-4 ${
                        repeatMode === 'off'
                          ? 'text-slate-400'
                          : repeatMode === 'one'
                            ? 'text-purple-300'
                            : 'text-blue-300'
                      }`} />

                      {/* Show "1" indicator for repeat one mode */}
                      {repeatMode === 'one' && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center"
                        >
                          <span className="text-[8px] font-bold text-white">1</span>
                        </motion.div>
                      )}
                    </motion.div>
                  </Button>
                </motion.div>
              </div>

              {/* Volume Controls Row */}
              <VolumeControl
                volume={volume}
                onVolumeChange={onVolumeChange}
                className="w-full"
              />
            </div>

            {/* User Interaction Notice */}
            {needsUserInteraction && playbackMode === 'browser' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4"
              >
                <div className="flex items-center space-x-2 text-yellow-200">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm">
                    Click the play button to resume audio (browser security requirement)
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
})