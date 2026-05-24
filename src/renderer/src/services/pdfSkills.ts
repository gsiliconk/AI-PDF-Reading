import * as pdfjsLib from 'pdfjs-dist'

// 获取单页文本
export async function getPageText(doc: pdfjsLib.PDFDocumentProxy, page: number): Promise<string> {
  try {
    const p = await doc.getPage(page)
    const tc = await p.getTextContent()
    return tc.items.map((i: any) => i.str).join(' ')
  } catch { return '' }
}

// 批量提取多页文本（最多 30 页）
export async function extractPages(doc: pdfjsLib.PDFDocumentProxy, pages: number[]): Promise<string> {
  const limited = pages.slice(0, 30)
  const truncated = pages.length > 30
  const parts: string[] = []
  for (const n of limited) {
    if (n < 1 || n > doc.numPages) continue
    const text = await getPageText(doc, n)
    parts.push(`--- 第 ${n} 页 ---\n${text || '(无文本)'}`)
  }
  if (truncated) parts.push(`\n[注：共 ${pages.length} 页，仅提取了前 30 页，如需更多请分段查询]`)
  return parts.join('\n\n')
}

// 全文搜索关键词
export async function searchText(doc: pdfjsLib.PDFDocumentProxy, query: string, maxResults = 10): Promise<string> {
  const lower = query.toLowerCase()
  const results: string[] = []
  for (let i = 1; i <= doc.numPages && results.length < maxResults; i++) {
    const text = await getPageText(doc, i)
    if (text.toLowerCase().includes(lower)) {
      const idx = text.toLowerCase().indexOf(lower)
      const ctx = text.slice(Math.max(0, idx - 60), idx + query.length + 60)
      results.push(`第 ${i} 页: ...${ctx}...`)
    }
  }
  return results.length ? results.join('\n') : '未找到相关内容'
}

// 获取目录/大纲
export async function getOutline(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
  try {
    const outline = await doc.getOutline()
    if (!outline?.length) return '该文档没有目录'
    const fmt = (items: any[], depth = 0): string =>
      items.map(item =>
        `${'  '.repeat(depth)}• ${item.title}${item.items?.length ? '\n' + fmt(item.items, depth + 1) : ''}`
      ).join('\n')
    return fmt(outline)
  } catch { return '无法读取目录' }
}

// 找出最相关段落
export async function findRelevantSections(doc: pdfjsLib.PDFDocumentProxy, question: string, topK = 5): Promise<string> {
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const scored: { page: number; score: number; text: string }[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const text = await getPageText(doc, i)
    const lower = text.toLowerCase()
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > 0) scored.push({ page: i, score, text: text.slice(0, 400) })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK).map(s => `第 ${s.page} 页 (相关度 ${s.score}):\n${s.text}`).join('\n\n') || '未找到相关段落'
}

// 传给 API 的 tools 定义
export const PDF_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_page_text',
      description: '获取 PDF 指定页面的文本内容',
      parameters: {
        type: 'object',
        properties: { page: { type: 'number', description: '页码（从1开始）' } },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_pages',
      description: '提取 PDF 多个页面的文本，适合总结全文或某章节',
      parameters: {
        type: 'object',
        properties: {
          pages: { type: 'array', items: { type: 'number' }, description: '要提取的页码列表' },
        },
        required: ['pages'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_text',
      description: '在整个 PDF 中搜索关键词，返回包含该词的页面和上下文',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '要搜索的关键词或短语' },
          max_results: { type: 'number', description: '最多返回几条结果，默认10' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_outline',
      description: '获取 PDF 的目录/大纲结构，了解文档章节组织',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_relevant_sections',
      description: '根据问题找出 PDF 中最相关的段落，适合回答具体问题',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '用户的问题' },
          top_k: { type: 'number', description: '返回最相关的几个段落，默认5' },
        },
        required: ['question'],
      },
    },
  },
]

// 执行工具调用
export async function executeTool(name: string, args: any, doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
  switch (name) {
    case 'get_page_text': return getPageText(doc, args.page)
    case 'extract_pages': return extractPages(doc, args.pages)
    case 'search_text': return searchText(doc, args.query, args.max_results)
    case 'get_outline': return getOutline(doc)
    case 'find_relevant_sections': return findRelevantSections(doc, args.question, args.top_k)
    default: return `未知工具: ${name}`
  }
}
