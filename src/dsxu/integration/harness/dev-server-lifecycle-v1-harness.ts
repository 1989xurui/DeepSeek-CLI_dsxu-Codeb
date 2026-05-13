import { randomUUID } from 'crypto'
import { appendFile, mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  appendTaskOutput,
  ensureTaskOutputTerminalMarker,
  flushTaskOutput,
  getTaskOutputPath,
  initTaskOutput,
} from '../../../utils/task/diskOutput'
import {
  createLocalShellTask,
  createTaskLifecycleEngine,
  killShellTasks,
} from '../../engine/task-lifecycle-engine-v1'
import { createWatchdogDiscipline } from '../../engine/watchdog-discipline'

export type DevServerLifecycleResult = {
  ok: boolean
  taskId: string
  outputPath: string
  tracePath: string
  workDir: string
  port: number
  coldStartStatuses: number[]
  readyStatus: number | null
  browserProof: {
    url: string
    status: number | null
    contentType: string
    bodyBytes: number
    bodyContainsMarker: boolean
    htmlRootPresent: boolean
  }
  heartbeatLines: number
  stopStatus: 'stopped' | 'failed'
  terminalMarker: {
    wroteMarker: boolean
    sizeBefore: number
  }
  error?: string
}

export type DevServerLifecycleOptions = {
  evidenceDir?: string
  scenarioName?: string
  readyDelayMs?: number
  timeoutMs?: number
}

type TraceEvent = {
  ts: number
  event: string
  taskId: string
  data?: Record<string, unknown>
}

async function findFreePort(): Promise<number> {
  const net = await import('net')
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function appendTrace(tracePath: string, event: TraceEvent): Promise<void> {
  await appendFile(tracePath, `${JSON.stringify(event)}\n`, 'utf8')
}

async function writeDevServerScript(scriptPath: string): Promise<void> {
  await writeFile(
    scriptPath,
    [
      'const port = Number(process.env.DSXU_DEV_SERVER_PORT)',
      'const readyDelayMs = Number(process.env.DSXU_DEV_SERVER_READY_DELAY_MS || 900)',
      'const startedAt = Date.now()',
      'const server = Bun.serve({',
      "  hostname: '127.0.0.1',",
      '  port,',
      '  fetch(request) {',
      '    const url = new URL(request.url)',
      "    if (url.pathname === '/__dsxu_stop') {",
      "      console.log('DSXU_DEV_SERVER_STOPPING signal=http')",
      "      setTimeout(() => stop('http'), 0)",
      "      return new Response('stopping', { status: 200 })",
      '    }',
      '    const ready = Date.now() - startedAt >= readyDelayMs',
      "    if (!ready) return new Response('cold-start', { status: 503 })",
      "    return new Response('<!doctype html><html><body><main id=\"root\">DSXU_DEV_SERVER_READY</main></body></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })",
      '  },',
      '})',
      "console.log(`DSXU_DEV_SERVER_LISTENING port=${server.port}`)",
      'const heartbeat = setInterval(() => {',
      "  console.log(`DSXU_DEV_SERVER_HEARTBEAT uptimeMs=${Date.now() - startedAt}`)",
      '}, 250)',
      'heartbeat.unref?.()',
      'function stop(signal) {',
      "  if (signal !== 'http') console.log(`DSXU_DEV_SERVER_STOPPING signal=${signal}`)",
      '  clearInterval(heartbeat)',
      '  server.stop(true)',
      '  process.exit(0)',
      '}',
      "process.on('SIGTERM', () => stop('SIGTERM'))",
      "process.on('SIGINT', () => stop('SIGINT'))",
    ].join('\n'),
    'utf8',
  )
}

async function pumpStreamToTaskOutput(
  taskId: string,
  stream: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!stream) return
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    appendTaskOutput(taskId, decoder.decode(value, { stream: true }))
  }
  const tail = decoder.decode()
  if (tail) appendTaskOutput(taskId, tail)
}

