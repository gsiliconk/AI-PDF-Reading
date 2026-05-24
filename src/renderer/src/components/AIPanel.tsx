import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Card, Icon, Modal } from 'animal-island-ui'
import ReactMarkdown from 'react-markdown'
import { useResizable } from '../hooks/useResizable'
import * as pdfjsLib from 'pdfjs-dist'
import { PDF_TOOLS, executeTool } from '../services/pdfSkills'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AIPanelProps {
  isOpen: boolean
  onToggle: () => void
  pdfDocument: pdfjsLib.PDFDocumentProxy | null
  currentPage: number
}
export default function AIPanel({ isOpen, onToggle, pdfDocument, currentPage }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState(localStorage.getItem('ai-api-key') || '')
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('ai-api-url') || 'https://api.openai.com/v1')
  const [modelName, setModelName] = useState(localStorage.getItem('ai-model') || 'gpt-4o')
  const [toolStatus, setToolStatus] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { width: panelWidth, setContainerRef, resizeHandle } = useResizable({
    initialWidth: 360,
    minWidth: 280,
    maxWidth: 600,
    direction: 'left',
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const handleSaveSettings = useCallback(() => {
    localStorage.setItem('ai-api-key', apiKey)
    localStorage.setItem('ai-api-url', apiUrl)
    localStorage.setItem('ai-model', modelName)
    setSettingsOpen(false)
  }, [apiKey, apiUrl, modelName])

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const handleClearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setToolStatus('')

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }])

    try {
      const systemPrompt = pdfDocument
        ? `你是一个 PDF 文档阅读助手。当前文档共 ${pdfDocument.numPages} 页，用户正在查看第 ${currentPage} 页。
你有以下工具可以调用来读取文档内容：get_page_text、extract_pages、search_text、get_outline、find_relevant_sections。
遇到需要查阅文档内容的问题时，请主动调用工具获取信息，不要凭空猜测。请使用 Markdown 格式回复。`
        : '你是一个 AI 助手。请使用 Markdown 格式回复。'

      // 构建 API 消息历史（包含 tool 消息）
      const apiMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage.content },
      ]

      const tools = pdfDocument ? PDF_TOOLS : undefined

      // Function Calling 循环：最多执行 5 轮工具调用
      let round = 0
      while (round < 5) {
        round++
        const response = await window.electronAPI.aiChat({ apiUrl, apiKey, model: modelName, messages: apiMessages, tools })

        // 没有 tool_calls，直接流式输出最终回答
        if (!response.tool_calls?.length) {
          const finalContent = response.content || ''
          // 用流式接口输出最终内容（已有内容直接设置）
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent } : m))
          setToolStatus('')
          break
        }

        // 有 tool_calls，执行工具
        apiMessages.push({ role: 'assistant', content: null, tool_calls: response.tool_calls })

        for (const tc of response.tool_calls) {
          const name = tc.function.name
          const args = JSON.parse(tc.function.arguments || '{}')
          setToolStatus(`正在调用工具：${name}...`)

          const result = pdfDocument
            ? await executeTool(name, args, pdfDocument)
            : '没有打开的文档'

          apiMessages.push({ role: 'tool', content: result, tool_call_id: tc.id })
        }
      }
    } catch (error: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `**错误**: ${error.message}` } : m
      ))
      setToolStatus('')
    } finally {
      setIsLoading(false)
      setToolStatus('')
    }
  }, [inputValue, isLoading, messages, currentPage, pdfDocument, apiUrl, apiKey, modelName])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const quickCommands = [
    { label: '总结全文', prompt: '请帮我总结这篇文档的主要内容' },
    { label: '提取要点', prompt: '请提取这篇文档的关键要点' },
    { label: '查看目录', prompt: '请显示这篇文档的目录结构' },
    { label: '翻译当前页', prompt: '请将当前页面的内容翻译为中文' },
  ]

  if (!isOpen) {
    return (
      <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
        <Button type="default" size="small" onClick={onToggle}
          style={{ borderRadius: '12px 0 0 12px', padding: '8px 4px' }}>
          <Icon name="icon-chat" size={16} />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div
        ref={setContainerRef as any}
        style={{ width: `${panelWidth}px`, flexShrink: 0, position: 'relative', display: 'flex' }}
      >
      <Card style={{
        width: '100%', borderRadius: 0, margin: 0,
        display: 'flex', flexDirection: 'column',
        borderLeft: '2px solid #e8e2d6', flexShrink: 0, position: 'relative',
        cursor: 'default',
      }}>
        {resizeHandle}

        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '2px solid #e8e2d6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="icon-chat" size={20} />
            <span style={{ fontWeight: 'bold', color: '#725d42' }}>AI 助手</span>
            <span style={{ fontSize: '11px', color: '#9f927d', background: '#f0e8d8', padding: '2px 6px', borderRadius: '8px' }}>
              {modelName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Button type="text" size="small" onClick={handleClearMessages} title="清空对话">🗑</Button>
            <Button type="text" size="small" onClick={() => setSettingsOpen(true)} title="设置">
              <Icon name="icon-diy" size={14} />
            </Button>
            <Button type="text" size="small" onClick={onToggle}>✕</Button>
          </div>
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#c4b89e', fontSize: '13px' }}>
              <Icon name="icon-chat" size={48} />
              <p style={{ marginTop: '12px' }}>开始对话吧！</p>
              <p>我可以调用工具读取文档内容来回答你的问题</p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              className="msg-row"
            >
              <div style={{
                maxWidth: '85%', padding: '10px 36px 10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? '#19c8b9' : '#f0e8d8',
                color: msg.role === 'user' ? '#fff' : '#725d42',
                fontSize: '13px', lineHeight: '1.6', position: 'relative',
              }}>
                {msg.role === 'assistant' ? (
                  msg.content
                    ? <div className="markdown-body"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    : isLoading && <span style={{ color: '#9f927d' }}>{toolStatus || '思考中...'}</span>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                )}
                <button onClick={() => handleCopyMessage(msg.content)}
                  style={{
                    position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: msg.role === 'user' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    opacity: 0, transition: 'opacity 0.15s', padding: 0, fontSize: '12px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  title="复制"
                >📋</button>
              </div>
            </div>
          ))}

          {/* 工具调用状态提示 */}
          {isLoading && toolStatus && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '6px 12px', borderRadius: '12px',
                background: '#e6f9f6', color: '#19c8b9',
                fontSize: '12px', border: '1px solid #b3ede8',
              }}>
                🔧 {toolStatus}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 快捷指令 */}
        <div style={{ display: 'flex', gap: '6px', padding: '0 12px 8px', flexWrap: 'wrap' }}>
          {quickCommands.map(cmd => (
            <Button key={cmd.label} type="default" size="small"
              onClick={() => setInputValue(cmd.prompt)}
              style={{ fontSize: '11px', padding: '2px 8px' }}>
              {cmd.label}
            </Button>
          ))}
        </div>

        {/* 输入框 */}
        <div style={{ padding: '12px', borderTop: '2px solid #e8e2d6', display: 'flex', gap: '8px' }}>
          <Input
            placeholder="输入问题... (Shift+Enter 换行)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handleSend} disabled={!inputValue.trim() || isLoading}>
            发送
          </Button>
        </div>
      </Card>
      </div>

      {/* 设置弹窗 */}
      <Modal open={settingsOpen} title="AI 设置" onClose={() => setSettingsOpen(false)} onOk={handleSaveSettings}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#725d42' }}>API 地址</label>
            <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#725d42' }}>API Key</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input type={showApiKey ? 'text' : 'password'} value={apiKey}
                onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." style={{ flex: 1 }} />
              <Button type="default" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? '🙈' : '👁'}
              </Button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#725d42' }}>模型名称</label>
            <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="gpt-4o" />
          </div>
        </div>
      </Modal>
    </>
  )
}

