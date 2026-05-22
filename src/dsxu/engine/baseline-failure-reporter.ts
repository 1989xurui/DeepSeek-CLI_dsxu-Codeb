import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeV18EvidenceJsonText } from './go-stop-decision'

export type V18BaselineFailureAction =
  | 'fix_protocol_or_gate_before_pro'
  | 'candidate_for_pro_recovery_probe'
  | 'keep_as_pass'
  | 'inspect_trace'

export type V18BaselineFailureCase = {
  id: string
  category: string
  status: string
  policyPassed: boolean
  timedOut: boolean
  fixturePassed: boolean
  routeReason?: string
  expectedModel?: string
  modelsUsed: string[]
  toolCalls: number
  editCalls: number
  readCalls: number
  powerShellCalls: number
  bashCalls: number
  costUSD: number
  baselinePolicyViolations: string[]
  failureCategories: string[]
  rootCauses: string[]
  action: V18BaselineFailureAction
  actionReason: string
  tracePaths: string[]
}

export type V18BaselineFailureReporterEvidence = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_BASELINE_FAILURES' | 'BLOCKED'
  generatedAt: string
  sourceReportPath: string
  evidencePath: string
  markdownPath: string
  baselineProfile: string | null
  entryModelMode: string | null
  summary: {
    totalCases: number
    pass: number
    fail: number
    policyFail: number
    timedOut: number
    costUSD: number
    proRatio: number
    totalToolCalls: number
    passRatePct: number
    policyFailRatePct: number
  }
  failureCounts: Record<string, number>
  cases: V18BaselineFailureCase[]
  next: string[]
  guards: string[]
}

type LiveReportCase = {
  id?: string
  category?: string
  status?: string
  policyPassed?: boolean
  timedOut?: boolean
  logPath?: string
  routeTracePath?: string
  routeExpectation?: {
    expectedModel?: string
    routeReason?: string
  }
  fixtureVerification?: {
    status?: number
  }
  metrics?: {
    toolCalls?: number
    editCalls?: number
    readCalls?: number
    powerShellCalls?: number
    bashCalls?: number
    totalCostUSD?: number
    modelsUsed?: string[]
    modelUsage?: Record<string, { costUSD?: number }>
    baselinePolicyViolations?: string[]
    executionVisibilityGateCount?: number
    bashNativeVerificationCalls?: number
    nonCanonicalPowerShellNativeVerificationCalls?: number
    postPassBlockedToolResults?: number
    hasPreEditBaselineVerification?: boolean
  }
  failureAnalysis?: {
    categories?: string[]
    notes?: string[]
  }
}

