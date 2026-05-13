/**
 * DUXU Runtime Core - Task 对象模型
 *
 * 统一任务对象定义，支持可恢复的任务执行
 *
 * 冻结接口：窗口B/C只能消费，不得修改主定义
 */

/**
 * 任务状态
 */
export type TaskStatus =
  | 'pending'     // 等待执行
  | 'running'     // 执行中
  | 'paused'      // 已暂停
  | 'completed'   // 已完成
  | 'failed'      // 执行失败
  | 'cancelled'   // 已取消
  | 'error'       // 错误状态

/**
 * 任务结果
 */
export interface TaskResult {
  /** 结果类型 */
  type: 'success' | 'partial' | 'noop'

  /** 结果消息 */
  message: string

  /** 结果数据 */
  data?: any

  /** 完成时间戳 */
  completedAt: number

  /** 执行统计 */
  stats?: {
    durationMs: number
    turns?: number
    tokensUsed?: number
    toolsUsed?: number
  }
}

/**
 * 任务错误
 */
export interface TaskError {
  /** 错误消息 */
  message: string

  /** 错误代码 */
  code?: string

  /** 错误详情 */
  details?: any

  /** 是否可恢复 */
  recoverable: boolean

  /** 发生时间戳 */
  timestamp: number

  /** 建议的恢复操作 */
  recoverySuggestion?: string
}

/**
 * 恢复点
 */
export interface ResumePoint {
  /** 恢复步骤编号 */
  step: number

  /** 恢复上下文 */
  context: any

  /** 创建时间戳 */
  timestamp: number

  /** 恢复点描述 */
  description: string

  /** 恢复点元数据 */
  metadata?: Record<string, any>
}

/**
 * 任务对象
 */
export interface Task {
  /** 任务唯一标识 */
  id: string

  /** 所属会话ID */
  sessionId: string

  /** 创建时间戳（毫秒） */
  createdAt: number

  /** 最后更新时间戳（毫秒） */
  updatedAt: number

  /** 任务标题 */
  title: string

  /** 任务描述（可选） */
  description?: string

  /** 任务状态 */
  status: TaskStatus

  /** 任务结果（如状态为completed） */
  result?: TaskResult

  /** 任务错误（如状态为failed或error） */
  error?: TaskError

  /** 恢复点（如状态为paused） */
  resumePoint?: ResumePoint

  /** 扩展元数据 */
  metadata: Record<string, any>

  /** 任务输入参数 */
  input?: Record<string, any>

  /** 任务输出数据 */
  output?: any
}

/**
 * 任务过滤器
 */
export interface TaskFilter {
  /** 状态过滤 */
  status?: TaskStatus | TaskStatus[]

  /** 会话ID过滤 */
  sessionId?: string

  /** 创建时间范围 */
  createdAt?: {
    from?: number
    to?: number
  }

  /** 更新时间范围 */
  updatedAt?: {
    from?: number
    to?: number
  }

  /** 是否包含结果 */
  hasResult?: boolean

  /** 是否包含错误 */
  hasError?: boolean

  /** 是否可恢复（有resumePoint） */
  canResume?: boolean
}

/**
 * 创建新任务参数
 */
export interface CreateTaskParams {
  sessionId: string
  title: string
  description?: string
  input?: Record<string, any>
  metadata?: Record<string, any>
}

/**
 * 更新任务参数
 */
export interface UpdateTaskParams {
  title?: string
  description?: string
  status?: TaskStatus
  result?: TaskResult
  error?: TaskError
  resumePoint?: ResumePoint
  metadata?: Record<string, any>
  input?: Record<string, any>
  output?: any
}

/**
 * 创建任务对象
 */
export function createTask(params: CreateTaskParams): Task {
  const now = Date.now()

  return {
    id: `task-${now}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId: params.sessionId,
    createdAt: now,
    updatedAt: now,
    title: params.title,
    description: params.description,
    status: 'pending',
    metadata: params.metadata || {},
    input: params.input
  }
}

/**
 * 更新任务对象
 */
export function updateTask(task: Task, updates: UpdateTaskParams): Task {
  return {
    ...task,
    ...updates,
    updatedAt: Date.now()
  }
}

/**
 * 创建任务结果
 */
export function createTaskResult(params: {
  type: 'success' | 'partial' | 'noop'
  message: string
  data?: any
  stats?: {
    durationMs: number
    turns?: number
    tokensUsed?: number
    toolsUsed?: number
  }
}): TaskResult {
  return {
    type: params.type,
    message: params.message,
    data: params.data,
    completedAt: Date.now(),
    stats: params.stats
  }
}

/**
 * 创建任务错误
 */
export function createTaskError(params: {
  message: string
  code?: string
  details?: any
  recoverable?: boolean
  recoverySuggestion?: string
}): TaskError {
  return {
    message: params.message,
    code: params.code,
    details: params.details,
    recoverable: params.recoverable ?? false,
    timestamp: Date.now(),
    recoverySuggestion: params.recoverySuggestion
  }
}

/**
 * 创建恢复点
 */
export function createResumePoint(params: {
  step: number
  context: any
  description: string
  metadata?: Record<string, any>
}): ResumePoint {
  return {
    step: params.step,
    context: params.context,
    timestamp: Date.now(),
    description: params.description,
    metadata: params.metadata
  }
}

/**
 * 验证任务对象有效性
 */
export function validateTask(task: Task): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!task.id) {
    errors.push('任务ID不能为空')
  }

  if (!task.sessionId) {
    errors.push('会话ID不能为空')
  }

  if (!task.title) {
    errors.push('任务标题不能为空')
  }

  if (!task.status) {
    errors.push('任务状态不能为空')
  } else if (!['pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'error'].includes(task.status)) {
    errors.push(`无效的任务状态: ${task.status}`)
  }

  // 状态一致性检查
  if (task.status === 'completed' && !task.result) {
    errors.push('已完成的任务必须包含结果')
  }

  if ((task.status === 'failed' || task.status === 'error') && !task.error) {
    errors.push(`失败或错误状态的任务必须包含错误信息: ${task.status}`)
  }

  if (task.status === 'paused' && !task.resumePoint) {
    errors.push('已暂停的任务必须包含恢复点')
  }

  if (task.resumePoint && task.status !== 'paused') {
    errors.push('恢复点只能存在于已暂停的任务中')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}