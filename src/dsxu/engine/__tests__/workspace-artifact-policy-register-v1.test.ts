import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import {
  WORKSPACE_PERMISSION_BLOCKED_RESIDUES,
  buildWorkspaceArtifactPolicyRegister,
  validateWorkspacePermissionResidueClosureManifest,
} from '../workspace-artifact-policy-register-v1'
import { runWorkspaceArtifactPolicyRegisterHarness } from '../../integration/harness/workspace-artifact-policy-register-v1-harness'

const baseInput = {
  dirtyTotal: 12,
  trackedDirtyCount: 8,
  untrackedCount: 3,
  deletedCount: 4,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PARTIAL',
  mainlineDirtyNextAction: 'review-owner-git-closure',
  mainlineKeepOwnerSliceCount: 1,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 0,
  replaceDeleteEvidenceVerifiedCount: 0,
  replaceDeleteMissingEvidenceCount: 0,
  pendingDeletionCount: 4,
  pendingDeletionStatus: 'PARTIAL',
  pendingDeletionSubSliceCount: 1,
  pendingDeletionVerifiedSubSliceCount: 1,
  pendingDeletionMissingEvidenceCount: 0,
  p12RawStatus: 'PASS',
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  p12RawNextAction: 'ready-for-delta-review',
  deferredEvalIds: [],
  deferredProductIds: [],
  localArtifactPolicyKnown: true,
  permissionBlockedResidualCount: 5,
  cleanExportReady: true,
  releaseClosureStatus: 'PASS',
  canCreateCleanExport: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/owner-git-closure-board-v1/input.json'],
}

function buildPermissionClosureManifest(decision: 'sign' | 'reject' | 'adjust' = 'sign') {
  return validateWorkspacePermissionResidueClosureManifest({
    schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest.v1',
    laneId: 'OGC-05',
    decisions: WORKSPACE_PERMISSION_BLOCKED_RESIDUES.map(residue => ({
      ...residue,
      decision,
      reviewer: 'codex-workspace-permission-review',
      reviewedAt: '2026-05-13T00:00:00.000Z',
      notes: 'external copy or record exists; source path remains an external permission closure item and is not force-deleted',
    })),
  })
}

