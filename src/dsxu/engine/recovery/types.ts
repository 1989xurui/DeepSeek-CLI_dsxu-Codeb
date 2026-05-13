/**
 * Recovery Planner 类型定义
 * 吸收 DSXU 的恢复决策结构化机制
 */

import { BugRecord, BugPattern, FixPattern } from '../bug-brain/types'

/**
 * 恢复动作类型
 * 吸收 DSXU 的失败后动作选择机制
 */
export type RecoveryAction =
  | 'retry'          // 重试相同操作
  | 'replan'         // 重新规划执行方案
  | 'rollback'       // 回滚到之前状态
  | 'abort'          // 中止当前任务
  | 'ask-human'      // 请求人工干预
  | 'escalate'       // 升级到更高级别处理
  | 'wait'           // 等待条件变化
  | 'continue'       // 继续执行，记录问题

/**
 * 恢复原因类型
 * 吸收 DSXU 的失败原因分类机制
 */
export type RecoveryReason =
  | 'verify-failure'           // 验证失败
  | 'reviewer-rejection'       // 审核拒绝
  | 'tool-failure'             // 工具执行失败
  | 'context-insufficiency'    // 上下文不足
  | 'graph-retrieval-miss'     // 图检索未命中
  | 'memory-insufficiency'     // 内存不足
  | 'repeated-failure'         // 重复失败
  | 'timeout'                  // 执行超时
  | 'resource-exhaustion'      // 资源耗尽
  | 'configuration-error'      // 配置错误
  | 'integration-failure'      // 集成失败
  | 'unknown'                  // 未知原因

/**
 * 恢复决策上下文
 * 吸收 DSXU 的 session/memory/state 进入决策机制
 */
export interface RecoveryContext {
  // Session/Task 上下文
  sessionId?: string
  taskId?: string
  conversationId?: string
  turnCount?: number
  taskType?: string
  taskPriority?: 'low' | 'medium' | 'high' | 'critical'

  // Memory/Episode 上下文
  memorySummary?: string
  episodeId?: string
  recentMemoryIds?: string[]
  memoryAvailability?: 'high' | 'medium' | 'low'

  // Graph/Retrieval 上下文
  retrievalQuery?: string
  retrievedNodes?: number
  retrievalRelevance?: number
  graphCoverage?: 'full' | 'partial' | 'minimal'

  // Compact/Context 上下文
  compactLevel?: 'none' | 'light' | 'aggressive'
  contextHygieneScore?: number
  availableContextSize?: number
  requiredContextSize?: number

  // 执行环境上下文
  environment?: Record<string, any>
  systemState?: Record<string, any>
  userPreferences?: Record<string, any>

  // 时间戳
  timestamp?: number
}

/**
 * 恢复决策输入
 * 吸收 DSXU 的多源输入整合机制
 */
export interface RecoveryInput {
  // Bug Brain 输入
  bugRecord?: BugRecord
  bugPattern?: BugPattern
  fixPattern?: FixPattern
  bugAnalysis?: any // DSXU comment sanitized.

  // Verify/Reviewer 输入
  verifyResult?: {
    passed: boolean
    errors: string[]
    severity: 'low' | 'medium' | 'high'
  }
  reviewerResult?: {
    approved: boolean
    feedback: string[]
    score: number
    threshold: number
  }

  // Tool 执行输入
  toolResult?: {
    success: boolean
    output?: string
    error?: string
    executionTime?: number
  }

  // 失败历史
  failureHistory?: {
    recentFailures: number
    sameTypeFailures: number
    lastFailureTime?: number
    failurePattern?: string
  }

  // 元数据
  metadata?: Record<string, any>
}

/**
 * 恢复决策结果
 * 吸收 DSXU 的决策结果结构化记录机制
 */
export interface RecoveryDecision {
  decisionId: string
  action: RecoveryAction
  reason: RecoveryReason
  description: string
  context: RecoveryContext
  input: RecoveryInput
  confidence: number // 0.0 - 1.0
  expectedOutcome?: string
  prerequisites?: string[]
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * 恢复计划步骤
 * 吸收 DSXU 的恢复步骤结构化机制
 */
export interface RecoveryStep {
  stepId: string
  action: string
  description: string
  parameters?: Record<string, any>
  expectedOutcome?: string
  dependencies?: string[]
  timeout?: number
}

/**
 * 恢复计划
 * 吸收 DSXU 的多步骤恢复计划机制
 */
export interface RecoveryPlan {
  planId: string
  decisionId: string
  steps: RecoveryStep[]
  estimatedDuration?: number
  prerequisites?: string[]
  fallbackAction?: RecoveryAction
  metadata?: Record<string, any>
}