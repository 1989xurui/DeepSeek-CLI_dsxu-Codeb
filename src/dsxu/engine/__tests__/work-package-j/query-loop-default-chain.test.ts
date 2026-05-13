import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { queryLoop } from '../../query-loop'
import type { QueryLoopConfig, QueryEvent, QueryResult } from '../../types'
import type { DefaultChainResult } from '../../verify-review-chain'

describe('Verify / Review / Rollback 默认链接入 query-loop 验证', () => {
  // 收集的事件
  let collectedEvents: QueryEvent[] = []
  let finalResult: QueryResult | null = null

  beforeEach(() => {
    collectedEvents = []
    finalResult = null
  })

  afterEach(() => {
    collectedEvents = []
    finalResult = null
  })

  // 辅助函数：创建最小配置
  function createMinimalConfig(verifyPassed: boolean = true, reviewApproved: boolean = true): QueryLoopConfig {
    return {
      toolRegistry: {
        getAll: () => [],
        get: () => undefined,
        has: () => false,
        register: () => {},
        unregister: () => {},
        clear: () => {},
        size: 0,
        getSchemas: () => []
      },
      llmCall: async () => ({
        content: [{ type: 'text', text: '测试完成' }],
        tool_calls: []
      }),
      cwd: '/tmp/test',
      fileHistory: {
        getFileHistory: () => [],
        recordFileChange: () => {},
        getRecentChanges: () => []
      },
      // 配置验证和审查门禁
      verificationGate: {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: false,
        minScore: verifyPassed ? 70 : 100, // 控制验证结果
        onFailure: 'warn'
      },
      reviewGate: {
        minScoreToApprove: reviewApproved ? 60 : 100, // 控制审查结果
        failOnRollback: true,
        failOnCircuitSkipThreshold: 2
      }
    }
  }

  describe('测试1：通过链', () => {
    it('edit/execute 之后进入 verify -> review -> commit，最终 metadata 中包含默认链结果', async () => {
      const config = createMinimalConfig(true, true) // 验证通过，审查批准

      const events = queryLoop(
        config,
        [{ role: 'user', content: '测试任务：验证通过链' }],
        config.toolRegistry,
        {
          sessionId: 'test-session-pass',
          requestId: 'test-request-pass'
        }
      )

      let eventCount = 0
      let sawVerify = false
      let sawReview = false
      let sawCommit = false

      for await (const event of events) {
        collectedEvents.push(event)

        // 跟踪状态转移
        if (event.type === 'state_transition') {
          console.log(`[测试1] 状态转移: ${(event as any).from} -> ${(event as any).to}`)
        }

        // 检查完成事件
        if (event.type === 'loop_finished' || event.type === 'loop_aborted') {
          finalResult = (event as any).result
          console.log(`[测试1] 循环结束: ${event.type}, success: ${(event as any).success}`)
          break
        }

        // 安全限制：最多收集30个事件
        eventCount++
        if (eventCount >= 30) {
          console.log('[测试1] 达到事件收集上限')
          break
        }
      }

      // 验证收集到了事件
      expect(collectedEvents.length).toBeGreaterThan(0)
      expect(collectedEvents.some(e => e.type === 'loop_started')).toBe(true)

      // 验证最终结果存在
      expect(finalResult).not.toBeNull()

      if (finalResult) {
        console.log(`[测试1] 最终结果 exitReason: ${finalResult.exitReason}`)

        // 验证metadata中包含默认链结果
        expect(finalResult.metadata).toBeDefined()
        expect(finalResult.metadata?.defaultChain).toBeDefined()

        const defaultChain = finalResult.metadata?.defaultChain as DefaultChainResult
        console.log(`[测试1] 默认链结果:`, {
          finalOutcome: defaultChain.finalOutcome,
          phaseCount: defaultChain.phaseResults?.length || 0,
          success: defaultChain.success
        })

        // 验证默认链结果
        expect(defaultChain.finalOutcome).toBeDefined()
        expect(['commit', 'rollback']).toContain(defaultChain.finalOutcome)

        // 验证阶段结果
        if (defaultChain.phaseResults) {
          expect(Array.isArray(defaultChain.phaseResults)).toBe(true)
          console.log(`[测试1] 阶段结果数量: ${defaultChain.phaseResults.length}`)

          // 检查是否有verify和review阶段
          const hasVerify = defaultChain.phaseResults.some(p => p.phase === 'verify')
          const hasReview = defaultChain.phaseResults.some(p => p.phase === 'review')
          console.log(`[测试1] 包含verify阶段: ${hasVerify}, 包含review阶段: ${hasReview}`)
        }

        // 验证成功完成
        expect(defaultChain.success).toBe(true)
        expect(defaultChain.finalOutcome).toBe('commit')
      }
    })
  })

  describe('测试2：拒绝链', () => {
    it('verify 失败时进入 rollback，metadata 中包含 rollbackTrigger', async () => {
      const config = createMinimalConfig(false, true) // 验证失败，审查批准

      const events = queryLoop(
        config,
        [{ role: 'user', content: '测试任务：验证拒绝链（验证失败）' }],
        config.toolRegistry,
        {
          sessionId: 'test-session-fail-verify',
          requestId: 'test-request-fail-verify'
        }
      )

      let eventCount = 0
      let finalResult: QueryResult | null = null

      for await (const event of events) {
        collectedEvents.push(event)

        // 检查完成事件
        if (event.type === 'loop_finished' || event.type === 'loop_aborted') {
          finalResult = (event as any).result
          console.log(`[测试2-验证失败] 循环结束: ${event.type}, success: ${(event as any).success}`)
          break
        }

        // 安全限制：最多收集30个事件
        eventCount++
        if (eventCount >= 30) {
          console.log('[测试2-验证失败] 达到事件收集上限')
          break
        }
      }

      // 验证最终结果存在
      expect(finalResult).not.toBeNull()

      if (finalResult) {
        console.log(`[测试2-验证失败] 最终结果 exitReason: ${finalResult.exitReason}`)

        // 验证metadata中包含默认链结果
        expect(finalResult.metadata).toBeDefined()
        expect(finalResult.metadata?.defaultChain).toBeDefined()

        const defaultChain = finalResult.metadata?.defaultChain as DefaultChainResult
        console.log(`[测试2-验证失败] 默认链结果:`, {
          finalOutcome: defaultChain.finalOutcome,
          rollbackTrigger: defaultChain.rollbackTrigger,
          success: defaultChain.success
        })

        // 验证回滚结果
        expect(defaultChain.finalOutcome).toBe('rollback')
        expect(defaultChain.success).toBe(false)
        expect(defaultChain.rollbackTrigger).toBeDefined()

        if (defaultChain.rollbackTrigger) {
          expect(defaultChain.rollbackTrigger.reason).toBeDefined()
          expect(['verify_failed', 'review_rejected', 'execution_failed', 'error']).toContain(defaultChain.rollbackTrigger.reason)
          console.log(`[测试2-验证失败] 回滚原因: ${defaultChain.rollbackTrigger.reason}`)
        }
      }
    })

    it('review 拒绝时进入 rollback，metadata 中包含 rollbackTrigger', async () => {
      const config = createMinimalConfig(true, false) // 验证通过，审查拒绝

      const events = queryLoop(
        config,
        [{ role: 'user', content: '测试任务：验证拒绝链（审查拒绝）' }],
        config.toolRegistry,
        {
          sessionId: 'test-session-fail-review',
          requestId: 'test-request-fail-review'
        }
      )

      let eventCount = 0
      let finalResult: QueryResult | null = null

      for await (const event of events) {
        collectedEvents.push(event)

        // 检查完成事件
        if (event.type === 'loop_finished' || event.type === 'loop_aborted') {
          finalResult = (event as any).result
          console.log(`[测试2-审查拒绝] 循环结束: ${event.type}, success: ${(event as any).success}`)
          break
        }

        // 安全限制：最多收集30个事件
        eventCount++
        if (eventCount >= 30) {
          console.log('[测试2-审查拒绝] 达到事件收集上限')
          break
        }
      }

      // 验证最终结果存在
      expect(finalResult).not.toBeNull()

      if (finalResult) {
        console.log(`[测试2-审查拒绝] 最终结果 exitReason: ${finalResult.exitReason}`)

        // 验证metadata中包含默认链结果
        expect(finalResult.metadata).toBeDefined()
        expect(finalResult.metadata?.defaultChain).toBeDefined()

        const defaultChain = finalResult.metadata?.defaultChain as DefaultChainResult
        console.log(`[测试2-审查拒绝] 默认链结果:`, {
          finalOutcome: defaultChain.finalOutcome,
          rollbackTrigger: defaultChain.rollbackTrigger,
          success: defaultChain.success
        })

        // 验证回滚结果
        expect(defaultChain.finalOutcome).toBe('rollback')
        expect(defaultChain.success).toBe(false)
        expect(defaultChain.rollbackTrigger).toBeDefined()

        if (defaultChain.rollbackTrigger) {
          expect(defaultChain.rollbackTrigger.reason).toBeDefined()
          expect(['verify_failed', 'review_rejected', 'execution_failed', 'error']).toContain(defaultChain.rollbackTrigger.reason)
          console.log(`[测试2-审查拒绝] 回滚原因: ${defaultChain.rollbackTrigger.reason}`)
        }
      }
    })
  })
})
