import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ReplayLevel = 'mock' | 'internal' | 'fixture-mutation' | 'live-provider' | 'external-benchmark'

type ReplayCase = {
  id: string
  sourceDoc: string
  owner: string
  replayLevel: ReplayLevel
  passFailDefined: boolean
  publicBenchmarkClaimAllowed: boolean
  requiredEvidence: string[]
  passCriteria: string
}

type ReplayBankReport = {
  summary?: {
    totalCases?: number
    mock?: number
    internal?: number
    'fixture-mutation'?: number
    'live-provider'?: number
    'external-benchmark'?: number
    publicBenchmarkClaimAllowedRows?: number
  }
  cases?: ReplayCase[]
}

type ReplayExecutionStatus =
  | 'PASS_MOCK_REPLAY_CONTRACT'
  | 'READY_INTERNAL_REPLAY'
  | 'READY_FIXTURE_MUTATION_REPLAY'
  | 'BLOCKED_NEEDS_LIVE_PROVIDER_EVIDENCE'
  | 'BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW'
  | 'BLOCKED_INVALID_REPLAY_CASE'

type ReplayExecutionRow = {
  id: string
  sourceDoc: string
  owner: string
  replayLevel: ReplayLevel
  sourceDocExists: boolean
  executionStatus: ReplayExecutionStatus
  localExecutionAllowed: boolean
  liveExecutionRequired: boolean
  externalPairedRawRequired: boolean
  publicBenchmarkClaimAllowed: false
  publicClaimReady: false
  passFailDefined: boolean
  requiredEvidence: string[]
  missingEvidence: string[]
  nextAction: string
}

