import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type RegistryRow = {
  path: string
  lines?: number
  status: string
  deleteSafety: string
  transformPotential: string
  remainingSignals?: string[]
  claimRisk?: boolean
  releaseRisk?: boolean
}

type DsxuDocSignal = {
  sourceDoc: string
  sourceLines: string
  signalCategory:
    | 'prompt-discipline'
    | 'tool-protocol'
    | 'verification-recovery'
    | 'context-memory-ledger'
    | 'agent-skill-mcp'
    | 'deepseek-routing-cost-cache'
    | 'benchmark-hit-rate'
    | 'release-claim-boundary'
    | 'tui-trust-surface'
    | 'scenario-replay'
  summary: string
  targetOwner: string
  targetV6WorkPackage: string
  alreadyCovered: boolean
  missingRuntime: boolean
  missingTest: boolean
  promptAllowed: boolean
  claimAllowed: boolean
  archiveAfterExtraction: boolean
}

type SignalReport = {
  schemaVersion: 'dsxu.v7.doc-signal-extraction.v1'
  generatedAt: string
  sourceRegistryPath: string
  status: 'PASS_DSXU_DOC_SIGNAL_EXTRACTION' | 'BLOCKED_DSXU_DOC_SIGNAL_EXTRACTION'
  summary: {
    docCount: number
    signalCount: number
    p0DocCount: number
    p0DocsWithSignals: number
    promptAllowedSignals: number
    claimAllowedSignals: number
    archiveAfterExtractionSignals: number
  }
  blockers: string[]
  signals: DsxuDocSignal[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REGISTRY = join(GENERATED_DIR, `DSXU_DOCS_TRUTH_REGISTRY_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.md`)

const CATEGORY_BY_REGISTRY_SIGNAL: Record<string, DsxuDocSignal['signalCategory']> = {
  'prompt-behavior-discipline': 'prompt-discipline',
  'tool-protocol-and-schema': 'tool-protocol',
  'verification-recovery-gates': 'verification-recovery',
  'context-memory-ledger': 'context-memory-ledger',
  'agent-multi-window-orchestration': 'agent-skill-mcp',
  'skill-mcp-workflow-boundary': 'agent-skill-mcp',
  'deepseek-routing-cost-cache': 'deepseek-routing-cost-cache',
  'benchmark-and-hit-rate-evidence': 'benchmark-hit-rate',
  'claim-boundary-and-public-wording': 'release-claim-boundary',
  'release-ip-brand-risk': 'release-claim-boundary',
  'tui-visible-state-experience': 'tui-trust-surface',
  'scenario-test-corpus': 'scenario-replay',
}

const OWNER_BY_CATEGORY: Record<DsxuDocSignal['signalCategory'], string> = {
  'prompt-discipline': 'Prompt Section Router / Prompt Input Allowlist',
  'tool-protocol': 'Tool Gate / Tool View',
  'verification-recovery': 'VerificationKernel / Recovery Decision',
  'context-memory-ledger': 'PlanGraph / Work-State Ledger',
  'agent-skill-mcp': 'Agent Evidence / MCP Skill Registry',
  'deepseek-routing-cost-cache': 'DeepSeek Route / Cost / Cache Owner',
  'benchmark-hit-rate': 'Evidence / Benchmark Owner',
  'release-claim-boundary': 'Release Claim Binder',
  'tui-trust-surface': 'TUI Trust Surface',
  'scenario-replay': 'Scenario Replay Bank',
}

const WORK_PACKAGE_BY_CATEGORY: Record<DsxuDocSignal['signalCategory'], string> = {
  'prompt-discipline': 'V7-02',
  'tool-protocol': 'V6 Tool Contract / V7 Safety Gate',
  'verification-recovery': 'V6 Recovery / V7 Scenario Replay',
  'context-memory-ledger': 'V6 Ledger / V7 Runtime Reachability',
  'agent-skill-mcp': 'V6 Agent-Skill Expert Layer',
  'deepseek-routing-cost-cache': 'V6 DeepSeek Native Runtime',
  'benchmark-hit-rate': 'V7 Claim Boundary Gate',
  'release-claim-boundary': 'V7 Claim Boundary Gate',
  'tui-trust-surface': 'V6 PTY/TUI Acceptance',
  'scenario-replay': 'V7-06',
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function array(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function parseRows(raw: unknown): RegistryRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): RegistryRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      lines: Number(row.lines ?? 0),
      status: String(row.status ?? 'manual-review'),
      deleteSafety: String(row.deleteSafety ?? 'after-signal-extraction'),
      transformPotential: String(row.transformPotential ?? 'none'),
      remainingSignals: array(row.remainingSignals),
      claimRisk: row.claimRisk === true,
      releaseRisk: row.releaseRisk === true,
    }
  }).filter(row => row.path)
}

function isP0Doc(row: RegistryRow): boolean {
  return row.transformPotential === 'high' && [
    'active-master-plan',
    'active-v6-evidence',
    'active-public-doc',
    'active-reference',
    'historical-evidence',
    'evidence-audit',
    'superseded-plan',
    'superseded-review',
    'generated-historical',
  ].includes(row.status)
}

function promptAllowed(row: RegistryRow, category: DsxuDocSignal['signalCategory']): boolean {
  if (category !== 'prompt-discipline') return false
  return [
    'active-master-plan',
    'active-v6-evidence',
    'active-public-doc',
    'active-reference',
  ].includes(row.status)
}

function archiveAfterExtraction(row: RegistryRow): boolean {
  return [
    'historical-evidence',
    'evidence-audit',
    'superseded-plan',
    'superseded-review',
    'generated-historical',
  ].includes(row.status) && row.deleteSafety !== 'no'
}

