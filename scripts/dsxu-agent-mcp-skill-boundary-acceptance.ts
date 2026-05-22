import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildDSXUAgentMcpSkillBoundaryBoard,
  type DSXUAgentMcpSkillBoundaryInput,
} from '../src/dsxu/engine/agent-mcp-skill-boundary-board'

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_${DATE}.md`)

function readyEvidence(): DSXUAgentMcpSkillBoundaryInput {
  return {
    generatedAt: new Date().toISOString(),
    maxReturnedTranscriptChars: 2000,
    agents: [
      {
        workerId: 'agent-boundary-verifier',
        role: 'verifier',
        status: 'completed',
        objective: 'Verify Agent parent synthesis from worker evidence envelope only.',
        ownedScope: ['src/tools/AgentTool/prompt.ts', 'src/dsxu/engine/subagent-protocol.ts'],
        summary: 'Worker returned PASS marker, output path, hash, and scoped evidence. Parent final cites the envelope.',
        outputPath: '.dsxu/tasks/agent-boundary-verifier.jsonl',
        outputHash: 'sha256:agent-boundary-verifier',
        evidenceIds: ['agent-envelope:agent-boundary-verifier'],
        parentFinalCitations: ['agent-envelope:agent-boundary-verifier'],
        returnedTranscriptChars: 620,
        toolUseCount: 4,
        costUsd: 0.0011,
      },
      {
        workerId: 'agent-boundary-partial',
        role: 'research',
        status: 'partial',
        objective: 'Report partial MCP/Skill evidence without pretending PASS.',
        ownedScope: ['src/dsxu/engine/skills-registry-v1.ts'],
        summary: 'Worker returned PARTIAL with exact missing live proof and no final PASS claim.',
        outputPath: '.dsxu/tasks/agent-boundary-partial.jsonl',
        outputHash: 'sha256:agent-boundary-partial',
        evidenceIds: ['agent-envelope:agent-boundary-partial'],
        parentFinalCitations: ['agent-envelope:agent-boundary-partial'],
        returnedTranscriptChars: 440,
        toolUseCount: 2,
        costUsd: 0.0005,
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
        permissionBoundary: 'Permission Gate owns code mutation approval',
        evidenceIds: ['skill-selection:dsxu-code-review', 'skill-governance:ready'],
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
        permissionBoundary: 'Secondary skill pack remains read-only unless DSXU owner selects it',
        evidenceIds: ['skill-discarded:superpowers-review-helper'],
      },
    ],
    mcpAdapters: [
      {
        serverName: 'v8_real_mcp',
        toolName: 'mcp__v8_real_mcp__lookup',
        decision: 'invoked',
        schemaVerified: true,
        secretsRedacted: true,
        doctorStatus: 'pass',
        toolGateBoundary: 'DSXU Tool Gate MCPTool adapter boundary',
        permissionBoundary: 'MCPTool checkPermissions plus mainline permission callback',
        evidenceIds: ['mcp-schema:v8_real_mcp', 'mcp-redaction:v8_real_mcp'],
      },
    ],
    sourceEvidence: [
      'src/tools/AgentTool/prompt.ts',
      'src/dsxu/engine/forked-agent.ts',
      'src/dsxu/engine/subagent-protocol.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/skill-governance-v1.ts',
      'src/tools/MCPTool/MCPTool.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/real-mcp-server.test.ts',
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
    ],
  }
}

function blockedEvidence(): DSXUAgentMcpSkillBoundaryInput {
  const input = readyEvidence()
  input.agents = [{
    ...input.agents[0]!,
    parentFinalCitations: ['uncited-summary'],
    returnedTranscriptChars: 9000,
  }]
  input.skills = [{
    ...input.skills[0]!,
    conflictPolicy: undefined,
    discardedConflictSkillIds: [],
  }]
  input.mcpAdapters = [{
    ...input.mcpAdapters[0]!,
    schemaVerified: false,
    secretsRedacted: false,
    toolGateBoundary: 'direct MCP runtime',
    claimsStandaloneRuntime: true,
  }]
  return input
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const readyBoard = buildDSXUAgentMcpSkillBoundaryBoard(readyEvidence())
  const blockedBoard = buildDSXUAgentMcpSkillBoundaryBoard(blockedEvidence())
  const pass =
    readyBoard.status === 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE' &&
    blockedBoard.status === 'NEEDS_AGENT_MCP_SKILL_BOUNDARY_EVIDENCE' &&
    readyBoard.ownerCoverage.agentEvidenceEnvelope &&
    readyBoard.ownerCoverage.parentSynthesisGuard &&
    readyBoard.ownerCoverage.skillPriorityConflict &&
    readyBoard.ownerCoverage.mcpSchema &&
    readyBoard.ownerCoverage.mcpSecretRedaction &&
    readyBoard.ownerCoverage.noStandaloneRuntime &&
    blockedBoard.guards.some(guard => guard.includes('parent final does not cite worker evidence')) &&
    blockedBoard.guards.some(guard => guard.includes('returned raw transcript exceeds boundary')) &&
    blockedBoard.guards.some(guard => guard.includes('claims standalone runtime'))

  const report = {
    schemaVersion: 'dsxu.agent-mcp-skill-boundary-acceptance.v1',
    generatedAt: readyBoard.generatedAt,
    status: pass ? 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE' : 'FAIL_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE',
    readyBoard,
    blockedBoard,
    releaseClaimBoundary: {
      allowed: readyBoard.allowedClaims,
      blocked: readyBoard.blockedClaims,
      note: 'Agent, MCP, and Skill claims are allowed only as DSXU-governed boundary capabilities. This does not prove swarm, standalone MCP runtime, or arbitrary external skill execution.',
    },
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const csvRows = [
    ['board', 'status', 'guards', 'agents', 'skills', 'mcpAdapters', 'sourceAndTests', 'noStandaloneRuntime'],
    [
      'ready',
      readyBoard.status,
      readyBoard.guards.join('; '),
      readyBoard.metrics.agentWorkers,
      readyBoard.metrics.selectedSkills,
      readyBoard.metrics.mcpAdapters,
      readyBoard.ownerCoverage.sourceAndTests,
      readyBoard.ownerCoverage.noStandaloneRuntime,
    ],
    [
      'blocked',
      blockedBoard.status,
      blockedBoard.guards.join('; '),
      blockedBoard.metrics.agentWorkers,
      blockedBoard.metrics.selectedSkills,
      blockedBoard.metrics.mcpAdapters,
      blockedBoard.ownerCoverage.sourceAndTests,
      blockedBoard.ownerCoverage.noStandaloneRuntime,
    ],
  ]
  await writeFile(OUT_CSV, `${csvRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8')
  await writeFile(
    OUT_MD,
    [
      '# DSXU Agent MCP Skill Boundary Acceptance - 20260516',
      '',
      `Status: ${report.status}`,
      '',
      '## Ready Board',
      '',
      `- status: ${readyBoard.status}`,
      `- agentWorkers: ${readyBoard.metrics.agentWorkers}`,
      `- citedWorkers: ${readyBoard.metrics.citedWorkers}`,
      `- selectedSkills: ${readyBoard.metrics.selectedSkills}`,
      `- verifiedMcpAdapters: ${readyBoard.metrics.verifiedMcpAdapters}`,
      `- guards: ${readyBoard.guards.join('; ') || 'none'}`,
      '',
      '## Owner Coverage',
      '',
      ...Object.entries(readyBoard.ownerCoverage).map(([key, value]) => `- ${key}: ${value}`),
      '',
      '## Blocked Guard Replay',
      '',
      `- status: ${blockedBoard.status}`,
      `- guards: ${blockedBoard.guards.join('; ')}`,
      '',
      '## Allowed Claims',
      '',
      ...readyBoard.allowedClaims.map(claim => `- ${claim}`),
      '',
      '## Blocked Claims',
      '',
      ...readyBoard.blockedClaims.map(claim => `- ${claim}`),
      '',
      '## Boundary',
      '',
      '- Agent evidence is summary/path/hash/evidence only; parent final must cite it.',
      '- Skill conflict resolution is DSXU registry priority/conflict evidence, not a second skill runtime.',
      '- MCP remains an adapter through DSXU Tool Gate with schema verification and secret redaction evidence.',
      '- This report is focused acceptance evidence, not final six-stage release proof.',
    ].join('\n'),
    'utf8',
  )

  console.log(report.status)
  console.log(`readyGuards=${readyBoard.guards.length}`)
  console.log(`blockedGuards=${blockedBoard.guards.length}`)
  console.log(`json=${OUT_JSON}`)
  console.log(`markdown=${OUT_MD}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
