import { resolve } from 'node:path'
import type { ProductCoreGuardDecision } from './workspace-policy.js'
import type { LongTaskLedgerEvent } from './progress-ledger.js'
import type { DSXUWorkStateEvent, DSXUWorkStateRisk } from './work-state-timeline.js'
import {
  decideDeepSeekV4Route,
  inferDeepSeekV4WorkflowKind,
  type DeepSeekV4ApiMode,
  type DeepSeekV4Model,
  type DeepSeekV4PolicyReason,
  type DeepSeekV4ReasoningEffort,
  type DeepSeekV4RouteDecision,
  type DeepSeekV4WorkflowKind,
} from '../../utils/model/deepseekV4Control.js'
import {
  buildDSXUV8LogicalToolWindow,
  evaluateDSXUV8ToolWindowCount,
  resolveDSXUV8ToolWindowPolicy,
} from './tool-window-policy-v8.js'

export type DSXUActionContractRisk = DSXUWorkStateRisk | 'critical'

export type DSXUExecutionTaskType =
  | 'single_file_edit'
  | 'multi_file_refactor'
  | 'debug'
  | 'review'
  | 'long_task'
  | 'explain'
  | 'search'
  | 'benchmark'

export type DSXUExecutionWorkflow =
  | 'observe'
  | 'plan_execute_verify'
  | 'review'
  | 'recovery'
  | 'long_task'

export type DSXUExecutionModelRoute =
  | 'flash'
  | 'flash_thinking'
  | 'flash_max'
  | 'pro'

export type DSXUVerificationLevel =
  | 'none'
  | 'syntax'
  | 'type'
  | 'affected_tests'
  | 'full'

export type DSXUFallbackPolicy =
  | 'retry'
  | 'replan'
  | 'rollback'
  | 'escalate_pro'
  | 'ask_user'

export type DSXUClaimPolicy =
  | 'no_claim'
  | 'partial_claim'
  | 'verified_claim'

export type DSXUExecutionContract = {
  schemaVersion: 'dsxu.execution-contract.v5'
  contractId: string
  taskType: DSXUExecutionTaskType
  risk: DSXUActionContractRisk
  modelRoute: DSXUExecutionModelRoute
  workflow: DSXUExecutionWorkflow
  visibleTools: readonly string[]
  verificationLevel: DSXUVerificationLevel
  maxToolCalls: number
  requiresSourceEvidence: boolean
  requiresAgentEvidence: boolean
  fallbackPolicy: DSXUFallbackPolicy
  claimPolicy: DSXUClaimPolicy
  routeDecision: {
    provider: 'deepseek'
    model: DeepSeekV4Model
    apiMode: DeepSeekV4ApiMode
    reasoningEffort?: DeepSeekV4ReasoningEffort
    reason: DeepSeekV4PolicyReason
    maxTokens: number
    approvalRequired: boolean
    proAdmission?: DeepSeekV4RouteDecision['proAdmission']
  }
  owner: 'Query Loop / PlanGraph / Tool Gate'
  evidence: readonly string[]
  guards: readonly string[]
  createdAt: number
}

export type DSXUExecutionContractInput = {
  taskId?: string
  userRequest: string
  workspaceSignals?: {
    changedFiles?: readonly string[]
    availableScripts?: readonly string[]
    hasPackageJson?: boolean
    isDirty?: boolean
  }
  riskTags?: readonly string[]
  publicClaimIntent?: boolean
  benchmarkIntent?: boolean
  deleteIntent?: boolean
  externalSideEffectIntent?: boolean
  requiresAgentEvidence?: boolean
  priorFailureCount?: number
  sourceEvidenceCount?: number
  maxToolCalls?: number
  routeDecisionOverride?: DeepSeekV4RouteDecision
  now?: number
}

export type DSXUExecutionContractValidation = {
  valid: boolean
  missingFields: readonly string[]
  violations: readonly string[]
}

export type DSXUActionContract = {
  schemaVersion: 'dsxu.action-contract.v2'
  contractId: string
  goal: string
  allowedFiles: readonly string[]
  nextTool: string
  verificationCommand: readonly string[]
  fallbackPlan: string
  riskLevel: DSXUActionContractRisk
  owner: 'Tool Gate'
  createdAt: number
}

