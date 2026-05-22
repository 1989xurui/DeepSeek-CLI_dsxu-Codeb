import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type CsvRow = Record<string, string>

interface CorpusRow {
  source: 'c2-1902' | 'v18-capability' | 'hard-benchmark'
  rowId: string
  owner: string
  claimRisk: string
  blockedReason: string
  allowedBoundary: string
  evidenceNeeded: string
}

const DATE = '20260517'
const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')
const DOCS = join(ROOT, 'docs')

const C2_OWNER_CSV = join(GENERATED, 'DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.csv')
const CAPABILITY_AUDIT_JSON = join(GENERATED, 'DSXU_CAPABILITY_ACCEPTANCE_AUDIT_20260516.json')
const HARD_BENCHMARK_JSON = join(GENERATED, `DSXU_HARD_ENGINEERING_BENCHMARK_${DATE}.json`)

const OUT_JSON = join(GENERATED, `DSXU_BLOCKED_CLAIM_CORPUS_${DATE}.json`)
const OUT_CSV = join(GENERATED, `DSXU_BLOCKED_CLAIM_CORPUS_${DATE}.csv`)
const OUT_MD = join(DOCS, `DSXU_BLOCKED_CLAIM_CORPUS_${DATE}.md`)

function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function buildC2Rows(): CorpusRow[] {
  return parseCsv(readFileSync(C2_OWNER_CSV, 'utf8'))
    .filter(row => row.priorPublicClaimStatus !== 'CLAIMABLE_ONLY_WITH_EXISTING_OWNER_EVIDENCE')
    .map(row => ({
      source: 'c2-1902' as const,
      rowId: row.referencePath,
      owner: row.ownerPacket || row.dsxuOwner,
      claimRisk: row.riskPriority || 'unknown',
      blockedReason: `${row.priorPublicClaimStatus}; ${row.finalDecision}`,
      allowedBoundary: row.publicClaimBoundary || 'claim only DSXU-owned generic mechanism with evidence',
      evidenceNeeded: 'Named DSXU owner, source/test/live evidence, no reference-product parity wording, and release claim binder approval.',
    }))
}

function buildCapabilityRows(): CorpusRow[] {
  const audit = readJson(CAPABILITY_AUDIT_JSON)
  return (audit.rows ?? [])
    .filter((row: any) => row.strictPublicClaimAllowed !== true)
    .map((row: any) => ({
      source: 'v18-capability' as const,
      rowId: row.id,
      owner: row.dsxuOwner,
      claimRisk: row.dsxuFitTier,
      blockedReason: row.acceptanceDecision,
      allowedBoundary: row.releaseUse || row.dsxuFitReason,
      evidenceNeeded: row.nextAction || 'Use as workflow/boundary capability only until strict source/test/live/raw/cost evidence exists.',
    }))
}

function buildHardBenchmarkRows(): CorpusRow[] {
  const benchmark = readJson(HARD_BENCHMARK_JSON)
  const taskOverrides = hardBenchmarkTaskOverrides()
  return (benchmark.tasks ?? [])
    .map((task: any) => taskOverrides.get(task.id) ?? task)
    .filter((task: any) => task.dsxu?.pass !== true)
    .map((task: any) => ({
      source: 'hard-benchmark' as const,
      rowId: task.id,
      owner: task.lane,
      claimRisk: 'hard-benchmark-gap',
      blockedReason: `missing signals: ${missingSignals(task).join('; ')}`,
      allowedBoundary: 'Do not use this task as product claim evidence until all expected signals pass.',
      evidenceNeeded: 'Rerun hard benchmark after source/test/live/raw/cost claim binder fixes.',
    }))
}

function missingSignals(task: any): string[] {
  const actual = new Set(task.dsxu?.verificationSignals ?? [])
  return (task.expectedSignals ?? []).filter((signal: string) => !actual.has(signal))
}

function hardBenchmarkTaskOverrides(): Map<string, any> {
  const overrides = new Map<string, any>()
  for (const name of readdirSync(GENERATED)) {
    if (!name.startsWith(`DSXU_HARD_ENGINEERING_BENCHMARK_${DATE}_`) || !name.endsWith('.json')) continue
    const report = readJson(join(GENERATED, name))
    for (const task of report.tasks ?? []) {
      if (task.dsxu?.pass === true) overrides.set(task.id, task)
    }
  }
  return overrides
}

