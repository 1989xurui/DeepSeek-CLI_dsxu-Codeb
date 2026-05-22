import { isRetryableError } from './retry'
import { buildDSXUContextPressureDecision } from './context-pressure-matrix'
import {
  estimateDeepSeekToolResultTokens,
  getDeepSeekToolResultPressureSize,
} from '../../utils/toolResultStorage'

export type DSXUReasonixContextPressureProofRow = {
  contextUsedPercent: number
  bucket: string
  recommendedAction: string
  cachePolicy: string
  sourceTruthReread: string
  ok: boolean
}

export type DSXUReasonixDeepSeekHistoryGuardResult = {
  thinkingEnabled: boolean
  changedAssistantMessages: number
  messages: readonly Record<string, unknown>[]
  nonThinkingStablePrefixUnchanged: boolean
}

export type DSXUReasonixToolResultShrinkProof = {
  asciiChars: number
  asciiEstimatedTokens: number
  asciiPressureSize: number
  cjkChars: number
  cjkEstimatedTokens: number
  cjkPressureSize: number
  threshold: number
  cjkArtifactsEarlierThanCharOnly: boolean
  largeAsciiArtifacts: boolean
  ok: boolean
}

export type DSXUReasonixRetryBoundaryDecision = {
  phase: 'initial_fetch' | 'mid_stream'
  retryAllowed: boolean
  reason: string
}

export type DSXUReasonixCacheHardeningProof = {
  contextPressureOk: boolean
  thinkingHistoryOk: boolean
  toolResultShrinkOk: boolean
  retryBoundaryOk: boolean
}

export function buildDSXUReasonixContextPressureProof(): {
  ok: boolean
  rows: readonly DSXUReasonixContextPressureProofRow[]
} {
  const cases = [
    { percent: 69, bucket: '<70', action: 'continue' },
    { percent: 70, bucket: '70-84', action: 'checkpoint_and_trim_dynamic_tail' },
    { percent: 85, bucket: '85-94', action: 'snapshot_then_context_hygiene' },
    { percent: 95, bucket: '95-98', action: 'source_capsule_then_context_hygiene' },
    { percent: 99, bucket: '>=99', action: 'prompt_too_long_recovery_or_source_truth_snapshot' },
  ]
  const rows = cases.map(item => {
    const decision = buildDSXUContextPressureDecision({
      tokenUsage: item.percent,
      effectiveWindow: 100,
      postCompact: item.percent >= 85,
      promptTooLongRecovered: item.percent >= 99,
    })
    const ok = decision.bucket === item.bucket &&
      decision.recommendedAction === item.action &&
      decision.sourceTruthReread === 'required-before-edit-or-pass' &&
      (item.percent < 95 || /artifact|freeze|recovery|delta/.test(`${decision.contextHygieneAction} ${decision.cachePolicy}`))
    return {
      contextUsedPercent: decision.contextUsedPercent,
      bucket: decision.bucket,
      recommendedAction: decision.recommendedAction,
      cachePolicy: decision.cachePolicy,
      sourceTruthReread: decision.sourceTruthReread,
      ok,
    }
  })
  return {
    ok: rows.every(row => row.ok),
    rows,
  }
}

export function normalizeDSXUReasonixThinkingHistory(
  messages: readonly Record<string, unknown>[],
  input: { thinkingEnabled: boolean },
): DSXUReasonixDeepSeekHistoryGuardResult {
  const before = JSON.stringify(messages)
  let changedAssistantMessages = 0
  const normalized = messages.map(message => {
    if (!input.thinkingEnabled) return message
    if (message.role !== 'assistant') return message
    if (message.reasoning_content !== undefined) return message
    changedAssistantMessages += 1
    return { ...message, reasoning_content: '' }
  })
  return {
    thinkingEnabled: input.thinkingEnabled,
    changedAssistantMessages,
    messages: normalized,
    nonThinkingStablePrefixUnchanged: !input.thinkingEnabled ? before === JSON.stringify(normalized) : true,
  }
}

