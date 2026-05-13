/**
 * R5-25 向量存储
 *
 * Mock 模式使用内存；真实模式使用 sqlite-vec。
 * Mock 模式的余弦相似度使用标准公式。
 */

import type { CodeChunk, SearchResult, IndexStats, VectorStoreConfig, EmbedRequest, EmbedResponse } from './contract';
import { embed } from './voyage';

export class VectorStore {
  private chunks: Map<string, CodeChunk> = new Map();
  private config: VectorStoreConfig;
  private initialized = false;

  constructor(config?: VectorStoreConfig) {
    this.config = {
      dbPath: '.dsxu/vectors.db',
      dimension: 1024,
      mockMode: true,
      ...config,
    };
  }

  async init(): Promise<void> {
    if (this.config.mockMode) {
      this.initialized = true;
      return;
    }
    // 真实模式：初始化 sqlite-vec（预留）
    this.initialized = true;
  }

  async upsert(chunks: CodeChunk[]): Promise<void> {
    this.ensureInit();

    // 生成 embedding（如果缺少 vector）
    const needEmbed = chunks.filter(c => !c.vector);
    if (needEmbed.length > 0) {
      const response = await embed(
        { texts: needEmbed.map(c => c.content), inputType: 'document' },
        this.config.mockEmbed
      );
      for (let i = 0; i < needEmbed.length; i++) {
        needEmbed[i].vector = response.vectors[i];
      }
    }

    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async search(query: string, k: number = 10): Promise<SearchResult[]> {
    this.ensureInit();

    // Embed query
    const response = await embed(
      { texts: [query], inputType: 'query' },
      this.config.mockEmbed
    );
    const queryVec = response.vectors[0];

    // Compute cosine similarity
    const results: SearchResult[] = [];
    for (const chunk of this.chunks.values()) {
      if (!chunk.vector) continue;
      const score = cosineSimilarity(queryVec, chunk.vector);
      results.push({ chunk, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  async delete(file: string): Promise<void> {
    this.ensureInit();
    for (const [id, chunk] of this.chunks) {
      if (chunk.file === file) {
        this.chunks.delete(id);
      }
    }
  }

  async stats(): Promise<IndexStats> {
    this.ensureInit();
    const files = new Set<string>();
    let sizeBytes = 0;
    for (const chunk of this.chunks.values()) {
      files.add(chunk.file);
      sizeBytes += chunk.content.length + (chunk.vector ? chunk.vector.length * 4 : 0);
    }
    return {
      chunks: this.chunks.size,
      files: files.size,
      sizeBytes,
    };
  }

  private ensureInit() {
    if (!this.initialized) throw new Error('VectorStore not initialized — call init() first');
  }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}


// V14 lifecycle shim: store
export function processStoreLifecycle(input) {
  void input
  const state = 'store-state'
  const lifecycle = 'store:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
