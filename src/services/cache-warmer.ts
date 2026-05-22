import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../constants/prompts.js';

export interface CacheWarmConfig {
  prefixes?: string[];
  systemPromptSections?: readonly string[];
  model: string;
  concurrency: number;
  dryRun?: boolean;
  allowPlaceholderPrefixes?: boolean;
}

export interface CacheWarmResult {
  owner: 'DeepSeek route/cost/cache';
  mode: 'planning' | 'execute';
  claimBoundary: string;
  warmedKeys: number;
  failedKeys: number;
  estimatedSavingsUsd: number;
  durationMs: number;
  dryRun: boolean;
  warmedPrefixes: string[];
  failedPrefixes: Array<{ prefix: string; error: string }>;
}

export type CacheWarmProbe = (prefix: string, model: string) => Promise<void>;

export interface CacheWarmPrefixExport {
  owner: 'DeepSeek route/cost/cache';
  schemaVersion: 'dsxu.cache-warm-prefix-export.v1';
  model: string;
  claimBoundary: string;
  boundaryFound: boolean;
  stableBlockCount: number;
  dynamicBlockCount: number;
  stablePrefixChars: number;
  stablePrefixApproxTokens: number;
  dynamicTailChars: number;
  dynamicTailApproxTokens: number;
  prefixes: string[];
}

const LEGACY_PLACEHOLDER_PREFIXES = [
  'DSXU code editing system prompt',
  'DSXU plan-execute-verify coordinator prompt',
  'DSXU static analysis and TDD verification prompt',
  'DSXU public challenge source capsule prompt',
  'DSXU release claim evidence binder prompt',
];

export class CacheWarmer {
  constructor(private readonly probe?: CacheWarmProbe) {}

  async warm(config: CacheWarmConfig): Promise<CacheWarmResult> {
    const startTime = Date.now();
    const prefixes = unique(resolveWarmPrefixes(config));
    const concurrency = Math.max(1, config.concurrency || 1);
    const dryRun = config.dryRun ?? true;
    const warmedPrefixes: string[] = [];
    const failedPrefixes: Array<{ prefix: string; error: string }> = [];

    for (let index = 0; index < prefixes.length; index += concurrency) {
      const chunk = prefixes.slice(index, index + concurrency);
      await Promise.all(
        chunk.map(async prefix => {
          try {
            if (!dryRun) {
              if (!this.probe) {
                throw new Error('cache warm probe is not configured');
              }
              await this.probe(prefix, config.model);
            }
            warmedPrefixes.push(prefix);
          } catch (error) {
            failedPrefixes.push({
              prefix,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );
    }

    return {
      owner: 'DeepSeek route/cost/cache',
      mode: dryRun ? 'planning' : 'execute',
      claimBoundary:
        buildClaimBoundary({ dryRun, prefixCount: prefixes.length }),
      warmedKeys: warmedPrefixes.length,
      failedKeys: failedPrefixes.length,
      estimatedSavingsUsd: dryRun ? 0 : estimateSavings(warmedPrefixes.length),
      durationMs: Date.now() - startTime,
      dryRun,
      warmedPrefixes,
      failedPrefixes,
    };
  }
}

export function defaultCacheWarmPrefixes(): string[] {
  return [];
}

export function placeholderCacheWarmPrefixes(): string[] {
  return [...LEGACY_PLACEHOLDER_PREFIXES];
}

export function cacheWarmPrefixesFromSystemPrompt(
  sections: readonly string[],
): string[] {
  const boundaryIndex = sections.findIndex(section => section === SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
  const stableSections = boundaryIndex >= 0 ? sections.slice(0, boundaryIndex) : [];
  const stablePrefix = stableSections
    .map(section => section.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return stablePrefix ? [stablePrefix] : [];
}

export function buildCacheWarmPrefixExport(input: {
  model: string;
  systemPromptSections: readonly string[];
}): CacheWarmPrefixExport {
  const boundaryIndex = input.systemPromptSections.findIndex(section => section === SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
  const boundaryFound = boundaryIndex >= 0;
  const stableSections = boundaryFound
    ? input.systemPromptSections.slice(0, boundaryIndex)
    : [];
  const dynamicSections = boundaryFound
    ? input.systemPromptSections.slice(boundaryIndex + 1)
    : input.systemPromptSections;
  const prefixes = cacheWarmPrefixesFromSystemPrompt(input.systemPromptSections);
  const stablePrefix = prefixes[0] ?? '';
  const dynamicTail = dynamicSections.map(section => section.trim()).filter(Boolean).join('\n\n');

  return {
    owner: 'DeepSeek route/cost/cache',
    schemaVersion: 'dsxu.cache-warm-prefix-export.v1',
    model: input.model,
    claimBoundary: boundaryFound
      ? 'stable prefix export only; cache-hit improvement claim requires before/after provider trajectory'
      : 'stable prefix export blocked; SYSTEM_PROMPT_DYNAMIC_BOUNDARY missing, no cache-hit improvement claim',
    boundaryFound,
    stableBlockCount: stableSections.filter(Boolean).length,
    dynamicBlockCount: dynamicSections.filter(Boolean).length,
    stablePrefixChars: stablePrefix.length,
    stablePrefixApproxTokens: approxTokens(stablePrefix),
    dynamicTailChars: dynamicTail.length,
    dynamicTailApproxTokens: approxTokens(dynamicTail),
    prefixes,
  };
}

function resolveWarmPrefixes(config: CacheWarmConfig): string[] {
  if (config.prefixes?.length) return config.prefixes;
  if (config.systemPromptSections?.length) {
    return cacheWarmPrefixesFromSystemPrompt(config.systemPromptSections);
  }
  return config.allowPlaceholderPrefixes ? LEGACY_PLACEHOLDER_PREFIXES : [];
}

function buildClaimBoundary(input: {
  dryRun: boolean;
  prefixCount: number;
}): string {
  if (input.prefixCount === 0) {
    return input.dryRun
      ? 'cache warm planning only; no runtime stable prefix was provided, no provider call, no cache-hit improvement claim'
      : 'cache warm execution skipped; no runtime stable prefix was provided, no cache-hit improvement claim'
  }

  return input.dryRun
    ? 'cache warm planning only; runtime stable prefix resolved, no provider call, no cache-hit improvement claim'
    : 'cache warm execution evidence; improvement claim requires trajectory before/after evidence'
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function estimateSavings(warmedKeys: number): number {
  return Number((warmedKeys * 0.0008).toFixed(6));
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
