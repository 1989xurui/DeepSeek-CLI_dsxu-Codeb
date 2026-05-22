import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ClosureCheck = {
  id: string
  status: 'PASS' | 'BLOCKED'
  detail: string
}

type ClosureReport = {
  schemaVersion: 'dsxu.v7.final-closure-board.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_FINAL_CLOSURE_BOARD' | 'BLOCKED_DSXU_V7_FINAL_CLOSURE_BOARD'
  summary: {
    checks: number
    passed: number
    blocked: number
    publicBenchmarkAllowed: false
    deletionAllowed: false
    promptHistoricalRawAllowed: false
    safetyGatePassed: boolean
  }
  blockers: string[]
  inputs: Record<string, string>
  checks: ClosureCheck[]
  nextNonV7Gates: string[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_FINAL_CLOSURE_BOARD_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_FINAL_CLOSURE_BOARD_${DATE}.md`)

const DEFAULT_INPUTS = {
  docsRegistry: join(GENERATED_DIR, `DSXU_DOCS_TRUTH_REGISTRY_${DATE}.json`),
  signals: join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`),
  promptAllowlist: join(GENERATED_DIR, `DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.json`),
  reachability: join(GENERATED_DIR, `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`),
  archiveWatchlist: join(GENERATED_DIR, `DSXU_ARCHIVE_WATCHLIST_${DATE}.json`),
  deleteReview: join(GENERATED_DIR, `DSXU_DELETE_REVIEW_BOARD_${DATE}.json`),
  deleteReviewReplacementEvidence: join(GENERATED_DIR, `DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.json`),
  replayBank: join(GENERATED_DIR, `DSXU_SCENARIO_REPLAY_BANK_${DATE}.json`),
  replayLayerEvidence: join(GENERATED_DIR, `DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE_${DATE}.json`),
  claimBoundary: join(GENERATED_DIR, `DSXU_CLAIM_BOUNDARY_GATE_${DATE}.json`),
  ownerFocusedEvidence: join(GENERATED_DIR, `DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.json`),
  remainingEvidenceQueue: join(GENERATED_DIR, `DSXU_V7_REMAINING_EVIDENCE_QUEUE_${DATE}.json`),
  ownerDecisions: join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.json`),
  safetyGate: join(GENERATED_DIR, `DSXU_V7_SAFETY_GATE_${DATE}.json`),
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const resolved = resolve(path)
  if (!existsSync(resolved)) throw new Error(`missing V7 closure input: ${resolved}`)
  return JSON.parse(await readFile(resolved, 'utf8')) as Record<string, unknown>
}

function getNumber(report: Record<string, unknown>, path: string[]): number {
  let value: unknown = report
  for (const key of path) {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  }
  return Number(value ?? 0)
}

function getBoolean(report: Record<string, unknown>, path: string[]): boolean {
  let value: unknown = report
  for (const key of path) {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  }
  return value === true
}

function getStatus(report: Record<string, unknown>): string {
  return String(report.status ?? '')
}

function check(id: string, condition: boolean, detail: string): ClosureCheck {
  return {
    id,
    status: condition ? 'PASS' : 'BLOCKED',
    detail,
  }
}

function renderMarkdown(report: ClosureReport): string {
  return `# DSXU V7 Final Closure Board - ${DATE}

- status: \`${report.status}\`

This board closes V7 safe consolidation as an evidence/control-plane milestone. It does not delete files, does not create release artifacts, does not claim public benchmark readiness, and does not change product runtime.

## Summary

| metric | value |
|---|---:|
| checks | ${report.summary.checks} |
| passed | ${report.summary.passed} |
| blocked | ${report.summary.blocked} |
| safetyGatePassed | ${report.summary.safetyGatePassed} |
| publicBenchmarkAllowed | ${report.summary.publicBenchmarkAllowed} |
| deletionAllowed | ${report.summary.deletionAllowed} |
| promptHistoricalRawAllowed | ${report.summary.promptHistoricalRawAllowed} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Checks

| id | status | detail |
|---|---|---|
${report.checks.map(row => `| ${row.id} | ${row.status} | ${row.detail} |`).join('\n')}

## Next Non-V7 Gates

${report.nextNonV7Gates.map(item => `- ${item}`).join('\n')}
`
}

