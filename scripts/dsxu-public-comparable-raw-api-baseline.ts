#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { estimateDeepSeekV4Cost } from '../src/utils/model/deepseekV4Control'

type ManifestCase = {
  id: string
  category: string
  promptHash: string
  prompt: string
  expectedModel: string
  workflowKind?: string
  routeReason?: string
  allowedTools?: string
  budgets?: Record<string, unknown>
}

type PublicComparableManifest = {
  schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1'
  cases: readonly ManifestCase[]
}

type BaselineOptions = {
  root?: string
  manifestPath?: string
  rawRoot?: string
  reportPath?: string
  caseIds?: readonly string[]
  limit?: number
  write?: boolean
  force?: boolean
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
}

type BaselineCaseReport = {
  id: string
  status: 'PASS_RAW_API_CAPTURED' | 'SKIPPED_ALREADY_EXISTS' | 'BLOCKED_NO_API_KEY' | 'FAIL_RAW_API_ERROR'
  model: string
  promptHash: string
  caseDir: string
  rawApiResponsePath?: string
  artifactDir?: string
  promptHashPath?: string
  httpStatus?: number
  wallClockMs: number
  costUsd: number
  cacheHitRatePct: number | null
  inputTokens: number
  outputTokens: number
  error?: string
}

type BaselineReport = {
  schemaVersion: 'dsxu.public-comparable-raw-api-baseline.v1'
  generatedAt: string
  status: 'PASS' | 'PARTIAL' | 'BLOCKED'
  manifestPath: string
  rawRoot: string
  didCallProvider: boolean
  rawEvidenceComplete: false
  publicBenchmarkClaimAllowed: false
  externalComparisonClaimAllowed: false
  caseCount: number
  attemptedCaseCount: number
  capturedCaseCount: number
  skippedCaseCount: number
  failedCaseCount: number
  nextAction: string
  safeguards: readonly string[]
  cases: readonly BaselineCaseReport[]
}

const DATE = '20260518'
const REPORT_DATE = '20260520'
const DEFAULT_MODEL = 'deepseek-v4-flash'

