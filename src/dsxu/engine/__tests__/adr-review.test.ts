/**
 * ADR + Cross-Review 测试
 * #5.4 ADR 模板 + 独立 Reviewer
 */

import { describe, it, expect, vi } from 'vitest'
import {
  ADR_TEMPLATES,
  getADRTemplateNames,
  selectADRTemplate,
  crossReview,
  runADRWorkflow,
  isArchitectureTask,
} from '../adr-review'
import type { LLMCallFn, LLMResponse } from '../types'

// ── Helper: mock LLM ──

function createMockLLMCall(responses: string[]): LLMCallFn {
  let idx = 0
  return async (_msgs, _tools, _opts): Promise<LLMResponse> => {
    const content = responses[idx] || responses[responses.length - 1]
    idx++
    return {
      content,
      toolCalls: [],
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 200 },
    }
  }
}

// ── ADR Templates ──

describe('ADR_TEMPLATES', () => {
  it('should have 5 templates', () => {
    expect(Object.keys(ADR_TEMPLATES)).toHaveLength(5)
  })

  it('should include all expected template keys', () => {
    const keys = Object.keys(ADR_TEMPLATES)
    expect(keys).toContain('event-driven')
    expect(keys).toContain('microkernel')
    expect(keys).toContain('mvc-service-repo')
    expect(keys).toContain('cqrs-eventsource')
    expect(keys).toContain('hexagonal')
  })

  it('each template should contain ADR structure', () => {
    for (const [name, tpl] of Object.entries(ADR_TEMPLATES)) {
      expect(tpl).toContain('### Context')
      expect(tpl).toContain('### Risks & Mitigations')
      expect(tpl).toContain('### Decision Status')
    }
  })
})

// ── getADRTemplateNames ──

describe('getADRTemplateNames', () => {
  it('should return 5 names', () => {
    expect(getADRTemplateNames()).toHaveLength(5)
  })
})

// ── selectADRTemplate ──

describe('selectADRTemplate', () => {
  it('should select event-driven for event/message keywords', () => {
    expect(selectADRTemplate('Design an event-driven architecture')).toBe('event-driven')
    expect(selectADRTemplate('Implement message queue system')).toBe('event-driven')
    expect(selectADRTemplate('pub/sub pattern for notifications')).toBe('event-driven')
    expect(selectADRTemplate('设计消息队列系统')).toBe('event-driven')
  })

  it('should select microkernel for plugin keywords', () => {
    expect(selectADRTemplate('Build a plugin system')).toBe('microkernel')
    expect(selectADRTemplate('Design extension architecture')).toBe('microkernel')
    expect(selectADRTemplate('实现插件机制')).toBe('microkernel')
  })

  it('should select cqrs-eventsource for CQRS keywords', () => {
    expect(selectADRTemplate('Implement CQRS pattern')).toBe('cqrs-eventsource')
    expect(selectADRTemplate('Event sourcing for order system')).toBe('cqrs-eventsource')
    expect(selectADRTemplate('事件溯源架构')).toBe('cqrs-eventsource')
  })

  it('should select hexagonal for ports/adapters keywords', () => {
    expect(selectADRTemplate('Hexagonal architecture for payment')).toBe('hexagonal')
    expect(selectADRTemplate('Design port and adapter layers')).toBe('hexagonal')
    expect(selectADRTemplate('六边形架构设计')).toBe('hexagonal')
  })

  it('should default to mvc-service-repo', () => {
    expect(selectADRTemplate('Build a web application')).toBe('mvc-service-repo')
    expect(selectADRTemplate('Create REST API')).toBe('mvc-service-repo')
  })
})

// ── isArchitectureTask ──

describe('isArchitectureTask', () => {
  it('should detect architecture-related tasks', () => {
    expect(isArchitectureTask('Design the system architecture')).toBe(true)
    expect(isArchitectureTask('设计架构方案')).toBe(true)
    expect(isArchitectureTask('Refactor entire codebase')).toBe(true)
    expect(isArchitectureTask('Build microservice for auth')).toBe(true)
    expect(isArchitectureTask('从零开始搭建项目')).toBe(true)
    expect(isArchitectureTask('migration plan for database')).toBe(true)
    expect(isArchitectureTask('技术选型讨论')).toBe(true)
    expect(isArchitectureTask('Write an ADR for this decision')).toBe(true)
    expect(isArchitectureTask('系统设计文档')).toBe(true)
    expect(isArchitectureTask('redesign the module structure')).toBe(true)
    expect(isArchitectureTask('重构登录模块')).toBe(true)
  })

  it('should not detect non-architecture tasks', () => {
    expect(isArchitectureTask('Fix the login bug')).toBe(false)
    expect(isArchitectureTask('Add unit tests')).toBe(false)
    expect(isArchitectureTask('Update the README')).toBe(false)
    expect(isArchitectureTask('Format the code')).toBe(false)
  })
})

