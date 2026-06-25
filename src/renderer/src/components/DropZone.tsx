import { useState, useRef, useCallback } from 'react'
import type { SendProgress, SendStatus } from '../../main/types'

export default function DropZone({
  status,
  progress
}: {
  status: SendStatus
  progress: SendProgress | null
}) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

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

    // Send the first dropped file (isScreenshot=false to preserve filename)
    await window.fling.sendFile({
      filePath: files[0].path,
      isScreenshot: false
    })
  }, [])

  const handleSendLatest = useCallback(async () => {
    await window.fling.sendFile({ isScreenshot: true })
  }, [])

  // ─── Status display ───

  const statusText = (() => {
    if (status === 'sending') return `Sending ${progress?.filename || ''}...`
    if (status === 'success') return `Sent! Path copied to clipboard`
    if (status === 'error') return `Error: ${progress?.error || 'Unknown'}`
    return 'Drop a file to fling it'
  })()

  const statusColor = {
    idle: 'text-white/50',
    sending: 'text-accent',
    success: 'text-success',
    error: 'text-error'
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
          ${isDragging
            ? 'border-accent bg-accent/10 scale-[1.02]'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
          }
          p-6 flex flex-col items-center justify-center gap-3 cursor-default
        `}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDragging ? '#6366f1' : 'rgba(255,255,255,0.3)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isDragging ? 'animate-bounce' : ''}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-xs text-white/40">
          {isDragging ? 'Release to fling' : 'Drag & drop a file'}
        </p>
      </div>

      {/* ─── Send Latest Screenshot Button ─── */}
      <button
        onClick={handleSendLatest}
        disabled={status === 'sending'}
        className={`
          w-full py-2.5 rounded-lg text-xs font-medium transition-all duration-150
          ${status === 'sending'
            ? 'bg-accent/30 text-white/50 cursor-wait'
            : 'bg-accent hover:bg-accent-hover active:bg-accent-active text-white'
          }
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
            Send Latest Screenshot
          </>
        )}
      </button>

      {/* ─── Status Text ─── */}
      <p className={`text-[11px] text-center ${statusColor} animate-fade-in`}>
        {statusText}
      </p>
    </div>
  )
}
