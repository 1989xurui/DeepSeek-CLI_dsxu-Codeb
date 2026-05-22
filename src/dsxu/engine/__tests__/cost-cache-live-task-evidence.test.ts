import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  runV19CostCacheFlashOnlySuccessEvidenceHarness,
  runV19CostCacheLiveTaskEvidenceHarness,
  writeV19LiveProviderCacheEvidenceSummary,
} from '../cost-cache-live-task-evidence'

describe('V19 cost/cache fresh live task evidence', () => {
  test('records route cache and Pro ROI evidence on a fresh non-22 bugfix/recovery task', async () => {
    const evidence = await runV19CostCacheLiveTaskEvidenceHarness({
      evidenceDir: '.dsxu/trace/v19-cost-cache-live-task-test',
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(evidence.ok, evidence.risks.join('\n')).toBe(true)
    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.non22LiveTask).toBe(true)
    expect(evidence.broad22Run).toBe(false)

    expect(evidence.preVerification.passed).toBe(false)
    expect(evidence.flashAttemptVerification.passed).toBe(false)
    expect(evidence.finalVerification.passed).toBe(true)
    expect(evidence.finalReport.status).toBe('PASS')

    expect(evidence.aggregate.contextPolicy).toBe('route-aware/context-window-aware/cache-aware')
    expect(evidence.aggregate.contextWindow).toBe(1_048_576)
    expect(evidence.aggregate.flashMaxTried).toBe(true)
    expect(evidence.aggregate.flashTried).toBe(true)
    expect(evidence.aggregate.proUsed).toBe(true)
    expect(evidence.aggregate.proSavedTask).toBe(true)
    expect(evidence.aggregate.stablePrefixStable).toBe(true)
    expect(evidence.aggregate.dynamicTailVaried).toBe(true)
    expect(evidence.aggregate.volatileFindingCount).toBe(0)
    expect(evidence.aggregate.cacheHitRatePct).toBe(85.3)
    expect(evidence.aggregate.outputTokens).toBe(3050)
    expect(evidence.aggregate.toolCallCount).toBe(9)

    expect(evidence.turns.map(turn => turn.publicRoute)).toEqual([
      'flash-max',
      'flash',
      'flash',
      'pro',
    ])
    expect(new Set(evidence.turns.map(turn => turn.stablePrefixHash)).size).toBe(1)
    expect(new Set(evidence.turns.map(turn => turn.dynamicTailHash)).size).toBe(4)
    expect(evidence.turns.every(turn => turn.contextHygiene === 'stable_prefix_clean_dynamic_tail_isolated')).toBe(true)
    expect(evidence.turns.slice(1).every(turn => turn.sourceTruthReread)).toBe(true)
    expect(evidence.turns.at(-1)?.whyUpgrade).toContain('after Flash tried')

    expect(evidence.modelCostEvidence.costComplete).toBe(true)
    expect(evidence.modelCostEvidence.proNodeRatio).toBe(25)
    expect(evidence.modelCostEvidence.savingsVsProOnlyPct).toBeGreaterThan(45)
    expect(evidence.modelCostEvidence.cacheHitInputTokens).toBe(56_700)
    expect(evidence.modelCostEvidence.cacheMissInputTokens).toBe(9_800)
    expect(evidence.modelCostEvidence.outputTokens).toBe(3_050)
    expect(evidence.modelCostEvidence.proRoi).toMatchObject({
      proNodeCount: 1,
      proNodesWithPriorFlashAttempt: 1,
      proNodesWithAdmissionReason: 1,
      proNodesMarkedSavedTask: 1,
      proRoiRatePct: 100,
    })
    expect(evidence.modelCostEvidence.proRoi?.entries[0]).toMatchObject({
      nodeId: 'pro-failed-verification-recovery',
      routeReason: 'high_risk_pro_thinking_max_requires_approval',
      flashAttemptedBeforePro: true,
      proSavedTask: true,
    })

    expect(evidence.dynamicTailEvidence.ok).toBe(true)
    expect(evidence.dynamicTailEvidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.dynamicTailEvidence.cases[0]).toMatchObject({
      uniqueStablePrefixHashes: 1,
      uniqueDynamicTailHashes: 4,
      volatileFindingCount: 0,
      status: 'CACHE_STABLE',
    })

    const trace = await readFile(evidence.routeTracePath, 'utf8')
    expect(trace).toContain('"event":"prompt_prefix_cache_evidence"')
    expect(trace).toContain('"event":"request_plan"')
    expect(trace).toContain('"event":"response_usage"')
    expect(trace).toContain('"publicRoute":"flash-max"')
    expect(trace).toContain('"publicRoute":"pro"')
    expect(trace).not.toContain('return subtotal - discount')
    expect(trace).not.toContain('Math.abs')
    expect(trace).not.toContain('Math.max')
  }, 90_000)

  test('records Flash-only success evidence on a fresh non-22 feature task', async () => {
    const evidence = await runV19CostCacheFlashOnlySuccessEvidenceHarness({
      evidenceDir: '.dsxu/trace/v19-cost-cache-flash-only-success-test',
      nowIso: '2026-05-09T00:05:00.000Z',
    })

    expect(evidence.ok, evidence.risks.join('\n')).toBe(true)
    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.non22LiveTask).toBe(true)
    expect(evidence.broad22Run).toBe(false)

    expect(evidence.preVerification.passed).toBe(false)
    expect(evidence.finalVerification.passed).toBe(true)
    expect(evidence.finalReport.status).toBe('PASS')

    expect(evidence.aggregate.contextPolicy).toBe('route-aware/context-window-aware/cache-aware')
    expect(evidence.aggregate.contextWindow).toBe(1_048_576)
    expect(evidence.aggregate.flashMaxTried).toBe(true)
    expect(evidence.aggregate.flashTried).toBe(true)
    expect(evidence.aggregate.proUsed).toBe(false)
    expect(evidence.aggregate.proSavedTask).toBe(false)
    expect(evidence.aggregate.stablePrefixStable).toBe(true)
    expect(evidence.aggregate.dynamicTailVaried).toBe(true)
    expect(evidence.aggregate.volatileFindingCount).toBe(0)
    expect(evidence.aggregate.cacheHitRatePct).toBe(86.5)
    expect(evidence.aggregate.outputTokens).toBe(1440)
    expect(evidence.aggregate.toolCallCount).toBe(5)

    expect(evidence.turns.map(turn => turn.publicRoute)).toEqual([
      'flash-max',
      'flash',
      'flash',
    ])
    expect(new Set(evidence.turns.map(turn => turn.stablePrefixHash)).size).toBe(1)
    expect(new Set(evidence.turns.map(turn => turn.dynamicTailHash)).size).toBe(3)
    expect(evidence.turns.every(turn => turn.contextHygiene === 'stable_prefix_clean_dynamic_tail_isolated')).toBe(true)
    expect(evidence.turns.slice(1).every(turn => turn.sourceTruthReread)).toBe(true)
    expect(evidence.turns.every(turn => turn.publicRoute !== 'pro')).toBe(true)

    expect(evidence.modelCostEvidence.costComplete).toBe(true)
    expect(evidence.modelCostEvidence.proNodeRatio).toBe(0)
    expect(evidence.modelCostEvidence.savingsVsProOnlyPct).toBeGreaterThan(60)
    expect(evidence.modelCostEvidence.cacheHitInputTokens).toBe(26_800)
    expect(evidence.modelCostEvidence.cacheMissInputTokens).toBe(4_200)
    expect(evidence.modelCostEvidence.outputTokens).toBe(1_440)
    expect(evidence.modelCostEvidence.proRoi).toMatchObject({
      proNodeCount: 0,
      proNodesWithPriorFlashAttempt: 0,
      proNodesWithAdmissionReason: 0,
      proNodesMarkedSavedTask: 0,
      proRoiRatePct: 0,
      entries: [],
    })

    expect(evidence.dynamicTailEvidence.ok).toBe(true)
    expect(evidence.dynamicTailEvidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.dynamicTailEvidence.cases[0]).toMatchObject({
      uniqueStablePrefixHashes: 1,
      uniqueDynamicTailHashes: 3,
      volatileFindingCount: 0,
      status: 'CACHE_STABLE',
    })

    const trace = await readFile(evidence.routeTracePath, 'utf8')
    expect(trace).toContain('"event":"prompt_prefix_cache_evidence"')
    expect(trace).toContain('"event":"request_plan"')
    expect(trace).toContain('"event":"response_usage"')
    expect(trace).toContain('"publicRoute":"flash-max"')
    expect(trace).toContain('"publicRoute":"flash"')
    expect(trace).not.toContain('"publicRoute":"pro"')
    expect(trace).not.toContain("order.region === 'local'")
    expect(trace).not.toContain('shippingFee(order')
  }, 90_000)

  test('ingests live provider cache/billing usage evidence into the Phase 5 summary', async () => {
    const evidenceDir = '.dsxu/trace/v19-cost-cache-live-provider-ingest-test'
    await mkdir(evidenceDir, { recursive: true })
    const sourceEvidencePath = join(evidenceDir, 'live-cache-prefix-payload-smoke.json')
    const summaryPath = join(evidenceDir, 'live-provider-cache-prefix-summary.json')
    await writeFile(
      sourceEvidencePath,
      `${JSON.stringify(
        {
          ok: true,
          status: 'DONE-EVIDENCED',
          evidencePath: sourceEvidencePath,
          routeTracePath: join(evidenceDir, 'live-cache-prefix-payload-smoke.route.jsonl'),
          generatedAt: '2026-05-09T00:10:00.000Z',
          policy: 'flash_only_deepseek_native_prefix_cache',
          normalizedSystemHash: 'a7877914289073d4',
          stablePrefixChars: 9359,
          dynamicTailChanges: true,
          cacheHitLiftObserved: true,
          steps: [
            {
              name: 'warm_cache',
              ok: true,
              text: 'DSXU_CACHE_PREFIX_OK_warm_cache',
              cacheHitInputTokens: 1920,
              cacheMissInputTokens: 25,
              outputTokens: 11,
              model: 'deepseek-v4-flash',
              routeReason: 'verification_flash_non_thinking',
            },
            {
              name: 'reuse_cache',
              ok: true,
              text: 'DSXU_CACHE_PREFIX_OK_reuse_cache',
              cacheHitInputTokens: 1920,
              cacheMissInputTokens: 25,
              outputTokens: 11,
              model: 'deepseek-v4-flash',
              routeReason: 'verification_flash_non_thinking',
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const summary = await writeV19LiveProviderCacheEvidenceSummary({
      sourceEvidencePath,
      evidencePath: summaryPath,
      nowIso: '2026-05-09T00:11:00.000Z',
    })

    expect(summary.ok, summary.risks.join('\n')).toBe(true)
    expect(summary.status).toBe('DONE_EVIDENCED')
    expect(summary.liveProviderUsage).toBe(true)
    expect(summary.non22LiveTask).toBe(true)
    expect(summary.broad22Run).toBe(false)
    expect(summary.archivedSourceStatus).toBe('DONE-EVIDENCED')
    expect(summary.policy).toBe('flash_only_deepseek_native_prefix_cache')
    expect(summary.cacheHitLiftObserved).toBe(true)
    expect(summary.aggregate).toMatchObject({
      stepCount: 2,
      allStepsOk: true,
      allFlash: true,
      allVerificationFlash: true,
      proUsed: false,
      cacheHitInputTokens: 3840,
      cacheMissInputTokens: 50,
      outputTokens: 22,
      cacheHitRatePct: 98.7,
      contextWindow: 1_048_576,
      contextPolicy: 'route-aware/context-window-aware/cache-aware',
    })
    expect(summary.modelCostEvidence.costComplete).toBe(true)
    expect(summary.modelCostEvidence.proNodeRatio).toBe(0)
    expect(summary.modelCostEvidence.savingsVsProOnlyPct).toBe(56.4)
    expect(summary.modelCostEvidence.proRoi).toMatchObject({
      proNodeCount: 0,
      entries: [],
    })
    expect(summary.steps.every(step => step.publicRoute === 'flash')).toBe(true)

    const persisted = await readFile(summaryPath, 'utf8')
    expect(persisted).toContain('"taskId": "v19_phase5_live_provider_cache_prefix_billing"')
    expect(persisted).not.toContain('sk-')
  }, 30_000)
})
