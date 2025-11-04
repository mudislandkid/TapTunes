import { memo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Image as ImageIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { fadeInUp } from '../../lib/animations'

interface AlbumArtOption {
  trackId: string
  trackTitle: string
  trackArtist: string
  artPath: string
  artUrl?: string
}

interface AlbumArtPickerProps {
  type: 'playlist' | 'folder'
  id: string
  apiBase: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: () => void
}

export const AlbumArtPicker = memo(function AlbumArtPicker({
  type,
  id,
  apiBase,
  open,
  onOpenChange,
  onSelect
}: AlbumArtPickerProps) {
  const [artOptions, setArtOptions] = useState<AlbumArtOption[]>([])
  const [selectedArtPath, setSelectedArtPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && id) {
      fetchAvailableArt()
    }
  }, [open, id])

  const fetchAvailableArt = async () => {
    try {
      setLoading(true)
      const endpoint = type === 'playlist'
        ? `/media/playlists/${id}/available-art`
        : `/media/folders/${id}/available-art`

      const response = await fetch(`${apiBase}${endpoint}`)
      if (!response.ok) {
        throw new Error('Failed to fetch available album art')
      }
      const data = await response.json()
      setArtOptions(data.albumArtOptions || [])
    } catch (error) {
      console.error('Error fetching available album art:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectArt = async (artPath: string) => {
    try {
      const endpoint = type === 'playlist'
        ? `/media/playlists/${id}/album-art`
        : `/media/folders/${id}/album-art`

      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumArtPath: artPath })
      })

      if (!response.ok) {
        throw new Error('Failed to set album art')
      }

      onSelect()
      onOpenChange(false)
    } catch (error) {
      console.error('Error setting album art:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-slate-700/50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Choose Album Art</DialogTitle>
          <DialogDescription className="text-slate-300">
            Select artwork from tracks in this {type}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-slate-400">
            Loading available artwork...
          </div>
        ) : artOptions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-500" />
            <p>No album art available in this {type}</p>
            <p className="text-sm">Add tracks with album art to choose from</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto py-4"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            {artOptions.map((option, index) => (
              <motion.div
                key={`${option.artPath}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => {
                    setSelectedArtPath(option.artPath)
                    handleSelectArt(option.artPath)
                  }}
                  className="relative w-full aspect-square group"
                >
                  <GlassCard
                    className={`
                      p-1 h-full w-full hover:border-purple-500/50 transition-all
                      ${selectedArtPath === option.artPath ? 'border-purple-500' : ''}
                    `}
                  >
                    {option.artUrl ? (
                      <img
                        src={option.artUrl}
                        alt={`${option.trackTitle} by ${option.trackArtist}`}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800/50 rounded">
                        <ImageIcon className="w-8 h-8 text-slate-600" />
                      </div>
                    )}

                    {/* Overlay with track info on hover */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center p-2 text-center">
                      <p className="text-xs text-white font-semibold truncate w-full">
                        {option.trackTitle}
                      </p>
                      <p className="text-xs text-slate-300 truncate w-full">
                        {option.trackArtist}
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {selectedArtPath === option.artPath && (
                      <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </GlassCard>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="glass-card border-slate-600/50"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
