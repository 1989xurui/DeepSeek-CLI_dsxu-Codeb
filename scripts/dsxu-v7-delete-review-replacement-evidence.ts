import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type DeleteReviewBoardRow = {
  path: string
  owner: string
  replacementOwner: string
  replacementEvidence: string[]
  reverseScanEvidence: string
  requiredTests: string[]
  ownerSignoff: boolean
  userDeletionApproval: boolean
  deleteReady: boolean
  status: string
  blockers: string[]
}

type DeleteReviewBoardReport = {
  rows?: DeleteReviewBoardRow[]
  summary?: {
    deleteReviewRows?: number
  }
}

type CommandEvidence = {
  command: string
  status: 'PASS' | 'FAIL'
  exitCode: number
  durationMs: number
  keyOutput: string[]
}

type ReferenceEvidence = {
  pattern: string
  file: string
  line: number
  text: string
  classification: 'runtime-source' | 'test-source' | 'legacy-internal' | 'script-or-package'
}

type ReplacementEvidenceRow = {
  path: string
  owner: string
  replacementOwner: string
  pathExists: boolean
  replacementEvidence: string[]
  replacementEvidenceExists: boolean
  requiredTests: string[]
  focusedTestStatus: 'PASS' | 'FAIL' | 'NO_TESTS'
  referenceEvidence: ReferenceEvidence[]
  runtimeSourceReferences: number
  testSourceReferences: number
  legacyInternalReferences: number
  scriptOrPackageReferences: number
  ownerSignoff: false
  userDeletionApproval: false
  deleteReady: false
  mutationAllowed: false
  status: 'observe-active-runtime-reference' | 'observe-replacement-covered' | 'blocked-missing-replacement-or-test'
  nextAction: string
  blockers: string[]
}

