import type { ToolCallResult, ToolResultContractConsumptionBoard } from './tool-protocol'
import type { DsxuToolEvidencePack } from './tool-evidence-pack-v1'
import type {
  LongTaskLedgerEvent,
  ProgressLedger,
  RuntimeEventSchemaConsumptionProof,
  StallRecoveryDecision,
} from './progress-ledger'

export type DSXUWorkStateEventKind =
  | 'goal'
  | 'plan'
  | 'source_truth'
  | 'tool'
  | 'permission'
  | 'failure'
  | 'recovery'
  | 'cost'
  | 'agent'
  | 'evidence'
  | 'next_action'

export type DSXUWorkStateStatus =
  | 'planned'
  | 'running'
  | 'waiting_permission'
  | 'blocked'
  | 'failed'
  | 'recovering'
  | 'completed'
  | 'skipped'

export type DSXUWorkStateRisk = 'low' | 'medium' | 'high'

export type DSXUWorkStatePermissionDecision = 'granted' | 'needs-escalation' | 'denied'
export type DSXUWorkStateGateDecision = 'allow' | 'warn' | 'block' | 'require_confirmation'
export type DSXUWorkStateRegistryDecision = 'registered' | 'selected' | 'discarded' | 'blocked' | 'adapted'

export type DSXUWorkStateEvent = {
  id: string
  kind: DSXUWorkStateEventKind
  status: DSXUWorkStateStatus
  title: string
  owner: string
  taskId?: string
  turnId?: string
  detail?: string
  risk?: DSXUWorkStateRisk
  evidence?: readonly string[]
  model?: string
  modelCallId?: string
  routeReason?: string
  costUsd?: number
  cacheHitInputTokens?: number
  cacheMissInputTokens?: number
  outputTokens?: number
  cacheHitRatePct?: number
  toolResultChars?: number
  capsuleId?: string
  toolName?: string
  toolUseId?: string
  permissionDecision?: DSXUWorkStatePermissionDecision
  gateDecision?: DSXUWorkStateGateDecision
  agentId?: string
  workerScope?: string
  mcpServer?: string
  skillName?: string
  registryDecision?: DSXUWorkStateRegistryDecision
  artifactPath?: string
}

export type DSXURuntimeStateCardState =
  | 'plan'
  | 'read'
  | 'edit'
  | 'verify'
  | 'review'
  | 'final'
  | 'recovery'

export type DSXURuntimeRecoveryAction =
  | 'retry'
  | 'replan'
  | 'rollback'
  | 'flash-max'
  | 'pro-admission'
  | 'ask-human'
  | 'abort'

export type DSXURuntimeStateCard = {
  schemaVersion: 'dsxu.runtime-state-card.v1'
  owner: 'PlanGraph / Work-State'
  state: DSXURuntimeStateCardState
  allowedNext: readonly string[]
  blockedActions: readonly string[]
  evidenceRequired: readonly string[]
  recoveryIfFails: DSXURuntimeRecoveryAction
  finalClaimAllowed: boolean
  taskId?: string
  turnId?: string
  sourceTimelineStatus: DSXUWorkStateTimeline['status']
  guards: readonly string[]
}

export type DSXUTaskEvidencePacket = {
  schemaVersion: 'dsxu.task-evidence-packet.v1'
  owner: 'Evidence / Release Claim Binder'
  goal: string
  plan: readonly string[]
  modifiedFiles: readonly string[]
  checks: readonly string[]
  results: readonly string[]
  rollback: string
  modelCostCache: readonly string[]
  risks: readonly string[]
  nextAction: string
  finalClaimAllowed: boolean
  evidence: readonly string[]
}

export type DSXULongTaskWorkStateProjection = {
  schemaVersion: 'dsxu.long-task-work-state-projection.v1'
  owner: 'PlanGraph / Work-State'
  taskId: string
  eventCount: number
  projectedEventCount: number
  hasStallDecision: boolean
  finalReportEvidence: readonly string[]
  tuiPreview: readonly string[]
}

export type DSXUAgentWorkStateEvidence = {
  agentId: string
  status: Extract<DSXUWorkStateStatus, 'running' | 'blocked' | 'failed' | 'completed'>
  title: string
  owner?: string
  scope?: string
  evidence: readonly string[]
  artifactPaths?: readonly string[]
}

export type DSXUMcpSkillWorkStateEvidence = {
  id: string
  registryKind: 'mcp' | 'skill' | 'plugin'
  decision: DSXUWorkStateRegistryDecision
  title: string
  owner?: string
  mcpServer?: string
  skillName?: string
  toolName?: string
  permissionBoundary?: string
  evidence: readonly string[]
  artifactPaths?: readonly string[]
}

