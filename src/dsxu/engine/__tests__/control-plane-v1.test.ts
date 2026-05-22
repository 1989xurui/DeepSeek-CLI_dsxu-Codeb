import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, normalize, resolve, sep } from 'path'
import {
  createDsxuControlPlane,
  createDsxuControlSessionRegistry,
  createDsxuVisiblePermissionPrompt,
  decodeDsxuControlJwt,
  handleDsxuInboundControlMessage,
  handleDsxuUnknownInboundControlMessage,
} from '../../control-plane'
import { runControlPlaneReplayHarness } from '../../integration/harness/control-plane-replay-v1-harness'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../../../services/bridge/dsxuRemoteSessionCoordinator'
import { createDsxuLocalProviderBackend } from '../../../services/bridge/dsxuLocalProviderBackend'

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(full))
      continue
    }
    if (/\.(?:ts|tsx|js|jsx)$/.test(entry)) files.push(full)
  }
  return files
}

function collectLegacyControlImports(root: string): string[] {
  const srcRoot = join(root, 'src')
  const legacyRoots = ['bridge', 'remote', 'upstreamproxy'].map(name =>
    normalize(join(srcRoot, name)),
  )
  const offenders: string[] = []
  const importPattern = /\b(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g

  for (const file of listSourceFiles(srcRoot)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1] ?? ''
      let resolved: string | null = null
      if (specifier.startsWith('.')) {
        resolved = normalize(resolve(dirname(file), specifier))
      } else if (
        specifier.startsWith('src/bridge') ||
        specifier.startsWith('src/remote') ||
        specifier.startsWith('src/upstreamproxy')
      ) {
        resolved = normalize(join(root, specifier))
      }
      if (!resolved) continue
      if (
        legacyRoots.some(legacyRoot => {
          const legacyRootWithSeparator = `${legacyRoot}${sep}`
          return resolved === legacyRoot || resolved.startsWith(legacyRootWithSeparator)
        })
      ) {
        offenders.push(`${file}: ${specifier}`)
      }
    }
  }

  return offenders
}