// ── crossReview ──

describe('crossReview', () => {
  it('should parse approved JSON review', async () => {
    const llm = createMockLLMCall([
      '{"approved": true, "issues": [], "feedback": "Well-structured ADR, all sections filled."}',
    ])

    const result = await crossReview('## ADR: Test\n### Context\nSome context...', llm, 1)
    expect(result.approved).toBe(true)
    expect(result.issues).toHaveLength(0)
    expect(result.feedback).toContain('Well-structured')
    expect(result.round).toBe(1)
  })

  it('should parse rejected JSON review with issues', async () => {
    const llm = createMockLLMCall([
      '{"approved": false, "issues": ["Missing risk analysis", "Interface contract incomplete"], "feedback": "Needs more detail."}',
    ])

    const result = await crossReview('## ADR: Incomplete', llm, 2)
    expect(result.approved).toBe(false)
    expect(result.issues).toHaveLength(2)
    expect(result.issues[0]).toContain('Missing risk')
    expect(result.round).toBe(2)
  })

  it('should handle JSON embedded in markdown', async () => {
    const llm = createMockLLMCall([
      'Here is my review:\n```json\n{"approved": false, "issues": ["No data flow"], "feedback": "Incomplete"}\n```',
    ])

    const result = await crossReview('## ADR', llm)
    expect(result.approved).toBe(false)
    expect(result.issues).toContain('No data flow')
  })

  it('should fallback to text analysis when no JSON', async () => {
    const llm = createMockLLMCall([
      'This ADR has several issues. The risk section is incomplete and missing key considerations.',
    ])

    const result = await crossReview('## ADR', llm)
    expect(result.approved).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('should approve when text has no issue keywords', async () => {
    const llm = createMockLLMCall([
      'The ADR looks great. All sections are well-documented and thorough.',
    ])

    const result = await crossReview('## ADR', llm)
    expect(result.approved).toBe(true)
  })

  it('should handle LLM call failure gracefully', async () => {
    const llm: LLMCallFn = async () => {
      throw new Error('API timeout')
    }

    const result = await crossReview('## ADR', llm)
    // Should not block on failure
    expect(result.approved).toBe(true)
    expect(result.feedback).toContain('Review failed')
  })
})

// ── runADRWorkflow ──

describe('runADRWorkflow', () => {
  it('should complete in one round when approved', async () => {
    const llm = createMockLLMCall([
      // Generate ADR
      '## ADR-001: Auth Service\n### Context\nNeed authentication...\n### Decision: MVC\n...',
      // Review - approved
      '{"approved": true, "issues": [], "feedback": "Looks good"}',
    ])

    const result = await runADRWorkflow('Build auth service', 'Node.js project', llm)
    expect(result.adr).toContain('ADR-001')
    expect(result.reviews).toHaveLength(1)
    expect(result.reviews[0].approved).toBe(true)
    expect(result.template).toBe('mvc-service-repo')
  })

  it('should revise when first review has issues', async () => {
    const llm = createMockLLMCall([
      // Generate ADR
      '## ADR: Initial draft',
      // Review 1 - rejected
      '{"approved": false, "issues": ["Missing risks"], "feedback": "Add risk section"}',
      // Revise
      '## ADR: Revised with risks\n### Risks\n...',
      // Review 2 - approved
      '{"approved": true, "issues": [], "feedback": "Good now"}',
    ])

    const result = await runADRWorkflow('Design event system', 'Kafka project', llm)
    expect(result.reviews).toHaveLength(2)
    expect(result.reviews[0].approved).toBe(false)
    expect(result.reviews[1].approved).toBe(true)
    expect(result.template).toBe('event-driven')
  })

  it('should stop after 2 review rounds max', async () => {
    const llm = createMockLLMCall([
      // Generate
      '## ADR: Draft',
      // Review 1 - rejected
      '{"approved": false, "issues": ["Problem A"], "feedback": "Fix A"}',
      // Revise 1
      '## ADR: Rev 1',
      // Review 2 - still rejected
      '{"approved": false, "issues": ["Problem B"], "feedback": "Fix B"}',
      // Would revise again, but max rounds reached
      '## ADR: Rev 2',
    ])

    const result = await runADRWorkflow('Build plugin system', '', llm)
    // Max 2 review rounds
    expect(result.reviews.length).toBeLessThanOrEqual(2)
    expect(result.template).toBe('microkernel')
  })

  it('should select correct template based on task', async () => {
    const llm = createMockLLMCall([
      '## ADR: CQRS Design',
      '{"approved": true, "issues": [], "feedback": "OK"}',
    ])

    const result = await runADRWorkflow('Implement CQRS with event sourcing', '', llm)
    expect(result.template).toBe('cqrs-eventsource')
  })
})
