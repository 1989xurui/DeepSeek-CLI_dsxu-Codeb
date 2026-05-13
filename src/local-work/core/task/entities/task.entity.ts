/**
 * 任务实体 - 领域驱动设计
 */

import { z } from 'zod'

// 值对象
export const TaskId = z.string().uuid().brand<'TaskId'>()
export type TaskId = z.infer<typeof TaskId>

export const TaskStatus = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT'
])
export type TaskStatus = z.infer<typeof TaskStatus>

export const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export type TaskPriority = z.infer<typeof TaskPriority>

// 实体
export interface Task {
  id: TaskId
  name: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  metadata: TaskMetadata
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
  timeoutAt?: Date
  retryCount: number
  maxRetries: number
  dependencies: TaskId[]
  tags: string[]
}

export interface TaskMetadata {
  mode: 'codefix' | 'feature' | 'review' | 'fullabsorb'
  config?: Record<string, any>
  environment?: Record<string, string>
  constraints?: TaskConstraints
  artifacts?: TaskArtifacts
}

export interface TaskConstraints {
  maxDuration?: number // 毫秒
  maxMemory?: number // MB
  maxCpu?: number // 百分比
  requireNetwork?: boolean
  requireStorage?: boolean
}

export interface TaskArtifacts {
  logs?: string[]
  reports?: string[]
  metrics?: Record<string, any>
  files?: string[]
}

// 领域事件
export interface TaskEvent {
  type: string
  taskId: TaskId
  timestamp: Date
  payload: Record<string, any>
}

export class TaskCreatedEvent implements TaskEvent {
  type = 'TASK_CREATED' as const
  constructor(
    public taskId: TaskId,
    public timestamp: Date,
    public payload: { task: Task }
  ) {}
}

export class TaskStartedEvent implements TaskEvent {
  type = 'TASK_STARTED' as const
  constructor(
    public taskId: TaskId,
    public timestamp: Date,
    public payload: { startedAt: Date }
  ) {}
}

export class TaskCompletedEvent implements TaskEvent {
  type = 'TASK_COMPLETED' as const
  constructor(
    public taskId: TaskId,
    public timestamp: Date,
    public payload: { result: TaskResult }
  ) {}
}

export class TaskFailedEvent implements TaskEvent {
  type = 'TASK_FAILED' as const
  constructor(
    public taskId: TaskId,
    public timestamp: Date,
    public payload: { error: TaskError }
  ) {}
}

// 错误类型
export class TaskError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'TaskError'
  }
}

// 结果类型
export interface TaskResult {
  success: boolean
  duration: number // 毫秒
  output?: string
  artifacts?: TaskArtifacts
  metrics?: Record<string, any>
  warnings?: string[]
  errors?: TaskError[]
}

// 工厂函数
export class TaskFactory {
  static create(params: {
    name: string
    description?: string
    priority?: TaskPriority
    metadata: TaskMetadata
    dependencies?: TaskId[]
    tags?: string[]
  }): Task {
    const now = new Date()
    const taskId = crypto.randomUUID() as TaskId

    return {
      id: taskId,
      name: params.name,
      description: params.description,
      status: 'PENDING' as TaskStatus,
      priority: params.priority || 'MEDIUM',
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      maxRetries: params.metadata.constraints?.maxRetries || 3,
      dependencies: params.dependencies || [],
      tags: params.tags || []
    }
  }

  static validate(task: Task): void {
    // 验证任务状态转换
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      PENDING: ['RUNNING', 'CANCELLED'],
      RUNNING: ['COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'],
      COMPLETED: [],
      FAILED: ['PENDING'], // 重试
      CANCELLED: [],
      TIMEOUT: ['PENDING'] // 重试
    }

    if (!validTransitions[task.status]) {
      throw new TaskError(`无效的任务状态: ${task.status}`, 'INVALID_STATUS')
    }

    // 验证依赖关系
    if (task.dependencies.length > 0 && task.status === 'RUNNING') {
      throw new TaskError('运行中的任务不能有依赖', 'INVALID_DEPENDENCY')
    }

    // 验证超时设置
    if (task.timeoutAt && task.timeoutAt < new Date()) {
      throw new TaskError('超时时间不能在过去', 'INVALID_TIMEOUT')
    }
  }
}