import { useState } from 'react'
import { Modal, Button, Input } from 'animal-island-ui'
import { useSettings, type AppSettings } from '../hooks/useSettings'
import {
  ReadingTab, AppearanceTab, AITab, AnnotationTab, ShortcutsTab, AboutTab,
} from './SettingsTabs'

export type SettingsTabKey = 'reading' | 'appearance' | 'ai' | 'annotation' | 'shortcuts' | 'about'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: SettingsTabKey
}

const TABS: { key: SettingsTabKey; label: string; icon: string }[] = [
  { key: 'reading', label: '阅读', icon: '📖' },
  { key: 'appearance', label: '外观', icon: '🎨' },
  { key: 'ai', label: 'AI', icon: '🤖' },
  { key: 'annotation', label: '批注与笔记', icon: '✏️' },
  { key: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { key: 'about', label: '关于', icon: 'ℹ️' },
]

export default function SettingsModal({ open, onClose, defaultTab = 'reading' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(defaultTab)
  const { settings, updateSettings, loaded } = useSettings()

  const renderContent = () => {
    if (!loaded) {
      return <div style={{ padding: '20px', color: '#9f927d' }}>加载中...</div>
    }
    switch (activeTab) {
      case 'reading': return <ReadingTab settings={settings} update={updateSettings} />
      case 'appearance': return <AppearanceTab settings={settings} update={updateSettings} />
      case 'ai': return <AITab settings={settings} update={updateSettings} />
      case 'annotation': return <AnnotationTab settings={settings} update={updateSettings} />
      case 'shortcuts': return <ShortcutsTab />
      case 'about': return <AboutTab />
    }
  }

  return (
    <Modal
      open={open}
      title="设置"
      width={760}
      onClose={onClose}
      footer={null}
      maskClosable={true}
      typewriter={false}
    >
      <div style={{
        display: 'flex', height: '480px', margin: '-4px -4px 0',
        borderTop: '1px solid #e8e2d6', position: 'relative',
      }}>
        {/* 右上角关闭按钮 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '6px', right: '8px', zIndex: 5,
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#fff', border: '2px solid #e8e2d6',
            cursor: 'pointer', color: '#725d42',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', lineHeight: 1,
          }}
          title="关闭 (Esc)"
        >✕</button>
        {/* 左侧 Tab 列表 */}
        <div style={{
          width: '160px', flexShrink: 0,
          background: '#f8f4ec',
          borderRight: '2px solid #e8e2d6',
          padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          overflowY: 'auto',
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '8px',
                  background: isActive ? '#19c8b9' : 'transparent',
                  color: isActive ? '#fff' : '#725d42',
                  border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: isActive ? 'bold' : 'normal',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f0e8d8' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* 右侧内容面板 */}
        <div style={{
          flex: 1, padding: '16px 20px', overflowY: 'auto',
          background: '#fdfbf5',
        }}>
          {renderContent()}
        </div>
      </div>
    </Modal>
  )
}

// 通用导出：行容器，标签 + 描述 + 控件
export function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '16px', padding: '12px 0',
      borderBottom: '1px solid #f0e8d8',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#725d42' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '11px', color: '#9f927d', marginTop: '4px', lineHeight: 1.5 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '14px', fontWeight: 'bold', color: '#19c8b9',
      marginBottom: '4px', marginTop: '8px',
    }}>{children}</div>
  )
}

// 用作开关的小组件：使用原生 checkbox 但视觉化为开关
export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px',
        background: checked ? '#19c8b9' : '#d5cab2',
        border: 'none', cursor: 'pointer', padding: 0,
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export function SelectInput<T extends string | number>({
  value, options, onChange, width = 140,
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (v: T) => void
  width?: number
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const match = options.find(o => String(o.value) === raw)
        if (match) onChange(match.value)
      }}
      style={{
        width: `${width}px`, padding: '6px 10px',
        border: '2px solid #e8e2d6', borderRadius: '8px',
        background: '#fff', color: '#725d42',
        fontSize: '13px', cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  )
}

export function NumberInput({ value, min, max, step = 1, onChange, width = 100 }: {
  value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; width?: number
}) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e: any) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n)) {
          let v = n
          if (typeof min === 'number') v = Math.max(min, v)
          if (typeof max === 'number') v = Math.min(max, v)
          onChange(v)
        }
      }}
      min={min}
      max={max}
      step={step}
      style={{ width: `${width}px` }}
    />
  )
}

export type { AppSettings }
export { Button }
