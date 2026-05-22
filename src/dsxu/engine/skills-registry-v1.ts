import type { SkillDefinition, SkillTag } from './skills-types-v1'
import type {
  ToolDefinition as GateToolDefinition,
  ToolPermissionLevel,
  ToolReadWriteClass,
  ToolSideEffectClass,
} from './tool-types-v1'
import {
  buildSkillGovernanceContracts,
  type SkillGovernanceContract,
} from './skill-governance-v1'

export type BundledSkillRegistration = {
  name: string
  description: string
  userInvocable: boolean
  getPromptForCommand(command: string): Array<{ text: string }>
}

export type SkillRegistryEntry = {
  skill: SkillDefinition
  priority: number
  registeredAt: string
  ownerProof: SkillRegistryOwnerProof
}

export type SkillProviderKind = 'bundled' | 'mcp' | 'agent' | 'local'

export type SkillProviderRegistration = {
  providerId: string
  kind: SkillProviderKind
  owner: string
  adapterBoundary: string
  permissionBoundary: string
  evidenceIds: string[]
  claimsStandaloneRuntime?: boolean
  registeredAt: string
}

export type SkillRegistryOwnerProof = {
  registryOwner: 'MCP / Skill Registry'
  skillOwner: string
  providerId: string
  providerKind: SkillProviderKind
  adapterBoundary: string
  toolGateBoundary: 'DSXU Tool Gate'
  permissionBoundary: string
  evidenceIds: string[]
  claimsStandaloneRuntime: false
}

export type SkillRegistryOwnershipAudit = {
  registryOwner: 'MCP / Skill Registry'
  registeredSkills: number
  registeredProviders: number
  missingOwnerProof: string[]
  missingProviderRegistration: string[]
  standaloneRuntimeClaims: string[]
  providersByKind: Record<SkillProviderKind, number>
  toolGateBoundary: 'DSXU Tool Gate'
}

export type SkillSelectionContext = {
  taskId: string
  taskText: string
  runtimeStateHints: string[]
  sessionHints: string[]
}

export type SkillSelectionPolicy = {
  mode: 'single-best' | 'multi-skill'
  maxSkills: number
  conflictPolicy: 'prefer-higher-priority' | 'keep-registration-order'
}

export type SkillSelectionInput = {
  context: SkillSelectionContext
  requestedTags: SkillTag[]
  policy: SkillSelectionPolicy
}

export type SkillSelectionTrace = {
  selectedSkillIds: string[]
  discardedSkillIds: string[]
  reasons: string[]
}

export type SkillSelectionResult = {
  selectedSkills: SkillRegistryEntry[]
  trace: SkillSelectionTrace
}

export type SkillPromptBindingLike = {
  skillId: string
  requiredLayers?: string[]
  bindings: Array<{ layer: string; fragmentId: string }>
}

export type SkillInvocationPlan = {
  planId: string
  promptStackId: string
  selectedSkills: SkillDefinition[]
  executionOrder: string[]
  bindings: SkillPromptBindingLike[]
  governanceContracts: SkillGovernanceContract[]
  trace: SkillSelectionTrace
  createdAt: string
}

export type PromptStackLike = {
  stackId: string
  layers: Record<string, Array<{ fragmentId: string; text: string; priority: number; layer?: string }>>
  compositionRule?: { order: string[] }
}

export type PromptResolutionResult = {
  stackId: string
  finalPrompt: string
  trace: {
    selectedFragmentIds: string[]
    layerOrder: string[]
  }
}

export type DSXUToolUseBlock = {
  id: string
  name: string
  input: Record<string, any>
}

export type DSXUAssistantToolUseMessage = {
  role: 'assistant'
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  >
}

export type BatchSkillTask = {
  id: string
  goal: string
  dependsOn?: string[]
  readOnly?: boolean
}

export type BatchSkillExecutionResult = {
  ok: boolean
  output: {
    plan: {
      mode: 'parallel' | 'serial'
      tasks: BatchSkillTask[]
      topologicalOrder: string[]
      hasDependencyCycle: boolean
    }
  }
}

export type CriticalSkillExecutionInput = {
  skillId: string
  payload: Record<string, any>
}

