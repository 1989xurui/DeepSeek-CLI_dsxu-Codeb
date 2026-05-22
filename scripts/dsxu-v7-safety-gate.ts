import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type SafetyCheck = {
  id: string
  status: 'PASS' | 'BLOCKED'
  detail: string
}

type SafetyReport = {
  schemaVersion: 'dsxu.v7.safety-gate.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_SAFETY_GATE' | 'BLOCKED_DSXU_V7_SAFETY_GATE'
  summary: {
    checks: number
    passed: number
    blocked: number
  }
  blockers: string[]
  checks: SafetyCheck[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_SAFETY_GATE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_SAFETY_GATE_${DATE}.md`)

const DEFAULT_PATHS = {
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
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const resolved = resolve(path)
  if (!existsSync(resolved)) throw new Error(`missing V7 input: ${resolved}`)
  return JSON.parse(await readFile(resolved, 'utf8')) as Record<string, unknown>
}

function getNumber(report: Record<string, unknown>, path: string[]): number {
  let value: unknown = report
  for (const key of path) {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  }
  return Number(value ?? 0)
}

function statusCheck(id: string, condition: boolean, detail: string): SafetyCheck {
  return {
    id,
    status: condition ? 'PASS' : 'BLOCKED',
    detail,
  }
}

function renderMarkdown(report: SafetyReport): string {
  return `# DSXU V7 Safety Gate - ${DATE}

- status: \`${report.status}\`

This gate verifies V7 did not turn historical docs, evidence-only code, legacy rows, generated artifacts, or delete-review paths into default prompt inputs or public claims.

## Summary

| metric | value |
|---|---:|
| checks | ${report.summary.checks} |
| passed | ${report.summary.passed} |
| blocked | ${report.summary.blocked} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Checks

| id | status | detail |
|---|---|---|
${report.checks.map(check => `| ${check.id} | ${check.status} | ${check.detail} |`).join('\n')}
`
}

export async function buildV7SafetyGate(input: {
  paths?: Partial<typeof DEFAULT_PATHS>
  generatedAt?: string
} = {}): Promise<SafetyReport> {
  const paths = { ...DEFAULT_PATHS, ...(input.paths ?? {}) }
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

  const ownerRows = Array.isArray(ownerDecisions.rows) ? ownerDecisions.rows : []
  const expectedOwnerRows = getNumber(ownerDecisions, ['summary', 'reviewedUnclassifiedRows'])
  const expectedDeleteReviewRows = getNumber(ownerDecisions, ['summary', 'deleteReview'])
  const checks: SafetyCheck[] = [
    statusCheck(
      'docs-registry-classified',
      getNumber(docsRegistry, ['summary', 'fileCount']) >= 397,
      `docs=${getNumber(docsRegistry, ['summary', 'fileCount'])}`,
    ),
    statusCheck(
      'signals-p0-covered',
      getNumber(signals, ['summary', 'p0DocCount']) === getNumber(signals, ['summary', 'p0DocsWithSignals']),
      `p0=${getNumber(signals, ['summary', 'p0DocsWithSignals'])}/${getNumber(signals, ['summary', 'p0DocCount'])}`,
    ),
    statusCheck(
      'owner-decisions-closed',
      ownerRows.length > 0 &&
        ownerRows.length === expectedOwnerRows &&
        getNumber(ownerDecisions, ['summary', 'remainingClassifyBeforeClaim']) === 0,
      `ownerRows=${ownerRows.length}, expected=${expectedOwnerRows}, remaining=${getNumber(ownerDecisions, ['summary', 'remainingClassifyBeforeClaim'])}`,
    ),
    statusCheck(
      'prompt-delete-review-blocked',
      getNumber(promptAllowlist, ['summary', 'deleteReviewPromptItems']) === 0,
      `deleteReviewPromptItems=${getNumber(promptAllowlist, ['summary', 'deleteReviewPromptItems'])}`,
    ),
    statusCheck(
      'prompt-historical-raw-blocked',
      getNumber(promptAllowlist, ['summary', 'generatedHistoricalRawDocs']) === 0 &&
        getNumber(promptAllowlist, ['summary', 'supersededPlanRawDocs']) === 0,
      `generatedHistoricalRawDocs=${getNumber(promptAllowlist, ['summary', 'generatedHistoricalRawDocs'])}, supersededPlanRawDocs=${getNumber(promptAllowlist, ['summary', 'supersededPlanRawDocs'])}`,
    ),
    statusCheck(
      'reachability-no-public-claim',
      getNumber(reachability, ['summary', 'publicClaimAllowedRows']) === 0,
      `publicClaimAllowedRows=${getNumber(reachability, ['summary', 'publicClaimAllowedRows'])}`,
    ),
    statusCheck(
      'archive-no-delete',
      getNumber(archiveWatchlist, ['summary', 'deleteNow']) === 0 &&
        getNumber(archiveWatchlist, ['summary', 'activeRowsInWatchlist']) === 0,
      `deleteNow=${getNumber(archiveWatchlist, ['summary', 'deleteNow'])}, activeRows=${getNumber(archiveWatchlist, ['summary', 'activeRowsInWatchlist'])}`,
    ),
    statusCheck(
      'delete-review-observe-only',
      getNumber(deleteReview, ['summary', 'deleteReviewRows']) === expectedDeleteReviewRows &&
        getNumber(deleteReview, ['summary', 'deleteReadyRows']) === 0,
      `rows=${getNumber(deleteReview, ['summary', 'deleteReviewRows'])}, expected=${expectedDeleteReviewRows}, deleteReady=${getNumber(deleteReview, ['summary', 'deleteReadyRows'])}`,
    ),
    statusCheck(
      'delete-review-replacement-evidence-observe-only',
      getNumber(deleteReviewReplacementEvidence, ['summary', 'rows']) === expectedDeleteReviewRows &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'replacementEvidenceRows']) === expectedDeleteReviewRows &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'failedCommands']) === 0 &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'deleteReadyRows']) === 0 &&
        getNumber(deleteReviewReplacementEvidence, ['summary', 'mutationAllowedRows']) === 0,
      `rows=${getNumber(deleteReviewReplacementEvidence, ['summary', 'rows'])}, replacementEvidenceRows=${getNumber(deleteReviewReplacementEvidence, ['summary', 'replacementEvidenceRows'])}, failedCommands=${getNumber(deleteReviewReplacementEvidence, ['summary', 'failedCommands'])}, deleteReady=${getNumber(deleteReviewReplacementEvidence, ['summary', 'deleteReadyRows'])}, mutationAllowed=${getNumber(deleteReviewReplacementEvidence, ['summary', 'mutationAllowedRows'])}`,
    ),
    statusCheck(
      'replay-bank-layered',
      getNumber(replayBank, ['summary', 'totalCases']) > 0 &&
        getNumber(replayBank, ['summary', 'publicBenchmarkClaimAllowedRows']) === 0,
      `cases=${getNumber(replayBank, ['summary', 'totalCases'])}, publicBenchmarkClaimAllowed=${getNumber(replayBank, ['summary', 'publicBenchmarkClaimAllowedRows'])}`,
    ),
    statusCheck(
      'replay-layer-evidence-claim-blocked',
      getNumber(replayLayerEvidence, ['summary', 'rows']) === getNumber(replayBank, ['summary', 'totalCases']) &&
        getNumber(replayLayerEvidence, ['summary', 'missingSourceDocRows']) === 0 &&
        getNumber(replayLayerEvidence, ['summary', 'publicBenchmarkClaimAllowedRows']) === 0 &&
        getNumber(replayLayerEvidence, ['summary', 'publicClaimReadyRows']) === 0,
      `rows=${getNumber(replayLayerEvidence, ['summary', 'rows'])}/${getNumber(replayBank, ['summary', 'totalCases'])}, missingSourceDocRows=${getNumber(replayLayerEvidence, ['summary', 'missingSourceDocRows'])}, publicBenchmarkClaimAllowedRows=${getNumber(replayLayerEvidence, ['summary', 'publicBenchmarkClaimAllowedRows'])}, publicClaimReadyRows=${getNumber(replayLayerEvidence, ['summary', 'publicClaimReadyRows'])}`,
    ),
    statusCheck(
      'claim-boundary-holds',
      getNumber(claimBoundary, ['summary', 'c3BelowPublicAllowed']) === 0 &&
        (claimBoundary.summary as Record<string, unknown> | undefined)?.public90Allowed !== true,
      `c3BelowPublicAllowed=${getNumber(claimBoundary, ['summary', 'c3BelowPublicAllowed'])}, public90Allowed=${String((claimBoundary.summary as Record<string, unknown> | undefined)?.public90Allowed ?? false)}`,
    ),
    statusCheck(
      'owner-focused-evidence-pass',
      getNumber(ownerFocusedEvidence, ['summary', 'commands']) > 0 &&
        getNumber(ownerFocusedEvidence, ['summary', 'failed']) === 0,
      `commands=${getNumber(ownerFocusedEvidence, ['summary', 'commands'])}, failed=${getNumber(ownerFocusedEvidence, ['summary', 'failed'])}, coveredRows=${getNumber(ownerFocusedEvidence, ['summary', 'coveredRows'])}`,
    ),
    statusCheck(
      'remaining-evidence-queue-claim-blocked',
      getNumber(remainingEvidenceQueue, ['summary', 'totalRows']) === getNumber(reachability, ['summary', 'mainlineOwnerRows']) &&
        getNumber(remainingEvidenceQueue, ['summary', 'publicClaimAllowedRows']) === 0 &&
        getNumber(remainingEvidenceQueue, ['summary', 'needsFocusedOwnerTest']) === 0,
      `rows=${getNumber(remainingEvidenceQueue, ['summary', 'totalRows'])}/${getNumber(reachability, ['summary', 'mainlineOwnerRows'])}, needsFocusedOwnerTest=${getNumber(remainingEvidenceQueue, ['summary', 'needsFocusedOwnerTest'])}, publicClaimAllowedRows=${getNumber(remainingEvidenceQueue, ['summary', 'publicClaimAllowedRows'])}`,
    ),
  ]

  const blockers = checks.filter(check => check.status === 'BLOCKED').map(check => `${check.id}: ${check.detail}`)
  return {
    schemaVersion: 'dsxu.v7.safety-gate.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_SAFETY_GATE'
      : 'BLOCKED_DSXU_V7_SAFETY_GATE',
    summary: {
      checks: checks.length,
      passed: checks.filter(check => check.status === 'PASS').length,
      blocked: checks.filter(check => check.status === 'BLOCKED').length,
    },
    blockers,
    checks,
  }
}

async function main(): Promise<void> {
  const report = await buildV7SafetyGate()
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
