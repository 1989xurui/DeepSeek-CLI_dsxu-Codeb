/**
 * V14 FROZEN: tool-bus experiment entry retained only because Windows ACL
 * blocked physical removal after copying to _deleted_files.
 *
 * Tool Bus 洋葱圈架构 - 核心实现
 * 
 * 事件驱动的中间件总线，支持洋葱圈执行模型
 */

import type {
  ToolBusContext,
  Middleware,
  MiddlewareFunction,
  EventHandler,
  ToolBusConfig,
  ExecutionStats,
  EventExecutionResult,
  MiddlewareExecutionResult,
  ToolBusPlugin,
} from './types'

/**
 * Tool Bus 核心类
 */
export class ToolBus {
  private middlewares: Map<string, Middleware> = new Map()
  private eventHandlers: Map<string, EventHandler[]> = new Map()
  private plugins: Map<string, ToolBusPlugin> = new Map()
  private config: Required<ToolBusConfig>
  private stats: ExecutionStats = {
    totalExecutions: 0,
    successCount: 0,
    failureCount: 0,
    averageExecutionTime: 0,
    middlewareStats: {},
  }
  private executionTimes: number[] = []
  private maxExecutionHistory = 100

  constructor(config?: ToolBusConfig) {
    this.config = {
      debug: config?.debug ?? false,
      defaultPriority: config?.defaultPriority ?? 100,
      maxMiddlewares: config?.maxMiddlewares ?? 100,
      timeoutMs: config?.timeoutMs ?? 30000,
      enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
      enableErrorRecovery: config?.enableErrorRecovery ?? true,
    }

    // 装配默认中间件（按洋葱圈顺序）
    this.assembleDefaultMiddlewares()

    if (this.config.debug) {
      console.log('[ToolBus] Initialized with config:', this.config)
    }
  }

  /**
   * 装配默认中间件（按洋葱圈顺序）
   */
  private assembleDefaultMiddlewares(): void {
    // 1. Metrics + Error Boundary 中间件（最外层，优先级100）
    this.assembleMetricsErrorMiddleware()

    // 2. 运行时追踪中间件（优先级75）
    this.assembleRuntimeTraceMiddleware()

    // 3. LSP 门禁中间件（优先级50，在工具执行前）
    this.assembleLSPGateMiddleware()

    // 4. Sanitize 中间件（内层，优先级300）
    this.assembleSanitizeMiddleware()

    if (this.config.debug) {
      console.log('[ToolBus] Default middlewares assembled in order: metrics-error -> runtime-trace -> lsp-gate -> sanitize')
    }
  }

  /**
   * 装配MetricsError中间件
   */
  private assembleMetricsErrorMiddleware(): void {
    try {
      // 使用动态导入避免编译时依赖
      const modulePath = '../middlewares/metrics-error'
      const metricsErrorModule = require(modulePath)

      if (metricsErrorModule && metricsErrorModule.createMetricsErrorMiddlewareObject) {
        const metricsErrorMiddleware = metricsErrorModule.createMetricsErrorMiddlewareObject({
          errorMode: 'degrade',
          enableMetrics: true,
          slowThresholdMs: 5000,
        })
        this.use(metricsErrorMiddleware)

        if (this.config.debug) {
          console.log('[ToolBus] Default middleware assembled: metrics-error')
        }
      }
    } catch (error: any) {
      // 中间件模块可能不存在，静默失败
      if (this.config.debug) {
        console.log('[ToolBus] Could not assemble metrics-error middleware:', error.message)
      }
    }
  }

  /**
   * 装配运行时追踪中间件
   */
  private assembleRuntimeTraceMiddleware(): void {
    try {
      // 使用动态导入避免编译时依赖
      const modulePath = '../middlewares/runtime-trace'
      const runtimeTraceModule = require(modulePath)

      if (runtimeTraceModule && runtimeTraceModule.createRuntimeTraceMiddlewareObject) {
        const runtimeTraceMiddleware = runtimeTraceModule.createRuntimeTraceMiddlewareObject({
          enabled: true,
          samplingIntervalMs: 1000,
          maxSnapshots: 100,
          enableMemoryMonitoring: true,
          enableErrorStackTracing: true,
          debug: this.config.debug,
        })
        this.use(runtimeTraceMiddleware)

        if (this.config.debug) {
          console.log('[ToolBus] Default middleware assembled: runtime-trace')
        }
      }
    } catch (error: any) {
      // 中间件模块可能不存在，静默失败
      if (this.config.debug) {
        console.log('[ToolBus] Could not assemble runtime-trace middleware:', error.message)
      }
    }
  }

