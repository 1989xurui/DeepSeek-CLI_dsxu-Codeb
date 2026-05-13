import { describe, expect, test } from 'bun:test'
import {
  createDsxuControlSessionRegistry,
  createDsxuVisiblePermissionPrompt,
} from '../../control-plane'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../provider-backend/dsxu-remote-session-manager'
import { convertSDKMessage } from '../provider-backend/dsxu-sdk-message-adapter'
import { createDsxuLocalProviderBackend } from '../provider-backend/local-provider-backend'

const waitTick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('DSXU Remote Lifecycle V1', () => {
  test('uses the shared control registry across connect, send, permission cancel, reconnect, and disconnect', async () => {
    const registry = createDsxuControlSessionRegistry()
    const backend = createDsxuLocalProviderBackend()
    const messages: string[] = []
    const permissionPrompts: string[] = []
    const cancelled: string[] = []
    let connectedCount = 0
    let reconnectingCount = 0

    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        'remote-life-1',
        () => 'unused-token',
        'org-local',
        true,
        true,
        registry,
      ),
      {
        onConnected: () => {
          connectedCount += 1
        },
        onReconnecting: () => {
          reconnectingCount += 1
        },
        onMessage: message => {
          messages.push(message.type)
        },
        onPermissionRequest: (request, requestId) => {
          const recorded = registry.getSession('remote-life-1')?.permissionRequests[requestId]
          if (!recorded) throw new Error('permission request not recorded')
          permissionPrompts.push(
            createDsxuVisiblePermissionPrompt({
              sessionId: 'remote-life-1',
              request: recorded,
            }).summary,
          )
          expect(request.tool_name).toBe('Bash')
        },
        onPermissionCancelled: requestId => {
          cancelled.push(requestId)
        },
      },
      backend,
    )

    manager.connect()
    await waitTick()

    expect(connectedCount).toBe(1)
    expect(registry.listSessions()).toHaveLength(1)
    expect(registry.getSession('remote-life-1')).toMatchObject({
      mode: 'remote',
      status: 'connected',
      viewerOnly: true,
      metadata: {
        orgUuid: 'org-local',
        hasInitialPrompt: true,
        runtime: 'dsxu-control-plane',
      },
    })

    await manager.sendMessage('implement the focused fix', { uuid: 'msg-1' })
    expect(messages).toContain('user')
    expect(backend.readPeerMessages('remote-life-1')).toHaveLength(1)
    expect(registry.getSession('remote-life-1')?.messages).toMatchObject([
      {
        direction: 'outbound',
        type: 'peer_message',
      },
    ])

    manager.injectControlMessageForTest({
      type: 'control_request',
      request_id: 'perm-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        tool_use_id: 'tool-bash-1',
        input: { command: 'echo ok' },
      },
    })
    expect(permissionPrompts[0]).toContain('Bash')
    expect(registry.getSession('remote-life-1')?.permissionRequests['perm-1']?.status).toBe('pending')

    manager.injectControlMessageForTest({
      type: 'control_cancel_request',
      request_id: 'perm-1',
    })
    expect(cancelled).toEqual(['perm-1'])
    expect(registry.getSession('remote-life-1')?.permissionRequests['perm-1']?.status).toBe('cancelled')

    manager.reconnect()
    await waitTick()
    expect(reconnectingCount).toBe(1)
    expect(connectedCount).toBe(2)
    expect(registry.listSessions()).toHaveLength(1)
    expect(registry.getSession('remote-life-1')?.status).toBe('connected')

    manager.disconnect()
    expect(registry.getSession('remote-life-1')?.status).toBe('closed')
  })

  test('converts SDK lifecycle messages into visible DSXU UI messages without leaking success noise', () => {
    expect(
      convertSDKMessage({
        type: 'system',
        subtype: 'init',
        session_id: 'remote-life-2',
        model: 'deepseek-v4-pro',
      } as any),
    ).toMatchObject({
      type: 'message',
      message: {
        type: 'system',
        content: 'DSXU provider session initialized (model: deepseek-v4-pro)',
      },
    })

    expect(
      convertSDKMessage({
        type: 'tool_progress',
        tool_name: 'Bash',
        elapsed_time_seconds: 12,
        tool_use_id: 'tool-1',
      } as any),
    ).toMatchObject({
      type: 'message',
      message: {
        content: 'Tool Bash running for 12s...',
        toolUseID: 'tool-1',
      },
    })

    expect(
      convertSDKMessage({
        type: 'result',
        subtype: 'success',
        result: 'done',
      } as any),
    ).toEqual({ type: 'ignored' })

    expect(
      convertSDKMessage({
        type: 'result',
        subtype: 'error_max_turns',
        errors: ['max turns exceeded'],
      } as any),
    ).toMatchObject({
      type: 'message',
      message: {
        level: 'warning',
        content: 'max turns exceeded',
      },
    })
  })

  test('lazy send before connect still registers a remote control session', async () => {
    const registry = createDsxuControlSessionRegistry()
    const backend = createDsxuLocalProviderBackend()
    const messages: string[] = []
    let connectedCount = 0

    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        'remote-lazy-send-1',
        () => 'unused-token',
        'org-local',
        false,
        false,
        registry,
      ),
      {
        onConnected: () => {
          connectedCount += 1
        },
        onMessage: message => {
          messages.push(message.type)
        },
        onPermissionRequest: () => {},
      },
      backend,
    )

    const sent = await manager.sendMessage('continue this remote task', { uuid: 'lazy-msg-1' })

    expect(sent).toBe(true)
    expect(connectedCount).toBe(1)
    expect(messages).toContain('user')
    expect(backend.readPeerMessages('remote-lazy-send-1')).toHaveLength(1)
    expect(registry.listSessions()).toHaveLength(1)
    expect(registry.getSession('remote-lazy-send-1')).toMatchObject({
      mode: 'remote',
      status: 'connected',
      viewerOnly: false,
      metadata: {
        orgUuid: 'org-local',
        hasInitialPrompt: false,
        runtime: 'dsxu-control-plane-lazy-connect',
      },
    })
    expect(registry.getSession('remote-lazy-send-1')?.messages).toMatchObject([
      {
        direction: 'outbound',
        type: 'peer_message',
      },
    ])
  })
})
