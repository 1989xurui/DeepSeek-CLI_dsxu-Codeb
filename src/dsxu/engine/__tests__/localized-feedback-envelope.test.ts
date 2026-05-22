import { describe, expect, test } from 'bun:test'
import {
  buildLocalizedFeedbackEnvelope,
  createProgressLedger,
  projectVerificationRecoveryDecision,
  recordVerificationRecoveryDecision,
  type VerifySummary,
} from '../progress-ledger'

function failedVerification(): VerifySummary {
  return {
    passed: false,
    score: 54,
    findings: [
      {
        severity: 'P2',
        title: 'unrelated style issue',
        detail: 'not the root cause',
      },
      {
        severity: 'P1',
        title: 'route cache latch breaks after repeated Read',
        detail: 'the same source pack is read into the dynamic tail on every turn',
        suggestion: 'artifact the long tool result and rebuild a stable source capsule',
      },
    ],
    timestamp: 1,
  }
}

describe('V10 Localized Feedback Envelope', () => {
  test('builds a short focused feedback packet from failed verification', () => {
    const envelope = buildLocalizedFeedbackEnvelope({
      verification: failedVerification(),
      command: 'bun test src/dsxu/engine/__tests__/route-cache.test.ts',
      failedAttemptsSinceProgress: 2,
      localizedFiles: [
        'src/dsxu/engine/route-cache-dynamic-tail.ts',
        'src/dsxu/engine/prompt-prefix-cache-builder.ts',
      ],
      nextAction: 'replan around stable prefix and rerun the focused test',
    })

    expect(envelope.status).toBe('ready')
    expect(envelope.focusedFindingTitles[0]).toBe('route cache latch breaks after repeated Read')
    expect(envelope.localizedFiles).toContain('src/dsxu/engine/route-cache-dynamic-tail.ts')
    expect(envelope.feedbackLines.length).toBeLessThanOrEqual(7)
    expect(envelope.feedbackLines.join('\n')).toContain('next action:')
  })

  test('records localized feedback into the long-task ledger without allowing final claim', () => {
    let ledger = createProgressLedger('localized-feedback-test', 'session-v10', 'running')
    const projection = projectVerificationRecoveryDecision({
      verification: failedVerification(),
      onFailure: 'block',
      failedAttemptsSinceProgress: 2,
      command: 'bun test focused-cache.test.ts',
      localizedFiles: ['src/dsxu/engine/route-cache-dynamic-tail.ts'],
    })
    ledger = recordVerificationRecoveryDecision(ledger, projection)

    const feedbackEvent = ledger.events?.find(event =>
      event.summary.includes('Localized feedback envelope ready'),
    )
    expect(projection.localizedFeedback?.status).toBe('ready')
    expect(projection.finalClaimAllowed).toBe(false)
    expect(feedbackEvent?.metadata?.finalClaimAllowed).toBe(false)
    expect(feedbackEvent?.metadata?.localizedFeedback).toBeTruthy()
  })

  test('keeps passed verification quiet instead of adding redundant feedback', () => {
    const envelope = buildLocalizedFeedbackEnvelope({
      verification: {
        passed: true,
        score: 91,
        findings: [],
        timestamp: 2,
      },
    })

    expect(envelope.status).toBe('not_needed')
    expect(envelope.feedbackLines).toEqual([])
  })
})
