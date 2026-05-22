export type DsxuRetirementAction = 'absorb' | 'facade' | 'isolate' | 'delete_candidate'

export type DsxuReferenceHit = {
  path: string
  count: number
  action: DsxuRetirementAction
}

export type DsxuRetirementCard = {
  title: string
  action: DsxuRetirementAction
  hits: DsxuReferenceHit[]
}

export type DsxuRetirementPlanSummary = {
  totalHits: number
  cards: DsxuRetirementCard[]
}

export function runDsxuRetirementPlan(hits: DsxuReferenceHit[] = []): DsxuRetirementPlanSummary {
  const grouped = new Map<DsxuRetirementAction, DsxuReferenceHit[]>()
  for (const hit of hits) {
    const list = grouped.get(hit.action) ?? []
    list.push(hit)
    grouped.set(hit.action, list)
  }

  return {
    totalHits: hits.reduce((sum, hit) => sum + hit.count, 0),
    cards: [...grouped.entries()].map(([action, actionHits]) => ({
      title: `DSXU ${action.replace('_', ' ')} plan`,
      action,
      hits: actionHits,
    })),
  }
}
