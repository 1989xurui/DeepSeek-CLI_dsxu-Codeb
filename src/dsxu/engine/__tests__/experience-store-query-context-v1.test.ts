import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import {
  buildDsxuExperienceInjection,
  createDsxuExperienceStore,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
} from '../experience-store'
import {
  buildDSXUExperienceContextPack,
  createDSXUQueryPromptMainlineBundle,
} from '../query-context-builder-v1'
import { createDSXUPromptContextMainlineRuntime } from '../runtime-core'
import { ExperienceStore, injectExperienceContext } from '../../../services/experience'

const sourcePath = 'D:/repo/src/cart.ts'

const successFix: DsxuExperienceEntry = {
  id: 'exp-context-success-fix',
  kind: 'success_fix',
  title: 'Clamp cart total',
  content: 'Use Math.max(0, price * qty - discount), then run the focused cart test.',
  sourcePath: '.dsxu/trace/context-success-fix.json',
  createdAt: '2026-05-06T01:00:00.000Z',
  confidence: 0.95,
  deletablePath: '.dsxu/memory/exp-context-success-fix.json',
  relatedFiles: [sourcePath],
  outcome: 'passed',
  tags: ['cart', 'discount', 'focused-test'],
}

describe('ExperienceStore query context integration V1', () => {
  test('injects bounded read-only memory through the single query context bundle', () => {
    const store = createDsxuExperienceStore()
    expect(recordDsxuExperience(store, successFix).accepted).toBe(true)

    const recalls = recallDsxuExperience({
      store,
      query: 'fix cart discount bug',
      currentSourceFiles: [sourcePath],
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath],
    })
    const pack = buildDSXUExperienceContextPack({ injection, maxRenderedChars: 1200 })
    const bundle = createDSXUQueryPromptMainlineBundle({
      taskId: 'task-context-experience',
      query: 'fix cart discount bug',
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'fix cart discount bug' }],
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      autoCompactEnabled: true,
      promptLayers: {
        identity: ['DSXU query context test'],
        capability: ['Use tools with verification evidence.'],
        context: ['Current task source is src/cart.ts.'],
        constraint: ['Do not edit from memory without rereading source truth.'],
      },
      experienceStore: { injection, maxRenderedChars: 1200 },
    })

    expect(pack.injectIntoPrompt).toBe(true)
    expect(pack.evidence.policy).toBe('read-only-memory-hint')
    expect(pack.evidence.sourceTruthRefreshRequired).toBe(true)
    expect(pack.evidence.rereadFiles).toEqual([sourcePath])
    expect(injection.memory.entries[0]?.kind).toBe('evidence_index')
    expect(bundle.evidence.experienceStoreInjected).toBe(true)
    expect(bundle.evidence.experienceStoreRequiresSourceRefresh).toBe(true)
    expect(bundle.evidence.experienceStoreTokenEstimate).toBeGreaterThan(0)
    expect(bundle.mergedPrompt.merged).toContain('ExperienceStore Injection (read-only)')
    expect(bundle.mergedPrompt.merged).toContain('current source files win')
    expect(bundle.analysis.categories.find(category => category.name === 'memory')?.tokens).toBeGreaterThan(0)
  })

  test('skips empty memory instead of adding noisy prompt text', () => {
    const emptyPack = buildDSXUExperienceContextPack({ injection: null })

    expect(emptyPack.injectIntoPrompt).toBe(false)
    expect(emptyPack.tokenEstimate).toBe(0)
    expect(emptyPack.warnings).toContain('experience-store-empty')
  })

  test('passes read-only ExperienceStore evidence through the runtime query loop boundary', () => {
    const store = createDsxuExperienceStore()
    expect(recordDsxuExperience(store, successFix).accepted).toBe(true)
    const recalls = recallDsxuExperience({
      store,
      query: 'resume cart discount bugfix after compact',
      currentSourceFiles: [sourcePath],
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath],
    })
    const runtime = createDSXUPromptContextMainlineRuntime()

    const bundle = runtime.createBundle({
      taskId: 'task-context-experience-runtime',
      query: 'resume cart discount bugfix after compact',
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'resume cart discount bugfix after compact' }],
      usage: {
        input_tokens: 120,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      autoCompactEnabled: true,
      promptLayers: {
        identity: ['DSXU runtime context test'],
        capability: ['Use current source truth and focused verification.'],
        context: ['Current task source is src/cart.ts.'],
        constraint: ['Memory is a hint only; reread before editing.'],
      },
      experienceStore: { injection, maxRenderedChars: 1200 },
    })

    expect(bundle.evidence.experienceStoreInjected).toBe(true)
    expect(bundle.evidence.experienceStoreRequiresSourceRefresh).toBe(true)
    expect(bundle.evidence.experienceStoreSuccessfulFix).toBe(true)
    expect(bundle.experienceContext.evidence.policy).toBe('read-only-memory-hint')
    expect(bundle.experienceContext.rendered).toContain('ExperienceStore Injection (read-only)')
    expect(bundle.experienceContext.rendered).toContain('sourceTruthRefreshRequired: yes')
    expect(bundle.mergedPrompt.merged).toContain('Memory is a hint only')
    expect(bundle.mergedPrompt.merged).toContain('current source files win')
    expect(bundle.queryLoopState.contextUsedPercent).toBeGreaterThanOrEqual(0)
    expect(bundle.sessionState.contextWindowSize).toBeGreaterThan(0)
  })

  test('keeps legacy services self-RAG out of the default query context path', () => {
    const mainlineFiles = [
      'src/query.ts',
      'src/screens/REPL.tsx',
      'src/dsxu/engine/runtime-core.ts',
      'src/dsxu/engine/query-context-builder-v1.ts',
    ]

    for (const file of mainlineFiles) {
      const text = readFileSync(file, 'utf8')
      expect(text).not.toContain("services/experience")
      expect(text).not.toContain("injectExperienceContext")
    }
  })

  test('legacy services self-RAG output is bounded, readable, and source-truth guarded', async () => {
    const legacyStore = new ExperienceStore()
    await legacyStore.init()
    await legacyStore.add({
      ts: Date.now(),
      taskId: 'legacy-experience-compat',
      taskDescription: 'Fix cart discount bug',
      taskType: 'debugging',
      plan: 'Reread cart.ts and run the focused cart test.',
      patches: [{ file: 'cart.ts', diff: '+ clamp total' }],
      testResults: [{ name: 'cart focused test', result: 'pass' }],
      staticIssues: 0,
      criticVerdict: 'pass',
      finalScore: 0.9,
      durationMs: 1000,
      tokensUsed: 500,
      outcome: 'success',
    })

    const prompt = await injectExperienceContext(legacyStore, 'cart discount', 'Base prompt')

    expect(prompt).toContain('ExperienceStore Context')
    expect(prompt).toContain('read-only')
    expect(prompt).toContain('Current source files, tests, and tool output always win')
    expect(prompt).toContain('Reread current source truth before editing')
    expect(prompt).not.toMatch(/[\uFFFD\u951F\u9225]/)
    expect(prompt).not.toContain('{record.')
    expect(prompt).not.toContain('{label}')
  })
})
