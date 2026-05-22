import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type OwnerDecisionRow = {
  path: string
  owner: string
  decision: string
  capability: string
  kind: string
  activeImportCount: number
  importedByCount: number
  testReferenceCount: number
  scriptReferenceCount: number
  docReferenceCount: number
  evidence?: string[]
}

type ReachabilityLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4'

type ReachabilityRow = {
  path: string
  owner: string
  capability: string
  reachability: ReachabilityLevel
  publicClaimAllowed: boolean
  internalCapabilityAllowed: boolean
  activeImportCount: number
  testReferenceCount: number
  scriptReferenceCount: number
  missingEvidence: string[]
  verificationCommand: string
  reason: string
}

type ReachabilityReport = {
  schemaVersion: 'dsxu.v7.runtime-reachability-map.v1'
  generatedAt: string
  status: 'PASS_DSXU_RUNTIME_REACHABILITY_MAP' | 'BLOCKED_DSXU_RUNTIME_REACHABILITY_MAP'
  sourceOwnerDecisionPath: string
  summary: {
    mainlineOwnerRows: number
    R0: number
    R1: number
    R2: number
    R3: number
    R4: number
    publicClaimAllowedRows: number
  }
  blockers: string[]
  rows: ReachabilityRow[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_OWNER_DECISIONS = join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_RUNTIME_REACHABILITY_MAP_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseRows(raw: unknown): OwnerDecisionRow[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): OwnerDecisionRow => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? ''),
      decision: String(row.decision ?? ''),
      capability: String(row.capability ?? ''),
      kind: String(row.kind ?? ''),
      activeImportCount: Number(row.activeImportCount ?? 0),
      importedByCount: Number(row.importedByCount ?? 0),
      testReferenceCount: Number(row.testReferenceCount ?? 0),
      scriptReferenceCount: Number(row.scriptReferenceCount ?? 0),
      docReferenceCount: Number(row.docReferenceCount ?? 0),
      evidence: Array.isArray(row.evidence) ? row.evidence.map(String) : [],
    }
  }).filter(row => row.path)
}

