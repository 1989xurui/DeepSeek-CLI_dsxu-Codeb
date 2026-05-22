import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type CommandRun = {
  id: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutPath: string
  stderrPath: string
  stdout: string
  stderr: string
  attribution: FailureAttribution
}

type DsxuRun = CommandRun & {
  tracePath: string
  resultJson: Record<string, unknown> | null
  modelUsage: Record<string, unknown> | null
  costUSD: number
  toolUseCounts: Record<string, number>
}

type FailureAttribution = {
  owner: string
  rootCause: string
  nextAction: string
  timedOut: boolean
  signal: string
}

const ROOT = process.cwd()
const DATE = '20260515'
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-senior-coding-window')
const FIXTURE_DIR = join(ROOT, 'tmp', 'v24-senior-coding-window')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_SENIOR_CODING_WINDOW_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_SENIOR_CODING_WINDOW_${DATE}.md`)
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const WORKSPACE_DIR = join(FIXTURE_DIR, `workspace-${RUN_ID}`)
const MIN_WINDOW_MS = 30 * 60 * 1000
const MAX_WINDOW_MS = 45 * 60 * 1000

type ReviewFocus = {
  focus: string
  files: string[]
  reviewQuestion: string
}

const REVIEW_FOCUSES: ReviewFocus[] = [
  {
    focus: 'query loop goal retention and single-pass execution',
    files: [
      'docs/DSXU_V24_EXECUTION_PLAN_20260515.md',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/query-loop-gate-state-v1.ts',
      'src/dsxu/engine/forked-agent.ts',
    ],
    reviewQuestion: 'Check whether the query loop preserves the user goal, exposes completion/exit evidence, and avoids spinning after tests pass.',
  },
  {
    focus: 'Tool Gate and Permission Gate behavior',
    files: [
      'docs/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.md',
      'src/dsxu/engine/tool-registry.ts',
      'src/dsxu/engine/permissions.ts',
      'src/dsxu/engine/permission-prompt-v1.ts',
    ],
    reviewQuestion: 'Check whether side-effecting tool execution reaches DSXU Tool Gate / Permission Gate evidence and whether any path is metadata-only.',
  },
  {
    focus: 'DeepSeek Flash-first model/cost/cache discipline',
    files: [
      'docs/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.md',
      'src/utils/model/deepseekV4Control.ts',
      'src/utils/model/deepseekV4CostRouter.ts',
      'src/services/api/deepseek-adapter.ts',
      'src/dsxu/engine/deepseek-cost-quality-board.ts',
    ],
    reviewQuestion: 'Check Flash-first routing, Flash-MAX/Pro admission evidence, cache-cost accounting, and whether public claims stay bounded.',
  },
  {
    focus: 'Agent/MCP/Skill registry ownership',
    files: [
      'docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md',
      'src/dsxu/engine/tool-registry.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/agent-mcp-skill-boundary-board.ts',
    ],
    reviewQuestion: 'Check whether Agent/MCP/Skill capability is owned by DSXU registry and evidence envelope rather than a standalone runtime.',
  },
  {
    focus: 'TUI visible work-state and recovery evidence',
    files: [
      'docs/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md',
      'src/screens/REPL.tsx',
      'src/dsxu/integration/harness/real-tui-harness.ts',
      'src/utils/conversationRecovery.ts',
    ],
    reviewQuestion: 'Check whether goal, permission, recovery, cost, and progress are projected from real work-state rather than decorative UI state.',
  },
  {
    focus: 'release surface and clean export boundary',
    files: [
      'docs/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.md',
      'docs/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.md',
      'scripts/dsxu-v24-clean-export-artifact.ts',
      'package.json',
    ],
    reviewQuestion: 'Check whether release/export evidence excludes secrets, internal evidence, brand risk, and unsupported public claims.',
  },
]

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function tail(text: string, max = 800): string {
  return text.length <= max ? text : text.slice(-max)
}

function ownerForRun(id: string, command: string[]): string {
  const commandText = command.join(' ')
  if (id.includes('fixture') || commandText.includes('bun test')) {
    return 'Code-mode repair / Verification owner'
  }
  if (id.includes('sustained-review')) {
    return 'Senior experience / Source review owner'
  }
  if (commandText.includes('dsxu-code.tsx')) {
    return 'Query loop / DeepSeek runtime owner'
  }
  return 'Senior coding acceptance owner'
}

function classifyCommandRun(id: string, command: string[], exitCode: number, stdout: string, stderr: string): FailureAttribution {
  const owner = ownerForRun(id, command)
  if (exitCode === 0) {
    return {
      owner,
      rootCause: 'passed',
      nextAction: 'keep as senior-coding-window evidence',
      timedOut: false,
      signal: 'exitCode=0',
    }
  }

  const combined = `${stdout}\n${stderr}`
  const lower = combined.toLowerCase()
  const timedOut = exitCode === 124
  if (timedOut) {
    return {
      owner,
      rootCause: 'command-timeout',
      nextAction: 'inspect trace progress; split the review/fix round or raise only this command budget if it is still making progress',
      timedOut,
      signal: tail(combined),
    }
  }
  if (/error_max_turns|maximum number of turns|max[- ]turns|reached maximum/i.test(combined)) {
    return {
      owner,
      rootCause: 'bounded-review-max-turns',
      nextAction: 'tighten the source review pack with bounded line ranges or raise only the review turn budget; do not classify this as provider failure',
      timedOut,
      signal: tail(combined),
    }
  }
  if (/api key|apikey|auth|unauthori[sz]ed|quota|rate limit|429|401|403/.test(lower)) {
    return {
      owner,
      rootCause: 'provider-auth-or-quota',
      nextAction: 'run provider doctor with redacted evidence before repeating the live window',
      timedOut,
      signal: tail(combined),
    }
  }
  if (/permission denied|eacces|access is denied|operation not permitted/.test(lower)) {
    return {
      owner,
      rootCause: 'permission-or-workspace-access',
      nextAction: 'route the action through Permission Gate or use an isolated writable fixture',
      timedOut,
      signal: tail(combined),
    }
  }
  if (/cannot find module|module not found|enoent|no such file|not recognized as/.test(lower)) {
    return {
      owner,
      rootCause: 'missing-command-or-fixture-path',
      nextAction: 'repair the fixture/script path before rerunning the senior window',
      timedOut,
      signal: tail(combined),
    }
  }
  if (/fail|failed|error|assertion|expected|received|not ok/.test(lower)) {
    return {
      owner,
      rootCause: 'fixture-or-dsxu-run-regression',
      nextAction: 'fix the fixture repair loop or DSXU run result; keep the failing trace as recovery evidence',
      timedOut,
      signal: tail(combined),
    }
  }
  return {
    owner,
    rootCause: 'nonzero-exit-without-known-pattern',
    nextAction: 'inspect stdout/stderr artifacts and add a narrower owner attribution rule if this repeats',
    timedOut,
    signal: tail(combined),
  }
}

function reviewFileInstruction(file: string): string {
  const fullPath = join(ROOT, file)
  const boundedRanges: Record<string, string[]> = {
    'src/screens/REPL.tsx': [
      'offset=1580 limit=140 for trust-state/system-message projection',
      'offset=3420 limit=110 for stream message handling',
      'offset=5200 limit=140 for prompt/footer rendering area',
    ],
    'src/dsxu/engine/query-loop.ts': [
      'offset=680 limit=120 for progress-ledger setup',
      'offset=1080 limit=130 for exit-result construction',
      'offset=1660 limit=110 for verification/recovery loop behavior',
    ],
    'src/dsxu/integration/harness/real-tui-harness.ts': [
      'offset=430 limit=120 for visible-state detection',
      'offset=720 limit=120 for resize/trust proof assertions',
      'offset=880 limit=90 for final result fields',
    ],
    'src/services/api/deepseek-adapter.ts': [
      'offset=680 limit=170 for usage normalization and cost/cache accounting',
      'offset=760 limit=210 for route-plan request execution',
    ],
  }
  const ranges = boundedRanges[file]
  if (!ranges) return `- ${fullPath}`
  return [
    `- ${fullPath}`,
    '  Large file: do not attempt a full-file Read.',
    ...ranges.map(range => `  - Read ${range}.`),
  ].join('\n')
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
  const timeout = new Promise<number>(resolve => {
    timer = setTimeout(() => {
      proc.kill()
      resolve(124)
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
    const attribution = classifyCommandRun(id, command, exitCode, stdout, stderr)
    return {
      id,
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      stdoutPath,
      stderrPath,
      stdout,
      stderr,
      attribution,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseMarkdownJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const candidates: string[] = []
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  candidates.push(trimmed)
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      try {
        const windowsPathSafeCandidate = candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        return JSON.parse(windowsPathSafeCandidate) as Record<string, unknown>
      } catch {
        // Try the next candidate.
      }
    }
  }
  return null
}

function parseStreamJson(text: string): {
  resultJson: Record<string, unknown> | null
  modelUsage: Record<string, unknown> | null
  costUSD: number
  toolUseCounts: Record<string, number>
} {
  let resultJson: Record<string, unknown> | null = null
  let lastAssistantJson: Record<string, unknown> | null = null
  let modelUsage: Record<string, unknown> | null = null
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
        if (event.modelUsage && typeof event.modelUsage === 'object') {
          modelUsage = event.modelUsage as Record<string, unknown>
        }
      }
    } catch {
      // Raw trace remains authoritative.
    }
  }
  return {
    resultJson: resultJson ?? lastAssistantJson,
    modelUsage,
    costUSD,
    toolUseCounts,
  }
}

async function runDsxu(input: {
  id: string
  prompt: string
  tools: string
  maxTurns: number
  timeoutMs: number
}): Promise<DsxuRun> {
  const tracePath = join(TRACE_DIR, `${input.id}-${nowSafe()}.jsonl`)
  const run = await runCommand(input.id, [
    'bun',
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    '-p',
    '--verbose',
    '--model',
    'deepseek-v4-flash',
    '--max-turns',
    String(input.maxTurns),
    '--output-format',
    'stream-json',
    '--tools',
    input.tools,
    '--permission-mode',
    'bypassPermissions',
    '--dangerously-skip-permissions',
    input.prompt,
  ], { timeoutMs: input.timeoutMs })
  const combined = run.stdout + run.stderr
  await writeFile(tracePath, combined, 'utf8')
  const parsed = parseStreamJson(combined)
  return {
    ...run,
    tracePath,
    resultJson: parsed.resultJson,
    modelUsage: parsed.modelUsage,
    costUSD: parsed.costUSD,
    toolUseCounts: parsed.toolUseCounts,
  }
}

async function createFixtureWorkspace(): Promise<void> {
  await mkdir(join(WORKSPACE_DIR, 'src'), { recursive: true })
  await mkdir(join(WORKSPACE_DIR, 'tests'), { recursive: true })
  await writeFile(join(WORKSPACE_DIR, 'package.json'), `${JSON.stringify({
    type: 'module',
    scripts: {
      test: 'bun test',
    },
    devDependencies: {},
  }, null, 2)}\n`, 'utf8')
  await writeFile(join(WORKSPACE_DIR, 'src', 'seniorRouter.ts'), `export type TaskRisk = 'low' | 'medium' | 'high' | 'critical'

