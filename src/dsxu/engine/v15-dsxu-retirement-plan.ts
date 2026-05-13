export type V15RetirementAction = 'absorb' | 'facade' | 'isolate' | 'delete_candidate'

export type V15ReferenceHit = {
  path: string
  count: number
  action: V15RetirementAction
}

export type V15RetirementCard = {
  title: string
  action: V15RetirementAction
  hits: V15ReferenceHit[]
}

export type V15DSXURetirementPlanSummary = {
  totalHits: number
  cards: V15RetirementCard[]
}

export function runV15DSXURetirementPlan(hits: V15ReferenceHit[] = []): V15DSXURetirementPlanSummary {
  const grouped = new Map<V15RetirementAction, V15ReferenceHit[]>()
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
