import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  CacheStatsImpl,
  cacheTuningHook,
  globalCacheStats,
  recordCacheUsage,
} from './cache-stats';

describe('R5-19: Cache hit baseline + telemetry', () => {
  let cacheStats: CacheStatsImpl;
  let tmpStatsRoot: string | null = null;
  const originalCacheStatsPath = process.env.DSXU_CACHE_STATS_PATH;
  const originalCacheStatsDir = process.env.DSXU_CACHE_STATS_DIR;

  beforeEach(() => {
    tmpStatsRoot = mkdtempSync(join(tmpdir(), 'dsxu-cache-stats-test-'));
    process.env.DSXU_CACHE_STATS_PATH = join(tmpStatsRoot, 'cache-stats.json');
    delete process.env.DSXU_CACHE_STATS_DIR;
    cacheStats = new CacheStatsImpl(true);
  });

  afterEach(() => {
    if (originalCacheStatsPath === undefined) delete process.env.DSXU_CACHE_STATS_PATH;
    else process.env.DSXU_CACHE_STATS_PATH = originalCacheStatsPath;
    if (originalCacheStatsDir === undefined) delete process.env.DSXU_CACHE_STATS_DIR;
    else process.env.DSXU_CACHE_STATS_DIR = originalCacheStatsDir;
    if (tmpStatsRoot && existsSync(tmpStatsRoot)) {
      rmSync(tmpStatsRoot, { recursive: true, force: true });
    }
    tmpStatsRoot = null;
  });

  describe('basic accounting', () => {
    it('starts at zero', () => {
      expect(cacheStats.hit).toBe(0);
      expect(cacheStats.miss).toBe(0);
      expect(cacheStats.ratio()).toBe(0);
    });

    it('derives miss tokens from total prompt tokens when explicit miss is absent', () => {
      cacheStats.record({ prompt_cache_hit_tokens: 100, prompt_tokens: 200 });
      expect(cacheStats.hit).toBe(100);
      expect(cacheStats.miss).toBe(100);
      expect(cacheStats.ratio()).toBe(0.5);
    });

    it('uses explicit DeepSeek miss tokens instead of deriving from total tokens', () => {
      cacheStats.record({
        prompt_cache_hit_tokens: 100,
        prompt_cache_miss_tokens: 20,
        prompt_tokens: 999,
      });

      expect(cacheStats.hit).toBe(100);
      expect(cacheStats.miss).toBe(20);
      expect(cacheStats.ratio()).toBeCloseTo(100 / 120);
    });

    it('records normalized adapter cache fields', () => {
      cacheStats.record({
        cache_read_input_tokens: 30,
        cache_creation_input_tokens: 70,
        input_tokens: 100,
      });

      expect(cacheStats.hit).toBe(30);
      expect(cacheStats.miss).toBe(70);
      expect(cacheStats.ratio()).toBe(0.3);
    });

    it('records nested dsxu usage fields when top-level fields are absent', () => {
      cacheStats.record({
        prompt_tokens: 50,
        dsxu: {
          prompt_cache_hit_tokens: 44,
          prompt_cache_miss_tokens: 6,
        },
      });

      expect(cacheStats.hit).toBe(44);
      expect(cacheStats.miss).toBe(6);
    });

    it('records only hit tokens when no total or explicit miss is present', () => {
      cacheStats.record({ prompt_cache_hit_tokens: 50 });
      expect(cacheStats.hit).toBe(50);
      expect(cacheStats.miss).toBe(0);
      expect(cacheStats.ratio()).toBe(1);
    });

    it('records only total tokens as misses when hit tokens are absent', () => {
      cacheStats.record({ prompt_tokens: 300 });
      expect(cacheStats.hit).toBe(0);
      expect(cacheStats.miss).toBe(300);
      expect(cacheStats.ratio()).toBe(0);
    });

    it('ignores empty and invalid usage fields', () => {
      cacheStats.record({});
      // @ts-expect-error invalid input shape for defensive runtime behavior
      cacheStats.record({ prompt_cache_hit_tokens: 'invalid', prompt_tokens: null });

      expect(cacheStats.hit).toBe(0);
      expect(cacheStats.miss).toBe(0);
      expect(cacheStats.ratio()).toBe(0);
    });

    it('persists stats to the configured project cache path when flushed', () => {
      const statsPath = process.env.DSXU_CACHE_STATS_PATH!;

      cacheStats.record({
        prompt_cache_hit_tokens: 12,
        prompt_cache_miss_tokens: 3,
      });
      expect(existsSync(statsPath)).toBe(false);
      cacheStats.flush();

      expect(existsSync(statsPath)).toBe(true);
      const saved = JSON.parse(readFileSync(statsPath, 'utf8'));
      expect(saved).toMatchObject({ hit: 12, miss: 3 });
    });

    it('can opt into immediate disk writes for deterministic diagnostics', () => {
      const previousFlushInterval = process.env.DSXU_CACHE_STATS_FLUSH_INTERVAL_MS;
      const statsPath = process.env.DSXU_CACHE_STATS_PATH!;
      try {
        process.env.DSXU_CACHE_STATS_FLUSH_INTERVAL_MS = '0';
        const immediateStats = new CacheStatsImpl(true);

        immediateStats.record({
          prompt_cache_hit_tokens: 9,
          prompt_cache_miss_tokens: 1,
        });

        expect(existsSync(statsPath)).toBe(true);
        const saved = JSON.parse(readFileSync(statsPath, 'utf8'));
        expect(saved).toMatchObject({ hit: 9, miss: 1 });
      } finally {
        if (previousFlushInterval === undefined) delete process.env.DSXU_CACHE_STATS_FLUSH_INTERVAL_MS;
        else process.env.DSXU_CACHE_STATS_FLUSH_INTERVAL_MS = previousFlushInterval;
      }
    });
  });

  describe('reset and snapshots', () => {
    it('reset clears counters', () => {
      cacheStats.record({ prompt_cache_hit_tokens: 100, prompt_tokens: 200 });
      expect(cacheStats.hit).toBe(100);
      expect(cacheStats.miss).toBe(100);

      cacheStats.reset();
      expect(cacheStats.hit).toBe(0);
      expect(cacheStats.miss).toBe(0);
      expect(cacheStats.ratio()).toBe(0);
    });

    it('snapshot includes current counters', () => {
      cacheStats.record({ prompt_cache_hit_tokens: 75, prompt_tokens: 150 });
      const snapshot = cacheStats.snapshot();

      expect(snapshot.hit).toBe(75);
      expect(snapshot.miss).toBe(75);
      expect(snapshot.ratio).toBe(0.5);
      expect(typeof snapshot.ts).toBe('number');
      expect(snapshot.ts).toBeGreaterThan(0);
    });
  });

  describe('global singleton and proxy entrypoint', () => {
    beforeEach(() => {
      (globalCacheStats as any).reset?.();
      (globalCacheStats as any)._hit = 0;
      (globalCacheStats as any)._miss = 0;
    });

    it('recordCacheUsage handles provider usage fields', () => {
      recordCacheUsage({
        prompt_cache_hit_tokens: 30,
        prompt_cache_miss_tokens: 5,
        prompt_tokens: 60,
      });

      expect(globalCacheStats.hit).toBe(30);
      expect(globalCacheStats.miss).toBe(5);
    });

    it('recordCacheUsage handles normalized adapter fields', () => {
      recordCacheUsage({
        cache_read_input_tokens: 44,
        cache_creation_input_tokens: 6,
        input_tokens: 50,
      });

      expect(globalCacheStats.hit).toBe(44);
      expect(globalCacheStats.miss).toBe(6);
    });

    it('recordCacheUsage handles invalid usage without changing counters', () => {
      recordCacheUsage(null);
      recordCacheUsage(undefined);
      recordCacheUsage('invalid');
      recordCacheUsage(123);

      expect(globalCacheStats.hit).toBe(0);
      expect(globalCacheStats.miss).toBe(0);
    });
  });

  describe('self-tuning hook', () => {
    it('getParams returns the expected shape', () => {
      const params = cacheTuningHook.getParams();

      expect(params).toHaveProperty('currentRatio');
      expect(params).toHaveProperty('hit');
      expect(params).toHaveProperty('miss');
      expect(typeof params.currentRatio).toBe('number');
      expect(typeof params.hit).toBe('number');
      expect(typeof params.miss).toBe('number');
    });

    it('proposeNext suggests prefix tuning only for low hit rates', () => {
      expect(cacheTuningHook.proposeNext({ ratio: 0.2 })).toEqual({
        action: 'rotate_prefix_order',
      });
      expect(cacheTuningHook.proposeNext({ ratio: 0.5 })).toBeNull();
    });

    it('hasConverged checks the last three samples', () => {
      expect(cacheTuningHook.hasConverged([{ ratio: 0.45 }, { ratio: 0.46 }, { ratio: 0.44 }])).toBe(true);
      expect(cacheTuningHook.hasConverged([{ ratio: 0.3 }, { ratio: 0.7 }, { ratio: 0.5 }])).toBe(false);
      expect(cacheTuningHook.hasConverged([{ ratio: 0.5 }, { ratio: 0.51 }])).toBe(false);
    });
  });
});