export async function buildV7FinalClosureBoard(input: {
  paths?: Partial<typeof DEFAULT_INPUTS>
  generatedAt?: string
} = {}): Promise<ClosureReport> {
  const paths = { ...DEFAULT_INPUTS, ...(input.paths ?? {}) }
  const docsRegistry = await readJson(paths.docsRegistry)
  const signals = await readJson(paths.signals)
  const promptAllowlist = await readJson(paths.promptAllowlist)
  const reachability = await readJson(paths.reachability)
  const archiveWatchlist = await readJson(paths.archiveWatchlist)
  const deleteReview = await readJson(paths.deleteReview)
  const deleteReviewReplacementEvidence = await readJson(paths.deleteReviewReplacementEvidence)
  const replayBank = await readJson(paths.replayBank)
  const replayLayerEvidence = await readJson(paths.replayLayerEvidence)
  const claimBoundary = await readJson(paths.claimBoundary)
  const ownerFocusedEvidence = await readJson(paths.ownerFocusedEvidence)
  const remainingEvidenceQueue = await readJson(paths.remainingEvidenceQueue)
  const ownerDecisions = await readJson(paths.ownerDecisions)
  const safetyGate = await readJson(paths.safetyGate)

  const ownerRows = Array.isArray(ownerDecisions.rows) ? ownerDecisions.rows : []
  const expectedOwnerRows = getNumber(ownerDecisions, ['summary', 'reviewedUnclassifiedRows'])
  const expectedDeleteReviewRows = getNumber(ownerDecisions, ['summary', 'deleteReview'])
  const checks: ClosureCheck[] = [
    check(
      'all-required-reports-present',
      Object.values(paths).every(path => existsSync(resolve(path))),
      `inputs=${Object.keys(paths).length}`,
    ),
    check(
      'docs-and-signals-classified',
      getNumber(docsRegistry, ['summary', 'fileCount']) >= 397 &&
        getNumber(signals, ['summary', 'p0DocCount']) === getNumber(signals, ['summary', 'p0DocsWithSignals']),
      `docs=${getNumber(docsRegistry, ['summary', 'fileCount'])}, p0Signals=${getNumber(signals, ['summary', 'p0DocsWithSignals'])}/${getNumber(signals, ['summary', 'p0DocCount'])}`,
    ),
    check(
      'owner-review-closed',
      ownerRows.length === expectedOwnerRows &&
        getNumber(ownerDecisions, ['summary', 'remainingClassifyBeforeClaim']) === 0,
      `ownerRows=${ownerRows.length}/${expectedOwnerRows}, remaining=${getNumber(ownerDecisions, ['summary', 'remainingClassifyBeforeClaim'])}`,
    ),
    check(
      'prompt-historical-and-delete-review-blocked',
      getNumber(promptAllowlist, ['summary', 'deleteReviewPromptItems']) === 0 &&
        getNumber(promptAllowlist, ['summary', 'generatedHistoricalRawDocs']) === 0 &&
        getNumber(promptAllowlist, ['summary', 'supersededPlanRawDocs']) === 0,
      `deleteReviewPromptItems=${getNumber(promptAllowlist, ['summary', 'deleteReviewPromptItems'])}, generatedHistoricalRawDocs=${getNumber(promptAllowlist, ['summary', 'generatedHistoricalRawDocs'])}, supersededPlanRawDocs=${getNumber(promptAllowlist, ['summary', 'supersededPlanRawDocs'])}`,
    ),
    check(
      'mainline-owner-focused-evidence-closed',
      getNumber(remainingEvidenceQueue, ['summary', 'totalRows']) === getNumber(reachability, ['summary', 'mainlineOwnerRows']) &&
        getNumber(remainingEvidenceQueue, ['summary', 'needsFocusedOwnerTest']) === 0 &&
        getNumber(ownerFocusedEvidence, ['summary', 'failed']) === 0,
      `rows=${getNumber(remainingEvidenceQueue, ['summary', 'totalRows'])}/${getNumber(reachability, ['summary', 'mainlineOwnerRows'])}, needsFocusedOwnerTest=${getNumber(remainingEvidenceQueue, ['summary', 'needsFocusedOwnerTest'])}, focusedFailed=${getNumber(ownerFocusedEvidence, ['summary', 'failed'])}`,
    ),
    check(
      'archive-and-delete-remain-observe-only',
      getNumber(archiveWatchlist, ['summary', 'deleteNow']) === 0 &&
        getNumber(deleteReview, ['summary', 'deleteReviewRows']) === expectedDeleteReviewRows &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'deleteReadyRows']) === 0 &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'mutationAllowedRows']) === 0,
      `archiveDeleteNow=${getNumber(archiveWatchlist, ['summary', 'deleteNow'])}, deleteRows=${getNumber(deleteReview, ['summary', 'deleteReviewRows'])}/${expectedDeleteReviewRows}, deleteReady=${getNumber(deleteReviewReplacementEvidence, ['summary', 'deleteReadyRows'])}, mutationAllowed=${getNumber(deleteReviewReplacementEvidence, ['summary', 'mutationAllowedRows'])}`,
    ),
    check(
      'scenario-replay-layered-and-claim-blocked',
      getNumber(replayLayerEvidence, ['summary', 'rows']) === getNumber(replayBank, ['summary', 'totalCases']) &&
        getNumber(replayLayerEvidence, ['summary', 'mockContractPassRows']) === getNumber(replayLayerEvidence, ['summary', 'mockRows']) &&
        getNumber(replayLayerEvidence, ['summary', 'externalBenchmarkBlockedRows']) === getNumber(replayBank, ['summary', 'external-benchmark']) &&
        getNumber(replayLayerEvidence, ['summary', 'publicClaimReadyRows']) === 0,
      `rows=${getNumber(replayLayerEvidence, ['summary', 'rows'])}/${getNumber(replayBank, ['summary', 'totalCases'])}, mock=${getNumber(replayLayerEvidence, ['summary', 'mockContractPassRows'])}/${getNumber(replayLayerEvidence, ['summary', 'mockRows'])}, externalBlocked=${getNumber(replayLayerEvidence, ['summary', 'externalBenchmarkBlockedRows'])}/${getNumber(replayBank, ['summary', 'external-benchmark'])}, publicClaimReady=${getNumber(replayLayerEvidence, ['summary', 'publicClaimReadyRows'])}`,
    ),
    check(
      'claim-boundary-and-safety-gate-pass',
      getNumber(claimBoundary, ['summary', 'c3BelowPublicAllowed']) === 0 &&
        getBoolean(claimBoundary, ['summary', 'public90Allowed']) === false &&
        getStatus(safetyGate) === 'PASS_DSXU_V7_SAFETY_GATE' &&
        getNumber(safetyGate, ['summary', 'blocked']) === 0,
      `c3Below=${getNumber(claimBoundary, ['summary', 'c3BelowPublicAllowed'])}, public90=${getBoolean(claimBoundary, ['summary', 'public90Allowed'])}, safety=${getStatus(safetyGate)}, safetyBlocked=${getNumber(safetyGate, ['summary', 'blocked'])}`,
    ),
  ]

  const blockers = checks.filter(row => row.status === 'BLOCKED').map(row => `${row.id}: ${row.detail}`)
  return {
    schemaVersion: 'dsxu.v7.final-closure-board.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_FINAL_CLOSURE_BOARD'
      : 'BLOCKED_DSXU_V7_FINAL_CLOSURE_BOARD',
    summary: {
      checks: checks.length,
      passed: checks.filter(row => row.status === 'PASS').length,
      blocked: checks.filter(row => row.status === 'BLOCKED').length,
      publicBenchmarkAllowed: false,
      deletionAllowed: false,
      promptHistoricalRawAllowed: false,
      safetyGatePassed: getStatus(safetyGate) === 'PASS_DSXU_V7_SAFETY_GATE',
    },
    blockers,
    inputs: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, rel(value)])),
    checks,
    nextNonV7Gates: [
      'external benchmark/public claim still requires fixed manifest plus paired target raw transcript, tool trace, final report, artifacts, metrics, and risks',
      'delete-review mutation still requires owner/Git signoff and explicit user deletion approval',
      'release/clean export still requires final release preflight, secret scan, fresh install smoke, and current git owner review',
      'live-provider claims still require explicit DeepSeek live evidence with redacted raw logs',
    ],
  }
}

async function main(): Promise<void> {
  const report = await buildV7FinalClosureBoard()
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
