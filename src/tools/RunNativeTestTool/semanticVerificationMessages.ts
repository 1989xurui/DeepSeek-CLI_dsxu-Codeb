import type { Message } from '../../types/message.js'
import type { ToolUseBlock } from '../../types/providerSdk.js'
import {
  type SemanticVerificationEvent,
} from '../../dsxu/engine/semantic-tools.js'

function contentArray(message: Message): unknown[] {
  if (!('message' in message) || !message.message) return []
  const content = message.message.content
  return Array.isArray(content) ? content : []
}

function textFromBlock(block: unknown): string {
  if (!block || typeof block !== 'object') return ''
  const candidate = block as { text?: unknown; content?: unknown }
  if (typeof candidate.text === 'string') return candidate.text
  if (typeof candidate.content === 'string') return candidate.content
  return ''
}

function hasSourceMutation(text: string): boolean {
  return /DSXU tool state:\s*(?:edit_applied|edit_already_applied|write_applied|file_written)\b/i.test(text)
}

function exitCodeFromResult(text: string, isError: unknown): number | null {
  if (!isError && /DSXU tool state:\s*verification_passed\b/i.test(text)) return 0
  if (!isError && /\b\d+\s+pass\b/i.test(text) && /\b0\s+fail\b/i.test(text)) return 0
  const match = text.match(/\bExit code\s+(\d+)\b/i)
  if (match) return Number(match[1])
  return isError ? 1 : null
}

export function extractSemanticVerificationEventsFromMessages(
  messages: readonly Message[] | undefined,
): SemanticVerificationEvent[] {
  const pending = new Map<
    string,
    { tool: 'Bash' | 'PowerShell' | 'RunNativeTest'; command: string; cwd?: string; sourceVersion: number }
  >()
  const events: SemanticVerificationEvent[] = []
  let sourceVersion = 0

  for (const message of messages ?? []) {
    for (const block of contentArray(message)) {
      if (!block || typeof block !== 'object') continue
      const candidate = block as Partial<ToolUseBlock> & {
        type?: unknown
        tool_use_id?: unknown
        content?: unknown
        is_error?: unknown
      }
      if (
        candidate.type === 'tool_use' &&
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string'
      ) {
        const input = candidate.input as { command?: unknown; cwd?: unknown } | undefined
        if (
          (candidate.name === 'Bash' ||
            candidate.name === 'PowerShell' ||
            candidate.name === 'RunNativeTest') &&
          typeof input?.command === 'string'
        ) {
          pending.set(candidate.id, {
            tool: candidate.name,
            command: input.command,
            cwd: typeof input.cwd === 'string' ? input.cwd : undefined,
            sourceVersion,
          })
        }
        continue
      }
      if (candidate.type !== 'tool_result') {
        const text = textFromBlock(block)
        if (hasSourceMutation(text)) sourceVersion++
        continue
      }
      const text = typeof candidate.content === 'string' ? candidate.content : ''
      if (hasSourceMutation(text)) sourceVersion++
      if (typeof candidate.tool_use_id !== 'string') continue
      const run = pending.get(candidate.tool_use_id)
      if (!run) continue
      events.push({
        id: candidate.tool_use_id,
        tool: run.tool,
        command: run.command,
        cwd: run.cwd,
        exitCode: exitCodeFromResult(text, candidate.is_error),
        output: text,
        sourceChangedBeforeRun: run.sourceVersion > 0,
      })
      pending.delete(candidate.tool_use_id)
    }
  }
  return events
}

export function hasSourceMutationAfterLatestSameFailedVerification(
  messages: readonly Message[] | undefined,
  sameIntent: (event: SemanticVerificationEvent) => boolean,
): boolean {
  return hasSourceMutationAfterLatestSameVerification(messages, sameIntent)
}

export function hasSourceMutationAfterLatestSameVerification(
  messages: readonly Message[] | undefined,
  sameIntent: (event: SemanticVerificationEvent) => boolean,
): boolean {
  let sourceVersion = 0
  let latestSameSourceVersion: number | null = null
  const pending = new Map<string, { event: SemanticVerificationEvent; sourceVersion: number }>()

  for (const message of messages ?? []) {
    for (const block of contentArray(message)) {
      if (!block || typeof block !== 'object') continue
      const candidate = block as Partial<ToolUseBlock> & {
        type?: unknown
        tool_use_id?: unknown
        content?: unknown
        is_error?: unknown
      }
      if (
        candidate.type === 'tool_use' &&
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string'
      ) {
        const input = candidate.input as { command?: unknown; cwd?: unknown } | undefined
        if (
          (candidate.name === 'Bash' ||
            candidate.name === 'PowerShell' ||
            candidate.name === 'RunNativeTest') &&
          typeof input?.command === 'string'
        ) {
          pending.set(candidate.id, {
            event: {
              id: candidate.id,
              tool: candidate.name,
              command: input.command,
              cwd: typeof input.cwd === 'string' ? input.cwd : undefined,
            },
            sourceVersion,
          })
        }
        continue
      }

      const text = typeof candidate.content === 'string' ? candidate.content : textFromBlock(block)
      if (candidate.type === 'tool_result' && typeof candidate.tool_use_id === 'string') {
        const pendingRun = pending.get(candidate.tool_use_id)
        if (pendingRun) {
          if (sameIntent(pendingRun.event)) {
            latestSameSourceVersion = pendingRun.sourceVersion
          }
          pending.delete(candidate.tool_use_id)
        }
      }
      if (hasSourceMutation(text)) sourceVersion++
    }
  }

  return latestSameSourceVersion !== null && sourceVersion > latestSameSourceVersion
}
