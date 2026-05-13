import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runCodeModeSurgicalLoopHarness } from '../../integration/harness/code-mode-surgical-loop-v1-harness'
import { PHASE12_EXPERIENCE_ORACLE } from '../phase12-experience-oracle'

function expectEventOrder(events: readonly string[], ordered: readonly string[]): void {
  const positions = ordered.map(event => events.indexOf(event))

  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
}

describe('Phase 12 senior-programmer experience V1', () => {
  test('keeps local reference semantics as DSXU-owned gates rather than copied runtime', () => {
    const scenario = PHASE12_EXPERIENCE_ORACLE.find(item => item.id === 'P12-20')
    const gates = scenario?.referenceSemantics ?? []
    const rendered = JSON.stringify(gates)

    expect(gates).toHaveLength(6)
    expect(rendered).toContain('safe tools may overlap')
    expect(rendered).toContain('mutating tools are exclusive')
    expect(rendered).toContain('source truth must be read before edit')
    expect(rendered).toContain('background results are not fabricated')
    expect(rendered).toContain('resume preserves user intent')
    expect(rendered).not.toContain('provider shells into the default path')
    expect(rendered).not.toContain('second runnable system')
  })

  test('uses a real evidence-led coding process instead of a score-only PASS', async () => {
    const result = await runCodeModeSurgicalLoopHarness({
      evidenceDir: join(process.cwd(), '.dsxu', 'trace', 'v19-phase12-experience-oracle', 'p12-20'),
    })

    expect(result.ok).toBe(true)
    expect(result.repoLanguage).toBe('typescript')
    expect(result.packageManager).toBe('bun')
    expect(result.failureType).toBe('TEST')
    expect(result.readBeforeEdit).toBe(true)

    expect(result.localizedFiles).toContain('src/cart.ts')
    expect(result.localizedFiles).toContain('src/cart.test.ts')
    expect(result.localizedFiles).toContain('src/cart.regression.test.ts')
    expect(result.localizedFiles).not.toContain('src/noise.ts')
    expect(result.compressionRatio).toBeLessThanOrEqual(1)
    expect(result.repoContextReductionPct).toBeGreaterThanOrEqual(40)

    expect(result.repairFailureType).toBe('PATCH')
    expect(result.patchApplied).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.regressionGuardPassed).toBe(true)
    expect(result.finalStatus).toBe('PASS')

    expect(result.costReported).toBe(true)
    expect(result.costPerSolvedUsd).toBeGreaterThan(0)
    expect(result.savingsVsProOnlyPct).toBeGreaterThanOrEqual(40)
    expect(result.modelEvidenceIncludesFlash).toBe(true)
    expect(result.modelEvidenceIncludesFlashAndPro).toBe(false)

    expectEventOrder(result.events, [
      'fixture_created',
      'repo_profile_created',
      'repo_index_created',
      'initial_verification_failed',
      'issue_profile_created',
      'localized_files',
      'context_pack_created',
      'patch_plan_created',
      'repair_patch_failed',
      'repair_plan_created',
      'patch_applied',
      'verification_passed',
      'model_cost_evidence_created',
      'final_report_created',
    ])

    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.reportPath)).toBe(true)

    const trace = JSON.parse(readFileSync(result.tracePath, 'utf8')) as {
      issueProfile: { failureType: string; summary: string }
      localization: { files: readonly string[]; reasons: readonly string[] }
      contextPack: { files: readonly Array<{ path: string }> }
      repairAttempt: { failureType: string }
      verification: { passed: boolean; command: readonly string[] }
      finalReport: { status: string; summary: string; risks: readonly string[] }
      events: readonly string[]
    }
    const report = JSON.parse(readFileSync(result.reportPath, 'utf8')) as {
      status: string
      summary: string
      risks: readonly string[]
      modelCostEvidence?: { costComplete: boolean; costPerSolvedUsd: number | null }
    }

    expect(trace.issueProfile.failureType).toBe('TEST')
    expect(trace.issueProfile.summary).toMatch(/expect|fail|error|expected/i)
    expect(`${JSON.stringify(trace.issueProfile)}`).toContain('Received: -15')
    expect(trace.localization.files).toEqual(result.localizedFiles)
    expect(trace.localization.reasons.join('\n')).toContain('test-source-pair')
    expect(trace.contextPack.files.map(file => file.path)).toContain('src/cart.ts')
    expect(trace.repairAttempt.failureType).toBe('PATCH')
    expect(trace.verification.passed).toBe(true)
    expect(trace.verification.command.join(' ')).toContain('bun test')
    expect(trace.finalReport.status).toBe('PASS')
    expect(trace.finalReport.summary).toContain('verified with')
    expect(trace.finalReport.risks.join('\n')).toContain('No known residual risk')
    expect(trace.events).toEqual(result.events)

    expect(report.status).toBe('PASS')
    expect(report.summary).toContain('Cost evidence')
    expect(report.risks.join('\n')).toContain('No known residual risk')
    expect(report.modelCostEvidence?.costComplete).toBe(true)
    expect(report.modelCostEvidence?.costPerSolvedUsd).toBeGreaterThan(0)
  })
})
