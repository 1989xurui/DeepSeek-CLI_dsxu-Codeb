/**
 * 任务执行引擎服务 - 高级特性实现
 */

import { EventEmitter } from 'events'
import { z } from 'zod'
import {
  Task,
  TaskId,
  TaskStatus,
  TaskError,
  TaskResult,
  TaskEvent,
  TaskCreatedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskFactory
} from '../entities/task.entity'

// 配置
export interface TaskEngineConfig {
  maxConcurrentTasks: number
  defaultTimeout: number
  retryDelay: number
  enableMetrics: boolean
  enableTracing: boolean
}

// 存储接口
export interface TaskRepository {
  save(task: Task): Promise<void>
  findById(id: TaskId): Promise<Task | null>
  findByStatus(status: TaskStatus): Promise<Task[]>
  updateStatus(id: TaskId, status: TaskStatus, updates?: Partial<Task>): Promise<void>
}

// 执行器接口
export interface TaskExecutor {
  execute(task: Task): Promise<TaskResult>
  cancel(taskId: TaskId): Promise<void>
  validate(task: Task): Promise<void>
}

// 高级任务引擎
export class AdvancedTaskEngine {
  private eventEmitter = new EventEmitter()
  private activeTasks = new Map<TaskId, { task: Task; controller: AbortController }>()
  private metrics = {
    tasksExecuted: 0,
    tasksFailed: 0,
    tasksCancelled: 0,
    totalDuration: 0,
    averageDuration: 0
  }

  constructor(
    private repository: TaskRepository,
    private executor: TaskExecutor,
    private config: TaskEngineConfig = {
      maxConcurrentTasks: 10,
      defaultTimeout: 5 * 60 * 1000, // 5分钟
      retryDelay: 1000,
      enableMetrics: true,
      enableTracing: true
    }
  ) {}

  // 执行任务
  async execute(task: Task): Promise<TaskResult> {
    // 验证任务
    TaskFactory.validate(task)

    // 检查并发限制
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new TaskError('达到最大并发任务数', 'CONCURRENCY_LIMIT', {
        maxConcurrent: this.config.maxConcurrentTasks,
        currentActive: this.activeTasks.size
      }, true) // 可重试
    }

    // 检查依赖
    await this.checkDependencies(task)

