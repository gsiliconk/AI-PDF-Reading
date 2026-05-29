import { useState, useEffect, useCallback, useRef } from 'react'

export interface QuickCommand {
  label: string
  prompt: string
}

export interface AppSettings {
  // 阅读
  zoom: 'fit-width' | 'fit-page' | number
  scrollDirection: 'vertical' | 'horizontal'
  showPageBadge: boolean
  doublePage: boolean
  rememberPosition: boolean
  toolbarDocked: boolean
  toolbarOrientation: 'horizontal' | 'vertical'
  toolbarPosition: { x: number; y: number }
  // 外观
  theme: 'light' | 'dark' | 'system'
  sidebarDefaultOpen: boolean
  aiPanelDefaultOpen: boolean
  notesPanelDefaultOpen: boolean
  // AI
  aiApiUrl: string
  aiApiKey: string
  aiModel: string
  quickCommands: QuickCommand[]
  // 批注与笔记
  historyLimit: number
  highlightDefaultColor: string
  annotationPerPageLimit: number
  exportFormat: 'markdown' | 'html' | 'json'
}

export const DEFAULT_SETTINGS: AppSettings = {
  zoom: 'fit-width',
  scrollDirection: 'vertical',
  showPageBadge: true,
  doublePage: false,
  rememberPosition: true,
  toolbarDocked: false,
  toolbarOrientation: 'horizontal',
  toolbarPosition: { x: 16, y: 120 },
  theme: 'light',
  sidebarDefaultOpen: false,
  aiPanelDefaultOpen: false,
  notesPanelDefaultOpen: false,
  aiApiUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o',
  quickCommands: [
    { label: '总结全文', prompt: '请帮我总结这篇文档的主要内容' },
    { label: '提取要点', prompt: '请提取这篇文档的关键要点' },
    { label: '查看目录', prompt: '请显示这篇文档的目录结构' },
    { label: '翻译当前页', prompt: '请将当前页面的内容翻译为中文' },
  ],
  historyLimit: 20,
  highlightDefaultColor: '#f5c31c',
  annotationPerPageLimit: 50,
  exportFormat: 'markdown',
}

const SETTINGS_KEY = 'settings'

/**
 * 全局设置 hook：从 electron-store 读取/写入，所有变更即时持久化。
 * 所有调用者共享同一份配置（通过 window 自定义事件同步）。
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const loadedRef = useRef(false)

  // 初次加载
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const saved = await window.electronAPI.storeGet(SETTINGS_KEY)
        if (cancelled) return
        if (saved && typeof saved === 'object') {
          // 深合并：用户已存的值覆盖默认值，但不会丢失新增字段
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(saved as Partial<AppSettings>),
            quickCommands: Array.isArray((saved as any).quickCommands)
              ? (saved as any).quickCommands
              : DEFAULT_SETTINGS.quickCommands,
          })
        } else {
          // 旧版本兼容：从 localStorage 迁移 AI 配置
          const legacyApiKey = localStorage.getItem('ai-api-key')
          const legacyApiUrl = localStorage.getItem('ai-api-url')
          const legacyModel = localStorage.getItem('ai-model')
          if (legacyApiKey || legacyApiUrl || legacyModel) {
            const migrated: AppSettings = {
              ...DEFAULT_SETTINGS,
              aiApiKey: legacyApiKey || '',
              aiApiUrl: legacyApiUrl || DEFAULT_SETTINGS.aiApiUrl,
              aiModel: legacyModel || DEFAULT_SETTINGS.aiModel,
            }
            setSettings(migrated)
            await window.electronAPI.storeSet(SETTINGS_KEY, migrated)
          }
        }
      } catch (e) {
        console.error('加载设置失败:', e)
      } finally {
        loadedRef.current = true
        setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 监听其他组件的设置变更
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<AppSettings> | undefined
      if (detail) setSettings(prev => ({ ...prev, ...detail }))
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  // 更新单个或多个字段，并即时持久化
  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      // 异步持久化（不 await，避免 UI 阻塞）
      window.electronAPI.storeSet(SETTINGS_KEY, next).catch(err => {
        console.error('保存设置失败:', err)
      })
      // 广播给其他实例
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: patch }))
      return next
    })
  }, [])

  return { settings, updateSettings, loaded }
}
