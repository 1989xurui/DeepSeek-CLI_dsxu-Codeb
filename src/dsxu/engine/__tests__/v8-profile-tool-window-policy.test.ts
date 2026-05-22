import { describe, expect, test } from 'bun:test'
import { compileDSXUExecutionContract } from '../action-contract'
import { compileDSXUToolView } from '../tool-catalog-v1'
import {
  evaluateDSXUV8ToolWindowCount,
  resolveDSXUV8ToolWindowPolicy,
} from '../tool-window-policy-v8'

const FULL_TOOL_POOL = [
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
  'NotebookEdit',
  'TerminalCapture',
  'TaskCreate',
  'TaskUpdate',
]

describe('V8 profile-aware tool window policy', () => {
  test('does not treat every tool view above twelve as invalid', () => {
    const policy = resolveDSXUV8ToolWindowPolicy({ taskType: 'long_task' })
    const decision = evaluateDSXUV8ToolWindowCount({
      visibleToolCount: 24,
      policy,
      actualToolPoolCount: 27,
    })

    expect(policy.profile).toBe('long_task')
    expect(policy.maxVisibleTools).toBe(27)
    expect(decision.valid).toBe(true)
    expect(decision.guards).toEqual([])
  })

  test('keeps ordinary edit bounded while allowing enough senior-programmer tools', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-single-edit',
      userRequest: 'Implement one helper, inspect references, edit code, and run affected tests.',
      sourceEvidenceCount: 2,
      now: 10,
    })

    expect(contract.taskType).toBe('single_file_edit')
    expect(contract.visibleTools.length).toBeGreaterThanOrEqual(8)
    expect(contract.visibleTools.length).toBeLessThanOrEqual(16)
    expect(contract.evidence.join('\n')).toContain('toolWindowProfile:single_file_edit')
  })

  test('compiles a wider long-task tool view without exposing hidden expert tools by accident', () => {
    const view = compileDSXUToolView({
      taskType: 'long_task',
      tools: FULL_TOOL_POOL,
      explicitAllowToolIds: ['Agent', 'TaskOutput'],
    })

    expect(view.profile).toBe('long_task')
    expect(view.visibleToolCount).toBeGreaterThanOrEqual(16)
    expect(view.visibleToolCount).toBeLessThanOrEqual(27)
    expect(view.visibleToolIds).toEqual(expect.arrayContaining(['Read', 'Grep', 'Todo', 'Agent', 'Bash']))
    expect(view.hiddenToolIds).toEqual(expect.arrayContaining(['MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch']))
    expect(view.guards).toEqual([])
  })
})
