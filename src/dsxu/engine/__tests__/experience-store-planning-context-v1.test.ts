import { describe, expect, test } from 'bun:test'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperiencePlanningContext,
  createDsxuExperienceStore,
  recallDsxuExperience,
  recordDsxuExperience,
  type DsxuExperienceEntry,
} from '../experience-store'
import {
  buildDSXUExperienceContextPack,
  createDSXUQueryPromptMainlineBundle,
} from '../query-context-builder-v1'

const sourcePath = 'D:/repo/src/retry.ts'
const testPath = 'D:/repo/src/retry.test.ts'
const evidencePath = '.dsxu/trace/v18-experience-store/retry.evidence.json'
const tracePath = '.dsxu/trace/v18-experience-store/retry.trace.json'

const entries: DsxuExperienceEntry[] = [
  {
    id: 'exp-retry-project-fact',
    kind: 'project_fact',
    title: 'Retry focused files',
    content: 'The retry delay task is contained in retry.ts and retry.test.ts.',
    sourcePath: evidencePath,
    createdAt: '2026-05-06T02:00:00.000Z',
    confidence: 0.9,
    deletablePath: '.dsxu/memory/exp-retry-project-fact.json',
    relatedFiles: [sourcePath, testPath],
    tags: ['retry', 'focused-files'],
  },
  {
    id: 'exp-retry-linear-failed',
    kind: 'failure_pattern',
    title: 'Linear retry fix failed',
    content: 'A linear attempt * 100 patch already failed. Change strategy to capped exponential delay before rerunning verification.',
    sourcePath: evidencePath,
    createdAt: '2026-05-06T02:01:00.000Z',
    confidence: 0.96,
    deletablePath: '.dsxu/memory/exp-retry-linear-failed.json',
    relatedFiles: [sourcePath, testPath],
    outcome: 'failed',
    tags: ['retry', 'failed-verification', 'strategy-change'],
  },
  {
    id: 'exp-retry-exponential-success',
    kind: 'success_fix',
    title: 'Capped exponential retry delay',
    content: 'Use Math.min(1000, 100 * 2 ** attempt) after rereading retry.ts.',
    sourcePath: evidencePath,
    createdAt: '2026-05-06T02:02:00.000Z',
    confidence: 0.97,
    deletablePath: '.dsxu/memory/exp-retry-exponential-success.json',
    relatedFiles: [sourcePath],
    outcome: 'passed',
    tags: ['retry', 'success-fix'],
    usage: {
      model: 'deepseek-v4-pro',
      routeReason: 'failed_verification_pro_thinking_max',
      modelEvidence: 'DSXU model evidence: recovery routed to Pro.',
      toolCalls: 8,
      tracePath,
    },
  },
  {
    id: 'exp-retry-focused-verify',
    kind: 'verification_command',
    title: 'Retry focused verification',
    content: `Run bun test ${testPath}; inspect assertion output before repeating a failed command.`,
    sourcePath: evidencePath,
    createdAt: '2026-05-06T02:03:00.000Z',
    confidence: 0.94,
    deletablePath: '.dsxu/memory/exp-retry-focused-verify.json',
    relatedFiles: [testPath],
    tags: ['retry', 'bun-test'],
  },
]

describe('ExperienceStore planning context V1', () => {
  test('turns memory into bounded read-only planning lanes without replacing source truth', () => {
    const store = createDsxuExperienceStore()
    for (const entry of entries) {
      expect(recordDsxuExperience(store, entry).accepted).toBe(true)
    }

    const recalls = recallDsxuExperience({
      store,
      query: 'recover retry failed verification with capped exponential strategy and focused test',
      currentSourceFiles: [sourcePath, testPath],
      maxEntries: 4,
    })
    const injection = buildDsxuExperienceInjection({
      recalls,
      currentSourceFiles: [sourcePath, testPath],
    })
    const planning = buildDsxuExperiencePlanningContext({
      recalls,
      memory: injection.memory,
      maxContentChars: 220,
    })
    const pack = buildDSXUExperienceContextPack({ injection, maxRenderedChars: 5000 })
    const bundle = createDSXUQueryPromptMainlineBundle({
      taskId: 'task-retry-planning-context',
      query: 'recover retry failed verification with capped exponential strategy and focused test',
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'recover retry failed verification' }],
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      autoCompactEnabled: true,
      promptLayers: {
        identity: ['DSXU planning context test'],
        capability: ['Use focused verification evidence.'],
        context: ['Current source is retry.ts.'],
        constraint: ['Memory is read-only and source truth must be reread.'],
      },
      experienceStore: { injection, maxRenderedChars: 5000 },
    })

    expect(planning.evidence).toMatchObject({
      itemCount: 4,
      hasActionableVerification: true,
      hasFailureAvoidance: true,
      hasSuccessfulFix: true,
      hasTraceIndex: true,
      sourceTruthRefreshRequired: true,
    })
    expect(planning.sourceRefreshFiles).toEqual([sourcePath, testPath])
    expect(planning.failedStrategyIds).toContain('exp-retry-linear-failed')
    expect(planning.successFixIds).toContain('exp-retry-exponential-success')
    expect(planning.verificationCommands.join('\n')).toContain('bun test')
    expect(planning.rendered).toContain('ExperienceStore Planning Pack (read-only)')
    expect(planning.rendered).toContain('avoid repeated failed strategy')
    expect(planning.rendered).toContain('focused verification')
    expect(planning.rendered).toContain('read current source truth before Edit')
    expect(planning.rendered).not.toMatch(/[\uFFFD\u951F\u9225]/)

    expect(pack.evidence.planningItemCount).toBe(4)
    expect(pack.evidence.verificationCommandCount).toBeGreaterThanOrEqual(1)
    expect(pack.evidence.hasFailureAvoidance).toBe(true)
    expect(pack.evidence.hasSuccessfulFix).toBe(true)
    expect(bundle.evidence.experienceStorePlanningItems).toBe(4)
    expect(bundle.evidence.experienceStoreVerificationCommands).toBeGreaterThanOrEqual(1)
    expect(bundle.evidence.experienceStoreFailureAvoidance).toBe(true)
    expect(bundle.evidence.experienceStoreSuccessfulFix).toBe(true)
    expect(bundle.mergedPrompt.merged).toContain('ExperienceStore Planning Pack (read-only)')
    expect(bundle.mergedPrompt.merged).toContain('current source files win and verification output is the truth')
  })
})
