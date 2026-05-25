import { useState, useCallback } from 'react'
import { Button, Card, Icon, Divider } from 'animal-island-ui'
import type { HistoryItem } from '../App'

interface DropZoneProps {
  onFileLoaded: (data: { filePath: string; data: number[] }) => void
  history: HistoryItem[]
  onClearHistory: () => void
}

export default function DropZone({ onFileLoaded, history, onClearHistory }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFile) {
      try {
        const filePath = (pdfFile as any).path
        if (filePath) {
          const data = await window.electronAPI.readPDFFile(filePath)
          onFileLoaded({ filePath, data })
        }
      } catch (error) {
        console.error('读取拖拽文件失败:', error)
      }
    }
  }, [onFileLoaded])

  const handleOpenFile = useCallback(async () => {
    await window.electronAPI.openFile()
  }, [])

  const handleOpenHistory = useCallback(async (filePath: string) => {
    try {
      const data = await window.electronAPI.readPDFFile(filePath)
      onFileLoaded({ filePath, data })
    } catch (error) {
      console.error('打开历史文件失败:', error)
    }
  }, [onFileLoaded])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: isDragging ? '#e6f9f6' : '#f8f8f0',
        transition: 'all 0.3s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 左侧：欢迎区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }}>
        <Card
          color={isDragging ? 'app-teal' : 'default'}
          style={{
            padding: '48px 64px',
            textAlign: 'center',
            maxWidth: '480px',
            width: '100%',
            transition: 'all 0.3s',
          }}
        >
          <div style={{
            width: '96px',
            height: '96px',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon name="icon-design" size={64} bounce />
          </div>

          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#725d42',
            marginBottom: '8px',
          }}>
            PDF 智能阅读器
          </h2>

          <p style={{
            fontSize: '14px',
            color: '#9f927d',
            marginBottom: '24px',
          }}>
            {isDragging ? '释放文件即可打开' : '拖拽 PDF 文件到此处，或点击下方按钮'}
          </p>

          <Divider type="line-brown" />

          <Button
            type="primary"
            size="large"
            block
            onClick={handleOpenFile}
            style={{ marginTop: '24px' }}
          >
            选择 PDF 文件
          </Button>

          <p style={{
            fontSize: '12px',
            color: '#c4b89e',
            marginTop: '16px',
          }}>
            快捷键 Ctrl + O 打开文件
          </p>
        </Card>
      </div>

      {/* 右侧：历史记录 */}
      {history.length > 0 && (
        <div style={{
          width: '320px',
          borderLeft: '2px solid #e8e2d6',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* 头部 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '2px solid #e8e2d6',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              color: '#725d42',
            }}>
              <Icon name="icon-diy" size={18} />
              最近打开
            </div>
            <Button type="text" size="small" onClick={onClearHistory}>
              清空
            </Button>
          </div>

          {/* 历史列表 */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}>
            {history.map((item, index) => (
              <div
                key={`${item.filePath}-${index}`}
                onClick={() => handleOpenHistory(item.filePath)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  marginBottom: '4px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0e8d8'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#e6f9f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="icon-chat" size={20} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#725d42',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.fileName}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#c4b89e',
                    marginTop: '2px',
                  }}>
                    {formatDate(item.lastOpened)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
