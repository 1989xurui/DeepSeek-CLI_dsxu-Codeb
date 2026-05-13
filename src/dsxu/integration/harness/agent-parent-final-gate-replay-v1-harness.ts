import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { buildDsxuAgentFinalGateNudge } from '../../../query'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages'
import { AgentTool } from '../../../tools/AgentTool/AgentTool'
import { TaskOutputTool } from '../../../tools/TaskOutputTool/TaskOutputTool'

export type AgentParentFinalGateReplayCase = {
  id: string
  evidenceClaim: 'complete' | 'partial'
  finalText: string
  expectedBlocked: boolean
  actualBlocked: boolean
  nudge: string | null
  ok: boolean
  reason: string
}

export type AgentParentFinalGateReplayResult = {
  ok: boolean
  evidencePath: string
  tracePath: string
  cases: AgentParentFinalGateReplayCase[]
  aggregate: {
    caseCount: number
    completeWithoutCitationBlocked: boolean
    completeWithCitationAllowed: boolean
    partialDonePassBlocked: boolean
    partialDisclosedAllowed: boolean
    gluedDonePassBlocked: boolean
    actualAgentToolResultBlocked: boolean
    actualTaskOutputResultBlocked: boolean
  }
}

function evidenceToolResult(content: string, id: string) {
  return createUserMessage({
    content: [
      {
        type: 'tool_result' as const,
        tool_use_id: `agent-evidence-${id}`,
        content,
      },
    ],
  })
}

function agentToolEvidenceResult(id: string) {
  return createUserMessage({
    content: [
      AgentTool.mapToolResultToToolResultBlockParam(
        {
          status: 'completed',
          prompt: 'worker-owned checkout repair',
          agentId: `agent-${id}`,
          agentType: 'worker',
          content: [
            {
              type: 'text',
              text:
                'Complete: changed src/checkout/service.ts and passed bun test tests/checkout/regression.test.ts.',
            },
          ],
          evidencePacket: {
            files_read: ['src/checkout/service.ts'],
            files_changed: ['src/checkout/service.ts'],
            commands_run: ['bun test tests/checkout/regression.test.ts'],
            tests_passed: ['bun test tests/checkout/regression.test.ts'],
            tests_failed: [],
            unresolved_risks: [],
            completion_claim: 'complete',
          },
          totalDurationMs: 1234,
          totalTokens: 456,
          totalToolUseCount: 3,
          usage: {
            input_tokens: 300,
            output_tokens: 156,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
          },
        } as never,
        `agent-tool-${id}`,
      ) as never,
    ],
  })
}

function taskOutputEvidenceResult(id: string) {
  return createUserMessage({
    content: [
      TaskOutputTool.mapToolResultToToolResultBlockParam(
        {
          retrieval_status: 'success',
          task: {
            task_id: `agent-async-${id}`,
            task_type: 'local_agent',
            status: 'completed',
            output:
              'Worker completed checkout repair.\n1 test passed, 0 failed',
            prompt: 'Repair checkout flow',
            result:
              'Worker completed checkout repair.\n1 test passed, 0 failed',
            evidencePacket: {
              files_read: ['src/checkout/service.ts'],
              files_changed: ['src/checkout/service.ts'],
              commands_run: ['bun test tests/checkout/regression.test.ts'],
              tests_passed: ['bun test tests/checkout/regression.test.ts'],
              tests_failed: [],
              unresolved_risks: [],
              completion_claim: 'complete',
            },
          },
        } as never,
        `task-output-${id}`,
      ) as never,
    ],
  })
}

const completeEvidence = [
  '<evidence>',
  'completion_claim: complete',
  'files_read: src/checkout/service.ts',
  'files_changed: src/checkout/service.ts',
  'commands_run: bun test tests/checkout/regression.test.ts',
  'tests_passed: bun test tests/checkout/regression.test.ts',
  'tests_failed: none',
  'unresolved_risks: none',
  '</evidence>',
].join('\n')

const partialEvidence = [
  '<evidence>',
  'completion_claim: partial',
  'files_read: src/cart.ts',
  'files_changed: none',
  'commands_run: bun test tests/cart.test.ts',
  'tests_passed: none',
  'tests_failed: bun test tests/cart.test.ts',
  'unresolved_risks: checkout regression still failing',
  '</evidence>',
].join('\n')

function runCase(input: {
  id: string
  evidence: string
  evidenceClaim: 'complete' | 'partial'
  finalText: string
  expectedBlocked: boolean
  reason: string
}): AgentParentFinalGateReplayCase {
  const nudge = buildDsxuAgentFinalGateNudge(
    [evidenceToolResult(input.evidence, input.id)],
    [createAssistantMessage({ content: input.finalText })],
  )
  const actualBlocked = nudge !== null
  return {
    id: input.id,
    evidenceClaim: input.evidenceClaim,
    finalText: input.finalText,
    expectedBlocked: input.expectedBlocked,
    actualBlocked,
    nudge,
    ok: actualBlocked === input.expectedBlocked,
    reason: input.reason,
  }
}

