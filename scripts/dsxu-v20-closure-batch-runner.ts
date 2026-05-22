import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_CLOSURE_BATCH_RUN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_CLOSURE_BATCH_RUN_20260515.csv')
const TARGET_DISCOVERY_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_DISCOVERY_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')

type BatchCommand = {
  id: string
  args: readonly string[]
}

type BatchCommandResult = {
  id: string
  command: string
  status: 'PASS' | 'FAIL'
  exitCode: number
  stdoutTail: string
  stderrTail: string
}

const commands: readonly BatchCommand[] = [
  { id: 'p12-target-collection', args: ['run', 'scripts/dsxu-p12-target-reference-collection-pack.ts'] },
  { id: 'p12-target-discovery', args: ['run', 'scripts/dsxu-p12-target-manifest-discovery.ts'] },
  { id: 'p12-target-intake', args: ['run', 'scripts/dsxu-p12-target-manifest-intake.ts'] },
  {
    id: 'p12-raw-readiness-current',
    args: ['run', 'scripts/dsxu-p12-raw-readiness.ts', '--evidenceDir', '.dsxu/trace/p12-raw-readiness-cli-v1'],
  },
  { id: 'owner-git-preflight', args: ['run', 'scripts/dsxu-owner-git-mutation-preflight.ts'] },
  { id: 'owner-git-product-stage-plan', args: ['run', 'scripts/dsxu-owner-git-product-stage-plan.ts'] },
  { id: 'owner-git-deletion-stage-plan', args: ['run', 'scripts/dsxu-owner-git-stage-plan.ts'] },
  { id: 'owner-git-mutation-command-plan', args: ['run', 'scripts/dsxu-owner-git-mutation-command-plan.ts'] },
  { id: 'owner-git-authorization-board', args: ['run', 'scripts/dsxu-v20-owner-git-authorization-board.ts'] },
  { id: 'post-authorization-verification', args: ['run', 'scripts/dsxu-v20-post-authorization-verification-plan.ts'] },
  { id: 'acl-preflight', args: ['run', 'scripts/dsxu-acl-residue-preflight.ts'] },
  { id: 'acl-closure-plan', args: ['run', 'scripts/dsxu-acl-residue-closure-plan.ts'] },
  { id: 'commercial-ip-preflight', args: ['run', 'scripts/dsxu-commercial-ip-release-preflight.ts'] },
  { id: 'six-stage-plan', args: ['run', 'scripts/dsxu-v20-six-stage-test-plan.ts'] },
  { id: 'final-preflight', args: ['run', 'scripts/dsxu-v20-final-preflight.ts'] },
  { id: 'clean-export-preflight', args: ['run', 'scripts/dsxu-clean-export-preflight.ts'] },
  { id: 'blocker-action-board', args: ['run', 'scripts/dsxu-v20-blocker-action-board.ts'] },
]

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function tail(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 1200 ? trimmed.slice(-1200) : trimmed
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch {
    return null
  }
}

async function argsForCommand(command: BatchCommand): Promise<readonly string[]> {
  if (command.id !== 'p12-target-intake' && command.id !== 'p12-raw-readiness-current') return command.args
  const discovery = await readJsonIfExists(TARGET_DISCOVERY_PATH)
  const manifestPath = typeof discovery?.canonicalTargetReferenceManifestPath === 'string'
    ? discovery.canonicalTargetReferenceManifestPath
    : null
  if (!manifestPath) return command.args
  if (command.id === 'p12-target-intake') {
    return [...command.args, '--targetReferenceManifestPath', manifestPath]
  }
  return ['run', 'scripts/dsxu-p12-raw-readiness.ts', '--targetReferenceManifestPath', manifestPath]
}

