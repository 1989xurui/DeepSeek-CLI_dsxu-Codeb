import { execFile } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperienceReplayReport,
  buildDsxuExperienceSmoothResume,
  createDsxuExperienceStore,
  deleteDsxuExperience,
  explainDsxuExperienceRecall,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceReplayMetrics,
  type DsxuExperienceReplayReport,
} from '../../engine/experience-store'
import { createDsxuTaskStateSnapshot } from '../../engine/task-governance'
import { estimateDeepSeekV4Cost } from '../../../utils/model/deepseekV4Control'
import { resolveDeepSeekV4CostRoute } from '../../../utils/model/deepseekV4CostRouter'

const execFileAsync = promisify(execFile)

export type ExperienceStoreReplayResult = {
  ok: boolean
  tracePath: string
  evidencePath: string
  fixtureDir: string
  recordedKinds: string[]
  recallIds: string[]
  deletedIds: string[]
  sourceTruthRefreshRequired: boolean
  mayClaimPassBeforeVerify: boolean
  readBeforeEdit: boolean
  verified: boolean
  replayReport: DsxuExperienceReplayReport
  costRouteEvidence: {
    model: string
    routeReason: string
    modelEvidence: string
    maxTokens: number
    costUsd: number
  }
  traceIndex: {
    tracePath: string
    evidencePath: string
    eventCount: number
  }
  traceIndexed: boolean
  explanation: string
  events: string[]
  stdout: string
  stderr: string
  error?: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function estimateTokens(events: readonly string[], stdout = '', stderr = ''): number {
  return events.join('\n').length + stdout.length + stderr.length
}

async function writeCartFixture(fixtureDir: string): Promise<{ sourcePath: string; testPath: string }> {
  const srcDir = join(fixtureDir, 'src')
  await mkdir(srcDir, { recursive: true })
  const sourcePath = join(srcDir, 'cart.ts')
  const testPath = join(srcDir, 'cart.test.ts')
  await writeFile(
    sourcePath,
    [
      'export function total(price: number, qty: number, discount: number): number {',
      '  return price * qty - discount',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    testPath,
    [
      "import { expect, test } from 'bun:test'",
      "import { total } from './cart'",
      '',
      "test('total never goes below zero after discount', () => {",
      '  expect(total(5, 1, 20)).toBe(0)',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  return { sourcePath, testPath }
}

export async function runExperienceStoreReplayHarness(options: {
  evidenceDir?: string
} = {}): Promise<ExperienceStoreReplayResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-experience-store')
  await mkdir(evidenceDir, { recursive: true })
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-experience-store-'))
  const tracePath = join(evidenceDir, 'experience-store-replay.trace.json')
  const evidencePath = join(evidenceDir, 'experience-store-replay.evidence.json')
  const events: string[] = []
  const deletedIds: string[] = []
  let stdout = ''
  let stderr = ''

  function event(name: string): void {
    events.push(name)
  }

  try {
    const { sourcePath, testPath } = await writeCartFixture(fixtureDir)
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    event('fixture_created')

    const coldEvents = [
      'read_package_json',
      'read_test_file',
      'read_source_file',
      'run_failed_verification',
      'inspect_failure',
      'edit_source',
      'run_passing_verification',
    ]
    const failed = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    }).catch(error => error as { stdout?: string; stderr?: string })
    event('cold_verification_failed')

    const store = createDsxuExperienceStore()
    const createdAt = '2026-05-06T00:00:00.000Z'
    const costRoute = resolveDeepSeekV4CostRoute({
      routeInput: {
        workflowKind: 'recovery',
        role: 'recovery',
        failedVerification: true,
        retryAfterFailure: true,
        requestedMaxTokens: 32_768,
      },
    })
    const costUsd = estimateDeepSeekV4Cost({
      model: costRoute.requestedModel,
      cacheHitInputTokens: 1_800,
      cacheMissInputTokens: 4_200,
      outputTokens: 800,
    })
    const entries: DsxuExperienceEntry[] = [
      {
        id: 'exp-project-cart-entry',
        kind: 'project_fact',
        title: 'Cart module focused files',
        content: 'The cart total task lives in src/cart.ts and is verified by src/cart.test.ts.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.91,
        deletablePath: join(evidenceDir, 'exp-project-cart-entry.json'),
        relatedFiles: [sourcePath, testPath],
        tags: ['cart', 'focused-test'],
      },
      {
        id: 'exp-cart-negative-discount-failure',
        kind: 'failure_pattern',
        title: 'Negative cart total failure',
        content: 'When discount exceeds price * qty, total must clamp at zero before verification can pass.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.94,
        deletablePath: join(evidenceDir, 'exp-cart-negative-discount-failure.json'),
        relatedFiles: [sourcePath],
        outcome: 'failed',
        tags: ['cart', 'discount', 'Math.max'],
      },
      {
        id: 'exp-cart-focused-verification',
        kind: 'verification_command',
        title: 'Cart focused verification',
        content: `Run bun test ${testPath} after editing cart total.`,
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.92,
        deletablePath: join(evidenceDir, 'exp-cart-focused-verification.json'),
        relatedFiles: [testPath],
        tags: ['bun-test', 'cart'],
      },
      {
        id: 'exp-cart-success-fix',
        kind: 'success_fix',
        title: 'Clamp cart total',
        content: 'Use Math.max(0, price * qty - discount), then rerun the focused test.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.95,
        deletablePath: join(evidenceDir, 'exp-cart-success-fix.json'),
        relatedFiles: [sourcePath],
        outcome: 'passed',
        tags: ['cart', 'success', 'Math.max'],
        usage: {
          model: costRoute.requestedModel,
          routeReason: costRoute.routeReason,
          modelEvidence: costRoute.modelEvidence,
          inputTokens: 6_000,
          outputTokens: 800,
          toolCalls: coldEvents.length,
          costUsd,
          tracePath,
        },
      },
      {
        id: 'exp-cart-cost-route',
        kind: 'cost_route',
        title: 'Failed verification routes recovery to Pro',
        content: costRoute.modelEvidence,
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.96,
        deletablePath: join(evidenceDir, 'exp-cart-cost-route.json'),
        evidencePath,
        relatedFiles: [sourcePath, testPath],
        outcome: 'passed',
        tags: ['deepseek-v4', 'cost-router', 'failed-verification'],
        usage: {
          model: costRoute.requestedModel,
          routeReason: costRoute.routeReason,
          modelEvidence: costRoute.modelEvidence,
          inputTokens: 6_000,
          outputTokens: 800,
          toolCalls: coldEvents.length,
          costUsd,
          tracePath,
        },
      },
      {
        id: 'exp-user-pref-delete-me',
        kind: 'user_preference',
        title: 'Temporary preference',
        content: 'Temporary preference used to prove deletable memory.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.88,
        deletablePath: join(evidenceDir, 'exp-user-pref-delete-me.json'),
        tags: ['delete-me'],
      },
    ]

    for (const entry of entries) {
      const result = recordDsxuExperience(store, entry)
      if (!result.accepted) throw new Error(result.reason)
    }
    event('experience_recorded')
    event('cost_route_recorded')

    const deleteResult = deleteDsxuExperience(store, 'exp-user-pref-delete-me', '2026-05-06T00:01:00.000Z')
    if (deleteResult.deleted) deletedIds.push('exp-user-pref-delete-me')
    event('experience_deleted')

    const recalls = recallDsxuExperience({
      store,
      query: 'fix cart total negative discount bug and run focused test',
      currentSourceFiles: [sourcePath, testPath],
      maxEntries: 4,
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath, testPath],
    })
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'Repeat cart total negative discount fix with ExperienceStore hints.',
      scope: fixtureDir,
      filesRead: [],
      filesChanged: [sourcePath],
      failedCommands: [`bun test ${testPath}`],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: ['read source truth', 'apply focused fix', 'verify'],
      workflowPreferencesApplied: ['ExperienceStore is read-only'],
      nextAction: 'Read source truth, edit one line, run focused verification.',
      verificationStatus: 'failed',
      createdAt: '2026-05-06T00:02:00.000Z',
    })
    const resume = buildDsxuExperienceSmoothResume({ snapshot, injection })
    const explanation = explainDsxuExperienceRecall(recalls)
    event('experience_recalled')

    const sourceBeforeEdit = await readFile(sourcePath, 'utf8')
    event('warm_read_source_truth')
    if (!sourceBeforeEdit.includes('price * qty - discount')) {
      throw new Error('fixture source did not contain expected bug')
    }
    await writeFile(
      sourcePath,
      sourceBeforeEdit.replace(
        'return price * qty - discount',
        'return Math.max(0, price * qty - discount)',
      ),
      'utf8',
    )
    event('warm_edit_source')

    const verify = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    stdout = verify.stdout
    stderr = verify.stderr
    event('warm_verify_passed')

    const warmEvents = [
      'experience_recalled',
      'warm_read_source_truth',
      'warm_edit_source',
      'warm_verify_passed',
    ]
    const coldMetrics: DsxuExperienceReplayMetrics = {
      toolCalls: coldEvents.length,
      readCalls: 3,
      verificationRuns: 2,
      estimatedTokens: estimateTokens(coldEvents, failed.stdout ?? '', failed.stderr ?? ''),
    }
    const warmMetrics: DsxuExperienceReplayMetrics = {
      toolCalls: warmEvents.length,
      readCalls: 1,
      verificationRuns: 1,
      estimatedTokens: estimateTokens(warmEvents, stdout, stderr),
    }
    const replayReport = buildDsxuExperienceReplayReport({
      cold: coldMetrics,
      warm: warmMetrics,
      planning: injection.planning,
    })
    const traceIndex = {
      tracePath,
      evidencePath,
      eventCount: events.length + 1,
    }
    event('trace_indexed')
    const readBeforeEdit = events.indexOf('warm_read_source_truth') < events.indexOf('warm_edit_source')
    const verified = /\b1\s+pass\b/i.test(`${stdout}\n${stderr}`)
    const result: ExperienceStoreReplayResult = {
      ok:
        recalls.length >= 3 &&
        injection.memory.sourceTruthRefreshRequired &&
        resume.mayClaimPass === false &&
        readBeforeEdit &&
        verified &&
        replayReport.repeatedExplorationReduced &&
        costRoute.requestedModel === 'deepseek-v4-pro' &&
        costRoute.routeReason === 'failed_verification_pro_thinking_max' &&
        costUsd > 0 &&
        traceIndex.tracePath === tracePath &&
        deletedIds.includes('exp-user-pref-delete-me'),
      tracePath,
      evidencePath,
      fixtureDir,
      recordedKinds: store.entries.map(entry => entry.kind),
      recallIds: recalls.map(recall => recall.entry.id),
      deletedIds,
      sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
      mayClaimPassBeforeVerify: resume.mayClaimPass,
      readBeforeEdit,
      verified,
      replayReport,
      costRouteEvidence: {
        model: costRoute.requestedModel,
        routeReason: costRoute.routeReason,
        modelEvidence: costRoute.modelEvidence,
        maxTokens: costRoute.maxTokens,
        costUsd,
      },
      traceIndex,
      traceIndexed: traceIndex.tracePath === tracePath && traceIndex.evidencePath === evidencePath,
      explanation,
      events,
      stdout,
      stderr,
    }

    await writeJson(tracePath, {
      events,
      coldEvents,
      costRoute,
      costUsd,
      recalls,
      injection,
      resume,
      replayReport,
      traceIndex,
      explanation,
      tombstones: store.tombstones,
    })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: ExperienceStoreReplayResult = {
      ok: false,
      tracePath,
      evidencePath,
      fixtureDir,
      recordedKinds: [],
      recallIds: [],
      deletedIds,
      sourceTruthRefreshRequired: false,
      mayClaimPassBeforeVerify: false,
      readBeforeEdit: false,
      verified: false,
      replayReport: buildDsxuExperienceReplayReport({
        cold: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
        warm: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      }),
      costRouteEvidence: {
        model: 'unknown',
        routeReason: 'error',
        modelEvidence: '',
        maxTokens: 0,
        costUsd: 0,
      },
      traceIndex: {
        tracePath,
        evidencePath,
        eventCount: events.length,
      },
      traceIndexed: false,
      explanation: '',
      events,
      stdout,
      stderr,
      error: caught instanceof Error ? caught.message : String(caught),
    }
    await writeJson(tracePath, { events, error: result.error })
    await writeJson(evidencePath, result)
    return result
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}
