import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { runControlPlaneReplayHarness } from '../../integration/harness/control-plane-replay-v1-harness'
import { buildTuiPermissionFallbackHealthEvidence } from '../../integration/harness/tui-permission-fallback-health-v1-harness'

describe('V18 TUI permission fallback health', () => {
  test('distinguishes hidden permission stalls from visible fallback waiting states', async () => {
    const result = await buildTuiPermissionFallbackHealthEvidence()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.snapshots.hiddenPermission.status).toBe('stalled')
    expect(result.snapshots.hiddenPermission.visibleState).toBe('stuck_no_event')
    expect(result.snapshots.hiddenPermission.issues.map(issue => issue.kind)).toContain(
      'permission_prompt_hidden',
    )
    expect(result.snapshots.fixedFallbackVisible.status).toBe('waiting')
    expect(result.snapshots.fixedFallbackVisible.visibleState).toBe('permission_waiting')
    expect(result.snapshots.fixedFallbackVisible.issues).toHaveLength(0)
    expect(result.snapshots.overlayVisible.status).toBe('waiting')
    expect(result.snapshots.overlayVisible.visibleState).toBe('permission_waiting')
    expect(result.snapshots.overlayVisible.issues).toHaveLength(0)
    expect(result.snapshots.backgroundTaskRunning.status).toBe('idle')
    expect(result.snapshots.backgroundTaskRunning.visibleState).toBe(
      'background_task_running',
    )
    expect(result.snapshots.backgroundTaskRunning.backgroundTaskCount).toBe(1)
    expect(result.snapshots.backgroundTaskRunning.backgroundTasks[0]).toMatchObject({
      id: 'task-bg-1',
      type: 'bash',
      status: 'running',
      outputFile: 'D:/DSXU-code/.dsxu/task-output/task-bg-1.txt',
      toolUseId: 'toolu-bg-1',
    })
    expect(result.snapshots.backgroundTaskRunning.issues).toHaveLength(0)
    expect(result.snapshots.invisibleLoading.issues.map(issue => issue.kind)).toContain(
      'loading_without_visible_progress',
    )
    expect(result.summaries.bash).toContain('DSXU_NEEDS_REVIEW')
    expect(result.summaries.powershell).toContain('Set-Content')

    expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
    const evidence = await readFile(result.evidencePath, 'utf8')
    expect(evidence).toContain('"ok": true')
    expect(evidence).toContain('"visibleState": "background_task_running"')
    expect(evidence).toContain('"id": "task-bg-1"')
    expect(evidence).toContain('"outputFile": "D:/DSXU-code/.dsxu/task-output/task-bg-1.txt"')
    expect(evidence).toContain('"permission_prompt_hidden"')
  })

  test('control-plane permission replay resolves through visible permission health state', async () => {
    const replay = await runControlPlaneReplayHarness({
      scenarioName: 'control-plane-permission-tui-health-replay',
      now: 1_778_000_100_000,
    })
    const health = await buildTuiPermissionFallbackHealthEvidence()

    expect(replay.ok).toBe(true)
    expect(replay.hiddenPermissionWaiting).toBe(false)
    expect(replay.permissionStatus).toBe('answered')
    expect(health.snapshots.fixedFallbackVisible.status).toBe('waiting')
    expect(health.snapshots.fixedFallbackVisible.visibleState).toBe('permission_waiting')
    expect(health.snapshots.fixedFallbackVisible.issues).toHaveLength(0)
    expect(health.snapshots.hiddenPermission.status).toBe('stalled')
    expect(health.snapshots.hiddenPermission.visibleState).toBe('stuck_no_event')
    expect(health.snapshots.hiddenPermission.issues.map(issue => issue.kind)).toContain(
      'permission_prompt_hidden',
    )
  })
})