type ReplacementEvidenceReport = {
  schemaVersion: 'dsxu.v7.delete-review-replacement-evidence.v1'
  generatedAt: string
  status: 'PASS_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE' | 'BLOCKED_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE'
  sourceDeleteReviewPath: string
  summary: {
    rows: number
    sourceDeleteReviewRows: number
    pathExistsRows: number
    replacementEvidenceRows: number
    activeRuntimeReferenceRows: number
    deleteReadyRows: number
    mutationAllowedRows: number
    commandCount: number
    passedCommands: number
    failedCommands: number
  }
  blockers: string[]
  commands: CommandEvidence[]
  rows: ReplacementEvidenceRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_DELETE_REVIEW = join(GENERATED_DIR, `DSXU_DELETE_REVIEW_BOARD_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function parseBoard(raw: unknown): DeleteReviewBoardReport {
  return raw && typeof raw === 'object' ? raw as DeleteReviewBoardReport : {}
}

function parseRows(raw: unknown): DeleteReviewBoardRow[] {
  const report = parseBoard(raw)
  return (Array.isArray(report.rows) ? report.rows : [])
    .map((item): DeleteReviewBoardRow => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        path: String(row.path ?? ''),
        owner: String(row.owner ?? ''),
        replacementOwner: String(row.replacementOwner ?? ''),
        replacementEvidence: Array.isArray(row.replacementEvidence) ? row.replacementEvidence.map(String) : [],
        reverseScanEvidence: String(row.reverseScanEvidence ?? ''),
        requiredTests: Array.isArray(row.requiredTests) ? row.requiredTests.map(String) : [],
        ownerSignoff: Boolean(row.ownerSignoff),
        userDeletionApproval: Boolean(row.userDeletionApproval),
        deleteReady: Boolean(row.deleteReady),
        status: String(row.status ?? ''),
        blockers: Array.isArray(row.blockers) ? row.blockers.map(String) : [],
      }
    })
    .filter(row => row.path)
}

function splitCommand(command: string): string[] {
  return command.split(/\s+/).filter(Boolean)
}

function keyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /pass|fail|error|timeout|Ran \d+ tests/i.test(line))
    .slice(-12)
}

async function runCommand(command: string): Promise<CommandEvidence> {
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
    command,
    status: exitCode === 0 ? 'PASS' : 'FAIL',
    exitCode,
    durationMs: Date.now() - startedAt,
    keyOutput: keyLines(output),
  }
}

function referencePatterns(candidatePath: string): string[] {
  const normalized = normalizePath(candidatePath)
  const fileName = normalized.split('/').pop() ?? normalized
  const stem = fileName.replace(/\.(tsx?|jsx?)$/, '')
  const withoutExtension = normalized.replace(/\.(tsx?|jsx?)$/, '')
  const patterns = new Set<string>([
    normalized,
    withoutExtension,
    `./${stem}`,
    `./${stem}.js`,
    `./${stem}.ts`,
    `./${stem}.tsx`,
  ])
  if (normalized.endsWith('/index.ts')) {
    patterns.add(normalized.replace(/\/index\.ts$/, ''))
  }
  return [...patterns].filter(pattern => pattern.length > 2)
}

function classifyReference(file: string, candidatePath: string): ReferenceEvidence['classification'] {
  const normalizedFile = normalizePath(file)
  const normalizedCandidate = normalizePath(candidatePath)
  if (normalizedFile.includes('/__tests__/') || normalizedFile.endsWith('.test.ts') || normalizedFile.endsWith('.test.tsx')) {
    return 'test-source'
  }
  if (normalizedFile.startsWith('scripts/') || normalizedFile === 'package.json') {
    return 'script-or-package'
  }
  if (normalizedCandidate.startsWith('src/services/swe-bench/') && normalizedFile.startsWith('src/services/swe-bench/')) {
    return 'legacy-internal'
  }
  if (normalizedCandidate.startsWith('src/coordinator/dag/') && normalizedFile.startsWith('src/coordinator/dag/')) {
    return 'legacy-internal'
  }
  return 'runtime-source'
}

async function runRgFixed(pattern: string): Promise<string[]> {
  const proc = Bun.spawn(['rg', '-n', '--fixed-strings', pattern, 'src', 'scripts', 'package.json'], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ])
  if (exitCode !== 0) return []
  return stdout.split(/\r?\n/).filter(Boolean)
}

function isContextualRelativeReference(pattern: string, file: string, candidatePath: string): boolean {
  if (!pattern.startsWith('./')) return true
  return dirname(normalizePath(file)) === dirname(normalizePath(candidatePath))
}

function parseRgLine(pattern: string, line: string, candidatePath: string): ReferenceEvidence | null {
  const match = /^(.*?):(\d+):(.*)$/.exec(line)
  if (!match) return null
  const file = normalizePath(match[1] ?? '')
  if (!file || file === normalizePath(candidatePath)) return null
  if (file.startsWith('docs/')) return null
  if (!isContextualRelativeReference(pattern, file, candidatePath)) return null
  return {
    pattern,
    file,
    line: Number(match[2] ?? 0),
    text: String(match[3] ?? '').trim().slice(0, 240),
    classification: classifyReference(file, candidatePath),
  }
}

async function scanReferences(candidatePath: string): Promise<ReferenceEvidence[]> {
  const seen = new Set<string>()
  const references: ReferenceEvidence[] = []
  for (const pattern of referencePatterns(candidatePath)) {
    const lines = await runRgFixed(pattern)
    for (const line of lines) {
      const parsed = parseRgLine(pattern, line, candidatePath)
      if (!parsed) continue
      const key = `${parsed.file}:${parsed.line}`
      if (seen.has(key)) continue
      seen.add(key)
      references.push(parsed)
    }
  }
  return references
}

function rowStatus(input: {
  replacementEvidenceExists: boolean
  focusedTestStatus: ReplacementEvidenceRow['focusedTestStatus']
  runtimeSourceReferences: number
}): ReplacementEvidenceRow['status'] {
  if (!input.replacementEvidenceExists || input.focusedTestStatus === 'FAIL' || input.focusedTestStatus === 'NO_TESTS') {
    return 'blocked-missing-replacement-or-test'
  }
  if (input.runtimeSourceReferences > 0) return 'observe-active-runtime-reference'
  return 'observe-replacement-covered'
}

function nextActionFor(status: ReplacementEvidenceRow['status']): string {
  if (status === 'observe-active-runtime-reference') {
    return 'Keep observe-only: active runtime references still exist; owner must fold or remove references before mutation review.'
  }
  if (status === 'observe-replacement-covered') {
    return 'Keep observe-only: replacement evidence exists, but deletion still requires owner/Git signoff and explicit user deletion approval.'
  }
  return 'Blocked: replacement evidence or focused tests are incomplete; do not enter mutation review.'
}

function renderMarkdown(report: ReplacementEvidenceReport): string {
  return `# DSXU V7 Delete Review Replacement Evidence - ${DATE}

- status: \`${report.status}\`

This report strengthens the V7 delete-review board. It verifies replacement paths, focused owner tests, and active import/use evidence. It does not delete, move, stage, commit, clean files, or grant deletion approval.

## Summary

| metric | value |
|---|---:|
| rows | ${report.summary.rows} |
| sourceDeleteReviewRows | ${report.summary.sourceDeleteReviewRows} |
| pathExistsRows | ${report.summary.pathExistsRows} |
| replacementEvidenceRows | ${report.summary.replacementEvidenceRows} |
| activeRuntimeReferenceRows | ${report.summary.activeRuntimeReferenceRows} |
| deleteReadyRows | ${report.summary.deleteReadyRows} |
| mutationAllowedRows | ${report.summary.mutationAllowedRows} |
| commandCount | ${report.summary.commandCount} |
| passedCommands | ${report.summary.passedCommands} |
| failedCommands | ${report.summary.failedCommands} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Rows

| path | replacementOwner | status | runtimeRefs | testRefs | legacyRefs | test |
|---|---|---|---:|---:|---:|---|
${report.rows.map(row => `| \`${row.path}\` | ${row.replacementOwner} | ${row.status} | ${row.runtimeSourceReferences} | ${row.testSourceReferences} | ${row.legacyInternalReferences} | ${row.focusedTestStatus} |`).join('\n')}

## Commands

