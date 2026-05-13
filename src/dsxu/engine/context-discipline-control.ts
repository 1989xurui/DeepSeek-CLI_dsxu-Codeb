import type { DSXUTraceCollector } from './dsxu-trace'

export type ContextIntent = 'code_edit' | 'shell' | 'review' | 'research' | 'unknown'
export type ContextAction = 'keep' | 'brief' | 'snapshot_hygiene' | 'compact' | 'collapse'
export type ContextRisk = 'low' | 'medium' | 'high' | 'critical'
export type ContextHygieneIssueType = 'message_volume' | 'long_message' | 'duplicate_message' | 'system_drift' | 'tool_noise'

export interface ContextHygieneIssue {
  type: ContextHygieneIssueType
  severity: Exclude<ContextRisk, 'low'>
  message: string
}

export interface ContextHygieneOptions {
  contextWindow?: number
}

export interface ContextDisciplineDecision {
  intent: ContextIntent
  action: ContextAction
  reason: string
  budgetRatio: number
  budgetProfile: ContextBudgetProfile
  depth: ContextDepthAnalysis
  routeHints: string[]
  risk: ContextRisk
  hygieneIssues: ContextHygieneIssue[]
  suggestedActions: string[]
}

export interface ContextDepthAnalysis {
  totalTurns: number
  userTurns: number
  assistantTurns: number
  estimatedTokens: number
  duplicateReadSignals: number
  depthLevel: 'low' | 'medium' | 'high'
}

export interface ContextBudgetProfile {
  model: string
  totalContextWindow: number
  stablePrefixBudget: number
  workingSetBudget: number
  memoryBundleBudget: number
  evidenceBundleBudget: number
  outputReserveBudget: number
}

export function decideContextDiscipline(input: {
  taskId: string
  runId?: string
  query: string
  usedTokens: number
  maxTokens: number
  messages?: Array<{ role: string; content: string }>
  trace?: DSXUTraceCollector
}): ContextDisciplineDecision {
  const intent = classifyIntent(input.query)
  const budgetRatio = input.maxTokens > 0 ? input.usedTokens / input.maxTokens : 1
  const depth = analyzeContextDepth({ messages: input.messages ?? [] })
  const budgetProfile = createContextBudgetProfile('dsxu-model', input.maxTokens)
  const hygieneIssues = evaluateContextHygiene(input.messages ?? [], {
    contextWindow: input.maxTokens,
  })
  const risk = calculateContextRisk(budgetRatio, hygieneIssues)
  const action = decideContextAction(budgetRatio, risk)
  const decision: ContextDisciplineDecision = {
    intent,
    action,
    budgetRatio,
    budgetProfile,
    depth,
    reason: `${intent} query at ${(budgetRatio * 100).toFixed(1)}% of route-aware context window with ${risk} context hygiene risk`,
    routeHints: buildRouteHints(intent, action),
    risk,
    hygieneIssues,
    suggestedActions: buildSuggestedActions(action, hygieneIssues),
  }
  input.trace?.record({
    type: 'task.updated',
    taskId: input.taskId,
    runId: input.runId,
    payload: { contextDiscipline: decision },
  })
  return decision
}

export function analyzeContextDepth(input: {
  messages: Array<{ role: string; content: string }>
  duplicateReadSignals?: number
}): ContextDepthAnalysis {
  const totalTurns = input.messages.length
  const userTurns = input.messages.filter((message) => message.role === 'user').length
  const assistantTurns = input.messages.filter((message) => message.role === 'assistant').length
  const estimatedTokens = Math.floor(input.messages.reduce((sum, message) => sum + (message.content ?? '').length, 0) / 4)
  const duplicateReadSignals = input.duplicateReadSignals ?? countDuplicateMessages(input.messages)
  const depthLevel =
    estimatedTokens > 120000 || totalTurns > 120 ? 'high' :
    estimatedTokens > 32000 || totalTurns > 40 ? 'medium' :
    'low'
  return { totalTurns, userTurns, assistantTurns, estimatedTokens, duplicateReadSignals, depthLevel }
}

export function createContextBudgetProfile(model: string, contextWindow: number): ContextBudgetProfile {
  return {
    model,
    totalContextWindow: contextWindow,
    stablePrefixBudget: Math.floor(contextWindow * 0.0625),
    workingSetBudget: Math.floor(contextWindow * 0.5),
    memoryBundleBudget: Math.floor(contextWindow * 0.2),
    evidenceBundleBudget: Math.floor(contextWindow * 0.15),
    outputReserveBudget: Math.floor(contextWindow * 0.1),
  }
}

