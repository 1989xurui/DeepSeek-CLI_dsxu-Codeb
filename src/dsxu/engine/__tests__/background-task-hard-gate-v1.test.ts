import { afterEach, describe, expect, test } from 'bun:test'
import { readFile, stat, rm } from 'fs/promises'
import { runBackgroundServerLifecycleHarness } from '../../integration/harness/background-server-lifecycle-v1-harness'
import { runDevServerLifecycleHarness } from '../../integration/harness/dev-server-lifecycle-v1-harness'
import { BashTool } from '../../../tools/BashTool/BashTool'
import {
  detectSelfKillingProcessCleanup,
  renderSelfKillingProcessCleanupMessage,
} from '../../../tools/BashTool/processCleanupGuards'
import {
  _clearOutputsForTest,
  ensureTaskOutputTerminalMarker,
  getTaskOutputPath,
  initTaskOutput,
} from '../../../utils/task/diskOutput'

describe('background task lifecycle hard gate V1', () => {
  const touchedTaskIds: string[] = []

  afterEach(async () => {
    await _clearOutputsForTest()
    for (const taskId of touchedTaskIds.splice(0)) {
      await rm(getTaskOutputPath(taskId), { force: true })
    }
  })

  test('terminal task output cannot remain silent zero-byte', async () => {
    const taskId = `dsxu-hard-gate-empty-${Date.now()}`
    touchedTaskIds.push(taskId)
    await initTaskOutput(taskId)
    expect((await stat(getTaskOutputPath(taskId))).size).toBe(0)

    const result = await ensureTaskOutputTerminalMarker(
      taskId,
      'completed',
      'empty command',
    )

    expect(result.wroteMarker).toBe(true)
    expect((await stat(getTaskOutputPath(taskId))).size).toBeGreaterThan(0)
    const text = await readFile(getTaskOutputPath(taskId), 'utf8')
    expect(text).toContain('[DSXU task lifecycle]')
    expect(text).toContain('status=completed')
    expect(text).toContain('no stdout/stderr was captured')
  })

  test('terminal marker does not rewrite nonempty task output', async () => {
    const taskId = `dsxu-hard-gate-nonempty-${Date.now()}`
    touchedTaskIds.push(taskId)
    await initTaskOutput(taskId)
    await Bun.write(getTaskOutputPath(taskId), 'real output\n')

    const result = await ensureTaskOutputTerminalMarker(
      taskId,
      'failed',
      'nonempty command',
    )

    expect(result.wroteMarker).toBe(false)
    expect(await readFile(getTaskOutputPath(taskId), 'utf8')).toBe('real output\n')
  })

  test('background server lifecycle records cold-start, heartbeat, output path, and stop result', async () => {
    const result = await runBackgroundServerLifecycleHarness({
      scenarioName: 'background-server-cold-start',
      readyDelayMs: 800,
      timeoutMs: 8_000,
    })
    touchedTaskIds.push(result.taskId)

    expect(result.ok, result.error).toBe(true)
    expect(result.outputPath).toBe(getTaskOutputPath(result.taskId))
    expect(result.coldStartStatuses).toContain(503)
    expect(result.readyStatus).toBe(200)
    expect(result.heartbeatCount).toBeGreaterThan(0)
    expect(result.stopStatus).toBe('stopped')
    expect(result.terminalMarker.wroteMarker).toBe(false)

    const output = await readFile(result.outputPath, 'utf8')
    expect(output).toContain('DSXU_BACKGROUND_SERVER_LISTENING')
    expect(output).toContain('DSXU_BACKGROUND_SERVER_STOPPING')

    const trace = await readFile(result.tracePath, 'utf8')
    expect(trace).toContain('"event":"task.started"')
    expect(trace).toContain('"event":"http.poll"')
    expect(trace).toContain('"event":"http.ready"')
    expect(trace).toContain('"event":"task.stopped"')
  }, 15_000)

  test('parallel background server lifecycle runs get unique task output files', async () => {
    const [first, second] = await Promise.all([
      runBackgroundServerLifecycleHarness({
        scenarioName: 'background-server-parallel-a',
        readyDelayMs: 500,
        timeoutMs: 8_000,
      }),
      runBackgroundServerLifecycleHarness({
        scenarioName: 'background-server-parallel-b',
        readyDelayMs: 500,
        timeoutMs: 8_000,
      }),
    ])
    touchedTaskIds.push(first.taskId, second.taskId)

    expect(first.ok, first.error).toBe(true)
    expect(second.ok, second.error).toBe(true)
    expect(first.taskId).not.toBe(second.taskId)
    expect(first.outputPath).not.toBe(second.outputPath)
    expect(await readFile(first.outputPath, 'utf8')).toContain('DSXU_BACKGROUND_SERVER_LISTENING')
    expect(await readFile(second.outputPath, 'utf8')).toContain('DSXU_BACKGROUND_SERVER_LISTENING')
  }, 15_000)

  test('dev-server child process lifecycle records owner, cold-start, readiness, output path, and stop result', async () => {
    const result = await runDevServerLifecycleHarness({
      scenarioName: 'dev-server-child-process',
      readyDelayMs: 800,
      timeoutMs: 8_000,
    })
    touchedTaskIds.push(result.taskId)

    expect(result.ok, result.error).toBe(true)
    expect(result.outputPath).toBe(getTaskOutputPath(result.taskId))
    expect(result.coldStartStatuses).toContain(503)
    expect(result.readyStatus).toBe(200)
    expect(result.browserProof.status).toBe(200)
    expect(result.browserProof.contentType).toContain('text/html')
    expect(result.browserProof.bodyContainsMarker).toBe(true)
    expect(result.browserProof.htmlRootPresent).toBe(true)
    expect(result.heartbeatLines).toBeGreaterThan(0)
    expect(result.stopStatus).toBe('stopped')
    expect(result.terminalMarker.wroteMarker).toBe(false)

    const output = await readFile(result.outputPath, 'utf8')
    expect(output).toContain('DSXU_DEV_SERVER_LISTENING')
    expect(output).toContain('DSXU_DEV_SERVER_HEARTBEAT')
    expect(output).toContain('DSXU_DEV_SERVER_STOPPING')

    const trace = await readFile(result.tracePath, 'utf8')
    expect(trace).toContain('"event":"task.started"')
    expect(trace).toContain('"event":"http.poll"')
    expect(trace).toContain('"event":"http.ready"')
    expect(trace).toContain('"bodyContainsMarker":true')
    expect(trace).toContain('"event":"task.stopped"')
  }, 15_000)

  test('self-killing process cleanup commands are rejected before they can create false Waiting state', async () => {
    const pkillFinding = detectSelfKillingProcessCleanup(
      'pkill -f "vite" 2>/dev/null; sleep 1; npx vite --host 0.0.0.0',
    )
    expect(pkillFinding?.form).toBe('pkill-full')
    expect(renderSelfKillingProcessCleanupMessage(pkillFinding!)).toContain(
      'false Waiting/exit 143/144',
    )

    const pgrepFinding = detectSelfKillingProcessCleanup(
      'kill $(pgrep -f "node.*vite") 2>/dev/null; npm run dev',
    )
    expect(pgrepFinding?.form).toBe('pgrep-full-kill')

    expect(detectSelfKillingProcessCleanup('fuser -k 5173/tcp || true')).toBeNull()

    const validation = await BashTool.validateInput({
      command: 'pkill -f "vite" 2>/dev/null; sleep 1; npx vite --host 0.0.0.0',
    })
    expect(validation.result).toBe(false)
    expect(validation.message).toContain('false Waiting/exit 143/144')
  })
})
