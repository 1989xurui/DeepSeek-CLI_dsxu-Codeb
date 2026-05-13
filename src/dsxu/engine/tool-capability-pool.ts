import type { ToolDefinition } from './types'
import { getCoreTools, getReadOnlyTools } from './builtin-tools'
import { getExtendedTools } from './extended-tools'
import { getDebugTools } from './debug-tools'
import { BlastRadiusTool } from './blast-radius'
import { AccessibilityTreeTool } from './accessibility-tree'

export type ToolCapabilityPoolName =
  | 'core'
  | 'read_only'
  | 'extended'
  | 'debug'
  | 'analysis'
  | 'full_absorb'
  | 'complete'

export function getToolCapabilityPool(name: ToolCapabilityPoolName): ToolDefinition[] {
  switch (name) {
    case 'core':
      return getCoreTools()
    case 'read_only':
      return getReadOnlyTools()
    case 'extended':
      return getExtendedTools()
    case 'debug':
      return getDebugTools()
    case 'analysis':
      return [BlastRadiusTool, AccessibilityTreeTool]
    case 'full_absorb':
      return dedupeToolsByName([
        ...getCoreTools(),
        ...getExtendedTools(),
        ...getDebugTools(),
        BlastRadiusTool,
        AccessibilityTreeTool,
      ])
    case 'complete':
      // V14 provider cleanup: complete only represents the DSXU-owned tool capability pool.
      return getToolCapabilityPool('full_absorb')
    default:
      return []
  }
}

export function getToolCapabilityPoolSnapshot(names: ToolCapabilityPoolName[]): Array<{
  pool: ToolCapabilityPoolName
  count: number
  toolNames: string[]
}> {
  return names.map(pool => {
    const tools = getToolCapabilityPool(pool)
    return {
      pool,
      count: tools.length,
      toolNames: tools.map(t => t.name).sort((a, b) => a.localeCompare(b)),
    }
  })
}

function dedupeToolsByName(tools: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>()
  const out: ToolDefinition[] = []
  for (const tool of tools) {
    const key = tool.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(tool)
  }
  return out
}
