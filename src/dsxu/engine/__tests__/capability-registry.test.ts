import { describe, expect, test } from 'bun:test'
import {
  buildDSXUCapabilityRegistry,
  compileDSXUCapabilityActivationPlan,
  getDSXUCapabilityEntry,
  resolveDSXUToolCapabilityExposure,
} from '../capability-registry'
import { compileDSXUToolView } from '../tool-catalog-v1'

describe('V6-S Capability Registry', () => {
  test('covers mainline, sidecar, searchable, expert, frozen, and legacy capabilities', () => {
    const registry = buildDSXUCapabilityRegistry()

    expect(registry.schemaVersion).toBe('dsxu.capability-registry.v6s')
    expect(registry.owner).toBe('Runtime control plane')
    expect(registry.summary.byExposure.mainline).toBeGreaterThanOrEqual(5)
    expect(registry.summary.byExposure.sidecar).toBeGreaterThanOrEqual(3)
    expect(registry.summary.byExposure.searchable).toBeGreaterThanOrEqual(1)
    expect(registry.summary.byExposure.expert).toBeGreaterThanOrEqual(1)
    expect(registry.summary.byExposure.frozen).toBeGreaterThanOrEqual(1)
    expect(registry.summary.byExposure.legacy).toBeGreaterThanOrEqual(1)
    expect(getDSXUCapabilityEntry(registry, 'tool-bus.legacy')).toMatchObject({
      exposure: 'legacy',
      claimPolicy: 'claim_blocked',
    })
  })

  test('ordinary single-file edit activates only the low-entropy default chain', () => {
    const plan = compileDSXUCapabilityActivationPlan({
      taskType: 'single_file_edit',
    })

    expect(plan.activeCapabilityIds).toEqual(
      expect.arrayContaining([
        'task-contract',
        'tool-view',
        'strict-schema-gateway',
        'provider.deepseek',
        'ledger.trust-surface',
      ]),
    )
    expect(plan.activeCapabilityIds).not.toEqual(
      expect.arrayContaining([
        'skills.searchable',
        'mcp.expert',
        'swarm.team.mesh',
        'tool-bus.legacy',
      ]),
    )
    expect(plan.visibleOrchestrationModes).toEqual(['serial worker', 'parallel fanout'])
    expect(plan.guards).toEqual([])
  })

  test('Skill and MCP activate only from explicit task evidence, while legacy stays blocked', () => {
    const plan = compileDSXUCapabilityActivationPlan({
      taskType: 'long_task',
      matchedSkillIds: ['review-skill'],
      mcpResourceRefs: ['mcp://docs/search'],
      explicitCapabilityIds: ['tool-bus.legacy'],
      taskContractAllows: ['agent.serial-worker'],
    })

    expect(plan.activeCapabilityIds).toEqual(
      expect.arrayContaining([
        'agent.serial-worker',
        'skills.searchable',
        'mcp.expert',
      ]),
    )
    expect(plan.activeCapabilityIds).not.toContain('tool-bus.legacy')
    expect(plan.blockedCapabilityIds).toContain('tool-bus.legacy')
    expect(plan.guards.join('\n')).toContain('blocked non-default capability:tool-bus.legacy:legacy')
  })

  test('Tool View consumes capability exposure and hides expert tools by default', () => {
    const registry = buildDSXUCapabilityRegistry()
    const view = compileDSXUToolView({
      taskType: 'single_file_edit',
      capabilityRegistry: registry,
      tools: [
        'Read',
        'Edit',
        'Bash',
        'Grep',
        'MCPDocs',
        'SkillRunner',
        'SwarmCoordinator',
        'LegacyToolBus',
      ],
    })

    expect(resolveDSXUToolCapabilityExposure('MCPDocs', registry)).toBe('expert')
    expect(resolveDSXUToolCapabilityExposure('SkillRunner', registry)).toBe('searchable')
    expect(resolveDSXUToolCapabilityExposure('LegacyToolBus', registry)).toBe('legacy')
    expect(view.visibleToolIds).toEqual(['Read', 'Edit', 'Bash', 'Grep'])
    expect(view.hiddenToolIds).toEqual(
      expect.arrayContaining(['MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'LegacyToolBus']),
    )
    expect(view.guards).toEqual([])
  })
})