async function waitForChildExit(child: Subprocess<'ignore', 'pipe', 'pipe'>, timeoutMs: number): Promise<void> {
  await Promise.race([
    child.exited.then(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ])
}

export async function runDevServerLifecycleHarness(
  options: DevServerLifecycleOptions = {},
): Promise<DevServerLifecycleResult> {
  const taskId = `dsxu-dev-server-${Date.now()}-${randomUUID()}`
  const scenarioName = options.scenarioName ?? 'dev-server-child-process'
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-background')
  const workDir = join(process.cwd(), '.dsxu', 'tmp', 'v18-dev-server', scenarioName, taskId)
  const tracePath = join(evidenceDir, `${scenarioName}.trace.jsonl`)
  const readyDelayMs = options.readyDelayMs ?? 900
  const timeoutMs = options.timeoutMs ?? 8_000
  const port = await findFreePort()
  const engine = createTaskLifecycleEngine()
  const watchdog = createWatchdogDiscipline({
    record(event) {
      void appendTrace(tracePath, {
        ts: Date.now(),
        event: event.type,
        taskId: event.taskId,
        data: event.payload as Record<string, unknown>,
      })
    },
  })
  const coldStartStatuses: number[] = []
  let readyStatus: number | null = null
  let browserProof: DevServerLifecycleResult['browserProof'] = {
    url: `http://127.0.0.1:${port}/`,
    status: null,
    contentType: '',
    bodyBytes: 0,
    bodyContainsMarker: false,
    htmlRootPresent: false,
  }
  let heartbeatLines = 0
  let child: Subprocess<'ignore', 'pipe', 'pipe'> | null = null

  await mkdir(evidenceDir, { recursive: true })
  await mkdir(workDir, { recursive: true })
  await writeFile(tracePath, '', 'utf8')
  const scriptPath = join(workDir, 'dev-server-fixture.mjs')
  await writeDevServerScript(scriptPath)
  const outputPath = await initTaskOutput(taskId)
  createLocalShellTask(engine, {
    taskId,
    description: 'V18 dev-server child process lifecycle harness',
    command: `${process.execPath} ${scriptPath}`,
  })
  watchdog.start({ taskId, timeoutMs })
  await appendTrace(tracePath, {
    ts: Date.now(),
    event: 'task.started',
    taskId,
    data: { outputPath, port, readyDelayMs, scriptPath },
  })

  try {
    child = Bun.spawn([process.execPath, scriptPath], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        DSXU_DEV_SERVER_PORT: String(port),
        DSXU_DEV_SERVER_READY_DELAY_MS: String(readyDelayMs),
      },
    })
    const stdoutPump = pumpStreamToTaskOutput(taskId, child.stdout)
    const stderrPump = pumpStreamToTaskOutput(taskId, child.stderr)

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      let status = 0
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(750),
        })
        status = response.status
      } catch {
        status = 0
      }

      if (status === 503) coldStartStatuses.push(status)
      if (status === 200) {
        readyStatus = status
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(750),
        })
        const body = await response.text()
        browserProof = {
          url: `http://127.0.0.1:${port}/`,
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          bodyBytes: Buffer.byteLength(body),
          bodyContainsMarker: body.includes('DSXU_DEV_SERVER_READY'),
          htmlRootPresent: /<main\s+id="root">/i.test(body),
        }
        await appendTrace(tracePath, {
          ts: Date.now(),
          event: 'http.ready',
          taskId,
          data: { status, browserProof },
        })
        break
      }

      watchdog.heartbeat(taskId)
      await appendTrace(tracePath, {
        ts: Date.now(),
        event: 'http.poll',
        taskId,
        data: { status },
      })
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    if (readyStatus !== 200) {
      throw new Error(`dev server did not become ready; statuses=${coldStartStatuses.join(',') || 'none'}`)
    }

    const killed = killShellTasks(engine, 'v18-dev-server-lifecycle-test-complete')
    try {
      await fetch(`http://127.0.0.1:${port}/__dsxu_stop`, {
        signal: AbortSignal.timeout(750),
      })
    } catch {
      child.kill('SIGTERM')
    }
    await waitForChildExit(child, 2_000)
    if (child.exitCode === null) child.kill()
    await Promise.allSettled([stdoutPump, stderrPump])
    await flushTaskOutput(taskId)
    const output = await Bun.file(outputPath).text()
    heartbeatLines = output.split('\n').filter(line => line.includes('DSXU_DEV_SERVER_HEARTBEAT')).length
    const terminalMarker = await ensureTaskOutputTerminalMarker(
      taskId,
      'killed',
      'dev server stopped after HTTP readiness proof',
    )
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'task.stopped',
      taskId,
      data: { killed, outputPath: terminalMarker.outputPath, exitCode: child.exitCode },
    })

    return {
      ok:
        readyStatus === 200 &&
        coldStartStatuses.includes(503) &&
        browserProof.bodyContainsMarker &&
        browserProof.htmlRootPresent &&
        heartbeatLines > 0 &&
        killed.length === 1,
      taskId,
      outputPath: terminalMarker.outputPath,
      tracePath,
      workDir,
      port,
      coldStartStatuses,
      readyStatus,
      browserProof,
      heartbeatLines,
      stopStatus: 'stopped',
      terminalMarker,
    }
  } catch (error) {
    if (child) {
      child.kill('SIGTERM')
      await waitForChildExit(child, 1_000)
      if (child.exitCode === null) child.kill()
    }
    const terminalMarker = await ensureTaskOutputTerminalMarker(
      taskId,
      'failed',
      error instanceof Error ? error.message : String(error),
    )
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'task.failed',
      taskId,
      data: { error: error instanceof Error ? error.message : String(error) },
    })

    return {
      ok: false,
      taskId,
      outputPath: terminalMarker.outputPath,
      tracePath,
      workDir,
      port,
      coldStartStatuses,
      readyStatus,
      browserProof,
      heartbeatLines,
      stopStatus: 'failed',
      terminalMarker,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true })
    } catch (error) {
      await appendTrace(tracePath, {
        ts: Date.now(),
        event: 'workdir.cleanup.skipped',
        taskId,
        data: { error: error instanceof Error ? error.message : String(error), workDir },
      })
    }
  }
}
