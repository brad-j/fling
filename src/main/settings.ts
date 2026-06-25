import Store from 'electron-store'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { FlingSettings, HistoryItem } from './types'

const DEFAULT_KEY_PATHS = [
  join(homedir(), '.ssh', 'id_ed25519'),
  join(homedir(), '.ssh', 'id_rsa')
]

function detectKeyPath(): string {
  for (const p of DEFAULT_KEY_PATHS) {
    if (existsSync(p)) return p
  }
  return DEFAULT_KEY_PATHS[0]
}

const store = new Store<{
  settings: FlingSettings
  history: HistoryItem[]
  hostKeys: Record<string, string>
}>({
  name: 'fling',
  defaults: {
    settings: {
      host: 'zedd',
      port: 22,
      username: 'brad',
      remotePath: '~/shared',
      keyPath: detectKeyPath(),
      screenshotDir: join(homedir(), 'Desktop', 'screenshots'),
      autoCleanupDays: 7
    },
    history: [],
    hostKeys: {}
  }
})

export function getSettings(): FlingSettings {
  return store.get('settings')
}

export function updateSettings(patch: Partial<FlingSettings>): FlingSettings {
  const current = getSettings()
  const updated = { ...current, ...patch }
  store.set('settings', updated)
  return updated
}

export function getHistory(): HistoryItem[] {
  return store.get('history')
}

export function addHistoryItem(item: HistoryItem): void {
  const history = getHistory()
  history.unshift(item)
  store.set('history', history.slice(0, 10))
}

export function clearHistory(): void {
  store.set('history', [])
}

export function getHostKey(host: string): string | undefined {
  return store.get('hostKeys')[host]
}

export function setHostKey(host: string, key: string): void {
  const hostKeys = store.get('hostKeys')
  hostKeys[host] = key
  store.set('hostKeys', hostKeys)
}

export function readPrivateKey(keyPath: string): Buffer {
  const resolved = keyPath.startsWith('~/')
    ? join(homedir(), keyPath.slice(2))
    : keyPath
  return readFileSync(resolved)
}