  /**
   * 装配LSP门禁中间件
   */
  private assembleLSPGateMiddleware(): void {
    try {
      // 使用动态导入避免编译时依赖
      const modulePath = '../middlewares/lsp-gate'
      const lspGateModule = require(modulePath)

      if (lspGateModule && lspGateModule.createLSPGateMiddlewareObject) {
        const lspGateMiddleware = lspGateModule.createLSPGateMiddlewareObject({
          enabled: true,
          highRiskTools: ['Write', 'Edit', 'Bash', 'Git'],
          lspTimeoutMs: 5000,
          degradeOnLSPUnavailable: true,
          debug: this.config.debug,
        })
        this.use(lspGateMiddleware)

        if (this.config.debug) {
          console.log('[ToolBus] Default middleware assembled: lsp-gate')
        }
      }
    } catch (error: any) {
      // 中间件模块可能不存在，静默失败
      if (this.config.debug) {
        console.log('[ToolBus] Could not assemble lsp-gate middleware:', error.message)
      }
    }
  }

  /**
   * 装配Sanitize中间件
   */
  private assembleSanitizeMiddleware(): void {
    try {
      // 使用动态导入避免编译时依赖
      const modulePath = '../middlewares/sanitize'
      const sanitizeModule = require(modulePath)

      if (sanitizeModule && sanitizeModule.createSanitizeMiddlewareObject) {
        const sanitizeMiddleware = sanitizeModule.createSanitizeMiddlewareObject({
          enableAnsiSanitize: true,
          maxSanitizedLength: 15000,
        })
        this.use(sanitizeMiddleware)

        if (this.config.debug) {
          console.log('[ToolBus] Default middleware assembled: sanitize')
        }
      }
    } catch (error: any) {
      // 中间件模块可能不存在，静默失败
      if (this.config.debug) {
        console.log('[ToolBus] Could not assemble sanitize middleware:', error.message)
      }
    }
  }

  /**
   * 注册中间件
   */
  use(middleware: Middleware | MiddlewareFunction): this {
    let middlewareObj: Middleware

    if (typeof middleware === 'function') {
      // 如果是函数，转换为Middleware对象
      const functionName = middleware.name || 'anonymous-middleware'
      middlewareObj = {
        name: functionName,
        priority: this.config.defaultPriority,
        execute: middleware,
        enabled: true,
      }
    } else {
      middlewareObj = middleware
    }

    // 检查是否已存在同名中间件
    if (this.middlewares.has(middlewareObj.name)) {
      if (this.config.debug) {
        console.warn(`[ToolBus] Middleware "${middlewareObj.name}" already registered, replacing`)
      }
    }

    // 检查中间件数量限制
    if (this.middlewares.size >= this.config.maxMiddlewares) {
      throw new Error(`Maximum number of middlewares (${this.config.maxMiddlewares}) exceeded`)
    }

    this.middlewares.set(middlewareObj.name, middlewareObj)

    if (this.config.debug) {
      console.log(`[ToolBus] Registered middleware: ${middlewareObj.name} (priority: ${middlewareObj.priority})`)
    }

    return this
  }

  /**
   * 移除中间件
   */
  removeMiddleware(name: string): boolean {
    const existed = this.middlewares.delete(name)
    
    if (existed && this.config.debug) {
      console.log(`[ToolBus] Removed middleware: ${name}`)
    }

    return existed
  }

  /**
   * 启用/禁用中间件
   */
  setMiddlewareEnabled(name: string, enabled: boolean): boolean {
    const middleware = this.middlewares.get(name)
    if (!middleware) return false

    middleware.enabled = enabled !== false

    if (this.config.debug) {
      console.log(`[ToolBus] Middleware ${name} ${enabled ? 'enabled' : 'disabled'}`)
    }

    return true
  }

