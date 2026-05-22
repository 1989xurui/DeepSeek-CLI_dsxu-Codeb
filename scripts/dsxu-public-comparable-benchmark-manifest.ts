import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getBenchmarkCasesForProductDataPack,
  getBenchmarkRouteExpectation,
  type BenchmarkCase,
} from './benchmark/dsxu-mainline-benchmark'

type RequiredRawField = {
  field: string
  requiredFor: 'dsxu-run' | 'raw-api-baseline' | 'external-target-reference' | 'all'
  reason: string
}

type PublicComparableBenchmarkManifestCase = {
  id: string
  category: BenchmarkCase['category']
  promptHash: string
  prompt: string
  expectedModel: string
  workflowKind: string
  routeReason: string
  allowedTools: string
  maxTurns: number | null
  budgets: {
    maxToolCalls: number | null
    maxReadCalls: number | null
    maxPowerShellCalls: number | null
    requirePreEditBaselineVerification: boolean
  }
  requiredRawEvidence: readonly RequiredRawField[]
  scoringRubric: {
    passCriteria: readonly string[]
    failCriteria: readonly string[]
  }
  claimBoundary: {
    allowed: string
    blocked: readonly string[]
  }
}

type PublicComparableBenchmarkManifest = {
  schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1'
  generatedAt: string
  status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY'
  caseCount: number
  categoryCounts: Record<string, number>
  modelRouteCounts: Record<string, number>
  rawEvidenceFields: readonly RequiredRawField[]
  cases: readonly PublicComparableBenchmarkManifestCase[]
  runPolicy: {
    defaultModel: 'deepseek-v4-flash'
    proAdmissionPolicy: string
    publicClaimPolicy: string
    targetReferencePolicy: string
  }
  dataStillNeeded: readonly string[]
}

