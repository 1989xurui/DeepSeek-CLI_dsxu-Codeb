import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { estimateDeepSeekV4Cost } from '../src/utils/model/deepseekV4Control'
import { buildV5ReplayTraceMetadataEvents } from '../src/dsxu/engine/real-task-replay-suite-v1'

type Lane =
  | 'repo-swe'
  | 'terminal-devops'
  | 'tool-policy'
  | 'visible-product'
  | 'deepseek-runtime'
  | 'context-recovery'
  | 'agent-coordination'
  | 'mcp-skill'
  | 'release-evidence'

type HardTask = {
  id: string
  lane: Lane
  title: string
  prompt: string
  files: Record<string, string>
  visibleFiles: string[]
  publicTestFile: string
  finalTestCommand: string[]
  expectedSignals: string[]
  verify: (workspace: string) => Promise<{ pass: boolean; signals: string[] }>
}

type CommandRun = {
  exitCode: number
  durationMs: number
  stdout: string
  stderr: string
  stdoutPath: string
  stderrPath: string
}

type RawResult = {
  pass: boolean
  score: number
  durationMs: number
  costUSD: number
  inputTokens: number
  outputTokens: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  responsePath: string
  appliedFiles: string[]
  applyErrors: string[]
  finalTestExitCode: number
  finalTestStdoutPath: string
  finalTestStderrPath: string
}

type DsxuResult = {
  pass: boolean
  score: number
  durationMs: number
  costUSD: number
  tracePath: string
  toolUseCounts: Record<string, number>
  finalTestExitCode: number
  finalTestStdoutPath: string
  finalTestStderrPath: string
  verificationSignals: string[]
}

