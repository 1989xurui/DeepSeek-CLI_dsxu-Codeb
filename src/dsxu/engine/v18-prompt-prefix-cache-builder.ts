import { createHash } from 'crypto'

export type DSXUPromptPrefixSection = {
  id: string
  content: string
}

export type DSXUDynamicPromptSection = {
  id: string
  content: string
}

export type DSXUPromptCacheWorkflowKind =
  | 'planning'
  | 'coding'
  | 'review'
  | 'recovery'
  | 'agent'
  | 'verification'
  | 'repo_understanding'

export type DSXUPromptPrefixVolatileFinding = {
  sectionId: string
  kind: 'timestamp' | 'absolute_path' | 'trace_or_run_path' | 'temp_path' | 'random_id'
  sample: string
  recommendation: string
}

export type DSXUPromptPrefixCachePlan = {
  ok: boolean
  status: 'CACHE_PREFIX_READY' | 'CACHE_PREFIX_NEEDS_CLEANUP'
  workflowKind: DSXUPromptCacheWorkflowKind
  stablePrefix: string
  dynamicTail: string
  stablePrefixHash: string
  dynamicTailHash: string
  fullPromptHash: string
  stablePrefixChars: number
  dynamicTailChars: number
  fullPromptChars: number
  stablePrefixApproxTokens: number
  dynamicTailApproxTokens: number
  fullPromptApproxTokens: number
  stableSectionOrder: readonly string[]
  dynamicSectionOrder: readonly string[]
  cacheMissBudgetTokens: number
  volatileFindings: readonly DSXUPromptPrefixVolatileFinding[]
  guards: readonly string[]
  recommendations: readonly string[]
}

const STABLE_SECTION_ORDER = [
  'system_rules',
  'tool_schemas',
  'permission_policy',
  'model_routing_policy',
  'semantic_tool_layer',
  'output_contract',
]

const CACHE_MISS_BUDGET_BY_WORKFLOW: Record<DSXUPromptCacheWorkflowKind, number> = {
  planning: 2_000,
  coding: 8_000,
  review: 5_000,
  recovery: 10_000,
  agent: 15_000,
  verification: 2_000,
  repo_understanding: 6_000,
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim()
}

function renderSection(section: DSXUPromptPrefixSection | DSXUDynamicPromptSection): string {
  return [`<dsxu-section id="${section.id}">`, normalizeNewlines(section.content), '</dsxu-section>'].join('\n')
}

function stableSectionRank(sectionId: string): number {
  const index = STABLE_SECTION_ORDER.indexOf(sectionId)
  return index === -1 ? STABLE_SECTION_ORDER.length : index
}

function orderStableSections(sections: readonly DSXUPromptPrefixSection[]): DSXUPromptPrefixSection[] {
  return [...sections].sort((a, b) => {
    const rankDelta = stableSectionRank(a.id) - stableSectionRank(b.id)
    return rankDelta !== 0 ? rankDelta : a.id.localeCompare(b.id)
  })
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[0] ?? null
}

function detectVolatileFindings(section: DSXUPromptPrefixSection): DSXUPromptPrefixVolatileFinding[] {
  const text = section.content
  const checks: Array<Omit<DSXUPromptPrefixVolatileFinding, 'sectionId' | 'sample'> & { pattern: RegExp }> = [
    {
      kind: 'timestamp',
      pattern: /\b20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/,
      recommendation: 'Move timestamps/current date into dynamic tail or task snapshot metadata.',
    },
    {
      kind: 'temp_path',
      pattern: /(?:AppData[\\/]+Local[\\/]+Temp|[\\/](?:tmp|temp)[\\/]|\\Temp\\)[^\s"'<>]*/i,
      recommendation: 'Move temporary paths into dynamic tail; keep stable prefix path-free.',
    },
    {
      kind: 'trace_or_run_path',
      pattern: /\.dsxu[\\/]+(?:trace|runs)[^\s"'<>]*/i,
      recommendation: 'Move trace/run artifact paths into dynamic tail evidence fields.',
    },
    {
      kind: 'absolute_path',
      pattern: /(?:[A-Za-z]:[\\/]|\/mnt\/[a-z]\/|\/home\/|\/Users\/)[^\s"'<>]*/i,
      recommendation: 'Move workspace-specific absolute paths into dynamic tail or canonical aliases.',
    },
    {
      kind: 'random_id',
      pattern: /\b(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|(?=[a-z0-9]{18,}\b)(?=[a-z0-9]*\d)[a-z0-9]{18,})\b/i,
      recommendation: 'Move generated ids/session ids/run ids into dynamic tail.',
    },
  ]
  return checks.flatMap(check => {
    const sample = firstMatch(text, check.pattern)
    return sample
      ? [{
          sectionId: section.id,
          kind: check.kind,
          sample,
          recommendation: check.recommendation,
        }]
      : []
  })
}

export function buildDSXUPromptPrefixCachePlan(input: {
  workflowKind: DSXUPromptCacheWorkflowKind
  stableSections: readonly DSXUPromptPrefixSection[]
  dynamicSections: readonly DSXUDynamicPromptSection[]
}): DSXUPromptPrefixCachePlan {
  const stableSections = orderStableSections(input.stableSections)
  const dynamicSections = [...input.dynamicSections]
  const stablePrefix = stableSections.map(renderSection).join('\n\n')
  const dynamicTail = dynamicSections.map(renderSection).join('\n\n')
  const volatileFindings = stableSections.flatMap(detectVolatileFindings)
  const guards: string[] = []
  const recommendations: string[] = [
    'Keep DSXU static policy/tool/model/output sections before dynamic task state.',
    'Keep current user request, task snapshot, tool results, logs, trace paths, and timestamps after the dynamic boundary.',
  ]

  if (volatileFindings.length > 0) {
    guards.push('stable prefix contains volatile content that can lower DeepSeek KV cache hit rate')
  }
  if (stableSections.length === 0) {
    guards.push('stable prefix has no sections')
  }
  if (dynamicSections.length === 0) {
    recommendations.push('Add a dynamic tail with current request and task snapshot so the stable prefix can stay reusable.')
  }

  const fullPrompt = [stablePrefix, '<dsxu-dynamic-boundary />', dynamicTail].join('\n\n')

  return {
    ok: guards.length === 0,
    status: guards.length === 0 ? 'CACHE_PREFIX_READY' : 'CACHE_PREFIX_NEEDS_CLEANUP',
    workflowKind: input.workflowKind,
    stablePrefix,
    dynamicTail,
    stablePrefixHash: sha256(stablePrefix),
    dynamicTailHash: sha256(dynamicTail),
    fullPromptHash: sha256(fullPrompt),
    stablePrefixChars: stablePrefix.length,
    dynamicTailChars: dynamicTail.length,
    fullPromptChars: fullPrompt.length,
    stablePrefixApproxTokens: approxTokens(stablePrefix),
    dynamicTailApproxTokens: approxTokens(dynamicTail),
    fullPromptApproxTokens: approxTokens(fullPrompt),
    stableSectionOrder: stableSections.map(section => section.id),
    dynamicSectionOrder: dynamicSections.map(section => section.id),
    cacheMissBudgetTokens: CACHE_MISS_BUDGET_BY_WORKFLOW[input.workflowKind],
    volatileFindings,
    guards,
    recommendations,
  }
}
