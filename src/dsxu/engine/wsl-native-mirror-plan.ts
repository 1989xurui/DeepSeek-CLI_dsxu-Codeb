import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import type { DsxuExecutionPlacementReport } from './wsl-execution-placement'

const execFileAsync = promisify(execFile)

export type DsxuWslNativeMirrorPlan = {
  status: 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'
  ok: boolean
  generatedAt: string
  evidencePath: string
  sourceRoot: string
  mirrorRoot: string
  dirtyCount: number
  dirtySamples: readonly string[]
  canAutoSync: boolean
  syncMode: 'PLAN_ONLY' | 'SAFE_OVERLAY_COPY'
  commands: readonly string[]
  safeguards: readonly string[]
  blockers: readonly string[]
  nextStep: string
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function defaultMirrorRoot(sourceRoot: string): string {
  const leaf = sourceRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop()
  return `~/work/${leaf || 'dsxu-project'}`
}

export function buildDsxuWslNativeMirrorPlan(input: {
  sourceRoot: string
  placement?: Pick<DsxuExecutionPlacementReport, 'decision' | 'recommendedWorkspaceRoot'>
  dirtyLines: readonly string[]
  evidencePath?: string
  nowIso?: string
}): DsxuWslNativeMirrorPlan {
  const mirrorRoot = input.placement?.recommendedWorkspaceRoot ?? defaultMirrorRoot(input.sourceRoot)
  const dirtyCount = input.dirtyLines.length
  const blockers: string[] = []
  if (input.placement && input.placement.decision !== 'PREFER_WSL_NATIVE_MIRROR') {
    blockers.push(`placement decision is ${input.placement.decision}, not PREFER_WSL_NATIVE_MIRROR`)
  }
  const canAutoSync = dirtyCount === 0 && blockers.length === 0
  if (dirtyCount > 0) {
    blockers.push('source workspace has dirty or untracked work; require dirty ledger before mirror sync')
  }
  const source = shellSingleQuote(input.sourceRoot)
  const target = shellSingleQuote(mirrorRoot)
  const commands = [
    `mkdir -p ${target}`,
    [
      'rsync -a --human-readable --info=stats2',
      '--exclude node_modules/',
      '--exclude .git/index.lock',
      '--exclude .dsxu/runs/',
      '--exclude .dsxu/tmp/',
      source.endsWith('/') ? source : `${source}/`,
      target,
    ].join(' '),
    `cd ${target} && git status --short`,
  ]
  const safeguards = [
    'plan does not use --delete',
    'plan does not run git reset, git checkout, or destructive cleanup',
    'dirty ledger must be reviewed before first real sync',
    'native mirror verification must rerun source health and focused tests before claims',
  ]

  return {
    status: canAutoSync ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: canAutoSync,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'wsl-native-mirror-plan-20260507.evidence.json'),
    sourceRoot: input.sourceRoot,
    mirrorRoot,
    dirtyCount,
    dirtySamples: input.dirtyLines.slice(0, 40),
    canAutoSync,
    syncMode: canAutoSync ? 'SAFE_OVERLAY_COPY' : 'PLAN_ONLY',
    commands,
    safeguards,
    blockers,
    nextStep: canAutoSync
      ? 'Run the safe overlay copy in WSL, then execute WSL health, Docker health, and focused release checks from the mirror.'
      : 'Stabilize or ledger dirty work before creating the WSL-native mirror; do not run destructive sync.',
  }
}

async function gitStatusShort(repoRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], {
      cwd: repoRoot,
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return String(stdout)
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(Boolean)
  } catch {
    return ['?? unable-to-read-git-status']
  }
}

export async function runDsxuWslNativeMirrorPlanHarness(input: {
  sourceRoot?: string
  mirrorRoot?: string
  evidenceDir?: string
  placement?: Pick<DsxuExecutionPlacementReport, 'decision' | 'recommendedWorkspaceRoot'>
} = {}): Promise<DsxuWslNativeMirrorPlan> {
  const repoRoot = process.cwd()
  const sourceRoot = input.sourceRoot ?? '/mnt/d/DSXU-code'
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'wsl-native-mirror-plan-20260507.evidence.json')
  const dirtyLines = await gitStatusShort(repoRoot)
  const plan = buildDsxuWslNativeMirrorPlan({
    sourceRoot,
    placement: input.placement ?? {
      decision: 'PREFER_WSL_NATIVE_MIRROR',
      recommendedWorkspaceRoot: input.mirrorRoot ?? '~/work/DSXU-code',
    },
    dirtyLines,
    evidencePath,
  })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
  return plan
}
