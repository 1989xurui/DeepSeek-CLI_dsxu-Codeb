import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionReleaseExcludedArchiveRegister } from '../pending-deletion-release-excluded-archive-register-v1'
import type { PendingDeletionReviewLanesRegister } from '../pending-deletion-review-lanes-register-v1'
import { runPendingDeletionReleaseExcludedArchiveRegisterHarness } from '../../integration/harness/pending-deletion-release-excluded-archive-register-v1-harness'

const sourceRegister: PendingDeletionReviewLanesRegister = {
  schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  laneCount: 1,
  entryCount: 4,
  mainlineReplacementDeleteEntryCount: 0,
  releaseExcludedDeleteEntryCount: 4,
  oldRootShimDeleteEntryCount: 0,
  missingReplacementEvidenceEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  lanes: [
    {
      id: 'PDL-02',
      name: 'release-excluded deletion review',
      status: 'PARTIAL',
      owner: 'Release Evidence / Eval Archive Owners',
      entryCount: 4,
      pathCount: 24,
      replacementEvidenceVerifiedCount: 4,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close release-excluded private/history/eval deletions only after release/export exclusion evidence is signed',
      redlines: [],
      entries: [
        {
          id: 'PDR-02.01',
          owner: 'Release Evidence Owner',
          targetOwner: 'release-excluded private config state',
          closureDecision: 'release-excluded-delete',
          status: 'PARTIAL',
          pathCount: 1,
          replacementEvidence: ['open-source-package-gate-20260507.evidence.json', 'clean-export-readiness.evidence.json'],
          samplePaths: ['.legacy-product/settings.json'],
          restorePolicy: 'do-not-restore-release-excluded-state',
          requiredAction: 'confirm release-excluded state and close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-02.02',
          owner: 'Historical Evidence Owner',
          targetOwner: 'release-excluded historical milestone evidence',
          closureDecision: 'release-excluded-delete',
          status: 'PARTIAL',
          pathCount: 6,
          replacementEvidence: ['open-source-package-gate-20260507.evidence.json', 'clean-export-readiness.evidence.json'],
          samplePaths: ['.dsevo/milestones/M1-COMPLETE.json'],
          restorePolicy: 'do-not-restore-release-excluded-state',
          requiredAction: 'confirm release-excluded state and close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-02.03',
          owner: 'Evaluation Evidence Owner',
          targetOwner: 'P12/raw eval evidence or release-excluded archive',
          closureDecision: 'release-excluded-delete',
          status: 'PARTIAL',
          pathCount: 13,
          replacementEvidence: [
            'clean-export-readiness.evidence.json',
            'reference-experience-quality-contract-v1.test.ts',
            'v18-live-real-task-compare-v1.test.ts',
          ],
          samplePaths: ['dsevo/bench/after_p0a.json'],
          restorePolicy: 'do-not-restore-release-excluded-state',
          requiredAction: 'confirm P12/raw eval replacement or release-excluded archive before normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-02.04',
          owner: 'Evaluation Evidence Owner',
          targetOwner: 'P12/raw eval replacement or release-excluded archive',
          closureDecision: 'release-excluded-delete',
          status: 'PARTIAL',
          pathCount: 4,
          replacementEvidence: [
            'clean-export-readiness.evidence.json',
            'reference-experience-quality-contract-v1.test.ts',
            'v18-live-real-task-compare-v1.test.ts',
          ],
          samplePaths: ['evals/bench-runner.py'],
          restorePolicy: 'do-not-restore-release-excluded-state',
          requiredAction: 'confirm P12/raw eval replacement or release-excluded archive before normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
      ],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'pending-deletion-lane-git-review-required',
}

describe('OGC-02C - Pending Deletion Release Excluded Archive Register V1', () => {
  test('maps PDL-02 release-excluded deletion entries to archive owners without release payload restore', () => {
    const register = buildPendingDeletionReleaseExcludedArchiveRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-release-excluded-archive-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.sourceLaneStatus).toBe('PARTIAL')
    expect(register.entryCount).toBe(4)
    expect(register.pathCount).toBe(24)
    expect(register.privateStateEntryCount).toBe(1)
    expect(register.historicalEvidenceEntryCount).toBe(1)
    expect(register.benchGoldenFixtureEntryCount).toBe(1)
    expect(register.evalBenchScriptEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownArchiveOwnerEntryCount).toBe(0)
    expect(register.releasePayloadAllowed).toBe(false)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('release-excluded-archive-git-review-required')
    expect(register.entries.map(entry => entry.archiveOwner)).toEqual([
      'release-private-state',
      'historical-milestone-evidence',
      'dsevo-bench-golden-fixtures',
      'eval-bench-scripts',
    ])
  })

  test('blocks missing release-excluded evidence instead of restoring archive paths', () => {
    const register = buildPendingDeletionReleaseExcludedArchiveRegister({
      ...sourceRegister,
      lanes: [
        {
          ...sourceRegister.lanes[0],
          entries: [
            {
              ...sourceRegister.lanes[0].entries[0],
              replacementEvidence: [],
            },
          ],
        },
      ],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.missingReplacementEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('release-excluded archive entries have missing evidence')
    expect(register.nextAction).toBe('fix-release-excluded-archive-evidence')
    expect(register.releasePayloadAllowed).toBe(false)
  })

  test('writes current PDL-02 release-excluded evidence without mutating git state', async () => {
    const register = await runPendingDeletionReleaseExcludedArchiveRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-release-excluded-archive-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-release-excluded-archive-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(4)
    expect(register.pathCount).toBe(24)
    expect(register.privateStateEntryCount).toBe(1)
    expect(register.historicalEvidenceEntryCount).toBe(1)
    expect(register.benchGoldenFixtureEntryCount).toBe(1)
    expect(register.evalBenchScriptEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownArchiveOwnerEntryCount).toBe(0)
    expect(register.releasePayloadAllowed).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
