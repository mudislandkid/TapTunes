import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Play, Edit3, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { GlassCard } from '../ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { fadeInUp } from '../../lib/animations';
import type { Track } from '../../types/media';

interface StreamsViewProps {
  streams: Track[];
  onPlayTrack: (track: Track) => void;
  onEditStream: (stream: Track) => void;
  onDeleteStream: (stream: Track) => void;
}

export function StreamsView({
  streams,
  onPlayTrack,
  onEditStream,
  onDeleteStream
}: StreamsViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Track | null>(null);

  const handleDeleteClick = (stream: Track) => {
    setSelectedStream(stream);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedStream) {
      onDeleteStream(selectedStream);
      setDeleteDialogOpen(false);
      setSelectedStream(null);
    }
  };

  if (streams.length === 0) {
    return (
      <motion.div
        className="text-center py-12"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
      >
        <Radio className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-300">No radio streams found</p>
        <p className="text-sm text-slate-400 mt-2">Add your first internet radio stream to get started</p>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
      >
        {streams.map((stream) => (
          <GlassCard
            key={stream.id}
            className="p-4 hover:bg-slate-800/50 transition-all group relative overflow-hidden"
          >
            {/* Gradient background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
              {/* Stream icon/thumbnail */}
              <div className="w-full aspect-square bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg mb-3 flex items-center justify-center">
                <Radio className="w-12 h-12 text-white" />
              </div>

              {/* Stream info */}
              <div className="space-y-1 mb-3">
                <h3 className="font-semibold text-white truncate" title={stream.title}>
                  {stream.title}
                </h3>
                <p className="text-sm text-slate-400 truncate" title={stream.artist}>
                  {stream.artist}
                </p>
                {stream.genre && (
                  <p className="text-xs text-slate-500 truncate">
                    {stream.genre}
                  </p>
                )}
              </div>

              {/* Stream URL */}
              {stream.sourceUrl && (
                <div className="mb-3">
                  <a
                    href={stream.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 truncate"
                    title={stream.sourceUrl}
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{stream.sourceUrl}</span>
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => onPlayTrack(stream)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Play
                </Button>
                <Button
                  onClick={() => onEditStream(stream)}
                  variant="outline"
                  size="sm"
                  className="border-slate-600/50"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDeleteClick(stream)}
                  variant="outline"
                  size="sm"
                  className="border-red-600/50 text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </GlassCard>
        ))}
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-slate-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete Stream</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete "{selectedStream?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-card border-slate-600/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
