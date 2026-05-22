import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

type NamingRow = Record<string, string>

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V26_NAMING_GOVERNANCE_BOARD_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V26_NAMING_GOVERNANCE_BOARD_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V26_NAMING_GOVERNANCE_BOARD_${DATE}.md`)
const BASE_TOKENS: string[] = []
const HISTORICAL_VERSION_PATTERN = '(?:6|7|8|9|1[0-9]|2[0-6])'
const SKIP_DIRS = new Set(['.git', '.dsxu', 'node_modules', 'outputs', '.trash', '.dsevo'])
const ACL_RESIDUE_PATHS = new Set([
  'src/dsxu/integration/harness/v10-context-budget-v1-harness.ts',
  'src/dsxu/integration/harness/v10-longtask-stability-v1-harness.ts',
  'src/dsxu/integration/harness/v10-model-gateway-v1-harness.ts',
])
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.csv', '.txt', '.yml', '.yaml',
  '.toml', '.css', '.html', '.svg', '.ps1', '.sh', '',
])

function extOf(path: string): string {
  const index = path.lastIndexOf('.')
  return index >= 0 ? path.slice(index) : ''
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []
  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(full)
      } else if (entry.isFile()) {
        const rel = relative(root, full).replace(/\\/g, '/')
        files.push(rel)
      }
    }
  }
  await visit(root)
  return files.sort()
}

function tokenHits(text: string): string[] {
  const hits = new Set<string>()
  const scanText = text.includes('\n') ? text.split(/\r?\n/) : [text]
  for (const line of scanText) {
    if (isTechnicalVersionLine(line)) continue
    for (const token of BASE_TOKENS) {
      const pattern = new RegExp(`(?:^|[^A-Za-z0-9])(${token})(?:[^A-Za-z0-9]|$)`, 'g')
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        if (match[1]) hits.add(match[1])
      }
    }
    const boundaryVersion = new RegExp(`(?:^|[^A-Za-z0-9])([Vv]${HISTORICAL_VERSION_PATTERN})(?:[^A-Za-z0-9]|$)`, 'g')
    const separatorVersion = new RegExp(`(?:^|[/_.-])(v${HISTORICAL_VERSION_PATTERN})(?:[/_.-]|$)`, 'g')
    for (const pattern of [boundaryVersion, separatorVersion]) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        if (match[1]) hits.add(match[1])
      }
    }
  }
  return [...hits].sort((a, b) => a.localeCompare(b))
}

function isTechnicalVersionLine(line: string): boolean {
  if (line.length > 1000) return true
  return /\b(?:V8|v8)\b.*\b(?:heap|Bun|JSC|string|snapshot|generateHeapSnapshot|sliced|de-?opts?|import|from|toLocaleString|SIMD)\b/.test(line) ||
    /\b(?:heap|Bun|JSC|string|snapshot|generateHeapSnapshot|sliced|de-?opts?|import|from|toLocaleString|SIMD)\b.*\b(?:V8|v8)\b/.test(line) ||
    /\b(?:IPv6|IPv4|EC2)\b/.test(line) ||
    /\bNode\.js to v18\+/.test(line) ||
    /\bfile ID\b.*\bV8/.test(line)
}

function hasVersionSignal(text: string): boolean {
  return tokenHits(text).length > 0
}

function classifyPath(path: string, contentHits: string[]): { surface: string; severity: string; action: string } {
  const lower = path.toLowerCase()
  const filenameHasSignal = hasVersionSignal(path)
  const hasHistoricalContent = contentHits.length > 0
  if (lower.startsWith('docs/generated/') || /^docs\/DSXU_V\d+/.test(path)) {
    return {
      surface: 'historical-evidence',
      severity: 'allowed-evidence',
      action: 'keep for traceability; future product docs should link through docs/evidence instead of copying this name',
    }
  }
  if (lower.startsWith('docs/evidence/assets/legacy-')) {
    return {
      surface: 'historical-evidence',
      severity: 'allowed-evidence',
      action: 'legacy evidence asset retained for traceability; public product assets must use stable names',
    }
  }
  if (lower.startsWith('docs/product/') || lower.startsWith('docs/release/') || lower.startsWith('docs/evidence/')) {
    return {
      surface: 'stable-doc-index',
      severity: hasHistoricalContent ? 'watch-public-copy' : 'ok',
      action: 'allowed only as historical reference or evidence pointer; product feature names must remain capability-based',
    }
  }
  if (lower.startsWith('scripts/')) {
    return {
      surface: 'automation-script',
      severity: filenameHasSignal ? 'historical-script-shim' : 'watch-script-copy',
      action: 'keep historical script for reproducibility; public docs must use stable capability aliases',
    }
  }
  if (lower === 'package.json') {
    return {
      surface: 'package-entry',
      severity: 'stable-alias-audited',
      action: 'do not remove historical scripts yet; script audit must keep stable aliases for product/release workflows',
    }
  }
  if (ACL_RESIDUE_PATHS.has(path)) {
    return {
      surface: 'acl-residue',
      severity: 'acl-external-closure',
      action: 'owner-signed external ACL residue; do not import or restore runtime; delete only when filesystem permissions allow it',
    }
  }
  if (lower.includes('/__tests__/')) {
    return {
      surface: 'test-evidence-source',
      severity: filenameHasSignal ? 'rename-candidate' : 'historical-test-copy',
      action: 'test evidence may reference historical gates for reproducibility; new tests should use capability names',
    }
  }
  if (lower.startsWith('src/dsxu/integration/harness/')) {
    return {
      surface: 'integration-evidence-harness',
      severity: filenameHasSignal ? 'rename-candidate' : 'historical-harness-copy',
      action: 'harness content may reference historical evidence IDs; active imports must still resolve to DSXU owners',
    }
  }
  if (lower.startsWith('src/dsxu/engine/') && /(?:contract|evidence|benchmark|readiness|report|manifest|pack|replay|oracle|acceptance|audit|review|raw|eval|baseline|gate|stage-close|route-plan|hit-rate|controlled-failure|go-stop|runner|compare|smoke|placement|mirror-plan|semantic-tool-trace)/.test(lower)) {
    return {
      surface: 'product-evidence-source',
      severity: filenameHasSignal ? 'rename-candidate' : 'evidence-content-review',
      action: 'evidence source can keep historical evidence IDs only when outputs are traceable and public names stay capability-based',
    }
  }
  if (lower.startsWith('src/') || lower.startsWith('bin/')) {
    return {
      surface: 'product-runtime-source',
      severity: filenameHasSignal ? 'rename-candidate' : 'content-review',
      action: 'product source should use capability names; historical Vxx/C2/OGR/P12 terms need owner review before public release',
    }
  }
  if (lower.startsWith('docs/assets/')) {
    return {
      surface: 'public-asset',
      severity: filenameHasSignal ? 'rename-candidate' : 'ok',
      action: 'public assets should use product/capability names, not historical version names',
    }
  }
  return {
    surface: 'other',
    severity: filenameHasSignal ? 'review' : 'ok',
    action: 'review before public release if exposed to users',
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toCsv(rows: NamingRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\n') + '\n'
}

function groupCount(rows: readonly NamingRow[], key: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = row[key] || '<empty>'
    counts[value] = (counts[value] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

async function readPackageScripts(): Promise<Record<string, string>> {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  return pkg.scripts ?? {}
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const files = await listFiles(ROOT)
  const rows: NamingRow[] = []
  for (const file of files) {
    const filenameHits = tokenHits(file)
    let contentHits: string[] = []
    let lineHits = 0
    const full = join(ROOT, file)
    const info = await stat(full)
    if (info.size < 1_000_000 && TEXT_EXTENSIONS.has(extOf(file))) {
      try {
        const text = await readFile(full, 'utf8')
        contentHits = tokenHits(text)
        lineHits = text.split(/\r?\n/).filter(line => hasVersionSignal(line)).length
      } catch {
        contentHits = []
      }
    }
    if (filenameHits.length === 0 && contentHits.length === 0) continue
    const classification = classifyPath(file, contentHits)
    rows.push({
      path: file,
      surface: classification.surface,
      severity: classification.severity,
      filenameHits: filenameHits.join(';'),
      contentHits: contentHits.join(';'),
      lineHits: String(lineHits),
      requiredAction: classification.action,
    })
  }

  const scripts = await readPackageScripts()
  const scriptRows = Object.entries(scripts)
    .filter(([name, command]) => hasVersionSignal(name) || hasVersionSignal(command))
    .map(([name, command]) => ({
      script: name,
      command,
      hasStableAlias:
        name.includes(':') && !/^v\d+:/i.test(name)
          ? 'yes'
          : Object.entries(scripts).some(([otherName, otherCommand]) => otherName !== name && otherCommand === command && !/^v\d+:/i.test(otherName))
            ? 'yes'
            : 'no',
      requiredAction:
        /^v\d+:/i.test(name)
          ? 'keep historical alias for reproducibility but use stable capability alias in product/release docs'
          : 'stable alias may stay if it is capability-based',
    }))

  const productRuntimeSourceRows = rows.filter(row => row.surface === 'product-runtime-source')
  const productEvidenceSourceRows = rows.filter(row => row.surface === 'product-evidence-source')
  const testEvidenceSourceRows = rows.filter(row => row.surface === 'test-evidence-source')
  const integrationHarnessRows = rows.filter(row => row.surface === 'integration-evidence-harness')
  const renameCandidates = rows.filter(row => row.severity === 'rename-candidate')
  const stableAliasMissing = scriptRows.filter(row => row.hasStableAlias === 'no')
  const publicAssetRename = rows.filter(row => row.surface === 'public-asset' && row.severity === 'rename-candidate')
  const aclResidueRows = rows.filter(row => row.surface === 'acl-residue')

  const summary = {
    schemaVersion: 'dsxu.v26.naming-governance-board.v1',
    generatedAt: new Date().toISOString(),
    status: productRuntimeSourceRows.length > 0 || stableAliasMissing.length > 0 || publicAssetRename.length > 0
      ? 'OPEN_NAMING_GOVERNANCE_REQUIRED'
      : 'PASS_NAMING_GOVERNANCE_READY',
    totals: {
      scannedFiles: files.length,
      filesWithNamingSignals: rows.length,
      productRuntimeSourceRows: productRuntimeSourceRows.length,
      productEvidenceSourceRows: productEvidenceSourceRows.length,
      testEvidenceSourceRows: testEvidenceSourceRows.length,
      integrationHarnessRows: integrationHarnessRows.length,
      renameCandidates: renameCandidates.length,
      packageScriptsWithHistoricalSignals: scriptRows.length,
      packageScriptsMissingStableAlias: stableAliasMissing.length,
      publicAssetRenameCandidates: publicAssetRename.length,
      aclResidueRows: aclResidueRows.length,
    },
    counts: {
      bySurface: groupCount(rows, 'surface'),
      bySeverity: groupCount(rows, 'severity'),
    },
    packageScripts: scriptRows,
    topRows: rows
      .filter(row =>
        row.surface === 'product-runtime-source' ||
        row.surface === 'product-evidence-source' ||
        row.surface === 'acl-residue' ||
        row.severity === 'rename-candidate' ||
        row.surface === 'public-asset'
      )
      .slice(0, 80),
    rule: 'Vxx/vxx names are allowed in historical evidence and reproducible scripts, but product runtime source, public docs, package aliases, and assets should use stable capability names.',
    nextAction: 'Keep historical test/evidence references traceable, but clean product-runtime source copy and public surface names before release.',
  }

  await writeFile(OUT_CSV, toCsv(rows), 'utf8')
  await writeFile(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  const surfaceRows = Object.entries(summary.counts.bySurface).map(([surface, count]) => ({ surface, count }))
  const severityRows = Object.entries(summary.counts.bySeverity).map(([severity, count]) => ({ severity, count }))
  const md = [
    `# DSXU V26 Naming Governance Board - ${DATE}`,
    '',
    `Status: ${summary.status}`,
    '',
    '## Summary',
    '',
    mdTable([
      { key: 'scannedFiles', value: summary.totals.scannedFiles },
      { key: 'filesWithNamingSignals', value: summary.totals.filesWithNamingSignals },
      { key: 'productRuntimeSourceRows', value: summary.totals.productRuntimeSourceRows },
      { key: 'productEvidenceSourceRows', value: summary.totals.productEvidenceSourceRows },
      { key: 'testEvidenceSourceRows', value: summary.totals.testEvidenceSourceRows },
      { key: 'integrationHarnessRows', value: summary.totals.integrationHarnessRows },
      { key: 'renameCandidates', value: summary.totals.renameCandidates },
      { key: 'packageScriptsWithHistoricalSignals', value: summary.totals.packageScriptsWithHistoricalSignals },
      { key: 'packageScriptsMissingStableAlias', value: summary.totals.packageScriptsMissingStableAlias },
      { key: 'publicAssetRenameCandidates', value: summary.totals.publicAssetRenameCandidates },
      { key: 'aclResidueRows', value: summary.totals.aclResidueRows },
    ], ['key', 'value']),
    '',
    '## By Surface',
    '',
    mdTable(surfaceRows, ['surface', 'count']),
    '',
    '## By Severity',
    '',
    mdTable(severityRows, ['severity', 'count']),
    '',
    '## Package Script Alias Status',
    '',
    mdTable(scriptRows.map(row => ({
      script: row.script,
      hasStableAlias: row.hasStableAlias,
      command: row.command,
    })), ['script', 'hasStableAlias', 'command']),
    '',
    '## Product/Public Rename Candidates',
    '',
    mdTable(summary.topRows.map(row => ({
      path: row.path,
      surface: row.surface,
      severity: row.severity,
      filenameHits: row.filenameHits,
      lineHits: row.lineHits,
    })), ['path', 'surface', 'severity', 'filenameHits', 'lineHits']),
    '',
    '## Rules',
    '',
    '- Historical V18/V19/V20/V24/V26 evidence files may keep their names for traceability.',
    '- Product runtime source and public product docs should use capability names, not historical version names.',
    '- Test evidence, integration harnesses, and evidence generators may retain historical evidence IDs when they are required for reproducibility and do not create runtime entrypoints.',
    '- Package scripts should expose stable aliases such as `release:*`, `acceptance:*`, `benchmark:*`, and `evidence:*`; old `v24:*` aliases can remain as reproducibility shims.',
    '- Public assets should not carry Vxx names once they are linked from README.',
    '',
    '## Files',
    '',
    `- CSV: ${OUT_CSV}`,
    `- JSON: ${OUT_JSON}`,
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(JSON.stringify({
    status: summary.status,
    filesWithNamingSignals: summary.totals.filesWithNamingSignals,
    productRuntimeSourceRows: summary.totals.productRuntimeSourceRows,
    productEvidenceSourceRows: summary.totals.productEvidenceSourceRows,
    testEvidenceSourceRows: summary.totals.testEvidenceSourceRows,
    integrationHarnessRows: summary.totals.integrationHarnessRows,
    renameCandidates: summary.totals.renameCandidates,
    packageScriptsWithHistoricalSignals: summary.totals.packageScriptsWithHistoricalSignals,
    packageScriptsMissingStableAlias: summary.totals.packageScriptsMissingStableAlias,
    publicAssetRenameCandidates: summary.totals.publicAssetRenameCandidates,
    outJson: OUT_JSON,
    outCsv: OUT_CSV,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