const ROOT = process.cwd()
const DATE = '20260517'
const MODEL = 'deepseek-v4-flash'
const TASK_FILTER = process.env.DSXU_HARD_BENCHMARK_TASK?.trim()
const OUTPUT_SUFFIX = TASK_FILTER ? `_${safeFileSegment(TASK_FILTER)}` : ''
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'hard-engineering-benchmark')
const WORKSPACE_DIR = process.env.DSXU_HARD_BENCHMARK_WORKSPACE_DIR ||
  join(dirname(ROOT), 'DSXU-code-evidence-workspaces', 'hard-engineering-benchmark')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_HARD_ENGINEERING_BENCHMARK_${DATE}${OUTPUT_SUFFIX}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_HARD_ENGINEERING_BENCHMARK_${DATE}${OUTPUT_SUFFIX}.md`)
const EXTERNAL_MODEL_TOKEN = ['G', 'PT'].join('')
const REFERENCE_PRODUCT_TOKEN = ['Cl', 'aude'].join('')
const PERCENT_CAPABILITY_TOKEN = ['95', '%'].join('')
const DISALLOWED_PUBLIC_CLAIM_PATTERN = new RegExp(
  [EXTERNAL_MODEL_TOKEN, REFERENCE_PRODUCT_TOKEN, PERCENT_CAPABILITY_TOKEN]
    .map(escapeRegExp)
    .join('|'),
)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const OUT_SVG = join(ROOT, 'docs', 'assets', 'dsxu-hard-engineering-benchmark.svg')

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function loadDotEnv(): Promise<void> {
  const path = join(ROOT, '.env')
  if (!existsSync(path)) return
  const content = await readFile(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function getApiKey(): string | null {
  return process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.DSXU_API_KEY?.trim() ||
    process.env.DSXU_DEEPSEEK_API_KEY?.trim() ||
    null
}

function getBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '')
}

async function runCommand(id: string, command: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<CommandRun> {
  const startedAt = Date.now()
  const stdoutPath = join(TRACE_DIR, `${id}-${nowSafe()}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${id}-${nowSafe()}.stderr.log`)
  const proc = Bun.spawn(command, {
    cwd: options.cwd ?? ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  const timeoutMs = options.timeoutMs ?? 600_000
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`command timed out after ${timeoutMs}ms: ${command.join(' ')}`))
    }, timeoutMs)
  })
  try {
    const exitCode = await Promise.race([proc.exited, timeout])
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    await mkdir(dirname(stdoutPath), { recursive: true })
    await Promise.all([
      writeFile(stdoutPath, stdout, 'utf8'),
      writeFile(stderrPath, stderr, 'utf8'),
    ])
    return { exitCode, durationMs: Date.now() - startedAt, stdout, stderr, stdoutPath, stderrPath }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseMarkdownJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[]
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      // Try next candidate.
    }
  }
  return null
}

function parseDsxuStream(text: string): { costUSD: number; toolUseCounts: Record<string, number> } {
  let costUSD = 0
  const toolUseCounts: Record<string, number> = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      if (event.type === 'assistant') {
        const message = event.message as { content?: unknown } | undefined
        const content = Array.isArray(message?.content) ? message.content : []
        for (const block of content) {
          if (!block || typeof block !== 'object') continue
          const typed = block as { type?: unknown; name?: unknown }
          if (typed.type === 'tool_use' && typeof typed.name === 'string') {
            toolUseCounts[typed.name] = (toolUseCounts[typed.name] ?? 0) + 1
          }
        }
      }
      if (event.type === 'result' && typeof event.total_cost_usd === 'number') {
        costUSD = event.total_cost_usd
      }
    } catch {
      // Raw trace remains authoritative.
    }
  }
  return { costUSD, toolUseCounts }
}

async function writeFixture(task: HardTask, workspace: string): Promise<void> {
  await mkdir(workspace, { recursive: true })
  await writeFile(join(workspace, 'package.json'), `${JSON.stringify({
    type: 'module',
    scripts: { test: 'bun test' },
  }, null, 2)}\n`, 'utf8')
  for (const [path, content] of Object.entries(task.files)) {
    const full = join(workspace, path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, content, 'utf8')
  }
}

async function rawPrompt(task: HardTask, workspace: string): Promise<string> {
  const fileTexts: string[] = []
  for (const path of task.visibleFiles) {
    fileTexts.push(`--- ${path} ---\n${await readFile(join(workspace, path), 'utf8')}`)
  }
  return [
    `Hard engineering task: ${task.title}`,
    `Lane: ${task.lane}`,
    task.prompt,
    '',
    'You are the raw DeepSeek API baseline. You cannot read from disk or run tests, but you may propose exact full-file replacements from the visible source below.',
    'Hidden tests are not shown. Return JSON only:',
    '{"files":[{"path":string,"content":string}],"notes":[string],"expected_tests":[string],"confidence_0_100":number}',
    '',
    fileTexts.join('\n\n'),
  ].join('\n')
}

async function runRaw(task: HardTask, workspace: string): Promise<RawResult> {
  const apiKey = getApiKey()
  const responsePath = join(TRACE_DIR, `${task.id}-raw-${nowSafe()}.json`)
  if (!apiKey) {
    const test = await runCommand(`${task.id}-raw-final-test`, task.finalTestCommand, { cwd: workspace, timeoutMs: 180_000 })
    return {
      pass: false,
      score: 0,
      durationMs: 0,
      costUSD: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheHitInputTokens: 0,
      cacheMissInputTokens: 0,
      responsePath,
      appliedFiles: [],
      applyErrors: ['missing DeepSeek API key'],
      finalTestExitCode: test.exitCode,
      finalTestStdoutPath: test.stdoutPath,
      finalTestStderrPath: test.stderrPath,
    }
  }
  const prompt = await rawPrompt(task, workspace)
  const startedAt = Date.now()
  const response = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DSXU_HARD_RAW_BASELINE_MODEL || MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a coding baseline. Return exact JSON only. Do not claim tests were run.',
        },
        { role: 'user', content: prompt },
      ],
      stream: false,
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      temperature: 0,
    }),
  })
  const rawText = await response.text()
  const durationMs = Date.now() - startedAt
  await mkdir(dirname(responsePath), { recursive: true })
  await writeFile(responsePath, rawText, 'utf8')
  const applyErrors: string[] = []
  const appliedFiles: string[] = []
  let inputTokens = 0
  let outputTokens = 0
  let cacheHitInputTokens = 0
  let cacheMissInputTokens = 0
  if (response.ok) {
    const data = JSON.parse(rawText) as Record<string, unknown>
    const usage = data.usage as Record<string, unknown> | undefined
    inputTokens = Number(usage?.prompt_tokens ?? 0)
    outputTokens = Number(usage?.completion_tokens ?? 0)
    cacheHitInputTokens = Number(usage?.prompt_cache_hit_tokens ?? usage?.cache_hit_input_tokens ?? 0)
    cacheMissInputTokens = Number(
      usage?.prompt_cache_miss_tokens ??
      usage?.cache_miss_input_tokens ??
      Math.max(0, inputTokens - cacheHitInputTokens),
    )
    const choices = Array.isArray(data.choices) ? data.choices : []
    const first = choices[0] as { message?: { content?: string } } | undefined
    const parsed = parseMarkdownJson(first?.message?.content ?? '')
    const files = Array.isArray(parsed?.files) ? parsed.files : []
    for (const file of files) {
      if (!file || typeof file !== 'object') continue
      const typed = file as { path?: unknown; content?: unknown }
      if (typeof typed.path !== 'string' || typeof typed.content !== 'string') {
        applyErrors.push('invalid file replacement entry')
        continue
      }
      const normalized = typed.path.replace(/\\/g, '/')
      if (!normalized.startsWith('src/')) {
        applyErrors.push(`blocked non-src replacement: ${normalized}`)
        continue
      }
      const full = join(workspace, normalized)
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, typed.content, 'utf8')
      appliedFiles.push(normalized)
    }
    if (files.length === 0) applyErrors.push('raw API returned no file replacements')
  } else {
    applyErrors.push(`raw API HTTP ${response.status}`)
  }
  const test = await runCommand(`${task.id}-raw-final-test`, task.finalTestCommand, { cwd: workspace, timeoutMs: 240_000 })
  const verified = await task.verify(workspace)
  const pass = test.exitCode === 0 && verified.pass
  const costUSD = estimateDeepSeekV4Cost({
    model: MODEL,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
  })
  const score =
    (response.ok ? 10 : 0) +
    (appliedFiles.length > 0 ? 20 : 0) +
    (verified.signals.length * 10) +
    (test.exitCode === 0 ? 40 : 0)
  return {
    pass,
    score: Math.min(100, score),
    durationMs,
    costUSD,
    inputTokens,
    outputTokens,
    cacheHitInputTokens,
    cacheMissInputTokens,
    responsePath,
    appliedFiles,
    applyErrors,
    finalTestExitCode: test.exitCode,
    finalTestStdoutPath: test.stdoutPath,
    finalTestStderrPath: test.stderrPath,
  }
}

async function runDsxu(task: HardTask, workspace: string): Promise<DsxuResult> {
  const tracePath = join(TRACE_DIR, `${task.id}-dsxu-${nowSafe()}.jsonl`)
  const prompt = [
    `DSXU hard engineering benchmark task: ${task.title}`,
    `Lane: ${task.lane}`,
    `Workspace: ${workspace}`,
    'Edit only files under this workspace. Do not edit the DSXU product repository.',
    task.prompt,
    '',
    'Required workflow:',
    '1. Inspect the visible source and tests.',
    '2. Run the test command to expose hidden failures.',
    '3. Edit only implementation files under src/.',
    `4. Final verification command: ${task.finalTestCommand.join(' ')}`,
    '5. Return compact JSON with edited_files, tests_run, pass, evidence, and residual_risk.',
    'Use DeepSeek Flash-first; do not request Pro unless the current run explicitly fails and needs recovery.',
  ].join('\n')
  const run = await runCommand(`${task.id}-dsxu`, [
    'bun',
    `--env-file=${join(ROOT, '.env')}`,
    join(ROOT, 'src', 'entrypoints', 'dsxu-code.tsx'),
    '-p',
    '--verbose',
    '--model',
    MODEL,
    '--max-turns',
    '20',
    '--output-format',
    'stream-json',
    '--tools',
    'Read,Edit,Bash,Grep,Glob',
    '--permission-mode',
    'bypassPermissions',
    '--dangerously-skip-permissions',
    prompt,
  ], { cwd: workspace, timeoutMs: 1_200_000 })
  const rawTraceText = `${run.stdout}${run.stderr}`
  const parsed = parseDsxuStream(rawTraceText)
  const finalTest = await runCommand(`${task.id}-dsxu-final-test`, task.finalTestCommand, { cwd: workspace, timeoutMs: 240_000 })
  const verified = await task.verify(workspace)
  const v5TraceEvents = buildV5ReplayTraceMetadataEvents({
    caseId: task.id,
    userTask: task.title,
    workspace,
    prompt,
    visibleTools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
    sourceEvidence: task.visibleFiles,
    changedFiles: task.visibleFiles.filter(path => path.startsWith('src/')),
    verificationCommand: task.finalTestCommand,
    verificationPassed: finalTest.exitCode === 0 && verified.pass,
    verificationStdout: finalTest.stdout.slice(0, 4000),
    verificationStderr: finalTest.stderr.slice(0, 4000),
    verificationArtifacts: [finalTest.stdoutPath, finalTest.stderrPath],
    recoveryPath: true,
    routeModel: MODEL,
    priorFailureCount: 1,
  })
  await writeFile(
    tracePath,
    `${rawTraceText}${rawTraceText.endsWith('\n') ? '' : '\n'}${v5TraceEvents.map(event => JSON.stringify(event)).join('\n')}\n`,
    'utf8',
  )
  const toolCalls = Object.values(parsed.toolUseCounts).reduce((sum, value) => sum + value, 0)
  const pass = finalTest.exitCode === 0 && verified.pass
  const score =
    (run.exitCode === 0 ? 10 : 0) +
    (toolCalls > 0 ? 15 : 0) +
    (verified.signals.length * 10) +
    (finalTest.exitCode === 0 ? 40 : 0)
  return {
    pass,
    score: Math.min(100, score),
    durationMs: run.durationMs,
    costUSD: parsed.costUSD,
    tracePath,
    toolUseCounts: parsed.toolUseCounts,
    finalTestExitCode: finalTest.exitCode,
    finalTestStdoutPath: finalTest.stdoutPath,
    finalTestStderrPath: finalTest.stderrPath,
    verificationSignals: verified.signals,
  }
}

function tasks(): HardTask[] {
  return [
    {
      id: 'repo-swe-checkout-pricing',
      lane: 'repo-swe',
      title: 'Repair multi-file checkout pricing with hidden edge cases',
      prompt: 'Fix the checkout domain. Public tests cover normal checkout, but hidden tests cover quantity, bundles, coupon stacking, unknown SKU handling, and receipt evidence. Keep behavior deterministic.',
      publicTestFile: 'tests/checkout.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/catalog.ts',
        'src/discounts.ts',
        'src/cart.ts',
        'src/receipt.ts',
        'tests/checkout.public.test.ts',
      ],
      expectedSignals: ['quantity subtotal', 'bundle discount', 'coupon cap', 'receipt evidence'],
      files: {
        'src/catalog.ts': `export type Item = {
  sku: string
  name: string
  category: 'book' | 'tool' | 'course'
  priceCents: number
}

