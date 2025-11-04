import { Router } from 'express';
import { MediaService } from '../services/mediaService';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const mediaService = new MediaService();
const execAsync = promisify(exec);

interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  track_type?: 'file' | 'stream';
  file_path: string;
  source_url?: string; // For radio streams
  coverArt?: string;
}

interface Playlist {
  id: string;
  name: string;
  tracks: AudioTrack[];
}

let currentPlaylist: Playlist | null = null;
let currentTrackIndex = 0;
let isPlaying = false;
let currentTime = 0; // in seconds
let duration = 0; // in seconds
let playbackStartTime = Date.now();
let playbackMode: 'browser' | 'hardware' = 'hardware'; // Default to hardware playback
let hardwareProcess: any = null; // Store hardware audio process
let isKillingProcess = false; // Flag to track intentional kills

// Helper function to get playback path (handles both files and streams)
function getPlaybackPath(track: AudioTrack): string {
  return track.track_type === 'stream' && track.source_url ? track.source_url : track.file_path;
}
let systemVolume = 75; // System volume (0-100)

router.get('/playlists', (req, res) => {
  res.json({ playlists: [] });
});

router.post('/playlists', (req, res) => {
  const { name, tracks } = req.body;
  const playlist: Playlist = {
    id: Date.now().toString(),
    name,
    tracks: tracks || []
  };
  res.json(playlist);
});

