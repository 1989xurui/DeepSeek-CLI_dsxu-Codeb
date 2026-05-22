import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

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

type LiveCheck = {
  id: string
  model: 'deepseek-v4-flash'
  tracePath: string
  exitCode: number
  durationMs: number
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
}

const ROOT = process.cwd()
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-completed-reacceptance')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_COMPLETED_REACCEPTANCE_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_COMPLETED_REACCEPTANCE_20260515.md')

function safeNow(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function runCommand(id: string, command: string[], timeoutMs = 240_000): Promise<CommandRun> {
  const started = Date.now()
  const stdoutPath = join(TRACE_DIR, `${id}-${safeNow()}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${id}-${safeNow()}.stderr.log`)
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
      durationMs: Date.now() - started,
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
      // Keep the raw transcript; parse failure is reflected by resultJson=null.
    }
  }
  resultJson ??= lastAssistantJson
  return { resultJson, costUSD, modelUsage }
}

async function runFlashLiveCheck(input: {
  id: string
  prompt: string
}): Promise<LiveCheck> {
  const tracePath = join(TRACE_DIR, `${input.id}-${safeNow()}.jsonl`)
  const run = await runCommand(input.id, [
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
    input.prompt,
  ], 300_000)
  await writeFile(tracePath, run.stdout + run.stderr, 'utf8')
  const parsed = parseStreamJson(run.stdout + run.stderr)
  return {
    id: input.id,
    model: 'deepseek-v4-flash',
    tracePath,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    modelUsage: parsed.modelUsage,
  }
}

function yes(value: unknown): boolean {
  return value === true || value === 'true'
}

async function readSourceTruth() {
  const [pbt, pbtTest, mutation, mutationTest, tdd, tddTest] = await Promise.all([
    readFile(join(ROOT, 'src/services/pbt/index.ts'), 'utf8'),
    readFile(join(ROOT, 'src/services/pbt/__tests__/pbt.test.ts'), 'utf8'),
    readFile(join(ROOT, 'src/services/mutation/index.ts'), 'utf8'),
    readFile(join(ROOT, 'src/services/mutation/__tests__/mutation.test.ts'), 'utf8'),
    readFile(join(ROOT, 'src/coordinator/tdd-gate/runner.ts'), 'utf8'),
    readFile(join(ROOT, 'src/coordinator/tdd-gate/__tests__/runner.test.ts'), 'utf8'),
  ])
  return {
    pbtRealRunner:
      pbt.includes("Bun.spawn(['bun', 'test', testFile]") &&
      pbt.includes('mkdtemp') &&
      pbtTest.includes('real runner executes passing Bun test code') &&
      pbtTest.includes('real runner reports failing Bun test output'),
    mutationRealRunner:
      mutation.includes('await writeFile(absoluteFile, mutated') &&
      mutation.includes('await writeFile(absoluteFile, original') &&
      mutation.includes('runShellCommand') &&
      mutationTest.includes('real runner mutates a file, runs tests, and restores source'),
    tddRealRunner:
      tdd.includes("config?.testCommand ?? 'bun test {file}'") &&
      tdd.includes('runShellCommand') &&
      tddTest.includes('red phase succeeds') &&
      tddTest.includes('green phase succeeds') &&
      tddTest.includes('green phase blocks'),
  }
}

function assessmentRow(input: {
  id: string
  sourceTruth: boolean
  localRegressionPass: boolean
  live?: LiveCheck
  liveField: string
}) {
  const livePass = input.live
    ? input.live.exitCode === 0 && yes(input.live.resultJson?.[input.liveField]) === input.sourceTruth
    : false
  return {
    id: input.id,
    status:
      input.sourceTruth && input.localRegressionPass && livePass
        ? 'PASS_FLASH_FIRST_REACCEPTED'
        : 'OPEN_REVIEW_REQUIRED',
    sourceTruth: input.sourceTruth,
    localRegressionPass: input.localRegressionPass,
    flashLivePass: livePass,
    flashTracePath: input.live?.tracePath,
    proWasRun: false,
  }
}

