export type AgentRole =
  | 'worker'
  | 'explorer'
  | 'researcher'
  | 'implementer'
  | 'verifier'
  | 'coordinator'
  | 'specialist';

export type BranchRunMode = 'parallel' | 'sequential';
export type BranchAccessMode = 'read-only' | 'write';
export type BranchStatus = 'planned' | 'queued' | 'running' | 'completed' | 'failed' | 'aborted' | 'blocked';

export interface ForkStrategy {
  name: 'parallel-first' | 'sequential-first' | 'hybrid';
  executionMode: BranchRunMode;
  maxParallelism: number;
  rationale: string;
}

export interface ForkCoordinationPolicy {
  strategy: ForkStrategy;
  allowReadOnlyParallelism: boolean;
  writeBranchConstraint: 'single-writer' | 'isolated-writers';
  orderingRules: string[];
  fallbackPolicy: 'defer-write' | 'downgrade-parallelism' | 'abort-fork';
}

export interface ForkBranchSpec {
  branchId: string;
  task: string;
  role: AgentRole;
  goal: string;
  accessMode: BranchAccessMode;
  runMode: BranchRunMode;
  state: BranchStatus;
  executionStrategy: string;
  dependencies: string[];
}

export interface ForkExecutionPlan {
  taskId: string;
  strategy: ForkStrategy;
  policy: ForkCoordinationPolicy;
  branches: ForkBranchSpec[];
  createdAt: number;
}

export interface ForkDispatchDecision {
  taskId: string;
  runnableBranches: string[];
  deferredBranches: Array<{ branchId: string; reason: string }>;
  rejectedBranches: Array<{ branchId: string; reason: string }>;
  dispatchReasoning: string[];
  createdAt: number;
}

export interface MergeCandidate {
  branchId: string;
  summary: string;
  score: number;
  confidence: number;
  status: BranchStatus;
  artifacts: string[];
}

export type MergeResolutionPolicy = {
  mode: 'winner-takes-all' | 'combine-best' | 'keep-multiple' | 'discard-low-quality' | 'manual-on-conflict';
  minimumScore: number;
  confidenceFloor: number;
  allowPartialMerge: boolean;
  conflictPreference: 'prefer-high-confidence' | 'prefer-recent' | 'manual';
};

export interface MergeConflictDescriptor {
  conflictId: string;
  branches: string[];
  dimension: 'data' | 'logic' | 'priority' | 'resource' | 'timeline';
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolutionOptions: string[];
}

export interface MergeOutcomeTrace {
  traceId: string;
  evaluatedBranches: string[];
  evidence: string[];
  policyMode: MergeResolutionPolicy['mode'];
  chosenOutcome: 'winner' | 'merged' | 'kept' | 'discarded' | 'conflict';
  timestamp: number;
}

export interface MergeResult {
  taskId: string;
  outcome: 'winner' | 'merged' | 'kept' | 'discarded' | 'conflict';
  winnerBranchId?: string;
  keptBranchIds: string[];
  discardedBranchIds: string[];
  mergedFromBranchIds: string[];
  mergedSummary: string;
  basis: string[];
  conflicts: MergeConflictDescriptor[];
  trace: MergeOutcomeTrace;
}

export type AbortReason =
  | 'timeout'
  | 'dependency-failure'
  | 'quality-gate-failed'
  | 'resource-limit'
  | 'invalid-state'
  | 'manual-stop';

export interface AbortImpactScope {
  scope: 'local' | 'global';
  affectedBranches: string[];
  blocksMerge: boolean;
  requiresEscalation: boolean;
}

export interface AbortRecoverySuggestion {
  suggestionId: string;
  title: string;
  actions: string[];
  prerequisites: string[];
}

export interface AbortDecision {
  decisionId: string;
  branchId: string;
  reason: AbortReason;
  scope: AbortImpactScope;
  recovery: AbortRecoverySuggestion[];
  createdAt: number;
}

export type EscalationReason =
  | 'multi-branch-failure'
  | 'merge-deadlock'
  | 'policy-violation'
  | 'quality-risk'
  | 'human-approval-needed';

export type EscalationTarget = 'coordinator' | 'human' | 'specialist' | 'system';
export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface EscalationActionPlan {
  planId: string;
  immediateActions: string[];
  shortTermActions: string[];
  rollbackActions: string[];
  exitCriteria: string[];
}