router.get('/current', (req, res) => {
  let currentTrack: AudioTrack | null = null;
  
  if (currentPlaylist?.tracks && currentPlaylist.tracks.length > currentTrackIndex) {
    currentTrack = currentPlaylist.tracks[currentTrackIndex];
    // Set duration from track metadata
    if (!duration && currentTrack) {
      duration = currentTrack.duration || 180; // fallback to 3 minutes
    }
  }

  // Calculate current time if playing
  if (isPlaying) {
    const elapsed = (Date.now() - playbackStartTime) / 1000;
    currentTime = Math.min(currentTime + elapsed, duration);
    playbackStartTime = Date.now();
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const response = {
    playlist: currentPlaylist,
    trackIndex: currentTrackIndex,
    isPlaying,
    currentTrack,
    progress: Math.min(100, Math.max(0, progress)),
    currentTime: Math.floor(currentTime),
    duration: Math.floor(duration),
    playbackMode,
    volume: systemVolume
  };
  
  // Log current state (but not too frequently)
  if (Math.random() < 0.1) { // Only log ~10% of requests to avoid spam
    console.log(`📊 [AUDIO] Current state: Playing=${isPlaying}, Mode=${playbackMode}, Track="${currentTrack?.title || 'none'}"`);
  }
    
  res.json(response);
});

// Set playback mode
router.post('/playback-mode', async (req, res) => {
  const { mode } = req.body;
  console.log(`🎵 [AUDIO] Setting playback mode to: ${mode}`);
  
  if (mode !== 'browser' && mode !== 'hardware') {
    console.log(`❌ [AUDIO] Invalid playback mode: ${mode}`);
    return res.status(400).json({ error: 'Invalid playback mode. Must be "browser" or "hardware"' });
  }

  // Stop current hardware playback if switching away from hardware
  if (playbackMode === 'hardware' && mode === 'browser' && hardwareProcess) {
    console.log(`🛑 [AUDIO] Stopping hardware playback to switch to browser mode`);
    try {
      hardwareProcess.kill();
      hardwareProcess = null;
    } catch (error) {
      console.error('Error stopping hardware playback:', error);
    }
  }

  playbackMode = mode;
  
  // Set system volume when switching to hardware mode
  if (mode === 'hardware') {
    try {
      await setSystemVolume(systemVolume);
      console.log(`🔊 [AUDIO] System volume set to ${systemVolume}% for hardware mode`);
    } catch (error) {
      console.error('⚠️ [AUDIO] Failed to set system volume:', error);
    }
  }
  
  console.log(`✅ [AUDIO] Playback mode set to: ${mode}`);
  res.json({ playbackMode, volume: systemVolume, message: `Playback mode set to ${mode}` });
});

// Play track by ID
router.post('/play-track', async (req, res) => {
  try {
    const { trackId } = req.body;
    console.log(`🎵 [AUDIO] Play track request - ID: ${trackId}, Mode: ${playbackMode}`);

    if (!trackId) {
      console.log(`❌ [AUDIO] No track ID provided`);
      return res.status(400).json({ error: 'Track ID is required' });
    }

    // Check if this track is already in the current playlist
    if (currentPlaylist?.tracks) {
      const trackIndexInPlaylist = currentPlaylist.tracks.findIndex(t => t.id === trackId);
      if (trackIndexInPlaylist !== -1) {
        // Track exists in current playlist - just jump to it
        console.log(`🎯 [AUDIO] Track found in current playlist at index ${trackIndexInPlaylist} - jumping to it`);
        currentTrackIndex = trackIndexInPlaylist;
        currentTime = 0;
        duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
        isPlaying = true;
        playbackStartTime = Date.now();

        // Start hardware playback if in hardware mode
        if (playbackMode === 'hardware') {
          const playbackPath = getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]);
          console.log(`🔊 [AUDIO] Starting hardware playback for: ${playbackPath}`);
          try {
            await startHardwarePlayback(playbackPath, 0);
            console.log(`✅ [AUDIO] Hardware playback started successfully`);
          } catch (error) {
            console.error(`❌ [AUDIO] Hardware playback failed:`, error);
            throw error;
          }
        } else {
          console.log(`🌐 [AUDIO] Browser playback mode - frontend should handle audio`);
        }

        console.log(`✅ [AUDIO] Jumped to track ${currentTrackIndex + 1}/${currentPlaylist.tracks.length} in playlist`);
        res.json({
          status: 'playing',
          track: currentPlaylist.tracks[currentTrackIndex],
          playbackMode,
          trackIndex: currentTrackIndex
        });
        return;
      }
    }

    // Track not in current playlist - get it from database and create single-track playlist
    const track = await mediaService.getTrackById(trackId);
    if (!track) {
      console.log(`❌ [AUDIO] Track not found: ${trackId}`);
      return res.status(404).json({ error: 'Track not found' });
    }

    console.log(`📀 [AUDIO] Playing new track: "${track.title}" by ${track.artist}`);
    console.log(`📁 [AUDIO] File path: ${track.filePath}`);
    console.log(`⏱️ [AUDIO] Track duration from database: ${track.duration} seconds`);

    // Create single-track playlist
    currentPlaylist = {
      id: 'single-track',
      name: 'Now Playing',
      tracks: [{
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        track_type: track.trackType,
        file_path: track.filePath,
        source_url: track.sourceUrl,
        coverArt: track.coverArt
      }]
    };

    currentTrackIndex = 0;
    currentTime = 0;
    duration = track.duration;
    isPlaying = true;
    playbackStartTime = Date.now();

    // Start hardware playback if in hardware mode
    if (playbackMode === 'hardware') {
      const playbackPath = getPlaybackPath(currentPlaylist.tracks[0]);
      console.log(`🔊 [AUDIO] Starting hardware playback for: ${playbackPath}`);
      try {
        await startHardwarePlayback(playbackPath, 0); // Start from beginning for new track
        console.log(`✅ [AUDIO] Hardware playback started successfully`);
      } catch (error) {
        console.error(`❌ [AUDIO] Hardware playback failed:`, error);
        throw error;
      }
    } else {
      console.log(`🌐 [AUDIO] Browser playback mode - frontend should handle audio`);
    }

    console.log(`✅ [AUDIO] Track playing successfully in ${playbackMode} mode`);
    res.json({
      status: 'playing',
      track: currentPlaylist.tracks[0],
      playbackMode
    });

  } catch (error) {
    console.error('❌ [AUDIO] Error playing track:', error);
    res.status(500).json({ error: 'Failed to play track' });
  }
});

