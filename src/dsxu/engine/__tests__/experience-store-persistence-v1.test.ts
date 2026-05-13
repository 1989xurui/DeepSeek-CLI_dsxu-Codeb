import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  deleteDsxuExperienceFromDisk,
  loadDsxuExperienceStoreFromDisk,
  runDsxuExperienceStorePersistentReplay,
  runDsxuExperienceStorePersistentSmoothResume,
  saveDsxuExperienceStoreToDisk,
} from '../experience-store-persistence'
import {
  createDsxuExperienceStore,
  recallDsxuExperience,
  type DsxuExperienceEntry,
} from '../experience-store'
import { createDsxuTaskStateSnapshot } from '../task-governance'

const createdAt = '2026-05-07T10:00:00.000Z'

function entry(input: Partial<DsxuExperienceEntry> & Pick<DsxuExperienceEntry, 'id' | 'kind'>): DsxuExperienceEntry {
  return {
    title: `Experience ${input.id}`,
    content: 'Fix html escaping by rereading src/html.js and running bun test after the focused edit.',
    sourcePath: '.dsxu/trace/live/source.json',
    createdAt,
    confidence: 0.9,
    deletablePath: `.dsxu/memory/${input.id}.json`,
    relatedFiles: ['src/html.js', 'test/html.test.js'],
    outcome: 'passed',
    ...input,
  }
}

