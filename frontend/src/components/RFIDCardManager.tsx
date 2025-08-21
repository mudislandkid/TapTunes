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
  Filter
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

interface RFIDCard {
  id: string;
  name: string;
  description?: string;
  playlistId?: string;
  action: 'play_playlist' | 'stop' | 'volume_up' | 'volume_down' | 'pause' | 'next' | 'previous';
  createdAt: string;
  lastUsed?: string;
  usageCount?: number;
  color?: string;
}

interface RFIDCardManagerProps {
  apiBase: string;
}

const actionIcons = {
  play_playlist: Music,
  stop: Square,
  pause: Square,
  volume_up: Volume2,
  volume_down: Volume1,
  next: Radio,
  previous: Radio,
}

const actionColors = {
  play_playlist: 'bg-green-500/20 text-green-400 border-green-500/30',
  stop: 'bg-red-500/20 text-red-400 border-red-500/30',
  pause: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  volume_up: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  volume_down: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  next: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  previous: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export default function RFIDCardManager({ apiBase }: RFIDCardManagerProps) {
  const [cards, setCards] = useState<RFIDCard[]>([])
  const [filteredCards, setFilteredCards] = useState<RFIDCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [editingCard, setEditingCard] = useState<RFIDCard | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newCard, setNewCard] = useState({
    name: '',
    description: '',
    action: 'play_playlist' as const,
    playlistId: '',
    color: '#3b82f6'
  })

  const fetchCards = async () => {
    try {
      const response = await fetch(`${apiBase}/rfid/cards`)
      const data = await response.json()
      setCards(data.cards || [])
    } catch (error) {
      console.error('Failed to fetch RFID cards:', error)
    }
  }

  const saveCard = async (cardData: Partial<RFIDCard>, cardId?: string) => {
    try {
      const response = await fetch(`${apiBase}/rfid/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cardId || `card_${Date.now()}`,
          ...cardData,
          createdAt: cardData.createdAt || new Date().toISOString()
        })
      })
      
      if (response.ok) {
        fetchCards()
        setIsAddDialogOpen(false)
        setEditingCard(null)
        setNewCard({
          name: '',
          description: '',
          action: 'play_playlist',
          playlistId: '',
          color: '#3b82f6'
        })
      }
    } catch (error) {
      console.error('Failed to save RFID card:', error)
    }
  }

  const deleteCard = async (cardId: string) => {
    try {
      await fetch(`${apiBase}/rfid/cards/${cardId}`, {
        method: 'DELETE'
      })
      fetchCards()
    } catch (error) {
      console.error('Failed to delete RFID card:', error)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [])

  useEffect(() => {
    let filtered = cards.filter(card => 
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (filterAction !== 'all') {
      filtered = filtered.filter(card => card.action === filterAction)
    }

    setFilteredCards(filtered)
  }, [cards, searchQuery, filterAction])

  const CardFormContent = ({ card, onSave, onCancel }: { 
    card: Partial<RFIDCard>, 
    onSave: (card: Partial<RFIDCard>) => void,
    onCancel: () => void 
  }) => {
    const [formData, setFormData] = useState(card)

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Card Name</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter card name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter card description"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Select
            value={formData.action || 'play_playlist'}
            onValueChange={(value) => setFormData({ ...formData, action: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="play_playlist">Play Playlist</SelectItem>
              <SelectItem value="stop">Stop Playback</SelectItem>
              <SelectItem value="pause">Pause/Resume</SelectItem>
              <SelectItem value="next">Next Track</SelectItem>
              <SelectItem value="previous">Previous Track</SelectItem>
              <SelectItem value="volume_up">Volume Up</SelectItem>
              <SelectItem value="volume_down">Volume Down</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.action === 'play_playlist' && (
          <div className="space-y-2">
            <Label htmlFor="playlist">Playlist ID</Label>
            <Input
              id="playlist"
              value={formData.playlistId || ''}
              onChange={(e) => setFormData({ ...formData, playlistId: e.target.value })}
              placeholder="Enter playlist ID"
            />
          </div>
        )}

        <div className="flex space-x-2 pt-4">
          <Button 
            onClick={() => onSave(formData)}
            disabled={!formData.name}
            className="flex-1"
          >
            Save Card
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={fadeInUp}>
          <h2 className="text-2xl font-bold text-slate-100">RFID Cards</h2>
          <p className="text-slate-300">Manage your RFID cards and their actions</p>
        </motion.div>

        <motion.div
          variants={buttonPulse}
          whileHover="hover"
          whileTap="tap"
        >
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
            </DialogTrigger>
          <DialogContent className="glass-card border-slate-700/50">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Add New RFID Card</DialogTitle>
            </DialogHeader>
            <CardFormContent
              card={newCard}
              onSave={(data) => saveCard(data)}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
        </motion.div>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        variants={fadeInUp}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <motion.div 
              className="flex-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, ...springConfig }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-card border-slate-600/50"
                />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, ...springConfig }}
            >
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-full sm:w-48 glass-card border-slate-600/50">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="play_playlist">Play Playlist</SelectItem>
                  <SelectItem value="stop">Stop</SelectItem>
                  <SelectItem value="pause">Pause</SelectItem>
                  <SelectItem value="volume_up">Volume Up</SelectItem>
                  <SelectItem value="volume_down">Volume Down</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Cards Grid */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence mode="popLayout">
          {filteredCards.map((card, index) => {
            const ActionIcon = actionIcons[card.action]
            return (
              <motion.div
                key={card.id}
                layout
                variants={scaleIn}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ 
                  layout: { duration: 0.3 },
                  ...springConfig,
                  delay: index * 0.05 
                }}
                whileHover={{ y: -4 }}
              >
                <motion.div
                  variants={cardHover}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <GlassCard className="p-4 hover:bg-slate-800/60 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <motion.div 
                          className={`p-2 rounded-lg ${actionColors[card.action]}`}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ActionIcon className="w-4 h-4" />
                        </motion.div>
                        <div>
                          <h3 className="font-semibold text-slate-100">{card.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {card.action.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <motion.div 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ opacity: 0 }}
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
                            className="h-8 w-8"
                            onClick={() => setEditingCard(card)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </motion.div>
                      
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <motion.div
                              variants={buttonPulse}
                              whileHover="hover"
                              whileTap="tap"
                            >
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </motion.div>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-card border-slate-700/50">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-slate-100">Delete Card</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-300">
                                Are you sure you want to delete "{card.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCard(card.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </motion.div>
                    </div>

                    {card.description && (
                      <motion.p 
                        className="text-sm text-slate-300 mb-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {card.description}
                      </motion.p>
                    )}

                    <motion.div 
                      className="flex justify-between items-center text-xs text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <span>ID: {card.id.slice(-8)}</span>
                      <span>Uses: {card.usageCount || 0}</span>
                    </motion.div>
                  </GlassCard>
                </motion.div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {filteredCards.length === 0 && (
        <motion.div 
          className="text-center py-12"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, ...springConfig }}
          >
            <Radio className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          </motion.div>
          <motion.p 
            className="text-slate-300"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {cards.length === 0 ? 'No RFID cards found' : 'No cards match your search'}
          </motion.p>
          <motion.p 
            className="text-sm text-slate-400 mt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {cards.length === 0 ? 'Add your first card to get started' : 'Try adjusting your search or filters'}
          </motion.p>
        </motion.div>
      )}

      {/* Edit Card Dialog */}
      {editingCard && (
        <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
          <DialogContent className="glass-card border-slate-700/50">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Edit RFID Card</DialogTitle>
            </DialogHeader>
            <CardFormContent
              card={editingCard}
              onSave={(data) => saveCard(data, editingCard.id)}
              onCancel={() => setEditingCard(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}