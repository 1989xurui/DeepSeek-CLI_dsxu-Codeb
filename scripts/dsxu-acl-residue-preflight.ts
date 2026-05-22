import { constants as fsConstants } from 'fs'
import { execFile } from 'child_process'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const ACL_SIGNOFF_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_SIGNOFF_20260515.csv')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.csv')

type CsvRow = Record<string, string>

type AclResidueRow = {
  path: string
  gitStatus: string
  residueClass: string
  exists: boolean
  sizeBytes: number | null
  readable: boolean
  writable: boolean
  parentWritable: boolean
  deleteAllowedByAcl: boolean
  aclDeleteEvidence: string
  activeProductReferenceRows: number
  closureStatus: string
  executionRule: string
}

type AclResiduePreflight = {
  schemaVersion: 'dsxu.v20.acl-residue-preflight.v1'
  generatedAt: string
  repoRoot: string
  status:
    | 'BLOCKED_EXTERNAL_PERMISSION_OR_SIGNOFF'
    | 'BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF'
    | 'PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME'
    | 'PASS_NO_RESIDUES'
  residueCount: number
  existingResidues: number
  writableResidues: number
  deletableResidues: number
  externallySignedResidues: number
  activeProductReferenceRows: number
  didMutateFilesystem: false
  rows: readonly AclResidueRow[]
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

function toCsv(rows: readonly AclResidueRow[]): string {
  const headers = [
    'path',
    'gitStatus',
    'residueClass',
    'exists',
    'sizeBytes',
    'readable',
    'writable',
    'parentWritable',
    'deleteAllowedByAcl',
    'aclDeleteEvidence',
    'activeProductReferenceRows',
    'closureStatus',
    'executionRule',
  ]
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof AclResidueRow])).join(',')),
  ].join('\n') + '\n'
}

async function canAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode)
    return true
  } catch {
    return false
  }
}

function rightsAllowDelete(rights: string): boolean {
  return /\((?:[^\)]*,)?(?:F|M|D)(?:,[^\)]*)?\)/.test(rights) || /\(.*\bDE\b.*\)/.test(rights)
}

async function deleteAllowedByAcl(path: string): Promise<{ allowed: boolean, evidence: string }> {
  if (process.platform !== 'win32') {
    const parentPath = dirname(path)
    return {
      allowed: await canAccess(path, fsConstants.W_OK) && await canAccess(parentPath, fsConstants.W_OK),
      evidence: 'non-windows-write-access-check',
    }
  }
  const [{ stdout: userStdout }, { stdout: groupStdout }, { stdout: aclStdout }] = await Promise.all([
    execFileAsync('whoami', [], { cwd: process.cwd() }),
    execFileAsync('whoami', ['/groups'], { cwd: process.cwd(), maxBuffer: 1024 * 1024 }),
    execFileAsync('icacls', [path], { cwd: process.cwd(), maxBuffer: 1024 * 1024 }),
  ])
  const currentUser = userStdout.trim().toLowerCase()
  const enabledGroups = groupStdout
    .split(/\r?\n/)
    .filter(line => line.includes('Enabled group') || line.includes('Mandatory group'))
    .filter(line => !line.includes('Group used for deny only'))
    .map(line => line.trim().split(/\s{2,}/)[0]?.toLowerCase())
    .filter(Boolean) as string[]
  const allowedIdentities = new Set([currentUser, ...enabledGroups, 'builtin\\users', 'nt authority\\authenticated users'])
  const matchingAclRows = aclStdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => [...allowedIdentities].some(identity => line.toLowerCase().startsWith(identity)))
  const allowed = matchingAclRows.some(rightsAllowDelete)
  return {
    allowed,
    evidence: matchingAclRows.length > 0 ? matchingAclRows.join(' | ') : 'no-current-user-or-enabled-group-delete-ace',
  }
}

