import { memo } from 'react'
import { motion } from 'framer-motion'
import { Radio, Music } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import QuickPlayLibrary from '../QuickPlayLibrary'
import { SleepTimer } from './SleepTimer'
import { fadeInUp } from '../../lib/animations'
import { EQUALIZER_PRESETS } from '../../services/audioEnhancement'
import type { PlaybackMode, PlaybackState } from '../../types/app'
import type { Track } from '../../types/media'

interface PlayerControlsProps {
  playbackMode: PlaybackMode
  currentEQPreset: string
  needsUserInteraction: boolean
  isPlaying: boolean
  audioEnhancementService: any
  apiBase: string
  playbackState: PlaybackState
  onPlaybackModeChange: (mode: PlaybackMode) => Promise<void>
  onEQPresetChange: (preset: string) => void
  onQuickPlayTrack: (track: Track) => void
  onSwitchToLibrary: () => void
}

export const PlayerControls = memo(function PlayerControls({
  playbackMode,
  currentEQPreset,
  needsUserInteraction,
  isPlaying,
  audioEnhancementService,
  apiBase,
  playbackState,
  onPlaybackModeChange,
  onEQPresetChange,
  onQuickPlayTrack,
  onSwitchToLibrary
}: PlayerControlsProps) {
  return (
    <motion.div 
      className="space-y-6"
      variants={fadeInUp}
      transition={{ delay: 0.2 }}
    >
      {/* Playback Controls */}
      <GlassCard className="p-6">
        <h3 className="font-semibold mb-4 text-slate-100">Playback Control</h3>
        
        {/* Controls Row */}
        <div className="space-y-4">
          {/* Playback Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Mode:</span>
            <div className="flex bg-slate-800/50 rounded-lg p-1">
              <Button
                variant={playbackMode === 'browser' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPlaybackModeChange('browser')}
                className="h-8 px-3 text-xs"
              >
                Browser
              </Button>
              <Button
                variant={playbackMode === 'hardware' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPlaybackModeChange('hardware')}
                className="h-8 px-3 text-xs"
              >
                Hardware
              </Button>
            </div>
          </div>

          {/* Equalizer Preset */}
          {audioEnhancementService && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">EQ:</span>
              <Select
                value={currentEQPreset}
                onValueChange={onEQPresetChange}
              >
                <SelectTrigger className="w-28 h-8 text-xs bg-slate-800/50 border-slate-600/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUALIZER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Status:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                needsUserInteraction && playbackMode === 'browser'
                  ? 'bg-yellow-400 animate-pulse'
                  : isPlaying 
                    ? 'bg-green-400 animate-pulse' 
                    : 'bg-gray-400'
              }`} />
              <span className="text-sm text-slate-200">
                {needsUserInteraction && playbackMode === 'browser' 
                  ? 'Click Play' 
                  : isPlaying ? 'Playing' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <GlassCard className="p-6">
        <h3 className="font-semibold mb-4 text-slate-100">Quick Actions</h3>
        <div className="space-y-3">
          <Button variant="ghost" className="w-full justify-start glass-card">
            <Radio className="w-4 h-4 mr-2" />
            Scan RFID Card
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start glass-card"
            onClick={onSwitchToLibrary}
          >
            <Music className="w-4 h-4 mr-2" />
            Browse Library
          </Button>
        </div>
      </GlassCard>

      {/* Sleep Timer */}
      <SleepTimer apiBase={apiBase} />

      {/* Current Playlist */}
      <GlassCard className="p-6">
        <h3 className="font-semibold mb-4 text-slate-100">
          {playbackState.playlist ? 'Current Playlist' : 'No Playlist'}
        </h3>
        <QuickPlayLibrary
          apiBase={apiBase}
          playlist={playbackState.playlist}
          currentTrackIndex={playbackState.trackIndex}
          onPlayTrack={onQuickPlayTrack}
        />
      </GlassCard>
    </motion.div>
  )
})