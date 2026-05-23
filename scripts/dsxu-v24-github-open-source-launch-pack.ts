import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildPublicComparableRawEvidenceReadiness,
  type PublicComparableBenchmarkManifest,
  type PublicComparableRawEvidenceManifest,
} from '../src/dsxu/engine/raw-evidence-readiness-register-v1'

const ROOT = process.cwd()
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const ASSET_DIR = join(ROOT, 'docs', 'assets')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md')
const ROUTING_SVG = join(ASSET_DIR, 'dsxu-routing-mix.svg')
const ACCEPTANCE_SVG = join(ASSET_DIR, 'dsxu-acceptance-evidence.svg')
const RELEASE_SVG = join(ASSET_DIR, 'dsxu-release-readiness.svg')
const ABLATION_SVG = join(ASSET_DIR, 'dsxu-public-challenge-ablation.svg')

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function readOptionalJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJson(path)
  } catch {
    return null
  }
}

async function readFirstOptionalJson(paths: string[]): Promise<Record<string, unknown> | null> {
  for (const path of paths) {
    const value = await readOptionalJson(path)
    if (value) return value
  }
  return null
}

async function readFirstOptionalJsonWithPath(
  paths: string[],
): Promise<{ path: string; value: Record<string, unknown> } | null> {
  for (const path of paths) {
    const value = await readOptionalJson(path)
    if (value) return { path, value }
  }
  return null
}

async function readLatestGeneratedJson(prefix: string): Promise<Record<string, unknown> | null> {
  try {
    const candidates = (await readdir(GENERATED_DIR))
      .filter(name => name.startsWith(prefix) && name.endsWith('.json'))
      .sort()
      .reverse()
    for (const name of candidates) {
      const value = await readOptionalJson(join(GENERATED_DIR, name))
      if (value) return value
    }
    return null
  } catch {
    return null
  }
}

