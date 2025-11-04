import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, X, Plus, Play } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fadeInUp } from '../../lib/animations'

interface SleepTimerProps {
  apiBase: string
}

interface TimerState {
  isActive: boolean
  remainingSeconds: number
  totalSeconds: number
}

export const SleepTimer = memo(function SleepTimer({ apiBase }: SleepTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedMinutes, setSelectedMinutes] = useState(30)
  const [customMinutes, setCustomMinutes] = useState('')

  // Fetch timer state from backend
  const fetchTimerState = async () => {
    try {
      const response = await fetch(`${apiBase}/sleep-timer/status`)
      if (response.ok) {
        const data = await response.json()
        setTimerState(data)
      }
    } catch (error) {
      console.error('Failed to fetch sleep timer state:', error)
    }
  }

  // Poll timer state every second when active
  useEffect(() => {
    if (timerState.isActive) {
      const interval = setInterval(fetchTimerState, 1000)
      return () => clearInterval(interval)
    }
  }, [timerState.isActive])

  // Initial fetch
  useEffect(() => {
    fetchTimerState()
  }, [])

  const startTimer = async () => {
    try {
      // Use custom minutes if entered, otherwise use selected preset
      const minutes = customMinutes ? parseInt(customMinutes) : selectedMinutes

      // Validate minutes
      if (isNaN(minutes) || minutes < 1 || minutes > 180) {
        console.error('Invalid minutes:', minutes)
        return
      }

      // Load fade settings from localStorage
      let fadeVolume = true
      let fadeDuration = 10
      try {
        const savedSettings = localStorage.getItem('taptunes-settings')
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          fadeVolume = settings.fadeVolumeOnSleep ?? true
          fadeDuration = settings.fadeVolumeDuration ?? 10
        }
      } catch (error) {
        console.warn('Failed to load fade settings:', error)
      }

      console.log(`Starting timer: ${minutes}m, fade: ${fadeVolume}, duration: ${fadeDuration}s`)

      const response = await fetch(`${apiBase}/sleep-timer/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, fadeVolume, fadeDuration })
      })
      if (response.ok) {
        const data = await response.json()
        setTimerState(data)
        setIsExpanded(false)
        setCustomMinutes('') // Clear custom input
      }
    } catch (error) {
      console.error('Failed to start sleep timer:', error)
    }
  }

  const stopTimer = async () => {
    try {
      const response = await fetch(`${apiBase}/sleep-timer/stop`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        setTimerState(data)
      }
    } catch (error) {
      console.error('Failed to stop sleep timer:', error)
    }
  }

  const addMinutes = async (minutes: number) => {
    try {
      const response = await fetch(`${apiBase}/sleep-timer/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })
      if (response.ok) {
        const data = await response.json()
        setTimerState(data)
      }
    } catch (error) {
      console.error('Failed to add time:', error)
    }
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = timerState.totalSeconds > 0
    ? (timerState.remainingSeconds / timerState.totalSeconds) * 100
    : 0

  // Calculate circular progress (circumference of circle with radius 40)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <motion.div variants={fadeInUp} className="relative">
      <AnimatePresence>
        {timerState.isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="mb-4"
          >
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Circular Progress */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="transform -rotate-90 w-20 h-20 overflow-visible">
                    {/* Background circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-slate-700/50"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="text-purple-500 transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Time display */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm font-mono font-bold text-purple-100">
                        {formatTime(timerState.remainingSeconds)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addMinutes(5)}
                      className="h-8 px-2 glass-card border-slate-600/50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      5m
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addMinutes(15)}
                      className="h-8 px-2 glass-card border-slate-600/50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      15m
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopTimer}
                    className="h-8 text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Stop
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Timer Button */}
      {!timerState.isActive && (
        <AnimatePresence>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <GlassCard className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-200">Sleep Timer</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsExpanded(false)}
                      className="h-6 w-6"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Quick time buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 45, 60, 90, 120].map((mins) => (
                      <Button
                        key={mins}
                        variant={selectedMinutes === mins && !customMinutes ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectedMinutes(mins)
                          setCustomMinutes('')
                        }}
                        className={selectedMinutes === mins && !customMinutes
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'glass-card border-slate-600/50'
                        }
                      >
                        {mins}m
                      </Button>
                    ))}
                  </div>

                  {/* Custom time input */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Custom time (1-180 minutes)</label>
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="Enter minutes..."
                      className="bg-slate-800/50 border-slate-600/50 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>

                  <Button
                    onClick={startTimer}
                    disabled={!customMinutes && !selectedMinutes}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Timer
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Button
                variant="outline"
                onClick={() => setIsExpanded(true)}
                className="w-full glass-card border-slate-600/50 justify-start"
              >
                <Timer className="w-4 h-4 mr-2 text-purple-400" />
                <span className="text-slate-300">Sleep Timer</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  )
})
