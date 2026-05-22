import { cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  runRealTuiExitSmoke,
  type RealTuiHarnessOptions,
  type RealTuiHarnessResult,
} from '../src/dsxu/integration/harness/real-tui-harness.ts'
import { writeLiveProviderGateEvidence } from '../src/dsxu/integration/harness/live-provider-gate-v1-harness.ts'

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

type ScenarioStatus =
  | 'PASS_TUI_EVIDENCED'
  | 'PASS_NEGATIVE_RECOVERY_EVIDENCED'
  | 'BLOCKED_PROVIDER_AUTH_EVIDENCED'
  | 'FAIL_TUI_EVIDENCE'

type ScenarioRow = {
  id: string
  category: string
  status: ScenarioStatus
  ok: boolean
  required: boolean
  c2Loops: string[]
  checks: Record<string, boolean>
  result: RealTuiHarnessResult
  blockers: string[]
}

type FlashReview = {
  id: string
  tracePath: string
  exitCode: number
  durationMs: number
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
}

const ROOT = process.cwd()
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-interactive-tui-acceptance')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json')
const REVIEW_INPUT_JSON = join(GENERATED_DIR, 'DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_REVIEW_INPUT_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md')

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function runCommand(id: string, command: string[], timeoutMs = 240_000): Promise<CommandRun> {
  const startedAt = Date.now()
  const stdoutPath = join(TRACE_DIR, `${id}-${nowSafe()}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${id}-${nowSafe()}.stderr.log`)
  const proc = Bun.spawn(command, {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
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
      // Try the next candidate; raw transcript remains the source of truth.
    }
  }
  return null
}

function parseStreamJson(stdout: string): {
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
} {
  let resultJson: Record<string, unknown> | null = null
  let lastAssistantJson: Record<string, unknown> | null = null
  let costUSD = 0
  let modelUsage: Record<string, unknown> | null = null
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      if (event.type === 'assistant') {
        const message = event.message as { content?: unknown } | undefined
        const content = Array.isArray(message?.content) ? message.content : []
        for (const block of content) {
          if (!block || typeof block !== 'object') continue
          const text = (block as { text?: unknown }).text
          if (typeof text !== 'string') continue
          const parsed = parseMarkdownJson(text)
          if (parsed) lastAssistantJson = parsed
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
      // Raw transcript remains the source of truth for parse failures.
    }
  }
  resultJson ??= lastAssistantJson
  return { resultJson, costUSD, modelUsage }
}

function allChecks(checks: Record<string, boolean>): boolean {
  return Object.values(checks).every(Boolean)
}

function commonChecks(result: RealTuiHarnessResult): Record<string, boolean> {
  return {
    exitedCleanly: result.status === 'exited' && result.exitCode === 0,
    sentExit: result.sentExit,
    sawWelcome: result.sawWelcome,
    sawPrompt: result.sawPrompt,
    sawTuiHealthTrace: result.sawTuiHealthTrace,
    noMojibake: !result.sawMojibake && !result.sawTerminalMojibake && !result.sawInputEncodingLoss,
    hasTranscript: typeof result.transcriptPath === 'string' && result.transcriptPath.length > 0,
    hasTrace: typeof result.tracePath === 'string' && result.tracePath.length > 0,
    hasLifecycleTrace: typeof result.lifecycleTraceDir === 'string' && result.lifecycleTraceDir.length > 0,
  }
}

function blockersFrom(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name)
}

