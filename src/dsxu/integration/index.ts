/**
 * DSxu 模块集成层
 *
 * 将 M1-M5 各模块连接起来。每个 wire*() 创建一个模块间的连接，
 * wireAll() 一次性构建完整的运行时上下文。
 *
 * 设计原则：
 * - 每个模块独立可用（mock 模式）
 * - 集成层只负责 "连线"，不引入新逻辑
 * - 所有真实依赖通过 config 注入，方便测试
 */

import { VectorStore } from '../../services/embedding/store';
import { ExperienceStore } from '../../services/experience/store';
import { search } from '../../utils/search';
import { createAllAdapters, type McpAdapterConfig } from '../../services/mcp/adapters';
import { runMutationTests } from '../../services/mutation';
import { suggestProperties, runPbt } from '../../services/pbt';
import type { VectorStoreConfig } from '../../services/embedding/contract';
import type { ExperienceStoreConfig } from '../../services/experience/types';

// ── Runtime context ──
export interface DsxuRuntime {
  vectorStore: VectorStore;
  experienceStore: ExperienceStore;
  search: typeof search;
  mcpAdapters: ReturnType<typeof createAllAdapters>;
  mutation: typeof runMutationTests;
  pbt: { suggest: typeof suggestProperties; run: typeof runPbt };
}

export interface DsxuRuntimeConfig {
  vectorStore?: VectorStoreConfig;
  experience?: ExperienceStoreConfig;
  mcp?: McpAdapterConfig;
}

/**
 * 一次性构建完整的 DSxu 运行时上下文
 */
export function createRuntime(config?: DsxuRuntimeConfig): DsxuRuntime {
  const vectorStore = new VectorStore(config?.vectorStore);
  const experienceStore = new ExperienceStore(config?.experience);
  const mcpAdapters = createAllAdapters(config?.mcp);

  return {
    vectorStore,
    experienceStore,
    search,
    mcpAdapters,
    mutation: runMutationTests,
    pbt: { suggest: suggestProperties, run: runPbt },
  };
}

/**
 * R5-25 → R5-01+: 向量搜索为三级搜索提供语义降级
 */
export function wireVectorSearch(vectorStore: VectorStore) {
  return {
    semanticSearch: async (query: string, topK = 10) => {
      return vectorStore.search({ query, topK });
    },
  };
}

/**
 * R5-26 → R5-17 prompt 注入: ExperienceStore 为 prompt 构建提供经验上下文
 * 注意：调用前需确保 experienceStore.init() 已调用
 */
export function wireExperienceToPrompt(experienceStore: ExperienceStore) {
  return {
    getExperienceContext: async (taskDescription: string, topK = 5) => {
      const records = await experienceStore.retrieve(taskDescription, topK);
      if (!records.length) return '';
      return [
        '<experience_context>',
        ...records.map((r, i) => `[${i + 1}] ${r.task} → ${r.outcome} (helpfulness: ${r.helpfulness})`),
        '</experience_context>',
      ].join('\n');
    },
  };
}

/**
 * R5-24 → R5-21 static-analysis: mutation testing 增强静态分析覆盖度量
 */
export function wireMutationToAnalysis() {
  return {
    getMutationCoverage: async (source: string, testRunner: (src: string) => Promise<boolean>) => {
      const r = await runMutationTests(source, 'inline.ts', undefined, {
        mockTestRunner: async (_file, _mut) => ({ passed: await testRunner(source), output: '' }),
      });
      return { killRate: r.killRate, totalMutations: r.total };
    },
  };
}

/**
 * R5-30 → R5-24: PBT 建议增强 mutation testing
 */
export function wirePbtToMutation() {
  return {
    suggestAndRun: async (source: string) => {
      const suggestions = await suggestProperties({ sources: [{ path: 'inline.ts', content: source }] });
      const pbtResults = await runPbt({ suggestions });
      return { suggestions: suggestions.length, results: pbtResults };
    },
  };
}
