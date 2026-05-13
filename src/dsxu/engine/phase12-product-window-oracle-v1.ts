import {
  buildDsxuToolEvidencePack,
  validateDsxuToolEvidencePack,
  type DsxuToolEvidencePack,
} from './tool-evidence-pack-v1'
import {
  buildDsxuContextOwnerRuleDecision,
  validateDsxuContextOwnerRuleDecision,
  type DsxuContextOwnerRuleDecision,
} from './context-owner-rule-v1'
import {
  buildSkillGovernanceContract,
  validateSkillGovernanceContract,
  type SkillGovernanceContract,
} from './skill-governance-v1'
import { evaluateToolGate } from './tool-gate-v1'
import { convertRuntimeToolToV1 } from './tool-registry-v1'
import type { SkillDefinition } from './skills-types-v1'

export type P12ProductWindowScenarioId =
  | 'P12-10-A-two-session-isolation'
  | 'P12-10-B-permission-handoff'
  | 'P12-10-C-background-notification'
  | 'P12-10-D-compact-resume-pending-work'
  | 'P12-10-E-skill-governed-window'

export type P12ProductWindowScenarioStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type P12ProductWindowEventType =
  | 'human_turn_started'
  | 'active_session_set'
  | 'tool_permission_requested'
  | 'permission_wait_visible'
  | 'permission_resolved'
  | 'tool_evidence_recorded'
  | 'background_task_started'
  | 'background_task_completed'
  | 'background_notification_recorded'
  | 'compact_snapshot_created'
  | 'resume_started'
  | 'context_owner_rule_checked'
  | 'skill_governance_checked'
  | 'human_turn_completed'

export type P12ProductWindowEvent = {
  event: P12ProductWindowEventType
  sessionId: string
  activeSessionId: string
  at: number
  summary: string
  toolTraceId?: string
  notificationId?: string
}

export type P12ProductWindowSession = {
  sessionId: string
  title: string
  role: 'active-human' | 'background' | 'inactive-human'
}

export type P12ProductWindowContaminationChecks = {
  inactiveSessionInjected: boolean
  permissionPreemptedActiveTurn: boolean
  hiddenPermissionWait: boolean
  backgroundResultInjected: boolean
  resumeClaimedPassWithoutOwnerRule: boolean
}

export type P12ProductWindowScenarioInput = {
  scenarioId: P12ProductWindowScenarioId
  title: string
  sessions: readonly P12ProductWindowSession[]
  activeSessionId: string
  events: readonly P12ProductWindowEvent[]
  toolEvidencePacks: readonly DsxuToolEvidencePack[]
  contextOwnerRules: readonly DsxuContextOwnerRuleDecision[]
  skillGovernanceContracts?: readonly SkillGovernanceContract[]
  expectedArtifacts: readonly string[]
  contaminationChecks: P12ProductWindowContaminationChecks
}

export type P12ProductWindowScenarioResult = P12ProductWindowScenarioInput & {
  status: P12ProductWindowScenarioStatus
  redlines: readonly string[]
  evidenceSummary: {
    sessionCount: number
    eventCount: number
    toolEvidenceTraceIds: readonly string[]
    contextOwnerRuleCount: number
    skillGovernanceCount: number
    visiblePermissionWaitCount: number
    backgroundNotificationCount: number
  }
}

export type P12ProductWindowOracleResult = {
  schemaVersion: 'dsxu.phase12-product-window-oracle.v1'
  phase12Id: 'P12-10'
  status: P12ProductWindowScenarioStatus
  scenarioCount: number
  pass: number
  partial: number
  blocked: number
  mustNotClaimDone: boolean
  scenarios: readonly P12ProductWindowScenarioResult[]
  requiredArtifacts: readonly string[]
  redlines: readonly string[]
}

