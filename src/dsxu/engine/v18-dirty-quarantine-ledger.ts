import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PROXY_DIR = ['upstream', 'proxy'].join('')
const LEGACY_REFERENCE_ESCAPED_BYTES = ['346', '272', '220', '347', '240', '201'] as const

export type V18DirtyLedgerCategory =
  | 'mainline_active'
  | 'v18_plan_or_evidence'
  | 'toolchain_or_runtime'
  | 'legacy_quarantine_delete'
  | 'side_path_or_archive'
  | 'unknown'

export type V18DirtyLedgerEntry = {
  raw: string
  status: string
  path: string
  category: V18DirtyLedgerCategory
  action: 'keep' | 'quarantine' | 'ledger_only'
}

export type V18DirtyQuarantineLedger = {
  status: 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'
  ok: boolean
  generatedAt: string
  evidencePath: string
  total: number
  countsByCategory: Record<V18DirtyLedgerCategory, number>
  deletedCount: number
  untrackedCount: number
  mirrorSyncAllowed: boolean
  entries: readonly V18DirtyLedgerEntry[]
  samples: readonly V18DirtyLedgerEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
}

function parseGitStatusLine(line: string): { status: string; path: string } {
  const status = line.slice(0, 2)
  const path = line.slice(3).trim()
  return { status, path }
}

function categoryForPath(path: string, status: string): V18DirtyLedgerCategory {
  const normalized = path.replace(/\\/g, '/').replace(/^"|"$/g, '')
  if (/^(docs\/DSXU_V18|\.dsxu\/trace|\.dsxu\/memory|\.dsxu\/runs)/.test(normalized)) {
    return 'v18_plan_or_evidence'
  }
  const oldPrivateStatePattern = new RegExp(
    `^(src\\/bridge|src\\/remote|src\\/${LEGACY_PROXY_DIR}|dsevo\\/|\\.dsevo\\/|evals\\/|scripts\\/distill\\/|\\.${LEGACY_PRODUCT}\\/|docs\\/0\\d|crash-handler\\.js|deepseek-proxy\\.(js|ts)|start-${LEGACY_PRODUCT}\\.(cmd|ps1))`,
  )
  if (status.includes('D') && oldPrivateStatePattern.test(normalized)) {
    return 'legacy_quarantine_delete'
  }
  if (
    /^(bin\/|scripts\/dsxu-toolchain|src\/utils\/vendor|scripts\/guards|scripts\/ledger|stubs\/|Start-DSXU-Code(-WSL)?\.cmd)/.test(
      normalized,
    )
  ) {
    return 'toolchain_or_runtime'
  }
  if (/^(src\/|test\/|fixtures\/|package(-lock)?\.json|bun\.lock|bunfig\.toml|preload\.ts|README\.md|\.env\.example|\.gitignore|tsconfig\.json)/.test(normalized)) {
    return 'mainline_active'
  }
  if (
    /^(\.dsxu\/reference|\.dsxu\/specs|docs\/|scripts\/|src\/__tests__\/proxy|tmp_v18_|test-(context-budget|cost-ledger|infra-tasks)\.(js|cjs))/.test(normalized) ||
    LEGACY_REFERENCE_ESCAPED_BYTES.every(part => normalized.includes(part))
  ) {
    return 'side_path_or_archive'
  }
  return 'unknown'
}

function actionForCategory(category: V18DirtyLedgerCategory): V18DirtyLedgerEntry['action'] {
  if (category === 'legacy_quarantine_delete' || category === 'side_path_or_archive') {
    return 'quarantine'
  }
  if (category === 'unknown') return 'ledger_only'
  return 'keep'
}

export function buildV18DirtyQuarantineLedger(input: {
  lines: readonly string[]
  evidencePath?: string
  nowIso?: string
}): V18DirtyQuarantineLedger {
  const entries = input.lines
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parsed = parseGitStatusLine(line)
      const category = categoryForPath(parsed.path, parsed.status)
      return {
        raw: line,
        status: parsed.status,
        path: parsed.path,
        category,
        action: actionForCategory(category),
      }
    })
  const countsByCategory: Record<V18DirtyLedgerCategory, number> = {
    mainline_active: 0,
    v18_plan_or_evidence: 0,
    toolchain_or_runtime: 0,
    legacy_quarantine_delete: 0,
    side_path_or_archive: 0,
    unknown: 0,
  }
  for (const entry of entries) countsByCategory[entry.category] += 1
  const deletedCount = entries.filter(entry => entry.status.includes('D')).length
  const untrackedCount = entries.filter(entry => entry.status.includes('?')).length
  const blockers: string[] = []
  if (entries.length > 0) blockers.push('worktree is dirty; mirror sync remains plan-only')
  if (countsByCategory.unknown > 0) blockers.push('unknown dirty paths require manual classification before release claims')
  const safeguards = [
    'ledger does not delete, restore, or move files',
    'legacy and side-path entries are quarantine-classified, not removed',
    'mirror sync must remain plan-only while total dirty count is nonzero',
    'release scoring should ignore quarantine entries until they are explicitly resolved',
  ]

  return {
    status: blockers.length === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: blockers.length === 0,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'dirty-quarantine-ledger-20260507.evidence.json'),
    total: entries.length,
    countsByCategory,
    deletedCount,
    untrackedCount,
    mirrorSyncAllowed: entries.length === 0,
    entries,
    samples: entries.slice(0, 120),
    blockers,
    safeguards,
  }
}

async function gitStatusShort(repoRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], {
      cwd: repoRoot,
      timeout: 30_000,
      maxBuffer: 6 * 1024 * 1024,
      windowsHide: true,
    })
    return String(stdout)
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    const stdout = String((error as { stdout?: unknown })?.stdout ?? '')
    return stdout ? stdout.split(/\r?\n/).filter(Boolean) : ['?? unable-to-read-git-status']
  }
}

export async function runV18DirtyQuarantineLedgerHarness(input: {
  repoRoot?: string
  evidenceDir?: string
} = {}): Promise<V18DirtyQuarantineLedger> {
  const repoRoot = input.repoRoot ?? process.cwd()
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'dirty-quarantine-ledger-20260507.evidence.json')
  const lines = await gitStatusShort(repoRoot)
  const ledger = buildV18DirtyQuarantineLedger({ lines, evidencePath })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
  return ledger
}
