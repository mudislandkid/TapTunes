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
  const [sliderTimeout, setSliderTimeout] = useState<NodeJS.Timeout | null>(null)

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

  const handleVolumeClick = () => {
    setShowSlider(!showSlider)
    
    // Clear existing timeout
    if (sliderTimeout) {
      clearTimeout(sliderTimeout)
    }
    
    // Auto-hide slider after 3 seconds of no interaction
    if (!showSlider) {
      const timeout = setTimeout(() => {
        setShowSlider(false)
      }, 3000)
      setSliderTimeout(timeout)
    }
  }

  const handleMouseEnter = () => {
    setShowSlider(true)
    if (sliderTimeout) {
      clearTimeout(sliderTimeout)
      setSliderTimeout(null)
    }
  }

  const handleMouseLeave = () => {
    if (!sliderTimeout) {
      setShowSlider(false)
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
          onContextMenu={(e) => {
            e.preventDefault()
            handleVolumeClick()
          }}
          className="glass-card h-12 w-12"
          title="Left-click to mute/unmute, right-click for volume slider"
        >
          <motion.div
            key={VolumeIcon.name}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <VolumeIcon className="w-5 h-5" />
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
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-4 glass-card"
        style={{ pointerEvents: showSlider ? 'auto' : 'none' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
          
          <div className="h-32 flex items-center">
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
                className="h-28"
              />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}