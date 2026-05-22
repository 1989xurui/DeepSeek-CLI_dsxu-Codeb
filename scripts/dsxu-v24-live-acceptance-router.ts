import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

type CommandRun = {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

type ModelRun = CommandRun & {
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
  tracePath: string
  resultJson: Record<string, unknown> | null
  modelUsage: Record<string, unknown> | null
}

type RouteStep = {
  step: string
  model?: string
  status: string
  reason: string
  tracePath?: string
  costUSD?: number
}

const ROOT = process.cwd()
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-live-dsxu')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V24_LIVE_ACCEPTANCE_ROUTER_20260515.json')

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function runCommand(args: string[], options?: {
  cwd?: string
  timeoutMs?: number
  stdoutPath?: string
}): Promise<CommandRun> {
  const start = Date.now()
  const proc = Bun.spawn(args, {
    cwd: options?.cwd ?? ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutMs = options?.timeoutMs ?? 180_000
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`command timed out after ${timeoutMs}ms: ${args.join(' ')}`))
    }, timeoutMs)
  })
  try {
    const exitCode = await Promise.race([proc.exited, timeout])
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    if (options?.stdoutPath) {
      await mkdir(dirname(options.stdoutPath), { recursive: true })
      await writeFile(options.stdoutPath, stdout + stderr, 'utf8')
    }
    return {
      exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - start,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function stripMarkdownJson(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fence?.[1]?.trim() ?? trimmed
}

function parseResultJson(result: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stripMarkdownJson(result)) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseStreamResult(jsonl: string): {
  resultJson: Record<string, unknown> | null
  modelUsage: Record<string, unknown> | null
  costUSD: number
} {
  let resultJson: Record<string, unknown> | null = null
  let modelUsage: Record<string, unknown> | null = null
  let costUSD = 0
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      if (event.type === 'result') {
        if (typeof event.result === 'string') resultJson = parseResultJson(event.result)
        if (event.modelUsage && typeof event.modelUsage === 'object') {
          modelUsage = event.modelUsage as Record<string, unknown>
        }
        if (typeof event.total_cost_usd === 'number') costUSD = event.total_cost_usd
      }
    } catch {
      // Keep raw trace authoritative; parse failures are reported in summary.
    }
  }
  return { resultJson, modelUsage, costUSD }
}

async function runDsxuModel(input: {
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
  prompt: string
  label: string
}): Promise<ModelRun> {
  const tracePath = join(TRACE_DIR, `${input.label}-${nowSafe()}.jsonl`)
  const run = await runCommand([
    'bun',
    '--env-file=.env',
    './src/entrypoints/dsxu-code.tsx',
    '-p',
    '--verbose',
    '--model',
    input.model,
    '--max-turns',
    '4',
    '--output-format',
    'stream-json',
    '--tools',
    'Read',
    '--permission-mode',
    'dontAsk',
    input.prompt,
  ], { timeoutMs: 300_000, stdoutPath: tracePath })
  const parsed = parseStreamResult(run.stdout + run.stderr)
  return {
    ...run,
    model: input.model,
    tracePath,
    resultJson: parsed.resultJson,
    modelUsage: parsed.modelUsage,
  }
}