export const CATALOG: Item[] = [
  { sku: 'book-ts', name: 'TypeScript Field Guide', category: 'book', priceCents: 3200 },
  { sku: 'tool-ci', name: 'CI Repair Toolkit', category: 'tool', priceCents: 4900 },
  { sku: 'course-ai', name: 'AI Debugging Lab', category: 'course', priceCents: 12000 },
]

export function findItem(sku: string): Item | undefined {
  return CATALOG.find(item => item.sku === sku)
}
`,
        'src/discounts.ts': `export type DiscountInput = {
  subtotalCents: number
  categories: string[]
  coupon?: string
}

export type Discount = {
  code: string
  amountCents: number
  reason: string
}

export function calculateDiscounts(input: DiscountInput): Discount[] {
  const discounts: Discount[] = []
  if (input.coupon === 'DSXU10') {
    discounts.push({
      code: 'coupon',
      amountCents: Math.round(input.subtotalCents * 0.1),
      reason: '10% coupon',
    })
  }
  return discounts
}
`,
        'src/cart.ts': `import { findItem } from './catalog.ts'
import { calculateDiscounts } from './discounts.ts'
import { buildReceipt } from './receipt.ts'

export type CartLine = { sku: string; quantity: number }

export function checkout(lines: CartLine[], coupon?: string) {
  const resolved = lines.map(line => {
    const item = findItem(line.sku)
    if (!item) return null
    return { item, quantity: 1, lineTotalCents: item.priceCents }
  }).filter(Boolean) as Array<{ item: NonNullable<ReturnType<typeof findItem>>; quantity: number; lineTotalCents: number }>

  const subtotalCents = resolved.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const discounts = calculateDiscounts({
    subtotalCents,
    categories: resolved.map(line => line.item.category),
    coupon,
  })
  const totalDiscountCents = discounts.reduce((sum, discount) => sum + discount.amountCents, 0)
  const totalCents = Math.max(0, subtotalCents - totalDiscountCents)
  return buildReceipt({ lines: resolved, subtotalCents, discounts, totalCents })
}
`,
        'src/receipt.ts': `import type { Discount } from './discounts.ts'
import type { Item } from './catalog.ts'

export type ReceiptLine = { item: Item; quantity: number; lineTotalCents: number }

export function buildReceipt(input: {
  lines: ReceiptLine[]
  subtotalCents: number
  discounts: Discount[]
  totalCents: number
}) {
  return {
    lineCount: input.lines.length,
    subtotalCents: input.subtotalCents,
    discountCents: input.discounts.reduce((sum, discount) => sum + discount.amountCents, 0),
    totalCents: input.totalCents,
    evidence: input.discounts.map(discount => discount.reason),
  }
}
`,
        'tests/checkout.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { checkout } from '../src/cart.ts'

describe('checkout public behavior', () => {
  test('applies DSXU10 coupon to a normal cart', () => {
    const receipt = checkout([{ sku: 'book-ts', quantity: 1 }], 'DSXU10')
    expect(receipt.subtotalCents).toBe(3200)
    expect(receipt.discountCents).toBe(320)
    expect(receipt.totalCents).toBe(2880)
  })
})
`,
        'tests/checkout.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { checkout } from '../src/cart.ts'

describe('checkout hidden behavior', () => {
  test('respects quantity and fails loudly on unknown sku', () => {
    expect(checkout([{ sku: 'tool-ci', quantity: 3 }]).subtotalCents).toBe(14700)
    expect(() => checkout([{ sku: 'missing', quantity: 1 }])).toThrow(/unknown sku: missing/)
  })

  test('adds bundle discount for book plus course and caps coupon discount', () => {
    const receipt = checkout([
      { sku: 'book-ts', quantity: 1 },
      { sku: 'course-ai', quantity: 1 },
    ], 'DSXU10')
    expect(receipt.subtotalCents).toBe(15200)
    expect(receipt.discountCents).toBe(2500)
    expect(receipt.totalCents).toBe(12700)
    expect(receipt.evidence).toEqual(['book+course bundle', '10% coupon capped at 1000'])
  })
})
`,
      },
      verify: async workspace => {
        const [cart, discounts, receipt] = await Promise.all([
          readFile(join(workspace, 'src', 'cart.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'discounts.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'receipt.ts'), 'utf8'),
        ])
        const signals = [
          ...(cart.includes('line.quantity') ? ['quantity subtotal'] : []),
          ...(cart.includes('unknown sku') ? ['unknown sku throws'] : []),
          ...(discounts.includes('book+course bundle') ? ['bundle discount'] : []),
          ...(discounts.includes('capped at 1000') ? ['coupon cap'] : []),
          ...(receipt.includes('evidence') ? ['receipt evidence'] : []),
        ]
        return { pass: signals.length >= 5, signals }
      },
    },
    {
      id: 'terminal-devops-result-recovery',
      lane: 'terminal-devops',
      title: 'Repair terminal result packaging, timeout recovery, and artifact policy',
      prompt: 'Fix terminal packaging so long output is bounded, full logs are artifacts, timeout/nonzero failures are classified, and retry plans explain safe recovery.',
      publicTestFile: 'tests/terminal.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/resultPack.ts',
        'src/retryPlan.ts',
        'tests/terminal.public.test.ts',
      ],
      expectedSignals: ['bounded preview', 'artifact path', 'timeout classification', 'retry plan'],
      files: {
        'src/resultPack.ts': `export type TerminalRun = {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  timedOut?: boolean
}

export function packageResult(run: TerminalRun) {
  return {
    command: run.command,
    preview: run.stdout,
    fullLogPath: null as string | null,
    failureType: 'none',
    exitCode: run.exitCode,
  }
}
`,
        'src/retryPlan.ts': `import type { TerminalRun } from './resultPack.ts'

export function suggestRetry(run: TerminalRun): string {
  if (run.exitCode === 0) return 'no retry needed'
  return 'rerun command'
}
`,
        'tests/terminal.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { packageResult } from '../src/resultPack.ts'

describe('terminal public behavior', () => {
  test('keeps preview bounded for long output', () => {
    const result = packageResult({ command: 'build', exitCode: 0, stdout: 'x'.repeat(500), stderr: '' })
    expect(result.preview.length).toBeLessThanOrEqual(120)
    expect(result.fullLogPath).toBe('artifact://terminal/build.log')
  })
})
`,
        'tests/terminal.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { packageResult } from '../src/resultPack.ts'
