import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { runBrowserDevServerProofHarness } from '../../integration/harness/browser-dev-server-proof-v1-harness'

describe('browser dev-server proof V1', () => {
  test('returns screenshot proof or explicit blocked evidence instead of hanging', async () => {
    const result = await runBrowserDevServerProofHarness({
      scenarioName: 'browser-dev-server-proof-focused',
      timeoutMs: 18_000,
      readyDelayMs: 300,
    })

    expect(result.elapsedMs).toBeLessThanOrEqual(result.timeoutMs + 4_000)
    expect(result.ok || result.blocked).toBe(true)
    expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
    expect((await stat(result.tracePath)).size).toBeGreaterThan(0)

    if (result.ok) {
      expect(result.completedWithinTimeout).toBe(true)
      expect(result.browserStrategy).toContain('chromium')
      expect(result.browserExecutablePath).toContain('chrome')
      expect(result.status).toBe(200)
      expect(result.contentType).toContain('text/html')
      expect(result.rootText).toBe('DSXU_BROWSER_READY')
      expect(result.screenshotBytes).toBeGreaterThan(0)
      const trace = await readFile(result.tracePath, 'utf8')
      expect(trace).toContain('browser_proof.passed')
      return
    }

    expect(result.blocked).toBe(true)
    expect(result.error ?? '').not.toBe('')
    const trace = await readFile(result.tracePath, 'utf8')
    expect(trace).toContain('browser_proof.blocked')
  }, 30_000)
})
