import { describe, expect, test } from 'bun:test'
import {
  appendLedgerEvent,
  buildDSXUActiveFrame,
  buildDurableLedgerRecoveryProof,
  buildLongTaskLedgerProjection,
  buildRuntimeEventSchemaConsumptionProof,
  createProgressLedger,
  projectToolCallResultToLedgerEvent,
  recordVerificationRecoveryDecision,
  projectVerificationRecoveryDecision,
} from '../progress-ledger'

describe('V6 Active Frame + Durable Ledger', () => {
  test('builds a compact active frame from one append-only ledger stream', () => {
    let ledger = createProgressLedger('v6-active-frame', 'session-v6', 'edit')
    ledger = appendLedgerEvent(ledger, {
      kind: 'task_contract',
      owner: 'Query Loop / PlanGraph / Tool Gate',
      summary: 'single_file_edit plan_execute_verify via flash',
      eventId: 'contract-event',
      evidence: ['contract:v6-active-frame'],
      metadata: {
        executionContract: {
          goal: 'Patch DeepSeek route evidence projection',
          risk: 'medium',
          visibleTools: ['Read', 'Edit', 'Bash', 'Grep'],
          verificationLevel: 'affected_tests',
        },
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'source_evidence',
      owner: 'Source Truth Repair',
      summary: 'Read route owner files',
      eventId: 'source-event',
      evidence: ['src/utils/model/deepseekV4Control.ts', 'src/services/api/deepseek-adapter.ts'],
      metadata: {
        filesRead: ['src/utils/model/deepseekV4Control.ts', 'src/services/api/deepseek-adapter.ts'],
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'edit_proof',
      owner: 'Tool Gate',
      summary: 'Scoped edit proof recorded',
      eventId: 'edit-proof-event',
      evidence: ['edit-proof:v6-route-evidence'],
      metadata: {
        filesChanged: ['src/utils/model/deepseekV4Control.ts'],
        openObligations: ['run model-router-cost-policy focused test'],
      },
    })

    const frame = buildDSXUActiveFrame({ ledger })
    expect(frame.schemaVersion).toBe('dsxu.active-frame.v5')
    expect(frame.task).toBe('Patch DeepSeek route evidence projection')
    expect(frame.confirmedFacts.length).toBeLessThanOrEqual(8)
    expect(frame.filesRead).toEqual([
      'src/utils/model/deepseekV4Control.ts',
      'src/services/api/deepseek-adapter.ts',
    ])
    expect(frame.filesChanged).toEqual(['src/utils/model/deepseekV4Control.ts'])
    expect(frame.openObligations).toEqual([
      'verification required:affected_tests',
      'run model-router-cost-policy focused test',
    ])
    expect(frame.nextAllowedActions).toEqual(expect.arrayContaining(['tool:Edit', 'record edit proof']))
    expect(frame.guards).toEqual([])
  })

  test('recovers task state from ledger after failed verification without allowing final claim', () => {
    let ledger = createProgressLedger('v6-resume', 'session-v6', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'verification',
      owner: 'VerificationKernel',
      summary: 'Focused verification failed',
      eventId: 'verify-failed',
      evidence: ['bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts:failed'],
    })
    const recovery = projectVerificationRecoveryDecision({
      verification: {
        passed: false,
        score: 40,
        findings: [
          {
            severity: 'P1',
            title: 'Focused test failed',
            detail: 'Route assertion failed',
          },
        ],
        timestamp: 1,
      },
      onFailure: 'block',
      failedAttemptsSinceProgress: 2,
      command: 'bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts',
      owner: 'VerificationKernel',
      evidence: ['route-assertion-failed'],
    })
    ledger = recordVerificationRecoveryDecision(ledger, recovery)

    const projection = buildLongTaskLedgerProjection(ledger)
    const proof = buildDurableLedgerRecoveryProof(ledger)
    expect(projection.isResumable).toBe(true)
    expect(projection.finalClaimAllowed).toBe(false)
    expect(projection.nextAction).toContain('rerun focused verification')
    expect(proof.status).toBe('PASS_DURABLE_LEDGER_RECOVERY_READY')
    expect(proof.resumeSource).toBe('progress-ledger')
    expect(proof.finalReportSection.summary.join('\n')).toContain('finalClaimAllowed=false')
  })

  test('requires the default runtime event set before final evidence can pass', () => {
    let ledger = createProgressLedger('v6-runtime-events', 'session-v6', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'goal',
      owner: 'Query Loop',
      summary: 'Goal accepted',
      eventId: 'goal-event',
      evidence: ['goal:v6'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'plan',
      owner: 'PlanGraph',
      summary: 'Plan created',
      eventId: 'plan-event',
      evidence: ['plan:v6'],
    })
    ledger = appendLedgerEvent(ledger, projectToolCallResultToLedgerEvent({
      callId: 'tool-v6',
      toolName: 'Read',
      result: {
        ok: true,
        outputText: 'source excerpt',
        events: [],
        metadata: {
          duration: 12,
          executorKind: 'dsxu_native',
          usedBridge: false,
        },
      },
    }))
    ledger = appendLedgerEvent(ledger, {
      kind: 'verification',
      owner: 'VerificationKernel',
      summary: 'Focused verification passed',
      eventId: 'verify-event',
      evidence: ['verify:pass'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'recovery',
      owner: 'Recovery / GearBox',
      summary: 'No recovery needed',
      eventId: 'recovery-event',
      evidence: ['recovery:none'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'evidence',
      owner: 'Evidence / Release Claim Binder',
      summary: 'Evidence packet linked',
      eventId: 'evidence-event',
      evidence: ['evidence:v6'],
    })

    const proof = buildRuntimeEventSchemaConsumptionProof({ events: ledger.events ?? [] })
    expect(proof.status).toBe('PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION')
    expect(proof.missingKinds).toEqual([])
    expect(proof.invalidEvents).toEqual([])
  })
})
