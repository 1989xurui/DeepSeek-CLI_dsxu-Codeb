import { describe, expect, test } from 'bun:test'
import { buildV18BenchmarkReadiness } from '../benchmark-readiness'

describe('V18 Benchmark Readiness V1', () => {
  test('allows guarded Code-10 aggregation while blocking Code-30 and public benchmark on four Pro-only cases', () => {
    const readiness = buildV18BenchmarkReadiness({
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 23,
          totalEditCalls: 4,
          failedEditCalls: 0,
          postMarkerToolCalls: 0,
          totalCostUSD: 0.328664,
          modelsUsed: ['deepseek-v4-pro'],
        },
      },
      mixedRoute: {
        flashSmoke: { actualModelUsage: 'deepseek-v4-flash' },
        proPlanningSmoke: { actualModelUsage: 'deepseek-v4-pro' },
      },
      controlledFailureTaxonomy: {
        ok: true,
        taxonomy: {
          ok: true,
          sampleCount: 5,
          categories: ['permission', 'timeout', 'validation', 'workspace'],
          actions: ['request_approval', 'retry', 'replan', 'abort'],
        },
      },
    })

    expect(readiness.ok).toBe(true)
    expect(readiness.internalCode10).toBe('GO_WITH_GUARDS')
    expect(readiness.internalCode30).toBe('STOP')
    expect(readiness.publicBenchmark).toBe('STOP_PUBLIC_BENCH')
    expect(readiness.averageToolCalls).toBe(5.75)
    expect(readiness.failedEditRate).toBe(0)
    expect(readiness.mixedRouteSmoke).toBe(true)
    expect(readiness.realTaskMixedRoute).toBe(false)
    expect(readiness.realTaskPlannedMixedRoute).toBe(false)
    expect(readiness.guards).toContain(
      'real task pack is still Pro-only; mixed route is proven by smoke, not by multi-step real tasks',
    )
    expect(readiness.guards).toContain(
      'failure taxonomy is controlled-only; add live failing samples before public benchmark spend',
    )
    expect(readiness.failureTaxonomy.missingFailureDiversity).toBe(false)
  })

  test('blocks readiness when real task pack is not green or route smoke is missing', () => {
    const readiness = buildV18BenchmarkReadiness({
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 3,
          fail: 1,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 46,
          totalEditCalls: 3,
          failedEditCalls: 0,
          postMarkerToolCalls: 2,
          totalCostUSD: 0.25,
          modelsUsed: ['deepseek-v4-pro'],
        },
      },
      mixedRoute: {},
    })

    expect(readiness.ok).toBe(false)
    expect(readiness.internalCode10).toBe('STOP')
    expect(readiness.blockers).toEqual([
      'real-task-pack-core is not fully green',
      'mixed Pro/Flash route smoke is missing',
    ])
  })

  test('recognizes phase-level mixed route plans without pretending actual live execution was mixed', () => {
    const readiness = buildV18BenchmarkReadiness({
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 23,
          totalEditCalls: 4,
          failedEditCalls: 0,
          postMarkerToolCalls: 0,
          totalCostUSD: 0.328664,
          modelsUsed: ['deepseek-v4-pro'],
        },
      },
      mixedRoute: {
        flashSmoke: { actualModelUsage: 'deepseek-v4-flash' },
        proPlanningSmoke: { actualModelUsage: 'deepseek-v4-pro' },
      },
      controlledFailureTaxonomy: {
        ok: true,
        taxonomy: {
          ok: true,
          sampleCount: 5,
          categories: ['permission', 'timeout', 'validation', 'workspace'],
          actions: ['request_approval', 'retry', 'replan', 'abort'],
        },
      },
      realTaskRoutePlan: {
        ok: true,
        plannedMixedRoute: true,
        actualMixedRoute: false,
        plannedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        actualModels: ['deepseek-v4-pro'],
        costOptimizationOpportunityCount: 2,
      },
    })

    expect(readiness.ok).toBe(true)
    expect(readiness.realTaskMixedRoute).toBe(false)
    expect(readiness.realTaskPlannedMixedRoute).toBe(true)
    expect(readiness.plannedRouteModels).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ])
    expect(readiness.routePlanOpportunityCount).toBe(2)
    expect(readiness.guards).toContain(
      'actual real task execution is still Pro-only; phase route plan is mixed and runner wiring remains',
    )
    expect(readiness.guards).not.toContain(
      'real task pack is still Pro-only; mixed route is proven by smoke, not by multi-step real tasks',
    )
  })

  test('recognizes actual mixed route real task evidence but keeps public benchmark blocked', () => {
    const readiness = buildV18BenchmarkReadiness({
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 24,
          totalEditCalls: 4,
          failedEditCalls: 0,
          postMarkerToolCalls: 0,
          totalCostUSD: 0.121638,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
      },
      mixedRoute: {
        flashSmoke: { actualModelUsage: 'deepseek-v4-flash' },
        proPlanningSmoke: { actualModelUsage: 'deepseek-v4-pro' },
      },
      controlledFailureTaxonomy: {
        ok: true,
        taxonomy: {
          ok: true,
          sampleCount: 5,
          categories: ['permission', 'timeout', 'validation', 'workspace'],
          actions: ['request_approval', 'retry', 'replan', 'abort'],
        },
      },
      realTaskRoutePlan: {
        ok: true,
        plannedMixedRoute: true,
        actualMixedRoute: true,
        plannedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        actualModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        costOptimizationOpportunityCount: 0,
      },
    })

    expect(readiness.ok).toBe(true)
    expect(readiness.internalCode10).toBe('GO_WITH_GUARDS')
    expect(readiness.internalCode30).toBe('STOP')
    expect(readiness.publicBenchmark).toBe('STOP_PUBLIC_BENCH')
    expect(readiness.realTaskMixedRoute).toBe(true)
    expect(readiness.routePlanOpportunityCount).toBe(0)
    expect(readiness.guards).toContain(
      'Internal Code-10 needs at least ten cases before reporting a stable score',
    )
    expect(readiness.guards).toContain(
      'failure taxonomy is controlled-only; add live failing samples before public benchmark spend',
    )
    expect(readiness.guards).not.toContain(
      'actual real task execution is still Pro-only; phase route plan is mixed and runner wiring remains',
    )
  })
})
