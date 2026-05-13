import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitReplaceDeleteReviewRegister } from '../owner-git-replace-delete-review-register-v1'
import type { OwnerGitImportUseEvidenceRegister } from '../owner-git-import-use-evidence-register-v1'
import { runOwnerGitReplaceDeleteReviewRegisterHarness } from '../../integration/harness/owner-git-replace-delete-review-register-v1-harness'

const sourceRegister: OwnerGitImportUseEvidenceRegister = {
  schemaVersion: 'dsxu.owner-git-import-use-evidence-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  entryCount: 2,
  mainlineKeepEntryCount: 0,
  replaceDeleteEntryCount: 2,
  importedOrReferencedEntryCount: 2,
  sampleExistsOnlyEntryCount: 0,
  missingSamplePathEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [
    {
      id: 'MDR-02.01',
      owner: 'Engine Analysis Owner',
      targetOwner: 'named DSXU mainline owner',
      decision: 'replace-delete-candidate',
      disposition: 'ready-replace-delete-review',
      status: 'PARTIAL',
      pathCount: 3,
      sampledPathCount: 3,
      existingSamplePathCount: 0,
      importedSamplePathCount: 0,
      referencedSamplePathCount: 3,
      ownerEvidenceStatus: 'IMPORT_OR_REFERENCE_FOUND',
      requiredAction: 'close deleted engine analyzer source through normal git review',
      sampleEvidence: [
        {
          path: 'src/dsxu/engine/analyzers/classification-analyzer.ts',
          exists: false,
          importerPaths: [],
          referencePaths: ['src/dsxu/engine/__tests__/mainline-dirty-review-v1.test.ts'],
        },
      ],
      evidence: ['task-analyzer.test.ts', 'quality-gate-mainline-v1.test.ts'],
      redlines: ['replace-delete-candidate requires explicit owner review before keep'],
    },
    {
      id: 'MDR-03.02',
      owner: 'Verification Cleanup Owner',
      targetOwner: 'current focused verification files only',
      decision: 'replace-delete-candidate',
      disposition: 'ready-replace-delete-review',
      status: 'PARTIAL',
      pathCount: 1,
      sampledPathCount: 1,
      existingSamplePathCount: 1,
      importedSamplePathCount: 0,
      referencedSamplePathCount: 1,
      ownerEvidenceStatus: 'IMPORT_OR_REFERENCE_FOUND',
      requiredAction: 'confirm current focused test replaces this backup before normal git review',
      sampleEvidence: [
        {
          path: 'src/dsxu/engine/__tests__/engine.test.ts.backup',
          exists: true,
          importerPaths: [],
          referencePaths: ['src/dsxu/engine/mainline-dirty-review-v1.ts'],
        },
      ],
      evidence: ['engine.test.ts'],
      redlines: ['replace-delete-candidate requires explicit owner review before keep'],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'owner-git-import-use-review-required',
}

describe('OGC-01B - Owner Git Replace/Delete Review Register V1', () => {
  test('splits deleted source replacement review from backup cleanup review', () => {
    const register = buildOwnerGitReplaceDeleteReviewRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.owner-git-replace-delete-review-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(2)
    expect(register.deletedSourceReplacementEntryCount).toBe(1)
    expect(register.backupCleanupEntryCount).toBe(1)
    expect(register.existingDuplicateEntryCount).toBe(0)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('replace-delete-git-review-required')
    expect(register.entries.find(entry => entry.id === 'MDR-02.01')?.disposition).toBe('deleted-source-replacement-review')
    expect(register.entries.find(entry => entry.id === 'MDR-03.02')?.disposition).toBe('backup-cleanup-review')
    expect(register.entries.find(entry => entry.id === 'MDR-02.01')?.forbiddenActions.join('\n')).toContain('do not restore deleted source')
  })

  test('splits existing duplicate candidates from backup cleanup review', () => {
    const register = buildOwnerGitReplaceDeleteReviewRegister({
      ...sourceRegister,
      entries: [
        ...sourceRegister.entries,
        {
          ...sourceRegister.entries[1],
          id: 'MDR-03.09',
          owner: 'Recovery Verification Replacement Owner',
          targetOwner: 'full recovery runtime, query-loop, and scenario verification mainline',
          pathCount: 3,
          sampledPathCount: 3,
          existingSamplePathCount: 3,
          sampleEvidence: [
            {
              path: 'src/dsxu/engine/__tests__/recovery-decision-v3-minimal.test.ts',
              exists: true,
              importerPaths: [],
              referencePaths: ['src/dsxu/engine/mainline-dirty-review-v1.ts'],
            },
          ],
          evidence: ['recovery-runtime-v3.test.ts'],
        },
      ],
    })

    expect(register.entryCount).toBe(3)
    expect(register.deletedSourceReplacementEntryCount).toBe(1)
    expect(register.backupCleanupEntryCount).toBe(1)
    expect(register.existingDuplicateEntryCount).toBe(1)
    expect(register.entries.find(entry => entry.id === 'MDR-03.09')?.disposition).toBe('existing-duplicate-review')
  })

  test('blocks replace/delete candidates when replacement evidence is missing', () => {
    const register = buildOwnerGitReplaceDeleteReviewRegister({
      ...sourceRegister,
      entries: [
        {
          ...sourceRegister.entries[0],
          evidence: [],
        },
      ],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.missingReplacementEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('replace/delete candidates have missing replacement evidence')
    expect(register.nextAction).toBe('fix-missing-replacement-evidence')
  })

  test('writes current replace/delete review register without mutating git state', async () => {
    const register = await runOwnerGitReplaceDeleteReviewRegisterHarness()

    expect(register.evidencePath).toContain('owner-git-replace-delete-review-register.evidence.json')
    expect(register.tracePath).toContain('owner-git-replace-delete-review-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(31)
    expect(register.deletedSourceReplacementEntryCount).toBe(18)
    expect(register.backupCleanupEntryCount).toBe(1)
    expect(register.existingDuplicateEntryCount).toBe(12)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.entries.map(entry => entry.id)).toEqual([
      'MDR-01.01',
      'MDR-02.01',
      'MDR-02.06',
      'MDR-02.07',
      'MDR-02.08',
      'MDR-02.09',
      'MDR-02.10',
      'MDR-02.11',
      'MDR-02.12',
      'MDR-02.13',
      'MDR-02.14',
      'MDR-03.02',
      'MDR-03.07',
      'MDR-03.08',
      'MDR-03.09',
      'MDR-03.10',
      'MDR-03.11',
      'MDR-03.12',
      'MDR-03.13',
      'MDR-03.14',
      'MDR-03.15',
      'MDR-08.02',
      'MDR-08.04',
      'LMR-03.02',
      'LMR-03.04.01',
      'LMR-03.06.01',
      'LMR-03.07.04',
      'LMR-06.01',
      'LMR-02C.06',
      'LMR-02C.08',
      'LMR-02K.02',
    ])
    expect(register.entries.every(entry => entry.replacementEvidence.length > 0)).toBe(true)
    expect(register.entries.find(entry => entry.id === 'MDR-01.01')?.disposition).toBe('existing-duplicate-review')
    expect(register.entries.find(entry => entry.id === 'MDR-01.01')?.replacementEvidence).toContain('provider-contract-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-02.06')?.replacementEvidence).toContain('control-plane-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-02.10')?.replacementEvidence).toContain('deferred-product-absorption-register-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-02.13')?.disposition).toBe('existing-duplicate-review')
    expect(register.entries.find(entry => entry.id === 'MDR-02.13')?.replacementEvidence).toContain('provider-contract-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-02.14')?.replacementEvidence).toContain('task-runtime-mainline-v1-clean.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.07')?.replacementEvidence).toContain('proxy-budget-guard.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.08')?.replacementEvidence).toContain('tool-evidence-pack-contract-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.09')?.disposition).toBe('existing-duplicate-review')
    expect(register.entries.find(entry => entry.id === 'MDR-03.10')?.disposition).toBe('existing-duplicate-review')
    expect(register.entries.find(entry => entry.id === 'MDR-03.11')?.replacementEvidence).toContain('owner-git-closure-board-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.12')?.replacementEvidence).toContain('source-encoding-boundary-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.13')?.replacementEvidence).toContain('recovery-runtime-v3.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.14')?.replacementEvidence).toContain('coordinator-mainline-v4-strong.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-03.15')?.replacementEvidence).toContain('kairos-session-mainline-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-08.02')?.replacementEvidence).toContain('hitl.test.ts')
    expect(register.entries.find(entry => entry.id === 'MDR-08.04')?.replacementEvidence).toContain('context-owner-rule-contract-v1.test.ts')
    expect(register.entries.find(entry => entry.id === 'LMR-02C.06')?.disposition).toBe('deleted-source-replacement-review')
    expect(register.entries.find(entry => entry.id === 'LMR-02C.08')?.disposition).toBe('existing-duplicate-review')
    expect(register.entries.find(entry => entry.id === 'LMR-02K.02')?.replacementEvidence).toContain('query-loop-visible-copy-v1.test.ts')
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