| command | status | exit | durationMs |
|---|---|---:|---:|
${report.commands.map(command => `| \`${command.command}\` | ${command.status} | ${command.exitCode} | ${command.durationMs} |`).join('\n')}
`
}

export async function buildDeleteReviewReplacementEvidence(input: {
  deleteReviewPath?: string
  generatedAt?: string
  commandResults?: Record<string, CommandEvidence>
  referenceResults?: Record<string, ReferenceEvidence[]>
} = {}): Promise<ReplacementEvidenceReport> {
  const deleteReviewPath = resolve(input.deleteReviewPath ?? DEFAULT_DELETE_REVIEW)
  if (!existsSync(deleteReviewPath)) throw new Error(`missing delete review board: ${deleteReviewPath}`)
  const raw = JSON.parse(await readFile(deleteReviewPath, 'utf8')) as unknown
  const board = parseBoard(raw)
  const boardRows = parseRows(raw)

  const uniqueCommands = [...new Set(boardRows.flatMap(row => row.requiredTests))].filter(Boolean)
  const commands: CommandEvidence[] = []
  for (const command of uniqueCommands) {
    commands.push(input.commandResults?.[command] ?? await runCommand(command))
  }
  const commandByText = new Map(commands.map(command => [command.command, command]))

  const rows: ReplacementEvidenceRow[] = []
  for (const row of boardRows) {
    const referenceEvidence = input.referenceResults?.[row.path] ?? await scanReferences(row.path)
    const replacementEvidenceExists = row.replacementEvidence.length > 0 &&
      row.replacementEvidence.every(path => existsSync(resolve(ROOT, path)))
    const commandStatuses = row.requiredTests.map(command => commandByText.get(command)?.status ?? 'FAIL')
    const focusedTestStatus: ReplacementEvidenceRow['focusedTestStatus'] = row.requiredTests.length === 0
      ? 'NO_TESTS'
      : commandStatuses.every(status => status === 'PASS') ? 'PASS' : 'FAIL'
    const runtimeSourceReferences = referenceEvidence.filter(reference => reference.classification === 'runtime-source').length
    const testSourceReferences = referenceEvidence.filter(reference => reference.classification === 'test-source').length
    const legacyInternalReferences = referenceEvidence.filter(reference => reference.classification === 'legacy-internal').length
    const scriptOrPackageReferences = referenceEvidence.filter(reference => reference.classification === 'script-or-package').length
    const status = rowStatus({
      replacementEvidenceExists,
      focusedTestStatus,
      runtimeSourceReferences,
    })
    const blockers = [
      ...row.blockers,
      ...(replacementEvidenceExists ? [] : ['replacement evidence path missing']),
      ...(focusedTestStatus === 'PASS' ? [] : ['focused replacement tests not passing']),
    ]
    rows.push({
      path: row.path,
      owner: row.owner,
      replacementOwner: row.replacementOwner,
      pathExists: existsSync(resolve(ROOT, row.path)),
      replacementEvidence: row.replacementEvidence,
      replacementEvidenceExists,
      requiredTests: row.requiredTests,
      focusedTestStatus,
      referenceEvidence,
      runtimeSourceReferences,
      testSourceReferences,
      legacyInternalReferences,
      scriptOrPackageReferences,
      ownerSignoff: false,
      userDeletionApproval: false,
      deleteReady: false,
      mutationAllowed: false,
      status,
      nextAction: nextActionFor(status),
      blockers,
    })
  }

  const blockers: string[] = []
  if (rows.length === 0) blockers.push('no delete-review rows found')
  if (rows.length !== Number(board.summary?.deleteReviewRows ?? rows.length)) {
    blockers.push(`delete-review row mismatch: rows=${rows.length}, source=${Number(board.summary?.deleteReviewRows ?? 0)}`)
  }
  if (rows.some(row => row.deleteReady || row.mutationAllowed)) {
    blockers.push('V7 replacement evidence must not grant delete-ready or mutation permission')
  }
  if (commands.some(command => command.status !== 'PASS')) {
    blockers.push('one or more focused replacement test commands failed')
  }
  if (rows.some(row => !row.replacementEvidenceExists)) {
    blockers.push('one or more rows are missing replacement evidence paths')
  }

  return {
    schemaVersion: 'dsxu.v7.delete-review-replacement-evidence.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE'
      : 'BLOCKED_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE',
    sourceDeleteReviewPath: rel(deleteReviewPath),
    summary: {
      rows: rows.length,
      sourceDeleteReviewRows: Number(board.summary?.deleteReviewRows ?? rows.length),
      pathExistsRows: rows.filter(row => row.pathExists).length,
      replacementEvidenceRows: rows.filter(row => row.replacementEvidenceExists).length,
      activeRuntimeReferenceRows: rows.filter(row => row.runtimeSourceReferences > 0).length,
      deleteReadyRows: rows.filter(row => row.deleteReady).length,
      mutationAllowedRows: rows.filter(row => row.mutationAllowed).length,
      commandCount: commands.length,
      passedCommands: commands.filter(command => command.status === 'PASS').length,
      failedCommands: commands.filter(command => command.status !== 'PASS').length,
    },
    blockers,
    commands,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildDeleteReviewReplacementEvidence()
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
