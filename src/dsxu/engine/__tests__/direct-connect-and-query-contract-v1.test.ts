import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { z } from 'zod/v4'
import { FallbackTriggeredError } from '../../../services/api/withRetry'
import {
  createDirectConnectSession,
  DirectConnectError,
  readDSXUDirectSessionResponse,
} from '../dsxu-direct-connect-session'
import {
  buildDsxuAgentFinalGateNudge,
  buildDsxuToolRuntimeTrustProof,
  buildDsxuRecoveryGateState,
  buildDsxuRecoveryState,
  buildDsxuQueryLoopStateTraceSnapshot,
  buildDsxuPostPassToolBlockHardStopFinal,
  buildDsxuToolStateCursorNudge,
  getDsxuQueryBlockAuditContract,
  getDsxuQueryRecoveryAndPromptCacheContract,
  looksLikeDsxuVerifiedPassingTest,
  query,
} from '../../../query'
import { buildTool, getDsxuToolRuntimeContractSummary, getEmptyToolPermissionContext, type Tool } from '../../../Tool'
import {
  assembleToolPool,
  DSXU_DEFAULT_MAINLINE_TOOLS,
  getDsxuToolRegistryRuntimeProfile,
  getTools,
} from '../../../tools'
import {
  clearSystemPromptSections,
  DANGEROUS_uncachedSystemPromptSection,
  processSystemPromptSectionsLifecycle,
  systemPromptSection,
} from '../../../constants/systemPromptSections'
import { FILE_UNCHANGED_STUB } from '../../../tools/FileReadTool/prompt'
import { getEditToolDescription } from '../../../tools/FileEditTool/prompt'
import { FileEditTool } from '../../../tools/FileEditTool/FileEditTool'
import { getWriteToolDescription } from '../../../tools/FileWriteTool/prompt'
import { FileWriteTool } from '../../../tools/FileWriteTool/FileWriteTool'
import { getDescription as getGrepDescription } from '../../../tools/GrepTool/prompt'
import { parseToolListFromCLI } from '../../../utils/permissions/permissionSetup'
import { getEnterPlanModeToolPrompt } from '../../../tools/EnterPlanModeTool/prompt'
import { EXIT_PLAN_MODE_V2_TOOL_PROMPT } from '../../../tools/ExitPlanModeTool/prompt'
import { BashTool } from '../../../tools/BashTool/BashTool'
import { createAssistantAPIErrorMessage, createAssistantMessage, createSystemMessage, createUserMessage, ensureToolResultPairing, normalizeMessagesForAPI } from '../../../utils/messages'
import { asSystemPrompt } from '../../../utils/systemPromptType'
import { getDefaultAppState } from '../../../state/AppStateStore'
import { addFunctionHook, clearSessionHooks } from '../../../utils/hooks/sessionHooks'
import { getSessionId } from '../../../bootstrap/state'
import {
  buildCompactRecoverySnapshot,
  renderCompactRecoverySnapshot,
} from '../compact'
import {
  buildQueryConfig,
  isStreamingToolExecutionEnabled,
} from '../../../query/config'
import { runWithCwdOverride } from '../../../utils/cwd'

async function drainQueryForTest(params: Parameters<typeof query>[0]) {
  const events: unknown[] = []
  const iterator = query(params)
  while (true) {
    const next = await iterator.next()
    if (next.done) {
      return { events, terminal: next.value }
    }
    events.push(next.value)
  }
}

function createQueryHarness(overrides: Partial<Parameters<typeof query>[0]> = {}): Parameters<typeof query>[0] {
  const appState = {
    toolPermissionContext: getEmptyToolPermissionContext(),
    fastMode: false,
    mcp: { tools: [], clients: [] },
    effortValue: undefined,
    advisorModel: undefined,
  }

  return {
    messages: [createUserMessage({ content: 'DSXU query recovery harness' })],
    systemPrompt: asSystemPrompt(['DSXU query recovery harness system prompt']),
    userContext: {},
    systemContext: {},
    canUseTool: (async () => ({ behavior: 'allow', updatedInput: {} })) as never,
    toolUseContext: {
      options: {
        commands: [],
        debug: false,
        mainLoopModel: 'deepseek-v4-harness',
        tools: [],
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
      uuid: () => '00000000-0000-4000-8000-000000000001',
    },
    ...overrides,
  }
}

function createAbortDuringCallTool(): Tool {
  return {
    name: 'AbortDuringCall',
    inputSchema: z.object({}),
    maxResultSizeChars: 1024,
    isEnabled: () => true,
    isConcurrencySafe: () => false,
    isReadOnly: () => true,
    isDestructive: () => false,
    interruptBehavior: () => 'cancel',
    validateInput: async () => ({ result: true }),
    checkPermissions: async input => ({ behavior: 'allow', updatedInput: input }),
    description: async () => 'Abort during tool call fixture',
    prompt: async () => 'AbortDuringCall fixture tool.',
    userFacingName: () => 'AbortDuringCall',
    toAutoClassifierInput: () => '',
    call: async () => ({ data: { status: 'aborted-by-fixture' } }),
    mapToolResultToToolResultBlockParam: (content, toolUseID) => ({
      type: 'tool_result',
      content: JSON.stringify(content),
      tool_use_id: toolUseID,
    }),
    renderToolUseMessage: () => null,
    renderToolResultMessage: () => null,
    renderToolUseQueuedMessage: () => null,
  } as unknown as Tool
}

function createLifecycleReplayTool(name: string): Tool {
  const inputSchema = z
    .object({
      command: z.string().optional(),
      file_path: z.string().optional(),
      description: z.string().optional(),
      prompt: z.string().optional(),
      old_string: z.string().optional(),
      new_string: z.string().optional(),
    })
    .passthrough()

  return buildTool({
    name,
    inputSchema,
    maxResultSizeChars: 16_000,
    isEnabled: () => true,
    isConcurrencySafe: () => false,
    isReadOnly: input => name !== 'Edit' && !input.new_string,
    isDestructive: input => name === 'Edit' || Boolean(input.new_string),
    validateInput: async () => ({ result: true }),
    checkPermissions: async input => ({ behavior: 'allow', updatedInput: input }),
    description: async input =>
      input.description ?? `${name} lifecycle replay fixture`,
    prompt: async () => `${name} lifecycle replay fixture.`,
    userFacingName: () => name,
    getPath(input) {
      return input.file_path ?? ''
    },
    async call(input, _context, _canUseTool, _assistantMessage, onProgress) {
      onProgress?.({
        toolUseID: `progress-${name.toLowerCase()}-lifecycle`,
        data: {
          type: `${name.toLowerCase()}_progress`,
          output: `${name} lifecycle progress`,
        },
      } as never)
      return {
        data: {
          tool: name,
          text: `${name} lifecycle replay completed`,
          path: input.file_path ?? null,
          command: input.command ?? null,
        },
      }
    },
    mapToolResultToToolResultBlockParam(content, toolUseID) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseID,
        content: [
          {
            type: 'text',
            text: `${content.tool}: ${content.text}`,
          },
        ],
      }
    },
  })
}

