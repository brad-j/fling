import { useState, useRef, useCallback, useEffect } from 'react'
import type { LatestScreenshotInfo, SendProgress, SendStatus } from '../../../main/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatScreenshotTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function DropZone({
  status,
  progress
}: {
  status: SendStatus
  progress: SendProgress | null
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [latestScreenshot, setLatestScreenshot] = useState<LatestScreenshotInfo | null>(null)
  const dragCounter = useRef(0)

  const refreshLatestScreenshot = useCallback(async () => {
    setLatestScreenshot(await window.filefling.getLatestScreenshot())
  }, [])

  useEffect(() => {
    refreshLatestScreenshot()
  }, [refreshLatestScreenshot])

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(refreshLatestScreenshot, 500)
      return () => clearTimeout(timer)
    }
  }, [status, refreshLatestScreenshot])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const filePath = window.filefling.getPathForFile(files[0])
    if (!filePath) return

    // Send the first dropped file (isScreenshot=false to preserve filename)
    await window.filefling.sendFile({
      filePath,
      isScreenshot: false
    })
  }, [])

  const handleSendLatest = useCallback(async () => {
    await window.filefling.sendFile(
      latestScreenshot
        ? { filePath: latestScreenshot.filePath, isScreenshot: true }
        : { isScreenshot: true }
    )
  }, [latestScreenshot])

  // ─── Status display ───

  const statusText = (() => {
    if (status === 'sending') return `Sending ${progress?.filename || ''}...`
    if (status === 'success') return `Sent! Output copied to clipboard`
    if (status === 'error') return `Error: ${progress?.error || 'Unknown'}`
    return 'Drop a file to send it'
  })()

  const statusColor = {
    idle: 'theme-status-idle',
    sending: 'theme-status-sending',
    success: 'theme-status-success',
    error: 'theme-status-error'
  }[status]

  return (
    <div className="flex flex-col gap-2">
      {/* ─── Drop Zone ─── */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200
          ${isDragging ? 'theme-dropzone-dragging scale-[1.02]' : 'theme-dropzone'}
          p-6 flex flex-col items-center justify-center gap-3 cursor-default
        `}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDragging ? 'var(--accent)' : 'var(--muted)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isDragging ? 'animate-bounce' : ''}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="theme-muted text-xs tracking-wide">
          {isDragging ? 'Release to send' : 'Drag & drop a file'}
        </p>
      </div>

      {/* ─── Latest Screenshot Preview ─── */}
      <div className="theme-dropzone rounded-xl border p-2 flex gap-2 items-center">
        {latestScreenshot?.dataUrl ? (
          <img
            src={latestScreenshot.dataUrl}
            alt="Latest screenshot preview"
            className="w-20 h-12 rounded-md object-cover border"
            style={{ borderColor: 'var(--accent-border)' }}
          />
        ) : (
          <div className="w-20 h-12 rounded-md border flex items-center justify-center" style={{ borderColor: 'var(--accent-border)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="theme-muted-soft text-[9px] uppercase tracking-wide">Latest screenshot</p>
          {latestScreenshot ? (
            <>
              <p className="theme-text text-[10px] font-mono truncate">{latestScreenshot.filename}</p>
              <p className="theme-muted-soft text-[9px]">
                {formatScreenshotTime(latestScreenshot.mtime)} · {formatBytes(latestScreenshot.size)}
              </p>
            </>
          ) : (
            <p className="theme-muted text-[10px]">No screenshot found</p>
          )}
        </div>

        <button
          type="button"
          onClick={refreshLatestScreenshot}
          className="theme-link text-[9px] transition-colors"
          title="Refresh latest screenshot"
        >
          Refresh
        </button>
      </div>

      {/* ─── Send Latest Screenshot Button ─── */}
      <button
        onClick={handleSendLatest}
        disabled={status === 'sending'}
        className={`
          w-full py-2.5 rounded-lg text-xs font-medium transition-all duration-150
          ${status === 'sending' ? 'theme-primary-button-sending cursor-wait' : 'theme-primary-button'}
          flex items-center justify-center gap-2
        `}
      >
        {status === 'sending' ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Sending...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {latestScreenshot ? 'Send' : 'Send Latest Screenshot'}
          </>
        )}
      </button>

      {/* ─── Status Text ─── */}
      <p className={`text-[11px] text-center tracking-wide ${statusColor} animate-fade-in`}>
        {statusText}
      </p>
    </div>
  )
}
