import {
  clampDeepSeekV4MaxTokens,
  decideDeepSeekV4Route,
  formatDeepSeekV4RequestEvidence,
  normalizeDeepSeekV4Model,
  type DeepSeekV4ApiMode,
  type DeepSeekV4EndpointKind,
  type DeepSeekV4ReasoningEffort,
  type DeepSeekV4RouteDecision,
  type DeepSeekV4RouteInput,
} from './deepseekV4Control.js'

export type DeepSeekV4CostRouterParams = {
  model?: string
  max_tokens?: number
  thinking?: { type?: string }
  reasoning_effort?: string
}

export type DeepSeekV4CostRouterEnv = {
  DEEPSEEK_MODEL?: string
  DSXU_DEEPSEEK_THINKING?: string
  DSXU_DEEPSEEK_REASONING_EFFORT?: string
  DSXU_ROUTE_MODEL_UPGRADE_DISABLED?: string
}

export type DeepSeekV4CostRouterInput = {
  params?: DeepSeekV4CostRouterParams
  routeInput?: DeepSeekV4RouteInput
  env?: DeepSeekV4CostRouterEnv
}

export type DeepSeekV4CostRouterDecision = {
  requestedModel: ReturnType<typeof normalizeDeepSeekV4Model>
  apiMode: DeepSeekV4ApiMode
  thinkingEnabled: boolean
  reasoningEffort?: DeepSeekV4ReasoningEffort
  endpointKind: DeepSeekV4EndpointKind
  maxTokens: number
  routeDecision?: DeepSeekV4RouteDecision
  routeReason: string
  modelEvidence: string
}

function normalizeReasoningEffort(
  value: unknown,
): DeepSeekV4ReasoningEffort | undefined {
  return value === 'high' || value === 'max' ? value : undefined
}

export function resolveDeepSeekV4CostRoute(
  input: DeepSeekV4CostRouterInput = {},
): DeepSeekV4CostRouterDecision {
  const params = input.params ?? {}
  const env = input.env ?? process.env
  const routeDecision = input.routeInput
    ? decideDeepSeekV4Route(input.routeInput)
    : undefined

  const providerModel =
    params.model ?? env.DEEPSEEK_MODEL ?? routeDecision?.model
  let requestedModel = normalizeDeepSeekV4Model(providerModel)
  if (
    routeDecision?.model === 'deepseek-v4-pro' &&
    env.DSXU_ROUTE_MODEL_UPGRADE_DISABLED !== '1'
  ) {
    requestedModel = routeDecision.model
  }

  const explicitThinkingEnabled = params.thinking?.type === 'enabled'
  const explicitThinkingDisabled = params.thinking?.type === 'disabled'
  const envThinkingEnabled = env.DSXU_DEEPSEEK_THINKING === 'enabled'
  const envThinkingDisabled = env.DSXU_DEEPSEEK_THINKING === 'disabled'
  const routeRequiresThinking = routeDecision?.apiMode === 'thinking'
  const routeRequiresNonThinking = routeDecision?.apiMode === 'non_thinking'
  const thinkingEnabled =
    routeRequiresThinking ||
    (!routeRequiresNonThinking &&
      (explicitThinkingEnabled ||
        envThinkingEnabled ||
        (!explicitThinkingDisabled &&
          !envThinkingDisabled &&
          requestedModel === 'deepseek-v4-pro')))

  const apiMode: DeepSeekV4ApiMode = thinkingEnabled
    ? 'thinking'
    : 'non_thinking'
  const reasoningEffort = thinkingEnabled
    ? normalizeReasoningEffort(params.reasoning_effort) ||
      normalizeReasoningEffort(env.DSXU_DEEPSEEK_REASONING_EFFORT) ||
      routeDecision?.reasoningEffort ||
      (requestedModel === 'deepseek-v4-flash' ? 'high' : 'max')
    : undefined
  const endpointKind = routeDecision?.endpointKind ?? 'chat_completions'
  const requestedMaxTokens =
    params.max_tokens !== undefined && routeDecision?.maxTokens !== undefined
      ? Math.min(params.max_tokens, routeDecision.maxTokens)
      : params.max_tokens ?? routeDecision?.maxTokens
  const maxTokens = clampDeepSeekV4MaxTokens({
    model: requestedModel,
    requestedMaxTokens,
    endpointKind,
    apiMode,
    reasoningEffort,
    workflowKind: input.routeInput?.workflowKind,
    role: input.routeInput?.role,
  })
  const routeReason = routeDecision?.reason ?? 'adapter_actual_request'
  const modelEvidence = formatDeepSeekV4RequestEvidence({
    model: requestedModel,
    apiMode,
    reasoningEffort,
    reason: routeReason,
    maxTokens,
  })

  return {
    requestedModel,
    apiMode,
    thinkingEnabled,
    reasoningEffort,
    endpointKind,
    maxTokens,
    routeDecision,
    routeReason,
    modelEvidence,
  }
}
