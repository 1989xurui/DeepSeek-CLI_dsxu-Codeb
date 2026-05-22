/**
 * P0-3 Core Gaps闭环测试
 * 
 * 测试Session Memory + Agent Summary + Speculation基础闭环
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EngineHarness } from '../index'
import { createMockLLMCall } from '../llm-adapter'
import { SessionStore, SessionSummaryManager, AgentSummaryManager } from '../session'
import { SpeculationManager, ToolCallSpeculationStrategy, type SpeculationStrategy, type SpeculationContext, type SpeculationOptions, type SpeculationPlan, type SpeculationResult } from '../speculation'
import type { Message, AgentSummary, SpeculationResult } from '../types'

describe('P0-3 Core Gaps闭环测试', () => {
  describe('Session Memory测试', () => {
    it('应该创建SessionStore并管理会话', () => {
      const store = new SessionStore()
      const session = store.create('/tmp/test', '测试会话')
      
      expect(session.meta.id).toBeDefined()
      expect(session.meta.cwd).toBe('/tmp/test')
      expect(session.meta.title).toBe('测试会话')
      expect(session.meta.status).toBe('active')
    })

    it('应该使用SessionSummaryManager管理记忆笔记', () => {
      const manager = new SessionSummaryManager({
        enabled: true,
        updateInterval: 5,
        maxLength: 500,
      })

      const sessionId = 'test-session-123'
      const note = manager.addMemoryNote(sessionId, '重要发现：用户需要修复auth.ts', 10, ['bug', 'auth'], 0.8)
      
      expect(note.id).toBeDefined()
      expect(note.content).toBe('重要发现：用户需要修复auth.ts')
      expect(note.tags).toEqual(['bug', 'auth'])
      expect(note.importance).toBe(0.8)

      const notes = manager.getMemoryNotes(sessionId, { minImportance: 0.5 })
      expect(notes.length).toBe(1)
      expect(notes[0].id).toBe(note.id)
    })

    it('应该自动生成会话摘要', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        content: '会话摘要：用户请求修复auth.ts中的bug，已分析代码结构，下一步需要编写测试。',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      })

      const manager = new SessionSummaryManager({
        enabled: true,
        updateInterval: 3,
        maxLength: 300,
      }, mockLLM)

      const messages: Message[] = [
        { role: 'user', content: '请帮我修复auth.ts中的bug' },
        { role: 'assistant', content: '我来帮您分析auth.ts的问题' },
      ]

      const summary = await manager.generateSummary(messages, 'test-session', 5)
      expect(summary).toBeDefined()
      expect(summary.length).toBeGreaterThan(0)
      expect(summary).toContain('会话摘要')
    })
  })

  describe('Agent Summary测试', () => {
    it('应该创建AgentSummaryManager并管理智能体摘要', () => {
      const manager = new AgentSummaryManager({
        enabled: true,
        template: '标准模板',
        autoGenerate: true,
        minLength: 50,
        maxLength: 500,
      })

      const parentSessionId = 'parent-session-123'
      const agentId = 'agent-123'
      const summary = manager.createSummary(
        agentId,
        parentSessionId,
        'completed',
        ['发现auth.ts存在权限验证漏洞'],
        ['分析了auth.ts代码', '编写了修复方案'],
        [],
        {
          totalTurns: 5,
          toolsUsed: ['Read', 'Bash'],
          success: true,
          performance: {
            durationMs: 1500,
            tokensUsed: 1200,
            toolCalls: 3,
          },
        }
      )

      expect(summary.agentId).toBe(agentId)
      expect(summary.parentSessionId).toBe(parentSessionId)
      expect(summary.status).toBe('completed')
      expect(summary.keyFindings).toContain('发现auth.ts存在权限验证漏洞')
      expect(summary.metadata.success).toBe(true)

      const summaries = manager.getSessionSummaries(parentSessionId)
      expect(summaries.length).toBe(1)
      expect(summaries[0].agentId).toBe('agent-123')
    })

    it('应该生成智能体摘要文本', () => {
      const manager = new AgentSummaryManager()
      
      const summary: AgentSummary = {
        agentId: 'agent-123',
        parentSessionId: 'parent-456',
        startedAt: Date.now() - 5000,
        endedAt: Date.now(),
        status: 'completed',
        keyFindings: ['发现并修复了auth.ts中的安全漏洞'],
        actions: ['代码分析', '漏洞修复', '测试验证'],
        errors: [],
        metadata: {
          totalTurns: 8,
          toolsUsed: ['Read', 'Edit', 'Bash'],
          success: true,
          performance: {
            durationMs: 3000,
            tokensUsed: 2000,
            toolCalls: 5,
          },
        },
      }

      const summaryText = manager.generateSummaryText(summary)
      expect(summaryText).toBeDefined()
      expect(summaryText.length).toBeGreaterThan(0)
      expect(summaryText).toContain('agent-123')
      expect(summaryText).toContain('completed')
    })
  })

  describe('Speculation基础测试', () => {
    it('应该创建SpeculationManager并注册策略', () => {
      const manager = new SpeculationManager({
        maxParallel: 2,
        timeoutMs: 10000,
        maxSpeculations: 3,
        debug: false,
      })

      const strategy = new ToolCallSpeculationStrategy()
      manager.registerStrategy(strategy)

      const strategies = manager.getRegisteredStrategies()
      expect(strategies).toContain('tool-call-prediction')
    })

    it('应该生成和执行预测计划', async () => {
      const manager = new SpeculationManager({
        maxParallel: 1,
        timeoutMs: 5000,
        maxSpeculations: 2,
        debug: false,
      })

      const strategy = new ToolCallSpeculationStrategy()
      manager.registerStrategy(strategy)

      const context = {
        messages: [
          { role: 'user', content: '请帮我读取config.json文件' },
        ],
        tools: [
          {
            name: 'Read',
            description: 'Read a file',
            inputSchema: { type: 'object', properties: { file_path: { type: 'string' } } },
            execute: async () => ({ content: 'file content', isError: false }),
            concurrencySafe: true,
            readOnly: true,
          },
        ],
        cwd: '/tmp',
        sessionId: 'test-session',
        gear: 1 as const,
        query: '请帮我读取config.json文件',
      }

      const results = await manager.speculate(context)
      expect(results).toBeInstanceOf(Array)
      
      if (results.length > 0) {
        const result = results[0]
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('planId')
        expect(result).toHaveProperty('strategy', 'tool-call-prediction')
        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('confidence')
      }
    })

    it('应该获取执行统计信息', () => {
      const manager = new SpeculationManager()
      const stats = manager.getStats()
      
      expect(stats).toHaveProperty('totalExecutions', 0)
      expect(stats).toHaveProperty('successfulExecutions', 0)
      expect(stats).toHaveProperty('successRate', 0)
      expect(stats).toHaveProperty('avgConfidence', 0)
      expect(stats).toHaveProperty('avgDurationMs', 0)
      expect(stats).toHaveProperty('registeredStrategies')
    })
  })

  describe('EngineHarness集成测试', () => {
    it('应该启用和禁用Speculation系统', () => {
      const mockLLM = createMockLLMCall([
        {
          content: 'Mock response',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 },
        },
      ])

      const engine = new EngineHarness({
        llmCall: mockLLM,
        speculation: {
          enabled: false,
          maxParallel: 2,
          timeoutMs: 10000,
        },
      })

      // 初始状态应该是禁用
      let status = engine.getSpeculationStatus()
      expect(status.enabled).toBe(false)

      // 启用Speculation
      engine.enableSpeculation()
      status = engine.getSpeculationStatus()
      expect(status.enabled).toBe(true)
      expect(status.registeredStrategies).toBeInstanceOf(Array)

      // 禁用Speculation
      engine.disableSpeculation()
      status = engine.getSpeculationStatus()
      expect(status.enabled).toBe(false)
    })

    it('应该注册Speculation策略', () => {
      const mockLLM = createMockLLMCall([
        {
          content: 'Mock response',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 },
        },
      ])

      const engine = new EngineHarness({
        llmCall: mockLLM,
        speculation: { enabled: true },
      })

      // 检查默认策略是否已自动注册
      const status = engine.getSpeculationStatus()
      expect(status.registeredStrategies).toContain('tool-call-prediction')

      // 尝试注册自定义策略（不是默认的ToolCallSpeculationStrategy）
      // 创建一个自定义策略类
      class CustomSpeculationStrategy implements SpeculationStrategy {
        name = 'custom-strategy'
        description = 'Custom speculation strategy for testing'

        async generatePlan(context: SpeculationContext, options?: SpeculationOptions): Promise<SpeculationPlan[]> {
          return []
        }

        async executeSpeculation(plan: SpeculationPlan, context: SpeculationContext): Promise<SpeculationResult> {
          return {
            success: false,
            confidence: 0,
            durationMs: 0,
            result: { content: 'Custom strategy executed', isError: false },
            metadata: { strategy: this.name }
          }
        }
      }

      const customStrategy = new CustomSpeculationStrategy()
      engine.registerSpeculationStrategy(customStrategy)

      const updatedStatus = engine.getSpeculationStatus()
      expect(updatedStatus.registeredStrategies).toContain('custom-strategy')
      expect(updatedStatus.registeredStrategies).toContain('tool-call-prediction')
      expect(updatedStatus.registeredStrategies.length).toBe(2)
    })
  })
})
