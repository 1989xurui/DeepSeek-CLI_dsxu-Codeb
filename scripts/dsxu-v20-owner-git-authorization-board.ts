import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const REGISTER_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv')
const PRODUCT_STAGE_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json')
const PRODUCT_STAGE_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.csv')
const DELETION_STAGE_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const COMMAND_PLAN_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json')
const FINAL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_AUTHORIZATION_BOARD_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_AUTHORIZATION_BOARD_20260515.csv')

type CsvRow = Record<string, string>

type ProductPacket = {
  ownerPacket: string
  pathCount: number
  modified: number
  untracked: number
  stageReady: boolean
  reviewStates: readonly string[]
}

type DeletionPacket = {
  ownerPacket: string
  pathCount: number
  deletedInGitStatus: number
  stageReady: boolean
  replacementOwners?: readonly string[]
}

type CommandRow = {
  commandId: string
  group: 'product' | 'deletion'
  ownerPacket: string
  pathCount: number
}

type AuthorizationRow = {
  ownerPacket: string
  track: string
  productPaths: number
  deletionPaths: number
  modifiedPaths: number
  untrackedPaths: number
  deletedPaths: number
  commandCount: number
  commandPathCount: number
  stageReady: boolean
  riskTier: 'high' | 'medium' | 'release-evidence'
  authorizationAction: string
  statusImpactTruth: string
  finalGateImpact: string
  reviewStates: string
  replacementOwners: string
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

function csvRows(rows: readonly AuthorizationRow[]): string {
  const headers = [
    'ownerPacket',
    'track',
    'productPaths',
    'deletionPaths',
    'modifiedPaths',
    'untrackedPaths',
    'deletedPaths',
    'commandCount',
    'commandPathCount',
    'stageReady',
    'riskTier',
    'authorizationAction',
    'statusImpactTruth',
    'finalGateImpact',
    'reviewStates',
    'replacementOwners',
  ]
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof AuthorizationRow])).join(',')),
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

async function gitStatusCodes(): Promise<Record<'total' | 'modified' | 'deleted' | 'untracked', number>> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  const codes = stdout.split(/\r?\n/).filter(Boolean).map(line => line.slice(0, 2).trim())
  return {
    total: codes.length,
    modified: codes.filter(code => code === 'M').length,
    deleted: codes.filter(code => code === 'D').length,
    untracked: codes.filter(code => code === '??').length,
  }
}

function riskTier(packet: string, reviewStates: readonly string[]): AuthorizationRow['riskTier'] {
  if (reviewStates.some(state => state.includes('release-evidence'))) return 'release-evidence'
  if (/OGR-0[3-7]|OGR-10|OGR-12/.test(packet) || reviewStates.some(state => state.includes('high-risk'))) return 'high'
  return 'medium'
}

function trackName(productPaths: number, deletionPaths: number): string {
  if (productPaths > 0 && deletionPaths > 0) return 'product+deletion'
  if (deletionPaths > 0) return 'deletion'
  return 'product'
}

