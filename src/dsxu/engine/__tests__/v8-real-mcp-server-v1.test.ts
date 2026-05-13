import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import {
  registerMainlineCoreToolAdapters,
  registerMainlineMcpToolAdapters,
} from '../engine-tool-adapter'
import { ToolRegistry } from '../tool-registry'
import type { ToolContext } from '../types'
import { createLinkedTransportPair } from '../../../services/mcp/InProcessTransport'
import { fetchToolsForClient } from '../../../services/mcp/client'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'
import { buildToolUseSummaryPromptItems } from '../../../services/toolUseSummary/toolUseSummaryGenerator'

async function createInProcessMcpHarness() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const server = new McpServer(
    { name: 'dsxu-v8-real-mcp', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {} } },
  )

  server.registerResource(
    'memo',
    'memo://readme',
    {
      title: 'DSXU V8 memo',
      description: 'In-process DSXU MCP resource',
      mimeType: 'text/plain',
    },
    async uri => ({
      contents: [{
        uri: uri.href,
        mimeType: 'text/plain',
        text: 'DSXU V8 real MCP resource payload',
      }],
    }),
  )

  server.registerTool(
    'lookup',
    {
      title: 'Lookup DSXU memo',
      description: 'Search the DSXU V8 in-process MCP server',
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      calls.push({ name: 'lookup', args: { query } })
      return {
        content: [{
          type: 'text',
          text: `lookup:${query}; authorization Bearer v8.real.mcp.secret; apiKey sk-v8-real-mcp-secret`,
        }],
      }
    },
  )

  server.registerTool(
    'fail_checked',
    {
      title: 'Fail checked',
      description: 'Return an MCP tool error for DSXU recovery tests',
      inputSchema: { reason: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ reason }) => {
      calls.push({ name: 'fail_checked', args: { reason } })
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `recoverable MCP error: ${reason}`,
        }],
      }
    },
  )

  const [clientTransport, serverTransport] = createLinkedTransportPair()
  const client = new Client({ name: 'dsxu-v8-test-client', version: '1.0.0' })
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])

  const connection = {
    name: 'v8_real_mcp',
    type: 'connected',
    capabilities: client.getServerCapabilities() ?? {},
    config: { type: 'sdk', name: 'v8_real_mcp', scope: 'local' },
    client,
    cleanup: async () => {
      await client.close()
      await server.close()
    },
  } as any

  return { calls, connection }
}

function createContext(connection: any, sessionId = 'v8-real-mcp'): ToolContext {
  return {
    cwd: process.cwd(),
    sessionId,
    gear: 1,
    mainlineMcpClients: [connection],
    mainlinePermissionCallback: async request => ({
      behavior: 'allow',
      updatedInput: request.input,
      message: 'allowed by V8 MCP harness',
    }),
  } as ToolContext
}