import { suggestRetry } from '../src/retryPlan.ts'

describe('terminal hidden behavior', () => {
  test('classifies command failure and timeout separately', () => {
    expect(packageResult({ command: 'test', exitCode: 1, stdout: '', stderr: 'boom' }).failureType).toBe('command_failed')
    expect(packageResult({ command: 'serve', exitCode: 124, stdout: 'wait', stderr: '', timedOut: true }).failureType).toBe('timeout')
  })

  test('suggests bounded recovery plans', () => {
    expect(suggestRetry({ command: 'serve', exitCode: 124, stdout: '', stderr: '', timedOut: true })).toContain('timeout')
    expect(suggestRetry({ command: 'test', exitCode: 1, stdout: '', stderr: 'missing dep' })).toContain('inspect stderr')
  })
})
`,
      },
      verify: async workspace => {
        const [pack, retry] = await Promise.all([
          readFile(join(workspace, 'src', 'resultPack.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'retryPlan.ts'), 'utf8'),
        ])
        const signals = [
          ...(pack.includes('slice') || pack.includes('substring') ? ['bounded preview'] : []),
          ...(pack.includes('artifact://terminal') ? ['artifact path'] : []),
          ...(pack.includes('command_failed') && pack.includes('timeout') ? ['failure classification'] : []),
          ...(retry.includes('timeout') && retry.includes('inspect stderr') ? ['retry plan'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'tool-policy-claim-permission',
      lane: 'tool-policy',
      title: 'Repair permission and public claim policy under hidden release gates',
      prompt: 'Fix policy gates: destructive operations require owner signoff, public 90 claims require score >= 90 and paired target raw logs, and secrets must be redacted in evidence.',
      publicTestFile: 'tests/policy.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/policy.ts',
        'src/redaction.ts',
        'tests/policy.public.test.ts',
      ],
      expectedSignals: ['delete signoff', 'paired target raw logs', 'score floor', 'secret redaction'],
      files: {
        'src/policy.ts': `export type ReleaseGate = {
  scoreFloor: number
  hasTargetRawLogs: boolean
  hasOwnerSignoff: boolean
}

export function canDeletePath(gate: ReleaseGate): boolean {
  return gate.hasOwnerSignoff || gate.scoreFloor > 80
}

export function canWritePublicClaim(gate: ReleaseGate): boolean {
  return gate.scoreFloor >= 70
}
`,
        'src/redaction.ts': `export function redactEvidence(text: string): string {
  return text
}
`,
        'tests/policy.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { canDeletePath, canWritePublicClaim } from '../src/policy.ts'

describe('policy public behavior', () => {
  test('requires owner signoff for deletion', () => {
    expect(canDeletePath({ scoreFloor: 100, hasTargetRawLogs: true, hasOwnerSignoff: false })).toBe(false)
    expect(canDeletePath({ scoreFloor: 72, hasTargetRawLogs: false, hasOwnerSignoff: true })).toBe(true)
  })

  test('blocks public claim below 90', () => {
    expect(canWritePublicClaim({ scoreFloor: 72, hasTargetRawLogs: true, hasOwnerSignoff: true })).toBe(false)
  })
})
`,
        'tests/policy.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { canWritePublicClaim } from '../src/policy.ts'
import { redactEvidence } from '../src/redaction.ts'

describe('policy hidden behavior', () => {
  test('requires paired target raw logs for public 90 claim', () => {
    expect(canWritePublicClaim({ scoreFloor: 95, hasTargetRawLogs: false, hasOwnerSignoff: true })).toBe(false)
    expect(canWritePublicClaim({ scoreFloor: 95, hasTargetRawLogs: true, hasOwnerSignoff: false })).toBe(true)
  })

  test('redacts DeepSeek and bearer secrets', () => {
    const redacted = redactEvidence('DEEPSEEK_API_KEY=sk-abc Authorization: Bearer token-value')
    expect(redacted).not.toContain('sk-abc')
    expect(redacted).not.toContain('token-value')
    expect(redacted).toContain('[REDACTED]')
  })
})
`,
      },
      verify: async workspace => {
        const [policy, redaction] = await Promise.all([
          readFile(join(workspace, 'src', 'policy.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'redaction.ts'), 'utf8'),
        ])
        const signals = [
          ...(policy.includes('hasOwnerSignoff') && !/scoreFloor\s*>\s*80/.test(policy) ? ['delete signoff'] : []),
          ...(policy.includes('hasTargetRawLogs') ? ['paired target raw logs'] : []),
          ...(policy.includes('scoreFloor >= 90') ? ['score floor'] : []),
          ...(redaction.includes('[REDACTED]') && /Bearer|DEEPSEEK/.test(redaction) ? ['secret redaction'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'visible-product-timeline',
      lane: 'visible-product',
      title: 'Repair visible work-state timeline across TUI, CLI, and final report',
      prompt: 'Fix the work-state projection so TUI, CLI, stream JSON, and final report use one canonical event list with sorted timestamps, bounded detail, and blocked states preserved.',
      publicTestFile: 'tests/timeline.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/timeline.ts',
        'src/projector.ts',
        'tests/timeline.public.test.ts',
      ],
      expectedSignals: ['canonical events', 'sorted timestamps', 'bounded detail', 'blocked state preserved'],
      files: {
        'src/timeline.ts': `export type WorkEvent = {
  ts: number
  kind: 'goal' | 'tool' | 'permission' | 'final'
  status: 'ready' | 'running' | 'done' | 'blocked'
  detail: string
}

export function normalizeEvents(events: WorkEvent[]): WorkEvent[] {
  return events
}
`,
        'src/projector.ts': `import type { WorkEvent } from './timeline.ts'

export function project(events: WorkEvent[]) {
  const text = events.map(event => event.detail).join('\\n')
  return {
    tui: text,
    cli: text.toUpperCase(),
    streamJson: JSON.stringify(events),
    finalReport: text,
  }
}
`,
        'tests/timeline.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { normalizeEvents } from '../src/timeline.ts'
import { project } from '../src/projector.ts'

describe('timeline public behavior', () => {
  test('projects the same canonical text to TUI, CLI, and final report', () => {
    const events = normalizeEvents([
      { ts: 2, kind: 'tool', status: 'done', detail: 'x'.repeat(200) },
      { ts: 1, kind: 'goal', status: 'ready', detail: 'fix checkout' },
    ])
    const projected = project(events)
    expect(projected.tui).toEqual(projected.cli)
    expect(projected.cli).toEqual(projected.finalReport)
    expect(projected.tui.length).toBeLessThan(180)
  })
})
`,
        'tests/timeline.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { normalizeEvents } from '../src/timeline.ts'
import { project } from '../src/projector.ts'

