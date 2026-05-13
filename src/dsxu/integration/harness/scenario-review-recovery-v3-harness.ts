import { createRecoveryBridge } from '../../engine/query-loop'
import type { RecoveryDecision } from '../../engine/query-loop'

/**
 * Review 拒绝恢复场景 Harness V3
 * 场景2：从 reviewer rejection 出发，触发恢复流程
 */
export class ScenarioReviewRecoveryV3Harness {
  private recoveryBridge: ReturnType<typeof createRecoveryBridge>

  constructor() {
    this.recoveryBridge = createRecoveryBridge()
  }

  /**
   * 模拟 Bug Brain 对评审拒绝的分类
   */
  private simulateBugBrainForReview(feedback: string, severity: 'low' | 'medium' | 'high'): {
    category: string
    priority: number
    suggestedActions: string[]
  } {
    // 简化的 Bug Brain 分类逻辑
    let category = 'code-quality-issue'
    let priority = 2 // 中等优先级

    if (feedback.toLowerCase().includes('security') || feedback.toLowerCase().includes('vulnerability')) {
      category = 'security-issue'
      priority = 3 // 高优先级
    } else if (feedback.toLowerCase().includes('performance') || feedback.toLowerCase().includes('optimization')) {
      category = 'performance-issue'
      priority = 2
    } else if (feedback.toLowerCase().includes('logic') || feedback.toLowerCase().includes('algorithm')) {
      category = 'logic-error'
      priority = 2
    } else if (feedback.toLowerCase().includes('style') || feedback.toLowerCase().includes('format')) {
      category = 'style-issue'
      priority = 1 // 低优先级
    }

    // 根据严重程度调整优先级
    if (severity === 'high') {
      priority = Math.min(3, priority + 1)
    } else if (severity === 'low') {
      priority = Math.max(1, priority - 1)
    }

    const suggestedActions = []
    if (category === 'security-issue') {
      suggestedActions.push('immediate-fix', 'security-review')
    } else if (category === 'performance-issue') {
      suggestedActions.push('optimize', 'benchmark-test')
    } else if (category === 'logic-error') {
      suggestedActions.push('reimplement', 'add-tests')
    } else {
      suggestedActions.push('refactor', 'improve-docs')
    }

    return { category, priority, suggestedActions }
  }

  /**
   * 模拟 Context Routing 获取相关上下文
   */
  private simulateContextRouting(
    bugCategory: string,
    filePath: string,
    feedback: string
  ): {
    routedContexts: Array<{ type: string; content: string; relevance: number }>
    bestMatch: { type: string; content: string; relevance: number } | null
  } {
    // 简化的 Context Routing 模拟
    const contexts = [
      {
        type: 'code-context',
        content: `File: ${filePath}, Category: ${bugCategory}`,
        relevance: 0.8,
      },
      {
        type: 'feedback-context',
        content: `Review feedback: ${feedback.substring(0, 100)}...`,
        relevance: 0.9,
      },
      {
        type: 'similar-issues',
        content: `Similar ${bugCategory} issues found in repository`,
        relevance: 0.6,
      },
      {
        type: 'best-practices',
        content: `Best practices for ${bugCategory.replace('-issue', '')} issues`,
        relevance: 0.7,
      },
    ]

    // 找到最相关的上下文
    const bestMatch = contexts.reduce((best, current) =>
      current.relevance > best.relevance ? current : best
    )

    return { routedContexts: contexts, bestMatch }
  }

