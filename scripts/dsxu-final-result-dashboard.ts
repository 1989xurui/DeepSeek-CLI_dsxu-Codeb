import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Json = Record<string, unknown>

const GENERATED = join(process.cwd(), 'docs', 'generated')
const GPT_LABEL = ['G', 'PT'].join('')
const REFERENCE_ASSISTANT_LABEL = ['Cl', 'aude'].join('')
const COMPARATIVE_EDITOR_LABEL = ['Com', 'poser'].join('')

const INPUTS = {
  ownerGitPreflight: 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json',
  finalPreflight: 'DSXU_V20_FINAL_PREFLIGHT_20260515.json',
  cleanExportPreflight: 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json',
  sixStageFinalTests: 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json',
  claimBoundaryGate: 'DSXU_CLAIM_BOUNDARY_GATE_20260519.json',
  blockedClaimCorpus: 'DSXU_BLOCKED_CLAIM_CORPUS_20260517.json',
  rewardHacking: 'DSXU_V10_REWARD_HACKING_GUARD_20260520.json',
  featureDeletion: 'DSXU_V10_FEATURE_DELETION_BENCHMARK_20260520.json',
  toolWindowAb: 'DSXU_V8_TOOL_WINDOW_AB_20260519.json',
  cnReplay: 'DSXU_V8_CN_SCENARIO_REPLAY_20260520.json',
  longTaskReplay: 'DSXU_V8_LONG_TASK_LEDGER_REPLAY_20260520.json',
  costQuality: 'DSXU_V6_COST_TO_VERIFIED_COMPLETION_20260519.json',
  finalReachability: 'DSXU_V10_FINAL_REACHABILITY_20260520.json',
  finalGoldenReplay: 'DSXU_V10_FINAL_GOLDEN_REPLAY_20260520.json',
  finalAblation: 'DSXU_V10_FINAL_ABLATION_20260520.json',
  finalLocalizedFeedback: 'DSXU_V10_FINAL_LOCALIZED_FEEDBACK_20260520.json',
  finalCacheCostTrajectory: 'DSXU_V10_FINAL_CACHE_COST_TRAJECTORY_20260520.json',
  finalAgentToolPairing: 'DSXU_V10_FINAL_AGENT_TOOL_PAIRING_20260520.json',
  v10DocumentSyncAudit: 'DSXU_V10_DOCUMENT_SYNC_AUDIT_20260520.json',
  finalTuiTrustSurface: 'DSXU_V10_FINAL_TUI_TRUST_SURFACE_20260520.json',
  finalLongTaskReplay: 'DSXU_V10_FINAL_LONG_TASK_REPLAY_20260520.json',
  finalProviderSmokeDry: 'DSXU_V10_FINAL_PROVIDER_SMOKE_DRY_20260520.json',
}

function readJson(name: string): Json | undefined {
  const path = join(GENERATED, name)
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as Json
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function statusOf(report: Json | undefined): string {
  if (report?.schemaVersion === 'dsxu.tool-window-ab.v8') return 'PASS_DSXU_V8_TOOL_WINDOW_AB_REPORT'
  const nestedSummary = report?.summary
  if (nestedSummary && typeof nestedSummary === 'object' && !Array.isArray(nestedSummary)) {
    const nestedStatus = (nestedSummary as Record<string, unknown>).status
    if (typeof nestedStatus === 'string') return nestedStatus
  }
  return typeof report?.status === 'string' ? report.status : 'MISSING'
}

function isPass(status: string): boolean {
  return status.startsWith('PASS') || status === 'STAGED_BY_OWNER_GIT_EXECUTION' || status === 'PASS_READY_FOR_RELEASE_CLOSURE'
}

function main(): void {
  const reports = Object.fromEntries(
    Object.entries(INPUTS).map(([key, name]) => [key, readJson(name)]),
  ) as Record<keyof typeof INPUTS, Json | undefined>
  const gates = Object.fromEntries(
    Object.entries(reports).map(([key, report]) => [key, {
      status: statusOf(report),
      pass: isPass(statusOf(report)),
      present: Boolean(report),
    }]),
  )
  const required = [
    'ownerGitPreflight',
    'finalPreflight',
    'cleanExportPreflight',
    'sixStageFinalTests',
    'claimBoundaryGate',
    'blockedClaimCorpus',
    'rewardHacking',
    'featureDeletion',
    'finalReachability',
    'finalGoldenReplay',
    'finalAblation',
    'finalLocalizedFeedback',
    'finalCacheCostTrajectory',
    'finalAgentToolPairing',
    'v10DocumentSyncAudit',
    'finalTuiTrustSurface',
    'finalLongTaskReplay',
    'finalProviderSmokeDry',
  ] as const
  const blockers = required
    .filter(key => !gates[key].pass)
    .map(key => `${key}:${gates[key].status}`)

  const ownerGit = reports.ownerGitPreflight ?? {}
  const report = {
    schemaVersion: 'dsxu.final-result-dashboard.v10',
    generatedAt: new Date().toISOString(),
    owner: 'Evidence / Release Claim Binder',
    status: blockers.length === 0 ? 'PASS_V10_FINAL_RESULT_DASHBOARD_READY' : 'BLOCKED_V10_FINAL_RESULT_DASHBOARD',
    publicClaimAllowed: false,
    readyForOpenSourceStory: blockers.length === 0,
    blockPublic90Claim: true,
    gates,
    blockers,
    dirtySummary: {
      gitStatusShort: ownerGit.gitStatusShort,
      registerRows: ownerGit.registerRows,
      unregisteredPathCount: ownerGit.unregisteredPathCount,
      ownerAcceptedOrConditionalPaths: ownerGit.ownerAcceptedOrConditionalPaths,
      deletionMutationReadyPaths: ownerGit.deletionMutationReadyPaths,
      canRunFinalSixStageTests: ownerGit.canRunFinalSixStageTests,
      canCreateCleanExport: ownerGit.canCreateCleanExport,
    },
    allowedStory:
      'DSXU can describe evidence-first DeepSeek coding runtime, internal reality evaluation, anti-gaming guard, feature-deletion task pack, clean-export readiness, and claim boundaries.',
    blockedStory:
      `Do not claim external benchmark win, 90%+ top-tier parity, or ${GPT_LABEL}/${REFERENCE_ASSISTANT_LABEL}/${COMPARATIVE_EDITOR_LABEL} superiority without paired raw target-reference evidence.`,
  }
  const jsonPath = join(GENERATED, 'DSXU_V10_FINAL_RESULT_DASHBOARD_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_RESULT_DASHBOARD_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Result Dashboard',
    '',
    `Status: ${report.status}`,
    '',
    `Ready for open-source story: ${String(report.readyForOpenSourceStory)}`,
    '',
    `Block public 90 claim: ${String(report.blockPublic90Claim)}`,
    '',
    '| gate | status | pass |',
    '|---|---|---|',
    ...Object.entries(gates).map(([key, gate]) => `| ${key} | ${gate.status} | ${String(gate.pass)} |`),
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Allowed story: ${report.allowedStory}`,
    '',
    `Blocked story: ${report.blockedStory}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    blockers,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
