import type { ToolDefinition } from './tool-types-v1'
import type { DSXUExecutionTaskType } from './action-contract'
import {
  buildDSXUCapabilityRegistry,
  resolveDSXUToolCapabilityExposure,
  type DSXUCapabilityRegistry,
} from './capability-registry'
import {
  evaluateDSXUV8ToolWindowCount,
  resolveDSXUV8ToolWindowPolicy,
  resolveDSXUV8ToolWindowProfile,
  type DSXUV8ToolWindowProfile,
} from './tool-window-policy-v8'

export type ToolCatalog = {
  catalogId: string
  groups: Array<{
    groupId: string
    tools: ToolDefinition[]
  }>
  summary: {
    totalTools: number
    byReadWriteClass: Record<string, number>
    byExecutionMode: Record<string, number>
  }
  trace: {
    traceId: string
    createdAt: number
  }
}

export type DSXUToolViewProfile = DSXUV8ToolWindowProfile | 'code_reading'

export type DSXUToolViewCompilerResult = {
  schemaVersion: 'dsxu.tool-view.v5'
  owner: 'Tool Gate'
  profile: DSXUToolViewProfile
  visibleToolIds: readonly string[]
  hiddenToolIds: readonly string[]
  visibleToolCount: number
  maxVisibleTools: number
  evidence: readonly string[]
  guards: readonly string[]
}

export type DSXUToolViewExecutionDecision = {
  decision: 'allow' | 'deny'
  reason: string
  plannedToolId: string
  matchedVisibleToolId?: string
  evidence: readonly string[]
}

export type DSXUToolViewCompilerInput = {
  taskType: DSXUExecutionTaskType
  tools: Array<ToolDefinition | { tool: ToolDefinition } | string>
  maxVisibleTools?: number
  explicitAllowToolIds?: readonly string[]
  capabilityRegistry?: DSXUCapabilityRegistry
}