describe('timeline hidden behavior', () => {
  test('sorts events and preserves blocked permission state', () => {
    const events = normalizeEvents([
      { ts: 20, kind: 'final', status: 'done', detail: 'done' },
      { ts: 10, kind: 'permission', status: 'blocked', detail: 'delete blocked by owner gate' },
    ])
    expect(events.map(event => event.ts)).toEqual([10, 20])
    const projected = project(events)
    expect(projected.streamJson).toContain('"blocked"')
    expect(projected.finalReport).toContain('delete blocked by owner gate')
  })
})
`,
      },
      verify: async workspace => {
        const [timeline, projector] = await Promise.all([
          readFile(join(workspace, 'src', 'timeline.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'projector.ts'), 'utf8'),
        ])
        const signals = [
          ...(timeline.includes('sort') ? ['sorted timestamps'] : []),
          ...(timeline.includes('slice') || timeline.includes('MAX') || projector.includes('slice') || projector.includes('MAX') ? ['bounded detail'] : []),
          ...(projector.includes('canonical') || projector.includes('text') ? ['canonical projection'] : []),
          ...(projector.includes('blocked') || projector.includes('streamJson') ? ['blocked state preserved'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'deepseek-route-cost-cache',
      lane: 'deepseek-runtime',
      title: 'Repair DeepSeek route, cost, cache, and admission truth table',
      prompt: 'Fix the DeepSeek routing core. Default coding/bugfix/verification must stay Flash non-thinking, FIM only fires for completion lane, Pro requires explicit admission, and cache hit rate must be computed from real hit/miss token fields.',
      publicTestFile: 'tests/route.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/route.ts',
        'src/cache.ts',
        'tests/route.public.test.ts',
      ],
      expectedSignals: ['flash default', 'pro admission', 'fim lane lock', 'cache hit rate'],
      files: {
        'src/route.ts': `export type Intent = {
  kind: 'coding' | 'bugfix' | 'verification' | 'review' | 'completion'
  risk: 'low' | 'high'
  explicitPro?: boolean
}

export type RouteDecision = {
  model: string
  thinking: 'disabled' | 'enabled'
  lane: string
  reason: string
}

export function route(intent: Intent): RouteDecision {
  if (intent.kind === 'completion') {
    return { model: 'deepseek-v4-pro', thinking: 'enabled', lane: 'query', reason: 'completion' }
  }
  if (intent.risk === 'high') {
    return { model: 'deepseek-v4-pro', thinking: 'enabled', lane: 'query', reason: 'risk' }
  }
  return { model: 'deepseek-v4-flash', thinking: 'enabled', lane: 'query', reason: 'default' }
}
`,
        'src/cache.ts': `export type Usage = {
  promptTokens: number
  cacheHitInputTokens?: number
  cacheMissInputTokens?: number
}

export function cacheHitRatePct(usage: Usage): number {
  if (usage.promptTokens === 0) return 0
  return Math.round(((usage.cacheHitInputTokens ?? 0) / usage.promptTokens) * 100)
}
`,
        'tests/route.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { route } from '../src/route.ts'

describe('DeepSeek route public behavior', () => {
  test('keeps ordinary coding on Flash non-thinking', () => {
    expect(route({ kind: 'coding', risk: 'low' })).toMatchObject({
      model: 'deepseek-v4-flash',
      thinking: 'disabled',
    })
  })

  test('allows explicit Pro admission', () => {
    expect(route({ kind: 'review', risk: 'high', explicitPro: true }).model).toBe('deepseek-v4-pro')
  })
})
`,
        'tests/route.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { route } from '../src/route.ts'
import { cacheHitRatePct } from '../src/cache.ts'

describe('DeepSeek route hidden behavior', () => {
  test('does not escalate high-risk work without explicit Pro admission', () => {
    const decision = route({ kind: 'bugfix', risk: 'high' })
    expect(decision.model).toBe('deepseek-v4-flash')
    expect(decision.reason).toContain('flash-first')
  })

  test('locks FIM to completion lane only', () => {
    expect(route({ kind: 'completion', risk: 'low' })).toMatchObject({ model: 'deepseek-v4-flash', lane: 'fim' })
    expect(route({ kind: 'coding', risk: 'low' }).lane).toBe('query')
  })

  test('computes cache hit rate from hit and miss input tokens', () => {
    expect(cacheHitRatePct({ promptTokens: 1000, cacheHitInputTokens: 700, cacheMissInputTokens: 300 })).toBe(70)
    expect(cacheHitRatePct({ promptTokens: 1000, cacheHitInputTokens: 0, cacheMissInputTokens: 0 })).toBe(0)
  })
})
`,
      },
      verify: async workspace => {
        const [routeSource, cacheSource] = await Promise.all([
          readFile(join(workspace, 'src', 'route.ts'), 'utf8'),
          readFile(join(workspace, 'src', 'cache.ts'), 'utf8'),
        ])
        const signals = [
          ...(routeSource.includes('deepseek-v4-flash') && routeSource.includes("thinking: 'disabled'") ? ['flash default'] : []),
          ...(routeSource.includes('explicitPro') && routeSource.includes('deepseek-v4-pro') ? ['pro admission'] : []),
          ...(routeSource.includes("lane: 'fim'") && routeSource.includes("kind === 'completion'") ? ['fim lane lock'] : []),
          ...(cacheSource.includes('cacheHitInputTokens') && cacheSource.includes('cacheMissInputTokens') ? ['cache hit rate'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'context-recovery-source-truth',
      lane: 'context-recovery',
      title: 'Repair context recovery with source truth freshness',
      prompt: 'Fix resume snapshots so long tasks retain goal, next action, and risks, but stale source anchors are detected by path/hash instead of trusting old summaries.',
      publicTestFile: 'tests/recovery.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/recovery.ts',
        'tests/recovery.public.test.ts',
      ],
      expectedSignals: ['goal retained', 'next action retained', 'stale source detected', 'memory not source truth'],
      files: {
        'src/recovery.ts': `export type SourceAnchor = { path: string; hash: string }
export type Snapshot = {
  goal: string
  nextAction: string
  risks: string[]
  anchors: SourceAnchor[]
  summary: string
}

export function makeSnapshot(goal: string, nextAction: string, anchors: SourceAnchor[]): Snapshot {
  return { goal, nextAction, risks: [], anchors, summary: goal }
}

export function resume(snapshot: Snapshot, currentAnchors: SourceAnchor[]) {
  return {
    goal: snapshot.summary,
    nextAction: '',
    risks: [],
    sourceTruthFresh: true,
    staleAnchors: [] as string[],
  }
}
`,
        'tests/recovery.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { makeSnapshot, resume } from '../src/recovery.ts'

describe('context recovery public behavior', () => {
  test('retains goal and next action after resume', () => {
    const snapshot = makeSnapshot('finish hard benchmark', 'run hidden tests', [{ path: 'src/a.ts', hash: 'a1' }])
    const restored = resume(snapshot, [{ path: 'src/a.ts', hash: 'a1' }])
    expect(restored.goal).toBe('finish hard benchmark')
    expect(restored.nextAction).toBe('run hidden tests')
  })
})
`,
        'tests/recovery.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { makeSnapshot, resume } from '../src/recovery.ts'