function countBy(rows: CorpusRow[], key: keyof CorpusRow): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1
  return counts
}

function main() {
  mkdirSync(GENERATED, { recursive: true })
  const rows = [
    ...buildC2Rows(),
    ...buildCapabilityRows(),
    ...buildHardBenchmarkRows(),
  ]
  const summary = {
    schemaVersion: 'dsxu.blocked-claim-corpus.v1',
    generatedAt: new Date().toISOString(),
    status: 'PASS_BLOCKED_CLAIM_CORPUS_GENERATED',
    totals: {
      rows: rows.length,
      c2Rows: rows.filter(row => row.source === 'c2-1902').length,
      capabilityRows: rows.filter(row => row.source === 'v18-capability').length,
      hardBenchmarkRows: rows.filter(row => row.source === 'hard-benchmark').length,
    },
    counts: {
      bySource: countBy(rows, 'source'),
      byOwner: countBy(rows, 'owner'),
      byClaimRisk: countBy(rows, 'claimRisk'),
    },
    rules: [
      'Blocked corpus is a release-claim safety artifact, not a feature-completion claim.',
      'Reference-product parity, public 90/95, external benchmark victory, standalone runtime, and copied brand claims remain blocked without same-task raw evidence.',
      'V18/V26 capability rows may be used as GitHub copy only within their allowed boundary and only with cited source/test/live/raw/cost evidence.',
      'Hard benchmark gaps block release claim evidence until rerun evidence shows all expected signals present.',
    ],
    outputs: {
      json: OUT_JSON,
      csv: OUT_CSV,
      markdown: OUT_MD,
    },
  }

  writeFileSync(OUT_JSON, JSON.stringify({ summary, rows }, null, 2))
  writeFileSync(
    OUT_CSV,
    [
      ['source', 'rowId', 'owner', 'claimRisk', 'blockedReason', 'allowedBoundary', 'evidenceNeeded'].map(csvEscape).join(','),
      ...rows.map(row => [
        row.source,
        row.rowId,
        row.owner,
        row.claimRisk,
        row.blockedReason,
        row.allowedBoundary,
        row.evidenceNeeded,
      ].map(csvEscape).join(',')),
    ].join('\n'),
  )
  writeFileSync(
    OUT_MD,
    [
      '# DSXU Blocked Claim Corpus - 2026-05-17',
      '',
      'This corpus turns C2/1902 reference-risk rows, V18 capability boundaries, and hard-benchmark gaps into a release-claim safety dataset. It is used to keep GitHub copy, README claims, benchmark charts, and launch material tied to real DSXU evidence.',
      '',
      '## Summary',
      '',
      `- status: ${summary.status}`,
      `- total rows: ${summary.totals.rows}`,
      `- C2/1902 blocked rows: ${summary.totals.c2Rows}`,
      `- V18 capability claim-limited rows: ${summary.totals.capabilityRows}`,
      `- hard benchmark blocked rows: ${summary.totals.hardBenchmarkRows}`,
      '',
      '## Rules',
      '',
      ...summary.rules.map(rule => `- ${rule}`),
      '',
      '## Source Counts',
      '',
      '| source | rows |',
      '| --- | ---: |',
      ...Object.entries(summary.counts.bySource).map(([source, count]) => `| ${source} | ${count} |`),
      '',
      '## Top Owner Counts',
      '',
      '| owner | rows |',
      '| --- | ---: |',
      ...Object.entries(summary.counts.byOwner)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([owner, count]) => `| ${owner} | ${count} |`),
      '',
      '## Sample Rows',
      '',
      '| source | rowId | owner | claimRisk | blockedReason |',
      '| --- | --- | --- | --- | --- |',
      ...rows.slice(0, 20).map(row => `| ${row.source} | ${row.rowId} | ${row.owner} | ${row.claimRisk} | ${row.blockedReason} |`),
      '',
    ].join('\n'),
  )

  console.log(summary.status)
  console.log(`rows=${summary.totals.rows}`)
  console.log(`c2Rows=${summary.totals.c2Rows}`)
  console.log(`capabilityRows=${summary.totals.capabilityRows}`)
  console.log(`hardBenchmarkRows=${summary.totals.hardBenchmarkRows}`)
}

main()
