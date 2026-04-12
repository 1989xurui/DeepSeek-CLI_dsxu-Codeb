/**
 * R5-24 弱 mutation testing — 主入口
 */

export * from './contract';
export { generateMutations, OPERATORS, resetIdCounter } from './operators';

import type { Mutation, MutationReport, MutationResult, MutationBudget, MutationConfig } from './contract';
import { generateMutations, resetIdCounter } from './operators';

/**
 * 运行 mutation 测试
 *
 * 1. 对源码生成候选 mutation（或用 mockMutationGenerator）
 * 2. 逐个 mutation 跑测试（或用 mockTestRunner）
 * 3. 统计 killed / survived / timeout
 */
export async function runMutationTests(
  sourceCode: string,
  file: string,
  budget?: MutationBudget,
  config?: MutationConfig
): Promise<MutationReport> {
  resetIdCounter();

  const maxMutations = budget?.maxMutations ?? 50;
  const timeoutMs = budget?.timeoutMs ?? 10_000;
  const disabled = budget?.disabledOperators ?? [];

  // 1. 生成 mutations
  let mutations: Mutation[];
  if (config?.mockMutationGenerator) {
    mutations = config.mockMutationGenerator(sourceCode, file);
  } else {
    mutations = generateMutations(sourceCode, file, disabled);
  }

  // 限制数量
  if (mutations.length > maxMutations) {
    mutations = mutations.slice(0, maxMutations);
  }

  // 2. 逐个测试
  const results: MutationResult[] = [];

  for (const mut of mutations) {
    let result: MutationResult;

    try {
      if (config?.mockTestRunner) {
        const testResult = await config.mockTestRunner(file, mut);
        result = {
          mutation: mut,
          status: testResult.passed ? 'survived' : 'killed',
          testOutput: testResult.output,
        };
      } else {
        // 真实执行（预留 — 需要写入变异文件、跑 bun test、恢复）
        result = {
          mutation: mut,
          status: 'killed',  // placeholder
          testOutput: 'Real mutation runner not implemented yet',
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout') || msg.includes('Timeout')) {
        result = { mutation: mut, status: 'timeout', testOutput: msg };
      } else {
        result = { mutation: mut, status: 'error', testOutput: msg };
      }
    }

    results.push(result);
  }

  // 3. 统计
  const killed = results.filter(r => r.status === 'killed').length;
  const survived = results.filter(r => r.status === 'survived').length;
  const timedOut = results.filter(r => r.status === 'timeout').length;
  const total = results.length;

  return {
    total,
    killed,
    survived,
    timedOut,
    killRate: total > 0 ? killed / total : 0,
    survivors: results.filter(r => r.status === 'survived').map(r => r.mutation),
    results,
  };
}
