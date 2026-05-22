import { createHash } from 'crypto'

export type DSXUPromptPrefixSection = {
  id: string
  content: string
}

export type DSXUDynamicPromptSection = {
  id: string
  content: string
}

export type DSXUPromptCacheWorkflowKind =
  | 'planning'
  | 'coding'
  | 'review'
  | 'recovery'
  | 'agent'
  | 'verification'
  | 'repo_understanding'

export type DSXUPromptPrefixVolatileFinding = {
  sectionId: string
  kind: 'timestamp' | 'absolute_path' | 'trace_or_run_path' | 'temp_path' | 'random_id'
  sample: string
  recommendation: string
}

export type DSXUPromptPrefixCachePlan = {
  ok: boolean
  status: 'CACHE_PREFIX_READY' | 'CACHE_PREFIX_NEEDS_CLEANUP'
  workflowKind: DSXUPromptCacheWorkflowKind
  stablePrefix: string
  dynamicTail: string
  stablePrefixHash: string
  dynamicTailHash: string
  fullPromptHash: string
  stablePrefixChars: number
  dynamicTailChars: number
  fullPromptChars: number
  stablePrefixApproxTokens: number
  dynamicTailApproxTokens: number
  fullPromptApproxTokens: number
  stableSectionOrder: readonly string[]
  dynamicSectionOrder: readonly string[]
  cacheMissBudgetTokens: number
  volatileFindings: readonly DSXUPromptPrefixVolatileFinding[]
  promptSlimmingDecision: DSXUPromptSlimmingDecision
  stablePrefixLock: DSXUStablePrefixLock
  toolSchemaFreeze: DSXUToolSchemaFreeze
  cacheEpoch: DSXUCacheEpoch
  guards: readonly string[]
  recommendations: readonly string[]
}

export type DSXUStablePrefixLock = {
  schemaVersion: 'dsxu.stable-prefix-lock.v1'
  status: 'NO_PREVIOUS_PREFIX' | 'STABLE_PREFIX_LOCKED' | 'STABLE_DRIFT_EXPLAINED' | 'STABLE_DRIFT_BLOCKED'
  previousStablePrefixHash?: string
  currentStablePrefixHash: string
  driftReason?: string
}

export type DSXUToolSchemaFreeze = {
  schemaVersion: 'dsxu.tool-schema-freeze.v1'
  status: 'TOOL_SCHEMA_STABLE' | 'TOOL_SCHEMA_CHANGED_EXPLAINED' | 'TOOL_SCHEMA_CHANGED_BLOCKED'
  toolSchemaHash: string
  previousToolSchemaHash?: string
  toolSchemaSectionIds: readonly string[]
  changeReason?: string
}

export type DSXUCacheEpoch = {
  schemaVersion: 'dsxu.cache-epoch.v1'
  status: 'CACHE_EPOCH_STABLE' | 'CACHE_EPOCH_CHANGED_EXPLAINED' | 'CACHE_EPOCH_CHANGED_BLOCKED'
  epochHash: string
  previousEpochHash?: string
  changeReasons: readonly string[]
}

export type DSXUPromptSlimmingDecision = {
  schemaVersion: 'dsxu.prompt-slimming-decision.v1'
  owner: 'DeepSeek Prompt Prefix / System Prompt'
  status: 'PASS_PROMPT_SLIMMING_OWNER_ACCEPTANCE' | 'NEEDS_PROMPT_SLIMMING_OWNER_REVIEW'
  stableSystemSectionIds: readonly string[]
  runtimeGateSectionIds: readonly string[]
  taskMicroSectionIds: readonly string[]
  metrics: {
    stablePrefixApproxTokens: number
    dynamicTailApproxTokens: number
    cacheMissBudgetTokens: number
    volatileStableFindings: number
  }
  guards: readonly string[]
  recommendations: readonly string[]
}

const STABLE_SECTION_ORDER = [
  'system_rules',
  'tool_schemas',
  'permission_policy',
  'model_routing_policy',
  'semantic_tool_layer',
  'output_contract',
]

