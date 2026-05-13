import { describe, expect, test } from 'bun:test'
import {
  classifyDsxuWslWorkspaceHealth,
  runDsxuWslWorkspaceHealth,
} from '../../integration/harness/wsl-workspace-health-v1-harness'

describe('WSL workspace health V1', () => {
  test('classifies drvfs Input/output error as blocked evidence instead of a TUI/model failure', () => {
    const evidence = classifyDsxuWslWorkspaceHealth({
      distro: 'Ubuntu',
      root: '/mnt/d/DSXU-code',
      evidencePath: '.dsxu/trace/v18-tui/wsl-workspace-health-20260507.evidence.json',
      stdout: [
        'DSXU_WSL_HEALTH_BEGIN',
        'DSXU_WSL_HEALTH_ROOT_FAIL',
        "stat: cannot statx '/mnt/d/DSXU-code': Input/output error",
        'DSXU_WSL_HEALTH_ENTRYPOINT_FAIL',
        'DSXU_WSL_HEALTH_BUN_OK',
        'DSXU_WSL_HEALTH_PYTHON_OK',
        'DSXU_WSL_HEALTH_END',
      ].join('\n'),
      stderr: '',
      nowIso: '2026-05-07T10:00:00.000Z',
    })

    expect(evidence.status).toBe('BLOCKED_EVIDENCED')
    expect(evidence.ok).toBe(false)
    expect(evidence.checks.sawDrvfsIoError).toBe(true)
    expect(evidence.blockers).toContain('WSL drvfs reported Input/output error')
    expect(evidence.nextStep).toContain('native WSL workspace')
  })

  test(
    'proves the current WSL workspace can read DSXU entrypoint and runtimes',
    async () => {
      const evidence = await runDsxuWslWorkspaceHealth({ timeoutMs: 30_000 })

      expect(evidence.ok, JSON.stringify(evidence.blockers)).toBe(true)
      expect(evidence.status).toBe('DONE_EVIDENCED')
      expect(evidence.checks.rootReadable).toBe(true)
      expect(evidence.checks.entrypointReadable).toBe(true)
      expect(evidence.checks.bunAvailable).toBe(true)
      expect(evidence.checks.pythonAvailable).toBe(true)
      expect(evidence.checks.sawDrvfsIoError).toBe(false)
    },
    45_000,
  )
})
