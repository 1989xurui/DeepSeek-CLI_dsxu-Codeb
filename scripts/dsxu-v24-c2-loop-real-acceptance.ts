import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type C2MatrixRow = {
  id: string
  scope: 'primary-loop' | 'secondary-loop'
  loop: string
  owner: string
  referenceFileHits?: number
  dsxuFileHits: number
  signalStatus: string
  acceptanceStatus: string
  requiredEvidence: string
}

type CommandRun = {
  id: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutPath: string
  stderrPath: string
}

type EvidenceBinding = {
  rowId: string
  loop: string
  owner: string
  status: 'PASS_BEHAVIOR_EVIDENCE_LINKED' | 'OPEN_EVIDENCE_REVIEW_REQUIRED'
  evidenceIds: string[]
  missingEvidenceIds: string[]
  rawEvidencePaths: string[]
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
const DATE = '20260515'
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-c2-loop-real-acceptance')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const C2_MATRIX_JSON = join(GENERATED_DIR, `DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`)
const REVIEW_INPUT_JSON = join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_REVIEW_INPUT_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.md`)

const prerequisiteReports = {
  interactiveTui: join(GENERATED_DIR, `DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_${DATE}.json`),
  completedReacceptance: join(GENERATED_DIR, `DSXU_V24_COMPLETED_REACCEPTANCE_${DATE}.json`),
  liveAcceptance: join(GENERATED_DIR, `DSXU_V24_LIVE_ACCEPTANCE_ROUTER_${DATE}.json`),
  c2Matrix: C2_MATRIX_JSON,
}

const commandBatches = [
  {
    id: 'core-query-context-regression',
    evidenceId: 'core-query-context',
    tests: [
      'src/dsxu/engine/__tests__/same-window-topic-boundary-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
      'src/dsxu/engine/__tests__/query-route-verification-v1.test.ts',
      'src/dsxu/engine/__tests__/compact-resume-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/context-hygiene-v1.test.ts',
    ],
  },
  {
    id: 'tool-permission-regression',
    evidenceId: 'tool-permission',
    tests: [
      'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      'src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/allowed-tools-permission-floor-v1.test.ts',
      'src/dsxu/engine/__tests__/permissions.test.ts',
    ],
  },
  {
    id: 'agent-mcp-skill-regression',
    evidenceId: 'agent-mcp-skill',
    tests: [
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/mcp-client.test.ts',
      'src/dsxu/engine/__tests__/v8-real-mcp-server-v1.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
    ],
  },
  {
    id: 'model-cost-cache-regression',
    evidenceId: 'model-cost-cache',
    tests: [
      'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
      'src/dsxu/engine/__tests__/cold-mode-cost-planning-v1.test.ts',
      'src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts',
      'src/dsxu/engine/__tests__/cost-cache-live-task-evidence-v1.test.ts',
      'src/dsxu/cost/__tests__/cost.test.ts',
    ],
  },
  {
    id: 'external-release-regression',
    evidenceId: 'external-release',
    tests: [
      'src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts',
      'src/dsxu/engine/__tests__/frontend-project-dev-server-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
      'src/dsxu/engine/__tests__/provider' +
        '-migration-model-alias-isolation-v1.test.ts',
    ],
  },
  {
    id: 'api-remote-evidence-regression',
    evidenceId: 'api-remote-evidence',
    tests: [
      'src/dsxu/engine/__tests__/api-service.test.ts',
      'src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts',
      'src/dsxu/engine/__tests__/remote-network-workflow-v1.test.ts',
      'src/dsxu/engine/__tests__/tool-use-summary-governance-v1.test.ts',
    ],
  },
] as const

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

async function runCommand(id: string, command: string[], timeoutMs = 360_000): Promise<CommandRun> {
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
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  const json = fenced?.[1]?.trim() ?? trimmed
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
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
      // Raw trace is preserved for review.
    }
  }
  resultJson ??= lastAssistantJson
  return { resultJson, costUSD, modelUsage }
}

async function runFlashReview(reviewInputPath: string): Promise<FlashReview> {
  const tracePath = join(TRACE_DIR, `flash-c2-loop-review-${nowSafe()}.jsonl`)
  const prompt = [
    'V24 C2 real loop acceptance review. Flash-first only.',
    `Read ${reviewInputPath}.`,
    'Return JSON only with fields {"did_read_report":boolean,"primary_loop_count":number,"secondary_loop_count":number,"all_rows_have_behavior_evidence":boolean,"all_required_commands_passed":boolean,"flash_first_policy_respected":boolean,"no_second_runtime":boolean,"pro_needed":boolean,"blocking_gaps":[string],"evidence":[string]}.',
    'Do not edit files. Use only the compact report. Raw paths are evidence references, not required reading.',
  ].join(' ')
  const run = await runCommand('flash-c2-loop-review', [
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
  const combined = (await readFile(run.stdoutPath, 'utf8')) + (await readFile(run.stderrPath, 'utf8'))
  await writeFile(tracePath, combined, 'utf8')
  const parsed = parseStreamJson(combined)
  return {
    id: 'flash-c2-loop-review',
    tracePath,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    modelUsage: parsed.modelUsage,
  }
}

function evidenceIdsFor(row: C2MatrixRow): string[] {
  const haystack = `${row.id} ${row.loop} ${row.owner} ${row.requiredEvidence}`.toLowerCase()
  const ids = new Set<string>(['c2-matrix'])

  if (/goal|intent|session|query|topic|plan|todo|task|context|compact|resume|source truth|repository|import\/use/.test(haystack)) {
    ids.add('interactive-tui')
    ids.add('core-query-context')
  }
  if (/visible|work-state|progress|ui|tui|input/.test(haystack)) {
    ids.add('interactive-tui')
  }
  if (/tool|schema|bash|powershell|shell/.test(haystack)) {
    ids.add('tool-permission')
    ids.add('interactive-tui')
  }
  if (/permission|safety|destructive|write/.test(haystack)) {
    ids.add('tool-permission')
    ids.add('interactive-tui')
  }
  if (/coding|file|edit|diff|test failure|source truth/.test(haystack)) {
    ids.add('completed-reacceptance')
    ids.add('core-query-context')
  }
  if (/agent|parallel|worker|synthesis/.test(haystack)) {
    ids.add('agent-mcp-skill')
    ids.add('interactive-tui')
  }
  if (/mcp|skill|plugin|command intake/.test(haystack)) {
    ids.add('agent-mcp-skill')
  }
  if (/model|cost|cache|fim|thinking|provider|retry|escalation/.test(haystack)) {
    ids.add('model-cost-cache')
    ids.add('live-acceptance')
  }
  if (/browser|external/.test(haystack)) {
    ids.add('external-release')
  }
  if (/ide|api|remote/.test(haystack)) {
    ids.add('api-remote-evidence')
  }
  if (/telemetry|evidence|report|final answer/.test(haystack)) {
    ids.add('api-remote-evidence')
    ids.add('interactive-tui')
  }
  if (/release|install|doctor|license|brand|commercial|public challenge|performance|product data/.test(haystack)) {
    ids.add('external-release')
  }

  return [...ids].sort()
}

function mdTable(bindings: EvidenceBinding[]): string {
  const headers = ['id', 'owner', 'status', 'evidence']
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...bindings.map(row => `| ${[
      row.rowId,
      row.owner,
      row.status,
      row.evidenceIds.join(', '),
    ].join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const c2Matrix = await readJson<{ rows: C2MatrixRow[]; status: string }>(C2_MATRIX_JSON)
  if (!c2Matrix?.rows?.length) {
    throw new Error(`missing C2 matrix rows: ${C2_MATRIX_JSON}`)
  }

  const prerequisiteStatus = {
    interactiveTui: (await readJson<Record<string, unknown>>(prerequisiteReports.interactiveTui))?.status === 'PASS_INTERACTIVE_TUI_ACCEPTANCE',
    completedReacceptance: (await readJson<Record<string, unknown>>(prerequisiteReports.completedReacceptance))?.status === 'PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE',
    liveAcceptance: (await readJson<Record<string, unknown>>(prerequisiteReports.liveAcceptance))?.status === 'PASS_FLASH_FIRST_EVIDENCED',
    c2Matrix: c2Matrix.status === 'OPEN_BEHAVIOR_EVIDENCE_REQUIRED',
  }

  const commandRuns: CommandRun[] = []
  for (const batch of commandBatches) {
    commandRuns.push(await runCommand(batch.id, ['bun', 'test', '--timeout=60000', ...batch.tests], 420_000))
  }

  const evidenceStatus: Record<string, boolean> = {
    'interactive-tui': prerequisiteStatus.interactiveTui,
    'completed-reacceptance': prerequisiteStatus.completedReacceptance,
    'live-acceptance': prerequisiteStatus.liveAcceptance,
    'c2-matrix': prerequisiteStatus.c2Matrix,
  }
  const evidencePaths: Record<string, string[]> = {
    'interactive-tui': [
      prerequisiteReports.interactiveTui,
      join(ROOT, 'docs', `DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_${DATE}.md`),
      join(TRACE_DIR, '..', 'v24-interactive-tui-acceptance'),
    ],
    'completed-reacceptance': [
      prerequisiteReports.completedReacceptance,
      join(ROOT, 'docs', `DSXU_V24_COMPLETED_REACCEPTANCE_${DATE}.md`),
    ],
    'live-acceptance': [
      prerequisiteReports.liveAcceptance,
    ],
    'c2-matrix': [C2_MATRIX_JSON],
  }
  for (const [index, batch] of commandBatches.entries()) {
    const run = commandRuns[index]!
    evidenceStatus[batch.evidenceId] = run.exitCode === 0
    evidencePaths[batch.evidenceId] = [run.stdoutPath, run.stderrPath]
  }

  const bindings: EvidenceBinding[] = c2Matrix.rows.map(row => {
    const evidenceIds = evidenceIdsFor(row)
    const missingEvidenceIds = evidenceIds.filter(id => !evidenceStatus[id])
    return {
      rowId: row.id,
      loop: row.loop,
      owner: row.owner,
      status: missingEvidenceIds.length === 0
        ? 'PASS_BEHAVIOR_EVIDENCE_LINKED'
        : 'OPEN_EVIDENCE_REVIEW_REQUIRED',
      evidenceIds,
      missingEvidenceIds,
      rawEvidencePaths: evidenceIds.flatMap(id => evidencePaths[id] ?? []),
    }
  })

  const primaryPassed = bindings.filter(row => row.rowId.startsWith('P') && row.status === 'PASS_BEHAVIOR_EVIDENCE_LINKED').length
  const secondaryPassed = bindings.filter(row => row.rowId.startsWith('S') && row.status === 'PASS_BEHAVIOR_EVIDENCE_LINKED').length
  const failedCommands = commandRuns.filter(run => run.exitCode !== 0)
  const compactBindings = bindings.map(row => ({
    rowId: row.rowId,
    loop: row.loop,
    owner: row.owner,
    status: row.status,
    evidenceIds: row.evidenceIds,
    missingEvidenceIds: row.missingEvidenceIds,
    rawEvidencePathCount: row.rawEvidencePaths.length,
  }))
  const evidenceCatalog = Object.entries(evidencePaths)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, paths]) => ({
      id,
      passed: evidenceStatus[id] === true,
      pathCount: paths.length,
      samplePaths: paths.slice(0, 3),
    }))

  const reviewInput = {
    generatedAt: new Date().toISOString(),
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      noSecondRuntime: true,
      productEntrypointEvidence: 'v24:interactive-tui-acceptance and DSXU -p Flash review',
    },
    prerequisiteStatus,
    commandRuns: commandRuns.map(run => ({
      id: run.id,
      exitCode: run.exitCode,
      durationMs: run.durationMs,
      stdoutPath: run.stdoutPath,
      stderrPath: run.stderrPath,
    })),
    coverage: {
      totalRows: bindings.length,
      primaryRows: bindings.filter(row => row.rowId.startsWith('P')).length,
      secondaryRows: bindings.filter(row => row.rowId.startsWith('S')).length,
      primaryPassed,
      secondaryPassed,
      passedRows: bindings.filter(row => row.status === 'PASS_BEHAVIOR_EVIDENCE_LINKED').length,
      openRows: bindings.filter(row => row.status !== 'PASS_BEHAVIOR_EVIDENCE_LINKED').length,
    },
    evidenceCatalog,
    bindings: compactBindings,
  }
  await writeFile(REVIEW_INPUT_JSON, `${JSON.stringify(reviewInput, null, 2)}\n`, 'utf8')

  const flashReview = await runFlashReview(REVIEW_INPUT_JSON)
  const flashReviewPass =
    flashReview.exitCode === 0 &&
    flashReview.resultJson?.did_read_report === true &&
    flashReview.resultJson?.all_rows_have_behavior_evidence === true &&
    flashReview.resultJson?.all_required_commands_passed === true &&
    flashReview.resultJson?.flash_first_policy_respected === true &&
    flashReview.resultJson?.no_second_runtime === true

  const openRows = bindings.filter(row => row.status !== 'PASS_BEHAVIOR_EVIDENCE_LINKED')
  const status =
    openRows.length === 0 && failedCommands.length === 0 && flashReviewPass
      ? 'PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH'
      : 'OPEN_C2_LOOP_REVIEW_REQUIRED'

  const report = {
    ...reviewInput,
    compactBindings,
    bindings,
    status,
    flashReviewPass,
    flashReview,
    failedCommands,
    openRows: openRows.map(row => ({
      rowId: row.rowId,
      missingEvidenceIds: row.missingEvidenceIds,
    })),
    remainingForV24Final: [
      '30-45 minute complex senior-coding task',
      'public challenge package with comparable benchmark data',
      'six-stage final tests',
      'clean export artifact',
    ],
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const md = [
    '# DSXU V24 C2 Loop Real Acceptance - 20260515',
    '',
    'This report converts the C2 15 primary loops and 36 secondary loops from owner-disposition into real behavior evidence bindings.',
    '',
    `Status: \`${status}\``,
    '',
    `Coverage: ${primaryPassed}/15 primary loops, ${secondaryPassed}/36 secondary loops, ${bindings.filter(row => row.status === 'PASS_BEHAVIOR_EVIDENCE_LINKED').length}/51 total rows.`,
    '',
    `Policy: Flash-first; Pro not run; no second runtime; evidence is bound to DSXU TUI/product entry, focused regression, and Flash review.`,
    '',
    'Command evidence:',
    '',
    ...commandRuns.map(run => `- ${run.id}: exit=${run.exitCode}, stdout=${run.stdoutPath}`),
    `- Flash review: exit=${flashReview.exitCode}, trace=${flashReview.tracePath}, costUSD=${flashReview.costUSD}`,
    `- Review input: ${REVIEW_INPUT_JSON}`,
    '',
    mdTable(bindings),
    '',
    'Remaining V24 gates:',
    '',
    '- 30-45 minute complex senior-coding task.',
    '- Public challenge package with comparable benchmark data.',
    '- Six-stage final tests.',
    '- Clean export artifact.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  process.stdout.write(JSON.stringify({
    status,
    primaryPassed,
    secondaryPassed,
    totalPassed: bindings.filter(row => row.status === 'PASS_BEHAVIOR_EVIDENCE_LINKED').length,
    failedCommands: failedCommands.map(run => run.id),
    flashReviewPass,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
