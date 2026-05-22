import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildDSXUCodeContextPack,
  buildDSXUCodeImpactRadar,
  buildDSXUEvidenceDrivenReview,
  decideDSXUReadFallback,
  type DSXUReadFallbackDecision,
} from '../src/dsxu/engine/code-mode-surgical-loop'
import { buildDSXUPromptPrefixCachePlan } from '../src/dsxu/engine/prompt-prefix-cache-builder'

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_SOURCE_CACHE_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_SOURCE_CACHE_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_SOURCE_CACHE_ACCEPTANCE_${DATE}.md`)

function largeCheckoutSource(): string {
  const lines = [
    'export type CartItem = { price: number; qty: number; discount?: number }',
    '',
    'export function calculateSubtotal(items: CartItem[]): number {',
    '  return items.reduce((sum, item) => sum + item.price * item.qty, 0)',
    '}',
    '',
  ]
  for (let i = 0; i < 520; i += 1) {
    lines.push(`export const generatedCheckoutRule${i} = ${i}`)
  }
  lines.push('')
  lines.push('export function applyCoupon(total: number, couponPct: number): number {')
  lines.push('  return total - total * couponPct')
  lines.push('}')
  return `${lines.join('\n')}\n`
}

async function writeFixture(root: string, file: string, content: string): Promise<void> {
  const full = join(root, file)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content, 'utf8')
}

function decisionRow(name: string, decision: DSXUReadFallbackDecision): string[] {
  return [
    name,
    decision.status,
    String(decision.allowed),
    decision.path,
    String(decision.requestedOffset ?? ''),
    String(decision.requestedLimit ?? ''),
    String(decision.recommendedOffset ?? ''),
    String(decision.recommendedLimit ?? ''),
    String(decision.estimatedApproxTokens),
    decision.reason,
  ]
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'dsxu-source-cache-acceptance-'))
  await writeFixture(fixtureRoot, 'src/checkout.ts', largeCheckoutSource())
  await writeFixture(
    fixtureRoot,
    'src/checkout.test.ts',
    [
      "import { applyCoupon, calculateSubtotal } from './checkout'",
      '',
      "test('coupon applies after subtotal', () => {",
      '  expect(applyCoupon(calculateSubtotal([{ price: 10, qty: 2 }]), 0.1)).toBe(18)',
      '})',
      '',
    ].join('\n'),
  )

  const contextPack = await buildDSXUCodeContextPack({
    root: fixtureRoot,
    files: ['src/checkout.ts', 'src/checkout.test.ts'],
    query: 'repair checkout coupon subtotal bug',
    maxCharsPerFile: 760,
  })
  const capsule = contextPack.sourceTruthCapsules.find(item => item.path === 'src/checkout.ts')
  if (!capsule) throw new Error('missing checkout capsule')

  const fullReadDecision = decideDSXUReadFallback({
    path: 'src/checkout.ts',
    capsules: contextPack.sourceTruthCapsules,
  })
  const unlocatedRangeDecision = decideDSXUReadFallback({
    path: 'src/checkout.ts',
    capsules: contextPack.sourceTruthCapsules,
    offset: fullReadDecision.recommendedOffset,
    limit: fullReadDecision.recommendedLimit,
  })
  const boundedRangeDecision = decideDSXUReadFallback({
    path: 'src/checkout.ts',
    capsules: contextPack.sourceTruthCapsules,
    offset: fullReadDecision.recommendedOffset,
    limit: fullReadDecision.recommendedLimit,
    locatorEvidence: true,
  })
  const overBudgetDecision = decideDSXUReadFallback({
    path: 'src/checkout.ts',
    capsules: contextPack.sourceTruthCapsules,
    offset: 1,
    limit: 400,
    locatorEvidence: true,
  })
  const impactRadar = buildDSXUCodeImpactRadar({
    root: fixtureRoot,
    changedFiles: ['src/checkout.ts'],
  })
  const evidenceDrivenReview = buildDSXUEvidenceDrivenReview({
    goal: 'repair checkout coupon subtotal bug',
    sourceTruthCapsules: contextPack.sourceTruthCapsules,
    impactRadar,
    readFallbackDecisions: [
      fullReadDecision,
      unlocatedRangeDecision,
      boundedRangeDecision,
      overBudgetDecision,
    ],
    verification: {
      command: impactRadar.recommendedVerification,
      exitCode: 0,
      stdout: '1 pass 0 fail',
      stderr: '',
      passed: true,
      failureType: 'UNKNOWN',
    },
    repairCandidates: ['Patch applyCoupon after confirming subtotal source capsule and focused test.'],
  })

  const stableSourceCapsule = {
    id: 'source_truth_capsule',
    content: JSON.stringify(contextPack.sourceTruthCapsules.map(item => ({
      capsuleId: item.capsuleId,
      path: item.path,
      sha256: item.sha256,
      anchors: item.anchors.map(anchor => ({ id: anchor.id, line: anchor.line, reason: anchor.reason })),
      fallbackReadPolicy: item.fallbackReadPolicy,
    }))),
  }
  const firstPrefix = buildDSXUPromptPrefixCachePlan({
    workflowKind: 'coding',
    stableSections: [
      { id: 'system_rules', content: 'DSXU code mode uses source-truth capsules and bounded fallback Read.' },
      { id: 'tool_schemas', content: 'Read(path, offset, limit), Grep(pattern), Edit(file, old_string, new_string), RunNativeTest(command).' },
      stableSourceCapsule,
    ],
    dynamicSections: [{ id: 'current_task', content: 'fix checkout coupon bug' }],
  })
  const secondPrefix = buildDSXUPromptPrefixCachePlan({
    workflowKind: 'coding',
    stableSections: [
      stableSourceCapsule,
      { id: 'tool_schemas', content: 'Read(path, offset, limit), Grep(pattern), Edit(file, old_string, new_string), RunNativeTest(command).' },
      { id: 'system_rules', content: 'DSXU code mode uses source-truth capsules and bounded fallback Read.' },
    ],
    dynamicSections: [{ id: 'current_task', content: 'review checkout coupon regression' }],
  })

  const pass =
    contextPack.sourceTruthCapsules.length === 2 &&
    contextPack.cacheHygiene.noReadDefault &&
    contextPack.rawChars > contextPack.packedChars &&
    fullReadDecision.status === 'BLOCK_FULL_FILE_READ' &&
    unlocatedRangeDecision.status === 'BLOCK_UNLOCATED_LARGE_READ' &&
    boundedRangeDecision.status === 'ALLOW_BOUNDED_READ' &&
    overBudgetDecision.status === 'BLOCK_OVER_BUDGET_READ' &&
    firstPrefix.ok &&
    secondPrefix.ok &&
    firstPrefix.stablePrefixHash === secondPrefix.stablePrefixHash &&
    firstPrefix.dynamicTailHash !== secondPrefix.dynamicTailHash &&
    impactRadar.affectedTests.includes('src/checkout.test.ts') &&
    evidenceDrivenReview.status === 'EVIDENCE_REVIEW_READY'

  const report = {
    schemaVersion: 'dsxu.source-cache-acceptance.v1',
    generatedAt: new Date().toISOString(),
    status: pass ? 'PASS_SOURCE_CACHE_ACCEPTANCE' : 'FAIL_SOURCE_CACHE_ACCEPTANCE',
    fixtureRoot,
    contextPack: {
      capsuleCount: contextPack.sourceTruthCapsules.length,
      rawChars: contextPack.rawChars,
      packedChars: contextPack.packedChars,
      estimatedInputTokens: contextPack.estimatedInputTokens,
      compressionRatio: contextPack.compressionRatio,
      toolResultCharsAvoided: contextPack.cacheHygiene.toolResultCharsAvoided,
      cacheHygieneStatus: contextPack.cacheHygiene.status,
      noReadDefault: contextPack.cacheHygiene.noReadDefault,
      guards: contextPack.cacheHygiene.guards,
    },
    capsules: contextPack.sourceTruthCapsules.map(item => ({
      capsuleId: item.capsuleId,
      path: item.path,
      sha256: item.sha256,
      lineCount: item.lineCount,
      bytes: item.bytes,
      anchorCount: item.anchors.length,
      riskTags: item.riskTags,
      fallbackReadPolicy: item.fallbackReadPolicy,
    })),
    readFallbackDecisions: {
      fullReadDecision,
      unlocatedRangeDecision,
      boundedRangeDecision,
      overBudgetDecision,
    },
    promptPrefix: {
      firstOk: firstPrefix.ok,
      secondOk: secondPrefix.ok,
      stablePrefixHashUnchanged: firstPrefix.stablePrefixHash === secondPrefix.stablePrefixHash,
      dynamicTailHashChanged: firstPrefix.dynamicTailHash !== secondPrefix.dynamicTailHash,
      stablePrefixApproxTokens: firstPrefix.stablePrefixApproxTokens,
      dynamicTailApproxTokens: firstPrefix.dynamicTailApproxTokens,
      cacheMissBudgetTokens: firstPrefix.cacheMissBudgetTokens,
      volatileFindingCount: firstPrefix.volatileFindings.length + secondPrefix.volatileFindings.length,
    },
    impactRadar: {
      status: impactRadar.status,
      changedFiles: impactRadar.changedFiles,
      directDependents: impactRadar.directDependents,
      transitiveDependents: impactRadar.transitiveDependents,
      affectedTests: impactRadar.affectedTests,
      totalAffected: impactRadar.totalAffected,
      riskLevel: impactRadar.riskLevel,
      recommendedVerification: impactRadar.recommendedVerification,
      evidence: impactRadar.evidence,
    },
    evidenceDrivenReview: {
      status: evidenceDrivenReview.status,
      findingCount: evidenceDrivenReview.findings.length,
      releaseClaimAllowed: evidenceDrivenReview.releaseClaimAllowed,
      sourceTruthCapsuleIds: evidenceDrivenReview.sourceTruthCapsuleIds,
      verificationCommand: evidenceDrivenReview.verificationCommand,
      evidence: evidenceDrivenReview.evidence,
    },
    releaseClaimBoundary: {
      codeModeSourceCapsuleClaimAllowed: pass,
      deepseekCacheHitClaimAllowed: false,
      note: 'This proves DSXU-owned source/cache mechanics and bounded Read fallback, not a live provider cache-hit percentage.',
    },
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(OUT_JSON, JSON.stringify(report, null, 2), 'utf8')

  const csvRows = [
    ['case', 'status', 'allowed', 'path', 'requestedOffset', 'requestedLimit', 'recommendedOffset', 'recommendedLimit', 'estimatedApproxTokens', 'reason'],
    decisionRow('full-read', fullReadDecision),
    decisionRow('unlocated-range', unlocatedRangeDecision),
    decisionRow('bounded-range', boundedRangeDecision),
    decisionRow('over-budget', overBudgetDecision),
  ]
  await writeFile(OUT_CSV, csvRows.map(row => row.map(csvEscape).join(',')).join('\n'), 'utf8')

  const md = [
    `# DSXU Source Cache Acceptance - ${DATE}`,
    '',
    `Status: ${report.status}`,
    '',
    '## Result',
    '',
    `- capsules: ${report.contextPack.capsuleCount}`,
    `- rawChars: ${report.contextPack.rawChars}`,
    `- packedChars: ${report.contextPack.packedChars}`,
    `- toolResultCharsAvoided: ${report.contextPack.toolResultCharsAvoided}`,
    `- compressionRatio: ${report.contextPack.compressionRatio}`,
    `- noReadDefault: ${report.contextPack.noReadDefault}`,
    `- stablePrefixHashUnchanged: ${report.promptPrefix.stablePrefixHashUnchanged}`,
    `- dynamicTailHashChanged: ${report.promptPrefix.dynamicTailHashChanged}`,
    `- impactRadarStatus: ${report.impactRadar.status}`,
    `- affectedTests: ${report.impactRadar.affectedTests.join(', ')}`,
    `- evidenceReviewStatus: ${report.evidenceDrivenReview.status}`,
    `- evidenceReviewFindings: ${report.evidenceDrivenReview.findingCount}`,
    '',
    '## Read Fallback Decisions',
    '',
    '| case | status | allowed | requested | recommended | tokens |',
    '| --- | --- | --- | --- | --- | --- |',
    ...csvRows.slice(1).map(row => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[4] || '-'}:${row[5] || '-'} | ${row[6] || '-'}:${row[7] || '-'} | ${row[8]} |`),
    '',
    '## Boundary',
    '',
    '- This is DSXU code-mode source/cache mechanics evidence.',
    '- It does not claim a live DeepSeek cache-hit percentage.',
    '- Large-file Read remains fallback-only and must be locator/range bounded.',
    '- Impact Radar and Evidence-Driven Review are schema evidence over the same code-mode owner, not a second reviewer runtime.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  if (!pass) {
    console.error(report.status)
    process.exit(1)
  }
  console.log(report.status)
  console.log(`capsules=${report.contextPack.capsuleCount}`)
  console.log(`toolResultCharsAvoided=${report.contextPack.toolResultCharsAvoided}`)
  console.log(`stablePrefixHashUnchanged=${report.promptPrefix.stablePrefixHashUnchanged}`)
}

await main()
