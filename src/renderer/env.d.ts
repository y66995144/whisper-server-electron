/// <reference types="vite/client" />

interface ElectronAPI {
  getConfig: () => Promise<any>
  saveConfig: (config: any) => Promise<boolean>
  startServer: (config: any) => Promise<{ success: boolean; error?: string }>
  stopServer: () => Promise<{ success: boolean }>
  getServerStatus: () => Promise<boolean>
  saveLogs: (content: string) => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>
  onServerLog: (callback: (log: string) => void) => void
  onServerStatus: (callback: (status: any) => void) => void
  onBeforeClose: (callback: () => void) => void
  confirmClose: () => void
  removeAllListeners: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
