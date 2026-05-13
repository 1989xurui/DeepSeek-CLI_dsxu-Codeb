export type DsxuControlSessionMode = 'control' | 'remote'
export type DsxuControlSessionStatus = 'created' | 'connected' | 'closed'

export type DsxuControlPermissionRequest = {
  requestId: string
  toolUseId?: string
  toolName: string
  input: Record<string, unknown>
  createdAt: number
  status: 'pending' | 'answered' | 'cancelled'
  response?: DsxuControlPermissionResponse
}

export type DsxuControlPermissionResponse =
  | { behavior: 'allow'; updatedInput: Record<string, unknown>; answeredAt: number }
  | { behavior: 'deny'; message: string; answeredAt: number }

export type DsxuControlMessage = {
  direction: 'inbound' | 'outbound'
  type: string
  summary: string
  createdAt: number
}

export type DsxuControlSession = {
  sessionId: string
  mode: DsxuControlSessionMode
  status: DsxuControlSessionStatus
  viewerOnly: boolean
  cwd?: string
  metadata: Record<string, unknown>
  createdAt: number
  updatedAt: number
  closedAt?: number
  permissionRequests: Record<string, DsxuControlPermissionRequest>
  messages: DsxuControlMessage[]
}

export type DsxuControlSessionRegistry = {
  upsertSession(input: {
    sessionId: string
    mode: DsxuControlSessionMode
    status?: DsxuControlSessionStatus
    viewerOnly?: boolean
    cwd?: string
    metadata?: Record<string, unknown>
    now?: number
  }): DsxuControlSession
  getSession(sessionId: string): DsxuControlSession | undefined
  listSessions(): DsxuControlSession[]
  closeSession(sessionId: string, now?: number): DsxuControlSession | undefined
  recordMessage(sessionId: string, message: Omit<DsxuControlMessage, 'createdAt'> & { createdAt?: number }): DsxuControlSession
  recordPermissionRequest(input: {
    sessionId: string
    requestId: string
    toolUseId?: string
    toolName: string
    input: Record<string, unknown>
    now?: number
  }): DsxuControlPermissionRequest
  recordPermissionResponse(input: {
    sessionId: string
    requestId: string
    response: Omit<DsxuControlPermissionResponse, 'answeredAt'> & { answeredAt?: number }
    now?: number
  }): DsxuControlPermissionRequest | undefined
  cancelPermissionRequest(sessionId: string, requestId: string, now?: number): DsxuControlPermissionRequest | undefined
}

function cloneSession(session: DsxuControlSession): DsxuControlSession {
  return {
    ...session,
    metadata: { ...session.metadata },
    permissionRequests: Object.fromEntries(
      Object.entries(session.permissionRequests).map(([key, request]) => [
        key,
        { ...request, input: { ...request.input }, response: request.response ? { ...request.response } : undefined },
      ]),
    ),
    messages: session.messages.map(message => ({ ...message })),
  }
}

export function createDsxuControlSessionRegistry(): DsxuControlSessionRegistry {
  const sessions = new Map<string, DsxuControlSession>()

  function ensureSession(sessionId: string, now = Date.now()): DsxuControlSession {
    const existing = sessions.get(sessionId)
    if (existing) return existing
    const created: DsxuControlSession = {
      sessionId,
      mode: 'control',
      status: 'created',
      viewerOnly: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      permissionRequests: {},
      messages: [],
    }
    sessions.set(sessionId, created)
    return created
  }

  return {
    upsertSession(input) {
      const now = input.now ?? Date.now()
      const existing = ensureSession(input.sessionId, now)
      const updated: DsxuControlSession = {
        ...existing,
        mode: input.mode,
        status: input.status ?? existing.status,
        viewerOnly: input.viewerOnly ?? existing.viewerOnly,
        cwd: input.cwd ?? existing.cwd,
        metadata: { ...existing.metadata, ...(input.metadata ?? {}) },
        updatedAt: now,
      }
      sessions.set(input.sessionId, updated)
      return cloneSession(updated)
    },

    getSession(sessionId) {
      const session = sessions.get(sessionId)
      return session ? cloneSession(session) : undefined
    },

    listSessions() {
      return [...sessions.values()].map(cloneSession)
    },

    closeSession(sessionId, now = Date.now()) {
      const existing = sessions.get(sessionId)
      if (!existing) return undefined
      const updated: DsxuControlSession = {
        ...existing,
        status: 'closed',
        updatedAt: now,
        closedAt: now,
      }
      sessions.set(sessionId, updated)
      return cloneSession(updated)
    },

    recordMessage(sessionId, message) {
      const now = message.createdAt ?? Date.now()
      const existing = ensureSession(sessionId, now)
      const updated: DsxuControlSession = {
        ...existing,
        updatedAt: now,
        messages: [...existing.messages, { ...message, createdAt: now }],
      }
      sessions.set(sessionId, updated)
      return cloneSession(updated)
    },

    recordPermissionRequest(input) {
      const now = input.now ?? Date.now()
      const existing = ensureSession(input.sessionId, now)
      const request: DsxuControlPermissionRequest = {
        requestId: input.requestId,
        toolUseId: input.toolUseId,
        toolName: input.toolName,
        input: { ...input.input },
        createdAt: now,
        status: 'pending',
      }
      sessions.set(input.sessionId, {
        ...existing,
        updatedAt: now,
        permissionRequests: {
          ...existing.permissionRequests,
          [input.requestId]: request,
        },
      })
      return { ...request, input: { ...request.input } }
    },

    recordPermissionResponse(input) {
      const now = input.now ?? Date.now()
      const existing = sessions.get(input.sessionId)
      const request = existing?.permissionRequests[input.requestId]
      if (!existing || !request) return undefined
      const response = { ...input.response, answeredAt: input.response.answeredAt ?? now } as DsxuControlPermissionResponse
      const updatedRequest: DsxuControlPermissionRequest = {
        ...request,
        status: 'answered',
        response,
      }
      sessions.set(input.sessionId, {
        ...existing,
        updatedAt: now,
        permissionRequests: {
          ...existing.permissionRequests,
          [input.requestId]: updatedRequest,
        },
      })
      return { ...updatedRequest, input: { ...updatedRequest.input }, response: { ...response } }
    },

    cancelPermissionRequest(sessionId, requestId, now = Date.now()) {
      const existing = sessions.get(sessionId)
      const request = existing?.permissionRequests[requestId]
      if (!existing || !request) return undefined
      const updatedRequest: DsxuControlPermissionRequest = {
        ...request,
        status: 'cancelled',
      }
      sessions.set(sessionId, {
        ...existing,
        updatedAt: now,
        permissionRequests: {
          ...existing.permissionRequests,
          [requestId]: updatedRequest,
        },
      })
      return { ...updatedRequest, input: { ...updatedRequest.input }, response: updatedRequest.response ? { ...updatedRequest.response } : undefined }
    },
  }
}

const defaultDsxuControlSessionRegistry = createDsxuControlSessionRegistry()

export function getDefaultDsxuControlSessionRegistry(): DsxuControlSessionRegistry {
  return defaultDsxuControlSessionRegistry
}
