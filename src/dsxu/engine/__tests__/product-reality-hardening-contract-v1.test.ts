import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getProductRealityHardeningContract,
  getProductRealityHardeningItem,
} from '../product-reality-hardening-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('DSXU product reality hardening contract', () => {
  test('tracks P0-P8 without opening a second runtime', () => {
    const contract = getProductRealityHardeningContract()

    expect(contract.runtime).toBe('DSXU Product Reality Hardening')
    expect(contract.sourceBoundary.referenceRoot).toContain('reference-input')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.rules.join('\n')).toContain('Do not open V11/V12')
    expect(contract.rules.join('\n')).toContain('Read/Edit/Run/Verify')
    expect(contract.items.map(item => item.id)).toEqual([
      'P0 Real Product Task Scale',
      'P1 Query Loop Extreme Recovery',
      'P2 Agent Trusted Team Governance',
      'P3 Compact Memory Cross-Turn Recovery',
      'P4 Real MCP Ecosystem Chain',
      'P5 Permission Usability',
      'P6 Tool Prompt Second-Round Discipline',
      'P7 Provider P6 Cleanup',
      'P8 Public Cross-Model Evaluation',
    ])
  })

  test('exposes every requested product reality benchmark case', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const requested = getProductRealityHardeningContract()
      .items.flatMap(item => item.benchmarkCases)
      .filter(id => id !== 'external-runner-required')

    for (const id of requested) {
      expect(benchmark).toContain(id)
    }
    expect(benchmark).toContain("'product-reality-hardening'")
    expect(benchmark).toContain("'product-reality-hardening-live'")
  })

  test('keeps external public comparison blocked until raw model logs exist', () => {
    const external = getProductRealityHardeningItem('P8')

    expect(external?.state).toBe('external_runner_required')
    expect(external?.acceptance.join('\n')).toContain('blocked until raw external logs exist')
    expect(external?.requiredBehaviors.join('\n')).toContain('dry planned is never counted as live success')
  })

  test('keeps P7 cleanup as hygiene, not a mainline failure', () => {
    const cleanup = getProductRealityHardeningItem('P7')

    expect(cleanup?.state).toBe('cleanup_remaining')
    expect(cleanup?.requiredBehaviors.join('\n')).toContain('default CLI/TUI import scan remains clean')
    expect(cleanup?.requiredBehaviors.join('\n')).toContain('legacy aliases are explicit legacy')
  })
})
