import {
  ARCHIVED_MCP_CONFIG_SCOPE,
  ARCHIVED_MCP_TRANSPORT,
} from '../../constants/providerMigrationProtocol.js'
import type { ScopedMcpServerConfig } from './types.js'
import { getDsxuMcpConfigRuntimeProfile } from './config.js'
import { getDsxuOfficialMcpRegistryRuntimeProfile } from './officialRegistry.js'

export type McpDoctorServer = {
  name: string
  scope: string
  transport: string
  owner: 'dsxu-mainline' | 'archived-boundary' | 'internal-adapter'
  endpoint?: string
  command?: string
  auth: 'none' | 'oauth' | 'headers' | 'oauth+headers'
  notes: string[]
}

export type McpDoctorReport = {
  runtime: 'DSXU MCP Doctor'
  summary: {
    totalServers: number
    byScope: Record<string, number>
    byTransport: Record<string, number>
    configErrors: number
    registryConfigured: boolean
    nonessentialTrafficDisabled: boolean
  }
  registry: ReturnType<typeof getDsxuOfficialMcpRegistryRuntimeProfile> & {
    configured: boolean
  }
  configRuntime: ReturnType<typeof getDsxuMcpConfigRuntimeProfile>
  servers: McpDoctorServer[]
  errors: string[]
  releaseGate: {
    status: 'PASS' | 'WARN' | 'BLOCKED'
    blockers: string[]
    warnings: string[]
    nextActions: string[]
  }
}

export function getMcpServerDoctorSummary(
  name: string,
  server: ScopedMcpServerConfig,
): McpDoctorServer {
  const transport = server.type ?? 'stdio'
  const notes: string[] = []
  const isArchivedBoundary =
    transport === ARCHIVED_MCP_TRANSPORT ||
    server.scope === ARCHIVED_MCP_CONFIG_SCOPE
  const isInternal = transport === 'sse-ide' || transport === 'ws-ide'
  const owner = isInternal
    ? 'internal-adapter'
    : isArchivedBoundary
      ? 'archived-boundary'
      : 'dsxu-mainline'

  if (isArchivedBoundary) {
    notes.push('explicit archived boundary; not default MCP owner')
  }
  if (isInternal) {
    notes.push('internal adapter; not user-installed server')
  }
  if (transport === 'stdio' || transport === undefined) {
    notes.push('stdio server is process-spawning and must remain permission visible')
  }

  const endpoint = 'url' in server ? server.url : undefined
  const command = 'command' in server ? server.command : undefined
  const hasOAuth = 'oauth' in server && Boolean(server.oauth)
  const hasHeaders = 'headers' in server && Boolean(server.headers)
  const auth =
    hasOAuth && hasHeaders
      ? 'oauth+headers'
      : hasOAuth
        ? 'oauth'
        : hasHeaders
          ? 'headers'
          : 'none'

  return {
    name,
    scope: server.scope,
    transport,
    owner,
    ...(endpoint ? { endpoint } : {}),
    ...(command ? { command } : {}),
    auth,
    notes,
  }
}

