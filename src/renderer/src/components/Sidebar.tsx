import { useState, useEffect, useRef } from 'react'
import { Button, Card, Icon } from 'animal-island-ui'
import { useResizable } from '../hooks/useResizable'
import * as pdfjsLib from 'pdfjs-dist'

interface OutlineItem {
  title: string
  dest: any
  items?: OutlineItem[]
  pageIndex?: number
  startPage?: number
  endPage?: number
}

interface SidebarProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null
  currentPage: number
  onPageChange: (page: number) => void
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ pdfDocument, currentPage, onPageChange, isOpen, onToggle }: SidebarProps) {
  const [activeTab, setActiveTab] = useState('thumbnails')
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [thumbnailCount, setThumbnailCount] = useState(0)
  const [loadedThumbnails, setLoadedThumbnails] = useState<Map<number, string>>(new Map())
  const thumbnailRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { width: sidebarWidth, setContainerRef, resizeHandle } = useResizable({
    initialWidth: 220,
    minWidth: 160,
    maxWidth: 400,
    direction: 'right',
  })

  const outlineRef = useRef<HTMLDivElement>(null)

  const resolveOutlinePage = async (dest: any): Promise<number> => {
    if (!pdfDocument) return 0
    try {
      let pageRef: any
      if (typeof dest === 'string') {
        const d = await pdfDocument.getDestination(dest)
        if (d) pageRef = d[0]
      } else if (Array.isArray(dest)) {
        pageRef = dest[0]
      }
      if (pageRef == null) return 0
      if (typeof pageRef === 'number') return pageRef + 1
      return (await pdfDocument.getPageIndex(pageRef)) + 1
    } catch { return 0 }
  }

  const resolveOutlinePages = async (items: OutlineItem[]): Promise<OutlineItem[]> => {
    const resolved: OutlineItem[] = []
    for (const item of items) {
      const pageIndex = await resolveOutlinePage(item.dest)
      const children = item.items ? await resolveOutlinePages(item.items) : []
      const childPages = children.filter(c => c.startPage && c.startPage > 0).map(c => c.startPage!)
      const allPages = [pageIndex, ...childPages].filter(p => p > 0)
      const startPage = allPages.length ? Math.min(...allPages) : pageIndex
      const endPage = allPages.length ? Math.max(...allPages) : pageIndex
      resolved.push({ ...item, pageIndex, startPage, endPage, items: children })
    }
    return resolved
  }

  useEffect(() => {
    if (!pdfDocument || !isOpen) return
    const loadOutline = async () => {
      try {
        const outlineData = await pdfDocument.getOutline()
        if (outlineData?.length) {
          const resolved = await resolveOutlinePages(outlineData)
          setOutline(resolved)
        } else {
          setOutline([])
        }
      } catch (error) {
        console.error('加载大纲失败:', error)
      }
    }
    loadOutline()
  }, [pdfDocument, isOpen])

  useEffect(() => {
    if (pdfDocument) {
      setThumbnailCount(pdfDocument.numPages)
      setLoadedThumbnails(new Map())
    }
  }, [pdfDocument])

  useEffect(() => {
    if (!pdfDocument || !isOpen || activeTab !== 'thumbnails') return

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageIndex = parseInt(entry.target.getAttribute('data-page') || '0')
            if (pageIndex > 0 && !loadedThumbnails.has(pageIndex)) {
              try {
                const page = await pdfDocument.getPage(pageIndex)
                const viewport = page.getViewport({ scale: 0.3 })
                const canvas = document.createElement('canvas')
                canvas.width = viewport.width
                canvas.height = viewport.height
                const ctx = canvas.getContext('2d')!
                await page.render({ canvasContext: ctx, viewport }).promise
                setLoadedThumbnails(prev => new Map(prev).set(pageIndex, canvas.toDataURL('image/jpeg', 0.8)))
              } catch (error) {
                console.error(`加载缩略图 ${pageIndex} 失败:`, error)
              }
            }
          }
        }
      },
      { rootMargin: '100px' }
    )

    thumbnailRefs.current.forEach((el) => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [pdfDocument, isOpen, activeTab, loadedThumbnails])

  const handleOutlineClick = async (dest: any) => {
    if (!pdfDocument) return
    try {
      let pageIndex = 0
      if (typeof dest === 'string') {
        const destination = await pdfDocument.getDestination(dest)
        if (destination) {
          const [pageRef] = destination
          pageIndex = await pdfDocument.getPageIndex(pageRef)
        }
      } else if (Array.isArray(dest)) {
        const [pageRef] = dest
        pageIndex = typeof pageRef === 'number' ? pageRef : await pdfDocument.getPageIndex(pageRef)
      }
      onPageChange(pageIndex + 1)
    } catch (error) {
      console.error('跳转失败:', error)
    }
  }

  useEffect(() => {
    if (!isOpen || activeTab !== 'thumbnails') return
    const el = thumbnailRefs.current.get(currentPage)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentPage, isOpen, activeTab])

  const isCurrentOutline = (item: OutlineItem): boolean => {
    if (item.startPage && item.endPage) {
      return currentPage >= item.startPage && currentPage <= item.endPage
    }
    if (item.pageIndex) return currentPage === item.pageIndex
    return false
  }

  const outlineItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (activeTab !== 'outline' || !isOpen) return
    const activeItem = outline.find(item => isCurrentOutline(item))
    if (activeItem) {
      const el = outlineItemRefs.current.get(activeItem.title)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentPage, activeTab, isOpen])

  const renderOutlineItem = (item: OutlineItem, depth: number = 0) => {
    const isActive = isCurrentOutline(item)
    return (
      <div
        key={item.title}
        ref={(el) => { if (el) outlineItemRefs.current.set(item.title, el) }}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          onClick={() => handleOutlineClick(item.dest)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            fontSize: '13px',
            color: isActive ? '#19c8b9' : '#725d42',
            fontWeight: isActive ? 'bold' : 'normal',
            background: isActive ? '#e6f9f6' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f0e8d8' }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
        >
          {isActive && (
            <span style={{ fontSize: '10px', flexShrink: 0 }}>▶</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
          {item.startPage && (
            <span style={{ fontSize: '11px', color: '#c4b89e', marginLeft: 'auto', flexShrink: 0 }}>
              P{item.startPage}
            </span>
          )}
        </button>
        {item.items?.map(child => renderOutlineItem(child, depth + 1))}
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
      }}>
        <Button
          type="default"
          size="small"
          onClick={onToggle}
          style={{
            borderRadius: '0 12px 12px 0',
            padding: '8px 4px',
          }}
        >
          <Icon name="icon-map" size={16} />
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={setContainerRef as any}
      style={{ width: `${sidebarWidth}px`, flexShrink: 0, position: 'relative', display: 'flex' }}
    >
    <Card style={{
      width: '100%',
      borderRadius: 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '2px solid #e8e2d6',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* 调整大小手柄 */}
      {resizeHandle}
      {/* 头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '2px solid #e8e2d6',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            type={activeTab === 'thumbnails' ? 'primary' : 'text'}
            size="small"
            onClick={() => setActiveTab('thumbnails')}
          >
            缩略图
          </Button>
          <Button
            type={activeTab === 'outline' ? 'primary' : 'text'}
            size="small"
            onClick={() => setActiveTab('outline')}
          >
            大纲
          </Button>
        </div>
        <Button type="text" size="small" onClick={onToggle}>
          ✕
        </Button>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {activeTab === 'thumbnails' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Array.from({ length: thumbnailCount }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                ref={(el) => { if (el) thumbnailRefs.current.set(pageNum, el) }}
                data-page={pageNum}
                onClick={() => onPageChange(pageNum)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: `2px solid ${currentPage === pageNum ? '#19c8b9' : '#e8e2d6'}`,
                  background: '#f0e8d8',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px',
                }}
              >
                {/* 缩略图 */}
                <div style={{
                  width: '48px',
                  height: '64px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#e8e2d6',
                }}>
                  {loadedThumbnails.has(pageNum) ? (
                    <img src={loadedThumbnails.get(pageNum)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#c4b89e' }}>...</span>
                    </div>
                  )}
                </div>
                {/* 页码 */}
                <div style={{
                  flex: 1,
                  fontSize: '12px',
                  fontWeight: currentPage === pageNum ? 'bold' : 'normal',
                  color: currentPage === pageNum ? '#19c8b9' : '#9f927d',
                }}>
                  第 {pageNum} 页
                </div>
                {/* 当前页指示器 */}
                {currentPage === pageNum && (
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#19c8b9',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {outline.length > 0 ? outline.map(item => renderOutlineItem(item)) : (
              <div style={{ textAlign: 'center', padding: '32px', fontSize: '13px', color: '#c4b89e' }}>
                无大纲信息
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
    </div>
  )
}