export async function collectPublicComparableRawApiBaseline(
  options: BaselineOptions = {},
): Promise<BaselineReport> {
  const root = resolve(options.root ?? process.cwd())
  await loadDotEnv(root, options.env ?? process.env)
  const env = options.env ?? process.env
  const manifestPath = resolve(root, options.manifestPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.json`))
  const rawRoot = resolve(root, options.rawRoot ?? join('.dsxu', 'trace', 'public-comparable-raw-evidence'))
  const reportPath = resolve(root, options.reportPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_RAW_API_BASELINE_${REPORT_DATE}.json`))
  const write = options.write ?? true
  const manifest = parseManifest(await readJson(manifestPath))
  const selected = selectCases(manifest.cases, options)
  const apiKey = getApiKey(env)
  const fetchImpl = options.fetchImpl ?? fetch
  const cases: BaselineCaseReport[] = []

  for (const item of selected) {
    const caseDir = join(rawRoot, item.id)
    const rawApiResponsePath = join(caseDir, 'raw-api-response.json')
    const artifactDir = join(caseDir, 'artifacts')
    const promptHashPath = join(caseDir, 'prompt-hash.txt')
    if (!options.force && existsSync(rawApiResponsePath)) {
      cases.push({
        id: item.id,
        status: 'SKIPPED_ALREADY_EXISTS',
        model: item.expectedModel || DEFAULT_MODEL,
        promptHash: item.promptHash,
        caseDir: toEvidencePath(root, caseDir),
        rawApiResponsePath: toEvidencePath(root, rawApiResponsePath),
        artifactDir: existsSync(artifactDir) ? toEvidencePath(root, artifactDir) : undefined,
        promptHashPath: existsSync(promptHashPath) ? toEvidencePath(root, promptHashPath) : undefined,
        wallClockMs: 0,
        costUsd: 0,
        cacheHitRatePct: null,
        inputTokens: 0,
        outputTokens: 0,
      })
      continue
    }
    if (!apiKey) {
      cases.push({
        id: item.id,
        status: 'BLOCKED_NO_API_KEY',
        model: item.expectedModel || DEFAULT_MODEL,
        promptHash: item.promptHash,
        caseDir: toEvidencePath(root, caseDir),
        wallClockMs: 0,
        costUsd: 0,
        cacheHitRatePct: null,
        inputTokens: 0,
        outputTokens: 0,
        error: 'No DeepSeek API key found in DEEPSEEK_API_KEY, DSXU_API_KEY, or DSXU_DEEPSEEK_API_KEY.',
      })
      continue
    }
    const captured = await captureOneCase({
      root,
      rawRoot,
      item,
      apiKey,
      baseUrl: getBaseUrl(env),
      fetchImpl,
      write,
    })
    cases.push(captured)
  }

  const capturedCaseCount = cases.filter(item => item.status === 'PASS_RAW_API_CAPTURED').length
  const skippedCaseCount = cases.filter(item => item.status === 'SKIPPED_ALREADY_EXISTS').length
  const failedCaseCount = cases.filter(item => item.status === 'FAIL_RAW_API_ERROR' || item.status === 'BLOCKED_NO_API_KEY').length
  const didCallProvider = capturedCaseCount > 0 || cases.some(item => item.status === 'FAIL_RAW_API_ERROR')
  const status: BaselineReport['status'] = capturedCaseCount + skippedCaseCount === selected.length && selected.length > 0
    ? 'PASS'
    : capturedCaseCount + skippedCaseCount > 0
      ? 'PARTIAL'
      : 'BLOCKED'
  const report: BaselineReport = {
    schemaVersion: 'dsxu.public-comparable-raw-api-baseline.v1',
    generatedAt: new Date().toISOString(),
    status,
    manifestPath: toEvidencePath(root, manifestPath),
    rawRoot: toEvidencePath(root, rawRoot),
    didCallProvider,
    rawEvidenceComplete: false,
    publicBenchmarkClaimAllowed: false,
    externalComparisonClaimAllowed: false,
    caseCount: manifest.cases.length,
    attemptedCaseCount: selected.length,
    capturedCaseCount,
    skippedCaseCount,
    failedCaseCount,
    nextAction: 'run evidence:public-comparable-raw to import partial raw-api evidence, then collect DSXU lane transcripts/tool traces/metrics',
    safeguards: [
      'this script captures only the same-task raw DeepSeek API baseline lane',
      'it does not write metrics.json, raw DSXU transcripts, DSXU tool traces, or final DSXU pass results',
      'raw API baseline evidence alone must never unlock public benchmark or external comparison claims',
      'Authorization headers and API keys are never written to artifacts',
    ],
    cases,
  }
  if (write) await writeJson(reportPath, report)
  return report
}

