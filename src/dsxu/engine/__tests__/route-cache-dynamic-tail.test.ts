import { describe, expect, test } from 'bun:test'
import { buildV18RouteCacheDynamicTailEvidence } from '../route-cache-dynamic-tail'

function line(record: Record<string, unknown>): string {
  return JSON.stringify(record)
}

describe('V18 route cache dynamic tail evidence', () => {
  test('marks stable traces done when hashes are stable and cache miss stays under budget', () => {
    const evidence = buildV18RouteCacheDynamicTailEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      traces: [
        {
          path: 'stable.route.jsonl',
          text: [
            line({
              event: 'prompt_prefix_cache_evidence',
              routeReason: 'coding_flash_non_thinking',
              model: 'deepseek-v4-flash',
              stablePrefixHash: 'stable-a',
              dynamicTailHash: 'tail-a',
              dynamicTailApproxTokens: 500,
              cacheMissBudgetTokens: 8_000,
              volatileFindingCount: 0,
            }),
            line({
              event: 'request_plan',
              modelName: 'deepseek-v4-flash',
              systemPromptSummary: { normalizedHash: 'system-a' },
            }),
            line({
              event: 'response_usage',
              routeReason: 'coding_flash_non_thinking',
              modelName: 'deepseek-v4-flash',
              inputTokens: 10_000,
              outputTokens: 100,
              cacheHitInputTokens: 9_000,
              cacheMissInputTokens: 1_000,
            }),
          ].join('\n'),
        },
      ],
    })

    expect(evidence.ok).toBe(true)
    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.cases[0]?.cacheHitRatePct).toBe(90)
    expect(evidence.cases[0]?.warmResponseCount).toBe(0)
    expect(evidence.cases[0]?.status).toBe('CACHE_STABLE')
  })

  test('surfaces dynamic cache risks without leaking prompt text', () => {
    const evidence = buildV18RouteCacheDynamicTailEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      traces: [
        {
          path: 'risk.route.jsonl',
          text: [
            line({
              event: 'prompt_prefix_cache_evidence',
              routeReason: 'failed_verification_pro_thinking_max',
              model: 'deepseek-v4-pro',
              stablePrefixHash: 'stable-a',
              dynamicTailHash: 'tail-a',
              dynamicTailApproxTokens: 5_000,
              cacheMissBudgetTokens: 10_000,
              volatileFindingCount: 0,
            }),
            line({
              event: 'request_plan',
              modelName: 'deepseek-v4-pro',
              systemPromptSummary: { normalizedHash: 'system-a' },
            }),
            line({
              event: 'request_plan',
              modelName: 'deepseek-v4-pro',
              systemPromptSummary: { normalizedHash: 'system-b' },
            }),
            line({
              event: 'response_usage',
              routeReason: 'failed_verification_pro_thinking_max',
              modelName: 'deepseek-v4-pro',
              inputTokens: 20_000,
              outputTokens: 200,
              cacheHitInputTokens: 6_000,
              cacheMissInputTokens: 14_000,
            }),
            line({
              event: 'response_usage',
              routeReason: 'failed_verification_pro_thinking_max',
              modelName: 'deepseek-v4-pro',
              inputTokens: 20_000,
              outputTokens: 200,
              cacheHitInputTokens: 7_000,
              cacheMissInputTokens: 13_000,
            }),
          ].join('\n'),
        },
      ],
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('PARTIAL_CACHE_RISK')
    expect(evidence.cases[0]?.risks).toContain(
      'DeepSeek normalized system hash changed more often than model changes',
    )
    expect(evidence.cases[0]?.risks).toContain(
      'warm cache miss input exceeded route cache miss budget',
    )
    expect(evidence.cases[0]?.risks).toContain(
      'sub-80 warm cache hit rate after cold start',
    )
    expect(evidence.recommendations.join('\n')).toContain('trace/final usage reports')
    expect(JSON.stringify(evidence)).not.toContain('prompt text')
  })

  test('summarizes runtime cache break events as dry-run-only recovery evidence', () => {
    const evidence = buildV18RouteCacheDynamicTailEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      traces: [
        {
          path: 'cache-break.route.jsonl',
          text: [
            line({
              event: 'prompt_prefix_cache_evidence',
              routeReason: 'coding_flash_non_thinking',
              model: 'deepseek-v4-flash',
              stablePrefixHash: 'stable-a',
              dynamicTailHash: 'tail-a',
              dynamicTailApproxTokens: 500,
              cacheMissBudgetTokens: 8_000,
              volatileFindingCount: 0,
            }),
            line({
              event: 'request_plan',
              modelName: 'deepseek-v4-flash',
              systemPromptSummary: { normalizedHash: 'system-a' },
            }),
            line({
              event: 'response_usage',
              routeReason: 'coding_flash_non_thinking',
              modelName: 'deepseek-v4-flash',
              inputTokens: 12_000,
              outputTokens: 120,
              cacheHitInputTokens: 9_000,
              cacheMissInputTokens: 3_000,
            }),
            line({
              event: 'cache_break',
              reason: 'model changed (deepseek-chat -> deepseek-reasoner)',
              tokenDrop: 6_000,
              warmupRecommendation: {
                mode: 'dry-run-only',
                command: 'bun run cache:reality-run --model deepseek-reasoner',
                claimBoundary: 'recommendation only; no provider call and no cache-hit improvement claim',
              },
            }),
          ].join('\n'),
        },
      ],
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.cases[0]?.cacheBreakCount).toBe(1)
    expect(evidence.cases[0]?.cacheBreakTokenDrop).toBe(6_000)
    expect(evidence.cases[0]?.cacheBreakReasons).toContain(
      'model changed (deepseek-chat -> deepseek-reasoner)',
    )
    expect(evidence.cases[0]?.cacheBreakWarmupCommands).toEqual([
      'bun run cache:reality-run --model deepseek-reasoner',
    ])
    expect(evidence.cases[0]?.risks).toContain('runtime cache break event detected')
    expect(evidence.cases[0]?.risks).not.toContain('cache break warmup recommendation is not dry-run-only')
    expect(evidence.recommendations.join('\n')).toContain('hash-only cache:reality-run dry-run')
  })
})
