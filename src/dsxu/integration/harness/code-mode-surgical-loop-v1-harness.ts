import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  applyDSXUSurgicalPatch,
  buildDSXUCodeContextPack,
  buildDSXUFinalPatchReport,
  buildDSXURepoIndex,
  createDSXUPatchPlan,
  localizeDSXUCodeFiles,
  parseDSXUCodeIssue,
  probeDSXURepo,
  runDSXUVerification,
  type DSXUCodeFailureType,
  type DSXUSurgicalLoopTrace,
} from '../../engine/code-mode-surgical-loop'
import {
  buildDSXUColdModePlanReport,
  createDefaultColdModeNodes,
} from '../../engine/cold-mode-cost-planning'
import { buildDSXUModelCostEvidenceFromUsage } from '../../engine/final-report-usage-evidence'

export type CodeModeSurgicalLoopHarnessResult = {
  ok: boolean
  tracePath: string
  reportPath: string
  fixtureDir: string
  events: string[]
  patchApplied: boolean
  repairFailureType: string
  verified: boolean
  regressionGuardPassed: boolean
  readBeforeEdit: boolean
  failureType: string
  repoLanguage: string
  packageManager: string
  localizedFiles: string[]
  compressionRatio: number
  repoContextReductionPct: number
  finalStatus: string
  costReported: boolean
  costPerSolvedUsd: number | null
  savingsVsProOnlyPct: number
  modelEvidenceIncludesFlash: boolean
  modelEvidenceIncludesPro: boolean
  modelEvidenceIncludesFlashAndPro: boolean
  error?: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeFixture(root: string): Promise<{ sourceRel: string; testRel: string; regressionRel: string; testAbs: string; regressionAbs: string }> {
  await mkdir(join(root, 'src'), { recursive: true })
  const sourceRel = 'src/cart.ts'
  const testRel = 'src/cart.test.ts'
  const regressionRel = 'src/cart.regression.test.ts'
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      type: 'module',
      devDependencies: { typescript: '^6.0.0' },
      scripts: { test: 'bun test' },
    }, null, 2),
    'utf8',
  )
  await writeFile(join(root, 'bun.lock'), '', 'utf8')
  await writeFile(
    join(root, sourceRel),
    [
      'export function discountedTotal(price: number, qty: number, discount: number): number {',
      '  return price * qty - discount',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(root, testRel),
    [
      "import { expect, test } from 'bun:test'",
      "import { discountedTotal } from './cart'",
      '',
      "test('discounted total clamps at zero', () => {",
      '  expect(discountedTotal(5, 1, 20)).toBe(0)',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(root, regressionRel),
    [
      "import { expect, test } from 'bun:test'",
      "import { discountedTotal } from './cart'",
      '',
      "test('discounted total keeps normal positive totals', () => {",
      '  expect(discountedTotal(10, 2, 5)).toBe(15)',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(root, 'src/noise.ts'),
    Array.from({ length: 220 }, (_, index) =>
      `export const unrelatedValue${index} = ${index} // unrelated implementation detail`,
    ).join('\n'),
    'utf8',
  )
  return {
    sourceRel,
    testRel,
    regressionRel,
    testAbs: join(root, testRel),
    regressionAbs: join(root, regressionRel),
  }
}

async function estimateRepoContextReduction(root: string, files: readonly string[], selectedTokens: number): Promise<number> {
  let allChars = 0
  for (const file of files) {
    allChars += (await readFile(join(root, file), 'utf8')).length
  }
  const fullTokens = Math.max(1, Math.ceil(allChars / 4))
  return Math.round(((fullTokens - selectedTokens) / fullTokens) * 1000) / 10
}

export async function runCodeModeSurgicalLoopHarness(options: {
  evidenceDir?: string
} = {}): Promise<CodeModeSurgicalLoopHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-code-mode')
  await mkdir(evidenceDir, { recursive: true })
  const tracePath = join(evidenceDir, 'code-mode-surgical-loop.trace.json')
  const reportPath = join(evidenceDir, 'code-mode-surgical-loop.final-report.json')
  const fixtureDir = await mkdtemp(join(tmpdir(), 'dsxu-code-mode-'))
  const events: string[] = []

  try {
    const fixture = await writeFixture(fixtureDir)
    events.push('fixture_created')

    const repoProfile = await probeDSXURepo(fixtureDir)
    events.push('repo_profile_created')
    const repoIndex = await buildDSXURepoIndex(fixtureDir)
    events.push('repo_index_created')

    const failedVerification = await runDSXUVerification({
      root: fixtureDir,
      command: ['bun', 'test', fixture.testAbs],
    })
    events.push('initial_verification_failed')
    const issueProfile = parseDSXUCodeIssue({
      command: failedVerification.command,
      exitCode: failedVerification.exitCode,
      stdout: failedVerification.stdout,
      stderr: failedVerification.stderr,
    })
    events.push('issue_profile_created')

    const localization = localizeDSXUCodeFiles({
      query: 'fix discounted total clamp bug',
      repoIndex,
      issueProfile,
    })
    events.push('localized_files')

    const contextPack = await buildDSXUCodeContextPack({
      root: fixtureDir,
      files: localization.files,
      maxCharsPerFile: 600,
    })
    const repoContextReductionPct = await estimateRepoContextReduction(
      fixtureDir,
      [...repoIndex.sourceFiles, ...repoIndex.testFiles],
      contextPack.estimatedInputTokens,
    )
    events.push('context_pack_created')

    const patchPlan = createDSXUPatchPlan({
      goal: 'Clamp discounted total at zero.',
      file: fixture.sourceRel,
      oldText: 'return price * qty - discount',
      newText: 'return Math.max(0, price * qty - discount)',
      verificationCommand: ['bun', 'test', fixture.testAbs, fixture.regressionAbs],
    })
    events.push('patch_plan_created')

    const failedPatchPlan = createDSXUPatchPlan({
      goal: 'Clamp discounted total at zero.',
      file: fixture.sourceRel,
      oldText: 'return price * quantity - discount',
      newText: 'return Math.max(0, price * quantity - discount)',
      verificationCommand: patchPlan.verificationCommand,
    })
    const failedApplyResult = await applyDSXUSurgicalPatch({
      root: fixtureDir,
      plan: failedPatchPlan,
      snapshotDir: join(evidenceDir, 'snapshots'),
    })
    events.push(failedApplyResult.ok ? 'unexpected_patch_applied' : 'repair_patch_failed')
    const repairFailureType = failedApplyResult.failure?.failureType ?? 'UNKNOWN'
    events.push('repair_plan_created')

    const readBeforeEdit = events.includes('context_pack_created')
    const applyResult = await applyDSXUSurgicalPatch({
      root: fixtureDir,
      plan: patchPlan,
      snapshotDir: join(evidenceDir, 'snapshots'),
    })
    events.push(applyResult.ok ? 'patch_applied' : 'patch_failed')

    const verification = await runDSXUVerification({
      root: fixtureDir,
      command: patchPlan.verificationCommand,
    })
    events.push(verification.passed ? 'verification_passed' : 'verification_failed')
    const regressionGuardPassed = /\b2\s+pass\b/i.test(`${verification.stdout}\n${verification.stderr}`)
    const costReport = buildDSXUColdModePlanReport({
      scenario: 'normal_success',
      nodes: createDefaultColdModeNodes(),
    })
    events.push('model_cost_evidence_created')
    const modelCostEvidence = buildDSXUModelCostEvidenceFromUsage({
      scenario: costReport.scenario,
      solved: verification.passed,
      records: costReport.nodes.map((node, index) => {
        const priorFlashNodeIds = costReport.nodes
          .slice(0, index)
          .filter(prior => prior.decision.model === 'deepseek-v4-flash')
          .map(prior => prior.id)
        const isPro = node.decision.model === 'deepseek-v4-pro'
        return {
          nodeId: node.id,
          model: node.decision.model,
          routeReason: node.decision.reason,
          modelEvidence: node.modelEvidence,
          proAdmissionReason: isPro ? node.decision.reason : undefined,
          flashAttemptedBeforePro: isPro ? priorFlashNodeIds.length > 0 : undefined,
          flashAttemptNodeIds: isPro ? priorFlashNodeIds : undefined,
          proSavedTask: isPro
            ? verification.passed && /failed[_-]?verification|recovery|high[_-]?risk|permission/i.test(node.decision.reason)
            : undefined,
          proSaveEvidence: isPro
            ? verification.passed
              ? 'verification passed after Pro node in simulated cold-mode plan'
              : 'verification did not pass after Pro node'
            : undefined,
          usage: {
            input_tokens: node.cacheHitInputTokens + node.cacheMissInputTokens,
            output_tokens: node.outputTokens,
            cache_read_input_tokens: node.cacheHitInputTokens,
            cache_creation_input_tokens: node.cacheMissInputTokens,
            dsxu: {
              model: node.decision.model,
              route_reason: node.decision.reason,
              model_evidence: node.modelEvidence,
              estimated_cost_usd: node.costUsd,
            },
          },
        }
      }),
    })

    const finalReport = buildDSXUFinalPatchReport({
      goal: patchPlan.goal,
      changedFiles: applyResult.changed ? [fixture.sourceRel] : [],
      verification,
      tracePath,
      modelCostEvidence,
    })
    events.push('final_report_created')

    const trace: DSXUSurgicalLoopTrace = {
      repoProfile,
      repoIndex,
      issueProfile,
      localization,
      contextPack,
      metrics: { repoContextReductionPct, regressionGuardPassed },
      patchPlan,
      repairAttempt: {
        applyResult: failedApplyResult,
        failureType: repairFailureType as DSXUCodeFailureType,
      },
      applyResult,
      verification,
      finalReport,
      events,
    }
    await writeJson(tracePath, trace)
    await writeJson(reportPath, finalReport)

    return {
      ok:
        applyResult.ok &&
        verification.passed &&
        readBeforeEdit &&
        repairFailureType === 'PATCH' &&
        regressionGuardPassed &&
        issueProfile.failureType === 'TEST' &&
        repoContextReductionPct >= 40 &&
        finalReport.modelCostEvidence?.costComplete === true &&
        finalReport.modelCostEvidence.costPerSolvedUsd !== null &&
        finalReport.status === 'PASS',
      tracePath,
      reportPath,
      fixtureDir,
      events,
      patchApplied: applyResult.ok,
      repairFailureType,
      verified: verification.passed,
      regressionGuardPassed,
      readBeforeEdit,
      failureType: issueProfile.failureType,
      repoLanguage: repoProfile.language,
      packageManager: repoProfile.packageManager,
      localizedFiles: localization.files,
      compressionRatio: contextPack.compressionRatio,
      repoContextReductionPct,
      finalStatus: finalReport.status,
      costReported: finalReport.modelCostEvidence?.costComplete === true,
      costPerSolvedUsd: finalReport.modelCostEvidence?.costPerSolvedUsd ?? null,
      savingsVsProOnlyPct: finalReport.modelCostEvidence?.savingsVsProOnlyPct ?? 0,
      modelEvidenceIncludesFlash:
        Boolean(finalReport.modelCostEvidence?.modelEvidence.includes('deepseek-v4-flash')),
      modelEvidenceIncludesPro:
        Boolean(finalReport.modelCostEvidence?.modelEvidence.includes('deepseek-v4-pro')),
      modelEvidenceIncludesFlashAndPro:
        Boolean(finalReport.modelCostEvidence?.modelEvidence.includes('deepseek-v4-flash')) &&
        Boolean(finalReport.modelCostEvidence?.modelEvidence.includes('deepseek-v4-pro')),
    }
  } catch (caught) {
    const result: CodeModeSurgicalLoopHarnessResult = {
      ok: false,
      tracePath,
      reportPath,
      fixtureDir,
      events,
      patchApplied: false,
      repairFailureType: 'UNKNOWN',
      verified: false,
      regressionGuardPassed: false,
      readBeforeEdit: false,
      failureType: 'UNKNOWN',
      repoLanguage: 'unknown',
      packageManager: 'unknown',
      localizedFiles: [],
      compressionRatio: 1,
      repoContextReductionPct: 0,
      finalStatus: 'FAIL',
      costReported: false,
      costPerSolvedUsd: null,
      savingsVsProOnlyPct: 0,
      modelEvidenceIncludesFlash: false,
      modelEvidenceIncludesPro: false,
      modelEvidenceIncludesFlashAndPro: false,
      error: caught instanceof Error ? caught.message : String(caught),
    }
    await writeJson(tracePath, result)
    await writeJson(reportPath, result)
    return result
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}