export type DSXUWriteOperationComplexity = {
  riskLevel: DSXUActionContractRisk
  requiresActionContract: boolean
  reasons: readonly string[]
}

export type DSXUActionContractValidation = {
  valid: boolean
  missingFields: readonly string[]
  violations: readonly string[]
}

export type DSXUActionContractScopeDecision = {
  decision: 'allow' | 'require_refresh' | 'block'
  reason: string
  targetPath: string
  matchedAllowedPath?: string
  gateDecision: 'allow' | 'require_confirmation' | 'block'
  executionDecision: 'execute' | 'execute_guarded' | 'deny'
  evidence: readonly string[]
}

const HIGH_RISK_TAGS = new Set([
  'permission',
  'security',
  'tool',
  'query-loop',
  'agent',
  'mcp',
  'skill',
  'provider',
  'release',
  'product-core',
  'external',
  'destructive',
])

const CRITICAL_RISK_TAGS = new Set([
  'release',
  'public-claim',
  'benchmark',
  'permission',
  'security',
  'destructive',
  'external',
  'delete',
])

const CHINESE_INTENT = {
  explain: [
    '\u89e3\u91ca',
    '\u8bf4\u660e',
    '\u7406\u89e3',
    '\u903b\u8f91',
    '\u4e0d\u8981\u4fee\u6539',
    '\u4e0d\u7528\u4fee\u6539',
    '\u4e0d\u8981\u7f16\u8f91',
  ],
  benchmark: [
    '\u57fa\u51c6',
    '\u8bc4\u4f30',
    '\u6253\u699c',
    '\u699c\u5355',
    '\u8bc1\u636e\u4eea\u8868\u76d8',
    '\u901a\u8fc7\u5931\u8d25\u8bc1\u660e',
    '\u5bf9\u6bd4\u6570\u636e',
  ],
  longTask: [
    '\u7ee7\u7eed',
    '\u4e0a\u4e00\u4e2a',
    '\u957f\u671f',
    '\u957f\u4efb\u52a1',
    '\u8d26\u672c',
    '\u5168\u90e8\u5269\u4f59',
    '\u6309\u8d26\u672c',
  ],
  debug: [
    '\u4fee\u590d',
    '\u5931\u8d25',
    '\u62a5\u9519',
    '\u6062\u590d\u5931\u8d25',
    '\u9519\u8bef',
    '\u91cd\u8bd5',
  ],
  review: ['\u5ba1\u67e5', '\u5ba1\u6838', '\u5ba1\u8ba1', '\u8bc4\u5ba1'],
  search: ['\u641c\u7d22', '\u67e5\u627e', '\u67e5\u8be2', '\u5b9a\u4f4d', '\u5f15\u7528', '\u5728\u54ea'],
  refactor: ['\u591a\u6587\u4ef6', '\u91cd\u6784', '\u67b6\u6784', '\u8fb9\u754c', '\u6a21\u5757'],
  edit: ['\u5b9e\u73b0', '\u65b0\u589e', '\u4fee\u6539', '\u5f00\u53d1', '\u8865\u4e01', '\u7f16\u8f91'],
} as const

function hasAnyLiteral(text: string, terms: readonly string[]): boolean {
  return terms.some(term => text.includes(term))
}

