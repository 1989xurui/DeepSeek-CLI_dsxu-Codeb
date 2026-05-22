import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  buildDSXUPublicChallengeAblationBoard,
  type DSXUPublicChallengeReviewMetrics,
} from '../src/dsxu/engine/public-challenge-ablation-board'

type TraceSpec = {
  id: string
  tracePath: string
  trajectoryPath: string
}

type PublicChallengePackage = {
  status?: string
  flashReviews?: Array<{
    id?: string
    tracePath?: string
    trajectoryPath?: string
    parsed?: {
      score_0_100?: number
      package_ready?: boolean
      did_use_source_truth_capsule?: boolean
      no_second_runtime?: boolean
    }
  }>
}

type TrajectoryEvent = {
  event?: string
  paramsModel?: string
  modelName?: string
  responseModel?: string
  routeReason?: string
  systemPromptSummary?: {
    normalizedHash?: string
  }
  assistantToolCalls?: Array<{ name?: string }>
  toolCalls?: Array<{ name?: string }>
  toolResults?: Array<{ contentChars?: number; chars?: number; content?: string }>
  usage?: {
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
    dsxu?: {
      prompt_cache_hit_tokens?: number
      prompt_cache_miss_tokens?: number
      estimated_cost_usd?: number
    }
  }
}

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const CURRENT_PACKAGE = join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json')
const OUT_JSON = join(GENERATED_DIR, `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_${DATE}.md`)

const EXPECTED_REVIEW_IDS = [
  'flash-public-claim-guard-review',
  'flash-senior-coding-experience-review',
  'flash-release-ecosystem-review',
]

const BEFORE_SPECS: TraceSpec[] = [
  traceSpec('flash-public-claim-guard-review', '2026-05-16T02-30-16-637Z'),
  traceSpec('flash-senior-coding-experience-review', '2026-05-16T02-30-58-996Z'),
  traceSpec('flash-release-ecosystem-review', '2026-05-16T02-31-44-887Z'),
]

const AFTER_FALLBACK_SPECS: TraceSpec[] = [
  traceSpec('flash-public-claim-guard-review', '2026-05-16T05-18-32-641Z'),
  traceSpec('flash-senior-coding-experience-review', '2026-05-16T05-18-52-073Z'),
  traceSpec('flash-release-ecosystem-review', '2026-05-16T05-19-37-505Z'),
]

function traceSpec(id: string, stamp: string): TraceSpec {
  const base = join(ROOT, '.dsxu', 'trace', 'v24-public-challenge-package', `${id}-${stamp}`)
  return {
    id,
    tracePath: `${base}.jsonl`,
    trajectoryPath: `${base}.trajectory.jsonl`,
  }
}

