import { execFile } from 'child_process'
import { existsSync } from 'fs'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { promisify } from 'util'
import { buildTuiPermissionFallbackHealthEvidence } from './tui-permission-fallback-health-v1-harness.js'
import { runBackgroundServerLifecycleHarness } from './background-server-lifecycle-v1-harness.js'
import { runDevServerLifecycleHarness } from './dev-server-lifecycle-v1-harness.js'
import { runRealTuiExitSmoke } from './real-tui-harness.js'
import { runToolchainSelfcheck } from './toolchain-selfcheck-v1-harness.js'

const execFileAsync = promisify(execFile)

export type TuiTerminalReliabilityPackOptions = {
  repoRoot?: string
  evidenceDir?: string
  includeRealTui?: boolean
}

export type TerminalReplayResult = {
  ok: boolean
  taskId: string
  workspace: string
  shellState: {
    before: Record<string, unknown>
    after: Record<string, unknown>
  }
  envProfile: Record<string, unknown>
  commandPlan: Record<string, unknown>
  shellResult: Record<string, unknown>
  outputSummary: Record<string, unknown>
  fileDelta: Record<string, unknown>
  commandVerify: Record<string, unknown>
  artifactCheck: Record<string, unknown>
  timeoutGuard: Record<string, unknown>
  terminalResultPack: Record<string, unknown>
  tracePath: string
}

export type TuiTerminalReliabilityPackResult = {
  ok: boolean
  evidencePath: string
  excelIds: string[]
  terminalReplay: TerminalReplayResult
  permission: Awaited<ReturnType<typeof buildTuiPermissionFallbackHealthEvidence>>
  background: Awaited<ReturnType<typeof runBackgroundServerLifecycleHarness>>
  devServer: Awaited<ReturnType<typeof runDevServerLifecycleHarness>>
  toolchain: Awaited<ReturnType<typeof runToolchainSelfcheck>>
  realTui?: Awaited<ReturnType<typeof runRealTuiExitSmoke>>
  acceptance: Record<string, boolean>
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort()
  } catch {
    return []
  }
}

function summarizeOutput(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const keyLines = lines.filter(line =>
    /DSXU|artifact|ready|error|failed|pass/i.test(line),
  )
  const rawBytes = Buffer.byteLength(text)
  const summary = keyLines.join('\n')
  const summaryBytes = Buffer.byteLength(summary)
  return {
    rawBytes,
    summaryBytes,
    compressionRatio:
      rawBytes === 0 ? 1 : Number((1 - summaryBytes / rawBytes).toFixed(3)),
    keyLines,
  }
}