function signalFrom(row: RegistryRow, rawSignal: string): DsxuDocSignal | undefined {
  const category = CATEGORY_BY_REGISTRY_SIGNAL[rawSignal]
  if (!category) return undefined
  return {
    sourceDoc: row.path,
    sourceLines: row.lines ? `1-${row.lines}` : 'unknown',
    signalCategory: category,
    summary: `${rawSignal} extracted from ${row.status}; use as structured signal only, not raw prompt context.`,
    targetOwner: OWNER_BY_CATEGORY[category],
    targetV6WorkPackage: WORK_PACKAGE_BY_CATEGORY[category],
    alreadyCovered: [
      'active-master-plan',
      'active-v6-evidence',
      'generated-current',
    ].includes(row.status),
    missingRuntime: ![
      'active-master-plan',
      'active-v6-evidence',
      'generated-current',
      'active-public-doc',
    ].includes(row.status),
    missingTest: [
      'scenario-replay',
      'benchmark-hit-rate',
      'release-claim-boundary',
    ].includes(category),
    promptAllowed: promptAllowed(row, category),
    claimAllowed: false,
    archiveAfterExtraction: archiveAfterExtraction(row),
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function renderCsv(signals: DsxuDocSignal[]): string {
  const headers: Array<keyof DsxuDocSignal> = [
    'sourceDoc',
    'sourceLines',
    'signalCategory',
    'summary',
    'targetOwner',
    'targetV6WorkPackage',
    'alreadyCovered',
    'missingRuntime',
    'missingTest',
    'promptAllowed',
    'claimAllowed',
    'archiveAfterExtraction',
  ]
  return [
    headers.join(','),
    ...signals.map(signal => headers.map(header => csvCell(signal[header])).join(',')),
    '',
  ].join('\n')
}

function renderMarkdown(report: SignalReport): string {
  const byCategory = report.signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.signalCategory] = (acc[signal.signalCategory] ?? 0) + 1
    return acc
  }, {})
  return `# DSXU V7 Doc Signal Extraction - ${DATE}

- status: \`${report.status}\`

This registry converts historical/current docs into structured signals. It never places historical raw documents into the default prompt and never promotes extracted signals into public claims by itself.

## Summary

| metric | value |
|---|---:|
| docCount | ${report.summary.docCount} |
| signalCount | ${report.summary.signalCount} |
| p0DocCount | ${report.summary.p0DocCount} |
| p0DocsWithSignals | ${report.summary.p0DocsWithSignals} |
| promptAllowedSignals | ${report.summary.promptAllowedSignals} |
| claimAllowedSignals | ${report.summary.claimAllowedSignals} |
| archiveAfterExtractionSignals | ${report.summary.archiveAfterExtractionSignals} |

## By Category

${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, count]) => `- ${category}: ${count}`).join('\n')}

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 40 Signals

| sourceDoc | category | targetOwner | promptAllowed | claimAllowed |
|---|---|---|---:|---:|
${report.signals.slice(0, 40).map(signal => `| \`${signal.sourceDoc}\` | ${signal.signalCategory} | ${signal.targetOwner} | ${signal.promptAllowed} | ${signal.claimAllowed} |`).join('\n')}
`
}

export async function buildDocSignalExtraction(input: {
  registryPath?: string
  generatedAt?: string
} = {}): Promise<SignalReport> {
  const registryPath = resolve(input.registryPath ?? DEFAULT_REGISTRY)
  if (!existsSync(registryPath)) throw new Error(`missing docs truth registry: ${registryPath}`)
  const rows = parseRows(JSON.parse(await readFile(registryPath, 'utf8')) as unknown)
  const signals = rows.flatMap(row =>
    (row.remainingSignals ?? [])
      .map(rawSignal => signalFrom(row, rawSignal))
      .filter((signal): signal is DsxuDocSignal => Boolean(signal)),
  )
  const p0Rows = rows.filter(isP0Doc)
  const p0WithSignals = p0Rows.filter(row =>
    row.remainingSignals?.some(signal => CATEGORY_BY_REGISTRY_SIGNAL[signal]),
  )
  const blockers: string[] = []
  if (rows.length === 0) blockers.push('docs registry contains no rows')
  if (p0Rows.length !== p0WithSignals.length) {
    blockers.push(`P0 docs without extracted signal: ${p0Rows.length - p0WithSignals.length}`)
  }
  if (signals.some(signal => signal.claimAllowed && !/(source|test|live|benchmark)/i.test(signal.summary))) {
    blockers.push('claimAllowed signal without source/test/live/benchmark basis')
  }
  if (signals.some(signal =>
    signal.promptAllowed &&
    /superseded|historical|generated-historical/.test(rows.find(row => row.path === signal.sourceDoc)?.status ?? ''),
  )) {
    blockers.push('historical or superseded raw doc leaked into prompt-allowed signals')
  }

  return {
    schemaVersion: 'dsxu.v7.doc-signal-extraction.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceRegistryPath: rel(registryPath),
    status: blockers.length === 0
      ? 'PASS_DSXU_DOC_SIGNAL_EXTRACTION'
      : 'BLOCKED_DSXU_DOC_SIGNAL_EXTRACTION',
    summary: {
      docCount: rows.length,
      signalCount: signals.length,
      p0DocCount: p0Rows.length,
      p0DocsWithSignals: p0WithSignals.length,
      promptAllowedSignals: signals.filter(signal => signal.promptAllowed).length,
      claimAllowedSignals: signals.filter(signal => signal.claimAllowed).length,
      archiveAfterExtractionSignals: signals.filter(signal => signal.archiveAfterExtraction).length,
    },
    blockers,
    signals,
  }
}

async function main(): Promise<void> {
  const report = await buildDocSignalExtraction()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_CSV, renderCsv(report.signals), 'utf8')
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