function hasNoEditIntent(text: string): boolean {
  return (
    /\b(?:do not|don't|without)\s+(?:edit|modify|change|write|patch)\b/.test(text.toLowerCase()) ||
    hasAnyLiteral(text, [
      '\u4e0d\u8981\u4fee\u6539',
      '\u4e0d\u7528\u4fee\u6539',
      '\u4e0d\u9700\u4fee\u6539',
      '\u4e0d\u8981\u7f16\u8f91',
      '\u4e0d\u5199\u4ee3\u7801',
      '\u53ea\u5206\u6790',
      '\u53ea\u89e3\u91ca',
    ])
  )
}

function inferExecutionTaskType(input: DSXUExecutionContractInput): DSXUExecutionTaskType {
  const text = input.userRequest.toLowerCase()
  const raw = input.userRequest
  const noEditIntent = hasNoEditIntent(raw)
  const changedFiles = input.workspaceSignals?.changedFiles ?? []
  if (
    noEditIntent &&
    (/\b(?:explain|understand|describe|read-only|no edit)\b/.test(text) ||
      hasAnyLiteral(raw, CHINESE_INTENT.explain))
  ) {
    return 'explain'
  }
  if (
    hasAnyLiteral(raw, CHINESE_INTENT.benchmark) &&
    (/\b(?:run|execute|output|generate)\b/.test(text) ||
      hasAnyLiteral(raw, ['\u8fd0\u884c', '\u8f93\u51fa', '\u751f\u6210']))
  ) {
    return 'benchmark'
  }
  if (
    /\b(?:long task|continue|resume|multi-step|all remaining|checkpoint)\b/.test(text) ||
    hasAnyLiteral(raw, CHINESE_INTENT.longTask)
  ) {
    return 'long_task'
  }
  if (
    changedFiles.length > 1 ||
    /\b(?:refactor|architecture|module boundary|multi-file|multi file)\b/.test(text) ||
    (hasAnyLiteral(raw, CHINESE_INTENT.refactor) &&
      (/\b(?:lsp|reference|references|test|edit|change)\b/.test(text) ||
        hasAnyLiteral(raw, ['\u67e5', '\u5f15\u7528', '\u6d4b\u8bd5', '\u4fee\u6539'])))
  ) {
    return 'multi_file_refactor'
  }
  if (/\b(?:review|audit|code review|security review)\b/.test(text) || hasAnyLiteral(raw, CHINESE_INTENT.review)) {
    return 'review'
  }
  if (
    /\b(?:debug|bug|fix|failure|failed|error|crash|recover|recovery)\b/.test(text) ||
    hasAnyLiteral(raw, CHINESE_INTENT.debug)
  ) {
    return 'debug'
  }
  if (
    !noEditIntent &&
    /\b(?:implement|add|edit|write|patch|feature|change)\b/.test(text) &&
    !/^\s*(?:search|find|locate|grep|rg)\b/.test(text) &&
    !/\bbefore\s+(?:editing|edit|changing|writing|patching)\b/.test(text)
  ) {
    return 'single_file_edit'
  }
  if (input.benchmarkIntent || /\b(?:benchmark|replay|score|eval|leaderboard)\b/.test(text)) {
    return 'benchmark'
  }
  if (/\b(?:review|audit|code review|security review)\b/.test(text) || /审查|审核|审计/.test(input.userRequest)) {
    return 'review'
  }
  if (/\b(?:debug|bug|fix|failure|failed|error|crash|recover|recovery)\b/.test(text) || /修复|失败|恢复|报错/.test(input.userRequest)) {
    return 'debug'
  }
  if (/\b(?:long task|continue|resume|multi-step|all remaining)\b/.test(text) || /继续|全部|长期|多步/.test(input.userRequest)) {
    return 'long_task'
  }
  if (
    /\b(?:search|find|locate|grep|rg|where is|list references|references)\b/.test(text) ||
    /搜索|查找|查询|定位|引用|在哪/.test(input.userRequest)
  ) {
    return 'search'
  }
  if (
    changedFiles.length > 1 ||
    /\b(?:refactor|architecture|module boundary|multi-file)\b/.test(text) ||
    /重构|架构|多文件|边界/.test(input.userRequest)
  ) {
    return 'multi_file_refactor'
  }
  if (/\b(?:implement|add|edit|write|patch|feature|change)\b/.test(text) || /实现|新增|修改|开发|补丁/.test(input.userRequest)) {
    return 'single_file_edit'
  }
  return 'explain'
}

function inferExecutionRisk(
  input: DSXUExecutionContractInput,
  taskType: DSXUExecutionTaskType,
): DSXUActionContractRisk {
  const riskTags = new Set((input.riskTags ?? []).map(tag => tag.toLowerCase()))
  const text = input.userRequest.toLowerCase()
  const changedFileCount = input.workspaceSignals?.changedFiles?.length ?? 0
  const raw = input.userRequest
  if (
    hasAnyLiteral(raw, [
      '\u53d1\u5e03',
      '\u516c\u5f00\u58f0\u660e',
      '\u5220\u9664',
      '\u79d8\u94a5',
      '\u6743\u9650',
      '\u5b89\u5168',
      '\u7834\u574f\u6027',
    ])
  ) {
    return 'critical'
  }
  if (
    input.publicClaimIntent ||
    input.deleteIntent ||
    input.externalSideEffectIntent ||
    [...riskTags].some(tag => CRITICAL_RISK_TAGS.has(tag)) ||
    /\b(?:release claim|public claim|delete|destructive|secret|security|permission)\b/.test(text) ||
    /发布声明|公开声明|删除|破坏性|密钥|权限|安全/.test(input.userRequest)
  ) {
    return 'critical'
  }
  if (
    taskType === 'multi_file_refactor' ||
    taskType === 'benchmark' ||
    changedFileCount > 2 ||
    (input.priorFailureCount ?? 0) >= 2 ||
    [...riskTags].some(tag => HIGH_RISK_TAGS.has(tag)) ||
    /\b(?:migration|provider|runtime|tool gate|mcp|agent)\b/.test(text) ||
    /迁移|运行时|工具门|智能体/.test(input.userRequest)
  ) {
    return 'high'
  }
  if (
    taskType === 'single_file_edit' ||
    taskType === 'debug' ||
    changedFileCount > 0 ||
    input.workspaceSignals?.isDirty
  ) {
    return 'medium'
  }
  return 'low'
}

function workflowForExecutionTask(
  taskType: DSXUExecutionTaskType,
): DSXUExecutionWorkflow {
  switch (taskType) {
    case 'explain':
    case 'search':
      return 'observe'
    case 'review':
      return 'review'
    case 'debug':
      return 'recovery'
    case 'long_task':
      return 'long_task'
    case 'single_file_edit':
    case 'multi_file_refactor':
    case 'benchmark':
      return 'plan_execute_verify'
  }
}

function workflowKindForExecutionTask(
  taskType: DSXUExecutionTaskType,
  userRequest: string,
): DeepSeekV4WorkflowKind {
  switch (taskType) {
    case 'single_file_edit':
      return inferDeepSeekV4WorkflowKind(userRequest) === 'bugfix' ? 'bugfix' : 'feature'
    case 'multi_file_refactor':
    case 'long_task':
      return 'planning'
    case 'debug':
      return 'recovery'
    case 'review':
      return 'review'
    case 'benchmark':
      return 'verification'
    case 'explain':
    case 'search':
      return 'generic_chat'
  }
}

function verificationForExecutionTask(
  taskType: DSXUExecutionTaskType,
  risk: DSXUActionContractRisk,
): DSXUVerificationLevel {
  if (risk === 'critical' || risk === 'high') return 'full'
  if (taskType === 'review' || taskType === 'benchmark') return 'affected_tests'
  if (taskType === 'single_file_edit' || taskType === 'debug' || taskType === 'multi_file_refactor') {
    return risk === 'medium' ? 'affected_tests' : 'syntax'
  }
  return 'none'
}

function fallbackForExecutionContract(
  taskType: DSXUExecutionTaskType,
  risk: DSXUActionContractRisk,
  priorFailureCount: number,
): DSXUFallbackPolicy {
  if (risk === 'critical') return 'ask_user'
  if (priorFailureCount >= 2) return 'rollback'
  if (taskType === 'debug' || taskType === 'long_task') return 'replan'
  if (risk === 'high') return 'escalate_pro'
  return 'retry'
}

function claimPolicyForExecutionContract(input: {
  risk: DSXUActionContractRisk
  publicClaimIntent?: boolean
  benchmarkIntent?: boolean
  sourceEvidenceCount: number
  verificationLevel: DSXUVerificationLevel
}): DSXUClaimPolicy {
  if (input.publicClaimIntent || input.benchmarkIntent || input.risk === 'critical') {
    return 'no_claim'
  }
  if (input.verificationLevel === 'none') return 'partial_claim'
  return input.sourceEvidenceCount > 0 ? 'verified_claim' : 'partial_claim'
}

function modelRouteFromDecision(input: {
  model: DeepSeekV4Model
  apiMode: DeepSeekV4ApiMode
  reasoningEffort?: DeepSeekV4ReasoningEffort
}): DSXUExecutionModelRoute {
  if (input.model === 'deepseek-v4-pro') return 'pro'
  if (input.apiMode === 'thinking' && input.reasoningEffort === 'max') return 'flash_max'
  if (input.apiMode === 'thinking') return 'flash_thinking'
  return 'flash'
}

function clampContractToolCalls(value: number | undefined, risk: DSXUActionContractRisk): number {
  const defaultValue = risk === 'low' ? 8 : risk === 'medium' ? 14 : 18
  return Math.max(1, Math.min(value ?? defaultValue, 30))
}

function sanitizeId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'contract'
  )
}

