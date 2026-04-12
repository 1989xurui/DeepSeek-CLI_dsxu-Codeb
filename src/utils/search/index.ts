/**
 * R5-01+ 三级 fallback 搜索 — 主入口
 *
 * 顺序：ast-grep → BM25 → ripgrep
 */

export * from './contract';
export { buildIndex, searchBM25, tokenize } from './bm25';
export { searchAstGrep, isAstGrepPattern } from './ast-grep';

import type { SearchHit, SearchOptions, SearchConfig } from './contract';
import { searchAstGrep, isAstGrepPattern } from './ast-grep';
import { searchBM25 } from './bm25';

/**
 * 统一搜索入口 — 三级 fallback
 *
 * 决策逻辑：
 * 1. query 是 ast 模式 → 直接 ast-grep
 * 2. query 是单 identifier → 优先 ripgrep
 * 3. 否则：ast-grep → 不够 → BM25 → 不够 → ripgrep
 * 4. 合并去重，按 score 排序
 */
export async function search(
  opts: SearchOptions,
  config?: SearchConfig
): Promise<SearchHit[]> {
  const maxResults = opts.maxResults ?? 20;
  const allHits: SearchHit[] = [];

  // 强制指定层级
  if (opts.forcedTier) {
    const hits = await executeTier(opts.forcedTier, opts, config);
    return dedup(hits).slice(0, maxResults);
  }

  // 决策 1: ast-grep 模式
  if (isAstGrepPattern(opts.query)) {
    const hits = await executeTier('ast-grep', opts, config);
    if (hits.length >= 5) return dedup(hits).slice(0, maxResults);
    allHits.push(...hits);
  }

  // 决策 2: 单 identifier → ripgrep 优先
  const isSingleId = /^\w+$/.test(opts.query);
  if (isSingleId) {
    const hits = await executeTier('ripgrep', opts, config);
    allHits.push(...hits);
    return dedup(allHits).slice(0, maxResults);
  }

  // 决策 3: 三级 fallback
  // 3a. ast-grep（如果还没跑过）
  if (allHits.length === 0) {
    const astHits = await executeTier('ast-grep', opts, config);
    allHits.push(...astHits);
    if (allHits.length >= 5) return dedup(allHits).slice(0, maxResults);
  }

  // 3b. BM25
  const bm25Hits = await executeTier('bm25', opts, config);
  allHits.push(...bm25Hits);
  if (allHits.length >= 3 + bm25Hits.length) {
    return dedup(allHits).slice(0, maxResults);
  }

  // 3c. ripgrep
  const rgHits = await executeTier('ripgrep', opts, config);
  allHits.push(...rgHits);

  return dedup(allHits).slice(0, maxResults);
}

async function executeTier(
  tier: SearchHit['tier'],
  opts: SearchOptions,
  config?: SearchConfig
): Promise<SearchHit[]> {
  switch (tier) {
    case 'ast-grep':
      if (config?.mockAstGrep) return config.mockAstGrep(opts.query, opts.language);
      return searchAstGrep(opts.query, opts.language, opts.rootDir);

    case 'bm25':
      if (config?.mockBm25Index) {
        return searchBM25(config.mockBm25Index, opts.query, opts.maxResults);
      }
      // 无索引 → 空
      return [];

    case 'ripgrep':
      if (config?.mockRipgrep) return config.mockRipgrep(opts.query);
      // 真实 ripgrep 调用（预留 — 可复用现有 src/utils/ripgrep.ts）
      return [];

    default:
      return [];
  }
}

/** 去重：同文件同行只保留 score 最高的 */
function dedup(hits: SearchHit[]): SearchHit[] {
  const seen = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = `${hit.file}:${hit.line}`;
    const existing = seen.get(key);
    if (!existing || hit.score > existing.score) {
      seen.set(key, hit);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}
