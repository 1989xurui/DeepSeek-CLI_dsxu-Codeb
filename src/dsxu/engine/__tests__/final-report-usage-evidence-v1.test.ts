import { describe, expect, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'
import { buildDSXUFinalPatchReport } from '../code-mode-surgical-loop'
import { buildDSXUModelCostEvidenceFromUsage } from '../final-report-usage-evidence'

describe('FinalReport usage cost evidence V1', () => {
  test('converts actual adapter usage records into final report modelCostEvidence', () => {
    const plan = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      max_tokens: 32_768,
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'planning', role: 'planner' },
    })
    const code = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      max_tokens: 16_384,
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'feature', role: 'coder' },
    })
    const planUsage = DeepSeekAdapter.normalizeUsage({
      model: plan.requestedModel,
      usage: {
        prompt_tokens: 5000,
        completion_tokens: 800,
        prompt_cache_hit_tokens: 4000,
        prompt_cache_miss_tokens: 1000,
      },
      dsxu_model_evidence: plan.modelEvidence,
      dsxu_route_reason: plan.routeReason,
    })
    const codeUsage = DeepSeekAdapter.normalizeUsage({
      model: code.requestedModel,
      usage: {
        prompt_tokens: 13000,
        completion_tokens: 1200,
        prompt_cache_hit_tokens: 10000,
        prompt_cache_miss_tokens: 3000,
      },
      dsxu_model_evidence: code.modelEvidence,
      dsxu_route_reason: code.routeReason,
    })
    const modelCostEvidence = buildDSXUModelCostEvidenceFromUsage({
      scenario: 'live_usage_adapter',
      solved: true,
      records: [
        { nodeId: 'plan', usage: planUsage },
        { nodeId: 'code-patch', usage: codeUsage },
      ],
    })
    const finalReport = buildDSXUFinalPatchReport({
      goal: 'Live usage cost evidence test',
      changedFiles: ['src/cart.ts'],
      tracePath: '.dsxu/trace/v18-final-report/live-usage-model-cost-evidence.json',
      verification: {
        command: ['bun', 'test', 'src/cart.test.ts'],
        exitCode: 0,
        stdout: 'bun test',
        stderr: ' 1 pass\n 0 fail',
        passed: true,
        failureType: 'UNKNOWN',
      },
      modelCostEvidence,
    })
    const evidenceDir = join(process.cwd(), '.dsxu', 'trace', 'v18-final-report')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'live-usage-model-cost-evidence.json'),
      `${JSON.stringify({ planUsage, codeUsage, finalReport }, null, 2)}\n`,
      'utf8',
    )

    expect(modelCostEvidence.costComplete).toBe(true)
    expect(modelCostEvidence.costPerSolvedUsd).toBeGreaterThan(0)
    expect(modelCostEvidence.proOnlyCostUsd).toBeGreaterThan(modelCostEvidence.totalCostUsd)
    expect(modelCostEvidence.savingsVsProOnlyPct).toBeGreaterThanOrEqual(40)
    expect(modelCostEvidence.proNodeRatio).toBe(0)
    expect(modelCostEvidence.cacheHitInputTokens).toBe(14_000)
    expect(modelCostEvidence.cacheMissInputTokens).toBe(4_000)
    expect(modelCostEvidence.outputTokens).toBe(2_000)
    expect(modelCostEvidence.cacheHitRatePct).toBe(77.8)
    expect(modelCostEvidence.cacheByModel).toEqual([
      {
        model: 'deepseek-v4-flash',
        cacheHitInputTokens: 14_000,
        cacheMissInputTokens: 4_000,
        outputTokens: 2_000,
        cacheHitRatePct: 77.8,
      },
    ])
    expect(modelCostEvidence.proRoi?.proNodeCount).toBe(0)
    expect(modelCostEvidence.proRoi?.proRoiRatePct).toBe(0)
    expect(modelCostEvidence.routeReasons).toContain('plan:planning_flash_thinking_max')
    expect(modelCostEvidence.routeReasons).toContain('code-patch:coding_flash_non_thinking')
    expect(modelCostEvidence.modelEvidence).toContain('deepseek-v4-flash')
    expect(finalReport.status).toBe('PASS')
    expect(finalReport.summary).toContain('Cost evidence')
  })

  test('records Pro ROI admission, prior Flash attempt, and save evidence', () => {
    const flashPlan = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      max_tokens: 32_768,
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'planning', role: 'planner' },
    })
    const proRecovery = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      max_tokens: 65_536,
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'failedVerification', role: 'reviewer', failedVerification: true },
    })
    const flashUsage = DeepSeekAdapter.normalizeUsage({
      model: flashPlan.requestedModel,
      usage: {
        prompt_tokens: 9000,
        completion_tokens: 900,
        prompt_cache_hit_tokens: 7000,
        prompt_cache_miss_tokens: 2000,
      },
      dsxu_model_evidence: flashPlan.modelEvidence,
      dsxu_route_reason: flashPlan.routeReason,
    })
    const proUsage = DeepSeekAdapter.normalizeUsage({
      model: proRecovery.requestedModel,
      usage: {
        prompt_tokens: 12000,
        completion_tokens: 1800,
        prompt_cache_hit_tokens: 3000,
        prompt_cache_miss_tokens: 9000,
      },
      dsxu_model_evidence: proRecovery.modelEvidence,
      dsxu_route_reason: proRecovery.routeReason,
    })
    const modelCostEvidence = buildDSXUModelCostEvidenceFromUsage({
      scenario: 'pro_roi_after_flash_attempt',
      solved: true,
      records: [
        { nodeId: 'flash-plan', usage: flashUsage },
        {
          nodeId: 'pro-failed-verification',
          usage: proUsage,
          proAdmissionReason: 'failed verification after Flash plan',
          flashAttemptedBeforePro: true,
          flashAttemptNodeIds: ['flash-plan'],
          proSavedTask: true,
          proSaveEvidence: 'verification passed after Pro diagnosis',
        },
      ],
    })
    const evidenceDir = join(process.cwd(), '.dsxu', 'trace', 'v18-final-report')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'pro-roi-model-cost-evidence.json'),
      `${JSON.stringify({ flashUsage, proUsage, modelCostEvidence }, null, 2)}\n`,
      'utf8',
    )

    expect(modelCostEvidence.proNodeRatio).toBe(50)
    expect(modelCostEvidence.cacheHitInputTokens).toBe(10_000)
    expect(modelCostEvidence.cacheMissInputTokens).toBe(11_000)
    expect(modelCostEvidence.cacheHitRatePct).toBe(47.6)
    expect(modelCostEvidence.cacheByModel?.map(bucket => bucket.model)).toEqual([
      'deepseek-v4-pro',
      'deepseek-v4-flash',
    ])
    expect(modelCostEvidence.proRoi).toEqual({
      proNodeCount: 1,
      proNodesWithPriorFlashAttempt: 1,
      proNodesWithAdmissionReason: 1,
      proNodesMarkedSavedTask: 1,
      proRoiRatePct: 100,
      entries: [
        {
          nodeId: 'pro-failed-verification',
          routeReason: 'failed_verification_pro_thinking_max',
          proAdmissionReason: 'failed verification after Flash plan',
          flashAttemptedBeforePro: true,
          flashAttemptNodeIds: ['flash-plan'],
          proSavedTask: true,
          proSaveEvidence: 'verification passed after Pro diagnosis',
        },
      ],
    })
  })
})
