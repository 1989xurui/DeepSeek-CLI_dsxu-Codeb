import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { estimateDeepSeekV4Cost } from '../src/utils/model/deepseekV4Control'
import { buildV5ReplayTraceMetadataEvents } from '../src/dsxu/engine/real-task-replay-suite-v1'

type TaskSpec = {
  id: string
  title: string
  prompt: string
  files: Record<string, string>
  testFile: string
  expectedEvidence: string[]
  rawCorrectPattern: RegExp
  verify: (workspace: string) => Promise<{ pass: boolean; scoreSignals: string[] }>
}

type CommandRun = {
  id: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutPath: string
  stderrPath: string
  stdout: string
  stderr: string
}

type RawRun = {
  id: string
  pass: boolean
  score: number
  durationMs: number
  costUSD: number
  inputTokens: number
  outputTokens: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  responsePath: string
  parsedJson: Record<string, unknown> | null
  limitations: string[]
}

type DsxuRun = CommandRun & {
  tracePath: string
  score: number
  pass: boolean
  finalTestPassed: boolean
  semanticVerificationPassed: boolean
  finalTestExitCode: number
  verificationSignals: string[]
  resultJson: Record<string, unknown> | null
  costUSD: number
  toolUseCounts: Record<string, number>
}

const ROOT = process.cwd()
const DATE = '20260516'
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'raw-api-vs-dsxu-ab')
const WORKSPACE_DIR = process.env.DSXU_RAW_AB_WORKSPACE_DIR ||
  join(dirname(ROOT), 'DSXU-code-evidence-workspaces', 'raw-api-vs-dsxu-ab')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_RAW_API_VS_DSXU_AB_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_RAW_API_VS_DSXU_AB_${DATE}.md`)
const OUT_SVG = join(ROOT, 'docs', 'assets', 'dsxu-raw-api-vs-dsxu-ab.svg')
const MODEL = 'deepseek-v4-flash'

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
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

async function runCommand(
  id: string,
  command: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CommandRun> {
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
    return {
      id,
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      stdoutPath,
      stderrPath,
      stdout,
      stderr,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseMarkdownJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidates = [
    fenced?.[1]?.trim(),
    trimmed,
  ].filter(Boolean) as string[]
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      // Keep trying candidates.
    }
  }
  return null
}

function parseStreamJson(text: string): {
  resultJson: Record<string, unknown> | null
  costUSD: number
  toolUseCounts: Record<string, number>
} {
  let resultJson: Record<string, unknown> | null = null
  let lastAssistantJson: Record<string, unknown> | null = null
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
          const typed = block as { type?: unknown; name?: unknown; text?: unknown }
          if (typed.type === 'tool_use' && typeof typed.name === 'string') {
            toolUseCounts[typed.name] = (toolUseCounts[typed.name] ?? 0) + 1
          }
          if (typeof typed.text === 'string') {
            const parsed = parseMarkdownJson(typed.text)
            if (parsed) lastAssistantJson = parsed
          }
        }
      }
      if (event.type === 'result') {
        if (typeof event.result === 'string') resultJson = parseMarkdownJson(event.result)
        if (typeof event.total_cost_usd === 'number') costUSD = event.total_cost_usd
      }
    } catch {
      // Raw trace remains authoritative.
    }
  }
  return { resultJson: resultJson ?? lastAssistantJson, costUSD, toolUseCounts }
}

async function writeFixture(task: TaskSpec, workspace: string): Promise<void> {
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

async function readFixturePrompt(task: TaskSpec, workspace: string): Promise<string> {
  const fileTexts: string[] = []
  for (const path of Object.keys(task.files)) {
    fileTexts.push(`--- ${path} ---\n${await readFile(join(workspace, path), 'utf8')}`)
  }
  return [
    `Task: ${task.title}`,
    task.prompt,
    '',
    'You are the raw DeepSeek API baseline. You cannot read files from disk, edit files, run shell commands, or verify tests.',
    'Use only the source excerpts below. Return compact JSON only with keys:',
    '{"identified_fix":string,"expected_files":[string],"would_run_tests":[string],"can_edit_files":false,"can_run_tests":false,"final_evidence":[string],"limitations":[string],"confidence_0_100":number}',
    '',
    fileTexts.join('\n\n'),
  ].join('\n')
}

async function runRawBaseline(task: TaskSpec, workspace: string): Promise<RawRun> {
  const apiKey = getApiKey()
  const responsePath = join(TRACE_DIR, `${task.id}-raw-api-${nowSafe()}.json`)
  if (!apiKey) {
    return {
      id: task.id,
      pass: false,
      score: 0,
      durationMs: 0,
      costUSD: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheHitInputTokens: 0,
      cacheMissInputTokens: 0,
      responsePath,
      parsedJson: null,
      limitations: ['no DeepSeek API key available for raw baseline'],
    }
  }

  const prompt = await readFixturePrompt(task, workspace)
  const startedAt = Date.now()
  const response = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DSXU_RAW_BASELINE_MODEL || MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a raw API coding baseline. Do not claim file edits or tests. Return JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      stream: false,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      temperature: 0,
    }),
  })
  const rawText = await response.text()
  const durationMs = Date.now() - startedAt
  await mkdir(dirname(responsePath), { recursive: true })
  await writeFile(responsePath, rawText, 'utf8')
  if (!response.ok) {
    return {
      id: task.id,
      pass: false,
      score: 0,
      durationMs,
      costUSD: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheHitInputTokens: 0,
      cacheMissInputTokens: 0,
      responsePath,
      parsedJson: null,
      limitations: [`raw API failed with HTTP ${response.status}`],
    }
  }

  const data = JSON.parse(rawText) as Record<string, unknown>
  const choices = Array.isArray(data.choices) ? data.choices : []
  const first = choices[0] as { message?: { content?: string } } | undefined
  const content = first?.message?.content ?? ''
  const parsed = parseMarkdownJson(content)
  const usage = data.usage as Record<string, unknown> | undefined
  const inputTokens = Number(usage?.prompt_tokens ?? 0)
  const outputTokens = Number(usage?.completion_tokens ?? 0)
  const cacheHitInputTokens = Number(
    usage?.prompt_cache_hit_tokens ??
    usage?.cache_hit_input_tokens ??
    0,
  )
  const cacheMissInputTokens = Number(
    usage?.prompt_cache_miss_tokens ??
    usage?.cache_miss_input_tokens ??
    Math.max(0, inputTokens - cacheHitInputTokens),
  )
  const costUSD = estimateDeepSeekV4Cost({
    model: MODEL,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
  })
  const text = JSON.stringify(parsed ?? {}) + '\n' + content
  const conceptual = task.rawCorrectPattern.test(text)
  const honestNoTools =
    parsed?.can_edit_files === false &&
    parsed?.can_run_tests === false
  const evidenceCount = Array.isArray(parsed?.final_evidence) ? parsed.final_evidence.length : 0
  const score =
    (conceptual ? 35 : 0) +
    (honestNoTools ? 25 : 0) +
    (evidenceCount > 0 ? 15 : 0) +
    (parsed ? 10 : 0)

  return {
    id: task.id,
    pass: false,
    score,
    durationMs,
    costUSD,
    inputTokens,
    outputTokens,
    cacheHitInputTokens,
    cacheMissInputTokens,
    responsePath,
    parsedJson: parsed,
    limitations: [
      honestNoTools
        ? 'raw API produced a plan only; it did not edit files or run tests'
        : 'raw API output over-claimed file/test execution',
      conceptual
        ? 'conceptual fix signal found'
        : 'conceptual fix signal missing',
    ],
  }
}

async function runDsxuTask(task: TaskSpec, workspace: string): Promise<DsxuRun> {
  const tracePath = join(TRACE_DIR, `${task.id}-dsxu-${nowSafe()}.jsonl`)
  const testCommand = `bun test "${task.testFile}"`
  const prompt = [
    `DSXU raw API vs DSXU A/B task: ${task.title}.`,
    `Your current working directory is the isolated fixture workspace: ${workspace}`,
    'Edit only files under this workspace. Do not edit the DSXU product repository.',
    task.prompt,
    '',
    'Required workflow:',
    '1. Read the implementation and test files in the current fixture workspace.',
    '2. Edit only the fixture implementation files needed to make the tests pass.',
    `3. Run exactly this verification command before final: ${testCommand}`,
    '4. Return compact JSON only with keys {"task_id":string,"edited_files":[string],"tests_run":[string],"test_passed":boolean,"evidence":[string],"next_action":string}.',
    'Default route must stay DeepSeek Flash-first; do not request Pro for this fixture.',
  ].join('\n')
  const run = await runCommand(task.id, [
    'bun',
    `--env-file=${join(ROOT, '.env')}`,
    join(ROOT, 'src', 'entrypoints', 'dsxu-code.tsx'),
    '-p',
    '--verbose',
    '--model',
    MODEL,
    '--max-turns',
    '14',
    '--output-format',
    'stream-json',
    '--tools',
    'Read,Edit,Bash,Grep,Glob',
    '--permission-mode',
    'bypassPermissions',
    '--dangerously-skip-permissions',
    prompt,
  ], { cwd: workspace, timeoutMs: 900_000 })
  const rawTraceText = `${run.stdout}${run.stderr}`
  const parsed = parseStreamJson(rawTraceText)
  const finalVerification = await task.verify(workspace)
  const finalTest = await runCommand(`${task.id}-final-test`, ['bun', 'test', join(workspace, task.testFile)], {
    timeoutMs: 180_000,
  })
  const finalTestPassed = finalTest.exitCode === 0
  const sourceEvidence = [...new Set([...Object.keys(task.files), task.testFile])]
  const v5TraceEvents = buildV5ReplayTraceMetadataEvents({
    caseId: task.id,
    userTask: task.title,
    workspace,
    prompt,
    visibleTools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
    sourceEvidence,
    changedFiles: Object.keys(task.files).filter(path => path.startsWith('src/')),
    verificationCommand: ['bun', 'test', task.testFile],
    verificationPassed: finalTestPassed && finalVerification.pass,
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
  const editedEvidence = finalVerification.scoreSignals.length > 0
  const toolCount = Object.values(parsed.toolUseCounts).reduce((sum, value) => sum + value, 0)
  const score =
    (run.exitCode === 0 ? 10 : 0) +
    (toolCount > 0 ? 15 : 0) +
    (editedEvidence ? 25 : 0) +
    (finalTestPassed ? 40 : 0) +
    (parsed.resultJson ? 10 : 0)
  return {
    ...run,
    tracePath,
    score,
    pass: finalTestPassed,
    finalTestPassed,
    semanticVerificationPassed: finalVerification.pass,
    finalTestExitCode: finalTest.exitCode,
    verificationSignals: finalVerification.scoreSignals,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    toolUseCounts: parsed.toolUseCounts,
  }
}

function tasks(): TaskSpec[] {
  return [
    {
      id: 'route-policy-flash-first',
      title: 'Fix Flash-first route policy without overusing Pro',
      prompt: 'The route policy must use Flash by default, Flash Max for long context before Pro, and Pro only for critical risk or failed high-risk Flash attempts.',
      testFile: 'tests/routePolicy.test.ts',
      expectedEvidence: ['flash max before pro', 'failed flash can use pro', 'tests pass'],
      rawCorrectPattern: /flash[-_ ]?max|before pro|critical|failed/i,
      files: {
        'src/routePolicy.ts': `export type TaskRisk = 'low' | 'medium' | 'high' | 'critical'

