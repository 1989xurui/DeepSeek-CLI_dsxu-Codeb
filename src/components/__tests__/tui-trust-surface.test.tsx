import { describe, expect, test } from 'bun:test'
import {
  buildDsxuTrustPanelLines,
  buildDsxuTrustStatusLine,
  compactDsxuTrustLine,
} from '../PromptInput/PromptInputFooter'
import type { DsxuTrustState } from '../../state/AppStateStore'

function trustState(overrides: Partial<DsxuTrustState> = {}): DsxuTrustState {
  return {
    schemaVersion: 'dsxu.trust-state.v1',
    updatedAt: 1,
    route: {
      model: 'deepseek-v4-flash',
      reason: 'v6-tui-trust',
      workflowKind: 'coding',
      role: 'coder',
      estimatedCostUsd: 0.0003,
      cacheHitRatePct: 93,
    },
    verification: {
      state: 'pass',
      reason: 'focused verification passed',
      command: 'bun test src/components/__tests__/tui-trust-surface.test.tsx',
    },
    recovery: {
      state: 'verified_passed_ready_final',
      requiredAction: 'final_answer',
      canClaimComplete: true,
      reason: 'verification proof is attached',
    },
    finalClaim: {
      allowed: true,
      gateId: 'dsxu_v6_tui_trust_surface',
      nextAction: 'visible_final_answer_or_next_user_task',
    },
    health: {
      status: 'ok',
      reason: 'trust surface evidence visible',
    },
    ...overrides,
  }
}

describe('V6 TUI trust surface', () => {
  test('renders route, verification, claim, ledger, cost/cache, and agent evidence as compact status lines', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      ledger: {
        state: 'verify',
        taskId: 'v6-tui-trust',
        eventCount: 8,
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
          nextAllowedActions: ['record_evidence', 'final_gate'],
          guardCount: 0,
        },
      },
      agent: {
        activeCount: 1,
        runningCount: 1,
        completedCount: 0,
        failedCount: 0,
        incompleteEvidence: false,
        scopes: ['verification'],
        verification: 'worker evidence envelope cited',
        risk: 'compact',
      },
    }))
    const rendered = lines.map(line => compactDsxuTrustLine(line.text, 80))
    const text = rendered.join('\n')

    expect(rendered.every(line => line.length <= 80)).toBe(true)
    expect(text).toContain('DSXU: Flash')
    expect(text).toContain('check:pass')
    expect(text).toContain('$0.0003')
    expect(text).toContain('cache:93%')
    expect(text).toContain('task:verify')
    expect(text).toContain('open:1')
    expect(text).toContain('agent:1')
  })

  test('uses ASCII/English state tokens by default so CJK width does not break the footer', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      finalClaim: {
        allowed: false,
        gateId: 'dsxu_unverified_mutation_final_gate',
        nextAction: 'run_or_report_post_mutation_verification',
      },
      verification: {
        state: 'blocked',
        reason: 'mutation requires focused verification',
      },
      health: {
        status: 'blocked',
        reason: 'final claim blocked',
      },
    }))
    const text = lines.map(line => line.text).join('\n')

    expect(text).toContain('claim:block')
    expect(text).toContain('check:block')
    expect(/[\u3400-\u9fff]/.test(text)).toBe(false)
  })

  test('does not show completion when verification has not run', () => {
    const line = buildDsxuTrustStatusLine(trustState({
      verification: {
        state: 'not_run',
        reason: 'no verification evidence yet',
      },
      recovery: {
        state: 'edit_applied_needs_verification',
        requiredAction: 'verify',
        canClaimComplete: false,
        reason: 'edit requires proof',
      },
      finalClaim: {
        allowed: false,
        gateId: 'dsxu_unverified_mutation_final_gate',
        nextAction: 'verify',
      },
    }))

    expect(line?.text).toContain('check:wait')
    expect(line?.text).toContain('claim:block')
    expect(line?.color).toBe('yellow')
    expect(line?.text).not.toContain('check:pass')
  })

  test('keeps proof rows short and traceable instead of repeating evidence lists', () => {
    const lines = buildDsxuTrustPanelLines(trustState({
      proof: {
        contract: {
          status: 'ready',
          taskType: 'single_file_edit',
          workflow: 'plan_execute_verify',
          risk: 'medium',
          model: 'deepseek-v4-flash',
          visibleToolCount: 6,
          verificationLevel: 'affected_tests',
          guardCount: 0,
        },
        tool: {
          status: 'review',
          readyConsumers: 2,
          requiredConsumers: 5,
          missingConsumers: ['ledger', 'final-report', 'release-evidence', 'dashboard'],
          outputChars: 18_000,
          boundary: 'provider_message',
        },
        runtime: {
          status: 'ready',
          presentKinds: 6,
          requiredKinds: 6,
          missingKinds: [],
        },
      },
    }))
    const proofLine = lines.find(line => line.text.startsWith('proof:'))

    expect(proofLine?.text).toContain('contract ok edit/flash')
    expect(proofLine?.text).toContain('tool review 2/5')
    expect(proofLine?.text).toContain('missing:ledger,final-report+2')
    expect(proofLine?.text).not.toContain('release-evidence')
    expect(compactDsxuTrustLine(proofLine?.text ?? '', 80).length).toBeLessThanOrEqual(80)
  })
})
