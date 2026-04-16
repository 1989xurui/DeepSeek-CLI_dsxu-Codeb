/**
 * DSxu 扩展工具集 — 核心 6 工具之外的高价值工具
 *
 * 按 Claude 使用频次排序，分批实现：
 *   Batch 1（本文件）：WebFetch, WebSearch, TodoWrite, AskUser
 *   Batch 2（后续）：NotebookEdit, LSP, Agent, Worktree
 *
 * 设计原则：
 * - 轻量直接：不依赖 Bun/Zod，纯 TS + fetch
 * - 与 builtin-tools 同接口：ToolDefinition
 * - 安全标记：readOnly / concurrencySafe
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { FrontmatterTool } from './frontmatter-tool'
import { MagicDocsTool } from './magic-docs-tool'

const MAX_OUTPUT_CHARS = 30_000

function truncate(s: string, max = MAX_OUTPUT_CHARS): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n\n[...truncated, ${s.length - max} chars omitted]`
}

// ── WebFetch ──

export const WebFetchTool: ToolDefinition = {
  name: 'WebFetch',
  description: 'Fetch content from a URL and return it as markdown/text. Use for reading web pages, API docs, or downloading text content.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch content from' },
      prompt: { type: 'string', description: 'Optional prompt to describe what to extract from the page' },
    },
    required: ['url'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input) => {
    const url = input.url as string
    const prompt = input.prompt as string | undefined

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'DSxu/1.0 (AI coding assistant)',
          'Accept': 'text/html,application/json,text/plain,*/*',
        },
        signal: AbortSignal.timeout(30_000),
      })

      if (!resp.ok) {
        return {
          content: `HTTP ${resp.status} ${resp.statusText} fetching ${url}`,
          isError: true,
        }
      }

      const contentType = resp.headers.get('content-type') || ''
      let text: string

      if (contentType.includes('json')) {
        const json = await resp.json()
        text = JSON.stringify(json, null, 2)
      } else {
        text = await resp.text()
      }

      // 基础 HTML → 文本转换（轻量版，不引入 turndown）
      if (contentType.includes('html')) {
        text = htmlToText(text)
      }

      const header = `URL: ${url}\nStatus: ${resp.status}\nContent-Type: ${contentType}\n---\n`

      return {
        content: truncate(header + text),
        meta: { url, status: resp.status, bytes: text.length },
      }
    } catch (error: any) {
      return { content: `Fetch error: ${error.message}`, isError: true }
    }
  },
}

/** 基础 HTML → 文本（不引入外部依赖） */
function htmlToText(html: string): string {
  return html
    // Remove script/style
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Headers → markdown
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, level, text) => '#'.repeat(+level) + ' ' + text.trim() + '\n\n')
    // Links → markdown
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Lists
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    // Paragraphs / divs → newlines
    .replace(/<\/(p|div|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── WebSearch ──

export const WebSearchTool: ToolDefinition = {
  name: 'WebSearch',
  description: 'Search the web using a search engine. Returns search result snippets. Use when you need up-to-date information.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      num_results: { type: 'number', description: 'Number of results (default 5, max 10)' },
    },
    required: ['query'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input) => {
    const query = input.query as string
    const numResults = Math.min((input.num_results as number) || 5, 10)

    try {
      // 使用 DuckDuckGo HTML API（免费，无需 API key）
      const encoded = encodeURIComponent(query)
      const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
        headers: {
          'User-Agent': 'DSxu/1.0 (AI coding assistant)',
        },
        signal: AbortSignal.timeout(15_000),
      })

      if (!resp.ok) {
        return { content: `Search failed: HTTP ${resp.status}`, isError: true }
      }

      const html = await resp.text()

      // 从 DDG HTML 提取结果
      const results = parseDDGResults(html, numResults)

      if (results.length === 0) {
        return { content: `No results found for: ${query}` }
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n')

      return {
        content: `Search results for: "${query}"\n\n${formatted}`,
        meta: { query, count: results.length },
      }
    } catch (error: any) {
      return { content: `Search error: ${error.message}`, isError: true }
    }
  },
}

interface SearchResult {
  title: string
  url: string
  snippet: string
}

function parseDDGResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = []

  // DDG HTML results are in <div class="result__body"> blocks
  const resultBlocks = html.match(/<div class="links_main[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || []

  for (const block of resultBlocks) {
    if (results.length >= max) break

    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/i)
    const urlMatch = block.match(/<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>/i)
      || block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>/i)
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)

    if (titleMatch) {
      results.push({
        title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
        url: urlMatch ? decodeURIComponent(urlMatch[1].replace(/.*uddg=/, '').replace(/&.*/, '')) : '',
        snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '',
      })
    }
  }

  // Fallback: simpler regex if structured parsing fails
  if (results.length === 0) {
    const simpleResults = html.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/gi) || []
    for (const match of simpleResults.slice(0, max)) {
      const text = match.replace(/<[^>]+>/g, '').trim()
      const href = match.match(/href="([^"]*)"/)?.[1] || ''
      if (text) {
        results.push({ title: text, url: href, snippet: '' })
      }
    }
  }

  return results
}

// ── TodoWrite ──

/** 内存中的 TODO 列表（会话级） */
let sessionTodos: Array<{ id: string; text: string; status: 'pending' | 'done' | 'blocked'; priority: 'high' | 'medium' | 'low' }> = []

