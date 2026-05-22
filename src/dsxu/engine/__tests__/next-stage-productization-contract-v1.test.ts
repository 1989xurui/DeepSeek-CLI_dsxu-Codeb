import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getNextStageProductizationContract,
  getNextStageProductizationItem,
} from '../next-stage-productization-contract'

const root = process.cwd()
const read = (path: string) => {
  if (path.includes('DSXU-Code-')) {
    return readOpsDocContaining('product-real-live-suite', 'Public Cross-Model Evaluation')
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

describe('DSXU next-stage productization contract', () => {
  test('tracks the nine highest-value gaps without creating a new runtime', () => {
    const contract = getNextStageProductizationContract()

    expect(contract.runtime).toBe('DSXU Next Stage Productization')
    expect(contract.sourceBoundary.referenceRoot).toContain('reference-input')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.rules.join('\n')).toContain('Keep one DSXU default mainline')
    expect(contract.rules.join('\n')).toContain('Product live means Read/Edit/Run/Verify/PASS')
    expect(contract.gates.productLive).toBe('product-real-live-suite')
    expect(contract.items.map(item => item.id)).toEqual([
      '1 Real Long Task Product Live Suite',
      '2 Query Loop Mature Recovery',
      '3 Agent Parent Worker Governance',
      '4 Compact SessionMemory AutoDream Real Resume',
      '5 MCP External Server Long Chain',
      '6 Permission Usability Productization',
      '7 Tool Prompt Strong Discipline Second Pass',
      '8 Provider Shell Replacement and P6 Cleanup',
      '9 Public Cross-Model Evaluation',
    ])
  })

  test('product live suite includes all requested real-task gates', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const product = getNextStageProductizationItem('1')

    for (const id of [
      'product-multifile-bugfix-live',
      'product-feature-tests-live',
      'product-review-fix-live',
      'product-compact-resume-edit-live',
      'product-permission-deny-replan-live',
      'product-agent-worker-longrun-live',
      'product-real-mcp-task-live',
      'product-workflow-recovery-live',
    ]) {
      expect(benchmark).toContain(id)
      expect(product?.acceptance.join('\n')).toContain(id)
    }

    expect(benchmark).toContain("'product-real-live-suite'")
    expect(benchmark).toContain('Run bun test with PowerShell first')
    expect(benchmark).toContain('Finish with DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS only after bun test passes')
  })

  test('keeps query, Agent, compact, MCP, permission, and prompt targets on DSXU mainline files', () => {
    const contract = getNextStageProductizationContract()

    for (const item of contract.items.slice(1, 8)) {
      const landing = item.dsxuLanding.join('\n')
      expect(landing).not.toContain('reference-input')
      expect(item.referenceBehavior.length).toBeGreaterThan(0)
      expect(item.productRequirement.length).toBeGreaterThan(0)
      expect(item.acceptance.length).toBeGreaterThan(0)
    }

    expect(getNextStageProductizationItem('2')?.dsxuLanding.join('\n')).toContain('src/query.ts')
    expect(getNextStageProductizationItem('3')?.productRequirement.join('\n')).toContain('parent synthesis')
    expect(getNextStageProductizationItem('4')?.productRequirement.join('\n')).toContain('memory is hint only')
    expect(getNextStageProductizationItem('5')?.productRequirement.join('\n')).toContain('credential values never enter')
    expect(getNextStageProductizationItem('6')?.productRequirement.join('\n')).toContain('D:/shooter-game')
    expect(getNextStageProductizationItem('7')?.productRequirement.join('\n')).toContain('Workflow is route contract')
  })

  test('does not mark external public comparison complete without external raw logs', () => {
    const external = getNextStageProductizationItem('9')

    expect(external?.state).toBe('external_runner_required')
    expect(external?.benchmarkEvidence.join('\n')).toContain('do not fake')
    expect(external?.acceptance.join('\n')).toContain('external model logs')
  })

  test('updates ops docs with next-stage execution status', () => {
    const ledger = read('.dsxu/ops/MAINLINE_LEDGER.md')
    const doc = read('.dsxu/ops/DSXU-Code-下一阶段产品级Live与reference吸收执行队列.md')

    expect(ledger).toContain('Next-stage product live')
    expect(doc).toContain('product-real-live-suite')
    expect(doc).toContain('Public Cross-Model Evaluation')
  })
})