export type CriticalSkillExecutionResult = {
  ok: boolean
  diagnostics: string[]
  output: Record<string, any>
}

export type IterationGuardInput = {
  depth: number
  maxDepth: number
  recentFingerprints: string[]
}

export type IterationGuardResult = {
  shouldBackoff: boolean
  shouldAbort: boolean
  reason: string
}

export type ActionHistoryItem = {
  action: string
  fingerprint: string
  timestamp: number
}

export type ContentConsistencyInput = {
  before: string
  after: string
  expectedEditApplied: boolean
}

export type ContentConsistencyResult = {
  consistent: boolean
  reason: string
}

export type SkillGateContractInput = {
  skillName: string
  input: Record<string, any>
  cwd: string
  sessionId: string
  providerId?: string
  providerKind?: SkillProviderKind
  agentId?: string
  evidenceIds?: string[]
}

type SkillGateProfile = {
  kind: 'read' | 'write' | 'execute'
  capabilityTags: GateToolDefinition['capabilityTags']
  permissionLevel: ToolPermissionLevel
  readWriteClass: ToolReadWriteClass
  sideEffectClass: ToolSideEffectClass
}

export class SkillRegistry {
  private readonly bundledSkills = new Map<string, BundledSkillRegistration>()
  private readonly skills = new Map<string, SkillRegistryEntry>()
  private readonly providers = new Map<string, SkillProviderRegistration>()

  constructor() {
    this.registerProvider({
      providerId: 'dsxu-local-skill-provider',
      kind: 'local',
      owner: 'MCP / Skill Registry',
      adapterBoundary: 'DSXU Skill adapter boundary',
      permissionBoundary: 'DSXU Tool Gate',
      evidenceIds: ['skill-registry-default-provider'],
    })
  }

  registerBundledSkill(skill: BundledSkillRegistration): void {
    this.bundledSkills.set(skill.name, skill)
  }

  getBundledSkill(name: string): BundledSkillRegistration | undefined {
    return this.bundledSkills.get(name)
  }

  registerProvider(input: Omit<SkillProviderRegistration, 'registeredAt'> & { registeredAt?: string }): SkillProviderRegistration {
    const provider: SkillProviderRegistration = {
      ...input,
      registeredAt: input.registeredAt ?? new Date().toISOString(),
      claimsStandaloneRuntime: input.claimsStandaloneRuntime === true,
    }
    this.providers.set(provider.providerId, provider)
    return provider
  }

  registerMcpProvider(input: {
    serverName: string
    owner?: string
    evidenceIds?: string[]
  }): SkillProviderRegistration {
    return this.registerProvider({
      providerId: `mcp:${input.serverName}`,
      kind: 'mcp',
      owner: input.owner ?? 'MCP / Skill Registry',
      adapterBoundary: 'DSXU MCP adapter boundary',
      permissionBoundary: 'DSXU Tool Gate',
      evidenceIds: input.evidenceIds ?? ['mcp-provider-registration'],
    })
  }

  registerAgentProvider(input: {
    agentId: string
    owner?: string
    evidenceIds?: string[]
  }): SkillProviderRegistration {
    return this.registerProvider({
      providerId: `agent:${input.agentId}`,
      kind: 'agent',
      owner: input.owner ?? 'Agent Tool Lifecycle',
      adapterBoundary: 'DSXU agent evidence envelope',
      permissionBoundary: 'DSXU Tool Gate',
      evidenceIds: input.evidenceIds ?? ['agent-provider-registration'],
    })
  }

  getProvider(providerId: string): SkillProviderRegistration | undefined {
    return this.providers.get(providerId)
  }

  listProviders(): SkillProviderRegistration[] {
    return [...this.providers.values()]
  }

