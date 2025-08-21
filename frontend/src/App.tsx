import { useState } from 'react'
import { motion } from 'framer-motion'
import { pageVariants, staggerContainer } from './lib/animations'

// Components
import { AppLayout } from './components/layout/AppLayout'
import { NowPlaying } from './components/player/NowPlaying'
import { PlayerControls } from './components/player/PlayerControls'
import RFIDCardManager from './components/RFIDCardManager'
import MediaLibrary from './components/MediaLibrary'
import Settings from './components/Settings'

// Hooks
import { useAudioPlayer } from './hooks/useAudioPlayer'

// Types
import type { ActiveTab } from './types/app'

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('player')
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Use relative URL to work through nginx proxy
  const API_BASE = '/api'

  // Audio player hook
  const {
    // State
    volume,
    isShuffled,
    repeatMode,
    playbackMode,
    playbackState,
    audioEnhancementService,
    currentEQPreset,
    needsUserInteraction,
    audioRef,
    
    // Handlers
    handlePlay,
    handlePause,
    handleNext,
    handlePrevious,
    handleSeek,
    handlePlayTrack,
    handlePlayPlaylist,
    handleQuickPlayTrack,
    handleVolumeChange,
    handlePlaybackModeChange,
    handleEQPresetChange,
    initializeAudioEnhancement,
    
    // Toggles
    onShuffleToggle,
    onRepeatModeChange,
    
    // Audio element props
    audioElementProps
  } = useAudioPlayer({ apiBase: API_BASE })

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleSwitchToLibrary = () => {
    setActiveTab('library')
  }

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isDarkMode={isDarkMode}
      onToggleDarkMode={toggleDarkMode}
    >
      <motion.main
        key={activeTab}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {activeTab === 'player' && (
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Now Playing */}
            <NowPlaying
              playbackState={playbackState}
              playbackMode={playbackMode}
              isShuffled={isShuffled}
              repeatMode={repeatMode}
              volume={volume}
              needsUserInteraction={needsUserInteraction}
              audioElement={audioRef.current}
              onPlay={handlePlay}
              onPause={handlePause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSeek={handleSeek}
              onShuffleToggle={onShuffleToggle}
              onRepeatModeChange={onRepeatModeChange}
              onVolumeChange={handleVolumeChange}
            />

            {/* Sidebar */}
            <PlayerControls
              playbackMode={playbackMode}
              currentEQPreset={currentEQPreset}
              needsUserInteraction={needsUserInteraction}
              isPlaying={playbackState.isPlaying}
              audioEnhancementService={audioEnhancementService}
              apiBase={API_BASE}
              onPlaybackModeChange={handlePlaybackModeChange}
              onEQPresetChange={handleEQPresetChange}
              onQuickPlayTrack={handleQuickPlayTrack}
              onSwitchToLibrary={handleSwitchToLibrary}
            />
          </motion.div>
        )}

        {activeTab === 'library' && (
          <MediaLibrary 
            apiBase={API_BASE}
            onPlayTrack={handlePlayTrack}
            onPlayPlaylist={handlePlayPlaylist}
          />
        )}

        {activeTab === 'rfid' && (
          <RFIDCardManager apiBase={API_BASE} />
        )}

        {activeTab === 'settings' && (
          <Settings 
            isVisible={activeTab === 'settings'} 
            audioEnhancementService={audioEnhancementService}
            onInitializeAudio={() => initializeAudioEnhancement().then(() => {})}
          />
        )}
      </motion.main>
      
      {/* Hidden audio element for browser playback */}
      <audio {...audioElementProps} />
    </AppLayout>
  )
}

export default App