async function inspectRow(row: CsvRow): Promise<AclResidueRow> {
  const absolutePath = join(process.cwd(), row.path)
  const parentPath = dirname(absolutePath)
  let exists = false
  let sizeBytes: number | null = null
  try {
    const fileStat = await stat(absolutePath)
    exists = true
    sizeBytes = fileStat.size
  } catch {
    exists = false
  }
  const readable = exists ? await canAccess(absolutePath, fsConstants.R_OK) : false
  const writable = exists ? await canAccess(absolutePath, fsConstants.W_OK) : false
  const parentWritable = await canAccess(parentPath, fsConstants.W_OK)
  const deleteAcl = exists
    ? await deleteAllowedByAcl(absolutePath)
    : { allowed: false, evidence: 'missing-file' }
  return {
    path: row.path,
    gitStatus: row.gitStatus,
    residueClass: row.residueClass,
    exists,
    sizeBytes,
    readable,
    writable,
    parentWritable,
    deleteAllowedByAcl: deleteAcl.allowed,
    aclDeleteEvidence: deleteAcl.evidence,
    activeProductReferenceRows: Number(row.activeProductReferenceRows || 0),
    closureStatus: row.ownerSignoff,
    executionRule: row.executionRule,
  }
}

async function main(): Promise<void> {
  const rows = await Promise.all(parseCsv(await readFile(ACL_SIGNOFF_PATH, 'utf8')).map(inspectRow))
  const activeProductReferenceRows = rows.reduce((sum, row) => sum + row.activeProductReferenceRows, 0)
  const existingResidues = rows.filter(row => row.exists).length
  const writableResidues = rows.filter(row => row.writable && row.parentWritable).length
  const deletableResidues = rows.filter(row => row.deleteAllowedByAcl).length
  const externallySignedResidues = rows.filter(row =>
    row.closureStatus === 'OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS' &&
    row.activeProductReferenceRows === 0 &&
    row.executionRule.includes('Do not import') &&
    row.executionRule.includes('external residue only'),
  ).length
  const status = rows.length === 0
    ? 'PASS_NO_RESIDUES'
    : externallySignedResidues === rows.length && activeProductReferenceRows === 0
      ? 'PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME'
      : deletableResidues === existingResidues && activeProductReferenceRows === 0
      ? 'BLOCKED_EXTERNAL_PERMISSION_OR_SIGNOFF'
      : 'BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF'
  const report: AclResiduePreflight = {
    schemaVersion: 'dsxu.v20.acl-residue-preflight.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status,
    residueCount: rows.length,
    existingResidues,
    writableResidues,
    deletableResidues,
    externallySignedResidues,
    activeProductReferenceRows,
    didMutateFilesystem: false,
    rows,
    blockers: status.startsWith('PASS')
      ? []
      : [
          `${rows.length} ACL residue path(s) still require external permission/ownership closure or explicit owner/Git mutation handling`,
          `${existingResidues - deletableResidues} residue path(s) lack Delete/DeleteChild ACL for the current user/session`,
          'preflight did not delete, chmod, chown, restore, stage, clean, reset, or export',
        ],
    nextAction:
      rows.length === 0
        ? 'continue final preflight'
        : status === 'PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME'
          ? 'continue final preflight; physical workspace residues remain external ACL cleanup items and must stay excluded from release/export'
        : 'close these residues through external permission/ownership action or explicit owner/Git mutation handling',
    rule:
      'This ACL preflight only inspects residue files and parent writability. It never deletes, changes permissions, stages, resets, cleans, or exports.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(rows)),
  ])
  console.log(JSON.stringify({
    status: report.status,
    residueCount: report.residueCount,
    existingResidues: report.existingResidues,
    writableResidues: report.writableResidues,
    deletableResidues: report.deletableResidues,
    externallySignedResidues: report.externallySignedResidues,
    activeProductReferenceRows: report.activeProductReferenceRows,
    didMutateFilesystem: report.didMutateFilesystem,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
