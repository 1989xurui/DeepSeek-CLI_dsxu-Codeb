import { describe, expect, test } from 'bun:test'
import { resolveDSXUAgentOrchestration } from '../agent-role-router-v1'

describe('Agent orchestration mode V1', () => {
  test('reduces independent read-only work to parallel fanout with evidence gates', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'inspect frontend and backend auth risks',
      requestedMode: 'swarm debate panel',
      maxParallel: 3,
      workItems: [
        {
          taskId: 'agent-read-ui',
          objective: 'Inspect UI auth files and report risks only.',
          readOnly: true,
          ownedFiles: ['src/ui/auth.tsx'],
          role: 'researcher',
        },
        {
          taskId: 'agent-read-api',
          objective: 'Inspect API auth files and report risks only.',
          readOnly: true,
          ownedFiles: ['src/api/auth.ts'],
          role: 'researcher',
        },
      ],
    })

    expect(plan.visibleMode).toBe('parallel_fanout')
    expect(plan.maxWorkers).toBe(2)
    expect(plan.evidence.visibleModes).toEqual(['serial_worker', 'parallel_fanout'])
    expect(plan.evidence.runtimePlacementsAreNotPlanningModes).toBe(true)
    expect(plan.warnings[0]).toContain('unsupported agent mode')
    expect(plan.parentFinalGate.join('\n')).toContain('parent final must cite worker evidence')
    expect(plan.parentFinalGate.join('\n')).toContain('partial worker evidence cannot be promoted to PASS')
    expect(plan.workerBriefs[0]).toContain('mode=read-only')
  })

  test('downgrades overlapping write work to serial worker', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'fix checkout service and checkout tests',
      requestedMode: 'parallel',
      workItems: [
        {
          taskId: 'agent-checkout-service',
          objective: 'Patch checkout service.',
          readOnly: false,
          ownedFiles: ['src/checkout'],
          role: 'implementer',
        },
        {
          taskId: 'agent-checkout-test',
          objective: 'Patch checkout regression tests.',
          readOnly: false,
          ownedFiles: ['src/checkout/service.ts'],
          role: 'implementer',
        },
      ],
    })

    expect(plan.visibleMode).toBe('serial_worker')
    expect(plan.maxWorkers).toBe(1)
    expect(plan.evidence.hasWriteConflict).toBe(true)
    expect(plan.reasons).toContain('overlapping write scopes block parallel fanout')
    expect(plan.reasons).toContain('requested mode normalized to serial_worker')
    expect(plan.workerBriefs.every(brief => brief.includes('mode=write-owned'))).toBe(true)
  })

  test('keeps disjoint owned implementation as parallel fanout but still requires parent evidence citation', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'implement independent settings and profile fixes',
      requestedMode: 'parallel',
      workItems: [
        {
          taskId: 'agent-settings',
          objective: 'Patch settings form and run focused tests.',
          readOnly: false,
          ownedFiles: ['src/settings/Form.tsx'],
          role: 'implementer',
        },
        {
          taskId: 'agent-profile',
          objective: 'Patch profile card and run focused tests.',
          readOnly: false,
          ownedFiles: ['src/profile/Card.tsx'],
          role: 'implementer',
        },
      ],
    })

    expect(plan.visibleMode).toBe('parallel_fanout')
    expect(plan.evidence.allWriteScopesOwned).toBe(true)
    expect(plan.evidence.hasWriteConflict).toBe(false)
    expect(plan.reasons).toContain('write scopes are owned and non-overlapping')
    expect(plan.parentFinalGate).toContain(
      'missing evidence requires one SendMessage correction or an honest PARTIAL',
    )
  })

  test('serializes dependency chains even when parallel was requested', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'research, patch, then verify payment bug',
      requestedMode: 'parallel',
      workItems: [
        {
          taskId: 'agent-research',
          objective: 'Find payment files.',
          readOnly: true,
        },
        {
          taskId: 'agent-patch',
          objective: 'Patch payment rounding after research.',
          readOnly: false,
          ownedFiles: ['src/payment/rounding.ts'],
          dependsOn: ['agent-research'],
          role: 'implementer',
        },
      ],
    })

    expect(plan.visibleMode).toBe('serial_worker')
    expect(plan.evidence.hasDependencies).toBe(true)
    expect(plan.reasons).toContain('dependencies require ordered execution')
  })

  test('preserves placement and lifecycle options without expanding model-visible modes', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'run verifier in background worktree isolation, then continue with SendMessage if evidence is missing',
      requestedMode: 'remote background worktree fork sendmessage swarm',
      workItems: [
        {
          taskId: 'agent-verifier',
          objective: 'Verify payment patch and report command evidence.',
          readOnly: true,
          role: 'verifier',
        },
      ],
    })

    expect(plan.evidence.visibleModes).toEqual(['serial_worker', 'parallel_fanout'])
    expect(plan.visibleMode).toBe('serial_worker')
    expect(plan.runtimePlacements).toEqual([
      'foreground',
      'background',
      'worktree_isolation',
      'remote_gated_isolation',
      'fork_context_inheritance',
      'send_message_continuation',
    ])
    expect(plan.evidence.runtimePlacements).toEqual(plan.runtimePlacements)
    expect(plan.evidence.runtimePlacementsAreNotPlanningModes).toBe(true)
    expect(plan.evidence.visibleModes).not.toContain('background' as any)
    expect(plan.evidence.visibleModes).not.toContain('remote_gated_isolation' as any)
    expect(plan.evidence.visibleModes).not.toContain('send_message_continuation' as any)
    expect(plan.parentFinalGate).toContain(
      'missing evidence requires one SendMessage correction or an honest PARTIAL',
    )
  })
})
