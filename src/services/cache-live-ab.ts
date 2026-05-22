import { createHash } from 'crypto';
import { DeepSeekAdapter } from './api/deepseek-adapter.js';

export type CacheLiveAbStatus =
  | 'DRY_RUN_CACHE_LIVE_AB'
  | 'BLOCKED_CACHE_LIVE_AB'
  | 'PASS_CACHE_LIVE_AB'
  | 'PARTIAL_CACHE_LIVE_AB'

export interface CacheLiveAbObservation {
  round: number;
  responseOk: boolean;
  status: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitInputTokens: number;
  cacheMissInputTokens: number;
  cacheHitRatePct: number;
  error?: string;
}

export interface CacheLiveAbReport {
  schemaVersion: 'dsxu.cache-live-ab.v1';
  owner: 'DeepSeek route/cost/cache';
  generatedAt: string;
  status: CacheLiveAbStatus;
  mode: 'dry-run' | 'live';
  didCallProvider: boolean;
  publicClaimAllowed: false;
  claimBoundary: string;
  model: string;
  baseUrl: string;
  prefixHash: string | null;
  prefixChars: number;
  prefixApproxTokens: number;
  roundsRequested: number;
  observations: CacheLiveAbObservation[];
  firstHitRatePct: number;
  lastHitRatePct: number;
  hitRateDeltaPct: number;
  blockers: string[];
}

