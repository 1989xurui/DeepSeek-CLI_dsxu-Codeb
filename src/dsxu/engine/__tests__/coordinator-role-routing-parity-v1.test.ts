import { describe, expect, test } from 'bun:test'
import { createCoordinatorV1 } from '../coordinator-v1'
import {
  AGENT_ROLE_CONFIGS,
  DSXU_PARITY_RULES,
  RISK_BASED_RULES,
  VERIFICATION_BASED_RULES,
  applyRoleSelectionRules,
  createEnhancedRoleRouting,
  recommendRoleForTask,
} from '../coordinator-types-v1'

describe('Coordinator Role Routing Parity V1', () => {
  test('DSXU coordinator exports a structured routing result', () => {
    const routing = createEnhancedRoleRouting(
      'structured routing task',
      'verify DSXU role routing output shape',
    )

    expect(routing).toHaveProperty('decision')
    expect(routing).toHaveProperty('taskPlan')
    expect(routing).toHaveProperty('timestamp')
    expect(routing.decision.roleAssignments.length).toBeGreaterThan(0)
    expect(routing.taskPlan.subtasks.length).toBeGreaterThan(0)
  })

  test('role semantics are configuration-backed, not display-only labels', () => {
    expect(AGENT_ROLE_CONFIGS.implementer.capabilities).toContain('edit')
    expect(AGENT_ROLE_CONFIGS.verifier.capabilities).toContain('test')
    expect(AGENT_ROLE_CONFIGS.coordinator.capabilities).toContain('route')
  })

  test('role recommendation and rule application stay callable', () => {
    expect(recommendRoleForTask('research')).toBe('researcher')
    expect(recommendRoleForTask('verification')).toBe('verifier')

    const roles = applyRoleSelectionRules(
      {
        type: 'implementation',
        riskProfile: { riskLevel: 'high' },
        validationRequirement: { level: 'strict' },
      },
      [...DSXU_PARITY_RULES, ...RISK_BASED_RULES, ...VERIFICATION_BASED_RULES],
    )

    expect(roles).toBeInstanceOf(Array)
    expect(roles.length).toBeGreaterThan(0)
  })

  test('CoordinatorV1 remains the mainline constructor', () => {
    const coordinator = createCoordinatorV1()
    const plan = coordinator.createForkPlan(
      'mainline-coordinator-task',
      [
        {
          branchId: 'research',
          role: 'explorer',
          goal: 'inspect context',
          accessMode: 'read-only',
        },
      ],
      {
        strategy: 'parallel',
        writeBranchConstraint: 'single-writer',
        mergePolicy: 'coordinator-review',
      },
    )

    expect(plan.taskId).toBe('mainline-coordinator-task')
    expect(plan.branches[0].role).toBe('explorer')
    expect(typeof coordinator.dispatchFork).toBe('function')
    expect(typeof coordinator.collectIntermediateResult).toBe('function')
  })
})
