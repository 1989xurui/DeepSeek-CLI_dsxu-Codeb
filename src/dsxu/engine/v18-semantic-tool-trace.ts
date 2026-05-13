import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { ToolUseBlock } from '../../types/providerSdk.js'
import { createAssistantMessage, createUserMessage } from '../../utils/messages.js'
import {
  createReadCacheHitRepeatBlockedMessage,
  createRepeatedSemanticToolBlockedMessage,
  shouldBlockReadCacheHitRepeat,
  shouldBlockRepeatedSemanticToolInBatch,
} from '../../services/tools/dsxuToolBatchGate.js'
import { StreamingToolExecutor } from '../../services/tools/StreamingToolExecutor.js'
import {
  buildRunNativeTestDecision,
  collectEvidenceFromVerificationEvents,
  type CollectEvidenceResult,
  type RunNativeTestDecision,
  type SemanticVerificationEvent,
} from './v18-semantic-tools.js'

export type SemanticToolTraceEvent = {
  id: string
  step: string
  expected: 'allow' | 'block' | 'collect'
  observed: 'allow' | 'block' | 'collect'
  ok: boolean
  state?: string
  reason?: string
}

export type SemanticToolGateRealTrace = {
  ok: boolean
  status: 'DONE-EVIDENCED' | 'FAILED-EVIDENCED'
  generatedAt: string
  policy: 'semantic_gate_no_overblock_then_semantic_tool_layer'
  gate: {
    ok: boolean
    blockedDuplicateCount: number
    blockedReadCacheRepeatCount: number
    changedStrategyAllowedCount: number
    overblockCount: number
    events: SemanticToolTraceEvent[]
  }
  semanticTools: {
    ok: boolean
    decisions: RunNativeTestDecision[]
    evidence: CollectEvidenceResult
    events: SemanticToolTraceEvent[]
  }
}

function toolUse(
  name: string,
  input: Record<string, unknown>,
  id: string,
): ToolUseBlock {
  return {
    type: 'tool_use',
    id,
    name,
    input,
  }
}

function assistantWith(block: ToolUseBlock) {
  return createAssistantMessage({
    content: [block as never],
  })
}

function resultFor(toolUseId: string, content: string) {
  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: false,
      },
    ],
    toolUseResult: content,
  })
}

function hasToolState(message: unknown, state: string): boolean {
  return JSON.stringify(message).includes(`DSXU tool state: ${state}`)
}

async function streamingDuplicateProbe(): Promise<SemanticToolTraceEvent> {
  const first = toolUse(
    'PowerShell',
    {
      command:
        'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 180000',
    },
    'ps-1',
  )
  const duplicate = toolUse(
    'PowerShell',
    {
      command:
        'bun    test   src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 180000',
    },
    'ps-2',
  )
  const executor = new StreamingToolExecutor(
    [],
    (async () => ({ behavior: 'allow', updatedInput: {} })) as never,
    {
      messages: [],
      options: { tools: [] },
      abortController: new AbortController(),
      setInProgressToolUseIDs() {},
      setResponseLength() {},
      getAppState: () => ({}) as never,
      setAppState() {},
      readFileState: {} as never,
      updateFileHistoryState() {},
      updateAttributionState() {},
    } as never,
  )

  executor.addTool(duplicate, assistantWith(duplicate), [first, duplicate])
  const updates = []
  for await (const update of executor.getRemainingResults()) {
    updates.push(update)
  }
  const blocked = updates.length === 1 &&
    hasToolState(updates[0]?.message, 'repeated_semantic_tool_blocked')
  return {
    id: 'streaming-duplicate-boundary',
    step: 'StreamingToolExecutor blocks duplicate same-target verification before execution',
    expected: 'block',
    observed: blocked ? 'block' : 'allow',
    ok: blocked,
    state: blocked ? 'repeated_semantic_tool_blocked' : undefined,
  }
}

