import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Shuffle, Play, FolderPlus, Plus, Radio } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { 
  pageVariants, 
  staggerContainer, 
  fadeInUp
} from '../lib/animations'

// Import extracted components
import { MediaSearch } from './media/MediaSearch'
import { MediaUpload } from './media/MediaUpload'
import { TrackListView } from './media/TrackListView'
import { FolderView } from './media/FolderView'
import { PlaylistView } from './media/PlaylistView'
import { MetadataSelectionDialog } from './media/MetadataSelectionDialog'

// Import types
import type { Track, Folder, Playlist, MediaLibraryProps } from '../types/media'

const MediaLibrary = memo(function MediaLibrary({ apiBase, onPlayTrack, onPlayPlaylist }: MediaLibraryProps) {
  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists' | 'playlists' | 'folders'>('tracks')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('title')
  const [filterGenre, setFilterGenre] = useState('all')
  
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog states
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatePlaylistDialogOpen, setIsCreatePlaylistDialogOpen] = useState(false)
  const [isEditPlaylistDialogOpen, setIsEditPlaylistDialogOpen] = useState(false)
  const [isEditTrackDialogOpen, setIsEditTrackDialogOpen] = useState(false)
  const [isAddToFolderDialogOpen, setIsAddToFolderDialogOpen] = useState(false)
  const [isAddToPlaylistDialogOpen, setIsAddToPlaylistDialogOpen] = useState(false)
  const [isDeleteTrackDialogOpen, setIsDeleteTrackDialogOpen] = useState(false)
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  const [isAddRadioStreamDialogOpen, setIsAddRadioStreamDialogOpen] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [dragOver, setDragOver] = useState(false)
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('')
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: ''
  })
  const [editedPlaylist, setEditedPlaylist] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: ''
  })
  const [editedTrack, setEditedTrack] = useState<Partial<Track>>({})
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('')
  const [newRadioStream, setNewRadioStream] = useState({
    title: '',
    artist: '',
    streamUrl: '',
    genre: ''
  })

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
  }

  // Folder creation
  const createFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const response = await fetch(`${apiBase}/media/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

  // Playlist creation
  const createPlaylist = async () => {
    if (!newPlaylist.name.trim()) return

    try {
      const response = await fetch(`${apiBase}/media/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newPlaylist,
          tags: newPlaylist.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        })
      })

      if (response.ok) {
        setNewPlaylist({
          name: '',
          description: '',
          isPublic: false,
          tags: ''
        })
        setIsCreatePlaylistDialogOpen(false)
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to create playlist')
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
    }
  }

  const createRadioStream = async () => {
    if (!newRadioStream.title.trim() || !newRadioStream.artist.trim() || !newRadioStream.streamUrl.trim()) {
      return
    }

    try {
      const response = await fetch(`${apiBase}/media/radio-streams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRadioStream)
      })

      if (response.ok) {
        setNewRadioStream({
          title: '',
          artist: '',
          streamUrl: '',
          genre: ''
        })
        setIsAddRadioStreamDialogOpen(false)
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to create radio stream')
      }
    } catch (error) {
      console.error('Error creating radio stream:', error)
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

  // Track management functions
  const handleEditTrack = (track: Track) => {
    setSelectedTrack(track)
    setEditedTrack({
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      year: track.year
    })
    setIsEditTrackDialogOpen(true)
  }

  const handleAddToFolder = (track: Track) => {
    setSelectedTrack(track)
    setSelectedFolderId('')
    setIsAddToFolderDialogOpen(true)
  }

  const handleAddToPlaylist = (track: Track) => {
    setSelectedTrack(track)
    setSelectedPlaylistId('')
    setIsAddToPlaylistDialogOpen(true)
  }

  const handleDeleteTrack = (track: Track) => {
    setSelectedTrack(track)
    setIsDeleteTrackDialogOpen(true)
  }

  const handleDownloadTrack = (track: Track) => {
    // Create a download link
    const link = document.createElement('a')
    link.href = `${apiBase}/media/tracks/${track.id}/download`
    link.download = `${track.artist} - ${track.title}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEnhanceMetadata = (track: Track) => {
    setSelectedTrack(track)
    setIsMetadataDialogOpen(true)
  }

  const updateTrackMetadata = async () => {
    if (!selectedTrack) return

    try {
      console.log('Updating track with data:', editedTrack)
      const response = await fetch(`${apiBase}/media/tracks/${selectedTrack.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedTrack)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Update result:', result)
        setIsEditTrackDialogOpen(false)
        setSelectedTrack(null)
        setEditedTrack({})
        fetchLibraryData() // Refresh data
      } else {
        const errorText = await response.text()
        console.error('Failed to update track:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error updating track:', error)
    }
  }

  const moveTrackToFolder = async () => {
    if (!selectedTrack) return

    try {
      const response = await fetch(`${apiBase}/media/tracks/${selectedTrack.id}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folderId: selectedFolderId || null
        })
      })

      if (response.ok) {
        setIsAddToFolderDialogOpen(false)
        setSelectedTrack(null)
        setSelectedFolderId('')
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to move track')
      }
    } catch (error) {
      console.error('Error moving track:', error)
    }
  }

  const addTrackToPlaylist = async () => {
    if (!selectedTrack || !selectedPlaylistId) return

    try {
      const response = await fetch(`${apiBase}/media/playlists/${selectedPlaylistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trackId: selectedTrack.id
        })
      })

      if (response.ok) {
        setIsAddToPlaylistDialogOpen(false)
        setSelectedTrack(null)
        setSelectedPlaylistId('')
        fetchLibraryData() // Refresh data
      } else {
        const errorData = await response.json()
        console.error('Failed to add track to playlist:', errorData)
      }
    } catch (error) {
      console.error('Error adding track to playlist:', error)
    }
  }

  const updatePlaylistMetadata = async () => {
    if (!selectedPlaylist) return

    try {
      const response = await fetch(`${apiBase}/media/playlists/${selectedPlaylist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editedPlaylist.name,
          description: editedPlaylist.description,
          isPublic: editedPlaylist.isPublic,
          tags: editedPlaylist.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        })
      })

      if (response.ok) {
        setIsEditPlaylistDialogOpen(false)
        setSelectedPlaylist(null)
        setEditedPlaylist({
          name: '',
          description: '',
          isPublic: false,
          tags: ''
        })
        fetchLibraryData() // Refresh data
      } else {
        const errorData = await response.json()
        console.error('Failed to update playlist:', errorData)
      }
    } catch (error) {
      console.error('Error updating playlist:', error)
    }
  }

  const deleteTrack = async () => {
    if (!selectedTrack) return

    try {
      const response = await fetch(`${apiBase}/media/tracks/${selectedTrack.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setIsDeleteTrackDialogOpen(false)
        setSelectedTrack(null)
        fetchLibraryData() // Refresh data
      } else {
        console.error('Failed to delete track')
      }
    } catch (error) {
      console.error('Error deleting track:', error)
    }
  }

  // Track filtering and sorting

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = !searchQuery || 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.album.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesGenre = filterGenre === 'all' || track.genre?.includes(filterGenre)
    const matchesFolder = !currentFolder || track.folderId === currentFolder
    
    return matchesSearch && matchesGenre && matchesFolder
  }).sort((a, b) => {
    switch (sortBy) {
      case 'title': return a.title.localeCompare(b.title)
      case 'artist': return a.artist.localeCompare(b.artist)
      case 'album': return a.album.localeCompare(b.album)
      case 'year': return (b.year || 0) - (a.year || 0)
      default: return 0
    }
  })

  const handlePlayTrack = async (track: Track) => {
    try {
      onPlayTrack?.(track)
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const handlePlayAll = async () => {
    if (filteredTracks.length === 0) return
    
    try {
      onPlayPlaylist?.(filteredTracks)
    } catch (error) {
      console.error('Error playing all tracks:', error)
    }
  }

  const handleShuffleAll = async () => {
    if (filteredTracks.length === 0) return
    
    try {
      const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5)
      onPlayPlaylist?.(shuffled)
    } catch (error) {
      console.error('Error playing shuffled playlist:', error)
    }
  }

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
        <MediaSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterGenre={filterGenre}
          onGenreFilterChange={setFilterGenre}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          genres={genres}
          activeTab={activeTab}
        />

        {/* Action Buttons */}
        <motion.div 
          variants={fadeInUp} 
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3"
        >
          <MediaUpload
            apiBase={apiBase}
            currentFolder={currentFolder}
            onRefreshLibrary={fetchLibraryData}
            dragOver={dragOver}
          />

          {activeTab === 'tracks' && (
            <Dialog open={isAddRadioStreamDialogOpen} onOpenChange={setIsAddRadioStreamDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="glass-card border-slate-600/50"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  Add Radio Stream
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-slate-700/50">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">Add Internet Radio Stream</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="streamTitle">Stream Title</Label>
                    <Input
                      id="streamTitle"
                      value={newRadioStream.title}
                      onChange={(e) => setNewRadioStream(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., BBC Radio 1"
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="streamArtist">Station Name</Label>
                    <Input
                      id="streamArtist"
                      value={newRadioStream.artist}
                      onChange={(e) => setNewRadioStream(prev => ({ ...prev, artist: e.target.value }))}
                      placeholder="e.g., BBC"
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="streamUrl">Stream URL</Label>
                    <Input
                      id="streamUrl"
                      value={newRadioStream.streamUrl}
                      onChange={(e) => setNewRadioStream(prev => ({ ...prev, streamUrl: e.target.value }))}
                      placeholder="http://stream.example.com/radio"
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="streamGenre">Genre (optional)</Label>
                    <Input
                      id="streamGenre"
                      value={newRadioStream.genre}
                      onChange={(e) => setNewRadioStream(prev => ({ ...prev, genre: e.target.value }))}
                      placeholder="e.g., Pop, Rock, News"
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddRadioStreamDialogOpen(false)
                        setNewRadioStream({
                          title: '',
                          artist: '',
                          streamUrl: '',
                          genre: ''
                        })
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createRadioStream}
                      disabled={!newRadioStream.title.trim() || !newRadioStream.artist.trim() || !newRadioStream.streamUrl.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Add Stream
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {activeTab === 'tracks' && filteredTracks.length > 0 && (
            <>
              <Button
                onClick={handlePlayAll}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Play All
              </Button>
              <Button
                variant="outline"
                onClick={handleShuffleAll}
                className="glass-card border-slate-600/50"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Shuffle
              </Button>
            </>
          )}

          {activeTab === 'folders' && (
            <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="glass-card border-slate-600/50"
                >
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
                      placeholder="Enter folder name..."
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateFolderDialogOpen(false)
                        setNewFolderName('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createFolder}
                      disabled={!newFolderName.trim()}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {activeTab === 'playlists' && (
            <Dialog open={isCreatePlaylistDialogOpen} onOpenChange={setIsCreatePlaylistDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="glass-card border-slate-600/50"
                >
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
                    <Label htmlFor="playlistName">Name</Label>
                    <Input
                      id="playlistName"
                      value={newPlaylist.name}
                      onChange={(e) => setNewPlaylist(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter playlist name..."
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="playlistDescription">Description (optional)</Label>
                    <Textarea
                      id="playlistDescription"
                      value={newPlaylist.description}
                      onChange={(e) => setNewPlaylist(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your playlist..."
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="playlistTags">Tags (comma-separated)</Label>
                    <Input
                      id="playlistTags"
                      value={newPlaylist.tags}
                      onChange={(e) => setNewPlaylist(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="pop, rock, favorites..."
                      className="glass-card border-slate-600/50"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreatePlaylistDialogOpen(false)
                        setNewPlaylist({
                          name: '',
                          description: '',
                          isPublic: false,
                          tags: ''
                        })
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createPlaylist}
                      disabled={!newPlaylist.name.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {loading ? (
          <motion.div 
            className="text-center py-12"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <Music className="w-16 h-16 text-slate-400 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-300">Loading your music library...</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}>
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
                  <TrackListView
                    tracks={filteredTracks}
                    apiBase={apiBase}
                    onPlayTrack={handlePlayTrack}
                    formatDuration={formatDuration}
                    onEnhanceMetadata={handleEnhanceMetadata}
                    onEditTrack={handleEditTrack}
                    onAddToFolder={handleAddToFolder}
                    onAddToPlaylist={handleAddToPlaylist}
                    onDeleteTrack={handleDeleteTrack}
                    onDownloadTrack={handleDownloadTrack}
                  />
                )
              )}
              
              {activeTab === 'folders' && (
                <FolderView
                  folders={folders}
                  currentFolder={currentFolder}
                  apiBase={apiBase}
                  onFolderChange={setCurrentFolder}
                  onDeleteFolder={deleteFolder}
                  onUpdate={fetchLibraryData}
                  filteredTracks={filteredTracks}
                  onPlayTrack={handlePlayTrack}
                  formatDuration={formatDuration}
                />
              )}
              
              {activeTab === 'playlists' && (
                <PlaylistView
                  playlists={playlists}
                  apiBase={apiBase}
                  onPlayPlaylist={onPlayPlaylist}
                  onDeletePlaylist={deletePlaylist}
                  onUpdate={fetchLibraryData}
                  formatDuration={formatDuration}
                />
              )}
              
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

      {/* Track Management Dialogs */}
      
      {/* Edit Track Dialog */}
      <Dialog open={isEditTrackDialogOpen} onOpenChange={setIsEditTrackDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTitle">Title</Label>
              <Input
                id="editTitle"
                value={editedTrack.title || ''}
                onChange={(e) => setEditedTrack(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Track title..."
                className="glass-card border-slate-600/50"
              />
            </div>
            <div>
              <Label htmlFor="editArtist">Artist</Label>
              <Input
                id="editArtist"
                value={editedTrack.artist || ''}
                onChange={(e) => setEditedTrack(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="Artist name..."
                className="glass-card border-slate-600/50"
              />
            </div>
            <div>
              <Label htmlFor="editAlbum">Album</Label>
              <Input
                id="editAlbum"
                value={editedTrack.album || ''}
                onChange={(e) => setEditedTrack(prev => ({ ...prev, album: e.target.value }))}
                placeholder="Album name..."
                className="glass-card border-slate-600/50"
              />
            </div>
            <div>
              <Label htmlFor="editGenre">Genre</Label>
              <Input
                id="editGenre"
                value={editedTrack.genre || ''}
                onChange={(e) => setEditedTrack(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="Genre..."
                className="glass-card border-slate-600/50"
              />
            </div>
            <div>
              <Label htmlFor="editYear">Year</Label>
              <Input
                id="editYear"
                type="number"
                value={editedTrack.year || ''}
                onChange={(e) => setEditedTrack(prev => ({ ...prev, year: parseInt(e.target.value) || undefined }))}
                placeholder="Release year..."
                className="glass-card border-slate-600/50"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditTrackDialogOpen(false)
                  setSelectedTrack(null)
                  setEditedTrack({})
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={updateTrackMetadata}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Folder Dialog */}
      <Dialog open={isAddToFolderDialogOpen} onOpenChange={setIsAddToFolderDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="selectFolder">Select Folder</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger className="glass-card border-slate-600/50">
                  <SelectValue placeholder="Choose a folder..." />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-700/50 bg-slate-800/95">
                  <SelectItem value="">No folder (root)</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddToFolderDialogOpen(false)
                  setSelectedTrack(null)
                  setSelectedFolderId('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={moveTrackToFolder}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                Move Track
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Playlist Dialog */}
      <Dialog open={isAddToPlaylistDialogOpen} onOpenChange={setIsAddToPlaylistDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add to Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="selectPlaylist">Select Playlist</Label>
              <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId}>
                <SelectTrigger className="glass-card border-slate-600/50">
                  <SelectValue placeholder="Choose a playlist..." />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-700/50 bg-slate-800/95">
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddToPlaylistDialogOpen(false)
                  setSelectedTrack(null)
                  setSelectedPlaylistId('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={addTrackToPlaylist}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Add to Playlist
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Playlist Dialog */}
      <Dialog open={isEditPlaylistDialogOpen} onOpenChange={setIsEditPlaylistDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="playlistName">Playlist Name</Label>
              <Input
                id="playlistName"
                value={editedPlaylist.name}
                onChange={(e) => setEditedPlaylist({ ...editedPlaylist, name: e.target.value })}
                placeholder="My Awesome Playlist"
                className="glass-card border-slate-600/50"
              />
            </div>
            <div>
              <Label htmlFor="playlistDescription">Description (optional)</Label>
              <Textarea
                id="playlistDescription"
                value={editedPlaylist.description}
                onChange={(e) => setEditedPlaylist({ ...editedPlaylist, description: e.target.value })}
                placeholder="A collection of my favorite songs..."
                className="glass-card border-slate-600/50 resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="playlistTags">Tags (comma-separated)</Label>
              <Input
                id="playlistTags"
                value={editedPlaylist.tags}
                onChange={(e) => setEditedPlaylist({ ...editedPlaylist, tags: e.target.value })}
                placeholder="rock, indie, favorites"
                className="glass-card border-slate-600/50"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={editedPlaylist.isPublic}
                onChange={(e) => setEditedPlaylist({ ...editedPlaylist, isPublic: e.target.checked })}
                className="rounded border-slate-600"
              />
              <Label htmlFor="isPublic">Make this playlist public</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditPlaylistDialogOpen(false)
                  setSelectedPlaylist(null)
                  setEditedPlaylist({
                    name: '',
                    description: '',
                    isPublic: false,
                    tags: ''
                  })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={updatePlaylistMetadata}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Track Dialog */}
      <AlertDialog open={isDeleteTrackDialogOpen} onOpenChange={setIsDeleteTrackDialogOpen}>
        <AlertDialogContent className="glass-card border-slate-700/50 bg-slate-800/95">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete "{selectedTrack?.title}" by {selectedTrack?.artist}? 
              This action cannot be undone and will permanently remove the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setIsDeleteTrackDialogOpen(false)
                setSelectedTrack(null)
              }}
              className="glass-card border-slate-600/50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTrack}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
            >
              Delete Track
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Metadata Selection Dialog */}
      <MetadataSelectionDialog
        open={isMetadataDialogOpen}
        onOpenChange={setIsMetadataDialogOpen}
        track={selectedTrack}
        apiBase={apiBase}
        onMetadataApplied={fetchLibraryData}
      />
    </motion.div>
  )
})

export default MediaLibrary