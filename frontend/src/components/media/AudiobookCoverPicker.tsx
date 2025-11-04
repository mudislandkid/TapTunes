import { memo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check, Image as ImageIcon, Upload, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fadeInUp } from '../../lib/animations'

interface AlbumArtOption {
  trackId: string
  trackTitle: string
  trackArtist: string
  artPath: string
  artUrl?: string
}

interface AudiobookCoverPickerProps {
  audiobookId: string
  apiBase: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: () => void
}

export const AudiobookCoverPicker = memo(function AudiobookCoverPicker({
  audiobookId,
  apiBase,
  open,
  onOpenChange,
  onSelect
}: AudiobookCoverPickerProps) {
  const [artOptions, setArtOptions] = useState<AlbumArtOption[]>([])
  const [selectedArtPath, setSelectedArtPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && audiobookId) {
      fetchAvailableArt()
    }
  }, [open, audiobookId])

  const fetchAvailableArt = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiBase}/audiobooks/${audiobookId}/available-art`)
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
      const response = await fetch(`${apiBase}/audiobooks/${audiobookId}/album-art`, {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Show preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('cover', file)

      const response = await fetch(`${apiBase}/audiobooks/${audiobookId}/upload-cover`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload cover image')
      }

      // Reset preview and input
      setUploadPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent and close
      onSelect()
      onOpenChange(false)
    } catch (error) {
      console.error('Error uploading cover:', error)
      alert('Failed to upload cover image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-slate-700/50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Choose Audiobook Cover</DialogTitle>
          <DialogDescription className="text-slate-300">
            Upload a custom image or select from existing track artwork
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 glass-card">
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
            <TabsTrigger value="existing">From Tracks</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploadPreview ? (
                <div className="space-y-4">
                  <img
                    src={uploadPreview}
                    alt="Upload preview"
                    className="max-w-xs max-h-64 mx-auto rounded-lg"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload This Image
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleBrowseClick}
                      disabled={uploading}
                      className="glass-card border-slate-600/50"
                    >
                      Choose Different Image
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ImageIcon className="w-16 h-16 mx-auto text-slate-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                      Upload Cover Image
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      JPG, PNG, GIF, or WebP • Max 10MB
                    </p>
                    <Button
                      onClick={handleBrowseClick}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Browse Files
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Existing Art Tab */}
          <TabsContent value="existing">
            {loading ? (
              <div className="text-center py-8 text-slate-400">
                Loading available artwork...
              </div>
            ) : artOptions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                <p>No album art available from tracks</p>
                <p className="text-sm">Upload chapters with album art or use the Upload tab</p>
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
          </TabsContent>
        </Tabs>

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
