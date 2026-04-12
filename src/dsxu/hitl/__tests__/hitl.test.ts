/**
 * DSxu HITL Incident Reporting — bun:test
 */
import { describe, test, expect } from 'bun:test';
import { IncidentReporter, reportTestFailure, reportCostOverrun } from '../index';

const mockReporter = () => new IncidentReporter({ mockMode: true });

describe('IncidentReporter', () => {
  test('report creates incident with ID', async () => {
    const r = mockReporter();
    const inc = await r.report({
      severity: 'warning',
      category: 'test-failure',
      module: 'R5-24',
      summary: 'Mutation test failed',
      details: { killRate: 0.3 },
    });
    expect(inc.id).toMatch(/^INC-/);
    expect(inc.resolved).toBe(false);
    expect(inc.timestamp).toBeDefined();
  });

  test('list returns reported incidents', async () => {
    const r = mockReporter();
    await r.report({ severity: 'info', category: 'test-failure', module: 'test', summary: 'test', details: {} });
    await r.report({ severity: 'critical', category: 'cost-overrun', module: 'test', summary: 'cost', details: {} });
    const all = await r.list();
    expect(all).toHaveLength(2);
  });

  test('list filters by category', async () => {
    const r = mockReporter();
    await r.report({ severity: 'info', category: 'test-failure', module: 'a', summary: 'a', details: {} });
    await r.report({ severity: 'info', category: 'cost-overrun', module: 'b', summary: 'b', details: {} });
    const filtered = await r.list({ category: 'cost-overrun' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('cost-overrun');
  });

  test('resolve marks incident as resolved', async () => {
    const r = mockReporter();
    const inc = await r.report({ severity: 'warning', category: 'test-failure', module: 'x', summary: 'x', details: {} });
    const resolved = await r.resolve(inc.id, 'Fixed the test');
    expect(resolved?.resolved).toBe(true);
    expect(resolved?.resolution).toBe('Fixed the test');
    expect(resolved?.resolvedAt).toBeDefined();
  });

  test('resolve returns null for unknown ID', async () => {
    const r = mockReporter();
    const result = await r.resolve('INC-unknown', 'nope');
    expect(result).toBeNull();
  });

  test('list filters by resolved status', async () => {
    const r = mockReporter();
    const inc1 = await r.report({ severity: 'info', category: 'test-failure', module: 'a', summary: 'a', details: {} });
    await r.report({ severity: 'info', category: 'test-failure', module: 'b', summary: 'b', details: {} });
    await r.resolve(inc1.id, 'fixed');
    expect((await r.list({ resolved: true })).length).toBe(1);
    expect((await r.list({ resolved: false })).length).toBe(1);
  });

  test('stats returns correct counts', async () => {
    const r = mockReporter();
    await r.report({ severity: 'warning', category: 'test-failure', module: 'a', summary: 'a', details: {} });
    await r.report({ severity: 'critical', category: 'cost-overrun', module: 'b', summary: 'b', details: {} });
    const s = await r.stats();
    expect(s.total).toBe(2);
    expect(s.open).toBe(2);
    expect(s.bySeverity['warning']).toBe(1);
    expect(s.bySeverity['critical']).toBe(1);
  });
});

describe('convenience functions', () => {
  test('reportTestFailure creates test-failure incident', async () => {
    const r = mockReporter();
    const inc = await reportTestFailure(r, 'R5-24', { test: 'kill-01' });
    expect(inc.category).toBe('test-failure');
    expect(inc.severity).toBe('warning');
  });

  test('reportCostOverrun creates critical cost incident', async () => {
    const r = mockReporter();
    const inc = await reportCostOverrun(r, 'R5-35', 5.50, 3.00);
    expect(inc.category).toBe('cost-overrun');
    expect(inc.severity).toBe('critical');
    expect(inc.details.overage).toBeCloseTo(2.50);
  });
});
