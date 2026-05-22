import { describe, expect, test } from 'bun:test'
import {
  RECOVERY_DECISION_TABLE,
  appendLedgerEvent,
  buildLongTaskLedgerProjection,
  createProgressLedger,
  decideStallRecovery,
  projectFailureRecoveryDecision,
  recordFailureRecoveryDecision,
  recordStallDecision,
  type StallSignalKind,
} from '../progress-ledger'

describe('V6 Recovery Decision Table', () => {
  test('covers every known stall signal with a non-claiming decision', () => {
    const expectedSignals: StallSignalKind[] = [
      'repeated_read',
      'no_diff',
      'repeated_verification_failure',
      'tool_failure',
      'validation_failure',
      'timeout',
      'workspace_boundary',
      'model_failure',
      'context_pressure',
      'cost_pressure',
      'agent_timeout',
      'permission_loop',
      'tool_result_growth',
    ]

    expect(RECOVERY_DECISION_TABLE.map(row => row.signal).sort()).toEqual(
      [...expectedSignals].sort(),
    )
    for (const row of RECOVERY_DECISION_TABLE) {
      expect(row.finalClaimAllowed).toBe(false)
      expect(row.ledgerEventRequired).toBe(true)
      expect(row.nextAction.length).toBeGreaterThan(8)
    }
  })

  test('escalates repeated no-progress signals instead of allowing infinite loops', () => {
    const first = decideStallRecovery({
      signals: [
        {
          kind: 'repeated_verification_failure',
          count: 1,
          severity: 'high',
          evidence: ['verify:first-fail'],
        },
      ],
    })
    const second = decideStallRecovery({
      signals: [
        {
          kind: 'repeated_verification_failure',
          count: 2,
          severity: 'high',
          evidence: ['verify:second-fail'],
        },
      ],
      priorDecisions: [first],
    })

    expect(first.action).toBe('replan')
    expect(second.action).toBe('rollback')
    expect(second.confidence).toBeGreaterThan(first.confidence)
    expect('finalClaimAllowed' in second).toBe(false)
  })

  test('writes recovery decisions into the ledger and keeps final claim blocked', () => {
    let ledger = createProgressLedger('v6-recovery-ledger', 'session-v6', 'verify')
    const decision = decideStallRecovery({
      signals: [
        {
          kind: 'tool_result_growth',
          count: 3,
          severity: 'high',
          evidence: ['tool-result-chars:over-budget'],
        },
      ],
    })
    ledger = recordStallDecision(ledger, decision)
    const projection = buildLongTaskLedgerProjection(ledger)

    expect(ledger.stallDecision).toEqual(decision)
    expect(ledger.events?.some(event => event.kind === 'stall')).toBe(true)
    expect(projection.finalClaimAllowed).toBe(false)
    expect(projection.nextAction).toContain('artifact large tool output')
  })

  test('maps normalized failure categories through the same recovery table', () => {
    let ledger = createProgressLedger('v6-failure-recovery', 'session-v6', 'execute')
    const permission = projectFailureRecoveryDecision({
      error: new Error('permission denied by Tool Gate'),
      blockedByPolicy: true,
      failedAttemptsSinceProgress: 1,
      evidence: ['permission:denied'],
    })
    ledger = recordFailureRecoveryDecision(ledger, permission)
    ledger = appendLedgerEvent(ledger, {
      kind: 'evidence',
      owner: 'Evidence / Release Claim Binder',
      summary: 'Failure recovery evidence linked',
      eventId: 'failure-recovery-evidence',
      evidence: ['evidence:failure-recovery'],
    })

    expect(permission.failure.category).toBe('permission')
    expect(permission.recoveryDecision.reason).toBe('permission_loop')
    expect(permission.recoveryDecision.action).toBe('ask-human')
    expect(permission.finalClaimAllowed).toBe(false)
    expect(ledger.events?.filter(event => event.kind === 'recovery').length).toBe(1)
    expect(ledger.events?.filter(event => event.kind === 'stall').length).toBe(1)
  })
})
