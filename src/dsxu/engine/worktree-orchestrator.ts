import type { WorktreeLane, WorktreePlan, WorktreeTask } from './types'

export interface WorktreeOrchestratorConfig {
  maxParallel?: number
  branchPrefix?: string
}

const MIN_PARALLEL = 1
const MAX_PARALLEL = 8

export class WorktreeOrchestrator {
  private readonly maxParallel: number
  private readonly branchPrefix: string

  constructor(config?: WorktreeOrchestratorConfig) {
    this.maxParallel = clampParallel(config?.maxParallel ?? 2)
    this.branchPrefix = normalizeBranchPrefix(config?.branchPrefix ?? 'codex/wt')
  }

  getMaxParallel(): number {
    return this.maxParallel
  }

  plan(tasks: WorktreeTask[]): WorktreePlan {
    const lanes = this.initLanes(Math.min(this.maxParallel, Math.max(1, tasks.length)))
    if (tasks.length === 0) {
      return { maxParallel: this.maxParallel, lanes }
    }

    const sorted = [...tasks].sort((a, b) => (b.estimatedMinutes ?? 0) - (a.estimatedMinutes ?? 0))
    for (const task of sorted) {
      const lane = lanes.reduce((minLane, laneItem) => {
        const minLoad = laneLoad(minLane.tasks)
        const load = laneLoad(laneItem.tasks)
        return load < minLoad ? laneItem : minLane
      })
      lane.tasks.push(task)
    }

    return { maxParallel: this.maxParallel, lanes }
  }

  private initLanes(count: number): WorktreeLane[] {
    return Array.from({ length: count }, (_, idx) => ({
      laneId: idx + 1,
      branch: `${this.branchPrefix}-${String(idx + 1).padStart(2, '0')}`,
      tasks: [],
    }))
  }
}

function clampParallel(n: number): number {
  if (!Number.isFinite(n)) return 2
  return Math.max(MIN_PARALLEL, Math.min(MAX_PARALLEL, Math.floor(n)))
}

function laneLoad(tasks: WorktreeTask[]): number {
  return tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 10), 0)
}

function normalizeBranchPrefix(prefix: string): string {
  const p = prefix.trim().replace(/\/+$/, '')
  return p || 'codex/wt'
}

