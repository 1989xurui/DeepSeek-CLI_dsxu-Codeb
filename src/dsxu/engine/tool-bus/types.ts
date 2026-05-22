/**
 * Legacy tool-bus type file retained only because Windows ACL blocked
 * physical removal after copying to _deleted_files.
 *
 * Tool Bus 洋葱圈架构 - 类型定义
 * 
 * 将React Hooks系统转换为事件驱动的Tool Bus架构
 */

/**
 * Tool Bus 上下文接口
 */
export interface ToolBusContext {
  /** 事件名称 */
  event: string
  /** 事件数据 */
  data: any
  /** 元数据 */
  metadata: {
    /** 时间戳 */
    timestamp: number
    /** 会话ID */
    sessionId: string
    /** 当前工作目录 */
    cwd: string
    /** 事件来源 */
    source?: string
    /** 关联的工具调用ID（如果有） */
    toolUseId?: string
  }
  /** 执行结果 */
  result?: any
  /** 执行错误 */
  error?: Error
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 是否继续执行 */
  continue?: boolean
  /** 自定义扩展数据 */
  [key: string]: any
}

/**
 * 中间件函数类型
 */
export type MiddlewareFunction = (
  context: ToolBusContext,
  next: () => Promise<void>
) => Promise<void>

/**
 * 中间件定义
 */
export interface Middleware {
  /** 中间件名称 */
  name: string
  /** 中间件描述 */
  description?: string
  /** 执行优先级（数字越小优先级越高） */
  priority: number
  /** 匹配的事件模式（支持通配符） */
  match?: string | string[]
  /** 中间件执行函数 */
  execute: MiddlewareFunction
  /** 是否启用 */
  enabled?: boolean
  /** 只读中间件（不修改上下文） */
  readOnly?: boolean
}

/**
 * 事件处理器
 */
export interface EventHandler {
  /** 处理器ID */
  id: string
  /** 事件名称 */
  event: string
  /** 处理器函数 */
  handler: (context: ToolBusContext) => Promise<void> | void
  /** 是否只执行一次 */
  once?: boolean
}

/**
 * Tool Bus 配置
 */
export interface ToolBusConfig {
  /** 是否启用调试日志 */
  debug?: boolean
  /** 默认中间件优先级 */
  defaultPriority?: number
  /** 最大中间件数量 */
  maxMiddlewares?: number
  /** 执行超时时间（毫秒） */
  timeoutMs?: number
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean
  /** 是否启用错误恢复 */
  enableErrorRecovery?: boolean
  /** Whether to assemble legacy default middlewares. Default false; owners opt in explicitly. */
  enableDefaultMiddlewares?: boolean
}

/**
 * 执行统计信息
 */
export interface ExecutionStats {
  /** 总执行次数 */
  totalExecutions: number
  /** 成功次数 */
  successCount: number
  /** 失败次数 */
  failureCount: number
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number
  /** 中间件执行统计 */
  middlewareStats: Record<string, {
    executions: number
    averageTime: number
    errors: number
  }>
}

/**
 * 中间件执行结果
 */
export interface MiddlewareExecutionResult {
  /** 是否成功 */
  success: boolean
  /** 执行时间（毫秒） */
  duration: number
  /** 错误信息（如果有） */
  error?: Error
  /** 中间件名称 */
  middlewareName: string
  /** 是否跳过了执行 */
  skipped?: boolean
}

/**
 * 事件执行结果
 */
export interface EventExecutionResult {
  /** 事件名称 */
  event: string
  /** 是否成功 */
  success: boolean
  /** 总执行时间（毫秒） */
  totalDuration: number
  /** 中间件执行结果 */
  middlewareResults: MiddlewareExecutionResult[]
  /** 最终上下文 */
  finalContext: ToolBusContext
  /** 错误信息（如果有） */
  error?: Error
}

/**
 * 中间件工厂函数
 */
export type MiddlewareFactory = (options?: any) => Middleware

/**
 * 插件定义
 */
export interface ToolBusPlugin {
  /** 插件名称 */
  name: string
  /** 插件版本 */
  version?: string
  /** 注册的中间件 */
  middlewares?: Middleware[]
  /** 初始化函数 */
  initialize?: (toolBus: ToolBus) => Promise<void> | void
  /** 销毁函数 */
  destroy?: () => Promise<void> | void
}

/**
 * Hook事件到Tool Bus事件的映射
 */
export interface HookEventMapping {
  /** Hook事件名称 */
  hookEvent: string
  /** Tool Bus事件名称 */
  toolBusEvent: string
  /** 数据转换函数 */
  transformData?: (hookData: any) => any
  /** 是否异步执行 */
  async?: boolean
}