async function captureOneCase(input: {
  root: string
  rawRoot: string
  item: ManifestCase
  apiKey: string
  baseUrl: string
  fetchImpl: typeof fetch
  write: boolean
}): Promise<BaselineCaseReport> {
  const { root, rawRoot, item, apiKey, baseUrl, fetchImpl, write } = input
  const caseDir = join(rawRoot, item.id)
  const artifactDir = join(caseDir, 'artifacts')
  const rawApiResponsePath = join(caseDir, 'raw-api-response.json')
  const promptHashPath = join(caseDir, 'prompt-hash.txt')
  const promptPath = join(artifactDir, 'raw-api-prompt.txt')
  const summaryPath = join(artifactDir, 'raw-api-summary.json')
  const model = item.expectedModel || DEFAULT_MODEL
  const requestBody = buildRequestBody(item)
  const startedAt = Date.now()
  const responses: Array<{ label: string; status: number; ok: boolean; bodyText: string }> = []
  let response = await postChatCompletion(fetchImpl, baseUrl, apiKey, requestBody)
  responses.push(response)
  if (!response.ok && response.status >= 400 && response.status < 500 && hasThinkingControls(requestBody)) {
    const fallbackBody = stripThinkingControls(requestBody)
    response = await postChatCompletion(fetchImpl, baseUrl, apiKey, fallbackBody)
    responses.push({ ...response, label: 'fallback-without-thinking-controls' })
  }
  const wallClockMs = Date.now() - startedAt
  const parsed = tryJson(response.bodyText)
  const usage = isRecord(parsed?.usage) ? parsed.usage : {}
  const inputTokens = numberValue(usage.prompt_tokens) ?? 0
  const outputTokens = numberValue(usage.completion_tokens) ?? 0
  const cacheHitInputTokens = numberValue(usage.prompt_cache_hit_tokens) ?? numberValue(usage.cache_hit_input_tokens) ?? 0
  const cacheMissInputTokens = numberValue(usage.prompt_cache_miss_tokens) ?? numberValue(usage.cache_miss_input_tokens) ?? Math.max(0, inputTokens - cacheHitInputTokens)
  const cacheTotal = cacheHitInputTokens + cacheMissInputTokens
  const costUsd = estimateDeepSeekV4Cost({
    model,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
  })
  const cacheHitRatePct = cacheTotal > 0 ? Number(((cacheHitInputTokens / cacheTotal) * 100).toFixed(2)) : null
  const wrapper = {
    schemaVersion: 'dsxu.public-comparable-raw-api-response.v1',
    collectedAt: new Date().toISOString(),
    caseId: item.id,
    promptHash: item.promptHash,
    endpoint: `${baseUrl}/chat/completions`,
    request: sanitizeRequestBody(requestBody),
    responseStatus: response.status,
    responseOk: response.ok,
    responseBody: parsed ?? response.bodyText,
    attempts: responses.map(attempt => ({
      label: attempt.label,
      status: attempt.status,
      ok: attempt.ok,
      body: tryJson(attempt.bodyText) ?? attempt.bodyText,
    })),
    usage: {
      inputTokens,
      outputTokens,
      cacheHitInputTokens,
      cacheMissInputTokens,
      costUsd,
      cacheHitRatePct,
      wallClockMs,
    },
  }
  if (write) {
    await mkdir(artifactDir, { recursive: true })
    await Promise.all([
      writeJson(rawApiResponsePath, wrapper),
      writeFile(promptHashPath, `${item.promptHash}\n`, 'utf8'),
      writeFile(promptPath, String(requestBody.messages.at(-1)?.content ?? ''), 'utf8'),
      writeJson(summaryPath, {
        schemaVersion: 'dsxu.public-comparable-raw-api-summary.v1',
        caseId: item.id,
        status: response.ok ? 'PASS_RAW_API_CAPTURED' : 'FAIL_RAW_API_ERROR',
        model,
        promptHash: item.promptHash,
        httpStatus: response.status,
        wallClockMs,
        costUsd,
        cacheHitRatePct,
        inputTokens,
        outputTokens,
        note: 'Raw API baseline only; this is not DSXU task completion evidence.',
      }),
    ])
  }
  return {
    id: item.id,
    status: response.ok ? 'PASS_RAW_API_CAPTURED' : 'FAIL_RAW_API_ERROR',
    model,
    promptHash: item.promptHash,
    caseDir: toEvidencePath(root, caseDir),
    rawApiResponsePath: toEvidencePath(root, rawApiResponsePath),
    artifactDir: toEvidencePath(root, artifactDir),
    promptHashPath: toEvidencePath(root, promptHashPath),
    httpStatus: response.status,
    wallClockMs,
    costUsd,
    cacheHitRatePct,
    inputTokens,
    outputTokens,
    error: response.ok ? undefined : summarizeError(response.bodyText),
  }
}

function buildRequestBody(item: ManifestCase): {
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  stream: false
  max_tokens: number
  temperature?: number
  thinking?: { type: 'enabled' | 'disabled' }
  reasoning_effort?: 'high' | 'max'
} {
  const routeReason = item.routeReason ?? ''
  const thinking = routeReason.includes('thinking') || item.expectedModel.includes('pro')
  const effort = routeReason.includes('max') ? 'max' : 'high'
  return {
    model: item.expectedModel || DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: [
          'You are the raw DeepSeek API baseline for DSXU public-comparable evidence.',
          'You cannot call tools, read files, edit files, run commands, or verify code.',
          'Return JSON only. Be honest about limitations and do not claim task completion.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `caseId: ${item.id}`,
          `category: ${item.category}`,
          `workflowKind: ${item.workflowKind ?? 'unknown'}`,
          `routeReason: ${item.routeReason ?? 'unknown'}`,
          `allowedToolsInDSXULane: ${item.allowedTools ?? 'default-mainline-tool-gate'}`,
          `budgets: ${JSON.stringify(item.budgets ?? {})}`,
          '',
          'Task prompt:',
          item.prompt,
          '',
          'Return compact JSON with keys:',
          '{"caseId":string,"understoodTask":string,"rawApiCanComplete":false,"likelyPlan":[string],"wouldNeedTools":[string],"risks":[string],"limitations":[string],"confidence_0_100":number}',
        ].join('\n'),
      },
    ],
    stream: false,
    max_tokens: 1200,
    ...(thinking
      ? { thinking: { type: 'enabled' as const }, reasoning_effort: effort as 'high' | 'max' }
      : { thinking: { type: 'disabled' as const }, temperature: 0 }),
  }
}

