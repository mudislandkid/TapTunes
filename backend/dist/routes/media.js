"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const mediaService_1 = require("../services/mediaService");
const metadataService_1 = require("../services/metadataService");
// Music-metadata loader (v7.x has CommonJS support)
let parseFile;
function ensureMusicMetadata() {
    if (!parseFile) {
        try {
            const mm = require('music-metadata');
            parseFile = mm.parseFile;
            console.log('✅ [METADATA] music-metadata loaded successfully');
        }
        catch (error) {
            console.error('❌ [METADATA] Failed to load music-metadata:', error.message);
            parseFile = null;
        }
    }
    return parseFile;
}
const router = express_1.default.Router();
const mediaService = new mediaService_1.MediaService();
const metadataService = new metadataService_1.MetadataService();
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Helper function to parse common filename patterns
function parseFilename(filename) {
    // Remove file extension
    const nameWithoutExt = path_1.default.basename(filename, path_1.default.extname(filename));
    // Common patterns:
    // "Artist - Title"
    // "Artist-Title"
    // "01 Artist - Title"
    // "01. Artist - Title"
    // Try to match "Artist - Title" pattern (most common)
    const dashPattern = /^(?:\d+\.?\s*)?(.+?)\s*[-–—]\s*(.+)$/;
    const match = nameWithoutExt.match(dashPattern);
    if (match) {
        const [, possibleArtist, possibleTitle] = match;
        // If the artist part looks reasonable (not too long), use it
        if (possibleArtist.length < 50 && possibleTitle.length > 0) {
            return {
                artist: possibleArtist.trim(),
                title: possibleTitle.trim()
            };
        }
    }
    // No pattern matched, return the whole filename as title
    return { title: nameWithoutExt };
}
// Helper to find yt-dlp binary (prefer venv version)
function getYtDlpPath() {
    const installDir = process.env.TAPTUNES_INSTALL_DIR || '/home/greg/taptunes';
    const venvYtDlp = path_1.default.join(installDir, 'venv', 'bin', 'yt-dlp');
    // Check if venv version exists (synchronously, only once at startup)
    try {
        require('fs').accessSync(venvYtDlp, require('fs').constants.X_OK);
        console.log(`✅ [YOUTUBE] Using venv yt-dlp: ${venvYtDlp}`);
        return venvYtDlp;
    }
    catch {
        console.log('⚠️ [YOUTUBE] Using system yt-dlp (venv version not found)');
        return 'yt-dlp'; // Fall back to system PATH
    }
}
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path_1.default.join(process.cwd(), 'uploads');
        try {
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        }
        catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path_1.default.extname(file.originalname);
        const baseName = path_1.default.basename(file.originalname, extension);
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});
const fileFilter = (req, file, cb) => {
    // Accept only audio files
    const allowedMimes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/flac',
        'audio/m4a',
        'audio/ogg',
        'audio/x-m4a'
    ];
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    const extension = path_1.default.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Invalid file type. Supported formats: ${allowedExtensions.join(', ')}`), false);
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
    },
});
// Upload multiple files
router.post('/upload', upload.fields([
    { name: 'files', maxCount: 10 }
]), async (req, res) => {
    try {
        console.log('📤 [UPLOAD] Upload request received');
        console.log('📋 [UPLOAD] Request body:', req.body);
        // With upload.fields(), files are in req.files as an object
        const files = req.files && 'files' in req.files ? req.files['files'] : null;
        console.log('📁 [UPLOAD] Files count:', files ? files.length : 'No files');
        if (!files || !Array.isArray(files)) {
            console.error('❌ [UPLOAD] No files in request');
            return res.status(400).json({ error: 'No files uploaded' });
        }
        // Handle destination parameters
        let folderId = req.body.folderId || null;
        const folderName = req.body.folderName;
        const albumName = req.body.albumName;
        const playlistId = req.body.playlistId;
        const playlistName = req.body.playlistName;
        // Create folder if folderName provided
        if (folderName) {
            console.log(`📁 [UPLOAD] Creating new folder: ${folderName}`);
            try {
                const newFolder = await mediaService.createFolder({ name: folderName });
                folderId = newFolder.id;
                console.log(`✅ [UPLOAD] Folder created with ID: ${folderId}`);
            }
            catch (error) {
                console.error('❌ [UPLOAD] Failed to create folder:', error);
                return res.status(500).json({ error: 'Failed to create folder' });
            }
        }
        // Create playlist if playlistName provided
        let targetPlaylistId = playlistId;
        if (playlistName) {
            console.log(`🎵 [UPLOAD] Creating new playlist: ${playlistName}`);
            try {
                const newPlaylist = await mediaService.createPlaylist({
                    name: playlistName,
                    isPublic: false,
                    tags: []
                });
                targetPlaylistId = newPlaylist.id;
                console.log(`✅ [UPLOAD] Playlist created with ID: ${targetPlaylistId}`);
            }
            catch (error) {
                console.error('❌ [UPLOAD] Failed to create playlist:', error);
                // Continue with upload even if playlist creation fails
            }
        }
        const uploadResults = [];
        const uploadedTrackIds = [];
        console.log(`🎵 [UPLOAD] Processing ${files.length} files, folderId: ${folderId || 'root'}`);
        for (const file of files) {
            try {
                console.log(`\n📝 [UPLOAD] Processing file: ${file.originalname}`);
                console.log(`   Size: ${file.size} bytes`);
                console.log(`   Path: ${file.path}`);
                console.log(`   MIME: ${file.mimetype}`);
                // Extract metadata from audio file
                let metadata;
                try {
                    const parser = ensureMusicMetadata();
                    if (parser) {
                        metadata = await parser(file.path);
                        console.log(`🎵 [UPLOAD] Extracted metadata for ${file.originalname}:`, {
                            title: metadata.common.title,
                            artist: metadata.common.artist,
                            duration: metadata.format.duration
                        });
                    }
                    else {
                        throw new Error('Parser not available');
                    }
                }
                catch (metadataError) {
                    console.error(`❌ [UPLOAD] Failed to extract metadata from ${file.originalname}:`, metadataError);
                    metadata = {
                        common: {},
                        format: { duration: 0 }
                    };
                }
                const extractedDuration = Math.round(metadata.format.duration || 0);
                console.log(`⏱️ [UPLOAD] Duration for ${file.originalname}: ${extractedDuration} seconds`);
                // Parse filename if metadata is missing
                const parsedFilename = parseFilename(file.originalname);
                // Prefer metadata, fall back to parsed filename
                const trackTitle = metadata.common.title || parsedFilename.title;
                const trackArtist = metadata.common.artist || parsedFilename.artist || 'Unknown Artist';
                console.log(`📝 [UPLOAD] Track info - Title: "${trackTitle}", Artist: "${trackArtist}"`);
                // Create track record with optional album override
                console.log(`💾 [UPLOAD] Creating track record in database...`);
                const track = await mediaService.createTrack({
                    title: trackTitle,
                    artist: trackArtist,
                    album: albumName || metadata.common.album || 'Unknown Album', // Use albumName if provided
                    duration: extractedDuration,
                    genre: metadata.common.genre?.join(', ') || undefined,
                    year: metadata.common.year || undefined,
                    filePath: file.path,
                    fileName: file.filename,
                    originalName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    folderId
                });
                console.log(`✅ [UPLOAD] Track created successfully: ${track.id}`);
                // Store track ID for playlist association
                uploadedTrackIds.push(track.id);
                uploadResults.push({
                    success: true,
                    track,
                    fileName: file.originalname
                });
            }
            catch (error) {
                console.error(`❌ [UPLOAD] Error processing file ${file.originalname}:`, error);
                console.error(`   Error details:`, {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Clean up file if processing failed
                try {
                    await promises_1.default.unlink(file.path);
                }
                catch (unlinkError) {
                    console.error('Error removing failed file:', unlinkError);
                }
                uploadResults.push({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to process file',
                    fileName: file.originalname
                });
            }
        }
        const successCount = uploadResults.filter(r => r.success).length;
        const errorCount = uploadResults.filter(r => !r.success).length;
        console.log(`\n✅ [UPLOAD] Upload completed: ${successCount} succeeded, ${errorCount} failed`);
        // Add uploaded tracks to playlist if specified
        if (targetPlaylistId && uploadedTrackIds.length > 0) {
            console.log(`🎵 [UPLOAD] Adding ${uploadedTrackIds.length} tracks to playlist ${targetPlaylistId}`);
            try {
                for (const trackId of uploadedTrackIds) {
                    await mediaService.addTrackToPlaylist(targetPlaylistId, trackId);
                }
                console.log(`✅ [UPLOAD] All tracks added to playlist successfully`);
            }
            catch (error) {
                console.error('❌ [UPLOAD] Failed to add tracks to playlist:', error);
                // Don't fail the entire upload if playlist association fails
            }
        }
        res.json({
            message: 'Upload completed',
            results: uploadResults,
            totalFiles: files.length,
            successCount,
            errorCount,
            folderId,
            playlistId: targetPlaylistId
        });
    }
    catch (error) {
        console.error('❌ [UPLOAD] Fatal upload error:', error);
        console.error('   Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        res.status(500).json({
            error: 'Upload failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Download audio from YouTube URL
// Store for SSE clients
const youtubeDownloadClients = new Map();
// SSE endpoint for YouTube download progress
router.get('/download-youtube/progress/:downloadId', (req, res) => {
    const { downloadId } = req.params;
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    // Store client for this download
    const clientData = {
        res,
        lastUpdate: Date.now()
    };
    youtubeDownloadClients.set(downloadId, clientData);
    console.log(`📡 [YOUTUBE SSE] Client connected for download ${downloadId}`);
    // Handle client disconnect
    req.on('close', () => {
        youtubeDownloadClients.delete(downloadId);
        console.log(`📡 [YOUTUBE SSE] Client disconnected for download ${downloadId}`);
    });
});
// Helper to send SSE update
function sendProgress(downloadId, data) {
    const client = youtubeDownloadClients.get(downloadId);
    if (client) {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        client.lastUpdate = Date.now();
    }
}
router.post('/download-youtube', async (req, res) => {
    const downloadId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    try {
        const { url, folderId } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        console.log(`🎬 [YOUTUBE] Starting download ${downloadId} from: ${url}`);
        // Send initial response with download ID
        res.json({
            success: true,
            downloadId,
            message: 'Download started'
        });
        // Continue download in background
        (async () => {
            try {
                sendProgress(downloadId, {
                    status: 'initializing',
                    message: 'Preparing download...',
                    progress: 0
                });
                // Create upload directory if it doesn't exist
                const uploadDir = path_1.default.join(process.cwd(), 'uploads');
                await promises_1.default.mkdir(uploadDir, { recursive: true });
                // Generate unique filename prefix
                const uniqueSuffix = downloadId.toString();
                const outputTemplate = path_1.default.join(uploadDir, `youtube-${uniqueSuffix}.%(ext)s`);
                // Download audio and thumbnail using yt-dlp
                const ytDlpArgs = [
                    '--extract-audio',
                    '--audio-format', 'mp3',
                    '--audio-quality', '5', // Good quality (192kbps) - faster encoding on Pi Zero W
                    '--write-thumbnail',
                    '--write-info-json',
                    '--no-playlist',
                    '--newline', // Progress on new lines
                    // Fast encoding for Pi Zero W - use audio copy when possible
                    '--postprocessor-args', 'ffmpeg:-codec:a libmp3lame -q:a 4',
                    // Retry and timeout settings
                    '--retries', '5',
                    '--fragment-retries', '5',
                    '--skip-unavailable-fragments',
                    // Force IPv4 (some networks have IPv6 issues)
                    '-4',
                    '--output', outputTemplate,
                    url
                ];
                console.log(`🔧 [YOUTUBE] Running yt-dlp with args:`, ytDlpArgs);
                sendProgress(downloadId, {
                    status: 'fetching',
                    message: 'Fetching video information...',
                    progress: 5
                });
                const { spawn } = require('child_process');
                const ytDlpPath = getYtDlpPath();
                // Log yt-dlp version for debugging
                try {
                    const { stdout: versionOutput } = await execAsync(`${ytDlpPath} --version`);
                    console.log(`📹 [YOUTUBE] yt-dlp version: ${versionOutput.trim()}`);
                }
                catch (err) {
                    console.warn('⚠️ [YOUTUBE] Could not get yt-dlp version:', err);
                }
                const ytDlpProcess = spawn(ytDlpPath, ytDlpArgs, {
                    stdio: 'pipe'
                });
                let stdout = '';
                let stderr = '';
                let videoTitle = '';
                let lastOutputTime = Date.now();
                let lastProgressData = { status: 'initializing', progress: 0, message: 'Starting...' };
                ytDlpProcess.stdout.on('data', (data) => {
                    lastOutputTime = Date.now(); // Track output for keepalive
                    const output = data.toString();
                    stdout += output;
                    // Parse progress from yt-dlp output
                    const lines = output.split('\n');
                    for (const line of lines) {
                        console.log('📹 [YOUTUBE]:', line.trim());
                        // Extract video title
                        if (line.includes('[youtube]') && line.includes(':')) {
                            const titleMatch = line.match(/\[youtube\]\s+[^:]+:\s+(.+)/);
                            if (titleMatch && !videoTitle) {
                                videoTitle = titleMatch[1].trim();
                                lastProgressData = {
                                    status: 'fetching',
                                    message: `Found: ${videoTitle}`,
                                    progress: 10
                                };
                                sendProgress(downloadId, {
                                    ...lastProgressData,
                                    videoTitle
                                });
                            }
                        }
                        // Extract download progress
                        if (line.includes('[download]') && line.includes('%')) {
                            const progressMatch = line.match(/(\d+\.?\d*)%/);
                            if (progressMatch) {
                                const downloadProgress = parseFloat(progressMatch[1]);
                                lastProgressData = {
                                    status: 'downloading',
                                    message: `Downloading... ${downloadProgress.toFixed(1)}%`,
                                    progress: 10 + (downloadProgress * 0.6) // 10-70%
                                };
                                sendProgress(downloadId, {
                                    ...lastProgressData,
                                    videoTitle: videoTitle || 'Video'
                                });
                            }
                        }
                        // Post-processing started
                        if (line.includes('[ExtractAudio]')) {
                            lastProgressData = {
                                status: 'processing',
                                message: 'Converting to MP3...',
                                progress: 75
                            };
                            sendProgress(downloadId, {
                                ...lastProgressData,
                                videoTitle
                            });
                        }
                    }
                });
                ytDlpProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    console.log('📹 [YOUTUBE stderr]:', output.trim());
                });
                await new Promise((resolve, reject) => {
                    // Set a timeout for the download process
                    // Pi Zero W is slow, needs time for download + conversion
                    const timeout = setTimeout(() => {
                        ytDlpProcess.kill();
                        sendProgress(downloadId, {
                            status: 'error',
                            message: 'Download timeout - process took too long',
                            progress: 0,
                            error: 'Timeout after 10 minutes'
                        });
                        reject(new Error('Download timeout - process took too long'));
                    }, 600000); // 10 minutes timeout (Pi Zero W is slow!)
                    // Send keepalive messages every 30 seconds to prevent SSE/nginx timeout
                    // This is important during the MP3 conversion phase when yt-dlp is silent
                    const keepaliveInterval = setInterval(() => {
                        // Only send keepalive if no output for 20+ seconds
                        if (Date.now() - lastOutputTime > 20000) {
                            sendProgress(downloadId, {
                                status: lastProgressData.status || 'processing',
                                message: lastProgressData.status === 'downloading'
                                    ? 'Still downloading...'
                                    : 'Converting to MP3...',
                                progress: lastProgressData.progress,
                                videoTitle
                            });
                        }
                    }, 30000);
                    ytDlpProcess.on('close', (code) => {
                        clearTimeout(timeout);
                        clearInterval(keepaliveInterval);
                        if (code === 0) {
                            sendProgress(downloadId, {
                                status: 'finalizing',
                                message: 'Processing metadata...',
                                progress: 80,
                                videoTitle
                            });
                            resolve(code);
                        }
                        else {
                            const errorMsg = `Download failed (exit code ${code})`;
                            sendProgress(downloadId, {
                                status: 'error',
                                message: errorMsg,
                                progress: 0,
                                error: stderr || 'Unknown error'
                            });
                            reject(new Error(`${errorMsg}. stderr: ${stderr}`));
                        }
                    });
                    ytDlpProcess.on('error', (error) => {
                        clearTimeout(timeout);
                        sendProgress(downloadId, {
                            status: 'error',
                            message: 'Failed to start download',
                            progress: 0,
                            error: error.message
                        });
                        reject(error);
                    });
                });
                if (stderr && !stderr.includes('WARNING')) {
                    console.error('yt-dlp stderr:', stderr);
                }
                console.log(`✅ [YOUTUBE] Download completed`);
                sendProgress(downloadId, {
                    status: 'processing',
                    message: 'Extracting metadata...',
                    progress: 85,
                    videoTitle
                });
                // Find the downloaded files
                const files = await promises_1.default.readdir(uploadDir);
                const audioFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && f.endsWith('.mp3'));
                const thumbnailFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')));
                const infoFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && f.endsWith('.info.json'));
                if (!audioFile) {
                    console.error('❌ [YOUTUBE] Audio file not found after download');
                    sendProgress(downloadId, {
                        status: 'error',
                        message: 'Audio file not created',
                        progress: 0,
                        error: 'Download completed but audio file was not found'
                    });
                    throw new Error('Download failed - audio file not created');
                }
                const audioFilePath = path_1.default.join(uploadDir, audioFile);
                console.log(`📁 [YOUTUBE] Audio file: ${audioFilePath}`);
                // Read video info if available
                let videoInfo = {};
                if (infoFile) {
                    try {
                        const infoContent = await promises_1.default.readFile(path_1.default.join(uploadDir, infoFile), 'utf-8');
                        videoInfo = JSON.parse(infoContent);
                        videoTitle = videoInfo.title || videoTitle;
                        console.log(`📋 [YOUTUBE] Video info loaded: ${videoTitle || 'Unknown'}`);
                    }
                    catch (error) {
                        console.warn('Failed to parse video info:', error);
                    }
                }
                sendProgress(downloadId, {
                    status: 'processing',
                    message: 'Reading audio metadata...',
                    progress: 90,
                    videoTitle
                });
                // Extract audio metadata
                let metadata = {};
                try {
                    const parser = ensureMusicMetadata();
                    if (parser) {
                        metadata = await parser(audioFilePath);
                        console.log(`🎵 [YOUTUBE] Audio metadata extracted`);
                    }
                    else {
                        console.warn('⚠️ [YOUTUBE] Music-metadata not available, using defaults');
                        metadata = { common: {}, format: { duration: 0 } };
                    }
                }
                catch (error) {
                    console.warn('❌ [YOUTUBE] Failed to extract audio metadata:', error);
                    metadata = { common: {}, format: { duration: 0 } };
                }
                sendProgress(downloadId, {
                    status: 'saving',
                    message: 'Adding to library...',
                    progress: 95,
                    videoTitle
                });
                // Get file stats
                const stats = await promises_1.default.stat(audioFilePath);
                // Create track record with YouTube info
                const track = await mediaService.createTrack({
                    title: videoInfo.title || metadata.common?.title || 'Downloaded Video',
                    artist: videoInfo.uploader || videoInfo.channel || metadata.common?.artist || 'YouTube',
                    album: videoInfo.playlist_title || metadata.common?.album || 'YouTube Downloads',
                    duration: Math.round(videoInfo.duration || metadata.format?.duration || 0),
                    genre: metadata.common?.genre?.join(', ') || 'Downloaded',
                    year: videoInfo.upload_date ? parseInt(videoInfo.upload_date.substring(0, 4)) : metadata.common?.year,
                    filePath: audioFilePath,
                    fileName: audioFile,
                    originalName: `${videoInfo.title || 'youtube-video'}.mp3`,
                    fileSize: stats.size,
                    mimeType: 'audio/mpeg',
                    folderId: folderId || null,
                    thumbnailPath: thumbnailFile ? path_1.default.join(uploadDir, thumbnailFile) : undefined,
                    sourceUrl: url
                });
                // Clean up info file
                if (infoFile) {
                    try {
                        await promises_1.default.unlink(path_1.default.join(uploadDir, infoFile));
                    }
                    catch (error) {
                        console.warn('Failed to clean up info file:', error);
                    }
                }
                console.log(`✅ [YOUTUBE] Track created successfully: ${track.title}`);
                sendProgress(downloadId, {
                    status: 'complete',
                    message: 'Download complete!',
                    progress: 100,
                    videoTitle,
                    track: {
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration
                    }
                });
                // Close SSE connection after a short delay
                setTimeout(() => {
                    const client = youtubeDownloadClients.get(downloadId);
                    if (client) {
                        client.res.end();
                        youtubeDownloadClients.delete(downloadId);
                    }
                }, 2000);
            }
            catch (error) {
                console.error('❌ [YOUTUBE] Download failed:', error);
                sendProgress(downloadId, {
                    status: 'error',
                    message: 'Download failed',
                    progress: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Close SSE connection after a short delay
                setTimeout(() => {
                    const client = youtubeDownloadClients.get(downloadId);
                    if (client) {
                        client.res.end();
                        youtubeDownloadClients.delete(downloadId);
                    }
                }, 2000);
            }
        })();
    }
    catch (error) {
        console.error('❌ [YOUTUBE] Initial request failed:', error);
        res.status(500).json({
            error: 'YouTube download failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Enrich track metadata using external APIs
router.post('/enrich-metadata/:trackId', async (req, res) => {
    try {
        const { trackId } = req.params;
        const { forceRefresh = false } = req.body;
        console.log(`🎵 [METADATA] Enriching metadata for track: ${trackId}`);
        // Get current track
        const track = await mediaService.getTrackById(trackId);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        // Skip if track already has good metadata and not forcing refresh
        if (!forceRefresh && track.thumbnailPath && track.album !== 'Unknown Album') {
            console.log(`⏭️ [METADATA] Track already has metadata, skipping: ${track.title}`);
            return res.json({
                success: true,
                message: 'Track already has metadata',
                enhanced: false,
                track
            });
        }
        // Lookup enhanced metadata
        const enrichedData = await metadataService.enrichTrackMetadata(track.artist, track.title, track.album !== 'Unknown Album' ? track.album : undefined, track.id);
        if (!enrichedData) {
            console.log(`❌ [METADATA] No metadata found for: ${track.title} by ${track.artist}`);
            return res.json({
                success: true,
                message: 'No enhanced metadata found',
                enhanced: false,
                track
            });
        }
        // Update track with enhanced metadata
        const updates = {};
        if (enrichedData.title && enrichedData.title !== track.title) {
            updates.title = enrichedData.title;
        }
        if (enrichedData.artist && enrichedData.artist !== track.artist) {
            updates.artist = enrichedData.artist;
        }
        if (enrichedData.album && enrichedData.album !== track.album) {
            updates.album = enrichedData.album;
        }
        if (enrichedData.year && enrichedData.year !== track.year) {
            updates.year = enrichedData.year;
        }
        if (enrichedData.genre && enrichedData.genre !== track.genre) {
            updates.genre = enrichedData.genre;
        }
        if (enrichedData.albumArtUrl) {
            updates.thumbnailPath = enrichedData.albumArtUrl;
        }
        // Only update if we have changes
        if (Object.keys(updates).length > 0) {
            console.log(`✅ [METADATA] Updating track with enhanced metadata:`, updates);
            // TODO: Add update method to mediaService
            // await mediaService.updateTrack(trackId, updates);
        }
        res.json({
            success: true,
            message: 'Metadata enriched successfully',
            enhanced: true,
            confidence: enrichedData.confidence,
            updates,
            track: { ...track, ...updates }
        });
    }
    catch (error) {
        console.error(`❌ [METADATA] Enrichment failed:`, error);
        res.status(500).json({
            error: 'Metadata enrichment failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Search for metadata without updating track
router.post('/search-metadata', async (req, res) => {
    try {
        const { artist, title, album } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        console.log(`🔍 [METADATA] Searching metadata for: "${title}" by "${artist || 'Unknown Artist'}"`);
        const results = await metadataService.lookupTrackMetadata(artist || '', title, album);
        res.json({
            success: true,
            results,
            count: results.length
        });
    }
    catch (error) {
        console.error(`❌ [METADATA] Search failed:`, error);
        res.status(500).json({
            error: 'Metadata search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Apply selected metadata to a track
router.post('/apply-metadata/:trackId', async (req, res) => {
    try {
        const { trackId } = req.params;
        const { title, artist, album, year, genre, musicBrainzId } = req.body;
        console.log(`🎵 [METADATA] Applying metadata to track: ${trackId}`);
        // Get current track
        const track = await mediaService.getTrackById(trackId);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        // Update track with selected metadata
        const updates = {};
        if (title)
            updates.title = title;
        if (artist)
            updates.artist = artist;
        if (album)
            updates.album = album;
        if (year)
            updates.year = year;
        if (genre)
            updates.genre = genre;
        // Try to get album art if we have a MusicBrainz ID
        if (musicBrainzId) {
            try {
                const albumArt = await metadataService.getAlbumArt(musicBrainzId);
                if (albumArt.length > 0) {
                    const localPath = await metadataService.downloadAlbumArt(albumArt[0].url, trackId);
                    if (localPath) {
                        updates.thumbnailPath = localPath;
                    }
                }
            }
            catch (error) {
                console.warn(`⚠️ [METADATA] Failed to download album art:`, error);
            }
        }
        const success = await mediaService.updateTrack(trackId, updates);
        if (success) {
            const updatedTrack = await mediaService.getTrackById(trackId);
            res.json({
                success: true,
                message: 'Metadata applied successfully',
                track: updatedTrack
            });
        }
        else {
            res.status(500).json({ error: 'Failed to update track' });
        }
    }
    catch (error) {
        console.error(`❌ [METADATA] Failed to apply metadata:`, error);
        res.status(500).json({
            error: 'Failed to apply metadata',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get tracks that need metadata enrichment
router.post('/enrich-all', async (req, res) => {
    try {
        const { limit = 20, skipExisting = true } = req.body;
        console.log(`🎵 [METADATA] Finding tracks that need metadata enrichment (limit: ${limit})`);
        // Get tracks that need metadata
        const tracks = await mediaService.getTracks({ limit: 100 }); // Get more to filter
        console.log(`🎵 [METADATA] Found ${tracks.length} total tracks`);
        const tracksToEnrich = tracks.filter(track => {
            // Skip tracks that don't have basic info to search with
            // We need at least a title to search for metadata
            if (!track.title || track.title.trim() === '') {
                return false;
            }
            // If skipExisting is true, skip tracks that already have good metadata
            if (skipExisting) {
                // Consider a track as having good metadata if:
                // 1. It has album art AND a proper album name (not generic ones)
                // 2. AND it has a proper artist name (not generic ones)
                const hasGoodAlbum = track.album &&
                    track.album !== 'Unknown Album' &&
                    track.album !== 'YouTube Downloads' &&
                    track.album !== 'Downloaded';
                const hasGoodArtist = track.artist &&
                    track.artist !== 'Unknown Artist' &&
                    track.artist.trim() !== '';
                const hasAlbumArt = track.thumbnailPath;
                // Only skip if it has good album info, good artist info, AND album art
                if (hasGoodAlbum && hasGoodArtist && hasAlbumArt) {
                    return false;
                }
            }
            return true;
        }).slice(0, limit);
        console.log(`🎵 [METADATA] ${tracksToEnrich.length} tracks need enrichment:`, tracksToEnrich.map(t => `"${t.title}" by "${t.artist}"`));
        if (tracksToEnrich.length === 0) {
            return res.json({
                success: true,
                message: 'No tracks need metadata enrichment',
                tracksToEnrich: []
            });
        }
        // Return the tracks that need enrichment for user interaction
        res.json({
            success: true,
            message: `Found ${tracksToEnrich.length} tracks that need metadata enrichment`,
            tracksToEnrich: tracksToEnrich.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album,
                year: track.year,
                genre: track.genre,
                thumbnailPath: track.thumbnailPath
            }))
        });
    }
    catch (error) {
        console.error(`❌ [METADATA] Batch enrichment failed:`, error);
        res.status(500).json({
            error: 'Batch metadata enrichment failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get all tracks
router.get('/tracks', async (req, res) => {
    try {
        const { folderId, search, genre, sortBy, limit, offset } = req.query;
        const tracks = await mediaService.getTracks({
            folderId: folderId,
            search: search,
            genre: genre,
            sortBy: sortBy,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });
        res.json({ tracks });
    }
    catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks' });
    }
});
// Create radio stream
router.post('/radio-streams', async (req, res) => {
    try {
        const { title, artist, streamUrl, genre, thumbnailPath } = req.body;
        if (!title || !artist || !streamUrl) {
            return res.status(400).json({ error: 'title, artist, and streamUrl are required' });
        }
        console.log('📻 [RADIO] Creating radio stream:', title);
        const track = await mediaService.createRadioStream({
            title,
            artist,
            streamUrl,
            genre,
            thumbnailPath
        });
        res.status(201).json({ track });
    }
    catch (error) {
        console.error('Error creating radio stream:', error);
        res.status(500).json({ error: 'Failed to create radio stream' });
    }
});
// Update radio stream
router.put('/radio-streams/:id', async (req, res) => {
    try {
        const { title, artist, streamUrl, genre } = req.body;
        if (!title || !artist || !streamUrl) {
            return res.status(400).json({ error: 'title, artist, and streamUrl are required' });
        }
        console.log('📻 [RADIO] Updating radio stream:', req.params.id);
        const success = await mediaService.updateTrack(req.params.id, {
            title,
            artist,
            sourceUrl: streamUrl,
            genre
        });
        if (!success) {
            return res.status(404).json({ error: 'Stream not found' });
        }
        const updatedTrack = await mediaService.getTrackById(req.params.id);
        res.json({ track: updatedTrack });
    }
    catch (error) {
        console.error('Error updating radio stream:', error);
        res.status(500).json({ error: 'Failed to update radio stream' });
    }
});
// Get track by ID
router.get('/tracks/:id', async (req, res) => {
    try {
        const track = await mediaService.getTrackById(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json({ track });
    }
    catch (error) {
        console.error('Error fetching track:', error);
        res.status(500).json({ error: 'Failed to fetch track' });
    }
});
// Update track metadata
router.put('/tracks/:id', async (req, res) => {
    try {
        const { title, artist, album, genre, year } = req.body;
        console.log('🎵 [UPDATE] Updating track:', req.params.id);
        console.log('🎵 [UPDATE] Request body:', req.body);
        console.log('🎵 [UPDATE] Title received:', JSON.stringify(title));
        const success = await mediaService.updateTrack(req.params.id, {
            title,
            artist,
            album,
            genre,
            year
        });
        if (!success) {
            return res.status(404).json({ error: 'Track not found' });
        }
        const updatedTrack = await mediaService.getTrackById(req.params.id);
        console.log('🎵 [UPDATE] Updated track:', updatedTrack?.title);
        res.json({ message: 'Track updated successfully', track: updatedTrack });
    }
    catch (error) {
        console.error('Error updating track:', error);
        res.status(500).json({ error: 'Failed to update track' });
    }
});
// Move track to folder
router.put('/tracks/:id/move', async (req, res) => {
    try {
        const { folderId } = req.body;
        const success = await mediaService.moveTrackToFolder(req.params.id, folderId);
        if (!success) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json({ message: 'Track moved successfully' });
    }
    catch (error) {
        console.error('Error moving track:', error);
        res.status(500).json({ error: 'Failed to move track' });
    }
});
// Download track
router.get('/tracks/:id/download', async (req, res) => {
    try {
        const track = await mediaService.getTrackById(req.params.id);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        // Check if file exists
        try {
            await promises_1.default.access(track.filePath);
        }
        catch {
            return res.status(404).json({ error: 'Audio file not found on disk' });
        }
        // Set download headers
        res.setHeader('Content-Type', track.mimeType || 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${track.artist} - ${track.title}.mp3"`);
        // Stream the file for download
        const readStream = require('fs').createReadStream(track.filePath);
        readStream.pipe(res);
    }
    catch (error) {
        console.error('Error downloading track:', error);
        res.status(500).json({ error: 'Failed to download track' });
    }
});
// Delete track
router.delete('/tracks/:id', async (req, res) => {
    try {
        const success = await mediaService.deleteTrack(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Track not found' });
        }
        res.json({ message: 'Track deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting track:', error);
        res.status(500).json({ error: 'Failed to delete track' });
    }
});
// Create folder
router.post('/folders', async (req, res) => {
    try {
        const { name, parentId } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        const folder = await mediaService.createFolder({
            name,
            parentId: parentId || null
        });
        res.json({ folder });
    }
    catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});
// Get all folders
router.get('/folders', async (req, res) => {
    try {
        const folders = await mediaService.getFolders();
        res.json({ folders });
    }
    catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});
// Update folder
router.put('/folders/:id', async (req, res) => {
    try {
        const { name } = req.body;
        const success = await mediaService.updateFolder(req.params.id, { name });
        if (!success) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        res.json({ message: 'Folder updated successfully' });
    }
    catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});
// Get available album art from tracks in a folder
router.get('/folders/:id/available-art', async (req, res) => {
    try {
        const tracks = await mediaService.getTracks({ folderId: req.params.id });
        // Get unique album art paths from tracks
        const albumArtOptions = tracks
            .filter(track => track.thumbnailPath || track.coverArt)
            .map(track => ({
            trackId: track.id,
            trackTitle: track.title,
            trackArtist: track.artist,
            artPath: track.thumbnailPath,
            artUrl: track.coverArt
        }))
            // Remove duplicates based on artPath
            .filter((option, index, self) => index === self.findIndex(o => o.artPath === option.artPath));
        res.json({ albumArtOptions });
    }
    catch (error) {
        console.error('Error fetching available album art:', error);
        res.status(500).json({ error: 'Failed to fetch available album art' });
    }
});
// Set folder album art
router.put('/folders/:id/album-art', async (req, res) => {
    try {
        const { albumArtPath } = req.body;
        const success = await mediaService.updateFolder(req.params.id, {
            albumArtPath
        });
        if (!success) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        res.json({ message: 'Folder album art updated successfully' });
    }
    catch (error) {
        console.error('Error updating folder album art:', error);
        res.status(500).json({ error: 'Failed to update folder album art' });
    }
});
// Delete folder
router.delete('/folders/:id', async (req, res) => {
    try {
        const success = await mediaService.deleteFolder(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        res.json({ message: 'Folder deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});
// Create playlist
router.post('/playlists', async (req, res) => {
    try {
        const { name, description, isPublic, tags } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }
        const playlist = await mediaService.createPlaylist({
            name,
            description,
            isPublic: isPublic || false,
            tags: tags || []
        });
        res.json({ playlist });
    }
    catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});
// Get all playlists
router.get('/playlists', async (req, res) => {
    try {
        const playlists = await mediaService.getPlaylists();
        res.json({ playlists });
    }
    catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});
// Add track to playlist
router.post('/playlists/:id/tracks', async (req, res) => {
    try {
        const { trackId } = req.body;
        const success = await mediaService.addTrackToPlaylist(req.params.id, trackId);
        if (!success) {
            return res.status(404).json({ error: 'Playlist or track not found' });
        }
        res.json({ message: 'Track added to playlist' });
    }
    catch (error) {
        console.error('Error adding track to playlist:', error);
        res.status(500).json({ error: 'Failed to add track to playlist' });
    }
});
// Remove track from playlist
router.delete('/playlists/:id/tracks/:trackId', async (req, res) => {
    try {
        const success = await mediaService.removeTrackFromPlaylist(req.params.id, req.params.trackId);
        if (!success) {
            return res.status(404).json({ error: 'Playlist or track not found' });
        }
        res.json({ message: 'Track removed from playlist' });
    }
    catch (error) {
        console.error('Error removing track from playlist:', error);
        res.status(500).json({ error: 'Failed to remove track from playlist' });
    }
});
// Reorder playlist tracks
router.put('/playlists/:id/reorder', async (req, res) => {
    try {
        const { trackIds } = req.body; // Array of track IDs in new order
        if (!Array.isArray(trackIds)) {
            return res.status(400).json({ error: 'trackIds array is required' });
        }
        const success = await mediaService.reorderPlaylistTracks(req.params.id, trackIds);
        if (!success) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ message: 'Playlist tracks reordered successfully' });
    }
    catch (error) {
        console.error('Error reordering playlist tracks:', error);
        res.status(500).json({ error: 'Failed to reorder playlist tracks' });
    }
});
// Delete playlist
router.delete('/playlists/:id', async (req, res) => {
    try {
        const success = await mediaService.deletePlaylist(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ message: 'Playlist deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting playlist:', error);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});
// Get playlist with tracks
router.get('/playlists/:id', async (req, res) => {
    try {
        const result = await mediaService.getPlaylistWithTracks(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching playlist:', error);
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
});
// Get available album art from tracks in a playlist
router.get('/playlists/:id/available-art', async (req, res) => {
    try {
        const playlistData = await mediaService.getPlaylistWithTracks(req.params.id);
        if (!playlistData) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        // Get unique album art paths from tracks
        const albumArtOptions = playlistData.tracks
            .filter(track => track.thumbnailPath || track.coverArt)
            .map(track => ({
            trackId: track.id,
            trackTitle: track.title,
            trackArtist: track.artist,
            artPath: track.thumbnailPath,
            artUrl: track.coverArt
        }))
            // Remove duplicates based on artPath
            .filter((option, index, self) => index === self.findIndex(o => o.artPath === option.artPath));
        res.json({ albumArtOptions });
    }
    catch (error) {
        console.error('Error fetching available album art:', error);
        res.status(500).json({ error: 'Failed to fetch available album art' });
    }
});
// Set playlist album art
router.put('/playlists/:id/album-art', async (req, res) => {
    try {
        const { albumArtPath } = req.body;
        const success = await mediaService.updatePlaylist(req.params.id, {
            albumArtPath
        });
        if (!success) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ message: 'Playlist album art updated successfully' });
    }
    catch (error) {
        console.error('Error updating playlist album art:', error);
        res.status(500).json({ error: 'Failed to update playlist album art' });
    }
});
// Update playlist
router.put('/playlists/:id', async (req, res) => {
    try {
        const { name, description, isPublic, tags } = req.body;
        // Convert tags array back to JSON string for storage
        const tagString = Array.isArray(tags) ? JSON.stringify(tags) : tags;
        const success = await mediaService.updatePlaylist(req.params.id, {
            name,
            description,
            isPublic,
            tags: tagString
        });
        if (!success) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ message: 'Playlist updated successfully' });
    }
    catch (error) {
        console.error('Error updating playlist:', error);
        res.status(500).json({ error: 'Failed to update playlist' });
    }
});
// Stream audio file by track ID
router.get('/stream/:trackId', async (req, res) => {
    try {
        const trackId = req.params.trackId;
        console.log(`🎵 [STREAM] Stream request for track ID: ${trackId}`);
        // Get track from database
        const track = await mediaService.getTrackById(trackId);
        if (!track) {
            console.log(`❌ [STREAM] Track not found: ${trackId}`);
            return res.status(404).json({ error: 'Track not found' });
        }
        console.log(`📀 [STREAM] Streaming: "${track.title}" - ${track.filePath}`);
        // Check if file exists
        try {
            await promises_1.default.access(track.filePath);
        }
        catch {
            console.log(`❌ [STREAM] File not found on disk: ${track.filePath}`);
            return res.status(404).json({ error: 'Audio file not found on disk' });
        }
        // Set appropriate headers for audio streaming
        res.setHeader('Content-Type', track.mimeType || 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename="${track.fileName}"`);
        // Get file stats for Content-Length
        const stats = await promises_1.default.stat(track.filePath);
        const range = req.headers.range;
        if (range) {
            console.log(`📊 [STREAM] Range request: ${range}`);
            // Handle range requests for seeking
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunksize = (end - start) + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
            res.setHeader('Content-Length', chunksize);
            const readStream = require('fs').createReadStream(track.filePath, { start, end });
            readStream.pipe(res);
        }
        else {
            console.log(`📊 [STREAM] Full file stream - Size: ${stats.size} bytes`);
            // Stream entire file
            res.setHeader('Content-Length', stats.size);
            const readStream = require('fs').createReadStream(track.filePath);
            readStream.pipe(res);
        }
        console.log(`✅ [STREAM] Started streaming successfully`);
    }
    catch (error) {
        console.error('❌ [STREAM] Error streaming track:', error);
        res.status(500).json({ error: 'Failed to stream track' });
    }
});
// Legacy endpoint for streaming by filename (keep for compatibility)
router.get('/stream-file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(process.cwd(), 'uploads', filename);
        // Check if file exists
        try {
            await promises_1.default.access(filePath);
        }
        catch {
            return res.status(404).json({ error: 'File not found' });
        }
        // Set appropriate headers for audio streaming
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        // Stream the file
        const readStream = require('fs').createReadStream(filePath);
        readStream.pipe(res);
    }
    catch (error) {
        console.error('Error streaming file:', error);
        res.status(500).json({ error: 'Failed to stream file' });
    }
});
exports.default = router;
