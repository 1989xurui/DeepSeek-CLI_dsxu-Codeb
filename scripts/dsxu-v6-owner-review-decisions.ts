import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type TruthMatrixRow = {
  path: string
  kind: string
  capability: string
  primaryLabel: string
  defaultMainline?: boolean
  appRuntime?: boolean
  importedBy?: string[]
  referencedByDocs?: string[]
  referencedByScripts?: string[]
  referencedByTests?: string[]
}

type CleanupRow = {
  path: string
  owner: string
  action: string
  exposure: string
  claimAllowed: boolean
  modelPromptAllowed: boolean
}

type OwnerReviewDecision =
  | 'mainline-owner'
  | 'release-only'
  | 'legacy'
  | 'evidence-only'
  | 'delete-review'

type OwnerReviewRow = {
  path: string
  owner: string
  decision: OwnerReviewDecision
  capability: string
  kind: string
  exposure: string
  importedByCount: number
  activeImportCount: number
  docReferenceCount: number
  testReferenceCount: number
  scriptReferenceCount: number
  claimAllowed: false
  modelPromptAllowed: false
  evidence: string[]
  requiredNextAction: string
  reason: string
}

type OwnerReviewReport = {
  schemaVersion: 'dsxu.v6.owner-review-decisions.v1'
  generatedAt: string
  status: 'PASS_V6_OWNER_REVIEW_DECISIONS' | 'BLOCKED_V6_OWNER_REVIEW_DECISIONS'
  sourceMatrixPath: string
  sourceCleanupPath: string
  summary: {
    reviewedUnclassifiedRows: number
    mainlineOwner: number
    releaseOnly: number
    legacy: number
    evidenceOnly: number
    deleteReview: number
    remainingClassifyBeforeClaim: number
    claimAllowedRows: number
    modelPromptAllowedRows: number
  }
  blockers: string[]
  rows: OwnerReviewRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_MATRIX = join(GENERATED_DIR, `DSXU_CAPABILITY_TRUTH_MATRIX_${DATE}.json`)
const DEFAULT_CLEANUP = join(GENERATED_DIR, `DSXU_V6_OWNER_CLEANUP_CHECK_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function bool(value: unknown): boolean {
  return value === true
}

function parseTruthRows(raw: unknown): TruthMatrixRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): TruthMatrixRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      kind: String(row.kind ?? ''),
      capability: String(row.capability ?? ''),
      primaryLabel: String(row.primaryLabel ?? 'unclassified'),
      defaultMainline: bool(row.defaultMainline),
      appRuntime: bool(row.appRuntime),
      importedBy: stringArray(row.importedBy),
      referencedByDocs: stringArray(row.referencedByDocs),
      referencedByScripts: stringArray(row.referencedByScripts),
      referencedByTests: stringArray(row.referencedByTests),
    }
  }).filter(row => row.path.trim())
}

function parseCleanupRows(raw: unknown): CleanupRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): CleanupRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? 'Owner Review Queue'),
      action: String(row.action ?? 'classify-before-claim'),
      exposure: String(row.exposure ?? 'not-exposed'),
      claimAllowed: bool(row.claimAllowed),
      modelPromptAllowed: bool(row.modelPromptAllowed),
    }
  }).filter(row => row.path.trim())
}

function matches(path: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(path))
}

const DELETE_REVIEW_PATTERNS = [
  /^src\/commands\/bridge(?:\/|$)/,
  /^src\/commands\/bridge-kick\.ts$/,
  /^src\/commands\/commit(?:-push-pr)?\.ts$/,
  /^src\/coordinator\/dag\//,
  /^src\/services\/swe-bench\//,
]

const LEGACY_PATTERNS = [
  /^src\/coordinator\/roles\//,
  /^src\/coordinator\/voting\//,
  /^src\/local-work\//,
  /^src\/dsxu\/msa\//,
  /^src\/dsxu\/network\//,
  /^src\/dsxu\/engine\/executor-openhands-adapter\.ts$/,
  /^src\/dsxu\/engine\/dsxu-retirement-plan\.ts$/,
  /^src\/dsxu\/engine\/full-absorb/,
  /^src\/dsxu\/engine\/runtime\/example\.ts$/,
]

const EVIDENCE_ONLY_PATTERNS = [
  /^src\/dsxu\/integration\/harness\//,
  /^src\/dsxu\/engine\/.*-contract\.ts$/,
  /^src\/services\/pbt\//,
]

const RELEASE_ONLY_PATTERNS = [
  /^README\.md$/,
  /^package\.json$/,
  /^bunfig\.toml$/,
  /^tsconfig\.json$/,
  /^src\/utils\/vendor\/ripgrep\//,
  /^src\/server\/types\.ts$/,
  /^src\/native-ts\//,
]

function activeImport(importPath: string): boolean {
  const normalized = importPath.replace(/\\/g, '/')
  if (!normalized.startsWith('src/')) return false
  if (normalized.includes('/__tests__/')) return false
  if (/\.test\.[tj]sx?$/.test(normalized)) return false
  if (normalized.startsWith('src/dsxu/integration/harness/')) return false
  if (normalized.startsWith('src/coordinator/dag/')) return false
  if (normalized.startsWith('src/coordinator/voting/')) return false
  return true
}

function evidenceFor(row: TruthMatrixRow, activeImports: string[]): string[] {
  const evidence = [
    `importedBy=${row.importedBy?.length ?? 0}`,
    `activeImports=${activeImports.length}`,
    `docRefs=${row.referencedByDocs?.length ?? 0}`,
    `testRefs=${row.referencedByTests?.length ?? 0}`,
    `scriptRefs=${row.referencedByScripts?.length ?? 0}`,
  ]
  for (const source of activeImports.slice(0, 3)) {
    evidence.push(`activeImport:${source}`)
  }
  for (const source of (row.referencedByDocs ?? []).slice(0, 2)) {
    evidence.push(`docRef:${source}`)
  }
  return evidence
}

function decisionFor(row: TruthMatrixRow, cleanup: CleanupRow, activeImports: string[]): OwnerReviewDecision {
  const path = row.path
  if (matches(path, DELETE_REVIEW_PATTERNS)) return 'delete-review'
  if (matches(path, LEGACY_PATTERNS)) return 'legacy'
  if (matches(path, RELEASE_ONLY_PATTERNS)) return 'release-only'
  if (matches(path, EVIDENCE_ONLY_PATTERNS)) return 'evidence-only'
  if (cleanup.action === 'keep-release-surface') return 'release-only'
  if (path === 'src/commands/clear/caches.ts') return 'mainline-owner'
  if (path.startsWith('src/components/ManagedSettingsSecurityDialog/')) return 'mainline-owner'
  if (activeImports.length > 0) return 'mainline-owner'
  if (path.startsWith('src/dsxu/engine/') && (row.referencedByTests?.length ?? 0) > 0) return 'evidence-only'
  if (path.startsWith('src/services/health/')) return 'release-only'
  if (path.startsWith('src/services/')) return activeImports.length > 0 ? 'mainline-owner' : 'evidence-only'
  if (path.startsWith('src/utils/search/')) return activeImports.length > 0 ? 'mainline-owner' : 'evidence-only'
  return (row.referencedByDocs?.length ?? 0) > 0 ? 'evidence-only' : 'legacy'
}

function ownerFor(row: TruthMatrixRow, cleanup: CleanupRow, decision: OwnerReviewDecision): string {
  if (decision === 'delete-review') {
    if (row.path.startsWith('src/coordinator/dag/')) return 'PlanGraph / Work-State Owner'
    if (row.path.startsWith('src/services/swe-bench/')) return 'Evidence / Eval SWE Owner'
    return cleanup.owner
  }
  if (row.path.startsWith('src/dsxu/control-plane/')) return 'Control Plane / Operator State Owner'
  if (row.path.startsWith('src/coordinator/voting/')) return 'Frozen Agent Evidence Owner'
  if (row.path.startsWith('src/coordinator/roles/')) return 'Frozen Agent Role Evidence Owner'
  if (row.path.startsWith('src/services/mcp/')) return 'MCP / Skill Registry Owner'
  if (row.path.startsWith('src/services/health/')) return 'Doctor / Release Preflight Owner'
  if (row.path.startsWith('src/services/static-analysis/')) return 'VerificationKernel / Static Analysis Owner'
  if (row.path.startsWith('src/services/sandbox/')) return 'Sandbox / Permission Boundary Owner'
  if (row.path.startsWith('src/services/embedding/') || row.path.startsWith('src/utils/search/')) {
    return 'Source Truth / Search Owner'
  }
  if (row.path.startsWith('src/services/experience/')) return 'Experience Evidence Owner'
  return cleanup.owner
}

function requiredAction(decision: OwnerReviewDecision): string {
  switch (decision) {
    case 'mainline-owner':
      return 'Keep under named DSXU owner; bind future claims to source/test/live evidence before release.'
    case 'release-only':
      return 'Keep as release/config/documentation surface; do not expose to model prompt or product capability claim.'
    case 'legacy':
      return 'Keep frozen outside default runtime; require explicit owner review before any default exposure.'
    case 'evidence-only':
      return 'Keep only as harness/test/evidence source; cannot become a product runtime or GitHub claim.'
    case 'delete-review':
      return 'Enter owner/Git mutation review; delete only after replacement evidence and explicit approval.'
  }
}

function reasonFor(row: TruthMatrixRow, decision: OwnerReviewDecision, activeImports: string[]): string {
  if (decision === 'delete-review') {
    return 'Equivalent or retired behavior is already owned elsewhere; this path must not remain as a second runtime/entrypoint without owner/Git approval.'
  }
  if (decision === 'mainline-owner') {
    return activeImports.length > 0
      ? 'Real src import/use evidence points to a DSXU owner; keep the behavior in that owner, but block public claims until acceptance evidence exists.'
      : 'This path is a DSXU command/safety projection with owner semantics; keep it out of public claims until acceptance evidence closes.'
  }
  if (decision === 'release-only') {
    return 'This is a release/config/documentation surface, not a runtime capability claim.'
  }
  if (decision === 'legacy') {
    return 'This is retained as frozen legacy/research boundary and must not enter default runtime or product prompt.'
  }
  return 'This path is only supported by test, harness, or documentation evidence; keep it as evidence and block product claims.'
}

function reviewRow(row: TruthMatrixRow, cleanup: CleanupRow): OwnerReviewRow {
  const activeImports = (row.importedBy ?? []).filter(activeImport)
  const decision = decisionFor(row, cleanup, activeImports)
  const owner = ownerFor(row, cleanup, decision)
  return {
    path: row.path,
    owner,
    decision,
    capability: row.capability,
    kind: row.kind,
    exposure: cleanup.exposure,
    importedByCount: row.importedBy?.length ?? 0,
    activeImportCount: activeImports.length,
    docReferenceCount: row.referencedByDocs?.length ?? 0,
    testReferenceCount: row.referencedByTests?.length ?? 0,
    scriptReferenceCount: row.referencedByScripts?.length ?? 0,
    claimAllowed: false,
    modelPromptAllowed: false,
    evidence: evidenceFor(row, activeImports),
    requiredNextAction: requiredAction(decision),
    reason: reasonFor(row, decision, activeImports),
  }
}

function count(rows: OwnerReviewRow[], decision: OwnerReviewDecision): number {
  return rows.filter(row => row.decision === decision).length
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function renderCsv(rows: OwnerReviewRow[]): string {
  const headers: Array<keyof OwnerReviewRow> = [
    'path',
    'owner',
    'decision',
    'capability',
    'kind',
    'exposure',
    'importedByCount',
    'activeImportCount',
    'docReferenceCount',
    'testReferenceCount',
    'scriptReferenceCount',
    'claimAllowed',
    'modelPromptAllowed',
    'requiredNextAction',
    'reason',
    'evidence',
  ]
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
    '',
  ].join('\n')
}

function decisionSummary(rows: OwnerReviewRow[]): string {
  const decisions: OwnerReviewDecision[] = [
    'mainline-owner',
    'release-only',
    'legacy',
    'evidence-only',
    'delete-review',
  ]
  return [
    '| decision | count | meaning |',
    '|---|---:|---|',
    ...decisions.map(decision => `| ${decision} | ${count(rows, decision)} | ${requiredAction(decision)} |`),
  ].join('\n')
}

function sampleRows(rows: OwnerReviewRow[]): string {
  return [
    '| path | owner | decision | activeImports | docs | nextAction |',
    '|---|---|---|---:|---:|---|',
    ...rows.slice(0, 80).map(row =>
      `| \`${row.path}\` | ${row.owner} | ${row.decision} | ${row.activeImportCount} | ${row.docReferenceCount} | ${row.requiredNextAction} |`,
    ),
  ].join('\n')
}

