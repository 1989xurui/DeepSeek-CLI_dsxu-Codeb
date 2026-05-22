import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type TruthMatrixRow = {
  path: string
  kind: string
  capability: string
  primaryLabel: string
  labels?: string[]
  defaultMainline?: boolean
  appRuntime?: boolean
  cliScript?: boolean
  testContract?: boolean
  docEvidence?: boolean
  experiment?: boolean
  frozen?: boolean
  historicalResidue?: boolean
  importedBy?: string[]
  referencedByScripts?: string[]
  referencedByTests?: string[]
  referencedByDocs?: string[]
  reasons?: string[]
}

type OwnerAction =
  | 'keep-mainline-owner'
  | 'keep-release-surface'
  | 'keep-evidence-only'
  | 'freeze-experiment'
  | 'freeze-release-governance'
  | 'archive-or-owner-review'
  | 'classify-before-claim'

type CleanupRow = {
  path: string
  primaryLabel: string
  capability: string
  kind: string
  owner: string
  action: OwnerAction
  defaultMainline: boolean
  exposure: 'default-mainline' | 'app-runtime' | 'script-evidence' | 'test-only' | 'doc-only' | 'not-exposed'
  claimAllowed: boolean
  modelPromptAllowed: boolean
  reason: string
}

type CleanupReport = {
  schemaVersion: 'dsxu.v6.owner-cleanup-check.v1'
  generatedAt: string
  owner: 'V6 Truth Matrix Gate / Owner Cleanup'
  status: 'PASS_V6_OWNER_CLEANUP_CHECK' | 'BLOCKED_V6_OWNER_CLEANUP_CHECK'
  sourceMatrixPath: string
  summary: {
    reviewedRows: number
    unclassifiedRows: number
    unclassifiedWithOwnerAction: number
    experimentRows: number
    experimentDefaultExposureViolations: number
    frozenRows: number
    frozenDefaultExposureViolations: number
    historicalResidueRows: number
    historicalDefaultExposureViolations: number
    claimBlockedRows: number
  }
  blockers: string[]
  rows: CleanupRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_MATRIX = join(GENERATED_DIR, `DSXU_CAPABILITY_TRUTH_MATRIX_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_OWNER_CLEANUP_CHECK_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V6_OWNER_CLEANUP_CHECK_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_OWNER_CLEANUP_CHECK_${DATE}.md`)

function rel(path: string, root = ROOT): string {
  return relative(root, path).replace(/\\/g, '/')
}

function arrayFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function bool(value: unknown): boolean {
  return value === true
}

function parseRows(raw: unknown): TruthMatrixRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): TruthMatrixRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      kind: String(row.kind ?? ''),
      capability: String(row.capability ?? ''),
      primaryLabel: String(row.primaryLabel ?? 'unclassified'),
      labels: arrayFrom(row.labels),
      defaultMainline: bool(row.defaultMainline),
      appRuntime: bool(row.appRuntime),
      cliScript: bool(row.cliScript),
      testContract: bool(row.testContract),
      docEvidence: bool(row.docEvidence),
      experiment: bool(row.experiment),
      frozen: bool(row.frozen),
      historicalResidue: bool(row.historicalResidue),
      importedBy: arrayFrom(row.importedBy),
      referencedByScripts: arrayFrom(row.referencedByScripts),
      referencedByTests: arrayFrom(row.referencedByTests),
      referencedByDocs: arrayFrom(row.referencedByDocs),
      reasons: arrayFrom(row.reasons),
    }
  }).filter(row => row.path.trim())
}

function ownerFor(row: TruthMatrixRow): string {
  const path = row.path.toLowerCase()
  if (path === 'readme.md' || path.startsWith('docs/') || /changelog|license|contributing|security|install|runbook/.test(path)) {
    return 'Docs / Release Claim Binder'
  }
  if (path === 'package.json' || path.endsWith('.toml') || path.endsWith('.json') || path.endsWith('.yml') || path.endsWith('.yaml')) {
    return 'Runtime Config / Release Surface'
  }
  if (path.startsWith('scripts/')) return 'Evidence / Script Command Catalog'
  if (path.includes('/__tests__/') || /\.test\./.test(path)) return 'Test Contract / VerificationKernel'
  if (path.startsWith('src/tools/') || row.capability === 'tool-system') return 'Tool Gate / Tool View'
  if (path.startsWith('src/services/api/') || row.capability === 'provider-model-cost-cache') return 'DeepSeek Provider / Cost Cache'
  if (path.startsWith('src/components/') || row.capability === 'tui-visible-state') return 'TUI Trust Surface'
  if (path.startsWith('src/dsxu/engine/') || row.capability === 'query-loop-default-runtime') return 'Query Loop / Execution Contract'
  if (path.startsWith('src/services/') || path.startsWith('src/commands/')) return 'Runtime Service Owner'
  return 'Owner Review Queue'
}

