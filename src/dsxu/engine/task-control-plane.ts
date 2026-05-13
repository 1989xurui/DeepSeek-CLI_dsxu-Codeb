import type { DSXUTraceCollector } from './dsxu-trace'
import type { DSXUFailure } from './failure-taxonomy'

export type DSXUTaskStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled'
export type DSXURunStatus = 'created' | 'running' | 'succeeded' | 'failed'
export type DSXUTaskComplexity = 'low' | 'medium' | 'high'
export type DSXUTaskRisk = 'low' | 'medium' | 'high'
export type DSXUVerificationMode = 'none' | 'standard' | 'strict'

export interface DSXUTask {
  taskId: string
  sessionId: string
  status: DSXUTaskStatus
  title: string
  workspaceId: string
  createdAt: number
  updatedAt: number
  resumeHint?: string
}

export interface DSXURun {
  runId: string
  taskId: string
  status: DSXURunStatus
  executor: 'native' | 'openhands' | 'mcp' | 'external'
  startedAt: number
  endedAt?: number
  failureCode?: string
}

export interface DSXUCheckpoint {
  checkpointId: string
  taskId: string
  runId: string
  summary: string
  resumeHint: string
  artifacts: string[]
  createdAt: number
}

export interface DSXUTaskAnalysis {
  complexity: DSXUTaskComplexity
  risk: DSXUTaskRisk
  verification: DSXUVerificationMode
  recommendedRoles: string[]
  routeHints: string[]
}

export function analyzeTaskForControlPlane(input: {
  title: string
  description: string
  constraints?: string[]
}): DSXUTaskAnalysis {
  const text = `${input.title}\n${input.description}\n${(input.constraints ?? []).join('\n')}`.toLowerCase()
  const highComplexity = /(architecture|migration|refactor|distributed|concurrency|security|性能|架构|迁移|重构|并发|安全)/i.test(text)
  const mediumComplexity = /(api|module|integration|test|feature|接口|模块|集成|测试|功能)/i.test(text)
  const riskHigh = /(delete|destructive|credential|payment|production|rollback|权限|删除|生产|凭证|支付|回滚)/i.test(text)
  const riskMedium = /(write|modify|permission|network|database|修改|写入|权限|网络|数据库)/i.test(text)
  const complexity: DSXUTaskComplexity = highComplexity ? 'high' : mediumComplexity ? 'medium' : 'low'
  const risk: DSXUTaskRisk = riskHigh ? 'high' : riskMedium ? 'medium' : 'low'
  const verification: DSXUVerificationMode = risk === 'high' || complexity === 'high' ? 'strict' : risk === 'medium' || complexity === 'medium' ? 'standard' : 'none'
  const recommendedRoles = new Set<string>()
  if (complexity === 'high') recommendedRoles.add('architect')
  if (risk !== 'low' || verification === 'strict') recommendedRoles.add('reviewer')
  if (/(test|verify|验证|测试|检查)/i.test(text)) recommendedRoles.add('verifier')
  if (recommendedRoles.size === 0) recommendedRoles.add('executor')
  const routeHints = [`complexity:${complexity}`, `risk:${risk}`, `verification:${verification}`]
  if (verification !== 'none') routeHints.push('route:checks-orchestrator')
  if (recommendedRoles.has('reviewer')) routeHints.push('route:subagent-review')
  return { complexity, risk, verification, recommendedRoles: [...recommendedRoles], routeHints }
}

export function createTaskControlPlane(trace: DSXUTraceCollector) {
  const tasks = new Map<string, DSXUTask>()
  const runs = new Map<string, DSXURun>()
  const checkpoints = new Map<string, DSXUCheckpoint>()
  let seq = 0

  function nextId(prefix: string) {
    return `${prefix}-${++seq}`
  }

  return {
    createTask(input: { sessionId: string; title: string; workspaceId: string }): DSXUTask {
      const now = Date.now()
      const task: DSXUTask = {
        taskId: nextId('task'),
        sessionId: input.sessionId,
        title: input.title,
        workspaceId: input.workspaceId,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      }
      tasks.set(task.taskId, task)
      trace.record({ type: 'task.created', sessionId: task.sessionId, taskId: task.taskId, payload: { task } })
      return task
    },
    startRun(input: { taskId: string; executor: DSXURun['executor'] }): DSXURun {
      const task = mustTask(input.taskId)
      task.status = 'running'
      task.updatedAt = Date.now()
      const run: DSXURun = {
        runId: nextId('run'),
        taskId: task.taskId,
        status: 'running',
        executor: input.executor,
        startedAt: Date.now(),
      }
      runs.set(run.runId, run)
      trace.record({ type: 'run.created', sessionId: task.sessionId, taskId: task.taskId, runId: run.runId, payload: { run } })
      return run
    },
    completeRun(runId: string, output: string): DSXURun {
      const run = mustRun(runId)
      const task = mustTask(run.taskId)
      run.status = 'succeeded'
      run.endedAt = Date.now()
      task.status = 'succeeded'
      task.updatedAt = run.endedAt
      trace.record({ type: 'run.completed', sessionId: task.sessionId, taskId: task.taskId, runId, payload: { output } })
      return run
    },
    failRun(runId: string, failure: DSXUFailure): DSXURun {
      const run = mustRun(runId)
      const task = mustTask(run.taskId)
      run.status = 'failed'
      run.endedAt = Date.now()
      run.failureCode = failure.failureCode
      task.status = 'failed'
      task.updatedAt = run.endedAt
      task.resumeHint = failure.recommendedAction
      trace.record({
        type: 'run.failed',
        sessionId: task.sessionId,
        taskId: task.taskId,
        runId,
        failureCode: failure.failureCode,
        payload: { failure },
      })
      return run
    },
    createCheckpoint(input: { taskId: string; runId: string; summary: string; resumeHint: string; artifacts?: string[] }): DSXUCheckpoint {
      const task = mustTask(input.taskId)
      const checkpoint: DSXUCheckpoint = {
        checkpointId: nextId('checkpoint'),
        taskId: input.taskId,
        runId: input.runId,
        summary: input.summary,
        resumeHint: input.resumeHint,
        artifacts: input.artifacts ?? [],
        createdAt: Date.now(),
      }
      task.resumeHint = input.resumeHint
      task.status = 'paused'
      task.updatedAt = checkpoint.createdAt
      checkpoints.set(checkpoint.checkpointId, checkpoint)
      trace.record({
        type: 'checkpoint.created',
        sessionId: task.sessionId,
        taskId: task.taskId,
        runId: input.runId,
        payload: { checkpoint },
      })
      return checkpoint
    },
    getTask(taskId: string) {
      return tasks.get(taskId)
    },
    getRun(runId: string) {
      return runs.get(runId)
    },
    listCheckpoints(taskId: string) {
      return [...checkpoints.values()].filter((checkpoint) => checkpoint.taskId === taskId)
    },
  }

  function mustTask(taskId: string): DSXUTask {
    const task = tasks.get(taskId)
    if (!task) throw new Error(`DSXU task not found: ${taskId}`)
    return task
  }

  function mustRun(runId: string): DSXURun {
    const run = runs.get(runId)
    if (!run) throw new Error(`DSXU run not found: ${runId}`)
    return run
  }
}