export interface EscalationDecision {
  decisionId: string;
  reason: EscalationReason;
  target: EscalationTarget;
  priority: EscalationPriority;
  actionPlan: EscalationActionPlan;
  createdAt: number;
}

export interface ResultOriginTrace {
  sourceBranchId: string;
  sourceTask: string;
  generatedAt: number;
  generatorRole: AgentRole;
  evidenceRefs: string[];
}

export interface ResultConfidenceProfile {
  confidence: number;
  qualitySignals: string[];
  risks: string[];
}

export interface CollectedIntermediateResult {
  resultId: string;
  branchId: string;
  status: BranchStatus;
  summary: string;
  reusable: boolean;
  confidenceProfile: ResultConfidenceProfile;
  originTrace: ResultOriginTrace;
  createdAt: number;
}

export interface ResultReuseDecision {
  resultId: string;
  reusable: boolean;
  reason: string;
  targetBranches: string[];
  decisionAt: number;
}

export interface LifecycleRecoveryHint {
  hintId: string;
  stage: 'fork' | 'merge' | 'abort' | 'escalate';
  title: string;
  steps: string[];
  preconditions: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface BranchRecoveryHint extends LifecycleRecoveryHint {
  stage: 'fork' | 'abort';
  branchId: string;
}

export interface MergeRecoveryHint extends LifecycleRecoveryHint {
  stage: 'merge';
  conflictIds: string[];
}

export interface EscalationRecoveryHint extends LifecycleRecoveryHint {
  stage: 'escalate';
  escalationId: string;
}

export interface BranchExecutionState {
  branchId: string;
  status: BranchStatus;
  progress: number;
  lastUpdatedAt: number;
  role: AgentRole;
  goal: string;
  history: Array<{ from: BranchStatus; to: BranchStatus; at: number; reason?: string }>;
}

export interface LifecycleStateTransition {
  transitionId: string;
  entityType: 'branch' | 'lifecycle';
  entityId: string;
  fromState: string;
  toState: string;
  reason: string;
  timestamp: number;
}

export interface CoordinationLifecycleCheckpoint {
  checkpointId: string;
  taskId: string;
  lifecycleState: 'planning' | 'forking' | 'executing' | 'merging' | 'recovering' | 'completed' | 'aborted' | 'escalated';
  branchSnapshot: Record<string, BranchStatus>;
  notes: string[];
  createdAt: number;
}

export interface CoordinationLifecycleSummary {
  taskId: string;
  totalBranches: number;
  completedBranches: number;
  failedBranches: number;
  abortedBranches: number;
  mergeOutcomes: Array<MergeResult['outcome']>;
  escalationCount: number;
  checkpoints: number;
  transitions: number;
  generatedAt: number;
}

export interface CoordinationLifecycleProtocol {
  taskId: string;
  forkPlan?: ForkExecutionPlan;
  forkDispatches: ForkDispatchDecision[];
  branchStates: Record<string, BranchExecutionState>;
  intermediateResults: CollectedIntermediateResult[];
  reuseDecisions: ResultReuseDecision[];
  mergeResults: MergeResult[];
  abortDecisions: AbortDecision[];
  escalationDecisions: EscalationDecision[];
  recoveryHints: LifecycleRecoveryHint[];
  transitions: LifecycleStateTransition[];
  checkpoints: CoordinationLifecycleCheckpoint[];
  summary: CoordinationLifecycleSummary;
}

// ===== Mainline Compatibility & Integration Types =====

export interface AgentRoleConfig {
  role: AgentRole;
  description: string;
  capabilities: string[];
}

export interface TaskRiskProfile {
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface ValidationRequirement {
  level: 'none' | 'self' | 'independent' | 'strict';
  checks: string[];
}

export type TaskRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VerificationRequirement = ValidationRequirement;
export type ContextOverlapType = 'fresh' | 'partial' | 'high-overlap' | 'stale' | 'isolated';
export type WorkflowPhaseType = 'research' | 'implementation' | 'verification' | 'coordination' | 'planning' | 'synthesis';
export type TaskExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'aborted';
export type SubtaskType = 'research' | 'implementation' | 'verification' | 'coordination';

export interface SubtaskPlan {
  id: string;
  type: SubtaskType;
  title: string;
  description: string;
  assignedRole: AgentRole;
  dependencies: string[];
  expectedOutput: string;
  priority: 'low' | 'medium' | 'high';
}

export interface MainTaskPlan {
  id: string;
  title: string;
  description: string;
  subtasks: SubtaskPlan[];
}

export interface RoleAssignment {
  subtaskId: string;
  assignedRole: AgentRole;
  rationale: string;
}

export interface CoordinatorDecision {
  taskId: string;
  roleAssignments: RoleAssignment[];
  concurrencyPlan: {
    parallelTasks: string[];
    sequentialTasks: string[];
  };
  rationale: string;
}

export interface RoleRoutingOutput {
  decision: CoordinatorDecision;
  taskPlan: MainTaskPlan;
  timestamp: number;
}

export interface AgentRuntimeState {
  agentId: string;
  role: AgentRole;
  status: 'idle' | 'working' | 'completed' | 'failed';
  currentTaskId?: string;
}

export interface MultiAgentRuntimeState {
  taskId: string;
  overallStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  agents: AgentRuntimeState[];
  updatedAt: number;
}

export type RoleSelectionRuleType = 'task-type' | 'risk' | 'verification';

export interface RoleSelectionRule {
  id: string;
  type: RoleSelectionRuleType;
  condition: string;
  recommendedRoles: AgentRole[];
  priority: number;
}

export interface RoleSelectionRuleSet {
  id: string;
  rules: RoleSelectionRule[];
}

export const AGENT_ROLE_CONFIGS: Record<AgentRole, AgentRoleConfig> = {
  worker: { role: 'worker', description: 'general worker', capabilities: ['read', 'edit', 'execute'] },
  explorer: { role: 'explorer', description: 'read-only exploration', capabilities: ['search', 'analyze'] },
  researcher: { role: 'researcher', description: 'deep investigation', capabilities: ['analyze', 'summarize'] },
  implementer: { role: 'implementer', description: 'implementation owner', capabilities: ['edit', 'refactor'] },
  verifier: { role: 'verifier', description: 'independent verification', capabilities: ['test', 'validate'] },
  coordinator: { role: 'coordinator', description: 'orchestration owner', capabilities: ['route', 'merge', 'escalate'] },
  specialist: { role: 'specialist', description: 'domain specialist', capabilities: ['domain-review'] },
};

export const DSXU_PARITY_RULES: RoleSelectionRule[] = [
  { id: 'dsxu-mainline-owner', type: 'task-type', condition: 'all', recommendedRoles: ['coordinator'], priority: 100 },
];
export const RISK_BASED_RULES: RoleSelectionRule[] = [
  { id: 'risk-high-review', type: 'risk', condition: 'high', recommendedRoles: ['specialist', 'verifier'], priority: 90 },
];
export const VERIFICATION_BASED_RULES: RoleSelectionRule[] = [
  { id: 'independent-verification', type: 'verification', condition: 'independent', recommendedRoles: ['verifier'], priority: 80 },
];

export function recommendRoleForTask(taskType: SubtaskType): AgentRole {
  if (taskType === 'research') return 'researcher';
  if (taskType === 'verification') return 'verifier';
  if (taskType === 'coordination') return 'coordinator';
  return 'implementer';
}

export function recommendRoleForTaskEnhanced(taskType: SubtaskType): AgentRole {
  return recommendRoleForTask(taskType);
}

export function isRoleSuitableForTask(role: AgentRole, taskType: SubtaskType): boolean {
  return recommendRoleForTask(taskType) === role || role === 'worker';
}

export function isRoleSuitableForTaskEnhanced(role: AgentRole, taskType: SubtaskType): boolean {
  return isRoleSuitableForTask(role, taskType);
}

export function applyRoleSelectionRules(_subtask: unknown, _rules: RoleSelectionRule[]): AgentRole[] {
  return ['worker'];
}

export function createSimpleRoleRouting(title: string, description: string): RoleRoutingOutput {
  const taskId = `task-${Date.now()}`;
  const taskPlan: MainTaskPlan = {
    id: taskId,
    title,
    description,
    subtasks: [
      {
        id: `${taskId}-impl`,
        type: 'implementation',
        title,
        description,
        assignedRole: 'implementer',
        dependencies: [],
        expectedOutput: 'implementation output',
        priority: 'high',
      },
    ],
  };

  return {
    decision: {
      taskId,
      roleAssignments: [{ subtaskId: `${taskId}-impl`, assignedRole: 'implementer', rationale: 'default implementation path' }],
      concurrencyPlan: { parallelTasks: [], sequentialTasks: [`${taskId}-impl`] },
      rationale: 'simple role routing',
    },
    taskPlan,
    timestamp: Date.now(),
  };
}

export function createEnhancedRoleRouting(title: string, description: string): RoleRoutingOutput {
  return createSimpleRoleRouting(title, description);
}

export type CoordinatorLifecycleSignal =
  | { type: 'fork'; payload: ForkDispatchDecision }
  | { type: 'merge'; payload: MergeResult }
  | { type: 'abort'; payload: AbortDecision }
  | { type: 'escalate'; payload: EscalationDecision };

export interface CoordinatorMainlineEnvelope {
  decision: CoordinatorDecision;
  protocol: CoordinationLifecycleProtocol;
  signals: CoordinatorLifecycleSignal[];
  createdAt: number;
}

export interface TaskAssignment {
  taskId: string;
  subtaskId?: string;
  assignedRole: AgentRole;
  assignmentTime: number;
  assignmentRationale: string;
  priority: 'low' | 'medium' | 'high';
  resourceRequirements: Record<string, any>;
  constraints: Record<string, any>;
  status: 'pending' | 'assigned' | 'completed' | 'failed';
}

export interface WorkflowStage {
  stageId: string;
  name: string;
  description: string;
  phase: WorkflowPhaseType;
  entryCriteria: string[];
  exitCriteria: string[];
  tasks: string[];
  roles: AgentRole[];
  status: 'pending' | 'active' | 'completed' | 'blocked';
  metrics: Record<string, number>;
}

export interface TaskDependencyGraph {
  taskId: string;
  nodes: string[];
  edges: Array<{ from: string; to: string; reason: string }>;
}

export interface CoordinationPlan {
  planId: string;
  taskId: string;
  strategy: string;
  phases: WorkflowStage[];
  roleAllocations: Record<string, number>;
  resourceAllocations: Record<string, any>;
  constraints: Record<string, any>;
  successCriteria?: string[];
}

export interface AgentExecutionContext {
  agentId: string;
  role: AgentRole;
  taskId: string;
  availableTools?: string[];
  contextSlices?: string[];
  constraints?: Record<string, any>;
}

export interface AgentCapabilityProfile {
  role: AgentRole;
  capabilities: string[];
  preferredTools?: string[];
  constraints?: Record<string, any>;
}

export interface RoleExecutionConstraint {
  role: AgentRole;
  allowedActions: string[];
  blockedActions?: string[];
  maxParallel?: number;
}

export interface ContextDecisionState {
  decisionId: string;
  taskId: string;
  decisionType: string;
  rationale: string;
  factors?: Record<string, any>;
}

export interface ContextOverlapState {
  sourceTaskId: string;
  targetTaskId: string;
  overlapScore: number;
  recommendation: 'reuse' | 'refresh' | 'isolate';
}

export interface SharedContextSlice {
  sliceId: string;
  sourceTaskId: string;
  content: string;
  ownerRole?: AgentRole;
  freshness?: number;
}

export interface IntermediateResult {
  id: string;
  branchId: string;
  type: string;
  summary: string;
  confidence: number;
}

export interface IntermediateResultEnvelope {
  result: IntermediateResult;
  evidenceRefs: string[];
  createdAt: number;
}

export interface AssignmentTrace {
  traceId: string;
  subtaskId: string;
  role: AgentRole;
  rationale: string;
}

export interface DecisionTrace {
  decisionId: string;
  reason: string;
  evidence: string[];
}

export interface StateTransitionRecord {
  transitionId: string;
  from: string;
  to: string;
  reason: string;
}

export interface CoordinationHealthState {
  taskId: string;
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  updatedAt: number;
}

export interface BranchComparison {
  branchA: string;
  branchB: string;
  similarityScore: number;
  differences: string[];
  recommendation: 'keep-a' | 'keep-b' | 'keep-both' | 'merge' | 'discard-both';
  rationale: string;
}

export interface LifecycleProtocolOutput {
  taskId: string;
  forks: any[];
  branchStates: Record<string, any>;
  collectedResults: any[];
  mergeCandidates: any[];
  abortDecisions: any[];
  escalationDecisions: any[];
  recoveryHints: any[];
  overallStatus: string;
  timestamp: number;
}

export interface TaskNotification {
  notificationId: string;
  taskId: string;
  message: string;
  createdAt: number;
}

export interface ContinueVsSpawnDecision {
  action: 'continue' | 'spawn';
  reason: string;
}

export interface TaskSynthesisSpec {
  taskId: string;
  sourceTaskIds: string[];
  expectedOutput: string;
}

export interface IndependentVerificationConfig {
  required: boolean;
  verifierRoles: AgentRole[];
  successCriteria: string[];
}

function runtimeToken(name: string) {
  return function CoordinatorRuntimeToken() {
    return { kind: name };
  };
}

export const AgentRole = Object.freeze(['worker', 'explorer', 'researcher', 'implementer', 'verifier', 'coordinator', 'specialist']);
export const TaskRiskLevel = 'TaskRiskLevel';
export const VerificationRequirement = 'VerificationRequirement';
export const ContextOverlapType = 'ContextOverlapType';
export const TaskExecutionStatus = 'TaskExecutionStatus';
export const ForkStrategy = 'ForkStrategy';
export const AbortReason = 'AbortReason';
export const EscalationReason = 'EscalationReason';
export const MainTaskPlan = runtimeToken('MainTaskPlan');
export const SubtaskPlan = runtimeToken('SubtaskPlan');
export const TaskAssignment = runtimeToken('TaskAssignment');
export const AgentRuntimeState = runtimeToken('AgentRuntimeState');
export const MultiAgentRuntimeState = runtimeToken('MultiAgentRuntimeState');
export const ForkExecutionPlan = runtimeToken('ForkExecutionPlan');
export const BranchExecutionState = runtimeToken('BranchExecutionState');
export const IntermediateResult = runtimeToken('IntermediateResult');
export const CollectedIntermediateResult = runtimeToken('CollectedIntermediateResult');
export const MergeCandidate = runtimeToken('MergeCandidate');
export const MergeResult = runtimeToken('MergeResult');
export const EscalationDecision = runtimeToken('EscalationDecision');
export const LifecycleRecoveryHint = runtimeToken('LifecycleRecoveryHint');
export const BranchState = runtimeToken('BranchState');
export const CoordinationCheckpoint = runtimeToken('CoordinationCheckpoint');
export const CoordinationSummary = runtimeToken('CoordinationSummary');
export const WorkflowStage = runtimeToken('WorkflowStage');
export const WorkflowPhaseType = runtimeToken('WorkflowPhaseType');
export const TaskDependencyGraph = runtimeToken('TaskDependencyGraph');
export const CoordinationPlan = runtimeToken('CoordinationPlan');
export const AgentExecutionContext = runtimeToken('AgentExecutionContext');
export const AgentCapabilityProfile = runtimeToken('AgentCapabilityProfile');
export const RoleExecutionConstraint = runtimeToken('RoleExecutionConstraint');
export const ContextDecisionState = runtimeToken('ContextDecisionState');
export const ContextOverlapState = runtimeToken('ContextOverlapState');
export const SharedContextSlice = runtimeToken('SharedContextSlice');
export const IntermediateResultEnvelope = runtimeToken('IntermediateResultEnvelope');
export const AssignmentTrace = runtimeToken('AssignmentTrace');
export const DecisionTrace = runtimeToken('DecisionTrace');
export const StateTransitionRecord = runtimeToken('StateTransitionRecord');
export const CoordinationHealthState = runtimeToken('CoordinationHealthState');
export const BranchComparison = runtimeToken('BranchComparison');
export const LifecycleProtocolOutput = runtimeToken('LifecycleProtocolOutput');
export const TaskNotification = runtimeToken('TaskNotification');
export const ContinueVsSpawnDecision = runtimeToken('ContinueVsSpawnDecision');
export const TaskSynthesisSpec = runtimeToken('TaskSynthesisSpec');
export const IndependentVerificationConfig = runtimeToken('IndependentVerificationConfig');

export function createTaskNotification(taskId: string, message: string): TaskNotification {
  return {
    notificationId: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    message,
    createdAt: Date.now(),
  };
}

export function evaluateContextOverlap(sourceTaskId: string, targetTaskId: string, overlapScore = 0): ContextOverlapState {
  return {
    sourceTaskId,
    targetTaskId,
    overlapScore,
    recommendation: overlapScore >= 0.75 ? 'reuse' : overlapScore >= 0.35 ? 'refresh' : 'isolate',
  };
}

export function isTerminalTaskStatus(status: TaskExecutionStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'aborted';
}
