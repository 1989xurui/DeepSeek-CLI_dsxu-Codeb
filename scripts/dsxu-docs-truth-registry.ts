import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, extname, join, relative, resolve } from 'path'

type DocStatus =
  | 'active-master-plan'
  | 'active-v6-evidence'
  | 'active-public-doc'
  | 'active-reference'
  | 'active-registry-source'
  | 'generated-current'
  | 'generated-historical'
  | 'asset'
  | 'superseded-plan'
  | 'superseded-review'
  | 'historical-evidence'
  | 'evidence-audit'
  | 'manual-review'

type DeleteSafety =
  | 'no'
  | 'after-v6-cross-reference'
  | 'after-signal-extraction'
  | 'after-reference-scan'
  | 'regenerable-only'
  | 'yes-low-risk'

type TransformPotential = 'high' | 'medium' | 'low' | 'none'

type RegistryRow = {
  path: string
  ext: string
  size: number
  lines: number
  title: string
  version: string
  status: DocStatus
  deleteSafety: DeleteSafety
  transformPotential: TransformPotential
  absorbedBy: string
  remainingSignals: string[]
  claimRisk: boolean
  releaseRisk: boolean
  generated: boolean
  asset: boolean
  referencedBy: string[]
  recommendedAction: string
  rationale: string
}

type RegistryReport = {
  schemaVersion: 'dsxu.docs-truth-registry.v1'
  generatedAt: string
  repoRoot: string
  scope: string[]
  outputFiles: {
    json: string
    csv: string
    markdown: string
  }
  summary: {
    fileCount: number
    byStatus: Record<string, number>
    byDeleteSafety: Record<string, number>
    byTransformPotential: Record<string, number>
    claimRiskCount: number
    releaseRiskCount: number
    highTransformCount: number
    noDeleteCount: number
    safeLowRiskDeleteCount: number
  }
  newFindings: string[]
  cleanupBatches: Array<{
    batch: string
    intent: string
    files: string[]
  }>
  rows: RegistryRow[]
}

const repoRoot = resolve(process.cwd())
const docsRoot = join(repoRoot, 'docs')
const dateStamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()).replace(/-/g, '')

const generatedDir = join(repoRoot, 'docs', 'generated')
const referenceProductPattern = new RegExp('Cl' + 'aude', 'i')
const referenceProductGlobalPattern = new RegExp('Cl' + 'aude', 'gi')
const externalModelFamilyPattern = new RegExp('G' + 'PT|O' + 'pus', 'i')
const jsonPath = join(generatedDir, `DSXU_DOCS_TRUTH_REGISTRY_${dateStamp}.json`)
const csvPath = join(generatedDir, `DSXU_DOCS_TRUTH_REGISTRY_${dateStamp}.csv`)
const markdownPath = join(repoRoot, 'docs', `DSXU_DOCS_TRUTH_REGISTRY_${dateStamp}.md`)

const textExtensions = new Set(['.md', '.json', '.csv', '.txt', '.svg'])

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await walk(path))
    } else {
      out.push(path)
    }
  }
  return out
}

async function readText(path: string, max = 250_000): Promise<string> {
  if (!textExtensions.has(extname(path).toLowerCase())) return ''
  try {
    return (await readFile(path, 'utf8')).slice(0, max)
  } catch {
    return ''
  }
}

function has(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text))
}

function addSignal(signals: Set<string>, condition: boolean, signal: string): void {
  if (condition) signals.add(signal)
}

