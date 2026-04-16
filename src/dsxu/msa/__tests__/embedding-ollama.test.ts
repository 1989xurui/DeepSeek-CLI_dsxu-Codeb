/**
 * Ollama Embedding 适配器测试
 *
 * 测试策略：
 * - 不依赖真实 Ollama 服务（CI 环境可能没有）
 * - 测试降级逻辑：Ollama 不可用时自动降级为 hash
 * - 测试配置和维度映射
 */

import { describe, it, expect } from 'vitest';
import { createOllamaEmbedFn, getEmbeddingDimension } from '../embedding-ollama';

describe('Ollama Embedding', () => {
  it('should return correct dimensions for known models', () => {
    expect(getEmbeddingDimension('nomic-embed-text')).toBe(768);
    expect(getEmbeddingDimension('jina/jina-embeddings-v2-base-code')).toBe(768);
    expect(getEmbeddingDimension('bge-m3')).toBe(1024);
    expect(getEmbeddingDimension('unknown-model')).toBe(768); // 默认
  });

  it('should gracefully degrade when Ollama is not available', async () => {
    // 连接一个不存在的端口 → 必定失败 → 降级
    const embedFn = createOllamaEmbedFn({
      baseUrl: 'http://localhost:59999', // 不存在的端口
      timeout: 1000,
    });

    const results = await embedFn(['Hello world', 'Test embedding']);

    // 应该返回降级的 hash 向量
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(768); // 默认 nomic 维度
    expect(results[1]).toHaveLength(768);

    // 向量应该是归一化的（L2 norm ≈ 1）
    const norm = Math.sqrt(results[0].reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 1);
  });

  it('should produce different vectors for different texts (even in fallback mode)', async () => {
    const embedFn = createOllamaEmbedFn({
      baseUrl: 'http://localhost:59999',
      timeout: 1000,
    });

    const results = await embedFn([
      'TypeScript function for sorting arrays',
      'Python class for machine learning',
    ]);

    // 不同文本应该产生不同向量
    const isSame = results[0].every((v, i) => Math.abs(v - results[1][i]) < 0.001);
    expect(isSame).toBe(false);
  });

  it('should respect custom model dimension', async () => {
    const embedFn = createOllamaEmbedFn({
      baseUrl: 'http://localhost:59999',
      model: 'bge-m3',
      timeout: 1000,
    });

    const results = await embedFn(['test']);
    expect(results[0]).toHaveLength(1024); // bge-m3 维度
  });

  it('should work with MSA L3 Archive', async () => {
    // 集成测试：确保 embedFn 签名与 L3Archive 兼容
    const { L3Archive } = await import('../l3-archive');

    const embedFn = createOllamaEmbedFn({
      baseUrl: 'http://localhost:59999',
      timeout: 1000,
    });

    const l3 = new L3Archive({
      dbPath: '/tmp/test-ollama-l3.db',
      embedFn,
      embeddingDim: 768,
      minRelevance: 0.0,
    });
    await l3.init();

    // 写入
    const id = await l3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Fixed CORS issue in Express middleware',
      content: 'Added cors() middleware before route handlers',
      quality: 0.8,
      helpfulness: null,
      source: 'test',
    });
    expect(id).not.toBeNull();

    // 检索
    const results = await l3.retrieve('CORS Express');
    expect(results.length).toBeGreaterThan(0);
  });
});
