import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildDSXUAgentMcpSkillBoundaryBoard,
  validateDSXUAgentWorkerEvidenceEnvelope,
} from '../src/dsxu/engine/agent-mcp-skill-boundary-board'
import {
  buildDsxuToolEvidencePack,
  projectToolEvidenceForFinalReport,
  validateDsxuToolEvidencePack,
} from '../src/dsxu/engine/tool-evidence-pack-v1'
import { evaluateToolGate, evaluateToolPermissionContext } from '../src/dsxu/engine/tool-gate-v1'
import type { ToolDefinition, ToolPermissionContext } from '../src/dsxu/engine/tool-types-v1'

const editTool: ToolDefinition = {
  toolId: 'Edit',
  metadata: {
    displayName: 'Edit',
    description: 'Edit a local source file',
    owner: 'Tool Gate',
    version: 'v1',
    tags: ['edit'],
  },
  capabilityTags: ['edit'],
  executionMode: 'sync',
  permissionLevel: 'guarded',
  readWriteClass: 'write-local',
  sideEffectClass: 'local-state',
  failureClass: 'deterministic',
  inputContract: {
    schemaRef: 'dsxu.tool-input.edit.v1',
    requiredFields: ['filePath'],
    optionalFields: ['oldString', 'newString'],
    validationNotes: [],
  },
  outputContract: {
    schemaRef: 'dsxu.tool-call-result.v1',
    producedFields: ['content'],
    failureFields: ['isError'],
    stabilityNotes: ['Normalized by Tool Gate'],
  },
  constraints: [],
}

