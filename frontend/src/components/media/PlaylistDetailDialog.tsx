import { useState, useEffect } from 'react'
import { Reorder } from 'framer-motion'
import { GripVertical, Trash2, Plus, Music, Image as ImageIcon, Check, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { GlassCard } from "@/components/ui/card"
import { AlbumArtPicker } from './AlbumArtPicker'
import type { Track } from '../../types/media'

interface PlaylistDetailDialogProps {
  playlistId: string | null
  apiBase: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

interface PlaylistWithTracks {
  id: string
  name: string
  description?: string
  tracks: Track[]
}

export function PlaylistDetailDialog({
  playlistId,
  apiBase,
  open,
  onOpenChange,
  onUpdate
}: PlaylistDetailDialogProps) {
  const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [albumArtPickerOpen, setAlbumArtPickerOpen] = useState(false)

  // Fetch playlist details
  useEffect(() => {
    if (open && playlistId) {
      setError(null)
      fetchPlaylist()
    }
  }, [open, playlistId])

  // Update local tracks when playlist changes
  useEffect(() => {
    if (playlist) {
      setTracks(playlist.tracks)
    }
  }, [playlist])

  const fetchPlaylist = async () => {
    if (!playlistId) return

    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}`)
      if (response.ok) {
        const data = await response.json()
        setPlaylist(data)
      }
    } catch (error) {
      console.error('Error fetching playlist:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchTracks = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`${apiBase}/media/tracks?search=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        // Filter out tracks already in playlist
        const playlistTrackIds = new Set(tracks.map(t => t.id))
        setSearchResults(data.tracks.filter((t: Track) => !playlistTrackIds.has(t.id)))
      }
    } catch (error) {
      console.error('Error searching tracks:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleReorder = async (newOrder: Track[]) => {
    const previousTracks = [...tracks]
    setTracks(newOrder)
    setError(null)

    try {
      const trackIds = newOrder.map(t => t.id)
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to reorder tracks (${response.status})`)
      }

      onUpdate?.()
    } catch (error) {
      console.error('Error reordering tracks:', error)
      setError(error instanceof Error ? error.message : 'Failed to reorder tracks')
      // Revert on error
      setTracks(previousTracks)
    }
  }

  const handleRemoveTrack = async (trackId: string) => {
    try {
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTracks(tracks.filter(t => t.id !== trackId))
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error removing track:', error)
    }
  }

  const handleAddTrack = async (track: Track) => {
    try {
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      })

      if (response.ok) {
        setTracks([...tracks, track])
        setSearchResults(searchResults.filter(t => t.id !== track.id))
        setSearchQuery('')
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error adding track:', error)
    }
  }

  const handleStartEditName = () => {
    setEditedName(playlist?.name || '')
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleSaveName = async () => {
    if (!playlistId || !editedName.trim() || editedName === playlist?.name) {
      setIsEditingName(false)
      return
    }

    try {
      const response = await fetch(`${apiBase}/media/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName.trim() })
      })

      if (response.ok) {
        setPlaylist(prev => prev ? { ...prev, name: editedName.trim() } : null)
        setIsEditingName(false)
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error updating playlist name:', error)
    }
  }

  const handleAlbumArtSelected = () => {
    fetchPlaylist()
    onUpdate?.()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-slate-700/50 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') handleCancelEditName()
                      }}
                      className="glass-card border-slate-600/50 text-slate-100"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveName}
                      className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEditName}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <DialogTitle className="text-slate-100 text-xl">
                      {playlist?.name || 'Playlist'}
                    </DialogTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEditName}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAlbumArtPickerOpen(true)}
                  className="glass-card border-slate-600/50 text-sm"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Change Album Art
                </Button>
              </div>

              {playlist?.description && (
                <p className="text-sm text-slate-300">{playlist.description}</p>
              )}
            </div>
          </DialogHeader>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Music className="w-12 h-12 text-slate-400 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden flex-1">
            {/* Add Track Section */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search tracks to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchTracks()}
                  className="glass-card border-slate-600/50"
                />
                <Button
                  onClick={searchTracks}
                  disabled={isSearching}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {searchResults.map((track) => (
                    <GlassCard
                      key={track.id}
                      className="p-2 flex items-center justify-between hover:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-600 rounded flex items-center justify-center overflow-hidden shrink-0">
                          {track.coverArt ? (
                            <img
                              src={`${apiBase}${track.coverArt}`}
                              alt={track.album}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-100 truncate">{track.title}</p>
                          <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{formatDuration(track.duration)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddTrack(track)}
                        className="ml-2 h-7 w-7 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>

            {/* Tracks List with Drag and Drop */}
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Tracks ({tracks.length})
              </h3>

              {tracks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tracks in this playlist</p>
                  <p className="text-xs mt-1">Search and add tracks above</p>
                </div>
              ) : (
                <Reorder.Group axis="y" values={tracks} onReorder={handleReorder} className="space-y-1">
                  {tracks.map((track) => (
                    <Reorder.Item key={track.id} value={track}>
                      <GlassCard className="p-2 flex items-center gap-2 cursor-move hover:bg-slate-800/60 group">
                        <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />

                        <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-600 rounded flex items-center justify-center overflow-hidden shrink-0">
                          {track.coverArt ? (
                            <img
                              src={`${apiBase}${track.coverArt}`}
                              alt={track.album}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-slate-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate">{track.title}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {track.artist} • {track.album}
                          </p>
                        </div>

                        <span className="text-xs text-slate-400 shrink-0">{formatDuration(track.duration)}</span>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveTrack(track.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </GlassCard>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <AlbumArtPicker
      type="playlist"
      id={playlistId || ''}
      apiBase={apiBase}
      open={albumArtPickerOpen}
      onOpenChange={setAlbumArtPickerOpen}
      onSelect={handleAlbumArtSelected}
    />
  </>
  )
}
