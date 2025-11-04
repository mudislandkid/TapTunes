import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Book, Play, Clock } from 'lucide-react';
import { Button } from '../ui/button';

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
  apiBase: _apiBase,
  open,
  onOpenChange,
  onUpdate: _onUpdate
}: AudiobookDetailDialogProps) {
  const [audiobook, setAudiobook] = useState<Audiobook | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (audiobookId && open) {
      fetchAudiobookDetails();
    }
  }, [audiobookId, open]);

  const fetchAudiobookDetails = async () => {
    if (!audiobookId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/audiobooks/${audiobookId}`);
      if (response.ok) {
        const data = await response.json();
        setAudiobook(data.audiobook);
        setTracks(data.tracks);
      }
    } catch (error) {
      console.error('Error fetching audiobook details:', error);
    } finally {
      setIsLoading(false);
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
          <DialogTitle className="flex items-center gap-3 text-white">
            <Book className="w-6 h-6 text-purple-400" />
            <div className="flex-1">
              <div className="text-xl font-bold">{audiobook.title}</div>
              <div className="text-sm text-gray-400 font-normal">by {audiobook.author}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Audiobook Info */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{audiobook.track_count} chapters</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDuration(audiobook.duration)}
            </span>
          </div>

          {audiobook.description && (
            <p className="text-gray-300 text-sm">{audiobook.description}</p>
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
    </Dialog>
  );
}