describe('OGC-05 - Workspace Artifact Policy Register V1', () => {
  test('separates local artifacts, owner review paths, pending deletions, and permission residues', () => {
    const board = buildOwnerGitClosureBoard(baseInput)
    const register = buildWorkspaceArtifactPolicyRegister(board)

    expect(register.schemaVersion).toBe('dsxu.workspace-artifact-policy-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(6)
    expect(register.localArtifactEntryCount).toBe(3)
    expect(register.ownerReviewEntryCount).toBe(1)
    expect(register.pendingDeletionEntryCount).toBe(1)
    expect(register.permissionExternalClosureEntryCount).toBe(1)
    expect(register.permissionResidueClosureManifestStatus).toBe('NOT_PROVIDED')
    expect(register.permissionResidueSignedCount).toBe(0)
    expect(register.permissionResidueUnsignedCount).toBe(5)
    expect(register.releaseExcludedEntryCount).toBe(3)
    expect(register.unresolvedWorkspacePolicyCount).toBe(0)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotCleanOrDelete).toBe(true)
    expect(register.nextAction).toBe('workspace-owner-review-required')
    expect(register.entries.find(entry => entry.id === 'workspace.dsxu-evidence')?.forbiddenActions.join('\n')).toContain('do not delete evidence directories')
    expect(register.entries.find(entry => entry.id === 'workspace.permission-blocked-residues')?.sourcePolicy).toBe('external-closure-only')
  })

  test('does not treat .git, node_modules, or .dsxu as source cleanup targets', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      untrackedCount: 0,
      deletedCount: 0,
      permissionBlockedResidualCount: 0,
    })
    const register = buildWorkspaceArtifactPolicyRegister(board)

    expect(register.status).toBe('PASS')
    expect(register.entryCount).toBe(3)
    expect(register.releaseExcludedEntryCount).toBe(3)
    expect(register.mustNotCleanOrDelete).toBe(false)
    expect(register.entries.map(entry => entry.id)).toEqual([
      'workspace.git-store',
      'workspace.node-modules',
      'workspace.dsxu-evidence',
    ])
    expect(register.entries.every(entry => entry.sourcePolicy === 'keep-local')).toBe(true)
  })

  test('closes permission residue lane only when all five residues are explicitly signed', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      untrackedCount: 0,
      deletedCount: 0,
    })
    const register = buildWorkspaceArtifactPolicyRegister(board, {
      permissionResidueClosureManifest: buildPermissionClosureManifest(),
    })

    expect(register.status).toBe('PASS')
    expect(register.permissionResidueClosureManifestStatus).toBe('PASS')
    expect(register.permissionResidueSignedCount).toBe(5)
    expect(register.permissionResidueUnsignedCount).toBe(0)
    expect(register.permissionResidueStaleCount).toBe(0)
    expect(register.mustNotCleanOrDelete).toBe(false)
    expect(register.nextAction).toBe('workspace-artifact-policy-closed')
    expect(register.entries.find(entry => entry.id === 'workspace.permission-blocked-residues')?.status).toBe('PASS')
  })

  test('blocks permission residue lane when owner review rejects or requests adjustment', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      untrackedCount: 0,
      deletedCount: 0,
    })

    const rejected = buildWorkspaceArtifactPolicyRegister(board, {
      permissionResidueClosureManifest: buildPermissionClosureManifest('reject'),
    })
    const adjustment = buildWorkspaceArtifactPolicyRegister(board, {
      permissionResidueClosureManifest: buildPermissionClosureManifest('adjust'),
    })

    expect(rejected.status).toBe('BLOCKED')
    expect(rejected.permissionResidueRejectedCount).toBe(5)
    expect(rejected.nextAction).toBe('fix-unresolved-workspace-policy')
    expect(adjustment.status).toBe('BLOCKED')
    expect(adjustment.permissionResidueAdjustRequestedCount).toBe(5)
  })

  test('blocks stale permission residue signatures when source path no longer matches', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      untrackedCount: 0,
      deletedCount: 0,
    })
    const manifest = validateWorkspacePermissionResidueClosureManifest({
      schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest.v1',
      laneId: 'OGC-05',
      decisions: WORKSPACE_PERMISSION_BLOCKED_RESIDUES.map((residue, index) => ({
        ...residue,
        sourcePath: index === 0 ? `${residue.sourcePath}-stale` : residue.sourcePath,
        decision: 'sign',
        reviewer: 'codex-workspace-permission-review',
        reviewedAt: '2026-05-13T00:00:00.000Z',
        notes: 'external copy or record exists; source path remains an external permission closure item and is not force-deleted',
      })),
    })
    const register = buildWorkspaceArtifactPolicyRegister(board, {
      permissionResidueClosureManifest: manifest,
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.permissionResidueSignedCount).toBe(4)
    expect(register.permissionResidueStaleCount).toBe(1)
    expect(register.unresolvedWorkspacePolicyCount).toBe(1)
    expect(register.entries.find(entry => entry.id === 'workspace.permission-blocked-residues')?.redlines.join('\n')).toContain('signed sourcePath does not match')
  })

  test('writes current workspace artifact policy without cleaning files', async () => {
    const register = await runWorkspaceArtifactPolicyRegisterHarness()

    expect(register.evidencePath).toContain('workspace-artifact-policy-register.evidence.json')
    expect(register.tracePath).toContain('workspace-artifact-policy-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.localArtifactEntryCount).toBe(3)
    expect(register.releaseExcludedEntryCount).toBe(3)
    expect(register.ownerReviewEntryCount).toBe(1)
    expect(register.pendingDeletionEntryCount).toBe(1)
    expect(register.permissionExternalClosureEntryCount).toBe(1)
    expect(register.entries.find(entry => entry.id === 'workspace.untracked-owner-review')?.count).toBeGreaterThan(0)
    expect(register.entries.find(entry => entry.id === 'workspace.deleted-pending-review')?.count).toBeGreaterThan(0)
    expect(register.entries.find(entry => entry.id === 'workspace.permission-blocked-residues')?.count).toBe(5)
  }, 120_000)
})
