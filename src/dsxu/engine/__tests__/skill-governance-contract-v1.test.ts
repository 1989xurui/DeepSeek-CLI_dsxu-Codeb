import { describe, expect, test } from 'bun:test'
import {
  buildSkillGovernanceContract,
  evaluateSkillToolUse,
  projectSkillGovernanceForAudit,
  validateSkillGovernanceContract,
  type SkillGovernanceContract,
} from '../skill-governance-v1'
import { SkillRegistry, buildInvocationPlan, selectSkills } from '../skills-registry-v1'
import type { SkillDefinition } from '../skills-types-v1'

function skill(input: {
  id: string
  tags: Array<'analysis' | 'code-edit' | 'test' | 'recovery'>
  trigger: string
  governance?: SkillDefinition['governance']
}): SkillDefinition {
  return {
    skillId: input.id,
    metadata: {
      name: input.id,
      description: `${input.id} governed capability`,
      version: '1.0.0',
      owner: 'dsxu-mainline',
      tags: input.tags,
    },
    input: { requiredFields: ['taskText'], optionalFields: ['context'], schemaHint: 'task' },
    output: { outputFields: ['result'], qualitySignals: ['evidence'], failureSignals: ['blocked'] },
    triggers: [{ id: `${input.id}-trigger`, type: 'keyword', expression: input.trigger, weight: 1 }],
    constraints: [],
    governance: input.governance,
  }
}

describe('WP-03 - Skill Governance contract', () => {
  test('1. analysis skill gets entry, exit, tool boundary, and evidence fields', () => {
    const contract = buildSkillGovernanceContract(skill({ id: 'analysis-skill', tags: ['analysis'], trigger: 'analyze' }))

    expect(contract.schemaVersion).toBe('dsxu.skill-governance.v1')
    expect(contract.useWhen.length).toBeGreaterThan(0)
    expect(contract.doNotUseWhen.length).toBeGreaterThan(0)
    expect(contract.requiredTools).toContain('Read')
    expect(contract.requiredTools).toContain('Grep')
    expect(contract.exitCriteria.join('\n')).toContain('context owner rule')
    expect(contract.evidenceFields).toContain('contextOwnerRule')
    expect(contract.evidenceFields).toContain('toolEvidencePack')
    expect(contract.status).toBe('ready')
    expect(validateSkillGovernanceContract(contract).valid).toBe(true)
  })

  test('2. code edit skill cannot enter without read/edit tools and verification exit criteria', () => {
    const contract = buildSkillGovernanceContract(skill({ id: 'edit-skill', tags: ['code-edit'], trigger: 'edit' }))

    expect(contract.requiredTools).toContain('Read')
    expect(contract.requiredTools).toContain('Edit')
    expect(contract.exitCriteria.join('\n')).toContain('source file was read before edit')
    expect(contract.exitCriteria.join('\n')).toContain('latest verification output is recorded after edit')
    expect(contract.toolBoundary.requiresContextOwnerRule).toBe(true)
    expect(contract.toolBoundary.requiresToolEvidencePack).toBe(true)
    expect(contract.violations).toEqual([])
  })

  test('3. tool use is blocked when outside the skill governance boundary', () => {
    const contract = buildSkillGovernanceContract(skill({ id: 'test-skill', tags: ['test'], trigger: 'test' }))

    expect(evaluateSkillToolUse(contract, { toolId: 'Bash' }).allowed).toBe(true)
    const blocked = evaluateSkillToolUse(contract, { toolId: 'CronCreateTool' })
    expect(blocked.allowed).toBe(false)
    expect(blocked.violation).toBe('tool_not_allowed_by_skill')
  })

  test('4. invalid governance contract is blocked by validator', () => {
    const invalid: SkillGovernanceContract = {
      schemaVersion: 'dsxu.skill-governance.v1',
      skillId: 'bad-edit-skill',
      skillTags: ['code-edit'],
      useWhen: [],
      doNotUseWhen: [],
      requiredTools: ['Edit'],
      forbiddenTools: [],
      exitCriteria: [],
      evidenceFields: ['selectionTrace'],
      toolBoundary: {
        allowedTools: ['Edit'],
        forbiddenTools: [],
        requiresToolEvidencePack: true,
        requiresContextOwnerRule: true,
      },
      status: 'blocked',
      violations: [],
      trace: [],
    }
    const validation = validateSkillGovernanceContract(invalid)

    expect(validation.valid).toBe(false)
    expect(validation.violations).toContain('missing_use_when')
    expect(validation.violations).toContain('missing_context_owner_rule')
    expect(validation.violations).toContain('missing_tool_evidence_pack')
    expect(validation.violations).toContain('code_edit_without_read_tool')
  })

  test('5. invocation plan carries governance contracts for selected skills', () => {
    const registry = new SkillRegistry()
    registry.register(skill({ id: 'analysis-skill', tags: ['analysis'], trigger: 'analyze' }), 90)
    registry.register(skill({ id: 'edit-skill', tags: ['code-edit'], trigger: 'edit' }), 100)

    const selected = selectSkills(registry, {
      context: { taskId: 'skill-governance-task', taskText: 'analyze and edit this module', runtimeStateHints: [], sessionHints: [] },
      requestedTags: ['analysis', 'code-edit'],
      policy: { mode: 'multi-skill', maxSkills: 2, conflictPolicy: 'prefer-higher-priority' },
    })
    const plan = buildInvocationPlan({ selected, bindings: [], promptStackId: 'stack-governed' })

    expect(plan.governanceContracts.length).toBe(2)
    expect(plan.governanceContracts.every(contract => contract.status === 'ready')).toBe(true)
    expect(plan.trace.reasons.join('\n')).toContain('governance:edit-skill:ready')
    expect(plan.trace.reasons.join('\n')).toContain('governance:analysis-skill:ready')
  })

  test('6. audit projection exposes the fields release and replay need', () => {
    const contract = buildSkillGovernanceContract(skill({ id: 'recovery-skill', tags: ['recovery'], trigger: 'recover' }))
    const projection = projectSkillGovernanceForAudit(contract)

    expect(projection.skillId).toBe('recovery-skill')
    expect(projection.status).toBe('ready')
    expect(projection.requiredTools).toContain('Read')
    expect(projection.evidenceFields).toContain('contextOwnerRule')
    expect(projection.evidenceFields).toContain('toolEvidencePack')
  })
})
