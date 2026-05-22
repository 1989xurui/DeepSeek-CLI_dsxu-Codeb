export type DSXUContextPressureBucket = '<70' | '70-84' | '85-94' | '95-98' | '>=99'

export type DSXUContextPressureRisk = 'low' | 'medium' | 'high' | 'critical' | 'emergency'

export type DSXUContextPressureDecision = {
  bucket: DSXUContextPressureBucket
  contextUsedPercent: number
  estimatedTurnsRemaining: number
  risk: DSXUContextPressureRisk
  recommendedAction: string
  contextHygieneAction: string
  sourceTruthReread: 'required-before-edit-or-pass'
  cachePolicy: string
  promptTooLongCompatibility: string
  warnings: readonly string[]
}

export function buildDSXUContextPressureDecision(input: {
  tokenUsage: number
  effectiveWindow: number
  postCompact?: boolean
  promptTooLongRecovered?: boolean
}): DSXUContextPressureDecision {
  const effectiveWindow = Math.max(1, input.effectiveWindow)
  const tokenUsage = Math.max(0, input.tokenUsage)
  const contextUsedPercent = Math.min(
    100,
    Math.max(0, Math.round((tokenUsage / effectiveWindow) * 100)),
  )
  const estimatedTurnsRemaining = Math.max(
    0,
    Math.floor((effectiveWindow - tokenUsage) / 12_000),
  )
  const bucket = classifyDSXUContextPressureBucket(contextUsedPercent)
  const base = policyForBucket(bucket)
  const warnings = [
    contextUsedPercent >= 70
      ? 'Medium context pressure: checkpoint the current step and keep volatile discovery/logs out of the dynamic tail.'
      : null,
    contextUsedPercent >= 85
      ? 'High context pressure: update the task snapshot first; compact only when route, context-window, cache, or recovery risk requires it.'
      : null,
    contextUsedPercent >= 95
      ? 'Critical context pressure: source capsule, tool-result artifact preview, and route/cache latch must happen before any broad Read or multi-file write.'
      : null,
    contextUsedPercent >= 99
      ? 'Emergency context pressure: do not continue broad discovery; enter prompt-too-long recovery or source-truth snapshot before the next model turn.'
      : null,
    input.postCompact
      ? 'Post-compact/resume turn: memory and summaries are hints; re-read source truth before editing or claiming PASS.'
      : null,
    input.promptTooLongRecovered
      ? 'Prompt-too-long recovery already ran: preserve source anchors and do not treat compacted memory as proof.'
      : null,
  ].filter((warning): warning is string => Boolean(warning))

  return {
    bucket,
    contextUsedPercent,
    estimatedTurnsRemaining,
    risk: base.risk,
    recommendedAction: base.recommendedAction,
    contextHygieneAction: base.contextHygieneAction,
    sourceTruthReread: 'required-before-edit-or-pass',
    cachePolicy: base.cachePolicy,
    promptTooLongCompatibility: base.promptTooLongCompatibility,
    warnings,
  }
}

export function classifyDSXUContextPressureBucket(
  contextUsedPercent: number,
): DSXUContextPressureBucket {
  if (contextUsedPercent >= 99) return '>=99'
  if (contextUsedPercent >= 95) return '95-98'
  if (contextUsedPercent >= 85) return '85-94'
  if (contextUsedPercent >= 70) return '70-84'
  return '<70'
}

function policyForBucket(bucket: DSXUContextPressureBucket): {
  risk: DSXUContextPressureRisk
  recommendedAction: string
  contextHygieneAction: string
  cachePolicy: string
  promptTooLongCompatibility: string
} {
  switch (bucket) {
    case '>=99':
      return {
        risk: 'emergency',
        recommendedAction: 'prompt_too_long_recovery_or_source_truth_snapshot',
        contextHygieneAction: 'stop_broad_reads_and_enter_reactive_compact_recovery',
        cachePolicy: 'preserve_stable_prefix_and_send_only_recovery_delta',
        promptTooLongCompatibility: 'must_withhold_413_until_context_collapse_or_reactive_compact_attempted',
      }
    case '95-98':
      return {
        risk: 'critical',
        recommendedAction: 'source_capsule_then_context_hygiene',
        contextHygieneAction: 'artifact_long_tool_results_and_prepare_cache_safe_compact',
        cachePolicy: 'freeze_route_tools_and_dynamic_tail_before_retry',
        promptTooLongCompatibility: 'preempt_prompt_too_long_with_source_capsule_and_bounded_tool_preview',
      }
    case '85-94':
      return {
        risk: 'high',
        recommendedAction: 'snapshot_then_context_hygiene',
        contextHygieneAction: 'snapshot_before_compact_if_route_cache_or_recovery_requires',
        cachePolicy: 'keep_goal_plan_route_and_source_anchors_stable',
        promptTooLongCompatibility: 'compact_only_when_route_context_window_cache_or_recovery_requires',
      }
    case '70-84':
      return {
        risk: 'medium',
        recommendedAction: 'checkpoint_and_trim_dynamic_tail',
        contextHygieneAction: 'compress_long_logs_and_repeated_tool_output_only',
        cachePolicy: 'keep_stable_prefix_fixed_and_move_volatiles_to_artifacts',
        promptTooLongCompatibility: 'watch_for_413_but_do_not_compact_without_risk',
      }
    case '<70':
      return {
        risk: 'low',
        recommendedAction: 'continue',
        contextHygieneAction: 'none',
        cachePolicy: 'preserve_stable_prefix_and_continue_flash_first',
        promptTooLongCompatibility: 'no_special_recovery_needed',
      }
  }
}
