import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getDsxuV10Contract,
  getDsxuV10Item,
} from '../reference-behavior-productization-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const localReferenceRoot = join('D:\\', `\u6e90\u4ee3\u7801${['cl', 'aude'].join('')}`, 'src')

describe('DSXU V10 reference behavior productization contract', () => {
  test('defines the eight V10 workstreams as behavior absorption, not shell copying', () => {
    const contract = getDsxuV10Contract()

    expect(contract.runtime).toBe('DSXU V10 Reference Behavior Productization')
    expect(contract.releaseGate.dryGate).toBe('v10-productization')
    expect(contract.releaseGate.selectedLiveGate).toBe('v10-selected-live')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(110)
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.sourceBoundary.normalizedPathRule).toContain('do not assume a src subfolder')
    expect(contract.rules.join('\n')).toContain('Absorb behavior semantics, not reference provider shells')
    expect(contract.items.map(item => item.id)).toEqual([
      'V10-1 Query Loop and Stop Hooks Live Recovery',
      'V10-2 Long Task Compact SessionMemory AutoDream Resume',
      'V10-3 AgentSummary Multi-Agent Long Run',
      'V10-4 Real MCP Server Harness',
      'V10-5 Permission Usability Productization',
      'V10-6 Provider Backend Replacement',
      'V10-7 Prompt and Tool Discipline Upgrade',
      'V10-8 Docs Encoding Path Ledger Cleanup',
    ])
  })

  test('normalizes the reference behavior root without treating the source as writable project code', () => {
    const referenceRoot = localReferenceRoot

    expect(existsSync(referenceRoot)).toBe(true)
    expect(existsSync(join(referenceRoot, 'query.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'Tool.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'query', 'stopHooks.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'src'))).toBe(false)

    const topLevel = new Set(readdirSync(referenceRoot))
    expect(topLevel.has('bridge')).toBe(true)
    expect(topLevel.has('services')).toBe(true)
    expect(topLevel.has('tools')).toBe(true)
  })

  test('marks provider replacement green after old shell imports are remapped and archived', () => {
    const provider = getDsxuV10Item('V10-6')
    const cli = read('src/entrypoints/cli.tsx')
    const main = read('src/main.tsx')
    const init = read('src/entrypoints/init.ts')
    const useRemoteSession = read('src/hooks/useRemoteSession.ts')
    const print = read('src/cli/print.ts')
    const useReplBridge = read('src/hooks/useReplBridge.tsx')

    expect(provider?.state).toBe('evidence_green')
    expect(provider?.acceptance.join('\n')).toContain('old shell directories are archived only after import scan and five live smokes are green')
    expect(cli).toContain('handleDsxuProviderAliasCommand')
    expect(cli).not.toContain("await import('../bridge/bridgeMain.js')")
    expect(cli).toContain("args[0] === 'bridge'")
    expect(main).toContain("./services/bridge/dsxuRemoteSessionCoordinator.js")
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(main).not.toContain("./bridge/bridgeEnabled.js")
    expect(main).not.toContain("./bridge/trustedDevice.js")
    expect(useRemoteSession).toContain('../services/bridge/dsxuRemoteSessionCoordinator.js')
    expect(useRemoteSession).not.toContain('../remote/DsxuRemoteSessionCoordinator.js')
    expect(print).not.toContain("src/bridge/")
    expect(useReplBridge).not.toContain("../bridge/")
    expect(existsSync(join(root, 'src/bridge'))).toBe(false)
    expect(existsSync(join(root, 'src/remote'))).toBe(false)
    expect(existsSync(join(root, 'src/upstreamproxy'))).toBe(false)
    expect(init).toContain('archived upstream proxy shell is disabled')
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')
  })

  test('marks product-live recovery, memory, Agent, MCP, and permission workstreams green', () => {
    for (const id of ['V10-1', 'V10-2', 'V10-3', 'V10-4', 'V10-5']) {
      const item = getDsxuV10Item(id)
      expect(item?.state).toBe('evidence_green')
      expect(item?.referenceBehavior.length).toBeGreaterThan(0)
      expect(item?.dsxuLanding.length).toBeGreaterThan(0)
      expect(item?.acceptance.join('\n')).toMatch(/live|fixture|process|PASS|Verify/i)
      expect(item?.acceptance.join('\n')).toContain('default CLI benchmark path')
    }
  })

  test('marks prompt and docs cleanup green after V10-7/V10-8 productization', () => {
    const prompt = getDsxuV10Item('V10-7')
    const docs = getDsxuV10Item('V10-8')

    expect(prompt?.state).toBe('evidence_green')
    expect(docs?.state).toBe('evidence_green')
    expect(prompt?.acceptance.join('\n')).toContain('Agent, SendMessage, MCP')
    expect(prompt?.acceptance.join('\n')).toContain('v10-prompt-docs-discipline-v1.test.ts')
    expect(prompt?.acceptance.join('\n')).toContain('v10-selected-mutation-live')
    expect(prompt?.absorptionRules.join('\n')).toContain('Static tool-use guidance')
    expect(docs?.acceptance.join('\n')).toContain('true reference-root boundary')
    expect(docs?.acceptance.join('\n')).toContain('v10-docs-encoding-ledger-live')
  })
})
