import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/providerSdk.js'
import { BashTool } from '../../../tools/BashTool/BashTool'
import { getEmptyToolPermissionContext } from '../../../Tool'
import {
  query,
  shouldAllowSystemQueuedCommandDrainForTurn,
} from '../../../query'
import {
  buildDsxuLatestUserIntentContextView,
  buildDsxuLatestUserIntentOverrideNudge,
  classifyDsxuLatestUserIntentOverride,
} from '../latest-user-intent-override-v1'
import { getDsxuToolBatchGateDecision } from '../../../services/tools/dsxuToolBatchGate.js'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages.js'
import { asSystemPrompt } from '../../../utils/systemPromptType'

const CANCEL_ZH = '\u4e0d\u7528\u5904\u7406\u4e86'
const ANALYSIS_ONLY_ZH =
  '\u53ea\u5206\u6790\uff0c\u4e0d\u8981\u64cd\u4f5c\uff0c\u4e0d\u8981\u6267\u884c\u547d\u4ee4'
const STALE_META_ZH =
  '\u4e3a\u4ec0\u4e48\u6211\u95ee\u4f60\u95ee\u9898\uff0c\u4f60\u4e00\u76f4\u56de\u590d\u4ee5\u524d\u95ee\u9898\uff0c\u8fd8\u95ee\u975e\u6240\u7b54\uff1f'
const CONTINUE_STATUS_ZH =
  '\u7ee7\u7eed\u6267\u884c\uff0c\u770b\u770b\u540e\u53f0\u4efb\u52a1\u8f93\u51fa\u7ed3\u679c'
const CONTINUE_ANALYSIS_ZH =
  '\u7ee7\u7eed\u5206\u6790\u4e0a\u4e0b\u6587\u95ee\u9898\uff0c\u522b\u8dd1\u547d\u4ee4'
const SUBTLE_CANCEL_PHRASES_ZH = [
  '\u7b97\u4e86\u5427',
  '\u5148\u8fd9\u6837',
  '\u522b\u7ba1\u90a3\u4e2a\u4e86',
  '\u5148\u5230\u8fd9\u91cc',
  '\u8fd9\u4e2a\u5148\u653e\u4e0b',
  '\u6362\u4e2a\u8bdd\u9898',
]

function toolUse(
  name: string,
  input: Record<string, unknown> = {},
  id = `${name.toLowerCase()}-latest-intent`,
): ToolUseBlock {
  return {
    type: 'tool_use',
    id,
    name,
    input,
  }
}

function assistantFor(block: ToolUseBlock) {
  return createAssistantMessage({
    content: [block as never],
  })
}

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
    messages: [createUserMessage({ content: 'latest user task' })],
    systemPrompt: asSystemPrompt(['DSXU latest user intent system prompt']),
    userContext: {},
    systemContext: {},
    canUseTool: (async () => ({
      behavior: 'deny',
      message: 'blocked by latest-user-intent replay',
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
      uuid: () => '00000000-0000-4000-8000-000000000088',
    },
    ...overrides,
  }
}

function toolResult(toolUseId: string, content: string) {
  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: true,
      },
    ],
    toolUseResult: content,
  })
}

