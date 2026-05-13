import { describe, expect, test } from 'bun:test'
import {
  classifyDsxuWorkspacePlacement,
  decideDsxuExecutionPlacement,
  runDsxuExecutionPlacementHarness,
} from '../wsl-execution-placement'

describe('WSL execution placement V1', () => {
  test('classifies Windows, drvfs, and native WSL workspace roots', () => {
    expect(classifyDsxuWorkspacePlacement('D:\\DSXU-code')).toBe('windows_ntfs')
    expect(classifyDsxuWorkspacePlacement('/mnt/d/DSXU-code')).toBe('wsl_drvfs')
    expect(classifyDsxuWorkspacePlacement('/home/xurui/DSXU-code')).toBe('wsl_native_ext4')
  })

  test('prefers native WSL mirror for long TUI and container work on drvfs even when health is green', () => {
    const report = decideDsxuExecutionPlacement({
      workspaceRoot: '/mnt/d/DSXU-code',
      taskNeeds: { wslShell: true, longTui: true, container: true },
      wslWorkspaceHealth: { ok: true },
      dockerHealth: { ok: true },
    })

    expect(report.status).toBe('BLOCKED_EVIDENCED')
    expect(report.decision).toBe('PREFER_WSL_NATIVE_MIRROR')
    expect(report.recommendedWorkspaceRoot).toBe('~/work/DSXU-code')
    expect(report.preflightOrder).toContain('docker-wsl-integration-health')
  })

  test('blocks WSL tasks before model/tool changes when drvfs health is red', () => {
    const report = decideDsxuExecutionPlacement({
      workspaceRoot: '/mnt/d/DSXU-code',
      taskNeeds: { wslShell: true, longTui: true },
      wslWorkspaceHealth: { ok: false, sawDrvfsIoError: true },
    })

    expect(report.decision).toBe('BLOCK_REPAIR_WSL_WORKSPACE')
    expect(report.reasons).toContain('WSL workspace health is blocked')
  })

  test('blocks container tasks when Docker Desktop WSL proxy is broken', () => {
    const report = decideDsxuExecutionPlacement({
      workspaceRoot: '/home/xurui/DSXU-code',
      taskNeeds: { wslShell: true, container: true },
      wslWorkspaceHealth: { ok: true },
      dockerHealth: { ok: false, sawPermissionDenied: true, sawZeroByteProxy: true },
    })

    expect(report.decision).toBe('BLOCK_REPAIR_DOCKER_INTEGRATION')
    expect(report.reasons).toContain('Docker Desktop WSL integration is blocked')
    expect(report.reasons).toContain('Docker Desktop WSL proxy is broken')
  })

  test(
    'writes current placement evidence from WSL and Docker health artifacts',
    async () => {
      const report = await runDsxuExecutionPlacementHarness()

      expect(['DONE_EVIDENCED', 'BLOCKED_EVIDENCED']).toContain(report.status)
      expect(report.workspaceRoot).toBe('/mnt/d/DSXU-code')
      expect(report.preflightOrder).toContain('wsl-workspace-health')
      expect(report.preflightOrder).toContain('toolchain-selfcheck')
      expect(report.reasons.length).toBeGreaterThan(0)
    },
    30_000,
  )
})