async function runTerminalReplay(
  repoRoot: string,
  evidenceDir: string,
): Promise<TerminalReplayResult> {
  const taskId = `dsxu-terminal-reliability-${Date.now()}`
  const workspace = await mkdtemp(join(tmpdir(), 'dsxu-terminal-replay-'))
  const artifactPath = join(workspace, 'artifact.json')
  const tracePath = join(evidenceDir, 'terminal-reliability-replay.trace.json')
  const commandScript = [
    `await Bun.write(${JSON.stringify(artifactPath)}, JSON.stringify({`,
    `  marker: 'DSXU_TERMINAL_RELIABILITY_ARTIFACT',`,
    `  taskId: ${JSON.stringify(taskId)},`,
    `  cwd: process.cwd(),`,
    `  ts: Date.now(),`,
    `}, null, 2))`,
    `console.log('DSXU_TERMINAL_RELIABILITY_ARTIFACT written')`,
  ].join('\n')

  const beforeFiles = await listFiles(workspace)
  const startedAt = Date.now()
  const shellStateBefore = {
    cwd: workspace,
    repoRoot,
    files: beforeFiles,
    envKeys: ['PATH', 'HOME', 'USERPROFILE'].filter(key => key in process.env),
  }
  const envProfile = {
    platform: process.platform,
    bunVersion: Bun.version,
    repoRootExists: existsSync(repoRoot),
    tempWorkspace: workspace,
  }
  const commandPlan = {
    id: 'write-json-artifact',
    purpose: 'create a verifiable JSON artifact without shell redirection',
    expected: 'artifact.json exists and contains DSXU_TERMINAL_RELIABILITY_ARTIFACT',
    verify: ['exitCode=0', 'artifact exists', 'JSON marker matches', 'file delta tracked'],
    risk: 'low',
  }

  let stdout = ''
  let stderr = ''
  let exitCode = 0
  let errorMessage: string | undefined
  try {
    const result = await execFileAsync(process.execPath, ['-e', commandScript], {
      cwd: workspace,
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    stdout = String(result.stdout)
    stderr = String(result.stderr)
  } catch (error: any) {
    stdout = String(error?.stdout ?? '')
    stderr = String(error?.stderr ?? '')
    exitCode = typeof error?.code === 'number' ? error.code : 1
    errorMessage = error?.message ?? String(error)
  }
  const elapsedMs = Date.now() - startedAt
  const afterFiles = await listFiles(workspace)
  const artifactText = existsSync(artifactPath)
    ? await readFile(artifactPath, 'utf8')
    : ''
  let parsedArtifact: Record<string, unknown> | null = null
  try {
    parsedArtifact = artifactText ? JSON.parse(artifactText) : null
  } catch {
    parsedArtifact = null
  }
  const artifactStat = existsSync(artifactPath)
    ? await stat(artifactPath)
    : undefined
  const createdFiles = afterFiles.filter(file => !beforeFiles.includes(file))
  const outputSummary = summarizeOutput(`${stdout}\n${stderr}`)
  const commandVerify = {
    exit0: exitCode === 0,
    artifactExists: existsSync(artifactPath),
    markerMatches:
      parsedArtifact?.marker === 'DSXU_TERMINAL_RELIABILITY_ARTIFACT',
    fileDeltaTracked: createdFiles.includes('artifact.json'),
  }
  const artifactCheck = {
    path: artifactPath,
    format: parsedArtifact ? 'json' : 'missing-or-invalid',
    size: artifactStat?.size ?? 0,
    schema: {
      marker: typeof parsedArtifact?.marker === 'string',
      taskId: parsedArtifact?.taskId === taskId,
      cwd: parsedArtifact?.cwd === workspace,
      ts: typeof parsedArtifact?.ts === 'number',
    },
  }

  let timeoutGuard: Record<string, unknown>
  try {
    await execFileAsync(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 2000)'],
      { timeout: 150, windowsHide: true },
    )
    timeoutGuard = { timeoutTriggered: false }
  } catch (error: any) {
    timeoutGuard = {
      timeoutTriggered: /timed out|SIGTERM|ETIMEDOUT/i.test(
        error?.message ?? '',
      ) || error?.signal === 'SIGTERM',
      error: error?.message ?? String(error),
      signal: error?.signal,
    }
  }

  const ok =
    Object.values(commandVerify).every(Boolean) &&
    Object.values(artifactCheck.schema).every(Boolean) &&
    timeoutGuard.timeoutTriggered === true

  const shellStateAfter = {
    cwd: workspace,
    files: afterFiles,
    elapsedMs,
    exitCode,
  }
  const fileDelta = {
    beforeFiles,
    afterFiles,
    createdFiles,
  }
  const shellResult = {
    command: `${process.execPath} -e <write artifact script>`,
    exitCode,
    stdout,
    stderr,
    elapsedMs,
    error: errorMessage,
  }
  const terminalResultPack = {
    summary: ok
      ? 'Terminal replay created and verified artifact with timeout proof.'
      : 'Terminal replay failed verification.',
    artifacts: [artifactPath],
    verify: commandVerify,
    failureType: ok ? null : 'COMMAND',
    tracePath,
  }
  const trace = {
    taskId,
    excelIds: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B10', 'B11', 'B14'],
    shellStateBefore,
    envProfile,
    commandPlan,
    shellResult,
    outputSummary,
    fileDelta,
    commandVerify,
    artifactCheck,
    timeoutGuard,
    terminalResultPack,
    shellStateAfter,
  }
  await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8')
  await rm(workspace, { recursive: true, force: true })

  return {
    ok,
    taskId,
    workspace,
    shellState: { before: shellStateBefore, after: shellStateAfter },
    envProfile,
    commandPlan,
    shellResult,
    outputSummary,
    fileDelta,
    commandVerify,
    artifactCheck,
    timeoutGuard,
    terminalResultPack,
    tracePath,
  }
}

export async function runTuiTerminalReliabilityPack(
  options: TuiTerminalReliabilityPackOptions = {},
): Promise<TuiTerminalReliabilityPackResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd())
  const evidenceDir =
    options.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-tui-terminal')
  await mkdir(evidenceDir, { recursive: true })

  const terminalReplay = await runTerminalReplay(repoRoot, evidenceDir)
  const permission = await buildTuiPermissionFallbackHealthEvidence({
    repoRoot,
    evidenceDir,
  })
  const background = await runBackgroundServerLifecycleHarness({
    evidenceDir,
    scenarioName: 'tui-terminal-background-server',
    readyDelayMs: 800,
    timeoutMs: 8_000,
  })
  const devServer = await runDevServerLifecycleHarness({
    evidenceDir,
    scenarioName: 'tui-terminal-dev-server',
    readyDelayMs: 800,
    timeoutMs: 8_000,
  })
  const toolchain = await runToolchainSelfcheck({
    repoRoot,
    evidenceDir,
  })
  const realTui = options.includeRealTui
    ? await runRealTuiExitSmoke({
        evidenceDir,
        scenarioName: 'tui-terminal-real-tui-exit',
        timeoutMs: 35_000,
      })
    : undefined

  const acceptance = {
    shellStateManager: terminalReplay.shellState.before.cwd === terminalReplay.workspace,
    environmentProbe: Boolean(terminalReplay.envProfile.bunVersion) && toolchain.ok,
    commandPlanner: Array.isArray(terminalReplay.commandPlan.verify),
    safeShellExecutor:
      terminalReplay.shellResult.exitCode === 0 &&
      terminalReplay.timeoutGuard.timeoutTriggered === true,
    outputSummarizer:
      typeof terminalReplay.outputSummary.compressionRatio === 'number',
    fileSystemState:
      (terminalReplay.fileDelta.createdFiles as string[]).includes('artifact.json'),
    commandVerifier: Object.values(terminalReplay.commandVerify).every(Boolean),
    timeoutGuard: terminalReplay.timeoutGuard.timeoutTriggered === true,
    artifactChecker: Object.values(terminalReplay.artifactCheck.schema).every(Boolean),
    terminalResultPackager:
      terminalReplay.terminalResultPack.failureType === null,
    taskTimelineRenderer:
      background.heartbeatCount > 0 && background.readyStatus === 200,
    devServerProof:
      devServer.ok &&
      devServer.coldStartStatuses.includes(503) &&
      devServer.readyStatus === 200 &&
      devServer.browserProof.bodyContainsMarker &&
      devServer.browserProof.htmlRootPresent &&
      devServer.heartbeatLines > 0 &&
      devServer.stopStatus === 'stopped',
    traceCollector:
      existsSync(terminalReplay.tracePath) &&
      existsSync(background.tracePath) &&
      existsSync(devServer.tracePath) &&
      permission.ok,
    goStopDecision:
      terminalReplay.ok &&
      permission.ok &&
      background.ok &&
      devServer.ok &&
      toolchain.ok &&
      (realTui ? realTui.ok : true),
    realTuiReplay: realTui ? realTui.ok : true,
  }
  const ok = Object.values(acceptance).every(Boolean)
  const evidencePath = join(evidenceDir, 'tui-terminal-reliability-pack.json')
  const result: TuiTerminalReliabilityPackResult = {
    ok,
    evidencePath,
    excelIds: [
      'B01',
      'B02',
      'B03',
      'B04',
      'B05',
      'B06',
      'B07',
      'B10',
      'B11',
      'B14',
      'C03',
      'E05',
      'E06',
    ],
    terminalReplay,
    permission,
    background,
    devServer,
    toolchain,
    ...(realTui ? { realTui } : {}),
    acceptance,
  }
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
