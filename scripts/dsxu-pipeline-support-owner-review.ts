#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const DATE = '20260517'
const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')
const DOCS = join(ROOT, 'docs')
const OUT_JSON = join(GENERATED, `DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_${DATE}.json`)
const OUT_MD = join(DOCS, `DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_${DATE}.md`)

type RefKind = 'runtime' | 'test' | 'script' | 'doc' | 'generated-evidence' | 'package'

type Ref = {
  path: string
  line: number
  kind: RefKind
  excerpt: string
}

type SupportItem = {
  id: string
  owner: string
  artifacts: string[]
  patterns: string[]
  expectedRuntime: 'required' | 'allowed' | 'not-required'
  decision: string
  boundary: string
}

const supportItems: SupportItem[] = [
  {
    id: 'evidence-dashboard',
    owner: 'Evidence / Release Claim Binder',
    artifacts: ['scripts/dsxu-evidence-dashboard.ts'],
    patterns: ['dsxu-evidence-dashboard', 'aggregateEvidence', 'DSXU_EVIDENCE_DASHBOARD_'],
    expectedRuntime: 'allowed',
    decision: 'KEEP_AS_RELEASE_CLAIM_BINDER_INPUT',
    boundary:
      'Aggregates explicit evidence only; it must not derive scoreFloor from pass rate or promote internal smoke results to public claims.',
  },
  {
    id: 'cache-warm-planning',
    owner: 'DeepSeek route/cost/cache',
    artifacts: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
    patterns: ['cache-warmer', 'CacheWarmer', 'defaultCacheWarmPrefixes', 'dsxu-cache-warm'],
    expectedRuntime: 'not-required',
    decision: 'KEEP_AS_DEEPSEEK_CACHE_PLANNING_SUPPORT',
    boundary:
      'Default mode is planning/dry-run; no cache-hit improvement or cost-saving claim is allowed without real before/after trajectory evidence.',
  },
  {
    id: 'runtime-health',
    owner: 'Release / Tool Gate health evidence',
    artifacts: ['src/services/health', 'scripts/dsxu-runtime-health.ts'],
    patterns: ['src/services/health', 'runHealthChecks', 'createDefaultHealthChecks', 'dsxu-runtime-health'],
    expectedRuntime: 'not-required',
    decision: 'KEEP_AS_FOCUSED_OWNER_REVIEW_HEALTH_HELPER',
    boundary:
      'Focused helper for owner review and preflight. The public release health entry remains audit:dsxu:health, not a second runtime entry.',
  },
  {
    id: 'static-analysis-tool-gate',
    owner: 'Tool Gate / VerificationKernel',
    artifacts: ['src/services/static-analysis/tool-gate.ts', 'src/services/static-analysis/bridge.ts'],
    patterns: ['invokeStaticAnalysisToolGate', 'createStaticAnalysisBridge', 'static-analysis/tool-gate'],
    expectedRuntime: 'required',
    decision: 'KEEP_AS_FILE_WRITE_EDIT_TOOL_GATE_SUPPORT',
    boundary:
      'Static analysis is invoked only through FileWrite/FileEdit Tool Gate evidence and tests; it is not a standalone permission or verification runtime.',
  },
  {
    id: 'tdd-post-mutation-gate',
    owner: 'Tool Gate / VerificationKernel',
    artifacts: ['src/coordinator/tdd-gate/post-write-hook.ts', 'src/coordinator/tdd-gate/index.ts'],
    patterns: ['invokePostWriteTddGate', 'TddGate', 'coordinator/tdd-gate/post-write-hook'],
    expectedRuntime: 'required',
    decision: 'KEEP_AS_POST_MUTATION_VERIFICATION_SUPPORT',
    boundary:
      'Default semantics are post-mutation verification. Full red/green TDD requires an explicit pre-edit test contract and cannot be claimed from write-after hooks.',
  },
  {
    id: 'post-mutation-envelope',
    owner: 'Tool Gate / VerificationKernel visible evidence',
    artifacts: ['src/dsxu/engine/post-mutation-verification-envelope.ts'],
    patterns: ['buildPostMutationVerificationEnvelope', 'dsxu.post-mutation-verification.v1'],
    expectedRuntime: 'required',
    decision: 'KEEP_AS_VISIBLE_TOOL_GATE_EVIDENCE_ENVELOPE',
    boundary:
      'Formats static-analysis and post-mutation outcomes into one evidence envelope; it must remain a projection of Tool Gate state, not a new gate stack.',
  },
]

const blockedPackageScripts = [
  'benchmark:swe-bench',
  'evidence:dashboard',
  'health:runtime',
  'cache:warm',
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

function classify(path: string): RefKind {
  if (path === 'package.json') return 'package'
  if (path.startsWith('docs/generated/')) return 'generated-evidence'
  if (path.startsWith('docs/')) return 'doc'
  if (path.includes('__tests__') || /\.test\.[tj]sx?$/.test(path)) return 'test'
  if (path.startsWith('scripts/')) return 'script'
  return 'runtime'
}

function findRefs(files: string[], item: SupportItem): Ref[] {
  const refs: Ref[] = []
  for (const path of files) {
    const full = join(ROOT, path)
    if (!existsSync(full)) continue
    const lines = readFileSync(full, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!item.patterns.some(pattern => line.includes(pattern))) return
      refs.push({
        path,
        line: index + 1,
        kind: classify(path),
        excerpt: line.trim().slice(0, 220),
      })
    })
  }
  return refs
}