describe('DSXU V8 real MCP server harness', () => {
  test('connects to an in-process MCP server and reads a real resource', async () => {
    const { connection } = await createInProcessMcpHarness()
    try {
      const registry = new ToolRegistry()
      await registerMainlineCoreToolAdapters(registry)

      const listResult = await registry.execute(
        'ListMcpResourcesTool',
        { server: 'v8_real_mcp' },
        'tool-v8-mcp-list',
        createContext(connection),
      )
      expect(listResult.isError).toBe(false)
      expect(listResult.content).toContain('memo://readme')

      const result = await registry.execute(
        'ReadMcpResourceTool',
        { server: 'v8_real_mcp', uri: 'memo://readme' },
        'tool-v8-mcp-read',
        createContext(connection),
      )

      expect(result.isError).toBe(false)
      expect(result.content).toContain('DSXU V8 real MCP resource payload')
      expect(result.meta?.mainlineToolClassCall).toBe(true)
      expect(result.meta?.permissionSource).toBe('mainline-tool-checkPermissions')
    } finally {
      await connection.cleanup()
    }
  })

  test('registers dynamic tools, redacts credentials, and exposes recoverable MCP errors', async () => {
    const { calls, connection } = await createInProcessMcpHarness()
    try {
      const registry = new ToolRegistry()
      await registerMainlineCoreToolAdapters(registry)
      const dynamicTools = await registerMainlineMcpToolAdapters(registry, [connection])

      expect(dynamicTools.map(tool => tool.name).sort()).toEqual([
        'mcp__v8_real_mcp__fail_checked',
        'mcp__v8_real_mcp__lookup',
      ])

      const [lookupCall] = DeepSeekAdapter.extractToolUsesFromText(
        '<tool_call name="mcp__v8_real_mcp__lookup">{"query":"mainline"}</tool_call>',
      )
      expect(lookupCall?.name).toBe('mcp__v8_real_mcp__lookup')

      const lookup = await registry.execute(
        lookupCall!.name,
        lookupCall!.input,
        lookupCall!.id,
        createContext(connection),
      )
      expect(lookup.isError).toBe(false)
      expect(lookup.content).toContain('lookup:mainline')
      expect(lookup.content).toContain('Bearer [REDACTED]')
      expect(lookup.content).not.toContain('v8.real.mcp.secret')
      expect(lookup.content).not.toContain('sk-v8-real-mcp-secret')
      expect(lookup.meta?.permission).toBe('passthrough')
      expect(lookup.meta?.permissionResolution).toBe('allow')

      const summaryItems = buildToolUseSummaryPromptItems([{
        name: lookupCall!.name,
        input: lookupCall!.input,
        output: lookup.content,
      }])
      expect(summaryItems[0].output).toContain('[REDACTED]')
      expect(summaryItems[0].output).not.toContain('v8.real.mcp.secret')
      expect(summaryItems[0].output).not.toContain('sk-v8-real-mcp-secret')

      const [errorCall] = DeepSeekAdapter.extractToolUsesFromText(
        '<tool_call name="mcp__v8_real_mcp__fail_checked">{"reason":"fixture denied"}</tool_call>',
      )
      const failed = await registry.execute(
        errorCall!.name,
        errorCall!.input,
        errorCall!.id,
        createContext(connection),
      )
      expect(failed.isError).toBe(true)
      expect(failed.content).toContain('recoverable MCP error: fixture denied')
      expect(failed.content).toContain('Replan')
      expect(calls).toEqual([
        { name: 'lookup', args: { query: 'mainline' } },
        { name: 'fail_checked', args: { reason: 'fixture denied' } },
      ])
    } finally {
      await connection.cleanup()
    }
  })

  test('can disconnect and reconnect a real MCP server without leaking credentials into summaries', async () => {
    const first = await createInProcessMcpHarness()
    try {
      const registry = new ToolRegistry()
      await registerMainlineCoreToolAdapters(registry)
      const firstRead = await registry.execute(
        'ReadMcpResourceTool',
        { server: 'v8_real_mcp', uri: 'memo://readme' },
        'tool-v8-mcp-first-read',
        createContext(first.connection),
      )
      expect(firstRead.isError).toBe(false)
      expect(firstRead.content).toContain('DSXU V8 real MCP resource payload')
    } finally {
      await first.connection.cleanup()
      fetchToolsForClient.cache.delete('v8_real_mcp')
    }

    const second = await createInProcessMcpHarness()
    try {
      const registry = new ToolRegistry()
      await registerMainlineCoreToolAdapters(registry)
      await registerMainlineMcpToolAdapters(registry, [second.connection])
      const reconnected = await registry.execute(
        'mcp__v8_real_mcp__lookup',
        { query: 'reconnected' },
        'tool-v8-mcp-reconnected',
        createContext(second.connection, 'v8-real-mcp-reconnected'),
      )
      const summaryItems = buildToolUseSummaryPromptItems([{
        name: 'mcp__v8_real_mcp__lookup',
        input: { query: 'reconnected' },
        output: reconnected.content,
      }])

      expect(reconnected.isError).toBe(false)
      expect(reconnected.content).toContain('lookup:reconnected')
      expect(reconnected.content).toContain('Bearer [REDACTED]')
      expect(summaryItems[0].output).toContain('[REDACTED]')
      expect(JSON.stringify(summaryItems)).not.toContain('v8.real.mcp.secret')
      expect(JSON.stringify(summaryItems)).not.toContain('sk-v8-real-mcp-secret')
    } finally {
      await second.connection.cleanup()
    }
  })
})