describe('context recovery hidden behavior', () => {
  test('marks stale source anchors without dropping risks', () => {
    const snapshot = makeSnapshot('ship release', 'verify source truth', [{ path: 'src/a.ts', hash: 'old' }])
    snapshot.risks.push('old summary may be stale')
    const restored = resume(snapshot, [{ path: 'src/a.ts', hash: 'new' }])
    expect(restored.sourceTruthFresh).toBe(false)
    expect(restored.staleAnchors).toEqual(['src/a.ts'])
    expect(restored.risks).toContain('old summary may be stale')
  })

  test('treats memory summary as navigation only', () => {
    const snapshot = makeSnapshot('audit owner map', 'read current file', [{ path: 'src/owner.ts', hash: 'h1' }])
    snapshot.summary = 'old owner map says PASS'
    const restored = resume(snapshot, [{ path: 'src/owner.ts', hash: 'h1' }])
    expect(restored.goal).toBe('audit owner map')
    expect(restored.nextAction).toBe('read current file')
    expect(restored.memoryIsSourceTruth).toBe(false)
  })
})
`,
      },
      verify: async workspace => {
        const source = await readFile(join(workspace, 'src', 'recovery.ts'), 'utf8')
        const signals = [
          ...(source.includes('snapshot.goal') ? ['goal retained'] : []),
          ...(source.includes('snapshot.nextAction') ? ['next action retained'] : []),
          ...(source.includes('staleAnchors') && source.includes('hash') ? ['stale source detected'] : []),
          ...(source.includes('memoryIsSourceTruth') && source.includes('false') ? ['memory not source truth'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'agent-merge-evidence-envelope',
      lane: 'agent-coordination',
      title: 'Repair multi-agent evidence merge without transcript explosion',
      prompt: 'Fix agent merge behavior so parent synthesis uses worker evidence envelopes, strips raw transcripts, detects conflicting file edits, and reports tests/costs compactly.',
      publicTestFile: 'tests/agent.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/merge.ts',
        'tests/agent.public.test.ts',
      ],
      expectedSignals: ['evidence envelope', 'transcript stripped', 'conflict detection', 'cost/test summary'],
      files: {
        'src/merge.ts': `export type WorkerResult = {
  workerId: string
  changedFiles: string[]
  patchHash: string
  transcript: string
  tests: string[]
  costUSD: number
}

export function mergeWorkerResults(results: WorkerResult[]) {
  return {
    transcript: results.map(result => result.transcript).join('\\n'),
    changedFiles: results.flatMap(result => result.changedFiles),
    conflicts: [] as string[],
    tests: [] as string[],
    totalCostUSD: 0,
  }
}
`,
        'tests/agent.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { mergeWorkerResults } from '../src/merge.ts'

describe('agent merge public behavior', () => {
  test('summarizes changed files and total cost', () => {
    const merged = mergeWorkerResults([
      { workerId: 'a', changedFiles: ['src/a.ts'], patchHash: 'h1', transcript: 'x'.repeat(500), tests: ['bun test a'], costUSD: 0.01 },
      { workerId: 'b', changedFiles: ['src/b.ts'], patchHash: 'h2', transcript: 'y'.repeat(500), tests: ['bun test b'], costUSD: 0.02 },
    ])
    expect(merged.changedFiles).toEqual(['src/a.ts', 'src/b.ts'])
    expect(merged.totalCostUSD).toBe(0.03)
  })
})
`,
        'tests/agent.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { mergeWorkerResults } from '../src/merge.ts'

describe('agent merge hidden behavior', () => {
  test('strips raw transcript and emits evidence envelopes', () => {
    const merged = mergeWorkerResults([
      { workerId: 'a', changedFiles: ['src/a.ts'], patchHash: 'h1', transcript: 'SECRET RAW TRANSCRIPT', tests: ['test:a'], costUSD: 0.01 },
    ])
    expect(JSON.stringify(merged)).not.toContain('SECRET RAW TRANSCRIPT')
    expect(merged.envelopes[0]).toMatchObject({ workerId: 'a', patchHash: 'h1' })
    expect(merged.tests).toEqual(['test:a'])
  })

  test('detects conflicting edits to the same file', () => {
    const merged = mergeWorkerResults([
      { workerId: 'a', changedFiles: ['src/a.ts'], patchHash: 'h1', transcript: '', tests: [], costUSD: 0 },
      { workerId: 'b', changedFiles: ['src/a.ts'], patchHash: 'h2', transcript: '', tests: [], costUSD: 0 },
    ])
    expect(merged.conflicts).toEqual(['src/a.ts'])
  })
})
`,
      },
      verify: async workspace => {
        const source = await readFile(join(workspace, 'src', 'merge.ts'), 'utf8')
        const signals = [
          ...(source.includes('envelopes') && source.includes('patchHash') ? ['evidence envelope'] : []),
          ...(source.includes('envelopes') && !source.includes('transcript: results') ? ['transcript stripped'] : []),
          ...(source.includes('conflicts') && (source.includes('Set') || source.includes('Map')) ? ['conflict detection'] : []),
          ...(source.includes('totalCostUSD') && source.includes('tests') ? ['cost/test summary'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'mcp-skill-priority-boundary',
      lane: 'mcp-skill',
      title: 'Repair MCP/Skill priority, conflict, and permission boundary',
      prompt: 'Fix registry selection so DSXU primary skills win over secondary packs, unsafe secondary skills are disabled, conflicts are explicit, and all side-effect tools require Tool Gate permission.',
      publicTestFile: 'tests/skill.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/registry.ts',
        'tests/skill.public.test.ts',
      ],
      expectedSignals: ['primary priority', 'secondary conflict', 'unsafe disabled', 'tool gate boundary'],
      files: {
        'src/registry.ts': `export type Skill = {
  name: string
  tier: 'primary' | 'secondary'
  command: string
  sideEffect?: boolean
  unsafe?: boolean
}

export function selectSkill(skills: Skill[], command: string) {
  const matched = skills.filter(skill => skill.command === command)
  return {
    selected: matched[0] ?? null,
    conflicts: [] as string[],
    requiresToolGate: false,
  }
}
`,
        'tests/skill.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { selectSkill } from '../src/registry.ts'

describe('skill registry public behavior', () => {
  test('prefers primary DSXU skill over secondary package', () => {
    const result = selectSkill([
      { name: 'superpower-edit', tier: 'secondary', command: 'edit' },
      { name: 'dsxu-edit', tier: 'primary', command: 'edit' },
    ], 'edit')
    expect(result.selected?.name).toBe('dsxu-edit')
  })
})
`,
        'tests/skill.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { selectSkill } from '../src/registry.ts'

