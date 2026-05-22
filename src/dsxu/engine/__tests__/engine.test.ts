import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  QueryEngine,
  ToolRegistry,
  createGearBox,
  createMockLLMCall,
  queryLoop,
} from '..'
import type {
  LLMResponse,
  MCPServerConnection,
  QueryEvent,
  ToolDefinition,
} from '../types'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Echo the input text',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  execute: async input => ({ content: `Echo: ${input.text}` }),
  concurrencySafe: true,
  readOnly: true,
}

const bashTestPassTool: ToolDefinition = {
  name: 'Bash',
  description: 'Run bash commands',
  inputSchema: {
    type: 'object',
    properties: { command: { type: 'string' } },
    required: ['command'],
  },
  execute: async () => ({
    content: '5 pass\n0 fail\nTests: 5 passed, 5 total',
    isError: false,
  }),
}

function mockResponse(
  content: string,
  toolCalls: LLMResponse['toolCalls'] = [],
): LLMResponse {
  return {
    content,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    usage: { inputTokens: 100, outputTokens: 50 },
  }
}

async function collectEvents(
  gen: AsyncGenerator<QueryEvent, unknown>,
): Promise<{ events: QueryEvent[]; result: any }> {
  const events: QueryEvent[] = []
  let iter = await gen.next()
  while (!iter.done) {
    events.push(iter.value)
    iter = await gen.next()
  }
  return { events, result: iter.value }
}

function createFakeMcpConnection(serverName: string): MCPServerConnection {
  return {
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
            description: 'Echo through a mainline MCP connection',
            inputSchema: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text'],
            },
            annotations: { readOnlyHint: true },
          }],
        }
      },
      callTool: async request => ({
        content: [{
          type: 'text',
          text: `MCP ${serverName}: ${request.arguments?.text ?? ''}`,
        }],
      }),
    } as any,
  } as MCPServerConnection
}

describe('GearBox', () => {
  it('uses the DSXU error escalation and test recovery policy', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    expect(gb.getGear()).toBe(1)
    for (let i = 0; i < 3; i++) {
      gb.reportToolResult(errorResult, 'echo')
      expect(gb.getGear()).toBe(1)
    }

    gb.reportToolResult(errorResult, 'echo')
    expect(gb.getGear()).toBe(2)
    expect(gb.getModel()).toBe('deepseek-v4-pro')

    gb.reportToolResult(
      { toolUseId: '2', content: '5 pass\n0 fail\nTests: 5 passed', isError: false },
      'Bash',
    )
    expect(gb.getGear()).toBe(1)
    expect(gb.getState().testHistory[0]?.passed).toBe(true)
  })
})

describe('ToolRegistry', () => {
  it('registers, sorts, and executes named tools without legacy fallback', async () => {
    const registry = new ToolRegistry()
    registry.register({ ...echoTool, name: 'zeta' })
    registry.register({ ...echoTool, name: 'alpha' })

    expect(registry.size).toBe(2)
    expect(registry.names).toEqual(['alpha', 'zeta'])
    expect(registry.getSchemas().map(schema => schema.name)).toEqual(['alpha', 'zeta'])

    const result = await registry.execute(
      'alpha',
      { text: 'mainline' },
      'tool-1',
      { cwd: process.cwd(), sessionId: 'registry-v20', gear: 1 },
    )

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('mainline')
    expect(result.meta?.[['execution', 'Fallback'].join('')]).toBeUndefined()
  })
})

describe('Query Loop', () => {
  it('executes a real registered tool and records test evidence', async () => {
    const llm = createMockLLMCall([
      mockResponse('Running tests...', [
        { id: 'call-1', name: 'Bash', arguments: { command: 'bun test' } },
      ]),
      mockResponse('All tests passed.'),
    ])
    const registry = new ToolRegistry()
    registry.register(bashTestPassTool)

    const gen = queryLoop(
      { llmCall: llm },
      [{ role: 'user', content: 'run tests' }],
      registry,
    )
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(events.some(event => event.type === 'tool_start')).toBe(true)
    const testEvents = events.filter(event => event.type === 'test_detected')
    expect(testEvents).toHaveLength(1)
    expect((testEvents[0] as any).passed).toBe(true)
  })
})

describe('QueryEngine V20 mainline owner', () => {
  it('runs registered tools through the engine registry', async () => {
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([
        mockResponse('Using echo...', [
          { id: 'call-1', name: 'echo', arguments: { text: 'world' } },
        ]),
        mockResponse('Done.'),
      ]),
      skills: { enabled: false },
    })
    engine.registerTool(echoTool)

    const { events, result } = await collectEvents(engine.stream('echo world'))

    expect(engine.toolNames).toEqual(['echo'])
    expect(events.some(event => event.type === 'tool_result')).toBe(true)
    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Done.')
  })

  it('registers MCP tools only from mainline services/mcp clients', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-engine-mcp-v20-'))
    tempDirs.push(cwd)
    const serverName = `v20-mainline-${Date.now()}`
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([mockResponse('MCP ready.')]),
      cwd,
      mcpAutoConnect: false,
      mainlineMcpClients: [createFakeMcpConnection(serverName)],
      skills: { enabled: false },
    })

    const status = await engine.registerMCPFromMainlineClients(cwd)

    expect(status).toEqual({ servers: 1, toolCount: 1 })
    expect(engine.toolNames).toContain(`mcp__${serverName}__echo`)
    expect(engine.getMCPStatus()).toEqual([{
      name: serverName,
      connected: true,
      toolCount: 0,
      resourceCount: 0,
      resourceTemplateCount: 0,
    }])
  })
})
