import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { DatabaseService } from '../services/databaseService';

const router = express.Router();
const dbService = new DatabaseService();

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'album-art');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audiobook-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported formats: JPG, PNG, GIF, WebP'));
  }
};

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
});

// Get all audiobooks
router.get('/', async (req, res) => {
  try {
    const audiobooks = await dbService.getAudiobooks();
    res.json(audiobooks);
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
    const { MetadataService } = await import('../services/metadataService');
    const metadataService = new MetadataService();

    console.log(`📚 [AUDIOBOOK] Searching metadata for: "${audiobook.title}" by ${audiobook.author}`);

    // Search using title as query (audiobooks are often listed by title)
    const results = await metadataService.lookupTrackMetadata(
      audiobook.author,
      audiobook.title,
      '' // no album for audiobooks
    );

    res.json({ results });
  } catch (error) {
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

    let albumArtPath: string | undefined;

    // Download album art if musicBrainzId provided
    if (musicBrainzId) {
      const { MetadataService } = await import('../services/metadataService');
      const metadataService = new MetadataService();

      albumArtPath = await metadataService.downloadAlbumArt(musicBrainzId, id);
      console.log(`🎨 [AUDIOBOOK] Album art downloaded: ${albumArtPath}`);
    }

    // Update audiobook with new metadata
    const updates: any = {};
    if (title) updates.title = title;
    if (author) updates.author = author;
    if (description) updates.description = description;
    if (albumArtPath) updates.album_art_path = albumArtPath;

    const success = await dbService.updateAudiobook(id, updates);

    if (!success) {
      return res.status(404).json({ error: 'Audiobook not found' });
    }

    res.json({ success: true, albumArtPath });
  } catch (error) {
    console.error('Error applying audiobook metadata:', error);
    res.status(500).json({
      error: 'Failed to apply metadata',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload cover image for audiobook
router.post('/:id/upload-cover', imageUpload.single('cover'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log(`🎨 [AUDIOBOOK] Uploading cover for audiobook: ${id}`);

    // Get relative path from uploads directory
    const relativePath = path.join('album-art', req.file.filename);

    // Update audiobook with new album art path
    const success = await dbService.updateAudiobook(id, {
      album_art_path: relativePath
    });

    if (!success) {
      // Clean up uploaded file if update fails
      await fs.unlink(req.file.path).catch(console.error);
      return res.status(404).json({ error: 'Audiobook not found' });
    }

    console.log(`✅ [AUDIOBOOK] Cover uploaded: ${relativePath}`);
    res.json({
      success: true,
      albumArtPath: relativePath,
      albumArtUrl: `/uploads/${relativePath}`
    });
  } catch (error) {
    console.error('Error uploading audiobook cover:', error);
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    res.status(500).json({
      error: 'Failed to upload cover',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available album art from audiobook tracks
router.get('/:id/available-art', async (req, res) => {
  try {
    const { id } = req.params;

    const audiobookData = await dbService.getAudiobookWithTracks(id);
    if (!audiobookData) {
      return res.status(404).json({ error: 'Audiobook not found' });
    }

    // Get unique album art from tracks
    const albumArtMap = new Map();
    for (const track of audiobookData.tracks) {
      if (track.thumbnail_path) {
        const key = track.thumbnail_path;
        if (!albumArtMap.has(key)) {
          albumArtMap.set(key, {
            trackId: track.id,
            trackTitle: track.title,
            trackArtist: track.artist,
            artPath: track.thumbnail_path,
            artUrl: `/uploads/${track.thumbnail_path}`
          });
        }
      }
    }

    const albumArtOptions = Array.from(albumArtMap.values());
    res.json({ albumArtOptions });
  } catch (error) {
    console.error('Error fetching available album art:', error);
    res.status(500).json({ error: 'Failed to fetch available album art' });
  }
});

// Set album art from a track
router.put('/:id/album-art', async (req, res) => {
  try {
    const { id } = req.params;
    const { albumArtPath } = req.body;

    if (!albumArtPath) {
      return res.status(400).json({ error: 'Album art path is required' });
    }

    console.log(`🎨 [AUDIOBOOK] Setting album art for audiobook: ${id} to ${albumArtPath}`);

    const success = await dbService.updateAudiobook(id, {
      album_art_path: albumArtPath
    });

    if (!success) {
      return res.status(404).json({ error: 'Audiobook not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting audiobook album art:', error);
    res.status(500).json({ error: 'Failed to set album art' });
  }
});

export default router;
