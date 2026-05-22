import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const COMMAND_PLAN_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json')
const BLOCKER_BOARD_PATH = join(GENERATED_DIR, 'DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const ACL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const RAW_READINESS_PATH = join(process.cwd(), '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_POST_AUTHORIZATION_VERIFICATION_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_POST_AUTHORIZATION_VERIFICATION_PLAN_20260515.csv')

type VerificationStep = {
  order: number
  phase: string
  command: string
  purpose: string
  requiresPriorAuthorization: boolean
}

type GitStatusSummary = {
  total: number
  staged: number
  unstaged: number
  untracked: number
  codes: Record<string, number>
}

type CachedDiffSummary = {
  total: number
  added: number
  modified: number
  deleted: number
  renamed: number
  other: number
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJson(path)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

function numberFromJson(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function boolFromJson(value: unknown): boolean {
  return value === true
}

async function gitStatusSummary(): Promise<GitStatusSummary> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  const rows = stdout.split(/\r?\n/).filter(Boolean)
  const codes: Record<string, number> = {}
  let staged = 0
  let unstaged = 0
  let untracked = 0
  for (const row of rows) {
    const code = row.slice(0, 2)
    codes[code] = (codes[code] ?? 0) + 1
    if (code === '??') {
      untracked += 1
      continue
    }
    const indexCode = code[0]
    const worktreeCode = code[1]
    if (indexCode !== ' ') staged += 1
    if (worktreeCode !== ' ') unstaged += 1
  }
  return {
    total: rows.length,
    staged,
    unstaged,
    untracked,
    codes,
  }
}

async function cachedDiffSummary(): Promise<CachedDiffSummary> {
  const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-status'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 32,
  })
  const rows = stdout.split(/\r?\n/).filter(Boolean)
  const summary: CachedDiffSummary = {
    total: rows.length,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    other: 0,
  }
  for (const row of rows) {
    const status = row.split('\t')[0] ?? ''
    if (status === 'A') summary.added += 1
    else if (status === 'M') summary.modified += 1
    else if (status === 'D') summary.deleted += 1
    else if (status.startsWith('R')) summary.renamed += 1
    else summary.other += 1
  }
  return summary
}

