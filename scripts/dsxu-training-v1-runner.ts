import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  buildTrainingV1RunnerReport,
  type TrainingV1RunnerArtifacts,
  type TrainingV1RunnerStepResult,
} from '../src/dsxu/training/v1-runner'

interface CliArgs {
  output: string
  continueOnFailure: boolean
}

interface RunnerStep {
  id: string
  label: string
  command: readonly string[]
}

const paths = {
  dryRun: 'docs/generated/DSXU_TRAINING_TRAJECTORY_DRY_RUN_20260520.json',
  dryRunValidate: 'docs/generated/DSXU_TRAINING_TRAJECTORY_VALIDATE_20260520.json',
  dryRunScore: 'docs/generated/DSXU_TRAINING_TRAJECTORY_SCORE_20260520.json',
  goldenValidate: 'docs/generated/DSXU_TRAINING_GOLDEN_VALIDATE_20260520.json',
  goldenScore: 'docs/generated/DSXU_TRAINING_GOLDEN_SCORE_20260520.json',
  replayValidate: 'docs/generated/DSXU_TRAINING_REPLAY_VALIDATE_20260520.json',
  replayScore: 'docs/generated/DSXU_TRAINING_REPLAY_SCORE_20260520.json',
  ablation: 'docs/generated/DSXU_TRAINING_ABLATION_20260520.json',
  runtimeImport: 'docs/generated/DSXU_TRAINING_RUNTIME_IMPORT_20260520.json',
  runtimeImportValidate: 'docs/generated/DSXU_TRAINING_RUNTIME_IMPORT_VALIDATE_20260520.json',
  runtimeImportScore: 'docs/generated/DSXU_TRAINING_RUNTIME_IMPORT_SCORE_20260520.json',
  runtimeCapture: 'docs/generated/DSXU_TRAINING_RUNTIME_CAPTURE_20260520.json',
  runtimeCaptureValidate: 'docs/generated/DSXU_TRAINING_RUNTIME_CAPTURE_VALIDATE_20260520.json',
  runtimeCaptureScore: 'docs/generated/DSXU_TRAINING_RUNTIME_CAPTURE_SCORE_20260520.json',
  queryLoopReachability: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_20260520.json',
  queryLoopReachabilityValidate: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_VALIDATE_20260520.json',
  queryLoopReachabilityScore: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_SCORE_20260520.json',
  queryLoopCapture: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_20260520.json',
  queryLoopCaptureValidate: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_VALIDATE_20260520.json',
  queryLoopCaptureScore: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_SCORE_20260520.json',
}

const steps: RunnerStep[] = [
  {
    id: 'training-tests',
    label: 'training module unit tests',
    command: ['bun', 'test', 'src/dsxu/training/__tests__'],
  },
  {
    id: 'dry-run-export',
    label: 'dry-run trajectory export',
    command: ['bun', 'run', 'scripts/dsxu-training-export.ts', '--dry-run', '--output', paths.dryRun],
  },
  {
    id: 'dry-run-validate',
    label: 'dry-run trajectory validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', paths.dryRun, '--output', paths.dryRunValidate, '--strict'],
  },
  {
    id: 'dry-run-score',
    label: 'dry-run trajectory scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', paths.dryRun, '--output', paths.dryRunScore],
  },
  {
    id: 'golden-generate',
    label: 'golden fixture generation',
    command: ['bun', 'run', 'scripts/dsxu-training-generate-golden.ts'],
  },
  {
    id: 'golden-validate',
    label: 'golden fixture validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', 'docs/training/golden', '--output', paths.goldenValidate, '--strict'],
  },
  {
    id: 'golden-score',
    label: 'golden fixture scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', 'docs/training/golden', '--output', paths.goldenScore],
  },
  {
    id: 'replay-generate',
    label: 'internal replay generation',
    command: ['bun', 'run', 'scripts/dsxu-training-generate-replay.ts'],
  },
  {
    id: 'replay-validate',
    label: 'internal replay validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', '.dsxu/training/replay', '--output', paths.replayValidate, '--strict'],
  },
  {
    id: 'replay-score',
    label: 'internal replay scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', '.dsxu/training/replay', '--output', paths.replayScore],
  },
  {
    id: 'ablation',
    label: 'internal synthetic ablation',
    command: ['bun', 'run', 'scripts/dsxu-training-ablation.ts', '--output', paths.ablation],
  },
  {
    id: 'runtime-import',
    label: 'runtime sample import',
    command: [
      'bun',
      'run',
      'scripts/dsxu-training-export-runtime.ts',
      '--input',
      'docs/training/runtime-samples/sample-deepseek-trajectory-20260520.jsonl',
      '--output',
      paths.runtimeImport,
      '--task-id',
      'sample-runtime-import',
      '--category',
      'runtime-import',
      '--intent',
      'Import a redacted runtime trajectory sample',
    ],
  },
  {
    id: 'runtime-import-validate',
    label: 'runtime import validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', paths.runtimeImport, '--output', paths.runtimeImportValidate, '--strict'],
  },
  {
    id: 'runtime-import-score',
    label: 'runtime import scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', paths.runtimeImport, '--output', paths.runtimeImportScore],
  },
  {
    id: 'runtime-capture',
    label: 'runtime capture sample',
    command: [
      'bun',
      'run',
      'scripts/dsxu-training-capture.ts',
      '--output',
      paths.runtimeCapture,
      '--task-id',
      'sample-runtime-capture',
      '--category',
      'runtime-capture',
      '--intent',
      'Capture a command-generated redacted trajectory',
      '--',
      'bun',
      'run',
      'docs/training/runtime-samples/write-sample-trajectory.ts',
    ],
  },
  {
    id: 'runtime-capture-validate',
    label: 'runtime capture validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', paths.runtimeCapture, '--output', paths.runtimeCaptureValidate, '--strict'],
  },
  {
    id: 'runtime-capture-score',
    label: 'runtime capture scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', paths.runtimeCapture, '--output', paths.runtimeCaptureScore],
  },
  {
    id: 'query-loop-reachability',
    label: 'query-loop reachability probe',
    command: ['bun', 'run', 'scripts/dsxu-training-query-loop-reachability.ts', '--output', paths.queryLoopReachability],
  },
  {
    id: 'query-loop-reachability-validate',
    label: 'query-loop reachability validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', paths.queryLoopReachability, '--output', paths.queryLoopReachabilityValidate, '--strict'],
  },
  {
    id: 'query-loop-reachability-score',
    label: 'query-loop reachability scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', paths.queryLoopReachability, '--output', paths.queryLoopReachabilityScore],
  },
  {
    id: 'query-loop-capture',
    label: 'query-loop opt-in capture smoke',
    command: ['bun', 'run', 'scripts/dsxu-training-query-loop-capture-smoke.ts', '--output', paths.queryLoopCapture],
  },
  {
    id: 'query-loop-capture-validate',
    label: 'query-loop opt-in capture validation',
    command: ['bun', 'run', 'scripts/dsxu-training-validate.ts', '--input', paths.queryLoopCapture, '--output', paths.queryLoopCaptureValidate, '--strict'],
  },
  {
    id: 'query-loop-capture-score',
    label: 'query-loop opt-in capture scoring',
    command: ['bun', 'run', 'scripts/dsxu-training-score.ts', '--input', paths.queryLoopCapture, '--output', paths.queryLoopCaptureScore],
  },
]

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_V1_RUN_20260520.json',
    continueOnFailure: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    } else if (arg === '--continue-on-failure') {
      args.continueOnFailure = true
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const stepResults: TrainingV1RunnerStepResult[] = []
  for (const step of steps) {
    const result = await runStep(step)
    stepResults.push(result)
    if (result.status !== 'success' && !args.continueOnFailure) break
  }

  const report = buildTrainingV1RunnerReport({
    steps: stepResults,
    artifacts: await loadArtifacts(),
  })
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    status: report.status,
    output: outputPath,
    stepCount: report.steps.length,
    passedGates: report.gates.filter(gate => gate.passed).length,
    failedGates: report.gates.filter(gate => !gate.passed).map(gate => gate.id),
    publicClaimAllowed: report.publicClaimAllowed,
  }, null, 2))
  if (report.status !== 'PASS') process.exit(1)
}

