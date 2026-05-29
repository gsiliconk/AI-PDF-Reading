import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import AnnotationLayer from './AnnotationLayer'
import type { AnnotationTool } from './AnnotationToolbar'

interface SearchMatch {
  page: number
  rects: { x: number; y: number; width: number; height: number }[]
}

interface PDFViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy
  currentPage: number
  onPageChange: (page: number) => void
  scale?: number
  onScaleChange?: (scale: number) => void
  searchQuery?: string
  searchMatchIndex?: number
  onSearchResults?: (total: number) => void
  filePath?: string
  selectedTool?: AnnotationTool
  selectedColor?: string
  showPageBadge?: boolean
  scrollDirection?: 'vertical' | 'horizontal'
  doublePage?: boolean
  annotationPerPageLimit?: number
}

export default function PDFViewer({
  pdfDocument,
  currentPage,
  onPageChange,
  scale = 1.5,
  onScaleChange,
  searchQuery = '',
  searchMatchIndex = 0,
  onSearchResults,
  filePath = '',
  selectedTool = null,
  selectedColor = '#f5c31c',
  showPageBadge = true,
  scrollDirection = 'vertical',
  doublePage = false,
  annotationPerPageLimit = 50,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const linkLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderingPages = useRef<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const programmaticTargetRef = useRef<number | null>(null)
  const programmaticTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentPageRef = useRef(currentPage)
  // 用 ref 记录上次跳转的 currentPage，避免 currentPage 之外的 state 变化触发重复跳转
  const lastJumpedPageRef = useRef<number>(0)
  // 标记页码变化是否由滚动检测触发（区分自然滚动 vs 大纲/缩略图点击）
  const scrollDetectedRef = useRef(false)

  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([])
  const [pageSizes, setPageSizes] = useState<Map<number, { width: number; height: number }>>(new Map())

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const renderTextLayer = useCallback(async (
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport,
    host: HTMLDivElement,
  ) => {
    const textContent = await page.getTextContent()
    host.replaceChildren()

    const fragment = document.createDocumentFragment()
    for (const item of textContent.items as any[]) {
      if (!item?.str) continue
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
      const angle = Math.atan2(tx[1], tx[0])
      const fontHeight = Math.max(1, Math.hypot(tx[2], tx[3]))
      const width = Math.max(1, item.width * viewport.scale)

      const span = document.createElement('span')
      span.textContent = item.str
      span.style.position = 'absolute'
      span.style.left = `${tx[4]}px`
      span.style.top = `${tx[5] - fontHeight}px`
      span.style.width = `${width}px`
      span.style.height = `${fontHeight}px`
      span.style.fontSize = `${fontHeight}px`
      span.style.lineHeight = '1'
      span.style.fontFamily = 'sans-serif'
      span.style.whiteSpace = 'pre'
      span.style.color = 'transparent'
      span.style.userSelect = selectedTool ? 'none' : 'text'
      span.style.cursor = selectedTool ? 'default' : 'text'
      span.style.transformOrigin = 'left top'
      span.style.transform = `rotate(${angle}rad)`
      fragment.appendChild(span)
    }
    host.appendChild(fragment)
  }, [selectedTool])

  const jumpToAnnotationDest = useCallback(async (dest: any) => {
    if (!pdfDocument) return
    try {
      let pageIndex = -1
      if (typeof dest === 'string') {
        const destination = await pdfDocument.getDestination(dest)
        if (destination) {
          const [pageRef] = destination
          pageIndex = typeof pageRef === 'number' ? pageRef : await pdfDocument.getPageIndex(pageRef)
        }
      } else if (Array.isArray(dest)) {
        const [pageRef] = dest
        pageIndex = typeof pageRef === 'number' ? pageRef : await pdfDocument.getPageIndex(pageRef)
      }
      if (pageIndex >= 0) onPageChange(pageIndex + 1)
    } catch (error) {
      console.error('链接跳转失败:', error)
    }
  }, [pdfDocument, onPageChange])

  const renderLinkLayer = useCallback(async (
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport,
    host: HTMLDivElement,
  ) => {
    const annotations = await page.getAnnotations({ intent: 'display' })
    host.replaceChildren()

    const fragment = document.createDocumentFragment()
    for (const annotation of annotations as any[]) {
      if (annotation.subtype !== 'Link' || !Array.isArray(annotation.rect)) continue
      const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect)
      const left = Math.min(x1, x2)
      const top = Math.min(y1, y2)
      const width = Math.abs(x2 - x1)
      const height = Math.abs(y2 - y1)
      if (width < 1 || height < 1) continue

      const link = document.createElement('a')
      link.style.position = 'absolute'
      link.style.left = `${left}px`
      link.style.top = `${top}px`
      link.style.width = `${width}px`
      link.style.height = `${height}px`
      link.style.cursor = selectedTool ? 'default' : 'pointer'
      link.style.background = 'transparent'
      link.style.pointerEvents = selectedTool ? 'none' : 'auto'
      link.title = annotation.url || annotation.unsafeUrl || 'PDF 链接'

      const externalUrl = annotation.url || annotation.unsafeUrl
      if (externalUrl) {
        link.href = externalUrl
        link.target = '_blank'
        link.rel = 'noreferrer noopener'
      } else if (annotation.dest) {
        link.href = '#'
        link.addEventListener('click', (event) => {
          event.preventDefault()
          void jumpToAnnotationDest(annotation.dest)
        })
      } else {
        continue
      }

      fragment.appendChild(link)
    }
    host.appendChild(fragment)
  }, [jumpToAnnotationDest, selectedTool])

  // 懒加载页面尺寸：当前页 ±5 页
  useEffect(() => {
    if (!pdfDocument) return
    const PRELOAD_RANGE = 5
    const loadSizes = async () => {
      const start = Math.max(1, currentPage - PRELOAD_RANGE)
      const end = Math.min(pdfDocument.numPages, currentPage + PRELOAD_RANGE)
      const newSizes = new Map(pageSizes)
      for (let i = start; i <= end; i++) {
        if (newSizes.has(i)) continue
        try {
          const page = await pdfDocument.getPage(i)
          const vp = page.getViewport({ scale })
          newSizes.set(i, { width: vp.width, height: vp.height })
        } catch { /* skip */ }
      }
      setPageSizes(newSizes)
    }
    loadSizes()
  }, [pdfDocument, scale, currentPage])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocument || renderingPages.current.has(pageNum)) return
    const canvas = canvasRefs.current.get(pageNum)
    const textLayerHost = textLayerRefs.current.get(pageNum)
    const linkLayerHost = linkLayerRefs.current.get(pageNum)
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
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise

      if (textLayerHost) {
        await renderTextLayer(page, viewport, textLayerHost)
      }

      if (linkLayerHost) {
        await renderLinkLayer(page, viewport, linkLayerHost)
      }

      // 渲染完成后更新真实尺寸
      setPageSizes(prev => {
        if (prev.has(pageNum)) return prev
        const next = new Map(prev)
        next.set(pageNum, { width: viewport.width, height: viewport.height })
        return next
      })
    } catch (error) {
      console.error(`渲染页面 ${pageNum} 失败:`, error)
    } finally {
      renderingPages.current.delete(pageNum)
    }
  }, [pdfDocument, renderLinkLayer, renderTextLayer, scale])

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
      { root: containerRef.current, rootMargin: '500px', threshold: 0.01 }
    )
    canvasRefs.current.forEach((canvas) => {
      if (observerRef.current) observerRef.current.observe(canvas)
    })
    return () => { if (observerRef.current) observerRef.current.disconnect() }
  }, [pdfDocument, renderPage])

  // Ctrl+滚轮缩放
  useEffect(() => {
    const container = containerRef.current
    if (!container || !onScaleChange) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const next = Math.round(Math.min(4, Math.max(0.5, scale + delta)) * 10) / 10
      onScaleChange(next)
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [scale, onScaleChange])

  // 滚动时更新页码
  useEffect(() => {
    const container = containerRef.current
    if (!container || !pdfDocument) return
    const isHorizontal = scrollDirection === 'horizontal'
    const handleScroll = () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        if (programmaticTargetRef.current !== null) return
        const scrollOffset = isHorizontal ? container.scrollLeft : container.scrollTop
        const scrollCenter = scrollOffset + (isHorizontal ? container.clientWidth : container.clientHeight) / 3
        const pages = container.querySelectorAll('[data-page]')
        for (const page of pages) {
          const rect = page.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          const pageStart = isHorizontal
            ? rect.left - containerRect.left + container.scrollLeft
            : rect.top - containerRect.top + container.scrollTop
          const pageEnd = pageStart + (isHorizontal ? rect.width : rect.height)
          if (scrollCenter >= pageStart && scrollCenter < pageEnd) {
            const pageNum = parseInt(page.getAttribute('data-page') || '0')
            if (pageNum > 0 && pageNum !== currentPage) {
              scrollDetectedRef.current = true
              onPageChange(pageNum)
            }
            break
          }
        }
      }, 150)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [pdfDocument, currentPage, onPageChange, scrollDirection])

  // 大纲/缩略图点击时自动滚动 —— 只在 currentPage 真正改变时执行
  // 自然滚动触发的页码变化不跳转（scrollDetectedRef = true 时跳过）
  useEffect(() => {
    if (lastJumpedPageRef.current === currentPage) return
    lastJumpedPageRef.current = currentPage

    if (scrollDetectedRef.current) {
      scrollDetectedRef.current = false
      return
    }

    const container = containerRef.current
    if (!container) return
    const pageElement = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement
    if (!pageElement) return

    programmaticTargetRef.current = currentPage
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)

    const containerRect = container.getBoundingClientRect()
    const pageRect = pageElement.getBoundingClientRect()
    if (scrollDirection === 'horizontal') {
      container.scrollLeft = pageRect.left - containerRect.left + container.scrollLeft - 24
    } else {
      container.scrollTop = pageRect.top - containerRect.top + container.scrollTop - 24
    }

    programmaticTimerRef.current = setTimeout(() => {
      programmaticTargetRef.current = null
    }, 100)
  }, [currentPage, scrollDirection])

  // 搜索
  useEffect(() => {
    if (!searchQuery.trim() || !pdfDocument) {
      setSearchMatches([]); onSearchResults?.(0); return
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
              const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
              const charWidth = item.width / (item.str.length || 1)
              pageMatches.push({
                x: tx[4] + idx * charWidth * viewport.scale,
                y: tx[5] - item.height * viewport.scale,
                width: query.length * charWidth * viewport.scale,
                height: item.height * viewport.scale,
              })
              idx = text.indexOf(query, idx + 1)
            }
          }
          if (pageMatches.length > 0) matches.push({ page: pageNum, rects: pageMatches })
        } catch { /* skip */ }
      }
      setSearchMatches(matches)
      onSearchResults?.(matches.reduce((s, m) => s + m.rects.length, 0))
    }
    searchAllPages()
  }, [searchQuery, pdfDocument, scale, onSearchResults])

  // 跳转搜索匹配项
  useEffect(() => {
    if (searchMatches.length === 0 || searchMatchIndex <= 0) return
    let count = 0
    for (const match of searchMatches) {
      count += match.rects.length
      if (count >= searchMatchIndex) {
        const localIdx = searchMatchIndex - (count - match.rects.length) - 1
        const rect = match.rects[localIdx]
        onPageChange(match.page)
        const container = containerRef.current
        if (!container || !rect) break
        programmaticTargetRef.current = match.page
        if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)
        requestAnimationFrame(() => {
          const pageElement = container.querySelector(`[data-page="${match.page}"]`) as HTMLElement
          if (!pageElement) return
          const containerRect = container.getBoundingClientRect()
          const pageRect = pageElement.getBoundingClientRect()
          if (scrollDirection === 'horizontal') {
            container.scrollLeft = pageRect.left - containerRect.left + container.scrollLeft + rect.x - container.clientWidth / 3
          } else {
            container.scrollTop = pageRect.top - containerRect.top + container.scrollTop + rect.y - container.clientHeight / 3
          }
          programmaticTimerRef.current = setTimeout(() => { programmaticTargetRef.current = null }, 100)
        })
        break
      }
    }
  }, [searchMatchIndex, searchMatches, onPageChange, scrollDirection])

  const getPageHighlights = (pageNum: number) => {
    if (!searchQuery.trim()) return []
    return searchMatches.find(m => m.page === pageNum)?.rects ?? []
  }

  const getActiveHighlightIndex = (pageNum: number): number => {
    if (searchMatchIndex <= 0) return -1
    let count = 0
    for (const match of searchMatches) {
      if (match.page === pageNum) {
        const localIdx = searchMatchIndex - count - 1
        return (localIdx >= 0 && localIdx < match.rects.length) ? localIdx : -1
      }
      count += match.rects.length
    }
    return -1
  }

  if (!pdfDocument) return null

  // 双页模式下把页面两两组对（首页单独一行）
  const buildPageGroups = (): number[][] => {
    const total = pdfDocument.numPages
    if (!doublePage) {
      return Array.from({ length: total }, (_, i) => [i + 1])
    }
    const groups: number[][] = [[1]]
    for (let i = 2; i <= total; i += 2) {
      const pair = i + 1 <= total ? [i, i + 1] : [i]
      groups.push(pair)
    }
    return groups
  }
  const pageGroups = buildPageGroups()
  const isHorizontal = scrollDirection === 'horizontal'

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', overflow: 'auto',
        background: 'var(--animal-bg-color-secondary)',
        cursor: selectedTool ? 'crosshair' : 'auto',
      }}
    >
        <div style={{
          display: 'inline-flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          alignItems: isHorizontal ? 'flex-start' : 'center',
          justifyContent: 'flex-start',
          padding: '24px', gap: '20px',
          minHeight: isHorizontal ? '100%' : undefined,
          width: 'fit-content',
          minWidth: '100%',
        }}>
          {pageGroups.map((group, gi) => (
            <div
              key={gi}
              style={{
                display: 'flex', flexDirection: 'row', gap: '12px',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}
            >
              {group.map(pageNum => (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={(el) => { if (el) pageRefs.current.set(pageNum, el) }}
              style={{
                position: 'relative',
                background: 'var(--animal-bg-color)',
                borderRadius: 'var(--animal-border-radius-base)',
                boxShadow: currentPage === pageNum ? 'var(--animal-shadow-lg)' : 'var(--animal-shadow-base)',
                border: `var(--animal-border-width) solid ${currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-border-color-light)'}`,
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
                style={{
                  display: 'block', borderRadius: '12px',
                  width: pageSizes.get(pageNum) ? `${pageSizes.get(pageNum)!.width}px` : '600px',
                  height: pageSizes.get(pageNum) ? `${pageSizes.get(pageNum)!.height}px` : '800px',
                }}
              />
              <div
                ref={(el) => {
                  if (el) textLayerRefs.current.set(pageNum, el)
                  else textLayerRefs.current.delete(pageNum)
                }}
                style={{
                  position: 'absolute',
                  inset: '4px',
                  overflow: 'hidden',
                  userSelect: selectedTool ? 'none' : 'text',
                  pointerEvents: selectedTool ? 'none' : 'auto',
                  zIndex: 1,
                }}
              />
              <div
                ref={(el) => {
                  if (el) linkLayerRefs.current.set(pageNum, el)
                  else linkLayerRefs.current.delete(pageNum)
                }}
                style={{
                  position: 'absolute',
                  inset: '4px',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
              {/* 搜索高亮层 */}
              {getPageHighlights(pageNum).map((rect, i) => {
                const isActive = i === getActiveHighlightIndex(pageNum)
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${rect.x + 4}px`, top: `${rect.y + 4}px`,
                    width: `${rect.width}px`, height: `${rect.height}px`,
                    background: isActive ? 'rgba(255,165,0,0.5)' : 'rgba(255,255,0,0.35)',
                    border: isActive ? '1px solid orange' : 'none',
                    borderRadius: '2px', pointerEvents: 'none',
                  }} />
                )
              })}
              {/* 标注层 */}
              <AnnotationLayer
                page={pageNum}
                filePath={filePath}
                containerRef={{ current: pageRefs.current.get(pageNum) ?? null }}
                pdfDocument={pdfDocument}
                selectedTool={selectedTool}
                selectedColor={selectedColor}
                scale={scale}
                perPageLimit={annotationPerPageLimit}
              />
              {/* 页码徽标 */}
              {showPageBadge && (
                <div style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  padding: '2px 10px', fontSize: '12px',
                  background: currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-bg-color)',
                  color: currentPage === pageNum ? '#fff' : 'var(--animal-text-color-secondary)',
                  borderRadius: '10px',
                  border: `1px solid ${currentPage === pageNum ? 'var(--animal-primary-color)' : 'var(--animal-border-color-light)'}`,
                  fontWeight: '600', whiteSpace: 'nowrap',
                }}>
                  {pageNum}
                </div>
              )}
            </div>
              ))}
            </div>
          ))}
        </div>
      </div>
  )
}
