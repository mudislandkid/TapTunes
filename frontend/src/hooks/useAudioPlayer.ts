import { useState, useEffect, useRef, useCallback } from 'react'
import { AudioEnhancementService } from '../services/audioEnhancement'
import type { PlaybackState, PlaybackMode, RepeatMode } from '../types/app'
import type { Track } from '../types/media'

interface UseAudioPlayerProps {
  apiBase: string
}

export function useAudioPlayer({ apiBase }: UseAudioPlayerProps) {
  const [volume, setVolume] = useState(75)
  const [isShuffled, setIsShuffled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('browser')
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playlist: null,
    trackIndex: 0,
    isPlaying: false,
    currentTrack: null,
    progress: 0,
    currentTime: 0,
    duration: 0
  })

  // Audio enhancement service
  const [audioEnhancementService, setAudioEnhancementService] = useState<AudioEnhancementService | null>(null)
  const [currentEQPreset, setCurrentEQPreset] = useState('flat')
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false)
  const [browserControlledState, setBrowserControlledState] = useState<boolean | null>(null)
  const [lastSeekTime, setLastSeekTime] = useState(0)

  // Audio element for browser playback
  const audioRef = useRef<HTMLAudioElement>(null)
  const isManuallyUpdatingSource = useRef(false)

  const fetchPlaybackState = async () => {
    try {
      const response = await fetch(`${apiBase}/audio/current`)
      const data = await response.json()
      setPlaybackState(data)
    } catch (error) {
      console.error('Failed to fetch playback state:', error)
    }
  }

  const initializeAudioEnhancement = useCallback(async () => {
    if (audioEnhancementService) {
      console.log('🎵 [PLAYER] Audio enhancement already initialized')
      return true
    }

    try {
      const service = new AudioEnhancementService()
      if (audioRef.current) {
        await service.initialize(audioRef.current)
      }
      setAudioEnhancementService(service)
      console.log('🎵 [PLAYER] Audio enhancement initialized successfully')
      return true
    } catch (error) {
      console.warn('🎵 [PLAYER] Failed to initialize audio enhancement:', error)
      return false
    }
  }, [audioEnhancementService])

  const handleEQPresetChange = useCallback((presetName: string) => {
    if (audioEnhancementService) {
      audioEnhancementService.setEqualizerPreset(presetName)
      setCurrentEQPreset(presetName)
      console.log(`🎵 [PLAYER] EQ preset changed to: ${presetName}`)
    }
  }, [audioEnhancementService])

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume)
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
    
    console.log(`🔊 [PLAYER] Volume changed to: ${newVolume}%`)
  }, [])

  const handlePlaybackModeChange = async (mode: PlaybackMode) => {
    try {
      console.log(`🎵 [FRONTEND] Switching to ${mode} mode`)
      await fetch(`${apiBase}/audio/playback-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      
      setPlaybackMode(mode)
      
      if (mode === 'browser' && audioRef.current && playbackState.currentTrack) {
        const streamUrl = `${apiBase}/media/stream/${playbackState.currentTrack.id}`
        console.log(`🌐 [FRONTEND] Loading audio source: ${streamUrl}`)
        isManuallyUpdatingSource.current = true
        audioRef.current.src = streamUrl
        audioRef.current.load()
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isManuallyUpdatingSource.current = false
        }, 500)
      }
      
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to change playback mode:', error)
    }
  }

  const handlePlay = async () => {
    try {
      if (!audioEnhancementService) {
        await initializeAudioEnhancement()
      }

      if (playbackMode === 'browser' && audioRef.current && playbackState.currentTrack) {
        console.log(`🌐 [FRONTEND] Starting browser playback`)
        setBrowserControlledState(true)
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.then(async () => {
            console.log(`✅ [FRONTEND] Browser playback started successfully`)
            setPlaybackState(prev => ({ ...prev, isPlaying: true }))
            setNeedsUserInteraction(false)
            
            if (audioEnhancementService) {
              try {
                await audioEnhancementService.fadeIn()
              } catch (error) {
                console.warn('Fade-in failed:', error)
              }
            }
          }).catch(async (error) => {
            console.warn('🎵 [FRONTEND] Autoplay prevented, user interaction required:', error)
            setNeedsUserInteraction(true)
            setBrowserControlledState(null)
          })
        }
      } else {
        await fetch(`${apiBase}/audio/play`, { method: 'POST' })
        fetchPlaybackState()
      }
    } catch (error) {
      console.error('Failed to play:', error)
    }
  }

  const handlePause = async () => {
    try {
      if (playbackMode === 'browser' && audioRef.current) {
        console.log(`🌐 [FRONTEND] Pausing browser playback`)
        setBrowserControlledState(true)
        
        if (audioEnhancementService) {
          try {
            await audioEnhancementService.fadeOut()
          } catch (error) {
            console.warn('Fade-out failed:', error)
          }
        }
        
        audioRef.current.pause()
        setPlaybackState(prev => ({ ...prev, isPlaying: false }))
        console.log(`✅ [FRONTEND] Browser playback paused successfully`)
      } else {
        await fetch(`${apiBase}/audio/pause`, { method: 'POST' })
        fetchPlaybackState()
      }
    } catch (error) {
      console.error('Failed to pause:', error)
    }
  }

  const handleNext = async () => {
    try {
      await fetch(`${apiBase}/audio/next`, { method: 'POST' })
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to skip to next track:', error)
    }
  }

  const handlePrevious = async () => {
    try {
      await fetch(`${apiBase}/audio/previous`, { method: 'POST' })
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to skip to previous track:', error)
    }
  }

  const handleSeek = async (time: number) => {
    try {
      console.log(`🕐 [FRONTEND] Seeking to ${time}s in ${playbackMode} mode`)
      
      if (playbackMode === 'browser' && audioRef.current) {
        setLastSeekTime(Date.now())
        audioRef.current.currentTime = time
        setPlaybackState(prev => ({
          ...prev,
          currentTime: Math.floor(time),
          progress: playbackState.duration ? (time / playbackState.duration) * 100 : 0
        }))
        console.log(`✅ [FRONTEND] Browser seek to ${time}s successful`)
      } else {
        await fetch(`${apiBase}/audio/seek`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ time })
        })
        fetchPlaybackState()
        console.log(`✅ [FRONTEND] Hardware seek to ${time}s successful`)
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Failed to seek:', error)
    }
  }

  const handleBrowserAudioTimeUpdate = () => {
    if (audioRef.current && playbackMode === 'browser') {
      const currentTime = audioRef.current.currentTime
      const duration = audioRef.current.duration || 0
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0
      
      const timeSinceSeek = Date.now() - lastSeekTime
      if (timeSinceSeek < 200) {
        return
      }
      
      setPlaybackState(prev => ({
        ...prev,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        progress: Math.min(100, Math.max(0, progress))
      }))
    }
  }

  const handleBrowserAudioEnded = () => {
    if (playbackMode === 'browser') {
      console.log(`🌐 [FRONTEND] Track ended - repeat mode: ${repeatMode}`)
      
      if (repeatMode === 'one') {
        console.log(`🔁 [FRONTEND] Repeating current track`)
        if (audioRef.current) {
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(error => {
            console.error('❌ [FRONTEND] Failed to repeat track:', error)
          })
        }
      } else if (repeatMode === 'all' || (playbackState.playlist?.tracks && playbackState.trackIndex < playbackState.playlist.tracks.length - 1)) {
        console.log(`⏭️ [FRONTEND] Auto-advancing to next track`)
        handleNext()
      } else {
        console.log(`⏹️ [FRONTEND] End of playlist - stopping playback`)
        setPlaybackState(prev => ({ ...prev, isPlaying: false }))
      }
    }
  }

  const handlePlayTrack = useCallback(async (track: Track) => {
    try {
      await fetch(`${apiBase}/audio/play-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      })
      
      // If in browser mode, update the audio element source and start playing
      if (playbackMode === 'browser' && audioRef.current) {
        const streamUrl = `${apiBase}/media/stream/${track.id}`
        console.log(`🌐 [FRONTEND] Loading new track for playback: ${streamUrl}`)
        isManuallyUpdatingSource.current = true
        audioRef.current.src = streamUrl
        audioRef.current.load()
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isManuallyUpdatingSource.current = false
        }, 500)
        
        // Initialize audio enhancement if needed
        if (!audioEnhancementService) {
          await initializeAudioEnhancement()
        }
        
        // Wait for the audio to be ready before trying to play
        const attemptPlay = async () => {
          setBrowserControlledState(true)
          const playPromise = audioRef.current?.play()
          if (playPromise !== undefined) {
            playPromise.then(async () => {
              console.log(`✅ [FRONTEND] New track started playing successfully`)
              setNeedsUserInteraction(false)
              
              if (audioEnhancementService) {
                try {
                  await audioEnhancementService.fadeIn()
                } catch (error) {
                  console.warn('Fade-in failed:', error)
                }
              }
            }).catch(async (error) => {
              console.warn('🎵 [FRONTEND] Autoplay prevented for new track, user interaction required:', error)
              setNeedsUserInteraction(true)
              setBrowserControlledState(null)
            })
          }
        }
        
        // Try to play immediately, or wait for canplay event
        if (audioRef.current.readyState >= 3) { // HAVE_FUTURE_DATA
          attemptPlay()
        } else {
          const onCanPlay = () => {
            audioRef.current?.removeEventListener('canplay', onCanPlay)
            attemptPlay()
          }
          audioRef.current.addEventListener('canplay', onCanPlay)
          
          // Fallback timeout in case canplay never fires
          setTimeout(() => {
            audioRef.current?.removeEventListener('canplay', onCanPlay)
            attemptPlay()
          }, 2000)
        }
      }
      
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to play track:', error)
    }
  }, [apiBase, playbackMode, audioEnhancementService, initializeAudioEnhancement])

  const handlePlayPlaylist = useCallback(async (tracks: Track[]) => {
    try {
      await fetch(`${apiBase}/audio/play-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks })
      })
      
      // If in browser mode and we have tracks, load the first track
      if (playbackMode === 'browser' && audioRef.current && tracks.length > 0) {
        const firstTrack = tracks[0]
        const streamUrl = `${apiBase}/media/stream/${firstTrack.id}`
        console.log(`🌐 [FRONTEND] Loading first track of playlist: ${streamUrl}`)
        isManuallyUpdatingSource.current = true
        audioRef.current.src = streamUrl
        audioRef.current.load()
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isManuallyUpdatingSource.current = false
        }, 500)
        
        // Initialize audio enhancement if needed
        if (!audioEnhancementService) {
          await initializeAudioEnhancement()
        }
        
        // Wait for the audio to be ready before trying to play
        const attemptPlay = async () => {
          setBrowserControlledState(true)
          const playPromise = audioRef.current?.play()
          if (playPromise !== undefined) {
            playPromise.then(async () => {
              console.log(`✅ [FRONTEND] Playlist started playing successfully`)
              setNeedsUserInteraction(false)
              
              if (audioEnhancementService) {
                try {
                  await audioEnhancementService.fadeIn()
                } catch (error) {
                  console.warn('Fade-in failed:', error)
                }
              }
            }).catch(async (error) => {
              console.warn('🎵 [FRONTEND] Autoplay prevented for playlist, user interaction required:', error)
              setNeedsUserInteraction(true)
              setBrowserControlledState(null)
            })
          }
        }
        
        // Try to play immediately, or wait for canplay event
        if (audioRef.current.readyState >= 3) { // HAVE_FUTURE_DATA
          attemptPlay()
        } else {
          const onCanPlay = () => {
            audioRef.current?.removeEventListener('canplay', onCanPlay)
            attemptPlay()
          }
          audioRef.current.addEventListener('canplay', onCanPlay)
          
          // Fallback timeout in case canplay never fires
          setTimeout(() => {
            audioRef.current?.removeEventListener('canplay', onCanPlay)
            attemptPlay()
          }, 2000)
        }
      }
      
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to play playlist:', error)
    }
  }, [apiBase, playbackMode, audioEnhancementService, initializeAudioEnhancement])

  const handleQuickPlayTrack = useCallback(async (track: Track) => {
    try {
      await fetch(`${apiBase}/audio/play-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      })
      fetchPlaybackState()
    } catch (error) {
      console.error('Failed to play quick track:', error)
    }
  }, [apiBase])

  // Apply volume when audio element changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Update audio source when current track changes in browser mode
  useEffect(() => {
    // Skip if we're already manually updating the source
    if (isManuallyUpdatingSource.current) {
      console.log('🌐 [FRONTEND] Skipping auto-update - manual update in progress')
      return
    }
    
    // Skip if browser is controlling the state (to prevent conflicts during user actions)
    if (browserControlledState === true) {
      console.log('🌐 [FRONTEND] Skipping auto-update - browser controlled state')
      return
    }
    
    if (playbackMode === 'browser' && audioRef.current && playbackState.currentTrack) {
      const currentSrc = audioRef.current.src
      const expectedSrc = `${apiBase}/media/stream/${playbackState.currentTrack.id}`
      
      // Only update if the source has actually changed and we have a valid track ID
      if (currentSrc !== expectedSrc && playbackState.currentTrack.id) {
        console.log(`🌐 [FRONTEND] Auto-updating audio source for track change: ${expectedSrc}`)
        
        // Set the flag to prevent re-entrance
        isManuallyUpdatingSource.current = true
        audioRef.current.src = expectedSrc
        audioRef.current.load()
        
        // Reset the flag after a longer delay
        setTimeout(() => {
          isManuallyUpdatingSource.current = false
        }, 1000)
        
        // If the track is supposed to be playing, start playback
        if (playbackState.isPlaying) {
          setBrowserControlledState(true)
          const playPromise = audioRef.current.play()
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log(`✅ [FRONTEND] Auto-resumed playback after track change`)
              setNeedsUserInteraction(false)
            }).catch((error) => {
              console.warn('🎵 [FRONTEND] Auto-resume failed after track change:', error)
              setNeedsUserInteraction(true)
              setBrowserControlledState(null)
            })
          }
        }
      }
    }
  }, [playbackState.currentTrack?.id, playbackMode, apiBase])

  // Periodic state sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (playbackMode === 'hardware' || browserControlledState === null) {
        fetchPlaybackState()
      }
    }, 1000)

    fetchPlaybackState()

    return () => clearInterval(interval)
  }, [playbackMode, browserControlledState])

  // Audio element event handlers
  const audioElementProps = {
    ref: audioRef,
    onTimeUpdate: handleBrowserAudioTimeUpdate,
    onEnded: handleBrowserAudioEnded,
    onPlay: () => {
      console.log(`🌐 [FRONTEND] Audio element started playing`)
      if (playbackMode === 'browser') {
        setPlaybackState(prev => ({ ...prev, isPlaying: true }))
        setTimeout(() => setBrowserControlledState(null), 500)
      }
    },
    onPause: () => {
      console.log(`🌐 [FRONTEND] Audio element paused`)
      if (playbackMode === 'browser') {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }))
        setTimeout(() => setBrowserControlledState(null), 500)
      }
    },
    onLoadStart: () => console.log(`🌐 [FRONTEND] Audio loading started`),
    onCanPlay: () => console.log(`🌐 [FRONTEND] Audio can play`),
    onCanPlayThrough: () => console.log(`🌐 [FRONTEND] Audio can play through`),
    onError: (e: any) => console.error(`❌ [FRONTEND] Audio error:`, e),
    onLoadedMetadata: () => console.log(`🌐 [FRONTEND] Audio metadata loaded`),
    crossOrigin: "anonymous" as const,
    preload: "auto" as const,
    loop: false,
    style: { display: 'none' }
  }

  return {
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
    onShuffleToggle: () => setIsShuffled(!isShuffled),
    onRepeatModeChange: () => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'),
    
    // Audio element props
    audioElementProps
  }
}