async function postChatCompletion(
  fetchImpl: typeof fetch,
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ label: string; status: number; ok: boolean; bodyText: string }> {
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  return {
    label: 'primary',
    status: response.status,
    ok: response.ok,
    bodyText: await response.text(),
  }
}

function hasThinkingControls(body: Record<string, unknown>): boolean {
  return 'thinking' in body || 'reasoning_effort' in body
}

function stripThinkingControls<T extends Record<string, unknown>>(body: T): T {
  const next = { ...body }
  delete next.thinking
  delete next.reasoning_effort
  next.temperature = 0
  return next
}

function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(body)) as Record<string, unknown>
}

function selectCases(cases: readonly ManifestCase[], options: BaselineOptions): readonly ManifestCase[] {
  const caseIds = new Set(options.caseIds ?? [])
  const filtered = caseIds.size > 0 ? cases.filter(item => caseIds.has(item.id)) : cases
  return typeof options.limit === 'number' && options.limit >= 0 ? filtered.slice(0, options.limit) : filtered
}

async function loadDotEnv(root: string, env: Record<string, string | undefined>): Promise<void> {
  const path = join(root, '.env')
  if (!existsSync(path)) return
  const content = await readFile(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    if (env[key] !== undefined) continue
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
}

function getApiKey(env: Record<string, string | undefined>): string | null {
  return env.DEEPSEEK_API_KEY?.trim() ||
    env.DSXU_API_KEY?.trim() ||
    env.DSXU_DEEPSEEK_API_KEY?.trim() ||
    null
}

function getBaseUrl(env: Record<string, string | undefined>): string {
  return (env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '')
}

function parseManifest(input: unknown): PublicComparableManifest {
  if (!isRecord(input)) throw new Error('public comparable manifest is not an object')
  if (input.schemaVersion !== 'dsxu.public-comparable-benchmark-manifest.v1') {
    throw new Error('public comparable manifest schemaVersion mismatch')
  }
  if (!Array.isArray(input.cases)) throw new Error('public comparable manifest cases must be an array')
  return input as PublicComparableManifest
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function tryJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function summarizeError(text: string): string {
  const parsed = tryJson(text)
  if (typeof parsed?.message === 'string') return parsed.message.slice(0, 300)
  if (isRecord(parsed?.error) && typeof parsed.error.message === 'string') return parsed.error.message.slice(0, 300)
  return text.slice(0, 300)
}

function toEvidencePath(root: string, path: string): string {
  const rel = relative(root, path).replace(/\\/g, '/')
  return rel.length > 0 && !rel.startsWith('..') ? rel : path.replace(/\\/g, '/')
}

function parseArgs(argv: readonly string[]): BaselineOptions {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  const cases: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [key, inlineValue] = arg.slice(2).split('=', 2)
    if (key === 'case' || key === 'case-id') {
      const value = inlineValue ?? argv[index + 1]
      if (value && !value.startsWith('--')) {
        cases.push(...value.split(',').map(item => item.trim()).filter(Boolean))
        if (inlineValue === undefined) index += 1
      }
      continue
    }
    if (inlineValue !== undefined) {
      values.set(key, inlineValue)
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      values.set(key, argv[index + 1])
      index += 1
    } else {
      flags.add(key)
    }
  }
  const limitText = values.get('limit')
  return {
    manifestPath: values.get('manifest'),
    rawRoot: values.get('raw-root'),
    reportPath: values.get('report'),
    caseIds: cases,
    limit: limitText === undefined ? undefined : Number(limitText),
    write: !flags.has('dry-run'),
    force: flags.has('force'),
  }
}

async function main(): Promise<void> {
  const report = await collectPublicComparableRawApiBaseline(parseArgs(process.argv.slice(2)))
  console.log(JSON.stringify({
    status: report.status,
    attemptedCaseCount: report.attemptedCaseCount,
    capturedCaseCount: report.capturedCaseCount,
    skippedCaseCount: report.skippedCaseCount,
    failedCaseCount: report.failedCaseCount,
    didCallProvider: report.didCallProvider,
    publicBenchmarkClaimAllowed: report.publicBenchmarkClaimAllowed,
    externalComparisonClaimAllowed: report.externalComparisonClaimAllowed,
    nextAction: report.nextAction,
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
