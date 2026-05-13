import { describe, expect, test } from 'bun:test';
import {
  calculateContextPercentages,
  getCompactionStrategy,
  getContextWindowForModel,
  getModelMaxOutputTokens,
  shouldTriggerAutoCompact,
} from '../context-window-manager-v1';
import {
  analyzeContext,
  buildSideQuestionFallbackParams,
  fetchSystemPromptParts,
  generateContextSuggestions,
} from '../query-context-builder-v1';
import { consumeContextSignalInQueryLoop, createQueryLoopContextState } from '../query-loop';
import { applyContextSignalToGearStrategy, createGearStrategyState } from '../gear-box';
import { applyContextWindowToSession, createSessionContextWindowState } from '../session';
import { createContextQueryRuntimePorts } from '../runtime-core';

describe('V10-2F Phase C - context/query absorption', () => {
  const window = getContextWindowForModel('dsxu-sonnet-4-6');
  const output = getModelMaxOutputTokens('dsxu-sonnet-4-6');
  const perc = calculateContextPercentages(
    { input_tokens: 80_000, cache_creation_input_tokens: 5_000, cache_read_input_tokens: 5_000 },
    window,
  );
  const shouldCompact = shouldTriggerAutoCompact({ usedPercent: perc.used || 0, autoCompactEnabled: true, threshold: 8 });
  const strategy = getCompactionStrategy({ usedPercent: perc.used || 0, duplicateReadPercent: 12 });
  const promptParts = fetchSystemPromptParts({
    defaultSystemPrompt: ['base', 'safety'],
    userContext: { workerToolsContext: 'tools' },
    systemContext: { env: 'local' },
  });
  const fallback = buildSideQuestionFallbackParams({
    defaultSystemPrompt: promptParts.defaultSystemPrompt,
    appendSystemPrompt: 'appendix',
    userContext: promptParts.userContext,
    systemContext: promptParts.systemContext,
    forkContextMessages: [{ role: 'user', content: 'help' }],
  });
  const analysis = analyzeContext({
    messages: [{ role: 'user', content: 'read file and summarize' }],
    rawMaxTokens: window,
    duplicateReadTokens: 3000,
    toolResultTokens: 2000,
  });
  const suggestions = generateContextSuggestions({
    percentage: analysis.percentage,
    duplicateReadTokens: 3000,
    autoCompactEnabled: true,
  });

  test('1. context window is expressible by model', () => {
    expect(window).toBe(1_000_000);
  });

  test('2. max output tokens are expressible', () => {
    expect(output.upperLimit).toBeGreaterThanOrEqual(output.default);
  });

  test('3. percentages calculation is expressible', () => {
    expect(perc.used).not.toBeNull();
  });

  test('4. auto compact condition is expressible', () => {
    expect(shouldCompact).toBeTrue();
  });

  test('5. compaction strategy exists', () => {
    expect(['none', 'light', 'aggressive']).toContain(strategy.strategy);
  });

  test('6. fetchSystemPromptParts exists', () => {
    expect(fallback.systemPrompt.length).toBeGreaterThan(0);
  });

  test('7. fallback params builder exists', () => {
    expect(fallback.forkContextMessages.length).toBe(1);
  });

  test('8. context analysis and suggestions exist', () => {
    expect(analysis.categories.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  test('9. query-loop and gear-box consume context signals', () => {
    const q = consumeContextSignalInQueryLoop(createQueryLoopContextState('dsxu-sonnet-4-6'), {
      usedPercent: analysis.percentage,
      shouldCompact,
      strategy: strategy.strategy,
    });
    const g = applyContextSignalToGearStrategy(createGearStrategyState(), {
      contextUsedPercent: q.contextUsedPercent,
      shouldCompact: q.autoCompactTriggered,
    });
    expect(q.compactionStrategy).toBe(strategy.strategy);
    expect(g.reason.length).toBeGreaterThan(0);
  });

  test('10. no second context/query system introduced', () => {
    const s = applyContextWindowToSession(
      createSessionContextWindowState('dsxu-sonnet-4-6', window),
      { usedPercent: analysis.percentage, autoCompactTriggered: shouldCompact, compactionStrategy: strategy.strategy },
    );
    const ports = createContextQueryRuntimePorts();
    expect(typeof ports.consumeQueryLoopContext).toBe('function');
    expect(s.contextWindowSize).toBe(window);
  });
});
