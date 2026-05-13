/**
 * Recovery Planner V2 - 最小类型定义
 * F-4NN 任务：完全切断旧测试，新建最小实现
 */

export type RecoveryReason =
  | 'verify-failure'
  | 'reviewer-rejection'
  | 'tool-failure'
  | 'context-insufficiency'
  | 'repeated-failure'

export type RecoveryAction =
  | 'retry'
  | 'replan'
  | 'rollback'
  | 'abort'
  | 'ask-human'

export interface RecoveryDecision {
  action: RecoveryAction
  reason: RecoveryReason
  confidence: number
  metadata?: Record<string, any>
}

export interface RecoveryInput {
  bugRecord: {
    id: string
    type: RecoveryReason
    severity: 'low' | 'medium' | 'high'
    source: string
    description: string
    context: Record<string, any>
    timestamp: number
  }
  failureHistory?: {
    recentFailures: number
    sameTypeFailures: number
  }
  sessionContext?: {
    sessionId: string
    memorySummary?: string
    graphRetrieval?: any
  }
}

export interface RecoveryPlannerOptions {
  debug?: boolean
  retryThreshold?: number
  rollbackThreshold?: number
  humanInterventionThreshold?: number
}