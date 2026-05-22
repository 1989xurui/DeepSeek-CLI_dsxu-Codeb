import { describe, expect, test } from 'bun:test'
import {
  compileDSXUToolView,
  validateDSXUPlannedToolInView,
} from '../tool-catalog-v1'

describe('V6 Tool View Compiler', () => {
  test('keeps ordinary coding turns inside the V8 profile-aware visible tool cap', () => {
    const view = compileDSXUToolView({
      taskType: 'single_file_edit',
      tools: [
        'Read',
        'Edit',
        'Write',
        'Bash',
        'Grep',
        'Glob',
        'LSP',
        'GitDiff',
        'Evidence',
        'Replay',
        'Todo',
        'MCPDocs',
        'SkillRunner',
        'SwarmCoordinator',
      ],
    })

    expect(view.schemaVersion).toBe('dsxu.tool-view.v5')
    expect(view.owner).toBe('Tool Gate')
    expect(view.visibleToolCount).toBeLessThanOrEqual(16)
    expect(view.visibleToolIds.slice(0, 5)).toEqual(['Read', 'Edit', 'Write', 'Bash', 'Grep'])
    expect(view.hiddenToolIds).toEqual(
      expect.arrayContaining(['MCPDocs', 'SkillRunner', 'SwarmCoordinator']),
    )
    expect(view.guards).toEqual([])
  })

  test('keeps low-risk search views compact without exposing MCP, Skill, or swarm tools', () => {
    const view = compileDSXUToolView({
      taskType: 'search',
      maxVisibleTools: 10,
      tools: [
        'Read',
        'Grep',
        'Glob',
        'LSP',
        'GitDiff',
        'Evidence',
        'Replay',
        'Todo',
        'MCPDocs',
        'SkillRunner',
        'SwarmCoordinator',
        'ForkedAgent',
      ],
    })

    expect(view.profile).toBe('search')
    expect(view.visibleToolCount).toBeGreaterThanOrEqual(6)
    expect(view.visibleToolCount).toBeLessThanOrEqual(10)
    expect(view.visibleToolIds).toEqual(expect.arrayContaining(['Grep', 'Glob', 'Read', 'LSP']))
    expect(view.visibleToolIds).not.toEqual(
      expect.arrayContaining(['MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'ForkedAgent']),
    )
    expect(view.hiddenToolIds).toEqual(
      expect.arrayContaining(['MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'ForkedAgent']),
    )
  })

  test('rejects planned tool execution when the tool is not visible in the compiled view', () => {
    const view = compileDSXUToolView({
      taskType: 'debug',
      tools: ['Read', 'Grep', 'Bash', 'Edit', 'MCPDocs', 'SkillRunner'],
    })

    expect(validateDSXUPlannedToolInView({ view, plannedToolId: 'Bash' })).toMatchObject({
      decision: 'allow',
      matchedVisibleToolId: 'Bash',
    })
    const denied = validateDSXUPlannedToolInView({ view, plannedToolId: 'MCPDocs' })
    expect(denied).toMatchObject({
      decision: 'deny',
      plannedToolId: 'MCPDocs',
    })
    expect(denied.evidence.join('\n')).toContain('hiddenTools:MCPDocs|SkillRunner')
  })

  test('allows searchable tools only when they are explicitly allowed by the owner', () => {
    const view = compileDSXUToolView({
      taskType: 'review',
      tools: ['Read', 'Grep', 'GitDiff', 'Bash', 'MCPDocs', 'SkillRunner'],
      explicitAllowToolIds: ['MCPDocs'],
    })

    expect(view.visibleToolIds).toContain('MCPDocs')
    expect(view.visibleToolIds).not.toContain('SkillRunner')
    expect(view.guards).toEqual([])
  })
})
