/**
 * Recovery Planner 集成模块
 * 吸收 DSXU 的模块间恢复决策协调机制
 */

import { RecoveryPlanner, RecoveryPlannerConfig } from './recovery-planner'
import {
  RecoveryContext,
  RecoveryInput,
  RecoveryDecision,
  RecoveryPlan,
} from './types'
import { BugRecord, BugPattern, FixPattern } from '../bug-brain/types'
import { defaultBugBrain } from '../bug-brain'

/**
 * 恢复决策工厂
 * 吸收 DSXU 的决策上下文构建机制
 */
export class RecoveryDecisionFactory {
  private planner: RecoveryPlanner

  constructor(config: RecoveryPlannerConfig = {}) {
    this.planner = new RecoveryPlanner(config)
  }

  /**
   * 基于 Bug Record 创建恢复决策
   */
  createDecisionFromBugRecord(
    bugRecord: BugRecord,
    additionalContext?: Partial<RecoveryContext>
  ): RecoveryDecision {
    const context = this.buildRecoveryContext(bugRecord, additionalContext)
    const input = this.buildRecoveryInputFromBugRecord(bugRecord)

    return this.planner.decideRecoveryAction(context, input)
  }

  /**
   * 基于 Bug Pattern 创建恢复决策
   */
  createDecisionFromBugPattern(
    bugPattern: BugPattern,
    additionalContext?: Partial<RecoveryContext>
  ): RecoveryDecision {
    const context = this.buildRecoveryContextFromPattern(bugPattern, additionalContext)
    const input = this.buildRecoveryInputFromBugPattern(bugPattern)

    return this.planner.decideRecoveryAction(context, input)
  }

  /**
   * 基于 Fix Pattern 创建恢复计划
   */
  createPlanFromFixPattern(
    fixPattern: FixPattern,
    decision: RecoveryDecision
  ): RecoveryPlan {
    // 将 fix pattern 转换为 recovery plan
    const plan = this.planner.generateRecoveryPlan(decision)

    // 增强 plan 步骤
    if (fixPattern.steps && fixPattern.steps.length > 0) {
      // 合并 fix pattern 步骤
      plan.steps = [
        ...fixPattern.steps.map((step, index) => ({
          stepId: `fix-step-${index}-${Date.now()}`,
          action: step.action,
          description: step.description,
          parameters: step.parameters,
          expectedOutcome: step.expectedOutcome,
        })),
        ...plan.steps,
      ]
    }

    return plan
  }

  /**
   * 构建恢复上下文
   * 吸收 DSXU 的上下文提取和增强机制
   */
  private buildRecoveryContext(
    bugRecord: BugRecord,
    additionalContext?: Partial<RecoveryContext>
  ): RecoveryContext {
    const baseContext: RecoveryContext = {
      // 从 bug record 提取 session/task 信息
      sessionId: bugRecord.sessionId,
      taskId: bugRecord.taskId,

      // 从 bug context 提取信息
      ...this.extractContextFromBugContext(bugRecord.context),

      // 时间戳
      timestamp: Date.now(),
    }

    // 合并额外上下文
    return {
      ...baseContext,
      ...additionalContext,
    }
  }

  /**
   * 从 Bug Pattern 构建恢复上下文
   */
  private buildRecoveryContextFromPattern(
    bugPattern: BugPattern,
    additionalContext?: Partial<RecoveryContext>
  ): RecoveryContext {
    const baseContext: RecoveryContext = {
      // 基于 pattern 特征设置上下文质量
      memoryAvailability: bugPattern.frequency > 5 ? 'high' : 'medium',
      graphCoverage: bugPattern.exampleBugIds.length > 3 ? 'full' : 'partial',
      contextHygieneScore: this.calculatePatternHygieneScore(bugPattern),

      timestamp: Date.now(),
    }

    return {
      ...baseContext,
      ...additionalContext,
    }
  }

  /**
   * 从 Bug Context 提取信息
   */
  private extractContextFromBugContext(bugContext: any): Partial<RecoveryContext> {
    if (!bugContext) return {}

    const extracted: Partial<RecoveryContext> = {}

    // 提取 session 上下文
    if (bugContext.sessionContext) {
      extracted.sessionId = bugContext.sessionContext.sessionId
      extracted.taskId = bugContext.sessionContext.taskId
      extracted.conversationId = bugContext.sessionContext.conversationId
      extracted.memorySummary = bugContext.sessionContext.memorySummary
      extracted.episodeId = bugContext.sessionContext.episodeId
    }

    // 提取 compact 上下文
    if (bugContext.compactContext) {
      extracted.compactLevel = bugContext.compactContext.compactLevel
      extracted.contextHygieneScore = bugContext.compactContext.hygieneScore
      extracted.availableContextSize = bugContext.compactContext.compactedContextSize
      extracted.requiredContextSize = bugContext.compactContext.originalContextSize
    }

    // 提取检索上下文
    if (bugContext.retrievalContext) {
      extracted.retrievalQuery = bugContext.retrievalContext.query
      extracted.retrievedNodes = bugContext.retrievalContext.retrievedNodes
      extracted.retrievalRelevance = bugContext.retrievalContext.relevanceScores?.[0]
    }

    return extracted
  }