async function buildGateTrace(): Promise<SemanticToolGateRealTrace['gate']> {
  const events: SemanticToolTraceEvent[] = []
  const firstRead = toolUse('Read', { file_path: 'D:\\DSXU-code\\src\\query.ts' }, 'read-1')
  const duplicateRead = toolUse('Read', { path: 'd:/dsxu-code/src/query.ts' }, 'read-2')
  const firstBlocked = shouldBlockRepeatedSemanticToolInBatch(
    [firstRead, duplicateRead],
    firstRead,
  )
  const duplicateBlocked = shouldBlockRepeatedSemanticToolInBatch(
    [firstRead, duplicateRead],
    duplicateRead,
  )
  const duplicateMessage = createRepeatedSemanticToolBlockedMessage(
    duplicateRead,
    assistantWith(duplicateRead),
  )
  events.push({
    id: 'same-batch-first-read',
    step: 'First same-target Read in a batch remains allowed',
    expected: 'allow',
    observed: firstBlocked ? 'block' : 'allow',
    ok: !firstBlocked,
  })
  events.push({
    id: 'same-batch-duplicate-read',
    step: 'Duplicate same-target Read in the same batch is blocked',
    expected: 'block',
    observed: duplicateBlocked ? 'block' : 'allow',
    ok:
      duplicateBlocked &&
      hasToolState(duplicateMessage, 'repeated_semantic_tool_blocked'),
    state: 'repeated_semantic_tool_blocked',
  })

  const cacheRead = toolUse('Read', { file_path: 'src/query.ts' }, 'read-cache-1')
  const cacheHit = resultFor(
    'read-cache-1',
    'DSXU tool state: read_cache_hit. File unchanged since last read.',
  )
  const repeatRead = toolUse('Read', { file_path: 'src/query.ts' }, 'read-3')
  const cacheRepeatBlocked = shouldBlockReadCacheHitRepeat(
    [assistantWith(cacheRead), cacheHit],
    repeatRead,
  )
  const cacheRepeatMessage = createReadCacheHitRepeatBlockedMessage(
    repeatRead,
    assistantWith(repeatRead),
  )
  events.push({
    id: 'read-cache-repeat',
    step: 'Same-file Read after read_cache_hit is blocked before source progress',
    expected: 'block',
    observed: cacheRepeatBlocked ? 'block' : 'allow',
    ok:
      cacheRepeatBlocked &&
      hasToolState(cacheRepeatMessage, 'read_cache_repeat_blocked'),
    state: 'read_cache_repeat_blocked',
  })

  const editApplied = resultFor(
    'edit-1',
    'The file src/query.ts has been updated successfully.\nDSXU tool state: edit_applied; next=verify.',
  )
  const readAfterEditBlocked = shouldBlockReadCacheHitRepeat(
    [assistantWith(cacheRead), cacheHit, editApplied],
    repeatRead,
  )
  events.push({
    id: 'read-cache-after-edit',
    step: 'Source mutation clears read_cache_hit repeat block',
    expected: 'allow',
    observed: readAfterEditBlocked ? 'block' : 'allow',
    ok: !readAfterEditBlocked,
  })

  const firstTest = toolUse(
    'PowerShell',
    { command: 'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 180000' },
    'ps-3',
  )
  const changedTest = toolUse(
    'PowerShell',
    { command: 'bun test src/dsxu/engine/__tests__/edit-convergence-gate-v1.test.ts --timeout 180000' },
    'ps-4',
  )
  const changedStrategyBlocked = shouldBlockRepeatedSemanticToolInBatch(
    [firstTest, changedTest],
    changedTest,
  )
  events.push({
    id: 'changed-strategy-verification',
    step: 'Different focused verification command remains allowed',
    expected: 'allow',
    observed: changedStrategyBlocked ? 'block' : 'allow',
    ok: !changedStrategyBlocked,
  })

  events.push(await streamingDuplicateProbe())

  const blockedDuplicateCount = events.filter(
    event => event.state === 'repeated_semantic_tool_blocked' && event.ok,
  ).length
  const blockedReadCacheRepeatCount = events.filter(
    event => event.state === 'read_cache_repeat_blocked' && event.ok,
  ).length
  const changedStrategyAllowedCount = events.filter(
    event => event.expected === 'allow' && event.observed === 'allow' && event.ok,
  ).length
  const overblockCount = events.filter(
    event => event.expected === 'allow' && event.observed === 'block',
  ).length

  return {
    ok: events.every(event => event.ok) && overblockCount === 0,
    blockedDuplicateCount,
    blockedReadCacheRepeatCount,
    changedStrategyAllowedCount,
    overblockCount,
    events,
  }
}

