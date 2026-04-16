/**
 * #6.11 Parallel Tool Execution + #6.12 Tool Result Caching
 *
 * 并行工具执行：
 *   - LLM 返回多个 tool_calls 时，并发执行只读工具
 *   - 写入工具串行执行（避免竞争）
 *   - 超时控制 + 错误隔离
 *
 * 工具结果缓存：
 *   - 对相同 (tool, input) 的重复调用返回缓存结果
 *   - 只缓存只读工具
 *   - LRU 淘汰 + TTL 过期
 */

import type { ToolDefinition, ToolContext, ToolOutput, ToolCall } from './types'

// ── #6.11 Parallel Execution ──

export interface ParallelConfig {
  /** 最大并发数（默认 5） */
  maxConcurrent: number
  /** 单工具超时 ms（默认 30000） */
  toolTimeout: number
  /** 是否启用缓存（默认 true） */
  enableCache: boolean
}

const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  maxConcurrent: 5,
  toolTimeout: 30_000,
  enableCache: true,
}

export interface ToolExecResult {
  toolCallId: string
  toolName: string
  output: ToolOutput
  cached: boolean
  durationMs: number
}

/**
 * 并行执行多个工具调用
 *
 * 策略：
 *   - readOnly + concurrencySafe → 并行
 *   - 其他 → 串行
 */
export async function executeToolsParallel(
  toolCalls: ToolCall[],
  tools: Map<string, ToolDefinition>,
  ctx: ToolContext,
  config?: Partial<ParallelConfig>,
  cache?: ToolResultCache,
): Promise<ToolExecResult[]> {
  const cfg = { ...DEFAULT_PARALLEL_CONFIG, ...config }

  // Separate into parallel-safe and serial groups
  const parallelCalls: ToolCall[] = []
  const serialCalls: ToolCall[] = []

  for (const call of toolCalls) {
    const tool = tools.get(call.name)
    if (tool && tool.readOnly && tool.concurrencySafe !== false) {
      parallelCalls.push(call)
    } else {
      serialCalls.push(call)
    }
  }

  const results: ToolExecResult[] = []

  // Execute parallel group with concurrency limit
  if (parallelCalls.length > 0) {
    const parallelResults = await executeConcurrent(
      parallelCalls, tools, ctx, cfg, cache,
    )
    results.push(...parallelResults)
  }

  // Execute serial group sequentially
  for (const call of serialCalls) {
    const result = await executeSingleTool(call, tools, ctx, cfg, cache)
    results.push(result)
  }

  // Sort results back to original order
  const orderMap = new Map(toolCalls.map((c, i) => [c.id, i]))
  results.sort((a, b) => (orderMap.get(a.toolCallId) ?? 0) - (orderMap.get(b.toolCallId) ?? 0))

  return results
}

/**
 * 并发执行多个工具（带并发限制）
 */
async function executeConcurrent(
  calls: ToolCall[],
  tools: Map<string, ToolDefinition>,
  ctx: ToolContext,
  config: ParallelConfig,
  cache?: ToolResultCache,
): Promise<ToolExecResult[]> {
  const results: ToolExecResult[] = []
  const executing = new Set<Promise<void>>()

  for (const call of calls) {
    const promise = (async () => {
      const result = await executeSingleTool(call, tools, ctx, config, cache)
      results.push(result)
    })()

    executing.add(promise)
    promise.finally(() => executing.delete(promise))

    // Wait if at concurrency limit
    if (executing.size >= config.maxConcurrent) {
      await Promise.race(executing)
    }
  }

  // Wait for all remaining
  await Promise.all(executing)

  return results
}

/**
 * 执行单个工具（带超时和缓存）
 */
async function executeSingleTool(
  call: ToolCall,
  tools: Map<string, ToolDefinition>,
  ctx: ToolContext,
  config: ParallelConfig,
  cache?: ToolResultCache,
): Promise<ToolExecResult> {
  const tool = tools.get(call.name)
  const start = Date.now()

  if (!tool) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      output: { content: `Tool not found: ${call.name}`, isError: true },
      cached: false,
      durationMs: 0,
    }
  }

  // Check cache for read-only tools
  if (config.enableCache && cache && tool.readOnly) {
    const cached = cache.get(call.name, call.arguments)
    if (cached) {
      return {
        toolCallId: call.id,
        toolName: call.name,
        output: cached,
        cached: true,
        durationMs: 0,
      }
    }
  }

  // Execute with timeout
  try {
    const output = await Promise.race([
      tool.execute(call.arguments, ctx),
      new Promise<ToolOutput>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool ${call.name} timed out after ${config.toolTimeout}ms`)), config.toolTimeout),
      ),
    ])

    // Cache result
    if (config.enableCache && cache && tool.readOnly && !output.isError) {
      cache.set(call.name, call.arguments, output)
    }

    return {
      toolCallId: call.id,
      toolName: call.name,
      output,
      cached: false,
      durationMs: Date.now() - start,
    }
  } catch (error: any) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      output: { content: `Tool execution error: ${error.message}`, isError: true },
      cached: false,
      durationMs: Date.now() - start,
    }
  }
}

// ── #6.12 Tool Result Cache ──

export interface CacheEntry {
  output: ToolOutput
  timestamp: number
  hits: number
}

export interface ToolCacheConfig {
  /** 最大缓存条目数（默认 100） */
  maxSize: number
  /** 缓存 TTL ms（默认 5 分钟） */
  ttl: number
}

const DEFAULT_CACHE_CONFIG: ToolCacheConfig = {
  maxSize: 100,
  ttl: 5 * 60_000,
}

/**
 * LRU + TTL 工具结果缓存
 */
export class ToolResultCache {
  private cache: Map<string, CacheEntry>
  private config: ToolCacheConfig
  private stats = { hits: 0, misses: 0, evictions: 0 }

  constructor(config?: Partial<ToolCacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.cache = new Map()
  }

  /**
   * 生成缓存 key
   */
  private makeKey(toolName: string, input: Record<string, any>): string {
    // Sort keys for deterministic key generation
    const sortedInput = JSON.stringify(input, Object.keys(input).sort())
    return `${toolName}::${sortedInput}`
  }

  /**
   * 查询缓存
   */
  get(toolName: string, input: Record<string, any>): ToolOutput | null {
    const key = this.makeKey(toolName, input)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // LRU: move to end (most recent)
    this.cache.delete(key)
    entry.hits++
    this.cache.set(key, entry)

    this.stats.hits++
    return entry.output
  }

  /**
   * 写入缓存
   */
  set(toolName: string, input: Record<string, any>, output: ToolOutput): void {
    const key = this.makeKey(toolName, input)

    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      // Remove oldest (first entry in Map)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
        this.stats.evictions++
      }
    }

    this.cache.set(key, {
      output,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  /**
   * 手动使缓存失效（写入工具执行后调用）
   */
  invalidateByTool(toolName: string): number {
    let count = 0
    for (const [key] of this.cache) {
      if (key.startsWith(`${toolName}::`)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * 使所有缓存失效（文件系统变更后调用）
   */
  invalidateAll(): void {
    const size = this.cache.size
    this.cache.clear()
    this.stats.evictions += size
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number
    maxSize: number
    hits: number
    misses: number
    evictions: number
    hitRate: number
  } {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }

  /** 重置（测试用） */
  reset(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, evictions: 0 }
  }
}
