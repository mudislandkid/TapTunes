import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Book, Upload, X } from 'lucide-react';

interface AudiobookUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AudiobookUploadDialog({ isOpen, onClose, onSuccess }: AudiobookUploadDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
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

    if (!title || !author || files.length === 0) {
      alert('Please fill in title, author, and select at least one audio file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Create the audiobook
      const audiobookResponse = await fetch('/api/audiobooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author,
          description
        })
      });

      if (!audiobookResponse.ok) {
        throw new Error('Failed to create audiobook');
      }

      const audiobook = await audiobookResponse.json();

      // Step 2: Upload each file as a track and add to audiobook
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        // Upload the track
        const uploadResponse = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const track = await uploadResponse.json();

        // Add track to audiobook
        await fetch(`/api/audiobooks/${audiobook.id}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: track.id })
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      alert(`Audiobook "${title}" created successfully with ${files.length} chapters!`);
      setTitle('');
      setAuthor('');
      setDescription('');
      setFiles([]);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating audiobook:', error);
      alert('Failed to create audiobook. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Book className="w-5 h-5 text-blue-400" />
            Upload Audiobook
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="title" className="text-gray-300">
              Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter audiobook title"
              className="bg-gray-800 border-gray-600 text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="author" className="text-gray-300">
              Author *
            </Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name"
              className="bg-gray-800 border-gray-600 text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">
              Description (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter audiobook description"
              className="bg-gray-800 border-gray-600 text-white min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="files" className="text-gray-300">
              Chapter Files * (will be sorted alphabetically)
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
              Select multiple audio files (MP3, M4A, etc.). They will be ordered as chapters.
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-300">
                Selected Files ({files.length}) - Chapter Order:
              </Label>
              <div className="bg-gray-800 rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm text-gray-300 hover:bg-gray-700 p-2 rounded"
                  >
                    <span className="flex-1 truncate">
                      <span className="text-blue-400 font-mono mr-2">{index + 1}.</span>
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
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading || !title || !author || files.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Create Audiobook'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
