/**
 * Tool Bus 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToolBus, createToolBus } from '../index'
import {
  createLoggingMiddleware,
  createErrorHandlingMiddleware,
  createCachingMiddleware,
  createRetryMiddleware,
  createTimeoutMiddleware,
  createMiddleware,
} from '../middleware'

describe('Tool Bus', () => {
  let toolBus: ToolBus

  beforeEach(() => {
    toolBus = createToolBus({ debug: false })
  })

  afterEach(async () => {
    await toolBus.destroy()
  })

  describe('基础功能', () => {
    it('应该创建Tool Bus实例', () => {
      expect(toolBus).toBeInstanceOf(ToolBus)
    })

    it('应该注册和移除中间件', () => {
      const middleware = createMiddleware('test-middleware', async (context, next) => {
        await next()
      })

      // 注册中间件
      toolBus.use(middleware)
      expect(toolBus.getMiddlewares()).toHaveLength(1)
      expect(toolBus.getMiddlewares()[0].name).toBe('test-middleware')

      // 移除中间件
      const removed = toolBus.removeMiddleware('test-middleware')
      expect(removed).toBe(true)
      expect(toolBus.getMiddlewares()).toHaveLength(0)
    })

    it('应该启用和禁用中间件', () => {
      const middleware = createMiddleware('test-middleware', async (context, next) => {
        await next()
      })

      toolBus.use(middleware)

      // 禁用中间件
      const disabled = toolBus.setMiddlewareEnabled('test-middleware', false)
      expect(disabled).toBe(true)
      expect(toolBus.getMiddlewares()[0].enabled).toBe(false)

      // 启用中间件
      const enabled = toolBus.setMiddlewareEnabled('test-middleware', true)
      expect(enabled).toBe(true)
      expect(toolBus.getMiddlewares()[0].enabled).toBe(true)
    })
  })

  describe('事件处理', () => {
    it('应该注册和触发事件处理器', async () => {
      const eventData = { message: 'test event' }
      let handlerCalled = false
      let receivedData: any = null

      // 注册事件处理器
      const handlerId = toolBus.on('test-event', (context) => {
        handlerCalled = true
        receivedData = context.data
      })

      // 触发事件
      const result = await toolBus.emit('test-event', eventData)

      expect(handlerCalled).toBe(true)
      expect(receivedData).toEqual(eventData)
      expect(result.success).toBe(true)
      expect(result.event).toBe('test-event')

      // 移除事件处理器
      const removed = toolBus.off('test-event', handlerId)
      expect(removed).toBe(true)
    })

    it('应该注册一次性事件处理器', async () => {
      let callCount = 0

      // 注册一次性事件处理器
      toolBus.once('test-event', () => {
        callCount++
      })

      // 第一次触发
      await toolBus.emit('test-event', {})
      expect(callCount).toBe(1)

      // 第二次触发（应该不再调用）
      await toolBus.emit('test-event', {})
      expect(callCount).toBe(1) // 仍然是1
    })

    it('应该处理多个事件处理器', async () => {
      const callOrder: string[] = []

      // 注册多个事件处理器
      toolBus.on('test-event', () => {
        callOrder.push('handler1')
      })

      toolBus.on('test-event', () => {
        callOrder.push('handler2')
      })

      // 触发事件
      await toolBus.emit('test-event', {})

      expect(callOrder).toEqual(['handler1', 'handler2'])
    })
  })

  describe('中间件执行', () => {
    it('应该按优先级执行中间件', async () => {
      const executionOrder: string[] = []

      // 注册不同优先级的中间件
      toolBus.use(createMiddleware('low-priority', async (context, next) => {
        executionOrder.push('low-priority:before')
        await next()
        executionOrder.push('low-priority:after')
      }, { priority: 200 }))

      toolBus.use(createMiddleware('high-priority', async (context, next) => {
        executionOrder.push('high-priority:before')
        await next()
        executionOrder.push('high-priority:after')
      }, { priority: 100 }))

      // 注册事件处理器
      toolBus.on('test-event', () => {
        executionOrder.push('event-handler')
      })

      // 触发事件
      await toolBus.emit('test-event', {})

      // 验证执行顺序（洋葱圈模型）
      expect(executionOrder).toEqual([
        'high-priority:before',
        'low-priority:before',
        'event-handler',
        'low-priority:after',
        'high-priority:after',
      ])
    })

    it('应该支持中间件修改上下文', async () => {
      // 注册修改上下文的中间件
      toolBus.use(createMiddleware('modify-context', async (context, next) => {
        context.data.modified = true
        context.data.value = (context.data.value || 0) + 1
        await next()
      }))

      // 注册读取上下文的中间件
      toolBus.use(createMiddleware('read-context', async (context, next) => {
        context.data.read = true
        await next()
      }))

      // 注册事件处理器
      let finalData: any = null
      toolBus.on('test-event', (context) => {
        finalData = context.data
      })

      // 触发事件
      const initialData = { value: 10 }
      await toolBus.emit('test-event', initialData)

      // 验证上下文被修改
      expect(finalData).toEqual({
        value: 11,
        modified: true,
        read: true,
      })
    })

    it('应该处理中间件错误', async () => {
      // 注册会抛出错误的中间件
      toolBus.use(createMiddleware('error-middleware', async () => {
        throw new Error('Middleware error')
      }))

      // 注册错误处理中间件
      toolBus.use(createErrorHandlingMiddleware())

      // 触发事件
      const result = await toolBus.emit('test-event', {})

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Middleware error')
    })
  })

  describe('内置中间件', () => {
    it('应该使用日志中间件', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      // 注册日志中间件
      toolBus.use(createLoggingMiddleware({ level: 'info' }))

      // 触发事件
      await toolBus.emit('test-event', { message: 'test' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('应该使用缓存中间件', async () => {
      let executionCount = 0

      // 注册缓存中间件
      toolBus.use(createCachingMiddleware({ ttlMs: 1000 }))

      // 注册会记录执行次数的中间件
      toolBus.use(createMiddleware('count-executions', async (context, next) => {
        executionCount++
        context.result = { count: executionCount }
        await next()
      }))

      // 第一次触发（应该执行）
      const result1 = await toolBus.emit('test-event', { id: 1 })
      expect(executionCount).toBe(1)
      expect(result1.finalContext.result?.count).toBe(1)
      expect(result1.finalContext.cached).toBe(false)

      // 第二次触发相同数据（应该从缓存读取）
      const result2 = await toolBus.emit('test-event', { id: 1 })
      expect(executionCount).toBe(1) // 仍然是1，没有增加
      expect(result2.finalContext.result?.count).toBe(1)
      expect(result2.finalContext.cached).toBe(true)

      // 第三次触发不同数据（应该执行）
      const result3 = await toolBus.emit('test-event', { id: 2 })
      expect(executionCount).toBe(2) // 增加到2
      expect(result3.finalContext.result?.count).toBe(2)
      expect(result3.finalContext.cached).toBe(false)
    })

    it('应该使用重试中间件', async () => {
      let attemptCount = 0
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 注册重试中间件
      toolBus.use(createRetryMiddleware({
        maxAttempts: 3,
        delayMs: 10, // 短延迟以便测试
      }))

      // 注册会失败两次然后成功的中间件
      toolBus.use(createMiddleware('flaky-operation', async (context, next) => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`)
        }
        context.result = { success: true, attempts: attemptCount }
        await next()
      }))

      // 触发事件
      const result = await toolBus.emit('test-event', {})

      expect(attemptCount).toBe(3)
      expect(result.success).toBe(true)
      expect(result.finalContext.result).toEqual({
        success: true,
        attempts: 3,
      })
      expect(result.finalContext.retry?.attempt).toBe(3)

      consoleSpy.mockRestore()
    })

    it('应该使用超时中间件', async () => {
      // 注册超时中间件（很短的时间）
      toolBus.use(createTimeoutMiddleware(50))

      // 注册会长时间执行的中间件
      toolBus.use(createMiddleware('slow-operation', async (context, next) => {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms > 50ms
        await next()
      }))

      // 触发事件（应该超时）
      const result = await toolBus.emit('test-event', {})

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Execution timeout')
    })
  })

  describe('统计信息', () => {
    it('应该收集执行统计信息', async () => {
      // 触发几次事件
      await toolBus.emit('event1', {})
      await toolBus.emit('event2', {})
      await toolBus.emit('event1', {})

      const stats = toolBus.getStats()

      expect(stats.totalExecutions).toBe(3)
      expect(stats.successCount).toBe(3)
      expect(stats.failureCount).toBe(0)
      expect(stats.averageExecutionTime).toBeGreaterThan(0)
    })

    it('应该重置统计信息', async () => {
      // 触发事件
      await toolBus.emit('test-event', {})

      let stats = toolBus.getStats()
      expect(stats.totalExecutions).toBe(1)

      // 重置统计
      toolBus.resetStats()

      stats = toolBus.getStats()
      expect(stats.totalExecutions).toBe(0)
      expect(stats.successCount).toBe(0)
      expect(stats.averageExecutionTime).toBe(0)
    })
  })

  describe('插件系统', () => {
    it('应该注册和卸载插件', async () => {
      let pluginInitialized = false
      let pluginDestroyed = false

      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        middlewares: [
          createMiddleware('plugin-middleware', async (context, next) => {
            await next()
          }),
        ],
        initialize: async () => {
          pluginInitialized = true
        },
        destroy: async () => {
          pluginDestroyed = true
        },
      }

      // 注册插件
      await toolBus.registerPlugin(plugin)

      expect(pluginInitialized).toBe(true)
      expect(toolBus.getPlugins()).toHaveLength(1)
      expect(toolBus.getMiddlewares()).toHaveLength(1)

      // 卸载插件
      const unregistered = await toolBus.unregisterPlugin('test-plugin')
      
      expect(unregistered).toBe(true)
      expect(pluginDestroyed).toBe(true)
      expect(toolBus.getPlugins()).toHaveLength(0)
      expect(toolBus.getMiddlewares()).toHaveLength(0)
    })
  })
})
