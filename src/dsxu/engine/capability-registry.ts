import type { DSXUExecutionTaskType } from './action-contract'

export type DSXUCapabilityExposure =
  | 'mainline'
  | 'sidecar'
  | 'searchable'
  | 'expert'
  | 'experiment'
  | 'frozen'
  | 'legacy'

export type DSXUCapabilityActivation =
  | 'default'
  | 'task_contract'
  | 'explicit_user'
  | 'slash_command'
  | 'domain_match'
  | 'mcp_reference'
  | 'skill_match'
  | 'owner_review'
  | 'never_default'

export type DSXUCapabilityEvidenceLevel =
  | 'E0_NONE'
  | 'E1_SOURCE'
  | 'E2_TEST'
  | 'E3_INTERNAL_REPLAY_CONTRACT'
  | 'E4_LIVE_BASIC'
  | 'E5_EXTERNAL_RAW'

export type DSXUCapabilityClaimPolicy =
  | 'claim_allowed'
  | 'claim_with_boundary'
  | 'claim_blocked'

export type DSXUCapabilityEntry = {
  id: string
  owner: string
  exposure: DSXUCapabilityExposure
  activation: readonly DSXUCapabilityActivation[]
  evidenceLevel: DSXUCapabilityEvidenceLevel
  claimPolicy: DSXUCapabilityClaimPolicy
  sourcePaths: readonly string[]
  toolIds?: readonly string[]
  notes?: readonly string[]
}

export type DSXUCapabilityRegistry = {
  schemaVersion: 'dsxu.capability-registry.v6s'
  owner: 'Runtime control plane'
  entries: readonly DSXUCapabilityEntry[]
  summary: {
    total: number
    byExposure: Record<DSXUCapabilityExposure, number>
    publicClaimBlocked: number
  }
}

export type DSXUCapabilityActivationPlan = {
  schemaVersion: 'dsxu.capability-activation-plan.v6s'
  taskType: DSXUExecutionTaskType
  activeCapabilityIds: readonly string[]
  blockedCapabilityIds: readonly string[]
  visibleOrchestrationModes: readonly ['serial worker', 'parallel fanout']
  evidence: readonly string[]
  guards: readonly string[]
}

const EXPOSURES: DSXUCapabilityExposure[] = [
  'mainline',
  'sidecar',
  'searchable',
  'expert',
  'experiment',
  'frozen',
  'legacy',
]

