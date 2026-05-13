import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitImportUseEvidenceRegister } from '../owner-git-import-use-evidence-register-v1'
import type { OwnerGitSignoffRegister } from '../owner-git-signoff-register-v1'
import { runOwnerGitImportUseEvidenceRegisterHarness } from '../../integration/harness/owner-git-import-use-evidence-register-v1-harness'

const baseSignoffRegister: OwnerGitSignoffRegister = {
  schemaVersion: 'dsxu.owner-git-signoff-register.v1',
  status: 'PARTIAL',
  sourceBoardStatus: 'BLOCKED',
  sourceDirtyTotal: 3,
  entryCount: 2,
  mainlineKeepEntryCount: 1,
  replaceDeleteEntryCount: 1,
  evidenceVerifiedEntryCount: 2,
  missingEvidenceEntryCount: 0,
  ownerSignoffRequiredCount: 2,
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
      evidenceStatus: 'VERIFIED_FOR_SIGNOFF',
      requiredAction: 'map to named mainline owner and verify no duplicate runtime or owner path is introduced',
      forbiddenActions: ['do not stage this entry automatically'],
      evidence: ['tool-runtime-dirty-review-v1.test.ts'],
      samplePaths: ['src/dsxu/engine/runtime-core.ts'],
      redlines: [],
    },
    {
      id: 'MDR-03.02',
      owner: 'Verification Cleanup Owner',
      targetOwner: 'current focused verification files only',
      decision: 'replace-delete-candidate',
      disposition: 'ready-replace-delete-review',
      status: 'PARTIAL',
      pathCount: 1,
      evidenceStatus: 'VERIFIED_FOR_SIGNOFF',
      requiredAction: 'confirm current focused test replaces this backup before normal git review',
      forbiddenActions: ['do not restore old paths to reduce dirty count'],
      evidence: ['engine.test.ts'],
      samplePaths: ['src/dsxu/engine/__tests__/engine.test.ts.backup'],
      redlines: ['replace-delete-candidate requires explicit owner review before keep'],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'owner-signoff-required',
}

describe('OGC-01A - Owner Git Import/Use Evidence Register V1', () => {
  test('narrows owner signoff with import/use evidence without replacing owner review', () => {
    const register = buildOwnerGitImportUseEvidenceRegister({
      signoffRegister: baseSignoffRegister,
      sampleUsageEvidence: [
        {
          path: 'src/dsxu/engine/runtime-core.ts',
          exists: true,
          importerPaths: ['src/dsxu/engine/tool-gate-v1.ts'],
          referencePaths: ['src/dsxu/engine/tool-runtime-dirty-review-v1.ts'],
        },
        {
          path: 'src/dsxu/engine/__tests__/engine.test.ts.backup',
          exists: false,
          importerPaths: [],
          referencePaths: [],
        },
      ],
    })

    expect(register.schemaVersion).toBe('dsxu.owner-git-import-use-evidence-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.mainlineKeepEntryCount).toBe(1)
    expect(register.replaceDeleteEntryCount).toBe(1)
    expect(register.importedOrReferencedEntryCount).toBe(1)
    expect(register.missingSamplePathEntryCount).toBe(0)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('owner-git-import-use-review-required')
    expect(register.entries.find(entry => entry.id === 'MDR-02.05')?.ownerEvidenceStatus).toBe('IMPORT_OR_REFERENCE_FOUND')
    expect(register.entries.find(entry => entry.id === 'MDR-03.02')?.ownerEvidenceStatus).toBe('SAMPLE_EXISTS_WITH_OWNER_EVIDENCE')
  })

  test('blocks mainline owner entries when sampled paths are missing', () => {
    const register = buildOwnerGitImportUseEvidenceRegister({
      signoffRegister: baseSignoffRegister,
      sampleUsageEvidence: [
        {
          path: 'src/dsxu/engine/runtime-core.ts',
          exists: false,
          importerPaths: [],
          referencePaths: [],
        },
      ],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.missingSamplePathEntryCount).toBe(1)
    expect(register.blockers).toContain('mainline owner entries have missing sample path evidence')
    expect(register.entries.find(entry => entry.id === 'MDR-02.05')?.redlines).toContain('mainline owner sample paths are missing from workspace')
    expect(register.nextAction).toBe('fix-missing-sample-path-evidence')
  })

  test('writes current import/use signoff evidence without mutating git state', async () => {
    const register = await runOwnerGitImportUseEvidenceRegisterHarness()

    expect(register.evidencePath).toContain('owner-git-import-use-evidence-register.evidence.json')
    expect(register.tracePath).toContain('owner-git-import-use-evidence-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.sourceSignoffStatus).toBe('PARTIAL')
    expect(register.entryCount).toBeGreaterThan(20)
    expect(register.mainlineKeepEntryCount).toBeGreaterThan(20)
    expect(register.replaceDeleteEntryCount).toBeGreaterThanOrEqual(4)
    expect(register.importedOrReferencedEntryCount).toBeGreaterThan(0)
    expect(register.missingSamplePathEntryCount).toBe(0)
    expect(register.entries.find(entry => entry.id === 'MDR-02.01')?.disposition).toBe('ready-replace-delete-review')
    expect(register.entries.find(entry => entry.id === 'MDR-08.02')?.disposition).toBe('ready-replace-delete-review')
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('owner-git-import-use-review-required')
  }, 180_000)
})
