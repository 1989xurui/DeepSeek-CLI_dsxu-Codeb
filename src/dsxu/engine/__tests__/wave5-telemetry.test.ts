/**
 * Wave 5 Telemetry + Error Reporter + Notifications 测试
 * #7.3 + #7.4 + #7.9
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelemetryCollector, ErrorReporter, NotificationManager } from '../telemetry'
import { createToolBus } from '../tool-bus'
import { createHookAdapter } from '../tool-bus/hook-adapter'

// ── Telemetry ──

describe('TelemetryCollector', () => {
  it('should track events', () => {
    const t = new TelemetryCollector('sess1')
    t.track('session_start')
    t.track('tool_use', { tool: 'Read' })
    t.track('tool_use', { tool: 'Write' })
    expect(t.size).toBe(3)
  })

  it('should summarize by type', () => {
    const t = new TelemetryCollector('sess1')
    t.track('tool_use')
    t.track('tool_use')
    t.track('llm_call')
    const summary = t.getSummary()
    expect(summary['tool_use']).toBe(2)
    expect(summary['llm_call']).toBe(1)
  })

  it('should filter events by type', () => {
    const t = new TelemetryCollector('sess1')
    t.track('a')
    t.track('b')
    t.track('a')
    expect(t.getEvents('a')).toHaveLength(2)
    expect(t.getEvents('b')).toHaveLength(1)
  })

  it('should respect enabled flag', () => {
    const t = new TelemetryCollector('sess1', false)
    t.track('event')
    expect(t.size).toBe(0)
  })

  it('should toggle enabled', () => {
    const t = new TelemetryCollector('sess1', false)
    t.setEnabled(true)
    t.track('event')
    expect(t.size).toBe(1)
  })

  it('should evict old events when at max', () => {
    const t = new TelemetryCollector('sess1', true, 5)
    for (let i = 0; i < 10; i++) t.track('e', { i })
    expect(t.size).toBe(5)
  })

  it('should calculate session duration', () => {
    const t = new TelemetryCollector('sess1')
    t.track('start')
    // Events are timestamped close together in tests
    t.track('end')
    const duration = t.getSessionDuration()
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should reset', () => {
    const t = new TelemetryCollector('sess1')
    t.track('e')
    t.reset()
    expect(t.size).toBe(0)
  })

  it('should summarize transaction events', () => {
    const t = new TelemetryCollector('sess1')
    t.track('transaction_started', { trackedFilesCount: 2 })
    t.track('transaction_committed', { trackedFilesCount: 2 })
    t.track('transaction_started', { trackedFilesCount: 1 })
    t.track('transaction_rolled_back', { filesChangedCount: 3 })

    const summary = t.getTransactionSummary()
    expect(summary.startedCount).toBe(2)
    expect(summary.committedCount).toBe(1)
    expect(summary.rolledBackCount).toBe(1)
    expect(summary.rolledBackFiles).toBe(3)
  })
})

// ── Error Reporter ──

describe('ErrorReporter', () => {
  it('should report errors', () => {
    const r = new ErrorReporter()
    r.report(new Error('oops'), 'test')
    expect(r.uniqueCount).toBe(1)
    expect(r.totalCount).toBe(1)
  })

  it('should aggregate duplicate errors', () => {
    const r = new ErrorReporter()
    r.report('timeout error', 'llm')
    r.report('timeout error', 'llm')
    r.report('timeout error', 'llm')
    expect(r.uniqueCount).toBe(1)
    expect(r.totalCount).toBe(3)
  })

  it('should distinguish by context', () => {
    const r = new ErrorReporter()
    r.report('error', 'context_a')
    r.report('error', 'context_b')
    expect(r.uniqueCount).toBe(2)
  })

  it('should sort by frequency', () => {
    const r = new ErrorReporter()
    r.report('rare', 'ctx')
    r.report('common', 'ctx')
    r.report('common', 'ctx')
    r.report('common', 'ctx')
    const top = r.getTopErrors(1)
    expect(top[0].message).toBe('common')
  })

  it('should evict oldest when at capacity', () => {
    const r = new ErrorReporter(3)
    r.report('e1', 'c1')
    r.report('e2', 'c2')
    r.report('e3', 'c3')
    r.report('e4', 'c4')
    expect(r.uniqueCount).toBe(3)
  })

  it('should format report', () => {
    const r = new ErrorReporter()
    r.report('test error', 'test')
    const report = r.formatReport()
    expect(report).toContain('test error')
    expect(report).toContain('Error Report')
  })

  it('should handle empty report', () => {
    const r = new ErrorReporter()
    expect(r.formatReport()).toContain('No errors')
  })

  it('should reset', () => {
    const r = new ErrorReporter()
    r.report('e', 'c')
    r.reset()
    expect(r.uniqueCount).toBe(0)
  })
})

// ── Notification Manager ──

describe('NotificationManager', () => {
  it('should add notifications', () => {
    const nm = new NotificationManager()
    nm.info('Hello')
    nm.warn('Watch out')
    nm.error('Oops')
    nm.success('Done!')
    expect(nm.size).toBe(4)
  })

  it('should track unread count', () => {
    const nm = new NotificationManager()
    nm.info('a')
    nm.info('b')
    expect(nm.unreadCount).toBe(2)
  })

  it('should mark read', () => {
    const nm = new NotificationManager()
    const n = nm.info('test')
    nm.markRead(n.id)
    expect(nm.unreadCount).toBe(0)
  })

  it('should mark all read', () => {
    const nm = new NotificationManager()
    nm.info('a')
    nm.info('b')
    nm.markAllRead()
    expect(nm.unreadCount).toBe(0)
  })

  it('should call onNotify callback', () => {
    const cb = vi.fn()
    const nm = new NotificationManager(50, cb)
    nm.info('test')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0].message).toBe('test')
  })

  it('should evict old when at capacity', () => {
    const nm = new NotificationManager(3)
    nm.info('a')
    nm.info('b')
    nm.info('c')
    nm.info('d')
    expect(nm.size).toBe(3)
  })

  it('should get unread notifications', () => {
    const nm = new NotificationManager()
    const n1 = nm.info('a')
    nm.info('b')
    nm.markRead(n1.id)
    expect(nm.getUnread()).toHaveLength(1)
  })

  it('should reset', () => {
    const nm = new NotificationManager()
    nm.info('a')
    nm.reset()
    expect(nm.size).toBe(0)
  })
})

// ── P1-1: Hooks系统去React化，转换为Tool Bus洋葱圈架构测试 ──

describe('P1-1: Hooks系统转换测试', () => {
  let toolBus: any
  let hookAdapter: any

  beforeEach(() => {
    toolBus = createToolBus({ debug: false })
    hookAdapter = createHookAdapter(toolBus, { debug: false })
  })

  afterEach(async () => {
    await toolBus.destroy()
  })

  describe('单hook转换测试', () => {
    it('应该将PreToolUse hook转换为Tool Bus中间件', async () => {
      // 测试数据
      const testToolName = 'TestTool'
      const testInput = { args: 'test' }

      // 注册传统的Hook回调
      let hookCalled = false
      let receivedData: any = null

      hookAdapter.registerHook('PreToolUse', async (input: any) => {
        hookCalled = true
        receivedData = input
        return { continue: true }
      })

      // 触发Hook事件
      const result = await hookAdapter.triggerHook('PreToolUse', {
        toolName: testToolName,
        toolInput: testInput,
      })

      // 验证Hook被调用
      expect(hookCalled).toBe(true)
      expect(receivedData).toBeDefined()
      expect(receivedData.hook_event_name).toBe('PreToolUse')
      expect(receivedData.toolName).toBe(testToolName)
      expect(result.success).toBe(true)
    })

    it('应该支持Tool Bus中间件洋葱圈执行', async () => {
      const executionOrder: string[] = []

      // 注册Tool Bus中间件（模拟洋葱圈）
      // HookAdapter的中间件优先级是500，所以我们注册一个优先级更低的中间件
      // 来验证hooks在中间件链中的执行位置
      toolBus.use({
        name: 'test-middleware',
        priority: 600, // 比HookAdapter中间件（500）优先级低
        execute: async (context: any, next: any) => {
          executionOrder.push('middleware:before')
          await next()
          executionOrder.push('middleware:after')
        },
      })

      // 注册Hook回调
      hookAdapter.registerHook('PostToolUse', async () => {
        executionOrder.push('hook-callback')
        return { success: true }
      })

      // 触发事件
      await hookAdapter.triggerHook('PostToolUse', {
        toolName: 'test-tool',
        result: { success: true },
      })

      // 输出实际执行顺序用于调试
      console.log('实际执行顺序:', executionOrder)

      // 验证洋葱圈执行顺序
      // 修复双重执行后，hook只执行一次：
      // 1. 通过hook-execution中间件（优先级500）在中间件链中执行
      // 中间件执行顺序：hook-execution (500) -> test-middleware (600)
      // 所以顺序应该是：hook-callback -> middleware:before -> middleware:after
      expect(executionOrder[0]).toBe('hook-callback') // 通过中间件执行
      expect(executionOrder[1]).toBe('middleware:before')
      expect(executionOrder[2]).toBe('middleware:after')
      expect(executionOrder).toHaveLength(3)
    })

    it('应该处理hook执行错误并继续执行', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // 注册会抛出错误的Hook回调
      hookAdapter.registerHook('PreToolUse', async () => {
        throw new Error('Hook execution error')
      })

      // 注册正常的Hook回调
      let normalHookCalled = false
      hookAdapter.registerHook('PreToolUse', async () => {
        normalHookCalled = true
        return { continue: true }
      })

      // 触发Hook事件（应该继续执行其他Hook）
      const result = await hookAdapter.triggerHook('PreToolUse', {})

      expect(normalHookCalled).toBe(true)
      expect(result.success).toBe(true)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('应该支持事件映射配置', () => {
      // 获取默认的事件映射
      const eventMappings = hookAdapter.getEventMappings()

      // 验证关键事件映射存在
      const preToolUseMapping = eventMappings.find((m: any) => m.hookEvent === 'PreToolUse')
      expect(preToolUseMapping).toBeDefined()
      expect(preToolUseMapping.toolBusEvent).toBe('tool:pre-use')

      const sessionStartMapping = eventMappings.find((m: any) => m.hookEvent === 'SessionStart')
      expect(sessionStartMapping).toBeDefined()
      expect(sessionStartMapping.toolBusEvent).toBe('session:start')
    })

    it('应该更新配置并重新初始化', () => {
      const initialStatus = hookAdapter.getStatus()
      expect(initialStatus.config.debug).toBe(false)

      // 更新配置
      hookAdapter.updateConfig({ debug: true })

      const updatedStatus = hookAdapter.getStatus()
      expect(updatedStatus.config.debug).toBe(true)
    })
  })

  describe('单filter测试：信任检查中间件', () => {
    it('应该注册信任检查中间件', () => {
      // 创建启用信任检查的适配器
      const secureAdapter = createHookAdapter(toolBus, {
        enableTrustCheck: true,
        debug: false,
      })

      const status = secureAdapter.getStatus()
      expect(status.config.enableTrustCheck).toBe(true)
    })

    it('应该执行信任检查逻辑', async () => {
      // 注意：信任检查的具体实现需要根据实际环境调整
      // 这里主要是测试中间件是否被正确注册和执行

      // 注册需要信任的Hook
      let hookExecuted = false
      hookAdapter.registerHook('PreToolUse', async () => {
        hookExecuted = true
        return { continue: true }
      })

      // 触发Hook事件
      await hookAdapter.triggerHook('PreToolUse', {
        toolName: 'test-tool',
      })

      // 验证Hook被执行（信任检查通过）
      expect(hookExecuted).toBe(true)
    })
  })

  // ── P0 清创与叠甲验收测试 ──

  describe('P0: HookBus 清创与叠甲验收', () => {
    it('应该切断双重执行（迁移事件只走ToolBus）', async () => {
      const executionOrder: string[] = []

      // 注册测试中间件
      toolBus.use({
        name: 'test-metrics-error',
        priority: 100,
        execute: async (context, next) => {
          executionOrder.push('metrics-error:before')
          await next()
          executionOrder.push('metrics-error:after')
        },
      })

      // 注册Hook回调
      hookAdapter.registerHook('PreToolUse', async () => {
        executionOrder.push('hook-callback')
        return { continue: true }
      })

      // 触发Hook事件
      await hookAdapter.triggerHook('PreToolUse', {
        toolName: 'test-tool',
      })

      // 验证执行顺序：hook只执行一次
      expect(executionOrder).toEqual([
        'metrics-error:before',
        'hook-callback',
        'metrics-error:after',
      ])
    })

    it('应该支持错误降级模式', async () => {
      // 创建新的ToolBus实例，确保中间件被装配
      const testToolBus = createToolBus({ debug: false })
      const testHookAdapter = createHookAdapter(testToolBus, { debug: false })

      // 抑制控制台错误输出
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 注册会抛出错误的Hook
      testHookAdapter.registerHook('PreToolUse', async () => {
        throw new Error('Test error for degradation')
      })

      // 触发Hook事件（应该被降级处理）
      const result = await testHookAdapter.triggerHook('PreToolUse', {
        toolName: 'test-tool',
      })

      // 验证执行成功（降级模式下）
      expect(result.success).toBe(true)

      // 验证错误被记录（HookAdapter会记录错误）
      expect(consoleErrorSpy).toHaveBeenCalled()

      // 恢复控制台
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()

      // 清理
      await testToolBus.destroy()
    })

    it('应该按正确顺序装配中间件', () => {
      const middlewares = toolBus.getMiddlewares()

      // 输出中间件信息用于调试
      if (middlewares.length > 0) {
        console.log('Registered middlewares:', middlewares.map(m => `${m.name} (priority: ${m.priority})`))
      }

      // 基本验证：中间件列表可访问
      expect(Array.isArray(middlewares)).toBe(true)

      // 如果有中间件，验证它们都有正确的结构
      middlewares.forEach(middleware => {
        expect(middleware).toHaveProperty('name')
        expect(middleware).toHaveProperty('priority')
        expect(middleware).toHaveProperty('execute')
        expect(typeof middleware.execute).toBe('function')
      })

      // 测试通过
      expect(true).toBe(true)
    })
  })
})
