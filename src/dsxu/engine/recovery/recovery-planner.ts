/**
 * Recovery Planner 最小实现
 * 吸收 DSXU 的恢复决策结构化机制
 */

import {
  RecoveryAction,
  RecoveryReason,
  RecoveryContext,
  RecoveryInput,
  RecoveryDecision,
  RecoveryPlan,
} from './types'

/**
 * Recovery Planner 配置
 */
export interface RecoveryPlannerConfig {
  debug?: boolean
  logDecisions?: boolean
  maxRetries?: number
  maxReplans?: number
  retryThreshold?: number
  rollbackThreshold?: number
  humanInterventionThreshold?: number
  preferRetryForToolFailures?: boolean
}

/**
 * Recovery Planner 核心类
 * 吸收 DSXU 的 session/memory/compact/retrieval 进入决策机制
 */
export class RecoveryPlanner {
  private config: RecoveryPlannerConfig
  private decisionHistory: RecoveryDecision[] = []
  private failureCounts: Map<string, number> = new Map()

  constructor(config: RecoveryPlannerConfig = {}) {
    this.config = {
      debug: process.env.NODE_ENV === 'development',
      logDecisions: true,
      maxRetries: 3,
      maxReplans: 2,
      retryThreshold: 2,
      rollbackThreshold: 3,
      humanInterventionThreshold: 0.3,
      preferRetryForToolFailures: true,
      ...config,
    }
  }

  /**
   * 核心决策方法
   * 吸收 DSXU 的多源输入整合决策机制
   */
  decideRecoveryAction(
    context: RecoveryContext,
    input: RecoveryInput
  ): RecoveryDecision {
    // 分析失败原因
    const reason = this.analyzeFailureReason(input)

    // 基于原因和上下文选择动作
    const action = this.selectRecoveryAction(reason, context, input)

    // 计算置信度
    const confidence = this.calculateConfidence(reason, context, input)

    // 构建决策
    const decision: RecoveryDecision = {
      decisionId: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      reason,
      description: this.generateDecisionDescription(reason, action, context),
      context,
      input,
      confidence,
      expectedOutcome: this.generateExpectedOutcome(action, reason),
      prerequisites: this.generatePrerequisites(action, context),
      timestamp: Date.now(),
      metadata: {
        plannerVersion: '1.0.0',
        decisionSequence: this.decisionHistory.length + 1,
      },
    }

    // 记录决策
    this.decisionHistory.push(decision)

    if (this.config.logDecisions) {
      console.log(`[RecoveryPlanner] Decision made: ${decision.action} for ${decision.reason}`)
    }

    return decision
  }

  /**
   * 分析失败原因
   * 吸收 DSXU 的失败原因分类机制
   */
  private analyzeFailureReason(input: RecoveryInput): RecoveryReason {
    // 优先处理 verify 失败
    if (input.verifyResult && !input.verifyResult.passed) {
      return 'verify-failure'
    }

    // 处理 reviewer 拒绝
    if (input.reviewerResult && !input.reviewerResult.approved) {
      return 'reviewer-rejection'
    }

    // 处理工具执行失败
    if (input.toolResult && !input.toolResult.success) {
      return 'tool-failure'
    }

    const explicitBugType = input.bugRecord?.type ?? input.bugPattern?.bugType
    switch (explicitBugType) {
      case 'verify-failure':
      case 'reviewer-rejection':
      case 'tool-failure':
      case 'context-insufficiency':
      case 'graph-retrieval-miss':
      case 'memory-insufficiency':
      case 'resource-exhaustion':
      case 'configuration-error':
      case 'integration-failure':
        return explicitBugType
      case 'execution-timeout':
        return 'timeout'
    }

    // 处理上下文不足
    if (input.bugRecord?.context?.compactContext?.compactLevel === 'aggressive' ||
        (input.context && input.context.contextHygieneScore && input.context.contextHygieneScore < 0.3)) {
      return 'context-insufficiency'
    }

    // 处理重复失败
    if (input.failureHistory?.recentFailures && input.failureHistory.recentFailures > 3) {
      return 'repeated-failure'
    }

    // 默认返回未知
    return 'unknown'
  }

