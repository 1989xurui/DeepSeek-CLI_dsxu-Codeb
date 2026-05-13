/**
 * DUXU Runtime Core - 任务运行器
 *
 * 基础任务执行器，支持Continue/Resume最小链路
 */

import type { Task, TaskResult, TaskError, ResumePoint, UpdateTaskParams } from './model'
import type { PersistAdapter } from '../persist/adapter'

/**
 * 任务运行器配置
 */
export interface TaskRunnerConfig {
  /** 最大执行时间（毫秒） */
  maxExecutionTime?: number

  /** 最大重试次数 */
  maxRetries?: number

  /** 是否启用自动保存 */
  autoSave?: boolean

  /** 自动保存间隔（毫秒） */
  autoSaveInterval?: number

  /** 是否启用详细日志 */
  verboseLogging?: boolean
}

/**
 * 任务执行上下文
 */
export interface TaskExecutionContext {
  /** 任务ID */
  taskId: string

  /** 会话ID */
  sessionId: string

  /** 当前步骤 */
  currentStep: number

  /** 执行状态 */
  status: 'running' | 'paused' | 'completed' | 'failed'

  /** 开始时间 */
  startedAt: number

  /** 最后活动时间 */
  lastActivityAt: number

  /** 执行统计 */
  stats: {
    stepsCompleted: number
    errorsEncountered: number
    retriesUsed: number
    durationMs: number
  }

  /** 执行数据 */
  data: Record<string, any>
}

/**
 * 任务处理器函数
 */
export type TaskHandler = (
  context: TaskExecutionContext,
  persist: PersistAdapter
) => Promise<{
  success: boolean
  result?: any
  error?: string
  nextStep?: number
  shouldPause?: boolean
}>

/**
 * 任务运行器
 */
export class TaskRunner {
  private persist: PersistAdapter
  private config: TaskRunnerConfig
  private handlers: Map<string, TaskHandler> = new Map()
  private executionContexts: Map<string, TaskExecutionContext> = new Map()
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(persist: PersistAdapter, config?: TaskRunnerConfig) {
    this.persist = persist
    this.config = {
      maxExecutionTime: 30 * 60 * 1000, // 30分钟
      maxRetries: 3,
      autoSave: true,
      autoSaveInterval: 30 * 1000, // 30秒
      verboseLogging: false,
      ...config
    }
  }

