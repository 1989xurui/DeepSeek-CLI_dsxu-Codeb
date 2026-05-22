import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type SourceSuiteId = 'hard-engineering' | 'raw-api-vs-dsxu'

type StreamUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  costUsd: number
  modelUsage: Record<string, unknown>
  numTurns: number
  toolResultChars: number
  maxToolResultChars: number
  failedToolResults: number
  resultEventSeen: boolean
}

type V4HitRateCase = {
  id: string
  suite: SourceSuiteId
  category: string
  title: string
  finalPass: boolean
  firstAttemptPass: boolean
  secondAttemptPass: boolean
  rawBaselinePass: boolean
  recoveryAfterBaselineFailure: boolean
  routeModels: string[]
  proAdmissionCount: number
  costUsd: number
  wallClockMs: number
  cacheHitRatePct: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  outputTokens: number
  toolResultChars: number
  maxToolResultChars: number
  failureRecoveryEvents: number
  toolUseCount: number
  rawTranscriptPath: string
  finalTestStdoutPath: string
  finalTestStderrPath: string
  artifactLogSizeBytes: number
  evidenceOk: boolean
  evidenceMissing: string[]
}

type V4HitRatePack = {
  schemaVersion: 'dsxu.v4.real-task-hit-rate-pack.v1'
  generatedAt: string
  status: 'PASS_V4_REAL_TASK_HIT_RATE_PACK' | 'BLOCKED_V4_REAL_TASK_HIT_RATE_PACK'
  owner: 'Evidence / benchmark / public challenge'
  claimBoundary: string
  sourceReports: string[]
  caseCount: number
  passCount: number
  finalPassRatePct: number
  firstAttemptPassRatePct: number
  secondAttemptRecoveryRatePct: number
  cacheHitRatePct: number
  totalCostUsd: number
  averageCostUsd: number
  averageWallClockMs: number
  totalToolResultChars: number
  averageToolResultChars: number
  proAdmissionCount: number
  failureRecoveryEvents: number
  routeModelCounts: Record<string, number>
  suiteCounts: Record<string, number>
  blockers: string[]
  dataStillNeeded: string[]
  cases: V4HitRateCase[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const HARD_ENGINEERING_REPORT = join(GENERATED_DIR, 'DSXU_HARD_ENGINEERING_BENCHMARK_20260517.json')
const RAW_API_VS_DSXU_REPORT = join(GENERATED_DIR, 'DSXU_RAW_API_VS_DSXU_AB_20260516.json')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V4_REAL_TASK_HIT_RATE_PACK_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V4_REAL_TASK_HIT_RATE_PACK_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V4_REAL_TASK_HIT_RATE_PACK_${DATE}.md`)

function n(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pct(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits))
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function resolveEvidencePath(path: unknown): string {
  const text = String(path ?? '').trim()
  if (!text) return ''
  return resolve(ROOT, text)
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

async function discoverGeneratedReports(baseFileName: string): Promise<string[]> {
  const basePath = join(GENERATED_DIR, `${baseFileName}.json`)
  const discovered: Array<{ path: string; mtimeMs: number }> = []
  try {
    const files = await readdir(GENERATED_DIR)
    for (const file of files) {
      if (file !== `${baseFileName}.json` && !file.startsWith(`${baseFileName}_`)) continue
      if (!file.endsWith('.json')) continue
      const path = join(GENERATED_DIR, file)
      discovered.push({ path, mtimeMs: (await stat(path)).mtimeMs })
    }
  } catch {
    return [basePath]
  }
  if (!discovered.some(item => item.path === basePath)) {
    discovered.unshift({ path: basePath, mtimeMs: 0 })
  }
  return discovered
    .sort((left, right) => left.mtimeMs - right.mtimeMs)
    .map(item => item.path)
}

function parseStreamJson(text: string): StreamUsage {
  let resultUsage: Record<string, unknown> = {}
  let resultModelUsage: Record<string, unknown> = {}
  let resultCostUsd = 0
  let numTurns = 0
  let resultEventSeen = false
  let toolResultChars = 0
  let maxToolResultChars = 0
  let failedToolResults = 0

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    const message = objectFrom(event.message)
    const content = arrayFrom(message.content)
    for (const block of content) {
      const item = objectFrom(block)
      if (item.type !== 'tool_result') continue
      const chars = typeof item.content === 'string'
        ? item.content.length
        : JSON.stringify(item.content ?? '').length
      toolResultChars += chars
      maxToolResultChars = Math.max(maxToolResultChars, chars)
      if (item.is_error === true) failedToolResults += 1
    }
    if (event.type === 'result') {
      resultEventSeen = true
      resultUsage = objectFrom(event.usage)
      resultModelUsage = objectFrom(event.modelUsage)
      resultCostUsd = n(event.total_cost_usd)
      numTurns = n(event.num_turns)
    }
  }

  const inputTokens = n(resultUsage.input_tokens)
  const cacheReadInputTokens = n(resultUsage.cache_read_input_tokens)
  const cacheCreationInputTokens = n(resultUsage.cache_creation_input_tokens)
  const outputTokens = n(resultUsage.output_tokens)
  return {
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    costUsd: resultCostUsd,
    modelUsage: resultModelUsage,
    numTurns,
    toolResultChars,
    maxToolResultChars,
    failedToolResults,
    resultEventSeen,
  }
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

async function buildCase(input: {
  suite: SourceSuiteId
  id: string
  category: string
  title: string
  raw: Record<string, unknown>
  dsxu: Record<string, unknown>
}): Promise<V4HitRateCase> {
  const tracePath = resolveEvidencePath(input.dsxu.tracePath)
  const stdoutPath = resolveEvidencePath(input.dsxu.finalTestStdoutPath ?? input.dsxu.stdoutPath)
  const stderrPath = resolveEvidencePath(input.dsxu.finalTestStderrPath ?? input.dsxu.stderrPath)
  const evidenceMissing: string[] = []
  let usage: StreamUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUsd: n(input.dsxu.costUSD),
    modelUsage: {},
    numTurns: 0,
    toolResultChars: 0,
    maxToolResultChars: 0,
    failedToolResults: 0,
    resultEventSeen: false,
  }

  if (!tracePath || !existsSync(tracePath)) {
    evidenceMissing.push('missing DSXU raw transcript')
  } else {
    usage = parseStreamJson(await readFile(tracePath, 'utf8'))
    if (!usage.resultEventSeen) evidenceMissing.push('missing stream-json result event')
  }
  if (!stdoutPath || !existsSync(stdoutPath)) evidenceMissing.push('missing final test stdout artifact')
  if (!stderrPath || !existsSync(stderrPath)) evidenceMissing.push('missing final test stderr artifact')

  const routeModels = Object.keys(usage.modelUsage).length > 0
    ? Object.keys(usage.modelUsage)
    : ['deepseek-v4-flash']
  const finalPass = input.dsxu.pass === true
  const rawBaselinePass = input.raw.pass === true
  const failureRecoveryEvents =
    usage.failedToolResults +
    (input.raw.pass === false && finalPass ? 1 : 0) +
    (n(input.dsxu.finalTestExitCode) === 0 ? 0 : 1)
  const toolUseCounts = objectFrom(input.dsxu.toolUseCounts)
  const toolUseCount = Object.values(toolUseCounts).reduce((sum, value) => sum + n(value), 0)
  const artifactLogSizeBytes =
    await fileSize(tracePath) +
    await fileSize(stdoutPath) +
    await fileSize(stderrPath)
  const cacheDenominator = usage.cacheReadInputTokens + usage.cacheCreationInputTokens

  return {
    id: input.id,
    suite: input.suite,
    category: input.category,
    title: input.title,
    finalPass,
    firstAttemptPass: finalPass && failureRecoveryEvents === 0,
    secondAttemptPass: finalPass && failureRecoveryEvents > 0,
    rawBaselinePass,
    recoveryAfterBaselineFailure: rawBaselinePass === false && finalPass,
    routeModels,
    proAdmissionCount: routeModels.filter(model => /pro/i.test(model)).length,
    costUsd: round(usage.costUsd || n(input.dsxu.costUSD)),
    wallClockMs: n(input.dsxu.durationMs),
    cacheHitRatePct: pct(usage.cacheReadInputTokens, cacheDenominator),
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    outputTokens: usage.outputTokens,
    toolResultChars: usage.toolResultChars,
    maxToolResultChars: usage.maxToolResultChars,
    failureRecoveryEvents,
    toolUseCount,
    rawTranscriptPath: tracePath ? rel(tracePath) : '',
    finalTestStdoutPath: stdoutPath ? rel(stdoutPath) : '',
    finalTestStderrPath: stderrPath ? rel(stderrPath) : '',
    artifactLogSizeBytes,
    evidenceOk: evidenceMissing.length === 0,
    evidenceMissing,
  }
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export async function buildV4RealTaskHitRatePack(options: {
  hardEngineeringReportPath?: string
  hardEngineeringReportPaths?: string[]
  rawApiVsDsxuReportPath?: string
  generatedAt?: string
} = {}): Promise<V4HitRatePack> {
  const hardReportPaths = options.hardEngineeringReportPaths
    ?? (options.hardEngineeringReportPath
      ? [options.hardEngineeringReportPath]
      : await discoverGeneratedReports('DSXU_HARD_ENGINEERING_BENCHMARK_20260517'))
  const rawReportPath = options.rawApiVsDsxuReportPath ?? RAW_API_VS_DSXU_REPORT
  const sourceReports = [...hardReportPaths, rawReportPath]
  const blockers: string[] = []
  const cases: V4HitRateCase[] = []
  const hardTasksById = new Map<string, Record<string, unknown>>()

  for (const reportPath of sourceReports) {
    if (!existsSync(reportPath)) blockers.push(`missing source report: ${rel(reportPath)}`)
  }

  for (const hardReportPath of hardReportPaths) {
    if (!existsSync(hardReportPath)) continue
    const report = await readJson(hardReportPath)
    for (const task of arrayFrom(report.tasks)) {
      const item = objectFrom(task)
      const id = String(item.id ?? '')
      if (id) hardTasksById.set(id, item)
    }
  }

  for (const item of hardTasksById.values()) {
    cases.push(await buildCase({
      suite: 'hard-engineering',
      id: String(item.id ?? ''),
      category: String(item.lane ?? 'unknown'),
      title: String(item.title ?? ''),
      raw: objectFrom(item.raw),
      dsxu: objectFrom(item.dsxu),
    }))
  }

  if (existsSync(rawReportPath)) {
    const report = await readJson(rawReportPath)
    for (const task of arrayFrom(report.tasks)) {
      const item = objectFrom(task)
      cases.push(await buildCase({
        suite: 'raw-api-vs-dsxu',
        id: String(item.id ?? ''),
        category: 'workflow-lift',
        title: String(item.title ?? item.id ?? ''),
        raw: objectFrom(item.raw),
        dsxu: objectFrom(item.dsxu),
      }))
    }
  }

  const evidenceMissingCases = cases.filter(item => !item.evidenceOk)
  if (cases.length < 20) blockers.push(`need at least 20 real DSXU task traces, found ${cases.length}`)
  if (evidenceMissingCases.length > 0) {
    blockers.push(`${evidenceMissingCases.length} case(s) are missing raw transcript or final-test artifacts`)
  }

  const passCount = cases.filter(item => item.finalPass).length
  const firstAttemptPassCount = cases.filter(item => item.firstAttemptPass).length
  const secondAttemptPassCount = cases.filter(item => item.secondAttemptPass).length
  const cacheReadInputTokens = cases.reduce((sum, item) => sum + item.cacheReadInputTokens, 0)
  const cacheCreationInputTokens = cases.reduce((sum, item) => sum + item.cacheCreationInputTokens, 0)
  const totalCostUsd = cases.reduce((sum, item) => sum + item.costUsd, 0)
  const totalWallClockMs = cases.reduce((sum, item) => sum + item.wallClockMs, 0)
  const totalToolResultChars = cases.reduce((sum, item) => sum + item.toolResultChars, 0)
  const proAdmissionCount = cases.reduce((sum, item) => sum + item.proAdmissionCount, 0)
  const failureRecoveryEvents = cases.reduce((sum, item) => sum + item.failureRecoveryEvents, 0)
  const routeModelCounts = countBy(cases.flatMap(item => item.routeModels))
  const suiteCounts = countBy(cases.map(item => item.suite))

  return {
    schemaVersion: 'dsxu.v4.real-task-hit-rate-pack.v1',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_V4_REAL_TASK_HIT_RATE_PACK'
      : 'BLOCKED_V4_REAL_TASK_HIT_RATE_PACK',
    owner: 'Evidence / benchmark / public challenge',
    claimBoundary: 'This pack aggregates real DSXU internal task traces and stream-json usage. It supports internal V4 launch-acceptance evidence only; it is not an external leaderboard, not a 90/95 claim, and not a target-reference comparison.',
    sourceReports: sourceReports.map(rel),
    caseCount: cases.length,
    passCount,
    finalPassRatePct: pct(passCount, cases.length),
    firstAttemptPassRatePct: pct(firstAttemptPassCount, cases.length),
    secondAttemptRecoveryRatePct: pct(secondAttemptPassCount, Math.max(1, cases.length - firstAttemptPassCount)),
    cacheHitRatePct: pct(cacheReadInputTokens, cacheReadInputTokens + cacheCreationInputTokens),
    totalCostUsd: round(totalCostUsd),
    averageCostUsd: round(totalCostUsd / Math.max(1, cases.length)),
    averageWallClockMs: Math.round(totalWallClockMs / Math.max(1, cases.length)),
    totalToolResultChars,
    averageToolResultChars: Math.round(totalToolResultChars / Math.max(1, cases.length)),
    proAdmissionCount,
    failureRecoveryEvents,
    routeModelCounts,
    suiteCounts,
    blockers,
    dataStillNeeded: [
      'External target/reference paired raw transcripts are still required before any external win/loss or reference-product comparison claim.',
      'A fresh rerun is required before publishing time-sensitive GitHub charts if source, provider, or benchmark fixtures change.',
      'Cache hit rate is an observed trend metric; do not turn it into a hard public ability claim.',
    ],
    cases,
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toCsv(pack: V4HitRatePack): string {
  const columns = [
    'suite',
    'id',
    'category',
    'finalPass',
    'firstAttemptPass',
    'secondAttemptPass',
    'cacheHitRatePct',
    'costUsd',
    'wallClockMs',
    'toolResultChars',
    'failureRecoveryEvents',
    'proAdmissionCount',
    'rawTranscriptPath',
  ] as const
  return [
    columns.map(csvCell).join(','),
    ...pack.cases.map(item => columns.map(column => csvCell(item[column])).join(',')),
  ].join('\n') + '\n'
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const cell = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => cell(row[column])).join(' | ')} |`),
  ].join('\n')
}