  /**
   * 运行 review 拒绝恢复场景
   */
  runReviewRecoveryScenario(options: {
    filePath: string
    reviewerFeedback: string
    severity: 'low' | 'medium' | 'high'
    failureCount: number
    previousAttempts?: number
    sessionSummary?: string
  }): {
    scenario: string
    modules: string[]
    bugBrainResult: ReturnType<typeof this.simulateBugBrainForReview>
    contextRouting: ReturnType<typeof this.simulateContextRouting>
    recoveryDecision: RecoveryDecision
    dsxuInputsHit: string[]
    completed: boolean
  } {
    console.log('\n=== Review 拒绝恢复场景开始 ===')
    console.log(`文件: ${options.filePath}`)
    console.log(`评审反馈: ${options.reviewerFeedback.substring(0, 50)}...`)
    console.log(`严重程度: ${options.severity}`)
    console.log(`失败次数: ${options.failureCount}`)

    // 1. Bug Brain 分类
    const bugBrainResult = this.simulateBugBrainForReview(options.reviewerFeedback, options.severity)
    console.log(`Bug Brain 分类: ${bugBrainResult.category}`)
    console.log(`优先级: ${bugBrainResult.priority}`)
    console.log(`建议动作: ${bugBrainResult.suggestedActions.join(', ')}`)

    // 2. Context Routing
    const contextRouting = this.simulateContextRouting(
      bugBrainResult.category,
      options.filePath,
      options.reviewerFeedback
    )
    console.log(`Context Routing 最佳匹配: ${contextRouting.bestMatch?.type}`)
    console.log(`相关上下文数量: ${contextRouting.routedContexts.length}`)

    // 3. 构建恢复上下文
    const recoveryContext = {
      failureCount: options.failureCount,
      lastError: `Review rejected: ${options.reviewerFeedback.substring(0, 50)}...`,
      reviewer: {
        accepted: false,
        feedback: options.reviewerFeedback,
      },
      bugDescription: `Review issue in ${options.filePath}: ${bugBrainResult.category}`,
    }

    // 4. Recovery Planner 决策
    const recoveryDecision = this.recoveryBridge.getRecoveryDecisionForQueryLoop(recoveryContext)
    console.log(`Recovery 决策: ${recoveryDecision.action} (${recoveryDecision.reason})`)
    console.log(`置信度: ${recoveryDecision.confidence.toFixed(2)}`)

    // 5. 验证 DSXU 吸收线
    const dsxuInputsHit = []
    if (options.sessionSummary) {
      dsxuInputsHit.push('session/memory')
    }
    if (contextRouting.bestMatch && contextRouting.bestMatch.relevance > 0.7) {
      dsxuInputsHit.push('compact/retrieval')
    }
    dsxuInputsHit.push('verify/reviewer') // 总是命中，因为是review场景
    if (recoveryDecision.metadata && recoveryDecision.metadata.timestamp) {
      dsxuInputsHit.push('structured-decision')
    }

    const completed = ['replan', 'ask-human', 'rollback'].includes(recoveryDecision.action) &&
      recoveryDecision.confidence > 0.4

    console.log(`场景完成: ${completed ? '✅' : '❌'}`)
    console.log(`DSXU 吸收线命中: ${dsxuInputsHit.join(', ')}`)

    return {
      scenario: 'review-recovery-scenario',
      modules: ['Bug Brain', 'Context Routing', 'Recovery Planner', 'Session/Memory'],
      bugBrainResult,
      contextRouting,
      recoveryDecision,
      dsxuInputsHit,
      completed,
    }
  }

  /**
   * 运行多个测试用例
   */
  runTestSuite() {
    console.log('🧠 开始 Review 拒绝恢复场景测试套件\n')

    const testCases = [
      {
        name: '安全漏洞评审拒绝',
        filePath: '/src/auth/validator.ts',
        reviewerFeedback: 'Security vulnerability: potential SQL injection in user input validation',
        severity: 'high' as const,
        failureCount: 1,
        sessionSummary: '安全模块评审会话',
      },
      {
        name: '性能问题评审拒绝',
        filePath: '/src/data/processor.ts',
        reviewerFeedback: 'Performance issue: O(n²) algorithm could be optimized to O(n log n)',
        severity: 'medium' as const,
        failureCount: 2,
        sessionSummary: '数据处理模块评审',
      },
      {
        name: '代码风格评审拒绝',
        filePath: '/src/ui/components/Button.tsx',
        reviewerFeedback: 'Code style: inconsistent naming conventions and missing TypeScript types',
        severity: 'low' as const,
        failureCount: 1,
        sessionSummary: 'UI组件评审会话',
      },
    ]

    const results = []

    for (const testCase of testCases) {
      console.log(`\n📋 测试用例: ${testCase.name}`)
      const result = this.runReviewRecoveryScenario(testCase)
      results.push({
        testCase: testCase.name,
        ...result,
      })
    }

    console.log('\n✅ Review 拒绝恢复场景测试套件完成')
    return results
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new ScenarioReviewRecoveryV3Harness()
  harness.runTestSuite()
}