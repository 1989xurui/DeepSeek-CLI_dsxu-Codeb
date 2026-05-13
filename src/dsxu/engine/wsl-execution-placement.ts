import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export type DsxuWorkspacePlacementKind =
  | 'windows_ntfs'
  | 'wsl_drvfs'
  | 'wsl_native_ext4'
  | 'unknown'

export type DsxuExecutionPlacementDecision =
  | 'USE_CURRENT_WORKSPACE'
  | 'PREFER_WSL_NATIVE_MIRROR'
  | 'BLOCK_REPAIR_WSL_WORKSPACE'
  | 'BLOCK_REPAIR_DOCKER_INTEGRATION'
  | 'USE_WINDOWS_HOST'

export type DsxuExecutionPlacementInput = {
  workspaceRoot: string
  taskNeeds?: {
    wslShell?: boolean
    longTui?: boolean
    container?: boolean
    windowsOnlyTool?: boolean
  }
  wslWorkspaceHealth?: {
    ok: boolean
    status?: string
    sawDrvfsIoError?: boolean
  }
  dockerHealth?: {
    ok: boolean
    status?: string
    sawPermissionDenied?: boolean
    sawZeroByteProxy?: boolean
  }
}

export type DsxuExecutionPlacementReport = {
  status: 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'
  ok: boolean
  generatedAt: string
  evidencePath: string
  workspaceRoot: string
  workspaceKind: DsxuWorkspacePlacementKind
  decision: DsxuExecutionPlacementDecision
  reasons: readonly string[]
  preflightOrder: readonly string[]
  recommendedWorkspaceRoot?: string
}

export function classifyDsxuWorkspacePlacement(root: string): DsxuWorkspacePlacementKind {
  const normalized = root.replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) return 'windows_ntfs'
  if (/^\/mnt\/[a-z](?:\/|$)/i.test(normalized)) return 'wsl_drvfs'
  if (/^\/(?:home|root|workspace|opt|srv|tmp)(?:\/|$)/.test(normalized)) {
    return 'wsl_native_ext4'
  }
  return 'unknown'
}

function defaultNativeMirror(root: string): string | undefined {
  const normalized = root.replace(/\\/g, '/')
  const match = normalized.match(/^\/mnt\/[a-z]\/(.+)$/i)
  if (!match) return undefined
  const leaf = match[1]!.split('/').filter(Boolean).pop()
  return leaf ? `~/work/${leaf}` : '~/work/dsxu-project'
}

export function decideDsxuExecutionPlacement(
  input: DsxuExecutionPlacementInput,
): DsxuExecutionPlacementReport {
  const workspaceKind = classifyDsxuWorkspacePlacement(input.workspaceRoot)
  const taskNeeds = input.taskNeeds ?? {}
  const reasons: string[] = []
  const preflightOrder = [
    'wsl-workspace-health',
    ...(taskNeeds.container ? ['docker-wsl-integration-health'] : []),
    'toolchain-selfcheck',
    'real-tui-or-native-verification',
  ]

  let decision: DsxuExecutionPlacementDecision = 'USE_CURRENT_WORKSPACE'
  if (taskNeeds.windowsOnlyTool) {
    decision = 'USE_WINDOWS_HOST'
    reasons.push('task requires a Windows-only tool')
  }
  if (taskNeeds.wslShell || taskNeeds.longTui || taskNeeds.container) {
    if (input.wslWorkspaceHealth && !input.wslWorkspaceHealth.ok) {
      decision = 'BLOCK_REPAIR_WSL_WORKSPACE'
      reasons.push('WSL workspace health is blocked')
    } else if (input.wslWorkspaceHealth?.sawDrvfsIoError) {
      decision = 'BLOCK_REPAIR_WSL_WORKSPACE'
      reasons.push('WSL workspace health reported drvfs Input/output error')
    } else if (workspaceKind === 'wsl_drvfs' && (taskNeeds.longTui || taskNeeds.container)) {
      decision = 'PREFER_WSL_NATIVE_MIRROR'
      reasons.push('long TUI or container-backed tasks should not depend on drvfs stability')
    } else if (workspaceKind === 'windows_ntfs' && taskNeeds.wslShell) {
      decision = 'PREFER_WSL_NATIVE_MIRROR'
      reasons.push('WSL shell task starts from a Windows NTFS workspace')
    }
  }
  if (taskNeeds.container) {
    if (input.dockerHealth && !input.dockerHealth.ok) {
      decision = 'BLOCK_REPAIR_DOCKER_INTEGRATION'
      reasons.push('Docker Desktop WSL integration is blocked')
    }
    if (input.dockerHealth?.sawPermissionDenied || input.dockerHealth?.sawZeroByteProxy) {
      decision = 'BLOCK_REPAIR_DOCKER_INTEGRATION'
      reasons.push('Docker Desktop WSL proxy is broken')
    }
  }
  if (reasons.length === 0) reasons.push('current workspace placement matches task requirements')
  const ok = decision === 'USE_CURRENT_WORKSPACE' || decision === 'USE_WINDOWS_HOST'

  return {
    status: ok ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok,
    generatedAt: new Date().toISOString(),
    evidencePath: join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'wsl-execution-placement-20260507.evidence.json'),
    workspaceRoot: input.workspaceRoot,
    workspaceKind,
    decision,
    reasons,
    preflightOrder,
    recommendedWorkspaceRoot:
      decision === 'PREFER_WSL_NATIVE_MIRROR'
        ? defaultNativeMirror(input.workspaceRoot)
        : undefined,
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export async function runDsxuExecutionPlacementHarness(input: {
  workspaceRoot?: string
  evidenceDir?: string
  taskNeeds?: DsxuExecutionPlacementInput['taskNeeds']
} = {}): Promise<DsxuExecutionPlacementReport> {
  const evidenceDir = input.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'wsl-execution-placement-20260507.evidence.json')
  const wslHealth = await readJson(join(process.cwd(), '.dsxu', 'trace', 'v18-tui', 'wsl-workspace-health-20260507.evidence.json'))
  const dockerHealth = await readJson(join(evidenceDir, 'docker-wsl-integration-health-20260507.evidence.json'))
  const report = decideDsxuExecutionPlacement({
    workspaceRoot: input.workspaceRoot ?? '/mnt/d/DSXU-code',
    taskNeeds: input.taskNeeds ?? { wslShell: true, longTui: true, container: true },
    wslWorkspaceHealth: wslHealth
      ? {
          ok: wslHealth.ok === true,
          status: String(wslHealth.status ?? ''),
          sawDrvfsIoError: Boolean((wslHealth.checks as Record<string, unknown> | undefined)?.sawDrvfsIoError),
        }
      : undefined,
    dockerHealth: dockerHealth
      ? {
          ok: dockerHealth.ok === true,
          status: String(dockerHealth.status ?? ''),
          sawPermissionDenied: Boolean((dockerHealth.checks as Record<string, unknown> | undefined)?.sawPermissionDenied),
          sawZeroByteProxy: Boolean((dockerHealth.checks as Record<string, unknown> | undefined)?.sawZeroByteProxy),
        }
      : undefined,
  })
  const finalReport = { ...report, evidencePath }
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(finalReport, null, 2)}\n`, 'utf8')
  return finalReport
}