function normalizeForCompare(path: string): string {
  const normalized = resolve(path).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isInside(target: string, allowed: string): boolean {
  const targetPath = normalizeForCompare(target)
  const allowedPath = normalizeForCompare(allowed)
  return (
    targetPath === allowedPath ||
    targetPath.startsWith(`${allowedPath}\\`) ||
    targetPath.startsWith(`${allowedPath}/`)
  )
}

function maxRisk(
  left: DSXUActionContractRisk,
  right: DSXUActionContractRisk,
): DSXUActionContractRisk {
  const rank: Record<DSXUActionContractRisk, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  return rank[left] >= rank[right] ? left : right
}

export function classifyDSXUWriteOperationComplexity(input: {
  toolName: string
  filePaths?: readonly string[]
  riskTags?: readonly string[]
}): DSXUWriteOperationComplexity {
  const reasons: string[] = []
  const fileCount = new Set(
    (input.filePaths ?? []).map(path => normalizeForCompare(path)),
  ).size
  let riskLevel: DSXUActionContractRisk = 'low'

  if (fileCount > 1) {
    riskLevel = maxRisk(riskLevel, 'medium')
    reasons.push('multi-file write scope')
  }
  for (const tag of input.riskTags ?? []) {
    const normalizedTag = tag.trim().toLowerCase()
    if (!normalizedTag) continue
    if (HIGH_RISK_TAGS.has(normalizedTag)) {
      riskLevel = maxRisk(
        riskLevel,
        normalizedTag === 'external' || normalizedTag === 'destructive'
          ? 'critical'
          : 'high',
      )
      reasons.push(`high-risk tag:${normalizedTag}`)
    }
  }
  if (/bash|powershell|agent|mcp|skill/i.test(input.toolName)) {
    riskLevel = maxRisk(riskLevel, 'medium')
    reasons.push(`side-effect-capable tool:${input.toolName}`)
  }

  return {
    riskLevel,
    requiresActionContract: riskLevel !== 'low' || fileCount > 1,
    reasons: reasons.length > 0 ? reasons : ['single low-risk write'],
  }
}

export function buildDSXUActionContract(input: {
  goal: string
  allowedFiles: readonly string[]
  nextTool: string
  verificationCommand?: readonly string[]
  fallbackPlan?: string
  riskLevel?: DSXUActionContractRisk
  now?: number
}): DSXUActionContract {
  const now = input.now ?? Date.now()
  return {
    schemaVersion: 'dsxu.action-contract.v2',
    contractId: `action-contract-${sanitizeId(input.nextTool)}-${sanitizeId(input.goal)}-${now}`,
    goal: input.goal.trim(),
    allowedFiles: input.allowedFiles.map(path => resolve(path)),
    nextTool: input.nextTool.trim(),
    verificationCommand: [...(input.verificationCommand ?? [])],
    fallbackPlan: (input.fallbackPlan ?? '').trim(),
    riskLevel: input.riskLevel ?? 'medium',
    owner: 'Tool Gate',
    createdAt: now,
  }
}

export function compileDSXUExecutionContract(
  input: DSXUExecutionContractInput,
): DSXUExecutionContract {
  const taskType = inferExecutionTaskType(input)
  const risk = inferExecutionRisk(input, taskType)
  const workflow = workflowForExecutionTask(taskType)
  const workflowKind = workflowKindForExecutionTask(taskType, input.userRequest)
  const verificationLevel = verificationForExecutionTask(taskType, risk)
  const priorFailureCount = input.priorFailureCount ?? 0
  const sourceEvidenceCount = input.sourceEvidenceCount ?? 0
  const routeDecision = input.routeDecisionOverride ?? decideDeepSeekV4Route({
    workflowKind,
    role:
      taskType === 'review'
        ? 'reviewer'
        : taskType === 'debug'
          ? 'recovery'
          : taskType === 'explain' || taskType === 'search'
            ? 'summarizer'
            : taskType === 'benchmark'
              ? 'verifier'
              : 'coder',
    riskLevel: risk === 'critical' ? 'high' : risk,
    requiresReasoning: risk !== 'low' && taskType !== 'explain' && taskType !== 'search',
    complexAgentTask: taskType === 'long_task' || input.requiresAgentEvidence,
    highRiskBash: input.externalSideEffectIntent || risk === 'critical',
    retryAfterFailure: priorFailureCount > 0,
    failedVerification: priorFailureCount > 0,
    priorFlashAttempted: priorFailureCount > 0,
    savedTaskEvidence: sourceEvidenceCount > 0,
    allowProAdmission: risk === 'critical' || priorFailureCount >= 2,
  })
  const modelRoute = modelRouteFromDecision(routeDecision)
  const toolWindowPolicy = resolveDSXUV8ToolWindowPolicy({
    taskType,
    risk,
    modelRoute,
    publicClaimIntent: input.publicClaimIntent,
    benchmarkIntent: input.benchmarkIntent,
  })
  const visibleTools = buildDSXUV8LogicalToolWindow({
    taskType,
    risk,
    modelRoute,
    publicClaimIntent: input.publicClaimIntent,
    benchmarkIntent: input.benchmarkIntent,
    maxVisibleTools: input.maxToolCalls,
  })
  const toolWindowCountDecision = evaluateDSXUV8ToolWindowCount({
    visibleToolCount: visibleTools.length,
    policy: toolWindowPolicy,
    actualToolPoolCount: visibleTools.length,
  })
  const evidence = [
    `taskType:${taskType}`,
    `risk:${risk}`,
    `workflow:${workflow}`,
    `route:${routeDecision.reason}`,
    input.routeDecisionOverride ? 'routeDecisionSource:query-mainline' : 'routeDecisionSource:contract-compiler',
    `model:${routeDecision.model}`,
    `apiMode:${routeDecision.apiMode}`,
    routeDecision.reasoningEffort ? `reasoning:${routeDecision.reasoningEffort}` : '',
    routeDecision.proAdmission ? `proAdmission:${routeDecision.proAdmission.state}` : '',
    routeDecision.proAdmission ? `proAdmissionReason:${routeDecision.proAdmission.reason}` : '',
    `verification:${verificationLevel}`,
    `sourceEvidenceCount:${sourceEvidenceCount}`,
    `toolWindowProfile:${toolWindowPolicy.profile}`,
    `toolWindowDefault:${toolWindowPolicy.defaultVisibleTools}`,
    `toolWindowMax:${toolWindowPolicy.maxVisibleTools}`,
  ].filter(Boolean)
  const maxToolCalls = Math.max(
    visibleTools.length,
    clampContractToolCalls(input.maxToolCalls, risk),
  )
  const guards = [
    ...toolWindowCountDecision.guards,
    risk === 'high' && routeDecision.model === 'deepseek-v4-flash' && routeDecision.apiMode === 'non_thinking'
      ? 'high-risk task cannot remain Flash non-thinking without review evidence'
      : '',
    risk === 'critical' && !routeDecision.approvalRequired
      ? 'critical task requires explicit approval evidence before execution'
      : '',
  ].filter(Boolean)
  return {
    schemaVersion: 'dsxu.execution-contract.v5',
    contractId: `execution-contract-${sanitizeId(taskType)}-${sanitizeId(input.taskId ?? input.userRequest)}-${input.now ?? Date.now()}`,
    taskType,
    risk,
    modelRoute,
    workflow,
    visibleTools,
    verificationLevel,
    maxToolCalls,
    requiresSourceEvidence: taskType !== 'explain',
    requiresAgentEvidence: Boolean(input.requiresAgentEvidence || taskType === 'long_task'),
    fallbackPolicy: fallbackForExecutionContract(taskType, risk, priorFailureCount),
    claimPolicy: claimPolicyForExecutionContract({
      risk,
      publicClaimIntent: input.publicClaimIntent,
      benchmarkIntent: input.benchmarkIntent,
      sourceEvidenceCount,
      verificationLevel,
    }),
    routeDecision: {
      provider: routeDecision.provider,
      model: routeDecision.model,
      apiMode: routeDecision.apiMode,
      reasoningEffort: routeDecision.reasoningEffort,
      reason: routeDecision.reason,
      maxTokens: routeDecision.maxTokens,
      approvalRequired: routeDecision.approvalRequired,
      proAdmission: routeDecision.proAdmission,
    },
    owner: 'Query Loop / PlanGraph / Tool Gate',
    evidence,
    guards,
    createdAt: input.now ?? Date.now(),
  }
}

export function validateDSXUExecutionContract(
  contract: DSXUExecutionContract,
): DSXUExecutionContractValidation {
  const missingFields: string[] = []
  const violations: string[] = []
  if (!contract.contractId) missingFields.push('contractId')
  if (!contract.taskType) missingFields.push('taskType')
  if (!contract.risk) missingFields.push('risk')
  if (!contract.modelRoute) missingFields.push('modelRoute')
  if (!contract.workflow) missingFields.push('workflow')
  if (!contract.visibleTools.length) missingFields.push('visibleTools')
  if (!contract.verificationLevel) missingFields.push('verificationLevel')
  if (!contract.fallbackPolicy) missingFields.push('fallbackPolicy')
  if (!contract.claimPolicy) missingFields.push('claimPolicy')
  if (!contract.routeDecision.reason) missingFields.push('routeDecision.reason')
  if (contract.schemaVersion !== 'dsxu.execution-contract.v5') {
    violations.push('schemaVersion must be dsxu.execution-contract.v5')
  }
  if (contract.owner !== 'Query Loop / PlanGraph / Tool Gate') {
    violations.push('owner must remain Query Loop / PlanGraph / Tool Gate')
  }
  const toolWindowPolicy = resolveDSXUV8ToolWindowPolicy({
    taskType: contract.taskType,
    risk: contract.risk,
    modelRoute: contract.modelRoute,
  })
  const toolWindowCountDecision = evaluateDSXUV8ToolWindowCount({
    visibleToolCount: contract.visibleTools.length,
    policy: toolWindowPolicy,
    actualToolPoolCount: contract.visibleTools.length,
  })
  violations.push(...toolWindowCountDecision.guards)
  if (contract.risk === 'high' && contract.modelRoute === 'flash' && contract.verificationLevel !== 'full') {
    violations.push('high-risk execution must not be Flash-only without full verification')
  }
  if (contract.risk === 'critical' && contract.claimPolicy !== 'no_claim') {
    violations.push('critical/public-claim execution must not allow final public claim')
  }
  return {
    valid: missingFields.length === 0 && violations.length === 0 && contract.guards.length === 0,
    missingFields,
    violations: [...violations, ...contract.guards],
  }
}

export function projectDSXUExecutionContractToLedgerEvent(
  contract: DSXUExecutionContract,
): Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
  eventId?: string
  timestamp?: number
  taskId?: string
} {
  return {
    kind: 'task_contract',
    owner: contract.owner,
    summary: `${contract.taskType} ${contract.workflow} via ${contract.modelRoute}`,
    evidence: [
      `contract:${contract.contractId}`,
      `risk:${contract.risk}`,
      `route:${contract.routeDecision.reason}`,
      `model:${contract.routeDecision.model}`,
      `verification:${contract.verificationLevel}`,
      `claimPolicy:${contract.claimPolicy}`,
      `visibleToolCount:${contract.visibleTools.length}`,
      ...contract.evidence,
    ],
    metadata: {
      executionContract: contract,
      taskType: contract.taskType,
      risk: contract.risk,
      modelRoute: contract.modelRoute,
      workflow: contract.workflow,
      visibleTools: contract.visibleTools,
      verificationLevel: contract.verificationLevel,
      requiresSourceEvidence: contract.requiresSourceEvidence,
      requiresAgentEvidence: contract.requiresAgentEvidence,
      fallbackPolicy: contract.fallbackPolicy,
      claimPolicy: contract.claimPolicy,
      routeDecision: contract.routeDecision,
    },
  }
}