describe('DSXU Control Plane V1', () => {
  test('keeps provider-migration bridge, remote, and upstreamproxy directories absent', () => {
    const root = process.cwd()

    expect(existsSync(join(root, 'src/bridge'))).toBe(false)
    expect(existsSync(join(root, 'src/remote'))).toBe(false)
    expect(existsSync(join(root, 'src/upstreamproxy'))).toBe(false)
  })

  test('default source tree does not import legacy control shell directories', () => {
    const offenders = collectLegacyControlImports(process.cwd())
    expect(offenders).toEqual([])
  })

  test('creates a shared session registry for control and remote sessions', () => {
    const registry = createDsxuControlSessionRegistry()
    const control = registry.upsertSession({
      sessionId: 'cp-control-1',
      mode: 'control',
      status: 'connected',
      metadata: { source: 'sdk' },
      now: 1,
    })
    const remote = registry.upsertSession({
      sessionId: 'cp-control-1',
      mode: 'remote',
      status: 'connected',
      viewerOnly: true,
      metadata: { source: 'remote' },
      now: 2,
    })

    expect(control.sessionId).toBe('cp-control-1')
    expect(remote.mode).toBe('remote')
    expect(remote.viewerOnly).toBe(true)
    expect(remote.metadata).toMatchObject({ source: 'remote' })
    expect(registry.listSessions()).toHaveLength(1)
  })

  test('maps inbound SDK control messages to visible permission state', () => {
    const registry = createDsxuControlSessionRegistry()
    registry.upsertSession({ sessionId: 'cp-permission-1', mode: 'control' })

    const result = handleDsxuInboundControlMessage(registry, 'cp-permission-1', {
      type: 'control_request',
      request_id: 'req-1',
      request: {
        subtype: 'can_use_tool',
        tool_use_id: 'tool-1',
        tool_name: 'Bash',
        input: { command: 'echo ok' },
      },
    })

    expect(result.type).toBe('permission_request')
    if (result.type !== 'permission_request') throw new Error('missing request')
    const prompt = createDsxuVisiblePermissionPrompt({
      sessionId: 'cp-permission-1',
      request: result.request,
    })
    expect(prompt.hiddenWaiting).toBe(false)
    expect(prompt.summary).toContain('Bash')

    const response = handleDsxuInboundControlMessage(registry, 'cp-permission-1', {
      type: 'control_response',
      request_id: 'req-1',
      response: { behavior: 'deny', message: 'not allowed' },
    })

    expect(response.type).toBe('permission_response')
    expect(registry.getSession('cp-permission-1')?.permissionRequests['req-1']?.status).toBe('answered')
  })

  test('decodes JWT metadata without granting authorization by itself', () => {
    const decoded = decodeDsxuControlJwt(fakeJwt({ sub: 'session-user', exp: 1778000000 }))

    expect(decoded?.subject).toBe('session-user')
    expect(decoded?.expiresAt).toBe(1778000000)
    expect(decodeDsxuControlJwt('bad-token')).toBeNull()
  })

  test('raw SDK control adapter returns typed errors for malformed and unsupported messages', () => {
    const registry = createDsxuControlSessionRegistry()
    registry.upsertSession({ sessionId: 'cp-raw-adapter-1', mode: 'control' })

    const malformed = handleDsxuUnknownInboundControlMessage(
      registry,
      'cp-raw-adapter-1',
      { type: 'control_request', request_id: 'bad', request: { subtype: 'can_use_tool' } },
    )
    const unsupported = handleDsxuUnknownInboundControlMessage(
      registry,
      'cp-raw-adapter-1',
      { type: 'provider_migration_bridge_reconnect', request_id: 'provider-migration' },
    )
    const supported = handleDsxuUnknownInboundControlMessage(
      registry,
      'cp-raw-adapter-1',
      {
        type: 'control_request',
        request_id: 'req-raw-read',
        request: {
          subtype: 'can_use_tool',
          tool_use_id: 'tool-raw-read',
          tool_name: 'Read',
          input: { file_path: 'README.md' },
        },
      },
    )

    expect(malformed).toMatchObject({
      type: 'error',
      code: 'malformed_message',
    })
    expect(unsupported).toMatchObject({
      type: 'error',
      code: 'unsupported_message',
    })
    expect(supported.type).toBe('permission_request')
    expect(registry.getSession('cp-raw-adapter-1')?.messages.map(message => message.type)).toEqual([
      'control_error',
      'control_error',
      'control_request',
    ])
  })

  test('remote manager writes lifecycle and permission state into shared control registry', async () => {
    const registry = createDsxuControlSessionRegistry()
    const backend = createDsxuLocalProviderBackend()
    const prompts: string[] = []
    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        'cp-remote-1',
        () => 'unused',
        'org-local',
        false,
        true,
        registry,
      ),
      {
        onMessage: () => {},
        onPermissionRequest: request => prompts.push(request.tool_name),
      },
      backend,
    )

    manager.connect()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(registry.getSession('cp-remote-1')).toMatchObject({
      mode: 'remote',
      status: 'connected',
      viewerOnly: true,
    })

    manager.injectControlMessageForTest({
      type: 'control_request',
      request_id: 'req-remote',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Read',
        tool_use_id: 'tool-read-1',
        input: { file_path: 'README.md' },
      },
    })

    expect(prompts).toEqual(['Read'])
    expect(registry.getSession('cp-remote-1')?.permissionRequests['req-remote']).toMatchObject({
      toolName: 'Read',
      status: 'pending',
    })

    manager.respondToPermissionRequest('req-remote', {
      behavior: 'allow',
      updatedInput: { file_path: 'README.md' },
    })
    expect(registry.getSession('cp-remote-1')?.permissionRequests['req-remote']?.status).toBe('answered')

    manager.disconnect()
    expect(registry.getSession('cp-remote-1')?.status).toBe('closed')
  })

  test('control plane facade stays thin and does not create a second query runtime', () => {
    const control = createDsxuControlPlane()
    control.ingest({
      sessionId: 'cp-thin-1',
      type: 'status',
      payload: { ok: true },
    })

    expect(control.registry.getSession('cp-thin-1')?.messages).toHaveLength(1)
    expect(control.sessionUrl('https://control.example.test/', 'cp-thin-1')).toBe(
      'https://control.example.test/session/cp-thin-1',
    )
  })

  test('provider-migration facade does not own daemon, registry, spawn, or tool-loop state', () => {
    const root = process.cwd()
    const providerMigrationFacade = readFileSync(
      join(root, 'src/services/bridge/dsxuRemoteBridgeFacade.ts'),
      'utf8',
    )

    expect(providerMigrationFacade).not.toMatch(/\bBun\.serve\b|\bcreateServer\b|\bnew\s+WebSocket\b/)
    expect(providerMigrationFacade).not.toMatch(/\bspawn\s*\(|\bexecFile\s*\(|\bchild_process\b/)
    expect(providerMigrationFacade).not.toContain('createDsxuControlSessionRegistry(')
    expect(providerMigrationFacade).not.toContain('DsxuRemoteSessionCoordinator')
    expect(providerMigrationFacade).not.toContain('tool loop')
    expect(providerMigrationFacade).not.toMatch(/^(?:export\s+)?(?:let|var)\s+/m)
  })

  test('replays SDK control session, visible permission, response, and close lifecycle', async () => {
    const replay = await runControlPlaneReplayHarness({
      scenarioName: 'control-plane-cp02-cp05-replay',
      now: 1_778_000_000_000,
    })

    expect(replay.ok).toBe(true)
    expect(replay.hiddenPermissionWaiting).toBe(false)
    expect(replay.permissionStatus).toBe('answered')
    expect(replay.messageCount).toBeGreaterThanOrEqual(3)
    expect(replay.sessionUrl).toBe(
      'https://control.example.test/session/control-plane-cp02-cp05-replay-session',
    )
    expect(replay.events).toEqual([
      'session.connected',
      'message.ingress',
      'session.url',
      'permission.visible_prompt',
      'permission.answered',
      'message.egress',
      'session.closed',
    ])
    expect(replay.finalSession).toMatchObject({
      sessionId: 'control-plane-cp02-cp05-replay-session',
      mode: 'control',
      status: 'closed',
      viewerOnly: false,
    })
  })
})
