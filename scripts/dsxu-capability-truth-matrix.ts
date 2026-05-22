import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, extname, join, normalize, relative, resolve } from 'path'

type TruthLabel =
  | 'default-mainline'
  | 'app-runtime'
  | 'cli-script'
  | 'test-contract'
  | 'doc-evidence'
  | 'experiment'
  | 'frozen'
  | 'historical-residue'

type MatrixRow = {
  path: string
  kind: string
  capability: string
  primaryLabel: TruthLabel | 'unclassified'
  labels: TruthLabel[]
  defaultMainline: boolean
  appRuntime: boolean
  cliScript: boolean
  testContract: boolean
  docEvidence: boolean
  experiment: boolean
  frozen: boolean
  historicalResidue: boolean
  imports: string[]
  importedBy: string[]
  referencedByScripts: string[]
  referencedByTests: string[]
  referencedByDocs: string[]
  recommendation: string
  reasons: string[]
}

type TruthMatrixReport = {
  schemaVersion: 'dsxu.capability-truth-matrix.v1'
  generatedAt: string
  repoRoot: string
  scope: string[]
  outputFiles: {
    json: string
    csv: string
    markdown: string
  }
  classificationLegend: Record<TruthLabel, string>
  summary: {
    fileCount: number
    byPrimaryLabel: Record<string, number>
    byCapability: Record<string, number>
    byKind: Record<string, number>
    defaultMainlineCount: number
    appRuntimeCount: number
    cliScriptCount: number
    testContractCount: number
    docEvidenceCount: number
    experimentCount: number
    frozenCount: number
    historicalResidueCount: number
    unclassifiedCount: number
  }
  riskNotes: string[]
  rows: MatrixRow[]
}

const repoRoot = resolve(process.cwd())
const dateStamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()).replace(/-/g, '')
const generatedDir = join(repoRoot, 'docs', 'generated')
const referenceProductToken = 'cl' + 'aude'
const markdownPath = join(repoRoot, 'docs', `DSXU_CAPABILITY_TRUTH_MATRIX_${dateStamp}.md`)
const jsonPath = join(generatedDir, `DSXU_CAPABILITY_TRUTH_MATRIX_${dateStamp}.json`)
const csvPath = join(generatedDir, `DSXU_CAPABILITY_TRUTH_MATRIX_${dateStamp}.csv`)

const scanRoots = ['src', 'scripts', 'docs', 'bin']
const rootFiles = ['package.json', 'bunfig.toml', 'tsconfig.json', 'README.md']

const taskMainlineRoots = [
  'src/query.ts',
  'src/Tool.ts',
  'src/tools.ts',
  'src/constants/prompts.ts',
  'src/services/tools/toolExecution.ts',
  'src/services/tools/toolOrchestration.ts',
  'src/services/tools/toolLifecycle.ts',
  'src/services/tools/dsxuToolBatchGate.ts',
]

const appRuntimeRoots = [
  'src/entrypoints/dsxu-code.tsx',
  'src/entrypoints/cli.tsx',
  'src/main.tsx',
]

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.toml',
  '.cmd',
  '.ps1',
  '.yml',
  '.yaml',
  '',
])

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function rel(path: string): string {
  return toPosix(relative(repoRoot, path))
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) out[item] = (out[item] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

async function listFiles(dir: string): Promise<string[]> {
  const abs = join(repoRoot, dir)
  if (!existsSync(abs)) return []
  const entries = await readdir(abs, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = join(abs, entry.name)
    const relativePath = rel(full)
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.dsxu' ||
        entry.name === 'tmp' ||
        entry.name === 'outputs'
      ) {
        continue
      }
      out.push(...(await listFiles(relativePath)))
      continue
    }
    if (!textExtensions.has(extname(entry.name))) continue
    out.push(relativePath)
  }
  return out
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(join(repoRoot, path), 'utf8')
  } catch {
    return ''
  }
}

