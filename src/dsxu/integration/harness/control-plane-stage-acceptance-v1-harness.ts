import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, normalize, resolve, sep } from 'path'
import helpCommand from '../../../commands/help/index.js'
import {
  createDsxuControlPlane,
  createDsxuControlSessionRegistry,
  createDsxuVisiblePermissionPrompt,
  handleDsxuUnknownInboundControlMessage,
} from '../../control-plane'
import {
  applyDsxuSubprocessProxyEnv,
  buildDsxuRelayProxyRequest,
  shouldAllowDsxuUpstreamRelay,
} from '../../network'
import { createLocalDSXUProviderContract } from '../../engine/provider-contract'
import { createDsxuLocalProviderBackend } from '../../../services/bridge/dsxuLocalProviderBackend'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../../../services/bridge/dsxuRemoteSessionCoordinator'

export type DsxuControlPlaneStageCheck = {
  name: string
  ok: boolean
  evidence: Record<string, unknown>
}

export type DsxuControlPlaneStageAcceptanceResult = {
  ok: boolean
  evidencePath: string
  checks: DsxuControlPlaneStageCheck[]
  failures: string[]
}

export type DsxuControlPlaneStageAcceptanceOptions = {
  evidenceDir?: string
  scenarioName?: string
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = []
  if (!existsSync(dir)) return files
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
  const legacyProxyRoot = ['upstream', 'proxy'].join('')
  const legacyRoots = ['bridge', 'remote', legacyProxyRoot].map(name =>
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
        specifier.startsWith(`src/${legacyProxyRoot}`)
      ) {
        resolved = normalize(join(root, specifier))
      }
      if (!resolved) continue
      if (
        legacyRoots.some(legacyRoot => {
          const legacyRootWithSeparator = `${legacyRoot}${sep}`
          return (
            resolved === legacyRoot ||
            resolved.startsWith(legacyRootWithSeparator)
          )
        })
      ) {
        offenders.push(`${file}: ${specifier}`)
      }
    }
  }

  return offenders
}

function checkNoLegacyDirectories(root: string): DsxuControlPlaneStageCheck {
  const directories = {
    bridge: existsSync(join(root, 'src/bridge')),
    remote: existsSync(join(root, 'src/remote')),
    proxy: existsSync(join(root, 'src', ['upstream', 'proxy'].join(''))),
  }
  const legacyImports = collectLegacyControlImports(root)
  return {
    name: 'no-legacy-directory-regression',
    ok: !directories.bridge && !directories.remote && !directories.proxy && legacyImports.length === 0,
    evidence: { directories, legacyImports },
  }
}

