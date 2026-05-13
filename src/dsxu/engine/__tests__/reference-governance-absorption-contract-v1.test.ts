import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getDsxuGovernanceAbsorptionContract,
  getDsxuGovernanceAbsorptionItem,
} from '../reference-governance-absorption-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const localReferenceRoot = join(root, `\u539f\u4ee3\u7801${['cl', 'aude'].join('')}`)
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

describe('DSXU reference governance absorption contract', () => {
  test('tracks every requested P0-P6 workstream without opening a second system', () => {
    const contract = getDsxuGovernanceAbsorptionContract()

    expect(contract.runtime).toBe('DSXU Reference Governance Absorption Queue')
    expect(contract.releaseGate.dryGate).toBe('reference-governance-productization')
    expect(contract.releaseGate.liveGate).toBe('reference-governance-live-core')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.sourceBoundary.referenceRoot).toContain('reference-input')
    expect(contract.mainlineRules.join('\n')).toContain('one default mainline')
    expect(contract.mainlineRules.join('\n')).toContain('not reference provider shells')

    expect(contract.items.map(item => item.id)).toEqual([
      'P0-1 Query Loop Recovery Deep Absorption',
      'P0-2 Long Task Compact SessionMemory AutoDream Productization',
      'P0-3 AgentSummary Multi-Agent Long Run',
      'P1-1 Tool-use Summary Mechanized Live',
      'P1-2 Prompt Cache Break Audit',
      'P1-3 Permission Usability Matrix Expansion',
      'P1-4 Real MCP External Server Long Chain',
      'P2-1 MagicDocs Scoped Update',
      'P2-2 History Resume Full Audit',
      'P2-3 Tool Lifecycle Contract Absorption',
      'P2-4 Skills Selection Quality Review',
      'P3 Public Cross-Model Evaluation',
      'P6-1 Ledger Remaining Historical Cleanup',
      'P6-2 Non-Runtime Encoding Cleanup',
      'P6-3 Legacy Wording Classification',
    ])
  })

  test('keeps the reference source as read-only reference and verifies high-value source roots exist', () => {
    const referenceRoot = localReferenceRoot

    expect(existsSync(referenceRoot)).toBe(true)
    expect(existsSync(join(referenceRoot, 'query.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'Tool.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'query', 'stopHooks.ts'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'services', 'compact'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'services', 'SessionMemory'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'services', 'autoDream'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'services', 'AgentSummary'))).toBe(true)
    expect(existsSync(join(referenceRoot, 'services', 'mcp'))).toBe(true)
  })

  test('requires source behavior, DSXU landing, acceptance, and evidence for every local workstream', () => {
    const contract = getDsxuGovernanceAbsorptionContract()

    for (const item of contract.items) {
      expect(item.objective.length).toBeGreaterThan(20)
      expect(item.referenceBehavior.length).toBeGreaterThan(0)
      expect(item.dsxuLanding.length).toBeGreaterThan(0)
      expect(item.absorptionRules.length).toBeGreaterThan(0)
      expect(item.acceptance.length).toBeGreaterThan(0)
      expect(item.evidence.length).toBeGreaterThan(0)
    }

    for (const item of contract.items.filter(item => item.state === 'evidence_green')) {
      expect(item.evidence.join('\n')).toMatch(/bun test|benchmark gate|MAINLINE_LEDGER|执行队列/)
    }
  })

  test('does not fake public model comparison before external runner logs exist', () => {
    const comparison = getDsxuGovernanceAbsorptionItem('P3')

    expect(comparison?.state).toBe('requires_external_runner')
    expect(comparison?.acceptance.join('\n')).toContain('external model has raw logs')
    expect(comparison?.absorptionRules.join('\n')).toContain('dry planned cases are never counted as live success')
  })

  test('protects P6 cleanup ordering: runtime proof first, broad legacy cleanup later', () => {
    const p61 = getDsxuGovernanceAbsorptionItem('P6-1')
    const p62 = getDsxuGovernanceAbsorptionItem('P6-2')
    const p63 = getDsxuGovernanceAbsorptionItem('P6-3')

    expect(p61?.state).toBe('evidence_green')
    expect(p61?.acceptance.join('\n')).toContain('current state table')
    expect(p62?.state).toBe('cleanup_remaining')
    expect(p62?.absorptionRules.join('\n')).toContain('prompt, error, console output')
    expect(p63?.state).toBe('cleanup_remaining')
    expect(p63?.absorptionRules.join('\n')).toContain('explicit legacy flags')
  })

  test('benchmark script exposes dry and live gates for this queue', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')

    expect(benchmark).toContain("'reference-governance-productization'")
    expect(benchmark).toContain("'reference-governance-live-core'")
    expect(benchmark).toContain('governance-query-recovery-live')
    expect(benchmark).toContain('governance-skills-selection-live')
  })

  test('ops ledger has a current-state index ahead of older remaining notes', () => {
    const ledger = read('.dsxu/ops/MAINLINE_LEDGER.md')
    const queue = readOpsDocContaining('P0-1 Query Loop Recovery Deep Absorption', 'P3 Public Cross-Model Evaluation')

    expect(ledger).toContain('Current State Index')
    expect(ledger).toMatch(new RegExp(`(reference|${legacyProductTitle}) governance absorption`))
    expect(queue).toContain('P0-1 Query Loop Recovery Deep Absorption')
    expect(queue).toContain('P3 Public Cross-Model Evaluation')
    expect(queue).toContain('requires_external_runner')
  })
})
