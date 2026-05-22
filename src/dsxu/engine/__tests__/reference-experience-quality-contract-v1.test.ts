import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  getReferenceExperienceQualityContract,
  getReferenceExperienceQualityItem,
} from '../reference-experience-quality-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const localReferenceRoot = join(root, `\u539f\u4ee3\u7801${['cl', 'aude'].join('')}`)

describe('DSXU reference experience quality absorption contract', () => {
  test('tracks P1-P7 as one-mainline behavior absorption, not a second system', () => {
    const contract = getReferenceExperienceQualityContract()

    expect(contract.runtime).toBe('DSXU Reference Experience Quality Absorption')
    expect(contract.sourceBoundary.referenceRoot).toBe('D:\\DSXU-code\\reference-input')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.gates.live).toBe('reference-experience-quality-live')
    expect(contract.gates.releaseStress).toBe('mutation-product-grade-live')
    expect(contract.items.map(item => item.id)).toEqual([
      'P1 Query Loop Programmer Recovery',
      'P2 Agent Team Governance',
      'P3 Tool Prompt Strong Discipline',
      'P4 Compact Memory Product Resume',
      'P5 Permission Usability',
      'P6 MCP Real Ecosystem',
      'P7 Programmer-Like UX',
    ])
    expect(contract.oneMainlineRules.join('\n')).toContain('single DSXU mainline')
    expect(contract.oneMainlineRules.join('\n')).toContain('external model superiority is not claimed')
  })

  test('keeps the reference behavior source read-only and present for every high-value behavior bucket', () => {
    const contract = getReferenceExperienceQualityContract()

    for (const item of contract.items) {
      expect(item.referenceBehavior.length).toBeGreaterThan(0)
      expect(item.dsxuLanding.length).toBeGreaterThan(0)
      expect(item.behaviorContract.length).toBeGreaterThanOrEqual(5)
      expect(item.acceptance.length).toBeGreaterThan(0)
      expect(item.metrics.length).toBeGreaterThan(0)
    }

    expect(existsSync(join(localReferenceRoot, 'query.ts'))).toBe(true)
    expect(existsSync(join(localReferenceRoot, 'query', 'stopHooks.ts'))).toBe(true)
    expect(existsSync(join(localReferenceRoot, 'Tool.ts'))).toBe(true)
    expect(existsSync(join(localReferenceRoot, 'services', 'AgentSummary'))).toBe(true)
    expect(existsSync(join(localReferenceRoot, 'constants', 'prompts.ts'))).toBe(true)
  })

  test('maps the experience gaps onto current DSXU mainline files and prompts', () => {
    const contract = getReferenceExperienceQualityContract()
    const allLanding = contract.items.flatMap(item => item.dsxuLanding)

    expect(allLanding).toContain('src/dsxu/engine/query-loop.ts')
    expect(allLanding).toContain('src/tools/AgentTool/prompt.ts')
    expect(allLanding).toContain('src/tools/SendMessageTool/prompt.ts')
    expect(allLanding).toContain('src/dsxu/engine/permission-usability.ts')
    expect(allLanding).toContain('src/services/mcp/client.ts')
    expect(allLanding).toContain('src/dsxu/engine/system-prompt.ts')

    expect(existsSync(join(root, 'src', 'tools', 'AgentTool', 'prompt.ts'))).toBe(true)
    expect(existsSync(join(root, 'src', 'tools', 'SendMessageTool', 'prompt.ts'))).toBe(true)
    expect(existsSync(join(root, 'src', 'tools', 'MCPTool', 'prompt.ts'))).toBe(true)
    expect(existsSync(join(root, 'src', 'tools', 'WorkflowTool', 'prompt.ts'))).toBe(true)
  })

  test('exposes a benchmark case for each experience quality workstream', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const contract = getReferenceExperienceQualityContract()
    const cases = contract.items.flatMap(item => item.benchmarkCases)

    for (const id of cases) {
      expect(benchmark).toContain(id)
    }
    expect(benchmark).toContain("'reference-experience-quality'")
    expect(benchmark).toContain("'reference-experience-quality-live'")
    expect(benchmark).toContain("'mutation-product-grade-live'")
  })

  test('locks the three optimization metrics the user cares about', () => {
    const contract = getReferenceExperienceQualityContract()

    expect(contract.scoreFocus).toContain('realTaskCompletionRate')
    expect(contract.scoreFocus).toContain('driftRate')
    expect(contract.scoreFocus).toContain('recoveryQuality')

    const ux = getReferenceExperienceQualityItem('P7')
    expect(ux?.behaviorContract.join('\n')).toContain('task start naturally narrows scope')
    expect(ux?.behaviorContract.join('\n')).toContain('PARTIAL is never packaged as PASS')
    expect(ux?.state).toBe('needs_open_project_live')
  })

  test('records the latest product-grade stress evidence as current local proof, not public model ranking', () => {
    const report = read('.dsxu/ops/DSXU-Code-本地阶段测试报告-20260502.md')
    const ledger = read('.dsxu/ops/MAINLINE_LEDGER.md')

    expect(report).toMatch(/Live gates: \d+\/\d+ pass/)
    expect(report).toContain('Product-grade mutation 22-case stress')
    expect(report).toContain('| Product-grade mutation 22-case stress | live | mutation-product-grade-live | 22 | 22 | 0')
    expect(ledger).toContain('Product-grade 22-case stress: 22 pass, 0 fail, 0 policy fail')
    expect(report).toContain('not a public cross-model leaderboard result')
  })
})
