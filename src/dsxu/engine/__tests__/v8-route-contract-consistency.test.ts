import { describe, expect, test } from 'bun:test'
import {
  decideDeepSeekV4Route,
  inferDeepSeekV4WorkflowKind,
} from '../../../utils/model/deepseekV4Control'
import {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
} from '../action-contract'

describe('V8 route-contract-tool-window consistency', () => {
  test('Chinese benchmark routes to verification and keeps benchmark contract/tool window aligned', () => {
    const request = '\u8fd0\u884c\u57fa\u51c6\u8bc4\u4f30\uff0c\u8f93\u51fa\u8bc1\u636e\u4eea\u8868\u76d8\u548c\u901a\u8fc7\u5931\u8d25\u8bc1\u660e'
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-route-benchmark',
      userRequest: request,
      benchmarkIntent: true,
      now: 20,
    })

    expect(inferDeepSeekV4WorkflowKind(request)).toBe('verification')
    expect(contract.taskType).toBe('benchmark')
    expect(contract.routeDecision.reason).toMatch(/verification|high_risk|planning|review|failed_verification/)
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(18)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('Chinese multi-file refactor routes to planning and exposes refactor-grade tools', () => {
    const request = '\u591a\u6587\u4ef6\u91cd\u6784\uff0c\u4f7f\u7528 LSP \u67e5\u5f15\u7528\u5e76\u8dd1\u6d4b\u8bd5'
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-route-refactor',
      userRequest: request,
      sourceEvidenceCount: 4,
      now: 21,
    })

    expect(inferDeepSeekV4WorkflowKind(request)).toBe('planning')
    expect(contract.taskType).toBe('multi_file_refactor')
    expect(contract.workflow).toBe('plan_execute_verify')
    expect(contract.visibleTools).toEqual(expect.arrayContaining(['Read', 'Grep', 'LSP', 'Edit', 'RunNativeTest']))
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('Chinese no-edit explain routes to repo understanding and stays observe-only', () => {
    const request = '\u89e3\u91ca\u4e00\u4e0b\u8fd9\u4e2a\u6587\u4ef6\u7684\u903b\u8f91\uff0c\u4e0d\u8981\u4fee\u6539\u4ee3\u7801'
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-route-explain',
      userRequest: request,
      now: 22,
    })

    expect(inferDeepSeekV4WorkflowKind(request)).toBe('repo_understanding')
    expect(contract.taskType).toBe('explain')
    expect(contract.workflow).toBe('observe')
    expect(contract.visibleTools).not.toEqual(expect.arrayContaining(['Edit', 'Write']))
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('failed verification uses Flash-MAX first and only admits Pro after repeated evidence', () => {
    const firstFailure = decideDeepSeekV4Route({
      workflowKind: 'recovery',
      role: 'recovery',
      failedVerification: true,
      retryAfterFailure: true,
      priorFlashAttempted: true,
      savedTaskEvidence: true,
      allowProAdmission: false,
    })
    expect(firstFailure.model).toBe('deepseek-v4-flash')
    expect(firstFailure.reason).toBe('failed_verification_flash_thinking_max')
    expect(firstFailure.proAdmission?.state).toBe('blocked_missing_evidence')

    const repeatedFailure = decideDeepSeekV4Route({
      workflowKind: 'recovery',
      role: 'recovery',
      failedVerification: true,
      retryAfterFailure: true,
      priorFlashAttempted: true,
      savedTaskEvidence: true,
      allowProAdmission: true,
    })
    expect(repeatedFailure.model).toBe('deepseek-v4-pro')
    expect(repeatedFailure.reason).toBe('failed_verification_pro_thinking_max')
    expect(repeatedFailure.proAdmission?.state).toBe('admitted')
  })
})