export function evaluateP12ProductWindowScenario(
  input: P12ProductWindowScenarioInput,
): P12ProductWindowScenarioResult {
  const redlines: string[] = []
  const sessionIds = new Set(input.sessions.map(session => session.sessionId))
  const activeSession = input.sessions.find(session => session.sessionId === input.activeSessionId)

  if (input.sessions.length < 2) redlines.push('requires at least two product-window sessions')
  if (!activeSession) redlines.push('active session is missing')
  if (activeSession && activeSession.role !== 'active-human') redlines.push('active session must be active-human')
  if (input.events.some(event => !sessionIds.has(event.sessionId) || !sessionIds.has(event.activeSessionId))) {
    redlines.push('event references an unknown session')
  }

  const permissionRequested = input.events.some(event => event.event === 'tool_permission_requested')
  const visiblePermissionWaitCount = input.events.filter(event => event.event === 'permission_wait_visible').length
  if (permissionRequested && visiblePermissionWaitCount === 0) {
    redlines.push('permission wait is hidden')
  }

  const backgroundCompletedAt = firstEventIndex(input.events, 'background_task_completed')
  const backgroundNotificationAt = firstEventIndex(input.events, 'background_notification_recorded')
  if (backgroundCompletedAt >= 0 && backgroundNotificationAt < backgroundCompletedAt) {
    redlines.push('background notification appeared before completion evidence')
  }

  const toolViolations = input.toolEvidencePacks.flatMap(pack => {
    const validation = validateDsxuToolEvidencePack(pack)
    return validation.valid ? [] : [...validation.missingFields, ...validation.violations]
  })
  if (toolViolations.length > 0) redlines.push(`invalid tool evidence: ${toolViolations.join('; ')}`)

  const ownerViolations = input.contextOwnerRules.flatMap(rule => {
    const validation = validateDsxuContextOwnerRuleDecision(rule)
    return validation.valid ? [] : [...validation.missingFields, ...validation.violations]
  })
  if (ownerViolations.length > 0) redlines.push(`invalid context owner rule: ${ownerViolations.join('; ')}`)

  const skillViolations = (input.skillGovernanceContracts ?? []).flatMap(contract => {
    const validation = validateSkillGovernanceContract(contract)
    return validation.valid ? [] : [...validation.missingFields, ...validation.violations]
  })
  if (skillViolations.length > 0) redlines.push(`invalid skill governance: ${skillViolations.join('; ')}`)

  if (input.contaminationChecks.inactiveSessionInjected) redlines.push('inactive session output entered active turn')
  if (input.contaminationChecks.permissionPreemptedActiveTurn) redlines.push('permission handoff preempted active human turn')
  if (input.contaminationChecks.hiddenPermissionWait) redlines.push('permission wait had no visible state')
  if (input.contaminationChecks.backgroundResultInjected) redlines.push('background result was injected without notification evidence')
  if (input.contaminationChecks.resumeClaimedPassWithoutOwnerRule) {
    redlines.push('resume claimed PASS without context owner rule')
  }
  if (input.expectedArtifacts.length === 0) redlines.push('missing expected product-window artifacts')

  const status: P12ProductWindowScenarioStatus =
    redlines.some(redline => redline.includes('hidden') || redline.includes('preempted') || redline.includes('injected'))
      ? 'BLOCKED'
      : redlines.length > 0
        ? 'PARTIAL'
        : 'PASS'

  return {
    ...input,
    status,
    redlines,
    evidenceSummary: {
      sessionCount: input.sessions.length,
      eventCount: input.events.length,
      toolEvidenceTraceIds: input.toolEvidencePacks.map(pack => pack.traceId),
      contextOwnerRuleCount: input.contextOwnerRules.length,
      skillGovernanceCount: input.skillGovernanceContracts?.length ?? 0,
      visiblePermissionWaitCount,
      backgroundNotificationCount: input.events.filter(event => event.event === 'background_notification_recorded').length,
    },
  }
}

export function buildP12ProductWindowOracle(
  scenarios: readonly P12ProductWindowScenarioInput[] = buildDefaultP12ProductWindowScenarios(),
): P12ProductWindowOracleResult {
  const evaluated = scenarios.map(evaluateP12ProductWindowScenario)
  const pass = evaluated.filter(scenario => scenario.status === 'PASS').length
  const partial = evaluated.filter(scenario => scenario.status === 'PARTIAL').length
  const blocked = evaluated.filter(scenario => scenario.status === 'BLOCKED').length
  const requiredArtifacts = [...new Set(evaluated.flatMap(scenario => scenario.expectedArtifacts))]
  const redlines = evaluated.flatMap(scenario =>
    scenario.redlines.map(redline => `${scenario.scenarioId}: ${redline}`),
  )
  return {
    schemaVersion: 'dsxu.phase12-product-window-oracle.v1',
    phase12Id: 'P12-10',
    status: blocked > 0 ? 'BLOCKED' : partial > 0 ? 'PARTIAL' : 'PASS',
    scenarioCount: evaluated.length,
    pass,
    partial,
    blocked,
    mustNotClaimDone: partial > 0 || blocked > 0,
    scenarios: evaluated,
    requiredArtifacts,
    redlines,
  }
}

