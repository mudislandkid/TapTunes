import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Shuffle, Play, FolderPlus, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  const [dragOver, setDragOver] = useState(false)
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('')
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: ''
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
                    onPlayTrack={handlePlayTrack}
                    formatDuration={formatDuration}
                  />
                )
              )}
              
              {activeTab === 'folders' && (
                <FolderView 
                  folders={folders}
                  currentFolder={currentFolder}
                  onFolderChange={setCurrentFolder}
                  onDeleteFolder={deleteFolder}
                  filteredTracks={filteredTracks}
                  onPlayTrack={handlePlayTrack}
                  formatDuration={formatDuration}
                />
              )}
              
              {activeTab === 'playlists' && (
                <PlaylistView 
                  playlists={playlists}
                  onPlayPlaylist={onPlayPlaylist}
                  onDeletePlaylist={deletePlaylist}
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
    </motion.div>
  )
})

export default MediaLibrary