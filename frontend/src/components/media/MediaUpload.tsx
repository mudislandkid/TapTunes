import { memo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Download, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { BatchMetadataDialog } from './BatchMetadataDialog'
import type { UploadProgress } from '../../types/media'

interface MediaUploadProps {
  apiBase: string
  currentFolder: string | null
  onRefreshLibrary: () => void
  dragOver: boolean
}

interface YouTubeProgress {
  status: 'initializing' | 'fetching' | 'downloading' | 'processing' | 'saving' | 'complete' | 'error'
  message: string
  progress: number
  videoTitle?: string
  error?: string
  track?: {
    id: string
    title: string
    artist: string
    duration: number
  }
}

export const MediaUpload = memo(function MediaUpload({
  apiBase,
  currentFolder,
  onRefreshLibrary,
  dragOver
}: MediaUploadProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false)
  const [isYouTubeProgressOpen, setIsYouTubeProgressOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [youtubeProgress, setYoutubeProgress] = useState<YouTubeProgress | null>(null)
  const [isBatchMetadataDialogOpen, setIsBatchMetadataDialogOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      handleFileUpload(Array.from(files))
    }
  }

  const handleFileUpload = async (files: File[]) => {
    const newUploads: UploadProgress[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading' as const
    }))
    
    setUploadProgress(newUploads)
    setIsUploadDialogOpen(true)

    try {
      const formData = new FormData()
      
      files.forEach(file => {
        formData.append('files', file)
      })
      
      if (currentFolder) {
        formData.append('folderId', currentFolder)
      }

      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(prev => 
            prev.map(upload => ({ ...upload, progress }))
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)

          setUploadProgress(prev =>
            prev.map((upload, index) => {
              const result = response.results[index]
              return {
                ...upload,
                progress: 100,
                status: result.success ? 'complete' : 'error',
                error: result.success ? undefined : result.error
              }
            })
          )

          onRefreshLibrary()
        } else {
          console.error('Upload failed with status:', xhr.status)
          let errorMessage = 'Upload failed'
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            errorMessage = errorResponse.error || errorResponse.details || errorMessage
            console.error('Server error:', errorResponse)
          } catch (e) {
            console.error('Could not parse error response:', xhr.responseText)
          }

          setUploadProgress(prev =>
            prev.map(upload => ({
              ...upload,
              status: 'error',
              error: errorMessage
            }))
          )
        }
      })

      xhr.addEventListener('error', () => {
        setUploadProgress(prev => 
          prev.map(upload => ({
            ...upload,
            status: 'error',
            error: 'Upload failed'
          }))
        )
      })

      xhr.open('POST', `${apiBase}/media/upload`)
      xhr.send(formData)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress(prev => 
        prev.map(upload => ({
          ...upload,
          status: 'error',
          error: 'Upload failed'
        }))
      )
    }
  }

  const handleYouTubeDownload = async () => {
    if (!youtubeUrl.trim()) {
      return
    }

    setIsDownloading(true)
    setDownloadError('')
    setYoutubeProgress(null)

    try {
      // Start the download
      const response = await fetch(`${apiBase}/media/download-youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: youtubeUrl,
          folderId: currentFolder
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setDownloadError(data.error || 'Download failed')
        setIsDownloading(false)
        return
      }

      // Get download ID and connect to SSE
      const { downloadId } = data

      // Close input dialog and open progress dialog with initial state
      setIsYouTubeDialogOpen(false)
      setYoutubeProgress({
        status: 'initializing',
        message: 'Connecting...',
        progress: 0
      })
      setIsYouTubeProgressOpen(true)

      // Connect to SSE progress endpoint
      const eventSource = new EventSource(`${apiBase}/media/download-youtube/progress/${downloadId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const progress: YouTubeProgress = JSON.parse(event.data)
          setYoutubeProgress(progress)

          // If complete, refresh library and close after delay
          if (progress.status === 'complete') {
            setTimeout(() => {
              setIsYouTubeProgressOpen(false)
              setYoutubeUrl('')
              setYoutubeProgress(null)
              setIsDownloading(false)
              onRefreshLibrary()
              eventSource.close()
            }, 2000)
          }

          // If error, show error and close after delay
          if (progress.status === 'error') {
            setDownloadError(progress.error || 'Download failed')
            setIsDownloading(false)
            setTimeout(() => {
              eventSource.close()
            }, 5000)
          }
        } catch (err) {
          console.error('Error parsing progress:', err)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        eventSource.close()
        setDownloadError('Connection error')
        setIsDownloading(false)
      }

    } catch (error) {
      console.error('YouTube download error:', error)
      setDownloadError('Download failed')
      setIsDownloading(false)
    }
  }

  const handleOpenBatchEnrichment = () => {
    setIsBatchMetadataDialogOpen(true)
  }

  return (
    <>
      {/* Drag overlay */}
      {dragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center"
        >
          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-blue-400">Drop audio files to upload</p>
          </div>
        </motion.div>
      )}

      {/* Upload Controls */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Files
        </Button>

        <Dialog open={isYouTubeDialogOpen} onOpenChange={setIsYouTubeDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="glass-card border-slate-600/50"
            >
              <Download className="w-4 h-4 mr-2" />
              YouTube
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-slate-700/50">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Download from YouTube</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="youtubeUrl">Video URL</Label>
                <Input
                  id="youtubeUrl"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="glass-card border-slate-600/50"
                />
              </div>
              {downloadError && (
                <div className="text-red-400 text-sm">{downloadError}</div>
              )}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsYouTubeDialogOpen(false)
                    setYoutubeUrl('')
                    setDownloadError('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleYouTubeDownload}
                  disabled={!youtubeUrl.trim() || isDownloading}
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          className="glass-card border-slate-600/50"
          onClick={handleOpenBatchEnrichment}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Enhance Metadata
        </Button>
      </div>


      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Progress Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Uploading Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {uploadProgress.map((upload, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 truncate flex-1 mr-2">
                    {upload.fileName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {upload.status === 'complete' ? 'Complete' : `${upload.progress}%`}
                  </span>
                </div>
                <Progress 
                  value={upload.progress} 
                  className={`w-full h-2 ${
                    upload.status === 'complete' ? 'bg-green-500/20' : 
                    upload.status === 'error' ? 'bg-red-500/20' : 'bg-slate-700/50'
                  }`}
                />
                {upload.error && (
                  <p className="text-xs text-red-400">{upload.error}</p>
                )}
              </motion.div>
            ))}
          </div>
          {uploadProgress.every(upload => upload.status === 'complete') && (
            <div className="flex justify-end">
              <Button onClick={() => setIsUploadDialogOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* YouTube Download Progress Dialog */}
      <Dialog open={isYouTubeProgressOpen} onOpenChange={(open) => {
        if (!open && youtubeProgress?.status !== 'downloading') {
          setIsYouTubeProgressOpen(false)
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
          }
        }
      }}>
        <DialogContent className="glass-card border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {youtubeProgress?.status === 'complete' ? '✅ Download Complete' : 'Downloading from YouTube'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {youtubeProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {/* Video Title */}
                {youtubeProgress.videoTitle && (
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-sm font-medium text-slate-200">
                      {youtubeProgress.videoTitle}
                    </p>
                  </div>
                )}

                {/* Status Message */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {youtubeProgress.message}
                  </span>
                  <span className="text-xs text-slate-400">
                    {Math.round(youtubeProgress.progress)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <Progress
                  value={youtubeProgress.progress}
                  className={`w-full h-3 ${
                    youtubeProgress.status === 'complete' ? 'bg-green-500/20' :
                    youtubeProgress.status === 'error' ? 'bg-red-500/20' :
                    'bg-blue-500/20'
                  }`}
                />

                {/* Status Icon */}
                {youtubeProgress.status === 'downloading' && (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                )}

                {/* Track Info on Complete */}
                {youtubeProgress.status === 'complete' && youtubeProgress.track && (
                  <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <p className="text-sm font-medium text-green-400 mb-1">
                      Added to library
                    </p>
                    <p className="text-xs text-slate-300">
                      {youtubeProgress.track.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {youtubeProgress.track.artist}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {youtubeProgress.status === 'error' && youtubeProgress.error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-sm font-medium text-red-400 mb-1">
                      Download failed
                    </p>
                    <p className="text-xs text-slate-300">
                      {youtubeProgress.error}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Close button for completed/error */}
            {youtubeProgress && (youtubeProgress.status === 'complete' || youtubeProgress.status === 'error') && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setIsYouTubeProgressOpen(false)
                    setYoutubeProgress(null)
                    setYoutubeUrl('')
                    if (eventSourceRef.current) {
                      eventSourceRef.current.close()
                    }
                  }}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Metadata Enhancement Dialog */}
      <BatchMetadataDialog
        open={isBatchMetadataDialogOpen}
        onOpenChange={setIsBatchMetadataDialogOpen}
        apiBase={apiBase}
        onRefreshLibrary={onRefreshLibrary}
      />
    </>
  )
})