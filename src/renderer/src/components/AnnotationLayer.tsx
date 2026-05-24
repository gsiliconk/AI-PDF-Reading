import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, Card, Icon, Input } from 'animal-island-ui'

interface Annotation {
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
}

export default function AnnotationLayer({ page, filePath = '', containerRef }: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedTool, setSelectedTool] = useState<'highlight' | 'underline' | 'note' | null>(null)
  const [selectedColor, setSelectedColor] = useState('#f5c31c')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)

  const colors = [
    { name: '黄色', value: '#f5c31c' },
    { name: '绿色', value: '#6fba2c' },
    { name: '蓝色', value: '#19c8b9' },
    { name: '粉色', value: '#f8a6b2' },
    { name: '橙色', value: '#e59266' },
  ]

  // 从本地存储加载标注
  useEffect(() => {
    const key = `annotations-${filePath}-${page}`
    const saved = localStorage.getItem(key)
    if (saved) {
      setAnnotations(JSON.parse(saved))
    } else {
      setAnnotations([])
    }
  }, [page, filePath])

  // 保存标注到本地存储
  useEffect(() => {
    const key = `annotations-${filePath}-${page}`
    localStorage.setItem(key, JSON.stringify(annotations))
  }, [annotations, page, filePath])

  // 获取鼠标相对于容器的位置
  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [containerRef])

  // 开始绘制
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedTool) return

    const pos = getRelativePos(e)
    setIsDrawing(true)
    setStartPos(pos)

    if (selectedTool === 'note') {
      setCurrentAnnotation({
        type: 'note',
        color: selectedColor,
        page,
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 150,
        text: '',
      })
    } else {
      setCurrentAnnotation({
        type: selectedTool,
        color: selectedColor,
        page,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        text: '',
      })
    }
  }, [selectedTool, selectedColor, page, getRelativePos])

  // 绘制中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentAnnotation || selectedTool === 'note') return

    const pos = getRelativePos(e)
    setCurrentAnnotation(prev => ({
      ...prev,
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
      x: Math.min(pos.x, startPos.x),
      y: Math.min(pos.y, startPos.y),
    }))
  }, [isDrawing, currentAnnotation, selectedTool, startPos, getRelativePos])

  // 结束绘制
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentAnnotation) return

    if (selectedTool === 'note') {
      setEditingNote('new')
      setNoteText('')
    } else if (currentAnnotation.width && currentAnnotation.width > 5) {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: currentAnnotation.type as 'highlight' | 'underline',
        color: currentAnnotation.color || selectedColor,
        page,
        x: currentAnnotation.x || 0,
        y: currentAnnotation.y || 0,
        width: currentAnnotation.width || 0,
        height: currentAnnotation.height || 20,
        text: '',
        timestamp: Date.now(),
      }
      setAnnotations(prev => [...prev, newAnnotation])
    }

    setIsDrawing(false)
    setCurrentAnnotation(null)
  }, [isDrawing, currentAnnotation, selectedTool, selectedColor, page])

  // 保存笔记
  const handleSaveNote = useCallback(() => {
    if (!currentAnnotation || !noteText.trim()) {
      setEditingNote(null)
      setCurrentAnnotation(null)
      return
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: 'note',
      color: currentAnnotation.color || selectedColor,
      page,
      x: currentAnnotation.x || 0,
      y: currentAnnotation.y || 0,
      width: 200,
      height: 150,
      text: '',
      comment: noteText.trim(),
      timestamp: Date.now(),
    }

    setAnnotations(prev => [...prev, newAnnotation])
    setEditingNote(null)
    setCurrentAnnotation(null)
    setNoteText('')
  }, [currentAnnotation, noteText, selectedColor, page])

  // 删除标注
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  // 渲染标注
  const renderAnnotation = (annotation: Annotation) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${annotation.x}px`,
      top: `${annotation.y}px`,
      width: `${annotation.width}px`,
      height: `${annotation.height}px`,
      cursor: 'pointer',
    }

    if (annotation.type === 'highlight') {
      return (
        <div
          key={annotation.id}
          style={{
            ...style,
            background: `${annotation.color}40`,
            border: `2px solid ${annotation.color}`,
            borderRadius: '4px',
          }}
          onClick={() => handleDeleteAnnotation(annotation.id)}
          title="点击删除"
        />
      )
    }

    if (annotation.type === 'underline') {
      return (
        <div
          key={annotation.id}
          style={{
            ...style,
            borderBottom: `3px solid ${annotation.color}`,
          }}
          onClick={() => handleDeleteAnnotation(annotation.id)}
          title="点击删除"
        />
      )
    }

    if (annotation.type === 'note') {
      return (
        <div
          key={annotation.id}
          style={{
            ...style,
            background: '#f8f8f0',
            border: `2px solid ${annotation.color}`,
            borderRadius: '12px',
            padding: '8px',
            fontSize: '12px',
            color: '#725d42',
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: annotation.color }}>批注</span>
            <button
              onClick={() => handleDeleteAnnotation(annotation.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9f927d',
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          <div>{annotation.comment}</div>
        </div>
      )
    }

    return null
  }

  return (
    <>
      {/* 工具栏 */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        zIndex: 30,
        display: 'flex',
        gap: '4px',
      }}>
        <Button
          type={selectedTool === 'highlight' ? 'primary' : 'default'}
          size="small"
          onClick={() => setSelectedTool(selectedTool === 'highlight' ? null : 'highlight')}
        >
          高亮
        </Button>
        <Button
          type={selectedTool === 'underline' ? 'primary' : 'default'}
          size="small"
          onClick={() => setSelectedTool(selectedTool === 'underline' ? null : 'underline')}
        >
          下划线
        </Button>
        <Button
          type={selectedTool === 'note' ? 'primary' : 'default'}
          size="small"
          onClick={() => setSelectedTool(selectedTool === 'note' ? null : 'note')}
        >
          批注
        </Button>
        {selectedTool && (
          <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
            {colors.map(color => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: color.value,
                  border: selectedColor === color.value ? '2px solid #725d42' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* 标注层 */}
      <div
        ref={layerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: selectedTool ? 'auto' : 'none',
          cursor: selectedTool ? 'crosshair' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* 已有标注 */}
        {annotations.map(renderAnnotation)}

        {/* 当前正在绘制的标注 */}
        {isDrawing && currentAnnotation && selectedTool !== 'note' && (
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

      {/* 笔记输入弹窗 */}
      {editingNote && (
        <div style={{
          position: 'absolute',
          left: `${currentAnnotation?.x || 0}px`,
          top: `${currentAnnotation?.y || 0}px`,
          zIndex: 40,
        }}>
          <Card style={{ padding: '12px', width: '200px' }}>
            <Input
              placeholder="输入批注内容..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote()
                if (e.key === 'Escape') {
                  setEditingNote(null)
                  setCurrentAnnotation(null)
                }
              }}
              style={{ marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => { setEditingNote(null); setCurrentAnnotation(null) }}>
                取消
              </Button>
              <Button type="primary" size="small" onClick={handleSaveNote}>
                保存
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
