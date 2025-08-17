import fs from 'fs/promises';
import path from 'path';
import { DatabaseService, DatabaseTrack, DatabaseFolder, DatabasePlaylist } from './databaseService';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre?: string;
  year?: number;
  filePath: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  folderId?: string;
  isLiked?: boolean;
  thumbnailPath?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  tags: string[];
  trackIds: string[];
  trackCount: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateTrackData {
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre?: string;
  year?: number;
  filePath: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  folderId?: string;
  thumbnailPath?: string;
  sourceUrl?: string;
}

interface CreateFolderData {
  name: string;
  parentId?: string;
}

interface CreatePlaylistData {
  name: string;
  description?: string;
  isPublic: boolean;
  tags: string[];
}

interface GetTracksParams {
  folderId?: string;
  search?: string;
  genre?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export class MediaService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  private buildFolderPath(parentId?: string, name?: string): string {
    if (!parentId) {
      return `/music${name ? `/${name}` : ''}`;
    }
    
    // This is simplified - in a real implementation you'd build the full path
    return `/music/subfolder${name ? `/${name}` : ''}`;
  }

  // Convert database track to frontend track format
  private convertDbTrack(dbTrack: DatabaseTrack): Track {
    return {
      id: dbTrack.id,
      title: dbTrack.title,
      artist: dbTrack.artist,
      album: dbTrack.album,
      duration: dbTrack.duration,
      genre: dbTrack.genre,
      year: dbTrack.year,
      filePath: dbTrack.file_path,
      fileName: dbTrack.file_name,
      originalName: dbTrack.original_name,
      fileSize: dbTrack.file_size,
      mimeType: dbTrack.mime_type,
      folderId: dbTrack.folder_id,
      isLiked: dbTrack.is_liked,
      thumbnailPath: dbTrack.thumbnail_path,
      sourceUrl: dbTrack.source_url,
      createdAt: dbTrack.created_at,
      updatedAt: dbTrack.updated_at
    };
  }

  // Convert database folder to frontend folder format
  private convertDbFolder(dbFolder: DatabaseFolder): Folder {
    return {
      id: dbFolder.id,
      name: dbFolder.name,
      parentId: dbFolder.parent_id,
      path: dbFolder.path,
      trackCount: dbFolder.track_count,
      createdAt: dbFolder.created_at,
      updatedAt: dbFolder.updated_at
    };
  }

  // Convert database playlist to frontend playlist format
  private convertDbPlaylist(dbPlaylist: DatabasePlaylist): Playlist {
    return {
      id: dbPlaylist.id,
      name: dbPlaylist.name,
      description: dbPlaylist.description,
      isPublic: dbPlaylist.is_public,
      tags: dbPlaylist.tags ? JSON.parse(dbPlaylist.tags) : [],
      trackIds: [], // Will be populated separately when needed
      trackCount: dbPlaylist.track_count,
      duration: dbPlaylist.duration,
      createdAt: dbPlaylist.created_at,
      updatedAt: dbPlaylist.updated_at
    };
  }

  // Track methods
  async createTrack(data: CreateTrackData): Promise<Track> {
    const dbTrack = await this.db.createTrack({
      title: data.title,
      artist: data.artist,
      album: data.album,
      duration: data.duration,
      genre: data.genre,
      year: data.year,
      file_path: data.filePath,
      file_name: data.fileName,
      original_name: data.originalName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      folder_id: data.folderId,
      is_liked: false,
      thumbnail_path: data.thumbnailPath,
      source_url: data.sourceUrl
    });

    return this.convertDbTrack(dbTrack);
  }

  async getTracks(params: GetTracksParams = {}): Promise<Track[]> {
    const dbTracks = await this.db.getTracks({
      folderId: params.folderId,
      search: params.search,
      genre: params.genre,
      sortBy: params.sortBy,
      limit: params.limit,
      offset: params.offset
    });

    return dbTracks.map(track => this.convertDbTrack(track));
  }

  async getTrackById(id: string): Promise<Track | null> {
    const dbTrack = await this.db.getTrackById(id);
    return dbTrack ? this.convertDbTrack(dbTrack) : null;
  }

  async deleteTrack(id: string): Promise<boolean> {
    const track = await this.getTrackById(id);
    if (!track) return false;

    // Delete physical file
    try {
      await fs.unlink(track.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    return await this.db.deleteTrack(id);
  }

  // Folder methods
  async createFolder(data: CreateFolderData): Promise<Folder> {
    const dbFolder = await this.db.createFolder({
      name: data.name,
      parent_id: data.parentId,
      path: this.buildFolderPath(data.parentId, data.name)
    });

    return this.convertDbFolder(dbFolder);
  }

  async getFolders(): Promise<Folder[]> {
    const dbFolders = await this.db.getFolders();
    return dbFolders.map(folder => this.convertDbFolder(folder));
  }

  async deleteFolder(id: string): Promise<boolean> {
    // Get all tracks in this folder to delete their files
    const tracks = await this.getTracks({ folderId: id });
    
    for (const track of tracks) {
      try {
        await fs.unlink(track.filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    return await this.db.deleteFolder(id);
  }

  // Playlist methods
  async createPlaylist(data: CreatePlaylistData): Promise<Playlist> {
    const dbPlaylist = await this.db.createPlaylist({
      name: data.name,
      description: data.description,
      is_public: data.isPublic,
      tags: JSON.stringify(data.tags)
    });

    return this.convertDbPlaylist(dbPlaylist);
  }

  async getPlaylists(): Promise<Playlist[]> {
    const dbPlaylists = await this.db.getPlaylists();
    return dbPlaylists.map(playlist => this.convertDbPlaylist(playlist));
  }

  async getPlaylistWithTracks(playlistId: string): Promise<{ playlist: Playlist; tracks: Track[] } | null> {
    const result = await this.db.getPlaylistWithTracks(playlistId);
    if (!result) return null;

    return {
      playlist: this.convertDbPlaylist(result.playlist),
      tracks: result.tracks.map(track => this.convertDbTrack(track))
    };
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    return await this.db.addTrackToPlaylist(playlistId, trackId);
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    return await this.db.removeTrackFromPlaylist(playlistId, trackId);
  }

  async deletePlaylist(id: string): Promise<boolean> {
    return await this.db.deletePlaylist(id);
  }

  // Utility methods
  async getGenres(): Promise<string[]> {
    return await this.db.getGenres();
  }

  async getStats(): Promise<{ totalTracks: number; totalFolders: number; totalPlaylists: number; totalDuration: number }> {
    return await this.db.getStats();
  }
}