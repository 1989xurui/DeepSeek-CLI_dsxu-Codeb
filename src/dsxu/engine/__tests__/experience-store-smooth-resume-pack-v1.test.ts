import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import {
  containsDsxuBenchmarkAnswerLeak,
  createDsxuExperienceStore,
  recordDsxuExperience,
  type DsxuExperienceEntry,
} from '../experience-store'
import { runExperienceStoreSmoothResumePackHarness } from '../../integration/harness/experience-store-smooth-resume-pack-v1-harness'

describe('ExperienceStore + smooth resume pack V1', () => {
  test('covers four repeated-task classes with source-truth replay and measurable waste reduction', async () => {
    const result = await runExperienceStoreSmoothResumePackHarness()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.aggregate.coveredKinds).toEqual([
      'bugfix',
      'feature_native_test',
      'failed_verification_recovery',
      'compact_resume',
    ])
    expect(result.aggregate).toMatchObject({
      scenarioCount: 4,
      allReadBeforeEdit: true,
      allVerified: true,
      allSourceTruthRefreshRequired: true,
      allReducedExploration: true,
      allBlockPassBeforeVerify: true,
      bugfixHasDeleteExplainEvidence: true,
      featureCanStayFlash: true,
      failedVerificationUsesRecoveryRoute: true,
      compactResumePreservesFailedCommand: true,
      benchmarkAnswerLeakBlocked: true,
    })
    expect(result.aggregate.averageToolCallReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.aggregate.averageReadReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.aggregate.averageTokenReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.scenarios.every(scenario => scenario.replayReport.repeatedExplorationReduced)).toBe(true)
    expect(result.scenarios.every(scenario => scenario.replayReport.planningQuality.grade === 'strong')).toBe(true)
    expect(result.scenarios.every(scenario => scenario.replayReport.planningQuality.hitRateEstimatePct >= 85)).toBe(true)
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })

  test('blocks benchmark answer markers from entering ExperienceStore', () => {
    const store = createDsxuExperienceStore()
    const leakEntry: DsxuExperienceEntry = {
      id: 'exp-test-benchmark-answer',
      kind: 'success_fix',
      title: 'Benchmark marker must not persist',
      content: 'DSXU_BENCH_EXAMPLE_PASS',
      sourcePath: '.dsxu/trace/leak.evidence.json',
      createdAt: '2026-05-06T03:00:00.000Z',
      confidence: 0.95,
      deletablePath: '.dsxu/memory/leak.json',
    }

    expect(containsDsxuBenchmarkAnswerLeak(leakEntry)).toBe(true)
    const result = recordDsxuExperience(store, leakEntry)
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('benchmark-answer-blocked:exp-test-benchmark-answer')
    expect(store.entries).toHaveLength(0)
  })
})
