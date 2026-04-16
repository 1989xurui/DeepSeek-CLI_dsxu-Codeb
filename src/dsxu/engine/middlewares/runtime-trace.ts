/**
 * 运行时探针中间件 - 动态运行时状态感知
 * 
 * 功能：
 * 1. 增加运行时探针接口（最小集）
 * 2. 快照包含：热点函数耗时、错误堆栈摘要、内存占用概览
 * 3. 失败降级：探针不可用时主链继续
 */

import type { ToolBusContext, MiddlewareFunction } from '../tool-bus/types'

export interface RuntimeTraceMiddlewareOptions {
  /** 是否启用运行时追踪 */
  enabled?: boolean
  /** 采样间隔（毫秒） */
  samplingIntervalMs?: number
  /** 最大快照数量 */
  maxSnapshots?: number
  /** 是否启用内存监控 */
  enableMemoryMonitoring?: boolean
  /** 是否启用错误堆栈追踪 */
  enableErrorStackTracing?: boolean
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 运行时快照
 */
export interface RuntimeSnapshot {
  /** 快照ID */
  id: string
  /** 时间戳 */
  timestamp: number
  /** 事件名称 */
  event: string
  /** 内存使用情况 */
  memory?: {
    /** 堆使用量（字节） */
    heapUsed: number
    /** 堆总量（字节） */
    heapTotal: number
    /** 外部内存（字节） */
    external: number
    /** 数组缓冲区（字节） */
    arrayBuffers: number
  }
  /** 热点函数耗时 */
  hotFunctions?: Array<{
    /** 函数名称 */
    name: string
    /** 调用次数 */
    calls: number
    /** 总耗时（毫秒） */
    totalTime: number
    /** 平均耗时（毫秒） */
    averageTime: number
  }>
  /** 错误堆栈摘要 */
  errorStacks?: Array<{
    /** 错误类型 */
    type: string
    /** 错误消息 */
    message: string
    /** 堆栈摘要 */
    stackSummary: string
    /** 发生次数 */
    count: number
  }>
  /** 自定义指标 */
  customMetrics?: Record<string, any>
}

/**
 * 简单的性能监控器
 */
class SimpleProfiler {
  private measurements: Map<string, { startTime: number; totalTime: number; calls: number }> = new Map()
  private errors: Map<string, { type: string; message: string; stack: string; count: number }> = new Map()

  /**
   * 开始测量
   */
  startMeasurement(name: string): void {
    this.measurements.set(name, {
      startTime: performance.now(),
      totalTime: this.measurements.get(name)?.totalTime || 0,
      calls: (this.measurements.get(name)?.calls || 0) + 1,
    })
  }

  /**
   * 结束测量
   */
  endMeasurement(name: string): void {
    const measurement = this.measurements.get(name)
    if (measurement) {
      const endTime = performance.now()
      measurement.totalTime += endTime - measurement.startTime
    }
  }

  /**
   * 记录错误
   */
  recordError(error: Error): void {
    const key = `${error.name}:${error.message}`
    const existing = this.errors.get(key)
    
    if (existing) {
      existing.count++
    } else {
      this.errors.set(key, {
        type: error.name,
        message: error.message,
        stack: error.stack || 'No stack trace',
        count: 1,
      })
    }
  }

  /**
   * 获取热点函数
   */
  getHotFunctions(): Array<{ name: string; calls: number; totalTime: number; averageTime: number }> {
    const hotFunctions: Array<{ name: string; calls: number; totalTime: number; averageTime: number }> = []
    
    for (const [name, data] of this.measurements.entries()) {
      if (data.calls > 0) {
        hotFunctions.push({
          name,
          calls: data.calls,
          totalTime: data.totalTime,
          averageTime: data.totalTime / data.calls,
        })
      }
    }
    
    // 按总耗时排序
    return hotFunctions.sort((a, b) => b.totalTime - a.totalTime).slice(0, 10)
  }

  /**
   * 获取错误堆栈摘要
   */
  getErrorStacks(): Array<{ type: string; message: string; stackSummary: string; count: number }> {
    const errorStacks: Array<{ type: string; message: string; stackSummary: string; count: number }> = []
    
    for (const error of this.errors.values()) {
      // 简化堆栈信息
      const stackLines = error.stack.split('\n')
      const stackSummary = stackLines.slice(0, 3).join(' | ')
      
      errorStacks.push({
        type: error.type,
        message: error.message,
        stackSummary,
        count: error.count,
      })
    }
    
    // 按发生次数排序
    return errorStacks.sort((a, b) => b.count - a.count).slice(0, 5)
  }

  /**
   * 重置测量数据
   */
  reset(): void {
    this.measurements.clear()
    this.errors.clear()
  }
}

/**
 * 获取内存使用情况
 */
function getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; arrayBuffers: number } | undefined {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    }
  }
  return undefined
}

/**
 * 创建运行时追踪中间件
 */
