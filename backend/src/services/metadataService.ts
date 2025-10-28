import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import axios from 'axios';

const execAsync = promisify(exec);

export interface MetadataLookupResult {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  albumArtUrl?: string;
  musicBrainzId?: string;
  confidence: number; // 0-1 score for match quality
}

export interface AlbumArtResult {
  url: string;
  localPath?: string;
  type: 'front' | 'back' | 'other';
  size: 'small' | 'large' | 'original';
}

export class MetadataService {
  private readonly userAgent = 'TapTunes/1.0 (https://github.com/user/taptunes)';
  private readonly musicBrainzBaseUrl = 'https://musicbrainz.org/ws/2';
  private readonly coverArtBaseUrl = 'https://coverartarchive.org';
  private readonly lastFmApiKey = process.env.LASTFM_API_KEY; // Optional
  
  constructor() {
    // Ensure user agent is set for MusicBrainz API compliance
    console.log('🎵 [TAPTUNES-METADATA] MetadataService initialized');
  }

  /**
   * Search for track metadata using MusicBrainz
   */
  async lookupTrackMetadata(artist: string, title: string, album?: string): Promise<MetadataLookupResult[]> {
    try {
      console.log(`🔍 [METADATA] Looking up: "${title}" by "${artist}"`);

      // Build search query - if artist is unknown/empty, search by title only
      let query: string;
      const isUnknownArtist = !artist || artist.toLowerCase() === 'unknown artist' || artist.trim() === '';

      if (isUnknownArtist) {
        console.log(`🔍 [METADATA] Artist unknown, searching by title only: "${title}"`);
        query = `recording:"${title}"`;
        if (album && album.toLowerCase() !== 'unknown album') {
          query += ` AND release:"${album}"`;
        }
      } else {
        query = `artist:"${artist}" AND recording:"${title}"`;
        if (album) {
          query += ` AND release:"${album}"`;
        }
      }

      const searchUrl = `${this.musicBrainzBaseUrl}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=10`;

      let response = await this.makeRequest(searchUrl);
      let data = await response.json();

      // If no results and we searched with artist, try title-only as fallback
      if ((!data.recordings || data.recordings.length === 0) && !isUnknownArtist) {
        console.log(`⚠️ [METADATA] No results with artist+title, trying title only...`);
        const fallbackQuery = `recording:"${title}"`;
        const fallbackUrl = `${this.musicBrainzBaseUrl}/recording?query=${encodeURIComponent(fallbackQuery)}&fmt=json&limit=10`;
        response = await this.makeRequest(fallbackUrl);
        data = await response.json();
      }

      if (!data.recordings || data.recordings.length === 0) {
        console.log(`❌ [METADATA] No results found for "${title}" by "${artist}"`);
        return [];
      }

      const results: MetadataLookupResult[] = [];
      
      // Return more results when searching by title only to give user options
      const maxResults = isUnknownArtist ? 8 : 3;
      
      for (const recording of data.recordings.slice(0, maxResults)) {
        try {
          const result = await this.parseRecordingData(recording);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.warn(`⚠️ [METADATA] Error parsing recording data:`, error);
        }
      }

      console.log(`✅ [METADATA] Found ${results.length} results for "${title}" by "${artist}"`);
      return results.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error(`❌ [METADATA] Lookup failed for "${title}" by "${artist}":`, error);
      return [];
    }
  }

  /**
   * Get album art from Cover Art Archive
   */
  async getAlbumArt(musicBrainzReleaseId: string): Promise<AlbumArtResult[]> {
    try {
      console.log(`🖼️ [METADATA] Looking up album art for release: ${musicBrainzReleaseId}`);
      
      const artUrl = `${this.coverArtBaseUrl}/release/${musicBrainzReleaseId}`;
      const response = await this.makeRequest(artUrl);
      
      if (!response.ok) {
        console.log(`❌ [METADATA] No album art found for release: ${musicBrainzReleaseId}`);
        return [];
      }

      const data = await response.json();
      const results: AlbumArtResult[] = [];

      if (data.images && Array.isArray(data.images)) {
        for (const image of data.images) {
          if (image.front || image.types?.includes('Front')) {
            // Prefer large thumbnails, fallback to small, then original
            const sizes = ['large', 'small', 'original'] as const;
            
            for (const size of sizes) {
              if (image.thumbnails && image.thumbnails[size]) {
                results.push({
                  url: image.thumbnails[size],
                  type: 'front',
                  size: size
                });
                break;
              }
            }
            
            // If no thumbnails, use original image
            if (results.length === 0 && image.image) {
              results.push({
                url: image.image,
                type: 'front',
                size: 'original'
              });
            }
          }
        }
      }

      console.log(`✅ [METADATA] Found ${results.length} album art images`);
      return results;

    } catch (error) {
      console.error(`❌ [METADATA] Album art lookup failed:`, error);
      return [];
    }
  }