function renderMarkdown(report: OwnerReviewReport): string {
  return `# DSXU V6 Owner Review Decisions - ${DATE}

- status: \`${report.status}\`

This report closes the V6 \`classify-before-claim\` board into explicit owner review decisions. It does not move files, delete files, stage changes, or promote any row into a public product claim.

## Summary

| metric | value |
|---|---:|
| reviewedUnclassifiedRows | ${report.summary.reviewedUnclassifiedRows} |
| mainlineOwner | ${report.summary.mainlineOwner} |
| releaseOnly | ${report.summary.releaseOnly} |
| legacy | ${report.summary.legacy} |
| evidenceOnly | ${report.summary.evidenceOnly} |
| deleteReview | ${report.summary.deleteReview} |
| remainingClassifyBeforeClaim | ${report.summary.remainingClassifyBeforeClaim} |
| claimAllowedRows | ${report.summary.claimAllowedRows} |
| modelPromptAllowedRows | ${report.summary.modelPromptAllowedRows} |

## Decision Rules

${decisionSummary(report.rows)}

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 80 Reviewed Rows

${sampleRows(report.rows)}
`
}

export async function buildV6OwnerReviewDecisions(input: {
  matrixPath?: string
  cleanupPath?: string
  generatedAt?: string
} = {}): Promise<OwnerReviewReport> {
  const matrixPath = resolve(input.matrixPath ?? DEFAULT_MATRIX)
  const cleanupPath = resolve(input.cleanupPath ?? DEFAULT_CLEANUP)
  if (!existsSync(matrixPath)) throw new Error(`missing truth matrix: ${matrixPath}`)
  if (!existsSync(cleanupPath)) throw new Error(`missing cleanup report: ${cleanupPath}`)

  const truthRows = parseTruthRows(JSON.parse(await readFile(matrixPath, 'utf8')) as unknown)
  const cleanupRows = parseCleanupRows(JSON.parse(await readFile(cleanupPath, 'utf8')) as unknown)
  const cleanupByPath = new Map(cleanupRows.map(row => [row.path, row]))
  const rows = truthRows
    .filter(row => row.primaryLabel === 'unclassified')
    .map(row => reviewRow(row, cleanupByPath.get(row.path) ?? {
      path: row.path,
      owner: 'Owner Review Queue',
      action: 'classify-before-claim',
      exposure: 'not-exposed',
      claimAllowed: false,
      modelPromptAllowed: false,
    }))
    .sort((left, right) => {
      const priority: Record<OwnerReviewDecision, number> = {
        'delete-review': 0,
        'legacy': 1,
        'mainline-owner': 2,
        'release-only': 3,
        'evidence-only': 4,
      }
      return priority[left.decision] - priority[right.decision] || left.path.localeCompare(right.path)
    })

  const blockers: string[] = []
  if (rows.some(row => row.claimAllowed || row.modelPromptAllowed)) {
    blockers.push('owner review rows must not allow public claims or model prompt exposure')
  }
  const reviewedPaths = new Set(rows.map(row => row.path))
  const missingCleanupRows = truthRows
    .filter(row => row.primaryLabel === 'unclassified')
    .filter(row => !cleanupByPath.has(row.path))
  if (missingCleanupRows.length > 0) {
    blockers.push(`unclassified rows missing cleanup owner/action: ${missingCleanupRows.length}`)
  }
  if (reviewedPaths.size !== rows.length) {
    blockers.push('duplicate owner review rows detected')
  }

  return {
    schemaVersion: 'dsxu.v6.owner-review-decisions.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_V6_OWNER_REVIEW_DECISIONS'
      : 'BLOCKED_V6_OWNER_REVIEW_DECISIONS',
    sourceMatrixPath: rel(matrixPath),
    sourceCleanupPath: rel(cleanupPath),
    summary: {
      reviewedUnclassifiedRows: rows.length,
      mainlineOwner: count(rows, 'mainline-owner'),
      releaseOnly: count(rows, 'release-only'),
      legacy: count(rows, 'legacy'),
      evidenceOnly: count(rows, 'evidence-only'),
      deleteReview: count(rows, 'delete-review'),
      remainingClassifyBeforeClaim: 0,
      claimAllowedRows: rows.filter(row => row.claimAllowed).length,
      modelPromptAllowedRows: rows.filter(row => row.modelPromptAllowed).length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildV6OwnerReviewDecisions()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_CSV, renderCsv(report.rows), 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    summary: report.summary,
    blockers: report.blockers,
    outputs: {
      json: rel(OUT_JSON),
      csv: rel(OUT_CSV),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
