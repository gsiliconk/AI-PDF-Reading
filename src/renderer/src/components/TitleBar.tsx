import { useState, useEffect } from 'react'
import { Button, Icon } from 'animal-island-ui'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    // 监听窗口状态变化
    const handleResize = () => {
      checkMaximized()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px',
        background: '#f0e8d8',
        borderBottom: '2px solid #e8e2d6',
        WebkitAppRegion: 'drag' as any,
        padding: '0 8px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* 左侧：应用图标和名称 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Icon name="icon-helicopter" size={20} />
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#725d42',
        }}>
          PDF 智能阅读器
        </span>
      </div>

      {/* 右侧：窗口控制按钮 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        WebkitAppRegion: 'no-drag' as any,
      }}>
        {/* 最小化 */}
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#9f927d',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e8e2d6'
            e.currentTarget.style.color = '#725d42'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#9f927d'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* 最大化/还原 */}
        <button
          onClick={() => {
            window.electronAPI.maximizeWindow()
            setIsMaximized(!isMaximized)
          }}
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#9f927d',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e8e2d6'
            e.currentTarget.style.color = '#725d42'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#9f927d'
          }}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="3" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="#f0e8d8" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>

        {/* 关闭 */}
        <button
          onClick={() => window.electronAPI.closeWindow()}
          style={{
            width: '32px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#9f927d',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fc736d'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#9f927d'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
