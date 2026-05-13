import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  createDsxuControlPlane,
  createDsxuControlSessionRegistry,
  createDsxuVisiblePermissionPrompt,
  decodeDsxuControlJwt,
  type DsxuControlSession,
} from '../../control-plane'

export type ControlPlaneReplayEvent = {
  ts: number
  event: string
  data?: Record<string, unknown>
}

export type ControlPlaneReplayResult = {
  ok: boolean
  sessionId: string
  sessionUrl: string
  tracePath: string
  summaryPath: string
  events: string[]
  hiddenPermissionWaiting: boolean
  permissionStatus: string
  messageCount: number
  finalSession?: DsxuControlSession
  error?: string
}

export type ControlPlaneReplayOptions = {
  evidenceDir?: string
  scenarioName?: string
  now?: number
}

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function fakeControlJwt(sessionId: string): string {
  return [
    encodeJwtPart({ alg: 'none', typ: 'JWT' }),
    encodeJwtPart({ sub: sessionId, exp: 1778000000 }),
    'signature',
  ].join('.')
}

async function writeTrace(tracePath: string, events: ControlPlaneReplayEvent[]): Promise<void> {
  await writeFile(
    tracePath,
    events.map(event => JSON.stringify(event)).join('\n') + '\n',
    'utf8',
  )
}

export async function runControlPlaneReplayHarness(
  options: ControlPlaneReplayOptions = {},
): Promise<ControlPlaneReplayResult> {
  const scenarioName = options.scenarioName ?? 'control-plane-replay-v1'
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-control-plane')
  const tracePath = join(evidenceDir, `${scenarioName}.trace.jsonl`)
  const summaryPath = join(evidenceDir, `${scenarioName}.summary.json`)
  const sessionId = `${scenarioName}-session`
  const now = options.now ?? 1_778_000_000_000
  const events: ControlPlaneReplayEvent[] = []
  const record = (event: string, data?: Record<string, unknown>) => {
    events.push({ ts: now + events.length, event, ...(data ? { data } : {}) })
  }

  await mkdir(evidenceDir, { recursive: true })

  try {
    const registry = createDsxuControlSessionRegistry()
    const control = createDsxuControlPlane({ registry })
    const token = fakeControlJwt(sessionId)
    const decoded = decodeDsxuControlJwt(token)

    registry.upsertSession({
      sessionId,
      mode: 'control',
      status: 'connected',
      cwd: process.cwd(),
      metadata: {
        source: 'sdk-control-replay',
        subject: decoded?.subject,
      },
      now,
    })
    record('session.connected', { sessionId, subject: decoded?.subject })

    control.ingest({
      sessionId,
      type: 'sdk_connected',
      payload: { protocol: 'dsxu-control-v1', viewerOnly: false },
      summary: 'SDK control session connected',
    })
    record('message.ingress', { type: 'sdk_connected' })

    const sessionUrl = control.sessionUrl('https://control.example.test/', sessionId)
    record('session.url', { sessionUrl })

    const permission = control.handleInbound(sessionId, {
      type: 'control_request',
      request_id: 'req-read-1',
      request: {
        subtype: 'can_use_tool',
        tool_use_id: 'tool-read-1',
        tool_name: 'Read',
        input: { file_path: 'README.md' },
      },
    })
    if (permission.type !== 'permission_request') {
      throw new Error(`expected permission_request, got ${permission.type}`)
    }

    const prompt = createDsxuVisiblePermissionPrompt({
      sessionId,
      request: permission.request,
    })
    record('permission.visible_prompt', {
      requestId: prompt.requestId,
      hiddenWaiting: prompt.hiddenWaiting,
      toolName: prompt.toolName,
    })

    const response = control.handleInbound(sessionId, {
      type: 'control_response',
      request_id: 'req-read-1',
      response: {
        behavior: 'allow',
        updatedInput: { file_path: 'README.md' },
      },
    })
    if (response.type !== 'permission_response') {
      throw new Error(`expected permission_response, got ${response.type}`)
    }
    record('permission.answered', {
      requestId: 'req-read-1',
      status: response.request?.status,
      behavior: response.request?.response?.behavior,
    })

    control.ingest({
      sessionId,
      direction: 'outbound',
      type: 'permission_result',
      payload: { request_id: 'req-read-1', behavior: 'allow' },
      summary: 'Permission response delivered to SDK',
    })
    record('message.egress', { type: 'permission_result' })

    registry.closeSession(sessionId, now + 100)
    record('session.closed', { sessionId })

    const finalSession = registry.getSession(sessionId)
    const permissionStatus =
      finalSession?.permissionRequests['req-read-1']?.status ?? 'missing'
    const hiddenPermissionWaiting = prompt.hiddenWaiting !== false
    const messageCount = finalSession?.messages.length ?? 0
    const result: ControlPlaneReplayResult = {
      ok:
        finalSession?.status === 'closed' &&
        permissionStatus === 'answered' &&
        !hiddenPermissionWaiting &&
        messageCount >= 3,
      sessionId,
      sessionUrl,
      tracePath,
      summaryPath,
      events: events.map(event => event.event),
      hiddenPermissionWaiting,
      permissionStatus,
      messageCount,
      finalSession,
    }

    await writeTrace(tracePath, events)
    await writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf8')
    return result
  } catch (error) {
    const result: ControlPlaneReplayResult = {
      ok: false,
      sessionId,
      sessionUrl: '',
      tracePath,
      summaryPath,
      events: events.map(event => event.event),
      hiddenPermissionWaiting: true,
      permissionStatus: 'error',
      messageCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
    record('replay.error', { error: result.error })
    await writeTrace(tracePath, events)
    await writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf8')
    return result
  }
}
