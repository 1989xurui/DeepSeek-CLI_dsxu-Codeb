import { beforeEach, describe, expect, it } from 'vitest'

import {
  getCachePrefixRegistryLaneStats,
  getCachePrefixRegistrySnapshot,
  recordCachePrefixRegistry,
  resetCachePrefixRegistry,
} from '../cache-prefix-registry'

describe('cache-prefix-registry', () => {
  beforeEach(() => {
    resetCachePrefixRegistry()
  })

  it('registers stable cache prefix evidence without provider calls', () => {
    const event = recordCachePrefixRegistry({
      querySource: 'repl_main_thread',
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      stablePrefixHash: 'stable-a',
      toolSchemaHash: 'tools-a',
      cacheEpochHash: 'epoch-a',
    })

    expect(event.status).toBe('CACHE_PREFIX_REGISTRY_REGISTERED')
    expect(event.lane).toBe('mainline')
    expect(event.performanceBoundary).toContain('no provider call')
    expect(getCachePrefixRegistrySnapshot()).toHaveLength(1)
  })

  it('detects workflow/source interleaving on the same mainline lane', () => {
    recordCachePrefixRegistry({
      querySource: 'repl_main_thread',
      workflowKind: 'planning',
      model: 'deepseek-v4-flash',
      stablePrefixHash: 'stable-a',
      toolSchemaHash: 'tools-a',
      cacheEpochHash: 'epoch-a',
    })

    const event = recordCachePrefixRegistry({
      querySource: 'sdk',
      workflowKind: 'review',
      model: 'deepseek-v4-flash',
      stablePrefixHash: 'stable-a',
      toolSchemaHash: 'tools-a',
      cacheEpochHash: 'epoch-b',
    })

    expect(event.status).toBe('CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED')
    expect(event.previousWorkflowKind).toBe('planning')
    expect(event.recommendation).toContain('lane-level hit rate')

    const laneStats = getCachePrefixRegistryLaneStats()
    expect(laneStats).toHaveLength(1)
    expect(laneStats[0]).toMatchObject({
      schemaVersion: 'dsxu.cache-prefix-registry-lane-stats.v1',
      lane: 'mainline',
      sampleCount: 2,
      latestStatus: 'CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED',
    })
    expect(laneStats[0].statusCounts).toMatchObject({
      CACHE_PREFIX_REGISTRY_REGISTERED: 1,
      CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED: 1,
    })
    expect(laneStats[0].querySources).toEqual(['repl_main_thread', 'sdk'])
    expect(laneStats[0].workflowKinds).toEqual(['planning', 'review'])
    expect(laneStats[0].performanceBoundary).toContain('no forced querySource merge')
  })

  it('detects cache epoch drift for the same lane/source/workflow', () => {
    recordCachePrefixRegistry({
      querySource: 'repl_main_thread',
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      cacheEpochHash: 'epoch-a',
    })

    const event = recordCachePrefixRegistry({
      querySource: 'repl_main_thread',
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      cacheEpochHash: 'epoch-b',
    })

    expect(event.status).toBe('CACHE_PREFIX_REGISTRY_EPOCH_CHANGED')
    expect(event.previousCacheEpochHash).toBe('epoch-a')
  })

  it('resets lane-level registry statistics with the main registry', () => {
    recordCachePrefixRegistry({
      querySource: 'repl_main_thread',
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      cacheEpochHash: 'epoch-a',
    })

    expect(getCachePrefixRegistryLaneStats()).toHaveLength(1)
    resetCachePrefixRegistry()
    expect(getCachePrefixRegistrySnapshot()).toHaveLength(0)
    expect(getCachePrefixRegistryLaneStats()).toHaveLength(0)
  })
})