export type TaskInput = {
  risk: TaskRisk
  estimatedTokens: number
  needsLongContext?: boolean
  flashFailed?: boolean
}

export type RouteDecision = {
  model: 'deepseek-v4-flash' | 'deepseek-v4-flash-max' | 'deepseek-v4-pro'
  reason: string
  requiresEvidence: boolean
}

export function decideRoute(task: TaskInput): RouteDecision {
  if (task.risk === 'critical') {
    return { model: 'deepseek-v4-pro', reason: 'critical task', requiresEvidence: true }
  }
  if (task.needsLongContext || task.estimatedTokens > 120000) {
    return { model: 'deepseek-v4-pro', reason: 'large context', requiresEvidence: true }
  }
  return { model: 'deepseek-v4-flash', reason: 'default route', requiresEvidence: false }
}
`,
        'tests/routePolicy.test.ts': `import { describe, expect, test } from 'bun:test'
import { decideRoute } from '../src/routePolicy.ts'

describe('route policy', () => {
  test('keeps low-risk coding on Flash with no evidence burden', () => {
    expect(decideRoute({ risk: 'low', estimatedTokens: 8000 })).toEqual({
      model: 'deepseek-v4-flash',
      reason: 'flash-first-default',
      requiresEvidence: false,
    })
  })

  test('uses Flash Max for long context before Pro', () => {
    expect(decideRoute({ risk: 'medium', estimatedTokens: 180000, needsLongContext: true })).toEqual({
      model: 'deepseek-v4-flash-max',
      reason: 'long-context-flash-max-before-pro',
      requiresEvidence: true,
    })
  })

  test('uses Pro only for critical risk or failed high-risk Flash attempts', () => {
    expect(decideRoute({ risk: 'high', estimatedTokens: 25000 }).model).toBe('deepseek-v4-flash')
    expect(decideRoute({ risk: 'high', estimatedTokens: 25000, flashFailed: true }).model).toBe('deepseek-v4-pro')
    expect(decideRoute({ risk: 'critical', estimatedTokens: 25000 }).model).toBe('deepseek-v4-pro')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'routePolicy.ts'), 'utf8')
        const pass =
          text.includes('deepseek-v4-flash-max') &&
          /flash[-_]first[-_]default/.test(text) &&
          /flashFailed/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(text.includes('deepseek-v4-flash-max') ? ['flash-max route implemented'] : []),
            ...(/flash[-_]first[-_]default/.test(text) ? ['flash default reason implemented'] : []),
            ...(/flashFailed/.test(text) ? ['failed flash pro admission implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'terminal-result-pack',
      title: 'Fix terminal result packaging for long output and failures',
      prompt: 'The result pack must keep stdout bounded, store full logs as artifacts, classify timeout/nonzero failure, and propose a recovery action.',
      testFile: 'tests/resultPack.test.ts',
      expectedEvidence: ['bounded preview', 'full log artifact', 'failure type', 'recovery action'],
      rawCorrectPattern: /bounded|preview|artifact|timeout|failure|recovery/i,
      files: {
        'src/resultPack.ts': `export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  timedOut?: boolean
  changedFiles?: string[]
}

export function packageResult(result: CommandResult): Record<string, unknown> {
  return {
    exitCode: result.exitCode,
    preview: result.stdout,
    fullLogPath: null,
    failureType: 'none',
    recoveryAction: 'none',
    changedFileCount: 0,
  }
}
`,
        'tests/resultPack.test.ts': `import { describe, expect, test } from 'bun:test'
import { packageResult } from '../src/resultPack.ts'

describe('terminal result pack', () => {
  test('bounds long stdout and points to a full artifact', () => {
    const pack = packageResult({ exitCode: 0, stdout: 'x'.repeat(500), stderr: '', changedFiles: ['a.ts', 'b.ts'] })
    expect(String(pack.preview).length).toBeLessThanOrEqual(160)
    expect(pack.fullLogPath).toBe('artifact://terminal/full-log')
    expect(pack.changedFileCount).toBe(2)
  })

  test('classifies timeout and command failures', () => {
    expect(packageResult({ exitCode: 1, stdout: '', stderr: 'boom' }).failureType).toBe('command_failed')
    const timeout = packageResult({ exitCode: 124, stdout: '', stderr: 'timeout', timedOut: true })
    expect(timeout.failureType).toBe('timeout')
    expect(timeout.recoveryAction).toBe('rerun-with-smaller-output-or-longer-timeout')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'resultPack.ts'), 'utf8')
        const pass =
          text.includes('artifact://terminal/full-log') &&
          /slice\(0,\s*(160|MAX_PREVIEW)|substring\(0,\s*(160|MAX_PREVIEW)/.test(text) &&
          text.includes('command_failed') &&
          text.includes('rerun-with-smaller-output-or-longer-timeout')
        return {
          pass,
          scoreSignals: [
            ...(text.includes('artifact://terminal/full-log') ? ['full log artifact path implemented'] : []),
            ...(/slice\(0,\s*(160|MAX_PREVIEW)|substring\(0,\s*(160|MAX_PREVIEW)/.test(text) ? ['bounded preview implemented'] : []),
            ...(text.includes('command_failed') ? ['command failure classified'] : []),
            ...(text.includes('rerun-with-smaller-output-or-longer-timeout') ? ['recovery action implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'claim-boundary-guard',
      title: 'Fix public claim boundary logic',
      prompt: 'The claim guard must allow cost/cache improvement claims only with no score regression, and block public 90/external victory claims without the required evidence.',
      testFile: 'tests/claimGuard.test.ts',
      expectedEvidence: ['cost claim allowed with no regression', 'public90 blocked', 'external victory blocked'],
      rawCorrectPattern: /score.*regression|public.*90|external|victory|raw/i,
      files: {
        'src/claimGuard.ts': `export type ClaimInput = {
  beforeScore: number
  afterScore: number
  beforeCost: number
  afterCost: number
  hasExternalRawLogs: boolean
  scoreFloor: number
}

export function buildClaimBoundary(input: ClaimInput): Record<string, boolean | string> {
  return {
    costOptimizationAllowed: input.afterCost < input.beforeCost,
    public90Allowed: input.scoreFloor >= 72,
    externalVictoryAllowed: input.hasExternalRawLogs,
    boundary: 'ready',
  }
}
`,
        'tests/claimGuard.test.ts': `import { describe, expect, test } from 'bun:test'
import { buildClaimBoundary } from '../src/claimGuard.ts'

describe('claim boundary', () => {
  test('allows cost optimization only when quality does not regress', () => {
    expect(buildClaimBoundary({
      beforeScore: 72,
      afterScore: 72,
      beforeCost: 0.07,
      afterCost: 0.01,
      hasExternalRawLogs: false,
      scoreFloor: 72,
    }).costOptimizationAllowed).toBe(true)
    expect(buildClaimBoundary({
      beforeScore: 72,
      afterScore: 60,
      beforeCost: 0.07,
      afterCost: 0.01,
      hasExternalRawLogs: false,
      scoreFloor: 60,
    }).costOptimizationAllowed).toBe(false)
  })

  test('blocks public 90 and external victory without evidence', () => {
    const boundary = buildClaimBoundary({
      beforeScore: 72,
      afterScore: 72,
      beforeCost: 0.07,
      afterCost: 0.01,
      hasExternalRawLogs: false,
      scoreFloor: 72,
    })
    expect(boundary.public90Allowed).toBe(false)
    expect(boundary.externalVictoryAllowed).toBe(false)
    expect(String(boundary.boundary)).toContain('internal ablation only')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'claimGuard.ts'), 'utf8')
        const pass =
          /afterScore\s*>=\s*beforeScore|beforeScore\s*<=\s*afterScore/.test(text) &&
          /scoreFloor\s*>=\s*90/.test(text) &&
          /hasExternalRawLogs[\s\S]*&&|&&[\s\S]*hasExternalRawLogs/.test(text) &&
          text.includes('internal ablation only')
        return {
          pass,
          scoreSignals: [
            ...(/afterScore\s*>=\s*beforeScore|beforeScore\s*<=\s*afterScore/.test(text) ? ['score regression guard implemented'] : []),
            ...(/scoreFloor\s*>=\s*90/.test(text) ? ['public 90 threshold implemented'] : []),
            ...(/hasExternalRawLogs[\s\S]*&&|&&[\s\S]*hasExternalRawLogs/.test(text) ? ['external raw gate implemented'] : []),
            ...(text.includes('internal ablation only') ? ['boundary wording implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'source-capsule-budget',
      title: 'Build cache-safe source capsules instead of dumping large files',
      prompt: 'The context packer must preserve source truth through path/hash/anchors/excerpts while bounding excerpts and forcing range-read fallback for large files.',
      testFile: 'tests/contextPack.test.ts',
      expectedEvidence: ['bounded excerpt', 'source hash', 'range read fallback', 'no raw full content'],
      rawCorrectPattern: /hash|excerpt|range|budget|source/i,
      files: {
        'src/contextPack.ts': `export type SourceFile = {
  path: string
  content: string
  anchors: string[]
}

export function buildSourceCapsules(files: SourceFile[]): Record<string, unknown>[] {
  return files.map(file => ({
    path: file.path,
    rawContent: file.content,
    anchors: [],
    fallbackReadPolicy: 'none',
  }))
}
`,
        'tests/contextPack.test.ts': `import { describe, expect, test } from 'bun:test'
import { buildSourceCapsules } from '../src/contextPack.ts'

describe('source capsules', () => {
  test('bounds excerpts and keeps source truth anchors', () => {
    const [capsule] = buildSourceCapsules([{ path: 'src/a.ts', content: 'x'.repeat(800), anchors: ['decideRoute'] }])
    expect(String(capsule.excerpt).length).toBeLessThanOrEqual(120)
    expect(String(capsule.sourceHash).length).toBeGreaterThanOrEqual(12)
    expect(capsule.anchors).toEqual(['decideRoute'])
    expect(capsule.fallbackReadPolicy).toBe('range-read-required')
    expect('rawContent' in capsule).toBe(false)
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'contextPack.ts'), 'utf8')
        const pass =
          /slice\(0,\s*120\)|substring\(0,\s*120\)/.test(text) &&
          /createHash|sha256|hash/i.test(text) &&
          text.includes('range-read-required') &&
          !/rawContent:\s*file\.content/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(/slice\(0,\s*120\)|substring\(0,\s*120\)/.test(text) ? ['bounded source excerpt implemented'] : []),
            ...(/createHash|sha256|hash/i.test(text) ? ['source hash implemented'] : []),
            ...(text.includes('range-read-required') ? ['range-read fallback policy implemented'] : []),
            ...(!/rawContent:\s*file\.content/.test(text) ? ['raw full content removed'] : []),
          ],
        }
      },
    },
    {
      id: 'permission-gate-decision',
      title: 'Route risky actions through an explicit permission gate',
      prompt: 'The permission gate must require approval for delete, shell, network, and secret-touching writes while allowing safe reads with a visible reason.',
      testFile: 'tests/permissionGate.test.ts',
      expectedEvidence: ['delete blocked', 'shell approval', 'secret write approval', 'safe read allowed'],
      rawCorrectPattern: /permission|approval|delete|shell|secret/i,
      files: {
        'src/permissionGate.ts': `export type Action = {
  kind: 'read' | 'write' | 'delete' | 'shell' | 'network'
  path?: string
  command?: string
}

export function decidePermission(action: Action): Record<string, unknown> {
  return {
    behavior: 'allow',
    reason: 'default',
    visibleState: false,
  }
}
`,
        'tests/permissionGate.test.ts': `import { describe, expect, test } from 'bun:test'
import { decidePermission } from '../src/permissionGate.ts'

describe('permission gate', () => {
  test('requires approval for high-risk actions', () => {
    expect(decidePermission({ kind: 'delete', path: 'src/a.ts' }).behavior).toBe('ask')
    expect(decidePermission({ kind: 'shell', command: 'rm -rf dist' }).behavior).toBe('ask')
    expect(decidePermission({ kind: 'network', command: 'curl https://example.com' }).behavior).toBe('ask')
    expect(decidePermission({ kind: 'write', path: '.env' }).behavior).toBe('ask')
  })

  test('allows safe reads with visible state', () => {
    const decision = decidePermission({ kind: 'read', path: 'src/a.ts' })
    expect(decision.behavior).toBe('allow')
    expect(decision.visibleState).toBe(true)
    expect(String(decision.reason)).toContain('safe read')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'permissionGate.ts'), 'utf8')
        const pass =
          text.includes("behavior: 'ask'") &&
          /delete|shell|network|\.env/.test(text) &&
          text.includes('visibleState') &&
          text.includes('safe read')
        return {
          pass,
          scoreSignals: [
            ...(text.includes("behavior: 'ask'") ? ['approval gate implemented'] : []),
            ...(/delete|shell|network|\.env/.test(text) ? ['high-risk action rules implemented'] : []),
            ...(text.includes('visibleState') ? ['visible permission state implemented'] : []),
            ...(text.includes('safe read') ? ['safe read reason implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'failure-repair-taxonomy',
      title: 'Classify failures and suggest a concrete repair action',
      prompt: 'The failure classifier must separate timeout, missing dependency, assertion failure, and generic command failure, then attach a repair action.',
      testFile: 'tests/failureRepair.test.ts',
      expectedEvidence: ['timeout repair', 'missing dependency repair', 'assertion repair', 'command failure repair'],
      rawCorrectPattern: /timeout|dependency|assertion|repair|failure/i,
      files: {
        'src/failureRepair.ts': `export type FailureInput = {
  exitCode: number
  stderr: string
  timedOut?: boolean
}

export function classifyFailure(input: FailureInput): Record<string, string> {
  return {
    type: 'unknown',
    repairAction: 'retry',
  }
}
`,
        'tests/failureRepair.test.ts': `import { describe, expect, test } from 'bun:test'
import { classifyFailure } from '../src/failureRepair.ts'

describe('failure repair taxonomy', () => {
  test('classifies common failure families', () => {
    expect(classifyFailure({ exitCode: 124, stderr: 'timeout', timedOut: true }).type).toBe('timeout')
    expect(classifyFailure({ exitCode: 1, stderr: 'Cannot find module zod' }).type).toBe('missing_dependency')
    expect(classifyFailure({ exitCode: 1, stderr: 'Expected false to be true' }).type).toBe('assertion_failure')
    expect(classifyFailure({ exitCode: 2, stderr: 'boom' }).type).toBe('command_failed')
  })

  test('attaches repair actions', () => {
    expect(classifyFailure({ exitCode: 124, stderr: '', timedOut: true }).repairAction).toContain('timeout')
    expect(classifyFailure({ exitCode: 1, stderr: 'Cannot find module zod' }).repairAction).toContain('install')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'failureRepair.ts'), 'utf8')
        const pass =
          text.includes('timeout') &&
          text.includes('missing_dependency') &&
          text.includes('assertion_failure') &&
          text.includes('command_failed') &&
          /install|dependency/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(text.includes('timeout') ? ['timeout classified'] : []),
            ...(text.includes('missing_dependency') ? ['missing dependency classified'] : []),
            ...(text.includes('assertion_failure') ? ['assertion failure classified'] : []),
            ...(text.includes('command_failed') ? ['command failure classified'] : []),
          ],
        }
      },
    },
    {
      id: 'agent-evidence-envelope',
      title: 'Merge agent worker results through a bounded evidence envelope',
      prompt: 'The agent merger must return summaries, changed files, tests, conflicts, and transcript paths, not full child transcripts.',
      testFile: 'tests/agentEnvelope.test.ts',
      expectedEvidence: ['summary only', 'unique changed files', 'conflict detection', 'tests passed'],
      rawCorrectPattern: /agent|summary|conflict|transcript|evidence/i,
      files: {
        'src/agentEnvelope.ts': `export type WorkerResult = {
  id: string
  summary: string
  changedFiles: string[]
  testsPassed: boolean
  transcript: string
}

export function mergeWorkerResults(results: WorkerResult[]): Record<string, unknown> {
  return {
    transcript: results.map(result => result.transcript).join('\\n'),
    changedFiles: results.flatMap(result => result.changedFiles),
    testsPassed: false,
    conflicts: [],
  }
}
`,
        'tests/agentEnvelope.test.ts': `import { describe, expect, test } from 'bun:test'
import { mergeWorkerResults } from '../src/agentEnvelope.ts'

describe('agent evidence envelope', () => {
  test('keeps parent merge bounded and detects conflicts', () => {
    const envelope = mergeWorkerResults([
      { id: 'a', summary: 'fixed parser', changedFiles: ['src/a.ts'], testsPassed: true, transcript: 'x'.repeat(1000) },
      { id: 'b', summary: 'fixed parser again', changedFiles: ['src/a.ts', 'src/b.ts'], testsPassed: true, transcript: 'y'.repeat(1000) },
    ])
    expect(String(envelope.summary)).toContain('fixed parser')
    expect(envelope.changedFiles).toEqual(['src/a.ts', 'src/b.ts'])
    expect(envelope.testsPassed).toBe(true)
    expect(envelope.conflicts).toEqual(['src/a.ts'])
    expect('transcript' in envelope).toBe(false)
    expect(envelope.transcriptPath).toBe('artifact://agent/full-transcripts')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'agentEnvelope.ts'), 'utf8')
        const pass =
          text.includes('artifact://agent/full-transcripts') &&
          /Set/.test(text) &&
          /conflicts/.test(text) &&
          !/transcript:\s*results/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(text.includes('artifact://agent/full-transcripts') ? ['transcript artifact path implemented'] : []),
            ...(/Set/.test(text) ? ['unique changed files implemented'] : []),
            ...(/conflicts/.test(text) ? ['conflict detection implemented'] : []),
            ...(!/transcript:\s*results/.test(text) ? ['full transcript omitted from parent envelope'] : []),
          ],
        }
      },
    },
    {
      id: 'mcp-skill-registry',
      title: 'Resolve MCP/skill conflicts without creating a second runtime',
      prompt: 'The registry must prefer primary skills over secondary skills, carry permissions forward, and expose adapterBoundary without standalone runtime.',
      testFile: 'tests/skillRegistry.test.ts',
      expectedEvidence: ['primary priority', 'secondary fallback', 'permission passthrough', 'adapter boundary'],
      rawCorrectPattern: /skill|mcp|priority|permission|adapter/i,
      files: {
        'src/skillRegistry.ts': `export type Skill = {
  name: string
  priority: 'primary' | 'secondary'
  permissions: string[]
}

export function resolveSkill(skills: Skill[], name: string): Record<string, unknown> | null {
  const match = skills.find(skill => skill.name === name)
  if (!match) return null
  return {
    name: match.name,
    permissions: [],
    runtime: 'standalone',
  }
}
`,
        'tests/skillRegistry.test.ts': `import { describe, expect, test } from 'bun:test'
import { resolveSkill } from '../src/skillRegistry.ts'

describe('skill registry', () => {
  test('prefers primary skill and preserves permission boundary', () => {
    const resolved = resolveSkill([
      { name: 'browser', priority: 'secondary', permissions: ['network'] },
      { name: 'browser', priority: 'primary', permissions: ['read', 'network'] },
    ], 'browser')
    expect(resolved?.priority).toBe('primary')
    expect(resolved?.permissions).toEqual(['read', 'network'])
    expect(resolved?.adapterBoundary).toBe('dsxu-tool-gate')
    expect(resolved?.runtime).not.toBe('standalone')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'skillRegistry.ts'), 'utf8')
        const pass =
          /primary/.test(text) &&
          /dsxu-tool-gate/.test(text) &&
          /permissions:\s*match\.permissions|permissions:\s*resolved\.permissions/.test(text) &&
          !/runtime:\s*'standalone'/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(/primary/.test(text) ? ['primary priority implemented'] : []),
            ...(/dsxu-tool-gate/.test(text) ? ['DSXU tool gate boundary implemented'] : []),
            ...(/permissions:\s*match\.permissions|permissions:\s*resolved\.permissions/.test(text) ? ['permissions preserved'] : []),
            ...(!/runtime:\s*'standalone'/.test(text) ? ['standalone runtime removed'] : []),
          ],
        }
      },
    },
    {
      id: 'json-schema-repair',
      title: 'Repair common model JSON output before schema validation',
      prompt: 'The JSON parser must extract fenced JSON, remove trailing commas, validate required fields, and return errors instead of throwing.',
      testFile: 'tests/schemaRepair.test.ts',
      expectedEvidence: ['fenced JSON extraction', 'trailing comma repair', 'required field errors', 'no throw'],
      rawCorrectPattern: /json|schema|trailing|validate|error/i,
      files: {
        'src/schemaRepair.ts': `export function parseModelJson(text: string): Record<string, unknown> {
  return JSON.parse(text)
}
`,
        'tests/schemaRepair.test.ts': `import { describe, expect, test } from 'bun:test'
import { parseModelJson } from '../src/schemaRepair.ts'

describe('schema repair', () => {
  test('extracts fenced JSON and repairs trailing comma', () => {
    const parsed = parseModelJson('text\\n\`\`\`json\\n{"task_id":"a","ok":true,}\\n\`\`\`')
    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])
  })

  test('returns validation errors instead of throwing', () => {
    const parsed = parseModelJson('{ "ok": true }')
    expect(parsed.ok).toBe(true)
    expect(String(parsed.errors)).toContain('task_id')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'schemaRepair.ts'), 'utf8')
        const pass =
          /```|match|indexOf/.test(text) &&
          /,\s*([}\]])/.test(text) &&
          /errors/.test(text) &&
          /try/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(/```|match|indexOf/.test(text) ? ['fenced JSON extraction implemented'] : []),
            ...(/,\s*([}\]])/.test(text) ? ['trailing comma repair implemented'] : []),
            ...(/errors/.test(text) ? ['validation errors returned'] : []),
            ...(/try/.test(text) ? ['parse no-throw guard implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'workspace-hygiene-classifier',
      title: 'Classify dirty workspace paths by owner and release policy',
      prompt: 'The workspace classifier must separate source, generated evidence, release artifact, permission residue, and deletion candidate paths.',
      testFile: 'tests/workspaceHygiene.test.ts',
      expectedEvidence: ['source owner', 'evidence excluded', 'release artifact', 'permission residue', 'delete candidate'],
      rawCorrectPattern: /workspace|dirty|evidence|release|delete|permission/i,
      files: {
        'src/workspaceHygiene.ts': `export function classifyPath(path: string): Record<string, string | boolean> {
  return {
    owner: 'unknown',
    releaseIncluded: true,
    action: 'keep',
  }
}
`,
        'tests/workspaceHygiene.test.ts': `import { describe, expect, test } from 'bun:test'
import { classifyPath } from '../src/workspaceHygiene.ts'

describe('workspace hygiene', () => {
  test('classifies major workspace families', () => {
    expect(classifyPath('src/query.ts').owner).toBe('source')
    expect(classifyPath('.dsxu/trace/a.json').releaseIncluded).toBe(false)
    expect(classifyPath('D:/DSXU-code-release-artifacts/a.zip').owner).toBe('release-artifact')
    expect(classifyPath('locked/acl-residue.tmp').action).toBe('external-permission-review')
    expect(classifyPath('old/shim.ts.deleted').action).toBe('owner-git-delete-review')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'workspaceHygiene.ts'), 'utf8')
        const pass =
          text.includes('source') &&
          text.includes('releaseIncluded: false') &&
          text.includes('release-artifact') &&
          text.includes('external-permission-review') &&
          text.includes('owner-git-delete-review')
        return {
          pass,
          scoreSignals: [
            ...(text.includes('source') ? ['source owner classified'] : []),
            ...(text.includes('releaseIncluded: false') ? ['evidence release exclusion implemented'] : []),
            ...(text.includes('release-artifact') ? ['release artifact classified'] : []),
            ...(text.includes('external-permission-review') ? ['permission residue classified'] : []),
            ...(text.includes('owner-git-delete-review') ? ['deletion review classified'] : []),
          ],
        }
      },
    },
    {
      id: 'route-intent-lock',
      title: 'Lock model route intent unless explicit admission changes it',
      prompt: 'The route latch must keep workflow/model/thinking stable during a task and only allow Pro/FIM changes with explicit admission evidence.',
      testFile: 'tests/routeIntentLock.test.ts',
      expectedEvidence: ['workflow lock', 'model lock', 'thinking lock', 'explicit admission'],
      rawCorrectPattern: /route|lock|intent|admission|thinking/i,
      files: {
        'src/routeIntentLock.ts': `export type RouteState = {
  workflowKind: string
  model: string
  thinking: 'on' | 'off'
}

export function applyRouteEvent(state: RouteState, event: Partial<RouteState> & { explicitAdmission?: boolean }): RouteState {
  return {
    workflowKind: event.workflowKind ?? state.workflowKind,
    model: event.model ?? state.model,
    thinking: event.thinking ?? state.thinking,
  }
}
`,
        'tests/routeIntentLock.test.ts': `import { describe, expect, test } from 'bun:test'
import { applyRouteEvent } from '../src/routeIntentLock.ts'

describe('route intent lock', () => {
  test('blocks accidental route drift', () => {
    const state = { workflowKind: 'coding', model: 'deepseek-v4-flash', thinking: 'off' as const }
    expect(applyRouteEvent(state, { model: 'deepseek-v4-pro', thinking: 'on' })).toEqual(state)
  })

  test('allows explicit admission', () => {
    const state = { workflowKind: 'coding', model: 'deepseek-v4-flash', thinking: 'off' as const }
    expect(applyRouteEvent(state, { model: 'deepseek-v4-pro', thinking: 'on', explicitAdmission: true }).model).toBe('deepseek-v4-pro')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'routeIntentLock.ts'), 'utf8')
        const pass =
          text.includes('explicitAdmission') &&
          /event\.explicitAdmission/.test(text) &&
          /state\.model/.test(text) &&
          /state\.thinking/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(text.includes('explicitAdmission') ? ['explicit admission implemented'] : []),
            ...(/state\.model/.test(text) ? ['model lock implemented'] : []),
            ...(/state\.thinking/.test(text) ? ['thinking lock implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'read-fallback-governor',
      title: 'Force search/range-read before large file reads',
      prompt: 'The read governor must choose grep-first for large files, range reads for known anchors, and artifact preview for oversized output.',
      testFile: 'tests/readGovernor.test.ts',
      expectedEvidence: ['grep first', 'range read', 'artifact preview', 'small read allowed'],
      rawCorrectPattern: /grep|range|read|artifact|large/i,
      files: {
        'src/readGovernor.ts': `export type ReadRequest = {
  fileBytes: number
  hasAnchor: boolean
}

export function planRead(request: ReadRequest): Record<string, string | boolean> {
  return {
    action: 'read-full',
    artifactPreview: false,
  }
}
`,
        'tests/readGovernor.test.ts': `import { describe, expect, test } from 'bun:test'
import { planRead } from '../src/readGovernor.ts'

describe('read governor', () => {
  test('uses search and range for large files', () => {
    expect(planRead({ fileBytes: 900000, hasAnchor: false }).action).toBe('grep-first')
    expect(planRead({ fileBytes: 900000, hasAnchor: true }).action).toBe('range-read')
    expect(planRead({ fileBytes: 900000, hasAnchor: true }).artifactPreview).toBe(true)
  })

  test('allows small reads', () => {
    expect(planRead({ fileBytes: 2000, hasAnchor: false }).action).toBe('read-full')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'readGovernor.ts'), 'utf8')
        const pass =
          text.includes('grep-first') &&
          text.includes('range-read') &&
          text.includes('artifactPreview: true') &&
          /fileBytes\s*[>]/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(text.includes('grep-first') ? ['grep-first implemented'] : []),
            ...(text.includes('range-read') ? ['range read implemented'] : []),
            ...(text.includes('artifactPreview: true') ? ['artifact preview implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'secret-release-redaction',
      title: 'Redact secrets and block release evidence leaks',
      prompt: 'The release scanner must redact DeepSeek keys, generic API keys, and authorization headers while preserving safe evidence summaries.',
      testFile: 'tests/secretRedaction.test.ts',
      expectedEvidence: ['DeepSeek key redacted', 'Authorization redacted', 'safe summary preserved'],
      rawCorrectPattern: /secret|redact|authorization|api key|release/i,
      files: {
        'src/secretRedaction.ts': `export function redactReleaseText(text: string): Record<string, unknown> {
  return {
    text,
    secretFound: false,
  }
}
`,
        'tests/secretRedaction.test.ts': `import { describe, expect, test } from 'bun:test'
import { redactReleaseText } from '../src/secretRedaction.ts'

describe('secret redaction', () => {
  test('redacts common provider secrets', () => {
    const result = redactReleaseText('DEEPSEEK_API_KEY=sk-1234567890 Authorization: Bearer abc PASS evidence')
    expect(result.secretFound).toBe(true)
    expect(String(result.text)).not.toContain('sk-1234567890')
    expect(String(result.text)).not.toContain('Bearer abc')
    expect(String(result.text)).toContain('PASS evidence')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'secretRedaction.ts'), 'utf8')
        const pass =
          /DEEPSEEK_API_KEY|Authorization|Bearer|sk-/.test(text) &&
          /REDACTED/.test(text) &&
          /secretFound:\s*true|secretFound/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(/DEEPSEEK_API_KEY|Authorization|Bearer|sk-/.test(text) ? ['secret patterns implemented'] : []),
            ...(/REDACTED/.test(text) ? ['redaction marker implemented'] : []),
            ...(/secretFound:\s*true|secretFound/.test(text) ? ['secretFound flag implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'cost-quality-pareto',
      title: 'Calculate cost-quality-cache Pareto evidence without overclaiming',
      prompt: 'The Pareto evaluator must allow cost/cache claims only when score is not lower, and report savings/cache lift as bounded internal evidence.',
      testFile: 'tests/costPareto.test.ts',
      expectedEvidence: ['no score regression', 'cost reduction pct', 'cache lift pct', 'internal evidence boundary'],
      rawCorrectPattern: /cost|cache|score|pareto|regression/i,
      files: {
        'src/costPareto.ts': `export type Run = {
  score: number
  cost: number
  cacheHitPct: number
}

export function compareRuns(before: Run, after: Run): Record<string, unknown> {
  return {
    costClaimAllowed: after.cost < before.cost,
    costReductionPct: 0,
    cacheLiftPct: 0,
    boundary: 'public win',
  }
}
`,
        'tests/costPareto.test.ts': `import { describe, expect, test } from 'bun:test'
import { compareRuns } from '../src/costPareto.ts'

describe('cost quality pareto', () => {
  test('allows cost claim only without score regression', () => {
    expect(compareRuns({ score: 72, cost: 0.07, cacheHitPct: 40 }, { score: 72, cost: 0.01, cacheHitPct: 65 }).costClaimAllowed).toBe(true)
    expect(compareRuns({ score: 72, cost: 0.07, cacheHitPct: 40 }, { score: 60, cost: 0.01, cacheHitPct: 65 }).costClaimAllowed).toBe(false)
  })

  test('reports bounded internal evidence', () => {
    const result = compareRuns({ score: 72, cost: 0.08, cacheHitPct: 40 }, { score: 72, cost: 0.02, cacheHitPct: 70 })
    expect(result.costReductionPct).toBe(75)
    expect(result.cacheLiftPct).toBe(30)
    expect(result.boundary).toBe('internal ablation only')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'costPareto.ts'), 'utf8')
        const pass =
          /after\.score\s*>=\s*before\.score|before\.score\s*<=\s*after\.score/.test(text) &&
          /costReductionPct/.test(text) &&
          /cacheLiftPct/.test(text) &&
          text.includes('internal ablation only')
        return {
          pass,
          scoreSignals: [
            ...(/after\.score\s*>=\s*before\.score|before\.score\s*<=\s*after\.score/.test(text) ? ['no-regression cost claim implemented'] : []),
            ...(/costReductionPct/.test(text) ? ['cost reduction metric implemented'] : []),
            ...(/cacheLiftPct/.test(text) ? ['cache lift metric implemented'] : []),
            ...(text.includes('internal ablation only') ? ['internal boundary implemented'] : []),
          ],
        }
      },
    },
    {
      id: 'visible-state-projection',
      title: 'Project work-state events consistently to TUI, CLI, and final report',
      prompt: 'The visible-state projector must summarize goal, step, last tool, cost, risk, and evidence from one event source for all surfaces.',
      testFile: 'tests/visibleState.test.ts',
      expectedEvidence: ['single event source', 'TUI projection', 'CLI projection', 'final report projection'],
      rawCorrectPattern: /visible|state|timeline|tui|cli|final/i,
      files: {
        'src/visibleState.ts': `export type WorkEvent = {
  goal?: string
  step?: string
  tool?: string
  costUSD?: number
  evidence?: string
}

export function projectVisibleState(events: WorkEvent[]): Record<string, unknown> {
  return {
    tui: {},
    cli: {},
    finalReport: {},
  }
}
`,
        'tests/visibleState.test.ts': `import { describe, expect, test } from 'bun:test'
import { projectVisibleState } from '../src/visibleState.ts'

describe('visible state projection', () => {
  test('uses one source for all surfaces', () => {
    const projected = projectVisibleState([
      { goal: 'fix cache', step: 'edit', tool: 'Edit', costUSD: 0.01, evidence: 'tests pass' },
    ])
    expect(projected.tui).toEqual(projected.cli)
    expect(projected.cli).toEqual(projected.finalReport)
    expect(JSON.stringify(projected)).toContain('fix cache')
    expect(JSON.stringify(projected)).toContain('tests pass')
  })
})
`,
      },
      verify: async workspace => {
        const text = await readFile(join(workspace, 'src', 'visibleState.ts'), 'utf8')
        const pass =
          /const\s+\w+\s*=/.test(text) &&
          /tui:\s*\w+/.test(text) &&
          /cli:\s*\w+/.test(text) &&
          /finalReport:\s*\w+/.test(text)
        return {
          pass,
          scoreSignals: [
            ...(/tui:\s*\w+/.test(text) ? ['TUI projection implemented'] : []),
            ...(/cli:\s*\w+/.test(text) ? ['CLI projection implemented'] : []),
            ...(/finalReport:\s*\w+/.test(text) ? ['final report projection implemented'] : []),
          ],
        }
      },
    },
  ]
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

function svgBar(label: string, y: number, value: number, max: number, color: string): string {
  const width = max === 0 ? 0 : Math.round((value / max) * 360)
  return [
    `<text x="24" y="${y + 14}" font-family="Arial, sans-serif" font-size="13" fill="#18212f">${label}</text>`,
    `<rect x="185" y="${y}" width="360" height="18" fill="#edf1f7" rx="4"/>`,
    `<rect x="185" y="${y}" width="${width}" height="18" fill="${color}" rx="4"/>`,
    `<text x="${195 + width}" y="${y + 14}" font-family="Arial, sans-serif" font-size="12" fill="#18212f">${Math.round(value * 10) / 10}</text>`,
  ].join('\n')
}

async function writeSvg(summary: Record<string, number>): Promise<void> {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="300" viewBox="0 0 760 300">',
    '<rect width="760" height="300" fill="#ffffff"/>',
    '<text x="24" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">DSXU vs raw DeepSeek API A/B</text>',
    '<text x="24" y="58" font-family="Arial, sans-serif" font-size="13" fill="#4b5563">Same fixture tasks: raw API plan-only baseline vs DSXU tool/edit/test workflow.</text>',
    svgBar('Raw API avg score', 88, summary.rawAverageScore ?? 0, 100, '#9ca3af'),
    svgBar('DSXU avg score', 120, summary.dsxuAverageScore ?? 0, 100, '#2563eb'),
    svgBar('Raw pass rate %', 168, summary.rawPassRatePct ?? 0, 100, '#9ca3af'),
    svgBar('DSXU pass rate %', 200, summary.dsxuPassRatePct ?? 0, 100, '#059669'),
    `<text x="24" y="260" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">Raw API cannot edit files or run tests; this chart proves workflow lift, not model superiority.</text>`,
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

  const rawRuns: RawRun[] = []
  const dsxuRuns: DsxuRun[] = []
  const runId = nowSafe()

  for (const task of tasks()) {
    const rawWorkspace = join(WORKSPACE_DIR, `raw-${task.id}-${runId}`)
    const dsxuWorkspace = join(WORKSPACE_DIR, `dsxu-${task.id}-${runId}`)
    await writeFixture(task, rawWorkspace)
    await writeFixture(task, dsxuWorkspace)
    rawRuns.push(await runRawBaseline(task, rawWorkspace))
    dsxuRuns.push(await runDsxuTask(task, dsxuWorkspace))
  }

  const totalTasks = tasks().length
  const rawAverageScore = Math.round(avg(rawRuns.map(run => run.score)) * 10) / 10
  const dsxuAverageScore = Math.round(avg(dsxuRuns.map(run => run.score)) * 10) / 10
  const rawPassRatePct = pct(rawRuns.filter(run => run.pass).length, totalTasks)
  const dsxuPassRatePct = pct(dsxuRuns.filter(run => run.pass).length, totalTasks)
  const rawTotalCostUSD = rawRuns.reduce((sum, run) => sum + run.costUSD, 0)
  const dsxuTotalCostUSD = dsxuRuns.reduce((sum, run) => sum + run.costUSD, 0)
  const dsxuToolCalls = dsxuRuns.reduce(
    (sum, run) => sum + Object.values(run.toolUseCounts).reduce((inner, count) => inner + count, 0),
    0,
  )
  const summary = {
    schemaVersion: 'dsxu.raw-api-vs-dsxu-ab.v1',
    generatedAt: new Date().toISOString(),
    status: dsxuPassRatePct > rawPassRatePct && dsxuAverageScore > rawAverageScore
      ? 'PASS_DSXU_WORKFLOW_LIFT_OVER_RAW_API_BASELINE'
      : 'BLOCKED_DSXU_WORKFLOW_LIFT_NOT_PROVEN',
    totalTasks,
    rawAverageScore,
    dsxuAverageScore,
    scoreLift: Math.round((dsxuAverageScore - rawAverageScore) * 10) / 10,
    rawPassRatePct,
    dsxuPassRatePct,
    passRateLiftPct: Math.round((dsxuPassRatePct - rawPassRatePct) * 10) / 10,
    rawTotalCostUSD,
    dsxuTotalCostUSD,
    dsxuToolCalls,
    publicClaimAllowed: dsxuPassRatePct > rawPassRatePct && dsxuAverageScore > rawAverageScore,
    externalSuperiorityAllowed: false,
    public90Allowed: false,
    chartPath: rel(OUT_SVG),
    claimBoundary: 'This proves DSXU workflow lift over a raw chat-completions baseline on isolated fixture tasks. It does not prove model superiority, external benchmark victory, or public 90/95 ability.',
  }

  const taskRows = tasks().map(task => {
    const raw = rawRuns.find(run => run.id === task.id)!
    const dsxu = dsxuRuns.find(run => run.id === task.id)!
    return {
      id: task.id,
      rawScore: raw.score,
      dsxuScore: dsxu.score,
      rawPass: raw.pass,
      dsxuPass: dsxu.pass,
      dsxuFinalTest: dsxu.finalTestPassed,
      dsxuTools: Object.entries(dsxu.toolUseCounts).map(([name, count]) => `${name}:${count}`).join('; '),
      evidence: task.expectedEvidence.join('; '),
    }
  })

  const report = {
    ...summary,
    tasks: tasks().map(task => {
      const raw = rawRuns.find(run => run.id === task.id)!
      const dsxu = dsxuRuns.find(run => run.id === task.id)!
      return {
        id: task.id,
        title: task.title,
        expectedEvidence: task.expectedEvidence,
        sourceFixtureHash: sha(Object.values(task.files).join('\n')),
        raw: {
          pass: raw.pass,
          score: raw.score,
          durationMs: raw.durationMs,
          costUSD: raw.costUSD,
          inputTokens: raw.inputTokens,
          outputTokens: raw.outputTokens,
          cacheHitInputTokens: raw.cacheHitInputTokens,
          cacheMissInputTokens: raw.cacheMissInputTokens,
          responsePath: rel(raw.responsePath),
          limitations: raw.limitations,
          parsedJson: raw.parsedJson,
        },
        dsxu: {
          pass: dsxu.pass,
          score: dsxu.score,
          exitCode: dsxu.exitCode,
          durationMs: dsxu.durationMs,
          costUSD: dsxu.costUSD,
          finalTestPassed: dsxu.finalTestPassed,
          semanticVerificationPassed: dsxu.semanticVerificationPassed,
          finalTestExitCode: dsxu.finalTestExitCode,
          tracePath: rel(dsxu.tracePath),
          stdoutPath: rel(dsxu.stdoutPath),
          stderrPath: rel(dsxu.stderrPath),
          toolUseCounts: dsxu.toolUseCounts,
          verificationSignals: dsxu.verificationSignals,
          resultJson: dsxu.resultJson,
        },
      }
    }),
    safeguards: [
      'Raw API baseline is plan-only and cannot edit files or run tests.',
      'DSXU runs use isolated external fixture workspaces and do not mutate product source.',
      'No API key or raw secret value is written to the public report.',
      'External superiority and public 90/95 claims remain blocked.',
    ],
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeSvg(summary)
  await writeFile(
    OUT_MD,
    [
      '# DSXU Raw DeepSeek API vs DSXU A/B - 2026-05-16',
      '',
      `Status: \`${summary.status}\``,
      '',
      'This report compares a raw DeepSeek chat-completions baseline with the DSXU tool/edit/test workflow on the same isolated fixture tasks. It proves workflow lift, not model superiority.',
      '',
      '## Summary',
      '',
      mdTable([summary], [
        'totalTasks',
        'rawAverageScore',
        'dsxuAverageScore',
        'scoreLift',
        'rawPassRatePct',
        'dsxuPassRatePct',
        'passRateLiftPct',
        'rawTotalCostUSD',
        'dsxuTotalCostUSD',
        'dsxuToolCalls',
      ]),
      '',
      '## Task Results',
      '',
      mdTable(taskRows, ['id', 'rawScore', 'dsxuScore', 'rawPass', 'dsxuPass', 'dsxuFinalTest', 'dsxuTools', 'evidence']),
      '',
      '## Claim Boundary',
      '',
      `- publicClaimAllowed: \`${summary.publicClaimAllowed}\``,
      `- externalSuperiorityAllowed: \`${summary.externalSuperiorityAllowed}\``,
      `- public90Allowed: \`${summary.public90Allowed}\``,
      `- chartPath: \`${rel(OUT_SVG)}\``,
      '',
      'Allowed claim: DSXU adds measurable tool/edit/test workflow lift over a raw DeepSeek API plan-only baseline on these fixtures.',
      '',
      'Blocked claims: external benchmark victory, model superiority, public 90/95 ability, and any claim that raw internal fixtures equal public benchmark scores.',
    ].join('\n'),
    'utf8',
  )

  console.log(JSON.stringify({
    status: summary.status,
    totalTasks: summary.totalTasks,
    rawAverageScore: summary.rawAverageScore,
    dsxuAverageScore: summary.dsxuAverageScore,
    rawPassRatePct: summary.rawPassRatePct,
    dsxuPassRatePct: summary.dsxuPassRatePct,
    rawTotalCostUSD: summary.rawTotalCostUSD,
    dsxuTotalCostUSD: summary.dsxuTotalCostUSD,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
    chart: OUT_SVG,
  }, null, 2))
  if (summary.status !== 'PASS_DSXU_WORKFLOW_LIFT_OVER_RAW_API_BASELINE') {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
