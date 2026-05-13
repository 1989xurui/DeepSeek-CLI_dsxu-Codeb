/**
 * Branded type for system prompt arrays.
 *
 * This module is intentionally dependency-free so it can be imported
 * from anywhere without risking circular initialization issues.
 */

export type SystemPrompt = readonly string[] & {
  readonly __brand: 'SystemPrompt'
}

export function asSystemPrompt(value: readonly string[]): SystemPrompt {
  return value as SystemPrompt
}

export function processSystemPromptTypeLifecycle(value: readonly string[]): {
  state: 'empty' | 'ready'
  lifecycle: string
  prompt: SystemPrompt
} {
  const prompt = asSystemPrompt(value)
  const state = prompt.length > 0 ? 'ready' : 'empty'
  return {
    state,
    lifecycle: `system-prompt-type:${state}`,
    prompt,
  }
}
