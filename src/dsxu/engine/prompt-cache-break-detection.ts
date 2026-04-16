import type { LLMResponse, ToolSchema } from './types'

const MAX_TRACKED_SOURCES = 10
const MIN_CACHE_MISS_TOKENS = 2_000
const CACHE_TTL_5MIN_MS = 5 * 60 * 1000
const CACHE_TTL_1H_MS = 60 * 60 * 1000

// 缓存中断检测配置
const CACHE_BREAK_DETECTION_CONFIG = {
  // 最小token下降阈值（低于此值不视为缓存中断）
  minTokenDrop: MIN_CACHE_MISS_TOKENS,
  // 相对下降阈值（95% = 下降5%以上才视为中断）
  relativeDropThreshold: 0.95,
  // 是否启用详细日志
  verboseLogging: true,
  // 是否与token估算偏差检测集成
  integrateWithTokenEstimator: true,
}

export interface PromptStateSnapshot {
  querySource: string
  systemPrompt: string
  toolSchemas: ToolSchema[]
  model: string
  fastMode?: boolean
  cacheStrategy?: string
  betas?: readonly string[]
  effortValue?: string | number
  extraBodyParams?: unknown
}

export interface CacheBreakCheckInput {
  querySource: string
  usage: LLMResponse['usage']
  /** Optional elapsed time since previous assistant message. */
  sinceLastAssistantMs?: number | null
}

export interface PromptStateChanges {
  systemPromptChanged: boolean
  toolSchemasChanged: boolean
  modelChanged: boolean
  fastModeChanged: boolean
  cacheStrategyChanged: boolean
  betasChanged: boolean
  effortChanged: boolean
  extraBodyChanged: boolean
  addedToolCount: number
  removedToolCount: number
  systemCharDelta: number
  changedToolSchemas: string[]
}

export interface CacheBreakReport {
  querySource: string
  reason: string
  callNumber: number
  prevCacheReadTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  tokenDrop: number
  changes: PromptStateChanges | null
}

type PendingChanges = PromptStateChanges & {
  previousModel: string
  newModel: string
  previousCacheStrategy: string
  newCacheStrategy: string
  previousEffort: string
  newEffort: string
}

type PreviousState = {
  systemHash: number
  toolsHash: number
  perToolHashes: Record<string, number>
  toolNames: string[]
  systemCharCount: number
  model: string
  fastMode: boolean
  cacheStrategy: string
  betas: string[]
  effortValue: string
  extraBodyHash: number
  callCount: number
  pendingChanges: PendingChanges | null
  prevCacheReadTokens: number | null
  compactionPending: boolean
}

const previousStateBySource = new Map<string, PreviousState>()

function computeHash(data: unknown): number {
  const str = JSON.stringify(data)
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
  }
  return hash >>> 0
}

function computePerToolHashes(toolSchemas: ToolSchema[]): Record<string, number> {
  const hashes: Record<string, number> = {}
  for (const tool of toolSchemas) {
    hashes[tool.name] = computeHash({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })
  }
  return hashes
}

function buildChangeReason(
  changes: PendingChanges | null,
  sinceLastAssistantMs: number | null | undefined,
): string {
  const parts: string[] = []

  if (changes) {
    if (changes.modelChanged) {
      parts.push(`model changed (${changes.previousModel} -> ${changes.newModel})`)
    }
    if (changes.systemPromptChanged) {
      if (changes.systemCharDelta === 0) {
        parts.push('system prompt changed')
      } else {
        parts.push(`system prompt changed (${changes.systemCharDelta > 0 ? '+' : ''}${changes.systemCharDelta} chars)`)
      }
    }
    if (changes.toolSchemasChanged) {
      if (changes.addedToolCount || changes.removedToolCount) {
        parts.push(`tools changed (+${changes.addedToolCount}/-${changes.removedToolCount})`)
      } else {
        parts.push('tool schema changed')
      }
    }
    if (changes.fastModeChanged) parts.push('fast mode toggled')
    if (changes.cacheStrategyChanged) {
      parts.push(`cache strategy changed (${changes.previousCacheStrategy || 'none'} -> ${changes.newCacheStrategy || 'none'})`)
    }
    if (changes.betasChanged) parts.push('betas changed')
    if (changes.effortChanged) {
      parts.push(`effort changed (${changes.previousEffort || 'default'} -> ${changes.newEffort || 'default'})`)
    }
    if (changes.extraBodyChanged) parts.push('extra body params changed')
  }

  if (parts.length > 0) return parts.join(', ')
  if (sinceLastAssistantMs !== null && sinceLastAssistantMs !== undefined) {
    if (sinceLastAssistantMs > CACHE_TTL_1H_MS) return 'possible 1h TTL expiry (prompt unchanged)'
    if (sinceLastAssistantMs > CACHE_TTL_5MIN_MS) return 'possible 5min TTL expiry (prompt unchanged)'
    return 'likely server-side (prompt unchanged, <5min gap)'
  }
  return 'unknown cause'
}