export type TaskInput = {
  id: string
  risk: TaskRisk
  estimatedTokens: number
  needsLongContext?: boolean
  flashFailed?: boolean
  userVisible?: boolean
}

export type RouteDecision = {
  model: 'deepseek-v4-flash' | 'deepseek-v4-flash-max' | 'deepseek-v4-pro'
  reason: string
  requiresEvidence: boolean
}

export type WorkEvent = {
  type: 'read' | 'edit' | 'test' | 'failure' | 'recovery' | 'final'
  message: string
  costUSD?: number
}

export function routeTask(task: TaskInput): RouteDecision {
  if (task.risk === 'critical') {
    return { model: 'deepseek-v4-pro', reason: 'critical task', requiresEvidence: true }
  }
  if (task.needsLongContext || task.estimatedTokens > 120000) {
    return { model: 'deepseek-v4-pro', reason: 'large context', requiresEvidence: true }
  }
  return { model: 'deepseek-v4-flash', reason: 'default low cost route', requiresEvidence: false }
}

export function summarizeWork(events: WorkEvent[]): string {
  const cost = events.reduce((sum, event) => sum + (event.costUSD ?? 0), 0)
  const failures = events.filter(event => event.type === 'failure').length
  const recoveries = events.filter(event => event.type === 'recovery').length
  return \`events=\${events.length};failures=\${failures};recoveries=\${recoveries};cost=\${cost.toFixed(4)}\`
}

export function buildVisibleState(events: WorkEvent[]): string[] {
  return events.map(event => event.message)
}
`, 'utf8')
  await writeFile(join(WORKSPACE_DIR, 'tests', 'seniorRouter.test.ts'), `import { describe, expect, test } from 'bun:test'
import { buildVisibleState, routeTask, summarizeWork, type WorkEvent } from '../src/seniorRouter.ts'

describe('senior coding router fixture', () => {
  test('keeps simple work on flash with evidence visible', () => {
    const decision = routeTask({ id: 'simple', risk: 'low', estimatedTokens: 9000, userVisible: true })
    expect(decision).toEqual({
      model: 'deepseek-v4-flash',
      reason: 'flash-first default for low-risk work',
      requiresEvidence: true,
    })
  })

  test('uses flash-max for long context before pro', () => {
    const decision = routeTask({ id: 'large', risk: 'medium', estimatedTokens: 180000, needsLongContext: true })
    expect(decision.model).toBe('deepseek-v4-flash-max')
    expect(decision.reason).toContain('long context')
    expect(decision.requiresEvidence).toBe(true)
  })

  test('uses pro only after flash failure or critical risk', () => {
    expect(routeTask({ id: 'rescue', risk: 'high', estimatedTokens: 20000, flashFailed: true }).model).toBe('deepseek-v4-pro')
    expect(routeTask({ id: 'critical', risk: 'critical', estimatedTokens: 20000 }).model).toBe('deepseek-v4-pro')
    expect(routeTask({ id: 'high-no-fail', risk: 'high', estimatedTokens: 20000 }).model).toBe('deepseek-v4-flash')
  })

  test('summary preserves failures, recovery, and cost', () => {
    const events: WorkEvent[] = [
      { type: 'read', message: 'read source' },
      { type: 'failure', message: 'test failed', costUSD: 0.002 },
      { type: 'recovery', message: 'patched route', costUSD: 0.003 },
      { type: 'test', message: 'test passed', costUSD: 0.001 },
    ]
    expect(summarizeWork(events)).toBe('events=4;failures=1;recoveries=1;cost=0.0060;status=recovered')
  })

  test('visible state includes typed status prefixes', () => {
    const visible = buildVisibleState([
      { type: 'read', message: 'source opened' },
      { type: 'edit', message: 'route patched' },
      { type: 'final', message: 'done' },
    ])
    expect(visible).toEqual(['READ: source opened', 'EDIT: route patched', 'FINAL: done'])
  })
})
`, 'utf8')
}