function exposureFor(row: TruthMatrixRow): CleanupRow['exposure'] {
  if (row.defaultMainline) return 'default-mainline'
  if (row.appRuntime) return 'app-runtime'
  if (row.cliScript || (row.referencedByScripts?.length ?? 0) > 0) return 'script-evidence'
  if (row.testContract || (row.referencedByTests?.length ?? 0) > 0) return 'test-only'
  if (row.docEvidence || (row.referencedByDocs?.length ?? 0) > 0) return 'doc-only'
  return 'not-exposed'
}

function actionFor(row: TruthMatrixRow, owner: string): OwnerAction {
  if (row.primaryLabel === 'default-mainline') return 'keep-mainline-owner'
  if (row.frozen) return 'freeze-release-governance'
  if (row.experiment) return 'freeze-experiment'
  if (row.historicalResidue) return 'archive-or-owner-review'
  if (owner === 'Docs / Release Claim Binder' || owner === 'Runtime Config / Release Surface') return 'keep-release-surface'
  if (row.cliScript || row.testContract || row.docEvidence) return 'keep-evidence-only'
  return 'classify-before-claim'
}

function reasonFor(row: TruthMatrixRow, owner: string, action: OwnerAction): string {
  if (row.primaryLabel === 'unclassified') {
    return `V6 Phase 0 assigns ${owner}; action=${action}; cannot be used as product capability claim until owner review closes.`
  }
  if (row.experiment || row.frozen || row.historicalResidue) {
    return `V6 keeps this outside the default model prompt/tool view unless an explicit owner, switch, and acceptance evidence exist.`
  }
  return `No V6 cleanup action required beyond keeping the existing owner classification.`
}

