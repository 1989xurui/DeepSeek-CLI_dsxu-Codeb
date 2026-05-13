import { createRecoveryBridge } from '../../engine/query-loop'
import type { RecoveryDecision } from '../../engine/query-loop'

/**
 * Bug 修复场景 Harness V3
 * 场景1：从 bug / verify failure 出发，经过完整恢复流程
 */
export class ScenarioBugfixV3Harness {
  private recoveryBridge: ReturnType<typeof createRecoveryBridge>

  constructor() {
    this.recoveryBridge = createRecoveryBridge()
  }

  /**
   * 模拟 Bug Brain 分类
   */
  private simulateBugBrain(bugDescription: string, errorType: string): string {
    // 简化的 Bug Brain 分类逻辑
    if (errorType.includes('verify') || errorType.includes('test')) {
      return 'verification-failure'
    } else if (errorType.includes('tool') || errorType.includes('timeout')) {
      return 'tool-execution-failure'
    } else if (errorType.includes('syntax') || errorType.includes('compile')) {
      return 'syntax-error'
    } else if (errorType.includes('logic') || errorType.includes('algorithm')) {
      return 'logic-error'
    } else {
      return 'unknown-error'
    }
  }

  /**
   * 模拟 Graph Retrieval 上下文获取
   */
  private simulateGraphRetrieval(bugCategory: string, filePath?: string): {
    context: string
    retrievalScore: number
    relatedFiles: string[]
  } {
    // 简化的 Graph Retrieval 模拟
    const baseContext = `Bug category: ${bugCategory}`
    let retrievalScore = 0.7 // 基础分数

    if (filePath) {
      retrievalScore += 0.1
    }

    if (bugCategory === 'verification-failure') {
      retrievalScore += 0.1
    }

    const relatedFiles = filePath ? [
      filePath,
      `${filePath.replace('.ts', '.test.ts')}`,
      `${filePath.replace('.ts', '.spec.ts')}`
    ] : ['unknown.ts']

    return {
      context: `${baseContext}. Retrieved from graph with score ${retrievalScore.toFixed(2)}`,
      retrievalScore,
      relatedFiles: relatedFiles.slice(0, 2) // 最多返回2个相关文件
    }
  }

  /**
   * 运行 bug 修复场景
   */
  runBugfixScenario(options: {
    bugDescription: string
    errorType: string
    filePath?: string
    failureCount: number
    sessionId?: string
  }): {
    scenario: string
    modules: string[]
    bugCategory: string
    recoveryDecision: RecoveryDecision
    graphRetrieval: ReturnType<typeof this.simulateGraphRetrieval>
    dsxuInputsHit: string[]
    completed: boolean
  } {
    console.log('\n=== Bug 修复场景开始 ===')
    console.log(`Bug描述: ${options.bugDescription}`)
    console.log(`错误类型: ${options.errorType}`)
    console.log(`失败次数: ${options.failureCount}`)

    // 1. Bug Brain 分类
    const bugCategory = this.simulateBugBrain(options.bugDescription, options.errorType)
    console.log(`Bug Brain 分类: ${bugCategory}`)

    // 2. Graph Retrieval 获取上下文
    const graphRetrieval = this.simulateGraphRetrieval(bugCategory, options.filePath)
    console.log(`Graph Retrieval 分数: ${graphRetrieval.retrievalScore.toFixed(2)}`)
    console.log(`相关文件: ${graphRetrieval.relatedFiles.join(', ')}`)

    // 3. 构建恢复上下文
    const recoveryContext = {
      failureCount: options.failureCount,
      lastError: `${options.errorType}: ${options.bugDescription}`,
      verification: options.errorType.includes('verify') ? {
        passed: false,
        errors: [`${options.errorType} 失败`]
      } : undefined,
      bugDescription: options.bugDescription,
    }

    // 4. Recovery Planner 决策
    const recoveryDecision = this.recoveryBridge.getRecoveryDecisionForQueryLoop(recoveryContext)
    console.log(`Recovery 决策: ${recoveryDecision.action} (${recoveryDecision.reason})`)
    console.log(`置信度: ${recoveryDecision.confidence.toFixed(2)}`)

    // 5. 验证 DSXU 吸收线
    const dsxuInputsHit = []
    if (options.sessionId) {
      dsxuInputsHit.push('session/memory')
    }
    if (graphRetrieval.retrievalScore > 0.5) {
      dsxuInputsHit.push('compact/retrieval')
    }
    if (recoveryContext.verification) {
      dsxuInputsHit.push('verify/reviewer')
    }
    if (recoveryDecision.metadata && recoveryDecision.metadata.timestamp) {
      dsxuInputsHit.push('structured-decision')
    }

    const completed = ['retry', 'replan'].includes(recoveryDecision.action) &&
      recoveryDecision.confidence > 0.5

    console.log(`场景完成: ${completed ? '✅' : '❌'}`)
    console.log(`DSXU 吸收线命中: ${dsxuInputsHit.join(', ')}`)

    return {
      scenario: 'bug-fix-scenario',
      modules: ['Bug Brain', 'Graph Retrieval', 'Recovery Planner', 'Context Routing'],
      bugCategory,
      recoveryDecision,
      graphRetrieval,
      dsxuInputsHit,
      completed,
    }
  }

  /**
   * 运行多个测试用例
   */
  runTestSuite() {
    console.log('🚀 开始 Bug 修复场景测试套件\n')

    const testCases = [
      {
        name: '验证失败场景',
        bugDescription: '单元测试验证失败',
        errorType: 'verify-failure',
        filePath: '/src/utils/validator.ts',
        failureCount: 1,
        sessionId: 'session-verify-001',
      },
      {
        name: '工具执行失败场景',
        bugDescription: '代码格式化工具执行超时',
        errorType: 'tool-timeout',
        filePath: '/src/formatter/index.ts',
        failureCount: 2,
        sessionId: 'session-tool-002',
      },
      {
        name: '语法错误场景',
        bugDescription: 'TypeScript 编译错误',
        errorType: 'syntax-error',
        filePath: '/src/core/processor.ts',
        failureCount: 1,
        sessionId: 'session-syntax-003',
      },
    ]

    const results = []

    for (const testCase of testCases) {
      console.log(`\n📋 测试用例: ${testCase.name}`)
      const result = this.runBugfixScenario(testCase)
      results.push({
        testCase: testCase.name,
        ...result,
      })
    }

    console.log('\n✅ Bug 修复场景测试套件完成')
    return results
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new ScenarioBugfixV3Harness()
  harness.runTestSuite()
}