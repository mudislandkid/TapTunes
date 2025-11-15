import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit,
  Trash2,
  Radio,
  Music,
  Square,
  Volume2,
  Volume1,
  Search,
  Filter,
  CreditCard,
  Disc,
  User,
  ListMusic,
  Play,
  SkipForward,
  SkipBack,
  Book
} from 'lucide-react'
import { 
  pageVariants, 
  staggerContainer, 
  cardHover, 
  buttonPulse, 
  fadeInUp, 
  scaleIn,
  springConfig 
} from '../lib/animations'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GlassCard } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Track } from '../types/media'

interface RFIDCard {
  id: string;
  card_id: string;
  name: string;
  description?: string;
  assignment_type?: 'track' | 'playlist' | 'album' | 'artist' | 'audiobook' | 'stream' | 'action';
  assignment_id?: string;
  action?: string;
  created_at: string;
  last_used?: string;
  usage_count?: number;
  color?: string;
}

interface Playlist {
  id: string;
  name: string;
}

interface RFIDCardManagerProps {
  apiBase: string;
}

const assignmentTypeIcons = {
  track: Music,
  playlist: ListMusic,
  album: Disc,
  artist: User,
  audiobook: Book,
  stream: Radio,
  action: Play
}

const actionOptions = [
  { value: 'play_pause', label: 'Play/Pause', icon: Play },
  { value: 'next', label: 'Next Track', icon: SkipForward },
  { value: 'previous', label: 'Previous Track', icon: SkipBack },
  { value: 'stop', label: 'Stop', icon: Square },
  { value: 'volume_up', label: 'Volume Up', icon: Volume2 },
  { value: 'volume_down', label: 'Volume Down', icon: Volume1 }
]

