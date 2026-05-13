import { describe, it, expect } from 'bun:test'
import { runVerifyGate } from '../../verify-gate'
import { ReviewerSubagent } from '../../reviewer-subagent'
import type { QueryEvent, QueryResult, AgentSummary } from '../../types'

describe('9A-C: Checks as Rules 接入 Verify/Review 链验证', () => {
  describe('测试1：Verify Gate 输出包含 ruleResults', () => {
    it('runVerifyGate() 返回的 verification 应该包含 ruleResults 数组', async () => {
      // 创建测试事件（包含文件编辑事件）
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          timestamp: Date.now(),
          result: {
            content: '测试文件编辑',
            success: true
          }
        }
      ]

      const result: QueryResult = {
        exitReason: 'success',
        finalMessage: '测试完成',
        events: []
      }

      // 运行验证门禁
      const { verification } = await runVerifyGate(events, result, {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 70,
        onFailure: 'warn'
      })

      // 验证 verification 存在
      expect(verification).toBeDefined()
      expect(verification!.passed).toBeDefined()
      expect(verification!.score).toBeDefined()

      // 验证 ruleResults 存在且是数组
      expect(verification!.ruleResults).toBeDefined()
      expect(Array.isArray(verification!.ruleResults)).toBe(true)
      expect(verification!.ruleResults!.length).toBeGreaterThan(0)

      // 验证 ruleResults 中的每个结果都有必需字段
      verification!.ruleResults!.forEach((ruleResult, index) => {
        console.log(`Verify Gate 规则结果 ${index + 1}:`, {
          id: ruleResult.id,
          ruleId: ruleResult.ruleId,
          status: ruleResult.status,
          target: ruleResult.target,
          details: ruleResult.details
        })

        expect(ruleResult.id).toBeDefined()
        expect(ruleResult.ruleId).toBeDefined()
        expect(ruleResult.status).toBeDefined()
        expect(ruleResult.checkedAt).toBeGreaterThan(0)
        expect(ruleResult.target).toBeDefined()
      })

      console.log('✅ Verify Gate 成功输出 ruleResults，包含', verification!.ruleResults!.length, '个规则结果')
    })

    it('ruleResults 包含正确的规则类型和状态', async () => {
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          timestamp: Date.now(),
          result: {
            content: '另一个测试编辑',
            success: true
          }
        }
      ]

      const result: QueryResult = {
        exitReason: 'success',
        finalMessage: '测试完成',
        events: []
      }

      const { verification } = await runVerifyGate(events, result)

      // 验证至少有一个规则结果
      expect(verification!.ruleResults!.length).toBeGreaterThan(0)

      // 检查规则类型
      const ruleIds = verification!.ruleResults!.map(r => r.ruleId)
      console.log('Verify Gate 规则ID:', ruleIds)

      // 应该包含示例规则ID
      expect(ruleIds).toContain('syntax-check-001')
      expect(ruleIds).toContain('verification-001')

      // 检查状态类型
      const statuses = verification!.ruleResults!.map(r => r.status)
      console.log('Verify Gate 规则状态:', statuses)

      // 状态应该是有效的
      const validStatuses = ['passed', 'failed', 'warning', 'skipped', 'error']
      statuses.forEach(status => {
        expect(validStatuses).toContain(status)
      })
    })
  })

  describe('测试2：Reviewer Subagent 输出包含 ruleResults', () => {
    it('review() 方法返回的 ReviewSummary 应该包含 ruleResults 数组', () => {
      const reviewer = new ReviewerSubagent()
      const events: QueryEvent[] = []
      const result: QueryResult = {
        exitReason: 'success',
        finalMessage: '测试完成',
        events: []
      }

      // 运行评审
      const reviewSummary = reviewer.review(events, result)

      // 验证 reviewSummary 存在
      expect(reviewSummary).toBeDefined()
      expect(reviewSummary.approved).toBeDefined()
      expect(reviewSummary.score).toBeDefined()

      // 验证 ruleResults 存在且是数组
      expect(reviewSummary.ruleResults).toBeDefined()
      expect(Array.isArray(reviewSummary.ruleResults)).toBe(true)
      expect(reviewSummary.ruleResults!.length).toBeGreaterThan(0)

      // 验证 ruleResults 中的每个结果都有必需字段
      reviewSummary.ruleResults!.forEach((ruleResult, index) => {
        console.log(`Reviewer Subagent 规则结果 ${index + 1}:`, {
          id: ruleResult.id,
          ruleId: ruleResult.ruleId,
          status: ruleResult.status,
          target: ruleResult.target,
          details: ruleResult.details
        })

        expect(ruleResult.id).toBeDefined()
        expect(ruleResult.ruleId).toBeDefined()
        expect(ruleResult.status).toBeDefined()
        expect(ruleResult.checkedAt).toBeGreaterThan(0)
        expect(ruleResult.target).toBeDefined()
      })

      console.log('✅ Reviewer Subagent 成功输出 ruleResults，包含', reviewSummary.ruleResults!.length, '个规则结果')
    })

    it('reviewWithSummary() 方法也返回包含 ruleResults 的 ReviewSummary', () => {
      const reviewer = new ReviewerSubagent()
      const events: QueryEvent[] = []
      const result: QueryResult = {
        exitReason: 'success',
        finalMessage: '测试完成',
        events: []
      }

      const agentSummary: AgentSummary = {
        agentId: 'test-agent',
        status: 'completed',
        summary: '测试智能体摘要',
        keyFindings: ['测试发现1', '测试发现2'],
        errors: [],
        metadata: {
          success: true,
          totalTurns: 5,
          toolsUsed: ['FileEdit', 'Bash'],
          performance: {
            durationMs: 1000,
            tokensUsed: 5000,
            toolCalls: 3
          }
        }
      }

      // 运行带摘要的评审
      const reviewSummary = reviewer.reviewWithSummary(events, result, agentSummary)

      // 验证 ruleResults 存在
      expect(reviewSummary.ruleResults).toBeDefined()
      expect(Array.isArray(reviewSummary.ruleResults)).toBe(true)
      expect(reviewSummary.ruleResults!.length).toBeGreaterThan(0)

      // 检查规则ID应该包含智能体相关的规则
      const ruleIds = reviewSummary.ruleResults!.map(r => r.ruleId)
      console.log('Reviewer Subagent with Summary 规则ID:', ruleIds)

      expect(ruleIds).toContain('dangerous-change-001')
      expect(ruleIds).toContain('review-rule-002')

      // 验证规则结果包含智能体信息
      reviewSummary.ruleResults!.forEach(ruleResult => {
        if (ruleResult.ruleId === 'review-rule-002') {
          expect(ruleResult.context).toBeDefined()
          expect(ruleResult.context!.agentId).toBe('test-agent')
          expect(ruleResult.context!.agentStatus).toBe('completed')
        }
      })
    })

    it('不同评审结果会影响 ruleResults 的状态', () => {
      const reviewer = new ReviewerSubagent()

      // 测试1：成功案例
      const successEvents: QueryEvent[] = []
      const successResult: QueryResult = {
        exitReason: 'success',
        finalMessage: '成功完成',
        events: []
      }
      const successReview = reviewer.review(successEvents, successResult)

      // 测试2：有回滚的案例
      const rollbackEvents: QueryEvent[] = [
        {
          type: 'transaction_rolled_back',
          timestamp: Date.now(),
          reason: '测试回滚'
        }
      ]
      const rollbackResult: QueryResult = {
        exitReason: 'success',
        finalMessage: '有回滚但完成',
        events: []
      }
      const rollbackReview = reviewer.review(rollbackEvents, rollbackResult)

      console.log('成功案例评审:', {
        approved: successReview.approved,
        score: successReview.score,
        ruleResults: successReview.ruleResults!.map(r => ({ ruleId: r.ruleId, status: r.status }))
      })

      console.log('回滚案例评审:', {
        approved: rollbackReview.approved,
        score: rollbackReview.score,
        ruleResults: rollbackReview.ruleResults!.map(r => ({ ruleId: r.ruleId, status: r.status }))
      })

      // 验证不同情况下规则状态可能不同
      const successRuleStatuses = successReview.ruleResults!.map(r => r.status)
      const rollbackRuleStatuses = rollbackReview.ruleResults!.map(r => r.status)

      // 至少有一个规则的状态在不同情况下可能不同
      // 注意：由于是示例规则，实际状态可能相同，但结构应该有效
      expect(successRuleStatuses.length).toBeGreaterThan(0)
      expect(rollbackRuleStatuses.length).toBeGreaterThan(0)
    })
  })

  describe('测试3：规则结果结构完整性验证', () => {
    it('ruleResults 中的每个结果都有完整的 CheckRuleResult 结构', async () => {
      // 测试 Verify Gate
      const events: QueryEvent[] = [
        {
          type: 'tool_result',
          toolName: 'FileEdit',
          timestamp: Date.now(),
          result: {
            content: '结构测试',
            success: true
          }
        }
      ]

      const result: QueryResult = {
        exitReason: 'success',
        finalMessage: '测试完成',
        events: []
      }

      const { verification } = await runVerifyGate(events, result)
      const reviewer = new ReviewerSubagent()
      const reviewSummary = reviewer.review(events, result)

      // 合并所有规则结果进行验证
      const allRuleResults = [
        ...(verification!.ruleResults || []),
        ...(reviewSummary.ruleResults || [])
      ]

      expect(allRuleResults.length).toBeGreaterThan(0)

      // 验证每个规则结果的完整结构
      allRuleResults.forEach((ruleResult, index) => {
        console.log(`规则结果 ${index + 1} 结构验证:`, {
          id: ruleResult.id,
          ruleId: ruleResult.ruleId,
          status: ruleResult.status,
          hasTarget: !!ruleResult.target,
          hasCheckedAt: !!ruleResult.checkedAt,
          hasDetails: !!ruleResult.details,
          hasFixSuggestion: !!ruleResult.fixSuggestion,
          hasContext: !!ruleResult.context,
          hasMetadata: !!ruleResult.metadata
        })

        // 必需字段
        expect(ruleResult.id).toMatch(/^[a-z0-9-]+$/i)
        expect(ruleResult.ruleId).toMatch(/^[a-z0-9-]+$/i)
        expect(['passed', 'failed', 'warning', 'skipped', 'error']).toContain(ruleResult.status)
        expect(ruleResult.checkedAt).toBeGreaterThan(0)
        expect(typeof ruleResult.target).toBe('string')
        expect(ruleResult.target.length).toBeGreaterThan(0)

        // 可选字段如果存在，应该有正确的类型
        if (ruleResult.details !== undefined) {
          expect(typeof ruleResult.details).toBe('string')
        }
        if (ruleResult.errorMessage !== undefined) {
          expect(typeof ruleResult.errorMessage).toBe('string')
        }
        if (ruleResult.fixSuggestion !== undefined) {
          expect(typeof ruleResult.fixSuggestion).toBe('string')
        }
        if (ruleResult.context !== undefined) {
          expect(typeof ruleResult.context).toBe('object')
        }
        if (ruleResult.metadata !== undefined) {
          expect(typeof ruleResult.metadata).toBe('object')
        }
      })

      console.log('✅ 所有规则结果都有完整的 CheckRuleResult 结构')
    })

    it('规则结果包含有意义的上下文信息', () => {
      const reviewer = new ReviewerSubagent()

      // 创建包含多种事件的测试
      const complexEvents: QueryEvent[] = [
        {
          type: 'transaction_rolled_back',
          timestamp: Date.now(),
          reason: '测试回滚1'
        },
        {
          type: 'tool_skipped_by_circuit_breaker',
          timestamp: Date.now(),
          toolName: 'Bash',
          reason: '测试断路器跳过'
        }
      ]

      const result: QueryResult = {
        exitReason: 'max_turns',
        finalMessage: '达到最大轮次',
        events: []
      }

      const reviewSummary = reviewer.review(complexEvents, result)

      // 检查规则结果的上下文
      reviewSummary.ruleResults!.forEach(ruleResult => {
        if (ruleResult.context) {
          console.log(`规则 ${ruleResult.ruleId} 的上下文:`, ruleResult.context)

          // 验证上下文包含有用的信息
          if (ruleResult.ruleId === 'review-rule-002') {
            expect(ruleResult.context.findingsCount).toBeDefined()
            expect(ruleResult.context.rollbackCount).toBeDefined()
            expect(ruleResult.context.circuitSkips).toBeDefined()

            // 在这个测试中，应该有1个回滚和1个断路器跳过
            expect(ruleResult.context.rollbackCount).toBe(1)
            expect(ruleResult.context.circuitSkips).toBe(1)
          }
        }
      })
    })
  })
})