function cleanupRow(row: TruthMatrixRow): CleanupRow {
  const owner = ownerFor(row)
  const action = actionFor(row, owner)
  const exposure = exposureFor(row)
  const claimAllowed =
    row.primaryLabel === 'default-mainline' &&
    !row.experiment &&
    !row.frozen &&
    !row.historicalResidue
  const modelPromptAllowed =
    row.primaryLabel === 'default-mainline' &&
    !row.experiment &&
    !row.frozen &&
    !row.historicalResidue
  return {
    path: row.path,
    primaryLabel: row.primaryLabel,
    capability: row.capability,
    kind: row.kind,
    owner,
    action,
    defaultMainline: Boolean(row.defaultMainline),
    exposure,
    claimAllowed,
    modelPromptAllowed,
    reason: reasonFor(row, owner, action),
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function renderCsv(rows: CleanupRow[]): string {
  const headers: Array<keyof CleanupRow> = [
    'path',
    'primaryLabel',
    'capability',
    'kind',
    'owner',
    'action',
    'defaultMainline',
    'exposure',
    'claimAllowed',
    'modelPromptAllowed',
    'reason',
  ]
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
    '',
  ].join('\n')
}

function markdownTable(rows: CleanupRow[]): string {
  const sample = rows.slice(0, 40)
  return [
    '| path | label | owner | action | exposure | claimAllowed |',
    '|---|---|---|---|---|---|',
    ...sample.map(row => `| \`${row.path}\` | ${row.primaryLabel} | ${row.owner} | ${row.action} | ${row.exposure} | ${row.claimAllowed} |`),
  ].join('\n')
}

function renderMarkdown(report: CleanupReport): string {
  return `# DSXU V6 Owner Cleanup Check - ${DATE}

- status: \`${report.status}\`

This report performs V6 Phase 0 owner/action assignment only. It does not move files, delete files, stage changes, or promote internal evidence into public product claims.

## Summary

| metric | value |
|---|---:|
| reviewedRows | ${report.summary.reviewedRows} |
| unclassifiedRows | ${report.summary.unclassifiedRows} |
| unclassifiedWithOwnerAction | ${report.summary.unclassifiedWithOwnerAction} |
| experimentRows | ${report.summary.experimentRows} |
| experimentDefaultExposureViolations | ${report.summary.experimentDefaultExposureViolations} |
| frozenRows | ${report.summary.frozenRows} |
| frozenDefaultExposureViolations | ${report.summary.frozenDefaultExposureViolations} |
| historicalResidueRows | ${report.summary.historicalResidueRows} |
| historicalDefaultExposureViolations | ${report.summary.historicalDefaultExposureViolations} |
| claimBlockedRows | ${report.summary.claimBlockedRows} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 40 Action Rows

${markdownTable(report.rows)}
`
}

export async function buildV6OwnerCleanupCheck(input: {
  matrixPath?: string
  generatedAt?: string
} = {}): Promise<CleanupReport> {
  const matrixPath = resolve(input.matrixPath ?? DEFAULT_MATRIX)
  if (!existsSync(matrixPath)) {
    throw new Error(`missing truth matrix: ${matrixPath}`)
  }
  const raw = JSON.parse(await readFile(matrixPath, 'utf8')) as unknown
  const truthRows = parseRows(raw)
  const rows = truthRows
    .filter(row =>
      row.primaryLabel === 'unclassified' ||
      row.experiment ||
      row.frozen ||
      row.historicalResidue,
    )
    .map(cleanupRow)
    .sort((left, right) => {
      const priority = (row: CleanupRow): number =>
        row.primaryLabel === 'unclassified' ? 0 :
          row.defaultMainline ? 1 :
            row.exposure === 'app-runtime' ? 2 :
              row.exposure === 'script-evidence' ? 3 : 4
      return priority(left) - priority(right) || left.path.localeCompare(right.path)
    })

  const unclassifiedRows = rows.filter(row => row.primaryLabel === 'unclassified')
  const experimentRows = rows.filter(row => row.primaryLabel === 'experiment' || /experiment/.test(row.action))
  const frozenRows = rows.filter(row => row.primaryLabel === 'frozen' || /freeze/.test(row.action))
  const historicalRows = rows.filter(row => row.primaryLabel === 'historical-residue' || row.action === 'archive-or-owner-review')
  const experimentDefaultExposureViolations = rows.filter(row =>
    row.defaultMainline && (row.action === 'freeze-experiment'),
  ).length
  const frozenDefaultExposureViolations = rows.filter(row =>
    row.defaultMainline && row.action === 'freeze-release-governance',
  ).length
  const historicalDefaultExposureViolations = rows.filter(row =>
    row.defaultMainline && row.action === 'archive-or-owner-review',
  ).length
  const blockers: string[] = []
  if (unclassifiedRows.some(row => !row.owner || !row.action)) {
    blockers.push('unclassified rows without owner/action assignment')
  }
  if (experimentDefaultExposureViolations > 0) {
    blockers.push(`experiment rows exposed to default mainline: ${experimentDefaultExposureViolations}`)
  }
  if (frozenDefaultExposureViolations > 0) {
    blockers.push(`frozen rows exposed to default mainline: ${frozenDefaultExposureViolations}`)
  }
  if (historicalDefaultExposureViolations > 0) {
    blockers.push(`historical residue rows exposed to default mainline: ${historicalDefaultExposureViolations}`)
  }

  return {
    schemaVersion: 'dsxu.v6.owner-cleanup-check.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    owner: 'V6 Truth Matrix Gate / Owner Cleanup',
    status: blockers.length === 0
      ? 'PASS_V6_OWNER_CLEANUP_CHECK'
      : 'BLOCKED_V6_OWNER_CLEANUP_CHECK',
    sourceMatrixPath: rel(matrixPath),
    summary: {
      reviewedRows: rows.length,
      unclassifiedRows: unclassifiedRows.length,
      unclassifiedWithOwnerAction: unclassifiedRows.filter(row => row.owner && row.action).length,
      experimentRows: experimentRows.length,
      experimentDefaultExposureViolations,
      frozenRows: frozenRows.length,
      frozenDefaultExposureViolations,
      historicalResidueRows: historicalRows.length,
      historicalDefaultExposureViolations,
      claimBlockedRows: rows.filter(row => !row.claimAllowed).length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildV6OwnerCleanupCheck()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_CSV, renderCsv(report.rows), 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    reviewedRows: report.summary.reviewedRows,
    unclassifiedRows: report.summary.unclassifiedRows,
    unclassifiedWithOwnerAction: report.summary.unclassifiedWithOwnerAction,
    experimentDefaultExposureViolations: report.summary.experimentDefaultExposureViolations,
    frozenDefaultExposureViolations: report.summary.frozenDefaultExposureViolations,
    historicalDefaultExposureViolations: report.summary.historicalDefaultExposureViolations,
    claimBlockedRows: report.summary.claimBlockedRows,
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
