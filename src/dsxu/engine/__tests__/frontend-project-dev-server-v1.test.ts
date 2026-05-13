import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { runFrontendProjectDevServerHarness } from '../../integration/harness/frontend-project-dev-server-v1-harness'

describe('frontend project dev-server V1', () => {
  test('runs a project npm dev script through readiness, browser screenshot, and clean stop', async () => {
    const result = await runFrontendProjectDevServerHarness({
      scenarioName: 'frontend-project-dev-server-focused',
      readyDelayMs: 450,
      timeoutMs: 20_000,
    })

    expect(result.ok, result.error).toBe(true)
    expect(result.command.join(' ')).toContain('run dev')
    expect(result.coldStartStatuses).toContain(503)
    expect(result.readyStatus).toBe(200)
    expect(result.htmlProof.contentType).toContain('text/html')
    expect(result.htmlProof.bodyContainsMarker).toBe(true)
    expect(result.htmlProof.scriptPresent).toBe(true)
    expect(result.screenshotProof.ok).toBe(true)
    expect(result.screenshotProof.strategy).toContain('chromium')
    expect(result.screenshotProof.bytes).toBeGreaterThan(0)
    expect(result.stopStatus).toBe('stopped')
    expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
    expect((await stat(result.screenshotProof.path)).size).toBe(result.screenshotProof.bytes)

    const trace = await readFile(result.tracePath, 'utf8')
    expect(trace).toContain('project.written')
    expect(trace).toContain('dev.started')
    expect(trace).toContain('http.ready')
    expect(trace).toContain('browser.screenshot.pass')
    expect(trace).toContain('dev.stopped')
  }, 35_000)

  test('classifies early native dependency exits instead of fake waiting to timeout', async () => {
    const result = await runFrontendProjectDevServerHarness({
      scenarioName: 'frontend-project-dev-server-missing-native-dependency',
      failFast: 'missing_native_dependency',
      timeoutMs: 20_000,
    })

    expect(result.ok).toBe(false)
    expect(result.processExitedBeforeReady).toBe(true)
    expect(result.failureType).toBe('missing_native_dependency')
    expect(result.elapsedMs).toBeLessThan(5_000)
    expect(result.stderr).toContain('@rolldown/binding-win32-x64-msvc')
    expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)

    const trace = await readFile(result.tracePath, 'utf8')
    expect(trace).toContain('dev.failed')
  }, 10_000)
})
