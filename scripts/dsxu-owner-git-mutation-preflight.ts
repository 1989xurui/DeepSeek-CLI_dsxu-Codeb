import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const REGISTER_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv')
const OWNER_EXECUTION_SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260515.json')
const DELETION_SIGNOFF_SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_SUMMARY_20260515.json')
const ACL_SIGNOFF_SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_SIGNOFF_SUMMARY_20260515.json')
const ACL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const REAL_GAP_PROGRESS_PATH = join(GENERATED_DIR, 'DSXU_V20_REAL_GAP_ACCEPTANCE_PROGRESS_20260515.json')
const RAW_READINESS_PATH = join(process.cwd(), '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const PREFLIGHT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json')
const PREFLIGHT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.csv')

type CsvRow = Record<string, string>

type GitStatusRow = {
  statusCode: string
  path: string
}

type MutationPreflightPacket = {
  gate: string
  count: number
  status: string
  canMutateNow: boolean
  requiredAction: string
}

type MutationPreflightReport = {
  schemaVersion: 'dsxu.v20.owner-git-mutation-preflight.v1'
  generatedAt: string
  repoRoot: string
  status:
    | 'BLOCKED_PENDING_EXTERNAL_INPUT_OR_EXPLICIT_GIT_MUTATION'
    | 'POST_STAGE_INDEX_VERIFIED_REMAINING_GATES_BLOCKED'
    | 'PASS_READY_FOR_RELEASE_CLOSURE'
  gitStatusShort: {
    total: number
    modified: number
    deleted: number
    untracked: number
  }
  registerRows: number
  registerAlignedToGitStatus: boolean
  postStageIndexVerified: boolean
  stageExecutionStatus: string
  stagedCommandCount: number
  failedCommandCount: number | null
  totalPlannedPathCount: number | null
  unregisteredPathCount: number
  unregisteredPaths: readonly GitStatusRow[]
  ownerAcceptedOrConditionalPaths: number
  deletionMutationReadyPaths: number
  deletionActiveProductReferenceRows: number
  aclResidueRows: number
  p12PairedRawLogCount: number | null
  p12MinimumPairedRawLogsForPass: number | null
  p12ReplayFamilyGapCount: number | null
  canStageDeletionPackets: boolean
  canRunFinalSixStageTests: boolean
  canCreateCleanExport: boolean
  packets: readonly MutationPreflightPacket[]
  blockers: readonly string[]
  nextAction: string
  rule: string
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]!)
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
  })
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows: readonly MutationPreflightPacket[]): string {
  const headers = ['gate', 'count', 'status', 'canMutateNow', 'requiredAction']
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof MutationPreflightPacket])).join(',')),
  ].join('\n') + '\n'
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as T
}

async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    return await readJson<T>(path)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

async function gitStatus(): Promise<GitStatusRow[]> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => ({
      statusCode: line.slice(0, 2).trim(),
      path: line.slice(3).trim(),
    }))
}

function countStatus(rows: readonly GitStatusRow[], statusCode: string): number {
  return rows.filter(row => row.statusCode === statusCode).length
}

