import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MODEL_SPECS,
  DEEPSEEK_V4_PRO_MODEL,
  decideDeepSeekV4Route,
  type DeepSeekV4RouteRole,
} from '../../utils/model/deepseekV4Control'

export type DSXUModelProvider = 'deepseek' | 'qwen_local' | 'openai' | 'provider_compat' | 'ollama'
export type DSXUModelRole = DeepSeekV4RouteRole

export type DSXUModelProfile = {
  id: string
  provider: DSXUModelProvider
  model: string
  litellmModel: string
  roles: DSXUModelRole[]
  contextWindow: number
  maxOutputTokens: number
  supportsTools: boolean
  supportsReasoning: boolean
  supportsFim: boolean
  apiMode: 'thinking' | 'non_thinking'
  reasoningEffort?: 'high' | 'max'
  transport: 'litellm_proxy'
  local: boolean
  priority: number
  qualityClass: 'frontier' | 'strong' | 'efficient' | 'local'
}

export type DSXUModelRoutingInput = {
  role: DSXUModelRole
  requiredContextTokens: number
  requiresTools?: boolean
  requiresReasoning?: boolean
  requiresFim?: boolean
  preferLocal?: boolean
  latencySensitive?: boolean
  allowPaidFrontier?: boolean
  complexAgentTask?: boolean
}

export type DSXUModelRoutingDecision = {
  selected: DSXUModelProfile
  fallbackChain: DSXUModelProfile[]
  litellmRequest: {
    model: string
    apiMode: 'thinking' | 'non_thinking'
    reasoningEffort?: 'high' | 'max'
  }
  reason: string
  needsCompaction: boolean
  dsxuMitigation: string[]
}

export const DSXU_MODEL_PROFILES: DSXUModelProfile[] = [
  {
    id: DEEPSEEK_V4_FLASH_MODEL,
    provider: 'deepseek',
    model: DEEPSEEK_V4_FLASH_MODEL,
    litellmModel: `deepseek/${DEEPSEEK_V4_FLASH_MODEL}`,
    roles: ['coder', 'summarizer', 'classifier'],
    contextWindow: DEEPSEEK_V4_MODEL_SPECS[DEEPSEEK_V4_FLASH_MODEL].contextWindow,
    maxOutputTokens: DEEPSEEK_V4_MODEL_SPECS[DEEPSEEK_V4_FLASH_MODEL].maxOutputTokens,
    supportsTools: true,
    supportsReasoning: true,
    supportsFim: false,
    apiMode: 'non_thinking',
    transport: 'litellm_proxy',
    local: false,
    priority: 10,
    qualityClass: 'strong',
  },
  {
    id: DEEPSEEK_V4_PRO_MODEL,
    provider: 'deepseek',
    model: DEEPSEEK_V4_PRO_MODEL,
    litellmModel: `deepseek/${DEEPSEEK_V4_PRO_MODEL}`,
    roles: ['planner', 'reviewer', 'recovery', 'verifier', 'coder', 'fim'],
    contextWindow: DEEPSEEK_V4_MODEL_SPECS[DEEPSEEK_V4_PRO_MODEL].contextWindow,
    maxOutputTokens: DEEPSEEK_V4_MODEL_SPECS[DEEPSEEK_V4_PRO_MODEL].maxOutputTokens,
    supportsTools: true,
    supportsReasoning: true,
    supportsFim: true,
    apiMode: 'thinking',
    reasoningEffort: 'max',
    transport: 'litellm_proxy',
    local: false,
    priority: 20,
    qualityClass: 'strong',
  },
]

export function routeDSXUModel(input: DSXUModelRoutingInput): DSXUModelRoutingDecision {
  const decision = decideDeepSeekV4Route({
    role: input.role,
    requiredContextTokens: input.requiredContextTokens,
    requiresFim: input.requiresFim,
    requiresReasoning: input.requiresReasoning,
    complexAgentTask: input.complexAgentTask,
    latencySensitive: input.latencySensitive,
  })
  const selected = DSXU_MODEL_PROFILES.find(profile => profile.id === decision.model) ?? DSXU_MODEL_PROFILES[0]
  const fallbackChain = DSXU_MODEL_PROFILES.filter(profile => profile.id !== selected.id)

  const dsxuMitigation = [
    'task_graph_decomposition',
    'repo_lsp_resource_retrieval',
    'tool_result_verification',
    'reviewer_verifier_loop',
    'checkpoint_watchdog_recovery',
    'central_deepseek_v4_cost_route_control',
  ]
  if (decision.needsCompaction) dsxuMitigation.unshift('context_collapse_and_brief')
  if (input.requiresFim) dsxuMitigation.push('force_pro_fim_non_thinking_beta')
  if (input.complexAgentTask) dsxuMitigation.push('force_pro_thinking_for_complex_agent_task')

  return {
    selected,
    fallbackChain,
    litellmRequest: {
      model: decision.litellmModel,
      apiMode: decision.apiMode,
      reasoningEffort: decision.reasoningEffort,
    },
    reason: `role=${input.role}; selected=${decision.model}; policy=${decision.reason}; context=${input.requiredContextTokens}/${decision.contextWindow}`,
    needsCompaction: decision.needsCompaction,
    dsxuMitigation,
  }
}

export function createDSXU46EquivalentCodingPlan(input?: { preferLocal?: boolean; allowPaidFrontier?: boolean }) {
  void input
  return {
    target: 'equivalent_or_better_than_reference_coding_workflow',
    roles: {
      planner: routeDSXUModel({ role: 'planner', requiredContextTokens: 200_000, requiresReasoning: true, requiresTools: true, complexAgentTask: true }),
      coder: routeDSXUModel({ role: 'coder', requiredContextTokens: 120_000, requiresTools: true }),
      fim: routeDSXUModel({ role: 'fim', requiredContextTokens: 32_000, requiresFim: true, latencySensitive: true }),
      reviewer: routeDSXUModel({ role: 'reviewer', requiredContextTokens: 180_000, requiresReasoning: true, requiresTools: true, complexAgentTask: true }),
      verifier: routeDSXUModel({ role: 'verifier', requiredContextTokens: 80_000, requiresTools: true }),
      recovery: routeDSXUModel({ role: 'recovery', requiredContextTokens: 180_000, requiresReasoning: true, requiresTools: true, complexAgentTask: true }),
    },
    requiredDSXUControls: [
      'single_mainline_tool_protocol',
      'central_deepseek_v4_cost_route_control',
      'context_collapse_compact_brief_classify',
      'repo_lsp_mcp_resource_layer',
      'task_graph_checkpoint_watchdog',
      'failure_taxonomy_recovery_loop',
      'verify_reviewer_checks_orchestration',
      'workspace_policy_governance',
    ],
  }
}
