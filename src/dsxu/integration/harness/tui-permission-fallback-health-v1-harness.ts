import { mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { getToolPermissionFallbackSummary } from '../../../screens/REPL'
import { BashTool } from '../../../tools/BashTool/BashTool'
import { PowerShellTool } from '../../../tools/PowerShellTool/PowerShellTool'
import {
  buildDsxuTuiHealthSnapshot,
  type DsxuTuiHealthSnapshot,
} from '../../../utils/dsxuHealthMonitor'

export type TuiPermissionFallbackHealthResult = {
  ok: boolean
  evidencePath: string
  snapshots: Record<string, DsxuTuiHealthSnapshot>
  summaries: Record<string, string>
}

export type TuiPermissionFallbackHealthOptions = {
  repoRoot?: string
  evidenceDir?: string
}

const BASE = {
  isLoading: true,
  showSpinner: false,
  streamingTextLength: 0,
  inProgressToolUseCount: 0,
  commandQueueLength: 0,
  mainPromptCommandQueued: false,
  suppressingDialogs: false,
}

export async function buildTuiPermissionFallbackHealthEvidence(
  options: TuiPermissionFallbackHealthOptions = {},
): Promise<TuiPermissionFallbackHealthResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd())
  const evidenceDir =
    options.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-tui')
  const evidencePath = join(evidenceDir, 'permission-fallback-health.json')
  await mkdir(evidenceDir, { recursive: true })

  const snapshots = {
    hiddenPermission: buildDsxuTuiHealthSnapshot({
      ...BASE,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 1,
      permissionFallbackVisible: false,
    }),
    fixedFallbackVisible: buildDsxuTuiHealthSnapshot({
      ...BASE,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 1,
      permissionFallbackVisible: true,
    }),
    overlayVisible: buildDsxuTuiHealthSnapshot({
      ...BASE,
      focusedInputDialog: 'tool-permission',
      toolUseConfirmQueueLength: 1,
      permissionFallbackVisible: false,
    }),
    backgroundTaskRunning: buildDsxuTuiHealthSnapshot({
      ...BASE,
      isLoading: false,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
      backgroundTasks: [
        {
          id: 'task-bg-1',
          type: 'bash',
          status: 'running',
          description: 'background server',
          outputFile: 'D:/DSXU-code/.dsxu/task-output/task-bg-1.txt',
          toolUseId: 'toolu-bg-1',
        },
      ],
    }),
    invisibleLoading: buildDsxuTuiHealthSnapshot({
      ...BASE,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
    }),
  }

  const summaries = {
    bash: getToolPermissionFallbackSummary({
      tool: BashTool,
      input: {
        command: 'echo DSXU_NEEDS_REVIEW > blocked.txt',
        description: 'Attempt blocked redirection',
      },
      description: 'Attempt blocked redirection',
    } as never),
    powershell: getToolPermissionFallbackSummary({
      tool: PowerShellTool,
      input: {
        command:
          'Set-Content -Path blocked.txt -Value DSXU_NEEDS_REVIEW',
        description: 'Attempt blocked PowerShell write',
      },
      description: 'Attempt blocked PowerShell write',
    } as never),
  }

  const ok =
    snapshots.hiddenPermission.status === 'stalled' &&
    snapshots.hiddenPermission.issues.some(
      issue => issue.kind === 'permission_prompt_hidden',
    ) &&
    snapshots.fixedFallbackVisible.status === 'waiting' &&
    snapshots.fixedFallbackVisible.visibleState === 'permission_waiting' &&
    snapshots.fixedFallbackVisible.issues.length === 0 &&
    snapshots.overlayVisible.status === 'waiting' &&
    snapshots.overlayVisible.visibleState === 'permission_waiting' &&
    snapshots.overlayVisible.issues.length === 0 &&
    snapshots.backgroundTaskRunning.status === 'idle' &&
    snapshots.backgroundTaskRunning.visibleState === 'background_task_running' &&
    snapshots.backgroundTaskRunning.backgroundTaskCount === 1 &&
    snapshots.backgroundTaskRunning.backgroundTasks[0]?.id === 'task-bg-1' &&
    snapshots.backgroundTaskRunning.backgroundTasks[0]?.outputFile?.includes(
      'task-bg-1.txt',
    ) &&
    snapshots.backgroundTaskRunning.issues.length === 0 &&
    snapshots.invisibleLoading.status === 'stalled' &&
    snapshots.invisibleLoading.visibleState === 'stuck_no_event' &&
    snapshots.invisibleLoading.issues.some(
      issue => issue.kind === 'loading_without_visible_progress',
    ) &&
    summaries.bash.includes('Bash') &&
    summaries.bash.includes('DSXU_NEEDS_REVIEW') &&
    summaries.powershell.includes('PowerShell') &&
    summaries.powershell.includes('Set-Content')

  const result = { ok, evidencePath, snapshots, summaries }
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
