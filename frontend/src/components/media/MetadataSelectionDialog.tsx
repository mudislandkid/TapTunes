import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Check, X, Edit3, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GlassCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Track } from '../../types/media'

interface MetadataLookupResult {
  title?: string
  artist?: string
  album?: string
  year?: number
  genre?: string
  albumArtUrl?: string
  musicBrainzId?: string
  confidence: number
}

interface MetadataSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  track: Track | null
  apiBase: string
  onMetadataApplied: () => void
}

export function MetadataSelectionDialog({
  open,
  onOpenChange,
  track,
  apiBase,
  onMetadataApplied
}: MetadataSelectionDialogProps) {
  const [searchResults, setSearchResults] = useState<MetadataLookupResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)
  const [manualData, setManualData] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: ''
  })

  const handleSearch = async () => {
    if (!track) return

    setIsSearching(true)
    try {
      const response = await fetch(`${apiBase}/media/search-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artist: track.artist,
          title: track.title,
          album: track.album
        })
      })

      const data = await response.json()
      if (data.success) {
        setSearchResults(data.results)
      }
    } catch (error) {
      console.error('Metadata search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleApplyMetadata = async (metadata: MetadataLookupResult) => {
    if (!track) return

    setIsApplying(true)
    try {
      const response = await fetch(`${apiBase}/media/apply-metadata/${track.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          year: metadata.year,
          genre: metadata.genre,
          musicBrainzId: metadata.musicBrainzId
        })
      })

      if (response.ok) {
        onMetadataApplied()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to apply metadata:', error)
    } finally {
      setIsApplying(false)
    }
  }

  const handleApplyManualMetadata = async () => {
    if (!track) return

    setIsApplying(true)
    try {
      const response = await fetch(`${apiBase}/media/apply-metadata/${track.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: manualData.title || track.title,
          artist: manualData.artist || track.artist,
          album: manualData.album || track.album,
          year: manualData.year ? parseInt(manualData.year) : track.year,
          genre: manualData.genre || track.genre
        })
      })

      if (response.ok) {
        onMetadataApplied()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to apply manual metadata:', error)
    } finally {
      setIsApplying(false)
    }
  }

  const resetState = () => {
    setSearchResults([])
    setManualEntry(false)
    setManualData({ title: '', artist: '', album: '', year: '', genre: '' })
  }

  if (!track) return null

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen)
      if (!newOpen) resetState()
    }}>
      <DialogContent className="glass-card border-slate-700/50 max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            Enhance Metadata: {track.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Track Info */}
          <GlassCard className="p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">{track.title}</h3>
                <p className="text-sm text-slate-300">{track.artist} • {track.album}</p>
                {track.year && <p className="text-xs text-slate-400">{track.year}</p>}
              </div>
            </div>
          </GlassCard>

          {/* Search Section */}
          {!manualEntry && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-100">Search for Metadata</h4>
                <Button
                  variant="outline"
                  onClick={() => setManualEntry(true)}
                  className="glass-card border-slate-600/50"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Manual Entry
                </Button>
              </div>

              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search for Matches'}
              </Button>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-medium text-slate-200">Select a Match:</h5>
                  {searchResults.map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <GlassCard className="p-4 hover:bg-slate-800/60 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h6 className="font-medium text-slate-100">{result.title}</h6>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(result.confidence * 100)}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-300">
                              {result.artist} • {result.album}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {result.year && (
                                <span className="text-xs text-slate-400">{result.year}</span>
                              )}
                              {result.genre && (
                                <Badge variant="outline" className="text-xs">
                                  {result.genre}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleApplyMetadata(result)}
                            disabled={isApplying}
                            size="sm"
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Apply
                          </Button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !isSearching && (
                <div className="text-center py-8 text-slate-400">
                  Click search to find metadata matches
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Section */}
          {manualEntry && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-100">Manual Entry</h4>
                <Button
                  variant="outline"
                  onClick={() => setManualEntry(false)}
                  className="glass-card border-slate-600/50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Back to Search
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manual-title">Title</Label>
                  <Input
                    id="manual-title"
                    value={manualData.title}
                    onChange={(e) => setManualData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={track.title}
                    className="glass-card border-slate-600/50"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-artist">Artist</Label>
                  <Input
                    id="manual-artist"
                    value={manualData.artist}
                    onChange={(e) => setManualData(prev => ({ ...prev, artist: e.target.value }))}
                    placeholder={track.artist}
                    className="glass-card border-slate-600/50"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-album">Album</Label>
                  <Input
                    id="manual-album"
                    value={manualData.album}
                    onChange={(e) => setManualData(prev => ({ ...prev, album: e.target.value }))}
                    placeholder={track.album}
                    className="glass-card border-slate-600/50"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-year">Year</Label>
                  <Input
                    id="manual-year"
                    type="number"
                    value={manualData.year}
                    onChange={(e) => setManualData(prev => ({ ...prev, year: e.target.value }))}
                    placeholder={track.year?.toString() || ''}
                    className="glass-card border-slate-600/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="manual-genre">Genre</Label>
                  <Input
                    id="manual-genre"
                    value={manualData.genre}
                    onChange={(e) => setManualData(prev => ({ ...prev, genre: e.target.value }))}
                    placeholder={track.genre || ''}
                    className="glass-card border-slate-600/50"
                  />
                </div>
              </div>

              <Button
                onClick={handleApplyManualMetadata}
                disabled={isApplying}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {isApplying ? 'Applying...' : 'Apply Manual Changes'}
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-600/30">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="glass-card border-slate-600/50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}