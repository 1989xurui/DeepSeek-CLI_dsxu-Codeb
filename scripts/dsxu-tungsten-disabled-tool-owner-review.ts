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
const OWNER = 'src/tools/TungstenTool'
const OUT_JSON = join(GENERATED, `DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_${DATE}.json`)
const OUT_MD = join(DOCS, `DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_${DATE}.md`)
const SCRIPT_PATH = normalize(relative(ROOT, fileURLToPath(import.meta.url)))
const OUT_JSON_REL = normalize(relative(ROOT, OUT_JSON))
const OUT_MD_REL = normalize(relative(ROOT, OUT_MD))

const patterns = [
  'TungstenTool',
  'TungstenLiveMonitor',
  'tungsten',
  'tmux panel',
]

const replacementEvidence = [
  'src/tools.ts',
  'src/constants/tools.ts',
  'src/dsxu/engine/__tests__/tool-definition-owner.test.ts',
  'src/tools/__tests__/tool-registry-simple-mode.test.ts',
  'src/tools/__tests__/tool-permission-owner-gate.test.ts',
]

const candidateFiles = [
  'src/tools/TungstenTool/TungstenTool.ts',
  'src/tools/TungstenTool/TungstenLiveMonitor.tsx',
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
  return path.startsWith(`${OWNER}/`) ||
    path === SCRIPT_PATH ||
    path === OUT_JSON_REL ||
    path === OUT_MD_REL
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
  packetId: 'V26-RD-tungsten-disabled-tool-owner-review',
  title: 'Disabled Tungsten tool owner/Git review',
  targetOwner: OWNER,
  replacementOwner: 'DSXU Tool Gate / terminal visible-state owners',
  rule:
    'Review only. Disabled Tungsten must not be registered as a product tool. Runtime/test references must stay at zero before owner/Git replacement deletion.',
  candidates: [
    {
      path: `${OWNER}/*`,
      currentOwner: 'Disabled terminal recovery stub',
      proposedOwner: 'DSXU Tool Gate / terminal visible-state owners',
      reason:
        'The product tool registry no longer imports or registers TungstenTool, and UI/state/tmux runtime references have been remapped to DSXU terminal visible-state owners. Remaining references are the candidate files themselves plus historical docs/generated evidence, so this packet is ready for explicit owner/Git replace/delete review.',
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
    mutationType: 'ready-delete-disabled-tungsten-tool-after-owner-git-signoff',
    deleteCandidates: candidateFiles,
    doNotRunAutomatically: true,
    preMutationVerification: [
      'bun run scripts/dsxu-tungsten-disabled-tool-owner-review.ts',
      'bun test src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts src/tools/__tests__/tool-permission-owner-gate.test.ts',
    ],
    postMutationVerification: [
      'rg "TungstenTool|TungstenLiveMonitor|tungsten|tmux panel" src scripts package.json --glob "!scripts/dsxu-tungsten-disabled-tool-owner-review.ts"',
      'bun test src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts src/tools/__tests__/tool-permission-owner-gate.test.ts',
    ],
  },
  review,
  decisionNotes: [
    'Product tool registry exposure is closed.',
    'UI/state/tmux runtime references are closed; only historical docs/generated evidence remains outside the candidate owner.',
    'This packet does not delete, stage, commit, clean, or export files.',
  ],
}

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')

const md = `# Disabled Tungsten tool owner/Git review - ${DATE}

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
