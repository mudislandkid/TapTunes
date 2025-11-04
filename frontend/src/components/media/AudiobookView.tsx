import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Trash2, Play, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import AudiobookDetailDialog from './AudiobookDetailDialog';
import { staggerContainer, scaleIn, cardHover } from '../../lib/animations';

interface Audiobook {
  id: string;
  title: string;
  author: string;
  description?: string;
  track_count: number;
  duration: number;
  album_art_path?: string;
  created_at: string;
  updated_at: string;
}

interface AudiobookViewProps {
  audiobooks: Audiobook[];
  apiBase: string;
  onDeleteAudiobook: (audiobookId: string) => void;
  onUpdate?: () => void;
  onPlayAudiobook: (audiobookId: string) => void;
  formatDuration: (seconds: number) => string;
}

export const AudiobookView = memo(function AudiobookView({
  audiobooks,
  apiBase,
  onDeleteAudiobook,
  onUpdate,
  onPlayAudiobook,
  formatDuration
}: AudiobookViewProps) {
  const [selectedAudiobookId, setSelectedAudiobookId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handleAudiobookClick = (audiobookId: string) => {
    setSelectedAudiobookId(audiobookId);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedAudiobookId(null);
  };

  const handleAudiobookUpdate = () => {
    onUpdate?.();
  };

  const handlePlay = (e: React.MouseEvent, audiobookId: string) => {
    e.stopPropagation();
    onPlayAudiobook(audiobookId);
  };

  const handleEdit = (e: React.MouseEvent, audiobookId: string) => {
    e.stopPropagation();
    setSelectedAudiobookId(audiobookId);
    setDetailDialogOpen(true);
  };

  return (
    <>
      <motion.div
        className="space-y-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Audiobooks Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {audiobooks.map((audiobook, index) => (
            <motion.div
              key={audiobook.id}
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
                  onClick={() => handleAudiobookClick(audiobook.id)}
                >
                  {/* Album Art or Default Icon */}
                  {audiobook.album_art_path ? (
                    <motion.div
                      className="w-full aspect-square mb-3 rounded-lg overflow-hidden bg-slate-800"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                    >
                      <img
                        src={`${apiBase}/${audiobook.album_art_path}`}
                        alt={audiobook.title}
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      className="w-full aspect-square mx-auto mb-3 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Book className="w-12 h-12 text-purple-400" />
                    </motion.div>
                  )}

                  <h3 className="font-semibold text-slate-100 text-sm truncate mb-1">
                    {audiobook.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mb-1">
                    {audiobook.author}
                  </p>
                  <p className="text-xs text-slate-500">
                    {audiobook.track_count} chapters · {formatDuration(audiobook.duration)}
                  </p>

                  {/* Action Buttons */}
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 flex gap-1 justify-center"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                      onClick={(e) => handlePlay(e, audiobook.id)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-300 hover:bg-slate-700/20"
                      onClick={(e) => handleEdit(e, audiobook.id)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card border-slate-700/50">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">
                            Delete Audiobook
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete "{audiobook.title}"? This will remove the audiobook but not the audio files.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteAudiobook(audiobook.id)}
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

        {audiobooks.length === 0 && (
          <div className="text-center py-12">
            <Book className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No Audiobooks Yet
            </h3>
            <p className="text-slate-400">
              Upload your first audiobook to get started
            </p>
          </div>
        )}
      </motion.div>

      {/* Audiobook Detail Dialog */}
      <AudiobookDetailDialog
        audiobookId={selectedAudiobookId}
        apiBase={apiBase}
        open={detailDialogOpen}
        onOpenChange={handleDetailDialogClose}
        onUpdate={handleAudiobookUpdate}
      />
    </>
  );
});
