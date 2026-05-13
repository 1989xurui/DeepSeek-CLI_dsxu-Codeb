/**
 * Recovery Planner 主导出文件
 * F-4M 任务：v3 Recovery Planner 并主链收口
 *
 * 当前主实现：v3 Recovery Planner
 * 旧版本保留为 legacy，不推荐新代码使用
 */

import { RecoveryIntegrationV3 } from './recovery-integration-v3'

// ==================== V3 主实现导出 ====================
// 当前 Recovery 主实现，F-4Z 隔离实现已验证

// 首先导出类型（避免冲突）
export type { RecoveryReason, RecoveryAction, RecoveryDecision, RecoveryContext } from './recovery-types-v3'

// 然后导出实现
export { RecoveryPlannerV3 } from './recovery-planner-v3'
export { RecoveryIntegrationV3 } from './recovery-integration-v3'

// 导出默认实例别名（v3版本）
export { RecoveryIntegrationV3 as RecoveryIntegration } from './recovery-integration-v3'
export { RecoveryPlannerV3 as RecoveryPlanner } from './recovery-planner-v3'

// ==================== Legacy 导出（保留但不推荐） ====================
// 以下为旧版本，仅用于兼容现有代码
// 新代码应使用上面的 v3 导出
export * from './recovery-types-v2'
export * from './recovery-planner-v2'
export * from './recovery-integration-v2'

export * from './types'
export * from './recovery-planner'
export * from './integration'

// 旧版本默认实例（标记为 legacy）
export { recoveryFactory } from './integration'
// ===== V10-2D Coordinator Recovery Consumption Bridge =====

export interface CoordinatorRecoveryInput {
  branchFailures: Array<{ branchId: string; reason: string }>;
  mergeConflicts: Array<{ conflictId: string; branches: string[]; severity: 'low' | 'medium' | 'high' }>;
  escalations: Array<{ decisionId: string; reason: string; priority: 'low' | 'medium' | 'high' | 'critical' }>;
}

export interface CoordinatorRecoveryOutput {
  action: 'retry-branch' | 'replan-merge' | 'escalate-human' | 'continue';
  reasons: string[];
  suggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function consumeCoordinatorSignalsForRecovery(input: CoordinatorRecoveryInput): CoordinatorRecoveryOutput {
  const reasons: string[] = [];
  const suggestions: string[] = [];

  if (input.branchFailures.length > 0) {
    reasons.push('branch-failure-detected');
    suggestions.push('retry failed branch with narrower scope');
  }

  if (input.mergeConflicts.length > 0) {
    reasons.push('merge-conflict-detected');
    suggestions.push('switch merge policy to manual-on-conflict and re-score candidates');
  }

  if (input.escalations.length > 0) {
    reasons.push('escalation-detected');
    suggestions.push('pause risky writes and request explicit approval');
  }

  if (input.escalations.some((e) => e.priority === 'critical')) {
    return { action: 'escalate-human', reasons, suggestions, severity: 'critical' };
  }

  if (input.mergeConflicts.length > 0) {
    return { action: 'replan-merge', reasons, suggestions, severity: 'high' };
  }

  if (input.branchFailures.length > 0) {
    return { action: 'retry-branch', reasons, suggestions, severity: 'medium' };
  }

  return { action: 'continue', reasons: ['no-recovery-trigger'], suggestions: ['continue execution'], severity: 'low' };
}

// ===== V10-3 Skills/Prompt Recovery Consumption =====

export interface SkillPromptRecoveryInput {
  skillFailures: Array<{ skillId: string; reason: string }>;
  skillConflicts: Array<{ skillIds: string[]; reason: string }>;
  promptConflicts: Array<{ fragmentIds: string[]; reason: string }>;
}

export interface SkillPromptRecoveryDecision {
  action: 'retry-skill' | 'reselect-skills' | 'rebuild-prompt' | 'continue';
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
  trace: string[];
}

export function consumeSkillPromptForRecovery(input: SkillPromptRecoveryInput): SkillPromptRecoveryDecision {
  const trace: string[] = [];
  const suggestions: string[] = [];

  if (input.skillFailures.length > 0) {
    trace.push('skill-failure-detected');
    suggestions.push('retry failed skill with narrowed input contract');
  }
  if (input.skillConflicts.length > 0) {
    trace.push('skill-conflict-detected');
    suggestions.push('reselect skills using stricter conflict policy');
  }
  if (input.promptConflicts.length > 0) {
    trace.push('prompt-conflict-detected');
    suggestions.push('rebuild prompt stack using take-highest-priority policy');
  }

  if (input.promptConflicts.length > 0) {
    return { action: 'rebuild-prompt', severity: 'high', suggestions, trace };
  }
  if (input.skillConflicts.length > 0) {
    return { action: 'reselect-skills', severity: 'medium', suggestions, trace };
  }
  if (input.skillFailures.length > 0) {
    return { action: 'retry-skill', severity: 'medium', suggestions, trace };
  }
  return { action: 'continue', severity: 'low', suggestions: ['continue mainline execution'], trace: ['no-recovery-trigger'] };
}

// ===== V10-4 Tool Mainline Recovery =====

export interface ToolMainlineRecoveryInput {
  failures: Array<{ toolId: string; class: 'transient' | 'deterministic' | 'permission' | 'conflict' | 'unknown'; summary: string }>;
  blocked: Array<{ toolId: string; reason: string }>;
  conflicts: Array<{ toolIds: string[]; reason: string }>;
}

export interface ToolMainlineRecoveryOutput {
  action: 'retry-tools' | 'reselect-tools' | 'request-approval' | 'continue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
  decisionTrace: string[];
}

export function consumeToolMainlineForRecovery(input: ToolMainlineRecoveryInput): ToolMainlineRecoveryOutput {
  const decisionTrace: string[] = [];
  const suggestions: string[] = [];

  if (input.blocked.length > 0) {
    decisionTrace.push('gate-block-detected');
    suggestions.push('downgrade to read-only alternatives or request privilege escalation');
  }
  if (input.conflicts.length > 0) {
    decisionTrace.push('tool-conflict-detected');
    suggestions.push('serialize conflicting tools and re-run gate evaluation');
  }
  if (input.failures.length > 0) {
    decisionTrace.push('tool-failure-detected');
    suggestions.push('retry transient failures; isolate deterministic failures');
  }

  const hasPermissionFailure = input.failures.some((x) => x.class === 'permission');
  const hasConflictFailure = input.failures.some((x) => x.class === 'conflict') || input.conflicts.length > 0;
  const hasTransientOnly = input.failures.length > 0 && input.failures.every((x) => x.class === 'transient');

  if (input.blocked.length > 0 || hasPermissionFailure) {
    return { action: 'request-approval', severity: 'critical', suggestions, decisionTrace };
  }
  if (hasConflictFailure) {
    return { action: 'reselect-tools', severity: 'high', suggestions, decisionTrace };
  }
  if (hasTransientOnly) {
    return { action: 'retry-tools', severity: 'medium', suggestions, decisionTrace };
  }
  if (input.failures.length > 0) {
    return { action: 'reselect-tools', severity: 'medium', suggestions, decisionTrace };
  }
  return { action: 'continue', severity: 'low', suggestions: ['continue tool orchestration'], decisionTrace: ['no-recovery-trigger'] };
}

// ===== V10-2F Phase A Failure Signal Bridge =====
export function feedFailureSignalsToRecovery(input: {
  abortSignals: Array<{ branchId: string; reason: string }>;
  escalationSignals: Array<{ decisionId: string; priority: 'low' | 'medium' | 'high' | 'critical' }>;
}): {
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'continue' | 'retry-branch' | 'escalate-human';
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.abortSignals.length > 0) reasons.push('abort-signal');
  if (input.escalationSignals.length > 0) reasons.push('escalation-signal');
  const critical = input.escalationSignals.some((s) => s.priority === 'critical');
  if (critical) {
    return { severity: 'critical', action: 'escalate-human', reasons };
  }
  if (input.abortSignals.length > 0) {
    return { severity: 'high', action: 'retry-branch', reasons };
  }
  return { severity: 'low', action: 'continue', reasons: reasons.length ? reasons : ['no-failure-signal'] };
}