function detectSignals(file: string, text: string): string[] {
  const haystack = `${file}\n${text}`
  const signals = new Set<string>()
  addSignal(signals, has(haystack, [/prompt/i, /system prompt/i, /reference product experience/i, referenceProductPattern]), 'prompt-behavior-discipline')
  addSignal(signals, has(haystack, [/Agent/i, /subagent/i, /SendMessage/i, /fork/i, /worktree/i, /swarm/i, /team/i]), 'agent-multi-window-orchestration')
  addSignal(signals, has(haystack, [/Skill/i, /MCP/i, /plugin/i, /workflow/i]), 'skill-mcp-workflow-boundary')
  addSignal(signals, has(haystack, [/tool view/i, /tool gate/i, /tool protocol/i, /ToolCallResult/i, /strict schema/i]), 'tool-protocol-and-schema')
  addSignal(signals, has(haystack, [/verify/i, /TDD/i, /SAST/i, /proof/i, /rollback/i, /recovery/i]), 'verification-recovery-gates')
  addSignal(signals, has(haystack, [/context/i, /compact/i, /cache/i, /ledger/i, /memory/i, /resume/i]), 'context-memory-ledger')
  addSignal(signals, has(haystack, [/DeepSeek/i, /Flash/i, /Pro/i, /routing/i, /cost/i]), 'deepseek-routing-cost-cache')
  addSignal(signals, has(haystack, [/benchmark/i, /SWE/i, /raw transcript/i, /public comparable/i, /hit-rate/i]), 'benchmark-and-hit-rate-evidence')
  addSignal(signals, has(haystack, [/claim/i, /public/i, /90%/i, /90\+/i, /95/i, referenceProductPattern, externalModelFamilyPattern, /parity/i, /superiority/i]), 'claim-boundary-and-public-wording')
  addSignal(signals, has(haystack, [/commercial/i, /brand/i, /license/i, /IP/i, /clean export/i, /release/i]), 'release-ip-brand-risk')
  addSignal(signals, has(haystack, [/TUI/i, /terminal/i, /visible state/i, /senior coding window/i]), 'tui-visible-state-experience')
  addSignal(signals, has(haystack, [/scenario/i, /backlog/i, /acceptance/i, /test/i, /fixture/i]), 'scenario-test-corpus')
  return [...signals]
}

function detectTitle(text: string): string {
  const match = text.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? ''
}

function detectVersion(file: string): string {
  const name = basename(file)
  const match = name.match(/DSXU_V(\d+)/i)
  return match ? `V${match[1]}` : ''
}

function chooseStatus(file: string, text: string): DocStatus {
  const name = basename(file)
  const ext = extname(file).toLowerCase()
  const relativePath = relative(repoRoot, file).replace(/\\/g, '/')
  if (relativePath.includes('/generated/') || ['.json', '.csv'].includes(ext)) {
    return /20260519|V6|CAPABILITY_TRUTH_MATRIX/i.test(name) ? 'generated-current' : 'generated-historical'
  }
  if (relativePath.includes('/assets/') || ['.svg', '.png', '.jpg', '.jpeg'].includes(ext)) return 'asset'
  if (/DSXU_V6_DEEPSEEK_NATIVE_ENGINEERING_RUNTIME/i.test(name)) return 'active-master-plan'
  if (/DSXU_CAPABILITY_TRUTH_MATRIX_20260519/i.test(name)) return 'active-registry-source'
  if (/^DSXU_V6_/i.test(name)) return 'active-v6-evidence'
  if (/^(INSTALL|CONFIGURATION|CONTRIBUTING|SECURITY_PERMISSION|TOOL_SURFACE|RELEASE_RUNBOOK|DOCTOR_HEALTH|BENCHMARK)\.md$/i.test(name)) {
    return 'active-public-doc'
  }
  if (/DEEPSEEK_V4_CAPABILITIES/i.test(name)) return 'active-reference'
  if (/^DSXU_V[123]_/i.test(name)) return 'superseded-plan'
  if (/^DSXU_V5_/i.test(name)) return 'superseded-plan'
  if (/^DSXU_V4_/i.test(name)) return 'superseded-review'
  if (/^DSXU_V(18|19|20|24|26)/i.test(name)) return 'historical-evidence'
  if (/CLAIM|BRAND|COMMERCIAL|IP|PUBLIC|BENCHMARK|EVIDENCE|ACCEPTANCE|AUDIT|REVIEW|CROSSWALK|CORPUS|MANIFEST|REFERENCE|REASONIX|KARPATHY|DAG|PIPELINE|ROOT_TDD|LEGACY_SWE|TUNGSTEN/i.test(name)) {
    return 'evidence-audit'
  }
  if (/README\.md$/i.test(name)) return 'active-public-doc'
  return 'manual-review'
}

function chooseDeleteSafety(status: DocStatus, signals: string[], claimRisk: boolean, releaseRisk: boolean): DeleteSafety {
  if (['active-master-plan', 'active-v6-evidence', 'active-public-doc', 'active-reference', 'active-registry-source'].includes(status)) return 'no'
  if (status === 'generated-current') return 'regenerable-only'
  if (status === 'generated-historical') return claimRisk || releaseRisk ? 'after-signal-extraction' : 'regenerable-only'
  if (status === 'asset') return 'after-reference-scan'
  if (status === 'superseded-plan') return claimRisk || releaseRisk || signals.length > 2 ? 'after-v6-cross-reference' : 'yes-low-risk'
  if (status === 'superseded-review') return 'after-signal-extraction'
  if (status === 'historical-evidence' || status === 'evidence-audit') return 'after-signal-extraction'
  return signals.length === 0 && !claimRisk && !releaseRisk ? 'yes-low-risk' : 'after-signal-extraction'
}

