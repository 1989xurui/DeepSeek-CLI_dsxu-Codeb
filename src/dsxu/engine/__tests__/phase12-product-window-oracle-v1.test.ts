import { describe, expect, test } from 'bun:test'
import {
  buildDefaultP12ProductWindowScenarios,
  buildP12ProductWindowOracle,
  evaluateP12ProductWindowScenario,
} from '../phase12-product-window-oracle-v1'
import { buildPhase12ExperienceOracle } from '../phase12-experience-oracle'

describe('WP-04 - P12-10 Product Window Oracle', () => {
  test('1. default product-window replay covers five P12-10 scenarios', () => {
    const oracle = buildP12ProductWindowOracle()

    expect(oracle.schemaVersion).toBe('dsxu.phase12-product-window-oracle.v1')
    expect(oracle.phase12Id).toBe('P12-10')
    expect(oracle.status).toBe('PASS')
    expect(oracle.scenarioCount).toBe(5)
    expect(oracle.pass).toBe(5)
    expect(oracle.partial).toBe(0)
    expect(oracle.blocked).toBe(0)
    expect(oracle.mustNotClaimDone).toBe(false)
    expect(oracle.requiredArtifacts.length).toBeGreaterThanOrEqual(10)
  })

  test('2. permission handoff is visible and cannot preempt active human turn', () => {
    const scenario = buildDefaultP12ProductWindowScenarios().find(
      item => item.scenarioId === 'P12-10-B-permission-handoff',
    )
    expect(scenario).toBeDefined()
    const result = evaluateP12ProductWindowScenario(scenario!)

    expect(result.status).toBe('PASS')
    expect(result.evidenceSummary.visiblePermissionWaitCount).toBeGreaterThan(0)
    expect(result.contaminationChecks.permissionPreemptedActiveTurn).toBe(false)
    expect(result.contaminationChecks.hiddenPermissionWait).toBe(false)
    expect(result.toolEvidencePacks[0]?.resultStatus).toBe('blocked')
    expect(result.contextOwnerRules[0]?.mayClaimPass).toBe(false)
  })

  test('3. background notification is ordered after completion evidence', () => {
    const scenario = buildDefaultP12ProductWindowScenarios().find(
      item => item.scenarioId === 'P12-10-C-background-notification',
    )
    expect(scenario).toBeDefined()
    const result = evaluateP12ProductWindowScenario(scenario!)
    const events = result.events.map(event => event.event)

    expect(result.status).toBe('PASS')
    expect(events.indexOf('tool_evidence_recorded')).toBeLessThan(events.indexOf('background_task_completed'))
    expect(events.indexOf('background_task_completed')).toBeLessThan(events.indexOf('background_notification_recorded'))
    expect(result.contaminationChecks.backgroundResultInjected).toBe(false)
    expect(result.evidenceSummary.backgroundNotificationCount).toBe(1)
  })

  test('4. compact/resume preserves pending work and blocks premature PASS', () => {
    const scenario = buildDefaultP12ProductWindowScenarios().find(
      item => item.scenarioId === 'P12-10-D-compact-resume-pending-work',
    )
    expect(scenario).toBeDefined()
    const result = evaluateP12ProductWindowScenario(scenario!)

    expect(result.status).toBe('PASS')
    expect(result.contextOwnerRules[0]?.mayEdit).toBe(false)
    expect(result.contextOwnerRules[0]?.mayClaimPass).toBe(false)
    expect(result.contextOwnerRules[0]?.blockReasons).toContain('source_truth_not_reread_after_resume')
    expect(result.contaminationChecks.resumeClaimedPassWithoutOwnerRule).toBe(false)
  })

  test('5. skill-assisted window requires governance, context owner, and tool evidence', () => {
    const scenario = buildDefaultP12ProductWindowScenarios().find(
      item => item.scenarioId === 'P12-10-E-skill-governed-window',
    )
    expect(scenario).toBeDefined()
    const result = evaluateP12ProductWindowScenario(scenario!)

    expect(result.status).toBe('PASS')
    expect(result.evidenceSummary.skillGovernanceCount).toBe(1)
    expect(result.skillGovernanceContracts?.[0]?.status).toBe('ready')
    expect(result.skillGovernanceContracts?.[0]?.evidenceFields).toContain('contextOwnerRule')
    expect(result.skillGovernanceContracts?.[0]?.evidenceFields).toContain('toolEvidencePack')
    expect(result.evidenceSummary.toolEvidenceTraceIds.length).toBeGreaterThan(0)
  })

  test('6. hidden permission wait is a blocked product-window failure', () => {
    const scenario = buildDefaultP12ProductWindowScenarios().find(
      item => item.scenarioId === 'P12-10-B-permission-handoff',
    )!
    const broken = evaluateP12ProductWindowScenario({
      ...scenario,
      events: scenario.events.filter(event => event.event !== 'permission_wait_visible'),
      contaminationChecks: {
        ...scenario.contaminationChecks,
        hiddenPermissionWait: true,
      },
    })

    expect(broken.status).toBe('BLOCKED')
    expect(broken.redlines.join('\n')).toContain('permission wait is hidden')
    expect(broken.redlines.join('\n')).toContain('permission wait had no visible state')
  })

  test('7. phase12 summary promotes P12-10 after product-window oracle evidence', () => {
    const summary = buildPhase12ExperienceOracle()
    const p1210 = summary.scenarios.find(scenario => scenario.id === 'P12-10')

    expect(p1210?.status).toBe('PASS')
    expect(p1210?.decision).toBe('kept-mainline')
    expect(p1210?.evidenceTests).toContain('phase12-product-window-oracle-v1.test.ts')
    expect(summary.pass).toBe(9)
    expect(summary.partial).toBe(1)
    expect(summary.nextQueue).toEqual(['P12-19'])
  })
})
