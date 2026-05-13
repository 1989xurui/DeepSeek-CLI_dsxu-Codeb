import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import {
  evaluateLiveProviderGate,
  writeLiveProviderGateEvidence,
} from '../../integration/harness/live-provider-gate-v1-harness'
import { getV18LiveDeepSeekBenchmarkGate } from '../v18-live-deepseek-benchmark-gate'

describe('live provider gate V1', () => {
  test('reports blocked with evidence when provider credentials are absent', () => {
    const result = evaluateLiveProviderGate({
      env: {},
      generatedAt: '2026-05-07T03:40:00.000Z',
      evidencePath: 'live-provider-gate-test.json',
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('BLOCKED-EVIDENCED')
    expect(result.probe.DEEPSEEK_API_KEY).toBe(false)
    expect(result.blockedItems).toContain(
      'live model-driven Agent worker -> parent synthesis -> final evidence replay',
    )
    expect(JSON.stringify(result)).not.toContain('sk-')
  })

  test('reports ready without leaking secret values when a provider is configured', () => {
    const result = evaluateLiveProviderGate({
      env: {
        DEEPSEEK_API_KEY: 'sk-secret-value',
      },
      generatedAt: '2026-05-07T03:40:00.000Z',
      evidencePath: 'live-provider-gate-test.json',
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('READY')
    expect(result.probe.DEEPSEEK_API_KEY).toBe(true)
    expect(result.blockedItems).toEqual([])
    expect(JSON.stringify(result)).not.toContain('sk-secret-value')
  })

  test('checks the target execution environment instead of assuming Windows env reaches WSL TUI', () => {
    const windowsReady = evaluateLiveProviderGate({
      env: {
        DEEPSEEK_API_KEY: 'sk-secret-value',
      },
      generatedAt: '2026-05-08T02:20:00.000Z',
      evidencePath: 'live-provider-gate-test.json',
    })
    const wslBlocked = evaluateLiveProviderGate({
      executionTarget: 'wsl',
      distro: 'Ubuntu',
      env: {},
      generatedAt: '2026-05-08T02:20:00.000Z',
      evidencePath: 'live-provider-gate-wsl-test.json',
    })

    expect(windowsReady.status).toBe('READY')
    expect(wslBlocked.status).toBe('BLOCKED-EVIDENCED')
    expect(wslBlocked.executionTarget).toBe('wsl')
    expect(wslBlocked.targetProbe?.distro).toBe('Ubuntu')
    expect(wslBlocked.nextStep).toContain('inside the WSL distro')
    expect(JSON.stringify(wslBlocked)).not.toContain('sk-secret-value')
  })

  test('writes current environment evidence for automation', async () => {
    const evidencePath = join(
      process.cwd(),
      '.dsxu',
      'trace',
      'v18-live-provider',
      'live-provider-gate.test.json',
    )
    const result = await writeLiveProviderGateEvidence({
      env: {},
      evidencePath,
      generatedAt: '2026-05-07T03:40:00.000Z',
    })

    expect(result.status).toBe('BLOCKED-EVIDENCED')
    expect((await stat(evidencePath)).size).toBeGreaterThan(0)
    const evidence = await readFile(evidencePath, 'utf8')
    expect(evidence).toContain('"BLOCKED-EVIDENCED"')
    expect(evidence).not.toContain('sk-')
  })

  test('live benchmark gate delegates provider readiness to the unified provider gate', () => {
    const blocked = getV18LiveDeepSeekBenchmarkGate({})
    const ready = getV18LiveDeepSeekBenchmarkGate({
      DSXU_DEEPSEEK_API_KEY: 'sk-secret-value',
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.requiredEnv).toContain('DSXU_DEEPSEEK_API_KEY')
    expect(ready.status).toBe('ready')
    expect(JSON.stringify(ready)).not.toContain('sk-secret-value')
  })
})
