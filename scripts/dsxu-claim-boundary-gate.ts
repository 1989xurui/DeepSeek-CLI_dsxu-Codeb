import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ReachabilityRow = {
  path: string
  owner: string
  reachability: string
  publicClaimAllowed: boolean
}

type ReplayCase = {
  id: string
  replayLevel: string
  publicBenchmarkClaimAllowed: boolean
}

type ClaimLevel = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5'

type ClaimCandidate = {
  id: string
  level: ClaimLevel
  statement: string
  evidence: string[]
  publicAllowed: boolean
  boundary: string
}

type ClaimBoundaryReport = {
  schemaVersion: 'dsxu.v7.claim-boundary-gate.v1'
  generatedAt: string
  status: 'PASS_DSXU_CLAIM_BOUNDARY_GATE' | 'BLOCKED_DSXU_CLAIM_BOUNDARY_GATE'
  sourceReachabilityPath: string
  sourceReplayBankPath: string
  summary: {
    candidates: number
    publicAllowed: number
    c3BelowPublicAllowed: number
    public90Allowed: boolean
    externalBenchmarkReady: boolean
  }
  blockers: string[]
  candidates: ClaimCandidate[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REACHABILITY = join(GENERATED_DIR, `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`)
const DEFAULT_REPLAY_BANK = join(GENERATED_DIR, `DSXU_SCENARIO_REPLAY_BANK_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_CLAIM_BOUNDARY_GATE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_CLAIM_BOUNDARY_GATE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseReachability(raw: unknown): ReachabilityRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): ReachabilityRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? ''),
      reachability: String(row.reachability ?? 'R0'),
      publicClaimAllowed: row.publicClaimAllowed === true,
    }
  }).filter(row => row.path)
}

function parseReplay(raw: unknown): ReplayCase[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.cases) ? report.cases : []
  return rows.map((item): ReplayCase => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: String(row.id ?? ''),
      replayLevel: String(row.replayLevel ?? ''),
      publicBenchmarkClaimAllowed: row.publicBenchmarkClaimAllowed === true,
    }
  }).filter(row => row.id)
}

function baseCandidates(reachability: ReachabilityRow[], replayCases: ReplayCase[]): ClaimCandidate[] {
  const r3 = reachability.filter(row => row.reachability === 'R3' || row.reachability === 'R4').length
  const live = replayCases.filter(row => row.replayLevel === 'live-provider').length
  const external = replayCases.filter(row => row.replayLevel === 'external-benchmark' && row.publicBenchmarkClaimAllowed).length
  return [
    {
      id: 'V7-CLAIM-C0-DESIGN-GOAL',
      level: 'C0',
      statement: 'DSXU has a DeepSeek-first engineering runtime design goal.',
      evidence: ['DSXU V6/V7 docs'],
      publicAllowed: false,
      boundary: 'Internal design goal only.',
    },
    {
      id: 'V7-CLAIM-C1-SOURCE-OWNERS',
      level: 'C1',
      statement: 'DSXU has named source owners for mainline, release, legacy, evidence, and delete-review rows.',
      evidence: ['DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.json'],
      publicAllowed: false,
      boundary: 'Source owner evidence is not a capability result.',
    },
    {
      id: 'V7-CLAIM-C3-REACHABILITY',
      level: 'C3',
      statement: `${r3} owner rows have R3/R4 reachability evidence.`,
      evidence: ['DSXU_RUNTIME_REACHABILITY_MAP_20260519.json'],
      publicAllowed: false,
      boundary: 'Internal capability candidate; public wording still needs live/raw evidence per claim.',
    },
    {
      id: 'V7-CLAIM-C4-LIVE-DEEPSEEK',
      level: 'C4',
      statement: `${live} replay cases require live DeepSeek evidence.`,
      evidence: ['DSXU_V6_LIVE_TOOL_CALL_REPLAY_20260519.json'],
      publicAllowed: live > 0,
      boundary: 'Allowed only as live provider/tool-call proof, not external benchmark or 90% score.',
    },
    {
      id: 'V7-CLAIM-C5-EXTERNAL-BENCHMARK',
      level: 'C5',
      statement: 'External comparable benchmark victory or 90%+ public claim.',
      evidence: [],
      publicAllowed: external > 0,
      boundary: 'Blocked until fixed manifest, paired target raw transcript, tool trace, cost/cache metrics, and rubric exist.',
    },
  ]
}

function renderMarkdown(report: ClaimBoundaryReport): string {
  return `# DSXU V7 Claim Boundary Gate - ${DATE}

- status: \`${report.status}\`

This gate separates source/design/internal/live/external benchmark claims. It blocks C3-below public claims and keeps public 90%/external victory blocked until paired raw benchmark evidence exists.

## Summary

| metric | value |
|---|---:|
| candidates | ${report.summary.candidates} |
| publicAllowed | ${report.summary.publicAllowed} |
| c3BelowPublicAllowed | ${report.summary.c3BelowPublicAllowed} |
| public90Allowed | ${report.summary.public90Allowed} |
| externalBenchmarkReady | ${report.summary.externalBenchmarkReady} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Candidates

| id | level | publicAllowed | boundary |
|---|---|---:|---|
${report.candidates.map(row => `| ${row.id} | ${row.level} | ${row.publicAllowed} | ${row.boundary} |`).join('\n')}
`
}

export async function buildClaimBoundaryGate(input: {
  reachabilityPath?: string
  replayBankPath?: string
  generatedAt?: string
} = {}): Promise<ClaimBoundaryReport> {
  const reachabilityPath = resolve(input.reachabilityPath ?? DEFAULT_REACHABILITY)
  const replayBankPath = resolve(input.replayBankPath ?? DEFAULT_REPLAY_BANK)
  if (!existsSync(reachabilityPath)) throw new Error(`missing reachability map: ${reachabilityPath}`)
  if (!existsSync(replayBankPath)) throw new Error(`missing replay bank: ${replayBankPath}`)
  const reachability = parseReachability(JSON.parse(await readFile(reachabilityPath, 'utf8')) as unknown)
  const replayCases = parseReplay(JSON.parse(await readFile(replayBankPath, 'utf8')) as unknown)
  const candidates = baseCandidates(reachability, replayCases)
  const c3BelowPublicAllowed = candidates.filter(row => ['C0', 'C1', 'C2'].includes(row.level) && row.publicAllowed).length
  const public90Allowed = candidates.some(row => row.id.includes('EXTERNAL') && row.publicAllowed)
  const externalBenchmarkReady = replayCases.some(row => row.replayLevel === 'external-benchmark' && row.publicBenchmarkClaimAllowed)
  const blockers: string[] = []
  if (c3BelowPublicAllowed > 0) blockers.push(`C3-below claims public allowed: ${c3BelowPublicAllowed}`)
  if (public90Allowed && !externalBenchmarkReady) blockers.push('public 90 claim allowed without external benchmark readiness')
  if (replayCases.some(row => row.replayLevel !== 'external-benchmark' && row.publicBenchmarkClaimAllowed)) {
    blockers.push('non-external replay case allowed as public benchmark claim')
  }
  return {
    schemaVersion: 'dsxu.v7.claim-boundary-gate.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_CLAIM_BOUNDARY_GATE'
      : 'BLOCKED_DSXU_CLAIM_BOUNDARY_GATE',
    sourceReachabilityPath: rel(reachabilityPath),
    sourceReplayBankPath: rel(replayBankPath),
    summary: {
      candidates: candidates.length,
      publicAllowed: candidates.filter(row => row.publicAllowed).length,
      c3BelowPublicAllowed,
      public90Allowed,
      externalBenchmarkReady,
    },
    blockers,
    candidates,
  }
}

async function main(): Promise<void> {
  const report = await buildClaimBoundaryGate()
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
