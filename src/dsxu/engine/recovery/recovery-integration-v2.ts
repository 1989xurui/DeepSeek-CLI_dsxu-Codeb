/**
 * Recovery Integration V2 - 最小集成
 * F-4NN 任务：完全切断旧测试，新建最小实现
 */

import { RecoveryPlannerV2 } from './recovery-planner-v2'
import { RecoveryInput, RecoveryDecision } from './recovery-types-v2'

/**
 * 集成接口：消费 Bug Brain 输出
 */
export interface BugBrainOutput {
  bugId: string
  bugType: string
  severity: 'low' | 'medium' | 'high'
  source: string
  description: string
  context: Record<string, any>
}

/**
 * 集成接口：消费 Session/Memory/Graph 输入
 */
export interface SessionContext {
  sessionId: string
  memorySummary?: string
  graphRetrieval?: any
  compactRetrieval?: any
}

/**
 * 集成接口：失败历史
 */
export interface FailureHistory {
  recentFailures: number
  sameTypeFailures: number
  lastFailureTime?: number
}

/**
 * 集成恢复规划器
 */
export class RecoveryIntegrationV2 {
  private planner: RecoveryPlannerV2

  constructor(planner?: RecoveryPlannerV2) {
    this.planner = planner || new RecoveryPlannerV2()
  }

  /**
   * 集成入口：处理 Bug Brain 输出 + Session 上下文
   */
  processBugWithContext(
    bugBrainOutput: BugBrainOutput,
    sessionContext?: SessionContext,
    failureHistory?: FailureHistory
  ): RecoveryDecision {
    const input: RecoveryInput = {
      bugRecord: {
        id: bugBrainOutput.bugId,
        type: bugBrainOutput.bugType as any,
        severity: bugBrainOutput.severity,
        source: bugBrainOutput.source,
        description: bugBrainOutput.description,
        context: bugBrainOutput.context,
        timestamp: Date.now()
      },
      failureHistory: failureHistory ? {
        recentFailures: failureHistory.recentFailures,
        sameTypeFailures: failureHistory.sameTypeFailures
      } : undefined,
      sessionContext: sessionContext ? {
        sessionId: sessionContext.sessionId,
        memorySummary: sessionContext.memorySummary,
        graphRetrieval: sessionContext.graphRetrieval
      } : undefined
    }

    return this.planner.decideRecoveryAction(input)
  }

  /**
   * 简单工厂函数
   */
  static create(): RecoveryIntegrationV2 {
    return new RecoveryIntegrationV2()
  }
}