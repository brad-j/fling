import { useState, useEffect, useCallback } from 'react'
import DropZone from './components/DropZone'
import History from './components/History'
import SettingsPanel from './components/SettingsPanel'
import { useFlingStatus } from './hooks/useFlingStatus'
import type { HistoryItem, SendProgress } from '../../main/types'

type View = 'main' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('main')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const { status, progress } = useFlingStatus()

  const refreshHistory = useCallback(async () => {
    const items = await window.fling.getHistory()
    setHistory(items)
  }, [])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  // Refresh history when a send completes
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(refreshHistory, 500)
      return () => clearTimeout(timer)
    }
  }, [status, refreshHistory])

  return (
    <div className="fling-window w-full h-full flex flex-col">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <FlingLogo state={status} />
          <h1 className="text-sm font-semibold text-white/90">Fling</h1>
        </div>
        {view === 'settings' ? (
          <button
            onClick={() => setView('main')}
            className="text-xs text-white/50 hover:text-white/90 transition-colors"
          >
            ← Back
          </button>
        ) : (
          <button
            onClick={() => setView('settings')}
            className="text-white/40 hover:text-white/80 transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto">
        {view === 'main' ? (
          <div className="flex flex-col gap-3 p-4 animate-fade-in">
            <DropZone status={status} progress={progress} />
            <History items={history} onClear={refreshHistory} />
          </div>
        ) : (
          <SettingsPanel />
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="px-4 py-2 border-t border-white/5">
        <p className="text-[10px] text-white/30 text-center">
          ⌘⇧F to fling latest screenshot
        </p>
      </footer>
    </div>
  )
}

// ─── Fling Logo (animated state) ─────────────────────────────────────

function FlingLogo({ state }: { state: string }) {
  const colors: Record<string, string> = {
    idle: '#8b8b8b',
    sending: '#6366f1',
    success: '#22c55e',
    error: '#ef4444'
  }
  const color = colors[state] || colors.idle
  const animClass = state === 'sending' ? 'animate-pulse-fast' : ''

  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className={animClass}>
      <path
        d="M16 4 L16 22 M8 12 L16 4 L24 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 26 L26 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
