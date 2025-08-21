import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Music, CheckCircle, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GlassCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MetadataSelectionDialog } from './MetadataSelectionDialog'
import type { Track } from '../../types/media'

interface TrackToEnrich {
  id: string
  title: string
  artist: string
  album: string
  year?: number
  genre?: string
  thumbnailPath?: string
}

interface BatchMetadataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiBase: string
  onRefreshLibrary: () => void
}

export function BatchMetadataDialog({
  open,
  onOpenChange,
  apiBase,
  onRefreshLibrary
}: BatchMetadataDialogProps) {
  const [tracksToEnrich, setTracksToEnrich] = useState<TrackToEnrich[]>([])
  const [processedTracks, setProcessedTracks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)

  const loadTracksToEnrich = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/media/enrich-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 20, skipExisting: true })
      })

      const data = await response.json()
      if (data.success) {
        setTracksToEnrich(data.tracksToEnrich || [])
        setProcessedTracks(new Set()) // Reset processed tracks
      }
    } catch (error) {
      console.error('Failed to load tracks for enrichment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnhanceTrack = (track: TrackToEnrich) => {
    // Convert TrackToEnrich to Track format for MetadataSelectionDialog
    const trackData: Track = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: 0, // Not needed for metadata enhancement
      genre: track.genre,
      year: track.year,
      filePath: '',
      isLiked: false,
      folderId: undefined,
      coverArt: track.thumbnailPath
    }
    
    setSelectedTrack(trackData)
    setIsMetadataDialogOpen(true)
  }

  const handleMetadataApplied = () => {
    // Mark track as processed
    if (selectedTrack) {
      setProcessedTracks(prev => new Set(prev).add(selectedTrack.id))
    }
    onRefreshLibrary()
  }

  const handleSkipTrack = (trackId: string) => {
    setProcessedTracks(prev => new Set(prev).add(trackId))
  }

  const remainingTracks = tracksToEnrich.filter(track => !processedTracks.has(track.id))
  const completedCount = tracksToEnrich.length - remainingTracks.length

  // Effect to load tracks when dialog opens
  React.useEffect(() => {
    if (open) {
      loadTracksToEnrich()
    }
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-slate-700/50 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              Batch Metadata Enhancement
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress Summary */}
            {tracksToEnrich.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/30">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    Progress: {completedCount} of {tracksToEnrich.length} tracks
                  </h3>
                  <p className="text-sm text-slate-300">
                    {remainingTracks.length} tracks remaining
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">
                    {Math.round((completedCount / tracksToEnrich.length) * 100)}%
                  </div>
                  <div className="text-xs text-slate-400">Complete</div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="text-slate-300">Loading tracks that need metadata...</div>
              </div>
            )}

            {/* No Tracks Found */}
            {!loading && tracksToEnrich.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-100 mb-2">
                  All tracks have good metadata!
                </h3>
                <p className="text-slate-300">
                  No tracks were found that need metadata enhancement.
                </p>
              </div>
            )}

            {/* Tracks List */}
            {!loading && remainingTracks.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-slate-100">
                  Tracks needing metadata enhancement:
                </h4>
                
                {remainingTracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center">
                            <Music className="w-5 h-5 text-slate-300" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-medium text-slate-100">{track.title}</h5>
                            <p className="text-sm text-slate-300">
                              {track.artist} • {track.album}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {track.year && (
                                <span className="text-xs text-slate-400">{track.year}</span>
                              )}
                              {track.genre && (
                                <Badge variant="outline" className="text-xs">
                                  {track.genre}
                                </Badge>
                              )}
                              {!track.thumbnailPath && (
                                <Badge variant="outline" className="text-xs text-amber-400">
                                  No artwork
                                </Badge>
                              )}
                              {track.artist === 'Unknown Artist' && (
                                <Badge variant="outline" className="text-xs text-red-400">
                                  Unknown artist
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSkipTrack(track.id)}
                            className="glass-card border-slate-600/50"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Skip
                          </Button>
                          <Button
                            onClick={() => handleEnhanceTrack(track)}
                            size="sm"
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            Enhance
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Completed Tracks Summary */}
            {completedCount > 0 && (
              <div className="text-center p-4 bg-green-600/20 rounded-lg border border-green-500/30">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">
                  {completedCount} track{completedCount !== 1 ? 's' : ''} processed
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-600/30">
              <Button
                variant="outline"
                onClick={loadTracksToEnrich}
                disabled={loading}
                className="glass-card border-slate-600/50"
              >
                <Clock className="w-4 h-4 mr-2" />
                Refresh List
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="glass-card border-slate-600/50"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metadata Selection Dialog */}
      <MetadataSelectionDialog
        open={isMetadataDialogOpen}
        onOpenChange={setIsMetadataDialogOpen}
        track={selectedTrack}
        apiBase={apiBase}
        onMetadataApplied={handleMetadataApplied}
      />
    </>
  )
}