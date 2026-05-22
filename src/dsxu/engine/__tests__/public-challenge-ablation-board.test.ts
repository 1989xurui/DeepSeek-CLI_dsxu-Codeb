import { describe, expect, test } from 'bun:test'
import {
  buildDSXUPublicChallengeAblationBoard,
  type DSXUPublicChallengeReviewMetrics,
} from '../public-challenge-ablation-board'

const reviewIds = [
  'flash-public-claim-guard-review',
  'flash-senior-coding-experience-review',
  'flash-release-ecosystem-review',
]

function review(
  id: string,
  overrides: Partial<DSXUPublicChallengeReviewMetrics> = {},
): DSXUPublicChallengeReviewMetrics {
  return {
    id,
    score: 72,
    passed: true,
    totalCostUSD: 0.01,
    requestCount: 2,
    proRequestCount: 1,
    cacheHitInputTokens: 100,
    cacheMissInputTokens: 100,
    outputTokens: 10,
    cacheHitRatePct: 50,
    readToolCallCount: 2,
    toolResultCount: 1,
    toolResultChars: 2000,
    uniqueSystemHashCount: 2,
    routeReasons: ['planning_flash_thinking_max', 'fim_pro_beta_non_thinking'],
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    tracePath: `.dsxu/trace/${id}.jsonl`,
    trajectoryPath: `.dsxu/trace/${id}.trajectory.jsonl`,
    ...overrides,
  }
}

function acceptedInput() {
  return {
    generatedAt: '2026-05-16T00:00:00.000Z',
    before: {
      label: 'before' as const,
      reviews: reviewIds.map(id => review(id)),
    },
    after: {
      label: 'after' as const,
      reviews: reviewIds.map((id, index) =>
        review(id, {
          score: index === 0 ? 72 : 75,
          totalCostUSD: 0.002,
          requestCount: 1,
          proRequestCount: 0,
          cacheHitInputTokens: 300,
          cacheMissInputTokens: 100,
          outputTokens: 20,
          cacheHitRatePct: 75,
          readToolCallCount: 0,
          toolResultCount: 0,
          toolResultChars: 0,
          uniqueSystemHashCount: 1,
          routeReasons: ['review_flash_thinking_max'],
          models: ['deepseek-v4-flash'],
        }),
      ),
    },
    expectedReviewIds: reviewIds,
    cacheHitRateClaimTargetPct: 80,
    sourceTruthPolicy: 'source capsule default; Read tool fallback only',
    currentPackagePath: 'docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json',
    currentPackageStatus: 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY',
  }
}

describe('DSXU public challenge ablation board', () => {
  test('accepts same-task before/after when quality holds and tool-result bloat is removed', () => {
    const board = buildDSXUPublicChallengeAblationBoard(acceptedInput())

    expect(board.status).toBe('PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE')
    expect(board.claimAblationRunnerAllowed).toBe(true)
    expect(board.claimObservedCacheTrendAllowed).toBe(true)
    expect(board.claimHighCacheRoiAllowed).toBe(false)
    expect(board.claimExternalComparisonAllowed).toBe(false)
    expect(board.claimPublic90Allowed).toBe(false)
    expect(board.before.reviewCount).toBe(3)
    expect(board.after.reviewCount).toBe(3)
    expect(board.deltas.scoreFloorDelta).toBe(0)
    expect(board.deltas.totalCostSavingsPct).toBe(80)
    expect(board.deltas.readToolCallDelta).toBe(-6)
    expect(board.deltas.toolResultCharsDelta).toBe(-6000)
    expect(board.gates).toMatchObject({
      sameReviewIds: true,
      afterAllPassed: true,
      scoreFloorNotLower: true,
      costReduced: true,
      cacheHitRateNotLower: true,
      readToolCallsReduced: true,
      toolResultCharsReduced: true,
      proUsageRemoved: true,
      systemPromptStable: true,
    })
  })

  test('blocks ablation acceptance when the score floor regresses', () => {
    const input = acceptedInput()
    input.after.reviews[0] = {
      ...input.after.reviews[0]!,
      score: 70,
    }

    const board = buildDSXUPublicChallengeAblationBoard(input)

    expect(board.status).toBe('BLOCKED_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE')
    expect(board.claimAblationRunnerAllowed).toBe(false)
    expect(board.gates.scoreFloorNotLower).toBe(false)
    expect(board.guards).toContain('after score floor regressed')
  })

  test('blocks ablation acceptance when review ids differ or large tool results remain', () => {
    const input = acceptedInput()
    input.after.reviews[0] = {
      ...input.after.reviews[0]!,
      id: 'different-public-review',
      toolResultChars: 100,
    }

    const board = buildDSXUPublicChallengeAblationBoard(input)

    expect(board.status).toBe('BLOCKED_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE')
    expect(board.gates.sameReviewIds).toBe(false)
    expect(board.gates.toolResultCharsReduced).toBe(false)
    expect(board.guards).toContain('before/after review ids differ from the expected same-task public challenge set')
    expect(board.guards).toContain('after run still returned large tool result chars')
  })
})
