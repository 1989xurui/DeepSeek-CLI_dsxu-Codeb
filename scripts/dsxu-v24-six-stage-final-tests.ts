import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import treeKill from 'tree-kill'

type StageId =
  | 'function'
  | 'experience'
  | 'recovery'
  | 'performance'
  | 'evaluation'
  | 'release-closure'

type CommandSpec = {
  id: string
  stage: StageId
  purpose: string
  command: string[]
  timeoutMs: number
}

type TestTier = 'mainline' | 'slow' | 'acceptance' | 'live-provider' | 'release-only'

type CommandResult = {
  id: string
  stage: StageId
  purpose: string
  command: string[]
  owner: string
  testTier: TestTier
  liveProvider: boolean
  exitCode: number
  passed: boolean
  durationMs: number
  stdoutPath: string
  stderrPath: string
  stdoutTail: string
  stderrTail: string
  attribution: FailureAttribution
}

type FailureAttribution = {
  owner: string
  rootCause: string
  nextAction: string
  timedOut: boolean
  signal: string
}

type StageSummary = {
  id: StageId
  total: number
  passed: number
  failed: number
  durationMs: number
  status: 'PASS' | 'FAIL'
}

type OwnerSummary = {
  owner: string
  total: number
  passed: number
  failed: number
  timedOut: number
  liveProvider: number
  durationMs: number
  status: 'PASS' | 'FAIL'
  failedCommands: string[]
}

type TestTierSummary = {
  testTier: TestTier
  total: number
  passed: number
  failed: number
  timedOut: number
  liveProvider: number
  durationMs: number
  status: 'PASS' | 'FAIL'
}

const ROOT = process.cwd()
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-six-stage-final-tests')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.md')
const TARGET_REFERENCE_MANIFEST = join(
  ROOT,
  '.dsxu',
  'trace',
  'p12-target-reference-codex-runner-v1',
  'target-reference-manifest.json',
)

