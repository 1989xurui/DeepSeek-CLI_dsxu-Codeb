import {
  decideDeepSeekV4Route,
  type DeepSeekV4PolicyReason,
  type DeepSeekV4RouteDecision,
  type DeepSeekV4RouteInput,
  type DeepSeekV4RouteRole,
  type DeepSeekV4WorkflowKind,
} from '../../utils/model/deepseekV4Control'

export type DSXUModelRole = DeepSeekV4RouteRole

export type DSXUCodingTaskKind = Exclude<DeepSeekV4WorkflowKind, 'generic_chat' | 'fim'>

export type DSXUDeepSeekPolicyReason =
  | DeepSeekV4PolicyReason
  | 'fim_non_thinking_required'
  | 'lightweight_non_thinking'
  | 'coding_thinking_high'
  | 'repo_understanding_thinking_high'
  | 'complex_or_recovery_pro_max'
  | 'high_risk_requires_pro_max_and_approval'
  | 'strict_json_non_thinking'

export interface DSXUDeepSeekPolicyInput extends DeepSeekV4RouteInput {
  workflowKind: DSXUCodingTaskKind | 'generic_chat' | 'fim'
}

export interface DSXUDeepSeekPolicy {
  provider: 'deepseek'
  gateway: 'litellm'
  externalApiSurface: 'dsxu-cli-mainline'
  model: DeepSeekV4RouteDecision['model']
  litellmModel: DeepSeekV4RouteDecision['litellmModel']
  apiMode: DeepSeekV4RouteDecision['apiMode']
  reasoningEffort?: DeepSeekV4RouteDecision['reasoningEffort']
  endpointKind: DeepSeekV4RouteDecision['endpointKind']
  approvalRequired: boolean
  reason: DSXUDeepSeekPolicyReason
  maxTokens: number
}

export function decideDSXUDeepSeekPolicy(input: DSXUDeepSeekPolicyInput): DSXUDeepSeekPolicy {
  const decision = decideDeepSeekV4Route(input)
  return {
    provider: 'deepseek',
    gateway: 'litellm',
    externalApiSurface: 'dsxu-cli-mainline',
    model: decision.model,
    litellmModel: decision.litellmModel,
    apiMode: decision.apiMode,
    reasoningEffort: decision.reasoningEffort,
    endpointKind: decision.endpointKind,
    approvalRequired: decision.approvalRequired,
    reason: decision.reason,
    maxTokens: decision.maxTokens,
  }
}
