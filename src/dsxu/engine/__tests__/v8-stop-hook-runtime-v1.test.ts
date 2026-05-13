import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext, type ToolUseContext } from '../../../Tool'
import { getDefaultAppState } from '../../../state/AppStateStore'
import { createAssistantMessage } from '../../../utils/messages'
import { executeStopHooks } from '../../../utils/hooks'
import { addFunctionHook } from '../../../utils/hooks/sessionHooks'
import {
  clearPostSamplingHooks,
  executePostSamplingHooks,
  registerPostSamplingHook,
} from '../../../utils/hooks/postSamplingHooks'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('DSXU V8 stop hook product runtime', () => {
  test('session function stop hook can block unverified final PASS before continuation ends', async () => {
    let appState = {
      ...getDefaultAppState(),
      toolPermissionContext: getEmptyToolPermissionContext(),
    }
    const setAppState = (updater: (prev: typeof appState) => typeof appState) => {
      appState = updater(appState)
    }
    const sessionId = 'v8-stop-hook-agent'
    let hookRan = false

    addFunctionHook(
      setAppState,
      sessionId,
      'SubagentStop',
      '',
      async messages => {
        hookRan = true
        const text = JSON.stringify(messages)
        return text.includes('VERIFICATION: PASS') && !text.includes('UNVERIFIED_PASS')
      },
      'DSXU verifier hook blocked final PASS because verification evidence is missing.',
      { id: 'v8-verifier-before-final' },
    )

    const context = {
      agentId: sessionId,
      agentType: 'verification',
      abortController: new AbortController(),
      getAppState: () => appState,
      setAppState,
    } as unknown as ToolUseContext

    const messages = [
      createAssistantMessage({
        content: [
          {
            type: 'text',
            text: 'UNVERIFIED_PASS: final answer tried to claim PASS without test output.',
          },
        ],
      }),
    ]

    const results = []
    for await (const result of executeStopHooks(
      'default',
      context.abortController.signal,
      1000,
      false,
      sessionId,
      context,
      messages,
      'verification',
    )) {
      results.push(result)
    }

    expect(hookRan).toBe(true)
    expect(results.some(result => result.blockingError?.blockingError.includes('verification evidence is missing'))).toBe(true)
  })

  test('same stop hook allows final PASS when verification evidence is present', async () => {
    let appState = {
      ...getDefaultAppState(),
      toolPermissionContext: getEmptyToolPermissionContext(),
    }
    const setAppState = (updater: (prev: typeof appState) => typeof appState) => {
      appState = updater(appState)
    }
    const sessionId = 'v8-stop-hook-agent-pass'
    let hookRan = false

    addFunctionHook(
      setAppState,
      sessionId,
      'SubagentStop',
      '',
      async messages => {
        hookRan = true
        return JSON.stringify(messages).includes('VERIFICATION: PASS')
      },
      'DSXU verifier hook blocked final PASS because verification evidence is missing.',
      { id: 'v8-verifier-before-final-pass' },
    )

    const context = {
      agentId: sessionId,
      agentType: 'verification',
      abortController: new AbortController(),
      getAppState: () => appState,
      setAppState,
    } as unknown as ToolUseContext

    const messages = [
      createAssistantMessage({
        content: [
          {
            type: 'text',
            text: 'VERIFICATION: PASS\nbun test -> 2 pass, 0 fail.',
          },
        ],
      }),
    ]

    const results = []
    for await (const result of executeStopHooks(
      'default',
      context.abortController.signal,
      1000,
      false,
      sessionId,
      context,
      messages,
      'verification',
    )) {
      results.push(result)
    }

    expect(hookRan).toBe(true)
    expect(results.some(result => result.blockingError)).toBe(false)
  })

  test('post-sampling hook failure is non-blocking and cannot spin the main loop', async () => {
    clearPostSamplingHooks()
    let calls = 0
    registerPostSamplingHook(() => {
      calls += 1
      throw new Error('V8 fixture hook failed after sampling')
    })

    const context = {
      agentId: 'v8-post-sampling-hook',
      agentType: 'main',
      abortController: new AbortController(),
      getAppState: () => ({
        ...getDefaultAppState(),
        toolPermissionContext: getEmptyToolPermissionContext(),
      }),
    } as unknown as ToolUseContext

    await expect(executePostSamplingHooks(
      [createAssistantMessage({ content: 'final text without tool calls' })],
      [] as any,
      {},
      {},
      context,
      'repl_main_thread',
    )).resolves.toBeUndefined()

    expect(calls).toBe(1)
    clearPostSamplingHooks()
  })

  test('MagicDocs product hook is idle-only and Edit-only scoped', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/services/MagicDocs/magicDocs.ts'),
      'utf8',
    )

    expect(source).toContain("querySource !== 'repl_main_thread'")
    expect(source).toContain('hasToolCallsInLastAssistantTurn(messages)')
    expect(source).toContain("tools: [FILE_EDIT_TOOL_NAME]")
    expect(source).toContain('filePath === docInfo.path')
    expect(source).toContain('only ${FILE_EDIT_TOOL_NAME} is allowed')
  })
})
