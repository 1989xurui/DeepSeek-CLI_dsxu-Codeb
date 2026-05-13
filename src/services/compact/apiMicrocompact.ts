import { isEnvTruthy } from '../../utils/envUtils.js'
import { DEEPSEEK_V4_CONTEXT_WINDOW } from '../../utils/model/deepseekV4Control.js'

// docs: https://docs.google.com/document/d/1oCT4evvWTh3P6z-kcfNQwWTCxAhkoFndSaNS9Gm40uw/edit?tab=t.0

// Default values for context management strategies.
// Keep these window-aware so DSXU does not fall back to old fixed 128K-era
// or fixed-small-pack compaction behavior on DeepSeek V4.
const DEFAULT_TRIGGER_RATIO = 0.75
const DEFAULT_TARGET_RATIO = 0.25
const DEFAULT_CONTEXT_WINDOW = DEEPSEEK_V4_CONTEXT_WINDOW
const DEFAULT_MAX_INPUT_TOKENS = Math.floor(DEFAULT_CONTEXT_WINDOW * DEFAULT_TRIGGER_RATIO)
const DEFAULT_TARGET_INPUT_TOKENS = Math.floor(DEFAULT_CONTEXT_WINDOW * DEFAULT_TARGET_RATIO)
export const API_MICROCOMPACT_DEFAULT_MAX_INPUT_TOKENS =
  DEFAULT_MAX_INPUT_TOKENS
export const API_MICROCOMPACT_DEFAULT_TARGET_INPUT_TOKENS =
  DEFAULT_TARGET_INPUT_TOKENS

const TOOLS_CLEARABLE_RESULTS = [
  'Bash',
  'PowerShell',
  'Glob',
  'Grep',
  'Read',
  'WebFetch',
  'WebSearch',
]

const TOOLS_CLEARABLE_USES = [
  'Edit',
  'Write',
  'NotebookEdit',
]

// Context management strategy types matching API documentation
export type ContextEditStrategy =
  | {
      type: 'clear_tool_uses_20250919'
      trigger?: {
        type: 'input_tokens'
        value: number
      }
      keep?: {
        type: 'tool_uses'
        value: number
      }
      clear_tool_inputs?: boolean | string[]
      exclude_tools?: string[]
      clear_at_least?: {
        type: 'input_tokens'
        value: number
      }
    }
  | {
      type: 'clear_thinking_20251015'
      keep: { type: 'thinking_turns'; value: number } | 'all'
    }

// Context management configuration wrapper
export type ContextManagementConfig = {
  edits: ContextEditStrategy[]
}

export type APIContextManagementTokenPolicy = {
  contextWindow: number
  triggerTokens: number
  targetTokens: number
  clearAtLeastTokens: number
}

function parsePositiveEnvInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function resolveAPIContextManagementTokenPolicy(options?: {
  contextWindow?: number
  triggerTokens?: number
  targetTokens?: number
}): APIContextManagementTokenPolicy {
  const contextWindow = Math.max(1, options?.contextWindow ?? DEFAULT_CONTEXT_WINDOW)
  const triggerTokens =
    options?.triggerTokens ??
    parsePositiveEnvInt(process.env.API_MAX_INPUT_TOKENS) ??
    Math.floor(contextWindow * DEFAULT_TRIGGER_RATIO)
  const targetTokens =
    options?.targetTokens ??
    parsePositiveEnvInt(process.env.API_TARGET_INPUT_TOKENS) ??
    Math.floor(contextWindow * DEFAULT_TARGET_RATIO)

  return {
    contextWindow,
    triggerTokens,
    targetTokens,
    clearAtLeastTokens: Math.max(0, triggerTokens - targetTokens),
  }
}

// API-based microcompact implementation that uses native context management
export function getAPIContextManagement(options?: {
  hasThinking?: boolean
  isRedactThinkingActive?: boolean
  clearAllThinking?: boolean
  contextWindow?: number
}): ContextManagementConfig | undefined {
  const {
    hasThinking = false,
    isRedactThinkingActive = false,
    clearAllThinking = false,
    contextWindow,
  } = options ?? {}

  const strategies: ContextEditStrategy[] = []

  // Preserve thinking blocks in previous assistant turns. Skip when
  // redact-thinking is active — redacted blocks have no model-visible content.
  // When clearAllThinking is set (>1h idle = cache miss), keep only the last
  // thinking turn — the API schema requires value >= 1, and omitting the edit
  // falls back to the model-policy default (often "all"), which wouldn't clear.
  if (hasThinking && !isRedactThinkingActive) {
    strategies.push({
      type: 'clear_thinking_20251015',
      keep: clearAllThinking ? { type: 'thinking_turns', value: 1 } : 'all',
    })
  }

  // Tool clearing strategies are ant-only
  if (process.env.USER_TYPE !== 'ant') {
    return strategies.length > 0 ? { edits: strategies } : undefined
  }

  const useClearToolResults = isEnvTruthy(
    process.env.USE_API_CLEAR_TOOL_RESULTS,
  )
  const useClearToolUses = isEnvTruthy(process.env.USE_API_CLEAR_TOOL_USES)

  // If no tool clearing strategy is enabled, return early
  if (!useClearToolResults && !useClearToolUses) {
    return strategies.length > 0 ? { edits: strategies } : undefined
  }

  if (useClearToolResults) {
    const tokenPolicy = resolveAPIContextManagementTokenPolicy({ contextWindow })

    const strategy: ContextEditStrategy = {
      type: 'clear_tool_uses_20250919',
      trigger: {
        type: 'input_tokens',
        value: tokenPolicy.triggerTokens,
      },
      clear_at_least: {
        type: 'input_tokens',
        value: tokenPolicy.clearAtLeastTokens,
      },
      clear_tool_inputs: TOOLS_CLEARABLE_RESULTS,
    }

    strategies.push(strategy)
  }

  if (useClearToolUses) {
    const tokenPolicy = resolveAPIContextManagementTokenPolicy({ contextWindow })

    const strategy: ContextEditStrategy = {
      type: 'clear_tool_uses_20250919',
      trigger: {
        type: 'input_tokens',
        value: tokenPolicy.triggerTokens,
      },
      clear_at_least: {
        type: 'input_tokens',
        value: tokenPolicy.clearAtLeastTokens,
      },
      exclude_tools: TOOLS_CLEARABLE_USES,
    }

    strategies.push(strategy)
  }

  return strategies.length > 0 ? { edits: strategies } : undefined
}


// V14 lifecycle shim: apimicrocompact
export function processApimicrocompactLifecycle(input) {
  void input
  const state = 'apimicrocompact-state'
  const lifecycle = 'apimicrocompact:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
