import type {
  ToolCapabilityTag,
  ToolFailureClass,
  ToolReadWriteClass,
  ToolRuntimeExecutionResult,
} from './tool-types-v1';
import type {
  ToolExecutionDecision,
  ToolGateDecision,
  ToolGateEvaluation,
  ToolPermissionDecision,
  ToolPermissionEvaluation,
} from './tool-gate-v1';

export type DsxuToolVisibleState =
  | 'running'
  | 'waiting_permission'
  | 'denied'
  | 'recovering'
  | 'completed'
  | 'failed';

export type DsxuToolResultStatus = 'success' | 'error' | 'blocked' | 'partial' | 'skipped';

export type DsxuToolEvidenceLifecycleEventType =
  | 'tool_preflight_started'
  | 'tool_permission_evaluated'
  | 'tool_permission_wait_visible'
  | 'tool_execution_started'
  | 'tool_progress'
  | 'tool_execution_completed'
  | 'tool_execution_failed'
  | 'tool_recovery_planned'
  | 'tool_postflight_recorded';

export interface DsxuToolEvidenceLifecycleEvent {
  event: DsxuToolEvidenceLifecycleEventType;
  at: number;
  summary: string;
}

export interface DsxuToolEvidenceCostUsage {
  model?: string;
  routeReason?: string;
  cacheHitInputTokens?: number;
  cacheMissInputTokens?: number;
  outputTokens?: number;
  toolCalls?: number;
  costUsd?: number;
}

export interface DsxuToolEvidencePack {
  schemaVersion: 'dsxu.tool-evidence-pack.v1';
  packId: string;
  queryTurnId: string;
  toolUseId: string;
  originalToolId: string;
  resolvedToolId: string;
  capabilityTags: ToolCapabilityTag[];
  readWriteClass: ToolReadWriteClass;
  permissionDecision: ToolPermissionDecision;
  permissionReason: string;
  gateDecision: ToolGateDecision;
  executionDecision: ToolExecutionDecision;
  visibleState: DsxuToolVisibleState;
  resultStatus: DsxuToolResultStatus;
  failureClass: ToolFailureClass;
  recoveryHint: string;
  artifactPaths: string[];
  costUsage?: DsxuToolEvidenceCostUsage;
  traceId: string;
  lifecycle: DsxuToolEvidenceLifecycleEvent[];
  createdAt: number;
}

export interface DsxuToolEvidenceBuildInput {
  queryTurnId: string;
  toolUseId?: string;
  originalToolId: string;
  resolvedToolId: string;
  capabilityTags?: readonly ToolCapabilityTag[];
  readWriteClass?: ToolReadWriteClass;
  permission: ToolPermissionEvaluation;
  gate: ToolGateEvaluation;
  result?: ToolRuntimeExecutionResult;
  artifactPaths?: readonly string[];
  costUsage?: DsxuToolEvidenceCostUsage;
  now?: number;
}

export interface DsxuToolEvidenceValidation {
  valid: boolean;
  missingFields: string[];
  violations: string[];
}

const knownFailureClasses = new Set<ToolFailureClass>([
  'transient',
  'deterministic',
  'permission',
  'conflict',
  'unknown',
]);

export function buildDsxuToolEvidencePack(input: DsxuToolEvidenceBuildInput): DsxuToolEvidencePack {
  const now = input.now ?? Date.now();
  const toolUseId = input.toolUseId || input.result?.toolUseId || `tool-unstarted-${now}`;
  const permissionDecision = resolvePermissionDecision(input.permission, input.gate);
  const resultStatus = resolveResultStatus(input.permission, input.gate, input.result);
  const visibleState = resolveVisibleState(input.permission, input.gate, input.result, resultStatus);
  const failureClass = resolveFailureClass(input.permission, input.gate, input.result, resultStatus);
  const recoveryHint = resolveRecoveryHint(input.gate, input.result, resultStatus);

  return {
    schemaVersion: 'dsxu.tool-evidence-pack.v1',
    packId: `tool-evidence-${sanitizeId(input.queryTurnId)}-${sanitizeId(toolUseId)}-${now}`,
    queryTurnId: input.queryTurnId,
    toolUseId,
    originalToolId: input.originalToolId,
    resolvedToolId: input.resolvedToolId,
    capabilityTags: [...(input.capabilityTags && input.capabilityTags.length > 0 ? input.capabilityTags : ['execute'])],
    readWriteClass: input.readWriteClass || 'read-only',
    permissionDecision,
    permissionReason: input.permission.reason,
    gateDecision: input.gate.gateDecision,
    executionDecision: input.gate.executionDecision,
    visibleState,
    resultStatus,
    failureClass,
    recoveryHint,
    artifactPaths: [...(input.artifactPaths || [])],
    costUsage: input.costUsage,
    traceId: input.gate.approvalTrace.traceId,
    lifecycle: buildLifecycle(input, now, resultStatus),
    createdAt: now,
  };
}

