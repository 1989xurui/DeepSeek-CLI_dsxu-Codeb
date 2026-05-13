import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getGoalDrivenOptimizationContract,
  getGoalOptimizationArea,
} from '../goal-driven-optimization-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('DSXU goal driven optimization contract', () => {
  test('anchors optimization to the real DSXU target', () => {
    const contract = getGoalDrivenOptimizationContract()

    expect(contract.runtime).toBe('DSXU Goal Driven Optimization')
    expect(contract.modelAssumption).toContain('DeepSeek V4')
    expect(contract.modelAssumption).toContain('weaker base model')
    expect(contract.target).toContain('reference coding workflow-class')
    expect(contract.rules.join('\n')).toContain('single DSXU default mainline')
    expect(contract.rules.join('\n')).toContain('Dry planned cases count as coverage only')
  })

  test('uses public benchmark categories as reference coordinates, not fake scores', () => {
    const contract = getGoalDrivenOptimizationContract()
    const refs = contract.scorecard.flatMap(area => area.externalReference).join('\n')

    expect(refs).toContain('SWE-bench')
    expect(refs).toContain('Aider Polyglot')
    expect(refs).toContain('Terminal-Bench')
    expect(contract.gates.externalComparison).toContain('横向评测报告')
    expect(contract.rules.join('\n')).toContain('public ranking requires same-task external model raw logs')
  })

  test('scorecard weights cover the full 100 point optimization map', () => {
    const contract = getGoalDrivenOptimizationContract()
    const total = contract.scorecard.reduce((sum, area) => sum + area.weight, 0)

    expect(total).toBe(100)
    expect(contract.scorecard.map(area => area.id)).toEqual([
      'coding-repair',
      'tool-discipline',
      'recovery',
      'agent-governance',
      'long-context-memory',
      'permissions',
      'mcp-workflow',
      'cost-speed',
    ])
  })

  test('benchmark gates expose representative DSXU local optimization cases', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const contract = getGoalDrivenOptimizationContract()
    const cases = contract.scorecard.flatMap(area => area.benchmarkCases)

    for (const id of cases) {
      expect(benchmark).toContain(id)
    }
    expect(benchmark).toContain("'goal-driven-optimization'")
    expect(benchmark).toContain("'goal-driven-selected-live'")
  })

  test('high-value buckets carry concrete weak-model optimization signals', () => {
    expect(getGoalOptimizationArea('recovery')?.optimizationSignals.join('\n')).toContain('PASS stops immediately')
    expect(getGoalOptimizationArea('agent-governance')?.optimizationSignals.join('\n')).toContain('verifier rejects fake PASS')
    expect(getGoalOptimizationArea('mcp-workflow')?.optimizationSignals.join('\n')).toContain('MCP credentials do not enter')
  })
})
