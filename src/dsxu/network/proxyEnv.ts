import {
  normalizeDsxuRelayPolicy,
  type DsxuRelayPolicy,
} from './relayPolicy.js'

export type DsxuProxyEnvInput = {
  env?: Record<string, string | undefined>
  policy?: DsxuRelayPolicy
  overrideExisting?: boolean
}

export type DsxuProxyEnvResult = {
  env: Record<string, string | undefined>
  applied: boolean
  reason?: 'proxy_env_disabled' | 'missing_proxy_url' | 'invalid_proxy_url'
}

const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']

function isHttpProxyUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function applyDsxuSubprocessProxyEnv(
  input: DsxuProxyEnvInput = {},
): DsxuProxyEnvResult {
  const env = { ...(input.env ?? {}) }
  const policy = normalizeDsxuRelayPolicy(input.policy)

  if (!policy.allowSubprocessProxyEnv) {
    return { env, applied: false, reason: 'proxy_env_disabled' }
  }
  if (!policy.proxyUrl) {
    return { env, applied: false, reason: 'missing_proxy_url' }
  }
  if (!isHttpProxyUrl(policy.proxyUrl)) {
    return { env, applied: false, reason: 'invalid_proxy_url' }
  }

  for (const key of PROXY_ENV_KEYS) {
    if (input.overrideExisting || !env[key]) {
      env[key] = policy.proxyUrl
    }
  }
  if (policy.noProxy && (input.overrideExisting || !env.NO_PROXY)) {
    env.NO_PROXY = policy.noProxy
  }

  return { env, applied: true }
}