// 日志记录函数
function logCacheBreakDetection(message: string, data?: any): void {
  if (CACHE_BREAK_DETECTION_CONFIG.verboseLogging) {
    const timestamp = new Date().toISOString()
    const logMessage = `[CacheBreakDetection] ${timestamp} ${message}`

    if (data) {
      console.warn(logMessage, data)
    } else {
      console.warn(logMessage)
    }
  }
}

// 与token估算偏差检测集成
function checkTokenEstimatorIntegration(report: CacheBreakReport): void {
  if (CACHE_BREAK_DETECTION_CONFIG.integrateWithTokenEstimator) {
    // 这里可以添加与token估算偏差检测的集成逻辑
    // 例如：记录缓存中断时的token使用模式
    logCacheBreakDetection('Token estimator integration check', {
      querySource: report.querySource,
      tokenDrop: report.tokenDrop,
      reason: report.reason,
      callNumber: report.callNumber,
    })
  }
}

export function recordPromptState(snapshot: PromptStateSnapshot): void {
  const key = snapshot.querySource
  if (!key) return

  const systemHash = computeHash(snapshot.systemPrompt)
  const toolsHash = computeHash(snapshot.toolSchemas)
  const toolNames = snapshot.toolSchemas.map(t => t.name)
  const perToolHashes = computePerToolHashes(snapshot.toolSchemas)
  const systemCharCount = snapshot.systemPrompt.length
  const fastMode = snapshot.fastMode ?? false
  const cacheStrategy = snapshot.cacheStrategy ?? ''
  const betas = [...(snapshot.betas ?? [])].sort()
  const effortValue = snapshot.effortValue === undefined ? '' : String(snapshot.effortValue)
  const extraBodyHash = snapshot.extraBodyParams === undefined ? 0 : computeHash(snapshot.extraBodyParams)

  const prev = previousStateBySource.get(key)
  if (!prev) {
    while (previousStateBySource.size >= MAX_TRACKED_SOURCES) {
      const oldest = previousStateBySource.keys().next().value
      if (oldest === undefined) break
      previousStateBySource.delete(oldest)
    }
    previousStateBySource.set(key, {
      systemHash,
      toolsHash,
      perToolHashes,
      toolNames,
      systemCharCount,
      model: snapshot.model,
      fastMode,
      cacheStrategy,
      betas,
      effortValue,
      extraBodyHash,
      callCount: 1,
      pendingChanges: null,
      prevCacheReadTokens: null,
      compactionPending: false,
    })

    logCacheBreakDetection('New query source registered', {
      querySource: key,
      model: snapshot.model,
      toolCount: toolNames.length,
      systemCharCount,
      fastMode,
      cacheStrategy,
    })
    return
  }

  prev.callCount++

  const systemPromptChanged = systemHash !== prev.systemHash
  const toolSchemasChanged = toolsHash !== prev.toolsHash
  const modelChanged = snapshot.model !== prev.model
  const fastModeChanged = fastMode !== prev.fastMode
  const cacheStrategyChanged = cacheStrategy !== prev.cacheStrategy
  const betasChanged = betas.length !== prev.betas.length || betas.some((b, i) => b !== prev.betas[i])
  const effortChanged = effortValue !== prev.effortValue
  const extraBodyChanged = extraBodyHash !== prev.extraBodyHash

  const hasChanges = systemPromptChanged ||
    toolSchemasChanged ||
    modelChanged ||
    fastModeChanged ||
    cacheStrategyChanged ||
    betasChanged ||
    effortChanged ||
    extraBodyChanged

  if (hasChanges) {
    const prevToolSet = new Set(prev.toolNames)
    const newToolSet = new Set(toolNames)
    const changedToolSchemas: string[] = []
    if (toolSchemasChanged) {
      for (const name of toolNames) {
        if (prevToolSet.has(name) && perToolHashes[name] !== prev.perToolHashes[name]) {
          changedToolSchemas.push(name)
        }
      }
    }
    prev.pendingChanges = {
      systemPromptChanged,
      toolSchemasChanged,
      modelChanged,
      fastModeChanged,
      cacheStrategyChanged,
      betasChanged,
      effortChanged,
      extraBodyChanged,
      addedToolCount: toolNames.filter(n => !prevToolSet.has(n)).length,
      removedToolCount: prev.toolNames.filter(n => !newToolSet.has(n)).length,
      systemCharDelta: systemCharCount - prev.systemCharCount,
      changedToolSchemas,
      previousModel: prev.model,
      newModel: snapshot.model,
      previousCacheStrategy: prev.cacheStrategy,
      newCacheStrategy: cacheStrategy,
      previousEffort: prev.effortValue,
      newEffort: effortValue,
    }

    // 记录状态变化
    logCacheBreakDetection('Prompt state changed', {
      querySource: key,
      callNumber: prev.callCount,
      changes: {
        systemPromptChanged,
        toolSchemasChanged,
        modelChanged,
        fastModeChanged,
        cacheStrategyChanged,
        betasChanged,
        effortChanged,
        extraBodyChanged,
        addedToolCount: prev.pendingChanges.addedToolCount,
        removedToolCount: prev.pendingChanges.removedToolCount,
        systemCharDelta: prev.pendingChanges.systemCharDelta,
      },
    })
  } else {
    prev.pendingChanges = null
  }

  prev.systemHash = systemHash
  prev.toolsHash = toolsHash
  prev.perToolHashes = perToolHashes
  prev.toolNames = toolNames
  prev.systemCharCount = systemCharCount
  prev.model = snapshot.model
  prev.fastMode = fastMode
  prev.cacheStrategy = cacheStrategy
  prev.betas = betas
  prev.effortValue = effortValue
  prev.extraBodyHash = extraBodyHash
}

