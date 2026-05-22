import { describe, expect, test } from 'bun:test'
import { buildV18RouteCacheRoiSmokeEvidence } from '../route-cache-roi-smoke'

describe('V18 route cache ROI smoke', () => {
  test('surfaces non-safety Pro routes with high miss and no Flash rescue evidence', () => {
    const evidence = buildV18RouteCacheRoiSmokeEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-cost-router/live-route-cache-roi-smoke-test.evidence.json',
      sourceReports: ['code-live-report.json', 'terminal-live-report.json'],
      reports: [
        {
          cases: [
            {
              id: 'feature-flash',
              category: 'feature',
              status: 'pass',
              routeExpectation: { routeReason: 'coding_flash_non_thinking' },
              metrics: {
                totalCostUSD: 0.001,
                modelUsage: {
                  'deepseek-v4-flash': {
                    inputTokens: 10_000,
                    cacheReadInputTokens: 8_000,
                    cacheCreationInputTokens: 2_000,
                    outputTokens: 500,
                    costUSD: 0.001,
                  },
                },
              },
            },
            {
              id: 'review-pro-direct',
              category: 'review',
              status: 'pass',
              routeExpectation: { routeReason: 'planning_review_pro_thinking_high' },
              metrics: {
                totalCostUSD: 0.04,
                modelUsage: {
                  'deepseek-v4-pro': {
                    inputTokens: 30_000,
                    cacheReadInputTokens: 10_000,
                    cacheCreationInputTokens: 20_000,
                    outputTokens: 1_000,
                    costUSD: 0.04,
                  },
                },
              },
            },
          ],
        },
        {
          cases: [
            {
              id: 'permission-safety-pro',
              category: 'permission',
              status: 'pass',
              routeExpectation: { routeReason: 'high_risk_pro_thinking_max_requires_approval' },
              metrics: {
                totalCostUSD: 0.005,
                modelUsage: {
                  'deepseek-v4-pro': {
                    inputTokens: 20_000,
                    cacheReadInputTokens: 19_000,
                    cacheCreationInputTokens: 1_000,
                    outputTokens: 300,
                    costUSD: 0.005,
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(evidence.ok).toBe(true)
    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.aggregate.cacheHitInputTokens).toBe(37_000)
    expect(evidence.aggregate.cacheMissInputTokens).toBe(23_000)
    expect(evidence.aggregate.proRoi?.proNodeCount).toBe(2)
    expect(evidence.aggregate.proRoi?.proNodesWithPriorFlashAttempt).toBe(0)
    expect(evidence.demotionCandidates).toEqual([
      {
        routeReason: 'planning_review_pro_thinking_high',
        currentModel: 'deepseek-v4-pro',
        recommendedTarget: 'planning_flash_thinking_max',
        cacheHitRatePct: 33.3,
        cacheMissInputTokens: 20_000,
        proRoiRatePct: 0,
        proNodeCount: 1,
        reason: 'Pro route has no same-case Flash attempt and no saved-task evidence',
      },
    ])
    expect(evidence.keepProRoutes).toEqual([
      {
        routeReason: 'high_risk_pro_thinking_max_requires_approval',
        currentModel: 'deepseek-v4-pro',
        recommendedTarget: 'keep_pro_for_safety_gate',
        cacheHitRatePct: 95,
        cacheMissInputTokens: 1_000,
        proRoiRatePct: 0,
        proNodeCount: 1,
        reason: 'high-risk permission/security routes are safety gates; do not demote based on ROI alone',
      },
    ])
  })

  test('keeps failed-verification Pro when same-case Flash attempt was rescued', () => {
    const evidence = buildV18RouteCacheRoiSmokeEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-cost-router/live-route-cache-roi-smoke-test.evidence.json',
      sourceReports: ['recovery-live-report.json'],
      reports: [
        {
          cases: [
            {
              id: 'recovery-pack',
              category: 'recovery',
              status: 'pass',
              routeExpectation: { routeReason: 'failed_verification_pro_thinking_max' },
              metrics: {
                totalCostUSD: 0.03,
                modelUsage: {
                  'deepseek-v4-flash': {
                    inputTokens: 40_000,
                    cacheReadInputTokens: 15_000,
                    cacheCreationInputTokens: 25_000,
                    outputTokens: 1_000,
                    costUSD: 0.004,
                  },
                  'deepseek-v4-pro': {
                    inputTokens: 80_000,
                    cacheReadInputTokens: 20_000,
                    cacheCreationInputTokens: 60_000,
                    outputTokens: 2_000,
                    costUSD: 0.026,
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(evidence.aggregate.proRoi?.proRoiRatePct).toBe(100)
    expect(evidence.demotionCandidates).toEqual([])
    expect(evidence.keepProRoutes).toEqual([
      {
        routeReason: 'failed_verification_pro_thinking_max',
        currentModel: 'deepseek-v4-pro',
        recommendedTarget: 'flash_max_before_pro',
        cacheHitRatePct: 29.2,
        cacheMissInputTokens: 85_000,
        proRoiRatePct: 100,
        proNodeCount: 1,
        reason: 'Pro route has saved-task evidence; keep Pro admission and optimize stable-prefix cache separately',
      },
    ])
  })
})
