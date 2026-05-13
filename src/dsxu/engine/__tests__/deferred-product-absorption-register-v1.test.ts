import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import {
  buildDeferredProductAbsorptionRegister,
  validateDeferredProductAbsorptionReviewManifest,
} from '../deferred-product-absorption-register-v1'
import { runDeferredProductAbsorptionRegisterHarness } from '../../integration/harness/deferred-product-absorption-register-v1-harness'

const baseInput = {
  dirtyTotal: 0,
  trackedDirtyCount: 0,
  untrackedCount: 0,
  deletedCount: 0,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PASS',
  mainlineDirtyNextAction: 'review-owner-git-closure',
  mainlineKeepOwnerSliceCount: 0,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 0,
  replaceDeleteEvidenceVerifiedCount: 0,
  replaceDeleteMissingEvidenceCount: 0,
  pendingDeletionCount: 0,
  pendingDeletionStatus: 'PASS',
  pendingDeletionSubSliceCount: 0,
  pendingDeletionVerifiedSubSliceCount: 0,
  pendingDeletionMissingEvidenceCount: 0,
  p12RawStatus: 'PASS',
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  p12RawNextAction: 'ready-for-delta-review',
  deferredEvalIds: [],
  deferredProductIds: ['PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'],
  localArtifactPolicyKnown: true,
  permissionBlockedResidualCount: 0,
  cleanExportReady: true,
  releaseClosureStatus: 'PASS',
  canCreateCleanExport: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/owner-git-closure-board-v1/input.json'],
}

function buildReviewManifest(decision: 'defer' | 'reject' | 'adjust' = 'defer') {
  const board = buildOwnerGitClosureBoard(baseInput)
  const currentMapping = buildDeferredProductAbsorptionRegister(board)
  return validateDeferredProductAbsorptionReviewManifest({
    schemaVersion: 'dsxu.deferred-product-absorption-review-manifest.v1',
    laneId: 'OGC-04',
    decisions: currentMapping.entries.map(entry => ({
      productId: entry.id,
      decision,
      reviewer: 'codex-deferred-product-owner-review',
      reviewedAt: '2026-05-13T00:00:00.000Z',
      mainlineOwner: entry.mainlineOwner,
      boundary: entry.boundary,
      notes: 'signed deferred product owner review; keep as deferred boundary and do not create a second runtime',
    })),
  })
}

