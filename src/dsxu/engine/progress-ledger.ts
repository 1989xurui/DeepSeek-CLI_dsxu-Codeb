/**
 * DSXU Progress Ledger - 轻量版进度账本
 *
 * 定义最小进度账本结构，用于任务状态跟踪和恢复
 * Work Package I - 步骤1
 */

import type { RuntimeState } from './types'

/**
 * 进度账本条目结果
 */
export interface LedgerEntryResult {
  /** 结果类型：success | failure | pending */
  type: 'success' | 'failure' | 'pending'
  /** 结果消息 */
  message?: string
  /** 错误信息（如果失败） */
  error?: string
  /** 结果数据 */
  data?: Record<string, any>
  /** 时间戳 */
  timestamp: number
}

/**
 * 验证摘要
 */
export interface VerifySummary {
  /** 是否通过 */
  passed: boolean
  /** 验证分数 (0-100) */
  score: number
  /** 验证发现的问题 */
  findings: Array<{
    severity: 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
  /** 验证时间戳 */
  timestamp: number
}

/**
 * 审查摘要
 */
export interface ReviewSummary {
  /** 是否批准 */
  approved: boolean
  /** 审查分数 (0-100) */
  score: number
  /** 审查意见 */
  comments: string[]
  /** 风险等级：low | medium | high */
  riskLevel: 'low' | 'medium' | 'high'
  /** 审查时间戳 */
  timestamp: number
}

/**
 * 进度账本步骤
 */
export interface LedgerStep {
  /** 步骤ID */
  stepId: string
  /** 步骤类型 */
  type: string
  /** 步骤状态 */
  state: 'pending' | 'running' | 'completed' | 'failed'
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  endedAt?: number
  /** 步骤结果 */
  result?: LedgerEntryResult
  /** 步骤元数据 */
  metadata?: Record<string, any>
}

/**
 * 进度账本 - 轻量版
 */
export interface ProgressLedger {
  /** 任务ID */
  taskId: string
  /** 会话ID */
  sessionId: string
  /** 当前状态（与FSM兼容） */
  currentState: RuntimeState
  /** 上一个状态 */
  previousState: RuntimeState | null
  /** 最后结果 */
  lastResult: LedgerEntryResult | null
  /** 最后更新时间 */
  updatedAt: number
  /** 账本版本 */
  version: string

  /** 步骤历史（预留） */
  steps?: LedgerStep[]
  /** 恢复点（预留） */
  resumeFrom?: RuntimeState
  /** 验证摘要（预留） */
  verifySummary?: VerifySummary | null
  /** 审查摘要（预留） */
  reviewSummary?: ReviewSummary | null

  /** 创建时间 */
  createdAt: number
  /** 是否已完成 */
  isCompleted: boolean
  /** 完成时间 */
  completedAt?: number
  /** 账本元数据 */
  metadata?: Record<string, any>
}

/**
 * 创建进度账本
 */
export function createProgressLedger(
  taskId: string,
  sessionId: string,
  initialState: RuntimeState = 'plan'
): ProgressLedger {
  const now = Date.now()

  return {
    taskId,
    sessionId,
    currentState: initialState,
    previousState: null,
    lastResult: null,
    updatedAt: now,
    version: '1.0.0',

    // 预留字段初始化为空
    steps: [],
    resumeFrom: undefined,
    verifySummary: null,
    reviewSummary: null,

    // 基础字段
    createdAt: now,
    isCompleted: false,
    metadata: {}
  }
}

/**
 * 更新进度账本状态
 */
export function updateLedgerState(
  ledger: ProgressLedger,
  newState: RuntimeState,
  result?: LedgerEntryResult
): ProgressLedger {
  return {
    ...ledger,
    previousState: ledger.currentState,
    currentState: newState,
    lastResult: result || ledger.lastResult,
    updatedAt: Date.now()
  }
}

/**
 * 添加步骤到账本
 */
export function addLedgerStep(
  ledger: ProgressLedger,
  step: Omit<LedgerStep, 'stepId' | 'startedAt'>
): ProgressLedger {
  const newStep: LedgerStep = {
    stepId: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startedAt: Date.now(),
    ...step
  }

  return {
    ...ledger,
    steps: [...(ledger.steps || []), newStep],
    updatedAt: Date.now()
  }
}

/**
 * 更新步骤状态
 */
export function updateLedgerStep(
  ledger: ProgressLedger,
  stepId: string,
  updates: Partial<LedgerStep>
): ProgressLedger {
  return {
    ...ledger,
    steps: (ledger.steps || []).map(step =>
      step.stepId === stepId ? { ...step, ...updates } : step
    ),
    updatedAt: Date.now()
  }
}

/**
 * 设置验证摘要
 */
export function setVerifySummary(
  ledger: ProgressLedger,
  verifySummary: VerifySummary
): ProgressLedger {
  return {
    ...ledger,
    verifySummary,
    updatedAt: Date.now()
  }
}

/**
 * 设置审查摘要
 */
export function setReviewSummary(
  ledger: ProgressLedger,
  reviewSummary: ReviewSummary
): ProgressLedger {
  return {
    ...ledger,
    reviewSummary,
    updatedAt: Date.now()
  }
}

/**
 * 标记账本完成
 */
export function markLedgerCompleted(
  ledger: ProgressLedger,
  result: LedgerEntryResult
): ProgressLedger {
  const now = Date.now()

  return {
    ...ledger,
    isCompleted: true,
    completedAt: now,
    lastResult: result,
    updatedAt: now
  }
}

/**
 * 获取账本摘要
 */
export function getLedgerSummary(ledger: ProgressLedger): {
  taskId: string
  sessionId: string
  currentState: RuntimeState
  isCompleted: boolean
  stepCount: number
  completedSteps: number
  lastUpdated: number
} {
  const steps = ledger.steps || []

  return {
    taskId: ledger.taskId,
    sessionId: ledger.sessionId,
    currentState: ledger.currentState,
    isCompleted: ledger.isCompleted,
    stepCount: steps.length,
    completedSteps: steps.filter(s => s.state === 'completed').length,
    lastUpdated: ledger.updatedAt
  }
}

/**
 * 检查账本是否可恢复
 */
export function isLedgerResumable(ledger: ProgressLedger): boolean {
  return !ledger.isCompleted && ledger.resumeFrom !== undefined
}

/**
 * 获取恢复点
 */
export function getResumePoint(ledger: ProgressLedger): RuntimeState | null {
  return ledger.resumeFrom || ledger.currentState
}