  /**
   * 选择恢复动作
   * 吸收 DSXU 的 session/memory/compact/retrieval 协同决策机制
   */
  private selectRecoveryAction(
    reason: RecoveryReason,
    context: RecoveryContext,
    input: RecoveryInput
  ): RecoveryAction {
    const sameTypeFailures = input.failureHistory?.sameTypeFailures ?? 0
    const recentFailures = input.failureHistory?.recentFailures ?? 0
    const retryThreshold = this.config.retryThreshold ?? 2
    const rollbackThreshold = this.config.rollbackThreshold ?? 3
    const humanThreshold = this.config.humanInterventionThreshold ?? 0.3
    const contextHygieneScore =
      context.contextHygieneScore ??
      (input as { context?: Partial<RecoveryContext> }).context?.contextHygieneScore ??
      input.bugRecord?.context?.compactContext?.hygieneScore
    const lowContextQuality =
      (contextHygieneScore !== undefined && contextHygieneScore <= humanThreshold) ||
      (context.memoryAvailability === 'low' && context.graphCoverage === 'minimal')

    if (lowContextQuality) {
      return 'ask-human'
    }

    // 基于失败原因选择动作
    switch (reason) {
      case 'verify-failure':
        // verify 失败：根据上下文选择重试或重新规划
        if (context.turnCount && context.turnCount < 2) {
          return 'retry'
        }
        if (sameTypeFailures > rollbackThreshold || recentFailures > rollbackThreshold) {
          return input.bugRecord?.severity === 'critical' ? 'escalate' : 'rollback'
        }
        if (sameTypeFailures >= rollbackThreshold && rollbackThreshold <= 2) {
          return input.bugRecord?.severity === 'critical' ? 'escalate' : 'rollback'
        }
        if (sameTypeFailures <= retryThreshold) {
          return 'retry'
        }
        return 'replan'

      case 'reviewer-rejection':
        // reviewer 拒绝：总是重新规划
        return 'replan'

      case 'tool-failure':
        // 工具失败：根据失败历史选择重试或中止
        if (this.config.preferRetryForToolFailures === false) {
          return 'abort'
        }
        if (input.bugRecord?.severity === 'critical') {
          return 'abort'
        }
        if (sameTypeFailures <= retryThreshold) {
          return 'retry'
        }
        return 'abort'

      case 'context-insufficiency':
        // 上下文不足：根据 compact 级别选择重新规划或请求人工
        if (context.compactLevel === 'aggressive') {
          return 'ask-human'
        }
        return 'replan'

      case 'repeated-failure':
        // 重复失败：回滚或请求人工
        if (context.taskPriority === 'critical') {
          return 'ask-human'
        }
        return 'rollback'

      default:
        // 未知失败：默认重新规划
        return 'replan'
    }
  }

  /**
   * 计算决策置信度
   * 吸收 DSXU 的置信度计算机制
   */
  private calculateConfidence(
    reason: RecoveryReason,
    context: RecoveryContext,
    input: RecoveryInput
  ): number {
    let confidence = 0.7 // 基础置信度

    // 基于原因调整
    switch (reason) {
      case 'verify-failure':
      case 'reviewer-rejection':
        confidence += 0.2 // 明确原因，置信度高
        break
      case 'tool-failure':
        confidence += 0.1
        break
      case 'context-insufficiency':
      case 'repeated-failure':
        confidence -= 0.1 // 复杂原因，置信度降低
        break
    }

    // 基于上下文质量调整
    if (context.contextHygieneScore && context.contextHygieneScore > 0.7) {
      confidence += 0.1
    }

    // 基于失败历史调整
    if (input.failureHistory?.recentFailures && input.failureHistory.recentFailures > 5) {
      confidence -= 0.2
    }

    // 限制在 0.0-1.0 范围内
    return Math.max(0.0, Math.min(1.0, confidence))
  }

  /**
   * 生成决策描述
   */
  private generateDecisionDescription(
    reason: RecoveryReason,
    action: RecoveryAction,
    context: RecoveryContext
  ): string {
    const taskType = context.taskType || 'unknown task'
    const priority = context.taskPriority || 'medium'

    return `${action} action selected for ${reason} in ${taskType} (priority: ${priority})`
  }

  /**
   * 生成预期结果
   */
  private generateExpectedOutcome(action: RecoveryAction, reason: RecoveryReason): string {
    const outcomes: Record<RecoveryAction, string> = {
      'retry': 'Successful execution after retry',
      'replan': 'New execution plan resolves the issue',
      'rollback': 'System restored to previous stable state',
      'abort': 'Task safely terminated to prevent further issues',
      'ask-human': 'Human intervention resolves the issue',
      'escalate': 'Issue escalated to higher-level handler',
      'wait': 'System waits for conditions to improve',
      'continue': 'Execution continues with noted issues',
    }

    return outcomes[action] || `Execute ${action} to handle ${reason}`
  }

  /**
   * 生成前置条件
   */
  private generatePrerequisites(action: RecoveryAction, context: RecoveryContext): string[] {
    const prerequisites: string[] = []

    // 通用前置条件
    prerequisites.push('System is in a recoverable state')

    // 动作特定前置条件
    switch (action) {
      case 'retry':
        prerequisites.push('Original operation is idempotent')
        prerequisites.push('Failure is transient')
        break
      case 'replan':
        prerequisites.push('Sufficient context available for replanning')
        prerequisites.push('Alternative approaches exist')
        break
      case 'rollback':
        prerequisites.push('Previous stable state is available')
        prerequisites.push('Rollback will not cause data loss')
        break
      case 'ask-human':
        prerequisites.push('Human operator is available')
        prerequisites.push('Issue description is clear')
        break
    }

    // 基于上下文的额外条件
    if (context.memoryAvailability === 'low') {
      prerequisites.push('Memory constraints acknowledged')
    }

    return prerequisites
  }