function buildSemanticToolLayerTrace(): SemanticToolGateRealTrace['semanticTools'] {
  const command =
    'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 180000'
  const failedAttempt: SemanticVerificationEvent = {
    id: 'native-test-1',
    tool: 'PowerShell',
    command,
    cwd: 'D:\\DSXU-code',
    exitCode: 1,
    output: '1 fail\nexit code 1',
  }
  const passedAttempt: SemanticVerificationEvent = {
    id: 'native-test-2',
    tool: 'RunNativeTest',
    command,
    cwd: 'D:\\DSXU-code',
    exitCode: 0,
    sourceChangedBeforeRun: true,
    output: '9 pass\n0 fail',
  }

  const firstDecision = buildRunNativeTestDecision({
    command,
    cwd: 'D:\\DSXU-code',
  })
  const repeatedWithoutChange = buildRunNativeTestDecision({
    command,
    cwd: 'D:\\DSXU-code',
    previousAttempts: [failedAttempt],
  })
  const afterSourceChange = buildRunNativeTestDecision({
    command,
    cwd: 'D:\\DSXU-code',
    previousAttempts: [failedAttempt],
    sourceChangedSinceLastAttempt: true,
  })
  const afterPass = buildRunNativeTestDecision({
    command,
    cwd: 'D:\\DSXU-code',
    previousAttempts: [failedAttempt, passedAttempt],
  })
  const evidence = collectEvidenceFromVerificationEvents([failedAttempt, passedAttempt])
  const events: SemanticToolTraceEvent[] = [
    {
      id: 'run-native-test-first',
      step: 'First native verification is allowed',
      expected: 'allow',
      observed: firstDecision.action === 'run' ? 'allow' : 'block',
      ok: firstDecision.action === 'run',
      reason: firstDecision.reason,
    },
    {
      id: 'run-native-test-repeat-failure',
      step: 'Same failed native verification without source or strategy change is blocked',
      expected: 'block',
      observed: repeatedWithoutChange.action === 'block_repeated_verification' ? 'block' : 'allow',
      ok: repeatedWithoutChange.action === 'block_repeated_verification',
      reason: repeatedWithoutChange.reason,
    },
    {
      id: 'run-native-test-after-source-change',
      step: 'Same native verification after source change is allowed',
      expected: 'allow',
      observed: afterSourceChange.action === 'run' ? 'allow' : 'block',
      ok: afterSourceChange.action === 'run',
      reason: afterSourceChange.reason,
    },
    {
      id: 'run-native-test-after-pass',
      step: 'Same native verification after pass routes to evidence collection',
      expected: 'collect',
      observed: afterPass.action === 'collect_existing_pass' ? 'collect' : 'allow',
      ok: afterPass.action === 'collect_existing_pass',
      reason: afterPass.reason,
    },
    {
      id: 'collect-evidence-pass',
      step: 'CollectEvidence collapses raw attempts into latest PASS evidence',
      expected: 'collect',
      observed: evidence.status === 'PASS' ? 'collect' : 'block',
      ok:
        evidence.status === 'PASS' &&
        evidence.rawCommandCount === 2 &&
        evidence.uniqueCommandCount === 1 &&
        evidence.repeatedCommandCount === 1,
    },
  ]

  return {
    ok: events.every(event => event.ok),
    decisions: [firstDecision, repeatedWithoutChange, afterSourceChange, afterPass],
    evidence,
    events,
  }
}

export async function buildSemanticToolGateRealTrace(): Promise<SemanticToolGateRealTrace> {
  const gate = await buildGateTrace()
  const semanticTools = buildSemanticToolLayerTrace()
  const ok = gate.ok && semanticTools.ok
  return {
    ok,
    status: ok ? 'DONE-EVIDENCED' : 'FAILED-EVIDENCED',
    generatedAt: new Date().toISOString(),
    policy: 'semantic_gate_no_overblock_then_semantic_tool_layer',
    gate,
    semanticTools,
  }
}

export async function writeSemanticToolGateRealTrace(
  evidencePath = resolve(
    process.cwd(),
    '.dsxu',
    'trace',
    'v18-semantic-tool',
    'semantic-tool-gate-real-trace.json',
  ),
): Promise<SemanticToolGateRealTrace> {
  const trace = await buildSemanticToolGateRealTrace()
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8')
  return trace
}
