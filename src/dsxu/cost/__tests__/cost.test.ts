import { describe, test, expect } from 'bun:test';
import { CostTracker } from '../index';

describe('CostTracker', () => {
  test('track records entry', async () => {
    const ct = new CostTracker('/tmp/test-ledger.jsonl');
    const entry = await ct.track('R5-17', 'deepseek-chat', {
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_cache_hit_tokens: 200,
    });
    expect(entry.inputTokens).toBe(1000);
    expect(entry.outputTokens).toBe(500);
    expect(entry.cachedTokens).toBe(200);
    expect(entry.cost).toBeGreaterThan(0);
    expect(entry.module).toBe('R5-17');
  });

  test('totalCost sums all entries', async () => {
    const ct = new CostTracker('/tmp/test-ledger2.jsonl');
    await ct.track('A', 'deepseek-chat', { prompt_tokens: 1000, completion_tokens: 500 });
    await ct.track('B', 'deepseek-chat', { prompt_tokens: 2000, completion_tokens: 1000 });
    expect(ct.totalCost()).toBeGreaterThan(0);
  });

  test('totalCost filters by module', async () => {
    const ct = new CostTracker('/tmp/test-ledger3.jsonl');
    await ct.track('A', 'deepseek-chat', { prompt_tokens: 1000, completion_tokens: 500 });
    await ct.track('B', 'deepseek-chat', { prompt_tokens: 2000, completion_tokens: 1000 });
    const costA = ct.totalCost('A');
    const costB = ct.totalCost('B');
    expect(costA).toBeLessThan(costB);
  });

  test('budgetCheck returns ok when under budget', async () => {
    const ct = new CostTracker('/tmp/test-ledger4.jsonl');
    await ct.track('X', 'deepseek-chat', { prompt_tokens: 100, completion_tokens: 50 });
    const check = ct.budgetCheck(10.0);
    expect(check.ok).toBe(true);
    expect(check.remaining).toBeGreaterThan(0);
  });

  test('budgetCheck returns not ok when over budget', async () => {
    const ct = new CostTracker('/tmp/test-ledger5.jsonl');
    await ct.track('X', 'deepseek-chat', { prompt_tokens: 100, completion_tokens: 50 });
    const check = ct.budgetCheck(0.0000001);
    expect(check.ok).toBe(false);
  });

  test('getEntries returns all or filtered', async () => {
    const ct = new CostTracker('/tmp/test-ledger6.jsonl');
    await ct.track('A', 'deepseek-chat', { prompt_tokens: 100, completion_tokens: 50 });
    await ct.track('B', 'deepseek-chat', { prompt_tokens: 200, completion_tokens: 100 });
    expect(ct.getEntries()).toHaveLength(2);
    expect(ct.getEntries('A')).toHaveLength(1);
  });
});
