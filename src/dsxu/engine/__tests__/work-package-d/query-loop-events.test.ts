import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { queryLoop } from '../../query-loop'
import type { QueryEngineConfig, Message, ToolRegistry, ToolSchema } from '../../types'

// 最小化 fake llmCall
const createFakeLlmCall = (response: any) => async () => response

// 最小化 toolRegistry
const createFakeToolRegistry = () => {
  const tools = new Map<string, any>()

  return {
    getSchemas: (): ToolSchema[] => [],
    executeBatch: async (calls: any[], context: any) => {
      return calls.map(call => ({
        toolUseId: call.toolUseId,
        content: `Executed ${call.name}`,
        isError: false,
        meta: { durationMs: 10 }
      }))
    },
    register: (name: string, tool: any) => {
      tools.set(name, tool)
    }
  } as ToolRegistry
}

// 生成唯一ID
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

describe('query-loop events', () => {
  describe('成功链', () => {
    it('应该发出正确的事件序列（无工具调用）', async () => {
      const loopId = generateId()
      const requestId = generateId()

      // 最小化 config
      const config: QueryEngineConfig = {
        llmCall: createFakeLlmCall({
          content: 'Hello, world!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 }
        }),
        maxTurns: 1
      }

      const toolRegistry = createFakeToolRegistry()
      const messages: Message[] = [
        { role: 'user', content: 'Say hello' }
      ]

      const events: any[] = []

      for await (const event of queryLoop(config, messages, toolRegistry, {
        loopId,
        requestId
      })) {
        events.push(event)
      }

      // 断言事件序列
      expect(events.length).toBeGreaterThan(0)

      // 必须有 loop_started
      const loopStarted = events.find(e => e.type === 'loop_started')
      expect(loopStarted).toBeDefined()
      expect(typeof loopStarted.loopId).toBe('string')
      expect(loopStarted.loopId.length).toBeGreaterThan(0)
      expect(typeof loopStarted.requestId).toBe('string')
      expect(loopStarted.requestId.length).toBeGreaterThan(0)
      expect(loopStarted.timestamp).toBeDefined()

      // 必须有 model_called
      const modelCalled = events.find(e => e.type === 'model_called')
      expect(modelCalled).toBeDefined()
      expect(typeof modelCalled.loopId).toBe('string')
      expect(modelCalled.loopId.length).toBeGreaterThan(0)
      expect(modelCalled.callId).toBeDefined()
      expect(modelCalled.model).toBeDefined()
      expect(modelCalled.timestamp).toBeDefined()

      // 必须有 loop_finished
      const loopFinished = events.find(e => e.type === 'loop_finished')
      expect(loopFinished).toBeDefined()
      expect(typeof loopFinished.loopId).toBe('string')
      expect(loopFinished.loopId.length).toBeGreaterThan(0)
      expect(typeof loopFinished.requestId).toBe('string')
      expect(loopFinished.requestId.length).toBeGreaterThan(0)
      expect(loopFinished.success).toBe(true)
      expect(loopFinished.reason).toBeDefined()
      expect(loopFinished.timestamp).toBeDefined()

      // 不应该有工具相关事件
      const toolStarted = events.find(e => e.type === 'tool_dispatch_started')
      const toolCompleted = events.find(e => e.type === 'tool_dispatch_completed')
      expect(toolStarted).toBeUndefined()
      expect(toolCompleted).toBeUndefined()
    })

    it('应该发出正确的事件序列（有工具调用）', async () => {
      const loopId = generateId()
      const requestId = generateId()
      const callId = generateId()
      const toolUseId = generateId()

      // 创建一个能够返回不同响应的 fake llmCall
      let callCount = 0
      const fakeLlmCall = async () => {
        callCount++
        if (callCount === 1) {
          // 第一次调用：返回工具调用
          return {
            content: '',
            stopReason: 'tool_use',
            toolCalls: [{
              id: toolUseId,
              name: 'test_tool',
              arguments: {}
            }],
            usage: { inputTokens: 10, outputTokens: 5 }
          }
        } else {
          // 第二次调用：返回正常结束
          return {
            content: '任务完成',
            stopReason: 'end_turn',
            usage: { inputTokens: 5, outputTokens: 3 }
          }
        }
      }

      // 最小化 config
      const config: QueryEngineConfig = {
        llmCall: fakeLlmCall,
        maxTurns: 2  // 需要至少2轮：第一轮工具调用，第二轮正常结束
      }

      const toolRegistry = createFakeToolRegistry()

      // 注册一个测试工具
      toolRegistry.register('test_tool', {
        execute: async () => ({
          content: 'Tool executed',
          isError: false
        })
      })

      const messages: Message[] = [
        { role: 'user', content: 'Use a tool' }
      ]

      const events: any[] = []

      for await (const event of queryLoop(config, messages, toolRegistry, {
        loopId,
        requestId,
        callId
      })) {
        events.push(event)
      }

      // 断言事件序列
      expect(events.length).toBeGreaterThan(0)

      // 必须有 loop_started
      const loopStarted = events.find(e => e.type === 'loop_started')
      expect(loopStarted).toBeDefined()

      // 必须有 model_called
      const modelCalled = events.find(e => e.type === 'model_called')
      expect(modelCalled).toBeDefined()

      // 必须有 tool_dispatch_started
      const toolStarted = events.find(e => e.type === 'tool_dispatch_started')
      expect(toolStarted).toBeDefined()
      expect(typeof toolStarted.loopId).toBe('string')
      expect(toolStarted.loopId.length).toBeGreaterThan(0)
      expect(typeof toolStarted.callId).toBe('string')
      expect(toolStarted.callId.length).toBeGreaterThan(0)
      expect(toolStarted.toolName).toBe('test_tool')
      expect(toolStarted.toolUseId).toBe(toolUseId)
      expect(toolStarted.timestamp).toBeDefined()

      // 必须有 tool_dispatch_completed
      const toolCompleted = events.find(e => e.type === 'tool_dispatch_completed')
      expect(toolCompleted).toBeDefined()
      expect(typeof toolCompleted.loopId).toBe('string')
      expect(toolCompleted.loopId.length).toBeGreaterThan(0)
      expect(typeof toolCompleted.callId).toBe('string')
      expect(toolCompleted.callId.length).toBeGreaterThan(0)
      expect(toolCompleted.toolName).toBe('test_tool')
      expect(toolCompleted.toolUseId).toBe(toolUseId)
      expect(toolCompleted.success).toBe(true)
      expect(toolCompleted.timestamp).toBeDefined()

      // 必须有 loop_finished
      const loopFinished = events.find(e => e.type === 'loop_finished')
      expect(loopFinished).toBeDefined()
      expect(loopFinished.success).toBe(true)
    })
  })

  describe('失败链', () => {
    it('应该发出 loop_aborted 事件', async () => {
      const loopId = generateId()
      const requestId = generateId()

      // 创建一个会抛出错误的 llmCall
      const config: QueryEngineConfig = {
        llmCall: async () => {
          throw new Error('API error')
        },
        maxTurns: 1
      }

      const toolRegistry = createFakeToolRegistry()
      const messages: Message[] = [
        { role: 'user', content: 'This will fail' }
      ]

      const events: any[] = []

      try {
        for await (const event of queryLoop(config, messages, toolRegistry, {
          loopId,
          requestId
        })) {
          events.push(event)
        }
      } catch (error) {
        // 预期会抛出错误
      }

      // 断言事件序列
      expect(events.length).toBeGreaterThan(0)

      // 必须有 loop_started
      const loopStarted = events.find(e => e.type === 'loop_started')
      expect(loopStarted).toBeDefined()
      expect(typeof loopStarted.loopId).toBe('string')
      expect(loopStarted.loopId.length).toBeGreaterThan(0)
      expect(typeof loopStarted.requestId).toBe('string')
      expect(loopStarted.requestId.length).toBeGreaterThan(0)

      // 必须有 loop_aborted
      const loopAborted = events.find(e => e.type === 'loop_aborted')
      expect(loopAborted).toBeDefined()
      expect(typeof loopAborted.loopId).toBe('string')
      expect(loopAborted.loopId.length).toBeGreaterThan(0)
      expect(typeof loopAborted.requestId).toBe('string')
      expect(loopAborted.requestId.length).toBeGreaterThan(0)
      expect(loopAborted.reason).toBeDefined()
      expect(loopAborted.timestamp).toBeDefined()

      // 如果当前实现有 failureType，就断言它
      if (loopAborted.failureType !== undefined) {
        expect(typeof loopAborted.failureType).toBe('string')
      }

      // 不应该有 loop_finished
      const loopFinished = events.find(e => e.type === 'loop_finished')
      expect(loopFinished).toBeUndefined()
    })
  })
})
