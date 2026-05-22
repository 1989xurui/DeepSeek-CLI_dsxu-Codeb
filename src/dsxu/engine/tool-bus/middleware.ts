/**
 * Legacy tool-bus experiment file retained only because Windows ACL
 * blocked physical removal after copying to _deleted_files.
 *
 * Tool Bus 中间件工具和常用中间件
 */

import type {
  Middleware,
  MiddlewareFunction,
  ToolBusContext,
  MiddlewareFactory,
} from './types'

/**
 * 创建中间件的工具函数
 */
export function createMiddleware(
  name: string,
  execute: MiddlewareFunction,
  options?: {
    priority?: number
    match?: string | string[]
    description?: string
    readOnly?: boolean
  }
): Middleware {
  return {
    name,
    description: options?.description,
    priority: options?.priority ?? 100,
    match: options?.match,
    execute,
    enabled: true,
    readOnly: options?.readOnly,
  }
}

/**
 * 日志中间件 - 记录所有事件和中间件执行
 */
export function createLoggingMiddleware(options?: {
  level?: 'debug' | 'info' | 'warn' | 'error'
  logData?: boolean
  logMetadata?: boolean
}): Middleware {
  const level = options?.level || 'info'
  const logData = options?.logData !== false
  const logMetadata = options?.logMetadata !== false

  return createMiddleware(
    'logging',
    async (context, next) => {
      const startTime = Date.now()
      
      const logMessage = (msg: string, data?: any) => {
        const prefix = `[ToolBus:${context.event}]`
        switch (level) {
          case 'debug': console.debug(prefix, msg, data); break
          case 'info': console.info(prefix, msg, data); break
          case 'warn': console.warn(prefix, msg, data); break
          case 'error': console.error(prefix, msg, data); break
        }
      }

      logMessage('Middleware execution started', {
        timestamp: context.metadata.timestamp,
        ...(logMetadata && { metadata: context.metadata }),
        ...(logData && { data: context.data }),
      })

      try {
        await next()
        const duration = Date.now() - startTime
        
        logMessage('Middleware execution completed', {
          duration: `${duration}ms`,
          success: !context.error,
          ...(context.error && { error: context.error.message }),
        })
      } catch (error: any) {
        const duration = Date.now() - startTime
        
        logMessage('Middleware execution failed', {
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack,
        })
        
        throw error
      }
    },
    {
      priority: 1000, // 高优先级，最先执行
      description: 'Logs all event executions and middleware processing',
      readOnly: true,
    }
  )
}

/**
 * 性能监控中间件 - 监控执行性能
 */
export function createPerformanceMiddleware(options?: {
  thresholdMs?: number
  enableMetrics?: boolean
}): Middleware {
  const thresholdMs = options?.thresholdMs || 1000
  const enableMetrics = options?.enableMetrics !== false

  return createMiddleware(
    'performance',
    async (context, next) => {
      const startTime = Date.now()
      
      try {
        await next()
      } finally {
        const duration = Date.now() - startTime
        
        if (duration > thresholdMs) {
          console.warn(`[ToolBus:Performance] Slow execution detected: ${context.event} took ${duration}ms`)
        }
        
        if (enableMetrics) {
          // 可以在这里收集性能指标
          context.metrics = context.metrics || {}
          context.metrics.performance = {
            duration,
            timestamp: Date.now(),
            event: context.event,
          }
        }
      }
    },
    {
      priority: 900,
      description: 'Monitors execution performance and detects slow operations',
      readOnly: true,
    }
  )
}

/**
 * 错误处理中间件 - 统一错误处理
 */
export function createErrorHandlingMiddleware(options?: {
  logErrors?: boolean
  transformErrors?: boolean
}): Middleware {
  const logErrors = options?.logErrors !== false
  const transformErrors = options?.transformErrors !== false

  return createMiddleware(
    'error-handling',
    async (context, next) => {
      try {
        await next()
      } catch (error: any) {
        if (logErrors) {
          console.error(`[ToolBus:Error] Event "${context.event}" failed:`, error)
        }
        
        if (transformErrors) {
          // 标准化错误格式
          const standardizedError = {
            message: error.message || 'Unknown error',
            code: error.code || 'INTERNAL_ERROR',
            stack: error.stack,
            timestamp: Date.now(),
            event: context.event,
          }
          
          context.error = new Error(JSON.stringify(standardizedError))
          context.data = {
            ...context.data,
            error: standardizedError,
          }
        } else {
          context.error = error
        }
        
        // 设置继续执行标志为false
        context.continue = false
        
        throw error
      }
    },
    {
      priority: 50,
      description: 'Provides unified error handling and error transformation',
    }
  )
}

