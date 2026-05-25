import { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Card, Divider, Icon } from 'animal-island-ui'
import TitleBar from './components/TitleBar'
import PDFViewer from './components/PDFViewer'
import StatusBar from './components/StatusBar'
import DropZone from './components/DropZone'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import AIPanel from './components/AIPanel'
import AnnotationPanel from './components/AnnotationPanel'
import AnnotationToolbar, { AnnotationToolbarContent } from './components/AnnotationToolbar'
import type { AnnotationTool } from './components/AnnotationToolbar'
import SettingsModal from './components/SettingsModal'
import UpdateModal from './components/UpdateModal'
import { useSettings } from './hooks/useSettings'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export interface Tab {
  id: string
  fileName: string
  filePath: string
  isActive: boolean
}

export interface HistoryItem {
  filePath: string
  fileName: string
  lastOpened: number
}

export default function App() {
  const { settings, loaded: settingsLoaded } = useSettings()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [pdfDocuments, setPdfDocuments] = useState<Map<string, pdfjsLib.PDFDocumentProxy>>(new Map())
  const [pdfDataMap, setPdfDataMap] = useState<Map<string, Uint8Array>>(new Map())
  const loadedDocsRef = useRef<Set<string>>(new Set())
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pdf-history') || '[]')
    } catch {
      return []
    }
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [notesPanelOpen, setNotesPanelOpen] = useState(false)
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>(null)
  const [annotationColor, setAnnotationColor] = useState('#f5c31c')
  const [toolbarDocked, setToolbarDocked] = useState(false)
  const [scale, setScale] = useState(1.5)
  const initialPanelsAppliedRef = useRef(false)
  const initialZoomAppliedRef = useRef(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageBaseSize, setPageBaseSize] = useState<{ w: number; h: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; current: string; releasesUrl: string } | null>(null)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

  const activePdfDocument = activeTabId ? pdfDocuments.get(activeTabId) || null : null
  const activePdfData = activeTabId ? pdfDataMap.get(activeTabId) || null : null
  const activeFileName = tabs.find(t => t.id === activeTabId)?.fileName || ''
  const activeFilePath = tabs.find(t => t.id === activeTabId)?.filePath || ''

  // 保存历史记录
  const saveHistory = useCallback((filePath: string, fileName: string) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.filePath !== filePath)
      const limit = Math.max(1, settings.historyLimit || 20)
      const newHistory = [
        { filePath, fileName, lastOpened: Date.now() },
        ...filtered,
      ].slice(0, limit)
      localStorage.setItem('pdf-history', JSON.stringify(newHistory))
      return newHistory
    })
  }, [settings.historyLimit])

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('pdf-history')
  }, [])

  // 设置首次加载完成时，应用默认面板状态与默认颜色（仅一次）
  useEffect(() => {
    if (!settingsLoaded || initialPanelsAppliedRef.current) return
    initialPanelsAppliedRef.current = true
    setSidebarOpen(settings.sidebarDefaultOpen)
    setAiPanelOpen(settings.aiPanelDefaultOpen)
    setNotesPanelOpen(settings.notesPanelDefaultOpen)
    setAnnotationColor(settings.highlightDefaultColor)
  }, [settingsLoaded, settings.sidebarDefaultOpen, settings.aiPanelDefaultOpen,
      settings.notesPanelDefaultOpen, settings.highlightDefaultColor])

  // 主题应用到 document
  useEffect(() => {
    const root = document.documentElement
    const apply = (theme: string) => {
      if (theme === 'system') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.dataset.theme = dark ? 'dark' : 'light'
      } else {
        root.dataset.theme = theme
      }
    }
    apply(settings.theme)
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [settings.theme])

  const handleFileLoaded = useCallback((data: { filePath: string; data: number[] }) => {
    const filePath = data.filePath
    const fileName = filePath.split(/[/\\]/).pop() || '未命名'
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const pdfData = new Uint8Array(data.data)

    // 保存到历史记录
    saveHistory(filePath, fileName)

    const existingTab = tabs.find(t => t.filePath === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    const newTab: Tab = { id: tabId, fileName, filePath, isActive: true }
    setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), newTab])
    setActiveTabId(tabId)
    setPdfDataMap(prev => new Map(prev).set(tabId, pdfData))
    setCurrentPage(1)
  }, [tabs])

  useEffect(() => {
    if (!activeTabId || !activePdfData) return
    if (loadedDocsRef.current.has(activeTabId)) {
      const doc = pdfDocuments.get(activeTabId)
      if (doc) setTotalPages(doc.numPages)
      return
    }

    const loadPDF = async () => {
      setIsLoading(true)
      try {
        loadedDocsRef.current.add(activeTabId!)
        const loadingTask = pdfjsLib.getDocument({ data: activePdfData })
        const pdf = await loadingTask.promise
        setPdfDocuments(prev => new Map(prev).set(activeTabId!, pdf))
        setTotalPages(pdf.numPages)
        // 计算第一页基准尺寸（scale=1）
        const firstPage = await pdf.getPage(1)
        const vp = firstPage.getViewport({ scale: 1 })
        // 重置初始缩放标记，让新 PDF 也能应用 settings.zoom
        initialZoomAppliedRef.current = false
        setPageBaseSize({ w: vp.width, h: vp.height })
      } catch (error) {
        console.error('加载 PDF 失败:', error)
        loadedDocsRef.current.delete(activeTabId!)
      } finally {
        setIsLoading(false)
      }
    }
    loadPDF()
  }, [activeTabId, activePdfData])

  const handleTabClick = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => ({ ...t, isActive: t.id === tabId })))
    setActiveTabId(tabId)
    const doc = pdfDocuments.get(tabId)
    if (doc) { setTotalPages(doc.numPages); setCurrentPage(1) }
  }, [pdfDocuments])

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId)
      const newTabs = prev.filter(t => t.id !== tabId)
      if (tabId === activeTabId && newTabs.length > 0) {
        const nextIdx = Math.min(idx, newTabs.length - 1)
        newTabs[nextIdx] = { ...newTabs[nextIdx], isActive: true }
        setActiveTabId(newTabs[nextIdx].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }
      return newTabs
    })
    setPdfDataMap(prev => { const m = new Map(prev); m.delete(tabId); return m })
    setPdfDocuments(prev => { const m = new Map(prev); m.delete(tabId); return m })
    loadedDocsRef.current.delete(tabId)
  }, [activeTabId])

  const handleNewTab = useCallback(async () => {
    await window.electronAPI.openFile()
  }, [])

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentMatch(0)
    setTotalMatches(0)
  }, [])

  const handleSearchResults = useCallback((total: number) => {
    setTotalMatches(total)
    setCurrentMatch(total > 0 ? 1 : 0)
  }, [])

  const handleSearchNavigate = useCallback((direction: 'prev' | 'next') => {
    setCurrentMatch(prev => {
      if (totalMatches === 0) return 0
      if (direction === 'next') return prev >= totalMatches ? 1 : prev + 1
      return prev <= 1 ? totalMatches : prev - 1
    })
  }, [totalMatches])

  // 保存缩放比例（兼容旧版用户，不再由这里主导）
  useEffect(() => {
    localStorage.setItem('pdf-zoom', String(scale))
  }, [scale])

  // PDF 加载且 pageBaseSize 就绪时，应用 settings.zoom 默认缩放（仅首次）
  useEffect(() => {
    if (!settingsLoaded) return
    if (!pageBaseSize) return
    if (initialZoomAppliedRef.current) return
    initialZoomAppliedRef.current = true
    const z = settings.zoom
    if (z === 'fit-width') {
      setScale(Math.round((window.innerWidth - 40) / pageBaseSize.w * 10) / 10)
    } else if (z === 'fit-page') {
      setScale(Math.round((window.innerHeight - 150) / pageBaseSize.h * 10) / 10)
    } else if (typeof z === 'number') {
      setScale(z)
    }
  }, [settingsLoaded, pageBaseSize, settings.zoom])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); handleNewTab() }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeTabId) handleTabClose(activeTabId) }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const idx = tabs.findIndex(t => t.id === activeTabId)
        if (idx >= 0) {
          const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length
          handleTabClick(tabs[next].id)
        }
      }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); setSearchOpen(p => !p) }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); setScale(1.0); return }
      if (isInput) return

      const navigate = (dir: number) => setCurrentPage(p => Math.max(1, Math.min(totalPages, p + dir)))
      if (e.key === 'PageUp' || (!searchOpen && e.key === 'ArrowLeft')) { e.preventDefault(); navigate(-1) }
      if (e.key === 'PageDown' || (!searchOpen && e.key === 'ArrowRight')) { e.preventDefault(); navigate(1) }
      if (e.key === 'Home') { e.preventDefault(); setCurrentPage(1) }
      if (e.key === 'End' && totalPages > 0) { e.preventDefault(); setCurrentPage(totalPages) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, tabs, totalPages, searchOpen, handleNewTab, handleTabClose, handleTabClick])

  // 监听文件加载事件（只注册一次）
  useEffect(() => {
    const cleanup = window.electronAPI.onFileLoaded(handleFileLoaded)
    return cleanup
  }, [handleFileLoaded])

  // 监听自动更新通知（只注册一次；当天点过「暂不」则不再弹）
  useEffect(() => {
    const api = window.electronAPI as any
    if (!api?.onUpdateAvailable) return
    const cleanup = api.onUpdateAvailable((data: { latest: string; current: string; releasesUrl: string }) => {
      const today = new Date().toISOString().slice(0, 10)
      const dismissed = localStorage.getItem(`update-dismiss-${today}`)
      if (dismissed === data.latest) return
      setUpdateInfo(data)
      setUpdateModalOpen(true)
    })
    return cleanup
  }, [])

  const handleDismissUpdateToday = useCallback(() => {
    if (updateInfo) {
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem(`update-dismiss-${today}`, updateInfo.latest)
    }
    setUpdateModalOpen(false)
  }, [updateInfo])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f8f8f0',
      overflow: 'hidden',
    }}>
      {/* 自定义标题栏 */}
      <TitleBar />

        {/* 顶部工具栏 */}
        <Card style={{
          borderRadius: 0,
          margin: 0,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '2px solid #e8e2d6',
          flexShrink: 0,
        }}>
          {/* 侧边栏切换 */}
          {activePdfDocument && (
            <Button
              type={sidebarOpen ? 'default' : 'primary'}
              size="small"
              onClick={() => setSidebarOpen(p => !p)}
              icon={<Icon name="icon-map" size={16} />}
            >
              大纲
            </Button>
          )}

          {/* 打开文件 */}
          <Button type="primary" size="small" onClick={handleNewTab}>
            打开 PDF
          </Button>

          {/* 标签栏 */}
          {tabs.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <TabBar
                tabs={tabs}
                onTabClick={handleTabClick}
                onTabClose={handleTabClose}
                onNewTab={handleNewTab}
              />
            </div>
          )}

          {/* 标注工具栏吸附区 —— 拖到顶部时显示，放在搜索左边 */}
          {activePdfDocument && toolbarDocked && (
            <>
              <div style={{ width: '1px', height: '20px', background: '#e8e2d6' }} />
              <AnnotationToolbarContent
                selectedTool={annotationTool}
                selectedColor={annotationColor}
                onToolChange={setAnnotationTool}
                onColorChange={setAnnotationColor}
                colorOnLeft={true}
              />
              <button
                onClick={() => setToolbarDocked(false)}
                title="取消吸附，恢复悬浮"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#c4b89e', fontSize: '12px', padding: '0 2px',
                }}
              >
                ⊠
              </button>
              <div style={{ width: '1px', height: '20px', background: '#e8e2d6' }} />
            </>
          )}

          {/* 搜索 */}
          {activePdfDocument && (
            <Button
              type={searchOpen ? 'default' : 'primary'}
              size="small"
              onClick={() => setSearchOpen(p => !p)}
              icon={<Icon name="icon-critterpedia" size={16} />}
            >
              搜索
            </Button>
          )}

          {/* AI 助手 */}
          <Button
            type={aiPanelOpen ? 'default' : 'primary'}
            size="small"
            onClick={() => setAiPanelOpen(p => !p)}
            icon={<Icon name="icon-chat" size={16} />}
          >
            AI
          </Button>

          {/* 笔记 */}
          {activePdfDocument && (
            <Button
              type={notesPanelOpen ? 'default' : 'primary'}
              size="small"
              onClick={() => setNotesPanelOpen(p => !p)}
              icon={<Icon name="icon-diy" size={16} />}
            >
              笔记
            </Button>
          )}

          {/* 页码显示 */}
          {activePdfDocument && (
            <div style={{
              background: '#f0e8d8',
              borderRadius: '16px',
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#19c8b9',
              border: '2px solid #e8e2d6',
            }}>
              {currentPage} / {totalPages}
            </div>
          )}

          {/* 缩放控制 */}
          {activePdfDocument && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Button type="default" size="small" onClick={() => {
                if (pageBaseSize) setScale(Math.round((window.innerWidth - 40) / pageBaseSize.w * 10) / 10)
              }}>页宽</Button>
              <Button type="default" size="small" onClick={() => {
                if (pageBaseSize) setScale(Math.round((window.innerHeight - 150) / pageBaseSize.h * 10) / 10)
              }}>页面</Button>
              <Button type="default" size="small" onClick={() => setScale(1.0)}>100%</Button>
              <span style={{ fontSize: '12px', color: '#9f927d', minWidth: '36px', textAlign: 'center' }}>
                {Math.round(scale * 100)}%
              </span>
            </div>
          )}

          {/* 设置（最右侧） */}
          <Button
            type={settingsOpen ? 'default' : 'primary'}
            size="small"
            onClick={() => setSettingsOpen(p => !p)}
            icon={<Icon name="icon-design" size={16} />}
            title="设置"
          >
            设置
          </Button>
        </Card>

        {/* 主内容区域 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* 侧边栏 */}
          <Sidebar
            pdfDocument={activePdfDocument}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(p => !p)}
          />

          {/* PDF 查看器 */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {isLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: '#f8f8f0',
              }}>
                <Card color="app-teal" style={{ padding: '32px 48px', textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>加载中...</div>
                  <div style={{ fontSize: '13px', color: '#725d42' }}>正在打开 PDF 文件</div>
                </Card>
              </div>
            ) : activePdfDocument ? (
              <PDFViewer
                pdfDocument={activePdfDocument}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                scale={scale}
                onScaleChange={setScale}
                searchQuery={searchQuery}
                searchMatchIndex={currentMatch}
                onSearchResults={handleSearchResults}
                filePath={activeFilePath}
                selectedTool={annotationTool}
                selectedColor={annotationColor}
                showPageBadge={settings.showPageBadge}
                scrollDirection={settings.scrollDirection}
                doublePage={settings.doublePage}
                annotationPerPageLimit={settings.annotationPerPageLimit}
              />
            ) : (
              <DropZone
                onFileLoaded={handleFileLoaded}
                history={history}
                onClearHistory={clearHistory}
              />
            )}

            {/* 搜索栏 */}
            <SearchBar
              isOpen={searchOpen}
              onClose={() => { setSearchOpen(false); setSearchQuery(''); setTotalMatches(0); setCurrentMatch(0) }}
              onSearch={handleSearch}
              onNavigate={handleSearchNavigate}
              currentMatch={currentMatch}
              totalMatches={totalMatches}
            />
          </div>

          {/* AI 对话面板 */}
          <AIPanel
            isOpen={aiPanelOpen}
            onToggle={() => setAiPanelOpen(p => !p)}
            pdfDocument={activePdfDocument}
            currentPage={currentPage}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {/* 笔记面板 */}
          <AnnotationPanel
            isOpen={notesPanelOpen}
            onToggle={() => setNotesPanelOpen(p => !p)}
            filePath={activeFilePath}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />

          {/* 悬浮标注工具条 —— 仅在有 PDF 且未吸附时显示 */}
          {activePdfDocument && !toolbarDocked && (
            <AnnotationToolbar
              selectedTool={annotationTool}
              selectedColor={annotationColor}
              onToolChange={setAnnotationTool}
              onColorChange={setAnnotationColor}
              onDockChange={setToolbarDocked}
            />
          )}
        </div>

        {/* 底部状态栏 */}
        <StatusBar
          currentPage={currentPage}
          totalPages={totalPages}
          fileName={activeFileName}
        />

      {/* 全局设置弹窗 */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* 自动更新弹窗 */}
      {updateInfo && (
        <UpdateModal
          open={updateModalOpen}
          latest={updateInfo.latest}
          current={updateInfo.current}
          releasesUrl={updateInfo.releasesUrl}
          onClose={() => setUpdateModalOpen(false)}
          onDismissToday={handleDismissUpdateToday}
        />
      )}
    </div>
  )
}
