import { randomUUID } from 'crypto'
import { appendFile, mkdir, writeFile } from 'fs/promises'
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

export type BackgroundServerLifecycleResult = {
  ok: boolean
  taskId: string
  outputPath: string
  tracePath: string
  port: number
  coldStartStatuses: number[]
  readyStatus: number | null
  heartbeatCount: number
  stopStatus: 'stopped' | 'failed'
  terminalMarker: {
    wroteMarker: boolean
    sizeBefore: number
  }
  error?: string
}

export type BackgroundServerLifecycleOptions = {
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
  await appendFile(
    tracePath,
    `${JSON.stringify(event)}\n`,
    'utf8',
  )
}

async function startBackgroundServerWithRetry(input: {
  taskId: string
  tracePath: string
  readyDelayMs: number
}): Promise<{
  server: ReturnType<typeof Bun.serve>
  port: number
  startedAt: number
  listenAttempt: number
}> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const port = await findFreePort()
    const startedAt = Date.now()
    try {
      const server = Bun.serve({
        hostname: '127.0.0.1',
        port,
        fetch() {
          const ready = Date.now() - startedAt >= input.readyDelayMs
          return new Response(ready ? 'ready' : 'cold-start', {
            status: ready ? 200 : 503,
          })
        },
      })
      return { server, port, startedAt, listenAttempt: attempt }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!/EADDRINUSE|port.*in use|Failed to start server/i.test(message)) {
        throw error
      }
      await appendTrace(input.tracePath, {
        ts: Date.now(),
        event: 'server.listen.retry',
        taskId: input.taskId,
        data: { attempt, port, error: message },
      })
      await new Promise(resolve => setTimeout(resolve, 50 * attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function runBackgroundServerLifecycleHarness(
  options: BackgroundServerLifecycleOptions = {},
): Promise<BackgroundServerLifecycleResult> {
  const taskId = `dsxu-bg-server-${Date.now()}-${randomUUID()}`
  const scenarioName = options.scenarioName ?? 'background-server-cold-start'
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-background')
  const tracePath = join(evidenceDir, `${scenarioName}.trace.jsonl`)
  const readyDelayMs = options.readyDelayMs ?? 900
  const timeoutMs = options.timeoutMs ?? 8_000
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
  let heartbeatCount = 0
  let readyStatus: number | null = null
  const coldStartStatuses: number[] = []

  await mkdir(evidenceDir, { recursive: true })
  await writeFile(tracePath, '', 'utf8')
  const outputPath = await initTaskOutput(taskId)
  let port = 0
  let server: ReturnType<typeof Bun.serve> | null = null
  createLocalShellTask(engine, {
    taskId,
    description: 'V18 background server lifecycle harness',
    command: 'in-process Bun.serve background server',
  })
  watchdog.start({ taskId, timeoutMs })

  try {
    const started = await startBackgroundServerWithRetry({ taskId, tracePath, readyDelayMs })
    server = started.server
    port = started.port
    await appendTrace(tracePath, {
      ts: started.startedAt,
      event: 'task.started',
      taskId,
      data: { outputPath, port, readyDelayMs, listenAttempt: started.listenAttempt },
    })
    appendTaskOutput(taskId, `DSXU_BACKGROUND_SERVER_LISTENING port=${server.port}\n`)

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
        await appendTrace(tracePath, {
          ts: Date.now(),
          event: 'http.ready',
          taskId,
          data: { status },
        })
        break
      }

      heartbeatCount++
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
      throw new Error(`server did not become ready; statuses=${coldStartStatuses.join(',') || 'none'}`)
    }

    const killed = killShellTasks(engine, 'v18-background-lifecycle-test-complete')
    appendTaskOutput(taskId, 'DSXU_BACKGROUND_SERVER_STOPPING\n')
    server.stop(true)
    await flushTaskOutput(taskId)
    const terminalMarker = await ensureTaskOutputTerminalMarker(
      taskId,
      'killed',
      'background server stopped after HTTP readiness proof',
    )
    await appendTrace(tracePath, {
      ts: Date.now(),
      event: 'task.stopped',
      taskId,
      data: { killed, outputPath: terminalMarker.outputPath },
    })

    return {
      ok:
        readyStatus === 200 &&
        coldStartStatuses.includes(503) &&
        heartbeatCount > 0 &&
        killed.length === 1,
      taskId,
      outputPath: terminalMarker.outputPath,
      tracePath,
      port,
      coldStartStatuses,
      readyStatus,
      heartbeatCount,
      stopStatus: 'stopped',
      terminalMarker,
    }
  } catch (error) {
    appendTaskOutput(taskId, 'DSXU_BACKGROUND_SERVER_STOPPING_AFTER_ERROR\n')
    server?.stop(true)
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
      port,
      coldStartStatuses,
      readyStatus,
      heartbeatCount,
      stopStatus: 'failed',
      terminalMarker,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
