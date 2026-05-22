import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { V6ReplayBank } from './dsxu-v6-replay-bank'

export type V6HitRateReport = {
  schemaVersion: 'dsxu.v6.hit-rate-report.v1'
  generatedAt: string
  owner: 'Replay Bank / Evidence'
  status: 'PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE' | 'BLOCKED_V6_INTERNAL_REPLAY_HIT_RATE_GATE'
  publicClaimStatus: 'BLOCKED_PUBLIC_EXTERNAL_CLAIM'
  claimBoundary: string
  sourceReplayBankPath: string
  thresholds: {
    minFinalPassPct: number
    minVerifyRunPct: number
    minToolHitPct: number
    minRecoverySuccessPct: number
    minProJustifiedPct: number
  }
  metrics: {
    caseCount: number
    finalPassRatePct: number
    verifyRequiredRunRatePct: number
    falseClaimCount: number
    infiniteLoopCount: number
    toolHitRatePct: number
    recoverySuccessRatePct: number
    proAdmissionCount: number
    proEscalationJustifiedPct: number
    totalCostUsd: number
    averageCostUsd: number
    averageWallClockMs: number
    averageCacheHitRatePct: number
    totalToolResultChars: number
  }
  blockers: readonly string[]
  dataStillNeeded: readonly string[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_BANK = join(GENERATED_DIR, `DSXU_V6_REPLAY_BANK_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_HIT_RATE_REPORT_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_HIT_RATE_REPORT_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/[\\/]+/g, '/')
}

function parseNumberFlag(name: string, fallback: number): number {
  const flag = process.argv.find(arg => arg.startsWith(`--${name}=`))
  if (!flag) return fallback
  const value = Number(flag.slice(name.length + 3))
  return Number.isFinite(value) ? value : fallback
}

function parseStringFlag(name: string, fallback: string): string {
  const flag = process.argv.find(arg => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : fallback
}

export function buildV6HitRateReport(input: {
  generatedAt: string
  bank: V6ReplayBank
  sourceReplayBankPath: string
  minFinalPassPct: number
}): V6HitRateReport {
  const thresholds = {
    minFinalPassPct: input.minFinalPassPct,
    minVerifyRunPct: 95,
    minToolHitPct: 90,
    minRecoverySuccessPct: 80,
    minProJustifiedPct: 95,
  }
  const blockers = [
    input.bank.status !== 'PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE' ? `replay bank status=${input.bank.status}` : '',
    input.bank.caseCount < 100 ? `need 100 replay cases, found ${input.bank.caseCount}` : '',
    input.bank.finalPassRatePct < thresholds.minFinalPassPct ? `final pass ${input.bank.finalPassRatePct}% < ${thresholds.minFinalPassPct}%` : '',
    input.bank.verifyRequiredRunRatePct < thresholds.minVerifyRunPct ? `verify required run ${input.bank.verifyRequiredRunRatePct}% < ${thresholds.minVerifyRunPct}%` : '',
    input.bank.falseClaimCount !== 0 ? `false claims observed: ${input.bank.falseClaimCount}` : '',
    input.bank.infiniteLoopCount !== 0 ? `infinite loops observed: ${input.bank.infiniteLoopCount}` : '',
    input.bank.toolHitRatePct < thresholds.minToolHitPct ? `tool hit ${input.bank.toolHitRatePct}% < ${thresholds.minToolHitPct}%` : '',
    input.bank.recoverySuccessRatePct < thresholds.minRecoverySuccessPct ? `recovery success ${input.bank.recoverySuccessRatePct}% < ${thresholds.minRecoverySuccessPct}%` : '',
    input.bank.proEscalationJustifiedPct < thresholds.minProJustifiedPct ? `Pro justified ${input.bank.proEscalationJustifiedPct}% < ${thresholds.minProJustifiedPct}%` : '',
    ...input.bank.blockers,
  ].filter(Boolean)
  const status = blockers.length === 0
    ? 'PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE'
    : 'BLOCKED_V6_INTERNAL_REPLAY_HIT_RATE_GATE'
  return {
    schemaVersion: 'dsxu.v6.hit-rate-report.v1',
    generatedAt: input.generatedAt,
    owner: 'Replay Bank / Evidence',
    status,
    publicClaimStatus: 'BLOCKED_PUBLIC_EXTERNAL_CLAIM',
    claimBoundary:
      'This is an internal DSXU replay contract hit-rate gate. It may support DSXU internal V6 readiness, but it is not a public external benchmark, not a real live-model ability score, and not a claim that DSXU beats named external proprietary coding assistants without paired external raw evidence.',
    sourceReplayBankPath: input.sourceReplayBankPath,
    thresholds,
    metrics: {
      caseCount: input.bank.caseCount,
      finalPassRatePct: input.bank.finalPassRatePct,
      verifyRequiredRunRatePct: input.bank.verifyRequiredRunRatePct,
      falseClaimCount: input.bank.falseClaimCount,
      infiniteLoopCount: input.bank.infiniteLoopCount,
      toolHitRatePct: input.bank.toolHitRatePct,
      recoverySuccessRatePct: input.bank.recoverySuccessRatePct,
      proAdmissionCount: input.bank.proAdmissionCount,
      proEscalationJustifiedPct: input.bank.proEscalationJustifiedPct,
      totalCostUsd: input.bank.totalCostUsd,
      averageCostUsd: input.bank.averageCostUsd,
      averageWallClockMs: input.bank.averageWallClockMs,
      averageCacheHitRatePct: input.bank.averageCacheHitRatePct,
      totalToolResultChars: input.bank.totalToolResultChars,
    },
    blockers,
    dataStillNeeded: input.bank.dataStillNeeded,
  }
}

async function main(): Promise<void> {
  const bankPath = parseStringFlag('bank', DEFAULT_BANK)
  const minFinalPassPct = parseNumberFlag('min-final-pass', 0.90) * 100
  const bank = JSON.parse(await readFile(bankPath, 'utf8')) as V6ReplayBank
  const report = buildV6HitRateReport({
    generatedAt: new Date().toISOString(),
    bank,
    sourceReplayBankPath: rel(bankPath),
    minFinalPassPct,
  })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, [
    '# DSXU V6 Hit Rate Report',
    '',
    `- status: \`${report.status}\``,
    `- source: \`${report.sourceReplayBankPath}\``,
    `- final pass: \`${report.metrics.finalPassRatePct}%\``,
    `- verify required run: \`${report.metrics.verifyRequiredRunRatePct}%\``,
    `- tool hit: \`${report.metrics.toolHitRatePct}%\``,
    `- recovery success: \`${report.metrics.recoverySuccessRatePct}%\``,
    `- Pro justified: \`${report.metrics.proEscalationJustifiedPct}%\``,
    `- average cache hit: \`${report.metrics.averageCacheHitRatePct}%\``,
    `- total cost: \`$${report.metrics.totalCostUsd}\``,
    '',
    '## Claim Boundary',
    '',
    report.claimBoundary,
    '',
    '## Blockers',
    '',
    report.blockers.length === 0 ? '- none' : report.blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n'), 'utf8')

  console.log(report.status)
  console.log(JSON.stringify({
    metrics: report.metrics,
    blockers: report.blockers,
    outputs: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
  if (report.blockers.length > 0) process.exitCode = 1
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