async function readSourceTruth() {
  const [pbtSource, pbtTest] = await Promise.all([
    readFile(join(ROOT, 'src', 'services', 'pbt', 'index.ts'), 'utf8'),
    readFile(join(ROOT, 'src', 'services', 'pbt', '__tests__', 'pbt.test.ts'), 'utf8'),
  ])
  return {
    realRunnerSource:
      pbtSource.includes("Bun.spawn(['bun', 'test', testFile]") &&
      pbtSource.includes('mkdtemp') &&
      pbtSource.includes('writeFile(testFile, testCode'),
    realRunnerTests:
      pbtTest.includes('real runner executes passing Bun test code') &&
      pbtTest.includes('real runner reports failing Bun test output'),
  }
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

function needsProRescue(input: {
  expectedRealRunner: boolean
  flashPrimary: ModelRun
  flashRetry?: ModelRun
}): { needed: boolean; reason: string } {
  const primary = isTrue(input.flashPrimary.resultJson?.real_non_mock_pbt_runner)
  const retry = input.flashRetry
    ? isTrue(input.flashRetry.resultJson?.real_non_mock_pbt_runner)
    : undefined
  if (primary === input.expectedRealRunner) {
    return { needed: false, reason: 'flash-primary matched source truth' }
  }
  if (retry === input.expectedRealRunner) {
    return { needed: false, reason: 'flash-retry corrected the source-truth conflict' }
  }
  return {
    needed: true,
    reason:
      'flash result conflicted with source truth and local regression after retry; Pro rescue is admissible only with explicit DSXU_V24_ALLOW_PRO_RESCUE=1',
  }
}

function costFrom(run: ModelRun): number {
  const text = run.stdout + run.stderr
  const parsed = parseStreamResult(text)
  return parsed.costUSD
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const sourceTruth = await readSourceTruth()
  const localRegression = await runCommand([
    'bun',
    'test',
    'src/services/pbt/__tests__/pbt.test.ts',
  ], { timeoutMs: 120_000 })
  const expectedRealRunner =
    sourceTruth.realRunnerSource &&
    sourceTruth.realRunnerTests &&
    localRegression.exitCode === 0

  const flashPrompt = [
    'V24 Flash-first live acceptance. Use source truth only.',
    'Read src/services/pbt/index.ts and src/services/pbt/__tests__/pbt.test.ts.',
    'Return JSON only, no markdown, with fields:',
    '{"did_read_source":boolean,"did_read_tests":boolean,"real_non_mock_pbt_runner":boolean,"source_evidence":[string],"test_evidence":[string],"pro_needed":boolean,"pro_admission_reason":string}.',
    'Do not edit files.',
  ].join(' ')
  const flashPrimary = await runDsxuModel({
    model: 'deepseek-v4-flash',
    label: 'v24-flash-first-pbt-source-truth',
    prompt: flashPrompt,
  })

  let flashRetry: ModelRun | undefined
  if (isTrue(flashPrimary.resultJson?.real_non_mock_pbt_runner) !== expectedRealRunner) {
    flashRetry = await runDsxuModel({
      model: 'deepseek-v4-flash',
      label: 'v24-flash-retry-pbt-source-truth',
      prompt: [
        'V24 Flash retry after source-truth conflict. Do not reason from runtime assumptions.',
        'Read src/services/pbt/index.ts and src/services/pbt/__tests__/pbt.test.ts again.',
        'If source shows mkdtemp/writeFile and Bun.spawn(["bun","test",testFile]) in the non-mock path, return real_non_mock_pbt_runner=true.',
        'Return JSON only with fields {"did_read_source":boolean,"did_read_tests":boolean,"real_non_mock_pbt_runner":boolean,"source_evidence":[string],"test_evidence":[string],"pro_needed":boolean,"pro_admission_reason":string}.',
      ].join(' '),
    })
  }

  const proDecision = needsProRescue({
    expectedRealRunner,
    flashPrimary,
    flashRetry,
  })
  const allowPro = process.env.DSXU_V24_ALLOW_PRO_RESCUE === '1'
  let proRun: ModelRun | undefined
  if (proDecision.needed && allowPro) {
    proRun = await runDsxuModel({
      model: 'deepseek-v4-pro',
      label: 'v24-pro-rescue-pbt-source-truth',
      prompt: [
        'V24 Pro rescue. Flash evidence conflicted with source truth after retry.',
        'Read src/services/pbt/index.ts and src/services/pbt/__tests__/pbt.test.ts.',
        'Return JSON only with fields {"did_read_source":boolean,"did_read_tests":boolean,"real_non_mock_pbt_runner":boolean,"source_evidence":[string],"test_evidence":[string],"pro_needed":boolean,"pro_admission_reason":string}.',
      ].join(' '),
    })
  }

  const steps: RouteStep[] = [
    {
      step: 'local-source-truth',
      status: expectedRealRunner ? 'PASS' : 'FAIL',
      reason: 'source and tests define the expected truth before model judgment',
    },
    {
      step: 'local-regression',
      status: localRegression.exitCode === 0 ? 'PASS' : 'FAIL',
      reason: 'local regression supports or rejects the source-truth claim',
    },
    {
      step: 'flash-primary',
      model: 'deepseek-v4-flash',
      status: flashPrimary.exitCode === 0 ? 'DONE' : 'FAILED',
      reason: 'Flash is the default DSXU V24 live acceptance model',
      tracePath: flashPrimary.tracePath,
      costUSD: costFrom(flashPrimary),
    },
  ]
  if (flashRetry) {
    steps.push({
      step: 'flash-retry',
      model: 'deepseek-v4-flash',
      status: flashRetry.exitCode === 0 ? 'DONE' : 'FAILED',
      reason: 'Flash retry is required before any Pro admission for source-truth conflicts',
      tracePath: flashRetry.tracePath,
      costUSD: costFrom(flashRetry),
    })
  }
  steps.push({
    step: 'pro-rescue',
    model: 'deepseek-v4-pro',
    status: proDecision.needed ? (allowPro ? 'RUN' : 'NOT_RUN_POLICY_GATED') : 'NOT_NEEDED',
    reason: proDecision.reason,
    tracePath: proRun?.tracePath,
    costUSD: proRun ? costFrom(proRun) : 0,
  })

  const finalModelJson = proRun?.resultJson ?? flashRetry?.resultJson ?? flashPrimary.resultJson
  const finalMatchesSourceTruth =
    isTrue(finalModelJson?.real_non_mock_pbt_runner) === expectedRealRunner
  const report = {
    schemaVersion: 'dsxu.v24.live-acceptance-router.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(ROOT),
    status: finalMatchesSourceTruth && localRegression.exitCode === 0
      ? 'PASS_FLASH_FIRST_EVIDENCED'
      : 'OPEN_REVIEW_REQUIRED',
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proAdmission:
        'Pro is not a default validation model. It is allowed only for high-risk permission/security, planning, recovery, failed verification, or Flash/source-truth conflict after Flash retry, and only when explicitly enabled.',
      allowProEnv: 'DSXU_V24_ALLOW_PRO_RESCUE=1',
      proWasRun: Boolean(proRun),
    },
    sourceTruth,
    localRegression: {
      exitCode: localRegression.exitCode,
      durationMs: localRegression.durationMs,
      passed: localRegression.exitCode === 0,
    },
    expectedRealRunner,
    finalMatchesSourceTruth,
    steps,
    flashPrimary: {
      resultJson: flashPrimary.resultJson,
      modelUsage: flashPrimary.modelUsage,
    },
    flashRetry: flashRetry
      ? {
          resultJson: flashRetry.resultJson,
          modelUsage: flashRetry.modelUsage,
        }
      : null,
    pro: proRun
      ? {
          resultJson: proRun.resultJson,
          modelUsage: proRun.modelUsage,
        }
      : null,
  }
  await writeFile(SUMMARY_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    proWasRun: report.policy.proWasRun,
    finalMatchesSourceTruth: report.finalMatchesSourceTruth,
    outputJson: SUMMARY_PATH,
  }, null, 2))
}

await main()
