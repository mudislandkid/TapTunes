import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FolderPlus, Plus } from 'lucide-react'
import type { Folder, Playlist } from '../../types/media'

interface UploadDestination {
  folderId?: string
  folderName?: string
  albumName?: string
  playlistId?: string
  playlistName?: string
}

interface UploadDestinationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (destination: UploadDestination) => void
  apiBase: string
}

export function UploadDestinationDialog({
  open,
  onOpenChange,
  onConfirm,
  apiBase
}: UploadDestinationDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [newFolderName, setNewFolderName] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('')
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)

  // Fetch folders and playlists when dialog opens
  useEffect(() => {
    if (open) {
      fetchFolders()
      fetchPlaylists()
    }
  }, [open])

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${apiBase}/media/folders`)
      const data = await response.json()
      setFolders(data.folders || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${apiBase}/media/playlists`)
      const data = await response.json()
      setPlaylists(data.playlists || [])
    } catch (error) {
      console.error('Error fetching playlists:', error)
    }
  }

  const handleConfirm = () => {
    const destination: UploadDestination = {}

    // Handle folder selection
    if (isCreatingFolder && newFolderName.trim()) {
      destination.folderName = newFolderName.trim()
    } else if (selectedFolder && selectedFolder !== 'root') {
      destination.folderId = selectedFolder
    }

    // Handle album name
    if (albumName.trim()) {
      destination.albumName = albumName.trim()
    }

    // Handle playlist selection
    if (isCreatingPlaylist && newPlaylistName.trim()) {
      destination.playlistName = newPlaylistName.trim()
    } else if (selectedPlaylist) {
      destination.playlistId = selectedPlaylist
    }

    onConfirm(destination)

    // Reset form
    setSelectedFolder('')
    setNewFolderName('')
    setAlbumName('')
    setSelectedPlaylist('')
    setNewPlaylistName('')
    setIsCreatingFolder(false)
    setIsCreatingPlaylist(false)
  }

  const handleCancel = () => {
    // Reset form
    setSelectedFolder('')
    setNewFolderName('')
    setAlbumName('')
    setSelectedPlaylist('')
    setNewPlaylistName('')
    setIsCreatingFolder(false)
    setIsCreatingPlaylist(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-slate-700/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Upload Destination</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder" className="text-slate-200">Folder (Optional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isCreatingFolder ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsCreatingFolder(!isCreatingFolder)
                  setSelectedFolder('')
                }}
                className={isCreatingFolder ? "" : "glass-card border-slate-600/50"}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </Button>
              <Select
                value={selectedFolder}
                onValueChange={(value) => {
                  setSelectedFolder(value)
                  setIsCreatingFolder(false)
                  setNewFolderName('')
                }}
                disabled={isCreatingFolder}
              >
                <SelectTrigger className="glass-card border-slate-600/50 flex-1">
                  <SelectValue placeholder="Select folder or use root" />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-700/50">
                  <SelectItem value="root">Root Folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCreatingFolder && (
              <Input
                id="newFolder"
                placeholder="Enter new folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="glass-card border-slate-600/50"
              />
            )}
          </div>

          {/* Album Name */}
          <div className="space-y-2">
            <Label htmlFor="album" className="text-slate-200">Album Name (Optional)</Label>
            <Input
              id="album"
              placeholder="e.g., Greatest Hits"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              className="glass-card border-slate-600/50"
            />
            <p className="text-xs text-slate-400">
              This will set the album metadata for all uploaded files
            </p>
          </div>

          {/* Playlist Selection */}
          <div className="space-y-2">
            <Label htmlFor="playlist" className="text-slate-200">Add to Playlist (Optional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isCreatingPlaylist ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsCreatingPlaylist(!isCreatingPlaylist)
                  setSelectedPlaylist('')
                }}
                className={isCreatingPlaylist ? "" : "glass-card border-slate-600/50"}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Playlist
              </Button>
              <Select
                value={selectedPlaylist}
                onValueChange={(value) => {
                  setSelectedPlaylist(value)
                  setIsCreatingPlaylist(false)
                  setNewPlaylistName('')
                }}
                disabled={isCreatingPlaylist}
              >
                <SelectTrigger className="glass-card border-slate-600/50 flex-1">
                  <SelectValue placeholder="Select playlist" />
                </SelectTrigger>
                <SelectContent className="glass-card border-slate-700/50">
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCreatingPlaylist && (
              <Input
                id="newPlaylist"
                placeholder="Enter new playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="glass-card border-slate-600/50"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="glass-card border-slate-600/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              Continue Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