export interface CollectCacheLiveAbInput {
  prefix: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  executeLive?: boolean;
  rounds?: number;
  timeoutMs?: number;
  minimumPrefixApproxTokens?: number;
  fetchImpl?: typeof fetch;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function pct(hit: number, miss: number, inputTokens: number): number {
  const denominator = hit + miss > 0 ? hit + miss : inputTokens;
  return denominator > 0 ? Math.round((hit / denominator) * 1000) / 10 : 0;
}

function buildReport(input: {
  status: CacheLiveAbStatus;
  mode: 'dry-run' | 'live';
  didCallProvider: boolean;
  claimBoundary: string;
  model: string;
  baseUrl: string;
  prefix: string;
  roundsRequested: number;
  observations?: CacheLiveAbObservation[];
  blockers?: string[];
}): CacheLiveAbReport {
  const observations = input.observations ?? [];
  const firstHitRatePct = observations[0]?.cacheHitRatePct ?? 0;
  const lastHitRatePct = observations.at(-1)?.cacheHitRatePct ?? 0;
  return {
    schemaVersion: 'dsxu.cache-live-ab.v1',
    owner: 'DeepSeek route/cost/cache',
    generatedAt: new Date().toISOString(),
    status: input.status,
    mode: input.mode,
    didCallProvider: input.didCallProvider,
    publicClaimAllowed: false,
    claimBoundary: input.claimBoundary,
    model: input.model,
    baseUrl: input.baseUrl,
    prefixHash: input.prefix ? sha256(input.prefix).slice(0, 16) : null,
    prefixChars: input.prefix.length,
    prefixApproxTokens: approxTokens(input.prefix),
    roundsRequested: input.roundsRequested,
    observations,
    firstHitRatePct,
    lastHitRatePct,
    hitRateDeltaPct: Math.round((lastHitRatePct - firstHitRatePct) * 10) / 10,
    blockers: input.blockers ?? [],
  };
}

export async function collectCacheLiveAb(
  input: CollectCacheLiveAbInput,
): Promise<CacheLiveAbReport> {
  const prefix = input.prefix.trim();
  const baseUrl = (input.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '');
  const rounds = Math.max(2, Math.min(5, input.rounds ?? 2));
  const minimumPrefixApproxTokens = input.minimumPrefixApproxTokens ?? 128;
  const prefixApproxTokens = approxTokens(prefix);

  if (!prefix) {
    return buildReport({
      status: 'BLOCKED_CACHE_LIVE_AB',
      mode: input.executeLive ? 'live' : 'dry-run',
      didCallProvider: false,
      claimBoundary: 'cache live A/B blocked; stable prefix is empty, no provider call, no cache-hit improvement claim',
      model: input.model,
      baseUrl,
      prefix,
      roundsRequested: rounds,
      blockers: ['stable prefix is empty'],
    });
  }

  if (prefixApproxTokens < minimumPrefixApproxTokens) {
    return buildReport({
      status: 'BLOCKED_CACHE_LIVE_AB',
      mode: input.executeLive ? 'live' : 'dry-run',
      didCallProvider: false,
      claimBoundary:
        'cache live A/B blocked; stable prefix is too small for meaningful cache evidence, no provider call, no cache-hit improvement claim',
      model: input.model,
      baseUrl,
      prefix,
      roundsRequested: rounds,
      blockers: [
        `stable prefix approx tokens ${prefixApproxTokens} < minimum ${minimumPrefixApproxTokens}`,
      ],
    });
  }

  if (!input.executeLive) {
    return buildReport({
      status: 'DRY_RUN_CACHE_LIVE_AB',
      mode: 'dry-run',
      didCallProvider: false,
      claimBoundary: 'cache live A/B dry-run only; stable prefix hash recorded, no provider call, no cache-hit improvement claim',
      model: input.model,
      baseUrl,
      prefix,
      roundsRequested: rounds,
    });
  }

  const apiKey = input.apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return buildReport({
      status: 'BLOCKED_CACHE_LIVE_AB',
      mode: 'live',
      didCallProvider: false,
      claimBoundary: 'cache live A/B blocked; DEEPSEEK_API_KEY is not set, no provider call, no cache-hit improvement claim',
      model: input.model,
      baseUrl,
      prefix,
      roundsRequested: rounds,
      blockers: ['DEEPSEEK_API_KEY is not set'],
    });
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const observations: CacheLiveAbObservation[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000);
    timeout.unref?.();
    try {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: input.model,
          stream: false,
          temperature: 0,
          max_tokens: 8,
          thinking: { type: 'disabled' },
          messages: [
            { role: 'system', content: prefix },
            {
              role: 'user',
              content: `DSXU cache live A/B round ${round}. Reply exactly: OK`,
            },
          ],
        }),
      });
      const raw = await response.text();
      let parsed: any = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = {};
      }
      const usage = DeepSeekAdapter.normalizeUsage(parsed);
      observations.push({
        round,
        responseOk: response.ok,
        status: response.status,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheHitInputTokens: usage.cache_read_input_tokens,
        cacheMissInputTokens: usage.cache_creation_input_tokens,
        cacheHitRatePct: pct(
          usage.cache_read_input_tokens,
          usage.cache_creation_input_tokens,
          usage.input_tokens,
        ),
        ...(response.ok ? {} : { error: raw.slice(0, 300) }),
      });
    } catch (error) {
      observations.push({
        round,
        responseOk: false,
        status: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 0,
        cacheHitRatePct: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  const failed = observations.filter(observation => !observation.responseOk);
  const first = observations[0]?.cacheHitRatePct ?? 0;
  const last = observations.at(-1)?.cacheHitRatePct ?? 0;
  const improved = last > first;
  const blockers = [
    ...failed.map(observation => `round ${observation.round} failed: ${observation.error ?? observation.status}`),
    !improved ? `cache hit rate did not improve: first=${first} last=${last}` : '',
  ].filter(Boolean);

  return buildReport({
    status: blockers.length === 0 ? 'PASS_CACHE_LIVE_AB' : 'PARTIAL_CACHE_LIVE_AB',
    mode: 'live',
    didCallProvider: true,
    claimBoundary:
      'live cache A/B evidence for one repeated stable prefix only; supports internal tuning, not public model-quality or benchmark claims',
    model: input.model,
    baseUrl,
    prefix,
    roundsRequested: rounds,
    observations,
    blockers,
  });
}
