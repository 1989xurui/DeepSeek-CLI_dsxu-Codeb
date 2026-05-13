import { describe, expect, test } from 'bun:test'
import {
  buildDsxuWslNativeMirrorPlan,
  runDsxuWslNativeMirrorPlanHarness,
} from '../wsl-native-mirror-plan'

describe('WSL native mirror plan V1', () => {
  test('allows only safe overlay copy when source is clean and placement prefers native mirror', () => {
    const plan = buildDsxuWslNativeMirrorPlan({
      sourceRoot: '/mnt/d/DSXU-code',
      placement: {
        decision: 'PREFER_WSL_NATIVE_MIRROR',
        recommendedWorkspaceRoot: '~/work/DSXU-code',
      },
      dirtyLines: [],
      nowIso: '2026-05-07T11:20:00.000Z',
    })

    expect(plan.status).toBe('DONE_EVIDENCED')
    expect(plan.syncMode).toBe('SAFE_OVERLAY_COPY')
    expect(plan.commands.join('\n')).toContain('rsync -a')
    expect(plan.commands.join('\n')).not.toContain('--delete')
    expect(plan.safeguards).toContain('plan does not run git reset, git checkout, or destructive cleanup')
  })

  test('blocks auto sync when dirty work exists and keeps a dirty ledger sample', () => {
    const plan = buildDsxuWslNativeMirrorPlan({
      sourceRoot: '/mnt/d/DSXU-code',
      placement: {
        decision: 'PREFER_WSL_NATIVE_MIRROR',
        recommendedWorkspaceRoot: '~/work/DSXU-code',
      },
      dirtyLines: [' M src/a.ts', '?? docs/plan.md'],
      nowIso: '2026-05-07T11:20:00.000Z',
    })

    expect(plan.status).toBe('BLOCKED_EVIDENCED')
    expect(plan.syncMode).toBe('PLAN_ONLY')
    expect(plan.canAutoSync).toBe(false)
    expect(plan.dirtyCount).toBe(2)
    expect(plan.blockers).toContain('source workspace has dirty or untracked work; require dirty ledger before mirror sync')
  })

  test('blocks when placement does not prefer native mirror', () => {
    const plan = buildDsxuWslNativeMirrorPlan({
      sourceRoot: '/mnt/d/DSXU-code',
      placement: {
        decision: 'USE_CURRENT_WORKSPACE',
      },
      dirtyLines: [],
      nowIso: '2026-05-07T11:20:00.000Z',
    })

    expect(plan.status).toBe('BLOCKED_EVIDENCED')
    expect(plan.blockers).toContain(
      'placement decision is USE_CURRENT_WORKSPACE, not PREFER_WSL_NATIVE_MIRROR',
    )
  })

  test(
    'writes current dirty-aware mirror plan evidence without syncing files',
    async () => {
      const plan = await runDsxuWslNativeMirrorPlanHarness()

      expect(plan.sourceRoot).toBe('/mnt/d/DSXU-code')
      expect(plan.mirrorRoot).toBe('~/work/DSXU-code')
      expect(plan.syncMode).toBe('SAFE_OVERLAY_COPY')
      expect(plan.commands.join('\n')).toContain('rsync -a')
      expect(plan.commands.join('\n')).not.toContain('--delete')
      expect(plan.dirtyCount).toBe(0)
    },
    45_000,
  )
})