function importCandidates(raw: string): string[] {
  return [
    raw,
    raw.replace(/\.js$/, '.ts'),
    raw.replace(/\.js$/, '.tsx'),
    `${raw}.ts`,
    `${raw}.tsx`,
    `${raw}.js`,
    `${raw}.jsx`,
    `${raw}.json`,
    `${raw}/index.ts`,
    `${raw}/index.tsx`,
    `${raw}/index.js`,
  ]
}

function resolveImport(fromPath: string, spec: string, files: Set<string>): string | null {
  const baseDir = dirname(fromPath)
  const raw = spec.startsWith('.')
    ? toPosix(normalize(join(baseDir, spec)))
    : /^(src|scripts|docs|bin)\//.test(spec)
      ? toPosix(normalize(spec))
      : null
  if (!raw) return null
  const candidates = importCandidates(raw)
  return candidates.find(candidate => files.has(candidate)) ?? null
}

function extractImports(path: string, text: string, files: Set<string>): string[] {
  const specs = new Set<string>()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const resolved = resolveImport(path, match[1] ?? '', files)
      if (resolved) specs.add(resolved)
    }
  }
  return [...specs].sort()
}

function collectReachable(roots: string[], importsByFile: Map<string, string[]>): Set<string> {
  const seen = new Set<string>()
  const stack = roots.filter(root => importsByFile.has(root))
  while (stack.length) {
    const current = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    for (const next of importsByFile.get(current) ?? []) {
      if (!seen.has(next)) stack.push(next)
    }
  }
  return seen
}

function extractPathReferences(text: string): string[] {
  const refs = new Set<string>()
  const pattern = /\b(?:src|scripts|docs|bin)\/[A-Za-z0-9_./@+-]+(?:\.(?:ts|tsx|js|jsx|json|md|csv|toml|cmd|ps1|yml|yaml))?/g
  for (const match of text.matchAll(pattern)) {
    refs.add((match[0] ?? '').replace(/[),.;:'"`\]]+$/g, ''))
  }
  return [...refs]
}

function fileKind(path: string): string {
  if (path.includes('/__tests__/') || /\.test\.(ts|tsx|js)$/.test(path)) return 'test'
  if (path.startsWith('scripts/')) return 'script'
  if (path.startsWith('docs/generated/')) return 'generated-evidence'
  if (path.startsWith('docs/')) return 'document'
  if (path.startsWith('bin/')) return 'bin'
  if (path === 'package.json' || path.endsWith('.toml') || path.endsWith('.json')) return 'config'
  if (path.startsWith('src/tools/')) return 'tool-source'
  if (path.startsWith('src/dsxu/engine/')) return 'dsxu-engine'
  if (
    path.startsWith('src/buddy/') ||
    path.startsWith('src/components/') ||
    path.startsWith('src/screens/') ||
    path.startsWith('src/ink/')
  ) return 'tui-source'
  if (path.startsWith('src/services/')) return 'service-source'
  if (path.startsWith('src/commands/')) return 'command-source'
  return 'source'
}

function isDefaultMainlineEligible(kind: string): boolean {
  return ![
    'bin',
    'config',
    'document',
    'generated-evidence',
    'script',
    'test',
    'tui-source',
  ].includes(kind)
}

function capabilityOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.includes('__tests__') || lower.includes('.test.')) return 'test-contract'
  if (lower.startsWith('docs/')) return lower.startsWith('docs/generated/') ? 'generated-evidence' : 'documentation'
  if (lower.startsWith('scripts/')) {
    if (lower.includes('benchmark') || lower.includes('swe') || lower.includes('evidence') || lower.includes('acceptance')) return 'evidence-benchmark-cli'
    if (lower.includes('release') || lower.includes('commercial') || lower.includes('ip') || lower.includes('public')) return 'release-governance-cli'
    return 'ops-cli'
  }
  if (lower.includes('deepseek') || lower.includes('provider') || lower.includes('model') || lower.includes('cost') || lower.includes('cache')) return 'provider-model-cost-cache'
  if (lower.includes('query') || lower.includes('repl') || lower.includes('fsm')) return 'query-loop-default-runtime'
  if (lower.includes('tool') || lower.startsWith('src/tools/')) return 'tool-system'
  if (lower.includes('permission') || lower.includes('sandbox') || lower.includes('security') || lower.includes('policy')) return 'permission-safety'
  if (lower.includes('verify') || lower.includes('tdd') || lower.includes('static-analysis') || lower.includes('test-run') || lower.includes('sast')) return 'verification-quality-gates'
  if (lower.includes('recovery') || lower.includes('gear-box') || lower.includes('failure') || lower.includes('rollback') || lower.includes('rewind')) return 'recovery-rollback'
  if (lower.includes('memory') || lower.includes('experience') || lower.includes('compact') || lower.includes('context')) return 'context-memory-compact'
  if (lower.includes('agent') || lower.includes('task') || lower.includes('team') || lower.includes('handoff')) return 'agent-task-orchestration'
  if (lower.includes('mcp') || lower.includes('skill') || lower.includes('plugin') || lower.includes('workflow')) return 'mcp-skill-workflow'
  if (lower.includes('tui') || lower.includes('promptinput') || lower.includes('component') || lower.includes('screen') || lower.includes('ink') || lower.includes('footer') || lower.includes('statusline')) return 'tui-visible-state'
  if (lower.includes('benchmark') || lower.includes('evidence') || lower.includes('acceptance') || lower.includes('release') || lower.includes('public') || lower.includes('claim')) return 'evidence-release-benchmark'
  if (lower.startsWith('src/commands/') || lower.startsWith('src/cli/')) return 'cli-command-surface'
  if (lower.includes('bridge') || lower.includes('remote') || lower.includes('transport')) return 'remote-bridge-transport'
  if (lower.includes('config') || lower.includes('settings') || lower.includes('env')) return 'configuration'
  return 'core-or-unclear'
}