/**
 * 验证中间件 - 验证上下文数据
 */
export function createValidationMiddleware(validator: (data: any) => boolean | Promise<boolean>): Middleware {
  return createMiddleware(
    'validation',
    async (context, next) => {
      const isValid = await validator(context.data)
      
      if (!isValid) {
        throw new Error(`Validation failed for event "${context.event}"`)
      }
      
      await next()
    },
    {
      priority: 700,
      description: 'Validates event data before processing',
    }
  )
}

/**
 * 转换中间件 - 转换上下文数据
 */
export function createTransformationMiddleware(
  transformer: (data: any, context: ToolBusContext) => any | Promise<any>
): Middleware {
  return createMiddleware(
    'transformation',
    async (context, next) => {
      context.data = await transformer(context.data, context)
      await next()
    },
    {
      priority: 600,
      description: 'Transforms event data during processing',
    }
  )
}

/**
 * 缓存中间件 - 缓存执行结果
 */
export function createCachingMiddleware(options?: {
  ttlMs?: number
  maxSize?: number
  cacheKey?: (context: ToolBusContext) => string
}): Middleware {
  const ttlMs = options?.ttlMs || 60000 // DSXU comment sanitized.
  const maxSize = options?.maxSize || 100
  const cacheKeyFn = options?.cacheKey || ((context) => 
    `${context.event}:${JSON.stringify(context.data)}`
  )

  const cache = new Map<string, { value: any; timestamp: number }>()

  return createMiddleware(
    'caching',
    async (context, next) => {
      const key = cacheKeyFn(context)
      const cached = cache.get(key)
      
      // 检查缓存是否有效
      if (cached && Date.now() - cached.timestamp < ttlMs) {
        context.result = cached.value
        context.cached = true
        return // 跳过后续中间件执行
      }
      
      // 执行并缓存结果
      await next()
      
      if (context.result !== undefined) {
        // 清理过期缓存
        if (cache.size >= maxSize) {
          const oldestKey = Array.from(cache.keys())[0]
          cache.delete(oldestKey)
        }
        
        cache.set(key, {
          value: context.result,
          timestamp: Date.now(),
        })
        
        context.cached = false
      }
    },
    {
      priority: 50,
      description: 'Caches execution results to improve performance',
    }
  )
}

/**
 * 限流中间件 - 限制执行频率
 */
export function createRateLimitingMiddleware(options?: {
  maxRequests?: number
  windowMs?: number
  key?: (context: ToolBusContext) => string
}): Middleware {
  const maxRequests = options?.maxRequests || 100
  const windowMs = options?.windowMs || 60000 // DSXU comment sanitized.
  const keyFn = options?.key || ((context) => context.event)

  const requests = new Map<string, number[]>()
  
  // 清理过期请求
  const cleanup = (key: string) => {
    const now = Date.now()
    const timestamps = requests.get(key) || []
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs)
    
    if (validTimestamps.length === 0) {
      requests.delete(key)
    } else {
      requests.set(key, validTimestamps)
    }
    
    return validTimestamps
  }

  return createMiddleware(
    'rate-limiting',
    async (context, next) => {
      const key = keyFn(context)
      const now = Date.now()
      
      // 清理并获取当前请求数
      const timestamps = cleanup(key)
      
      if (timestamps.length >= maxRequests) {
        throw new Error(`Rate limit exceeded for "${key}". Maximum ${maxRequests} requests per ${windowMs}ms`)
      }
      
      // 记录本次请求
      timestamps.push(now)
      requests.set(key, timestamps)
      
      await next()
    },
    {
      priority: 400,
      description: 'Limits the rate of event executions',
    }
  )
}

