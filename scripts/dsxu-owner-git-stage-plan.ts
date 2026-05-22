import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const DELETION_SIGNOFF_PATH = join(GENERATED_DIR, 'DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_20260515.csv')
const PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.csv')

type CsvRow = Record<string, string>

type StagePathRow = {
  path: string
  ownerPacket: string
  replacementOwner: string
  gitStatus: string
  stageReady: boolean
  mutationRule: string
}

type StagePacket = {
  ownerPacket: string
  replacementOwners: readonly string[]
  pathCount: number
  deletedInGitStatus: number
  stageReady: boolean
  paths: readonly string[]
}

type StagePlan = {
  schemaVersion: 'dsxu.v20.owner-git-stage-plan.v1'
  generatedAt: string
  repoRoot: string
  status: 'READY_PENDING_EXPLICIT_GIT_STAGE' | 'STAGED_BY_OWNER_GIT_EXECUTION' | 'BLOCKED'
  sourcePreflightStatus: string
  totalDeletionPaths: number
  stageReadyPaths: number
  packetCount: number
  canStageDeletionPackets: boolean
  didMutateGit: false
  didStageGitInPriorExecution: boolean
  packets: readonly StagePacket[]
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

function toCsv(rows: readonly StagePathRow[]): string {
  const headers = ['path', 'ownerPacket', 'replacementOwner', 'gitStatus', 'stageReady', 'mutationRule']
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof StagePathRow])).join(',')),
  ].join('\n') + '\n'
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

async function gitStatusByPath(): Promise<Map<string, string>> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  return new Map(
    stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => [line.slice(3).trim().toLowerCase(), line.slice(0, 2).trim()] as const),
  )
}

async function main(): Promise<void> {
  const [deletionText, preflightText, statusMap, stageExecution] = await Promise.all([
    readFile(DELETION_SIGNOFF_PATH, 'utf8'),
    readFile(PREFLIGHT_PATH, 'utf8'),
    gitStatusByPath(),
    readJsonIfExists(STAGE_EXECUTION_PATH),
  ])
  const deletionRows = parseCsv(deletionText)
  const preflight = JSON.parse(preflightText.replace(/^\uFEFF/, '')) as Record<string, unknown>
  const stagedByOwnerGit =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    stageExecution.failedCommandCount === 0
  const canStageDeletionPackets = !stagedByOwnerGit && preflight.canStageDeletionPackets === true
  const pathRows: StagePathRow[] = deletionRows.map(row => {
    const gitStatus = statusMap.get(row.path.toLowerCase()) ?? 'MISSING_FROM_GIT_STATUS'
    return {
      path: row.path,
      ownerPacket: row.ownerPacket,
      replacementOwner: row.replacementOwner,
      gitStatus,
      stageReady:
        stagedByOwnerGit ||
        canStageDeletionPackets &&
        gitStatus === 'D' &&
        row.gitMutationReviewDecision === 'ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED',
      mutationRule: row.executionRule,
    }
  })
  const packetMap = new Map<string, StagePathRow[]>()
  for (const row of pathRows) {
    packetMap.set(row.ownerPacket, [...(packetMap.get(row.ownerPacket) ?? []), row])
  }
  const packets: StagePacket[] = [...packetMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ownerPacket, rows]) => ({
      ownerPacket,
      replacementOwners: [...new Set(rows.map(row => row.replacementOwner))].sort(),
      pathCount: rows.length,
      deletedInGitStatus: rows.filter(row => row.gitStatus === 'D').length,
      stageReady: rows.every(row => row.stageReady),
      paths: rows.map(row => row.path),
    }))
  const stageReadyPaths = pathRows.filter(row => row.stageReady).length
  const status = stagedByOwnerGit
    ? 'STAGED_BY_OWNER_GIT_EXECUTION'
    : canStageDeletionPackets && stageReadyPaths === pathRows.length
    ? 'READY_PENDING_EXPLICIT_GIT_STAGE'
    : 'BLOCKED'
  const blockers = [
    ...(status === 'STAGED_BY_OWNER_GIT_EXECUTION'
      ? ['deletion paths already staged by Owner/Git execution report']
      : status === 'READY_PENDING_EXPLICIT_GIT_STAGE'
      ? ['explicit owner/Git mutation authorization is still required before running git add']
      : ['deletion paths are not fully aligned to git status or accepted mutation review']),
    'this plan is evidence-only and did not stage, delete, commit, reset, clean, or export',
  ]
  const plan: StagePlan = {
    schemaVersion: 'dsxu.v20.owner-git-stage-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status,
    sourcePreflightStatus: String(preflight.status ?? 'UNKNOWN'),
    totalDeletionPaths: pathRows.length,
    stageReadyPaths,
    packetCount: packets.length,
    canStageDeletionPackets,
    didMutateGit: false,
    didStageGitInPriorExecution: stagedByOwnerGit,
    packets,
    blockers,
    nextAction:
      status === 'STAGED_BY_OWNER_GIT_EXECUTION'
        ? 'run post-authorization verification and final preflight; do not restore old duplicate runtime'
        : status === 'READY_PENDING_EXPLICIT_GIT_STAGE'
        ? 'after explicit authorization, stage these 147 accepted deletion paths by packet; do not restore old runtimes'
        : 'refresh owner/Git mutation preflight before any mutation',
    rule:
      'This stage plan only materializes the exact deletion packets and paths. It never runs git add, delete, commit, reset, clean, or export.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(plan, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(pathRows)),
  ])
  console.log(JSON.stringify({
    status: plan.status,
    totalDeletionPaths: plan.totalDeletionPaths,
    stageReadyPaths: plan.stageReadyPaths,
    packetCount: plan.packetCount,
    didMutateGit: plan.didMutateGit,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