async function runCommand(command: BatchCommand): Promise<BatchCommandResult> {
  const args = await argsForCommand(command)
  try {
    const result = await execFileAsync('bun', args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 16,
    })
    return {
      id: command.id,
      command: `bun ${args.join(' ')}`,
      status: 'PASS',
      exitCode: 0,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr),
    }
  } catch (error) {
    const typed = error as { code?: number, stdout?: string, stderr?: string }
    return {
      id: command.id,
      command: `bun ${args.join(' ')}`,
      status: 'FAIL',
      exitCode: typed.code ?? 1,
      stdoutTail: tail(typed.stdout ?? ''),
      stderrTail: tail(typed.stderr ?? String(error)),
    }
  }
}

async function main(): Promise<void> {
  const results: BatchCommandResult[] = []
  for (const command of commands) {
    results.push(await runCommand(command))
  }
  const [
    blockerBoard,
    finalPreflight,
    cleanExport,
    commandPlan,
    collectionPack,
    stageExecution,
    postAuth,
  ] = await Promise.all([
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json')),
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')),
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json')),
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json')),
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json')),
    readJsonIfExists(STAGE_EXECUTION_PATH),
    readJsonIfExists(join(GENERATED_DIR, 'DSXU_V20_POST_AUTHORIZATION_VERIFICATION_PLAN_20260515.json')),
  ])
  const didStageGitInPriorExecution =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    stageExecution.failedCommandCount === 0
  const allPreflightReady =
    results.every(result => result.status === 'PASS') &&
    String(blockerBoard?.status ?? '').startsWith('PASS') &&
    finalPreflight?.status === 'PASS' &&
    String(cleanExport?.status ?? '').startsWith('PASS')
  const report = {
    schemaVersion: 'dsxu.v20.closure-batch-runner.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: allPreflightReady ? 'PASS_PREFLIGHT_READY_RELEASE_EXPORT_READY' : results.every(result => result.status === 'PASS') ? 'PASS_EVIDENCE_REFRESHED_BLOCKERS_REMAIN' : 'FAILED',
    commandCount: results.length,
    passCount: results.filter(result => result.status === 'PASS').length,
    failCount: results.filter(result => result.status === 'FAIL').length,
    blockerBoardStatus: blockerBoard?.status ?? 'UNKNOWN',
    finalPreflightStatus: finalPreflight?.status ?? 'UNKNOWN',
    cleanExportPreflightStatus: cleanExport?.status ?? 'UNKNOWN',
    mutationCommandCount: commandPlan?.commandCount ?? null,
    p12WorkOrderCount: collectionPack?.workOrderCount ?? null,
    stageExecutionStatus: stageExecution?.status ?? 'MISSING_STAGE_EXECUTION_REPORT',
    postAuthorizationStatus: postAuth?.status ?? 'UNKNOWN',
    didMutateGit: false,
    didStageGitInPriorExecution,
    didMutateFilesystem: false,
    didRunFinalTests: false,
    didCreateExport: false,
    results,
    nextAction: allPreflightReady
      ? 'release/export preflight is ready; create export only as an explicit release action'
      : didStageGitInPriorExecution
      ? 'close ACL residues, run final six-stage tests when final preflight allows, then clean export'
      : 'provide real targetReferenceManifestPath or explicit owner/Git mutation/stage authorization',
    rule:
      'This batch runner refreshes evidence and plans only. It does not stage, commit, delete, reset, clean, run final tests, or create export artifacts.',
  }
  const headers = ['id', 'command', 'status', 'exitCode', 'stdoutTail', 'stderrTail']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...results.map(row => headers.map(header => csvEscape(row[header as keyof BatchCommandResult])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    commandCount: report.commandCount,
    passCount: report.passCount,
    failCount: report.failCount,
    blockerBoardStatus: report.blockerBoardStatus,
    finalPreflightStatus: report.finalPreflightStatus,
    cleanExportPreflightStatus: report.cleanExportPreflightStatus,
    mutationCommandCount: report.mutationCommandCount,
    p12WorkOrderCount: report.p12WorkOrderCount,
    didMutateGit: report.didMutateGit,
    didCreateExport: report.didCreateExport,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
