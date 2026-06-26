import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ConnectionTestResult, FlingSettings, HistoryItem, HostKeyRecord, LatestScreenshotInfo, SendProgress, SshConfigHost } from '../main/types'

const api = {
  sendFile: (opts: { filePath?: string; isScreenshot?: boolean }) =>
    ipcRenderer.invoke('filefling:sendFile', opts),

  getSettings: (): Promise<FlingSettings> =>
    ipcRenderer.invoke('filefling:getSettings'),

  updateSettings: (patch: Partial<FlingSettings>): Promise<FlingSettings> =>
    ipcRenderer.invoke('filefling:updateSettings', patch),

  testConnection: (patch: Partial<FlingSettings>): Promise<ConnectionTestResult> =>
    ipcRenderer.invoke('filefling:testConnection', patch),

  getHostKeys: (): Promise<HostKeyRecord[]> =>
    ipcRenderer.invoke('filefling:getHostKeys'),

  forgetHostKey: (hostKeyId: string): Promise<void> =>
    ipcRenderer.invoke('filefling:forgetHostKey', hostKeyId),

  getSshConfigHosts: (): Promise<SshConfigHost[]> =>
    ipcRenderer.invoke('filefling:getSshConfigHosts'),

  getLatestScreenshot: (): Promise<LatestScreenshotInfo | null> =>
    ipcRenderer.invoke('filefling:getLatestScreenshot'),

  getHistory: (): Promise<HistoryItem[]> =>
    ipcRenderer.invoke('filefling:getHistory'),

  deleteHistoryItem: (id: string): Promise<void> =>
    ipcRenderer.invoke('filefling:deleteHistoryItem', id),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('filefling:clearHistory'),

  revealInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('filefling:revealInFinder', filePath),

  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  onStatus: (callback: (progress: SendProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: SendProgress) => {
      callback(progress)
    }
    ipcRenderer.on('filefling:status', handler)
    // Return an unsubscribe function
    return () => ipcRenderer.removeListener('filefling:status', handler)
  }
}

export type FileFlingApi = typeof api

contextBridge.exposeInMainWorld('filefling', api)
