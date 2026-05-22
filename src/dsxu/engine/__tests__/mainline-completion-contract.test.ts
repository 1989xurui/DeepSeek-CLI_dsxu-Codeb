import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  getDsxuMainlineCompletionItem,
  getDsxuMainlineCompletionContract,
} from '../mainline-completion-contract'
import {
  createLocalDSXUProviderContract,
  getDsxuProviderShellReplacementContract,
} from '../provider-contract'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('DSXU mainline completion contract', () => {
  test('tracks P0-P8 as evidence-based DSXU mainline completion rows', () => {
    const contract = getDsxuMainlineCompletionContract()

    expect(contract.runtime).toBe('DSXU Mainline Completion')
    expect(contract.target).toContain('DeepSeek V4-class weaker models')
    expect(contract.rules.join('\n')).toContain('Evidence beats filename matching')
    expect(contract.releaseGate.dryGate).toBe('mainline-completion')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(69)
    expect(contract.items.map(item => item.id)).toEqual([
      'mainline-1 Provider Replacement Signoff',
      'mainline-2 Real Long Task Harness',
      'mainline-3 Stop Hook Runtime Integration',
      'mainline-4 SessionMemory Resume',
      'mainline-5 MCP Real Server Gate',
      'mainline-6 Permission Usability Policy',
      'mainline-7 Prompt Behavior Evaluation',
      'mainline-8 Final Archive',
    ])

    for (const item of contract.items) {
      expect(item.goal.length).toBeGreaterThan(80)
      expect(item.referenceBehavior.length).toBeGreaterThan(70)
      expect(item.dsxuLanding.length).toBeGreaterThanOrEqual(3)
      expect(item.requiredEvidence.length).toBeGreaterThanOrEqual(3)
      expect(item.liveGate.length).toBeGreaterThanOrEqual(1)
      expect(item.archiveDecision.length).toBeGreaterThan(50)
    }
  })

  test('provider replacement is signed off and old shell archival is complete', async () => {
    const item = getDsxuMainlineCompletionItem('mainline-1')
    const providerProfile = getDsxuProviderShellReplacementContract()
    const cli = read('src/entrypoints/cli.tsx')
    const init = read('src/entrypoints/init.ts')
    const main = read('src/main.tsx')
    const sendMessage = read('src/tools/SendMessageTool/SendMessageTool.ts')
    const briefUpload = read('src/tools/BriefTool/upload.ts')

    expect(item?.state).toBe('green_with_guard')
    expect(item?.archiveDecision).toContain('old control/session/proxy shell directories are archived')
    expect(providerProfile.defaultPathRules.join('\n')).toContain('local provider mode')
    expect(providerProfile.archivalRequirements.join('\n')).toContain('archived aliases')

    expect(cli).toContain('map old shell aliases to the DSXU provider contract in default mode')
    expect(cli).toContain("args[0] === 'remote-control'")
    expect(init).toContain('shouldLoadArchivedServiceShell')
    expect(init).toContain("isEnvTruthy(getDsxuCodeEnv('REMOTE'))")
    expect(main).toContain('shouldLoadArchivedServiceShell')
    expect(main).toContain("./services/bridge/dsxuRemoteSessionCoordinator.js")
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).toContain('DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE')
    expect(sendMessage).toContain("../services/bridge/dsxuRemoteBridgeFacade.js")
    expect(sendMessage).not.toContain("../../bridge/replBridgeHandle.js")
    expect(briefUpload).toContain('feature(\'BRIDGE_MODE\')')
    expect(briefUpload).toContain("../services/bridge/dsxuRemoteBridgeFacade.js")
    expect(briefUpload).not.toContain("../../bridge/bridgeConfig.js")

    const events: unknown[] = []
    const provider = createLocalDSXUProviderContract({
      emitEvent: event => events.push(event),
    })
    const remote = await provider.createRemoteSession({
      sessionId: 'mainline-provider',
      cwd: root,
    })
    provider.synchronizeTask?.({
      type: 'task_synchronized',
      sessionId: 'mainline-provider',
      taskId: 'task-v6',
      status: 'running',
      timestamp: 2,
    })

    expect(remote.status).toBe('blocked')
    expect(events).toEqual([
      expect.objectContaining({ type: 'remote_blocked' }),
      expect.objectContaining({ type: 'task_synchronized', taskId: 'task-v6' }),
    ])
  })

  test('real long-task harness, stop hooks, and session memory have live gates and DSXU runtime evidence', () => {
    const longTask = getDsxuMainlineCompletionItem('mainline-2')
    const stopHooks = getDsxuMainlineCompletionItem('mainline-3')
    const sessionMemory = getDsxuMainlineCompletionItem('mainline-4')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const query = read('src/query.ts')
    const compact = read('src/dsxu/engine/compact.ts')
    const session = read('src/services/SessionMemory/sessionMemory.ts')
    const dream = read('src/services/autoDream/autoDream.ts')

    expect(longTask?.liveGate).toContain('mainline-real-long-task-harness')
    expect(stopHooks?.liveGate).toContain('mainline-stop-hook-runtime')
    expect(sessionMemory?.liveGate).toContain('mainline-session-memory-resume')
    expect(benchmark).toContain("'mainline-completion'")
    expect(benchmark).toContain('mainline-real-long-task-harness')
    expect(query).toContain('executePostSamplingHooks')
    expect(query).toContain('stopHookActive')
    expect(query).toContain('preventContinuation')
    expect(compact).toContain('dsxu.compact-recovery.v1')
    expect(compact).toContain('pendingAgents')
    expect(session).toContain('hasMetTokenThreshold')
    expect(session).toContain('hasMetToolCallThreshold')
    expect(dream).toContain('lock')
    expect(dream).toContain('consolidation')
  })

  test('MCP, permission usability, and prompt behavior remain DSXU-owned weak-model gates', () => {
    const mcp = getDsxuMainlineCompletionItem('mainline-5')
    const permission = getDsxuMainlineCompletionItem('mainline-6')
    const prompt = getDsxuMainlineCompletionItem('mainline-7')
    const adapter = read('src/dsxu/engine/engine-tool-adapter.ts')
    const provider = read('src/dsxu/engine/provider-contract.ts')
    const permissionTests = read('src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts')
    const mainPrompt = read('src/constants/prompts.ts')
    const agentPrompt = read('src/tools/AgentTool/prompt.ts')

    expect(mcp?.requiredEvidence.join('\n')).toContain('dynamic MCP tool results are redacted')
    expect(adapter).toContain('redactCredentialLikeValues')
    expect(provider).toContain('redactCredentialLikeValues')
    expect(permission?.requiredEvidence.join('\n')).toContain('test/build policy is explicit')
    expect(permissionTests).toContain('DSXU shell permission matrix')
    expect(permissionTests).toContain('hard deny')
    expect(permissionTests).toContain('acceptEdits')
    expect(prompt?.requiredEvidence.join('\n')).toContain('Edit/Write success steers to verification')
    expect(mainPrompt).toContain('DSXU DeepSeek Tool-Use Contract')
    expect(agentPrompt).toContain('DSXU handoff package')
    expect(agentPrompt).toContain('do not invent PASS')
  })

  test('P8 archive is complete after compatibility shells are remapped', () => {
    const item = getDsxuMainlineCompletionItem('mainline-8')

    expect(item?.state).toBe('green_with_guard')
    expect(item?.archiveDecision).toContain('Provider shell directories have been moved')
    expect(existsSync(join(root, 'src/bridge'))).toBe(false)
    expect(existsSync(join(root, 'src/remote'))).toBe(false)
    expect(existsSync(join(root, 'src/upstreamproxy'))).toBe(false)

    const cli = read('src/entrypoints/cli.tsx')
    const main = read('src/main.tsx')
    const sendMessage = read('src/tools/SendMessageTool/SendMessageTool.ts')

    expect(cli).not.toContain("await import('../bridge/bridgeMain.js')")
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).not.toContain("../../bridge/replBridgeHandle.js")
  })
})