function verificationCommand(row: OwnerDecisionRow, level: ReachabilityLevel): string {
  if (row.path.includes('accessibility-tree')) return 'bun test src/dsxu/engine/__tests__/accessibility-tree.test.ts'
  if (row.path.includes('file-edit-adapter')) return 'bun test src/dsxu/engine/__tests__/file-edit-adapter-atomic-v1.test.ts'
  if (row.path.includes('adr-review')) return 'bun test src/dsxu/engine/__tests__/adr-review.test.ts'
  if (row.path.includes('brief/') || row.path.includes('classify/')) return 'bun test src/dsxu/engine/__tests__/compact-session-integration.test.ts'
  if (row.path.includes('bug-brain')) return 'bun test src/dsxu/engine/__tests__/bug-brain.test.ts src/dsxu/engine/__tests__/bug-brain-integration.test.ts'
  if (row.path.includes('checks-as-rules')) return 'bun test src/dsxu/engine/__tests__/work-package-9a-c/checks-as-rules.test.ts'
  if (row.path.includes('circuit-breaker')) return 'bun test src/dsxu/engine/__tests__/circuit-breaker.test.ts'
  if (row.path.includes('coding-task-runner')) return 'bun test src/dsxu/engine/__tests__/coding-pack-integration.test.ts'
  if (row.path.includes('effort-routing')) return 'bun test src/dsxu/engine/__tests__/work-package-9a-e/effort-routing.test.ts'
  if (row.path.includes('file-watcher') || row.path.includes('slash-commands') || row.path.includes('streaming')) return 'bun test src/dsxu/engine/__tests__/wave4-final.test.ts'
  if (row.path.includes('formatters')) return 'bun test src/dsxu/engine/__tests__/wave5-formatters.test.ts'
  if (row.path.includes('frontmatter-parser')) return 'bun test src/dsxu/engine/__tests__/frontmatter-parser.test.ts'
  if (row.path.includes('lifecycle-protocol-manager')) return 'bun test src/dsxu/engine/__tests__/lifecycle-protocol-manager.test.ts'
  if (row.path.includes('magic-docs')) return 'bun test src/dsxu/engine/__tests__/magic-docs.test.ts'
  if (row.path.includes('patch-engine')) return 'bun test src/dsxu/engine/__tests__/work-package-h/patch-engine.test.ts'
  if (row.path.includes('profiles') || row.path.includes('prompt-profile')) return 'bun test src/dsxu/engine/__tests__/work-package-e/profile-filtering.test.ts src/dsxu/engine/__tests__/work-package-e/query-loop-profile.test.ts'
  if (row.path.includes('prompt-section-router')) return 'bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts'
  if (row.path.includes('proxy-budget-guard')) return 'bun test src/dsxu/engine/__tests__/proxy-budget-guard.test.ts'
  if (row.path.includes('recovery/')) return 'bun test src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts src/dsxu/engine/__tests__/recovery-decision-table.test.ts'
  if (row.path.includes('repo-brain')) return 'bun test src/dsxu/engine/__tests__/work-package-9a-b/repo-brain.test.ts src/dsxu/engine/__tests__/work-package-9a-b/context-builder-repo-brain.test.ts'
  if (row.path.includes('retry')) return 'bun test src/dsxu/engine/__tests__/retry-ratelimit.test.ts'
  if (row.path.includes('reviewer-subagent')) return 'bun test src/dsxu/engine/__tests__/reviewer-subagent.test.ts'
  if (row.path.includes('runtime/')) return 'bun test src/dsxu/engine/runtime/__tests__/session-task.test.ts'
  if (row.path.includes('session-') || row.path.endsWith('/session.ts')) return 'bun test src/dsxu/engine/__tests__/wave4-core.test.ts src/dsxu/engine/__tests__/abc-end-to-end.test.ts src/dsxu/engine/__tests__/agent-summary.test.ts src/dsxu/engine/__tests__/task-runtime-mainline-v1-clean.test.ts'
  if (row.path.includes('task-queue')) return 'bun test src/dsxu/engine/__tests__/wave5-taskqueue.test.ts'
  if (row.path.includes('telemetry')) return 'bun test src/dsxu/engine/__tests__/wave5-telemetry.test.ts'
  if (row.path.includes('token-estimator')) return 'bun test src/dsxu/engine/__tests__/wave2.test.ts'
  if (row.path.includes('transaction-manager')) return 'bun test src/dsxu/engine/__tests__/transaction-manager.test.ts'
  if (row.path.includes('ui-shell-contract-registry')) return 'bun test src/dsxu/engine/__tests__/ui-shell-contract-registry.test.ts'
  if (row.path.includes('verify-review-chain')) return 'bun test src/dsxu/engine/__tests__/work-package-j/verify-review-chain.test.ts src/dsxu/engine/__tests__/work-package-j/query-loop-default-chain.test.ts'
  if (row.path.includes('worktree-orchestrator')) return 'bun test src/dsxu/engine/__tests__/worktree-orchestrator.test.ts'
  if (row.path.includes('wsl-execution-placement')) return 'bun test src/dsxu/engine/__tests__/wsl-execution-placement-v1.test.ts'
  if (row.path.includes('services/embedding/')) return 'bun test src/services/embedding/__tests__/embedding.test.ts'
  if (row.path.includes('services/experience/')) return 'bun test src/services/experience/__tests__/experience.test.ts'
  if (row.path.includes('services/health/')) return 'bun run scripts/dsxu-runtime-health.ts'
  if (row.path.includes('services/mcp/adapters/')) return 'bun test src/services/mcp/adapters/__tests__/adapters.test.ts src/services/mcp/adapters/__tests__/mcp-adapters.test.ts'
  if (row.path.includes('services/lsp/')) return 'bun test src/services/lsp/__tests__/lsp.test.ts'
  if (row.path.includes('services/mutation/')) return 'bun test src/services/mutation/__tests__/mutation.test.ts'
  if (row.path.includes('services/sandbox/')) return 'bun test src/services/sandbox/__tests__/sandbox.test.ts'
  if (row.path.includes('utils/search/')) return 'bun test src/utils/search/__tests__/search.test.ts'
  if (row.path.includes('control-plane')) return 'bun test src/dsxu/engine/__tests__/control-plane-v1.test.ts'
  if (row.path.includes('provider') || row.path.includes('cache') || row.owner.includes('DeepSeek')) return 'bun test src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts'
  if (row.path.includes('tool') || row.owner.includes('Tool Gate')) return 'bun test src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts'
  if (row.path.includes('memory') || row.path.includes('compact')) return 'bun test src/dsxu/engine/__tests__/compact-session-integration.test.ts'
  if (row.path.includes('graph')) return 'bun test src/dsxu/engine/__tests__/graph-memory.test.ts'
  if (level === 'R0' || level === 'R1' || level === 'R2') return 'needs focused owner test before claim'
  return 'owner focused test already referenced by truth matrix'
}

