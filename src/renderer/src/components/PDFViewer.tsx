import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import AnnotationLayer from './AnnotationLayer'

interface SearchMatch {
  page: number
  rects: { x: number; y: number; width: number; height: number }[]
}

interface PDFViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy
  currentPage: number
  onPageChange: (page: number) => void
  scale?: number
  searchQuery?: string
  searchMatchIndex?: number
  onSearchResults?: (total: number) => void
  filePath?: string
}

export default function PDFViewer({
  pdfDocument,
  currentPage,
  onPageChange,
  scale = 1.5,
  searchQuery = '',
  searchMatchIndex = 0,
  onSearchResults,
  filePath = '',
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderingPages = useRef<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isScrollingRef = useRef(false)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const programmaticTargetRef = useRef<number | null>(null)
  const programmaticTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocument || renderingPages.current.has(pageNum)) return

    const canvas = canvasRefs.current.get(pageNum)
    if (!canvas) return

    renderingPages.current.add(pageNum)

    try {
      const page = await pdfDocument.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const dpr = window.devicePixelRatio || 1
      const scaledViewport = page.getViewport({ scale: scale * dpr })

      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      }).promise
    } catch (error) {
      console.error(`渲染页面 ${pageNum} 失败:`, error)
    } finally {
      renderingPages.current.delete(pageNum)
    }
  }, [pdfDocument, scale])

  useEffect(() => {
    if (!pdfDocument || !containerRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0')
            if (pageNum > 0) renderPage(pageNum)
          }
        })
      },
      {
        root: containerRef.current,
        rootMargin: '500px',
        threshold: 0.01
      }
    )

    canvasRefs.current.forEach((canvas) => {
      if (observerRef.current) observerRef.current.observe(canvas)
    })

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [pdfDocument, renderPage])

  // 滚动时更新页码
  useEffect(() => {
    const container = containerRef.current
    if (!container || !pdfDocument) return

    const handleScroll = () => {
      isScrollingRef.current = true

      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        // 程序化跳转期间，scroll 检测不覆盖目标页
        if (programmaticTargetRef.current !== null) return

        const scrollTop = container.scrollTop
        const containerHeight = container.clientHeight
        const scrollCenter = scrollTop + containerHeight / 3

        const pages = container.querySelectorAll('[data-page]')
        for (const page of pages) {
          const rect = page.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          const pageTop = rect.top - containerRect.top + scrollTop
          const pageBottom = pageTop + rect.height

          if (scrollCenter >= pageTop && scrollCenter < pageBottom) {
            const pageNum = parseInt(page.getAttribute('data-page') || '0')
            if (pageNum > 0 && pageNum !== currentPage) {
              onPageChange(pageNum)
            }
            break
          }
        }

        setTimeout(() => {
          isScrollingRef.current = false
        }, 200)
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [pdfDocument, currentPage, onPageChange])

  // 大纲/缩略图点击时自动滚动（精确定位，不用 scrollIntoView 动画）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pageElement = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement
    if (!pageElement) return

    // 记录目标页，阻止 scroll 检测覆盖
    programmaticTargetRef.current = currentPage
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)

    // 直接设置 scrollTop，精确且无动画抖动
    const containerRect = container.getBoundingClientRect()
    const pageRect = pageElement.getBoundingClientRect()
    const offset = pageRect.top - containerRect.top + container.scrollTop - 24
    container.scrollTop = offset

    // 滚动完成后解锁（instant 跳转无需等待）
    programmaticTimerRef.current = setTimeout(() => {
      programmaticTargetRef.current = null
    }, 100)
  }, [currentPage])

  // 搜索：提取所有页面文本并找到匹配位置
  useEffect(() => {
    if (!searchQuery.trim() || !pdfDocument) {
      setSearchMatches([])
      onSearchResults?.(0)
      return
    }

    const query = searchQuery.toLowerCase()

    const searchAllPages = async () => {
      const matches: SearchMatch[] = []

      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum)
          const viewport = page.getViewport({ scale })
          const textContent = await page.getTextContent()

          const pageMatches: { x: number; y: number; width: number; height: number }[] = []

          for (const item of textContent.items as any[]) {
            if (!item.str) continue
            const text = item.str.toLowerCase()
            let idx = text.indexOf(query)
            while (idx !== -1) {
              // 将 PDF 坐标转换为视口坐标
              const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
              const charWidth = item.width / (item.str.length || 1)
              const x = tx[4] + idx * charWidth * (viewport.scale / scale)
              const y = tx[5] - item.height * viewport.scale
              const w = query.length * charWidth * (viewport.scale / scale)
              const h = item.height * viewport.scale

              pageMatches.push({ x, y, width: w, height: h })
              idx = text.indexOf(query, idx + 1)
            }
          }

          if (pageMatches.length > 0) {
            matches.push({ page: pageNum, rects: pageMatches })
          }
        } catch {
          // 跳过无法解析的页面
        }
      }

      setSearchMatches(matches)
      const total = matches.reduce((sum, m) => sum + m.rects.length, 0)
      onSearchResults?.(total)
    }

    searchAllPages()
  }, [searchQuery, pdfDocument, scale, onSearchResults])

  // 跳转到当前搜索匹配项所在页面
  useEffect(() => {
    if (searchMatches.length === 0 || searchMatchIndex <= 0) return

    let count = 0
    for (const match of searchMatches) {
      count += match.rects.length
      if (count >= searchMatchIndex) {
        isScrollingRef.current = false
        onPageChange(match.page)
        break
      }
    }
  }, [searchMatchIndex, searchMatches, onPageChange])

  // 计算当前页面的高亮框（基于 searchMatchIndex）
  const getPageHighlights = (pageNum: number) => {
    if (!searchQuery.trim()) return []
    const match = searchMatches.find(m => m.page === pageNum)
    return match?.rects ?? []
  }

  // 计算全局匹配索引中哪些属于当前页
  const getActiveHighlightIndex = (pageNum: number): number => {
    if (searchMatchIndex <= 0) return -1
    let count = 0
    for (const match of searchMatches) {
      if (match.page === pageNum) {
        const localIdx = searchMatchIndex - count - 1
        if (localIdx >= 0 && localIdx < match.rects.length) return localIdx
        return -1
      }
      count += match.rects.length
    }
    return -1
  }

  if (!pdfDocument) return null

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: 'var(--animal-bg-color-secondary)',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        gap: '20px',
        minHeight: '100%',
      }}>
        {Array.from({ length: pdfDocument.numPages }, (_, i) => i + 1).map(pageNum => (
          <div
            key={pageNum}
            data-page={pageNum}
            ref={(el) => { if (el) pageRefs.current.set(pageNum, el) }}
            style={{
              position: 'relative',
              background: 'var(--animal-bg-color)',
              borderRadius: 'var(--animal-border-radius-base)',
              boxShadow: currentPage === pageNum ? 'var(--animal-shadow-lg)' : 'var(--animal-shadow-base)',
              border: `var(--animal-border-width) solid ${
                currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-border-color-light)'
              }`,
              padding: '4px',
              transition: 'border-color 0.2s',
            }}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el)
                  if (observerRef.current) observerRef.current.observe(el)
                }
              }}
              data-page={pageNum}
              style={{ display: 'block', borderRadius: '12px' }}
            />
            {/* 搜索高亮层 */}
            {getPageHighlights(pageNum).map((rect, i) => {
              const activeIdx = getActiveHighlightIndex(pageNum)
              const isActive = i === activeIdx
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${rect.x + 4}px`,
                    top: `${rect.y + 4}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    background: isActive ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 0, 0.35)',
                    border: isActive ? '1px solid orange' : 'none',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
              )
            })}
            {/* 标注层 */}
            <AnnotationLayer
              page={pageNum}
              filePath={filePath}
              containerRef={{ current: pageRefs.current.get(pageNum) ?? null }}
            />
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '2px 10px',
                fontSize: '12px',
                background: currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-bg-color)',
                color: currentPage === pageNum ? '#fff' : 'var(--animal-text-color-secondary)',
                borderRadius: '10px',
                border: `1px solid ${currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-border-color-light)'}`,
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              {pageNum}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
