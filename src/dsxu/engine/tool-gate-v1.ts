import { ToolDefinition, ToolPermissionContext, ToolPermissionLevel, ToolReadWriteClass, ToolSideEffectClass } from './tool-types-v1';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolGateDecision = 'allow' | 'warn' | 'block' | 'require_confirmation';
export type ToolExecutionDecision = 'execute' | 'execute_guarded' | 'defer' | 'deny';
export type ToolPermissionDecision = 'granted' | 'needs-escalation' | 'denied';

export interface ToolConfirmationRequirement {
  required: boolean;
  reason: string;
  confirmationScope: 'single-tool' | 'batch' | 'session';
}

export interface ToolRollbackHint {
  available: boolean;
  actions: string[];
  rollbackScope: 'local' | 'external' | 'session';
}

export interface ToolConflictPolicy {
  policyId: string;
  disallowConcurrentPairs: Array<{ left: string; right: string; reason: string }>;
}

export interface ToolFailureHandlingHint {
  retryable: boolean;
  recommendedAction: string;
  escalationTarget?: string;
}

export interface ToolApprovalTrace {
  traceId: string;
  timestamp: number;
  riskLevel: ToolRiskLevel;
  gateDecision: ToolGateDecision;
  executionDecision: ToolExecutionDecision;
  permissionDecision: ToolPermissionDecision;
  notes: string[];
}

export interface ToolGateEvaluation {
  riskLevel: ToolRiskLevel;
  gateDecision: ToolGateDecision;
  executionDecision: ToolExecutionDecision;
  permissionDecision: ToolPermissionDecision;
  confirmation: ToolConfirmationRequirement;
  rollbackHint: ToolRollbackHint;
  failureHint: ToolFailureHandlingHint;
  approvalTrace: ToolApprovalTrace;
}

export interface ToolPermissionEvaluation {
  allowed: boolean;
  reason: string;
  deniedByRuleId?: string;
}

function permissionRank(level: ToolPermissionLevel): number {
  return level === 'safe' ? 1 : level === 'guarded' ? 2 : 3;
}

function readWriteRiskClass(readWriteClass: ToolReadWriteClass): ToolRiskLevel {
  if (readWriteClass === 'read-only') return 'low';
  if (readWriteClass === 'write-local') return 'medium';
  return 'high';
}

function sideEffectRiskClass(sideEffectClass: ToolSideEffectClass): ToolRiskLevel {
  if (sideEffectClass === 'none') return 'low';
  if (sideEffectClass === 'local-state') return 'medium';
  return 'critical';
}

function maxRisk(a: ToolRiskLevel, b: ToolRiskLevel): ToolRiskLevel {
  const rank: Record<ToolRiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return rank[a] >= rank[b] ? a : b;
}

