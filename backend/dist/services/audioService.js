"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class AudioService {
    constructor(audioDirectory = './audio') {
        this.playlists = new Map();
        this.audioDirectory = audioDirectory;
        this.createAudioDirectory();
        this.loadPlaylists();
    }
    createAudioDirectory() {
        if (!fs_1.default.existsSync(this.audioDirectory)) {
            fs_1.default.mkdirSync(this.audioDirectory, { recursive: true });
        }
    }
    loadPlaylists() {
        try {
            const playlistsFile = path_1.default.join(this.audioDirectory, 'playlists.json');
            if (fs_1.default.existsSync(playlistsFile)) {
                const data = fs_1.default.readFileSync(playlistsFile, 'utf8');
                const playlists = JSON.parse(data);
                playlists.forEach((playlist) => {
                    this.playlists.set(playlist.id, playlist);
                });
            }
        }
        catch (error) {
            console.error('Error loading playlists:', error);
        }
    }
    savePlaylists() {
        try {
            const playlistsFile = path_1.default.join(this.audioDirectory, 'playlists.json');
            const playlists = Array.from(this.playlists.values());
            fs_1.default.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
        }
        catch (error) {
            console.error('Error saving playlists:', error);
        }
    }
    getAllPlaylists() {
        return Array.from(this.playlists.values());
    }
    getPlaylist(id) {
        return this.playlists.get(id);
    }
    createPlaylist(name, tracks = []) {
        const playlist = {
            id: Date.now().toString(),
            name,
            tracks
        };
        this.playlists.set(playlist.id, playlist);
        this.savePlaylists();
        return playlist;
    }
    addTrackToPlaylist(playlistId, track) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist)
            return false;
        playlist.tracks.push(track);
        this.savePlaylists();
        return true;
    }
    removeTrackFromPlaylist(playlistId, trackId) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist)
            return false;
        playlist.tracks = playlist.tracks.filter(track => track.id !== trackId);
        this.savePlaylists();
        return true;
    }
    deletePlaylist(id) {
        const deleted = this.playlists.delete(id);
        if (deleted) {
            this.savePlaylists();
        }
        return deleted;
    }
    scanAudioFiles() {
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
        const tracks = [];
        const scanDirectory = (dir) => {
            try {
                const items = fs_1.default.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path_1.default.join(dir, item);
                    const stat = fs_1.default.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scanDirectory(fullPath);
                    }
                    else if (audioExtensions.includes(path_1.default.extname(item).toLowerCase())) {
                        const track = {
                            id: Buffer.from(fullPath).toString('base64'),
                            title: path_1.default.basename(item, path_1.default.extname(item)),
                            file_path: fullPath
                        };
                        tracks.push(track);
                    }
                }
            }
            catch (error) {
                console.error(`Error scanning directory ${dir}:`, error);
            }
        };
        scanDirectory(this.audioDirectory);
        return tracks;
    }
    getAudioFilePath(trackId) {
        try {
            const filePath = Buffer.from(trackId, 'base64').toString();
            if (fs_1.default.existsSync(filePath)) {
                return filePath;
            }
        }
        catch (error) {
            console.error('Error decoding track ID:', error);
        }
        return null;
    }
}
exports.default = AudioService;
