import { contextBridge, ipcRenderer } from 'electron'
import type { FlingSettings, HistoryItem, SendProgress } from '../main/types'

const api = {
  sendFile: (opts: { filePath?: string; isScreenshot?: boolean }) =>
    ipcRenderer.invoke('fling:sendFile', opts),

  getSettings: (): Promise<FlingSettings> =>
    ipcRenderer.invoke('fling:getSettings'),

  updateSettings: (patch: Partial<FlingSettings>): Promise<FlingSettings> =>
    ipcRenderer.invoke('fling:updateSettings', patch),

  getHistory: (): Promise<HistoryItem[]> =>
    ipcRenderer.invoke('fling:getHistory'),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('fling:clearHistory'),

  onStatus: (callback: (progress: SendProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: SendProgress) => {
      callback(progress)
    }
    ipcRenderer.on('fling:status', handler)
    // Return an unsubscribe function
    return () => ipcRenderer.removeListener('fling:status', handler)
  }
}

export type FlingApi = typeof api

contextBridge.exposeInMainWorld('fling', api)
