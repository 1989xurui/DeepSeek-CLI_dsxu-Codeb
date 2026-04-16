/**
 * Parallel Tool Execution + Tool Result Cache 测试
 * #6.11 + #6.12
 */

import { describe, it, expect, vi } from 'vitest'
import {
  executeToolsParallel,
  ToolResultCache,
} from '../parallel-tools'
import type { ToolDefinition, ToolCall, ToolContext, ToolOutput } from '../types'

const ctx: ToolContext = { cwd: '/tmp', sessionId: 'test', gear: 1 }

// ── Helpers ──

function makeTool(name: string, opts: {
  readOnly?: boolean
  concurrencySafe?: boolean
  delay?: number
  result?: string
} = {}): ToolDefinition {
  return {
    name,
    description: `Test tool ${name}`,
    inputSchema: { type: 'object', properties: {} },
    readOnly: opts.readOnly ?? true,
    concurrencySafe: opts.concurrencySafe ?? true,
    execute: async (input) => {
      if (opts.delay) await new Promise(r => setTimeout(r, opts.delay))
      return { content: opts.result || `${name} result` }
    },
  }
}

function makeCall(id: string, name: string, args: Record<string, any> = {}): ToolCall {
  return { id, name, arguments: args }
}

// ── executeToolsParallel ──

describe('executeToolsParallel', () => {
  it('should execute read-only tools in parallel', async () => {
    const tools = new Map<string, ToolDefinition>([
      ['Read', makeTool('Read', { readOnly: true, delay: 50 })],
      ['Grep', makeTool('Grep', { readOnly: true, delay: 50 })],
    ])

    const calls = [
      makeCall('1', 'Read', { file: 'a.ts' }),
      makeCall('2', 'Grep', { pattern: 'foo' }),
    ]

    const start = Date.now()
    const results = await executeToolsParallel(calls, tools, ctx)
    const elapsed = Date.now() - start

    expect(results).toHaveLength(2)
    expect(results[0].output.content).toBe('Read result')
    expect(results[1].output.content).toBe('Grep result')
    // Parallel should be faster than sequential (50+50=100ms)
    expect(elapsed).toBeLessThan(120) // Some overhead allowed
  })

  it('should execute write tools sequentially', async () => {
    const order: string[] = []
    const tools = new Map<string, ToolDefinition>([
      ['Write', {
        name: 'Write',
        description: 'write',
        inputSchema: { type: 'object', properties: {} },
        readOnly: false,
        execute: async () => { order.push('Write'); return { content: 'wrote' } },
      }],
      ['Edit', {
        name: 'Edit',
        description: 'edit',
        inputSchema: { type: 'object', properties: {} },
        readOnly: false,
        execute: async () => { order.push('Edit'); return { content: 'edited' } },
      }],
    ])

    const calls = [
      makeCall('1', 'Write'),
      makeCall('2', 'Edit'),
    ]

    const results = await executeToolsParallel(calls, tools, ctx)
    expect(results).toHaveLength(2)
    expect(order).toEqual(['Write', 'Edit']) // Sequential order
  })

  it('should handle tool not found', async () => {
    const tools = new Map<string, ToolDefinition>()
    const calls = [makeCall('1', 'NonExistent')]

    const results = await executeToolsParallel(calls, tools, ctx)
    expect(results[0].output.isError).toBe(true)
    expect(results[0].output.content).toContain('not found')
  })

  it('should handle tool execution errors', async () => {
    const tools = new Map<string, ToolDefinition>([
      ['Fail', {
        name: 'Fail',
        description: 'fails',
        inputSchema: { type: 'object', properties: {} },
        readOnly: true,
        execute: async () => { throw new Error('Tool crashed') },
      }],
    ])

    const calls = [makeCall('1', 'Fail')]
    const results = await executeToolsParallel(calls, tools, ctx)
    expect(results[0].output.isError).toBe(true)
    expect(results[0].output.content).toContain('Tool crashed')
  })

  it('should preserve original order', async () => {
    const tools = new Map<string, ToolDefinition>([
      ['Fast', makeTool('Fast', { readOnly: true, delay: 10, result: 'fast' })],
      ['Slow', makeTool('Slow', { readOnly: true, delay: 50, result: 'slow' })],
    ])

    const calls = [
      makeCall('1', 'Slow'),
      makeCall('2', 'Fast'),
    ]

    const results = await executeToolsParallel(calls, tools, ctx)
    expect(results[0].toolName).toBe('Slow')  // Original order preserved
    expect(results[1].toolName).toBe('Fast')
  })

  it('should use cache for read-only tools', async () => {
    let callCount = 0
    const tools = new Map<string, ToolDefinition>([
      ['Read', {
        name: 'Read',
        description: 'read',
        inputSchema: { type: 'object', properties: {} },
        readOnly: true,
        execute: async (input) => {
          callCount++
          return { content: `file content ${callCount}` }
        },
      }],
    ])

    const cache = new ToolResultCache()
    const calls = [makeCall('1', 'Read', { file: 'a.ts' })]

    // First call
    const results1 = await executeToolsParallel(calls, tools, ctx, { enableCache: true }, cache)
    expect(results1[0].cached).toBe(false)
    expect(callCount).toBe(1)

    // Second call with same args - should hit cache
    const calls2 = [makeCall('2', 'Read', { file: 'a.ts' })]
    const results2 = await executeToolsParallel(calls2, tools, ctx, { enableCache: true }, cache)
    expect(results2[0].cached).toBe(true)
    expect(callCount).toBe(1) // Not called again
  })

  it('should respect concurrency limit', async () => {
    let maxConcurrent = 0
    let current = 0

    const tools = new Map<string, ToolDefinition>([
      ['Slow', {
        name: 'Slow',
        description: 'slow',
        inputSchema: { type: 'object', properties: {} },
        readOnly: true,
        concurrencySafe: true,
        execute: async () => {
          current++
          maxConcurrent = Math.max(maxConcurrent, current)
          await new Promise(r => setTimeout(r, 30))
          current--
          return { content: 'done' }
        },
      }],
    ])

    const calls = Array.from({ length: 10 }, (_, i) => makeCall(String(i), 'Slow'))
    await executeToolsParallel(calls, tools, ctx, { maxConcurrent: 3 })

    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })
})