const COMMANDS: CommandSpec[] = [
  {
    id: 'function-tools-permission-adapter',
    stage: 'function',
    purpose: 'tool gate, tool definition, and mainline adapter ownership',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      './src/dsxu/engine/__tests__/tool-definition-owner.test.ts',
      './src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
      './src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'function-provider-router-cost',
    stage: 'function',
    purpose: 'API service, provider contract, and model migration boundary',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/api-service.test.ts',
      './src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
      './src/dsxu/engine/__tests__/provider' +
        '-migration-model-migration-boundary-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'function-agent-lifecycle',
    stage: 'function',
    purpose: 'agent runtime and background lifecycle owner path',
    command: [
      'bun',
      'test',
      '--timeout',
      '60000',
      './src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      './src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts',
      './src/dsxu/engine/__tests__/local-agent-background-lifecycle-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'experience-visible-tui-core',
    stage: 'experience',
    purpose: 'visible TUI state, streaming health, and model-driven long-task evidence',
    command: [
      'bun',
      'test',
      '--timeout',
      '60000',
      './src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts',
      './src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'experience-real-tui-lifecycle',
    stage: 'experience',
    purpose: 'real TUI lifecycle, permission, stall, auto-continue, and compact resume evidence',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      '-t',
      'keeps progress|starts the real WSL TUI|records transcript|replays a real TUI permission|replays a no-progress stall|real task input|tool-result auto-continue|compact resume state|live background task',
      '--timeout',
      '120000',
    ],
    timeoutMs: 360_000,
  },
  {
    id: 'experience-real-tui-resize',
    stage: 'experience',
    purpose: 'real PTY resize, trust proof, permission visibility, and scroll anchoring evidence',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      '-t',
      'long-content TUI output pinned|DSXU trust proof|permission review visible|middle scrollback',
      '--timeout',
      '120000',
    ],
    timeoutMs: 240_000,
  },
  {
    id: 'experience-control-plane-real-gap',
    stage: 'experience',
    purpose: 'control plane and real-gap acceptance state',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/control-plane-v1.test.ts',
      './src/dsxu/engine/__tests__/control-plane-stage-acceptance-v1.test.ts',
      './src/dsxu/engine/__tests__/real-gap-acceptance.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'experience-real-interactive-tui',
    stage: 'experience',
    purpose: 'real DSXU TUI interaction, permission fallback, recovery, background, model task',
    command: ['bun', 'run', 'v24:interactive-tui-acceptance'],
    timeoutMs: 600_000,
  },
  {
    id: 'recovery-core-query-loop',
    stage: 'recovery',
    purpose: 'mainline recovery, query-loop recovery, and scenario review recovery',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts',
      './src/dsxu/engine/__tests__/recovery-query-loop-v3.test.ts',
      './src/dsxu/engine/__tests__/scenario-review-recovery-v3.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'recovery-experience-store-agent-parent',
    stage: 'recovery',
    purpose: 'experience-store replay, smooth resume, and agent parent final gate replay',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/experience-store-replay-v1.test.ts',
      './src/dsxu/engine/__tests__/experience-store-smooth-resume-pack-v1.test.ts',
      './src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'performance-cost-cache-unit',
    stage: 'performance',
    purpose: 'cost matrix and prompt-prefix cache regression',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/phase12-live-cost-matrix-v1.test.ts',
      './src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'performance-live-provider-gate',
    stage: 'performance',
    purpose: 'real provider gate and DeepSeek route availability',
    command: ['bun', 'run', 'live:provider-gate'],
    timeoutMs: 300_000,
  },
  {
    id: 'performance-live-cache-prefix',
    stage: 'performance',
    purpose: 'real cache prefix smoke under current provider policy',
    command: ['bun', 'run', 'live:cache-prefix-smoke'],
    timeoutMs: 300_000,
  },
  {
    id: 'evaluation-p12-raw-readiness',
    stage: 'evaluation',
    purpose: 'real P12 target-reference manifest intake and paired raw readiness',
    command: [
      'bun',
      'run',
      'p12:raw-readiness',
      '--targetReferenceManifestPath',
      TARGET_REFERENCE_MANIFEST,
      '--fail-on-blocked',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'evaluation-p12-senior-experience',
    stage: 'evaluation',
    purpose: 'raw comparison, semantic exam, and senior programmer experience evaluation',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts',
      './src/dsxu/engine/__tests__/phase12-reference-semantic-exam-v1.test.ts',
      './src/dsxu/engine/__tests__/phase12-senior-programmer-experience-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'evaluation-v18-evidence-pack',
    stage: 'evaluation',
    purpose: 'V18 evidence eval pack and baseline manifest',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/evidence-eval-pack.test.ts',
      './src/dsxu/engine/__tests__/eval-baseline-manifest.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'release-owner-final-preflight',
    stage: 'release-closure',
    purpose: 'owner/Git mutation preflight and final gate preflight',
    command: ['bun', 'run', 'owner-git:preflight'],
    timeoutMs: 300_000,
  },
  {
    id: 'release-v20-final-preflight',
    stage: 'release-closure',
    purpose: 'V20 final preflight refresh before export',
    command: ['bun', 'run', 'v20:final-preflight'],
    timeoutMs: 300_000,
  },
  {
    id: 'release-gate',
    stage: 'release-closure',
    purpose: 'DSXU release gate',
    command: ['bun', 'run', 'test:dsxu:release'],
    // Release gate covers the full release surface and routinely runs past
    // five minutes on Windows/WSL; the standalone owner test is the authority.
    timeoutMs: 600_000,
  },
  {
    id: 'release-clean-export-preflight',
    stage: 'release-closure',
    purpose: 'clean export readiness without creating artifact',
    command: ['bun', 'run', 'clean-export:preflight'],
    timeoutMs: 300_000,
  },
  {
    id: 'release-surface-tests',
    stage: 'release-closure',
    purpose: 'release gate tests, release surface, source policy, and commercial/IP preflight',
    command: [
      'bun',
      'test',
      './src/dsxu/engine/__tests__/release-test-gate-v1.test.ts',
      './src/dsxu/engine/__tests__/release-surface-v1.test.ts',
      './src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'release-commercial-ip',
    stage: 'release-closure',
    purpose: 'commercial/IP source release preflight',
    command: ['bun', 'run', 'commercial-ip:preflight'],
    timeoutMs: 300_000,
  },
]

function safeTime(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function tail(text: string, max = 2_500): string {
  return text.length <= max ? text : text.slice(-max)
}

function logRunnerEvent(event: Record<string, unknown>): void {
  console.error(`[dsxu-six-stage-runner] ${JSON.stringify({
    at: new Date().toISOString(),
    ...event,
  })}`)
}

function ownerForCommand(spec: CommandSpec): string {
  if (spec.id.includes('provider') || spec.id.includes('cache') || spec.id.includes('cost')) {
    return 'DeepSeek Provider / Route / Cost owner'
  }
  if (spec.id.includes('tool') || spec.id.includes('permission') || spec.id.includes('adapter')) {
    return 'Tool Gate / Permission / Adapter owner'
  }
  if (spec.id.includes('agent')) {
    return 'Agent lifecycle owner'
  }
  if (spec.id.includes('tui') || spec.id.includes('visible') || spec.id.includes('control-plane')) {
    return 'TUI visible-state / Control-plane owner'
  }
  if (spec.id.includes('recovery') || spec.id.includes('resume')) {
    return 'Recovery / Resume owner'
  }
  if (spec.id.includes('p12') || spec.id.includes('evidence') || spec.id.includes('eval')) {
    return 'Evidence / Evaluation owner'
  }
  if (spec.stage === 'release-closure') {
    return 'Release / Claim / Clean-export owner'
  }
  return `${spec.stage} owner`
}

function liveProviderForCommand(spec: CommandSpec): boolean {
  const commandText = spec.command.join(' ')
  return (
    spec.id.includes('live') ||
    commandText.includes('live:') ||
    commandText.includes('DEEPSEEK_API_KEY') ||
    spec.purpose.toLowerCase().includes('provider')
  )
}

function testTierForCommand(spec: CommandSpec): TestTier {
  if (liveProviderForCommand(spec)) return 'live-provider'
  if (spec.stage === 'release-closure') return 'release-only'
  if (spec.stage === 'experience' || spec.id.includes('interactive') || spec.id.includes('tui')) {
    return 'acceptance'
  }
  if (spec.timeoutMs > 60_000 || spec.stage === 'evaluation' || spec.stage === 'performance') {
    return 'slow'
  }
  return 'mainline'
}

function classifyFailure(spec: CommandSpec, exitCode: number, stdout: string, stderr: string): FailureAttribution {
  const owner = ownerForCommand(spec)
  const liveProvider = liveProviderForCommand(spec)
  const testTier = testTierForCommand(spec)
  if (exitCode === 0) {
    return {
      owner,
      rootCause: 'passed',
      nextAction: 'no repair needed; keep this command as release evidence',
      timedOut: false,
      signal: `exitCode=0 testTier=${testTier} liveProvider=${String(liveProvider)}`,
    }
  }

  const combined = `${stdout}\n${stderr}`
  const lower = combined.toLowerCase()
  const timedOut = exitCode === 124
  if (timedOut) {
    return {
      owner,
      rootCause: 'command-timeout',
      nextAction: 'split this owner command or raise its explicit timeout only after confirming it is making progress',
      timedOut,
      signal: `timeoutMs=${spec.timeoutMs} testTier=${testTier} liveProvider=${String(liveProvider)}`,
    }
  }
  if (/target-reference|targetreferencemanifest|p12/.test(lower) && /missing|not found|blocked|fail/.test(lower)) {
    return {
      owner,
      rootCause: 'missing-target-reference-raw-input',
      nextAction: 'import a real target-reference manifest and rerun P12 raw readiness; do not replace it with local mock evidence',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  if (/api key|apikey|auth|unauthori[sz]ed|quota|rate limit|429|401|403/.test(lower)) {
    return {
      owner,
      rootCause: 'provider-auth-or-quota',
      nextAction: 'run provider doctor/live gate with redacted credentials and keep failure as provider evidence',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  if (/permission denied|eacces|access is denied|operation not permitted/.test(lower)) {
    return {
      owner,
      rootCause: 'filesystem-or-permission-block',
      nextAction: 'route through Permission Gate or external ownership closure; do not force-delete or bypass',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  if (/cannot find module|module not found|enoent|no such file|not recognized as/.test(lower)) {
    return {
      owner,
      rootCause: 'missing-command-or-file',
      nextAction: 'repair the owner script/path mapping before rerunning final acceptance',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  if (/secret|token|license|brand|commercial|ip|trademark/.test(lower)) {
    return {
      owner,
      rootCause: 'release-compliance-block',
      nextAction: 'fix release claim/commercial/IP evidence and rerun the release owner command',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  if (/fail|failed|error|assertion|expected|received|not ok/.test(lower)) {
    return {
      owner,
      rootCause: 'owner-test-regression',
      nextAction: 'fix the named owner test failure first; do not turn this into a release claim exception',
      timedOut,
      signal: tail(combined, 600),
    }
  }
  return {
    owner,
    rootCause: 'nonzero-exit-without-known-pattern',
    nextAction: 'inspect stdout/stderr artifacts and add a narrower owner attribution rule if this repeats',
    timedOut,
    signal: tail(combined, 600),
  }
}

async function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const startedAt = Date.now()
  const commandIndex = COMMANDS.indexOf(spec) + 1
  const base = `${String(COMMANDS.indexOf(spec) + 1).padStart(2, '0')}-${spec.stage}-${spec.id}-${safeTime()}`
  const stdoutPath = join(TRACE_DIR, `${base}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${base}.stderr.log`)
  await mkdir(dirname(stdoutPath), { recursive: true })

  logRunnerEvent({
    event: 'command_start',
    index: commandIndex,
    total: COMMANDS.length,
    id: spec.id,
    stage: spec.stage,
    testTier: testTierForCommand(spec),
    liveProvider: liveProviderForCommand(spec),
    timeoutMs: spec.timeoutMs,
    command: spec.command.join(' '),
  })
  const proc = Bun.spawn(spec.command, {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOutByRunner = false
  const stdoutPromise = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve('')
  const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve('')
  const timeout = new Promise<number>(resolve => {
    timer = setTimeout(() => {
      timedOutByRunner = true
      void killProcessTree(proc.pid).then(() => resolve(124))
    }, spec.timeoutMs)
  })
  const exitCode = await Promise.race([proc.exited, timeout])
  if (timer) clearTimeout(timer)
  const [stdout, stderr] = await Promise.all([
    settleProcessStream(stdoutPromise, 'stdout'),
    settleProcessStream(stderrPromise, 'stderr'),
  ])
  const stderrWithRunnerSignal = timedOutByRunner
    ? `${stderr}\n[dsxu-six-stage-runner] command timed out after ${spec.timeoutMs}ms; process tree kill requested for pid=${String(proc.pid ?? 'unknown')}\n`
    : stderr
  await Promise.all([
    writeFile(stdoutPath, stdout, 'utf8'),
    writeFile(stderrPath, stderrWithRunnerSignal, 'utf8'),
  ])
  const attribution = classifyFailure(spec, exitCode, stdout, stderrWithRunnerSignal)
  const testTier = testTierForCommand(spec)
  const liveProvider = liveProviderForCommand(spec)
  const result: CommandResult = {
    id: spec.id,
    stage: spec.stage,
    purpose: spec.purpose,
    command: spec.command,
    owner: attribution.owner,
    testTier,
    liveProvider,
    exitCode,
    passed: exitCode === 0,
    durationMs: Date.now() - startedAt,
    stdoutPath,
    stderrPath,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderrWithRunnerSignal),
    attribution,
  }
  logRunnerEvent({
    event: 'command_end',
    index: commandIndex,
    total: COMMANDS.length,
    id: spec.id,
    stage: spec.stage,
    passed: result.passed,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    rootCause: result.attribution.rootCause,
    stdoutPath,
    stderrPath,
  })
  return result
}

async function killProcessTree(pid: number | undefined): Promise<void> {
  if (!pid) return
  await new Promise<void>(resolve => {
    treeKill(pid, 'SIGKILL', () => resolve())
  })
}

async function settleProcessStream(
  streamText: Promise<string>,
  label: 'stdout' | 'stderr',
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const fallback = new Promise<string>(resolve => {
    timer = setTimeout(() => {
      resolve(`[dsxu-six-stage-runner] ${label} stream did not close within 15000ms after process exit/kill.\n`)
    }, 15_000)
    const timerWithUnref = timer as ReturnType<typeof setTimeout> & { unref?: () => void }
    timerWithUnref.unref?.()
  })
  try {
    return await Promise.race([streamText, fallback])
  } catch (error) {
    return `[dsxu-six-stage-runner] failed to read ${label}: ${error instanceof Error ? error.message : String(error)}\n`
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function summarizeStages(results: CommandResult[]): StageSummary[] {
  const ids: StageId[] = ['function', 'experience', 'recovery', 'performance', 'evaluation', 'release-closure']
  return ids.map(id => {
    const rows = results.filter(result => result.stage === id)
    const passed = rows.filter(result => result.passed).length
    return {
      id,
      total: rows.length,
      passed,
      failed: rows.length - passed,
      durationMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
      status: passed === rows.length ? 'PASS' : 'FAIL',
    }
  })
}

function summarizeOwners(results: CommandResult[]): OwnerSummary[] {
  const owners = [...new Set(results.map(result => result.owner))].sort((a, b) => a.localeCompare(b))
  return owners.map(owner => {
    const rows = results.filter(result => result.owner === owner)
    const passed = rows.filter(result => result.passed).length
    const failedRows = rows.filter(result => !result.passed)
    return {
      owner,
      total: rows.length,
      passed,
      failed: failedRows.length,
      timedOut: rows.filter(result => result.attribution.timedOut).length,
      liveProvider: rows.filter(result => result.liveProvider).length,
      durationMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
      status: failedRows.length === 0 ? 'PASS' : 'FAIL',
      failedCommands: failedRows.map(result => result.id),
    }
  })
}

function summarizeTestTiers(results: CommandResult[]): TestTierSummary[] {
  const tiers: TestTier[] = ['mainline', 'slow', 'acceptance', 'live-provider', 'release-only']
  return tiers.map(testTier => {
    const rows = results.filter(result => result.testTier === testTier)
    const failedRows = rows.filter(result => !result.passed)
    const passed = rows.length - failedRows.length
    return {
      testTier,
      total: rows.length,
      passed,
      failed: failedRows.length,
      timedOut: rows.filter(result => result.attribution.timedOut).length,
      liveProvider: rows.filter(result => result.liveProvider).length,
      durationMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
      status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    }
  }).filter(summary => summary.total > 0)
}

function mdTable(results: CommandResult[]): string {
  const headers = ['stage', 'id', 'owner', 'testTier', 'liveProvider', 'durationMs', 'passed', 'exitCode', 'rootCause', 'nextAction', 'stdout', 'stderr']
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...results.map(result => `| ${[
      result.stage,
      result.id,
      result.owner,
      result.testTier,
      String(result.liveProvider),
      String(result.durationMs),
      String(result.passed),
      String(result.exitCode),
      result.attribution.rootCause,
      result.attribution.nextAction.replace(/\|/g, '/'),
      result.stdoutPath,
      result.stderrPath,
    ].join(' | ')} |`),
  ].join('\n')
}

async function maybeReadJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  logRunnerEvent({
    event: 'runner_start',
    commandCount: COMMANDS.length,
    maxSerialTimeoutMs: COMMANDS.reduce((sum, command) => sum + command.timeoutMs, 0),
  })
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const results: CommandResult[] = []
  for (const spec of COMMANDS) {
    const result = await runCommand(spec)
    results.push(result)
  }

  const stageSummaries = summarizeStages(results)
  const ownerSummaries = summarizeOwners(results)
  const testTierSummaries = summarizeTestTiers(results)
  const failedCommands = results.filter(result => !result.passed).map(result => result.id)
  const failedCommandAttributions = results
    .filter(result => !result.passed)
    .map(result => ({
      id: result.id,
      stage: result.stage,
      owner: result.owner,
      testTier: result.testTier,
      liveProvider: result.liveProvider,
      durationMs: result.durationMs,
      rootCause: result.attribution.rootCause,
      nextAction: result.attribution.nextAction,
      timedOut: result.attribution.timedOut,
      signal: result.attribution.signal,
      stdoutPath: result.stdoutPath,
      stderrPath: result.stderrPath,
    }))
  const status = failedCommands.length === 0
    ? 'PASS_V24_SIX_STAGE_FINAL_TESTS'
    : 'FAIL_V24_SIX_STAGE_FINAL_TESTS'
  const publicChallenge = await maybeReadJson(join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'))
  const productBenchmark = await maybeReadJson(join(GENERATED_DIR, 'DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json'))

  const report = {
    schemaVersion: 'dsxu.v24.six-stage-final-tests.v1',
    generatedAt: new Date().toISOString(),
    status,
    repoRoot: ROOT,
    totalDurationMs: Date.now() - startedAt,
    commandCount: results.length,
    passedCommandCount: results.filter(result => result.passed).length,
    failedCommandCount: failedCommands.length,
    failedCommands,
    failedCommandAttributions,
    stageSummaries,
    ownerSummaries,
    testTierSummaries,
    fixedPublicBenchmarkProductDemoData: {
      status: productBenchmark?.status ?? null,
      benchmarkCaseCount:
        (productBenchmark?.benchmarkCatalog as { caseCount?: unknown } | undefined)?.caseCount ?? null,
      fixedPublicTaskCount:
        (productBenchmark?.benchmarkCatalog as { fixedPublicTaskCount?: unknown } | undefined)?.fixedPublicTaskCount ?? null,
      publicChallengeStatus: publicChallenge?.status ?? null,
    },
    evidenceRule:
      'This runner executes real local tests and live/provider smokes where listed. It does not stage, commit, delete, reset, clean, or create export artifacts.',
    results,
  }

  const md = [
    '# DSXU V24 Six-Stage Final Tests - 2026-05-15',
    '',
    `Status: ${status}`,
    '',
    '## Stage Summary',
    '',
    `| stage | status | passed | total | durationMs |`,
    `| --- | --- | --- | --- | --- |`,
    ...stageSummaries.map(stage => `| ${stage.id} | ${stage.status} | ${stage.passed} | ${stage.total} | ${stage.durationMs} |`),
    '',
    '## Owner Summary',
    '',
    '| owner | status | passed | total | timedOut | liveProvider | durationMs | failedCommands |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...ownerSummaries.map(owner => `| ${owner.owner} | ${owner.status} | ${owner.passed} | ${owner.total} | ${owner.timedOut} | ${owner.liveProvider} | ${owner.durationMs} | ${owner.failedCommands.join(', ')} |`),
    '',
    '## Test Tier Summary',
    '',
    '| testTier | status | passed | total | timedOut | liveProvider | durationMs |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...testTierSummaries.map(tier => `| ${tier.testTier} | ${tier.status} | ${tier.passed} | ${tier.total} | ${tier.timedOut} | ${tier.liveProvider} | ${tier.durationMs} |`),
    '',
    '## Command Evidence',
    '',
    mdTable(results),
    '',
    '## Failure Attribution',
    '',
    failedCommandAttributions.length === 0
      ? 'No failed commands.'
      : [
        '| id | owner | testTier | liveProvider | durationMs | rootCause | nextAction | timedOut |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ...failedCommandAttributions.map(row => `| ${row.id} | ${row.owner} | ${row.testTier} | ${String(row.liveProvider)} | ${row.durationMs} | ${row.rootCause} | ${row.nextAction.replace(/\|/g, '/')} | ${row.timedOut} |`),
      ].join('\n'),
    '',
    '## Rule',
    '',
    report.evidenceRule,
    '',
  ].join('\n')

  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUT_MD, md, 'utf8'),
  ])

  logRunnerEvent({
    event: 'runner_end',
    status,
    durationMs: report.totalDurationMs,
    passedCommandCount: report.passedCommandCount,
    failedCommandCount: report.failedCommandCount,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  })
  console.log(JSON.stringify({
    status,
    durationMs: report.totalDurationMs,
    commandCount: report.commandCount,
    passedCommandCount: report.passedCommandCount,
    failedCommandCount: report.failedCommandCount,
    failedCommands,
    failedCommandAttributions,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))

  if (failedCommands.length > 0) {
    process.exit(1)
  }
  process.exit(0)
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
