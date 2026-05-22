import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type DocRow = {
  path: string
  status: string
  deleteSafety: string
  transformPotential: string
  claimRisk?: boolean
  releaseRisk?: boolean
}

type Signal = {
  sourceDoc: string
  archiveAfterExtraction: boolean
}

type ArchiveAction = 'archive-review' | 'keep-governance-evidence' | 'regenerable-observe' | 'observe'

type ArchiveRow = {
  path: string
  status: string
  deleteSafety: string
  action: ArchiveAction
  deleteNow: false
  extractedSignalCount: number
  claimRisk: boolean
  releaseRisk: boolean
  reason: string
}

type ArchiveReport = {
  schemaVersion: 'dsxu.v7.archive-watchlist.v1'
  generatedAt: string
  status: 'PASS_DSXU_ARCHIVE_WATCHLIST' | 'BLOCKED_DSXU_ARCHIVE_WATCHLIST'
  sourceRegistryPath: string
  sourceSignalPath: string
  summary: {
    watchedRows: number
    archiveReview: number
    keepGovernanceEvidence: number
    regenerableObserve: number
    observe: number
    deleteNow: number
    activeRowsInWatchlist: number
  }
  blockers: string[]
  rows: ArchiveRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REGISTRY = join(GENERATED_DIR, `DSXU_DOCS_TRUTH_REGISTRY_${DATE}.json`)
const DEFAULT_SIGNALS = join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_ARCHIVE_WATCHLIST_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_ARCHIVE_WATCHLIST_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseDocs(raw: unknown): DocRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): DocRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      status: String(row.status ?? ''),
      deleteSafety: String(row.deleteSafety ?? ''),
      transformPotential: String(row.transformPotential ?? ''),
      claimRisk: row.claimRisk === true,
      releaseRisk: row.releaseRisk === true,
    }
  }).filter(row => row.path)
}

function parseSignals(raw: unknown): Signal[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.signals) ? report.signals : []
  return rows.map((item): Signal => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      sourceDoc: String(row.sourceDoc ?? ''),
      archiveAfterExtraction: row.archiveAfterExtraction === true,
    }
  }).filter(row => row.sourceDoc)
}

function activeStatus(status: string): boolean {
  return [
    'active-master-plan',
    'active-v6-evidence',
    'active-public-doc',
    'active-reference',
    'active-registry-source',
  ].includes(status)
}

function actionFor(row: DocRow, extractedSignalCount: number): ArchiveAction {
  if (row.claimRisk || row.releaseRisk) return 'keep-governance-evidence'
  if (row.deleteSafety === 'regenerable-only') return 'regenerable-observe'
  if (extractedSignalCount > 0 && row.deleteSafety !== 'no') return 'archive-review'
  return 'observe'
}

function reasonFor(row: DocRow, action: ArchiveAction, extractedSignalCount: number): string {
  if (action === 'keep-governance-evidence') return 'Claim/release/IP risk remains useful governance evidence; do not archive automatically.'
  if (action === 'regenerable-observe') return 'Generated or regenerable file; observe until generator/replay path is proven.'
  if (action === 'archive-review') return `Signals extracted (${extractedSignalCount}); can enter archive review, not deletion.`
  return `Status=${row.status}; keep under observation.`
}

function renderMarkdown(report: ArchiveReport): string {
  return `# DSXU V7 Archive Watchlist - ${DATE}

- status: \`${report.status}\`

This watchlist never deletes files. It records which historical/generated docs may later enter archive review after signal extraction and governance review.

## Summary

| metric | value |
|---|---:|
| watchedRows | ${report.summary.watchedRows} |
| archiveReview | ${report.summary.archiveReview} |
| keepGovernanceEvidence | ${report.summary.keepGovernanceEvidence} |
| regenerableObserve | ${report.summary.regenerableObserve} |
| observe | ${report.summary.observe} |
| deleteNow | ${report.summary.deleteNow} |
| activeRowsInWatchlist | ${report.summary.activeRowsInWatchlist} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 80 Rows

| path | status | action | signals | deleteNow |
|---|---|---|---:|---:|
${report.rows.slice(0, 80).map(row => `| \`${row.path}\` | ${row.status} | ${row.action} | ${row.extractedSignalCount} | ${row.deleteNow} |`).join('\n')}
`
}

export async function buildArchiveWatchlist(input: {
  registryPath?: string
  signalPath?: string
  generatedAt?: string
} = {}): Promise<ArchiveReport> {
  const registryPath = resolve(input.registryPath ?? DEFAULT_REGISTRY)
  const signalPath = resolve(input.signalPath ?? DEFAULT_SIGNALS)
  if (!existsSync(registryPath)) throw new Error(`missing docs truth registry: ${registryPath}`)
  if (!existsSync(signalPath)) throw new Error(`missing doc signal extraction report: ${signalPath}`)
  const docs = parseDocs(JSON.parse(await readFile(registryPath, 'utf8')) as unknown)
  const signals = parseSignals(JSON.parse(await readFile(signalPath, 'utf8')) as unknown)
  const signalCounts = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.sourceDoc] = (acc[signal.sourceDoc] ?? 0) + 1
    return acc
  }, {})
  const rows = docs
    .filter(row => !activeStatus(row.status))
    .map((row): ArchiveRow => {
      const extractedSignalCount = signalCounts[row.path] ?? 0
      const action = actionFor(row, extractedSignalCount)
      return {
        path: row.path,
        status: row.status,
        deleteSafety: row.deleteSafety,
        action,
        deleteNow: false,
        extractedSignalCount,
        claimRisk: row.claimRisk === true,
        releaseRisk: row.releaseRisk === true,
        reason: reasonFor(row, action, extractedSignalCount),
      }
    })
  const blockers: string[] = []
  if (rows.some(row => row.deleteNow)) blockers.push('archive watchlist must not delete files')
  const activeRowsInWatchlist = rows.filter(row => activeStatus(row.status)).length
  if (activeRowsInWatchlist > 0) blockers.push(`active rows leaked into archive watchlist: ${activeRowsInWatchlist}`)
  if (rows.some(row => row.action === 'archive-review' && row.extractedSignalCount === 0)) {
    blockers.push('archive-review row without extracted signal')
  }
  const count = (action: ArchiveAction): number => rows.filter(row => row.action === action).length
  return {
    schemaVersion: 'dsxu.v7.archive-watchlist.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_ARCHIVE_WATCHLIST'
      : 'BLOCKED_DSXU_ARCHIVE_WATCHLIST',
    sourceRegistryPath: rel(registryPath),
    sourceSignalPath: rel(signalPath),
    summary: {
      watchedRows: rows.length,
      archiveReview: count('archive-review'),
      keepGovernanceEvidence: count('keep-governance-evidence'),
      regenerableObserve: count('regenerable-observe'),
      observe: count('observe'),
      deleteNow: rows.filter(row => row.deleteNow).length,
      activeRowsInWatchlist,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildArchiveWatchlist()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    summary: report.summary,
    blockers: report.blockers,
    outputs: {
      json: rel(OUT_JSON),
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