export function buildDefaultP12ProductWindowScenarios(): P12ProductWindowScenarioInput[] {
  const sessions: P12ProductWindowSession[] = [
    { sessionId: 'session-a', title: 'active coding turn', role: 'active-human' },
    { sessionId: 'session-b', title: 'background permission turn', role: 'background' },
  ]
  const safeContextOwner = buildDsxuContextOwnerRuleDecision({
    goal: 'continue active coding task',
    currentSourceFiles: ['src/App.tsx'],
    filesChanged: ['src/App.tsx'],
    rereadFiles: ['src/App.tsx'],
    sourceTruthRefreshRequired: true,
    sourceTruthRereadAfterResume: true,
    verificationStatus: 'passed',
    verificationEvidenceAfterResume: true,
    failedCommands: [],
    permissionDenials: [],
    toolEvidenceTraceIds: ['tool-approval-read'],
  })
  const resumeOwner = buildDsxuContextOwnerRuleDecision({
    goal: 'resume active coding task',
    currentSourceFiles: ['src/App.tsx'],
    filesChanged: ['src/App.tsx'],
    rereadFiles: ['src/App.tsx'],
    sourceTruthRefreshRequired: true,
    sourceTruthRereadAfterResume: false,
    verificationStatus: 'failed',
    verificationEvidenceAfterResume: false,
    failedCommands: ['bun test src/app.test.ts'],
    permissionDenials: ['write permission pending in session-b'],
    toolEvidenceTraceIds: ['tool-approval-edit'],
  })
  const readEvidence = buildProductWindowToolEvidence({
    queryTurnId: 'session-a-turn-1',
    originalToolId: 'FileReadTool',
    resolvedToolId: 'Read',
    toolUseId: 'tool-read-session-a',
    readOnly: true,
  })
  const editEvidence = buildProductWindowToolEvidence({
    queryTurnId: 'session-b-turn-1',
    originalToolId: 'FileEditTool',
    resolvedToolId: 'Edit',
    toolUseId: 'tool-edit-session-b',
    readOnly: false,
    permissionAllowed: false,
  })
  const workflowEvidence = buildProductWindowToolEvidence({
    queryTurnId: 'session-b-turn-2',
    originalToolId: 'WorkflowTool',
    resolvedToolId: 'WorkflowTool',
    toolUseId: 'tool-workflow-session-b',
    readOnly: false,
  })
  const skillContract = buildSkillGovernanceContract({
    skillId: 'product-window-code-edit-skill',
    metadata: {
      name: 'product-window-code-edit-skill',
      description: 'governed code edit skill for product-window replay',
      version: '1.0.0',
      owner: 'dsxu-mainline',
      tags: ['code-edit'],
    },
    input: { requiredFields: ['taskText'], optionalFields: ['context'], schemaHint: 'task' },
    output: { outputFields: ['result'], qualitySignals: ['evidence'], failureSignals: ['blocked'] },
    triggers: [{ id: 'product-window-code-edit-trigger', type: 'keyword', expression: 'edit', weight: 1 }],
    constraints: [],
  } satisfies SkillDefinition)

  return [
    {
      scenarioId: 'P12-10-A-two-session-isolation',
      title: 'two active sessions keep human turns isolated',
      sessions,
      activeSessionId: 'session-a',
      events: [
        event('human_turn_started', 'session-a', 'session-a', 1, 'active user turn starts'),
        event('active_session_set', 'session-a', 'session-a', 2, 'session-a owns current turn'),
        event('tool_evidence_recorded', 'session-a', 'session-a', 3, 'read evidence recorded', readEvidence.traceId),
        event('human_turn_completed', 'session-a', 'session-a', 4, 'active turn completed'),
      ],
      toolEvidencePacks: [readEvidence],
      contextOwnerRules: [safeContextOwner],
      expectedArtifacts: ['product-window/session-isolation.transcript.json', 'product-window/session-isolation.trace.json'],
      contaminationChecks: cleanChecks(),
    },
    {
      scenarioId: 'P12-10-B-permission-handoff',
      title: 'permission handoff stays visible and does not preempt active turn',
      sessions,
      activeSessionId: 'session-a',
      events: [
        event('human_turn_started', 'session-a', 'session-a', 1, 'active turn continues'),
        event('tool_permission_requested', 'session-b', 'session-a', 2, 'background edit asks permission'),
        event('permission_wait_visible', 'session-b', 'session-a', 3, 'permission wait is visible outside active turn'),
        event('tool_evidence_recorded', 'session-b', 'session-a', 4, 'blocked edit evidence recorded', editEvidence.traceId),
        event('permission_resolved', 'session-b', 'session-a', 5, 'permission remains scoped to session-b'),
      ],
      toolEvidencePacks: [editEvidence],
      contextOwnerRules: [resumeOwner],
      expectedArtifacts: ['product-window/permission-handoff.transcript.json', 'product-window/permission-handoff.trace.json'],
      contaminationChecks: cleanChecks(),
    },
    {
      scenarioId: 'P12-10-C-background-notification',
      title: 'background completion notifies after evidence exists',
      sessions,
      activeSessionId: 'session-a',
      events: [
        event('background_task_started', 'session-b', 'session-a', 1, 'background workflow starts'),
        event('tool_evidence_recorded', 'session-b', 'session-a', 2, 'workflow tool evidence exists', workflowEvidence.traceId),
        event('background_task_completed', 'session-b', 'session-a', 3, 'background workflow completed with evidence'),
        event('background_notification_recorded', 'session-b', 'session-a', 4, 'notification is recorded after completion', undefined, 'notify-bg-1'),
      ],
      toolEvidencePacks: [workflowEvidence],
      contextOwnerRules: [safeContextOwner],
      expectedArtifacts: ['product-window/background-notification.transcript.json', 'product-window/background-notification.trace.json'],
      contaminationChecks: cleanChecks(),
    },
    {
      scenarioId: 'P12-10-D-compact-resume-pending-work',
      title: 'compact resume preserves pending permission and background state',
      sessions,
      activeSessionId: 'session-a',
      events: [
        event('compact_snapshot_created', 'session-a', 'session-a', 1, 'snapshot records pending background and permission state'),
        event('resume_started', 'session-a', 'session-a', 2, 'resume starts without claiming completion'),
        event('context_owner_rule_checked', 'session-a', 'session-a', 3, 'owner rule blocks pass until source and verification refresh'),
        event('permission_wait_visible', 'session-b', 'session-a', 4, 'pending permission remains visible after resume'),
      ],
      toolEvidencePacks: [editEvidence],
      contextOwnerRules: [resumeOwner],
      expectedArtifacts: ['product-window/compact-resume.transcript.json', 'product-window/compact-resume.trace.json'],
      contaminationChecks: cleanChecks(),
    },
    {
      scenarioId: 'P12-10-E-skill-governed-window',
      title: 'skill use in product window obeys tool and context contracts',
      sessions,
      activeSessionId: 'session-a',
      events: [
        event('human_turn_started', 'session-a', 'session-a', 1, 'active skill-assisted turn starts'),
        event('skill_governance_checked', 'session-a', 'session-a', 2, 'skill governance is checked before tool use'),
        event('context_owner_rule_checked', 'session-a', 'session-a', 3, 'context owner rule is checked before edit/pass'),
        event('tool_evidence_recorded', 'session-a', 'session-a', 4, 'read evidence recorded for skill', readEvidence.traceId),
      ],
      toolEvidencePacks: [readEvidence],
      contextOwnerRules: [safeContextOwner],
      skillGovernanceContracts: [skillContract],
      expectedArtifacts: ['product-window/skill-governed-window.transcript.json', 'product-window/skill-governed-window.trace.json'],
      contaminationChecks: cleanChecks(),
    },
  ]
}