describe('OGC-04 - Deferred Product Absorption Register V1', () => {
  test('maps deferred product surfaces to original-side owners without runtime implementation', () => {
    const board = buildOwnerGitClosureBoard(baseInput)
    const register = buildDeferredProductAbsorptionRegister(board)

    expect(register.schemaVersion).toBe('dsxu.deferred-product-absorption-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(6)
    expect(register.knownDeferredProductCount).toBe(6)
    expect(register.unknownDeferredProductCount).toBe(0)
    expect(register.adapterBoundaryCount).toBe(2)
    expect(register.productSurfaceBoundaryCount).toBe(4)
    expect(register.standaloneRuntimeCandidateCount).toBe(0)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotImplementRuntimeShortcut).toBe(true)
    expect(register.nextAction).toBe('deferred-product-owner-review-required')
    expect(register.entries.find(entry => entry.id === 'PZ06')?.mainlineOwner).toContain('Query Loop')
    expect(register.entries.find(entry => entry.id === 'PZ06')?.forbiddenActions.join('\n')).toContain('do not create a second query loop')
    expect(register.entries.find(entry => entry.id === 'PZ08')?.forbiddenActions.join('\n')).toContain('do not create a second agent orchestrator')
  })

  test('closes deferred product absorption only when all mapped surfaces are explicitly signed as deferred', () => {
    const board = buildOwnerGitClosureBoard(baseInput)
    const register = buildDeferredProductAbsorptionRegister(board, {
      reviewManifest: buildReviewManifest(),
    })

    expect(register.status).toBe('PASS')
    expect(register.reviewManifestStatus).toBe('PASS')
    expect(register.reviewSignedCount).toBe(6)
    expect(register.reviewUnsignedCount).toBe(0)
    expect(register.reviewRejectedCount).toBe(0)
    expect(register.reviewAdjustRequestedCount).toBe(0)
    expect(register.entries.every(entry => entry.status === 'PASS')).toBe(true)
    expect(register.nextAction).toBe('deferred-product-absorption-closed')
  })

  test('blocks unknown deferred product surfaces instead of putting them in a generic bucket', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      deferredProductIds: ['PZ06', 'PZ99'],
    })
    const register = buildDeferredProductAbsorptionRegister(board)

    expect(register.status).toBe('BLOCKED')
    expect(register.unknownDeferredProductCount).toBe(1)
    expect(register.standaloneRuntimeCandidateCount).toBe(1)
    expect(register.blockers).toContain('deferred product surfaces include unknown owners')
    expect(register.entries.find(entry => entry.id === 'PZ99')?.redlines).toContain('unknown deferred product surface')
    expect(register.nextAction).toBe('fix-unknown-deferred-product-surface')
  })

  test('passes only when no deferred product surface remains', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      deferredProductIds: [],
    })
    const register = buildDeferredProductAbsorptionRegister(board)

    expect(register.status).toBe('PASS')
    expect(register.entryCount).toBe(0)
    expect(register.mustNotImplementRuntimeShortcut).toBe(false)
    expect(register.nextAction).toBe('deferred-product-absorption-closed')
  })

  test('blocks deferred product owner review rejection or stale owner mapping', () => {
    const board = buildOwnerGitClosureBoard(baseInput)
    const rejected = buildDeferredProductAbsorptionRegister(board, {
      reviewManifest: buildReviewManifest('reject'),
    })
    const currentMapping = buildDeferredProductAbsorptionRegister(board)
    const stale = buildDeferredProductAbsorptionRegister(board, {
      reviewManifest: validateDeferredProductAbsorptionReviewManifest({
        schemaVersion: 'dsxu.deferred-product-absorption-review-manifest.v1',
        laneId: 'OGC-04',
        decisions: currentMapping.entries.map((entry, index) => ({
          productId: entry.id,
          decision: 'defer',
          reviewer: 'codex-deferred-product-owner-review',
          reviewedAt: '2026-05-13T00:00:00.000Z',
          mainlineOwner: index === 0 ? `${entry.mainlineOwner} stale` : entry.mainlineOwner,
          boundary: entry.boundary,
          notes: 'signed deferred product owner review',
        })),
      }),
    })

    expect(rejected.status).toBe('BLOCKED')
    expect(rejected.reviewRejectedCount).toBe(6)
    expect(stale.status).toBe('BLOCKED')
    expect(stale.reviewStaleCount).toBe(1)
    expect(stale.entries.find(entry => entry.id === 'PZ01')?.redlines.join('\n')).toContain('does not match')
  })

  test('writes current deferred product absorption register without creating runtime shortcuts', async () => {
    const register = await runDeferredProductAbsorptionRegisterHarness()

    expect(register.evidencePath).toContain('deferred-product-absorption-register.evidence.json')
    expect(register.tracePath).toContain('deferred-product-absorption-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PASS')
    expect(register.entryCount).toBe(6)
    expect(register.knownDeferredProductCount).toBe(6)
    expect(register.unknownDeferredProductCount).toBe(0)
    expect(register.adapterBoundaryCount).toBe(2)
    expect(register.productSurfaceBoundaryCount).toBe(4)
    expect(register.standaloneRuntimeCandidateCount).toBe(0)
    expect(register.reviewManifestStatus).toBe('PASS')
    expect(register.reviewSignedCount).toBe(6)
    expect(register.reviewUnsignedCount).toBe(0)
    expect(register.nextAction).toBe('deferred-product-absorption-closed')
    expect(register.entries.map(entry => entry.id)).toEqual(['PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'])
    expect(register.entries.find(entry => entry.id === 'PZ01')?.boundary).toContain('provider/control-plane adapter')
    expect(register.entries.find(entry => entry.id === 'PZ04')?.forbiddenActions.join('\n')).toContain('standalone desktop executor')
  }, 120_000)
})
