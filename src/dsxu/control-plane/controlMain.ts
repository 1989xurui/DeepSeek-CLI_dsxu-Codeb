import {
  createDsxuControlSessionRegistry,
  getDefaultDsxuControlSessionRegistry,
  type DsxuControlSessionRegistry,
} from './controlSession.js'
import {
  createDsxuControlSessionUrl,
  ingestDsxuControlMessage,
  type DsxuControlIngressMessage,
} from './controlMessaging.js'
import {
  handleDsxuInboundControlMessage,
  type DsxuInboundControlMessage,
  type DsxuInboundControlResult,
} from './inboundControlMessages.js'

export type DsxuControlPlane = {
  registry: DsxuControlSessionRegistry
  ingest(message: DsxuControlIngressMessage): void
  handleInbound(sessionId: string, message: DsxuInboundControlMessage): DsxuInboundControlResult
  sessionUrl(baseUrl: string, sessionId: string): string
}

export function createDsxuControlPlane(input?: {
  registry?: DsxuControlSessionRegistry
}): DsxuControlPlane {
  const registry = input?.registry ?? createDsxuControlSessionRegistry()
  return {
    registry,
    ingest(message) {
      ingestDsxuControlMessage(registry, message)
    },
    handleInbound(sessionId, message) {
      return handleDsxuInboundControlMessage(registry, sessionId, message)
    },
    sessionUrl(baseUrl, sessionId) {
      return createDsxuControlSessionUrl({ baseUrl, sessionId })
    },
  }
}

export function getDefaultDsxuControlPlane(): DsxuControlPlane {
  return createDsxuControlPlane({
    registry: getDefaultDsxuControlSessionRegistry(),
  })
}
