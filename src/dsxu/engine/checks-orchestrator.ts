import type { DSXUTraceCollector } from './dsxu-trace'

export interface CheckInput {
  taskId: string
  runId?: string
  artifacts: Record<string, any>
}

export interface CheckResult {
  checkId: string
  passed: boolean
  severity: 'info' | 'warning' | 'error'
  message: string
}

export type CheckRule = (input: CheckInput) => CheckResult | Promise<CheckResult>

export function createChecksOrchestrator(trace?: DSXUTraceCollector) {
  const rules = new Map<string, CheckRule>()

  return {
    register(checkId: string, rule: CheckRule) {
      rules.set(checkId, rule)
    },
    async run(input: CheckInput): Promise<{ passed: boolean; results: CheckResult[]; blocked: boolean }> {
      const results: CheckResult[] = []
      for (const [checkId, rule] of rules) {
        const result = await rule(input)
        results.push({ ...result, checkId: result.checkId || checkId })
      }
      const blocked = results.some((result) => !result.passed && result.severity === 'error')
      trace?.record({
        type: 'task.updated',
        taskId: input.taskId,
        runId: input.runId,
        payload: { checks: { results, blocked } },
      })
      return { passed: !blocked, results, blocked }
    },
  }
}