const CACHE_MISS_BUDGET_BY_WORKFLOW: Record<DSXUPromptCacheWorkflowKind, number> = {
  planning: 2_000,
  coding: 8_000,
  review: 5_000,
  recovery: 10_000,
  agent: 15_000,
  verification: 2_000,
  repo_understanding: 6_000,
}

const RUNTIME_GATE_SECTION_IDS = [
  'runtime_gate',
  'verification_gate',
  'recovery_gate',
  'context_budget',
  'task_state_snapshot',
  'tool_result',
  'tool_results',
  'recent_tool_result',
  'agent_handoff',
  'mcp_dynamic',
  'work_state',
]

const TASK_MICRO_SECTION_IDS = [
  'current_user_request',
  'current_task',
  'task_micro_prompt',
  'next_action',
]

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim()
}

function renderSection(section: DSXUPromptPrefixSection | DSXUDynamicPromptSection): string {
  return [`<dsxu-section id="${section.id}">`, normalizeNewlines(section.content), '</dsxu-section>'].join('\n')
}

function stableSectionRank(sectionId: string): number {
  const index = STABLE_SECTION_ORDER.indexOf(sectionId)
  return index === -1 ? STABLE_SECTION_ORDER.length : index
}

function hasSectionIdSignal(sectionId: string, signals: readonly string[]): boolean {
  const normalized = sectionId.toLowerCase().replace(/-/g, '_')
  return signals.some(signal => normalized === signal || normalized.includes(signal))
}

function isToolSchemaSectionId(sectionId: string): boolean {
  return hasSectionIdSignal(sectionId, ['tool_schema', 'tool_schemas', 'tools'])
}

function buildStablePrefixLock(input: {
  previousStablePrefixHash?: string
  currentStablePrefixHash: string
  driftReason?: string
}): DSXUStablePrefixLock {
  if (!input.previousStablePrefixHash) {
    return {
      schemaVersion: 'dsxu.stable-prefix-lock.v1',
      status: 'NO_PREVIOUS_PREFIX',
      currentStablePrefixHash: input.currentStablePrefixHash,
      driftReason: input.driftReason,
    }
  }
  if (input.previousStablePrefixHash === input.currentStablePrefixHash) {
    return {
      schemaVersion: 'dsxu.stable-prefix-lock.v1',
      status: 'STABLE_PREFIX_LOCKED',
      previousStablePrefixHash: input.previousStablePrefixHash,
      currentStablePrefixHash: input.currentStablePrefixHash,
      driftReason: input.driftReason,
    }
  }
  return {
    schemaVersion: 'dsxu.stable-prefix-lock.v1',
    status: input.driftReason ? 'STABLE_DRIFT_EXPLAINED' : 'STABLE_DRIFT_BLOCKED',
    previousStablePrefixHash: input.previousStablePrefixHash,
    currentStablePrefixHash: input.currentStablePrefixHash,
    driftReason: input.driftReason,
  }
}

function buildToolSchemaFreeze(input: {
  stableSections: readonly DSXUPromptPrefixSection[]
  previousToolSchemaHash?: string
  changeReason?: string
}): DSXUToolSchemaFreeze {
  const toolSchemaSections = input.stableSections.filter(section => isToolSchemaSectionId(section.id))
  const rendered = toolSchemaSections.map(renderSection).join('\n\n')
  const toolSchemaHash = sha256(rendered)
  if (!input.previousToolSchemaHash || input.previousToolSchemaHash === toolSchemaHash) {
    return {
      schemaVersion: 'dsxu.tool-schema-freeze.v1',
      status: 'TOOL_SCHEMA_STABLE',
      toolSchemaHash,
      previousToolSchemaHash: input.previousToolSchemaHash,
      toolSchemaSectionIds: toolSchemaSections.map(section => section.id),
      changeReason: input.changeReason,
    }
  }
  return {
    schemaVersion: 'dsxu.tool-schema-freeze.v1',
    status: input.changeReason ? 'TOOL_SCHEMA_CHANGED_EXPLAINED' : 'TOOL_SCHEMA_CHANGED_BLOCKED',
    toolSchemaHash,
    previousToolSchemaHash: input.previousToolSchemaHash,
    toolSchemaSectionIds: toolSchemaSections.map(section => section.id),
    changeReason: input.changeReason,
  }
}