function codingPrompt(): string {
  return [
    'DSXU V24 real senior-coding window. Work in this isolated fixture only:',
    WORKSPACE_DIR,
    'Goal: make the fixture tests pass by reading source/tests, identifying the model-routing and visible-state bugs, editing source, and running verification.',
    'Constraints:',
    '- Default route discipline is Flash-first. Pro is allowed only after flash failure or critical risk.',
    '- Do not edit files outside the fixture workspace.',
    '- Do not create docs. Change source/tests only if needed.',
    '- Use Read before Edit or Write.',
    '- Run `bun test` in the fixture before and after the fix. Preserve failure evidence and recovery evidence.',
    '- If the first verification fails, diagnose from the failure and make one focused recovery edit.',
    'Return JSON only with fields:',
    '{"did_read_source":boolean,"did_read_tests":boolean,"did_run_failing_test":boolean,"did_edit_source":boolean,"did_run_passing_test":boolean,"files_changed":[string],"failure_recovery_summary":string,"final_status":"PASS"|"PARTIAL"|"FAIL","next_risk":[string]}.',
  ].join(' ')
}

function reviewPrompt(round: number, review: ReviewFocus): string {
  const fileList = review.files
    .map(reviewFileInstruction)
    .join('\n')
  return [
    `DSXU V24 senior-coding sustained review round ${round + 1}.`,
    `Focus: ${review.focus}.`,
    review.reviewQuestion,
    'This is a bounded source-truth review. Read only the files and ranges listed below; do not broaden discovery and do not search the repository.',
    fileList,
    'Do not edit files in this review round.',
    'Read the files sequentially in the listed order. For large-file instructions, use the listed offset/limit ranges and never retry a full-file Read after a size-limit error.',
    'Do not call parallel tools; this avoids the execution-visibility gate and keeps the review deterministic.',
    'Stop after the bounded file pack is read or after six Read attempts, whichever comes first. Missing facts go into blocking_gap; do not spend turns trying to prove them.',
    'Use slash-normalized paths such as D:/DSXU-code/path in JSON strings. Do not use raw Windows backslashes in JSON output.',
    'Use at most one pass over the file pack. If a fact is missing, put it in blocking_gap instead of using extra tools.',
    'After the bounded Read pass, return a JSON object immediately. Do not include headings, markdown, tables, commentary, or fenced code blocks.',
    'Return JSON only with fields:',
    '{"focus":string,"did_read_source":boolean,"did_read_evidence":boolean,"senior_experience_signal":boolean,"blocking_gap":[string],"evidence":[string],"pro_needed":false}.',
    'Use Flash-first only. Keep claims strict: this does not replace the 30-45 minute coding window unless the window duration is actually satisfied.',
  ].join(' ')
}

