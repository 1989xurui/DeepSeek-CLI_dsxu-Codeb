export type CachePrefixRegistryStatus =
  | 'CACHE_PREFIX_REGISTRY_REGISTERED'
  | 'CACHE_PREFIX_REGISTRY_STABLE'
  | 'CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED'
  | 'CACHE_PREFIX_REGISTRY_EPOCH_CHANGED'
  | 'CACHE_PREFIX_REGISTRY_MODEL_CHANGED'

export type CachePrefixRegistryEvent = {
  schemaVersion: 'dsxu.cache-prefix-registry.v1'
  status: CachePrefixRegistryStatus
  lane: string
  querySource: string
  workflowKind: string
  model: string
  stablePrefixHash?: string
  toolSchemaHash?: string
  cacheEpochHash?: string
  previousQuerySource?: string
  previousWorkflowKind?: string
  previousModel?: string
  previousCacheEpochHash?: string
  recommendation: string
  performanceBoundary: string
}

export type CachePrefixRegistryLaneStats = {
  schemaVersion: 'dsxu.cache-prefix-registry-lane-stats.v1'
  lane: string
  sampleCount: number
  statusCounts: Partial<Record<CachePrefixRegistryStatus, number>>
  querySources: string[]
  workflowKinds: string[]
  models: string[]
  latestStatus: CachePrefixRegistryStatus
  latestRecommendation: string
  performanceBoundary: string
}

type CachePrefixRegistryEntry = {
  lane: string
  querySource: string
  workflowKind: string
  model: string
  stablePrefixHash?: string
  toolSchemaHash?: string
  cacheEpochHash?: string
  updatedAt: number
}

type CachePrefixRegistryLaneStatsState = {
  lane: string
  sampleCount: number
  statusCounts: Partial<Record<CachePrefixRegistryStatus, number>>
  querySources: Set<string>
  workflowKinds: Set<string>
  models: Set<string>
  latestStatus: CachePrefixRegistryStatus
  latestRecommendation: string
}

const MAX_REGISTRY_ENTRIES = 64
const registryByLane = new Map<string, CachePrefixRegistryEntry>()
const statsByLane = new Map<string, CachePrefixRegistryLaneStatsState>()

function normalizeQueryLane(querySource: string): string {
  if (querySource === 'compact' || querySource === 'sdk' || querySource.startsWith('repl_main_thread')) {
    return 'mainline'
  }
  if (querySource.startsWith('agent:')) {
    return 'agent'
  }
  if (querySource.includes('review')) return 'review'
  if (querySource.includes('planning')) return 'planning'
  if (querySource.includes('recovery')) return 'recovery'
  return querySource || 'unknown'
}

function trimRegistry(): void {
  while (registryByLane.size > MAX_REGISTRY_ENTRIES) {
    let oldestKey: string | undefined
    let oldestTime = Number.POSITIVE_INFINITY
    for (const [key, value] of registryByLane) {
      if (value.updatedAt < oldestTime) {
        oldestTime = value.updatedAt
        oldestKey = key
      }
    }
    if (!oldestKey) return
    registryByLane.delete(oldestKey)
  }
}

function classifyStatus(
  previous: CachePrefixRegistryEntry | undefined,
  next: CachePrefixRegistryEntry,
): CachePrefixRegistryStatus {
  if (!previous) return 'CACHE_PREFIX_REGISTRY_REGISTERED'
  if (
    previous.querySource !== next.querySource ||
    previous.workflowKind !== next.workflowKind
  ) {
    return 'CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED'
  }
  if (
    previous.cacheEpochHash &&
    next.cacheEpochHash &&
    previous.cacheEpochHash !== next.cacheEpochHash
  ) {
    return 'CACHE_PREFIX_REGISTRY_EPOCH_CHANGED'
  }
  if (previous.model !== next.model) return 'CACHE_PREFIX_REGISTRY_MODEL_CHANGED'
  return 'CACHE_PREFIX_REGISTRY_STABLE'
}

function recommendationFor(status: CachePrefixRegistryStatus): string {
  switch (status) {
    case 'CACHE_PREFIX_REGISTRY_SOURCE_INTERLEAVED':
      return 'track lane-level hit rate and source mix first; do not force-merge querySource lanes without replay evidence'
    case 'CACHE_PREFIX_REGISTRY_EPOCH_CHANGED':
      return 'explain cache epoch drift with tool/schema/source change evidence before claiming cache-hit improvement'
    case 'CACHE_PREFIX_REGISTRY_MODEL_CHANGED':
      return 'prefer session-sticky routing only after quality evidence proves the model switch is unnecessary'
    default:
      return 'no cache-prefix registry action required'
  }
}

