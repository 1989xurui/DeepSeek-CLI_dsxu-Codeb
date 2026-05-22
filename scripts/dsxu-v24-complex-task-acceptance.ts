import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type CommandBatch = {
  id: string
  command: string[]
  timeoutMs: number
}

type CommandRun = {
  id: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutPath: string
  stderrPath: string
}

type FlashReview = CommandRun & {
  tracePath: string
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
}

type EvidenceReport = {
  id: string
  path: string
  status: string
  summary: Record<string, unknown>
}

const ROOT = process.cwd()
const DATE = '20260515'
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-complex-task-acceptance')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_${DATE}.md`)
const REVIEW_INPUT = join(GENERATED_DIR, `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_REVIEW_INPUT_${DATE}.json`)

const commandBatches: CommandBatch[] = [
  {
    id: 'query-loop-regression-batch',
    command: [
      'bun',
      'test',
      'src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-gear-box-recovery-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-recovery-bridge-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts',
      'src/dsxu/engine/__tests__/recovery-query-loop-v3.test.ts',
    ],
    timeoutMs: 600_000,
  },
  {
    id: 'release-surface-regression-batch',
    command: [
      'bun',
      'test',
      'src/dsxu/engine/__tests__/release-surface-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
    ],
    timeoutMs: 600_000,
  },
  {
    id: 'public-challenge-product-replay',
    command: ['bun', 'run', 'v24:public-challenge'],
    timeoutMs: 1_800_000,
  },
]

const reportPaths = {
  publicChallenge: join(GENERATED_DIR, `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${DATE}.json`),
  c2Loop: join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`),
  interactiveTui: join(GENERATED_DIR, `DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_${DATE}.json`),
  completedReacceptance: join(GENERATED_DIR, `DSXU_V24_COMPLETED_REACCEPTANCE_${DATE}.json`),
  seniorCodingWindow: join(GENERATED_DIR, `DSXU_V24_SENIOR_CODING_WINDOW_${DATE}.json`),
  cleanExportPreflight: join(GENERATED_DIR, `DSXU_V20_CLEAN_EXPORT_PREFLIGHT_${DATE}.json`),
}

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

async function runCommand(id: string, command: string[], timeoutMs: number): Promise<CommandRun> {
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
      // Continue with the next candidate.
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
      // Raw event is preserved in the trace file.
    }
  }
  resultJson ??= lastAssistantJson
  return { resultJson, costUSD, modelUsage }
}

async function runFlashReview(id: string, prompt: string): Promise<FlashReview> {
  const tracePath = join(TRACE_DIR, `${id}-${nowSafe()}.jsonl`)
  const run = await runCommand(id, [
    'bun',
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    '-p',
    '--verbose',
    '--model',
    'deepseek-v4-flash',
    '--max-turns',
    '8',
    '--output-format',
    'stream-json',
    '--tools',
    'Read',
    '--permission-mode',
    'dontAsk',
    prompt,
  ], 600_000)
  const combined = (await readFile(run.stdoutPath, 'utf8')) + (await readFile(run.stderrPath, 'utf8'))
  await writeFile(tracePath, combined, 'utf8')
  const parsed = parseStreamJson(combined)
  return {
    ...run,
    tracePath,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    modelUsage: parsed.modelUsage,
  }
}

function statusFrom(report: Record<string, unknown> | null): string {
  const status = report?.status
  return typeof status === 'string' ? status : 'MISSING'
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function summarizeReport(id: string, path: string, report: Record<string, unknown> | null): EvidenceReport {
  const coverage = report?.coverage && typeof report.coverage === 'object'
    ? report.coverage as Record<string, unknown>
    : {}
  return {
    id,
    path,
    status: statusFrom(report),
    summary: {
      commandPass: report?.commandPass,
      flashPass: report?.flashPass,
      c2Pass: report?.c2Pass,
      tuiPass: report?.tuiPass,
      completedPass: report?.completedPass,
      cleanPass: report?.cleanPass,
      flashReviewPass: report?.flashReviewPass,
      primaryPassed: coverage.primaryPassed,
      secondaryPassed: coverage.secondaryPassed,
      passedRows: coverage.passedRows,
      openRows: coverage.openRows,
      canCreateCleanExport: report?.canCreateCleanExport,
      didCreateExport: report?.didCreateExport,
      blockers: Array.isArray(report?.blockers) ? report.blockers.length : undefined,
      scoreFloor: report?.scoreFloor,
    },
  }
}

function flashReviewPass(run: FlashReview): boolean {
  return (
    run.exitCode === 0 &&
    run.resultJson !== null &&
    isTrue(run.resultJson.did_read_source_truth) &&
    isTrue(run.resultJson.flash_first_policy_respected) &&
    isTrue(run.resultJson.no_second_runtime) &&
    !isTrue(run.resultJson.pro_needed)
  )
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => escapeCell(row[column])).join(' | ')} |`),
  ].join('\n')
}