function isHistorical(path: string): boolean {
  const lower = path.toLowerCase()
  return /(?:^|[/_-])v(?:1|2|3|4|5|6|9|10|11|12|16|18|19|20|24|26)(?:[/_.-]|$)/.test(lower) ||
    lower.includes(referenceProductToken) ||
    /(?:legacy|archived|archive|retired|ant|residue|absorption|reference|p12|phase12|ogr|old|compat|migration)/.test(lower)
}

function isExperiment(path: string): boolean {
  const lower = path.toLowerCase()
  return /(?:experiment|experimental|speculation|eval|oracle|scenario|backlog|proof|smoke|ablation|challenge|reasonix|karpathy|tungsten|evo|opportunity|prototype|mock)/.test(lower)
}

function isFrozen(path: string): boolean {
  const lower = path.toLowerCase()
  return /(?:freeze|frozen|disabled|retired|quarantine|blocked|closure|clean-export|commercial-ip|release-preflight|public-surface|proprietary|brand-compat)/.test(lower)
}

function recommendationFor(row: Omit<MatrixRow, 'recommendation'>): string {
  if (row.defaultMainline) return '保留为默认主链；需要保证小测试、可见状态、验证和 DeepSeek 低认知负担。'
  if (row.cliScript && row.docEvidence) return '保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。'
  if (row.testContract && !row.defaultMainline) return '保留为测试合同；若声称产品能力，必须补默认链可达性证据。'
  if (row.frozen) return '冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。'
  if (row.historicalResidue) return '历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。'
  if (row.experiment) return '实验能力；需要显式开关、证据等级和退出条件。'
  if (row.docEvidence) return '文档/证据资产；只能作为说明，不可作为 runtime 完成证明。'
  return '未归类或弱证据；需要 owner 判断是否保留、接入、冻结或删除。'
}

function primaryLabel(labels: TruthLabel[]): MatrixRow['primaryLabel'] {
  const priority: TruthLabel[] = [
    'default-mainline',
    'app-runtime',
    'cli-script',
    'test-contract',
    'doc-evidence',
    'experiment',
    'frozen',
    'historical-residue',
  ]
  return priority.find(label => labels.includes(label)) ?? 'unclassified'
}

