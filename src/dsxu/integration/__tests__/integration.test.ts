/**
 * DSxu Integration Wiring — bun:test
 */
import { describe, test, expect } from 'bun:test';
import { createRuntime, wireExperienceToPrompt, wireMutationToAnalysis } from '../index';

describe('createRuntime', () => {
  test('returns runtime with all modules', () => {
    const rt = createRuntime({
      vectorStore: { mockEmbed: async () => ({ embedding: [0.1, 0.2, 0.3] }) },
      experience: { mockMode: true },
      mcp: { mockInvoke: async (t, a) => ({ t, a }), mockHealthCheck: async () => true },
    });
    expect(rt.vectorStore).toBeDefined();
    expect(rt.experienceStore).toBeDefined();
    expect(rt.search).toBeDefined();
    expect(rt.mcpAdapters).toHaveLength(5);
    expect(rt.mutation).toBeDefined();
    expect(rt.pbt.suggest).toBeDefined();
    expect(rt.pbt.run).toBeDefined();
  });
});

describe('wireExperienceToPrompt', () => {
  test('returns empty string for empty store', async () => {
    const { ExperienceStore } = await import('../../../services/experience/store');
    const store = new ExperienceStore({ mockMode: true });
    await store.init();
    const wired = wireExperienceToPrompt(store);
    const ctx = await wired.getExperienceContext('some task');
    expect(ctx).toBe('');
  });
});

describe('wireMutationToAnalysis', () => {
  test('returns killRate and totalMutations', async () => {
    const wired = wireMutationToAnalysis();
    const r = await wired.getMutationCoverage(
      'function add(a, b) { return a + b; }',
      async () => true
    );
    expect(typeof r.killRate).toBe('number');
    expect(typeof r.totalMutations).toBe('number');
  });
});
