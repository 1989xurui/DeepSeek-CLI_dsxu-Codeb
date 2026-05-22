export const DEEPSEEK_V4_FLASH_MODEL = 'deepseek-v4-flash' as const
export const DEEPSEEK_V4_PRO_MODEL = 'deepseek-v4-pro' as const

export type DeepSeekV4Model =
  | typeof DEEPSEEK_V4_FLASH_MODEL
  | typeof DEEPSEEK_V4_PRO_MODEL

export type DeepSeekV4ApiMode = 'thinking' | 'non_thinking'
export type DeepSeekV4ReasoningEffort = 'high' | 'max'
export type DeepSeekV4EndpointKind = 'chat_completions' | 'fim_completion'

export type DeepSeekV4RouteRole =
  | 'planner'
  | 'coder'
  | 'fim'
  | 'reviewer'
  | 'verifier'
  | 'recovery'
  | 'summarizer'
  | 'classifier'

export type DeepSeekV4WorkflowKind =
  | 'bugfix'
  | 'feature'
  | 'review'
  | 'verification'
  | 'repo_understanding'
  | 'recovery'
  | 'planning'
  | 'workflow'
  | 'generic_chat'
  | 'fim'

export type DeepSeekV4PolicyReason =
  | 'fim_flash_beta_non_thinking'
  | 'fim_pro_beta_non_thinking'
  | 'lightweight_flash_non_thinking'
  | 'strict_json_flash_non_thinking'
  | 'coding_flash_non_thinking'
  | 'coding_flash_thinking_high'
  | 'coding_flash_thinking_max'
  | 'verification_flash_non_thinking'
  | 'repo_understanding_flash_thinking_high'
  | 'planning_flash_thinking_max'
  | 'review_flash_thinking_max'
  | 'recovery_flash_thinking_max'
  | 'planning_review_pro_thinking_high'
  | 'complex_recovery_pro_thinking_max'
  | 'failed_verification_flash_thinking_max'
  | 'failed_verification_pro_thinking_max'
  | 'high_risk_pro_thinking_max_requires_approval'

export type DeepSeekV4Pricing = {
  cacheHitInputPerMillion: number
  cacheMissInputPerMillion: number
  outputPerMillion: number
  priceSource: 'official_deepseek_v4_2026_05'
  note?: string
}

export type DeepSeekV4ModelSpec = {
  name: DeepSeekV4Model
  displayName: string
  contextWindow: number
  maxOutputTokens: number
  defaultTemperature: number
  supportsReasoning: true
  supportsTools: true
  supportsFim: true
  supportsJsonOutput: true
  supportsPrefixCompletion: true
  supportedApiModes: readonly DeepSeekV4ApiMode[]
  supportedReasoningEfforts: readonly DeepSeekV4ReasoningEffort[]
  defaultApiMode: DeepSeekV4ApiMode
  pricing: DeepSeekV4Pricing
}

export type DeepSeekV4RouteInput = {
  workflowKind?: DeepSeekV4WorkflowKind
  role?: DeepSeekV4RouteRole
  riskLevel?: 'low' | 'medium' | 'high'
  requiresFim?: boolean
  requiresReasoning?: boolean
  complexAgentTask?: boolean
  highRiskBash?: boolean
  retryAfterFailure?: boolean
  failedVerification?: boolean
  priorFlashAttempted?: boolean
  savedTaskEvidence?: boolean
  allowProAdmission?: boolean
  forceNonThinkingJson?: boolean
  latencySensitive?: boolean
  requiredContextTokens?: number
  requestedMaxTokens?: number
}

export type DeepSeekV4RouteDecision = {
  provider: 'deepseek'
  gateway: 'direct_or_litellm'
  model: DeepSeekV4Model
  litellmModel: `deepseek/${DeepSeekV4Model}`
  apiMode: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
  endpointKind: DeepSeekV4EndpointKind
  approvalRequired: boolean
  reason: DeepSeekV4PolicyReason
  maxTokens: number
  contextWindow: number
  needsCompaction: boolean
  pricing: DeepSeekV4Pricing
  proAdmission?: {
    state: 'not_required' | 'requires_approval' | 'admitted' | 'blocked_missing_evidence'
    reason: string
    priorFlashAttempted: boolean
    savedTaskEvidence: boolean
    approvalRequired: boolean
  }
}

export type DeepSeekV4RuntimeModelOverrideInput = {
  currentModel: string | undefined
  routeDecision: DeepSeekV4RouteDecision
  autoOverrideActive?: boolean
  explicitModelOverride?: string | null | undefined
  disableModelUpgrade?: boolean
}

export type DeepSeekV4RuntimeModelOverrideDecision = {
  action: 'upgrade_to_pro' | 'downgrade_to_flash' | 'keep'
  model: DeepSeekV4Model
  nextAutoOverrideActive: boolean
  shouldRecordEvidence: boolean
  thinkingConfig:
    | { type: 'enabled'; budgetTokens: number }
    | { type: 'disabled' }
    | undefined
}

export type DeepSeekV4CostInput = {
  model: string
  cacheHitInputTokens?: number
  cacheMissInputTokens?: number
  inputTokens?: number
  outputTokens: number
  cacheHit?: boolean
}

export const DEEPSEEK_V4_CONTEXT_WINDOW = 1_048_576
export const DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS = 393_216
export const DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS = 4_096

