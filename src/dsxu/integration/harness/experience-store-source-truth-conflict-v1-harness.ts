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
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceReplayMetrics,
  type DsxuExperienceReplayReport,
} from '../../engine/experience-store'
import { createDsxuTaskStateSnapshot } from '../../engine/task-governance'

const execFileAsync = promisify(execFile)

export type ExperienceStoreSourceTruthConflictResult = {
  ok: boolean
  tracePath: string
  evidencePath: string
  fixtureDir: string
  recallIds: string[]
  staleRecallIds: readonly string[]
  overlappingRecallIds: readonly string[]
  staleTarget: string
  selectedEditTarget: string
  staleTargetRejected: boolean
  currentSourceWon: boolean
  sourceTruthRefreshRequired: boolean
  readBeforeEdit: boolean
  verified: boolean
  mayClaimPassBeforeVerify: boolean
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
  } catch (caught: any) {
    return {
      ok: false,
      stdout: String(caught?.stdout ?? ''),
      stderr: String(caught?.stderr ?? caught?.message ?? caught),
    }
  }
}

export async function runExperienceStoreSourceTruthConflictHarness(options: {
  evidenceDir?: string
} = {}): Promise<ExperienceStoreSourceTruthConflictResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-experience-store')
  await mkdir(evidenceDir, { recursive: true })
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-experience-conflict-'))
  const tracePath = join(evidenceDir, 'experience-store-source-truth-conflict.trace.json')
  const evidencePath = join(evidenceDir, 'experience-store-source-truth-conflict.evidence.json')
  const events: string[] = []
  let stdout = ''
  let stderr = ''

  function event(name: string): void {
    events.push(name)
  }

  try {
    const srcDir = join(fixtureDir, 'src')
    await mkdir(srcDir, { recursive: true })
    const sourcePath = join(srcDir, 'invoice.ts')
    const testPath = join(srcDir, 'invoice.test.ts')
    const stalePath = join(srcDir, 'legacyInvoice.ts')
    const staleTestPath = join(srcDir, 'legacyInvoice.test.ts')
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    await writeFile(
      sourcePath,
      [
        'export function invoiceLabel(customer: string, paid: boolean): string {',
        "  return `${customer}: unpaid`",
        '}',
        '',
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      testPath,
      [
        "import { expect, test } from 'bun:test'",
        "import { invoiceLabel } from './invoice'",
        '',
        "test('shows current paid status in invoice labels', () => {",
        "  expect(invoiceLabel('Ada', true)).toBe('Ada: paid')",
        "  expect(invoiceLabel('Ada', false)).toBe('Ada: unpaid')",
        '})',
        '',
      ].join('\n'),
      'utf8',
    )
    event('fixture_created')

    const coldEvents = [
      'read_legacy_memory',
      'read_project_tree',
      'read_current_test',
      'read_current_source',
      'run_failed_current_verification',
      'reject_stale_edit_target',
      'edit_current_source',
      'run_passing_current_verification',
    ]
    const coldFailure = await runBunTest(testPath, fixtureDir)
    if (coldFailure.ok) throw new Error('expected current fixture verification to fail before edit')
    event('cold_verification_failed')

    const store = createDsxuExperienceStore()
    const createdAt = '2026-05-06T04:00:00.000Z'
    const entries: DsxuExperienceEntry[] = [
      {
        id: 'exp-invoice-stale-legacy-success',
        kind: 'success_fix',
        title: 'Legacy invoice archived label',
        content: 'Old memory says edit src/legacyInvoice.ts and return archived invoice labels.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.99,
        deletablePath: join(evidenceDir, 'exp-invoice-stale-legacy-success.json'),
        relatedFiles: [stalePath, staleTestPath],
        outcome: 'passed',
        tags: ['invoice', 'paid', 'legacy', 'success-fix'],
      },
      {
        id: 'exp-invoice-current-files',
        kind: 'project_fact',
        title: 'Current invoice focused files',
        content: 'The active invoice label task lives in src/invoice.ts and src/invoice.test.ts.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.91,
        deletablePath: join(evidenceDir, 'exp-invoice-current-files.json'),
        relatedFiles: [sourcePath, testPath],
        tags: ['invoice', 'current-source'],
      },
      {
        id: 'exp-invoice-current-failure',
        kind: 'failure_pattern',
        title: 'Invoice paid flag ignored',
        content: 'If paid=true still returns unpaid, change current invoice.ts to branch on the paid flag.',
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.94,
        deletablePath: join(evidenceDir, 'exp-invoice-current-failure.json'),
        relatedFiles: [sourcePath, testPath],
        outcome: 'failed',
        tags: ['invoice', 'paid', 'failed-verification'],
      },
      {
        id: 'exp-invoice-current-success',
        kind: 'success_fix',
        title: 'Use current paid status',
        content: "Return `${customer}: ${paid ? 'paid' : 'unpaid'}` after rereading src/invoice.ts.",
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.96,
        deletablePath: join(evidenceDir, 'exp-invoice-current-success.json'),
        relatedFiles: [sourcePath],
        outcome: 'passed',
        tags: ['invoice', 'paid', 'success-fix'],
      },
      {
        id: 'exp-invoice-current-verify',
        kind: 'verification_command',
        title: 'Invoice focused verification',
        content: `Run bun test ${testPath}; current verification output wins over recalled memory.`,
        sourcePath: evidencePath,
        createdAt,
        confidence: 0.93,
        deletablePath: join(evidenceDir, 'exp-invoice-current-verify.json'),
        relatedFiles: [testPath],
        tags: ['invoice', 'bun-test'],
      },
    ]

    for (const entry of entries) {
      const recorded = recordDsxuExperience(store, entry)
      if (!recorded.accepted) throw new Error(recorded.reason)
    }
    event('experience_recorded')

    const recalls = recallDsxuExperience({
      store,
      query: 'fix invoice paid status; ignore stale legacy invoice memory if current source differs',
      currentSourceFiles: [sourcePath, testPath],
      maxEntries: 5,
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath, testPath],
    })
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'Resume invoice paid-status fix with stale memory conflict.',
      scope: fixtureDir,
      filesRead: [],
      filesChanged: [sourcePath],
      failedCommands: [`bun test ${testPath}`],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: ['reject stale legacy path', 'read current source truth', 'verify current test'],
      workflowPreferencesApplied: ['ExperienceStore is read-only'],
      nextAction: 'Read current invoice.ts before Edit; never edit legacyInvoice.ts from memory.',
      verificationStatus: 'failed',
      createdAt: '2026-05-06T04:01:00.000Z',
    })
    const resume = buildDsxuExperienceSmoothResume({ snapshot, injection })
    event('experience_recalled')

    const guard = injection.sourceTruthGuard
    const selectedEditTarget = sourcePath
    const staleTargetRejected =
      guard.staleRecallIds.includes('exp-invoice-stale-legacy-success') &&
      selectedEditTarget !== stalePath &&
      !guard.rereadFiles.includes(stalePath)
    if (!staleTargetRejected) throw new Error('stale legacy recall was not rejected as an edit target')
    event('stale_memory_rejected')

    const sourceBeforeEdit = await readFile(selectedEditTarget, 'utf8')
    event('read_current_source_truth')
    const fixedSource = sourceBeforeEdit.replace(
      "return `${customer}: unpaid`",
      "return `${customer}: ${paid ? 'paid' : 'unpaid'}`",
    )
    await writeFile(selectedEditTarget, fixedSource, 'utf8')
    event('edit_current_source')

    const verify = await runBunTest(testPath, fixtureDir)
    stdout = verify.stdout
    stderr = verify.stderr
    if (!verify.ok) throw new Error(`expected focused verification to pass: ${stderr || stdout}`)
    event('verify_current_test_passed')

    const warmEvents = [
      'experience_recalled',
      'stale_memory_rejected',
      'read_current_source_truth',
      'edit_current_source',
      'verify_current_test_passed',
    ]
    const replayReport = buildDsxuExperienceReplayReport({
      cold: buildMetrics(coldEvents, 4, 2, coldFailure.stdout, coldFailure.stderr),
      warm: buildMetrics(warmEvents, 1, 1, stdout, stderr),
      planning: injection.planning,
    })
    const readBeforeEdit = events.indexOf('read_current_source_truth') < events.indexOf('edit_current_source')
    const verified = verify.ok && /\b1\s+pass\b/i.test(`${stdout}\n${stderr}`)
    const currentSourceWon = selectedEditTarget === sourcePath && guard.policy === 'current-source-wins'
    const result: ExperienceStoreSourceTruthConflictResult = {
      ok:
        recalls.some(recall => recall.entry.id === 'exp-invoice-stale-legacy-success') &&
        staleTargetRejected &&
        currentSourceWon &&
        injection.memory.sourceTruthRefreshRequired &&
        readBeforeEdit &&
        verified &&
        resume.mayClaimPass === false &&
        replayReport.repeatedExplorationReduced &&
        replayReport.planningQuality.grade === 'strong',
      tracePath,
      evidencePath,
      fixtureDir,
      recallIds: recalls.map(recall => recall.entry.id),
      staleRecallIds: guard.staleRecallIds,
      overlappingRecallIds: guard.overlappingRecallIds,
      staleTarget: stalePath,
      selectedEditTarget,
      staleTargetRejected,
      currentSourceWon,
      sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
      readBeforeEdit,
      verified,
      mayClaimPassBeforeVerify: resume.mayClaimPass,
      replayReport,
      events,
      stdout,
      stderr,
    }
    await writeJson(tracePath, {
      events,
      coldEvents,
      recalls,
      injection,
      resume,
      replayReport,
      coldFailure,
    })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: ExperienceStoreSourceTruthConflictResult = {
      ok: false,
      tracePath,
      evidencePath,
      fixtureDir,
      recallIds: [],
      staleRecallIds: [],
      overlappingRecallIds: [],
      staleTarget: '',
      selectedEditTarget: '',
      staleTargetRejected: false,
      currentSourceWon: false,
      sourceTruthRefreshRequired: false,
      readBeforeEdit:
        events.indexOf('read_current_source_truth') >= 0 &&
        events.indexOf('read_current_source_truth') < events.indexOf('edit_current_source'),
      verified: false,
      mayClaimPassBeforeVerify: false,
      replayReport: buildDsxuExperienceReplayReport({
        cold: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
        warm: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      }),
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
