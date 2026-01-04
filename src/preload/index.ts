import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  startServer: (config: any) => ipcRenderer.invoke('start-server', config),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  saveLogs: (content: string) => ipcRenderer.invoke('save-logs', content),
  
  onServerLog: (callback: (log: string) => void) => {
    ipcRenderer.on('server-log', (_, log) => callback(log))
  },
  onServerStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('server-status', (_, status) => callback(status))
  },
  onBeforeClose: (callback: () => void) => {
    ipcRenderer.on('before-close', () => callback())
  },
  confirmClose: () => ipcRenderer.send('confirm-close'),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('server-log')
    ipcRenderer.removeAllListeners('server-status')
    ipcRenderer.removeAllListeners('before-close')
  }
})
