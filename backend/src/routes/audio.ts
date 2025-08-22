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
  file_path: string;
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
let playbackMode: 'browser' | 'hardware' = 'browser'; // Default to browser playback
let hardwareProcess: any = null; // Store hardware audio process

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
    playbackMode
  };
  
  // Log current state (but not too frequently)
  if (Math.random() < 0.1) { // Only log ~10% of requests to avoid spam
    console.log(`📊 [AUDIO] Current state: Playing=${isPlaying}, Mode=${playbackMode}, Track="${currentTrack?.title || 'none'}"`);
  }
    
  res.json(response);
});

// Set playback mode
router.post('/playback-mode', (req, res) => {
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
  console.log(`✅ [AUDIO] Playback mode set to: ${mode}`);
  res.json({ playbackMode, message: `Playback mode set to ${mode}` });
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

    // Get track from database
    const track = await mediaService.getTrackById(trackId);
    if (!track) {
      console.log(`❌ [AUDIO] Track not found: ${trackId}`);
      return res.status(404).json({ error: 'Track not found' });
    }

    console.log(`📀 [AUDIO] Playing track: "${track.title}" by ${track.artist}`);
    console.log(`📁 [AUDIO] File path: ${track.filePath}`);

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
        file_path: track.filePath
      }]
    };

    currentTrackIndex = 0;
    currentTime = 0;
    duration = track.duration;
    isPlaying = true;
    playbackStartTime = Date.now();

    // Start hardware playback if in hardware mode
    if (playbackMode === 'hardware') {
      console.log(`🔊 [AUDIO] Starting hardware playback`);
      await startHardwarePlayback(track.filePath);
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
        file_path: track.filePath
      }))
    };

    currentTrackIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
    currentTime = 0;
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    isPlaying = true;
    playbackStartTime = Date.now();

    // Start hardware playback if in hardware mode
    if (playbackMode === 'hardware' && currentPlaylist.tracks[currentTrackIndex]) {
      await startHardwarePlayback(currentPlaylist.tracks[currentTrackIndex].file_path);
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

router.post('/play', (req, res) => {
  const { playlistId, trackIndex } = req.body;
  isPlaying = true;
  playbackStartTime = Date.now();
  if (trackIndex !== undefined) {
    currentTrackIndex = trackIndex;
    currentTime = 0; // Reset time for new track
  }

  // Start hardware playback if in hardware mode and we have a current track
  if (playbackMode === 'hardware' && currentPlaylist?.tracks[currentTrackIndex]) {
    startHardwarePlayback(currentPlaylist.tracks[currentTrackIndex].file_path);
  }

  res.json({ status: 'playing', trackIndex: currentTrackIndex, playbackMode });
});

router.post('/pause', (req, res) => {
  isPlaying = false;
  
  // Pause hardware playback if in hardware mode
  if (playbackMode === 'hardware' && hardwareProcess) {
    try {
      hardwareProcess.kill('SIGSTOP'); // Pause process
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
  if (currentPlaylist?.tracks && currentTrackIndex < currentPlaylist.tracks.length - 1) {
    currentTrackIndex++;
    currentTime = 0; // Reset time for new track
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    playbackStartTime = Date.now();

    // Start hardware playback for new track if in hardware mode
    if (playbackMode === 'hardware' && isPlaying) {
      startHardwarePlayback(currentPlaylist.tracks[currentTrackIndex].file_path);
    }
  }
  res.json({ trackIndex: currentTrackIndex });
});

router.post('/previous', (req, res) => {
  if (currentTrackIndex > 0) {
    currentTrackIndex--;
    currentTime = 0; // Reset time for new track
    duration = currentPlaylist.tracks[currentTrackIndex]?.duration || 180;
    playbackStartTime = Date.now();

    // Start hardware playback for new track if in hardware mode
    if (playbackMode === 'hardware' && isPlaying) {
      startHardwarePlayback(currentPlaylist.tracks[currentTrackIndex].file_path);
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

// Hardware playback function
async function startHardwarePlayback(filePath: string): Promise<void> {
  try {
    // Debug the file path
    console.log(`🔍 [AUDIO] Raw filePath received:`, JSON.stringify(filePath));
    console.log(`🔍 [AUDIO] FilePath length: ${filePath.length}`);
    console.log(`🔍 [AUDIO] FilePath contains newline: ${filePath.includes('\n')}`);
    
    // Clean the file path of any whitespace/newlines
    const cleanFilePath = filePath.trim();
    console.log(`🔍 [AUDIO] Cleaned filePath:`, JSON.stringify(cleanFilePath));
    
    // Stop existing hardware playback
    if (hardwareProcess) {
      hardwareProcess.kill();
      hardwareProcess = null;
    }

    // Determine which audio player to use based on platform
    let command: string;
    
    if (process.platform === 'linux') {
      // For Raspberry Pi / Linux, try different audio players
      // Check if mpg123 is available (good for Raspberry Pi)
      try {
        await execAsync('which mpg123');
        command = `mpg123 "${cleanFilePath}"`;
      } catch {
        try {
          // Fallback to aplay for WAV files or ffplay
          await execAsync('which ffplay');
          command = `ffplay -nodisp -autoexit "${cleanFilePath}"`;
        } catch {
          try {
            // Fallback to paplay (PulseAudio)
            await execAsync('which paplay');
            command = `paplay "${cleanFilePath}"`;
          } catch {
            throw new Error('No suitable audio player found');
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

    console.log(`Starting hardware playback: ${command}`);
    
    // Start the audio process
    const { spawn } = require('child_process');
    
    // Don't split on spaces - build arguments properly
    let cmd: string;
    let args: string[];
    
    if (command.startsWith('mpg123 ')) {
      cmd = 'mpg123';
      args = [cleanFilePath]; // Use the cleaned file path
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
    
    console.log(`Executing: ${cmd} with args:`, args);
    
    hardwareProcess = spawn(cmd, args, {
      stdio: 'pipe',
      detached: false
    });

    hardwareProcess.on('error', (error: Error) => {
      console.error('Hardware playback error:', error);
      hardwareProcess = null;
    });

    hardwareProcess.on('exit', (code: number) => {
      console.log(`Hardware playback process exited with code ${code}`);
      hardwareProcess = null;
      
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
      }
    });

  } catch (error) {
    console.error('Failed to start hardware playback:', error);
    throw error;
  }
}

export default router;