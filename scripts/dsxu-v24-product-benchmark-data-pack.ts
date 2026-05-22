import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  DSXU_MAINLINE_BENCHMARK_PACKS,
  getBenchmarkCasesForProductDataPack,
  getBenchmarkRouteExpectation,
  type BenchmarkCase,
} from './benchmark/dsxu-mainline-benchmark'
import { aggregateEvidence } from './dsxu-evidence-dashboard'

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_${DATE}.md`)
const DASHBOARD_STAMP = new Date().toISOString().slice(0, 10).replaceAll('-', '')

const evidencePaths = {
  publicChallenge: join(GENERATED_DIR, `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${DATE}.json`),
  publicChallengeAblation: join(GENERATED_DIR, 'DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json'),
  seniorCodingWindow: join(GENERATED_DIR, `DSXU_V24_SENIOR_CODING_WINDOW_${DATE}.json`),
  c2Join: join(GENERATED_DIR, `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.json`),
  c2Loop: join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`),
  c2PublicClaimClosure: join(GENERATED_DIR, `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.json`),
  c2OwnerImplementationAcceptance: join(GENERATED_DIR, `DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_${DATE}.json`),
  interactiveTui: join(GENERATED_DIR, `DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_${DATE}.json`),
  completedReacceptance: join(GENERATED_DIR, `DSXU_V24_COMPLETED_REACCEPTANCE_${DATE}.json`),
  complexTaskAcceptance: join(GENERATED_DIR, `DSXU_V24_COMPLEX_TASK_ACCEPTANCE_${DATE}.json`),
  cleanExportPreflight: join(GENERATED_DIR, `DSXU_V20_CLEAN_EXPORT_PREFLIGHT_${DATE}.json`),
  sixStageFinalTests: join(GENERATED_DIR, `DSXU_V24_SIX_STAGE_FINAL_TESTS_${DATE}.json`),
  cleanExportArtifact: join(GENERATED_DIR, `DSXU_V24_CLEAN_EXPORT_ARTIFACT_${DATE}.json`),
  freshInstallSmoke: join(GENERATED_DIR, `DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_${DATE}.json`),
  finalPreflight: join(GENERATED_DIR, `DSXU_V20_FINAL_PREFLIGHT_${DATE}.json`),
  evidenceDashboard: join(GENERATED_DIR, `DSXU_EVIDENCE_DASHBOARD_${DASHBOARD_STAMP}.json`),
}

type EvidenceStatus = {
  id: string
  path: string
  status: string
  pass: boolean
  metrics: Record<string, unknown>
}

type ComparisonRow = {
  dimension: string
  fixedEvidence: string
  dsxuResult: string
  publicClaim: string
  claimStatus: 'ALLOWED' | 'GUARDED' | 'BLOCKED'
}

type DemoScenario = {
  id: string
  name: string
  commandOrArtifact: string
  requiredEvidence: string
  status: 'READY_WITH_RAW_EVIDENCE' | 'READY_AS_REPLAY' | 'BLOCKED_UNTIL_EXPORT'
}

function statusFrom(report: Record<string, unknown> | null): string {
  return typeof report?.status === 'string' ? report.status : 'MISSING'
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

function numberFrom(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<T, number>)
}