    // 创建取消控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort(new TaskError('任务执行超时', 'TIMEOUT'))
    }, task.metadata.constraints?.maxDuration || this.config.defaultTimeout)

    try {
      // 保存任务状态
      task.status = 'RUNNING'
      task.startedAt = new Date()
      await this.repository.save(task)

      // 发射事件
      this.emitEvent(new TaskStartedEvent(task.id, new Date(), {
        startedAt: task.startedAt
      }))

      // 记录活跃任务
      this.activeTasks.set(task.id, { task, controller })

      // 执行任务
      const result = await this.executor.execute(task)

      // 更新任务状态
      task.status = result.success ? 'COMPLETED' : 'FAILED'
      task.completedAt = new Date()
      task.updatedAt = new Date()
      await this.repository.save(task)

      // 发射事件
      this.emitEvent(new TaskCompletedEvent(task.id, new Date(), { result }))

      // 更新指标
      this.updateMetrics(result)

      return result

    } catch (error) {
      // 处理错误
      const taskError = error instanceof TaskError ? error : new TaskError(
        error instanceof Error ? error.message : '未知错误',
        'EXECUTION_ERROR',
        { originalError: error }
      )

      // 更新任务状态
      task.status = 'FAILED'
      task.updatedAt = new Date()
      await this.repository.save(task)

      // 发射事件
      this.emitEvent(new TaskFailedEvent(task.id, new Date(), {
        error: taskError
      }))

      // 重试逻辑
      if (taskError.retryable && task.retryCount < task.maxRetries) {
        await this.scheduleRetry(task, taskError)
      }

      throw taskError

    } finally {
      // 清理
      clearTimeout(timeoutId)
      this.activeTasks.delete(task.id)
    }
  }

  // 取消任务
  async cancel(taskId: TaskId): Promise<void> {
    const active = this.activeTasks.get(taskId)
    if (!active) {
      throw new TaskError('任务未找到或未运行', 'TASK_NOT_FOUND')
    }

    // 取消执行
    active.controller.abort(new TaskError('任务被取消', 'CANCELLED'))

    // 更新状态
    const task = active.task
    task.status = 'CANCELLED'
    task.updatedAt = new Date()
    await this.repository.save(task)

    // 清理
    this.activeTasks.delete(taskId)
    this.metrics.tasksCancelled++

    // 发射事件
    this.emitEvent({
      type: 'TASK_CANCELLED',
      taskId,
      timestamp: new Date(),
      payload: { cancelledAt: new Date() }
    })
  }

  // 获取任务状态
  async getStatus(taskId: TaskId): Promise<{
    task: Task
    isActive: boolean
    progress?: number
    estimatedCompletion?: Date
  }> {
    const task = await this.repository.findById(taskId)
    if (!task) {
      throw new TaskError('任务未找到', 'TASK_NOT_FOUND')
    }

    const isActive = this.activeTasks.has(taskId)
    let progress: number | undefined
    let estimatedCompletion: Date | undefined

    if (isActive && task.startedAt) {
      const duration = Date.now() - task.startedAt.getTime()
      const maxDuration = task.metadata.constraints?.maxDuration || this.config.defaultTimeout
      progress = Math.min(100, (duration / maxDuration) * 100)

      if (progress < 100) {
        estimatedCompletion = new Date(task.startedAt.getTime() + maxDuration)
      }
    }

    return { task, isActive, progress, estimatedCompletion }
  }

  // 获取引擎指标
  getMetrics() {
    return {
      ...this.metrics,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      concurrencyUtilization: (this.activeTasks.size / this.config.maxConcurrentTasks) * 100
    }
  }

  // 订阅事件
  subscribe(eventType: string, handler: (event: TaskEvent) => void): () => void {
    this.eventEmitter.on(eventType, handler)
    return () => this.eventEmitter.off(eventType, handler)
  }

  // 私有方法
  private async checkDependencies(task: Task): Promise<void> {
    if (task.dependencies.length === 0) return

    const dependencies = await Promise.all(
      task.dependencies.map(id => this.repository.findById(id))
    )

    const failedDeps = dependencies.filter(dep =>
      dep && (dep.status === 'FAILED' || dep.status === 'CANCELLED')
    )

    if (failedDeps.length > 0) {
      throw new TaskError('依赖任务失败', 'DEPENDENCY_FAILED', {
        failedDependencies: failedDeps.map(dep => ({
          id: dep!.id,
          status: dep!.status,
          error: dep!.metadata.artifacts?.metrics?.lastError
        }))
      })
    }

    const pendingDeps = dependencies.filter(dep =>
      dep && (dep.status === 'PENDING' || dep.status === 'RUNNING')
    )

    if (pendingDeps.length > 0) {
      throw new TaskError('依赖任务未完成', 'DEPENDENCY_PENDING', {
        pendingDependencies: pendingDeps.map(dep => ({
          id: dep!.id,
          status: dep!.status,
          startedAt: dep!.startedAt
        }))
      }, true) // 可重试
    }
  }

  private async scheduleRetry(task: Task, error: TaskError): Promise<void> {
    task.retryCount++
    task.status = 'PENDING'
    task.updatedAt = new Date()

    // 添加延迟
    const delay = this.config.retryDelay * Math.pow(2, task.retryCount - 1)
    task.timeoutAt = new Date(Date.now() + delay)

    await this.repository.save(task)

    // 发射重试事件
    this.emitEvent({
      type: 'TASK_RETRY_SCHEDULED',
      taskId: task.id,
      timestamp: new Date(),
      payload: {
        retryCount: task.retryCount,
        delay,
        error: error.message
      }
    })

    // 延迟后重新执行
    setTimeout(async () => {
      try {
        await this.execute(task)
      } catch (retryError) {
        // 重试失败，记录日志
        console.error(`任务 ${task.id} 重试失败:`, retryError)
      }
    }, delay)
  }

  private updateMetrics(result: TaskResult): void {
    if (!this.config.enableMetrics) return

    this.metrics.tasksExecuted++
    if (!result.success) {
      this.metrics.tasksFailed++
    }
    this.metrics.totalDuration += result.duration
    this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.tasksExecuted
  }

  private emitEvent(event: TaskEvent): void {
    this.eventEmitter.emit(event.type, event)
    this.eventEmitter.emit('*', event) // 通配符监听器
  }

  // 批量操作
  async executeBatch(tasks: Task[]): Promise<Map<TaskId, TaskResult>> {
    const results = new Map<TaskId, TaskResult>()
    const errors: Array<{ taskId: TaskId; error: Error }> = []

    // 并行执行，但受并发限制
    const semaphore = new Semaphore(this.config.maxConcurrentTasks)

    await Promise.all(
      tasks.map(async (task) => {
        await semaphore.acquire()
        try {
          const result = await this.execute(task)
          results.set(task.id, result)
        } catch (error) {
          errors.push({ taskId: task.id, error: error as Error })
        } finally {
          semaphore.release()
        }
      })
    )

    if (errors.length > 0) {
      throw new TaskError('批量执行中有任务失败', 'BATCH_EXECUTION_FAILED', {
        totalTasks: tasks.length,
        successful: results.size,
        failed: errors.length,
        errors: errors.map(e => ({
          taskId: e.taskId,
          error: e.error.message
        }))
      })
    }

    return results
  }

  // 清理过时任务
  async cleanupStaleTasks(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
    const staleStatuses: TaskStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

    let cleaned = 0
    for (const status of staleStatuses) {
      const tasks = await this.repository.findByStatus(status)
      const staleTasks = tasks.filter(task => task.updatedAt < cutoff)

      for (const task of staleTasks) {
        // 这里可以添加归档逻辑
        // 暂时只是记录
        console.log(`清理过时任务: ${task.id} (${task.status})`)
        cleaned++
      }
    }

    return cleaned
  }
}

// 信号量实现
class Semaphore {
  private queue: Array<() => void> = []
  private available: number

  constructor(concurrency: number) {
    this.available = concurrency
  }

  acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.available > 0) {
        this.available--
        resolve()
      } else {
        this.queue.push(resolve)
      }
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      next?.()
    } else {
      this.available++
    }
  }
}