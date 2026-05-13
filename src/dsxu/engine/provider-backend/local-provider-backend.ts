import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname } from 'path'
import {
  createLocalDSXUProviderContract,
  redactCredentialLikeValues,
  type DSXUProviderContract,
  type DSXUProviderEvent,
  type DSXUProviderPermissionDecision,
  type DSXUProviderPermissionRequest,
  type DSXURemoteSessionRequest,
} from '../provider-contract'

export type DSXUProviderPeerMessage = {
  fromSessionId: string
  targetSessionId: string
  message: string
  summary?: string
  timestamp: number
}

export type DSXUProviderEventStream = {
  emit(event: DSXUProviderEvent): void
  readAll(): DSXUProviderEvent[]
}

export type DSXUCredentialVault = {
  put(scope: string, key: string, value: string): void
  get(scope: string, key: string): string | undefined
  filterForModel(value: unknown): unknown
  snapshotRedacted(): Record<string, Record<string, string>>
}

export type DSXULocalProviderBackendOptions = {
  eventLogPath?: string
  permissionCallback?: (
    request: DSXUProviderPermissionRequest,
  ) => Promise<DSXUProviderPermissionDecision>
}

export type DSXULocalProviderBackend = {
  provider: DSXUProviderContract
  events: DSXUProviderEventStream
  vault: DSXUCredentialVault
  createRemoteSession(request: DSXURemoteSessionRequest): ReturnType<DSXUProviderContract['createRemoteSession']>
  synchronizeTask(event: Extract<DSXUProviderEvent, { type: 'task_synchronized' }>): void
  postPeerMessage(input: Omit<DSXUProviderPeerMessage, 'timestamp'>): { ok: boolean; error?: string }
  readPeerMessages(sessionId: string): DSXUProviderPeerMessage[]
}

export function createMemoryProviderEventStream(): DSXUProviderEventStream {
  const events: DSXUProviderEvent[] = []
  return {
    emit(event) {
      events.push(event)
    },
    readAll() {
      return [...events]
    },
  }
}

export function createFileBackedProviderEventStream(
  path: string,
): DSXUProviderEventStream {
  const memory = createMemoryProviderEventStream()
  return {
    emit(event) {
      memory.emit(event)
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8')
    },
    readAll() {
      const fromMemory = memory.readAll()
      if (fromMemory.length > 0 || !existsSync(path)) return fromMemory
      return readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line) as DSXUProviderEvent)
    },
  }
}

export function createDsxuProviderCredentialVault(): DSXUCredentialVault {
  const data = new Map<string, Map<string, string>>()
  return {
    put(scope, key, value) {
      const bucket = data.get(scope) ?? new Map<string, string>()
      bucket.set(key, value)
      data.set(scope, bucket)
    },
    get(scope, key) {
      return data.get(scope)?.get(key)
    },
    filterForModel(value) {
      return redactCredentialLikeValues(value)
    },
    snapshotRedacted() {
      const output: Record<string, Record<string, string>> = {}
      for (const [scope, bucket] of data.entries()) {
        output[scope] = {}
        for (const key of bucket.keys()) {
          output[scope]![key] = '[REDACTED]'
        }
      }
      return output
    },
  }
}

export function createDsxuLocalProviderBackend(
  options: DSXULocalProviderBackendOptions = {},
): DSXULocalProviderBackend {
  const events = options.eventLogPath
    ? createFileBackedProviderEventStream(options.eventLogPath)
    : createMemoryProviderEventStream()
  const vault = createDsxuProviderCredentialVault()
  const activeSessions = new Set<string>()
  const peerMessages = new Map<string, DSXUProviderPeerMessage[]>()
  const provider = createLocalDSXUProviderContract({
    emitEvent: event => events.emit(event),
    requestPermission: options.permissionCallback,
    async createRemoteSession(request) {
      activeSessions.add(request.sessionId)
      events.emit({
        type: 'session_started',
        sessionId: request.sessionId,
        timestamp: Date.now(),
      })
      return {
        sessionId: request.sessionId,
        status: 'connected',
      }
    },
  })

  return {
    provider,
    events,
    vault,
    createRemoteSession: request => provider.createRemoteSession(request),
    synchronizeTask(event) {
      provider.synchronizeTask?.(event)
    },
    postPeerMessage(input) {
      if (!input.targetSessionId.trim()) {
        return { ok: false, error: 'target session id is required' }
      }
      if (!activeSessions.has(input.targetSessionId)) {
        activeSessions.add(input.targetSessionId)
        events.emit({
          type: 'session_started',
          sessionId: input.targetSessionId,
          timestamp: Date.now(),
        })
      }
      const msg: DSXUProviderPeerMessage = {
        ...input,
        timestamp: Date.now(),
      }
      const bucket = peerMessages.get(input.targetSessionId) ?? []
      bucket.push(msg)
      peerMessages.set(input.targetSessionId, bucket)
      events.emit({
        type: 'peer_message_sent',
        sessionId: input.fromSessionId,
        targetSessionId: input.targetSessionId,
        summary: input.summary,
        timestamp: msg.timestamp,
      })
      return { ok: true }
    },
    readPeerMessages(sessionId) {
      return [...(peerMessages.get(sessionId) ?? [])]
    },
  }
}

let defaultBackend: DSXULocalProviderBackend | undefined

export function getDefaultDsxuLocalProviderBackend(): DSXULocalProviderBackend {
  defaultBackend ??= createDsxuLocalProviderBackend()
  return defaultBackend
}

export function postDsxuProviderPeerMessage(input: {
  fromSessionId: string
  targetSessionId: string
  message: string
  summary?: string
}): { ok: boolean; error?: string } {
  return getDefaultDsxuLocalProviderBackend().postPeerMessage(input)
}
