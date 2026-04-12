/**
 * R5-21 红/绿阶段执行器
 */

import type { TestSpec, RedPhaseResult, GreenPhaseResult, TDDGateConfig } from './contract';

/**
 * 红阶段：运行测试，验证它确实失败
 *
 * 测试失败 → success=true（红阶段成功）
 * 测试通过 → success=false（红阶段失败）
 */
export async function runRedPhase(
  testSpec: TestSpec,
  config?: Partial<TDDGateConfig>
): Promise<RedPhaseResult> {
  const runResult = await executeTest(testSpec.filePath, config);

  if (!runResult.passed) {
    // 测试失败了 = 红阶段成功
    return {
      success: true,
      testSpec,
      output: runResult.output,
    };
  } else {
    // 测试通过了 = 红阶段失败（测试写得不对）
    return {
      success: false,
      testSpec,
      output: runResult.output,
      error: 'Test passed in red phase — test should have failed before implementation',
    };
  }
}

/**
 * 绿阶段：运行测试，验证它通过
 *
 * 测试通过 → success=true
 * 测试失败 → success=false
 */
export async function runGreenPhase(
  testSpec: TestSpec,
  config?: Partial<TDDGateConfig>
): Promise<GreenPhaseResult> {
  const runResult = await executeTest(testSpec.filePath, config);

  if (runResult.passed) {
    return {
      success: true,
      output: runResult.output,
    };
  } else {
    return {
      success: false,
      output: runResult.output,
      error: 'Test failed in green phase — implementation is incorrect',
    };
  }
}

/**
 * 执行测试（mock 或真实）
 */
async function executeTest(
  testFilePath: string,
  config?: Partial<TDDGateConfig>
): Promise<{ passed: boolean; output: string }> {
  if (config?.mockTestRunner) {
    return config.mockTestRunner(testFilePath);
  }

  // 真实执行（预留）
  // TODO: 用 execSync 或 Bun.spawn 跑 bun test
  return { passed: false, output: 'Real test runner not implemented yet' };
}
