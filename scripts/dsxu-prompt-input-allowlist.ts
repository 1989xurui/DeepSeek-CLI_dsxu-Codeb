import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type Signal = {
  sourceDoc: string
  signalCategory: string
  summary: string
  targetOwner: string
  promptAllowed: boolean
  claimAllowed: boolean
}

type OwnerDecision = {
  path: string
  owner: string
  decision: string
}

type PromptAllowlistItem = {
  id: string
  source: string
  owner: string
  inputType: 'current-task' | 'memory-summary' | 'mainline-rule' | 'prompt-signal' | 'tool-window' | 'verification-contract'
  promptAllowed: true
  maxTokens: number
  contentSummary: string
}

type PromptBlockedItem = {
  source: string
  reason: string
  decision?: string
}

type PromptAllowlistReport = {
  schemaVersion: 'dsxu.v7.prompt-input-allowlist.v1'
  generatedAt: string
  status: 'PASS_DSXU_PROMPT_INPUT_ALLOWLIST' | 'BLOCKED_DSXU_PROMPT_INPUT_ALLOWLIST'
  sourceSignalPath: string
  sourceOwnerDecisionPath: string
  summary: {
    allowlistItems: number
    blockedItems: number
    estimatedTokenBudget: number
    maxTokenBudget: number
    deleteReviewPromptItems: number
    generatedHistoricalRawDocs: number
    supersededPlanRawDocs: number
    claimAllowedItems: number
  }
  blockers: string[]
  allowlist: PromptAllowlistItem[]
  blocked: PromptBlockedItem[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const DEFAULT_SIGNALS = join(GENERATED_DIR, `DSXU_DOC_SIGNAL_EXTRACTION_${DATE}.json`)
const DEFAULT_OWNER_DECISIONS = join(GENERATED_DIR, `DSXU_V6_OWNER_REVIEW_DECISIONS_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_PROMPT_INPUT_ALLOWLIST_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function parseSignals(raw: unknown): Signal[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.signals) ? report.signals : []
  return rows.map((item): Signal => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      sourceDoc: String(row.sourceDoc ?? ''),
      signalCategory: String(row.signalCategory ?? ''),
      summary: String(row.summary ?? ''),
      targetOwner: String(row.targetOwner ?? ''),
      promptAllowed: row.promptAllowed === true,
      claimAllowed: row.claimAllowed === true,
    }
  }).filter(row => row.sourceDoc)
}

function parseDecisions(raw: unknown): OwnerDecision[] {
  const report = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rows = Array.isArray(report.rows) ? report.rows : []
  return rows.map((item): OwnerDecision => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      path: String(row.path ?? ''),
      owner: String(row.owner ?? ''),
      decision: String(row.decision ?? ''),
    }
  }).filter(row => row.path)
}

function baseItems(): PromptAllowlistItem[] {
  return [
    {
      id: 'current-task',
      source: 'runtime user turn',
      owner: 'Query Loop / PlanGraph / Tool Gate',
      inputType: 'current-task',
      promptAllowed: true,
      maxTokens: 2200,
      contentSummary: 'Current user request and immediate constraints.',
    },
    {
      id: 'current-memory-summary',
      source: 'active work-state ledger',
      owner: 'PlanGraph / Work-State Ledger',
      inputType: 'memory-summary',
      promptAllowed: true,
      maxTokens: 1800,
      contentSummary: 'Only current goal, confirmed facts, open obligations, recent failure, and next allowed action.',
    },
    {
      id: 'v6-mainline-rules',
      source: 'DSXU V6 active master plan summary',
      owner: 'Release Claim Binder',
      inputType: 'mainline-rule',
      promptAllowed: true,
      maxTokens: 1800,
      contentSummary: 'DeepSeek-first, Flash default, strict tool schema, no second runtime/provider/tool bus.',
    },
    {
      id: 'tool-window-current',
      source: 'current tool-view compiler',
      owner: 'Tool Gate / Tool View',
      inputType: 'tool-window',
      promptAllowed: true,
      maxTokens: 1200,
      contentSummary: 'Only current logical tool window, not all historical or disabled tools.',
    },
    {
      id: 'verification-recovery-contract',
      source: 'current verification/recovery envelope',
      owner: 'VerificationKernel / Recovery Decision',
      inputType: 'verification-contract',
      promptAllowed: true,
      maxTokens: 1200,
      contentSummary: 'Current verification and recovery obligations, not historical test transcripts.',
    },
  ]
}

function signalItems(signals: Signal[]): PromptAllowlistItem[] {
  return signals
    .filter(signal => signal.promptAllowed)
    .slice(0, 120)
    .map((signal, index): PromptAllowlistItem => ({
      id: `prompt-signal-${(index + 1).toString().padStart(3, '0')}`,
      source: signal.sourceDoc,
      owner: signal.targetOwner,
      inputType: 'prompt-signal',
      promptAllowed: true,
      maxTokens: 80,
      contentSummary: signal.summary,
    }))
}

function blockedItems(signals: Signal[], decisions: OwnerDecision[]): PromptBlockedItem[] {
  const blocked: PromptBlockedItem[] = []
  for (const decision of decisions) {
    if (['delete-review', 'legacy', 'evidence-only'].includes(decision.decision)) {
      blocked.push({
        source: decision.path,
        decision: decision.decision,
        reason: `${decision.decision} is not allowed in default prompt input.`,
      })
    }
  }
  for (const signal of signals) {
    if (!signal.promptAllowed) {
      blocked.push({
        source: signal.sourceDoc,
        reason: `raw ${signal.signalCategory} signal is not prompt allowlisted; only extracted short rules may be used.`,
      })
    }
  }
  return blocked
}

function renderMarkdown(report: PromptAllowlistReport): string {
  return `# DSXU V7 Prompt Input Allowlist - ${DATE}

- status: \`${report.status}\`

The default DeepSeek prompt may use only compact current-task, current-memory, active mainline rules, current tool window, verification contract, and prompt discipline signals. Historical raw docs, evidence-only rows, legacy rows, generated-historical docs, and delete-review paths remain blocked.

## Summary

| metric | value |
|---|---:|
| allowlistItems | ${report.summary.allowlistItems} |
| blockedItems | ${report.summary.blockedItems} |
| estimatedTokenBudget | ${report.summary.estimatedTokenBudget} |
| maxTokenBudget | ${report.summary.maxTokenBudget} |
| deleteReviewPromptItems | ${report.summary.deleteReviewPromptItems} |
| generatedHistoricalRawDocs | ${report.summary.generatedHistoricalRawDocs} |
| supersededPlanRawDocs | ${report.summary.supersededPlanRawDocs} |
| claimAllowedItems | ${report.summary.claimAllowedItems} |

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}

## Allowlist

| id | source | owner | maxTokens |
|---|---|---|---:|
${report.allowlist.slice(0, 80).map(item => `| ${item.id} | \`${item.source}\` | ${item.owner} | ${item.maxTokens} |`).join('\n')}
`
}

export async function buildPromptInputAllowlist(input: {
  signalPath?: string
  ownerDecisionPath?: string
  generatedAt?: string
  maxTokenBudget?: number
} = {}): Promise<PromptAllowlistReport> {
  const signalPath = resolve(input.signalPath ?? DEFAULT_SIGNALS)
  const ownerDecisionPath = resolve(input.ownerDecisionPath ?? DEFAULT_OWNER_DECISIONS)
  if (!existsSync(signalPath)) throw new Error(`missing signal extraction report: ${signalPath}`)
  if (!existsSync(ownerDecisionPath)) throw new Error(`missing owner decision report: ${ownerDecisionPath}`)
  const signals = parseSignals(JSON.parse(await readFile(signalPath, 'utf8')) as unknown)
  const decisions = parseDecisions(JSON.parse(await readFile(ownerDecisionPath, 'utf8')) as unknown)
  const allowlist = [...baseItems(), ...signalItems(signals)]
  const blocked = blockedItems(signals, decisions)
  const maxTokenBudget = input.maxTokenBudget ?? 12_000
  const estimatedTokenBudget = allowlist.reduce((sum, item) => sum + item.maxTokens, 0)
  const deleteReviewPaths = new Set(decisions.filter(row => row.decision === 'delete-review').map(row => row.path))
  const blockers: string[] = []
  const deleteReviewPromptItems = allowlist.filter(item => deleteReviewPaths.has(item.source)).length
  const generatedHistoricalRawDocs = allowlist.filter(item => /generated-historical/i.test(item.contentSummary)).length
  const supersededPlanRawDocs = allowlist.filter(item => /superseded-plan/i.test(item.contentSummary)).length
  const claimAllowedItems = signals.filter(signal => signal.promptAllowed && signal.claimAllowed).length
  if (deleteReviewPromptItems > 0) blockers.push(`delete-review paths leaked into prompt allowlist: ${deleteReviewPromptItems}`)
  if (generatedHistoricalRawDocs > 0) blockers.push(`generated-historical raw docs leaked into prompt allowlist: ${generatedHistoricalRawDocs}`)
  if (supersededPlanRawDocs > 0) blockers.push(`superseded-plan raw docs leaked into prompt allowlist: ${supersededPlanRawDocs}`)
  if (estimatedTokenBudget > maxTokenBudget) blockers.push(`prompt token budget exceeded: ${estimatedTokenBudget}/${maxTokenBudget}`)
  if (claimAllowedItems > 0) blockers.push(`prompt signals are not allowed to carry public claims: ${claimAllowedItems}`)

  return {
    schemaVersion: 'dsxu.v7.prompt-input-allowlist.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_DSXU_PROMPT_INPUT_ALLOWLIST'
      : 'BLOCKED_DSXU_PROMPT_INPUT_ALLOWLIST',
    sourceSignalPath: rel(signalPath),
    sourceOwnerDecisionPath: rel(ownerDecisionPath),
    summary: {
      allowlistItems: allowlist.length,
      blockedItems: blocked.length,
      estimatedTokenBudget,
      maxTokenBudget,
      deleteReviewPromptItems,
      generatedHistoricalRawDocs,
      supersededPlanRawDocs,
      claimAllowedItems,
    },
    blockers,
    allowlist,
    blocked,
  }
}

async function main(): Promise<void> {
  const report = await buildPromptInputAllowlist()
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