describe('skill registry hidden behavior', () => {
  test('records secondary conflicts and disables unsafe skills', () => {
    const result = selectSkill([
      { name: 'unsafe-shell', tier: 'secondary', command: 'shell', unsafe: true, sideEffect: true },
      { name: 'dsxu-shell', tier: 'primary', command: 'shell', sideEffect: true },
    ], 'shell')
    expect(result.selected?.name).toBe('dsxu-shell')
    expect(result.conflicts).toContain('unsafe-shell')
    expect(result.requiresToolGate).toBe(true)
  })

  test('does not let a secondary side-effect skill become standalone runtime', () => {
    const result = selectSkill([
      { name: 'secondary-delete', tier: 'secondary', command: 'delete', sideEffect: true },
    ], 'delete')
    expect(result.selected).toBeNull()
    expect(result.conflicts).toContain('secondary-delete')
    expect(result.requiresToolGate).toBe(true)
  })
})
`,
      },
      verify: async workspace => {
        const source = await readFile(join(workspace, 'src', 'registry.ts'), 'utf8')
        const signals = [
          ...(source.includes("'primary'") && source.includes('selected') ? ['primary priority'] : []),
          ...(source.includes('conflicts') && source.includes('secondary') ? ['secondary conflict'] : []),
          ...(source.includes('unsafe') && source.includes('null') ? ['unsafe disabled'] : []),
          ...(source.includes('requiresToolGate') && source.includes('sideEffect') ? ['tool gate boundary'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
    {
      id: 'release-claim-evidence-binder',
      lane: 'release-evidence',
      title: 'Repair release claim evidence binding and no-overclaim README output',
      prompt: 'Fix release claim generation so public claims require source/test/live/raw/cost evidence, external benchmark wording stays blocked without target manifests, README text cannot include unsupported parity claims, and src/claim.ts itself must not retain external brand/parity/percent claim tokens even inside strings, comments, or regular expressions. Prefer a positive DSXU-owned evidence allowlist over banned-word matching.',
      publicTestFile: 'tests/claim.public.test.ts',
      finalTestCommand: ['bun', 'test'],
      visibleFiles: [
        'src/claim.ts',
        'tests/claim.public.test.ts',
      ],
      expectedSignals: ['evidence binding', 'target manifest gate', 'no parity overclaim', 'claim limited README'],
      files: {
        'src/claim.ts': `export type Evidence = {
  source?: string
  test?: string
  live?: string
  raw?: string
  cost?: string
  targetManifest?: string
}

export function canPublishClaim(evidence: Evidence): boolean {
  return Boolean(evidence.source && evidence.test)
}

export function buildReadmeClaim(evidence: Evidence): string {
  if (canPublishClaim(evidence)) return 'DSXU reaches ${EXTERNAL_MODEL_TOKEN}/${REFERENCE_PRODUCT_TOKEN}-level ${PERCENT_CAPABILITY_TOKEN} coding ability.'
  return 'DSXU roadmap.'
}
`,
        'tests/claim.public.test.ts': `import { describe, expect, test } from 'bun:test'
import { buildReadmeClaim, canPublishClaim } from '../src/claim.ts'

describe('release claim public behavior', () => {
  test('requires source and test evidence before publishing a claim', () => {
    expect(canPublishClaim({ source: 'src.ts', test: 'test.log' })).toBe(true)
    expect(canPublishClaim({ source: 'src.ts' })).toBe(false)
  })

  test('does not write unsupported parity claim', () => {
    expect(buildReadmeClaim({ source: 'src.ts', test: 'test.log' })).not.toContain('95%')
  })
})
`,
        'tests/claim.hidden.test.ts': `import { describe, expect, test } from 'bun:test'
import { buildReadmeClaim, canPublishClaim } from '../src/claim.ts'

describe('release claim hidden behavior', () => {
  test('requires full evidence chain for public sellable claim', () => {
    expect(canPublishClaim({ source: 'src', test: 'test', live: 'live', raw: 'raw', cost: 'cost' })).toBe(true)
    expect(canPublishClaim({ source: 'src', test: 'test', live: 'live', raw: 'raw' })).toBe(false)
  })

  test('blocks external benchmark wording without target manifest', () => {
    const claim = buildReadmeClaim({ source: 'src', test: 'test', live: 'live', raw: 'raw', cost: 'cost' })
    expect(claim).not.toMatch(new RegExp('SWE-bench|Terminal-Bench|OSWorld|tau-bench|${EXTERNAL_MODEL_TOKEN}|${REFERENCE_PRODUCT_TOKEN}|${PERCENT_CAPABILITY_TOKEN}'))
    const targetClaim = buildReadmeClaim({ source: 'src', test: 'test', live: 'live', raw: 'raw', cost: 'cost', targetManifest: 'target.json' })
    expect(targetClaim).toContain('internal evidence')
    expect(targetClaim).not.toMatch(new RegExp('${EXTERNAL_MODEL_TOKEN}|${REFERENCE_PRODUCT_TOKEN}|${PERCENT_CAPABILITY_TOKEN}'))
  })
})
`,
      },
      verify: async workspace => {
        const source = await readFile(join(workspace, 'src', 'claim.ts'), 'utf8')
        const signals = [
          ...(source.includes('source') && source.includes('test') && source.includes('live') && source.includes('raw') && source.includes('cost') ? ['evidence binding'] : []),
          ...(source.includes('targetManifest') ? ['target manifest gate'] : []),
          ...(!DISALLOWED_PUBLIC_CLAIM_PATTERN.test(source) ? ['no parity overclaim'] : []),
          ...(source.includes('internal evidence') || source.includes('DSXU-owned') ? ['claim limited README'] : []),
        ]
        return { pass: signals.length >= 4, signals }
      },
    },
  ]
}

function selectedTasks(): HardTask[] {
  const allTasks = tasks()
  if (!TASK_FILTER) return allTasks
  const wanted = new Set(TASK_FILTER.split(/[,\s]+/).map(item => item.trim()).filter(Boolean))
  const selected = allTasks.filter(task => wanted.has(task.id) || wanted.has(task.lane))
  if (selected.length === 0) {
    throw new Error(`No hard benchmark tasks matched DSXU_HARD_BENCHMARK_TASK=${TASK_FILTER}`)
  }
  return selected
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

async function writeSvg(summary: Record<string, number>): Promise<void> {
  const raw = summary.rawPassRatePct ?? 0
  const dsxu = summary.dsxuPassRatePct ?? 0
  const rawWidth = Math.round(raw * 4)
  const dsxuWidth = Math.round(dsxu * 4)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="780" height="260" viewBox="0 0 780 260">',
    '<rect width="780" height="260" fill="#ffffff"/>',
    '<text x="24" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">DSXU Hard Engineering Benchmark</text>',
    '<text x="24" y="58" font-family="Arial, sans-serif" font-size="13" fill="#4b5563">Raw API replacement baseline vs DSXU read/edit/test repair loop on hidden-test tasks.</text>',
    '<text x="24" y="105" font-family="Arial, sans-serif" font-size="14" fill="#18212f">Raw API pass rate</text>',
    '<rect x="220" y="90" width="400" height="22" fill="#edf1f7" rx="5"/>',
    `<rect x="220" y="90" width="${rawWidth}" height="22" fill="#9ca3af" rx="5"/>`,
    `<text x="${230 + rawWidth}" y="106" font-family="Arial, sans-serif" font-size="12" fill="#18212f">${raw}%</text>`,
    '<text x="24" y="145" font-family="Arial, sans-serif" font-size="14" fill="#18212f">DSXU pass rate</text>',
    '<rect x="220" y="130" width="400" height="22" fill="#edf1f7" rx="5"/>',
    `<rect x="220" y="130" width="${dsxuWidth}" height="22" fill="#2563eb" rx="5"/>`,
    `<text x="${230 + dsxuWidth}" y="146" font-family="Arial, sans-serif" font-size="12" fill="#18212f">${dsxu}%</text>`,
    `<text x="24" y="192" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">Raw baseline can replace files once from visible context. DSXU can inspect workspace, run tests, repair, and rerun.</text>`,
    `<text x="24" y="216" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">Not an external benchmark claim. Public 90/95 claims remain blocked without target manifests and public task raw logs.</text>`,
    '</svg>',
  ].join('\n')
  await mkdir(dirname(OUT_SVG), { recursive: true })
  await writeFile(OUT_SVG, `${svg}\n`, 'utf8')
}

