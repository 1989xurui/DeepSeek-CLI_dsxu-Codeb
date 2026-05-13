import { createRecoveryBridge } from '../../engine/query-loop'
import type { RecoveryDecision } from '../../engine/recovery/recovery-types-v3'

/**
 * Query Loop Recovery V1 Harness
 * 验证query-loop与Recovery Bridge的联动
 */
export class QueryLoopRecoveryV1Harness {
  private recoveryBridge: ReturnType<typeof createRecoveryBridge>

  constructor() {
    this.recoveryBridge = createRecoveryBridge()
  }

  /**
   * 模拟工具失败场景
   */
  simulateToolFailureScenario(options: {
    toolName: string
    errorMessage: string
    failureCount: number
  }): {
    scenario: string
    context: any
    decision: RecoveryDecision
    analysis: {
      actionType: string
      reasonType: string
      confidenceLevel: 'low' | 'medium' | 'high'
      shouldRetry: boolean
    }
  } {
    console.log('\n=== 工具失败场景模拟 ===')
    console.log(`工具: ${options.toolName}`)
    console.log(`错误: ${options.errorMessage}`)
    console.log(`失败次数: ${options.failureCount}`)

    const context = {
      failureCount: options.failureCount,
      lastError: options.errorMessage,
      bugDescription: `${options.toolName}工具执行失败: ${options.errorMessage}`
    }

    const decision = this.recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    // 分析决策
    const confidenceLevel = decision.confidence < 0.4 ? 'low' : decision.confidence < 0.7 ? 'medium' : 'high'
    const shouldRetry = decision.action === 'retry'

    const analysis = {
      actionType: decision.action,
      reasonType: decision.reason,
      confidenceLevel,
      shouldRetry
    }

    console.log(`恢复决策: ${decision.action} (${decision.reason})`)
    console.log(`置信度: ${decision.confidence} (${confidenceLevel})`)
    console.log(`是否重试: ${shouldRetry ? '是' : '否'}`)

    return {
      scenario: 'tool-failure-scenario',
      context,
      decision,
      analysis
    }
  }

  /**
   * 模拟验证失败场景
   */
  simulateVerificationFailureScenario(options: {
    testType: string
    errors: string[]
    failureCount: number
  }): {
    scenario: string
    context: any
    decision: RecoveryDecision
    analysis: {
      isVerifyFailure: boolean
      suggestedAction: string
    }
  } {
    console.log('\n=== 验证失败场景模拟 ===')
    console.log(`测试类型: ${options.testType}`)
    console.log(`错误数量: ${options.errors.length}`)
    console.log(`失败次数: ${options.failureCount}`)

    const context = {
      failureCount: options.failureCount,
      lastError: options.errors[0] || '验证失败',
      verification: {
        passed: false,
        errors: options.errors
      },
      bugDescription: `${options.testType}验证失败: ${options.errors[0]?.substring(0, 50)}...`
    }

    const decision = this.recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    const isVerifyFailure = decision.reason === 'verify-failure'
    const suggestedAction = decision.action

    console.log(`恢复决策: ${decision.action} (${decision.reason})`)
    console.log(`是否为验证失败: ${isVerifyFailure ? '是' : '否'}`)
    console.log(`建议动作: ${suggestedAction}`)

    return {
      scenario: 'verification-failure-scenario',
      context,
      decision,
      analysis: {
        isVerifyFailure,
        suggestedAction
      }
    }
  }

  /**
   * 模拟上下文不足场景
   */
  simulateContextInsufficiencyScenario(options: {
    taskDescription: string
    missingInfo: string[]
    failureCount: number
  }): {
    scenario: string
    context: any
    decision: RecoveryDecision
    analysis: {
      isContextIssue: boolean
      requiresHuman: boolean
    }
  } {
    console.log('\n=== 上下文不足场景模拟 ===')
    console.log(`任务描述: ${options.taskDescription}`)
    console.log(`缺失信息: ${options.missingInfo.join(', ')}`)

    const context = {
      failureCount: options.failureCount,
      lastError: `上下文信息不足: 缺失 ${options.missingInfo.join(', ')}`,
      bugDescription: `任务"${options.taskDescription}"上下文不足，无法继续`
    }

    const decision = this.recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    const isContextIssue = decision.reason === 'context-insufficiency'
    const requiresHuman = decision.action === 'ask-human'

    console.log(`恢复决策: ${decision.action} (${decision.reason})`)
    console.log(`是否为上下文问题: ${isContextIssue ? '是' : '否'}`)
    console.log(`是否需要人工介入: ${requiresHuman ? '是' : '否'}`)

    return {
      scenario: 'context-insufficiency-scenario',
      context,
      decision,
      analysis: {
        isContextIssue,
        requiresHuman
      }
    }
  }

  /**
   * 运行测试套件
   */
  runTestSuite() {
    console.log('🔄 开始 Query Loop Recovery V1 测试套件\n')

    const results = []

    // 测试1: 单次工具失败
    results.push(this.simulateToolFailureScenario({
      toolName: 'Bash',
      errorMessage: 'Permission denied: cannot execute script',
      failureCount: 1
    }))

    // 测试2: 多次工具失败
    results.push(this.simulateToolFailureScenario({
      toolName: 'Edit',
      errorMessage: 'File not found: /path/to/file.ts',
      failureCount: 3
    }))

    // 测试3: 验证失败
    results.push(this.simulateVerificationFailureScenario({
      testType: '单元测试',
      errors: ['Assertion failed: expected 5 but got 3', 'Test timeout after 5000ms'],
      failureCount: 2
    }))

    // 测试4: 上下文不足
    results.push(this.simulateContextInsufficiencyScenario({
      taskDescription: '重构用户认证模块',
      missingInfo: ['当前用户权限配置', '现有认证流程文档'],
      failureCount: 1
    }))

    // 分析结果
    console.log('\n📊 测试套件结果分析:')
    console.log(`总测试场景: ${results.length}`)

    const actionDistribution: Record<string, number> = {}
    const reasonDistribution: Record<string, number> = {}

    for (const result of results) {
      actionDistribution[result.decision.action] = (actionDistribution[result.decision.action] || 0) + 1
      reasonDistribution[result.decision.reason] = (reasonDistribution[result.decision.reason] || 0) + 1
    }

    console.log('\n动作分布:')
    for (const [action, count] of Object.entries(actionDistribution)) {
      console.log(`  ${action}: ${count}次`)
    }

    console.log('\n原因分布:')
    for (const [reason, count] of Object.entries(reasonDistribution)) {
      console.log(`  ${reason}: ${count}次`)
    }

    console.log('\n✅ Query Loop Recovery V1 测试套件完成')
    return results
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new QueryLoopRecoveryV1Harness()
  harness.runTestSuite()
}