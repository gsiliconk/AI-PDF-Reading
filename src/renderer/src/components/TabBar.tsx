import { useState } from 'react'
import { Icon } from 'animal-island-ui'
import type { Tab } from '../App'

interface TabBarProps {
  tabs: Tab[]
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab: () => void
}

export default function TabBar({ tabs, onTabClick, onTabClose, onNewTab }: TabBarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      overflowX: 'auto',
      padding: '0 4px',
    }}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '12px 12px 0 0',
            background: tab.isActive ? '#f8f8f0' : hoveredTab === tab.id ? '#f0ece2' : 'transparent',
            border: tab.isActive ? '2px solid #e8e2d6' : '2px solid transparent',
            borderBottom: tab.isActive ? '2px solid #f8f8f0' : '2px solid transparent',
            cursor: 'pointer',
            minWidth: '120px',
            maxWidth: '180px',
            transition: 'all 0.2s',
          }}
          onClick={() => onTabClick(tab.id)}
          onMouseEnter={() => setHoveredTab(tab.id)}
          onMouseLeave={() => setHoveredTab(null)}
        >
          <Icon name="icon-chat" size={14} />
          <span style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: tab.isActive ? '600' : '400',
            color: tab.isActive ? '#725d42' : '#9f927d',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {tab.fileName}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
            style={{
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: '#f0e8d8',
              border: 'none',
              cursor: 'pointer',
              opacity: hoveredTab === tab.id || tab.isActive ? 1 : 0,
              transition: 'opacity 0.2s',
              padding: 0,
            }}
          >
            <Icon name="icon-variant" size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}