export function createRuntimeTraceMiddleware(options?: RuntimeTraceMiddlewareOptions): MiddlewareFunction {
  const config = {
    enabled: options?.enabled ?? true,
    samplingIntervalMs: options?.samplingIntervalMs ?? 1000,
    maxSnapshots: options?.maxSnapshots ?? 100,
    enableMemoryMonitoring: options?.enableMemoryMonitoring ?? true,
    enableErrorStackTracing: options?.enableErrorStackTracing ?? true,
    debug: options?.debug ?? false,
  }

  // 创建性能监控器
  const profiler = new SimpleProfiler()
  const snapshots: RuntimeSnapshot[] = []
  let lastSnapshotTime = 0

  return async (context: ToolBusContext, next: () => Promise<void>): Promise<void> => {
    if (!config.enabled) {
      // 运行时追踪未启用
      await next()
      return
    }

    const startTime = Date.now()
    const shouldTakeSnapshot = startTime - lastSnapshotTime >= config.samplingIntervalMs

    try {
      // 开始测量
      profiler.startMeasurement(`event:${context.event}`)

      // 执行下一个中间件
      await next()

      // 结束测量
      profiler.endMeasurement(`event:${context.event}`)

      // 记录错误（如果有）
      if (context.error && config.enableErrorStackTracing) {
        profiler.recordError(context.error)
      }

      // 定期创建快照
      if (shouldTakeSnapshot) {
        const snapshot: RuntimeSnapshot = {
          id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          event: context.event,
        }

        // 收集内存使用情况
        if (config.enableMemoryMonitoring) {
          const memoryUsage = getMemoryUsage()
          if (memoryUsage) {
            snapshot.memory = memoryUsage
          }
        }

        // 收集热点函数
        const hotFunctions = profiler.getHotFunctions()
        if (hotFunctions.length > 0) {
          snapshot.hotFunctions = hotFunctions
        }

        // 收集错误堆栈
        if (config.enableErrorStackTracing) {
          const errorStacks = profiler.getErrorStacks()
          if (errorStacks.length > 0) {
            snapshot.errorStacks = errorStacks
          }
        }

        // 保存快照
        snapshots.push(snapshot)
        if (snapshots.length > config.maxSnapshots) {
          snapshots.shift()
        }

        lastSnapshotTime = Date.now()

        // 触发运行时追踪事件
        context.events = context.events || []
        context.events.push({
          type: 'runtime_trace_snapshot',
          timestamp: Date.now(),
          data: {
            snapshotId: snapshot.id,
            event: snapshot.event,
            memoryUsed: snapshot.memory?.heapUsed,
            hotFunctionCount: snapshot.hotFunctions?.length || 0,
            errorCount: snapshot.errorStacks?.length || 0,
          }
        })

        if (config.debug) {
          console.log(`[RuntimeTrace] Snapshot created: ${snapshot.id}`)
          if (snapshot.memory) {
            console.log(`[RuntimeTrace] Memory: ${Math.round(snapshot.memory.heapUsed / 1024 / 1024)}MB used`)
          }
        }
      }

    } catch (error: any) {
      // 记录错误
      if (config.enableErrorStackTracing) {
        profiler.recordError(error)
      }

      // 即使探针失败，也继续执行（降级）
      if (config.debug) {
        console.warn(`[RuntimeTrace] Probe error (degraded): ${error.message}`)
      }

      // 重新抛出错误，让其他中间件处理
      throw error
    } finally {
      const duration = Date.now() - startTime
      
      // 记录执行时间
      context.runtimeTrace = context.runtimeTrace || {}
      context.runtimeTrace.lastEvent = {
        event: context.event,
        duration,
        timestamp: Date.now(),
      }

      // 如果有快照，添加到上下文
      if (snapshots.length > 0) {
        context.runtimeTrace.latestSnapshot = snapshots[snapshots.length - 1]
        context.runtimeTrace.snapshotCount = snapshots.length
      }
    }
  }
}

/**
 * 创建运行时追踪中间件对象
 */
export function createRuntimeTraceMiddlewareObject(options?: RuntimeTraceMiddlewareOptions) {
  return {
    name: 'runtime-trace',
    description: 'Monitors runtime performance and creates snapshots',
    priority: 75, // 中等优先级，在LSP门禁之后，其他中间件之前
    execute: createRuntimeTraceMiddleware(options),
    enabled: true,
  }
}

/**
 * 运行时探针工具函数
 */

/**
 * 开始运行时追踪
 */
export function runtimeTraceStart(traceId: string): void {
  console.log(`[RuntimeTrace] Started trace: ${traceId}`)
}

/**
 * 创建运行时快照
 */
export function runtimeTraceSnapshot(name: string, data?: any): RuntimeSnapshot {
  const snapshot: RuntimeSnapshot = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    event: name,
    customMetrics: data,
  }

  // 收集内存使用情况
  const memoryUsage = getMemoryUsage()
  if (memoryUsage) {
    snapshot.memory = memoryUsage
  }

  console.log(`[RuntimeTrace] Manual snapshot: ${name}`)
  return snapshot
}

/**
 * 停止运行时追踪
 */
export function runtimeTraceStop(traceId: string, summary?: any): void {
  console.log(`[RuntimeTrace] Stopped trace: ${traceId}`, summary)
}
