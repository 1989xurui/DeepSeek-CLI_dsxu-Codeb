import { describe, expect, test } from 'bun:test'
import {
  buildDSXUAgentMcpSkillBoundaryBoard,
  validateDSXUAgentWorkerEvidenceEnvelope,
  type DSXUAgentMcpSkillBoundaryInput,
} from '../agent-mcp-skill-boundary-board'

function readyInput(): DSXUAgentMcpSkillBoundaryInput {
  return {
    generatedAt: '2026-05-16T00:00:00.000Z',
    maxReturnedTranscriptChars: 2000,
    agents: [
      {
        workerId: 'worker-visible-state-verifier',
        role: 'verifier',
        status: 'completed',
        objective: 'Verify visible state projection without editing runtime owners.',
        ownedScope: ['src/dsxu/engine/work-state-timeline.ts'],
        summary: 'Focused verification passed and returned bounded summary.',
        outputPath: '.dsxu/tasks/worker-visible-state-verifier.jsonl',
        outputHash: 'sha256:worker-visible-state-verifier',
        evidenceIds: ['agent-evidence:worker-visible-state-verifier'],
        parentFinalCitations: ['agent-evidence:worker-visible-state-verifier'],
        returnedTranscriptChars: 480,
        toolUseCount: 3,
        costUsd: 0.0008,
      },
    ],
    skills: [
      {
        skillId: 'dsxu-code-review',
        decision: 'selected',
        priority: 90,
        conflictPolicy: 'prefer-higher-priority',
        conflictSkillIds: ['superpowers-review-helper'],
        discardedConflictSkillIds: ['superpowers-review-helper'],
        governanceStatus: 'ready',
        toolBoundary: 'DSXU Tool Gate scoped Read/Grep/Edit/Bash',
        permissionBoundary: 'Permission Gate owns mutation approval',
        evidenceIds: ['skill-selection:dsxu-code-review'],
      },
      {
        skillId: 'superpowers-review-helper',
        decision: 'discarded',
        priority: 40,
        conflictPolicy: 'prefer-higher-priority',
        conflictSkillIds: ['dsxu-code-review'],
        discardedConflictSkillIds: [],
        governanceStatus: 'ready',
        toolBoundary: 'DSXU Tool Gate scoped Read/Grep only',
        permissionBoundary: 'Read-only secondary skill pack',
        evidenceIds: ['skill-discarded:superpowers-review-helper'],
      },
    ],
    mcpAdapters: [
      {
        serverName: 'docs-search',
        toolName: 'mcp__docs_search__lookup',
        decision: 'registered',
        schemaVerified: true,
        secretsRedacted: true,
        doctorStatus: 'pass',
        toolGateBoundary: 'DSXU Tool Gate MCPTool adapter boundary',
        permissionBoundary: 'MCPTool checkPermissions passthrough plus mainline permission callback',
        evidenceIds: ['mcp-adapter:docs-search'],
      },
    ],
    sourceEvidence: [
      'src/tools/AgentTool/prompt.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/tools/MCPTool/MCPTool.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/real-mcp-server.test.ts',
    ],
  }
}

