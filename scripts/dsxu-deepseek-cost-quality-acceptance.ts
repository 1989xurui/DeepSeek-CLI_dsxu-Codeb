import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  buildDSXUDeepSeekCostQualityBoard,
  type DSXUCostQualityScenario,
} from '../src/dsxu/engine/deepseek-cost-quality-board'

const ROOT = process.cwd()
const DATE = '20260516'
const V24_DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_${DATE}.md`)
const PUBLIC_CHALLENGE_JSON = join(GENERATED_DIR, `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${V24_DATE}.json`)
const COST_CACHE_TEST = 'src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts'
const LIVE_PROVIDER_SOURCE = join(ROOT, '.dsxu', 'trace', 'v18-live-provider', 'live-cache-prefix-payload-smoke.json')

function n(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
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

function controlledProRescueScenario(): DSXUCostQualityScenario {
  return {
    id: 'v19_phase5_fresh_non22_bugfix_recovery',
    label: 'Fresh bugfix recovery with Pro admission after failed Flash verification plus high-risk recovery classification',
    source: 'controlled-local-harness',
    solved: true,
    evidencePaths: [COST_CACHE_TEST, '.dsxu/trace/deepseek-cost-quality-acceptance/pro-rescue'],
    publicClaimScope: 'internal-proof',
    stablePrefixStable: true,
    dynamicTailVaried: true,
    toolResultChars: 0,
    readToolCallCount: 0,
    turns: [
      {
        nodeId: 'flash-max-plan',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash-max',
        routeReason: 'planning_flash_thinking_max',
        cacheHitInputTokens: 8000,
        cacheMissInputTokens: 2000,
        outputTokens: 500,
      },
      {
        nodeId: 'flash-code-attempt',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash',
        routeReason: 'coding_flash_thinking_high',
        cacheHitInputTokens: 12000,
        cacheMissInputTokens: 4000,
        outputTokens: 700,
      },
      {
        nodeId: 'flash-code-reread',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash',
        routeReason: 'coding_flash_thinking_high',
        cacheHitInputTokens: 15100,
        cacheMissInputTokens: 1400,
        outputTokens: 650,
      },
      {
        nodeId: 'pro-failed-verification-recovery',
        model: 'deepseek-v4-pro',
        publicRoute: 'pro',
        routeReason: 'high_risk_pro_thinking_max_requires_approval',
        cacheHitInputTokens: 21600,
        cacheMissInputTokens: 2400,
        outputTokens: 1200,
        flashAttemptedBeforePro: true,
        proAdmissionReason: 'Pro admitted only after Flash tried the same case, native verification still failed, and recovery was marked high-risk',
        proSavedTask: true,
      },
    ],
  }
}

function controlledFlashOnlyScenario(): DSXUCostQualityScenario {
  return {
    id: 'v19_phase5_flash_only_success_non22_feature',
    label: 'Fresh feature solved by Flash/Flash-MAX without Pro',
    source: 'controlled-local-harness',
    solved: true,
    evidencePaths: [COST_CACHE_TEST, '.dsxu/trace/deepseek-cost-quality-acceptance/flash-only'],
    publicClaimScope: 'internal-proof',
    stablePrefixStable: true,
    dynamicTailVaried: true,
    toolResultChars: 0,
    readToolCallCount: 0,
    turns: [
      {
        nodeId: 'flash-max-feature-plan',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash-max',
        routeReason: 'planning_flash_thinking_max',
        cacheHitInputTokens: 7600,
        cacheMissInputTokens: 1400,
        outputTokens: 420,
      },
      {
        nodeId: 'flash-feature-code',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash',
        routeReason: 'coding_flash_thinking_high',
        cacheHitInputTokens: 11800,
        cacheMissInputTokens: 2200,
        outputTokens: 760,
      },
      {
        nodeId: 'flash-feature-verify',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash',
        routeReason: 'verification_flash_non_thinking',
        cacheHitInputTokens: 7400,
        cacheMissInputTokens: 600,
        outputTokens: 260,
      },
    ],
  }
}

function publicChallengeScenario(report: Record<string, unknown> | null): DSXUCostQualityScenario | null {
  if (!report) return null
  const summary = objectFrom(report.flashCacheSummary)
  if (Object.keys(summary).length === 0) return null
  const routeReasons = Array.isArray(summary.routeReasons) ? summary.routeReasons.map(String) : []
  return {
    id: 'public-challenge-flash-review',
    label: 'Public challenge Flash review lane',
    source: 'public-challenge',
    solved: String(report.status) === 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY' && report.flashPass === true,
    evidencePaths: [rel(PUBLIC_CHALLENGE_JSON)],
    publicClaimScope: 'release-claim',
    scoreFloor: n(report.scoreFloor),
    scoreTarget: 90,
    cacheTargetHitRatePct: n(summary.targetHitRatePct, 70),
    stablePrefixStable: n(summary.uniqueStablePrefixHashes) === 1,
    dynamicTailVaried: n(summary.uniqueDynamicTailHashes) > 1,
    toolResultChars: n(summary.toolResultChars),
    readToolCallCount: n(summary.readToolCallCount),
    turns: [
      {
        nodeId: 'public-challenge-flash-reviews',
        model: 'deepseek-v4-flash',
        publicRoute: 'flash-max',
        routeReason: routeReasons[0] ?? 'review_flash_thinking_max',
        cacheHitInputTokens: n(summary.cacheHitInputTokens),
        cacheMissInputTokens: n(summary.cacheMissInputTokens),
        outputTokens: n(summary.outputTokens),
      },
    ],
  }
}

function liveProviderScenario(report: Record<string, unknown> | null): DSXUCostQualityScenario | null {
  if (!report) return null
  const steps = Array.isArray(report.steps) ? report.steps.map(objectFrom) : []
  if (steps.length === 0) return null
  return {
    id: 'v19_phase5_live_provider_cache_prefix_billing',
    label: 'Live provider cache prefix smoke',
    source: 'live-provider',
    solved: report.ok === true,
    evidencePaths: [rel(LIVE_PROVIDER_SOURCE), String(report.evidencePath ?? '')].filter(Boolean),
    publicClaimScope: 'public-demo',
    cacheTargetHitRatePct: 70,
    stablePrefixStable: true,
    dynamicTailVaried: report.dynamicTailChanges === true,
    toolResultChars: 0,
    readToolCallCount: 0,
    turns: steps.map(step => ({
      nodeId: `live-provider-${String(step.name ?? 'step')}`,
      model: String(step.model ?? 'deepseek-v4-flash'),
      publicRoute: 'flash',
      routeReason: String(step.routeReason ?? 'verification_flash_non_thinking'),
      cacheHitInputTokens: n(step.cacheHitInputTokens),
      cacheMissInputTokens: n(step.cacheMissInputTokens),
      outputTokens: n(step.outputTokens),
    })),
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const publicChallenge = await readJson(PUBLIC_CHALLENGE_JSON)
  const providerSource = existsSync(LIVE_PROVIDER_SOURCE) ? await readJson(LIVE_PROVIDER_SOURCE) : null
  const scenarios = [
    controlledProRescueScenario(),
    controlledFlashOnlyScenario(),
    publicChallengeScenario(publicChallenge),
    liveProviderScenario(providerSource),
  ].filter((item): item is DSXUCostQualityScenario => item !== null)
  const board = buildDSXUDeepSeekCostQualityBoard({ scenarios })
  const pass =
    board.status === 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE' &&
    board.flashFirstCostClaimAllowed &&
    board.proAdmissionClaimAllowed &&
    board.public90ClaimAllowed === false &&
    board.blockedClaims.some(claim => claim.includes('public 90%')) &&
    publicChallengeScenario(publicChallenge) !== null

  const report = {
    schemaVersion: 'dsxu.deepseek-cost-quality-acceptance.v1',
    generatedAt: board.generatedAt,
    status: pass ? 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE' : 'FAIL_DEEPSEEK_COST_QUALITY_ACCEPTANCE',
    board,
    inputs: {
      publicChallengePath: rel(PUBLIC_CHALLENGE_JSON),
      publicChallengeFound: publicChallenge !== null,
      controlledHarnessTest: COST_CACHE_TEST,
      liveProviderSourcePath: rel(LIVE_PROVIDER_SOURCE),
      liveProviderSourceFound: providerSource !== null,
    },
    releaseClaimBoundary: {
      flashFirstCostClaimAllowed: board.flashFirstCostClaimAllowed,
      proAdmissionClaimAllowed: board.proAdmissionClaimAllowed,
      public90ClaimAllowed: board.public90ClaimAllowed,
      cacheHighRoiClaimAllowed: board.cacheHighRoiClaimAllowed,
      note: 'Public GitHub copy may use Flash-first cost and evidenced Pro-admission claims. It must not claim public 90% ability or high cache ROI until fixed raw tasks prove those numbers.',
    },
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const csvRows = [
    ['id', 'source', 'solved', 'turns', 'flashTurnRatioPct', 'proTurnRatioPct', 'cacheHitRatePct', 'totalCostUsd', 'proOnlyCostUsd', 'savingsVsProOnlyPct', 'claimStatus', 'cacheClaimStatus', 'public90ClaimStatus'],
    ...board.scenarios.map(row => [
      row.id,
      row.source,
      String(row.solved),
      String(row.turnCount),
      String(row.flashTurnRatioPct),
      String(row.proTurnRatioPct),
      String(row.cacheHitRatePct),
      String(row.totalCostUsd),
      String(row.proOnlyCostUsd),
      String(row.savingsVsProOnlyPct),
      row.claimStatus,
      row.cacheClaimStatus,
      row.public90ClaimStatus,
    ]),
  ]
  await writeFile(OUT_CSV, csvRows.map(row => row.map(csvCell).join(',')).join('\n'), 'utf8')

  const md = [
    `# DSXU DeepSeek Cost Quality Acceptance - ${DATE}`,
    '',
    `Status: ${report.status}`,
    '',
    '## Board',
    '',
    `- scenarios: ${board.scenarioCount}`,
    `- solvedScenarioCount: ${board.solvedScenarioCount}`,
    `- totalTurnCount: ${board.totalTurnCount}`,
    `- flashTurnRatioPct: ${board.flashTurnRatioPct}`,
    `- proTurnRatioPct: ${board.proTurnRatioPct}`,
    `- cacheHitRatePct: ${board.cacheHitRatePct}`,
    `- totalCostUsd: ${board.totalCostUsd}`,
    `- proOnlyCostUsd: ${board.proOnlyCostUsd}`,
    `- savingsVsProOnlyPct: ${board.savingsVsProOnlyPct}`,
    `- public90ClaimAllowed: ${board.public90ClaimAllowed}`,
    `- cacheHighRoiClaimAllowed: ${board.cacheHighRoiClaimAllowed}`,
    `- flashFirstCostClaimAllowed: ${board.flashFirstCostClaimAllowed}`,
    `- proAdmissionClaimAllowed: ${board.proAdmissionClaimAllowed}`,
    '',
    '## Scenario Rows',
    '',
    '| id | source | solved | turns | flash % | pro % | cache hit % | cost | pro-only | savings % | claim |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...board.scenarios.map(row => `| ${row.id} | ${row.source} | ${row.solved} | ${row.turnCount} | ${row.flashTurnRatioPct} | ${row.proTurnRatioPct} | ${row.cacheHitRatePct} | ${row.totalCostUsd} | ${row.proOnlyCostUsd} | ${row.savingsVsProOnlyPct} | ${row.claimStatus} |`),
    '',
    '## Allowed Claims',
    '',
    ...(board.allowedClaims.length > 0 ? board.allowedClaims.map(claim => `- ${claim}`) : ['- none']),
    '',
    '## Trend-Only / Blocked Claims',
    '',
    ...(board.trendOnlyClaims.length > 0 ? board.trendOnlyClaims.map(claim => `- ${claim}`) : ['- none']),
    ...(board.blockedClaims.length > 0 ? board.blockedClaims.map(claim => `- ${claim}`) : ['- none']),
    '',
    '## Boundary',
    '',
    '- This board proves DSXU DeepSeek route/cost/cache evidence, not public 90% ability.',
    '- Cache hit rate is reported as an observed metric and trend unless the public/live scenario reaches the target with stable prefix evidence.',
    '- Pro use is sellable only as an admission-controlled rescue path with prior Flash attempt and saved-task evidence.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  if (!pass) {
    console.error(report.status)
    console.error(board.guards.join('; '))
    process.exit(1)
  }
  console.log(report.status)
  console.log(`flashTurnRatioPct=${board.flashTurnRatioPct}`)
  console.log(`savingsVsProOnlyPct=${board.savingsVsProOnlyPct}`)
  console.log(`cacheHitRatePct=${board.cacheHitRatePct}`)
  console.log(`public90ClaimAllowed=${board.public90ClaimAllowed}`)
  console.log(`cacheHighRoiClaimAllowed=${board.cacheHighRoiClaimAllowed}`)
}

await main()
