import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionOldRootShimReplacementRegister } from '../pending-deletion-old-root-shim-replacement-register-v1'
import type { PendingDeletionReviewLanesRegister } from '../pending-deletion-review-lanes-register-v1'
import { runPendingDeletionOldRootShimReplacementRegisterHarness } from '../../integration/harness/pending-deletion-old-root-shim-replacement-register-v1-harness'

const sourceRegister: PendingDeletionReviewLanesRegister = {
  schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  laneCount: 1,
  entryCount: 3,
  mainlineReplacementDeleteEntryCount: 0,
  releaseExcludedDeleteEntryCount: 0,
  oldRootShimDeleteEntryCount: 3,
  missingReplacementEvidenceEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  lanes: [
    {
      id: 'PDL-03',
      name: 'old root shim deletion review',
      status: 'PARTIAL',
      owner: 'Entrypoint / Direct Connect / Verification Tooling Owners',
      entryCount: 3,
      pathCount: 8,
      replacementEvidenceVerifiedCount: 3,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close old root launchers, proxy shims, and root test scripts through normal Git review after replacement evidence is signed',
      redlines: [],
      entries: [
        {
          id: 'PDR-03.01',
          owner: 'Entrypoint Replacement Owner',
          targetOwner: 'Start-DSXU-Code launchers and CLI entrypoint',
          closureDecision: 'old-root-shim-delete',
          status: 'PARTIAL',
          pathCount: 3,
          replacementEvidence: ['Start-DSXU-Code.cmd', 'Start-DSXU-Code-WSL.cmd', 'toolchain-selfcheck-v1.test.ts'],
          samplePaths: ['crash-handler.js', 'start-legacy-product.cmd', 'start-legacy-product.ps1'],
          restorePolicy: 'do-not-restore-old-root-shim',
          requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-03.02',
          owner: 'Direct Connect / Provider Runtime Owner',
          targetOwner: 'DSXU direct-connect/provider runtime replacement',
          closureDecision: 'old-root-shim-delete',
          status: 'PARTIAL',
          pathCount: 2,
          replacementEvidence: ['direct-connect-and-query-contract-v1.test.ts', 'network-facade-v1.test.ts'],
          samplePaths: ['deepseek-proxy.js', 'deepseek-proxy.ts'],
          restorePolicy: 'do-not-restore-old-root-shim',
          requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-03.03',
          owner: 'Verification Tooling Owner',
          targetOwner: 'current Bun/focused verification harnesses',
          closureDecision: 'old-root-shim-delete',
          status: 'PARTIAL',
          pathCount: 3,
          replacementEvidence: [
            'pending-deletion-review-v1.test.ts',
            'clean-export-readiness-v1.test.ts',
            'release-closure-board-v1.test.ts',
          ],
          samplePaths: ['test-context-budget.js', 'test-cost-ledger.cjs', 'test-infra-tasks.js'],
          restorePolicy: 'do-not-restore-old-root-shim',
          requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
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

describe('OGC-02D - Pending Deletion Old Root Shim Replacement Register V1', () => {
  test('maps PDL-03 old root shims to mainline owners without alternate runtimes', () => {
    const register = buildPendingDeletionOldRootShimReplacementRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-old-root-shim-replacement-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.sourceLaneStatus).toBe('PARTIAL')
    expect(register.entryCount).toBe(3)
    expect(register.pathCount).toBe(8)
    expect(register.entrypointLauncherEntryCount).toBe(1)
    expect(register.directConnectProviderEntryCount).toBe(1)
    expect(register.verificationToolingEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownReplacementOwnerEntryCount).toBe(0)
    expect(register.oldShimRuntimeAllowed).toBe(false)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('old-root-shim-replacement-git-review-required')
    expect(register.entries.map(entry => entry.replacementOwner)).toEqual([
      'entrypoint-launcher',
      'direct-connect-provider-runtime',
      'verification-tooling',
    ])
  })

  test('blocks missing old root shim evidence instead of restoring old entrypoints', () => {
    const register = buildPendingDeletionOldRootShimReplacementRegister({
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
    expect(register.blockers).toContain('old root shim replacement entries have missing evidence')
    expect(register.nextAction).toBe('fix-old-root-shim-replacement-evidence')
    expect(register.oldShimRuntimeAllowed).toBe(false)
  })

  test('writes current PDL-03 old root shim evidence without mutating git state', async () => {
    const register = await runPendingDeletionOldRootShimReplacementRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-old-root-shim-replacement-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-old-root-shim-replacement-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(3)
    expect(register.pathCount).toBe(8)
    expect(register.entrypointLauncherEntryCount).toBe(1)
    expect(register.directConnectProviderEntryCount).toBe(1)
    expect(register.verificationToolingEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownReplacementOwnerEntryCount).toBe(0)
    expect(register.oldShimRuntimeAllowed).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