export const DEEPSEEK_V4_PRICING: Record<DeepSeekV4Model, DeepSeekV4Pricing> = {
  [DEEPSEEK_V4_FLASH_MODEL]: {
    cacheHitInputPerMillion: 0.0028,
    cacheMissInputPerMillion: 0.14,
    outputPerMillion: 0.28,
    priceSource: 'official_deepseek_v4_2026_05',
  },
  [DEEPSEEK_V4_PRO_MODEL]: {
    cacheHitInputPerMillion: 0.003625,
    cacheMissInputPerMillion: 0.435,
    outputPerMillion: 0.87,
    priceSource: 'official_deepseek_v4_2026_05',
    note: 'DeepSeek V4 Pro 75% discount valid through 2026-05-31 per official pricing page.',
  },
}

export const DEEPSEEK_V4_MODEL_SPECS: Record<DeepSeekV4Model, DeepSeekV4ModelSpec> = {
  [DEEPSEEK_V4_FLASH_MODEL]: {
    name: DEEPSEEK_V4_FLASH_MODEL,
    displayName: 'DeepSeek V4 Flash',
    contextWindow: DEEPSEEK_V4_CONTEXT_WINDOW,
    maxOutputTokens: DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
    defaultTemperature: 0.3,
    supportsReasoning: true,
    supportsTools: true,
    supportsFim: true,
    supportsJsonOutput: true,
    supportsPrefixCompletion: true,
    supportedApiModes: ['non_thinking', 'thinking'],
    supportedReasoningEfforts: ['high', 'max'],
    defaultApiMode: 'non_thinking',
    pricing: DEEPSEEK_V4_PRICING[DEEPSEEK_V4_FLASH_MODEL],
  },
  [DEEPSEEK_V4_PRO_MODEL]: {
    name: DEEPSEEK_V4_PRO_MODEL,
    displayName: 'DeepSeek V4 Pro',
    contextWindow: DEEPSEEK_V4_CONTEXT_WINDOW,
    maxOutputTokens: DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
    defaultTemperature: 0.4,
    supportsReasoning: true,
    supportsTools: true,
    supportsFim: true,
    supportsJsonOutput: true,
    supportsPrefixCompletion: true,
    supportedApiModes: ['non_thinking', 'thinking'],
    supportedReasoningEfforts: ['high', 'max'],
    defaultApiMode: 'thinking',
    pricing: DEEPSEEK_V4_PRICING[DEEPSEEK_V4_PRO_MODEL],
  },
}

export const DEEPSEEK_V4_MODEL_ALIASES: Record<string, DeepSeekV4Model> = {
  flash: DEEPSEEK_V4_FLASH_MODEL,
  fast: DEEPSEEK_V4_FLASH_MODEL,
  coder: DEEPSEEK_V4_FLASH_MODEL,
  chat: DEEPSEEK_V4_FLASH_MODEL,
  'deepseek-chat': DEEPSEEK_V4_FLASH_MODEL,
  'deepseek-coder': DEEPSEEK_V4_FLASH_MODEL,
  'deepseek-flash': DEEPSEEK_V4_FLASH_MODEL,
  'flash-max': DEEPSEEK_V4_FLASH_MODEL,
  'deepseek-flash-max': DEEPSEEK_V4_FLASH_MODEL,
  [DEEPSEEK_V4_FLASH_MODEL]: DEEPSEEK_V4_FLASH_MODEL,

  pro: DEEPSEEK_V4_PRO_MODEL,
  planner: DEEPSEEK_V4_PRO_MODEL,
  reviewer: DEEPSEEK_V4_PRO_MODEL,
  recovery: DEEPSEEK_V4_PRO_MODEL,
  reasoner: DEEPSEEK_V4_PRO_MODEL,
  'deepseek-reasoner': DEEPSEEK_V4_FLASH_MODEL,
  'deepseek-pro': DEEPSEEK_V4_PRO_MODEL,
  [DEEPSEEK_V4_PRO_MODEL]: DEEPSEEK_V4_PRO_MODEL,
}

export function normalizeDeepSeekV4Model(model: string | undefined): DeepSeekV4Model {
  const normalized = (model ?? '').trim().toLowerCase()
  if (normalized.includes(DEEPSEEK_V4_PRO_MODEL)) return DEEPSEEK_V4_PRO_MODEL
  if (normalized.includes(DEEPSEEK_V4_FLASH_MODEL)) return DEEPSEEK_V4_FLASH_MODEL
  return DEEPSEEK_V4_MODEL_ALIASES[normalized] ?? DEEPSEEK_V4_FLASH_MODEL
}

export function isDeepSeekV4ModelLike(model: string | undefined): boolean {
  if (!model) return false
  const normalized = model.trim().toLowerCase()
  return (
    normalized in DEEPSEEK_V4_MODEL_ALIASES ||
    normalized.includes(DEEPSEEK_V4_FLASH_MODEL) ||
    normalized.includes(DEEPSEEK_V4_PRO_MODEL)
  )
}

export function getDeepSeekV4ModelSpec(model: string | undefined): DeepSeekV4ModelSpec {
  return DEEPSEEK_V4_MODEL_SPECS[normalizeDeepSeekV4Model(model)]
}

export function getDeepSeekV4Pricing(model: string | undefined): DeepSeekV4Pricing {
  return getDeepSeekV4ModelSpec(model).pricing
}

