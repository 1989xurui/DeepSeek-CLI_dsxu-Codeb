import { describe, expect, test } from 'bun:test'
import {
  getPerMessageBudgetLimit,
  resolveToolResultBudgetDecision,
} from '../../../utils/toolResultStorage'

describe('V8 tool output artifact budget', () => {
  test('uses profile-aware limits instead of one unlimited tool result bucket', () => {
    const explain = resolveToolResultBudgetDecision({ profile: 'explain' })
    const longTask = resolveToolResultBudgetDecision({ profile: 'long_task' })

    expect(explain.schemaVersion).toBe('dsxu.tool-result-budget.v8')
    expect(explain.owner).toBe('Tool Gate / Tool Result Contract')
    expect(explain.limitChars).toBeLessThan(longTask.limitChars)
    expect(explain.evidence).toContain('profile:explain')
    expect(longTask.evidence).toContain('profile:long_task')
  })

  test('tightens long output budget under high context pressure', () => {
    const normal = getPerMessageBudgetLimit({ profile: 'multi_file_refactor', contextPressurePct: 50 })
    const high = getPerMessageBudgetLimit({ profile: 'multi_file_refactor', contextPressurePct: 90 })
    const critical = getPerMessageBudgetLimit({ profile: 'multi_file_refactor', contextPressurePct: 97 })

    expect(normal).toBeGreaterThan(high)
    expect(high).toBeGreaterThan(critical)
    expect(critical).toBeGreaterThanOrEqual(4000)
  })
})
