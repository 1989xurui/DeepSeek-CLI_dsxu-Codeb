import { appendFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../constants/prompts'
import type { SystemPrompt } from '../../utils/systemPromptType'
import {
  buildDSXUPromptPrefixCachePlan,
  type DSXUPromptCacheWorkflowKind,
} from './v18-prompt-prefix-cache-builder'

export type DSXUQueryPromptPrefixCacheEvidence = {
  event: 'prompt_prefix_cache_evidence'
  workflowKind: DSXUPromptCacheWorkflowKind
  routeReason: string
  model: string
  querySource: string
  turnCount: number
  stablePrefixHash: string
  dynamicTailHash: string
  fullPromptHash: string
  stablePrefixApproxTokens: number
  dynamicTailApproxTokens: number
  fullPromptApproxTokens: number
  cacheMissBudgetTokens: number
  stableBlockCount: number
  dynamicBlockCount: number
  boundaryFound: boolean
  volatileFindingCount: number
  volatileFindings: readonly {
    sectionId: string
    kind: string
    sample: string
  }[]
  status: 'CACHE_PREFIX_READY' | 'CACHE_PREFIX_NEEDS_CLEANUP'
}

const WORKFLOW_KINDS = new Set<DSXUPromptCacheWorkflowKind>([
  'planning',
  'coding',
  'review',
  'recovery',
  'agent',
  'verification',
  'repo_understanding',
])

function normalizeWorkflowKind(value: unknown): DSXUPromptCacheWorkflowKind {
  if (typeof value === 'string' && WORKFLOW_KINDS.has(value as DSXUPromptCacheWorkflowKind)) {
    return value as DSXUPromptCacheWorkflowKind
  }
  if (value === 'bugfix' || value === 'feature') return 'coding'
  if (value === 'failedVerification') return 'recovery'
  if (value === 'complexAgentTask') return 'agent'
  return 'coding'
}

function splitPromptByDynamicBoundary(systemPrompt: readonly string[]): {
  stableBlocks: string[]
  dynamicBlocks: string[]
  boundaryFound: boolean
} {
  const boundaryIndex = systemPrompt.findIndex(block => block === SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
  if (boundaryIndex === -1) {
    return {
      stableBlocks: [...systemPrompt],
      dynamicBlocks: [],
      boundaryFound: false,
    }
  }
  return {
    stableBlocks: systemPrompt.slice(0, boundaryIndex).filter(Boolean),
    dynamicBlocks: systemPrompt.slice(boundaryIndex + 1).filter(Boolean),
    boundaryFound: true,
  }
}

function appendRouteTraceEvidence(evidence: DSXUQueryPromptPrefixCacheEvidence): void {
  const tracePath = process.env.DSXU_ROUTE_TRACE_FILE
  if (!tracePath) return
  try {
    mkdirSync(dirname(tracePath), { recursive: true })
    appendFileSync(
      tracePath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        ...evidence,
      })}\n`,
      { mode: 0o600 },
    )
  } catch {
    // Diagnostics must never perturb query execution.
  }
}

export function recordDSXUQueryPromptPrefixCacheEvidence(input: {
  systemPrompt: SystemPrompt
  routeReason: string
  workflowKind?: unknown
  model: string
  querySource: string
  turnCount: number
  traceLifecycle?: (event: string, data?: Record<string, unknown>) => void
}): DSXUQueryPromptPrefixCacheEvidence {
  const { stableBlocks, dynamicBlocks, boundaryFound } = splitPromptByDynamicBoundary(input.systemPrompt)
  const workflowKind = normalizeWorkflowKind(input.workflowKind)
  const plan = buildDSXUPromptPrefixCachePlan({
    workflowKind,
    stableSections: [
      {
        id: 'system_rules',
        content: stableBlocks.join('\n\n'),
      },
    ],
    dynamicSections: [
      {
        id: 'dynamic_tail',
        content: dynamicBlocks.join('\n\n'),
      },
    ],
  })
  const volatileFindings = plan.volatileFindings.map(finding => ({
    sectionId: finding.sectionId,
    kind: finding.kind,
    sample: finding.sample,
  }))
  const evidence: DSXUQueryPromptPrefixCacheEvidence = {
    event: 'prompt_prefix_cache_evidence',
    workflowKind,
    routeReason: input.routeReason,
    model: input.model,
    querySource: input.querySource,
    turnCount: input.turnCount,
    stablePrefixHash: plan.stablePrefixHash,
    dynamicTailHash: plan.dynamicTailHash,
    fullPromptHash: plan.fullPromptHash,
    stablePrefixApproxTokens: plan.stablePrefixApproxTokens,
    dynamicTailApproxTokens: plan.dynamicTailApproxTokens,
    fullPromptApproxTokens: plan.fullPromptApproxTokens,
    cacheMissBudgetTokens: plan.cacheMissBudgetTokens,
    stableBlockCount: stableBlocks.length,
    dynamicBlockCount: dynamicBlocks.length,
    boundaryFound,
    volatileFindingCount: volatileFindings.length,
    volatileFindings,
    status: plan.status,
  }
  appendRouteTraceEvidence(evidence)
  input.traceLifecycle?.('prompt_prefix_cache_evidence', {
    workflowKind: evidence.workflowKind,
    routeReason: evidence.routeReason,
    model: evidence.model,
    stablePrefixHash: evidence.stablePrefixHash,
    dynamicTailHash: evidence.dynamicTailHash,
    dynamicTailApproxTokens: evidence.dynamicTailApproxTokens,
    cacheMissBudgetTokens: evidence.cacheMissBudgetTokens,
    volatileFindingCount: evidence.volatileFindingCount,
    status: evidence.status,
    boundaryFound: evidence.boundaryFound,
  })
  return evidence
}