export function getDeepSeekV4DefaultMaxTokens(input: {
  model: string
  endpointKind?: DeepSeekV4EndpointKind
  apiMode?: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
  workflowKind?: DeepSeekV4WorkflowKind
  role?: DeepSeekV4RouteRole
}): number {
  if (input.endpointKind === 'fim_completion' || input.workflowKind === 'fim' || input.role === 'fim') {
    return DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS
  }

  if (input.reasoningEffort === 'max' || input.workflowKind === 'recovery') {
    return input.model === DEEPSEEK_V4_FLASH_MODEL ? 32_768 : 65_536
  }
  if (input.workflowKind === 'verification' || input.role === 'verifier') {
    return 8_192
  }
  if (
    input.workflowKind === 'planning' ||
    input.workflowKind === 'review' ||
    input.role === 'planner' ||
    input.role === 'reviewer'
  ) {
    return 32_768
  }
  if (input.workflowKind === 'repo_understanding' || input.apiMode === 'thinking') {
    return 16_384
  }
  if (
    input.workflowKind === 'bugfix' ||
    input.workflowKind === 'feature' ||
    input.role === 'coder'
  ) {
    return 16_384
  }
  return 8_192
}

export function clampDeepSeekV4MaxTokens(input: {
  model: string
  requestedMaxTokens?: number
  endpointKind?: DeepSeekV4EndpointKind
  apiMode?: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
  workflowKind?: DeepSeekV4WorkflowKind
  role?: DeepSeekV4RouteRole
}): number {
  const endpointKind = input.endpointKind ?? 'chat_completions'
  const hardCap =
    endpointKind === 'fim_completion'
      ? DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS
      : getDeepSeekV4ModelSpec(input.model).maxOutputTokens
  const wanted =
    input.requestedMaxTokens ??
    getDeepSeekV4DefaultMaxTokens({ ...input, endpointKind })
  return Math.max(1, Math.min(wanted, hardCap))
}

export function estimateDeepSeekV4Cost(input: DeepSeekV4CostInput): number {
  const pricing = getDeepSeekV4Pricing(input.model)
  const cacheHitInputTokens =
    input.cacheHitInputTokens ??
    (input.cacheHit ? input.inputTokens ?? 0 : 0)
  const cacheMissInputTokens =
    input.cacheMissInputTokens ??
    (input.cacheHit ? 0 : input.inputTokens ?? 0)

  return (
    (cacheHitInputTokens / 1_000_000) * pricing.cacheHitInputPerMillion +
    (cacheMissInputTokens / 1_000_000) * pricing.cacheMissInputPerMillion +
    (input.outputTokens / 1_000_000) * pricing.outputPerMillion
  )
}

type DeepSeekV4RouteInferenceContext = {
  initialPlanningTurn?: boolean
  allowTextFimInference?: boolean
}

function extractDeepSeekV4RouteIntentText(text: string | undefined): string {
  const raw = text ?? ''
  const taskPacketMatch = raw.match(/Task-specific review packet:\s*([\s\S]*)$/i)
  if (taskPacketMatch?.[1]) return taskPacketMatch[1]
  return raw
}

function hasExplicitFimRouteIntent(text: string): boolean {
  const lower = extractDeepSeekV4RouteIntentText(text).toLowerCase()
  if (!lower.trim()) return false
  const positiveAction =
    /\b(?:run|use|call|perform|execute|route|send|create|generate|request|invoke)\b/.test(lower) ||
    /(?:运行|使用|调用|执行|发起|生成|请求)/.test(lower)
  if (!positiveAction) return false
  return (
    /\b(?:fim|fill[- ]?in[- ]?the[- ]?middle|autocomplete)\b/.test(lower) ||
    /\b(?:code|prefix|suffix|inline)\s+completion\b/.test(lower) ||
    /\bcompletion\s+(?:prefix|suffix|candidate|request)\b/.test(lower) ||
    /(?:代码|前缀|后缀|中间)?补全/.test(lower)
  )
}

