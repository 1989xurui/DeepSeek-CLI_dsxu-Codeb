import { jsonStringify } from '../../utils/slowOperations.js'
import type { DirectConnectConfig } from '../../server/directConnectManager.js'
import { createDSXUTraceCollector } from './dsxu-trace'
import { z } from 'zod/v4'

export class DirectConnectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirectConnectError'
  }
}

export interface DSXUDirectConnectSessionInput {
  serverUrl: string
  authToken?: string
  cwd: string
  dangerouslySkipPermissions?: boolean
}

export interface DSXUDirectConnectSessionResult {
  config: DirectConnectConfig
  workDir?: string
}

type SessionResponse = {
  session_id?: string
  sessionId?: string
  ws_url?: string
  wsUrl?: string
  work_dir?: string
  workDir?: string
}

const dsxuDirectSessionResponseSchema = z.object({
  session_id: z.string().optional(),
  sessionId: z.string().optional(),
  ws_url: z.string().optional(),
  wsUrl: z.string().optional(),
  work_dir: z.string().optional(),
  workDir: z.string().optional(),
}).passthrough()

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '')
}

export function readDSXUDirectSessionResponse(data: unknown, serverUrl: string, authToken?: string): DSXUDirectConnectSessionResult {
  const parsed = dsxuDirectSessionResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new DirectConnectError(`Invalid DSXU direct session response: ${parsed.error.message}`)
  }
  const payload = parsed.data
  const sessionId = payload.session_id ?? payload.sessionId
  const wsUrl = payload.ws_url ?? payload.wsUrl ?? `${normalizeBaseUrl(serverUrl).replace(/^http/, 'ws')}/sessions/${sessionId ?? 'unknown'}`
  if (!sessionId) {
    throw new DirectConnectError('DSXU direct session response is missing session_id/sessionId.')
  }
  return {
    config: {
      serverUrl,
      sessionId,
      wsUrl,
      authToken,
    },
    workDir: payload.work_dir ?? payload.workDir,
  }
}

export async function createDirectConnectSession(input: DSXUDirectConnectSessionInput): Promise<DSXUDirectConnectSessionResult> {
  const trace = createDSXUTraceCollector()
  trace.record({
    type: 'tool.start',
    taskId: 'dsxu-direct-session',
    sessionId: 'dsxu-direct-connect',
    traceId: 'dsxu-direct-connect-session',
    name: 'dsxu.direct_session.create',
    metadata: {
      serverUrl: input.serverUrl,
      cwd: input.cwd,
      dangerouslySkipPermissions: Boolean(input.dangerouslySkipPermissions),
    },
  })

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (input.authToken) headers.authorization = `Bearer ${input.authToken}`
  const body = jsonStringify({
    cwd: input.cwd,
    controlPlane: 'dsxu',
    source: 'dsxu-direct-session',
    ...(input.dangerouslySkipPermissions && {
      dangerously_skip_permissions: true,
    }),
  })

  const endpoints = [
    `${normalizeBaseUrl(input.serverUrl)}/dsxu/sessions`,
    `${normalizeBaseUrl(input.serverUrl)}/sessions`,
  ]
  const errors: string[] = []
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, { method: 'POST', headers, body })
      if (!resp.ok) {
        errors.push(`${endpoint}: ${resp.status} ${resp.statusText}`)
        continue
      }
      const result = readDSXUDirectSessionResponse(await resp.json(), input.serverUrl, input.authToken)
      trace.record({
        type: 'tool.result',
        taskId: 'dsxu-direct-session',
        sessionId: result.config.sessionId,
        traceId: 'dsxu-direct-connect-session',
        name: 'dsxu.direct_session.created',
        metadata: { endpoint },
      })
      return result
    } catch (error) {
      errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new DirectConnectError(`Failed to create DSXU direct session. Tried ${endpoints.length} endpoint(s): ${errors.join('; ')}`)
}