const getCardColor = (card: RFIDCard) => {
  if (card.color) return card.color;

  switch (card.assignment_type) {
    case 'track': return '#10b981'; // green
    case 'playlist': return '#3b82f6'; // blue
    case 'album': return '#8b5cf6'; // purple
    case 'artist': return '#f59e0b'; // amber
    case 'audiobook': return '#a855f7'; // purple-500
    case 'stream': return '#06b6d4'; // cyan
    case 'action': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export default function RFIDCardManager({ apiBase }: RFIDCardManagerProps) {
  const [cards, setCards] = useState<RFIDCard[]>([])
  const [filteredCards, setFilteredCards] = useState<RFIDCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [editingCard, setEditingCard] = useState<RFIDCard | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isReadingCard, setIsReadingCard] = useState(false)
  const [readCardId, setReadCardId] = useState<string>('')
  
  // Assignment options
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [albums, setAlbums] = useState<{id: string, name: string}[]>([])
  const [artists, setArtists] = useState<{id: string, name: string}[]>([])
  const [audiobooks, setAudiobooks] = useState<{id: string, title: string, author: string}[]>([])
  const [streams, setStreams] = useState<{id: string, title: string, artist?: string}[]>([])
  
  const [newCard, setNewCard] = useState({
    cardId: '',
    name: '',
    description: '',
    assignmentType: 'track' as RFIDCard['assignment_type'],
    assignmentId: '',
    action: '',
    color: ''
  })

  useEffect(() => {
    fetchCards()
    fetchAssignmentOptions()
  }, [])

  useEffect(() => {
    filterCards()
  }, [cards, searchQuery, filterType])

  const fetchCards = async () => {
    try {
      const response = await fetch(`${apiBase}/rfid/cards`)
      const data = await response.json()
      setCards(data.cards || [])
    } catch (error) {
      console.error('Failed to fetch RFID cards:', error)
    }
  }

  const fetchAssignmentOptions = async () => {
    try {
      // Fetch tracks
      const tracksResponse = await fetch(`${apiBase}/media/tracks`)
      const tracksData = await tracksResponse.json()
      setTracks(tracksData.tracks || [])

      // Fetch playlists
      const playlistsResponse = await fetch(`${apiBase}/media/playlists`)
      const playlistsData = await playlistsResponse.json()
      setPlaylists(playlistsData.playlists || [])

      // Fetch albums
      const albumsResponse = await fetch(`${apiBase}/rfid/albums`)
      const albumsData = await albumsResponse.json()
      setAlbums(albumsData.albums || [])

      // Fetch artists
      const artistsResponse = await fetch(`${apiBase}/rfid/artists`)
      const artistsData = await artistsResponse.json()
      setArtists(artistsData.artists || [])

      // Fetch audiobooks
      const audiobooksResponse = await fetch(`${apiBase}/audiobooks`)
      const audiobooksData = await audiobooksResponse.json()
      setAudiobooks(audiobooksData || [])

      // Fetch streams (radio stations)
      const streamsResponse = await fetch(`${apiBase}/media/tracks?type=stream`)
      const streamsData = await streamsResponse.json()
      setStreams((streamsData.tracks || []).filter((t: any) => t.trackType === 'stream'))
    } catch (error) {
      console.error('Failed to fetch assignment options:', error)
    }
  }

  const filterCards = () => {
    let filtered = [...cards]

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by assignment type
    if (filterType !== 'all') {
      filtered = filtered.filter(card => card.assignment_type === filterType)
    }

    setFilteredCards(filtered)
  }

  const readCard = async () => {
    setIsReadingCard(true)
    try {
      const response = await fetch(`${apiBase}/rfid/read`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.cardId) {
        setReadCardId(data.cardId)
        setNewCard(prev => ({ ...prev, cardId: data.cardId }))
      }
    } catch (error) {
      console.error('Failed to read RFID card:', error)
    } finally {
      setIsReadingCard(false)
    }
  }

  const saveCard = async () => {
    try {
      const response = await fetch(`${apiBase}/rfid/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: editingCard ? editingCard.card_id : newCard.cardId,
          name: editingCard ? editingCard.name : newCard.name,
          description: editingCard ? editingCard.description : newCard.description,
          assignmentType: editingCard ? editingCard.assignment_type : newCard.assignmentType,
          assignmentId: editingCard ? editingCard.assignment_id : newCard.assignmentId,
          action: editingCard ? editingCard.action : newCard.action,
          color: editingCard ? editingCard.color : newCard.color
        })
      })

      if (response.ok) {
        fetchCards()
        setIsAddDialogOpen(false)
        setEditingCard(null)
        resetNewCard()
      }
    } catch (error) {
      console.error('Failed to save RFID card:', error)
    }
  }

  const deleteCard = async (id: string) => {
    try {
      const response = await fetch(`${apiBase}/rfid/cards/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCards()
      }
    } catch (error) {
      console.error('Failed to delete RFID card:', error)
    }
  }

  const resetNewCard = () => {
    setNewCard({
      cardId: '',
      name: '',
      description: '',
      assignmentType: 'track',
      assignmentId: '',
      action: '',
      color: ''
    })
    setReadCardId('')
  }

  const getAssignmentName = (card: RFIDCard) => {
    if (!card.assignment_id) return 'Not assigned'
    
    switch (card.assignment_type) {
      case 'track':
        const track = tracks.find(t => t.id === card.assignment_id)
        return track ? `${track.title} - ${track.artist}` : 'Unknown track'
      case 'playlist':
        const playlist = playlists.find(p => p.id === card.assignment_id)
        return playlist?.name || 'Unknown playlist'
      case 'album':
        return card.assignment_id
      case 'artist':
        return card.assignment_id
      case 'action':
        const action = actionOptions.find(a => a.value === card.action)
        return action?.label || card.action || 'Unknown action'
      default:
        return 'Not assigned'
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">RFID Card Manager</h2>
              <p className="text-slate-400">Manage your RFID cards and their assignments</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <motion.div variants={buttonPulse} whileHover="hover" whileTap="tap">
                  <Button className="glass-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Card
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="glass-card max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingCard ? 'Edit' : 'Add'} RFID Card</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Card ID Section */}
                  {!editingCard && (
                    <div className="space-y-2">
                      <Label>Card ID</Label>
                      <div className="flex gap-2">
                        <Input
                          value={readCardId || newCard.cardId}
                          onChange={(e) => setNewCard(prev => ({ ...prev, cardId: e.target.value }))}
                          placeholder="Scan or enter card ID"
                          disabled={isReadingCard}
                        />
                        <Button
                          type="button"
                          onClick={readCard}
                          disabled={isReadingCard}
                          variant="outline"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          {isReadingCard ? 'Reading...' : 'Read Card'}
                        </Button>
                      </div>
                      {readCardId && (
                        <p className="text-sm text-green-400">Card read: {readCardId}</p>
                      )}
                    </div>
                  )}

                  {/* Card Name */}
                  <div className="space-y-2">
                    <Label>Card Name</Label>
                    <Input
                      value={editingCard?.name || newCard.name}
                      onChange={(e) => {
                        if (editingCard) {
                          setEditingCard({ ...editingCard, name: e.target.value })
                        } else {
                          setNewCard(prev => ({ ...prev, name: e.target.value }))
                        }
                      }}
                      placeholder="e.g., Bedtime Stories"
                    />
                  </div>

                  {/* Card Description */}
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={editingCard?.description || newCard.description}
                      onChange={(e) => {
                        if (editingCard) {
                          setEditingCard({ ...editingCard, description: e.target.value })
                        } else {
                          setNewCard(prev => ({ ...prev, description: e.target.value }))
                        }
                      }}
                      placeholder="What does this card do?"
                      rows={2}
                    />
                  </div>

                  {/* Assignment Type */}
                  <div className="space-y-2">
                    <Label>Assignment Type</Label>
                    <Select
                      value={editingCard?.assignment_type || newCard.assignmentType}
                      onValueChange={(value) => {
                        const typedValue = value as RFIDCard['assignment_type']
                        if (editingCard) {
                          setEditingCard({ ...editingCard, assignment_type: typedValue, assignment_id: '', action: '' })
                        } else {
                          setNewCard(prev => ({ ...prev, assignmentType: typedValue, assignmentId: '', action: '' }))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="track">Single Track</SelectItem>
                        <SelectItem value="playlist">Playlist</SelectItem>
                        <SelectItem value="album">Album</SelectItem>
                        <SelectItem value="artist">Artist</SelectItem>
                        <SelectItem value="audiobook">Audiobook</SelectItem>
                        <SelectItem value="stream">Live Stream / Radio</SelectItem>
                        <SelectItem value="action">Control Action</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignment Selection */}
                  {(editingCard?.assignment_type || newCard.assignmentType) === 'track' && (
                    <div className="space-y-2">
                      <Label>Select Track</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a track" />
                        </SelectTrigger>
                        <SelectContent>
                          {tracks.map(track => (
                            <SelectItem key={track.id} value={track.id}>
                              {track.title} - {track.artist}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'playlist' && (
                    <div className="space-y-2">
                      <Label>Select Playlist</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a playlist" />
                        </SelectTrigger>
                        <SelectContent>
                          {playlists.map(playlist => (
                            <SelectItem key={playlist.id} value={playlist.id}>
                              {playlist.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'album' && (
                    <div className="space-y-2">
                      <Label>Select Album</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an album" />
                        </SelectTrigger>
                        <SelectContent>
                          {albums.map(album => (
                            <SelectItem key={album.id} value={album.id}>
                              {album.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'artist' && (
                    <div className="space-y-2">
                      <Label>Select Artist</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an artist" />
                        </SelectTrigger>
                        <SelectContent>
                          {artists.map(artist => (
                            <SelectItem key={artist.id} value={artist.id}>
                              {artist.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'audiobook' && (
                    <div className="space-y-2">
                      <Label>Select Audiobook</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an audiobook" />
                        </SelectTrigger>
                        <SelectContent>
                          {audiobooks.map(audiobook => (
                            <SelectItem key={audiobook.id} value={audiobook.id}>
                              {audiobook.title} - {audiobook.author}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'stream' && (
                    <div className="space-y-2">
                      <Label>Select Stream / Radio</Label>
                      <Select
                        value={editingCard?.assignment_id || newCard.assignmentId}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, assignment_id: value })
                          } else {
                            setNewCard(prev => ({ ...prev, assignmentId: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a stream" />
                        </SelectTrigger>
                        <SelectContent>
                          {streams.map(stream => (
                            <SelectItem key={stream.id} value={stream.id}>
                              {stream.title} {stream.artist && `- ${stream.artist}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editingCard?.assignment_type || newCard.assignmentType) === 'action' && (
                    <div className="space-y-2">
                      <Label>Select Action</Label>
                      <Select
                        value={editingCard?.action || newCard.action}
                        onValueChange={(value) => {
                          if (editingCard) {
                            setEditingCard({ ...editingCard, action: value })
                          } else {
                            setNewCard(prev => ({ ...prev, action: value }))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an action" />
                        </SelectTrigger>
                        <SelectContent>
                          {actionOptions.map(action => (
                            <SelectItem key={action.value} value={action.value}>
                              <div className="flex items-center gap-2">
                                <action.icon className="w-4 h-4" />
                                {action.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Card Color */}
                  <div className="space-y-2">
                    <Label>Card Color (Optional)</Label>
                    <Input
                      type="color"
                      value={editingCard?.color || newCard.color || getCardColor(editingCard || newCard as any)}
                      onChange={(e) => {
                        if (editingCard) {
                          setEditingCard({ ...editingCard, color: e.target.value })
                        } else {
                          setNewCard(prev => ({ ...prev, color: e.target.value }))
                        }
                      }}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsAddDialogOpen(false)
                        setEditingCard(null)
                        resetNewCard()
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={saveCard}>
                      {editingCard ? 'Update' : 'Create'} Card
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards..."
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="track">Tracks</SelectItem>
                <SelectItem value="playlist">Playlists</SelectItem>
                <SelectItem value="album">Albums</SelectItem>
                <SelectItem value="artist">Artists</SelectItem>
                <SelectItem value="action">Actions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GlassCard>
      </motion.div>

      {/* Cards Grid */}
      <motion.div 
        variants={staggerContainer}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence>
          {filteredCards.map((card, index) => {
            const Icon = card.assignment_type ? assignmentTypeIcons[card.assignment_type] : Radio
            const cardColor = getCardColor(card)
            
            return (
              <motion.div
                key={card.id}
                variants={cardHover}
                whileHover="hover"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05, ...springConfig }}
              >
                <GlassCard className="p-4 relative overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: cardColor }}
                  />
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${cardColor}20` }}
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className="w-5 h-5" style={{ color: cardColor }} />
                      </motion.div>
                      <div>
                        <h3 className="font-semibold">{card.name}</h3>
                        <p className="text-xs text-slate-400">ID: {card.card_id}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <motion.div variants={buttonPulse} whileHover="hover" whileTap="tap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingCard(card)
                            setIsAddDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </motion.div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <motion.div variants={buttonPulse} whileHover="hover" whileTap="tap">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Card</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{card.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCard(card.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {card.description && (
                    <p className="text-sm text-slate-400 mb-3">{card.description}</p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Type:</span>
                      <Badge variant="outline" className="capitalize">
                        {card.assignment_type || 'Not set'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Assignment:</span>
                      <span className="text-right truncate max-w-[150px]">
                        {getAssignmentName(card)}
                      </span>
                    </div>

                    {card.usage_count !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Uses:</span>
                        <span>{card.usage_count}</span>
                      </div>
                    )}

                    {card.last_used && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Last used:</span>
                        <span>{new Date(card.last_used).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {filteredCards.length === 0 && (
        <motion.div
          variants={scaleIn}
          className="text-center py-12"
        >
          <Radio className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-400">
            {searchQuery || filterType !== 'all' 
              ? 'No cards found matching your criteria' 
              : 'No RFID cards configured yet'}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}