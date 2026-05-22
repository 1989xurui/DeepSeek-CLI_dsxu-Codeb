import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  decideDeepSeekV4Route,
  getDeepSeekV4ModelSpec,
  normalizeDeepSeekV4Model,
  type DeepSeekV4ApiMode,
  type DeepSeekV4Model,
  type DeepSeekV4PolicyReason,
  type DeepSeekV4ReasoningEffort,
  type DeepSeekV4WorkflowKind,
} from '../../utils/model/deepseekV4Control'

export type DSXUModelCapability = {
  model: DeepSeekV4Model
  provider: 'deepseek'
  contextWindow: number
  supportsTools: boolean
  supportsThinking: boolean
  supportsJson: boolean
  defaultThinkingMode: 'non-thinking' | 'thinking'
  apiMode: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
  routeReason?: DeepSeekV4PolicyReason
  lifecycle: 'current' | 'archived-alias'
  requestedModel?: string
}

function workflowKindFromTaskType(taskType: string | undefined): DeepSeekV4WorkflowKind | undefined {
  switch ((taskType ?? '').trim().toLowerCase()) {
    case 'bugfix':
    case 'bug':
      return 'bugfix'
    case 'feature':
      return 'feature'
    case 'review':
      return 'review'
    case 'verify':
    case 'verification':
    case 'test':
      return 'verification'
    case 'repo':
    case 'repo_understanding':
      return 'repo_understanding'
    case 'recovery':
      return 'recovery'
    case 'planning':
    case 'plan':
      return 'planning'
    case 'fim':
      return 'fim'
    default:
      return undefined
  }
}

function prefersThinkingAlias(model: string | undefined): boolean {
  return (model ?? '').toLowerCase().includes('thinking')
}

function capabilityFromModel(
  model: string | undefined,
  options: {
    apiMode?: DeepSeekV4ApiMode
    reasoningEffort?: DeepSeekV4ReasoningEffort
    routeReason?: DeepSeekV4PolicyReason
  } = {},
): DSXUModelCapability {
  const canonicalModel = normalizeDeepSeekV4Model(model)
  const spec = getDeepSeekV4ModelSpec(canonicalModel)
  const apiMode =
    options.apiMode ??
    (prefersThinkingAlias(model) ? 'thinking' : spec.defaultApiMode)

  return {
    model: spec.name,
    provider: 'deepseek',
    contextWindow: spec.contextWindow,
    supportsTools: spec.supportsTools,
    supportsThinking: spec.supportsReasoning,
    supportsJson: spec.supportsJsonOutput,
    defaultThinkingMode: apiMode === 'thinking' ? 'thinking' : 'non-thinking',
    apiMode,
    reasoningEffort: options.reasoningEffort,
    routeReason: options.routeReason,
    lifecycle: canonicalModel === model ? 'current' : 'archived-alias',
    requestedModel: model,
  }
}

export function getModelCapability(model = 'deepseek-chat'): DSXUModelCapability {
  return capabilityFromModel(model)
}

export function routeModel(input?: {
  taskType?: string
  requiredContext?: number
  requiresTools?: boolean
  requiresLongThinking?: boolean
  budgetConstraint?: 'low' | 'medium' | 'high'
}): DSXUModelCapability {
  const workflowKind = workflowKindFromTaskType(input?.taskType)
  const route = decideDeepSeekV4Route({
    workflowKind,
    role: workflowKind === 'review' ? 'reviewer' : workflowKind === 'verification' ? 'verifier' : undefined,
    requiresReasoning: input?.requiresLongThinking,
    requiredContextTokens: input?.requiredContext,
  })

  return capabilityFromModel(route.model, {
    apiMode: route.apiMode,
    reasoningEffort: route.reasoningEffort,
    routeReason: route.reason,
  })
}

export const MODEL_CAPABILITY_FACT_OWNER = {
  owner: 'src/utils/model/deepseekV4Control.ts',
  replacedFacts: [
    'deepseek-v4-flash.contextWindow=128000',
    'deepseek-v4-flash.supportsThinking=false',
    'deepseek-v4-flash-thinking as standalone model id',
  ],
  canonicalModels: [DEEPSEEK_V4_FLASH_MODEL, DEEPSEEK_V4_PRO_MODEL] as const,
} as const
