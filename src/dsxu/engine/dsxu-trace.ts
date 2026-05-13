export type DSXUTraceEventType =
  | 'task.created'
  | 'task.updated'
  | 'run.created'
  | 'run.completed'
  | 'run.failed'
  | 'checkpoint.created'
  | 'policy.evaluated'
  | 'tool.registered'
  | 'tool.executed'
  | 'adapter.invoked'

export interface DSXUTraceEvent {
  eventId: string
  type: DSXUTraceEventType
  timestamp: number
  sessionId?: string
  taskId?: string
  runId?: string
  toolCallId?: string
  failureCode?: string
  payload: Record<string, any>
}

export interface DSXUTraceCollector {
  record(event: Omit<DSXUTraceEvent, 'eventId' | 'timestamp'> & { timestamp?: number }): DSXUTraceEvent
  list(): DSXUTraceEvent[]
  byTask(taskId: string): DSXUTraceEvent[]
  clear(): void
}

export function createDSXUTraceCollector(seed = 'trace'): DSXUTraceCollector {
  let seq = 0
  const events: DSXUTraceEvent[] = []

  return {
    record(input) {
      const event: DSXUTraceEvent = {
        eventId: `${seed}-${++seq}`,
        timestamp: input.timestamp ?? Date.now(),
        type: input.type,
        sessionId: input.sessionId,
        taskId: input.taskId,
        runId: input.runId,
        toolCallId: input.toolCallId,
        failureCode: input.failureCode,
        payload: input.payload,
      }
      events.push(event)
      return event
    },
    list() {
      return [...events]
    },
    byTask(taskId) {
      return events.filter((event) => event.taskId === taskId)
    },
    clear() {
      events.length = 0
      seq = 0
    },
  }
}
