"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const databaseService_1 = require("./databaseService");
class MediaService {
    constructor() {
        this.db = new databaseService_1.DatabaseService();
    }
    buildFolderPath(parentId, name) {
        if (!parentId) {
            return `/music${name ? `/${name}` : ''}`;
        }
        // This is simplified - in a real implementation you'd build the full path
        return `/music/subfolder${name ? `/${name}` : ''}`;
    }
    // Convert database track to frontend track format
    convertDbTrack(dbTrack) {
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
    convertDbFolder(dbFolder) {
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
    convertDbPlaylist(dbPlaylist) {
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
    async createTrack(data) {
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
    async getTracks(params = {}) {
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
    async getTrackById(id) {
        const dbTrack = await this.db.getTrackById(id);
        return dbTrack ? this.convertDbTrack(dbTrack) : null;
    }
    async updateTrack(id, updates) {
        const track = await this.getTrackById(id);
        if (!track)
            return false;
        // Prepare database updates
        const dbUpdates = {};
        if (updates.title !== undefined)
            dbUpdates.title = updates.title;
        if (updates.artist !== undefined)
            dbUpdates.artist = updates.artist;
        if (updates.album !== undefined)
            dbUpdates.album = updates.album;
        if (updates.genre !== undefined)
            dbUpdates.genre = updates.genre;
        if (updates.year !== undefined)
            dbUpdates.year = updates.year;
        return await this.db.updateTrack(id, dbUpdates);
    }
    async moveTrackToFolder(id, folderId) {
        const track = await this.getTrackById(id);
        if (!track)
            return false;
        return await this.db.updateTrack(id, { folder_id: folderId });
    }
    async deleteTrack(id) {
        const track = await this.getTrackById(id);
        if (!track)
            return false;
        // Delete physical file
        try {
            await promises_1.default.unlink(track.filePath);
        }
        catch (error) {
            console.error('Error deleting file:', error);
        }
        return await this.db.deleteTrack(id);
    }
    // Folder methods
    async createFolder(data) {
        const dbFolder = await this.db.createFolder({
            name: data.name,
            parent_id: data.parentId,
            path: this.buildFolderPath(data.parentId, data.name)
        });
        return this.convertDbFolder(dbFolder);
    }
    async getFolders() {
        const dbFolders = await this.db.getFolders();
        return dbFolders.map(folder => this.convertDbFolder(folder));
    }
    async deleteFolder(id) {
        // Get all tracks in this folder to delete their files
        const tracks = await this.getTracks({ folderId: id });
        for (const track of tracks) {
            try {
                await promises_1.default.unlink(track.filePath);
            }
            catch (error) {
                console.error('Error deleting file:', error);
            }
        }
        return await this.db.deleteFolder(id);
    }
    // Playlist methods
    async createPlaylist(data) {
        const dbPlaylist = await this.db.createPlaylist({
            name: data.name,
            description: data.description,
            is_public: data.isPublic,
            tags: JSON.stringify(data.tags)
        });
        return this.convertDbPlaylist(dbPlaylist);
    }
    async getPlaylists() {
        const dbPlaylists = await this.db.getPlaylists();
        return dbPlaylists.map(playlist => this.convertDbPlaylist(playlist));
    }
    async getPlaylistWithTracks(playlistId) {
        const result = await this.db.getPlaylistWithTracks(playlistId);
        if (!result)
            return null;
        return {
            playlist: this.convertDbPlaylist(result.playlist),
            tracks: result.tracks.map(track => this.convertDbTrack(track))
        };
    }
    async addTrackToPlaylist(playlistId, trackId) {
        return await this.db.addTrackToPlaylist(playlistId, trackId);
    }
    async removeTrackFromPlaylist(playlistId, trackId) {
        return await this.db.removeTrackFromPlaylist(playlistId, trackId);
    }
    async updatePlaylist(id, updates) {
        // Convert frontend updates to database format
        const dbUpdates = {};
        if (updates.name !== undefined)
            dbUpdates.name = updates.name;
        if (updates.description !== undefined)
            dbUpdates.description = updates.description;
        if (updates.isPublic !== undefined)
            dbUpdates.is_public = updates.isPublic;
        if (updates.tags !== undefined)
            dbUpdates.tags = updates.tags;
        return await this.db.updatePlaylist(id, dbUpdates);
    }
    async deletePlaylist(id) {
        return await this.db.deletePlaylist(id);
    }
    // Utility methods
    async getGenres() {
        return await this.db.getGenres();
    }
    async getStats() {
        return await this.db.getStats();
    }
}
exports.MediaService = MediaService;
