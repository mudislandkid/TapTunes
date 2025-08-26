"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const databaseService_1 = require("../services/databaseService");
const mediaService_1 = require("../services/mediaService");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const databaseService = new databaseService_1.DatabaseService();
const mediaService = new mediaService_1.MediaService();
// Helper function to load settings
async function loadSettings() {
    try {
        const settingsPath = path_1.default.join(process.cwd(), 'data', 'settings.json');
        const data = await promises_1.default.readFile(settingsPath, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        // Return defaults if settings file doesn't exist
        return {
            rfidSameCardBehavior: 'pause',
            rfidCardDebounceMs: 500,
            rfidAutoPlayOnScan: true,
            rfidVolumeCards: true,
            rfidVolumeStep: 10
        };
    }
}
// Helper function to get current audio state
async function getCurrentAudioState() {
    try {
        const response = await axios_1.default.get('http://localhost:3001/api/audio/current');
        return response.data;
    }
    catch (error) {
        console.error('Error getting audio state:', error);
        return null;
    }
}
// Get all RFID cards
router.get('/cards', async (req, res) => {
    try {
        const cards = await databaseService.getRFIDCards();
        res.json({ cards });
    }
    catch (error) {
        console.error('Error fetching RFID cards:', error);
        res.status(500).json({ error: 'Failed to fetch RFID cards' });
    }
});
// Create or update an RFID card assignment
router.post('/cards', async (req, res) => {
    try {
        const { cardId, name, description, assignmentType, assignmentId, action, color } = req.body;
        if (!cardId) {
            return res.status(400).json({ error: 'Card ID is required' });
        }
        if (!name) {
            return res.status(400).json({ error: 'Card name is required' });
        }
        // Check if card already exists
        const existingCard = await databaseService.getRFIDCardByCardId(cardId);
        if (existingCard) {
            // Update existing card
            await databaseService.updateRFIDCard(existingCard.id, {
                name,
                description,
                assignment_type: assignmentType,
                assignment_id: assignmentId,
                action,
                color
            });
            const updatedCard = await databaseService.getRFIDCardByCardId(cardId);
            res.json(updatedCard);
        }
        else {
            // Create new card
            const newCard = await databaseService.createRFIDCard({
                card_id: cardId,
                name,
                description,
                assignment_type: assignmentType,
                assignment_id: assignmentId,
                action,
                color
            });
            res.json(newCard);
        }
    }
    catch (error) {
        console.error('Error creating/updating RFID card:', error);
        res.status(500).json({ error: 'Failed to create/update RFID card' });
    }
});
// Delete an RFID card
router.delete('/cards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await databaseService.deleteRFIDCard(id);
        if (success) {
            res.json({ success: true });
        }
        else {
            res.status(404).json({ error: 'Card not found' });
        }
    }
    catch (error) {
        console.error('Error deleting RFID card:', error);
        res.status(500).json({ error: 'Failed to delete RFID card' });
    }
});
// Handle RFID card scan
router.post('/scan', async (req, res) => {
    try {
        const { cardId } = req.body;
        console.log(`🎫 [RFID] Card scanned: ${cardId}`);
        const card = await databaseService.getRFIDCardByCardId(cardId);
        if (!card) {
            console.log(`❌ [RFID] Unknown card: ${cardId}`);
            return res.status(404).json({ error: 'Card not registered', cardId });
        }
        // Update card usage
        await databaseService.updateRFIDCardUsage(card.id);
        console.log(`🔍 [RFID] Card details:`, {
            id: card.id,
            card_id: card.card_id,
            name: card.name,
            assignment_type: card.assignment_type,
            assignment_id: card.assignment_id,
            action: card.action
        });
        // Handle different assignment types
        let action = null;
        let data = null;
        let playbackStarted = false;
        console.log(`🎯 [RFID] Processing assignment type: ${card.assignment_type}`);
        switch (card.assignment_type) {
            case 'track':
                console.log(`🎵 [RFID] Track case - assignment_id: ${card.assignment_id}`);
                if (card.assignment_id) {
                    console.log(`📀 [RFID] Looking up track by ID: ${card.assignment_id}`);
                    const track = await databaseService.getTrackById(card.assignment_id);
                    console.log(`🔍 [RFID] Track lookup result:`, track ? 'Found' : 'Not found');
                    if (track) {
                        action = 'play_track';
                        data = { track };
                        console.log(`🎵 [RFID] Playing track: ${track.title} - ${track.artist}`);
                        console.log(`🔍 [RFID] Track ID: ${track.id}`);
                        console.log(`📁 [RFID] File path: ${track.file_path}`);
                        // Actually start playback via audio API
                        console.log(`🌐 [RFID] Making HTTP request to play track...`);
                        try {
                            const response = await axios_1.default.post('http://localhost:3001/api/audio/play-track', {
                                trackId: track.id
                            });
                            playbackStarted = true;
                            console.log(`✅ [RFID] Successfully started track playback - Response:`, response.status, response.statusText);
                            console.log(`📤 [RFID] API Response:`, JSON.stringify(response.data, null, 2));
                        }
                        catch (error) {
                            console.error(`❌ [RFID] Failed to start track playback:`, error?.response?.status, error?.response?.statusText);
                            console.error(`❌ [RFID] Error details:`, error?.response?.data || error?.message);
                        }
                    }
                }
                break;
            case 'playlist':
                if (card.assignment_id) {
                    console.log(`📝 [RFID] Looking up playlist by ID: ${card.assignment_id}`);
                    const playlistData = await databaseService.getPlaylistWithTracks(card.assignment_id);
                    console.log(`📝 [RFID] Playlist data:`, playlistData);
                    if (playlistData && playlistData.tracks.length > 0) {
                        action = 'play_playlist';
                        data = { playlist: playlistData.playlist, tracks: playlistData.tracks };
                        console.log(`📝 [RFID] Playing playlist: ${playlistData.playlist.name} with ${playlistData.tracks.length} tracks`);
                        // Start playlist playback
                        try {
                            const playlistTracks = playlistData.tracks.map(t => ({
                                id: t.id,
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                duration: t.duration,
                                filePath: t.file_path
                            }));
                            console.log(`📝 [RFID] Sending playlist tracks to audio API:`, playlistTracks);
                            const response = await axios_1.default.post('http://localhost:3001/api/audio/play-playlist', {
                                tracks: playlistTracks,
                                startIndex: 0
                            });
                            playbackStarted = true;
                            console.log(`✅ [RFID] Successfully started playlist playback - Response:`, response.status, response.statusText);
                        }
                        catch (error) {
                            console.error(`❌ [RFID] Failed to start playlist playback:`, error.response?.data || error.message);
                        }
                    }
                    else {
                        console.log(`⚠️ [RFID] Playlist not found or has no tracks`);
                    }
                }
                else {
                    console.log(`⚠️ [RFID] No assignment_id for playlist card`);
                }
                break;
            case 'album':
                if (card.assignment_id) {
                    // Get all tracks from the album
                    const tracks = await databaseService.getTracks({
                        search: card.assignment_id
                    });
                    const albumTracks = tracks.filter(t => t.album === card.assignment_id);
                    if (albumTracks.length > 0) {
                        action = 'play_album';
                        data = { album: card.assignment_id, tracks: albumTracks };
                        console.log(`💿 [RFID] Playing album: ${card.assignment_id} (${albumTracks.length} tracks)`);
                        // Start album playback
                        try {
                            await axios_1.default.post('http://localhost:3001/api/audio/play-playlist', {
                                tracks: albumTracks.map(t => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    album: t.album,
                                    duration: t.duration,
                                    filePath: t.file_path
                                })),
                                startIndex: 0
                            });
                            playbackStarted = true;
                            console.log(`✅ [RFID] Successfully started album playback`);
                        }
                        catch (error) {
                            console.error(`❌ [RFID] Failed to start album playback:`, error);
                        }
                    }
                }
                break;
            case 'artist':
                if (card.assignment_id) {
                    // Get all tracks from the artist
                    const tracks = await databaseService.getTracks({
                        search: card.assignment_id
                    });
                    const artistTracks = tracks.filter(t => t.artist === card.assignment_id);
                    if (artistTracks.length > 0) {
                        action = 'play_artist';
                        data = { artist: card.assignment_id, tracks: artistTracks };
                        console.log(`🎤 [RFID] Playing artist: ${card.assignment_id} (${artistTracks.length} tracks)`);
                        // Start artist playback
                        try {
                            await axios_1.default.post('http://localhost:3001/api/audio/play-playlist', {
                                tracks: artistTracks.map(t => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    album: t.album,
                                    duration: t.duration,
                                    filePath: t.file_path
                                })),
                                startIndex: 0
                            });
                            playbackStarted = true;
                            console.log(`✅ [RFID] Successfully started artist playback`);
                        }
                        catch (error) {
                            console.error(`❌ [RFID] Failed to start artist playback:`, error);
                        }
                    }
                }
                break;
            case 'action':
                // Handle control actions
                action = card.action || 'unknown';
                console.log(`⚡ [RFID] Executing action: ${action}`);
                // Execute the control action
                try {
                    if (action === 'play_pause') {
                        // Get current state first
                        const currentState = await axios_1.default.get('http://localhost:3001/api/audio/current');
                        const isPlaying = currentState.data.isPlaying;
                        if (isPlaying) {
                            await axios_1.default.post('http://localhost:3001/api/audio/pause');
                            console.log(`⏸️ [RFID] Paused playback`);
                        }
                        else {
                            await axios_1.default.post('http://localhost:3001/api/audio/play');
                            console.log(`▶️ [RFID] Resumed playback`);
                        }
                        playbackStarted = true;
                    }
                    else if (action === 'stop') {
                        await axios_1.default.post('http://localhost:3001/api/audio/stop');
                        console.log(`⏹️ [RFID] Stopped playback`);
                        playbackStarted = true;
                    }
                    else if (action === 'next') {
                        await axios_1.default.post('http://localhost:3001/api/audio/next');
                        console.log(`⏭️ [RFID] Next track`);
                        playbackStarted = true;
                    }
                    else if (action === 'previous') {
                        await axios_1.default.post('http://localhost:3001/api/audio/previous');
                        console.log(`⏮️ [RFID] Previous track`);
                        playbackStarted = true;
                    }
                }
                catch (error) {
                    console.error(`❌ [RFID] Failed to execute action "${action}":`, error);
                }
                break;
            default:
                console.log(`⚠️ [RFID] Unknown assignment type: ${card.assignment_type}`);
                break;
        }
        console.log(`📋 [RFID] Processing completed - Action: ${action}, Playback started: ${playbackStarted}`);
        res.json({
            card,
            action,
            data,
            playbackStarted,
            message: `Card "${card.name}" scanned successfully${playbackStarted ? ' - playback started' : ''}`
        });
    }
    catch (error) {
        console.error('Error handling RFID scan:', error);
        res.status(500).json({ error: 'Failed to process RFID scan' });
    }
});
// Store for pending card reads
let pendingCardRead = null;
// Read card endpoint - waits for the next card scan from RFID service
router.post('/read', async (req, res) => {
    try {
        console.log(`📖 [RFID] Waiting for card scan...`);
        // Clear any existing pending read
        if (pendingCardRead) {
            clearTimeout(pendingCardRead.timeout);
            pendingCardRead.reject(new Error('New read request received'));
        }
        // Set up promise to wait for card scan
        const cardPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                pendingCardRead = null;
                reject(new Error('Card read timeout - no card detected in 30 seconds'));
            }, 30000); // 30 second timeout
            pendingCardRead = { resolve, reject, timeout };
        });
        try {
            const cardId = await cardPromise;
            console.log(`✅ [RFID] Card read successfully: ${cardId}`);
            res.json({
                cardId: cardId,
                message: 'Card read successfully. You can now assign this card.'
            });
        }
        catch (error) {
            console.log(`❌ [RFID] Card read failed: ${error.message}`);
            res.status(408).json({ error: error.message });
        }
    }
    catch (error) {
        console.error('Error in card read endpoint:', error);
        res.status(500).json({ error: 'Failed to read RFID card' });
    }
});
// Endpoint for RFID service to report card reads when in "read mode"
router.post('/card-detected', async (req, res) => {
    try {
        const { cardId } = req.body;
        if (pendingCardRead) {
            console.log(`📖 [RFID] Card detected for pending read: ${cardId}`);
            clearTimeout(pendingCardRead.timeout);
            pendingCardRead.resolve(cardId);
            pendingCardRead = null;
            res.json({ success: true, message: 'Card read completed' });
        }
        else {
            // No pending read, process as normal scan
            console.log(`🎫 [RFID] Card scanned (no pending read): ${cardId}`);
            const card = await databaseService.getRFIDCardByCardId(cardId);
            if (!card) {
                console.log(`❌ [RFID] Unknown card: ${cardId}`);
                return res.status(404).json({ error: 'Card not registered', cardId });
            }
            // Process the card scan (same logic as /scan endpoint)
            await databaseService.updateRFIDCardUsage(card.id);
            // Handle card action based on assignment type
            let action = null;
            let data = null;
            switch (card.assignment_type) {
                case 'track':
                    console.log(`🎵 [RFID] Track case - assignment_id: ${card.assignment_id}`);
                    if (card.assignment_id) {
                        console.log(`📀 [RFID] Looking up track by ID: ${card.assignment_id}`);
                        const track = await databaseService.getTrackById(card.assignment_id);
                        console.log(`🔍 [RFID] Track lookup result:`, track ? 'Found' : 'Not found');
                        if (track) {
                            action = 'play_track';
                            data = { track };
                            // Load settings and get current audio state
                            const settings = await loadSettings();
                            const audioState = await getCurrentAudioState();
                            console.log(`⚙️ [RFID] Card behavior setting: ${settings.rfidSameCardBehavior}`);
                            console.log(`🎵 [RFID] Current playing track ID: ${audioState?.currentTrack?.id || 'none'}`);
                            console.log(`🎵 [RFID] Scanned track ID: ${track.id}`);
                            console.log(`▶️ [RFID] Is currently playing: ${audioState?.isPlaying}`);
                            // Check if this track is already playing
                            const isSameTrack = audioState?.currentTrack?.id === track.id;
                            const isCurrentlyPlaying = audioState?.isPlaying;
                            if (isSameTrack && isCurrentlyPlaying) {
                                // Same track is playing - apply behavior setting
                                console.log(`🔄 [RFID] Same card tapped while playing - behavior: ${settings.rfidSameCardBehavior}`);
                                switch (settings.rfidSameCardBehavior) {
                                    case 'nothing':
                                        console.log(`⏸️ [RFID] Doing nothing (as configured)`);
                                        break;
                                    case 'pause':
                                        console.log(`⏸️ [RFID] Pausing playback`);
                                        try {
                                            await axios_1.default.post('http://localhost:3001/api/audio/pause');
                                            console.log(`✅ [RFID] Playback paused successfully`);
                                        }
                                        catch (error) {
                                            console.error(`❌ [RFID] Failed to pause playback:`, error?.message);
                                        }
                                        break;
                                    case 'stop':
                                        console.log(`⏹️ [RFID] Stopping playback`);
                                        try {
                                            await axios_1.default.post('http://localhost:3001/api/audio/stop');
                                            console.log(`✅ [RFID] Playback stopped successfully`);
                                        }
                                        catch (error) {
                                            console.error(`❌ [RFID] Failed to stop playback:`, error?.message);
                                        }
                                        break;
                                    case 'restart':
                                        console.log(`🔄 [RFID] Restarting track from beginning`);
                                        try {
                                            await axios_1.default.post('http://localhost:3001/api/audio/play-track', {
                                                trackId: track.id
                                            });
                                            console.log(`✅ [RFID] Track restarted successfully`);
                                        }
                                        catch (error) {
                                            console.error(`❌ [RFID] Failed to restart track:`, error?.message);
                                        }
                                        break;
                                }
                            }
                            else if (isSameTrack && !isCurrentlyPlaying) {
                                // Same track but paused - resume playback
                                console.log(`▶️ [RFID] Same card tapped while paused - resuming playback`);
                                try {
                                    await axios_1.default.post('http://localhost:3001/api/audio/play');
                                    console.log(`✅ [RFID] Playback resumed successfully`);
                                }
                                catch (error) {
                                    console.error(`❌ [RFID] Failed to resume playback:`, error?.message);
                                }
                            }
                            else {
                                // Different track or no track playing - start new playback
                                console.log(`🎵 [RFID] Playing track: ${track.title} - ${track.artist}`);
                                console.log(`🔍 [RFID] Track ID: ${track.id}`);
                                console.log(`📁 [RFID] File path: ${track.file_path}`);
                                console.log(`🌐 [RFID] Making HTTP request to play track...`);
                                try {
                                    const response = await axios_1.default.post('http://localhost:3001/api/audio/play-track', {
                                        trackId: track.id
                                    });
                                    console.log(`✅ [RFID] Successfully started track playback - Response:`, response.status, response.statusText);
                                    console.log(`📤 [RFID] API Response:`, JSON.stringify(response.data, null, 2));
                                }
                                catch (error) {
                                    console.error(`❌ [RFID] Failed to start track playback:`, error?.response?.status, error?.response?.statusText);
                                    console.error(`❌ [RFID] Error details:`, error?.response?.data || error?.message);
                                }
                            }
                        }
                    }
                    break;
                // ... other assignment types (same as scan endpoint)
            }
            res.json({
                card,
                action,
                data,
                message: `Card "${card.name}" scanned successfully`
            });
        }
    }
    catch (error) {
        console.error('Error handling card detection:', error);
        res.status(500).json({ error: 'Failed to process card detection' });
    }
});
// Get available albums for assignment
router.get('/albums', async (req, res) => {
    try {
        const tracks = await databaseService.getTracks();
        const albums = new Set();
        tracks.forEach(track => {
            if (track.album) {
                albums.add(track.album);
            }
        });
        const albumList = Array.from(albums).sort().map(album => ({
            id: album,
            name: album
        }));
        res.json({ albums: albumList });
    }
    catch (error) {
        console.error('Error fetching albums:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
});
// Get available artists for assignment
router.get('/artists', async (req, res) => {
    try {
        const tracks = await databaseService.getTracks();
        const artists = new Set();
        tracks.forEach(track => {
            if (track.artist) {
                artists.add(track.artist);
            }
        });
        const artistList = Array.from(artists).sort().map(artist => ({
            id: artist,
            name: artist
        }));
        res.json({ artists: artistList });
    }
    catch (error) {
        console.error('Error fetching artists:', error);
        res.status(500).json({ error: 'Failed to fetch artists' });
    }
});
exports.default = router;
