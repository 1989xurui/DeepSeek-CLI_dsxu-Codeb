export type DsxuQueryLoopGateClass =
  | 'SAFETY_BLOCK'
  | 'QUALITY_BLOCK'
  | 'RECOVERY_BLOCK'
  | 'CAPABILITY_NUDGE'
  | 'COST_SMELL'
  | 'BENCH_CONTRACT_ONLY'
  | 'RELAX_OR_REMOVE'

export type DsxuQueryLoopGateState = {
  owner: 'query_loop'
  gateId: string
  gateKind: 'final_response' | 'tool_scheduling' | 'recovery' | 'continuation'
  gateClass: DsxuQueryLoopGateClass
  blocked: boolean
  completionBlocked: boolean
  nextAction: string
}

export type DsxuRecoveryGateInput = {
  state: string
  requiredAction: string
  canClaimComplete: boolean
}

export type DsxuToolBatchGateInput = {
  gateId: string
  gateClass: DsxuQueryLoopGateClass
  blocked: boolean
  nextAction: string
}

export type DsxuPhase6GateAuditRecord = {
  gateId: string
  owner: 'query_loop' | 'tool_lifecycle' | 'permission'
  gateClass: DsxuQueryLoopGateClass
  blocked: boolean
  completionBlocked: boolean
  disposition:
    | 'hard_block_retained'
    | 'completion_block_retained'
    | 'advisory_nonblocking'
    | 'finalization_only'
    | 'local_tool_scheduling_block'
  evidence: string
}

export type DsxuPhase6GateCloseAudit = {
  status: 'FOCUSED_CLOSED_PHASE12_RESIDUAL' | 'PARTIAL'
  focusedCloseAllowed: boolean
  records: readonly DsxuPhase6GateAuditRecord[]
  violations: readonly string[]
  blockedHeavyEvidence: readonly string[]
  phase12Residuals: readonly string[]
}

export const DSXU_TOOL_RESULT_AUTO_CONTINUE_GATE_STATE: DsxuQueryLoopGateState = {
  owner: 'query_loop',
  gateId: 'dsxu_tool_result_auto_continue_gate',
  gateKind: 'continuation',
  gateClass: 'RECOVERY_BLOCK',
  blocked: false,
  completionBlocked: true,
  nextAction: 'submit_main_chain_continuation',
}

export function buildDsxuPostPassFinalizationGateState(
  source: 'verified_pass' | 'pass_marker' = 'verified_pass',
): DsxuQueryLoopGateState {
  return {
    owner: 'query_loop',
    gateId:
      source === 'pass_marker'
        ? 'dsxu_post_pass_marker_gate'
        : 'dsxu_post_pass_tool_gate',
    gateKind: 'final_response',
    gateClass: source === 'pass_marker' ? 'BENCH_CONTRACT_ONLY' : 'QUALITY_BLOCK',
    blocked: true,
    completionBlocked: false,
    nextAction:
      source === 'pass_marker'
        ? 'final_answer_from_existing_pass_marker'
        : 'final_answer_after_verified_pass',
  }
}

export function buildDsxuToolBatchGateState(
  decision: DsxuToolBatchGateInput,
): DsxuQueryLoopGateState {
  if (
    decision.gateId === 'dsxu_post_pass_tool_gate' ||
    decision.gateId === 'dsxu_post_pass_marker_gate'
  ) {
    return buildDsxuPostPassFinalizationGateState(
      decision.gateId === 'dsxu_post_pass_marker_gate'
        ? 'pass_marker'
        : 'verified_pass',
    )
  }

  return {
    owner: 'query_loop',
    gateId: decision.gateId,
    gateKind: 'tool_scheduling',
    gateClass: decision.gateClass,
    blocked: decision.blocked,
    completionBlocked: decision.blocked,
    nextAction: decision.nextAction,
  }
}

