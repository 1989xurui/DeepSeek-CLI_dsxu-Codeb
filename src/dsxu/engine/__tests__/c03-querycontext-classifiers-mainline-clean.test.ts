import { describe, expect, test } from 'bun:test';
import {
  analyzeContext,
  analyzeContextWeighted,
  checkHighRiskBash,
  queryGuard,
  queryHelpers,
  queryProfiler,
  resolveIntent,
} from '../query-context-builder-v1';
import {
  analyzeContextDepth,
  generateContextSuggestions,
  generateDoctorWarnings,
} from '../context-analysis-v1';
import {
  calculateContextPercentages,
  getCompactionStrategy,
  getContextWindowForModel,
  shouldTriggerAutoCompact,
} from '../context-window-manager-v1';
import { consumeContextSignalInQueryLoop, createQueryLoopContextState } from '../query-loop';
import { applyContextWindowToSession, createSessionContextWindowState } from '../session';
import { createContextQueryRuntimePorts } from '../runtime-core';

describe('C03 querycontext/classifiers mainline clean', () => {
  test('1. classifier runtime: intent matrix and bash high-risk guard', () => {
    const intent = resolveIntent({ text: 'please debug timeout error and verify test coverage' });
    expect(['debug', 'test', 'review']).toContain(intent.intent);
    expect(intent.matchedFeatures.length).toBeGreaterThan(0);

    const bash = checkHighRiskBash({ command: 'rm -rf /' });
    expect(bash.totalRegexCount).toBeGreaterThanOrEqual(200);
    expect(bash.blocked).toBeTrue();
  });

  test('2. query/context runtime: helper + profiler + guard are executable', () => {
    const helper = queryHelpers({ query: 'Analyze query context and avoid overflow', source: 'main', tags: ['safe'] });
    expect(helper.normalizedQuery.length).toBeGreaterThan(0);

    const profile = queryProfiler({ query: helper.normalizedQuery, estimatedContextTokens: 9000 });
    expect(['low', 'medium', 'high']).toContain(profile.complexity);

    const guard = queryGuard({ estimatedTokens: 9000, contextWindowSize: 10000 });
    expect(guard.severity).toBe('medium');
    expect(guard.allow).toBeTrue();
  });

  test('3. analyzeContext + weighted selection keep budget semantics', () => {
    const a = analyzeContext({
      messages: [
        { role: 'user', content: 'read file A and summarize' },
        { role: 'assistant', content: 'tool results and next actions' },
      ],
      rawMaxTokens: 10000,
      toolResultTokens: 500,
      memoryTokens: 200,
    });
    expect(a.percentage).toBeGreaterThan(0);
    expect(a.categories.length).toBeGreaterThan(0);

    const w = analyzeContextWeighted({
      maxTokens: 30,
      messages: [
        { role: 'error', content: 'critical exception trace and stack' },
        { role: 'assistant', content: 'normal answer' },
        { role: 'tool', content: 'tool_result details' },
      ],
    });
    expect(w.total).toBeLessThanOrEqual(30);
    expect(w.selected.length).toBeGreaterThan(0);
  });

  test('4. lifecycle runtime: context depth -> suggestions -> doctor warnings', () => {
    const depth = analyzeContextDepth({
      messages: [
        { role: 'user', content: 'please inspect context and query' },
        { role: 'assistant', content: 'analysis output and recommendation' },
        { role: 'tool', content: 'tool log details and traces' },
      ],
      duplicateReadSignals: 4,
    });
    expect(['low', 'medium', 'high']).toContain(depth.depthLevel);

    const suggestions = generateContextSuggestions(depth);
    expect(suggestions.length).toBeGreaterThan(0);

    const doctor = generateDoctorWarnings({ analysis: depth, suggestions });
    expect(doctor.length).toBeGreaterThan(0);
  });

  test('5. mainline consumption: query-loop + session + runtime-core ports', () => {
    const window = getContextWindowForModel('dsxu-sonnet-4-6');
    const pct = calculateContextPercentages(
      { input_tokens: 850000, cache_creation_input_tokens: 20000, cache_read_input_tokens: 20000 },
      window,
    );
    const shouldCompact = shouldTriggerAutoCompact({ usedPercent: pct.used ?? 0, autoCompactEnabled: true, threshold: 80 });
    const strategy = getCompactionStrategy({ usedPercent: pct.used ?? 0, duplicateReadPercent: 12 });

    const q0 = createQueryLoopContextState('dsxu-sonnet-4-6');
    const q1 = consumeContextSignalInQueryLoop(q0, {
      usedPercent: pct.used ?? 0,
      shouldCompact,
      strategy: strategy.strategy,
    });
    expect(q1.autoCompactTriggered).toBeTrue();
    expect(q1.compactionStrategy).not.toBe('none');

    const s0 = createSessionContextWindowState('dsxu-sonnet-4-6', window);
    const s1 = applyContextWindowToSession(s0, {
      usedPercent: q1.contextUsedPercent,
      autoCompactTriggered: q1.autoCompactTriggered,
      compactionStrategy: q1.compactionStrategy,
    });
    expect(s1.autoCompactTriggered).toBeTrue();
    expect(s1.contextWindowSize).toBe(window);

    const ports = createContextQueryRuntimePorts();
    expect(typeof ports.consumeQueryLoopContext).toBe('function');
    expect(typeof ports.consumeSessionContext).toBe('function');
    expect(typeof ports.consumeGearContext).toBe('function');
  });
});