async function mirrorTuiEvidence(
  result: RealTuiHarnessResult,
  scenarioName: string,
): Promise<RealTuiHarnessResult> {
  const mirrored: RealTuiHarnessResult = { ...result }
  if (result.transcriptPath) {
    const transcriptPath = join(TRACE_DIR, `${scenarioName}.transcript.txt`)
    await cp(result.transcriptPath, transcriptPath, { force: true })
    mirrored.transcriptPath = transcriptPath
  }
  if (result.tracePath) {
    const tracePath = join(TRACE_DIR, `${scenarioName}.trace.jsonl`)
    await cp(result.tracePath, tracePath, { force: true })
    mirrored.tracePath = tracePath
  }
  if (result.lifecycleTraceDir) {
    const lifecycleTraceDir = join(TRACE_DIR, `${scenarioName}.lifecycle`)
    await cp(result.lifecycleTraceDir, lifecycleTraceDir, {
      recursive: true,
      force: true,
    })
    mirrored.lifecycleTraceDir = lifecycleTraceDir
    mirrored.lifecycleTraceFiles = result.lifecycleTraceFiles?.map(file =>
      join(lifecycleTraceDir, file.split(/[\\/]/).at(-1) ?? file),
    )
  }
  return mirrored
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isTransientTuiSpawnFailure(result: RealTuiHarnessResult): boolean {
  return result.status === 'spawn_failed' &&
    result.outputBytes === 0 &&
    typeof result.error === 'string' &&
    /Input\/output error|OSError\(5/i.test(result.error)
}

async function runMirroredTuiScenario(
  options: RealTuiHarnessOptions & { scenarioName: string },
): Promise<RealTuiHarnessResult> {
  let result = await runRealTuiExitSmoke(options)

  if (isTransientTuiSpawnFailure(result)) {
    await sleep(1_500)
    result = await runRealTuiExitSmoke({
      ...options,
      scenarioName: `${options.scenarioName}-retry1`,
    })
  }

  await sleep(500)
  return mirrorTuiEvidence(result, options.scenarioName)
}

function makeScenario(input: {
  id: string
  category: string
  required?: boolean
  c2Loops: string[]
  result: RealTuiHarnessResult
  extraChecks: Record<string, boolean>
  negativeRecovery?: boolean
  providerTask?: boolean
}): ScenarioRow {
  const checks = {
    ...commonChecks(input.result),
    ...input.extraChecks,
  }
  const pass = allChecks(checks)
  let status: ScenarioStatus = pass ? 'PASS_TUI_EVIDENCED' : 'FAIL_TUI_EVIDENCE'
  if (pass && input.negativeRecovery) status = 'PASS_NEGATIVE_RECOVERY_EVIDENCED'
  if (pass && input.providerTask && input.result.sawLoginWarning) {
    status = 'BLOCKED_PROVIDER_AUTH_EVIDENCED'
  }
  return {
    id: input.id,
    category: input.category,
    status,
    ok: pass && status !== 'BLOCKED_PROVIDER_AUTH_EVIDENCED',
    required: input.required ?? true,
    c2Loops: input.c2Loops,
    checks,
    result: input.result,
    blockers: blockersFrom(checks),
  }
}

async function runFlashReview(reportPath: string): Promise<FlashReview> {
  const tracePath = join(TRACE_DIR, `flash-review-${nowSafe()}.jsonl`)
  const prompt = [
    'V24 interactive TUI acceptance review. Flash-first only.',
    `Read ${reportPath}.`,
    'Return JSON only with fields {"did_read_report":boolean,"interactive_tui_evidence_present":boolean,"scenario_count":number,"flash_first_policy_respected":boolean,"pro_needed":boolean,"blocking_gaps":[string],"evidence":[string]}.',
    'Do not edit files. Pro is not allowed for this review unless source truth conflicts after retry, which is not requested here.',
  ].join(' ')
  const run = await runCommand('flash-interactive-tui-review', [
    'bun',
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    '-p',
    '--verbose',
    '--model',
    'deepseek-v4-flash',
    '--max-turns',
    '4',
    '--output-format',
    'stream-json',
    '--tools',
    'Read',
    '--permission-mode',
    'dontAsk',
    prompt,
  ], 300_000)
  await writeFile(tracePath, run.stdout + run.stderr, 'utf8')
  const parsed = parseStreamJson(run.stdout + run.stderr)
  return {
    id: 'flash-interactive-tui-review',
    tracePath,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    modelUsage: parsed.modelUsage,
  }
}

function mdTable(rows: ScenarioRow[]): string {
  const headers = ['id', 'category', 'status', 'ok', 'c2Loops', 'transcript']
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${[
      row.id,
      row.category,
      row.status,
      String(row.ok),
      row.c2Loops.join(', '),
      row.result.transcriptPath ?? '',
    ].join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const providerGate = await writeLiveProviderGateEvidence({
    executionTarget: 'wsl',
    evidencePath: join(TRACE_DIR, 'wsl-live-provider-gate.json'),
  })

  const startup = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-startup-exit',
    timeoutMs: 40_000,
  })
  const permission = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-permission-fallback',
    timeoutMs: 55_000,
    permissionPromptReplay: true,
    inputsAfterPrompt: ['\u001b', '/exit'],
    waitForNewPromptBetweenInputs: true,
  })
  const noProgress = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-no-progress-recovery',
    timeoutMs: 55_000,
    noProgressReplay: true,
    inputsAfterPrompt: ['/exit'],
    waitForNewPromptBetweenInputs: true,
  })
  const autoContinue = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-auto-continue',
    timeoutMs: 70_000,
    autoContinueReplay: true,
    inputsAfterPrompt: ['/exit'],
    waitForNewPromptBetweenInputs: true,
  })
  const resume = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-compact-resume',
    timeoutMs: 75_000,
    resumeReplay: true,
    inputsAfterPrompt: ['\u001b', '/exit'],
    waitForNewPromptBetweenInputs: true,
  })
  const background = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-background-task',
    timeoutMs: 70_000,
    backgroundTaskReplay: true,
    inputsAfterPrompt: ['/exit'],
    waitForNewPromptBetweenInputs: true,
  })
  const modelTask = await runMirroredTuiScenario({
    evidenceDir: TRACE_DIR,
    scenarioName: 'v24-model-task-auth-or-progress',
    timeoutMs: 85_000,
    inputsAfterPrompt: [
      'V24 interactive acceptance task: inspect the current workspace state briefly, answer with exactly DSXU_V24_TUI_MODEL_TASK_DONE, and do not edit files.',
      '/exit',
    ],
    waitForNewPromptBetweenInputs: true,
  })

  const scenarios = [
    makeScenario({
      id: 'startup-exit',
      category: 'startup-visible-state',
      c2Loops: ['Visible Work-State', 'Release/Doctor/Install'],
      result: startup,
      extraChecks: {
        noLoginWarningForStartup: !startup.sawLoginWarning,
      },
    }),
    makeScenario({
      id: 'permission-fallback',
      category: 'permission-visible-state',
      c2Loops: ['Permission/Safety', 'Visible Work-State'],
      result: permission,
      extraChecks: {
        sawPermissionReplayMarker: permission.sawPermissionReplayMarker,
        sawPermissionFallbackBar: permission.sawPermissionFallbackBar,
      },
    }),
    makeScenario({
      id: 'no-progress-recovery',
      category: 'failure-recovery-negative-path',
      c2Loops: ['Failure/Recovery', 'Visible Work-State'],
      result: noProgress,
      negativeRecovery: true,
      extraChecks: {
        sawNoProgressReplayTrace: noProgress.sawNoProgressReplayTrace,
        sawTuiStallTrace: noProgress.sawTuiStallTrace,
      },
    }),
    makeScenario({
      id: 'auto-continue',
      category: 'tool-result-auto-continue',
      c2Loops: ['Tool Lifecycle', 'Failure/Recovery'],
      result: autoContinue,
      extraChecks: {
        sawAutoContinueEnqueuedTrace: autoContinue.sawAutoContinueEnqueuedTrace,
        sawAutoContinueProcessedTrace: autoContinue.sawAutoContinueProcessedTrace,
        didNotSuppressAutoContinue: !autoContinue.sawAutoContinueSuppressedTrace,
      },
    }),
    makeScenario({
      id: 'compact-resume',
      category: 'context-resume-source-truth',
      c2Loops: ['Context/Memory/Compact', 'Source Truth/Coding', 'Failure/Recovery'],
      result: resume,
      extraChecks: {
        sawResumeReplayQueuedTrace: resume.sawResumeReplayQueuedTrace,
        sawResumeSourceTruthGateTrace: resume.sawResumeSourceTruthGateTrace,
        sawResumeProviderPreflightTrace: resume.sawResumeProviderPreflightTrace,
        sawAutoContinueEnqueuedTrace: resume.sawAutoContinueEnqueuedTrace,
        sawAutoContinueProcessedTrace: resume.sawAutoContinueProcessedTrace,
      },
    }),
    makeScenario({
      id: 'background-task',
      category: 'agent-background-lifecycle',
      c2Loops: ['Agent Delegation', 'Visible Work-State', 'Telemetry/Evidence'],
      result: background,
      extraChecks: {
        sawBackgroundTaskReplayTrace: background.sawBackgroundTaskReplayTrace,
        sawBackgroundTaskPillMarker: background.sawBackgroundTaskPillMarker,
      },
    }),
    makeScenario({
      id: 'model-task-auth-or-progress',
      category: 'real-model-tui-task',
      c2Loops: ['Goal/Session', 'Model/Cost/Cache', 'Visible Work-State'],
      result: modelTask,
      providerTask: true,
      extraChecks: {
        providerCompletedOrAuthBlocked:
          modelTask.sawLoginWarning || modelTask.sawProgress || modelTask.sawPromptAfterTask,
      },
    }),
  ]

  const localRegression = await runCommand('interactive-tui-local-regression', [
    'bun',
    'test',
    'src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
    'src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts',
    'src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts',
  ], 180_000)

  const draft = {
    status: 'DRAFT_BEFORE_FLASH_REVIEW',
    generatedAt: new Date().toISOString(),
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      productEntrypoint: 'bin/dsxu-code via WSL PTY TUI harness',
      noSecondRuntime: true,
    },
    providerGate,
    scenarios,
    localRegression: {
      exitCode: localRegression.exitCode,
      command: localRegression.command,
      stdoutPath: localRegression.stdoutPath,
      stderrPath: localRegression.stderrPath,
      durationMs: localRegression.durationMs,
    },
  }
  await writeFile(OUT_JSON, `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
  const reviewInput = {
    generatedAt: draft.generatedAt,
    policy: draft.policy,
    providerGate: {
      ok: providerGate.ok,
      status: providerGate.status,
      executionTarget: providerGate.executionTarget,
      probe: providerGate.probe,
      evidencePath: providerGate.evidencePath,
    },
    scenarios: scenarios.map(row => ({
      id: row.id,
      category: row.category,
      status: row.status,
      ok: row.ok,
      c2Loops: row.c2Loops,
      checks: row.checks,
      blockers: row.blockers,
      transcriptPath: row.result.transcriptPath,
      tracePath: row.result.tracePath,
      lifecycleTraceDir: row.result.lifecycleTraceDir,
      outputBytes: row.result.outputBytes,
      elapsedMs: row.result.elapsedMs,
    })),
    localRegression: {
      exitCode: localRegression.exitCode,
      command: localRegression.command,
      stdoutPath: localRegression.stdoutPath,
      stderrPath: localRegression.stderrPath,
      durationMs: localRegression.durationMs,
    },
    reviewInstruction:
      'This compact file is the Flash review input. Full raw TUI transcripts remain in the per-scenario transcriptPath files.',
  }
  await writeFile(REVIEW_INPUT_JSON, `${JSON.stringify(reviewInput, null, 2)}\n`, 'utf8')

  const flashReview = await runFlashReview(REVIEW_INPUT_JSON)

  const hardFailures = scenarios.filter(row => row.required && row.status === 'FAIL_TUI_EVIDENCE')
  const authBlocks = scenarios.filter(row => row.status === 'BLOCKED_PROVIDER_AUTH_EVIDENCED')
  const flashReviewPass =
    flashReview.exitCode === 0 &&
    flashReview.resultJson?.did_read_report === true &&
    flashReview.resultJson?.interactive_tui_evidence_present === true &&
    flashReview.resultJson?.flash_first_policy_respected === true
  const localRegressionPass = localRegression.exitCode === 0

  const status =
    hardFailures.length > 0
      ? 'FAIL_INTERACTIVE_TUI_ACCEPTANCE'
      : authBlocks.length > 0 || !providerGate.ok
        ? 'BLOCKED_PROVIDER_AUTH_EVIDENCED'
        : localRegressionPass && flashReviewPass
          ? 'PASS_INTERACTIVE_TUI_ACCEPTANCE'
          : 'OPEN_REVIEW_REQUIRED'

  const report = {
    ...draft,
    status,
    hardFailures: hardFailures.map(row => ({ id: row.id, blockers: row.blockers })),
    authBlocks: authBlocks.map(row => ({ id: row.id, blockers: row.blockers })),
    localRegressionPass,
    flashReviewPass,
    reviewInputPath: REVIEW_INPUT_JSON,
    flashReview,
    interactiveTuiRequirement: {
      coveredByThisRun: true,
      scenarioCount: scenarios.length,
      requiredScenarioCount: scenarios.filter(row => row.required).length,
      c2LoopsCovered: [...new Set(scenarios.flatMap(row => row.c2Loops))].sort(),
      remainingForV24Final: [
        '30-45 minute complex senior-coding task',
        'full C2 15 major loops and 36 secondary loops',
        'Agent/MCP/permission/cost public challenge package',
        'six-stage final test chain and clean export',
      ],
    },
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const md = [
    '# DSXU V24 Interactive TUI Acceptance - 20260515',
    '',
    'This report runs the real DSXU TUI through the existing WSL PTY harness and cross-checks it with Flash-first DSXU review.',
    '',
    `Status: \`${status}\``,
    '',
    `Policy: default model \`deepseek-v4-flash\`; Pro not run; product entry is \`bin/dsxu-code\` through WSL PTY.`,
    '',
    mdTable(scenarios),
    '',
    'Command evidence:',
    '',
    `- local regression: exit=${localRegression.exitCode}, stdout=${localRegression.stdoutPath}`,
    `- Flash review: exit=${flashReview.exitCode}, trace=${flashReview.tracePath}, costUSD=${flashReview.costUSD}`,
    `- Flash review input: ${REVIEW_INPUT_JSON}`,
    `- WSL provider gate: status=${providerGate.status}, evidence=${providerGate.evidencePath}`,
    '',
    'Remaining gates:',
    '',
    '- 30-45 minute complex senior-coding task.',
    '- Full C2 15 major loops and 36 secondary loops.',
    '- Agent/MCP/permission/cost public challenge package.',
    '- Six-stage final tests and clean export.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  process.stdout.write(JSON.stringify({
    status,
    scenarioCount: scenarios.length,
    hardFailures: hardFailures.map(row => row.id),
    authBlocks: authBlocks.map(row => row.id),
    localRegressionPass,
    flashReviewPass,
    providerGateStatus: providerGate.status,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
