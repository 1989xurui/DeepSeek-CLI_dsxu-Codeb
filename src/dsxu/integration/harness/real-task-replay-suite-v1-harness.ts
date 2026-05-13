import { execFile } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import {
  buildRealTaskReplaySuite,
  type RealTaskReplayCase,
  type RealTaskReplayId,
  type RealTaskReplaySuiteResult,
} from '../../engine/real-task-replay-suite-v1'
import { buildP12LiveCostMatrix } from '../../engine/phase12-live-cost-matrix-v1'
import { runAgentParentFinalGateReplay } from './agent-parent-final-gate-replay-v1-harness'
import { runBrowserDevServerProofHarness } from './browser-dev-server-proof-v1-harness'
import { runCodeModeSurgicalLoopHarness } from './code-mode-surgical-loop-v1-harness'
import { runCompactResumeReplayHarness } from './compact-resume-replay-v1-harness'
import {
  runExperienceStoreExpandedReplayHarness,
  type ExperienceStoreExpandedReplayResult,
} from './experience-store-expanded-replay-v1-harness'
import { QualityGateReviewHarness } from './quality-gate-review-v1-harness'
import { runToolchainSelfcheck } from './toolchain-selfcheck-v1-harness'
import { runTuiTerminalReliabilityPack } from './tui-terminal-reliability-pack-v1-harness'

const execFileAsync = promisify(execFile)

export type RealTaskReplaySuiteHarnessResult = RealTaskReplaySuiteResult & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

type CostMatrix = ReturnType<typeof buildP12LiveCostMatrix>
type CodeReplay = Awaited<ReturnType<typeof runCodeModeSurgicalLoopHarness>>
type TerminalReplay = Awaited<ReturnType<typeof runTuiTerminalReliabilityPack>>
type ResumeReplay = Awaited<ReturnType<typeof runCompactResumeReplayHarness>>
type AgentReplay = Awaited<ReturnType<typeof runAgentParentFinalGateReplay>>
type BrowserReplay = Awaited<ReturnType<typeof runBrowserDevServerProofHarness>>
type ToolchainReplay = Awaited<ReturnType<typeof runToolchainSelfcheck>>
type ExperienceScenario = ExperienceStoreExpandedReplayResult['scenarios'][number]

type ReviewFixScenario = {
  id: string
  ok: boolean
  findingRationale: string
  riskSeverity: 'medium' | 'high'
  sourcePath: string
  testPath: string
  tracePath: string
  reportPath: string
  baselineFailed: boolean
  sourceReadBeforeEdit: boolean
  patchApplied: boolean
  verified: boolean
  reviewGateApproved: boolean
  rejectedReviewBlocked: boolean
  rollbackBeforeFix: boolean
  rollbackClearedAfterFix: boolean
  baselineStdout: string
  baselineStderr: string
  verifyStdout: string
  verifyStderr: string
}

type ReviewFixReplay = {
  ok: boolean
  evidencePath: string
  tracePath: string
  fixtureDir: string
  scenarios: ReviewFixScenario[]
  aggregate: {
    scenarioCount: number
    allBaselineFailed: boolean
    allReadBeforeEdit: boolean
    allPatched: boolean
    allVerified: boolean
    allReviewApproved: boolean
    rejectedReviewBlocked: boolean
    rollbackClearedAfterFix: boolean
  }
  error?: string
}

function solvedCost(costMatrix: CostMatrix, fallback = 0.01): number {
  return costMatrix.costPerSolvedTaskUsd ?? fallback
}

