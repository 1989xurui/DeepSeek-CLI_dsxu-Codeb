export type DSXUAgentWorkerStatus = 'completed' | 'partial' | 'failed' | 'blocked'

export type DSXUSkillRegistryDecision = 'selected' | 'discarded' | 'blocked'

export type DSXUMcpAdapterDecision = 'registered' | 'invoked' | 'blocked'

export type DSXUBoundaryStatus =
  | 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
  | 'NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE'

export type DSXUAgentWorkerBoundaryEvidence = {
  workerId: string
  role: string
  status: DSXUAgentWorkerStatus
  objective: string
  ownedScope: string[]
  summary: string
  outputPath?: string
  outputHash?: string
  evidenceIds: string[]
  parentFinalCitations: string[]
  returnedTranscriptChars: number
  toolUseCount?: number
  costUsd?: number
}

export type DSXUSkillRegistryBoundaryEvidence = {
  skillId: string
  decision: DSXUSkillRegistryDecision
  priority: number
  conflictPolicy?: 'prefer-higher-priority' | 'keep-registration-order' | 'explicit-owner-override'
  conflictSkillIds: string[]
  discardedConflictSkillIds: string[]
  governanceStatus: 'ready' | 'blocked'
  toolBoundary: string
  permissionBoundary: string
  evidenceIds: string[]
  claimsStandaloneRuntime?: boolean
}

export type DSXUMcpAdapterBoundaryEvidence = {
  serverName: string
  toolName: string
  decision: DSXUMcpAdapterDecision
  schemaVerified: boolean
  secretsRedacted: boolean
  doctorStatus: 'pass' | 'warn' | 'fail'
  toolGateBoundary: string
  permissionBoundary: string
  evidenceIds: string[]
  claimsStandaloneRuntime?: boolean
}

export type DSXUAgentMcpSkillBoundaryInput = {
  generatedAt?: string
  maxReturnedTranscriptChars?: number
  agents: DSXUAgentWorkerBoundaryEvidence[]
  skills: DSXUSkillRegistryBoundaryEvidence[]
  mcpAdapters: DSXUMcpAdapterBoundaryEvidence[]
  sourceEvidence: string[]
  tests: string[]
}

export type DSXUAgentMcpSkillBoundaryBoard = {
  schemaVersion: 'dsxu.agent-mcp-skill-boundary.v1'
  generatedAt: string
  status: DSXUBoundaryStatus
  metrics: {
    agentWorkers: number
    completedOrPartialWorkers: number
    citedWorkers: number
    selectedSkills: number
    governedSkills: number
    mcpAdapters: number
    verifiedMcpAdapters: number
    maxReturnedTranscriptChars: number
  }
  guards: string[]
  allowedClaims: string[]
  blockedClaims: string[]
  ownerCoverage: {
    agentEvidenceEnvelope: boolean
    parentSynthesisGuard: boolean
    skillPriorityConflict: boolean
    skillGovernance: boolean
    mcpSchema: boolean
    mcpSecretRedaction: boolean
    dsxuToolGateBoundary: boolean
    noStandaloneRuntime: boolean
    sourceAndTests: boolean
  }
  compactPanelLines: string[]
  finalReportSection: {
    title: 'Agent/MCP/Skill Boundary'
    status: 'ready' | 'needs-evidence'
    summary: string[]
    evidence: string[]
  }
}

export type DSXUAgentWorkerEnvelopeValidation = {
  schemaVersion: 'dsxu.agent-worker-evidence-envelope-validation.v1'
  owner: 'Agent Evidence Handoff'
  workerId: string
  valid: boolean
  guards: string[]
  evidenceIds: string[]
  parentFinalCitations: string[]
  returnedTranscriptChars: number
}

export function validateDSXUAgentWorkerEvidenceEnvelope(
  worker: DSXUAgentWorkerBoundaryEvidence,
  options: { maxReturnedTranscriptChars?: number } = {},
): DSXUAgentWorkerEnvelopeValidation {
  const maxReturnedTranscriptChars = options.maxReturnedTranscriptChars ?? 2000
  const label = `agent:${worker.workerId}`
  const guards: string[] = []
  if (!worker.summary.trim()) guards.push(`${label} missing summary`)
  if (worker.ownedScope.length === 0) guards.push(`${label} missing owned scope`)
  if (worker.status === 'completed' || worker.status === 'partial') {
    if (!worker.outputPath) guards.push(`${label} missing output path`)
    if (!worker.outputHash) guards.push(`${label} missing output hash`)
    if (worker.evidenceIds.length === 0) guards.push(`${label} missing evidence ids`)
    if (!worker.parentFinalCitations.some(citation => worker.evidenceIds.includes(citation))) {
      guards.push(`${label} parent final does not cite worker evidence`)
    }
  }
  if (worker.returnedTranscriptChars > maxReturnedTranscriptChars) {
    guards.push(`${label} returned raw transcript exceeds boundary`)
  }
  return {
    schemaVersion: 'dsxu.agent-worker-evidence-envelope-validation.v1',
    owner: 'Agent Evidence Handoff',
    workerId: worker.workerId,
    valid: guards.length === 0,
    guards,
    evidenceIds: worker.evidenceIds,
    parentFinalCitations: worker.parentFinalCitations,
    returnedTranscriptChars: worker.returnedTranscriptChars,
  }
}