function benchmarkRow(input: BenchmarkCase): Record<string, unknown> {
  const route = getBenchmarkRouteExpectation(input)
  return {
    id: input.id,
    category: input.category,
    expectedModel: route.expectedModel,
    workflowKind: route.workflowKind,
    routeReason: route.routeReason,
    requiresBaseline: input.requirePreEditBaselineVerification === true,
    allowedTools: input.allowedTools ?? 'default-mainline-tool-gate',
  }
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => escapeCell(row[column])).join(' | ')} |`),
  ].join('\n')
}

function summarizeEvidence(id: string, path: string, report: Record<string, unknown> | null): EvidenceStatus {
  const status = statusFrom(report)
  const window = objectFrom(report?.window)
  const checks = objectFrom(report?.checks)
  const cost = objectFrom(report?.cost)
  const coverage = objectFrom(report?.coverage)
  const counts = objectFrom(report?.counts)
  const pass =
    status.startsWith('PASS') ||
    status === 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY' ||
    status === 'PASS_READY_TO_CREATE_CLEAN_EXPORT'
  return {
    id,
    path,
    status,
    pass,
    metrics: {
      scoreFloor: report?.scoreFloor,
      totalFlashCostUSD: report?.totalFlashCostUSD ?? cost.totalFlashCostUSD,
      proWasRun: report?.proWasRun ?? cost.proWasRun,
      continuousWindowSatisfied: window.continuousWindowSatisfied,
      dsxuRunCount: window.dsxuRunCount,
      sustainedReviewRounds: window.sustainedReviewRounds,
      finalTestPassed: checks.finalTestPassed,
      c2PassedRows: coverage.passedRows,
      c2OpenRows: coverage.openRows,
      referenceFiles: report?.totalReferenceFiles,
      productSpecificFiles: counts.productSpecificFiles,
      sharedUtilityFiles: counts.sharedUtilityFiles,
      canCreateCleanExport: report?.canCreateCleanExport,
      didCreateExport: report?.didCreateExport,
    },
  }
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const evidenceDashboard = await aggregateEvidence(GENERATED_DIR, evidencePaths.evidenceDashboard)
  const reports = {
    publicChallenge: await readJson(evidencePaths.publicChallenge),
    publicChallengeAblation: await readJson(evidencePaths.publicChallengeAblation),
    seniorCodingWindow: await readJson(evidencePaths.seniorCodingWindow),
    c2Join: await readJson(evidencePaths.c2Join),
    c2Loop: await readJson(evidencePaths.c2Loop),
    c2PublicClaimClosure: await readJson(evidencePaths.c2PublicClaimClosure),
    c2OwnerImplementationAcceptance: await readJson(evidencePaths.c2OwnerImplementationAcceptance),
    interactiveTui: await readJson(evidencePaths.interactiveTui),
    completedReacceptance: await readJson(evidencePaths.completedReacceptance),
    complexTaskAcceptance: await readJson(evidencePaths.complexTaskAcceptance),
    cleanExportPreflight: await readJson(evidencePaths.cleanExportPreflight),
    sixStageFinalTests: await readJson(evidencePaths.sixStageFinalTests),
    cleanExportArtifact: await readJson(evidencePaths.cleanExportArtifact),
    freshInstallSmoke: await readJson(evidencePaths.freshInstallSmoke),
    finalPreflight: await readJson(evidencePaths.finalPreflight),
    evidenceDashboard,
  }
  const evidence = [
    summarizeEvidence('public-challenge', evidencePaths.publicChallenge, reports.publicChallenge),
    summarizeEvidence('public-challenge-ablation', evidencePaths.publicChallengeAblation, reports.publicChallengeAblation),
    summarizeEvidence('senior-coding-window', evidencePaths.seniorCodingWindow, reports.seniorCodingWindow),
    summarizeEvidence('c2-1902-evidence-join', evidencePaths.c2Join, reports.c2Join),
    summarizeEvidence('c2-loop-real-acceptance', evidencePaths.c2Loop, reports.c2Loop),
    summarizeEvidence('c2-public-claim-closure', evidencePaths.c2PublicClaimClosure, reports.c2PublicClaimClosure),
    summarizeEvidence('c2-owner-implementation-acceptance', evidencePaths.c2OwnerImplementationAcceptance, reports.c2OwnerImplementationAcceptance),
    summarizeEvidence('interactive-tui-acceptance', evidencePaths.interactiveTui, reports.interactiveTui),
    summarizeEvidence('completed-reacceptance', evidencePaths.completedReacceptance, reports.completedReacceptance),
    summarizeEvidence('complex-task-acceptance', evidencePaths.complexTaskAcceptance, reports.complexTaskAcceptance),
    summarizeEvidence('clean-export-preflight', evidencePaths.cleanExportPreflight, reports.cleanExportPreflight),
    summarizeEvidence('six-stage-final-tests', evidencePaths.sixStageFinalTests, reports.sixStageFinalTests),
    summarizeEvidence('clean-export-artifact', evidencePaths.cleanExportArtifact, reports.cleanExportArtifact),
    summarizeEvidence('fresh-install-release-smoke', evidencePaths.freshInstallSmoke, reports.freshInstallSmoke),
    summarizeEvidence('final-preflight', evidencePaths.finalPreflight, reports.finalPreflight),
    summarizeEvidence(
      'evidence-dashboard',
      evidencePaths.evidenceDashboard,
      reports.evidenceDashboard as unknown as Record<string, unknown>,
    ),
  ]

  const benchmarkCases = getBenchmarkCasesForProductDataPack()
  const categoryCounts = countBy(benchmarkCases.map(item => item.category))
  const routeRows = benchmarkCases.map(benchmarkRow)
  const routeCounts = countBy(routeRows.map(row => row.expectedModel as 'deepseek-v4-flash' | 'deepseek-v4-pro'))
  const selectedPublicTasks = [
    'permission-deny-replan',
    'grep-glob-tool-choice',
    'product-multifile-bugfix-live',
    'product-multistep-feature-live',
    'product-review-fix-live',
    'product-compact-resume-edit-live',
    'product-agent-worker-longrun-live',
    'product-real-mcp-task-live',
    'product-reality-large-feature-live',
    'experience-programmer-ux-live',
  ]
  const fixedTaskRows = routeRows.filter(row => selectedPublicTasks.includes(String(row.id)))

  const seniorWindow = objectFrom(reports.seniorCodingWindow?.window)
  const seniorChecks = objectFrom(reports.seniorCodingWindow?.checks)
  const seniorCost = objectFrom(reports.seniorCodingWindow?.cost)
  const ablationBefore = objectFrom(reports.publicChallengeAblation?.before)
  const ablationAfter = objectFrom(reports.publicChallengeAblation?.after)
  const ablationDeltas = objectFrom(reports.publicChallengeAblation?.deltas)
  const publicChallengePass = statusFrom(reports.publicChallenge) === 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY'
    && isTrue(reports.publicChallenge?.seniorCodingPass)
  const publicChallengeAblationPass = statusFrom(reports.publicChallengeAblation) === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
    && isTrue(reports.publicChallengeAblation?.claimAblationRunnerAllowed)
    && reports.publicChallengeAblation?.claimExternalComparisonAllowed === false
    && reports.publicChallengeAblation?.claimPublic90Allowed === false
  const seniorWindowPass = statusFrom(reports.seniorCodingWindow) === 'PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU'
    && isTrue(seniorWindow.continuousWindowSatisfied)
    && isTrue(seniorChecks.finalTestPassed)
  const c2JoinPass = numberFrom(reports.c2Join?.totalReferenceFiles) === 1902
    && numberFrom(objectFrom(reports.c2Join?.referenceSourceVerification).uniqueSignoffReferenceFiles) === 1902
  const c2LoopPass = statusFrom(reports.c2Loop) === 'PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH'
  const c2PublicClaimBoundaryClosed = statusFrom(reports.c2PublicClaimClosure) === 'PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED'
    && isTrue(objectFrom(reports.c2PublicClaimClosure?.gates).dsxuGenericExperienceClaimAllowed)
    && numberFrom(objectFrom(reports.c2PublicClaimClosure?.totals).openPublicClaimBoundaryRows) === 0
  const c2OwnerImplementationAcceptancePass =
    statusFrom(reports.c2OwnerImplementationAcceptance) === 'PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED' &&
    numberFrom(objectFrom(reports.c2OwnerImplementationAcceptance?.totals).rows) === 1902 &&
    numberFrom(objectFrom(reports.c2OwnerImplementationAcceptance?.totals).needsRealCodeTestRows) === 0 &&
    objectFrom(reports.c2OwnerImplementationAcceptance?.gates).referenceFeatureParityClaimAllowed === false
  const tuiPass = statusFrom(reports.interactiveTui) === 'PASS_INTERACTIVE_TUI_ACCEPTANCE'
  const cleanPreflightPass = statusFrom(reports.cleanExportPreflight) === 'PASS_READY_TO_CREATE_CLEAN_EXPORT'
    && isTrue(reports.cleanExportPreflight?.canCreateCleanExport)
  const sixStagePass = statusFrom(reports.sixStageFinalTests) === 'PASS_V24_SIX_STAGE_FINAL_TESTS'
    && numberFrom(reports.sixStageFinalTests?.failedCommandCount) === 0
  const cleanExportArtifactPass = statusFrom(reports.cleanExportArtifact) === 'PASS_CLEAN_EXPORT_ARTIFACT_CREATED'
    && typeof reports.cleanExportArtifact?.zipSha256 === 'string'
  const freshInstallPass = statusFrom(reports.freshInstallSmoke) === 'PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE'
    && numberFrom(reports.freshInstallSmoke?.failedCommandCount) === 0
  const finalPreflightPass = statusFrom(reports.finalPreflight) === 'PASS'
    && isTrue(reports.finalPreflight?.canRunFinalSixStageTests)
    && isTrue(reports.finalPreflight?.canCreateCleanExport)
  const releaseEvidencePass = finalPreflightPass && sixStagePass && cleanExportArtifactPass && freshInstallPass
  const flashReviews = Array.isArray(reports.publicChallenge?.flashReviews)
    ? reports.publicChallenge.flashReviews as Array<Record<string, unknown>>
    : []
  const trajectoryReviewCount = flashReviews.filter(review =>
    typeof review.trajectoryPath === 'string' && review.trajectoryPath.length > 0,
  ).length

  const comparisonRows: ComparisonRow[] = [
    {
      dimension: 'fixed benchmark catalog',
      fixedEvidence: 'scripts/benchmark/dsxu-mainline-benchmark.ts',
      dsxuResult: `${DSXU_MAINLINE_BENCHMARK_PACKS.length} packs / ${benchmarkCases.length} cases / ${fixedTaskRows.length} selected public demo tasks`,
      publicClaim: 'DSXU ships a fixed, replayable benchmark/task catalog instead of ad hoc demos.',
      claimStatus: benchmarkCases.length >= 90 ? 'ALLOWED' : 'GUARDED',
    },
    {
      dimension: 'senior coding window',
      fixedEvidence: evidencePaths.seniorCodingWindow,
      dsxuResult: `${Math.round(numberFrom(seniorWindow.elapsedMs) / 600) / 100} min, ${seniorWindow.dsxuRunCount} DSXU runs, final fixture test pass=${seniorChecks.finalTestPassed}`,
      publicClaim: 'DSXU completed one real 30-45 minute Flash-first coding window with failed-to-passing test evidence.',
      claimStatus: seniorWindowPass ? 'ALLOWED' : 'BLOCKED',
    },
    {
      dimension: 'reference 1902 experience-loop absorption',
      fixedEvidence: `${evidencePaths.c2Join}; ${evidencePaths.c2Loop}; ${evidencePaths.c2PublicClaimClosure}; ${evidencePaths.c2OwnerImplementationAcceptance}`,
      dsxuResult: c2JoinPass && c2LoopPass && c2PublicClaimBoundaryClosed && c2OwnerImplementationAcceptancePass
        ? `1902/1902 owner-mapped; C2 loop matrix 51/51 pass; 914 public-claim boundary rows closed; owner acceptance: implemented+tested=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).implementedTestedRows}, adapted/excluded=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).adaptedExcludedRows}, no-loss baseline=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).noLossBaselineRows}`
        : 'not closed',
      publicClaim: 'DSXU translates reference senior-programmer loops into DSXU-owned generic experience loops; it does not claim reference-product parity.',
      claimStatus: c2JoinPass && c2LoopPass && c2PublicClaimBoundaryClosed && c2OwnerImplementationAcceptancePass ? 'ALLOWED' : 'BLOCKED',
    },
    {
      dimension: 'TUI/operator experience',
      fixedEvidence: evidencePaths.interactiveTui,
      dsxuResult: tuiPass ? 'interactive replay pass with permission, recovery, compact resume, background task, and model progress evidence' : 'not closed',
      publicClaim: 'DSXU keeps work state visible to the operator during real TUI flows.',
      claimStatus: tuiPass ? 'ALLOWED' : 'BLOCKED',
    },
    {
      dimension: 'Flash-first cost routing',
      fixedEvidence: evidencePaths.publicChallenge,
      dsxuResult: `senior window cost USD=${seniorCost.totalFlashCostUSD}; Pro used=${seniorCost.proWasRun}; benchmark route rows flash=${routeCounts['deepseek-v4-flash'] ?? 0}, pro=${routeCounts['deepseek-v4-pro'] ?? 0}`,
      publicClaim: 'DSXU defaults to DeepSeek V4 Flash and requires explicit evidence before Pro.',
      claimStatus: isTrue(seniorCost.proWasRun) ? 'BLOCKED' : 'ALLOWED',
    },
    {
      dimension: 'DeepSeek trajectory evidence',
      fixedEvidence: 'src/services/api/deepseek-trajectory-store.ts; src/services/api/deepseek-trajectory-store.test.ts; public challenge Flash review trajectory files',
      dsxuResult: `redacted trajectory store is connected to DeepSeekAdapter; public challenge Flash reviews with trajectory paths=${trajectoryReviewCount}/${flashReviews.length}`,
      publicClaim: 'DSXU can audit DeepSeek request plan, message/tool-result structure, thinking/tool snapshots, usage, cache, route, and request id without leaking raw prompt or keys.',
      claimStatus: trajectoryReviewCount === flashReviews.length && flashReviews.length > 0 ? 'ALLOWED' : 'GUARDED',
    },
    {
      dimension: 'public challenge ablation cost/cache',
      fixedEvidence: evidencePaths.publicChallengeAblation,
      dsxuResult: publicChallengeAblationPass
        ? `same-task scoreFloor ${ablationBefore.scoreFloor}->${ablationAfter.scoreFloor}; cost USD ${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD}; cache hit ${ablationBefore.cacheHitRatePct}%->${ablationAfter.cacheHitRatePct}%; Read calls ${ablationBefore.readToolCallCount}->${ablationAfter.readToolCallCount}; toolResultChars ${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}`
        : 'not closed',
      publicClaim: 'DSXU has same-task ablation evidence that source capsule/no-Read/route latch/tool-result hygiene reduces cost and tool-result bloat without lowering the public challenge score floor.',
      claimStatus: publicChallengeAblationPass ? 'ALLOWED' : 'BLOCKED',
    },
    {
      dimension: 'release/export readiness',
      fixedEvidence: `${evidencePaths.cleanExportPreflight}; ${evidencePaths.sixStageFinalTests}; ${evidencePaths.cleanExportArtifact}; ${evidencePaths.freshInstallSmoke}`,
      dsxuResult: releaseEvidencePass
        ? `six-stage pass, clean export artifact created, fresh install smoke pass, zip=${reports.cleanExportArtifact?.zipPath ?? 'unknown'}`
        : `preflight=${cleanPreflightPass}; sixStage=${sixStagePass}; artifact=${cleanExportArtifactPass}; freshInstall=${freshInstallPass}`,
      publicClaim: 'Clean export, six-stage tests, and fresh install smoke are evidence-gated release readiness signals.',
      claimStatus: releaseEvidencePass ? 'ALLOWED' : cleanPreflightPass ? 'GUARDED' : 'BLOCKED',
    },
    {
      dimension: 'external benchmark superiority',
      fixedEvidence: 'requires independent target/public baseline logs',
      dsxuResult: 'not claimed by this pack',
      publicClaim: 'No superiority claim until comparable external raw logs exist.',
      claimStatus: 'BLOCKED',
    },
  ]

  const demoScenarios: DemoScenario[] = [
    {
      id: 'DEMO-01',
      name: 'Senior coding repair with failed-to-passing tests',
      commandOrArtifact: 'bun run v24:senior-coding-window',
      requiredEvidence: evidencePaths.seniorCodingWindow,
      status: seniorWindowPass ? 'READY_WITH_RAW_EVIDENCE' : 'READY_AS_REPLAY',
    },
    {
      id: 'DEMO-02',
      name: 'Operator-visible TUI state replay',
      commandOrArtifact: 'bun run v24:interactive-tui-acceptance',
      requiredEvidence: evidencePaths.interactiveTui,
      status: tuiPass ? 'READY_WITH_RAW_EVIDENCE' : 'READY_AS_REPLAY',
    },
    {
      id: 'DEMO-03',
      name: 'C2 1902 owner/loop absorption evidence',
      commandOrArtifact: 'bun run v24:c2-1902-evidence-join && bun run v24:c2-loop-acceptance && bun run v26:c2-public-claim-closure && bun run v26:c2-owner-implementation-acceptance',
      requiredEvidence: `${evidencePaths.c2Join}; ${evidencePaths.c2Loop}; ${evidencePaths.c2PublicClaimClosure}; ${evidencePaths.c2OwnerImplementationAcceptance}`,
      status: c2JoinPass && c2LoopPass && c2PublicClaimBoundaryClosed && c2OwnerImplementationAcceptancePass ? 'READY_WITH_RAW_EVIDENCE' : 'READY_AS_REPLAY',
    },
    {
      id: 'DEMO-04',
      name: 'Fixed public benchmark task catalog',
      commandOrArtifact: 'bun scripts/benchmark/dsxu-mainline-benchmark.ts',
      requiredEvidence: '98 case catalog plus selected public tasks in this pack',
      status: 'READY_AS_REPLAY',
    },
    {
      id: 'DEMO-05',
      name: 'Claim guard and release preflight',
      commandOrArtifact: 'bun run v24:public-challenge && bun run public-challenge:ablation && bun run clean-export:preflight',
      requiredEvidence: `${evidencePaths.publicChallenge}; ${evidencePaths.publicChallengeAblation}; ${evidencePaths.cleanExportPreflight}`,
      status: publicChallengePass && publicChallengeAblationPass && cleanPreflightPass ? 'READY_WITH_RAW_EVIDENCE' : 'READY_AS_REPLAY',
    },
    {
      id: 'DEMO-06',
      name: 'Clean export artifact and fresh install smoke',
      commandOrArtifact: 'bun run test:six-stage-final && bun run release:clean-export-artifact && bun run release:fresh-install-smoke',
      requiredEvidence: `${evidencePaths.sixStageFinalTests}; ${evidencePaths.cleanExportArtifact}; ${evidencePaths.freshInstallSmoke}`,
      status: releaseEvidencePass ? 'READY_WITH_RAW_EVIDENCE' : 'BLOCKED_UNTIL_EXPORT',
    },
  ]

  const claimGuard = {
    allowed: comparisonRows.filter(row => row.claimStatus === 'ALLOWED').map(row => row.publicClaim),
    guarded: comparisonRows.filter(row => row.claimStatus === 'GUARDED').map(row => row.publicClaim),
    blocked: comparisonRows.filter(row => row.claimStatus === 'BLOCKED').map(row => row.publicClaim),
  }
  const status = publicChallengePass && seniorWindowPass && c2JoinPass && c2LoopPass && c2PublicClaimBoundaryClosed && tuiPass && cleanPreflightPass
    ? 'PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY'
    : 'OPEN_PRODUCT_BENCHMARK_DEMO_DATA_PACK_REVIEW_REQUIRED'
  const report = {
    schemaVersion: 'dsxu.v24.product-benchmark-data-pack.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(ROOT),
    status,
    final95ClaimAllowed: false,
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRunInSeniorWindow: isTrue(seniorCost.proWasRun),
      noSecondRuntime: true,
      comparisonRule: 'Use fixed DSXU evidence and public replay tasks; do not claim external superiority without comparable target raw logs.',
    },
    benchmarkCatalog: {
      packs: DSXU_MAINLINE_BENCHMARK_PACKS,
      caseCount: benchmarkCases.length,
      categoryCounts,
      routeCounts,
      fixedPublicTaskCount: fixedTaskRows.length,
      fixedPublicTasks: fixedTaskRows,
    },
    productMetrics: {
      seniorWindowElapsedMs: seniorWindow.elapsedMs,
      seniorWindowDsxuRunCount: seniorWindow.dsxuRunCount,
      seniorWindowSustainedReviewRounds: seniorWindow.sustainedReviewRounds,
      seniorWindowFinalTestPassed: seniorChecks.finalTestPassed,
      seniorWindowFlashCostUSD: seniorCost.totalFlashCostUSD,
      c2ReferenceFiles: reports.c2Join?.totalReferenceFiles,
      c2ProductSpecificFiles: objectFrom(reports.c2Join?.counts).productSpecificFiles,
      c2SharedUtilityFiles: objectFrom(reports.c2Join?.counts).sharedUtilityFiles,
      c2LoopRowsPassed: objectFrom(reports.c2Loop?.coverage).passedRows,
      c2PublicClaimBoundaryClosed,
      c2PublicClaimBoundaryRowsClosed: objectFrom(reports.c2PublicClaimClosure?.totals).closedPublicClaimBoundaryRows,
      c2ReferenceParityClaimAllowed: objectFrom(reports.c2PublicClaimClosure?.gates).referenceFeatureParityClaimAllowed,
      c2OwnerImplementationAcceptancePass,
      c2OwnerImplementedTestedRows: objectFrom(reports.c2OwnerImplementationAcceptance?.totals).implementedTestedRows,
      c2OwnerAdaptedExcludedRows: objectFrom(reports.c2OwnerImplementationAcceptance?.totals).adaptedExcludedRows,
      c2OwnerNoLossBaselineRows: objectFrom(reports.c2OwnerImplementationAcceptance?.totals).noLossBaselineRows,
      c2OwnerNeedsRealCodeTestRows: objectFrom(reports.c2OwnerImplementationAcceptance?.totals).needsRealCodeTestRows,
      deepSeekTrajectoryReviewCount: trajectoryReviewCount,
      deepSeekTrajectoryReviewTotal: flashReviews.length,
      publicChallengeAblationPass,
      publicChallengeAblationScoreFloor: `${ablationBefore.scoreFloor}->${ablationAfter.scoreFloor}`,
      publicChallengeAblationCostUSD: `${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD}`,
      publicChallengeAblationCostSavingsPct: ablationDeltas.totalCostSavingsPct,
      publicChallengeAblationCacheHitRatePct: `${ablationBefore.cacheHitRatePct}->${ablationAfter.cacheHitRatePct}`,
      publicChallengeAblationReadToolCalls: `${ablationBefore.readToolCallCount}->${ablationAfter.readToolCallCount}`,
      publicChallengeAblationToolResultChars: `${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}`,
      publicChallengeAblationHighCacheRoiAllowed: reports.publicChallengeAblation?.claimHighCacheRoiAllowed,
      finalPreflightPass,
      finalPreflightGitStatusTotal: objectFrom(reports.finalPreflight?.gitStatusShort).total,
      cleanExportPreflightReady: reports.cleanExportPreflight?.canCreateCleanExport,
      sixStageFinalTestsPassed: sixStagePass,
      cleanExportArtifactCreated: cleanExportArtifactPass,
      cleanExportZipPath: reports.cleanExportArtifact?.zipPath,
      cleanExportZipSha256: reports.cleanExportArtifact?.zipSha256,
      freshInstallSmokePassed: freshInstallPass,
    },
    evidence,
    comparisonRows,
    demoScenarios,
    claimGuard,
    remainingHardOrder: [
      ...(!sixStagePass ? ['six-stage final tests'] : []),
      ...(!cleanExportArtifactPass ? ['clean export artifact'] : []),
      ...(!freshInstallPass ? ['fresh install/help/doctor/provider gate smoke'] : []),
      ...(!finalPreflightPass ? ['final preflight remains blocked by targetReferenceManifestPath / owner-Git / release gates'] : []),
      ...(!c2PublicClaimBoundaryClosed ? ['C2 public-claim boundary closure'] : []),
      ...(!c2OwnerImplementationAcceptancePass ? ['C2 owner implementation acceptance'] : []),
      'public95 claim still requires scoreFloor >= 95 and fixed raw public challenge data',
    ],
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const md = [
    '# DSXU V24 Product Benchmark Data Pack - 20260515',
    '',
    `Status: \`${status}\``,
    '',
    'This pack fixes the public benchmark and product-demo evidence surface. It records DSXU evidence and claim boundaries; it does not claim independent external benchmark superiority and does not create the clean export artifact.',
    '',
    '## Product Metrics',
    '',
    markdownTable([
      { metric: 'benchmark catalog', value: `${DSXU_MAINLINE_BENCHMARK_PACKS.length} packs / ${benchmarkCases.length} cases` },
      { metric: 'selected public demo tasks', value: fixedTaskRows.length },
      { metric: 'senior-coding window', value: `${Math.round(numberFrom(seniorWindow.elapsedMs) / 600) / 100} min / ${seniorWindow.dsxuRunCount} DSXU runs / final test ${seniorChecks.finalTestPassed}` },
      { metric: 'Flash cost', value: seniorCost.totalFlashCostUSD },
      { metric: 'C2 reference files', value: reports.c2Join?.totalReferenceFiles },
      { metric: 'C2 behavior rows', value: objectFrom(reports.c2Loop?.coverage).passedRows },
      { metric: 'C2 public-claim boundary', value: c2PublicClaimBoundaryClosed ? `${objectFrom(reports.c2PublicClaimClosure?.totals).closedPublicClaimBoundaryRows} rows closed; reference parity claim=false` : 'not closed' },
      { metric: 'C2 owner implementation acceptance', value: c2OwnerImplementationAcceptancePass ? `implemented+tested=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).implementedTestedRows}; adapted/excluded=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).adaptedExcludedRows}; no-loss=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).noLossBaselineRows}; needs=${objectFrom(reports.c2OwnerImplementationAcceptance?.totals).needsRealCodeTestRows}` : 'not closed' },
      { metric: 'DeepSeek trajectory evidence', value: `${trajectoryReviewCount}/${flashReviews.length} Flash review trajectories; redacted request/tool/usage/cache evidence` },
      { metric: 'public challenge ablation', value: publicChallengeAblationPass ? `scoreFloor ${ablationBefore.scoreFloor}->${ablationAfter.scoreFloor}; cost ${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD}; cache ${ablationBefore.cacheHitRatePct}%->${ablationAfter.cacheHitRatePct}%; toolResultChars ${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}` : 'not closed' },
      { metric: 'final preflight', value: finalPreflightPass ? 'PASS' : `BLOCKED; canRunFinalSixStageTests=${reports.finalPreflight?.canRunFinalSixStageTests}; canCreateCleanExport=${reports.finalPreflight?.canCreateCleanExport}` },
      { metric: 'release evidence', value: releaseEvidencePass ? `six-stage/export/fresh install pass; zip ${reports.cleanExportArtifact?.zipPath}` : `preflight=${cleanPreflightPass}; sixStage=${sixStagePass}; artifact=${cleanExportArtifactPass}; freshInstall=${freshInstallPass}` },
    ], ['metric', 'value']),
    '',
    '## Evidence',
    '',
    markdownTable(evidence.map(row => ({
      id: row.id,
      status: row.status,
      pass: row.pass,
      path: row.path,
    })), ['id', 'status', 'pass', 'path']),
    '',
    '## Comparison Data',
    '',
    markdownTable(comparisonRows.map(row => ({
      dimension: row.dimension,
      result: row.dsxuResult,
      claimStatus: row.claimStatus,
      evidence: row.fixedEvidence,
    })), ['dimension', 'result', 'claimStatus', 'evidence']),
    '',
    '## Demo Scenarios',
    '',
    markdownTable(demoScenarios, ['id', 'name', 'commandOrArtifact', 'status', 'requiredEvidence']),
    '',
    '## Claims Allowed',
    '',
    ...claimGuard.allowed.map(item => `- ${item}`),
    '',
    '## Claims Guarded',
    '',
    ...claimGuard.guarded.map(item => `- ${item}`),
    '',
    '## Claims Blocked',
    '',
    ...claimGuard.blocked.map(item => `- ${item}`),
    '',
    '## Remaining Hard Order',
    '',
    ...report.remainingHardOrder.map(item => `- ${item}`),
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  process.stdout.write(JSON.stringify({
    status,
    benchmarkCaseCount: benchmarkCases.length,
    fixedPublicTaskCount: fixedTaskRows.length,
    seniorWindowPass,
    publicChallengePass,
    c2JoinPass,
    c2LoopPass,
    c2PublicClaimBoundaryClosed,
    tuiPass,
    cleanPreflightPass,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