  /**
   * 注册事件处理器
   */
  on(event: string, handler: (context: ToolBusContext) => Promise<void> | void, options?: { once?: boolean }): string {
    const handlerId = `handler-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const eventHandler: EventHandler = {
      id: handlerId,
      event,
      handler,
      once: options?.once,
    }

    const handlers = this.eventHandlers.get(event) || []
    handlers.push(eventHandler)
    this.eventHandlers.set(event, handlers)

    if (this.config.debug) {
      console.log(`[ToolBus] Registered event handler for "${event}": ${handlerId}`)
    }

    return handlerId
  }

  /**
   * 注册一次性事件处理器
   */
  once(event: string, handler: (context: ToolBusContext) => Promise<void> | void): string {
    return this.on(event, handler, { once: true })
  }

  /**
   * 移除事件处理器
   */
  off(event: string, handlerId: string): boolean {
    const handlers = this.eventHandlers.get(event)
    if (!handlers) return false

    const initialLength = handlers.length
    const filteredHandlers = handlers.filter(h => h.id !== handlerId)
    
    if (filteredHandlers.length === initialLength) {
      return false // 没有找到要移除的处理器
    }

    if (filteredHandlers.length === 0) {
      this.eventHandlers.delete(event)
    } else {
      this.eventHandlers.set(event, filteredHandlers)
    }

    if (this.config.debug) {
      console.log(`[ToolBus] Removed event handler: ${handlerId} from "${event}"`)
    }

    return true
  }

  /**
   * 触发事件执行
   */
  async emit(event: string, data: any, metadata?: Partial<ToolBusContext['metadata']>): Promise<EventExecutionResult> {
    const startTime = Date.now()
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    if (this.config.debug) {
      console.log(`[ToolBus] Emitting event: ${event} (${executionId})`, data)
    }

    // 创建执行上下文
    const context: ToolBusContext = {
      event,
      data,
      metadata: {
        timestamp: Date.now(),
        sessionId: metadata?.sessionId || 'default-session',
        cwd: metadata?.cwd || process.cwd(),
        source: metadata?.source || 'tool-bus',
        toolUseId: metadata?.toolUseId,
      },
      continue: true,
    }

    const middlewareResults: MiddlewareExecutionResult[] = []
    let finalError: Error | undefined

    try {
      // 执行中间件洋葱圈
      await this.executeMiddlewareChain(context, middlewareResults)

      // 执行事件处理器
      await this.executeEventHandlers(event, context)

      // 更新统计信息
      this.recordSuccessfulExecution(startTime)

    } catch (error: any) {
      finalError = error
      context.error = error
      context.continue = false

      // 更新统计信息
      this.recordFailedExecution(startTime)

      if (this.config.debug) {
        console.error(`[ToolBus] Event execution failed: ${event}`, error)
      }

      // 如果启用错误恢复，尝试恢复
      if (this.config.enableErrorRecovery) {
        await this.handleExecutionError(event, context, error)
      }
    }

    const totalDuration = Date.now() - startTime

    const result: EventExecutionResult = {
      event,
      success: !finalError,
      totalDuration,
      middlewareResults,
      finalContext: context,
      error: finalError,
    }

    if (this.config.debug) {
      console.log(`[ToolBus] Event completed: ${event} (${totalDuration}ms, success: ${!finalError})`)
    }

    return result
  }

  /**
   * 执行中间件洋葱圈
   */
  private async executeMiddlewareChain(
    context: ToolBusContext,
    results: MiddlewareExecutionResult[]
  ): Promise<void> {
    // 获取匹配的中间件并按优先级排序
    const matchedMiddlewares = this.getMatchedMiddlewares(context.event)
      .filter(m => m.enabled !== false)
      .sort((a, b) => a.priority - b.priority)

    if (matchedMiddlewares.length === 0) {
      if (this.config.debug) {
        console.log(`[ToolBus] No middlewares matched for event: ${context.event}`)
      }
      return
    }

    // 创建洋葱圈执行链
    const executeChain = async (index: number): Promise<void> => {
      if (index >= matchedMiddlewares.length || !context.continue) {
        return
      }

      const middleware = matchedMiddlewares[index]
      const middlewareStartTime = Date.now()
      let middlewareError: Error | undefined

      try {
        // 执行中间件
        await middleware.execute(context, () => executeChain(index + 1))

        // 记录中间件执行结果
        const duration = Date.now() - middlewareStartTime
        results.push({
          success: true,
          duration,
          middlewareName: middleware.name,
        })

        // 更新中间件统计
        this.updateMiddlewareStats(middleware.name, duration, false)

      } catch (error: any) {
        middlewareError = error
        const duration = Date.now() - middlewareStartTime
        
        results.push({
          success: false,
          duration,
          error,
          middlewareName: middleware.name,
        })

        // 更新中间件统计
        this.updateMiddlewareStats(middleware.name, duration, true)

        throw error // 向上传播错误
      }
    }

    // 开始执行洋葱圈
    await executeChain(0)
  }

  /**
   * 执行事件处理器
   */
  private async executeEventHandlers(event: string, context: ToolBusContext): Promise<void> {
    const handlers = this.eventHandlers.get(event)
    if (!handlers || handlers.length === 0) {
      return
    }

    const handlersToExecute = [...handlers]
    
    // 执行所有处理器
    for (const handler of handlersToExecute) {
      try {
        await handler.handler(context)
        
        // 如果是一次性处理器，执行后移除
        if (handler.once) {
          this.off(event, handler.id)
        }
      } catch (error: any) {
        console.error(`[ToolBus] Event handler error for "${event}":`, error)
        // 继续执行其他处理器
      }
    }
  }

  /**
   * 获取匹配的中间件
   */
  private getMatchedMiddlewares(event: string): Middleware[] {
    const matched: Middleware[] = []

    for (const middleware of this.middlewares.values()) {
      if (this.middlewareMatchesEvent(middleware, event)) {
        matched.push(middleware)
      }
    }

    return matched
  }

  /**
   * 检查中间件是否匹配事件
   */
  private middlewareMatchesEvent(middleware: Middleware, event: string): boolean {
    if (!middleware.match) {
      return true // 没有匹配规则，匹配所有事件
    }

    const patterns = Array.isArray(middleware.match) ? middleware.match : [middleware.match]

    return patterns.some(pattern => {
      if (pattern === '*') return true
      if (pattern === event) return true
      
      // 支持简单的通配符匹配
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*')
        const regex = new RegExp(`^${regexPattern}$`)
        return regex.test(event)
      }

      return false
    })
  }

  /**
   * 处理执行错误
   */
  private async handleExecutionError(event: string, context: ToolBusContext, error: Error): Promise<void> {
    if (this.config.debug) {
      console.log(`[ToolBus] Attempting error recovery for event: ${event}`)
    }

    // 触发错误恢复事件
    try {
      await this.emit('tool-bus:error', {
        originalEvent: event,
        context,
        error,
      }, {
        ...context.metadata,
        source: 'error-recovery',
      })
    } catch (recoveryError: any) {
      console.error('[ToolBus] Error recovery failed:', recoveryError)
    }
  }

  /**
   * 记录成功执行
   */
  private recordSuccessfulExecution(startTime: number): void {
    const duration = Date.now() - startTime
    
    this.stats.totalExecutions++
    this.stats.successCount++
    
    // 更新平均执行时间
    this.executionTimes.push(duration)
    if (this.executionTimes.length > this.maxExecutionHistory) {
      this.executionTimes.shift()
    }
    
    const totalTime = this.executionTimes.reduce((sum, time) => sum + time, 0)
    this.stats.averageExecutionTime = totalTime / this.executionTimes.length
  }

  /**
   * 记录失败执行
   */
  private recordFailedExecution(startTime: number): void {
    const duration = Date.now() - startTime
    
    this.stats.totalExecutions++
    this.stats.failureCount++
    
    // 更新平均执行时间（包括失败）
    this.executionTimes.push(duration)
    if (this.executionTimes.length > this.maxExecutionHistory) {
      this.executionTimes.shift()
    }
    
    const totalTime = this.executionTimes.reduce((sum, time) => sum + time, 0)
    this.stats.averageExecutionTime = totalTime / this.executionTimes.length
  }

  /**
   * 更新中间件统计
   */
  private updateMiddlewareStats(middlewareName: string, duration: number, isError: boolean): void {
    if (!this.config.enablePerformanceMonitoring) {
      return
    }

    const stats = this.stats.middlewareStats[middlewareName] || {
      executions: 0,
      averageTime: 0,
      errors: 0,
    }

    stats.executions++
    
    // 更新平均时间
    stats.averageTime = (stats.averageTime * (stats.executions - 1) + duration) / stats.executions
    
    if (isError) {
      stats.errors++
    }

    this.stats.middlewareStats[middlewareName] = stats
  }

  /**
   * 注册插件
   */
  async registerPlugin(plugin: ToolBusPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" already registered`)
    }

    this.plugins.set(plugin.name, plugin)

    // 注册插件中间件
    if (plugin.middlewares) {
      for (const middleware of plugin.middlewares) {
        this.use(middleware)
      }
    }

    // 初始化插件
    if (plugin.initialize) {
      try {
        await plugin.initialize(this)
        if (this.config.debug) {
          console.log(`[ToolBus] Plugin initialized: ${plugin.name}`)
        }
      } catch (error: any) {
        console.error(`[ToolBus] Failed to initialize plugin "${plugin.name}":`, error)
        this.plugins.delete(plugin.name)
        throw error
      }
    }
  }

  /**
   * 卸载插件
   */
  async unregisterPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return false

    // 调用销毁函数
    if (plugin.destroy) {
      try {
        await plugin.destroy()
      } catch (error: any) {
        console.error(`[ToolBus] Error destroying plugin "${pluginName}":`, error)
      }
    }

    // 移除插件中间件
    if (plugin.middlewares) {
      for (const middleware of plugin.middlewares) {
        this.removeMiddleware(middleware.name)
      }
    }

    this.plugins.delete(pluginName)

    if (this.config.debug) {
      console.log(`[ToolBus] Plugin unregistered: ${pluginName}`)
    }

    return true
  }

  /**
   * 检查是否有中间件匹配指定事件
   */
  hasMiddlewaresFor(event: string): boolean {
    for (const middleware of this.middlewares.values()) {
      if (middleware.enabled !== false && this.middlewareMatchesEvent(middleware, event)) {
        return true
      }
    }
    return false
  }

  /**
   * 获取所有注册的中间件
   */
  getMiddlewares(): Middleware[] {
    return Array.from(this.middlewares.values())
  }

  /**
   * 获取所有注册的事件处理器
   */
  getEventHandlers(): Record<string, EventHandler[]> {
    const result: Record<string, EventHandler[]> = {}
    
    for (const [event, handlers] of this.eventHandlers.entries()) {
      result[event] = [...handlers]
    }
    
    return result
  }

  /**
   * 获取所有注册的插件
   */
  getPlugins(): ToolBusPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取执行统计信息
   */
  getStats(): ExecutionStats {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      middlewareStats: {},
    }
    this.executionTimes = []
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ToolBusConfig> {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ToolBusConfig>): void {
    Object.assign(this.config, config)
    
    if (this.config.debug) {
      console.log('[ToolBus] Config updated:', config)
    }
  }

  /**
   * 销毁Tool Bus实例
   */
  async destroy(): Promise<void> {
    if (this.config.debug) {
      console.log('[ToolBus] Destroying instance...')
    }

    // 卸载所有插件
    const pluginNames = Array.from(this.plugins.keys())
    for (const pluginName of pluginNames) {
      await this.unregisterPlugin(pluginName)
    }

    // 清空所有中间件和处理器
    this.middlewares.clear()
    this.eventHandlers.clear()
    this.plugins.clear()

    if (this.config.debug) {
      console.log('[ToolBus] Instance destroyed')
    }
  }
}

/**
 * 创建Tool Bus实例的工厂函数
 */
export function createToolBus(config?: ToolBusConfig): ToolBus {
  return new ToolBus(config)
}

/**
 * 默认的Tool Bus实例（单例模式）
 */
let defaultToolBus: ToolBus | null = null

export function getDefaultToolBus(config?: ToolBusConfig): ToolBus {
  if (!defaultToolBus) {
    defaultToolBus = createToolBus(config)
  }
  return defaultToolBus
}

export function destroyDefaultToolBus(): void {
  if (defaultToolBus) {
    defaultToolBus.destroy()
    defaultToolBus = null
  }
}
