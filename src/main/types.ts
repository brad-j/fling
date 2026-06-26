export const APP_THEMES = ['terminal', 'graphite', 'light'] as const

export type AppTheme = typeof APP_THEMES[number]

export interface FlingSettings {
  host: string
  port: number
  username: string
  remotePath: string
  keyPath: string
  screenshotDir: string
  autoCleanupDays: number
  theme: AppTheme
}

export interface HistoryItem {
  id: string
  filename: string
  remotePath: string
  timestamp: number
  status: 'success' | 'error'
  error?: string
}

export type SendStatus = 'idle' | 'sending' | 'success' | 'error'

export interface SendProgress {
  status: SendStatus
  filename?: string
  error?: string
  remotePath?: string
}