function mdTable(rows: Array<Record<string, unknown>>): string {
  const headers = ['id', 'status', 'sourceTruth', 'localRegressionPass', 'flashLivePass', 'proWasRun']
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${headers.map(header => String(row[header] ?? '')).join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const sourceTruth = await readSourceTruth()
  const localRegression = await runCommand('local-real-runner-regression', [
    'bun',
    'test',
    'src/services/pbt/__tests__/pbt.test.ts',
    'src/services/mutation/__tests__/mutation.test.ts',
    'src/coordinator/tdd-gate/__tests__/runner.test.ts',
  ], 180_000)

  const [pbtLive, mutationLive, tddLive] = await Promise.all([
    runFlashLiveCheck({
      id: 'flash-pbt-real-runner',
      prompt: [
        'V24 completed reacceptance, Flash-first only.',
        'Read src/services/pbt/index.ts and src/services/pbt/__tests__/pbt.test.ts.',
        'Return JSON only with fields {"did_read_source":boolean,"did_read_tests":boolean,"pbt_real_runner":boolean,"evidence":[string],"pro_needed":boolean}.',
        'pbt_real_runner must be true only if the non-mock path writes a temp test file and executes bun test.',
      ].join(' '),
    }),
    runFlashLiveCheck({
      id: 'flash-mutation-real-runner',
      prompt: [
        'V24 completed reacceptance, Flash-first only.',
        'Read src/services/mutation/index.ts and src/services/mutation/__tests__/mutation.test.ts.',
        'Return JSON only with fields {"did_read_source":boolean,"did_read_tests":boolean,"mutation_real_runner":boolean,"restores_original_source":boolean,"evidence":[string],"pro_needed":boolean}.',
        'mutation_real_runner must be true only if the non-mock path writes a mutation, runs tests, and restores the original file in finally.',
      ].join(' '),
    }),
    runFlashLiveCheck({
      id: 'flash-tdd-gate-real-runner',
      prompt: [
        'V24 completed reacceptance, Flash-first only.',
        'Read src/coordinator/tdd-gate/runner.ts and src/coordinator/tdd-gate/__tests__/runner.test.ts.',
        'Return JSON only with fields {"did_read_source":boolean,"did_read_tests":boolean,"tdd_gate_real_runner":boolean,"red_green_semantics":boolean,"evidence":[string],"pro_needed":boolean}.',
        'tdd_gate_real_runner must be true only if red/green phases execute real bun test commands through the runner when no mock is supplied.',
      ].join(' '),
    }),
  ])

  const providerGate = await runCommand('live-provider-gate', [
    'bun',
    'run',
    'live:provider-gate',
  ], 120_000)
  const v24Batch = await runCommand('v24-batch-replay', [
    'bun',
    'run',
    'v24:batch',
  ], 300_000)
  const productHelp = await runCommand('product-entry-help', [
    'bun',
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    '--help',
  ], 120_000)

  const localRegressionPass = localRegression.exitCode === 0
  const rows = [
    assessmentRow({
      id: 'pbt-real-runner',
      sourceTruth: sourceTruth.pbtRealRunner,
      localRegressionPass,
      live: pbtLive,
      liveField: 'pbt_real_runner',
    }),
    assessmentRow({
      id: 'mutation-real-runner',
      sourceTruth: sourceTruth.mutationRealRunner,
      localRegressionPass,
      live: mutationLive,
      liveField: 'mutation_real_runner',
    }),
    assessmentRow({
      id: 'tdd-gate-real-runner',
      sourceTruth: sourceTruth.tddRealRunner,
      localRegressionPass,
      live: tddLive,
      liveField: 'tdd_gate_real_runner',
    }),
  ]

  const report = {
    schemaVersion: 'dsxu.v24.completed-reacceptance.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(ROOT),
    status: rows.every(row => row.status === 'PASS_FLASH_FIRST_REACCEPTED') &&
      providerGate.exitCode === 0 &&
      productHelp.exitCode === 0
        ? 'PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE'
        : 'OPEN_REVIEW_REQUIRED',
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      interactiveTuiRequirement:
        'Not satisfied by this automated reacceptance. Completed function claims are reaccepted for source/test/model evidence; full V24 still requires V24_INTERACTIVE_TUI_ACCEPTANCE.',
      v24BatchReplayPolicy:
        'Context only. v24:batch may remain open while final V24 gates are intentionally blocked; it must not turn completed feature reacceptance into a circular final-gate dependency.',
    },
    sourceTruth,
    commandRuns: {
      localRegression: {
        exitCode: localRegression.exitCode,
        durationMs: localRegression.durationMs,
        stdoutPath: localRegression.stdoutPath,
        stderrPath: localRegression.stderrPath,
      },
      providerGate: {
        exitCode: providerGate.exitCode,
        durationMs: providerGate.durationMs,
        stdoutPath: providerGate.stdoutPath,
        stderrPath: providerGate.stderrPath,
      },
      v24Batch: {
        exitCode: v24Batch.exitCode,
        durationMs: v24Batch.durationMs,
        stdoutPath: v24Batch.stdoutPath,
        stderrPath: v24Batch.stderrPath,
        gateRole: 'context-only-final-gate-snapshot',
      },
      productHelp: {
        exitCode: productHelp.exitCode,
        durationMs: productHelp.durationMs,
        stdoutPath: productHelp.stdoutPath,
        stderrPath: productHelp.stderrPath,
      },
    },
    liveChecks: [pbtLive, mutationLive, tddLive].map(check => ({
      id: check.id,
      model: check.model,
      tracePath: check.tracePath,
      exitCode: check.exitCode,
      durationMs: check.durationMs,
      resultJson: check.resultJson,
      costUSD: check.costUSD,
      modelUsage: check.modelUsage,
    })),
    rows,
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const md = [
    '# DSXU V24 Completed Reacceptance - 20260515',
    '',
    'This report retests V24 completed function claims under the updated real acceptance standard.',
    '',
    `Status: \`${report.status}\``,
    '',
    'Policy: Flash-first, Pro not run. Interactive TUI acceptance remains a separate required gate.',
    '',
    mdTable(rows),
    '',
    'Command evidence:',
    '',
    `- local regression: exit=${localRegression.exitCode}, stdout=${localRegression.stdoutPath}`,
    `- live provider gate: exit=${providerGate.exitCode}, stdout=${providerGate.stdoutPath}`,
    `- v24 batch replay: exit=${v24Batch.exitCode}, stdout=${v24Batch.stdoutPath}`,
    `- product help entry: exit=${productHelp.exitCode}, stdout=${productHelp.stdoutPath}`,
    '',
    'Flash live traces:',
    '',
    ...[pbtLive, mutationLive, tddLive].map(check =>
      `- ${check.id}: ${check.tracePath}; costUSD=${check.costUSD}`,
    ),
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  console.log(JSON.stringify({
    status: report.status,
    rows: report.rows,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

await main()
