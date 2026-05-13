import { describe, expect, test } from 'bun:test'
import {
  PHASE12_EXPERIENCE_ORACLE,
  buildPhase12ExperienceOracle,
} from '../phase12-experience-oracle'

describe('Phase 12 experience oracle V1', () => {
  test('promotes core failure-bank scenarios from plan-ready to evidenced replay status', () => {
    const oracle = buildPhase12ExperienceOracle()
    const byId = new Map(oracle.scenarios.map(scenario => [scenario.id, scenario]))

    expect(oracle.schemaVersion).toBe('dsxu.phase12-experience-oracle.v1')
    expect(oracle.pass).toBe(9)
    expect(oracle.partial).toBe(1)
    expect(oracle.blocked).toBe(0)
    expect(oracle.overallStatus).toBe('PARTIAL')
    expect(oracle.mustNotClaimDone).toBe(true)

    expect(byId.get('P12-01')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(byId.get('P12-04')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(byId.get('P12-05')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(byId.get('P12-08')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(byId.get('P12-20')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(byId.get('P12-20')?.evidenceTests).toContain(
      'phase12-reference-semantic-exam-v1.test.ts',
    )
    expect(byId.get('P12-20')?.qualitySignals?.length).toBeGreaterThanOrEqual(6)
    expect(byId.get('P12-20')?.referenceSemantics?.map(item => item.area)).toEqual([
      'streaming tool orchestration',
      'tool execution and permission recovery',
      'read-before-edit and exact patching',
      'complex task progress',
      'agent delegation',
      'compact and resume',
    ])
  })

  test('keeps deferred product-window and comparison work out of DONE claims', () => {
    const oracle = buildPhase12ExperienceOracle()

    expect(oracle.nextQueue).toEqual(['P12-19'])
    expect(oracle.scenarios.find(scenario => scenario.id === 'P12-17')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(
      oracle.scenarios.find(scenario => scenario.id === 'P12-17')?.evidenceTests.join('\n'),
    ).toContain('phase12-live-cost-matrix-v1.test.ts')
    expect(
      oracle.scenarios.find(scenario => scenario.id === 'P12-19')?.unresolved.join('\n'),
    ).toContain('external runner evidence')
    expect(
      oracle.scenarios.find(scenario => scenario.id === 'P12-19')?.evidenceTests.join('\n'),
    ).toContain('phase12-raw-comparison-v1.test.ts')
    expect(oracle.scenarios.find(scenario => scenario.id === 'P12-10')).toMatchObject({
      status: 'PASS',
      decision: 'kept-mainline',
    })
    expect(
      oracle.scenarios.find(scenario => scenario.id === 'P12-10')?.evidenceTests.join('\n'),
    ).toContain('phase12-product-window-oracle-v1.test.ts')
  })

  test('does not open a second runtime or treat dry plans as ranking evidence', () => {
    const rendered = JSON.stringify(PHASE12_EXPERIENCE_ORACLE)

    expect(rendered).not.toContain('second runtime')
    expect(rendered).toContain('cannot use dry plans as ranking evidence')
    expect(rendered).toContain('same-task raw external logs')
    expect(rendered).toContain('weak-model routes must externalize process evidence')
    expect(rendered).toContain('background results are not fabricated')
  })
})
