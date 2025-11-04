"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const databaseService_1 = require("../services/databaseService");
const router = express_1.default.Router();
const dbService = new databaseService_1.DatabaseService();
// Get all audiobooks
router.get('/', async (req, res) => {
    try {
        const audiobooks = await dbService.getAudiobooks();
        res.json(audiobooks);
    }
    catch (error) {
        console.error('Error fetching audiobooks:', error);
        res.status(500).json({ error: 'Failed to fetch audiobooks' });
    }
});
// Get audiobook with tracks
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const audiobookWithTracks = await dbService.getAudiobookWithTracks(id);
        if (!audiobookWithTracks) {
            return res.status(404).json({ error: 'Audiobook not found' });
        }
        res.json(audiobookWithTracks);
    }
    catch (error) {
        console.error('Error fetching audiobook:', error);
        res.status(500).json({ error: 'Failed to fetch audiobook' });
    }
});
// Create new audiobook
router.post('/', async (req, res) => {
    try {
        const { title, author, description, album_art_path } = req.body;
        if (!title || !author) {
            return res.status(400).json({ error: 'Title and author are required' });
        }
        const audiobook = await dbService.createAudiobook({
            title,
            author,
            description,
            album_art_path
        });
        res.status(201).json(audiobook);
    }
    catch (error) {
        console.error('Error creating audiobook:', error);
        res.status(500).json({ error: 'Failed to create audiobook' });
    }
});
// Update audiobook
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const success = await dbService.updateAudiobook(id, updates);
        if (!success) {
            return res.status(404).json({ error: 'Audiobook not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating audiobook:', error);
        res.status(500).json({ error: 'Failed to update audiobook' });
    }
});
// Delete audiobook
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await dbService.deleteAudiobook(id);
        if (!success) {
            return res.status(404).json({ error: 'Audiobook not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting audiobook:', error);
        res.status(500).json({ error: 'Failed to delete audiobook' });
    }
});
// Add track to audiobook
router.post('/:id/tracks', async (req, res) => {
    try {
        const { id } = req.params;
        const { trackId } = req.body;
        if (!trackId) {
            return res.status(400).json({ error: 'Track ID is required' });
        }
        const success = await dbService.addTrackToAudiobook(id, trackId);
        if (!success) {
            return res.status(400).json({ error: 'Failed to add track to audiobook' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error adding track to audiobook:', error);
        res.status(500).json({ error: 'Failed to add track to audiobook' });
    }
});
// Remove track from audiobook
router.delete('/:id/tracks/:trackId', async (req, res) => {
    try {
        const { id, trackId } = req.params;
        const success = await dbService.removeTrackFromAudiobook(id, trackId);
        if (!success) {
            return res.status(404).json({ error: 'Track not found in audiobook' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error removing track from audiobook:', error);
        res.status(500).json({ error: 'Failed to remove track from audiobook' });
    }
});
// Reorder audiobook tracks
router.put('/:id/reorder', async (req, res) => {
    try {
        const { id } = req.params;
        const { trackIds } = req.body;
        if (!Array.isArray(trackIds)) {
            return res.status(400).json({ error: 'trackIds must be an array' });
        }
        const success = await dbService.reorderAudiobookTracks(id, trackIds);
        if (!success) {
            return res.status(400).json({ error: 'Failed to reorder tracks' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error reordering audiobook tracks:', error);
        res.status(500).json({ error: 'Failed to reorder tracks' });
    }
});
// Search for audiobook metadata
router.post('/:id/search-metadata', async (req, res) => {
    try {
        const { id } = req.params;
        // Get audiobook to use its title and author for search
        const audiobookData = await dbService.getAudiobookWithTracks(id);
        if (!audiobookData) {
            return res.status(404).json({ error: 'Audiobook not found' });
        }
        const { audiobook } = audiobookData;
        // Import metadata service dynamically
        const { MetadataService } = await Promise.resolve().then(() => __importStar(require('../services/metadataService')));
        const metadataService = new MetadataService();
        console.log(`📚 [AUDIOBOOK] Searching metadata for: "${audiobook.title}" by ${audiobook.author}`);
        // Search using title as query (audiobooks are often listed by title)
        const results = await metadataService.lookupTrackMetadata(audiobook.author, audiobook.title, '' // no album for audiobooks
        );
        res.json({ results });
    }
    catch (error) {
        console.error('Error searching audiobook metadata:', error);
        res.status(500).json({
            error: 'Failed to search metadata',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Apply metadata to audiobook (mainly for album art)
router.post('/:id/apply-metadata', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, author, description, musicBrainzId } = req.body;
        console.log(`📚 [AUDIOBOOK] Applying metadata to audiobook: ${id}`);
        let albumArtPath;
        // Download album art if musicBrainzId provided
        if (musicBrainzId) {
            const { MetadataService } = await Promise.resolve().then(() => __importStar(require('../services/metadataService')));
            const metadataService = new MetadataService();
            albumArtPath = await metadataService.downloadAlbumArt(musicBrainzId, id);
            console.log(`🎨 [AUDIOBOOK] Album art downloaded: ${albumArtPath}`);
        }
        // Update audiobook with new metadata
        const updates = {};
        if (title)
            updates.title = title;
        if (author)
            updates.author = author;
        if (description)
            updates.description = description;
        if (albumArtPath)
            updates.album_art_path = albumArtPath;
        const success = await dbService.updateAudiobook(id, updates);
        if (!success) {
            return res.status(404).json({ error: 'Audiobook not found' });
        }
        res.json({ success: true, albumArtPath });
    }
    catch (error) {
        console.error('Error applying audiobook metadata:', error);
        res.status(500).json({
            error: 'Failed to apply metadata',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