function toMarkdown(pack: V4HitRatePack): string {
  const summaryRows = [{
    status: pack.status,
    caseCount: pack.caseCount,
    finalPassRatePct: pack.finalPassRatePct,
    firstAttemptPassRatePct: pack.firstAttemptPassRatePct,
    secondAttemptRecoveryRatePct: pack.secondAttemptRecoveryRatePct,
    cacheHitRatePct: pack.cacheHitRatePct,
    totalCostUsd: pack.totalCostUsd,
    proAdmissionCount: pack.proAdmissionCount,
  }]
  return [
    '# DSXU V4 Real Task Hit-Rate Pack - 2026-05-19',
    '',
    `Status: \`${pack.status}\``,
    '',
    pack.claimBoundary,
    '',
    '## Summary',
    '',
    markdownTable(summaryRows, [
      'status',
      'caseCount',
      'finalPassRatePct',
      'firstAttemptPassRatePct',
      'secondAttemptRecoveryRatePct',
      'cacheHitRatePct',
      'totalCostUsd',
      'proAdmissionCount',
    ]),
    '',
    '## Source Reports',
    '',
    ...pack.sourceReports.map(path => `- \`${path}\``),
    '',
    '## Cases',
    '',
    markdownTable(pack.cases.map(item => ({
      suite: item.suite,
      id: item.id,
      category: item.category,
      finalPass: item.finalPass,
      cacheHitRatePct: item.cacheHitRatePct,
      costUsd: item.costUsd,
      wallClockMs: item.wallClockMs,
      toolResultChars: item.toolResultChars,
      evidenceOk: item.evidenceOk,
    })), [
      'suite',
      'id',
      'category',
      'finalPass',
      'cacheHitRatePct',
      'costUsd',
      'wallClockMs',
      'toolResultChars',
      'evidenceOk',
    ]),
    '',
    '## Blockers',
    '',
    ...(pack.blockers.length > 0 ? pack.blockers.map(item => `- ${item}`) : ['- none']),
    '',
    '## Data Still Needed',
    '',
    ...pack.dataStillNeeded.map(item => `- ${item}`),
    '',
    `Evidence hash: \`${sha(JSON.stringify(pack.cases.map(item => [item.suite, item.id, item.rawTranscriptPath, item.finalPass]))).slice(0, 16)}\``,
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  const pack = await buildV4RealTaskHitRatePack()
  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeFile(OUT_JSON, `${JSON.stringify(pack, null, 2)}\n`, 'utf8'),
    writeFile(OUT_CSV, toCsv(pack), 'utf8'),
    writeFile(OUT_MD, toMarkdown(pack), 'utf8'),
  ])
  console.log(JSON.stringify({
    status: pack.status,
    caseCount: pack.caseCount,
    finalPassRatePct: pack.finalPassRatePct,
    firstAttemptPassRatePct: pack.firstAttemptPassRatePct,
    secondAttemptRecoveryRatePct: pack.secondAttemptRecoveryRatePct,
    cacheHitRatePct: pack.cacheHitRatePct,
    totalCostUsd: pack.totalCostUsd,
    totalToolResultChars: pack.totalToolResultChars,
    proAdmissionCount: pack.proAdmissionCount,
    outputJson: rel(OUT_JSON),
    outputMd: rel(OUT_MD),
  }, null, 2))
  if (pack.status !== 'PASS_V4_REAL_TASK_HIT_RATE_PACK') process.exitCode = 1
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
