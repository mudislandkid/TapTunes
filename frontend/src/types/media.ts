export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number // in seconds
  genre?: string
  year?: number
  trackType?: 'file' | 'stream'
  coverArt?: string
  filePath: string
  sourceUrl?: string // Stream URL for radio streams
  isLiked?: boolean
  folderId?: string
}

export interface Album {
  id: string
  title: string
  artist: string
  year?: number
  trackCount: number
  duration: number
  coverArt?: string
  tracks: Track[]
}

export interface Artist {
  id: string
  name: string
  albumCount: number
  trackCount: number
  coverArt?: string
}

export interface Folder {
  id: string
  name: string
  parentId?: string
  path: string
  trackCount: number
  albumArtPath?: string
  subfolders: Folder[]
  createdAt: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  trackCount: number
  duration: number
  coverArt?: string
  albumArtPath?: string
  tracks: Track[]
  createdAt: string
  isPublic: boolean
  tags?: string[]
}

export interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

export interface MediaLibraryProps {
  apiBase: string
  onPlayTrack?: (track: Track) => void
  onPlayPlaylist?: (playlist: Track[], playlistName?: string) => void
}