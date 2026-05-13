import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision.js'
import {
  collectEvidenceFromVerificationEvents,
  getVerificationIntentKey,
  type SemanticVerificationEvent,
} from './v18-semantic-tools.js'

type LiveReportCase = {
  id: string
  category?: string
  prompt?: string
  status?: string
  logPath?: string
  policyPassed?: boolean
  routeExpectation?: {
    expectedModel?: string
    routeReason?: string
  }
  metrics?: {
    toolCalls?: number
    readCalls?: number
    powerShellCalls?: number
    bashCalls?: number
    editCalls?: number
    failedEditCalls?: number
    totalCostUSD?: number
    actualCommands?: string[]
    modelsUsed?: string[]
    modelUsage?: Record<
      string,
      {
        inputTokens?: number
        outputTokens?: number
        cacheReadInputTokens?: number
        cacheCreationInputTokens?: number
        costUSD?: number
      }
    >
  }
}

type LiveReport = {
  generatedAt?: string
  mode?: string
  entryModel?: string
  entryModelMode?: string
  cases?: LiveReportCase[]
}

export type V18LiveRealTaskCaseComparison = {
  id: string
  category: string
  beforeStatus: string
  afterStatus: string
  beforeModelSet: string[]
  afterModelSet: string[]
  routeReasonBefore?: string
  routeReasonAfter?: string
  toolCallsBefore: number
  toolCallsAfter: number
  toolCallsDelta: number
  readCallsBefore: number
  readCallsAfter: number
  powerShellCallsBefore: number
  powerShellCallsAfter: number
  bashCallsBefore: number
  bashCallsAfter: number
  rawRepeatedVerificationBefore: number
  rawRepeatedVerificationAfter: number
  semanticRepeatedVerificationWasteBefore: number
  semanticRepeatedVerificationWasteAfter: number
  cacheHitRateBeforePct: number
  cacheHitRateAfterPct: number
  cacheMissTokensBefore: number
  cacheMissTokensAfter: number
  outputTokensBefore: number
  outputTokensAfter: number
  costBeforeUSD: number
  costAfterUSD: number
  costDeltaUSD: number
  warnings: string[]
}

export type V18LiveRealTaskComparisonEvidence = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_EVIDENCED' | 'BLOCKED'
  generatedAt: string
  evidencePath: string
  beforeReportPath: string
  afterReportPath: string
  policy: 'focused_live_same_case_before_after_no_22_case'
  caseIds: string[]
  before: LiveReportSummary
  after: LiveReportSummary
  deltas: {
    toolCalls: number
    rawRepeatedVerification: number
    semanticRepeatedVerificationWaste: number
    cacheHitRatePct: number
    cacheMissTokens: number
    outputTokens: number
    totalCostUSD: number
    proCaseRatioPct: number
  }
  cases: V18LiveRealTaskCaseComparison[]
  blockers: string[]
  warnings: string[]
  next: string[]
}

type LiveReportSummary = {
  cases: number
  pass: number
  fail: number
  totalToolCalls: number
  totalReadCalls: number
  totalPowerShellCalls: number
  totalBashCalls: number
  rawRepeatedVerification: number
  semanticRepeatedVerificationWaste: number
  totalCostUSD: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  modelCaseRatio: {
    flashPct: number
    proPct: number
  }
  modelsUsed: string[]
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits))
}

function readModelUsage(testCase: LiveReportCase) {
  const usage = Object.entries(testCase.metrics?.modelUsage ?? {})
  const result = usage.reduce(
    (acc, [model, metrics]) => {
      acc.models.push(model)
      acc.cacheHitInputTokens += metrics.cacheReadInputTokens ?? 0
      acc.cacheMissInputTokens += metrics.cacheCreationInputTokens ?? 0
      acc.outputTokens += metrics.outputTokens ?? 0
      acc.totalCostUSD += metrics.costUSD ?? 0
      return acc
    },
    {
      models: [] as string[],
      cacheHitInputTokens: 0,
      cacheMissInputTokens: 0,
      outputTokens: 0,
      totalCostUSD: 0,
    },
  )
  if (usage.length === 0) {
    result.totalCostUSD = testCase.metrics?.totalCostUSD ?? 0
  }
  return result
}

