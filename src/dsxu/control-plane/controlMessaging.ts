import type { DsxuControlSessionRegistry } from './controlSession.js'

export type DsxuControlIngressMessage = {
  sessionId: string
  type: string
  payload?: unknown
  summary?: string
  direction?: 'inbound' | 'outbound'
}

function summarizePayload(payload: unknown): string {
  if (typeof payload === 'string') return payload.slice(0, 200)
  if (payload === undefined) return 'no payload'
  try {
    return JSON.stringify(payload).slice(0, 200)
  } catch {
    return String(payload).slice(0, 200)
  }
}

export function ingestDsxuControlMessage(
  registry: DsxuControlSessionRegistry,
  message: DsxuControlIngressMessage,
): void {
  registry.recordMessage(message.sessionId, {
    direction: message.direction ?? 'inbound',
    type: message.type,
    summary: message.summary ?? summarizePayload(message.payload),
  })
}

export function createDsxuControlSessionUrl(input: {
  baseUrl: string
  sessionId: string
}): string {
  const base = input.baseUrl.replace(/\/+$/, '')
  return `${base}/session/${encodeURIComponent(input.sessionId)}`
}
