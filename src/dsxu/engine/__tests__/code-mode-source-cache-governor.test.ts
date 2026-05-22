import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  buildDSXUCodeContextPack,
  buildDSXUCodeImpactRadar,
  buildDSXUCodeSourceTruthCapsules,
  buildDSXUEvidenceDrivenReview,
  decideDSXUReadFallback,
} from '../code-mode-surgical-loop'
import { buildDSXUPromptPrefixCachePlan } from '../prompt-prefix-cache-builder'
import { DSXU_FILE_READ_DISCIPLINE } from '../../../tools/FileReadTool/prompt'

function writeFixture(root: string, file: string, content: string): string {
  const full = join(root, file)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf8')
  return full
}

function largeSource(): string {
  const lines = [
    'export function calculateInvoiceTotal(items) {',
    '  return items.reduce((sum, item) => sum + item.price, 0)',
    '}',
    '',
  ]
  for (let i = 0; i < 420; i += 1) {
    lines.push(`export const filler${i} = ${i}`)
  }
  lines.push('export function applyDiscount(total, discount) {')
  lines.push('  return total - discount')
  lines.push('}')
  return `${lines.join('\n')}\n`
}

describe('code-mode source capsule and Read fallback governor', () => {
  test('builds source-truth capsules instead of injecting whole large files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-source-cache-'))
    writeFixture(root, 'src/invoice.ts', largeSource())

    const pack = await buildDSXUCodeContextPack({
      root,
      files: ['src/invoice.ts'],
      query: 'fix invoice discount calculation',
      maxCharsPerFile: 700,
    })

    expect(pack.sourceTruthCapsules).toHaveLength(1)
    expect(pack.sourceTruthCapsules[0]!.capsuleId).toMatch(/^source:/)
    expect(pack.sourceTruthCapsules[0]!.sha256).toHaveLength(64)
    expect(pack.sourceTruthCapsules[0]!.anchors.length).toBeGreaterThan(0)
    expect(pack.sourceTruthCapsules[0]!.riskTags).toContain('large-file')
    expect(pack.sourceTruthCapsules[0]!.fallbackReadPolicy.mode).toBe('source-capsule-first')
    expect(pack.files[0]!.snippet).toContain('capsuleId=')
    expect(pack.files[0]!.snippet).toContain('fallback=source-capsule-first')
    expect(pack.rawChars).toBeGreaterThan(pack.packedChars)
    expect(pack.cacheHygiene.noReadDefault).toBe(true)
    expect(pack.cacheHygiene.toolResultCharsAvoided).toBeGreaterThan(0)
  })

  test('blocks unbounded large-file Read and allows locator-bounded fallback', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-read-governor-'))
    writeFixture(root, 'src/invoice.ts', largeSource())
    const capsules = await buildDSXUCodeSourceTruthCapsules({
      root,
      files: ['src/invoice.ts'],
      query: 'applyDiscount',
    })

    const fullRead = decideDSXUReadFallback({
      path: 'src/invoice.ts',
      capsules,
    })
    expect(fullRead.allowed).toBe(false)
    expect(fullRead.status).toBe('BLOCK_FULL_FILE_READ')
    expect(fullRead.reason).toContain('anchor-bounded')
    expect(fullRead.recommendedLimit).toBeLessThanOrEqual(160)

    const unlocated = decideDSXUReadFallback({
      path: 'src/invoice.ts',
      capsules,
      offset: fullRead.recommendedOffset,
      limit: fullRead.recommendedLimit,
    })
    expect(unlocated.allowed).toBe(false)
    expect(unlocated.status).toBe('BLOCK_UNLOCATED_LARGE_READ')

    const bounded = decideDSXUReadFallback({
      path: 'src/invoice.ts',
      capsules,
      offset: fullRead.recommendedOffset,
      limit: fullRead.recommendedLimit,
      locatorEvidence: true,
    })
    expect(bounded.allowed).toBe(true)
    expect(bounded.status).toBe('ALLOW_BOUNDED_READ')
    expect(bounded.estimatedApproxTokens).toBeLessThanOrEqual(8_000)
    expect(bounded.evidence.join('\n')).toContain(capsules[0]!.capsuleId)
  })

  test('keeps source capsule stable prefix reusable while dynamic task state changes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-source-prefix-'))
    writeFixture(root, 'src/invoice.ts', largeSource())
    const pack = await buildDSXUCodeContextPack({
      root,
      files: ['src/invoice.ts'],
      query: 'invoice repair',
      maxCharsPerFile: 700,
    })
    const sourceCapsuleSection = {
      id: 'source_truth_capsule',
      content: JSON.stringify(pack.sourceTruthCapsules.map(capsule => ({
        capsuleId: capsule.capsuleId,
        path: capsule.path,
        sha256: capsule.sha256,
        anchors: capsule.anchors.map(anchor => ({ id: anchor.id, line: anchor.line })),
      }))),
    }
    const first = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      stableSections: [
        { id: 'system_rules', content: 'DSXU code mode uses source capsules before fallback Read.' },
        sourceCapsuleSection,
      ],
      dynamicSections: [{ id: 'current_task', content: 'fix invoice bug' }],
    })
    const second = buildDSXUPromptPrefixCachePlan({
      workflowKind: 'coding',
      stableSections: [sourceCapsuleSection, { id: 'system_rules', content: 'DSXU code mode uses source capsules before fallback Read.' }],
      dynamicSections: [{ id: 'current_task', content: 'review invoice regression' }],
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.stablePrefixHash).toBe(first.stablePrefixHash)
    expect(second.dynamicTailHash).not.toBe(first.dynamicTailHash)
  })

  test('exposes source-capsule Read discipline through the existing Read tool prompt owner', () => {
    expect(DSXU_FILE_READ_DISCIPLINE).toContain('source-truth capsule')
    expect(DSXU_FILE_READ_DISCIPLINE).toContain('bounded offset/limit range')
  })

  test('binds impact radar and evidence-driven review to source capsules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-impact-review-'))
    writeFixture(root, 'src/math.ts', 'export function add(a: number, b: number) {\n  return a + b\n}\n')
    writeFixture(root, 'src/app.ts', "import { add } from './math'\nexport const total = add(1, 2)\n")
    writeFixture(root, 'src/math.test.ts', "import { add } from './math'\ntest('add', () => expect(add(1, 2)).toBe(3))\n")

    const pack = await buildDSXUCodeContextPack({
      root,
      files: ['src/math.ts', 'src/math.test.ts'],
      query: 'review add behavior',
    })
    const impact = buildDSXUCodeImpactRadar({
      root,
      changedFiles: ['src/math.ts'],
    })
    const review = buildDSXUEvidenceDrivenReview({
      goal: 'review add behavior',
      sourceTruthCapsules: pack.sourceTruthCapsules,
      impactRadar: impact,
      verification: {
        command: ['bun', 'test', 'src/math.test.ts'],
        exitCode: 0,
        stdout: '1 pass 0 fail',
        stderr: '',
        passed: true,
        failureType: 'UNKNOWN',
      },
    })

    expect(impact.affectedTests).toContain('src/math.test.ts')
    expect(impact.recommendedVerification).toEqual(['bun', 'test', 'src/math.test.ts'])
    expect(review.status).toBe('EVIDENCE_REVIEW_READY')
    expect(review.releaseClaimAllowed).toBe(true)
    expect(review.findings.some(finding => finding.evidence.some(item => item.startsWith('capsule:')))).toBe(true)

    const blocked = buildDSXUEvidenceDrivenReview({
      goal: 'review add behavior',
      sourceTruthCapsules: pack.sourceTruthCapsules,
      impactRadar: impact,
      verification: {
        command: ['bun', 'test', 'src/math.test.ts'],
        exitCode: 1,
        stdout: '',
        stderr: '1 fail',
        passed: false,
        failureType: 'TEST',
      },
    })
    expect(blocked.status).toBe('EVIDENCE_REVIEW_BLOCKED')
    expect(blocked.releaseClaimAllowed).toBe(false)
    expect(blocked.findings.map(finding => finding.title)).toContain('Verification has not passed')
  })
})