function cacheHitRate(hit: number, miss: number): number {
  const total = hit + miss
  return total > 0 ? round((hit / total) * 100, 1) : 0
}

function countRawRepeatedCommands(commands: readonly string[]): number {
  const keys = commands.map(command =>
    getVerificationIntentKey({ command }),
  )
  return keys.length - new Set(keys).size
}

function jsonLines(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function contentBlocks(line: unknown): unknown[] {
  if (!line || typeof line !== 'object') return []
  const content = (line as { message?: { content?: unknown } }).message?.content
  return Array.isArray(content) ? content : []
}

function isSourceMutationText(text: string): boolean {
  return /DSXU tool state:\s*(?:edit_applied|edit_already_applied|write_applied|file_written)\b/i.test(text)
}

function exitCodeFromToolResult(text: string, isError: boolean | undefined): number | null {
  if (!isError && /DSXU tool state:\s*verification_passed\b/i.test(text)) return 0
  if (!isError && /\b\d+\s+pass\b/i.test(text) && /\b0\s+fail\b/i.test(text)) return 0
  const match = text.match(/\bExit code\s+(\d+)\b/i)
  if (match) return Number(match[1])
  return isError ? 1 : null
}

export function extractSemanticVerificationEventsFromStream(
  streamJsonl: string,
): SemanticVerificationEvent[] {
  const pending = new Map<
    string,
    { tool: 'Bash' | 'PowerShell'; command: string; sourceVersion: number }
  >()
  const events: SemanticVerificationEvent[] = []
  let sourceVersion = 0
  for (const line of jsonLines(streamJsonl)) {
    for (const block of contentBlocks(line)) {
      if (!block || typeof block !== 'object') continue
      const candidate = block as {
        type?: string
        id?: string
        name?: string
        input?: { command?: string }
        tool_use_id?: string
        content?: string
        is_error?: boolean
      }
      if (
        candidate.type === 'tool_use' &&
        typeof candidate.id === 'string' &&
        (candidate.name === 'Bash' || candidate.name === 'PowerShell') &&
        typeof candidate.input?.command === 'string'
      ) {
        pending.set(candidate.id, {
          tool: candidate.name,
          command: candidate.input.command,
          sourceVersion,
        })
        continue
      }
      if (candidate.type !== 'tool_result') continue
      const text = typeof candidate.content === 'string' ? candidate.content : ''
      if (isSourceMutationText(text)) {
        sourceVersion++
      }
      const toolUseId = candidate.tool_use_id
      if (typeof toolUseId !== 'string') continue
      const run = pending.get(toolUseId)
      if (!run) continue
      events.push({
        id: toolUseId,
        tool: run.tool,
        command: run.command,
        exitCode: exitCodeFromToolResult(text, candidate.is_error),
        output: text,
        sourceChangedBeforeRun: run.sourceVersion > 0,
      })
      pending.delete(toolUseId)
    }
  }
  return events
}

function countSemanticRepeatedVerificationWaste(events: readonly SemanticVerificationEvent[]): number {
  const seen = new Map<string, { sourceChangedBeforeRun?: boolean; exitCode?: number | null }>()
  let wasted = 0
  for (const event of events) {
    const key = getVerificationIntentKey(event)
    const prior = seen.get(key)
    if (
      prior &&
      prior.exitCode !== 0 &&
      prior.sourceChangedBeforeRun === event.sourceChangedBeforeRun
    ) {
      wasted++
    }
    seen.set(key, {
      sourceChangedBeforeRun: event.sourceChangedBeforeRun,
      exitCode: event.exitCode,
    })
  }
  return wasted
}

function caseById(report: LiveReport): Map<string, LiveReportCase> {
  return new Map((report.cases ?? []).map(testCase => [testCase.id, testCase]))
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as T
}

async function readStreamIfAvailable(root: string, testCase: LiveReportCase): Promise<string> {
  if (!testCase.logPath) return ''
  try {
    return await readFile(resolve(root, testCase.logPath), 'utf8')
  } catch {
    return ''
  }
}

async function buildCaseSummary(
  root: string,
  testCase: LiveReportCase,
): Promise<{
  usage: ReturnType<typeof readModelUsage>
  modelSet: string[]
  rawRepeatedVerification: number
  semanticRepeatedVerificationWaste: number
  cacheHitRatePct: number
}> {
  const usage = readModelUsage(testCase)
  const modelSet = unique([
    ...(testCase.metrics?.modelsUsed ?? []),
    ...usage.models,
  ])
  const stream = await readStreamIfAvailable(root, testCase)
  const streamEvents = extractSemanticVerificationEventsFromStream(stream)
  const rawCommands = testCase.metrics?.actualCommands ?? streamEvents.map(event => event.command)
  return {
    usage,
    modelSet,
    rawRepeatedVerification: countRawRepeatedCommands(rawCommands),
    semanticRepeatedVerificationWaste: countSemanticRepeatedVerificationWaste(streamEvents),
    cacheHitRatePct: cacheHitRate(
      usage.cacheHitInputTokens,
      usage.cacheMissInputTokens,
    ),
  }
}

async function summarizeReport(
  root: string,
  report: LiveReport,
  caseIds: readonly string[],
): Promise<LiveReportSummary> {
  const byId = caseById(report)
  const selected = caseIds.flatMap(id => {
    const testCase = byId.get(id)
    return testCase ? [testCase] : []
  })
  const summaries = await Promise.all(
    selected.map(testCase => buildCaseSummary(root, testCase)),
  )
  const modelsUsed = unique(summaries.flatMap(summary => summary.modelSet))
  const proCases = summaries.filter(summary =>
    summary.modelSet.includes('deepseek-v4-pro'),
  ).length
  const flashCases = summaries.filter(summary =>
    summary.modelSet.includes('deepseek-v4-flash'),
  ).length
  const cacheHitInputTokens = summaries.reduce(
    (sum, summary) => sum + summary.usage.cacheHitInputTokens,
    0,
  )
  const cacheMissInputTokens = summaries.reduce(
    (sum, summary) => sum + summary.usage.cacheMissInputTokens,
    0,
  )
  return {
    cases: selected.length,
    pass: selected.filter(testCase => testCase.status === 'pass').length,
    fail: selected.filter(testCase => testCase.status !== 'pass').length,
    totalToolCalls: selected.reduce((sum, item) => sum + (item.metrics?.toolCalls ?? 0), 0),
    totalReadCalls: selected.reduce((sum, item) => sum + (item.metrics?.readCalls ?? 0), 0),
    totalPowerShellCalls: selected.reduce(
      (sum, item) => sum + (item.metrics?.powerShellCalls ?? 0),
      0,
    ),
    totalBashCalls: selected.reduce((sum, item) => sum + (item.metrics?.bashCalls ?? 0), 0),
    rawRepeatedVerification: summaries.reduce(
      (sum, summary) => sum + summary.rawRepeatedVerification,
      0,
    ),
    semanticRepeatedVerificationWaste: summaries.reduce(
      (sum, summary) => sum + summary.semanticRepeatedVerificationWaste,
      0,
    ),
    totalCostUSD: round(
      summaries.reduce((sum, summary) => sum + summary.usage.totalCostUSD, 0),
      8,
      ),
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens: summaries.reduce((sum, summary) => sum + summary.usage.outputTokens, 0),
    cacheHitRatePct: cacheHitRate(cacheHitInputTokens, cacheMissInputTokens),
    modelCaseRatio: {
      flashPct: selected.length > 0 ? round((flashCases / selected.length) * 100, 1) : 0,
      proPct: selected.length > 0 ? round((proCases / selected.length) * 100, 1) : 0,
    },
    modelsUsed,
  }
}

async function compareCase(
  root: string,
  before: LiveReportCase,
  after: LiveReportCase,
): Promise<V18LiveRealTaskCaseComparison> {
  const beforeSummary = await buildCaseSummary(root, before)
  const afterSummary = await buildCaseSummary(root, after)
  const warnings: string[] = []
  if (
    beforeSummary.modelSet.includes('deepseek-v4-pro') &&
    !afterSummary.modelSet.includes('deepseek-v4-pro')
  ) {
    warnings.push('case demoted from Pro to Flash; treat savings as route-policy evidence, not semantic-tool-only evidence')
  }
  if (afterSummary.cacheHitRatePct + 20 < beforeSummary.cacheHitRatePct) {
    warnings.push('after cache hit rate dropped materially; inspect stable prefix and route prompt volatility')
  }
  if ((after.metrics?.toolCalls ?? 0) > (before.metrics?.toolCalls ?? 0)) {
    warnings.push('after tool calls increased; semantic layer is not yet model-visible enough to guarantee savings')
  }
  if (
    (before.metrics?.actualCommands?.length ?? 0) > 1 &&
    (after.metrics?.actualCommands?.length ?? 0) === 1 &&
    /run bun test, then edit/i.test(after.prompt ?? '')
  ) {
    warnings.push('benchmark policy may not enforce requested pre-edit baseline verification')
  }

  return {
    id: before.id,
    category: before.category ?? after.category ?? 'unknown',
    beforeStatus: before.status ?? 'unknown',
    afterStatus: after.status ?? 'unknown',
    beforeModelSet: beforeSummary.modelSet,
    afterModelSet: afterSummary.modelSet,
    routeReasonBefore: before.routeExpectation?.routeReason,
    routeReasonAfter: after.routeExpectation?.routeReason,
    toolCallsBefore: before.metrics?.toolCalls ?? 0,
    toolCallsAfter: after.metrics?.toolCalls ?? 0,
    toolCallsDelta: (after.metrics?.toolCalls ?? 0) - (before.metrics?.toolCalls ?? 0),
    readCallsBefore: before.metrics?.readCalls ?? 0,
    readCallsAfter: after.metrics?.readCalls ?? 0,
    powerShellCallsBefore: before.metrics?.powerShellCalls ?? 0,
    powerShellCallsAfter: after.metrics?.powerShellCalls ?? 0,
    bashCallsBefore: before.metrics?.bashCalls ?? 0,
    bashCallsAfter: after.metrics?.bashCalls ?? 0,
    rawRepeatedVerificationBefore: beforeSummary.rawRepeatedVerification,
    rawRepeatedVerificationAfter: afterSummary.rawRepeatedVerification,
    semanticRepeatedVerificationWasteBefore: beforeSummary.semanticRepeatedVerificationWaste,
    semanticRepeatedVerificationWasteAfter: afterSummary.semanticRepeatedVerificationWaste,
    cacheHitRateBeforePct: beforeSummary.cacheHitRatePct,
    cacheHitRateAfterPct: afterSummary.cacheHitRatePct,
    cacheMissTokensBefore: beforeSummary.usage.cacheMissInputTokens,
    cacheMissTokensAfter: afterSummary.usage.cacheMissInputTokens,
    outputTokensBefore: beforeSummary.usage.outputTokens,
    outputTokensAfter: afterSummary.usage.outputTokens,
    costBeforeUSD: round(beforeSummary.usage.totalCostUSD, 8),
    costAfterUSD: round(afterSummary.usage.totalCostUSD, 8),
    costDeltaUSD: round(afterSummary.usage.totalCostUSD - beforeSummary.usage.totalCostUSD, 8),
    warnings,
  }
}

export async function buildV18LiveRealTaskComparisonEvidence(input: {
  generatedAt: string
  evidencePath: string
  beforeReportPath: string
  afterReportPath: string
  beforeReport: LiveReport
  afterReport: LiveReport
  caseIds: readonly string[]
  root?: string
}): Promise<V18LiveRealTaskComparisonEvidence> {
  const root = input.root ?? process.cwd()
  const beforeById = caseById(input.beforeReport)
  const afterById = caseById(input.afterReport)
  const caseIds = input.caseIds.filter(id => beforeById.has(id) && afterById.has(id))
  const cases = await Promise.all(
    caseIds.map(id => compareCase(root, beforeById.get(id)!, afterById.get(id)!)),
  )
  const before = await summarizeReport(root, input.beforeReport, caseIds)
  const after = await summarizeReport(root, input.afterReport, caseIds)
  const blockers: string[] = []
  const warnings = cases.flatMap(testCase =>
    testCase.warnings.map(warning => `${testCase.id}: ${warning}`),
  )
  if (caseIds.length !== input.caseIds.length) {
    blockers.push('before/after reports do not contain the same requested case ids')
  }
  if (after.fail > 0) {
    blockers.push('after live comparison has failing cases')
  }
  if (after.semanticRepeatedVerificationWaste > before.semanticRepeatedVerificationWaste) {
    blockers.push('semantic repeated verification waste increased')
  }
  if (after.modelCaseRatio.proPct === 0 && before.modelCaseRatio.proPct > 0) {
    warnings.push('after pack is Flash-only; Pro/Flash ratio improved for cost but Pro rescue ROI is not measured in this two-case run')
  }

  const status: V18LiveRealTaskComparisonEvidence['status'] =
    blockers.length > 0
      ? 'BLOCKED'
      : warnings.length > 0
        ? 'PARTIAL_EVIDENCED'
        : 'DONE_EVIDENCED'

  return {
    ok: blockers.length === 0,
    status,
    generatedAt: input.generatedAt,
    evidencePath: input.evidencePath,
    beforeReportPath: input.beforeReportPath,
    afterReportPath: input.afterReportPath,
    policy: 'focused_live_same_case_before_after_no_22_case',
    caseIds,
    before,
    after,
    deltas: {
      toolCalls: after.totalToolCalls - before.totalToolCalls,
      rawRepeatedVerification:
        after.rawRepeatedVerification - before.rawRepeatedVerification,
      semanticRepeatedVerificationWaste:
        after.semanticRepeatedVerificationWaste -
        before.semanticRepeatedVerificationWaste,
      cacheHitRatePct: round(after.cacheHitRatePct - before.cacheHitRatePct, 1),
      cacheMissTokens: after.cacheMissInputTokens - before.cacheMissInputTokens,
      outputTokens: after.outputTokens - before.outputTokens,
      totalCostUSD: round(after.totalCostUSD - before.totalCostUSD, 8),
      proCaseRatioPct: round(after.modelCaseRatio.proPct - before.modelCaseRatio.proPct, 1),
    },
    cases,
    blockers,
    warnings,
    next: [
      'expand to one larger live task where repeated verification and discovery loops are known to occur',
      'compare route trace stablePrefixHash/dynamicTailHash with live cache hit and miss tokens',
      'measure Pro ROI on a failed-verification recovery pack instead of treating Flash-only savings as Pro rescue evidence',
    ],
  }
}

export async function runV18LiveRealTaskComparisonHarness(options: {
  beforeReportPath?: string
  afterReportPath?: string
  evidencePath?: string
  caseIds?: readonly string[]
  nowIso?: string
} = {}): Promise<V18LiveRealTaskComparisonEvidence> {
  const beforeReportPath = resolve(
    options.beforeReportPath ??
      '.dsxu/runs/v18-code-10-live-flashfirst-20260507-1033/live-report.json',
  )
  const afterReportPath = resolve(
    options.afterReportPath ??
      '.dsxu/runs/v18-semantic-layer-live-compare-20260507-1305/live-report.json',
  )
  const evidencePath = resolve(
    options.evidencePath ??
      '.dsxu/trace/v18-semantic-tool/live-real-task-compare-20260507.json',
  )
  const evidence = await buildV18LiveRealTaskComparisonEvidence({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    beforeReportPath,
    afterReportPath,
    beforeReport: await readJson<LiveReport>(beforeReportPath),
    afterReport: await readJson<LiveReport>(afterReportPath),
    caseIds: options.caseIds ?? ['v8-real-feature-tests', 'v8-real-review-fix'],
  })
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}

export function collectEvidenceForCaseStream(streamJsonl: string) {
  return collectEvidenceFromVerificationEvents(
    extractSemanticVerificationEventsFromStream(streamJsonl),
  )
}