// Play playlist
router.post('/play-playlist', async (req, res) => {
  try {
    const { tracks, startIndex = 0 } = req.body;
    
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: 'Tracks array is required' });
    }

    // Create playlist from tracks
    currentPlaylist = {
      id: 'custom-playlist',
      name: 'Custom Playlist',
      tracks: tracks.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        track_type: track.trackType,
        file_path: track.filePath,
        source_url: track.sourceUrl,
        coverArt: track.coverArt
      }))
    };

    currentTrackIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
    currentTime = 0;
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    isPlaying = true;
    playbackStartTime = Date.now();

    // Start hardware playback if in hardware mode
    if (playbackMode === 'hardware' && currentPlaylist.tracks[currentTrackIndex]) {
      const playbackPath = getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]);
      await startHardwarePlayback(playbackPath);
    }

    res.json({ 
      status: 'playing', 
      playlist: currentPlaylist,
      trackIndex: currentTrackIndex,
      playbackMode 
    });

  } catch (error) {
    console.error('Error playing playlist:', error);
    res.status(500).json({ error: 'Failed to play playlist' });
  }
});

router.post('/play', async (req, res) => {
  const { playlistId, trackIndex } = req.body;
  isPlaying = true;
  playbackStartTime = Date.now();
  if (trackIndex !== undefined) {
    currentTrackIndex = trackIndex;
    currentTime = 0; // Reset time for new track
  }

  // Start/resume hardware playback if in hardware mode and we have a current track
  if (playbackMode === 'hardware' && currentPlaylist?.tracks[currentTrackIndex]) {
    if (hardwareProcess) {
      // Resume existing process (mpv only)
      try {
        console.log(`▶️ [AUDIO] Resuming mpv playback via stdin`);
        hardwareProcess.stdin.write(' '); // Space toggles pause in mpv
      } catch (error) {
        console.error('Error resuming mpv playback:', error);
        hardwareProcess = null;
      }
    } else {
      // Start new playback (or resume from saved position)
      console.log(`▶️ [AUDIO] Starting hardware playback from position ${currentTime}s`);
      await startHardwarePlayback(currentPlaylist.tracks[currentTrackIndex].file_path, currentTime);
    }
  }

  res.json({ status: 'playing', trackIndex: currentTrackIndex, playbackMode });
});

router.post('/pause', (req, res) => {
  isPlaying = false;

  // Pause hardware playback if in hardware mode
  if (playbackMode === 'hardware' && hardwareProcess) {
    try {
      // For mpg123, we need to stop and remember position
      // For mpv, we can use stdin
      const isUsingMpv = hardwareProcess.stdin && hardwareProcess.stdin.writable;

      if (isUsingMpv) {
        console.log(`⏸️ [AUDIO] Pausing mpv playback via stdin`);
        hardwareProcess.stdin.write(' '); // Space toggles pause in mpv
      } else {
        // For mpg123 - just kill it, we'll restart from saved position
        console.log(`⏸️ [AUDIO] Stopping mpg123 for pause`);
        const elapsed = (Date.now() - playbackStartTime) / 1000;
        currentTime = Math.min(currentTime + elapsed, duration);
        console.log(`💾 [AUDIO] Saved position: ${currentTime}s / ${duration}s`);

        // Mark that we're intentionally killing for pause
        isKillingProcess = true;
        hardwareProcess.kill();
        hardwareProcess = null;
        // Reset flag after a short delay
        setTimeout(() => {
          isKillingProcess = false;
        }, 100);
      }
    } catch (error) {
      console.error('Error pausing hardware playback:', error);
    }
  }

  res.json({ status: 'paused' });
});

router.post('/stop', (req, res) => {
  isPlaying = false;
  currentTrackIndex = 0;
  currentTime = 0;
  
  // Stop hardware playback if in hardware mode
  if (playbackMode === 'hardware' && hardwareProcess) {
    try {
      hardwareProcess.kill();
      hardwareProcess = null;
    } catch (error) {
      console.error('Error stopping hardware playback:', error);
    }
  }
  
  res.json({ status: 'stopped' });
});

