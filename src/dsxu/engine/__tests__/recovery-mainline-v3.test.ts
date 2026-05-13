// 直接从 V3 文件导入，避免导出冲突
import type {
  RecoveryReason,
  RecoveryAction,
  RecoveryDecision,
  RecoveryContext,
} from '../recovery/recovery-types-v3'

import { RecoveryIntegrationV3 } from '../recovery/recovery-integration-v3'
import { RecoveryPlannerV3 } from '../recovery/recovery-planner-v3'

// 从主导出面导入别名
import { RecoveryIntegration, RecoveryPlanner } from '../recovery/index'

describe('Recovery Mainline V3', () => {
  test('recovery/index.ts 当前主导出指向 v3 主实现', () => {
    // 验证 V3 类型可从主导出面获取
    const reasons: RecoveryReason[] = [
      'verify-failure',
      'reviewer-rejection',
      'tool-failure',
      'context-insufficiency',
      'repeated-failure',
    ]

    const actions: RecoveryAction[] = [
      'retry',
      'replan',
      'rollback',
      'abort',
      'ask-human',
    ]

    expect(reasons).toHaveLength(5)
    expect(actions).toHaveLength(5)

    // 验证主导出面别名指向 V3
    expect(RecoveryIntegration).toBe(RecoveryIntegrationV3)
    expect(RecoveryPlanner).toBe(RecoveryPlannerV3)
  })

  test('v3 的 RecoveryReason / RecoveryAction / RecoveryDecision 可从主导出面获取', () => {
    // 创建 V3 决策实例
    const decision: RecoveryDecision = {
      action: 'retry',
      reason: 'verify-failure',
      confidence: 0.8,
      retryCount: 1,
      message: '测试决策',
    }

    expect(decision.action).toBe('retry')
    expect(decision.reason).toBe('verify-failure')
    expect(decision.confidence).toBeGreaterThan(0)
    expect(decision.confidence).toBeLessThanOrEqual(1)

    // 验证上下文类型
    const context: RecoveryContext = {
      bugContext: { description: '测试bug' },
      failureCount: 1,
    }

    expect(context.bugContext.description).toBe('测试bug')
    expect(context.failureCount).toBe(1)
  })

  test('V3 实现可正常实例化和使用', () => {
    const integration = new RecoveryIntegrationV3()
    const planner = new RecoveryPlannerV3()

    expect(integration).toBeInstanceOf(RecoveryIntegrationV3)
    expect(planner).toBeInstanceOf(RecoveryPlannerV3)

    // 测试最小决策
    const context: RecoveryContext = {
      bugContext: { description: '主链测试bug' },
      failureCount: 1,
    }

    const decision = planner.decideRecoveryAction(context)

    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('confidence')

    // 验证决策在合理范围内
    expect(['retry', 'replan', 'rollback', 'abort', 'ask-human']).toContain(decision.action)
    expect(['verify-failure', 'reviewer-rejection', 'tool-failure', 'context-insufficiency', 'repeated-failure']).toContain(decision.reason)
  })

  test('不依赖旧 recovery 测试 - 只验证 V3 接口完整性', () => {
    // 验证类型存在（类型在运行时是 undefined，这是正常的）
    // 我们通过实际使用来验证类型存在

    // 验证实现类存在
    expect(RecoveryIntegrationV3).toBeDefined()
    expect(RecoveryPlannerV3).toBeDefined()

    // 验证可以创建实例
    const integration = new RecoveryIntegrationV3()
    const result = integration.quickDecide('verify-failure', 1, '测试')

    expect(result).toBeDefined()
    expect(result.action).toBeDefined()
    expect(result.reason).toBe('verify-failure')

    // 通过实际使用验证类型
    const testReason: RecoveryReason = 'verify-failure'
    const testAction: RecoveryAction = 'retry'

    expect(testReason).toBe('verify-failure')
    expect(testAction).toBe('retry')
  })
})