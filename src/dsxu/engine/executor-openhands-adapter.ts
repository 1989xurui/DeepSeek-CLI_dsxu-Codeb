import type { DSXUTraceCollector } from './dsxu-trace'
import { normalizeFailure, type DSXUFailure } from './failure-taxonomy'

export interface OpenHandsRunRequest {
  taskId: string
  runId: string
  workspace: string
  prompt: string
  dryRun?: boolean
}

export interface OpenHandsRunResult {
  ok: boolean
  taskId: string
  runId: string
  output: string
  failure?: DSXUFailure
}

export interface OpenHandsRunner {
  run(request: OpenHandsRunRequest): Promise<{ output: string }>
}

export function createOpenHandsAdapter(input: {
  runner?: OpenHandsRunner
  trace: DSXUTraceCollector
}) {
  const runner = input.runner ?? {
    async run(request: OpenHandsRunRequest) {
      return { output: request.dryRun ? 'openhands dry run accepted' : `openhands accepted ${request.taskId}` }
    },
  }

  return {
    async invoke(request: OpenHandsRunRequest): Promise<OpenHandsRunResult> {
      input.trace.record({
        type: 'adapter.invoked',
        taskId: request.taskId,
        runId: request.runId,
        payload: { adapter: 'openhands', workspace: request.workspace, dryRun: Boolean(request.dryRun) },
      })
      try {
        const result = await runner.run(request)
        return {
          ok: true,
          taskId: request.taskId,
          runId: request.runId,
          output: result.output,
        }
      } catch (error) {
        const failure = normalizeFailure(error, { operation: 'openhands' })
        input.trace.record({
          type: 'run.failed',
          taskId: request.taskId,
          runId: request.runId,
          failureCode: failure.failureCode,
          payload: { adapter: 'openhands', failure },
        })
        return {
          ok: false,
          taskId: request.taskId,
          runId: request.runId,
          output: failure.message,
          failure,
        }
      }
    },
  }
}
