import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readRuntimeCaptureArtifact, runRuntimeCapture } from '../runtime-capture'
import { scoreTrainingTrajectory } from '../scorer'
import { validateTrainingTrajectory } from '../validator'

describe('DSXU runtime capture runner', () => {
  test('wraps a command with DSXU_DEEPSEEK_TRAJECTORY_FILE and imports captured evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-runtime-capture-'))
    const outputPath = join(dir, 'capture.json')
    const writer = [
      'const path = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE;',
      'if (!path) throw new Error("missing trajectory env");',
      'const lines = [',
      '  { event: "request_plan", requestTag: "capture-1", redacted: true, modelName: "deepseek-v4-flash", routeReason: "capture-test" },',
      '  { event: "request_messages", requestTag: "capture-1", redacted: true, assistantToolCalls: [{ id: "tool-1", name: "Read", argumentChars: 10, argumentHash: "h" }], toolResults: [{ toolCallId: "tool-1", contentChars: 22, contentHash: "rh" }], toolResultCount: 1, rawContentStored: false },',
      '  { event: "response_usage", requestTag: "capture-1", redacted: true, responseModel: "deepseek-v4-flash", usage: { output_tokens: 9, cache_read_input_tokens: 7, cache_creation_input_tokens: 3 } }',
      '];',
      'await Bun.write(path, lines.map(line => JSON.stringify(line)).join("\\n") + "\\n");',
      'console.log("capture writer ok");',
    ].join('\n')

    const artifact = await runRuntimeCapture({
      command: [process.execPath, '-e', writer],
      cwd: process.cwd(),
      outputPath,
      taskId: 'runtime-capture-test',
      timeoutMs: 30_000,
    })
    const saved = await readRuntimeCaptureArtifact(outputPath)

    expect(artifact.exitCode).toBe(0)
    expect(artifact.trajectoryCaptured).toBe(true)
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.import?.validation.status).toBe('accepted')
    expect(artifact.import?.summary.toolCallCount).toBe(1)
    expect(artifact.import?.summary.toolResultCount).toBe(1)
    expect(artifact.import?.trajectory.outcome.status).toBe('partial')
    expect(existsSync(artifact.tracePath)).toBe(true)
    expect(existsSync(artifact.stdoutPath)).toBe(true)
    expect(saved.schemaVersion).toBe('dsxu.training-runtime-capture.v1')
    expect(validateTrainingTrajectory(saved).status).toBe('accepted')
    expect(scoreTrainingTrajectory(saved).status).toBe('scored')
  })
})
