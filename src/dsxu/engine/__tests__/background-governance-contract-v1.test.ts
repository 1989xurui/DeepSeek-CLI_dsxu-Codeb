import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  createLocalDSXUProviderContract,
  getDsxuProviderShellReplacementContract,
} from '../provider-contract'
import {
  getDsxuBackgroundGovernanceV5Contract,
  getDsxuBackgroundGovernanceV5Item,
} from '../background-governance-contract'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('DSXU background governance V5 contract', () => {
  test('tracks the seven reference background governance behavior rows as DSXU-owned contracts', () => {
    const contract = getDsxuBackgroundGovernanceV5Contract()

    expect(contract.runtime).toBe('DSXU Background Governance V5')
    expect(contract.goal).toContain('single DSXU DeepSeek mainline')
    expect(contract.nonGoals.join('\n')).toContain('Do not import reference auth')
    expect(contract.releaseGate.dryGate).toBe('background-governance-v5')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(60)
    expect(contract.items.map(item => item.id)).toEqual([
      'V5-1 Provider Shell Replacement',
      'V5-2 Stop Hooks / Post Sampling Hooks',
      'V5-3 SessionMemory + AutoDream',
      'V5-4 AgentSummary',
      'V5-5 MagicDocs',
      'V5-6 PromptSuggestion / Tips',
      'V5-7 True Long-Task Benchmark',
    ])

    for (const item of contract.items) {
      expect(item.sourceBehavior.length).toBeGreaterThan(80)
      expect(item.dsxuLanding.length).toBeGreaterThanOrEqual(3)
      expect(item.requiredTests.length).toBeGreaterThanOrEqual(3)
      expect(item.requiredLiveBenchmarks.length).toBeGreaterThanOrEqual(1)
      expect(item.archivalRule.length).toBeGreaterThan(40)
    }
  })

  test('provider shell replacement absorbs remote semantics without enabling the old shell by default', async () => {
    const profile = getDsxuProviderShellReplacementContract()
    const events: unknown[] = []
    const provider = createLocalDSXUProviderContract({
      emitEvent: event => events.push(event),
    })

    expect(profile.sourceSemantics).toContain('remote session creation')
    expect(profile.sourceSemantics).toContain('event stream emission')
    expect(profile.sourceSemantics).toContain('permission callback mediation')
    expect(profile.sourceSemantics).toContain('MCP credential filtering before model re-entry')
    expect(profile.sourceSemantics).toContain('task synchronization status events')
    expect(profile.defaultPathRules.join('\n')).toContain('local provider mode')
    expect(profile.providerMigrationOptInRules.join('\n')).toContain('DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE')
    expect(profile.archivalRequirements.join('\n')).toContain('provider-shell-default-unreachable')

    const blocked = await provider.createRemoteSession({
      sessionId: 'v5-provider-shell',
      cwd: root,
    })
    provider.synchronizeTask?.({
      type: 'task_synchronized',
      sessionId: 'v5-provider-shell',
      taskId: 'task-v5',
      status: 'completed',
      timestamp: 1,
    })

    expect(blocked.status).toBe('blocked')
    expect(events).toEqual([
      expect.objectContaining({ type: 'remote_blocked', sessionId: 'v5-provider-shell' }),
      expect.objectContaining({ type: 'task_synchronized', taskId: 'task-v5', status: 'completed' }),
    ])
    expect(provider.filterMcpCredentials({
      authorization: 'Bearer remote.secret',
      output: 'token sk-v5-provider-secret',
    })).toEqual({
      authorization: '[REDACTED]',
      output: 'token [REDACTED]',
    })
  })

  test('stop hooks and post-sampling hooks are represented as query-loop governance, not a second runtime', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-2')
    const query = read('src/query.ts')
    const postSamplingHooks = read('src/utils/hooks/postSamplingHooks.ts')

    expect(item?.sourceBehavior).toContain('query/stopHooks.ts')
    expect(item?.requiredTests.join('\n')).toContain('stop-hook continuation has an explicit loop guard')
    expect(query).toContain('executePostSamplingHooks')
    expect(query).toContain('executeStopFailureHooks')
    expect(query).toContain('stopHookActive')
    expect(query).toContain('preventContinuation')
    expect(query).toContain('hook_stopped')
    expect(postSamplingHooks).toContain('registerPostSamplingHook')
  })

  test('session memory and AutoDream feed compact recovery instead of replacing source evidence', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-3')
    const sessionMemory = read('src/services/SessionMemory/sessionMemory.ts')
    const autoDream = read('src/services/autoDream/autoDream.ts')
    const compact = read('src/dsxu/engine/compact.ts')

    expect(item?.requiredLiveBenchmarks).toContain('session-memory-resume')
    expect(item?.requiredLiveBenchmarks).toContain('long-task-compact-continue')
    expect(sessionMemory).toContain('hasMetTokenThreshold')
    expect(sessionMemory).toContain('hasMetToolCallThreshold')
    expect(sessionMemory).toContain('hasToolCallsInLastAssistantTurn')
    expect(autoDream).toContain('consolidation')
    expect(autoDream).toContain('lock')
    expect(compact).toContain('dsxu.compact-recovery.v1')
    expect(compact).toContain('pendingAgents')
    expect(compact).toContain('failedCommands')
    expect(compact).toContain('verificationStatus')
  })

  test('AgentSummary is constrained to evidence-based parent synthesis without tools', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-4')
    const agentSummary = read('src/services/AgentSummary/agentSummary.ts')
    const agentPrompt = read('src/tools/AgentTool/prompt.ts')

    expect(item?.requiredLiveBenchmarks).toContain('agent-summary-parent-synthesis')
    expect(agentSummary).toContain('Do not use tools')
    expect(agentSummary).toContain('No tools needed for summary')
    expect(agentSummary).toContain('prevent overlapping summaries')
    expect(agentSummary).toContain('updateAgentSummary')
    expect(agentPrompt).toContain('parent synthesis')
    expect(agentPrompt).toContain('do not invent PASS')
  })

  test('MagicDocs remains scoped, idle-turn, and Edit-only', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-5')
    const magicDocs = read('src/services/MagicDocs/magicDocs.ts')
    const magicPrompt = read('src/services/MagicDocs/prompts.ts')

    expect(item?.requiredLiveBenchmarks).toContain('magic-docs-scoped-update')
    expect(magicDocs).toContain('MAGIC DOC')
    expect(magicDocs).toContain('Only allow Edit')
    expect(magicDocs).toContain('tool.name === FILE_EDIT_TOOL_NAME')
    expect(magicDocs).toContain('filePath === docInfo.path')
    expect(magicDocs).toContain('hasToolCallsInLastAssistantTurn')
    expect(magicPrompt).toContain('buildMagicDocsUpdatePrompt')
  })

  test('PromptSuggestion and tips stay out of noninteractive core model/tool execution', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-6')
    const promptSuggestion = read('src/services/PromptSuggestion/promptSuggestion.ts')
    const spinner = read('src/components/Spinner.tsx')

    expect(item?.requiredLiveBenchmarks).toContain('prompt-suggestion-cache-isolation')
    expect(promptSuggestion).toContain('getIsNonInteractiveSession')
    expect(promptSuggestion).toContain('pending_permission')
    expect(promptSuggestion).toContain('plan_mode')
    expect(promptSuggestion).toContain('createCacheSafeParams')
    expect(spinner).toContain('spinnerTipsEnabled')
  })

  test('V5 benchmark plan expands the suite to at least sixty planned cases and a V5 gate', () => {
    const item = getDsxuBackgroundGovernanceV5Item('V5-7')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')

    expect(item?.requiredTests.join('\n')).toContain('at least 60 planned cases')
    expect(benchmark).toContain("'background-governance-v5'")
    expect(benchmark).toContain('long-task-compact-continue')
    expect(benchmark).toContain('agent-summary-parent-synthesis')
    expect(benchmark).toContain('stop-hook-verify-before-final')
    expect(benchmark).toContain('real-mcp-resource-redaction')
    expect(benchmark).toContain('provider-shell-default-unreachable')
    expect(benchmark).toContain('session-memory-resume')
    expect(benchmark).toContain('magic-docs-scoped-update')
  })
})
