import { afterEach, describe, expect, test } from 'bun:test'
import { BashTool } from '../../../tools/BashTool/BashTool'
import { getEmptyToolPermissionContext } from '../../../Tool'
import {
  buildDsxuRecoveryState,
  buildDsxuToolStateCursorNudge,
  getDsxuFileLookupMissStreakSinceProgress,
  query,
  shouldAllowSystemQueuedCommandDrainForTurn,
} from '../../../query'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages'
import {
  enqueuePendingNotification,
  getCommandQueueLength,
  resetCommandQueue,
  selectQueuedCommandsForQueryTurn,
} from '../../../utils/messageQueueManager'
import { asSystemPrompt } from '../../../utils/systemPromptType'

async function drainQueryForTest(params: Parameters<typeof query>[0]) {
  const events: unknown[] = []
  const iterator = query(params)
  while (true) {
    const next = await iterator.next()
    if (next.done) return { events, terminal: next.value }
    events.push(next.value)
  }
}

function createQueryHarness(
  overrides: Partial<Parameters<typeof query>[0]> = {},
): Parameters<typeof query>[0] {
  const appState = {
    toolPermissionContext: getEmptyToolPermissionContext(),
    fastMode: false,
    mcp: { tools: [], clients: [] },
    effortValue: undefined,
    advisorModel: undefined,
    tasks: {},
  }

  return {
    messages: [createUserMessage({ content: 'new human task' })],
    systemPrompt: asSystemPrompt(['DSXU same-window boundary system prompt']),
    userContext: {},
    systemContext: {},
    canUseTool: (async () => ({
      behavior: 'deny',
      message: 'blocked by same-window boundary replay',
      decisionReason: { type: 'mode', mode: 'default' },
    })) as never,
    toolUseContext: {
      options: {
        commands: [],
        debug: false,
        mainLoopModel: 'deepseek-v4-harness',
        tools: [BashTool],
        verbose: false,
        thinkingConfig: { type: 'disabled' },
        mcpClients: [],
        mcpResources: {},
        isNonInteractiveSession: true,
        agentDefinitions: {
          activeAgents: [],
          allowedAgentTypes: undefined,
        },
      },
      abortController: new AbortController(),
      readFileState: {} as never,
      getAppState: () => appState as never,
      setAppState: () => {},
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      updateFileHistoryState: () => {},
      updateAttributionState: () => {},
      messages: [],
    } as never,
    fallbackModel: 'deepseek-v4-fallback-harness',
    querySource: 'sdk',
    deps: {
      callModel: (async function* () {}) as never,
      microcompact: (async messages => ({ messages })) as never,
      autocompact: (async () => ({ wasCompacted: false })) as never,
      uuid: () => '00000000-0000-4000-8000-000000000099',
    },
    ...overrides,
  }
}

afterEach(() => {
  resetCommandQueue()
})

