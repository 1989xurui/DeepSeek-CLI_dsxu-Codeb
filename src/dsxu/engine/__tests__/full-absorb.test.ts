import { describe, it, expect } from 'vitest'
import { buildFullAbsorbActions, scanFullAbsorbStatus } from '../full-absorb'
import { executeFullAbsorbPlan } from '../full-absorb-executor'

describe('FullAbsorb', () => {
  it('should scan repository targets and return a ratio', () => {
    const status = scanFullAbsorbStatus(process.cwd())
    expect(status.total).toBeGreaterThan(0)
    expect(status.ratio).toBeGreaterThanOrEqual(0)
    expect(status.ratio).toBeLessThanOrEqual(1)
  })

  it('should build actions from status', () => {
    const status = scanFullAbsorbStatus(process.cwd())
    const actions = buildFullAbsorbActions(status)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0].wave === 'W1' || actions[0].wave === 'W2').toBe(true)
  })

  it('should build an executable report with recommended tests', () => {
    const status = scanFullAbsorbStatus(process.cwd())
    const report = executeFullAbsorbPlan({
      status,
      importedTools: 10,
      toolSchemas: [],
      reduceTestStrategy: 'minimal',
    })
    expect(report.status.total).toBeGreaterThan(0)
    expect(report.recommendedTests.length).toBeGreaterThan(0)
  })

  it('should include high-value legacy bridge targets in scan results', () => {
    const status = scanFullAbsorbStatus(process.cwd())
    const keys = new Set(status.targets.map(t => t.key))

    expect(keys.has('memdir')).toBe(true)
    expect(keys.has('file_history')).toBe(true)
    expect(keys.has('prompt_cache_break_detection')).toBe(true)
    expect(keys.has('tasks')).toBe(true)
    expect(keys.has('prompt_suggestion_speculation')).toBe(true)
  })

  it('should group missing phase1/phase2 targets into W1 actions', () => {
    const status = scanFullAbsorbStatus(process.cwd())
    const missing = status.targets
      .filter(t => t.key === 'memdir' || t.key === 'tasks')
      .map(t => ({ ...t, status: 'missing' as const, exists: false }))
    const next = {
      ...status,
      targets: status.targets.map(t => missing.find(m => m.key === t.key) ?? t),
    }

    const actions = buildFullAbsorbActions(next)
    const w1 = actions.find(a => a.wave === 'W1')
    expect(w1).toBeDefined()
    const joined = (w1?.items ?? []).join('\n')
    expect(joined).toContain('memdir -> src/memdir')
    expect(joined).toContain('tasks -> src/tasks')
  })
})