// ── ToolResultCache ──

describe('ToolResultCache', () => {
  it('should cache and retrieve', () => {
    const cache = new ToolResultCache()
    const output: ToolOutput = { content: 'result' }

    cache.set('Read', { file: 'a.ts' }, output)
    const cached = cache.get('Read', { file: 'a.ts' })
    expect(cached).toEqual(output)
  })

  it('should miss on different input', () => {
    const cache = new ToolResultCache()
    cache.set('Read', { file: 'a.ts' }, { content: 'a' })

    const cached = cache.get('Read', { file: 'b.ts' })
    expect(cached).toBeNull()
  })

  it('should miss on different tool', () => {
    const cache = new ToolResultCache()
    cache.set('Read', { file: 'a.ts' }, { content: 'a' })

    const cached = cache.get('Grep', { file: 'a.ts' })
    expect(cached).toBeNull()
  })

  it('should respect TTL', async () => {
    const cache = new ToolResultCache({ ttl: 50 })
    cache.set('Read', { file: 'a.ts' }, { content: 'a' })

    // Immediately: should hit
    expect(cache.get('Read', { file: 'a.ts' })).not.toBeNull()

    // After TTL: should miss
    await new Promise(r => setTimeout(r, 60))
    expect(cache.get('Read', { file: 'a.ts' })).toBeNull()
  })

  it('should evict LRU entries when full', () => {
    const cache = new ToolResultCache({ maxSize: 3 })

    cache.set('T', { k: '1' }, { content: '1' })
    cache.set('T', { k: '2' }, { content: '2' })
    cache.set('T', { k: '3' }, { content: '3' })

    // Access k=1 to make it recently used
    cache.get('T', { k: '1' })

    // Add k=4, should evict k=2 (least recently used)
    cache.set('T', { k: '4' }, { content: '4' })

    expect(cache.get('T', { k: '1' })).not.toBeNull() // Recently accessed
    expect(cache.get('T', { k: '2' })).toBeNull() // Evicted
    expect(cache.get('T', { k: '3' })).not.toBeNull()
    expect(cache.get('T', { k: '4' })).not.toBeNull()
  })

  it('should invalidate by tool name', () => {
    const cache = new ToolResultCache()
    cache.set('Read', { f: '1' }, { content: '1' })
    cache.set('Read', { f: '2' }, { content: '2' })
    cache.set('Grep', { p: 'x' }, { content: 'x' })

    const count = cache.invalidateByTool('Read')
    expect(count).toBe(2)
    expect(cache.get('Read', { f: '1' })).toBeNull()
    expect(cache.get('Grep', { p: 'x' })).not.toBeNull()
  })

  it('should invalidate all', () => {
    const cache = new ToolResultCache()
    cache.set('A', {}, { content: 'a' })
    cache.set('B', {}, { content: 'b' })

    cache.invalidateAll()
    expect(cache.getStats().size).toBe(0)
  })

  it('should track stats', () => {
    const cache = new ToolResultCache()
    cache.set('T', { k: '1' }, { content: '1' })

    cache.get('T', { k: '1' }) // Hit
    cache.get('T', { k: '2' }) // Miss

    const stats = cache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
    expect(stats.hitRate).toBe(0.5)
  })

  it('should handle deterministic key generation', () => {
    const cache = new ToolResultCache()

    // Same keys in different order should produce same cache key
    cache.set('T', { b: 2, a: 1 }, { content: 'x' })
    const cached = cache.get('T', { a: 1, b: 2 })
    expect(cached).toEqual({ content: 'x' })
  })

  it('should reset', () => {
    const cache = new ToolResultCache()
    cache.set('T', {}, { content: 'x' })
    cache.get('T', {})

    cache.reset()
    const stats = cache.getStats()
    expect(stats.size).toBe(0)
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
  })
})
