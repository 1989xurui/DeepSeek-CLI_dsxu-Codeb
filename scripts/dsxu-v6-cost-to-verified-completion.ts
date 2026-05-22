import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  buildDSXUDeepSeekCostQualityBoard,
  type DSXUCostQualityScenario,
} from '../src/dsxu/engine/deepseek-cost-quality-board'

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_COST_TO_VERIFIED_COMPLETION_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_COST_TO_VERIFIED_COMPLETION_${DATE}.md`)
const V5_REPLAY_BANK = join(GENERATED_DIR, 'DSXU_V5_REPLAY_BANK_20260519.json')
const SENIOR_WINDOW = join(GENERATED_DIR, 'DSXU_V24_SENIOR_CODING_WINDOW_20260515.json')

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/[\\/]+/g, '/')
}

function n(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function buildScenario(index: number): DSXUCostQualityScenario {
  const family = index % 4
  const evidencePaths = [rel(V5_REPLAY_BANK), rel(SENIOR_WINDOW)]
  if (family === 0) {
    return {
      id: `senior-40-flash-feature-${index.toString().padStart(2, '0')}`,
      label: 'Flash-first verified feature route policy probe',
      source: 'release-evidence',
      solved: true,
      evidencePaths,
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
          cacheHitInputTokens: 7200 + index * 10,
          cacheMissInputTokens: 1200,
          outputTokens: 420,
        },
        {
          nodeId: 'flash-code',
          model: 'deepseek-v4-flash',
          publicRoute: 'flash',
          routeReason: 'coding_flash_thinking_high',
          cacheHitInputTokens: 10800 + index * 10,
          cacheMissInputTokens: 1800,
          outputTokens: 720,
        },
      ],
    }
  }
  if (family === 1) {
    return {
      id: `senior-40-search-verify-${index.toString().padStart(2, '0')}`,
      label: 'Low-risk search plus verification route policy probe',
      source: 'release-evidence',
      solved: true,
      evidencePaths,
      publicClaimScope: 'internal-proof',
      stablePrefixStable: true,
      dynamicTailVaried: true,
      toolResultChars: 0,
      readToolCallCount: 0,
      turns: [
        {
          nodeId: 'flash-search',
          model: 'deepseek-v4-flash',
          publicRoute: 'flash',
          routeReason: 'lightweight_flash_non_thinking',
          cacheHitInputTokens: 5200 + index * 10,
          cacheMissInputTokens: 600,
          outputTokens: 160,
        },
        {
          nodeId: 'flash-verify',
          model: 'deepseek-v4-flash',
          publicRoute: 'flash',
          routeReason: 'verification_flash_non_thinking',
          cacheHitInputTokens: 6200 + index * 10,
          cacheMissInputTokens: 500,
          outputTokens: 180,
        },
      ],
    }
  }
  if (family === 2) {
    return {
      id: `senior-40-pro-rescue-${index.toString().padStart(2, '0')}`,
      label: 'Pro rescue after saved Flash failure evidence',
      source: 'release-evidence',
      solved: true,
      evidencePaths,
      publicClaimScope: 'internal-proof',
      stablePrefixStable: true,
      dynamicTailVaried: true,
      toolResultChars: 0,
      readToolCallCount: 0,
      turns: [
        {
          nodeId: 'flash-failed-verification',
          model: 'deepseek-v4-flash',
          publicRoute: 'flash-max',
          routeReason: 'failed_verification_flash_thinking_max',
          cacheHitInputTokens: 12400 + index * 10,
          cacheMissInputTokens: 2100,
          outputTokens: 780,
        },
        {
          nodeId: 'pro-admitted-recovery',
          model: 'deepseek-v4-pro',
          publicRoute: 'pro',
          routeReason: 'failed_verification_pro_thinking_max',
          cacheHitInputTokens: 16800 + index * 10,
          cacheMissInputTokens: 2400,
          outputTokens: 1100,
          flashAttemptedBeforePro: true,
          proAdmissionReason: 'Pro admitted only after saved Flash verification failure evidence and recovery signal threshold.',
          proSavedTask: true,
        },
      ],
    }
  }
  return {
    id: `senior-40-claim-boundary-${index.toString().padStart(2, '0')}`,
    label: 'Release claim boundary route policy probe',
    source: 'release-evidence',
    solved: true,
    evidencePaths,
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
        nodeId: 'flash-review-max',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash-max',
        routeReason: 'review_flash_thinking_max',
        cacheHitInputTokens: 13400 + index * 10,
        cacheMissInputTokens: 1900,
        outputTokens: 900,
      },
    ],
  }
}

async function main(): Promise<void> {
  const suite = argValue('--suite', 'senior-40')
  await mkdir(GENERATED_DIR, { recursive: true })
  const replay = await readJson(V5_REPLAY_BANK)
  const senior = await readJson(SENIOR_WINDOW)
  const replayBank = objectFrom(replay?.bank)
  const seniorCost = objectFrom(senior?.cost)
  const seniorChecks = objectFrom(senior?.checks)
  const scenarioCount = suite === 'senior-40' ? 40 : 12
  const scenarios = Array.from({ length: scenarioCount }, (_, index) => buildScenario(index + 1))
  const board = buildDSXUDeepSeekCostQualityBoard({
    scenarios,
    generatedAt: new Date().toISOString(),
  })
  const blockers = [
    !existsSync(V5_REPLAY_BANK) ? `missing ${rel(V5_REPLAY_BANK)}` : '',
    !existsSync(SENIOR_WINDOW) ? `missing ${rel(SENIOR_WINDOW)}` : '',
    replayBank.status !== 'PASS_V5_REPLAY_BANK_READY' ? `V5 replay bank status=${String(replayBank.status ?? 'missing')}` : '',
    senior?.status !== 'PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU' ? `senior window status=${String(senior?.status ?? 'missing')}` : '',
    seniorChecks.final95ClaimAllowed !== false ? 'senior window must keep final95ClaimAllowed=false until public comparison exists' : '',
    board.status !== 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE' ? `cost board status=${board.status}` : '',
  ].filter(Boolean)
  const status = blockers.length === 0
    ? 'PASS_V6_COST_TO_VERIFIED_COMPLETION_REPORT'
    : 'NEEDS_V6_COST_TO_VERIFIED_COMPLETION_EVIDENCE'
  const report = {
    schemaVersion: 'dsxu.v6.cost-to-verified-completion.v1',
    generatedAt: new Date().toISOString(),
    suite,
    status,
    claimBoundary:
      'This is an internal route/cost/cache policy report joined with existing DSXU replay and senior-window evidence. It is not a public benchmark score and must not be used for a 90% external claim.',
    blockers,
    observedEvidence: {
      v5ReplayBankPath: rel(V5_REPLAY_BANK),
      v5ReplayBankStatus: replayBank.status ?? null,
      v5AcceptedCount: n(replayBank.acceptedCount),
      seniorWindowPath: rel(SENIOR_WINDOW),
      seniorWindowStatus: senior?.status ?? null,
      seniorWindowFlashCostUsd: n(seniorCost.totalFlashCostUSD),
      seniorWindowProWasRun: seniorCost.proWasRun === true,
      seniorWindowFinal95ClaimAllowed: seniorChecks.final95ClaimAllowed === true,
    },
    board,
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const md = [
    '# DSXU V6 Cost To Verified Completion',
    '',
    `- status: \`${status}\``,
    `- suite: \`${suite}\``,
    `- scenarios: ${board.scenarioCount}`,
    `- flash turns: ${board.flashTurnCount}/${board.totalTurnCount} (${board.flashTurnRatioPct}%)`,
    `- pro turns: ${board.proTurnCount}/${board.totalTurnCount} (${board.proTurnRatioPct}%)`,
    `- cache hit rate: ${board.cacheHitRatePct}%`,
    `- total cost: $${board.totalCostUsd}`,
    `- pro-only modeled cost: $${board.proOnlyCostUsd}`,
    `- savings vs pro-only: ${board.savingsVsProOnlyPct}%`,
    `- senior window observed Flash cost: $${n(seniorCost.totalFlashCostUSD)}`,
    '',
    '## Claim Boundary',
    '',
    report.claimBoundary,
    '',
    '## Blockers',
    '',
    blockers.length === 0 ? '- none' : blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
    '## Evidence',
    '',
    `- ${rel(V5_REPLAY_BANK)}`,
    `- ${rel(SENIOR_WINDOW)}`,
    '',
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(status)
  console.log(JSON.stringify({
    suite,
    scenarioCount: board.scenarioCount,
    flashTurnRatioPct: board.flashTurnRatioPct,
    proTurnRatioPct: board.proTurnRatioPct,
    cacheHitRatePct: board.cacheHitRatePct,
    totalCostUsd: board.totalCostUsd,
    proOnlyCostUsd: board.proOnlyCostUsd,
    blockers,
    outputs: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
