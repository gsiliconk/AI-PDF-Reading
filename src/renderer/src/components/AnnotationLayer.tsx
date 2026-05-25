import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, Input, Button } from 'animal-island-ui'
import * as pdfjsLib from 'pdfjs-dist'
import { hashFilePath } from '../utils/hash'

export interface Annotation {
  id: string
  type: 'highlight' | 'underline' | 'note'
  color: string
  page: number
  x: number
  y: number
  width: number
  height: number
  text: string
  comment?: string
  timestamp: number
}

interface AnnotationLayerProps {
  page: number
  filePath?: string
  containerRef: React.RefObject<HTMLDivElement>
  pdfDocument?: pdfjsLib.PDFDocumentProxy
  selectedTool: 'highlight' | 'underline' | 'note' | 'delete' | null
  selectedColor: string
  onToolUsed?: () => void
  scale?: number
  perPageLimit?: number
}

export default function AnnotationLayer({
  page, filePath = '', containerRef, pdfDocument,
  selectedTool, selectedColor, onToolUsed, scale = 1.5, perPageLimit = 50,
}: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const loadedRef = useRef(false)

  // 从 electron-store 加载
  useEffect(() => {
    loadedRef.current = false
    if (!filePath) { setAnnotations([]); return }
    const load = async () => {
      const hash = await hashFilePath(filePath)
      const key = `annotations.${hash}.${page}`
      const saved = await window.electronAPI.storeGet(key)
      setAnnotations(Array.isArray(saved) ? saved : [])
      loadedRef.current = true
    }
    load()
  }, [page, filePath])

  const notifyChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent('annotations-changed', { detail: { filePath } }))
  }, [filePath])

  // 保存到 electron-store
  useEffect(() => {
    if (!loadedRef.current || !filePath) return
    const save = async () => {
      const hash = await hashFilePath(filePath)
      const key = `annotations.${hash}.${page}`
      await window.electronAPI.storeSet(key, annotations)
      notifyChange()
    }
    save()
  }, [annotations, page, filePath, notifyChange])

  // 监听外部删除事件（从笔记面板删除）
  useEffect(() => {
    const handler = (e: Event) => {
      const { filePath: fp, annotationId, annotationPage } = (e as CustomEvent).detail
      if (fp === filePath && annotationPage === page) {
        setAnnotations(prev => prev.filter(a => a.id !== annotationId))
      }
    }
    window.addEventListener('delete-annotation', handler)
    return () => window.removeEventListener('delete-annotation', handler)
  }, [filePath, page])

  const extractText = useCallback(async (x: number, y: number, width: number, height: number): Promise<string> => {
    if (!pdfDocument) return ''
    try {
      const pdfPage = await pdfDocument.getPage(page)
      const viewport = pdfPage.getViewport({ scale })
      const textContent = await pdfPage.getTextContent()
      const parts: string[] = []
      for (const item of textContent.items as any[]) {
        if (!item.str) continue
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
        const itemX = tx[4]
        const itemY = tx[5] - item.height * scale
        const itemW = item.width * scale
        const itemH = item.height * scale
        const ox = Math.max(0, Math.min(itemX + itemW, x + width) - Math.max(itemX, x))
        const oy = Math.max(0, Math.min(itemY + itemH, y + height) - Math.max(itemY, y))
        if (ox > 0 && oy > 0 && (ox * oy) / (itemW * itemH) > 0.3) {
          parts.push(item.str)
        }
      }
      return parts.join(' ').trim().slice(0, 200)
    } catch { return '' }
  }, [pdfDocument, page, scale])

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [containerRef])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedTool || selectedTool === 'delete') return
    const pos = getRelativePos(e)
    setIsDrawing(true)
    setStartPos(pos)
    setCurrentAnnotation({
      type: selectedTool,
      color: selectedColor,
      page,
      x: pos.x, y: pos.y,
      width: selectedTool === 'note' ? 200 : 0,
      height: selectedTool === 'note' ? 150 : 0,
      text: '',
    })
  }, [selectedTool, selectedColor, page, getRelativePos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentAnnotation || selectedTool === 'note' || selectedTool === 'delete') return
    const pos = getRelativePos(e)
    setCurrentAnnotation(prev => ({
      ...prev,
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
      x: Math.min(pos.x, startPos.x),
      y: Math.min(pos.y, startPos.y),
    }))
  }, [isDrawing, currentAnnotation, selectedTool, startPos, getRelativePos])

  const handleMouseUp = useCallback(async () => {
    if (!isDrawing || !currentAnnotation) return
    if (selectedTool === 'note') {
      setEditingNote('new')
      setNoteText('')
    } else if (currentAnnotation.width && currentAnnotation.width > 5) {
      if (annotations.length >= perPageLimit) {
        // 超过单页上限，提示并取消
        console.warn(`已达到单页批注上限 (${perPageLimit})`)
        alert(`已达到单页批注上限（${perPageLimit}），请在「设置 → 批注与笔记」中调整。`)
        setIsDrawing(false)
        setCurrentAnnotation(null)
        return
      }
      const { x = 0, y = 0, width: w = 0 } = currentAnnotation
      const h = currentAnnotation.height || 20
      const text = await extractText(x, y, w, h)
      setAnnotations(prev => [...prev, {
        id: Date.now().toString(),
        type: currentAnnotation.type as 'highlight' | 'underline',
        color: currentAnnotation.color || selectedColor,
        page, x, y, width: w, height: h, text,
        timestamp: Date.now(),
      }])
      onToolUsed?.()
    }
    setIsDrawing(false)
    setCurrentAnnotation(null)
  }, [isDrawing, currentAnnotation, selectedTool, selectedColor, page, extractText, onToolUsed, annotations.length, perPageLimit])

  const handleSaveNote = useCallback(() => {
    if (!currentAnnotation || !noteText.trim()) {
      setEditingNote(null); setCurrentAnnotation(null); return
    }
    if (annotations.length >= perPageLimit) {
      alert(`已达到单页批注上限（${perPageLimit}），请在「设置 → 批注与笔记」中调整。`)
      setEditingNote(null); setCurrentAnnotation(null); setNoteText('')
      return
    }
    setAnnotations(prev => [...prev, {
      id: Date.now().toString(),
      type: 'note',
      color: currentAnnotation.color || selectedColor,
      page,
      x: currentAnnotation.x || 0,
      y: currentAnnotation.y || 0,
      width: 200, height: 150,
      text: '',
      comment: noteText.trim(),
      timestamp: Date.now(),
    }])
    setEditingNote(null); setCurrentAnnotation(null); setNoteText('')
    onToolUsed?.()
  }, [currentAnnotation, noteText, selectedColor, page, onToolUsed, annotations.length, perPageLimit])

  const handleAnnotationClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (selectedTool === 'delete') {
      setAnnotations(prev => prev.filter(a => a.id !== id))
    }
  }, [selectedTool])

  const isInteractive = selectedTool !== null

  const renderAnnotation = (annotation: Annotation) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${annotation.x}px`,
      top: `${annotation.y}px`,
      width: `${annotation.width}px`,
      height: `${annotation.height}px`,
      cursor: selectedTool === 'delete' ? 'pointer' : 'default',
      pointerEvents: 'auto',
    }

    if (annotation.type === 'highlight') {
      return (
        <div key={annotation.id} style={{
          ...style,
          background: `${annotation.color}40`,
          border: selectedTool === 'delete' ? `2px dashed ${annotation.color}` : `2px solid ${annotation.color}`,
          borderRadius: '4px',
          outline: selectedTool === 'delete' ? '2px solid rgba(255,0,0,0.3)' : 'none',
        }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => handleAnnotationClick(e, annotation.id)}
          title={selectedTool === 'delete' ? '点击删除' : (annotation.text || '')}
        />
      )
    }

    if (annotation.type === 'underline') {
      return (
        <div key={annotation.id} style={{
          ...style,
          borderBottom: `3px solid ${annotation.color}`,
          outline: selectedTool === 'delete' ? '2px solid rgba(255,0,0,0.3)' : 'none',
        }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => handleAnnotationClick(e, annotation.id)}
          title={selectedTool === 'delete' ? '点击删除' : (annotation.text || '')}
        />
      )
    }

    if (annotation.type === 'note') {
      return (
        <div key={annotation.id} style={{
          ...style,
          background: '#f8f8f0',
          border: selectedTool === 'delete' ? `2px dashed red` : `2px solid ${annotation.color}`,
          borderRadius: '12px',
          padding: '8px',
          fontSize: '12px',
          color: '#725d42',
          overflow: 'auto',
        }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => handleAnnotationClick(e, annotation.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: annotation.color }}>批注</span>
            {selectedTool !== 'delete' && (
              <button onClick={(e) => { e.stopPropagation(); setAnnotations(prev => prev.filter(a => a.id !== annotation.id)) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9f927d', padding: 0 }}>
                ✕
              </button>
            )}
          </div>
          <div>{annotation.comment}</div>
        </div>
      )
    }
    return null
  }

  return (
    <>
      {/* 标注层 */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: isInteractive ? 'auto' : 'none',
          cursor: selectedTool === 'delete' ? 'default' : (selectedTool ? 'crosshair' : 'default'),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {annotations.map(renderAnnotation)}

        {isDrawing && currentAnnotation && selectedTool !== 'note' && selectedTool !== 'delete' && (
          <div style={{
            position: 'absolute',
            left: `${currentAnnotation.x}px`,
            top: `${currentAnnotation.y}px`,
            width: `${currentAnnotation.width}px`,
            height: `${currentAnnotation.height || 20}px`,
            background: `${currentAnnotation.color}40`,
            border: `2px dashed ${currentAnnotation.color}`,
            borderRadius: '4px',
          }} />
        )}
      </div>

      {/* 批注输入弹窗 */}
      {editingNote && (
        <div style={{
          position: 'absolute',
          left: `${currentAnnotation?.x || 0}px`,
          top: `${currentAnnotation?.y || 0}px`,
          zIndex: 40,
        }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Card style={{ padding: '12px', width: '220px' }}>
            <div style={{ fontSize: '12px', color: '#9f927d', marginBottom: '6px' }}>输入批注内容</div>
            <Input
              placeholder="批注内容..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) handleSaveNote()
                if (e.key === 'Escape') { setEditingNote(null); setCurrentAnnotation(null) }
              }}
              style={{ marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => { setEditingNote(null); setCurrentAnnotation(null) }}>取消</Button>
              <Button type="primary" size="small" onClick={handleSaveNote}>保存</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
