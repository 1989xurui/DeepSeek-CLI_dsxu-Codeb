import { describe, expect, test } from 'bun:test'
import { buildV18RealTaskRoutePlan } from '../v18-real-task-route-plan'

describe('V18 real task phase route plan', () => {
  test('keeps Pro-only execution guarded when only the phase plan is mixed', () => {
    const evidence = buildV18RealTaskRoutePlan({
      generatedAt: '2026-05-06T15:00:00.000Z',
      sourceRealTaskPack: '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json',
      evidencePath: '.dsxu/trace/v18-cost-router/real-task-phase-route-plan-20260506.evidence.json',
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          modelsUsed: ['deepseek-v4-pro'],
        },
      },
      cases: [
        {
          id: 'v8-real-bugfix-multifile',
          category: 'bugfix',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
        {
          id: 'v8-real-feature-tests',
          category: 'feature',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
        {
          id: 'v8-real-review-fix',
          category: 'review',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
        {
          id: 'v8-real-recovery-failed-test',
          category: 'recovery',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
      ],
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('PARTIAL_ROUTE_PLAN')
    expect(evidence.actualMixedRoute).toBe(false)
    expect(evidence.plannedMixedRoute).toBe(false)
    expect(evidence.actualRouteWired).toBe(false)
    expect(evidence.actualModels).toEqual(['deepseek-v4-pro'])
    expect(evidence.plannedModels).toEqual(['deepseek-v4-flash'])
    expect(evidence.costOptimizationOpportunityCount).toBe(4)
    expect(evidence.cases.find(item => item.category === 'feature')?.phases[0]?.reason)
      .toBe('coding_flash_non_thinking')
    expect(evidence.cases.find(item => item.category === 'review')?.phases[0]?.reason)
      .toBe('review_flash_thinking_max')
    expect(evidence.cases.find(item => item.category === 'recovery')?.phases[0]?.reason)
      .toBe('recovery_flash_thinking_max')
    expect(evidence.guards).toContain(
      'low-risk bugfix/feature cases have measurable Flash execution opportunities',
    )
  })

  test('flags lingering Pro usage after Flash-max admission policy narrows the route plan', () => {
    const evidence = buildV18RealTaskRoutePlan({
      generatedAt: '2026-05-07T00:30:00+08:00',
      sourceRealTaskPack: '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json',
      evidencePath: '.dsxu/trace/v18-cost-router/real-task-phase-route-plan-20260506.evidence.json',
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
      },
      cases: [
        {
          id: 'v8-real-bugfix-multifile',
          category: 'bugfix',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
        },
        {
          id: 'v8-real-feature-tests',
          category: 'feature',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-flash'] },
        },
        {
          id: 'v8-real-review-fix',
          category: 'review',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
        {
          id: 'v8-real-recovery-failed-test',
          category: 'recovery',
          status: 'pass',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
      ],
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('PARTIAL_ROUTE_PLAN')
    expect(evidence.actualMixedRoute).toBe(true)
    expect(evidence.plannedMixedRoute).toBe(false)
    expect(evidence.actualRouteWired).toBe(false)
    expect(evidence.actualModels).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ])
    expect(evidence.costOptimizationOpportunityCount).toBe(2)
    expect(evidence.guards).toContain(
      'low-risk bugfix/feature cases have measurable Flash execution opportunities',
    )
  })

  test('does not mark non-green task packs as route-plan ready', () => {
    const evidence = buildV18RealTaskRoutePlan({
      generatedAt: '2026-05-06T15:00:00.000Z',
      sourceRealTaskPack: 'pack.json',
      evidencePath: 'route.json',
      realTaskPack: {
        aggregate: {
          totalCases: 2,
          pass: 1,
          fail: 1,
          policyFail: 0,
          timedOut: 0,
          modelsUsed: ['deepseek-v4-pro'],
        },
      },
      cases: [
        {
          id: 'v8-real-feature-tests',
          category: 'feature',
          status: 'fail',
          metrics: { modelsUsed: ['deepseek-v4-pro'] },
        },
      ],
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('BLOCKED_NON_GREEN')
    expect(evidence.plannedMixedRoute).toBe(false)
    expect(evidence.actualRouteWired).toBe(false)
  })
})