  /**
   * 计算 Pattern 卫生分数
   */
  private calculatePatternHygieneScore(bugPattern: BugPattern): number {
    // 基于 pattern 特征计算卫生分数
    let score = 0.5 // 基础分数

    // 症状越明确，分数越高
    if (bugPattern.commonSymptoms.length > 0) {
      score += Math.min(0.3, bugPattern.commonSymptoms.length * 0.1)
    }

    // 频率适中，分数较高（既不是偶发也不是泛滥）
    if (bugPattern.frequency >= 3 && bugPattern.frequency <= 10) {
      score += 0.2
    }

    // 严重程度分布均匀，分数较高
    const severityValues = Object.values(bugPattern.severityDistribution)
    const hasMultipleSeverities = severityValues.filter(v => v > 0).length > 1
    if (hasMultipleSeverities) {
      score += 0.1
    }

    return Math.min(1.0, score)
  }

  /**
   * 从 Bug Record 构建恢复输入
   */
  private buildRecoveryInputFromBugRecord(bugRecord: BugRecord): RecoveryInput {
    // 获取相关 bug 分析
    const bugAnalysis = defaultBugBrain.analyzeBug(bugRecord.id)

    // 获取失败历史
    const failureHistory = this.calculateFailureHistory(bugRecord)

    return {
      bugRecord,
      bugPattern: bugAnalysis?.potentialPatterns?.[0],
      fixPattern: bugAnalysis?.recommendedFixPatterns?.[0],
      bugAnalysis,
      failureHistory,
      metadata: {
        source: 'bug-record',
        extractedAt: Date.now(),
      },
    }
  }

  /**
   * 从 Bug Pattern 构建恢复输入
   */
  private buildRecoveryInputFromBugPattern(bugPattern: BugPattern): RecoveryInput {
    // 获取示例 bug 记录
    const exampleBugId = bugPattern.exampleBugIds[0]
    const exampleBug = exampleBugId ? defaultBugBrain.getBug(exampleBugId) : undefined

    // 获取相关 fix patterns
    const fixPatterns = Array.from((defaultBugBrain as any).fixPatterns.values())
    const relatedFixPattern = fixPatterns.find(f => f.bugPatternId === bugPattern.patternId)

    return {
      bugRecord: exampleBug,
      bugPattern,
      fixPattern: relatedFixPattern,
      failureHistory: {
        recentFailures: bugPattern.frequency,
        sameTypeFailures: bugPattern.frequency,
        failurePattern: bugPattern.patternId,
      },
      metadata: {
        source: 'bug-pattern',
        patternFrequency: bugPattern.frequency,
      },
    }
  }

  /**
   * 计算失败历史
   */
  private calculateFailureHistory(bugRecord: BugRecord) {
    const allBugs = defaultBugBrain.getAllBugs()

    // 计算最近失败次数（最近1小时内）
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const recentFailures = allBugs.filter(b =>
      b.timestamp > oneHourAgo
    ).length

    // 计算同类型失败次数
    const sameTypeFailures = allBugs.filter(b =>
      b.type === bugRecord.type
    ).length

    return {
      recentFailures,
      sameTypeFailures,
      lastFailureTime: Math.max(...allBugs.map(b => b.timestamp)),
      failurePattern: bugRecord.type,
    }
  }

  /**
   * 获取决策历史
   */
  getDecisionHistory(): RecoveryDecision[] {
    return this.planner.getDecisionHistory()
  }

  /**
   * 生成恢复计划
   */
  generateRecoveryPlan(decision: RecoveryDecision): RecoveryPlan {
    return this.planner.generateRecoveryPlan(decision)
  }
}

/**
 * 默认恢复决策工厂实例
 */
export const defaultRecoveryDecisionFactory = new RecoveryDecisionFactory({
  debug: process.env.NODE_ENV === 'development',
  logDecisions: true,
})

/**
 * 恢复工厂别名（兼容性导出）
 */
export const recoveryFactory = defaultRecoveryDecisionFactory