async function finalVerification(): Promise<CommandRun> {
  return runCommand('fixture-final-bun-test', ['bun', 'test'], {
    cwd: WORKSPACE_DIR,
    timeoutMs: 180_000,
  })
}

function sumCosts(runs: DsxuRun[]): number {
  return runs.reduce((sum, run) => sum + run.costUSD, 0)
}

function mergeToolUseCounts(runs: DsxuRun[]): Record<string, number> {
  const merged: Record<string, number> = {}
  for (const run of runs) {
    for (const [tool, count] of Object.entries(run.toolUseCounts)) {
      merged[tool] = (merged[tool] ?? 0) + count
    }
  }
  return merged
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean' || value === 'true' || value === 'false'
}

function reviewRunHasStructuredEvidence(run: DsxuRun): boolean {
  const result = run.resultJson
  return Boolean(
    result &&
    typeof result.focus === 'string' &&
    isTrue(result.did_read_source) &&
    isBoolean(result.did_read_evidence) &&
    isBoolean(result.senior_experience_signal) &&
    result.pro_needed === false &&
    isStringArray(result.blocking_gap) &&
    isStringArray(result.evidence) &&
    result.evidence.length > 0,
  )
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })
  await createFixtureWorkspace()

  const startedAt = Date.now()
  const initialFailingTest = await runCommand('fixture-initial-bun-test', ['bun', 'test'], {
    cwd: WORKSPACE_DIR,
    timeoutMs: 180_000,
  })
  const runs: DsxuRun[] = []

  runs.push(await runDsxu({
    id: 'senior-coding-fix-fixture',
    prompt: codingPrompt(),
    tools: 'Read,Edit,Write,Bash,Glob,Grep',
    maxTurns: 24,
    timeoutMs: 1_200_000,
  }))

  let finalTest = await finalVerification()
  if (finalTest.exitCode !== 0) {
    runs.push(await runDsxu({
      id: 'senior-coding-recovery-fixture',
      prompt: [
        'DSXU V24 senior-coding recovery round.',
        `The fixture still fails. Work only in ${WORKSPACE_DIR}.`,
        `Read the failing test output at ${finalTest.stdoutPath} and ${finalTest.stderrPath}, then read source/tests, make one focused repair, and rerun bun test.`,
        'Return JSON only with fields {"did_read_failure":boolean,"did_edit_source":boolean,"did_run_passing_test":boolean,"final_status":"PASS"|"PARTIAL"|"FAIL","evidence":[string],"next_risk":[string]}.',
      ].join(' '),
      tools: 'Read,Edit,Write,Bash,Glob,Grep',
      maxTurns: 18,
      timeoutMs: 1_000_000,
    }))
    finalTest = await finalVerification()
  }

  let round = 0
  while (Date.now() - startedAt < MIN_WINDOW_MS && Date.now() - startedAt < MAX_WINDOW_MS) {
    const review = REVIEW_FOCUSES[round % REVIEW_FOCUSES.length]
    runs.push(await runDsxu({
      id: `senior-coding-sustained-review-${String(round + 1).padStart(2, '0')}`,
      prompt: reviewPrompt(round, review),
      tools: 'Read',
      maxTurns: 12,
      timeoutMs: 300_000,
    }))
    round += 1
  }

  const elapsedMs = Date.now() - startedAt
  const finalTestPassed = finalTest.exitCode === 0
  const initialFailureCaptured = initialFailingTest.exitCode !== 0
  const codingRun = runs[0]
  const codingResult = codingRun?.resultJson ?? {}
  const didEdit = isTrue(codingResult.did_edit_source) || (codingRun?.toolUseCounts.Edit ?? 0) > 0
  const didRunPassingTest =
    isTrue(codingResult.did_run_passing_test) ||
    finalTestPassed ||
    /\b0 fail\b/i.test(codingRun?.stdout ?? '')
  const continuousWindowSatisfied = elapsedMs >= MIN_WINDOW_MS && elapsedMs <= MAX_WINDOW_MS + 60_000
  const reviewRuns = runs.filter(run => run.id.startsWith('senior-coding-sustained-review-'))
  const requiredProductRuns = runs.filter(run =>
    run.id === 'senior-coding-fix-fixture' ||
    run.id === 'senior-coding-recovery-fixture'
  )
  const failedReviewRuns = reviewRuns.filter(run => run.exitCode !== 0 || !reviewRunHasStructuredEvidence(run))
  const failedProductRuns = requiredProductRuns.filter(run => run.exitCode !== 0)
  const failedCommandRuns = [
    initialFailingTest.exitCode === 0 ? {
      ...initialFailingTest,
      attribution: {
        owner: 'Code-mode repair / Verification owner',
        rootCause: 'fixture-did-not-start-red',
        nextAction: 'repair the acceptance fixture so senior-coding-window proves failure-to-fix, not just green-path execution',
        timedOut: false,
        signal: 'initial fixture test unexpectedly passed',
      },
    } : null,
    finalTest.exitCode === 0 ? null : finalTest,
    ...failedProductRuns,
    ...failedReviewRuns,
  ].filter((run): run is CommandRun => Boolean(run))
  const allReviewRunsExitZero = reviewRuns.every(run => run.exitCode === 0)
  const allReviewRunsHaveStructuredEvidence = reviewRuns.every(reviewRunHasStructuredEvidence)
  const commandPass =
    initialFailureCaptured &&
    finalTestPassed &&
    didEdit &&
    didRunPassingTest &&
    requiredProductRuns.every(run => run.exitCode === 0) &&
    allReviewRunsExitZero &&
    allReviewRunsHaveStructuredEvidence
  const status = commandPass && continuousWindowSatisfied
    ? 'PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU'
    : commandPass
      ? 'PARTIAL_SENIOR_CODING_WINDOW_BEHAVIOR_PASS_DURATION_BLOCKED'
      : 'FAIL_SENIOR_CODING_WINDOW'

  const report = {
    schemaVersion: 'dsxu.v24.senior-coding-window.v1',
    generatedAt: new Date().toISOString(),
    status,
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      productEntrypoint: 'src/entrypoints/dsxu-code.tsx -p --output-format stream-json',
      permissionMode: 'bypassPermissions for isolated tmp fixture only; evidence remains in .dsxu trace',
      noSecondRuntime: true,
      fixtureWorkspace: WORKSPACE_DIR,
    },
    window: {
      startedAtMs: startedAt,
      elapsedMs,
      minWindowMs: MIN_WINDOW_MS,
      maxWindowMs: MAX_WINDOW_MS,
      continuousWindowSatisfied,
      dsxuRunCount: runs.length,
      sustainedReviewRounds: round,
    },
    checks: {
      initialFailureCaptured,
      didEdit,
      didRunPassingTest,
      finalTestPassed,
      allDsxuRunsExitZero: runs.every(run => run.exitCode === 0),
      allReviewRunsExitZero,
      allReviewRunsHaveStructuredEvidence,
      reviewFailureCount: failedReviewRuns.length,
      commandPass,
      final95ClaimAllowed: false,
    },
    failureAttribution: failedCommandRuns.map(run => ({
      id: run.id,
      owner: run.attribution.owner,
      rootCause: run.attribution.rootCause,
      nextAction: run.attribution.nextAction,
      timedOut: run.attribution.timedOut,
      signal: run.attribution.signal,
      stdoutPath: run.stdoutPath,
      stderrPath: run.stderrPath,
    })),
    cost: {
      totalFlashCostUSD: sumCosts(runs),
      proWasRun: false,
    },
    toolUseCounts: mergeToolUseCounts(runs),
    evidence: {
      initialFailingTest,
      finalTest,
      dsxuRuns: runs.map(run => ({
        id: run.id,
        exitCode: run.exitCode,
        durationMs: run.durationMs,
        stdoutPath: run.stdoutPath,
        stderrPath: run.stderrPath,
        tracePath: run.tracePath,
        costUSD: run.costUSD,
        toolUseCounts: run.toolUseCounts,
        resultJson: run.resultJson,
        attribution: run.attribution,
      })),
      reviewFailures: failedReviewRuns.map(run => ({
        id: run.id,
        exitCode: run.exitCode,
        hasStructuredEvidence: reviewRunHasStructuredEvidence(run),
        stdoutPath: run.stdoutPath,
        stderrPath: run.stderrPath,
        tracePath: run.tracePath,
        attribution: run.attribution,
      })),
    },
    remainingForV24Final: [
      'fixed public benchmark/product demo comparison data',
      'six-stage final tests',
      'clean export artifact',
      'fresh install/help/doctor/provider gate smoke',
    ],
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const md = [
    `# DSXU V24 Senior Coding Window - ${DATE}`,
    '',
    `Status: ${status}`,
    '',
    '## Result',
    '',
    '| Item | Value |',
    '|---|---|',
    `| Product entry | ${report.policy.productEntrypoint} |`,
    `| Default model | ${report.policy.defaultModel} |`,
    `| Pro usage | ${report.cost.proWasRun ? 'true' : 'false'} |`,
    `| Elapsed ms | ${elapsedMs} |`,
    `| Continuous 30-45 minute window | ${continuousWindowSatisfied} |`,
    `| Initial failing test captured | ${initialFailureCaptured} |`,
    `| DSXU edited source | ${didEdit} |`,
    `| Final fixture test passed | ${finalTestPassed} |`,
    `| Failure attribution count | ${report.failureAttribution.length} |`,
    `| DSXU run count | ${runs.length} |`,
    `| Sustained review rounds | ${round} |`,
    `| Flash cost USD | ${report.cost.totalFlashCostUSD} |`,
    `| Final 95 claim allowed | false |`,
    '',
    '## Evidence',
    '',
    `- JSON: ${OUT_JSON}`,
    `- Fixture workspace: ${WORKSPACE_DIR}`,
    `- Initial failing test stdout: ${initialFailingTest.stdoutPath}`,
    `- Final test stdout: ${finalTest.stdoutPath}`,
    ...runs.map(run => `- ${run.id}: ${run.tracePath}`),
    '',
    '## Failure Attribution',
    '',
    report.failureAttribution.length === 0
      ? 'No failed acceptance command.'
      : [
        '| id | owner | rootCause | nextAction | timedOut |',
        '|---|---|---|---|---|',
        ...report.failureAttribution.map(row => `| ${row.id} | ${row.owner} | ${row.rootCause} | ${row.nextAction.replace(/\|/g, '/')} | ${row.timedOut} |`),
      ].join('\n'),
    '',
    '## Remaining',
    '',
    '- Fixed public benchmark/product demo comparison data.',
    '- Six-stage final tests.',
    '- Clean export artifact.',
    '- Fresh install/help/doctor/provider gate smoke.',
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(JSON.stringify({
    status,
    elapsedMs,
    continuousWindowSatisfied,
    commandPass,
    finalTestPassed,
    dsxuRunCount: runs.length,
    totalFlashCostUSD: report.cost.totalFlashCostUSD,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))

  if (!commandPass) process.exitCode = 1
}

function printUsage(): void {
  console.log([
    'Usage: bun run scripts/dsxu-v24-senior-coding-window.ts',
    '',
    'Runs the real DSXU senior-coding acceptance window.',
    'Default duration: 30-45 minutes.',
    'This script writes evidence to:',
    `- ${OUT_JSON}`,
    `- ${OUT_MD}`,
  ].join('\n'))
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage()
} else {
  await main()
}
