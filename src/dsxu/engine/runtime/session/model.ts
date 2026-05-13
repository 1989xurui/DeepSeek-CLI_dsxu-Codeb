/**
 * DUXU Runtime Core - Session 对象模型
 *
 * 统一会话对象定义，支持可恢复的任务系统
 *
 * 冻结接口：窗口B/C只能消费，不得修改主定义
 */

/**
 * 会话状态
 */
export type SessionStatus =
  | 'created'    // 已创建
  | 'active'     // 活跃中
  | 'paused'     // 已暂停
  | 'completed'  // 已完成
  | 'aborted'    // 已中止
  | 'error'      // 错误状态

/**
 * 会话对象
 */
export interface Session {
  /** 会话唯一标识 */
  id: string

  /** 创建时间戳（毫秒） */
  createdAt: number

  /** 最后更新时间戳（毫秒） */
  updatedAt: number

  /** 工作目录 */
  cwd: string

  /** 会话标题 */
  title: string

  /** 会话状态 */
  status: SessionStatus

  /** 当前执行的任务ID（如有） */
  currentTaskId?: string

  /** 关联的任务ID列表 */
  taskIds: string[]

  /** 扩展元数据 */
  metadata: Record<string, any>

  /** 错误信息（如状态为error） */
  error?: {
    message: string
    code?: string
    details?: any
    timestamp: number
  }
}

/**
 * 会话过滤器
 */
export interface SessionFilter {
  /** 状态过滤 */
  status?: SessionStatus | SessionStatus[]

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

  /** 是否包含错误 */
  hasError?: boolean

  /** 是否有关联任务 */
  hasTasks?: boolean
}

/**
 * 创建新会话参数
 */
export interface CreateSessionParams {
  cwd: string
  title?: string
  metadata?: Record<string, any>
}

/**
 * 更新会话参数
 */
export interface UpdateSessionParams {
  title?: string
  status?: SessionStatus
  currentTaskId?: string
  metadata?: Record<string, any>
  error?: {
    message: string
    code?: string
    details?: any
  }
}

/**
 * 创建会话对象
 */
export function createSession(params: CreateSessionParams): Session {
  const now = Date.now()

  return {
    id: `session-${now}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    cwd: params.cwd,
    title: params.title || `Session ${new Date(now).toLocaleString()}`,
    status: 'created',
    taskIds: [],
    metadata: params.metadata || {}
  }
}

/**
 * 更新会话对象
 */
export function updateSession(session: Session, updates: UpdateSessionParams): Session {
  return {
    ...session,
    ...updates,
    updatedAt: Date.now()
  }
}

/**
 * 验证会话对象有效性
 */
export function validateSession(session: Session): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!session.id) {
    errors.push('会话ID不能为空')
  }

  if (!session.cwd) {
    errors.push('工作目录不能为空')
  }

  if (!session.title) {
    errors.push('会话标题不能为空')
  }

  if (!session.status) {
    errors.push('会话状态不能为空')
  } else if (!['created', 'active', 'paused', 'completed', 'aborted', 'error'].includes(session.status)) {
    errors.push(`无效的会话状态: ${session.status}`)
  }

  if (!Array.isArray(session.taskIds)) {
    errors.push('taskIds必须是数组')
  }

  if (session.status === 'error' && !session.error) {
    errors.push('错误状态的会话必须包含错误信息')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}