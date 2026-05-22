import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type OwnerDecisionRow = {
  path: string
  owner: string
  decision: string
  activeImportCount: number
  docReferenceCount: number
}

type DeleteReviewRow = {
  path: string
  owner: string
  replacementOwner: string
  replacementEvidence: string[]
  reverseScanEvidence: string
  requiredTests: string[]
  ownerSignoff: false
  userDeletionApproval: false
  deleteReady: false
  status: 'observe' | 'blocked'
  blockers: string[]
}

type DeleteReviewReport = {
  schemaVersion: 'dsxu.v7.delete-review-board.v1'
  generatedAt: string
  status: 'PASS_DSXU_DELETE_REVIEW_BOARD' | 'BLOCKED_DSXU_DELETE_REVIEW_BOARD'
  sourceOwnerDecisionPath: string
  summary: {
    deleteReviewRows: number
    observeRows: number
    blockedRows: number
    deleteReadyRows: number
    ownerSignoffRows: number
    userDeletionApprovalRows: number
  }
  blockers: string[]
  rows: DeleteReviewRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_OWNER_DECISIONS = join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_DELETE_REVIEW_BOARD_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_DELETE_REVIEW_BOARD_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseRows(raw: unknown): OwnerDecisionRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): OwnerDecisionRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? ''),
      decision: String(row.decision ?? ''),
      activeImportCount: Number(row.activeImportCount ?? 0),
      docReferenceCount: Number(row.docReferenceCount ?? 0),
    }
  }).filter(row => row.path)
}

function replacementFor(path: string): { owner: string; evidence: string[]; tests: string[]; reverseScan: string } {
  if (path.startsWith('src/commands/bridge') || path === 'src/commands/bridge-kick.ts') {
    return {
      owner: 'DSXU Provider Alias / Provider Contract',
      evidence: [
        'src/dsxu/engine/provider-alias.ts',
        'src/dsxu/engine/provider-contract.ts',
        'src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
      ],
      tests: ['bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts'],
      reverseScan: 'rg "bridge-kick|commands/bridge|handleDsxuProviderAliasCommand" src scripts package.json',
    }
  }
  if (path === 'src/commands/commit.ts' || path === 'src/commands/commit-push-pr.ts') {
    return {
      owner: 'DSXU Git Delivery Command Owner',
      evidence: [
        'src/commands/dsxu-commit.ts',
        'src/commands/dsxu-commit-push-pr.ts',
        'src/commands.ts',
      ],
      tests: ['bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts'],
      reverseScan: 'rg "commands/commit\\.ts|commands/commit-push-pr\\.ts|dsxu-commit" src scripts package.json',
    }
  }
  if (path.startsWith('src/coordinator/dag/')) {
    return {
      owner: 'PlanGraph / Work-State Owner',
      evidence: [
        'src/dsxu/engine/work-state-timeline.ts',
        'src/dsxu/engine/progress-ledger.ts',
        'src/dsxu/engine/__tests__/work-state-timeline.test.ts',
      ],
      tests: [
        'bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts',
      ],
      reverseScan: 'rg "coordinator/dag|planExecuteVerifyDag|PersistentDagRunner|runDag" src scripts package.json',
    }
  }
  if (path.startsWith('src/services/swe-bench/')) {
    return {
      owner: 'Evidence / Eval SWE Owner',
      evidence: [
        'src/services/eval/swe-bench/index.ts',
        'src/services/eval/swe-bench/runner.ts',
        'src/services/eval/swe-bench/contract.ts',
      ],
      tests: [
        'bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts',
      ],
      reverseScan: 'rg "../swe-bench|src/services/swe-bench|SWEBenchRunner|createSWEBenchRunner" src scripts package.json',
    }
  }
  return {
    owner: 'Owner Review Queue',
    evidence: [],
    tests: [],
    reverseScan: `rg "${path}" src scripts package.json`,
  }
}

function rowFor(input: OwnerDecisionRow): DeleteReviewRow {
  const replacement = replacementFor(input.path)
  const blockers = [
    'owner signoff missing',
    'user deletion approval missing',
  ]
  if (replacement.evidence.length === 0) blockers.push('replacement evidence missing')
  return {
    path: input.path,
    owner: input.owner,
    replacementOwner: replacement.owner,
    replacementEvidence: replacement.evidence,
    reverseScanEvidence: replacement.reverseScan,
    requiredTests: replacement.tests,
    ownerSignoff: false,
    userDeletionApproval: false,
    deleteReady: false,
    status: blockers.some(blocker => blocker.includes('replacement evidence')) ? 'blocked' : 'observe',
    blockers,
  }
}

function renderMarkdown(report: DeleteReviewReport): string {
  return `# DSXU V7 Delete Review Board - ${DATE}

- status: \`${report.status}\`

This board handles delete-review candidates by observation only. It does not delete, move, stage, commit, or clean files.

## Summary

| metric | value |
|---|---:|
| deleteReviewRows | ${report.summary.deleteReviewRows} |
| observeRows | ${report.summary.observeRows} |
| blockedRows | ${report.summary.blockedRows} |
| deleteReadyRows | ${report.summary.deleteReadyRows} |
| ownerSignoffRows | ${report.summary.ownerSignoffRows} |
| userDeletionApprovalRows | ${report.summary.userDeletionApprovalRows} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Rows

| path | replacementOwner | status | deleteReady |
|---|---|---|---:|
${report.rows.map(row => `| \`${row.path}\` | ${row.replacementOwner} | ${row.status} | ${row.deleteReady} |`).join('\n')}
`
}

export async function buildDeleteReviewBoard(input: {
  ownerDecisionPath?: string
  generatedAt?: string
} = {}): Promise<DeleteReviewReport> {
  const ownerDecisionPath = resolve(input.ownerDecisionPath ?? DEFAULT_OWNER_DECISIONS)
  if (!existsSync(ownerDecisionPath)) throw new Error(`missing owner decision report: ${ownerDecisionPath}`)
  const rows = parseRows(JSON.parse(await readFile(ownerDecisionPath, 'utf8')) as unknown)
    .filter(row => row.decision === 'delete-review')
    .map(rowFor)
  const blockers: string[] = []
  if (rows.length === 0) blockers.push('no delete-review rows found')
  if (rows.some(row => row.deleteReady)) blockers.push('V7 must not mark any row delete-ready without owner/user approval')
  if (rows.some(row => row.ownerSignoff || row.userDeletionApproval)) blockers.push('V7 cannot synthesize owner signoff or user deletion approval')
  const blockedRows = rows.filter(row => row.status === 'blocked').length
  return {
    schemaVersion: 'dsxu.v7.delete-review-board.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_DELETE_REVIEW_BOARD'
      : 'BLOCKED_DSXU_DELETE_REVIEW_BOARD',
    sourceOwnerDecisionPath: rel(ownerDecisionPath),
    summary: {
      deleteReviewRows: rows.length,
      observeRows: rows.filter(row => row.status === 'observe').length,
      blockedRows,
      deleteReadyRows: rows.filter(row => row.deleteReady).length,
      ownerSignoffRows: rows.filter(row => row.ownerSignoff).length,
      userDeletionApprovalRows: rows.filter(row => row.userDeletionApproval).length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildDeleteReviewBoard()
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