  /**
   * Download and save album art locally
   */
  async downloadAlbumArt(artUrl: string, trackId: string): Promise<string | null> {
    try {
      console.log(`⬇️ [METADATA] Downloading album art: ${artUrl}`);

      // Download image directly with axios (not through makeRequest)
      const response = await axios.get(artUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      // Get file extension from content type or URL
      const contentType = response.headers['content-type'] || '';
      let extension = '.jpg';

      if (contentType.includes('png')) extension = '.png';
      else if (contentType.includes('webp')) extension = '.webp';
      else if (artUrl.includes('.png')) extension = '.png';
      else if (artUrl.includes('.webp')) extension = '.webp';

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Save with track ID as filename
      const filename = `album-art-${trackId}${extension}`;
      const localPath = path.join(uploadsDir, filename);

      // Axios with responseType: 'arraybuffer' returns data as Buffer
      await fs.writeFile(localPath, Buffer.from(response.data));

      console.log(`✅ [METADATA] Album art saved: ${localPath}`);
      return localPath;

    } catch (error) {
      console.error(`❌ [METADATA] Failed to download album art:`, error);
      return null;
    }
  }

  /**
   * Enhanced metadata lookup with album art
   */
  async enrichTrackMetadata(
    artist: string, 
    title: string, 
    album?: string, 
    trackId?: string
  ): Promise<MetadataLookupResult | null> {
    try {
      const results = await this.lookupTrackMetadata(artist, title, album);
      
      if (results.length === 0) {
        return null;
      }

      // Take the best match
      const bestMatch = results[0];
      
      // Try to get album art if we have a MusicBrainz release ID
      if (bestMatch.musicBrainzId && trackId) {
        const albumArt = await this.getAlbumArt(bestMatch.musicBrainzId);
        
        if (albumArt.length > 0) {
          // Download the first (best) album art
          const localPath = await this.downloadAlbumArt(albumArt[0].url, trackId);
          if (localPath) {
            bestMatch.albumArtUrl = localPath;
          }
        }
      }

      return bestMatch;

    } catch (error) {
      console.error(`❌ [METADATA] Enrichment failed:`, error);
      return null;
    }
  }

  /**
   * Get multiple metadata suggestions for user selection
   */
  async getMetadataSuggestions(
    artist: string, 
    title: string, 
    album?: string
  ): Promise<MetadataLookupResult[]> {
    try {
      const results = await this.lookupTrackMetadata(artist, title, album);
      console.log(`✅ [METADATA] Found ${results.length} suggestions for user selection`);
      return results;
    } catch (error) {
      console.error(`❌ [METADATA] Failed to get suggestions:`, error);
      return [];
    }
  }

  /**
   * Search by audio fingerprint (if available)
   */
  async lookupByFingerprint(filePath: string): Promise<MetadataLookupResult | null> {
    try {
      // This would require acoustid/chromaprint integration
      // For now, we'll return null and implement later if needed
      console.log(`🔍 [METADATA] Fingerprint lookup not yet implemented for: ${filePath}`);
      return null;
    } catch (error) {
      console.error(`❌ [METADATA] Fingerprint lookup failed:`, error);
      return null;
    }
  }

  private async parseRecordingData(recording: any): Promise<MetadataLookupResult | null> {
    try {
      let confidence = 0.5; // Base confidence
      let musicBrainzId = null;
      let album = null;
      let year = null;
      let genre = null;

      // Get release information
      if (recording.releases && recording.releases.length > 0) {
        const release = recording.releases[0];
        album = release.title;
        musicBrainzId = release.id;
        
        // Parse release date
        if (release.date) {
          const yearMatch = release.date.match(/^(\d{4})/);
          if (yearMatch) {
            year = parseInt(yearMatch[1]);
          }
        }
        
        confidence += 0.2; // Bonus for having release info
      }

      // Get artist information
      let artist = 'Unknown Artist';
      if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
        artist = recording['artist-credit'][0].name;
        confidence += 0.2; // Bonus for having artist
      }

      // Get genre/tags
      if (recording.tags && recording.tags.length > 0) {
        genre = recording.tags
          .slice(0, 3) // Take top 3 tags
          .map((tag: any) => tag.name)
          .join(', ');
        confidence += 0.1; // Small bonus for tags
      }

      // Calculate match confidence based on score
      if (recording.score) {
        confidence = Math.min(confidence + (recording.score / 100) * 0.3, 1.0);
      }

      return {
        title: recording.title,
        artist,
        album,
        year,
        genre,
        musicBrainzId,
        confidence
      };

    } catch (error) {
      console.warn(`⚠️ [METADATA] Error parsing recording:`, error);
      return null;
    }
  }

  private async makeRequest(url: string, retries = 3): Promise<any> {
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json'
    };

    // Add delay to respect rate limits (MusicBrainz allows 1 request per second)
    await this.delay(1000);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const https = require('https');
        const response = await axios.get(url, {
          headers,
          timeout: 15000, // 15 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          httpsAgent: new https.Agent({
            keepAlive: false, // Disable keep-alive to avoid ECONNRESET
            rejectUnauthorized: true
          })
        });

        // Return a Response-like object for compatibility
        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.statusText,
          json: async () => response.data
        };
      } catch (error: any) {
        if (error.response) {
          // Server responded with error status - don't retry
          return {
            ok: false,
            status: error.response.status,
            statusText: error.response.statusText,
            json: async () => error.response.data
          };
        }

        // Network error - retry if we have attempts left
        if (attempt < retries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
          console.log(`⚠️ [METADATA] Request failed (attempt ${attempt}/${retries}), retrying...`);
          await this.delay(2000 * attempt); // Exponential backoff
          continue;
        }

        // Out of retries or non-retryable error
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}