function chooseTransformPotential(status: DocStatus, signals: string[], size: number): TransformPotential {
  if (status === 'active-master-plan' || status === 'active-v6-evidence' || status === 'generated-current') return 'none'
  if (signals.some(signal => [
    'prompt-behavior-discipline',
    'agent-multi-window-orchestration',
    'tool-protocol-and-schema',
    'verification-recovery-gates',
    'scenario-test-corpus',
  ].includes(signal))) return 'high'
  if (signals.some(signal => [
    'claim-boundary-and-public-wording',
    'release-ip-brand-risk',
    'benchmark-and-hit-rate-evidence',
    'deepseek-routing-cost-cache',
    'tui-visible-state-experience',
  ].includes(signal))) return 'medium'
  if (signals.length > 0 || size > 20_000) return 'low'
  return 'none'
}

function chooseAbsorbedBy(status: DocStatus, signals: string[]): string {
  if (status === 'active-master-plan') return 'self'
  if (status === 'active-v6-evidence') return 'V6 master doc evidence section'
  if (status === 'active-registry-source') return 'V6 WP12 / V6-S registry'
  const sections = new Set<string>()
  if (signals.includes('prompt-behavior-discipline')) sections.add('V6-S Prompt Section Router')
  if (signals.includes('agent-multi-window-orchestration')) sections.add('V6-S Agent discipline')
  if (signals.includes('skill-mcp-workflow-boundary')) sections.add('V6-S Skills/MCP expert layer')
  if (signals.includes('tool-protocol-and-schema')) sections.add('V6-S Strict Schema / Tool View')
  if (signals.includes('verification-recovery-gates')) sections.add('V6 Proof/Recovery/Gates')
  if (signals.includes('claim-boundary-and-public-wording')) sections.add('V6 claim boundary')
  if (signals.includes('release-ip-brand-risk')) sections.add('future release/IP phase')
  if (signals.includes('scenario-test-corpus')) sections.add('future replay/scenario bank')
  if (sections.size === 0 && status.startsWith('superseded')) return 'V6 high-level direction'
  return [...sections].join('; ')
}

