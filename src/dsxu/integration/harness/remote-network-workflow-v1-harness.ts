import { appendFile, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  createDsxuControlSessionRegistry,
  createDsxuVisiblePermissionPrompt,
} from '../../control-plane'
import {
  applyDsxuSubprocessProxyEnv,
  buildDsxuRelayProxyRequest,
} from '../../network'
import { createDsxuLocalProviderBackend } from '../../../services/bridge/dsxuLocalProviderBackend'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../../../services/bridge/dsxuRemoteSessionCoordinator'

export type RemoteNetworkWorkflowTraceEvent = {
  ts: number
  event: string
  data?: Record<string, unknown>
}

export type RemoteNetworkWorkflowResult = {
  ok: boolean
  sessionId: string
  taskId: string
  evidencePath: string
  tracePath: string
  events: string[]
  connectedCount: number
  reconnectingCount: number
  disconnectedCount: number
  permissionPromptCount: number
  permissionStatus: string
  providerEventTypes: string[]
  controlMessageTypes: string[]
  peerMessageCount: number
  taskStatuses: string[]
  verificationSummary: string
  cancelNotificationCount: number
  networkProof: {
    deniedReason: string | undefined
    liveStatus: number | null
    liveBodyOk: boolean
    sanitizedHeaderNames: string[]
    sawAuthorizationHeader: boolean
    sawRequestIdHeader: boolean
    proxyEnvDeniedReason: string | undefined
    proxyEnvApplied: boolean
  }
  error?: string
}

export type RemoteNetworkWorkflowOptions = {
  evidenceDir?: string
  scenarioName?: string
}

async function appendTrace(
  tracePath: string,
  event: RemoteNetworkWorkflowTraceEvent,
): Promise<void> {
  await appendFile(tracePath, `${JSON.stringify(event)}\n`, 'utf8')
}

async function findFreePort(): Promise<number> {
  const net = await import('net')
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function runNetworkProof(): Promise<RemoteNetworkWorkflowResult['networkProof']> {
  let lastHeaders: Record<string, string> = {}
  const port = await findFreePort()
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch(request) {
      lastHeaders = Object.fromEntries(request.headers.entries())
      return new Response(
        JSON.stringify({
          ok: true,
          path: new URL(request.url).pathname,
          headers: lastHeaders,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      )
    },
  })

  try {
    const targetUrl = `http://127.0.0.1:${server.port}/ci/status`
    const denied = buildDsxuRelayProxyRequest({
      url: targetUrl,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer should_not_cross',
      },
    })
    const planned = buildDsxuRelayProxyRequest({
      url: targetUrl,
      method: 'post',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer should_not_cross',
        'X-Request-Id': 'remote-network-workflow',
        'X-Dsxu-Session-Id': 'remote-network-session',
        'X-Not-Allowed': 'drop',
      },
      body: { check: 'remote-network-workflow' },
      policy: {
        allowApiProxy: true,
        allowedHosts: [`127.0.0.1:${server.port}`],
      },
    })
    let liveStatus: number | null = null
    let liveBodyOk = false
    if (planned.ok) {
      const response = await fetch(planned.url, {
        method: planned.method,
        headers: planned.headers,
        body: JSON.stringify(planned.body),
        signal: AbortSignal.timeout(2_000),
      })
      liveStatus = response.status
      const body = (await response.json()) as { ok?: boolean }
      liveBodyOk = body.ok === true
    }

    const proxyEnvDenied = applyDsxuSubprocessProxyEnv({
      env: { PATH: '/bin' },
      policy: { proxyUrl: 'http://127.0.0.1:8080' },
    })
    const proxyEnvApplied = applyDsxuSubprocessProxyEnv({
      env: { PATH: '/bin' },
      policy: {
        allowSubprocessProxyEnv: true,
        proxyUrl: 'http://127.0.0.1:8080',
        noProxy: 'localhost,127.0.0.1',
      },
    })

    return {
      deniedReason: denied.ok ? undefined : denied.reason,
      liveStatus,
      liveBodyOk,
      sanitizedHeaderNames: Object.keys(lastHeaders).sort(),
      sawAuthorizationHeader: Object.prototype.hasOwnProperty.call(
        lastHeaders,
        'authorization',
      ),
      sawRequestIdHeader:
        lastHeaders['x-request-id'] === 'remote-network-workflow',
      proxyEnvDeniedReason: proxyEnvDenied.reason,
      proxyEnvApplied: proxyEnvApplied.applied,
    }
  } finally {
    server.stop(true)
  }
}

