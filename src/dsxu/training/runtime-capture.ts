import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { exportTrainingTrajectoryFromRuntimeFile, type RuntimeEvidenceImportResult } from './runtime-importer'
import { validateTrainingTrajectory, type DsxuTrainingTrajectoryValidation } from './validator'

export interface RuntimeCaptureOptions {
  command: readonly string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  tracePath?: string
  outputPath?: string
  taskId?: string
  category?: string
  intent?: string
  verificationCommand?: string
  verificationPassed?: boolean
  claimBound?: boolean
  timeoutMs?: number
}

export interface RuntimeCaptureArtifact {
  schemaVersion: 'dsxu.training-runtime-capture.v1'
  generatedAt: string
  datasetKind: 'runtime_capture'
  publicClaimAllowed: false
  command: readonly string[]
  cwd: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  tracePath: string
  stdoutPath: string
  stderrPath: string
  outputPath?: string
  trajectoryCaptured: boolean
  import?: {
    summary: RuntimeEvidenceImportResult['summary']
    validation: DsxuTrainingTrajectoryValidation
    trajectory: RuntimeEvidenceImportResult['trajectory']
  }
  rule: string
}

export async function runRuntimeCapture(options: RuntimeCaptureOptions): Promise<RuntimeCaptureArtifact> {
  if (options.command.length === 0) throw new Error('runtime capture command is required')

  const cwd = resolve(options.cwd ?? process.cwd())
  const runId = makeRunId(options.command)
  const tracePath = resolve(options.tracePath ?? join('.dsxu', 'training', 'runtime-captures', `${runId}.trajectory.jsonl`))
  const stdoutPath = resolve(join(dirname(tracePath), `${runId}.stdout.log`))
  const stderrPath = resolve(join(dirname(tracePath), `${runId}.stderr.log`))
  await mkdir(dirname(tracePath), { recursive: true })

  const run = await runCommand({
    command: options.command,
    cwd,
    timeoutMs: options.timeoutMs ?? 120_000,
    env: {
      ...process.env,
      ...options.env,
      DSXU_DEEPSEEK_TRAJECTORY_FILE: tracePath,
    },
  })

  await writeFile(stdoutPath, run.stdout, 'utf8')
  await writeFile(stderrPath, run.stderr, 'utf8')

  let imported: RuntimeEvidenceImportResult | undefined
  let validation: DsxuTrainingTrajectoryValidation | undefined
  if (existsSync(tracePath)) {
    imported = await exportTrainingTrajectoryFromRuntimeFile(tracePath, {
      taskId: options.taskId ?? runId,
      category: options.category ?? 'runtime-capture',
      intent: options.intent ?? `Capture DSXU runtime evidence for ${options.command[0]}`,
      verificationCommands: options.verificationCommand ? [options.verificationCommand] : [],
      verificationPassed: options.verificationPassed ?? false,
      claimBound: options.claimBound ?? options.verificationPassed ?? false,
    })
    validation = validateTrainingTrajectory(imported.trajectory)
  }

  const artifact: RuntimeCaptureArtifact = {
    schemaVersion: 'dsxu.training-runtime-capture.v1',
    generatedAt: new Date().toISOString(),
    datasetKind: 'runtime_capture',
    publicClaimAllowed: false,
    command: options.command,
    cwd,
    exitCode: run.exitCode,
    signal: run.signal,
    timedOut: run.timedOut,
    tracePath,
    stdoutPath,
    stderrPath,
    outputPath: options.outputPath ? resolve(options.outputPath) : undefined,
    trajectoryCaptured: Boolean(imported),
    import: imported && validation
      ? {
          summary: imported.summary,
          validation,
          trajectory: imported.trajectory,
        }
      : undefined,
    rule: 'Runtime capture is evidence collection only. It is not a public benchmark, not a live-provider score, and not a success claim unless verification evidence is attached.',
  }

  if (options.outputPath) {
    const outputPath = resolve(options.outputPath)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  }

  return artifact
}

async function runCommand(input: {
  command: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs: number
}): Promise<{
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  stdout: string
  stderr: string
}> {
  const [file, ...args] = input.command
  let timedOut = false
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: input.cwd,
      env: input.env,
      windowsHide: true,
      shell: false,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, input.timeoutMs)

    child.stdout?.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)))
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer)
      resolvePromise({
        exitCode,
        signal,
        timedOut,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

function makeRunId(command: readonly string[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const hash = createHash('sha256').update(command.join('\0')).digest('hex').slice(0, 8)
  return `runtime-capture-${stamp}-${hash}`
}

export async function readRuntimeCaptureArtifact(path: string): Promise<RuntimeCaptureArtifact> {
  return JSON.parse(await readFile(path, 'utf8')) as RuntimeCaptureArtifact
}