router.post('/next', (req, res) => {
  console.log(`⏭️ [AUDIO] Next track request`);
  console.log(`   Playlist exists: ${!!currentPlaylist}`);
  console.log(`   Playlist tracks: ${currentPlaylist?.tracks?.length || 0}`);
  console.log(`   Current index: ${currentTrackIndex}`);
  console.log(`   Is playing: ${isPlaying}`);
  console.log(`   Playback mode: ${playbackMode}`);

  if (currentPlaylist?.tracks && currentTrackIndex < currentPlaylist.tracks.length - 1) {
    currentTrackIndex++;
    currentTime = 0; // Reset time for new track
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    playbackStartTime = Date.now();

    console.log(`✅ [AUDIO] Advancing to track ${currentTrackIndex + 1}/${currentPlaylist.tracks.length}: "${currentPlaylist.tracks[currentTrackIndex].title}"`);

    // Start hardware playback for new track if in hardware mode
    if (playbackMode === 'hardware' && isPlaying) {
      console.log(`🎵 [AUDIO] Starting hardware playback for next track`);
      startHardwarePlayback(getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]));
    } else {
      console.log(`⚠️ [AUDIO] Not starting playback (mode=${playbackMode}, playing=${isPlaying})`);
    }
  } else {
    console.log(`⚠️ [AUDIO] Cannot advance: at end of playlist or no playlist loaded`);
  }
  res.json({ trackIndex: currentTrackIndex });
});

router.post('/previous', (req, res) => {
  console.log(`⏮️ [AUDIO] Previous track request`);
  console.log(`   Playlist exists: ${!!currentPlaylist}`);
  console.log(`   Playlist tracks: ${currentPlaylist?.tracks?.length || 0}`);
  console.log(`   Current index: ${currentTrackIndex}`);
  console.log(`   Is playing: ${isPlaying}`);
  console.log(`   Playback mode: ${playbackMode}`);

  // Calculate current playback position
  const elapsed = isPlaying ? (Date.now() - playbackStartTime) / 1000 : 0;
  const currentPosition = currentTime + elapsed;

  console.log(`   Current position: ${currentPosition.toFixed(1)}s`);

  // If we're more than 3 seconds into the track, restart current track
  if (currentPosition > 3) {
    console.log(`🔄 [AUDIO] Restarting current track from beginning`);
    currentTime = 0;
    playbackStartTime = Date.now();

    // Restart hardware playback from beginning if in hardware mode
    if (playbackMode === 'hardware' && isPlaying && currentPlaylist?.tracks) {
      console.log(`🎵 [AUDIO] Restarting hardware playback from beginning`);
      startHardwarePlayback(getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]));
    }
  } else if (currentTrackIndex > 0) {
    // We're at the beginning, go to actual previous track
    currentTrackIndex--;
    currentTime = 0;
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    playbackStartTime = Date.now();

    console.log(`✅ [AUDIO] Going back to track ${currentTrackIndex + 1}/${currentPlaylist.tracks.length}: "${currentPlaylist.tracks[currentTrackIndex].title}"`);

    // Start hardware playback for previous track if in hardware mode
    if (playbackMode === 'hardware' && isPlaying) {
      console.log(`🎵 [AUDIO] Starting hardware playback for previous track`);
      startHardwarePlayback(getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]));
    } else {
      console.log(`⚠️ [AUDIO] Not starting playback (mode=${playbackMode}, playing=${isPlaying})`);
    }
  } else {
    console.log(`⚠️ [AUDIO] Already at first track and beginning - restarting from 0:00`);
    currentTime = 0;
    playbackStartTime = Date.now();

    // Restart from beginning if playing
    if (playbackMode === 'hardware' && isPlaying && currentPlaylist?.tracks) {
      startHardwarePlayback(getPlaybackPath(currentPlaylist.tracks[currentTrackIndex]));
    }
  }

  res.json({ trackIndex: currentTrackIndex });
});

