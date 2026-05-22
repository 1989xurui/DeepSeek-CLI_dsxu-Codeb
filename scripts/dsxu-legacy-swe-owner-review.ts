#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  buildDSXUReplaceDeleteOwnerReview,
  type DSXUReplaceDeleteReference,
} from '../src/dsxu/engine/replace-delete-owner-review'

const DATE = '20260517'
const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')
const DOCS = join(ROOT, 'docs')

const LEGACY_OWNER = 'src/services/swe-bench'
const REPLACEMENT_OWNER = 'src/services/eval/swe-bench'
const SCRIPT_PATH = normalizePath(relative(ROOT, new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))
const OUT_JSON = join(GENERATED, `DSXU_LEGACY_SWE_OWNER_REVIEW_${DATE}.json`)
const OUT_MD = join(DOCS, `DSXU_LEGACY_SWE_OWNER_REVIEW_${DATE}.md`)
const OUT_JSON_REL = normalizePath(relative(ROOT, OUT_JSON))
const OUT_MD_REL = normalizePath(relative(ROOT, OUT_MD))

const legacyPatterns = [
  'src/services/swe-bench',
  'src\\services\\swe-bench',
  '../swe-bench',
  'services/swe-bench',
  'SWEBenchRunner',
  'createSWEBenchRunner',
  'runSWEBenchTask',
  'runSWEBenchBatch',
  'generateSWEBenchReport',
]

const candidateFiles = [
  `${LEGACY_OWNER}/index.ts`,
  `${LEGACY_OWNER}/runner.ts`,
  `${LEGACY_OWNER}/types.ts`,
]

const replacementEvidence = [
  `${REPLACEMENT_OWNER}/runner.ts`,
  `${REPLACEMENT_OWNER}/judge.ts`,
  `${REPLACEMENT_OWNER}/bridge.ts`,
  `${REPLACEMENT_OWNER}/contract.ts`,
  `${REPLACEMENT_OWNER}/__tests__/contract.test.ts`,
  `${REPLACEMENT_OWNER}/__tests__/runner.test.ts`,
  `docs/generated/DSXU_SWE_INTERNAL_SMOKE_RESULTS_${DATE}.json`,
  `docs/generated/DSXU_EVIDENCE_DASHBOARD_${DATE}.json`,
]

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const stats = statSync(root)
  if (stats.isFile()) return [normalizePath(relative(ROOT, root))]

  const entries: string[] = []
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === '.git' || name === '.dsxu') continue
    const full = join(root, name)
    const childStats = statSync(full)
    if (childStats.isDirectory()) {
      entries.push(...listFiles(full))
    } else if (/\.(ts|tsx|js|jsx|json|md|csv)$/.test(name)) {
      entries.push(normalizePath(relative(ROOT, full)))
    }
  }
  return entries
}

function shouldSkipEvidenceSelf(path: string): boolean {
  return (
    path === SCRIPT_PATH ||
    path === OUT_JSON_REL ||
    path === OUT_MD_REL ||
    path === 'src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts'
  )
}

function findReferences(paths: string[]): DSXUReplaceDeleteReference[] {
  const references: DSXUReplaceDeleteReference[] = []
  for (const path of paths) {
    if (shouldSkipEvidenceSelf(path)) continue
    if (path.startsWith(`${LEGACY_OWNER}/`)) continue

    const full = join(ROOT, path)
    if (!existsSync(full)) continue
    const lines = readFileSync(full, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!legacyPatterns.some(pattern => line.includes(pattern))) return
      references.push({
        path,
        line: index + 1,
        excerpt: line.trim().slice(0, 220),
        kind: classifyReference(path),
      })
    })
  }
  return references
}

function classifyReference(path: string): DSXUReplaceDeleteReference['kind'] {
  if (path.startsWith('docs/generated/')) return 'generated-evidence'
  if (path.startsWith('docs/')) return 'doc'
  if (path.includes('__tests__') || /\.test\.[tj]sx?$/.test(path)) return 'test'
  return 'runtime'
}

