import type { Message } from '../../types/message.js'

export type DsxuLatestUserIntentOverrideKind =
  | 'cancel_current_task'
  | 'analysis_only'
  | 'stale_topic_or_meta_question'

export type DsxuLatestUserIntentOverride = {
  kind: DsxuLatestUserIntentOverrideKind
  prompt: string
  reason: string
  nextAction: string
  blocksTools: boolean
  blocksQueuedSystemDrain: boolean
}

export type DsxuLatestUserIntentContextView = {
  messages: readonly Message[]
  override: DsxuLatestUserIntentOverride | null
  pruned: boolean
}

const DSXU_LATEST_USER_INTENT_OVERRIDE_MARKER =
  'DSXU latest-user-intent override gate'

const DSXU_STALE_TOPIC_OR_META_REGEXES = [
  /(?:\u95ee\u975e\u6240\u7b54|\u975e\u6240\u7b54|\u4e0d\u76f8\u5173\u4fe1\u606f|\u65e7\u95ee\u9898|\u4ee5\u524d\u95ee\u9898|\u5386\u53f2\u95ee\u9898|\u4e0a\u4e2a\u95ee\u9898|\u4e0a\u4e00\u8f6e|\u4e0a\u4e00\u6761|\u4e0d\u8981\u56de\u590d\u4ee5\u524d|\u4e00\u76f4\u56de\u590d|\u4e00\u76f4\u56de\u7b54|\u6ca1\u542c|\u6ca1\u6709\u542c)/i,
  /\u4e3a\u4ec0\u4e48.*(?:\u56de\u590d|\u56de\u7b54|\u8f93\u51fa).*(?:\u4ee5\u524d|\u65e7|\u5386\u53f2|\u4e4b\u524d|\u4e0a\u9762)/i,
  /\u4e3a\u4ec0\u4e48.*(?:\u4e0d\u76f8\u5173|\u95ee\u975e\u6240\u7b54)/i,
  /\b(?:old|previous|stale|unrelated|wrong topic|new topic|why.*(?:old|previous|stale|unrelated))\b/i,
]

const DSXU_ANALYSIS_ONLY_REGEXES = [
  /(?:\u53ea\u5206\u6790|\u7eaf\u5206\u6790|\u4ec5\u5206\u6790|\u53ea\u5ba1\u6838|\u7eaf\u5ba1\u6838|\u4e0d\u8981\u64cd\u4f5c|\u4e0d\u64cd\u4f5c|\u4e0d\u8981\u52a8\u4ee3\u7801|\u4e0d\u8981\u5199\u6587\u4ef6|\u4e0d\u8981\u8fd0\u884c|\u4e0d\u8981\u8dd1\u547d\u4ee4|\u522b\u8dd1\u547d\u4ee4|\u4e0d\u8981\u6d4b\u8bd5|\u4e0d\u6267\u884c|\u53ea\u51fa\u65b9\u6848|\u5148\u5206\u6790|\u5148\u522b\u64cd\u4f5c|\u5148\u4e0d\u64cd\u4f5c|\u5148\u4e0d\u8981\u64cd\u4f5c)/i,
  /\b(?:analysis only|do not operate|do not run|do not execute|no tools|no tool calls|do not edit|do not write)\b/i,
]

const DSXU_CANCEL_CURRENT_TASK_REGEXES = [
  /(?:\u4e0d\u7528\u5904\u7406\u4e86|\u4e0d\u7528\u518d\u5904\u7406|\u4e0d\u7528\u5904\u7406|\u4e0d\u9700\u8981\u5904\u7406|\u4e0d\u7528\u505a\u4e86|\u4e0d\u7528\u7ba1\u4e86|\u4e0d\u7528\u4e86|\u522b\u5904\u7406|\u4e0d\u8981\u5904\u7406|\u5148\u505c|\u505c\u4e0b|\u6682\u505c|\u505c\u6b62\u5f53\u524d|\u505c\u6b62\u8fd9\u4e2a|\u505c\u6b62\u6267\u884c|\u522b\u518d\u8dd1|\u4e0d\u8981\u518d\u8dd1|\u4e0d\u8981\u6267\u884c|\u4e0d\u7528\u6267\u884c|\u4e0d\u8981\u518d\u6267\u884c|\u4e0d\u7528\u9a8c\u8bc1|\u4e0d\u8981\u518d\u9a8c\u8bc1|\u4e0d\u7528\u518d\u9a8c\u8bc1|\u4e0d\u7528\u7ba1\u8fd9\u4e2a)/i,
  /(?:\u7b97\u4e86\u5427|\u7b97\u4e86|\u5148\u8fd9\u6837\u5427|\u5148\u8fd9\u6837|\u5230\u8fd9\u91cc\u5427|\u5148\u5230\u8fd9\u91cc|\u5148\u4e0d\u7ba1\u4e86|\u5148\u522b\u7ba1|\u522b\u7ba1\u90a3\u4e2a\u4e86|\u522b\u7ba1\u8fd9\u4e2a\u4e86|\u8fd9\u4e2a\u5148\u653e\u4e0b|\u5148\u653e\u4e0b|\u522b\u7ea0\u7ed3\u8fd9\u4e2a\u4e86|\u4e0d\u7528\u7ba1\u4e0a\u9762\u90a3\u4e2a|\u8fd9\u4e2a\u4e0d\u7528\u7ee7\u7eed|\u4e0a\u9762\u90a3\u4e2a\u5148\u505c|\u4e0d\u7528\u67e5\u4e86|\u6362\u4e2a\u95ee\u9898|\u6362\u4e2a\u8bdd\u9898|\u5148\u6362\u8bdd\u9898)/i,
  /^\s*(?:\u505c\u6b62|\u505c|stop|cancel)\s*[\u3002.!！,，]?\s*$/i,
  /\b(?:cancel this|stop this|do not continue|don't continue|no need to continue|no need to handle)\b/i,
]

function getMessageContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (
          block &&
          typeof block === 'object' &&
          'text' in block &&
          typeof block.text === 'string'
        ) {
          return block.text
        }
        if (
          block &&
          typeof block === 'object' &&
          'content' in block &&
          typeof block.content === 'string'
        ) {
          return block.content
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function getLatestDsxuRealUserPromptText(
  messages: readonly Message[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    const content =
      (message as { message?: { content?: unknown } })?.message?.content ??
      (message as { content?: unknown })?.content
    if (
      message?.type === 'user' &&
      !message.isMeta &&
      !message.toolUseResult
    ) {
      return getMessageContentText(content)
    }
  }
  return null
}

function getLatestDsxuRealUserPromptIndex(
  messages: readonly Message[],
): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (
      message?.type === 'user' &&
      !message.isMeta &&
      !message.toolUseResult
    ) {
      return index
    }
  }
  return -1
}

