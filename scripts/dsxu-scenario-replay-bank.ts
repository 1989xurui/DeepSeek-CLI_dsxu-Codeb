import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type Signal = {
  sourceDoc: string
  signalCategory: string
  targetOwner: string
  missingRuntime: boolean
  missingTest: boolean
  claimAllowed: boolean
}

type ReplayLevel = 'mock' | 'internal' | 'fixture-mutation' | 'live-provider' | 'external-benchmark'

type ReplayCase = {
  id: string
  sourceDoc: string
  owner: string
  replayLevel: ReplayLevel
  passFailDefined: true
  publicBenchmarkClaimAllowed: false
  requiredEvidence: string[]
  passCriteria: string
}

type ReplayBankReport = {
  schemaVersion: 'dsxu.v7.scenario-replay-bank.v1'
  generatedAt: string
  status: 'PASS_DSXU_SCENARIO_REPLAY_BANK' | 'BLOCKED_DSXU_SCENARIO_REPLAY_BANK'
  sourceSignalPath: string
  summary: Record<ReplayLevel | 'totalCases' | 'publicBenchmarkClaimAllowedRows', number>
  blockers: string[]
  cases: ReplayCase[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_SIGNALS = join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_SCENARIO_REPLAY_BANK_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_SCENARIO_REPLAY_BANK_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseSignals(raw: unknown): Signal[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.signals) ? report.signals : []
  return rows.map((item): Signal => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      sourceDoc: String(row.sourceDoc ?? ''),
      signalCategory: String(row.signalCategory ?? ''),
      targetOwner: String(row.targetOwner ?? ''),
      missingRuntime: row.missingRuntime === true,
      missingTest: row.missingTest === true,
      claimAllowed: row.claimAllowed === true,
    }
  }).filter(row => row.sourceDoc)
}

function levelFor(signal: Signal): ReplayLevel {
  if (signal.signalCategory === 'benchmark-hit-rate') return 'external-benchmark'
  if (signal.signalCategory === 'deepseek-routing-cost-cache') return 'live-provider'
  if (signal.signalCategory === 'tool-protocol' || signal.signalCategory === 'verification-recovery') return 'fixture-mutation'
  if (!signal.missingRuntime && !signal.missingTest) return 'internal'
  return 'mock'
}

function caseFor(signal: Signal, index: number): ReplayCase {
  const replayLevel = levelFor(signal)
  return {
    id: `V7-RP-${(index + 1).toString().padStart(4, '0')}`,
    sourceDoc: signal.sourceDoc,
    owner: signal.targetOwner,
    replayLevel,
    passFailDefined: true,
    publicBenchmarkClaimAllowed: false,
    requiredEvidence: replayLevel === 'external-benchmark'
      ? ['fixed manifest', 'paired target raw transcript', 'tool trace', 'cost/cache metrics']
      : replayLevel === 'live-provider'
        ? ['live DeepSeek request/response', 'cost/cache metrics', 'secret redaction']
        : replayLevel === 'fixture-mutation'
          ? ['fixture repo', 'patch diff', 'focused test result']
          : ['deterministic fixture input', 'expected structured output'],
    passCriteria: `${replayLevel} replay must produce explicit pass/fail and remain blocked from public benchmark claim unless external paired raw evidence exists.`,
  }
}

function renderMarkdown(report: ReplayBankReport): string {
  return `# DSXU V7 Scenario Replay Bank - ${DATE}

- status: \`${report.status}\`

This bank converts extracted scenario signals into replay candidates. Mock/internal/live/external layers remain separate; no internal replay becomes a public benchmark claim.

## Summary

| metric | value |
|---|---:|
| totalCases | ${report.summary.totalCases} |
| mock | ${report.summary.mock} |
| internal | ${report.summary.internal} |
| fixture-mutation | ${report.summary['fixture-mutation']} |
| live-provider | ${report.summary['live-provider']} |
| external-benchmark | ${report.summary['external-benchmark']} |
| publicBenchmarkClaimAllowedRows | ${report.summary.publicBenchmarkClaimAllowedRows} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 80 Cases

| id | sourceDoc | owner | level | publicBenchmarkClaimAllowed |
|---|---|---|---|---:|
${report.cases.slice(0, 80).map(row => `| ${row.id} | \`${row.sourceDoc}\` | ${row.owner} | ${row.replayLevel} | ${row.publicBenchmarkClaimAllowed} |`).join('\n')}
`
}

export async function buildScenarioReplayBank(input: {
  signalPath?: string
  generatedAt?: string
  maxCases?: number
} = {}): Promise<ReplayBankReport> {
  const signalPath = resolve(input.signalPath ?? DEFAULT_SIGNALS)
  if (!existsSync(signalPath)) throw new Error(`missing signal extraction report: ${signalPath}`)
  const signals = parseSignals(JSON.parse(await readFile(signalPath, 'utf8')) as unknown)
    .filter(signal => signal.signalCategory === 'scenario-replay' || signal.missingTest)
    .slice(0, input.maxCases ?? 300)
  const cases = signals.map(caseFor)
  const blockers: string[] = []
  if (cases.length === 0) blockers.push('no replay cases generated')
  if (cases.some(row => !row.passFailDefined)) blockers.push('replay case without pass/fail definition')
  if (cases.some(row => row.publicBenchmarkClaimAllowed)) blockers.push('replay bank must not allow public benchmark claims')
  const count = (level: ReplayLevel): number => cases.filter(row => row.replayLevel === level).length
  return {
    schemaVersion: 'dsxu.v7.scenario-replay-bank.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_SCENARIO_REPLAY_BANK'
      : 'BLOCKED_DSXU_SCENARIO_REPLAY_BANK',
    sourceSignalPath: rel(signalPath),
    summary: {
      totalCases: cases.length,
      mock: count('mock'),
      internal: count('internal'),
      'fixture-mutation': count('fixture-mutation'),
      'live-provider': count('live-provider'),
      'external-benchmark': count('external-benchmark'),
      publicBenchmarkClaimAllowedRows: cases.filter(row => row.publicBenchmarkClaimAllowed).length,
    },
    blockers,
    cases,
  }
}

async function main(): Promise<void> {
  const report = await buildScenarioReplayBank()
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
