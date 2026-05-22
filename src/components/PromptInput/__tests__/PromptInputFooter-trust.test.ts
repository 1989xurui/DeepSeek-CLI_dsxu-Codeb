import { describe, expect, test } from 'bun:test'
import {
  buildDsxuTrustPanelLines,
  buildDsxuTrustStatusLine,
  compactDsxuTrustLine,
  limitDsxuTrustFooterLines,
} from '../PromptInputFooter'
import type { DsxuTrustState } from '../../../state/AppStateStore'

function trustState(overrides: Partial<DsxuTrustState> = {}): DsxuTrustState {
  return {
    schemaVersion: 'dsxu.trust-state.v1',
    updatedAt: 1,
    route: {
      model: 'deepseek-v4-flash',
      reason: 'ordinary-verification',
      workflowKind: 'bugfix',
      role: 'coder',
      estimatedCostUsd: 0.012345,
      cacheHitRatePct: 76.5,
    },
    verification: {
      state: 'pass',
      reason: 'latest verification passed',
    },
    recovery: {
      state: 'verified_passed_ready_final',
      requiredAction: 'final_answer',
      canClaimComplete: true,
      reason: 'latest verification passed',
    },
    finalClaim: {
      allowed: true,
      gateId: 'dsxu_final_usage_evidence',
      nextAction: 'visible_final_answer_or_next_user_task',
    },
    health: {
      status: 'ok',
      reason: 'final route/cost/cache evidence visible',
    },
    ...overrides,
  }
}

describe('buildDsxuTrustStatusLine', () => {
  test('renders compact route, verification, cost, and cache evidence', () => {
    const line = buildDsxuTrustStatusLine(trustState())

    expect(line?.text).toContain('DSXU: Flash')
    expect(line?.text).toContain('check:pass')
    expect(line?.text).not.toContain('claim')
    expect(line?.text).toContain('$0.0123')
    expect(line?.text).toContain('cache:77%')
    expect(line?.color).toBe('green')
  })

  test('surfaces blocked recovery as a visible warning line', () => {
    const line = buildDsxuTrustStatusLine(trustState({
      route: {
        model: 'deepseek-v4-flash',
        reason: 'failed_verification_flash_thinking_max',
        workflowKind: 'recovery',
        role: 'recovery',
        proAdmissionState: 'blocked_missing_evidence',
        proAdmissionReason: 'first failure remains Flash-MAX until repeated evidence exists',
        approvalRequired: false,
      },
      verification: {
        state: 'blocked',
        reason: 'dsxu_unverified_mutation_final_gate',
      },
      recovery: {
        state: 'edit_applied_needs_verification',
        requiredAction: 'verify',
        canClaimComplete: false,
        reason: 'source edit completed and needs verification',
      },
      finalClaim: {
        allowed: false,
        gateId: 'dsxu_unverified_mutation_final_gate',
        nextAction: 'run_or_report_post_mutation_verification',
      },
      health: {
        status: 'blocked',
        reason: 'final_gate_blocked',
      },
    }))

    expect(line?.text).toContain('check:block')
    expect(line?.text).toContain('pro:blocked')
    expect(line?.text).toContain('claim:block')
    expect(line?.text).toContain('health:blocked')
    expect(line?.color).toBe('yellow')
  })

  test('does not render before DSXU trust state exists', () => {
    expect(buildDsxuTrustStatusLine(undefined)).toBeNull()
  })
})

