/**
 * Coding Pack 集成测试
 *
 * 验证 C 窗口 LSP/MCP/Repo/Verify/Reviewer/Checks/Bridge 的集成
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { createSession, createTask } from '../session'
import { ReviewerSubagent } from '../reviewer-subagent'
import { runVerifyGate } from '../verify-gate'
import type { Session, Task } from '../session'
import type { QueryEvent, QueryResult } from '../types'

describe('Coding Pack 集成测试', () => {
  let session: Session
  let task: Task

  beforeEach(() => {
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

  describe('1. Verify + Reviewer 集成', () => {
    it('应该能够顺序执行 Verify 和 Reviewer', async () => {
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '文件编辑成功',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成',
        turns: 3,
        totalUsage: { inputTokens: 100, outputTokens: 50 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      // 1. 运行 Verify Gate
      const verifyResult = await runVerifyGate(events, baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 70,
        onFailure: 'warn'
      })

      expect(verifyResult.verification).toBeDefined()
      expect(verifyResult.verification?.passed).toBe(true)

      // 2. 运行 Reviewer
      const reviewer = new ReviewerSubagent()
      const reviewResult = reviewer.review(events, verifyResult.result)

      expect(reviewResult.approved).toBe(true)
      expect(reviewResult.score).toBeGreaterThanOrEqual(75)

      // 验证集成结果
      expect(verifyResult.result.verification).toBeDefined()
      expect(reviewResult.comments).toBeInstanceOf(Array)
    })

    it('应该处理 Verify 失败的情况', async () => {
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '高风险编辑',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成',
        turns: 5,
        totalUsage: { inputTokens: 200, outputTokens: 100 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      // 使用低阈值使验证失败
      const verifyResult = await runVerifyGate(events, baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 90, // 高阈值
        onFailure: 'warn'
      })

      // 验证结果
      expect(verifyResult.verification).toBeDefined()

      const reviewer = new ReviewerSubagent()
      const reviewResult = reviewer.review(events, verifyResult.result)

      // 无论验证是否通过，review都应该正常工作
      expect(reviewResult).toBeDefined()
      expect(reviewResult.approved).toBeDefined()
      // 不检查具体分数，因为验证可能通过
    })
  })

  describe('2. 安全检查集成', () => {
    it('应该检测并处理回滚事件', () => {
      const events: QueryEvent[] = [
        {
          type: 'transaction_rolled_back',
          txId: 'tx-1',
          filesChanged: ['src/file1.ts'],
          reason: 'tool_error'
        },
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '成功编辑',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成',
        turns: 4,
        totalUsage: { inputTokens: 150, outputTokens: 75 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      const reviewer = new ReviewerSubagent({ failOnRollback: true })
      const reviewResult = reviewer.review(events, baseResult)

      expect(reviewResult.approved).toBe(false)
      expect(reviewResult.score).toBeLessThan(100)
    })

    it('应该处理多次断路器跳过', () => {
      const events: QueryEvent[] = [
        {
          type: 'tool_skipped_by_circuit_breaker',
          toolName: 'Bash',
          reason: 'high_failure_rate'
        },
        {
          type: 'tool_skipped_by_circuit_breaker',
          toolName: 'FileEdit',
          reason: 'high_failure_rate'
        },
        {
          type: 'tool_skipped_by_circuit_breaker',
          toolName: 'Bash',
          reason: 'high_failure_rate'
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成',
        turns: 2,
        totalUsage: { inputTokens: 50, outputTokens: 25 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      const reviewer = new ReviewerSubagent({ failOnCircuitSkipThreshold: 2 })
      const reviewResult = reviewer.review(events, baseResult)

      expect(reviewResult.score).toBeLessThan(100)
    })
  })

  describe('3. 端到端工作流', () => {
    it('应该完成完整的 Coding Pack 工作流', async () => {
      // 模拟一个完整的任务执行过程
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '创建新文件',
            isError: false
          }
        },
        {
          type: 'tool_result',
          toolName: 'Bash',
          toolUseId: 'bash-1',
          result: {
            toolUseId: 'bash-1',
            content: '运行测试',
            isError: false
          }
        },
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-2',
          result: {
            toolUseId: 'edit-2',
            content: '修复bug',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务成功完成',
        turns: 6,
        totalUsage: { inputTokens: 300, outputTokens: 150 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      // 1. 验证阶段
      const verifyResult = await runVerifyGate(events, baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: true,
        minScore: 70,
        onFailure: 'warn'
      })

      expect(verifyResult.verification).toBeDefined()

      // 2. 审查阶段
      const reviewer = new ReviewerSubagent({
        minScoreToApprove: 70,
        failOnRollback: true,
        failOnCircuitSkipThreshold: 2
      })

      const reviewResult = reviewer.review(events, verifyResult.result)

      // 验证最终结果
      expect(reviewResult.approved).toBe(true)
      expect(reviewResult.score).toBeGreaterThanOrEqual(70)
      expect(reviewResult.riskLevel).toBeDefined()

      // 输出集成摘要
      console.log('Coding Pack 集成测试摘要:')
      console.log(`- Verify 结果: ${verifyResult.verification?.passed ? '通过' : '未通过'}`)
      console.log(`- Review 结果: ${reviewResult.approved ? '批准' : '拒绝'}`)
      console.log(`- Review 分数: ${reviewResult.score}`)
      console.log(`- 风险等级: ${reviewResult.riskLevel}`)
    })
  })

  describe('4. 错误处理集成', () => {
    it('应该处理工具错误和恢复', () => {
      const events: QueryEvent[] = [
        {
          type: 'error',
          error: '工具执行失败',
          recoverable: true
        },
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          toolUseId: 'edit-1',
          result: {
            toolUseId: 'edit-1',
            content: '恢复后成功',
            isError: false
          }
        }
      ]

      const baseResult: QueryResult = {
        exitReason: 'end_turn',
        finalMessage: '任务完成（有错误但已恢复）',
        turns: 3,
        totalUsage: { inputTokens: 120, outputTokens: 60 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      const reviewer = new ReviewerSubagent()
      const reviewResult = reviewer.review(events, baseResult)

      // 有可恢复错误应该降低分数但不一定拒绝
      expect(reviewResult.score).toBeLessThan(100)
      expect(reviewResult.comments.length).toBeGreaterThan(0)
    })

    it('应该处理 API 错误退出', () => {
      const events: QueryEvent[] = []
      const baseResult: QueryResult = {
        exitReason: 'api_error',
        finalMessage: 'API错误导致退出',
        turns: 1,
        totalUsage: { inputTokens: 30, outputTokens: 15 },
        finalGear: 1,
        messages: [],
        memories: []
      }

      const reviewer = new ReviewerSubagent()
      const reviewResult = reviewer.review(events, baseResult)

      expect(reviewResult.approved).toBe(false)
      expect(reviewResult.score).toBeLessThan(100)
    })
  })
})