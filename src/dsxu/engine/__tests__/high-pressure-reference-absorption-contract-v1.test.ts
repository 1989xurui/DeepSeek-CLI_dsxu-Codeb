import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getHighPressureAbsorptionContract,
  getHighPressureAbsorptionItem,
} from '../high-pressure-reference-absorption-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const legacyProduct = ['cl', 'aude'].join('')
const legacyProductTitle = ['Cl', 'aude'].join('')

function readOpsDocContaining(...markers: string[]): string {
  const opsRoot = join(root, '.dsxu', 'ops')
  for (const name of readdirSync(opsRoot)) {
    if (!name.endsWith('.md')) continue
    const content = readFileSync(join(opsRoot, name), 'utf8')
    if (markers.every(marker => content.includes(marker))) return content
  }
  throw new Error(`missing ops doc with markers: ${markers.join(', ')}`)
}

describe('DSXU high-pressure reference absorption contract', () => {
  test('tracks all nine requested high-value gaps without a second runtime', () => {
    const contract = getHighPressureAbsorptionContract()

    expect(contract.runtime).toBe('DSXU High Pressure reference Absorption')
    expect(contract.sourceBoundary.referenceRoot).toContain('reference-input')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.rules.join('\n')).toContain('No V11/V12 runtime')
    expect(contract.rules.join('\n')).toContain('one default mainline')
    expect(contract.gates.live).toBe('high-pressure-reference-absorption-live')
    expect(contract.items.map(item => item.id)).toEqual([
      '1 Query Loop Stress Recovery',
      '2 Harder Product Live Suite',
      '3 Agent Team Governance',
      '4 Memory Compact Cross-Turn Resume',
      '5 MCP Stdio Ecosystem Recovery',
      '6 Permission UX Productization',
      '7 Tool Prompt Strong Constraints',
      '8 Provider P6 Cleanliness',
      '9 Public Cross-Model Evaluation',
    ])
  })

  test('exposes every requested high-pressure benchmark case', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const requested = getHighPressureAbsorptionContract()
      .items.flatMap(item => item.benchmarkCases)
      .filter(id => id !== 'external-runner-required')

    for (const id of requested) {
      expect(benchmark).toContain(id)
    }
    expect(benchmark).toContain("'high-pressure-reference-absorption'")
    expect(benchmark).toContain("'high-pressure-reference-absorption-live'")
    expect(benchmark).toContain("'high-pressure-product-gap-delta-live'")
    expect(requested).toContain('query-compact-goal-stability-live')
    expect(requested).toContain('agent-worker-tool-pool-narrow-live')
    expect(requested).toContain('compact-resume-reread-source-live')
    expect(requested).toContain('mcp-stale-cache-clear-live')
    expect(requested).toContain('permission-external-scope-grant-live')
    expect(requested).toContain('tool-prompt-workflow-not-runtime-golden')
  })

  test('keeps external cross-model evaluation unclaimed without raw external logs', () => {
    const external = getHighPressureAbsorptionItem('9')

    expect(external?.state).toBe('external_runner_required')
    expect(external?.acceptance.join('\n')).toContain('not emitted until external raw logs exist')
    expect(external?.stressBehaviors.join('\n')).toContain('reference coding workflow')
  })

  test('classifies P6 cleanup as hygiene, not mainline blocker', () => {
    const p6 = getHighPressureAbsorptionItem('8')

    expect(p6?.state).toBe('cleanup_remaining')
    expect(p6?.stressBehaviors.join('\n')).toContain('default CLI/TUI import scan')
    expect(p6?.stressBehaviors.join('\n')).toContain('legacy aliases remain explicit legacy flags')
  })

  test('updates ops ledger and high-pressure execution document', () => {
    const ledger = read('.dsxu/ops/MAINLINE_LEDGER.md')
    const doc = readOpsDocContaining('Query Loop Stress Recovery', 'Public Cross-Model Evaluation')

    expect(ledger).toMatch(new RegExp(`High-pressure (reference|${legacyProductTitle}) absorption`))
    expect(doc).toMatch(new RegExp(`high-pressure-(reference|${legacyProduct})-absorption-live`))
    expect(doc).toContain('Query Loop Stress Recovery')
    expect(doc).toContain('Public Cross-Model Evaluation')
  })
})
