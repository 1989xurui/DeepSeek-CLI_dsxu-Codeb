import { describe, expect, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  buildDSXUColdModePlanReport,
  createDefaultColdModeNodes,
} from '../cold-mode-cost-planning'

describe('Cold Mode Cost Planning V1', () => {
  test('keeps normal successful coding mostly on Flash with model and cost evidence', () => {
    const report = buildDSXUColdModePlanReport({
      scenario: 'normal_success',
      nodes: createDefaultColdModeNodes(),
    })

    expect(report.withinColdBudget).toBe(true)
    expect(report.proNodeRatio).toBeLessThanOrEqual(25)
    expect(report.savingsVsProOnlyPct).toBeGreaterThanOrEqual(40)
    expect(report.proHardNodeReasons).toEqual([])
    expect(report.nodes.find(node => node.id === 'code-patch')?.decision.model).toBe('deepseek-v4-flash')
    expect(report.finalModelEvidence).toContain('cost_basis=cache_hit/cache_miss/output')
  })

  test('escalates failed verification analysis to Pro while keeping repair Flash max', () => {
    const normal = buildDSXUColdModePlanReport({
      scenario: 'normal_success',
      nodes: createDefaultColdModeNodes(),
    })
    const recovery = buildDSXUColdModePlanReport({
      scenario: 'failed_verification_recovery',
      nodes: createDefaultColdModeNodes({ failedVerification: true }),
    })
    const evidenceDir = join(process.cwd(), '.dsxu', 'trace', 'v18-cost')
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(
      join(evidenceDir, 'cold-mode-cost-planning-report.json'),
      `${JSON.stringify({ normal, recovery }, null, 2)}\n`,
      'utf8',
    )

    expect(recovery.withinColdBudget).toBe(true)
    expect(recovery.proHardNodeReasons).toContain('failed-verification-analysis:failed_verification_pro_thinking_max')
    expect(recovery.nodes.find(node => node.id === 'recovery-repair')?.decision.reason).toBe('recovery_flash_thinking_max')
    expect(recovery.totalCostUsd).toBeLessThan(recovery.proOnlyCostUsd)
    expect(recovery.finalModelEvidence).toContain('failed_verification_pro_thinking_max')
    expect(recovery.finalModelEvidence).toContain('recovery_flash_thinking_max')
  })
})
