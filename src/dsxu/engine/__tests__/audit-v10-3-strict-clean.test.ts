import { describe, expect, test } from 'bun:test';
import { runAuditV103Strict } from '../audit_v10_3_strict';

describe('V10-3 strict audit runtime', () => {
  const report = runAuditV103Strict();

  test('1. dynamic totals are generated from source scan', () => {
    expect(report.total).toBeGreaterThan(0);
    expect(report.total).toBe(report.completed + report.partial + report.missing);
  });

  test('2. category totals are internally consistent', () => {
    const sum =
      report.perCategory.skill.total +
      report.perCategory.task.total +
      report.perCategory['prompt/queryContext'].total;
    expect(sum).toBe(report.total);
  });

  test('3. strict verdict is computed from dynamic totals', () => {
    const shouldComplete = report.total > 0 && report.completed === report.total;
    expect(report.verdict).toBe(shouldComplete ? 'Hard Audit Complete (100%)' : 'Hard Audit Incomplete');
  });
});
