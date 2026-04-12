/**
 * R5-01+ BM25 纯 TS 实现
 *
 * 含 tokenizer + 倒排索引 + BM25 评分
 */

import type { BM25Index, BM25Document, SearchHit } from './contract';

// BM25 参数
const K1 = 1.2;
const B = 0.75;

/** 简单 tokenizer：按非字母数字切分，转小写 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_$]+/)
    .filter(t => t.length > 1);
}

/** 构建 BM25 索引 */
export function buildIndex(docs: Array<{ file: string; line: number; content: string }>): BM25Index {
  const documents: BM25Document[] = docs.map((d, i) => {
    const tokens = tokenize(d.content);
    return { id: i, file: d.file, line: d.line, content: d.content, tokens, length: tokens.length };
  });

  const invertedIndex = new Map<string, number[]>();
  const df = new Map<string, number>();

  for (const doc of documents) {
    const seen = new Set<string>();
    for (const token of doc.tokens) {
      // 倒排
      if (!invertedIndex.has(token)) invertedIndex.set(token, []);
      invertedIndex.get(token)!.push(doc.id);
      // DF（每文档只算一次）
      if (!seen.has(token)) {
        df.set(token, (df.get(token) ?? 0) + 1);
        seen.add(token);
      }
    }
  }

  const totalLen = documents.reduce((s, d) => s + d.length, 0);

  return {
    documents,
    invertedIndex,
    df,
    avgDl: documents.length > 0 ? totalLen / documents.length : 0,
    N: documents.length,
  };
}

/** BM25 搜索 */
export function searchBM25(
  index: BM25Index,
  query: string,
  maxResults: number = 20
): SearchHit[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || index.N === 0) return [];

  // 收集候选文档
  const candidateIds = new Set<number>();
  for (const token of queryTokens) {
    for (const docId of index.invertedIndex.get(token) ?? []) {
      candidateIds.add(docId);
    }
  }

  // 评分
  const scores: Array<{ docId: number; score: number }> = [];

  for (const docId of candidateIds) {
    const doc = index.documents[docId];
    let score = 0;

    for (const token of queryTokens) {
      const docFreq = index.df.get(token) ?? 0;
      if (docFreq === 0) continue;

      // IDF
      const idf = Math.log((index.N - docFreq + 0.5) / (docFreq + 0.5) + 1);

      // TF in this document
      let tf = 0;
      for (const t of doc.tokens) {
        if (t === token) tf++;
      }

      // BM25 TF component
      const tfNorm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (doc.length / index.avgDl)));

      score += idf * tfNorm;
    }

    if (score > 0) {
      scores.push({ docId, score });
    }
  }

  // 排序取 top-k
  scores.sort((a, b) => b.score - a.score);
  const topK = scores.slice(0, maxResults);

  return topK.map(({ docId, score }) => {
    const doc = index.documents[docId];
    return {
      file: doc.file,
      line: doc.line,
      col: 0,
      context: doc.content,
      score,
      tier: 'bm25' as const,
    };
  });
}
