import { describe, expect, test } from 'bun:test'
import {
  DSXU_TOOL_RESULT_AUTO_CONTINUE_GATE_STATE,
  buildDsxuFinalGateState,
  buildDsxuIdenticalToolCallStormGate,
  buildDsxuPhase6GateCloseAudit,
  buildDsxuPostPassFinalizationGateState,
  buildDsxuRecoveryGateState,
  buildDsxuToolBatchGateState,
} from '../query-loop-gate-state-v1'

describe('V19 query-loop gate state classification', () => {
  test('final gates expose completion-blocking classifications in one query-loop view', () => {
    expect(buildDsxuFinalGateState('dsxu_agent_final_gate')).toEqual({
      owner: 'query_loop',
      gateId: 'dsxu_agent_final_gate',
      gateKind: 'final_response',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: true,
      nextAction: 'cite_complete_worker_evidence_or_mark_partial',
    })

    expect(buildDsxuFinalGateState('dsxu_intent_only_final_gate')).toMatchObject({
      owner: 'query_loop',
      gateClass: 'RECOVERY_BLOCK',
      blocked: true,
      completionBlocked: true,
      nextAction: 'perform_promised_action_or_report_no_action_taken',
    })
  })

  test('recovery gates allow next action while blocking premature PASS when evidence is incomplete', () => {
    expect(
      buildDsxuRecoveryGateState({
        state: 'baseline_pass_pending_required_edit',
        requiredAction: 'read_source_truth',
        canClaimComplete: false,
      }),
    ).toEqual({
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
      }),
    ).toMatchObject({
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      completionBlocked: true,
      nextAction: 'agent_evidence_or_partial',
    })
  })

  test('verified recovery and auto-continue distinguish completion readiness from continuation', () => {
    expect(
      buildDsxuRecoveryGateState({
        state: 'verified_passed_ready_final',
        requiredAction: 'final_answer',
        canClaimComplete: true,
      }),
    ).toMatchObject({
      gateClass: 'CAPABILITY_NUDGE',
      blocked: false,
      completionBlocked: false,
      nextAction: 'final_answer',
    })

    expect(DSXU_TOOL_RESULT_AUTO_CONTINUE_GATE_STATE).toMatchObject({
      gateKind: 'continuation',
      gateClass: 'RECOVERY_BLOCK',
      blocked: false,
      completionBlocked: true,
      nextAction: 'submit_main_chain_continuation',
    })
  })

  test('post-pass tool gates block more tools without blocking final completion', () => {
    expect(buildDsxuPostPassFinalizationGateState('verified_pass')).toEqual({
      owner: 'query_loop',
      gateId: 'dsxu_post_pass_tool_gate',
      gateKind: 'final_response',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: false,
      nextAction: 'final_answer_after_verified_pass',
    })

    expect(
      buildDsxuToolBatchGateState({
        gateId: 'dsxu_post_pass_marker_gate',
        gateClass: 'BENCH_CONTRACT_ONLY',
        blocked: true,
        nextAction: 'final_answer_from_existing_pass_marker',
      }),
    ).toEqual({
      owner: 'query_loop',
      gateId: 'dsxu_post_pass_marker_gate',
      gateKind: 'final_response',
      gateClass: 'BENCH_CONTRACT_ONLY',
      blocked: true,
      completionBlocked: false,
      nextAction: 'final_answer_from_existing_pass_marker',
    })
  })

  test('Phase 6 focused-close audit keeps cost and benchmark gates out of generic hard blocks', () => {
    const audit = buildDsxuPhase6GateCloseAudit()

    expect(audit.status).toBe('FOCUSED_CLOSED_PHASE12_RESIDUAL')
    expect(audit.focusedCloseAllowed).toBe(true)
    expect(audit.violations).toEqual([])
    expect(audit.records.some(record => record.gateClass === 'SAFETY_BLOCK')).toBe(true)
    expect(audit.records.some(record => record.gateClass === 'RECOVERY_BLOCK')).toBe(true)
    expect(audit.records.some(record => record.disposition === 'finalization_only')).toBe(true)
    expect(
      audit.records.filter(
        record =>
          record.gateClass === 'COST_SMELL' ||
          record.gateClass === 'BENCH_CONTRACT_ONLY',
      ),
    ).toSatisfy(records =>
      records.every(record => !record.blocked || !record.completionBlocked),
    )
    expect(audit.blockedHeavyEvidence.join('\n')).toContain('generated alias')
    expect(audit.phase12Residuals.join('\n')).toContain('Phase 12')
  })

  test('blocks identical read-only tool storms without treating the gate as a benchmark-only smell', () => {
    const gate = buildDsxuIdenticalToolCallStormGate({
      threshold: 3,
      calls: [
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      ],
    })

    expect(gate.gateState).toEqual({
      owner: 'query_loop',
      gateId: 'dsxu_identical_tool_call_storm_gate',
      gateKind: 'tool_scheduling',
      gateClass: 'RECOVERY_BLOCK',
      blocked: true,
      completionBlocked: true,
      nextAction: 'change_strategy_or_mutate_source_before_repeating_identical_tool_call',
    })
    expect(gate.signals).toContain('identical_tool_call_storm')
    expect(gate.blockedToolName).toBe('Read')
    expect(gate.repeatedCount).toBe(3)
  })

  test('allows verification reread after a mutating tool resets the duplicate window', () => {
    const gate = buildDsxuIdenticalToolCallStormGate({
      threshold: 3,
      calls: [
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
        {
          toolName: 'Edit',
          input: {
            file_path: 'src/query.ts',
            old_string: 'before',
            new_string: 'after',
          },
          readWriteClass: 'write-local',
        },
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
        { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      ],
    })

    expect(gate.gateState).toBeNull()
    expect(gate.signals).toContain('mutating_tool_reset_read_window')
    expect(gate.signals).not.toContain('identical_tool_call_storm')
    expect(gate.evidence.join('\n')).toContain('mutation:Edit clears read-only duplicate window')
  })
})