router.post('/seek', (req, res) => {
  const { time } = req.body; // time in seconds
  console.log(`🕐 [AUDIO] Seek request to ${time}s (mode: ${playbackMode}, duration: ${duration}s)`);
  
  if (typeof time === 'number' && time >= 0 && time <= duration) {
    currentTime = time;
    playbackStartTime = Date.now();
    
    // For hardware playback, we'd need to implement seeking in the audio player
    // This is complex with system audio players, so for now we'll just update the time
    if (playbackMode === 'hardware') {
      console.log(`⚠️ [AUDIO] Hardware seeking not fully implemented - updating time tracking only`);
      // TODO: Implement hardware seeking if needed
      // For now, we just track the time change for state synchronization
    }
    
    console.log(`✅ [AUDIO] Seek successful - new time: ${currentTime}s`);
    res.json({ currentTime, status: 'seeked' });
  } else {
    console.log(`❌ [AUDIO] Invalid seek time: ${time} (duration: ${duration})`);
    res.status(400).json({ error: 'Invalid seek time' });
  }
});

// Volume control
router.post('/volume', async (req, res) => {
  const { volume } = req.body;
  console.log(`🔊 [AUDIO] Volume request: ${volume}% (mode: ${playbackMode})`);
  
  if (typeof volume !== 'number' || volume < 0 || volume > 100) {
    console.log(`❌ [AUDIO] Invalid volume: ${volume}`);
    return res.status(400).json({ error: 'Volume must be between 0 and 100' });
  }

  systemVolume = volume;
  
  // Apply volume control for hardware mode
  if (playbackMode === 'hardware') {
    try {
      await setSystemVolume(volume);
      console.log(`✅ [AUDIO] System volume set to ${volume}%`);
    } catch (error) {
      console.error('❌ [AUDIO] Failed to set system volume:', error);
      return res.status(500).json({ error: 'Failed to set system volume' });
    }
  }
  
  res.json({ volume: systemVolume, status: 'volume_set', playbackMode });
});

