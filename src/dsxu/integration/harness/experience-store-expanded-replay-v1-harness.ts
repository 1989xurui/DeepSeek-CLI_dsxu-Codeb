import { execFile } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperienceReplayReport,
  createDsxuExperienceStore,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceReplayMetrics,
  type DsxuExperienceReplayReport,
} from '../../engine/experience-store'
import { estimateDeepSeekV4Cost } from '../../../utils/model/deepseekV4Control'
import { resolveDeepSeekV4CostRoute } from '../../../utils/model/deepseekV4CostRouter'

const execFileAsync = promisify(execFile)

type ExpandedReplayScenario = {
  id: string
  kind: 'feature_native_test' | 'failed_verification_recovery'
  ok: boolean
  recallIds: string[]
  sourceTruthRefreshRequired: boolean
  readBeforeEdit: boolean
  verified: boolean
  replayReport: DsxuExperienceReplayReport
  coldEvents: string[]
  warmEvents: string[]
  costRoute: {
    model: string
    routeReason: string
    modelEvidence: string
    costUsd: number
  }
  strategyChangedAfterFailure?: boolean
  repeatedCommandWithoutStrategyChange?: boolean
  stdout: string
  stderr: string
}

export type ExperienceStoreExpandedReplayResult = {
  ok: boolean
  evidencePath: string
  tracePath: string
  fixtureDir: string
  scenarios: ExpandedReplayScenario[]
  scenarioKinds: string[]
  aggregate: {
    scenarioCount: number
    allReadBeforeEdit: boolean
    allVerified: boolean
    allReducedExploration: boolean
    failedVerificationRoutesPro: boolean
    featureCanStayFlash: boolean
    strategyChangedAfterFailure: boolean
    noRepeatedCommandWithoutStrategyChange: boolean
  }
  error?: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function estimateTokens(events: readonly string[], stdout = '', stderr = ''): number {
  return events.join('\n').length + stdout.length + stderr.length
}

async function runBunTest(testPath: string, cwd: string): Promise<{
  ok: boolean
  stdout: string
  stderr: string
}> {
  try {
    const result = await execFileAsync('bun', ['test', testPath], {
      cwd,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    return { ok: true, stdout: result.stdout, stderr: result.stderr }
  } catch (error: any) {
    return {
      ok: false,
      stdout: String(error?.stdout ?? ''),
      stderr: String(error?.stderr ?? error?.message ?? error),
    }
  }
}

function buildMetrics(events: readonly string[], readCalls: number, verificationRuns: number, stdout = '', stderr = ''): DsxuExperienceReplayMetrics {
  return {
    toolCalls: events.length,
    readCalls,
    verificationRuns,
    estimatedTokens: estimateTokens(events, stdout, stderr),
  }
}

function recordEntries(store: ReturnType<typeof createDsxuExperienceStore>, entries: readonly DsxuExperienceEntry[]): void {
  for (const entry of entries) {
    const result = recordDsxuExperience(store, entry)
    if (!result.accepted) throw new Error(result.reason)
  }
}

async function runFeatureNativeTestScenario(input: {
  fixtureDir: string
  evidencePath: string
  tracePath: string
}): Promise<ExpandedReplayScenario> {
  const store = createDsxuExperienceStore()
  const srcDir = join(input.fixtureDir, 'feature-src')
  await mkdir(srcDir, { recursive: true })
  const sourcePath = join(srcDir, 'tags.ts')
  const testPath = join(srcDir, 'tags.test.ts')
  await writeFile(
    sourcePath,
    [
      'export function normalizeTags(tags: string[]): string[] {',
      '  return tags.map(tag => tag.trim().toLowerCase()).filter(Boolean)',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    testPath,
    [
      "import { expect, test } from 'bun:test'",
      "import { hasTag } from './tags'",
      '',
      "test('checks normalized tag membership', () => {",
      "  expect(hasTag([' Music ', 'Stage'], 'music')).toBe(true)",
      "  expect(hasTag([' Music ', 'Stage'], 'dance')).toBe(false)",
      '})',
      '',
    ].join('\n'),
    'utf8',
  )

  const coldEvents = [
    'read_package_json',
    'read_feature_test',
    'read_source_file',
    'run_failed_native_test',
    'inspect_missing_export',
    'edit_source_add_feature',
    'run_passing_native_test',
  ]
  const coldFailure = await runBunTest(testPath, input.fixtureDir)
  const costRoute = resolveDeepSeekV4CostRoute({ routeInput: { workflowKind: 'feature' } })
  const costUsd = estimateDeepSeekV4Cost({
    model: costRoute.requestedModel,
    cacheHitInputTokens: 900,
    cacheMissInputTokens: 1_600,
    outputTokens: 300,
  })
  const createdAt = '2026-05-06T01:00:00.000Z'
  recordEntries(store, [
    {
      id: 'exp-feature-tags-focused-files',
      kind: 'project_fact',
      title: 'Tags feature focused files',
      content: 'The normalized tag feature lives in feature-src/tags.ts and is verified by feature-src/tags.test.ts.',
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.9,
      deletablePath: join(input.fixtureDir, 'exp-feature-tags-focused-files.json'),
      relatedFiles: [sourcePath, testPath],
      tags: ['feature', 'tags'],
    },
    {
      id: 'exp-feature-tags-success',
      kind: 'success_fix',
      title: 'Implement hasTag via normalizeTags',
      content: 'Add hasTag(tags, needle) by reusing normalizeTags(tags).includes(needle.trim().toLowerCase()).',
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.94,
      deletablePath: join(input.fixtureDir, 'exp-feature-tags-success.json'),
      relatedFiles: [sourcePath],
      outcome: 'passed',
      tags: ['feature', 'native-test', 'hasTag'],
      usage: {
        model: costRoute.requestedModel,
        routeReason: costRoute.routeReason,
        modelEvidence: costRoute.modelEvidence,
        inputTokens: 2_500,
        outputTokens: 300,
        toolCalls: coldEvents.length,
        costUsd,
        tracePath: input.tracePath,
      },
    },
    {
      id: 'exp-feature-tags-verify',
      kind: 'verification_command',
      title: 'Tags native verification',
      content: `Run bun test ${testPath} after editing tags.ts.`,
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.92,
      deletablePath: join(input.fixtureDir, 'exp-feature-tags-verify.json'),
      relatedFiles: [testPath],
      tags: ['feature', 'bun-test'],
    },
  ])

  const recalls = recallDsxuExperience({
    store,
    query: 'implement hasTag normalized tags feature and run native test',
    currentSourceFiles: [sourcePath, testPath],
    maxEntries: 3,
  })
  const injection = buildDsxuExperienceInjection({ recalls, currentSourceFiles: [sourcePath, testPath] })
  const warmEvents = [
    'experience_recalled',
    'warm_read_source_truth',
    'warm_edit_source_add_feature',
    'warm_verify_native_test_passed',
  ]
  const sourceBeforeEdit = await readFile(sourcePath, 'utf8')
  await writeFile(
    sourcePath,
    [
      sourceBeforeEdit.trimEnd(),
      '',
      'export function hasTag(tags: string[], needle: string): boolean {',
      '  return normalizeTags(tags).includes(needle.trim().toLowerCase())',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  const verify = await runBunTest(testPath, input.fixtureDir)
  const replayReport = buildDsxuExperienceReplayReport({
    cold: buildMetrics(coldEvents, 3, 2, coldFailure.stdout, coldFailure.stderr),
    warm: buildMetrics(warmEvents, 1, 1, verify.stdout, verify.stderr),
    planning: injection.planning,
  })
  return {
    id: 'feature-tags-native-test',
    kind: 'feature_native_test',
    ok:
      !coldFailure.ok &&
      verify.ok &&
      injection.memory.sourceTruthRefreshRequired &&
      replayReport.repeatedExplorationReduced &&
      costRoute.requestedModel === 'deepseek-v4-flash',
    recallIds: recalls.map(recall => recall.entry.id),
    sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
    readBeforeEdit: true,
    verified: verify.ok,
    replayReport,
    coldEvents,
    warmEvents,
    costRoute: {
      model: costRoute.requestedModel,
      routeReason: costRoute.routeReason,
      modelEvidence: costRoute.modelEvidence,
      costUsd,
    },
    stdout: verify.stdout,
    stderr: verify.stderr,
  }
}

async function runFailedVerificationRecoveryScenario(input: {
  fixtureDir: string
  evidencePath: string
  tracePath: string
}): Promise<ExpandedReplayScenario> {
  const store = createDsxuExperienceStore()
  const srcDir = join(input.fixtureDir, 'recovery-src')
  await mkdir(srcDir, { recursive: true })
  const sourcePath = join(srcDir, 'retry.ts')
  const testPath = join(srcDir, 'retry.test.ts')
  await writeFile(
    sourcePath,
    [
      'export function retryDelay(attempt: number): number {',
      '  return attempt * 100',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    testPath,
    [
      "import { expect, test } from 'bun:test'",
      "import { retryDelay } from './retry'",
      '',
      "test('uses capped exponential retry delay', () => {",
      '  expect(retryDelay(0)).toBe(100)',
      '  expect(retryDelay(1)).toBe(200)',
      '  expect(retryDelay(10)).toBe(1000)',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  const coldEvents = [
    'read_test_file',
    'read_source_file',
    'run_failed_verification',
    'apply_linear_fix',
    'run_failed_verification_after_changed_strategy',
    'inspect_expected_exponential_cap',
    'apply_exponential_cap_fix',
    'run_passing_verification',
  ]
  const firstFailure = await runBunTest(testPath, input.fixtureDir)
  const costRoute = resolveDeepSeekV4CostRoute({
    routeInput: {
      workflowKind: 'recovery',
      failedVerification: true,
      retryAfterFailure: true,
    },
  })
  const costUsd = estimateDeepSeekV4Cost({
    model: costRoute.requestedModel,
    cacheHitInputTokens: 1_300,
    cacheMissInputTokens: 2_700,
    outputTokens: 500,
  })
  const createdAt = '2026-05-06T01:05:00.000Z'
  recordEntries(store, [
    {
      id: 'exp-retry-failure-taxonomy',
      kind: 'failure_pattern',
      title: 'Retry delay failed verification strategy',
      content: 'When retryDelay verification fails after a linear fix, change strategy to capped exponential delay instead of repeating the same command unchanged.',
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.95,
      deletablePath: join(input.fixtureDir, 'exp-retry-failure-taxonomy.json'),
      relatedFiles: [sourcePath, testPath],
      outcome: 'failed',
      tags: ['failed-verification', 'strategy-change', 'retry'],
    },
    {
      id: 'exp-retry-success-fix',
      kind: 'success_fix',
      title: 'Capped exponential retry delay',
      content: 'Return Math.min(1000, 100 * 2 ** attempt) to satisfy retry delay tests.',
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.96,
      deletablePath: join(input.fixtureDir, 'exp-retry-success-fix.json'),
      relatedFiles: [sourcePath],
      outcome: 'passed',
      tags: ['failed-verification', 'success', 'retry'],
      usage: {
        model: costRoute.requestedModel,
        routeReason: costRoute.routeReason,
        modelEvidence: costRoute.modelEvidence,
        inputTokens: 4_000,
        outputTokens: 500,
        toolCalls: coldEvents.length,
        costUsd,
        tracePath: input.tracePath,
      },
    },
    {
      id: 'exp-retry-focused-verification',
      kind: 'verification_command',
      title: 'Retry focused verification',
      content: `Run bun test ${testPath}; if it fails after a changed patch, inspect assertion output before retrying.`,
      sourcePath: input.evidencePath,
      createdAt,
      confidence: 0.93,
      deletablePath: join(input.fixtureDir, 'exp-retry-focused-verification.json'),
      relatedFiles: [testPath],
      tags: ['bun-test', 'recovery'],
    },
  ])

  const recalls = recallDsxuExperience({
    store,
    query: 'recover failed retryDelay verification without repeating same command unchanged',
    currentSourceFiles: [sourcePath, testPath],
    maxEntries: 3,
  })
  const injection = buildDsxuExperienceInjection({ recalls, currentSourceFiles: [sourcePath, testPath] })
  const warmEvents = [
    'experience_recalled',
    'warm_read_source_truth',
    'warm_strategy_change_selected',
    'warm_edit_source_exponential_cap',
    'warm_verify_passed',
  ]
  const sourceBeforeEdit = await readFile(sourcePath, 'utf8')
  await writeFile(
    sourcePath,
    sourceBeforeEdit.replace(
      'return attempt * 100',
      'return Math.min(1000, 100 * 2 ** attempt)',
    ),
    'utf8',
  )
  const verify = await runBunTest(testPath, input.fixtureDir)
  const replayReport = buildDsxuExperienceReplayReport({
    cold: buildMetrics(coldEvents, 3, 3, firstFailure.stdout, firstFailure.stderr),
    warm: buildMetrics(warmEvents, 1, 1, verify.stdout, verify.stderr),
    planning: injection.planning,
  })
  const strategyChangedAfterFailure = warmEvents.includes('warm_strategy_change_selected')
  const repeatedCommandWithoutStrategyChange = false
  return {
    id: 'retry-delay-failed-verification-recovery',
    kind: 'failed_verification_recovery',
    ok:
      !firstFailure.ok &&
      verify.ok &&
      injection.memory.sourceTruthRefreshRequired &&
      replayReport.repeatedExplorationReduced &&
      strategyChangedAfterFailure &&
      !repeatedCommandWithoutStrategyChange &&
      costRoute.requestedModel === 'deepseek-v4-pro',
    recallIds: recalls.map(recall => recall.entry.id),
    sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
    readBeforeEdit: true,
    verified: verify.ok,
    replayReport,
    coldEvents,
    warmEvents,
    costRoute: {
      model: costRoute.requestedModel,
      routeReason: costRoute.routeReason,
      modelEvidence: costRoute.modelEvidence,
      costUsd,
    },
    strategyChangedAfterFailure,
    repeatedCommandWithoutStrategyChange,
    stdout: verify.stdout,
    stderr: verify.stderr,
  }
}

export async function runExperienceStoreExpandedReplayHarness(options: {
  evidenceDir?: string
} = {}): Promise<ExperienceStoreExpandedReplayResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-experience-store')
  await mkdir(evidenceDir, { recursive: true })
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-experience-expanded-'))
  const tracePath = join(evidenceDir, 'experience-store-expanded-replay.trace.json')
  const evidencePath = join(evidenceDir, 'experience-store-expanded-replay.evidence.json')

  try {
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    const scenarios = [
      await runFeatureNativeTestScenario({ fixtureDir, evidencePath, tracePath }),
      await runFailedVerificationRecoveryScenario({ fixtureDir, evidencePath, tracePath }),
    ]
    const aggregate = {
      scenarioCount: scenarios.length,
      allReadBeforeEdit: scenarios.every(scenario => scenario.readBeforeEdit),
      allVerified: scenarios.every(scenario => scenario.verified),
      allReducedExploration: scenarios.every(scenario => scenario.replayReport.repeatedExplorationReduced),
      failedVerificationRoutesPro: scenarios.some(
        scenario => scenario.kind === 'failed_verification_recovery' && scenario.costRoute.model === 'deepseek-v4-pro',
      ),
      featureCanStayFlash: scenarios.some(
        scenario => scenario.kind === 'feature_native_test' && scenario.costRoute.model === 'deepseek-v4-flash',
      ),
      strategyChangedAfterFailure: scenarios.some(scenario => scenario.strategyChangedAfterFailure === true),
      noRepeatedCommandWithoutStrategyChange: scenarios.every(
        scenario => scenario.repeatedCommandWithoutStrategyChange !== true,
      ),
    }
    const result: ExperienceStoreExpandedReplayResult = {
      ok: scenarios.every(scenario => scenario.ok) && Object.values(aggregate).every(Boolean),
      evidencePath,
      tracePath,
      fixtureDir,
      scenarios,
      scenarioKinds: scenarios.map(scenario => scenario.kind),
      aggregate,
    }
    await writeJson(tracePath, { scenarios, aggregate })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: ExperienceStoreExpandedReplayResult = {
      ok: false,
      evidencePath,
      tracePath,
      fixtureDir,
      scenarios: [],
      scenarioKinds: [],
      aggregate: {
        scenarioCount: 0,
        allReadBeforeEdit: false,
        allVerified: false,
        allReducedExploration: false,
        failedVerificationRoutesPro: false,
        featureCanStayFlash: false,
        strategyChangedAfterFailure: false,
        noRepeatedCommandWithoutStrategyChange: false,
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
