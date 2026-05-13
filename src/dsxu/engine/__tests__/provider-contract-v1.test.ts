import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  createLocalDSXUProviderContract,
  redactCredentialLikeValues,
} from '../provider-contract'
import {
  handleDsxuProviderAliasCommand,
  isDsxuProviderAliasCommand,
} from '../provider-alias'
import {
  createDsxuLocalProviderBackend,
  getDefaultDsxuLocalProviderBackend,
} from '../provider-backend/local-provider-backend'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../provider-backend/dsxu-remote-session-manager'
import { SendMessageTool } from '../../../tools/SendMessageTool/SendMessageTool'
import { getPrompt as getSendMessagePrompt } from '../../../tools/SendMessageTool/prompt'

describe('DSXU provider contract V1', () => {
  test('defaults to local identity and blocks legacy remote shells', async () => {
    const events: unknown[] = []
    const provider = createLocalDSXUProviderContract({
      emitEvent: event => events.push(event),
    })

    expect(provider.identity.providerId).toBe('dsxu-local')
    expect(provider.identity.mode).toBe('local')
    expect(provider.legacyBridge.enabled).toBe(false)
    expect(provider.legacyBridge.flagName).toBe('DSXU_ENABLE_LEGACY_BRIDGE')

    const remote = await provider.createRemoteSession({
      sessionId: 'session-provider-v1',
      cwd: process.cwd(),
    })

    expect(remote.status).toBe('blocked')
    expect(remote.reason).toContain('DSXU-owned remote session backend')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'remote_blocked',
      sessionId: 'session-provider-v1',
    })
  })

  test('redacts MCP credential-like fields recursively', () => {
    const filtered = redactCredentialLikeValues({
      server: 'github',
      authorization: 'Bearer token',
      nested: {
        apiKey: 'abc',
        cookie: 'session=secret',
        safe: 'visible',
      },
      list: [{ password: 'pw' }, { value: 1 }],
      text: 'Authorization Bearer raw.secret.value and sk-provider-secret-value',
    })

    expect(filtered).toEqual({
      server: 'github',
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        cookie: '[REDACTED]',
        safe: 'visible',
      },
      list: [{ password: '[REDACTED]' }, { value: 1 }],
      text: 'Authorization Bearer [REDACTED] and [REDACTED]',
    })
  })

  test('permission callback is explicit and deny-by-default', async () => {
    const provider = createLocalDSXUProviderContract()
    const decision = await provider.requestPermission({
      sessionId: 'session-provider-v1',
      toolName: 'Bash',
      input: { command: 'echo ok' },
      permission: { behavior: 'ask' },
    })

    expect(decision.behavior).toBe('deny')
    expect(decision.message).toContain('explicit DSXU provider permission callback')
  })

  test('default CLI path stays on DSXU local provider shell contract', () => {
    const root = process.cwd()
    const launcher = readFileSync(join(root, 'bin/dsxu-code-wsl-launch'), 'utf8')
    const bin = readFileSync(join(root, 'bin/dsxu-code'), 'utf8')
    const cli = readFileSync(join(root, 'src/entrypoints/cli.tsx'), 'utf8')
    const init = readFileSync(join(root, 'src/entrypoints/init.ts'), 'utf8')
    const print = readFileSync(join(root, 'src/cli/print.ts'), 'utf8')

    expect(launcher).toContain('export DSXU_CODE_MODE=1')
    expect(launcher).toContain('export DSXU_MODEL_PROVIDER="${DSXU_MODEL_PROVIDER:-deepseek}"')
    expect(launcher).toContain('./bin/dsxu-code "$@"')

    expect(bin).toContain('exec bun --env-file=.env ./src/entrypoints/dsxu-code.tsx "$@"')
    expect(bin).not.toContain('bridgeMain')
    expect(bin).not.toContain('remote-control')

    expect(cli).toContain('DSXU Code default mainline is local coding CLI/TUI')
    expect(cli).toContain('handleDsxuProviderAliasCommand')
    expect(cli).toContain("args[0] === 'remote-control'")
    expect(cli).toContain("args[0] === 'bridge'")

    expect(init).toContain('shouldLoadLegacyProviderServiceShell')
    expect(init).toContain('populateLegacyOAuthAccountInfoIfAllowed')
    expect(init).toContain('initializeRemoteManagedSettingsIfAllowed')
    expect(init).toContain("isEnvTruthy(getDsxuCodeEnv('REMOTE'))")
    expect(init).toContain('DSXU_CODE_REMOTE ignored on the default DSXU local mainline')
    expect(init).toContain('DSXU_ALLOW_LEGACY_PROVIDER_SERVICE_SHELL=1')
    expect(init).toContain('legacy upstream proxy shell is archived')
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')

    expect(print).toContain("message.request.subtype === 'remote_control'")
    expect(print).toContain('isDsxuRuntimeMode() && !isCompatProviderServiceShellAllowed()')
    expect(print).toContain("handleDsxuProviderAliasCommand")
    expect(print).toContain(
      "src/dsxu/engine/provider-backend/dsxu-provider-compat.js",
    )
    expect(print).not.toContain('src/bridge/')
    expect(print).not.toContain('initReplBridge.js')
    expect(print).not.toContain('inboundMessages.js')
    expect(print).not.toContain('bridgeStatusUtil.js')
    expect(print).not.toContain('inboundAttachments.js')
  })

  test('maps old provider shell aliases to the DSXU provider contract block result', async () => {
    expect(isDsxuProviderAliasCommand('remote-control')).toBe(true)
    expect(isDsxuProviderAliasCommand('bridge')).toBe(true)
    expect(isDsxuProviderAliasCommand('chat')).toBe(false)

    const result = await handleDsxuProviderAliasCommand('bridge', {
      cwd: process.cwd(),
      sessionId: 'provider-alias-test',
    })

    expect(result?.handled).toBe(true)
    expect(result?.exitCode).toBe(1)
    expect(result?.message).toContain('blocked in the default local coding mainline')
    expect(result?.message).toContain('Remote session status: blocked')
    expect(result?.message).toContain('DSXU-owned remote session backend')
    expect(result?.events).toHaveLength(1)
    expect(result?.events[0]).toMatchObject({
      type: 'remote_blocked',
      sessionId: 'provider-alias-test',
    })
  })

  test('DSXU local provider backend records events, task sync, permission decisions, and credential vault redaction', async () => {
    const backend = createDsxuLocalProviderBackend({
      permissionCallback: async request => ({
        behavior: request.toolName === 'Read' ? 'allow' : 'deny',
        updatedInput: request.input,
        message: 'DSXU provider backend permission callback',
      }),
    })

    backend.provider.emitEvent({
      type: 'session_started',
      sessionId: 'provider-backend-test',
      timestamp: 1,
    })
    backend.provider.emitEvent({
      type: 'tool_started',
      sessionId: 'provider-backend-test',
      toolName: 'Read',
      timestamp: 2,
    })
    backend.provider.emitEvent({
      type: 'tool_finished',
      sessionId: 'provider-backend-test',
      toolName: 'Read',
      timestamp: 3,
      ok: true,
    })
    backend.synchronizeTask({
      type: 'task_synchronized',
      sessionId: 'provider-backend-test',
      taskId: 'task-v8-provider',
      status: 'completed',
      timestamp: 4,
    })

    const permission = await backend.provider.requestPermission({
      sessionId: 'provider-backend-test',
      toolName: 'Read',
      input: { file_path: 'README.md' },
      permission: { behavior: 'ask' },
    })

    backend.vault.put('mcp:github', 'authorization', 'Bearer provider-secret-token')
    backend.vault.put('mcp:github', 'apiKey', 'sk-provider-vault-secret')
    const filtered = backend.vault.filterForModel({
      authorization: backend.vault.get('mcp:github', 'authorization'),
      apiKey: backend.vault.get('mcp:github', 'apiKey'),
      visible: 'safe',
    })

    expect(permission.behavior).toBe('allow')
    expect(permission.message).toContain('DSXU provider backend permission callback')
    expect(backend.events.readAll()).toEqual([
      { type: 'session_started', sessionId: 'provider-backend-test', timestamp: 1 },
      { type: 'tool_started', sessionId: 'provider-backend-test', toolName: 'Read', timestamp: 2 },
      { type: 'tool_finished', sessionId: 'provider-backend-test', toolName: 'Read', timestamp: 3, ok: true },
      { type: 'task_synchronized', sessionId: 'provider-backend-test', taskId: 'task-v8-provider', status: 'completed', timestamp: 4 },
    ])
    expect(filtered).toEqual({
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      visible: 'safe',
    })
    expect(backend.vault.snapshotRedacted()).toEqual({
      'mcp:github': {
        authorization: '[REDACTED]',
        apiKey: '[REDACTED]',
      },
    })
  })

  test('DSXU local provider backend owns remote sessions and peer messages without bridge shell', async () => {
    const backend = createDsxuLocalProviderBackend()
    const remote = await backend.createRemoteSession({
      sessionId: 'provider-peer-target',
      cwd: process.cwd(),
      metadata: { source: 'test' },
    })

    const sent = backend.postPeerMessage({
      fromSessionId: 'provider-peer-source',
      targetSessionId: 'provider-peer-target',
      message: 'continue with verifier evidence',
      summary: 'verifier continuation',
    })

    expect(remote).toEqual({
      sessionId: 'provider-peer-target',
      status: 'connected',
    })
    expect(sent.ok).toBe(true)
    expect(backend.readPeerMessages('provider-peer-target')).toMatchObject([
      {
        fromSessionId: 'provider-peer-source',
        targetSessionId: 'provider-peer-target',
        message: 'continue with verifier evidence',
        summary: 'verifier continuation',
      },
    ])
    expect(backend.events.readAll().map(event => event.type)).toEqual([
      'session_started',
      'peer_message_sent',
    ])
  })

  test('SendMessage routes provider: peers through DSXU provider backend by default', async () => {
    expect(getSendMessagePrompt()).toContain('provider:session_')

    const result = await SendMessageTool.call(
      {
        to: 'provider:send-message-provider-test',
        summary: 'provider verifier',
        message: 'continue only after verifier evidence',
      },
      { getAppState: () => ({}) } as never,
      undefined as never,
      undefined as never,
    )

    expect(result.data.success).toBe(true)
    expect(result.data.message).toContain('provider:send-message-provider-test')
    expect(
      getDefaultDsxuLocalProviderBackend().readPeerMessages(
        'send-message-provider-test',
      ),
    ).toContainEqual(
      expect.objectContaining({
        targetSessionId: 'send-message-provider-test',
        message: 'continue only after verifier evidence',
        summary: 'provider verifier',
      }),
    )
  })

  test('DSXU remote session manager replaces old remote WebSocket manager on default path', async () => {
    const backend = createDsxuLocalProviderBackend()
    const received: unknown[] = []
    const connected: string[] = []
    const disconnected: string[] = []
    const reconnecting: string[] = []
    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        'dsxu-remote-manager-test',
        () => 'unused-local-provider-token',
        'local-org',
      ),
      {
        onMessage: message => received.push(message),
        onPermissionRequest: () => {},
        onConnected: () => connected.push('connected'),
        onDisconnected: () => disconnected.push('disconnected'),
        onReconnecting: () => reconnecting.push('reconnecting'),
      },
      backend,
    )

    manager.connect()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(manager.isConnected()).toBe(true)
    expect(connected).toEqual(['connected'])
    expect(received).toContainEqual(
      expect.objectContaining({
        type: 'system',
        subtype: 'init',
        provider: 'dsxu',
      }),
    )

    const sent = await manager.sendMessage('continue via DSXU provider', {
      uuid: 'provider-manager-uuid',
    })
    expect(sent).toBe(true)
    expect(backend.readPeerMessages('dsxu-remote-manager-test')).toContainEqual(
      expect.objectContaining({
        targetSessionId: 'dsxu-remote-manager-test',
        message: 'continue via DSXU provider',
      }),
    )
    expect(received).toContainEqual(
      expect.objectContaining({
        type: 'user',
        uuid: 'provider-manager-uuid',
      }),
    )

    manager.cancelSession()
    expect(backend.events.readAll()).toContainEqual(
      expect.objectContaining({
        type: 'task_synchronized',
        sessionId: 'dsxu-remote-manager-test',
        status: 'failed',
      }),
    )

    manager.reconnect()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(reconnecting).toEqual(['reconnecting'])
    expect(manager.isConnected()).toBe(true)

    manager.disconnect()
    expect(manager.isConnected()).toBe(false)
    expect(disconnected).toEqual(['disconnected'])
  })

  test('default source imports DSXU remote manager instead of old src/remote manager', () => {
    const root = process.cwd()
    const useRemoteSession = readFileSync(
      join(root, 'src/hooks/useRemoteSession.ts'),
      'utf8',
    )
    const repl = readFileSync(join(root, 'src/screens/REPL.tsx'), 'utf8')
    const main = readFileSync(join(root, 'src/main.tsx'), 'utf8')
    const directConnect = readFileSync(
      join(root, 'src/hooks/useDirectConnect.ts'),
      'utf8',
    )

    for (const source of [useRemoteSession, repl, main, directConnect]) {
      expect(source).not.toContain('../remote/DsxuRemoteSessionCoordinator.js')
      expect(source).not.toContain('./remote/DsxuRemoteSessionCoordinator.js')
    }
    expect(useRemoteSession).toContain(
      '../dsxu/engine/provider-backend/dsxu-remote-session-manager.js',
    )
    expect(repl).toContain(
      '../dsxu/engine/provider-backend/dsxu-remote-session-manager.js',
    )
    expect(main).toContain(
      './dsxu/engine/provider-backend/dsxu-remote-session-manager.js',
    )
    expect(directConnect).toContain(
      '../dsxu/engine/provider-backend/dsxu-remote-session-manager.js',
    )
  })
})
