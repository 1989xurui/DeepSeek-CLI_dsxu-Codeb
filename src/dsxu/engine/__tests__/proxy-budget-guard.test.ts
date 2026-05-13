import { describe, it, expect } from 'vitest'

import {
  advanceBudgetGuardState,
  buildBudgetIncidentDetails,
  buildBudgetKillSwitchPayload,
  buildLocalBudgetExceededError,
  buildProxyBudgetGuard,
  resetBudgetGuardState,
  shouldBlockProxyRequest,
  summarizeBudgetMessages,
} from '../proxy-budget-guard'
import { DEEPSEEK_CONTEXT_WINDOW } from '../model-limits'

const V4_CONTEXT_WINDOW = DEEPSEEK_CONTEXT_WINDOW
const V4_CONTEXT_TARGET = Math.floor(V4_CONTEXT_WINDOW * 0.25)

describe('ProxyBudgetGuard', () => {
  it('should mark night mode and stricter thresholds', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-chat',
      {
        action: 'compacted',
        promptTok: 900_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T01:00:00+08:00'),
    )

    expect(guard.isNightMode).toBe(true)
    expect(guard.safetyMargin).toBe(4_000)
    expect(guard.triggerRatio).toBe(0.65)
  })

  it('should report stillOverBudget when V4 prompt remains too large', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-v4-flash',
      {
        action: 'truncated',
        promptTok: 1_048_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T12:00:00+08:00'),
    )

    expect(guard.stillOverBudget).toBe(true)
  })

  it('should summarize tool-call metadata for incidents', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'hello',
        tool_calls: [{ id: 'tc-1' }],
      },
      {
        role: 'tool',
        content: 'output',
        tool_call_id: 'tc-1',
      },
    ]

    const summary = summarizeBudgetMessages(messages)
    expect(summary).toHaveLength(2)
    expect(summary[0].hasToolCalls).toBe(true)
    expect(summary[0].toolCallIds).toEqual(['tc-1'])
    expect(summary[1].contentLen).toBe(6)
  })

  it('should kill after two 400s during Beijing off-peak', () => {
    const first = advanceBudgetGuardState(
      resetBudgetGuardState(),
      new Date('2026-04-13T01:00:00+08:00'),
    )
    expect(first.shouldKill).toBe(false)
    expect(first.killThreshold).toBe(2)

    const second = advanceBudgetGuardState(
      first.nextState,
      new Date('2026-04-13T01:05:00+08:00'),
    )
    expect(second.shouldKill).toBe(true)
  })

  it('should build incident details with summarized messages', () => {
    const details = buildBudgetIncidentDetails({
      error: 'prompt too long',
      messages: [{ role: 'user', content: 'x'.repeat(12) }],
      state: { consecutive400s: 2, last400At: '2026-04-13T00:00:00.000Z' },
      date: new Date('2026-04-13T12:00:00+08:00'),
    })

    expect(details.error).toBe('prompt too long')
    expect(details.isNightMode).toBe(false)
    expect(Array.isArray(details.messages)).toBe(true)
  })

  it('should block proxy request when V4 budget remains over limit', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-v4-flash',
      {
        action: 'truncated',
        promptTok: 1_048_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T12:00:00+08:00'),
    )

    expect(shouldBlockProxyRequest(guard)).toBe(true)
  })

  it('should build local budget exceeded error payload', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-chat',
      {
        action: 'truncated',
        promptTok: 1_048_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T12:00:00+08:00'),
    )

    const payload = buildLocalBudgetExceededError(guard)
    expect(payload.type).toBe('context_budget_exceeded')
    expect(payload.message).toContain('LOCAL_BUDGET_GUARD_BLOCKED')
    expect(payload.gateClass).toBe('RECOVERY_BLOCK')
    expect(payload.policy).toBe('context-window-aware-overflow-guard')
    expect(payload.budget).toBe(guard)
  })

  it('should build kill switch payload with guard metadata', () => {
    const date = new Date('2026-04-13T01:00:00+08:00')
    const guard = buildProxyBudgetGuard(
      'deepseek-reasoner',
      {
        action: 'output_shrunk',
        promptTok: 1_040_000,
        maxTok: 1_000,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      date,
    )

    const payload = buildBudgetKillSwitchPayload({
      error: '400 bad request',
      killThreshold: 2,
      state: { consecutive400s: 2, last400At: date.toISOString() },
      budget: guard,
      messages: [{ role: 'user', content: 'hello' }],
      date,
    })

    expect(payload.reason).toBe('deepseek_400_budget_guard')
    expect(payload.killThreshold).toBe(2)
    expect(payload.state.consecutive400s).toBe(2)
    expect(payload.budget.isNightMode).toBe(true)
  })

  it('should include degradation strategy in budget guard', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-v4-flash',
      {
        action: 'compacted',
        promptTok: 930_000,
        maxTok: 393_216,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T12:00:00+08:00'),
      'code_generation'
    )

    // High pressure is not an early compact blocker, but oversized output gets downgraded.
    expect(guard.stillOverBudget).toBe(false)
    expect(guard.degradationStrategy).toBeDefined()
    expect(['reduce_output', 'compress_input', 'emergency']).toContain(guard.degradationStrategy)
  })

  it('should apply higher safety margin for reasoner model', () => {
    const day = new Date('2026-04-13T12:00:00+08:00')
    const chatGuard = buildProxyBudgetGuard(
      'deepseek-chat',
      {
        action: 'normal',
        promptTok: 50_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      day
    )

    const reasonerGuard = buildProxyBudgetGuard(
      'deepseek-v4-pro',
      {
        action: 'normal',
        promptTok: 50_000,
        maxTok: 65_536,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      day
    )

    // reasoner搴旇鏈夋洿楂樼殑瀹夊叏杈归檯
    expect(reasonerGuard.safetyMargin).toBeGreaterThan(chatGuard.safetyMargin)
  })

  it('should include scenario-specific adjustments in safety margin', () => {
    const day = new Date('2026-04-13T12:00:00+08:00')

    const normalGuard = buildProxyBudgetGuard(
      'deepseek-chat',
      {
        action: 'normal',
        promptTok: 50_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      day,
      'normal'
    )

    const codeGuard = buildProxyBudgetGuard(
      'deepseek-chat',
      {
        action: 'normal',
        promptTok: 50_000,
        maxTok: 8_192,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      day,
      'code_generation'
    )

    // 浠ｇ爜鐢熸垚鍦烘櫙搴旇鏈夋洿楂樼殑瀹夊叏杈归檯
    expect(codeGuard.safetyMargin).toBeGreaterThan(normalGuard.safetyMargin)
  })

  it('should apply reasoner-specific strategy for long outputs', () => {
    const guard = buildProxyBudgetGuard(
      'deepseek-v4-pro',
      {
        action: 'output_shrunk',
        promptTok: 100_000,
        maxTok: 65_536,
        ctxMax: V4_CONTEXT_WINDOW,
      },
      V4_CONTEXT_TARGET,
      new Date('2026-04-13T12:00:00+08:00')
    )

    // reasoner搴旇搴旂敤鐗规畩绛栫暐
    expect(guard.reasonerStrategyApplied).toBe(true)
  })
})
