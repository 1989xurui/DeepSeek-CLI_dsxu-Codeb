import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  exportTrainingTrajectoryFromRuntimeFile,
  exportTrainingTrajectoryFromRuntimeJsonl,
  summarizeRuntimeRecords,
} from '../runtime-importer'
import { scoreTrainingTrajectory } from '../scorer'
import { validateTrainingTrajectory } from '../validator'

describe('DSXU runtime evidence importer', () => {
  test('imports DeepSeek trajectory JSONL without storing raw content', () => {
    const jsonl = [
      {
        ts: '2026-05-20T00:00:00.000Z',
        event: 'request_plan',
        requestTag: 'req-1',
        redacted: true,
        modelName: 'deepseek-v4-flash',
        routeReason: 'planning_flash',
      },
      {
        ts: '2026-05-20T00:00:01.000Z',
        event: 'request_messages',
        requestTag: 'req-1',
        redacted: true,
        assistantToolCalls: [{ id: 'tool-1', name: 'Read', argumentChars: 42, argumentHash: 'hash-args' }],
        toolResults: [{ toolCallId: 'tool-1', contentChars: 128, contentHash: 'hash-result' }],
        toolResultCount: 1,
        rawContentStored: false,
      },
      {
        ts: '2026-05-20T00:00:02.000Z',
        event: 'response_usage',
        requestTag: 'req-1',
        requestId: 'rid-1',
        redacted: true,
        responseModel: 'deepseek-v4-flash',
        routeReason: 'planning_flash',
        usage: {
          input_tokens: 1000,
          output_tokens: 80,
          cache_read_input_tokens: 700,
          cache_creation_input_tokens: 300,
        },
      },
    ].map(record => JSON.stringify(record)).join('\n')

    const result = exportTrainingTrajectoryFromRuntimeJsonl(jsonl, {
      taskId: 'runtime-import-test',
      verificationCommands: ['bun test src/dsxu/training/__tests__/runtime-importer.test.ts'],
      verificationPassed: true,
      claimBound: true,
    })

    expect(result.summary).toMatchObject({
      recordCount: 3,
      requestCount: 1,
      toolCallCount: 1,
      toolResultCount: 1,
      toolResultChars: 128,
      model: 'deepseek-v4-flash',
      cacheHitInputTokens: 700,
      cacheMissInputTokens: 300,
      rawContentStored: false,
    })
    expect(result.validation.ok).toBe(true)
    expect(validateTrainingTrajectory(result.trajectory).status).toBe('accepted')
    expect(result.trajectory.sourceTruth.sourceBodyStored).toBe(false)
    expect(JSON.stringify(result.trajectory)).not.toContain('raw tool result')
  })

  test('defaults to partial outcome when verification evidence is absent', () => {
    const result = exportTrainingTrajectoryFromRuntimeJsonl(JSON.stringify({
      event: 'request_plan',
      requestTag: 'req-2',
      redacted: true,
      modelName: 'deepseek-v4-flash',
    }))

    expect(result.trajectory.outcome.status).toBe('partial')
    expect(result.trajectory.outcome.publicClaimAllowed).toBe(false)
    expect(validateTrainingTrajectory(result.trajectory).status).toBe('accepted')
  })

  test('reads runtime evidence from file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-training-runtime-import-'))
    const path = join(dir, 'trajectory.jsonl')
    await writeFile(path, `${JSON.stringify({
      event: 'response_usage',
      requestTag: 'req-file',
      redacted: true,
      responseModel: 'deepseek-v4-flash-max',
      usage: { output_tokens: 33 },
    })}\n`, 'utf8')

    const result = await exportTrainingTrajectoryFromRuntimeFile(path, { taskId: 'file-import' })

    expect(result.summary.model).toBe('deepseek-v4-flash-max')
    expect(result.summary.outputTokens).toBe(33)
    expect(result.trajectory.task.taskId).toBe('file-import')
  })

  test('summarizes unredacted records as risky evidence', () => {
    const summary = summarizeRuntimeRecords([{ event: 'request_plan', requestTag: 'unsafe' }])

    expect(summary.rawContentStored).toBe(true)
  })

  test('validator and scorer can unwrap runtime import artifacts', () => {
    const result = exportTrainingTrajectoryFromRuntimeJsonl(JSON.stringify({
      event: 'request_plan',
      requestTag: 'artifact',
      redacted: true,
      modelName: 'deepseek-v4-flash',
    }))
    const artifact = {
      schemaVersion: 'dsxu.training-runtime-import-artifact.v1',
      summary: result.summary,
      trajectory: result.trajectory,
    }

    expect(validateTrainingTrajectory(artifact).status).toBe('accepted')
    expect(scoreTrainingTrajectory(artifact).status).toBe('scored')
  })
})
