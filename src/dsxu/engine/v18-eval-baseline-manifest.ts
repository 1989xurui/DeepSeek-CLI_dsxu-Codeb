import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  V18_CODE_10_CASE_IDS,
  V18_TERMINAL_10_CASE_IDS,
  type V18CodeTerminalSuite,
} from './v18-code-terminal-10-runner'

export type V18EvalBaselineVariant =
  | 'flash_bare'
  | 'pro_bare'
  | 'dsxu_cold'
  | 'benchmax'

export type V18EvalBaselineCommand = {
  variant: V18EvalBaselineVariant
  suite: V18CodeTerminalSuite
  order: number
  outDir: string
  reportPath: string
  command: string
  caseIds: string[]
  env: Record<string, string | null>
  runnable: boolean
  blockedReason?: string
}

export type V18EvalBaselineManifest = {
  generatedAt: string
  evidencePath?: string
  caseTimeoutMs: number
  commands: V18EvalBaselineCommand[]
  guards: string[]
}

function shellEnvPrefix(env: Record<string, string | null>): string {
  return Object.entries(env)
    .map(([key, value]) =>
      value === null
        ? `Remove-Item Env:\\${key} -ErrorAction SilentlyContinue`
        : `$env:${key}='${value}'`,
    )
    .join('; ')
}

function benchmarkCommand(input: {
  outDir: string
  entryModel: 'flash' | 'pro' | 'auto'
  caseTimeoutMs: number
  caseIds: readonly string[]
  env: Record<string, string | null>
}): string {
  return [
    shellEnvPrefix(input.env),
    [
      'bun .\\scripts\\benchmark\\dsxu-mainline-benchmark.ts',
      '--live',
      `--out=${input.outDir}`,
      `--entry-model=${input.entryModel}`,
      `--case-timeout-ms=${input.caseTimeoutMs}`,
      ...input.caseIds.map(id => `--case=${id}`),
    ].join(' '),
  ]
    .filter(Boolean)
    .join('; ')
}

function suiteCases(suite: V18CodeTerminalSuite): readonly string[] {
  return suite === 'code' ? V18_CODE_10_CASE_IDS : V18_TERMINAL_10_CASE_IDS
}

function commandFor(input: {
  variant: V18EvalBaselineVariant
  suite: V18CodeTerminalSuite
  order: number
  outPrefix: string
  caseTimeoutMs: number
}): V18EvalBaselineCommand {
  const caseIds = [...suiteCases(input.suite)]
  const outDir = `${input.outPrefix}-${input.variant.replace('_', '-')}-${input.suite}`
  const reportPath = `${outDir}\\live-report.json`
  const common = {
    variant: input.variant,
    suite: input.suite,
    order: input.order,
    outDir,
    reportPath,
    caseIds,
  }

  if (input.variant === 'benchmax') {
    const env = {
      DSXU_BENCH_BASELINE_PROFILE: 'benchmax',
      DSXU_BENCH_MODE: 'benchmax',
      DSXU_BENCH_ENABLE_SEMANTIC_TOOLS: null,
    }
    return {
      ...common,
      env,
      command: benchmarkCommand({
        outDir,
        entryModel: 'auto',
        caseTimeoutMs: input.caseTimeoutMs,
        caseIds,
        env,
      }),
      runnable: false,
      blockedReason:
        'BenchMax requires candidate search/review and benchmaxCandidateCount>=2 before this command can count as evidence.',
    }
  }

  const entryModel =
    input.variant === 'flash_bare'
      ? 'flash'
      : input.variant === 'pro_bare'
        ? 'pro'
        : 'auto'
  const env =
    input.variant === 'dsxu_cold'
      ? {
          DSXU_BENCH_BASELINE_PROFILE: null,
          DSXU_BENCH_MODE: 'cold',
        }
      : {
          DSXU_BENCH_BASELINE_PROFILE: 'model_forced_bare',
          DSXU_BENCH_MODE: 'cold',
          DSXU_BENCH_ENABLE_SEMANTIC_TOOLS: null,
        }
  return {
    ...common,
    env,
    command: benchmarkCommand({
      outDir,
      entryModel,
      caseTimeoutMs: input.caseTimeoutMs,
      caseIds,
      env,
    }),
    runnable: true,
  }
}

export function buildV18EvalBaselineManifest(options: {
  generatedAt?: string
  outPrefix?: string
  caseTimeoutMs?: number
} = {}): V18EvalBaselineManifest {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const outPrefix =
    options.outPrefix ?? '.dsxu\\runs\\v18-eval-baseline-20260507'
  const caseTimeoutMs = options.caseTimeoutMs ?? 180000
  const variants: V18EvalBaselineVariant[] = [
    'flash_bare',
    'pro_bare',
    'dsxu_cold',
    'benchmax',
  ]
  let order = 0
  const commands = variants.flatMap(variant =>
    (['code', 'terminal'] as const).map(suite =>
      commandFor({
        variant,
        suite,
        order: ++order,
        outPrefix,
        caseTimeoutMs,
      }),
    ),
  )
  return {
    generatedAt,
    caseTimeoutMs,
    commands,
    guards: [
      'Run Flash bare first and inspect policy/cost drift before Pro bare.',
      'BenchMax commands are not runnable evidence until candidate search/review exists.',
      'Do not run broad 22-case from this manifest.',
    ],
  }
}

export async function runV18EvalBaselineManifestHarness(options: {
  evidencePath?: string
  generatedAt?: string
  outPrefix?: string
  caseTimeoutMs?: number
} = {}): Promise<V18EvalBaselineManifest> {
  const evidencePath =
    options.evidencePath ??
    join(
      process.cwd(),
      '.dsxu',
      'trace',
      'v18-eval',
      'baseline-command-manifest-20260507.json',
    )
  await mkdir(dirname(evidencePath), { recursive: true })
  const manifest = {
    ...buildV18EvalBaselineManifest({
      generatedAt: options.generatedAt,
      outPrefix: options.outPrefix,
      caseTimeoutMs: options.caseTimeoutMs,
    }),
    evidencePath,
  }
  await writeFile(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}
