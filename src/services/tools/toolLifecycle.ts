import type { ToolUseBlock } from 'src/types/providerSdk.js'
import type { ToolResultBlockParam } from 'src/types/providerSdk.js'
import { posix, win32 } from 'path'
import type { Tool } from '../../Tool.js'
import { traceDsxuLifecycle } from '../../utils/dsxuLifecycleTrace.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { DsxuToolBatchGateDecision } from './dsxuToolBatchGate.js'

export type DsxuToolLifecycleGateTraceEvent =
  | 'tool_batch_gate_advisory'
  | 'tool_batch_gate_blocked'
  | 'streaming_tool_gate_advisory'
  | 'streaming_tool_blocked'

export type DsxuToolExecutionSemantics = {
  toolFound: boolean
  inputParsed: boolean
  isConcurrencySafe: boolean
  isReadOnly: boolean
  isDestructive: boolean
  inputError?: string
}

export type DsxuToolLifecyclePermissionDecision = {
  toolUseID: string
  toolName: string
  permissionMode: string
  behavior: string
  source: string
  durationMs: number
  blocked: boolean
}

export type DsxuToolPathLifecycle = {
  cwd: string
  rawPath?: string
  normalizedPath?: string
  relativePath?: string
  isInsideCwd?: boolean
}

export type DsxuToolResultLifecycleMapping = {
  block: ToolResultBlockParam
  sizeBytes: number
  contentKind: 'empty' | 'text' | 'blocks' | 'other'
}

function safelyBoolean(read: () => boolean): boolean {
  try {
    return Boolean(read())
  } catch {
    return false
  }
}

function getPathApi(cwd: string, rawPath?: string): typeof win32 | typeof posix {
  if (/^[a-zA-Z]:[\\/]/.test(cwd) || /^[a-zA-Z]:[\\/]/.test(rawPath ?? '')) {
    return win32
  }
  if (cwd.includes('\\') || (rawPath ?? '').includes('\\')) {
    return win32
  }
  return posix
}

function normalizePathForTrace(path: string): string {
  return path.replace(/\\/g, '/')
}

function getContentKind(
  content: ToolResultBlockParam['content'],
): DsxuToolResultLifecycleMapping['contentKind'] {
  if (!content) return 'empty'
  if (typeof content === 'string') return content.length > 0 ? 'text' : 'empty'
  if (Array.isArray(content)) return content.length > 0 ? 'blocks' : 'empty'
  return 'other'
}

function getContentSizeBytes(content: ToolResultBlockParam['content']): number {
  if (!content) return 0
  if (typeof content === 'string') return content.length
  return jsonStringify(content).length
}

export function getDsxuToolExecutionSemantics(
  tool: Tool | undefined,
  input: unknown,
): DsxuToolExecutionSemantics {
  if (!tool) {
    return {
      toolFound: false,
      inputParsed: false,
      isConcurrencySafe: false,
      isReadOnly: false,
      isDestructive: false,
      inputError: 'tool_not_found',
    }
  }
  const parsedInput = tool.inputSchema.safeParse(input)
  if (!parsedInput.success) {
    return {
      toolFound: true,
      inputParsed: false,
      isConcurrencySafe: false,
      isReadOnly: false,
      isDestructive: false,
      inputError: parsedInput.error.message,
    }
  }
  return {
    toolFound: true,
    inputParsed: true,
    isConcurrencySafe: safelyBoolean(() =>
      tool.isConcurrencySafe(parsedInput.data),
    ),
    isReadOnly: safelyBoolean(() => tool.isReadOnly(parsedInput.data)),
    isDestructive: safelyBoolean(() =>
      tool.isDestructive ? tool.isDestructive(parsedInput.data) : false,
    ),
  }
}

