import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { collectCacheHitClosure } from '../dsxu-cache-hit-closure';

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('cache hit closure', () => {
  test('passes internal closure with live A/B plus hash-only reality evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-cache-hit-closure-'));
    try {
      const livePath = join(root, 'live.json');
      const realityPath = join(root, 'reality.json');
      const outPath = join(root, 'closure.json');

      writeJson(livePath, {
        status: 'PASS_CACHE_LIVE_AB',
        didCallProvider: true,
        prefixHash: 'abc123',
        firstHitRatePct: 0,
        lastHitRatePct: 99.6,
        hitRateDeltaPct: 99.6,
        roundsRequested: 3,
        observations: [{}, {}, {}],
      });
      writeJson(realityPath, {
        status: 'PASS_CACHE_REALITY_DRY_RUN',
        prefix: {
          boundaryFound: true,
          stablePrefixHash: 'abc123',
          stablePrefixApproxTokens: 5963,
          dynamicTailApproxTokens: 3483,
        },
        redaction: { publicReportHashOnly: true },
      });

      const report = collectCacheHitClosure({
        liveAbPath: livePath,
        realityRunPath: realityPath,
        outPath,
      });

      expect(report.status).toBe('PASS_CACHE_HIT_CLOSURE_INTERNAL');
      expect(report.internalCacheClaimAllowed).toBe(true);
      expect(report.publicClaimAllowed).toBe(false);
      expect(report.acceptance.liveRepeatedPrefixPassed).toBe(true);
      expect(report.sourceSafety.dryRunDefault).toBe(true);
      expect(report.sourceSafety.onCacheMissDryRunLedgerOnly).toBe(true);
      expect(report.blockers).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks when live evidence is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-cache-hit-closure-'));
    try {
      const realityPath = join(root, 'reality.json');
      writeJson(realityPath, {
        status: 'PASS_CACHE_REALITY_DRY_RUN',
        prefix: { boundaryFound: true },
        redaction: { publicReportHashOnly: true },
      });

      const report = collectCacheHitClosure({
        liveAbPath: join(root, 'missing-live.json'),
        realityRunPath: realityPath,
        outPath: join(root, 'closure.json'),
      });

      expect(report.status).toBe('BLOCKED_CACHE_HIT_CLOSURE');
      expect(report.internalCacheClaimAllowed).toBe(false);
      expect(report.blockers).toContain('live repeated-prefix A/B did not prove >=80% last-round cache hit');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