  register(skill: SkillDefinition, priority = 0, options?: {
    providerId?: string
    evidenceIds?: string[]
  }): SkillRegistryEntry {
    const providerId = options?.providerId ?? 'dsxu-local-skill-provider'
    const provider = this.providers.get(providerId) ?? this.registerProvider({
      providerId,
      kind: providerId.startsWith('mcp:') ? 'mcp' : providerId.startsWith('agent:') ? 'agent' : 'local',
      owner: 'MCP / Skill Registry',
      adapterBoundary: providerId.startsWith('mcp:')
        ? 'DSXU MCP adapter boundary'
        : providerId.startsWith('agent:')
          ? 'DSXU agent evidence envelope'
          : 'DSXU Skill adapter boundary',
      permissionBoundary: 'DSXU Tool Gate',
      evidenceIds: ['implicit-provider-registration'],
    })
    const entry: SkillRegistryEntry = {
      skill,
      priority,
      registeredAt: new Date().toISOString(),
      ownerProof: buildSkillRegistryOwnerProof(skill, provider, options?.evidenceIds),
    }

    this.skills.set(skill.skillId, entry)
    return entry
  }

  get(skillId: string): SkillRegistryEntry | undefined {
    return this.skills.get(skillId)
  }

  list(): SkillRegistryEntry[] {
    return [...this.skills.values()]
  }

  buildOwnershipAudit(): SkillRegistryOwnershipAudit {
    const providersByKind: Record<SkillProviderKind, number> = {
      bundled: 0,
      mcp: 0,
      agent: 0,
      local: 0,
    }
    const missingOwnerProof: string[] = []
    const missingProviderRegistration: string[] = []
    const standaloneRuntimeClaims: string[] = []

    for (const provider of this.providers.values()) {
      providersByKind[provider.kind] += 1
      if (provider.claimsStandaloneRuntime) standaloneRuntimeClaims.push(provider.providerId)
    }

    for (const entry of this.skills.values()) {
      if (!entry.ownerProof) {
        missingOwnerProof.push(entry.skill.skillId)
        continue
      }
      if (!this.providers.has(entry.ownerProof.providerId)) {
        missingProviderRegistration.push(entry.skill.skillId)
      }
      if (entry.ownerProof.claimsStandaloneRuntime) {
        standaloneRuntimeClaims.push(entry.skill.skillId)
      }
    }

    return {
      registryOwner: 'MCP / Skill Registry',
      registeredSkills: this.skills.size,
      registeredProviders: this.providers.size,
      missingOwnerProof,
      missingProviderRegistration,
      standaloneRuntimeClaims,
      providersByKind,
      toolGateBoundary: 'DSXU Tool Gate',
    }
  }
}

function buildSkillRegistryOwnerProof(
  skill: SkillDefinition,
  provider: SkillProviderRegistration,
  evidenceIds?: string[],
): SkillRegistryOwnerProof {
  return {
    registryOwner: 'MCP / Skill Registry',
    skillOwner: skill.metadata.owner || provider.owner,
    providerId: provider.providerId,
    providerKind: provider.kind,
    adapterBoundary: provider.adapterBoundary,
    toolGateBoundary: 'DSXU Tool Gate',
    permissionBoundary: provider.permissionBoundary,
    evidenceIds: [
      ...new Set([
        ...provider.evidenceIds,
        ...(evidenceIds ?? []),
        'skill-registry-owner-proof',
      ]),
    ],
    claimsStandaloneRuntime: false,
  }
}

export function validateSkillRegistryOwnershipAudit(audit: SkillRegistryOwnershipAudit): {
  valid: boolean
  violations: string[]
} {
  const violations: string[] = []
  if (audit.registryOwner !== 'MCP / Skill Registry') violations.push('wrong_registry_owner')
  if (audit.missingOwnerProof.length > 0) violations.push('missing_owner_proof')
  if (audit.missingProviderRegistration.length > 0) violations.push('missing_provider_registration')
  if (audit.standaloneRuntimeClaims.length > 0) violations.push('standalone_runtime_claim')
  if (audit.toolGateBoundary !== 'DSXU Tool Gate') violations.push('missing_tool_gate_boundary')
  return { valid: violations.length === 0, violations }
}

