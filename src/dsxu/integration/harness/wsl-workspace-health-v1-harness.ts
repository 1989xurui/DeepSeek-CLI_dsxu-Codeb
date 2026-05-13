import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type DsxuWslWorkspaceHealthStatus = 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'

export type DsxuWslWorkspaceHealthEvidence = {
  status: DsxuWslWorkspaceHealthStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  distro: string
  root: string
  checks: {
    rootReadable: boolean
    entrypointReadable: boolean
    bunAvailable: boolean
    pythonAvailable: boolean
    sawDrvfsIoError: boolean
  }
  stdout: string
  stderr: string
  blockers: readonly string[]
  nextStep: string
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function classifyDsxuWslWorkspaceHealth(input: {
  distro: string
  root: string
  stdout: string
  stderr: string
  evidencePath: string
  nowIso?: string
}): DsxuWslWorkspaceHealthEvidence {
  const combined = `${input.stdout}\n${input.stderr}`
  const checks = {
    rootReadable: combined.includes('DSXU_WSL_HEALTH_ROOT_OK'),
    entrypointReadable: combined.includes('DSXU_WSL_HEALTH_ENTRYPOINT_OK'),
    bunAvailable: combined.includes('DSXU_WSL_HEALTH_BUN_OK'),
    pythonAvailable: combined.includes('DSXU_WSL_HEALTH_PYTHON_OK'),
    sawDrvfsIoError: /Input\/output error|cannot statx|cannot access/i.test(combined),
  }
  const blockers: string[] = []
  if (!checks.rootReadable) blockers.push('WSL cannot read the configured workspace root')
  if (!checks.entrypointReadable) blockers.push('WSL cannot read bin/dsxu-code from the workspace root')
  if (!checks.bunAvailable) blockers.push('WSL Bun runtime is unavailable')
  if (!checks.pythonAvailable) blockers.push('WSL Python runtime is unavailable')
  if (checks.sawDrvfsIoError) blockers.push('WSL drvfs reported Input/output error')
  const ok =
    checks.rootReadable &&
    checks.entrypointReadable &&
    checks.bunAvailable &&
    checks.pythonAvailable &&
    !checks.sawDrvfsIoError

  return {
    status: ok ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath: input.evidencePath,
    distro: input.distro,
    root: input.root,
    checks,
    stdout: input.stdout,
    stderr: input.stderr,
    blockers,
    nextStep: ok
      ? 'Continue real TUI/model replay from the same WSL workspace root.'
      : checks.sawDrvfsIoError
        ? 'Restart the affected WSL distro or move DSXU execution to a native WSL workspace before counting real TUI evidence.'
        : 'Fix the missing WSL runtime or workspace entrypoint before running TUI harnesses.',
  }
}

export async function runDsxuWslWorkspaceHealth(input: {
  distro?: string
  root?: string
  evidenceDir?: string
  nowIso?: string
  timeoutMs?: number
} = {}): Promise<DsxuWslWorkspaceHealthEvidence> {
  const distro = input.distro ?? 'Ubuntu'
  const root = input.root ?? '/mnt/d/DSXU-code'
  const evidenceDir = input.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-tui')
  const evidencePath = join(evidenceDir, 'wsl-workspace-health-20260507.evidence.json')
  await mkdir(evidenceDir, { recursive: true })
  const quotedRoot = shellSingleQuote(root)
  const quotedEntrypoint = shellSingleQuote(`${root}/bin/dsxu-code`)

  const script = [
    'set +e',
    'echo DSXU_WSL_HEALTH_BEGIN',
    `stat ${quotedRoot} >/dev/null 2>&1 && echo DSXU_WSL_HEALTH_ROOT_OK || { echo DSXU_WSL_HEALTH_ROOT_FAIL; stat ${quotedRoot} 2>&1; }`,
    `stat ${quotedEntrypoint} >/dev/null 2>&1 && echo DSXU_WSL_HEALTH_ENTRYPOINT_OK || { echo DSXU_WSL_HEALTH_ENTRYPOINT_FAIL; stat ${quotedEntrypoint} 2>&1; }`,
    '"$HOME/.bun/bin/bun" --version >/dev/null 2>&1 && echo DSXU_WSL_HEALTH_BUN_OK || { echo DSXU_WSL_HEALTH_BUN_FAIL; "$HOME/.bun/bin/bun" --version 2>&1; }',
    'python3 --version >/dev/null 2>&1 && echo DSXU_WSL_HEALTH_PYTHON_OK || { echo DSXU_WSL_HEALTH_PYTHON_FAIL; python3 --version 2>&1; }',
    'echo DSXU_WSL_HEALTH_END',
  ].join('\n')

  let stdout = ''
  let stderr = ''
  try {
    const result = await execFileAsync(
      'wsl.exe',
      ['-d', distro, '--', 'bash', '-lc', script],
      {
        timeout: input.timeoutMs ?? 30_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )
    stdout = String(result.stdout)
    stderr = String(result.stderr)
  } catch (error) {
    if (error && typeof error === 'object') {
      stdout = String((error as { stdout?: unknown }).stdout ?? '')
      stderr = String((error as { stderr?: unknown }).stderr ?? '')
      if (!stderr) stderr = error instanceof Error ? error.message : String(error)
    } else {
      stderr = String(error)
    }
  }

  const evidence = classifyDsxuWslWorkspaceHealth({
    distro,
    root,
    stdout,
    stderr,
    evidencePath,
    nowIso: input.nowIso,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