const TOOL_VIEW_ORDER: Record<DSXUToolViewProfile, readonly string[]> = {
  code_reading: ['Read', 'Grep', 'Glob', 'LSP', 'GitDiff', 'Evidence', 'Todo', 'ToolSearch'],
  explain: ['Read', 'Grep', 'Glob', 'LSP', 'GitDiff', 'Evidence', 'Todo', 'ToolSearch'],
  search: ['Grep', 'Glob', 'Read', 'LSP', 'GitDiff', 'Evidence', 'Todo', 'ToolSearch', 'Bash', 'PowerShell', 'Replay', 'Agent'],
  single_file_edit: ['Read', 'Edit', 'Write', 'Bash', 'PowerShell', 'Grep', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Todo', 'Replay', 'ToolSearch', 'Agent', 'FileHistory'],
  normal_coding: ['Read', 'Edit', 'Write', 'Bash', 'PowerShell', 'Grep', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Todo', 'Replay', 'ToolSearch', 'Agent', 'FileHistory'],
  debug: ['Read', 'Grep', 'Bash', 'PowerShell', 'Edit', 'Write', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Replay', 'Todo', 'ToolSearch', 'FileHistory', 'TaskOutput', 'Agent', 'CollectEvidence', 'AskUser', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch'],
  review: ['Read', 'Grep', 'Glob', 'GitDiff', 'Bash', 'PowerShell', 'Evidence', 'Replay', 'LSP', 'RunNativeTest', 'Todo', 'CollectEvidence', 'ToolSearch', 'Agent', 'MCPDocs', 'SkillRunner'],
  multi_file_refactor: ['Read', 'Grep', 'Glob', 'LSP', 'Edit', 'Write', 'Bash', 'PowerShell', 'GitDiff', 'RunNativeTest', 'Todo', 'Evidence', 'Replay', 'ToolSearch', 'Agent', 'TaskOutput', 'FileHistory', 'CollectEvidence', 'AskUser', 'NotebookEdit', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch'],
  long_task: ['Read', 'Grep', 'Glob', 'LSP', 'Todo', 'Agent', 'TaskOutput', 'Bash', 'PowerShell', 'Edit', 'Write', 'GitDiff', 'RunNativeTest', 'Evidence', 'Replay', 'CollectEvidence', 'ToolSearch', 'FileHistory', 'AskUser', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'NotebookEdit', 'TerminalCapture', 'TaskCreate', 'TaskUpdate'],
  benchmark: ['Bash', 'PowerShell', 'Replay', 'Evidence', 'CollectEvidence', 'Read', 'Grep', 'Glob', 'GitDiff', 'RunNativeTest', 'Todo', 'ToolSearch', 'Agent', 'TaskOutput', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'TerminalCapture', 'AskUser', 'FileHistory', 'Edit', 'Write', 'LSP'],
  provider_security_release: ['Read', 'Grep', 'Glob', 'GitDiff', 'Bash', 'PowerShell', 'RunNativeTest', 'Evidence', 'CollectEvidence', 'Replay', 'Todo', 'ToolSearch', 'Agent', 'TaskOutput', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'FileHistory', 'AskUser', 'LSP', 'Edit', 'Write', 'TerminalCapture', 'TaskCreate', 'TaskUpdate', 'NotebookEdit'],
  pro_expert: ['Read', 'Grep', 'Glob', 'LSP', 'GitDiff', 'Bash', 'PowerShell', 'RunNativeTest', 'Evidence', 'CollectEvidence', 'Replay', 'Todo', 'Agent', 'TaskOutput', 'ToolSearch', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'FileHistory', 'AskUser', 'Edit', 'Write', 'NotebookEdit'],
}

function profileForTaskType(taskType: DSXUExecutionTaskType): DSXUToolViewProfile {
  return resolveDSXUV8ToolWindowProfile({ taskType })
}

function getToolId(item: ToolDefinition | { tool: ToolDefinition } | string): string {
  if (typeof item === 'string') return item
  return 'tool' in item ? item.tool.toolId : item.toolId
}

function normalizeToolId(toolId: string): string {
  return toolId.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function toolMatchesLogical(toolId: string, logicalName: string): boolean {
  const normalizedTool = normalizeToolId(toolId)
  const normalizedLogical = normalizeToolId(logicalName)
  return (
    normalizedTool === normalizedLogical ||
    normalizedTool.endsWith(normalizedLogical) ||
    normalizedTool.includes(normalizedLogical)
  )
}

export function validateDSXUPlannedToolInView(input: {
  view: DSXUToolViewCompilerResult
  plannedToolId: string
}): DSXUToolViewExecutionDecision {
  const plannedToolId = input.plannedToolId.trim()
  const matchedVisibleToolId = input.view.visibleToolIds.find(toolId =>
    toolMatchesLogical(toolId, plannedToolId) || toolMatchesLogical(plannedToolId, toolId),
  )
  if (matchedVisibleToolId) {
    return {
      decision: 'allow',
      reason: 'planned tool is present in current DSXU Tool View',
      plannedToolId,
      matchedVisibleToolId,
      evidence: [
        `schema:${input.view.schemaVersion}`,
        `profile:${input.view.profile}`,
        `plannedTool:${plannedToolId}`,
        `matchedVisibleTool:${matchedVisibleToolId}`,
      ],
    }
  }
  return {
    decision: 'deny',
    reason: 'planned tool is outside current DSXU Tool View and must be recompiled or explicitly allowed before execution',
    plannedToolId,
    evidence: [
      `schema:${input.view.schemaVersion}`,
      `profile:${input.view.profile}`,
      `plannedTool:${plannedToolId}`,
      `visibleTools:${input.view.visibleToolIds.join('|')}`,
      `hiddenTools:${input.view.hiddenToolIds.join('|')}`,
    ],
  }
}

function isNonDefaultToolExposure(toolId: string, registry: DSXUCapabilityRegistry): boolean {
  return ['searchable', 'expert', 'experiment', 'frozen', 'legacy'].includes(
    resolveDSXUToolCapabilityExposure(toolId, registry),
  )
}

export function compileDSXUToolView(
  input: DSXUToolViewCompilerInput,
): DSXUToolViewCompilerResult {
  const profile = profileForTaskType(input.taskType)
  const policy = resolveDSXUV8ToolWindowPolicy({ taskType: input.taskType })
  const maxVisibleTools = Math.max(
    policy.minVisibleTools,
    Math.min(input.maxVisibleTools ?? policy.defaultVisibleTools, policy.maxVisibleTools),
  )
  const requestedOrder = TOOL_VIEW_ORDER[profile]
  const allToolIds = [...new Set(input.tools.map(getToolId).filter(Boolean))]
  const explicitAllow = new Set(input.explicitAllowToolIds ?? [])
  const registry = input.capabilityRegistry ?? buildDSXUCapabilityRegistry()
  const isSelectable = (toolId: string) =>
    explicitAllow.has(toolId) || !isNonDefaultToolExposure(toolId, registry)
  const selected: string[] = []

  for (const logicalName of requestedOrder) {
    const match = allToolIds.find(toolId =>
      !selected.includes(toolId) &&
      isSelectable(toolId) &&
      toolMatchesLogical(toolId, logicalName)
    )
    if (match) selected.push(match)
    if (selected.length >= maxVisibleTools) break
  }

  for (const toolId of allToolIds) {
    if (selected.length >= maxVisibleTools) break
    if (selected.includes(toolId)) continue
    if (!isSelectable(toolId)) continue
    selected.push(toolId)
  }

  const hiddenToolIds = allToolIds.filter(toolId => !selected.includes(toolId))
  const countDecision = evaluateDSXUV8ToolWindowCount({
    visibleToolCount: selected.length,
    policy,
    actualToolPoolCount: allToolIds.filter(isSelectable).length,
  })
  const guards = [
    ...countDecision.guards,
    selected.some(toolId => isNonDefaultToolExposure(toolId, registry) && !explicitAllow.has(toolId))
      ? 'frozen/searchable tool exposed without explicit allow'
      : '',
  ].filter(Boolean)

  return {
    schemaVersion: 'dsxu.tool-view.v5',
    owner: 'Tool Gate',
    profile,
    visibleToolIds: selected,
    hiddenToolIds,
    visibleToolCount: selected.length,
    maxVisibleTools,
    evidence: [
      `profile:${profile}`,
      `visibleToolCount:${selected.length}`,
      `hiddenToolCount:${hiddenToolIds.length}`,
      `maxVisibleTools:${maxVisibleTools}`,
      `v8Policy:${policy.profile}`,
      `v8PolicyDefault:${policy.defaultVisibleTools}`,
      `order:${selected.join('>')}`,
    ],
    guards,
  }
}

export function buildToolCatalog(
  catalogId: string,
  tools: Array<ToolDefinition | { tool: ToolDefinition }>
): ToolCatalog {
  const byReadWriteClass: Record<string, number> = {}
  const byExecutionMode: Record<string, number> = {}
  const groups = new Map<string, ToolDefinition[]>()

  for (const item of tools) {
    const tool = 'tool' in item ? item.tool : item
    byReadWriteClass[tool.readWriteClass] = (byReadWriteClass[tool.readWriteClass] ?? 0) + 1
    byExecutionMode[tool.executionMode] = (byExecutionMode[tool.executionMode] ?? 0) + 1
    const groupId = tool.capabilityTags[0] ?? 'uncategorized'
    groups.set(groupId, [...(groups.get(groupId) ?? []), tool])
  }

  return {
    catalogId,
    groups: Array.from(groups.entries()).map(([groupId, groupTools]) => ({
      groupId,
      tools: groupTools,
    })),
    summary: {
      totalTools: tools.length,
      byReadWriteClass,
      byExecutionMode,
    },
    trace: {
      traceId: `${catalogId}-${Date.now().toString(36)}`,
      createdAt: Date.now(),
    },
  }
}
