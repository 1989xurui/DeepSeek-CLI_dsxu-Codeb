import { AsyncLocalStorage } from 'node:async_hooks'
import type { DSXUTraceCollector } from './dsxu-trace'

export type SubagentState = 'delegated' | 'running' | 'merged' | 'aborted' | 'escalated'

export interface DSXUAgentContext {
  agentId: string
  parentTaskId?: string
  parentSessionId?: string
  role: string
  teamName?: string
  executionMode: 'in-process' | 'external'
  planModeRequired: boolean
}

export interface SubagentTask {
  subtaskId: string
  parentTaskId: string
  role: string
  objective: string
  state: SubagentState
  result?: string
  reason?: string
}

const agentContextStorage = new AsyncLocalStorage<DSXUAgentContext>()

export function runWithDSXUAgentContext<T>(context: DSXUAgentContext, fn: () => T): T {
  return agentContextStorage.run(context, fn)
}

export function getDSXUAgentContext(): DSXUAgentContext | undefined {
  return agentContextStorage.getStore()
}

export function buildDSXUAgentPromptAddendum(context: DSXUAgentContext): string {
  return [
    '[dsxu-agent-context]',
    `agentId=${context.agentId}`,
    `role=${context.role}`,
    `executionMode=${context.executionMode}`,
    `planModeRequired=${context.planModeRequired}`,
    context.parentSessionId ? `parentSessionId=${context.parentSessionId}` : undefined,
    context.parentTaskId ? `parentTaskId=${context.parentTaskId}` : undefined,
  ].filter(Boolean).join('\n')
}

export function createSubagentProtocol(trace?: DSXUTraceCollector) {
  const subtasks = new Map<string, SubagentTask>()
  let seq = 0

  return {
    delegate(input: { parentTaskId: string; role: string; objective: string }): SubagentTask {
      const subtask: SubagentTask = {
        subtaskId: `subagent-${++seq}`,
        parentTaskId: input.parentTaskId,
        role: input.role,
        objective: input.objective,
        state: 'delegated',
      }
      subtasks.set(subtask.subtaskId, subtask)
      trace?.record({ type: 'task.updated', taskId: input.parentTaskId, payload: { subagent: subtask } })
      return subtask
    },
    merge(subtaskId: string, result: string): SubagentTask {
      const subtask = must(subtaskId)
      subtask.state = 'merged'
      subtask.result = result
      trace?.record({ type: 'task.updated', taskId: subtask.parentTaskId, payload: { subagentMerge: subtask } })
      return subtask
    },
    abort(subtaskId: string, reason: string): SubagentTask {
      const subtask = must(subtaskId)
      subtask.state = 'aborted'
      subtask.reason = reason
      trace?.record({ type: 'task.updated', taskId: subtask.parentTaskId, payload: { subagentAbort: subtask } })
      return subtask
    },
    escalate(subtaskId: string, reason: string): SubagentTask {
      const subtask = must(subtaskId)
      subtask.state = 'escalated'
      subtask.reason = reason
      trace?.record({ type: 'task.updated', taskId: subtask.parentTaskId, payload: { subagentEscalate: subtask } })
      return subtask
    },
    list(parentTaskId?: string) {
      const all = [...subtasks.values()]
      return parentTaskId ? all.filter((task) => task.parentTaskId === parentTaskId) : all
    },
  }

  function must(subtaskId: string): SubagentTask {
    const subtask = subtasks.get(subtaskId)
    if (!subtask) throw new Error(`subagent task not found: ${subtaskId}`)
    return subtask
  }
}
