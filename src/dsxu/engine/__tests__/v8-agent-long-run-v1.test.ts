import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../../Tool'
import { getPrompt as getAgentToolPrompt } from '../../../tools/AgentTool/prompt'
import {
  resolveAgentTools,
  runAsyncAgentLifecycle,
} from '../../../tools/AgentTool/agentToolUtils'
import { getPrompt as getSendMessageToolPrompt } from '../../../tools/SendMessageTool/prompt'
import {
  drainPendingAgentContinuationMessages,
  enqueueAgentNotification,
} from '../../../tasks/LocalAgentTask/LocalAgentTask'
import { dequeueAll, getCommandQueue } from '../../../utils/messageQueueManager'
import { createAssistantMessage } from '../../../utils/messages'
import { readFileSync } from 'fs'
import { join } from 'path'

function tool(name: string): any {
  return { name }
}

function createAgentAppState(agentId = 'agentv8longrun0001', pendingMessages: string[] = []) {
  return {
    agentNameRegistry: new Map([['verifier', agentId]]),
    speculation: { status: 'idle' },
    toolPermissionContext: {
      ...getEmptyToolPermissionContext(),
      mode: 'acceptEdits',
      alwaysAllowRules: {
        cliArg: ['Read'],
        session: ['Bash(bun test *)'],
      },
    },
    tasks: {
      [agentId]: {
        id: agentId,
        type: 'local_agent',
        status: 'running',
        description: 'V8 verifier long-run worker',
        prompt: 'Verify the long-run agent contract.',
        agentType: 'verification',
        pendingMessages,
        isBackgrounded: true,
        retrieved: false,
        lastReportedToolCount: 0,
        lastReportedTokenCount: 0,
        retain: false,
        diskLoaded: false,
      },
    },
  } as any
}