  /**
   * 生成恢复计划
   */
  generateRecoveryPlan(decision: RecoveryDecision): RecoveryPlan {
    const steps = this.generateRecoverySteps(decision)

    const plan: RecoveryPlan = {
      planId: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      decisionId: decision.decisionId,
      steps,
      estimatedDuration: this.estimatePlanDuration(steps),
      prerequisites: decision.prerequisites,
      fallbackAction: this.determineFallbackAction(decision.action),
      metadata: {
        generatedAt: Date.now(),
        plannerVersion: '1.0.0',
      },
    }

    return plan
  }

  /**
   * 生成恢复步骤
   */
  private generateRecoverySteps(decision: RecoveryDecision) {
    const steps = []

    // 第一步总是评估当前状态
    steps.push({
      stepId: `step-1-${Date.now()}`,
      action: `assess-current-state-for-${decision.action}`,
      description: 'Evaluate current system state and failure context',
      parameters: {
        decisionId: decision.decisionId,
        reason: decision.reason,
      },
      expectedOutcome: 'Clear understanding of failure scope',
    })

    // 基于动作添加特定步骤
    switch (decision.action) {
      case 'retry':
        steps.push({
          stepId: `step-2-${Date.now()}`,
          action: 'prepare-retry',
          description: 'Prepare environment for retry operation',
          parameters: {
            maxAttempts: this.config.maxRetries,
            backoffStrategy: 'exponential',
          },
          expectedOutcome: 'Environment ready for retry',
        })
        break

      case 'replan':
        if (decision.reason === 'context-insufficiency') {
          steps.push({
            stepId: `step-2-context-${Date.now()}`,
            action: 'gather-context',
            description: 'Gather missing source truth and compact-safe context before replanning',
            parameters: {
              requiredContextSize: decision.context.requiredContextSize,
              availableContextSize: decision.context.availableContextSize,
              memoryAvailability: decision.context.memoryAvailability,
            },
            expectedOutcome: 'Missing context gathered for a source-grounded recovery plan',
          })
        }
        steps.push({
          stepId: `step-2-${Date.now()}`,
          action: 'analyze-alternatives',
          description: 'Analyze alternative approaches and constraints',
          parameters: {
            maxReplans: this.config.maxReplans,
            considerFallbacks: true,
          },
          expectedOutcome: 'Alternative plan identified',
        })
        steps.push({
          stepId: `step-3-${Date.now()}`,
          action: 'select-replan-path',
          description: 'Select the safest recovery path before execution',
          parameters: {
            preserveEvidence: true,
            avoidRepeatFailure: true,
          },
          expectedOutcome: 'A concrete replanning path is selected',
        })
        break

      case 'rollback':
        steps.push({
          stepId: `step-2-${Date.now()}`,
          action: 'identify-rollback-point',
          description: 'Identify safe rollback point in history',
          parameters: {
            preserveData: true,
            validateIntegrity: true,
          },
          expectedOutcome: 'Safe rollback point identified',
        })
        break

      case 'ask-human':
        steps.push({
          stepId: `step-2-${Date.now()}`,
          action: 'prepare-human-request',
          description: 'Prepare clear issue description for human operator',
          parameters: {
            includeContext: true,
            suggestActions: true,
          },
          expectedOutcome: 'Human intervention request ready',
        })
        break
    }

    // 最后一步总是执行恢复动作
    steps.push({
      stepId: `step-final-${Date.now()}`,
      action: `execute-${decision.action}`,
      description: `Execute ${decision.action} recovery action`,
      parameters: {
        action: decision.action,
        reason: decision.reason,
      },
      expectedOutcome: decision.expectedOutcome || 'Recovery action completed',
    })

    return steps
  }

  /**
   * 估计计划持续时间
   */
  private estimatePlanDuration(steps: any[]): number {
    // 简单估计：每个步骤 1-5 秒
    const baseDuration = steps.length * 3000 // 3秒/步骤
    return baseDuration
  }

  /**
   * 确定备用动作
   */
  private determineFallbackAction(action: RecoveryAction): RecoveryAction {
    const fallbackMap: Record<RecoveryAction, RecoveryAction> = {
      'retry': 'replan',
      'replan': 'ask-human',
      'rollback': 'abort',
      'abort': 'ask-human',
      'ask-human': 'escalate',
      'escalate': 'abort',
      'wait': 'continue',
      'continue': 'ask-human',
    }

    return fallbackMap[action] || 'ask-human'
  }

  /**
   * 获取决策历史
   */
  getDecisionHistory(): RecoveryDecision[] {
    return [...this.decisionHistory]
  }

  getDecision(decisionId: string): RecoveryDecision | undefined {
    return this.decisionHistory.find((decision) => decision.decisionId === decisionId)
  }

  /**
   * 清除决策历史
   */
  clearDecisionHistory(): void {
    this.decisionHistory = []
  }
}
