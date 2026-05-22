import { describe, expect, test } from 'bun:test'
import {
  buildDsxuAgentFinalGateNudge,
  buildDsxuBackgroundTaskFinalGateNudge,
  buildDsxuExecutionVisibilityNudge,
  buildDsxuIntentOnlyFinalNudge,
  buildDsxuMaxTurnsFinalSynthesisNudge,
  buildDsxuMaxTurnsFinalSynthesisToolBlockNudge,
  buildDsxuPostPassToolBlockHardStopFinal,
  buildDsxuToolBudgetGateNudge,
  buildDsxuToolBudgetStatusNudge,
  buildDsxuUnverifiedMutationFinalGateNudge,
  buildDsxuVerificationPassNudge,
  clearDsxuReadCacheForBlockedExecutionVisibility,
  getDsxuDiscoveryStreakSinceProgress,
  getDsxuFailedVerificationStreakSinceEdit,
  getLatestDsxuToolStateForTrace,
  getDsxuUnverifiedEditStreak,
  hasDsxuUnverifiedMutationSinceVerification,
} from '../../../query'
import { TaskOutputTool } from '../../../tools/TaskOutputTool/TaskOutputTool'
import { createFileStateCacheWithSizeLimit } from '../../../utils/fileStateCache'
import { expandPath } from '../../../utils/path'

const malformedAssistant = {
  type: 'assistant',
  uuid: 'assistant-without-message',
} as any

const malformedUser = {
  type: 'user',
  uuid: 'user-without-message',
} as any

