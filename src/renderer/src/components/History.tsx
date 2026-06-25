import { useState } from 'react'
import type { HistoryItem } from '../../main/types'

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function History({
  items,
  onClear
}: {
  items: HistoryItem[]
  onClear: () => void
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (item: HistoryItem) => {
    if (item.status === 'error' || !item.remotePath) return
    // The remote path is already on the clipboard from the send,
    // but for history items we need to copy it ourselves via the clipboard API
    await navigator.clipboard.writeText(item.remotePath)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <p className="text-[11px] text-white/20">No sends yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Recent
        </h2>
        <button
          onClick={async () => {
            await window.fling.clearHistory()
            onClear()
          }}
          className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
        >
          Clear
        </button>
      </div>

      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => handleCopy(item)}
          disabled={item.status === 'error'}
          className={`
            group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all
            ${item.status === 'error'
              ? 'opacity-50 cursor-default'
              : 'hover:bg-white/5 cursor-pointer'
            }
          `}
        >
          {/* Status dot */}
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              item.status === 'success' ? 'bg-success' : 'bg-error'
            }`}
          />

          {/* Filename + time */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] text-white/70 truncate font-mono">
              {item.filename}
            </p>
            <p className="text-[9px] text-white/30">
              {formatTime(item.timestamp)}
              {item.status === 'error' && item.error ? ` · ${item.error}` : ''}
            </p>
          </div>

          {/* Copy icon / copied state */}
          {item.status === 'success' && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {copiedId === item.id ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
