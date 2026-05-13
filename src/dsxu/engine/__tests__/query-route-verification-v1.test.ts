import { describe, expect, test } from 'bun:test'
import {
  buildDeepSeekRouteText,
  buildDsxuVerificationPassNudge,
  getLatestRequestedDsxuBenchPassMarker,
  hasDsxuVerificationFailure,
  shouldEscalateDeepSeekRouteAfterTransition,
} from '../../../query'
import {
  decideDeepSeekV4Route,
  inferDeepSeekV4RouteInput,
} from '../../../utils/model/deepseekV4Control'

function toolResult(text: string) {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call-test',
          content: text,
        },
      ],
    },
  } as any
}

describe('query route verification escalation V1', () => {
  test('does not treat an expected baseline failing test as failed verification for model routing', () => {
    const baselineFailure = toolResult([
      'Exit code 1',
      'bun test v1.3.11',
      '0 pass',
      '1 fail',
      'SyntaxError: Export named slugify not found',
    ].join('\n'))

    expect(hasDsxuVerificationFailure([baselineFailure])).toBe(false)
  })

  test('does escalate after an edit has been applied and verification fails', () => {
    const editApplied = toolResult([
      'The file src/strings.js has been updated successfully.',
      'DSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
    ].join('\n'))
    const failedPostEditVerification = toolResult([
      'Exit code 1',
      'bun test v1.3.11',
      '1 pass',
      '1 fail',
      'AssertionError: expected value to match',
    ].join('\n'))

    expect(hasDsxuVerificationFailure([
      editApplied,
      failedPostEditVerification,
    ])).toBe(true)
  })

  test('does not keep Pro recovery routing after a failed verification is repaired and passed', () => {
    const editApplied = toolResult([
      'The file src/strings.js has been updated successfully.',
      'DSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
    ].join('\n'))
    const failedPostEditVerification = toolResult([
      'Exit code 1',
      'DSXU tool state: verification_failed; semanticTool=RunNativeTest; next=repair_source.',
      'AssertionError: expected value to match',
    ].join('\n'))
    const repairApplied = toolResult([
      'The file src/strings.js has been updated successfully.',
      'DSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
    ].join('\n'))
    const verifiedPass = toolResult([
      '2 pass',
      '0 fail',
      'DSXU tool state: verification_passed; semanticTool=RunNativeTest; next=final_answer.',
    ].join('\n'))

    expect(hasDsxuVerificationFailure([
      editApplied,
      failedPostEditVerification,
      repairApplied,
      verifiedPass,
    ])).toBe(false)
  })

  test('does not let PASS evidence scope names reactivate failed verification routing', () => {
    const editApplied = toolResult([
      'The file src/strings.js has been updated successfully.',
      'DSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
    ].join('\n'))
    const failedPostEditVerification = toolResult([
      'Exit code 1',
      'DSXU tool state: verification_failed; semanticTool=RunNativeTest; next=repair_source.',
      'AssertionError: expected value to match',
    ].join('\n'))
    const verifiedPass = toolResult([
      'RunNativeTest status: pass',
      'decision=source_changed_after_failed_native_verification',
      '2 pass',
      '0 fail',
      'DSXU tool state: verification_passed; semanticTool=RunNativeTest; next=collect_evidence_before_final_or_final_now.',
    ].join('\n'))
    const evidencePass = toolResult([
      'CollectEvidence status: PASS',
      'scope=mutation-multifile-bugfix-second-failure-live',
      'latest=native_test exit=0 signal=RunNativeTest status: pass',
      '2 pass',
      '0 fail',
      'DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=final_answer.',
    ].join('\n'))

    expect(hasDsxuVerificationFailure([
      editApplied,
      failedPostEditVerification,
      verifiedPass,
      evidencePass,
    ])).toBe(false)
  })

  test('does not treat normal continuation gates as Pro recovery routing', () => {
    expect(shouldEscalateDeepSeekRouteAfterTransition(undefined)).toBe(false)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'next_turn',
    } as any)).toBe(false)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'dsxu_intent_only_final_gate',
    } as any)).toBe(false)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'dsxu_execution_visibility_gate',
    } as any)).toBe(false)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'token_budget_continuation',
    } as any)).toBe(false)
  })

  test('keeps real recovery transitions on Pro routing', () => {
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'max_output_tokens_recovery',
    } as any)).toBe(true)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'reactive_compact_retry',
    } as any)).toBe(true)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'stop_hook_blocking',
    } as any)).toBe(true)
    expect(shouldEscalateDeepSeekRouteAfterTransition({
      reason: 'dsxu_agent_final_gate',
    } as any)).toBe(true)
  })

  test('route text ignores tool results so verification contracts do not pollute workflow kind', () => {
    const userTask = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Add the missing slugify helper to src/strings.js.',
          },
        ],
      },
    } as any
    const verificationPass = toolResult([
      '2 pass',
      '0 fail',
      'DSXU verified-pass stop contract: this verification passed and no failing assertion remains.',
      'DSXU tool state: verification_passed; blocked=rerun_same_command,more_tools_after_pass; next=final_answer.',
    ].join('\n'))
    const metaCursor = {
      type: 'user',
      isMeta: true,
      message: {
        role: 'user',
        content: 'DSXU recovery cursor: failed verification baseline details are available in tool state.',
      },
    } as any

    const routeText = buildDeepSeekRouteText([userTask, verificationPass, metaCursor])
    const routeInput = inferDeepSeekV4RouteInput(routeText, {
      initialPlanningTurn: false,
    })

    expect(routeText).toContain('slugify helper')
    expect(routeText).not.toContain('0 fail')
    expect(routeInput.workflowKind).toBe('feature')
    expect(decideDeepSeekV4Route(routeInput).model).toBe('deepseek-v4-flash')
  })

  test('verified-pass nudge carries exact benchmark marker for final answer hard gate', () => {
    const userTask = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Fix the fixture and finish with DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS only after bun test passes.',
          },
        ],
      },
    } as any

    expect(getLatestRequestedDsxuBenchPassMarker([userTask])).toBe(
      'DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS',
    )
    expect(buildDsxuVerificationPassNudge([userTask])).toContain(
      'Your next assistant response must be exactly DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS and nothing else',
    )
  })
})
