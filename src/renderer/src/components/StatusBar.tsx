import { Card, Icon } from 'animal-island-ui'

interface StatusBarProps {
  currentPage: number
  totalPages: number
  fileName: string
}

export default function StatusBar({ currentPage, totalPages, fileName }: StatusBarProps) {
  return (
    <Card style={{
      borderRadius: 0,
      margin: 0,
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: '2px solid #e8e2d6',
      flexShrink: 0,
    }}>
      {/* 左侧：页码 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          background: '#f0e8d8',
          borderRadius: '16px',
          padding: '4px 12px',
          fontSize: '13px',
          border: '2px solid #e8e2d6',
        }}>
          <span style={{ fontWeight: 'bold', color: '#19c8b9' }}>{currentPage}</span>
          <span style={{ color: '#c4b89e', margin: '0 4px' }}>/</span>
          <span style={{ color: '#9f927d' }}>{totalPages}</span>
        </div>
      </div>

      {/* 中间：快捷键 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '12px',
        color: '#c4b89e',
      }}>
        <span>滚动浏览</span>
        <span>Ctrl+O 打开</span>
        <span>Ctrl+F 搜索</span>
      </div>

      {/* 右侧：文件名 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Icon name="icon-diary" size={16} />
        <span style={{
          fontSize: '13px',
          color: '#9f927d',
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {fileName || '未打开文件'}
        </span>
      </div>
    </Card>
  )
}
