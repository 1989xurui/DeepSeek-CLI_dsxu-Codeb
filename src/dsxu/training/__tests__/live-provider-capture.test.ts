import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runLiveProviderCaptureSmoke } from '../live-provider-capture'

describe('DSXU live provider capture smoke', () => {
  test('writes an explicit skipped artifact when no API key is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-live-provider-skip-'))
    const outputPath = join(dir, 'live-provider.json')
    const tracePath = join(dir, 'trajectory.jsonl')

    const artifact = await runLiveProviderCaptureSmoke({
      outputPath,
      tracePath,
      apiKey: '',
      model: 'deepseek-v4-flash',
    })

    expect(artifact.status).toBe('SKIPPED_NO_API_KEY')
    expect(artifact.liveProviderAttempted).toBe(false)
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.liveProviderClaimAllowed).toBe(false)
    expect(artifact.skipReason).toContain('DEEPSEEK_API_KEY')
    expect(await readJson(outputPath)).toMatchObject({
      status: 'SKIPPED_NO_API_KEY',
      publicClaimAllowed: false,
    })
  })

  test('imports redacted adapter trajectory from a mocked live provider response', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-live-provider-pass-'))
    const outputPath = join(dir, 'live-provider.json')
    const tracePath = join(dir, 'trajectory.jsonl')
    const fetchImpl: typeof fetch = async (_url, init) => {
      expect(String((init?.headers as Record<string, string>)?.Authorization ?? '')).toBe('Bearer test-secret-key')
      return new Response(JSON.stringify({
        id: 'mock-chatcmpl-1',
        model: 'deepseek-v4-flash',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'DSXU live provider smoke is reachable.',
            },
          },
        ],
        usage: {
          prompt_tokens: 40,
          completion_tokens: 8,
          total_tokens: 48,
          prompt_cache_hit_tokens: 20,
          prompt_cache_miss_tokens: 20,
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'mock-request-id',
        },
      })
    }

    const artifact = await runLiveProviderCaptureSmoke({
      outputPath,
      tracePath,
      apiKey: 'test-secret-key',
      model: 'deepseek-v4-flash',
      fetchImpl,
    })
    const serializedArtifact = await readFile(outputPath, 'utf8')
    const serializedTrace = await readFile(tracePath, 'utf8')

    expect(artifact.status).toBe('PASS_LIVE_PROVIDER_CAPTURE')
    expect(artifact.liveProviderAttempted).toBe(true)
    expect(artifact.import?.validation.status).toBe('accepted')
    expect(artifact.import?.score.status).toBe('scored')
    expect(artifact.import?.summary.recordCount).toBeGreaterThanOrEqual(4)
    expect(artifact.import?.summary.rawContentStored).toBe(false)
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(serializedArtifact).not.toContain('test-secret-key')
    expect(serializedTrace).not.toContain('test-secret-key')
    expect(serializedTrace).not.toContain('DSXU live provider smoke is reachable.')
    expect(serializedTrace).toContain('"redacted":true')
  })

  test('records failed live attempts without turning them into public claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-live-provider-fail-'))
    const outputPath = join(dir, 'live-provider.json')
    const tracePath = join(dir, 'trajectory.jsonl')
    const fetchImpl: typeof fetch = async () => new Response('unauthorized', { status: 401 })

    const artifact = await runLiveProviderCaptureSmoke({
      outputPath,
      tracePath,
      apiKey: 'bad-key',
      model: 'deepseek-v4-flash',
      fetchImpl,
    })

    expect(artifact.status).toBe('FAIL_LIVE_PROVIDER_CAPTURE')
    expect(artifact.liveProviderAttempted).toBe(true)
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.liveProviderClaimAllowed).toBe(false)
    expect(artifact.error?.message).not.toContain('bad-key')
    expect(artifact.import?.validation.status).toBe('accepted')
    expect(artifact.import?.trajectory.outcome.status).toBe('failed')
  })
})

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}