export function validateDsxuToolEvidencePack(pack: DsxuToolEvidencePack): DsxuToolEvidenceValidation {
  const missingFields: string[] = [];
  const violations: string[] = [];
  const requiredFields: Array<keyof DsxuToolEvidencePack> = [
    'schemaVersion',
    'packId',
    'queryTurnId',
    'toolUseId',
    'originalToolId',
    'resolvedToolId',
    'capabilityTags',
    'readWriteClass',
    'permissionDecision',
    'permissionReason',
    'gateDecision',
    'executionDecision',
    'visibleState',
    'resultStatus',
    'failureClass',
    'recoveryHint',
    'artifactPaths',
    'traceId',
    'lifecycle',
    'createdAt',
  ];

  for (const field of requiredFields) {
    const value = pack[field];
    if (value === undefined || value === null || value === '') missingFields.push(field);
  }

  if (pack.schemaVersion !== 'dsxu.tool-evidence-pack.v1') {
    violations.push('schemaVersion must be dsxu.tool-evidence-pack.v1');
  }
  if (!Array.isArray(pack.capabilityTags) || pack.capabilityTags.length === 0) {
    violations.push('capabilityTags must include at least one capability');
  }
  if (!Array.isArray(pack.artifactPaths)) {
    violations.push('artifactPaths must be an array');
  }
  if (!Array.isArray(pack.lifecycle) || pack.lifecycle.length < 3) {
    violations.push('lifecycle must include preflight, permission, and postflight events');
  }

  const lifecycleEvents = new Set(pack.lifecycle.map((event) => event.event));
  if (!lifecycleEvents.has('tool_preflight_started')) {
    violations.push('lifecycle missing tool_preflight_started');
  }
  if (!lifecycleEvents.has('tool_permission_evaluated')) {
    violations.push('lifecycle missing tool_permission_evaluated');
  }
  if (!lifecycleEvents.has('tool_postflight_recorded')) {
    violations.push('lifecycle missing tool_postflight_recorded');
  }
  if (pack.resultStatus === 'success' && !lifecycleEvents.has('tool_execution_completed')) {
    violations.push('successful evidence must include tool_execution_completed');
  }
  if (pack.resultStatus === 'blocked' && !lifecycleEvents.has('tool_recovery_planned')) {
    violations.push('blocked evidence must include tool_recovery_planned');
  }
  if (pack.originalToolId !== pack.resolvedToolId && pack.resolvedToolId.length === 0) {
    violations.push('alias evidence must preserve resolvedToolId');
  }

  return {
    valid: missingFields.length === 0 && violations.length === 0,
    missingFields,
    violations,
  };
}

export function renderDsxuToolEvidencePackSummary(pack: DsxuToolEvidencePack): string {
  const alias = pack.originalToolId === pack.resolvedToolId
    ? pack.originalToolId
    : `${pack.originalToolId}->${pack.resolvedToolId}`;
  return [
    `tool=${alias}`,
    `status=${pack.resultStatus}`,
    `visible=${pack.visibleState}`,
    `permission=${pack.permissionDecision}`,
    `gate=${pack.gateDecision}`,
    `trace=${pack.traceId}`,
  ].join('; ');
}

export function projectToolEvidenceForFinalReport(pack: DsxuToolEvidencePack) {
  return {
    toolId: pack.resolvedToolId,
    originalToolId: pack.originalToolId,
    status: pack.resultStatus,
    visibleState: pack.visibleState,
    permission: pack.permissionDecision,
    gate: pack.gateDecision,
    traceId: pack.traceId,
    artifacts: pack.artifactPaths,
  };
}

