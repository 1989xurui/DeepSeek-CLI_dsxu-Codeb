import { describe, expect, test } from 'bun:test'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'
import {
  buildDSXUReasonixContextPressureProof,
  buildDSXUReasonixRetryBoundaryDecision,
  buildDSXUReasonixRetryBoundaryProof,
  buildDSXUReasonixThinkingHistoryProof,
  buildDSXUReasonixToolResultShrinkProof,
} from '../reasonix-cache-hardening'

describe('RDX-E Reasonix cache hardening', () => {
  test('proves the 70/85/95/99 context pressure matrix keeps source truth and cache policy visible', () => {
    const proof = buildDSXUReasonixContextPressureProof()

    expect(proof.ok).toBe(true)
    expect(proof.rows.map(row => row.bucket)).toEqual(['<70', '70-84', '85-94', '95-98', '>=99'])
    expect(proof.rows.every(row => row.sourceTruthReread === 'required-before-edit-or-pass')).toBe(true)
    expect(proof.rows.find(row => row.bucket === '95-98')?.recommendedAction).toBe('source_capsule_then_context_hygiene')
    expect(proof.rows.find(row => row.bucket === '>=99')?.cachePolicy).toContain('recovery_delta')
  })

  test('heals DeepSeek thinking history without dirtying non-thinking request prefix', () => {
    expect(buildDSXUReasonixThinkingHistoryProof()).toBe(true)

    const convertMessages = (DeepSeekAdapter as unknown as {
      convertMessages: (
        messages: unknown[],
        system?: unknown,
        options?: { thinkingEnabled?: boolean },
      ) => Array<Record<string, unknown>>
    }).convertMessages.bind(DeepSeekAdapter)
    const sourceMessages = [
      { role: 'user', content: 'fix a failing unit test' },
      { role: 'assistant', content: [{ type: 'text', text: 'I will inspect the failure.' }] },
    ]

    const thinking = convertMessages(sourceMessages, undefined, { thinkingEnabled: true })
    const nonThinking = convertMessages(sourceMessages, undefined, { thinkingEnabled: false })

    expect(thinking.find(message => message.role === 'assistant')).toMatchObject({
      role: 'assistant',
      content: 'I will inspect the failure.',
      reasoning_content: '',
    })
    expect(nonThinking.find(message => message.role === 'assistant')).not.toHaveProperty('reasoning_content')
  })

  test('uses DeepSeek/CJK token pressure before tool-result artifact projection', () => {
    const proof = buildDSXUReasonixToolResultShrinkProof({ threshold: 50_000 })

    expect(proof.ok).toBe(true)
    expect(proof.asciiChars).toBe(30_000)
    expect(proof.asciiPressureSize).toBeLessThanOrEqual(proof.threshold)
    expect(proof.cjkChars).toBe(30_000)
    expect(proof.cjkPressureSize).toBeGreaterThan(proof.threshold)
    expect(proof.cjkArtifactsEarlierThanCharOnly).toBe(true)
    expect(proof.largeAsciiArtifacts).toBe(true)
  })

  test('separates retryable initial fetch from unsafe mid-stream replay', () => {
    expect(buildDSXUReasonixRetryBoundaryProof()).toBe(true)

    expect(buildDSXUReasonixRetryBoundaryDecision({
      phase: 'initial_fetch',
      error: { status: 503, message: 'service unavailable' },
    })).toMatchObject({
      phase: 'initial_fetch',
      retryAllowed: true,
    })
    expect(buildDSXUReasonixRetryBoundaryDecision({
      phase: 'mid_stream',
      error: { status: 503, message: 'service unavailable' },
    })).toMatchObject({
      phase: 'mid_stream',
      retryAllowed: false,
    })
  })
})
