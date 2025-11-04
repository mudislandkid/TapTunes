import { useState, useEffect } from 'react'
import { Image as ImageIcon, Check, X, Folder as FolderIcon, Edit3 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AlbumArtPicker } from './AlbumArtPicker'

interface FolderDetailDialogProps {
  folderId: string | null
  apiBase: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

interface Folder {
  id: string
  name: string
  trackCount: number
  albumArtPath?: string
}

export function FolderDetailDialog({
  folderId,
  apiBase,
  open,
  onOpenChange,
  onUpdate
}: FolderDetailDialogProps) {
  const [folder, setFolder] = useState<Folder | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [albumArtPickerOpen, setAlbumArtPickerOpen] = useState(false)

  // Fetch folder details
  useEffect(() => {
    if (open && folderId) {
      fetchFolder()
    }
  }, [open, folderId])

  const fetchFolder = async () => {
    if (!folderId) return

    setLoading(true)
    try {
      // Fetch all folders and find the one we need
      const response = await fetch(`${apiBase}/media/folders`)
      if (response.ok) {
        const data = await response.json()
        const foundFolder = data.folders.find((f: Folder) => f.id === folderId)
        if (foundFolder) {
          setFolder(foundFolder)
        }
      }
    } catch (error) {
      console.error('Error fetching folder:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartEditName = () => {
    setEditedName(folder?.name || '')
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleSaveName = async () => {
    if (!folderId || !editedName.trim() || editedName === folder?.name) {
      setIsEditingName(false)
      return
    }

    try {
      const response = await fetch(`${apiBase}/media/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName.trim() })
      })

      if (response.ok) {
        setFolder(prev => prev ? { ...prev, name: editedName.trim() } : null)
        setIsEditingName(false)
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error updating folder name:', error)
    }
  }

  const handleAlbumArtSelected = () => {
    fetchFolder()
    onUpdate?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-slate-700/50 max-w-lg">
          <DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') handleCancelEditName()
                      }}
                      className="glass-card border-slate-600/50 text-slate-100"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveName}
                      className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEditName}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <DialogTitle className="text-slate-100 text-xl">
                      {folder?.name || 'Folder'}
                    </DialogTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEditName}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>

              <DialogDescription className="text-slate-300">
                {folder?.trackCount || 0} tracks in this folder
              </DialogDescription>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAlbumArtPickerOpen(true)}
                  className="glass-card border-slate-600/50 text-sm"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Change Album Art
                </Button>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FolderIcon className="w-12 h-12 text-slate-400 animate-pulse" />
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm text-slate-400 text-center">
                Use the buttons above to customize this folder
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlbumArtPicker
        type="folder"
        id={folderId || ''}
        apiBase={apiBase}
        open={albumArtPickerOpen}
        onOpenChange={setAlbumArtPickerOpen}
        onSelect={handleAlbumArtSelected}
      />
    </>
  )
}
