export type DsxuRelayDecision =
  | {
      allowed: true
      url: URL
      host: string
    }
  | {
      allowed: false
      reason:
        | 'relay_disabled'
        | 'invalid_url'
        | 'non_http_url'
        | 'host_not_allowed'
    }

export type DsxuRelayPolicy = {
  allowApiProxy?: boolean
  allowedHosts?: readonly string[]
  allowedHeaderNames?: readonly string[]
  allowSubprocessProxyEnv?: boolean
  proxyUrl?: string
  noProxy?: string
}

export const DEFAULT_DSXU_RELAY_POLICY: Required<
  Pick<DsxuRelayPolicy, 'allowApiProxy' | 'allowedHosts' | 'allowedHeaderNames' | 'allowSubprocessProxyEnv'>
> = {
  allowApiProxy: false,
  allowedHosts: [],
  allowedHeaderNames: [
    'accept',
    'content-type',
    'user-agent',
    'x-request-id',
    'x-dsxu-session-id',
  ],
  allowSubprocessProxyEnv: false,
}

export function normalizeDsxuRelayPolicy(
  policy: DsxuRelayPolicy = {},
): DsxuRelayPolicy {
  return {
    ...DEFAULT_DSXU_RELAY_POLICY,
    ...policy,
    allowedHosts: policy.allowedHosts ?? DEFAULT_DSXU_RELAY_POLICY.allowedHosts,
    allowedHeaderNames:
      policy.allowedHeaderNames ??
      DEFAULT_DSXU_RELAY_POLICY.allowedHeaderNames,
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase()
}

export function shouldAllowDsxuUpstreamRelay(
  targetUrl: string,
  policy: DsxuRelayPolicy = {},
): DsxuRelayDecision {
  const normalizedPolicy = normalizeDsxuRelayPolicy(policy)
  if (!normalizedPolicy.allowApiProxy) {
    return { allowed: false, reason: 'relay_disabled' }
  }

  let url: URL
  try {
    url = new URL(targetUrl)
  } catch {
    return { allowed: false, reason: 'invalid_url' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: 'non_http_url' }
  }

  const host = normalizeHost(url.host)
  const allowedHosts = (normalizedPolicy.allowedHosts ?? []).map(normalizeHost)
  if (!allowedHosts.includes(host) && !allowedHosts.includes(url.hostname.toLowerCase())) {
    return { allowed: false, reason: 'host_not_allowed' }
  }

  return { allowed: true, url, host }
}
