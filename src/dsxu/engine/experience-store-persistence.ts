import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs'
import { dirname, join, normalize, resolve, sep } from 'path'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperienceReplayReport,
  buildDsxuExperienceSmoothResume,
  createDsxuExperienceStore,
  deleteDsxuExperience,
  explainDsxuExperienceRecall,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceRecall,
  type DsxuExperienceReplayMetrics,
  type DsxuExperienceReplayReport,
  type DsxuExperienceStore,
} from './experience-store'
import type {
  DsxuSmoothResumePlan,
  DsxuTaskStateSnapshotPromptState,
} from './task-governance'

export type DsxuPersistedExperienceStoreState = {
  schemaVersion: 1
  savedAt: string
  entries: readonly DsxuExperienceEntry[]
  tombstones: readonly DsxuExperienceStore['tombstones']
}

export type DsxuExperienceStorePersistencePaths = {
  memoryRoot: string
  storePath: string
  entriesDir: string
}

export type DsxuExperienceStoreLoadResult = {
  store: DsxuExperienceStore
  paths: DsxuExperienceStorePersistencePaths
  loadedEntries: number
  rejected: readonly { id: string; reason: string }[]
  createdEmpty: boolean
}

export type DsxuExperienceStoreSaveResult = {
  paths: DsxuExperienceStorePersistencePaths
  savedEntries: number
  savedAt: string
  entryFiles: readonly string[]
}

export type DsxuExperienceStoreDeleteResult = {
  deleted: boolean
  reason: string
  store: DsxuExperienceStore
  paths: DsxuExperienceStorePersistencePaths
}

export type DsxuExperienceStorePersistentReplayResult = {
  status: 'DONE_EVIDENCED' | 'PARTIAL'
  evidencePath: string
  paths: DsxuExperienceStorePersistencePaths
  savedEntries: number
  loadedEntries: number
  recallIds: readonly string[]
  explanation: string
  deleteResult: {
    id: string
    deleted: boolean
    reason: string
    tombstoneCount: number
  }
  reloadAfterDelete: {
    loadedEntries: number
    recallIds: readonly string[]
  }
  benchmarkLeakDetected: boolean
  rejected: readonly { id: string; reason: string }[]
}

export type DsxuExperienceStorePersistentSmoothResumeResult = {
  status: 'DONE_EVIDENCED' | 'PARTIAL'
  evidencePath: string
  paths: DsxuExperienceStorePersistencePaths
  loadedEntries: number
  rejected: readonly { id: string; reason: string }[]
  recallIds: readonly string[]
  sourceTruthRefreshRequired: boolean
  mayClaimPass: boolean
  resumePlan: DsxuSmoothResumePlan
  replayReport: DsxuExperienceReplayReport
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  writeFileSync(tempPath, stableJson(value), 'utf8')
  renameSync(tempPath, path)
}

function sanitizeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'entry'
}

function assertInside(parent: string, child: string): void {
  const parentPath = resolve(parent)
  const childPath = resolve(child)
  const withSep = parentPath.endsWith(sep) ? parentPath : `${parentPath}${sep}`
  if (childPath !== parentPath && !childPath.startsWith(withSep)) {
    throw new Error(`ExperienceStore path escapes memory root: ${child}`)
  }
}

export function resolveDsxuExperienceStorePersistencePaths(input: {
  memoryRoot: string
  storeFileName?: string
}): DsxuExperienceStorePersistencePaths {
  const memoryRoot = normalize(resolve(input.memoryRoot))
  const storePath = join(memoryRoot, input.storeFileName ?? 'experience-store.json')
  const entriesDir = join(memoryRoot, 'entries')
  assertInside(memoryRoot, storePath)
  assertInside(memoryRoot, entriesDir)
  return { memoryRoot, storePath, entriesDir }
}

