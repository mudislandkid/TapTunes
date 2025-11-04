import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, ChevronRight, Folder, Trash2, Edit3 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { FolderDetailDialog } from './FolderDetailDialog'
import type { Folder as FolderType, Track } from '../../types/media'
import { TrackListView } from './TrackListView'
import {
  staggerContainer,
  fadeInUp,
  scaleIn,
  cardHover
} from '../../lib/animations'

interface FolderViewProps {
  folders: FolderType[]
  currentFolder: string | null
  apiBase: string
  onFolderChange: (folderId: string | null) => void
  onDeleteFolder: (folderId: string) => void
  onUpdate?: () => void
  filteredTracks: Track[]
  onPlayTrack: (track: Track) => void
  formatDuration: (seconds: number) => string
}

export const FolderView = memo(function FolderView({
  folders,
  currentFolder,
  apiBase,
  onFolderChange,
  onDeleteFolder,
  onUpdate,
  filteredTracks,
  onPlayTrack,
  formatDuration
}: FolderViewProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const handleEditFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    setSelectedFolderId(folderId)
    setDetailDialogOpen(true)
  }

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false)
    setSelectedFolderId(null)
  }

  const handleFolderUpdate = () => {
    onUpdate?.()
  }

  return (
    <>
    <motion.div 
      className="space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Breadcrumb */}
      <motion.div 
        className="flex items-center space-x-2 text-sm text-slate-300"
        variants={fadeInUp}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFolderChange(null)}
          className="p-1 h-auto"
        >
          <Home className="w-4 h-4 mr-1" />
          Library
        </Button>
        {currentFolder && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span>{folders.find(f => f.id === currentFolder)?.name}</span>
          </>
        )}
      </motion.div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {folders
          .filter(f => f.parentId === currentFolder)
          .map((folder, index) => (
          <motion.div
            key={folder.id}
            variants={scaleIn}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <motion.div
              variants={cardHover}
              whileHover="hover"
              whileTap="tap"
            >
              <GlassCard 
                className="p-4 hover:bg-slate-800/60 transition-all group cursor-pointer text-center"
                onClick={() => onFolderChange(folder.id)}
              >
                <motion.div
                  className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Folder className="w-8 h-8 text-blue-400" />
                </motion.div>
                
                <h3 className="font-semibold text-slate-100 text-sm truncate mb-1">{folder.name}</h3>
                <p className="text-xs text-slate-400">{folder.trackCount} tracks</p>

                <motion.div
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 flex gap-1 justify-center"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-slate-300"
                    onClick={(e) => handleEditFolder(e, folder.id)}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card border-slate-700/50">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Delete Folder</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to delete "{folder.name}"? This will also remove all tracks in this folder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteFolder(folder.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </motion.div>
              </GlassCard>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Tracks in current folder */}
      {filteredTracks.length > 0 && (
        <motion.div variants={fadeInUp}>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Tracks</h3>
          <TrackListView
            tracks={filteredTracks}
            apiBase={apiBase}
            onPlayTrack={onPlayTrack}
            formatDuration={formatDuration}
          />
        </motion.div>
      )}
    </motion.div>

    <FolderDetailDialog
      folderId={selectedFolderId}
      apiBase={apiBase}
      open={detailDialogOpen}
      onOpenChange={handleDetailDialogClose}
      onUpdate={handleFolderUpdate}
    />
    </>
  )
})