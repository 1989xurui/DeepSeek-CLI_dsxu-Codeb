import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildDSXUActionContract,
  classifyDSXUWriteOperationComplexity,
  compileDSXUExecutionContract,
  evaluateDSXUActionContractScope,
  projectDSXUExecutionContractToLedgerEvent,
  projectDSXUActionContractToWorkStateEvent,
  validateDSXUActionContract,
  validateDSXUExecutionContract,
} from '../action-contract'
import { evaluateProductCoreGuard } from '../workspace-policy'

describe('DSXU Action Contract v2', () => {
  test('compiles V5 execution contracts before model/tool execution', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v5-task-compiler',
      userRequest: 'Fix one TypeScript bug in src/cart.ts and run affected tests.',
      workspaceSignals: {
        changedFiles: ['src/cart.ts'],
        hasPackageJson: true,
      },
      sourceEvidenceCount: 1,
      now: 10,
    })

    expect(contract.schemaVersion).toBe('dsxu.execution-contract.v5')
    expect(contract.owner).toBe('Query Loop / PlanGraph / Tool Gate')
    expect(contract.taskType).toBe('debug')
    expect(contract.risk).toBe('medium')
    expect(contract.workflow).toBe('recovery')
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(12)
    expect(contract.visibleTools.length).toBeLessThanOrEqual(24)
    expect(contract.requiresSourceEvidence).toBe(true)
    expect(contract.verificationLevel).toBe('affected_tests')
    expect(validateDSXUExecutionContract(contract)).toMatchObject({
      valid: true,
      missingFields: [],
      violations: [],
    })
  })

  test('keeps public benchmark and release claim work blocked from final claims', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'release-claim',
      userRequest: 'Prepare a public benchmark release claim with source/test/raw evidence.',
      publicClaimIntent: true,
      benchmarkIntent: true,
      riskTags: ['release', 'public-claim'],
      priorFailureCount: 2,
      sourceEvidenceCount: 0,
      now: 11,
    })
    const ledgerEvent = projectDSXUExecutionContractToLedgerEvent(contract)

    expect(contract.risk).toBe('critical')
    expect(contract.verificationLevel).toBe('full')
    expect(contract.claimPolicy).toBe('no_claim')
    expect(contract.fallbackPolicy).toBe('ask_user')
    expect(contract.routeDecision.approvalRequired).toBe(true)
    expect(ledgerEvent.kind).toBe('task_contract')
    expect(ledgerEvent.evidence?.join('\n')).toContain('claimPolicy:no_claim')
  })

  test('classifies low-risk single-file edits separately from high-risk runtime work', () => {
    expect(
      classifyDSXUWriteOperationComplexity({
        toolName: 'Edit',
        filePaths: ['src/cart.ts'],
        riskTags: [],
      }),
    ).toMatchObject({
      riskLevel: 'low',
      requiresActionContract: false,
    })

    const highRisk = classifyDSXUWriteOperationComplexity({
      toolName: 'Agent',
      filePaths: ['src/query.ts', 'src/tools.ts'],
      riskTags: ['permission', 'tool'],
    })
    expect(highRisk.riskLevel).toBe('high')
    expect(highRisk.requiresActionContract).toBe(true)
    expect(highRisk.reasons.join('\n')).toContain('multi-file write scope')
    expect(highRisk.reasons.join('\n')).toContain('high-risk tag:permission')
  })

  test('requires goal, scope, next tool, verification, and fallback before guarded writes', () => {
    const contract = buildDSXUActionContract({
      goal: 'Patch tool gate evidence',
      allowedFiles: [join(tmpdir(), 'project', 'src', 'tools.ts')],
      nextTool: 'Edit',
      verificationCommand: [
        'bun',
        'test',
        'src/tools/__tests__/tool-registry-simple-mode.test.ts',
      ],
      fallbackPlan: 'Revert the local patch candidate and report blocked scope.',
      riskLevel: 'medium',
      now: 1,
    })

    expect(validateDSXUActionContract(contract)).toEqual({
      valid: true,
      missingFields: [],
      violations: [],
    })
    expect(contract.owner).toBe('Tool Gate')
  })

  test('blocks write targets outside the declared scope fence', () => {
    const root = resolve(tmpdir(), 'contract-project')
    const contract = buildDSXUActionContract({
      goal: 'Update one owner file',
      allowedFiles: [join(root, 'src', 'owner.ts')],
      nextTool: 'Edit',
      verificationCommand: ['bun', 'test', 'src/owner.test.ts'],
      fallbackPlan: 'Refresh scope before touching another owner.',
      riskLevel: 'medium',
      now: 2,
    })

    const allowed = evaluateDSXUActionContractScope({
      contract,
      targetPath: join(root, 'src', 'owner.ts'),
      action: 'write',
    })
    expect(allowed).toMatchObject({
      decision: 'allow',
      gateDecision: 'require_confirmation',
      executionDecision: 'execute_guarded',
    })

    const blocked = evaluateDSXUActionContractScope({
      contract,
      targetPath: join(root, 'src', 'other-owner.ts'),
      action: 'write',
    })
    expect(blocked).toMatchObject({
      decision: 'block',
      gateDecision: 'block',
      executionDecision: 'deny',
    })
    expect(blocked.reason).toContain('outside')
  })

  test('lets Product Core Guard dominate the contract decision', () => {
    const root = resolve(tmpdir(), 'dsxu-core')
    const contract = buildDSXUActionContract({
      goal: 'Mutate product core',
      allowedFiles: [root],
      nextTool: 'Write',
      verificationCommand: ['bun', 'test'],
      fallbackPlan: 'Request owner signoff.',
      riskLevel: 'critical',
      now: 3,
    })
    const productCoreGuard = evaluateProductCoreGuard({
      path: join(root, 'src', 'query.ts'),
      action: 'write',
      protectedRoots: [root],
    })

    const decision = evaluateDSXUActionContractScope({
      contract,
      targetPath: join(root, 'src', 'query.ts'),
      action: 'write',
      productCoreGuard,
    })

    expect(decision.decision).toBe('block')
    expect(decision.evidence.join('\n')).toContain('productCoreGuard:')
  })

  test('projects Action Contract scope evidence into visible-state permission events', () => {
    const root = resolve(tmpdir(), 'visible-contract')
    const contract = buildDSXUActionContract({
      goal: 'Patch visible-state owner',
      allowedFiles: [join(root, 'src', 'visible.ts')],
      nextTool: 'Edit',
      verificationCommand: ['bun', 'test', 'src/visible.test.ts'],
      fallbackPlan: 'Stop and refresh scope.',
      riskLevel: 'medium',
      now: 4,
    })
    const decision = evaluateDSXUActionContractScope({
      contract,
      targetPath: join(root, 'src', 'visible.ts'),
      action: 'write',
    })
    const event = projectDSXUActionContractToWorkStateEvent(contract, decision)

    expect(event.kind).toBe('permission')
    expect(event.owner).toBe('Tool Gate')
    expect(event.permissionDecision).toBe('granted')
    expect(event.gateDecision).toBe('require_confirmation')
    expect(event.evidence?.join('\n')).toContain('contract:')
  })
})