const permissionContext: ToolPermissionContext = {
  actorId: 'v10-final-agent-tool',
  sessionId: 'session-v10-final-agent-tool',
  cwd: process.cwd(),
  allowedPermissionLevel: 'guarded',
  requireConfirmationForWrite: false,
  denyRules: [],
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  const permission = evaluateToolPermissionContext(editTool, permissionContext)
  const gate = evaluateToolGate(editTool, {
    allowedPermissionLevel: permissionContext.allowedPermissionLevel,
    requireConfirmationForWrite: permissionContext.requireConfirmationForWrite,
  })
  const toolPack = buildDsxuToolEvidencePack({
    queryTurnId: 'v10-final-turn-agent-tool',
    originalToolId: 'Edit',
    resolvedToolId: 'Edit',
    capabilityTags: editTool.capabilityTags,
    readWriteClass: editTool.readWriteClass,
    permission,
    gate,
    result: {
      toolUseId: 'toolu-v10-final-edit',
      content: 'edited src/dsxu/engine/example.ts with bounded output',
      isError: false,
    },
    artifactPaths: ['docs/generated/DSXU_V10_FINAL_AGENT_TOOL_PAIRING_20260520.json'],
    costUsage: {
      model: 'deepseek-v4-flash',
      routeReason: 'coding_flash_thinking_high',
      cacheHitInputTokens: 12000,
      cacheMissInputTokens: 1600,
      outputTokens: 300,
      toolCalls: 1,
      costUsd: 0.00012,
    },
    now: 1_000,
  })
  const toolValidation = validateDsxuToolEvidencePack(toolPack)
  const finalProjection = projectToolEvidenceForFinalReport(toolPack)
  const agentWorker = {
    workerId: 'worker-v10-evidence-verifier',
    role: 'verifier',
    status: 'completed' as const,
    objective: 'Verify V10 final evidence without returning raw transcript bloat.',
    ownedScope: ['docs/generated/DSXU_V10_FINAL_RESULT_DASHBOARD_20260520.json'],
    summary: 'Verified V10 final evidence outputs and returned summary/path/hash envelope.',
    outputPath: '.dsxu/tasks/worker-v10-evidence-verifier.jsonl',
    outputHash: 'sha256:worker-v10-evidence-verifier',
    evidenceIds: ['agent-evidence:worker-v10-evidence-verifier'],
    parentFinalCitations: ['agent-evidence:worker-v10-evidence-verifier'],
    returnedTranscriptChars: 640,
    toolUseCount: 3,
    costUsd: 0.0008,
  }
  const agentValidation = validateDSXUAgentWorkerEvidenceEnvelope(agentWorker)
  const boundaryBoard = buildDSXUAgentMcpSkillBoundaryBoard({
    generatedAt: new Date().toISOString(),
    maxReturnedTranscriptChars: 2000,
    agents: [agentWorker],
    skills: [
      {
        skillId: 'dsxu-v10-evidence-review',
        decision: 'selected',
        priority: 90,
        conflictPolicy: 'prefer-higher-priority',
        conflictSkillIds: ['secondary-reference-helper'],
        discardedConflictSkillIds: ['secondary-reference-helper'],
        governanceStatus: 'ready',
        toolBoundary: 'DSXU Tool Gate scoped Read/Grep/Evidence only',
        permissionBoundary: 'Permission Gate owns mutation approval',
        evidenceIds: ['skill-selection:dsxu-v10-evidence-review'],
      },
      {
        skillId: 'secondary-reference-helper',
        decision: 'discarded',
        priority: 30,
        conflictPolicy: 'prefer-higher-priority',
        conflictSkillIds: ['dsxu-v10-evidence-review'],
        discardedConflictSkillIds: [],
        governanceStatus: 'ready',
        toolBoundary: 'DSXU Tool Gate read-only secondary helper',
        permissionBoundary: 'Read-only helper cannot mutate product runtime',
        evidenceIds: ['skill-discarded:secondary-reference-helper'],
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
        permissionBoundary: 'MCPTool permission callback plus DSXU mainline permission gate',
        evidenceIds: ['mcp-adapter:docs-search'],
      },
    ],
    sourceEvidence: [
      'src/dsxu/engine/agent-mcp-skill-boundary-board.ts',
      'src/dsxu/engine/tool-evidence-pack-v1.ts',
      'src/dsxu/engine/tool-protocol.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts',
      'src/dsxu/engine/__tests__/tool-evidence-pack-v1.test.ts',
    ],
  })
  const blockers = [
    !toolValidation.valid ? `toolValidation:${[...toolValidation.missingFields, ...toolValidation.violations].join('|')}` : '',
    finalProjection.canonicalResultSchema !== 'dsxu.tool-call-result.v1'
      ? `canonicalResultSchema:${finalProjection.canonicalResultSchema ?? 'MISSING'}`
      : '',
    finalProjection.runtimeEventSchema !== 'dsxu.runtime-event.v1'
      ? `runtimeEventSchema:${finalProjection.runtimeEventSchema ?? 'MISSING'}`
      : '',
    !agentValidation.valid ? `agentValidation:${agentValidation.guards.join('|')}` : '',
    boundaryBoard.status !== 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
      ? `boundary:${boundaryBoard.status}:${boundaryBoard.guards.join('|')}`
      : '',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.final-agent-tool-pairing.v10',
    generatedAt: new Date().toISOString(),
    owner: 'Agent Evidence / Tool Gate / MCP Skill Boundary',
    status: blockers.length === 0
      ? 'PASS_V10_FINAL_AGENT_TOOL_PAIRING'
      : 'FAIL_V10_FINAL_AGENT_TOOL_PAIRING',
    publicClaimAllowed: false,
    toolPack: {
      packId: toolPack.packId,
      validation: toolValidation,
      finalProjection,
    },
    agentValidation,
    boundaryBoard,
    blockers,
    rule:
      'Agent/tool pairing evidence proves compact agent handoff plus canonical tool result projection. It does not create a swarm runtime, skill marketplace claim, or standalone MCP runtime.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V10_FINAL_AGENT_TOOL_PAIRING_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_AGENT_TOOL_PAIRING_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Agent Tool Pairing',
    '',
    `Status: ${report.status}`,
    '',
    `Tool pack: ${toolPack.packId}`,
    '',
    `Canonical result: ${finalProjection.canonicalResultSchema ?? 'MISSING'}`,
    '',
    `Runtime event schema: ${finalProjection.runtimeEventSchema ?? 'MISSING'}`,
    '',
    ...boundaryBoard.compactPanelLines.map(line => `- ${line}`),
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status: report.status, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