export const TodoWriteTool: ToolDefinition = {
  name: 'TodoWrite',
  description: 'Manage the session task checklist. Write or update the todo list to track progress on multi-step tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The updated todo list. Each item: { id, text, status, priority }',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique ID for the todo item' },
            text: { type: 'string', description: 'Description of the task' },
            status: { type: 'string', enum: ['pending', 'done', 'blocked'], description: 'Task status' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
          },
          required: ['id', 'text', 'status'],
        },
      },
    },
    required: ['todos'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input) => {
    const oldTodos = [...sessionTodos]
    const newTodos = (input.todos as any[]).map(t => ({
      id: t.id || `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: t.text || '',
      status: t.status || 'pending',
      priority: t.priority || 'medium',
    }))

    sessionTodos = newTodos

    const done = newTodos.filter(t => t.status === 'done').length
    const pending = newTodos.filter(t => t.status === 'pending').length
    const blocked = newTodos.filter(t => t.status === 'blocked').length

    const summary = newTodos.map(t => {
      const icon = t.status === 'done' ? '✅' : t.status === 'blocked' ? '🔴' : '⬜'
      return `${icon} [${t.priority}] ${t.text}`
    }).join('\n')

    return {
      content: `Todo list updated (${done} done, ${pending} pending, ${blocked} blocked):\n${summary}`,
      meta: { oldCount: oldTodos.length, newCount: newTodos.length },
    }
  },
}

/** 获取当前 TODO 列表（给其他模块用） */
export function getSessionTodos() {
  return [...sessionTodos]
}

/** 重置 TODO 列表（新会话时调用） */
export function resetSessionTodos() {
  sessionTodos = []
}

// ── AskUser ──

/** AskUser 回调（由 CLI/UI 层注入） */
let askUserCallback: ((question: string) => Promise<string>) | null = null

export function setAskUserCallback(cb: (question: string) => Promise<string>) {
  askUserCallback = cb
}

export const AskUserTool: ToolDefinition = {
  name: 'AskUser',
  description: 'Ask the user a question and wait for their response. Use when you need clarification, confirmation, or additional information to proceed.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user' },
    },
    required: ['question'],
  },
  concurrencySafe: false,
  readOnly: true,
  execute: async (input) => {
    const question = input.question as string

    if (!askUserCallback) {
      return {
        content: `[AskUser] No user interaction available. Question was: "${question}". Proceeding with best judgment.`,
      }
    }

    try {
      const answer = await askUserCallback(question)
      return {
        content: `User response: ${answer}`,
        meta: { question, answer },
      }
    } catch (error: any) {
      return {
        content: `[AskUser] Failed to get user response: ${error.message}. Question was: "${question}"`,
        isError: true,
      }
    }
  },
}

// ── 注册扩展工具 ──

/** 获取扩展工具（Batch 1） */
export const RewindFilesTool: ToolDefinition = {
  name: 'RewindFiles',
  description: 'Rewind tracked files to a previous file-history snapshot. Use dry_run=true to preview what would change.',
  inputSchema: {
    type: 'object',
    properties: {
      snapshot_id: { type: 'string', description: 'Snapshot ID / toolUseId to rewind to' },
      dry_run: { type: 'boolean', description: 'Preview only; do not change files' },
    },
    required: ['snapshot_id'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, ctx) => {
    const snapshotId = input.snapshot_id as string
    const dryRun = (input.dry_run as boolean) ?? false

    if (!ctx.fileHistory) {
      return {
        content: 'No file history is available in this tool context.',
        isError: true,
      }
    }

    const knownSnapshots = ctx.fileHistory.listSnapshots()
    if (!ctx.fileHistory.canRestore(snapshotId)) {
      const available =
        knownSnapshots.length === 0
          ? 'none'
          : knownSnapshots.map(snapshot => snapshot.messageId).join(', ')
      return {
        content: `Snapshot not found: ${snapshotId}. Available snapshots: ${available}`,
        isError: true,
      }
    }

    try {
      if (dryRun) {
        const diffStats = ctx.fileHistory.getDiffStats(snapshotId)
        const hasChanges = ctx.fileHistory.hasAnyChanges(snapshotId)
        const fileSummary =
          diffStats?.filesChanged.length
            ? diffStats.filesChanged.join('\n')
            : '(no file changes)'

        return {
          content:
            `Rewind preview for ${snapshotId}\n` +
            `canRestore: true\n` +
            `hasChanges: ${hasChanges}\n` +
            `filesChanged: ${diffStats?.filesChanged.length ?? 0}\n` +
            `insertions: ${diffStats?.insertions ?? 0}\n` +
            `deletions: ${diffStats?.deletions ?? 0}\n` +
            `---\n${fileSummary}`,
          meta: { snapshotId, dryRun, diffStats, hasChanges },
        }
      }

      const changedFiles = ctx.fileHistory.rewind(snapshotId)
      return {
        content:
          `Rewind complete for ${snapshotId}\n` +
          `changedFiles: ${changedFiles.length}\n` +
          (changedFiles.length ? `---\n${changedFiles.join('\n')}` : '---\n(no changes)'),
        meta: { snapshotId, dryRun, changedFiles },
      }
    } catch (error: any) {
      return {
        content: `Failed to rewind ${snapshotId}: ${error.message}`,
        isError: true,
      }
    }
  },
}

export function getExtendedTools(): ToolDefinition[] {
  return [WebFetchTool, WebSearchTool, TodoWriteTool, AskUserTool, RewindFilesTool, FrontmatterTool, MagicDocsTool]
}

/** 获取全部工具（核心 6 + 扩展 4 = 10） */
export function getAllTools(): ToolDefinition[] {
  // 延迟导入避免循环
  const { getCoreTools } = require('./builtin-tools')
  return [...getCoreTools(), ...getExtendedTools()]
}
