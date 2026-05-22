import { z } from 'zod/v4'

const inputSchema = z.object({}).passthrough()
const outputSchema = z.object({
  success: z.boolean(),
  error: z.string(),
})

export const TungstenTool = {
  name: 'tungsten',
  runtimeMetadata: {
    owner: 'DSXU Disabled Recovery Stub',
    sideEffects: [
      'none-disabled-tool',
    ],
    permission: 'deny always; unavailable in local recovery build',
    evidence: [
      'isEnabled false',
      'deny permission decision',
      'unavailable call result',
    ],
    uiProjection: 'disabled tool error only',
  },
  aliases: [],
  maxResultSizeChars: 0,
  inputSchema,
  outputSchema,
  async description() {
    return 'Unavailable in this local recovery build.'
  },
  async prompt() {
    return 'TungstenTool is unavailable in this local recovery build.'
  },
  async call() {
    return {
      data: {
        success: false,
        error: 'TungstenTool is unavailable in this local recovery build.',
      },
    }
  },
  isConcurrencySafe() {
    return true
  },
  isEnabled() {
    return false
  },
  isReadOnly() {
    return true
  },
  async checkPermissions() {
    return {
      behavior: 'deny' as const,
      message: 'TungstenTool is unavailable in this local recovery build.',
    }
  },
}

export function clearSessionsWithTungstenUsage(): void {}

export function resetInitializationState(): void {}
