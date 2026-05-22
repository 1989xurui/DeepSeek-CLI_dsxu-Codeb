/**
 * Legacy zero-import middleware retained only because Windows ACL blocked
 * physical removal after copying to _deleted_files.
 *
 * Metrics + Error Boundary 中间件
 * 
 * 功能：
 * 1. 捕获工具执行错误，防止崩溃传播到主链
 * 2. 记录执行耗时和状态
 * 3. 支持降级模式和抛出模式
 */

import type { ToolBusContext, MiddlewareFunction } from '../tool-bus/types'

export interface MetricsErrorMiddlewareOptions {
  /** 错误处理模式：degrade（降级）或 throw（抛出） */
  errorMode?: 'degrade' | 'throw'
  /** 降级时的默认返回值 */
  degradeValue?: any
  /** 是否记录性能指标 */
  enableMetrics?: boolean
  /** 慢执行阈值（毫秒） */
  slowThresholdMs?: number
}

/**
 * 创建Metrics + Error Boundary中间件
 */
export function createMetricsErrorMiddleware(options?: MetricsErrorMiddlewareOptions): MiddlewareFunction {
  const config = {
    errorMode: options?.errorMode ?? 'degrade',
    degradeValue: options?.degradeValue ?? '[Tool execution failed - degraded]',
    enableMetrics: options?.enableMetrics ?? true,
    slowThresholdMs: options?.slowThresholdMs ?? 5000,
  }

  return async (context: ToolBusContext, next: () => Promise<void>): Promise<void> => {
    const startTime = Date.now()
    let success = true
    let error: Error | undefined

    try {
      await next()
    } catch (err: any) {
      success = false
      error = err

      // 根据配置处理错误
      if (config.errorMode === 'degrade') {
        // 降级模式：设置降级结果，继续执行
        context.result = config.degradeValue
        context.error = error
        context.continue = true
        
        // 记录降级日志
        if (context.metadata.source !== 'test') {
          console.warn(`[MetricsError] Tool execution degraded for event "${context.event}":`, error.message)
        }
      } else {
        // 抛出模式：重新抛出错误
        throw error
      }
    } finally {
      // 记录性能指标
      if (config.enableMetrics) {
        const duration = Date.now() - startTime
        
        // 初始化指标对象
        context.metrics = context.metrics || {}
        context.metrics.execution = {
          duration,
          success,
          timestamp: Date.now(),
          event: context.event,
          ...(error && { error: error.message }),
        }

        // 检测慢执行
        if (duration > config.slowThresholdMs && context.metadata.source !== 'test') {
          console.warn(`[MetricsError] Slow execution detected: "${context.event}" took ${duration}ms`)
        }

        // 记录到上下文供其他中间件使用
        context.executionMetrics = {
          ...context.executionMetrics,
          duration,
          success,
          error: error?.message,
        }
      }
    }
  }
}

/**
 * 创建完整的MetricsError中间件对象
 */
export function createMetricsErrorMiddlewareObject(options?: MetricsErrorMiddlewareOptions) {
  return {
    name: 'metrics-error',
    description: 'Captures tool execution errors and records performance metrics',
    priority: 100, // 高优先级，最先执行
    execute: createMetricsErrorMiddleware(options),
    enabled: true,
  }
}
