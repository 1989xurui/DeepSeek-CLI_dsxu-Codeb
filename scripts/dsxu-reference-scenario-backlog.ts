import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Priority = 'P0' | 'P1' | 'P2'

type MechanismArea = {
  id: string
  label: string
  mechanismClass: string
  dsxuOwner: string
  basePriority: Priority
  value: string
  deepseekAdaptation: string
  boundary: string
}

type RoleLens = {
  id: string
  label: string
  focus: string
}

type PhasePattern = {
  id: string
  label: string
  priorityShift: 0 | 1 | 2
  acceptance: string
}

type ScenarioRow = {
  id: string
  priority: Priority
  mechanismArea: string
  mechanismClass: string
  role: string
  phase: string
  title: string
  dsxuOwner: string
  value: string
  deepseekAdaptation: string
  implementationBoundary: string
  acceptanceEvidence: string
}

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_REFERENCE_SCENARIO_BACKLOG_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_REFERENCE_SCENARIO_BACKLOG_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_REFERENCE_SCENARIO_BACKLOG_${DATE}.md`)

const PRIORITY_ORDER: Priority[] = ['P0', 'P1', 'P2']

const AREAS: readonly MechanismArea[] = [
  {
    id: 'goal-contract',
    label: 'Goal Contract / Stop Conditions',
    mechanismClass: 'cognitive-workflow',
    dsxuOwner: 'Query loop / PlanGraph owner',
    basePriority: 'P0',
    value: '把用户目标、非目标、验收和停止条件保持为长期任务不变量。',
    deepseekAdaptation: '让 Flash 默认执行时也有稳定目标摘要；复杂计划升 Flash max，不常驻 Pro。',
    boundary: '不能新增第二套 planner；必须接现有 query-loop / work-state timeline。',
  },
  {
    id: 'source-truth',
    label: 'Source Truth / Capsule',
    mechanismClass: 'cognitive-workflow',
    dsxuOwner: 'Code-mode source truth owner',
    basePriority: 'P0',
    value: '先定位、再范围读取、再修改，避免模型靠旧记忆或全文回灌猜测。',
    deepseekAdaptation: '使用 path/hash/anchor/excerpt/riskTags 形成稳定 source capsule。',
    boundary: 'memory 只能导航，不能替代当前 source truth。',
  },
  {
    id: 'impact-analysis',
    label: 'Impact / Blast Radius',
    mechanismClass: 'cognitive-workflow',
    dsxuOwner: 'Repo index / owner map owner',
    basePriority: 'P0',
    value: '改动前识别入口、调用链、测试、文档和发布影响。',
    deepseekAdaptation: '用轻量索引和 import/use evidence 减少重复大文件读取。',
    boundary: '只能产证据和建议，不自动扩大重构范围。',
  },
  {
    id: 'tool-lifecycle',
    label: 'Tool Lifecycle / Causality',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'Tool Gate / ToolBus owner',
    basePriority: 'P0',
    value: '每个工具调用都有原因、输入摘要、权限、输出、风险和下一步。',
    deepseekAdaptation: '工具结果以 preview + artifact + hash 进入上下文，保护 DeepSeek cache。',
    boundary: '不允许工具绕过 DSXU Tool Gate。',
  },
  {
    id: 'permission-control',
    label: 'Permission / Human Signoff',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'Permission Gate owner',
    basePriority: 'P0',
    value: '删除、外部执行、权限、Pro 升级、release claim 都有显式签收点。',
    deepseekAdaptation: '把 permission decision 编译成模型可见的结构化 evidence。',
    boundary: '不能创建本地 shortcut permission 或兼容 holding path。',
  },
  {
    id: 'terminal-reliability',
    label: 'Terminal / Shell Reliability',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'Terminal lifecycle owner',
    basePriority: 'P0',
    value: '命令执行前有计划，执行后有 exit、key lines、artifact、失败修复。',
    deepseekAdaptation: '长 stdout/stderr 落 artifact，只给 Flash bounded preview。',
    boundary: '不能用脚本输出冒充真实 TUI/CLI 体验。',
  },
  {
    id: 'failure-recovery',
    label: 'Failure / Repair Loop',
    mechanismClass: 'cognitive-workflow',
    dsxuOwner: 'Failure taxonomy / recovery owner',
    basePriority: 'P0',
    value: '失败被分类、定位、修复、重测和报告，而不是被 narration 掩盖。',
    deepseekAdaptation: '失败摘要进入动态尾部，稳定目标和 source anchors 保持不变。',
    boundary: '不能把单次重试写成恢复能力达标。',
  },
  {
    id: 'test-verification',
    label: 'Test Selection / Verification',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'VerificationKernel owner',
    basePriority: 'P0',
    value: '按 owner、风险和 touched files 选择测试，最后再做完整验收。',
    deepseekAdaptation: '用 Flash 做测试计划和失败 triage；高风险 review 再升阶。',
    boundary: 'focused test 只证明局部，不替代最终六阶段测试。',
  },
  {
    id: 'context-cache',
    label: 'Context / Cache Hygiene',
    mechanismClass: 'deepseek-runtime',
    dsxuOwner: 'ContextCompiler / TokenFirewall owner',
    basePriority: 'P0',
    value: '稳定前缀、动态尾部、tool preview、microcompact 一起保护上下文。',
    deepseekAdaptation: '尽量提升 DeepSeek prefix cache，但不把固定命中率当 release gate。',
    boundary: '不能为了 cache 命中减少必要证据。',
  },
  {
    id: 'model-cost-route',
    label: 'Model Route / Cost Evidence',
    mechanismClass: 'deepseek-runtime',
    dsxuOwner: 'DeepSeek route / cost owner',
    basePriority: 'P0',
    value: 'Flash-first、Flash max、Pro admission、FIM lane 的触发可解释、可审计。',
    deepseekAdaptation: '默认 deepseek-v4-flash；Pro 只在明确 admission evidence 下使用。',
    boundary: '不能因 prompt 文本误触发 Pro/FIM。',
  },
  {
    id: 'visible-state',
    label: 'Visible Work-State Projection',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Work-state timeline owner',
    basePriority: 'P0',
    value: '用户在 TUI/CLI/stream-json/final report 看到同一份工作状态。',
    deepseekAdaptation: 'route/cost/cache/tool/permission/source/recovery 全部投影为事件。',
    boundary: '不能做 UI 假状态，必须来自真实 timeline。',
  },
  {
    id: 'agent-handoff',
    label: 'Agent / Worker Handoff',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'Agent lifecycle owner',
    basePriority: 'P1',
    value: 'worker 只回传 summary、path、hash、evidence，父任务负责合成。',
    deepseekAdaptation: '减少长 transcript 回灌，保护 Flash 上下文和成本。',
    boundary: '不能新增第二套 agent orchestrator。',
  },
  {
    id: 'mcp-skill',
    label: 'MCP / Skill Ecosystem',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'MCP / Skill registry owner',
    basePriority: 'P1',
    value: '外部技能、MCP、插件都有优先级、权限、冲突和 fallback。',
    deepseekAdaptation: '生态能力作为 adapter boundary，不进入第二 runtime。',
    boundary: 'Superpowers 等只能二级补充，不能覆盖主链。',
  },
  {
    id: 'provider-health',
    label: 'Provider Health / First Run',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Provider gate / doctor owner',
    basePriority: 'P1',
    value: '首次使用、key、quota、latency、doctor、provider failure 都可见。',
    deepseekAdaptation: 'DeepSeek key/route/cache/cost 以 masked evidence 展示。',
    boundary: '不得输出或打包用户 key。',
  },
  {
    id: 'workspace-hygiene',
    label: 'Workspace Hygiene / Dirty Attribution',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Workspace hygiene / owner review owner',
    basePriority: 'P1',
    value: 'dirty、generated、evidence、delete candidates、permission residues 分 owner 管理。',
    deepseekAdaptation: '用 Flash 生成 owner packets 和 review summaries，减少重复人工整理。',
    boundary: '不自动 stage/delete/clean/reset。',
  },
  {
    id: 'release-evidence',
    label: 'Release Evidence / Claim Guard',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Release evidence owner',
    basePriority: 'P1',
    value: 'README、GitHub 图表、release claim 全部绑定真实证据。',
    deepseekAdaptation: 'Flash 生成 claim guard；Pro 只做高风险审查。',
    boundary: '未达 90% 不能写对标达成。',
  },
  {
    id: 'benchmark-proof',
    label: 'Benchmark / Public Challenge Proof',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Benchmark evidence owner',
    basePriority: 'P1',
    value: '公开挑战有同题 raw、rubric、cost、cache、failure 和 external target manifest。',
    deepseekAdaptation: 'source capsule + no-Read 默认保护真实 public challenge 成本。',
    boundary: '不能用 controlled harness 冒充公开 benchmark。',
  },
  {
    id: 'security-privacy',
    label: 'Security / Privacy / Secret Safety',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'Security / secret scan owner',
    basePriority: 'P1',
    value: 'key、logs、artifacts、browser、MCP、plugin 都有 redaction 和风险边界。',
    deepseekAdaptation: '模型只看 masked evidence，不看 secret 原文。',
    boundary: 'release/export 必须 secret scan。',
  },
  {
    id: 'open-source-product',
    label: 'Open Source Product / Maintainer Flow',
    mechanismClass: 'trust-and-visibility',
    dsxuOwner: 'Open-source launch owner',
    basePriority: 'P2',
    value: '开源用户能安装、运行、复现 demo、理解边界、提交 issue/PR。',
    deepseekAdaptation: '用真实成本/体验/失败恢复作为卖点，而不是品牌口号。',
    boundary: '不使用参考产品品牌、源码或商业实现。',
  },
  {
    id: 'external-adapter',
    label: 'External Adapter / IDE / Browser Boundary',
    mechanismClass: 'execution-boundary',
    dsxuOwner: 'External adapter boundary owner',
    basePriority: 'P2',
    value: 'IDE/API/browser/GUI/AionUi/Cherry/Warp 等只作为可接入边界。',
    deepseekAdaptation: '外部 host 事件进入 DSXU Tool Gate、cost、evidence 和 visible state。',
    boundary: 'DSXU 仍是独立产品，不内置第三方运行时。',
  },
]

const ROLES: readonly RoleLens[] = [
  {
    id: 'senior-feature-engineer',
    label: 'senior feature engineer',
    focus: '多文件功能实现、owner 判断、风险控制和回归。',
  },
  {
    id: 'debugging-engineer',
    label: 'debugging engineer',
    focus: '失败复现、根因定位、修复、回归和证据。',
  },
  {
    id: 'technical-lead',
    label: 'technical lead',
    focus: '目标保持、计划拆分、长期任务恢复和签收。',
  },
  {
    id: 'terminal-operator',
    label: 'terminal operator',
    focus: '命令计划、执行、失败修复、artifact 和 bounded preview。',
  },
  {
    id: 'release-owner',
    label: 'release owner',
    focus: '发布 gate、claim guard、secret scan、fresh install 和 clean export。',
  },
  {
    id: 'security-reviewer',
    label: 'security reviewer',
    focus: '权限、secret、网络、MCP、browser 和插件风险。',
  },
  {
    id: 'performance-engineer',
    label: 'performance engineer',
    focus: '成本、cache、latency、tool output 和 token budget。',
  },
  {
    id: 'ecosystem-integrator',
    label: 'ecosystem integrator',
    focus: 'MCP、Skill、IDE/API、external adapter 和冲突处理。',
  },
  {
    id: 'new-user-operator',
    label: 'new user operator',
    focus: '首次 key、doctor、help、demo、错误恢复和信任感。',
  },
  {
    id: 'maintainer-reviewer',
    label: 'maintainer reviewer',
    focus: 'owner packets、dirty 归因、PR/issue、删除候选和长期维护。',
  },
]

const PHASES: readonly PhasePattern[] = [
  {
    id: 'preflight',
    label: 'preflight / plan',
    priorityShift: 0,
    acceptance: '执行前能看到目标、owner、风险、成本/权限影响和停止条件。',
  },
  {
    id: 'execution',
    label: 'execution / action',
    priorityShift: 0,
    acceptance: '执行时只走 DSXU 主链 owner，事件进入 timeline，工具输出受预算控制。',
  },
  {
    id: 'failure',
    label: 'failure / diagnosis',
    priorityShift: 1,
    acceptance: '失败时能分类、定位、保留原始证据，并给出修复候选。',
  },
  {
    id: 'recovery',
    label: 'recovery / retry',
    priorityShift: 1,
    acceptance: '恢复时复用目标和 source anchors，重试成本、route 和风险可见。',
  },
  {
    id: 'proof',
    label: 'proof / release evidence',
    priorityShift: 2,
    acceptance: '完成后有 source/test/live/raw/cost/cache evidence，未达成项降级为 roadmap。',
  },
]

function priorityFor(area: MechanismArea, phase: PhasePattern): Priority {
  const baseIndex = PRIORITY_ORDER.indexOf(area.basePriority)
  return PRIORITY_ORDER[Math.min(2, baseIndex + phase.priorityShift)] ?? 'P2'
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function buildRows(): ScenarioRow[] {
  const rows: ScenarioRow[] = []
  let counter = 1
  for (const area of AREAS) {
    for (const role of ROLES) {
      for (const phase of PHASES) {
        const id = `RSB-${String(counter).padStart(4, '0')}`
        rows.push({
          id,
          priority: priorityFor(area, phase),
          mechanismArea: area.label,
          mechanismClass: area.mechanismClass,
          role: role.label,
          phase: phase.label,
          title: `${area.label} for ${role.label} during ${phase.label}`,
          dsxuOwner: area.dsxuOwner,
          value: `${area.value} 角色侧重点：${role.focus}`,
          deepseekAdaptation: area.deepseekAdaptation,
          implementationBoundary: area.boundary,
          acceptanceEvidence: phase.acceptance,
        })
        counter += 1
      }
    }
  }
  return rows
}

function buildMarkdown(rows: ScenarioRow[]): string {
  const byPriority = rows.reduce<Record<Priority, number>>(
    (acc, row) => {
      acc[row.priority] += 1
      return acc
    },
    { P0: 0, P1: 0, P2: 0 },
  )
  const byClass = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.mechanismClass] = (acc[row.mechanismClass] ?? 0) + 1
    return acc
  }, {})

  const lines = [
    '# DSXU Reference Scenario Backlog - 2026-05-16',
    '',
    'This backlog expands reference-source mechanism absorption into 1000 DSXU-owned scenario candidates. It is a candidate pool, not a feature-complete claim.',
    '',
    'Rules:',
    '- Do not copy reference product code, prompt text, branding, or commercial behavior.',
    '- Merge equivalent behavior into existing DSXU owners; do not create a second runtime.',
    '- Public claims require DSXU source/test/live/raw/cost/cache evidence.',
    '- DeepSeek route remains Flash-first; Pro requires explicit admission evidence.',
    '',
    `Summary: total=${rows.length}, P0=${byPriority.P0}, P1=${byPriority.P1}, P2=${byPriority.P2}.`,
    '',
    '| mechanism class | rows |',
    '|---|---:|',
    ...Object.entries(byClass)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '| id | priority | mechanism area | role | phase | DSXU owner | acceptance evidence |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      row =>
        `| ${row.id} | ${row.priority} | ${row.mechanismArea} | ${row.role} | ${row.phase} | ${row.dsxuOwner} | ${row.acceptanceEvidence} |`,
    ),
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const rows = buildRows()
  if (rows.length !== 1000) {
    throw new Error(`Expected 1000 scenario rows, got ${rows.length}`)
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  const summary = {
    schemaVersion: 'dsxu.reference-scenario-backlog.v1',
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    areas: AREAS.length,
    roles: ROLES.length,
    phases: PHASES.length,
    priorityCounts: rows.reduce<Record<Priority, number>>(
      (acc, row) => {
        acc[row.priority] += 1
        return acc
      },
      { P0: 0, P1: 0, P2: 0 },
    ),
    decision:
      '1000 rows are structured candidate scenarios for DSXU-owned mechanism absorption. They are not completion claims and must be filtered through owner, evidence, and release gates before implementation.',
  }

  await writeFile(OUT_JSON, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8')
  const csvHeader = [
    'id',
    'priority',
    'mechanismArea',
    'mechanismClass',
    'role',
    'phase',
    'title',
    'dsxuOwner',
    'value',
    'deepseekAdaptation',
    'implementationBoundary',
    'acceptanceEvidence',
  ]
  const csv = [
    csvHeader.join(','),
    ...rows.map(row => csvHeader.map(key => csvCell(row[key as keyof ScenarioRow])).join(',')),
  ].join('\n')
  await writeFile(OUT_CSV, `${csv}\n`, 'utf8')
  await writeFile(OUT_MD, buildMarkdown(rows), 'utf8')

  console.log('PASS_DSXU_REFERENCE_SCENARIO_BACKLOG_GENERATED')
  console.log(`totalRows=${rows.length}`)
  console.log(`priorityCounts=${JSON.stringify(summary.priorityCounts)}`)
  console.log(`json=${OUT_JSON}`)
  console.log(`markdown=${OUT_MD}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