function reachabilityFor(row: OwnerDecisionRow): ReachabilityLevel {
  const evidence = (row.evidence ?? []).join(' ')
  if (/live|replay|benchmark/i.test(evidence) && row.activeImportCount > 0 && row.testReferenceCount > 0) return 'R4'
  if (row.activeImportCount > 0 && row.testReferenceCount > 0) return 'R3'
  if (row.activeImportCount > 0) return 'R2'
  if (row.importedByCount > 0) return 'R1'
  return 'R0'
}

function missingEvidence(row: OwnerDecisionRow, level: ReachabilityLevel): string[] {
  const missing: string[] = []
  if (level === 'R0') missing.push('active import or default chain proof')
  if (['R0', 'R1', 'R2'].includes(level)) missing.push('focused owner test')
  if (level !== 'R4') missing.push('live/replay/benchmark evidence')
  return missing
}

function renderMarkdown(report: ReachabilityReport): string {
  return `# DSXU V7 Runtime Reachability Map - ${DATE}

- status: \`${report.status}\`

This map audits only the 98 \`mainline-owner\` rows from the V6 owner review board. Mainline owner means "owned by DSXU", not automatically "public product claim ready".

## Summary

| level | count |
|---|---:|
| R0 | ${report.summary.R0} |
| R1 | ${report.summary.R1} |
| R2 | ${report.summary.R2} |
| R3 | ${report.summary.R3} |
| R4 | ${report.summary.R4} |

publicClaimAllowedRows: ${report.summary.publicClaimAllowedRows}

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## First 80 Rows

| path | owner | reachability | activeImports | tests | publicClaimAllowed |
|---|---|---|---:|---:|---:|
${report.rows.slice(0, 80).map(row => `| \`${row.path}\` | ${row.owner} | ${row.reachability} | ${row.activeImportCount} | ${row.testReferenceCount} | ${row.publicClaimAllowed} |`).join('\n')}
`
}

export async function buildRuntimeReachabilityMap(input: {
  ownerDecisionPath?: string
  generatedAt?: string
} = {}): Promise<ReachabilityReport> {
  const ownerDecisionPath = resolve(input.ownerDecisionPath ?? DEFAULT_OWNER_DECISIONS)
  if (!existsSync(ownerDecisionPath)) throw new Error(`missing owner decision report: ${ownerDecisionPath}`)
  const sourceRows = parseRows(JSON.parse(await readFile(ownerDecisionPath, 'utf8')) as unknown)
    .filter(row => row.decision === 'mainline-owner')
  const rows = sourceRows.map((row): ReachabilityRow => {
    const reachability = reachabilityFor(row)
    return {
      path: row.path,
      owner: row.owner,
      capability: row.capability,
      reachability,
      publicClaimAllowed: false,
      internalCapabilityAllowed: reachability === 'R3' || reachability === 'R4',
      activeImportCount: row.activeImportCount,
      testReferenceCount: row.testReferenceCount,
      scriptReferenceCount: row.scriptReferenceCount,
      missingEvidence: missingEvidence(row, reachability),
      verificationCommand: verificationCommand(row, reachability),
      reason: `V7 reachability ${reachability}: owner-retained behavior still needs claim-specific evidence before public use.`,
    }
  })
  const blockers: string[] = []
  if (rows.length === 0) blockers.push('no mainline-owner rows found')
  if (rows.some(row => row.publicClaimAllowed)) blockers.push('runtime reachability map must not allow public claims by itself')
  const counts = (level: ReachabilityLevel): number => rows.filter(row => row.reachability === level).length
  return {
    schemaVersion: 'dsxu.v7.runtime-reachability-map.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_RUNTIME_REACHABILITY_MAP'
      : 'BLOCKED_DSXU_RUNTIME_REACHABILITY_MAP',
    sourceOwnerDecisionPath: rel(ownerDecisionPath),
    summary: {
      mainlineOwnerRows: rows.length,
      R0: counts('R0'),
      R1: counts('R1'),
      R2: counts('R2'),
      R3: counts('R3'),
      R4: counts('R4'),
      publicClaimAllowedRows: rows.filter(row => row.publicClaimAllowed).length,
    },
    blockers,
    rows,
  }
}

async function main(): Promise<void> {
  const report = await buildRuntimeReachabilityMap()
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    summary: report.summary,
    blockers: report.blockers,
    outputs: {
      json: rel(OUT_JSON),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
