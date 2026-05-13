import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
  DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS,
  decideDeepSeekV4Route,
  decideDeepSeekV4RuntimeModelOverride,
  estimateDeepSeekV4Cost,
  formatDeepSeekV4RequestEvidence,
  inferDeepSeekV4RouteInput,
  inferDeepSeekV4WorkflowKind,
  normalizeDeepSeekV4Model,
} from '../../../utils/model/deepseekV4Control'
import { resolveDeepSeekV4CostRoute } from '../../../utils/model/deepseekV4CostRouter'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'
import {
  calculateUSDCost,
  getModelPricingString,
} from '../../../utils/modelCost'
import { getModelContextLimit, getModelMaxOutputTokens } from '../model-limits'
import { estimateCost, estimateCostDetailed } from '../cost-tracker'
import { recommendModelForTask } from '../model-config'
import { SamplingPolicy } from '../../../services/sampling-policy'

describe('DeepSeek V4 unified control layer', () => {
  test('known model route surfaces delegate to the unified V4 control layer', () => {
    const repoRoot = process.cwd()
    const surfaces = [
      ['query loop', 'src/query.ts', 'decideDeepSeekV4RuntimeModelOverride'],
      ['adapter cost router', 'src/utils/model/deepseekV4CostRouter.ts', 'decideDeepSeekV4Route'],
      ['deepseek policy facade', 'src/dsxu/engine/deepseek-model-policy.ts', 'decideDeepSeekV4Route'],
      ['model routing facade', 'src/dsxu/engine/model-routing-control.ts', 'decideDeepSeekV4Route'],
      ['sampling policy', 'src/services/sampling-policy.ts', 'decideDeepSeekV4Route'],
      ['benchmark runner', 'scripts/benchmark/dsxu-mainline-benchmark.ts', 'decideDeepSeekV4Route'],
    ] as const

    for (const [label, filePath, requiredSymbol] of surfaces) {
      const source = readFileSync(join(repoRoot, filePath), 'utf8')
      expect(source, label).toContain('deepseekV4Control')
      expect(source, label).toContain(requiredSymbol)
    }

    const benchmarkSource = readFileSync(join(repoRoot, 'scripts/benchmark/dsxu-mainline-benchmark.ts'), 'utf8')
    expect(benchmarkSource).toContain("return 'auto'")
    expect(benchmarkSource).toContain("if (mode === 'flash' || mode === 'auto') return 'deepseek-v4-flash'")
  })

  test('normalizes old model aliases through the single V4 table', () => {
    expect(normalizeDeepSeekV4Model('deepseek-chat')).toBe('deepseek-v4-flash')
    expect(normalizeDeepSeekV4Model('deepseek-reasoner')).toBe('deepseek-v4-flash')
    expect(recommendModelForTask('planning').name).toBe('deepseek-v4-flash')
    expect(recommendModelForTask('fim').name).toBe('deepseek-v4-pro')
  })

  test('routes planning, review, and light recovery to Flash max before Pro admission', () => {
    expect(decideDeepSeekV4Route({ workflowKind: 'planning' }).model).toBe('deepseek-v4-flash')
    expect(decideDeepSeekV4Route({ workflowKind: 'planning' }).reason).toBe('planning_flash_thinking_max')
    expect(decideDeepSeekV4Route({ workflowKind: 'review' }).model).toBe('deepseek-v4-flash')
    expect(decideDeepSeekV4Route({ workflowKind: 'review' }).reason).toBe('review_flash_thinking_max')
    expect(decideDeepSeekV4Route({ workflowKind: 'recovery' }).model).toBe('deepseek-v4-flash')
    expect(decideDeepSeekV4Route({ workflowKind: 'recovery' }).reason).toBe('recovery_flash_thinking_max')
    expect(decideDeepSeekV4Route({ workflowKind: 'feature', failedVerification: true }).reason).toBe('failed_verification_pro_thinking_max')
  })

  test('keeps ordinary verification on Flash first and upgrades only after failure evidence', () => {
    const ordinaryVerification = inferDeepSeekV4RouteInput(
      'Run the exact bun test for this focused case and verify it passes.',
      { initialPlanningTurn: true },
    )
    const ordinaryDecision = decideDeepSeekV4Route(ordinaryVerification)

    expect(ordinaryVerification.workflowKind).toBe('verification')
    expect(ordinaryVerification.role).toBe('verifier')
    expect(ordinaryDecision.model).toBe('deepseek-v4-flash')
    expect(ordinaryDecision.apiMode).toBe('non_thinking')
    expect(ordinaryDecision.reason).toBe('verification_flash_non_thinking')
    expect(ordinaryDecision.maxTokens).toBe(8_192)

    const explicitVerifier = decideDeepSeekV4Route({ role: 'verifier' })
    expect(explicitVerifier.model).toBe('deepseek-v4-flash')
    expect(explicitVerifier.reason).toBe('verification_flash_non_thinking')

    const failedVerification = decideDeepSeekV4Route({
      workflowKind: 'verification',
      role: 'verifier',
      failedVerification: true,
    })
    expect(failedVerification.model).toBe('deepseek-v4-pro')
    expect(failedVerification.reason).toBe('failed_verification_pro_thinking_max')
  })

  test('does not confuse ordinary verify/check wording with review, and routes ordinary review to Flash max', () => {
    const codingWithVerify = inferDeepSeekV4RouteInput(
      'Add a small helper with tests, verify the focused test passes, then report evidence.',
      { initialPlanningTurn: false },
    )
    expect(codingWithVerify.workflowKind).toBe('feature')
    expect(decideDeepSeekV4Route(codingWithVerify).model).toBe('deepseek-v4-flash')

    const reviewInput = inferDeepSeekV4RouteInput(
      'Review the target code for security and permission risks before release.',
      { initialPlanningTurn: false },
    )
    expect(reviewInput.workflowKind).toBe('review')
    expect(reviewInput.role).toBe('reviewer')
    const reviewDecision = decideDeepSeekV4Route(reviewInput)
    expect(reviewDecision.model).toBe('deepseek-v4-flash')
    expect(reviewDecision.reason).toBe('review_flash_thinking_max')
  })

  test('routes high-risk permission replans to Pro without moving safe path inspection off Flash', () => {
    const safePathInspection = inferDeepSeekV4RouteInput(
      'Inspect a Windows path safely with PowerShell without destructive commands, report evidence, and stop.',
      { initialPlanningTurn: true },
    )
    expect(decideDeepSeekV4Route(safePathInspection).model).toBe('deepseek-v4-flash')

    const permissionReplan = inferDeepSeekV4RouteInput(
      'A requested action would require force-push and deleting a protected cache directory. Treat that action as denied and replan with a read-only permission-safe path.',
      { initialPlanningTurn: true },
    )
    const permissionDecision = decideDeepSeekV4Route(permissionReplan)
    expect(permissionReplan.workflowKind).toBe('review')
    expect(permissionReplan.role).toBe('reviewer')
    expect(permissionReplan.riskLevel).toBe('high')
    expect(permissionDecision.model).toBe('deepseek-v4-pro')
    expect(permissionDecision.reason).toBe('high_risk_pro_thinking_max_requires_approval')

    const networkExecuteReview = inferDeepSeekV4RouteInput(
      'Explain how EncodedCommand and iwr | iex network-download-execute patterns fail closed.',
      { initialPlanningTurn: true },
    )
    expect(decideDeepSeekV4Route(networkExecuteReview).model).toBe('deepseek-v4-pro')
  })

  test('downgrades auto-routed Pro back to Flash for ordinary verification but preserves explicit Pro', () => {
    const ordinaryVerification = decideDeepSeekV4Route({
      workflowKind: 'verification',
      role: 'verifier',
    })
    const autoProLeak = decideDeepSeekV4RuntimeModelOverride({
      currentModel: 'deepseek-v4-pro',
      routeDecision: ordinaryVerification,
      autoOverrideActive: false,
      explicitModelOverride: undefined,
    })

    expect(autoProLeak.action).toBe('downgrade_to_flash')
    expect(autoProLeak.model).toBe('deepseek-v4-flash')
    expect(autoProLeak.nextAutoOverrideActive).toBe(false)
    expect(autoProLeak.thinkingConfig).toEqual({ type: 'disabled' })

    const userPinnedPro = decideDeepSeekV4RuntimeModelOverride({
      currentModel: 'deepseek-v4-pro',
      routeDecision: ordinaryVerification,
      autoOverrideActive: false,
      explicitModelOverride: 'pro',
    })

    expect(userPinnedPro.action).toBe('keep')
    expect(userPinnedPro.model).toBe('deepseek-v4-pro')
  })

  test('can disable route model upgrades for model-forced baseline runs while preserving route thinking', () => {
    const failedVerification = decideDeepSeekV4Route({
      workflowKind: 'review',
      role: 'reviewer',
      failedVerification: true,
    })
    const override = decideDeepSeekV4RuntimeModelOverride({
      currentModel: 'deepseek-v4-flash',
      routeDecision: failedVerification,
      disableModelUpgrade: true,
    })

    expect(failedVerification.model).toBe('deepseek-v4-pro')
    expect(override.action).toBe('keep')
    expect(override.model).toBe('deepseek-v4-flash')
    expect(override.thinkingConfig).toEqual({
      type: 'enabled',
      budgetTokens: 32_768,
    })

    const costRoute = resolveDeepSeekV4CostRoute({
      params: {
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
      },
      routeInput: {
        workflowKind: 'review',
        role: 'reviewer',
        failedVerification: true,
      },
      env: {
        DSXU_ROUTE_MODEL_UPGRADE_DISABLED: '1',
      },
    })

    expect(costRoute.routeDecision?.model).toBe('deepseek-v4-pro')
    expect(costRoute.requestedModel).toBe('deepseek-v4-flash')
    expect(costRoute.thinkingEnabled).toBe(true)
    expect(costRoute.reasoningEffort).toBe('max')
  })

  test('formats request evidence from the shared V4 control layer', () => {
    expect(formatDeepSeekV4RequestEvidence({
      model: 'deepseek-v4-pro',
      apiMode: 'thinking',
      reasoningEffort: 'max',
      reason: 'failed_verification_pro_thinking_max',
      maxTokens: 65_536,
    })).toBe('DSXU model evidence: deepseek-v4-pro thinking max; reason=failed_verification_pro_thinking_max; max_tokens=65536; cost_basis=cache_hit/cache_miss/output.')
  })

  test('adapter request plan applies query-loop route input without a second router', () => {
    const costRoute = resolveDeepSeekV4CostRoute({
      params: {
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        max_tokens: 999_999,
      },
      routeInput: { workflowKind: 'review' },
    })
    const plan = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      max_tokens: 999_999,
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'review' },
    })

    expect(costRoute.requestedModel).toBe('deepseek-v4-flash')
    expect(plan.requestedModel).toBe(costRoute.requestedModel)
    expect(plan.modelName).toBe('deepseek-v4-flash')
    expect(plan.thinkingEnabled).toBe(costRoute.thinkingEnabled)
    expect(plan.reasoningEffort).toBe(costRoute.reasoningEffort)
    expect(plan.maxTokens).toBe(costRoute.maxTokens)
    expect(plan.maxTokens).toBe(32_768)
    expect(plan.routeReason).toBe(costRoute.routeReason)
    expect(plan.modelEvidence).toBe(costRoute.modelEvidence)
  })

  test('cost router is the single adapter boundary for env thinking, max_tokens, route reason, and model evidence', () => {
    const routed = resolveDeepSeekV4CostRoute({
      params: {
        model: 'deepseek-v4-pro',
        thinking: { type: 'disabled' },
        max_tokens: 12_345,
      },
      env: {
        DEEPSEEK_MODEL: 'deepseek-v4-flash',
        DSXU_DEEPSEEK_THINKING: 'disabled',
      },
    })

    expect(routed.requestedModel).toBe('deepseek-v4-pro')
    expect(routed.thinkingEnabled).toBe(false)
    expect(routed.apiMode).toBe('non_thinking')
    expect(routed.reasoningEffort).toBeUndefined()
    expect(routed.maxTokens).toBe(12_345)
    expect(routed.routeReason).toBe('adapter_actual_request')
    expect(routed.modelEvidence).toBe('DSXU model evidence: deepseek-v4-pro non_thinking; reason=adapter_actual_request; max_tokens=12345; cost_basis=cache_hit/cache_miss/output.')
  })

  test('adapter request plan preserves low-cost Flash behavior without route input', () => {
    const plan = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      max_tokens: 12_000,
    }, 'https://openrouter.ai/api/v1')

    expect(plan.requestedModel).toBe('deepseek-v4-flash')
    expect(plan.modelName).toBe('deepseek/deepseek-v4-flash')
    expect(plan.thinkingEnabled).toBe(false)
    expect(plan.reasoningEffort).toBeUndefined()
    expect(plan.maxTokens).toBe(12_000)
    expect(plan.modelEvidence).toContain('reason=adapter_actual_request')
  })

  test('query-loop route input overrides default thinking for Flash coding', () => {
    const plan = DeepSeekAdapter.resolveRequestPlanForBaseUrl({
      model: 'deepseek-v4-flash',
      thinking: { type: 'enabled' },
    }, 'https://api.deepseek.com', {
      dsxuRouteInput: { workflowKind: 'feature' },
    })

    expect(plan.requestedModel).toBe('deepseek-v4-flash')
    expect(plan.modelName).toBe('deepseek-v4-flash')
    expect(plan.thinkingEnabled).toBe(false)
    expect(plan.reasoningEffort).toBeUndefined()
    expect(plan.maxTokens).toBe(16_384)
    expect(plan.routeReason).toBe('coding_flash_non_thinking')
  })

  test('does not let safety guardrail wording turn a feature task into recovery', () => {
    const guardedFeaturePrompt = [
      'A failed Edit caused by the wrong path counts as task drift.',
      'If a verification result looks contradictory after a successful Edit, run one clean verification command.',
      'As soon as bun test reports 1 pass and 0 fail, output the requested PASS marker and stop.',
      'You are in a scoped fixture. Run bun test, then edit only src/strings.js to add the missing exported slugify helper.',
    ].join('\n')

    const routeInput = inferDeepSeekV4RouteInput(guardedFeaturePrompt, {
      initialPlanningTurn: true,
    })
    const decision = decideDeepSeekV4Route(routeInput)

    expect(routeInput.workflowKind).toBe('feature')
    expect(decision.model).toBe('deepseek-v4-flash')
    expect(decision.reason).toBe('coding_flash_non_thinking')
  })

  test('still treats explicit failed verification as recovery', () => {
    const routeInput = inferDeepSeekV4RouteInput(
      'Recover after failed verification in the current build and rerun the smallest test.',
      { initialPlanningTurn: true },
    )

    expect(routeInput.workflowKind).toBe('recovery')
    expect(decideDeepSeekV4Route(routeInput).reason).toBe('failed_verification_pro_thinking_max')
  })

  test('usage records adapter model evidence for final audit trails', () => {
    const usage = DeepSeekAdapter.normalizeUsage({
      model: 'deepseek-v4-pro',
      usage: {
        prompt_tokens: 30,
        completion_tokens: 7,
        prompt_cache_hit_tokens: 10,
        prompt_cache_miss_tokens: 20,
      },
      dsxu_model_evidence: 'DSXU model evidence: deepseek-v4-pro thinking high; reason=planning_review_pro_thinking_high; max_tokens=32768; cost_basis=cache_hit/cache_miss/output.',
      dsxu_route_reason: 'planning_review_pro_thinking_high',
    })

    expect(usage.dsxu.model).toBe('deepseek-v4-pro')
    expect(usage.dsxu.model_evidence).toContain('deepseek-v4-pro thinking high')
    expect(usage.dsxu.route_reason).toBe('planning_review_pro_thinking_high')
  })

  test('infers Chinese workflow labels without mojibake patterns', () => {
    expect(inferDeepSeekV4WorkflowKind('\u5148\u505a\u67b6\u6784\u89c4\u5212')).toBe('planning')
    expect(inferDeepSeekV4WorkflowKind('\u5ba1\u6838\u9a8c\u8bc1\u5931\u8d25\u540e\u7684\u6062\u590d')).toBe('recovery')
    expect(inferDeepSeekV4WorkflowKind('\u65b0\u589e\u529f\u80fd\u5e76\u5b9e\u73b0')).toBe('feature')
    expect(inferDeepSeekV4WorkflowKind('\u68b3\u7406\u4ee3\u7801\u5e93')).toBe('repo_understanding')
  })

  test('routes first-turn multi-module website requests to Flash max planning without moving normal coding off Flash', () => {
    const websiteRequest = [
      '\u5728 D \u76d8\u65b0\u5efa\u4e00\u4e2a xu-rui \u6587\u4ef6\u5939\uff0c\u505a\u4e00\u4e2a\u5b8c\u6574\u97f3\u4e50\u673a\u6784\u5c55\u793a\u7f51\u7ad9\uff0c\u524d\u7aef\u5c55\u793a\u7684\u3002',
      '1.\u673a\u6784\u4ecb\u7ecd\u3001\u54c1\u724c\u6545\u4e8b\u3001\u73af\u5883\u56fe\u7247 / \u89c6\u9891',
      '2.\u8bfe\u7a0b\u5206\u7c7b\u5c55\u793a',
      '3.\u5b66\u5458\u6210\u679c\u5c55\u793a',
      '4.\u53ef\u4ee5\u54a8\u8be2\u7136\u540e\u81ea\u52a8\u56de\u590d\u8054\u7cfb\u65b9\u5f0f',
      '5.\u73b0\u5728\u95e8\u5e97\u4fe1\u606f',
      '6.\u6d3b\u52a8\u5ba3\u4f20\u3001\u6d3b\u52a8\u62a5\u540d',
      '7.\u6d88\u606f\u63d0\u9192',
    ].join('\n')
    const routeInput = inferDeepSeekV4RouteInput(websiteRequest, {
      initialPlanningTurn: true,
    })
    const decision = decideDeepSeekV4Route(routeInput)

    expect(routeInput.workflowKind).toBe('planning')
    expect(routeInput.role).toBe('planner')
    expect(decision.model).toBe('deepseek-v4-flash')
    expect(decision.reason).toBe('planning_flash_thinking_max')

    const followupCoding = inferDeepSeekV4RouteInput(websiteRequest, {
      initialPlanningTurn: false,
    })
    expect(decideDeepSeekV4Route(followupCoding).model).toBe('deepseek-v4-flash')
  })

  test('keeps bounded coding fixtures on Flash despite safety guardrails and failure-report wording', () => {
    const safetyWrappedBugfix = [
      'Fixture path: .dsxu/runs/example/fixture',
      'Absolute fixture path: D:\\DSXU-code\\.dsxu\\runs\\example\\fixture',
      'Work only inside that fixture path. Do not edit the DSXU repository source for this benchmark case.',
      'Do not Read a directory path. For fixture file discovery, use Glob for file names and Grep for content.',
      'Never kill bun/node/PowerShell processes, clear global caches, install dependencies, or delete files outside the fixture.',
      'If blocked, say PARTIAL/FAIL with the failing command evidence.',
      'You are in a scoped DSXU V8 mutation fixture. Run the tests first, inspect only this fixture, fix the cart total bug with the smallest code change, rerun bun test, and finish only after the test output passes.',
    ].join('\n')
    const bugfixRoute = inferDeepSeekV4RouteInput(safetyWrappedBugfix, {
      initialPlanningTurn: true,
    })
    const bugfixDecision = decideDeepSeekV4Route(bugfixRoute)

    expect(bugfixRoute).toEqual({ workflowKind: 'bugfix', role: 'coder' })
    expect(bugfixDecision.model).toBe('deepseek-v4-flash')
    expect(bugfixDecision.reason).toBe('coding_flash_non_thinking')

    const safetyWrappedFeature = [
      'Fixture path: .dsxu/runs/example/fixture',
      'Absolute fixture path: D:\\DSXU-code\\.dsxu\\runs\\example\\fixture',
      'Work only inside that fixture path. Do not edit the DSXU repository source for this benchmark case.',
      'After an Edit or Write reports success, run the smallest verification command next.',
      'Never kill bun/node/PowerShell processes, clear global caches, install dependencies, or delete files outside the fixture.',
      'Product live task. Work only inside the fixture. Run bun test with PowerShell first. Read src/strings.js and test/strings.test.js at most once each. Add the missing exported slugify helper in src/strings.js while preserving titleCase. Prefer one focused Edit. After Edit reports success, immediately run bun test with PowerShell from the fixture directory.',
    ].join('\n')
    const featureRoute = inferDeepSeekV4RouteInput(safetyWrappedFeature, {
      initialPlanningTurn: true,
    })
    const featureDecision = decideDeepSeekV4Route(featureRoute)

    expect(featureRoute).toEqual({ workflowKind: 'feature', role: 'coder' })
    expect(featureDecision.model).toBe('deepseek-v4-flash')
    expect(featureDecision.reason).toBe('coding_flash_non_thinking')
  })

  test('generalizes first-turn Flash max planning across DSXU, remote, and memory complex work', () => {
    const complexRequests = [
      [
        'dsxu-mainline-audit',
        [
          '\u5168\u9762\u6838\u5ba1 DSXU \u4e3b\u94fe 8 \u4e2a\u533a\u57df\uff1aREPL, messages, AgentTool, LocalAgentTask, FileEditTool, compact, permissions, shell\u3002',
          '1.\u8f93\u51fa V18 \u6267\u884c\u65b9\u6848',
          '2.\u8865\u9f50\u9a8c\u6536\u77e9\u9635\u548c trace \u8bc1\u636e',
          '3.\u68c0\u67e5\u5de5\u5177\u94fe\u3001\u6743\u9650\u3001TUI \u80cc\u666f\u751f\u547d\u5468\u671f',
          '4.\u6309\u98ce\u9669\u5206\u9636\u6bb5\u6267\u884c',
        ].join('\n'),
      ],
      [
        'remote-ci-migration',
        [
          '\u8bbe\u8ba1 Remote / CI/CD / network proxy \u8fc1\u79fb\u65b9\u6848\uff0c\u8981\u5546\u4e1a\u5316\u548c\u5f00\u6e90\u6253\u5305\u53ef\u7528\u3002',
          '1.\u63a7\u5236\u9762 session registry',
          '2.permission response \u548c viewerOnly \u751f\u547d\u5468\u671f',
          '3.proxy env injection \u548c header \u8fc7\u6ee4',
          '4.\u9a8c\u6536\u3001\u56de\u6eda\u3001\u8bc1\u636e\u8def\u5f84',
        ].join('\n'),
      ],
      [
        'memory-resume-plan',
        [
          '\u5b8c\u6574\u6df1\u5316 LocalMemory + ExperienceStore + smooth resume\uff0c\u4fdd\u8bc1\u957f\u4efb\u52a1\u4e0a\u4e0b\u6587\u7ba1\u7406\u548c\u89c4\u5212\u80fd\u529b\u3002',
          '1.\u8bb0\u5fc6\u5199\u5165\u548c\u8bfb\u53d6\u6743\u9650',
          '2.\u538b\u7f29\u540e\u7684 task snapshot resume',
          '3.\u5931\u8d25\u6062\u590d\u548c\u8bc1\u636e\u91cd\u653e',
          '4.\u6253\u699c\u4efb\u52a1\u9a8c\u6536\u6307\u6807',
        ].join('\n'),
      ],
    ] as const

    for (const [label, request] of complexRequests) {
      const routeInput = inferDeepSeekV4RouteInput(request, {
        initialPlanningTurn: true,
      })
      const decision = decideDeepSeekV4Route(routeInput)
      expect(routeInput.workflowKind, label).toBe('planning')
      expect(routeInput.role, label).toBe('planner')
      expect(decision.model, label).toBe('deepseek-v4-flash')
      expect(decision.reason, label).toBe('planning_flash_thinking_max')
    }

    const smallChange = inferDeepSeekV4RouteInput('\u628a Header \u6309\u94ae\u989c\u8272\u6539\u6210\u84dd\u8272', {
      initialPlanningTurn: true,
    })
    expect(decideDeepSeekV4Route(smallChange).model).toBe('deepseek-v4-flash')
  })

  test('generalizes first-turn Flash max planning across non-website complex engineering tasks', () => {
    const complexEngineeringRequests = [
      [
        'backend-billing-platform',
        [
          'Build a complete backend billing service with auth, database migrations, webhook ingestion, background jobs, observability, tests, and deployment notes.',
          '1. API routes and validation',
          '2. PostgreSQL schema and migration plan',
          '3. Retry-safe worker queue',
          '4. Native integration tests',
          '5. Rollout and rollback checklist',
        ].join('\n'),
      ],
      [
        'terminal-automation-cli',
        [
          'Implement a full terminal automation CLI for developer workflows across Windows and WSL.',
          '1. Shell environment discovery',
          '2. Permission-visible execution lifecycle',
          '3. Background task heartbeat and cleanup',
          '4. Trace artifacts and failure taxonomy',
        ].join('\n'),
      ],
      [
        'monorepo-refactor',
        [
          'Refactor a monorepo package boundary without breaking public APIs, tests, generated types, or build cache behavior.',
          '1. dependency graph audit',
          '2. staged migration plan',
          '3. focused tests and release gate',
          '4. final report with changed files and residual risks',
        ].join('\n'),
      ],
    ] as const

    for (const [label, request] of complexEngineeringRequests) {
      const routeInput = inferDeepSeekV4RouteInput(request, {
        initialPlanningTurn: true,
      })
      const decision = decideDeepSeekV4Route(routeInput)

      expect(routeInput.workflowKind, label).toBe('planning')
      expect(routeInput.role, label).toBe('planner')
      expect(decision.model, label).toBe('deepseek-v4-flash')
      expect(decision.reason, label).toBe('planning_flash_thinking_max')
    }

    const productionRecovery = decideDeepSeekV4Route(inferDeepSeekV4RouteInput(
      'Production verification failed after deploy; recover the task, classify failure, change strategy, and rerun evidence.',
      { initialPlanningTurn: true },
    ))
    expect(productionRecovery.model).toBe('deepseek-v4-pro')
    expect(productionRecovery.reason).toBe('failed_verification_pro_thinking_max')

    const smallFollowup = inferDeepSeekV4RouteInput('Add one unit test for parsePort()', {
      initialPlanningTurn: true,
    })
    expect(decideDeepSeekV4Route(smallFollowup).model).toBe('deepseek-v4-flash')
  })

  test('keeps normal coding on Flash while giving FIM the Pro beta cap', () => {
    const coding = decideDeepSeekV4Route({ workflowKind: 'feature' })
    expect(coding.model).toBe('deepseek-v4-flash')
    expect(coding.apiMode).toBe('non_thinking')
    expect(coding.reason).toBe('coding_flash_non_thinking')
    expect(coding.maxTokens).toBe(16_384)

    const fim = decideDeepSeekV4Route({ workflowKind: 'fim', requestedMaxTokens: 99_999 })
    expect(fim.model).toBe('deepseek-v4-pro')
    expect(fim.endpointKind).toBe('fim_completion')
    expect(fim.apiMode).toBe('non_thinking')
    expect(fim.maxTokens).toBe(DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS)
  })

  test('uses official V4 context and output limits instead of old 128K/8192 caps', () => {
    expect(getModelContextLimit('deepseek-v4-flash')).toBe(DEEPSEEK_V4_CONTEXT_WINDOW)
    expect(getModelContextLimit('deepseek-reasoner')).toBe(DEEPSEEK_V4_CONTEXT_WINDOW)
    expect(getModelMaxOutputTokens('deepseek-v4-pro')).toBe(DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS)
  })

  test('prices cache hit, cache miss, and output separately', () => {
    expect(estimateDeepSeekV4Cost({
      model: 'deepseek-v4-flash',
      cacheHitInputTokens: 1_000_000,
      cacheMissInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(0.0028 + 0.14 + 0.28, 6)

    expect(estimateCost('deepseek-chat', 1_000_000, 1_000_000)).toBeCloseTo(0.14 + 0.28, 6)
    expect(estimateCostDetailed({
      model: 'deepseek-v4-pro',
      cacheHitInputTokens: 1_000_000,
      cacheMissInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(0.003625 + 0.435 + 0.87, 6)
  })

  test('main UI cost helpers read the same DeepSeek V4 pricing table', () => {
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    } as any
    const cachedUsage = {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    } as any

    expect(calculateUSDCost('deepseek-v4-flash', usage)).toBeCloseTo(0.14 + 0.28, 6)
    expect(calculateUSDCost('deepseek-v4-pro', usage)).toBeCloseTo(0.435 + 0.87, 6)
    expect(calculateUSDCost('deepseek-chat', cachedUsage)).toBeCloseTo(0.0028, 6)
    expect(getModelPricingString('deepseek-v4-pro')).toBe('$0.43/$0.87 per Mtok')
  })

  test('sampling policy consumes the unified V4 route table instead of old chat/reasoner aliases', () => {
    const policy = new SamplingPolicy()
    const code = policy.getConfigForTaskType('code-generation')
    const planning = policy.getConfigForTaskType('complex-reasoning')
    const debugging = policy.getConfigForTaskType('debugging')
    const all = Object.values(policy.getAllStrategies())

    expect(code.model).toBe('deepseek-v4-flash')
    expect(code.routeReason).toBe('coding_flash_non_thinking')
    expect(code.maxTokens).toBe(16_384)
    expect(planning.model).toBe('deepseek-v4-flash')
    expect(planning.routeReason).toBe('planning_flash_thinking_max')
    expect(debugging.model).toBe('deepseek-v4-flash')
    expect(debugging.routeReason).toBe('recovery_flash_thinking_max')
    expect(debugging.maxTokens).toBe(32_768)
    expect(all.map(item => item.model)).not.toContain('deepseek-chat')
    expect(all.map(item => item.model)).not.toContain('deepseek-reasoner')
    expect(all.every(item => item.modelEvidence.includes('cost_basis=cache_hit/cache_miss/output'))).toBe(true)
  })
})
