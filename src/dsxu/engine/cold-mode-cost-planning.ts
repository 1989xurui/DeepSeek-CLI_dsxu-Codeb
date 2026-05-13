import {
  DEEPSEEK_V4_PRO_MODEL,
  decideDeepSeekV4Route,
  estimateDeepSeekV4Cost,
  formatDeepSeekV4ModelEvidence,
  type DeepSeekV4RouteDecision,
  type DeepSeekV4RouteInput,
} from '../../utils/model/deepseekV4Control'

export type DSXUColdModeNode = {
  id: string
  kind: 'planning' | 'repo_probe' | 'coding' | 'verification_analysis' | 'recovery' | 'final_report'
  routeInput: DeepSeekV4RouteInput
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
}

export type DSXUColdModeNodeDecision = DSXUColdModeNode & {
  decision: DeepSeekV4RouteDecision
  costUsd: number
  proOnlyCostUsd: number
  modelEvidence: string
}

export type DSXUColdModePlanReport = {
  scenario: 'normal_success' | 'failed_verification_recovery'
  nodes: readonly DSXUColdModeNodeDecision[]
  proNodeRatio: number
  proHardNodeReasons: readonly string[]
  totalCostUsd: number
  proOnlyCostUsd: number
  savingsVsProOnlyPct: number
  withinColdBudget: boolean
  finalModelEvidence: string
}

export function createDefaultColdModeNodes(input: {
  failedVerification?: boolean
} = {}): DSXUColdModeNode[] {
  const nodes: DSXUColdModeNode[] = [
    {
      id: 'plan',
      kind: 'planning',
      routeInput: { workflowKind: 'planning', role: 'planner' },
      cacheHitInputTokens: 4_000,
      cacheMissInputTokens: 1_000,
      outputTokens: 800,
    },
    {
      id: 'repo-probe',
      kind: 'repo_probe',
      routeInput: { workflowKind: 'repo_understanding', forceNonThinkingJson: true },
      cacheHitInputTokens: 8_000,
      cacheMissInputTokens: 1_500,
      outputTokens: 700,
    },
    {
      id: 'code-patch',
      kind: 'coding',
      routeInput: { workflowKind: 'feature', role: 'coder' },
      cacheHitInputTokens: 10_000,
      cacheMissInputTokens: 3_000,
      outputTokens: 1_200,
    },
    {
      id: 'final-report',
      kind: 'final_report',
      routeInput: { workflowKind: 'generic_chat', forceNonThinkingJson: true },
      cacheHitInputTokens: 3_000,
      cacheMissInputTokens: 500,
      outputTokens: 500,
    },
  ]
  if (input.failedVerification) {
    nodes.splice(3, 0, {
      id: 'failed-verification-analysis',
      kind: 'verification_analysis',
      routeInput: { workflowKind: 'feature', failedVerification: true },
      cacheHitInputTokens: 6_000,
      cacheMissInputTokens: 2_000,
      outputTokens: 900,
    })
    nodes.splice(4, 0, {
      id: 'recovery-repair',
      kind: 'recovery',
      routeInput: { workflowKind: 'recovery', role: 'recovery', retryAfterFailure: true },
      cacheHitInputTokens: 7_000,
      cacheMissInputTokens: 2_500,
      outputTokens: 1_100,
    })
  }
  return nodes
}

export function buildDSXUColdModePlanReport(input: {
  scenario: DSXUColdModePlanReport['scenario']
  nodes: readonly DSXUColdModeNode[]
}): DSXUColdModePlanReport {
  const decisions = input.nodes.map(node => {
    const decision = decideDeepSeekV4Route(node.routeInput)
    const costUsd = estimateDeepSeekV4Cost({
      model: decision.model,
      cacheHitInputTokens: node.cacheHitInputTokens,
      cacheMissInputTokens: node.cacheMissInputTokens,
      outputTokens: node.outputTokens,
    })
    const proOnlyCostUsd = estimateDeepSeekV4Cost({
      model: DEEPSEEK_V4_PRO_MODEL,
      cacheHitInputTokens: node.cacheHitInputTokens,
      cacheMissInputTokens: node.cacheMissInputTokens,
      outputTokens: node.outputTokens,
    })
    return {
      ...node,
      decision,
      costUsd,
      proOnlyCostUsd,
      modelEvidence: formatDeepSeekV4ModelEvidence(decision),
    }
  })
  const proNodes = decisions.filter(node => node.decision.model === DEEPSEEK_V4_PRO_MODEL)
  const proNodeRatio = Math.round((proNodes.length / Math.max(1, decisions.length)) * 1000) / 10
  const totalCostUsd = decisions.reduce((sum, node) => sum + node.costUsd, 0)
  const proOnlyCostUsd = decisions.reduce((sum, node) => sum + node.proOnlyCostUsd, 0)
  const savingsVsProOnlyPct = Math.round(((proOnlyCostUsd - totalCostUsd) / Math.max(0.000001, proOnlyCostUsd)) * 1000) / 10
  const proHardNodeReasons = proNodes.map(node => `${node.id}:${node.decision.reason}`)
  return {
    scenario: input.scenario,
    nodes: decisions,
    proNodeRatio,
    proHardNodeReasons,
    totalCostUsd,
    proOnlyCostUsd,
    savingsVsProOnlyPct,
    withinColdBudget:
      input.scenario === 'normal_success'
        ? proNodeRatio <= 25 && savingsVsProOnlyPct >= 40
        : proHardNodeReasons.every(reason => /planning|failed_verification|recovery/.test(reason)),
    finalModelEvidence: decisions.map(node => `${node.id}: ${node.modelEvidence}`).join('\n'),
  }
}
