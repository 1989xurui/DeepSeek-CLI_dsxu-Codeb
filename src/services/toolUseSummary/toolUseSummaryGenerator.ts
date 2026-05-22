/**
 * Tool Use Summary Generator
 *
 * Generates human-readable summaries of completed tool batches using the compact model.
 * Used by the SDK to provide high-level progress updates to clients.
 */

import { E_TOOL_USE_SUMMARY_GENERATION_FAILED } from '../../constants/errorIds.js'
import { toError } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import { queryProviderMigrationSmallModel } from '../../utils/model/providerMigration/providerMigrationSmallModelQuery.js'

const TOOL_USE_SUMMARY_SYSTEM_PROMPT = `Write a short summary label describing what these tool calls accomplished. It appears as a single-line row in a mobile app and truncates around 30 characters, so think git-commit-subject, not sentence.

Keep the verb in past tense and the most distinctive noun. Drop articles, connectors, and long location context first.

Examples:
- Searched in auth/
- Fixed NPE in UserService
- Created signup endpoint
- Read config.json
- Ran failing tests`

type ToolInfo = {
  name: string
  input: unknown
  output: unknown
}

export type ToolUseSummaryPromptItem = {
  name: string
  input: string
  output: string
}

export type GenerateToolUseSummaryParams = {
  tools: ToolInfo[]
  signal: AbortSignal
  isNonInteractiveSession: boolean
  lastAssistantText?: string
}

/**
 * Generates a human-readable summary of completed tools.
 *
 * @param params - Parameters including tools executed and their results
 * @returns A brief summary string, or null if generation fails
 */
export async function generateToolUseSummary({
  tools,
  signal,
  isNonInteractiveSession,
  lastAssistantText,
}: GenerateToolUseSummaryParams): Promise<string | null> {
  if (tools.length === 0) {
    return null
  }

  try {
    // Build a concise representation of what tools did
    const promptItems = buildToolUseSummaryPromptItems(tools)
    const toolSummaries = promptItems
      .map(tool => `Tool: ${tool.name}\nInput: ${tool.input}\nOutput: ${tool.output}`)
      .join('\n\n')

    const contextPrefix = lastAssistantText
      ? `User's intent (from assistant's last message): ${lastAssistantText.slice(0, 200)}\n\n`
      : ''

    const response = await queryProviderMigrationSmallModel({
      systemPrompt: asSystemPrompt([TOOL_USE_SUMMARY_SYSTEM_PROMPT]),
      userPrompt: `${contextPrefix}Tools completed:\n\n${toolSummaries}\n\nLabel:`,
      signal,
      options: {
        querySource: 'tool_use_summary_generation',
        enablePromptCaching: true,
        agents: [],
        isNonInteractiveSession,
        hasAppendSystemPrompt: false,
        mcpTools: [],
      },
    })

    const summary = response.message.content
      .filter(block => block.type === 'text')
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    return summary || null
  } catch (error) {
    // Log but don't fail - summaries are non-critical
    const err = toError(error)
    err.cause = { errorId: E_TOOL_USE_SUMMARY_GENERATION_FAILED }
    logError(err)
    return createDeterministicToolUseSummary(tools)
  }
}

export function buildToolUseSummaryPromptItems(tools: ToolInfo[]): ToolUseSummaryPromptItem[] {
  return tools.map(tool => ({
    name: tool.name,
    input: truncateJson(redactSummaryValue(tool.input), 300),
    output: truncateJson(redactSummaryValue(tool.output), 300),
  }))
}

export function createDeterministicToolUseSummary(tools: ToolInfo[]): string | null {
  const first = tools[0]
  if (!first) return null
  if (tools.length === 1) return `Ran ${first.name}`
  const uniqueNames = Array.from(new Set(tools.map(tool => tool.name))).slice(0, 3)
  return `Ran ${tools.length} tools: ${uniqueNames.join(', ')}`
}

function redactSummaryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSummaryValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveSummaryKey(key) ? '[redacted]' : redactSummaryValue(child)
    }
    return out
  }
  if (typeof value === 'string') {
    return value
      .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[redacted]')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted]')
  }
  return value
}

function isSensitiveSummaryKey(key: string): boolean {
  return /token|secret|password|passwd|api[_-]?key|authorization|credential|cookie/i.test(key)
}

/**
 * Truncates a JSON value to a maximum length for the prompt.
 */
function truncateJson(value: unknown, maxLength: number): string {
  try {
    const str = jsonStringify(value)
    if (str.length <= maxLength) {
      return str
    }
    return str.slice(0, maxLength - 3) + '...'
  } catch {
    return '[unable to serialize]'
  }
}