async function main(): Promise<void> {
  const [
    registerText,
    productStage,
    productCsvText,
    deletionStage,
    commandPlan,
    finalPreflight,
    stageExecution,
    gitStatus,
  ] = await Promise.all([
    readFile(REGISTER_PATH, 'utf8'),
    readJson<{ packets: readonly ProductPacket[], totalProductPaths: number, status: string }>(PRODUCT_STAGE_JSON_PATH),
    readFile(PRODUCT_STAGE_CSV_PATH, 'utf8'),
    readJson<{ packets: readonly DeletionPacket[], totalDeletionPaths: number, status: string }>(DELETION_STAGE_JSON_PATH),
    readJson<{ commands: readonly CommandRow[], commandCount: number, status: string }>(COMMAND_PLAN_PATH),
    readJson<{ status: string, canRunFinalSixStageTests: boolean, canCreateCleanExport: boolean }>(FINAL_PREFLIGHT_PATH),
    readJsonIfExists<Record<string, unknown>>(STAGE_EXECUTION_PATH),
    gitStatusCodes(),
  ])
  const stagedByOwnerGit =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    stageExecution.failedCommandCount === 0

  const registerRows = parseCsv(registerText)
  const productPathRows = parseCsv(productCsvText)
  const commandsByPacket = new Map<string, CommandRow[]>()
  for (const command of commandPlan.commands) {
    commandsByPacket.set(command.ownerPacket, [...(commandsByPacket.get(command.ownerPacket) ?? []), command])
  }
  const productByPacket = new Map(productStage.packets.map(packet => [packet.ownerPacket, packet]))
  const deletionByPacket = new Map(deletionStage.packets.map(packet => [packet.ownerPacket, packet]))
  const allPackets = [...new Set([
    ...productStage.packets.map(packet => packet.ownerPacket),
    ...deletionStage.packets.map(packet => packet.ownerPacket),
  ])].sort()

  const rows: AuthorizationRow[] = allPackets.map(ownerPacket => {
    const product = productByPacket.get(ownerPacket)
    const deletion = deletionByPacket.get(ownerPacket)
    const commands = commandsByPacket.get(ownerPacket) ?? []
    const reviewStates = [
      ...new Set([
        ...(product?.reviewStates ?? []),
        ...registerRows.filter(row => row.ownerPacket === ownerPacket).map(row => row.reviewState),
      ]),
    ].filter(Boolean).sort()
    const productPaths = product?.pathCount ?? 0
    const deletionPaths = deletion?.pathCount ?? 0
    return {
      ownerPacket,
      track: trackName(productPaths, deletionPaths),
      productPaths,
      deletionPaths,
      modifiedPaths: product?.modified ?? 0,
      untrackedPaths: product?.untracked ?? 0,
      deletedPaths: deletion?.deletedInGitStatus ?? 0,
      commandCount: commands.length,
      commandPathCount: commands.reduce((total, command) => total + command.pathCount, 0),
      stageReady: (product?.stageReady ?? true) && (deletion?.stageReady ?? true) && commands.length > 0,
      riskTier: riskTier(ownerPacket, reviewStates),
      authorizationAction:
        deletionPaths > 0
          ? 'explicit owner/Git deletion-stage authorization; do not restore old duplicate runtime'
          : 'explicit owner/Git product-stage authorization; keep packet owner boundary',
      statusImpactTruth:
        'git add changes index state only; git status count remains until a later explicit commit/closeout action',
      finalGateImpact:
        'enables post-authorization verification; final tests/export still require P12 target manifest and ACL closure',
      reviewStates: reviewStates.join('|'),
      replacementOwners: [...(deletion?.replacementOwners ?? [])].join('|'),
    }
  })

  const commandPathCount = rows.reduce((total, row) => total + row.commandPathCount, 0)
  const totalPlannedPaths = productStage.totalProductPaths + deletionStage.totalDeletionPaths
  const productCsvPathCount = productPathRows.length
  const validation = {
    productStageReady: productStage.status === 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE' || productStage.status === 'STAGED_BY_OWNER_GIT_EXECUTION',
    deletionStageReady: deletionStage.status === 'READY_PENDING_EXPLICIT_GIT_STAGE' || deletionStage.status === 'STAGED_BY_OWNER_GIT_EXECUTION',
    commandPlanReady: commandPlan.status === 'READY_PENDING_EXPLICIT_AUTHORIZATION_NOT_EXECUTED' || commandPlan.status === 'STAGED_BY_OWNER_GIT_EXECUTION',
    commandPathCountMatchesStagePlan: commandPathCount === totalPlannedPaths,
    productCsvMatchesProductStagePlan: productCsvPathCount === productStage.totalProductPaths,
    ownerPacketRowsMatchCommandPackets: rows.every(row => row.commandCount > 0 && row.commandPathCount === row.productPaths + row.deletionPaths),
    noHoldingBucket: rows.every(row => !row.ownerPacket.toLowerCase().includes('holding')),
    stageExecutionMatchesPlan: !stagedByOwnerGit || stageExecution.totalPlannedPathCount === totalPlannedPaths,
  }
  const canEnterAuthorizationExecution =
    !stagedByOwnerGit &&
    Object.values(validation).every(Boolean) &&
    gitStatus.total === totalPlannedPaths &&
    rows.every(row => row.stageReady)
  const authorizationAlreadyExecuted =
    stagedByOwnerGit &&
    Object.values(validation).every(Boolean) &&
    rows.every(row => row.stageReady)

  const report = {
    schemaVersion: 'dsxu.v20.owner-git-authorization-board.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: authorizationAlreadyExecuted
      ? 'AUTHORIZED_AND_STAGED_PENDING_REMAINING_GATES'
      : canEnterAuthorizationExecution
      ? 'READY_FOR_EXPLICIT_OWNER_GIT_AUTHORIZATION_NOT_EXECUTED'
      : 'BLOCKED_PACKET_VALIDATION_FAILED',
    productPathCount: productStage.totalProductPaths,
    deletionPathCount: deletionStage.totalDeletionPaths,
    totalPlannedPaths,
    gitStatusShort: gitStatus,
    ownerPacketCount: rows.length,
    commandCount: commandPlan.commandCount,
    commandPathCount,
    validation,
    canEnterAuthorizationExecution,
    authorizationAlreadyExecuted,
    stageExecutionStatus: stageExecution?.status ?? 'MISSING_STAGE_EXECUTION_REPORT',
    finalPreflightStatus: finalPreflight.status,
    canRunFinalSixStageTestsAfterThisAlone: false,
    canCreateCleanExportAfterThisAlone: false,
    didMutateGit: false,
    didStage: stagedByOwnerGit,
    didCommit: false,
    didDelete: false,
    didReset: false,
    didRunFinalTests: false,
    didCreateExport: false,
    rows,
    blockersAfterAuthorization: [
      '4 ACL residues still require external permission closure or explicit owner/Git handling',
      'final six-stage tests must run after P12, Owner/Git, deletion, ACL, and release gates pass',
      'clean export must remain last',
    ],
    nextAction: authorizationAlreadyExecuted
      ? 'run post-authorization verification, close ACL residues, then enter final six-stage tests before clean export'
      : canEnterAuthorizationExecution
      ? 'execute explicit owner/Git authorization packets when permitted; otherwise import real targetReferenceManifestPath'
      : 'fix packet validation before any Git mutation',
    rule:
      'This board is authorization evidence only. It does not stage, commit, delete, reset, clean, run final tests, or create export artifacts.',
  }

  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, csvRows(rows)),
  ])

  console.log(JSON.stringify({
    status: report.status,
    ownerPacketCount: report.ownerPacketCount,
    productPathCount: report.productPathCount,
    deletionPathCount: report.deletionPathCount,
    totalPlannedPaths: report.totalPlannedPaths,
    gitStatusShort: report.gitStatusShort,
    commandCount: report.commandCount,
    commandPathCount: report.commandPathCount,
    canEnterAuthorizationExecution: report.canEnterAuthorizationExecution,
    didMutateGit: report.didMutateGit,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