export function getDsxuToolPathLifecycle(
  tool: Tool | undefined,
  input: unknown,
  cwd: string,
): DsxuToolPathLifecycle {
  const normalizedCwd = normalizePathForTrace(cwd)
  if (!tool?.getPath) {
    return { cwd: normalizedCwd }
  }
  let rawPath: string | undefined
  try {
    rawPath = tool.getPath(input as Record<string, unknown>)
  } catch {
    return { cwd: normalizedCwd }
  }
  if (!rawPath) {
    return { cwd: normalizedCwd }
  }
  const pathApi = getPathApi(cwd, rawPath)
  const absolutePath = pathApi.isAbsolute(rawPath)
    ? rawPath
    : pathApi.resolve(cwd, rawPath)
  const relativePath = pathApi.relative(cwd, absolutePath) || '.'
  const isInsideCwd =
    relativePath === '.' ||
    (!relativePath.startsWith('..') && !pathApi.isAbsolute(relativePath))
  return {
    cwd: normalizedCwd,
    rawPath: normalizePathForTrace(rawPath),
    normalizedPath: normalizePathForTrace(absolutePath),
    relativePath: normalizePathForTrace(relativePath),
    isInsideCwd,
  }
}

export function mapDsxuToolResultForLifecycle<T>(
  tool: Tool<never, T>,
  toolUseResult: T,
  toolUseID: string,
): DsxuToolResultLifecycleMapping {
  const block = tool.mapToolResultToToolResultBlockParam(
    toolUseResult,
    toolUseID,
  )
  return {
    block,
    sizeBytes: getContentSizeBytes(block.content),
    contentKind: getContentKind(block.content),
  }
}

export function traceDsxuToolLifecycleGateDecision(
  event: DsxuToolLifecycleGateTraceEvent,
  toolUse: ToolUseBlock,
  decision: DsxuToolBatchGateDecision,
): void {
  traceDsxuLifecycle(event, {
    toolUseID: toolUse.id,
    toolName: toolUse.name,
    reason: decision.reason,
    owner: decision.owner,
    gateId: decision.gateId,
    gateKind: decision.gateKind,
    gateClass: decision.gateClass,
    blocked: decision.blocked,
    nextAction: decision.nextAction,
  })
}

export function traceDsxuToolLifecyclePath(
  toolUseID: string,
  toolName: string,
  path: DsxuToolPathLifecycle,
): void {
  traceDsxuLifecycle('tool_path_lifecycle', {
    toolUseID,
    toolName,
    cwd: path.cwd,
    rawPath: path.rawPath,
    normalizedPath: path.normalizedPath,
    relativePath: path.relativePath,
    isInsideCwd: path.isInsideCwd,
  })
}

export function traceDsxuToolLifecyclePermissionDecision(
  decision: DsxuToolLifecyclePermissionDecision,
): void {
  traceDsxuLifecycle('tool_permission_decision', {
    toolUseID: decision.toolUseID,
    toolName: decision.toolName,
    permissionMode: decision.permissionMode,
    behavior: decision.behavior,
    source: decision.source,
    durationMs: decision.durationMs,
    blocked: decision.blocked,
  })
}

export function traceDsxuToolLifecycleProgress(
  toolUseID: string,
  parentToolUseID: string,
  toolName: string,
  progressData: unknown,
): void {
  const progressType =
    progressData &&
    typeof progressData === 'object' &&
    'type' in progressData
      ? String(progressData.type)
      : undefined
  traceDsxuLifecycle('tool_progress_lifecycle', {
    toolUseID,
    parentToolUseID,
    toolName,
    progressType,
  })
}

export function traceDsxuToolLifecycleResultMapping(
  toolUseID: string,
  toolName: string,
  mapping: DsxuToolResultLifecycleMapping,
): void {
  traceDsxuLifecycle('tool_result_mapping_lifecycle', {
    toolUseID,
    toolName,
    sizeBytes: mapping.sizeBytes,
    contentKind: mapping.contentKind,
    isError: mapping.block.is_error === true,
  })
}
