import { AsyncLocalStorage } from 'node:async_hooks';

export type DSXUWorkflowPhase = 'research' | 'synthesis' | 'implementation' | 'verification';

export interface DSXUParityRoute {
  phase: DSXUWorkflowPhase;
  assignedRole: 'researcher' | 'coordinator' | 'implementer' | 'verifier';
  rationale: string;
}

export interface AgentRuntimeContext {
  agentId: string;
  role: DSXUParityRoute['assignedRole'];
  mode: 'standalone' | 'teammate' | 'in-process';
  sessionId?: string;
  metadata?: Record<string, string>;
}

export type DSXUAgentVisibleMode = 'serial_worker' | 'parallel_fanout';

export type DSXUAgentRuntimePlacement =
  | 'foreground'
  | 'background'
  | 'worktree_isolation'
  | 'remote_gated_isolation'
  | 'fork_context_inheritance'
  | 'send_message_continuation';

export const DSXU_AGENT_VISIBLE_MODES: readonly DSXUAgentVisibleMode[] = [
  'serial_worker',
  'parallel_fanout',
] as const;

export const DSXU_AGENT_RUNTIME_PLACEMENTS: readonly DSXUAgentRuntimePlacement[] = [
  'foreground',
  'background',
  'worktree_isolation',
  'remote_gated_isolation',
  'fork_context_inheritance',
  'send_message_continuation',
] as const;

export interface DSXUAgentWorkItem {
  taskId: string;
  objective: string;
  readOnly?: boolean;
  ownedFiles?: readonly string[];
  dependsOn?: readonly string[];
  role?: DSXUParityRoute['assignedRole'];
}

export interface DSXUAgentOrchestrationPlan {
  visibleMode: DSXUAgentVisibleMode;
  normalizedFrom?: string;
  maxWorkers: number;
  tasks: readonly DSXUAgentWorkItem[];
  reasons: readonly string[];
  warnings: readonly string[];
  parentFinalGate: readonly string[];
  workerBriefs: readonly string[];
  runtimePlacements: readonly DSXUAgentRuntimePlacement[];
  evidence: {
    visibleModes: readonly DSXUAgentVisibleMode[];
    runtimePlacements: readonly DSXUAgentRuntimePlacement[];
    runtimePlacementsAreNotPlanningModes: true;
    hasWriteConflict: boolean;
    hasDependencies: boolean;
    hasBroadWrite: boolean;
    allWriteScopesOwned: boolean;
    requiresWorkerEvidenceCitation: true;
  };
}

const agentContextStorage = new AsyncLocalStorage<AgentRuntimeContext>();

export function routeWithDSXUParity(input: {
  taskText: string;
  currentPhase?: DSXUWorkflowPhase;
}): DSXUParityRoute {
  const phase = input.currentPhase || inferPhase(input.taskText);
  if (phase === 'research') return { phase, assignedRole: 'researcher', rationale: 'parallel investigation first' };
  if (phase === 'synthesis') return { phase, assignedRole: 'coordinator', rationale: 'coordinator synthesizes findings' };
  if (phase === 'implementation') return { phase, assignedRole: 'implementer', rationale: 'targeted write execution' };
  return { phase, assignedRole: 'verifier', rationale: 'verification gate closes workflow' };
}

export function decideContinueOrSpawn(input: {
  hasExistingWorker: boolean;
  taskComplexity: 'low' | 'medium' | 'high';
  writeScope?: 'narrow' | 'broad';
}): {
  decision: 'continue' | 'spawn';
  reason: string;
} {
  if (input.hasExistingWorker && input.taskComplexity !== 'high' && input.writeScope !== 'broad') {
    return { decision: 'continue', reason: 'reuse warm worker context' };
  }
  return { decision: 'spawn', reason: 'parallel capacity or broader scope required' };
}

export function resolveDSXUAgentOrchestration(input: {
  taskText: string;
  workItems: readonly DSXUAgentWorkItem[];
  requestedMode?: string;
  maxParallel?: number;
}): DSXUAgentOrchestrationPlan {
  const workItems = input.workItems.length > 0
    ? input.workItems
    : [{ taskId: 'agent-task-1', objective: input.taskText, readOnly: true }];
  const requested = normalizeRequestedAgentMode(input.requestedMode);
  const writeItems = workItems.filter(item => item.readOnly !== true);
  const hasDependencies = workItems.some(item => (item.dependsOn ?? []).length > 0);
  const hasBroadWrite = writeItems.some(item => (item.ownedFiles ?? []).length === 0 || (item.ownedFiles ?? []).some(isBroadScope));
  const hasWriteConflict = hasOverlappingWriteScopes(writeItems);
  const allWriteScopesOwned = writeItems.every(item => (item.ownedFiles ?? []).length > 0 && !(item.ownedFiles ?? []).some(isBroadScope));
  const canParallel =
    workItems.length > 1 &&
    !hasDependencies &&
    !hasWriteConflict &&
    !hasBroadWrite &&
    (writeItems.length === 0 || allWriteScopesOwned);
  const visibleMode: DSXUAgentVisibleMode = canParallel && requested !== 'serial_worker'
    ? 'parallel_fanout'
    : 'serial_worker';
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (visibleMode === 'parallel_fanout') {
    reasons.push(writeItems.length === 0 ? 'independent read-only work can fan out' : 'write scopes are owned and non-overlapping');
  } else {
    reasons.push('serial worker keeps parent ownership and evidence simple');
  }
  if (hasDependencies) reasons.push('dependencies require ordered execution');
  if (hasWriteConflict) reasons.push('overlapping write scopes block parallel fanout');
  if (hasBroadWrite) reasons.push('broad or missing write ownership blocks parallel fanout');
  if (requested && requested !== visibleMode) {
    reasons.push(`requested mode normalized to ${visibleMode}`);
  }
  if (input.requestedMode && !isNativeVisibleMode(input.requestedMode)) {
    warnings.push(`unsupported agent mode "${input.requestedMode}" reduced to serial_worker or parallel_fanout`);
  }

  return {
    visibleMode,
    normalizedFrom: input.requestedMode,
    maxWorkers: visibleMode === 'parallel_fanout' ? Math.min(input.maxParallel ?? 4, workItems.length) : 1,
    tasks: workItems,
    reasons,
    warnings,
    parentFinalGate: [
      'parent final must cite worker evidence by file path, command, diagnostic, or PASS marker',
      'partial worker evidence cannot be promoted to PASS',
      'missing evidence requires one SendMessage correction or an honest PARTIAL',
    ],
    workerBriefs: workItems.map(item => renderWorkerBrief(item)),
    runtimePlacements: DSXU_AGENT_RUNTIME_PLACEMENTS,
    evidence: {
      visibleModes: DSXU_AGENT_VISIBLE_MODES,
      runtimePlacements: DSXU_AGENT_RUNTIME_PLACEMENTS,
      runtimePlacementsAreNotPlanningModes: true,
      hasWriteConflict,
      hasDependencies,
      hasBroadWrite,
      allWriteScopesOwned,
      requiresWorkerEvidenceCitation: true,
    },
  };
}