function numberFromJson(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function packet(
  gate: string,
  count: number,
  status: string,
  canMutateNow: boolean,
  requiredAction: string,
): MutationPreflightPacket {
  return { gate, count, status, canMutateNow, requiredAction }
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd())
  const [gitRows, registerText, ownerExecution, deletionSignoff, aclSignoff, aclPreflight, realGapProgress, rawReadiness, stageExecution] = await Promise.all([
    gitStatus(),
    readFile(REGISTER_PATH, 'utf8'),
    readJson<Record<string, unknown>>(OWNER_EXECUTION_SUMMARY_PATH),
    readJson<Record<string, unknown>>(DELETION_SIGNOFF_SUMMARY_PATH),
    readJson<Record<string, unknown>>(ACL_SIGNOFF_SUMMARY_PATH),
    readJsonIfExists<Record<string, unknown>>(ACL_PREFLIGHT_PATH),
    readJson<Record<string, unknown>>(REAL_GAP_PROGRESS_PATH),
    readJsonIfExists<Record<string, unknown>>(RAW_READINESS_PATH),
    readJsonIfExists<Record<string, unknown>>(STAGE_EXECUTION_PATH),
  ])
  const registerRows = parseCsv(registerText)
  const registeredPaths = new Set(registerRows.map(row => row.path.toLowerCase()))
  const unregisteredPaths = gitRows.filter(row => !registeredPaths.has(row.path.toLowerCase()))
  const deletionMutationReadyPaths = numberFromJson(ownerExecution.deletionMutationReadyPaths) ?? 0
  const ownerAcceptedOrConditionalPaths = numberFromJson(ownerExecution.ownerAcceptedOrConditionalPaths) ?? 0
  const deletionActiveProductReferenceRows = numberFromJson(deletionSignoff.activeProductReferenceRows) ?? 0
  const aclResidueRows = numberFromJson(aclSignoff.total) ?? 0
  const aclPreflightStatus = String(aclPreflight?.status ?? '')
  const aclClosed = aclPreflightStatus.startsWith('PASS') ||
    (
      numberFromJson(aclSignoff.signedRows) === aclResidueRows &&
      numberFromJson(aclSignoff.activeProductReferenceRows) === 0 &&
      String(aclSignoff.decision ?? '').includes('NON_PRODUCT_RESIDUE')
    )
  const aclBlockingRows = aclClosed ? 0 : aclResidueRows
  const focusedAcceptance = Array.isArray(realGapProgress.focusedAcceptance)
    ? realGapProgress.focusedAcceptance as Array<Record<string, unknown>>
    : []
  const p12CliEvidence = focusedAcceptance.find(item => item.packet === 'P12 raw-readiness CLI current evidence')
  const p12PairedRawLogCount = numberFromJson(rawReadiness?.p12PairedRawLogCount) ?? numberFromJson(p12CliEvidence?.p12PairedRawLogCount)
  const p12MinimumPairedRawLogsForPass = numberFromJson(rawReadiness?.p12MinimumPairedRawLogsForPass) ?? numberFromJson(p12CliEvidence?.p12MinimumPairedRawLogsForPass)
  const p12ReplayFamilyGapCount = numberFromJson(rawReadiness?.p12ReplayFamilyGapCount) ?? numberFromJson(p12CliEvidence?.p12ReplayFamilyGapCount)
  const registerAlignedToGitStatus = unregisteredPaths.length === 0 && registerRows.length === gitRows.length
  const postStageIndexVerified =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    (numberFromJson(stageExecution.failedCommandCount) ?? 1) === 0
  const effectiveRegisterAlignedToGitStatus = registerAlignedToGitStatus || postStageIndexVerified
  const canStageDeletionPackets =
    !postStageIndexVerified &&
    registerAlignedToGitStatus &&
    deletionMutationReadyPaths === countStatus(gitRows, 'D') &&
    deletionActiveProductReferenceRows === 0
  const finalReady =
    postStageIndexVerified &&
    aclClosed &&
    (p12PairedRawLogCount ?? 0) >= (p12MinimumPairedRawLogsForPass ?? 14) &&
    p12ReplayFamilyGapCount === 0
  const blockers = [
    ...(effectiveRegisterAlignedToGitStatus ? [] : [`owner/Git register is not aligned to git status: ${unregisteredPaths.length} unregistered path(s)`]),
    ...(postStageIndexVerified ? [] : canStageDeletionPackets ? ['explicit Git mutation/stage authorization is still required before staging accepted deletions'] : ['deletion packets are not stage-ready because register/signoff alignment is incomplete']),
    ...(aclBlockingRows > 0 ? [`${aclBlockingRows} ACL residue path(s) still require external permission/ownership closure`] : []),
    ...((p12PairedRawLogCount ?? 0) < (p12MinimumPairedRawLogsForPass ?? 14)
      ? [`P12 target-reference paired raw logs are incomplete: ${p12PairedRawLogCount ?? 0}/${p12MinimumPairedRawLogsForPass ?? 14}`]
      : []),
    ...((p12ReplayFamilyGapCount ?? 0) > 0
      ? [`P12 original-side family coverage still has ${p12ReplayFamilyGapCount} gap(s)`]
      : []),
    ...(finalReady
      ? []
      : ['final six-stage tests remain blocked until P12, owner/Git mutation, deletion, ACL, and release gates are PASS']),
    ...(finalReady
      ? []
      : ['clean export remains blocked until final preflight PASS']),
  ]
  const packets = [
    packet(
      'owner-git-register-alignment',
      postStageIndexVerified ? numberFromJson(stageExecution?.totalPlannedPathCount) ?? registerRows.length : registerRows.length,
      postStageIndexVerified ? 'PASS_POST_STAGE_INDEX_VERIFIED' : registerAlignedToGitStatus ? 'PASS_ALIGNED' : 'BLOCKED_UNREGISTERED_PATHS',
      false,
      postStageIndexVerified
        ? 'pre-stage register superseded by staged Git index evidence'
        : registerAlignedToGitStatus ? 'ready for explicit owner/Git review decision' : 'refresh owner/Git register before any mutation',
    ),
    packet(
      'deletion-mutation-stage-plan',
      deletionMutationReadyPaths,
      postStageIndexVerified ? 'PASS_STAGED' : canStageDeletionPackets ? 'READY_PENDING_EXPLICIT_GIT_STAGE' : 'BLOCKED_ALIGNMENT_OR_REFERENCE',
      false,
      postStageIndexVerified ? 'deletion packets already staged by Owner/Git execution report' : 'stage accepted deletions only after explicit Git mutation/stage authorization',
    ),
    packet(
      'owner-accepted-product-packets',
      ownerAcceptedOrConditionalPaths,
      postStageIndexVerified ? 'PASS_STAGED' : 'OWNER_ACCEPTED_OR_CONDITIONAL_PENDING_GIT_REVIEW',
      false,
      postStageIndexVerified ? 'product packets already staged by Owner/Git execution report' : 'owner/Git review may stage accepted product paths only after explicit mutation authorization',
    ),
    packet(
      'acl-residue',
      aclResidueRows,
      aclClosed
        ? 'PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME'
        : aclResidueRows === 0 ? 'PASS_NO_ACL_RESIDUE' : 'BLOCKED_EXTERNAL_PERMISSION_OR_SIGNOFF',
      false,
      aclClosed
        ? 'ACL residues are signed non-product runtime and excluded from release/export'
        : 'delete or sign off residues only when external permissions/ownership allow',
    ),
    packet(
      'p12-target-reference-raw',
      p12PairedRawLogCount ?? 0,
      (p12PairedRawLogCount ?? 0) >= (p12MinimumPairedRawLogsForPass ?? 14) && (p12ReplayFamilyGapCount ?? 1) === 0
        ? 'READY_FOR_DELTA_REVIEW'
        : 'BLOCKED_TARGET_RAW_INPUT',
      false,
      'import real targetReferenceManifestPath; do not use templates, generic logs, target-only logs, or DSXU-side logs',
    ),
    packet(
      'final-six-stage-tests-and-clean-export',
      1,
      finalReady ? 'PASS_READY_FOR_RELEASE_CLOSURE' : 'BLOCKED_UNTIL_UPSTREAM_GATES_PASS',
      false,
      finalReady
        ? 'run release closure tests and clean-export preflight; create export only as explicit release action'
        : 'run final tests and clean export only after upstream gates pass',
    ),
  ]
  const report: MutationPreflightReport = {
    schemaVersion: 'dsxu.v20.owner-git-mutation-preflight.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    status: finalReady
      ? 'PASS_READY_FOR_RELEASE_CLOSURE'
      : postStageIndexVerified
      ? 'POST_STAGE_INDEX_VERIFIED_REMAINING_GATES_BLOCKED'
      : 'BLOCKED_PENDING_EXTERNAL_INPUT_OR_EXPLICIT_GIT_MUTATION',
    gitStatusShort: {
      total: gitRows.length,
      modified: countStatus(gitRows, 'M'),
      deleted: countStatus(gitRows, 'D'),
      untracked: countStatus(gitRows, '??'),
    },
    registerRows: registerRows.length,
    registerAlignedToGitStatus,
    postStageIndexVerified,
    stageExecutionStatus: String(stageExecution?.status ?? 'MISSING_STAGE_EXECUTION_REPORT'),
    stagedCommandCount: numberFromJson(stageExecution?.stagedCommandCount) ?? 0,
    failedCommandCount: numberFromJson(stageExecution?.failedCommandCount),
    totalPlannedPathCount: numberFromJson(stageExecution?.totalPlannedPathCount),
    unregisteredPathCount: unregisteredPaths.length,
    unregisteredPaths,
    ownerAcceptedOrConditionalPaths,
    deletionMutationReadyPaths,
    deletionActiveProductReferenceRows,
    aclResidueRows,
    p12PairedRawLogCount,
    p12MinimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount,
    canStageDeletionPackets,
    canRunFinalSixStageTests: finalReady,
    canCreateCleanExport: finalReady,
    packets,
    blockers,
    nextAction: finalReady
      ? 'run final preflight, release closure tests, and clean-export preflight; create export only as explicit release action'
      : postStageIndexVerified
        ? 'close ACL residues, rerun final preflight, then enter final six-stage tests before clean export'
      : 'provide targetReferenceManifestPath or explicit owner/Git mutation/stage authorization; final six-stage tests and clean export remain last',
    rule: 'Preflight is evidence-only. It does not stage, commit, delete, reset, clean, force ACL residue deletion, fabricate target logs, run final tests, or create export artifacts.',
  }

  await mkdir(dirname(PREFLIGHT_JSON_PATH), { recursive: true })
  await writeFile(PREFLIGHT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(PREFLIGHT_CSV_PATH, toCsv(packets), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!effectiveRegisterAlignedToGitStatus) process.exitCode = 2
}

await main()