function chooseAction(status: DocStatus, deleteSafety: DeleteSafety, transformPotential: TransformPotential, signals: string[]): string {
  if (status === 'active-master-plan') return 'keep as current master development document'
  if (status === 'active-v6-evidence') return 'keep as current V6 evidence artifact'
  if (status === 'active-public-doc') return 'keep and sync wording with V6 claim boundaries'
  if (status === 'active-reference') return 'keep; refresh against official DeepSeek docs before public release'
  if (status === 'active-registry-source') return 'keep as source registry until superseded by Docs Truth Registry'
  if (deleteSafety === 'yes-low-risk') return 'delete candidate after one-line index confirms no references'
  if (deleteSafety === 'after-reference-scan') return 'delete only if no markdown/package/script references remain'
  if (deleteSafety === 'regenerable-only') return 'delete only if generator command is current and reproducible'
  if (transformPotential === 'high') return `extract signals into V6/V6-S backlog before archive: ${signals.join(', ')}`
  if (transformPotential === 'medium') return `summarize claim/evidence/release signal before archive: ${signals.join(', ')}`
  return 'archive after cross-reference note'
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function buildReferenceIndex(files: string[]): Promise<Map<string, string[]>> {
  const candidates = files.filter(file => textExtensions.has(extname(file).toLowerCase()))
  const contents = new Map<string, string>()
  for (const file of candidates) {
    contents.set(file, await readText(file, 500_000))
  }
  const index = new Map<string, string[]>()
  for (const target of files) {
    const name = basename(target)
    const targetRel = relative(repoRoot, target).replace(/\\/g, '/')
    const refs: string[] = []
    for (const [source, text] of contents.entries()) {
      if (source === target) continue
      if (text.includes(name) || text.includes(targetRel)) {
        refs.push(relative(repoRoot, source).replace(/\\/g, '/'))
      }
    }
    index.set(target, refs.slice(0, 20))
  }
  return index
}

async function main(): Promise<void> {
  if (!existsSync(docsRoot)) throw new Error('docs directory not found')
  const files = (await walk(docsRoot)).sort()
  const referenceIndex = await buildReferenceIndex(files)
  const rows: RegistryRow[] = []

  for (const file of files) {
    const text = await readText(file)
    const fileStat = await stat(file)
    const rel = relative(repoRoot, file).replace(/\\/g, '/')
    const ext = extname(file).toLowerCase()
    const signals = detectSignals(rel, text)
    const claimRisk = has(`${rel}\n${text}`, [/90\+|90%|95/i, externalModelFamilyPattern, referenceProductGlobalPattern, /public claim/i, /external.*win/i, /benchmark victory/i, /superiority/i, /parity/i])
    const releaseRisk = has(`${rel}\n${text}`, [/release/i, /brand/i, /commercial/i, /license/i, /IP/i, /clean export/i, /blocked claim/i, /claim boundary/i])
    const generated = rel.includes('/generated/') || ['.json', '.csv'].includes(ext)
    const asset = rel.includes('/assets/') || ['.svg', '.png', '.jpg', '.jpeg'].includes(ext)
    const status = chooseStatus(file, text)
    const deleteSafety = chooseDeleteSafety(status, signals, claimRisk, releaseRisk)
    const transformPotential = chooseTransformPotential(status, signals, fileStat.size)
    const absorbedBy = chooseAbsorbedBy(status, signals)
    const recommendedAction = chooseAction(status, deleteSafety, transformPotential, signals)
    rows.push({
      path: rel,
      ext,
      size: fileStat.size,
      lines: text ? text.split(/\r?\n/).length : 0,
      title: detectTitle(text),
      version: detectVersion(rel),
      status,
      deleteSafety,
      transformPotential,
      absorbedBy,
      remainingSignals: signals,
      claimRisk,
      releaseRisk,
      generated,
      asset,
      referencedBy: referenceIndex.get(file) ?? [],
      recommendedAction,
      rationale: `${status}; ${deleteSafety}; signals=${signals.length}`,
    })
  }

  const countBy = (field: keyof RegistryRow): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const row of rows) out[String(row[field])] = (out[String(row[field])] ?? 0) + 1
    return out
  }

  const highSignalRows = rows.filter(row => row.transformPotential === 'high')
  const newFindings = [
    `Docs registry covers ${rows.length} files; deletion should be gated by deleteSafety, not filename age.`,
    `${highSignalRows.length} files still have high transformation potential; do not delete them before signal extraction.`,
    `${rows.filter(row => row.status === 'historical-evidence').length} historical V18/V20/V24/V26 files remain release/IP/claim evidence, not simple clutter.`,
    `${rows.filter(row => row.status === 'superseded-plan').length} superseded V1/V2/V3/V5 plan files are the first cleanup candidates after cross-reference.`,
    `${rows.filter(row => row.remainingSignals.includes('scenario-test-corpus')).length} files contain scenario/test corpus signals that can feed replay bank or acceptance suites.`,
    `${rows.filter(row => row.remainingSignals.includes('prompt-behavior-discipline')).length} files contain prompt/behavior discipline signals that can feed Prompt Section Router tests.`,
  ]

  const cleanupBatches = [
    {
      batch: 'A-delete-or-archive-candidates',
      intent: 'Old plans and unreferenced assets; lowest product-risk cleanup after index creation.',
      files: rows
        .filter(row => ['yes-low-risk', 'after-v6-cross-reference', 'after-reference-scan'].includes(row.deleteSafety))
        .filter(row => ['superseded-plan', 'asset', 'manual-review'].includes(row.status))
        .map(row => row.path),
    },
    {
      batch: 'B-extract-before-archive',
      intent: 'High-signal reviews/backlogs that may still improve V6-S prompt, agent, tool, recovery, or replay design.',
      files: rows
        .filter(row => row.transformPotential === 'high')
        .filter(row => !['active-master-plan', 'active-v6-evidence'].includes(row.status))
        .map(row => row.path),
    },
    {
      batch: 'C-keep-as-governance-evidence',
      intent: 'Release/IP/claim/benchmark evidence required to avoid false public claims.',
      files: rows
        .filter(row => row.claimRisk || row.releaseRisk)
        .filter(row => row.deleteSafety !== 'yes-low-risk')
        .map(row => row.path),
    },
  ]

  const report: RegistryReport = {
    schemaVersion: 'dsxu.docs-truth-registry.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    scope: ['docs/**/*'],
    outputFiles: {
      json: relative(repoRoot, jsonPath).replace(/\\/g, '/'),
      csv: relative(repoRoot, csvPath).replace(/\\/g, '/'),
      markdown: relative(repoRoot, markdownPath).replace(/\\/g, '/'),
    },
    summary: {
      fileCount: rows.length,
      byStatus: countBy('status'),
      byDeleteSafety: countBy('deleteSafety'),
      byTransformPotential: countBy('transformPotential'),
      claimRiskCount: rows.filter(row => row.claimRisk).length,
      releaseRiskCount: rows.filter(row => row.releaseRisk).length,
      highTransformCount: highSignalRows.length,
      noDeleteCount: rows.filter(row => row.deleteSafety === 'no').length,
      safeLowRiskDeleteCount: rows.filter(row => row.deleteSafety === 'yes-low-risk').length,
    },
    newFindings,
    cleanupBatches,
    rows,
  }

  await mkdir(dirname(jsonPath), { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  const header = [
    'path',
    'status',
    'deleteSafety',
    'transformPotential',
    'size',
    'lines',
    'version',
    'claimRisk',
    'releaseRisk',
    'absorbedBy',
    'remainingSignals',
    'referencedBy',
    'recommendedAction',
    'title',
  ]
  const csv = [
    header.join(','),
    ...rows.map(row => header.map(key => csvEscape((row as unknown as Record<string, unknown>)[key])).join(',')),
  ].join('\n')
  await writeFile(csvPath, `${csv}\n`)

  const topHighSignal = highSignalRows
    .filter(row => !['active-master-plan', 'active-v6-evidence'].includes(row.status))
    .sort((left, right) => right.size - left.size)
    .slice(0, 30)

  const markdown = [
    `# DSXU Docs Truth Registry ${dateStamp}`,
    '',
    'This registry classifies every file under `docs/` for cleanup, archive, and V6/V6-S signal extraction. It does not delete files.',
    '',
    '## Summary',
    '',
    `- fileCount: ${report.summary.fileCount}`,
    `- highTransformCount: ${report.summary.highTransformCount}`,
    `- claimRiskCount: ${report.summary.claimRiskCount}`,
    `- releaseRiskCount: ${report.summary.releaseRiskCount}`,
    `- noDeleteCount: ${report.summary.noDeleteCount}`,
    `- safeLowRiskDeleteCount: ${report.summary.safeLowRiskDeleteCount}`,
    '',
    '### By Status',
    '',
    ...Object.entries(report.summary.byStatus).sort().map(([key, value]) => `- ${key}: ${value}`),
    '',
    '### By Delete Safety',
    '',
    ...Object.entries(report.summary.byDeleteSafety).sort().map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## New Findings',
    '',
    ...newFindings.map(finding => `- ${finding}`),
    '',
    '## High-Value Signal Candidates',
    '',
    '| path | status | size | signals | recommendedAction |',
    '|---|---:|---:|---|---|',
    ...topHighSignal.map(row => `| \`${row.path}\` | ${row.status} | ${row.size} | ${row.remainingSignals.join('; ')} | ${row.recommendedAction} |`),
    '',
    '## Cleanup Batches',
    '',
    ...cleanupBatches.flatMap(batch => [
      `### ${batch.batch}`,
      '',
      batch.intent,
      '',
      ...batch.files.slice(0, 80).map(file => `- \`${file}\``),
      batch.files.length > 80 ? `- ... ${batch.files.length - 80} more in JSON/CSV` : '',
      '',
    ]).filter(Boolean),
    '',
    '## Full Registry',
    '',
    '| path | status | deleteSafety | transformPotential | claimRisk | releaseRisk | signals | action |',
    '|---|---|---|---|---:|---:|---|---|',
    ...rows.map(row => `| \`${row.path}\` | ${row.status} | ${row.deleteSafety} | ${row.transformPotential} | ${row.claimRisk} | ${row.releaseRisk} | ${row.remainingSignals.join('; ')} | ${row.recommendedAction} |`),
    '',
  ].join('\n')

  await writeFile(markdownPath, markdown)
  console.log('PASS_DSXU_DOCS_TRUTH_REGISTRY')
  console.log(`files=${rows.length}`)
  console.log(`highTransform=${report.summary.highTransformCount}`)
  console.log(`claimRisk=${report.summary.claimRiskCount}`)
  console.log(`releaseRisk=${report.summary.releaseRiskCount}`)
  console.log(`json=${report.outputFiles.json}`)
  console.log(`csv=${report.outputFiles.csv}`)
  console.log(`markdown=${report.outputFiles.markdown}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
