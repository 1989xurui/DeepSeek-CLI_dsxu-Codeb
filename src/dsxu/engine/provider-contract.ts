export type DSXUProviderIdentity = {
  providerId: string
  displayName: string
  mode: 'local' | 'remote'
  userId?: string
  workspaceId?: string
}

export type DSXURemoteSessionRequest = {
  sessionId: string
  cwd: string
  metadata?: Record<string, unknown>
}

export type DSXURemoteSessionHandle = {
  sessionId: string
  status: 'connected' | 'disabled' | 'blocked'
  reason?: string
}

export type DSXUProviderEvent =
  | { type: 'session_started'; sessionId: string; timestamp: number }
  | { type: 'tool_started'; sessionId: string; toolName: string; timestamp: number }
  | { type: 'tool_finished'; sessionId: string; toolName: string; timestamp: number; ok: boolean }
  | { type: 'permission_requested'; sessionId: string; toolName: string; timestamp: number }
  | { type: 'task_synchronized'; sessionId: string; taskId: string; status: 'queued' | 'running' | 'completed' | 'failed'; timestamp: number }
  | { type: 'peer_message_sent'; sessionId: string; targetSessionId: string; summary?: string; timestamp: number }
  | { type: 'remote_blocked'; sessionId: string; reason: string; timestamp: number }

export type DSXUProviderPermissionRequest = {
  sessionId: string
  toolName: string
  input: Record<string, unknown>
  permission: unknown
}

export type DSXUProviderPermissionDecision = {
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  message?: string
}

export type DSXUMCPCredentialFilter = (
  value: unknown,
  context?: { serverName?: string; toolName?: string },
) => unknown

export const DSXU_PROVIDER_MIGRATION_BRIDGE_FLAG =
  'DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE'

export type DSXUProviderMigrationBridgeOptIn = {
  enabled: boolean
  flagName: string
  reason: string
}

export type DSXUProviderContract = {
  identity: DSXUProviderIdentity
  providerMigrationBridge: DSXUProviderMigrationBridgeOptIn
  createRemoteSession(request: DSXURemoteSessionRequest): Promise<DSXURemoteSessionHandle>
  emitEvent(event: DSXUProviderEvent): void
  synchronizeTask?(event: Extract<DSXUProviderEvent, { type: 'task_synchronized' }>): void
  requestPermission(
    request: DSXUProviderPermissionRequest,
  ): Promise<DSXUProviderPermissionDecision>
  filterMcpCredentials: DSXUMCPCredentialFilter
}

const SECRET_KEY_PATTERN = /(token|secret|password|api[_-]?key|authorization|cookie)/i

export function createLocalDSXUProviderContract(
  overrides: Partial<Pick<DSXUProviderContract, 'identity' | 'emitEvent' | 'requestPermission' | 'createRemoteSession'>> = {},
): DSXUProviderContract {
  const emitEvent = overrides.emitEvent ?? (() => {})
  return {
    identity: {
      providerId: 'dsxu-local',
      displayName: 'DSXU Local Coding Provider',
      mode: 'local',
      ...(overrides.identity ?? {}),
    },
    providerMigrationBridge: {
      enabled: false,
      flagName: DSXU_PROVIDER_MIGRATION_BRIDGE_FLAG,
      reason: 'Provider-migration bridge/remote/OAuth shells are opt-in only and outside the default DSXU mainline.',
    },
    createRemoteSession:
      overrides.createRemoteSession ??
      (async request => {
        const reason = 'Remote provider shells are blocked until a DSXU-owned remote session backend is configured.'
        emitEvent({
          type: 'remote_blocked',
          sessionId: request.sessionId,
          reason,
          timestamp: Date.now(),
        })
        return {
          sessionId: request.sessionId,
          status: 'blocked',
          reason,
        }
      }),
    emitEvent,
    synchronizeTask(event) {
      emitEvent(event)
    },
    requestPermission:
      overrides.requestPermission ??
      (async request => ({
        behavior: 'deny',
        message: `${request.toolName} requires an explicit DSXU provider permission callback.`,
      })),
    filterMcpCredentials: value => redactCredentialLikeValues(value),
  }
}

export function getDsxuProviderShellReplacementContract(): {
  runtime: 'DSXU Provider Shell Replacement'
  sourceSemantics: readonly string[]
  dsxuOwnedLandingPoints: readonly string[]
  defaultPathRules: readonly string[]
  providerMigrationOptInRules: readonly string[]
  archivalRequirements: readonly string[]
} {
  return {
    runtime: 'DSXU Provider Shell Replacement',
    sourceSemantics: [
      'remote session creation',
      'event stream emission',
      'permission callback mediation',
      'MCP credential filtering before model re-entry',
      'task synchronization status events',
    ],
    dsxuOwnedLandingPoints: [
      'src/dsxu/engine/provider-contract.ts',
      'src/entrypoints/cli.tsx',
      'src/entrypoints/init.ts',
      'src/services/mcp/dsxuProvider.ts',
      'src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
    ],
    defaultPathRules: [
      'DSXU CLI/TUI starts in local provider mode',
      'remote provider shells are blocked until a DSXU-owned remote session backend is configured',
      'MCP credentials are filtered by filterMcpCredentials before tool results can re-enter the model',
      'permission callbacks are explicit and deny-by-default',
      'task_synchronized events are provider events, not a provider-migration bridge runtime',
    ],
    providerMigrationOptInRules: [
      'providerMigrationBridge.enabled is false by default',
      'bridge targets require DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE',
      'provider-migration source bridge aliases are accepted only as migration aliases',
      'bridge, remote-control, OAuth, and remote-managed settings remain outside default DSXU_CODE_MODE',
    ],
    archivalRequirements: [
      'provider-shell-default-unreachable live benchmark is green',
      'real-mcp-resource-redaction live benchmark is green',
      'default CLI path test proves bridge/remote aliases are rejected',
      'all provider-migration aliases either map to DSXU provider contract or require explicit provider-migration flags',
    ],
  }
}

export function redactCredentialLikeValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactCredentialLikeValues(item))
  }
  if (typeof value === 'string') {
    return value
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[REDACTED]')
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  const output: Record<string, unknown> = {}
  for (const [key, innerValue] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]'
    } else {
      output[key] = redactCredentialLikeValues(innerValue)
    }
  }
  return output
}
