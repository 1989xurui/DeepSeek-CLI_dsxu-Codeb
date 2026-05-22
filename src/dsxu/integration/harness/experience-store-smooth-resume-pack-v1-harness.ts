import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildDsxuExperienceReplayReport,
  createDsxuExperienceStore,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceReplayReport,
} from '../../engine/experience-store'
import { runExperienceStoreExpandedReplayHarness } from './experience-store-expanded-replay-v1-harness'
import { runExperienceStoreReplayHarness } from './experience-store-replay-v1-harness'
import { runSmoothResumeLiveTaskHarness } from './smooth-resume-live-task-v1-harness'

export type ExperienceStoreSmoothResumePackScenarioKind =
  | 'bugfix'
  | 'feature_native_test'
  | 'failed_verification_recovery'
  | 'compact_resume'

export type ExperienceStoreSmoothResumePackScenario = {
  kind: ExperienceStoreSmoothResumePackScenarioKind
  ok: boolean
  readBeforeEdit: boolean
  verified: boolean
  sourceTruthRefreshRequired: boolean
  mayClaimPassBeforeVerify: boolean
  model: string
  routeReason: string
  evidencePath: string
  replayReport: DsxuExperienceReplayReport
}

export type ExperienceStoreSmoothResumePackResult = {
  ok: boolean
  evidencePath: string
  tracePath: string
  scenarios: ExperienceStoreSmoothResumePackScenario[]
  aggregate: {
    scenarioCount: number
    coveredKinds: ExperienceStoreSmoothResumePackScenarioKind[]
    allReadBeforeEdit: boolean
    allVerified: boolean
    allSourceTruthRefreshRequired: boolean
    allReducedExploration: boolean
    allBlockPassBeforeVerify: boolean
    bugfixHasDeleteExplainEvidence: boolean
    featureCanStayFlash: boolean
    failedVerificationUsesRecoveryRoute: boolean
    compactResumePreservesFailedCommand: boolean
    benchmarkAnswerLeakBlocked: boolean
    averageToolCallReductionPct: number
    averageReadReductionPct: number
    averageTokenReductionPct: number
  }
  error?: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function buildErrorReplayReport(): DsxuExperienceReplayReport {
  return buildDsxuExperienceReplayReport({
    cold: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
    warm: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
  })
}

function proveBenchmarkAnswerLeakBlocked(evidencePath: string): boolean {
  const store = createDsxuExperienceStore()
  const leakEntry: DsxuExperienceEntry = {
    id: 'exp-benchmark-answer-leak',
    kind: 'success_fix',
    title: 'Do not store benchmark answer marker',
    content: 'DSXU_BENCH_SHOULD_NOT_BE_MEMORIZED_PASS',
    sourcePath: evidencePath,
    createdAt: '2026-05-06T03:00:00.000Z',
    confidence: 0.99,
    deletablePath: `${evidencePath}.leak.json`,
    tags: ['benchmark'],
  }
  const result = recordDsxuExperience(store, leakEntry)
  return result.accepted === false && result.reason.startsWith('benchmark-answer-blocked:')
}

function isFailedVerificationRecoveryRoute(input: { model: string; routeReason: string }): boolean {
  return (
    /^deepseek-v4-(flash|pro)$/.test(input.model) &&
    /^failed_verification_(flash|pro)_thinking_max$/.test(input.routeReason)
  )
}

export async function runExperienceStoreSmoothResumePackHarness(options: {
  evidenceDir?: string
} = {}): Promise<ExperienceStoreSmoothResumePackResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-experience-store')
  await mkdir(evidenceDir, { recursive: true })
  const tracePath = join(evidenceDir, 'experience-store-smooth-resume-pack.trace.json')
  const evidencePath = join(evidenceDir, 'experience-store-smooth-resume-pack.evidence.json')

  try {
    const bugfix = await runExperienceStoreReplayHarness({ evidenceDir })
    const expanded = await runExperienceStoreExpandedReplayHarness({ evidenceDir })
    const compactResume = await runSmoothResumeLiveTaskHarness({ evidenceDir })
    const benchmarkAnswerLeakBlocked = proveBenchmarkAnswerLeakBlocked(evidencePath)

    const scenarios: ExperienceStoreSmoothResumePackScenario[] = [
      {
        kind: 'bugfix',
        ok: bugfix.ok,
        readBeforeEdit: bugfix.readBeforeEdit,
        verified: bugfix.verified,
        sourceTruthRefreshRequired: bugfix.sourceTruthRefreshRequired,
        mayClaimPassBeforeVerify: bugfix.mayClaimPassBeforeVerify,
        model: bugfix.costRouteEvidence.model,
        routeReason: bugfix.costRouteEvidence.routeReason,
        evidencePath: bugfix.evidencePath,
        replayReport: bugfix.replayReport,
      },
      ...expanded.scenarios.map(scenario => ({
        kind: scenario.kind,
        ok: scenario.ok,
        readBeforeEdit: scenario.readBeforeEdit,
        verified: scenario.verified,
        sourceTruthRefreshRequired: scenario.sourceTruthRefreshRequired,
        mayClaimPassBeforeVerify: false,
        model: scenario.costRoute.model,
        routeReason: scenario.costRoute.routeReason,
        evidencePath: expanded.evidencePath,
        replayReport: scenario.replayReport,
      })),
      {
        kind: 'compact_resume',
        ok: compactResume.ok,
        readBeforeEdit: compactResume.readBeforeEdit,
        verified: compactResume.verified,
        sourceTruthRefreshRequired: compactResume.sourceTruthRefreshRequired,
        mayClaimPassBeforeVerify: compactResume.mayClaimPassBeforeVerify,
        model: 'no-model-call',
        routeReason: 'snapshot_resume_replay',
        evidencePath: compactResume.evidencePath,
        replayReport: compactResume.replayReport,
      },
    ]
    const coveredKinds = scenarios.map(scenario => scenario.kind)
    const aggregate = {
      scenarioCount: scenarios.length,
      coveredKinds,
      allReadBeforeEdit: scenarios.every(scenario => scenario.readBeforeEdit),
      allVerified: scenarios.every(scenario => scenario.verified),
      allSourceTruthRefreshRequired: scenarios.every(scenario => scenario.sourceTruthRefreshRequired),
      allReducedExploration: scenarios.every(scenario => scenario.replayReport.repeatedExplorationReduced),
      allBlockPassBeforeVerify: scenarios.every(scenario => scenario.mayClaimPassBeforeVerify === false),
      bugfixHasDeleteExplainEvidence:
        bugfix.deletedIds.length > 0 &&
        bugfix.explanation.includes('deletablePath') &&
        bugfix.explanation.includes('current source files must be reread'),
      featureCanStayFlash: scenarios.some(
        scenario => scenario.kind === 'feature_native_test' && scenario.model === 'deepseek-v4-flash',
      ),
      failedVerificationUsesRecoveryRoute: scenarios.some(
        scenario =>
          scenario.kind === 'failed_verification_recovery' &&
          isFailedVerificationRecoveryRoute(scenario),
      ),
      compactResumePreservesFailedCommand: compactResume.failedCommandPreserved,
      benchmarkAnswerLeakBlocked,
      averageToolCallReductionPct: average(
        scenarios.map(scenario => scenario.replayReport.toolCallReductionPct),
      ),
      averageReadReductionPct: average(
        scenarios.map(scenario => scenario.replayReport.readReductionPct),
      ),
      averageTokenReductionPct: average(
        scenarios.map(scenario => scenario.replayReport.tokenReductionPct),
      ),
    }
    const requiredKinds: readonly ExperienceStoreSmoothResumePackScenarioKind[] = [
      'bugfix',
      'feature_native_test',
      'failed_verification_recovery',
      'compact_resume',
    ]
    const result: ExperienceStoreSmoothResumePackResult = {
      ok:
        requiredKinds.every(kind => coveredKinds.includes(kind)) &&
        scenarios.every(scenario => scenario.ok) &&
        aggregate.allReadBeforeEdit &&
        aggregate.allVerified &&
        aggregate.allSourceTruthRefreshRequired &&
        aggregate.allReducedExploration &&
        aggregate.allBlockPassBeforeVerify &&
        aggregate.bugfixHasDeleteExplainEvidence &&
        aggregate.featureCanStayFlash &&
        aggregate.failedVerificationUsesRecoveryRoute &&
        aggregate.compactResumePreservesFailedCommand &&
        aggregate.benchmarkAnswerLeakBlocked &&
        aggregate.averageToolCallReductionPct >= 30 &&
        aggregate.averageReadReductionPct >= 30 &&
        aggregate.averageTokenReductionPct >= 30,
      evidencePath,
      tracePath,
      scenarios,
      aggregate,
    }
    await writeJson(tracePath, { bugfix, expanded, compactResume, aggregate })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: ExperienceStoreSmoothResumePackResult = {
      ok: false,
      evidencePath,
      tracePath,
      scenarios: [
        {
          kind: 'bugfix',
          ok: false,
          readBeforeEdit: false,
          verified: false,
          sourceTruthRefreshRequired: false,
          mayClaimPassBeforeVerify: true,
          model: 'unknown',
          routeReason: 'error',
          evidencePath,
          replayReport: buildErrorReplayReport(),
        },
      ],
      aggregate: {
        scenarioCount: 0,
        coveredKinds: [],
        allReadBeforeEdit: false,
        allVerified: false,
        allSourceTruthRefreshRequired: false,
        allReducedExploration: false,
        allBlockPassBeforeVerify: false,
        bugfixHasDeleteExplainEvidence: false,
        featureCanStayFlash: false,
        failedVerificationUsesRecoveryRoute: false,
        compactResumePreservesFailedCommand: false,
        benchmarkAnswerLeakBlocked: false,
        averageToolCallReductionPct: 0,
        averageReadReductionPct: 0,
        averageTokenReductionPct: 0,
      },
      error: caught instanceof Error ? caught.message : String(caught),
    }
    await writeJson(tracePath, { error: result.error })
    await writeJson(evidencePath, result)
    return result
  }
}
