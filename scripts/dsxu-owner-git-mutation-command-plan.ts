import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const PRODUCT_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json')
const DELETION_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.csv')

type StagePacket = {
  ownerPacket: string
  paths?: readonly string[]
  pathCount: number
}

type CommandChunk = {
  commandId: string
  group: 'product' | 'deletion'
  ownerPacket: string
  pathCount: number
  command: string
  requiresExplicitAuthorization: true
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function quotePath(path: string): string {
  return `"${path.replace(/"/g, '\\"')}"`
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push([...items.slice(index, index + size)])
  return chunks
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

async function main(): Promise<void> {
  const [productStage, deletionStage, stageExecution] = await Promise.all([
    readJson(PRODUCT_STAGE_PATH),
    readJson(DELETION_STAGE_PATH),
    readJsonIfExists(STAGE_EXECUTION_PATH),
  ])
  const stagedByOwnerGit =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    stageExecution.didStageGit === true &&
    stageExecution.failedCommandCount === 0
  const productCsv = await readFile(join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.csv'), 'utf8')
  const productPathsByPacket = new Map<string, string[]>()
  for (const line of productCsv.trim().split(/\r?\n/).slice(1)) {
    const cells = line.match(/("(?:""|[^"])*"|[^,]*)/g)?.filter((_, index) => index % 2 === 0) ?? []
    const values = cells.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'))
    const path = values[1] ?? ''
    const ownerPacket = values[2] ?? ''
    if (!path || !ownerPacket) continue
    productPathsByPacket.set(ownerPacket, [...(productPathsByPacket.get(ownerPacket) ?? []), path])
  }
  const commands: CommandChunk[] = []
  for (const [ownerPacket, paths] of [...productPathsByPacket.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [index, pathsChunk] of chunk(paths, 40).entries()) {
      commands.push({
        commandId: `product:${ownerPacket}:${index + 1}`,
        group: 'product',
        ownerPacket,
        pathCount: pathsChunk.length,
        command: `git add -- ${pathsChunk.map(quotePath).join(' ')}`,
        requiresExplicitAuthorization: true,
      })
    }
  }
  for (const packet of (deletionStage.packets as StagePacket[])) {
    for (const [index, pathsChunk] of chunk(packet.paths ?? [], 40).entries()) {
      commands.push({
        commandId: `deletion:${packet.ownerPacket}:${index + 1}`,
        group: 'deletion',
        ownerPacket: packet.ownerPacket,
        pathCount: pathsChunk.length,
        command: `git add -- ${pathsChunk.map(quotePath).join(' ')}`,
        requiresExplicitAuthorization: true,
      })
    }
  }
  const report = {
    schemaVersion: 'dsxu.v20.owner-git-mutation-command-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: stagedByOwnerGit
      ? 'STAGED_BY_OWNER_GIT_EXECUTION'
      : 'READY_PENDING_EXPLICIT_AUTHORIZATION_NOT_EXECUTED',
    productStageStatus: productStage.status,
    deletionStageStatus: deletionStage.status,
    productPathCount: productStage.totalProductPaths,
    deletionPathCount: deletionStage.totalDeletionPaths,
    commandCount: commands.length,
    didMutateGit: false,
    didStageGitInPriorExecution: stagedByOwnerGit,
    stageExecutionStatus: stageExecution?.status ?? 'MISSING_STAGE_EXECUTION_REPORT',
    commands,
    blockers: [
      stagedByOwnerGit
        ? 'commands already executed by Owner/Git stage execution report'
        : 'explicit owner/Git mutation/stage authorization is required before running any command',
      'product and deletion commands must remain separate review packets',
      'this plan did not stage, commit, delete, reset, clean, or export',
    ],
    nextAction: stagedByOwnerGit
      ? 'run post-authorization verification, final preflight, and remaining ACL/final gates'
      : 'after explicit authorization, execute commands by packet, then rerun owner-git:preflight and final preflight',
    rule: 'This file is a command plan only. It never runs git commands.',
  }
  const headers = ['commandId', 'group', 'ownerPacket', 'pathCount', 'command', 'requiresExplicitAuthorization']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...commands.map(row => headers.map(header => csvEscape(row[header as keyof CommandChunk])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    productPathCount: report.productPathCount,
    deletionPathCount: report.deletionPathCount,
    commandCount: report.commandCount,
    didMutateGit: report.didMutateGit,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