describe('DSXU Agent/MCP/Skill boundary board', () => {
  test('validates the agent worker evidence envelope at runtime before parent synthesis', () => {
    const worker = readyInput().agents[0]!
    const validation = validateDSXUAgentWorkerEvidenceEnvelope(worker)

    expect(validation).toMatchObject({
      schemaVersion: 'dsxu.agent-worker-evidence-envelope-validation.v1',
      owner: 'Agent Evidence Handoff',
      workerId: 'worker-visible-state-verifier',
      valid: true,
      guards: [],
    })
    expect(validation.evidenceIds).toContain('agent-evidence:worker-visible-state-verifier')
    expect(validation.parentFinalCitations).toContain('agent-evidence:worker-visible-state-verifier')
  })

  test('accepts bounded worker, skill, and MCP evidence under DSXU owners', () => {
    const board = buildDSXUAgentMcpSkillBoundaryBoard(readyInput())

    expect(board.status).toBe('PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE')
    expect(board.guards).toEqual([])
    expect(board.ownerCoverage).toMatchObject({
      agentEvidenceEnvelope: true,
      parentSynthesisGuard: true,
      skillPriorityConflict: true,
      skillGovernance: true,
      mcpSchema: true,
      mcpSecretRedaction: true,
      dsxuToolGateBoundary: true,
      noStandaloneRuntime: true,
      sourceAndTests: true,
    })
    expect(board.compactPanelLines.join('\n')).toContain(
      'Agent evidence: workers=1 cited=1/1',
    )
    expect(board.compactPanelLines.join('\n')).toContain(
      'Boundary: toolGate=true standaloneRuntime=false',
    )
    expect(board.finalReportSection.status).toBe('ready')
    expect(board.finalReportSection.summary.join('\n')).toContain(
      'noStandaloneRuntime=true',
    )
    expect(board.finalReportSection.evidence).toContain(
      'agent-evidence:worker-visible-state-verifier',
    )
    expect(board.allowedClaims.join('\n')).toContain('serial/parallel workers')
    expect(board.blockedClaims.join('\n')).toContain('standalone MCP runtime')
  })

  test('blocks parent PASS when worker evidence is not cited', () => {
    const input = readyInput()
    input.agents[0] = {
      ...input.agents[0]!,
      parentFinalCitations: ['unrelated-evidence'],
    }

    const board = buildDSXUAgentMcpSkillBoundaryBoard(input)

    expect(board.status).toBe('NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE')
    expect(board.guards).toContain('agent:worker-visible-state-verifier parent final does not cite worker evidence')
    expect(board.ownerCoverage.parentSynthesisGuard).toBe(false)
    expect(board.finalReportSection.status).toBe('needs-evidence')
    expect(board.compactPanelLines.join('\n')).toContain(
      'Agent evidence: workers=1 cited=0/1',
    )
  })

  test('blocks raw transcript bloat before worker evidence can be treated as handoff proof', () => {
    const worker = {
      ...readyInput().agents[0]!,
      returnedTranscriptChars: 3000,
    }

    const validation = validateDSXUAgentWorkerEvidenceEnvelope(worker, {
      maxReturnedTranscriptChars: 2000,
    })

    expect(validation.valid).toBe(false)
    expect(validation.guards).toContain(
      'agent:worker-visible-state-verifier returned raw transcript exceeds boundary',
    )
  })

  test('blocks selected skill conflicts without priority policy and discarded evidence', () => {
    const input = readyInput()
    input.skills[0] = {
      ...input.skills[0]!,
      conflictPolicy: undefined,
      discardedConflictSkillIds: [],
    }

    const board = buildDSXUAgentMcpSkillBoundaryBoard(input)

    expect(board.status).toBe('NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE')
    expect(board.guards).toContain('skill:dsxu-code-review missing conflict policy')
    expect(board.guards).toContain('skill:dsxu-code-review missing discarded conflict evidence')
    expect(board.ownerCoverage.skillPriorityConflict).toBe(false)
  })

  test('blocks MCP adapters that bypass schema, redaction, or Tool Gate boundary', () => {
    const input = readyInput()
    input.mcpAdapters[0] = {
      ...input.mcpAdapters[0]!,
      schemaVerified: false,
      secretsRedacted: false,
      toolGateBoundary: 'direct MCP client',
      claimsStandaloneRuntime: true,
    }

    const board = buildDSXUAgentMcpSkillBoundaryBoard(input)

    expect(board.status).toBe('NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE')
    expect(board.guards).toContain('mcp:docs-search/mcp__docs_search__lookup schema not verified')
    expect(board.guards).toContain('mcp:docs-search/mcp__docs_search__lookup secrets not redacted')
    expect(board.guards).toContain('mcp:docs-search/mcp__docs_search__lookup missing DSXU Tool Gate boundary')
    expect(board.guards).toContain('mcp:docs-search/mcp__docs_search__lookup claims standalone runtime')
    expect(board.ownerCoverage.noStandaloneRuntime).toBe(false)
  })
})