function checkProviderCompatFacade(root: string): DsxuControlPlaneStageCheck {
  const compatPath = join(
    root,
    'src/services/bridge/dsxuRemoteBridgeFacade.ts',
  )
  const compat = readFileSync(compatPath, 'utf8')
  const forbiddenPatterns = [
    /\bBun\.serve\b|\bcreateServer\b|\bnew\s+WebSocket\b/,
    /\bspawn\s*\(|\bexecFile\s*\(|\bchild_process\b/,
    /\bcreateDsxuControlSessionRegistry\s*\(/,
    /\bDsxuRemoteSessionCoordinator\b/,
    /\btool loop\b/i,
    /^(?:export\s+)?(?:let|var)\s+/m,
  ]
  const offenders = forbiddenPatterns
    .filter(pattern => pattern.test(compat))
    .map(pattern => pattern.source)

  return {
    name: 'archived-facade-thin',
    ok: offenders.length === 0,
    evidence: {
      path: compatPath,
      forbiddenPatternHits: offenders,
    },
  }
}

function checkControlMessagingAndPermissions(): DsxuControlPlaneStageCheck {
  const registry = createDsxuControlSessionRegistry()
  const control = createDsxuControlPlane({ registry })
  registry.upsertSession({
    sessionId: 'cp12-control-1',
    mode: 'control',
    status: 'connected',
    now: 1,
  })
  const request = control.handleInbound('cp12-control-1', {
    type: 'control_request',
    request_id: 'req-cp12-read',
    request: {
      subtype: 'can_use_tool',
      tool_use_id: 'tool-cp12-read',
      tool_name: 'Read',
      input: { file_path: 'README.md' },
    },
  })
  const prompt =
    request.type === 'permission_request'
      ? createDsxuVisiblePermissionPrompt({
          sessionId: 'cp12-control-1',
          request: request.request,
        })
      : undefined
  const response = control.handleInbound('cp12-control-1', {
    type: 'control_response',
    request_id: 'req-cp12-read',
    response: {
      behavior: 'allow',
      updatedInput: { file_path: 'README.md' },
    },
  })
  registry.closeSession('cp12-control-1', 2)
  const session = registry.getSession('cp12-control-1')

  return {
    name: 'control-messaging-visible-permission',
    ok:
      request.type === 'permission_request' &&
      prompt?.hiddenWaiting === false &&
      prompt.toolName === 'Read' &&
      response.type === 'permission_response' &&
      session?.permissionRequests['req-cp12-read']?.status === 'answered' &&
      session.status === 'closed',
    evidence: {
      requestType: request.type,
      prompt,
      responseType: response.type,
      sessionStatus: session?.status,
      permissionStatus: session?.permissionRequests['req-cp12-read']?.status,
      messageTypes: session?.messages.map(message => message.type) ?? [],
    },
  }
}

function checkSdkControlAdapter(): DsxuControlPlaneStageCheck {
  const registry = createDsxuControlSessionRegistry()
  registry.upsertSession({ sessionId: 'cp12-sdk-1', mode: 'control' })
  const malformed = handleDsxuUnknownInboundControlMessage(
    registry,
    'cp12-sdk-1',
    { type: 'control_request', request_id: 'bad', request: { subtype: 'can_use_tool' } },
  )
  const unsupported = handleDsxuUnknownInboundControlMessage(
    registry,
    'cp12-sdk-1',
    { type: 'archived_bridge_reconnect', request_id: 'archived' },
  )
  const supported = handleDsxuUnknownInboundControlMessage(
    registry,
    'cp12-sdk-1',
    {
      type: 'control_request',
      request_id: 'req-cp12-sdk',
      request: {
        subtype: 'can_use_tool',
        tool_use_id: 'tool-cp12-sdk',
        tool_name: 'Bash',
        input: { command: 'echo ok' },
      },
    },
  )
  const session = registry.getSession('cp12-sdk-1')

  return {
    name: 'sdk-control-message-adapter',
    ok:
      malformed.type === 'error' &&
      malformed.code === 'malformed_message' &&
      unsupported.type === 'error' &&
      unsupported.code === 'unsupported_message' &&
      supported.type === 'permission_request',
    evidence: {
      malformed,
      unsupported,
      supportedType: supported.type,
      messageTypes: session?.messages.map(message => message.type) ?? [],
    },
  }
}

async function checkRemoteLifecycle(): Promise<DsxuControlPlaneStageCheck> {
  const registry = createDsxuControlSessionRegistry()
  const backend = createDsxuLocalProviderBackend()
  const permissionPrompts: string[] = []
  const connected: string[] = []
  const disconnected: string[] = []
  const manager = new DsxuRemoteSessionCoordinator(
    createRemoteSessionConfig(
      'cp12-remote-1',
      () => 'unused',
      'org-cp12',
      true,
      true,
      registry,
    ),
    {
      onMessage: () => {},
      onPermissionRequest: request => permissionPrompts.push(request.tool_name),
      onConnected: () => connected.push('connected'),
      onDisconnected: () => disconnected.push('disconnected'),
    },
    backend,
  )

  manager.connect()
  await new Promise(resolve => setTimeout(resolve, 0))
  manager.injectControlMessageForTest({
    type: 'control_request',
    request_id: 'req-cp12-remote',
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Read',
      tool_use_id: 'tool-cp12-remote',
      input: { file_path: 'README.md' },
    },
  })
  manager.respondToPermissionRequest('req-cp12-remote', {
    behavior: 'allow',
    updatedInput: { file_path: 'README.md' },
  })
  manager.disconnect()
  const remoteSession = registry.getSession('cp12-remote-1')

  const lazyRegistry = createDsxuControlSessionRegistry()
  const lazyBackend = createDsxuLocalProviderBackend()
  const lazyConnected: string[] = []
  const lazyManager = new DsxuRemoteSessionCoordinator(
    createRemoteSessionConfig(
      'cp12-remote-lazy',
      () => 'unused',
      'org-cp12',
      false,
      false,
      lazyRegistry,
    ),
    {
      onMessage: () => {},
      onPermissionRequest: () => {},
      onConnected: () => lazyConnected.push('connected'),
    },
    lazyBackend,
  )
  const lazySent = await lazyManager.sendMessage('hello from cp12')
  const lazySession = lazyRegistry.getSession('cp12-remote-lazy')

  return {
    name: 'remote-session-lifecycle-shared-registry',
    ok:
      connected.length === 1 &&
      disconnected.length === 1 &&
      remoteSession?.mode === 'remote' &&
      remoteSession.status === 'closed' &&
      remoteSession.viewerOnly === true &&
      permissionPrompts.includes('Read') &&
      remoteSession.permissionRequests['req-cp12-remote']?.status === 'answered' &&
      lazySent &&
      lazyConnected.length === 1 &&
      lazySession?.mode === 'remote' &&
      lazySession.status === 'connected' &&
      lazySession.metadata.runtime === 'dsxu-control-plane-lazy-connect' &&
      lazyBackend.readPeerMessages('cp12-remote-lazy').length === 1,
    evidence: {
      connectedCount: connected.length,
      disconnectedCount: disconnected.length,
      remoteSession,
      permissionPrompts,
      lazySent,
      lazyConnectedCount: lazyConnected.length,
      lazySession,
      lazyPeerMessageCount: lazyBackend.readPeerMessages('cp12-remote-lazy').length,
    },
  }
}

function checkNetworkFacade(): DsxuControlPlaneStageCheck {
  const denied = shouldAllowDsxuUpstreamRelay(
    'https://api.example.test/v1/messages',
  )
  const sanitized = buildDsxuRelayProxyRequest({
    url: 'https://api.example.test/v1/messages',
    method: 'post',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer secret',
      'X-Request-Id': 'req-cp12',
      'X-Not-Allowed': 'drop',
    },
    body: { ok: true },
    policy: {
      allowApiProxy: true,
      allowedHosts: ['api.example.test'],
    },
  })
  const proxyDenied = applyDsxuSubprocessProxyEnv({
    env: { PATH: '/bin' },
    policy: { proxyUrl: 'http://127.0.0.1:8080' },
  })
  const proxyApplied = applyDsxuSubprocessProxyEnv({
    env: { PATH: '/bin' },
    policy: {
      allowSubprocessProxyEnv: true,
      proxyUrl: 'http://127.0.0.1:8080',
      noProxy: 'localhost,127.0.0.1',
    },
  })

  return {
    name: 'network-facade-default-deny-and-sanitized-proxy',
    ok:
      !denied.allowed &&
      denied.reason === 'relay_disabled' &&
      sanitized.ok &&
      sanitized.headers.accept === 'application/json' &&
      sanitized.headers['x-request-id'] === 'req-cp12' &&
      !('authorization' in sanitized.headers) &&
      !('x-not-allowed' in sanitized.headers) &&
      !proxyDenied.applied &&
      proxyDenied.reason === 'proxy_env_disabled' &&
      proxyApplied.applied &&
      proxyApplied.env.HTTPS_PROXY === 'http://127.0.0.1:8080',
    evidence: {
      denied,
      sanitized,
      proxyDenied,
      proxyApplied,
    },
  }
}

async function checkProviderContract(): Promise<DsxuControlPlaneStageCheck> {
  const events: string[] = []
  const provider = createLocalDSXUProviderContract({
    emitEvent: event => events.push(event.type),
  })
  const blockedRemote = await provider.createRemoteSession({
    sessionId: 'cp12-provider-remote',
    cwd: process.cwd(),
  })
  const deniedPermission = await provider.requestPermission({
    sessionId: 'cp12-provider-permission',
    toolName: 'Bash',
    input: { command: 'echo ok' },
    permission: {},
  })
  const redacted = provider.filterMcpCredentials({
    Authorization: 'Bearer should_not_leak',
    nested: { apiKey: 'sk-should-not-leak-1234567890' },
  })

  return {
    name: 'provider-contract-defaults',
    ok:
      provider.archivedBridge.enabled === false &&
      blockedRemote.status === 'blocked' &&
      events.includes('remote_blocked') &&
      deniedPermission.behavior === 'deny' &&
      JSON.stringify(redacted).includes('[REDACTED]') &&
      !JSON.stringify(redacted).includes('should_not_leak'),
    evidence: {
      identity: provider.identity,
      archivedBridge: provider.archivedBridge,
      blockedRemote,
      deniedPermission,
      events,
      redacted,
    },
  }
}

async function checkDefaultHelpSmoke(root: string): Promise<DsxuControlPlaneStageCheck> {
  const commandSource = readFileSync(join(root, 'src/commands.ts'), 'utf8')
  const loaded = await helpCommand.load()
  return {
    name: 'default-help-smoke',
    ok:
      helpCommand.name === 'help' &&
      helpCommand.type === 'local-jsx' &&
      typeof loaded.call === 'function' &&
      commandSource.includes("import help from './commands/help/index.js'") &&
      /^\s+help,\s*$/m.test(commandSource) &&
      /REMOTE_SAFE_COMMANDS[\s\S]*help,/.test(commandSource),
    evidence: {
      commandName: helpCommand.name,
      commandType: helpCommand.type,
      hasLoaderCall: typeof loaded.call === 'function',
      importedByDefaultCommands: commandSource.includes(
        "import help from './commands/help/index.js'",
      ),
      registeredInDefaultCommands: /^\s+help,\s*$/m.test(commandSource),
      remoteSafe: /REMOTE_SAFE_COMMANDS[\s\S]*help,/.test(commandSource),
    },
  }
}

export async function runControlPlaneStageAcceptanceHarness(
  options: DsxuControlPlaneStageAcceptanceOptions = {},
): Promise<DsxuControlPlaneStageAcceptanceResult> {
  const root = process.cwd()
  const scenarioName =
    options.scenarioName ?? 'control-plane-stage-acceptance-v1'
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-control-plane')
  const evidencePath = join(evidenceDir, `${scenarioName}.evidence.json`)
  await mkdir(evidenceDir, { recursive: true })

  const checks: DsxuControlPlaneStageCheck[] = [
    checkNoLegacyDirectories(root),
    checkProviderCompatFacade(root),
    checkControlMessagingAndPermissions(),
    checkSdkControlAdapter(),
    await checkRemoteLifecycle(),
    checkNetworkFacade(),
    await checkProviderContract(),
    await checkDefaultHelpSmoke(root),
  ]
  const failures = checks
    .filter(check => !check.ok)
    .map(check => check.name)
  const result: DsxuControlPlaneStageAcceptanceResult = {
    ok: failures.length === 0,
    evidencePath,
    checks,
    failures,
  }

  await writeFile(evidencePath, JSON.stringify(result, null, 2), 'utf8')
  return result
}
