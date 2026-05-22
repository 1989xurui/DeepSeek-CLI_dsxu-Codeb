import { describe, expect, test } from 'bun:test';
import {
  buildCommandCatalog,
  buildV4ComplexityRiskRegister,
  buildV4FeatureOwnerMap,
  buildV4FreezeRegister,
  buildV4ScriptSurfaceMap,
  classifyScript,
} from '../dsxu-command-catalog';

describe('dsxu-command-catalog', () => {
  test('keeps the four owner-reviewed aliases as mainline validation commands', () => {
    const catalog = buildCommandCatalog({
      'evidence:dashboard': 'bun run scripts/dsxu-evidence-dashboard.ts',
      'benchmark:swe-bench': 'bun run scripts/dsxu-swe-bench-runner.ts',
      'health:runtime': 'bun run scripts/dsxu-runtime-health.ts',
      'cache:warm': 'bun run scripts/dsxu-cache-warm.ts --dry-run',
    }, '2026-05-18T00:00:00.000Z');

    expect(catalog.status).toBe('PASS_DSXU_COMMAND_CATALOG_READY');
    expect(catalog.mainlineAliases).toEqual([
      'evidence:dashboard',
      'benchmark:swe-bench',
      'health:runtime',
      'cache:warm',
    ]);
    expect(catalog.categorySummary['mainline-validation']).toBe(4);
    expect(catalog.entries.every(entry => entry.publicClaimUse === 'allowed-with-evidence')).toBe(true);
    expect(catalog.ownerFocusedVerificationGroups.map(group => group.groupId)).toContain(
      'tool-runtime-event-boundary',
    );
    expect(catalog.ownerFocusedVerificationGroups.map(group => group.groupId)).toContain(
      'verification-recovery-ledger',
    );
    expect(catalog.ownerFocusedVerificationGroups.every(group => group.timeoutBudgetMs > 0)).toBe(true);
    expect(catalog.ownerFocusedVerificationGroups
      .filter(group => group.testTier === 'mainline')
      .every(group => group.timeoutBudgetMs <= 60_000 && group.liveProvider === false)).toBe(true);
    expect(catalog.ownerFocusedVerificationGroups.find(group => group.groupId === 'tui-trust-projection')).toMatchObject({
      testTier: 'acceptance',
      liveProvider: false,
    });
    expect(
      catalog.ownerFocusedVerificationGroups.flatMap(group => group.commands),
    ).not.toContain('bun run test:mainline');
    expect(
      catalog.ownerFocusedVerificationGroups.flatMap(group => group.commands),
    ).not.toContain('bun run regression-check');
  });

  test('does not let historical V-series evidence scripts become product surfaces', () => {
    const result = classifyScript('v26:reference-experience-reverse-analysis', 'bun run scripts/dsxu-v26-reference.ts');

    expect(result).toMatchObject({
      category: 'historical-evidence',
      owner: 'Evidence / release claim binder owner',
      publicClaimUse: 'internal-only',
    });
  });

  test('marks owner review and release commands outside public feature claims', () => {
    expect(classifyScript('owner-git:preflight', 'bun run scripts/dsxu-owner-git-preflight.ts')).toMatchObject({
      category: 'owner-review',
      publicClaimUse: 'blocked-as-claim',
    });
    expect(classifyScript('release:clean-export-artifact', 'bun run scripts/dsxu-clean-export.ts')).toMatchObject({
      category: 'release-only',
      publicClaimUse: 'operator-only',
    });
  });

  test('generates the V4 P0 owner/freeze/risk/script-surface artifacts without creating a new mainline', () => {
    const featureMap = buildV4FeatureOwnerMap('2026-05-18T00:00:00.000Z');
    const freezeRegister = buildV4FreezeRegister('2026-05-18T00:00:00.000Z');
    const riskRegister = buildV4ComplexityRiskRegister('2026-05-18T00:00:00.000Z');
    const catalog = buildCommandCatalog({
      'evidence:dashboard': 'bun run scripts/dsxu-evidence-dashboard.ts',
      'benchmark:swe-bench': 'bun run scripts/dsxu-swe-bench-runner.ts',
      'health:runtime': 'bun run scripts/dsxu-runtime-health.ts',
      'cache:warm': 'bun run scripts/dsxu-cache-warm.ts --dry-run',
      'owner-git:preflight': 'bun run scripts/dsxu-owner-git-mutation-preflight.ts',
      'release:clean-export-artifact': 'bun run scripts/dsxu-v24-clean-export-artifact.ts',
      'live:provider-gate': 'bun run scripts/dsxu-live-provider-gate.ts',
      'v26:naming-governance': 'bun run scripts/dsxu-v26-naming-governance-board.ts',
    }, '2026-05-18T00:00:00.000Z');
    const surfaceMap = buildV4ScriptSurfaceMap(catalog);

    expect(featureMap.status).toBe('PASS_DSXU_V4_FEATURE_OWNER_MAP_READY');
    expect(new Set(featureMap.productCores).size).toBe(8);
    for (const core of featureMap.productCores) {
      expect(featureMap.entries.some(entry => entry.productCore === core)).toBe(true);
    }
    expect(featureMap.entries.some(entry => entry.state === 'frozen-experimental')).toBe(true);
    expect(featureMap.entries.some(entry => entry.state === 'release-only')).toBe(true);
    expect(featureMap.entries.every(entry => entry.ownerFiles.length > 0)).toBe(true);
    expect(featureMap.entries.every(entry => entry.acceptanceEvidence.length > 0)).toBe(true);

    expect(freezeRegister.status).toBe('PASS_DSXU_V4_FREEZE_REGISTER_READY');
    expect(freezeRegister.entries.map(entry => entry.capability)).toEqual(
      expect.arrayContaining([
        'Voting / consensus panel',
        'Forked agent counterfactual branch',
        'Swarm / team mesh',
        'Legacy ToolBus',
        'Multiple recovery planner variants',
        'Multiple prompt stacks',
      ]),
    );

    expect(riskRegister.status).toBe('PASS_DSXU_V4_COMPLEXITY_RISK_REGISTER_READY');
    expect(riskRegister.entries.map(entry => entry.riskClass)).toEqual(
      expect.arrayContaining([
        'second-provider',
        'second-toolbus',
        'second-agent',
        'second-tui',
        'prompt-stack',
        'script-surface',
        'claim-inflation',
      ]),
    );
    expect(riskRegister.entries.every(entry => entry.requiredAction.length > 0)).toBe(true);

    expect(surfaceMap.status).toBe('PASS_DSXU_V4_SCRIPT_SURFACE_MAP_READY');
    expect(surfaceMap.mainlineAliases).toEqual(catalog.mainlineAliases);
    expect(surfaceMap.ownerReviewScripts).toContain('owner-git:preflight');
    expect(surfaceMap.releaseOnlyScripts).toContain('release:clean-export-artifact');
    expect(surfaceMap.liveProviderScripts).toContain('live:provider-gate');
    expect(surfaceMap.publicClaimBlockedScripts).toContain('owner-git:preflight');
  });
});
