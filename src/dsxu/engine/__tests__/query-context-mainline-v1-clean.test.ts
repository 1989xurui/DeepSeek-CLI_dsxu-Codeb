import { describe, expect, test } from 'bun:test';
import { analyzeContext, buildSideQuestionFallbackParams, fetchSystemPromptParts } from '../query-context-builder-v1';
import { calculateContextPercentages, getCompactionStrategy, getContextWindowForModel, shouldTriggerAutoCompact } from '../context-window-manager-v1';
import { consumeContextSignalInQueryLoop, createQueryLoopContextState } from '../query-loop';
import { createContextQueryRuntimePorts } from '../runtime-core';

describe('query-context-mainline-v1-clean', () => {
  test('queryContext/context/analyzeContext core chain is runtime-expressible', () => {
    const parts = fetchSystemPromptParts({
      defaultSystemPrompt: ['base'],
      userContext: { role: 'developer' },
      systemContext: { mode: 'coordinator' },
    });
    expect(parts.systemContext.mode).toBe('coordinator');

    const fallback = buildSideQuestionFallbackParams({
      defaultSystemPrompt: ['base'],
      userContext: { role: 'developer' },
      systemContext: { mode: 'coordinator' },
      forkContextMessages: [{ role: 'user', content: 'question' }],
    });
    expect(fallback.systemPrompt.length).toBeGreaterThan(0);

    const analysis = analyzeContext({
      messages: [{ role: 'user', content: 'analyze this context deeply please' }],
      rawMaxTokens: 10000,
    });
    expect(analysis.totalTokens).toBeGreaterThan(0);
  });

  test('mainline consumes context signals and affects next behavior', () => {
    const window = getContextWindowForModel('dsxu-sonnet-4-6');
    expect(window).toBeGreaterThan(0);

    const pct = calculateContextPercentages(
      { input_tokens: 7000, cache_creation_input_tokens: 500, cache_read_input_tokens: 500 },
      10000,
    );
    const shouldCompact = shouldTriggerAutoCompact({ usedPercent: pct.used ?? 0, autoCompactEnabled: true, threshold: 70 });
    const strategy = getCompactionStrategy({ usedPercent: pct.used ?? 0 });

    let state = createQueryLoopContextState('dsxu-sonnet-4-6');
    state = consumeContextSignalInQueryLoop(state, {
      usedPercent: pct.used ?? 0,
      shouldCompact,
      strategy: strategy.strategy,
    });

    expect(state.autoCompactTriggered).toBeTrue();
    expect(state.compactionStrategy).not.toBe('none');

    const ports = createContextQueryRuntimePorts();
    expect(typeof ports.consumeQueryLoopContext).toBe('function');
    expect(typeof ports.consumeGearContext).toBe('function');
    expect(typeof ports.consumeSessionContext).toBe('function');
  });
});
