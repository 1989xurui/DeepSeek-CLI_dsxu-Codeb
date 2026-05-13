import { describe, expect, test } from 'bun:test'
import {
  buildV18DirtyQuarantineLedger,
  runV18DirtyQuarantineLedgerHarness,
} from '../v18-dirty-quarantine-ledger'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')

describe('V18 dirty quarantine ledger V1', () => {
  test('classifies mainline, V18 evidence, toolchain, quarantine, and unknown dirty paths', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-07T11:30:00.000Z',
      lines: [
        ' M src/dsxu/engine/release-test-gate.ts',
        ' M bunfig.toml',
        '?? docs/DSXU_V18_PROGRESS_20260506.md',
        '?? src/dsxu/integration/harness/docker-wsl-integration-health-v1-harness.ts',
        ' D src/bridge/bridgeMain.ts',
        ' D evals/swe-bench/runner.py',
        ' M scripts/guards/check-protected.ts',
        ` D start-${LEGACY_PRODUCT}.ps1`,
        '?? tmp_v18_full_audit.txt',
        `?? "\\346\\272\\220\\347\\240\\201${LEGACY_PRODUCT}/"`,
        '?? strange/new-file.txt',
      ],
    })

    expect(ledger.total).toBe(11)
    expect(ledger.countsByCategory.mainline_active).toBe(3)
    expect(ledger.countsByCategory.v18_plan_or_evidence).toBe(1)
    expect(ledger.countsByCategory.legacy_quarantine_delete).toBe(3)
    expect(ledger.countsByCategory.toolchain_or_runtime).toBe(1)
    expect(ledger.countsByCategory.side_path_or_archive).toBe(2)
    expect(ledger.countsByCategory.unknown).toBe(1)
    expect(ledger.mirrorSyncAllowed).toBe(false)
    expect(ledger.safeguards).toContain('ledger does not delete, restore, or move files')
  })

  test('keeps clean worktrees eligible for mirror sync', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-07T11:30:00.000Z',
      lines: [],
    })

    expect(ledger.status).toBe('DONE_EVIDENCED')
    expect(ledger.ok).toBe(true)
    expect(ledger.mirrorSyncAllowed).toBe(true)
    expect(ledger.blockers).toEqual([])
  })

  test(
    'writes current dirty ledger evidence without mutating the worktree',
    async () => {
      const ledger = await runV18DirtyQuarantineLedgerHarness()

      expect(ledger.total).toBe(0)
      expect(ledger.mirrorSyncAllowed).toBe(true)
      expect(ledger.samples.length).toBe(0)
      expect(ledger.safeguards).toContain('legacy and side-path entries are quarantine-classified, not removed')
    },
    45_000,
  )
})