export function runWithAgentContext<T>(context: AgentRuntimeContext, fn: () => T): T {
  return agentContextStorage.run(context, fn);
}

export function getAgentContext(): AgentRuntimeContext | undefined {
  return agentContextStorage.getStore();
}

export function createAgentId(prefix = 'agent'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isValidAgentId(value: string): boolean {
  return /^[a-z][a-z0-9-]{5,}$/.test(value);
}

export function loadPluginAgents(input: {
  pluginNames: string[];
  fallbackRole?: DSXUParityRoute['assignedRole'];
}): Array<{ plugin: string; agentId: string; role: DSXUParityRoute['assignedRole'] }> {
  const fallbackRole = input.fallbackRole || 'researcher';
  return input.pluginNames.map((plugin) => ({
    plugin,
    agentId: createAgentId(`plugin-${plugin.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`),
    role: fallbackRole,
  }));
}

export function execAgentHook(input: {
  agentId: string;
  hookName: 'before-exec' | 'after-exec' | 'on-error';
  payload?: Record<string, unknown>;
}): { accepted: boolean; trace: string } {
  const context = getAgentContext();
  const ctxTag = context ? `${context.mode}:${context.role}` : 'no-context';
  return {
    accepted: isValidAgentId(input.agentId),
    trace: `${input.hookName}|${input.agentId}|${ctxTag}|payload=${Object.keys(input.payload || {}).length}`,
  };
}

export function createStandaloneAgent(input: {
  role?: DSXUParityRoute['assignedRole'];
  sessionId?: string;
}): AgentRuntimeContext {
  return {
    agentId: createAgentId('standalone'),
    role: input.role || 'researcher',
    mode: 'standalone',
    sessionId: input.sessionId,
  };
}

function inferPhase(taskText: string): DSXUWorkflowPhase {
  const t = taskText.toLowerCase();
  if (/\b(research|investigate|find)\b/.test(t)) return 'research';
  if (/\b(summarize|synthesis|plan)\b/.test(t)) return 'synthesis';
  if (/\b(implement|edit|patch|fix)\b/.test(t)) return 'implementation';
  return 'verification';
}

function normalizeRequestedAgentMode(mode: string | undefined): DSXUAgentVisibleMode | undefined {
  if (!mode) return undefined;
  const lower = mode.toLowerCase();
  if (lower === 'serial_worker' || lower === 'serial' || lower === 'sequential') return 'serial_worker';
  if (lower === 'parallel_fanout' || lower === 'parallel' || lower === 'fanout') return 'parallel_fanout';
  if (/\b(parallel|fanout|swarm|mesh|debate|team|multi)\b/.test(lower)) return 'parallel_fanout';
  return 'serial_worker';
}

function isNativeVisibleMode(mode: string): boolean {
  const lower = mode.toLowerCase();
  return ['serial_worker', 'serial', 'sequential', 'parallel_fanout', 'parallel', 'fanout'].includes(lower);
}

function normalizeScope(scope: string): string {
  return scope.replace(/[\\/]+/g, '/').replace(/\/+$/g, '').toLowerCase();
}

function isBroadScope(scope: string): boolean {
  const normalized = normalizeScope(scope);
  return normalized === '*' || normalized === '.' || normalized === '/' || normalized.endsWith('/**');
}

function scopesOverlap(a: string, b: string): boolean {
  const left = normalizeScope(a);
  const right = normalizeScope(b);
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function hasOverlappingWriteScopes(items: readonly DSXUAgentWorkItem[]): boolean {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i]?.ownedFiles ?? [];
      const right = items[j]?.ownedFiles ?? [];
      if (left.some(a => right.some(b => scopesOverlap(a, b)))) return true;
    }
  }
  return false;
}

function renderWorkerBrief(item: DSXUAgentWorkItem): string {
  const mode = item.readOnly === true ? 'read-only' : 'write-owned';
  const files = (item.ownedFiles ?? []).length ? (item.ownedFiles ?? []).join(', ') : 'none';
  const deps = (item.dependsOn ?? []).length ? (item.dependsOn ?? []).join(', ') : 'none';
  return [
    `taskId=${item.taskId}`,
    `mode=${mode}`,
    `role=${item.role ?? 'researcher'}`,
    `ownedFiles=${files}`,
    `dependsOn=${deps}`,
    `objective=${item.objective}`,
  ].join('\n');
}
