import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GlassCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetadataLookupResult {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  albumArtUrl?: string;
  musicBrainzId?: string;
  confidence: number;
}

interface AudiobookMetadataDialogProps {
  audiobookId: string;
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMetadataApplied: () => void;
}

export function AudiobookMetadataDialog({
  audiobookId,
  apiBase,
  open,
  onOpenChange,
  onMetadataApplied
}: AudiobookMetadataDialogProps) {
  const [searchResults, setSearchResults] = useState<MetadataLookupResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (open && !hasSearched) {
      handleSearch();
    }
  }, [open]);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);

    try {
      const url = apiBase ? `${apiBase}/audiobooks/${audiobookId}/search-metadata` : `/api/audiobooks/${audiobookId}/search-metadata`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Audiobook metadata search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyMetadata = async (metadata: MetadataLookupResult) => {
    setIsApplying(true);

    try {
      const url = apiBase ? `${apiBase}/audiobooks/${audiobookId}/apply-metadata` : `/api/audiobooks/${audiobookId}/apply-metadata`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: metadata.title,
          author: metadata.artist,
          musicBrainzId: metadata.musicBrainzId
        })
      });

      if (response.ok) {
        onMetadataApplied();
        onOpenChange(false);
        setHasSearched(false);
      }
    } catch (error) {
      console.error('Failed to apply audiobook metadata:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setHasSearched(false);
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-slate-700/50 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            Enhance Audiobook Metadata
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-2">
            Find album art and metadata for your audiobook from MusicBrainz
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Again
              </>
            )}
          </Button>

          {/* Search Results */}
          {hasSearched && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-8 text-slate-400">
              <p>No metadata found. Try editing the audiobook title or author to improve search results.</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Select a match to apply album art:
              </p>
              {searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard className="p-4 hover:bg-slate-800/60 transition-all">
                    <div className="flex items-center gap-4">
                      {/* Album Art Preview */}
                      {result.albumArtUrl ? (
                        <img
                          src={result.albumArtUrl}
                          alt={result.title || 'Album art'}
                          className="w-20 h-20 rounded-lg object-cover bg-slate-800"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-slate-800 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-600" />
                        </div>
                      )}

                      {/* Metadata Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-100 truncate">
                          {result.title || 'Unknown Title'}
                        </h3>
                        <p className="text-sm text-slate-400 truncate">
                          by {result.artist || 'Unknown Author'}
                        </p>
                        {result.year && (
                          <p className="text-xs text-slate-500">{result.year}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          <Badge
                            variant={result.confidence > 0.8 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {Math.round(result.confidence * 100)}% match
                          </Badge>
                          {result.albumArtUrl && (
                            <Badge variant="outline" className="text-xs">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Has album art
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Apply Button */}
                      <Button
                        size="sm"
                        onClick={() => handleApplyMetadata(result)}
                        disabled={isApplying}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApplying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Apply
                          </>
                        )}
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
