import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  getV11100PointRoadmapContract,
  getV11ScoreBand,
} from '../v11-100-point-roadmap-contract'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('DSXU V11 100 point roadmap contract', () => {
  test('states 100 points as a target and keeps the single-mainline boundary', () => {
    const contract = getV11100PointRoadmapContract()

    expect(contract.runtime).toBe('DSXU V11 100 Point Roadmap')
    expect(contract.sourceBoundary.referenceRoot).toBe('D:\\DSXU-code\\reference-input')
    expect(contract.sourceBoundary.writable).toBe(false)
    expect(contract.gates.live).toBe('v11-100-point-roadmap-live')
    expect(contract.gates.releaseStress).toBe('mutation-product-grade-live')
    expect(contract.gates.experience).toBe('reference-experience-quality-live')
    expect(contract.claimBoundary.join('\n')).toContain('100 points is a roadmap target')
    expect(contract.claimBoundary.join('\n')).toContain('not public model superiority')
  })

  test('tracks all score bands from current estimate toward target experience', () => {
    const contract = getV11100PointRoadmapContract()

    expect(contract.scoreBands.map(item => item.name)).toEqual([
      'controlledBenchmarkFixture',
      'toolPermissionSafety',
      'queryRecovery',
      'compactMemoryRecovery',
      'agentGovernance',
      'mcpWorkflowProvider',
      'openProjectExperience',
      'programmerLikeUx',
      'costControl',
    ])

    expect(getV11ScoreBand('openProjectExperience')?.current).toEqual([60, 72])
    expect(getV11ScoreBand('openProjectExperience')?.target).toBe(90)
    expect(getV11ScoreBand('programmerLikeUx')?.target).toBe(92)
    expect(getV11ScoreBand('queryRecovery')?.target).toBe(95)
  })

  test('turns the route to 100 into concrete workstreams and metrics', () => {
    const contract = getV11100PointRoadmapContract()

    expect(contract.workstreams.map(item => item.id)).toEqual([
      'V11-P0 Open Project Task Pack',
      'V11-P1 Query Recovery To 95',
      'V11-P2 Agent Governance To 93',
      'V11-P3 Tool And UX Discipline',
      'V11-P4 Long Task And Ecosystem',
    ])

    const allMetrics = contract.workstreams.flatMap(item => item.metrics)
    expect(allMetrics).toContain('realTaskCompletionRate')
    expect(allMetrics).toContain('driftRate')
    expect(allMetrics).toContain('recoveryQuality')
    expect(allMetrics).toContain('costPerVerifiedPass')
  })

  test('defines the ten-task open project pack required for the next quality jump', () => {
    const contract = getV11100PointRoadmapContract()

    expect(contract.openProjectTaskPack).toHaveLength(10)
    expect(contract.openProjectTaskPack.map(item => item.id)).toContain('open-multifile-feature')
    expect(contract.openProjectTaskPack.map(item => item.id)).toContain('open-agent-worker-longrun')
    expect(contract.openProjectTaskPack.map(item => item.id)).toContain('open-mcp-resource-fix')
    expect(contract.openProjectTaskPack.map(item => item.id)).toContain('open-external-scope-grant')

    for (const task of contract.openProjectTaskPack) {
      expect(task.requiredEvidence).toContain(task.id === 'open-agent-worker-longrun' ? 'worker evidence' : task.requiredEvidence[0])
      expect(task.failureSignals.length).toBeGreaterThanOrEqual(3)
    }
  })

  test('records DeepSeek V4 routing as a cost-control mechanism, not a quality shortcut', () => {
    const contract = getV11100PointRoadmapContract()

    expect(contract.modelRouting.map(item => item.route)).toEqual([
      'scan-readonly',
      'default-coding',
      'recovery-review-verifier',
      'complex-leader',
    ])
    expect(contract.modelRouting[0].model).toContain('flash')
    expect(contract.modelRouting[3].model).toContain('pro')
    expect(contract.modelRouting.flatMap(item => item.escalationTrigger)).toContain('failed verification twice')
  })

  test('exposes V11 benchmark gates and keeps current local evidence wired into reports', () => {
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')
    const report = read('.dsxu/ops/DSXU-Code-本地阶段测试报告-20260502.md')

    expect(benchmark).toContain("'v11-100-point-roadmap'")
    expect(benchmark).toContain("'v11-100-point-roadmap-live'")
    expect(benchmark).toContain('v11-open-project-pack-readiness-live')
    expect(report).toContain('reference experience quality live')
    expect(report).toContain('Product-grade mutation 22-case stress')

    expect(existsSync(join(root, 'reference-input', 'query.ts'))).toBe(true)
    expect(existsSync(join(root, 'src', 'dsxu', 'engine', 'reference-experience-quality-contract.ts'))).toBe(true)
  })
})
