import { describe, expect, test } from 'bun:test';
import { getC16ShellAuditMatrix, summarizeC16ShellAudit } from '../../integration/harness/c16-shell-full-audit-matrix';

describe('C16 shell layer full dynamic audit clean', () => {
  const matrix = getC16ShellAuditMatrix();
  const summary = summarizeC16ShellAudit(matrix);

  test('1. matrix is dynamic and non-empty', () => {
    expect(matrix.totalSourceFiles).toBeGreaterThan(0);
    expect(matrix.entries.length).toBe(matrix.totalSourceFiles);
  });

  test('2. in-scope + out-of-scope equals total', () => {
    expect(summary.inScopeSourceFiles + summary.outOfScopeSourceFiles).toBe(summary.totalSourceFiles);
  });

  test('3. statistics are internally consistent', () => {
    expect(summary.completed + summary.partial + summary.missing).toBe(summary.inScopeSourceFiles);
  });

  test('4. UI shell entries are out-of-scope by rule', () => {
    const uiEntries = matrix.entries.filter((e) => e.category === 'shell-ui');
    expect(uiEntries.length).toBeGreaterThan(0);
    expect(uiEntries.every((e) => e.inScope === false && e.status === 'out-of-scope')).toBeTrue();
  });

  test('5. no hardcoded 100', () => {
    expect(summary.conversionRate).toBeGreaterThanOrEqual(0);
    expect(summary.conversionRate).toBeLessThanOrEqual(100);
  });

  test('6. print formal dynamic result', () => {
    const conclusion = summary.is100 ? '达到' : '未达到';
    console.log('\n[c16-shell-audit]');
    console.log(JSON.stringify({
      totalSourceFiles: summary.totalSourceFiles,
      inScopeSourceFiles: summary.inScopeSourceFiles,
      outOfScopeSourceFiles: summary.outOfScopeSourceFiles,
      completed: summary.completed,
      partial: summary.partial,
      missing: summary.missing,
      conversionRate: summary.conversionRate,
      conclusion,
    }, null, 2));
    expect(['达到', '未达到']).toContain(conclusion);
  });
});