describe('DSXU same-window topic boundary replay', () => {
  test('defers system notifications during a fresh human topic but keeps human queued prompts attachable', () => {
    const humanPrompt = {
      value: 'new user correction',
      mode: 'prompt' as const,
      priority: 'next' as const,
    }
    const oldTaskNotification = {
      value: 'OLD_BACKGROUND_RESULT_SHOULD_NOT_DRIVE_THE_NEW_TOPIC',
      mode: 'task-notification' as const,
      priority: 'next' as const,
      isMeta: true as const,
      origin: { kind: 'task-notification' as const },
    }
    const heartbeat = {
      value: '<heartbeat>continue old automation</heartbeat>',
      mode: 'prompt' as const,
      priority: 'next' as const,
      isMeta: true as const,
      origin: { kind: 'coordinator' as const },
    }

    const decision = selectQueuedCommandsForQueryTurn(
      [humanPrompt, oldTaskNotification, heartbeat],
      {
        maxPriority: 'next',
        isMainThread: true,
        allowSystemNotifications: false,
      },
    )

    expect(decision.attachable).toEqual([humanPrompt])
    expect(decision.deferred.map(item => item.command.value)).toEqual([
      'OLD_BACKGROUND_RESULT_SHOULD_NOT_DRIVE_THE_NEW_TOPIC',
      '<heartbeat>continue old automation</heartbeat>',
    ])
    expect(
      decision.deferredReasonCounts.system_command_deferred_by_human_turn,
    ).toBe(2)
  })

  test('allows system notifications only when the human explicitly asks for background status', () => {
    expect(
      shouldAllowSystemQueuedCommandDrainForTurn([
        createUserMessage({ content: '话题结束了，为什么还在回复旧问题？' }),
      ]),
    ).toBe(false)
    expect(
      shouldAllowSystemQueuedCommandDrainForTurn([
        createUserMessage({ content: '看一下后台任务状态和输出结果' }),
      ]),
    ).toBe(true)
  })

  test('live query replay does not inject stale background completion into a new human topic after a tool result', async () => {
    enqueuePendingNotification({
      value: 'OLD_RTK_BACKGROUND_RESULT_SHOULD_NOT_ENTER_MODEL',
      mode: 'task-notification',
      priority: 'next',
      isMeta: true,
      origin: { kind: 'task-notification' } as never,
    })

    let providerCalls = 0
    let secondProviderMessages = ''
    const base = createQueryHarness()
    const { terminal } = await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            '话题结束了，上下文还记得上面问题，然后自言自语出现，历史问题回复。',
        }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerCalls += 1
          if (providerCalls === 1) {
            yield createAssistantMessage({
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu-boundary-bash',
                  name: 'Bash',
                  input: { command: 'echo boundary' },
                },
              ],
            }) as never
            return
          }
          secondProviderMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'same-window boundary replay complete',
          }) as never
        }) as never,
      },
    })

    expect(terminal.reason).toBe('completed')
    expect(providerCalls).toBe(2)
    expect(secondProviderMessages).not.toContain(
      'OLD_RTK_BACKGROUND_RESULT_SHOULD_NOT_ENTER_MODEL',
    )
    expect(getCommandQueueLength()).toBe(1)
  })
})

describe('DSXU same-window file lookup boundary replay', () => {
  test('turns repeated not-found evidence into a query-loop boundary instead of broader search', () => {
    const globUse = {
      type: 'tool_use',
      id: 'toolu-file-glob-miss',
      name: 'Glob',
      input: { pattern: 'animal-match.html', path: '/mnt/d/games' },
    }
    const bashUse = {
      type: 'tool_use',
      id: 'toolu-empty-games-dir',
      name: 'Bash',
      input: { command: 'ls -la /mnt/d/games' },
    }
    const conversationMessages = [
      createUserMessage({ content: 'Only one problem remains: develop the game.' }),
      createAssistantMessage({
        content: 'The game file is already at /mnt/d/games/animal-match.html.',
      }),
      createUserMessage({ content: 'You remembered wrong. Check it.' }),
    ]
    const toolResults = [
      createUserMessage({
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-file-glob-miss',
            content: 'No files found',
          },
        ],
      }),
      createUserMessage({
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-empty-games-dir',
            content: [
              'total 0',
              'drwxrwxrwx 1 user user 4096 May  9 10:09 .',
              'drwxrwxrwx 1 user user 4096 May  9 10:11 ..',
            ].join('\n'),
          },
        ],
      }),
    ]

    expect(
      getDsxuFileLookupMissStreakSinceProgress(
        [...conversationMessages, createAssistantMessage({ content: [globUse] }) as never],
        [
          { toolName: 'Glob', text: 'No files found' },
          { toolName: 'Bash', text: 'total 0' },
        ],
      ),
    ).toBe(2)

    const state = buildDsxuRecoveryState({
      toolResults,
      toolUseBlocks: [globUse, bashUse] as never,
      conversationMessages,
    })
    expect(state.state).toBe('file_lookup_boundary_required')
    expect(state.requiredAction).toBe(
      'answer_with_current_filesystem_evidence',
    )

    const nudge = buildDsxuToolStateCursorNudge(
      toolResults,
      [globUse, bashUse] as never,
      conversationMessages,
    )
    expect(nudge).toContain('file_lookup_boundary')
    expect(nudge).toContain('Do not keep expanding')
    expect(nudge).toContain('Do not claim a path exists')
  })

  test('resets file lookup miss loop after exact filesystem progress', () => {
    expect(
      getDsxuFileLookupMissStreakSinceProgress(
        [],
        [
          { toolName: 'Glob', text: 'No files found' },
          {
            toolName: 'Glob',
            text: 'Found 1 file\n/mnt/d/games/animal-match.html',
          },
        ],
      ),
    ).toBe(0)
  })
})
