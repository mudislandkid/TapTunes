import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion } from 'framer-motion'
import { scaleIn } from '../lib/animations'

interface VolumeControlProps {
  volume: number // 0 to 100
  onVolumeChange: (volume: number) => void
  className?: string
}

export default function VolumeControl({ volume, onVolumeChange, className }: VolumeControlProps) {
  const [inputValue, setInputValue] = useState(Math.round(volume).toString())

  const handleVolumeChange = (newVolume: number) => {
    // Clamp between 0 and 100
    const clampedVolume = Math.max(0, Math.min(100, newVolume))
    onVolumeChange(clampedVolume)
    setInputValue(Math.round(clampedVolume).toString())
  }

  const handlePresetClick = (preset: number) => {
    handleVolumeChange(preset)
  }

  const handleIncrement = () => {
    handleVolumeChange(volume + 5)
  }

  const handleDecrement = () => {
    handleVolumeChange(volume - 5)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Only update volume if it's a valid number
    const numValue = parseInt(value)
    if (!isNaN(numValue)) {
      handleVolumeChange(numValue)
    }
  }

  const handleInputBlur = () => {
    // Reset to current volume if input is invalid
    const numValue = parseInt(inputValue)
    if (isNaN(numValue)) {
      setInputValue(Math.round(volume).toString())
    }
  }

  // Preset buttons data
  const presets = [0, 25, 50, 75, 100]

  return (
    <motion.div
      className={`flex flex-col space-y-2 ${className}`}
      variants={scaleIn}
      initial="initial"
      animate="animate"
    >
      {/* Quick preset buttons - compact horizontal row */}
      <div className="flex items-center justify-between gap-1.5">
        {presets.map((preset) => (
          <motion.div key={preset} whileTap={{ scale: 0.95 }} className="flex-1">
            <Button
              variant={Math.round(volume) === preset ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(preset)}
              className={`
                w-full h-10 text-sm font-semibold px-2
                ${Math.round(volume) === preset
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'glass-card hover:bg-slate-700'
                }
              `}
            >
              {preset}%
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Fine adjustment controls - compact row */}
      <div className="flex items-center gap-2">
        {/* Minus button */}
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDecrement}
            className="glass-card h-10 w-10 p-0"
            title="Decrease volume by 5%"
          >
            <Minus className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* Custom input */}
        <div className="flex-1 relative">
          <Input
            type="number"
            min="0"
            max="100"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="glass-card h-10 text-center text-base font-semibold pr-7"
            placeholder="0-100"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
            %
          </span>
        </div>

        {/* Plus button */}
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleIncrement}
            className="glass-card h-10 w-10 p-0"
            title="Increase volume by 5%"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}