import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Icon } from 'animal-island-ui'
import { useResizable } from '../hooks/useResizable'
import { hashFilePath } from '../utils/hash'

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

interface AnnotationPanelProps {
  isOpen: boolean
  onToggle: () => void
  filePath: string
  currentPage: number
  onPageChange: (page: number) => void
}

export default function AnnotationPanel({ isOpen, onToggle, filePath, currentPage, onPageChange }: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [filter, setFilter] = useState<'all' | 'highlight' | 'underline' | 'note'>('all')
  const { width: panelWidth, setContainerRef, resizeHandle } = useResizable({
    initialWidth: 300,
    minWidth: 240,
    maxWidth: 500,
    direction: 'left',
  })

  // 加载所有页面的标注
  const loadAllAnnotations = useCallback(async () => {
    if (!filePath) return
    const hash = await hashFilePath(filePath)
    const data = await window.electronAPI.storeGet(`annotations.${hash}`)
    if (!data || typeof data !== 'object') { setAnnotations([]); return }
    const all: Annotation[] = []
    for (const pageData of Object.values(data)) {
      if (Array.isArray(pageData)) all.push(...(pageData as Annotation[]))
    }
    all.sort((a, b) => b.timestamp - a.timestamp)
    setAnnotations(all)
  }, [filePath])

  useEffect(() => {
    if (isOpen) loadAllAnnotations()
  }, [isOpen, filePath, loadAllAnnotations])

  // 监听标注变更
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.filePath === filePath && isOpen) {
        loadAllAnnotations()
      }
    }
    window.addEventListener('annotations-changed', handler)
    return () => window.removeEventListener('annotations-changed', handler)
  }, [filePath, isOpen, loadAllAnnotations])

  const handleDelete = useCallback(async (annotation: Annotation) => {
    const hash = await hashFilePath(filePath)
    const key = `annotations.${hash}.${annotation.page}`
    const items: Annotation[] = await window.electronAPI.storeGet(key) || []
    const filtered = items.filter(a => a.id !== annotation.id)
    await window.electronAPI.storeSet(key, filtered)
    loadAllAnnotations()
    window.dispatchEvent(new CustomEvent('annotations-changed', { detail: { filePath } }))
  }, [filePath, loadAllAnnotations])

  const filteredAnnotations = filter === 'all'
    ? annotations
    : annotations.filter(a => a.type === filter)

  const typeLabels = {
    all: '全部',
    highlight: '高亮',
    underline: '下划线',
    note: '批注',
  }

  const typeIcons: Record<string, string> = {
    highlight: '🟡',
    underline: '📏',
    note: '📝',
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  if (!isOpen) {
    return (
      <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
        <Button type="default" size="small" onClick={onToggle}
          style={{ borderRadius: '12px 0 0 12px', padding: '8px 4px' }}>
          <Icon name="icon-diy" size={16} />
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={setContainerRef as any}
      style={{ width: `${panelWidth}px`, flexShrink: 0, position: 'relative', display: 'flex' }}
    >
      <Card style={{
        width: '100%', borderRadius: 0, margin: 0,
        display: 'flex', flexDirection: 'column',
        borderLeft: '2px solid #e8e2d6', flexShrink: 0, position: 'relative',
        cursor: 'default',
      }}>
        {resizeHandle}

        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '2px solid #e8e2d6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="icon-diy" size={20} />
            <span style={{ fontWeight: 'bold', color: '#725d42' }}>笔记记录</span>
            <span style={{ fontSize: '11px', color: '#9f927d', background: '#f0e8d8', padding: '2px 6px', borderRadius: '8px' }}>
              {annotations.length}
            </span>
          </div>
          <Button type="text" size="small" onClick={onToggle}>✕</Button>
        </div>

        {/* 筛选标签 */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid #e8e2d6' }}>
          {(Object.keys(typeLabels) as Array<keyof typeof typeLabels>).map(key => (
            <Button
              key={key}
              type={filter === key ? 'primary' : 'default'}
              size="small"
              onClick={() => setFilter(key)}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              {typeLabels[key]}
            </Button>
          ))}
        </div>

        {/* 标注列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {filteredAnnotations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#c4b89e', fontSize: '13px' }}>
              <Icon name="icon-diy" size={48} />
              <p style={{ marginTop: '12px' }}>
                {annotations.length === 0 ? '暂无笔记记录' : '没有该类型的笔记'}
              </p>
              <p style={{ fontSize: '11px' }}>使用工具栏的高亮、下划线或批注工具在 PDF 上做笔记</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredAnnotations.map(annotation => (
                <div
                  key={`${annotation.page}-${annotation.id}`}
                  onClick={() => onPageChange(annotation.page)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e8e2d6',
                    background: currentPage === annotation.page ? '#e6f9f6' : '#f8f8f0',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e6f9f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = currentPage === annotation.page ? '#e6f9f6' : '#f8f8f0'}
                >
                  {/* 标题行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px' }}>{typeIcons[annotation.type]}</span>
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: annotation.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '11px', color: '#19c8b9', background: '#e6f9f6',
                      padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold',
                    }}>
                      P{annotation.page}
                    </span>
                    <span style={{ fontSize: '10px', color: '#c4b89e', marginLeft: 'auto' }}>
                      {formatTime(annotation.timestamp)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(annotation) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#c4b89e', padding: 0, fontSize: '12px', lineHeight: 1,
                      }}
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 文本内容 */}
                  {annotation.text && (
                    <div style={{
                      fontSize: '12px', color: '#725d42', lineHeight: '1.5',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {annotation.text}
                    </div>
                  )}

                  {/* 批注评论 */}
                  {annotation.comment && (
                    <div style={{
                      fontSize: '12px', color: '#9f927d', lineHeight: '1.4',
                      marginTop: '2px', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      💬 {annotation.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
