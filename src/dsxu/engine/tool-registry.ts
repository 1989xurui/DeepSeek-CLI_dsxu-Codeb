/**
 * DSXU engine tool registry.
 *
 * The registry owns lookup, schema caching, and batch execution for engine-level
 * tool calls. Production tools should come from the mainline `src/tools` stack
 * through adapters; built-in engine tools are only fallback implementations.
 */

import type { ToolDefinition, ToolSchema, ToolResult, ToolContext } from './types'

const MAINLINE_RUNTIME_CONTEXT = Symbol.for('dsxu.engine.mainlineRuntimeContext')

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private schemaCache: Map<string, ToolSchema> = new Map()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    this.schemaCache.delete(tool.name)
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) this.register(tool)
  }

  find(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getSchemas(filter?: (tool: ToolDefinition) => boolean): ToolSchema[] {
    const result: ToolSchema[] = []

    for (const [name, tool] of this.tools) {
      if (tool.isEnabled && !tool.isEnabled()) continue
      if (filter && !filter(tool)) continue

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

    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

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
      const executionContext = { ...context, toolUseId } as ToolContext & {
        [MAINLINE_RUNTIME_CONTEXT]?: ToolContext
      }
      Object.defineProperty(executionContext, MAINLINE_RUNTIME_CONTEXT, {
        value: context,
        enumerable: false,
      })
      const output = await tool.execute(input, executionContext)
      return {
        toolUseId,
        content: output.content,
        isError: output.isError ?? false,
        meta: output.meta,
      }
    } catch (error: any) {
      return {
        toolUseId,
        content: `Tool "${name}" threw error: ${error.message}`,
        isError: true,
      }
    }
  }

  async executeBatch(
    calls: Array<{ name: string; input: Record<string, any>; toolUseId: string }>,
    context: ToolContext,
  ): Promise<ToolResult[]> {
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

    if (concurrent.length > 0) {
      const concurrentResults = await Promise.all(
        concurrent.map(call => this.execute(call.name, call.input, call.toolUseId, context)),
      )
      results.push(...concurrentResults)
    }

    for (const call of serial) {
      const result = await this.execute(call.name, call.input, call.toolUseId, context)
      results.push(result)
    }

    return results
  }

  get size(): number {
    return this.tools.size
  }

  get names(): string[] {
    return [...this.tools.keys()].sort()
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()]
  }

  unregister(name: string): boolean {
    const existed = this.tools.has(name)
    if (existed) {
      this.tools.delete(name)
      this.schemaCache.delete(name)
    }
    return existed
  }
}

function sortKeysDeep(value: any): any {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const out: any = {}
  for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key])
  return out
}
