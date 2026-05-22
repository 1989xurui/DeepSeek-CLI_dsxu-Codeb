import { describe, expect, test } from 'bun:test'
import { exportTrainingTrajectory } from '../exporter'
import { containsSecretLikeText, redactSecretLikeText, snapshotText } from '../redaction'

describe('DSXU training trajectory exporter', () => {
  test('exports mocked runtime evidence into a valid redacted trajectory', () => {
    const result = exportTrainingTrajectory({
      task: {
        taskId: 'unit-exporter',
        category: 'multi-file-edit',
        intent: 'verify exporter behavior',
        riskLevel: 'medium',
        acceptanceCriteria: ['valid schema', 'paired tool result'],
        claimScope: 'internal',
      },
      ledgerEvents: [
        { kind: 'plan', summary: 'plan edit', owner: 'Query Loop' },
        { kind: 'source_evidence', summary: 'read file', owner: 'Source Truth' },
        { kind: 'tool', summary: 'tool result', owner: 'Tool Gate' },
        { kind: 'verification', summary: 'test passed', owner: 'Verification' },
      ],
      toolResults: [{
        toolUseId: 'read-1',
        toolName: 'Read',
        readonly: true,
        permissionDecision: 'allow',
        result: {
          schemaVersion: 'dsxu.tool-call-result.v1',
          ok: true,
          outputText: 'file summary only',
          events: [],
          metadata: {
            duration: 1,
            executorKind: 'dsxu_native',
            usedBridge: false,
          },
        },
      }],
      filesRead: ['D:\\Users\\demo\\project\\src\\file.ts'],
      rangesRead: ['src/file.ts:1-20'],
      sourceEvidenceText: ['function body should be hashed, not stored'],
      verification: {
        commands: ['bun test src/dsxu/training/__tests__/exporter.test.ts'],
        passed: true,
        claimBound: true,
        localizedFeedbackPresent: false,
      },
      outcome: {
        status: 'success',
        finalClaim: 'exporter test passed',
        verified: true,
        publicClaimAllowed: false,
      },
    })

    expect(result.validation.ok).toBe(true)
    expect(result.trajectory.task.taskId).toBe('unit-exporter')
    expect(result.trajectory.sourceTruth.filesRead[0]).not.toContain('D:/Users/demo')
    expect(result.trajectory.sourceTruth.sourceBodyStored).toBe(false)
    expect(result.trajectory.sourceTruth.evidenceHashes).toHaveLength(1)
    expect(result.trajectory.toolTrace[0]).toMatchObject({
      toolUseId: 'read-1',
      toolName: 'Read',
      resultPaired: true,
      outputChars: 'file summary only'.length,
    })
  })

  test('redacts secret-like text and stores only snapshots', () => {
    const secretText = 'token=sk-1234567890abcdef1234567890abcdef'
    const snapshot = snapshotText(secretText)

    expect(containsSecretLikeText(secretText)).toBe(true)
    expect(redactSecretLikeText(secretText)).toContain('[REDACTED_SECRET]')
    expect(snapshot?.redacted).toBe(true)
    expect(snapshot?.preview).not.toContain('sk-1234567890abcdef1234567890abcdef')
  })

  test('can export an unpaired tool result for validator hard-gate testing', () => {
    const result = exportTrainingTrajectory({
      toolResults: [{
        toolUseId: 'bad-tool',
        toolName: 'Read',
        readonly: true,
      }],
    })

    expect(result.validation.ok).toBe(true)
    expect(result.trajectory.toolTrace[0].resultPaired).toBe(false)
  })
})
