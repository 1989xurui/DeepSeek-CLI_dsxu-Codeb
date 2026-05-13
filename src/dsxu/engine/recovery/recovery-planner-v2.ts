/**
 * Recovery Planner V2 - 最小实现
 * F-4NN 任务：完全切断旧测试，新建最小实现
 */

import {
  RecoveryReason,
  RecoveryAction,
  RecoveryDecision,
  RecoveryInput,
  RecoveryPlannerOptions
} from './recovery-types-v2'

export class RecoveryPlannerV2 {
  private options: Required<RecoveryPlannerOptions>

  constructor(options: RecoveryPlannerOptions = {}) {
    this.options = {
      debug: false,
      retryThreshold: 2,
      rollbackThreshold: 3,
      humanInterventionThreshold: 5,
      ...options
    }
  }

  /**
   * 核心决策函数
   */
  decideRecoveryAction(input: RecoveryInput): RecoveryDecision {
    const { bugRecord, failureHistory, sessionContext } = input
    const reason = bugRecord.type as RecoveryReason

    // DSXU 吸收线：session / summary / memory 进入恢复决策
    const hasSessionContext = !!sessionContext?.sessionId
    const hasMemorySummary = !!sessionContext?.memorySummary
    const hasGraphRetrieval = !!sessionContext?.graphRetrieval

    // DSXU 吸收线：compact / retrieval 进入恢复决策
    const hasCompactRetrieval = hasGraphRetrieval

    // DSXU 吸收线：verify / reviewer / rollback 协同进入恢复决策
    const isVerifyFailure = reason === 'verify-failure'
    const isReviewerRejection = reason === 'reviewer-rejection'
    const isRepeatedFailure = reason === 'repeated-failure'

    // DSXU 吸收线：决策结果结构化记录
    const metadata: Record<string, any> = {
      timestamp: Date.now(),
      hasSessionContext,
      hasMemorySummary,
      hasCompactRetrieval,
      recentFailures: failureHistory?.recentFailures || 0,
      sameTypeFailures: failureHistory?.sameTypeFailures || 0
    }

    // 决策逻辑
    let action: RecoveryAction
    let confidence = 0.8 // 默认置信度

    switch (reason) {
      case 'verify-failure':
        if (failureHistory?.recentFailures && failureHistory.recentFailures >= this.options.retryThreshold) {
          action = 'replan'
          confidence = 0.9
        } else {
          action = 'retry'
          confidence = 0.7
        }
        break

      case 'reviewer-rejection':
        action = 'replan'
        confidence = 0.85
        break

      case 'tool-failure':
        if (failureHistory?.sameTypeFailures && failureHistory.sameTypeFailures >= 2) {
          action = 'abort'
          confidence = 0.95
        } else {
          action = 'retry'
          confidence = 0.6
        }
        break

      case 'context-insufficiency':
        if (hasCompactRetrieval) {
          action = 'replan'
          confidence = 0.75
        } else {
          action = 'ask-human'
          confidence = 0.9
        }
        break

      case 'repeated-failure':
        if (failureHistory?.recentFailures && failureHistory.recentFailures >= this.options.rollbackThreshold) {
          action = 'rollback'
          confidence = 0.95
        } else {
          action = 'ask-human'
          confidence = 0.85
        }
        break

      default:
        action = 'ask-human'
        confidence = 0.5
    }

    // 如果失败次数超过人工干预阈值，强制 ask-human
    if (failureHistory?.recentFailures && failureHistory.recentFailures >= this.options.humanInterventionThreshold) {
      action = 'ask-human'
      confidence = 1.0
    }

    return {
      action,
      reason,
      confidence,
      metadata
    }
  }

  /**
   * 简单工厂函数
   */
  static create(options?: RecoveryPlannerOptions): RecoveryPlannerV2 {
    return new RecoveryPlannerV2(options)
  }
}