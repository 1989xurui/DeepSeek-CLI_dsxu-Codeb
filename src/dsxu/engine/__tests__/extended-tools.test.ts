/**
 * 扩展工具测试
 *
 * WebFetch/WebSearch: Mock fetch（不依赖外部网络）
 * TodoWrite: 纯内存操作
 * AskUser: Mock callback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  WebFetchTool,
  WebSearchTool,
  TodoWriteTool,
  AskUserTool,
  RewindFilesTool,
  getExtendedTools,
  getSessionTodos,
  resetSessionTodos,
  setAskUserCallback,
} from '../extended-tools'
import type { ToolContext } from '../types'
import { FileHistoryManager } from '../file-history'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const ctx: ToolContext = { cwd: '/project', sessionId: 'test', gear: 1 }
const tempDirs: string[] = []

// Mock fetch
const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  mockFetch.mockReset()
  resetSessionTodos()
  ;(globalThis as any).fetch = mockFetch
})

afterEach(() => {
  ;(globalThis as any).fetch = originalFetch
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── WebFetch ──

describe('WebFetchTool', () => {
  it('should fetch text content', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Hello World', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }))

    const result = await WebFetchTool.execute({ url: 'https://example.com/hello.txt' }, ctx)
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Hello World')
    expect(result.content).toContain('200')
  })

  it('should fetch JSON content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ key: 'value' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const result = await WebFetchTool.execute({ url: 'https://api.example.com/data' }, ctx)
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('"key"')
    expect(result.content).toContain('"value"')
  })

  it('should convert HTML to text', async () => {
    const html = '<html><body><h1>Title</h1><p>Paragraph</p><script>evil()</script></body></html>'
    mockFetch.mockResolvedValueOnce(new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }))

    const result = await WebFetchTool.execute({ url: 'https://example.com' }, ctx)
    expect(result.content).toContain('# Title')
    expect(result.content).toContain('Paragraph')
    expect(result.content).not.toContain('evil()')
  })

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }))

    const result = await WebFetchTool.execute({ url: 'https://example.com/missing' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('404')
  })

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await WebFetchTool.execute({ url: 'https://unreachable.com' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Network timeout')
  })
})

// ── WebSearch ──

describe('WebSearchTool', () => {
  it('should parse DDG results', async () => {
    const mockHtml = `
      <div class="links_main links_deep">
        <a class="result__a" href="https://example.com">Example Result</a>
        <a class="result__snippet">This is a test snippet.</a>
      </div>
    `
    mockFetch.mockResolvedValueOnce(new Response(mockHtml, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }))

    const result = await WebSearchTool.execute({ query: 'test query' }, ctx)
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('test query')
  })

  it('should handle no results', async () => {
    mockFetch.mockResolvedValueOnce(new Response('<html><body>No results</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }))

    const result = await WebSearchTool.execute({ query: 'impossible query xyz123' }, ctx)
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('No results')
  })

  it('should handle search errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'))

    const result = await WebSearchTool.execute({ query: 'test' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('DNS resolution failed')
  })
})

// ── TodoWrite ──

describe('TodoWriteTool', () => {
  it('should create todo list', async () => {
    const result = await TodoWriteTool.execute({
      todos: [
        { id: '1', text: 'Fix bug', status: 'pending', priority: 'high' },
        { id: '2', text: 'Write tests', status: 'pending', priority: 'medium' },
      ],
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Fix bug')
    expect(result.content).toContain('Write tests')
    expect(result.content).toContain('0 done')
    expect(result.content).toContain('2 pending')
  })

  it('should update todo list', async () => {
    // Create initial
    await TodoWriteTool.execute({
      todos: [
        { id: '1', text: 'Fix bug', status: 'pending' },
        { id: '2', text: 'Write tests', status: 'pending' },
      ],
    }, ctx)

    // Update: mark first as done
    const result = await TodoWriteTool.execute({
      todos: [
        { id: '1', text: 'Fix bug', status: 'done' },
        { id: '2', text: 'Write tests', status: 'pending' },
      ],
    }, ctx)

    expect(result.content).toContain('1 done')
    expect(result.content).toContain('1 pending')
  })

  it('should track session todos', async () => {
    await TodoWriteTool.execute({
      todos: [
        { id: '1', text: 'Task A', status: 'pending', priority: 'high' },
      ],
    }, ctx)

    const todos = getSessionTodos()
    expect(todos).toHaveLength(1)
    expect(todos[0].text).toBe('Task A')
    expect(todos[0].priority).toBe('high')
  })

  it('should reset on new session', async () => {
    await TodoWriteTool.execute({
      todos: [{ id: '1', text: 'Task', status: 'pending' }],
    }, ctx)

    expect(getSessionTodos()).toHaveLength(1)
    resetSessionTodos()
    expect(getSessionTodos()).toHaveLength(0)
  })
})

// ── AskUser ──

describe('AskUserTool', () => {
  afterEach(() => {
    setAskUserCallback(null as any)
  })

  it('should handle no callback gracefully', async () => {
    const result = await AskUserTool.execute({ question: 'What color?' }, ctx)
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('No user interaction')
    expect(result.content).toContain('What color?')
  })

  it('should relay question and return answer', async () => {
    setAskUserCallback(async (q) => {
      expect(q).toBe('What color?')
      return 'Blue'
    })

    const result = await AskUserTool.execute({ question: 'What color?' }, ctx)
    expect(result.content).toContain('Blue')
  })

  it('should handle callback errors', async () => {
    setAskUserCallback(async () => { throw new Error('User disconnected') })

    const result = await AskUserTool.execute({ question: 'Hello?' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('User disconnected')
  })
})

// ── Collection ──


describe('RewindFilesTool', () => {
  it('should preview a rewind when dry_run=true', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-rewind-preview-'))
    tempDirs.push(cwd)

    const manager = new FileHistoryManager({ cwd })
    const filePath = join(cwd, 'notes.txt')

    writeFileSync(filePath, 'v1\n', 'utf-8')
    manager.trackEdit(filePath)
    manager.makeSnapshot('snap-1')

    writeFileSync(filePath, 'v2\nextra\n', 'utf-8')
    manager.makeSnapshot('snap-2')

    const result = await RewindFilesTool.execute(
      { snapshot_id: 'snap-1', dry_run: true },
      { ...ctx, cwd, fileHistory: manager },
    )

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Rewind preview for snap-1')
    expect(result.content).toContain('hasChanges: true')
    expect(result.content).toContain(filePath)
  })

  it('should rewind files to the requested snapshot', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-rewind-apply-'))
    tempDirs.push(cwd)

    const manager = new FileHistoryManager({ cwd })
    const filePath = join(cwd, 'notes.txt')

    writeFileSync(filePath, 'v1\n', 'utf-8')
    manager.trackEdit(filePath)
    manager.makeSnapshot('snap-1')

    writeFileSync(filePath, 'v2\n', 'utf-8')
    manager.makeSnapshot('snap-2')

    const result = await RewindFilesTool.execute(
      { snapshot_id: 'snap-1' },
      { ...ctx, cwd, fileHistory: manager },
    )

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Rewind complete for snap-1')
    expect(readFileSync(filePath, 'utf-8')).toBe('v1\n')
  })

  it('should error when file history is unavailable', async () => {
    const result = await RewindFilesTool.execute({ snapshot_id: 'missing' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('No file history')
  })
})

describe('getExtendedTools', () => {
  it('should return 7 extended tools', () => {
    const tools = getExtendedTools()
    expect(tools).toHaveLength(7)
    expect(tools.map(t => t.name)).toEqual(['WebFetch', 'WebSearch', 'TodoWrite', 'AskUser', 'RewindFiles', 'Frontmatter', 'MagicDocs'])
  })
})