describe('ExperienceStore persistence V1', () => {
  test('persists, reloads, recalls, explains, deletes, and tombstones entries', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-experience-persist-'))
    try {
      const store = createDsxuExperienceStore([
        entry({ id: 'persist-success-fix', kind: 'success_fix' }),
        entry({
          id: 'persist-verification',
          kind: 'verification_command',
          content: 'Run bun test from the current project root after replacing temporary fixture paths.',
        }),
      ])
      const save = saveDsxuExperienceStoreToDisk({ store, memoryRoot: dir, savedAt: createdAt })
      expect(save.savedEntries).toBe(2)
      expect(existsSync(save.paths.storePath)).toBe(true)
      expect(save.entryFiles.every(path => existsSync(path))).toBe(true)

      const loaded = loadDsxuExperienceStoreFromDisk({ memoryRoot: dir })
      expect(loaded.createdEmpty).toBe(false)
      expect(loaded.loadedEntries).toBe(2)
      expect(loaded.rejected).toEqual([])

      const recalls = recallDsxuExperience({
        store: loaded.store,
        query: 'html escaping focused verification',
        currentSourceFiles: ['src/html.js'],
      })
      expect(recalls.map(recall => recall.entry.id)).toContain('persist-success-fix')
      expect(recalls[0]?.entry.deletablePath).toContain('.dsxu/memory/')

      const deleted = deleteDsxuExperienceFromDisk({
        id: 'persist-success-fix',
        memoryRoot: dir,
        deletedAt: createdAt,
      })
      expect(deleted.deleted).toBe(true)
      expect(deleted.store.tombstones).toHaveLength(1)

      const reloaded = loadDsxuExperienceStoreFromDisk({ memoryRoot: dir })
      expect(reloaded.store.entries.map(item => item.id)).not.toContain('persist-success-fix')
      expect(reloaded.store.tombstones[0]).toMatchObject({
        id: 'persist-success-fix',
        deletablePath: '.dsxu/memory/persist-success-fix.json',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('rejects benchmark answer leakage while loading persisted memory', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-experience-persist-leak-'))
    try {
      const store = {
        entries: [
          entry({ id: 'safe-fix', kind: 'success_fix' }),
          entry({
            id: 'leaky-fix',
            kind: 'success_fix',
            content: 'DSXU_BENCH_FAKE_PASS should never be loaded into memory.',
          }),
        ],
        tombstones: [],
      }
      saveDsxuExperienceStoreToDisk({ store, memoryRoot: dir, savedAt: createdAt })

      const loaded = loadDsxuExperienceStoreFromDisk({ memoryRoot: dir })
      expect(loaded.loadedEntries).toBe(1)
      expect(loaded.store.entries.map(item => item.id)).toEqual(['safe-fix'])
      expect(loaded.rejected).toEqual([
        { id: 'leaky-fix', reason: 'benchmark-answer-blocked:leaky-fix' },
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('writes a replay evidence artifact for persistent memory product flow', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-experience-persist-replay-'))
    try {
      const evidencePath = join(dir, 'persistent-replay.evidence.json')
      const result = runDsxuExperienceStorePersistentReplay({
        memoryRoot: join(dir, 'memory'),
        evidencePath,
        entries: [
          entry({ id: 'persist-success-fix', kind: 'success_fix' }),
          entry({
            id: 'persist-verification',
            kind: 'verification_command',
            content: 'Run bun test from the current project root after replacing temporary fixture paths.',
          }),
        ],
        query: 'resume html escaping task with verification',
        currentSourceFiles: ['src/html.js', 'test/html.test.js'],
        deleteId: 'persist-success-fix',
        savedAt: createdAt,
      })

      expect(result.status).toBe('DONE_EVIDENCED')
      expect(result.savedEntries).toBe(2)
      expect(result.loadedEntries).toBe(2)
      expect(result.recallIds).toContain('persist-success-fix')
      expect(result.explanation).toContain('deletablePath')
      expect(result.deleteResult).toMatchObject({
        id: 'persist-success-fix',
        deleted: true,
        tombstoneCount: 1,
      })
      expect(result.reloadAfterDelete.recallIds).not.toContain('persist-success-fix')
      expect(result.benchmarkLeakDetected).toBe(false)
      expect(existsSync(evidencePath)).toBe(true)

      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as { status: string }
      expect(evidence.status).toBe('DONE_EVIDENCED')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('uses persisted memory as backing evidence for smooth resume', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-experience-persist-resume-'))
    try {
      const memoryRoot = join(dir, 'memory')
      const store = createDsxuExperienceStore([
        entry({ id: 'persist-success-fix', kind: 'success_fix' }),
        entry({
          id: 'persist-verification',
          kind: 'verification_command',
          content: 'Run bun test from the current project root after replacing temporary fixture paths.',
        }),
      ])
      saveDsxuExperienceStoreToDisk({ store, memoryRoot, savedAt: createdAt })
      const result = runDsxuExperienceStorePersistentSmoothResume({
        memoryRoot,
        evidencePath: join(dir, 'persistent-smooth-resume.evidence.json'),
        query: 'resume html escaping task with focused verification',
        currentSourceFiles: ['src/html.js', 'test/html.test.js'],
        snapshot: createDsxuTaskStateSnapshot({
          goal: 'Resume html escaping task from persistent memory.',
          scope: 'src/html.js',
          filesRead: [],
          filesChanged: ['src/html.js'],
          failedCommands: ['bun test test/html.test.js'],
          permissionDenials: [],
          activeAgents: [],
          pendingTasks: ['reread source truth', 'patch once', 'run focused verification'],
          workflowPreferencesApplied: ['persistent memory is read-only evidence'],
          nextAction: 'Read src/html.js before Edit, then verify.',
          verificationStatus: 'failed',
          createdAt,
        }),
        coldMetrics: {
          toolCalls: 8,
          readCalls: 4,
          verificationRuns: 2,
          estimatedTokens: 20_000,
        },
      })

      expect(result.status).toBe('DONE_EVIDENCED')
      expect(result.loadedEntries).toBe(2)
      expect(result.recallIds).toContain('persist-success-fix')
      expect(result.sourceTruthRefreshRequired).toBe(true)
      expect(result.mayClaimPass).toBe(false)
      expect(result.resumePlan.rendered).toContain('Read latest source truth for src/html.js before any Edit')
      expect(result.replayReport.repeatedExplorationReduced).toBe(true)
      expect(result.replayReport.tokenReductionPct).toBeGreaterThanOrEqual(30)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