export function evaluateToolGate(
  tool: ToolDefinition,
  input: {
    allowedPermissionLevel: ToolPermissionLevel;
    requireConfirmationForWrite: boolean;
    conflictPolicy?: ToolConflictPolicy;
    concurrentToolIds?: string[];
  },
): ToolGateEvaluation {
  const notes: string[] = [];

  const riskFromRW = readWriteRiskClass(tool.readWriteClass);
  const riskFromSE = sideEffectRiskClass(tool.sideEffectClass);
  let riskLevel = maxRisk(riskFromRW, riskFromSE);

  const allowed = permissionRank(input.allowedPermissionLevel);
  const required = permissionRank(tool.permissionLevel);

  let permissionDecision: ToolPermissionDecision = 'granted';
  if (required > allowed) {
    permissionDecision = required - allowed === 1 ? 'needs-escalation' : 'denied';
    notes.push('permission-insufficient');
  }

  let conflictBlocked = false;
  if (input.conflictPolicy && input.concurrentToolIds && input.concurrentToolIds.length > 0) {
    for (const pair of input.conflictPolicy.disallowConcurrentPairs) {
      const sameTool = pair.left === tool.toolId || pair.right === tool.toolId;
      const conflictWithConcurrent =
        input.concurrentToolIds.includes(pair.left) || input.concurrentToolIds.includes(pair.right);
      if (sameTool && conflictWithConcurrent) {
        conflictBlocked = true;
        notes.push(`conflict-policy:${pair.reason}`);
        break;
      }
    }
  }

  let gateDecision: ToolGateDecision = 'allow';
  let executionDecision: ToolExecutionDecision = 'execute';

  if (permissionDecision === 'denied' || conflictBlocked) {
    gateDecision = 'block';
    executionDecision = 'deny';
  } else if (tool.sideEffectClass === 'external-side-effect') {
    gateDecision = 'require_confirmation';
    executionDecision = 'execute_guarded';
    riskLevel = maxRisk(riskLevel, 'critical');
  } else if (tool.readWriteClass !== 'read-only' && input.requireConfirmationForWrite) {
    gateDecision = 'require_confirmation';
    executionDecision = 'execute_guarded';
  } else if (permissionDecision === 'needs-escalation' || riskLevel === 'high') {
    gateDecision = 'warn';
    executionDecision = 'defer';
  }

  const confirmation: ToolConfirmationRequirement = {
    required: gateDecision === 'require_confirmation',
    reason: gateDecision === 'require_confirmation' ? 'write/external side effect requires explicit approval' : 'not-required',
    confirmationScope: tool.sideEffectClass === 'external-side-effect' ? 'session' : 'single-tool',
  };

  const rollbackHint: ToolRollbackHint = {
    available: tool.readWriteClass !== 'read-only',
    actions:
      tool.readWriteClass === 'read-only'
        ? ['no rollback needed']
        : tool.sideEffectClass === 'external-side-effect'
          ? ['record external transaction id', 'issue compensating operation', 'notify operator']
          : ['restore previous local state', 're-run validation'],
    rollbackScope: tool.sideEffectClass === 'external-side-effect' ? 'external' : 'local',
  };

  const failureHint: ToolFailureHandlingHint = {
    retryable: tool.failureClass === 'transient',
    recommendedAction:
      gateDecision === 'block'
        ? 'choose safer alternative or downgrade operation'
        : tool.failureClass === 'transient'
          ? 'retry with bounded backoff'
          : 'switch to fallback tool path',
    escalationTarget: riskLevel === 'critical' ? 'human-operator' : undefined,
  };

  const approvalTrace: ToolApprovalTrace = {
    traceId: `tool-approval-${Date.now()}`,
    timestamp: Date.now(),
    riskLevel,
    gateDecision,
    executionDecision,
    permissionDecision,
    notes,
  };

  return {
    riskLevel,
    gateDecision,
    executionDecision,
    permissionDecision,
    confirmation,
    rollbackHint,
    failureHint,
    approvalTrace,
  };
}

export function evaluateToolPermissionContext(
  tool: ToolDefinition,
  context: ToolPermissionContext,
): ToolPermissionEvaluation {
  const denyRule = context.denyRules.find((rule) => wildcardMatch(tool.toolId, rule.toolIdPattern));
  if (denyRule) {
    return {
      allowed: false,
      reason: `denied by rule: ${denyRule.reason}`,
      deniedByRuleId: denyRule.ruleId,
    };
  }

  const rank: Record<ToolPermissionLevel, number> = { safe: 1, guarded: 2, privileged: 3 };
  if (rank[tool.permissionLevel] > rank[context.allowedPermissionLevel]) {
    return {
      allowed: false,
      reason: `permission level ${tool.permissionLevel} exceeds allowed ${context.allowedPermissionLevel}`,
    };
  }

  if (context.requireConfirmationForWrite && tool.readWriteClass !== 'read-only') {
    return {
      allowed: false,
      reason: 'write tool requires explicit confirmation in current permission context',
    };
  }

  return { allowed: true, reason: 'permission context check passed' };
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}
