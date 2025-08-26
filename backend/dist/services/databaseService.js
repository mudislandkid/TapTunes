"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class DatabaseService {
    constructor() {
        const dbDir = path_1.default.join(process.cwd(), 'data');
        this.dbPath = path_1.default.join(dbDir, 'taptunes.db');
        this.initialize();
    }
    async initialize() {
        try {
            // Ensure data directory exists
            await promises_1.default.mkdir(path_1.default.dirname(this.dbPath), { recursive: true });
            // Open database connection
            this.db = new sqlite3_1.default.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                }
                else {
                    console.log('Connected to SQLite database');
                    this.createTables();
                }
            });
        }
        catch (error) {
            console.error('Error initializing database:', error);
        }
    }
    createTables() {
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
    handleMigrations() {
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
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }
    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    // Track methods
    async createTrack(trackData) {
        const now = new Date().toISOString();
        const track = {
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
    async getTracks(filters = {}) {
        let sql = 'SELECT * FROM tracks WHERE 1=1';
        const params = [];
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
        }
        else {
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
    async getTrackById(id) {
        return await this.getQuery('SELECT * FROM tracks WHERE id = ?', [id]);
    }
    async updateTrack(id, updates) {
        const track = await this.getTrackById(id);
        if (!track)
            return false;
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
        if (updateFields.length === 0)
            return true; // No updates needed
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
    async deleteTrack(id) {
        const track = await this.getTrackById(id);
        if (!track)
            return false;
        await this.runQuery('DELETE FROM tracks WHERE id = ?', [id]);
        // Update folder track count
        if (track.folder_id) {
            await this.updateFolderTrackCount(track.folder_id);
        }
        return true;
    }
    // Folder methods
    async createFolder(folderData) {
        const now = new Date().toISOString();
        const folder = {
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
    async getFolders() {
        return await this.allQuery('SELECT * FROM folders ORDER BY name ASC');
    }
    async deleteFolder(id) {
        // First delete all tracks in this folder
        await this.runQuery('DELETE FROM tracks WHERE folder_id = ?', [id]);
        // Then delete the folder
        const result = await this.runQuery('DELETE FROM folders WHERE id = ?', [id]);
        return result.changes > 0;
    }
    async updateFolderTrackCount(folderId) {
        const countResult = await this.getQuery('SELECT COUNT(*) as count FROM tracks WHERE folder_id = ?', [folderId]);
        await this.runQuery('UPDATE folders SET track_count = ?, updated_at = ? WHERE id = ?', [countResult.count, new Date().toISOString(), folderId]);
    }
    // Playlist methods
    async createPlaylist(playlistData) {
        const now = new Date().toISOString();
        const playlist = {
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
    async getPlaylists() {
        return await this.allQuery('SELECT * FROM playlists ORDER BY name ASC');
    }
    async getPlaylistWithTracks(playlistId) {
        const playlist = await this.getQuery('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        if (!playlist)
            return null;
        const tracks = await this.allQuery(`
      SELECT t.* FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `, [playlistId]);
        return { playlist, tracks };
    }
    async addTrackToPlaylist(playlistId, trackId) {
        try {
            // Get next position
            const positionResult = await this.getQuery('SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
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
        }
        catch (error) {
            console.error('Error adding track to playlist:', error);
            return false;
        }
    }
    async removeTrackFromPlaylist(playlistId, trackId) {
        try {
            const result = await this.runQuery('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
            if (result.changes > 0) {
                await this.updatePlaylistStats(playlistId);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error removing track from playlist:', error);
            return false;
        }
    }
    async updatePlaylist(id, updates) {
        const updateFields = [];
        const updateValues = [];
        // Build dynamic update query
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && key !== 'id' && key !== 'created_at') {
                updateFields.push(`${key} = ?`);
                updateValues.push(value);
            }
        }
        if (updateFields.length === 0)
            return true; // No updates needed
        // Add updated_at timestamp
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(id); // Add id for WHERE clause
        const sql = `UPDATE playlists SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await this.runQuery(sql, updateValues);
        return result.changes > 0;
    }
    async deletePlaylist(id) {
        const result = await this.runQuery('DELETE FROM playlists WHERE id = ?', [id]);
        return result.changes > 0;
    }
    async updatePlaylistStats(playlistId) {
        const stats = await this.getQuery(`
      SELECT 
        COUNT(*) as track_count,
        COALESCE(SUM(t.duration), 0) as total_duration
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
    `, [playlistId]);
        await this.runQuery('UPDATE playlists SET track_count = ?, duration = ?, updated_at = ? WHERE id = ?', [stats.track_count, stats.total_duration, new Date().toISOString(), playlistId]);
    }
    // RFID Card methods
    async createRFIDCard(cardData) {
        const now = new Date().toISOString();
        const card = {
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
    async getRFIDCardByCardId(cardId) {
        return await this.getQuery('SELECT * FROM rfid_cards WHERE card_id = ?', [cardId]);
    }
    async updateRFIDCard(id, updates) {
        const updateFields = [];
        const updateValues = [];
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && key !== 'id' && key !== 'created_at') {
                updateFields.push(`${key} = ?`);
                updateValues.push(value);
            }
        }
        if (updateFields.length === 0)
            return true;
        updateValues.push(id);
        const sql = `UPDATE rfid_cards SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.runQuery(sql, updateValues);
        return true;
    }
    async getRFIDCards() {
        return await this.allQuery('SELECT * FROM rfid_cards ORDER BY name ASC');
    }
    async updateRFIDCardUsage(id) {
        await this.runQuery('UPDATE rfid_cards SET last_used = ?, usage_count = usage_count + 1 WHERE id = ?', [new Date().toISOString(), id]);
    }
    async deleteRFIDCard(id) {
        const result = await this.runQuery('DELETE FROM rfid_cards WHERE id = ?', [id]);
        return result.changes > 0;
    }
    // Utility methods
    async getGenres() {
        const tracks = await this.allQuery('SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL');
        const genres = new Set();
        tracks.forEach(track => {
            if (track.genre) {
                track.genre.split(',').forEach((genre) => {
                    genres.add(genre.trim());
                });
            }
        });
        return Array.from(genres).sort();
    }
    async getStats() {
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
    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
}
exports.DatabaseService = DatabaseService;