// System volume control function
async function setSystemVolume(volume: number): Promise<void> {
  try {
    let command: string;
    
    if (process.platform === 'linux') {
      // For Raspberry Pi / Linux, use amixer (ALSA) or pactl (PulseAudio)
      
      // First, try to find the correct mixer control
      try {
        // Check if amixer is available
        await execAsync('which amixer');
        
        // For Waveshare Audio HAT, we need to use the correct card and control
        // The Waveshare HAT usually appears as card 0 or card 1
        
        // First try to list all cards to find the Waveshare HAT
        try {
          const { stdout: cards } = await execAsync('cat /proc/asound/cards');
          console.log(`Available sound cards: ${cards}`);
        } catch {
          console.log('Could not list sound cards');
        }
        
        // For WM8960 sound card (based on diagnostic output)
        // Working commands: "amixer set Master 50%" and "amixer -c 0 set Playback 50%"
        const mixerCommands = [
          `amixer set Master ${volume}%`,             // Primary: Works with WM8960
          `amixer -c 0 set Playback ${volume}%`,      // Secondary: Also works with WM8960
          `amixer -c 0 set Master ${volume}%`,        // Fallback: Master on card 0
          `amixer sset Master ${volume}%`,            // Fallback: Master with sset
          `amixer -c 0 set PCM ${volume}%`,           // Generic fallback
          `amixer set PCM ${volume}%`,                // Generic fallback
          `amixer sset 'Master' ${volume}%`           // Last resort
        ];
        
        let volumeSet = false;
        for (const cmd of mixerCommands) {
          try {
            console.log(`Trying volume command: ${cmd}`);
            await execAsync(cmd);
            volumeSet = true;
            console.log(`✅ Successfully set volume with: ${cmd}`);
            return; // Success, exit early
          } catch (err) {
            // This command didn't work, try the next one
            continue;
          }
        }
        
        if (!volumeSet) {
          // If none of the specific commands worked, try to detect the mixer name
          try {
            const { stdout: mixers } = await execAsync('amixer scontrols');
            console.log(`Available mixer controls: ${mixers}`);
            
            // Extract the first mixer control name
            const match = mixers.match(/Simple mixer control '([^']+)'/);
            if (match && match[1]) {
              command = `amixer sset '${match[1]}' ${volume}%`;
              await execAsync(command);
              console.log(`✅ Set volume using detected mixer: ${match[1]}`);
              return;
            }
          } catch {
            console.log('Could not detect mixer controls');
          }
        }
      } catch (amixerError) {
        console.log('amixer not available or failed, trying pactl...');
        
        try {
          // Fallback to pactl (PulseAudio)
          await execAsync('which pactl');
          
          // Get the default sink
          const { stdout: defaultSink } = await execAsync("pactl info | grep 'Default Sink' | cut -d: -f2");
          const sinkName = defaultSink.trim();
          
          if (sinkName) {
            command = `pactl set-sink-volume ${sinkName} ${volume}%`;
          } else {
            command = `pactl set-sink-volume @DEFAULT_SINK@ ${volume}%`;
          }
          
          await execAsync(command);
          console.log(`✅ Successfully set volume using PulseAudio`);
          return;
        } catch (pactlError) {
          console.log('pactl not available or failed, trying alsamixer...');
          
          // Last resort: try alsamixer command directly
          try {
            // Convert percentage to 0-65536 range for some ALSA implementations
            const alsaVolume = Math.round((volume / 100) * 65536);
            command = `amixer -c 0 set PCM ${volume}%`;
            await execAsync(command);
            console.log(`✅ Successfully set volume using direct ALSA command`);
            return;
          } catch {
            throw new Error('No suitable volume control found (tried amixer with multiple mixers, pactl, and direct ALSA)');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS - use osascript to set system volume (0-100 scale needs to be converted to 0-7 scale)
      const macVolume = Math.round((volume / 100) * 7);
      command = `osascript -e "set volume ${macVolume}"`;
      await execAsync(command);
      console.log(`✅ Successfully set volume on macOS`);
    } else if (process.platform === 'win32') {
      // Windows - this would require a more complex solution
      throw new Error('Windows volume control not implemented');
    } else {
      throw new Error('Unsupported platform for volume control');
    }
    
  } catch (error) {
    console.error('❌ Failed to set system volume:', error);
    // Don't throw the error, just log it - this allows playback to continue even if volume control fails
    // throw error;
  }
}

// Hardware playback function
async function startHardwarePlayback(filePath: string, startPosition: number = 0): Promise<void> {
  try {
    // Debug the file path
    console.log(`🔍 [AUDIO] Raw filePath received:`, JSON.stringify(filePath));
    console.log(`🔍 [AUDIO] FilePath length: ${filePath.length}`);
    console.log(`🔍 [AUDIO] FilePath contains newline: ${filePath.includes('\n')}`);

    // Clean the file path of any whitespace/newlines
    const cleanFilePath = filePath.trim();
    console.log(`🔍 [AUDIO] Cleaned filePath:`, JSON.stringify(cleanFilePath));

    // Check if this is a stream URL
    const isStream = cleanFilePath.startsWith('http://') || cleanFilePath.startsWith('https://');
    if (isStream) {
      console.log(`📻 [AUDIO] Detected stream URL - will use streaming playback`);
    }
    
    // Stop existing hardware playback
    if (hardwareProcess) {
      isKillingProcess = true; // Mark that we're intentionally killing
      hardwareProcess.kill();
      hardwareProcess = null;
      // Wait a bit for the exit handler to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      isKillingProcess = false;
    }

    // Determine which audio player to use based on platform
    let command: string;
    
    if (process.platform === 'linux') {
      // For Raspberry Pi / Linux, try different audio players
      // Check if mpv is available (best for pause/resume)
      // Try mpg123 first - it's much faster on Raspberry Pi
      try {
        await execAsync('which mpg123');
        // Add -k option to seek to frame if resuming
        if (startPosition > 0) {
          // mpg123 uses frames, approximate: 38.28 frames per second for 48kHz
          const skipFrames = Math.floor(startPosition * 38.28);
          console.log(`⏩ [HARDWARE] Resuming from position ${startPosition}s (skipping ${skipFrames} frames)`);
          command = `mpg123 -a hw:0,0 -k ${skipFrames} "${cleanFilePath}"`;
        } else {
          command = `mpg123 -a hw:0,0 "${cleanFilePath}"`;
        }
      } catch {
        try {
          // Fallback to mpv if mpg123 not available
          await execAsync('which mpv');
          command = `mpv --no-video --ao=alsa --really-quiet --volume=100 "${cleanFilePath}"`;
        } catch {
          try {
            // Fallback to ffplay
            await execAsync('which ffplay');
            command = `ffplay -nodisp -autoexit "${cleanFilePath}"`;
          } catch {
            throw new Error('No suitable audio player found (tried mpv, mpg123, ffplay)');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS
      command = `afplay "${cleanFilePath}"`;
    } else if (process.platform === 'win32') {
      // Windows - use ffplay if available
      command = `ffplay -nodisp -autoexit "${cleanFilePath}"`;
    } else {
      throw new Error('Unsupported platform for hardware playback');
    }

    console.log(`🔊 [HARDWARE] Starting hardware playback with command: ${command}`);
    console.log(`📁 [HARDWARE] Clean file path: "${cleanFilePath}"`);
    
    // Start the audio process
    const { spawn } = require('child_process');
    
    // Don't split on spaces - build arguments properly
    let cmd: string;
    let args: string[];
    
    console.log(`🛠️ [HARDWARE] Building spawn arguments...`);
    
    if (command.startsWith('mpv ')) {
      cmd = 'mpv';
      // Optimized args for faster startup and less output
      args = ['--no-video', '--audio-buffer=0.1', '--cache=yes', '--cache-secs=2', '--really-quiet', '--volume=100', '--input-terminal=yes', '--msg-level=all=info', cleanFilePath];
    } else if (command.startsWith('mpg123 ')) {
      cmd = 'mpg123';
      // Check if we have a -k option for seeking
      if (command.includes(' -k ')) {
        const skipMatch = command.match(/-k (\d+)/);
        if (skipMatch) {
          args = ['-a', 'hw:0,0', '-k', skipMatch[1], cleanFilePath];
        } else {
          args = ['-a', 'hw:0,0', cleanFilePath];
        }
      } else {
        args = ['-a', 'hw:0,0', cleanFilePath]; // Use WM8960 audio device
      }
    } else if (command.startsWith('ffplay ')) {
      cmd = 'ffplay';
      args = ['-nodisp', '-autoexit', cleanFilePath];
    } else if (command.startsWith('paplay ')) {
      cmd = 'paplay';
      args = [cleanFilePath];
    } else if (command.startsWith('afplay ')) {
      cmd = 'afplay';
      args = [cleanFilePath];
    } else {
      // Fallback - try to split but this might still have issues
      const parts = command.split(' ');
      cmd = parts[0];
      args = parts.slice(1);
    }
    
    console.log(`🚀 [HARDWARE] Executing: ${cmd} with args:`, JSON.stringify(args));
    
    hardwareProcess = spawn(cmd, args, {
      stdio: cmd === 'mpv' ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'], // pipe stdin for mpv control
      detached: false
    });

    console.log(`✨ [HARDWARE] Spawn process created with PID:`, hardwareProcess.pid);
    
    // Don't set isPlaying until audio actually starts
    let audioStarted = false;

    // Capture stderr for debugging
    hardwareProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      // Only log non-empty, non-binary output
      if (output && !output.includes('[') && output.length < 200) {
        console.log(`🔍 [HARDWARE] stderr: ${output}`);
      }
      
      // Try to extract duration from player output
      // mpg123 format: "Frame#   NNN [ NNNN], Time: MM:SS.SS [MM:SS.SS]"
      let mpg123Match = output.match(/Time:\s*\d+:\d+\.\d+\s*\[(\d+):(\d+)\.\d+\]/);
      if (mpg123Match) {
        const minutes = parseInt(mpg123Match[1]) || 0;
        const seconds = parseInt(mpg123Match[2]) || 0;
        const totalSeconds = minutes * 60 + seconds;
        if (totalSeconds > 0 && totalSeconds !== duration) {
          console.log(`⏱️ [HARDWARE] Detected duration from mpg123: ${totalSeconds} seconds`);
          duration = totalSeconds;
        }
      }
      
      // Try to extract duration from mpv output (different possible formats)
      // Format 1: "Duration: HH:MM:SS.MS"
      let durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!durationMatch) {
        // Format 2: "(+NNNs)" or "/ MM:SS" or "/ HH:MM:SS"
        durationMatch = output.match(/\/\s*(\d+):(\d+):(\d+)/);
      }
      if (!durationMatch) {
        // Format 3: mpv style "AV: 00:00:00 / 00:03:54"
        durationMatch = output.match(/\/\s*(\d{2}):(\d{2}):(\d{2})/);
      }
      
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]) || 0;
        const minutes = parseInt(durationMatch[2]) || 0;
        const seconds = parseFloat(durationMatch[3]) || 0;
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        if (totalSeconds > 0 && totalSeconds !== duration) {
          console.log(`⏱️ [HARDWARE] Detected duration: ${totalSeconds} seconds`);
          duration = totalSeconds;
        }
      }
    });

    // Capture stdout for debugging
    hardwareProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      // Only log meaningful output, skip progress bars and binary data
      if (output && !output.includes('[') && !output.includes('blob data') && output.length < 200) {
        console.log(`🔍 [HARDWARE] stdout: ${output}`);
      }
      
      // Detect when audio actually starts
      if (!audioStarted && (output.includes('Playing') || output.includes('Audio') || output.includes('Frame#'))) {
        audioStarted = true;
        playbackStartTime = Date.now();
        console.log(`🎶 [HARDWARE] Audio playback actually started`);
      }
      
      // Also check stdout for duration info (same patterns as stderr)
      // Also look for mpv's duration format like "Audio: 48000Hz 2ch s16p 252.720s"
      let durationMatch = output.match(/(\d+\.\d+)s/);
      if (durationMatch) {
        const totalSeconds = parseFloat(durationMatch[1]);
        if (totalSeconds > 0 && totalSeconds !== duration) {
          console.log(`⏱️ [HARDWARE] Detected duration: ${totalSeconds} seconds`);
          duration = totalSeconds;
        }
      } else {
        // Try HH:MM:SS formats
        durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (!durationMatch) {
          durationMatch = output.match(/\/\s*(\d+):(\d+):(\d+)/);
        }
        if (!durationMatch) {
          durationMatch = output.match(/\/\s*(\d{2}):(\d{2}):(\d{2})/);
        }
      
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]) || 0;
          const minutes = parseInt(durationMatch[2]) || 0;
          const seconds = parseFloat(durationMatch[3]) || 0;
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          if (totalSeconds > 0 && totalSeconds !== duration) {
            console.log(`⏱️ [HARDWARE] Detected duration: ${totalSeconds} seconds`);
            duration = totalSeconds;
          }
        }
      }
    });

    hardwareProcess.on('error', (error: Error) => {
      console.error('❌ [HARDWARE] Hardware playback error:', error);
      hardwareProcess = null;
    });

    hardwareProcess.on('exit', (code: number) => {
      console.log(`🏁 [HARDWARE] Hardware playback process exited with code ${code}`);
      hardwareProcess = null;

      // Ignore exit events for intentionally killed processes
      if (isKillingProcess) {
        console.log(`🔇 [HARDWARE] Ignoring exit event for intentionally killed process`);
        return;
      }

      // Auto-advance to next track if playback finished naturally
      if (code === 0 && isPlaying && currentPlaylist?.tracks && currentTrackIndex < currentPlaylist.tracks.length - 1) {
        currentTrackIndex++;
        currentTime = 0;
        duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
        playbackStartTime = Date.now();

        // Start next track
        setTimeout(() => {
          if (isPlaying) {
            startHardwarePlayback(currentPlaylist!.tracks[currentTrackIndex].file_path);
          }
        }, 100);
      } else if (code === 0) {
        // No more tracks or reached end of playlist - reset playback state
        console.log('🏁 [HARDWARE] Playback complete - resetting state');
        isPlaying = false;
        currentTime = 0;
        currentTrackIndex = -1;
        currentPlaylist = null;
        duration = 0;
        playbackStartTime = null;
      }
    });

  } catch (error) {
    console.error('Failed to start hardware playback:', error);
    throw error;
  }
}

export default router;