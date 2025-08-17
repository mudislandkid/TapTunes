import fs from 'fs';
import path from 'path';

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  file_path: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: AudioTrack[];
}

class AudioService {
  private playlists: Map<string, Playlist> = new Map();
  private audioDirectory: string;

  constructor(audioDirectory: string = './audio') {
    this.audioDirectory = audioDirectory;
    this.createAudioDirectory();
    this.loadPlaylists();
  }

  private createAudioDirectory() {
    if (!fs.existsSync(this.audioDirectory)) {
      fs.mkdirSync(this.audioDirectory, { recursive: true });
    }
  }

  private loadPlaylists() {
    try {
      const playlistsFile = path.join(this.audioDirectory, 'playlists.json');
      if (fs.existsSync(playlistsFile)) {
        const data = fs.readFileSync(playlistsFile, 'utf8');
        const playlists = JSON.parse(data);
        playlists.forEach((playlist: Playlist) => {
          this.playlists.set(playlist.id, playlist);
        });
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  }

  private savePlaylists() {
    try {
      const playlistsFile = path.join(this.audioDirectory, 'playlists.json');
      const playlists = Array.from(this.playlists.values());
      fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
    } catch (error) {
      console.error('Error saving playlists:', error);
    }
  }

  getAllPlaylists(): Playlist[] {
    return Array.from(this.playlists.values());
  }

  getPlaylist(id: string): Playlist | undefined {
    return this.playlists.get(id);
  }

  createPlaylist(name: string, tracks: AudioTrack[] = []): Playlist {
    const playlist: Playlist = {
      id: Date.now().toString(),
      name,
      tracks
    };
    this.playlists.set(playlist.id, playlist);
    this.savePlaylists();
    return playlist;
  }

  addTrackToPlaylist(playlistId: string, track: AudioTrack): boolean {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    playlist.tracks.push(track);
    this.savePlaylists();
    return true;
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return false;

    playlist.tracks = playlist.tracks.filter(track => track.id !== trackId);
    this.savePlaylists();
    return true;
  }

  deletePlaylist(id: string): boolean {
    const deleted = this.playlists.delete(id);
    if (deleted) {
      this.savePlaylists();
    }
    return deleted;
  }

  scanAudioFiles(): AudioTrack[] {
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    const tracks: AudioTrack[] = [];

    const scanDirectory = (dir: string) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (audioExtensions.includes(path.extname(item).toLowerCase())) {
            const track: AudioTrack = {
              id: Buffer.from(fullPath).toString('base64'),
              title: path.basename(item, path.extname(item)),
              file_path: fullPath
            };
            tracks.push(track);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    scanDirectory(this.audioDirectory);
    return tracks;
  }

  getAudioFilePath(trackId: string): string | null {
    try {
      const filePath = Buffer.from(trackId, 'base64').toString();
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    } catch (error) {
      console.error('Error decoding track ID:', error);
    }
    return null;
  }
}

export default AudioService;