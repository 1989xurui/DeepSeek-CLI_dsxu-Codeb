import { describe, expect, test } from 'bun:test';
import { collectCacheLiveAb } from '../cache-live-ab';

const LONG_PREFIX = [
  'DSXU stable cache prefix for live A/B.',
  'System rules, tool schema freeze, permission policy, model routing policy, semantic tool layer, and output contract stay stable.',
  'This text is intentionally long enough to avoid meaningless tiny-prefix cache probes.',
  'Repeat stable content for deterministic mock testing.',
  'System rules, tool schema freeze, permission policy, model routing policy, semantic tool layer, and output contract stay stable.',
  'System rules, tool schema freeze, permission policy, model routing policy, semantic tool layer, and output contract stay stable.',
  'System rules, tool schema freeze, permission policy, model routing policy, semantic tool layer, and output contract stay stable.',
  'System rules, tool schema freeze, permission policy, model routing policy, semantic tool layer, and output contract stay stable.',
].join('\n');

describe('cache live A/B evidence', () => {
  test('dry-run records only hash/token metadata and never calls provider', async () => {
    let fetchCalls = 0;
    const report = await collectCacheLiveAb({
      prefix: LONG_PREFIX,
      model: 'deepseek-v4-flash',
      executeLive: false,
      fetchImpl: (async () => {
        fetchCalls += 1;
        throw new Error('should not fetch');
      }) as typeof fetch,
    });

    expect(fetchCalls).toBe(0);
    expect(report).toMatchObject({
      schemaVersion: 'dsxu.cache-live-ab.v1',
      status: 'DRY_RUN_CACHE_LIVE_AB',
      mode: 'dry-run',
      didCallProvider: false,
      publicClaimAllowed: false,
      observations: [],
    });
    expect(report.prefixHash).toHaveLength(16);
    expect(JSON.stringify(report)).not.toContain(LONG_PREFIX.slice(0, 60));
    expect(report.claimBoundary).toContain('no provider call');
    expect(report.claimBoundary).toContain('no cache-hit improvement claim');
  });

  test('blocks tiny prefixes because they cannot prove meaningful cache behavior', async () => {
    const report = await collectCacheLiveAb({
      prefix: 'too short',
      model: 'deepseek-v4-flash',
      executeLive: true,
      apiKey: 'test-key',
      fetchImpl: (async () => {
        throw new Error('should not fetch');
      }) as typeof fetch,
    });

    expect(report.status).toBe('BLOCKED_CACHE_LIVE_AB');
    expect(report.didCallProvider).toBe(false);
    expect(report.blockers[0]).toContain('stable prefix approx tokens');
  });

  test('blocks live execution without an API key', async () => {
    const originalApiKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    let report;
    try {
      report = await collectCacheLiveAb({
        prefix: LONG_PREFIX,
        model: 'deepseek-v4-flash',
        executeLive: true,
        apiKey: '',
        fetchImpl: (async () => {
          throw new Error('should not fetch');
        }) as typeof fetch,
      });
    } finally {
      if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = originalApiKey;
    }

    expect(report.status).toBe('BLOCKED_CACHE_LIVE_AB');
    expect(report.didCallProvider).toBe(false);
    expect(report.blockers).toContain('DEEPSEEK_API_KEY is not set');
  });

  test('passes live A/B when repeated stable prefix improves cache hit rate', async () => {
    const bodies: any[] = [];
    const usages = [
      { prompt_tokens: 1000, completion_tokens: 2, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 1000 },
      { prompt_tokens: 1000, completion_tokens: 2, prompt_cache_hit_tokens: 800, prompt_cache_miss_tokens: 200 },
    ];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      const usage = usages[Math.min(bodies.length - 1, usages.length - 1)];
      return new Response(JSON.stringify({
        model: 'deepseek-v4-flash',
        choices: [{ message: { role: 'assistant', content: 'OK' } }],
        usage,
      }), { status: 200 });
    }) as typeof fetch;

    const report = await collectCacheLiveAb({
      prefix: LONG_PREFIX,
      model: 'deepseek-v4-flash',
      executeLive: true,
      apiKey: 'test-key',
      rounds: 2,
      fetchImpl,
    });

    expect(report.status).toBe('PASS_CACHE_LIVE_AB');
    expect(report.didCallProvider).toBe(true);
    expect(report.observations).toHaveLength(2);
    expect(report.firstHitRatePct).toBe(0);
    expect(report.lastHitRatePct).toBe(80);
    expect(report.hitRateDeltaPct).toBe(80);
    expect(report.blockers).toEqual([]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].messages[0]).toMatchObject({ role: 'system', content: LONG_PREFIX });
  });

  test('returns partial live evidence when provider succeeds but cache does not improve', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      model: 'deepseek-v4-flash',
      choices: [{ message: { role: 'assistant', content: 'OK' } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 2,
        prompt_cache_hit_tokens: 0,
        prompt_cache_miss_tokens: 1000,
      },
    }), { status: 200 })) as typeof fetch;

    const report = await collectCacheLiveAb({
      prefix: LONG_PREFIX,
      model: 'deepseek-v4-flash',
      executeLive: true,
      apiKey: 'test-key',
      rounds: 2,
      fetchImpl,
    });

    expect(report.status).toBe('PARTIAL_CACHE_LIVE_AB');
    expect(report.didCallProvider).toBe(true);
    expect(report.blockers[0]).toContain('cache hit rate did not improve');
  });
});