function resolvePermissionDecision(
  permission: ToolPermissionEvaluation,
  gate: ToolGateEvaluation,
): ToolPermissionDecision {
  if (!permission.allowed) return 'denied';
  return gate.permissionDecision;
}

function resolveResultStatus(
  permission: ToolPermissionEvaluation,
  gate: ToolGateEvaluation,
  result?: ToolRuntimeExecutionResult,
): DsxuToolResultStatus {
  if (!permission.allowed || gate.gateDecision === 'block' || gate.executionDecision === 'deny') return 'blocked';
  if (!result) return 'skipped';
  if (result.isError) return 'error';
  return 'success';
}

function resolveVisibleState(
  permission: ToolPermissionEvaluation,
  gate: ToolGateEvaluation,
  result: ToolRuntimeExecutionResult | undefined,
  resultStatus: DsxuToolResultStatus,
): DsxuToolVisibleState {
  if (resultStatus === 'blocked') return gate.gateDecision === 'require_confirmation' ? 'waiting_permission' : 'denied';
  if (resultStatus === 'error') return 'failed';
  if (resultStatus === 'success') return 'completed';
  if (!permission.allowed || gate.permissionDecision === 'needs-escalation') return 'waiting_permission';
  if (result?.isError) return 'failed';
  return 'running';
}

function resolveFailureClass(
  permission: ToolPermissionEvaluation,
  gate: ToolGateEvaluation,
  result: ToolRuntimeExecutionResult | undefined,
  resultStatus: DsxuToolResultStatus,
): ToolFailureClass {
  const metaFailureClass = result?.meta?.failureClass;
  if (typeof metaFailureClass === 'string' && knownFailureClasses.has(metaFailureClass as ToolFailureClass)) {
    return metaFailureClass as ToolFailureClass;
  }
  if (!permission.allowed || gate.permissionDecision !== 'granted') return 'permission';
  if (gate.approvalTrace.notes.some((note) => note.startsWith('conflict-policy:'))) return 'conflict';
  if (resultStatus === 'error') return 'deterministic';
  if (resultStatus === 'success') return 'unknown';
  return 'unknown';
}

function resolveRecoveryHint(
  gate: ToolGateEvaluation,
  result: ToolRuntimeExecutionResult | undefined,
  resultStatus: DsxuToolResultStatus,
): string {
  if (typeof result?.meta?.recoveryHint === 'string' && result.meta.recoveryHint.trim().length > 0) {
    return result.meta.recoveryHint;
  }
  if (resultStatus === 'success') return 'no recovery needed';
  return gate.failureHint.recommendedAction;
}

function buildLifecycle(
  input: DsxuToolEvidenceBuildInput,
  now: number,
  resultStatus: DsxuToolResultStatus,
): DsxuToolEvidenceLifecycleEvent[] {
  const events: DsxuToolEvidenceLifecycleEvent[] = [
    {
      event: 'tool_preflight_started',
      at: now,
      summary: `preflight ${input.originalToolId}`,
    },
    {
      event: 'tool_permission_evaluated',
      at: now,
      summary: input.permission.allowed ? 'permission allowed' : input.permission.reason,
    },
  ];

  if (resultStatus === 'blocked' || input.gate.confirmation.required || input.gate.permissionDecision === 'needs-escalation') {
    events.push({
      event: 'tool_permission_wait_visible',
      at: now,
      summary: input.gate.confirmation.reason,
    });
  }

  if (input.result) {
    events.push({
      event: 'tool_execution_started',
      at: now,
      summary: `execute ${input.resolvedToolId}`,
    });
    events.push({
      event: input.result.isError ? 'tool_execution_failed' : 'tool_execution_completed',
      at: now,
      summary: input.result.isError ? 'tool returned error' : 'tool returned success',
    });
  }

  if (resultStatus !== 'success') {
    events.push({
      event: 'tool_recovery_planned',
      at: now,
      summary: resolveRecoveryHint(input.gate, input.result, resultStatus),
    });
  }

  events.push({
    event: 'tool_postflight_recorded',
    at: now,
    summary: `recorded ${input.originalToolId}->${input.resolvedToolId}`,
  });
  return events;
}

function sanitizeId(value: string): string {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .slice(0, 80) || 'unknown';
}