export async function runRemoteNetworkWorkflowHarness(
  options: RemoteNetworkWorkflowOptions = {},
): Promise<RemoteNetworkWorkflowResult> {
  const scenarioName = options.scenarioName ?? 'remote-network-workflow-v1'
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-remote')
  const evidencePath = join(evidenceDir, `${scenarioName}.evidence.json`)
  const tracePath = join(evidenceDir, `${scenarioName}.trace.jsonl`)
  const sessionId = `${scenarioName}-session`
  const taskId = `${scenarioName}-task`
  const events: RemoteNetworkWorkflowTraceEvent[] = []
  const record = async (event: string, data?: Record<string, unknown>) => {
    const traceEvent = { ts: Date.now(), event, ...(data ? { data } : {}) }
    events.push(traceEvent)
    await appendTrace(tracePath, traceEvent)
  }

  await mkdir(evidenceDir, { recursive: true })
  await writeFile(tracePath, '', 'utf8')

  try {
    const registry = createDsxuControlSessionRegistry()
    const backend = createDsxuLocalProviderBackend({
      eventLogPath: join(evidenceDir, `${scenarioName}.provider-events.jsonl`),
    })
    const permissionPrompts: string[] = []
    const messages: string[] = []
    let connectedCount = 0
    let reconnectingCount = 0
    let disconnectedCount = 0

    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        sessionId,
        () => 'unused-token',
        'org-v18-remote',
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
        onDisconnected: () => {
          disconnectedCount += 1
        },
        onMessage: message => {
          messages.push(message.type)
        },
        onPermissionRequest: (_request, requestId) => {
          const recorded = registry.getSession(sessionId)?.permissionRequests[requestId]
          if (!recorded) return
          permissionPrompts.push(
            createDsxuVisiblePermissionPrompt({
              sessionId,
              request: recorded,
            }).summary,
          )
        },
      },
      backend,
    )

    manager.connect()
    await new Promise(resolve => setTimeout(resolve, 0))
    await record('remote.connected', {
      connectedCount,
      session: registry.getSession(sessionId),
    })

    const sent = await manager.sendMessage('run remote workflow verification', {
      uuid: 'remote-network-msg-1',
    })
    await record('remote.message_sent', {
      sent,
      peerMessages: backend.readPeerMessages(sessionId).length,
    })

    manager.injectControlMessageForTest({
      type: 'control_request',
      request_id: 'remote-permission-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        tool_use_id: 'remote-tool-bash-1',
        input: { command: 'bun test focused-remote-workflow' },
      },
    })
    manager.respondToPermissionRequest('remote-permission-1', {
      behavior: 'allow',
      updatedInput: { command: 'bun test focused-remote-workflow' },
    })
    await record('remote.permission_answered', {
      prompts: permissionPrompts,
      permission:
        registry.getSession(sessionId)?.permissionRequests['remote-permission-1'],
    })

    const taskStatuses = ['queued', 'running', 'completed'] as const
    for (const status of taskStatuses) {
      backend.synchronizeTask({
        type: 'task_synchronized',
        sessionId,
        taskId,
        status,
        timestamp: Date.now(),
      })
      registry.recordMessage(sessionId, {
        direction: 'outbound',
        type: 'task_synchronized',
        summary: `remote task ${taskId} ${status}`,
      })
      await record('remote.task_synchronized', { taskId, status })
    }

    const verificationSummary =
      'remote workflow verification PASS: focused remote/network replay'
    registry.recordMessage(sessionId, {
      direction: 'outbound',
      type: 'verification_result',
      summary: verificationSummary,
    })
    await record('remote.verification_passed', { verificationSummary })

    manager.reconnect()
    await new Promise(resolve => setTimeout(resolve, 0))
    await record('remote.reconnected', {
      connectedCount,
      reconnectingCount,
      status: registry.getSession(sessionId)?.status,
    })

    manager.cancelSession()
    await record('remote.cancel_requested', {
      messageTypes: messages,
      providerEvents: backend.events.readAll().map(event => event.type),
    })

    const networkProof = await runNetworkProof()
    await record('network.allowlist_live_proof', networkProof)

    manager.disconnect()
    await record('remote.disconnected', {
      disconnectedCount,
      status: registry.getSession(sessionId)?.status,
    })

    const finalSession = registry.getSession(sessionId)
    const providerEvents = backend.events.readAll()
    const result: RemoteNetworkWorkflowResult = {
      ok:
        connectedCount >= 2 &&
        reconnectingCount === 1 &&
        disconnectedCount === 1 &&
        permissionPrompts.length === 1 &&
        finalSession?.permissionRequests['remote-permission-1']?.status === 'answered' &&
        backend.readPeerMessages(sessionId).length === 1 &&
        providerEvents.some(
          event => event.type === 'task_synchronized' && event.status === 'completed',
        ) &&
        finalSession?.messages.some(
          message =>
            message.type === 'verification_result' &&
            message.summary.includes('PASS'),
        ) === true &&
        messages.includes('system') &&
        messages.includes('user') &&
        networkProof.deniedReason === 'relay_disabled' &&
        networkProof.liveStatus === 200 &&
        networkProof.liveBodyOk &&
        !networkProof.sawAuthorizationHeader &&
        networkProof.sawRequestIdHeader &&
        networkProof.proxyEnvDeniedReason === 'proxy_env_disabled' &&
        networkProof.proxyEnvApplied &&
        finalSession?.status === 'closed',
      sessionId,
      taskId,
      evidencePath,
      tracePath,
      events: events.map(event => event.event),
      connectedCount,
      reconnectingCount,
      disconnectedCount,
      permissionPromptCount: permissionPrompts.length,
      permissionStatus:
        finalSession?.permissionRequests['remote-permission-1']?.status ?? 'missing',
      providerEventTypes: providerEvents.map(event => event.type),
      controlMessageTypes: finalSession?.messages.map(message => message.type) ?? [],
      peerMessageCount: backend.readPeerMessages(sessionId).length,
      taskStatuses: providerEvents
        .filter(event => event.type === 'task_synchronized')
        .map(event => event.status),
      verificationSummary,
      cancelNotificationCount: messages.filter(message => message === 'system').length,
      networkProof,
    }

    await writeFile(evidencePath, JSON.stringify(result, null, 2), 'utf8')
    return result
  } catch (error) {
    const result: RemoteNetworkWorkflowResult = {
      ok: false,
      sessionId,
      taskId,
      evidencePath,
      tracePath,
      events: events.map(event => event.event),
      connectedCount: 0,
      reconnectingCount: 0,
      disconnectedCount: 0,
      permissionPromptCount: 0,
      permissionStatus: 'error',
      providerEventTypes: [],
      controlMessageTypes: [],
      peerMessageCount: 0,
      taskStatuses: [],
      verificationSummary: '',
      cancelNotificationCount: 0,
      networkProof: {
        deniedReason: undefined,
        liveStatus: null,
        liveBodyOk: false,
        sanitizedHeaderNames: [],
        sawAuthorizationHeader: false,
        sawRequestIdHeader: false,
        proxyEnvDeniedReason: undefined,
        proxyEnvApplied: false,
      },
      error: error instanceof Error ? error.message : String(error),
    }
    await record('remote_network.error', { error: result.error })
    await writeFile(evidencePath, JSON.stringify(result, null, 2), 'utf8')
    return result
  }
}
