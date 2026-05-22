#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDSXUReplaceDeleteOwnerReview,
  type DSXUReplaceDeleteReference,
} from '../src/dsxu/engine/replace-delete-owner-review'

const DATE = '20260517'
const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')
const DOCS = join(ROOT, 'docs')
const TARGET = 'src/tdd.ts'
const OUT_JSON = join(GENERATED, `DSXU_ROOT_TDD_OWNER_REVIEW_${DATE}.json`)
const OUT_MD = join(DOCS, `DSXU_ROOT_TDD_OWNER_REVIEW_${DATE}.md`)
const SCRIPT_PATH = normalize(relative(ROOT, fileURLToPath(import.meta.url)))
const OUT_JSON_REL = normalize(relative(ROOT, OUT_JSON))
const OUT_MD_REL = normalize(relative(ROOT, OUT_MD))

const patterns = [
  'src/tdd.ts',
  '../tdd',
  './tdd',
  'TDD门功能',
  'TDD闂',
  'handleEdgeCases',
  'getCorrectResult',
]

const replacementEvidence = [
  'src/coordinator/tdd-gate/post-write-hook.ts',
  'src/coordinator/tdd-gate/gate.ts',
  'src/coordinator/tdd-gate/__tests__/gate.test.ts',
  'src/dsxu/engine/post-mutation-verification-envelope.ts',
  'src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts',
  'src/tools/FileWriteTool/FileWriteTool.ts',
  'src/tools/FileEditTool/FileEditTool.ts',
]

function normalize(path: string): string {
  return path.replace(/\\/g, '/')
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const stats = statSync(root)
  if (stats.isFile()) return [normalize(relative(ROOT, root))]

  const files: string[] = []
  for (const name of readdirSync(root)) {
    if (name === '.git' || name === '.dsxu' || name === 'node_modules' || name === 'dist') continue
    const full = join(root, name)
    const childStats = statSync(full)
    if (childStats.isDirectory()) {
      files.push(...listFiles(full))
    } else if (/\.(ts|tsx|js|jsx|json|md|csv)$/.test(name)) {
      files.push(normalize(relative(ROOT, full)))
    }
  }
  return files
}

function classify(path: string): DSXUReplaceDeleteReference['kind'] {
  if (path.startsWith('docs/generated/')) return 'generated-evidence'
  if (path.startsWith('docs/')) return 'doc'
  if (path.includes('__tests__') || /\.test\.[tj]sx?$/.test(path)) return 'test'
  return 'runtime'
}

function shouldSkip(path: string): boolean {
  return path === TARGET || path === SCRIPT_PATH || path === OUT_JSON_REL || path === OUT_MD_REL
}

function findReferences(paths: string[]): DSXUReplaceDeleteReference[] {
  const refs: DSXUReplaceDeleteReference[] = []
  for (const path of paths) {
    if (shouldSkip(path)) continue
    const full = join(ROOT, path)
    if (!existsSync(full)) continue
    const lines = readFileSync(full, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!patterns.some(pattern => line.includes(pattern))) return
      refs.push({
        path,
        line: index + 1,
        excerpt: line.trim().slice(0, 220),
        kind: classify(path),
      })
    })
  }
  return refs
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
  'package.json',
]

const references = findReferences(searchFiles)
const runtimeReferences = references.filter(ref => ref.kind === 'runtime')
const testReferences = references.filter(ref => ref.kind === 'test')
const docReferences = references.filter(ref => ref.kind === 'doc' || ref.kind === 'generated-evidence')

const review = buildDSXUReplaceDeleteOwnerReview({
  packetId: 'V26-RD-root-tdd-owner-review',
  title: 'Root src/tdd.ts owner/Git replace-delete review',
  targetOwner: TARGET,
  replacementOwner: 'Tool Gate / TDD post-mutation verification owner',
  rule:
    'Review only. Root src/tdd.ts is a toy/demo helper and must not be treated as a DSXU TDD product entry. TDD behavior belongs to coordinator/tdd-gate and Tool Gate post-mutation evidence.',
  candidates: [
    {
      path: TARGET,
      currentOwner: 'Historical toy TDD helper',
      proposedOwner: 'Tool Gate / TDD post-mutation verification owner',
      reason:
        'No import/use references point to src/tdd.ts. Real TDD/post-mutation behavior is covered by coordinator/tdd-gate and FileWrite/FileEdit Tool Gate evidence.',
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
  candidateFiles: [TARGET],
  replacementEvidence,
  ownerGitMutationPlan: {
    authorizationRequired: true,
    mutationType: 'delete-root-toy-tdd-helper-or-retain-as-historical-source-only',
    deleteCandidates: [TARGET],
    preserveOwner: 'src/coordinator/tdd-gate + src/dsxu/engine/post-mutation-verification-envelope.ts',
    doNotRunAutomatically: true,
    preMutationVerification: [
      'bun run scripts/dsxu-root-tdd-owner-review.ts',
      'bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts',
    ],
    postMutationVerification: [
      'rg "src/tdd.ts|handleEdgeCases|getCorrectResult|TDD门功能|TDD闂" src scripts package.json --glob "!scripts/dsxu-root-tdd-owner-review.ts"',
      'bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts',
    ],
  },
  review,
  decisionNotes: [
    'This packet does not delete, stage, commit, clean, or export files.',
    'Root src/tdd.ts must not be shown as an active DSXU TDD feature.',
    'The replacement owner is already imported by FileWriteTool/FileEditTool and validated by focused tests.',
  ],
}

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')

const md = `# Root TDD owner/Git replace-delete review - ${DATE}

## Decision

- Packet: \`${review.packetId}\`
- Status: \`${review.status}\`
- Target owner: \`${review.targetOwner}\`
- Replacement owner: \`${review.replacementOwner}\`
- Runtime references: ${review.runtimeReferenceCount}
- Test references: ${review.testReferenceCount}
- Doc/generated references: ${review.docReferenceCount}
- Replacement evidence count: ${review.replacementEvidenceCount}

## Rule

${review.rule}

## Runtime References

${runtimeReferences.length === 0 ? '- None found.' : runtimeReferences.map(formatRef).join('\n')}

## Test References

${testReferences.length === 0 ? '- None found.' : testReferences.map(formatRef).join('\n')}

## Doc / Generated References

${docReferences.length === 0 ? '- None found.' : docReferences.map(formatRef).join('\n')}

## Replacement Evidence

${replacementEvidence.map(path => `- \`${path}\``).join('\n')}

## Owner/Git Mutation Plan

- Authorization required: yes
- Mutation type: delete root toy TDD helper or retain as historical source only
- Delete candidates:
  - \`${TARGET}\`
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
  outputJson: normalize(relative(ROOT, OUT_JSON)),
  outputMarkdown: normalize(relative(ROOT, OUT_MD)),
}, null, 2))