export function buildDSXUReasonixThinkingHistoryProof(): boolean {
  const messages = [
    { role: 'user', content: 'fix the failing test' },
    { role: 'assistant', content: 'I will inspect the owner first.' },
    { role: 'assistant', content: 'I found the failure.', reasoning_content: 'route evidence' },
  ]
  const thinking = normalizeDSXUReasonixThinkingHistory(messages, { thinkingEnabled: true })
  const nonThinking = normalizeDSXUReasonixThinkingHistory(messages, { thinkingEnabled: false })
  return thinking.changedAssistantMessages === 1 &&
    thinking.messages[1]?.reasoning_content === '' &&
    thinking.messages[2]?.reasoning_content === 'route evidence' &&
    nonThinking.changedAssistantMessages === 0 &&
    nonThinking.nonThinkingStablePrefixUnchanged
}

export function buildDSXUReasonixToolResultShrinkProof(input?: {
  threshold?: number
}): DSXUReasonixToolResultShrinkProof {
  const threshold = input?.threshold ?? 50_000
  const ascii = 'a'.repeat(30_000)
  const cjk = '测'.repeat(30_000)
  const largeAscii = 'b'.repeat(120_000)
  const asciiPressureSize = getDeepSeekToolResultPressureSize(ascii)
  const cjkPressureSize = getDeepSeekToolResultPressureSize(cjk)
  const largeAsciiPressureSize = getDeepSeekToolResultPressureSize(largeAscii)
  const cjkArtifactsEarlierThanCharOnly = cjk.length < threshold && cjkPressureSize > threshold
  const largeAsciiArtifacts = largeAsciiPressureSize > threshold
  return {
    asciiChars: ascii.length,
    asciiEstimatedTokens: estimateDeepSeekToolResultTokens(ascii),
    asciiPressureSize,
    cjkChars: cjk.length,
    cjkEstimatedTokens: estimateDeepSeekToolResultTokens(cjk),
    cjkPressureSize,
    threshold,
    cjkArtifactsEarlierThanCharOnly,
    largeAsciiArtifacts,
    ok: asciiPressureSize <= threshold && cjkArtifactsEarlierThanCharOnly && largeAsciiArtifacts,
  }
}

export function buildDSXUReasonixRetryBoundaryDecision(input: {
  phase: 'initial_fetch' | 'mid_stream'
  error: unknown
}): DSXUReasonixRetryBoundaryDecision {
  if (input.phase === 'mid_stream') {
    return {
      phase: input.phase,
      retryAllowed: false,
      reason: 'mid-stream retry is blocked to avoid duplicating partial user-visible content or corrupting tool-call state',
    }
  }
  const retryAllowed = isRetryableError(input.error)
  return {
    phase: input.phase,
    retryAllowed,
    reason: retryAllowed
      ? 'initial fetch retry is allowed for network, 429, or 5xx before any stream/tool state is emitted'
      : 'initial fetch error is not retryable by DSXU retry policy',
  }
}

export function buildDSXUReasonixRetryBoundaryProof(): boolean {
  const initial = buildDSXUReasonixRetryBoundaryDecision({
    phase: 'initial_fetch',
    error: { status: 429, message: 'rate limit' },
  })
  const midStream = buildDSXUReasonixRetryBoundaryDecision({
    phase: 'mid_stream',
    error: { status: 503, message: 'service unavailable' },
  })
  return initial.retryAllowed && !midStream.retryAllowed
}

export function buildDSXUReasonixCacheHardeningProof(): DSXUReasonixCacheHardeningProof {
  return {
    contextPressureOk: buildDSXUReasonixContextPressureProof().ok,
    thinkingHistoryOk: buildDSXUReasonixThinkingHistoryProof(),
    toolResultShrinkOk: buildDSXUReasonixToolResultShrinkProof().ok,
    retryBoundaryOk: buildDSXUReasonixRetryBoundaryProof(),
  }
}
