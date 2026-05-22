import { describe, expect, test } from 'bun:test'
import {
  compileDSXUExecutionContract,
  projectDSXUExecutionContractToLedgerEvent,
  validateDSXUExecutionContract,
} from '../action-contract'

describe('V6 Task Contract Compiler', () => {
  test('compiles search-only work into a low-risk Flash non-thinking contract', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v6-search-contract',
      userRequest: 'Search for references to the DeepSeek route policy owner before editing.',
      sourceEvidenceCount: 2,
      now: 100,
    })

    expect(contract.taskType).toBe('search')
    expect(contract.risk).toBe('low')
    expect(contract.workflow).toBe('observe')
    expect(contract.modelRoute).toBe('flash')
    expect(contract.routeDecision.apiMode).toBe('non_thinking')
    expect(contract.routeDecision.reason).toBe('lightweight_flash_non_thinking')
    expect(contract.verificationLevel).toBe('none')
    expect(contract.requiresSourceEvidence).toBe(true)
    expect(contract.visibleTools.length).toBeLessThanOrEqual(12)
    expect(contract.visibleTools).toEqual(expect.arrayContaining(['Grep', 'Glob', 'Read']))
    expect(validateDSXUExecutionContract(contract)).toMatchObject({
      valid: true,
      missingFields: [],
      violations: [],
    })
  })

  test('rejects malformed contracts before execution', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v6-malformed-contract',
      userRequest: 'Explain the current query loop.',
      now: 101,
    })
    const malformed = {
      ...contract,
      contractId: '',
      visibleTools: [],
      routeDecision: {
        ...contract.routeDecision,
        reason: undefined as never,
      },
    }

    const validation = validateDSXUExecutionContract(malformed)
    expect(validation.valid).toBe(false)
    expect(validation.missingFields).toEqual(
      expect.arrayContaining(['contractId', 'visibleTools', 'routeDecision.reason']),
    )
  })

  test('projects route and claim policy into the long-task ledger event', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v6-ledger-contract',
      userRequest: 'Fix a failed verification in one source file and rerun affected tests.',
      workspaceSignals: {
        changedFiles: ['src/dsxu/engine/query-loop.ts'],
        hasPackageJson: true,
      },
      priorFailureCount: 1,
      sourceEvidenceCount: 3,
      now: 102,
    })

    const ledgerEvent = projectDSXUExecutionContractToLedgerEvent(contract)
    expect(ledgerEvent.kind).toBe('task_contract')
    expect(ledgerEvent.owner).toBe('Query Loop / PlanGraph / Tool Gate')
    expect(ledgerEvent.evidence?.join('\n')).toContain(`route:${contract.routeDecision.reason}`)
    expect(ledgerEvent.evidence?.join('\n')).toContain(`claimPolicy:${contract.claimPolicy}`)
    expect(ledgerEvent.metadata?.executionContract).toMatchObject({
      contractId: contract.contractId,
      routeDecision: contract.routeDecision,
    })
  })

  test('keeps high and critical work out of Flash-only verified-final execution', () => {
    const high = compileDSXUExecutionContract({
      taskId: 'v6-high-risk-contract',
      userRequest: 'Refactor the provider runtime and model cost route across multiple files.',
      workspaceSignals: {
        changedFiles: [
          'src/services/api/deepseek-adapter.ts',
          'src/utils/model/deepseekV4Control.ts',
        ],
      },
      riskTags: ['provider'],
      sourceEvidenceCount: 2,
      now: 103,
    })
    expect(high.risk).toBe('high')
    expect(high.modelRoute).not.toBe('flash')
    expect(high.verificationLevel).toBe('full')
    expect(validateDSXUExecutionContract(high).valid).toBe(true)

    const critical = compileDSXUExecutionContract({
      taskId: 'v6-critical-contract',
      userRequest: 'Prepare a public release benchmark claim and delete old evidence.',
      publicClaimIntent: true,
      deleteIntent: true,
      riskTags: ['release', 'delete'],
      now: 104,
    })
    expect(critical.risk).toBe('critical')
    expect(critical.modelRoute).toBe('pro')
    expect(critical.routeDecision.approvalRequired).toBe(true)
    expect(critical.claimPolicy).toBe('no_claim')
    expect(validateDSXUExecutionContract(critical).valid).toBe(true)
  })
})
