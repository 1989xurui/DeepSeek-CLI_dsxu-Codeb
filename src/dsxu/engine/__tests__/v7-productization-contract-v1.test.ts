import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  getDsxuV7Item,
  getDsxuV7ProductizationContract,
} from '../v7-productization-contract'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('DSXU V7 productization contract', () => {
  test('tracks the ten V7 productization rows and release gate', () => {
    const contract = getDsxuV7ProductizationContract()

    expect(contract.runtime).toBe('DSXU V7 Productization')
    expect(contract.target).toContain('product-grade DeepSeek coding agent')
    expect(contract.rules.join('\n')).toContain('One DSXU default CLI mainline only')
    expect(contract.releaseGate.dryGate).toBe('v7-productization')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(79)
    expect(contract.items.map(item => item.id)).toEqual([
      'V7-1 Compatibility Alias Removal',
      'V7-2 Real Long Live Suite',
      'V7-3 StopHook Runtime Live',
      'V7-4 SessionMemory Resume',
      'V7-5 Agent Long-Run Governance',
      'V7-6 Real MCP Server Harness',
      'V7-7 Permission Usability Matrix',
      'V7-8 Prompt Behavior Evaluation',
      'V7-9 Final Residual Archive',
      'V7-10 Release Gate',
    ])

    for (const item of contract.items) {
      expect(item.goal.length).toBeGreaterThan(70)
      expect(item.referenceBehavior.length).toBeGreaterThan(60)
      expect(item.dsxuLanding.length).toBeGreaterThanOrEqual(3)
      expect(item.requiredEvidence.length).toBeGreaterThanOrEqual(3)
      expect(item.liveGate.length).toBeGreaterThanOrEqual(1)
      expect(item.nextHardening.length).toBeGreaterThan(50)
    }
  })

  test('compatibility alias removal and final archive are green after remap', () => {
    const alias = getDsxuV7Item('V7-1')
    const archive = getDsxuV7Item('V7-9')
    const cli = read('src/entrypoints/cli.tsx')
    const init = read('src/entrypoints/init.ts')
    const main = read('src/main.tsx')
    const sendMessage = read('src/tools/SendMessageTool/SendMessageTool.ts')
    const briefUpload = read('src/tools/BriefTool/upload.ts')

    expect(alias?.state).toBe('green_with_guard')
    expect(archive?.state).toBe('green_with_guard')
    expect(existsSync(join(root, 'src/bridge'))).toBe(false)
    expect(existsSync(join(root, 'src/remote'))).toBe(false)
    expect(existsSync(join(root, 'src/upstreamproxy'))).toBe(false)
    expect(cli).not.toContain("await import('../bridge/bridgeMain.js')")
    expect(init).not.toContain("../upstreamproxy/upstreamproxy.js")
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).not.toContain("../../bridge/replBridgeHandle.js")
    expect(briefUpload).not.toContain("../../bridge/bridgeConfig.js")
  })

  test('long live, stop hook, memory, and agent governance are present as DSXU product gates', () => {
    const longLive = getDsxuV7Item('V7-2')
    const stopHook = getDsxuV7Item('V7-3')
    const memory = getDsxuV7Item('V7-4')
    const agent = getDsxuV7Item('V7-5')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const query = read('src/query.ts')
    const compact = read('src/dsxu/engine/compact.ts')
    const sessionMemory = read('src/services/SessionMemory/sessionMemory.ts')
    const autoDream = read('src/services/autoDream/autoDream.ts')
    const agentPrompt = read('src/tools/AgentTool/prompt.ts')
    const agentSummary = read('src/services/AgentSummary/agentSummary.ts')

    expect(longLive?.liveGate).toContain('v7-real-long-live-suite')
    expect(stopHook?.liveGate).toContain('v7-stophook-runtime-live')
    expect(memory?.liveGate).toContain('v7-session-memory-resume')
    expect(agent?.liveGate).toContain('v7-agent-long-run-governance')
    expect(benchmark).toContain("'v7-productization'")
    expect(query).toContain('executePostSamplingHooks')
    expect(query).toContain('stopHookActive')
    expect(compact).toContain('dsxu.compact-recovery.v1')
    expect(sessionMemory).toContain('hasMetTokenThreshold')
    expect(autoDream).toContain('consolidation')
    expect(autoDream).toContain('lock')
    expect(agentPrompt).toContain('DSXU handoff package')
    expect(agentPrompt).toContain('do not invent PASS')
    expect(agentSummary).toContain('prevent overlapping summaries')
  })

  test('MCP, permission, and prompt behavior gates remain tied to source evidence', () => {
    const mcp = getDsxuV7Item('V7-6')
    const permission = getDsxuV7Item('V7-7')
    const prompt = getDsxuV7Item('V7-8')
    const adapter = read('src/dsxu/engine/engine-tool-adapter.ts')
    const provider = read('src/dsxu/engine/provider-contract.ts')
    const tests = read('src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts')
    const systemPrompt = read('src/constants/prompts.ts')
    const planPrompt = read('src/tools/EnterPlanModeTool/prompt.ts')

    expect(mcp?.requiredEvidence.join('\n')).toContain('dynamic MCP tools execute')
    expect(adapter).toContain('redactCredentialLikeValues')
    expect(provider).toContain('filterMcpCredentials')
    expect(tests).toContain('executes real ReadMcpResource class')
    expect(permission?.requiredEvidence.join('\n')).toContain('hard deny dominates')
    expect(tests).toContain('covers the DSXU shell permission matrix')
    expect(tests).toContain('acceptEdits')
    expect(prompt?.requiredEvidence.join('\n')).toContain('DSXU DeepSeek Tool-Use Contract')
    expect(systemPrompt).toContain('DSXU DeepSeek Tool-Use Contract')
    expect(planPrompt).toContain('Scope fence')
    expect(planPrompt).toContain('4. Acceptance')
  })

  test('release gate records benchmark count, V7 live gate, CLI smoke, and archive completion truth', () => {
    const release = getDsxuV7Item('V7-10')
    const archive = getDsxuV7Item('V7-9')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const v7Doc = read('.dsxu/ops/DSXU-Code-V7-产品化与最终归档执行队列.md')

    expect(release?.requiredEvidence.join('\n')).toContain('benchmark suite is at least 79 cases')
    expect(archive?.nextHardening).toContain('Continue broad P6 cleanup')
    expect(benchmark).toContain("'v7-productization'")
    expect(benchmark).toContain('v7-release-gate')
    expect(v7Doc).toContain('V7-10 Release Gate')
    expect(v7Doc).toContain('V7-10 Release Gate')
  })
})
