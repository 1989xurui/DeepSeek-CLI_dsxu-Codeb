import { describe, expect, test } from 'bun:test'
import {
  buildPostMutationVerificationEnvelope,
  formatPostMutationVerificationToolState,
  summarizePostMutationVerificationEnvelope,
} from '../post-mutation-verification-envelope'
import {
  appendLedgerEvent,
  buildDurableLedgerRecoveryProof,
  createProgressLedger,
  projectVerificationRecoveryDecision,
  recordVerificationRecoveryDecision,
} from '../progress-ledger'

describe('V6 Proof-Carrying Edit', () => {
  test('blocks final claims when verification is required but not run', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/dsxu/engine/query-loop.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: true,
          passed: true,
          issues: 0,
        },
      ],
    })
    const summary = summarizePostMutationVerificationEnvelope(envelope)

    expect(envelope.schemaVersion).toBe('dsxu.post-mutation-verification.v1')
    expect(envelope.editProof.schemaVersion).toBe('dsxu.edit-proof-envelope.v5')
    expect(envelope.editProof.verification).toBe('not_run')
    expect(envelope.finalClaimAllowed).toBe(false)
    expect(envelope.finalClaimPolicy.status).toBe('NEEDS_FOCUSED_VERIFICATION')
    expect(summary.finalClaimAllowed).toBe(false)
    expect(formatPostMutationVerificationToolState(summary)).toContain(
      'do not claim this mutation is fully verified',
    )
  })

  test('allows focused claims only after blocking static analysis and verification pass', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/dsxu/engine/action-contract.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: true,
          passed: true,
          issues: 0,
        },
        {
          name: 'post-mutation-verification',
          status: 'PASS',
          blocking: true,
          passed: true,
          durationMs: 90,
        },
      ],
    })

    expect(envelope.finalClaimAllowed).toBe(true)
    expect(envelope.editProof.claimAllowed).toBe(true)
    expect(envelope.reviewRequired).toBe(false)
    expect(envelope.finalClaimPolicy).toMatchObject({
      status: 'READY_FOR_FOCUSED_CLAIM',
      allowed: true,
    })
  })

  test('routes failed proof envelopes into recovery instead of a fake PASS', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/dsxu/engine/progress-ledger.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: true,
          passed: true,
        },
        {
          name: 'post-mutation-verification',
          status: 'FAIL',
          blocking: true,
          passed: false,
          error: 'focused test failed',
        },
      ],
    })
    let ledger = createProgressLedger('v6-proof-edit', 'session-v6-proof', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'edit_proof',
      owner: envelope.owner,
      summary: `proof envelope status=${envelope.finalClaimPolicy.status}`,
      eventId: 'edit-proof-v6',
      evidence: summarizePostMutationVerificationEnvelope(envelope).evidence,
      metadata: {
        proofEnvelope: envelope,
        finalClaimAllowed: envelope.finalClaimAllowed,
      },
    })
    const recovery = projectVerificationRecoveryDecision({
      verification: {
        passed: false,
        score: 20,
        findings: [
          {
            severity: 'P1',
            title: 'Focused verification failed',
            detail: 'The proof envelope has a blocking verification failure.',
          },
        ],
        timestamp: 1,
      },
      onFailure: 'block',
      failedAttemptsSinceProgress: 2,
      command: 'post-mutation-verification',
      owner: 'VerificationKernel',
      evidence: ['edit-proof:finalClaimAllowed=false'],
    })
    ledger = recordVerificationRecoveryDecision(ledger, recovery)

    const proof = buildDurableLedgerRecoveryProof(ledger)
    expect(envelope.finalClaimAllowed).toBe(false)
    expect(envelope.blockingFailure).toBe(true)
    expect(proof.status).toBe('PASS_DURABLE_LEDGER_RECOVERY_READY')
    expect(proof.finalClaimAllowed).toBe(false)
    expect(proof.nextAction).toContain('rerun focused verification')
  })
})
