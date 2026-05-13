import { describe, it, expect, beforeEach } from 'bun:test'
import { queryLoop } from '../../query-loop'
import type { QueryEngineConfig, Message, ToolRegistry, ToolSchema } from '../../types'
import { getProfileConfig } from '../../profiles'

// 创建模拟工具注册表
const createMockToolRegistry = (tools: Array<{name: string, description: string}>) => {
  const toolMap = new Map<string, any>()

  const schemas: ToolSchema[] = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }))

  return {
    getSchemas: (): ToolSchema[] => schemas,
    executeBatch: async (calls: any[], context: any) => {
      return calls.map(call => ({
        toolUseId: call.toolUseId,
        content: `Executed ${call.name}`,
        isError: false,
        meta: { durationMs: 10 }
      }))
    },
    register: (name: string, tool: any) => {
      toolMap.set(name, tool)
    }
  } as ToolRegistry
}

// 生成唯一ID
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

describe('Query Loop with Profile Integration', () => {
  describe('Plan Profile (只读)', () => {
    it('应该只选择只读工具', async () => {
      const loopId = generateId()
      const requestId = generateId()

      // 创建包含读写工具的工具注册表
      const toolRegistry = createMockToolRegistry([
        { name: 'Read', description: '读取文件' },
        { name: 'Grep', description: '搜索文件内容' },
        { name: 'Write', description: '写入文件' },
        { name: 'Edit', description: '编辑文件' },
        { name: 'Bash', description: '执行bash命令' },
      ])

      const config: QueryEngineConfig = {
        llmCall: async () => ({
          content: '分析完成',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 }
        }),
        maxTurns: 1,
        profile: {
          type: 'plan',
          enableToolFiltering: true
        }
      }

      const messages: Message[] = [
        { role: 'user', content: '设计系统架构方案和规划实施步骤' }
      ]

      const events: any[] = []

      for await (const event of queryLoop(config, messages, toolRegistry, {
        loopId,
        requestId
      })) {
        events.push(event)
      }

      // 检查tool_subset_selected事件
      const subsetEvent = events.find(e => e.type === 'tool_subset_selected')
      expect(subsetEvent).toBeDefined()
      expect(subsetEvent.profileUsed).toBe('plan')
      expect(subsetEvent.profileFilteredCount).toBeGreaterThan(0) // 应该有被过滤的工具

      // 检查选择的工具应该只包含只读工具
      const selectedTools = subsetEvent.selectedToolNames
      expect(selectedTools).toContain('Read')
      expect(selectedTools).toContain('Grep')
      expect(selectedTools).not.toContain('Write') // 写工具应该被过滤
      expect(selectedTools).not.toContain('Edit') // 编辑工具应该被过滤
    })
  })

  describe('Edit Profile (允许写操作)', () => {
    it('应该允许读写工具', async () => {
      const loopId = generateId()
      const requestId = generateId()

      const toolRegistry = createMockToolRegistry([
        { name: 'Read', description: '读取文件' },
        { name: 'Write', description: '写入文件' },
        { name: 'Edit', description: '编辑文件' },
        { name: 'LSP', description: '代码分析' },
      ])

      const config: QueryEngineConfig = {
        llmCall: async () => ({
          content: '编辑完成',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 }
        }),
        maxTurns: 1,
        profile: {
          type: 'edit',
          enableToolFiltering: true
        }
      }

      const messages: Message[] = [
        { role: 'user', content: '修改代码文件' }
      ]

      const events: any[] = []

      for await (const event of queryLoop(config, messages, toolRegistry, {
        loopId,
        requestId
      })) {
        events.push(event)
      }

      const subsetEvent = events.find(e => e.type === 'tool_subset_selected')
      expect(subsetEvent).toBeDefined()
      expect(subsetEvent.profileUsed).toBe('edit')
      expect(subsetEvent.profileFilteredCount).toBe(0) // 所有工具都应该被允许

      const selectedTools = subsetEvent.selectedToolNames
      expect(selectedTools).toContain('Read')
      expect(selectedTools).toContain('Write')
      expect(selectedTools).toContain('Edit')
      expect(selectedTools).toContain('LSP')
    })
  })

  describe('自动profile推荐', () => {
    it('应该根据任务描述自动推荐profile', async () => {
      const loopId = generateId()
      const requestId = generateId()

      const toolRegistry = createMockToolRegistry([
        { name: 'Read', description: '读取文件' },
        { name: 'Write', description: '写入文件' },
      ])

      const config: QueryEngineConfig = {
        llmCall: async () => ({
          content: '完成',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 }
        }),
        maxTurns: 1,
        profile: {
          autoRecommend: true,
          enableToolFiltering: true
        }
      }

      // 测试规划任务
      const planningMessages: Message[] = [
        { role: 'user', content: '设计系统架构方案' }
      ]

      const planningEvents: any[] = []
      for await (const event of queryLoop(config, planningMessages, toolRegistry, {
        loopId: generateId(),
        requestId: generateId()
      })) {
        planningEvents.push(event)
      }

      const planningSubsetEvent = planningEvents.find(e => e.type === 'tool_subset_selected')
      expect(planningSubsetEvent).toBeDefined()
      expect(planningSubsetEvent.profileUsed).toBe('plan') // 应该自动推荐plan profile

      // 测试编辑任务
      const editingMessages: Message[] = [
        { role: 'user', content: '修复bug并重构代码' }
      ]

      const editingEvents: any[] = []
      for await (const event of queryLoop(config, editingMessages, toolRegistry, {
        loopId: generateId(),
        requestId: generateId()
      })) {
        editingEvents.push(event)
      }

      const editingSubsetEvent = editingEvents.find(e => e.type === 'tool_subset_selected')
      expect(editingSubsetEvent).toBeDefined()
      expect(editingSubsetEvent.profileUsed).toBe('edit') // 应该自动推荐edit profile
    })
  })
})
