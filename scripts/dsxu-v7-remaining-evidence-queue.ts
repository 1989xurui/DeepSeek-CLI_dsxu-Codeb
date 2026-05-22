import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ReachabilityRow = {
  path: string
  owner: string
  capability: string
  reachability: string
  publicClaimAllowed: boolean
  verificationCommand: string
}

type FocusedCommand = {
  command: string
  status: 'PASS' | 'FAIL'
}

type QueueRow = {
  path: string
  owner: string
  capability: string
  reachability: string
  status: 'covered-by-focused-evidence' | 'needs-focused-owner-test' | 'needs-live-or-replay-evidence'
  priority: 'P0' | 'P1' | 'P2'
  publicClaimAllowed: false
  nextAction: string
}

type RemainingEvidenceQueueReport = {
  schemaVersion: 'dsxu.v7.remaining-evidence-queue.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_REMAINING_EVIDENCE_QUEUE' | 'BLOCKED_DSXU_V7_REMAINING_EVIDENCE_QUEUE'
  sourceReachabilityPath: string
  sourceFocusedEvidencePath: string
  summary: {
    totalRows: number
    coveredByFocusedEvidence: number
    needsFocusedOwnerTest: number
    needsLiveOrReplayEvidence: number
    publicClaimAllowedRows: number
    p0PendingRows: number
  }
  blockers: string[]
  rows: QueueRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REACHABILITY = join(GENERATED_DIR, `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`)
const DEFAULT_FOCUSED = join(GENERATED_DIR, `DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.md`)

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
      capability: String(row.capability ?? ''),
      reachability: String(row.reachability ?? ''),
      publicClaimAllowed: row.publicClaimAllowed === true,
      verificationCommand: String(row.verificationCommand ?? ''),
    }
  }).filter(row => row.path)
}

function parseFocused(raw: unknown): FocusedCommand[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.commands) ? report.commands : []
  return rows.map((item): FocusedCommand => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      command: String(row.command ?? ''),
      status: row.status === 'PASS' ? 'PASS' : 'FAIL',
    }
  }).filter(row => row.command)
}

function priorityFor(row: ReachabilityRow): 'P0' | 'P1' | 'P2' {
  const text = `${row.owner} ${row.path} ${row.capability}`.toLowerCase()
  if (/query|tool|deepseek|provider|permission|recovery|verification|runtime|control/.test(text)) return 'P0'
  if (/memory|graph|context|ledger|agent|mcp|skill/.test(text)) return 'P1'
  return 'P2'
}

function rowStatus(row: ReachabilityRow, passedCommands: Set<string>): QueueRow['status'] {
  if (passedCommands.has(row.verificationCommand)) return 'covered-by-focused-evidence'
  if (!row.verificationCommand || row.verificationCommand === 'needs focused owner test before claim') return 'needs-focused-owner-test'
  return 'needs-live-or-replay-evidence'
}

function nextAction(row: ReachabilityRow, status: QueueRow['status']): string {
  if (status === 'covered-by-focused-evidence') {
    return 'Keep as internal owner evidence; do not promote to public claim without live/replay evidence.'
  }
  if (status === 'needs-live-or-replay-evidence') {
    return `Run or create focused evidence for existing command: ${row.verificationCommand}.`
  }
  return 'Create or map a focused owner test command before this row can leave R2/internal-only status.'
}

function renderMarkdown(report: RemainingEvidenceQueueReport): string {
  return `# DSXU V7 Remaining Evidence Queue - ${DATE}

- status: \`${report.status}\`

This queue separates mainline-owner rows already covered by focused owner evidence from rows that still need focused owner tests or live/replay evidence. It is not a delete queue and does not allow public claims.

## Summary

| metric | value |
|---|---:|
| totalRows | ${report.summary.totalRows} |
| coveredByFocusedEvidence | ${report.summary.coveredByFocusedEvidence} |
| needsFocusedOwnerTest | ${report.summary.needsFocusedOwnerTest} |
| needsLiveOrReplayEvidence | ${report.summary.needsLiveOrReplayEvidence} |
| p0PendingRows | ${report.summary.p0PendingRows} |
| publicClaimAllowedRows | ${report.summary.publicClaimAllowedRows} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Pending P0 Rows

| path | owner | status | nextAction |
|---|---|---|---|
${report.rows.filter(row => row.priority === 'P0' && row.status !== 'covered-by-focused-evidence').slice(0, 80).map(row => `| \`${row.path}\` | ${row.owner} | ${row.status} | ${row.nextAction} |`).join('\n')}
`
}

export async function buildRemainingEvidenceQueue(input: {
  reachabilityPath?: string
  focusedEvidencePath?: string
  generatedAt?: string
} = {}): Promise<RemainingEvidenceQueueReport> {
  const reachabilityPath = resolve(input.reachabilityPath ?? DEFAULT_REACHABILITY)
  const focusedEvidencePath = resolve(input.focusedEvidencePath ?? DEFAULT_FOCUSED)
  if (!existsSync(reachabilityPath)) throw new Error(`missing runtime reachability map: ${reachabilityPath}`)
  if (!existsSync(focusedEvidencePath)) throw new Error(`missing owner focused evidence: ${focusedEvidencePath}`)
  const reachabilityRows = parseReachability(JSON.parse(await readFile(reachabilityPath, 'utf8')) as unknown)
  const passedCommands = new Set(parseFocused(JSON.parse(await readFile(focusedEvidencePath, 'utf8')) as unknown)
    .filter(command => command.status === 'PASS')
    .map(command => command.command))

  const rows = reachabilityRows.map((row): QueueRow => {
    const status = rowStatus(row, passedCommands)
    return {
      path: row.path,
      owner: row.owner,
      capability: row.capability,
      reachability: row.reachability,
      status,
      priority: priorityFor(row),
      publicClaimAllowed: false,
      nextAction: nextAction(row, status),
    }
  })
  const blockers: string[] = []
  if (rows.some(row => row.publicClaimAllowed)) blockers.push('remaining evidence queue must not allow public claims')
  return {
    schemaVersion: 'dsxu.v7.remaining-evidence-queue.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_REMAINING_EVIDENCE_QUEUE'
      : 'BLOCKED_DSXU_V7_REMAINING_EVIDENCE_QUEUE',
    sourceReachabilityPath: rel(reachabilityPath),
    sourceFocusedEvidencePath: rel(focusedEvidencePath),
    summary: {
      totalRows: rows.length,
      coveredByFocusedEvidence: rows.filter(row => row.status === 'covered-by-focused-evidence').length,
      needsFocusedOwnerTest: rows.filter(row => row.status === 'needs-focused-owner-test').length,
      needsLiveOrReplayEvidence: rows.filter(row => row.status === 'needs-live-or-replay-evidence').length,
      publicClaimAllowedRows: rows.filter(row => row.publicClaimAllowed).length,
      p0PendingRows: rows.filter(row => row.priority === 'P0' && row.status !== 'covered-by-focused-evidence').length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildRemainingEvidenceQueue()
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
