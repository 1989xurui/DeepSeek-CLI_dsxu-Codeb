import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import {
  buildDsxuExperienceInjection,
  createDsxuExperienceStore,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
} from '../experience-store'
import { buildDSXUExperienceContextPack } from '../query-context-builder-v1'
import { runExperienceStoreSourceTruthConflictHarness } from '../../integration/harness/experience-store-source-truth-conflict-v1-harness'

describe('ExperienceStore source-truth conflict guard V1', () => {
  test('rejects stale memory as an edit target and verifies current source truth', async () => {
    const result = await runExperienceStoreSourceTruthConflictHarness()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.recallIds).toContain('exp-invoice-stale-legacy-success')
    expect(result.staleRecallIds).toContain('exp-invoice-stale-legacy-success')
    expect(result.overlappingRecallIds).toContain('exp-invoice-current-success')
    expect(result.staleTargetRejected).toBe(true)
    expect(result.currentSourceWon).toBe(true)
    expect(result.selectedEditTarget).not.toBe(result.staleTarget)
    expect(result.sourceTruthRefreshRequired).toBe(true)
    expect(result.readBeforeEdit).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.mayClaimPassBeforeVerify).toBe(false)
    expect(result.replayReport.repeatedExplorationReduced).toBe(true)
    expect(result.replayReport.planningQuality.grade).toBe('strong')
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })

  test('exports sourceTruthGuard in bounded query context evidence', () => {
    const currentSource = 'D:/repo/src/invoice.ts'
    const currentTest = 'D:/repo/src/invoice.test.ts'
    const staleSource = 'D:/repo/src/legacyInvoice.ts'
    const entries: DsxuExperienceEntry[] = [
      {
        id: 'exp-context-stale-invoice',
        kind: 'success_fix',
        title: 'Legacy invoice fix',
        content: 'Old memory points at legacyInvoice.ts.',
        sourcePath: '.dsxu/trace/context-stale.json',
        createdAt: '2026-05-06T04:10:00.000Z',
        confidence: 0.99,
        deletablePath: '.dsxu/memory/exp-context-stale-invoice.json',
        relatedFiles: [staleSource],
        outcome: 'passed',
        tags: ['invoice', 'legacy', 'paid'],
      },
      {
        id: 'exp-context-current-invoice',
        kind: 'success_fix',
        title: 'Current invoice paid flag',
        content: 'Reread invoice.ts and branch on paid before running invoice.test.ts.',
        sourcePath: '.dsxu/trace/context-current.json',
        createdAt: '2026-05-06T04:11:00.000Z',
        confidence: 0.95,
        deletablePath: '.dsxu/memory/exp-context-current-invoice.json',
        relatedFiles: [currentSource, currentTest],
        outcome: 'passed',
        tags: ['invoice', 'paid'],
      },
    ]
    const store = createDsxuExperienceStore()
    for (const entry of entries) {
      expect(recordDsxuExperience(store, entry).accepted).toBe(true)
    }

    const recalls = recallDsxuExperience({
      store,
      query: 'invoice paid status with stale legacy memory',
      currentSourceFiles: [currentSource, currentTest],
      maxEntries: 2,
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [currentSource, currentTest],
    })
    const pack = buildDSXUExperienceContextPack({ injection, maxRenderedChars: 3000 })

    expect(injection.sourceTruthGuard.policy).toBe('current-source-wins')
    expect(injection.sourceTruthGuard.memoryMaySelectEditTarget).toBe(false)
    expect(injection.sourceTruthGuard.mayUseStaleRecallForEditTarget).toBe(false)
    expect(injection.sourceTruthGuard.staleRecallIds).toContain('exp-context-stale-invoice')
    expect(injection.sourceTruthGuard.overlappingRecallIds).toContain('exp-context-current-invoice')
    expect(pack.injectIntoPrompt).toBe(true)
    expect(pack.rendered).toContain('ExperienceStore Source Truth Guard')
    expect(pack.rendered).toContain('memoryMaySelectEditTarget: false')
    expect(pack.rendered).toContain('staleRecallIds: exp-context-stale-invoice')
  })
})