export function inferDeepSeekV4WorkflowKind(
  text: string | undefined,
  context: { allowTextFimInference?: boolean } = {},
): DeepSeekV4WorkflowKind {
  const routeIntentText = extractDeepSeekV4RouteIntentText(text)
  const lower = routeIntentText.toLowerCase()
  const hasAny = (terms: string[]) => terms.some(term => lower.includes(term))
  if (context.allowTextFimInference && hasExplicitFimRouteIntent(routeIntentText)) return 'fim'
  const hasChineseBenchmarkIntent =
    hasAny(['\u57fa\u51c6', '\u8bc4\u4f30', '\u6253\u699c', '\u699c\u5355', '\u8bc1\u636e\u4eea\u8868\u76d8']) &&
    (hasAny(['\u8fd0\u884c', '\u6267\u884c', '\u8f93\u51fa', '\u751f\u6210']) ||
      /\b(?:run|execute|output|generate)\b/.test(lower))
  if (hasChineseBenchmarkIntent) return 'verification'

  const hasChineseLongTaskIntent = hasAny([
    '\u7ee7\u7eed',
    '\u4e0a\u4e00\u4e2a',
    '\u957f\u671f',
    '\u957f\u4efb\u52a1',
    '\u8d26\u672c',
    '\u6309\u8d26\u672c',
  ])
  if (hasChineseLongTaskIntent) {
    return hasAny(['\u5931\u8d25', '\u62a5\u9519', '\u6062\u590d', '\u91cd\u8bd5'])
      ? 'recovery'
      : 'planning'
  }

  const hasChineseNoEditExplain =
    hasAny(['\u89e3\u91ca', '\u8bf4\u660e', '\u7406\u89e3', '\u903b\u8f91']) &&
    hasAny(['\u4e0d\u8981\u4fee\u6539', '\u4e0d\u7528\u4fee\u6539', '\u53ea\u5206\u6790', '\u53ea\u89e3\u91ca'])
  if (hasChineseNoEditExplain) return 'repo_understanding'

  const hasChineseMultiFileRefactor =
    hasAny(['\u591a\u6587\u4ef6', '\u91cd\u6784', '\u67b6\u6784', '\u6a21\u5757\u8fb9\u754c']) &&
    (hasAny(['\u67e5\u5f15\u7528', '\u5f15\u7528', '\u8dd1\u6d4b\u8bd5', '\u6d4b\u8bd5']) ||
      /\b(?:lsp|references?|test|tests)\b/.test(lower))
  if (hasChineseMultiFileRefactor) return 'planning'

  const hasRetryRecoveryWord = /\bretry(?![- ]?safe)\b/.test(lower)
  const hasLocalFailureContext =
    /\b(?:failed|failure|failing|error|timeout|stuck)\b[\s\S]{0,48}\b(?:verification|build|command|deploy|rerun|recover|recovery|retry)\b/.test(lower) ||
    /\b(?:verification|build|command|deploy|rerun)\b[\s\S]{0,48}\b(?:failed|failure|failing|error|timeout|stuck)\b/.test(lower)
  const hasExplicitFailedVerification =
    /\b(?:failed|failure|failing)\s+(?:verification|build|deploy|command)\b/.test(lower) ||
    /\b(?:verification|build|deploy|command)\s+(?:failed|failure)\b/.test(lower)
  const hasExplicitRecovery =
    (/\b(recover|resume|recovery)\b/.test(lower) && /\b(after|current|continue|stuck|timeout|failed|failure|verification|test|build|command|deploy|rerun)\b/.test(lower)) ||
    (hasLocalFailureContext && /\b(after|current|production|build|command|deploy|rerun|recover|recovery|retry|resume|stuck|timeout)\b/.test(lower)) ||
    (hasRetryRecoveryWord && /\b(failed|failure|after|verification|test|build|command|rerun)\b/.test(lower)) ||
    (/\brollback\b/.test(lower) && /\b(failed|failure|recover|resume|undo|restore|revert)\b/.test(lower)) ||
    hasExplicitFailedVerification ||
    hasAny(['\u9a8c\u8bc1\u5931\u8d25', '\u6d4b\u8bd5\u5931\u8d25', '\u6784\u5efa\u5931\u8d25', '\u5931\u8d25\u91cd\u8bd5', '\u4e2d\u65ad\u540e\u6062\u590d', '\u6062\u590d\u5f53\u524d\u4efb\u52a1'])
  if (hasExplicitRecovery) return 'recovery'

  const hasReviewIntent =
    /\b(review|audit|code\s+review|security\s+review|security\s+audit)\b/.test(lower) ||
    hasAny(['\u5ba1\u67e5', '\u5ba1\u6838', '\u8bc4\u5ba1', '\u5ba1\u8ba1'])
  const hasPlanningIntent =
    /\b(plan|design|architecture|roadmap)\b/.test(lower) ||
    hasAny(['\u65b9\u6848', '\u89c4\u5212', '\u67b6\u6784'])
  const hasBugfixIntent =
    /\b(bug|fix|error|crash|regression)\b/.test(lower) ||
    hasAny(['\u62a5\u9519', '\u4fee\u590d'])
  const hasFeatureIntent =
    /\b(feature|implement|add|create|scaffold)\b/.test(lower) ||
    /\bbuild\b/.test(lower) && !/\b(?:run|rerun|execute)\s+(?:the\s+)?build\b/.test(lower) ||
    hasAny(['\u65b0\u589e', '\u5b9e\u73b0', '\u5f00\u53d1', '\u6dfb\u52a0'])
  const hasVerificationIntent =
    /\b(check|verify|validate|test|tests|testing|lint|typecheck|type-check|tsc)\b/.test(lower) ||
    /\b(?:run|rerun|execute)\s+(?:the\s+)?(?:build|test|tests|lint|typecheck)\b/.test(lower) ||
    hasAny(['\u68c0\u67e5', '\u9a8c\u8bc1', '\u6d4b\u8bd5', '\u6784\u5efa', '\u8dd1\u6d4b\u8bd5', '\u786e\u8ba4\u901a\u8fc7'])

  if (hasReviewIntent) return 'review'
  if (hasPlanningIntent) return 'planning'
  if (hasBugfixIntent) return 'bugfix'
  if (hasFeatureIntent) return 'feature'
  if (hasVerificationIntent) return 'verification'
  if (/\b(explain|understand|map|scan|repo)\b/.test(lower) || hasAny(['\u4ee3\u7801\u5e93', '\u7406\u89e3', '\u68b3\u7406'])) return 'repo_understanding'
  return 'generic_chat'
}

function hasAnyTerm(text: string, terms: readonly string[]): boolean {
  return terms.some(term => text.includes(term))
}

function countPlanningRequirementMarkers(text: string): number {
  return (
    text.match(/(?:^|[\s\n])(?:\d{1,2}(?:[.)]|\u3001)|[-*]\s+|[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+(?:[.]|\u3001))/g)?.length ?? 0
  )
}

