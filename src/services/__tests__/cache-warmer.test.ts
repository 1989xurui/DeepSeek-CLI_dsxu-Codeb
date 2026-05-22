import { describe, expect, test } from 'bun:test'
import {
  CacheWarmer,
  buildCacheWarmPrefixExport,
  cacheWarmPrefixesFromSystemPrompt,
  defaultCacheWarmPrefixes,
  placeholderCacheWarmPrefixes,
} from '../cache-warmer'
import {
  getSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
} from '../../constants/prompts'

describe('DeepSeek cache warmer claim boundary', () => {
  test('defaults to dry-run planning without fake runtime prefixes', async () => {
    let probeCalls = 0
    const warmer = new CacheWarmer(async () => {
      probeCalls += 1
    })

    const result = await warmer.warm({
      model: 'deepseek-v4-flash',
      concurrency: 2,
      prefixes: defaultCacheWarmPrefixes(),
    })

    expect(result.owner).toBe('DeepSeek route/cost/cache')
    expect(result.mode).toBe('planning')
    expect(result.dryRun).toBe(true)
    expect(defaultCacheWarmPrefixes()).toEqual([])
    expect(result.warmedKeys).toBe(0)
    expect(result.failedKeys).toBe(0)
    expect(result.estimatedSavingsUsd).toBe(0)
    expect(result.claimBoundary).toContain('no runtime stable prefix was provided')
    expect(result.claimBoundary).toContain('no provider call')
    expect(result.claimBoundary).toContain('no cache-hit improvement claim')
    expect(probeCalls).toBe(0)
  })

  test('extracts only the stable prompt prefix before the dynamic boundary', async () => {
    const prefixes = cacheWarmPrefixesFromSystemPrompt([
      'static system rules',
      'static tool schemas',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic cwd: D:/DSXU-code',
      'dynamic task snapshot',
    ])
    expect(prefixes).toEqual(['static system rules\n\nstatic tool schemas'])

    const warmer = new CacheWarmer()
    const result = await warmer.warm({
      model: 'deepseek-v4-flash',
      concurrency: 2,
      systemPromptSections: [
        'static system rules',
        'static tool schemas',
        SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
        'dynamic cwd: D:/DSXU-code',
      ],
    })

    expect(result.mode).toBe('planning')
    expect(result.warmedKeys).toBe(1)
    expect(result.warmedPrefixes[0]).toBe('static system rules\n\nstatic tool schemas')
    expect(result.warmedPrefixes[0]).not.toContain('dynamic cwd')
    expect(result.claimBoundary).toContain('runtime stable prefix resolved')
  })

  test('builds an auditable stable prefix export without claiming live cache gains', () => {
    const exportPack = buildCacheWarmPrefixExport({
      model: 'deepseek-v4-flash',
      systemPromptSections: [
        'static system rules',
        'static tool schemas',
        SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
        'dynamic cwd: D:/DSXU-code',
      ],
    })

    expect(exportPack).toMatchObject({
      owner: 'DeepSeek route/cost/cache',
      schemaVersion: 'dsxu.cache-warm-prefix-export.v1',
      model: 'deepseek-v4-flash',
      boundaryFound: true,
      stableBlockCount: 2,
      dynamicBlockCount: 1,
      prefixes: ['static system rules\n\nstatic tool schemas'],
    })
    expect(exportPack.claimBoundary).toContain('before/after provider trajectory')
    expect(exportPack.stablePrefixApproxTokens).toBeGreaterThan(0)
    expect(exportPack.dynamicTailApproxTokens).toBeGreaterThan(0)
  })

  test('blocks prefix export claims when the dynamic boundary is missing', () => {
    const exportPack = buildCacheWarmPrefixExport({
      model: 'deepseek-v4-flash',
      systemPromptSections: ['static-looking section without boundary'],
    })

    expect(exportPack.boundaryFound).toBe(false)
    expect(exportPack.prefixes).toEqual([])
    expect(exportPack.claimBoundary).toContain('SYSTEM_PROMPT_DYNAMIC_BOUNDARY missing')
    expect(exportPack.claimBoundary).toContain('no cache-hit improvement claim')
  })

  test('execute mode requires an explicit probe and remains only execution evidence', async () => {
    const warmer = new CacheWarmer()

    const result = await warmer.warm({
      model: 'deepseek-v4-flash',
      concurrency: 2,
      prefixes: ['stable prefix A', 'stable prefix B'],
      dryRun: false,
    })

    expect(result.mode).toBe('execute')
    expect(result.dryRun).toBe(false)
    expect(result.warmedKeys).toBe(0)
    expect(result.failedKeys).toBe(2)
    expect(result.failedPrefixes[0]?.error).toContain('cache warm probe is not configured')
    expect(result.claimBoundary).toContain('improvement claim requires trajectory before/after evidence')
  })

  test('legacy placeholder prefixes are opt-in and cannot be mistaken for real defaults', () => {
    expect(defaultCacheWarmPrefixes()).toEqual([])
    expect(placeholderCacheWarmPrefixes().length).toBeGreaterThan(0)
  })

  test('runtime DSXU prompt exports stable tool discipline while keeping environment facts in the dynamic tail', async () => {
    const originalMode = process.env.DSXU_CODE_MODE
    try {
      process.env.DSXU_CODE_MODE = '1'
      const sections = await getSystemPrompt([], 'deepseek-v4-flash')
      const exportPack = buildCacheWarmPrefixExport({
        model: 'deepseek-v4-flash',
        systemPromptSections: sections,
      })
      const boundaryIndex = sections.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      const stablePrefix = exportPack.prefixes[0] ?? ''
      const dynamicTail = sections.slice(boundaryIndex + 1).join('\n\n')

      expect(boundaryIndex).toBeGreaterThan(0)
      expect(exportPack.boundaryFound).toBe(true)
      expect(exportPack.stablePrefixApproxTokens).toBeGreaterThan(1_000)
      expect(stablePrefix).toContain('# DSXU Code Prompt Profile')
      expect(stablePrefix).toContain('# DSXU DeepSeek Tool-Use Contract')
      expect(stablePrefix).toContain('# DSXU Prompt Governance Contract')
      expect(stablePrefix).toContain('# Using your tools')
      expect(stablePrefix).not.toContain('Working directory:')
      expect(stablePrefix).not.toContain('Primary working directory:')
      expect(dynamicTail).toContain('Primary working directory:')
    } finally {
      if (originalMode === undefined) delete process.env.DSXU_CODE_MODE
      else process.env.DSXU_CODE_MODE = originalMode
    }
  })
})
