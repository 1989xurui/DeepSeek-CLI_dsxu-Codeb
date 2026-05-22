import { describe, expect, test } from 'bun:test'
import { buildDSXUPromptPrefixCachePlan } from '../prompt-prefix-cache-builder'

const STABLE_SECTIONS = [
  {
    id: 'output_contract',
    content: 'Return status, changed files, verification, risks, and next step.',
  },
  {
    id: 'system_rules',
    content: 'You are DSXU Code. Preserve user work and finish with evidence.',
  },
  {
    id: 'semantic_tool_layer',
    content: 'Use RepoInspect, RunNativeTest, VerifyPatch, and CollectEvidence before raw shell fallback.',
  },
  {
    id: 'permission_policy',
    content: 'High-risk destructive operations require explicit permission and Pro hard-gate review.',
  },
  {
    id: 'model_routing_policy',
    content: 'Flash-MAX first for planning/review/recovery; Pro only after failed verification or safety gate.',
  },
  {
    id: 'tool_schemas',
    content: 'Read(path), Edit(file, old_string, new_string), PowerShell(command), Bash(command).',
  },
]

describe('V18 prompt prefix cache builder', () => {
  test('keeps the stable prefix hash unchanged when only dynamic task state changes', () => {
    const first = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'planning',
      stableSections: STABLE_SECTIONS,
      dynamicSections: [
        { id: 'current_user_request', content: 'Fix checkout bug.' },
        { id: 'task_snapshot', content: 'changedFiles=[]; verification=not_started' },
      ],
    })
    const second = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'planning',
      stableSections: [...STABLE_SECTIONS].reverse(),
      dynamicSections: [
        { id: 'current_user_request', content: 'Review checkout security.' },
        { id: 'task_snapshot', content: 'changedFiles=[src/auth.ts]; verification=partial' },
      ],
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.stableSectionOrder).toEqual([
      'system_rules',
      'tool_schemas',
      'permission_policy',
      'model_routing_policy',
      'semantic_tool_layer',
      'output_contract',
    ])
    expect(second.stableSectionOrder).toEqual(first.stableSectionOrder)
    expect(second.stablePrefixHash).toBe(first.stablePrefixHash)
    expect(second.dynamicTailHash).not.toBe(first.dynamicTailHash)
    expect(second.fullPromptHash).not.toBe(first.fullPromptHash)
    expect(first.stablePrefixApproxTokens).toBeGreaterThan(0)
    expect(second.dynamicTailApproxTokens).toBeGreaterThan(first.dynamicTailApproxTokens)
    expect(first.cacheMissBudgetTokens).toBe(2_000)
    expect(first.promptSlimmingDecision.status).toBe(
      'PASS_PROMPT_SLIMMING_OWNER_ACCEPTANCE',
    )
    expect(first.promptSlimmingDecision.stableSystemSectionIds).toContain('system_rules')
    expect(first.promptSlimmingDecision.taskMicroSectionIds).toContain('current_user_request')
  })

  test('flags volatile content inside the stable prefix and tells callers to move it to dynamic tail', () => {
    const plan = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'recovery',
      stableSections: [
        ...STABLE_SECTIONS,
        {
          id: 'bad_dynamic_state',
          content: [
            'current_time=2026-05-07T11:59:00+08:00',
            'trace=.dsxu/trace/v18-live-provider/live.json',
            'tmp=C:\\Users\\h\\AppData\\Local\\Temp\\dsxu-code-mode-abc',
            'session=012bbee0-1f92-4631-81bd-c46a33bd627a',
          ].join('\n'),
        },
      ],
      dynamicSections: [
        { id: 'current_user_request', content: 'Recover failed test.' },
      ],
    })

    expect(plan.ok).toBe(false)
    expect(plan.status).toBe('CACHE_PREFIX_NEEDS_CLEANUP')
    expect(plan.cacheMissBudgetTokens).toBe(10_000)
    expect(plan.guards).toContain('stable prefix contains volatile content that can lower DeepSeek KV cache hit rate')
    expect(plan.volatileFindings.map(finding => finding.kind)).toEqual([
      'timestamp',
      'temp_path',
      'trace_or_run_path',
      'absolute_path',
      'random_id',
    ])
    expect(plan.volatileFindings.every(finding => finding.sectionId === 'bad_dynamic_state')).toBe(true)
    expect(plan.promptSlimmingDecision.status).toBe(
      'NEEDS_PROMPT_SLIMMING_OWNER_REVIEW',
    )
    expect(plan.promptSlimmingDecision.guards).toContain(
      'stable prefix contains volatile session evidence',
    )
  })

  test('does not treat stable long identifier names as random ids', () => {
    const plan = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      stableSections: [
        ...STABLE_SECTIONS,
        {
          id: 'tool_schema_fields',
          content: 'Stable fields include contextUsedPercent, cacheReadInputTokens, and cacheCreationInputTokens.',
        },
      ],
      dynamicSections: [
        { id: 'current_user_request', content: 'Run focused semantic gate.' },
      ],
    })

    expect(plan.ok).toBe(true)
    expect(plan.volatileFindings).toEqual([])
  })

  test('keeps runtime gates and task micro prompts out of the stable prefix', () => {
    const plan = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      stableSections: [
        ...STABLE_SECTIONS,
        {
          id: 'runtime_gate_current_verification',
          content: 'current verification status and failed commands belong in dynamic state.',
        },
      ],
      dynamicSections: [
        { id: 'runtime_gate_verification', content: 'verification=failed; command=bun test cart.test.ts' },
        { id: 'task_micro_prompt', content: 'Fix cart regression. Verify with focused test. Report evidence.' },
      ],
    })

    expect(plan.promptSlimmingDecision.status).toBe(
      'NEEDS_PROMPT_SLIMMING_OWNER_REVIEW',
    )
    expect(plan.promptSlimmingDecision.guards).toContain(
      'stable prefix contains runtime/task section:runtime_gate_current_verification',
    )
    expect(plan.promptSlimmingDecision.runtimeGateSectionIds).toEqual([
      'runtime_gate_verification',
    ])
    expect(plan.promptSlimmingDecision.taskMicroSectionIds).toEqual([
      'task_micro_prompt',
    ])
    expect(plan.promptSlimmingDecision.recommendations.join('\n')).toContain(
      'Move verification/recovery/context pressure/tool-result/agent handoff state into runtime-gate dynamic sections.',
    )
  })

  test('requires stable-prefix, tool-schema, and cache-epoch drift to carry an explicit reason', () => {
    const baseline = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      sourceCapsuleHash: 'source-a',
      stableSections: STABLE_SECTIONS,
      dynamicSections: [
        { id: 'current_user_request', content: 'Fix cart regression.' },
      ],
    })

    const blocked = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      sourceCapsuleHash: 'source-b',
      previousStablePrefixHash: baseline.stablePrefixHash,
      previousToolSchemaHash: baseline.toolSchemaFreeze.toolSchemaHash,
      previousCacheEpochHash: baseline.cacheEpoch.epochHash,
      stableSections: [
        ...STABLE_SECTIONS,
        {
          id: 'tool_schemas_extra',
          content: 'VerifyPatch(command), CollectEvidence(path).',
        },
      ],
      dynamicSections: [
        { id: 'current_user_request', content: 'Fix cart regression.' },
      ],
    })

    expect(blocked.stablePrefixLock.status).toBe('STABLE_DRIFT_BLOCKED')
    expect(blocked.toolSchemaFreeze.status).toBe('TOOL_SCHEMA_CHANGED_BLOCKED')
    expect(blocked.cacheEpoch.status).toBe('CACHE_EPOCH_CHANGED_BLOCKED')
    expect(blocked.guards).toContain('stable prefix drift requires an explicit cache epoch reason')
    expect(blocked.guards).toContain('tool schema changed without an epoch/reason')
    expect(blocked.guards).toContain('cache epoch changed without model/tool/source/system reason')

    const explained = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      model: 'deepseek-v4-flash',
      sourceCapsuleHash: 'source-b',
      previousStablePrefixHash: baseline.stablePrefixHash,
      stablePrefixDriftReason: 'tool window changed for source capsule fallback',
      previousToolSchemaHash: baseline.toolSchemaFreeze.toolSchemaHash,
      toolSchemaChangeReason: 'tool window changed for source capsule fallback',
      previousCacheEpochHash: baseline.cacheEpoch.epochHash,
      cacheEpochChangeReasons: ['tool schema changed', 'source capsule changed'],
      stableSections: [
        ...STABLE_SECTIONS,
        {
          id: 'tool_schemas_extra',
          content: 'VerifyPatch(command), CollectEvidence(path).',
        },
      ],
      dynamicSections: [
        { id: 'current_user_request', content: 'Fix cart regression.' },
      ],
    })

    expect(explained.stablePrefixLock.status).toBe('STABLE_DRIFT_EXPLAINED')
    expect(explained.toolSchemaFreeze.status).toBe('TOOL_SCHEMA_CHANGED_EXPLAINED')
    expect(explained.cacheEpoch.status).toBe('CACHE_EPOCH_CHANGED_EXPLAINED')
    expect(explained.guards).not.toContain('cache epoch changed without model/tool/source/system reason')
  })
})
