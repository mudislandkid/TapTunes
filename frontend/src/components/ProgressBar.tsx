import { useState } from 'react'
import { motion } from 'framer-motion'
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { fadeInUp, springConfig } from '../lib/animations'

interface ProgressBarProps {
  progress: number // 0 to 100
  duration?: number // in seconds
  currentTime?: number // in seconds
  onSeek?: (time: number) => void
}

export default function ProgressBar({ 
  progress, 
  duration = 0, 
  currentTime = 0, 
  onSeek 
}: ProgressBarProps) {
  const [isSeekingValue, setIsSeekingValue] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (value: number[]) => {
    if (onSeek && duration) {
      const newTime = (value[0] / 100) * duration
      onSeek(newTime)
      setIsSeekingValue(null)
      setIsDragging(false)
      setDragProgress(null)
    }
  }

  const handleSeekPreview = (value: number[]) => {
    if (duration) {
      const previewTime = (value[0] / 100) * duration
      setIsSeekingValue(previewTime)
      setIsDragging(true)
      setDragProgress(value[0])
    }
  }

  return (
    <motion.div 
      className="w-full space-y-3"
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Progress Slider */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.1, ...springConfig }}
      >
        {onSeek ? (
          <div className="relative py-3 px-1">
            <Slider
              value={[isDragging ? (dragProgress ?? progress) : progress]}
              onValueChange={handleSeekPreview}
              onValueCommit={handleSeek}
              max={100}
              step={0.1}
              className="w-full cursor-pointer [&>span:first-child]:h-2 [&>span:first-child]:bg-slate-600/50 [&>span:last-child]:h-5 [&>span:last-child]:w-5 [&>span:last-child]:border-2 [&>span:last-child]:bg-white [&>span:last-child]:shadow-lg [&>span:last-child]:hover:scale-110 [&>span:last-child]:transition-transform"
              style={{ touchAction: 'none' }}
            />
          </div>
        ) : (
          <Progress 
            value={progress} 
            className="w-full h-2 bg-slate-700/50"
          />
        )}
      </motion.div>

      {/* Time Display */}
      <motion.div 
        className="flex justify-between text-xs text-slate-400"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <motion.span
          key={isDragging ? isSeekingValue : currentTime}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={isDragging ? 'text-cyan-300 font-semibold' : ''}
        >
          {formatTime(isDragging && isSeekingValue !== null ? isSeekingValue : currentTime)}
        </motion.span>
        <motion.span
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
        >
          {formatTime(duration)}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}