export function validateDSXUActionContract(
  contract: DSXUActionContract,
): DSXUActionContractValidation {
  const missingFields: string[] = []
  const violations: string[] = []
  if (!contract.goal) missingFields.push('goal')
  if (contract.allowedFiles.length === 0) missingFields.push('allowedFiles')
  if (!contract.nextTool) missingFields.push('nextTool')
  if (contract.verificationCommand.length === 0) {
    missingFields.push('verificationCommand')
  }
  if (!contract.fallbackPlan) missingFields.push('fallbackPlan')
  if (contract.owner !== 'Tool Gate') violations.push('owner must remain Tool Gate')
  if (contract.schemaVersion !== 'dsxu.action-contract.v2') {
    violations.push('schemaVersion must be dsxu.action-contract.v2')
  }
  return {
    valid: missingFields.length === 0 && violations.length === 0,
    missingFields,
    violations,
  }
}

export function evaluateDSXUActionContractScope(input: {
  contract: DSXUActionContract
  targetPath: string
  action: 'read' | 'write' | 'execute'
  productCoreGuard?: ProductCoreGuardDecision
}): DSXUActionContractScopeDecision {
  const validation = validateDSXUActionContract(input.contract)
  const targetPath = resolve(input.targetPath)
  const evidence = [
    `contract:${input.contract.contractId}`,
    `owner:${input.contract.owner}`,
    `tool:${input.contract.nextTool}`,
    `risk:${input.contract.riskLevel}`,
  ]

  if (input.productCoreGuard && !input.productCoreGuard.allowed) {
    return {
      decision: 'block',
      reason: input.productCoreGuard.reason,
      targetPath,
      gateDecision: 'block',
      executionDecision: 'deny',
      evidence: [
        ...evidence,
        `productCoreGuard:${input.productCoreGuard.decisionId}`,
      ],
    }
  }

  if (!validation.valid) {
    return {
      decision: 'require_refresh',
      reason: `action contract incomplete: ${[
        ...validation.missingFields,
        ...validation.violations,
      ].join(', ')}`,
      targetPath,
      gateDecision: 'require_confirmation',
      executionDecision: 'execute_guarded',
      evidence: [...evidence, 'contract:incomplete'],
    }
  }

  if (input.action === 'read') {
    return {
      decision: 'allow',
      reason: 'read action allowed by source-truth workflow',
      targetPath,
      gateDecision: 'allow',
      executionDecision: 'execute',
      evidence: [...evidence, 'action:read'],
    }
  }

  const matchedAllowedPath = input.contract.allowedFiles.find(path =>
    isInside(targetPath, path),
  )
  if (!matchedAllowedPath) {
    return {
      decision: 'block',
      reason: 'target path is outside the current Action Contract scope fence',
      targetPath,
      gateDecision: 'block',
      executionDecision: 'deny',
      evidence: [...evidence, 'scope:outside-allowed-files'],
    }
  }

  return {
    decision: 'allow',
    reason: 'target path is inside the current Action Contract scope fence',
    targetPath,
    matchedAllowedPath,
    gateDecision: input.contract.riskLevel === 'low' ? 'allow' : 'require_confirmation',
    executionDecision:
      input.contract.riskLevel === 'low' ? 'execute' : 'execute_guarded',
    evidence: [...evidence, `scope:${matchedAllowedPath}`],
  }
}

export function projectDSXUActionContractToWorkStateEvent(
  contract: DSXUActionContract,
  decision: DSXUActionContractScopeDecision,
): DSXUWorkStateEvent {
  return {
    id: `action-contract-${contract.contractId}`,
    kind: 'permission',
    status: decision.decision === 'allow' ? 'completed' : 'blocked',
    title: `Action Contract ${decision.decision} for ${contract.nextTool}`,
    owner: contract.owner,
    risk: contract.riskLevel === 'critical' ? 'high' : contract.riskLevel,
    toolName: contract.nextTool,
    permissionDecision: decision.decision === 'allow' ? 'granted' : 'denied',
    gateDecision: decision.gateDecision,
    detail: decision.reason,
    evidence: decision.evidence,
  }
}
