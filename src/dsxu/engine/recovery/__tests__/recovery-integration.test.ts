/**
 * Recovery Integration 测试
 * F-4NN 任务：验证完整恢复流程
 */

import { RecoveryPlannerV2 } from '../recovery-planner-v2'
import { RecoveryIntegrationV2 } from '../recovery-integration-v2'

describe('Recovery Integration Flow', () => {
  let planner: RecoveryPlannerV2
  let integration: RecoveryIntegrationV2

  beforeEach(() => {
    planner = new RecoveryPlannerV2()
    integration = new RecoveryIntegrationV2()
  })

  test('should handle full recovery flow for verify-failure', () => {
    // 1. Bug Brain 输出
    const bugBrainOutput = {
      bugId: 'flow-1',
      bugType: 'verify-failure',
      severity: 'medium',
      source: 'verify',
      description: 'Test verification failed in flow',
      context: { test: 'flow', attempt: 1 }
    }

    // 2. Session 上下文
    const sessionContext = {
      sessionId: 'session-flow-123',
      memorySummary: 'Memory summary for flow test',
      graphRetrieval: {
        nodes: [
          { id: 'node-1', type: 'file', content: 'test.js' },
          { id: 'node-2', type: 'test', content: 'test.spec.js' }
        ],
        edges: [
          { from: 'node-1', to: 'node-2', type: 'depends' }
        ]
      }
    }

    // 3. 集成处理
    const decision = integration.processBugWithContext(bugBrainOutput, sessionContext)

    // 4. 验证决策
    expect(decision.action).toBe('retry')
    expect(decision.reason).toBe('verify-failure')
    expect(decision.metadata).toBeDefined()
    expect(decision.metadata?.hasSessionContext).toBe(true)
    expect(decision.metadata?.hasMemorySummary).toBe(true)
    expect(decision.metadata?.hasCompactRetrieval).toBe(true)
    expect(decision.metadata?.recentFailures).toBe(0)
    expect(decision.metadata?.sameTypeFailures).toBe(0)
  })

  test('should handle escalation from retry to replan', () => {
    // 第一次失败：retry
    const firstBug = {
      bugId: 'escalate-1',
      bugType: 'verify-failure',
      severity: 'medium',
      source: 'verify',
      description: 'First verification failure',
      context: { attempt: 1 }
    }

    const firstDecision = integration.processBugWithContext(firstBug)
    expect(firstDecision.action).toBe('retry')

    // 第二次失败：replan
    const secondBug = {
      bugId: 'escalate-2',
      type: 'verify-failure',
      bugType: 'verify-failure',
      severity: 'high',
      source: 'verify',
      description: 'Second verification failure',
      context: { attempt: 2 }
    }

    const failureHistory = {
      recentFailures: 3,
      sameTypeFailures: 3
    }

    const secondDecision = planner.decideRecoveryAction({
      bugRecord: secondBug,
      failureHistory
    })

    expect(secondDecision.action).toBe('replan')
    expect(secondDecision.reason).toBe('verify-failure')
    expect(secondDecision.confidence).toBeGreaterThan(0.7) // 高置信度
  })

  test('should handle ask-human with insufficient context', () => {
    const bugBrainOutput = {
      bugId: 'human-1',
      bugType: 'context-insufficiency',
      severity: 'medium',
      source: 'session',
      description: 'Cannot decide without human input',
      context: { missing: 'critical-info' }
    }

    const decision = integration.processBugWithContext(bugBrainOutput)
    expect(decision.action).toBe('ask-human')
    expect(decision.reason).toBe('context-insufficiency')
    expect(decision.metadata?.hasCompactRetrieval).toBe(false)
  })

  test('should handle reviewer-rejection with high severity', () => {
    const bugBrainOutput = {
      bugId: 'reviewer-1',
      bugType: 'reviewer-rejection',
      severity: 'high',
      source: 'reviewer',
      description: 'Reviewer rejected with critical feedback',
      context: { reviewer: 'dsxu', feedback: 'logic-error' }
    }

    const decision = integration.processBugWithContext(bugBrainOutput)
    expect(decision.action).toBe('replan')
    expect(decision.reason).toBe('reviewer-rejection')
    expect(decision.confidence).toBeGreaterThan(0.8)
  })

  test('should handle unknown bug type with fallback', () => {
    const bugBrainOutput = {
      bugId: 'unknown-1',
      bugType: 'unknown-error',
      severity: 'low',
      source: 'system',
      description: 'Unknown error occurred',
      context: { error: 'unexpected' }
    }

    const decision = integration.processBugWithContext(bugBrainOutput)
    expect(decision.action).toBe('ask-human')
    expect(decision.reason).toBe('unknown-error')
    expect(decision.confidence).toBeLessThanOrEqual(0.5) // 低置信度
  })
})
