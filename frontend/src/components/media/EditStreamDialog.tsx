import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Radio } from 'lucide-react';
import type { Track } from '../../types/media';

interface EditStreamDialogProps {
  stream: Track | null;
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditStreamDialog({
  stream,
  apiBase,
  open,
  onOpenChange,
  onSuccess
}: EditStreamDialogProps) {
  const [editedStream, setEditedStream] = useState({
    title: '',
    artist: '',
    streamUrl: '',
    genre: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Update form when stream changes
  useEffect(() => {
    if (stream) {
      setEditedStream({
        title: stream.title || '',
        artist: stream.artist || '',
        streamUrl: stream.sourceUrl || '',
        genre: stream.genre || ''
      });
    }
  }, [stream]);

  const handleSave = async () => {
    if (!stream || !editedStream.title || !editedStream.artist || !editedStream.streamUrl) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${apiBase}/media/radio-streams/${stream.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editedStream.title,
          artist: editedStream.artist,
          streamUrl: editedStream.streamUrl,
          genre: editedStream.genre || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update stream');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating stream:', error);
      alert('Failed to update stream. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-slate-700/50">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400" />
            Edit Radio Stream
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="editStreamTitle">
              Stream Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="editStreamTitle"
              value={editedStream.title}
              onChange={(e) => setEditedStream(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., BBC Radio 1"
              className="glass-card border-slate-600/50"
            />
          </div>
          <div>
            <Label htmlFor="editStreamArtist">
              Station Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="editStreamArtist"
              value={editedStream.artist}
              onChange={(e) => setEditedStream(prev => ({ ...prev, artist: e.target.value }))}
              placeholder="e.g., BBC"
              className="glass-card border-slate-600/50"
            />
          </div>
          <div>
            <Label htmlFor="editStreamUrl">
              Stream URL <span className="text-red-400">*</span>
            </Label>
            <Input
              id="editStreamUrl"
              value={editedStream.streamUrl}
              onChange={(e) => setEditedStream(prev => ({ ...prev, streamUrl: e.target.value }))}
              placeholder="http://stream.example.com/radio"
              className="glass-card border-slate-600/50"
            />
          </div>
          <div>
            <Label htmlFor="editStreamGenre">Genre (optional)</Label>
            <Input
              id="editStreamGenre"
              value={editedStream.genre}
              onChange={(e) => setEditedStream(prev => ({ ...prev, genre: e.target.value }))}
              placeholder="e.g., Pop, Rock, News"
              className="glass-card border-slate-600/50"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="glass-card border-slate-600/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !editedStream.title || !editedStream.artist || !editedStream.streamUrl}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
