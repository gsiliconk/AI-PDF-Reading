import { useState } from 'react'
import { Button, Input } from 'animal-island-ui'
import {
  SettingRow, SectionTitle, ToggleSwitch, SelectInput, NumberInput,
} from './SettingsModal'
import type { AppSettings } from './SettingsModal'
import type { QuickCommand } from '../hooks/useSettings'

type Update = (patch: Partial<AppSettings>) => Promise<void>

interface TabProps {
  settings: AppSettings
  update: Update
}

// ============== 阅读 Tab ==============
export function ReadingTab({ settings, update }: TabProps) {
  const zoomOptions: { label: string; value: 'fit-width' | 'fit-page' | number }[] = [
    { label: '适合页宽', value: 'fit-width' },
    { label: '适合页面', value: 'fit-page' },
    { label: '50%', value: 0.5 },
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1.0 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2.0 },
  ]
  return (
    <div>
      <SectionTitle>显示</SectionTitle>
      <SettingRow label="默认缩放" description="打开 PDF 时使用的初始缩放级别">
        <SelectInput
          value={typeof settings.zoom === 'number' ? settings.zoom : settings.zoom}
          options={zoomOptions as any}
          onChange={(v) => update({ zoom: v as any })}
        />
      </SettingRow>
      <SettingRow label="滚动方向" description="多页文档的滚动方向">
        <SelectInput
          value={settings.scrollDirection}
          options={[
            { label: '垂直', value: 'vertical' },
            { label: '水平', value: 'horizontal' },
          ]}
          onChange={(v) => update({ scrollDirection: v })}
        />
      </SettingRow>
      <SettingRow label="显示页码徽标" description="在每页顶部显示页码标签">
        <ToggleSwitch checked={settings.showPageBadge} onChange={(v) => update({ showPageBadge: v })} />
      </SettingRow>
      <SettingRow label="双页显示" description="并排显示两页（适合宽屏阅读）">
        <ToggleSwitch checked={settings.doublePage} onChange={(v) => update({ doublePage: v })} />
      </SettingRow>

      <SectionTitle>记忆</SectionTitle>
      <SettingRow label="记住阅读位置" description="重新打开同一文档时跳转到上次位置">
        <ToggleSwitch checked={settings.rememberPosition} onChange={(v) => update({ rememberPosition: v })} />
      </SettingRow>
    </div>
  )
}

// ============== 外观 Tab ==============
export function AppearanceTab({ settings, update }: TabProps) {
  return (
    <div>
      <SectionTitle>主题</SectionTitle>
      <SettingRow label="主题模式" description="界面颜色风格">
        <SelectInput
          value={settings.theme}
          options={[
            { label: '浅色', value: 'light' },
            { label: '深色', value: 'dark' },
            { label: '跟随系统', value: 'system' },
          ]}
          onChange={(v) => update({ theme: v })}
        />
      </SettingRow>

      <SectionTitle>面板默认状态</SectionTitle>
      <SettingRow label="启动时打开侧边栏" description="启动后自动展开大纲/缩略图">
        <ToggleSwitch checked={settings.sidebarDefaultOpen} onChange={(v) => update({ sidebarDefaultOpen: v })} />
      </SettingRow>
      <SettingRow label="启动时打开 AI 面板" description="启动后自动展开 AI 助手面板">
        <ToggleSwitch checked={settings.aiPanelDefaultOpen} onChange={(v) => update({ aiPanelDefaultOpen: v })} />
      </SettingRow>
      <SettingRow label="启动时打开笔记面板" description="启动后自动展开笔记记录面板">
        <ToggleSwitch checked={settings.notesPanelDefaultOpen} onChange={(v) => update({ notesPanelDefaultOpen: v })} />
      </SettingRow>
    </div>
  )
}

