import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipBack, SkipForward, Music, Radio, Settings, Moon, Sun, Shuffle, Repeat } from 'lucide-react'
import { pageVariants, staggerContainer, cardHover, buttonPulse, fadeInUp, slideInLeft, springConfig } from './lib/animations'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import AudioVisualizer from './components/AudioVisualizer'
import ProgressBar from './components/ProgressBar'
import VolumeControl from './components/VolumeControl'
import RFIDCardManager from './components/RFIDCardManager'
import MediaLibrary from './components/MediaLibrary'
import QuickPlayLibrary from './components/QuickPlayLibrary'

interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  file_path: string;
}

interface PlaybackState {
  playlist: any;
  trackIndex: number;
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  progress?: number; // 0-100
  currentTime?: number; // in seconds
  duration?: number; // in seconds
}

function App() {
  const [activeTab, setActiveTab] = useState<'player' | 'library' | 'rfid' | 'settings'>('player');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [volume, setVolume] = useState(75);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const [playbackMode, setPlaybackMode] = useState<'browser' | 'hardware'>('browser');
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playlist: null,
    trackIndex: 0,
    isPlaying: false,
    currentTrack: null,
    progress: 0,
    currentTime: 0,
    duration: 0
  });

  // Audio element for browser playback
  const audioRef = useRef<HTMLAudioElement>(null);

  const API_BASE = 'http://localhost:3001/api';

  const fetchPlaybackState = async () => {
    try {
      const response = await fetch(`${API_BASE}/audio/current`);
      const data = await response.json();
      setPlaybackState(data);
    } catch (error) {
      console.error('Failed to fetch playback state:', error);
    }
  };

  const handlePlay = async () => {
    try {
      if (playbackMode === 'browser' && audioRef.current && playbackState.currentTrack) {
        // Browser playback
        console.log(`🌐 [FRONTEND] Starting browser playback`);
        console.log(`🌐 [FRONTEND] Audio src: ${audioRef.current.src}`);
        console.log(`🌐 [FRONTEND] Audio ready state: ${audioRef.current.readyState}`);
        setBrowserControlledState(true);
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log(`✅ [FRONTEND] Browser playback started successfully`);
            setPlaybackState(prev => ({ ...prev, isPlaying: true }));
            setNeedsUserInteraction(false);
            // Update backend state to keep in sync
            fetch(`${API_BASE}/audio/play`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            }).catch(error => console.error('Failed to sync backend state:', error));
          }).catch(error => {
            console.error('❌ [FRONTEND] Browser playback failed:', error);
            setBrowserControlledState(null);
          });
        }
      } else {
        // Hardware playback
        console.log(`🔊 [FRONTEND] Starting hardware playback`);
        setBrowserControlledState(null);
        await fetch(`${API_BASE}/audio/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        fetchPlaybackState();
      }
    } catch (error) {
      console.error('Failed to play:', error);
    }
  };

  const handlePause = async () => {
    try {
      if (playbackMode === 'browser' && audioRef.current) {
        // Browser playback
        console.log(`🌐 [FRONTEND] Pausing browser playback`);
        setBrowserControlledState(false);
        audioRef.current.pause();
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        
        // Also update backend state to keep them in sync
        fetch(`${API_BASE}/audio/pause`, { method: 'POST' })
          .catch(error => console.error('Failed to sync backend state:', error));
      } else {
        // Hardware playback
        console.log(`🔊 [FRONTEND] Pausing hardware playback`);
        setBrowserControlledState(null);
        await fetch(`${API_BASE}/audio/pause`, { method: 'POST' });
        fetchPlaybackState();
      }
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  };

  const handleNext = async () => {
    try {
      if (playbackMode === 'browser') {
        // Handle browser next track logic
        // This would need playlist management in browser mode
        await fetch(`${API_BASE}/audio/next`, { method: 'POST' });
        fetchPlaybackState();
        // Update browser audio source if needed
        if (audioRef.current && playbackState.currentTrack) {
          audioRef.current.src = `${API_BASE}/media/stream/${playbackState.currentTrack.id}`;
        }
      } else {
        await fetch(`${API_BASE}/audio/next`, { method: 'POST' });
        fetchPlaybackState();
      }
    } catch (error) {
      console.error('Failed to skip next:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      if (playbackMode === 'browser') {
        // Handle browser previous track logic
        await fetch(`${API_BASE}/audio/previous`, { method: 'POST' });
        fetchPlaybackState();
        // Update browser audio source if needed
        if (audioRef.current && playbackState.currentTrack) {
          audioRef.current.src = `${API_BASE}/media/stream/${playbackState.currentTrack.id}`;
        }
      } else {
        await fetch(`${API_BASE}/audio/previous`, { method: 'POST' });
        fetchPlaybackState();
      }
    } catch (error) {
      console.error('Failed to skip previous:', error);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  useEffect(() => {
    // Ensure dark mode is applied on initial load
    document.documentElement.classList.add('dark');
  }, []);

  // Handle playback mode changes
  const handlePlaybackModeChange = async (mode: 'browser' | 'hardware') => {
    try {
      console.log(`🎵 [FRONTEND] Switching to ${mode} mode`);
      // Set playback mode on backend
      await fetch(`${API_BASE}/audio/playback-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      
      setPlaybackMode(mode);
      
      // If switching to browser mode and there's a current track, load it
      if (mode === 'browser' && audioRef.current && playbackState.currentTrack) {
        const streamUrl = `${API_BASE}/media/stream/${playbackState.currentTrack.id}`;
        console.log(`🌐 [FRONTEND] Loading audio source: ${streamUrl}`);
        audioRef.current.src = streamUrl;
        audioRef.current.load();
      }
      
      fetchPlaybackState();
    } catch (error) {
      console.error('Failed to change playback mode:', error);
    }
  };

  // Browser audio event handlers
  const handleBrowserAudioTimeUpdate = () => {
    if (audioRef.current && playbackMode === 'browser') {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration || 0;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      
      // Skip time updates immediately after seeking to prevent jittery UI
      const timeSinceSeek = Date.now() - lastSeekTime;
      if (timeSinceSeek < 200) {
        return;
      }
      
      setPlaybackState(prev => ({
        ...prev,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        progress: Math.min(100, Math.max(0, progress))
      }));
    }
  };

  const handleBrowserAudioEnded = () => {
    if (playbackMode === 'browser') {
      console.log(`🌐 [FRONTEND] Track ended - repeat mode: ${repeatMode}`);
      
      if (repeatMode === 'one') {
        // Repeat current track
        console.log(`🔁 [FRONTEND] Repeating current track`);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(error => {
            console.error('❌ [FRONTEND] Failed to repeat track:', error);
          });
        }
      } else if (repeatMode === 'all' || (playbackState.playlist?.tracks && playbackState.trackIndex < playbackState.playlist.tracks.length - 1)) {
        // Auto-advance to next track (if repeat all is on, or if there are more tracks)
        console.log(`⏭️ [FRONTEND] Auto-advancing to next track`);
        handleNext();
      } else {
        // Stop playback (no repeat, end of playlist)
        console.log(`⏹️ [FRONTEND] End of playlist - stopping playback`);
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        // Sync stop with backend
        fetch(`${API_BASE}/audio/stop`, { method: 'POST' })
          .catch(error => console.error('Failed to sync stop with backend:', error));
      }
    }
  };

  useEffect(() => {
    fetchPlaybackState();
    
    // Poll for playback state updates every second when playing (hardware mode only)
    // In browser mode, we rely on audio element events instead of polling
    let interval: NodeJS.Timeout;
    if (playbackState.isPlaying && playbackMode === 'hardware') {
      console.log(`🔊 [FRONTEND] Starting hardware mode polling`);
      interval = setInterval(() => {
        fetchPlaybackState();
      }, 1000);
    }
    
    return () => {
      if (interval) {
        console.log(`🔊 [FRONTEND] Stopping hardware mode polling`);
        clearInterval(interval);
      }
    };
  }, [playbackState.isPlaying, playbackMode]);

  // Track the current track ID to prevent unnecessary reloads
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [browserControlledState, setBrowserControlledState] = useState<boolean | null>(null);
  const [lastSeekTime, setLastSeekTime] = useState<number>(0);

  // Update browser audio source when current track changes
  useEffect(() => {
    if (playbackMode === 'browser' && audioRef.current && playbackState.currentTrack) {
      const currentTrackId = playbackState.currentTrack.id;
      
      // Reload if track changed OR if audio source is empty (initial load)
      if (currentTrackId !== lastTrackId || !audioRef.current.src) {
        const streamUrl = `${API_BASE}/media/stream/${currentTrackId}`;
        console.log(`🌐 [FRONTEND] Track changed, updating audio source: ${streamUrl}`);
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        setLastTrackId(currentTrackId);
        
        // When audio can play, seek to current position and play if needed
        const handleCanPlay = () => {
          if (audioRef.current) {
            const currentTime = playbackState.currentTime || 0;
            
            // Only seek if this is an initial load (page refresh) and there's a meaningful position
            if (!hasInitiallyLoaded && currentTime > 5) {
              console.log(`🌐 [FRONTEND] Initial load - seeking to position: ${currentTime}s`);
              audioRef.current.currentTime = currentTime;
            }
            
            if (playbackState.isPlaying) {
              console.log(`🌐 [FRONTEND] Auto-starting playback for track`);
              audioRef.current.play().then(() => {
                console.log(`✅ [FRONTEND] Auto-play successful`);
                setHasInitiallyLoaded(true);
                setNeedsUserInteraction(false);
              }).catch(error => {
                if (error.name === 'NotAllowedError') {
                  console.log(`🔇 [FRONTEND] Auto-play blocked - user interaction required`);
                  setNeedsUserInteraction(true);
                } else {
                  console.error(`❌ [FRONTEND] Auto-play failed:`, error);
                }
                setHasInitiallyLoaded(true);
              });
            } else {
              setHasInitiallyLoaded(true);
            }
          }
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
        };
        
        audioRef.current.addEventListener('canplay', handleCanPlay);
      }
    }
  }, [playbackState.currentTrack, playbackMode, lastTrackId]);

  // Handle initial resume after page refresh
  useEffect(() => {
    if (!hasInitiallyLoaded && playbackMode === 'browser' && audioRef.current && playbackState.currentTrack && playbackState.isPlaying) {
      // This handles the case where we refresh the page and the same track is already loaded
      const currentTime = playbackState.currentTime || 0;
      
      if (audioRef.current.src && audioRef.current.src.includes(playbackState.currentTrack.id)) {
        console.log(`🌐 [FRONTEND] Page refresh - resuming existing track at ${currentTime}s`);
        
        const resumePlayback = () => {
          if (audioRef.current) {
            if (currentTime > 5) {
              audioRef.current.currentTime = currentTime;
            }
            audioRef.current.play().then(() => {
              console.log(`✅ [FRONTEND] Resume after refresh successful`);
              setHasInitiallyLoaded(true);
              setNeedsUserInteraction(false);
            }).catch(error => {
              if (error.name === 'NotAllowedError') {
                console.log(`🔇 [FRONTEND] Resume blocked - user interaction required`);
                setNeedsUserInteraction(true);
              } else {
                console.error(`❌ [FRONTEND] Resume after refresh failed:`, error);
              }
              setHasInitiallyLoaded(true);
            });
          }
        };

        if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
          resumePlayback();
        } else {
          audioRef.current.addEventListener('canplay', resumePlayback, { once: true });
        }
      }
    }
  }, [playbackState.currentTrack, playbackState.isPlaying, playbackState.currentTime, playbackMode, hasInitiallyLoaded]);

  // Handle play/pause state changes for browser mode (without reloading track)
  // Only sync when the state wasn't changed by browser controls
  useEffect(() => {
    if (playbackMode === 'browser' && audioRef.current && playbackState.currentTrack && lastTrackId === playbackState.currentTrack.id) {
      // Skip state sync if we're controlling the browser directly
      if (browserControlledState !== null) {
        console.log(`🌐 [FRONTEND] Skipping state sync - browser controlled`);
        return;
      }
      
      if (playbackState.isPlaying && audioRef.current.paused) {
        console.log(`🌐 [FRONTEND] State sync - resuming playback`);
        audioRef.current.play().then(() => {
          setNeedsUserInteraction(false);
        }).catch(error => {
          if (error.name === 'NotAllowedError') {
            console.log(`🔇 [FRONTEND] Resume blocked - user interaction required`);
            setNeedsUserInteraction(true);
          } else {
            console.error(`❌ [FRONTEND] Resume playback failed:`, error);
          }
        });
      } else if (!playbackState.isPlaying && !audioRef.current.paused) {
        console.log(`🌐 [FRONTEND] State sync - pausing playback`);
        audioRef.current.pause();
      }
    }
  }, [playbackState.isPlaying, playbackMode, lastTrackId, playbackState.currentTrack, browserControlledState]);

  // Memoized callback functions to prevent MediaLibrary re-renders
  const handlePlayTrack = useCallback(async (track: any) => {
    try {
      console.log(`🎵 [FRONTEND] Playing track from library: ${track.title} (ID: ${track.id})`);
      await fetch(`${API_BASE}/audio/play-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      });
      fetchPlaybackState();
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }, [API_BASE]);

  const handlePlayPlaylist = useCallback(async (tracks: any[]) => {
    try {
      await fetch(`${API_BASE}/audio/play-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tracks: tracks.map(track => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            filePath: track.filePath
          })),
          startIndex: 0
        })
      });
      fetchPlaybackState();
    } catch (error) {
      console.error('Failed to play playlist:', error);
    }
  }, [API_BASE]);

  const handleQuickPlayTrack = useCallback(async (track: any) => {
    try {
      console.log(`🎵 [FRONTEND] Quick playing track: ${track.title}`);
      await fetch(`${API_BASE}/audio/play-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      });
      fetchPlaybackState();
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }, [API_BASE]);

  const handleSwitchToLibrary = useCallback(() => {
    setActiveTab('library');
  }, []);

  const tabs = [
    { id: 'player', label: 'Player', icon: Music },
    { id: 'library', label: 'Library', icon: Radio },
    { id: 'rfid', label: 'Cards', icon: Radio },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen dark-gradient-bg">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <motion.header 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mb-8"
        >
          <motion.div 
            variants={fadeInUp}
            className="flex items-center justify-between mb-6"
          >
            <motion.div 
              variants={slideInLeft}
              className="flex items-center space-x-3"
            >
              <motion.div 
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Music className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <motion.h1 
                  className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, ...springConfig }}
                >
                  Phoniebox
                </motion.h1>
                <motion.p 
                  className="text-sm text-slate-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Modern RFID Music System
                </motion.p>
              </div>
            </motion.div>
            
            <motion.div
              variants={buttonPulse}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="glass-card"
              >
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>

          {/* Navigation */}
          <motion.div
            variants={fadeInUp}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-2">
              <nav className="flex space-x-1">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  return (
                    <motion.div
                      key={tab.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1, ...springConfig }}
                      variants={buttonPulse}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant={activeTab === tab.id ? "default" : "ghost"}
                        onClick={() => setActiveTab(tab.id as any)}
                        className="flex items-center space-x-2 relative overflow-hidden"
                      >
                        <motion.div
                          animate={activeTab === tab.id ? { rotate: 360 } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="w-4 h-4" />
                        </motion.div>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 bg-primary/20 rounded-md border border-primary/30 -z-10"
                            initial={false}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </nav>
            </GlassCard>
          </motion.div>
        </motion.header>

        {/* Main Content */}
        <AnimatePresence mode="wait">
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
                        audioElement={audioRef.current}
                        style="bars"
                      />

                      {/* Progress Bar */}
                      <div className="w-full max-w-md">
                        <ProgressBar
                          progress={playbackState.progress || 0}
                          duration={playbackState.duration || 0}
                          currentTime={playbackState.currentTime || 0}
                          onSeek={async (time) => {
                            try {
                              console.log(`🕐 [FRONTEND] Seeking to ${time}s in ${playbackMode} mode`);
                              
                              if (playbackMode === 'browser' && audioRef.current) {
                                // Browser mode - seek directly
                                setLastSeekTime(Date.now());
                                audioRef.current.currentTime = time;
                                setPlaybackState(prev => ({
                                  ...prev,
                                  currentTime: Math.floor(time),
                                  progress: playbackState.duration ? (time / playbackState.duration) * 100 : 0
                                }));
                                console.log(`✅ [FRONTEND] Browser seek to ${time}s successful`);
                              } else {
                                // Hardware mode - use backend
                                await fetch(`${API_BASE}/audio/seek`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ time })
                                });
                                fetchPlaybackState();
                                console.log(`✅ [FRONTEND] Hardware seek to ${time}s successful`);
                              }
                            } catch (error) {
                              console.error('❌ [FRONTEND] Failed to seek:', error);
                            }
                          }}
                        />
                      </div>

                      {/* Controls */}
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
                            onClick={() => setIsShuffled(!isShuffled)}
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
                            onClick={handlePrevious}
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
                            onClick={playbackState.isPlaying ? handlePause : handlePlay}
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
                            onClick={handleNext}
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
                            onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
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

                        <VolumeControl
                          volume={volume}
                          onVolumeChange={setVolume}
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

                      {/* Playback Mode Toggle */}
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-slate-300">Playback:</span>
                          <div className="flex bg-slate-800/50 rounded-lg p-1">
                            <Button
                              variant={playbackMode === 'browser' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => handlePlaybackModeChange('browser')}
                              className="h-8 px-3 text-xs"
                            >
                              Browser
                            </Button>
                            <Button
                              variant={playbackMode === 'hardware' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => handlePlaybackModeChange('hardware')}
                              className="h-8 px-3 text-xs"
                            >
                              Hardware
                            </Button>
                          </div>
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            needsUserInteraction && playbackMode === 'browser'
                              ? 'bg-yellow-400 animate-pulse'
                              : playbackState.isPlaying 
                                ? 'bg-green-400 animate-pulse' 
                                : 'bg-gray-400'
                          }`} />
                          <span className="text-sm text-slate-200">
                            {needsUserInteraction && playbackMode === 'browser' 
                              ? 'Click Play' 
                              : playbackState.isPlaying ? 'Playing' : 'Paused'} ({playbackMode})
                          </span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                  </motion.div>
                </motion.div>

                {/* Sidebar */}
                <motion.div 
                  className="space-y-6"
                  variants={fadeInUp}
                  transition={{ delay: 0.2 }}
                >
                  <GlassCard className="p-6">
                    <h3 className="font-semibold mb-4 text-slate-100">Quick Actions</h3>
                    <div className="space-y-3">
                      <Button variant="ghost" className="w-full justify-start glass-card">
                        <Radio className="w-4 h-4 mr-2" />
                        Scan RFID Card
                      </Button>
                      <Button variant="ghost" className="w-full justify-start glass-card">
                        <Music className="w-4 h-4 mr-2" />
                        Browse Library
                      </Button>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6">
                    <h3 className="font-semibold mb-4 text-slate-100">Quick Play</h3>
                    <QuickPlayLibrary 
                      apiBase={API_BASE}
                      onPlayTrack={handleQuickPlayTrack}
                      onSwitchToLibrary={handleSwitchToLibrary}
                    />
                  </GlassCard>
                </motion.div>
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
              <GlassCard className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-slate-100">Settings</h2>
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-300">Settings panel coming soon</p>
                </div>
              </GlassCard>
            )}
          </motion.main>
        </AnimatePresence>
      </div>
      
      {/* Hidden audio element for browser playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleBrowserAudioTimeUpdate}
        onEnded={handleBrowserAudioEnded}
        onPlay={() => {
          console.log(`🌐 [FRONTEND] Audio element started playing`);
          if (playbackMode === 'browser') {
            setPlaybackState(prev => ({ ...prev, isPlaying: true }));
            // Reset browser control flag after a short delay
            setTimeout(() => setBrowserControlledState(null), 500);
          }
        }}
        onPause={() => {
          console.log(`🌐 [FRONTEND] Audio element paused`);
          if (playbackMode === 'browser') {
            setPlaybackState(prev => ({ ...prev, isPlaying: false }));
            // Reset browser control flag after a short delay
            setTimeout(() => setBrowserControlledState(null), 500);
          }
        }}
        onLoadStart={() => console.log(`🌐 [FRONTEND] Audio loading started`)}
        onCanPlay={() => console.log(`🌐 [FRONTEND] Audio can play`)}
        onCanPlayThrough={() => console.log(`🌐 [FRONTEND] Audio can play through`)}
        onError={(e) => console.error(`❌ [FRONTEND] Audio error:`, e)}
        onLoadedMetadata={() => console.log(`🌐 [FRONTEND] Audio metadata loaded`)}
        crossOrigin="anonymous"
        preload="auto"
        loop={false}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default App