function escapeCsv(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function renderCsv(rows: MatrixRow[]): string {
  const headers = [
    'path',
    'kind',
    'capability',
    'primaryLabel',
    'labels',
    'defaultMainline',
    'appRuntime',
    'cliScript',
    'testContract',
    'docEvidence',
    'experiment',
    'frozen',
    'historicalResidue',
    'importedByCount',
    'referencedByScriptsCount',
    'referencedByTestsCount',
    'referencedByDocsCount',
    'recommendation',
    'reasons',
  ]
  return [
    headers.join(','),
    ...rows.map(row =>
      [
        row.path,
        row.kind,
        row.capability,
        row.primaryLabel,
        row.labels,
        row.defaultMainline,
        row.appRuntime,
        row.cliScript,
        row.testContract,
        row.docEvidence,
        row.experiment,
        row.frozen,
        row.historicalResidue,
        row.importedBy.length,
        row.referencedByScripts.length,
        row.referencedByTests.length,
        row.referencedByDocs.length,
        row.recommendation,
        row.reasons,
      ].map(escapeCsv).join(','),
    ),
  ].join('\n') + '\n'
}

function renderMarkdown(report: TruthMatrixReport): string {
  const topCapabilities = Object.entries(report.summary.byCapability)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  const rowsByRisk = report.rows.filter(row =>
    row.defaultMainline ||
    row.primaryLabel === 'unclassified' ||
    row.frozen ||
    row.historicalResidue,
  )
  const sampleRows = rowsByRisk.slice(0, 220)
  const table = sampleRows.map(row =>
    `| \`${row.path}\` | ${row.capability} | ${row.primaryLabel} | ${row.labels.join('<br>') || '-'} | ${row.recommendation} |`,
  ).join('\n')

  return `# DSXU 全能力真相矩阵 ${dateStamp}

生成时间：${report.generatedAt}

本报告由 \`scripts/dsxu-capability-truth-matrix.ts\` 自动扫描生成。它的目的不是证明“能力完成”，而是把每个文件/能力放到正确证据层级中，防止把默认主链、CLI 脚本、测试合同、文档证据、实验、冻结与历史残留混在一起。

## 输出文件

- JSON 全量矩阵：\`${rel(jsonPath)}\`
- CSV 全量矩阵：\`${rel(csvPath)}\`
- Markdown 摘要：\`${rel(markdownPath)}\`

## 分类规则

| 标签 | 含义 |
|---|---|
| default-mainline | 从 DSXU 交互任务主链入口静态可达，属于 prompt -> query -> tool -> verify -> trust/TUI 路径。 |
| app-runtime | 从应用入口静态可达，但不一定进入一次真实编程任务默认链。 |
| cli-script | 位于 \`scripts/\` 或被 package scripts 调用，用于验收、证据、发布或运维。 |
| test-contract | 测试文件或被测试引用，证明合同存在，但不等同默认体验。 |
| doc-evidence | 文档或 docs/generated 证据引用。 |
| experiment | 包含 experiment/eval/oracle/smoke/reasonix/proof 等实验或研究信号。 |
| frozen | 冻结、禁用、发布治理、IP/品牌/清理类资产。 |
| historical-residue | Vxx 阶段、reference-product/absorption/legacy/archived/兼容残留。 |

## 总览

| 指标 | 数量 |
|---|---:|
| 扫描文件总数 | ${report.summary.fileCount} |
| 默认主链 | ${report.summary.defaultMainlineCount} |
| App runtime 可达 | ${report.summary.appRuntimeCount} |
| CLI 脚本 | ${report.summary.cliScriptCount} |
| 测试合同 | ${report.summary.testContractCount} |
| 文档证据 | ${report.summary.docEvidenceCount} |
| 实验 | ${report.summary.experimentCount} |
| 冻结 | ${report.summary.frozenCount} |
| 历史残留 | ${report.summary.historicalResidueCount} |
| 未归类 | ${report.summary.unclassifiedCount} |

## 主分类分布

| 主分类 | 数量 |
|---|---:|
${Object.entries(report.summary.byPrimaryLabel).map(([label, count]) => `| ${label} | ${count} |`).join('\n')}

## 能力分布 Top 20

| 能力域 | 文件数 |
|---|---:|
${topCapabilities.map(([capability, count]) => `| ${capability} | ${count} |`).join('\n')}

## 风险提示

${report.riskNotes.map(note => `- ${note}`).join('\n')}

## 高信号样本矩阵

> 全量逐文件矩阵请看 CSV/JSON。下面只展示默认主链、冻结、历史残留、未归类等高信号样本，避免 Markdown 文件过大。

| 文件 | 能力域 | 主分类 | 标签 | 建议 |
|---|---|---|---|---|
${table}
`
}

async function main(): Promise<void> {
  const scopedFiles = new Set<string>()
  for (const root of scanRoots) {
    for (const file of await listFiles(root)) scopedFiles.add(file)
  }
  for (const file of rootFiles) {
    if (existsSync(join(repoRoot, file))) scopedFiles.add(file)
  }

  const files = [...scopedFiles].sort()
  const fileSet = new Set(files)
  const textByFile = new Map<string, string>()
  for (const file of files) textByFile.set(file, await readText(file))

  const importsByFile = new Map<string, string[]>()
  const importedBy = new Map<string, string[]>()
  for (const file of files) {
    const imports = extractImports(file, textByFile.get(file) ?? '', fileSet)
    importsByFile.set(file, imports)
    for (const imported of imports) {
      const list = importedBy.get(imported) ?? []
      list.push(file)
      importedBy.set(imported, list)
    }
  }

  const taskMainlineReachable = collectReachable(taskMainlineRoots, importsByFile)
  const appRuntimeReachable = collectReachable(appRuntimeRoots, importsByFile)

  const scriptRefs = new Map<string, string[]>()
  const testRefs = new Map<string, string[]>()
  const docRefs = new Map<string, string[]>()
  for (const file of files) {
    const text = textByFile.get(file) ?? ''
    const refs = extractPathReferences(text)
    for (const refPath of refs) {
      if (!fileSet.has(refPath)) continue
      const target =
        file.startsWith('scripts/') || file === 'package.json'
          ? scriptRefs
          : file.includes('/__tests__/') || /\.test\.(ts|tsx|js)$/.test(file)
            ? testRefs
            : file.startsWith('docs/')
              ? docRefs
              : null
      if (!target) continue
      const list = target.get(refPath) ?? []
      list.push(file)
      target.set(refPath, list)
    }
  }

  const rows: MatrixRow[] = files.map(file => {
    const kind = fileKind(file)
    const defaultMainline = taskMainlineReachable.has(file) && isDefaultMainlineEligible(kind)
    const appRuntime = appRuntimeReachable.has(file)
    const cliScript = file.startsWith('scripts/') || (scriptRefs.get(file)?.length ?? 0) > 0
    const testContract =
      kind === 'test' ||
      (testRefs.get(file)?.length ?? 0) > 0 ||
      file.startsWith('src/coordinator/tdd-gate/')
    const docEvidence = file.startsWith('docs/')
    const experiment = isExperiment(file)
    const frozen = isFrozen(file)
    const historicalResidue = isHistorical(file)
    const labels: TruthLabel[] = []
    if (defaultMainline) labels.push('default-mainline')
    if (appRuntime && !defaultMainline) labels.push('app-runtime')
    if (cliScript) labels.push('cli-script')
    if (testContract) labels.push('test-contract')
    if (docEvidence) labels.push('doc-evidence')
    if (experiment) labels.push('experiment')
    if (frozen) labels.push('frozen')
    if (historicalResidue) labels.push('historical-residue')

    const reasons: string[] = []
    if (defaultMainline) reasons.push('reachable from task-mainline roots')
    if (appRuntime) reasons.push('reachable from app runtime roots')
    if (cliScript) reasons.push('script path or referenced by package/script evidence')
    if (testContract) reasons.push('test path or referenced by tests')
    if (docEvidence) reasons.push('docs path or referenced by docs/generated evidence')
    if (experiment) reasons.push('experimental/eval/proof/smoke naming signal')
    if (frozen) reasons.push('freeze/disabled/release-governance naming signal')
    if (historicalResidue) reasons.push('versioned/reference/absorption/legacy naming signal')

    const partial: Omit<MatrixRow, 'recommendation'> = {
      path: file,
      kind,
      capability: capabilityOf(file),
      primaryLabel: primaryLabel(labels),
      labels,
      defaultMainline,
      appRuntime,
      cliScript,
      testContract,
      docEvidence,
      experiment,
      frozen,
      historicalResidue,
      imports: importsByFile.get(file) ?? [],
      importedBy: (importedBy.get(file) ?? []).sort(),
      referencedByScripts: (scriptRefs.get(file) ?? []).sort(),
      referencedByTests: (testRefs.get(file) ?? []).sort(),
      referencedByDocs: (docRefs.get(file) ?? []).sort(),
      reasons,
    }
    return {
      ...partial,
      recommendation: recommendationFor(partial),
    }
  })

  const report: TruthMatrixReport = {
    schemaVersion: 'dsxu.capability-truth-matrix.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    scope: [...scanRoots, ...rootFiles],
    outputFiles: {
      json: rel(jsonPath),
      csv: rel(csvPath),
      markdown: rel(markdownPath),
    },
    classificationLegend: {
      'default-mainline': '从 DSXU 交互任务主链入口静态可达。',
      'app-runtime': '从应用入口静态可达，但不一定进入真实任务默认链。',
      'cli-script': '脚本、package script 或脚本证据引用。',
      'test-contract': '测试文件或测试引用，只证明合同/回放。',
      'doc-evidence': '文档或 docs/generated 证据。',
      experiment: '实验、评估、smoke、proof、oracle、reasonix 等研究能力。',
      frozen: '冻结、禁用、发布/IP/品牌治理或清理资产。',
      'historical-residue': 'Vxx 阶段、reference、absorption、legacy、archived 或兼容残留。',
    },
    summary: {
      fileCount: rows.length,
      byPrimaryLabel: countBy(rows.map(row => row.primaryLabel)),
      byCapability: countBy(rows.map(row => row.capability)),
      byKind: countBy(rows.map(row => row.kind)),
      defaultMainlineCount: rows.filter(row => row.defaultMainline).length,
      appRuntimeCount: rows.filter(row => row.appRuntime).length,
      cliScriptCount: rows.filter(row => row.cliScript).length,
      testContractCount: rows.filter(row => row.testContract).length,
      docEvidenceCount: rows.filter(row => row.docEvidence).length,
      experimentCount: rows.filter(row => row.experiment).length,
      frozenCount: rows.filter(row => row.frozen).length,
      historicalResidueCount: rows.filter(row => row.historicalResidue).length,
      unclassifiedCount: rows.filter(row => row.primaryLabel === 'unclassified').length,
    },
    riskNotes: [
      'default-mainline 是静态可达性，不等同 live provider 成功；公开能力声明仍需 live/benchmark 证据。',
      'test-contract 和 doc-evidence 不能直接当作默认用户体验完成证明。',
      'historical-residue 文件不一定有问题，但必须避免被模型或文档误读为当前默认能力。',
      'experiment/frozen 能力应通过显式开关或 owner 文档管理，不应自动进入 DeepSeek Flash 默认工具面。',
      '脚本证据多代表验收/发布/分析面，不代表一次真实 prompt 到 final 的主链体验。',
    ],
    rows,
  }

  await mkdir(generatedDir, { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(csvPath, renderCsv(rows), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')

  console.log(JSON.stringify({
    status: 'PASS_DSXU_CAPABILITY_TRUTH_MATRIX',
    generatedAt: report.generatedAt,
    fileCount: report.summary.fileCount,
    defaultMainlineCount: report.summary.defaultMainlineCount,
    appRuntimeCount: report.summary.appRuntimeCount,
    cliScriptCount: report.summary.cliScriptCount,
    testContractCount: report.summary.testContractCount,
    docEvidenceCount: report.summary.docEvidenceCount,
    experimentCount: report.summary.experimentCount,
    frozenCount: report.summary.frozenCount,
    historicalResidueCount: report.summary.historicalResidueCount,
    unclassifiedCount: report.summary.unclassifiedCount,
    outputs: report.outputFiles,
  }, null, 2))
}

await main()