// ============== AI Tab ==============
export function AITab({ settings, update }: TabProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [draftCmd, setDraftCmd] = useState<QuickCommand>({ label: '', prompt: '' })

  const addCommand = () => {
    if (!draftCmd.label.trim() || !draftCmd.prompt.trim()) return
    update({ quickCommands: [...settings.quickCommands, draftCmd] })
    setDraftCmd({ label: '', prompt: '' })
  }
  const removeCommand = (i: number) => {
    update({ quickCommands: settings.quickCommands.filter((_, idx) => idx !== i) })
  }

  return (
    <div>
      <SectionTitle>API 配置</SectionTitle>
      <SettingRow label="API 地址" description="兼容 OpenAI 协议的 chat completions 端点">
        <Input
          value={settings.aiApiUrl}
          onChange={(e: any) => update({ aiApiUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
          style={{ width: '280px' }}
        />
      </SettingRow>
      <SettingRow label="API Key" description="本地存储，不会上传">
        <div style={{ display: 'flex', gap: '6px' }}>
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={settings.aiApiKey}
            onChange={(e: any) => update({ aiApiKey: e.target.value })}
            placeholder="sk-..."
            style={{ width: '240px' }}
          />
          <Button type="default" size="small" onClick={() => setShowApiKey(p => !p)}>
            {showApiKey ? '🙈' : '👁'}
          </Button>
        </div>
      </SettingRow>
      <SettingRow label="模型名称" description="如 gpt-4o、claude-3-5-sonnet 等">
        <Input
          value={settings.aiModel}
          onChange={(e: any) => update({ aiModel: e.target.value })}
          placeholder="gpt-4o"
          style={{ width: '280px' }}
        />
      </SettingRow>

      <SectionTitle>快捷指令</SectionTitle>
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {settings.quickCommands.map((cmd, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', background: '#f8f4ec',
              borderRadius: '8px', border: '1px solid #e8e2d6',
            }}>
              <span style={{
                fontSize: '12px', fontWeight: 'bold', color: '#19c8b9',
                background: '#e6f9f6', padding: '2px 8px', borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}>{cmd.label}</span>
              <span style={{
                fontSize: '12px', color: '#725d42', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{cmd.prompt}</span>
              <button
                onClick={() => removeCommand(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#c4b89e', fontSize: '14px', padding: 0,
                }}
                title="删除"
              >✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <Input
            placeholder="名称"
            value={draftCmd.label}
            onChange={(e: any) => setDraftCmd(p => ({ ...p, label: e.target.value }))}
            style={{ width: '100px' }}
          />
          <Input
            placeholder="提示词"
            value={draftCmd.prompt}
            onChange={(e: any) => setDraftCmd(p => ({ ...p, prompt: e.target.value }))}
            style={{ flex: 1 }}
          />
          <Button type="primary" size="small" onClick={addCommand}>添加</Button>
        </div>
      </div>
    </div>
  )
}

// ============== 批注与笔记 Tab ==============
export function AnnotationTab({ settings, update }: TabProps) {
  const colors = ['#f5c31c', '#19c8b9', '#ff6b6b', '#a59cff', '#5fb878', '#ff9f43']
  return (
    <div>
      <SectionTitle>默认值</SectionTitle>
      <SettingRow label="高亮默认颜色" description="新建高亮/下划线/批注时的默认颜色">
        <div style={{ display: 'flex', gap: '6px' }}>
          {colors.map(c => (
            <button
              key={c}
              onClick={() => update({ highlightDefaultColor: c })}
              style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: c, cursor: 'pointer',
                border: settings.highlightDefaultColor === c
                  ? '3px solid #19c8b9' : '2px solid #e8e2d6',
                padding: 0,
              }}
              title={c}
            />
          ))}
        </div>
      </SettingRow>

      <SectionTitle>限制</SectionTitle>
      <SettingRow label="历史记录上限" description="最多保留多少条最近打开的文档">
        <NumberInput
          value={settings.historyLimit}
          min={5}
          max={100}
          onChange={(v) => update({ historyLimit: v })}
        />
      </SettingRow>
      <SettingRow label="单页批注上限" description="单页最多保留多少条批注（保护性能）">
        <NumberInput
          value={settings.annotationPerPageLimit}
          min={10}
          max={500}
          onChange={(v) => update({ annotationPerPageLimit: v })}
        />
      </SettingRow>

      <SectionTitle>导出</SectionTitle>
      <SettingRow label="导出格式" description="批注导出时使用的默认格式">
        <SelectInput
          value={settings.exportFormat}
          options={[
            { label: 'Markdown', value: 'markdown' },
            { label: 'HTML', value: 'html' },
            { label: 'JSON', value: 'json' },
          ]}
          onChange={(v) => update({ exportFormat: v })}
        />
      </SettingRow>
    </div>
  )
}

// ============== 快捷键 Tab（只读） ==============
export function ShortcutsTab() {
  const groups: { title: string; items: { keys: string; desc: string }[] }[] = [
    {
      title: '文件',
      items: [
        { keys: 'Ctrl + O', desc: '打开 PDF 文件' },
        { keys: 'Ctrl + W', desc: '关闭当前标签页' },
        { keys: 'Ctrl + Tab', desc: '切换到下一个标签页' },
        { keys: 'Ctrl + Shift + Tab', desc: '切换到上一个标签页' },
      ],
    },
    {
      title: '导航',
      items: [
        { keys: 'PageUp / ←', desc: '上一页' },
        { keys: 'PageDown / →', desc: '下一页' },
        { keys: 'Home', desc: '跳到首页' },
        { keys: 'End', desc: '跳到末页' },
      ],
    },
    {
      title: '缩放',
      items: [
        { keys: 'Ctrl + 滚轮', desc: '缩小 / 放大' },
        { keys: 'Ctrl + 0', desc: '重置为 100%' },
      ],
    },
    {
      title: '查找与编辑',
      items: [
        { keys: 'Ctrl + F', desc: '打开搜索栏' },
        { keys: 'Ctrl + C', desc: '复制选中的 PDF 文字' },
      ],
    },
  ]
  return (
    <div>
      {groups.map(group => (
        <div key={group.title} style={{ marginBottom: '16px' }}>
          <SectionTitle>{group.title}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {group.items.map(it => (
              <div key={it.keys} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', background: '#f8f4ec',
                borderRadius: '6px', border: '1px solid #f0e8d8',
              }}>
                <span style={{ fontSize: '12px', color: '#725d42' }}>{it.desc}</span>
                <kbd style={{
                  fontFamily: 'Consolas, Menlo, monospace',
                  fontSize: '12px', color: '#19c8b9',
                  background: '#e6f9f6', padding: '3px 8px',
                  borderRadius: '6px', border: '1px solid #b3ede8',
                }}>{it.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{
        marginTop: '12px', padding: '8px 12px',
        background: '#fff8e6', border: '1px dashed #f5c31c',
        borderRadius: '8px', fontSize: '11px', color: '#9f927d',
      }}>
        提示：当前快捷键不可编辑，后续版本支持自定义。
      </div>
    </div>
  )
}

// ============== 关于 Tab ==============
export function AboutTab() {
  const version = '1.2.0'
  const githubUrl = 'https://github.com/gsiliconk/AI-PDF-Reading'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: '12px' }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '20px',
        background: '#19c8b9', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '36px',
      }}>📄</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#725d42' }}>PDF 智能阅读器</div>
      <div style={{ fontSize: '12px', color: '#9f927d' }}>版本 v{version}</div>
      <div style={{ fontSize: '12px', color: '#9f927d', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6 }}>
        基于 Electron + React + TypeScript 构建的本地 PDF 阅读工具，支持标注、AI 助手、全文搜索等功能。
      </div>
      <Button
        type="primary"
        size="small"
        onClick={() => { window.open(githubUrl, '_blank') }}
      >
        访问 GitHub 仓库
      </Button>
      <div style={{
        marginTop: '12px', padding: '8px 14px',
        background: '#f8f4ec', borderRadius: '8px',
        fontSize: '11px', color: '#9f927d',
      }}>
        © 2026 PDF Smart Reader · MIT License
      </div>
    </div>
  )
}