export function selectSkills(registry: SkillRegistry, input: SkillSelectionInput): SkillSelectionResult {
  const scored = registry.list().map((entry, index) => ({
    entry,
    index,
    score: scoreSkill(entry, input),
  }))

  const candidates = scored
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (input.policy.conflictPolicy === 'prefer-higher-priority' && right.entry.priority !== left.entry.priority) {
        return right.entry.priority - left.entry.priority
      }

      return left.index - right.index
    })

  const limit = input.policy.mode === 'single-best' ? 1 : Math.max(1, input.policy.maxSkills)
  const selected = candidates.slice(0, limit)
  const selectedIds = new Set(selected.map(item => item.entry.skill.skillId))
  const discarded = scored.filter(item => !selectedIds.has(item.entry.skill.skillId))

  return {
    selectedSkills: selected.map(item => item.entry),
    trace: {
      selectedSkillIds: selected.map(item => item.entry.skill.skillId),
      discardedSkillIds: discarded.map(item => item.entry.skill.skillId),
      reasons: [
        `mode:${input.policy.mode}`,
        `requestedTags:${input.requestedTags.join(',') || 'none'}`,
        ...selected.map(item => `selected:${item.entry.skill.skillId}:score=${item.score}`),
      ],
    },
  }
}

export function buildInvocationPlan(input: {
  selected: SkillSelectionResult
  bindings: SkillPromptBindingLike[]
  promptStackId: string
}): SkillInvocationPlan {
  const selectedSkillIds = input.selected.selectedSkills.map(entry => entry.skill.skillId)
  const selectedIdSet = new Set(selectedSkillIds)
  const selectedSkills = input.selected.selectedSkills.map(entry => entry.skill)
  const governanceContracts = buildSkillGovernanceContracts(selectedSkills)

  return {
    planId: `skill-plan-${Date.now().toString(36)}-${Math.floor(Math.random() * 10_000).toString(36)}`,
    promptStackId: input.promptStackId,
    selectedSkills,
    executionOrder: selectedSkillIds,
    bindings: input.bindings.filter(binding => selectedIdSet.has(binding.skillId)),
    governanceContracts,
    trace: {
      ...input.selected.trace,
      reasons: [
        ...input.selected.trace.reasons,
        `promptStack:${input.promptStackId}`,
        `bindings:${input.bindings.length}`,
        ...governanceContracts.map(contract => `governance:${contract.skillId}:${contract.status}`),
        ...input.selected.selectedSkills.map(entry =>
          `owner:${entry.skill.skillId}:${entry.ownerProof.registryOwner}:${entry.ownerProof.providerId}:${entry.ownerProof.toolGateBoundary}`,
        ),
      ],
    },
    createdAt: new Date().toISOString(),
  }
}

export function resolvePromptPlan(stack: PromptStackLike): PromptResolutionResult {
  const layerOrder = stack.compositionRule?.order ?? ['system', 'task', 'context', 'skill']
  const selectedFragments: Array<{ fragmentId: string; text: string; priority: number }> = []

  for (const layerName of layerOrder) {
    const layer = stack.layers[layerName] ?? []
    selectedFragments.push(
      ...[...layer].sort((left, right) => right.priority - left.priority || left.fragmentId.localeCompare(right.fragmentId)),
    )
  }

  return {
    stackId: stack.stackId,
    finalPrompt: selectedFragments.map(fragment => fragment.text).join('\n\n'),
    trace: {
      selectedFragmentIds: selectedFragments.map(fragment => fragment.fragmentId),
      layerOrder,
    },
  }
}

export function mapToolUseToDSXUAssistantMessage(input: {
  prefaceText: string
  toolUse: DSXUToolUseBlock
}): DSXUAssistantToolUseMessage {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: input.prefaceText },
      {
        type: 'tool_use',
        id: input.toolUse.id,
        name: input.toolUse.name,
        input: input.toolUse.input,
      },
    ],
  }
}

