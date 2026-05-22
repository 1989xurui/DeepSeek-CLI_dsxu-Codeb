import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ReachabilityRow = {
  path: string
  owner: string
  reachability: string
  verificationCommand: string
}

type CommandEvidence = {
  command: string
  status: 'PASS' | 'FAIL'
  exitCode: number
  durationMs: number
  coveredRows: number
  owners: string[]
  keyOutput: string[]
}

type OwnerFocusedEvidenceReport = {
  schemaVersion: 'dsxu.v7.owner-focused-evidence.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_OWNER_FOCUSED_EVIDENCE' | 'BLOCKED_DSXU_V7_OWNER_FOCUSED_EVIDENCE'
  sourceReachabilityPath: string
  summary: {
    commands: number
    passed: number
    failed: number
    coveredRows: number
    coveredOwners: number
  }
  blockers: string[]
  commands: CommandEvidence[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_REACHABILITY = join(GENERATED_DIR, `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_OWNER_FOCUSED_EVIDENCE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseReachability(raw: unknown): ReachabilityRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): ReachabilityRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? ''),
      reachability: String(row.reachability ?? ''),
      verificationCommand: String(row.verificationCommand ?? ''),
    }
  }).filter(row => row.path)
}

function keyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /pass|fail|Ran \d+ tests|error|timeout/i.test(line))
    .slice(-12)
}

function splitCommand(command: string): string[] {
  return command.split(/\s+/).filter(Boolean)
}

async function runCommand(command: string): Promise<Pick<CommandEvidence, 'status' | 'exitCode' | 'durationMs' | 'keyOutput'>> {
  const startedAt = Date.now()
  const proc = Bun.spawn(splitCommand(command), {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const output = `${stdout}\n${stderr}`
  return {
    status: exitCode === 0 ? 'PASS' : 'FAIL',
    exitCode,
    durationMs: Date.now() - startedAt,
    keyOutput: keyLines(output),
  }
}

function renderMarkdown(report: OwnerFocusedEvidenceReport): string {
  return `# DSXU V7 Owner Focused Evidence - ${DATE}

- status: \`${report.status}\`

This report runs the focused owner verification commands referenced by the V7 runtime reachability map. It is owner evidence only; it does not create public benchmark claims or delete approval.

## Summary

| metric | value |
|---|---:|
| commands | ${report.summary.commands} |
| passed | ${report.summary.passed} |
| failed | ${report.summary.failed} |
| coveredRows | ${report.summary.coveredRows} |
| coveredOwners | ${report.summary.coveredOwners} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Commands

| command | status | exit | rows | owners |
|---|---|---:|---:|---:|
${report.commands.map(row => `| \`${row.command}\` | ${row.status} | ${row.exitCode} | ${row.coveredRows} | ${row.owners.length} |`).join('\n')}

## Key Output

${report.commands.map(row => `### ${row.command}\n\n\`\`\`text\n${row.keyOutput.join('\n')}\n\`\`\``).join('\n\n')}
`
}

export async function buildOwnerFocusedEvidence(input: {
  reachabilityPath?: string
  generatedAt?: string
  commandResults?: Record<string, Pick<CommandEvidence, 'status' | 'exitCode' | 'durationMs' | 'keyOutput'>>
} = {}): Promise<OwnerFocusedEvidenceReport> {
  const reachabilityPath = resolve(input.reachabilityPath ?? DEFAULT_REACHABILITY)
  if (!existsSync(reachabilityPath)) throw new Error(`missing runtime reachability map: ${reachabilityPath}`)
  const rows = parseReachability(JSON.parse(await readFile(reachabilityPath, 'utf8')) as unknown)
  const commandToRows = new Map<string, ReachabilityRow[]>()
  for (const row of rows) {
    if (!row.verificationCommand || row.verificationCommand === 'needs focused owner test before claim') continue
    const existing = commandToRows.get(row.verificationCommand) ?? []
    existing.push(row)
    commandToRows.set(row.verificationCommand, existing)
  }

  const commands: CommandEvidence[] = []
  for (const [command, commandRows] of commandToRows) {
    const result = input.commandResults?.[command] ?? await runCommand(command)
    commands.push({
      command,
      ...result,
      coveredRows: commandRows.length,
      owners: [...new Set(commandRows.map(row => row.owner))].sort(),
    })
  }

  const blockers = commands.filter(command => command.status !== 'PASS').map(command => `${command.command}: exit=${command.exitCode}`)
  if (commands.length === 0) blockers.push('no focused owner verification commands found')
  return {
    schemaVersion: 'dsxu.v7.owner-focused-evidence.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_OWNER_FOCUSED_EVIDENCE'
      : 'BLOCKED_DSXU_V7_OWNER_FOCUSED_EVIDENCE',
    sourceReachabilityPath: rel(reachabilityPath),
    summary: {
      commands: commands.length,
      passed: commands.filter(command => command.status === 'PASS').length,
      failed: commands.filter(command => command.status !== 'PASS').length,
      coveredRows: commands.reduce((sum, command) => sum + command.coveredRows, 0),
      coveredOwners: new Set(commands.flatMap(command => command.owners)).size,
    },
    blockers,
    commands,
  }
}

async function main(): Promise<void> {
  const report = await buildOwnerFocusedEvidence()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    summary: report.summary,
    blockers: report.blockers,
    outputs: {
      json: rel(OUT_JSON),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