function buildCacheEpoch(input: {
  workflowKind: DSXUPromptCacheWorkflowKind
  stablePrefixHash: string
  toolSchemaHash: string
  model?: string
  sourceCapsuleHash?: string
  previousEpochHash?: string
  changeReasons: readonly string[]
}): DSXUCacheEpoch {
  const epochHash = sha256([
    `workflow:${input.workflowKind}`,
    `model:${input.model ?? 'unspecified'}`,
    `stable:${input.stablePrefixHash}`,
    `toolSchema:${input.toolSchemaHash}`,
    `sourceCapsule:${input.sourceCapsuleHash ?? 'none'}`,
  ].join('\n'))
  if (!input.previousEpochHash || input.previousEpochHash === epochHash) {
    return {
      schemaVersion: 'dsxu.cache-epoch.v1',
      status: 'CACHE_EPOCH_STABLE',
      epochHash,
      previousEpochHash: input.previousEpochHash,
      changeReasons: input.changeReasons,
    }
  }
  return {
    schemaVersion: 'dsxu.cache-epoch.v1',
    status: input.changeReasons.length > 0 ? 'CACHE_EPOCH_CHANGED_EXPLAINED' : 'CACHE_EPOCH_CHANGED_BLOCKED',
    epochHash,
    previousEpochHash: input.previousEpochHash,
    changeReasons: input.changeReasons,
  }
}

function isRuntimeGateSectionId(sectionId: string): boolean {
  return hasSectionIdSignal(sectionId, RUNTIME_GATE_SECTION_IDS)
}

function isTaskMicroSectionId(sectionId: string): boolean {
  return hasSectionIdSignal(sectionId, TASK_MICRO_SECTION_IDS)
}

function orderStableSections(sections: readonly DSXUPromptPrefixSection[]): DSXUPromptPrefixSection[] {
  return [...sections].sort((a, b) => {
    const rankDelta = stableSectionRank(a.id) - stableSectionRank(b.id)
    return rankDelta !== 0 ? rankDelta : a.id.localeCompare(b.id)
  })
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[0] ?? null
}

