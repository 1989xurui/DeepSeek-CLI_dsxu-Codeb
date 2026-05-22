import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const REGISTER_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv')
const PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.csv')

type CsvRow = Record<string, string>

type ProductStagePathRow = {
  statusCode: string
  path: string
  ownerPacket: string
  reviewState: string
  recommendedAction: string
  source: string
  stageReady: boolean
}

type ProductStagePacket = {
  ownerPacket: string
  pathCount: number
  modified: number
  untracked: number
  stageReady: boolean
  reviewStates: readonly string[]
}

type ProductStagePlan = {
  schemaVersion: 'dsxu.v20.owner-git-product-stage-plan.v1'
  generatedAt: string
  repoRoot: string
  status: 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE' | 'STAGED_BY_OWNER_GIT_EXECUTION' | 'BLOCKED'
  totalProductPaths: number
  stageReadyPaths: number
  packetCount: number
  didMutateGit: false
  didStageGitInPriorExecution: boolean
  packets: readonly ProductStagePacket[]
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

function toCsv(rows: readonly ProductStagePathRow[]): string {
  const headers = ['statusCode', 'path', 'ownerPacket', 'reviewState', 'recommendedAction', 'source', 'stageReady']
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof ProductStagePathRow])).join(',')),
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

async function gitStatusPaths(): Promise<Set<string>> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  return new Set(stdout.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim().toLowerCase()))
}

async function main(): Promise<void> {
  const [registerText, preflightText, statusPaths, stageExecution] = await Promise.all([
    readFile(REGISTER_PATH, 'utf8'),
    readFile(PREFLIGHT_PATH, 'utf8'),
    gitStatusPaths(),
    readJsonIfExists(STAGE_EXECUTION_PATH),
  ])
  const preflight = JSON.parse(preflightText.replace(/^\uFEFF/, '')) as Record<string, unknown>
  const stagedByOwnerGit =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    stageExecution.failedCommandCount === 0
  const registerRows = parseCsv(registerText)
  const productRows: ProductStagePathRow[] = registerRows
    .filter(row => row.statusCode !== 'D')
    .map(row => ({
      statusCode: row.statusCode,
      path: row.path,
      ownerPacket: row.ownerPacket,
      reviewState: row.reviewState,
      recommendedAction: row.recommendedAction,
      source: row.source,
      stageReady:
        stagedByOwnerGit ||
        preflight.registerAlignedToGitStatus === true &&
        statusPaths.has(row.path.toLowerCase()) &&
        (row.statusCode === 'M' || row.statusCode === '??'),
    }))
  const packetMap = new Map<string, ProductStagePathRow[]>()
  for (const row of productRows) {
    packetMap.set(row.ownerPacket, [...(packetMap.get(row.ownerPacket) ?? []), row])
  }
  const packets: ProductStagePacket[] = [...packetMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ownerPacket, rows]) => ({
      ownerPacket,
      pathCount: rows.length,
      modified: rows.filter(row => row.statusCode === 'M').length,
      untracked: rows.filter(row => row.statusCode === '??').length,
      stageReady: rows.every(row => row.stageReady),
      reviewStates: [...new Set(rows.map(row => row.reviewState))].sort(),
    }))
  const stageReadyPaths = productRows.filter(row => row.stageReady).length
  const status = stagedByOwnerGit
    ? 'STAGED_BY_OWNER_GIT_EXECUTION'
    : stageReadyPaths === productRows.length ? 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE' : 'BLOCKED'
  const plan: ProductStagePlan = {
    schemaVersion: 'dsxu.v20.owner-git-product-stage-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status,
    totalProductPaths: productRows.length,
    stageReadyPaths,
    packetCount: packets.length,
    didMutateGit: false,
    didStageGitInPriorExecution: stagedByOwnerGit,
    packets,
    blockers: [
      ...(status === 'STAGED_BY_OWNER_GIT_EXECUTION'
        ? ['product paths already staged by Owner/Git execution report']
        : status === 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE'
        ? ['explicit owner/Git stage authorization is still required before staging product paths']
        : ['product paths are not fully aligned to git status']),
      'this plan did not stage, commit, delete, reset, clean, or export',
    ],
    nextAction:
      status === 'STAGED_BY_OWNER_GIT_EXECUTION'
        ? 'run post-authorization verification and final preflight; do not regenerate a second owner path'
        : status === 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE'
        ? 'after explicit owner/Git authorization, stage product paths by owner packet; keep deletion packet separate'
        : 'refresh owner/Git register before any product stage action',
    rule:
      'This product stage plan groups non-deletion M/?? paths only. It never mutates Git and never hides owner review behind a generic bucket.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(plan, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(productRows)),
  ])
  console.log(JSON.stringify({
    status: plan.status,
    totalProductPaths: plan.totalProductPaths,
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