export function loadDsxuExperienceStoreFromDisk(input: {
  memoryRoot: string
  storeFileName?: string
}): DsxuExperienceStoreLoadResult {
  const paths = resolveDsxuExperienceStorePersistencePaths(input)
  if (!existsSync(paths.storePath)) {
    return {
      store: createDsxuExperienceStore(),
      paths,
      loadedEntries: 0,
      rejected: [],
      createdEmpty: true,
    }
  }

  const parsed = JSON.parse(readFileSync(paths.storePath, 'utf8')) as Partial<DsxuPersistedExperienceStoreState>
  const store: DsxuExperienceStore = {
    entries: [],
    tombstones: [...(parsed.tombstones ?? [])],
  }
  const rejected: { id: string; reason: string }[] = []
  for (const entry of parsed.entries ?? []) {
    const result = recordDsxuExperience(store, entry)
    if (!result.accepted) {
      rejected.push({ id: entry.id || 'missing-id', reason: result.reason })
    }
  }

  return {
    store,
    paths,
    loadedEntries: store.entries.length,
    rejected,
    createdEmpty: false,
  }
}

export function saveDsxuExperienceStoreToDisk(input: {
  store: DsxuExperienceStore
  memoryRoot: string
  storeFileName?: string
  savedAt?: string
}): DsxuExperienceStoreSaveResult {
  const paths = resolveDsxuExperienceStorePersistencePaths(input)
  const savedAt = input.savedAt ?? new Date().toISOString()
  mkdirSync(paths.entriesDir, { recursive: true })

  const state: DsxuPersistedExperienceStoreState = {
    schemaVersion: 1,
    savedAt,
    entries: input.store.entries,
    tombstones: input.store.tombstones,
  }
  writeJsonAtomic(paths.storePath, state)

  const entryFiles = input.store.entries.map(entry => {
    const entryPath = join(paths.entriesDir, `${sanitizeFileName(entry.id)}.json`)
    assertInside(paths.entriesDir, entryPath)
    writeJsonAtomic(entryPath, entry)
    return entryPath
  })

  return {
    paths,
    savedEntries: input.store.entries.length,
    savedAt,
    entryFiles,
  }
}

export function deleteDsxuExperienceFromDisk(input: {
  id: string
  memoryRoot: string
  storeFileName?: string
  deletedAt?: string
}): DsxuExperienceStoreDeleteResult {
  const load = loadDsxuExperienceStoreFromDisk(input)
  const result = deleteDsxuExperience(load.store, input.id, input.deletedAt)
  saveDsxuExperienceStoreToDisk({
    store: load.store,
    memoryRoot: input.memoryRoot,
    storeFileName: input.storeFileName,
    savedAt: input.deletedAt,
  })
  return {
    deleted: result.deleted,
    reason: result.reason,
    store: load.store,
    paths: load.paths,
  }
}

