import { useState } from 'react'
import type { HistoryItem } from '../../../main/types'

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function History({
  items,
  onClear
}: {
  items: HistoryItem[]
  onClear: () => void
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const visibleItems = query.trim()
    ? items.filter((item) => {
      const haystack = `${item.filename} ${item.remotePath} ${item.localPath || ''} ${item.error || ''}`.toLowerCase()
      return haystack.includes(query.trim().toLowerCase())
    })
    : items

  const handleCopy = async (item: HistoryItem) => {
    if (item.status === 'error' || !item.remotePath) return
    await navigator.clipboard.writeText(item.clipboardText || item.remotePath)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleCopyRaw = async (item: HistoryItem) => {
    if (item.status === 'error' || !item.remotePath) return
    await navigator.clipboard.writeText(item.remotePath)
    setCopiedId(`${item.id}:raw`)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleSendAgain = async (item: HistoryItem) => {
    if (!item.localPath) return
    await window.filefling.sendFile({
      filePath: item.localPath,
      isScreenshot: item.isScreenshot ?? false
    })
  }

  const handleDelete = async (item: HistoryItem) => {
    await window.filefling.deleteHistoryItem(item.id)
    onClear()
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <p className="theme-muted-soft text-[11px] tracking-wide">No sends yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <h2 className="theme-section-title text-[10px] font-semibold uppercase tracking-[0.2em]">
          Recent
        </h2>
        <button
          onClick={async () => {
            await window.filefling.clearHistory()
            onClear()
          }}
          className="theme-link text-[10px] transition-colors"
        >
          Clear
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search history"
        className="theme-input rounded-lg px-2.5 py-1.5 text-[10px] font-mono transition-all focus:outline-none mb-1"
      />

      {visibleItems.length === 0 ? (
        <p className="theme-muted-soft text-[10px] text-center py-3">No matching sends</p>
      ) : visibleItems.map((item) => (
        <div
          key={item.id}
          className={`
            group flex flex-col gap-1 px-2 py-1.5 rounded-lg transition-all
            ${item.status === 'error' ? 'theme-history-row-error' : 'theme-history-row'}
          `}
        >
          <button
            type="button"
            onClick={() => handleCopy(item)}
            disabled={item.status === 'error'}
            className="flex items-center gap-2 text-left disabled:cursor-default"
            title={item.status === 'success' ? 'Copy rendered clipboard output' : item.error}
          >
            {/* Status dot */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.status === 'success' ? 'var(--success)' : 'var(--error)' }}
            />

            {/* Filename + time */}
            <div className="flex-1 min-w-0 text-left">
              <p className="theme-text text-[11px] truncate font-mono">
                {item.filename}
              </p>
              <p className="theme-muted-soft text-[9px] truncate">
                {formatTime(item.timestamp)}
                {item.fileSize !== undefined ? ` · ${formatBytes(item.fileSize)}` : ''}
                {item.status === 'error' && item.error ? ` · ${item.error}` : ''}
              </p>
            </div>

            {/* Copy icon / copied state */}
            {item.status === 'success' && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedId === item.id ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="theme-muted">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </div>
            )}
          </button>

          <div className="flex items-center gap-2 pl-3.5">
            {item.status === 'success' && (
              <button
                type="button"
                onClick={() => handleCopyRaw(item)}
                className="theme-link text-[9px] transition-colors"
                title="Copy raw remote path"
              >
                {copiedId === `${item.id}:raw` ? 'Copied raw' : 'Copy raw'}
              </button>
            )}

            {item.localPath && (
              <>
                <button
                  type="button"
                  onClick={() => handleSendAgain(item)}
                  className="theme-link text-[9px] transition-colors"
                  title={item.status === 'error' ? 'Retry failed upload' : 'Send this local file again'}
                >
                  {item.status === 'error' ? 'Retry' : 'Send again'}
                </button>
                <button
                  type="button"
                  onClick={() => window.filefling.revealInFinder(item.localPath!)}
                  className="theme-link text-[9px] transition-colors"
                >
                  Reveal
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleDelete(item)}
              className="theme-link text-[9px] transition-colors ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