function countByKind(refs: Ref[]): Record<RefKind, number> {
  return {
    runtime: refs.filter(ref => ref.kind === 'runtime').length,
    test: refs.filter(ref => ref.kind === 'test').length,
    script: refs.filter(ref => ref.kind === 'script').length,
    doc: refs.filter(ref => ref.kind === 'doc').length,
    'generated-evidence': refs.filter(ref => ref.kind === 'generated-evidence').length,
    package: refs.filter(ref => ref.kind === 'package').length,
  }
}

function isOwnArtifact(path: string, item: SupportItem): boolean {
  return item.artifacts.some(artifact => path === artifact || path.startsWith(`${artifact}/`))
}

function statusFor(item: SupportItem, refs: Ref[]): 'PASS' | 'WARN' | 'FAIL' {
  const runtimeRefs = refs.filter(ref => ref.kind === 'runtime' && !isOwnArtifact(ref.path, item))
  if (item.expectedRuntime === 'required') return runtimeRefs.length > 0 ? 'PASS' : 'FAIL'
  if (item.expectedRuntime === 'not-required') return runtimeRefs.length === 0 ? 'PASS' : 'WARN'
  return 'PASS'
}

function readPackageScripts(): Record<string, string> {
  const raw = readFileSync(join(ROOT, 'package.json'), 'utf8')
  const parsed = JSON.parse(raw) as { scripts?: Record<string, string> }
  return parsed.scripts ?? {}
}

function renderRefs(refs: Ref[]): string {
  if (refs.length === 0) return '- None'
  return refs
    .slice(0, 40)
    .map(ref => `- ${ref.kind}: \`${ref.path}:${ref.line}\` - ${ref.excerpt.replace(/\|/g, '\\|')}`)
    .join('\n')
}

mkdirSync(GENERATED, { recursive: true })
mkdirSync(DOCS, { recursive: true })

const files = [
  ...listFiles(join(ROOT, 'src')),
  ...listFiles(join(ROOT, 'scripts')),
  ...listFiles(join(ROOT, 'docs')),
  'package.json',
]

const scripts = readPackageScripts()
const blockedPackageExposure = blockedPackageScripts
  .filter(name => Object.prototype.hasOwnProperty.call(scripts, name))
  .map(name => ({ name, command: scripts[name] }))

const itemReports = supportItems.map(item => {
  const refs = findRefs(files, item)
  const ownRefs = refs.filter(ref => isOwnArtifact(ref.path, item))
  const externalRefs = refs.filter(ref => !isOwnArtifact(ref.path, item))
  const status = statusFor(item, refs)
  return {
    ...item,
    status,
    refCounts: countByKind(refs),
    externalRefCounts: countByKind(externalRefs),
    ownReferenceCount: ownRefs.length,
    externalReferences: externalRefs,
  }
})

const failedItems = itemReports.filter(item => item.status === 'FAIL')
const warnItems = itemReports.filter(item => item.status === 'WARN')
const overall = blockedPackageExposure.length > 0 || failedItems.length > 0
  ? 'FAIL'
  : warnItems.length > 0
    ? 'WARN'
    : 'PASS'

const payload = {
  schemaVersion: 'dsxu.pipeline-support-owner-review.v1',
  generatedAt: new Date().toISOString(),
  overall,
  rule:
    'Pipeline support modules must fold into DSXU owners: Tool Gate / VerificationKernel, Evidence / Release Claim Binder, and DeepSeek route/cost/cache. They must not create package-level product entries, second runtimes, or public claims without raw evidence.',
  blockedPackageScripts,
  blockedPackageExposure,
  itemReports,
  nextAction:
    overall === 'PASS'
      ? 'Proceed to next owner packet or real-window/final test gates; keep deletion or package exposure changes behind explicit owner/Git authorization.'
      : 'Resolve FAIL/WARN rows before public release claim or final clean export.',
}

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')

const md = `# Pipeline support owner review - ${DATE}

## Decision

- Overall: \`${overall}\`
- Blocked package exposures: ${blockedPackageExposure.length}
- Rule: ${payload.rule}

## Package Exposure Check

${blockedPackageExposure.length === 0
  ? '- PASS: no blocked package scripts are exposed.'
  : blockedPackageExposure.map(item => `- FAIL: \`${item.name}\` -> \`${item.command}\``).join('\n')}

## Owner Rows

| id | owner | status | decision | external runtime refs | external script refs | external test refs |
|---|---|---|---|---:|---:|---:|
${itemReports.map(item =>
  `| \`${item.id}\` | ${item.owner} | \`${item.status}\` | \`${item.decision}\` | ${item.externalRefCounts.runtime} | ${item.externalRefCounts.script} | ${item.externalRefCounts.test} |`,
).join('\n')}

## Boundaries

${itemReports.map(item => `- \`${item.id}\`: ${item.boundary}`).join('\n')}

## External References

${itemReports.map(item => `### ${item.id}\n\n${renderRefs(item.externalReferences)}`).join('\n\n')}

## Next Action

${payload.nextAction}
`

writeFileSync(OUT_MD, md, 'utf8')

console.log(JSON.stringify({
  overall,
  failedItems: failedItems.map(item => item.id),
  warnItems: warnItems.map(item => item.id),
  blockedPackageExposure,
  outputJson: normalize(relative(ROOT, OUT_JSON)),
  outputMarkdown: normalize(relative(ROOT, OUT_MD)),
}, null, 2))
