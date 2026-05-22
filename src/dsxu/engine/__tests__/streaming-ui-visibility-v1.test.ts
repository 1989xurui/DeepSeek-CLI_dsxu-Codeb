import { describe, expect, test } from 'bun:test'
import {
  createAssistantMessage,
  createSystemMessage,
  createUserMessage,
  getToolResultAutoContinueSource,
  handleMessageFromStream,
  type StreamingThinking,
} from '../../../utils/messages'
import type { SpinnerMode } from '../../../components/Spinner'
import { getAuthBlockedNotificationText } from '../../../components/PromptInput/Notifications'
import {
  CCR_AUTH_ERROR_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL,
  TOKEN_REVOKED_ERROR_MESSAGE,
  startsWithApiErrorPrefix,
} from '../../../services/api/errors'
import {
  getToolPermissionFallbackSummary,
  getVisibleStreamingTextForUi,
} from '../../../screens/REPL'
import { BashTool } from '../../../tools/BashTool/BashTool'
import {
  buildDsxuTuiHealthSnapshot,
  findMojibakeIssuesInText,
  looksLikeMojibake,
} from '../../../utils/dsxuHealthMonitor'

describe('DSXU streaming UI visibility', () => {
  test('thinking deltas update the visible streaming thinking buffer', () => {
    let mode: SpinnerMode | null = null
    let responseLength = 0
    let streamingThinking: StreamingThinking | null = null

    const handle = (message: Parameters<typeof handleMessageFromStream>[0]) =>
      handleMessageFromStream(
        message,
        () => {},
        text => {
          responseLength += text.length
        },
        nextMode => {
          mode = nextMode
        },
        () => {},
        undefined,
        updater => {
          streamingThinking = updater(streamingThinking)
        },
      )

    handle({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      },
    } as any)
    handle({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'first locate the entry, ' },
      },
    } as any)
    handle({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'then inspect progress events.' },
      },
    } as any)

    expect(mode).toBe('thinking')
    expect(responseLength).toBe('first locate the entry, then inspect progress events.'.length)
    expect(streamingThinking).toMatchObject({
      thinking: 'first locate the entry, then inspect progress events.',
      isStreaming: true,
    })

    handle({
      type: 'stream_event',
      event: { type: 'message_stop' },
    } as any)

    expect(streamingThinking?.isStreaming).toBe(false)
    expect(typeof streamingThinking?.streamingEndedAt).toBe('number')
  })

  test('text deltas keep partial lines available to the UI', () => {
    let streamingText: string | null = null

    handleMessageFromStream(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: 'long first sentence without newline',
          },
        },
      } as any,
      () => {},
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      updater => {
        streamingText = updater(streamingText)
      },
    )

    expect(streamingText).toBe('long first sentence without newline')
    expect(getVisibleStreamingTextForUi(streamingText, true)).toBe(
      'long first sentence without newline',
    )
    expect(getVisibleStreamingTextForUi(streamingText, false)).toBe(null)
  })

  test('tool-result-ended turns request one hidden UI auto-continue', () => {
    const toolResultMessage = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_search',
          content: 'Searched for 2 patterns, listed 2 directories',
        },
      ],
    })

    expect(
      getToolResultAutoContinueSource([
        createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'toolu_search',
              name: 'Glob',
              input: { pattern: '*.ts' },
            } as any,
          ],
        }),
        toolResultMessage,
        createSystemMessage('Baked for 32s', 'info'),
      ])?.uuid,
    ).toBe(toolResultMessage.uuid)
  })

  test('skill meta content after a tool result still requests UI auto-continue', () => {
    const toolResultMessage = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_skill',
          content: 'Launching skill: verify',
        },
      ],
    })
    const skillMetaMessage = {
      ...createUserMessage({
        content: 'Base directory for this skill: /tmp/dsxu/verify',
        isMeta: true,
      }),
      sourceToolUseID: 'toolu_skill',
    }

    expect(
      getToolResultAutoContinueSource([
        createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'toolu_skill',
              name: 'Skill',
              input: { skill: 'verify' },
            } as any,
          ],
        }),
        toolResultMessage,
        skillMetaMessage,
        createSystemMessage('Cooked for 38s', 'info'),
      ])?.uuid,
    ).toBe(skillMetaMessage.uuid)
  })

  test('assistant final text after tool results suppresses UI auto-continue', () => {
    const toolResultMessage = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_search',
          content: 'done',
        },
      ],
    })

    expect(
      getToolResultAutoContinueSource([
        toolResultMessage,
        createAssistantMessage({ content: 'Done.' }),
      ]),
    ).toBeNull()
  })

  test('permission fallback summary exposes the pending shell command', () => {
    const summary = getToolPermissionFallbackSummary({
      tool: BashTool,
      input: {
        command: 'ls -la /mnt/d/xurui/',
        description: 'List xurui directory',
      },
      description: 'List xurui directory',
    } as any)

    expect(summary).toContain('Bash')
    expect(summary).toContain('ls -la /mnt/d/xurui/')
  })

  test('TUI health monitor detects hidden permission and invisible loading states', () => {
    const hiddenPermission = buildDsxuTuiHealthSnapshot({
      isLoading: true,
      showSpinner: false,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 1,
      permissionFallbackVisible: false,
      streamingTextLength: 0,
      inProgressToolUseCount: 0,
      commandQueueLength: 0,
      mainPromptCommandQueued: false,
      suppressingDialogs: false,
    })

    expect(hiddenPermission.status).toBe('stalled')
    expect(hiddenPermission.issues.map(issue => issue.kind)).toContain('permission_prompt_hidden')

    const invisibleLoading = buildDsxuTuiHealthSnapshot({
      isLoading: true,
      showSpinner: false,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
      streamingTextLength: 0,
      inProgressToolUseCount: 0,
      commandQueueLength: 0,
      mainPromptCommandQueued: false,
      suppressingDialogs: false,
    })

    expect(invisibleLoading.status).toBe('stalled')
    expect(invisibleLoading.issues.map(issue => issue.kind)).toContain('loading_without_visible_progress')
  })

  test('TUI health monitor exposes distinct visible lifecycle states', () => {
    const modelThinking = buildDsxuTuiHealthSnapshot({
      isLoading: true,
      showSpinner: true,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
      streamingTextLength: 0,
      inProgressToolUseCount: 0,
      commandQueueLength: 0,
      mainPromptCommandQueued: false,
      suppressingDialogs: false,
    })
    expect(modelThinking.status).toBe('busy')
    expect(modelThinking.visibleState).toBe('model_thinking')

    const toolRunning = buildDsxuTuiHealthSnapshot({
      isLoading: true,
      showSpinner: true,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
      streamingTextLength: 0,
      inProgressToolUseCount: 1,
      commandQueueLength: 0,
      mainPromptCommandQueued: false,
      suppressingDialogs: false,
    })
    expect(toolRunning.status).toBe('busy')
    expect(toolRunning.visibleState).toBe('tool_running')

    const backgroundTaskRunning = buildDsxuTuiHealthSnapshot({
      isLoading: false,
      showSpinner: false,
      focusedInputDialog: undefined,
      toolUseConfirmQueueLength: 0,
      permissionFallbackVisible: false,
      streamingTextLength: 0,
      inProgressToolUseCount: 0,
      backgroundTasks: [
        {
          id: 'task-visible-1',
          type: 'bash',
          status: 'running',
          outputFile: 'D:/DSXU-code/.dsxu/task-output/task-visible-1.txt',
        },
      ],
      commandQueueLength: 0,
      mainPromptCommandQueued: false,
      suppressingDialogs: false,
    })
    expect(backgroundTaskRunning.status).toBe('idle')
    expect(backgroundTaskRunning.visibleState).toBe('background_task_running')
    expect(backgroundTaskRunning.backgroundTaskCount).toBe(1)
    expect(backgroundTaskRunning.backgroundTasks[0]?.id).toBe('task-visible-1')
    expect(backgroundTaskRunning.summary).toContain('background_tasks=1')
  })

  test('auth blocked footer text is explicit instead of looking like passive waiting', () => {
    expect(getAuthBlockedNotificationText(false)).toBe(
      'Auth required - submit any prompt or run /login to configure DeepSeek key',
    )
    expect(getAuthBlockedNotificationText(true)).toBe(
      'Authentication blocked - Try again or run /login',
    )
  })

  test('user-visible auth and API error copy is mojibake-free', () => {
    const copy = [
      CCR_AUTH_ERROR_MESSAGE,
      INVALID_API_KEY_ERROR_MESSAGE,
      INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL,
      TOKEN_REVOKED_ERROR_MESSAGE,
      'Please run /login - API Error: invalid token',
    ]

    for (const text of copy) {
      expect(looksLikeMojibake(text)).toBe(false)
    }
    expect(startsWithApiErrorPrefix('Please run /login - API Error: invalid token')).toBe(true)
  })

  test('mojibake detector catches UTF-8 text decoded through the wrong codepage', () => {
    const mojibake = '\u93cc\u30e9\u7359\u7487\u4f79\u69f8\u935a\ufe42\u20ac\u6c33\u7e43'
    expect(looksLikeMojibake(mojibake)).toBe(true)
    expect(
      findMojibakeIssuesInText(
        'sample.ts',
        `const label = "${mojibake}"`,
      ),
    ).toHaveLength(1)
  })

  test('mojibake detector catches Latin-1 decoded UTF-8 without flagging normal accents', () => {
    const mojibake =
      'Step 1 \u00e2\u20ac\u201d write memory; \u00e6\u00b5\u2039\u00e8\u00af\u2022'
    const cjkMojibake = 'H-4R: session / memory \u6d93\u5a5a\u647c\u5a34\u5b2d\u762f'

    expect(looksLikeMojibake(mojibake)).toBe(true)
    expect(looksLikeMojibake(cjkMojibake)).toBe(true)
    expect(
      findMojibakeIssuesInText('sample.ts', `const label = "${mojibake}"`),
    ).toHaveLength(1)
    expect(
      findMojibakeIssuesInText('sample.ts', `const label = "${cjkMojibake}"`),
    ).toHaveLength(1)
    expect(looksLikeMojibake('Preferences: Preferences Systeme')).toBe(false)
    expect(looksLikeMojibake('Preferences: Prefer\u00e9nces Syst\u00e8me')).toBe(false)
  })

  test('mojibake detector catches user-visible terminal replacement glyphs', () => {
    const replacementGlyph = 'Not logged in \uFFFD\uFFFD Run /login'
    const pluginTick = '\u9241?Installed plugin'
    const loadingEllipsis = 'Loading\u9225?'
    const boxDrawing = '\u9239\u20ac waiting'

    expect(looksLikeMojibake(replacementGlyph)).toBe(true)
    expect(looksLikeMojibake(pluginTick)).toBe(true)
    expect(looksLikeMojibake(loadingEllipsis)).toBe(true)
    expect(looksLikeMojibake(boxDrawing)).toBe(true)
    expect(
      findMojibakeIssuesInText(
        'sample.tsx',
        [replacementGlyph, pluginTick, loadingEllipsis, boxDrawing].join('\n'),
      ),
    ).toHaveLength(4)
  })
})