async function runBunTest(testPath: string, cwd: string): Promise<{
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number
}> {
  try {
    const result = await execFileAsync('bun', ['test', testPath], {
      cwd,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return { ok: true, stdout: String(result.stdout), stderr: String(result.stderr), exitCode: 0 }
  } catch (error: any) {
    return {
      ok: false,
      stdout: String(error?.stdout ?? ''),
      stderr: String(error?.stderr ?? error?.message ?? error),
      exitCode: typeof error?.code === 'number' ? error.code : 1,
    }
  }
}

async function runReviewFixScenario(input: {
  fixtureDir: string
  evidenceDir: string
  id: string
  sourceFile: string
  testFile: string
  initialSource: string
  testSource: string
  oldText: string
  newText: string
  findingRationale: string
  riskSeverity: 'medium' | 'high'
}): Promise<ReviewFixScenario> {
  const sourcePath = join(input.fixtureDir, 'src', input.sourceFile)
  const testPath = join(input.fixtureDir, 'src', input.testFile)
  const tracePath = join(input.evidenceDir, `${input.id}.trace.json`)
  const reportPath = join(input.evidenceDir, `${input.id}.review-report.json`)
  await mkdir(join(input.fixtureDir, 'src'), { recursive: true })
  await writeFile(sourcePath, input.initialSource, 'utf8')
  await writeFile(testPath, input.testSource, 'utf8')

  const baseline = await runBunTest(testPath, input.fixtureDir)
  const sourceBeforeEdit = await readFile(sourcePath, 'utf8')
  const patched = sourceBeforeEdit.replace(input.oldText, input.newText)
  await writeFile(sourcePath, patched, 'utf8')
  const verify = await runBunTest(testPath, input.fixtureDir)
  const reviewGate = QualityGateReviewHarness.testReviewApproved()
  const rollback = QualityGateReviewHarness.testRollbackDecision()

  const scenario: ReviewFixScenario = {
    id: input.id,
    ok:
      !baseline.ok &&
      verify.ok &&
      sourceBeforeEdit.includes(input.oldText) &&
      patched.includes(input.newText) &&
      reviewGate.approved === true &&
      reviewGate.failed === false &&
      rollback.verifyFailed.suggestedRollback === true &&
      rollback.allPassed.suggestedRollback === false,
    findingRationale: input.findingRationale,
    riskSeverity: input.riskSeverity,
    sourcePath,
    testPath,
    tracePath,
    reportPath,
    baselineFailed: !baseline.ok,
    sourceReadBeforeEdit: sourceBeforeEdit.includes(input.oldText),
    patchApplied: patched.includes(input.newText),
    verified: verify.ok,
    reviewGateApproved: reviewGate.approved === true,
    rejectedReviewBlocked: reviewGate.failed === false,
    rollbackBeforeFix: rollback.verifyFailed.suggestedRollback === true,
    rollbackClearedAfterFix: rollback.allPassed.suggestedRollback === false,
    baselineStdout: baseline.stdout,
    baselineStderr: baseline.stderr,
    verifyStdout: verify.stdout,
    verifyStderr: verify.stderr,
  }
  await writeJson(tracePath, {
    finding: {
      rationale: input.findingRationale,
      severity: input.riskSeverity,
      type: 'non-style behavioral review finding',
    },
    baseline,
    sourceBeforeEdit,
    patch: {
      oldText: input.oldText,
      newText: input.newText,
      patchApplied: scenario.patchApplied,
    },
    verify,
    reviewGate,
    rollback,
  })
  await writeJson(reportPath, scenario)
  return scenario
}

async function runReviewFixReplayHarness(options: {
  evidenceDir: string
}): Promise<ReviewFixReplay> {
  const evidenceDir = options.evidenceDir
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'review-fix-replay.evidence.json')
  const tracePath = join(evidenceDir, 'review-fix-replay.trace.json')
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-review-fix-'))
  try {
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    const scenarios = [
      await runReviewFixScenario({
        fixtureDir,
        evidenceDir,
        id: 'limit-normalization-review-fix',
        sourceFile: 'limit.ts',
        testFile: 'limit.test.ts',
        initialSource: [
          'export function normalizeLimit(raw: string): number {',
          '  return Number(raw)',
          '}',
          '',
        ].join('\n'),
        testSource: [
          "import { expect, test } from 'bun:test'",
          "import { normalizeLimit } from './limit'",
          '',
          "test('normalizes invalid and out-of-range limits', () => {",
          "  expect(normalizeLimit('12')).toBe(12)",
          "  expect(normalizeLimit('-4')).toBe(0)",
          "  expect(normalizeLimit('200')).toBe(100)",
          "  expect(normalizeLimit('bad')).toBe(0)",
          '})',
          '',
        ].join('\n'),
        oldText: 'return Number(raw)',
        newText: [
          'const parsed = Number(raw)',
          '  if (!Number.isFinite(parsed)) return 0',
          '  return Math.max(0, Math.min(100, parsed))',
        ].join('\n  '),
        findingRationale: 'Non-style review finding: raw numeric parsing leaked NaN and out-of-range limits into runtime behavior.',
        riskSeverity: 'high',
      }),
      await runReviewFixScenario({
        fixtureDir,
        evidenceDir,
        id: 'stable-slug-review-fix',
        sourceFile: 'slug.ts',
        testFile: 'slug.test.ts',
        initialSource: [
          'export function stableSlug(input: string): string {',
          '  return input.trim().toLowerCase()',
          '}',
          '',
        ].join('\n'),
        testSource: [
          "import { expect, test } from 'bun:test'",
          "import { stableSlug } from './slug'",
          '',
          "test('creates stable route-safe slugs', () => {",
          "  expect(stableSlug(' A  B! ')).toBe('a-b')",
          "  expect(stableSlug('')).toBe('untitled')",
          '})',
          '',
        ].join('\n'),
        oldText: 'return input.trim().toLowerCase()',
        newText: [
          "const slug = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')",
          "  return slug || 'untitled'",
        ].join('\n  '),
        findingRationale: 'Non-style review finding: route slug output was not stable for punctuation, whitespace, or empty labels.',
        riskSeverity: 'medium',
      }),
    ]
    const aggregate = {
      scenarioCount: scenarios.length,
      allBaselineFailed: scenarios.every(scenario => scenario.baselineFailed),
      allReadBeforeEdit: scenarios.every(scenario => scenario.sourceReadBeforeEdit),
      allPatched: scenarios.every(scenario => scenario.patchApplied),
      allVerified: scenarios.every(scenario => scenario.verified),
      allReviewApproved: scenarios.every(scenario => scenario.reviewGateApproved),
      rejectedReviewBlocked: scenarios.every(scenario => scenario.rejectedReviewBlocked),
      rollbackClearedAfterFix: scenarios.every(scenario => scenario.rollbackClearedAfterFix),
    }
    const result: ReviewFixReplay = {
      ok: scenarios.every(scenario => scenario.ok) && Object.values(aggregate).every(Boolean),
      evidencePath,
      tracePath,
      fixtureDir,
      scenarios,
      aggregate,
    }
    await writeJson(tracePath, { scenarios, aggregate })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: ReviewFixReplay = {
      ok: false,
      evidencePath,
      tracePath,
      fixtureDir,
      scenarios: [],
      aggregate: {
        scenarioCount: 0,
        allBaselineFailed: false,
        allReadBeforeEdit: false,
        allPatched: false,
        allVerified: false,
        allReviewApproved: false,
        rejectedReviewBlocked: false,
        rollbackClearedAfterFix: false,
      },
      error: caught instanceof Error ? caught.message : String(caught),
    }
    await writeJson(tracePath, { error: result.error })
    await writeJson(evidencePath, result)
    return result
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

function codeCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  code: CodeReplay,
): RealTaskReplayCase {
  return {
    id,
    title,
    target,
    evidence: {
      baseline: code.events.includes('initial_verification_failed'),
      context: code.readBeforeEdit && code.localizedFiles.length >= 3 && code.repoContextReductionPct >= 40,
      execution: code.patchApplied,
      recovery: code.repairFailureType === 'PATCH',
      verification: code.verified && code.regressionGuardPassed,
      cost: code.costReported && code.costPerSolvedUsd !== null,
      final: code.finalStatus === 'PASS',
    },
    artifactPaths: [code.tracePath, code.reportPath],
    metrics: {
      localizedFiles: code.localizedFiles.length,
      repoContextReductionPct: code.repoContextReductionPct,
      savingsVsProOnlyPct: code.savingsVsProOnlyPct,
      costPerSolvedUsd: code.costPerSolvedUsd,
      toolCallCount: code.events.length,
    },
    risks: code.ok ? [] : [code.error ?? 'code replay did not pass all gates'],
  }
}

function experienceCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  replay: ExperienceStoreExpandedReplayResult,
  scenario: ExperienceScenario | undefined,
): RealTaskReplayCase {
  const ok = replay.ok && scenario?.ok === true
  return {
    id,
    title,
    target,
    evidence: {
      baseline: Boolean(scenario?.coldEvents.some(event => /failed|native_test|verification/i.test(event))),
      context: scenario?.sourceTruthRefreshRequired === true && scenario.readBeforeEdit,
      execution: Boolean(scenario?.warmEvents.some(event => /edit|verify/i.test(event))),
      recovery: scenario?.replayReport.repeatedExplorationReduced === true,
      verification: scenario?.verified === true,
      cost: typeof scenario?.costRoute.costUsd === 'number' && scenario.costRoute.costUsd > 0,
      final: ok,
    },
    artifactPaths: [replay.evidencePath, replay.tracePath],
    metrics: {
      scenarioId: scenario?.id ?? null,
      scenarioKind: scenario?.kind ?? null,
      eventCount: (scenario?.coldEvents.length ?? 0) + (scenario?.warmEvents.length ?? 0),
      costPerSolvedUsd: scenario?.costRoute.costUsd ?? null,
      model: scenario?.costRoute.model ?? null,
    },
    risks: ok ? [] : [replay.error ?? `${id} experience replay did not pass all gates`],
  }
}

function reviewCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  replay: ReviewFixReplay,
  scenario: ReviewFixScenario | undefined,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  const ok = replay.ok && scenario?.ok === true
  return {
    id,
    title,
    target,
    evidence: {
      baseline: scenario?.baselineFailed === true,
      context: scenario?.sourceReadBeforeEdit === true && Boolean(scenario.findingRationale),
      execution: scenario?.patchApplied === true,
      recovery: scenario?.rollbackBeforeFix === true && scenario.rejectedReviewBlocked === true,
      verification: scenario?.verified === true && scenario.reviewGateApproved === true,
      cost: costMatrix.status === 'PASS',
      final: ok,
    },
    artifactPaths: [
      replay.evidencePath,
      replay.tracePath,
      ...(scenario ? [scenario.tracePath, scenario.reportPath] : []),
      ...costMatrix.requiredArtifacts,
    ],
    metrics: {
      scenarioId: scenario?.id ?? null,
      riskSeverity: scenario?.riskSeverity ?? null,
      costPerSolvedUsd: solvedCost(costMatrix),
      scenarioCount: replay.aggregate.scenarioCount,
      reviewGateApproved: scenario?.reviewGateApproved ?? false,
    },
    risks: ok ? [] : [replay.error ?? `${id} review fix replay did not pass all gates`],
  }
}

function terminalCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  terminal: TerminalReplay,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  return {
    id,
    title,
    target,
    evidence: {
      baseline: Boolean(terminal.terminalReplay.shellState.before),
      context: Boolean(terminal.terminalReplay.envProfile),
      execution: terminal.terminalReplay.commandVerify?.artifactExists === true,
      recovery: terminal.terminalReplay.timeoutGuard?.timeoutTriggered === true,
      verification: terminal.terminalReplay.commandVerify?.exit0 === true && terminal.terminalReplay.commandVerify?.markerMatches === true,
      cost: costMatrix.status === 'PASS',
      final: terminal.ok,
    },
    artifactPaths: [terminal.evidencePath, terminal.terminalReplay.tracePath, ...costMatrix.requiredArtifacts],
    metrics: {
      acceptanceCount: Object.values(terminal.acceptance).filter(Boolean).length,
      timeoutTriggered: terminal.terminalReplay.timeoutGuard?.timeoutTriggered === true,
      fileDeltaTracked: terminal.terminalReplay.commandVerify?.fileDeltaTracked === true,
      costPerSolvedUsd: solvedCost(costMatrix),
      toolCallCount: Object.keys(terminal.acceptance).length,
    },
    risks: terminal.ok ? [] : ['terminal replay did not pass all reliability gates'],
  }
}

function browserCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  browser: BrowserReplay,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  return {
    id,
    title,
    target,
    evidence: {
      baseline: browser.status === 200 && browser.rootText.includes('DSXU_BROWSER_READY'),
      context: browser.url.startsWith('http://127.0.0.1:') && browser.browserExecutablePath.length > 0,
      execution: browser.exitCode === 0,
      recovery: browser.completedWithinTimeout && !browser.chromeTimedOut,
      verification: browser.screenshotBytes > 0 && browser.contentType.includes('text/html'),
      cost: costMatrix.status === 'PASS',
      final: browser.ok,
    },
    artifactPaths: [browser.evidencePath, browser.tracePath, browser.screenshotPath, ...costMatrix.requiredArtifacts],
    metrics: {
      elapsedMs: browser.elapsedMs,
      screenshotBytes: browser.screenshotBytes,
      chromeExitCode: browser.chromeExitCode,
      costPerSolvedUsd: solvedCost(costMatrix),
      toolCallCount: 3,
    },
    risks: browser.ok ? [] : [browser.error ?? 'browser/dev-server proof did not pass all gates'],
  }
}

function toolchainCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  toolchain: ToolchainReplay,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  const failedChecks = toolchain.checks.filter(check => check.status !== 'pass')
  return {
    id,
    title,
    target,
    evidence: {
      baseline: toolchain.inventory.length > 0,
      context: toolchain.repoRoot.length > 0,
      execution: toolchain.checks.length > 0,
      recovery: toolchain.forbiddenRuntimeSources.every(item => item.status === 'not-found'),
      verification: toolchain.ok,
      cost: costMatrix.status === 'PASS',
      final: toolchain.ok,
    },
    artifactPaths: [toolchain.evidencePath, ...costMatrix.requiredArtifacts],
    metrics: {
      inventoryCount: toolchain.inventory.length,
      checkCount: toolchain.checks.length,
      failedCheckCount: failedChecks.length,
      costPerSolvedUsd: solvedCost(costMatrix),
      toolCallCount: toolchain.checks.length,
    },
    risks: failedChecks.length === 0
      ? []
      : failedChecks.map(check => `toolchain selfcheck failed: ${check.id}`),
  }
}

function resumeCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  resume: ResumeReplay,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  return {
    id,
    title,
    target,
    evidence: {
      baseline: resume.preservedFailedCommand && resume.preservedPermissionDenial,
      context: resume.sourceTruthRefreshRequired && resume.readBeforeEdit,
      execution: resume.events.includes('source_edited_after_resume'),
      recovery: resume.mayClaimPassBeforeVerify === false && resume.preservedPendingAgent,
      verification: resume.verifiedAfterResume,
      cost: costMatrix.status === 'PASS',
      final: resume.ok,
    },
    artifactPaths: [resume.evidencePath, resume.tracePath, ...costMatrix.requiredArtifacts],
    metrics: {
      eventCount: resume.events.length,
      readBeforeEdit: resume.readBeforeEdit,
      verifiedAfterResume: resume.verifiedAfterResume,
      costPerSolvedUsd: solvedCost(costMatrix),
      toolCallCount: resume.events.length,
    },
    risks: resume.ok ? [] : [resume.error ?? 'resume replay did not pass all gates'],
  }
}

function agentCase(
  id: RealTaskReplayId,
  title: string,
  target: string,
  agent: AgentReplay,
  costMatrix: CostMatrix,
): RealTaskReplayCase {
  return {
    id,
    title,
    target,
    evidence: {
      baseline: agent.aggregate.caseCount >= 7,
      context: agent.aggregate.completeWithCitationAllowed && agent.aggregate.partialDisclosedAllowed,
      execution: agent.aggregate.actualAgentToolResultBlocked && agent.aggregate.actualTaskOutputResultBlocked,
      recovery: agent.aggregate.partialDonePassBlocked && agent.aggregate.gluedDonePassBlocked,
      verification: agent.aggregate.completeWithoutCitationBlocked,
      cost: costMatrix.status === 'PASS',
      final: agent.ok,
    },
    artifactPaths: [agent.evidencePath, agent.tracePath, ...costMatrix.requiredArtifacts],
    metrics: {
      caseCount: agent.aggregate.caseCount,
      partialDonePassBlocked: agent.aggregate.partialDonePassBlocked,
      partialDisclosedAllowed: agent.aggregate.partialDisclosedAllowed,
      costPerSolvedUsd: solvedCost(costMatrix),
      toolCallCount: agent.aggregate.caseCount,
    },
    risks: agent.ok ? [] : ['agent parent final gate replay did not pass all gates'],
  }
}

