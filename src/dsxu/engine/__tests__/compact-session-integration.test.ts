/**
 * Compact-Session 集成测试
 *
 * 验证 Compact 系统与 A 窗口 Session/Task 接口的集成
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { createSession, createTask } from '../session'
import { CompactPipeline } from '../compact/compact-pipeline'
import type { Session, Task } from '../session'
import type { Message } from '../types'

describe('Compact-Session 集成测试', () => {
  let compactPipeline: CompactPipeline
  let session: Session
  let task: Task

  beforeEach(() => {
    compactPipeline = new CompactPipeline({
      enabled: true,
      compaction: {
        enableTieredCompaction: true,
        autoCompactThreshold: 1000,
        keepRecentRounds: 5,
        lightCompactThreshold: 0.2,
        fullCompactThreshold: 0.85,
        minTokensAfterCompact: 100,
        cooldownMs: 1000
      },
      briefing: {
        enabled: true,
        maxSummaryTokens: 500,
        format: 'markdown' as const,
        includeFiles: true,
        includeToolStats: true
      },
      classification: {
        enabled: true,
        dimensions: ['complexity', 'risk', 'topic'] as const,
        minConfidence: 0.6
      },
      memoryIntegration: {
        extractOnCompact: true,
        linkMemoriesOnBrief: true,
        updateTagsOnClassify: true
      }
    })

    session = createSession({
      cwd: '/test/path',
      title: '测试会话'
    })
    task = createTask({
      sessionId: session.id,
      title: '测试任务',
      description: '这是一个测试任务'
    })
  })

  describe('1. Compact 流水线与 Session 集成', () => {
    it('应该能够为 Session 运行 Compact', async () => {
      const messages: Message[] = [
        { role: 'user', content: '请帮我修复这个bug' },
        { role: 'assistant', content: '好的，让我看看这个bug...' },
        { role: 'user', content: '错误发生在第42行' },
        { role: 'assistant', content: '找到了，这里有一个空指针异常' }
      ]

      const result = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })

      expect(result.success).toBe(true)
      expect(result.sessionId).toBe(session.id)
      expect(result.taskId).toBe(task.id)
      expect(result.compressedMessages).toHaveLength(1)
      expect(result.summary).toBeTruthy()
    })

    it('应该根据使用率选择正确的压缩策略', async () => {
      // 模拟高使用率情况
      const highUsageMessages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }))

      const result = await compactPipeline.execute(highUsageMessages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })

      expect(result.success).toBe(true)
      expect(result.strategy).toBeDefined()
      expect(result.tokenSavings).toBeGreaterThan(0)
    })
  })

  describe('2. Brief 生成与 Task 集成', () => {
    it('应该能够为 Task 生成摘要', async () => {
      const taskData = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }

      const messages: Message[] = [
        { role: 'user', content: '实现用户登录功能' },
        { role: 'assistant', content: '已创建登录页面和API' },
        { role: 'user', content: '添加密码加密' },
        { role: 'assistant', content: '已集成bcrypt加密' }
      ]

      const toolStats = {
        total: 5,
        byTool: {
          'FileEdit': 3,
          'Bash': 2
        },
        successRate: 1.0
      }

      const result = await compactPipeline.runBrief(taskData, messages, toolStats, {
        format: 'markdown' as const
      })

      expect(result.success).toBe(true)
      expect(result.summary).toContain(task.title)
      expect(result.format).toBe('markdown')
      expect(result.toolStats).toEqual(toolStats)
    })
  })

  describe('3. Classify 与 Session/Task 集成', () => {
    it('应该能够对 Session 内容进行分类', async () => {
      const messages: Message[] = [
        { role: 'user', content: '这个功能有安全风险吗？' },
        { role: 'assistant', content: '需要检查输入验证和权限控制' }
      ]

      const result = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })

      expect(result.success).toBe(true)
      expect(result.dimensions).toBeDefined()
      expect(result.overallTags).toBeInstanceOf(Array)
      expect(result.sessionId).toBe(session.id)
      expect(result.taskId).toBe(task.id)
    })

    it('应该根据分类结果更新记忆标签', async () => {
      const messages: Message[] = [
        { role: 'user', content: '重构这个复杂的模块' },
        { role: 'assistant', content: '建议拆分成多个小模块' }
      ]

      const memoryIds = ['mem-1', 'mem-2']
      const result = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })

      expect(result.success).toBe(true)
      expect(result.memoryIds).toEqual(memoryIds)
      expect(result.updatedTags).toBeInstanceOf(Array)
    })
  })

  describe('4. 集成验证', () => {
    it('Compact/Brief/Classify 应该协同工作', async () => {
      const messages: Message[] = [
        { role: 'user', content: '项目初始化' },
        { role: 'assistant', content: '创建项目结构和配置文件' },
        { role: 'user', content: '添加依赖管理' },
        { role: 'assistant', content: '已配置package.json和bun.lock' }
      ]

      // 1. 运行Compact
      const compactResult = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })
      expect(compactResult.success).toBe(true)

      // 2. 运行Brief
      const taskData = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
      const briefResult = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })
      expect(briefResult.success).toBe(true)

      // 3. 运行Classify
      const classifyResult = await compactPipeline.execute(messages, {
        sessionId: session.id,
        taskId: task.id,
        cwd: '/test/path'
      })
      expect(classifyResult.success).toBe(true)

      // 验证集成结果
      expect(compactResult.success).toBe(true)
      expect(briefResult.linkedSessionId).toBe(session.id)
      expect(classifyResult.sessionId).toBe(session.id)
    })
  })
})