function runMappedToolCase(input: {
  id: string
  evidenceMessage: ReturnType<typeof createUserMessage>
  evidenceClaim: 'complete' | 'partial'
  finalText: string
  expectedBlocked: boolean
  reason: string
}): AgentParentFinalGateReplayCase {
  const nudge = buildDsxuAgentFinalGateNudge(
    [input.evidenceMessage],
    [createAssistantMessage({ content: input.finalText })],
  )
  const actualBlocked = nudge !== null
  return {
    id: input.id,
    evidenceClaim: input.evidenceClaim,
    finalText: input.finalText,
    expectedBlocked: input.expectedBlocked,
    actualBlocked,
    nudge,
    ok: actualBlocked === input.expectedBlocked,
    reason: input.reason,
  }
}

export async function runAgentParentFinalGateReplay(options: {
  evidenceDir?: string
} = {}): Promise<AgentParentFinalGateReplayResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-agent')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'agent-parent-final-gate-replay.evidence.json')
  const tracePath = join(evidenceDir, 'agent-parent-final-gate-replay.trace.json')

  const cases = [
    runCase({
      id: 'complete-evidence-bare-done-blocked',
      evidence: completeEvidence,
      evidenceClaim: 'complete',
      finalText: 'Done. PASS',
      expectedBlocked: true,
      reason: 'complete worker evidence exists, but the parent final gives no concrete file or command citation',
    }),
    runCase({
      id: 'complete-evidence-cited-final-allowed',
      evidence: completeEvidence,
      evidenceClaim: 'complete',
      finalText:
        'Complete: worker changed src/checkout/service.ts and passed bun test tests/checkout/regression.test.ts.',
      expectedBlocked: false,
      reason: 'parent final cites changed file and verification command from the worker packet',
    }),
    runCase({
      id: 'partial-evidence-done-pass-blocked',
      evidence: partialEvidence,
      evidenceClaim: 'partial',
      finalText: 'Done. PASS',
      expectedBlocked: true,
      reason: 'partial worker evidence cannot be promoted to completion',
    }),
    runCase({
      id: 'partial-evidence-disclosed-final-allowed',
      evidence: partialEvidence,
      evidenceClaim: 'partial',
      finalText:
        'PARTIAL: worker evidence shows bun test tests/cart.test.ts is still failing with checkout regression still failing.',
      expectedBlocked: false,
      reason: 'parent final truthfully discloses partial evidence and unresolved risk',
    }),
    runCase({
      id: 'glued-done-pass-sentence-blocked',
      evidence: completeEvidence,
      evidenceClaim: 'complete',
      finalText:
        'Done. PASS. The worker completed it successfully.',
      expectedBlocked: true,
      reason: 'Done/PASS glued into one final response is still blocked unless it cites concrete evidence',
    }),
    runMappedToolCase({
      id: 'actual-agent-tool-result-bare-done-blocked',
      evidenceMessage: agentToolEvidenceResult('mapped-sync'),
      evidenceClaim: 'complete',
      finalText: 'Done. PASS',
      expectedBlocked: true,
      reason:
        'actual AgentTool.mapToolResultToToolResultBlockParam evidence is parsed by the parent final gate',
    }),
    runMappedToolCase({
      id: 'actual-task-output-result-bare-done-blocked',
      evidenceMessage: taskOutputEvidenceResult('mapped-async'),
      evidenceClaim: 'complete',
      finalText: 'Done. PASS',
      expectedBlocked: true,
      reason:
        'actual TaskOutputTool evidence from async local_agent output is parsed by the parent final gate',
    }),
  ]

  const aggregate = {
    caseCount: cases.length,
    completeWithoutCitationBlocked: cases.find(item => item.id === 'complete-evidence-bare-done-blocked')?.actualBlocked === true,
    completeWithCitationAllowed: cases.find(item => item.id === 'complete-evidence-cited-final-allowed')?.actualBlocked === false,
    partialDonePassBlocked: cases.find(item => item.id === 'partial-evidence-done-pass-blocked')?.actualBlocked === true,
    partialDisclosedAllowed: cases.find(item => item.id === 'partial-evidence-disclosed-final-allowed')?.actualBlocked === false,
    gluedDonePassBlocked: cases.find(item => item.id === 'glued-done-pass-sentence-blocked')?.actualBlocked === true,
    actualAgentToolResultBlocked: cases.find(item => item.id === 'actual-agent-tool-result-bare-done-blocked')?.actualBlocked === true,
    actualTaskOutputResultBlocked: cases.find(item => item.id === 'actual-task-output-result-bare-done-blocked')?.actualBlocked === true,
  }
  const result: AgentParentFinalGateReplayResult = {
    ok: cases.every(item => item.ok) && Object.values(aggregate).every(Boolean),
    evidencePath,
    tracePath,
    cases,
    aggregate,
  }
  await writeFile(tracePath, `${JSON.stringify({ cases, aggregate }, null, 2)}\n`, 'utf8')
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
