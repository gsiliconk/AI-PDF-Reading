import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync } from 'fs'
import { request as httpsRequest } from 'https'
import { is } from '@electron-toolkit/utils'
import Store from 'electron-store'

const store = new Store()

let mainWindow: BrowserWindow | null = null

// 显式指定并预创建 sessionData，避免 Chromium 在无权限目录下创建缓存时报错。
try {
  const sessionDataPath = join(app.getPath('userData'), 'sessionData')
  mkdirSync(sessionDataPath, { recursive: true })
  app.setPath('sessionData', sessionDataPath)
} catch (error) {
  console.warn('初始化 sessionData 目录失败，将使用 Electron 默认路径:', error)
}

function createWindow(): void {
  const savedBounds = store.get('window.bounds') as { x?: number; y?: number; width?: number; height?: number } | undefined
  const wasMaximized = store.get('window.isMaximized') as boolean | undefined

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || 1280,
    height: savedBounds?.height || 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
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
    if (wasMaximized) mainWindow?.maximize()
    mainWindow?.show()
  })

  // 窗口大小/位置记忆
  let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (!mainWindow.isMaximized()) {
        store.set('window.bounds', mainWindow.getBounds())
      }
      store.set('window.isMaximized', mainWindow.isMaximized())
    }, 500)
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)
  mainWindow.on('maximize', saveBounds)
  mainWindow.on('unmaximize', saveBounds)
  mainWindow.on('close', () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isMaximized()) store.set('window.bounds', mainWindow.getBounds())
      store.set('window.isMaximized', mainWindow.isMaximized())
    }
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

// electron-store 存储操作
ipcMain.handle('store:get', (_event, key: string) => store.get(key))
ipcMain.handle('store:set', (_event, key: string, value: any) => { store.set(key, value) })
ipcMain.handle('store:delete', (_event, key: string) => { store.delete(key) })

// 窗口大小记忆
ipcMain.handle('store:get-window-bounds', () => store.get('window.bounds'))
ipcMain.handle('store:set-window-bounds', (_event, bounds: { x: number; y: number; width: number; height: number }) => {
  store.set('window.bounds', bounds)
})
ipcMain.handle('store:get-window-maximized', () => store.get('window.isMaximized'))
ipcMain.handle('store:set-window-maximized', (_event, val: boolean) => { store.set('window.isMaximized', val) })

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

  // 启动 3 秒后检查 GitHub 最新 release
  setTimeout(() => { checkForUpdates() }, 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============== 自动更新（启动后异步检查 GitHub release） ==============
const GITHUB_OWNER = 'gsiliconk'
const GITHUB_REPO = 'AI-PDF-Reading'
const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`

/** 三段式版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0；非法格式返回 0 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(s => parseInt(s, 10))
  const pb = b.split('.').map(s => parseInt(s, 10))
  for (let i = 0; i < 3; i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0
    const y = Number.isFinite(pb[i]) ? pb[i] : 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

function checkForUpdates(): void {
  try {
    const req = httpsRequest({
      method: 'GET',
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': `${GITHUB_REPO}-app`,
        'Accept': 'application/vnd.github+json',
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode !== 200) {
        // 静默
        res.resume()
        return
      }
      let data = ''
      res.setEncoding('utf-8')
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const tag = typeof json.tag_name === 'string' ? json.tag_name : ''
          if (!tag) return
          const latest = tag.replace(/^v/i, '').trim()
          const current = app.getVersion()
          if (compareVersions(latest, current) > 0) {
            mainWindow?.webContents.send('update:available', {
              latest,
              current,
              releasesUrl: RELEASES_URL,
            })
          }
        } catch {
          // JSON 解析失败：静默
        }
      })
    })
    req.on('error', () => { /* 静默 */ })
    req.on('timeout', () => { req.destroy() })
    req.end()
  } catch {
    // 静默
  }
}