function numberFrom(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringFrom(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function isPublicComparableBenchmarkManifest(value: unknown): value is PublicComparableBenchmarkManifest {
  return objectFrom(value).schemaVersion === 'dsxu.public-comparable-benchmark-manifest.v1'
}

function isPublicComparableRawEvidenceManifest(value: unknown): value is PublicComparableRawEvidenceManifest {
  return objectFrom(value).schemaVersion === 'dsxu.public-comparable-raw-evidence.v1'
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function barChartSvg(input: {
  title: string
  subtitle: string
  rows: Array<{ label: string; value: number; max?: number; color: string; note?: string }>
  width?: number
}): string {
  const width = input.width ?? 920
  const rowHeight = 58
  const height = 120 + input.rows.length * rowHeight
  const labelX = 32
  const barX = 270
  const barWidth = width - barX - 120
  const maxValue = Math.max(1, ...input.rows.map(row => row.max ?? row.value))
  const rows = input.rows.map((row, index) => {
    const y = 96 + index * rowHeight
    const max = row.max ?? maxValue
    const filled = Math.max(2, Math.round(barWidth * Math.min(row.value / max, 1)))
    return [
      `<text x="${labelX}" y="${y + 22}" font-size="16" fill="#172026">${escapeXml(row.label)}</text>`,
      `<rect x="${barX}" y="${y}" width="${barWidth}" height="28" rx="6" fill="#e8edf0"/>`,
      `<rect x="${barX}" y="${y}" width="${filled}" height="28" rx="6" fill="${row.color}"/>`,
      `<text x="${barX + barWidth + 16}" y="${y + 21}" font-size="15" fill="#172026">${row.value}</text>`,
      row.note
        ? `<text x="${barX}" y="${y + 48}" font-size="12" fill="#5f6b73">${escapeXml(row.note)}</text>`
        : '',
    ].join('\n')
  }).join('\n')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(input.title)}">`,
    `<rect width="${width}" height="${height}" fill="#fbfcfd"/>`,
    `<text x="32" y="42" font-size="26" font-weight="700" fill="#172026">${escapeXml(input.title)}</text>`,
    `<text x="32" y="70" font-size="14" fill="#5f6b73">${escapeXml(input.subtitle)}</text>`,
    rows,
    '</svg>',
    '',
  ].join('\n')
}

function bulletList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(ASSET_DIR, { recursive: true })

  const [
    productBenchmark,
    publicChallenge,
    seniorWindow,
    sixStage,
    cleanExport,
    freshSmokeCandidate,
    c2Join,
    c2LoopCandidate,
    c2Closure,
    c2OwnerAcceptance,
    tuiCandidate,
    publicChallengeAblation,
    finalPreflight,
    evidenceDashboard,
    v2RuntimeTrust,
    publicComparableManifest,
    publicComparableRawEvidence,
  ] = await Promise.all([
    readJson(join(GENERATED_DIR, 'DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V24_SENIOR_CODING_WINDOW_20260515.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json')),
    readFirstOptionalJsonWithPath([
      join(GENERATED_DIR, 'DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json'),
      join(GENERATED_DIR, 'DSXU_FRESH_INSTALL_WINDOWS_SMOKE_20260522.json'),
    ]),
    readJson(join(GENERATED_DIR, 'DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json')),
    readFirstOptionalJsonWithPath([
      join(GENERATED_DIR, 'DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json'),
      join(GENERATED_DIR, 'DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_20260515.json'),
    ]),
    readJson(join(GENERATED_DIR, 'DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json')),
    readFirstOptionalJsonWithPath([
      join(GENERATED_DIR, 'DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json'),
      join(GENERATED_DIR, 'DSXU_V10_FINAL_TUI_TRUST_SURFACE_20260520.json'),
    ]),
    readJson(join(GENERATED_DIR, 'DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json')),
    readJson(join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')),
    readLatestGeneratedJson('DSXU_EVIDENCE_DASHBOARD_'),
    readOptionalJson(join(GENERATED_DIR, 'DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json')),
    readOptionalJson(join(GENERATED_DIR, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json')),
    readOptionalJson(join(GENERATED_DIR, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json')),
  ])

  const freshSmoke = objectFrom(freshSmokeCandidate?.value)
  const c2Loop = objectFrom(c2LoopCandidate?.value)
  const tui = objectFrom(tuiCandidate?.value)
  const catalog = objectFrom(productBenchmark.benchmarkCatalog)
  const routeCounts = objectFrom(catalog.routeCounts)
  const flashRoutes = numberFrom(routeCounts['deepseek-v4-flash'])
  const proRoutes = numberFrom(routeCounts['deepseek-v4-pro'])
  const benchmarkCaseCount = numberFrom(catalog.caseCount)
  const fixedPublicTaskCount = numberFrom(catalog.fixedPublicTaskCount)
  const scoreFloor = numberFrom(publicChallenge.scoreFloor)
  const dashboardWorkbench = objectFrom(objectFrom(evidenceDashboard).workbench)
  const dashboardReleaseTrustPanel = objectFrom(objectFrom(evidenceDashboard).releaseTrustPanel)
  const productReleaseAllowed =
    dashboardWorkbench.productReleaseAllowed === true ||
    dashboardReleaseTrustPanel.productReleaseAllowed === true
  const externalClaimAllowed =
    dashboardWorkbench.externalClaimAllowed === true ||
    dashboardReleaseTrustPanel.externalClaimAllowed === true
  const ablationBefore = objectFrom(publicChallengeAblation.before)
  const ablationAfter = objectFrom(publicChallengeAblation.after)
  const ablationDeltas = objectFrom(publicChallengeAblation.deltas)
  const ablationPass =
    publicChallengeAblation.status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE' &&
    publicChallengeAblation.claimAblationRunnerAllowed === true &&
    publicChallengeAblation.claimExternalComparisonAllowed === false &&
    publicChallengeAblation.claimPublic90Allowed === false
  const sixStagePassed = numberFrom(sixStage.passedCommandCount)
  const sixStageTotal = numberFrom(sixStage.commandCount)
  const freshSmokeData = objectFrom(freshSmoke)
  const freshStaticTotal = numberFrom(freshSmokeData.staticCheckCount)
  const freshCommandTotal = numberFrom(freshSmokeData.commandCheckCount)
  const freshFallbackTotal = freshStaticTotal + freshCommandTotal
  const freshFallbackFailed =
    arrayLength(freshSmokeData.failedStaticChecks) +
    arrayLength(freshSmokeData.failedCommandChecks)
  const freshTotal = numberFrom(
    freshSmokeData.commandCount,
    numberFrom(freshSmokeData.totalCount, freshFallbackTotal),
  )
  const freshPassed = numberFrom(
    freshSmokeData.passedCommandCount,
    numberFrom(freshSmokeData.passCount, Math.max(0, freshFallbackTotal - freshFallbackFailed)),
  )
  const tuiData = objectFrom(tui)
  const tuiScenarioCount = Array.isArray(tuiData.scenarios)
    ? tuiData.scenarios.filter(row => objectFrom(row).ok === true || objectFrom(row).status === 'PASS').length
    : numberFrom(tuiData.scenarioCount, numberFrom(tuiData.passCount))
  const seniorWindowRow = objectFrom(seniorWindow.window)
  const seniorMinutes = Math.round(numberFrom(seniorWindowRow.elapsedMs) / 600) / 100
  const seniorRuns = numberFrom(seniorWindowRow.dsxuRunCount)
  const seniorReviewRounds = numberFrom(seniorWindowRow.sustainedReviewRounds)
  const c2Files = numberFrom(c2Join.totalReferenceFiles)
  const c2LoopData = objectFrom(c2Loop)
  const c2LoopPassed = numberFrom(objectFrom(c2LoopData.coverage).passedRows, numberFrom(c2LoopData.totalPassed, numberFrom(c2LoopData.readyCaseCount)))
  const c2BoundaryRowsClosed = numberFrom(objectFrom(c2Closure.totals).closedPublicClaimBoundaryRows)
  const c2PublicClaimBoundaryClosed =
    c2Closure.status === 'PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED' &&
    numberFrom(objectFrom(c2Closure.totals).openPublicClaimBoundaryRows) === 0 &&
    objectFrom(c2Closure.gates).referenceFeatureParityClaimAllowed === false
  const c2OwnerImplementationAcceptancePass =
    c2OwnerAcceptance.status === 'PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED' &&
    numberFrom(objectFrom(c2OwnerAcceptance.totals).rows) === 1902 &&
    numberFrom(objectFrom(c2OwnerAcceptance.totals).needsRealCodeTestRows) === 0 &&
    objectFrom(c2OwnerAcceptance.gates).referenceFeatureParityClaimAllowed === false
  const finalPreflightPass =
    finalPreflight.status === 'PASS' &&
    finalPreflight.canRunFinalSixStageTests === true &&
    finalPreflight.canCreateCleanExport === true
  const flashReviews = Array.isArray(publicChallenge.flashReviews)
    ? publicChallenge.flashReviews as Array<Record<string, unknown>>
    : []
  const trajectoryReviewCount = flashReviews.filter(review =>
    typeof review.trajectoryPath === 'string' && review.trajectoryPath.length > 0,
  ).length
  const zipSizeMb = Math.round(numberFrom(cleanExport.zipSizeBytes) / 1024 / 1024 * 100) / 100
  const publicComparableReadiness = isPublicComparableBenchmarkManifest(publicComparableManifest)
    ? buildPublicComparableRawEvidenceReadiness({
      manifest: publicComparableManifest,
      rawEvidenceManifest: isPublicComparableRawEvidenceManifest(publicComparableRawEvidence)
        ? publicComparableRawEvidence
        : undefined,
    })
    : null
  const publicComparableCaseCount = publicComparableReadiness?.caseCount ?? 0
  const publicComparableReadyCaseCount = publicComparableReadiness?.readyCaseCount ?? 0
  const publicComparableMissingCaseCount = publicComparableReadiness?.missingCaseCount ?? 0
  const publicComparableClaimAllowed = publicComparableReadiness?.publicBenchmarkClaimAllowed === true
  const externalComparisonClaimAllowed = publicComparableReadiness?.externalComparisonClaimAllowed === true
  const v2RuntimeTrustEvidence = objectFrom(v2RuntimeTrust?.evidence)
  const v2RuntimeTrustRows = Object.values(v2RuntimeTrustEvidence).map(objectFrom)
  const v2RuntimeTrustPassCount = v2RuntimeTrustRows.filter(row => row.status === 'PASS').length
  const v2RuntimeTrustTotalCount = v2RuntimeTrustRows.length

  const legacyEvidencePackReady =
    productBenchmark.status === 'PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY' &&
    publicChallenge.status === 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY' &&
    c2PublicClaimBoundaryClosed &&
    c2OwnerImplementationAcceptancePass &&
    sixStage.status === 'PASS_V24_SIX_STAGE_FINAL_TESTS' &&
    cleanExport.status === 'PASS_CLEAN_EXPORT_ARTIFACT_CREATED' &&
    (
      freshSmokeData.status === 'PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE' ||
      freshSmokeData.status === 'PASS_FRESH_INSTALL_WINDOWS_SMOKE'
    )
  const artifactGatesPass = productReleaseAllowed && finalPreflightPass
  const public95ClaimAllowed =
    false &&
    artifactGatesPass &&
    productBenchmark.final95ClaimAllowed === true &&
    objectFrom(seniorWindow.checks).final95ClaimAllowed === true &&
    scoreFloor >= 95
  const actualScoreClaimAllowed =
    false &&
    artifactGatesPass &&
    publicComparableClaimAllowed &&
    Number.isFinite(scoreFloor) &&
    scoreFloor > 0
  const status = productReleaseAllowed && finalPreflightPass
      ? 'PASS_GITHUB_OPEN_SOURCE_PRODUCT_RELEASE_READY'
    : productReleaseAllowed && !finalPreflightPass
      ? 'BLOCKED_FOR_FINAL_PREFLIGHT'
      : 'BLOCKED_FOR_PRODUCT_RELEASE_EVIDENCE'

  const positioning = [
    'DSXU Code is a DeepSeek-first open-source AI coding CLI/TUI for long-running engineering tasks.',
    'The product value is a dense engineering loop across goal retention, real file edits, permissions, tools, recovery, agents, cost controls, evidence, and release gates.',
    artifactGatesPass
      ? 'The current public-safe claim is an open-source product release pack. Public score, external comparison, and leaderboard-style claims remain disabled by product policy until explicitly re-enabled with paired raw evidence.'
      : 'The current public-safe claim is a release-candidate evidence pack. Do not publish as release-ready until final preflight, public challenge evidence, and external comparison boundaries pass.',
  ]
  const publicClaimsAllowed = [
    'Product release gate: open-source product capabilities may be published when productReleaseAllowed=true; public score and external-victory wording remain disabled.',
    `Flash-first routing catalog: ${flashRoutes}/${benchmarkCaseCount} fixed cases default to deepseek-v4-flash.`,
    `Six-stage final tests: ${sixStagePassed}/${sixStageTotal} command batches passed.`,
    `Real TUI acceptance: ${tuiScenarioCount}/7 scenarios passed, including permission fallback, recovery, background tasks, and model-task visibility.`,
    ...(v2RuntimeTrustTotalCount > 0
      ? [`V2 runtime trust evidence: ${v2RuntimeTrustPassCount}/${v2RuntimeTrustTotalCount} focused checks passed for TUI resize, permission dialog stability, scrollback anchoring, and query-loop durable ledger.`]
      : []),
    `C2 public-claim boundary: ${c2BoundaryRowsClosed} rows closed as DSXU-owned generic experience evidence, while reference-product parity remains forbidden.`,
    `C2 owner implementation acceptance: ${numberFrom(objectFrom(c2OwnerAcceptance.totals).implementedTestedRows)} implemented+tested, ${numberFrom(objectFrom(c2OwnerAcceptance.totals).adaptedExcludedRows)} adapted/excluded, ${numberFrom(objectFrom(c2OwnerAcceptance.totals).noLossBaselineRows)} no-loss baseline, ${numberFrom(objectFrom(c2OwnerAcceptance.totals).needsRealCodeTestRows)} needs real code/test.`,
    `DeepSeek trajectory evidence: ${trajectoryReviewCount}/${flashReviews.length} Flash reviews include redacted request/tool/usage/cache trajectory paths.`,
    ablationPass
      ? `Public challenge ablation: score floor held ${ablationBefore.scoreFloor}->${ablationAfter.scoreFloor}; cost fell ${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD} USD; toolResultChars fell ${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}.`
      : 'Public challenge ablation evidence is not closed.',
    `Senior coding window: ${seniorMinutes} minutes, ${seniorRuns} DSXU dispatches, ${seniorReviewRounds} sustained review rounds.`,
    `Clean export: ${zipSizeMb} MB zip, secret scan=${stringFrom(objectFrom(cleanExport.secretScan).status)}.`,
    `Fresh install smoke: ${freshPassed}/${freshTotal} passed, including no-key first-run guidance, help, doctor, MCP doctor, and provider gate checks.`,
  ]
  const publicClaimsBlocked = [
    `Do not publish public score wording in this release: scoreFloor=${scoreFloor}/95 is retained as internal evidence only; public95ClaimAllowed=false and actualScoreClaimAllowed=false.`,
    ...(!finalPreflightPass
      ? [`Do not publish as release-ready while final preflight is ${stringFrom(finalPreflight.status, 'UNKNOWN')}: canRunFinalSixStageTests=${String(finalPreflight.canRunFinalSixStageTests)}, canCreateCleanExport=${String(finalPreflight.canCreateCleanExport)}.`]
      : []),
    ...(publicComparableMissingCaseCount > 0
      ? [`Do not claim public-comparable or external win/loss data yet: ${publicComparableReadyCaseCount}/${publicComparableCaseCount} cases have complete paired raw evidence, ${publicComparableMissingCaseCount} missing.`]
      : []),
    'Do not claim high-cache ROI yet: ablation improved cache hit rate, but the dedicated high-cache ROI claim remains blocked until repeated public challenge evidence reaches the configured target.',
    'Do not claim external model/product superiority yet: fixed public tasks exist, but same-task external raw transcripts are not sufficient for a public win/loss claim.',
    'Do not describe the 1902 reference-file map as copied code, brand compatibility, or feature parity. It is only DSXU-owned experience-loop absorption and owner acceptance evidence.',
  ]
  const githubReadmeSections = [
    'Product positioning: DeepSeek-first AI coding CLI/TUI for long-running engineering tasks.',
    'Core capabilities: Flash-first cost routing, real tool execution, permission and visible state, recovery and resume, agent lifecycle, MCP/skill registry, and evidence reports.',
    'Data pack: routing distribution, six-stage tests, TUI scenarios, senior coding window, clean export, and fresh install smoke.',
    'Cost evidence: show same-task ablation data as cost/tool-result reduction with quality held, not as a 95-point or external comparison claim.',
    'Install pack: copy `.env.example`, set `DSXU_API_KEY` or `DEEPSEEK_API_KEY`; first run without a key should guide users through `auth login`.',
    artifactGatesPass
      ? 'Honest boundary: publish evidenced product capabilities only; do not write public scores, external superiority, or leaderboard-style claims.'
      : 'Honest boundary: until final preflight and product release evidence pass, publish only as release-candidate evidence, not as a release-ready or externally leading product.',
  ]
  const dataStillNeeded = [
    'none for product release when productReleaseAllowed=true; public score/external claims intentionally disabled',
    ...(publicComparableMissingCaseCount > 0 ? [`paired raw evidence for ${publicComparableMissingCaseCount} public-comparable cases`] : []),
    ...(!publicComparableClaimAllowed ? ['public benchmark claim binder approval'] : []),
    ...(!externalComparisonClaimAllowed ? ['same-task external comparison raw transcript/tool trace/final report evidence'] : []),
    ...(publicChallengeAblation.claimHighCacheRoiAllowed === true ? [] : ['repeated cache ROI evidence before high-cache savings claim']),
  ]

  await Promise.all([
    writeFile(ROUTING_SVG, barChartSvg({
      title: 'DSXU Model Routing Mix',
      subtitle: 'Fixed benchmark catalog: Flash-first by default; Pro only for admitted high-risk planning/recovery.',
      rows: [
        { label: 'deepseek-v4-flash cases', value: flashRoutes, max: benchmarkCaseCount, color: '#2f7d68', note: `${flashRoutes}/${benchmarkCaseCount} catalog cases` },
        { label: 'deepseek-v4-pro cases', value: proRoutes, max: benchmarkCaseCount, color: '#99582a', note: `${proRoutes}/${benchmarkCaseCount} catalog cases` },
        { label: 'fixed public demo tasks', value: fixedPublicTaskCount, max: benchmarkCaseCount, color: '#3a6ea5', note: 'public replay/demo set' },
      ],
    }), 'utf8'),
    writeFile(ACCEPTANCE_SVG, barChartSvg({
      title: 'DSXU Acceptance Evidence',
      subtitle: 'Real local tests, real TUI replay, reference mapping, and senior coding window evidence.',
      rows: [
        { label: 'six-stage commands passed', value: sixStagePassed, max: sixStageTotal, color: '#2f7d68', note: `${sixStagePassed}/${sixStageTotal}` },
        { label: 'real TUI scenarios passed', value: tuiScenarioCount, max: 7, color: '#3a6ea5', note: 'permission/recovery/background/model task' },
        { label: 'reference files mapped', value: c2Files, max: c2Files, color: '#6f5aa7', note: 'owner/evidence join' },
        { label: 'experience-loop checks passed', value: c2LoopPassed, max: c2LoopPassed, color: '#2f7d68', note: 'real acceptance batch' },
      ],
    }), 'utf8'),
    writeFile(RELEASE_SVG, barChartSvg({
      title: 'DSXU Release Readiness vs Claim Guard',
      subtitle: 'Product release can be ready while public score and external comparison claims stay disabled.',
      rows: [
        { label: 'fresh install smoke', value: freshPassed, max: freshTotal, color: '#2f7d68', note: `${freshPassed}/${freshTotal}` },
        { label: 'internal score floor', value: scoreFloor, max: 95, color: '#5f6b73', note: `${scoreFloor}/95 internal only for this release` },
        { label: 'senior window minutes', value: Math.round(seniorMinutes), max: 45, color: '#3a6ea5', note: `${seniorMinutes} min` },
        { label: 'clean export zip MB', value: Math.round(zipSizeMb), max: 30, color: '#5f6b73', note: `${zipSizeMb} MB` },
      ],
    }), 'utf8'),
    writeFile(ABLATION_SVG, barChartSvg({
      title: 'DSXU Public Challenge Ablation',
      subtitle: 'Same-task before/after evidence: quality held while tool-result bloat and cost dropped.',
      rows: [
        { label: 'score floor before', value: numberFrom(ablationBefore.scoreFloor), max: 95, color: '#5f6b73', note: `${ablationBefore.scoreFloor}/95 claim threshold` },
        { label: 'score floor after', value: numberFrom(ablationAfter.scoreFloor), max: 95, color: '#2f7d68', note: `${ablationAfter.scoreFloor}/95 claim threshold` },
        { label: 'cost savings percent', value: numberFrom(ablationDeltas.totalCostSavingsPct), max: 100, color: '#2f7d68', note: `${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD} USD` },
        { label: 'cache hit rate delta', value: numberFrom(ablationDeltas.cacheHitRatePctDelta), max: 100, color: '#3a6ea5', note: `${ablationBefore.cacheHitRatePct}%->${ablationAfter.cacheHitRatePct}%` },
        { label: 'toolResultChars removed', value: numberFrom(ablationBefore.toolResultChars) - numberFrom(ablationAfter.toolResultChars), max: numberFrom(ablationBefore.toolResultChars), color: '#2f7d68', note: `${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}` },
      ],
    }), 'utf8'),
  ])

  const report = {
    schemaVersion: 'dsxu.github-open-source-launch-pack.v1',
    generatedAt: new Date().toISOString(),
    status,
    githubEvidencePackReady: legacyEvidencePackReady,
    githubOpenSourcePackReady: artifactGatesPass,
    productReleaseAllowed,
    externalClaimAllowed,
    actualScoreClaimAllowed,
    actualScorePublicWording: '',
    public95ClaimAllowed,
    releaseRecommendation: !finalPreflightPass
        ? 'do not publish as release-ready; final preflight is blocked, so keep this as a release-candidate evidence pack'
      : productReleaseAllowed
        ? 'publish the open-source product capability pack; omit public score and external superiority claims'
        : 'do not publish yet; product release evidence is incomplete',
    metrics: {
      benchmarkCaseCount,
      fixedPublicTaskCount,
      flashRoutes,
      proRoutes,
      scoreFloor,
      actualScoreClaimAllowed,
      sixStagePassed,
      sixStageTotal,
      tuiScenarioCount,
      seniorMinutes,
      seniorRuns,
      seniorReviewRounds,
      c2Files,
      c2LoopPassed,
      c2BoundaryRowsClosed,
      c2PublicClaimBoundaryClosed,
      c2OwnerImplementationAcceptancePass,
      c2OwnerImplementedTestedRows: objectFrom(c2OwnerAcceptance.totals).implementedTestedRows,
      c2OwnerAdaptedExcludedRows: objectFrom(c2OwnerAcceptance.totals).adaptedExcludedRows,
      c2OwnerNoLossBaselineRows: objectFrom(c2OwnerAcceptance.totals).noLossBaselineRows,
      c2OwnerNeedsRealCodeTestRows: objectFrom(c2OwnerAcceptance.totals).needsRealCodeTestRows,
      deepSeekTrajectoryReviewCount: trajectoryReviewCount,
      deepSeekTrajectoryReviewTotal: flashReviews.length,
      publicChallengeAblationPass: ablationPass,
      publicChallengeAblationScoreFloor: `${ablationBefore.scoreFloor}->${ablationAfter.scoreFloor}`,
      publicChallengeAblationCostUSD: `${ablationBefore.totalCostUSD}->${ablationAfter.totalCostUSD}`,
      publicChallengeAblationCostSavingsPct: ablationDeltas.totalCostSavingsPct,
      publicChallengeAblationCacheHitRatePct: `${ablationBefore.cacheHitRatePct}->${ablationAfter.cacheHitRatePct}`,
      publicChallengeAblationToolResultChars: `${ablationBefore.toolResultChars}->${ablationAfter.toolResultChars}`,
      publicChallengeAblationHighCacheRoiAllowed: publicChallengeAblation.claimHighCacheRoiAllowed,
      finalPreflightPass,
      productReleaseAllowed,
      externalClaimAllowed,
      finalPreflightStatus: finalPreflight.status,
      finalPreflightCanRunFinalSixStageTests: finalPreflight.canRunFinalSixStageTests,
      finalPreflightCanCreateCleanExport: finalPreflight.canCreateCleanExport,
      finalPreflightGitStatusTotal: objectFrom(finalPreflight.gitStatusShort).total,
      publicComparableCaseCount,
      publicComparableReadyCaseCount,
      publicComparableMissingCaseCount,
      publicComparableClaimAllowed,
      externalComparisonClaimAllowed,
      v2RuntimeTrustPassCount,
      v2RuntimeTrustTotalCount,
      zipSizeMb,
      freshPassed,
      freshTotal,
    },
    assets: {
      routingSvg: ROUTING_SVG,
      acceptanceSvg: ACCEPTANCE_SVG,
      releaseSvg: RELEASE_SVG,
      ablationSvg: ABLATION_SVG,
    },
    publicClaimsAllowed,
    publicClaimsBlocked,
    dataStillNeeded,
    githubReadmeSections,
    evidence: {
      productBenchmark: join(GENERATED_DIR, 'DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json'),
      publicChallenge: join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'),
      seniorWindow: join(GENERATED_DIR, 'DSXU_V24_SENIOR_CODING_WINDOW_20260515.json'),
      sixStage: join(GENERATED_DIR, 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json'),
      cleanExport: join(GENERATED_DIR, 'DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json'),
      freshSmoke: freshSmokeCandidate?.path ?? join(GENERATED_DIR, 'DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json'),
      c2Loop: c2LoopCandidate?.path ?? join(GENERATED_DIR, 'DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json'),
      c2Closure: join(GENERATED_DIR, 'DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json'),
      c2OwnerAcceptance: join(GENERATED_DIR, 'DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json'),
      tui: tuiCandidate?.path ?? join(GENERATED_DIR, 'DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json'),
      publicChallengeAblation: join(GENERATED_DIR, 'DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json'),
      finalPreflight: join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json'),
      v2RuntimeTrust: join(GENERATED_DIR, 'DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json'),
      publicComparableManifest: join(GENERATED_DIR, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json'),
      publicComparableRawEvidence: join(GENERATED_DIR, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json'),
    },
  }

  const md = [
    '# DSXU GitHub Open Source Launch Pack - 2026-05-15',
    '',
    `Status: ${status}`,
    '',
    `Release recommendation: ${report.releaseRecommendation}`,
    '',
    '## Product Positioning',
    '',
    bulletList(positioning),
    '',
    '## Data Charts',
    '',
    '![DSXU routing mix](assets/dsxu-routing-mix.svg)',
    '',
    '![DSXU acceptance evidence](assets/dsxu-acceptance-evidence.svg)',
    '',
    '![DSXU release readiness](assets/dsxu-release-readiness.svg)',
    '',
    '![DSXU public challenge ablation](assets/dsxu-public-challenge-ablation.svg)',
    '',
    '## Public Claims Allowed',
    '',
    bulletList(publicClaimsAllowed),
    '',
    '## Public Claims Blocked',
    '',
    bulletList(publicClaimsBlocked),
    '',
    '## Data Still Needed',
    '',
    bulletList(dataStillNeeded),
    '',
    '## GitHub README Sections',
    '',
    bulletList(githubReadmeSections),
    '',
    '## Evidence Files',
    '',
    bulletList(Object.entries(report.evidence).map(([key, value]) => `${key}: ${value}`)),
    '',
  ].join('\n')

  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUT_MD, md, 'utf8'),
  ])

  console.log(JSON.stringify({
    status,
    githubEvidencePackReady: report.githubEvidencePackReady,
    githubOpenSourcePackReady: report.githubOpenSourcePackReady,
    public95ClaimAllowed,
    actualScoreClaimAllowed,
    scoreFloor,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
    assets: report.assets,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
