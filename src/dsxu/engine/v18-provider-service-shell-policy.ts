export const V18_PROVIDER_MIGRATION_SERVICE_SHELL_FINAL_RULING = {
  directUse: 'forbidden',
  semanticRebuild: 'required',
  providerMigrationIsolation: 'temporarily_allowed',
} as const

export type V18ProviderMigrationServiceShellProvider =
  | 'DSXU Remote Session Provider'
  | 'DSXU Identity Provider'
  | 'DSXU MCP/Connector Provider'
  | 'DSXU Cost/Billing Policy Provider'
  | 'DSXU Browser/Computer Control Provider'
  | 'DSXU Trace/Evidence Provider'
  | 'DSXU Provider Backlog'

export type V18ProviderMigrationServiceShellDecision = {
  directUseAllowed: false
  defaultMainlineStatus: 'blocked_from_default_mainline'
  requiredAction: 'rebuild_as_dsxu_provider_before_activation'
  safeReuseMode: 'semantic_extract_or_rebuild_only'
}

export const V18_PROVIDER_MIGRATION_SERVICE_SHELL_DECISION: V18ProviderMigrationServiceShellDecision = {
  directUseAllowed: false,
  defaultMainlineStatus: 'blocked_from_default_mainline',
  requiredAction: 'rebuild_as_dsxu_provider_before_activation',
  safeReuseMode: 'semantic_extract_or_rebuild_only',
}

const PROVIDER_MIGRATION_SERVICE_SHELL_PATTERNS = [
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
const PROVIDER_MIGRATION_SERVICE_SHELL_FLAG =
  'DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL'

export function isProviderMigrationServiceShellPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^src\//, '')
  return PROVIDER_MIGRATION_SERVICE_SHELL_PATTERNS.some(pattern =>
    pattern.test(normalized),
  )
}

export function isProviderMigrationServiceShellAllowed(): boolean {
  return process.env[PROVIDER_MIGRATION_SERVICE_SHELL_FLAG] === '1'
}

export function assertProviderMigrationServiceShellNotInDefaultMainline(
  filePath: string,
): void {
  if (
    isProviderMigrationServiceShellPath(filePath) &&
    !isProviderMigrationServiceShellAllowed()
  ) {
    throw new Error(
      `DSXU default mainline cannot directly activate provider migration service shell: ${filePath}. ` +
        'Rebuild the capability as a DSXU Provider or enable the explicit provider migration flag only for isolated migration work.',
    )
  }
}