// ===== V10-2F Phase B Task Lifecycle Recovery Consumption =====
export function consumeTaskLifecycleForRecovery(input: {
  taskEvents: Array<{ taskId: string; status: 'running' | 'completed' | 'failed' | 'stopped'; summary: string }>;
}): {
  action: 'continue' | 'retry-task' | 'escalate';
  reasons: string[];
} {
  const failed = input.taskEvents.filter((e) => e.status === 'failed');
  const stopped = input.taskEvents.filter((e) => e.status === 'stopped');
  if (failed.length > 1) return { action: 'escalate', reasons: failed.map((f) => `failed:${f.taskId}`) };
  if (failed.length === 1 || stopped.length > 0) {
    return {
      action: 'retry-task',
      reasons: [...failed.map((f) => `failed:${f.taskId}`), ...stopped.map((s) => `stopped:${s.taskId}`)],
    };
  }
  return { action: 'continue', reasons: ['task-lifecycle-healthy'] };
}

// ===== V10-2F Phase D Recovery Evidence Hook =====
export function recordRecoveryMainlineConsumption(input: {
  signalType: string;
  detail: string;
}): { module: 'recovery'; signalType: string; detail: string } {
  return { module: 'recovery', signalType: input.signalType, detail: input.detail };
}

export interface DSXURecoveryMainlineBundleInput {
  sessionId: string
  taskId: string
  bugDescription: string
  failureCount: number
  lastError?: string
  verification?: {
    passed: boolean
    errors?: string[]
  }
  reviewer?: {
    accepted: boolean
    feedback?: string
  }
  blockedTools?: Array<{ toolId: string; reason: string }>
  toolFailures?: Array<{ toolId: string; class: 'transient' | 'deterministic' | 'permission' | 'conflict' | 'unknown'; summary: string }>
  toolConflicts?: Array<{ toolIds: string[]; reason: string }>
}

export interface DSXURecoveryMainlineBundle {
  plannerDecision: RecoveryDecision
  toolDecision: ToolMainlineRecoveryOutput
  evidence: { module: 'recovery'; signalType: string; detail: string }
}

export function createDSXURecoveryMainlineBundle(
  input: DSXURecoveryMainlineBundleInput,
): DSXURecoveryMainlineBundle {
  const integration = new RecoveryIntegrationV3()
  const plannerDecision = integration.processRecoveryRequest({
    session: {
      id: input.sessionId,
      summary: input.bugDescription,
      memory: { taskId: input.taskId },
    },
    verification: input.verification,
    reviewer: input.reviewer,
    bugContext: {
      description: input.bugDescription,
    },
    failureCount: input.failureCount,
    lastError: input.lastError,
  })

  const toolDecision = consumeToolMainlineForRecovery({
    failures: input.toolFailures ?? [],
    blocked: input.blockedTools ?? [],
    conflicts: input.toolConflicts ?? [],
  })

  return {
    plannerDecision,
    toolDecision,
    evidence: recordRecoveryMainlineConsumption({
      signalType: 'dsxu-recovery-mainline-bundle',
      detail: `${plannerDecision.action}:${toolDecision.action}:${input.failureCount}`,
    }),
  }
}
