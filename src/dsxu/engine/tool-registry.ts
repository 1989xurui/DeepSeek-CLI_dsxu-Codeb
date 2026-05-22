/**
 * DSXU engine tool registry.
 *
 * The registry owns lookup, schema caching, and batch execution for engine-level
 * tool calls. Production tools should come from the mainline `src/tools` stack
 * through adapters; built-in engine tools are only fallback implementations.
 */

import type {
  ToolDefinition,
  ToolSchema,
  ToolResult,
  ToolContext,
  ToolOwnershipMetadata,
  ToolRegistryProviderKind,
} from './types'

const MAINLINE_RUNTIME_CONTEXT = Symbol.for('dsxu.engine.mainlineRuntimeContext')

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private schemaCache: Map<string, ToolSchema> = new Map()
  private ownership: Map<string, ToolOwnershipMetadata> = new Map()

  register(tool: ToolDefinition, ownership?: Partial<ToolOwnershipMetadata>): void {
    const proof = normalizeToolOwnership(tool, ownership)
    tool.ownership = proof
    this.tools.set(tool.name, tool)
    this.ownership.set(tool.name, proof)
    this.schemaCache.delete(tool.name)
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) this.register(tool)
  }

  find(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getOwnership(name: string): ToolOwnershipMetadata | undefined {
    return this.ownership.get(name)
  }

  listOwnership(): ToolOwnershipMetadata[] {
    return [...this.ownership.values()].sort((a, b) => a.providerId.localeCompare(b.providerId))
  }

  buildOwnershipAudit(): {
    registryOwner: 'DSXU Tool Registry'
    registeredTools: number
    missingOwnership: string[]
    providerKinds: Record<ToolRegistryProviderKind, number>
    permissionBoundary: 'DSXU Tool Gate'
    runtimeBoundary: 'DSXU query-loop tool execution'
  } {
    const providerKinds: Record<ToolRegistryProviderKind, number> = {
      mainline: 0,
      mcp: 0,
      agent: 0,
      skill: 0,
      fallback: 0,
    }
    const missingOwnership: string[] = []

    for (const name of this.tools.keys()) {
      const proof = this.ownership.get(name)
      if (!proof) {
        missingOwnership.push(name)
        continue
      }
      providerKinds[proof.providerKind] += 1
    }

    return {
      registryOwner: 'DSXU Tool Registry',
      registeredTools: this.tools.size,
      missingOwnership,
      providerKinds,
      permissionBoundary: 'DSXU Tool Gate',
      runtimeBoundary: 'DSXU query-loop tool execution',
    }
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
        meta: {
          ...output.meta,
          toolOwnership: this.ownership.get(name),
        },
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
      this.ownership.delete(name)
      this.schemaCache.delete(name)
    }
    return existed
  }
}

function normalizeToolOwnership(
  tool: ToolDefinition,
  override?: Partial<ToolOwnershipMetadata>,
): ToolOwnershipMetadata {
  const providerKind = override?.providerKind ?? tool.ownership?.providerKind ?? inferProviderKind(tool.name)
  const ownerId =
    override?.ownerId ??
    tool.ownership?.ownerId ??
    (providerKind === 'mcp'
      ? 'mcp-skill-registry-owner'
      : providerKind === 'agent'
        ? 'agent-tool-lifecycle-owner'
        : providerKind === 'skill'
          ? 'mcp-skill-registry-owner'
          : 'query-loop-tool-gate-owner')
  const providerId =
    override?.providerId ??
    tool.ownership?.providerId ??
    (providerKind === 'mcp'
      ? `mcp:${tool.name}`
      : providerKind === 'agent'
        ? `agent:${tool.name}`
        : providerKind === 'skill'
          ? `skill:${tool.name}`
          : `mainline:${tool.name}`)

  return {
    ownerId,
    providerId,
    providerKind,
    registryOwner: 'DSXU Tool Registry',
    adapterBoundary:
      override?.adapterBoundary ??
      tool.ownership?.adapterBoundary ??
      (providerKind === 'mcp'
        ? 'DSXU MCP adapter boundary'
        : providerKind === 'agent'
          ? 'DSXU agent evidence envelope'
          : providerKind === 'skill'
            ? 'DSXU Skill adapter boundary'
            : 'DSXU mainline tool adapter boundary'),
    permissionBoundary:
      override?.permissionBoundary ??
      tool.ownership?.permissionBoundary ??
      'DSXU Tool Gate',
    runtimeBoundary:
      override?.runtimeBoundary ??
      tool.ownership?.runtimeBoundary ??
      'DSXU query-loop tool execution',
    evidenceIds: [
      ...new Set([
        ...(tool.ownership?.evidenceIds ?? []),
        ...(override?.evidenceIds ?? []),
        'tool-registry-owner-proof',
      ]),
    ],
    registeredAt: override?.registeredAt ?? tool.ownership?.registeredAt ?? new Date().toISOString(),
  }
}

function inferProviderKind(name: string): ToolRegistryProviderKind {
  const normalized = name.toLowerCase()
  if (normalized.startsWith('mcp__') || normalized.includes('mcp')) return 'mcp'
  if (normalized.includes('agent') || normalized.includes('fork')) return 'agent'
  if (normalized.includes('skill')) return 'skill'
  return 'mainline'
}

function sortKeysDeep(value: any): any {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const out: any = {}
  for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key])
  return out
}