function inferBoundedCodingWorkflowKind(text: string | undefined): 'bugfix' | 'feature' | undefined {
  const lower = (text ?? '').toLowerCase()
  if (!lower.trim()) return undefined

  const hasBoundedWorkspace =
    /\b(?:fixture|local project)\s+path\b/.test(lower) ||
    /\bscoped\b[\s\S]{0,48}\bfixture\b/.test(lower) ||
    /\bwork only inside\b/.test(lower) ||
    /\bonly inside\b/.test(lower)
  const hasConcreteCodeTarget =
    /\bsrc\/[a-z0-9_./-]+/.test(lower) ||
    /\btest\/[a-z0-9_./-]+/.test(lower) ||
    /\bexisting-file changes?\b/.test(lower) ||
    /\bsmallest code change\b/.test(lower) ||
    /\bone focused (?:edit|write)\b/.test(lower) ||
    /\bfocused edit\b/.test(lower)
  const hasNativeVerification =
    /\b(?:run|rerun|execute)\s+(?:the\s+)?(?:bun|npm|pnpm|yarn)?\s*test\b/.test(lower) ||
    /\bbun test\b/.test(lower)
  const hasMutationIntent =
    /\b(?:fix|patch|edit|write|add|implement|create)\b/.test(lower) ||
    hasAnyTerm(lower, ['\u4fee\u590d', '\u65b0\u589e', '\u5b9e\u73b0', '\u6dfb\u52a0'])
  if (!(hasBoundedWorkspace && hasConcreteCodeTarget && hasNativeVerification && hasMutationIntent)) {
    return undefined
  }

  const hasExplicitReviewIntent =
    /\b(?:review|audit|security review|security audit)\b/.test(lower) ||
    hasAnyTerm(lower, ['\u5ba1\u67e5', '\u5ba1\u6838', '\u8bc4\u5ba1', '\u5ba1\u8ba1'])
  const hasExplicitRecoveryIntent =
    /\b(?:recover|recovery|resume)\b/.test(lower) ||
    /\brecovered\s+(?:test|state|task)\b/.test(lower) ||
    /\b(?:failed|failure|failing)\s+(?:verification|build|deploy|test|tests|retry|logic)\b/.test(lower) ||
    /\b(?:verification|build|deploy|test|tests|retry|logic)\s+(?:failed|failure|failing)\b/.test(lower) ||
    hasAnyTerm(lower, ['\u9a8c\u8bc1\u5931\u8d25', '\u6d4b\u8bd5\u5931\u8d25', '\u6784\u5efa\u5931\u8d25', '\u6062\u590d'])
  if (hasExplicitReviewIntent || hasExplicitRecoveryIntent) return undefined

  if (/\b(?:bug|fix|patch|regression)\b/.test(lower) || hasAnyTerm(lower, ['\u4fee\u590d'])) {
    return 'bugfix'
  }
  if (/\b(?:feature|implement|add|create|scaffold)\b/.test(lower) || hasAnyTerm(lower, ['\u65b0\u589e', '\u5b9e\u73b0', '\u6dfb\u52a0'])) {
    return 'feature'
  }
  return undefined
}

function shouldEscalateInitialGeneralPlanning(text: string, workflowKind: DeepSeekV4WorkflowKind): boolean {
  if (workflowKind === 'planning' || workflowKind === 'review' || workflowKind === 'recovery') {
    return true
  }

  const lower = text.toLowerCase()
  const requirementMarkers = countPlanningRequirementMarkers(text)
  const productOrSystemSurfaceTerms = [
    'website',
    'site',
    'frontend',
    'web app',
    'project',
    'requirements',
    'repo',
    'codebase',
    'runtime',
    'query loop',
    'tool lifecycle',
    'permission',
    'permissions',
    'toolchain',
    'shell',
    'wsl',
    'tui',
    'agent',
    'multi-agent',
    'memory',
    'resume',
    'compact',
    'context',
    'costrouter',
    'cost router',
    'control plane',
    'remote',
    'ci/cd',
    'benchmark',
    'release',
    'migration',
    'refactor',
    '\u7f51\u7ad9',
    '\u9875\u9762',
    '\u524d\u7aef',
    '\u9879\u76ee',
    '\u4ee3\u7801\u5e93',
    '\u4e3b\u94fe',
    '\u8fd0\u884c\u65f6',
    '\u5de5\u5177\u94fe',
    '\u6743\u9650',
    '\u667a\u80fd\u4f53',
    '\u8bb0\u5fc6',
    '\u6062\u590d',
    '\u538b\u7f29',
    '\u4e0a\u4e0b\u6587',
    '\u6210\u672c\u8def\u7531',
    '\u63a7\u5236\u9762',
    '\u8fdc\u7a0b',
    '\u6253\u699c',
    '\u8fc1\u79fb',
    '\u91cd\u6784',
  ]
  const complexityTerms = [
    'complete',
    'full',
    'deep',
    'comprehensive',
    'end-to-end',
    'multiple',
    'multi-step',
    'matrix',
    'audit',
    'architecture',
    'design',
    'orchestration',
    'planning',
    'recover',
    'stabilize',
    'commercial',
    'opensource',
    'open source',
    'module',
    'component',
    '\u5b8c\u6574',
    '\u5168\u5957',
    '\u529f\u80fd',
    '\u6a21\u5757',
    '\u6df1\u5ea6',
    '\u5168\u9762',
    '\u5b8c\u6574\u95ed\u73af',
    '\u591a\u9636\u6bb5',
    '\u591a\u6587\u4ef6',
    '\u591a\u6b65',
    '\u77e9\u9635',
    '\u5ba1\u8ba1',
    '\u67b6\u6784',
    '\u7f16\u6392',
    '\u7a33\u5b9a',
    '\u5546\u4e1a\u5316',
    '\u5f00\u6e90',
  ]
  const planningDeliverableTerms = [
    'plan',
    'roadmap',
    'strategy',
    'design doc',
    'execution plan',
    'acceptance',
    'evidence',
    'trace',
    'harness',
    '\u65b9\u6848',
    '\u89c4\u5212',
    '\u8def\u7ebf',
    '\u7b56\u7565',
    '\u9a8c\u6536',
    '\u8bc1\u636e',
    '\u6267\u884c',
    '\u6d4b\u8bd5',
  ]

  const hasSurface = hasAnyTerm(lower, productOrSystemSurfaceTerms)
  const hasComplexity = hasAnyTerm(lower, complexityTerms)
  const hasPlanningDeliverable = hasAnyTerm(lower, planningDeliverableTerms)
  const hasMultiStage =
    requirementMarkers >= 3 ||
    hasAnyTerm(lower, [
      'multi',
      'multiple',
      'end-to-end',
      'phase',
      'stage',
      '\u591a\u4e2a',
      '\u4e03\u4e2a',
      '\u591a\u9636\u6bb5',
      '\u5206\u9636\u6bb5',
      '\u5168\u94fe\u8def',
    ])
  const longStructuredPrompt = text.length >= 280 && requirementMarkers >= 1
  const score =
    (hasSurface ? 2 : 0) +
    (hasComplexity ? 2 : 0) +
    (hasMultiStage ? 2 : 0) +
    (hasPlanningDeliverable ? 1 : 0) +
    (longStructuredPrompt ? 1 : 0)

  return score >= 4 && (hasMultiStage || longStructuredPrompt)
}

