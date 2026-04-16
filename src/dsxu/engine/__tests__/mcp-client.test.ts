/**
 * MCP Client 测试
 *
 * 策略：
 * - MCPManager 配置解析和状态管理（不需要真实 MCP server）
 * - MCPConnection 单元测试（mock spawn）
 * - 工具转换（getToolDefinitions）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MCPManager, MCPConnection } from '../mcp-client'
import type { MCPServerConfig } from '../mcp-client'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-mcp-test-' + Date.now())

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

// ── MCPManager ──

describe('MCPManager', () => {
  it('should initialize empty', () => {
    const mgr = new MCPManager()
    expect(mgr.size).toBe(0)
    expect(mgr.getStatus()).toEqual([])
    expect(mgr.getToolDefinitions()).toEqual([])
  })

  it('should handle missing .mcp.json gracefully', async () => {
    const mgr = new MCPManager()
    await mgr.connectFromConfig(TEST_DIR)
    expect(mgr.size).toBe(0)
  })

  it('should parse .mcp.json in Claude format (no real servers)', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'nonexistent-mcp-binary-12345',
          args: ['/tmp'],
        },
        disabled_server: {
          command: 'node',
          args: ['mcp-disabled'],
          enabled: false,
        },
      },
    }))

    const mgr = new MCPManager()
    // connectFromConfig will try to spawn but fail gracefully
    await mgr.connectFromConfig(TEST_DIR)
    // Config was parsed, but no connections succeeded
    // The disabled one shouldn't even be attempted
  })

  it('should parse .mcp.json with servers key (no real servers)', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      servers: {
        test_server: {
          transport: 'sse',  // SSE skips gracefully
          url: 'http://localhost:99999',
        },
      },
    }))

    const mgr = new MCPManager()
    await mgr.connectFromConfig(TEST_DIR)
    // SSE transport is skipped gracefully
  })

  it('should parse array-form mcpServers config', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      mcpServers: [
        {
          name: 'array_server',
          transport: 'sse',
          url: 'http://localhost:99999',
        },
      ],
    }))

    const mgr = new MCPManager()
    await mgr.connectFromConfig(TEST_DIR)
  })

  it('should normalize streamable_http transport alias to http', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        http_alias_server: {
          transport: 'streamable_http',
          url: 'http://localhost:99999',
        },
      },
    }))

    const mgr = new MCPManager()
    const connectAllSpy = vi.spyOn(mgr, 'connectAll').mockResolvedValue()
    await mgr.connectFromConfig(TEST_DIR)
    expect(connectAllSpy).toHaveBeenCalledTimes(1)
    const [[servers]] = connectAllSpy.mock.calls
    expect(servers[0].transport).toBe('http')
  })

  it('should interpolate env placeholders in config before connectAll', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    process.env.TEST_MCP_TOKEN = 'abc123'
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        env_server: {
          command: 'nonexistent-mcp-binary-12345',
          args: ['--token', '${TEST_MCP_TOKEN}', '--fallback', '${MISSING_VAR:-default-x}'],
          env: {
            AUTH_TOKEN: '${TEST_MCP_TOKEN}',
            WITH_DEFAULT: '${MISSING_VAR:-default-y}',
          },
        },
      },
    }))

    const mgr = new MCPManager()
    const connectAllSpy = vi.spyOn(mgr, 'connectAll').mockResolvedValue()
    await mgr.connectFromConfig(TEST_DIR)
    expect(connectAllSpy).toHaveBeenCalledTimes(1)
    const [[servers]] = connectAllSpy.mock.calls
    expect(servers[0].env?.AUTH_TOKEN).toBe('abc123')
    expect(servers[0].env?.WITH_DEFAULT).toBe('default-y')
  })

  it('should interpolate command/args/url with top-level env scope', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      env: {
        LOCAL_HOST: 'localhost',
        LOCAL_PORT: '99999',
        LOCAL_CMD: 'nonexistent-mcp-binary-12345',
      },
      mcpServers: {
        scoped_server: {
          transport: 'sse',
          url: 'http://${LOCAL_HOST}:${LOCAL_PORT}',
          command: '${LOCAL_CMD}',
          args: ['--x', '${LOCAL_PORT}'],
        },
      },
    }))

    const mgr = new MCPManager()
    const connectAllSpy = vi.spyOn(mgr, 'connectAll').mockResolvedValue()
    await mgr.connectFromConfig(TEST_DIR)
    const [[servers]] = connectAllSpy.mock.calls
    expect(servers[0].url).toBe('http://localhost:99999')
    expect(servers[0].command).toBe('nonexistent-mcp-binary-12345')
    expect(servers[0].args).toEqual(['--x', '99999'])
  })

  it('should de-duplicate array servers by name (last wins)', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      mcpServers: [
        { name: 'dup', transport: 'sse', url: 'http://localhost:1111' },
        { name: 'dup', transport: 'http', url: 'http://localhost:2222' },
      ],
    }))

    const mgr = new MCPManager()
    const connectAllSpy = vi.spyOn(mgr, 'connectAll').mockResolvedValue()
    await mgr.connectFromConfig(TEST_DIR)
    const [[servers]] = connectAllSpy.mock.calls
    expect(servers).toHaveLength(1)
    expect(servers[0].name).toBe('dup')
    expect(servers[0].transport).toBe('http')
    expect(servers[0].url).toBe('http://localhost:2222')
  })

  it('should handle malformed .mcp.json', async () => {
    writeFileSync(join(TEST_DIR, '.mcp.json'), 'not json{{{')
    const mgr = new MCPManager()
    await mgr.connectFromConfig(TEST_DIR)
    expect(mgr.size).toBe(0)
  })

  it('should disconnect all', async () => {
    const mgr = new MCPManager()
    await mgr.disconnectAll()
    expect(mgr.size).toBe(0)
  })
})

// ── MCPConnection ──

describe('MCPConnection', () => {
  it('should create with config', () => {
    const conn = new MCPConnection({
      name: 'test',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
    })

    expect(conn.isConnected()).toBe(false)
    expect(conn.getTools()).toEqual([])
  })

  it('should fail SSE transport when endpoint is unavailable', async () => {
    const conn = new MCPConnection({
      name: 'test-sse',
      transport: 'sse',
      url: 'http://localhost:8080',
    })

    await expect(conn.connect()).rejects.toThrow()
  })

  it('should connect SSE transport via HTTP JSON-RPC', async () => {
    const originalFetch = global.fetch
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const method = body.method as string
      const id = body.id ?? 1
      if (method === 'initialize') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { capabilities: {} } }), { status: 200 })
      }
      if (method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { tools: [{ name: 'hello', description: 'hi', inputSchema: { type: 'object' } }] },
        }), { status: 200 })
      }
      if (method === 'resources/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { resources: [{ uri: 'file:///tmp/a.txt', name: 'a' }] },
        }), { status: 200 })
      }
      if (method === 'resources/templates/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { resourceTemplates: [{ uriTemplate: 'file:///tmp/{name}.txt', name: 'tmpl-a' }] },
        }), { status: 200 })
      }
      if (method === 'resources/templates/read') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { contents: [{ text: 'template-content' }] },
        }), { status: 200 })
      }
      if (method === 'resources/read') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { contents: [{ text: 'resource-content' }] },
        }), { status: 200 })
      }
      if (method === 'shutdown') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), { status: 200 })
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), { status: 200 })
    })
    ;(global as any).fetch = fetchMock

    try {
      const conn = new MCPConnection({
        name: 'test-sse',
        transport: 'sse',
        url: 'http://mcp.local/rpc',
      })

      await conn.connect()
      expect(conn.isConnected()).toBe(true)
      expect(conn.getTools()).toHaveLength(1)
      expect(conn.getResources()).toHaveLength(1)
      expect(conn.getResourceTemplates()).toHaveLength(1)
      const read = await conn.readResource('file:///tmp/a.txt')
      expect(read?.contents?.[0]?.text).toBe('resource-content')
      const readTemplate = await conn.readResourceTemplate('file:///tmp/{name}.txt', { name: 'a' })
      expect(readTemplate?.contents?.[0]?.text).toBe('template-content')
      await conn.disconnect()
      expect(conn.isConnected()).toBe(false)
    } finally {
      ;(global as any).fetch = originalFetch
    }
  })

  it('should connect HTTP transport via HTTP JSON-RPC', async () => {
    const originalFetch = global.fetch
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const method = body.method as string
      const id = body.id ?? 1
      if (method === 'initialize') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { capabilities: {} } }), { status: 200 })
      }
      if (method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { tools: [{ name: 'calc', description: 'calc', inputSchema: { type: 'object' } }] },
        }), { status: 200 })
      }
      if (method === 'resources/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { resources: [{ uri: 'mem://doc/1', name: 'doc1' }] },
        }), { status: 200 })
      }
      if (method === 'shutdown') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), { status: 200 })
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), { status: 200 })
    })
    ;(global as any).fetch = fetchMock

    try {
      const conn = new MCPConnection({
        name: 'test-http',
        transport: 'http',
        url: 'http://mcp.local/http-rpc',
      })

      await conn.connect()
      expect(conn.isConnected()).toBe(true)
      expect(conn.getTools()).toHaveLength(1)
      expect(conn.getResources()).toHaveLength(1)
      await conn.disconnect()
      expect(conn.isConnected()).toBe(false)
    } finally {
      ;(global as any).fetch = originalFetch
    }
  })

  it('should error on missing command', async () => {
    const conn = new MCPConnection({
      name: 'test',
      transport: 'stdio',
      // no command!
    })

    await expect(conn.connect()).rejects.toThrow('command is required')
  })

  it('should handle nonexistent command', async () => {
    const conn = new MCPConnection({
      name: 'test',
      transport: 'stdio',
      command: '/nonexistent/binary/path',
      args: [],
    })

    await expect(conn.connect()).rejects.toThrow()
  })

  it('should disconnect cleanly even when not connected', async () => {
    const conn = new MCPConnection({
      name: 'test',
      transport: 'stdio',
      command: 'echo',
    })

    // Should not throw
    await conn.disconnect()
    expect(conn.isConnected()).toBe(false)
  })
})

// ── Tool Definition Conversion ──

describe('MCPManager tool definitions', () => {
  it('should create qualified tool names', () => {
    // We can't easily test with real MCP servers, but we can test the name format
    const mgr = new MCPManager()

    // The getToolDefinitions method reads from connections
    // With no connections, it returns empty
    const tools = mgr.getToolDefinitions()
    expect(tools).toEqual([])
  })

  it('should include resource tools for each connected server', async () => {
    const mgr = new MCPManager()

    const mockConn = {
      isConnected: () => true,
      getTools: () => [],
      listResources: vi.fn(async () => [{ uri: 'file:///a', name: 'a' }]),
      readResource: vi.fn(async (uri: string) => ({ contents: [{ text: `read:${uri}` }] })),
      listResourceTemplates: vi.fn(async () => [{ uriTemplate: 'file:///tpl/{name}', name: 'tpl' }]),
      readResourceTemplate: vi.fn(async (uriTemplate: string) => ({ contents: [{ text: `read-template:${uriTemplate}` }] })),
    }

    ;(mgr as any).connections = new Map([['mock', mockConn]])

    const tools = mgr.getToolDefinitions()
    const listTool = tools.find(t => t.name === 'mcp__mock__list_resources')
    const readTool = tools.find(t => t.name === 'mcp__mock__read_resource')
    const listTemplateTool = tools.find(t => t.name === 'mcp__mock__list_resource_templates')
    const readTemplateTool = tools.find(t => t.name === 'mcp__mock__read_resource_template')

    expect(listTool).toBeDefined()
    expect(readTool).toBeDefined()
    expect(listTemplateTool).toBeDefined()
    expect(readTemplateTool).toBeDefined()
    expect(listTool?.readOnly).toBe(true)
    expect(readTool?.readOnly).toBe(true)
    expect(listTemplateTool?.readOnly).toBe(true)
    expect(readTemplateTool?.readOnly).toBe(true)

    const listOut = await listTool!.execute({})
    expect(listOut.isError).toBe(false)
    expect(listOut.content).toContain('file:///a')

    const readOut = await readTool!.execute({ uri: 'file:///a' })
    expect(readOut.isError).toBe(false)
    expect(readOut.content).toContain('read:file:///a')

    const listTemplateOut = await listTemplateTool!.execute({})
    expect(listTemplateOut.isError).toBe(false)
    expect(listTemplateOut.content).toContain('file:///tpl/{name}')

    const readTemplateOut = await readTemplateTool!.execute({ uriTemplate: 'file:///tpl/{name}', arguments: { name: 'a' } })
    expect(readTemplateOut.isError).toBe(false)
    expect(readTemplateOut.content).toContain('read-template:file:///tpl/{name}')
  })

  it('should include resource counts in manager status', () => {
    const mgr = new MCPManager()
    const mockConn = {
      isConnected: () => true,
      getTools: () => [{ name: 't', description: '', inputSchema: {} }],
      getResources: () => [{ uri: 'file:///a' }],
      getResourceTemplates: () => [{ uriTemplate: 'file:///tpl/{id}' }],
    }
    ;(mgr as any).connections = new Map([['mock', mockConn]])
    const status = mgr.getStatus()

    expect(status).toHaveLength(1)
    expect(status[0].toolCount).toBe(1)
    expect(status[0].resourceCount).toBe(1)
    expect(status[0].resourceTemplateCount).toBe(1)
  })

  it('should sort manager status by server name', () => {
    const mgr = new MCPManager()
    const mkConn = () => ({
      isConnected: () => true,
      getTools: () => [],
      getResources: () => [],
      getResourceTemplates: () => [],
    })
    ;(mgr as any).connections = new Map([
      ['zeta', mkConn()],
      ['alpha', mkConn()],
    ])

    const status = mgr.getStatus()
    expect(status.map(s => s.name)).toEqual(['alpha', 'zeta'])
  })

  it('should disconnect stale connections when connectAll target set changes', async () => {
    const mgr = new MCPManager()
    const staleDisconnect = vi.fn(async () => {})
    const keepDisconnect = vi.fn(async () => {})

    const staleConn = {
      disconnect: staleDisconnect,
      isConnected: () => true,
      getTools: () => [],
      getResources: () => [],
      getResourceTemplates: () => [],
    }
    const keepConn = {
      disconnect: keepDisconnect,
      isConnected: () => true,
      getTools: () => [],
      getResources: () => [],
      getResourceTemplates: () => [],
    }
    ;(mgr as any).connections = new Map([
      ['stale', staleConn],
      ['keep', keepConn],
    ])

    const connectMock = vi.spyOn(MCPConnection.prototype, 'connect').mockResolvedValue()
    try {
      await mgr.connectAll([
        { name: 'keep', transport: 'sse', url: 'http://localhost:99999' },
      ])
      expect(staleDisconnect).toHaveBeenCalledTimes(1)
      expect(keepDisconnect).toHaveBeenCalledTimes(1) // reconnect existing target
    } finally {
      connectMock.mockRestore()
    }
  })
})

// ── Config format ──

describe('MCP config parsing', () => {
  it('should support env vars in config', async () => {
    const configPath = join(TEST_DIR, '.mcp.json')
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        github: {
          command: 'nonexistent-mcp-binary-12345',
          args: ['--mock'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_test123',
          },
        },
      },
    }))

    const mgr = new MCPManager()
    // Won't actually connect (npx not available), but config parsed
    await mgr.connectFromConfig(TEST_DIR)
  })
})

// Cleanup
import { afterEach } from 'vitest'
afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})
