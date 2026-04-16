import { describe, it, expect } from 'vitest'
import { WorktreeOrchestrator } from '../worktree-orchestrator'

describe('WorktreeOrchestrator', () => {
  it('should clamp parallelism to safe range', () => {
    const low = new WorktreeOrchestrator({ maxParallel: 0 })
    const high = new WorktreeOrchestrator({ maxParallel: 99 })
    expect(low.getMaxParallel()).toBe(1)
    expect(high.getMaxParallel()).toBe(8)
  })

  it('should produce lane branches with codex prefix by default', () => {
    const planner = new WorktreeOrchestrator({ maxParallel: 2 })
    const plan = planner.plan([
      { id: 't1', title: 'one' },
      { id: 't2', title: 'two' },
    ])
    expect(plan.lanes).toHaveLength(2)
    expect(plan.lanes[0].branch.startsWith('codex/wt-')).toBe(true)
  })

  it('should balance estimated load across lanes', () => {
    const planner = new WorktreeOrchestrator({ maxParallel: 2 })
    const plan = planner.plan([
      { id: 'big', title: 'big', estimatedMinutes: 60 },
      { id: 's1', title: 's1', estimatedMinutes: 10 },
      { id: 's2', title: 's2', estimatedMinutes: 10 },
    ])
    const loads = plan.lanes.map(l => l.tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 10), 0))
    const delta = Math.abs(loads[0] - loads[1])
    expect(delta).toBeLessThanOrEqual(40)
  })
})

