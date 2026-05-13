import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitMainlineKeepReviewRegister } from '../owner-git-mainline-keep-review-register-v1'
import type { OwnerGitImportUseEvidenceRegister } from '../owner-git-import-use-evidence-register-v1'
import { runOwnerGitMainlineKeepReviewRegisterHarness } from '../../integration/harness/owner-git-mainline-keep-review-register-v1-harness'

const sourceRegister: OwnerGitImportUseEvidenceRegister = {
  schemaVersion: 'dsxu.owner-git-import-use-evidence-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  entryCount: 2,
  mainlineKeepEntryCount: 2,
  replaceDeleteEntryCount: 0,
  importedOrReferencedEntryCount: 1,
  sampleExistsOnlyEntryCount: 1,
  missingSamplePathEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [
    {
      id: 'MDR-02.05',
      owner: 'Runtime Contract Owner',
      targetOwner: 'single runtime/tool lifecycle mainline',
      decision: 'map-to-mainline-owner',
      disposition: 'ready-mainline-owner-signoff',
      status: 'PARTIAL',
      pathCount: 2,
      sampledPathCount: 1,
      existingSamplePathCount: 1,
      importedSamplePathCount: 1,
      referencedSamplePathCount: 1,
      ownerEvidenceStatus: 'IMPORT_OR_REFERENCE_FOUND',
      requiredAction: 'map to named mainline owner and verify no duplicate runtime or owner path is introduced',
      sampleEvidence: [
        {
          path: 'src/dsxu/engine/runtime-core.ts',
          exists: true,
          importerPaths: ['src/dsxu/engine/tool-gate-v1.ts'],
          referencePaths: ['src/dsxu/engine/tool-runtime-dirty-review-v1.ts'],
        },
      ],
      evidence: ['tool-runtime-dirty-review-v1.test.ts'],
      redlines: [],
    },
    {
      id: 'MDR-03.03',
      owner: 'Engine Unit Verification Owner',
      targetOwner: 'named DSXU mainline owner',
      decision: 'map-to-mainline-owner',
      disposition: 'ready-mainline-owner-signoff',
      status: 'PARTIAL',
      pathCount: 1,
      sampledPathCount: 1,
      existingSamplePathCount: 1,
      importedSamplePathCount: 0,
      referencedSamplePathCount: 0,
      ownerEvidenceStatus: 'SAMPLE_EXISTS_WITH_OWNER_EVIDENCE',
      requiredAction: 'map to named mainline owner and verify no duplicate runtime or owner path is introduced',
      sampleEvidence: [
        {
          path: 'src/dsxu/engine/__tests__/engine.test.ts',
          exists: true,
          importerPaths: [],
          referencePaths: [],
        },
      ],
      evidence: ['engine.test.ts'],
      redlines: [],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'owner-git-import-use-review-required',
}

describe('OGC-01C - Owner Git Mainline Keep Review Register V1', () => {
  test('keeps mainline keep entries owner-specific even when evidence exists', () => {
    const register = buildOwnerGitMainlineKeepReviewRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.owner-git-mainline-keep-review-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(2)
    expect(register.importOrReferenceEvidenceEntryCount).toBe(1)
    expect(register.sampleExistsOwnerEvidenceEntryCount).toBe(1)
    expect(register.missingOwnerEvidenceEntryCount).toBe(0)
    expect(register.uniqueOwnerCount).toBe(2)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('mainline-keep-owner-signoff-required')
    expect(register.entries.find(entry => entry.id === 'MDR-02.05')?.forbiddenActions.join('\n')).toContain('do not treat import/use evidence as owner signoff')
  })

  test('blocks mainline keep entries when owner evidence is missing', () => {
    const register = buildOwnerGitMainlineKeepReviewRegister({
      ...sourceRegister,
      entries: [
        {
          ...sourceRegister.entries[0],
          evidence: [],
        },
      ],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.missingOwnerEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('mainline keep entries have missing owner/import-use evidence')
    expect(register.nextAction).toBe('fix-missing-mainline-owner-evidence')
  })

  test('writes current mainline keep review register without mutating git state', async () => {
    const register = await runOwnerGitMainlineKeepReviewRegisterHarness()

    expect(register.evidencePath).toContain('owner-git-mainline-keep-review-register.evidence.json')
    expect(register.tracePath).toContain('owner-git-mainline-keep-review-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(28)
    expect(register.importOrReferenceEvidenceEntryCount).toBe(28)
    expect(register.sampleExistsOwnerEvidenceEntryCount).toBe(0)
    expect(register.missingOwnerEvidenceEntryCount).toBe(0)
    expect(register.uniqueOwnerCount).toBeGreaterThan(10)
    expect(register.entries.every(entry => entry.ownerEvidence.length > 0)).toBe(true)
    expect(register.entries.map(entry => entry.id)).not.toContain('MDR-02.01')
    expect(register.entries.map(entry => entry.id)).not.toContain('MDR-08.02')
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
