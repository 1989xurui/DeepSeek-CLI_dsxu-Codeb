import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { runControlPlaneStageAcceptanceHarness } from '../../integration/harness/control-plane-stage-acceptance-v1-harness'

describe('DSXU Control Plane CP12 Stage Acceptance V1', () => {
  test('aggregates control, remote, network, provider, no-legacy, and help smoke evidence', async () => {
    const result = await runControlPlaneStageAcceptanceHarness()
    const checkNames = result.checks.map(check => check.name)

    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
    expect(checkNames).toEqual([
      'no-legacy-directory-regression',
      'provider-compat-facade-thin',
      'control-messaging-visible-permission',
      'sdk-control-message-adapter',
      'remote-session-lifecycle-shared-registry',
      'network-facade-default-deny-and-sanitized-proxy',
      'provider-contract-defaults',
      'default-help-smoke',
    ])
    expect(existsSync(result.evidencePath)).toBe(true)

    const evidence = JSON.parse(readFileSync(result.evidencePath, 'utf8')) as {
      ok: boolean
      checks: Array<{ name: string; ok: boolean; evidence: Record<string, unknown> }>
    }
    expect(evidence.ok).toBe(true)
    expect(evidence.checks.every(check => check.ok)).toBe(true)
    expect(
      evidence.checks.find(check => check.name === 'default-help-smoke')?.evidence,
    ).toMatchObject({
      commandName: 'help',
      commandType: 'local-jsx',
      hasLoaderCall: true,
      importedByDefaultCommands: true,
      registeredInDefaultCommands: true,
      remoteSafe: true,
    })
  })
})
