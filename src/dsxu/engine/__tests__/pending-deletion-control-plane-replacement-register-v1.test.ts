import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionControlPlaneReplacementRegister } from '../pending-deletion-control-plane-replacement-register-v1'
import type { PendingDeletionReviewLanesRegister } from '../pending-deletion-review-lanes-register-v1'
import { runPendingDeletionControlPlaneReplacementRegisterHarness } from '../../integration/harness/pending-deletion-control-plane-replacement-register-v1-harness'

const sourceRegister: PendingDeletionReviewLanesRegister = {
  schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  laneCount: 1,
  entryCount: 4,
  mainlineReplacementDeleteEntryCount: 4,
  releaseExcludedDeleteEntryCount: 0,
  oldRootShimDeleteEntryCount: 0,
  missingReplacementEvidenceEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  lanes: [
    {
      id: 'PDL-01',
      name: 'mainline replacement deletion review',
      status: 'PARTIAL',
      owner: 'Control Plane / Mainline Replacement Owners',
      entryCount: 4,
      pathCount: 37,
      replacementEvidenceVerifiedCount: 4,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close legacy control-plane shell deletions through normal Git review after replacement evidence is signed',
      redlines: [],
      entries: [
        {
          id: 'PDR-01.01',
          owner: 'Control Plane Replacement Owner',
          targetOwner: 'DSXU Control Plane and direct-connect lifecycle tests',
          closureDecision: 'mainline-replacement-delete',
          status: 'PARTIAL',
          pathCount: 8,
          replacementEvidence: [
            'control-plane-v1.test.ts',
            'control-plane-stage-acceptance-v1.test.ts',
            'direct-connect-and-query-contract-v1.test.ts',
          ],
          samplePaths: ['src/bridge/bridgeApi.ts'],
          restorePolicy: 'do-not-restore-old-runtime-shell',
          requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-01.02',
          owner: 'Control Plane Replacement Owner',
          targetOwner: 'DSXU control-plane permission/session replacement evidence',
          closureDecision: 'mainline-replacement-delete',
          status: 'PARTIAL',
          pathCount: 7,
          replacementEvidence: [
            'control-plane-stage-acceptance-v1.test.ts',
            'v9-permission-usability-v1.test.ts',
            'allowed-tools-permission-floor-v1.test.ts',
          ],
          samplePaths: ['src/bridge/bridgePermissionCallbacks.ts'],
          restorePolicy: 'do-not-restore-old-runtime-shell',
          requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-01.03',
          owner: 'Control Plane Replacement Owner',
          targetOwner: 'DSXU remote network workflow and control-plane transport evidence',
          closureDecision: 'mainline-replacement-delete',
          status: 'PARTIAL',
          pathCount: 9,
          replacementEvidence: [
            'remote-network-workflow-v1.test.ts',
            'network-facade-v1.test.ts',
            'direct-connect-and-query-contract-v1.test.ts',
          ],
          samplePaths: ['src/bridge/bridgeMessaging.ts'],
          restorePolicy: 'do-not-restore-old-runtime-shell',
          requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
          forbiddenActions: ['do not stage this entry automatically'],
          redlines: [],
        },
        {
          id: 'PDR-01.04',
          owner: 'Control Plane Replacement Owner',
          targetOwner: 'DSXU visible-state/control-plane diagnostics evidence',
          closureDecision: 'mainline-replacement-delete',
          status: 'PARTIAL',
          pathCount: 13,
          replacementEvidence: [
            'query-loop-visible-copy-v1.test.ts',
            'streaming-ui-visibility-v1.test.ts',
            'control-plane-stage-acceptance-v1.test.ts',
          ],
          samplePaths: ['src/bridge/bridgeDebug.ts'],
          restorePolicy: 'do-not-restore-old-runtime-shell',
          requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
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

describe('OGC-02B - Pending Deletion Control Plane Replacement Register V1', () => {
  test('maps PDL-01 bridge deletion entries to original mainline owners without standalone runtime', () => {
    const register = buildPendingDeletionControlPlaneReplacementRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-control-plane-replacement-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.sourceLaneStatus).toBe('PARTIAL')
    expect(register.entryCount).toBe(4)
    expect(register.pathCount).toBe(37)
    expect(register.runtimeShellEntryCount).toBe(1)
    expect(register.permissionSessionEntryCount).toBe(1)
    expect(register.transportEntryCount).toBe(1)
    expect(register.visibleStateEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownReplacementOwnerEntryCount).toBe(0)
    expect(register.standaloneRuntimeAllowed).toBe(false)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('control-plane-replacement-git-review-required')
    expect(register.entries.map(entry => entry.replacementOwner)).toEqual([
      'control-plane-runtime-shell',
      'control-plane-permission-session',
      'remote-network-transport',
      'visible-state-diagnostics',
    ])
  })

  test('blocks missing replacement evidence instead of keeping a compatibility bridge runtime', () => {
    const register = buildPendingDeletionControlPlaneReplacementRegister({
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
    expect(register.blockers).toContain('control-plane replacement entries have missing evidence')
    expect(register.nextAction).toBe('fix-control-plane-replacement-evidence')
    expect(register.standaloneRuntimeAllowed).toBe(false)
  })

  test('writes current PDL-01 replacement evidence without mutating git state', async () => {
    const register = await runPendingDeletionControlPlaneReplacementRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-control-plane-replacement-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-control-plane-replacement-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(4)
    expect(register.pathCount).toBe(37)
    expect(register.runtimeShellEntryCount).toBe(1)
    expect(register.permissionSessionEntryCount).toBe(1)
    expect(register.transportEntryCount).toBe(1)
    expect(register.visibleStateEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.unknownReplacementOwnerEntryCount).toBe(0)
    expect(register.standaloneRuntimeAllowed).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