export function buildMcpDoctorReport(params: {
  servers: Record<string, ScopedMcpServerConfig>
  errors?: unknown[]
  env?: NodeJS.ProcessEnv
}): McpDoctorReport {
  const { servers, errors = [], env = process.env } = params
  const serverSummaries = Object.entries(servers)
    .map(([name, server]) => getMcpServerDoctorSummary(name, server))
    .sort((a, b) => a.name.localeCompare(b.name))

  const byScope: Record<string, number> = {}
  const byTransport: Record<string, number> = {}
  for (const server of serverSummaries) {
    byScope[server.scope] = (byScope[server.scope] ?? 0) + 1
    byTransport[server.transport] = (byTransport[server.transport] ?? 0) + 1
  }

  const registryProfile = getDsxuOfficialMcpRegistryRuntimeProfile()
  const registryConfigured = Boolean(env.DSXU_MCP_REGISTRY_URL)
  const nonessentialTrafficDisabled =
    env.DSXU_CODE_DISABLE_NONESSENTIAL_TRAFFIC === '1' ||
    env.DISABLE_NONESSENTIAL_TRAFFIC === '1'

  const blockers: string[] = []
  const warnings: string[] = []
  const nextActions: string[] = []

  if (errors.length > 0) {
    blockers.push('MCP config contains validation/load errors')
    nextActions.push('Fix the reported MCP config errors before release')
  }
  if (!registryConfigured) {
    warnings.push('DSXU_MCP_REGISTRY_URL is not configured; official registry lookup is fail-closed')
    nextActions.push('Configure DSXU_MCP_REGISTRY_URL for official registry checks, or sign off registry-disabled release scope')
  }
  if (serverSummaries.length === 0) {
    warnings.push('No MCP servers configured; install/status UX can only be smoke-tested')
    nextActions.push('Add a project or local MCP server and rerun mcp doctor for live registry/status evidence')
  }
  if (serverSummaries.some(server => server.owner === 'archived-boundary')) {
    warnings.push('Archived MCP boundary is present; verify it is explicitly enabled and not default owner')
  }

  return {
    runtime: 'DSXU MCP Doctor',
    summary: {
      totalServers: serverSummaries.length,
      byScope,
      byTransport,
      configErrors: errors.length,
      registryConfigured,
      nonessentialTrafficDisabled,
    },
    registry: {
      ...registryProfile,
      configured: registryConfigured,
    },
    configRuntime: getDsxuMcpConfigRuntimeProfile(),
    servers: serverSummaries,
    errors: errors.map(error =>
      error instanceof Error ? error.message : String(error),
    ),
    releaseGate: {
      status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARN' : 'PASS',
      blockers,
      warnings,
      nextActions,
    },
  }
}

export function formatMcpDoctorReport(report: McpDoctorReport): string {
  const lines: string[] = []
  lines.push('DSXU MCP Doctor')
  lines.push(`Status: ${report.releaseGate.status}`)
  lines.push(`Servers: ${report.summary.totalServers}`)
  lines.push(`Registry configured: ${report.summary.registryConfigured ? 'yes' : 'no'}`)
  lines.push(`Config errors: ${report.summary.configErrors}`)

  if (Object.keys(report.summary.byScope).length > 0) {
    lines.push('')
    lines.push('Scopes:')
    for (const [scope, count] of Object.entries(report.summary.byScope)) {
      lines.push(`  ${scope}: ${count}`)
    }
  }

  if (Object.keys(report.summary.byTransport).length > 0) {
    lines.push('')
    lines.push('Transports:')
    for (const [transport, count] of Object.entries(report.summary.byTransport)) {
      lines.push(`  ${transport}: ${count}`)
    }
  }

  if (report.servers.length > 0) {
    lines.push('')
    lines.push('Servers:')
    for (const server of report.servers) {
      const target = server.endpoint ?? server.command ?? 'sdk/internal'
      lines.push(
        `  ${server.name}: ${server.transport} ${server.scope} ${server.owner} ${target}`,
      )
      if (server.auth !== 'none') {
        lines.push(`    auth: ${server.auth}`)
      }
      for (const note of server.notes) {
        lines.push(`    note: ${note}`)
      }
    }
  }

  if (report.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const error of report.errors) {
      lines.push(`  - ${error}`)
    }
  }

  if (report.releaseGate.blockers.length > 0) {
    lines.push('')
    lines.push('Blockers:')
    for (const blocker of report.releaseGate.blockers) {
      lines.push(`  - ${blocker}`)
    }
  }

  if (report.releaseGate.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    for (const warning of report.releaseGate.warnings) {
      lines.push(`  - ${warning}`)
    }
  }

  if (report.releaseGate.nextActions.length > 0) {
    lines.push('')
    lines.push('Next actions:')
    for (const action of report.releaseGate.nextActions) {
      lines.push(`  - ${action}`)
    }
  }

  return `${lines.join('\n')}\n`
}