describe('DSXU direct connect and query contract V1', () => {
  test('query loop state trace snapshot keeps permission tools background and final gate in one view', () => {
    const snapshot = buildDsxuQueryLoopStateTraceSnapshot({
      turnId: 'query-loop-turn-1',
      turnCount: 3,
      transition: { reason: 'next_turn' },
      lastEvent: 'final_gate_blocked',
      lastEventTime: '2026-05-09T00:00:00.000Z',
      pendingToolUseSummary: Promise.resolve(null),
      messages: [
        createUserMessage({ content: 'run background command' }),
        createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'toolu-open-background',
              name: 'Bash',
              input: { command: 'sleep 60 &' },
            },
          ],
        }),
      ],
      permissionMode: 'plan',
      tasks: {
        'task-background-1': {
          id: 'task-background-1',
          type: 'bash',
          status: 'running',
          description: 'background sleep',
          outputFile: 'D:/DSXU-code/.dsxu/task-output/task-background-1.txt',
          toolUseId: 'toolu-open-background',
        },
      },
      finalGateState: 'dsxu_background_task_final_gate',
    })

    expect(snapshot).toEqual({
      turnId: 'query-loop-turn-1',
      turnCount: 3,
      transitionReason: 'next_turn',
      lastEvent: 'final_gate_blocked',
      lastEventTime: '2026-05-09T00:00:00.000Z',
      pendingToolUseSummary: true,
      pendingToolUseIDs: ['toolu-open-background'],
      permissionState: {
        mode: 'plan',
        waiting: true,
      },
      backgroundTaskState: {
        activeCount: 1,
        activeTaskIDs: ['task-background-1'],
        activeTasks: [
          {
            id: 'task-background-1',
            type: 'bash',
            status: 'running',
            description: 'background sleep',
            outputFile: 'D:/DSXU-code/.dsxu/task-output/task-background-1.txt',
            toolUseId: 'toolu-open-background',
          },
        ],
      },
      finalGateState: 'dsxu_background_task_final_gate',
      gateState: {
        owner: 'query_loop',
        gateId: 'dsxu_background_task_final_gate',
        gateKind: 'final_response',
        gateClass: 'RECOVERY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'inspect_wait_or_report_background_task_status',
      },
    })
  })

  test('query-loop live trust proof stays compact and derives from the latest tool result', () => {
    const proof = buildDsxuToolRuntimeTrustProof([
      createAssistantMessage({
        content: [
          {
            type: 'tool_use',
            id: 'toolu-proof',
            name: 'Bash',
            input: { command: 'bun test src/example.test.ts' },
          },
        ],
      }),
      createUserMessage({
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-proof',
            content: 'schemaVersion=dsxu.runtime-event.v1\ncanonicalToolResult=true\noutputFile=tmp/run.log',
          },
        ],
      }),
    ])

    expect(proof?.tool?.status).toBe('ready')
    expect(proof?.tool?.readyConsumers).toBe(3)
    expect(proof?.tool?.requiredConsumers).toBe(3)
    expect(proof?.runtime?.status).toBe('ready')
    expect(proof?.runtime?.presentKinds).toBe(2)
    expect(proof?.runtime?.requiredKinds).toBe(2)
  })

  test('query-loop recovery cursor states classify agent and baseline gates in one view', () => {
    expect(
      buildDsxuRecoveryGateState({
        state: 'baseline_pass_pending_required_edit',
        requiredAction: 'read_source_truth',
        canClaimComplete: false,
        sourceTruthRequired: true,
        verificationRequired: true,
        reason: 'baseline verification passed but explicit source/test edits remain',
      }),
    ).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_baseline_pass_pending_required_edit',
      gateKind: 'recovery',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      completionBlocked: true,
      nextAction: 'read_source_truth',
    })

    expect(
      buildDsxuRecoveryGateState({
        state: 'agent_evidence_incomplete',
        requiredAction: 'agent_evidence_or_partial',
        canClaimComplete: false,
        sourceTruthRequired: false,
        verificationRequired: false,
        reason: 'Agent evidence is partial, unknown, failed, or risk-bearing',
      }),
    ).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_agent_evidence_incomplete',
      gateKind: 'recovery',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      completionBlocked: true,
      nextAction: 'agent_evidence_or_partial',
    })

    expect(
      buildDsxuRecoveryGateState({
        state: 'verified_passed_ready_final',
        requiredAction: 'final_answer',
        canClaimComplete: true,
        sourceTruthRequired: false,
        verificationRequired: false,
        reason: 'latest verification passed',
      }),
    ).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_verified_passed_ready_final',
      gateKind: 'recovery',
      gateClass: 'CAPABILITY_NUDGE',
      blocked: false,
      completionBlocked: false,
      nextAction: 'final_answer',
    })
  })

  test('query-loop final gate classifies agent evidence as completion-blocking quality gate', () => {
    const snapshot = buildDsxuQueryLoopStateTraceSnapshot({
      turnId: 'query-loop-agent-final-gate',
      turnCount: 4,
      transition: { reason: 'dsxu_agent_final_gate' },
      lastEvent: 'final_gate_blocked',
      lastEventTime: '2026-05-09T00:01:00.000Z',
      pendingToolUseSummary: null,
      messages: [],
      permissionMode: 'default',
      tasks: {},
      finalGateState: 'dsxu_agent_final_gate',
    })

    expect(snapshot.gateState).toEqual({
      owner: 'query_loop',
      gateId: 'dsxu_agent_final_gate',
      gateKind: 'final_response',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: true,
      nextAction: 'cite_complete_worker_evidence_or_mark_partial',
    })
  })

  test('query-loop classifies post-compact edit preflight as source-truth reread gate', () => {
    const renderedSnapshot = renderCompactRecoverySnapshot(
      buildCompactRecoverySnapshot({
        primaryRequest: 'Resume V19 after compact without losing source truth',
        userInstructions: ['Re-read source before edit or PASS'],
        changedFiles: ['D:/DSXU-code/src/query.ts'],
        pendingTasks: ['continue Phase 2 query-loop convergence'],
        pendingAgents: [],
        failedCommands: ['none'],
        permissionDenials: ['none'],
        recoveryDecisions: ['compact summary is only recovery memory'],
        verificationStatus: 'partial',
        nextActions: ['read src/query.ts before editing'],
      }),
    )
    const compactSummary = createUserMessage({
      content: renderedSnapshot,
      isCompactSummary: true,
    })
    const editPreflight = createUserMessage({
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu-edit-post-compact',
          content: [
            'DSXU tool state: edit_preflight_required',
            'blocked=source_truth_missing',
            'next=read_source_truth_before_edit',
          ].join('\n'),
          is_error: true,
        },
      ],
      toolUseResult: 'DSXU tool state: edit_preflight_required',
    })
    const editTool = {
      type: 'tool_use',
      id: 'toolu-edit-post-compact',
      name: 'Edit',
      input: {
        file_path: 'D:/DSXU-code/src/query.ts',
        old_string: 'old source from compact memory',
        new_string: 'new source',
      },
    } as any

    const recoveryState = buildDsxuRecoveryState({
      toolResults: [editPreflight],
      toolUseBlocks: [editTool],
      conversationMessages: [compactSummary],
    })

    expect(recoveryState).toMatchObject({
      state: 'post_compact_source_truth_required',
      requiredAction: 'read_source_truth',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: true,
    })
    expect(buildDsxuRecoveryGateState(recoveryState)).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_post_compact_source_truth_required',
      gateKind: 'recovery',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      nextAction: 'read_source_truth',
    })

    const nudge = buildDsxuToolStateCursorNudge(
      [editPreflight],
      [editTool],
      [compactSummary],
    )
    expect(nudge).toContain('post_compact_source_truth_required')
    expect(nudge).toContain('Re-read the exact source file')
    expect(nudge).toContain('fresh verification before any PASS')
  })

  test('query loop injects tail tool-result recovery cursor before provider continuation', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-tail-tool-result-gate-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    let providerCalls = 0
    const compactResult = [
      'DSXU_TUI_RESUME_REPLAY_META',
      '<dsxu_compact_recovery_snapshot>',
      'schemaVersion: dsxu.compact-recovery.v1',
      '## Task-State Snapshot',
      '- goal: Resume cart total bugfix after compact.',
      '- failedCommands: bun test src/cart.test.ts',
      '- verificationStatus: failed',
      'nextAction: read source truth before edit',
      '</dsxu_compact_recovery_snapshot>',
      'DSXU tool state: edit_preflight_required',
      'blocked=post_compact_source_truth_missing',
      'next=read_source_truth_before_edit',
      '## ExperienceStore Planning Pack (read-only)',
      '- sourceRefreshFiles: src/cart.ts, src/cart.test.ts',
      '- failurePatterns: clamp over-discounted cart totals instead of repeating the same failed command.',
      '- verificationCommands: bun test src/cart.test.ts',
      '- guardrails: read current source truth before Edit; do not claim PASS from memory.',
    ].join('\n')
    const editTool = {
      type: 'tool_use',
      id: 'toolu-tail-post-compact-edit',
      name: 'Edit',
      input: {
        file_path: 'src/cart.ts',
        old_string: 'compact-memory-only total clamp',
        new_string: 'fresh source total clamp',
      },
    } as any

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const params = createQueryHarness({
        messages: [
          createUserMessage({ content: 'continue compact recovery' }),
          createAssistantMessage({ content: [editTool] }),
          createUserMessage({
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: 'toolu-tail-post-compact-edit',
                content: compactResult,
                is_error: true,
              },
            ],
          }),
        ],
        deps: {
          ...createQueryHarness().deps!,
          callModel: (async function* ({ messages }) {
            providerCalls += 1
            const serializedMessages = JSON.stringify(messages)
            expect(serializedMessages).toContain('post_compact_source_truth_required')
            expect(serializedMessages).toContain('read_source_truth')
            expect(serializedMessages).toContain('Re-read the exact source file')
            expect(serializedMessages).toContain('DSXU_TUI_RESUME_REPLAY_META')
            expect(serializedMessages).toContain('sourceRefreshFiles')
            expect(serializedMessages).toContain('verificationCommands')
            yield createAssistantMessage({
              content: 'PARTIAL: source truth reread is required before edit.',
            }) as never
          }) as never,
          microcompact: (async messages => ({ messages })) as never,
        },
      })

      const { terminal } = await drainQueryForTest(params)
      expect(providerCalls).toBe(1)
      expect(terminal.reason).toBe('completed')

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"recovery_gate_advisory"')
      expect(trace).toContain('"gateId":"dsxu_recovery_post_compact_source_truth_required"')
      expect(trace).toContain('"owner":"query_loop"')
      expect(trace).toContain('"gateClass":"QUALITY_BLOCK"')
      expect(trace).toContain('"nextAction":"read_source_truth"')
      expect(trace).toContain('"event":"provider_resume_replay_preflight"')
      expect(trace).toContain('"boundary":"provider_request_preflight"')
      expect(trace).toContain('"schemaVersion":"dsxu.compact-recovery.v1"')
      expect(trace).toContain('"sourceTruthRefreshRequired":true')
      expect(trace).toContain('"failedCommandPreserved":true')
      expect(trace).toContain('"verificationStatePreserved":true')
      expect(trace).toContain('"nextActionPreserved":true')
      expect(trace).toContain('"experienceStorePackPreserved":true')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query-loop maps incomplete Agent evidence to SendMessage continuation recovery', () => {
    const agentToolResult = createUserMessage({
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'agent-partial-evidence-1',
          content: [
            '<evidence>',
            'completion_claim: partial',
            'files_read: src/query.ts',
            'files_changed: none',
            'commands_run: bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t "drives local Agent lifecycle"',
            'tests_passed: none',
            'tests_failed: bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t "drives local Agent lifecycle"',
            'unresolved_risks: worker still needs the failed command rechecked',
            '</evidence>',
          ].join('\n'),
        },
      ],
    })
    const agentTool = {
      type: 'tool_use',
      id: 'agent-partial-evidence-1',
      name: 'Agent',
      input: {
        description: 'Verify SendMessage continuation',
        prompt: 'Run the verifier and report evidence.',
      },
    } as any

    const recoveryState = buildDsxuRecoveryState({
      toolResults: [agentToolResult],
      toolUseBlocks: [agentTool],
    })

    expect(recoveryState).toMatchObject({
      state: 'agent_evidence_incomplete',
      requiredAction: 'agent_evidence_or_partial',
      canClaimComplete: false,
    })
    expect(buildDsxuRecoveryGateState(recoveryState)).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_agent_evidence_incomplete',
      gateKind: 'recovery',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      nextAction: 'agent_evidence_or_partial',
    })

    const nudge = buildDsxuToolStateCursorNudge(
      [agentToolResult],
      [agentTool],
    )
    expect(nudge).toContain('agent_evidence_incomplete')
    expect(nudge).toContain('Continue that same worker once with SendMessage')
    expect(nudge).toContain('failed command output')
    expect(nudge).toContain('report PARTIAL')
  })

  test('query-loop classifies permission-denied tool results as recovery advisory gate', () => {
    const deniedToolResult = createUserMessage({
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu-permission-denied',
          content:
            'Permission for this action has been denied. Reason: command writes outside the allowed project scope.',
          is_error: true,
        },
      ],
      toolUseResult:
        'Error: Permission for this action has been denied. Reason: command writes outside the allowed project scope.',
    })
    const deniedTool = {
      type: 'tool_use',
      id: 'toolu-permission-denied',
      name: 'PowerShell',
      input: { command: 'Set-Content -Path D:\\outside.txt -Value nope' },
    } as any

    const recoveryState = buildDsxuRecoveryState({
      toolResults: [deniedToolResult],
      toolUseBlocks: [deniedTool],
    })

    expect(recoveryState).toMatchObject({
      state: 'permission_denied_replan',
      requiredAction: 'permission_safe_replan',
      canClaimComplete: false,
    })
    expect(buildDsxuRecoveryGateState(recoveryState)).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_permission_denied_replan',
      gateKind: 'recovery',
      gateClass: 'RECOVERY_BLOCK',
      blocked: false,
      nextAction: 'permission_safe_replan',
    })
    const nudge = buildDsxuToolStateCursorNudge(
      [deniedToolResult],
      [deniedTool],
    )
    expect(nudge).toContain('permission_denied')
    expect(nudge).toContain('Do not wait silently')
    expect(nudge).toContain('BLOCKED/PARTIAL')
  })

  test('query-loop classifies unavailable tool results as recovery advisory gate', () => {
    const unavailableToolResult = createUserMessage({
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu-unavailable',
          content:
            '<tool_use_error>Error: No such tool available: Glob. Available tools in this turn: Read, Edit. Do not call unavailable tools or shell-discovery bypasses.</tool_use_error>',
          is_error: true,
        },
      ],
      toolUseResult:
        'Error: No such tool available: Glob. Available tools in this turn: Read, Edit.',
    })
    const unavailableTool = {
      type: 'tool_use',
      id: 'toolu-unavailable',
      name: 'Glob',
      input: { pattern: '**/*.ts' },
    } as any

    const recoveryState = buildDsxuRecoveryState({
      toolResults: [unavailableToolResult],
      toolUseBlocks: [unavailableTool],
    })

    expect(recoveryState).toMatchObject({
      state: 'tool_unavailable_replan',
      requiredAction: 'available_tool_replan',
      canClaimComplete: false,
    })
    expect(buildDsxuRecoveryGateState(recoveryState)).toMatchObject({
      owner: 'query_loop',
      gateId: 'dsxu_recovery_tool_unavailable_replan',
      gateKind: 'recovery',
      gateClass: 'RECOVERY_BLOCK',
      blocked: false,
      nextAction: 'available_tool_replan',
    })
    const nudge = buildDsxuToolStateCursorNudge(
      [unavailableToolResult],
      [unavailableTool],
    )
    expect(nudge).toContain('tool_unavailable')
    expect(nudge).toContain('Do not keep searching')
    expect(nudge).toContain('PARTIAL/BLOCKED')
  })

  test('query loop emits lifecycle state snapshots during a live query turn', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-state-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const base = createQueryHarness()
      const params = createQueryHarness({
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            yield createAssistantMessage({
              content: 'query loop state trace done',
            }) as never
          }) as never,
        },
      })

      const { terminal } = await drainQueryForTest(params)
      expect(terminal.reason).toBe('completed')

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"event":"query_loop_state_snapshot"')
      expect(trace).toContain('"turnCount":1')
      expect(trace).toContain('"lastEvent":"iteration_start"')
      expect(trace).toContain('"lastEventTime"')
      expect(trace).toContain('"pendingToolUseSummary":false')
      expect(trace).toContain('"pendingToolUseIDs":[]')
      expect(trace).toContain('"permissionState"')
      expect(trace).toContain('"backgroundTaskState"')
      expect(trace).toContain('"activeTasks":[]')
      expect(trace).toContain('"finalGateState":null')
      expect(trace).toContain('"gateState":null')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop records final gate state snapshots without changing gate behavior', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-final-gate-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    let providerCalls = 0

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const base = createQueryHarness()
      const params = createQueryHarness({
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            providerCalls += 1
            yield createAssistantMessage({
              content:
                providerCalls === 1
                  ? 'I will inspect src/query.ts now.'
                  : 'PARTIAL: intent-only final gate replay completed.',
            }) as never
          }) as never,
        },
      })

      const { terminal } = await drainQueryForTest(params)
      expect(terminal.reason).toBe('completed')
      expect(providerCalls).toBe(2)

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"event":"query_loop_state_snapshot"')
      expect(trace).toContain('"lastEvent":"final_gate_blocked"')
      expect(trace).toContain('"finalGateState":"dsxu_intent_only_final_gate"')
      expect(trace).toContain('"gateState"')
      expect(trace).toContain('"owner":"query_loop"')
      expect(trace).toContain('"gateId":"dsxu_intent_only_final_gate"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"nextAction":"perform_promised_action_or_report_no_action_taken"')
      expect(trace).toContain('"transitionReason":"dsxu_intent_only_final_gate"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop records execution visibility gate state before retrying broad silent tools', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-exec-gate-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    let providerCalls = 0

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const base = createQueryHarness()
      const params = createQueryHarness({
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            providerCalls += 1
            yield createAssistantMessage({
              content:
                providerCalls === 1
                  ? [
                      {
                        type: 'tool_use',
                        id: 'toolu-bash-1',
                        name: 'Bash',
                        input: { command: 'printf one' },
                      },
                      {
                        type: 'tool_use',
                        id: 'toolu-bash-2',
                        name: 'Bash',
                        input: { command: 'printf two' },
                      },
                      {
                        type: 'tool_use',
                        id: 'toolu-bash-3',
                        name: 'Bash',
                        input: { command: 'printf three' },
                      },
                      {
                        type: 'tool_use',
                        id: 'toolu-bash-4',
                        name: 'Bash',
                        input: { command: 'printf four' },
                      },
                    ]
                  : 'PARTIAL: execution visibility gate replay completed.',
            }) as never
          }) as never,
        },
      })

      const { terminal } = await drainQueryForTest(params)
      expect(terminal.reason).toBe('completed')
      expect(providerCalls).toBe(2)

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"tool_scheduling_gate_blocked"')
      expect(trace).toContain('"gateId":"dsxu_execution_visibility_gate"')
      expect(trace).toContain('"gateKind":"tool_scheduling"')
      expect(trace).toContain('"gateClass":"QUALITY_BLOCK"')
      expect(trace).toContain('"nextAction":"write_visible_parallel_tool_intent_brief"')
      expect(trace).toContain('"transitionReason":"dsxu_execution_visibility_gate"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('DeepSeek direct runtime enables streaming tool execution without remote gate dependency', () => {
    const previousProvider = process.env.DSXU_MODEL_PROVIDER
    const previousGateway = process.env.DSXU_MODEL_GATEWAY
    const previousEnable = process.env.DSXU_CODE_STREAMING_TOOL_EXECUTION
    const previousDisable = process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION

    try {
      process.env.DSXU_MODEL_PROVIDER = 'deepseek'
      process.env.DSXU_MODEL_GATEWAY = 'direct'
      delete process.env.DSXU_CODE_STREAMING_TOOL_EXECUTION
      delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION

      expect(isStreamingToolExecutionEnabled()).toBe(true)
      expect(buildQueryConfig().gates.streamingToolExecution).toBe(true)

      process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION = '1'
      expect(isStreamingToolExecutionEnabled()).toBe(false)
    } finally {
      if (previousProvider === undefined) delete process.env.DSXU_MODEL_PROVIDER
      else process.env.DSXU_MODEL_PROVIDER = previousProvider
      if (previousGateway === undefined) delete process.env.DSXU_MODEL_GATEWAY
      else process.env.DSXU_MODEL_GATEWAY = previousGateway
      if (previousEnable === undefined) {
        delete process.env.DSXU_CODE_STREAMING_TOOL_EXECUTION
      } else {
        process.env.DSXU_CODE_STREAMING_TOOL_EXECUTION = previousEnable
      }
      if (previousDisable === undefined) {
        delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
      } else {
        process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION =
          previousDisable
      }
    }
  })

  test('accepts DSXU and legacy direct-connect response field shapes', () => {
    const snake = readDSXUDirectSessionResponse({
      session_id: 'session-snake',
      ws_url: 'ws://127.0.0.1/sessions/session-snake',
      work_dir: 'D:/DSXU-code',
    }, 'http://127.0.0.1:19999', 'token-1')

    expect(snake.config.sessionId).toBe('session-snake')
    expect(snake.config.wsUrl).toBe('ws://127.0.0.1/sessions/session-snake')
    expect(snake.workDir).toBe('D:/DSXU-code')

    const camel = readDSXUDirectSessionResponse({
      sessionId: 'session-camel',
      workDir: 'D:/DSXU-code/camel',
    }, 'https://dsxu.local/', 'token-2')

    expect(camel.config.sessionId).toBe('session-camel')
    expect(camel.config.wsUrl).toBe('wss://dsxu.local/sessions/session-camel')
    expect(camel.workDir).toBe('D:/DSXU-code/camel')
  })

  test('rejects malformed direct-connect responses with DSXU-owned errors', () => {
    expect(() => readDSXUDirectSessionResponse({
      ws_url: 'ws://127.0.0.1/no-session',
    }, 'http://127.0.0.1:19999')).toThrow(DirectConnectError)

    expect(() => readDSXUDirectSessionResponse({
      session_id: 42,
      ws_url: 'ws://127.0.0.1/bad',
    }, 'http://127.0.0.1:19999')).toThrow('Invalid DSXU direct session response')
  })

  test('prefers DSXU endpoint and falls back to legacy session endpoint without leaking tokens', async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; body: string; authorization?: string }> = []
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: String(init?.body ?? ''),
        authorization: (init?.headers as Record<string, string> | undefined)?.authorization,
      })
      if (String(url).endsWith('/dsxu/sessions')) {
        return new Response('nope', { status: 404, statusText: 'Not Found' })
      }
      return Response.json({
        session_id: 'session-fallback',
        ws_url: 'ws://127.0.0.1/sessions/session-fallback',
        work_dir: 'D:/DSXU-code',
      })
    }) as typeof fetch

    try {
      const result = await createDirectConnectSession({
        serverUrl: 'http://127.0.0.1:19999/',
        authToken: 'secret-token',
        cwd: 'D:/DSXU-code',
      })

      expect(result.config.sessionId).toBe('session-fallback')
      expect(calls.map(call => call.url)).toEqual([
        'http://127.0.0.1:19999/dsxu/sessions',
        'http://127.0.0.1:19999/sessions',
      ])
      expect(calls[0].authorization).toBe('Bearer secret-token')
      expect(calls[0].body).toContain('"controlPlane":"dsxu"')
      expect(calls[0].body).not.toContain('dangerously_skip_permissions')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('documents query recovery loop and prompt-cache strategy as DSXU mainline contract', () => {
    const contract = getDsxuQueryRecoveryAndPromptCacheContract()

    expect(contract.recoveryOrder).toContain('microcompact before autocompact')
    expect(contract.recoveryOrder.join('\n')).toContain('context-collapse drain before reactive compact')
    expect(contract.cacheStabilityRules.join('\n')).toContain('SYSTEM_PROMPT_DYNAMIC_BOUNDARY')
    expect(contract.cacheStabilityRules.join('\n')).toContain('cached microcompact boundary')
    expect(contract.weakModelGuards.join('\n')).toContain('missing tool_result blocks')
    expect(contract.weakModelGuards.join('\n')).toContain('local Agent SendMessage continuations')
  })

  test('query-loop parent final gate blocks Agent completion claims without concrete evidence citation', () => {
    const conversation = [
      createUserMessage({
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: 'agent-complete-1',
            content: [
              '<evidence>',
              'completion_claim: complete',
              'files_read: src/checkout/service.ts',
              'files_changed: src/checkout/service.ts',
              'commands_run: bun test tests/checkout/regression.test.ts',
              'tests_passed: bun test tests/checkout/regression.test.ts',
              'tests_failed: none',
              'unresolved_risks: none',
              '</evidence>',
            ].join('\n'),
          },
        ],
      }),
    ]

    const gluedDoneGate = buildDsxuAgentFinalGateNudge(conversation, [
      createAssistantMessage({
        content:
          'Done.\nDSXU_BENCH_V18_AGENT_PARENT_FINAL_GATE_PASS\nWorker ran bun test tests/checkout/regression.test.ts.',
      }),
    ])
    expect(gluedDoneGate).toContain('does not cite concrete worker evidence')

    const citedFinalGate = buildDsxuAgentFinalGateNudge(conversation, [
      createAssistantMessage({
        content:
          'DSXU_BENCH_V18_AGENT_PARENT_FINAL_GATE_PASS\nWorker changed src/checkout/service.ts and passed bun test tests/checkout/regression.test.ts.',
      }),
    ])
    expect(citedFinalGate).toBeNull()
  })

  test('query-loop parent final gate blocks complete claims on partial Agent evidence', () => {
    const conversation = [
      createUserMessage({
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: 'agent-partial-1',
            content: [
              '<evidence>',
              'completion_claim: partial',
              'files_read: src/cart.ts',
              'files_changed: none',
              'commands_run: bun test tests/cart.test.ts',
              'tests_passed: none',
              'tests_failed: bun test tests/cart.test.ts',
              'unresolved_risks: checkout regression still failing',
              '</evidence>',
            ].join('\n'),
          },
        ],
      }),
    ]

    const fakeDoneGate = buildDsxuAgentFinalGateNudge(conversation, [
      createAssistantMessage({
        content: 'Done. PASS',
      }),
    ])
    expect(fakeDoneGate).toContain('latest Agent evidence is partial')

    const partialFinalGate = buildDsxuAgentFinalGateNudge(conversation, [
      createAssistantMessage({
        content:
          'PARTIAL: worker evidence shows bun test tests/cart.test.ts is still failing with checkout regression still failing.',
      }),
    ])
    expect(partialFinalGate).toBeNull()
  })

  test('query-loop hard stops after a post-PASS tool block instead of recursing into another model turn', () => {
    const marker = 'DSXU_BENCH_MUTATION_AGENT_SENDMESSAGE_CORRECTION_PASS'
    const final = buildDsxuPostPassToolBlockHardStopFinal([
      createUserMessage({
        content: `Run the task and output ${marker} only after verification passes.`,
      }),
      createAssistantMessage({
        content: `${marker}`,
      }),
      createUserMessage({
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: 'blocked-post-pass-1',
            content:
              'DSXU stop-on-pass marker gate blocked this PowerShell call because the assistant already emitted a terminal PASS marker.\nDSXU tool state: tool_blocked_after_pass_marker; blocked=post_pass_marker_tool_call; next=final_answer.',
            is_error: true,
          },
        ],
      }),
    ])

    expect(final).toBe(marker)
  })

  test('maps mature query recovery blocks to DSXU contracts and evidence', () => {
    const contract = getDsxuQueryBlockAuditContract()
    const byBlock = new Map(contract.blocks.map(block => [block.block, block]))

    expect(contract.runtime).toBe('DSXU Query Block Audit Contract')
    expect(contract.target).toBe('D:/DSXU-code/src/query.ts')
    expect(contract.blocks.map(block => block.block)).toEqual([
      'tool-result pairing',
      'fallback retry',
      'max-output recovery',
      'prompt-too-long / compact recovery',
      'stop hooks loop guard',
      'Agent continuation',
      'tool-use summary',
      'prompt cache mutation points',
      'maxTurns / PARTIAL signaling',
      'failed assistant cleanup',
    ])

    for (const block of contract.blocks) {
      expect(block.referenceBehavior.length).toBeGreaterThan(30)
      expect(block.dsxuCurrent.length).toBeGreaterThan(30)
      expect(block.gap.length).toBeGreaterThan(20)
      expect(block.testEvidence.length).toBeGreaterThan(20)
      expect(['absorbed', 'dsxu-extension', 'needs-live-evidence']).toContain(block.disposition)
    }

    expect(byBlock.get('Agent continuation')?.disposition).toBe('dsxu-extension')
    expect(byBlock.get('max-output recovery')?.dsxuCurrent).toContain('DSXU_CODE_MAX_OUTPUT_TOKENS')
    expect(byBlock.get('prompt-too-long / compact recovery')?.disposition).toBe('absorbed')
    expect(byBlock.get('prompt-too-long / compact recovery')?.testEvidence).toContain(
      'dsxu.compact-recovery.v1',
    )
    expect(byBlock.get('tool-use summary')?.dsxuCurrent).toContain('credential redaction')
    expect(byBlock.get('fallback retry')?.disposition).toBe('absorbed')
    expect(byBlock.get('prompt cache mutation points')?.testEvidence).toContain(
      'prompt-cache-layout live benchmark PASS',
    )
  })

  test('detects verified passing test output for DSXU stop nudges', () => {
    expect(looksLikeDsxuVerifiedPassingTest([
      'bun test v1.3.11',
      'test/index.test.js:',
      '(pass) feature works',
      '',
      ' 1 pass',
      ' 0 fail',
      'Ran 1 test across 1 file.',
    ].join('\n'))).toBe(true)

    expect(looksLikeDsxuVerifiedPassingTest([
      'Exit code 1',
      'bun test v1.3.11',
      ' 1 pass',
      ' 1 fail',
      'AssertionError: expected true',
    ].join('\n'))).toBe(false)
  })

  test('query loop live harness proves fallback retry pairs orphan tool_use and retries cleanly', async () => {
    let calls = 0
    const params = createQueryHarness({
      deps: {
        ...createQueryHarness().deps!,
        callModel: (async function* () {
          calls += 1
          if (calls === 1) {
            yield createAssistantMessage({
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu-fallback-orphan',
                  name: 'Read',
                  input: { file_path: 'D:/DSXU-code/package.json' },
                },
              ],
            }) as never
            throw new FallbackTriggeredError(
              'deepseek-v4-harness',
              'deepseek-v4-fallback-harness',
            )
          }

          yield createAssistantMessage({
            content: 'Fallback retry recovered without replaying the failed assistant tool_use.',
          }) as never
        }) as never,
      },
    })

    const { events, terminal } = await drainQueryForTest(params)
    const eventText = JSON.stringify(events)

    expect(calls).toBe(2)
    expect(terminal.reason).toBe('completed')
    expect(eventText).toContain('toolu-fallback-orphan')
    expect(eventText).toContain('Model fallback triggered')
    expect(eventText).toContain('Switched to')
    expect(eventText).toContain('Fallback retry recovered')
  })

  test('query loop live harness proves max-output recovery injects bounded resume before final answer', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-max-output-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    let calls = 0

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const params = createQueryHarness({
        deps: {
          ...createQueryHarness().deps!,
          callModel: (async function* ({ messages }) {
            calls += 1
            if (calls === 1) {
              yield createAssistantAPIErrorMessage({
                content: 'The model response exceeded the output token maximum.',
                apiError: 'max_output_tokens',
                error: 'max_output_tokens',
              }) as never
              return
            }

            const serializedMessages = JSON.stringify(messages)
            expect(serializedMessages).toContain('Output token limit hit. Resume directly')
            yield createAssistantMessage({
              content: 'Recovered from max_output_tokens and finished smaller.',
            }) as never
          }) as never,
        },
      })

      const { events, terminal } = await drainQueryForTest(params)
      const eventText = JSON.stringify(events)

      expect(calls).toBe(2)
      expect(terminal.reason).toBe('completed')
      expect(eventText).not.toContain('The model response exceeded the output token maximum')
      expect(eventText).toContain('Recovered from max_output_tokens')

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"recovery_gate_blocked"')
      expect(trace).toContain('"gateId":"max_output_tokens_recovery"')
      expect(trace).toContain('"gateKind":"recovery"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"nextAction":"inject_bounded_resume_message"')
      expect(trace).toContain('"transitionReason":"max_output_tokens_recovery"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop records stop-hook blocking feedback as a recovery gate state', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-stop-hook-gate-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    const sessionId = getSessionId()
    let appState = {
      ...getDefaultAppState(),
      toolPermissionContext: getEmptyToolPermissionContext(),
    }
    const setAppState = (updater: (prev: typeof appState) => typeof appState) => {
      appState = updater(appState)
    }
    let hookRuns = 0
    let providerCalls = 0

    addFunctionHook(
      setAppState,
      sessionId,
      'Stop',
      '',
      async messages => {
        hookRuns += 1
        return JSON.stringify(messages).includes('VERIFIED: stop hook feedback applied')
      },
      'DSXU stop hook requires verification evidence before final completion.',
      { id: 'direct-connect-stop-hook-gate' },
    )

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const base = createQueryHarness()
      const params = createQueryHarness({
        toolUseContext: {
          ...base.toolUseContext,
          getAppState: () => appState as never,
          setAppState: setAppState as never,
          sessionId,
        } as never,
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            providerCalls += 1
            yield createAssistantMessage({
              content:
                providerCalls === 1
                  ? 'Done. PASS without verification evidence.'
                  : 'VERIFIED: stop hook feedback applied. Final answer now cites verification evidence.',
            }) as never
          }) as never,
        },
      })

      const { events, terminal } = await drainQueryForTest(params)
      const eventText = JSON.stringify(events)

      expect(providerCalls).toBe(2)
      expect(hookRuns).toBeGreaterThanOrEqual(2)
      expect(terminal.reason).toBe('completed')
      expect(eventText).toContain('Stop hook feedback')
      expect(eventText).toContain('verification evidence')
      expect(eventText).toContain('VERIFIED: stop hook feedback applied')

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"recovery_gate_blocked"')
      expect(trace).toContain('"gateId":"dsxu_stop_hook_blocking_gate"')
      expect(trace).toContain('"gateKind":"recovery"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"blocked":true')
      expect(trace).toContain('"nextAction":"apply_stop_hook_feedback_without_resetting_recovery_guards"')
      expect(trace).toContain('"transitionReason":"stop_hook_blocking"')
    } finally {
      clearSessionHooks(setAppState as never, sessionId)
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop records explicit model-stream abort as a recovery gate state', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-stream-abort-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    const abortController = new AbortController()
    let providerCalls = 0

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const base = createQueryHarness()
      const params = createQueryHarness({
        toolUseContext: {
          ...base.toolUseContext,
          abortController,
        } as never,
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            providerCalls += 1
            abortController.abort('user_cancel')
            yield createAssistantMessage({
              content: 'Model stream stopped after explicit user cancel.',
            }) as never
          }) as never,
        },
      })

      const { terminal } = await drainQueryForTest(params)

      expect(providerCalls).toBe(1)
      expect(terminal.reason).toBe('aborted_streaming')
      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"abort_gate_blocked"')
      expect(trace).toContain('"gateId":"dsxu_abort_streaming_gate"')
      expect(trace).toContain('"gateKind":"recovery"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"blocked":true')
      expect(trace).toContain('"nextAction":"surface_cancelled_state_and_stop_current_turn"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop records explicit tool-call abort as a recovery gate state', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const previousStreamingDisable =
      process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-tool-abort-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    const abortController = new AbortController()
    let providerCalls = 0
    let inProgressToolUseIDs = new Set<string>()

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot
      process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION = '1'

      const base = createQueryHarness()
      const params = createQueryHarness({
        toolUseContext: {
          ...base.toolUseContext,
          abortController,
          setInProgressToolUseIDs: updater => {
            const hadAbortTool = inProgressToolUseIDs.has('toolu-abort-call-1')
            inProgressToolUseIDs = updater(inProgressToolUseIDs)
            if (
              hadAbortTool &&
              !inProgressToolUseIDs.has('toolu-abort-call-1') &&
              !abortController.signal.aborted
            ) {
              abortController.abort('user_cancel')
            }
          },
          options: {
            ...base.toolUseContext.options,
            tools: [createAbortDuringCallTool()],
          },
        } as never,
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            providerCalls += 1
            if (providerCalls > 1) {
              yield createAssistantMessage({
                content: 'ERROR: tool abort did not stop the current turn.',
              }) as never
              return
            }
            yield createAssistantMessage({
              content: [{
                type: 'tool_use',
                id: 'toolu-abort-call-1',
                name: 'AbortDuringCall',
                input: {},
              } as any],
            }) as never
          }) as never,
        },
      })

      const { events, terminal } = await drainQueryForTest(params)
      const eventText = JSON.stringify(events)

      expect(providerCalls).toBe(1)
      expect(terminal.reason).toBe('aborted_tools')
      expect(eventText).toContain('[Request interrupted by user for tool use]')
      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"abort_gate_blocked"')
      expect(trace).toContain('"gateId":"dsxu_abort_tools_gate"')
      expect(trace).toContain('"gateKind":"recovery"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"blocked":true')
      expect(trace).toContain('"nextAction":"surface_cancelled_tool_state_and_stop_current_turn"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      if (previousStreamingDisable === undefined) {
        delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
      } else {
        process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION =
          previousStreamingDisable
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop passes complex first-turn website planning route input into the adapter boundary', async () => {
    const base = createQueryHarness()
    const previousTraceFile = process.env.DSXU_ROUTE_TRACE_FILE
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-prefix-trace-'))
    const tracePath = join(tmpRoot, 'route.jsonl')
    let captured: {
      model?: string
      routeInput?: { workflowKind?: string; role?: string }
      thinkingConfig?: { type?: string; budgetTokens?: number }
      systemPromptText?: string
    } = {}

    try {
      process.env.DSXU_ROUTE_TRACE_FILE = tracePath
      const params = createQueryHarness({
        messages: [
          createUserMessage({
            content: [
              '\u5728 D \u76d8\u65b0\u5efa\u4e00\u4e2a xu-rui \u6587\u4ef6\u5939\uff0c\u505a\u4e00\u4e2a\u5b8c\u6574\u97f3\u4e50\u673a\u6784\u5c55\u793a\u7f51\u7ad9\uff0c\u524d\u7aef\u5c55\u793a\u7684\u3002',
              '1.\u673a\u6784\u4ecb\u7ecd\u3001\u54c1\u724c\u6545\u4e8b\u3001\u73af\u5883\u56fe\u7247 / \u89c6\u9891',
              '2.\u8bfe\u7a0b\u5206\u7c7b\u5c55\u793a',
              '3.\u5b66\u5458\u6210\u679c\u5c55\u793a',
              '4.\u53ef\u4ee5\u54a8\u8be2\u7136\u540e\u81ea\u52a8\u56de\u590d\u8054\u7cfb\u65b9\u5f0f',
              '5.\u73b0\u5728\u95e8\u5e97\u4fe1\u606f',
              '6.\u6d3b\u52a8\u5ba3\u4f20\u3001\u6d3b\u52a8\u62a5\u540d',
              '7.\u6d88\u606f\u63d0\u9192',
            ].join('\n'),
          }),
        ],
        toolUseContext: {
          ...base.toolUseContext,
          options: {
            ...base.toolUseContext.options,
            mainLoopModel: 'deepseek-v4-flash',
          },
        } as never,
        deps: {
          ...base.deps!,
          callModel: (async function* ({ options, thinkingConfig, systemPrompt }) {
            captured = {
              model: options.model,
              routeInput: options.dsxuRouteInput,
              thinkingConfig,
              systemPromptText: JSON.stringify(systemPrompt),
            }
            yield createAssistantMessage({
              content: 'Route evidence captured.',
            }) as never
          }) as never,
        },
      })

      const { events, terminal } = await drainQueryForTest(params)
      const eventText = JSON.stringify(events)
      const traceLines = readFileSync(tracePath, 'utf8').trim().split(/\r?\n/)
      const promptPrefixEvidence = traceLines
        .map(line => JSON.parse(line))
        .find(line => line.event === 'prompt_prefix_cache_evidence')

      expect(terminal.reason).toBe('completed')
      expect(captured.model).toBe('deepseek-v4-flash')
      expect(captured.routeInput?.workflowKind).toBe('planning')
      expect(captured.routeInput?.role).toBe('planner')
      expect(captured.thinkingConfig?.type).toBe('enabled')
      expect(captured.systemPromptText).toContain('DSXU model evidence: deepseek-v4-flash')
      expect(captured.systemPromptText).toContain('reason=planning_flash_thinking_max')
      expect(promptPrefixEvidence.workflowKind).toBe('planning')
      expect(promptPrefixEvidence.routeReason).toBe('planning_flash_thinking_max')
      expect(promptPrefixEvidence.model).toBe('deepseek-v4-flash')
      expect(promptPrefixEvidence.cacheMissBudgetTokens).toBe(2_000)
      expect(typeof promptPrefixEvidence.stablePrefixHash).toBe('string')
      expect(typeof promptPrefixEvidence.dynamicTailHash).toBe('string')
      expect(JSON.stringify(promptPrefixEvidence)).not.toContain('\u5728 D \u76d8\u65b0\u5efa')
      expect(eventText).toContain('DSXU final usage evidence: model=deepseek-v4-flash')
      expect(eventText).toContain('usage=unavailable')
      expect(eventText).toContain('missing=zero_token_usage')
      expect(eventText).toContain('work_state_timeline_status=NEEDS_WORK_STATE_TIMELINE_EVIDENCE')
      expect(eventText).toContain('work_state_guards=model/cost/cache state is blocked')
    } finally {
      if (previousTraceFile === undefined) delete process.env.DSXU_ROUTE_TRACE_FILE
      else process.env.DSXU_ROUTE_TRACE_FILE = previousTraceFile
      if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop generalizes complex first-turn DSXU planning route input into the adapter boundary', async () => {
    const base = createQueryHarness()
    let captured: {
      model?: string
      routeInput?: { workflowKind?: string; role?: string }
      thinkingConfig?: { type?: string; budgetTokens?: number }
      systemPromptText?: string
    } = {}

    const params = createQueryHarness({
      messages: [
        createUserMessage({
          content: [
            '\u5168\u9762\u6838\u5ba1 DSXU \u4e3b\u94fe 8 \u4e2a\u533a\u57df\uff1aREPL, messages, AgentTool, LocalAgentTask, FileEditTool, compact, permissions, shell\u3002',
            '1.\u8f93\u51fa V18 \u6267\u884c\u65b9\u6848',
            '2.\u8865\u9f50\u9a8c\u6536\u77e9\u9635\u548c trace \u8bc1\u636e',
            '3.\u68c0\u67e5\u5de5\u5177\u94fe\u3001\u6743\u9650\u3001TUI \u80cc\u666f\u751f\u547d\u5468\u671f',
            '4.\u6309\u98ce\u9669\u5206\u9636\u6bb5\u6267\u884c',
          ].join('\n'),
        }),
      ],
      toolUseContext: {
        ...base.toolUseContext,
        options: {
          ...base.toolUseContext.options,
          mainLoopModel: 'deepseek-v4-flash',
        },
      } as never,
      deps: {
        ...base.deps!,
        callModel: (async function* ({ options, thinkingConfig, systemPrompt }) {
          captured = {
            model: options.model,
            routeInput: options.dsxuRouteInput,
            thinkingConfig,
            systemPromptText: JSON.stringify(systemPrompt),
          }
          yield createAssistantMessage({
            content: 'General route evidence captured.',
          }) as never
        }) as never,
      },
    })

    const { events, terminal } = await drainQueryForTest(params)
    const eventText = JSON.stringify(events)

    expect(terminal.reason).toBe('completed')
    expect(captured.model).toBe('deepseek-v4-flash')
    expect(captured.routeInput?.workflowKind).toBe('planning')
    expect(captured.routeInput?.role).toBe('planner')
    expect(captured.thinkingConfig?.type).toBe('enabled')
    expect(captured.systemPromptText).toContain('DSXU model evidence: deepseek-v4-flash')
    expect(captured.systemPromptText).toContain('reason=planning_flash_thinking_max')
    expect(eventText).toContain('DSXU final usage evidence: model=deepseek-v4-flash')
    expect(eventText).toContain('usage=unavailable')
    expect(eventText).toContain('work_state_timeline_status=NEEDS_WORK_STATE_TIMELINE_EVIDENCE')
  })

  test('query loop live harness proves thrown failures clean up assistant tool_use with synthetic tool_result', async () => {
    const params = createQueryHarness({
      fallbackModel: undefined,
      deps: {
        ...createQueryHarness().deps!,
        callModel: (async function* () {
          yield createAssistantMessage({
            content: [
              {
                type: 'tool_use',
                id: 'toolu-thrown-failure',
                name: 'Bash',
                input: { command: 'echo should-not-run' },
              },
            ],
          }) as never
          throw new Error('forced provider stream failure')
        }) as never,
      },
    })

    const { events, terminal } = await drainQueryForTest(params)
    const eventText = JSON.stringify(events)

    expect(terminal.reason).toBe('model_error')
    expect(eventText).toContain('toolu-thrown-failure')
    expect(eventText).toContain('forced provider stream failure')
    expect(eventText).toContain('"tool_result"')
  })

  test('query loop starts streamed DeepSeek tool execution before provider stream finishes', async () => {
    const previousProvider = process.env.DSXU_MODEL_PROVIDER
    const previousGateway = process.env.DSXU_MODEL_GATEWAY
    const previousDisable = process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
    const inProgressSnapshots: string[][] = []
    let currentInProgress = new Set<string>()
    let finishStream!: () => void
    const streamFinished = new Promise<void>(resolve => {
      finishStream = resolve
    })

    try {
      process.env.DSXU_MODEL_PROVIDER = 'deepseek'
      process.env.DSXU_MODEL_GATEWAY = 'direct'
      delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION

      const base = createQueryHarness()
      const toolUseContext = {
        ...base.toolUseContext,
        options: {
          ...base.toolUseContext.options,
          tools: [BashTool],
        },
        setInProgressToolUseIDs: (
          updater: (prev: Set<string>) => Set<string>,
        ) => {
          currentInProgress = updater(currentInProgress)
          inProgressSnapshots.push([...currentInProgress])
        },
      } as never
      const iterator = query({
        ...base,
        toolUseContext,
        canUseTool: (async () => ({
          behavior: 'deny',
          message: 'blocked by streaming-start contract',
          decisionReason: { type: 'mode', mode: 'default' },
        })) as never,
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            yield createAssistantMessage({
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu-stream-start',
                  name: 'Bash',
                  input: { command: 'echo should-not-wait-for-stream-stop' },
                },
              ],
            }) as never
            await streamFinished
          }) as never,
        },
      })

      let first = await iterator.next()
      while (
        !first.done &&
        !JSON.stringify(first.value).includes('toolu-stream-start')
      ) {
        first = await iterator.next()
      }
      expect(first.done).toBe(false)
      expect(JSON.stringify(first.value)).toContain('toolu-stream-start')

      const second = iterator.next()
      await new Promise(resolve => setTimeout(resolve, 25))
      expect(
        inProgressSnapshots.some(snapshot =>
          snapshot.includes('toolu-stream-start'),
        ),
      ).toBe(true)

      finishStream()
      await second
      await iterator.return?.(undefined as never)
    } finally {
      if (previousProvider === undefined) delete process.env.DSXU_MODEL_PROVIDER
      else process.env.DSXU_MODEL_PROVIDER = previousProvider
      if (previousGateway === undefined) delete process.env.DSXU_MODEL_GATEWAY
      else process.env.DSXU_MODEL_GATEWAY = previousGateway
      if (previousDisable === undefined) {
        delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
      } else {
        process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION =
          previousDisable
      }
    }
  })

  test('query loop replays Bash PowerShell Read Edit Agent lifecycle contract evidence', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const previousStreamingDisable =
      process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-tool-lifecycle-replay-'))
    const tmpWork = join(tmpRoot, 'workspace')
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    const toolSequence = [
      {
        id: 'toolu-bash-lifecycle',
        name: 'Bash',
        input: { command: 'echo bash lifecycle', description: 'Bash replay' },
      },
      {
        id: 'toolu-powershell-lifecycle',
        name: 'PowerShell',
        input: {
          command: 'Write-Output powershell lifecycle',
          description: 'PowerShell replay',
        },
      },
      {
        id: 'toolu-read-lifecycle',
        name: 'Read',
        input: { file_path: 'src/replay.txt' },
      },
      {
        id: 'toolu-edit-lifecycle',
        name: 'Edit',
        input: {
          file_path: 'src/replay.txt',
          old_string: 'before',
          new_string: 'after',
        },
      },
      {
        id: 'toolu-agent-lifecycle',
        name: 'Agent',
        input: {
          description: 'Agent lifecycle replay',
          prompt: 'Report lifecycle evidence only.',
        },
      },
    ] as const
    let providerCalls = 0

    try {
      mkdirSync(join(tmpWork, 'src'), { recursive: true })
      writeFileSync(join(tmpWork, 'src', 'replay.txt'), 'before\n', 'utf8')
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot
      process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION = '1'

      const base = createQueryHarness()
      let replayAppState = {
        ...getDefaultAppState(),
        toolPermissionContext: getEmptyToolPermissionContext(),
      }
      const setReplayAppState = (
        updater: (prev: typeof replayAppState) => typeof replayAppState,
      ) => {
        replayAppState = updater(replayAppState)
      }
      const replayTools = ['Bash', 'PowerShell', 'Read', 'Edit', 'Agent'].map(
        createLifecycleReplayTool,
      )
      const params = createQueryHarness({
        toolUseContext: {
          ...base.toolUseContext,
          getAppState: () => replayAppState as never,
          setAppState: setReplayAppState as never,
          setAppStateForTasks: setReplayAppState as never,
          options: {
            ...base.toolUseContext.options,
            tools: replayTools,
          },
        } as never,
        canUseTool: (async () => ({ behavior: 'allow' })) as never,
        deps: {
          ...base.deps!,
          callModel: (async function* () {
            const nextTool = toolSequence[providerCalls]
            providerCalls += 1
            if (!nextTool) {
              yield createAssistantMessage({
                content:
                  'Lifecycle replay complete with Bash, PowerShell, Read, Edit, and Agent evidence.',
              }) as never
              return
            }
            yield createAssistantMessage({
              content: [
                {
                  type: 'tool_use',
                  id: nextTool.id,
                  name: nextTool.name,
                  input: nextTool.input,
                },
              ],
            }) as never
          }) as never,
        },
      })

      const { events, terminal } = await runWithCwdOverride(tmpWork, () =>
        drainQueryForTest(params),
      )
      const eventText = JSON.stringify(events)

      expect(terminal.reason).toBe('completed')
      expect(providerCalls).toBe(toolSequence.length + 1)
      expect(eventText).toContain('Bash lifecycle replay completed')
      expect(eventText).toContain('PowerShell lifecycle replay completed')
      expect(eventText).toContain('Read lifecycle replay completed')
      expect(eventText).toContain('Edit lifecycle replay completed')
      expect(eventText).toContain('Agent lifecycle replay completed')
      expect(existsSync(tracePath)).toBe(true)
      const records = readFileSync(tracePath, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as Record<string, unknown>)
      const toolNames = ['Bash', 'PowerShell', 'Read', 'Edit', 'Agent']
      const eventForTool = (event: string, toolName: string) =>
        records.find(record => record.event === event && record.toolName === toolName)
      const lifecycleSummary = records
        .map(record =>
          [
            record.event,
            record.toolName,
            record.toolUseID,
            record.parentToolUseID,
            record.reason,
          ]
            .filter(Boolean)
            .join(':'),
        )
        .join('\n')

      for (const toolName of toolNames) {
        expect(lifecycleSummary).toContain(`tool_permission_decision:${toolName}`)
        expect(eventForTool('tool_permission_decision', toolName)).toMatchObject({
          behavior: 'allow',
          blocked: false,
        })
        expect(
          eventForTool('tool_result_mapping_lifecycle', toolName),
        ).toMatchObject({
          contentKind: 'blocks',
          isError: false,
        })
        expect(
          eventForTool('tool_progress_lifecycle', toolName),
        ).toMatchObject({
          parentToolUseID: expect.stringContaining('toolu-'),
        })
      }

      expect(eventForTool('tool_path_lifecycle', 'Read')).toMatchObject({
        rawPath: 'src/replay.txt',
        relativePath: 'src/replay.txt',
        isInsideCwd: true,
      })
      expect(eventForTool('tool_path_lifecycle', 'Edit')).toMatchObject({
        rawPath: 'src/replay.txt',
        relativePath: 'src/replay.txt',
        isInsideCwd: true,
      })
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      if (previousStreamingDisable === undefined) {
        delete process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION
      } else {
        process.env.DSXU_CODE_DISABLE_STREAMING_TOOL_EXECUTION =
          previousStreamingDisable
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('query loop live harness marks repaired tool results as non-success evidence', () => {
    const repaired = ensureToolResultPairing(
      normalizeMessagesForAPI(
        [
          createUserMessage({ content: 'run one command' }),
          createAssistantMessage({
            content: [
              {
                type: 'tool_use',
                id: 'toolu-missing-result',
                name: 'Bash',
                input: { command: 'mkdir -p /mnt/d/xurui' },
              },
            ],
          }),
          createUserMessage({ content: 'continue' }),
        ],
        [],
      ),
    )

    const serialized = JSON.stringify(repaired)
    expect(serialized).toContain('toolu-missing-result')
    expect(serialized).toContain('tool_use_did_not_complete')
    expect(serialized).toContain('do_not_assume_tool_succeeded')
  })

  test('query loop controlled overflow fixture routes compact recovery schema before provider retry', async () => {
    const previousTrace = process.env.DSXU_CODE_LIFECYCLE_TRACE
    const previousTraceDir = process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-query-loop-compact-gate-'))
    const tracePath = join(tmpRoot, `dsxu-lifecycle-${process.pid}.jsonl`)
    let autocompactCalls = 0
    let providerCalls = 0
    const giantInstruction = `DSXU_OVERFLOW_FIXTURE ${'preserve-scope '.repeat(12_000)}`
    const snapshot = buildCompactRecoverySnapshot({
      primaryRequest: 'Recover from prompt-too-long without losing DSXU scope',
      userInstructions: ['Keep DSXU single mainline', 'Do not re-enable legacy compact runtime'],
      changedFiles: ['D:/DSXU-code/src/query.ts'],
      pendingTasks: ['prove prompt-too-long compact recovery evidence'],
      pendingAgents: ['verifier:compact-overflow'],
      failedCommands: ['provider returned prompt-too-long/413'],
      permissionDenials: ['none'],
      recoveryDecisions: ['route through DSXU compact schema before provider retry'],
      verificationStatus: 'partial',
      nextActions: ['rerun query recovery contract tests'],
    })
    const renderedSnapshot = renderCompactRecoverySnapshot(snapshot)

    try {
      process.env.DSXU_CODE_LIFECYCLE_TRACE = '1'
      process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = tmpRoot

      const params = createQueryHarness({
        messages: [createUserMessage({ content: giantInstruction })],
        deps: {
          ...createQueryHarness().deps!,
          autocompact: (async messages => {
            autocompactCalls += 1
            expect(JSON.stringify(messages)).toContain('DSXU_OVERFLOW_FIXTURE')
            return {
              wasCompacted: true,
              compactionResult: {
                boundaryMarker: createSystemMessage('DSXU compact recovery boundary', 'info'),
                summaryMessages: [
                  createUserMessage({
                    content: renderedSnapshot,
                    isCompactSummary: true,
                  }),
                ],
                attachments: [],
                hookResults: [],
                messagesToKeep: [],
                preCompactTokenCount: 100_000,
                postCompactTokenCount: 1_000,
              },
              consecutiveFailures: 0,
            }
          }) as never,
          callModel: (async function* ({ messages }) {
            providerCalls += 1
            const serializedMessages = JSON.stringify(messages)
            expect(serializedMessages).toContain('dsxu.compact-recovery.v1')
            expect(serializedMessages).toContain('provider returned prompt-too-long/413')
            expect(serializedMessages).not.toContain('DSXU_OVERFLOW_FIXTURE preserve-scope preserve-scope preserve-scope')
            yield createAssistantMessage({
              content: 'Recovered from controlled overflow using DSXU compact recovery schema.',
            }) as never
          }) as never,
          microcompact: (async messages => ({ messages })) as never,
          uuid: () => '00000000-0000-4000-8000-000000000002',
        },
      })

      const { events, terminal } = await drainQueryForTest(params)
      const eventText = JSON.stringify(events)

      expect(autocompactCalls).toBe(1)
      expect(providerCalls).toBe(1)
      expect(terminal.reason).toBe('completed')
      expect(eventText).toContain('<dsxu_compact_recovery_snapshot>')
      expect(eventText).toContain('Recovered from controlled overflow')

      const trace = readFileSync(tracePath, 'utf8')
      expect(trace).toContain('"lastEvent":"recovery_gate_advisory"')
      expect(trace).toContain('"gateId":"dsxu_autocompact_recovery_snapshot"')
      expect(trace).toContain('"gateKind":"recovery"')
      expect(trace).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(trace).toContain('"blocked":false')
      expect(trace).toContain('"nextAction":"continue_with_compact_recovery_snapshot"')
    } finally {
      if (previousTrace === undefined) delete process.env.DSXU_CODE_LIFECYCLE_TRACE
      else process.env.DSXU_CODE_LIFECYCLE_TRACE = previousTrace
      if (previousTraceDir === undefined) {
        delete process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR
      } else {
        process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR = previousTraceDir
      }
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('documents Tool.ts error/permission phases as DSXU runtime contract', () => {
    const summary = getDsxuToolRuntimeContractSummary()

    expect(summary.runtime).toBe('DSXU Tool Contract')
    expect(summary.requiredPhases).toEqual([
      'schema',
      'validateInput',
      'checkPermissions',
      'call',
      'mapToolResultToToolResultBlockParam',
      'contextModifier',
      'telemetry',
    ])
    expect(summary.evidenceFields).toContain('permissionContext')
    expect(summary.legacyProtocolCompatibility).toContain('DSXU owns the runtime semantics')
  })

  test('keeps cache-stable system prompt sections explicit and auditable', async () => {
    clearSystemPromptSections()
    let cachedCalls = 0
    let uncachedCalls = 0

    const stableSection = systemPromptSection(
      'dsxu-test-stable-section',
      () => `stable-${++cachedCalls}`,
    )
    const volatileSection = DANGEROUS_uncachedSystemPromptSection(
      'dsxu-test-volatile-section',
      () => `volatile-${++uncachedCalls}`,
      'test section must recompute to prove the cache-break path',
    )

    try {
      const first = await processSystemPromptSectionsLifecycle([
        stableSection,
        volatileSection,
      ])
      const second = await processSystemPromptSectionsLifecycle([
        stableSection,
        volatileSection,
      ])

      expect(first.lifecycle).toBe('system-prompt-sections:resolved')
      expect(first.values).toEqual(['stable-1', 'volatile-1'])
      expect(second.values).toEqual(['stable-1', 'volatile-2'])
      expect(cachedCalls).toBe(1)
      expect(uncachedCalls).toBe(2)
    } finally {
      clearSystemPromptSections()
    }
  })

  test('keeps core tool prompts tuned for weak-model verification and anti-repeat behavior', async () => {
    const editPrompt = getEditToolDescription()
    const writePrompt = getWriteToolDescription()
    const grepPrompt = getGrepDescription()

    expect(FILE_UNCHANGED_STUB).toContain('do not repeat that same edit/write')
    expect(FILE_UNCHANGED_STUB).toContain('run verification next')

    expect(editPrompt).toContain('use your `Read` tool')
    expect(editPrompt).toContain('do not repeat the same Edit')
    expect(editPrompt).toContain('verification command next')

    expect(writePrompt).toContain('MUST use the Read tool first')
    expect(writePrompt).toContain('do not repeat the same Write')
    expect(writePrompt).toContain('verification command next')

    expect(grepPrompt).toContain('ALWAYS use Grep for search tasks')
    expect(grepPrompt).toContain('NEVER invoke `grep` or `rg` as a Bash command')

    const editResult = FileEditTool.mapToolResultToToolResultBlockParam({
      filePath: 'D:/DSXU-code/src/example.ts',
      userModified: false,
      replaceAll: false,
    } as never, 'toolu_edit')
    const writeResult = FileWriteTool.mapToolResultToToolResultBlockParam({
      filePath: 'D:/DSXU-code/src/example.ts',
      type: 'update',
    } as never, 'toolu_write')

    expect(String(editResult.content)).toContain('do not repeat the same Edit')
    expect(String(editResult.content)).toContain('verification command next')
    expect(String(writeResult.content)).toContain('Do not repeat the same Write')
    expect(String(writeResult.content)).toContain('verification command next')
  })

  test('narrows DSXU default model-visible tools to the mainline allowlist', () => {
    const previousMode = process.env.DSXU_CODE_MODE
    const previousBrief = process.env.DSXU_CODE_ENABLE_BRIEF_TOOL

    process.env.DSXU_CODE_MODE = '1'
    delete process.env.DSXU_CODE_ENABLE_BRIEF_TOOL

    try {
      const permissionContext = getEmptyToolPermissionContext()
      const toolNames = getTools(permissionContext).map(tool => tool.name)
      const sidecarNames = [
        'SendUserMessage',
        'Brief',
        'CronCreate',
        'CronDelete',
        'CronList',
        'RemoteTrigger',
        'Monitor',
        'PushNotification',
        'SubscribePR',
      ]

      for (const sidecarName of sidecarNames) {
        expect(toolNames).not.toContain(sidecarName)
      }

      expect(DSXU_DEFAULT_MAINLINE_TOOLS.has('Read')).toBe(true)
      expect(DSXU_DEFAULT_MAINLINE_TOOLS.has('Edit')).toBe(true)
      expect(DSXU_DEFAULT_MAINLINE_TOOLS.has('Bash')).toBe(true)
      expect(DSXU_DEFAULT_MAINLINE_TOOLS.has('workflow')).toBe(true)
      expect(toolNames).toContain('Read')
      expect(toolNames).toContain('Edit')
      expect(toolNames).toContain('Bash')

      process.env.DSXU_CODE_ENABLE_BRIEF_TOOL = '1'
      expect(getTools(permissionContext).map(tool => tool.name)).toContain(
        'SendUserMessage',
      )
    } finally {
      if (previousMode === undefined) delete process.env.DSXU_CODE_MODE
      else process.env.DSXU_CODE_MODE = previousMode
      if (previousBrief === undefined) delete process.env.DSXU_CODE_ENABLE_BRIEF_TOOL
      else process.env.DSXU_CODE_ENABLE_BRIEF_TOOL = previousBrief
    }
  })

  test('keeps built-in and MCP tool assembly deterministic for prompt-cache stability', () => {
    const previousMode = process.env.DSXU_CODE_MODE
    process.env.DSXU_CODE_MODE = '1'

    try {
      const permissionContext = getEmptyToolPermissionContext()
      const mcpTools = [
        { name: 'mcp__z_server__z_tool' },
        { name: 'mcp__a_server__a_tool' },
      ] as never
      const assembledNames = assembleToolPool(permissionContext, mcpTools).map(
        tool => tool.name,
      )
      const firstMcpIndex = assembledNames.findIndex(name =>
        name.startsWith('mcp__'),
      )
      const builtInPrefix = assembledNames.slice(0, firstMcpIndex)
      const mcpSuffix = assembledNames.slice(firstMcpIndex)

      expect(firstMcpIndex).toBeGreaterThan(0)
      expect(builtInPrefix).toEqual([...builtInPrefix].sort())
      expect(mcpSuffix).toEqual([
        'mcp__a_server__a_tool',
        'mcp__z_server__z_tool',
      ])

      const profile = getDsxuToolRegistryRuntimeProfile()
      expect(profile.defaultMainlineToolNames).toContain('workflow')
      expect(profile.explicitSidecarToolEnv.SendUserMessage).toBe(
        'DSXU_CODE_ENABLE_BRIEF_TOOL',
      )
      expect(profile.activationEvidence.join('\n')).toContain(
        'DSXU_DEFAULT_MAINLINE_TOOLS',
      )
    } finally {
      if (previousMode === undefined) delete process.env.DSXU_CODE_MODE
      else process.env.DSXU_CODE_MODE = previousMode
    }
  })

  test('documents CLI allowedTools as permission preapproval, not model tool exposure', () => {
    expect(parseToolListFromCLI(['Read,Edit', 'Bash(git:*)'])).toEqual([
      'Read',
      'Edit',
      'Bash(git:*)',
    ])
    expect(getDsxuToolRegistryRuntimeProfile().activationEvidence.join('\n')).toContain(
      'getTools applies permission deny rules',
    )
  })

  test('turns PlanMode into a DSXU scope fence and acceptance contract', () => {
    const enterPrompt = getEnterPlanModeToolPrompt()
    const exitPrompt = EXIT_PLAN_MODE_V2_TOOL_PROMPT

    for (const prompt of [enterPrompt, exitPrompt]) {
      expect(prompt).toContain('Scope fence')
      expect(prompt).toContain('allowed files/directories')
      expect(prompt).toContain('denied files/directories')
      expect(prompt).toContain('allowed tools')
      expect(prompt).toContain('denied tools')
      expect(prompt).toContain('Read-only')
      expect(prompt).toContain('Acceptance')
      expect(prompt).toContain('PASS marker')
      expect(prompt).toContain('PARTIAL or FAIL')
    }

    expect(enterPrompt).toContain('Weak-model rule')
    expect(enterPrompt).toContain('Do not use it to brainstorm endlessly')
    expect(exitPrompt).toContain('Do NOT use AskUserQuestion to ask "Is this plan okay?"')
    expect(exitPrompt).toContain('Do not call it if the plan lacks a concrete scope fence')
  })
})
