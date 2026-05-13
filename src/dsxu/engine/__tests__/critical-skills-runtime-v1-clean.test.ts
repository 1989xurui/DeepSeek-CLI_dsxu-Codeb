import { describe, expect, test } from 'bun:test';
import { executeSkill } from '../skills-registry-v1';

describe('critical-skills-runtime-v1-clean', () => {
  test('batch skill produces executable plan', () => {
    const result = executeSkill({
      skillId: 'batch',
      payload: { tasks: [{ id: 't1', goal: 'analyze repo', readOnly: true }], mode: 'parallel' },
    });
    expect(result.ok).toBeTrue();
    expect(result.output.plan.tasks).toHaveLength(1);
  });

  test('debug skill emits concrete diagnostics', () => {
    const result = executeSkill({
      skillId: 'debug',
      payload: { error: 'EADDRINUSE and timeout in proxy' },
    });
    expect(result.ok).toBeTrue();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  test('simplify skill transforms source text', () => {
    const result = executeSkill({
      skillId: 'simplify',
      payload: { text: 'line1\n\n\nline2   \n' },
    });
    expect(result.ok).toBeTrue();
    expect(result.output.afterLength).toBeLessThan(result.output.beforeLength);
  });

  test('verify skill returns structured check summary', () => {
    const result = executeSkill({
      skillId: 'verify',
      payload: { checks: [{ name: 'unit', passed: true }, { name: 'e2e', passed: true }] },
    });
    expect(result.ok).toBeTrue();
    expect(result.output.totalChecks).toBe(2);
    expect(result.output.failedChecks).toHaveLength(0);
  });
});
