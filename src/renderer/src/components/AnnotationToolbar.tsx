import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from 'animal-island-ui'

export type AnnotationTool = 'highlight' | 'underline' | 'note' | 'delete' | null

interface ToolbarContentProps {
  selectedTool: AnnotationTool
  selectedColor: string
  onToolChange: (tool: AnnotationTool) => void
  onColorChange: (color: string) => void
  colorOnLeft?: boolean
}

interface AnnotationToolbarProps extends ToolbarContentProps {
  onDockChange?: (docked: boolean) => void
}

const COLORS = [
  { name: '黄色', value: '#f5c31c' },
  { name: '绿色', value: '#6fba2c' },
  { name: '蓝色', value: '#19c8b9' },
  { name: '粉色', value: '#f8a6b2' },
  { name: '橙色', value: '#e59266' },
]

const DragHandle = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: '3px',
    opacity: 0.35, pointerEvents: 'none', flexShrink: 0,
  }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ display: 'flex', gap: '3px' }}>
        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#725d42' }} />
        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#725d42' }} />
      </div>
    ))}
  </div>
)

const ColorPicker = ({ selectedColor, onColorChange }: { selectedColor: string; onColorChange: (c: string) => void }) => (
  <>
    {COLORS.map(c => (
      <button
        key={c.value}
        onClick={() => onColorChange(c.value)}
        title={c.name}
        style={{
          width: '16px', height: '16px', borderRadius: '50%',
          background: c.value, padding: 0, cursor: 'pointer', flexShrink: 0,
          border: selectedColor === c.value ? '2px solid #725d42' : '2px solid transparent',
          outline: 'none',
        }}
      />
    ))}
    <div style={{ width: '1px', height: '16px', background: '#e8e2d6', margin: '0 2px', flexShrink: 0 }} />
  </>
)

export function AnnotationToolbarContent({
  selectedTool, selectedColor, onToolChange, onColorChange, colorOnLeft = false,
}: ToolbarContentProps) {
  const showColors = selectedTool && selectedTool !== 'delete'
  const toolButtons = (
    <>
      {(['highlight', 'underline', 'note'] as const).map(tool => (
        <Button
          key={tool}
          type={selectedTool === tool ? 'default' : 'primary'}
          size="small"
          onClick={() => onToolChange(selectedTool === tool ? null : tool)}
        >
          {tool === 'highlight' ? '高亮' : tool === 'underline' ? '下划线' : '批注'}
        </Button>
      ))}
      <Button
        type={selectedTool === 'delete' ? 'default' : 'primary'}
        size="small"
        onClick={() => onToolChange(selectedTool === 'delete' ? null : 'delete')}
      >
        删除
      </Button>
    </>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {showColors && colorOnLeft && <ColorPicker selectedColor={selectedColor} onColorChange={onColorChange} />}
      {toolButtons}
      {showColors && !colorOnLeft && <ColorPicker selectedColor={selectedColor} onColorChange={onColorChange} />}
    </div>
  )
}

export default function AnnotationToolbar({
  selectedTool, selectedColor, onToolChange, onColorChange, onDockChange,
}: AnnotationToolbarProps) {
  const [pos, setPos] = useState({ x: 16, y: 120 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const barRef = useRef<HTMLDivElement>(null)
  const DOCK_THRESHOLD = 60

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const x = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x))
      const y = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y))
      setPos({ x, y })
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!dragging.current) return
      dragging.current = false
      const y = e.clientY - dragOffset.current.y
      if (y < DOCK_THRESHOLD) onDockChange?.(true)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onDockChange])

  return (
    <div
      ref={barRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        background: 'var(--animal-bg-color)',
        border: '1.5px solid #e8e2d6',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <DragHandle />
      <AnnotationToolbarContent
        selectedTool={selectedTool}
        selectedColor={selectedColor}
        onToolChange={onToolChange}
        onColorChange={onColorChange}
        colorOnLeft={false}
      />
    </div>
  )
}
