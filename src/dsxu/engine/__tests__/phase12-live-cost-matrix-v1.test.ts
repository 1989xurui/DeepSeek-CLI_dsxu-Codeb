import { describe, expect, test } from 'bun:test'
import {
  buildDefaultP12LiveCostMatrixSamples,
  buildP12LiveCostMatrix,
  buildP12LiveCostMatrixEntry,
  type P12LiveCostTaskSample,
} from '../phase12-live-cost-matrix-v1'
import { buildPhase12ExperienceOracle } from '../phase12-experience-oracle'

describe('WP-05 - P12-17 Live Cost Matrix', () => {
  test('1. default matrix passes with adapter/live provider usage and final report linkage', () => {
    const matrix = buildP12LiveCostMatrix()

    expect(matrix.schemaVersion).toBe('dsxu.phase12-live-cost-matrix.v1')
    expect(matrix.phase12Id).toBe('P12-17')
    expect(matrix.status).toBe('PASS')
    expect(matrix.sampleCount).toBe(4)
    expect(matrix.passSamples).toBe(3)
    expect(matrix.partialSamples).toBe(1)
    expect(matrix.usageCompletenessPct).toBe(100)
    expect(matrix.routeReasonCoveragePct).toBe(100)
    expect(matrix.cacheFieldCompletenessPct).toBe(100)
    expect(matrix.finalReportLinkagePct).toBe(100)
    expect(matrix.liveUsageSourceCoveragePct).toBe(100)
    expect(matrix.costPerSolvedTaskUsd).toBeGreaterThan(0)
    expect(matrix.nextQueue).toEqual(['P12-19'])
  })

  test('2. Pro rescue sample requires prior Flash attempt, admission reason, and save evidence', () => {
    const entry = buildP12LiveCostMatrix().entries.find(entry => entry.taskId === 'p12-17-bugfix-pro-rescue')

    expect(entry).toBeDefined()
    expect(entry?.proRescueRequired).toBe(true)
    expect(entry?.proRescueSatisfied).toBe(true)
    expect(entry?.modelCostEvidence.proRoi).toMatchObject({
      proNodeCount: 1,
      proNodesWithPriorFlashAttempt: 1,
      proNodesWithAdmissionReason: 1,
      proNodesMarkedSavedTask: 1,
      proRoiRatePct: 100,
    })
    expect(entry?.routeReasons.join('\n')).toContain('failed_verification_pro_thinking_max')
  })

  test('3. Flash-only success preserves solved cost and does not invent Pro ROI', () => {
    const entry = buildP12LiveCostMatrix().entries.find(entry => entry.taskId === 'p12-17-feature-flash-only')

    expect(entry).toBeDefined()
    expect(entry?.outcome).toBe('PASS')
    expect(entry?.solvedCostUsd).toBeGreaterThan(0)
    expect(entry?.modelCostEvidence.proNodeRatio).toBe(0)
    expect(entry?.modelCostEvidence.proRoi).toMatchObject({
      proNodeCount: 0,
      proNodesWithPriorFlashAttempt: 0,
      proNodesWithAdmissionReason: 0,
      proNodesMarkedSavedTask: 0,
      proRoiRatePct: 0,
      entries: [],
    })
  })

  test('4. PARTIAL sample keeps total cost but does not enter solved cost', () => {
    const entry = buildP12LiveCostMatrix().entries.find(entry => entry.taskId === 'p12-17-partial-terminal-repair')

    expect(entry).toBeDefined()
    expect(entry?.outcome).toBe('PARTIAL')
    expect(entry?.totalCostUsd).toBeGreaterThan(0)
    expect(entry?.solvedCostUsd).toBeNull()
    expect(entry?.risks).toEqual([])
  })

  test('5. missing route reason and cache fields block the matrix', () => {
    const [sample] = buildDefaultP12LiveCostMatrixSamples()
    const broken: P12LiveCostTaskSample = {
      ...sample,
      records: [
        {
          nodeId: 'broken-record',
          model: 'deepseek-v4-flash',
          usage: {
            input_tokens: 1000,
            output_tokens: 120,
          },
        },
      ],
    }
    const entry = buildP12LiveCostMatrixEntry(broken)
    const matrix = buildP12LiveCostMatrix([broken])

    expect(entry.routeReasonCoveragePct).toBe(0)
    expect(entry.cacheFieldCompletenessPct).toBe(0)
    expect(entry.risks).toContain('missing route reason coverage')
    expect(entry.risks).toContain('missing cache token fields')
    expect(matrix.status).toBe('BLOCKED')
    expect(matrix.redlines.join('\n')).toContain('missing route reason coverage')
  })

  test('6. phase12 summary promotes P12-17 after live cost matrix evidence', () => {
    const summary = buildPhase12ExperienceOracle()
    const p1217 = summary.scenarios.find(scenario => scenario.id === 'P12-17')

    expect(p1217?.status).toBe('PASS')
    expect(p1217?.decision).toBe('kept-mainline')
    expect(p1217?.evidenceTests).toContain('phase12-live-cost-matrix-v1.test.ts')
    expect(summary.pass).toBe(9)
    expect(summary.partial).toBe(1)
    expect(summary.nextQueue).toEqual(['P12-19'])
  })
})