function buildProductWindowToolEvidence(input: {
  queryTurnId: string
  originalToolId: string
  resolvedToolId: string
  toolUseId: string
  readOnly: boolean
  permissionAllowed?: boolean
}): DsxuToolEvidencePack {
  const tool = convertRuntimeToolToV1({
    name: input.resolvedToolId,
    description: `${input.resolvedToolId} product-window replay tool`,
    readOnly: input.readOnly,
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
    execute: async () => ({ content: 'ok', isError: false }),
  })
  const permissionAllowed = input.permissionAllowed ?? true
  const gate = evaluateToolGate(tool, {
    allowedPermissionLevel: input.readOnly ? 'safe' : 'guarded',
    requireConfirmationForWrite: !permissionAllowed,
  })
  return buildDsxuToolEvidencePack({
    queryTurnId: input.queryTurnId,
    toolUseId: input.toolUseId,
    originalToolId: input.originalToolId,
    resolvedToolId: input.resolvedToolId,
    capabilityTags: tool.capabilityTags,
    readWriteClass: tool.readWriteClass,
    permission: {
      allowed: permissionAllowed,
      reason: permissionAllowed ? 'product-window replay permission allowed' : 'product-window replay permission pending',
    },
    gate,
    result: permissionAllowed
      ? { toolUseId: input.toolUseId, content: 'product-window replay ok', isError: false }
      : undefined,
    now: 10,
  })
}

function event(
  type: P12ProductWindowEventType,
  sessionId: string,
  activeSessionId: string,
  at: number,
  summary: string,
  toolTraceId?: string,
  notificationId?: string,
): P12ProductWindowEvent {
  return { event: type, sessionId, activeSessionId, at, summary, toolTraceId, notificationId }
}

function cleanChecks(): P12ProductWindowContaminationChecks {
  return {
    inactiveSessionInjected: false,
    permissionPreemptedActiveTurn: false,
    hiddenPermissionWait: false,
    backgroundResultInjected: false,
    resumeClaimedPassWithoutOwnerRule: false,
  }
}

function firstEventIndex(events: readonly P12ProductWindowEvent[], eventType: P12ProductWindowEventType): number {
  return events.findIndex(event => event.event === eventType)
}
