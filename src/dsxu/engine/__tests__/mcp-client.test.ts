import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { getMainlineMcpToolAdaptersForClients } from '../engine-tool-adapter'
import type { MCPServerConnection } from '../../../services/mcp/types'

const ENGINE_ROOT = join(import.meta.dir, '..')

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(path, files)
      continue
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(path)
    }
  }
  return files
}

describe('V20 OGR-04 MCP owner closure', () => {
  test('product engine code does not import or instantiate the legacy MCP runtime', () => {
    const offenders = collectSourceFiles(ENGINE_ROOT)
      .filter(path => !path.endsWith(`${join('engine', 'mcp-client.ts')}`))
      .flatMap(path => {
        const source = readFileSync(path, 'utf8')
        const hasLegacyImport = /from\s+['"](?:\.\.\/|\.\/)mcp-client['"]/.test(source)
        const hasLegacyInstantiation = /new\s+MCPManager\b|new\s+MCPConnection\b/.test(source)
        return hasLegacyImport || hasLegacyInstantiation
          ? [relative(ENGINE_ROOT, path).replace(/\\/g, '/')]
          : []
      })

    expect(offenders).toEqual([])
  })

  test('mainline MCP connection adapter is the only product registration path', async () => {
    const serverName = `ogr04-owner-guard-${Date.now()}`
    const connection: MCPServerConnection = {
      name: serverName,
      type: 'connected',
      capabilities: { tools: {} },
      config: { type: 'sdk', name: serverName, scope: 'local' },
      cleanup: async () => {},
      client: {
        request: async request => {
          expect(request).toEqual({ method: 'tools/list' })
          return {
            tools: [{
              name: 'echo',
              description: 'Echo through the mainline MCP adapter',
              inputSchema: {
                type: 'object',
                properties: { text: { type: 'string' } },
              },
              annotations: { readOnlyHint: true },
            }],
          }
        },
      } as any,
    }

    const adapters = await getMainlineMcpToolAdaptersForClients([connection])

    expect(adapters.map(tool => tool.name)).toEqual([`mcp__${serverName}__echo`])
    expect(adapters[0]?.readOnly).toBe(true)
  })
})
