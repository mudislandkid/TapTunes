import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Upload, X, Plus } from 'lucide-react';

interface AddChaptersDialogProps {
  audiobookId: string;
  audiobookTitle: string;
  currentChapterCount: number;
  apiBase?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddChaptersDialog({
  audiobookId,
  audiobookTitle,
  currentChapterCount,
  apiBase = '',
  open,
  onOpenChange,
  onSuccess
}: AddChaptersDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      // Sort files by name to maintain chapter order
      selectedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setFiles(selectedFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      alert('Please select at least one audio file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload each file as a track and add to audiobook
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('files', file);

        // Upload the track
        const uploadUrl = apiBase ? `${apiBase}/media/upload` : '/api/media/upload';
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const uploadResult = await uploadResponse.json();

        // Extract track from results array
        if (!uploadResult.results || !uploadResult.results[0] || !uploadResult.results[0].success) {
          throw new Error(`Failed to process ${file.name}`);
        }

        const track = uploadResult.results[0].track;

        // Add track to audiobook
        const addTrackUrl = apiBase
          ? `${apiBase}/audiobooks/${audiobookId}/tracks`
          : `/api/audiobooks/${audiobookId}/tracks`;

        await fetch(addTrackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: track.id })
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      alert(`Successfully added ${files.length} chapter${files.length > 1 ? 's' : ''} to "${audiobookTitle}"!`);
      setFiles([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding chapters:', error);
      alert('Failed to add chapters. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-purple-400" />
            Add Chapters to "{audiobookTitle}"
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-2">
            Current chapters: {currentChapterCount}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="files" className="text-gray-300">
              Select Audio Files * (will be sorted alphabetically)
            </Label>
            <Input
              id="files"
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileChange}
              className="bg-gray-800 border-gray-600 text-white cursor-pointer"
            />
            <p className="text-xs text-gray-400 mt-1">
              Select multiple audio files (MP3, M4A, etc.). They will be added as new chapters at the end.
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-300">
                Selected Files ({files.length}) - Will be added as chapters {currentChapterCount + 1}-{currentChapterCount + files.length}:
              </Label>
              <div className="bg-gray-800 rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm text-gray-300 hover:bg-gray-700 p-2 rounded"
                  >
                    <span className="flex-1 truncate">
                      <span className="text-purple-400 font-mono mr-2">
                        Ch {currentChapterCount + index + 1}.
                      </span>
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Uploading chapters...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading || files.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : `Add ${files.length} Chapter${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
