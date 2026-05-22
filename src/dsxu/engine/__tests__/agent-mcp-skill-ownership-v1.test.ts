import { describe, expect, test } from 'bun:test'
import { SkillRegistry, buildSkillToolGateDefinition, validateSkillRegistryOwnershipAudit } from '../skills-registry-v1'
import type { SkillDefinition } from '../skills-types-v1'
import { ToolRegistry } from '../tool-registry'
import type { ToolDefinition } from '../types'

const readTool: ToolDefinition = {
  name: 'Read',
  description: 'read source',
  inputSchema: { type: 'object', properties: {}, required: [] },
  readOnly: true,
  execute: async () => ({ content: 'ok' }),
}

function skill(id: string): SkillDefinition {
  return {
    skillId: id,
    metadata: {
      name: id,
      description: `${id} owned capability`,
      version: '1.0.0',
      owner: 'dsxu-skill-owner',
      tags: ['analysis'],
    },
    input: { requiredFields: ['taskText'], optionalFields: [], schemaHint: 'task' },
    output: { outputFields: ['result'], qualitySignals: ['evidence'], failureSignals: ['blocked'] },
    triggers: [{ id: `${id}-trigger`, type: 'keyword', expression: id, weight: 1 }],
    constraints: [],
  }
}

describe('Agent/MCP/Skill ownership proof', () => {
  test('ToolRegistry attaches provider and permission ownership to runtime tools', async () => {
    const registry = new ToolRegistry()
    registry.register(readTool)
    registry.register(
      {
        ...readTool,
        name: 'mcp__repo__search',
        description: 'MCP search adapter',
      },
      {
        providerId: 'mcp:repo',
        providerKind: 'mcp',
        ownerId: 'mcp-skill-registry-owner',
        evidenceIds: ['mcp-adapter-proof'],
      },
    )

    const audit = registry.buildOwnershipAudit()
    expect(audit.missingOwnership).toEqual([])
    expect(audit.providerKinds.mainline).toBe(1)
    expect(audit.providerKinds.mcp).toBe(1)
    expect(audit.permissionBoundary).toBe('DSXU Tool Gate')

    const result = await registry.execute('mcp__repo__search', {}, 'tool-1', {
      cwd: process.cwd(),
      sessionId: 'ownership-test',
      gear: 1,
    })
    expect(result.meta?.toolOwnership.providerId).toBe('mcp:repo')
    expect(result.meta?.toolOwnership.permissionBoundary).toBe('DSXU Tool Gate')
  })

  test('SkillRegistry records MCP and agent providers without creating standalone runtime claims', () => {
    const registry = new SkillRegistry()
    const mcpProvider = registry.registerMcpProvider({ serverName: 'repo', evidenceIds: ['mcp-provider-proof'] })
    registry.registerAgentProvider({ agentId: 'worker-review', evidenceIds: ['agent-provider-proof'] })
    registry.register(skill('repo-search'), 100, {
      providerId: mcpProvider.providerId,
      evidenceIds: ['skill-owner-proof'],
    })

    const entry = registry.get('repo-search')
    expect(entry?.ownerProof.registryOwner).toBe('MCP / Skill Registry')
    expect(entry?.ownerProof.providerKind).toBe('mcp')
    expect(entry?.ownerProof.toolGateBoundary).toBe('DSXU Tool Gate')

    const audit = registry.buildOwnershipAudit()
    expect(validateSkillRegistryOwnershipAudit(audit)).toEqual({ valid: true, violations: [] })
    expect(audit.providersByKind.mcp).toBe(1)
    expect(audit.providersByKind.agent).toBe(1)
    expect(audit.standaloneRuntimeClaims).toEqual([])
  })

  test('skill Tool Gate contract exposes provider registration and boundary evidence', () => {
    const gate = buildSkillToolGateDefinition({
      skillName: 'repo-search',
      input: { query: 'owner proof' },
      cwd: process.cwd(),
      sessionId: 'skill-gate-test',
      providerId: 'mcp:repo',
      providerKind: 'mcp',
      evidenceIds: ['skill-tool-gate-proof'],
    })

    expect(gate.metadata.owner).toBe('MCP / Skill Registry')
    expect(gate.metadata.tags).toContain('mcp')
    expect(gate.inputContract.validationNotes.join('\n')).toContain('provider:mcp:repo')
    expect(gate.inputContract.validationNotes.join('\n')).toContain('evidence:skill-tool-gate-proof|skill-tool-gate-owner-proof')
    expect(gate.outputContract.stabilityNotes.join('\n')).toContain('provider registration: mcp:repo')
    expect(gate.constraints.map(constraint => constraint.id)).toContain('skill-provider-registration')
  })
})