export function getDsxuRecoveryGateClass(
  recoveryState: DsxuRecoveryGateInput,
): DsxuQueryLoopGateClass {
  switch (recoveryState.state) {
    case 'baseline_pass_pending_required_edit':
    case 'agent_evidence_incomplete':
    case 'post_compact_source_truth_required':
    case 'edit_preflight_source_truth':
    case 'edit_applied_needs_verification':
      return 'QUALITY_BLOCK'
    case 'failed_verification_loop':
    case 'verification_failed_needs_repair':
    case 'unsafe_batch_wait_for_mutation':
    case 'file_lookup_boundary_required':
    case 'permission_denied_replan':
    case 'tool_unavailable_replan':
      return 'RECOVERY_BLOCK'
    case 'mutation_budget_high':
    case 'discovery_narrowing_required':
    case 'verified_passed_ready_final':
    case 'post_mutation_verification_ready_final':
      return 'CAPABILITY_NUDGE'
    case 'idle':
      return 'RELAX_OR_REMOVE'
    default:
      return 'CAPABILITY_NUDGE'
  }
}

export function buildDsxuRecoveryGateState(
  recoveryState: DsxuRecoveryGateInput,
): DsxuQueryLoopGateState | null {
  if (recoveryState.state === 'idle') return null
  return {
    owner: 'query_loop',
    gateId: `dsxu_recovery_${recoveryState.state}`,
    gateKind: 'recovery',
    gateClass: getDsxuRecoveryGateClass(recoveryState),
    blocked: false,
    completionBlocked: !recoveryState.canClaimComplete,
    nextAction: recoveryState.requiredAction,
  }
}

export function buildDsxuFinalGateState(
  finalGateState: string | null,
): DsxuQueryLoopGateState | null {
  if (!finalGateState) return null

  switch (finalGateState) {
    case 'dsxu_empty_final_answer_gate':
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'final_response',
        gateClass: 'QUALITY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'emit_visible_final_answer',
      }
    case 'dsxu_intent_only_final_gate':
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'final_response',
        gateClass: 'RECOVERY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'perform_promised_action_or_report_no_action_taken',
      }
    case 'dsxu_unverified_mutation_final_gate':
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'final_response',
        gateClass: 'QUALITY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'run_or_report_post_mutation_verification',
      }
    case 'dsxu_agent_final_gate':
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'final_response',
        gateClass: 'QUALITY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'cite_complete_worker_evidence_or_mark_partial',
      }
    case 'dsxu_background_task_final_gate':
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'final_response',
        gateClass: 'RECOVERY_BLOCK',
        blocked: true,
        completionBlocked: true,
        nextAction: 'inspect_wait_or_report_background_task_status',
      }
    default:
      return {
        owner: 'query_loop',
        gateId: finalGateState,
        gateKind: 'recovery',
        gateClass: 'CAPABILITY_NUDGE',
        blocked: true,
        completionBlocked: true,
        nextAction: 'continue_with_gate_specific_recovery',
      }
  }
}

