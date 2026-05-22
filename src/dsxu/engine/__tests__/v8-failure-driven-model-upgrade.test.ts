import { describe, expect, test } from 'bun:test'
import { decideDeepSeekV4Route } from '../../../utils/model/deepseekV4Control'
import {
  appendLedgerEvent,
  createProgressLedger,
  projectDeepSeekRouteAdmissionToLedgerEvent,
} from '../progress-ledger'

describe('V8 failure-driven model upgrade evidence', () => {
  test('projects Pro admission state into the long-task ledger event stream', () => {
    const routeDecision = decideDeepSeekV4Route({
      workflowKind: 'recovery',
      role: 'recovery',
      failedVerification: true,
      retryAfterFailure: true,
      priorFlashAttempted: true,
      savedTaskEvidence: true,
      allowProAdmission: true,
    })
    const projection = projectDeepSeekRouteAdmissionToLedgerEvent({
      routeDecision,
      priorFailureCount: 2,
      sourceEvidenceCount: 3,
      taskId: 'v8-route-admission',
      turnId: 'turn-2',
    })
    const ledger = appendLedgerEvent(
      createProgressLedger('v8-route-admission', 'session-v8', 'verify'),
      projection.routeEvent,
    )

    expect(projection.schemaVersion).toBe('dsxu.deepseek-route-admission-projection.v8')
    expect(projection.proAdmissionState).toBe('admitted')
    expect(projection.evidence).toContain('proAdmission:admitted')
    expect(ledger.events?.[0]?.kind).toBe('model-route')
    expect(ledger.events?.[0]?.metadata?.proAdmission.state).toBe('admitted')
  })
})
