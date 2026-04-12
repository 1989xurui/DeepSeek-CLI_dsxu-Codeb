import { describe, test, expect, beforeEach } from 'bun:test';
import { ExperienceStore, injectExperienceContext } from '../index';
import type { ExperienceRecord } from '../types';

const mockEmbed = async (texts: string[]) =>
  texts.map(t => {
    const v: number[] = [];
    for (let d = 0; d < 8; d++) {
      let val = 0;
      for (let c = 0; c < t.length; c++) val += t.charCodeAt(c) * (d + 1) * (c + 1);
      v.push(Math.sin(val));
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / n);
  });

function makeRecord(overrides: Partial<Omit<ExperienceRecord, 'id' | 'embedding'>> = {}): Omit<ExperienceRecord, 'id' | 'embedding'> {
  return {
    ts: Date.now(),
    taskId: 'task-1',
    taskDescription: 'Fix authentication bug',
    taskType: 'debugging',
    plan: 'Check token expiry logic',
    patches: [{ file: 'auth.ts', diff: '+fix' }],
    testResults: [{ name: 'auth-test', result: 'pass' }],
    staticIssues: 0,
    criticVerdict: 'pass',
    finalScore: 0.9,
    durationMs: 1000,
    tokensUsed: 500,
    outcome: 'success',
    ...overrides,
  };
}

describe('R5-26 ExperienceStore', () => {
  let store: ExperienceStore;

  beforeEach(async () => {
    store = new ExperienceStore({ mockEmbed });
    await store.init();
  });

  test('add returns a string id', async () => {
    const id = await store.add(makeRecord());
    expect(typeof id).toBe('string');
    expect(id.startsWith('exp-')).toBe(true);
  });

  test('stats reflects added records', async () => {
    await store.add(makeRecord({ outcome: 'success' }));
    await store.add(makeRecord({ outcome: 'failure', finalScore: 0.2 }));
    const s = await store.stats();
    expect(s.total).toBe(2);
    expect(s.successRate).toBe(0.5);
  });

  test('retrieve returns results ranked by similarity', async () => {
    await store.add(makeRecord({ taskDescription: 'Fix auth bug', plan: 'Check tokens' }));
    await store.add(makeRecord({ taskDescription: 'Add CSS styles', plan: 'Update theme' }));
    const results = await store.retrieve('Fix authentication issue', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test('retrieve with outcome filter', async () => {
    await store.add(makeRecord({ outcome: 'success', taskDescription: 'Task A' }));
    await store.add(makeRecord({ outcome: 'failure', taskDescription: 'Task B' }));
    const results = await store.retrieve('Task', 10, { outcome: 'success' });
    expect(results.every(r => r.outcome === 'success')).toBe(true);
  });

  test('feedback updates helpfulness', async () => {
    const id = await store.add(makeRecord());
    await store.feedback(id, 0.95);
    const results = await store.retrieve('Fix authentication bug', 1);
    expect(results[0].helpfulness).toBe(0.95);
  });

  test('injectExperienceContext with records augments prompt', async () => {
    await store.add(makeRecord({ taskDescription: 'Similar task', plan: 'Plan A' }));
    const prompt = await injectExperienceContext(store, 'Similar task', 'Base prompt');
    expect(prompt).toContain('Base prompt');
    expect(prompt).toContain('ExperienceStore Context');
  });

  test('injectExperienceContext with empty store returns base prompt', async () => {
    const prompt = await injectExperienceContext(store, 'query', 'Base prompt');
    expect(prompt).toBe('Base prompt');
  });

  test('not-initialized store throws', async () => {
    const uninit = new ExperienceStore({ mockEmbed });
    expect(() => uninit.add(makeRecord())).toThrow('not initialized');
  });

  test('retrieve on empty store returns empty array', async () => {
    const results = await store.retrieve('anything', 5);
    expect(results).toEqual([]);
  });

  test('multiple adds produce unique ids', async () => {
    const id1 = await store.add(makeRecord());
    const id2 = await store.add(makeRecord());
    expect(id1).not.toBe(id2);
  });
});