type ReplayLayerEvidenceReport = {
  schemaVersion: 'dsxu.v7.scenario-replay-layer-evidence.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE' | 'BLOCKED_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE'
  sourceReplayBankPath: string
  summary: {
    rows: number
    sourceReplayBankRows: number
    mockRows: number
    mockContractPassRows: number
    internalReadyRows: number
    fixtureMutationReadyRows: number
    liveProviderBlockedRows: number
    externalBenchmarkBlockedRows: number
    missingSourceDocRows: number
    publicBenchmarkClaimAllowedRows: number
    publicClaimReadyRows: number
  }
  blockers: string[]
  rows: ReplayExecutionRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REPLAY_BANK = join(GENERATED_DIR, `DSXU_SCENARIO_REPLAY_BANK_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.md`)

const REQUIRED_BY_LEVEL: Record<ReplayLevel, string[]> = {
  mock: ['deterministic fixture input', 'expected structured output'],
  internal: ['deterministic fixture input', 'expected structured output'],
  'fixture-mutation': ['fixture repo', 'patch diff', 'focused test result'],
  'live-provider': ['live DeepSeek request/response', 'cost/cache metrics', 'secret redaction'],
  'external-benchmark': ['fixed manifest', 'paired target raw transcript', 'tool trace', 'cost/cache metrics'],
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseCases(raw: unknown): ReplayCase[] {
  const report = raw && typeof raw === 'object' ? raw as ReplayBankReport : {}
  return (Array.isArray(report.cases) ? report.cases : [])
    .map((item): ReplayCase => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const replayLevel = String(row.replayLevel ?? 'mock') as ReplayLevel
      return {
        id: String(row.id ?? ''),
        sourceDoc: String(row.sourceDoc ?? ''),
        owner: String(row.owner ?? ''),
        replayLevel,
        passFailDefined: row.passFailDefined === true,
        publicBenchmarkClaimAllowed: row.publicBenchmarkClaimAllowed === true,
        requiredEvidence: Array.isArray(row.requiredEvidence) ? row.requiredEvidence.map(String) : [],
        passCriteria: String(row.passCriteria ?? ''),
      }
    })
    .filter(row => row.id)
}

function missingRequiredEvidence(row: ReplayCase): string[] {
  return (REQUIRED_BY_LEVEL[row.replayLevel] ?? []).filter(item => !row.requiredEvidence.includes(item))
}

function statusFor(row: ReplayCase, sourceDocExists: boolean, missingEvidence: string[]): ReplayExecutionStatus {
  if (!sourceDocExists || !row.passFailDefined || row.publicBenchmarkClaimAllowed || missingEvidence.length > 0) {
    return 'BLOCKED_INVALID_REPLAY_CASE'
  }
  if (row.replayLevel === 'mock') return 'PASS_MOCK_REPLAY_CONTRACT'
  if (row.replayLevel === 'internal') return 'READY_INTERNAL_REPLAY'
  if (row.replayLevel === 'fixture-mutation') return 'READY_FIXTURE_MUTATION_REPLAY'
  if (row.replayLevel === 'live-provider') return 'BLOCKED_NEEDS_LIVE_PROVIDER_EVIDENCE'
  return 'BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW'
}

function nextActionFor(status: ReplayExecutionStatus): string {
  switch (status) {
    case 'PASS_MOCK_REPLAY_CONTRACT':
      return 'Mock contract is locally validated; keep as rule/harness evidence only.'
    case 'READY_INTERNAL_REPLAY':
      return 'Ready for internal replay execution; do not convert to public benchmark claim.'
    case 'READY_FIXTURE_MUTATION_REPLAY':
      return 'Ready for fixture mutation replay with patch diff and focused tests.'
    case 'BLOCKED_NEEDS_LIVE_PROVIDER_EVIDENCE':
      return 'Requires explicit live DeepSeek provider run with redacted raw evidence.'
    case 'BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW':
      return 'Requires fixed manifest and paired target raw evidence before any public benchmark claim.'
    default:
      return 'Fix source, pass/fail, evidence, or claim boundary before replay.'
  }
}

function rowFor(input: ReplayCase): ReplayExecutionRow {
  const sourceDocExists = input.sourceDoc.length > 0 && existsSync(resolve(ROOT, input.sourceDoc))
  const missingEvidence = missingRequiredEvidence(input)
  const executionStatus = statusFor(input, sourceDocExists, missingEvidence)
  return {
    id: input.id,
    sourceDoc: input.sourceDoc,
    owner: input.owner,
    replayLevel: input.replayLevel,
    sourceDocExists,
    executionStatus,
    localExecutionAllowed: executionStatus === 'PASS_MOCK_REPLAY_CONTRACT' ||
      executionStatus === 'READY_INTERNAL_REPLAY' ||
      executionStatus === 'READY_FIXTURE_MUTATION_REPLAY',
    liveExecutionRequired: executionStatus === 'BLOCKED_NEEDS_LIVE_PROVIDER_EVIDENCE',
    externalPairedRawRequired: executionStatus === 'BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW',
    publicBenchmarkClaimAllowed: false,
    publicClaimReady: false,
    passFailDefined: input.passFailDefined,
    requiredEvidence: input.requiredEvidence,
    missingEvidence,
    nextAction: nextActionFor(executionStatus),
  }
}

function renderMarkdown(report: ReplayLayerEvidenceReport): string {
  return `# DSXU V7 Scenario Replay Layer Evidence - ${DATE}

- status: \`${report.status}\`

This report converts the V7 scenario replay bank into an execution/readiness evidence queue. Mock/internal/fixture/live/external layers remain separate. It does not run live providers, does not fabricate paired target raw logs, and does not grant public benchmark claims.

## Summary

| metric | value |
|---|---:|
| rows | ${report.summary.rows} |
| sourceReplayBankRows | ${report.summary.sourceReplayBankRows} |
| mockRows | ${report.summary.mockRows} |
| mockContractPassRows | ${report.summary.mockContractPassRows} |
| internalReadyRows | ${report.summary.internalReadyRows} |
| fixtureMutationReadyRows | ${report.summary.fixtureMutationReadyRows} |
| liveProviderBlockedRows | ${report.summary.liveProviderBlockedRows} |
| externalBenchmarkBlockedRows | ${report.summary.externalBenchmarkBlockedRows} |
| missingSourceDocRows | ${report.summary.missingSourceDocRows} |
| publicBenchmarkClaimAllowedRows | ${report.summary.publicBenchmarkClaimAllowedRows} |
| publicClaimReadyRows | ${report.summary.publicClaimReadyRows} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 80 Rows

| id | level | status | local | source | owner |
|---|---|---|---:|---:|---|
${report.rows.slice(0, 80).map(row => `| ${row.id} | ${row.replayLevel} | ${row.executionStatus} | ${row.localExecutionAllowed} | ${row.sourceDocExists} | ${row.owner} |`).join('\n')}
`
}

export async function buildScenarioReplayLayerEvidence(input: {
  replayBankPath?: string
  generatedAt?: string
} = {}): Promise<ReplayLayerEvidenceReport> {
  const replayBankPath = resolve(input.replayBankPath ?? DEFAULT_REPLAY_BANK)
  if (!existsSync(replayBankPath)) throw new Error(`missing scenario replay bank: ${replayBankPath}`)
  const raw = JSON.parse(await readFile(replayBankPath, 'utf8')) as unknown
  const bank = raw && typeof raw === 'object' ? raw as ReplayBankReport : {}
  const cases = parseCases(raw)
  const rows = cases.map(rowFor)
  const blockers: string[] = []
  if (rows.length === 0) blockers.push('no replay rows found')
  if (rows.length !== Number(bank.summary?.totalCases ?? rows.length)) {
    blockers.push(`replay row mismatch: rows=${rows.length}, source=${Number(bank.summary?.totalCases ?? 0)}`)
  }
  if (rows.some(row => row.executionStatus === 'BLOCKED_INVALID_REPLAY_CASE')) {
    blockers.push('one or more replay cases are invalid')
  }
  if (rows.some(row => row.publicBenchmarkClaimAllowed || row.publicClaimReady)) {
    blockers.push('replay evidence must not grant public benchmark claim readiness')
  }
  return {
    schemaVersion: 'dsxu.v7.scenario-replay-layer-evidence.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE'
      : 'BLOCKED_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE',
    sourceReplayBankPath: rel(replayBankPath),
    summary: {
      rows: rows.length,
      sourceReplayBankRows: Number(bank.summary?.totalCases ?? rows.length),
      mockRows: rows.filter(row => row.replayLevel === 'mock').length,
      mockContractPassRows: rows.filter(row => row.executionStatus === 'PASS_MOCK_REPLAY_CONTRACT').length,
      internalReadyRows: rows.filter(row => row.executionStatus === 'READY_INTERNAL_REPLAY').length,
      fixtureMutationReadyRows: rows.filter(row => row.executionStatus === 'READY_FIXTURE_MUTATION_REPLAY').length,
      liveProviderBlockedRows: rows.filter(row => row.executionStatus === 'BLOCKED_NEEDS_LIVE_PROVIDER_EVIDENCE').length,
      externalBenchmarkBlockedRows: rows.filter(row => row.executionStatus === 'BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW').length,
      missingSourceDocRows: rows.filter(row => !row.sourceDocExists).length,
      publicBenchmarkClaimAllowedRows: rows.filter(row => row.publicBenchmarkClaimAllowed).length,
      publicClaimReadyRows: rows.filter(row => row.publicClaimReady).length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildScenarioReplayLayerEvidence()
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
