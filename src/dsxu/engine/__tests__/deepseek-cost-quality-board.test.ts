import { describe, expect, test } from 'bun:test'
import {
  buildDSXUDeepSeekCostQualityBoard,
  buildDSXUDeepSeekRepairAdmissionLedger,
  type DSXUCostQualityScenario,
} from '../deepseek-cost-quality-board'

const flashOnlyScenario: DSXUCostQualityScenario = {
  id: 'flash-only-feature',
  label: 'Flash-only feature',
  source: 'controlled-local-harness',
  solved: true,
  evidencePaths: ['.dsxu/trace/flash-only.json'],
  publicClaimScope: 'internal-proof',
  stablePrefixStable: true,
  dynamicTailVaried: true,
  toolResultChars: 0,
  readToolCallCount: 0,
  turns: [
    {
      nodeId: 'flash-plan',
      model: 'deepseek-v4-flash',
      publicRoute: 'flash-max',
      routeReason: 'planning_flash_thinking_max',
      cacheHitInputTokens: 7600,
      cacheMissInputTokens: 1400,
      outputTokens: 420,
    },
    {
      nodeId: 'flash-code',
      model: 'deepseek-v4-flash',
      publicRoute: 'flash',
      routeReason: 'coding_flash_thinking_high',
      cacheHitInputTokens: 11800,
      cacheMissInputTokens: 2200,
      outputTokens: 760,
    },
  ],
}

const proRescueScenario: DSXUCostQualityScenario = {
  id: 'pro-rescue',
  label: 'Pro rescue after Flash failure',
  source: 'controlled-local-harness',
  solved: true,
  evidencePaths: ['.dsxu/trace/pro-rescue.json'],
  publicClaimScope: 'internal-proof',
  stablePrefixStable: true,
  dynamicTailVaried: true,
  turns: [
    {
      nodeId: 'flash-attempt',
      model: 'deepseek-v4-flash',
      publicRoute: 'flash',
      routeReason: 'coding_flash_thinking_high',
      cacheHitInputTokens: 12000,
      cacheMissInputTokens: 4000,
      outputTokens: 700,
    },
    {
      nodeId: 'pro-recovery',
      model: 'deepseek-v4-pro',
      publicRoute: 'pro',
      routeReason: 'failed_verification_pro_thinking_max',
      cacheHitInputTokens: 21600,
      cacheMissInputTokens: 2400,
      outputTokens: 1200,
      flashAttemptedBeforePro: true,
      proAdmissionReason: 'Pro admitted only after Flash failed native verification',
      proSavedTask: true,
    },
  ],
}

const publicChallengeScenario: DSXUCostQualityScenario = {
  id: 'public-challenge',
  label: 'Public challenge current score floor',
  source: 'public-challenge',
  solved: true,
  evidencePaths: ['docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'],
  publicClaimScope: 'release-claim',
  scoreFloor: 72,
  scoreTarget: 90,
  cacheTargetHitRatePct: 70,
  stablePrefixStable: true,
  dynamicTailVaried: true,
  toolResultChars: 0,
  readToolCallCount: 0,
  turns: [
    {
      nodeId: 'public-flash-review',
      model: 'deepseek-v4-flash',
      publicRoute: 'flash-max',
      routeReason: 'review_flash_thinking_max',
      cacheHitInputTokens: 84608,
      cacheMissInputTokens: 44691,
      outputTokens: 12161,
    },
  ],
}

