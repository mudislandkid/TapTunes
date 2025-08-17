import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { scaleIn, pulse } from '../lib/animations'
import { SharedAudioContextService } from '../services/sharedAudioContext'

interface AudioVisualizerProps {
  isPlaying: boolean
  size?: 'sm' | 'md' | 'lg'
  audioElement?: HTMLAudioElement | null
  style?: 'bars' | 'circular' | 'wave'
}

export default function AudioVisualizer({ 
  isPlaying, 
  size = 'md', 
  audioElement, 
  style = 'bars' 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [useRealAudio, setUseRealAudio] = useState(false)

  const sizeClasses = {
    sm: { width: 120, height: 60, bars: 16 },
    md: { width: 200, height: 80, bars: 24 },
    lg: { width: 300, height: 120, bars: 32 }
  }

  const { width, height, bars } = sizeClasses[size]

  // Initialize Web Audio API when we have an audio element
  useEffect(() => {
    if (!audioElement || isInitialized || !isPlaying) return

    const initializeAudioContext = async () => {
      try {
        console.log('🎵 [VISUALIZER] Initializing real-time audio analysis')
        
        const sharedAudio = SharedAudioContextService.getInstance()
        
        // Initialize shared audio context
        await sharedAudio.initialize(audioElement)
        
        // Subscribe to the analyser node from shared audio context
        sharedAudio.subscribeToAnalyser((analyser) => {
          analyserRef.current = analyser
          
          // Update FFT size if needed
          const desiredSize = bars * 2
          const fftSize = Math.pow(2, Math.ceil(Math.log2(desiredSize)))
          const finalFftSize = Math.max(256, fftSize)
          
          if (analyser.fftSize !== finalFftSize) {
            analyser.fftSize = finalFftSize
            console.log(`🎵 [VISUALIZER] FFT size updated: ${finalFftSize}`)
          }
          
          // Create data array for frequency data
          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          dataArrayRef.current = dataArray
          
          setIsInitialized(true)
          setUseRealAudio(true)
          console.log('✅ [VISUALIZER] Real-time audio analysis ready via shared context')
        })

      } catch (error) {
        console.warn('⚠️ [VISUALIZER] Failed to initialize audio context, using fallback:', error)
        setUseRealAudio(false)
      }
    }

    initializeAudioContext()
  }, [audioElement, isPlaying, isInitialized, bars])

  // Resume audio context on play (required by browsers)
  useEffect(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended' && isPlaying) {
      audioContextRef.current.resume()
    }
  }, [isPlaying])

  // Main visualization loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    let frequencies: number[] = new Array(bars).fill(0)

    const draw = () => {
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      if (isPlaying) {
        if (useRealAudio && analyserRef.current && dataArrayRef.current) {
          // Get real frequency data
          analyserRef.current.getByteFrequencyData(dataArrayRef.current)
          
          // Map frequency data to our bar count
          frequencies = new Array(bars).fill(0).map((_, i) => {
            const dataIndex = Math.floor(i * dataArrayRef.current!.length / bars)
            return dataArrayRef.current![dataIndex] / 255
          })
        } else {
          // Fallback: Simulate audio frequencies with more realistic patterns
          frequencies = frequencies.map((_, i) => {
            const baseFreq = Math.sin(Date.now() * 0.005 + i * 0.3) * 0.4 + 0.4
            const randomness = Math.random() * 0.4
            const decay = Math.exp(-i * 0.1) // Higher frequencies typically have less energy
            return Math.max(0.05, Math.min(1, (baseFreq + randomness) * decay))
          })
        }
      } else {
        // Gradually decrease to zero when not playing
        frequencies = frequencies.map(freq => Math.max(0, freq * 0.92))
      }

      // Draw visualization based on style
      if (style === 'bars') {
        drawBars(ctx, frequencies, width, height, bars)
      } else if (style === 'circular') {
        drawCircular(ctx, frequencies, width, height, bars)
      } else if (style === 'wave') {
        drawWave(ctx, frequencies, width, height)
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, width, height, bars, useRealAudio, style])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const drawBars = (ctx: CanvasRenderingContext2D, frequencies: number[], width: number, height: number, bars: number) => {
    const barWidth = width / bars
    const maxBarHeight = height * 0.85

    frequencies.forEach((frequency, i) => {
      const barHeight = frequency * maxBarHeight
      const x = i * barWidth + barWidth * 0.15
      const y = height - barHeight
      const barActualWidth = barWidth * 0.7

      // Create gradient based on frequency intensity
      const gradient = ctx.createLinearGradient(0, height, 0, 0)
      if (frequency > 0.7) {
        gradient.addColorStop(0, '#3b82f6') // blue-500
        gradient.addColorStop(0.5, '#06b6d4') // cyan-500  
        gradient.addColorStop(1, '#f59e0b') // amber-500
      } else if (frequency > 0.4) {
        gradient.addColorStop(0, '#3b82f6') // blue-500
        gradient.addColorStop(1, '#06b6d4') // cyan-500
      } else {
        gradient.addColorStop(0, '#1e40af') // blue-800
        gradient.addColorStop(1, '#3b82f6') // blue-500
      }

      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barActualWidth, barHeight)

      // Add glow for high frequencies
      if (frequency > 0.6) {
        ctx.shadowColor = '#06b6d4'
        ctx.shadowBlur = 8
        ctx.fillRect(x, y, barActualWidth, barHeight)
        ctx.shadowBlur = 0
      }
    })
  }

  const drawCircular = (ctx: CanvasRenderingContext2D, frequencies: number[], width: number, height: number, bars: number) => {
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(centerX, centerY) - 10

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2

    // Draw circular waveform
    ctx.beginPath()
    for (let i = 0; i < bars; i++) {
      const amplitude = frequencies[i] * 20
      const angle = (i / bars) * Math.PI * 2

      const x = centerX + Math.cos(angle) * (radius + amplitude)
      const y = centerY + Math.sin(angle) * (radius + amplitude)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.stroke()

    // Fill with gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)')
    ctx.fillStyle = gradient
    ctx.fill()
  }

  const drawWave = (ctx: CanvasRenderingContext2D, frequencies: number[], width: number, height: number) => {
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2

    ctx.beginPath()
    const sliceWidth = width / frequencies.length
    let x = 0

    for (let i = 0; i < frequencies.length; i++) {
      const y = height - (frequencies[i] * height)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()

    // Add glow effect
    ctx.shadowColor = '#3b82f6'
    ctx.shadowBlur = 5
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      className="flex flex-col items-center justify-center space-y-2"
    >
      <motion.canvas
        ref={canvasRef}
        className="rounded-lg bg-slate-900/20 border border-slate-700/30"
        style={{ width: `${width}px`, height: `${height}px` }}
        variants={isPlaying ? pulse : {}}
        animate={isPlaying ? "animate" : "initial"}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      />
      
      {/* Real-time indicator */}
      {useRealAudio && isPlaying && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xs text-green-400 flex items-center space-x-1"
        >
          <motion.div
            className="w-2 h-2 bg-green-400 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span>Live Audio</span>
        </motion.div>
      )}
    </motion.div>
  )
}