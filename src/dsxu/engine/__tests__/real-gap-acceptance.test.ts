import { describe, expect, test } from 'bun:test'
import {
  buildDsxuV20RealGapAcceptanceSummary,
  classifyV20ProjectIntakeFiles,
} from '../real-gap-acceptance'
import {
  buildDsxuOperatorStateProjection,
  createDsxuControlSessionRegistry,
} from '../../control-plane'

describe('V20 real-gap acceptance owner routes', () => {
  test('maps external project intake files into existing owners without local runtimes', () => {
    const decisions = classifyV20ProjectIntakeFiles([
      'sample/DSXU.md',
      'sample/DSXU.local.md',
      'sample/.mcp.json',
      'sample/.dsxu/commands/fix.md',
      'sample/.dsxu/skills/reviewer/SKILL.md',
      'sample/.dsxu/settings.json',
      'sample/.dsxu/hooks.json',
      'sample/.dsxu/plugins/repo/commands/ship.md',
      'sample/src/app.ts',
    ])

    expect(decisions).toHaveLength(9)
    expect(decisions.every(decision => decision.activeRuntimeAdded === false)).toBe(true)
    expect(decisions.map(decision => decision.owner)).toContain('DSXU MCP Config')
    expect(decisions.map(decision => decision.owner)).toContain('DSXU Skills Loader')
    expect(decisions.map(decision => decision.owner)).toContain('DSXU Plugin Runtime')
    expect(decisions.map(decision => decision.owner)).toContain(
      'DSXU Settings / Hooks Owner',
    )
    expect(decisions.map(decision => decision.kind)).toContain('ordinary_project_file')
    expect(decisions.every(decision =>
      decision.decision === 'MAINLINE_OWNER_ACCEPTED' ||
      decision.decision === 'READ_ONLY_CONTEXT_ACCEPTED',
    )).toBe(true)
  })

  test('builds batch acceptance packets for external host, chat API, intake, and operator dashboard', () => {
    const summary = buildDsxuV20RealGapAcceptanceSummary({
      projectIntakePaths: [
        'project/DSXU.md',
        'project/.mcp.json',
        'project/.dsxu/commands/review.md',
        'project/.dsxu/skills/fix/SKILL.md',
        'project/.dsxu/settings.json',
      ],
      targetReferenceManifestImported: false,
    })

    expect(summary.packetCount).toBe(5)
    expect(summary.focusedReadyPackets).toBe(4)
    expect(summary.liveInputRequiredPackets).toBe(1)
    expect(summary.unknownProjectInputs).toBe(0)
    expect(summary.noSecondRuntime).toBe(true)

    const host = summary.packets.find(packet => packet.id === 'V20-RG-02-external-agent-host')
    expect(host?.mainlineRoute.join('\n')).toContain('DSXU Tool Gate')
    expect(host?.prohibitedRuntime).toContain('no standalone agent orchestrator')

    const chat = summary.packets.find(packet => packet.id === 'V20-RG-03-external-chat-agent-api')
    expect(chat?.owner).toBe('DSXU Model Router / Cost Evidence Owner')
    expect(chat?.evidence.join('\n')).toContain('explicit operator opt-in')

    const dashboard = summary.packets.find(packet => packet.id === 'V20-RG-04-operator-dashboard')
    expect(dashboard?.prohibitedRuntime).toContain('no dashboard MCP client')

    const p12 = summary.packets.at(-1)
    expect(p12?.status).toBe('LIVE_TARGET_INPUT_REQUIRED')
    expect(p12?.remainingLiveInput).toContain(
      'targetReferenceManifestPath still required for final P12 PASS',
    )
  })

  test('projects operator dashboard state from control-plane registry without executing tools', () => {
    const registry = createDsxuControlSessionRegistry()
    registry.upsertSession({
      sessionId: 'remote-1',
      mode: 'remote',
      status: 'connected',
      viewerOnly: false,
      cwd: 'D:/work/project',
      now: 1000,
    })
    registry.recordMessage('remote-1', {
      direction: 'inbound',
      type: 'agent_status',
      summary: 'worker started',
      createdAt: 1001,
    })
    registry.recordPermissionRequest({
      sessionId: 'remote-1',
      requestId: 'perm-1',
      toolUseId: 'tool-1',
      toolName: 'Bash',
      input: { command: 'npm test' },
      now: 1002,
    })

    const projection = buildDsxuOperatorStateProjection(registry)

    expect(projection.runtime).toBe('DSXU Operator Visible-State Projection')
    expect(projection.sessionCount).toBe(1)
    expect(projection.activeSessionCount).toBe(1)
    expect(projection.pendingPermissionCount).toBe(1)
    expect(projection.visiblePermissionPrompts).toEqual([
      {
        requestId: 'perm-1',
        sessionId: 'remote-1',
        toolName: 'Bash',
        summary: 'Permission requested for Bash; requestId=perm-1',
        hiddenWaiting: false,
      },
    ])
    expect(projection.releaseRiskControls).toContain(
      'dashboard state does not create provider, MCP, shell, or tool execution clients',
    )
  })
})
