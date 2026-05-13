/**
 * Recovery Planner V2 最小测试
 * F-4NN 任务：完全切断旧测试，新建最小实现
 */

import { RecoveryPlannerV2 } from '../recovery-planner-v2'
import { RecoveryIntegrationV2 } from '../recovery-integration-v2'

describe('RecoveryPlannerV2', () => {
  let planner: RecoveryPlannerV2

  beforeEach(() => {
    planner = new RecoveryPlannerV2()
  })

  test('should handle verify-failure with retry', () => {
    const input = {
      bugRecord: {
        id: 'test-1',
        type: 'verify-failure',
        severity: 'medium',
        source: 'verify',
        description: 'Test verification failed',
        context: { test: true },
        timestamp: Date.now()
      },
      failureHistory: {
        recentFailures: 1,
        sameTypeFailures: 1
      }
    }

    const decision = planner.decideRecoveryAction(input)
    expect(decision.action).toBe('retry')
    expect(decision.reason).toBe('verify-failure')
    expect(decision.confidence).toBeGreaterThan(0)
  })

  test('should handle repeated verify-failure with replan', () => {
    const input = {
      bugRecord: {
        id: 'test-2',
        type: 'verify-failure',
        severity: 'high',
        source: 'verify',
        description: 'Repeated verification failed',
        context: { test: true },
        timestamp: Date.now()
      },
      failureHistory: {
        recentFailures: 3,
        sameTypeFailures: 3
      }
    }

    const decision = planner.decideRecoveryAction(input)
    expect(decision.action).toBe('replan')
    expect(decision.reason).toBe('verify-failure')
  })

  test('should handle reviewer-rejection with replan', () => {
    const input = {
      bugRecord: {
        id: 'test-3',
        type: 'reviewer-rejection',
        severity: 'high',
        source: 'reviewer',
        description: 'Reviewer rejected the change',
      context: { reviewer: 'dsxu' },
        timestamp: Date.now()
      }
    }

    const decision = planner.decideRecoveryAction(input)
    expect(decision.action).toBe('replan')
    expect(decision.reason).toBe('reviewer-rejection')
  })

  test('should handle context-insufficiency with ask-human when no retrieval', () => {
    const input = {
      bugRecord: {
        id: 'test-4',
        type: 'context-insufficiency',
        severity: 'medium',
        source: 'session',
        description: 'Insufficient context for decision',
        context: { missing: 'context' },
        timestamp: Date.now()
      }
    }

    const decision = planner.decideRecoveryAction(input)
    expect(decision.action).toBe('ask-human')
    expect(decision.reason).toBe('context-insufficiency')
  })
})

describe('RecoveryIntegrationV2', () => {
  let integration: RecoveryIntegrationV2

  beforeEach(() => {
    integration = new RecoveryIntegrationV2()
  })

  test('should integrate bug brain output with session context', () => {
    const bugBrainOutput = {
      bugId: 'integration-1',
      bugType: 'verify-failure',
      severity: 'medium',
      source: 'verify',
      description: 'Integration test failure',
      context: { test: 'integration' }
    }

    const sessionContext = {
      sessionId: 'session-123',
      memorySummary: 'Test memory summary',
      graphRetrieval: { nodes: [], edges: [] }
    }

    const decision = integration.processBugWithContext(bugBrainOutput, sessionContext)
    expect(decision.action).toBeDefined()
    expect(decision.reason).toBe('verify-failure')
    expect(decision.metadata).toBeDefined()
    expect(decision.metadata?.hasSessionContext).toBe(true)
    expect(decision.metadata?.hasMemorySummary).toBe(true)
    expect(decision.metadata?.hasCompactRetrieval).toBe(true)
  })

  test('should handle bug brain output without session context', () => {
    const bugBrainOutput = {
      bugId: 'integration-2',
      bugType: 'reviewer-rejection',
      severity: 'high',
      source: 'reviewer',
      description: 'Reviewer rejected without context',
      context: { reviewer: 'dsxu' }
    }

    const decision = integration.processBugWithContext(bugBrainOutput)
    expect(decision.action).toBe('replan')
    expect(decision.reason).toBe('reviewer-rejection')
    expect(decision.metadata?.hasSessionContext).toBe(false)
  })
})