/**
 * 重试中间件 - 失败时自动重试
 */
export function createRetryMiddleware(options?: {
  maxAttempts?: number
  delayMs?: number
  backoffFactor?: number
  retryCondition?: (error: Error, attempt: number) => boolean
}): Middleware {
  const maxAttempts = options?.maxAttempts || 3
  const initialDelayMs = options?.delayMs || 1000
  const backoffFactor = options?.backoffFactor || 2
  const retryCondition = options?.retryCondition || (() => true)

  return createMiddleware(
    'retry',
    async (context, next) => {
      let lastError: Error
      let attempt = 0
      
      while (attempt < maxAttempts) {
        attempt++
        context.retry = context.retry || {}
        context.retry.attempt = attempt
        
        try {
          await next()
          return // 成功，退出循环
        } catch (error: any) {
          lastError = error
          
          // 检查是否应该重试
          if (!retryCondition(error, attempt) || attempt >= maxAttempts) {
            throw error
          }
          
          // 计算延迟时间（指数退避）
          const delayMs = initialDelayMs * Math.pow(backoffFactor, attempt - 1)
          
          // 记录重试信息
          context.retry.delayMs = delayMs
          context.retry.lastError = error.message
          
          if (context.metadata.source !== 'test') {
            console.log(`[ToolBus:Retry] Retrying "${context.event}" (attempt ${attempt}/${maxAttempts}) after ${delayMs}ms`)
          }
          
          // 等待延迟时间
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
      
      throw lastError!
    },
    {
      priority: 50,
      description: 'Automatically retries failed operations with exponential backoff',
    }
  )
}

/**
 * 超时中间件 - 设置执行超时
 */
export function createTimeoutMiddleware(timeoutMs: number): Middleware {
  return createMiddleware(
    'timeout',
    async (context, next) => {
      let timeoutId: NodeJS.Timeout
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Execution timeout after ${timeoutMs}ms for event "${context.event}"`))
        }, timeoutMs)
      })
      
      try {
        await Promise.race([next(), timeoutPromise])
      } finally {
        clearTimeout(timeoutId!)
      }
    },
    {
      priority: 50,
      description: `Sets a ${timeoutMs}ms timeout for event execution`,
    }
  )
}

/**
 * 组合多个中间件
 */
export function composeMiddlewares(...middlewares: MiddlewareFunction[]): MiddlewareFunction {
  return async (context: ToolBusContext, next: () => Promise<void>) => {
    // 创建执行链
    const chain = middlewares.reduceRight(
      (nextMiddleware, currentMiddleware) => {
        return () => currentMiddleware(context, nextMiddleware)
      },
      next
    )
    
    await chain()
  }
}

/**
 * 创建组合中间件
 */
export function createComposedMiddleware(
  name: string,
  ...middlewares: MiddlewareFunction[]
): Middleware {
  const composed = composeMiddlewares(...middlewares)
  
  return createMiddleware(
    name,
    composed,
    {
      description: `Composed middleware combining ${middlewares.length} functions`,
    }
  )
}

/**
 * 条件中间件 - 根据条件决定是否执行
 */
export function createConditionalMiddleware(
  condition: (context: ToolBusContext) => boolean | Promise<boolean>,
  trueMiddleware: MiddlewareFunction,
  falseMiddleware?: MiddlewareFunction
): MiddlewareFunction {
  return async (context: ToolBusContext, next: () => Promise<void>) => {
    const shouldExecute = await condition(context)
    
    if (shouldExecute) {
      await trueMiddleware(context, next)
    } else if (falseMiddleware) {
      await falseMiddleware(context, next)
    } else {
      await next()
    }
  }
}

/**
 * 测量中间件执行时间的工具函数
 */
export function withTiming(
  middleware: MiddlewareFunction,
  onComplete?: (name: string, duration: number, context: ToolBusContext) => void
): MiddlewareFunction {
  return async (context: ToolBusContext, next: () => Promise<void>) => {
    const startTime = Date.now()
    
    try {
      await middleware(context, next)
    } finally {
      const duration = Date.now() - startTime
      onComplete?.(middleware.name || 'anonymous', duration, context)
    }
  }
}
