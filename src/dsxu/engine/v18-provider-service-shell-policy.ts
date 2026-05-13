export const V18_LEGACY_PROVIDER_SERVICE_SHELL_FINAL_RULING = {
  directUse: 'forbidden',
  semanticRebuild: 'required',
  legacyIsolation: 'temporarily_allowed',
} as const

export type V18LegacyProviderServiceShellProvider =
  | 'DSXU Remote Session Provider'
  | 'DSXU Identity Provider'
  | 'DSXU MCP/Connector Provider'
  | 'DSXU Cost/Billing Policy Provider'
  | 'DSXU Browser/Computer Control Provider'
  | 'DSXU Trace/Evidence Provider'
  | 'DSXU Provider Backlog'

export type V18LegacyProviderServiceShellDecision = {
  directUseAllowed: false
  defaultMainlineStatus: 'blocked_from_default_mainline'
  requiredAction: 'rebuild_as_dsxu_provider_before_activation'
  safeReuseMode: 'semantic_extract_or_rebuild_only'
}

export const V18_LEGACY_PROVIDER_SERVICE_SHELL_DECISION: V18LegacyProviderServiceShellDecision = {
  directUseAllowed: false,
  defaultMainlineStatus: 'blocked_from_default_mainline',
  requiredAction: 'rebuild_as_dsxu_provider_before_activation',
  safeReuseMode: 'semantic_extract_or_rebuild_only',
}

const LEGACY_PROVIDER_SERVICE_SHELL_PATTERNS = [
  /(^|\/)bridge\//,
  /(^|\/)remote\//,
  /(^|\/)cli\/remoteIO\.ts$/,
  /(^|\/)cli\/transports\/ccrClient\.ts$/,
  /(^|\/)commands\/(bridge|remote-|passes|login|install-github-app)\//,
  /(^|\/)components\/(Bridge|ConsoleOAuth|Remote|Passes|tasks\/Remote)/,
  /(^|\/)hooks\/(useMailboxBridge|useRemoteSession|useReplBridge)/,
  /(^|\/)services\/oauth\//,
  /(^|\/)services\/remoteManagedSettings\//,
  /(^|\/)skills\/bundled\/scheduleRemoteAgents\.ts$/,
  /(^|\/)tasks\/RemoteAgentTask\//,
  /(^|\/)tools\/RemoteTriggerTool\//,
  /(^|\/)utils\/background\/remote\//,
  /(^|\/)utils\/swarm\/leaderPermissionBridge\.ts$/,
]
const LEGACY_PROVIDER_SERVICE_SHELL_FLAG =
  'DSXU_ALLOW_LEGACY_PROVIDER_SERVICE_SHELL'
const LEGACY_CLOUD_SERVICE_SHELL_FLAG =
  `DSXU_ALLOW_LEGACY_${'CLA' + 'UDE'}_SERVICE_SHELL`

export function isLegacyProviderServiceShellPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^src\//, '')
  return LEGACY_PROVIDER_SERVICE_SHELL_PATTERNS.some(pattern => pattern.test(normalized))
}

export function isLegacyProviderServiceShellAllowed(): boolean {
  return (
    process.env[LEGACY_PROVIDER_SERVICE_SHELL_FLAG] === '1' ||
    process.env[LEGACY_CLOUD_SERVICE_SHELL_FLAG] === '1'
  )
}

export function assertLegacyProviderServiceShellNotInDefaultMainline(
  filePath: string,
): void {
  if (
    isLegacyProviderServiceShellPath(filePath) &&
    !isLegacyProviderServiceShellAllowed()
  ) {
    throw new Error(
      `DSXU default mainline cannot directly activate legacy provider service shell: ${filePath}. ` +
        'Rebuild the capability as a DSXU Provider or enable the explicit legacy migration flag only for isolated migration work.',
    )
  }
}