export const V6S_DEFAULT_CAPABILITY_ENTRIES: readonly DSXUCapabilityEntry[] = [
  {
    id: 'task-contract',
    owner: 'Query Loop / PlanGraph',
    exposure: 'mainline',
    activation: ['default'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_allowed',
    sourcePaths: ['src/dsxu/engine/action-contract.ts'],
  },
  {
    id: 'tool-view',
    owner: 'Tool Gate',
    exposure: 'mainline',
    activation: ['default'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_allowed',
    sourcePaths: ['src/dsxu/engine/tool-catalog-v1.ts'],
    toolIds: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'PowerShell', 'Todo', 'LSP', 'GitDiff'],
  },
  {
    id: 'strict-schema-gateway',
    owner: 'DeepSeek Provider / Tool Protocol',
    exposure: 'mainline',
    activation: ['default'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_allowed',
    sourcePaths: ['src/services/api/deepseek-adapter.ts'],
  },
  {
    id: 'provider.deepseek',
    owner: 'DeepSeek Provider / Cost Cache',
    exposure: 'mainline',
    activation: ['default'],
    evidenceLevel: 'E4_LIVE_BASIC',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/services/api/deepseek-adapter.ts', 'scripts/dsxu-v6-live-provider-probe.ts'],
  },
  {
    id: 'ledger.trust-surface',
    owner: 'Ledger / TUI Trust Surface',
    exposure: 'mainline',
    activation: ['default'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_allowed',
    sourcePaths: ['src/dsxu/engine/progress-ledger.ts', 'src/components/DsxuTrustState.tsx'],
  },
  {
    id: 'agent.serial-worker',
    owner: 'DSXU Agent Orchestrator',
    exposure: 'sidecar',
    activation: ['task_contract', 'explicit_user'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/tools/AgentTool/AgentTool.tsx', 'src/tools/AgentTool/prompt.ts'],
    toolIds: ['Agent', 'SendMessage'],
  },
  {
    id: 'agent.parallel-fanout',
    owner: 'DSXU Agent Orchestrator',
    exposure: 'sidecar',
    activation: ['task_contract', 'explicit_user'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/tools/AgentTool/AgentTool.tsx', 'src/tools/AgentTool/prompt.ts'],
    toolIds: ['Agent', 'SendMessage'],
  },
  {
    id: 'skills.searchable',
    owner: 'Skill Runtime',
    exposure: 'searchable',
    activation: ['skill_match', 'slash_command', 'task_contract'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/tools/SkillTool/prompt.ts', 'src/dsxu/engine/skill-governance-v1.ts'],
    toolIds: ['Skill', 'SkillTool', 'DiscoverSkills'],
  },
  {
    id: 'web.search.fetch',
    owner: 'Tool Gate / Network Tool Policy',
    exposure: 'searchable',
    activation: ['explicit_user', 'domain_match', 'task_contract'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/tools/WebSearchTool', 'src/tools/WebFetchTool', 'src/dsxu/engine/permissions.ts'],
    toolIds: ['WebSearch', 'WebFetch'],
    notes: ['network tools are available through Tool Gate, but are not part of the default V8 tool view'],
  },
  {
    id: 'mcp.expert',
    owner: 'MCP Runtime',
    exposure: 'expert',
    activation: ['mcp_reference', 'task_contract', 'explicit_user'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/services/mcp', 'src/tools/MCPTool'],
    toolIds: ['MCP', 'MCPTool', 'ListMcpResourcesTool', 'ReadMcpResourceTool'],
  },
  {
    id: 'workflow.expert',
    owner: 'Workflow Runtime',
    exposure: 'expert',
    activation: ['task_contract', 'explicit_user'],
    evidenceLevel: 'E1_SOURCE',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/dsxu/engine'],
    toolIds: ['Workflow', 'WorkflowTool'],
  },
  {
    id: 'memory.context',
    owner: 'Context / Memory / Compact',
    exposure: 'sidecar',
    activation: ['default', 'task_contract'],
    evidenceLevel: 'E2_TEST',
    claimPolicy: 'claim_with_boundary',
    sourcePaths: ['src/dsxu/engine/memory', 'src/dsxu/engine/context-pressure-matrix.ts'],
  },
  {
    id: 'evidence.release-binder',
    owner: 'Evidence / Release Claim Binder',
    exposure: 'sidecar',
    activation: ['task_contract', 'owner_review'],
    evidenceLevel: 'E3_INTERNAL_REPLAY_CONTRACT',
    claimPolicy: 'claim_blocked',
    sourcePaths: ['scripts/dsxu-v6-owner-cleanup-check.ts', 'docs/generated'],
  },
  {
    id: 'swarm.team.mesh',
    owner: 'Agent Runtime Governance',
    exposure: 'frozen',
    activation: ['never_default'],
    evidenceLevel: 'E1_SOURCE',
    claimPolicy: 'claim_blocked',
    sourcePaths: ['src/tools/AgentTool/prompt.ts'],
    toolIds: ['SwarmCoordinator', 'TeamCreate', 'Voting', 'Counterfactual'],
  },
  {
    id: 'tool-bus.legacy',
    owner: 'Tool Protocol Governance',
    exposure: 'legacy',
    activation: ['owner_review'],
    evidenceLevel: 'E1_SOURCE',
    claimPolicy: 'claim_blocked',
    sourcePaths: ['src/dsxu/engine/tool-bus/index.ts'],
    toolIds: ['LegacyToolBus'],
    notes: ['not a V6 default-mainline tool protocol owner'],
  },
]

function countByExposure(entries: readonly DSXUCapabilityEntry[]): Record<DSXUCapabilityExposure, number> {
  const out = Object.fromEntries(EXPOSURES.map(exposure => [exposure, 0])) as Record<DSXUCapabilityExposure, number>
  for (const entry of entries) out[entry.exposure] += 1
  return out
}

export function buildDSXUCapabilityRegistry(
  entries: readonly DSXUCapabilityEntry[] = V6S_DEFAULT_CAPABILITY_ENTRIES,
): DSXUCapabilityRegistry {
  const deduped = new Map<string, DSXUCapabilityEntry>()
  for (const entry of entries) {
    if (!entry.id.trim()) throw new Error('capability id is required')
    deduped.set(entry.id, entry)
  }
  const values = [...deduped.values()]
  return {
    schemaVersion: 'dsxu.capability-registry.v6s',
    owner: 'Runtime control plane',
    entries: values,
    summary: {
      total: values.length,
      byExposure: countByExposure(values),
      publicClaimBlocked: values.filter(entry => entry.claimPolicy === 'claim_blocked').length,
    },
  }
}

export function getDSXUCapabilityEntry(
  registry: DSXUCapabilityRegistry,
  id: string,
): DSXUCapabilityEntry | undefined {
  return registry.entries.find(entry => entry.id === id)
}

export function resolveDSXUToolCapabilityExposure(
  toolId: string,
  registry: DSXUCapabilityRegistry = buildDSXUCapabilityRegistry(),
): DSXUCapabilityExposure {
  const normalized = toolId.toLowerCase()
  if (/^web(?:search|fetch)$/.test(normalized)) return 'searchable'
  if (/forked|remoteagent/.test(normalized)) return 'expert'
  if (/swarm|team|voting|counterfactual/.test(normalized)) return 'frozen'
  const matched = registry.entries.find(entry =>
    entry.toolIds?.some(id => id.toLowerCase() === normalized || normalized.includes(id.toLowerCase())),
  )
  if (matched) return matched.exposure
  if (/mcp/.test(normalized)) return 'expert'
  if (/skill/.test(normalized)) return 'searchable'
  if (/legacytoolbus|toolbus/.test(normalized)) return 'legacy'
  return 'mainline'
}

function shouldActivateCapability(
  entry: DSXUCapabilityEntry,
  input: {
    taskType: DSXUExecutionTaskType
    explicitCapabilityIds?: readonly string[]
    taskContractAllows?: readonly string[]
    matchedSkillIds?: readonly string[]
    mcpResourceRefs?: readonly string[]
  },
): boolean {
  if (entry.activation.includes('default')) return entry.exposure === 'mainline' || entry.id === 'memory.context'
  if (input.explicitCapabilityIds?.includes(entry.id)) return true
  if (input.taskContractAllows?.includes(entry.id)) return true
  if (entry.id.startsWith('agent.') && ['long_task', 'multi_file_refactor', 'benchmark'].includes(input.taskType)) {
    return input.taskContractAllows?.includes(entry.id) === true
  }
  if (entry.id === 'skills.searchable') return (input.matchedSkillIds?.length ?? 0) > 0
  if (entry.id === 'mcp.expert') return (input.mcpResourceRefs?.length ?? 0) > 0
  return false
}

export function compileDSXUCapabilityActivationPlan(input: {
  taskType: DSXUExecutionTaskType
  registry?: DSXUCapabilityRegistry
  explicitCapabilityIds?: readonly string[]
  taskContractAllows?: readonly string[]
  matchedSkillIds?: readonly string[]
  mcpResourceRefs?: readonly string[]
}): DSXUCapabilityActivationPlan {
  const registry = input.registry ?? buildDSXUCapabilityRegistry()
  const activeCapabilityIds: string[] = []
  const blockedCapabilityIds: string[] = []
  const guards: string[] = []
  for (const entry of registry.entries) {
    const active = shouldActivateCapability(entry, input)
    if (active && (entry.exposure === 'experiment' || entry.exposure === 'frozen' || entry.exposure === 'legacy')) {
      blockedCapabilityIds.push(entry.id)
      guards.push(`blocked non-default capability:${entry.id}:${entry.exposure}`)
      continue
    }
    if (active) activeCapabilityIds.push(entry.id)
    else if (entry.exposure !== 'mainline') blockedCapabilityIds.push(entry.id)
  }
  return {
    schemaVersion: 'dsxu.capability-activation-plan.v6s',
    taskType: input.taskType,
    activeCapabilityIds,
    blockedCapabilityIds,
    visibleOrchestrationModes: ['serial worker', 'parallel fanout'],
    evidence: [
      `taskType:${input.taskType}`,
      `active:${activeCapabilityIds.join('|')}`,
      `blocked:${blockedCapabilityIds.join('|')}`,
    ],
    guards,
  }
}