describe('buildDsxuTrustPanelLines', () => {
  test('renders live long-task ledger and agent evidence compact panels', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      ledger: {
        state: 'tool',
        taskId: 'turn-7',
        eventCount: 12,
        isResumable: true,
        isCompleted: false,
        resumePoint: 'tool',
        nextAction: 'verify',
        activeFrame: {
          status: 'ready',
          phase: 'execute',
          risk: 'medium',
          confirmedFactCount: 3,
          openObligationCount: 1,
          nextAllowedActions: ['tool:Bash', 'verify'],
          guardCount: 0,
        },
      },
      agent: {
        activeCount: 2,
        incompleteEvidence: true,
        runningCount: 2,
        completedCount: 0,
        failedCount: 0,
        scopes: ['Agent', 'verification'],
        verification: 'missing final task id/output/status evidence',
        risk: 'incomplete-evidence',
      },
    }))

    expect(lines.map(line => line.text).join('\n')).toContain('task:tool')
    expect(lines.map(line => line.text).join('\n')).toContain('events:12')
    expect(lines.map(line => line.text).join('\n')).toContain('frame:execute')
    expect(lines.map(line => line.text).join('\n')).toContain('open:1')
    expect(lines.map(line => line.text).join('\n')).toContain('agent:2')
    expect(lines.map(line => line.text).join('\n')).toContain('risk:incomplete-evidence')
  })

  test('hides idle ledger and inactive agent evidence rows', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      verification: {
        state: 'not_run',
        reason: 'no mutation yet',
      },
      ledger: {
        state: 'iteration_start',
        eventCount: 1,
        isResumable: false,
        isCompleted: false,
        nextAction: 'iteration_start',
      },
      agent: {
        activeCount: 0,
        runningCount: 0,
        completedCount: 0,
        failedCount: 0,
        incompleteEvidence: false,
        risk: 'none',
        verification: 'no active worker evidence required',
      },
    }))

    const text = lines.map(line => line.text).join('\n')
    expect(lines).toHaveLength(1)
    expect(text).toContain('check:wait')
    expect(text).not.toContain('task:')
    expect(text).not.toContain('agent:')
  })

  test('renders compact proof state without repeating long evidence lists', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      proof: {
        contract: {
          status: 'ready',
          taskType: 'single_file_edit',
          workflow: 'plan_execute_verify',
          risk: 'medium',
          model: 'deepseek-v4-flash',
          visibleToolCount: 5,
          verificationLevel: 'affected_tests',
          guardCount: 0,
        },
        tool: {
          status: 'review',
          readyConsumers: 1,
          requiredConsumers: 4,
          missingConsumers: ['ledger', 'final-report', 'release-evidence'],
          outputChars: 12000,
          boundary: 'provider_message',
        },
        runtime: {
          status: 'ready',
          presentKinds: 2,
          requiredKinds: 2,
          missingKinds: [],
        },
      },
    }))

    const proofLine = lines.find(line => line.text.startsWith('proof:'))
    expect(proofLine?.text).toContain('contract ok edit/flash')
    expect(proofLine?.text).toContain('tool review 1/4')
    expect(proofLine?.text).toContain('missing:ledger,final-report+1')
    expect(proofLine?.text).toContain('event ok 2/2')
    expect(proofLine?.text).not.toContain('release-evidence')
    expect((proofLine?.text.length ?? 0)).toBeLessThan(96)
  })

  test('caps long trust rows so terminal resize does not flood the chat area', () => {
    const longLine = compactDsxuTrustLine(
      'agent:4 | running:4 | failed:0 | scope:visible-state,tool-result,permission,evidence,release,benchmark,context,recovery | risk:incomplete-evidence',
      80,
    )

    expect(longLine.length).toBeLessThanOrEqual(80)
    expect(longLine.endsWith('...')).toBe(true)
  })

  test('limits visible trust footer rows on narrow or short terminals', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      ledger: {
        state: 'verify',
        eventCount: 14,
        isResumable: true,
        isCompleted: false,
        resumePoint: 'verify',
        nextAction: 'verify',
        activeFrame: {
          status: 'ready',
          phase: 'verify',
          risk: 'medium',
          confirmedFactCount: 3,
          openObligationCount: 1,
          nextAllowedActions: ['verify'],
          guardCount: 0,
        },
      },
      agent: {
        activeCount: 1,
        incompleteEvidence: true,
        runningCount: 1,
        completedCount: 0,
        failedCount: 0,
        risk: 'incomplete-evidence',
        verification: 'missing final worker evidence',
      },
      proof: {
        contract: {
          status: 'ready',
          taskType: 'debug',
          workflow: 'recovery',
          risk: 'high',
          model: 'deepseek-v4-flash',
          visibleToolCount: 16,
          verificationLevel: 'affected_tests',
          guardCount: 0,
        },
      },
    }))

    expect(lines.length).toBeGreaterThan(2)
    expect(limitDsxuTrustFooterLines(lines, { columns: 72, rows: 32, fullscreen: false })).toHaveLength(2)
    expect(limitDsxuTrustFooterLines(lines, { columns: 120, rows: 20, fullscreen: true })).toHaveLength(1)
    expect(limitDsxuTrustFooterLines(lines, { columns: 120, rows: 40, fullscreen: false })).toHaveLength(3)
    expect(limitDsxuTrustFooterLines(lines, { columns: 140, rows: 34, fullscreen: true })).toHaveLength(4)
    expect(limitDsxuTrustFooterLines(lines, { columns: 140, rows: 34, fullscreen: true }).at(-1)?.text).toStartWith('proof:')
  })
})
