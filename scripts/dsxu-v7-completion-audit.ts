import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type AuditCheck = {
  id: string
  status: 'PASS' | 'BLOCKED'
  detail: string
}

type AuditReport = {
  schemaVersion: 'dsxu.v7.completion-audit.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_COMPLETION_AUDIT' | 'BLOCKED_DSXU_V7_COMPLETION_AUDIT'
  summary: {
    checks: number
    passed: number
    blocked: number
    workPackages: number
    scriptsPresent: number
    testsPresent: number
    reportsPresent: number
    v7InternalsClosed: boolean
    nonV7GatesRemaining: string[]
  }
  blockers: string[]
  checks: AuditCheck[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_COMPLETION_AUDIT_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_COMPLETION_AUDIT_${DATE}.md`)
const V7_DOC = join(ROOT, 'docs', `DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_${DATE}_CN.md`)

const WORK_PACKAGES = [
  {
    id: 'V7-01',
    name: 'Signal Extraction Registry',
    script: 'scripts/dsxu-doc-signal-extraction.ts',
    test: 'scripts/__tests__/dsxu-doc-signal-extraction.test.ts',
    json: `docs/generated/DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`,
    md: `docs/DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.md`,
  },
  {
    id: 'V7-02',
    name: 'Prompt Input Allowlist',
    script: 'scripts/dsxu-prompt-input-allowlist.ts',
    test: 'scripts/__tests__/dsxu-prompt-input-allowlist.test.ts',
    json: `docs/generated/DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.json`,
    md: `docs/DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.md`,
  },
  {
    id: 'V7-03',
    name: 'Runtime Reachability Map',
    script: 'scripts/dsxu-runtime-reachability-map.ts',
    test: 'scripts/__tests__/dsxu-runtime-reachability-map.test.ts',
    json: `docs/generated/DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`,
    md: `docs/DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.md`,
  },
  {
    id: 'V7-04',
    name: 'Archive Watchlist',
    script: 'scripts/dsxu-archive-watchlist.ts',
    test: 'scripts/__tests__/dsxu-archive-watchlist.test.ts',
    json: `docs/generated/DSXU_ARCHIVE_WATCHLIST_${DATE}.json`,
    md: `docs/DSXU_ARCHIVE_WATCHLIST_${DATE}.md`,
  },
  {
    id: 'V7-05',
    name: 'Delete Review Board',
    script: 'scripts/dsxu-delete-review-board.ts',
    test: 'scripts/__tests__/dsxu-delete-review-board.test.ts',
    json: `docs/generated/DSXU_DELETE_REVIEW_BOARD_${DATE}.json`,
    md: `docs/DSXU_DELETE_REVIEW_BOARD_${DATE}.md`,
  },
  {
    id: 'V7-06',
    name: 'Scenario Replay Bank',
    script: 'scripts/dsxu-scenario-replay-bank.ts',
    test: 'scripts/__tests__/dsxu-scenario-replay-bank.test.ts',
    json: `docs/generated/DSXU_SCENARIO_REPLAY_BANK_${DATE}.json`,
    md: `docs/DSXU_SCENARIO_REPLAY_BANK_${DATE}.md`,
  },
  {
    id: 'V7-07',
    name: 'Claim Boundary Gate',
    script: 'scripts/dsxu-claim-boundary-gate.ts',
    test: 'scripts/__tests__/dsxu-claim-boundary-gate.test.ts',
    json: `docs/generated/DSXU_CLAIM_BOUNDARY_GATE_${DATE}.json`,
    md: `docs/DSXU_CLAIM_BOUNDARY_GATE_${DATE}.md`,
  },
  {
    id: 'V7-08',
    name: 'Safety Gate',
    script: 'scripts/dsxu-v7-safety-gate.ts',
    test: 'scripts/__tests__/dsxu-v7-safety-gate.test.ts',
    json: `docs/generated/DSXU_V7_SAFETY_GATE_${DATE}.json`,
    md: `docs/DSXU_V7_SAFETY_GATE_${DATE}.md`,
  },
  {
    id: 'V7-09',
    name: 'Owner Focused Evidence',
    script: 'scripts/dsxu-v7-owner-focused-evidence.ts',
    test: 'scripts/__tests__/dsxu-v7-owner-focused-evidence.test.ts',
    json: `docs/generated/DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.json`,
    md: `docs/DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.md`,
  },
  {
    id: 'V7-10',
    name: 'Remaining Evidence Queue',
    script: 'scripts/dsxu-v7-remaining-evidence-queue.ts',
    test: 'scripts/__tests__/dsxu-v7-remaining-evidence-queue.test.ts',
    json: `docs/generated/DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.json`,
    md: `docs/DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.md`,
  },
  {
    id: 'V7-11',
    name: 'Delete Review Replacement Evidence',
    script: 'scripts/dsxu-v7-delete-review-replacement-evidence.ts',
    test: 'scripts/__tests__/dsxu-v7-delete-review-replacement-evidence.test.ts',
    json: `docs/generated/DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.json`,
    md: `docs/DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.md`,
  },
  {
    id: 'V7-12',
    name: 'Scenario Replay Layer Evidence',
    script: 'scripts/dsxu-v7-scenario-replay-layer-evidence.ts',
    test: 'scripts/__tests__/dsxu-v7-scenario-replay-layer-evidence.test.ts',
    json: `docs/generated/DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.json`,
    md: `docs/DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.md`,
  },
  {
    id: 'V7-13',
    name: 'Final Closure Board',
    script: 'scripts/dsxu-v7-final-closure-board.ts',
    test: 'scripts/__tests__/dsxu-v7-final-closure-board.test.ts',
    json: `docs/generated/DSXU_V7_FINAL_CLOSURE_BOARD_${DATE}.json`,
    md: `docs/DSXU_V7_FINAL_CLOSURE_BOARD_${DATE}.md`,
  },
]

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function has(path: string): boolean {
  return existsSync(resolve(ROOT, path))
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(ROOT, path), 'utf8')) as Record<string, unknown>
}

function numberAt(report: Record<string, unknown>, path: string[]): number {
  let value: unknown = report
  for (const key of path) {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  }
  return Number(value ?? 0)
}

function boolAt(report: Record<string, unknown>, path: string[]): boolean {
  let value: unknown = report
  for (const key of path) {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  }
  return value === true
}

function statusOf(report: Record<string, unknown>): string {
  return String(report.status ?? '')
}

function check(id: string, condition: boolean, detail: string): AuditCheck {
  return {
    id,
    status: condition ? 'PASS' : 'BLOCKED',
    detail,
  }
}

function renderMarkdown(report: AuditReport): string {
  return `# DSXU V7 Completion Audit - ${DATE}

- status: \`${report.status}\`

This is an independent V7 completion audit. It checks the V7 promise surface from documents, scripts, tests, generated reports, closure gates, and stale-next-action risk. It does not delete, move, stage, commit, clean files, or create product runtime.

## Summary

| metric | value |
|---|---:|
| checks | ${report.summary.checks} |
| passed | ${report.summary.passed} |
| blocked | ${report.summary.blocked} |
| workPackages | ${report.summary.workPackages} |
| scriptsPresent | ${report.summary.scriptsPresent} |
| testsPresent | ${report.summary.testsPresent} |
| reportsPresent | ${report.summary.reportsPresent} |
| v7InternalsClosed | ${report.summary.v7InternalsClosed} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Checks

| id | status | detail |
|---|---|---|
${report.checks.map(row => `| ${row.id} | ${row.status} | ${row.detail} |`).join('\n')}

## Non-V7 Gates Still Remaining

${report.summary.nonV7GatesRemaining.map(item => `- ${item}`).join('\n')}
`
}

export async function buildV7CompletionAudit(input: {
  generatedAt?: string
} = {}): Promise<AuditReport> {
  const scriptsPresent = WORK_PACKAGES.filter(item => has(item.script)).length
  const testsPresent = WORK_PACKAGES.filter(item => has(item.test)).length
  const reportsPresent = WORK_PACKAGES.filter(item => has(item.json) && has(item.md)).length
  const docText = await readFile(V7_DOC, 'utf8')
  const safetyGate = await readJson(`docs/generated/DSXU_V7_SAFETY_GATE_${DATE}.json`)
  const finalClosure = await readJson(`docs/generated/DSXU_V7_FINAL_CLOSURE_BOARD_${DATE}.json`)
  const replayLayer = await readJson(`docs/generated/DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.json`)
  const deleteReplacement = await readJson(`docs/generated/DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.json`)
  const promptAllowlist = await readJson(`docs/generated/DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.json`)
  const ownerQueue = await readJson(`docs/generated/DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.json`)

  const checks: AuditCheck[] = [
    check(
      'v7-doc-has-all-final-sections',
      ['### 12.7', '### 12.8', '### 12.9', '### 12.10'].every(section => docText.includes(section)),
      'requires execution records for owner evidence, delete-review replacement, scenario replay layer, and final closure',
    ),
    check(
      'v7-doc-no-stale-internal-next-action',
      !docText.includes('下一步如果继续 V7，应优先处理 delete-review observe 和 scenario replay 分层执行'),
      'old next-action text must be replaced after 12.8/12.9 completion',
    ),
    check(
      'v7-work-package-files-complete',
      scriptsPresent === WORK_PACKAGES.length && testsPresent === WORK_PACKAGES.length && reportsPresent === WORK_PACKAGES.length,
      `scripts=${scriptsPresent}/${WORK_PACKAGES.length}, tests=${testsPresent}/${WORK_PACKAGES.length}, reports=${reportsPresent}/${WORK_PACKAGES.length}`,
    ),
    check(
      'v7-safety-gate-independent-pass',
      statusOf(safetyGate) === 'PASS_DSXU_V7_SAFETY_GATE' &&
        numberAt(safetyGate, ['summary', 'checks']) === 14 &&
        numberAt(safetyGate, ['summary', 'blocked']) === 0,
      `status=${statusOf(safetyGate)}, checks=${numberAt(safetyGate, ['summary', 'checks'])}, blocked=${numberAt(safetyGate, ['summary', 'blocked'])}`,
    ),
    check(
      'v7-final-closure-independent-pass',
      statusOf(finalClosure) === 'PASS_DSXU_V7_FINAL_CLOSURE_BOARD' &&
        numberAt(finalClosure, ['summary', 'checks']) === 8 &&
        numberAt(finalClosure, ['summary', 'blocked']) === 0,
      `status=${statusOf(finalClosure)}, checks=${numberAt(finalClosure, ['summary', 'checks'])}, blocked=${numberAt(finalClosure, ['summary', 'blocked'])}`,
    ),
    check(
      'v7-public-delete-prompt-still-blocked',
      boolAt(finalClosure, ['summary', 'publicBenchmarkAllowed']) === false &&
        boolAt(finalClosure, ['summary', 'deletionAllowed']) === false &&
        boolAt(finalClosure, ['summary', 'promptHistoricalRawAllowed']) === false &&
        numberAt(promptAllowlist, ['summary', 'deleteReviewPromptItems']) === 0,
      `publicBenchmarkAllowed=${boolAt(finalClosure, ['summary', 'publicBenchmarkAllowed'])}, deletionAllowed=${boolAt(finalClosure, ['summary', 'deletionAllowed'])}, promptHistoricalRawAllowed=${boolAt(finalClosure, ['summary', 'promptHistoricalRawAllowed'])}, deleteReviewPromptItems=${numberAt(promptAllowlist, ['summary', 'deleteReviewPromptItems'])}`,
    ),
    check(
      'v7-owner-delete-replay-queues-closed',
      numberAt(ownerQueue, ['summary', 'needsFocusedOwnerTest']) === 0 &&
        numberAt(deleteReplacement, ['summary', 'deleteReadyRows']) === 0 &&
        numberAt(deleteReplacement, ['summary', 'mutationAllowedRows']) === 0 &&
        numberAt(replayLayer, ['summary', 'publicClaimReadyRows']) === 0,
      `needsFocusedOwnerTest=${numberAt(ownerQueue, ['summary', 'needsFocusedOwnerTest'])}, deleteReady=${numberAt(deleteReplacement, ['summary', 'deleteReadyRows'])}, mutationAllowed=${numberAt(deleteReplacement, ['summary', 'mutationAllowedRows'])}, replayPublicClaimReady=${numberAt(replayLayer, ['summary', 'publicClaimReadyRows'])}`,
    ),
    check(
      'v7-replay-layer-contracts-exact',
      numberAt(replayLayer, ['summary', 'rows']) === 300 &&
        numberAt(replayLayer, ['summary', 'mockContractPassRows']) === numberAt(replayLayer, ['summary', 'mockRows']) &&
        numberAt(replayLayer, ['summary', 'externalBenchmarkBlockedRows']) === 49 &&
        numberAt(replayLayer, ['summary', 'missingSourceDocRows']) === 0,
      `rows=${numberAt(replayLayer, ['summary', 'rows'])}, mock=${numberAt(replayLayer, ['summary', 'mockContractPassRows'])}/${numberAt(replayLayer, ['summary', 'mockRows'])}, externalBlocked=${numberAt(replayLayer, ['summary', 'externalBenchmarkBlockedRows'])}, missingSourceDocRows=${numberAt(replayLayer, ['summary', 'missingSourceDocRows'])}`,
    ),
  ]

  const blockers = checks.filter(row => row.status === 'BLOCKED').map(row => `${row.id}: ${row.detail}`)
  const nonV7GatesRemaining = [
    'external/public benchmark paired raw evidence',
    'owner/Git signoff plus explicit user approval before delete mutation',
    'release preflight / secret scan / fresh install / clean export',
    'live DeepSeek provider evidence before live-provider public claim',
  ]
  return {
    schemaVersion: 'dsxu.v7.completion-audit.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_COMPLETION_AUDIT'
      : 'BLOCKED_DSXU_V7_COMPLETION_AUDIT',
    summary: {
      checks: checks.length,
      passed: checks.filter(row => row.status === 'PASS').length,
      blocked: checks.filter(row => row.status === 'BLOCKED').length,
      workPackages: WORK_PACKAGES.length,
      scriptsPresent,
      testsPresent,
      reportsPresent,
      v7InternalsClosed: blockers.length === 0,
      nonV7GatesRemaining,
    },
    blockers,
    checks,
  }
}

async function main(): Promise<void> {
  const report = await buildV7CompletionAudit()
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