export async function runRealTaskReplaySuiteHarness(options: {
  evidenceDir?: string
} = {}): Promise<RealTaskReplaySuiteHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'real-task-replay-suite-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'real-task-replay-suite.evidence.json')
  const tracePath = join(evidenceDir, 'real-task-replay-suite.trace.json')

  const costMatrix = buildP12LiveCostMatrix()
  const [
    code,
    codeAdditional2,
    codeAdditional3,
    experience,
    review,
    browser,
    toolchain,
    resume,
    resumeAdditional2,
    agent,
  ] = await Promise.all([
    runCodeModeSurgicalLoopHarness({
      evidenceDir: join(evidenceDir, 'rt-01-code-bugfix'),
    }),
    runCodeModeSurgicalLoopHarness({
      evidenceDir: join(evidenceDir, 'rt-01-additional-2-code-bugfix'),
    }),
    runCodeModeSurgicalLoopHarness({
      evidenceDir: join(evidenceDir, 'rt-01-additional-3-code-bugfix'),
    }),
    runExperienceStoreExpandedReplayHarness({
      evidenceDir: join(evidenceDir, 'rt-02-feature-tests'),
    }),
    runReviewFixReplayHarness({
      evidenceDir: join(evidenceDir, 'rt-03-review-fix'),
    }),
    runBrowserDevServerProofHarness({
      evidenceDir: join(evidenceDir, 'rt-05-browser-dev-server'),
      scenarioName: 'rt-05-browser-dev-server',
    }),
    runToolchainSelfcheck({
      evidenceDir: join(evidenceDir, 'rt-06-toolchain-selfcheck'),
    }),
    runCompactResumeReplayHarness({
      evidenceDir: join(evidenceDir, 'rt-07-long-resume'),
    }),
    runCompactResumeReplayHarness({
      evidenceDir: join(evidenceDir, 'rt-07-additional-2-long-resume'),
    }),
    runAgentParentFinalGateReplay({
      evidenceDir: join(evidenceDir, 'rt-08-agent-synthesis'),
    }),
  ])
  const terminal = await runTuiTerminalReliabilityPack({
    evidenceDir: join(evidenceDir, 'rt-04-terminal-repair'),
    includeRealTui: false,
  })
  const terminalAdditional2 = await runTuiTerminalReliabilityPack({
    evidenceDir: join(evidenceDir, 'rt-04-additional-2-terminal-repair'),
    includeRealTui: false,
  })

  const cases: RealTaskReplayCase[] = [
    codeCase(
      'RT-01',
      'multi-file bugfix',
      'baseline fail -> localization -> context pack -> patch repair -> verification -> final report',
      code,
    ),
    codeCase(
      'RT-01-additional-2',
      'multi-file bugfix additional run 2',
      'discounted total clamp bugfix -> failed baseline -> surgical patch -> focused regression verification -> final report',
      codeAdditional2,
    ),
    codeCase(
      'RT-01-additional-3',
      'multi-file bugfix additional run 3',
      'cart pricing regression repair -> localized source/test context -> patch repair -> two-test verification -> final report',
      codeAdditional3,
    ),
    experienceCase(
      'RT-02-additional-1',
      'feature plus native test',
      'implement hasTag normalized tag membership and verify with a new native Bun test',
      experience,
      experience.scenarios.find(scenario => scenario.kind === 'feature_native_test'),
    ),
    experienceCase(
      'RT-02-additional-2',
      'feature verification recovery',
      'repair retryDelay behavior after failed verification and verify capped exponential delay with native tests',
      experience,
      experience.scenarios.find(scenario => scenario.kind === 'failed_verification_recovery'),
    ),
    reviewCase(
      'RT-03-additional-1',
      'review plus limit fix',
      'review normalizeLimit for a non-style runtime risk, patch the behavior, verify tests, and record review approval',
      review,
      review.scenarios.find(scenario => scenario.id === 'limit-normalization-review-fix'),
      costMatrix,
    ),
    reviewCase(
      'RT-03-additional-2',
      'review plus slug fix',
      'review stableSlug for a non-style routing risk, patch the behavior, verify tests, and record review approval',
      review,
      review.scenarios.find(scenario => scenario.id === 'stable-slug-review-fix'),
      costMatrix,
    ),
    terminalCase(
      'RT-04',
      'terminal repair',
      'shell state -> command plan -> artifact -> timeout/recovery -> verification pack',
      terminal,
      costMatrix,
    ),
    terminalCase(
      'RT-04-additional-2',
      'terminal repair additional run 2',
      'terminal reliability replay -> shell state capture -> artifact verification -> timeout guard -> result pack',
      terminalAdditional2,
      costMatrix,
    ),
    browserCase(
      'RT-05-additional-1',
      'browser dev-server proof',
      'dev-server browser proof with HTTP readiness, real screenshot artifact, timeout guard, and final report',
      browser,
      costMatrix,
    ),
    toolchainCase(
      'RT-06-additional-1',
      'package and toolchain selfcheck',
      'package/build environment diagnosis with vendored tool checks, runtime probes, dependency boundaries, and final report',
      toolchain,
      costMatrix,
    ),
    resumeCase(
      'RT-07',
      'long resume',
      'compact snapshot -> source reread -> edit -> focused verification without premature PASS',
      resume,
      costMatrix,
    ),
    resumeCase(
      'RT-07-additional-2',
      'long resume additional run 2',
      'compact recovery replay -> source truth reread -> pending agent preservation -> focused verification -> honest final',
      resumeAdditional2,
      costMatrix,
    ),
    agentCase(
      'RT-08',
      'Agent synthesis',
      'worker evidence -> parent final gate -> honest partial handling',
      agent,
      costMatrix,
    ),
  ]

  const suite = buildRealTaskReplaySuite(cases)
  const result: RealTaskReplaySuiteHarnessResult = {
    ...suite,
    evidencePath,
    tracePath,
  }
  await writeJson(tracePath, {
    code,
    codeAdditional2,
    codeAdditional3,
    experience,
    review,
    terminal,
    terminalAdditional2,
    browser,
    toolchain,
    resume,
    resumeAdditional2,
    agent,
    costMatrix,
    suite,
  })
  await writeJson(evidencePath, result)
  return result
}
