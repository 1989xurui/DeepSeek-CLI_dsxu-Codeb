import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runCodeModeSurgicalLoopHarness } from '../../integration/harness/code-mode-surgical-loop-v1-harness'
import { runDSXUVerification } from '../code-mode-surgical-loop'

describe('Code Mode Surgical Loop V1', () => {
  test('runs repo probe, localization, patch plan, apply, verify, and final report', async () => {
    const result = await runCodeModeSurgicalLoopHarness()

    expect(result.ok).toBe(true)
    expect(result.repoLanguage).toBe('typescript')
    expect(result.packageManager).toBe('bun')
    expect(result.failureType).toBe('TEST')
    expect(result.localizedFiles).toContain('src/cart.ts')
    expect(result.localizedFiles).toContain('src/cart.test.ts')
    expect(result.localizedFiles).toContain('src/cart.regression.test.ts')
    expect(result.localizedFiles).not.toContain('src/noise.ts')
    expect(result.readBeforeEdit).toBe(true)
    expect(result.repairFailureType).toBe('PATCH')
    expect(result.patchApplied).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.regressionGuardPassed).toBe(true)
    expect(result.finalStatus).toBe('PASS')
    expect(result.costReported).toBe(true)
    expect(result.costPerSolvedUsd).toBeGreaterThan(0)
    expect(result.savingsVsProOnlyPct).toBeGreaterThanOrEqual(40)
    expect(result.modelEvidenceIncludesFlash).toBe(true)
    expect(result.modelEvidenceIncludesPro).toBe(false)
    expect(result.modelEvidenceIncludesFlashAndPro).toBe(false)
    expect(result.compressionRatio).toBeLessThanOrEqual(1)
    expect(result.repoContextReductionPct).toBeGreaterThanOrEqual(40)
    expect(result.events).toEqual([
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
  })

  test('does not treat mixed pass/fail output as verified when a command exits zero', async () => {
    const mixed = await runDSXUVerification({
      root: process.cwd(),
      command: ['bun', '-e', "console.log('1 pass'); console.error('1 fail')"],
    })
    const clean = await runDSXUVerification({
      root: process.cwd(),
      command: ['bun', '-e', "console.log('2 pass'); console.error('0 fail')"],
    })

    expect(mixed.exitCode).toBe(0)
    expect(mixed.passed).toBe(false)
    expect(mixed.failureType).toBe('TEST')
    expect(clean.exitCode).toBe(0)
    expect(clean.passed).toBe(true)
  })
})
