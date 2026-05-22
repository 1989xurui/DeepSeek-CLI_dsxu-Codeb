import { describe, expect, test } from 'bun:test'
import {
  agentEvidencePacketSchema,
  buildAgentEvidencePacket,
  renderAgentEvidencePacket,
} from '../agentToolUtils'
import {
  buildDSXUAgentMcpSkillBoundaryBoard,
  validateDSXUAgentWorkerEvidenceEnvelope,
} from '../../../dsxu/engine/agent-mcp-skill-boundary-board'

describe('V6 Agent Evidence Handoff', () => {
  test('extracts a compact evidence packet instead of returning a raw transcript', () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'read-1',
              name: 'Read',
              input: { file_path: 'src/dsxu/engine/action-contract.ts' },
            },
            {
              type: 'tool_use',
              id: 'bash-1',
              name: 'Bash',
              input: { command: 'bun test src/dsxu/engine/__tests__/action-contract.test.ts' },
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            server_tool_use: null,
            service_tier: null,
            cache_creation: null,
          },
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'bash-1',
              content: [
                {
                  type: 'text',
                  text: 'bun test src/dsxu/engine/__tests__/action-contract.test.ts\n11 pass\n0 fail',
                },
              ],
            },
          ],
        },
      },
    ] as any[]
    const finalText = [
      'Files changed: src/dsxu/engine/action-contract.ts',
      'Verification: bun test src/dsxu/engine/__tests__/action-contract.test.ts',
      'Risks: none',
      'PASS complete.',
    ].join('\n')

    const packet = buildAgentEvidencePacket(messages, finalText)
    expect(agentEvidencePacketSchema().safeParse(packet).success).toBe(true)
    expect(packet.files_read).toEqual(['src/dsxu/engine/action-contract.ts'])
    expect(packet.files_changed).toEqual(['src/dsxu/engine/action-contract.ts'])
    expect(packet.commands_run).toEqual([
      'bun test src/dsxu/engine/__tests__/action-contract.test.ts',
    ])
    expect(packet.tests_passed).toContain(
      'bun test src/dsxu/engine/__tests__/action-contract.test.ts',
    )
    expect(packet.unresolved_risks).toEqual([])
    expect(packet.completion_claim).toBe('complete')
    expect(renderAgentEvidencePacket(packet)).toContain('<evidence>')
  })

  test('rejects parent completion when worker evidence is uncited or transcript is too large', () => {
    const validation = validateDSXUAgentWorkerEvidenceEnvelope(
      {
        workerId: 'worker-uncited',
        role: 'worker',
        status: 'completed',
        objective: 'Inspect action contract',
        ownedScope: ['src/dsxu/engine/action-contract.ts'],
        summary: 'Found the owner path.',
        outputPath: '.dsxu/agents/worker-uncited.md',
        outputHash: 'sha256-worker',
        evidenceIds: ['worker-evidence-1'],
        parentFinalCitations: [],
        returnedTranscriptChars: 4000,
      },
      { maxReturnedTranscriptChars: 2000 },
    )

    expect(validation.valid).toBe(false)
    expect(validation.guards).toEqual(
      expect.arrayContaining([
        'agent:worker-uncited parent final does not cite worker evidence',
        'agent:worker-uncited returned raw transcript exceeds boundary',
      ]),
    )
  })

  test('passes only when Agent, Skill, and MCP evidence stay inside DSXU owner boundaries', () => {
    const board = buildDSXUAgentMcpSkillBoundaryBoard({
      generatedAt: '2026-05-19T00:00:00.000Z',
      agents: [
        {
          workerId: 'agent-v6-worker',
          role: 'worker',
          status: 'completed',
          objective: 'Verify V6 agent handoff',
          ownedScope: ['src/tools/AgentTool'],
          summary: 'Worker returned compact evidence and no raw transcript.',
          outputPath: '.dsxu/agents/agent-v6-worker.md',
          outputHash: 'sha256-agent-v6-worker',
          evidenceIds: ['agent-v6-evidence'],
          parentFinalCitations: ['agent-v6-evidence'],
          returnedTranscriptChars: 600,
        },
      ],
      skills: [
        {
          skillId: 'dsxu-owned-secondary-skill',
          decision: 'selected',
          priority: 20,
          conflictPolicy: 'prefer-higher-priority',
          conflictSkillIds: ['legacy-skill'],
          discardedConflictSkillIds: ['legacy-skill'],
          governanceStatus: 'ready',
          toolBoundary: 'DSXU Tool Gate governed skill adapter',
          permissionBoundary: 'DSXU PermissionGate',
          evidenceIds: ['skill-v6-evidence'],
        },
      ],
      mcpAdapters: [
        {
          serverName: 'local-mcp',
          toolName: 'search_docs',
          decision: 'registered',
          schemaVerified: true,
          secretsRedacted: true,
          doctorStatus: 'pass',
          toolGateBoundary: 'DSXU Tool Gate MCP adapter',
          permissionBoundary: 'DSXU PermissionGate',
          evidenceIds: ['mcp-v6-evidence'],
        },
      ],
      sourceEvidence: [
        'src/tools/AgentTool/agentToolUtils.ts',
        'src/dsxu/engine/agent-mcp-skill-boundary-board.ts',
      ],
      tests: ['bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts'],
    })

    expect(board.status).toBe('PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE')
    expect(board.ownerCoverage.agentEvidenceEnvelope).toBe(true)
    expect(board.ownerCoverage.parentSynthesisGuard).toBe(true)
    expect(board.ownerCoverage.noStandaloneRuntime).toBe(true)
    expect(board.blockedClaims.join('\n')).toContain('Do not claim swarm')
  })
})
