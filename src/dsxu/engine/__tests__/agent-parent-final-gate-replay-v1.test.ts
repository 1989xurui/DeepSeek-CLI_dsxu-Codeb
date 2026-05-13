import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runAgentParentFinalGateReplay } from '../../integration/harness/agent-parent-final-gate-replay-v1-harness'

describe('Agent parent final gate replay V1', () => {
  test('blocks fake Done/PASS and allows evidence-cited or honest partial finals', async () => {
    const result = await runAgentParentFinalGateReplay()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.aggregate).toMatchObject({
      caseCount: 7,
      completeWithoutCitationBlocked: true,
      completeWithCitationAllowed: true,
      partialDonePassBlocked: true,
      partialDisclosedAllowed: true,
      gluedDonePassBlocked: true,
      actualAgentToolResultBlocked: true,
      actualTaskOutputResultBlocked: true,
    })
    expect(result.cases.find(item => item.id === 'complete-evidence-bare-done-blocked')?.nudge).toContain(
      'does not cite concrete worker evidence',
    )
    expect(result.cases.find(item => item.id === 'partial-evidence-done-pass-blocked')?.nudge).toContain(
      'latest Agent evidence is partial',
    )
    expect(result.cases.find(item => item.id === 'complete-evidence-cited-final-allowed')?.nudge).toBeNull()
    expect(result.cases.find(item => item.id === 'partial-evidence-disclosed-final-allowed')?.nudge).toBeNull()
    expect(result.cases.find(item => item.id === 'actual-agent-tool-result-bare-done-blocked')?.nudge).toContain(
      'does not cite concrete worker evidence',
    )
    expect(result.cases.find(item => item.id === 'actual-task-output-result-bare-done-blocked')?.nudge).toContain(
      'does not cite concrete worker evidence',
    )
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })
})
