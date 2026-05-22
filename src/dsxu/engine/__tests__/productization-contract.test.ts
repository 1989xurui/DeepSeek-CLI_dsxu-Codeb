import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getDsxuProductizationContract,
  getDsxuProductizationItem,
} from '../productization-contract'

const root = process.cwd()

function read(path: string): string {
  if (path.includes('DSXU-Code-V7-')) {
    return readOpsDocContaining('V7-10 Release Gate', 'v7-release-gate')
  }
  return readFileSync(join(root, path), 'utf8')
}

function readOpsDocContaining(...markers: string[]): string {
  const opsRoot = join(root, '.dsxu', 'ops')
  for (const name of readdirSync(opsRoot)) {
    if (!name.endsWith('.md')) continue
    const content = readFileSync(join(opsRoot, name), 'utf8')
    if (markers.every(marker => content.includes(marker))) return content
  }
  throw new Error(`missing ops doc with markers: ${markers.join(', ')}`)
}

describe('DSXU productization contract', () => {
  test('tracks the ten productization rows and release gate', () => {
    const contract = getDsxuProductizationContract()

    expect(contract.runtime).toBe('DSXU Productization')
    expect(contract.target).toContain('product-grade DeepSeek coding agent')
    expect(contract.rules.join('\n')).toContain('One DSXU default CLI mainline only')
    expect(contract.releaseGate.dryGate).toBe('productization')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(79)
    expect(contract.items.map(item => item.id)).toEqual([
      'productization-1 Compatibility Alias Removal',
      'productization-2 Real Long Live Suite',
      'productization-3 StopHook Runtime Live',
      'productization-4 SessionMemory Resume',
      'productization-5 Agent Long-Run Governance',
      'productization-6 Real MCP Server Harness',
      'productization-7 Permission Usability Matrix',
      'productization-8 Prompt Behavior Evaluation',
      'productization-9 Final Residual Archive',
      'productization-10 Release Gate',
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
    const alias = getDsxuProductizationItem('productization-1')
    const archive = getDsxuProductizationItem('productization-9')
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
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).not.toContain('../../bridge/replBridgeHandle.js')
    expect(briefUpload).not.toContain('../../bridge/bridgeConfig.js')
  })

  test('long live, stop hook, memory, and agent governance are present as product gates', () => {
    const longLive = getDsxuProductizationItem('productization-2')
    const stopHook = getDsxuProductizationItem('productization-3')
    const memory = getDsxuProductizationItem('productization-4')
    const agent = getDsxuProductizationItem('productization-5')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const query = read('src/query.ts')
    const compact = read('src/dsxu/engine/compact.ts')
    const sessionMemory = read('src/services/SessionMemory/sessionMemory.ts')
    const autoDream = read('src/services/autoDream/autoDream.ts')
    const agentPrompt = read('src/tools/AgentTool/prompt.ts')
    const agentSummary = read('src/services/AgentSummary/agentSummary.ts')

    expect(longLive?.liveGate).toContain('productization-real-long-live-suite')
    expect(stopHook?.liveGate).toContain('productization-stophook-runtime-live')
    expect(memory?.liveGate).toContain('productization-session-memory-resume')
    expect(agent?.liveGate).toContain('productization-agent-long-run-governance')
    expect(benchmark).toContain("'productization'")
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
    const mcp = getDsxuProductizationItem('productization-6')
    const permission = getDsxuProductizationItem('productization-7')
    const prompt = getDsxuProductizationItem('productization-8')
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
    expect(tests).toContain('Bash and PowerShell permission matrix through the DSXU shell permission matrix')
    expect(tests).toContain('acceptEdits')
    expect(prompt?.requiredEvidence.join('\n')).toContain('DSXU DeepSeek Tool-Use Contract')
    expect(systemPrompt).toContain('DSXU DeepSeek Tool-Use Contract')
    expect(planPrompt).toContain('Scope fence')
    expect(planPrompt).toContain('8. Acceptance')
  })

  test('release gate records benchmark count and archive truth without bad bytes', () => {
    const release = getDsxuProductizationItem('productization-10')
    const archive = getDsxuProductizationItem('productization-9')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const productizationDoc = read('.dsxu/ops/DSXU-Code-V7-historical-productization-release-gate.md')

    expect(release?.requiredEvidence.join('\n')).toContain('benchmark suite is at least 79 cases')
    expect(archive?.nextHardening).toContain('Continue broad P6 cleanup')
    expect(benchmark).toContain("'productization'")
    expect(benchmark).toContain('productization-release-gate')
    expect(productizationDoc).toContain('V7-10 Release Gate')
    expect(productizationDoc).toContain('v7-release-gate')
  })
})
