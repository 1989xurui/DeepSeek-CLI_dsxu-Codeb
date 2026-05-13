import { describe, it, expect } from 'bun:test'
import { queryLoop } from '../../query-loop'
import type { QueryEngineConfig, Message, ToolRegistry, ToolSchema } from '../../types'

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

const createFakeLlmCall = (responses: Array<{
  content?: string
  stopReason: 'end_turn' | 'tool_use'
}>) => {
  let callCount = 0
  return async () => {
    const response = responses[callCount] || responses[responses.length - 1]
    callCount++
    return {
      content: response.content || '',
      stopReason: response.stopReason,
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5 }
    }
  }
}

const createFakeToolRegistry = () => {
  return {
    getSchemas: (): ToolSchema[] => [],
    executeBatch: async () => [],
    register: () => {}
  } as ToolRegistry
}

const captureConsoleLogs = () => {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: any[]) => {
    logs.push(args.join(' '))
    originalLog(...args)
  }
  return { logs, restore: () => { console.log = originalLog } }
}

describe('Query Loop Context Bundle Integration', () => {
  describe('测试1：最小成功链中能观测到 context bundle', () => {
    it('应该观测到 query-loop 启动后创建了 context bundle', async () => {
      const loopId = generateId()
      const requestId = generateId()

      const config: QueryEngineConfig = {
        llmCall: createFakeLlmCall([
          { content: '测试响应', stopReason: 'end_turn' }
        ]),
        maxTurns: 1,
        verificationGate: { enabled: false },
        reviewGate: { enabled: false }
      }

      const messages: Message[] = [
        { role: 'user', content: '测试查询' }
      ]

      const events: any[] = []
      let observedContextBundle: any = null

      try {
        for await (const event of queryLoop(config, messages, createFakeToolRegistry(), {
          loopId,
          requestId
        })) {
          events.push(event)
          if (event.type === 'loop_started' && event.metadata?.contextBundle) {
            observedContextBundle = event.metadata.contextBundle
          }
        }
      } catch (error) {
        console.error('查询循环错误:', error)
      }

      expect(observedContextBundle).not.toBeNull()
      expect(observedContextBundle.taskId).toBeDefined()
      expect(observedContextBundle.query).toBeDefined()
      expect(observedContextBundle).toHaveProperty('tokenBudget')
    })
  })

  describe('测试2：LLM 调用后 token 使用会更新到 context bundle', () => {
    it('应该观测到 LLM 调用后 token 使用更新', async () => {
      const loopId = generateId()
      const requestId = generateId()

      const config: QueryEngineConfig = {
        llmCall: createFakeLlmCall([
          { content: '第一次调用', stopReason: 'end_turn' }
        ]),
        maxTurns: 1,
        verificationGate: { enabled: false },
        reviewGate: { enabled: false }
      }

      const messages: Message[] = [
        { role: 'user', content: '测试token更新' }
      ]

      const logCapture = captureConsoleLogs()
      const events: any[] = []

      try {
        for await (const event of queryLoop(config, messages, createFakeToolRegistry(), {
          loopId,
          requestId
        })) {
          events.push(event)
        }
      } catch (error) {
        console.error('查询循环错误:', error)
      } finally {
        logCapture.restore()
      }

      const contextBuilderLogs = logCapture.logs.filter(log =>
        log.includes('ContextBuilder') || log.includes('更新令牌使用')
      )

      expect(contextBuilderLogs.length).toBeGreaterThan(0)

      const tokenUpdateLogs = contextBuilderLogs.filter(log => log.includes('更新令牌使用'))
      expect(tokenUpdateLogs.length).toBeGreaterThan(0)

      expect(events.length).toBeGreaterThan(0)
    })
  })
})