export function checkResponseForCacheBreak(input: CacheBreakCheckInput): CacheBreakReport | null {
  const state = previousStateBySource.get(input.querySource)
  if (!state) return null
  if (!input.usage) return null

  const cacheReadTokens = input.usage.cacheReadTokens ?? (input.usage.cacheHit ? input.usage.inputTokens : 0)
  const cacheCreationTokens = input.usage.cacheCreationTokens ?? 0
  const prevCacheRead = state.prevCacheReadTokens
  state.prevCacheReadTokens = cacheReadTokens

  if (prevCacheRead === null) {
    logCacheBreakDetection('First cache read for query source', {
      querySource: input.querySource,
      cacheReadTokens,
      callNumber: state.callCount,
    })
    return null
  }

  if (state.compactionPending) {
    logCacheBreakDetection('Skipping cache break detection due to compaction', {
      querySource: input.querySource,
    })
    state.compactionPending = false
    state.pendingChanges = null
    return null
  }

  const tokenDrop = prevCacheRead - cacheReadTokens
  const relativeDrop = cacheReadTokens / prevCacheRead

  if (cacheReadTokens >= prevCacheRead * CACHE_BREAK_DETECTION_CONFIG.relativeDropThreshold ||
      tokenDrop < CACHE_BREAK_DETECTION_CONFIG.minTokenDrop) {
    logCacheBreakDetection('No significant cache break detected', {
      querySource: input.querySource,
      prevCacheRead,
      cacheReadTokens,
      tokenDrop,
      relativeDrop: (relativeDrop * 100).toFixed(1) + '%',
      threshold: CACHE_BREAK_DETECTION_CONFIG.relativeDropThreshold,
    })
    state.pendingChanges = null
    return null
  }

  const reason = buildChangeReason(state.pendingChanges, input.sinceLastAssistantMs)

  const report: CacheBreakReport = {
    querySource: input.querySource,
    reason,
    callNumber: state.callCount,
    prevCacheReadTokens: prevCacheRead,
    cacheReadTokens,
    cacheCreationTokens,
    tokenDrop,
    changes: state.pendingChanges
      ? {
          systemPromptChanged: state.pendingChanges.systemPromptChanged,
          toolSchemasChanged: state.pendingChanges.toolSchemasChanged,
          modelChanged: state.pendingChanges.modelChanged,
          fastModeChanged: state.pendingChanges.fastModeChanged,
          cacheStrategyChanged: state.pendingChanges.cacheStrategyChanged,
          betasChanged: state.pendingChanges.betasChanged,
          effortChanged: state.pendingChanges.effortChanged,
          extraBodyChanged: state.pendingChanges.extraBodyChanged,
          addedToolCount: state.pendingChanges.addedToolCount,
          removedToolCount: state.pendingChanges.removedToolCount,
          systemCharDelta: state.pendingChanges.systemCharDelta,
          changedToolSchemas: [...state.pendingChanges.changedToolSchemas],
        }
      : null,
  }

  // 记录缓存中断事件
  logCacheBreakDetection('Cache break detected', {
    querySource: report.querySource,
    reason: report.reason,
    tokenDrop: report.tokenDrop,
    relativeDrop: (relativeDrop * 100).toFixed(1) + '%',
    prevCacheRead: report.prevCacheReadTokens,
    currentCacheRead: report.cacheReadTokens,
    callNumber: report.callNumber,
  })

  // 与token估算偏差检测集成
  checkTokenEstimatorIntegration(report)

  state.pendingChanges = null
  return report
}

export function notifyCompaction(querySource: string): void {
  const state = previousStateBySource.get(querySource)
  if (!state) return
  state.compactionPending = true
  state.prevCacheReadTokens = null
}

export function cleanupQuerySourceTracking(querySource: string): void {
  previousStateBySource.delete(querySource)
}

export function resetPromptCacheBreakDetection(): void {
  previousStateBySource.clear()
}
