import type { DSXUTraceCollector } from './dsxu-trace'

export interface WatchdogState {
  taskId: string
  lastHeartbeatAt: number
  timeoutMs: number
  checkpointRequired: boolean
}

export function createWatchdogDiscipline(trace?: DSXUTraceCollector) {
  const states = new Map<string, WatchdogState>()

  return {
    start(input: { taskId: string; timeoutMs: number }): WatchdogState {
      const state = {
        taskId: input.taskId,
        timeoutMs: input.timeoutMs,
        lastHeartbeatAt: Date.now(),
        checkpointRequired: false,
      }
      states.set(input.taskId, state)
      return state
    },
    heartbeat(taskId: string): WatchdogState {
      const state = must(taskId)
      state.lastHeartbeatAt = Date.now()
      state.checkpointRequired = false
      trace?.record({ type: 'task.updated', taskId, payload: { watchdog: 'heartbeat' } })
      return state
    },
    inspect(taskId: string, now = Date.now()): { timedOut: boolean; checkpointRequired: boolean; state: WatchdogState } {
      const state = must(taskId)
      const timedOut = now - state.lastHeartbeatAt > state.timeoutMs
      state.checkpointRequired = timedOut
      if (timedOut) {
        trace?.record({ type: 'task.updated', taskId, payload: { watchdog: 'timeout', checkpointRequired: true } })
      }
      return { timedOut, checkpointRequired: state.checkpointRequired, state }
    },
  }

  function must(taskId: string): WatchdogState {
    const state = states.get(taskId)
    if (!state) throw new Error(`watchdog state not found: ${taskId}`)
    return state
  }
}
