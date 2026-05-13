import { describe, expect, test } from 'bun:test'
import {
  buildDsxuLocalMemoryReadOnlyBundle,
  buildDsxuSmoothResumePlan,
  createDsxuTaskStateSnapshot,
  renderDsxuTaskStateSnapshotForResume,
  type DsxuLocalMemoryEntry,
} from '../task-governance'

const baseMemory: DsxuLocalMemoryEntry = {
  id: 'mem-project-stack',
  kind: 'project_fact',
  title: 'Vite app entrypoints',
  content: 'The app uses src/App.tsx and src/main.tsx as primary source entrypoints.',
  sourcePath: '.dsxu/memory/project-stack.json',
  createdAt: '2026-05-06T00:00:00.000Z',
  confidence: 0.91,
  deletablePath: '.dsxu/memory/project-stack.json',
  relatedFiles: ['src/App.tsx', 'src/main.tsx'],
}

describe('DSXU LocalMemory Lite read-only resume', () => {
  test('filters unsafe memory entries and keeps source/time/confidence/delete evidence mandatory', () => {
    const bundle = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [
        baseMemory,
        { ...baseMemory, id: 'mem-low', confidence: 0.2 },
        { id: 'mem-missing-source', kind: 'task_snapshot', title: 'bad', content: 'bad', confidence: 0.9 },
      ],
      currentSourceFiles: [],
    })

    expect(bundle.entries.map(entry => entry.id)).toEqual(['mem-project-stack'])
    expect(bundle.warnings).toContain('low-confidence-memory:mem-low')
    expect(bundle.warnings).toContain('invalid-memory-entry:mem-missing-source')
    expect(bundle.rendered).toContain('memory is hint-only')
    expect(bundle.rendered).toContain('sourceTruthRefreshRequired: no')
  })

  test('forces reread when memory overlaps current source truth', () => {
    const bundle = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [baseMemory],
      currentSourceFiles: ['src/App.tsx'],
    })

    expect(bundle.sourceTruthRefreshRequired).toBe(true)
    expect(bundle.rereadFiles).toEqual(['src/App.tsx'])
    expect(bundle.rendered).toContain('reread-source-before-use')
    expect(bundle.rendered).toContain('current source files win')
  })

  test('smooth resume puts source reads and failed verification before continuation', () => {
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'Continue the interrupted feature.',
      scope: 'src only',
      filesRead: ['src/App.tsx'],
      filesChanged: ['src/App.tsx'],
      failedCommands: ['bun test src/app.test.ts'],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: ['finish route state fix'],
      workflowPreferencesApplied: [],
      nextAction: 'repair one hypothesis then verify',
      verificationStatus: 'failed',
      createdAt: '2026-05-06T00:05:00.000Z',
    })
    const memory = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [baseMemory],
      currentSourceFiles: ['src/App.tsx'],
    })
    const plan = buildDsxuSmoothResumePlan({ snapshot, memory })

    expect(plan.mayEditFromMemory).toBe(false)
    expect(plan.mayClaimPass).toBe(false)
    expect(plan.actions[0]).toContain('Read latest source truth for src/App.tsx')
    expect(plan.rendered).toContain('Repair or rerun failed verification')
    expect(renderDsxuTaskStateSnapshotForResume(snapshot)).toContain('Reread source truth')
  })

  test('passed snapshot cannot claim PASS when memory says touched source must be refreshed', () => {
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'Resume after compact.',
      scope: 'src only',
      filesRead: ['src/main.tsx'],
      filesChanged: ['src/App.tsx'],
      lastPassingCommand: 'bun test',
      failedCommands: [],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: [],
      workflowPreferencesApplied: [],
      nextAction: 'final answer with evidence',
      verificationStatus: 'passed',
      createdAt: '2026-05-06T00:10:00.000Z',
    })
    const staleMemory = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [baseMemory],
      currentSourceFiles: ['src/App.tsx'],
    })

    const plan = buildDsxuSmoothResumePlan({ snapshot, memory: staleMemory })

    expect(plan.mayClaimPass).toBe(false)
    expect(plan.rendered).toContain('no')
  })

  test('verified local memory narrows exploration without replacing source evidence', () => {
    const verificationMemory: DsxuLocalMemoryEntry = {
      ...baseMemory,
      id: 'mem-verify',
      kind: 'verification_command',
      title: 'Focused app verification',
      content: 'Use bun test src/dsxu/engine/__tests__/local-memory-lite-v1.test.ts for this resume path.',
      relatedFiles: ['src/dsxu/engine/task-governance.ts'],
    }
    const bundle = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [verificationMemory],
      currentSourceFiles: ['src/dsxu/engine/task-governance.ts'],
    })

    expect(bundle.rendered).toContain('verification_command')
    expect(bundle.rendered).not.toContain('broad grep')
    expect(bundle.sourceTruthRefreshRequired).toBe(true)
  })
})