describe('query message shape guard V1', () => {
  test('final gates ignore malformed assistant messages instead of crashing', () => {
    expect(() => buildDsxuIntentOnlyFinalNudge([malformedAssistant])).not.toThrow()
    expect(buildDsxuIntentOnlyFinalNudge([malformedAssistant])).toBeNull()

    expect(() =>
      buildDsxuBackgroundTaskFinalGateNudge([malformedAssistant], {
        task1: {
          id: 'task1',
          type: 'local_agent',
          status: 'running',
          description: 'still running',
        },
      }),
    ).not.toThrow()
    expect(
      buildDsxuBackgroundTaskFinalGateNudge([malformedAssistant], {
        task1: {
          id: 'task1',
          type: 'local_agent',
          status: 'running',
          description: 'still running',
        },
      }),
    ).toBeNull()
  })

  test('agent parent final gate tolerates non-provider messages around TaskOutput evidence', () => {
    const taskOutput = TaskOutputTool.mapToolResultToToolResultBlockParam({
      retrieval_status: 'success',
      task: {
        task_id: 'agent-shape-guard',
        task_type: 'local_agent',
        status: 'completed',
        description: 'worker evidence',
        output: 'PASS',
        prompt: 'verify',
        result: 'PASS',
        evidencePacket: {
          files_read: ['src/query.ts'],
          files_changed: [],
          commands_run: ['bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"'],
          tests_passed: ['bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"'],
          tests_failed: [],
          unresolved_risks: [],
          completion_claim: 'complete',
        },
      },
    } as any, 'task-output-shape-guard')

    const evidenceMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [taskOutput],
      },
      uuid: 'task-output-evidence',
    } as any
    const uncitedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'uncited-final',
        content: [{ type: 'text', text: 'Done. Tests pass.' }],
      },
      uuid: 'uncited-final',
    } as any

    expect(() =>
      buildDsxuAgentFinalGateNudge(
        [malformedUser, { type: 'system', uuid: 'system-event' } as any, evidenceMessage],
        [malformedAssistant, uncitedFinal],
      ),
    ).not.toThrow()
    expect(
      buildDsxuAgentFinalGateNudge(
        [malformedUser, { type: 'system', uuid: 'system-event' } as any, evidenceMessage],
        [malformedAssistant, uncitedFinal],
      ),
    ).toContain('DSXU parent-final evidence gate')
  })

  test('cursor streak helpers tolerate malformed messages', () => {
    const messages = [
      malformedUser,
      { type: 'attachment', attachment: { type: 'max_turns_reached' } },
      malformedAssistant,
    ] as any[]

    expect(() => getDsxuFailedVerificationStreakSinceEdit(messages)).not.toThrow()
    expect(() => getDsxuDiscoveryStreakSinceProgress(messages)).not.toThrow()
    expect(() => getDsxuUnverifiedEditStreak(messages)).not.toThrow()
    expect(getDsxuFailedVerificationStreakSinceEdit(messages)).toBe(0)
    expect(getDsxuDiscoveryStreakSinceProgress(messages)).toBe(0)
    expect(getDsxuUnverifiedEditStreak(messages)).toBe(0)
  })

  test('lifecycle trace can read latest tool state without content TDZ', () => {
    const messages = [
      malformedUser,
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-pass',
              content:
                'bun test\n4 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer.',
            },
          ],
        },
        uuid: 'verification-result',
      },
    ] as any[]

    expect(() => getLatestDsxuToolStateForTrace(messages)).not.toThrow()
    expect(getLatestDsxuToolStateForTrace(messages)).toBe('verification_passed')
  })

  test('execution visibility gate still blocks broad silent batches with malformed history', () => {
    const toolUses = Array.from({ length: 4 }, (_, index) => ({
      type: 'tool_use',
      id: `tool-${index}`,
      name: index % 2 === 0 ? 'Read' : 'PowerShell',
      input: {},
    })) as any

    const nudge = buildDsxuExecutionVisibilityNudge(toolUses, [
      malformedAssistant,
    ])
    expect(nudge).toContain('DSXU execution-visibility gate')
  })

  test('execution visibility gate clears speculative Read cache for blocked reads', () => {
    const cache = createFileStateCacheWithSizeLimit(10)
    const filePath = '.\\fixtures\\blocked-read.ts'
    const normalizedPath = expandPath(filePath)
    cache.set(normalizedPath, {
      content: 'stale speculative content',
      timestamp: 1,
      offset: undefined,
      limit: undefined,
    })

    const clearedPaths = clearDsxuReadCacheForBlockedExecutionVisibility(
      [
        {
          type: 'tool_use',
          id: 'read-1',
          name: 'Read',
          input: { file_path: filePath },
        },
        {
          type: 'tool_use',
          id: 'bash-1',
          name: 'Bash',
          input: { command: 'echo ok' },
        },
        {
          type: 'tool_use',
          id: 'read-malformed',
          name: 'Read',
          input: {},
        },
      ] as any,
      cache,
    )

    expect(clearedPaths).toEqual([normalizedPath])
    expect(cache.has(normalizedPath)).toBe(false)
  })

  test('tool budget gate is inactive by default and blocks env-scoped lane overrun', () => {
    const priorToolUse = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'grep-1', name: 'Grep', input: { pattern: 'a' } },
        ],
      },
      uuid: 'prior-tool-use',
    } as any
    const currentToolUses = [
      { type: 'tool_use', id: 'grep-2', name: 'Grep', input: { pattern: 'b' } },
      { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: 'src/x.ts' } },
      { type: 'tool_use', id: 'bash-1', name: 'Bash', input: { command: 'ls' } },
    ] as any
    const oldToolBudget = process.env.DSXU_LANE_MAX_TOOL_CALLS
    const oldReadBudget = process.env.DSXU_LANE_MAX_READ_CALLS
    const oldShellBudget = process.env.DSXU_LANE_MAX_SHELL_CALLS
    try {
      delete process.env.DSXU_LANE_MAX_TOOL_CALLS
      delete process.env.DSXU_LANE_MAX_READ_CALLS
      delete process.env.DSXU_LANE_MAX_SHELL_CALLS
      expect(buildDsxuToolBudgetGateNudge(currentToolUses, [priorToolUse])).toBeNull()

      process.env.DSXU_LANE_MAX_TOOL_CALLS = '2'
      process.env.DSXU_LANE_MAX_READ_CALLS = '0'
      process.env.DSXU_LANE_MAX_SHELL_CALLS = '0'
      const nudge = buildDsxuToolBudgetGateNudge(currentToolUses, [priorToolUse])
      expect(nudge).toContain('DSXU tool-budget gate')
      expect(nudge).toContain('tool_calls=4/2')
      expect(nudge).toContain('read_calls=1/0')
      expect(nudge).toContain('shell_calls=1/0')
    } finally {
      if (oldToolBudget === undefined) delete process.env.DSXU_LANE_MAX_TOOL_CALLS
      else process.env.DSXU_LANE_MAX_TOOL_CALLS = oldToolBudget
      if (oldReadBudget === undefined) delete process.env.DSXU_LANE_MAX_READ_CALLS
      else process.env.DSXU_LANE_MAX_READ_CALLS = oldReadBudget
      if (oldShellBudget === undefined) delete process.env.DSXU_LANE_MAX_SHELL_CALLS
      else process.env.DSXU_LANE_MAX_SHELL_CALLS = oldShellBudget
    }
  })

  test('tool budget status nudge exposes remaining budget before the next model sample', () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'grep-1', name: 'Grep', input: { pattern: 'orphan' } },
            { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: 'src/query.ts' } },
          ],
        },
        uuid: 'prior-tool-use',
      },
    ] as any[]
    const oldToolBudget = process.env.DSXU_LANE_MAX_TOOL_CALLS
    const oldReadBudget = process.env.DSXU_LANE_MAX_READ_CALLS
    const oldShellBudget = process.env.DSXU_LANE_MAX_SHELL_CALLS
    try {
      delete process.env.DSXU_LANE_MAX_TOOL_CALLS
      delete process.env.DSXU_LANE_MAX_READ_CALLS
      delete process.env.DSXU_LANE_MAX_SHELL_CALLS
      expect(buildDsxuToolBudgetStatusNudge(messages)).toBeNull()

      process.env.DSXU_LANE_MAX_TOOL_CALLS = '5'
      process.env.DSXU_LANE_MAX_READ_CALLS = '4'
      process.env.DSXU_LANE_MAX_SHELL_CALLS = '0'
      const status = buildDsxuToolBudgetStatusNudge(messages)
      expect(status).toContain('DSXU tool-budget status')
      expect(status).toContain('used_tool_calls=2/5')
      expect(status).toContain('remaining_tool_calls=3')
      expect(status).toContain('used_read_calls=1/4')
      expect(status).toContain('remaining_read_calls=3')
      expect(status).toContain('remaining_shell_calls=0')
      expect(status).toContain('no Bash/PowerShell calls are available')
      expect(status).not.toContain('Do not emit more tool_use blocks for exhausted budgets')
    } finally {
      if (oldToolBudget === undefined) delete process.env.DSXU_LANE_MAX_TOOL_CALLS
      else process.env.DSXU_LANE_MAX_TOOL_CALLS = oldToolBudget
      if (oldReadBudget === undefined) delete process.env.DSXU_LANE_MAX_READ_CALLS
      else process.env.DSXU_LANE_MAX_READ_CALLS = oldReadBudget
      if (oldShellBudget === undefined) delete process.env.DSXU_LANE_MAX_SHELL_CALLS
      else process.env.DSXU_LANE_MAX_SHELL_CALLS = oldShellBudget
    }
  })

  test('post-edit final gate blocks final answers before fresh verification', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content:
              'DSXU tool state: edit_applied; next=run_smallest_verification',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const staleFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'stale-final',
        content: [{ type: 'text', text: 'FAIL: tests still failed.' }],
      },
      uuid: 'stale-final',
    } as any

    expect(hasDsxuUnverifiedMutationSinceVerification([editResult])).toBe(true)
    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult],
        [staleFinal],
        true,
      ),
    ).toContain('DSXU post-edit verification final gate')
  })

  test('post-edit final gate clears after verification evidence', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const verificationResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'verify-1',
            content:
              'bun test src/cart.test.ts\n1 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer',
          },
        ],
      },
      uuid: 'verification-result',
    } as any
    const finalAnswer = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'verified-final',
        content: [{ type: 'text', text: 'PASS' }],
      },
      uuid: 'verified-final',
    } as any

    expect(
      hasDsxuUnverifiedMutationSinceVerification([
        editResult,
        verificationResult,
      ]),
    ).toBe(false)
    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult, verificationResult],
        [finalAnswer],
        true,
      ),
    ).toBeNull()
  })

  test('post-edit final gate permits explicit partial when no verifier exists', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const partialFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'partial-final',
        content: [
          {
            type: 'text',
            text: 'PARTIAL: no verification tool is available after the edit.',
          },
        ],
      },
      uuid: 'partial-final',
    } as any

    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult],
        [partialFinal],
        false,
      ),
    ).toBeNull()
  })

  test('max-turn final synthesis gate gives one final response after verified evidence', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const verificationResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'verify-1',
            content:
              'bun test src/cart.test.ts\n4 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer',
          },
        ],
      },
      uuid: 'verification-result',
    } as any

    const nudge = buildDsxuMaxTurnsFinalSynthesisNudge(
      [editResult, verificationResult],
      {
        maxTurns: 10,
        turnCount: 11,
      },
    )

    expect(nudge).toContain('DSXU max-turn finalization gate')
    expect(nudge).toContain('do not call tools')
    expect(nudge).toContain('strict benchmark JSON')
  })

  test('max-turn final synthesis gate treats CollectEvidence PASS as verified evidence', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const evidencePass = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'collect-1',
            content: [
              'CollectEvidence status: PASS',
              'latest=native_test exit=0 signal=RunNativeTest status: pass',
              'DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=final_answer.',
            ].join('\n'),
          },
        ],
      },
      uuid: 'evidence-pass',
    } as any

    const nudge = buildDsxuMaxTurnsFinalSynthesisNudge(
      [editResult, evidencePass],
      {
        maxTurns: 10,
        turnCount: 11,
      },
    )

    expect(nudge).toContain('DSXU max-turn finalization gate')
    expect(nudge).toContain('do not call tools')
  })

  test('max-turn final synthesis gate treats CollectEvidence PARTIAL as incomplete evidence', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const evidencePartial = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'collect-1',
            content: [
              'CollectEvidence status: PARTIAL',
              'latest=native_test exit=1 signal=RunNativeTest status: fail',
              'DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=repair_or_report_partial.',
            ].join('\n'),
          },
        ],
      },
      uuid: 'evidence-partial',
    } as any

    const nudge = buildDsxuMaxTurnsFinalSynthesisNudge([editResult, evidencePartial], {
        maxTurns: 10,
        turnCount: 11,
      })
    expect(nudge).toContain('do not call tools')
    expect(nudge).toContain('PASS/DONE is forbidden')
    expect(nudge).toContain('PARTIAL/FAIL/BLOCKED')
  })

  test('max-turn final synthesis gate reserves final turn for incomplete evidence without allowing PASS', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const failedVerificationResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'verify-1',
            content:
              'bun test src/cart.test.ts\n1 pass\n2 fail\nDSXU tool state: verification_failed',
          },
        ],
      },
      uuid: 'failed-verification-result',
    } as any

    const unverifiedNudge = buildDsxuMaxTurnsFinalSynthesisNudge([editResult], {
        maxTurns: 10,
        turnCount: 11,
      })
    expect(unverifiedNudge).toContain('do not call tools')
    expect(unverifiedNudge).toContain('PASS/DONE is forbidden')
    expect(unverifiedNudge).toContain('PARTIAL/FAIL/BLOCKED')

    const failedNudge = buildDsxuMaxTurnsFinalSynthesisNudge(
      [editResult, failedVerificationResult],
      {
        maxTurns: 10,
        turnCount: 11,
      },
    )
    expect(failedNudge).toContain('do not call tools')
    expect(failedNudge).toContain('PASS/DONE is forbidden')
  })

  test('max-turn final synthesis tool block prevents extra tools after finalization reservation', () => {
    const finalizationGate = {
      type: 'user',
      message: {
        role: 'user',
        content:
          'DSXU max-turn finalization gate:\n- required_next: do not call tools.',
      },
      uuid: 'finalization-gate',
    } as any

    const nudge = buildDsxuMaxTurnsFinalSynthesisToolBlockNudge(
      [
        {
          type: 'tool_use',
          id: 'read-after-finalization',
          name: 'Read',
          input: { file_path: 'src/query.ts' },
        },
      ] as any,
      [finalizationGate],
    )

    expect(nudge).toContain('blocked_tool_after_finalization_gate')
    expect(nudge).toContain('Read')
    expect(nudge).toContain('do not re-issue tools')
  })

  test('verification pass nudge preserves strict JSON final contracts over marker-only output', () => {
    const strictJsonTask = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Finish with DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS only after tests pass.',
              'Final response must be one strict compact JSON object with double quotes only.',
              'Required JSON keys:',
              '{"caseId":string,"status":"PASS|PARTIAL|FAIL|BLOCKED","evidence":[string],"toolsUsed":[string],"risks":[string],"nextAction":string}',
            ].join('\n'),
          },
        ],
      },
      uuid: 'strict-json-task',
    } as any

    const nudge = buildDsxuVerificationPassNudge([strictJsonTask])

    expect(nudge).toContain('strict compact JSON')
    expect(nudge).toContain('do not output the marker alone')
    expect(nudge).toContain('status "PASS"')
    expect(nudge).not.toContain('must be exactly DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS and nothing else')
  })

  test('verification pass nudge detects strict JSON contracts on direct CLI message content', () => {
    const directCliTask = {
      type: 'user',
      content: [
        {
          type: 'text',
          text: [
            'Finish with DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS only after tests pass.',
            'Final response must be one strict compact JSON object with double quotes only.',
          ].join('\n'),
        },
      ],
      uuid: 'direct-cli-strict-json-task',
    } as any

    const nudge = buildDsxuVerificationPassNudge([directCliTask])

    expect(nudge).toContain('strict compact JSON')
    expect(nudge).toContain('do not output the marker alone')
    expect(nudge).toContain('status "PASS"')
    expect(nudge).not.toContain('must be exactly DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS and nothing else')
  })

  test('post-pass hard stop returns strict JSON when a strict JSON lane contract is active', () => {
    const strictJsonTask = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'DSXU public-comparable DSXU lane case: product-real-mcp-task-live',
              'Final response must be one strict compact JSON object with double quotes only.',
              'Required JSON keys:',
              '{"caseId":string,"status":"PASS|PARTIAL|FAIL|BLOCKED","evidence":[string],"toolsUsed":[string],"risks":[string],"nextAction":string}',
            ].join('\n'),
          },
        ],
      },
      uuid: 'strict-json-task',
    } as any
    const toolUse = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'verify-1',
            name: 'RunNativeTest',
            input: { command: 'bun test src/dsxu/engine/__tests__/real-mcp-server.test.ts' },
          },
        ],
      },
      uuid: 'tool-use',
    } as any
    const blockedAfterPass = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'read-after-pass',
            content: [
              'DSXU stop-on-pass gate blocked this Read call because the current task is already verification_passed.',
              'DSXU tool state: tool_blocked_after_pass; blocked=post_pass_tool_call; next=final_answer.',
            ].join('\n'),
          },
        ],
      },
      uuid: 'blocked-after-pass',
    } as any

    const final = buildDsxuPostPassToolBlockHardStopFinal([
      strictJsonTask,
      toolUse,
      blockedAfterPass,
    ])

    expect(final).not.toBeNull()
    const parsed = JSON.parse(final!)
    expect(parsed).toMatchObject({
      caseId: 'product-real-mcp-task-live',
      status: 'PASS',
      nextAction: 'final_answer',
    })
    expect(parsed.evidence).toContain('DSXU tool state verification_passed was already observed')
    expect(parsed.toolsUsed).toContain('RunNativeTest')
  })

  test('verification pass alone returns strict JSON before the model can overthink finalization', () => {
    const strictJsonTask = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'DSXU public-comparable DSXU lane case: v8-real-review-fix',
              'Final response must be one strict compact JSON object with double quotes only.',
              'Required JSON keys:',
              '{"caseId":string,"status":"PASS|PARTIAL|FAIL|BLOCKED","evidence":[string],"toolsUsed":[string],"risks":[string],"nextAction":string}',
            ].join('\n'),
          },
        ],
      },
      uuid: 'strict-json-task',
    } as any
    const powerShellUse = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'verify-1',
            name: 'PowerShell',
            input: { command: 'bun test test\\html.test.js' },
          },
        ],
      },
      uuid: 'tool-use',
    } as any
    const verificationPassed = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'verify-1',
            content: [
              'bun test v1.3.11',
              '1 pass',
              '0 fail',
              'DSXU tool state: verification_passed; blocked=rerun_same_command,more_tools_after_pass; next=final_answer.',
            ].join('\n'),
          },
        ],
      },
      uuid: 'verification-passed',
    } as any

    const final = buildDsxuPostPassToolBlockHardStopFinal([
      strictJsonTask,
      powerShellUse,
      verificationPassed,
    ])

    expect(final).not.toBeNull()
    const parsed = JSON.parse(final!)
    expect(parsed).toMatchObject({
      caseId: 'v8-real-review-fix',
      status: 'PASS',
      nextAction: 'final_answer',
    })
    expect(parsed.evidence).toContain('runtime finalization synthesized strict JSON after passing verification')
    expect(parsed.risks).toContain('runtime finalization prevented post-pass overthinking')
    expect(parsed.toolsUsed).toContain('PowerShell')
    expect(parsed.evidence).toContain('executed evidence path: test/html.test.js')
  })
})
