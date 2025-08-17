import { useState } from 'react'
import { Volume2, VolumeX, Volume1 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { motion } from 'framer-motion'
import { buttonPulse, scaleIn, springConfig } from '../lib/animations'

interface VolumeControlProps {
  volume: number // 0 to 100
  onVolumeChange: (volume: number) => void
  className?: string
}

export default function VolumeControl({ volume, onVolumeChange, className }: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(volume)

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX
    if (volume < 50) return Volume1
    return Volume2
  }

  const handleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      onVolumeChange(previousVolume)
    } else {
      setPreviousVolume(volume)
      setIsMuted(true)
      onVolumeChange(0)
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    setIsMuted(false)
    onVolumeChange(newVolume)
  }

  const handleSliderChange = (value: number[]) => {
    handleVolumeChange(value[0])
  }

  const VolumeIcon = getVolumeIcon()

  return (
    <motion.div 
      className={`relative ${className}`}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
      variants={scaleIn}
      initial="initial"
      animate="animate"
    >
      <motion.div
        variants={buttonPulse}
        whileHover="hover"
        whileTap="tap"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMute}
          className="glass-card h-10 w-10"
        >
          <motion.div
            key={VolumeIcon.name}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <VolumeIcon className="w-4 h-4" />
          </motion.div>
        </Button>
      </motion.div>

      {/* Volume Slider */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ 
          opacity: showSlider ? 1 : 0,
          y: showSlider ? 0 : 10,
          scale: showSlider ? 1 : 0.95
        }}
        transition={{ duration: 0.2, ...springConfig }}
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 glass-card"
        style={{ pointerEvents: showSlider ? 'auto' : 'none' }}
      >
        <motion.div 
          className="flex flex-col items-center space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: showSlider ? 1 : 0 }}
          transition={{ delay: showSlider ? 0.1 : 0 }}
        >
          <motion.span 
            className="text-xs text-slate-300"
            key={volume}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.1 }}
          >
            {Math.round(volume)}%
          </motion.span>
          
          <div className="h-24 flex items-center">
            <motion.div
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
            >
              <Slider
                value={[volume]}
                onValueChange={handleSliderChange}
                max={100}
                step={1}
                orientation="vertical"
                className="h-20"
              />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}