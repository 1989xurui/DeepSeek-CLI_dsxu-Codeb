/**
 * Hook适配器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToolBus, createToolBus } from '../index'
import { HookAdapter, createHookAdapter } from '../hook-adapter'

describe('Hook适配器', () => {
  let toolBus: ToolBus
  let hookAdapter: HookAdapter

  beforeEach(() => {
    toolBus = createToolBus({ debug: false })
    hookAdapter = createHookAdapter(toolBus, { debug: false })
  })

  afterEach(async () => {
    await toolBus.destroy()
  })

  describe('基础功能', () => {
    it('应该创建Hook适配器实例', () => {
      expect(hookAdapter).toBeInstanceOf(HookAdapter)
    })

    it('应该获取适配器状态', () => {
      const status = hookAdapter.getStatus()
      
      expect(status.enabled).toBe(true)
      expect(status.registeredHookEvents).toBe(0)
      expect(status.eventMappings).toBeGreaterThan(0)
      expect(status.config).toBeDefined()
    })
  })

  describe('Hook注册和执行', () => {
    it('应该注册和触发Hook回调', async () => {
      let hookCalled = false
      let receivedInput: any = null

      // 注册Hook回调
      const hookId = hookAdapter.registerHook('PreToolUse', async (input) => {
        hookCalled = true
        receivedInput = input
        return { continue: true }
      })

      // 触发Hook事件
      const result = await hookAdapter.triggerHook('PreToolUse', {
        toolName: 'test-tool',
        toolInput: { args: 'test' },
      })

      expect(hookCalled).toBe(true)
      expect(receivedInput).toBeDefined()
      expect(receivedInput.hook_event_name).toBe('PreToolUse')
      expect(receivedInput.toolName).toBe('test-tool')
      expect(result.success).toBe(true)

      // 移除Hook回调
      const removed = hookAdapter.unregisterHook('PreToolUse', hookId)
      expect(removed).toBe(true)
    })

    it('应该处理多个Hook回调', async () => {
      const executionOrder: string[] = []

      // 注册多个Hook回调
      hookAdapter.registerHook('SessionStart', async () => {
        executionOrder.push('hook1')
        return { order: 1 }
      })

      hookAdapter.registerHook('SessionStart', async () => {
        executionOrder.push('hook2')
        return { order: 2 }
      })

      // 触发Hook事件
      await hookAdapter.triggerHook('SessionStart', {
        sessionId: 'test-session',
      })

      expect(executionOrder).toEqual(['hook1', 'hook2'])
    })

    it('应该处理Hook执行错误', async () => {
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
  })

  describe('事件映射', () => {
    it('应该将Hook事件映射到Tool Bus事件', async () => {
      let toolBusEventReceived = false
      let hookEventReceived = false

      // 注册Tool Bus事件处理器
      toolBus.on('tool:pre-use', (context) => {
        toolBusEventReceived = true
        expect(context.data.toolName).toBe('test-tool')
      })

      // 注册Hook回调
      hookAdapter.registerHook('PreToolUse', async (input) => {
        hookEventReceived = true
        expect(input.hook_event_name).toBe('PreToolUse')
        expect(input.toolName).toBe('test-tool')
        return { continue: true }
      })

      // 通过Hook适配器触发事件
      await hookAdapter.triggerHook('PreToolUse', {
        toolName: 'test-tool',
      })

      expect(toolBusEventReceived).toBe(true)
      expect(hookEventReceived).toBe(true)
    })

    it('应该支持直接触发Tool Bus事件', async () => {
      let eventReceived = false

      // 注册Tool Bus事件处理器
      toolBus.on('custom:event', (context) => {
        eventReceived = true
        expect(context.data.message).toBe('test')
      })

      // 直接触发Tool Bus事件（不通过Hook适配器）
      const result = await toolBus.emit('custom:event', { message: 'test' })

      expect(eventReceived).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe('向后兼容性', () => {
    it('应该保持向后兼容', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // 注册传统的Hook回调
      let legacyHookCalled = false
      hookAdapter.registerHook('UserPromptSubmit', async (input) => {
        legacyHookCalled = true
        expect(input.hook_event_name).toBe('UserPromptSubmit')
        return { processed: true }
      })

      // 通过Hook适配器触发事件（传统方式）
      await hookAdapter.triggerHook('UserPromptSubmit', {
        prompt: 'test prompt',
      })

      expect(legacyHookCalled).toBe(true)

      consoleSpy.mockRestore()
    })
  })

  describe('配置管理', () => {
    it('应该更新配置', () => {
      const initialStatus = hookAdapter.getStatus()
      expect(initialStatus.config.debug).toBe(false)

      // 更新配置
      hookAdapter.updateConfig({ debug: true })

      const updatedStatus = hookAdapter.getStatus()
      expect(updatedStatus.config.debug).toBe(true)
    })

    it('应该更新事件映射', () => {
      const initialMappings = hookAdapter.getEventMappings()
      const initialCount = initialMappings.length

      // 更新事件映射
      const newMappings = [
        { hookEvent: 'CustomHook', toolBusEvent: 'custom:event' },
      ]
      
      hookAdapter.updateConfig({ eventMappings: newMappings })

      const updatedMappings = hookAdapter.getEventMappings()
      expect(updatedMappings).toHaveLength(1)
      expect(updatedMappings[0].hookEvent).toBe('CustomHook')
      expect(updatedMappings[0].toolBusEvent).toBe('custom:event')
    })
  })

  describe('集成测试', () => {
    it('应该与中间件系统集成', async () => {
      const executionOrder: string[] = []

      // 注册中间件
      toolBus.use({
        name: 'test-middleware',
        priority: 100,
        execute: async (context, next) => {
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

      // 验证执行顺序
      expect(executionOrder).toEqual([
        'middleware:before',
        'hook-callback',
        'middleware:after',
      ])
    })

    it('应该处理信任检查', async () => {
      // 创建启用信任检查的适配器
      const secureAdapter = createHookAdapter(toolBus, {
        enableTrustCheck: true,
        debug: false,
      })

      // 注册需要信任的Hook
      secureAdapter.registerHook('PreToolUse', async () => {
        return { continue: true }
      })

      // 注意：信任检查的具体实现需要根据实际环境调整
      // 这里主要是测试配置是否生效
      const status = secureAdapter.getStatus()
      expect(status.config.enableTrustCheck).toBe(true)
    })
  })
})
