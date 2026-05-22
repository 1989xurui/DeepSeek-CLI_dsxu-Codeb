import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  shouldEmitSystemPromptDynamicBoundary,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
} from '../../../constants/prompts'
import { asSystemPrompt } from '../../../utils/systemPromptType'
import { resetCachePrefixRegistry } from '../../../services/cache-prefix-registry'
import { recordDSXUQueryPromptPrefixCacheEvidence } from '../prompt-prefix-cache-evidence'

let tmpRoot: string | null = null
const originalDsxuCodeMode = process.env.DSXU_CODE_MODE
const originalDisableExperimentalBetas =
  process.env.DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS

afterEach(() => {
  resetCachePrefixRegistry()
  delete process.env.DSXU_ROUTE_TRACE_FILE
  if (originalDsxuCodeMode === undefined) delete process.env.DSXU_CODE_MODE
  else process.env.DSXU_CODE_MODE = originalDsxuCodeMode
  if (originalDisableExperimentalBetas === undefined) {
    delete process.env.DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS
  } else {
    process.env.DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS =
      originalDisableExperimentalBetas
  }
  if (tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
  tmpRoot = null
})

describe('V18 query prompt prefix cache evidence', () => {
  test('emits the dynamic boundary for DSXU runtime without enabling legacy global cache', () => {
    process.env.DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS = '1'

    delete process.env.DSXU_CODE_MODE
    expect(shouldEmitSystemPromptDynamicBoundary()).toBe(false)

    process.env.DSXU_CODE_MODE = '1'
    expect(shouldEmitSystemPromptDynamicBoundary()).toBe(true)
  })

  test('records stable and dynamic hashes to the route trace without mutating the prompt', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-prefix-evidence-'))
    const tracePath = join(tmpRoot, 'route.jsonl')
    process.env.DSXU_ROUTE_TRACE_FILE = tracePath
    const originalPrompt = [
      'static system rules',
      'static tool schemas',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'Context Window & Hygiene: dynamic budget',
      'DSXU Model Route Evidence: dynamic route evidence',
    ]
    const prompt = asSystemPrompt(originalPrompt)
    const lifecycleEvents: Array<{ event: string; data?: Record<string, unknown> }> = []

    const evidence = recordDSXUQueryPromptPrefixCacheEvidence({
      systemPrompt: prompt,
      workflowKind: 'planning',
      routeReason: 'planning_flash_thinking_max',
      model: 'deepseek-v4-flash',
      querySource: 'repl_main_thread',
      turnCount: 1,
      traceLifecycle: (event, data) => lifecycleEvents.push({ event, data }),
    })

    expect([...prompt]).toEqual(originalPrompt)
    expect(evidence.workflowKind).toBe('planning')
    expect(evidence.cacheMissBudgetTokens).toBe(2_000)
    expect(evidence.boundaryFound).toBe(true)
    expect(evidence.stableBlockCount).toBe(2)
    expect(evidence.dynamicBlockCount).toBe(2)
    expect(evidence.stablePrefixApproxTokens).toBeGreaterThan(0)
    expect(evidence.dynamicTailApproxTokens).toBeGreaterThan(0)
    expect(evidence.fullPromptApproxTokens).toBeGreaterThan(
      evidence.dynamicTailApproxTokens,
    )
    expect(evidence.volatileFindingCount).toBe(0)
    expect(evidence.stablePrefixHash).not.toBe(evidence.dynamicTailHash)
    expect(evidence.stablePrefixLockStatus).toBe('NO_PREVIOUS_PREFIX')
    expect(evidence.toolSchemaFreezeStatus).toBe('TOOL_SCHEMA_STABLE')
    expect(evidence.cacheEpochStatus).toBe('CACHE_EPOCH_STABLE')
    expect(evidence.cacheEpochHash).toEqual(expect.any(String))
    expect(evidence.cachePrefixRegistryLaneStats).toHaveLength(1)
    expect(evidence.cachePrefixRegistryLaneStats[0]).toMatchObject({
      lane: 'mainline',
      sampleCount: 1,
      latestStatus: 'CACHE_PREFIX_REGISTRY_REGISTERED',
    })
    expect(lifecycleEvents[0]?.event).toBe('prompt_prefix_cache_evidence')

    const traceLines = readFileSync(tracePath, 'utf8').trim().split(/\r?\n/)
    expect(traceLines).toHaveLength(1)
    const trace = JSON.parse(traceLines[0]!)
    expect(trace.event).toBe('prompt_prefix_cache_evidence')
    expect(trace.stablePrefixHash).toBe(evidence.stablePrefixHash)
    expect(trace.dynamicTailHash).toBe(evidence.dynamicTailHash)
    expect(trace.stablePrefixLockStatus).toBe('NO_PREVIOUS_PREFIX')
    expect(trace.toolSchemaFreezeStatus).toBe('TOOL_SCHEMA_STABLE')
    expect(trace.cacheEpochStatus).toBe('CACHE_EPOCH_STABLE')
    expect(trace.cacheEpochHash).toBe(evidence.cacheEpochHash)
    expect(trace.cachePrefixRegistryLaneStats[0]).toMatchObject({
      lane: 'mainline',
      sampleCount: 1,
    })
    expect(trace.dynamicTailApproxTokens).toBe(evidence.dynamicTailApproxTokens)
    expect(trace.cacheMissBudgetTokens).toBe(2_000)
  })

  test('maps bugfix/feature to coding budget and flags missing dynamic boundary', () => {
    const evidence = recordDSXUQueryPromptPrefixCacheEvidence({
      systemPrompt: asSystemPrompt(['static only prompt']),
      workflowKind: 'bugfix',
      routeReason: 'coding_flash_non_thinking',
      model: 'deepseek-v4-flash',
      querySource: 'sdk',
      turnCount: 2,
    })

    expect(evidence.workflowKind).toBe('coding')
    expect(evidence.cacheMissBudgetTokens).toBe(8_000)
    expect(evidence.boundaryFound).toBe(false)
    expect(evidence.stableBlockCount).toBe(1)
    expect(evidence.dynamicBlockCount).toBe(0)
  })

  test('keeps volatile findings in trace payload without leaking full prompt text', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-prefix-evidence-'))
    const tracePath = join(tmpRoot, 'route.jsonl')
    process.env.DSXU_ROUTE_TRACE_FILE = tracePath

    const evidence = recordDSXUQueryPromptPrefixCacheEvidence({
      systemPrompt: asSystemPrompt([
        'static rules include 2026-05-07T12:00:00+08:00 and .dsxu/trace/v18/run.json',
        SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
        'dynamic request',
      ]),
      workflowKind: 'recovery',
      routeReason: 'recovery_flash_thinking_max',
      model: 'deepseek-v4-flash',
      querySource: 'repl_main_thread',
      turnCount: 3,
    })

    expect(evidence.status).toBe('CACHE_PREFIX_NEEDS_CLEANUP')
    expect(evidence.volatileFindings.map(finding => finding.kind)).toEqual([
      'timestamp',
      'trace_or_run_path',
    ])
    const trace = JSON.parse(readFileSync(tracePath, 'utf8').trim())
    expect(JSON.stringify(trace)).not.toContain('dynamic request')
    expect(trace.volatileFindings).toEqual(evidence.volatileFindings)
  })
})
