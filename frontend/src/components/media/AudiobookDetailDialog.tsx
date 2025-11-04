import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Book, Play, Clock, Edit3, Check, X, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AudiobookMetadataDialog } from './AudiobookMetadataDialog';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file_path: string;
}

interface Audiobook {
  id: string;
  title: string;
  author: string;
  description?: string;
  track_count: number;
  duration: number;
  album_art_path?: string;
}

interface AudiobookDetailDialogProps {
  audiobookId: string | null;
  apiBase?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export default function AudiobookDetailDialog({
  audiobookId,
  apiBase = '',
  open,
  onOpenChange,
  onUpdate
}: AudiobookDetailDialogProps) {
  const [audiobook, setAudiobook] = useState<Audiobook | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedAuthor, setEditedAuthor] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    if (audiobookId && open) {
      fetchAudiobookDetails();
    }
  }, [audiobookId, open]);

  const fetchAudiobookDetails = async () => {
    if (!audiobookId) return;

    setIsLoading(true);
    try {
      const url = apiBase ? `${apiBase}/audiobooks/${audiobookId}` : `/api/audiobooks/${audiobookId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAudiobook(data.audiobook);
        setTracks(data.tracks);
        setEditedTitle(data.audiobook.title);
        setEditedAuthor(data.audiobook.author);
        setEditedDescription(data.audiobook.description || '');
      }
    } catch (error) {
      console.error('Error fetching audiobook details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (audiobook) {
      setEditedTitle(audiobook.title);
      setEditedAuthor(audiobook.author);
      setEditedDescription(audiobook.description || '');
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (audiobook) {
      setEditedTitle(audiobook.title);
      setEditedAuthor(audiobook.author);
      setEditedDescription(audiobook.description || '');
    }
  };

  const handleSaveEdit = async () => {
    if (!audiobookId || !editedTitle.trim() || !editedAuthor.trim()) {
      return;
    }

    try {
      const url = apiBase ? `${apiBase}/audiobooks/${audiobookId}` : `/api/audiobooks/${audiobookId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle.trim(),
          author: editedAuthor.trim(),
          description: editedDescription.trim() || undefined
        })
      });

      if (response.ok) {
        setAudiobook(prev => prev ? {
          ...prev,
          title: editedTitle.trim(),
          author: editedAuthor.trim(),
          description: editedDescription.trim() || undefined
        } : null);
        setIsEditing(false);
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error updating audiobook:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handlePlayChapter = (track: Track, index: number) => {
    // TODO: This will be implemented when we integrate with the audio player
    console.log('Playing chapter:', index + 1, track.title);
    // For now, just alert
    alert(`Playing Chapter ${index + 1}: ${track.title}\n\nAudiobook playback integration coming soon!`);
  };

  if (!audiobook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Book className="w-6 h-6 text-purple-400" />
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        placeholder="Audiobook title"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        value={editedAuthor}
                        onChange={(e) => setEditedAuthor(e.target.value)}
                        placeholder="Author name"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                  ) : (
                    <>
                      <DialogTitle className="text-xl font-bold text-white">{audiobook?.title}</DialogTitle>
                      <div className="text-sm text-gray-400">by {audiobook?.author}</div>
                    </>
                  )}
                </div>
              </div>
              {!isEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartEdit}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveEdit}
                    className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center justify-between gap-4">
                <DialogDescription className="text-sm text-gray-400 flex items-center gap-4">
                  <span>{audiobook?.track_count} chapters</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {audiobook && formatDuration(audiobook.duration)}
                  </span>
                </DialogDescription>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMetadataDialogOpen(true)}
                  className="h-7 text-xs border-purple-600/50 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Enhance Metadata
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Description */}
          {isEditing ? (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Description</label>
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Add a description..."
                className="bg-gray-800 border-gray-600 text-white min-h-[80px]"
              />
            </div>
          ) : (
            audiobook?.description && (
              <p className="text-gray-300 text-sm">{audiobook.description}</p>
            )
          )}

          {/* Chapters List */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Chapters</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading chapters...</div>
            ) : (
              <div className="space-y-1">
                {tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                  >
                    <div className="text-gray-400 font-mono text-sm w-8 text-right">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{track.title}</div>
                      <div className="text-gray-400 text-sm">{formatDuration(track.duration)}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-green-400 hover:text-green-300"
                      onClick={() => handlePlayChapter(track, index)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Play All Button */}
          <Button
            className="w-full bg-purple-600 hover:bg-purple-700"
            onClick={() => tracks.length > 0 && handlePlayChapter(tracks[0], 0)}
          >
            <Play className="w-4 h-4 mr-2" />
            Play from Beginning
          </Button>
        </div>
      </DialogContent>

      {/* Metadata Enhancement Dialog */}
      {audiobookId && (
        <AudiobookMetadataDialog
          audiobookId={audiobookId}
          apiBase={apiBase}
          open={isMetadataDialogOpen}
          onOpenChange={setIsMetadataDialogOpen}
          onMetadataApplied={() => {
            fetchAudiobookDetails();
            onUpdate?.();
          }}
        />
      )}
    </Dialog>
  );
}
