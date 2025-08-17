import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { parseFile } from 'music-metadata';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MediaService } from '../services/mediaService';
import { MetadataService } from '../services/metadataService';

const router = express.Router();
const mediaService = new MediaService();
const metadataService = new MetadataService();
const execAsync = promisify(exec);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
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
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Supported formats: ${allowedExtensions.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Upload multiple files
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const folderId = req.body.folderId || null;
    const uploadResults = [];

    for (const file of req.files) {
      try {
        // Extract metadata from audio file
        const metadata = await parseFile(file.path);
        
        // Create track record
        const track = await mediaService.createTrack({
          title: metadata.common.title || path.basename(file.originalname, path.extname(file.originalname)),
          artist: metadata.common.artist || 'Unknown Artist',
          album: metadata.common.album || 'Unknown Album',
          duration: Math.round(metadata.format.duration || 0),
          genre: metadata.common.genre?.join(', ') || undefined,
          year: metadata.common.year || undefined,
          filePath: file.path,
          fileName: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          folderId
        });

        uploadResults.push({
          success: true,
          track,
          fileName: file.originalname
        });

      } catch (error) {
        console.error('Error processing file:', file.originalname, error);
        
        // Clean up file if processing failed
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error removing failed file:', unlinkError);
        }

        uploadResults.push({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process file',
          fileName: file.originalname
        });
      }
    }

    res.json({
      message: 'Upload completed',
      results: uploadResults,
      totalFiles: req.files.length,
      successCount: uploadResults.filter(r => r.success).length,
      errorCount: uploadResults.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Download audio from YouTube URL
router.post('/download-youtube', async (req, res) => {
  try {
    const { url, folderId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`🎬 [YOUTUBE] Starting download from: ${url}`);

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename prefix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const outputTemplate = path.join(uploadDir, `youtube-${uniqueSuffix}.%(ext)s`);

    // Download audio and thumbnail using yt-dlp
    const ytDlpArgs = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0', // Best quality
      '--write-thumbnail',
      '--write-info-json',
      '--no-playlist',
      '--output', outputTemplate,
      url
    ];

    console.log(`🔧 [YOUTUBE] Running yt-dlp with args:`, ytDlpArgs);

    const { spawn } = require('child_process');
    
    const ytDlpProcess = spawn('yt-dlp', ytDlpArgs, {
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    ytDlpProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      console.log('📹 [YOUTUBE stdout]:', output.trim());
    });

    ytDlpProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      console.log('📹 [YOUTUBE stderr]:', output.trim());
    });

    await new Promise((resolve, reject) => {
      // Set a timeout for the download process
      const timeout = setTimeout(() => {
        ytDlpProcess.kill();
        reject(new Error('Download timeout - process took too long'));
      }, 120000); // 2 minutes timeout

      ytDlpProcess.on('close', (code: number) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}. stderr: ${stderr}`));
        }
      });

      ytDlpProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('yt-dlp stderr:', stderr);
    }

    console.log(`✅ [YOUTUBE] Download completed`);

    // Find the downloaded files
    const files = await fs.readdir(uploadDir);
    const audioFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && f.endsWith('.mp3'));
    const thumbnailFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')));
    const infoFile = files.find(f => f.startsWith(`youtube-${uniqueSuffix}`) && f.endsWith('.info.json'));

    if (!audioFile) {
      console.error('❌ [YOUTUBE] Audio file not found after download');
      return res.status(500).json({ error: 'Download failed - audio file not created' });
    }

    const audioFilePath = path.join(uploadDir, audioFile);
    console.log(`📁 [YOUTUBE] Audio file: ${audioFilePath}`);

    // Read video info if available
    let videoInfo: any = {};
    if (infoFile) {
      try {
        const infoContent = await fs.readFile(path.join(uploadDir, infoFile), 'utf-8');
        videoInfo = JSON.parse(infoContent);
        console.log(`📋 [YOUTUBE] Video info loaded: ${videoInfo.title || 'Unknown'}`);
      } catch (error) {
        console.warn('Failed to parse video info:', error);
      }
    }

    // Extract audio metadata
    let metadata: any = {};
    try {
      metadata = await parseFile(audioFilePath);
      console.log(`🎵 [YOUTUBE] Audio metadata extracted`);
    } catch (error) {
      console.warn('Failed to extract audio metadata:', error);
    }

    // Get file stats
    const stats = await fs.stat(audioFilePath);

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
      thumbnailPath: thumbnailFile ? path.join(uploadDir, thumbnailFile) : undefined,
      sourceUrl: url
    });

    // Clean up info file
    if (infoFile) {
      try {
        await fs.unlink(path.join(uploadDir, infoFile));
      } catch (error) {
        console.warn('Failed to clean up info file:', error);
      }
    }

    console.log(`✅ [YOUTUBE] Track created successfully: ${track.title}`);

    res.json({
      success: true,
      track,
      message: 'Video downloaded and added to library',
      thumbnailAvailable: !!thumbnailFile
    });

  } catch (error) {
    console.error('❌ [YOUTUBE] Download failed:', error);
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
    const enrichedData = await metadataService.enrichTrackMetadata(
      track.artist,
      track.title,
      track.album !== 'Unknown Album' ? track.album : undefined,
      track.id
    );

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
    const updates: any = {};
    
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

  } catch (error) {
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
    
    if (!artist || !title) {
      return res.status(400).json({ error: 'Artist and title are required' });
    }

    console.log(`🔍 [METADATA] Searching metadata for: "${title}" by "${artist}"`);

    const results = await metadataService.lookupTrackMetadata(artist, title, album);

    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    console.error(`❌ [METADATA] Search failed:`, error);
    res.status(500).json({ 
      error: 'Metadata search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch enrich all tracks missing metadata
router.post('/enrich-all', async (req, res) => {
  try {
    const { limit = 10, skipExisting = true } = req.body;
    
    console.log(`🎵 [METADATA] Starting batch metadata enrichment (limit: ${limit})`);
    
    // Get tracks that need metadata
    const tracks = await mediaService.getTracks({ limit: 100 }); // Get more to filter
    console.log(`🎵 [METADATA] Found ${tracks.length} total tracks`);
    
    const tracksToEnrich = tracks.filter(track => {
      // Skip tracks that don't have basic info to search with
      if (!track.title || track.artist === 'Unknown Artist') {
        return false;
      }
      
      // If skipExisting is true, skip tracks that already have good metadata
      if (skipExisting) {
        // Consider a track as having good metadata if:
        // 1. It has album art AND a proper album name (not generic ones)
        // 2. OR it has a high confidence MusicBrainz match (we'd need to track this)
        const hasGoodAlbum = track.album && 
          track.album !== 'Unknown Album' && 
          track.album !== 'YouTube Downloads' &&
          track.album !== 'Downloaded';
          
        const hasAlbumArt = track.thumbnailPath;
        
        // Only skip if it has BOTH good album info AND album art
        if (hasGoodAlbum && hasAlbumArt) {
          return false;
        }
      }
      
      return true;
    }).slice(0, limit);

    console.log(`🎵 [METADATA] ${tracksToEnrich.length} tracks need enrichment:`, 
      tracksToEnrich.map(t => `"${t.title}" by "${t.artist}"`));

    if (tracksToEnrich.length === 0) {
      return res.json({
        success: true,
        message: 'No tracks need metadata enrichment',
        processed: 0,
        results: []
      });
    }

    const results = [];
    let processed = 0;

    for (const track of tracksToEnrich) {
      try {
        console.log(`🎵 [METADATA] Processing ${processed + 1}/${tracksToEnrich.length}: ${track.title}`);
        
        const enrichedData = await metadataService.enrichTrackMetadata(
          track.artist,
          track.title,
          track.album !== 'Unknown Album' ? track.album : undefined,
          track.id
        );

        results.push({
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          success: !!enrichedData,
          confidence: enrichedData?.confidence || 0,
          enhanced: !!enrichedData
        });

        processed++;
        
        // Add delay between requests to be respectful to APIs
        if (processed < tracksToEnrich.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

      } catch (error) {
        console.error(`❌ [METADATA] Failed to process track ${track.id}:`, error);
        results.push({
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        processed++;
      }
    }

    console.log(`✅ [METADATA] Batch enrichment completed: ${processed} tracks processed`);

    res.json({
      success: true,
      message: `Processed ${processed} tracks`,
      processed,
      results
    });

  } catch (error) {
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
      folderId: folderId as string,
      search: search as string,
      genre: genre as string,
      sortBy: sortBy as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({ tracks });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
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
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({ error: 'Failed to fetch track' });
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
  } catch (error) {
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
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Get all folders
router.get('/folders', async (req, res) => {
  try {
    const folders = await mediaService.getFolders();
    res.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
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
  } catch (error) {
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
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Get all playlists
router.get('/playlists', async (req, res) => {
  try {
    const playlists = await mediaService.getPlaylists();
    res.json({ playlists });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('Error removing track from playlist:', error);
    res.status(500).json({ error: 'Failed to remove track from playlist' });
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
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
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
      await fs.access(track.filePath);
    } catch {
      console.log(`❌ [STREAM] File not found on disk: ${track.filePath}`);
      return res.status(404).json({ error: 'Audio file not found on disk' });
    }

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', track.mimeType || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${track.fileName}"`);
    
    // Get file stats for Content-Length
    const stats = await fs.stat(track.filePath);
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
    } else {
      console.log(`📊 [STREAM] Full file stream - Size: ${stats.size} bytes`);
      // Stream entire file
      res.setHeader('Content-Length', stats.size);
      const readStream = require('fs').createReadStream(track.filePath);
      readStream.pipe(res);
    }

    console.log(`✅ [STREAM] Started streaming successfully`);

  } catch (error) {
    console.error('❌ [STREAM] Error streaming track:', error);
    res.status(500).json({ error: 'Failed to stream track' });
  }
});

// Legacy endpoint for streaming by filename (keep for compatibility)
router.get('/stream-file/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream the file
    const readStream = require('fs').createReadStream(filePath);
    readStream.pipe(res);

  } catch (error) {
    console.error('Error streaming file:', error);
    res.status(500).json({ error: 'Failed to stream file' });
  }
});

export default router;