  /**
   * 注册任务处理器
   */
  registerHandler(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler)
  }

  /**
   * 创建并启动任务
   */
  async createAndRunTask(params: {
    sessionId: string
    title: string
    description?: string
    taskType: string
    input?: Record<string, any>
    metadata?: Record<string, any>
  }): Promise<Task> {
    // 创建任务
    const { createTask } = await import('./model')
    const task = createTask({
      sessionId: params.sessionId,
      title: params.title,
      description: params.description,
      input: params.input,
      metadata: {
        ...params.metadata,
        taskType: params.taskType
      }
    })

    // 更新状态为running
    const updatedTask = {
      ...task,
      status: 'running' as const,
      updatedAt: Date.now()
    }

    // 保存任务
    await this.persist.saveTask(updatedTask)

    // 启动任务执行
    this.runTask(updatedTask).catch(error => {
      console.error(`任务执行失败: ${updatedTask.id}`, error)
    })

    return updatedTask
  }

  /**
   * 运行任务
   */
  private async runTask(task: Task): Promise<void> {
    const taskType = task.metadata?.taskType as string
    const handler = this.handlers.get(taskType)

    if (!handler) {
      await this.failTask(task, {
        message: `未找到任务处理器: ${taskType}`,
        code: 'HANDLER_NOT_FOUND',
        recoverable: false
      })
      return
    }

    // 创建执行上下文
    const context: TaskExecutionContext = {
      taskId: task.id,
      sessionId: task.sessionId,
      currentStep: task.resumePoint?.step || 0,
      status: 'running',
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      stats: {
        stepsCompleted: 0,
        errorsEncountered: 0,
        retriesUsed: 0,
        durationMs: 0
      },
      data: task.resumePoint?.context || task.input || {}
    }

    this.executionContexts.set(task.id, context)

    // 设置自动保存
    if (this.config.autoSave) {
      this.setupAutoSave(task.id)
    }

    // 设置执行超时
    const timeoutId = setTimeout(async () => {
      await this.handleTimeout(task.id)
    }, this.config.maxExecutionTime!)

    try {
      // 执行任务
      const result = await handler(context, this.persist)

      // 清理定时器
      clearTimeout(timeoutId)
      this.cleanupTask(task.id)

      // 处理执行结果
      if (result.success) {
        await this.completeTask(task, {
          type: 'success',
          message: '任务执行成功',
          data: result.result,
          stats: {
            durationMs: Date.now() - context.startedAt,
            stepsCompleted: context.stats.stepsCompleted
          }
        })
      } else if (result.shouldPause) {
        await this.pauseTask(task, {
          step: result.nextStep || context.currentStep + 1,
          context: context.data,
          description: result.error || '任务被暂停'
        })
      } else if (result.nextStep !== undefined) {
        // 有下一步，继续执行（递归调用）
        context.currentStep = result.nextStep
        this.executionContexts.set(task.id, context)

        // 继续执行（使用setTimeout避免栈溢出）
        setTimeout(() => {
          this.runTask(task).catch(error => {
            console.error(`任务继续执行失败: ${task.id}`, error)
          })
        }, 0)
      } else {
        // 真正的失败
        await this.failTask(task, {
          message: result.error || '任务执行失败',
          code: 'EXECUTION_FAILED',
          recoverable: true,
          recoverySuggestion: '检查输入参数后重试'
        })
      }
    } catch (error) {
      // 清理定时器
      clearTimeout(timeoutId)
      this.cleanupTask(task.id)

      await this.failTask(task, {
        message: error instanceof Error ? error.message : '未知错误',
        code: 'UNEXPECTED_ERROR',
        details: error,
        recoverable: false
      })
    }
  }

  /**
   * 继续执行已暂停的任务
   */
  async continueTask(taskId: string): Promise<Task | null> {
    const task = await this.persist.loadTask(taskId)
    if (!task || task.status !== 'paused' || !task.resumePoint) {
      return null
    }

    // 更新状态为running
    const updatedTask = {
      ...task,
      status: 'running' as const,
      updatedAt: Date.now(),
      resumePoint: undefined
    }

    await this.persist.saveTask(updatedTask)

    // 继续执行
    this.runTask(updatedTask).catch(error => {
      console.error(`任务继续执行失败: ${updatedTask.id}`, error)
    })

    return updatedTask
  }

  /**
   * 暂停任务
   */
  async pauseTask(task: Task, resumePoint: {
    step: number
    context: any
    description: string
  }): Promise<Task> {
    const { createResumePoint, updateTask } = await import('./model')

    const updatedTask = updateTask(task, {
      status: 'paused',
      resumePoint: createResumePoint(resumePoint)
    })

    await this.persist.saveTask(updatedTask)
    this.cleanupTask(task.id)

    if (this.config.verboseLogging) {
      console.log(`任务已暂停: ${task.id}, 恢复点: ${resumePoint.step}`)
    }

    return updatedTask
  }

  /**
   * 完成任务
   */
  private async completeTask(task: Task, resultParams: {
    type: 'success' | 'partial' | 'noop'
    message: string
    data?: any
    stats?: {
      durationMs: number
      stepsCompleted?: number
      tokensUsed?: number
      toolsUsed?: number
    }
  }): Promise<Task> {
    const { createTaskResult, updateTask } = await import('./model')

    const updatedTask = updateTask(task, {
      status: 'completed',
      result: createTaskResult(resultParams),
      output: resultParams.data
    })

    await this.persist.saveTask(updatedTask)

    if (this.config.verboseLogging) {
      console.log(`任务已完成: ${task.id}, 结果: ${resultParams.message}`)
    }

    return updatedTask
  }

  /**
   * 任务失败
   */
  private async failTask(task: Task, errorParams: {
    message: string
    code?: string
    details?: any
    recoverable?: boolean
    recoverySuggestion?: string
  }): Promise<Task> {
    const { createTaskError, updateTask } = await import('./model')

    const updatedTask = updateTask(task, {
      status: errorParams.recoverable ? 'failed' : 'error',
      error: createTaskError(errorParams)
    })

    await this.persist.saveTask(updatedTask)
    this.cleanupTask(task.id)

    if (this.config.verboseLogging) {
      console.log(`任务失败: ${task.id}, 错误: ${errorParams.message}`)
    }

    return updatedTask
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<Task | null> {
    const task = await this.persist.loadTask(taskId)
    if (!task || !['pending', 'running', 'paused'].includes(task.status)) {
      return null
    }

    const updatedTask = {
      ...task,
      status: 'cancelled' as const,
      updatedAt: Date.now()
    }

    await this.persist.saveTask(updatedTask)
    this.cleanupTask(taskId)

    return updatedTask
  }

  /**
   * 处理执行超时
   */
  private async handleTimeout(taskId: string): Promise<void> {
    const task = await this.persist.loadTask(taskId)
    if (!task || task.status !== 'running') return

    await this.failTask(task, {
      message: '任务执行超时',
      code: 'TIMEOUT',
      recoverable: true,
      recoverySuggestion: '增加执行时间限制或优化任务逻辑'
    })
  }

  /**
   * 设置自动保存
   */
  private setupAutoSave(taskId: string): void {
    const timer = setInterval(async () => {
      const context = this.executionContexts.get(taskId)
      if (!context) return

      const task = await this.persist.loadTask(taskId)
      if (!task || task.status !== 'running') return

      // 更新最后活动时间
      context.lastActivityAt = Date.now()
      context.stats.durationMs = Date.now() - context.startedAt

      // 保存上下文到任务元数据
      const updatedTask = {
        ...task,
        metadata: {
          ...task.metadata,
          lastExecutionContext: context
        },
        updatedAt: Date.now()
      }

      await this.persist.saveTask(updatedTask)

      if (this.config.verboseLogging) {
        console.log(`自动保存任务: ${taskId}`)
      }
    }, this.config.autoSaveInterval!)

    this.autoSaveTimers.set(taskId, timer)
  }

  /**
   * 清理任务资源
   */
  private cleanupTask(taskId: string): void {
    // 清理执行上下文
    this.executionContexts.delete(taskId)

    // 清理自动保存定时器
    const timer = this.autoSaveTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.autoSaveTimers.delete(taskId)
    }
  }

  /**
   * 获取任务执行状态
   */
  getTaskStatus(taskId: string): TaskExecutionContext | null {
    return this.executionContexts.get(taskId) || null
  }

  /**
   * 获取所有运行中的任务
   */
  getRunningTasks(): TaskExecutionContext[] {
    return Array.from(this.executionContexts.values())
  }

  /**
   * 停止所有任务
   */
  async stopAllTasks(): Promise<void> {
    const runningTasks = this.getRunningTasks()

    for (const context of runningTasks) {
      const task = await this.persist.loadTask(context.taskId)
      if (task && task.status === 'running') {
        await this.pauseTask(task, {
          step: context.currentStep,
          context: context.data,
          description: '系统停止所有任务'
        })
      }
    }

    // 清理所有资源
    this.executionContexts.clear()
    for (const timer of this.autoSaveTimers.values()) {
      clearInterval(timer)
    }
    this.autoSaveTimers.clear()
  }
}