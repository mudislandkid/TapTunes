import { useState, useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Play, 
  Plus, 
  Music, 
  Clock,
  MoreHorizontal,
  Heart,
  Shuffle,
  Upload,
  Folder,
  FolderPlus,
  Edit3,
  Trash2,
  Download,
  Share,
  SkipForward,
  Volume2,
  ChevronRight,
  Home,
  X,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GlassCard } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { 
  pageVariants, 
  staggerContainer, 
  cardHover, 
  buttonPulse, 
  fadeInUp, 
  scaleIn,
  springConfig 
} from '../lib/animations'

interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number // in seconds
  genre?: string
  year?: number
  coverArt?: string
  filePath: string
  isLiked?: boolean
  folderId?: string
}

interface Album {
  id: string
  title: string
  artist: string
  year?: number
  trackCount: number
  duration: number
  coverArt?: string
  tracks: Track[]
}

interface Artist {
  id: string
  name: string
  albumCount: number
  trackCount: number
  coverArt?: string
}

interface Folder {
  id: string
  name: string
  parentId?: string
  path: string
  trackCount: number
  subfolders: Folder[]
  createdAt: string
}

interface Playlist {
  id: string
  name: string
  description?: string
  trackCount: number
  duration: number
  coverArt?: string
  tracks: Track[]
  createdAt: string
  isPublic: boolean
  tags?: string[]
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

interface MediaLibraryProps {
  apiBase: string
  onPlayTrack?: (track: Track) => void
  onPlayPlaylist?: (playlist: Track[]) => void
}

const MediaLibrary = memo(function MediaLibrary({ apiBase, onPlayTrack, onPlayPlaylist }: MediaLibraryProps) {
  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists' | 'playlists' | 'folders'>('tracks')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('title')
  const [filterGenre, setFilterGenre] = useState('all')
  
  const [tracks, setTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatePlaylistDialogOpen, setIsCreatePlaylistDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [isEnrichingMetadata, setIsEnrichingMetadata] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState('')
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('')
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: ''
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch library data from API
  const fetchLibraryData = async () => {
    setLoading(true)
    
    try {
      const [tracksResponse, foldersResponse, playlistsResponse] = await Promise.all([
        fetch(`${apiBase}/media/tracks`),
        fetch(`${apiBase}/media/folders`),
        fetch(`${apiBase}/media/playlists`)
      ])

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json()
        setTracks(tracksData.tracks || [])
        
        // Extract unique genres
        const uniqueGenres = new Set<string>()
        tracksData.tracks?.forEach((track: Track) => {
          if (track.genre) {
            track.genre.split(',').forEach((genre: string) => {
              uniqueGenres.add(genre.trim())
            })
          }
        })
        setGenres(Array.from(uniqueGenres).sort())
      }

      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json()
        setFolders(foldersData.folders || [])
      }

      if (playlistsResponse.ok) {
        const playlistsData = await playlistsResponse.json()
        // Convert playlist format to match frontend interface
        const formattedPlaylists = playlistsData.playlists?.map((playlist: any) => ({
          ...playlist,
          tracks: [] // We'll load tracks separately when needed
        })) || []
        setPlaylists(formattedPlaylists)
      }

    } catch (error) {
      console.error('Error fetching library data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLibraryData()
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // File upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      handleFileUpload(Array.from(files))
    }
  }

  const handleFileUpload = async (files: File[]) => {
    const newUploads: UploadProgress[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading' as const
    }))
    
    setUploadProgress(newUploads)
    setIsUploadDialogOpen(true)

    try {
      const formData = new FormData()
      
      // Add files to form data
      files.forEach(file => {
        formData.append('files', file)
      })
      
      // Add folder ID if uploading to a specific folder
      if (currentFolder) {
        formData.append('folderId', currentFolder)
      }

      // Create XMLHttpRequest for upload progress tracking
      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(prev => 
            prev.map(upload => ({ ...upload, progress }))
          )
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          
          // Update upload status for each file
          setUploadProgress(prev => 
            prev.map((upload, index) => {
              const result = response.results[index]
              return {
                ...upload,
                progress: 100,
                status: result.success ? 'complete' : 'error',
                error: result.success ? undefined : result.error
              }
            })
          )
          
          // Refresh library data
          fetchLibraryData()
        } else {
          // Handle error
          setUploadProgress(prev => 
            prev.map(upload => ({
              ...upload,
              status: 'error',
              error: 'Upload failed'
            }))
          )
        }
      })

      // Handle error
      xhr.addEventListener('error', () => {
        setUploadProgress(prev => 
          prev.map(upload => ({
            ...upload,
            status: 'error',
            error: 'Upload failed'
          }))
        )
      })

      // Send request
      xhr.open('POST', `${apiBase}/media/upload`)
      xhr.send(formData)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress(prev => 
        prev.map(upload => ({
          ...upload,
          status: 'error',
          error: 'Upload failed'
        }))
      )
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('audio/') || 
      ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext))
    )
    
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  // YouTube download handler
  const handleYouTubeDownload = async () => {
    console.log('🎬 [FRONTEND] handleYouTubeDownload called with URL:', youtubeUrl)
    console.log('🎬 [FRONTEND] API Base:', apiBase)
    
    if (!youtubeUrl.trim()) {
      console.log('🎬 [FRONTEND] No URL provided, exiting')
      return
    }
    
    setIsDownloading(true)
    setDownloadError('')
    
    try {
      console.log(`🎬 [FRONTEND] Starting YouTube download: ${youtubeUrl}`)
      console.log(`🎬 [FRONTEND] Full URL: ${apiBase}/media/download-youtube`)
      
      const response = await fetch(`${apiBase}/media/download-youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: youtubeUrl,
          folderId: currentFolder
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Download failed')
      }

      console.log(`✅ [FRONTEND] YouTube download successful: ${result.track.title}`)
      
      // Refresh tracks to show the new download
      await fetchLibraryData()
      
      // Reset form and close dialog
      setYoutubeUrl('')
      setIsYouTubeDialogOpen(false)
      
    } catch (error) {
      console.error('❌ [FRONTEND] YouTube download failed:', error)
      setDownloadError(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  // Metadata enrichment handler
  const handleBatchEnrichMetadata = async () => {
    setIsEnrichingMetadata(true)
    setEnrichmentProgress('Starting metadata enrichment...')
    
    try {
      console.log('🎵 [FRONTEND] Starting batch metadata enrichment')
      
      const response = await fetch(`${apiBase}/media/enrich-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          limit: 10,
          skipExisting: true
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Enrichment failed')
      }

      console.log('✅ [FRONTEND] Metadata enrichment completed:', result)
      setEnrichmentProgress(`Completed! Processed ${result.processed} tracks`)
      
      // Refresh tracks to show updated metadata
      await fetchLibraryData()
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsEnrichingMetadata(false)
        setEnrichmentProgress('')
      }, 3000)
      
    } catch (error) {
      console.error('❌ [FRONTEND] Metadata enrichment failed:', error)
      setEnrichmentProgress(`Error: ${error instanceof Error ? error.message : 'Enrichment failed'}`)
      
      setTimeout(() => {
        setIsEnrichingMetadata(false)
        setEnrichmentProgress('')
      }, 5000)
    }
  }

  // Folder management
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    
    try {
      const response = await fetch(`${apiBase}/media/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolder
        })
      })

      if (response.ok) {
        setNewFolderName('')
        setIsCreateFolderDialogOpen(false)
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    }
  }

  const deleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`${apiBase}/media/folders/${folderId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to delete folder')
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Playlist management
  const createPlaylist = async () => {
    if (!newPlaylist.name.trim()) return
    
    try {
      const response = await fetch(`${apiBase}/media/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylist.name,
          description: newPlaylist.description,
          isPublic: newPlaylist.isPublic,
          tags: newPlaylist.tags ? newPlaylist.tags.split(',').map(t => t.trim()) : []
        })
      })

      if (response.ok) {
        setNewPlaylist({ name: '', description: '', isPublic: false, tags: '' })
        setIsCreatePlaylistDialogOpen(false)
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to create playlist')
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
    }
  }

  const deletePlaylist = async (playlistId: string) => {
    try {
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to delete playlist')
      }
    } catch (error) {
      console.error('Error deleting playlist:', error)
    }
  }

  const getCurrentFolderPath = () => {
    if (!currentFolder) return '/music'
    const folder = folders.find(f => f.id === currentFolder)
    return folder?.path || '/music'
  }

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.album.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGenre = filterGenre === 'all' || track.genre === filterGenre
    const matchesFolder = !currentFolder || track.folderId === currentFolder
    return matchesSearch && matchesGenre && matchesFolder
  }).sort((a, b) => {
    switch (sortBy) {
      case 'title': return a.title.localeCompare(b.title)
      case 'artist': return a.artist.localeCompare(b.artist)
      case 'album': return a.album.localeCompare(b.album)
      case 'year': return (b.year || 0) - (a.year || 0)
      case 'duration': return b.duration - a.duration
      default: return 0
    }
  })

  const handlePlayTrack = async (track: Track) => {
    try {
      const response = await fetch(`${apiBase}/audio/play-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      });

      if (response.ok) {
        console.log('Track playback started:', track.title);
        onPlayTrack?.(track);
      } else {
        console.error('Failed to start track playback');
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  }

  const handlePlayAll = async () => {
    try {
      const response = await fetch(`${apiBase}/audio/play-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: filteredTracks, startIndex: 0 })
      });

      if (response.ok) {
        console.log('Playlist playback started');
        onPlayPlaylist?.(filteredTracks);
      } else {
        console.error('Failed to start playlist playback');
      }
    } catch (error) {
      console.error('Error playing playlist:', error);
    }
  }

  const handleShuffleAll = async () => {
    const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
    
    try {
      const response = await fetch(`${apiBase}/audio/play-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: shuffled, startIndex: 0 })
      });

      if (response.ok) {
        console.log('Shuffled playlist playback started');
        onPlayPlaylist?.(shuffled);
      } else {
        console.error('Failed to start shuffled playlist playback');
      }
    } catch (error) {
      console.error('Error playing shuffled playlist:', error);
    }
  }

  // Component for rendering tracks
  const TrackListView = () => (
    <motion.div 
      className="space-y-2"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {filteredTracks.map((track, index) => (
        <motion.div
          key={track.id}
          variants={fadeInUp}
          transition={{ delay: index * 0.05 }}
        >
          <motion.div
          >
            <GlassCard className="p-4 hover:bg-slate-800/60 transition-all group cursor-pointer">
              <div className="flex items-center space-x-4">
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Music className="w-5 h-5 text-slate-300" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-slate-100 truncate">{track.title}</h3>
                    {track.isLiked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Heart className="w-4 h-4 text-red-500 fill-current" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 truncate">{track.artist} • {track.album}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {track.genre && (
                      <Badge variant="outline" className="text-xs">
                        {track.genre}
                      </Badge>
                    )}
                    {track.year && (
                      <span className="text-xs text-slate-400">{track.year}</span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-slate-400">
                  {formatDuration(track.duration)}
                </div>

                <motion.div
                  className="opacity-70 group-hover:opacity-100 transition-opacity flex space-x-1"
                  initial={{ opacity: 0.7 }}
                  whileHover={{ opacity: 1 }}
                >
                  <motion.div
                    variants={buttonPulse}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayTrack(track);
                      }}
                      className="h-8 w-8 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30"
                      title={`Play "${track.title}"`}
                    >
                      <Play className="w-4 h-4 text-blue-300" />
                    </Button>
                  </motion.div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-slate-600/40"
                    title="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </motion.div>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  )

  // Component for rendering folders
  const FolderView = () => (
    <motion.div 
      className="space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Breadcrumb */}
      <motion.div 
        className="flex items-center space-x-2 text-sm text-slate-300"
        variants={fadeInUp}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentFolder(null)}
          className="p-1 h-auto"
        >
          <Home className="w-4 h-4 mr-1" />
          Library
        </Button>
        {currentFolder && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span>{folders.find(f => f.id === currentFolder)?.name}</span>
          </>
        )}
      </motion.div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {folders
          .filter(f => f.parentId === currentFolder)
          .map((folder, index) => (
          <motion.div
            key={folder.id}
            variants={scaleIn}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <motion.div
              variants={cardHover}
              whileHover="hover"
              whileTap="tap"
            >
              <GlassCard 
                className="p-4 hover:bg-slate-800/60 transition-all group cursor-pointer text-center"
                onClick={() => setCurrentFolder(folder.id)}
              >
                <motion.div
                  className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Folder className="w-8 h-8 text-blue-400" />
                </motion.div>
                
                <h3 className="font-semibold text-slate-100 text-sm truncate mb-1">{folder.name}</h3>
                <p className="text-xs text-slate-400">{folder.trackCount} tracks</p>
                
                <motion.div
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-2"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card border-slate-700/50">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Delete Folder</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to delete "{folder.name}"? This will also remove all tracks in this folder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteFolder(folder.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </motion.div>
              </GlassCard>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Tracks in current folder */}
      {filteredTracks.length > 0 && (
        <motion.div variants={fadeInUp}>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Tracks</h3>
          <TrackListView />
        </motion.div>
      )}
    </motion.div>
  )

  // Component for rendering playlists
  const PlaylistView = () => (
    <motion.div 
      className="space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((playlist, index) => (
          <motion.div
            key={playlist.id}
            variants={scaleIn}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <motion.div
              variants={cardHover}
              whileHover="hover"
              whileTap="tap"
            >
              <GlassCard className="p-6 hover:bg-slate-800/60 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center">
                    <Music className="w-8 h-8 text-purple-400" />
                  </div>
                  
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card border-slate-700/50">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Delete Playlist</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete "{playlist.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePlaylist(playlist.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>
                </div>
                
                <h3 className="font-semibold text-slate-100 mb-2">{playlist.name}</h3>
                {playlist.description && (
                  <p className="text-sm text-slate-300 mb-3 line-clamp-2">{playlist.description}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{playlist.trackCount} tracks</span>
                  <span>{formatDuration(playlist.duration)}</span>
                </div>
                
                {playlist.tags && playlist.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {playlist.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => onPlayPlaylist?.(playlist.tracks)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-card border-slate-600/50"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center"
        >
          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-blue-400">Drop audio files to upload</p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div 
        className="flex flex-col space-y-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={fadeInUp}>
          <h2 className="text-2xl font-bold text-slate-100">Music Library</h2>
          <p className="text-slate-300">Browse and manage your music collection</p>
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div variants={fadeInUp} transition={{ delay: 0.1 }}>
          <GlassCard className="p-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-5 glass-card">
                <TabsTrigger value="tracks">Tracks</TabsTrigger>
                <TabsTrigger value="folders">Folders</TabsTrigger>
                <TabsTrigger value="playlists">Playlists</TabsTrigger>
                <TabsTrigger value="albums">Albums</TabsTrigger>
                <TabsTrigger value="artists">Artists</TabsTrigger>
              </TabsList>
            </Tabs>
          </GlassCard>
        </motion.div>

        {/* Search and Controls */}
        <motion.div variants={fadeInUp} transition={{ delay: 0.2 }}>
          <GlassCard className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <motion.div 
                className="flex-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, ...springConfig }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search tracks, artists, albums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 glass-card border-slate-600/50"
                  />
                </div>
              </motion.div>

              {/* Controls */}
              <motion.div 
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, ...springConfig }}
              >
                {/* Upload Button */}
                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </motion.div>

                {/* YouTube Download Button */}
                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Dialog open={isYouTubeDialogOpen} onOpenChange={setIsYouTubeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="glass-card border-slate-600/50 bg-gradient-to-r from-red-600/20 to-pink-600/20 hover:from-red-600/30 hover:to-pink-600/30"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        YouTube
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card border-slate-700/50">
                      <DialogHeader>
                        <DialogTitle className="text-slate-100">Download from YouTube</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="youtubeUrl">Video URL</Label>
                          <Input
                            id="youtubeUrl"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="glass-card border-slate-600/50"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Supports YouTube, YouTube Music, and other yt-dlp compatible sites
                          </p>
                        </div>
                        {downloadError && (
                          <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            {downloadError}
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <Button 
                            onClick={handleYouTubeDownload} 
                            disabled={!youtubeUrl.trim() || isDownloading}
                            className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                          >
                            {isDownloading ? (
                              <>
                                <motion.div
                                  className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsYouTubeDialogOpen(false)
                              setYoutubeUrl('')
                              setDownloadError('')
                            }}
                            className="glass-card border-slate-600/50"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </motion.div>

                {/* Metadata Enrichment Button */}
                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    onClick={handleBatchEnrichMetadata}
                    disabled={isEnrichingMetadata}
                    variant="outline"
                    className="glass-card border-slate-600/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30"
                  >
                    {isEnrichingMetadata ? (
                      <>
                        <motion.div
                          className="w-4 h-4 mr-2 border-2 border-purple-400/30 border-t-purple-400 rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        Enriching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Enrich Metadata
                      </>
                    )}
                  </Button>
                </motion.div>

                {/* Create Folder Button */}
                {activeTab === 'folders' && (
                  <motion.div
                    variants={buttonPulse}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="glass-card border-slate-600/50">
                          <FolderPlus className="w-4 h-4 mr-2" />
                          New Folder
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-card border-slate-700/50">
                        <DialogHeader>
                          <DialogTitle className="text-slate-100">Create New Folder</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="folderName">Folder Name</Label>
                            <Input
                              id="folderName"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="Enter folder name"
                              className="glass-card border-slate-600/50"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
                              Create
                            </Button>
                            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </motion.div>
                )}

                {/* Create Playlist Button */}
                {activeTab === 'playlists' && (
                  <motion.div
                    variants={buttonPulse}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Dialog open={isCreatePlaylistDialogOpen} onOpenChange={setIsCreatePlaylistDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="glass-card border-slate-600/50">
                          <Plus className="w-4 h-4 mr-2" />
                          New Playlist
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-card border-slate-700/50">
                        <DialogHeader>
                          <DialogTitle className="text-slate-100">Create New Playlist</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="playlistName">Playlist Name</Label>
                            <Input
                              id="playlistName"
                              value={newPlaylist.name}
                              onChange={(e) => setNewPlaylist(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Enter playlist name"
                              className="glass-card border-slate-600/50"
                            />
                          </div>
                          <div>
                            <Label htmlFor="playlistDescription">Description (Optional)</Label>
                            <Textarea
                              id="playlistDescription"
                              value={newPlaylist.description}
                              onChange={(e) => setNewPlaylist(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Enter playlist description"
                              className="glass-card border-slate-600/50"
                              rows={3}
                            />
                          </div>
                          <div>
                            <Label htmlFor="playlistTags">Tags (Optional)</Label>
                            <Input
                              id="playlistTags"
                              value={newPlaylist.tags}
                              onChange={(e) => setNewPlaylist(prev => ({ ...prev, tags: e.target.value }))}
                              placeholder="Enter tags separated by commas"
                              className="glass-card border-slate-600/50"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button onClick={createPlaylist} disabled={!newPlaylist.name.trim()}>
                              Create Playlist
                            </Button>
                            <Button variant="outline" onClick={() => setIsCreatePlaylistDialogOpen(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </motion.div>
                )}

                {/* View Mode Toggle for tracks */}
                {activeTab === 'tracks' && (
                  <>
                    <motion.div
                      variants={buttonPulse}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant={viewMode === 'list' ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setViewMode('list')}
                        className="glass-card"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </motion.div>

                    <motion.div
                      variants={buttonPulse}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant={viewMode === 'grid' ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setViewMode('grid')}
                        className="glass-card"
                      >
                        <Grid className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </div>

            {/* Action Buttons for tracks */}
            {activeTab === 'tracks' && filteredTracks.length > 0 && (
              <motion.div 
                className="flex flex-wrap gap-2 mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button 
                    onClick={handlePlayAll}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play All ({filteredTracks.length})
                  </Button>
                </motion.div>

                <motion.div
                  variants={buttonPulse}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button 
                    variant="outline"
                    onClick={handleShuffleAll}
                    className="glass-card border-slate-600/50"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Shuffle
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div
        variants={fadeInUp}
        transition={{ delay: 0.3 }}
      >
        {loading ? (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Music className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            </motion.div>
            <p className="text-slate-300">Loading your music library...</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'tracks' && (
                filteredTracks.length === 0 ? (
                  <motion.div 
                    className="text-center py-12"
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                  >
                    <Music className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-300">No tracks found</p>
                    <p className="text-sm text-slate-400 mt-2">Try adjusting your search or upload some music</p>
                  </motion.div>
                ) : (
                  <TrackListView />
                )
              )}
              
              {activeTab === 'folders' && <FolderView />}
              {activeTab === 'playlists' && <PlaylistView />}
              
              {(activeTab === 'albums' || activeTab === 'artists') && (
                <motion.div 
                  className="text-center py-12"
                  variants={fadeInUp}
                  initial="initial"
                  animate="animate"
                >
                  <Music className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-300">{activeTab} view coming soon</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Progress Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Uploading Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {uploadProgress.map((upload, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 truncate flex-1 mr-2">
                    {upload.fileName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {upload.status === 'complete' ? 'Complete' : `${upload.progress}%`}
                  </span>
                </div>
                <Progress 
                  value={upload.progress} 
                  className={`w-full h-2 ${
                    upload.status === 'complete' ? 'bg-green-500/20' : 
                    upload.status === 'error' ? 'bg-red-500/20' : 'bg-slate-700/50'
                  }`}
                />
                {upload.error && (
                  <p className="text-xs text-red-400">{upload.error}</p>
                )}
              </motion.div>
            ))}
          </div>
          {uploadProgress.every(upload => upload.status === 'complete') && (
            <div className="flex justify-end">
              <Button onClick={() => setIsUploadDialogOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
})

export default MediaLibrary