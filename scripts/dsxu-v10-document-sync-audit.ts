import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type DocCheck = {
  doc: string
  path: string
  exists: boolean
  checks: Array<{ id: string; pass: boolean; needle: string }>
}

const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')

const DOCS = [
  {
    doc: 'mergedReleasePlan',
    path: join(ROOT, 'docs', 'DSXU_V10_FINAL_REALITY_MERGED_RELEASE_PLAN_20260520_CN.md'),
  },
  {
    doc: 'finalRealityRunPlan',
    path: join(ROOT, 'docs', 'DSXU_FINAL_REALITY_RUN_PLAN_20260520_CN.md'),
  },
  {
    doc: 'composerClaudeSignalPlan',
    path: join(ROOT, 'docs', 'DSXU_V10_COMPOSER_CLAUDE_SIGNAL_ABSORPTION_PLAN_20260520_CN.md'),
  },
] as const

const COMMON_CHECKS = [
  { id: 'core-discipline', needle: 'V10 三文档同步核心纪律' },
  { id: 'point-to-plane', needle: '以点带面' },
  { id: 'no-fake-completion', needle: '不能伪造 PASS' },
  { id: 'paired-raw-boundary', needle: 'paired raw DSXU + target' },
  { id: 'evidence-level-boundary', needle: 'internal replay 不等于公开 benchmark' },
]

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function checkDoc(doc: typeof DOCS[number]): DocCheck {
  const exists = existsSync(doc.path)
  const text = exists ? readFileSync(doc.path, 'utf8') : ''
  const checks = COMMON_CHECKS.map(check => ({
    ...check,
    pass: text.includes(check.needle),
  }))
  if (doc.doc === 'mergedReleasePlan') {
    checks.push(
      {
        id: 'references-final-reality-subdoc',
        needle: 'DSXU_FINAL_REALITY_RUN_PLAN_20260520_CN.md',
        pass: text.includes('DSXU_FINAL_REALITY_RUN_PLAN_20260520_CN.md'),
      },
      {
        id: 'references-signal-subdoc',
        needle: 'DSXU_V10_COMPOSER_CLAUDE_SIGNAL_ABSORPTION_PLAN_20260520_CN.md',
        pass: text.includes('DSXU_V10_COMPOSER_CLAUDE_SIGNAL_ABSORPTION_PLAN_20260520_CN.md'),
      },
    )
  } else {
    checks.push({
      id: 'references-merged-total-doc',
      needle: 'DSXU_V10_FINAL_REALITY_MERGED_RELEASE_PLAN_20260520_CN.md',
      pass: text.includes('DSXU_V10_FINAL_REALITY_MERGED_RELEASE_PLAN_20260520_CN.md'),
    })
  }
  return { ...doc, exists, checks }
}

function main(): void {
  const docs = DOCS.map(checkDoc)
  const missing = docs.flatMap(doc =>
    doc.checks
      .filter(check => !check.pass)
      .map(check => `${doc.doc}:${check.id}`),
  )
  const status = missing.length === 0 ? 'PASS_V10_THREE_DOC_SYNC_AUDIT' : 'BLOCKED_V10_THREE_DOC_SYNC_AUDIT'
  const report = {
    schemaVersion: 'dsxu.v10.three-doc-sync-audit',
    generatedAt: new Date().toISOString(),
    owner: 'Evidence / Release Claim Binder',
    status,
    publicClaimAllowed: false,
    docs,
    blockers: missing,
    rule:
      'V10 execution must keep the merged total plan and both source subplans synchronized before any release story or public claim update.',
  }
  const jsonPath = join(GENERATED, 'DSXU_V10_DOCUMENT_SYNC_AUDIT_20260520.json')
  const mdPath = join(ROOT, 'docs', 'DSXU_V10_DOCUMENT_SYNC_AUDIT_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Three-Document Sync Audit',
    '',
    `Status: ${status}`,
    '',
    `Public claim allowed: ${String(report.publicClaimAllowed)}`,
    '',
    '| doc | exists | failed checks |',
    '|---|---:|---|',
    ...docs.map(doc => {
      const failed = doc.checks.filter(check => !check.pass).map(check => check.id).join(', ') || 'none'
      return `| ${doc.doc} | ${String(doc.exists)} | ${failed} |`
    }),
    '',
    `Blockers: ${missing.join(', ') || 'none'}`,
    '',
    'Rule: total V10 plan and both subplans must carry the same testing discipline, evidence boundary, and paired raw claim boundary.',
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status, blockers: missing, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (missing.length > 0) process.exitCode = 1
}

main()
