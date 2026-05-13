/**
 * DeepSeek 运行时状态机
 *
 * 有限状态机主循环，将query-loop重构为明确的状态转移
 */

import type { RuntimeState, RuntimeStateObject, RuntimeStateMachineConfig } from './types'

/** 状态机常量定义 */
export const RUNTIME_STATES = {
  PLAN: 'plan' as RuntimeState,
  RETRIEVE: 'retrieve' as RuntimeState,
  EDIT: 'edit' as RuntimeState,
  EXECUTE: 'execute' as RuntimeState,
  VERIFY: 'verify' as RuntimeState,
  REVIEW: 'review' as RuntimeState,
  COMMIT: 'commit' as RuntimeState,
  ROLLBACK: 'rollback' as RuntimeState,
} as const

/** 状态描述映射 */
export const STATE_DESCRIPTIONS: Record<RuntimeState, string> = {
  plan: '规划状态：分析任务，制定实施计划',
  retrieve: '检索状态：获取相关上下文和文件信息',
  edit: '编辑状态：执行代码修改和重构操作',
  execute: '执行状态：运行测试、构建和验证命令',
  verify: '验证状态：检查修改正确性和完整性',
  review: '审查状态：代码审查、风险评估和质量检查',
  commit: '提交状态：保存变更结果，更新进度账本',
  rollback: '回滚状态：撤销失败变更，恢复原始状态',
}

/** 状态转移原因类型 */
export type StateTransitionReason =
  | 'initial'           // 初始状态
  | 'plan_completed'    // 规划完成
  | 'context_ready'     // 上下文就绪
  | 'edit_completed'    // 编辑完成
  | 'execution_passed'  // 执行通过
  | 'verification_passed' // 验证通过
  | 'review_approved'   // 审查批准
  | 'commit_success'    // 提交成功
  | 'execution_failed'  // 执行失败
  | 'verification_failed' // 验证失败
  | 'review_rejected'   // 审查拒绝
  | 'error_recovery'    // 错误恢复
  | 'user_intervention' // 用户干预
  | 'timeout'           // 超时

/** 状态转移映射表 - 定义允许的状态转移 */
export const STATE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  plan: ['retrieve', 'rollback'],           // 规划 -> 检索 或 回滚
  retrieve: ['edit', 'rollback'],           // 检索 -> 编辑 或 回滚
  edit: ['execute', 'rollback'],            // 编辑 -> 执行 或 回滚
  execute: ['verify', 'rollback'],          // 执行 -> 验证 或 回滚
  verify: ['review', 'rollback'],           // 验证 -> 审查 或 回滚
  review: ['commit', 'rollback'],           // 审查 -> 提交 或 回滚
  commit: [],                               // 提交 -> 无（终止状态）
  rollback: ['plan'],                       // 回滚 -> 规划（重新开始）
}

/** 主链转移映射 - 成功路径 */
export const MAIN_CHAIN_TRANSITIONS: Record<RuntimeState, RuntimeState | null> = {
  plan: 'retrieve',      // 规划 -> 检索
  retrieve: 'edit',      // 检索 -> 编辑
  edit: 'execute',       // 编辑 -> 执行
  execute: 'verify',     // 执行 -> 验证
  verify: 'review',      // 验证 -> 审查
  review: 'commit',      // 审查 -> 提交
  commit: null,          // 提交 -> 无
  rollback: 'plan',      // 回滚 -> 规划
}

/** 失败转移映射 - 回滚路径 */
export const FAILURE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  plan: ['rollback'],     // 规划失败 -> 回滚
  retrieve: ['rollback'], // 检索失败 -> 回滚
  edit: ['rollback'],     // 编辑失败 -> 回滚
  execute: ['rollback'],  // 执行失败 -> 回滚
  verify: ['rollback'],   // 验证失败 -> 回滚
  review: ['rollback'],   // 审查失败 -> 回滚
  commit: [],             // 提交失败 -> 无（已终止）
  rollback: ['plan'],     // 回滚完成 -> 重新规划
}

/** 创建初始状态对象 */
export function createInitialState(initialState: RuntimeState = 'plan'): RuntimeStateObject {
  return {
    currentState: initialState,
    previousState: null,
    enteredAt: Date.now(),
    reason: 'initial',
    metadata: {},
    attemptCount: 0,
    isCompleted: false,
    result: 'pending',
  }
}

/** 创建状态转移 */
export function createStateTransition(
  currentState: RuntimeStateObject,
  nextState: RuntimeState,
  reason: StateTransitionReason,
  metadata?: Record<string, any>
): RuntimeStateObject {
  return {
    currentState: nextState,
    previousState: currentState.currentState,
    enteredAt: Date.now(),
    reason,
    metadata: { ...currentState.metadata, ...metadata },
    attemptCount: 0,
    isCompleted: false,
    result: 'pending',
  }
}

/** 更新状态元数据 */
export function updateStateMetadata(
  state: RuntimeStateObject,
  metadata: Record<string, any>
): RuntimeStateObject {
  return {
    ...state,
    metadata: { ...state.metadata, ...metadata },
  }
}

/** 标记状态完成 */
export function markStateCompleted(
  state: RuntimeStateObject,
  result: 'success' | 'failure',
  error?: string
): RuntimeStateObject {
  return {
    ...state,
    isCompleted: true,
    result,
    error,
  }
}

/** 增加状态尝试次数 */
export function incrementStateAttempt(state: RuntimeStateObject): RuntimeStateObject {
  return {
    ...state,
    attemptCount: state.attemptCount + 1,
  }
}

/** 检查状态是否超时 */
export function isStateTimeout(
  state: RuntimeStateObject,
  timeoutMs: number
): boolean {
  const elapsed = Date.now() - state.enteredAt
  return elapsed > timeoutMs
}

/** 获取状态描述 */
export function getStateDescription(state: RuntimeState): string {
  return STATE_DESCRIPTIONS[state] || `未知状态: ${state}`
}

/** 验证状态转移是否允许 */
export function isValidTransition(
  fromState: RuntimeState,
  toState: RuntimeState,
  config?: RuntimeStateMachineConfig
): boolean {
  // 使用状态转移映射表验证
  const allowedTransitions = STATE_TRANSITIONS[fromState] || []
  return allowedTransitions.includes(toState)
}

/** 检查是否为主链转移 */
export function isMainChainTransition(
  fromState: RuntimeState,
  toState: RuntimeState
): boolean {
  return MAIN_CHAIN_TRANSITIONS[fromState] === toState
}

/** 检查是否为失败转移 */
export function isFailureTransition(
  fromState: RuntimeState,
  toState: RuntimeState
): boolean {
  const failureTransitions = FAILURE_TRANSITIONS[fromState] || []
  return failureTransitions.includes(toState)
}

/** 获取允许的下一个状态 */
export function getAllowedNextStates(
  fromState: RuntimeState
): RuntimeState[] {
  return STATE_TRANSITIONS[fromState] || []
}

/** 获取主链下一个状态 */
export function getMainChainNextState(
  fromState: RuntimeState
): RuntimeState | null {
  return MAIN_CHAIN_TRANSITIONS[fromState] || null
}

/** 获取失败转移状态 */
export function getFailureStates(
  fromState: RuntimeState
): RuntimeState[] {
  return FAILURE_TRANSITIONS[fromState] || []
}
