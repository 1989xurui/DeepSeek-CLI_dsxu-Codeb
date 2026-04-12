/**
 * R5-21 TDD Gate 主函数
 */

import type { TDDContext, TDDGateConfig, TDDGateResult } from './contract';
import { generateTestSpec } from './generator';
import { runRedPhase, runGreenPhase } from './runner';

/**
 * 完整 TDD 门：generateTestSpec → runRedPhase → runGreenPhase
 *
 * 红阶段失败 → 整体失败，不进绿阶段
 * 绿阶段失败 → 整体失败
 * 两阶段都成功 → passed=true
 */
export async function tddGate(
  context: TDDContext,
  config?: Partial<TDDGateConfig>
): Promise<TDDGateResult> {
  const startTime = Date.now();

  try {
    // 1. 生成测试
    const testSpec = await generateTestSpec(context, config);

    // 2. 红阶段
    const redResult = await runRedPhase(testSpec, config);

    if (!redResult.success) {
      // 红阶段失败 → 不进绿阶段
      return {
        passed: false,
        redPhase: redResult,
        durationMs: Date.now() - startTime,
        error: redResult.error || 'Red phase failed',
      };
    }

    // 3. 绿阶段
    const greenResult = await runGreenPhase(testSpec, config);

    return {
      passed: greenResult.success,
      redPhase: redResult,
      greenPhase: greenResult,
      durationMs: Date.now() - startTime,
      error: greenResult.success ? undefined : (greenResult.error || 'Green phase failed'),
    };

  } catch (err) {
    return {
      passed: false,
      redPhase: {
        success: false,
        testSpec: { filePath: '', content: '', targetName: '', testDescriptions: [] },
        error: err instanceof Error ? err.message : String(err),
      },
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