export function runDsxuExperienceStorePersistentReplay(input: {
  memoryRoot: string
  evidencePath: string
  entries: readonly DsxuExperienceEntry[]
  query: string
  currentSourceFiles: readonly string[]
  deleteId: string
  savedAt?: string
}): DsxuExperienceStorePersistentReplayResult {
  const store = createDsxuExperienceStore(input.entries)
  const save = saveDsxuExperienceStoreToDisk({
    store,
    memoryRoot: input.memoryRoot,
    savedAt: input.savedAt,
  })
  const loaded = loadDsxuExperienceStoreFromDisk({
    memoryRoot: input.memoryRoot,
  })
  const recalls = recallDsxuExperience({
    store: loaded.store,
    query: input.query,
    currentSourceFiles: input.currentSourceFiles,
  })
  const explanation = explainDsxuExperienceRecall(recalls)
  const deleted = deleteDsxuExperienceFromDisk({
    id: input.deleteId,
    memoryRoot: input.memoryRoot,
    deletedAt: input.savedAt,
  })
  const reloadAfterDelete = loadDsxuExperienceStoreFromDisk({
    memoryRoot: input.memoryRoot,
  })
  const recallsAfterDelete = recallDsxuExperience({
    store: reloadAfterDelete.store,
    query: input.query,
    currentSourceFiles: input.currentSourceFiles,
  })
  const benchmarkLeakDetected = [...loaded.store.entries, ...reloadAfterDelete.store.entries].some(entry =>
    /\bDSXU_BENCH_[A-Z0-9_]+_PASS\b|\bDSXU_SCORE_[A-Z0-9_]+_PASS\b/i.test(
      `${entry.id}\n${entry.title}\n${entry.content}`,
    ),
  )
  const status =
    save.savedEntries === input.entries.length &&
    loaded.loadedEntries === input.entries.length &&
    recalls.length > 0 &&
    deleted.deleted &&
    !recallsAfterDelete.some(recall => recall.entry.id === input.deleteId) &&
    !benchmarkLeakDetected &&
    loaded.rejected.length === 0
      ? 'DONE_EVIDENCED'
      : 'PARTIAL'
  const result: DsxuExperienceStorePersistentReplayResult = {
    status,
    evidencePath: input.evidencePath,
    paths: save.paths,
    savedEntries: save.savedEntries,
    loadedEntries: loaded.loadedEntries,
    recallIds: recalls.map(recall => recall.entry.id),
    explanation,
    deleteResult: {
      id: input.deleteId,
      deleted: deleted.deleted,
      reason: deleted.reason,
      tombstoneCount: deleted.store.tombstones.length,
    },
    reloadAfterDelete: {
      loadedEntries: reloadAfterDelete.loadedEntries,
      recallIds: recallsAfterDelete.map((recall: DsxuExperienceRecall) => recall.entry.id),
    },
    benchmarkLeakDetected,
    rejected: loaded.rejected,
  }
  writeJsonAtomic(input.evidencePath, result)
  return result
}

export function runDsxuExperienceStorePersistentSmoothResume(input: {
  memoryRoot: string
  evidencePath: string
  query: string
  currentSourceFiles: readonly string[]
  snapshot: DsxuTaskStateSnapshotPromptState
  coldMetrics: DsxuExperienceReplayMetrics
  warmMetrics?: DsxuExperienceReplayMetrics
}): DsxuExperienceStorePersistentSmoothResumeResult {
  const loaded = loadDsxuExperienceStoreFromDisk({
    memoryRoot: input.memoryRoot,
  })
  const recalls = recallDsxuExperience({
    store: loaded.store,
    query: input.query,
    currentSourceFiles: input.currentSourceFiles,
  })
  const injection = buildDsxuExperienceInjection({
    recalls,
    currentSourceFiles: input.currentSourceFiles,
  })
  const resumePlan = buildDsxuExperienceSmoothResume({
    snapshot: input.snapshot,
    injection,
  })
  const warmReadCalls = Math.max(1, injection.memory.rereadFiles.length)
  const warmMetrics = input.warmMetrics ?? {
    toolCalls: warmReadCalls + 2,
    readCalls: warmReadCalls,
    verificationRuns: Math.min(Math.max(1, input.coldMetrics.verificationRuns), 1),
    estimatedTokens: Math.max(1, Math.round(input.coldMetrics.estimatedTokens * 0.45)),
  }
  const replayReport = buildDsxuExperienceReplayReport({
    cold: input.coldMetrics,
    warm: warmMetrics,
    planning: injection.planning,
  })
  const status =
    loaded.loadedEntries > 0 &&
    loaded.rejected.length === 0 &&
    recalls.length > 0 &&
    injection.memory.sourceTruthRefreshRequired &&
    resumePlan.mayClaimPass === false &&
    replayReport.repeatedExplorationReduced
      ? 'DONE_EVIDENCED'
      : 'PARTIAL'
  const result: DsxuExperienceStorePersistentSmoothResumeResult = {
    status,
    evidencePath: input.evidencePath,
    paths: loaded.paths,
    loadedEntries: loaded.loadedEntries,
    rejected: loaded.rejected,
    recallIds: recalls.map(recall => recall.entry.id),
    sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
    mayClaimPass: resumePlan.mayClaimPass,
    resumePlan,
    replayReport,
  }
  writeJsonAtomic(input.evidencePath, result)
  return result
}
