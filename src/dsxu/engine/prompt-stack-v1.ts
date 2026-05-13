export type PromptLayerName = 'system' | 'task' | 'context' | 'skill'

export type PromptFragmentSource =
  | 'base'
  | 'user'
  | 'tool'
  | 'skill'
  | 'context'
  | 'system'
  | 'task'
  | (string & {})

export interface PromptFragment {
  fragmentId: string
  layer: PromptLayerName
  text: string
  priority: number
  source: PromptFragmentSource
}

export interface PromptStackLayerMap {
  system: PromptFragment[]
  task: PromptFragment[]
  context: PromptFragment[]
  skill: PromptFragment[]
}

export type ConflictPolicy = {
  mode: 'merge' | 'prefer-higher-priority' | 'discard-conflict'
  preserveTrace: boolean
}

export interface PromptStackCompositionRule {
  order: PromptLayerName[]
}

export interface PromptContextEnvelope {
  stackId: string
  suggestions: Array<{ severity: 'info' | 'warning'; title: string; detail: string }>
  warnings: Array<{ severity: 'info' | 'warning' | 'critical'; title: string; detail: string }>
  editContext: {
    intent: string
    targetFiles: string[]
    fileCount: number
  }
  teammateContext: {
    teamName: string
    communicationMode: 'direct' | 'lead-mediated'
    agentId?: string
  }
  workload: {
    workload: string
    pendingItems: number
    riskLevel: 'low' | 'medium' | 'high'
  }
  integratedAt?: string
}

export interface PromptStack {
  stackId: string
  layers: PromptStackLayerMap
  conflictPolicy: ConflictPolicy
  compositionRule: PromptStackCompositionRule
  createdAt: string
  contextEnvelope?: PromptContextEnvelope
}

export interface LegacyPromptStack {
  task: string[]
  system: string[]
  context: string[]
}

export interface PromptLayerBinding {
  layer: PromptLayerName
  fragmentId: string
}

export interface SkillPromptBinding {
  skillId: string
  requiredLayers: PromptLayerName[]
  bindings: PromptLayerBinding[]
}

export interface PromptStackInput {
  stackId?: string
  conflictPolicy?: Partial<ConflictPolicy>
}

export function createPromptStack(input: PromptStackInput = {}): PromptStack {
  const id =
    input.stackId ??
    `stack-${Date.now().toString(36)}-${Math.floor(Math.random() * 10_000).toString(36)}`

  return {
    stackId: id,
    layers: {
      system: [],
      task: [],
      context: [],
      skill: [],
    },
    conflictPolicy: {
      mode: input.conflictPolicy?.mode ?? 'merge',
      preserveTrace: input.conflictPolicy?.preserveTrace ?? true,
    },
    compositionRule: {
      order: ['system', 'task', 'context', 'skill'],
    },
    createdAt: new Date().toISOString(),
  }
}

export function createPromptStackFromFragments(
  fragments: PromptFragment[],
  input: PromptStackInput = {},
): PromptStack {
  let stack = createPromptStack(input)
  for (const fragment of fragments) {
    stack = addPromptFragment(stack, fragment)
  }
  return stack
}

export function addPromptFragment(stack: PromptStack, fragment: PromptFragment): PromptStack {
  const next = cloneStack(stack)
  const copy = cloneLayer(fragment)
  const layer = next.layers[fragment.layer]
  layer.push(copy)
  layer.sort((a, b) => b.priority - a.priority || a.fragmentId.localeCompare(b.fragmentId))
  return next
}

export function bindSkillToPromptLayers(
  skillId: string,
  bindings: PromptLayerBinding[],
): SkillPromptBinding {
  const requiredLayers = Array.from(new Set(bindings.map((binding) => binding.layer)))
  return {
    skillId,
    requiredLayers,
    bindings: [...bindings].map((binding) => ({
      layer: binding.layer,
      fragmentId: binding.fragmentId,
    })),
  }
}

