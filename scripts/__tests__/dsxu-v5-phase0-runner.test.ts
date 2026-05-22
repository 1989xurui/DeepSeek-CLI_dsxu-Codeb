import { describe, expect, test } from 'bun:test';
import {
  assessClaimBoundary,
  assessReplayPack,
  buildV5Phase0Suites,
  type V5Phase0SuiteId,
} from '../dsxu-v5-phase0-runner';
import { buildCommandCatalog } from '../dsxu-command-catalog';

describe('dsxu-v5-phase0-runner', () => {
  test('builds Phase 0 suites from existing owner-focused verification groups', () => {
    const catalog = buildCommandCatalog({
      'evidence:dashboard': 'bun run scripts/dsxu-evidence-dashboard.ts',
      'benchmark:swe-bench': 'bun run scripts/dsxu-swe-bench-runner.ts',
      'health:runtime': 'bun run scripts/dsxu-runtime-health.ts',
      'cache:warm': 'bun run scripts/dsxu-cache-warm.ts --dry-run',
    }, '2026-05-19T00:00:00.000Z');
    const suites = buildV5Phase0Suites(catalog);
    const ids: V5Phase0SuiteId[] = ['mainline', 'experience', 'release-gates', 'claim-boundary', 'replay-regression', 'phase0'];

    for (const id of ids) {
      expect(suites[id].commands.length).toBeGreaterThan(0);
    }
    expect(suites.mainline.commands.every(command => command.liveProvider === false)).toBe(true);
    expect(suites.mainline.commands.every(command => command.timeoutMs <= 60_000)).toBe(true);
    expect(suites.experience.commands.some(command => command.command.includes('real-tui-harness'))).toBe(true);
    expect(suites['release-gates'].commands.map(command => command.command)).not.toContain('bun run test:six-stage-final');
    expect(suites['release-gates'].deferredFullReleaseCommands).toEqual(['bun run test:six-stage-final']);
    expect(suites['claim-boundary'].commands).toEqual([
      expect.objectContaining({
        command: 'bun run evidence:dashboard',
        claimBoundary: 'claim-boundary',
      }),
    ]);
    expect(suites['replay-regression'].commands).toEqual([
      expect.objectContaining({
        command: 'bun run scripts/dsxu-v5-replay-bank.ts',
        claimBoundary: 'replay-regression',
      }),
    ]);
    expect(suites.phase0.commands.map(command => command.command)).not.toContain('bun run test:six-stage-final');
  });

  test('treats release-blocked dashboard state as an honest claim boundary pass', () => {
    const assessment = assessClaimBoundary({
      scoreFloor: 72,
      workbench: {
        releaseClaimAllowed: false,
      },
      releaseTrustPanel: {
        status: 'blocked',
        publicComparableMissingCases: 30,
        blockedGateNames: ['DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515'],
        dataStillNeeded: ['public comparable raw evidence for 30 cases'],
      },
    });

    expect(assessment).toMatchObject({
      status: 'PASS_CLAIM_BOUNDARY_HELD',
      scoreFloor: 72,
      releaseClaimAllowed: false,
      releaseTrustStatus: 'blocked',
      publicComparableMissingCases: 30,
    });
  });

  test('promotes failed real-task cases into replay regression blockers', () => {
    const assessment = assessReplayPack({
      schemaVersion: 'dsxu.v5.replay-bank-intake.v1',
      status: 'BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET',
      nativeV5ReadyCount: 3,
      blockers: ['20-case V5 required subset is not ready'],
      bank: {
        caseCount: 3,
        acceptedCount: 2,
        requiredSubsetReady: false,
        fullReleaseReady: false,
        redlines: ['release-claim-evidence-binder: missing route'],
      },
      audits: [
        { caseId: 'passed-a', missingStandardFields: [], missingNativeFields: [] },
        { caseId: 'release-claim-evidence-binder', missingStandardFields: ['route'], missingNativeFields: [] },
        { caseId: 'passed-b', missingStandardFields: [], missingNativeFields: [] },
      ],
    });

    expect(assessment).toMatchObject({
      status: 'BLOCKED_REPLAY_REGRESSION',
      caseCount: 3,
      passCount: 2,
      acceptedCount: 2,
      nativeV5ReadyCount: 3,
      requiredSubsetReady: false,
      failedCaseIds: ['release-claim-evidence-binder'],
      blockers: [
        '20-case V5 required subset is not ready',
        'release-claim-evidence-binder: missing route',
      ],
    });
  });
});