export function executeBatchSkill(input: {
  mode: 'parallel' | 'serial'
  tasks: BatchSkillTask[]
}): BatchSkillExecutionResult {
  const taskById = new Map(input.tasks.map(task => [task.id, task]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const order: string[] = []
  let hasDependencyCycle = false

  const visit = (taskId: string) => {
    if (visited.has(taskId)) return
    if (visiting.has(taskId)) {
      hasDependencyCycle = true
      return
    }
    const task = taskById.get(taskId)
    if (!task) return

    visiting.add(taskId)
    for (const dependency of task.dependsOn ?? []) {
      visit(dependency)
    }
    visiting.delete(taskId)
    visited.add(taskId)
    order.push(taskId)
  }

  for (const task of input.tasks) {
    visit(task.id)
  }

  return {
    ok: !hasDependencyCycle,
    output: {
      plan: {
        mode: input.mode,
        tasks: input.tasks,
        topologicalOrder: order,
        hasDependencyCycle,
      },
    },
  }
}

export function executeSkill(input: CriticalSkillExecutionInput): CriticalSkillExecutionResult {
  switch (input.skillId) {
    case 'batch': {
      const tasks = Array.isArray(input.payload.tasks)
        ? normalizeBatchSkillTasks(input.payload.tasks)
        : []
      const mode = input.payload.mode === 'serial' ? 'serial' : 'parallel'
      const result = executeBatchSkill({ mode, tasks })

      return {
        ok: result.ok,
        diagnostics: result.ok ? [] : ['batch-plan-dependency-cycle'],
        output: result.output,
      }
    }
    case 'debug':
      return executeDebugSkill(input.payload)
    case 'simplify':
      return executeSimplifySkill(input.payload)
    case 'verify':
      return executeVerifySkill(input.payload)
    default:
      return {
        ok: false,
        diagnostics: [`unknown-skill:${input.skillId}`],
        output: {
          skillId: input.skillId,
          reason: 'skill-not-owned-by-critical-registry',
        },
      }
  }
}

function normalizeBatchSkillTasks(tasks: any[]): BatchSkillTask[] {
  return tasks
    .map((task, index) => {
      const id = typeof task?.id === 'string' && task.id.length > 0 ? task.id : `task-${index + 1}`
      const goal = typeof task?.goal === 'string' ? task.goal : ''
      const dependsOn = Array.isArray(task?.dependsOn)
        ? task.dependsOn.filter((dependency: unknown): dependency is string => typeof dependency === 'string')
        : undefined
      const readOnly = task?.readOnly === true ? true : undefined

      return {
        id,
        goal,
        ...(dependsOn && dependsOn.length > 0 ? { dependsOn } : {}),
        ...(readOnly === true ? { readOnly } : {}),
      }
    })
    .filter(task => task.goal.length > 0)
}

function executeDebugSkill(payload: Record<string, any>): CriticalSkillExecutionResult {
  const errorText = String(payload.error ?? payload.message ?? '').trim()
  const diagnostics = new Set<string>()
  const normalizedError = errorText.toLowerCase()

  if (normalizedError.includes('eaddrinuse') || normalizedError.includes('address already in use')) {
    diagnostics.add('port-conflict')
  }
  if (normalizedError.includes('timeout') || normalizedError.includes('timed out')) {
    diagnostics.add('timeout')
  }
  if (normalizedError.includes('permission') || normalizedError.includes('eacces')) {
    diagnostics.add('permission-denied')
  }
  if (diagnostics.size === 0 && errorText.length > 0) {
    diagnostics.add('unclassified-error')
  }

  return {
    ok: errorText.length > 0,
    diagnostics: Array.from(diagnostics),
    output: {
      error: errorText,
      diagnosticCount: diagnostics.size,
      nextAction:
        diagnostics.has('port-conflict')
          ? 'inspect-listener-and-retry-on-free-port'
          : diagnostics.has('timeout')
            ? 'capture-slow-boundary-and-retry-with-trace'
            : diagnostics.size > 0
              ? 'inspect-failing-boundary'
              : 'provide-error-text',
    },
  }
}

function executeSimplifySkill(payload: Record<string, any>): CriticalSkillExecutionResult {
  const text = String(payload.text ?? '')
  const simplified = text
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()

  return {
    ok: simplified.length <= text.length,
    diagnostics: simplified.length < text.length ? ['text-simplified'] : ['text-already-simple'],
    output: {
      text: simplified,
      beforeLength: text.length,
      afterLength: simplified.length,
      removedCharacters: Math.max(0, text.length - simplified.length),
    },
  }
}

function executeVerifySkill(payload: Record<string, any>): CriticalSkillExecutionResult {
  const checks = Array.isArray(payload.checks) ? payload.checks : []
  const normalizedChecks = checks.map((check, index) => ({
    name: typeof check?.name === 'string' && check.name.length > 0 ? check.name : `check-${index + 1}`,
    passed: check?.passed === true,
    details: typeof check?.details === 'string' ? check.details : undefined,
  }))
  const failedChecks = normalizedChecks.filter(check => !check.passed)

  return {
    ok: failedChecks.length === 0,
    diagnostics: failedChecks.map(check => `failed:${check.name}`),
    output: {
      totalChecks: normalizedChecks.length,
      passedChecks: normalizedChecks.filter(check => check.passed).map(check => check.name),
      failedChecks,
    },
  }
}

export function evaluateIterationGuard(input: IterationGuardInput): IterationGuardResult {
  const repeatedTail =
    input.recentFingerprints.length >= 3 &&
    new Set(input.recentFingerprints.slice(-3)).size === 1
  const nearLimit = input.depth >= Math.max(0, input.maxDepth - 1)
  const exceededLimit = input.depth >= input.maxDepth

  return {
    shouldBackoff: repeatedTail || nearLimit,
    shouldAbort: exceededLimit || (repeatedTail && nearLimit),
    reason: exceededLimit
      ? 'max-depth-reached'
      : repeatedTail
        ? 'repeated-action-fingerprint'
        : nearLimit
          ? 'near-depth-limit'
          : 'continue',
  }
}

export function detectStuckByActionHistory(history: ActionHistoryItem[]): {
  stuck: boolean
  reason: string
} {
  if (history.length < 3) {
    return { stuck: false, reason: 'insufficient-history' }
  }
  const recent = history.slice(-3)
  const repeated =
    new Set(recent.map(item => item.action)).size === 1 &&
    new Set(recent.map(item => item.fingerprint)).size === 1

  return {
    stuck: repeated,
    reason: repeated ? 'same-action-fingerprint-repeated' : 'progress-observed',
  }
}

export function verifyContentConsistency(input: ContentConsistencyInput): ContentConsistencyResult {
  const changed = input.before !== input.after
  const consistent = input.expectedEditApplied ? changed : !changed
  return {
    consistent,
    reason: consistent ? 'content-state-matches-expectation' : 'content-state-mismatch',
  }
}

export function buildSkillToolGateDefinition(input: SkillGateContractInput): GateToolDefinition {
  const profile = buildSkillGateProfile(input.skillName)
  const inputFields = Array.from(new Set(['skillName', 'args', ...Object.keys(input.input)])).sort()
  const providerKind = input.providerKind ?? (input.providerId?.startsWith('mcp:') ? 'mcp' : input.agentId ? 'agent' : 'local')
  const providerId = input.providerId ?? (input.agentId ? `agent:${input.agentId}` : 'dsxu-local-skill-provider')
  const evidenceIds = [
    ...new Set([
      ...(input.evidenceIds ?? []),
      'skill-tool-gate-owner-proof',
    ]),
  ]
  return {
    toolId: `skill__${input.skillName}`,
    metadata: {
      displayName: input.skillName,
      description: `Skill execution: ${input.skillName}`,
      owner: 'MCP / Skill Registry',
      version: '1',
      tags: ['skill', providerKind, providerId, profile.kind, profile.readWriteClass, profile.sideEffectClass],
    },
    capabilityTags: profile.capabilityTags,
    executionMode: 'sync',
    permissionLevel: profile.permissionLevel,
    readWriteClass: profile.readWriteClass,
    sideEffectClass: profile.sideEffectClass,
    failureClass: 'permission',
    inputContract: {
      schemaRef: 'dsxu.skill-execution.input.v1',
      requiredFields: ['skillName', 'args'],
      optionalFields: inputFields.filter(field => field !== 'skillName' && field !== 'args'),
      validationNotes: [
        `cwd:${input.cwd}`,
        `session:${input.sessionId}`,
        `provider:${providerId}`,
        `provider-kind:${providerKind}`,
        `evidence:${evidenceIds.join('|')}`,
        `skill-kind:${profile.kind}`,
        'permission owner: tool-gate-v1',
      ],
    },
    outputContract: {
      schemaRef: 'dsxu.skill-execution.output.v1',
      producedFields: ['content', 'meta.skill', 'meta.resultType'],
      failureFields: ['isError', 'errorCode', 'meta.error'],
      stabilityNotes: [
        'permission checked by tool-gate-v1',
        'skill execution remains owned by MCP / Skill Registry',
        `provider registration: ${providerId}`,
        `provider kind: ${providerKind}`,
        'tool result remains normalized as SkillExecutionResult',
      ],
    },
    constraints: [
      {
        id: 'skill-registry-owner',
        description: 'Skill execution must enter MCP / Skill Registry before command or prompt execution',
        requiresConfirmation: profile.permissionLevel !== 'safe',
      },
      {
        id: 'skill-provider-registration',
        description: `Skill provider ${providerId} (${providerKind}) must be registered as a DSXU adapter boundary, not as a standalone runtime`,
        requiresConfirmation: providerKind !== 'local',
      },
      {
        id: 'tool-gate-permission-owner',
        description: 'Permission decision must be produced by tool-gate-v1; SkillsExecutor cannot keep a private permission runtime',
        requiresConfirmation: profile.sideEffectClass !== 'none',
      },
    ],
    inputSchema: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'Registered skill identifier' },
        args: { type: 'string', description: 'Serialized skill invocation arguments' },
        providerId: { type: 'string', description: 'DSXU skill provider registration id' },
      },
      required: ['skillName', 'args'],
      additionalProperties: true,
    },
    validateInput: candidate => {
      const issues = []
      if (candidate.skillName === undefined) {
        issues.push({ path: 'skillName', message: 'missing required field: skillName', code: 'missing_required' as const })
      }
      if (candidate.args === undefined) {
        issues.push({ path: 'args', message: 'missing required field: args', code: 'missing_required' as const })
      }
      return { valid: issues.length === 0, issues }
    },
  }
}