function uniqueReferences(refs: DSXUReplaceDeleteReference[]): DSXUReplaceDeleteReference[] {
  const seen = new Set<string>()
  return refs.filter(ref => {
    const key = `${ref.kind}:${ref.path}:${ref.line}:${ref.excerpt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatRef(ref: DSXUReplaceDeleteReference): string {
  return `- ${ref.kind}: \`${ref.path}:${ref.line ?? 1}\` - ${ref.excerpt.replace(/\|/g, '\\|')}`
}

mkdirSync(GENERATED, { recursive: true })
mkdirSync(DOCS, { recursive: true })

const searchFiles = [
  ...listFiles(join(ROOT, 'src')),
  ...listFiles(join(ROOT, 'scripts')),
  ...listFiles(join(ROOT, 'docs')),
  normalizePath('package.json'),
]

const references = uniqueReferences(findReferences(searchFiles))
const runtimeReferences = references.filter(ref => ref.kind === 'runtime')
const testReferences = references.filter(ref => ref.kind === 'test')
const docReferences = references.filter(ref => ref.kind === 'doc' || ref.kind === 'generated-evidence')

const review = buildDSXUReplaceDeleteOwnerReview({
  packetId: 'V26-RD-legacy-swe-owner-review',
  title: 'Legacy src/services/swe-bench owner/Git replace-delete review',
  targetOwner: LEGACY_OWNER,
  replacementOwner: REPLACEMENT_OWNER,
  rule:
    'Review only. Equivalent duplicate behavior must be merged into the replacement owner or left as replace/delete candidate; do not stage, commit, delete, or clean files without explicit owner/Git mutation authorization.',
  candidates: [
    {
      path: `${LEGACY_OWNER}/*`,
      currentOwner: 'Legacy internal SWE-shaped task runner',
      proposedOwner: 'Evidence / benchmark / public challenge owner',
      reason:
        'The legacy owner now has test/doc-only references while the executable benchmark-shaped evidence path lives under src/services/eval/swe-bench with internal-only public claim boundaries.',
      runtimeReferences,
      testReferences,
      docReferences,
      replacementEvidence,
      publicClaimAllowed: false,
    },
  ],
})

const payload = {
  generatedAt: new Date().toISOString(),
  candidateFiles,
  replacementEvidence,
  ownerGitMutationPlan: {
    authorizationRequired: true,
    mutationType: 'delete-legacy-owner',
    deleteCandidates: candidateFiles,
    preserveOwner: REPLACEMENT_OWNER,
    doNotRunAutomatically: true,
    preMutationVerification: [
      'bun run scripts/dsxu-legacy-swe-owner-review.ts',
      'bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts',
      'bun run scripts/dsxu-runtime-health.ts',
    ],
    postMutationVerification: [
      'rg "../swe-bench|src/services/swe-bench|SWEBenchRunner|createSWEBenchRunner|runSWEBenchTask|runSWEBenchBatch|generateSWEBenchReport" src scripts package.json --glob "!scripts/dsxu-legacy-swe-owner-review.ts"',
      'bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts',
      'bun run scripts/dsxu-runtime-health.ts',
    ],
    expectedPostMutationRefs:
      'Only docs and generated historical owner-review evidence may mention the legacy owner.',
  },
  review,
  decisionNotes: [
    'No product/runtime reference is allowed to remain before deletion can be approved.',
    'Legacy tests may be kept temporarily as compatibility evidence or migrated to replacement owner tests.',
    'This packet is not a mutation. It does not stage, delete, commit, clean, or export files.',
  ],
}

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')

const md = `# Legacy SWE owner/Git replace-delete review - ${DATE}

## Decision

- Packet: \`${review.packetId}\`
- Status: \`${review.status}\`
- Target owner: \`${review.targetOwner}\`
- Replacement owner: \`${review.replacementOwner}\`
- Candidate files: ${candidateFiles.map(path => `\`${path}\``).join(', ')}
- Runtime references: ${review.runtimeReferenceCount}
- Test references: ${review.testReferenceCount}
- Doc/generated references: ${review.docReferenceCount}
- Replacement evidence count: ${review.replacementEvidenceCount}

## Owner Rule

${review.rule}

## Runtime References

${runtimeReferences.length === 0 ? '- None found outside the legacy owner.' : runtimeReferences.map(formatRef).join('\n')}

## Test References

${testReferences.length === 0 ? '- None.' : testReferences.map(formatRef).join('\n')}

## Doc / Generated References

${docReferences.length === 0 ? '- None.' : docReferences.map(formatRef).join('\n')}

## Replacement Evidence

${replacementEvidence.map(path => `- \`${path}\``).join('\n')}

## Owner/Git Mutation Plan

- Authorization required: yes
- Mutation type: delete legacy owner
- Delete candidates:
${candidateFiles.map(path => `  - \`${path}\``).join('\n')}
- Preserve owner: \`${REPLACEMENT_OWNER}\`
- Do not run automatically: true

Pre-mutation verification:
${payload.ownerGitMutationPlan.preMutationVerification.map(command => `- \`${command}\``).join('\n')}

Post-mutation verification:
${payload.ownerGitMutationPlan.postMutationVerification.map(command => `- \`${command}\``).join('\n')}

## Next Action

${review.nextAction}
`

writeFileSync(OUT_MD, md, 'utf8')

console.log(JSON.stringify({
  status: review.status,
  runtimeReferenceCount: review.runtimeReferenceCount,
  testReferenceCount: review.testReferenceCount,
  docReferenceCount: review.docReferenceCount,
  outputJson: OUT_JSON_REL,
  outputMarkdown: OUT_MD_REL,
}, null, 2))
