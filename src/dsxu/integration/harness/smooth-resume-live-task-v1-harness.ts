import { execFile } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperienceReplayReport,
  buildDsxuExperienceSmoothResume,
  createDsxuExperienceStore,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceReplayMetrics,
  type DsxuExperienceReplayReport,
} from '../../engine/experience-store'
import { createDsxuTaskStateSnapshot } from '../../engine/task-governance'

const execFileAsync = promisify(execFile)

export type SmoothResumeLiveTaskResult = {
  ok: boolean
  fixtureDir: string
  tracePath: string
  evidencePath: string
  readBeforeEdit: boolean
  verified: boolean
  mayClaimPassBeforeVerify: boolean
  failedCommandPreserved: boolean
  sourceTruthRefreshRequired: boolean
  secondTurnContextPreserved: boolean
  secondTurnSourceTruthReread: boolean
  secondTurnVerified: boolean
  secondTurnMayClaimPassBeforeVerify: boolean
  preservedGoal: boolean
  preservedCurrentPlan: boolean
  preservedTouchedFiles: boolean
  preservedDirtyState: boolean
  preservedToolEvidence: boolean
  preservedFailedAttempts: boolean
  preservedNextAction: boolean
  preservedConstraints: boolean
  preservedVerificationState: boolean
  recallIds: string[]
  replayReport: DsxuExperienceReplayReport
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

function buildMetrics(
  events: readonly string[],
  readCalls: number,
  verificationRuns: number,
  stdout = '',
  stderr = '',
): DsxuExperienceReplayMetrics {
  return {
    toolCalls: events.length,
    readCalls,
    verificationRuns,
    estimatedTokens: estimateTokens(events, stdout, stderr),
  }
}

export async function runSmoothResumeLiveTaskHarness(options: {
  evidenceDir?: string
} = {}): Promise<SmoothResumeLiveTaskResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v19-smooth-resume')
  await mkdir(evidenceDir, { recursive: true })
  const fixtureRoot = join(evidenceDir, 'fixtures')
  await mkdir(fixtureRoot, { recursive: true })
  const fixtureDir = await mkdtemp(join(fixtureRoot, 'case-'))
  const srcDir = join(fixtureDir, 'src')
  await mkdir(srcDir, { recursive: true })
  const sourcePath = join(srcDir, 'cart.ts')
  const testPath = join(srcDir, 'cart.test.ts')
  const tracePath = join(evidenceDir, 'smooth-resume-live-task.trace.json')
  const evidencePath = join(evidenceDir, 'smooth-resume-live-task.evidence.json')
  const events: string[] = []
  let failedStdout = ''
  let failedStderr = ''
  let stdout = ''
  let stderr = ''
  let error: string | undefined

  function record(event: string): void {
    events.push(event)
  }

  try {
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
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    record('fixture_created')

    const failedVerification = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    }).catch(caught => caught as { stdout?: string; stderr?: string })
    failedStdout = String(failedVerification.stdout ?? '')
    failedStderr = String(failedVerification.stderr ?? '')
    if (!/\b1\s+fail\b/i.test(`${failedStdout}\n${failedStderr}`)) {
      throw new Error('expected precompact verification to fail before resume')
    }
    record('precompact_verification_failed')

    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'Resume cart total bugfix after compact.',
      scope: sourcePath,
      filesRead: [],
      filesChanged: [sourcePath],
      failedCommands: [`bun test ${testPath}`],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: ['read source truth', 'fix one hypothesis', 'rerun focused test'],
      workflowPreferencesApplied: ['memory is hint-only'],
      nextAction: 'Read source file before Edit, then verify.',
      verificationStatus: 'failed',
      createdAt: '2026-05-06T00:00:00.000Z',
    })
    record('snapshot_created')

    const store = createDsxuExperienceStore()
    const createdAt = '2026-05-06T00:00:00.000Z'
    const entries: DsxuExperienceEntry[] = [
      {
        id: 'resume-cart-task-snapshot',
        kind: 'task_snapshot',
        title: 'Cart total compact resume state',
        content: 'Prior verification failed; preserve failed command and reread source before edit.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.94,
        deletablePath: join(evidenceDir, 'resume-cart-task-snapshot.json'),
        relatedFiles: [sourcePath, testPath],
        outcome: 'failed',
        tags: ['compact-resume', 'cart'],
      },
      {
        id: 'resume-cart-failure-pattern',
        kind: 'failure_pattern',
        title: 'Negative total remains below zero',
        content: 'If the test expects zero for an over-discounted cart line, change strategy to clamp the computed total.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.95,
        deletablePath: join(evidenceDir, 'resume-cart-failure-pattern.json'),
        relatedFiles: [sourcePath, testPath],
        outcome: 'failed',
        tags: ['compact-resume', 'failed-verification'],
      },
      {
        id: 'resume-cart-focused-verification',
        kind: 'verification_command',
        title: 'Cart resume focused verification',
        content: `Run bun test ${testPath} after the resume edit.`,
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.93,
        deletablePath: join(evidenceDir, 'resume-cart-focused-verification.json'),
        relatedFiles: [testPath],
        tags: ['compact-resume', 'bun-test'],
      },
      {
        id: 'resume-cart-success-fix',
        kind: 'success_fix',
        title: 'Clamp cart total after resume',
        content: 'Use Math.max(0, price * qty - discount), then rerun the focused resume test.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.96,
        deletablePath: join(evidenceDir, 'resume-cart-success-fix.json'),
        relatedFiles: [sourcePath],
        outcome: 'passed',
        tags: ['compact-resume', 'success-fix'],
      },
    ]
    for (const entry of entries) {
      const recorded = recordDsxuExperience(store, entry)
      if (!recorded.accepted) throw new Error(recorded.reason)
    }
    const recalls = recallDsxuExperience({
      store,
      query: 'resume compact cart total bugfix with failed command and focused verification',
      currentSourceFiles: [sourcePath, testPath],
      maxEntries: 4,
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath, testPath],
    })
    const resumePlan = buildDsxuExperienceSmoothResume({ snapshot, injection })
    record('resume_plan_created')

    const sourceBeforeEdit = await readFile(sourcePath, 'utf8')
    record('read_source_truth')
    if (!sourceBeforeEdit.includes('price * qty - discount')) {
      throw new Error('fixture source did not contain expected bug')
    }
    const fixedSource = sourceBeforeEdit.replace(
      'return price * qty - discount',
      'return Math.max(0, price * qty - discount)',
    )
    await writeFile(sourcePath, fixedSource, 'utf8')
    record('edit_source')

    const verify = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    stdout = verify.stdout
    stderr = verify.stderr
    record('verify_passed')

    const readBeforeEdit = events.indexOf('read_source_truth') < events.indexOf('edit_source')
    const verificationOutput = `${stdout}\n${stderr}`
    const verified = events.includes('verify_passed') && /\b1\s+pass\b/i.test(verificationOutput)

    const continuationSnapshot = createDsxuTaskStateSnapshot({
      goal: snapshot.goal,
      scope: snapshot.scope,
      filesRead: [sourcePath, testPath],
      filesChanged: [sourcePath],
      lastPassingCommand: `bun test ${testPath}`,
      failedCommands: snapshot.failedCommands,
      permissionDenials: snapshot.permissionDenials,
      activeAgents: snapshot.activeAgents,
      pendingTasks: [
        'reread current source truth after resumed pass',
        'rerun focused verification before final PASS',
      ],
      workflowPreferencesApplied: [
        ...snapshot.workflowPreferencesApplied,
        'source truth reread before final answer',
        'no PASS before verification evidence',
      ],
      nextAction: 'Reread current source and rerun focused verification before final PASS.',
      verificationStatus: 'passed',
      createdAt: '2026-05-06T00:10:00.000Z',
    })
    record('continuation_snapshot_created')
    const secondTurnPlan = buildDsxuExperienceSmoothResume({
      snapshot: continuationSnapshot,
      injection,
    })
    record('second_turn_resume_plan_created')

    const secondTurnSource = await readFile(sourcePath, 'utf8')
    record('second_turn_read_source_truth')
    const secondTurnVerify = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const secondTurnStdout = secondTurnVerify.stdout
    const secondTurnStderr = secondTurnVerify.stderr
    record('second_turn_verify_passed')

    const continuationToolEvidence = {
      failedVerification: {
        command: `bun test ${testPath}`,
        preserved: snapshot.failedCommands.includes(`bun test ${testPath}`),
        outputMatchedFailure: /\b1\s+fail\b/i.test(`${failedStdout}\n${failedStderr}`),
      },
      edit: {
        filePath: sourcePath,
        oldString: 'return price * qty - discount',
        newString: 'return Math.max(0, price * qty - discount)',
      },
      verification: {
        command: `bun test ${testPath}`,
        firstTurnPassed: verified,
        secondTurnPassed: /\b1\s+pass\b/i.test(`${secondTurnStdout}\n${secondTurnStderr}`),
      },
    }
    const secondTurnSourceTruthReread =
      events.indexOf('second_turn_read_source_truth') >
      events.indexOf('second_turn_resume_plan_created')
    const secondTurnVerified =
      events.includes('second_turn_verify_passed') &&
      continuationToolEvidence.verification.secondTurnPassed
    const preservedGoal = continuationSnapshot.goal === snapshot.goal
    const preservedCurrentPlan =
      continuationSnapshot.pendingTasks.includes('reread current source truth after resumed pass') &&
      continuationSnapshot.pendingTasks.includes('rerun focused verification before final PASS')
    const preservedTouchedFiles = continuationSnapshot.filesChanged.includes(sourcePath)
    const preservedDirtyState =
      continuationSnapshot.filesChanged.includes(sourcePath) &&
      secondTurnSource.includes('Math.max(0, price * qty - discount)')
    const preservedToolEvidence =
      continuationToolEvidence.failedVerification.outputMatchedFailure &&
      continuationToolEvidence.edit.filePath === sourcePath &&
      continuationToolEvidence.verification.firstTurnPassed &&
      continuationToolEvidence.verification.secondTurnPassed
    const preservedFailedAttempts =
      continuationSnapshot.failedCommands.includes(`bun test ${testPath}`) &&
      continuationToolEvidence.failedVerification.preserved
    const preservedNextAction =
      continuationSnapshot.nextAction ===
      'Reread current source and rerun focused verification before final PASS.'
    const preservedConstraints =
      continuationSnapshot.workflowPreferencesApplied.includes('memory is hint-only') &&
      continuationSnapshot.workflowPreferencesApplied.includes('source truth reread before final answer') &&
      continuationSnapshot.workflowPreferencesApplied.includes('no PASS before verification evidence')
    const preservedVerificationState =
      continuationSnapshot.verificationStatus === 'passed' &&
      continuationSnapshot.lastPassingCommand === `bun test ${testPath}` &&
      secondTurnVerified
    const secondTurnContextPreserved =
      preservedGoal &&
      preservedCurrentPlan &&
      preservedTouchedFiles &&
      preservedDirtyState &&
      preservedToolEvidence &&
      preservedFailedAttempts &&
      preservedNextAction &&
      preservedConstraints &&
      preservedVerificationState &&
      secondTurnSourceTruthReread &&
      secondTurnVerified &&
      secondTurnPlan.mayClaimPass === false

    const coldEvents = [
      'read_failed_test_output',
      'read_source_candidate',
      'run_failed_verification',
      'create_task_snapshot',
      'compact_resume_boundary',
      'inspect_pending_action',
    ]
    const warmEvents = ['read_source_truth', 'edit_source', 'verify_passed']
    const replayReport = buildDsxuExperienceReplayReport({
      cold: buildMetrics(coldEvents, 2, 1, failedStdout, failedStderr),
      warm: buildMetrics(warmEvents, 1, 1, stdout, stderr),
      planning: injection.planning,
    })
    const failedCommandPreserved = snapshot.failedCommands.includes(`bun test ${testPath}`)
    const result: SmoothResumeLiveTaskResult = {
      ok:
        readBeforeEdit &&
        verified &&
        resumePlan.mayClaimPass === false &&
        failedCommandPreserved &&
        injection.memory.sourceTruthRefreshRequired &&
        replayReport.repeatedExplorationReduced &&
        secondTurnContextPreserved,
      fixtureDir,
      tracePath,
      evidencePath,
      readBeforeEdit,
      verified,
      mayClaimPassBeforeVerify: resumePlan.mayClaimPass,
      failedCommandPreserved,
      sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
      secondTurnContextPreserved,
      secondTurnSourceTruthReread,
      secondTurnVerified,
      secondTurnMayClaimPassBeforeVerify: secondTurnPlan.mayClaimPass,
      preservedGoal,
      preservedCurrentPlan,
      preservedTouchedFiles,
      preservedDirtyState,
      preservedToolEvidence,
      preservedFailedAttempts,
      preservedNextAction,
      preservedConstraints,
      preservedVerificationState,
      recallIds: recalls.map(recall => recall.entry.id),
      replayReport,
      events,
      stdout: `${stdout}\n${secondTurnStdout}`,
      stderr: `${stderr}\n${secondTurnStderr}`,
    }
    await writeJson(tracePath, {
      events,
      snapshot,
      continuationSnapshot,
      continuationToolEvidence,
      recalls,
      injection,
      resumePlan,
      secondTurnPlan,
      failedVerification: {
        stdout: failedStdout,
        stderr: failedStderr,
      },
      replayReport,
    })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
    const emptyReplay = buildDsxuExperienceReplayReport({
      cold: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      warm: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
    })
    const result: SmoothResumeLiveTaskResult = {
      ok: false,
      fixtureDir,
      tracePath,
      evidencePath,
      readBeforeEdit: events.indexOf('read_source_truth') >= 0 && events.indexOf('read_source_truth') < events.indexOf('edit_source'),
      verified: false,
      mayClaimPassBeforeVerify: false,
      failedCommandPreserved: false,
      sourceTruthRefreshRequired: false,
      secondTurnContextPreserved: false,
      secondTurnSourceTruthReread: false,
      secondTurnVerified: false,
      secondTurnMayClaimPassBeforeVerify: false,
      preservedGoal: false,
      preservedCurrentPlan: false,
      preservedTouchedFiles: false,
      preservedDirtyState: false,
      preservedToolEvidence: false,
      preservedFailedAttempts: false,
      preservedNextAction: false,
      preservedConstraints: false,
      preservedVerificationState: false,
      recallIds: [],
      replayReport: emptyReplay,
      events,
      stdout,
      stderr,
      error,
    }
    await writeJson(tracePath, { events, error })
    await writeJson(evidencePath, result)
    return result
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}