type LiveReport = {
  generatedAt?: string
  baselineProfile?: string | null
  entryModelMode?: string | null
  total?: number
  summary?: {
    pass?: number
    fail?: number
    policyFail?: number
    timedOut?: number
    totalToolCalls?: number
    totalCostUSD?: number
    modelsUsed?: string[]
  }
  cases?: LiveReportCase[]
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function modelCostRatio(
  cases: readonly LiveReportCase[],
  totalCostUSD: number,
): number {
  const proCost = cases.reduce((sum, testCase) => {
    const usage = testCase.metrics?.modelUsage ?? {}
    return sum + (usage['deepseek-v4-pro']?.costUSD ?? 0)
  }, 0)
  return totalCostUSD > 0 ? round(proCost / totalCostUSD, 4) : 0
}

function rootCausesForCase(testCase: LiveReportCase): string[] {
  const metrics = testCase.metrics ?? {}
  const causes = [...(metrics.baselinePolicyViolations ?? [])]
  if (testCase.timedOut) causes.push('timeout')
  if (testCase.policyPassed === false) causes.push('policy_failed')
  if ((metrics.executionVisibilityGateCount ?? 0) > 0) {
    causes.push('execution_visibility_gate')
  }
  if ((metrics.bashNativeVerificationCalls ?? 0) > 0) {
    causes.push('bash_native_verification')
  }
  if ((metrics.nonCanonicalPowerShellNativeVerificationCalls ?? 0) > 0) {
    causes.push('noncanonical_powershell_verification')
  }
  if ((metrics.postPassBlockedToolResults ?? 0) > 0) {
    causes.push('post_pass_blocked_tool_attempt')
  }
  if (metrics.hasPreEditBaselineVerification === false) {
    causes.push('missing_pre_edit_baseline_verification')
  }
  for (const category of testCase.failureAnalysis?.categories ?? []) {
    causes.push(category)
  }
  return unique(causes)
}

function actionForCase(input: {
  testCase: LiveReportCase
  rootCauses: readonly string[]
  fixturePassed: boolean
}): Pick<V18BaselineFailureCase, 'action' | 'actionReason'> {
  const root = new Set(input.rootCauses)
  const policyDrift =
    root.has('execution_visibility_gate') ||
    root.has('bash_native_verification') ||
    root.has('noncanonical_powershell_verification') ||
    root.has('post_pass_blocked_tool_attempt') ||
    root.has('missing_pre_edit_baseline_verification')

  if (input.testCase.status === 'pass' && input.testCase.policyPassed !== false) {
    return {
      action: 'keep_as_pass',
      actionReason: 'Case passed and policy was satisfied.',
    }
  }

  if (policyDrift || input.fixturePassed) {
    return {
      action: 'fix_protocol_or_gate_before_pro',
      actionReason:
        'The underlying task reached code/test success or failed a harness policy; fix verification shape, visibility, or gate behavior before spending Pro.',
    }
  }

  if (input.testCase.timedOut || root.has('tool_drift')) {
    return {
      action: 'candidate_for_pro_recovery_probe',
      actionReason:
        'The case did not reach a stable pass and shows timeout/tool drift; use a Flash-first retry, then a Pro recovery probe only if the retry repeats.',
    }
  }

  return {
    action: 'inspect_trace',
    actionReason:
      'Failure is not classifiable from summary metrics; inspect stream and route traces before changing gates.',
  }
}

function caseEvidence(testCase: LiveReportCase): V18BaselineFailureCase {
  const rootCauses = rootCausesForCase(testCase)
  const fixturePassed = testCase.fixtureVerification?.status === 0
  const action = actionForCase({ testCase, rootCauses, fixturePassed })
  const metrics = testCase.metrics ?? {}
  return {
    id: testCase.id ?? 'unknown',
    category: testCase.category ?? 'unknown',
    status: testCase.status ?? 'unknown',
    policyPassed: testCase.policyPassed !== false,
    timedOut: testCase.timedOut === true,
    fixturePassed,
    routeReason: testCase.routeExpectation?.routeReason,
    expectedModel: testCase.routeExpectation?.expectedModel,
    modelsUsed: metrics.modelsUsed ?? [],
    toolCalls: metrics.toolCalls ?? 0,
    editCalls: metrics.editCalls ?? 0,
    readCalls: metrics.readCalls ?? 0,
    powerShellCalls: metrics.powerShellCalls ?? 0,
    bashCalls: metrics.bashCalls ?? 0,
    costUSD: metrics.totalCostUSD ?? 0,
    baselinePolicyViolations: metrics.baselinePolicyViolations ?? [],
    failureCategories: testCase.failureAnalysis?.categories ?? [],
    rootCauses,
    action: action.action,
    actionReason: action.actionReason,
    tracePaths: [testCase.logPath, testCase.routeTracePath].filter(
      (path): path is string => Boolean(path),
    ),
  }
}

function buildNextSteps(input: {
  cases: readonly V18BaselineFailureCase[]
  totalCases: number
}): string[] {
  const failed = input.cases.filter(item => item.action !== 'keep_as_pass')
  const protocolFailures = failed.filter(
    item => item.action === 'fix_protocol_or_gate_before_pro',
  )
  const proCandidates = failed.filter(
    item => item.action === 'candidate_for_pro_recovery_probe',
  )
  const next = []
  if (protocolFailures.length > 0) {
    next.push(
      'Close baseline policy/tool drift before Pro bare: execution visibility, Bash native verification, noncanonical PowerShell, and missing pre-edit baseline.',
    )
  }
  if (proCandidates.length > 0) {
    next.push(
      'Run a same-case Flash retry for true unresolved cases; escalate to Pro only when the retry repeats the failure.',
    )
  }
  if (failed.length === 0 && input.totalCases >= 10) {
    next.push('Flash bare Code-10 is clean; Pro bare can be scheduled from the manifest.')
  }
  if (input.totalCases < 10) {
    next.push('Keep this report local-only until the suite reaches 10 cases.')
  }
  next.push('Do not run the broad 22-case suite until the V18 eval stage closes.')
  return next
}

export function buildV18BaselineFailureReporter(input: {
  generatedAt: string
  sourceReportPath: string
  evidencePath: string
  markdownPath: string
  report?: LiveReport
}): V18BaselineFailureReporterEvidence {
  if (!input.report) {
    return {
      ok: false,
      status: 'BLOCKED',
      generatedAt: input.generatedAt,
      sourceReportPath: input.sourceReportPath,
      evidencePath: input.evidencePath,
      markdownPath: input.markdownPath,
      baselineProfile: null,
      entryModelMode: null,
      summary: {
        totalCases: 0,
        pass: 0,
        fail: 0,
        policyFail: 0,
        timedOut: 0,
        costUSD: 0,
        proRatio: 0,
        totalToolCalls: 0,
        passRatePct: 0,
        policyFailRatePct: 0,
      },
      failureCounts: {},
      cases: [],
      next: ['Missing source live-report; run the manifest command before reporting.'],
      guards: ['source report missing'],
    }
  }

  const cases = input.report.cases ?? []
  const totalCases = input.report.total ?? cases.length
  const summary = input.report.summary ?? {}
  const failureCases = cases.filter(
    testCase =>
      testCase.status !== 'pass' ||
      testCase.policyPassed === false ||
      testCase.timedOut === true,
  )
  const caseReports = failureCases.map(caseEvidence)
  const failureCounts: Record<string, number> = {}
  for (const item of caseReports) {
    for (const cause of item.rootCauses) increment(failureCounts, cause)
  }

  const pass = summary.pass ?? cases.filter(item => item.status === 'pass').length
  const fail = summary.fail ?? failureCases.length
  const policyFail =
    summary.policyFail ?? cases.filter(item => item.policyPassed === false).length
  const timedOut =
    summary.timedOut ?? cases.filter(item => item.timedOut === true).length
  const costUSD =
    summary.totalCostUSD ??
    cases.reduce((sum, item) => sum + (item.metrics?.totalCostUSD ?? 0), 0)
  const totalToolCalls =
    summary.totalToolCalls ??
    cases.reduce((sum, item) => sum + (item.metrics?.toolCalls ?? 0), 0)
  const ok = totalCases >= 10 && caseReports.length === 0
  const modelForcedFlashUsedPro =
    input.report.baselineProfile === 'model_forced_bare' &&
    input.report.entryModelMode === 'flash' &&
    (summary.modelsUsed ?? []).includes('deepseek-v4-pro')
  const guards = []
  if (totalCases < 10) guards.push('sample below 10 cases')
  if (modelForcedFlashUsedPro) {
    guards.push('model-forced Flash bare baseline used Pro; rerun with route model upgrades disabled')
  }
  if (caseReports.some(item => item.action === 'fix_protocol_or_gate_before_pro')) {
    guards.push('policy/tool drift must close before Pro baseline spend')
  }
  const next = buildNextSteps({ cases: caseReports, totalCases })
  if (modelForcedFlashUsedPro) {
    next.unshift(
      'Rerun Flash bare with DSXU_ROUTE_MODEL_UPGRADE_DISABLED=1; this report used Pro and is not a bare baseline.',
    )
  }

  return {
    ok: ok && !modelForcedFlashUsedPro,
    status: ok && !modelForcedFlashUsedPro
      ? 'DONE_EVIDENCED'
      : 'PARTIAL_BASELINE_FAILURES',
    generatedAt: input.generatedAt,
    sourceReportPath: input.sourceReportPath,
    evidencePath: input.evidencePath,
    markdownPath: input.markdownPath,
    baselineProfile: input.report.baselineProfile ?? null,
    entryModelMode: input.report.entryModelMode ?? null,
    summary: {
      totalCases,
      pass,
      fail,
      policyFail,
      timedOut,
      costUSD,
      proRatio: modelCostRatio(cases, costUSD),
      totalToolCalls,
      passRatePct: totalCases > 0 ? round((pass / totalCases) * 100, 1) : 0,
      policyFailRatePct:
        totalCases > 0 ? round((policyFail / totalCases) * 100, 1) : 0,
    },
    failureCounts,
    cases: caseReports,
    next,
    guards,
  }
}

function renderMarkdown(report: V18BaselineFailureReporterEvidence): string {
  return [
    '# DSXU V18 Baseline Failure Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Source: ${report.sourceReportPath}`,
    '',
    '## Summary',
    '',
    `- Cases: ${report.summary.totalCases}`,
    `- Pass: ${report.summary.pass}`,
    `- Fail: ${report.summary.fail}`,
    `- Policy fail: ${report.summary.policyFail}`,
    `- Timeout: ${report.summary.timedOut}`,
    `- CostUSD: ${round(report.summary.costUSD, 6)}`,
    `- Pro ratio: ${round(report.summary.proRatio, 4)}`,
    `- Tool calls: ${report.summary.totalToolCalls}`,
    '',
    '## Failure Counts',
    '',
    ...(Object.keys(report.failureCounts).length > 0
      ? Object.entries(report.failureCounts).map(
          ([key, value]) => `- ${key}: ${value}`,
        )
      : ['- None']),
    '',
    '## Cases',
    '',
    '| Case | Action | Root Causes | ToolCalls | CostUSD |',
    '|---|---|---|---:|---:|',
    ...report.cases.map(
      item =>
        `| ${item.id} | ${item.action} | ${item.rootCauses.join(', ')} | ${item.toolCalls} | ${round(item.costUSD, 6)} |`,
    ),
    '',
    '## Next',
    '',
    ...report.next.map(item => `- ${item}`),
    '',
    '## Guards',
    '',
    ...(report.guards.length > 0
      ? report.guards.map(item => `- ${item}`)
      : ['- None']),
    '',
  ].join('\n')
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as T
  } catch {
    return undefined
  }
}

export async function runV18BaselineFailureReporterHarness(options: {
  sourceReportPath?: string
  evidencePath?: string
  markdownPath?: string
  nowIso?: string
} = {}): Promise<V18BaselineFailureReporterEvidence> {
  const root = process.cwd()
  const sourceReportPath =
    options.sourceReportPath ??
    join(root, '.dsxu', 'runs', 'v18-eval-flash-bare-code-20260507', 'live-report.json')
  const evidencePath =
    options.evidencePath ??
    join(root, '.dsxu', 'trace', 'v18-eval', 'baseline-failure-report-20260507.json')
  const markdownPath =
    options.markdownPath ??
    join(root, 'docs', 'DSXU_V18_BASELINE_FAILURE_REPORT_20260507.md')

  await mkdir(dirname(evidencePath), { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  const report = buildV18BaselineFailureReporter({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    sourceReportPath,
    evidencePath,
    markdownPath,
    report: await readJsonIfExists<LiveReport>(sourceReportPath),
  })
  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')
  return report
}
