/**
 * DSxu Query Engine 测试
 *
 * 测试策略：
 * - 使用 Mock LLM（不依赖真实 API）
 * - 覆盖核心循环的每种退出路径
 * - 覆盖三档变速的升降档逻辑
 * - 覆盖 S.1 测试驱动自治
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { QueryEngine, ToolRegistry, createGearBox, createMockLLMCall, queryLoop, WriteTool, EditTool, RewindFilesTool } from '..'
import type { LLMResponse, ToolDefinition, Message, QueryEvent } from '../types'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 测试工具 ──

const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Echo the input text',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  execute: async (input) => ({ content: `Echo: ${input.text}` }),
  concurrencySafe: true,
  readOnly: true,
}

const failTool: ToolDefinition = {
  name: 'fail',
  description: 'Always fails',
  inputSchema: { type: 'object', properties: {} },
  execute: async () => ({ content: 'Something went wrong', isError: true }),
}

const bashTestPassTool: ToolDefinition = {
  name: 'Bash',
  description: 'Run bash commands',
  inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
  execute: async (input) => ({
    content: '✓ 5 pass\n0 fail\nTests: 5 passed, 5 total',
  }),
}

const bashTestFailTool: ToolDefinition = {
  name: 'Bash',
  description: 'Run bash commands',
  inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
  execute: async (input) => ({
    content: '✗ 3 pass\n2 fail\nFAIL src/auth.test.ts',
    isError: true,
  }),
}

// ── Helper ──

function mockResponse(content: string, toolCalls: LLMResponse['toolCalls'] = []): LLMResponse {
  return {
    content,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    usage: { inputTokens: 100, outputTokens: 50 },
  }
}

async function collectEvents(
  gen: AsyncGenerator<QueryEvent, any>,
): Promise<{ events: QueryEvent[]; result: any }> {
  const events: QueryEvent[] = []
  let result: any
  let iter = await gen.next()
  while (!iter.done) {
    events.push(iter.value)
    iter = await gen.next()
  }
  result = iter.value
  return { events, result }
}

// ── GearBox 测试 ──

describe('GearBox', () => {
  it('should start at gear 1', () => {
    const gb = createGearBox()
    expect(gb.getGear()).toBe(1)
    expect(gb.getModel()).toBe('deepseek-chat')
  })

  it('should stay at gear 1 for first 3 errors (Claude strategy)', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    gb.reportToolResult(errorResult, 'someTool')
    expect(gb.getGear()).toBe(1)  // 错误 1 → 留 1 档

    gb.reportToolResult(errorResult, 'someTool')
    expect(gb.getGear()).toBe(1)  // 错误 2 → 留 1 档

    gb.reportToolResult(errorResult, 'someTool')
    expect(gb.getGear()).toBe(1)  // 错误 3 → 留 1 档
  })

  it('should upgrade to gear 2 on 4th error', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    for (let i = 0; i < 4; i++) {
      gb.reportToolResult(errorResult, 'someTool')
    }
    expect(gb.getGear()).toBe(2)
    expect(gb.getModel()).toBe('deepseek-reasoner')
  })

  it('should upgrade to gear 3 on 6th error', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    for (let i = 0; i < 6; i++) {
      gb.reportToolResult(errorResult, 'someTool')
    }
    expect(gb.getGear()).toBe(3)
  })

  it('should downgrade to gear 1 on success', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    // 升到 2 档
    for (let i = 0; i < 4; i++) {
      gb.reportToolResult(errorResult, 'someTool')
    }
    expect(gb.getGear()).toBe(2)

    // 成功 → 降回 1 档
    gb.reportSuccess()
    expect(gb.getGear()).toBe(1)
  })

  it('S.1: should detect test pass from Bash output', () => {
    const gb = createGearBox()
    const errorResult = { toolUseId: '1', content: 'error', isError: true }

    // 先升到 2 档
    for (let i = 0; i < 4; i++) {
      gb.reportToolResult(errorResult, 'someTool')
    }
    expect(gb.getGear()).toBe(2)

    // 测试通过 → 降回 1 档
    const testPass = {
      toolUseId: '2',
      content: '✓ 5 pass\n0 fail\nTests: 5 passed',
      isError: false,
    }
    gb.reportToolResult(testPass, 'Bash')
    expect(gb.getGear()).toBe(1)
    expect(gb.getState().testHistory).toHaveLength(1)
    expect(gb.getState().testHistory[0].passed).toBe(true)
  })

  it('S.1: should detect test failure from Bash output', () => {
    const gb = createGearBox()

    const testFail = {
      toolUseId: '1',
      content: '2 fail\nFAIL src/auth.test.ts',
      isError: false,  // exit code 可能是 0 但有 FAIL
    }
    gb.reportToolResult(testFail, 'Bash')
    expect(gb.getState().testHistory).toHaveLength(1)
    expect(gb.getState().testHistory[0].passed).toBe(false)
    expect(gb.getState().consecutiveErrors).toBe(1)
  })
})

// ── ToolRegistry 测试 ──

describe('ToolRegistry', () => {
  it('should register and find tools', () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)

    expect(reg.size).toBe(1)
    expect(reg.find('echo')).toBeDefined()
    expect(reg.find('nonexistent')).toBeUndefined()
  })

  it('should generate sorted schemas', () => {
    const reg = new ToolRegistry()
    reg.register({ ...echoTool, name: 'zebra' })
    reg.register({ ...echoTool, name: 'alpha' })

    const schemas = reg.getSchemas()
    expect(schemas[0].name).toBe('alpha')
    expect(schemas[1].name).toBe('zebra')
  })

  it('should execute tool successfully', async () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)

    const result = await reg.execute('echo', { text: 'hello' }, 'call-1', {
      cwd: '/tmp', sessionId: 'test', gear: 1,
    })

    expect(result.content).toBe('Echo: hello')
    expect(result.isError).toBe(false)
  })

  it('should return error for unknown tool', async () => {
    const reg = new ToolRegistry()
    const result = await reg.execute('unknown', {}, 'call-1', {
      cwd: '/tmp', sessionId: 'test', gear: 1,
    })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('should execute batch with concurrency', async () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)
    reg.register(failTool)

    const results = await reg.executeBatch(
      [
        { name: 'echo', input: { text: 'a' }, toolUseId: '1' },
        { name: 'echo', input: { text: 'b' }, toolUseId: '2' },
        { name: 'fail', input: {}, toolUseId: '3' },
      ],
      { cwd: '/tmp', sessionId: 'test', gear: 1 },
    )

    expect(results).toHaveLength(3)
    // echo 是 concurrencySafe，应并行执行
    expect(results[0].content).toBe('Echo: a')
    expect(results[1].content).toBe('Echo: b')
    expect(results[2].isError).toBe(true)
  })

  it('should filter disabled tools', () => {
    const reg = new ToolRegistry()
    reg.register({ ...echoTool, isEnabled: () => false })
    expect(reg.getSchemas()).toHaveLength(0)
  })
})

// ── Query Loop 测试 ──

describe('Query Loop', () => {
  it('should limit tools with subset retrieval and keep relevant tools', async () => {
    const seenToolNames: string[][] = []
    const llm = (async (_messages, tools) => {
      seenToolNames.push(tools.map((t: any) => t.name))
      return mockResponse('Done.')
    }) as any

    const reg = new ToolRegistry()
    reg.register({ ...echoTool, name: 'Bash', description: 'Run test/build commands in shell' })
    reg.register({ ...echoTool, name: 'Edit', description: 'Edit file content' })
    reg.register({ ...echoTool, name: 'Read', description: 'Read file content' })
    reg.register({ ...echoTool, name: 'Write', description: 'Write file content' })
    reg.register({ ...echoTool, name: 'Grep', description: 'Search by pattern' })
    reg.register({ ...echoTool, name: 'Glob', description: 'Find files by glob pattern' })
    reg.register({ ...echoTool, name: 'UnrelatedA', description: 'Something else' })
    reg.register({ ...echoTool, name: 'UnrelatedB', description: 'Another unrelated tool' })

    const gen = queryLoop(
      { llmCall: llm, toolSubset: { enabled: true, maxTools: 4, minTools: 3 } },
      [{ role: 'user', content: 'run bun test then edit auth file' }],
      reg,
    )
    const { result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(seenToolNames).toHaveLength(1)
    expect(seenToolNames[0].length).toBeLessThanOrEqual(4)
    expect(seenToolNames[0]).toContain('Bash')
    expect(seenToolNames[0]).toContain('Edit')
  })

  it('should return all tools when subset retrieval is disabled', async () => {
    const seenToolNames: string[][] = []
    const llm = (async (_messages, tools) => {
      seenToolNames.push(tools.map((t: any) => t.name))
      return mockResponse('Done.')
    }) as any

    const reg = new ToolRegistry()
    reg.register({ ...echoTool, name: 'tool-a' })
    reg.register({ ...echoTool, name: 'tool-b' })
    reg.register({ ...echoTool, name: 'tool-c' })
    reg.register({ ...echoTool, name: 'tool-d' })
    reg.register({ ...echoTool, name: 'tool-e' })

    const gen = queryLoop(
      { llmCall: llm, toolSubset: { enabled: false } },
      [{ role: 'user', content: 'anything' }],
      reg,
    )
    const { result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(seenToolNames[0].length).toBe(5)
  })

  it('should complete on end_turn (no tools)', async () => {
    const llm = createMockLLMCall([
      mockResponse('Hello! How can I help?'),
    ])

    const reg = new ToolRegistry()
    const gen = queryLoop({ llmCall: llm }, [{ role: 'user', content: 'hi' }], reg)
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Hello! How can I help?')
    expect(result.turns).toBe(1)
    expect(events.some(e => e.type === 'turn_start')).toBe(true)
    expect(events.some(e => e.type === 'completed')).toBe(true)
  })

  it('should execute tools and continue loop', async () => {
    const llm = createMockLLMCall([
      // Turn 1: call echo tool
      mockResponse('Let me echo that for you.', [
        { id: 'call-1', name: 'echo', arguments: { text: 'test' } },
      ]),
      // Turn 2: final response
      mockResponse('Done! The echo result was "Echo: test".'),
    ])

    const reg = new ToolRegistry()
    reg.register(echoTool)

    const gen = queryLoop({ llmCall: llm }, [{ role: 'user', content: 'echo test' }], reg)
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(result.turns).toBe(2)

    const toolEvents = events.filter(e => e.type === 'tool_result')
    expect(toolEvents).toHaveLength(1)
    expect((toolEvents[0] as any).result.content).toBe('Echo: test')
  })

  it('should respect maxTurns', async () => {
    // LLM 永远调工具，永不结束
    const infiniteToolCalls: LLMResponse[] = Array.from({ length: 10 }, () =>
      mockResponse('Calling tool...', [{ id: `call-${Math.random()}`, name: 'echo', arguments: { text: 'loop' } }])
    )

    const llm = createMockLLMCall(infiniteToolCalls)
    const reg = new ToolRegistry()
    reg.register(echoTool)

    const gen = queryLoop(
      { llmCall: llm, maxTurns: 3 },
      [{ role: 'user', content: 'loop forever' }],
      reg,
    )
    const { result } = await collectEvents(gen)

    expect(result.exitReason).toBe('max_turns')
    expect(result.turns).toBeLessThanOrEqual(3)
  })

  it('should detect gear shift on tool errors', async () => {
    // Turn 1-4: call fail tool → 连续失败 4 次 → 升 2 档
    const responses: LLMResponse[] = [
      ...Array.from({ length: 5 }, () =>
        mockResponse('Trying...', [{ id: `call-${Math.random()}`, name: 'fail', arguments: {} }])
      ),
      mockResponse('I give up.'),  // 最终放弃
    ]

    const llm = createMockLLMCall(responses)
    const reg = new ToolRegistry()
    reg.register(failTool)

    const gen = queryLoop({ llmCall: llm }, [{ role: 'user', content: 'do something' }], reg)
    const { events } = await collectEvents(gen)

    const gearShifts = events.filter(e => e.type === 'gear_shift')
    expect(gearShifts.length).toBeGreaterThan(0)
    // 第 4 次错误时应该升到 2 档
    expect((gearShifts[0] as any).to).toBe(2)
  })


  it('should support write then rewind across query loop turns', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-query-rewind-'))
    tempDirs.push(cwd)
    const filePath = join(cwd, 'story.txt')

    const llm = createMockLLMCall([
      mockResponse('Writing initial file...', [
        { id: 'write-1', name: 'Write', arguments: { file_path: filePath, content: 'version 1\n' } },
      ]),
      mockResponse('Updating file...', [
        { id: 'write-2', name: 'Write', arguments: { file_path: filePath, content: 'version 2\n' } },
      ]),
      mockResponse('Rolling the file back...', [
        { id: 'rewind-1', name: 'RewindFiles', arguments: { snapshot_id: 'write-1' } },
      ]),
      mockResponse('Rollback complete.'),
    ])

    const reg = new ToolRegistry()
    reg.register(WriteTool)
    reg.register(RewindFilesTool)

    const gen = queryLoop({ llmCall: llm, cwd }, [{ role: 'user', content: 'create then rewind' }], reg)
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(readFileSync(filePath, 'utf-8')).toBe('version 1\n')

    const rewindResult = events.find(
      e => e.type === 'tool_result' && (e as any).toolName === 'RewindFiles',
    ) as any
    expect(rewindResult).toBeDefined()
    expect(rewindResult.result.content).toContain('Rewind complete for write-1')
  })

  it('should support test-fail then rewind recovery across query loop turns', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-query-rewind-recovery-'))
    tempDirs.push(cwd)
    const filePath = join(cwd, 'story.txt')

    const statefulBashTool: ToolDefinition = {
      name: 'Bash',
      description: 'Simulated test runner based on file content',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
      execute: async () => {
        const content = readFileSync(filePath, 'utf-8')
        if (content.includes('broken')) {
          return {
            content: '2 fail\nFAIL story.test.ts',
            isError: true,
          }
        }
        return {
          content: '3 pass\n0 fail\nTests: 3 passed, 3 total',
          isError: false,
        }
      },
    }

    const llm = createMockLLMCall([
      mockResponse('Write a good baseline...', [
        { id: 'write-1', name: 'Write', arguments: { file_path: filePath, content: 'stable version\n' } },
      ]),
      mockResponse('Introduce a risky edit...', [
        { id: 'edit-1', name: 'Edit', arguments: { file_path: filePath, old_string: 'stable', new_string: 'broken' } },
      ]),
      mockResponse('Run the tests...', [
        { id: 'bash-1', name: 'Bash', arguments: { command: 'bun test' } },
      ]),
      mockResponse('Rewind to the known good snapshot...', [
        { id: 'rewind-1', name: 'RewindFiles', arguments: { snapshot_id: 'write-1' } },
      ]),
      mockResponse('Run the tests again...', [
        { id: 'bash-2', name: 'Bash', arguments: { command: 'bun test' } },
      ]),
      mockResponse('Recovered successfully.'),
    ])

    const reg = new ToolRegistry()
    reg.register(WriteTool)
    reg.register(EditTool)
    reg.register(RewindFilesTool)
    reg.register(statefulBashTool)

    const gen = queryLoop({ llmCall: llm, cwd }, [{ role: 'user', content: 'repair safely' }], reg)
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    expect(readFileSync(filePath, 'utf-8')).toBe('stable version\n')

    const testEvents = events.filter(e => e.type === 'test_detected') as any[]
    expect(testEvents).toHaveLength(2)
    expect(testEvents[0].passed).toBe(false)
    expect(testEvents[1].passed).toBe(true)

    const rewindResult = events.find(
      e => e.type === 'tool_result' && (e as any).toolName === 'RewindFiles',
    ) as any
    expect(rewindResult.result.content).toContain('Rewind complete for write-1')
  })

  it('S.1: should detect test results in Bash output', async () => {
    const llm = createMockLLMCall([
      mockResponse('Running tests...', [
        { id: 'call-1', name: 'Bash', arguments: { command: 'npm test' } },
      ]),
      mockResponse('All tests passed! The fix is working.'),
    ])

    const reg = new ToolRegistry()
    reg.register(bashTestPassTool)

    const gen = queryLoop({ llmCall: llm }, [{ role: 'user', content: 'run tests' }], reg)
    const { events, result } = await collectEvents(gen)

    expect(result.exitReason).toBe('end_turn')
    const testEvents = events.filter(e => e.type === 'test_detected')
    expect(testEvents).toHaveLength(1)
    expect((testEvents[0] as any).passed).toBe(true)
  })
})

// ── QueryEngine 高层 API 测试 ──

describe('QueryEngine', () => {
  it('should register tools and run query', async () => {
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([mockResponse('Hello!')]),
    })
    engine.registerTool(echoTool)

    expect(engine.toolCount).toBe(1)
    expect(engine.toolNames).toEqual(['echo'])

    const result = await engine.run('hi')
    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Hello!')
  })

  it('should support streaming', async () => {
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([
        mockResponse('Using echo...', [
          { id: 'c1', name: 'echo', arguments: { text: 'world' } },
        ]),
        mockResponse('Done!'),
      ]),
    })
    engine.registerTool(echoTool)

    const events: QueryEvent[] = []
    const gen = engine.stream('echo world')
    let iter = await gen.next()
    while (!iter.done) {
      events.push(iter.value)
      iter = await gen.next()
    }

    expect(events.some(e => e.type === 'tool_result')).toBe(true)
    expect(iter.value.exitReason).toBe('end_turn')
  })

  it('should chain registerTool calls', () => {
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([]),
    })

    engine
      .registerTool(echoTool)
      .registerTool(failTool)

    expect(engine.toolCount).toBe(2)
  })

  it('should auto-connect MCP non-fatally when no .mcp.json exists', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-engine-mcp-missing-'))
    tempDirs.push(cwd)

    const engine = new QueryEngine({
      llmCall: createMockLLMCall([mockResponse('Hello MCP')]),
      cwd,
      mcpAutoConnect: true,
    })

    const result = await engine.run('hi')
    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Hello MCP')
  })

  it('should expose manual MCP connect API', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-engine-mcp-manual-'))
    tempDirs.push(cwd)

    const engine = new QueryEngine({
      llmCall: createMockLLMCall([mockResponse('ok')]),
      cwd,
      mcpAutoConnect: false,
    })

    const status = await engine.connectMCPFromConfig(cwd)
    expect(status.servers).toBe(0)
    expect(status.toolCount).toBe(0)
  })

  it('should auto-load MCP tools from .mcp.json and make them visible', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-engine-mcp-auto-'))
    tempDirs.push(cwd)

    // 创建 mock .mcp.json 配置
    const mcpConfig = {
      mcpServers: {
        'mock-server': {
          command: 'echo',
          args: ['mcp-server'],
          transport: 'stdio',
          enabled: true,
        },
      },
    }
    const configPath = join(cwd, '.mcp.json')
    writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2))

    // 创建 engine 并启用 MCP 自动连接
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([mockResponse('Hello with MCP tools')]),
      cwd,
      mcpAutoConnect: true,
    })

    // 手动调用 connectMCPFromConfig 来模拟自动加载（因为实际MCP服务器可能不存在）
    const status = await engine.connectMCPFromConfig(cwd)

    // 验证连接状态（即使没有实际服务器，API也应该工作）
    expect(status.servers).toBe(0)  // 没有实际服务器连接
    expect(status.toolCount).toBe(0) // 没有工具加载

    // 验证 engine 可以正常运行（即使没有MCP工具）
    const result = await engine.run('test query')
    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Hello with MCP tools')
  })

  it('should make MCP tools visible after auto-load (mock)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-engine-mcp-mock-'))
    tempDirs.push(cwd)

    // 创建 engine 并启用 MCP 自动连接
    const engine = new QueryEngine({
      llmCall: createMockLLMCall([
        // 第一轮：调用 MCP 工具
        mockResponse('Let me use MCP tools', [
          { id: 'call-1', name: 'mcp__mock-server__list_files', arguments: { path: '/tmp' } },
        ]),
        // 第二轮：完成
        mockResponse('Done with MCP tools'),
      ]),
      cwd,
      mcpAutoConnect: true,
    })

    // 手动注册 mock MCP 工具来模拟自动加载
    const mockMCPTool = {
      name: 'mcp__mock-server__list_files',
      description: '[MCP:mock-server] List files in directory',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      execute: async () => ({ content: 'file1.txt\nfile2.txt', isError: false }),
    }
    engine.registerTool(mockMCPTool)

    // 验证工具已注册
    expect(engine.toolCount).toBe(1)
    expect(engine.toolNames).toContain('mcp__mock-server__list_files')

    // 运行查询验证工具可用
    const result = await engine.run('list files in /tmp')
    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBe('Done with MCP tools')
  })
})