function detectVolatileFindings(section: DSXUPromptPrefixSection): DSXUPromptPrefixVolatileFinding[] {
  const text = section.content
  const checks: Array<Omit<DSXUPromptPrefixVolatileFinding, 'sectionId' | 'sample'> & { pattern: RegExp }> = [
    {
      kind: 'timestamp',
      pattern: /\b20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/,
      recommendation: 'Move timestamps/current date into dynamic tail or task snapshot metadata.',
    },
    {
      kind: 'temp_path',
      pattern: /(?:AppData[\\/]+Local[\\/]+Temp|[\\/](?:tmp|temp)[\\/]|\\Temp\\)[^\s"'<>]*/i,
      recommendation: 'Move temporary paths into dynamic tail; keep stable prefix path-free.',
    },
    {
      kind: 'trace_or_run_path',
      pattern: /\.dsxu[\\/]+(?:trace|runs)[^\s"'<>]*/i,
      recommendation: 'Move trace/run artifact paths into dynamic tail evidence fields.',
    },
    {
      kind: 'absolute_path',
      pattern: /(?:[A-Za-z]:[\\/]|\/mnt\/[a-z]\/|\/home\/|\/Users\/)[^\s"'<>]*/i,
      recommendation: 'Move workspace-specific absolute paths into dynamic tail or canonical aliases.',
    },
    {
      kind: 'random_id',
      pattern: /\b(?:session|run|request|trace|toolu|msg|uuid|id)[_:-]?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b|\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i,
      recommendation: 'Move generated ids/session ids/run ids into dynamic tail; keep deterministic source hashes in source-truth capsule sections.',
    },
  ]
  return checks.flatMap(check => {
    const sample = firstMatch(text, check.pattern)
    return sample
      ? [{
          sectionId: section.id,
          kind: check.kind,
          sample,
          recommendation: check.recommendation,
        }]
      : []
  })
}

function buildDSXUPromptSlimmingDecision(input: {
  workflowKind: DSXUPromptCacheWorkflowKind
  stableSections: readonly DSXUPromptPrefixSection[]
  dynamicSections: readonly DSXUDynamicPromptSection[]
  stablePrefixApproxTokens: number
  dynamicTailApproxTokens: number
  volatileFindings: readonly DSXUPromptPrefixVolatileFinding[]
}): DSXUPromptSlimmingDecision {
  const cacheMissBudgetTokens = CACHE_MISS_BUDGET_BY_WORKFLOW[input.workflowKind]
  const stableSystemSectionIds = input.stableSections
    .filter(section => !isRuntimeGateSectionId(section.id) && !isTaskMicroSectionId(section.id))
    .map(section => section.id)
  const runtimeGateSectionIds = input.dynamicSections
    .filter(section => isRuntimeGateSectionId(section.id))
    .map(section => section.id)
  const taskMicroSectionIds = input.dynamicSections
    .filter(section => isTaskMicroSectionId(section.id))
    .map(section => section.id)
  const stableRuntimeGateLeaks = input.stableSections
    .filter(section => isRuntimeGateSectionId(section.id) || isTaskMicroSectionId(section.id))
    .map(section => section.id)

  const guards = [
    ...stableRuntimeGateLeaks.map(id => `stable prefix contains runtime/task section:${id}`),
    input.volatileFindings.length > 0
      ? 'stable prefix contains volatile session evidence'
      : '',
    input.dynamicTailApproxTokens > cacheMissBudgetTokens
      ? `dynamic tail exceeds workflow cache miss budget:${input.dynamicTailApproxTokens}/${cacheMissBudgetTokens}`
      : '',
  ].filter(Boolean)

  const recommendations = [
    'Keep durable identity, tool-use discipline, permission policy, model routing policy, and output contract in the stable system prompt.',
    'Move verification/recovery/context pressure/tool-result/agent handoff state into runtime-gate dynamic sections.',
    'Keep current task instructions in a short task micro prompt; put source truth and tool evidence in structured dynamic capsules, not stable text.',
    runtimeGateSectionIds.length === 0
      ? 'Add runtime-gate dynamic sections only when current verification/recovery/context state exists.'
      : '',
    taskMicroSectionIds.length === 0
      ? 'Add a task micro prompt for the current user request/next action when executing live tasks.'
      : '',
  ].filter(Boolean)

  return {
    schemaVersion: 'dsxu.prompt-slimming-decision.v1',
    owner: 'DeepSeek Prompt Prefix / System Prompt',
    status: guards.length === 0
      ? 'PASS_PROMPT_SLIMMING_OWNER_ACCEPTANCE'
      : 'NEEDS_PROMPT_SLIMMING_OWNER_REVIEW',
    stableSystemSectionIds,
    runtimeGateSectionIds,
    taskMicroSectionIds,
    metrics: {
      stablePrefixApproxTokens: input.stablePrefixApproxTokens,
      dynamicTailApproxTokens: input.dynamicTailApproxTokens,
      cacheMissBudgetTokens,
      volatileStableFindings: input.volatileFindings.length,
    },
    guards,
    recommendations,
  }
}

export function buildDSXUPromptPrefixCachePlan(input: {
  workflowKind: DSXUPromptCacheWorkflowKind
  stableSections: readonly DSXUPromptPrefixSection[]
  dynamicSections: readonly DSXUDynamicPromptSection[]
  previousStablePrefixHash?: string
  stablePrefixDriftReason?: string
  previousToolSchemaHash?: string
  toolSchemaChangeReason?: string
  previousCacheEpochHash?: string
  cacheEpochChangeReasons?: readonly string[]
  model?: string
  sourceCapsuleHash?: string
}): DSXUPromptPrefixCachePlan {
  const stableSections = orderStableSections(input.stableSections)
  const dynamicSections = [...input.dynamicSections]
  const stablePrefix = stableSections.map(renderSection).join('\n\n')
  const dynamicTail = dynamicSections.map(renderSection).join('\n\n')
  const volatileFindings = stableSections.flatMap(detectVolatileFindings)
  const guards: string[] = []
  const recommendations: string[] = [
    'Keep DSXU static policy/tool/model/output sections before dynamic task state.',
    'Keep current user request, task snapshot, tool results, logs, trace paths, and timestamps after the dynamic boundary.',
  ]

  if (volatileFindings.length > 0) {
    guards.push('stable prefix contains volatile content that can lower DeepSeek KV cache hit rate')
  }
  if (stableSections.length === 0) {
    guards.push('stable prefix has no sections')
  }
  if (dynamicSections.length === 0) {
    recommendations.push('Add a dynamic tail with current request and task snapshot so the stable prefix can stay reusable.')
  }

  const fullPrompt = [stablePrefix, '<dsxu-dynamic-boundary />', dynamicTail].join('\n\n')
  const stablePrefixApproxTokens = approxTokens(stablePrefix)
  const dynamicTailApproxTokens = approxTokens(dynamicTail)
  const fullPromptApproxTokens = approxTokens(fullPrompt)
  const promptSlimmingDecision = buildDSXUPromptSlimmingDecision({
    workflowKind: input.workflowKind,
    stableSections,
    dynamicSections,
    stablePrefixApproxTokens,
    dynamicTailApproxTokens,
    volatileFindings,
  })
  const stablePrefixLock = buildStablePrefixLock({
    previousStablePrefixHash: input.previousStablePrefixHash,
    currentStablePrefixHash: sha256(stablePrefix),
    driftReason: input.stablePrefixDriftReason,
  })
  const toolSchemaFreeze = buildToolSchemaFreeze({
    stableSections,
    previousToolSchemaHash: input.previousToolSchemaHash,
    changeReason: input.toolSchemaChangeReason,
  })
  const cacheEpoch = buildCacheEpoch({
    workflowKind: input.workflowKind,
    stablePrefixHash: sha256(stablePrefix),
    toolSchemaHash: toolSchemaFreeze.toolSchemaHash,
    model: input.model,
    sourceCapsuleHash: input.sourceCapsuleHash,
    previousEpochHash: input.previousCacheEpochHash,
    changeReasons: input.cacheEpochChangeReasons ?? [],
  })

  if (stablePrefixLock.status === 'STABLE_DRIFT_BLOCKED') {
    guards.push('stable prefix drift requires an explicit cache epoch reason')
  }
  if (toolSchemaFreeze.status === 'TOOL_SCHEMA_CHANGED_BLOCKED') {
    guards.push('tool schema changed without an epoch/reason')
  }
  if (cacheEpoch.status === 'CACHE_EPOCH_CHANGED_BLOCKED') {
    guards.push('cache epoch changed without model/tool/source/system reason')
  }

  return {
    ok: guards.length === 0,
    status: guards.length === 0 ? 'CACHE_PREFIX_READY' : 'CACHE_PREFIX_NEEDS_CLEANUP',
    workflowKind: input.workflowKind,
    stablePrefix,
    dynamicTail,
    stablePrefixHash: sha256(stablePrefix),
    dynamicTailHash: sha256(dynamicTail),
    fullPromptHash: sha256(fullPrompt),
    stablePrefixChars: stablePrefix.length,
    dynamicTailChars: dynamicTail.length,
    fullPromptChars: fullPrompt.length,
    stablePrefixApproxTokens,
    dynamicTailApproxTokens,
    fullPromptApproxTokens,
    stableSectionOrder: stableSections.map(section => section.id),
    dynamicSectionOrder: dynamicSections.map(section => section.id),
    cacheMissBudgetTokens: CACHE_MISS_BUDGET_BY_WORKFLOW[input.workflowKind],
    volatileFindings,
    promptSlimmingDecision,
    stablePrefixLock,
    toolSchemaFreeze,
    cacheEpoch,
    guards,
    recommendations,
  }
}