function updateLaneStats(
  next: CachePrefixRegistryEntry,
  status: CachePrefixRegistryStatus,
  recommendation: string,
): void {
  const current = statsByLane.get(next.lane) ?? {
    lane: next.lane,
    sampleCount: 0,
    statusCounts: {},
    querySources: new Set<string>(),
    workflowKinds: new Set<string>(),
    models: new Set<string>(),
    latestStatus: status,
    latestRecommendation: recommendation,
  }
  current.sampleCount += 1
  current.statusCounts[status] = (current.statusCounts[status] ?? 0) + 1
  current.querySources.add(next.querySource)
  current.workflowKinds.add(next.workflowKind)
  current.models.add(next.model)
  current.latestStatus = status
  current.latestRecommendation = recommendation
  statsByLane.set(next.lane, current)
}

export function recordCachePrefixRegistry(input: {
  querySource: string
  workflowKind?: string
  model: string
  stablePrefixHash?: string
  toolSchemaHash?: string
  cacheEpochHash?: string
  lane?: string
}): CachePrefixRegistryEvent {
  const lane = input.lane ?? normalizeQueryLane(input.querySource)
  const next: CachePrefixRegistryEntry = {
    lane,
    querySource: input.querySource || 'unknown',
    workflowKind: input.workflowKind || 'generic_chat',
    model: input.model,
    stablePrefixHash: input.stablePrefixHash,
    toolSchemaHash: input.toolSchemaHash,
    cacheEpochHash: input.cacheEpochHash,
    updatedAt: Date.now(),
  }
  const previous = registryByLane.get(lane)
  const status = classifyStatus(previous, next)
  const recommendation = recommendationFor(status)
  registryByLane.set(lane, next)
  updateLaneStats(next, status, recommendation)
  trimRegistry()
  return {
    schemaVersion: 'dsxu.cache-prefix-registry.v1',
    status,
    lane,
    querySource: next.querySource,
    workflowKind: next.workflowKind,
    model: next.model,
    stablePrefixHash: next.stablePrefixHash,
    toolSchemaHash: next.toolSchemaHash,
    cacheEpochHash: next.cacheEpochHash,
    previousQuerySource: previous?.querySource,
    previousWorkflowKind: previous?.workflowKind,
    previousModel: previous?.model,
    previousCacheEpochHash: previous?.cacheEpochHash,
    recommendation,
    performanceBoundary:
      'registry-only evidence; no provider call, no synchronous warmup, no tool/model turn added',
  }
}

export function getCachePrefixRegistryLaneStats(): CachePrefixRegistryLaneStats[] {
  return [...statsByLane.values()]
    .sort((a, b) => a.lane.localeCompare(b.lane))
    .map(stats => ({
      schemaVersion: 'dsxu.cache-prefix-registry-lane-stats.v1',
      lane: stats.lane,
      sampleCount: stats.sampleCount,
      statusCounts: { ...stats.statusCounts },
      querySources: [...stats.querySources].sort(),
      workflowKinds: [...stats.workflowKinds].sort(),
      models: [...stats.models].sort(),
      latestStatus: stats.latestStatus,
      latestRecommendation: stats.latestRecommendation,
      performanceBoundary:
        'lane-level registry statistics only; no provider call, no forced querySource merge, no synchronous warmup',
    }))
}

export function getCachePrefixRegistrySnapshot(): CachePrefixRegistryEvent[] {
  return [...registryByLane.values()].map(entry => ({
    schemaVersion: 'dsxu.cache-prefix-registry.v1',
    status: 'CACHE_PREFIX_REGISTRY_STABLE',
    lane: entry.lane,
    querySource: entry.querySource,
    workflowKind: entry.workflowKind,
    model: entry.model,
    stablePrefixHash: entry.stablePrefixHash,
    toolSchemaHash: entry.toolSchemaHash,
    cacheEpochHash: entry.cacheEpochHash,
    recommendation: 'snapshot only',
    performanceBoundary:
      'registry-only evidence; no provider call, no synchronous warmup, no tool/model turn added',
  }))
}

export function resetCachePrefixRegistry(): void {
  registryByLane.clear()
  statsByLane.clear()
}
