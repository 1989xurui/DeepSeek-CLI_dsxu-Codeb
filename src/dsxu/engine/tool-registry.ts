/**
 * DSxu 工具注册表（Tool Registry）
 *
 * 管理所有可用工具的注册、查找、Schema 生成。
 * 学 Claude 架构：工具是纯对象，按名称查找，Schema 缓存保护 prefix cache。
 *
 * 设计决策：
 * - 不一次性注入全量工具 → 按任务类型动态注入 8-12 个
 * - Schema 排序稳定 → 保护 DeepSeek prefix cache
 * - 并发安全标记 → 读工具并发，写工具串行
 */

import type { ToolDefinition, ToolSchema, ToolResult, ToolContext, ToolOutput } from './types'

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private schemaCache: Map<string, ToolSchema> = new Map()

  /** 注册单个工具 */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    this.schemaCache.delete(tool.name)  // 清缓存
  }

  /** 批量注册 */
  registerAll(tools: ToolDefinition[]): void {
    for (const t of tools) this.register(t)
  }

  /** 按名称查找工具 */
  find(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /** 获取所有已启用的工具 Schema（排序稳定，保护 prefix cache） */
  getSchemas(filter?: (tool: ToolDefinition) => boolean): ToolSchema[] {
    const result: ToolSchema[] = []

    for (const [name, tool] of this.tools) {
      // 检查启用状态
      if (tool.isEnabled && !tool.isEnabled()) continue
      // 应用外部过滤器
      if (filter && !filter(tool)) continue

      // 使用缓存的 schema
      let schema = this.schemaCache.get(name)
      if (!schema) {
        schema = {
          name: tool.name,
          description: tool.description,
          inputSchema: sortKeysDeep(tool.inputSchema),
        }
        this.schemaCache.set(name, schema)
      }
      result.push(schema)
    }

    // 按名称排序 → 保护 DeepSeek prefix cache
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

  /** 执行工具 */
  async execute(
    name: string,
    input: Record<string, any>,
    toolUseId: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        toolUseId,
        content: `Tool "${name}" not found. Available tools: ${[...this.tools.keys()].join(', ')}`,
        isError: true,
      }
    }

    try {
      const output = await tool.execute(input, { ...context, toolUseId })
      return {
        toolUseId,
        content: output.content,
        isError: output.isError ?? false,
      }
    } catch (error: any) {
      return {
        toolUseId,
        content: `Tool "${name}" threw error: ${error.message}`,
        isError: true,
      }
    }
  }

  /** 批量执行（考虑并发安全） */
  async executeBatch(
    calls: Array<{ name: string; input: Record<string, any>; toolUseId: string }>,
    context: ToolContext,
  ): Promise<ToolResult[]> {
    // 分区：并发安全 vs 串行
    const concurrent: typeof calls = []
    const serial: typeof calls = []

    for (const call of calls) {
      const tool = this.tools.get(call.name)
      if (tool?.concurrencySafe) {
        concurrent.push(call)
      } else {
        serial.push(call)
      }
    }

    const results: ToolResult[] = []

    // 并发安全的工具并行执行
    if (concurrent.length > 0) {
      const concurrentResults = await Promise.all(
        concurrent.map(c => this.execute(c.name, c.input, c.toolUseId, context))
      )
      results.push(...concurrentResults)
    }

    // 非并发安全的工具串行执行
    for (const call of serial) {
      const result = await this.execute(call.name, call.input, call.toolUseId, context)
      results.push(result)
    }

    return results
  }

  /** 获取已注册工具数量 */
  get size(): number {
    return this.tools.size
  }

  /** 获取所有工具名称 */
  get names(): string[] {
    return [...this.tools.keys()].sort()
  }

  /** 获取所有工具定义 */
  getAll(): ToolDefinition[] {
    const result: ToolDefinition[] = []
    for (const [, tool] of this.tools) {
      result.push(tool)
    }
    return result
  }

  /** 取消注册工具 */
  unregister(name: string): boolean {
    const existed = this.tools.has(name)
    if (existed) {
      this.tools.delete(name)
      this.schemaCache.delete(name)
    }
    return existed
  }
}

/** 确定性键排序（保护 prefix cache） */
function sortKeysDeep(v: any): any {
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  const out: any = {}
  for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k])
  return out
}
