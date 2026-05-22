import { describe, expect, test } from 'bun:test'
import {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
} from '../action-contract'

describe('V8 Chinese intent classifier contract', () => {
  test('keeps Chinese ledger resume work on the long-task owner instead of debug', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-cn-long-task',
      userRequest: '\u7ee7\u7eed\u4e0a\u4e00\u4e2a\u957f\u671f\u4efb\u52a1\uff0c\u6309\u8d26\u672c\u6062\u590d\uff0c\u4fee\u6539\u4ee3\u7801\u5e76\u8fd0\u884c\u6d4b\u8bd5\u9a8c\u8bc1',
      sourceEvidenceCount: 3,
      now: 1,
    })

    expect(contract.taskType).toBe('long_task')
    expect(contract.workflow).toBe('long_task')
    expect(contract.requiresAgentEvidence).toBe(true)
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(16)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('classifies Chinese benchmark evidence work as benchmark with no public claim by default', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-cn-benchmark',
      userRequest: '\u8fd0\u884c\u57fa\u51c6\u8bc4\u4f30\uff0c\u8f93\u51fa\u8bc1\u636e\u4eea\u8868\u76d8\u548c\u901a\u8fc7\u5931\u8d25\u8bc1\u660e',
      benchmarkIntent: true,
      now: 2,
    })

    expect(contract.taskType).toBe('benchmark')
    expect(contract.workflow).toBe('plan_execute_verify')
    expect(contract.verificationLevel).toBe('full')
    expect(contract.claimPolicy).toBe('no_claim')
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(18)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('prioritizes Chinese multi-file refactor over search-only when references are requested', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-cn-refactor',
      userRequest: '\u591a\u6587\u4ef6\u91cd\u6784\uff0c\u4f7f\u7528 LSP \u67e5\u5f15\u7528\u5e76\u8dd1\u6d4b\u8bd5',
      sourceEvidenceCount: 2,
      now: 3,
    })

    expect(contract.taskType).toBe('multi_file_refactor')
    expect(contract.workflow).toBe('plan_execute_verify')
    expect(contract.verificationLevel).toBe('full')
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(16)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('honors Chinese no-edit explain requests instead of triggering edit workflow', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-cn-explain',
      userRequest: '\u89e3\u91ca\u4e00\u4e0b\u8fd9\u4e2a\u6587\u4ef6\u7684\u903b\u8f91\uff0c\u4e0d\u8981\u4fee\u6539\u4ee3\u7801',
      now: 4,
    })

    expect(contract.taskType).toBe('explain')
    expect(contract.workflow).toBe('observe')
    expect(contract.requiresSourceEvidence).toBe(false)
    expect(contract.verificationLevel).toBe('none')
    expect(contract.visibleTools.length).toBeLessThanOrEqual(8)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })

  test('keeps Chinese permission/security/release work critical and claim-blocked', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-cn-critical',
      userRequest: '\u5ba1\u6838\u53d1\u5e03\u58f0\u660e\u3001\u6743\u9650\u3001\u5b89\u5168\u548c\u79d8\u94a5\u98ce\u9669',
      sourceEvidenceCount: 1,
      now: 5,
    })

    expect(contract.risk).toBe('critical')
    expect(contract.claimPolicy).toBe('no_claim')
    expect(contract.verificationLevel).toBe('full')
    expect(contract.routeDecision.approvalRequired).toBe(true)
    expect(validateDSXUExecutionContract(contract).valid).toBe(true)
  })
})