function publicChallengePass(report: Record<string, unknown> | null): boolean {
  return (
    statusFrom(report) === 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY' &&
    isTrue(report?.commandPass) &&
    isTrue(report?.flashPass) &&
    isTrue(report?.c2Pass) &&
    isTrue(report?.tuiPass) &&
    isTrue(report?.completedPass) &&
    isTrue(report?.seniorCodingPass) &&
    isTrue(report?.cleanPass)
  )
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const startedAt = Date.now()
  const commandRuns: CommandRun[] = []
  for (const batch of commandBatches) {
    commandRuns.push(await runCommand(batch.id, batch.command, batch.timeoutMs))
  }

  const reports = {
    publicChallenge: await readJson(reportPaths.publicChallenge),
    c2Loop: await readJson(reportPaths.c2Loop),
    interactiveTui: await readJson(reportPaths.interactiveTui),
    completedReacceptance: await readJson(reportPaths.completedReacceptance),
    seniorCodingWindow: await readJson(reportPaths.seniorCodingWindow),
    cleanExportPreflight: await readJson(reportPaths.cleanExportPreflight),
  }

  const evidenceReports = [
    summarizeReport('public-challenge', reportPaths.publicChallenge, reports.publicChallenge),
    summarizeReport('c2-loop', reportPaths.c2Loop, reports.c2Loop),
    summarizeReport('interactive-tui', reportPaths.interactiveTui, reports.interactiveTui),
    summarizeReport('completed-reacceptance', reportPaths.completedReacceptance, reports.completedReacceptance),
    summarizeReport('senior-coding-window', reportPaths.seniorCodingWindow, reports.seniorCodingWindow),
    summarizeReport('clean-export-preflight', reportPaths.cleanExportPreflight, reports.cleanExportPreflight),
  ]

  const reviewInput = {
    id: `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_REVIEW_INPUT_${DATE}`,
    generatedAt: new Date().toISOString(),
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      proAdmission: 'blocked unless Flash conflict or explicit rescue evidence exists',
      final95ClaimAllowed: false,
      reasonFinal95Blocked: [
        'fixed public benchmark/product demo comparison data is not created by this runner',
        'six-stage final tests, clean export artifact, and fresh install smoke are not created in this runner',
      ],
    },
    commandRuns,
    evidenceReports,
    fixedTaskDefinition: {
      id: 'DSXU-BENCH-V24-01',
      name: 'single-pass query loop, public product evidence, and release claim guard',
      expectedSeniorBehavior: [
        'read source truth before claiming completion',
        'catch duplicated model/runtime execution and prove it with a regression',
        'keep public claims below the evidence floor',
        'use Flash first and avoid Pro when Flash can finish the review',
        'keep tool, permission, model cost, C2, TUI, and release evidence on DSXU-owned owners',
      ],
    },
  }
  await writeFile(REVIEW_INPUT, `${JSON.stringify(reviewInput, null, 2)}\n`, 'utf8')

  const sourceTruthPrompt = [
    'You are reviewing DSXU V24 complex task acceptance. Use only Read tool evidence. First read every file listed below, then output only compact JSON.',
    '',
    'Files to read:',
    REVIEW_INPUT,
    join(ROOT, 'src', 'dsxu', 'engine', 'query-loop.ts'),
    join(ROOT, 'src', 'dsxu', 'engine', '__tests__', 'query-loop-run-query-v1.test.ts'),
    join(ROOT, 'docs', `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${DATE}.md`),
    join(ROOT, 'docs', `DSXU_V24_EXECUTION_PLAN_${DATE}.md`),
    '',
    'Return JSON keys exactly:',
    '{',
    '  "did_read_source_truth": true,',
    '  "single_pass_bug_fixed": true,',
    '  "regression_evidence_present": true,',
    '  "public_challenge_package_ready": true,',
    '  "flash_first_policy_respected": true,',
    '  "pro_needed": false,',
    '  "no_second_runtime": true,',
    '  "claim_guard_correct": true,',
    '  "final_95_claim_allowed": false,',
    '  "score_0_100": 0,',
    '  "risks": []',
    '}',
  ].join('\n')

  const benchmarkPrompt = [
    'You are auditing DSXU V24 public benchmark readiness. Use only Read tool evidence. First read every file listed below, then output only compact JSON.',
    '',
    'Files to read:',
    REVIEW_INPUT,
    reportPaths.publicChallenge,
    reportPaths.c2Loop,
    reportPaths.interactiveTui,
    reportPaths.completedReacceptance,
    reportPaths.seniorCodingWindow,
    '',
    'Judge whether this is a real complex-task acceptance package, while keeping final 95-point claims blocked until the remaining gates are truly done.',
    'Return JSON keys exactly:',
    '{',
    '  "did_read_source_truth": true,',
    '  "complex_task_package_ready": true,',
    '  "fixed_benchmark_definition_present": true,',
    '  "c2_behavior_matrix_present": true,',
    '  "tui_replay_present": true,',
    '  "completed_reacceptance_present": true,',
    '  "clean_export_preflight_present": true,',
    '  "flash_first_policy_respected": true,',
    '  "pro_needed": false,',
    '  "no_second_runtime": true,',
    '  "final_95_claim_allowed": false,',
    '  "score_0_100": 0,',
    '  "risks": []',
    '}',
  ].join('\n')

  const flashReviews = [
    await runFlashReview('flash-source-truth-complex-task-review', sourceTruthPrompt),
    await runFlashReview('flash-public-benchmark-readiness-review', benchmarkPrompt),
  ]

  const commandPass = commandRuns.every(run => run.exitCode === 0)
  const flashPass = flashReviews.every(flashReviewPass) &&
    isTrue(flashReviews[0]?.resultJson?.single_pass_bug_fixed) &&
    isTrue(flashReviews[0]?.resultJson?.public_challenge_package_ready) &&
    isTrue(flashReviews[1]?.resultJson?.complex_task_package_ready) &&
    isTrue(flashReviews[1]?.resultJson?.fixed_benchmark_definition_present)
  const publicPass = publicChallengePass(reports.publicChallenge)
  const totalDurationMs = Date.now() - startedAt
  const continuousWindowSatisfied = totalDurationMs >= 30 * 60 * 1000
  const final95ClaimAllowed = false
  const proWasRun = false
  const totalFlashCostUSD = flashReviews.reduce((sum, review) => sum + review.costUSD, 0)
  const scores = flashReviews
    .map(review => numberFrom(review.resultJson?.score_0_100))
    .filter((value): value is number => value !== undefined)
  const scoreFloor = scores.length > 0 ? Math.min(...scores) : 0
  const status = commandPass && flashPass && publicPass
    ? 'PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY'
    : 'FAIL_COMPLEX_TASK_ACCEPTANCE_PACK'

  const blockedClaims = [
    'Do not claim final V24 95-point target is reached until fixed public benchmark/product demo data, six-stage tests, clean export artifact, and fresh install/release smoke are recorded.',
    'Do not claim public benchmark superiority until a fixed comparable public task set has external baseline data.',
    'Do not claim release completion until clean export artifact and fresh install/release smoke are created and pass.',
  ]

  const report = {
    id: `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_${DATE}`,
    generatedAt: new Date().toISOString(),
    status,
    commandPass,
    flashPass,
    publicPass,
    proWasRun,
    totalFlashCostUSD,
    totalDurationMs,
    continuousWindowSatisfied,
    final95ClaimAllowed,
    scoreFloor,
    blockedClaims,
    commandRuns,
    flashReviews,
    evidenceReports,
    reviewInputPath: REVIEW_INPUT,
  }

  const commandRows = commandRuns.map(run => ({
    id: run.id,
    exit: run.exitCode,
    durationMs: run.durationMs,
    stdout: run.stdoutPath,
    stderr: run.stderrPath,
  }))
  const reviewRows = flashReviews.map(run => ({
    id: run.id,
    exit: run.exitCode,
    pass: flashReviewPass(run),
    score: run.resultJson?.score_0_100,
    costUSD: run.costUSD,
    trace: run.tracePath,
  }))
  const evidenceRows = evidenceReports.map(item => ({
    id: item.id,
    status: item.status,
    path: item.path,
  }))

  const md = [
    `# DSXU V24 Complex Task Acceptance - ${DATE}`,
    '',
    `Status: ${status}`,
    '',
    '## Scope',
    '',
    'This is a real DSXU complex-task acceptance pack. It replays product-entry evidence, query-loop cost/runtime regression, release-surface regression, C2 behavior matrix, real TUI replay, completed-feature reacceptance, clean-export preflight, and two DeepSeek Flash reviews. It does not create a release export and does not claim the final 95-point target.',
    '',
    '## Result',
    '',
    markdownTable([
      { key: 'commandPass', value: commandPass },
      { key: 'flashPass', value: flashPass },
      { key: 'publicPass', value: publicPass },
      { key: 'proWasRun', value: proWasRun },
      { key: 'totalFlashCostUSD', value: totalFlashCostUSD },
      { key: 'totalDurationMs', value: totalDurationMs },
      { key: 'continuousWindowSatisfied', value: continuousWindowSatisfied },
      { key: 'final95ClaimAllowed', value: final95ClaimAllowed },
      { key: 'scoreFloor', value: scoreFloor },
    ], ['key', 'value']),
    '',
    '## Command Evidence',
    '',
    markdownTable(commandRows, ['id', 'exit', 'durationMs', 'stdout', 'stderr']),
    '',
    '## DeepSeek Flash Reviews',
    '',
    markdownTable(reviewRows, ['id', 'exit', 'pass', 'score', 'costUSD', 'trace']),
    '',
    '## Upstream Evidence',
    '',
    markdownTable(evidenceRows, ['id', 'status', 'path']),
    '',
    '## Blocked Claims',
    '',
    ...blockedClaims.map(item => `- ${item}`),
    '',
    '## Files',
    '',
    `- JSON: ${OUT_JSON}`,
    `- Review input: ${REVIEW_INPUT}`,
    '',
  ].join('\n')

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, md, 'utf8')

  if (status !== 'PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY') {
    console.error(`V24 complex task acceptance failed: ${status}`)
    console.error(JSON.stringify({
      commandPass,
      flashPass,
      publicPass,
      commandRuns: commandRuns.map(run => ({ id: run.id, exitCode: run.exitCode })),
      flashReviews: flashReviews.map(run => ({ id: run.id, exitCode: run.exitCode, resultJson: run.resultJson })),
    }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({
    status,
    commandPass,
    flashPass,
    publicPass,
    proWasRun,
    totalFlashCostUSD,
    totalDurationMs,
    continuousWindowSatisfied,
    final95ClaimAllowed,
    scoreFloor,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