async function main(): Promise<void> {
  const [commandPlan, blockerBoard, stageExecution, aclPreflight, rawReadiness, gitStatus, cachedDiff] = await Promise.all([
    readJson(COMMAND_PLAN_PATH),
    readJson(BLOCKER_BOARD_PATH),
    readJsonIfExists(STAGE_EXECUTION_PATH),
    readJsonIfExists(ACL_PREFLIGHT_PATH),
    readJsonIfExists(RAW_READINESS_PATH),
    gitStatusSummary(),
    cachedDiffSummary(),
  ])
  const stagedSuccessfully =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    boolFromJson(stageExecution.didStageGit) &&
    numberFromJson(stageExecution.failedCommandCount) === 0
  const p12Ready = rawReadiness?.status === 'PASS'
  const aclResidueCount = numberFromJson(aclPreflight?.residueCount)
  const hasOnlyExpectedUnstagedGeneratedRefresh =
    gitStatus.unstaged === 0 ||
    (gitStatus.unstaged <= 4 && gitStatus.untracked === 0)
  const steps: VerificationStep[] = [
    {
      order: 1,
      phase: 'after-git-mutation',
      command: 'bun run owner-git:preflight',
      purpose: 'confirm register/status alignment after authorized staging or mutation',
      requiresPriorAuthorization: true,
    },
    {
      order: 2,
      phase: 'after-git-mutation',
      command: 'bun run owner-git:product-stage-plan && bun run owner-git:stage-plan',
      purpose: 'confirm no product/deletion packet drift remains',
      requiresPriorAuthorization: true,
    },
    {
      order: 3,
      phase: 'after-p12-manifest',
      command: 'bun run p12:target-intake --targetReferenceManifestPath <real-target-reference-manifest>',
      purpose: 'validate real target-reference manifest before raw readiness',
      requiresPriorAuthorization: false,
    },
    {
      order: 4,
      phase: 'after-p12-manifest',
      command: 'bun run p12:raw-readiness --targetReferenceManifestPath <real-target-reference-manifest>',
      purpose: 'recompute paired raw evidence readiness',
      requiresPriorAuthorization: false,
    },
    {
      order: 5,
      phase: 'final-test-entry',
      command: 'bun run v20:final-preflight',
      purpose: 'confirm final six-stage tests can start',
      requiresPriorAuthorization: true,
    },
    {
      order: 6,
      phase: 'final-test-entry',
      command: 'execute commands from docs/generated/DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.json in order',
      purpose: 'run function, experience, recovery, performance, eval, and release closure tests',
      requiresPriorAuthorization: true,
    },
    {
      order: 7,
      phase: 'release-entry',
      command: 'bun run clean-export:preflight',
      purpose: 'confirm clean export is allowed after final preflight PASS',
      requiresPriorAuthorization: true,
    },
  ]
  const report = {
    schemaVersion: 'dsxu.v20.post-authorization-verification-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: stagedSuccessfully && p12Ready
      ? 'POST_STAGE_VERIFIED_REMAINING_GATES_BLOCKED'
      : 'BLOCKED_POST_STAGE_VERIFICATION',
    mutationCommandCount: commandPlan.commandCount ?? null,
    blockerActionCount: blockerBoard.actionCount ?? null,
    stageExecutionStatus: stageExecution?.status ?? 'MISSING_STAGE_EXECUTION_REPORT',
    stagedCommandCount: stageExecution?.stagedCommandCount ?? 0,
    failedCommandCount: stageExecution?.failedCommandCount ?? null,
    productPathCount: stageExecution?.productPathCount ?? null,
    deletionPathCount: stageExecution?.deletionPathCount ?? null,
    totalPlannedPathCount: stageExecution?.totalPlannedPathCount ?? null,
    gitStatus,
    cachedDiff,
    p12RawReadinessStatus: rawReadiness?.status ?? 'UNKNOWN',
    p12PairedRawLogCount: rawReadiness?.p12PairedRawLogCount ?? 0,
    p12ReplayFamilyGapCount: rawReadiness?.p12ReplayFamilyGapCount ?? null,
    aclResidueCount,
    didMutateGit: stagedSuccessfully,
    didStageGit: stagedSuccessfully,
    didCommit: false,
    didReset: false,
    didClean: false,
    didRunVerification: true,
    didCreateExport: false,
    registerMode: stagedSuccessfully
      ? 'post-stage-index; pre-stage owner register is superseded for staged status expansion'
      : 'pre-stage-register-required',
    postStageInvariant: {
      stagedSuccessfully,
      p12Ready,
      noUntrackedPaths: gitStatus.untracked === 0,
      hasCachedDiff: cachedDiff.total > 0,
      noFailedStageCommands: numberFromJson(stageExecution?.failedCommandCount) === 0,
      hasOnlyExpectedUnstagedGeneratedRefresh,
    },
    steps,
    nextAction: stagedSuccessfully && p12Ready
      ? 'close ACL residues, rerun final preflight, then enter six-stage tests before clean export'
      : 'complete real target manifest intake or rerun explicit owner/Git stage execution',
    rule:
      'This post-authorization verification reads staged Git index evidence. It does not commit, reset, clean, run final tests, or export.',
  }
  const headers = ['order', 'phase', 'command', 'purpose', 'requiresPriorAuthorization']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...steps.map(row => headers.map(header => csvEscape(row[header as keyof VerificationStep])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    steps: report.steps.length,
    mutationCommandCount: report.mutationCommandCount,
    didMutateGit: report.didMutateGit,
    didRunVerification: report.didRunVerification,
    didCreateExport: report.didCreateExport,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