export function buildDsxuPhase6GateCloseAudit(): DsxuPhase6GateCloseAudit {
  const records: DsxuPhase6GateAuditRecord[] = [
    {
      gateId: 'dsxu_permission_safety_redline',
      owner: 'permission',
      gateClass: 'SAFETY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'destructive or secret-exfiltration permission actions deny',
    },
    {
      gateId: 'dsxu_permission_write_local',
      owner: 'permission',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'local mutation requires visible confirmation',
    },
    {
      gateId: 'dsxu_permission_visible_fallback_required',
      owner: 'permission',
      gateClass: 'RECOVERY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'hidden permission prompt must surface fallback or error',
    },
    {
      gateId: 'dsxu_read_cache_repeat_gate',
      owner: 'tool_lifecycle',
      gateClass: 'COST_SMELL',
      blocked: false,
      completionBlocked: false,
      disposition: 'advisory_nonblocking',
      evidence: 'cost smell is observed but does not stop mainline tool execution',
    },
    {
      gateId: 'dsxu_edit_budget_gate',
      owner: 'tool_lifecycle',
      gateClass: 'BENCH_CONTRACT_ONLY',
      blocked: false,
      completionBlocked: false,
      disposition: 'advisory_nonblocking',
      evidence: 'exact edit budget remains test-contract signal, not generic hard stop',
    },
    {
      gateId: 'dsxu_exact_edit_budget_verification_gate',
      owner: 'tool_lifecycle',
      gateClass: 'BENCH_CONTRACT_ONLY',
      blocked: false,
      completionBlocked: false,
      disposition: 'advisory_nonblocking',
      evidence: 'premature exact-edit verification is benchmark-contract-only outside specific harnesses',
    },
    {
      gateId: 'dsxu_repeated_semantic_tool_gate',
      owner: 'tool_lifecycle',
      gateClass: 'CAPABILITY_NUDGE',
      blocked: true,
      completionBlocked: true,
      disposition: 'local_tool_scheduling_block',
      evidence: 'only duplicate same-batch tool target is blocked; broader exploration can continue with a strategy change',
    },
    {
      gateId: 'dsxu_unsafe_batch_verification_gate',
      owner: 'tool_lifecycle',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'same-batch mutation plus verification would create stale verification evidence',
    },
    {
      gateId: 'dsxu_repeated_failed_verification_gate',
      owner: 'tool_lifecycle',
      gateClass: 'RECOVERY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'unchanged failing verification reruns require source repair or PARTIAL',
    },
    {
      gateId: 'dsxu_recovery_baseline_pass_pending_required_edit',
      owner: 'query_loop',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      completionBlocked: true,
      disposition: 'completion_block_retained',
      evidence: 'baseline pass can continue to required edit but cannot claim PASS',
    },
    {
      gateId: 'dsxu_recovery_agent_evidence_incomplete',
      owner: 'query_loop',
      gateClass: 'QUALITY_BLOCK',
      blocked: false,
      completionBlocked: true,
      disposition: 'completion_block_retained',
      evidence: 'incomplete worker evidence can continue with SendMessage/PARTIAL but cannot claim PASS',
    },
    {
      gateId: 'dsxu_recovery_permission_denied_replan',
      owner: 'query_loop',
      gateClass: 'RECOVERY_BLOCK',
      blocked: false,
      completionBlocked: true,
      disposition: 'completion_block_retained',
      evidence: 'permission denial requires safe replan before completion',
    },
    {
      gateId: 'dsxu_agent_final_gate',
      owner: 'query_loop',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: true,
      disposition: 'hard_block_retained',
      evidence: 'parent final must cite complete worker evidence or mark PARTIAL',
    },
    {
      gateId: 'dsxu_post_pass_tool_gate',
      owner: 'query_loop',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      completionBlocked: false,
      disposition: 'finalization_only',
      evidence: 'extra tools after verified pass are blocked, final answer is allowed',
    },
    {
      gateId: 'dsxu_post_pass_marker_gate',
      owner: 'query_loop',
      gateClass: 'BENCH_CONTRACT_ONLY',
      blocked: true,
      completionBlocked: false,
      disposition: 'finalization_only',
      evidence: 'PASS marker contract stops more tools but allows final marker output',
    },
  ]

  const violations = records.flatMap(record => {
    if (
      (record.gateClass === 'COST_SMELL' ||
        record.gateClass === 'BENCH_CONTRACT_ONLY') &&
      record.blocked &&
      record.completionBlocked
    ) {
      return [`${record.gateId}: cost/benchmark gate is still a generic hard blocker`]
    }
    if (
      (record.gateClass === 'SAFETY_BLOCK' ||
        record.gateClass === 'QUALITY_BLOCK' ||
        record.gateClass === 'RECOVERY_BLOCK') &&
      !record.blocked &&
      !record.completionBlocked
    ) {
      return [`${record.gateId}: safety/quality/recovery gate has no blocking effect`]
    }
    return []
  })

  const blockedHeavyEvidence = [
    'Heavy query/tool batch tests still hit existing generated alias resolution gaps such as src/services/analytics/index.js.',
    'Bun still prints EPERM while reading workspace/tsconfig paths in this sandbox, even when focused helper tests pass.',
  ]
  const phase12Residuals = [
    'Full product-window TUI replay and state-machine oracle remain Phase 12.',
    'Broad 22-case regression remains stage-close only.',
    'Dirty/untracked release packaging classification remains outside Phase 6.',
  ]

  return {
    status:
      violations.length === 0
        ? 'FOCUSED_CLOSED_PHASE12_RESIDUAL'
        : 'PARTIAL',
    focusedCloseAllowed: violations.length === 0,
    records,
    violations,
    blockedHeavyEvidence,
    phase12Residuals,
  }
}