export type DSXUPlanTemplateNodeEvidence = {
  id: string
  kind?: string
  deps?: readonly string[]
  config?: Record<string, unknown>
}

export type DSXUPlanTemplateWorkStateProjectionInput = {
  templateId: string
  title: string
  owner?: string
  nodes: readonly DSXUPlanTemplateNodeEvidence[]
  evidence?: readonly string[]
}

export type DSXUWorkStateTimelineInput = {
  goal: string
  plan: readonly string[]
  events: readonly DSXUWorkStateEvent[]
  currentStepId?: string
  nextAction: string
  requiresSourceTruth?: boolean
  requiresToolState?: boolean
  requiresPermissionVisibility?: boolean
  requiresCostVisibility?: boolean
}

export type DSXUWorkStateTimeline = {
  status: 'PASS_WORK_STATE_TIMELINE_READY' | 'NEEDS_WORK_STATE_TIMELINE_EVIDENCE'
  goal: string
  plan: readonly string[]
  currentStepId?: string
  nextAction: string
  events: readonly DSXUWorkStateEvent[]
  coverage: {
    hasGoal: boolean
    hasPlan: boolean
    hasSourceTruth: boolean
    hasToolState: boolean
    hasPermissionState: boolean
    hasFailure: boolean
    hasRecoveryForFailure: boolean
    hasCostState: boolean
    hasEvidence: boolean
    hasNextAction: boolean
  }
  guards: readonly string[]
  operatorSummary: readonly string[]
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasKind(events: readonly DSXUWorkStateEvent[], kind: DSXUWorkStateEventKind): boolean {
  return events.some(event => event.kind === kind)
}

function hasUsableKind(events: readonly DSXUWorkStateEvent[], kind: DSXUWorkStateEventKind): boolean {
  return events.some(event => event.kind === kind && event.status !== 'blocked' && event.status !== 'skipped')
}

function eventHasEvidence(event: DSXUWorkStateEvent): boolean {
  return (event.evidence ?? []).some(item => item.trim().length > 0)
}

function hasSideEffectTool(events: readonly DSXUWorkStateEvent[]): boolean {
  return events.some(event => event.kind === 'tool' && (event.risk === 'medium' || event.risk === 'high'))
}

function formatEventLine(event: DSXUWorkStateEvent): string {
  const parts = [
    `[${event.status}] ${event.kind}: ${event.title}`,
    `owner=${event.owner}`,
  ]
  if (event.taskId) parts.push(`task=${event.taskId}`)
  if (event.turnId) parts.push(`turn=${event.turnId}`)
  if (event.risk) parts.push(`risk=${event.risk}`)
  if (event.model) parts.push(`model=${event.model}`)
  if (event.modelCallId) parts.push(`model_call=${event.modelCallId}`)
  if (event.routeReason) parts.push(`route=${event.routeReason}`)
  if (typeof event.costUsd === 'number') parts.push(`cost=$${event.costUsd.toFixed(4)}`)
  if (typeof event.cacheHitRatePct === 'number') parts.push(`cache_hit_rate=${event.cacheHitRatePct.toFixed(1)}%`)
  if (typeof event.cacheHitInputTokens === 'number') parts.push(`cache_hit_tokens=${event.cacheHitInputTokens}`)
  if (typeof event.cacheMissInputTokens === 'number') parts.push(`cache_miss_tokens=${event.cacheMissInputTokens}`)
  if (typeof event.outputTokens === 'number') parts.push(`output_tokens=${event.outputTokens}`)
  if (typeof event.toolResultChars === 'number') parts.push(`tool_result_chars=${event.toolResultChars}`)
  if (event.capsuleId) parts.push(`capsule=${event.capsuleId}`)
  if (event.toolName) parts.push(`tool=${event.toolName}`)
  if (event.toolUseId) parts.push(`tool_use=${event.toolUseId}`)
  if (event.permissionDecision) parts.push(`permission=${event.permissionDecision}`)
  if (event.gateDecision) parts.push(`gate=${event.gateDecision}`)
  if (event.agentId) parts.push(`agent=${event.agentId}`)
  if (event.workerScope) parts.push(`scope=${event.workerScope}`)
  if (event.mcpServer) parts.push(`mcp=${event.mcpServer}`)
  if (event.skillName) parts.push(`skill=${event.skillName}`)
  if (event.registryDecision) parts.push(`registry=${event.registryDecision}`)
  if (event.artifactPath) parts.push(`artifact=${event.artifactPath}`)
  return parts.join(' | ')
}

function statusFromToolCallResult(result: ToolCallResult): DSXUWorkStateStatus {
  if (result.ok) return 'completed'
  if (result.error?.type === 'PERMISSION_DENIED' || result.error?.type === 'VALIDATION_FAILED') {
    return 'blocked'
  }
  if (result.error?.retryable) return 'recovering'
  return 'failed'
}

function riskFromToolCallResult(result: ToolCallResult): DSXUWorkStateRisk {
  const specRisk = result.metadata.toolSpec?.riskLevel
  if (specRisk === 'critical') return 'high'
  if (specRisk === 'high' || specRisk === 'medium' || specRisk === 'low') return specRisk
  if (result.error?.type === 'PERMISSION_DENIED') return 'high'
  if (!result.ok) return result.error?.retryable ? 'medium' : 'high'
  return 'low'
}

function riskFromToolEvidence(pack: DsxuToolEvidencePack): DSXUWorkStateRisk {
  if (pack.readWriteClass === 'write-external') return 'high'
  if (pack.readWriteClass === 'write-local') return 'medium'
  if (pack.gateDecision === 'require_confirmation' || pack.gateDecision === 'block') return 'medium'
  return 'low'
}

function toolStatusFromEvidence(pack: DsxuToolEvidencePack): DSXUWorkStateStatus {
  if (pack.resultStatus === 'success') return 'completed'
  if (pack.resultStatus === 'error') return 'failed'
  if (pack.resultStatus === 'blocked') return 'blocked'
  if (pack.resultStatus === 'partial') return 'recovering'
  if (pack.visibleState === 'waiting_permission') return 'waiting_permission'
  if (pack.visibleState === 'running') return 'running'
  return 'skipped'
}

function permissionStatusFromEvidence(pack: DsxuToolEvidencePack): DSXUWorkStateStatus {
  if (pack.permissionDecision === 'granted') return 'completed'
  if (pack.permissionDecision === 'needs-escalation') return 'waiting_permission'
  return 'blocked'
}

function compactEventEvidence(evidence: readonly string[]): readonly string[] {
  return evidence
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function statusFromLedgerEvent(event: LongTaskLedgerEvent): DSXUWorkStateStatus {
  if (event.kind === 'stall') {
    const decision = event.metadata?.decision as Partial<StallRecoveryDecision> | undefined
    if (decision?.action === 'ask-human' || decision?.action === 'abort') return 'blocked'
    return 'recovering'
  }
  if (event.kind === 'recovery' || event.kind === 'rollback') return 'recovering'
  if (event.kind === 'tool' || event.kind === 'verification' || event.kind === 'review') {
    const ok = event.metadata?.ok
    if (ok === false) return 'failed'
  }
  return event.kind === 'plan' || event.kind === 'goal' ? 'planned' : 'completed'
}

function kindFromLedgerEvent(event: LongTaskLedgerEvent): DSXUWorkStateEventKind {
  switch (event.kind) {
    case 'goal':
      return 'goal'
    case 'plan':
      return 'plan'
    case 'tool':
      return 'tool'
    case 'permission':
      return 'permission'
    case 'model-route':
    case 'cost-cache':
      return 'cost'
    case 'rollback':
    case 'recovery':
    case 'stall':
      return 'recovery'
    case 'verification':
    case 'review':
    case 'evidence':
      return 'evidence'
  }
}

function riskFromLedgerEvent(event: LongTaskLedgerEvent): DSXUWorkStateRisk {
  if (event.kind === 'stall') {
    const decision = event.metadata?.decision as Partial<StallRecoveryDecision> | undefined
    return decision?.action === 'ask-human' || decision?.action === 'abort' ? 'high' : 'medium'
  }
  if (event.kind === 'permission' || event.kind === 'rollback' || event.kind === 'recovery') return 'medium'
  if (event.kind === 'tool') return event.metadata?.ok === false ? 'high' : 'low'
  return 'low'
}

function runtimeStateToCardState(state: ProgressLedger['currentState']): DSXURuntimeStateCardState {
  if (state === 'retrieve') return 'read'
  if (state === 'execute') return 'verify'
  if (state === 'commit') return 'final'
  if (state === 'rollback') return 'recovery'
  return state
}

export function projectDSXUToolEvidenceToWorkStateEvents(
  packs: readonly DsxuToolEvidencePack[],
): DSXUWorkStateEvent[] {
  const events: DSXUWorkStateEvent[] = []
  for (const pack of packs) {
    const risk = riskFromToolEvidence(pack)
    const artifactPath = pack.artifactPaths[0]
    events.push({
      id: `tool-evidence-${pack.toolUseId}`,
      kind: 'tool',
      status: toolStatusFromEvidence(pack),
      title: `Tool ${pack.resolvedToolId} ${pack.resultStatus}`,
      owner: 'Tool Gate',
      risk,
      toolName: pack.resolvedToolId,
      toolUseId: pack.toolUseId,
      permissionDecision: pack.permissionDecision,
      gateDecision: pack.gateDecision,
      artifactPath,
      evidence: compactEventEvidence([
        `pack:${pack.packId}`,
        `queryTurn:${pack.queryTurnId}`,
        `originalTool:${pack.originalToolId}`,
        `resolvedTool:${pack.resolvedToolId}`,
        `result:${pack.resultStatus}`,
        pack.canonicalResultSchema ? `canonicalResult:${pack.canonicalResultSchema}` : '',
        pack.runtimeEventSchema ? `runtimeEvent:${pack.runtimeEventSchema}` : '',
        pack.toolResultBoundaryKind ? `boundary:${pack.toolResultBoundaryKind}` : '',
        pack.toolResultOutputChars !== undefined ? `outputChars:${pack.toolResultOutputChars}` : '',
        `visible:${pack.visibleState}`,
        `readWrite:${pack.readWriteClass}`,
        `trace:${pack.traceId}`,
        ...pack.artifactPaths.map(path => `artifact:${path}`),
        ...pack.lifecycle.map(item => `${item.event}:${item.summary}`),
      ]),
    })
    events.push({
      id: `permission-evidence-${pack.toolUseId}`,
      kind: 'permission',
      status: permissionStatusFromEvidence(pack),
      title: `Permission ${pack.permissionDecision} for ${pack.resolvedToolId}`,
      owner: 'Permission Gate',
      risk,
      toolName: pack.resolvedToolId,
      toolUseId: pack.toolUseId,
      permissionDecision: pack.permissionDecision,
      gateDecision: pack.gateDecision,
      artifactPath,
      evidence: compactEventEvidence([
        `permission:${pack.permissionDecision}`,
        `reason:${pack.permissionReason}`,
        `gate:${pack.gateDecision}`,
        `execution:${pack.executionDecision}`,
        `trace:${pack.traceId}`,
        ...pack.artifactPaths.map(path => `artifact:${path}`),
      ]),
    })
  }
  return events
}

export function projectDSXUToolCallResultToWorkStateEvent(input: {
  result: ToolCallResult
  callId: string
  toolName: string
  taskId?: string
  turnId?: string
  owner?: string
}): DSXUWorkStateEvent {
  const { result } = input
  return {
    id: `tool-result-${input.callId}`,
    kind: 'tool',
    status: statusFromToolCallResult(result),
    title: `Tool ${input.toolName} ${result.ok ? 'completed' : 'failed'}`,
    owner: input.owner ?? 'Tool Gate',
    taskId: input.taskId,
    turnId: input.turnId,
    risk: riskFromToolCallResult(result),
    toolName: input.toolName,
    toolUseId: input.callId,
    artifactPath: typeof result.structuredData?.artifactPath === 'string'
      ? result.structuredData.artifactPath
      : undefined,
    evidence: compactEventEvidence([
      `call:${input.callId}`,
      `ok:${String(result.ok)}`,
      `executor:${result.metadata.executorKind}`,
      `usedBridge:${String(result.metadata.usedBridge)}`,
      `durationMs:${result.metadata.duration}`,
      result.error ? `error:${result.error.type}` : '',
      result.error?.retryable !== undefined ? `retryable:${String(result.error.retryable)}` : '',
      `outputChars:${result.outputText.length}`,
      ...result.events.map(event => `${event.type}:${event.toolName}:${event.callId}`),
    ]),
  }
}

export function projectDSXUToolResultContractBoardToWorkStateEvents(
  board: ToolResultContractConsumptionBoard,
): DSXUWorkStateEvent[] {
  const status: DSXUWorkStateStatus =
    board.status === 'PASS_TOOL_RESULT_CONTRACT_CONSUMPTION'
      ? 'completed'
      : 'blocked'
  return [
    {
      id: 'tool-result-contract-consumption',
      kind: 'evidence',
      status,
      title: 'Tool Result Contract consumption',
      owner: board.owner,
      risk: status === 'completed' ? 'low' : 'high',
      evidence: compactEventEvidence([
        `schema:${board.schemaVersion}`,
        `status:${board.status}`,
        `readyConsumers:${board.readyConsumers.length}/${board.requiredConsumers.length}`,
        `missingConsumers:${board.missingConsumers.join(',') || 'none'}`,
        ...board.finalReportSection.evidence,
        ...board.guards.map(guard => `guard:${guard}`),
      ]),
    },
  ]
}

export function projectDSXURuntimeEventConsumptionProofToWorkStateEvents(
  proof: RuntimeEventSchemaConsumptionProof,
): DSXUWorkStateEvent[] {
  const status: DSXUWorkStateStatus =
    proof.status === 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION'
      ? 'completed'
      : 'blocked'
  return [
    {
      id: 'runtime-event-schema-consumption',
      kind: 'evidence',
      status,
      title: 'Runtime Event Schema consumption',
      owner: proof.owner,
      risk: status === 'completed' ? 'low' : 'high',
      evidence: compactEventEvidence([
        `schema:${proof.schemaVersion}`,
        `status:${proof.status}`,
        `presentKinds:${proof.presentKinds.join(',') || 'none'}`,
        `missingKinds:${proof.missingKinds.join(',') || 'none'}`,
        ...proof.finalReportSection.evidence,
        ...proof.guards.map(guard => `guard:${guard}`),
      ]),
    },
  ]
}

export function projectDSXULongTaskLedgerToWorkStateEvents(
  ledger: ProgressLedger,
): DSXUWorkStateEvent[] {
  const events: DSXUWorkStateEvent[] = (ledger.events ?? []).map(event => {
    const decision = event.metadata?.decision as Partial<StallRecoveryDecision> | undefined
    return {
      id: `ledger-${event.eventId}`,
      kind: kindFromLedgerEvent(event),
      status: statusFromLedgerEvent(event),
      title: event.summary,
      owner: event.owner,
      taskId: event.taskId ?? ledger.taskId,
      turnId: event.turnId,
      modelCallId: event.modelCallId,
      toolUseId: event.toolUseId,
      risk: riskFromLedgerEvent(event),
      evidence: compactEventEvidence([
        `runtimeEvent:${event.schemaVersion}`,
        `ledger:${ledger.taskId}`,
        `event:${event.eventId}`,
        `kind:${event.kind}`,
        decision ? `stall:${decision.reason}->${decision.action}` : '',
        ...(event.evidence ?? []),
      ]),
    }
  })
  if (ledger.stallDecision && !events.some(event => event.id.includes('stall'))) {
    events.push({
      id: `ledger-stall-${ledger.taskId}`,
      kind: 'recovery',
      status: ledger.stallDecision.action === 'ask-human' || ledger.stallDecision.action === 'abort'
        ? 'blocked'
        : 'recovering',
      title: `${ledger.stallDecision.reason} -> ${ledger.stallDecision.action}`,
      owner: ledger.stallDecision.owner,
      taskId: ledger.taskId,
      risk: ledger.stallDecision.action === 'ask-human' || ledger.stallDecision.action === 'abort'
        ? 'high'
        : 'medium',
      evidence: compactEventEvidence([
        `stall:${ledger.stallDecision.reason}`,
        `action:${ledger.stallDecision.action}`,
        `confidence:${ledger.stallDecision.confidence}`,
        ...ledger.stallDecision.evidence,
      ]),
    })
  }
  return events
}

export function buildDSXULongTaskWorkStateProjection(input: {
  ledger: ProgressLedger
  goal: string
  plan: readonly string[]
  nextAction?: string
}): {
  projection: DSXULongTaskWorkStateProjection
  timeline: DSXUWorkStateTimeline
  stateCard: DSXURuntimeStateCard
  taskEvidencePacket: DSXUTaskEvidencePacket
} {
  const events = projectDSXULongTaskLedgerToWorkStateEvents(input.ledger)
  const nextAction = input.nextAction
    ?? input.ledger.stallDecision?.nextAction
    ?? (input.ledger.resumeFrom ? `resume from ${input.ledger.resumeFrom}` : 'continue owner workflow')
  const timeline = buildDSXUWorkStateTimeline({
    goal: input.goal,
    plan: input.plan,
    events,
    nextAction,
    requiresSourceTruth: events.some(event => event.kind === 'tool'),
    requiresToolState: events.some(event => event.kind === 'tool'),
    requiresPermissionVisibility: false,
    requiresCostVisibility: events.some(event => event.kind === 'cost'),
  })
  const stateCard = buildDSXURuntimeStateCard({
    timeline,
    state: input.ledger.stallDecision ? 'recovery' : runtimeStateToCardState(input.ledger.currentState),
    taskId: input.ledger.taskId,
  })
  const taskEvidencePacket = {
    ...buildDSXUTaskEvidencePacket({
    timeline,
    results: input.ledger.lastResult?.message ? [input.ledger.lastResult.message] : [],
    risks: input.ledger.stallDecision ? [`stall:${input.ledger.stallDecision.reason}`] : timeline.guards,
    }),
    finalClaimAllowed: !input.ledger.stallDecision && timeline.status === 'PASS_WORK_STATE_TIMELINE_READY',
  }
  return {
    projection: {
      schemaVersion: 'dsxu.long-task-work-state-projection.v1',
      owner: 'PlanGraph / Work-State',
      taskId: input.ledger.taskId,
      eventCount: input.ledger.events?.length ?? 0,
      projectedEventCount: events.length,
      hasStallDecision: Boolean(input.ledger.stallDecision),
      finalReportEvidence: taskEvidencePacket.evidence,
      tuiPreview: timeline.operatorSummary.slice(0, 12),
    },
    timeline,
    stateCard,
    taskEvidencePacket,
  }
}

export function projectDSXUAgentEvidenceToWorkStateEvents(
  evidenceRows: readonly DSXUAgentWorkStateEvidence[],
): DSXUWorkStateEvent[] {
  return evidenceRows.map(row => ({
    id: `agent-evidence-${row.agentId}`,
    kind: 'agent',
    status: row.status,
    title: row.title,
    owner: row.owner ?? 'Agent Lifecycle',
    risk: row.status === 'failed' || row.status === 'blocked' ? 'high' : 'medium',
    agentId: row.agentId,
    workerScope: row.scope,
    artifactPath: row.artifactPaths?.[0],
    evidence: compactEventEvidence([
      ...row.evidence,
      ...(row.artifactPaths ?? []).map(path => `artifact:${path}`),
    ]),
  }))
}

export function projectDSXUMcpSkillEvidenceToWorkStateEvents(
  evidenceRows: readonly DSXUMcpSkillWorkStateEvidence[],
): DSXUWorkStateEvent[] {
  return evidenceRows.map(row => ({
    id: `mcp-skill-evidence-${row.id}`,
    kind: 'evidence',
    status: row.decision === 'blocked' ? 'blocked' : 'completed',
    title: row.title,
    owner: row.owner ?? 'MCP / Skill Registry',
    risk: row.decision === 'blocked' ? 'high' : row.registryKind === 'mcp' ? 'medium' : 'low',
    toolName: row.toolName,
    mcpServer: row.mcpServer,
    skillName: row.skillName,
    registryDecision: row.decision,
    artifactPath: row.artifactPaths?.[0],
    evidence: compactEventEvidence([
      `registryKind:${row.registryKind}`,
      `decision:${row.decision}`,
      row.permissionBoundary ? `permissionBoundary:${row.permissionBoundary}` : '',
      ...row.evidence,
      ...(row.artifactPaths ?? []).map(path => `artifact:${path}`),
    ]),
  }))
}

export function projectDSXUPlanTemplateToWorkStateEvents(
  input: DSXUPlanTemplateWorkStateProjectionInput,
): DSXUWorkStateEvent[] {
  const owner = input.owner ?? 'PlanGraph / Work-State'
  const eventEvidence = compactEventEvidence([
    `template:${input.templateId}`,
    `nodes:${input.nodes.map(node => node.id).join('>')}`,
    ...input.nodes.map(
      node => `node:${node.id}:${node.kind ?? 'unknown'}:deps=${(node.deps ?? []).join(',') || 'none'}`,
    ),
    ...(input.evidence ?? []),
  ])

  return [
    {
      id: `plan-template-${input.templateId}`,
      kind: 'plan',
      status: 'planned',
      title: input.title,
      owner,
      risk: input.nodes.length > 3 ? 'medium' : 'low',
      evidence: eventEvidence,
      detail:
        'Plan template is projected into DSXU work-state only. Execution remains in query-loop, Tool Gate, and VerificationKernel.',
    },
    {
      id: `plan-template-${input.templateId}-evidence`,
      kind: 'evidence',
      status: 'completed',
      title: `Plan template ${input.templateId} bound to work-state evidence`,
      owner: 'Evidence / Release',
      evidence: eventEvidence,
    },
  ]
}

export function buildDSXUWorkStateTimeline(input: DSXUWorkStateTimelineInput): DSXUWorkStateTimeline {
  const events = [...input.events]
  const requiresSourceTruth = input.requiresSourceTruth ?? true
  const requiresToolState = input.requiresToolState ?? true
  const requiresPermissionVisibility =
    input.requiresPermissionVisibility ?? hasSideEffectTool(events)
  const requiresCostVisibility = input.requiresCostVisibility ?? true
  const hasFailure = hasKind(events, 'failure')
  const hasUsablePermissionState = hasUsableKind(events, 'permission')
  const hasUsableCostState = hasUsableKind(events, 'cost')

  const coverage: DSXUWorkStateTimeline['coverage'] = {
    hasGoal: hasText(input.goal),
    hasPlan: input.plan.some(hasText),
    hasSourceTruth: hasKind(events, 'source_truth'),
    hasToolState: hasKind(events, 'tool'),
    hasPermissionState: hasKind(events, 'permission'),
    hasFailure,
    hasRecoveryForFailure: !hasFailure || hasKind(events, 'recovery'),
    hasCostState: hasKind(events, 'cost'),
    hasEvidence: events.some(eventHasEvidence),
    hasNextAction: hasText(input.nextAction),
  }

  const guards: string[] = []
  if (!coverage.hasGoal) guards.push('missing visible goal')
  if (!coverage.hasPlan) guards.push('missing visible plan')
  if (requiresSourceTruth && !coverage.hasSourceTruth) guards.push('missing source-truth read state')
  if (requiresToolState && !coverage.hasToolState) guards.push('missing tool execution state')
  if (requiresPermissionVisibility && !coverage.hasPermissionState) {
    guards.push('side-effect tool path lacks visible permission state')
  } else if (requiresPermissionVisibility && !hasUsablePermissionState) {
    guards.push('side-effect tool path has blocked permission state')
  }
  if (!coverage.hasRecoveryForFailure) guards.push('failure has no visible recovery path')
  if (requiresCostVisibility && !coverage.hasCostState) guards.push('missing model/cost/cache state')
  else if (requiresCostVisibility && !hasUsableCostState) guards.push('model/cost/cache state is blocked')
  if (!coverage.hasEvidence) guards.push('missing evidence links')
  if (!coverage.hasNextAction) guards.push('missing next action')

  const operatorSummary = [
    `Goal: ${input.goal.trim() || '<missing>'}`,
    `Current: ${input.currentStepId ?? events.find(event => event.status === 'running')?.id ?? '<not-set>'}`,
    ...events.map(formatEventLine),
    `Next: ${input.nextAction.trim() || '<missing>'}`,
  ]

  return {
    status: guards.length === 0
      ? 'PASS_WORK_STATE_TIMELINE_READY'
      : 'NEEDS_WORK_STATE_TIMELINE_EVIDENCE',
    goal: input.goal,
    plan: [...input.plan],
    currentStepId: input.currentStepId,
    nextAction: input.nextAction,
    events,
    coverage,
    guards,
    operatorSummary,
  }
}

function deriveAllowedNext(
  state: DSXURuntimeStateCardState,
  guards: readonly string[],
): string[] {
  if (guards.length === 0) {
    if (state === 'final') return ['emit_final_answer']
    if (state === 'review') return ['emit_final_answer', 'record_evidence']
    if (state === 'verify') return ['review_result', 'record_evidence']
    return ['verify', 'record_evidence', 'set_next_action']
  }
  const allowed = new Set<string>()
  for (const guard of guards) {
    if (guard.includes('source-truth')) allowed.add('read_source_truth')
    if (guard.includes('permission')) allowed.add('request_or_show_permission')
    if (guard.includes('recovery')) allowed.add('plan_recovery')
    if (guard.includes('model/cost/cache')) allowed.add('record_route_cost_cache')
    if (guard.includes('evidence')) allowed.add('attach_evidence')
    if (guard.includes('next action')) allowed.add('set_next_action')
    if (guard.includes('goal')) allowed.add('restore_goal')
    if (guard.includes('plan')) allowed.add('restore_plan')
  }
  if (allowed.size === 0) allowed.add('replan')
  return [...allowed].slice(0, 3)
}

function deriveBlockedActions(
  timeline: DSXUWorkStateTimeline,
  finalClaimAllowed: boolean,
): string[] {
  const blocked = new Set<string>()
  if (!finalClaimAllowed) blocked.add('claim_pass_or_done')
  if (timeline.guards.some(guard => guard.includes('source-truth'))) {
    blocked.add('edit_without_source_truth')
  }
  if (timeline.guards.some(guard => guard.includes('permission'))) {
    blocked.add('execute_side_effect_without_visible_permission')
  }
  if (timeline.guards.some(guard => guard.includes('recovery'))) {
    blocked.add('continue_after_failure_without_recovery')
  }
  if (timeline.guards.some(guard => guard.includes('model/cost/cache'))) {
    blocked.add('hide_route_cost_cache')
  }
  return [...blocked]
}

function deriveEvidenceRequired(guards: readonly string[]): string[] {
  if (guards.length === 0) return ['final report evidence']
  return guards.map(guard => `resolve:${guard}`)
}

function deriveRecoveryIfFails(guards: readonly string[]): DSXURuntimeRecoveryAction {
  if (guards.some(guard => guard.includes('permission'))) return 'ask-human'
  if (guards.some(guard => guard.includes('source-truth'))) return 'replan'
  if (guards.some(guard => guard.includes('recovery'))) return 'rollback'
  if (guards.some(guard => guard.includes('model/cost/cache'))) return 'flash-max'
  if (guards.length > 0) return 'replan'
  return 'retry'
}

export function buildDSXURuntimeStateCard(input: {
  timeline: DSXUWorkStateTimeline
  state: DSXURuntimeStateCardState
  taskId?: string
  turnId?: string
}): DSXURuntimeStateCard {
  const finalClaimAllowed =
    input.state === 'final' &&
    input.timeline.status === 'PASS_WORK_STATE_TIMELINE_READY'
  return {
    schemaVersion: 'dsxu.runtime-state-card.v1',
    owner: 'PlanGraph / Work-State',
    state: input.state,
    allowedNext: deriveAllowedNext(input.state, input.timeline.guards),
    blockedActions: deriveBlockedActions(input.timeline, finalClaimAllowed),
    evidenceRequired: deriveEvidenceRequired(input.timeline.guards),
    recoveryIfFails: deriveRecoveryIfFails(input.timeline.guards),
    finalClaimAllowed,
    taskId: input.taskId,
    turnId: input.turnId,
    sourceTimelineStatus: input.timeline.status,
    guards: [...input.timeline.guards],
  }
}

export function buildDSXUTaskEvidencePacket(input: {
  timeline: DSXUWorkStateTimeline
  modifiedFiles?: readonly string[]
  checks?: readonly string[]
  results?: readonly string[]
  rollback?: string
  risks?: readonly string[]
}): DSXUTaskEvidencePacket {
  const timelineEvidence = input.timeline.events.flatMap(event => event.evidence ?? [])
  const costLines = input.timeline.events
    .filter(event => event.kind === 'cost')
    .map(event => [
      event.model ? `model:${event.model}` : '',
      event.routeReason ? `route:${event.routeReason}` : '',
      typeof event.costUsd === 'number' ? `costUsd:${event.costUsd}` : '',
      typeof event.cacheHitRatePct === 'number' ? `cacheHitRatePct:${event.cacheHitRatePct}` : '',
      typeof event.toolResultChars === 'number' ? `toolResultChars:${event.toolResultChars}` : '',
    ].filter(Boolean).join(';'))
    .filter(Boolean)
  return {
    schemaVersion: 'dsxu.task-evidence-packet.v1',
    owner: 'Evidence / Release Claim Binder',
    goal: input.timeline.goal,
    plan: input.timeline.plan,
    modifiedFiles: [...(input.modifiedFiles ?? [])],
    checks: [...(input.checks ?? [])],
    results: [...(input.results ?? [])],
    rollback: input.rollback ?? 'manual review if source changed outside DSXU ownership',
    modelCostCache: costLines,
    risks: [...(input.risks ?? input.timeline.guards)],
    nextAction: input.timeline.nextAction,
    finalClaimAllowed: input.timeline.status === 'PASS_WORK_STATE_TIMELINE_READY',
    evidence: compactEventEvidence(timelineEvidence),
  }
}

export function summarizeDSXUWorkStateTimeline(timeline: DSXUWorkStateTimeline): string {
  const guardText = timeline.guards.length === 0
    ? 'guards=none'
    : `guards=${timeline.guards.join('; ')}`
  return [
    `status=${timeline.status}`,
    `goal=${timeline.goal.trim() || '<missing>'}`,
    `events=${timeline.events.length}`,
    guardText,
    `next=${timeline.nextAction.trim() || '<missing>'}`,
  ].join('\n')
}
