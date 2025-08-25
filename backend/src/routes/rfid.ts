import { Router } from 'express';
import { DatabaseService } from '../services/databaseService';
import { MediaService } from '../services/mediaService';

const router = Router();
const databaseService = new DatabaseService();
const mediaService = new MediaService();

// Get all RFID cards
router.get('/cards', async (req, res) => {
  try {
    const cards = await databaseService.getRFIDCards();
    res.json({ cards });
  } catch (error) {
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
    } else {
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
  } catch (error) {
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
    } else {
      res.status(404).json({ error: 'Card not found' });
    }
  } catch (error) {
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
    
    // Handle different assignment types
    let action = null;
    let data = null;

    switch (card.assignment_type) {
      case 'track':
        if (card.assignment_id) {
          const track = await databaseService.getTrackById(card.assignment_id);
          if (track) {
            action = 'play_track';
            data = { track };
            console.log(`🎵 [RFID] Playing track: ${track.title}`);
          }
        }
        break;

      case 'playlist':
        if (card.assignment_id) {
          const playlistData = await databaseService.getPlaylistWithTracks(card.assignment_id);
          if (playlistData) {
            action = 'play_playlist';
            data = { playlist: playlistData.playlist, tracks: playlistData.tracks };
            console.log(`📝 [RFID] Playing playlist: ${playlistData.playlist.name}`);
          }
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
            console.log(`💿 [RFID] Playing album: ${card.assignment_id}`);
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
            console.log(`🎤 [RFID] Playing artist: ${card.assignment_id}`);
          }
        }
        break;

      case 'action':
        // Handle control actions
        action = card.action || 'unknown';
        console.log(`⚡ [RFID] Executing action: ${action}`);
        break;

      default:
        console.log(`⚠️ [RFID] Unknown assignment type: ${card.assignment_type}`);
        break;
    }

    res.json({ 
      card, 
      action,
      data,
      message: `Card "${card.name}" scanned successfully` 
    });

  } catch (error) {
    console.error('Error handling RFID scan:', error);
    res.status(500).json({ error: 'Failed to process RFID scan' });
  }
});

// Store for pending card reads
let pendingCardRead: { resolve: (cardId: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout } | null = null;

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
    const cardPromise = new Promise<string>((resolve, reject) => {
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
    } catch (error: any) {
      console.log(`❌ [RFID] Card read failed: ${error.message}`);
      res.status(408).json({ error: error.message });
    }
  } catch (error) {
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
    } else {
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
          if (card.assignment_id) {
            const track = await databaseService.getTrackById(card.assignment_id);
            if (track) {
              action = 'play_track';
              data = { track };
              console.log(`🎵 [RFID] Playing track: ${track.title}`);
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
  } catch (error) {
    console.error('Error handling card detection:', error);
    res.status(500).json({ error: 'Failed to process card detection' });
  }
});

// Get available albums for assignment
router.get('/albums', async (req, res) => {
  try {
    const tracks = await databaseService.getTracks();
    const albums = new Set<string>();
    
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
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Get available artists for assignment
router.get('/artists', async (req, res) => {
  try {
    const tracks = await databaseService.getTracks();
    const artists = new Set<string>();
    
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
  } catch (error) {
    console.error('Error fetching artists:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

export default router;