import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from 'animal-island-ui'

export type AnnotationTool = 'highlight' | 'underline' | 'note' | 'delete' | null

interface ToolbarContentProps {
  selectedTool: AnnotationTool
  selectedColor: string
  onToolChange: (tool: AnnotationTool) => void
  onColorChange: (color: string) => void
  colorOnLeft?: boolean
  direction?: 'horizontal' | 'vertical'
}

interface AnnotationToolbarProps extends ToolbarContentProps {
  position: { x: number; y: number }
  orientation: 'horizontal' | 'vertical'
  onPositionChange: (position: { x: number; y: number }) => void
  onOrientationChange: (orientation: 'horizontal' | 'vertical') => void
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

const ColorPicker = ({
  selectedColor, onColorChange, direction = 'horizontal',
}: {
  selectedColor: string
  onColorChange: (c: string) => void
  direction?: 'horizontal' | 'vertical'
}) => (
  <>
    <div style={{
      display: 'flex',
      flexDirection: direction === 'vertical' ? 'column' : 'row',
      alignItems: 'center',
      gap: '4px',
    }}>
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
    </div>
    <div style={{
      width: direction === 'vertical' ? '16px' : '1px',
      height: direction === 'vertical' ? '1px' : '16px',
      background: '#e8e2d6',
      margin: direction === 'vertical' ? '2px 0' : '0 2px',
      flexShrink: 0,
    }} />
  </>
)

export function AnnotationToolbarContent({
  selectedTool, selectedColor, onToolChange, onColorChange, colorOnLeft = false, direction = 'horizontal',
}: ToolbarContentProps) {
  const showColors = selectedTool && selectedTool !== 'delete'
  const isVertical = direction === 'vertical'
  const getToolLabel = (tool: Exclude<AnnotationTool, null>) => {
    if (tool === 'highlight') return '高亮'
    if (tool === 'underline') return '下划线'
    return '批注'
  }
  const toolButtons = (
    <div style={{ display: 'flex', flexDirection: isVertical ? 'column' : 'row', gap: '4px' }}>
      {(['highlight', 'underline', 'note'] as const).map(tool => (
        <Button
          key={tool}
          type={selectedTool === tool ? 'default' : 'primary'}
          size="small"
          onClick={() => onToolChange(selectedTool === tool ? null : tool)}
          style={isVertical ? {
            minWidth: '40px',
            minHeight: tool === 'underline' ? '88px' : '64px',
            padding: '8px 6px',
          } : undefined}
        >
          {isVertical ? (
            <span style={{
              writingMode: 'vertical-rl',
              textOrientation: 'upright',
              letterSpacing: '2px',
              lineHeight: 1,
            }}>
              {getToolLabel(tool)}
            </span>
          ) : getToolLabel(tool)}
        </Button>
      ))}
      <Button
        type={selectedTool === 'delete' ? 'default' : 'primary'}
        size="small"
        onClick={() => onToolChange(selectedTool === 'delete' ? null : 'delete')}
        style={isVertical ? {
          minWidth: '40px',
          minHeight: '64px',
          padding: '8px 6px',
        } : undefined}
      >
        {isVertical ? (
          <span style={{
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            letterSpacing: '2px',
            lineHeight: 1,
          }}>
            删除
          </span>
        ) : '删除'}
      </Button>
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: isVertical ? 'column' : 'row',
      alignItems: 'center',
      gap: '4px',
    }}>
      {showColors && colorOnLeft && (
        <ColorPicker selectedColor={selectedColor} onColorChange={onColorChange} direction={direction} />
      )}
      {toolButtons}
      {showColors && !colorOnLeft && (
        <ColorPicker selectedColor={selectedColor} onColorChange={onColorChange} direction={direction} />
      )}
    </div>
  )
}

export default function AnnotationToolbar({
  selectedTool, selectedColor, onToolChange, onColorChange,
  position, orientation, onPositionChange, onOrientationChange, onDockChange,
}: AnnotationToolbarProps) {
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const barRef = useRef<HTMLDivElement>(null)
  const DOCK_THRESHOLD = 60
  const isVertical = orientation === 'vertical'
  const getMaxX = useCallback(() => {
    const width = barRef.current?.offsetWidth ?? (isVertical ? 92 : 320)
    return Math.max(0, window.innerWidth - width)
  }, [isVertical])
  const getMaxY = useCallback(() => {
    const height = barRef.current?.offsetHeight ?? (isVertical ? 260 : 48)
    return Math.max(0, window.innerHeight - height)
  }, [isVertical])
  const clampPosition = useCallback((next: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(getMaxX(), next.x)),
    y: Math.max(0, Math.min(getMaxY(), next.y)),
  }), [getMaxX, getMaxY])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.preventDefault()
  }, [position])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      onPositionChange(clampPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      }))
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
  }, [clampPosition, onDockChange, onPositionChange])

  useEffect(() => {
    const handleResize = () => {
      onPositionChange(clampPosition(position))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition, onPositionChange, position])

  return (
    <div
      ref={barRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 100,
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
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
      <button
        onClick={() => onOrientationChange(isVertical ? 'horizontal' : 'vertical')}
        title={isVertical ? '切换为横向排列' : '切换为纵向排列'}
        style={{
          border: 'none',
          background: '#f8f4ec',
          color: '#725d42',
          borderRadius: '8px',
          padding: '4px 8px',
          fontSize: '12px',
          lineHeight: 1.2,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isVertical ? '横向' : '纵向'}
      </button>
      <AnnotationToolbarContent
        selectedTool={selectedTool}
        selectedColor={selectedColor}
        onToolChange={onToolChange}
        onColorChange={onColorChange}
        colorOnLeft={!isVertical}
        direction={orientation}
      />
    </div>
  )
}
