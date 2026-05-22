import { describe, expect, test } from 'bun:test'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'
import {
  decideDeepSeekV4Route,
  estimateDeepSeekV4Cost,
} from '../../../utils/model/deepseekV4Control'
import { compileDSXUExecutionContract } from '../action-contract'

describe('V6 Model Router + Cost Policy', () => {
  test('keeps low-risk search on Flash non-thinking and medium coding on Flash thinking', () => {
    const search = compileDSXUExecutionContract({
      taskId: 'route-search',
      userRequest: 'Search where the cost router is used.',
      now: 1,
    })
    expect(search.modelRoute).toBe('flash')
    expect(search.routeDecision.apiMode).toBe('non_thinking')
    expect(search.routeDecision.reason).toBe('lightweight_flash_non_thinking')

    const edit = compileDSXUExecutionContract({
      taskId: 'route-edit',
      userRequest: 'Implement one TypeScript helper and run affected tests.',
      workspaceSignals: {
        changedFiles: ['src/cart.ts'],
      },
      sourceEvidenceCount: 1,
      now: 2,
    })
    expect(edit.modelRoute).toBe('flash_thinking')
    expect(edit.routeDecision.model).toBe('deepseek-v4-flash')
    expect(edit.routeDecision.reason).toBe('coding_flash_thinking_high')
  })

  test('requires explicit Pro admission evidence for high-risk or recovery routes', () => {
    const highRisk = compileDSXUExecutionContract({
      taskId: 'route-high-risk',
      userRequest: 'Refactor provider runtime and permission model across files.',
      workspaceSignals: {
        changedFiles: ['src/provider.ts', 'src/permission.ts'],
      },
      riskTags: ['provider', 'permission'],
      now: 3,
    })
    expect(highRisk.modelRoute).toBe('pro')
    expect(highRisk.routeDecision.approvalRequired).toBe(true)
    expect(highRisk.routeDecision.reason).toBe('high_risk_pro_thinking_max_requires_approval')

    const rescue = decideDeepSeekV4Route({
      workflowKind: 'recovery',
      role: 'recovery',
      failedVerification: true,
      retryAfterFailure: true,
      priorFlashAttempted: true,
      savedTaskEvidence: true,
      allowProAdmission: true,
    })
    expect(rescue.model).toBe('deepseek-v4-pro')
    expect(rescue.proAdmission).toMatchObject({
      state: 'admitted',
      priorFlashAttempted: true,
      savedTaskEvidence: true,
      approvalRequired: true,
    })
  })

  test('records route, cost, usage, and cache evidence for every normalized call', () => {
    const usage = DeepSeekAdapter.normalizeUsage({
      model: 'deepseek-v4-flash',
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 240,
        prompt_cache_hit_tokens: 900,
        prompt_cache_miss_tokens: 300,
      },
      dsxu_route_reason: 'coding_flash_thinking_high',
      dsxu_model_evidence:
        'DSXU model evidence: deepseek-v4-flash thinking high; reason=coding_flash_thinking_high; max_tokens=16384; cost_basis=cache_hit/cache_miss/output.',
    })

    expect(usage.dsxu).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      prompt_cache_hit_tokens: 900,
      prompt_cache_miss_tokens: 300,
      route_reason: 'coding_flash_thinking_high',
    })
    expect(usage.dsxu.estimated_cost_usd).toBe(
      estimateDeepSeekV4Cost({
        model: 'deepseek-v4-flash',
        cacheHitInputTokens: 900,
        cacheMissInputTokens: 300,
        outputTokens: 240,
      }),
    )
    expect(usage.dsxu.model_evidence).toContain('cost_basis=cache_hit/cache_miss/output')
  })

  test('blocks Pro claims when Pro turns lack route evidence', () => {
    const usage = DeepSeekAdapter.normalizeUsage({
      model: 'deepseek-v4-pro',
      usage: {
        prompt_tokens: 500,
        completion_tokens: 100,
      },
    })

    expect(usage.dsxu.model).toBe('deepseek-v4-pro')
    expect(usage.dsxu.route_reason).toBeUndefined()
    expect(usage.dsxu.model_evidence).toBeUndefined()
  })
})