function buildSkillGateProfile(skillName: string): SkillGateProfile {
  const normalizedName = skillName.toLowerCase()
  const readOnlySkill = ['simplify', 'review-pr', 'pdf'].some(readSkill => normalizedName.includes(readSkill))
  if (readOnlySkill) {
    return {
      kind: 'read',
      capabilityTags: ['analysis'],
      permissionLevel: 'safe',
      readWriteClass: 'read-only',
      sideEffectClass: 'none',
    }
  }
  if (isWriteSkillName(skillName)) {
    return {
      kind: 'write',
      capabilityTags: ['write'],
      permissionLevel: 'guarded',
      readWriteClass: 'write-local',
      sideEffectClass: 'local-state',
    }
  }
  return {
    kind: 'execute',
    capabilityTags: ['execute'],
    permissionLevel: 'privileged',
    readWriteClass: 'write-external',
    sideEffectClass: 'external-side-effect',
  }
}

export function isWriteSkillName(skillName: string): boolean {
  const writeSkills = ['commit', 'skillify', 'update-config', 'write', 'edit']
  return writeSkills.some(writeSkill => skillName.toLowerCase().includes(writeSkill))
}

function scoreSkill(entry: SkillRegistryEntry, input: SkillSelectionInput): number {
  const taskText = input.context.taskText.toLowerCase()
  const requestedTagScore = entry.skill.metadata.tags.filter(tag => input.requestedTags.includes(tag)).length * 30
  const triggerScore = entry.skill.triggers.reduce((score, trigger) => {
    const expression = trigger.expression.toLowerCase()
    if (expression.length === 0) {
      return score
    }

    return taskText.includes(expression) ? score + Math.max(1, trigger.weight) * 40 : score
  }, 0)
  const runtimeHintScore = input.context.runtimeStateHints.some(hint => skillMatchesText(entry.skill, hint)) ? 15 : 0
  const sessionHintScore = input.context.sessionHints.some(hint => skillMatchesText(entry.skill, hint)) ? 10 : 0

  return requestedTagScore + triggerScore + runtimeHintScore + sessionHintScore + entry.priority / 100
}

function skillMatchesText(skill: SkillDefinition, text: string): boolean {
  const lower = text.toLowerCase()
  return (
    skill.metadata.tags.some(tag => lower.includes(String(tag).toLowerCase())) ||
    skill.triggers.some(trigger => lower.includes(trigger.expression.toLowerCase()))
  )
}
