import { context, metrics, SpanStatusCode, trace } from '@opentelemetry/api'
import PQueue from 'p-queue'
import { createActor, createMachine } from 'xstate'
import type { DSXUTraceCollector } from './dsxu-trace'

export type DSXUTaskGraphEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SUCCEED' }
  | { type: 'FAIL'; failureCode?: string }
  | { type: 'CANCEL' }

export function createTaskGraphMachine(taskId: string) {
  return createMachine({
    id: `dsxu-task-graph-${taskId}`,
    initial: 'queued',
    states: {
      queued: {
        on: {
          START: { target: 'running' },
          CANCEL: { target: 'cancelled' },
        },
      },
      running: {
        on: {
          PAUSE: { target: 'paused' },
          SUCCEED: { target: 'succeeded' },
          FAIL: { target: 'failed' },
          CANCEL: { target: 'cancelled' },
        },
      },
      paused: {
        on: {
          RESUME: { target: 'running' },
          CANCEL: { target: 'cancelled' },
          FAIL: { target: 'failed' },
        },
      },
      succeeded: { type: 'final' },
      failed: { type: 'final' },
      cancelled: { type: 'final' },
    },
  })
}

export function createTaskGraphActor(taskId: string, traceCollector?: DSXUTraceCollector) {
  const actor = createActor(createTaskGraphMachine(taskId))
  actor.subscribe((snapshot) => {
    traceCollector?.record({
      type: 'task.updated',
      taskId,
      payload: { taskGraphState: String(snapshot.value) },
    })
  })
  actor.start()
  return actor
}

export function createSchedulerQueue(input?: { concurrency?: number; timeoutMs?: number }) {
  const queue = new PQueue({
    concurrency: input?.concurrency ?? 2,
    timeout: input?.timeoutMs ?? 10_000,
    throwOnTimeout: true,
  })

  return {
    queue,
    addTask<T>(taskId: string, fn: () => Promise<T>) {
      return queue.add(async () => ({ taskId, result: await fn() }))
    },
    snapshot() {
      return {
        size: queue.size,
        pending: queue.pending,
        isPaused: queue.isPaused,
        concurrency: queue.concurrency,
      }
    },
    onIdle() {
      return queue.onIdle()
    },
    pause() {
      queue.pause()
    },
    start() {
      queue.start()
    },
    clear() {
      queue.clear()
    },
  }
}

export function createOpenTelemetryBridge(serviceName: string) {
  const tracer = trace.getTracer(serviceName)
  const meter = metrics.getMeter(serviceName)
  const taskCounter = meter.createCounter('dsxu.task.events', {
    description: 'DSXU task events bridged through OpenTelemetry API',
  })

  return {
    tracer,
    meter,
    taskCounter,
    withSpan<T>(name: string, attrs: Record<string, string | number | boolean>, fn: () => T): T {
      return tracer.startActiveSpan(name, (span) => {
        Object.entries(attrs).forEach(([key, value]) => span.setAttribute(key, value))
        try {
          const result = context.with(trace.setSpan(context.active(), span), fn)
          span.setStatus({ code: SpanStatusCode.OK })
          return result
        } catch (error) {
          span.recordException(error as Error)
          span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) })
          throw error
        } finally {
          span.end()
        }
      })
    },
    recordTaskEvent(eventType: string, value = 1, attrs: Record<string, string | number | boolean> = {}) {
      taskCounter.add(value, {
        'dsxu.event_type': eventType,
        ...attrs,
      })
      return {
        eventType,
        value,
        attrs: {
          'dsxu.event_type': eventType,
          ...attrs,
        },
      }
    },
  }
}