const ROOT = process.cwd()
const DATE = '20260518'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.md`)

const PRIORITY_CASE_IDS = [
  'permission-deny-replan',
  'powershell-encoded-deny',
  'grep-glob-tool-choice',
  'governance-query-recovery-live',
  'governance-skills-selection-live',
  'todo-task-closeout',
  'permission-matrix-contract',
  'compact-state-preservation',
  'product-workflow-recovery-live',
  'product-multifile-bugfix-live',
  'product-multistep-feature-live',
  'product-feature-tests-live',
  'product-review-fix-live',
  'product-compact-resume-edit-live',
  'product-compact-two-phase-live',
  'product-permission-deny-replan-live',
  'product-agent-worker-longrun-live',
  'product-agent-failure-correction-live',
  'product-real-mcp-task-live',
  'product-reality-large-feature-live',
  'product-reality-review-fix-live',
  'product-reality-second-failure-live',
  'product-reality-workflow-fallback-live',
  'product-review-to-fix-live',
  'product-second-failure-recovery-live',
  'v8-real-review-fix',
  'experience-query-loop-programmer-recovery-live',
  'mutation-query-partial-tool-result-repair-live',
  'query-partial-tool-result-live',
  'mutation-query-orphan-tool-use-deny-pass-live',
] as const

const CATEGORY_QUOTAS: Record<BenchmarkCase['category'], number> = {
  bugfix: 4,
  feature: 6,
  review: 5,
  recovery: 6,
  permission: 5,
  agent: 4,
}

const RAW_EVIDENCE_FIELDS: readonly RequiredRawField[] = [
  { field: 'rawTranscriptPath', requiredFor: 'all', reason: 'auditable model/tool conversation, including failures' },
  { field: 'toolTracePath', requiredFor: 'dsxu-run', reason: 'DSXU tool and permission evidence' },
  { field: 'rawApiResponsePath', requiredFor: 'raw-api-baseline', reason: 'same-task raw DeepSeek API baseline response' },
  { field: 'targetReferenceTranscriptPath', requiredFor: 'external-target-reference', reason: 'paired external target/reference comparison only' },
  { field: 'finalReportPath', requiredFor: 'all', reason: 'final claim must point to a task report' },
  { field: 'artifactDir', requiredFor: 'all', reason: 'patches, stdout/stderr, screenshots, and generated outputs' },
  { field: 'firstAttemptPass', requiredFor: 'all', reason: 'GitHub data chart: first-attempt success rate' },
  { field: 'secondAttemptPass', requiredFor: 'all', reason: 'GitHub data chart: recovery after one failure' },
  { field: 'finalPass', requiredFor: 'all', reason: 'final task pass rate' },
  { field: 'costUsd', requiredFor: 'all', reason: 'DeepSeek cost transparency' },
  { field: 'wallClockMs', requiredFor: 'all', reason: 'operator time cost' },
  { field: 'cacheHitRatePct', requiredFor: 'all', reason: 'DeepSeek cache behavior, trend only' },
  { field: 'proAdmissionCount', requiredFor: 'all', reason: 'Flash-first policy proof' },
  { field: 'failureRecoveryEvents', requiredFor: 'all', reason: 'failure-to-fix evidence, not hidden failure' },
  { field: 'unavailableToolUseCount', requiredFor: 'dsxu-run', reason: 'forbidden or unavailable tool discipline evidence' },
  { field: 'executionVisibilityBlockedCount', requiredFor: 'dsxu-run', reason: 'visible-intent/tool-batch gate evidence' },
  { field: 'noToolUnsupportedClaimCount', requiredFor: 'dsxu-run', reason: 'zero-tool lane hallucinated workspace/source claim guard' },
  { field: 'toolBudgetExceededCount', requiredFor: 'dsxu-run', reason: 'tool-window budget discipline evidence' },
  { field: 'readBudgetExceededCount', requiredFor: 'dsxu-run', reason: 'read-budget discipline evidence' },
  { field: 'shellBudgetExceededCount', requiredFor: 'dsxu-run', reason: 'shell-budget discipline evidence' },
  { field: 'toolResultChars', requiredFor: 'dsxu-run', reason: 'tool-result bloat control' },
  { field: 'artifactLogSizeBytes', requiredFor: 'all', reason: 'release artifact/log size visibility' },
]

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function selectCases(allCases: readonly BenchmarkCase[]): readonly BenchmarkCase[] {
  const byId = new Map(allCases.map(item => [item.id, item]))
  const selected: BenchmarkCase[] = []
  const seen = new Set<string>()
  const selectedByCategory: Record<BenchmarkCase['category'], number> = {
    bugfix: 0,
    feature: 0,
    review: 0,
    recovery: 0,
    permission: 0,
    agent: 0,
  }
  const maybeAdd = (item: BenchmarkCase, enforceQuota: boolean): boolean => {
    if (seen.has(item.id)) return false
    if (enforceQuota && selectedByCategory[item.category] >= CATEGORY_QUOTAS[item.category]) return false
    selected.push(item)
    seen.add(item.id)
    selectedByCategory[item.category] += 1
    return true
  }
  for (const id of PRIORITY_CASE_IDS) {
    const item = byId.get(id)
    if (!item) continue
    maybeAdd(item, true)
  }
  for (const category of ['bugfix', 'feature', 'review', 'recovery', 'permission', 'agent'] as const) {
    for (const item of allCases.filter(candidate => candidate.category === category)) {
      if (selected.length >= 30) return selected
      maybeAdd(item, true)
    }
  }
  for (const item of allCases) {
    if (selected.length >= 30) return selected
    maybeAdd(item, false)
  }
  const missingQuota = Object.entries(CATEGORY_QUOTAS).filter(
    ([category, quota]) => selectedByCategory[category as BenchmarkCase['category']] < quota,
  )
  if (missingQuota.length > 0) {
    throw new Error(`public comparable manifest cannot satisfy category quotas: ${JSON.stringify(missingQuota)}`)
  }
  return selected.slice(0, 30)
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function buildManifestCase(item: BenchmarkCase): PublicComparableBenchmarkManifestCase {
  const route = getBenchmarkRouteExpectation(item)
  return {
    id: item.id,
    category: item.category,
    promptHash: sha256(item.prompt),
    prompt: item.prompt,
    expectedModel: route.expectedModel,
    workflowKind: route.workflowKind,
    routeReason: route.routeReason,
    allowedTools: item.allowedTools ?? 'default-mainline-tool-gate',
    maxTurns: item.maxTurns ?? null,
    budgets: {
      maxToolCalls: item.maxToolCalls ?? null,
      maxReadCalls: item.maxReadCalls ?? null,
      maxPowerShellCalls: item.maxPowerShellCalls ?? null,
      requirePreEditBaselineVerification: item.requirePreEditBaselineVerification === true,
    },
    requiredRawEvidence: RAW_EVIDENCE_FIELDS,
    scoringRubric: {
      passCriteria: [
        'task-specific success marker or test passes',
        'source/test/tool evidence exists',
        'cost/cache/model route metrics are recorded',
        'failure is either repaired with evidence or honestly classified as final partial/fail',
      ],
      failCriteria: [
        'missing raw transcript or final report',
        'template/generic output substituted for task evidence',
        'target-only or DSXU-only log used as paired external comparison',
        'public 90/95, official benchmark, or external superiority claim without same-task raw evidence',
      ],
    },
    claimBoundary: {
      allowed: 'internal comparable DSXU vs raw DeepSeek API evidence when both raw lanes exist for this exact task',
      blocked: [
        'official SWE-bench or external leaderboard claim',
        'model-level superiority claim',
        'reference-product parity claim',
        'public 90/95 claim without score rubric and fixed raw evidence pack',
      ],
    },
  }
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toCsv(cases: readonly PublicComparableBenchmarkManifestCase[]): string {
  const headers = [
    'id',
    'category',
    'expectedModel',
    'workflowKind',
    'routeReason',
    'allowedTools',
    'maxTurns',
    'requirePreEditBaselineVerification',
    'promptHash',
  ]
  return [
    headers.map(csvEscape).join(','),
    ...cases.map(item => headers.map(header => {
      if (header === 'requirePreEditBaselineVerification') {
        return csvEscape(item.budgets.requirePreEditBaselineVerification)
      }
      return csvEscape((item as unknown as Record<string, unknown>)[header])
    }).join(',')),
  ].join('\n') + '\n'
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const escape = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
  return [
    `| ${columns.join(' |')} |`,
    `| ${columns.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${columns.map(column => escape(row[column])).join(' |')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const allCases = getBenchmarkCasesForProductDataPack()
  const selected = selectCases(allCases).map(buildManifestCase)
  if (selected.length < 30) {
    throw new Error(`public comparable benchmark manifest requires 30 fixed cases, got ${selected.length}`)
  }
  const manifest: PublicComparableBenchmarkManifest = {
    schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
    generatedAt: new Date().toISOString(),
    status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
    caseCount: selected.length,
    categoryCounts: countBy(selected.map(item => item.category)),
    modelRouteCounts: countBy(selected.map(item => item.expectedModel)),
    rawEvidenceFields: RAW_EVIDENCE_FIELDS,
    cases: selected,
    runPolicy: {
      defaultModel: 'deepseek-v4-flash',
      proAdmissionPolicy: 'Pro is allowed only when route/admission evidence says Flash cannot safely finish the current case.',
      publicClaimPolicy: 'This manifest enables comparable evidence collection. It is not a public leaderboard result.',
      targetReferencePolicy: 'External superiority claims require same-task target/reference raw transcript, tool trace, final report, artifacts, metrics, and risk notes.',
    },
    dataStillNeeded: [
      'DSXU raw run transcript for each case',
      'raw DeepSeek API baseline transcript for each case',
      'optional external target/reference raw manifest for external comparison claims',
      'per-case firstAttemptPass, secondAttemptPass, finalPass, costUsd, wallClockMs, cacheHitRatePct, proAdmissionCount, failureRecoveryEvents, tool discipline counts, budget overrun counts, toolResultChars, artifactLogSizeBytes',
      'aggregate charts for first/second/final pass, cost, wall-clock, cache, Pro admissions, and recovery rate',
    ],
  }
  const md = [
    '# DSXU Public Comparable Benchmark Manifest - 2026-05-18',
    '',
    `Status: ${manifest.status}`,
    '',
    'This is a fixed comparable manifest, not a benchmark result. It defines the task set, raw evidence fields, scoring rubric, and claim boundaries required before GitHub can show public comparison charts.',
    '',
    '## Run Policy',
    '',
    `- Default model: ${manifest.runPolicy.defaultModel}`,
    `- Pro admission: ${manifest.runPolicy.proAdmissionPolicy}`,
    `- Public claim: ${manifest.runPolicy.publicClaimPolicy}`,
    `- Target/reference: ${manifest.runPolicy.targetReferencePolicy}`,
    '',
    '## Counts',
    '',
    markdownTable([
      { metric: 'cases', value: manifest.caseCount },
      ...Object.entries(manifest.categoryCounts).map(([metric, value]) => ({ metric: `category:${metric}`, value })),
      ...Object.entries(manifest.modelRouteCounts).map(([metric, value]) => ({ metric: `model:${metric}`, value })),
    ], ['metric', 'value']),
    '',
    '## Required Raw Evidence Fields',
    '',
    markdownTable(manifest.rawEvidenceFields as readonly unknown[] as readonly Record<string, unknown>[], ['field', 'requiredFor', 'reason']),
    '',
    '## Cases',
    '',
    markdownTable(manifest.cases.map(item => ({
      id: item.id,
      category: item.category,
      expectedModel: item.expectedModel,
      workflowKind: item.workflowKind,
      routeReason: item.routeReason,
      allowedTools: item.allowedTools,
      promptHash: item.promptHash.slice(0, 16),
    })), ['id', 'category', 'expectedModel', 'workflowKind', 'routeReason', 'allowedTools', 'promptHash']),
    '',
    '## Data Still Needed',
    '',
    ...manifest.dataStillNeeded.map(item => `- ${item}`),
    '',
  ].join('\n')
  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(manifest, null, 2) + '\n'),
    writeFile(OUT_CSV, toCsv(manifest.cases)),
    writeFile(OUT_MD, md, 'utf8'),
  ])
  console.log(JSON.stringify({
    status: manifest.status,
    caseCount: manifest.caseCount,
    categoryCounts: manifest.categoryCounts,
    modelRouteCounts: manifest.modelRouteCounts,
    outputJson: OUT_JSON,
    outputCsv: OUT_CSV,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
