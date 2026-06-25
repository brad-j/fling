/// <reference types="vite/client" />

interface Window {
  fling: {
    sendFile: (opts: { filePath?: string; isScreenshot?: boolean }) => Promise<void>
    getSettings: () => Promise<import('../../main/types').FlingSettings>
    updateSettings: (patch: Partial<import('../../main/types').FlingSettings>) => Promise<import('../../main/types').FlingSettings>
    getHistory: () => Promise<import('../../main/types').HistoryItem[]>
    clearHistory: () => Promise<void>
    getPathForFile: (file: File) => string
    onStatus: (callback: (progress: import('../../main/types').SendProgress) => void) => () => void
  }
}
