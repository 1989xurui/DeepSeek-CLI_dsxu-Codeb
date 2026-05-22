import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runQuery } from '../../engine/query-loop'
import type { QueryEngineConfig, ToolResult } from '../../engine/types'
import { QUERY_LOOP_CAPTURE_ENV, QUERY_LOOP_CAPTURE_SCHEMA_VERSION } from '../query-loop-capture'

const originalCapturePath = process.env[QUERY_LOOP_CAPTURE_ENV]

afterEach(() => {
  if (originalCapturePath === undefined) {
    delete process.env[QUERY_LOOP_CAPTURE_ENV]
  } else {
    process.env[QUERY_LOOP_CAPTURE_ENV] = originalCapturePath
  }
})

describe('query-loop opt-in training capture', () => {
  it('writes a redacted training capture artifact when the env var is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsxu-training-query-loop-capture-'))
    const output = join(dir, 'capture.json')
    process.env[QUERY_LOOP_CAPTURE_ENV] = output

    const result = await runQuery(
      buildCaptureConfig(),
      [{ role: 'user', content: 'Capture this query-loop task as training evidence.' }],
      buildCaptureRegistry() as any,
      {
        sessionId: 'capture-session',
        requestId: 'capture-request',
        taskQuery: 'Capture this query-loop task as training evidence.',
      },
    )

    expect(result.exitReason).toBe('end_turn')
    expect(existsSync(output)).toBe(true)
    const artifact = JSON.parse(await readFile(output, 'utf8')) as any
    expect(artifact.schemaVersion).toBe(QUERY_LOOP_CAPTURE_SCHEMA_VERSION)
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.validation.status).toBe('accepted')
    expect(artifact.score.status).toBe('scored')
    expect(artifact.capture.eventTypes).toEqual(expect.arrayContaining(['loop_started', 'model_called', 'tool_result', 'loop_finished']))
    expect(artifact.trajectory.sourceTruth.sourceBodyStored).toBe(false)
    expect(artifact.trajectory.toolTrace.map((tool: any) => tool.toolName)).toEqual(['Read', 'Bash'])
    expect(artifact.trajectory.outcome.publicClaimAllowed).toBe(false)
  })

  it('does not block runQuery when the capture path cannot be written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsxu-training-query-loop-capture-blocked-'))
    process.env[QUERY_LOOP_CAPTURE_ENV] = dir

    const result = await runQuery(
      buildCaptureConfig({ toolUse: false }),
      [{ role: 'user', content: 'Finish even if capture write fails.' }],
      buildCaptureRegistry() as any,
      {
        sessionId: 'capture-failure-session',
        requestId: 'capture-failure-request',
        taskQuery: 'Finish even if capture write fails.',
      },
    )

    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toContain('No tool needed')
  })
})

function buildCaptureConfig(options: { toolUse?: boolean } = {}): QueryEngineConfig {
  const toolUse = options.toolUse ?? true
  let callCount = 0
  return {
    cwd: process.cwd(),
    maxTurns: 3,
    toolExecution: { mode: 'sequential' },
    sessionSummary: { enabled: false },
    sessionMemory: { enabled: false },
    memoryExtraction: { enabled: false },
    agentSummary: { enabled: false },
    llmCall: async () => {
      callCount += 1
      if (toolUse && callCount === 1) {
        return {
          content: 'I will gather source truth and verify.',
          stopReason: 'tool_use',
          toolCalls: [
            {
              id: 'capture-read-1',
              name: 'Read',
              arguments: { file_path: 'src/dsxu/engine/query-loop.ts' },
            },
            {
              id: 'capture-bash-1',
              name: 'Bash',
              arguments: { command: 'bun test src/dsxu/training/__tests__/query-loop-capture.test.ts' },
            },
          ],
          usage: {
            inputTokens: 800,
            outputTokens: 120,
            cacheHit: true,
            cacheReadTokens: 600,
            cacheCreationTokens: 80,
          },
        }
      }
      return {
        content: toolUse ? 'Verification passed and capture can be written.' : 'No tool needed; final answer only.',
        stopReason: 'end_turn',
        toolCalls: [],
        usage: {
          inputTokens: 320,
          outputTokens: 48,
          cacheHit: true,
          cacheReadTokens: 280,
          cacheCreationTokens: 0,
        },
      }
    },
  }
}

function buildCaptureRegistry() {
  const schemas = [
    {
      name: 'Read',
      description: 'Read source truth',
      inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
    },
    {
      name: 'Bash',
      description: 'Run verification',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  ]
  return {
    getAll: () => schemas,
    get: (name: string) => schemas.find(schema => schema.name === name),
    has: (name: string) => schemas.some(schema => schema.name === name),
    register: () => {},
    unregister: () => {},
    clear: () => {},
    size: schemas.length,
    getSchemas: () => schemas,
    execute: async (name: string, input: Record<string, unknown>, toolUseId: string): Promise<ToolResult> => ({
      toolUseId,
      content: name === 'Bash'
        ? `PASS ${String(input.command ?? 'verification')}`
        : `SOURCE_SUMMARY ${String(input.file_path ?? 'unknown')}`,
      isError: false,
      meta: {
        durationMs: 4,
        executorKind: 'dsxu_native',
        usedBridge: false,
      },
    }),
  }
}
