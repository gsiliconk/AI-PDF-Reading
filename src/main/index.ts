import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        {
          label: '打开 PDF',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function handleOpenFile(): Promise<void> {
  if (!mainWindow) return

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    loadPDFFile(filePath)
  }
}

function loadPDFFile(filePath: string): void {
  try {
    const fileBuffer = readFileSync(filePath)
    const uint8Array = new Uint8Array(fileBuffer)
    mainWindow?.webContents.send('pdf:file-loaded', {
      filePath,
      data: Array.from(uint8Array)
    })
  } catch (error) {
    console.error('加载 PDF 文件失败:', error)
    dialog.showErrorBox('错误', '无法加载 PDF 文件')
  }
}

ipcMain.handle('dialog:open-file', async () => {
  await handleOpenFile()
})

ipcMain.handle('pdf:read-file', async (_event, filePath: string) => {
  try {
    const fileBuffer = readFileSync(filePath)
    return Array.from(new Uint8Array(fileBuffer))
  } catch (error) {
    console.error('读取 PDF 文件失败:', error)
    throw error
  }
})

// 窗口控制
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

// AI API 非流式（用于 Function Calling 阶段）
ipcMain.handle('ai:chat', async (_event, { apiUrl, apiKey, model, messages, tools }: {
  apiUrl: string
  apiKey: string
  model: string
  messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }[]
  tools?: any[]
}) => {
  const body: any = { model, messages, stream: false }
  if (tools?.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API 错误: ${response.status} - ${error}`)
  }
  const data = await response.json()
  return data.choices[0].message
})

// AI API 流式代理
ipcMain.on('ai:chat-stream', async (event, { apiUrl, apiKey, model, messages, requestId }: {
  apiUrl: string
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  requestId: string
}) => {
  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })

    if (!response.ok) {
      const error = await response.text()
      event.reply('ai:chat-stream-error', { requestId, error: `API 错误: ${response.status} - ${error}` })
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      event.reply('ai:chat-stream-error', { requestId, error: '无法读取响应流' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            event.reply('ai:chat-stream-chunk', { requestId, chunk: delta })
          }
        } catch {
          // 跳过解析失败的行
        }
      }
    }

    event.reply('ai:chat-stream-done', { requestId })
  } catch (error: any) {
    event.reply('ai:chat-stream-error', { requestId, error: `AI API 调用失败: ${error.message}` })
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