describe('DSXU DeepSeek cost quality board', () => {
  test('allows Flash-first cost and Pro admission claims while blocking public 90/high-cache overclaim', () => {
    const board = buildDSXUDeepSeekCostQualityBoard({
      generatedAt: '2026-05-16T00:00:00.000Z',
      scenarios: [flashOnlyScenario, proRescueScenario, publicChallengeScenario],
    })

    expect(board.status).toBe('PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE')
    expect(board.guards).toEqual([])
    expect(board.flashTurnRatioPct).toBeGreaterThanOrEqual(75)
    expect(board.totalCostUsd).toBeLessThan(board.proOnlyCostUsd)
    expect(board.flashFirstCostClaimAllowed).toBe(true)
    expect(board.proAdmissionClaimAllowed).toBe(true)
    expect(board.public90ClaimAllowed).toBe(false)
    expect(board.cacheHighRoiClaimAllowed).toBe(false)
    expect(board.blockedClaims.join('\n')).toContain('Do not claim public 90%')
    expect(board.trendOnlyClaims.join('\n')).toContain('Cache optimization is trend-only')
    expect(board.scenarios.find(item => item.id === 'public-challenge')?.public90ClaimStatus).toBe('BLOCKED')
    expect(board.scenarios.find(item => item.id === 'public-challenge')?.cacheClaimStatus).toBe('TREND_ONLY')
  })

  test('rejects Pro usage without prior Flash attempt, admission reason, and saved-task evidence', () => {
    const board = buildDSXUDeepSeekCostQualityBoard({
      scenarios: [
        {
          ...proRescueScenario,
          turns: [
            {
              nodeId: 'unjustified-pro',
              model: 'deepseek-v4-pro',
              publicRoute: 'pro',
              routeReason: 'review_flash_thinking_max',
              cacheHitInputTokens: 1000,
              cacheMissInputTokens: 100,
              outputTokens: 50,
            },
          ],
        },
      ],
    })

    expect(board.status).toBe('NEEDS_DEEPSEEK_COST_QUALITY_EVIDENCE')
    expect(board.proAdmissionClaimAllowed).toBe(false)
    expect(board.guards.join('\n')).toContain('missing prior Flash attempt')
    expect(board.guards.join('\n')).toContain('missing Pro admission reason')
    expect(board.guards.join('\n')).toContain('missing saved-task evidence')
  })

  test('admits Pro only after prior Flash and enough real repair/failure signals', () => {
    const ledger = buildDSXUDeepSeekRepairAdmissionLedger({
      priorFlashAttempted: true,
      threshold: 3,
      signals: [
        {
          kind: 'json_tool_scavenged',
          severity: 'recoverable',
          turnId: 'flash-turn-1',
          evidence: 'DeepSeek emitted raw JSON tool call and DSXU scavenged it',
        },
        {
          kind: 'truncated_json_repaired',
          severity: 'recoverable',
          turnId: 'flash-turn-1',
          evidence: 'DeepSeek truncated tool args and DSXU repaired them',
        },
        {
          kind: 'identical_tool_call_storm',
          severity: 'blocking',
          turnId: 'flash-turn-2',
          evidence: 'Repeated Read same args crossed storm threshold',
        },
      ],
    })

    expect(ledger.status).toBe('PRO_ADMISSION_READY')
    expect(ledger.proAdmissionAllowed).toBe(true)
    expect(ledger.proAdmissionCount).toBe(1)
    expect(ledger.signalScore).toBe(4)
    expect(ledger.admissionReason).toContain('prior Flash attempt')
    expect(ledger.signalKinds).toEqual([
      'json_tool_scavenged',
      'truncated_json_repaired',
      'identical_tool_call_storm',
    ])
    expect(ledger.guards).toEqual([])
  })

  test('keeps Flash-first default when repair signals are weak or no Flash attempt exists', () => {
    const weakSignals = buildDSXUDeepSeekRepairAdmissionLedger({
      priorFlashAttempted: true,
      threshold: 3,
      signals: [
        {
          kind: 'json_tool_scavenged',
          severity: 'recoverable',
          turnId: 'flash-turn-1',
          evidence: 'One recoverable signal is not enough for Pro',
        },
      ],
    })
    const noPriorFlash = buildDSXUDeepSeekRepairAdmissionLedger({
      priorFlashAttempted: false,
      threshold: 3,
      signals: [
        {
          kind: 'schema_validation_failed',
          severity: 'blocking',
          turnId: 'turn-1',
          evidence: 'Schema failed before a Flash attempt was recorded',
        },
        {
          kind: 'identical_tool_call_storm',
          severity: 'blocking',
          turnId: 'turn-1',
          evidence: 'Storm was detected before Flash baseline',
        },
      ],
    })

    expect(weakSignals.status).toBe('FLASH_CONTINUE')
    expect(weakSignals.proAdmissionAllowed).toBe(false)
    expect(weakSignals.proAdmissionCount).toBe(0)
    expect(weakSignals.guards.join('\n')).toContain('below threshold')

    expect(noPriorFlash.status).toBe('PRO_ADMISSION_BLOCKED')
    expect(noPriorFlash.proAdmissionAllowed).toBe(false)
    expect(noPriorFlash.proAdmissionCount).toBe(0)
    expect(noPriorFlash.guards.join('\n')).toContain('missing prior Flash attempt')
  })
})
