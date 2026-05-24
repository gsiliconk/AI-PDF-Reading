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
  const [searchOpen, setSearchOpen] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const activePdfDocument = activeTabId ? pdfDocuments.get(activeTabId) || null : null
  const activePdfData = activeTabId ? pdfDataMap.get(activeTabId) || null : null
  const activeFileName = tabs.find(t => t.id === activeTabId)?.fileName || ''
  const activeFilePath = tabs.find(t => t.id === activeTabId)?.filePath || ''

  // 保存历史记录
  const saveHistory = useCallback((filePath: string, fileName: string) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.filePath !== filePath)
      const newHistory = [
        { filePath, fileName, lastOpened: Date.now() },
        ...filtered,
      ].slice(0, 20) // 最多保存20条
      localStorage.setItem('pdf-history', JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('pdf-history')
  }, [])

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
      const newTabs = prev.filter(t => t.id !== tabId)
      if (tabId === activeTabId && newTabs.length > 0) {
        const newActive = newTabs[newTabs.length - 1]
        newActive.isActive = true
        setActiveTabId(newActive.id)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, tabs, handleNewTab, handleTabClose, handleTabClick])

  // 监听文件加载事件（只注册一次）
  useEffect(() => {
    const cleanup = window.electronAPI.onFileLoaded(handleFileLoaded)
    return cleanup
  }, [handleFileLoaded])

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
              type={sidebarOpen ? 'primary' : 'default'}
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

          {/* 搜索 */}
          {activePdfDocument && (
            <Button
              type={searchOpen ? 'primary' : 'default'}
              size="small"
              onClick={() => setSearchOpen(p => !p)}
              icon={<Icon name="icon-critterpedia" size={16} />}
            >
              搜索
            </Button>
          )}

          {/* AI 助手 */}
          <Button
            type={aiPanelOpen ? 'primary' : 'default'}
            size="small"
            onClick={() => setAiPanelOpen(p => !p)}
            icon={<Icon name="icon-chat" size={16} />}
          >
            AI
          </Button>

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
                scale={1.5}
                searchQuery={searchQuery}
                searchMatchIndex={currentMatch}
                onSearchResults={handleSearchResults}
                filePath={activeFilePath}
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
          />
        </div>

        {/* 底部状态栏 */}
        <StatusBar
          currentPage={currentPage}
          totalPages={totalPages}
          fileName={activeFileName}
        />
    </div>
  )
}