export function buildDSXUAgentMcpSkillBoundaryBoard(
  input: DSXUAgentMcpSkillBoundaryInput,
): DSXUAgentMcpSkillBoundaryBoard {
  const maxReturnedTranscriptChars = input.maxReturnedTranscriptChars ?? 2000
  const guards: string[] = []

  for (const worker of input.agents) {
    guards.push(...validateDSXUAgentWorkerEvidenceEnvelope(worker, {
      maxReturnedTranscriptChars,
    }).guards)
  }

  for (const skill of input.skills) {
    const label = `skill:${skill.skillId}`
    if (skill.governanceStatus !== 'ready') guards.push(`${label} governance is blocked`)
    if (!mentionsToolGate(skill.toolBoundary)) guards.push(`${label} missing DSXU Tool Gate boundary`)
    if (!skill.permissionBoundary.trim()) guards.push(`${label} missing permission boundary`)
    if (skill.claimsStandaloneRuntime) guards.push(`${label} claims standalone runtime`)
    if (skill.decision === 'selected' && skill.conflictSkillIds.length > 0) {
      if (!skill.conflictPolicy) guards.push(`${label} missing conflict policy`)
      if (skill.discardedConflictSkillIds.length === 0) guards.push(`${label} missing discarded conflict evidence`)
    }
    if (skill.evidenceIds.length === 0) guards.push(`${label} missing evidence ids`)
  }

  for (const adapter of input.mcpAdapters) {
    const label = `mcp:${adapter.serverName}/${adapter.toolName}`
    if (adapter.decision !== 'blocked') {
      if (!adapter.schemaVerified) guards.push(`${label} schema not verified`)
      if (!adapter.secretsRedacted) guards.push(`${label} secrets not redacted`)
      if (adapter.doctorStatus === 'fail') guards.push(`${label} doctor failed`)
    }
    if (!mentionsToolGate(adapter.toolGateBoundary)) guards.push(`${label} missing DSXU Tool Gate boundary`)
    if (!adapter.permissionBoundary.trim()) guards.push(`${label} missing permission boundary`)
    if (adapter.claimsStandaloneRuntime) guards.push(`${label} claims standalone runtime`)
    if (adapter.evidenceIds.length === 0) guards.push(`${label} missing evidence ids`)
  }

  if (input.agents.length === 0) guards.push('missing agent worker evidence')
  if (input.skills.length === 0) guards.push('missing skill registry evidence')
  if (input.mcpAdapters.length === 0) guards.push('missing MCP adapter evidence')
  if (input.sourceEvidence.length === 0) guards.push('missing source evidence')
  if (input.tests.length === 0) guards.push('missing test evidence')

  const completedOrPartialWorkers = input.agents.filter(
    worker => worker.status === 'completed' || worker.status === 'partial',
  )
  const citedWorkers = completedOrPartialWorkers.filter(worker =>
    worker.parentFinalCitations.some(citation => worker.evidenceIds.includes(citation)),
  )
  const selectedSkills = input.skills.filter(skill => skill.decision === 'selected')
  const governedSkills = input.skills.filter(skill => skill.governanceStatus === 'ready')
  const verifiedMcpAdapters = input.mcpAdapters.filter(
    adapter => adapter.schemaVerified && adapter.secretsRedacted && adapter.doctorStatus !== 'fail',
  )
  const ownerCoverage = {
    agentEvidenceEnvelope:
      completedOrPartialWorkers.length > 0 &&
      completedOrPartialWorkers.every(worker =>
        Boolean(worker.outputPath) &&
        Boolean(worker.outputHash) &&
        worker.evidenceIds.length > 0 &&
        worker.summary.trim().length > 0,
      ),
    parentSynthesisGuard:
      completedOrPartialWorkers.length > 0 &&
      citedWorkers.length === completedOrPartialWorkers.length,
    skillPriorityConflict:
      selectedSkills.length > 0 &&
      selectedSkills.every(skill =>
        skill.conflictSkillIds.length === 0 ||
        Boolean(skill.conflictPolicy && skill.discardedConflictSkillIds.length > 0),
      ),
    skillGovernance:
      input.skills.length > 0 &&
      input.skills.every(skill =>
        skill.governanceStatus === 'ready' &&
        mentionsToolGate(skill.toolBoundary) &&
        skill.evidenceIds.length > 0,
      ),
    mcpSchema:
      input.mcpAdapters.length > 0 &&
      input.mcpAdapters.every(adapter => adapter.decision === 'blocked' || adapter.schemaVerified),
    mcpSecretRedaction:
      input.mcpAdapters.length > 0 &&
      input.mcpAdapters.every(adapter => adapter.decision === 'blocked' || adapter.secretsRedacted),
    dsxuToolGateBoundary:
      input.skills.every(skill => mentionsToolGate(skill.toolBoundary)) &&
      input.mcpAdapters.every(adapter => mentionsToolGate(adapter.toolGateBoundary)),
    noStandaloneRuntime:
      !input.skills.some(skill => skill.claimsStandaloneRuntime) &&
      !input.mcpAdapters.some(adapter => adapter.claimsStandaloneRuntime),
    sourceAndTests: input.sourceEvidence.length > 0 && input.tests.length > 0,
  }
  const status = guards.length === 0 && Object.values(ownerCoverage).every(Boolean)
    ? 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
    : 'NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE'
  const compactPanelLines = [
    `Agent evidence: workers=${input.agents.length} cited=${citedWorkers.length}/${completedOrPartialWorkers.length}`,
    `Skill registry: selected=${selectedSkills.length} governed=${governedSkills.length}/${input.skills.length}`,
    `MCP adapters: verified=${verifiedMcpAdapters.length}/${input.mcpAdapters.length}`,
    `Boundary: toolGate=${String(ownerCoverage.dsxuToolGateBoundary)} standaloneRuntime=${String(!ownerCoverage.noStandaloneRuntime)}`,
    `Status: ${status}`,
  ]
  const compactEvidence = [
    ...input.sourceEvidence,
    ...input.tests,
    ...input.agents.flatMap(worker => worker.evidenceIds),
    ...input.skills.flatMap(skill => skill.evidenceIds),
    ...input.mcpAdapters.flatMap(adapter => adapter.evidenceIds),
  ].map(item => item.trim()).filter(Boolean)

  return {
    schemaVersion: 'dsxu.agent-mcp-skill-boundary.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status,
    metrics: {
      agentWorkers: input.agents.length,
      completedOrPartialWorkers: completedOrPartialWorkers.length,
      citedWorkers: citedWorkers.length,
      selectedSkills: selectedSkills.length,
      governedSkills: governedSkills.length,
      mcpAdapters: input.mcpAdapters.length,
      verifiedMcpAdapters: verifiedMcpAdapters.length,
      maxReturnedTranscriptChars,
    },
    guards,
    allowedClaims: status === 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
      ? [
        'DSXU agents may be described as serial/parallel workers only when parent finals cite summary/path/hash/evidence envelopes.',
        'DSXU skills may be described as registry-governed extensions with priority and conflict evidence.',
        'DSXU MCP may be described as Tool Gate governed adapter intake with schema verification and secret redaction evidence.',
      ]
      : [],
    blockedClaims: [
      'Do not claim swarm, agent-of-agents, manager mesh, or autonomous background polling runtime.',
      'Do not claim arbitrary skill marketplace execution without DSXU registry priority/conflict and Tool Gate evidence.',
      'Do not claim standalone MCP runtime or direct external-tool execution outside DSXU Tool Gate.',
      'Do not claim worker PASS from uncited child transcript or raw transcript bloat.',
    ],
    ownerCoverage,
    compactPanelLines,
    finalReportSection: {
      title: 'Agent/MCP/Skill Boundary',
      status: status === 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
        ? 'ready'
        : 'needs-evidence',
      summary: [
        `status=${status}`,
        `agentWorkers=${input.agents.length}`,
        `citedWorkers=${citedWorkers.length}/${completedOrPartialWorkers.length}`,
        `selectedSkills=${selectedSkills.length}`,
        `verifiedMcpAdapters=${verifiedMcpAdapters.length}/${input.mcpAdapters.length}`,
        `noStandaloneRuntime=${String(ownerCoverage.noStandaloneRuntime)}`,
      ],
      evidence: [...new Set(compactEvidence)].slice(0, 30),
    },
  }
}

function mentionsToolGate(value: string): boolean {
  return /DSXU\s+Tool\s+Gate|Tool\s+Gate/i.test(value)
}
