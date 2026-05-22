import { describe, expect, test } from 'bun:test'
import { buildV7CompletionAudit } from '../dsxu-v7-completion-audit'

describe('V7 completion audit', () => {
  test('passes the independent V7 completion audit against current generated evidence', async () => {
    const report = await buildV7CompletionAudit({
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_V7_COMPLETION_AUDIT')
    expect(report.summary.blocked).toBe(0)
    expect(report.summary.workPackages).toBeGreaterThanOrEqual(13)
    expect(report.summary.scriptsPresent).toBe(report.summary.workPackages)
    expect(report.summary.testsPresent).toBe(report.summary.workPackages)
    expect(report.summary.reportsPresent).toBe(report.summary.workPackages)
    expect(report.summary.v7InternalsClosed).toBe(true)
    expect(report.checks.every(check => check.status === 'PASS')).toBe(true)
  })
})
