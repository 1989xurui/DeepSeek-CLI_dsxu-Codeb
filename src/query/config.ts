import { getSessionId } from '../bootstrap/state.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../services/analytics/featureFlags.js'
import type { SessionId } from '../types/ids.js'
import { isEnvTruthy } from '../utils/envUtils.js'

// -- config
const LEGACY_EMIT_TOOL_USE_SUMMARIES_ENV =
  'CL' + 'AUDE_CODE_EMIT_TOOL_USE_SUMMARIES'
const LEGACY_DISABLE_FAST_MODE_ENV = 'CL' + 'AUDE_CODE_DISABLE_FAST_MODE'
const STREAMING_TOOL_EXECUTION_GATE = 'tengu_streaming_tool_execution2'

function isDeepSeekDirectRuntime(): boolean {
  const provider = process.env.DSXU_MODEL_PROVIDER?.toLowerCase().trim()
  const gateway = process.env.DSXU_MODEL_GATEWAY?.toLowerCase().trim()
  return provider === 'deepseek' && (!gateway || gateway === 'direct')
}

export function isStreamingToolExecutionEnabled(): boolean {
  if (isEnvTruthy(process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION)) {
    return false
  }
  if (isEnvTruthy(process.env.DSXU_CODE_STREAMING_TOOL_EXECUTION)) {
    return true
  }
  return (
    isDeepSeekDirectRuntime() ||
    checkStatsigFeatureGate_CACHED_MAY_BE_STALE(STREAMING_TOOL_EXECUTION_GATE)
  )
}

// Immutable values snapshotted once at query() entry. Separating these from
// the per-iteration State struct and the mutable ToolUseContext makes future
// step() extraction tractable — a pure reducer can take (state, event, config)
// where config is plain data.
//
// Intentionally excludes feature() gates — those are tree-shaking boundaries
// and must stay inline at the guarded blocks for dead-code elimination.
export type QueryConfig = {
  sessionId: SessionId

  // Runtime gates (env/statsig). NOT feature() gates — see above.
  gates: {
    // Statsig — CACHED_MAY_BE_STALE already admits staleness, so snapshotting
    // once per query() call stays within the existing contract.
    streamingToolExecution: boolean
    emitToolUseSummaries: boolean
    isAnt: boolean
    fastModeEnabled: boolean
  }
}

export function buildQueryConfig(): QueryConfig {
  return {
    sessionId: getSessionId(),
    gates: {
      streamingToolExecution: isStreamingToolExecutionEnabled(),
      emitToolUseSummaries: isEnvTruthy(
        process.env.DSXU_CODE_EMIT_TOOL_USE_SUMMARIES ??
          process.env[LEGACY_EMIT_TOOL_USE_SUMMARIES_ENV],
      ),
      isAnt: process.env.USER_TYPE === 'ant',
      // Inlined from fastMode.ts to avoid pulling its heavy module graph
      // (axios, settings, auth, model, oauth, config) into test shards that
      // didn't previously load it — changes init order and breaks unrelated tests.
      fastModeEnabled: !isEnvTruthy(
        process.env.DSXU_CODE_DISABLE_FAST_MODE ??
          process.env[LEGACY_DISABLE_FAST_MODE_ENV],
      ),
    },
  }
}
