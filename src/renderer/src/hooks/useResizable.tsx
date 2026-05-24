import { useState, useCallback, useRef, useEffect } from 'react'

interface UseResizableOptions {
  initialWidth: number
  minWidth: number
  maxWidth: number
  direction: 'left' | 'right'
}

export function useResizable({ initialWidth, minWidth, maxWidth, direction }: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth)
  // 指向被调整大小的容器元素
  const containerRef = useRef<HTMLElement | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(initialWidth)
  const currentWidthRef = useRef(initialWidth)
  const isDragging = useRef(false)

  // 让外部组件通过 ref 把容器元素告诉我们
  const setContainerRef = useCallback((el: HTMLElement | null) => {
    containerRef.current = el
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return

      const delta = direction === 'right'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX

      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta))
      currentWidthRef.current = newWidth
      // 直接写 DOM，完全不走 React 渲染
      containerRef.current.style.width = `${newWidth}px`
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (handleRef.current) handleRef.current.style.background = 'transparent'
      // mouseup 时才同步一次 state，触发一次 re-render
      setWidth(currentWidthRef.current)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [direction, minWidth, maxWidth])

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startXRef.current = e.clientX
    startWidthRef.current = currentWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    if (handleRef.current) handleRef.current.style.background = '#19c8b9'
  }, [])

  const resizeHandle = (
    <div
      ref={handleRef}
      onMouseDown={onHandleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [direction === 'right' ? 'right' : 'left']: '-3px',
        width: '6px',
        cursor: 'col-resize',
        zIndex: 20,
        background: 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#19c8b940' }}
      onMouseLeave={(e) => { if (!isDragging.current) e.currentTarget.style.background = 'transparent' }}
    />
  )

  return { width, setContainerRef, resizeHandle }
}
