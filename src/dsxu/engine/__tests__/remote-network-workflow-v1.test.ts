import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { runRemoteNetworkWorkflowHarness } from '../../integration/harness/remote-network-workflow-v1-harness'

describe('Remote Network Workflow V1', () => {
  test('replays remote connect, permission, task verification, reconnect, cancel, and allowlisted network proof', async () => {
    const result = await runRemoteNetworkWorkflowHarness()

    expect(result.ok, result.error).toBe(true)
    expect(result.connectedCount).toBeGreaterThanOrEqual(2)
    expect(result.reconnectingCount).toBe(1)
    expect(result.disconnectedCount).toBe(1)
    expect(result.permissionPromptCount).toBe(1)
    expect(result.permissionStatus).toBe('answered')
    expect(result.peerMessageCount).toBe(1)
    expect(result.taskStatuses).toEqual(['queued', 'running', 'completed', 'failed'])
    expect(result.controlMessageTypes).toContain('verification_result')
    expect(result.verificationSummary).toContain('PASS')
    expect(result.networkProof).toMatchObject({
      deniedReason: 'relay_disabled',
      liveStatus: 200,
      liveBodyOk: true,
      sawAuthorizationHeader: false,
      sawRequestIdHeader: true,
      proxyEnvDeniedReason: 'proxy_env_disabled',
      proxyEnvApplied: true,
    })
    expect(result.networkProof.sanitizedHeaderNames).toContain('x-request-id')
    expect(result.networkProof.sanitizedHeaderNames).not.toContain('authorization')
    expect(existsSync(result.evidencePath)).toBe(true)
    expect(readFileSync(result.tracePath, 'utf8')).toContain(
      'network.allowlist_live_proof',
    )
  }, 15_000)
})
