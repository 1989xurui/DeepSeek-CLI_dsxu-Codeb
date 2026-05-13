import {
  normalizeDsxuRelayPolicy,
  shouldAllowDsxuUpstreamRelay,
  type DsxuRelayPolicy,
} from './relayPolicy.js'

export type DsxuHeaderValue = string | number | boolean | null | undefined
export type DsxuHeaderRecord = Record<string, DsxuHeaderValue>

export type DsxuRelayProxyRequestInput = {
  url: string
  method?: string
  headers?: DsxuHeaderRecord
  body?: unknown
  policy?: DsxuRelayPolicy
}

export type DsxuRelayProxyRequest =
  | {
      ok: true
      url: string
      method: string
      headers: Record<string, string>
      body?: unknown
    }
  | {
      ok: false
      reason: string
    }

const SECRET_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^proxy-authorization$/i,
  /^x-api-key$/i,
  /token/i,
  /secret/i,
  /credential/i,
]

function isSecretHeader(name: string): boolean {
  return SECRET_HEADER_PATTERNS.some(pattern => pattern.test(name))
}

export function filterDsxuRelayProxyHeaders(
  headers: DsxuHeaderRecord = {},
  policy: DsxuRelayPolicy = {},
): Record<string, string> {
  const normalizedPolicy = normalizeDsxuRelayPolicy(policy)
  const allowed = new Set(
    (normalizedPolicy.allowedHeaderNames ?? []).map(name => name.toLowerCase()),
  )
  const filtered: Record<string, string> = {}

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.trim().toLowerCase()
    if (!name || isSecretHeader(name) || !allowed.has(name)) continue
    if (rawValue === undefined || rawValue === null) continue
    filtered[name] = String(rawValue)
  }

  return filtered
}

export function buildDsxuRelayProxyRequest(
  input: DsxuRelayProxyRequestInput,
): DsxuRelayProxyRequest {
  const decision = shouldAllowDsxuUpstreamRelay(input.url, input.policy)
  if (!decision.allowed) {
    return { ok: false, reason: decision.reason }
  }

  return {
    ok: true,
    url: decision.url.toString(),
    method: (input.method ?? 'GET').toUpperCase(),
    headers: filterDsxuRelayProxyHeaders(input.headers, input.policy),
    ...(input.body !== undefined ? { body: input.body } : {}),
  }
}