export function evaluateContextHygiene(
  messages: Array<{ role: string; content: string }>,
  options: ContextHygieneOptions = {},
): ContextHygieneIssue[] {
  const issues: ContextHygieneIssue[] = []
  const contextWindow = Math.max(64_000, options.contextWindow ?? 1_000_000)
  const mediumMessageChars = Math.max(4_000, Math.floor(contextWindow * 0.015))
  const criticalMessageChars = Math.max(32_000, Math.floor(contextWindow * 0.08))

  if (messages.length >= 320) {
    issues.push({ type: 'message_volume', severity: 'critical', message: `context has ${messages.length} messages` })
  } else if (messages.length >= 160) {
    issues.push({ type: 'message_volume', severity: 'high', message: `context has ${messages.length} messages` })
  } else if (messages.length >= 80) {
    issues.push({ type: 'message_volume', severity: 'medium', message: `context has ${messages.length} messages` })
  }

  const seen = new Map<string, number>()
  let duplicateCount = 0
  for (const message of messages) {
    const content = message.content ?? ''
    if (content.length >= criticalMessageChars) {
      issues.push({
        type: 'long_message',
        severity: 'critical',
        message: `message exceeds ${criticalMessageChars} characters`,
      })
    } else if (content.length >= mediumMessageChars) {
      issues.push({
        type: 'long_message',
        severity: 'medium',
        message: `message exceeds ${mediumMessageChars} characters`,
      })
    }
    const fingerprint = `${message.role}:${content.slice(0, 200)}`
    const count = seen.get(fingerprint) ?? 0
    if (count === 1) duplicateCount++
    seen.set(fingerprint, count + 1)
  }
  if (duplicateCount > 0) {
    issues.push({ type: 'duplicate_message', severity: duplicateCount >= 3 ? 'high' : 'medium', message: `${duplicateCount} duplicate message groups` })
  }

  const systemMessages = messages.filter((message) => message.role === 'system').length
  if (systemMessages > 1) {
    issues.push({ type: 'system_drift', severity: 'high', message: `${systemMessages} system messages may conflict` })
  }
  const toolMessages = messages.filter((message) => message.role === 'tool').length
  if (toolMessages >= 25) {
    issues.push({ type: 'tool_noise', severity: 'medium', message: `${toolMessages} tool messages should be summarized` })
  }
  return issues
}

export function buildBrief(input: { title: string; decisions: string[]; failures?: string[]; nextSteps?: string[] }): string {
  return [
    `Brief: ${input.title}`,
    `Decisions: ${input.decisions.join('; ') || 'none'}`,
    `Failures: ${(input.failures || []).join('; ') || 'none'}`,
    `Next: ${(input.nextSteps || []).join('; ') || 'continue'}`,
  ].join('\n')
}

function classifyIntent(query: string): ContextIntent {
  const q = query.toLowerCase()
  if (/(edit|patch|fix|modify|refactor|代码|修改|修复)/i.test(q)) return 'code_edit'
  if (/(bash|shell|terminal|命令|终端|执行)/i.test(q)) return 'shell'
  if (/(review|verify|test|检查|验证|审查)/i.test(q)) return 'review'
  if (/(search|research|analyze|调研|分析)/i.test(q)) return 'research'
  return 'unknown'
}

function buildRouteHints(intent: ContextIntent, action: ContextAction): string[] {
  const hints = [`intent:${intent}`, `context:${action}`]
  if (intent === 'code_edit') hints.push('route:tool-capability')
  if (intent === 'review') hints.push('route:checks-orchestrator')
  if (action === 'snapshot_hygiene') hints.push('route:context-hygiene', 'route:snapshot-before-compact')
  if (action === 'collapse' || action === 'compact') hints.push('route:memory-refill')
  return hints
}

function calculateContextRisk(budgetRatio: number, issues: ContextHygieneIssue[]): ContextRisk {
  if (budgetRatio >= 0.96 || issues.some((issue) => issue.severity === 'critical')) return 'critical'
  if (budgetRatio >= 0.88 || issues.some((issue) => issue.severity === 'high')) return 'high'
  if (budgetRatio >= 0.65 || issues.some((issue) => issue.severity === 'medium')) return 'medium'
  return 'low'
}

function decideContextAction(budgetRatio: number, risk: ContextRisk): ContextAction {
  if (risk === 'critical' || budgetRatio >= 0.96) return 'collapse'
  if (risk === 'high' || budgetRatio >= 0.88) return 'snapshot_hygiene'
  if (risk === 'medium' || budgetRatio >= 0.65) return 'brief'
  return 'keep'
}

function buildSuggestedActions(action: ContextAction, issues: ContextHygieneIssue[]): string[] {
  const actions = new Set<string>([`context:${action}`])
  for (const issue of issues) {
    if (issue.type === 'long_message' || issue.type === 'message_volume') actions.add('summarize-context')
    if (issue.type === 'duplicate_message') actions.add('deduplicate-context')
    if (issue.type === 'system_drift') actions.add('rebuild-prompt-stack')
    if (issue.type === 'tool_noise') actions.add('collapse-tool-output')
  }
  if (action === 'snapshot_hygiene') {
    actions.add('snapshot-current-task-state')
    actions.add('compress-volatile-output-only')
  }
  return [...actions]
}

function countDuplicateMessages(messages: Array<{ role: string; content: string }>): number {
  const seen = new Set<string>()
  let duplicates = 0
  for (const message of messages) {
    const key = `${message.role}:${(message.content ?? '').slice(0, 200)}`
    if (seen.has(key)) duplicates++
    seen.add(key)
  }
  return duplicates
}
