# Deployment Notes

## Nginx Configuration Update Required

**Date**: 2025-11-04

### Issue
The nginx configuration needs to be updated to allow large file uploads (audiobook chapters can be 50-100MB+).

### Solution
The `scripts/taptunes-nginx.conf` file has been updated with:
```nginx
client_max_body_size 500M;
```

### Deployment Steps

#### On your Raspberry Pi:

1. **Backup current config**:
   ```bash
   sudo cp /etc/nginx/sites-available/taptunes /etc/nginx/sites-available/taptunes.backup
   ```

2. **Copy new config** (from your development machine):
   ```bash
   # From dev machine
   scp scripts/taptunes-nginx.conf pi@taptunes.local:/tmp/

   # On RPi
   sudo cp /tmp/taptunes-nginx.conf /etc/nginx/sites-available/taptunes
   ```

3. **Test nginx config**:
   ```bash
   sudo nginx -t
   ```

4. **Reload nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

5. **Verify** by uploading an audiobook with large chapter files (should now work without 413 errors).

### Alternative: Manual Update
If you prefer to manually edit the config:

```bash
sudo nano /etc/nginx/sites-available/taptunes
```

Add this line after the `server_name` line:
```nginx
client_max_body_size 500M;
```

Save, test (`sudo nginx -t`), and reload (`sudo systemctl reload nginx`).

---

## Backend Configuration
✅ The Express backend is already configured for 500MB uploads:
- JSON body parser limit: 500MB
- Multer file upload limit: 500MB

No backend changes are required.

---

## Audiobook Hardware Playback Fix

**Date**: 2025-11-04

### Issue
Audiobooks would start playing in the UI but produced no hardware audio output on the Raspberry Pi. The error logs showed:
```
🔍 [AUDIO] Raw filePath received: undefined
TypeError: Cannot read properties of undefined (reading 'length')
```

### Root Cause
Database tracks return properties in snake_case format (`file_path`, `track_type`, `source_url`), but the audio playback code expected camelCase format (`filePath`, `trackType`, `sourceUrl`). This mismatch caused `undefined` values when mapping audiobook tracks to the playlist.

### Solution
Updated `/backend/src/routes/audio.ts` to handle both property naming conventions using fallback logic:
```typescript
file_path: track.filePath || track.file_path,
track_type: track.trackType || track.track_type || 'file',
source_url: track.sourceUrl || track.source_url
```

### Deployment Steps

#### On your Raspberry Pi:

1. **Pull latest code**:
   ```bash
   cd ~/taptunes
   git pull origin main
   ```

2. **Rebuild backend**:
   ```bash
   cd backend
   npm run build
   ```

3. **Restart backend service**:
   ```bash
   pm2 restart taptunes-backend
   ```

4. **Verify** by playing an audiobook - you should now hear audio output through the hardware.

---

## Audiobook Display Enhancement

**Date**: 2025-11-04

### Enhancement
When playing an audiobook, the player now displays the audiobook title as the main heading with the chapter name underneath, similar to how playlists are displayed. This provides better context and makes it clear what audiobook is being played.

### Changes Made

**Backend** (`/backend/src/routes/audio.ts`):
- Updated `/audio/play-playlist` endpoint to accept optional `playlistName` parameter
- Playlist name is now used instead of hardcoded "Custom Playlist"

**Frontend**:
- Updated `handlePlayPlaylist` in `useAudioPlayer.ts` to accept optional `playlistName` parameter
- Modified `MediaLibrary.tsx` to pass audiobook title when playing audiobooks
- Modified `PlaylistView.tsx` to pass playlist name when playing playlists
- Updated `NowPlaying.tsx` component to display:
  - Playlist/audiobook name as main heading (when available)
  - Track/chapter title as subtitle (when playlist name exists)
  - Falls back to original display (track title, artist, album) for single tracks

### User Experience
- **Before**: "Chapter 1" / "Unknown Artist" / "Unknown Album"
- **After**: "Audiobook Title" / "Chapter 1"

This applies to both audiobooks and regular playlists, providing consistent context about what's currently playing.

### Deployment
This change is included in the build and will be deployed with the hardware playback fix above.

---

## Audiobook Cover Image Upload

**Date**: 2025-11-04

### Feature
Added the ability to manually upload custom cover images for audiobooks, in addition to selecting artwork from existing tracks or downloading from MusicBrainz.

### Changes Made

**Backend** (`/backend/src/routes/audiobooks.ts`):
- Added multer configuration for image uploads (JPG, PNG, GIF, WebP up to 10MB)
- Added `POST /audiobooks/:id/upload-cover` endpoint to handle custom cover uploads
- Added `GET /audiobooks/:id/available-art` endpoint to fetch album art from audiobook tracks
- Added `PUT /audiobooks/:id/album-art` endpoint to set cover from existing track artwork

**Frontend**:
- Created new `AudiobookCoverPicker` component with tabbed interface
- **Upload Tab**: Drag-and-drop or browse for custom image files
- **From Tracks Tab**: Select from existing track artwork in the audiobook
- Added "Change Cover" button to `AudiobookDetailDialog`
- Image preview before upload with confirmation

### User Experience
Users can now:
1. Upload custom cover images (JPG, PNG, GIF, WebP)
2. Select album art from any track within the audiobook
3. Download cover art from MusicBrainz (existing "Enhance Metadata" feature)

### File Storage
- Cover images are stored in `/uploads/album-art/`
- Filename format: `audiobook-{timestamp}-{random}.{ext}`
- Maximum file size: 10MB
- Supported formats: JPG, JPEG, PNG, GIF, WebP

### Deployment
Included in the build above - no additional configuration needed.

### Bug Fix
Fixed album art URL construction in `AudiobookView.tsx` to use `/uploads/` prefix instead of `${apiBase}/`, ensuring uploaded cover images load correctly.
