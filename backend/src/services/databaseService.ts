import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';

export interface DatabaseTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre?: string;
  year?: number;
  file_path: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  folder_id?: string;
  is_liked: boolean;
  thumbnail_path?: string;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFolder {
  id: string;
  name: string;
  parent_id?: string;
  path: string;
  track_count: number;
  created_at: string;
  updated_at: string;
}

export interface DatabasePlaylist {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  tags: string; // JSON string
  track_count: number;
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface DatabasePlaylistTrack {
  id: string;
  playlist_id: string;
  track_id: string;
  position: number;
  created_at: string;
}

export interface DatabaseRFIDCard {
  id: string;
  card_id: string; // The actual RFID card ID
  name: string;
  description?: string;
  assignment_type?: 'track' | 'playlist' | 'album' | 'artist' | 'action';
  assignment_id?: string; // ID of the assigned track/playlist/album/artist
  action?: string; // For action cards (play_pause, next, previous, volume_up, volume_down)
  created_at: string;
  last_used?: string;
  usage_count: number;
  color?: string;
}

export class DatabaseService {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor() {
    const dbDir = path.join(process.cwd(), 'data');
    this.dbPath = path.join(dbDir, 'taptunes.db');
    this.initialize();
  }

  private async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      
      // Open database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables();
        }
      });
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  private createTables() {
    const tables = [
      // Folders table
      `CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        path TEXT NOT NULL,
        track_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
      )`,

      // Tracks table
      `CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        duration INTEGER NOT NULL,
        genre TEXT,
        year INTEGER,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        folder_id TEXT,
        is_liked BOOLEAN DEFAULT FALSE,
        thumbnail_path TEXT,
        source_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
      )`,

      // Playlists table
      `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        tags TEXT, -- JSON string array
        track_count INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Playlist tracks junction table
      `CREATE TABLE IF NOT EXISTS playlist_tracks (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE,
        UNIQUE(playlist_id, track_id)
      )`,

      // RFID cards table
      `CREATE TABLE IF NOT EXISTS rfid_cards (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        assignment_type TEXT,
        assignment_id TEXT,
        action TEXT,
        created_at TEXT NOT NULL,
        last_used TEXT,
        usage_count INTEGER DEFAULT 0,
        color TEXT
      )`
    ];

    tables.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
        }
      });
    });

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tracks_folder_id ON tracks (folder_id)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks (genre)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks (artist)',
      'CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks (playlist_id)',
      'CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks (track_id)',
      'CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id)'
    ];

    indexes.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error creating index:', err);
        }
      });
    });

    // Handle schema migrations for existing databases
    this.handleMigrations();
  }

  private handleMigrations() {
    // Add thumbnail_path and source_url columns if they don't exist
    const migrations = [
      'ALTER TABLE tracks ADD COLUMN thumbnail_path TEXT',
      'ALTER TABLE tracks ADD COLUMN source_url TEXT',
      'ALTER TABLE rfid_cards ADD COLUMN card_id TEXT',
      'ALTER TABLE rfid_cards ADD COLUMN assignment_type TEXT',
      'ALTER TABLE rfid_cards ADD COLUMN assignment_id TEXT'
    ];

    migrations.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Migration error:', err);
        }
      });
    });
  }

  // Helper method to run queries with promises
  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  private getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Track methods
  async createTrack(trackData: Omit<DatabaseTrack, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseTrack> {
    const now = new Date().toISOString();
    const track: DatabaseTrack = {
      id: this.generateId(),
      ...trackData,
      is_liked: trackData.is_liked || false,
      created_at: now,
      updated_at: now
    };

    const sql = `
      INSERT INTO tracks (
        id, title, artist, album, duration, genre, year,
        file_path, file_name, original_name, file_size, mime_type,
        folder_id, is_liked, thumbnail_path, source_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [
      track.id, track.title, track.artist, track.album, track.duration,
      track.genre, track.year, track.file_path, track.file_name,
      track.original_name, track.file_size, track.mime_type,
      track.folder_id, track.is_liked, track.thumbnail_path, track.source_url,
      track.created_at, track.updated_at
    ]);

    // Update folder track count
    if (track.folder_id) {
      await this.updateFolderTrackCount(track.folder_id);
    }

    return track;
  }

  async getTracks(filters: {
    folderId?: string;
    search?: string;
    genre?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<DatabaseTrack[]> {
    let sql = 'SELECT * FROM tracks WHERE 1=1';
    const params: any[] = [];

    if (filters.folderId) {
      sql += ' AND folder_id = ?';
      params.push(filters.folderId);
    }

    if (filters.search) {
      sql += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.genre && filters.genre !== 'all') {
      sql += ' AND genre LIKE ?';
      params.push(`%${filters.genre}%`);
    }

    // Add sorting
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'title':
          sql += ' ORDER BY title ASC';
          break;
        case 'artist':
          sql += ' ORDER BY artist ASC';
          break;
        case 'album':
          sql += ' ORDER BY album ASC';
          break;
        case 'year':
          sql += ' ORDER BY year DESC';
          break;
        case 'duration':
          sql += ' ORDER BY duration DESC';
          break;
        default:
          sql += ' ORDER BY created_at DESC';
      }
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    // Add pagination
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return await this.allQuery(sql, params);
  }

  async getTrackById(id: string): Promise<DatabaseTrack | null> {
    return await this.getQuery('SELECT * FROM tracks WHERE id = ?', [id]);
  }

  async updateTrack(id: string, updates: Partial<DatabaseTrack>): Promise<boolean> {
    const track = await this.getTrackById(id);
    if (!track) return false;

    console.log('🗄️ [DB] Original track title:', JSON.stringify(track.title));
    console.log('🗄️ [DB] Updates received:', updates);

    const updateFields = [];
    const updateValues = [];

    // Build dynamic update query
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        console.log(`🗄️ [DB] Adding update: ${key} = ${JSON.stringify(value)}`);
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) return true; // No updates needed

    // Add updated_at timestamp
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id); // Add id for WHERE clause

    const sql = `UPDATE tracks SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('🗄️ [DB] SQL:', sql);
    console.log('🗄️ [DB] Values:', updateValues);
    
    await this.runQuery(sql, updateValues);

    // Verify the update
    const updatedTrack = await this.getTrackById(id);
    console.log('🗄️ [DB] After update, title is:', JSON.stringify(updatedTrack?.title));

    // Update folder track counts if folder changed
    if (updates.folder_id !== undefined && updates.folder_id !== track.folder_id) {
      // Update old folder count
      if (track.folder_id) {
        await this.updateFolderTrackCount(track.folder_id);
      }
      // Update new folder count
      if (updates.folder_id) {
        await this.updateFolderTrackCount(updates.folder_id);
      }
    }

    return true;
  }

  async deleteTrack(id: string): Promise<boolean> {
    const track = await this.getTrackById(id);
    if (!track) return false;

    await this.runQuery('DELETE FROM tracks WHERE id = ?', [id]);

    // Update folder track count
    if (track.folder_id) {
      await this.updateFolderTrackCount(track.folder_id);
    }

    return true;
  }

  // Folder methods
  async createFolder(folderData: Omit<DatabaseFolder, 'id' | 'track_count' | 'created_at' | 'updated_at'>): Promise<DatabaseFolder> {
    const now = new Date().toISOString();
    const folder: DatabaseFolder = {
      id: this.generateId(),
      ...folderData,
      track_count: 0,
      created_at: now,
      updated_at: now
    };

    const sql = `
      INSERT INTO folders (id, name, parent_id, path, track_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [
      folder.id, folder.name, folder.parent_id, folder.path,
      folder.track_count, folder.created_at, folder.updated_at
    ]);

    return folder;
  }

  async getFolders(): Promise<DatabaseFolder[]> {
    return await this.allQuery('SELECT * FROM folders ORDER BY name ASC');
  }

  async deleteFolder(id: string): Promise<boolean> {
    // First delete all tracks in this folder
    await this.runQuery('DELETE FROM tracks WHERE folder_id = ?', [id]);
    
    // Then delete the folder
    const result = await this.runQuery('DELETE FROM folders WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private async updateFolderTrackCount(folderId: string): Promise<void> {
    const countResult = await this.getQuery(
      'SELECT COUNT(*) as count FROM tracks WHERE folder_id = ?',
      [folderId]
    );
    
    await this.runQuery(
      'UPDATE folders SET track_count = ?, updated_at = ? WHERE id = ?',
      [countResult.count, new Date().toISOString(), folderId]
    );
  }

  // Playlist methods
  async createPlaylist(playlistData: Omit<DatabasePlaylist, 'id' | 'track_count' | 'duration' | 'created_at' | 'updated_at'>): Promise<DatabasePlaylist> {
    const now = new Date().toISOString();
    const playlist: DatabasePlaylist = {
      id: this.generateId(),
      ...playlistData,
      track_count: 0,
      duration: 0,
      created_at: now,
      updated_at: now
    };

    const sql = `
      INSERT INTO playlists (id, name, description, is_public, tags, track_count, duration, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [
      playlist.id, playlist.name, playlist.description, playlist.is_public,
      playlist.tags, playlist.track_count, playlist.duration,
      playlist.created_at, playlist.updated_at
    ]);

    return playlist;
  }

  async getPlaylists(): Promise<DatabasePlaylist[]> {
    return await this.allQuery('SELECT * FROM playlists ORDER BY name ASC');
  }

  async getPlaylistWithTracks(playlistId: string): Promise<{ playlist: DatabasePlaylist; tracks: DatabaseTrack[] } | null> {
    const playlist = await this.getQuery('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) return null;

    const tracks = await this.allQuery(`
      SELECT t.* FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `, [playlistId]);

    return { playlist, tracks };
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    try {
      // Get next position
      const positionResult = await this.getQuery(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_tracks WHERE playlist_id = ?',
        [playlistId]
      );

      // Add track to playlist
      await this.runQuery(`
        INSERT INTO playlist_tracks (id, playlist_id, track_id, position, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        this.generateId(),
        playlistId,
        trackId,
        positionResult.next_position,
        new Date().toISOString()
      ]);

      // Update playlist stats
      await this.updatePlaylistStats(playlistId);
      return true;
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      return false;
    }
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    try {
      const result = await this.runQuery(
        'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
        [playlistId, trackId]
      );

      if (result.changes > 0) {
        await this.updatePlaylistStats(playlistId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      return false;
    }
  }

  async deletePlaylist(id: string): Promise<boolean> {
    const result = await this.runQuery('DELETE FROM playlists WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private async updatePlaylistStats(playlistId: string): Promise<void> {
    const stats = await this.getQuery(`
      SELECT 
        COUNT(*) as track_count,
        COALESCE(SUM(t.duration), 0) as total_duration
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
    `, [playlistId]);

    await this.runQuery(
      'UPDATE playlists SET track_count = ?, duration = ?, updated_at = ? WHERE id = ?',
      [stats.track_count, stats.total_duration, new Date().toISOString(), playlistId]
    );
  }

  // RFID Card methods
  async createRFIDCard(cardData: Omit<DatabaseRFIDCard, 'id' | 'usage_count' | 'created_at'>): Promise<DatabaseRFIDCard> {
    const now = new Date().toISOString();
    const card: DatabaseRFIDCard = {
      id: this.generateId(),
      ...cardData,
      usage_count: 0,
      created_at: now
    };

    const sql = `
      INSERT INTO rfid_cards (id, card_id, name, description, assignment_type, assignment_id, action, created_at, last_used, usage_count, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [
      card.id, card.card_id, card.name, card.description, card.assignment_type,
      card.assignment_id, card.action, card.created_at, card.last_used, card.usage_count, card.color
    ]);

    return card;
  }

  async getRFIDCardByCardId(cardId: string): Promise<DatabaseRFIDCard | null> {
    return await this.getQuery('SELECT * FROM rfid_cards WHERE card_id = ?', [cardId]);
  }

  async updateRFIDCard(id: string, updates: Partial<DatabaseRFIDCard>): Promise<boolean> {
    const updateFields = [];
    const updateValues = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) return true;

    updateValues.push(id);
    const sql = `UPDATE rfid_cards SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await this.runQuery(sql, updateValues);
    return true;
  }

  async getRFIDCards(): Promise<DatabaseRFIDCard[]> {
    return await this.allQuery('SELECT * FROM rfid_cards ORDER BY name ASC');
  }

  async updateRFIDCardUsage(id: string): Promise<void> {
    await this.runQuery(
      'UPDATE rfid_cards SET last_used = ?, usage_count = usage_count + 1 WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  async deleteRFIDCard(id: string): Promise<boolean> {
    const result = await this.runQuery('DELETE FROM rfid_cards WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Utility methods
  async getGenres(): Promise<string[]> {
    const tracks = await this.allQuery('SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL');
    const genres = new Set<string>();
    
    tracks.forEach(track => {
      if (track.genre) {
        track.genre.split(',').forEach((genre: string) => {
          genres.add(genre.trim());
        });
      }
    });

    return Array.from(genres).sort();
  }

  async getStats(): Promise<{
    totalTracks: number;
    totalFolders: number;
    totalPlaylists: number;
    totalDuration: number;
  }> {
    const [trackStats, folderCount, playlistCount] = await Promise.all([
      this.getQuery('SELECT COUNT(*) as count, COALESCE(SUM(duration), 0) as total_duration FROM tracks'),
      this.getQuery('SELECT COUNT(*) as count FROM folders'),
      this.getQuery('SELECT COUNT(*) as count FROM playlists')
    ]);

    return {
      totalTracks: trackStats.count,
      totalFolders: folderCount.count,
      totalPlaylists: playlistCount.count,
      totalDuration: trackStats.total_duration
    };
  }

  // Close database connection
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}