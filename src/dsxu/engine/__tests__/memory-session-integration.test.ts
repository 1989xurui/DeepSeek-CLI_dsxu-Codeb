/**
 * Memory-Session 集成测试
 *
 * 验证 Memory 系统与 A 窗口 Session/Task 接口的集成
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { MemorySystemImpl } from '../memory/memory-system'
import { createSession, createTask } from '../session'
import type { Session, Task } from '../session'

describe('Memory-Session 集成测试', () => {
  let memorySystem: MemorySystemImpl
  let session: Session
  let task: Task

  beforeEach(() => {
    memorySystem = new MemorySystemImpl()
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

  describe('1. 基础集成', () => {
    it('应该能够为 Session 创建记忆', async () => {
      const memoryId = await memorySystem.addMemory({
        type: 'extracted',
        content: '会话相关的记忆',
        sessionId: session.id,
        metadata: {
          importance: 80,
          quality: 0.9
        }
      })

      const memory = await memorySystem.getMemory(memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.sessionId).toBe(session.id)
    })

    it('应该能够为 Task 创建记忆', async () => {
      const memoryId = await memorySystem.addMemory({
        type: 'extracted',
        content: '任务相关的记忆',
        sessionId: session.id,
        taskId: task.id,
        metadata: {
          importance: 85,
          quality: 0.8
        }
      })

      const memory = await memorySystem.getMemory(memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.sessionId).toBe(session.id)
      expect(memory?.taskId).toBe(task.id)
    })
  })

  describe('2. 查询集成', () => {
    beforeEach(async () => {
      // 创建测试数据
      await memorySystem.addMemory({
        type: 'extracted',
        content: '会话1的记忆1',
        sessionId: session.id,
        metadata: { importance: 70 }
      })

      await memorySystem.addMemory({
        type: 'compact',
        content: '会话1的记忆2',
        sessionId: session.id,
        taskId: task.id,
        metadata: { importance: 80 }
      })

      // 创建另一个会话的记忆
      const anotherSession = createSession({
        cwd: '/another/path',
        title: '另一个会话'
      })
      await memorySystem.addMemory({
        type: 'extracted',
        content: '另一个会话的记忆',
        sessionId: anotherSession.id,
        metadata: { importance: 60 }
      })
    })

    it('应该能够按 Session 查询记忆', async () => {
      const query = {
        where: {
          sessionId: session.id
        },
        limit: 10
      }

      const memories = await memorySystem.query(query)
      expect(memories).toHaveLength(2)
      expect(memories.every(m => m.sessionId === session.id)).toBe(true)
    })

    it('应该能够按 Task 查询记忆', async () => {
      const query = {
        where: {
          sessionId: session.id,
          taskId: task.id
        },
        limit: 10
      }

      const memories = await memorySystem.query(query)
      expect(memories).toHaveLength(1)
      expect(memories[0].taskId).toBe(task.id)
    })
  })

  describe('3. Episode 集成', () => {
    it('应该能够为 Task 创建 Episode', async () => {
      const episodeId = await memorySystem.createEpisode({
        taskId: task.id,
        sessionId: session.id,
        title: '任务执行过程',
        description: '记录任务执行的关键步骤',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        outcome: 'success' as const
      })

      const episode = await memorySystem.getEpisode(episodeId)
      expect(episode).not.toBeNull()
      expect(episode?.taskId).toBe(task.id)
      expect(episode?.sessionId).toBe(session.id)
    })

    it('应该能够查询 Task 的 Episodes', async () => {
      // 创建多个 episodes
      await memorySystem.createEpisode({
        taskId: task.id,
        sessionId: session.id,
        title: 'Episode 1',
        description: '第一次尝试',
        startTime: Date.now() - 3000,
        endTime: Date.now() - 2000,
        outcome: 'partial_success' as const
      })

      await memorySystem.createEpisode({
        taskId: task.id,
        sessionId: session.id,
        title: 'Episode 2',
        description: '第二次尝试',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        outcome: 'success' as const
      })

      const episodes = await memorySystem.getEpisodesByTask(task.id)
      expect(episodes).toHaveLength(2)
      expect(episodes.every(e => e.taskId === task.id)).toBe(true)
    })
  })

  describe('4. Compact 流水线集成', () => {
    it('应该能够为 Session 运行 Compact 流水线', async () => {
      const messages = [
        { role: 'user' as const, content: '用户消息1' },
        { role: 'assistant' as const, content: '助手回复1' },
        { role: 'user' as const, content: '用户消息2' },
        { role: 'assistant' as const, content: '助手回复2' }
      ]

      // 使用模拟的compact功能
      // 由于测试环境没有真正的LLM，runCompactPipeline可能返回false
      // 我们只检查类型和结构
      const result = await memorySystem.runCompactPipeline(session.id, messages)

      expect(result.type).toBe('compact')
      expect(result.originalMessageCount).toBe(messages.length)
      // 不检查success，因为测试环境可能无法真正运行compact
    })
  })
})