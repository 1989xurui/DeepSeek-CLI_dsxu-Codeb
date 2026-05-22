import { describe, expect, test } from 'bun:test'
import { ARCHIVED_MCP_CONFIG_SCOPE } from '../../../constants/providerMigrationProtocol'
import { buildMcpDoctorReport, formatMcpDoctorReport } from '../doctor'
import type { ScopedMcpServerConfig } from '../types'

describe('DSXU MCP doctor', () => {
  test('reports DSXU mainline and archived boundaries without connecting', () => {
    const servers: Record<string, ScopedMcpServerConfig> = {
      filesystem: {
        scope: 'project',
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '.'],
      },
      remote: {
        scope: 'user',
        type: 'http',
        url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer redacted' },
      },
      migrated: {
        scope: ARCHIVED_MCP_CONFIG_SCOPE,
        type: 'provider-migration-mcp',
        url: 'https://provider.example/mcp',
        id: 'migrated-1',
      },
    }

    const report = buildMcpDoctorReport({
      servers,
      env: { DSXU_MCP_REGISTRY_URL: 'https://registry.example/mcp.json' },
    })

    expect(report.runtime).toBe('DSXU MCP Doctor')
    expect(report.summary.totalServers).toBe(3)
    expect(report.summary.byScope.project).toBe(1)
    expect(report.summary.byTransport.stdio).toBe(1)
    expect(report.summary.registryConfigured).toBe(true)
    expect(report.releaseGate.status).toBe('WARN')
    expect(report.servers.find(server => server.name === 'filesystem')?.owner).toBe('dsxu-mainline')
    expect(report.servers.find(server => server.name === 'migrated')?.owner).toBe('archived-boundary')
    expect(formatMcpDoctorReport(report)).toContain('DSXU MCP Doctor')
  })

  test('blocks release readiness on config errors and warns when registry is missing', () => {
    const report = buildMcpDoctorReport({
      servers: {},
      errors: [new Error('bad .mcp.json')],
      env: {},
    })

    expect(report.releaseGate.status).toBe('BLOCKED')
    expect(report.releaseGate.blockers).toContain('MCP config contains validation/load errors')
    expect(report.releaseGate.warnings).toContain('DSXU_MCP_REGISTRY_URL is not configured; official registry lookup is fail-closed')
    expect(report.releaseGate.nextActions).toContain('Fix the reported MCP config errors before release')
  })
})