function isDsxuLatestUserIntentOverrideNudgeMessage(message: Message): boolean {
  if (message.type !== 'user' || !message.isMeta) return false
  const text = getMessageContentText(message.message.content)
  return text.includes(DSXU_LATEST_USER_INTENT_OVERRIDE_MARKER)
}

export function hasDsxuLatestUserIntentOverrideNudge(
  messages: readonly Message[],
): boolean {
  const latestUserIndex = getLatestDsxuRealUserPromptIndex(messages)
  if (latestUserIndex < 0) return false

  for (const message of messages.slice(latestUserIndex + 1)) {
    if (isDsxuLatestUserIntentOverrideNudgeMessage(message)) {
      return true
    }
  }
  return false
}

function normalizeIntentPrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim()
}

export function classifyDsxuLatestUserIntentOverrideText(
  prompt: string | null | undefined,
): DsxuLatestUserIntentOverride | null {
  if (!prompt) return null
  const normalized = normalizeIntentPrompt(prompt)
  if (!normalized) return null

  if (DSXU_STALE_TOPIC_OR_META_REGEXES.some(regex => regex.test(normalized))) {
    return {
      kind: 'stale_topic_or_meta_question',
      prompt: normalized,
      reason: 'latest_user_asked_about_stale_or_unrelated_answer',
      nextAction: 'answer_latest_meta_question_without_tools_or_old_task_retry',
      blocksTools: true,
      blocksQueuedSystemDrain: true,
    }
  }

  if (DSXU_ANALYSIS_ONLY_REGEXES.some(regex => regex.test(normalized))) {
    return {
      kind: 'analysis_only',
      prompt: normalized,
      reason: 'latest_user_requested_analysis_only',
      nextAction: 'answer_with_analysis_only_without_tool_calls',
      blocksTools: true,
      blocksQueuedSystemDrain: true,
    }
  }

  if (DSXU_CANCEL_CURRENT_TASK_REGEXES.some(regex => regex.test(normalized))) {
    return {
      kind: 'cancel_current_task',
      prompt: normalized,
      reason: 'latest_user_cancelled_or_stopped_current_task',
      nextAction: 'acknowledge_stop_and_do_not_retry_old_tools',
      blocksTools: true,
      blocksQueuedSystemDrain: true,
    }
  }

  return null
}

export function classifyDsxuLatestUserIntentOverride(
  messages: readonly Message[] | undefined,
): DsxuLatestUserIntentOverride | null {
  return classifyDsxuLatestUserIntentOverrideText(
    messages ? getLatestDsxuRealUserPromptText(messages) : null,
  )
}

export function buildDsxuLatestUserIntentOverrideNudge(
  messages: readonly Message[],
): string | null {
  if (hasDsxuLatestUserIntentOverrideNudge(messages)) return null
  const override = classifyDsxuLatestUserIntentOverride(messages)
  if (!override) return null

  return [
    `${DSXU_LATEST_USER_INTENT_OVERRIDE_MARKER}:`,
    `- user_intent: ${override.kind}`,
    `- reason: ${override.reason}`,
    '- blocked_old_context: do not continue stale plans, old verification commands, old background notifications, or previous task summaries.',
    `- required_next: ${override.nextAction}.`,
    '- response_contract: answer only the latest user message in visible text; do not call tools unless the user explicitly reopens execution.',
  ].join('\n')
}

export function buildDsxuLatestUserIntentContextView(
  messages: readonly Message[],
): DsxuLatestUserIntentContextView {
  const latestUserIndex = getLatestDsxuRealUserPromptIndex(messages)
  if (latestUserIndex < 0) {
    return { messages, override: null, pruned: false }
  }

  const override = classifyDsxuLatestUserIntentOverrideText(
    getMessageContentText(messages[latestUserIndex]!.message.content),
  )
  if (!override || override.kind === 'analysis_only') {
    return { messages, override, pruned: false }
  }

  const latestUserMessage = messages[latestUserIndex]!
  const overrideNudges = messages
    .slice(latestUserIndex + 1)
    .filter(isDsxuLatestUserIntentOverrideNudgeMessage)

  return {
    messages: [latestUserMessage, ...overrideNudges],
    override,
    pruned: latestUserIndex > 0 || overrideNudges.length !== messages.length - 1,
  }
}
