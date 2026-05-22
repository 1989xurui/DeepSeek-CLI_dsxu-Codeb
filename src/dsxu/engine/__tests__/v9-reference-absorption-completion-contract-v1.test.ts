import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getDsxuV9CompletionContract,
  getDsxuV9Item,
} from '../v9-reference-absorption-completion-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('DSXU V9 reference high-value behavior completion contract', () => {
  test('defines the remaining queue without allowing shell-copy shortcuts', () => {
    const contract = getDsxuV9CompletionContract()

    expect(contract.runtime).toBe('DSXU V9 Reference High-Value Behavior Completion')
    expect(contract.releaseGate.dryGate).toBe('v9-completion')
    expect(contract.releaseGate.selectedLiveGate).toBe('v9-selected-live')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(100)
    expect(contract.rules.join('\n')).toContain('absorb behavior semantics, not shells')
    expect(contract.items.map(item => item.id)).toEqual([
      'V9-1 Provider Shell Replacement Final',
      'V9-2 Query Loop Live Recovery',
      'V9-3 Long Task Memory Resume',
      'V9-4 AgentSummary Parent Synthesis',
      'V9-5 Real MCP Server Process',
      'V9-6 Permission Usability Matrix',
      'V9-7 Real Product Benchmark 100+',
    ])
  })

  test('marks provider shell archival green after provider migration imports are remapped', () => {
    const provider = getDsxuV9Item('V9-1')
    const cli = read('src/entrypoints/cli.tsx')
    const main = read('src/main.tsx')
    const init = read('src/entrypoints/init.ts')
    const useRemoteSession = read('src/hooks/useRemoteSession.ts')
    const print = read('src/cli/print.ts')
    const useReplBridge = read('src/hooks/useReplBridge.tsx')

    expect(provider?.state).toBe('evidence_green')
    expect(provider?.acceptance.join('\n')).toContain('old shell directories are archived after explicit provider-migration imports are gone and live smoke is green')
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
    expect(init).toContain('DSXU_CODE_REMOTE ignored on the default DSXU local mainline')
    expect(init).toContain('DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1')
    expect(init).toContain('provider migration upstream proxy shell is archived')
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')
  })

  test('ties each reference source behavior to a DSXU landing point and release-live evidence', () => {
    for (const id of ['V9-2', 'V9-3', 'V9-4', 'V9-5']) {
      const item = getDsxuV9Item(id)
      expect(item?.state).toBe('evidence_green')
      expect(item?.referenceBehavior.length).toBeGreaterThan(0)
      expect(item?.dsxuLanding.length).toBeGreaterThan(0)
      expect(item?.absorptionRules.join('\n')).toMatch(/Do not|must|never|Absorb/i)
      expect(item?.acceptance.join('\n')).toContain('default CLI benchmark path')
    }
  })

  test('records permission usability and benchmark 100+ as one-chain evidence', () => {
    const permission = getDsxuV9Item('V9-6')
    const benchmark = getDsxuV9Item('V9-7')

    expect(permission?.state).toBe('evidence_green')
    expect(permission?.acceptance.join('\n')).toContain('D:/shooter-game')
    expect(permission?.acceptance.join('\n')).toContain('/mnt/d/shooter-game')
    expect(permission?.absorptionRules.join('\n')).toContain('Do not maintain a second shell safety engine')
    expect(benchmark?.state).toBe('evidence_green')
    expect(benchmark?.acceptance.join('\n')).toContain('117 cases')
  })
})