async function runStep(step: RunnerStep): Promise<TrainingV1RunnerStepResult> {
  const startedAt = Date.now()
  const logDir = resolve('docs/generated/DSXU_TRAINING_V1_RUN_LOGS_20260520')
  await mkdir(logDir, { recursive: true })
  const stdoutPath = resolve(logDir, `${step.id}.stdout.log`)
  const stderrPath = resolve(logDir, `${step.id}.stderr.log`)
  const run = await runCommand(step.command)
  await writeFile(stdoutPath, run.stdout, 'utf8')
  await writeFile(stderrPath, run.stderr, 'utf8')
  return {
    id: step.id,
    label: step.label,
    command: step.command,
    status: run.exitCode === 0 ? 'success' : 'failed',
    exitCode: run.exitCode,
    durationMs: Date.now() - startedAt,
    stdoutPath,
    stderrPath,
    stdoutPreview: preview(run.stdout),
    stderrPreview: preview(run.stderr),
  }
}

async function runCommand(command: readonly string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const [file, ...args] = command
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      shell: false,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout?.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', exitCode => {
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

async function loadArtifacts(): Promise<TrainingV1RunnerArtifacts> {
  return {
    dryRunValidation: await readJsonIfExists(paths.dryRunValidate),
    dryRunScore: await readJsonIfExists(paths.dryRunScore),
    goldenValidation: await readJsonIfExists(paths.goldenValidate),
    goldenScore: await readJsonIfExists(paths.goldenScore),
    replayValidation: await readJsonIfExists(paths.replayValidate),
    replayScore: await readJsonIfExists(paths.replayScore),
    ablation: await readJsonIfExists(paths.ablation),
    runtimeImport: await readJsonIfExists(paths.runtimeImport),
    runtimeImportValidation: await readJsonIfExists(paths.runtimeImportValidate),
    runtimeImportScore: await readJsonIfExists(paths.runtimeImportScore),
    runtimeCapture: await readJsonIfExists(paths.runtimeCapture),
    runtimeCaptureValidation: await readJsonIfExists(paths.runtimeCaptureValidate),
    runtimeCaptureScore: await readJsonIfExists(paths.runtimeCaptureScore),
    queryLoopReachability: await readJsonIfExists(paths.queryLoopReachability),
    queryLoopReachabilityValidation: await readJsonIfExists(paths.queryLoopReachabilityValidate),
    queryLoopReachabilityScore: await readJsonIfExists(paths.queryLoopReachabilityScore),
    queryLoopCapture: await readJsonIfExists(paths.queryLoopCapture),
    queryLoopCaptureValidation: await readJsonIfExists(paths.queryLoopCaptureValidate),
    queryLoopCaptureScore: await readJsonIfExists(paths.queryLoopCaptureScore),
  }
}

async function readJsonIfExists(path: string): Promise<unknown | undefined> {
  const fullPath = resolve(path)
  if (!existsSync(fullPath)) return undefined
  return JSON.parse(await readFile(fullPath, 'utf8'))
}

function preview(value: string): string {
  const compact = value.trim()
  return compact.length <= 1000 ? compact : `${compact.slice(0, 1000)}...`
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