export function attachContextEnvelopeToPromptStack(
  stack: PromptStack,
  input: {
    stackId: string
    suggestions: PromptContextEnvelope['suggestions']
    warnings: PromptContextEnvelope['warnings']
    editContext: PromptContextEnvelope['editContext']
    teammateContext: PromptContextEnvelope['teammateContext']
    workload: PromptContextEnvelope['workload']
  },
): PromptStack {
  const next = cloneStack(stack)
  next.contextEnvelope = {
    ...input,
    integratedAt: new Date().toISOString(),
  }

  const envelopeSummary = [
    `context-suggestions:${input.suggestions.length}`,
    `context-warnings:${input.warnings.length}`,
    `edit-intent:${input.editContext.intent}`,
    `team:${input.teammateContext.teamName}`,
    `workload:${input.workload.workload}`,
    `risk:${input.workload.riskLevel}`,
  ].join(';')

  const fragment = {
    fragmentId: `context-envelope-${next.stackId}`,
    layer: 'context' as const,
    text: envelopeSummary,
    priority: 0,
    source: 'context' as const,
  }

  next.layers.context.push(fragment)
  next.layers.context.sort((a, b) => b.priority - a.priority || a.fragmentId.localeCompare(b.fragmentId))
  return next
}

export function applyPromptProcessingResult(
  stack: PromptStack | LegacyPromptStack,
  input: {
    normalizedPrompt: string
    category: string
    systemPromptType: string
    teammateAddendum?: string
  },
): PromptStack | LegacyPromptStack {
  const normalizedSystemType = input.systemPromptType || 'general'
  const taskLayerText = [
    `task:${input.normalizedPrompt}`,
    `category:${input.category}`,
    `type:${normalizedSystemType}`,
  ]
  const systemLayerText = [
    `system:${input.systemPromptType}`,
    `category:${input.category}`,
  ]
  const contextLayerText = [`context:${input.normalizedPrompt.length}`]

  if (input.teammateAddendum) {
    taskLayerText.push(`teammate:${input.teammateAddendum}`)
    systemLayerText.push('teammate:addendum')
  }

  if (isPromptStack(stack)) {
    return {
      ...stack,
      layers: {
        system: appendFragments(stack.layers.system, buildFragments('system', systemLayerText)),
        task: appendFragments(stack.layers.task, buildFragments('task', taskLayerText)),
        context: appendFragments(stack.layers.context, buildFragments('context', contextLayerText)),
        skill: [...stack.layers.skill],
      },
    }
  }

  return {
    task: [...stack.task, ...taskLayerText],
    system: [...stack.system, ...systemLayerText],
    context: [...stack.context, ...contextLayerText],
  }
}

function cloneStack(stack: PromptStack): PromptStack {
  return {
    stackId: stack.stackId,
    layers: {
      system: [...stack.layers.system],
      task: [...stack.layers.task],
      context: [...stack.layers.context],
      skill: [...stack.layers.skill],
    },
    conflictPolicy: { ...stack.conflictPolicy },
    compositionRule: { ...stack.compositionRule },
    createdAt: stack.createdAt,
    contextEnvelope: stack.contextEnvelope ? { ...stack.contextEnvelope } : undefined,
  }
}

function isPromptStack(input: PromptStack | LegacyPromptStack): input is PromptStack {
  return !!input && typeof (input as PromptStack).stackId === 'string' && !!(input as PromptStack).layers
}

function appendFragments(base: PromptFragment[], added: PromptFragment[]) {
  const next = [...base, ...added]
  next.sort((a, b) => b.priority - a.priority || a.fragmentId.localeCompare(b.fragmentId))
  return next
}

function buildFragments(layer: PromptLayerName, lines: string[]): PromptFragment[] {
  return lines.map((line) => ({
    fragmentId: `${layer}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10_000).toString(36)}`,
    layer,
    text: line,
    priority: 1,
    source: layer,
  }))
}

function cloneLayer(fragment: PromptFragment): PromptFragment {
  return {
    fragmentId: fragment.fragmentId,
    layer: fragment.layer,
    text: fragment.text,
    priority: fragment.priority,
    source: fragment.source,
  }
}