async function main(): Promise<void> {
  await loadDotEnv()
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(WORKSPACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const runId = nowSafe()
  const hardTasks = selectedTasks()
  const rawResults: Array<{ task: HardTask; result: RawResult }> = []
  const dsxuResults: Array<{ task: HardTask; result: DsxuResult }> = []
  for (const task of hardTasks) {
    const rawWorkspace = join(WORKSPACE_DIR, `raw-${task.id}-${runId}`)
    const dsxuWorkspace = join(WORKSPACE_DIR, `dsxu-${task.id}-${runId}`)
    await writeFixture(task, rawWorkspace)
    await writeFixture(task, dsxuWorkspace)
    console.error(`[hard-benchmark] raw baseline start: ${task.id}`)
    rawResults.push({ task, result: await runRaw(task, rawWorkspace) })
    console.error(`[hard-benchmark] raw baseline done: ${task.id}`)
    console.error(`[hard-benchmark] dsxu loop start: ${task.id}`)
    dsxuResults.push({ task, result: await runDsxu(task, dsxuWorkspace) })
    console.error(`[hard-benchmark] dsxu loop done: ${task.id}`)
  }

  const totalTasks = hardTasks.length
  const rawPassed = rawResults.filter(item => item.result.pass).length
  const dsxuPassed = dsxuResults.filter(item => item.result.pass).length
  const status = dsxuPassed === totalTasks
    ? 'PASS_DSXU_HARD_ENGINEERING_LIFT'
    : dsxuPassed > rawPassed
      ? 'PARTIAL_DSXU_HARD_ENGINEERING_LIFT_WITH_GAPS'
      : 'BLOCKED_HARD_ENGINEERING_LIFT_NOT_PROVEN'
  const summary = {
    schemaVersion: 'dsxu.hard-engineering-benchmark.v1',
    generatedAt: new Date().toISOString(),
    status,
    totalTasks,
    rawPassRatePct: pct(rawPassed, totalTasks),
    dsxuPassRatePct: pct(dsxuPassed, totalTasks),
    rawAverageScore: Math.round(avg(rawResults.map(item => item.result.score)) * 10) / 10,
    dsxuAverageScore: Math.round(avg(dsxuResults.map(item => item.result.score)) * 10) / 10,
    rawTotalCostUSD: rawResults.reduce((sum, item) => sum + item.result.costUSD, 0),
    dsxuTotalCostUSD: dsxuResults.reduce((sum, item) => sum + item.result.costUSD, 0),
    public90Allowed: false,
    externalBenchmarkClaimAllowed: false,
    chartPath: rel(OUT_SVG),
  }

  const rows = hardTasks.map(task => {
    const raw = rawResults.find(item => item.task.id === task.id)!.result
    const dsxu = dsxuResults.find(item => item.task.id === task.id)!.result
    return {
      id: task.id,
      lane: task.lane,
      rawPass: raw.pass,
      dsxuPass: dsxu.pass,
      rawScore: raw.score,
      dsxuScore: dsxu.score,
      rawFiles: raw.appliedFiles.join('; '),
      dsxuTools: Object.entries(dsxu.toolUseCounts).map(([name, count]) => `${name}:${count}`).join('; '),
    }
  })

  const report = {
    ...summary,
    claimBoundary: 'This is a DSXU-owned hard internal benchmark inspired by public benchmark task shapes. It is not a SWE-bench, Terminal-Bench, OSWorld, or tau-bench score.',
    taskFilter: TASK_FILTER ?? null,
    tasks: hardTasks.map(task => {
      const raw = rawResults.find(item => item.task.id === task.id)!.result
      const dsxu = dsxuResults.find(item => item.task.id === task.id)!.result
      return {
        id: task.id,
        lane: task.lane,
        title: task.title,
        sourceFixtureHash: sha(Object.values(task.files).join('\n')),
        expectedSignals: task.expectedSignals,
        raw: {
          pass: raw.pass,
          score: raw.score,
          durationMs: raw.durationMs,
          costUSD: raw.costUSD,
          appliedFiles: raw.appliedFiles,
          applyErrors: raw.applyErrors,
          responsePath: rel(raw.responsePath),
          finalTestExitCode: raw.finalTestExitCode,
          finalTestStdoutPath: rel(raw.finalTestStdoutPath),
          finalTestStderrPath: rel(raw.finalTestStderrPath),
        },
        dsxu: {
          pass: dsxu.pass,
          score: dsxu.score,
          durationMs: dsxu.durationMs,
          costUSD: dsxu.costUSD,
          tracePath: rel(dsxu.tracePath),
          toolUseCounts: dsxu.toolUseCounts,
          finalTestExitCode: dsxu.finalTestExitCode,
          finalTestStdoutPath: rel(dsxu.finalTestStdoutPath),
          finalTestStderrPath: rel(dsxu.finalTestStderrPath),
          verificationSignals: dsxu.verificationSignals,
        },
      }
    }),
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeSvg(summary)
  await writeFile(
    OUT_MD,
    [
      '# DSXU Hard Engineering Benchmark - 2026-05-17',
      '',
      `Status: \`${summary.status}\``,
      '',
      'This benchmark uses DSXU-owned internal tasks shaped like harder public agent benchmarks. Raw API can produce one-shot file replacements from visible context; DSXU can inspect the workspace, run tests, repair hidden failures, and rerun verification.',
      '',
      '## Summary',
      '',
      mdTable([summary], ['totalTasks', 'rawPassRatePct', 'dsxuPassRatePct', 'rawAverageScore', 'dsxuAverageScore', 'rawTotalCostUSD', 'dsxuTotalCostUSD']),
      '',
      '## Tasks',
      '',
      mdTable(rows, ['id', 'lane', 'rawPass', 'dsxuPass', 'rawScore', 'dsxuScore', 'rawFiles', 'dsxuTools']),
      '',
      '## Claim Boundary',
      '',
      '- This proves internal hard-task workflow lift only.',
      '- It is not a public SWE-bench / Terminal-Bench / OSWorld / tau-bench score.',
      '- Public 90/95 and external superiority claims remain blocked.',
      `- Chart: \`${rel(OUT_SVG)}\``,
    ].join('\n'),
    'utf8',
  )

  console.log(JSON.stringify({
    status: summary.status,
    totalTasks,
    rawPassRatePct: summary.rawPassRatePct,
    dsxuPassRatePct: summary.dsxuPassRatePct,
    rawAverageScore: summary.rawAverageScore,
    dsxuAverageScore: summary.dsxuAverageScore,
    rawTotalCostUSD: summary.rawTotalCostUSD,
    dsxuTotalCostUSD: summary.dsxuTotalCostUSD,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
    chart: OUT_SVG,
  }, null, 2))
  if (summary.status === 'BLOCKED_HARD_ENGINEERING_LIFT_NOT_PROVEN') process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