describe('DSXU latest user intent override V1', () => {
  test('Chinese cancel request blocks queued system drain and old task tools', () => {
    const messages = [
      createUserMessage({ content: CANCEL_ZH }),
    ]

    expect(
      classifyDsxuLatestUserIntentOverride(messages),
    ).toMatchObject({
      kind: 'cancel_current_task',
      blocksTools: true,
      blocksQueuedSystemDrain: true,
    })
    expect(shouldAllowSystemQueuedCommandDrainForTurn(messages)).toBe(false)

    const bash = toolUse('Bash', {
      command: 'python3 graphify-connector.py stats',
    })
    const decision = getDsxuToolBatchGateDecision({
      messages,
      toolUseBlocks: [bash],
      block: bash,
    })

    expect(decision).toMatchObject({
      gateId: 'dsxu_latest_user_intent_tool_gate',
      gateClass: 'USER_INTENT_BLOCK',
      reason: 'latest_user_cancel_current_task',
      blocked: true,
      nextAction: 'visible_answer_to_latest_user_only',
    })
    expect(
      JSON.stringify(decision!.createMessage(assistantFor(bash)).message.content),
    ).toContain('tool_blocked_latest_user_intent')
  })

  test('subtle Chinese stop or topic-switch phrases cancel the current stale task', () => {
    for (const phrase of SUBTLE_CANCEL_PHRASES_ZH) {
      const messages = [createUserMessage({ content: phrase })]
      expect(
        classifyDsxuLatestUserIntentOverride(messages),
      ).toMatchObject({
        kind: 'cancel_current_task',
        blocksTools: true,
        blocksQueuedSystemDrain: true,
      })
      expect(shouldAllowSystemQueuedCommandDrainForTurn(messages)).toBe(false)

      const bash = toolUse('Bash', {
        command: 'python3 graphify-connector.py stats',
      }, `toolu-subtle-${phrase.length}`)
      expect(
        getDsxuToolBatchGateDecision({
          messages,
          toolUseBlocks: [bash],
          block: bash,
        }),
      ).toMatchObject({
        gateClass: 'USER_INTENT_BLOCK',
        reason: 'latest_user_cancel_current_task',
      })
    }
  })

  test('analysis-only request forbids tools but does not look like a stale topic complaint', () => {
    const messages = [
      createUserMessage({ content: ANALYSIS_ONLY_ZH }),
    ]

    const nudge = buildDsxuLatestUserIntentOverrideNudge(messages)
    expect(nudge).toContain('user_intent: analysis_only')
    expect(nudge).toContain('do not continue stale plans')
    expect(shouldAllowSystemQueuedCommandDrainForTurn(messages)).toBe(false)

    const read = toolUse('Read', { file_path: 'src/query.ts' })
    expect(
      getDsxuToolBatchGateDecision({
        messages,
        toolUseBlocks: [read],
        block: read,
      }),
    ).toMatchObject({
      gateClass: 'USER_INTENT_BLOCK',
      reason: 'latest_user_analysis_only',
    })
  })

  test('meta question about old answers takes priority over old verification loops', () => {
    const messages = [
      createUserMessage({
        content: STALE_META_ZH,
      }),
    ]

    expect(
      classifyDsxuLatestUserIntentOverride(messages),
    ).toMatchObject({
      kind: 'stale_topic_or_meta_question',
      nextAction: 'answer_latest_meta_question_without_tools_or_old_task_retry',
    })
    expect(shouldAllowSystemQueuedCommandDrainForTurn(messages)).toBe(false)
  })

  test('explicit status or continue request still allows system queue drain', () => {
    expect(
      shouldAllowSystemQueuedCommandDrainForTurn([
        createUserMessage({ content: CONTINUE_STATUS_ZH }),
      ]),
    ).toBe(true)
    expect(
      shouldAllowSystemQueuedCommandDrainForTurn([
        createUserMessage({ content: 'status and background output please' }),
      ]),
    ).toBe(true)
  })

  test('context-analysis continuation does not drain stale background commands', () => {
    const messages = [
      createUserMessage({ content: CONTINUE_ANALYSIS_ZH }),
    ]

    expect(
      classifyDsxuLatestUserIntentOverride(messages),
    ).toMatchObject({
      kind: 'analysis_only',
    })
    expect(shouldAllowSystemQueuedCommandDrainForTurn(messages)).toBe(false)
  })

  test('cancel request prunes stale provider context instead of merely appending a nudge', async () => {
    const oldBash = toolUse('Bash', {
      command: 'python3 graphify-connector.py stats',
    }, 'toolu-old-stats')
    let providerMessages = ''
    const base = createQueryHarness()

    const { terminal } = await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Create graphify-connector.py and keep validating graph.json with stats.',
        }),
        createAssistantMessage({ content: [oldBash as never] }),
        toolResult(
          oldBash.id,
          'Error: Exit code 49 while running python3 graphify-connector.py stats',
        ),
        createUserMessage({ content: CANCEL_ZH }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'Stopped. I will not continue the old validation.',
          }) as never
        }) as never,
      },
    })

    expect(terminal.reason).toBe('completed')
    expect(providerMessages).toContain('latest-user-intent override gate')
    expect(providerMessages).toContain(CANCEL_ZH)
    expect(providerMessages).not.toContain('graphify-connector.py')
    expect(providerMessages).not.toContain('Exit code 49')
    expect(providerMessages).not.toContain('python3 graphify-connector.py stats')
  })

  test('stale-topic meta question also prunes old provider context', async () => {
    const oldBash = toolUse('Bash', {
      command: 'python3 graphify-connector.py stats',
    }, 'toolu-old-stats-meta')
    let providerMessages = ''
    const base = createQueryHarness()

    await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Create graphify-connector.py and keep validating graph.json with stats.',
        }),
        createAssistantMessage({ content: [oldBash as never] }),
        toolResult(
          oldBash.id,
          'Error: Exit code 49 while running python3 graphify-connector.py stats',
        ),
        createUserMessage({ content: STALE_META_ZH }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content:
              'The old task leaked because stale recovery state outranked the latest user question.',
          }) as never
        }) as never,
      },
    })

    expect(providerMessages).toContain('latest-user-intent override gate')
    expect(providerMessages).toContain(STALE_META_ZH)
    expect(providerMessages).not.toContain('graphify-connector.py')
    expect(providerMessages).not.toContain('Exit code 49')
  })

  test('analysis-only keeps prior context for analysis while still forbidding tools', async () => {
    let providerMessages = ''
    const base = createQueryHarness()

    await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Analyze the cache-warmer.ts stable prefix plan and performance risk.',
        }),
        createAssistantMessage({
          content:
            'The relevant prior context mentions cache-warmer.ts and stable/dynamic prefix partition.',
        }),
        createUserMessage({ content: ANALYSIS_ONLY_ZH }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'Analysis only; no tools.',
          }) as never
        }) as never,
      },
    })

    expect(providerMessages).toContain('latest-user-intent override gate')
    expect(providerMessages).toContain('cache-warmer.ts')
    expect(providerMessages).toContain('stable/dynamic prefix')
  })

  test('existing override nudge still prunes stale provider context on later loop turns', async () => {
    const existingNudge = buildDsxuLatestUserIntentOverrideNudge([
      createUserMessage({ content: CANCEL_ZH }),
    ])!
    let providerMessages = ''
    const base = createQueryHarness()

    await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Create graphify-connector.py and keep validating graph.json with stats.',
        }),
        toolResult(
          'toolu-old-stats-existing-nudge',
          'Error: Exit code 49 while running python3 graphify-connector.py stats',
        ),
        createUserMessage({ content: CANCEL_ZH }),
        createUserMessage({ content: existingNudge, isMeta: true }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'Stopped.',
          }) as never
        }) as never,
      },
    })

    expect(providerMessages).toContain('latest-user-intent override gate')
    expect(providerMessages).toContain(CANCEL_ZH)
    expect(providerMessages).not.toContain('graphify-connector.py')
    expect(providerMessages).not.toContain('Exit code 49')
  })

  test('tool-blocked retry turn prunes the blocked stale command before the next provider call', async () => {
    let providerCalls = 0
    let secondProviderMessages = ''
    const staleBash = toolUse('Bash', {
      command: 'python3 graphify-connector.py stats',
    }, 'toolu-stale-after-cancel')
    const base = createQueryHarness()

    const { terminal } = await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Create graphify-connector.py and keep validating graph.json with stats.',
        }),
        toolResult(
          'toolu-old-stats-before-cancel',
          'Error: Exit code 49 while running python3 graphify-connector.py stats',
        ),
        createUserMessage({ content: CANCEL_ZH }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerCalls += 1
          if (providerCalls === 1) {
            yield createAssistantMessage({
              content: [staleBash as never],
            }) as never
            return
          }
          secondProviderMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'Stopped. No old command will be retried.',
          }) as never
        }) as never,
      },
    })

    expect(terminal.reason).toBe('completed')
    expect(providerCalls).toBe(2)
    expect(secondProviderMessages).toContain('latest-user-intent override gate')
    expect(secondProviderMessages).toContain(CANCEL_ZH)
    expect(secondProviderMessages).not.toContain('graphify-connector.py')
    expect(secondProviderMessages).not.toContain('Exit code 49')
    expect(secondProviderMessages).not.toContain('python3 graphify-connector.py stats')
  })

  test('pure context view prunes cancel/meta but not analysis-only material', () => {
    const cancelView = buildDsxuLatestUserIntentContextView([
      createUserMessage({ content: 'old task: graphify-connector.py stats' }),
      createUserMessage({ content: CANCEL_ZH }),
    ])
    expect(cancelView.pruned).toBe(true)
    expect(JSON.stringify(cancelView.messages)).not.toContain('graphify-connector')

    const analysisView = buildDsxuLatestUserIntentContextView([
      createUserMessage({ content: 'old material: cache-warmer.ts' }),
      createUserMessage({ content: ANALYSIS_ONLY_ZH }),
    ])
    expect(analysisView.pruned).toBe(false)
    expect(JSON.stringify(analysisView.messages)).toContain('cache-warmer.ts')
  })

  test('context view prunes compact summaries, agent evidence, and old background task text for cancel/meta', () => {
    const staleSources = [
      createUserMessage({
        content:
          'COMPACT SUMMARY: current task is graphify-connector.py validation, keep rerunning stats.',
        isMeta: true,
      }),
      createUserMessage({
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-agent-old',
            content:
              'Agent handoff: continue graphify-connector.py stats after Exit code 49.',
            is_error: false,
          },
        ],
        toolUseResult:
          'Agent handoff: continue graphify-connector.py stats after Exit code 49.',
      }),
      createUserMessage({
        content:
          'OLD_BACKGROUND_RESULT: python3 graphify-connector.py stats failed again.',
        isMeta: true,
      }),
    ]

    const cancelView = buildDsxuLatestUserIntentContextView([
      ...staleSources,
      createUserMessage({ content: CANCEL_ZH }),
    ])
    expect(cancelView.pruned).toBe(true)
    const cancelPayload = JSON.stringify(cancelView.messages)
    expect(cancelPayload).not.toContain('COMPACT SUMMARY')
    expect(cancelPayload).not.toContain('Agent handoff')
    expect(cancelPayload).not.toContain('OLD_BACKGROUND_RESULT')
    expect(cancelPayload).not.toContain('graphify-connector.py')
    expect(cancelPayload).toContain(CANCEL_ZH)

    const metaView = buildDsxuLatestUserIntentContextView([
      ...staleSources,
      createUserMessage({ content: STALE_META_ZH }),
    ])
    expect(metaView.pruned).toBe(true)
    const metaPayload = JSON.stringify(metaView.messages)
    expect(metaPayload).not.toContain('COMPACT SUMMARY')
    expect(metaPayload).not.toContain('Agent handoff')
    expect(metaPayload).not.toContain('OLD_BACKGROUND_RESULT')
    expect(metaPayload).not.toContain('Exit code 49')
    expect(metaPayload).toContain(STALE_META_ZH)
  })

  test('cancel request prunes concurrent agent handoffs and compact recovery state before provider call', async () => {
    const agentA = toolUse('Task', {
      description: 'agent-a validates connector',
    }, 'toolu-agent-a')
    const agentB = toolUse('Task', {
      description: 'agent-b retries stats',
    }, 'toolu-agent-b')
    const longOldTrace = Array.from({ length: 30 }, (_, index) =>
      createUserMessage({
        content:
          `COMPACT RECOVERY CHUNK ${index}: old graphify-connector.py stats retry ledger ` +
          'must continue after Exit code 49.',
        isMeta: true,
      }),
    )
    let providerMessages = ''
    const base = createQueryHarness()

    await drainQueryForTest({
      ...base,
      messages: [
        createUserMessage({
          content:
            'Keep both agents running until graphify-connector.py stats passes.',
        }),
        createAssistantMessage({
          content: [agentA as never, agentB as never],
        }),
        toolResult(
          agentA.id,
          'Agent A evidence envelope: retry python3 graphify-connector.py stats.',
        ),
        toolResult(
          agentB.id,
          'Agent B background result: Exit code 49, keep validating connector.',
        ),
        ...longOldTrace,
        createUserMessage({ content: '\u6362\u4e2a\u95ee\u9898' }),
      ],
      deps: {
        ...base.deps!,
        callModel: (async function* ({ messages }) {
          providerMessages = JSON.stringify(messages)
          yield createAssistantMessage({
            content: 'Topic changed. I will not continue the old agents.',
          }) as never
        }) as never,
      },
    })

    expect(providerMessages).toContain('latest-user-intent override gate')
    expect(providerMessages).toContain('\u6362\u4e2a\u95ee\u9898')
    expect(providerMessages).not.toContain('agent-a validates connector')
    expect(providerMessages).not.toContain('Agent A evidence envelope')
    expect(providerMessages).not.toContain('Agent B background result')
    expect(providerMessages).not.toContain('COMPACT RECOVERY CHUNK')
    expect(providerMessages).not.toContain('graphify-connector.py')
    expect(providerMessages).not.toContain('Exit code 49')
  })
})