function shouldTreatAsHighRiskPermissionWork(text: string | undefined): boolean {
  const lower = (text ?? '').toLowerCase()
  if (!lower.trim()) return false

  const nonNegatedRiskText = lower
    .split(/\r?\n|[.;]/)
    .filter(segment => {
      const hasRiskSurface =
        /\bforce[- ]?push\b/.test(segment) ||
        /\bgit\s+reset\s+--hard\b/.test(segment) ||
        /\brm\s+-rf\b/.test(segment) ||
        /\bremove-item\b/.test(segment) ||
        /\btaskkill\b|\bpkill\b/.test(segment) ||
        /\bencodedcommand\b|\binvoke-expression\b|\biex\b/.test(segment) ||
        /\b(?:curl|wget|iwr|invoke-webrequest)\b/.test(segment) ||
        /\bglobal\s+caches?\b|\binstall\s+dependencies\b/.test(segment) ||
        /\bdelete\s+files?\s+outside\b/.test(segment)
      const isSafetyGuardrail =
        /\b(?:never|do not|don't|avoid|without|must not|no)\b/.test(segment)
      return !(hasRiskSurface && isSafetyGuardrail)
    })
    .join('\n')

  const actualRiskPatterns = [
    /\bforce[- ]?push\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\brm\s+-rf\b/,
    /\bremove-item\b[\s\S]{0,40}\b(?:-recurse|-force)\b/,
    /\btaskkill\b|\bpkill\b/,
    /\bencodedcommand\b|\binvoke-expression\b|\biex\b/,
    /\b(?:curl|wget|iwr|invoke-webrequest)\b[\s\S]{0,64}\|\s*(?:sh|bash|pwsh|powershell|iex)\b/,
    /\bnetwork[- ]download[- ]execute\b|\bnetwork[- ]execute\b|\bdownload[- ]execute\b/,
    /\boutside\s+paths?\b|\bglobal\s+caches?\b|\binstall\s+dependencies\b/,
  ]
  if (actualRiskPatterns.some(pattern => pattern.test(nonNegatedRiskText))) return true

  const denialWorkflowPatterns = [
    /\brisky\s+commands?\b/,
    /\bdangerous\s+commands?\b/,
    /\bbypass\s+permissions?\b/,
    /\bpermission\s+den(?:y|ied|ial)\b/,
    /\btreat\b[\s\S]{0,64}\bas\s+denied\b/,
    /\bdeny\s+replan\b|\breplan\b[\s\S]{0,64}\bread-only\b/,
    /\bfail[- ]closed\b/,
  ]
  if (denialWorkflowPatterns.some(pattern => pattern.test(lower))) return true

  return hasAnyTerm(lower, [
    '\u6743\u9650\u62d2\u7edd',
    '\u7ed5\u8fc7\u6743\u9650',
    '\u7834\u574f\u6027\u64cd\u4f5c',
    '\u5f3a\u5236\u63a8\u9001',
    '\u7f51\u7edc\u4e0b\u8f7d\u6267\u884c',
  ])
}

function hasExplicitFailedVerificationText(text: string | undefined): boolean {
  const lower = (text ?? '').toLowerCase()
  return (
    /\b(?:failed|failure|failing)\s+(?:verification|build|deploy|command|test|tests)\b/.test(lower) ||
    /\b(?:verification|build|deploy|command|test|tests)\s+(?:failed|failure|failing)\b/.test(lower) ||
    hasAnyTerm(lower, ['\u9a8c\u8bc1\u5931\u8d25', '\u6d4b\u8bd5\u5931\u8d25', '\u6784\u5efa\u5931\u8d25'])
  )
}

export function inferDeepSeekV4RouteInput(
  text: string | undefined,
  context: DeepSeekV4RouteInferenceContext = {},
): DeepSeekV4RouteInput {
  const routeIntentText = extractDeepSeekV4RouteIntentText(text)
  const boundedCodingWorkflowKind = inferBoundedCodingWorkflowKind(routeIntentText)
  if (boundedCodingWorkflowKind) {
    return { workflowKind: boundedCodingWorkflowKind, role: 'coder' }
  }
  const workflowKind = inferDeepSeekV4WorkflowKind(routeIntentText, {
    allowTextFimInference: context.allowTextFimInference,
  })
  if (shouldTreatAsHighRiskPermissionWork(routeIntentText)) {
    return {
      workflowKind: workflowKind === 'generic_chat' ? 'review' : workflowKind,
      role: 'reviewer',
      riskLevel: 'high',
    }
  }
  if (
    context.initialPlanningTurn &&
    workflowKind === 'recovery' &&
    !hasExplicitFailedVerificationText(routeIntentText) &&
    shouldEscalateInitialGeneralPlanning(routeIntentText, workflowKind)
  ) {
    return { workflowKind: 'planning', role: 'planner' }
  }
  if (workflowKind === 'recovery') {
    if (hasExplicitFailedVerificationText(routeIntentText)) {
      return { workflowKind, role: 'recovery', failedVerification: true }
    }
    return { workflowKind, role: 'recovery', retryAfterFailure: true }
  }
  if (workflowKind === 'planning') {
    return { workflowKind, role: 'planner' }
  }
  if (context.initialPlanningTurn && shouldEscalateInitialGeneralPlanning(routeIntentText, workflowKind)) {
    return { workflowKind: 'planning', role: 'planner' }
  }
  if (workflowKind === 'review') {
    return { workflowKind, role: 'reviewer' }
  }
  if (workflowKind === 'verification') {
    return { workflowKind, role: 'verifier' }
  }
  return { workflowKind }
}

export function decideDeepSeekV4Route(input: DeepSeekV4RouteInput = {}): DeepSeekV4RouteDecision {
  const workflowKind = input.workflowKind ?? 'generic_chat'
  let model: DeepSeekV4Model = DEEPSEEK_V4_FLASH_MODEL
  let apiMode: DeepSeekV4ApiMode = 'non_thinking'
  let reasoningEffort: DeepSeekV4ReasoningEffort | undefined
  let endpointKind: DeepSeekV4EndpointKind = 'chat_completions'
  let approvalRequired = false
  let reason: DeepSeekV4PolicyReason = 'lightweight_flash_non_thinking'
  let proAdmission: DeepSeekV4RouteDecision['proAdmission']

  if (input.requiresFim || workflowKind === 'fim' || input.role === 'fim') {
    model = DEEPSEEK_V4_FLASH_MODEL
    apiMode = 'non_thinking'
    endpointKind = 'fim_completion'
    reason = 'fim_flash_beta_non_thinking'
  } else if (input.highRiskBash || input.riskLevel === 'high') {
    model = DEEPSEEK_V4_PRO_MODEL
    apiMode = 'thinking'
    reasoningEffort = 'max'
    approvalRequired = true
    reason = 'high_risk_pro_thinking_max_requires_approval'
    proAdmission = {
      state: 'requires_approval',
      reason: 'high-risk tool or permission work requires explicit Pro admission evidence',
      priorFlashAttempted: Boolean(input.priorFlashAttempted),
      savedTaskEvidence: Boolean(input.savedTaskEvidence),
      approvalRequired: true,
    }
  } else if (input.failedVerification && input.retryAfterFailure) {
    apiMode = 'thinking'
    reasoningEffort = 'max'
    const hasProAdmissionEvidence =
      input.allowProAdmission === true &&
      input.priorFlashAttempted === true &&
      input.savedTaskEvidence === true
    if (hasProAdmissionEvidence) {
      model = DEEPSEEK_V4_PRO_MODEL
      approvalRequired = true
      reason = 'failed_verification_pro_thinking_max'
      proAdmission = {
        state: 'admitted',
        reason: 'failed verification recovery has prior Flash attempt and saved task evidence',
        priorFlashAttempted: Boolean(input.priorFlashAttempted),
        savedTaskEvidence: Boolean(input.savedTaskEvidence),
        approvalRequired: true,
      }
    } else {
      reason = 'failed_verification_flash_thinking_max'
      proAdmission = {
        state: 'blocked_missing_evidence',
        reason: 'failed verification recovery stays on Flash-MAX until repeated failure, prior Flash attempt, and saved task evidence exist',
        priorFlashAttempted: Boolean(input.priorFlashAttempted),
        savedTaskEvidence: Boolean(input.savedTaskEvidence),
        approvalRequired: false,
      }
    }
  } else if (input.failedVerification) {
    apiMode = 'thinking'
    reasoningEffort = 'max'
    reason = 'failed_verification_flash_thinking_max'
  } else if (input.retryAfterFailure || input.complexAgentTask || workflowKind === 'recovery' || input.role === 'recovery') {
    apiMode = 'thinking'
    reasoningEffort = 'max'
    reason = 'recovery_flash_thinking_max'
  } else if (
    workflowKind === 'planning' ||
    input.role === 'planner'
  ) {
    apiMode = 'thinking'
    reasoningEffort = 'max'
    reason = 'planning_flash_thinking_max'
  } else if (
    workflowKind === 'review' ||
    input.role === 'reviewer'
  ) {
    apiMode = 'thinking'
    reasoningEffort = 'max'
    reason = 'review_flash_thinking_max'
  } else if (workflowKind === 'verification' || input.role === 'verifier') {
    apiMode = 'non_thinking'
    reason = 'verification_flash_non_thinking'
  } else if (input.forceNonThinkingJson) {
    reason = 'strict_json_flash_non_thinking'
  } else if (workflowKind === 'repo_understanding') {
    apiMode = 'thinking'
    reasoningEffort = 'high'
    reason = 'repo_understanding_flash_thinking_high'
  } else if (input.requiresReasoning) {
    apiMode = 'thinking'
    reasoningEffort = 'high'
    reason = 'coding_flash_thinking_high'
  } else if (
    workflowKind === 'bugfix' ||
    workflowKind === 'feature' ||
    input.role === 'coder'
  ) {
    apiMode = 'thinking'
    reasoningEffort = 'high'
    reason = 'coding_flash_thinking_high'
  }

  const contextWindow = getDeepSeekV4ModelSpec(model).contextWindow
  const maxTokens = clampDeepSeekV4MaxTokens({
    model,
    requestedMaxTokens: input.requestedMaxTokens,
    endpointKind,
    apiMode,
    reasoningEffort,
    workflowKind,
    role: input.role,
  })

  return {
    provider: 'deepseek',
    gateway: 'direct_or_litellm',
    model,
    litellmModel: `deepseek/${model}`,
    apiMode,
    reasoningEffort,
    endpointKind,
    approvalRequired,
    reason,
    maxTokens,
    contextWindow,
    needsCompaction: (input.requiredContextTokens ?? 0) > contextWindow * 0.85,
    pricing: getDeepSeekV4Pricing(model),
    proAdmission: proAdmission ?? {
      state: 'not_required',
      reason: 'Flash route selected; Pro admission not required',
      priorFlashAttempted: Boolean(input.priorFlashAttempted),
      savedTaskEvidence: Boolean(input.savedTaskEvidence),
      approvalRequired,
    },
  }
}

export function decideDeepSeekV4RuntimeModelOverride(
  input: DeepSeekV4RuntimeModelOverrideInput,
): DeepSeekV4RuntimeModelOverrideDecision {
  const currentV4Model = normalizeDeepSeekV4Model(input.currentModel)
  const explicitV4Override = input.explicitModelOverride
    ? normalizeDeepSeekV4Model(input.explicitModelOverride)
    : undefined
  const routeModel = input.routeDecision.model
  const routeThinkingConfig =
    input.routeDecision.apiMode === 'thinking'
      ? {
          type: 'enabled' as const,
          budgetTokens: Math.min(
            input.routeDecision.maxTokens - 1,
            input.routeDecision.reasoningEffort === 'max' ? 32_768 : 8_192,
          ),
        }
      : { type: 'disabled' as const }

  if (routeModel === DEEPSEEK_V4_PRO_MODEL && currentV4Model !== DEEPSEEK_V4_PRO_MODEL) {
    if (input.disableModelUpgrade === true) {
      return {
        action: 'keep',
        model: currentV4Model,
        nextAutoOverrideActive: false,
        shouldRecordEvidence: true,
        thinkingConfig: routeThinkingConfig,
      }
    }
    return {
      action: 'upgrade_to_pro',
      model: DEEPSEEK_V4_PRO_MODEL,
      nextAutoOverrideActive: true,
      shouldRecordEvidence: true,
      thinkingConfig: routeThinkingConfig,
    }
  }

  if (routeModel === DEEPSEEK_V4_FLASH_MODEL && currentV4Model !== DEEPSEEK_V4_FLASH_MODEL) {
    const userPinnedPro = explicitV4Override === DEEPSEEK_V4_PRO_MODEL
    if (input.autoOverrideActive || !userPinnedPro) {
      return {
        action: 'downgrade_to_flash',
        model: DEEPSEEK_V4_FLASH_MODEL,
        nextAutoOverrideActive: false,
        shouldRecordEvidence: false,
        thinkingConfig: { type: 'disabled' },
      }
    }
  }

  return {
    action: 'keep',
    model: currentV4Model,
    nextAutoOverrideActive:
      routeModel === DEEPSEEK_V4_PRO_MODEL
        ? input.autoOverrideActive ?? false
        : false,
    shouldRecordEvidence:
      routeModel === DEEPSEEK_V4_PRO_MODEL ||
      input.routeDecision.apiMode === 'thinking',
    thinkingConfig: routeThinkingConfig,
  }
}

export function formatDeepSeekV4ModelEvidence(decision: DeepSeekV4RouteDecision): string {
  return formatDeepSeekV4RequestEvidence({
    model: decision.model,
    apiMode: decision.apiMode,
    reasoningEffort: decision.reasoningEffort,
    reason: decision.reason,
    maxTokens: decision.maxTokens,
  })
}

export function formatDeepSeekV4RequestEvidence(input: {
  model: string
  apiMode: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
  reason: string
  maxTokens: number
}): string {
  const effort = input.reasoningEffort ? ` ${input.reasoningEffort}` : ''
  return `DSXU model evidence: ${normalizeDeepSeekV4Model(input.model)} ${input.apiMode}${effort}; reason=${input.reason}; max_tokens=${input.maxTokens}; cost_basis=cache_hit/cache_miss/output.`
}
