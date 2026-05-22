import { describe, expect, test } from 'bun:test'
import { buildDSXUPromptSectionPlan } from '../prompt-section-router'
import { compileDSXUToolView } from '../tool-catalog-v1'

describe('V6-S Prompt Section Router', () => {
  test('keeps ordinary single-file edit prompt thin and expert-free', () => {
    const toolView = compileDSXUToolView({
      taskType: 'single_file_edit',
      tools: ['Read', 'Edit', 'Bash', 'Grep', 'MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'TeamCreate'],
    })
    const plan = buildDSXUPromptSectionPlan({
      taskType: 'single_file_edit',
      toolView,
      riskLevel: 'low',
    })

    expect(plan.schemaVersion).toBe('dsxu.prompt-section-plan.v6s')
    expect(plan.includedSectionIds).toEqual(
      expect.arrayContaining(['identity', 'task_contract', 'tool_view', 'verification_claim_gate']),
    )
    expect(plan.omittedSectionIds).toEqual(
      expect.arrayContaining([
        'agent_serial_worker',
        'agent_parallel_fanout',
        'skill_match',
        'mcp_context',
        'recovery_short',
      ]),
    )
    expect(plan.promptText).not.toContain('MCPDocs')
    expect(plan.promptText).not.toContain('SkillRunner')
    expect(plan.promptText).not.toContain('SwarmCoordinator')
    expect(plan.promptText).not.toContain('TeamCreate')
    expect(plan.guards).toEqual([])
  })

  test('injects only explicitly activated Agent, Skill, and MCP dynamic sections', () => {
    const toolView = compileDSXUToolView({
      taskType: 'long_task',
      tools: ['Read', 'Grep', 'Todo', 'Agent', 'Bash', 'SkillRunner', 'MCPDocs'],
      explicitAllowToolIds: ['Agent'],
    })
    const plan = buildDSXUPromptSectionPlan({
      taskType: 'long_task',
      toolView,
      riskLevel: 'high',
      taskContractAllows: ['agent.serial-worker', 'agent.parallel-fanout'],
      matchedSkillIds: ['code-review'],
      mcpResourceRefs: ['mcp://local/docs'],
    })

    expect(plan.includedSectionIds).toEqual(
      expect.arrayContaining([
        'agent_serial_worker',
        'agent_parallel_fanout',
        'skill_match',
        'mcp_context',
        'recovery_short',
      ]),
    )
    expect(plan.promptText).toContain('Matched skills: code-review')
    expect(plan.promptText).toContain('MCP resources: mcp://local/docs')
    expect(plan.promptText).not.toContain('SwarmCoordinator')
    expect(plan.promptText).not.toContain('TeamCreate')
    expect(plan.cacheBoundary).toEqual({
      stablePrefixLocked: true,
      dynamicTailContainsTaskOnly: true,
    })
    expect(plan.guards).toEqual([])
  })
})
