import { describe, expect, test } from 'bun:test'
import { buildDSXUAgentMcpSkillBoundaryBoard } from '../agent-mcp-skill-boundary-board'
import { compileDSXUCapabilityActivationPlan } from '../capability-registry'
import { compileDSXUToolView } from '../tool-catalog-v1'

describe('V6-S Skill/MCP searchable expert layer', () => {
  test('ordinary coding turns keep Skill and MCP out of the default prompt/tool view', () => {
    const activation = compileDSXUCapabilityActivationPlan({
      taskType: 'single_file_edit',
    })
    const view = compileDSXUToolView({
      taskType: 'single_file_edit',
      tools: ['Read', 'Edit', 'Bash', 'Grep', 'SkillTool', 'MCPTool', 'MCPDocs'],
    })

    expect(activation.activeCapabilityIds).not.toContain('skills.searchable')
    expect(activation.activeCapabilityIds).not.toContain('mcp.expert')
    expect(view.visibleToolIds).not.toEqual(expect.arrayContaining(['SkillTool', 'MCPTool', 'MCPDocs']))
    expect(view.hiddenToolIds).toEqual(expect.arrayContaining(['SkillTool', 'MCPTool', 'MCPDocs']))
  })

  test('Skill and MCP require task evidence and cannot create standalone PASS', () => {
    const activation = compileDSXUCapabilityActivationPlan({
      taskType: 'long_task',
      matchedSkillIds: ['repo-review'],
      mcpResourceRefs: ['mcp://local/search_docs'],
    })
    const board = buildDSXUAgentMcpSkillBoundaryBoard({
      generatedAt: '2026-05-19T00:00:00.000Z',
      agents: [
        {
          workerId: 'worker-skill-mcp',
          role: 'worker',
          status: 'partial',
          objective: 'Validate Skill/MCP evidence envelope',
          ownedScope: ['src/dsxu/engine'],
          summary: 'Skill and MCP outputs are evidence only and require verification.',
          outputPath: '.dsxu/agents/worker-skill-mcp.md',
          outputHash: 'sha256-worker-skill-mcp',
          evidenceIds: ['worker-evidence'],
          parentFinalCitations: ['worker-evidence'],
          returnedTranscriptChars: 512,
        },
      ],
      skills: [
        {
          skillId: 'repo-review',
          decision: 'selected',
          priority: 20,
          conflictPolicy: 'prefer-higher-priority',
          conflictSkillIds: ['generic-review'],
          discardedConflictSkillIds: ['generic-review'],
          governanceStatus: 'ready',
          toolBoundary: 'DSXU Tool Gate governed skill adapter',
          permissionBoundary: 'DSXU PermissionGate',
          evidenceIds: ['skill:repo-review'],
        },
      ],
      mcpAdapters: [
        {
          serverName: 'local',
          toolName: 'search_docs',
          decision: 'registered',
          schemaVerified: true,
          secretsRedacted: true,
          doctorStatus: 'pass',
          toolGateBoundary: 'DSXU Tool Gate MCP adapter',
          permissionBoundary: 'DSXU PermissionGate',
          evidenceIds: ['mcp:local/search_docs'],
        },
      ],
      sourceEvidence: [
        'src/dsxu/engine/capability-registry.ts',
        'src/dsxu/engine/agent-mcp-skill-boundary-board.ts',
      ],
      tests: ['bun test src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts'],
    })

    expect(activation.activeCapabilityIds).toEqual(
      expect.arrayContaining(['skills.searchable', 'mcp.expert']),
    )
    expect(board.status).toBe('PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE')
    expect(board.allowedClaims.join('\n')).toContain('DSXU skills may be described as registry-governed extensions')
    expect(board.allowedClaims.join('\n')).toContain('DSXU MCP may be described as Tool Gate governed adapter intake')
    expect(board.blockedClaims.join('\n')).toContain('Do not claim swarm')
  })
})
