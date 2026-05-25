import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  readPDFFile: (filePath: string) => ipcRenderer.invoke('pdf:read-file', filePath),
  onFileLoaded: (callback: (data: { filePath: string; data: number[] }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string; data: number[] }) => {
      callback(data)
    }
    ipcRenderer.on('pdf:file-loaded', handler)
    return () => {
      ipcRenderer.removeListener('pdf:file-loaded', handler)
    }
  },
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  // electron-store 存储
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key),
  // 窗口大小记忆
  getWindowBounds: () => ipcRenderer.invoke('store:get-window-bounds'),
  setWindowBounds: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('store:set-window-bounds', bounds),
  getWindowMaximized: () => ipcRenderer.invoke('store:get-window-maximized'),
  setWindowMaximized: (val: boolean) => ipcRenderer.invoke('store:set-window-maximized', val),
  // AI API 非流式（Function Calling 阶段用）
  aiChat: (params: {
    apiUrl: string; apiKey: string; model: string
    messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }[]
    tools?: any[]
  }) => ipcRenderer.invoke('ai:chat', params),
  // AI API 流式
  aiChatStream: (
    params: { apiUrl: string; apiKey: string; model: string; messages: { role: string; content: string }[]; requestId: string },
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
  ) => {
    ipcRenderer.send('ai:chat-stream', params)

    const chunkHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string; chunk: string }) => {
      if (data.requestId === params.requestId) onChunk(data.chunk)
    }
    const doneHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string }) => {
      if (data.requestId === params.requestId) {
        cleanup()
        onDone()
      }
    }
    const errorHandler = (_e: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => {
      if (data.requestId === params.requestId) {
        cleanup()
        onError(data.error)
      }
    }

    const cleanup = () => {
      ipcRenderer.removeListener('ai:chat-stream-chunk', chunkHandler)
      ipcRenderer.removeListener('ai:chat-stream-done', doneHandler)
      ipcRenderer.removeListener('ai:chat-stream-error', errorHandler)
    }

    ipcRenderer.on('ai:chat-stream-chunk', chunkHandler)
    ipcRenderer.on('ai:chat-stream-done', doneHandler)
    ipcRenderer.on('ai:chat-stream-error', errorHandler)

    return cleanup
  },
  // 自动更新：监听主进程通知
  onUpdateAvailable: (callback: (data: { latest: string; current: string; releasesUrl: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { latest: string; current: string; releasesUrl: string }) => {
      callback(data)
    }
    ipcRenderer.on('update:available', handler)
    return () => {
      ipcRenderer.removeListener('update:available', handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
