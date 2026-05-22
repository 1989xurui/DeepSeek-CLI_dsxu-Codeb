/**
 * R5-21 TDD Gate main entry.
 */

import type { TDDContext, TDDGateConfig, TDDGateResult } from './contract';
import { generateTestSpec } from './generator';
import { runRedPhase, runGreenPhase } from './runner';

/**
 * Full TDD gate: generateTestSpec -> runRedPhase -> runGreenPhase.
 */
export async function tddGate(
  context: TDDContext,
  config?: Partial<TDDGateConfig>,
): Promise<TDDGateResult> {
  const startTime = Date.now();

  try {
    // 1. Generate a test specification.
    const testSpec = await generateTestSpec(context, config);

    // 2. Red phase.
    const redResult = await runRedPhase(testSpec, config);

    if (!redResult.success) {
      return {
        passed: false,
        redPhase: redResult,
        durationMs: Date.now() - startTime,
        error: redResult.error || 'Red phase failed',
      };
    }

    // 3. Green phase.
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
