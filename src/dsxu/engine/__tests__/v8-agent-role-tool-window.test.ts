import { describe, expect, test } from 'bun:test'
import { compileDSXUExecutionContract } from '../action-contract'
import { resolveDSXUAgentOrchestration } from '../agent-role-router-v1'
import { compileDSXUToolView, validateDSXUPlannedToolInView } from '../tool-catalog-v1'

const TOOL_POOL = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'PowerShell',
  'Grep',
  'Glob',
  'LSP',
  'GitDiff',
  'RunNativeTest',
  'Evidence',
  'Replay',
  'Todo',
  'ToolSearch',
  'Agent',
  'TaskOutput',
  'CollectEvidence',
  'FileHistory',
  'AskUser',
  'MCPDocs',
  'SkillRunner',
  'WebSearch',
  'WebFetch',
  'SwarmCoordinator',
  'LegacyToolBus',
  'TaskCreate',
  'TaskUpdate',
]

describe('V8 agent role and tool window anti-cheat contract', () => {
  test('long task agent fanout stays in DSXU visible modes and bounded tool view', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-agent-long-task',
      userRequest: 'Continue the long task, split read-only investigation from focused verification, and keep agent evidence bounded.',
      requiresAgentEvidence: true,
      sourceEvidenceCount: 4,
      now: 10,
    })
    const agentPlan = resolveDSXUAgentOrchestration({
      taskText: contract.contractId,
      requestedMode: 'swarm mesh team',
      workItems: [
        { taskId: 'read-a', objective: 'inspect owner map', readOnly: true },
        { taskId: 'read-b', objective: 'inspect release evidence', readOnly: true },
      ],
    })
    const view = compileDSXUToolView({
      taskType: contract.taskType,
      tools: TOOL_POOL,
      explicitAllowToolIds: ['Agent', 'TaskOutput'],
    })

    expect(agentPlan.visibleMode).toBe('parallel_fanout')
    expect(agentPlan.evidence.visibleModes).toEqual(['serial_worker', 'parallel_fanout'])
    expect(agentPlan.evidence.runtimePlacementsAreNotPlanningModes).toBe(true)
    expect(agentPlan.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('unsupported agent mode'),
    ]))
    expect(view.visibleToolIds).toEqual(expect.arrayContaining(['Agent', 'TaskOutput', 'Read', 'Grep']))
    expect(view.hiddenToolIds).toEqual(expect.arrayContaining([
      'MCPDocs',
      'SkillRunner',
      'WebSearch',
      'WebFetch',
      'SwarmCoordinator',
      'LegacyToolBus',
    ]))
    expect(validateDSXUPlannedToolInView({ view, plannedToolId: 'WebFetch' }).decision).toBe('deny')
    expect(validateDSXUPlannedToolInView({ view, plannedToolId: 'Agent' }).decision).toBe('allow')
  })

  test('overlapping write workers are serialized before tool execution', () => {
    const plan = resolveDSXUAgentOrchestration({
      taskText: 'patch the same provider owner from multiple worker proposals',
      requestedMode: 'parallel',
      workItems: [
        { taskId: 'write-a', objective: 'patch provider route', ownedFiles: ['src/services/api/deepseek-adapter.ts'] },
        { taskId: 'write-b', objective: 'patch provider cost', ownedFiles: ['src/services/api/deepseek-adapter.ts'] },
      ],
    })

    expect(plan.visibleMode).toBe('serial_worker')
    expect(plan.evidence.hasWriteConflict).toBe(true)
    expect(plan.reasons.join('\n')).toContain('overlapping write scopes block parallel fanout')
    expect(plan.parentFinalGate.join('\n')).toContain('parent final must cite worker evidence')
  })
})
