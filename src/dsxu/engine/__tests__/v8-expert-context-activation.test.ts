import { describe, expect, test } from 'bun:test'
import {
  compileDSXUCapabilityActivationPlan,
  resolveDSXUToolCapabilityExposure,
} from '../capability-registry'
import { compileDSXUExecutionContract } from '../action-contract'
import { compileDSXUToolView } from '../tool-catalog-v1'

describe('V8 expert context activation contract', () => {
  test('ordinary coding keeps expert/search/network tools out of the default model-visible view', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-default-tool-view',
      userRequest: 'Implement one helper and run the affected unit test.',
      sourceEvidenceCount: 2,
      now: 20,
    })
    const activation = compileDSXUCapabilityActivationPlan({ taskType: contract.taskType })
    const view = compileDSXUToolView({
      taskType: contract.taskType,
      tools: ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch'],
    })

    expect(activation.activeCapabilityIds).not.toContain('mcp.expert')
    expect(activation.activeCapabilityIds).not.toContain('skills.searchable')
    expect(resolveDSXUToolCapabilityExposure('WebFetch')).toBe('searchable')
    expect(resolveDSXUToolCapabilityExposure('WebSearch')).toBe('searchable')
    expect(view.visibleToolIds).not.toEqual(expect.arrayContaining(['MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch']))
    expect(view.hiddenToolIds).toEqual(expect.arrayContaining(['MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch']))
  })

  test('expert resources activate only through explicit capability evidence', () => {
    const contract = compileDSXUExecutionContract({
      taskId: 'v8-expert-review',
      userRequest: 'Review release security risk with explicit MCP docs and skill evidence.',
      riskTags: ['release', 'security'],
      publicClaimIntent: true,
      sourceEvidenceCount: 3,
      now: 21,
    })
    const activation = compileDSXUCapabilityActivationPlan({
      taskType: contract.taskType,
      matchedSkillIds: ['release-review'],
      mcpResourceRefs: ['mcp://release/security'],
      explicitCapabilityIds: ['mcp.expert'],
    })
    const view = compileDSXUToolView({
      taskType: contract.taskType,
      tools: ['Read', 'Grep', 'GitDiff', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch'],
      explicitAllowToolIds: ['MCPDocs'],
    })

    expect(contract.risk).toBe('critical')
    expect(contract.claimPolicy).toBe('no_claim')
    expect(activation.activeCapabilityIds).toEqual(expect.arrayContaining(['mcp.expert', 'skills.searchable']))
    expect(view.visibleToolIds).toContain('MCPDocs')
    expect(view.visibleToolIds).not.toEqual(expect.arrayContaining(['SkillRunner', 'WebSearch', 'WebFetch']))
  })
})