async function main() {
  const currentPackage = await loadCurrentPackage()
  const afterSpecs = specsFromPackage(currentPackage) ?? AFTER_FALLBACK_SPECS
  const before = await Promise.all(BEFORE_SPECS.map(readReviewMetrics))
  const after = await Promise.all(afterSpecs.map(readReviewMetrics))

  const board = buildDSXUPublicChallengeAblationBoard({
    before: { label: 'before', reviews: before },
    after: { label: 'after', reviews: after },
    expectedReviewIds: EXPECTED_REVIEW_IDS,
    cacheHitRateClaimTargetPct: 70,
    sourceTruthPolicy: 'source-truth capsule is the default public challenge input; Read tool is a bounded fallback, not the main path',
    currentPackagePath: relative(ROOT, CURRENT_PACKAGE).replace(/\\/g, '/'),
    currentPackageStatus: currentPackage.status,
  })

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify({ ...board, reviews: { before, after } }, null, 2)}\n`, 'utf8')
  await writeFile(OUT_CSV, buildCsv(board.before.reviewIds, before, after), 'utf8')
  await writeFile(OUT_MD, buildMarkdown(board), 'utf8')

  console.log(board.status)
  console.log(`scoreFloor=${board.before.scoreFloor}->${board.after.scoreFloor}`)
  console.log(`costUSD=${board.before.totalCostUSD}->${board.after.totalCostUSD}`)
  console.log(`cacheHitRatePct=${board.before.cacheHitRatePct}->${board.after.cacheHitRatePct}`)
  console.log(`readToolCallCount=${board.before.readToolCallCount}->${board.after.readToolCallCount}`)
  console.log(`toolResultChars=${board.before.toolResultChars}->${board.after.toolResultChars}`)
  console.log(`json=${relative(ROOT, OUT_JSON).replace(/\\/g, '/')}`)
  console.log(`markdown=${relative(ROOT, OUT_MD).replace(/\\/g, '/')}`)
}

async function loadCurrentPackage(): Promise<PublicChallengePackage> {
  if (!existsSync(CURRENT_PACKAGE)) return {}
  return JSON.parse(await readFile(CURRENT_PACKAGE, 'utf8')) as PublicChallengePackage
}

function specsFromPackage(currentPackage: PublicChallengePackage): TraceSpec[] | null {
  const reviews = currentPackage.flashReviews ?? []
  if (reviews.length === 0) return null
  const specs = reviews
    .map(review => ({
      id: review.id ?? '',
      tracePath: normalizePath(review.tracePath ?? ''),
      trajectoryPath: normalizePath(review.trajectoryPath ?? ''),
    }))
    .filter(spec => spec.id && existsSync(spec.tracePath) && existsSync(spec.trajectoryPath))
  return specs.length === EXPECTED_REVIEW_IDS.length ? specs : null
}

function normalizePath(path: string): string {
  if (!path) return path
  return path.replace(/\\/g, '/').replace(/^D:\//, 'D:/')
}

async function readReviewMetrics(spec: TraceSpec): Promise<DSXUPublicChallengeReviewMetrics> {
  if (!existsSync(spec.tracePath)) throw new Error(`missing trace: ${spec.tracePath}`)
  if (!existsSync(spec.trajectoryPath)) throw new Error(`missing trajectory: ${spec.trajectoryPath}`)
  const [traceRaw, trajectoryRaw] = await Promise.all([
    readFile(spec.tracePath, 'utf8'),
    readFile(spec.trajectoryPath, 'utf8'),
  ])
  const score = parseTraceScore(traceRaw)
  const metrics = parseTrajectory(trajectoryRaw)
  const inputTokens = metrics.cacheHitInputTokens + metrics.cacheMissInputTokens

  return {
    id: spec.id,
    score: score.score,
    passed: score.passed,
    totalCostUSD: round(metrics.totalCostUSD, 10),
    requestCount: metrics.requestCount,
    proRequestCount: metrics.proRequestCount,
    cacheHitInputTokens: metrics.cacheHitInputTokens,
    cacheMissInputTokens: metrics.cacheMissInputTokens,
    outputTokens: metrics.outputTokens,
    cacheHitRatePct: round(inputTokens > 0 ? (metrics.cacheHitInputTokens / inputTokens) * 100 : 0, 1),
    readToolCallCount: metrics.readToolCallCount,
    toolResultCount: metrics.toolResultCount,
    toolResultChars: metrics.toolResultChars,
    uniqueSystemHashCount: metrics.systemHashes.size,
    routeReasons: [...metrics.routeReasons].sort(),
    models: [...metrics.models].sort(),
    tracePath: relative(ROOT, spec.tracePath).replace(/\\/g, '/'),
    trajectoryPath: relative(ROOT, spec.trajectoryPath).replace(/\\/g, '/'),
  }
}

function parseTrajectory(raw: string) {
  const routeReasons = new Set<string>()
  const models = new Set<string>()
  const systemHashes = new Set<string>()
  let requestCount = 0
  let cacheHitInputTokens = 0
  let cacheMissInputTokens = 0
  let outputTokens = 0
  let totalCostUSD = 0
  let proRequestCount = 0
  let readToolCallCount = 0
  let toolResultCount = 0
  let toolResultChars = 0

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    const event = parseJsonLine<TrajectoryEvent>(line)
    if (!event) continue
    if (event.event === 'request_plan') {
      requestCount += 1
      addIfPresent(models, event.modelName ?? event.paramsModel)
      addIfPresent(routeReasons, event.routeReason)
      addIfPresent(systemHashes, event.systemPromptSummary?.normalizedHash)
      if (/(pro)/i.test(event.modelName ?? event.paramsModel ?? '')) proRequestCount += 1
    }
    if (event.event === 'request_messages') {
      const toolResults = event.toolResults ?? []
      toolResultCount += toolResults.length
      toolResultChars += toolResults.reduce((acc, item) => acc + (item.contentChars ?? item.chars ?? item.content?.length ?? 0), 0)
      readToolCallCount += countReadCalls(event.assistantToolCalls)
    }
    if (event.event === 'stream_response') {
      readToolCallCount += countReadCalls(event.toolCalls)
    }
    if (event.event === 'response_usage') {
      addIfPresent(models, event.modelName ?? event.responseModel)
      addIfPresent(routeReasons, event.routeReason)
      cacheHitInputTokens += num(event.usage?.dsxu?.prompt_cache_hit_tokens ?? event.usage?.cache_read_input_tokens)
      cacheMissInputTokens += num(event.usage?.dsxu?.prompt_cache_miss_tokens ?? event.usage?.cache_creation_input_tokens)
      outputTokens += num(event.usage?.output_tokens)
      totalCostUSD += num(event.usage?.dsxu?.estimated_cost_usd)
    }
  }

  return {
    routeReasons,
    models,
    systemHashes,
    requestCount,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    totalCostUSD,
    proRequestCount,
    readToolCallCount,
    toolResultCount,
    toolResultChars,
  }
}

function parseTraceScore(raw: string): { score: number; passed: boolean } {
  const resultLine = raw
    .split(/\r?\n/)
    .map(line => parseJsonLine<Record<string, unknown>>(line))
    .find(line => line?.type === 'result')
  const resultText = typeof resultLine?.result === 'string' ? resultLine.result : raw
  const parsed = extractObject(resultText)
  const score = num(parsed?.score_0_100)
  const passed =
    parsed?.package_ready === true ||
    (parsed?.did_use_source_truth_capsule === true && parsed?.no_second_runtime === true) ||
    score >= 70
  return { score, passed }
}

function extractObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = fenced ? [fenced[1] ?? ''] : []
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

function parseJsonLine<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T
  } catch {
    return null
  }
}

function countReadCalls(calls: Array<{ name?: string }> | undefined): number {
  return (calls ?? []).filter(call => call.name === 'Read').length
}

function addIfPresent(set: Set<string>, value: string | undefined) {
  if (value) set.add(value)
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function buildCsv(
  reviewIds: string[],
  before: DSXUPublicChallengeReviewMetrics[],
  after: DSXUPublicChallengeReviewMetrics[],
): string {
  const byBefore = new Map(before.map(review => [review.id, review]))
  const byAfter = new Map(after.map(review => [review.id, review]))
  const header = [
    'id',
    'beforeScore',
    'afterScore',
    'beforeCostUSD',
    'afterCostUSD',
    'beforeCacheHitRatePct',
    'afterCacheHitRatePct',
    'beforeReadToolCalls',
    'afterReadToolCalls',
    'beforeToolResultChars',
    'afterToolResultChars',
    'beforeProRequests',
    'afterProRequests',
  ]
  const rows = reviewIds.map(id => {
    const left = byBefore.get(id)
    const right = byAfter.get(id)
    return [
      id,
      left?.score,
      right?.score,
      left?.totalCostUSD,
      right?.totalCostUSD,
      left?.cacheHitRatePct,
      right?.cacheHitRatePct,
      left?.readToolCallCount,
      right?.readToolCallCount,
      left?.toolResultChars,
      right?.toolResultChars,
      left?.proRequestCount,
      right?.proRequestCount,
    ].map(csvCell).join(',')
  })
  return `${header.join(',')}\n${rows.join('\n')}\n`
}

function buildMarkdown(board: ReturnType<typeof buildDSXUPublicChallengeAblationBoard>): string {
  return [
    '# DSXU Public Challenge Ablation Acceptance - 2026-05-16',
    '',
    `Status: \`${board.status}\``,
    '',
    'This report closes E02 as a same-task before/after ablation acceptance. It does not create an external benchmark runtime and does not claim external comparison win.',
    '',
    '## Before / After',
    '',
    '| metric | before | after | delta |',
    '|---|---:|---:|---:|',
    `| scoreFloor | ${board.before.scoreFloor} | ${board.after.scoreFloor} | ${board.deltas.scoreFloorDelta} |`,
    `| totalCostUSD | ${board.before.totalCostUSD} | ${board.after.totalCostUSD} | ${board.deltas.totalCostUSDDelta} |`,
    `| costSavingsPct | 0 | ${board.deltas.totalCostSavingsPct} | ${board.deltas.totalCostSavingsPct} |`,
    `| cacheHitRatePct | ${board.before.cacheHitRatePct} | ${board.after.cacheHitRatePct} | ${board.deltas.cacheHitRatePctDelta} |`,
    `| readToolCallCount | ${board.before.readToolCallCount} | ${board.after.readToolCallCount} | ${board.deltas.readToolCallDelta} |`,
    `| toolResultChars | ${board.before.toolResultChars} | ${board.after.toolResultChars} | ${board.deltas.toolResultCharsDelta} |`,
    `| proRequestCount | ${board.before.proRequestCount} | ${board.after.proRequestCount} | ${board.deltas.proRequestCountDelta} |`,
    `| maxUniqueSystemHashCount | ${board.before.maxUniqueSystemHashCount} | ${board.after.maxUniqueSystemHashCount} | ${board.deltas.maxUniqueSystemHashCountDelta} |`,
    '',
    '## Gates',
    '',
    '| gate | pass |',
    '|---|---:|',
    ...Object.entries(board.gates).map(([gate, pass]) => `| ${gate} | ${pass} |`),
    '',
    '## Claim Boundary',
    '',
    `- ablationRunnerAllowed: \`${board.claimAblationRunnerAllowed}\``,
    `- observedCacheTrendAllowed: \`${board.claimObservedCacheTrendAllowed}\``,
    `- highCacheRoiAllowed: \`${board.claimHighCacheRoiAllowed}\``,
    `- externalComparisonAllowed: \`${board.claimExternalComparisonAllowed}\``,
    `- public90Allowed: \`${board.claimPublic90Allowed}\``,
    '',
    'Blocked claims:',
    '',
    ...board.blockedClaims.map(claim => `- ${claim}`),
    '',
    '## Evidence',
    '',
    `- currentPackage: \`${board.currentPackagePath}\``,
    `- currentPackageStatus: \`${board.currentPackageStatus ?? 'unknown'}\``,
    `- before trajectories: ${board.before.trajectories.map(path => `\`${path}\``).join(', ')}`,
    `- after trajectories: ${board.after.trajectories.map(path => `\`${path}\``).join(', ')}`,
    '',
  ].join('\n')
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