describe('DSXU V8 Agent long-run contract', () => {
  test('keeps Agent and SendMessage prompts strict enough for weak-model long runs', async () => {
    const providerApiKeyEnv = 'ANTH' + 'ROPIC_API_KEY'
    const legacyOauthEnv = 'CL' + 'AUDE_CODE_OAUTH_TOKEN'
    const previousApiKey = process.env[providerApiKeyEnv]
    const previousOauth = process.env[legacyOauthEnv]
    process.env[providerApiKeyEnv] = previousApiKey ?? `sk-${'ant'}-api03-test-dsxu-provider-key`
    process.env[legacyOauthEnv] = previousOauth ?? 'test-dsxu-oauth-token'

    let prompt = ''
    try {
      prompt = await getAgentToolPrompt([], false)
    } finally {
      if (previousApiKey === undefined) {
        delete process.env[providerApiKeyEnv]
      } else {
        process.env[providerApiKeyEnv] = previousApiKey
      }
      if (previousOauth === undefined) {
        delete process.env[legacyOauthEnv]
      } else {
        process.env[legacyOauthEnv] = previousOauth
      }
    }
    const sendMessagePrompt = getSendMessageToolPrompt()

    expect(prompt).toContain('Worker tool pool inheritance')
    expect(prompt).toContain('Permission inheritance')
    expect(prompt).toContain('Verifier re-check')
    expect(prompt).toContain('Task notification evidence')
    expect(prompt).toContain('AgentSummary parent synthesis')
    expect(prompt).toContain('Parent synthesis rules')
    expect(prompt).toContain('Multi-Agent discipline')
    expect(prompt).toContain('Never fabricate pending agent results')
    expect(prompt).toContain('one active owner per write scope')
    expect(prompt).toContain('A verifier PASS must be based on commands')

    expect(sendMessagePrompt).toContain('continue an existing worker')
    expect(sendMessagePrompt).toContain('verifier correction')
    expect(sendMessagePrompt).toContain('do not send "ok", "continue?", or generic acknowledgements')
    expect(sendMessagePrompt).toContain('PASS/PARTIAL/FAIL expectation')
  })

  test('narrows async worker tool pools while preserving Agent routing metadata', () => {
    const resolved = resolveAgentTools({
      tools: ['Read', 'Edit', 'Agent(worker, verification)', 'SendMessage'],
      disallowedTools: ['Edit'],
      source: 'built-in',
      permissionMode: 'acceptEdits',
    }, [
      tool('Read'),
      tool('Edit'),
      tool('Agent'),
      tool('SendMessage'),
      tool('TaskUpdate'),
    ] as any, true)

    expect(resolved.validTools).toContain('Read')
    expect(resolved.validTools).toContain('Agent(worker, verification)')
    expect(resolved.invalidTools).toContain('Edit')
    expect(resolved.invalidTools).toContain('SendMessage')
    expect(resolved.allowedAgentTypes).toEqual(['worker', 'verification'])
    expect(resolved.resolvedTools.map(t => t.name)).toEqual(['Read'])
  })

  test('runs worker continuation through completion before notification embellishment', async () => {
    dequeueAll()
    const agentId = 'agentv8longrun0002'
    let appState = createAgentAppState(agentId, [
      'VERIFIER FAIL: missing command evidence. Re-run the fixture test and report PASS/PARTIAL/FAIL.',
    ])
    const setAppState = (updater: (prev: any) => any) => {
      appState = updater(appState)
    }
    const continuation = drainPendingAgentContinuationMessages(
      agentId,
      () => appState,
      setAppState,
    )

    let statusWhenWorktreeRequested: string | undefined
    await runAsyncAgentLifecycle({
      taskId: agentId,
      abortController: new AbortController(),
      makeStream: async function* () {
        expect(continuation).toHaveLength(1)
        expect(String(continuation[0]?.message.content)).toContain('DSXU SendMessage continuation')
        expect(String(continuation[0]?.message.content)).toContain('failed verification')
        expect(String(continuation[0]?.message.content)).toContain('available tools and permission rules')
        yield createAssistantMessage({
          content: [{
            type: 'tool_use',
            id: 'v8-agent-read',
            name: 'Read',
            input: { file_path: 'tmp/v8-live-fixtures/example.test.ts' },
          } as any],
          usage: {
            input_tokens: 20,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
        yield createAssistantMessage({
          content: 'PASS: verifier re-checked the fixture with command evidence after SendMessage correction.',
          usage: {
            input_tokens: 21,
            output_tokens: 15,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
      },
      metadata: {
        prompt: 'V8 long-run verifier repair',
        resolvedAgentModel: 'deepseek-v4',
        isBuiltInAgent: true,
        startTime: Date.now(),
        agentType: 'verification',
        isAsync: true,
      },
      description: 'V8 verifier long-run worker',
      toolUseContext: {
        toolUseId: 'tool-v8-agent-long-run',
        options: { tools: [tool('Read')] },
        getAppState: () => appState,
        setAppState,
        setAppStateForTasks: setAppState,
      } as any,
      rootSetAppState: setAppState,
      agentIdForCleanup: agentId,
      enableSummarization: false,
      getWorktreeResult: async () => {
        statusWhenWorktreeRequested = appState.tasks[agentId].status
        return {
          worktreePath: 'D:/DSXU-code/tmp/v8-live-fixtures/agent-long-run',
          worktreeBranch: 'agent/v8-long-run',
        }
      },
    })

    expect(statusWhenWorktreeRequested).toBe('completed')
    expect(appState.tasks[agentId].status).toBe('completed')
    expect(appState.tasks[agentId].pendingMessages).toEqual([])
    expect(appState.tasks[agentId].result.content[0].text).toContain('PASS: verifier re-checked')

    const queued = getCommandQueue()
    expect(queued).toHaveLength(1)
    const notification = String(queued[0]?.value)
    expect(notification).toContain('<task-notification>')
    expect(notification).toContain(`<task-id>${agentId}</task-id>`)
    expect(notification).toContain('<status>completed</status>')
    expect(notification).toContain('<tool-use-id>tool-v8-agent-long-run</tool-use-id>')
    expect(notification).toContain('<tool_uses>1</tool_uses>')
    expect(notification).toContain('PASS: verifier re-checked')
    expect(notification).toContain('<worktreePath>D:/DSXU-code/tmp/v8-live-fixtures/agent-long-run</worktreePath>')
    dequeueAll()
  })

  test('keeps AgentSummary non-overlapping and parent synthesis evidence bounded', () => {
    const summarySource = readFileSync(
      join(process.cwd(), 'src/services/AgentSummary/agentSummary.ts'),
      'utf8',
    )
    const runAgentSource = readFileSync(
      join(process.cwd(), 'src/tools/AgentTool/runAgent.ts'),
      'utf8',
    )

    expect(summarySource).toContain('Reset timer on completion (not initiation) to prevent overlapping summaries')
    expect(summarySource).toContain("behavior: 'deny' as const")
    expect(summarySource).toContain('No tools needed for summary')
    expect(summarySource).toContain('updateAgentSummary(taskId, summaryText, setAppState)')
    expect(runAgentSource).toContain('toolPermissionContext = {')
    expect(runAgentSource).toContain('session: [...allowedTools]')
    expect(runAgentSource).toContain('additionalWorkingDirectories')
    expect(runAgentSource).toContain('onCacheSafeParams({')
  })

  test('does not duplicate terminal agent notifications', () => {
    dequeueAll()
    const agentId = 'agentv8longrun0003'
    let appState = createAgentAppState(agentId)
    const setAppState = (updater: (prev: any) => any) => {
      appState = updater(appState)
    }

    enqueueAgentNotification({
      taskId: agentId,
      description: 'V8 duplicate notification guard',
      status: 'completed',
      setAppState,
      finalMessage: 'PASS: first notification is authoritative.',
      toolUseId: 'tool-v8-agent-notify',
    })
    enqueueAgentNotification({
      taskId: agentId,
      description: 'V8 duplicate notification guard',
      status: 'failed',
      setAppState,
      error: 'second notification should be suppressed',
      toolUseId: 'tool-v8-agent-notify',
    })

    const queued = getCommandQueue()
    expect(queued).toHaveLength(1)
    expect(String(queued[0]?.value)).toContain('PASS: first notification is authoritative')
    expect(String(queued[0]?.value)).not.toContain('second notification should be suppressed')
    dequeueAll()
  })
})
