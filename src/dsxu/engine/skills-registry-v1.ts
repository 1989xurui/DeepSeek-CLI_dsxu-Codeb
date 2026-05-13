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
}

export type BatchSkillExecutionResult = {
  ok: boolean
  output: {
    plan: {
      mode: 'parallel' | 'serial'
      topologicalOrder: string[]
      hasDependencyCycle: boolean
    }
  }
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

  registerBundledSkill(skill: BundledSkillRegistration): void {
    this.bundledSkills.set(skill.name, skill)
  }

  getBundledSkill(name: string): BundledSkillRegistration | undefined {
    return this.bundledSkills.get(name)
  }

  register(skill: SkillDefinition, priority = 0): SkillRegistryEntry {
    const entry: SkillRegistryEntry = {
      skill,
      priority,
      registeredAt: new Date().toISOString(),
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
        topologicalOrder: order,
        hasDependencyCycle,
      },
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
  return {
    toolId: `skill__${input.skillName}`,
    metadata: {
      displayName: input.skillName,
      description: `Skill execution: ${input.skillName}`,
      owner: 'MCP / Skill Registry',
      version: '1',
      tags: ['skill', profile.kind, profile.readWriteClass, profile.sideEffectClass],
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
