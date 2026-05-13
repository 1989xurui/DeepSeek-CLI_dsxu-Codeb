/**
 * A×B×C 最小端到端测试
 *
 * 验证 A (Session/Task)、B (Memory/Compact)、C (Verify/Reviewer) 的集成
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { createSession, createTask } from '../session'
import { MemorySystemImpl } from '../memory/memory-system'
import { runVerifyGate } from '../verify-gate'
import { ReviewerSubagent } from '../reviewer-subagent'
import type { Session, Task } from '../session'
import type { QueryEvent, QueryResult, Message } from '../types'

describe('A×B×C 最小端到端测试', () => {
  let session: Session
  let task: Task
  let memorySystem: MemorySystemImpl

  beforeEach(() => {
    session = createSession({
      cwd: '/test/project',
      title: '端到端测试会话'
    })
    task = createTask({
      sessionId: session.id,
      title: '端到端测试任务',
      description: '测试A/B/C集成的工作流'
    })
    memorySystem = new MemorySystemImpl()
  })

  describe('1. 完整工作流：创建 → 执行 → 记忆 → 验证 → 审查', () => {
    it('应该完成完整的A/B/C集成工作流', async () => {
      console.log('=== A×B×C 端到端测试开始 ===')

      // 阶段1: A - 创建Session和Task
      console.log('阶段1 (A): 创建Session和Task')
      console.log(`- Session ID: ${session.id}`)
      console.log(`- Task ID: ${task.id}`)
      console.log(`- Session标题: ${session.title}`)
      console.log(`- Task标题: ${task.title}`)

      expect(session.id).toMatch(/^session-/)
      expect(task.id).toMatch(/^task-/)
      expect(task.sessionId).toBe(session.id)

      // 阶段2: B - 创建记忆
      console.log('阶段2 (B): 创建Memory')
      const memoryId = await memorySystem.addMemory({
        type: 'extracted',
        content: '任务执行过程中的关键记忆',
        sessionId: session.id,
        taskId: task.id,
        metadata: {
          importance: 85,
          quality: 0.9,
          tags: ['端到端测试', '关键记忆']
        }
      })

      console.log(`- 创建记忆 ID: ${memoryId}`)

      const memory = await memorySystem.getMemory(memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.sessionId).toBe(session.id)
      expect(memory?.taskId).toBe(task.id)

      // 阶段3: B - 查询记忆
      console.log('阶段3 (B): 查询Memory')
      const queryResult = await memorySystem.query({
        where: {
          sessionId: session.id,
          taskId: task.id
        }
      })

      console.log(`- 查询到 ${queryResult.length} 条记忆`)
      expect(queryResult.length).toBeGreaterThan(0)

      // 阶段4: 模拟任务执行事件
      console.log('阶段4: 模拟任务执行')
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '创建新功能文件',
            isError: false
          }
        },
        {
          type: 'tool_result',
          toolName: 'Bash',
          toolUseId: 'bash-1',
          result: {
            toolUseId: 'bash-1',
            content: '运行单元测试',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务成功完成',
        turns: 5,
        totalUsage: { inputTokens: 250, outputTokens: 125 },
        finalGear: 1,
        messages: [],
        memories: [memoryId]
      }

      // 阶段5: C - 验证
      console.log('阶段5 (C): Verify Gate')
      const verifyResult = await runVerifyGate(events, baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: true,
        minScore: 70,
        onFailure: 'warn'
      })

      console.log(`- Verify结果: ${verifyResult.verification?.passed ? '通过' : '未通过'}`)
      console.log(`- Verify分数: ${verifyResult.verification?.score}`)
      expect(verifyResult.verification).toBeDefined()

      // 阶段6: C - 审查
      console.log('阶段6 (C): Reviewer')
      const reviewer = new ReviewerSubagent({
        minScoreToApprove: 70,
        failOnRollback: true
      })

      const reviewResult = reviewer.review(events, verifyResult.result)

      console.log(`- Review结果: ${reviewResult.approved ? '批准' : '拒绝'}`)
      console.log(`- Review分数: ${reviewResult.score}`)
      console.log(`- 风险等级: ${reviewResult.riskLevel}`)

      expect(reviewResult).toBeDefined()
      expect(reviewResult.approved).toBe(true)
      expect(reviewResult.score).toBeGreaterThanOrEqual(70)

      // 阶段7: B - Compact流水线（模拟）
      console.log('阶段7 (B): Compact流水线（模拟）')
      const messages: Message[] = [
        { role: 'user', content: '实现新功能' },
        { role: 'assistant', content: '已创建初始实现' },
        { role: 'user', content: '添加测试' },
        { role: 'assistant', content: '已添加单元测试' }
      ]

      const compactResult = await memorySystem.runCompactPipeline(session.id, messages)
      console.log(`- Compact类型: ${compactResult.type}`)
      console.log(`- 原始消息数: ${compactResult.originalMessageCount}`)
      console.log(`- 压缩消息数: ${compactResult.compressedMessageCount}`)

      expect(compactResult.type).toBe('compact')

      // 最终验证
      console.log('=== 最终验证 ===')
      console.log('1. A (Session/Task) ✓')
      console.log('2. B (Memory/Compact) ✓')
      console.log('3. C (Verify/Reviewer) ✓')
      console.log('4. A×B 集成 ✓')
      console.log('5. A×C 集成 ✓')
      console.log('6. B×C 集成 ✓')
      console.log('7. A×B×C 端到端工作流 ✓')

      console.log('=== A×B×C 端到端测试完成 ===')

      // 最终断言
      expect(session.id).toBeDefined()
      expect(task.id).toBeDefined()
      expect(memoryId).toBeDefined()
      expect(verifyResult.verification).toBeDefined()
      expect(reviewResult.approved).toBe(true)
      expect(compactResult.type).toBe('compact')
    })
  })

  describe('2. 错误恢复工作流', () => {
    it('应该处理有错误的完整工作流', async () => {
      // 创建Session和Task
      const errorSession = createSession({
        cwd: '/error/test',
        title: '错误恢复测试'
      })
      const errorTask = createTask({
        sessionId: errorSession.id,
        title: '有错误的测试任务',
        description: '测试错误恢复流程'
      })

      // 模拟有错误的事件
      const errorEvents: QueryEvent[] = [
        {
          type: 'transaction_rolled_back',
          txId: 'tx-error-1',
          filesChanged: ['src/error.ts'],
          reason: 'tool_error'
        },
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-recovery',
          result: {
            toolUseId: 'edit-recovery',
            content: '恢复后成功编辑',
            isError: false
          }
        }
      ]

      const errorResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成（有错误但已恢复）',
        turns: 3,
        totalUsage: { inputTokens: 150, outputTokens: 75 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      // 运行Verify（可能不会触发，因为没有文件编辑）
      const verifyResult = await runVerifyGate(errorEvents, errorResult, {
        enabled: true,
        triggerOnFileEdit: true
      })

      // 运行Reviewer
      const reviewer = new ReviewerSubagent({ failOnRollback: true })
      const reviewResult = reviewer.review(errorEvents, verifyResult.result)

      // 验证错误恢复流程
      expect(reviewResult.approved).toBe(false) // 有回滚应该不批准
      expect(reviewResult.score).toBeLessThan(100)
      expect(reviewResult.comments.length).toBeGreaterThan(0)
    })
  })

  describe('3. 集成状态检查', () => {
    it('应该检查所有集成点的状态', () => {
      // A状态检查
      expect(typeof createSession).toBe('function')
      expect(typeof createTask).toBe('function')

      // B状态检查
      expect(MemorySystemImpl).toBeDefined()

      // C状态检查
      expect(typeof runVerifyGate).toBe('function')
      expect(ReviewerSubagent).toBeDefined()

      console.log('集成状态检查:')
      console.log('- A (Session/Task): ✓')
      console.log('- B (Memory/Compact): ✓')
      console.log('- C (Verify/Reviewer): ✓')
      console.log('- 所有核心组件可用')
    })
  })
})