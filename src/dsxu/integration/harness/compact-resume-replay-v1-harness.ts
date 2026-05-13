import { execFile } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import {
  buildCompactRecoverySnapshot,
  renderCompactRecoverySnapshot,
} from '../../engine/compact'
import {
  buildDsxuLocalMemoryReadOnlyBundle,
  buildDsxuSmoothResumePlan,
  createDsxuTaskStateSnapshot,
} from '../../engine/task-governance'

const execFileAsync = promisify(execFile)

export type CompactResumeReplayResult = {
  ok: boolean
  evidencePath: string
  tracePath: string
  fixtureDir: string
  schemaVersion: string
  renderedSnapshot: string
  events: string[]
  readBeforeEdit: boolean
  verifiedAfterResume: boolean
  mayClaimPassBeforeVerify: boolean
  preservedUserInstructions: boolean
  preservedFailedCommand: boolean
  preservedPermissionDenial: boolean
  preservedPendingAgent: boolean
  sourceTruthRefreshRequired: boolean
  stdout: string
  stderr: string
  error?: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runCompactResumeReplayHarness(options: {
  evidenceDir?: string
} = {}): Promise<CompactResumeReplayResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-resume')
  await mkdir(evidenceDir, { recursive: true })
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-compact-resume-'))
  const srcDir = join(fixtureDir, 'src')
  await mkdir(srcDir, { recursive: true })
  const sourcePath = join(srcDir, 'score.ts')
  const testPath = join(srcDir, 'score.test.ts')
  const tracePath = join(evidenceDir, 'compact-resume-replay.trace.json')
  const evidencePath = join(evidenceDir, 'compact-resume-replay.evidence.json')
  const events: string[] = []
  let stdout = ''
  let stderr = ''

  function event(name: string): void {
    events.push(name)
  }

  try {
    await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n', 'utf8')
    await writeFile(
      sourcePath,
      [
        'export function score(raw: number): number {',
        '  return raw',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      testPath,
      [
        "import { expect, test } from 'bun:test'",
        "import { score } from './score'",
        '',
        "test('score is clamped between 0 and 100', () => {",
        '  expect(score(-5)).toBe(0)',
        '  expect(score(120)).toBe(100)',
        '  expect(score(80)).toBe(80)',
        '})',
        '',
      ].join('\n'),
      'utf8',
    )
    event('fixture_created')

    const compactSnapshot = buildCompactRecoverySnapshot({
      primaryRequest: 'Finish score clamp bugfix after compact recovery.',
      userInstructions: [
        'Keep DSXU single mainline',
        'Do not claim PASS before focused verification',
      ],
      changedFiles: [sourcePath],
      pendingTasks: ['reread source truth', 'edit score clamp', 'run focused bun test'],
      pendingAgents: ['verifier:agent-score-clamp waiting for PASS evidence'],
      failedCommands: [`bun test ${testPath} -> expected 0 and 100 clamp`],
      permissionDenials: ['PowerShell write outside workspace denied'],
      recoveryDecisions: ['resume from compact schema before editing'],
      verificationStatus: 'partial',
      nextActions: ['Read score.ts', 'Edit one return statement', `bun test ${testPath}`],
    })
    const renderedSnapshot = renderCompactRecoverySnapshot(compactSnapshot)
    event('compact_snapshot_rendered')

    const taskSnapshot = createDsxuTaskStateSnapshot({
      goal: compactSnapshot.primaryRequest,
      scope: fixtureDir,
      filesRead: [],
      filesChanged: [sourcePath],
      failedCommands: compactSnapshot.failedCommands,
      permissionDenials: compactSnapshot.permissionDenials,
      activeAgents: compactSnapshot.pendingAgents,
      pendingTasks: compactSnapshot.pendingTasks,
      workflowPreferencesApplied: compactSnapshot.userInstructions,
      nextAction: compactSnapshot.nextActions[0] ?? 'Read source truth',
      verificationStatus: compactSnapshot.verificationStatus,
      createdAt: '2026-05-06T02:00:00.000Z',
    })
    const memory = buildDsxuLocalMemoryReadOnlyBundle({
      currentSourceFiles: [sourcePath, testPath],
      entries: [
        {
          id: 'compact-score-resume',
          kind: 'task_snapshot',
          title: 'Score clamp compact recovery',
          content: renderedSnapshot,
          sourcePath: evidencePath,
          createdAt: '2026-05-06T02:00:00.000Z',
          confidence: 0.94,
          deletablePath: join(evidenceDir, 'compact-score-resume.json'),
          relatedFiles: [sourcePath, testPath],
        },
      ],
    })
    const resumePlan = buildDsxuSmoothResumePlan({ snapshot: taskSnapshot, memory })
    event('resume_plan_created')

    const before = await readFile(sourcePath, 'utf8')
    event('source_truth_reread')
    await writeFile(
      sourcePath,
      before.replace('return raw', 'return Math.max(0, Math.min(100, raw))'),
      'utf8',
    )
    event('source_edited_after_resume')
    const verify = await execFileAsync('bun', ['test', testPath], {
      cwd: fixtureDir,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    stdout = verify.stdout
    stderr = verify.stderr
    event('focused_verify_passed')

    const readBeforeEdit = events.indexOf('source_truth_reread') < events.indexOf('source_edited_after_resume')
    const verifiedAfterResume = /\b1\s+pass\b/i.test(`${stdout}\n${stderr}`)
    const result: CompactResumeReplayResult = {
      ok:
        readBeforeEdit &&
        verifiedAfterResume &&
        resumePlan.mayClaimPass === false &&
        memory.sourceTruthRefreshRequired &&
        renderedSnapshot.includes('dsxu.compact-recovery.v1') &&
        renderedSnapshot.includes('Keep DSXU single mainline') &&
        compactSnapshot.failedCommands.some(command =>
          command.includes('bun test') && command.includes('score.test.ts'),
        ) &&
        renderedSnapshot.includes('PowerShell write outside workspace denied') &&
        renderedSnapshot.includes('verifier:agent-score-clamp'),
      evidencePath,
      tracePath,
      fixtureDir,
      schemaVersion: compactSnapshot.schemaVersion,
      renderedSnapshot,
      events,
      readBeforeEdit,
      verifiedAfterResume,
      mayClaimPassBeforeVerify: resumePlan.mayClaimPass,
      preservedUserInstructions: renderedSnapshot.includes('Keep DSXU single mainline'),
      preservedFailedCommand: compactSnapshot.failedCommands.some(command =>
        command.includes('bun test') && command.includes('score.test.ts'),
      ),
      preservedPermissionDenial: renderedSnapshot.includes('PowerShell write outside workspace denied'),
      preservedPendingAgent: renderedSnapshot.includes('verifier:agent-score-clamp'),
      sourceTruthRefreshRequired: memory.sourceTruthRefreshRequired,
      stdout,
      stderr,
    }
    await writeJson(tracePath, {
      events,
      compactSnapshot,
      taskSnapshot,
      memory,
      resumePlan,
      renderedSnapshot,
    })
    await writeJson(evidencePath, result)
    return result
  } catch (caught) {
    const result: CompactResumeReplayResult = {
      ok: false,
      evidencePath,
      tracePath,
      fixtureDir,
      schemaVersion: 'unknown',
      renderedSnapshot: '',
      events,
      readBeforeEdit: events.indexOf('source_truth_reread') >= 0 && events.indexOf('source_truth_reread') < events.indexOf('source_edited_after_resume'),
      verifiedAfterResume: false,
      mayClaimPassBeforeVerify: false,
      preservedUserInstructions: false,
      preservedFailedCommand: false,
      preservedPermissionDenial: false,
      preservedPendingAgent: false,
      sourceTruthRefreshRequired: false,
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
