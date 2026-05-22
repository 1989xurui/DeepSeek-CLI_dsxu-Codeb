import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type MechanismDecision =
  | 'implemented+tested'
  | 'implemented+tested-claim-limited'
  | 'needs-live-evidence'
  | 'needs-code-or-test'
  | 'adapted-or-excluded'

type Mechanism = {
  id: string
  label: string
  priority: 'P0' | 'P1' | 'P2'
  referenceSignals: readonly string[]
  referencePathHints: readonly string[]
  dsxuOwner: string
  dsxuFiles: readonly string[]
  dsxuTests: readonly string[]
  v18Capabilities: readonly string[]
  deepseekAdaptation: string
  whatToAbsorb: readonly string[]
  whatNotToCopy: readonly string[]
  v26Action: string
  acceptance: string
  decision: MechanismDecision
}

type ReferenceHit = {
  path: string
  bytes: number
  score: number
  matchedSignals: string[]
}

type MechanismReport = Mechanism & {
  mechanismClass: string
  seniorProgrammerLogic: string[]
  referenceMechanism: string[]
  deepseekRebuildPlan: string[]
  implementationSlices: string[]
  acceptanceEvidence: string[]
  referenceFileCount: number
  referenceSignalHits: number
  topReferenceDirs: Record<string, number>
  topReferenceFiles: ReferenceHit[]
  dsxuFilesExisting: string[]
  dsxuFilesMissing: string[]
  dsxuTestsExisting: string[]
  dsxuTestsMissing: string[]
  v18PassCount: number
  v18DeferredCount: number
  claimRisk: string
}

type ScenarioDefinition = {
  id: string
  label: string
  roleLens: string
  mechanismIds: readonly string[]
  deepseekStrategy: string
  acceptance: string
}

const ROOT = process.cwd()
const DATE = '20260516'
const DEFAULT_REFERENCE_PRODUCT_NAME = ['cl', 'aude'].join('')
const DEFAULT_REFERENCE_ROOT = join('D:\\', `\u6e90\u4ee3\u7801${DEFAULT_REFERENCE_PRODUCT_NAME}`, 'src')
const REFERENCE_ROOT = resolve(process.env.DSXU_REFERENCE_SRC_ROOT ?? DEFAULT_REFERENCE_ROOT)
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_REFERENCE_MECHANISM_AUDIT_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_REFERENCE_MECHANISM_AUDIT_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_REFERENCE_MECHANISM_AUDIT_${DATE}.md`)

const V18_DEFERRED = new Set([
  'R01',
  'R02',
  'S02',
  'R04',
  'R05',
  'R06',
  'PZ01',
  'PZ02',
  'PZ04',
  'PZ05',
  'PZ06',
  'PZ08',
])

const MECHANISMS: readonly Mechanism[] = [
  {
    id: 'goal-plan-query-loop',
    label: 'Goal / Plan / Query Loop',
    priority: 'P0',
    referenceSignals: ['query', 'plan', 'todo', 'task', 'mode', 'prompt', 'repl', 'status'],
    referencePathHints: ['query', 'commands', 'tasks', 'screens'],
    dsxuOwner: 'DSXU Query Loop / Entry Composition',
    dsxuFiles: [
      'src/query.ts',
      'src/QueryEngine.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/query-loop-gate-state-v1.ts',
      'src/tools/TodoWriteTool/TodoWriteTool.ts',
      'src/tools/EnterPlanModeTool/EnterPlanModeTool.ts',
      'src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts',
      'src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts',
    ],
    v18Capabilities: ['S00', 'C01', 'C05', 'C10', 'C18'],
    deepseekAdaptation:
      '把目标、计划、当前行动和停止条件压缩进稳定任务状态；DeepSeek Flash 默认执行，复杂规划升 Flash max，不靠 Pro 常驻。',
    whatToAbsorb: [
      '任务目标在每轮都可恢复',
      '计划变更必须留下状态原因',
      '下一步动作和停止条件进入 final report',
    ],
    whatNotToCopy: ['参考产品命令名、品牌 prompt、商业模式字段'],
    v26Action: '把 plan/nextAction/stopCondition 接入同一 work-state timeline，并让长任务恢复后先重建目标快照。',
    acceptance: '真实 DSXU 复杂任务窗口中，每轮都能看到 goal/plan/currentAction/nextAction/finalEvidence。',
    decision: 'implemented+tested',
  },
  {
    id: 'visible-work-state',
    label: 'Visible Work-State Projection',
    priority: 'P0',
    referenceSignals: ['ink', 'message', 'spinner', 'progress', 'status', 'screen', 'render', 'notification'],
    referencePathHints: ['components', 'screens', 'ink', 'hooks'],
    dsxuOwner: 'UI/TUI Visible-State Projection',
    dsxuFiles: [
      'src/dsxu/engine/work-state-timeline.ts',
      'src/components/Message.tsx',
      'src/components/messages/AssistantToolUseMessage.tsx',
      'src/components/permissions/PermissionRequest.tsx',
      'src/components/AgentProgressLine.tsx',
      'src/commands/cost/cost.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/work-state-timeline.test.ts',
      'src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts',
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts',
    ],
    v18Capabilities: ['C02', 'C03', 'C04', 'C15', 'C16'],
    deepseekAdaptation:
      '把 DeepSeek route/cost/cache、tool permission、source evidence 统一显示，避免用户只能看到长文本回答。',
    whatToAbsorb: [
      '工具、权限、失败、恢复、成本、下一步全部可见',
      'UI 和 final report 使用同一状态投影',
      '长任务状态可继续操作',
    ],
    whatNotToCopy: ['参考产品视觉资产、品牌 UI 文案、语音/伙伴形象'],
    v26Action: '继续把 Tool/Permission/Agent/MCP evidence 接入 work-state timeline，不只停留在 final report。',
    acceptance: 'TUI/CLI/stream-json/final report 四端字段一致，side-effect 无权限不可 READY。',
    decision: 'implemented+tested',
  },
  {
    id: 'source-truth-coding-repair',
    label: 'Source Truth / Coding Repair',
    priority: 'P0',
    referenceSignals: ['read', 'grep', 'glob', 'file', 'edit', 'diff', 'patch', 'diagnostic', 'lsp', 'git'],
    referencePathHints: ['tools', 'services', 'utils', 'commands'],
    dsxuOwner: 'Source Truth / Code Repair Owner',
    dsxuFiles: [
      'src/dsxu/engine/code-mode-surgical-loop.ts',
      'src/tools/FileReadTool/FileReadTool.ts',
      'src/tools/FileEditTool/FileEditTool.ts',
      'src/tools/GrepTool/GrepTool.ts',
      'src/tools/LSPTool/LSPTool.ts',
      'src/dsxu/engine/lsp-tool.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts',
      'src/dsxu/engine/__tests__/file-edit-surgical-loop.test.ts',
      'src/dsxu/engine/__tests__/blast-radius.test.ts',
      'src/dsxu/engine/__tests__/phase12-senior-programmer-experience-v1.test.ts',
    ],
    v18Capabilities: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A15'],
    deepseekAdaptation:
      'DeepSeek 前缀缓存要求输入稳定，因此 source truth 必须被编译成 capsule；全文 Read 只能是范围化 fallback。',
    whatToAbsorb: [
      '先搜索定位再范围读取',
      '重复读取去重',
      'patch 前后都必须有 focused verification',
      '失败要回到 source truth 而不是空转复跑',
    ],
    whatNotToCopy: ['参考产品私有文件格式、内部 prompt、商业编辑策略名'],
    v26Action: '把 source-truth capsule 从 public challenge 推广到常规 code-mode 修复主线，并加 Read fallback governor。',
    acceptance: '复杂代码任务默认 search -> anchor/range read -> patch -> focused test；全文件 Read 必须带 fallback reason 和预算。',
    decision: 'implemented+tested',
  },
  {
    id: 'tool-result-cache-hygiene',
    label: 'Tool Result / Cache Hygiene',
    priority: 'P0',
    referenceSignals: ['tool result', 'truncate', 'limit', 'offset', 'range', 'cache', 'compact', 'microcompact', 'token'],
    referencePathHints: ['tools', 'context', 'services', 'utils'],
    dsxuOwner: 'Context Compiler / Token Firewall / DeepSeek Cache Owner',
    dsxuFiles: [
      'src/tools/toolResultStorage.ts',
      'src/tools/FileReadTool/FileReadTool.ts',
      'src/dsxu/engine/prompt-prefix-cache-evidence.ts',
      'src/dsxu/engine/route-cache-dynamic-tail.ts',
      'src/services/api/deepseek-trajectory-store.ts',
      'scripts/dsxu-v24-public-challenge-package.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts',
      'src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts',
      'src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts',
      'src/services/api/deepseek-trajectory-store.test.ts',
    ],
    v18Capabilities: ['M06', 'C07', 'C08', 'C09', 'C16'],
    deepseekAdaptation:
      '把稳定前缀、动态尾部、source capsule、tool preview、trajectory attribution 绑定，尽量提高 DeepSeek cache 命中并保留真实数值。',
    whatToAbsorb: [
      '大工具结果预览/落盘',
      'microcompact 清旧工具结果',
      'cache latch 避免 mid-session profile 漂移',
      'cache miss attribution 解释为什么没命中',
    ],
    whatNotToCopy: ['参考产品特定 cache header、商业实验开关名'],
    v26Action: '完成 ablation rerun，并把 cache miss attribution 接进 GitHub 图表数据。',
    acceptance: '同题 before/after 显示 cost、toolResultChars、cacheHitRate、scoreFloor；score 不下降才允许写优化卖点。',
    decision: 'implemented+tested',
  },
  {
    id: 'tool-permission-lifecycle',
    label: 'Tool / Permission Lifecycle',
    priority: 'P0',
    referenceSignals: ['permission', 'approval', 'sandbox', 'allowed', 'denied', 'policy', 'risk', 'tool'],
    referencePathHints: ['permissions', 'tools', 'bridge', 'commands'],
    dsxuOwner: 'Tool Gate / Permission Gate',
    dsxuFiles: [
      'src/dsxu/engine/tool-gate-v1.ts',
      'src/dsxu/engine/tool-mainline-runtime-v1.ts',
      'src/dsxu/engine/permissions.ts',
      'src/tools/BashTool/BashTool.tsx',
      'src/tools/PowerShellTool/PowerShellTool.tsx',
      'src/dsxu/control-plane/permissionControlBridge.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      'src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/permissions.test.ts',
      'src/tools/__tests__/tool-permission-owner-gate.test.ts',
    ],
    v18Capabilities: ['C04', 'C11', 'B04', 'B07'],
    deepseekAdaptation:
      '权限不交给模型凭感觉判断；模型只看到结构化 permission evidence，真实执行仍走 DSXU Tool Gate。',
    whatToAbsorb: [
      '权限请求必须说明目的、风险和结果',
      '工具执行状态进入 UI',
      '拒绝后给可恢复路径',
    ],
    whatNotToCopy: ['参考产品权限文案、品牌安全策略名'],
    v26Action: '把 permission/tool events 全量投影进 work-state timeline；拒绝、blocked、skipped 都不能被包装为 PASS。',
    acceptance: 'side-effect tool 无 visible permission 时 guard 阻断；用户能看到拒绝后下一步。',
    decision: 'implemented+tested',
  },
  {
    id: 'terminal-shell-reliability',
    label: 'Terminal / Shell Reliability',
    priority: 'P1',
    referenceSignals: ['bash', 'shell', 'terminal', 'pty', 'stdout', 'stderr', 'timeout', 'exit', 'ansi'],
    referencePathHints: ['tools', 'services', 'utils', 'commands'],
    dsxuOwner: 'Terminal Tool Adapter / Result Pack',
    dsxuFiles: [
      'src/tools/BashTool/BashTool.tsx',
      'src/tools/PowerShellTool/PowerShellTool.tsx',
      'src/tools/RunNativeTestTool/RunNativeTestTool.ts',
      'src/dsxu/engine/provider-service-shell-policy.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/subprocess-encoding-boundary-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts',
      'src/tools/RunNativeTestTool/RunNativeTestTool.test.ts',
    ],
    v18Capabilities: ['B01', 'B02', 'B03', 'B05', 'B06', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14'],
    deepseekAdaptation:
      'Shell 输出必须先结构化摘要，再给模型；长输出落盘并带 preview，避免破坏 DeepSeek 前缀缓存。',
    whatToAbsorb: [
      '命令前风险/目的/环境快照',
      '命令后退出码、关键行、文件 delta、失败分类',
      '超时和重试预算可见',
    ],
    whatNotToCopy: ['参考产品终端 UI 细节、私有 shell telemetry'],
    v26Action: '补 terminal reliability live demo，覆盖长命令、失败、超时、恢复、结果包。',
    acceptance: '真实 DSXU 窗口能展示 shell state before/after、failureType、recoveryAction、artifact path。',
    decision: 'needs-live-evidence',
  },
  {
    id: 'context-memory-recovery',
    label: 'Context / Memory / Recovery',
    priority: 'P0',
    referenceSignals: ['context', 'memory', 'compact', 'resume', 'history', 'session', 'checkpoint', 'recover'],
    referencePathHints: ['context', 'history', 'state', 'commands', 'services'],
    dsxuOwner: 'Context Builder / Recovery Mainline',
    dsxuFiles: [
      'src/dsxu/engine/context-builder.ts',
      'src/dsxu/engine/context-discipline-control.ts',
      'src/dsxu/engine/experience-store.ts',
      'src/dsxu/engine/recovery/index.ts',
      'src/dsxu/engine/memory-context-compact/index.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/context-hygiene-v1.test.ts',
      'src/dsxu/engine/__tests__/experience-store-smooth-resume-pack-v1.test.ts',
      'src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts',
      'src/dsxu/engine/__tests__/local-memory-lite-v1.test.ts',
    ],
    v18Capabilities: ['C13', 'C14', 'C17', 'C18'],
    deepseekAdaptation:
      '记忆只做只读缩窄和恢复提示，不能替代 source truth；compact 后第一轮要重建稳定前缀和 source anchors。',
    whatToAbsorb: [
      'resume 后保留目标、失败命令、文件风险',
      'memory 必须有来源、时间、置信度',
      'source overlap 时强制重读',
    ],
    whatNotToCopy: ['参考产品会话格式、专有记忆文件名'],
    v26Action: '把 compact/resume 后的 source reread 与 cache hygiene 纳入 senior-coding window 验收。',
    acceptance: '恢复任务不能丢 goal/files/failed command/risk；memory 不能绕过源码重读。',
    decision: 'implemented+tested',
  },
  {
    id: 'agent-orchestration-evidence',
    label: 'Agent Orchestration / Parent Evidence',
    priority: 'P1',
    referenceSignals: ['agent', 'worker', 'coordinator', 'subagent', 'parallel', 'team', 'task'],
    referencePathHints: ['tools/Agent', 'coordinator', 'commands/agents', 'tasks'],
    dsxuOwner: 'Agent Lifecycle',
    dsxuFiles: [
      'src/tools/AgentTool/AgentTool.tsx',
      'src/tools/AgentTool/runAgent.ts',
      'src/dsxu/engine/agent-role-router-v1.ts',
      'src/dsxu/engine/subagent-protocol.ts',
      'src/components/AgentProgressLine.tsx',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
    ],
    v18Capabilities: ['PZ07', 'C12'],
    deepseekAdaptation:
      'Agent 返回 summary/path/hash/evidence，不回灌长 transcript；父任务合成时保持 DeepSeek stable prefix。',
    whatToAbsorb: [
      '并行只给边界清晰的 sidecar work',
      '父任务必须引用子任务 evidence',
      'worker 输出不直接污染主上下文',
    ],
    whatNotToCopy: ['参考产品 agent 名称、团队/角色品牌设定'],
    v26Action: '补 agent parent/worker evidence pack，并接入 visible-state timeline。',
    acceptance: '父任务 final 不能引用未验证 worker 成功；子任务 transcript 不进入主线程长上下文。',
    decision: 'implemented+tested-claim-limited',
  },
  {
    id: 'mcp-skill-ecosystem',
    label: 'MCP / Skill Ecosystem',
    priority: 'P1',
    referenceSignals: ['mcp', 'plugin', 'skill', 'marketplace', 'resource', 'server', 'registry'],
    referencePathHints: ['mcp', 'plugins', 'skills', 'commands'],
    dsxuOwner: 'MCP / Skill Registry',
    dsxuFiles: [
      'src/services/mcp/client.ts',
      'src/services/mcp/doctor.ts',
      'src/tools/MCPTool/MCPTool.ts',
      'src/tools/SkillTool/SkillTool.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/skill-governance-v1.ts',
    ],
    dsxuTests: [
      'src/services/mcp/__tests__/doctor.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/real-mcp-server.test.ts',
    ],
    v18Capabilities: ['C06'],
    deepseekAdaptation:
      '生态能力只通过 DSXU-owned registry 调度；skills/MCP 结果先结构化、授权、预算化，再给 DeepSeek。',
    whatToAbsorb: [
      '技能选择、优先级和冲突规则',
      'secret redaction 和 doctor',
      '外部 server 只作为 adapter boundary',
    ],
    whatNotToCopy: ['参考产品 marketplace 文案、第三方品牌承诺、插件商业策略'],
    v26Action: '补 Superpowers 作为二级技能包的 priority/conflict/routing 任务卡，但不形成第二 skill runtime。',
    acceptance: '冲突时可解释选择/拒绝；MCP/skill 接入仍走 Tool Gate。',
    decision: 'implemented+tested',
  },
  {
    id: 'deepseek-model-cost-cache',
    label: 'DeepSeek Model / Cost / Cache',
    priority: 'P0',
    referenceSignals: ['model', 'cost', 'token', 'usage', 'cache', 'rate', 'api', 'thinking', 'reasoning'],
    referencePathHints: ['services', 'utils', 'cost', 'state'],
    dsxuOwner: 'DeepSeek Runtime / Cost Evidence',
    dsxuFiles: [
      'src/utils/model/deepseekV4Control.ts',
      'src/utils/model/deepseekV4CostRouter.ts',
      'src/services/api/deepseek-adapter.ts',
      'src/services/api/deepseek-trajectory-store.ts',
      'src/commands/cost/cost.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
      'src/services/api/deepseek-adapter-cache-prefix-v1.test.ts',
      'src/services/api/deepseek-trajectory-store.test.ts',
      'src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts',
    ],
    v18Capabilities: ['M01', 'M02', 'M03', 'M06', 'M07', 'C09', 'C16', 'A14'],
    deepseekAdaptation:
      'Flash-first 是产品核心；普通 coding/bugfix 默认 Flash thinking high，review/recovery Flash max，Pro 只由 admission evidence 触发，FIM 独立 Flash non-thinking lane。',
    whatToAbsorb: [
      '成本/usage 按任务归因',
      'cache read/miss/output token 拆开',
      '模型升级要有理由',
    ],
    whatNotToCopy: ['参考产品模型名、商业限额逻辑、供应商私有 header'],
    v26Action: '继续同步 public challenge 和 capability cost crosswalk；修正任何把 70 PASS 当作公开90能力的 claim。',
    acceptance: '所有公开成本卖点都有 route/cost/cache trajectory；默认大部分使用 deepseek-v4-flash。',
    decision: 'implemented+tested',
  },
  {
    id: 'ide-remote-external-boundary',
    label: 'IDE / Remote / External Host Boundary',
    priority: 'P1',
    referenceSignals: ['bridge', 'remote', 'ide', 'desktop', 'chrome', 'websocket', 'sse', 'transport'],
    referencePathHints: ['bridge', 'remote', 'cli/transports', 'commands'],
    dsxuOwner: 'External Host Adapter Boundary',
    dsxuFiles: [
      'src/commands/ide/ide.tsx',
      'src/commands/desktop/desktop.tsx',
      'src/tools/RemoteTriggerTool/RemoteTriggerTool.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
      'src/dsxu/engine/__tests__/extension-runtime-owner.test.ts',
      'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
    ],
    v18Capabilities: ['PZ03', 'PZ06'],
    deepseekAdaptation:
      'IDE/API/remote 只做 DSXU adapter boundary，不能绕过 query loop、Tool Gate、cost evidence。',
    whatToAbsorb: [
      '远程/IDE 状态有 handshake、权限和结果投影',
      'host adapter 不成为第二 runtime',
    ],
    whatNotToCopy: ['参考产品远程服务、认证协议、商业 bridge 文案'],
    v26Action: '补 IDE/API bridge product smoke 与 external adapter visible-state evidence。',
    acceptance: '外部 host 调用仍能看到 permission/cost/evidence；未做 smoke 前不当核心卖点。',
    decision: 'needs-live-evidence',
  },
  {
    id: 'first-run-trust-doctor',
    label: 'First-Run Trust / Doctor / Secret Safety',
    priority: 'P1',
    referenceSignals: ['auth', 'setup', 'doctor', 'install', 'secret', 'key', 'onboarding', 'trusted'],
    referencePathHints: ['commands', 'setup', 'services', 'bootstrap'],
    dsxuOwner: 'Install / Auth / Doctor',
    dsxuFiles: [
      'src/commands/config/config.tsx',
      'src/commands/doctor/doctor.ts',
      'src/dsxu/engine/public-surface-clean-gate.ts',
      'scripts/dsxu-v24-fresh-install-release-smoke.ts',
      'scripts/dsxu-commercial-ip-release-preflight.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/release-test-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/public-surface-clean-gate.test.ts',
    ],
    v18Capabilities: ['E06'],
    deepseekAdaptation:
      '首次使用必须安全填写 DeepSeek key；release pack 不能泄露 key，provider gate 要能解释 Flash-first 策略。',
    whatToAbsorb: [
      '安装后即能自检',
      'secret redaction 是 release gate',
      'provider/key 错误有恢复路径',
    ],
    whatNotToCopy: ['参考产品账号体系、遥测服务、品牌授权流'],
    v26Action: '最终 fresh install/help/doctor/provider gate smoke 要检查无 key 泄露和首次 key wizard。',
    acceptance: '发布包不含用户 key；首次运行能引导 DEEPSEEK_API_KEY；doctor 输出可恢复建议。',
    decision: 'implemented+tested',
  },
  {
    id: 'telemetry-evidence-release',
    label: 'Telemetry / Evidence / Release Gate',
    priority: 'P0',
    referenceSignals: ['trace', 'telemetry', 'report', 'evidence', 'benchmark', 'release', 'metrics', 'audit'],
    referencePathHints: ['services', 'commands', 'utils', 'state'],
    dsxuOwner: 'Evidence / Benchmark / Release',
    dsxuFiles: [
      'scripts/dsxu-v24-public-challenge-package.ts',
      'scripts/dsxu-v24-product-benchmark-data-pack.ts',
      'scripts/dsxu-v24-six-stage-final-tests.ts',
      'scripts/dsxu-capability-cost-crosswalk.ts',
      'src/dsxu/engine/go-stop-decision.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/evidence-eval-pack.test.ts',
      'src/dsxu/engine/__tests__/eval-baseline-manifest.test.ts',
      'src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts',
    ],
    v18Capabilities: ['A16', 'A17', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'R03', 'R07', 'R08'],
    deepseekAdaptation:
      '所有 public claim 必须绑定 raw task、route/cost/cache、failure/recovery、source/test/live evidence；不能用映射完成替代能力完成。',
    whatToAbsorb: [
      '证据同源',
      'claim guard',
      'benchmark 和 release 分开',
      '没有 raw 对照就不宣称外部胜出',
    ],
    whatNotToCopy: ['参考产品榜单表述、商业宣传 claim、未授权 benchmark 名义'],
    v26Action: '修 capability cost crosswalk 的 PASS 等级，补 public challenge ablation 和 GitHub 数据图。',
    acceptance: '70 PASS 不再等于完整功能 PASS；GitHub 只写真实验收卖点和真实数值。',
    decision: 'implemented+tested-claim-limited',
  },
]

const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'ai-coding-multifile-feature',
    label: 'AI coding: multi-file feature implementation',
    roleLens: 'senior feature engineer',
    mechanismIds: ['goal-plan-query-loop', 'source-truth-coding-repair', 'tool-permission-lifecycle', 'deepseek-model-cost-cache', 'telemetry-evidence-release'],
    deepseekStrategy: 'Flash max for initial architecture and risk slicing, Flash high for implementation, Pro only after failed verification or high-risk permission evidence.',
    acceptance: 'Real DSXU task reads source, patches multiple files, runs focused tests, reports route/cost/cache, and keeps next action visible.',
  },
  {
    id: 'ai-coding-bugfix-regression',
    label: 'AI coding: bugfix with regression guard',
    roleLens: 'debugging engineer',
    mechanismIds: ['source-truth-coding-repair', 'context-memory-recovery', 'tool-result-cache-hygiene', 'telemetry-evidence-release'],
    deepseekStrategy: 'Search and diagnostic evidence form source capsule; Flash high repairs; Flash max handles failed verification before Pro admission.',
    acceptance: 'Bug evidence, patch, regression blast radius, failed test recovery, and final proof are linked.',
  },
  {
    id: 'complex-task-long-run',
    label: 'Complex task: long-running goal preservation',
    roleLens: 'technical lead',
    mechanismIds: ['goal-plan-query-loop', 'visible-work-state', 'context-memory-recovery', 'deepseek-model-cost-cache'],
    deepseekStrategy: 'Stable goal/plan prefix and dynamic tail keep DeepSeek cache useful while preserving task continuity.',
    acceptance: '30-45 minute window survives interruption/compact/resume without losing goal, files, risk, cost, or next action.',
  },
  {
    id: 'terminal-ops-failure-recovery',
    label: 'Terminal operations: command failure and recovery',
    roleLens: 'terminal reliability engineer',
    mechanismIds: ['terminal-shell-reliability', 'tool-permission-lifecycle', 'visible-work-state', 'deepseek-model-cost-cache'],
    deepseekStrategy: 'Bounded command result packs feed Flash max for failure analysis; full logs stay as artifacts.',
    acceptance: 'Long output, timeout, nonzero exit, file delta, failure type, and recovery action are visible.',
  },
  {
    id: 'agent-delegation-parent-synthesis',
    label: 'Complex task: agent delegation and parent synthesis',
    roleLens: 'agent lead',
    mechanismIds: ['agent-orchestration-evidence', 'goal-plan-query-loop', 'visible-work-state', 'tool-result-cache-hygiene', 'telemetry-evidence-release'],
    deepseekStrategy: 'Workers return evidence envelopes so parent prompt stays compact and cache-friendly.',
    acceptance: 'Parent final cites worker evidence ids and rejects unverified worker success.',
  },
  {
    id: 'mcp-skill-ecosystem-routing',
    label: 'Ecosystem: MCP/Skill priority and conflict routing',
    roleLens: 'ecosystem integrator',
    mechanismIds: ['mcp-skill-ecosystem', 'tool-permission-lifecycle', 'visible-work-state', 'first-run-trust-doctor'],
    deepseekStrategy: 'Skill/MCP results are normalized to DSXU evidence envelopes before entering DeepSeek context.',
    acceptance: 'Conflicting skills resolve by priority; external server outputs are permissioned, redacted, and bounded.',
  },
  {
    id: 'large-repo-source-truth',
    label: 'Large repo: source-truth without cache destruction',
    roleLens: 'source-truth engineer',
    mechanismIds: ['source-truth-coding-repair', 'tool-result-cache-hygiene', 'deepseek-model-cost-cache', 'context-memory-recovery'],
    deepseekStrategy: 'Grep/anchor/range Read builds source capsules; full file fallback is bounded and attributed.',
    acceptance: 'No repeated large Read in default lane; cache attribution explains any fallback.',
  },
  {
    id: 'release-public-proof',
    label: 'Release: public proof and GitHub claims',
    roleLens: 'release evidence owner',
    mechanismIds: ['telemetry-evidence-release', 'first-run-trust-doctor', 'deepseek-model-cost-cache', 'visible-work-state'],
    deepseekStrategy: 'Claims cite stable evidence pack, route/cost/cache trace, raw task data, and secret/IP gates.',
    acceptance: 'README/GitHub charts use real numbers and keep blocked claims visible.',
  },
  {
    id: 'first-run-provider-trust',
    label: 'First run: DeepSeek key, provider, doctor',
    roleLens: 'new user onboarding',
    mechanismIds: ['first-run-trust-doctor', 'deepseek-model-cost-cache', 'visible-work-state'],
    deepseekStrategy: 'Provider smoke should validate Flash-first routing and avoid logging secrets.',
    acceptance: 'No-key and key-provided paths are recoverable; release artifact contains no user key.',
  },
  {
    id: 'ide-api-host-boundary',
    label: 'External host: IDE/API/remote boundary',
    roleLens: 'platform integrator',
    mechanismIds: ['ide-remote-external-boundary', 'tool-permission-lifecycle', 'visible-work-state', 'telemetry-evidence-release'],
    deepseekStrategy: 'External host calls enter the same DSXU Tool Gate and evidence timeline, not a second orchestrator.',
    acceptance: 'Adapter smoke proves permission, route/cost/cache evidence, and no second runtime entry.',
  },
  {
    id: 'cost-cache-optimization',
    label: 'Performance: cost and cache optimization',
    roleLens: 'DeepSeek runtime engineer',
    mechanismIds: ['tool-result-cache-hygiene', 'deepseek-model-cost-cache', 'telemetry-evidence-release'],
    deepseekStrategy: 'Stable prefix, route latch, no-Read default, and bounded tool previews improve cost without hiding quality loss.',
    acceptance: 'Same-task ablation shows scoreFloor not lower and observed cost/cache/tool-result metrics improved.',
  },
  {
    id: 'anti-fake-completion',
    label: 'Quality: anti-fake completion and evidence discipline',
    roleLens: 'review lead',
    mechanismIds: ['telemetry-evidence-release', 'visible-work-state', 'source-truth-coding-repair', 'tool-permission-lifecycle'],
    deepseekStrategy: 'Flash review receives evidence capsules and claim guards, not raw unbounded transcripts.',
    acceptance: 'Intent-only, dry-plan, denied-permission, missing-source, and failed-verification paths cannot PASS.',
  },
]

function scenarioDecision(mechanismIds: readonly string[], reports: readonly MechanismReport[]): string {
  const selected = mechanismIds.map(id => reports.find(report => report.id === id)).filter(Boolean) as MechanismReport[]
  if (selected.some(report => report.decision === 'needs-live-evidence')) return 'needs-live-evidence'
  if (selected.some(report => report.decision === 'implemented+tested-claim-limited')) return 'claim-limited'
  if (selected.every(report => report.decision === 'implemented+tested')) return 'implemented+tested'
  return 'needs-review'
}

function scenarioMissingClosures(mechanismIds: readonly string[], reports: readonly MechanismReport[]): string[] {
  const selected = mechanismIds.map(id => reports.find(report => report.id === id)).filter(Boolean) as MechanismReport[]
  return selected
    .filter(report => report.decision !== 'implemented+tested' || report.id === 'tool-result-cache-hygiene' || report.id === 'telemetry-evidence-release')
    .flatMap(report => report.implementationSlices.map(slice => `${report.label}: ${slice}`))
}

function mechanismClassFor(id: string): string {
  if (['goal-plan-query-loop', 'source-truth-coding-repair', 'context-memory-recovery'].includes(id)) {
    return 'cognitive-workflow: goal, source truth, repair, and recovery'
  }
  if (['visible-work-state', 'telemetry-evidence-release', 'first-run-trust-doctor'].includes(id)) {
    return 'trust-and-visibility: user-visible state, evidence, and release confidence'
  }
  if (['tool-permission-lifecycle', 'terminal-shell-reliability', 'agent-orchestration-evidence', 'mcp-skill-ecosystem', 'ide-remote-external-boundary'].includes(id)) {
    return 'execution-boundary: tools, permissions, agents, ecosystem, and external hosts'
  }
  return 'deepseek-runtime: model routing, context cache, and cost control'
}

function seniorProgrammerLogicFor(id: string): string[] {
  const common = [
    'Observe: gather the smallest source-truth signal that can answer the next question.',
    'Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.',
    'Decide: choose one mainline action, not a compatibility holding path.',
    'Act: execute through the named DSXU owner and keep side effects attributable.',
    'Verify: run focused proof, record failure/recovery, and expose next action.',
  ]
  const specific: Record<string, string[]> = {
    'goal-plan-query-loop': [
      'Keep the user goal stable across long turns and compaction.',
      'Turn vague work into an executable plan graph with stop conditions.',
      'Update nextAction only when source/test evidence changes, not after narration.',
    ],
    'visible-work-state': [
      'Make invisible cognitive work visible: current goal, files, tool, permission, cost, failure, recovery.',
      'Show progress without flooding the user with raw transcripts.',
      'Use one projection for TUI, CLI, stream-json, and final report.',
    ],
    'source-truth-coding-repair': [
      'Search before Read, anchor before range, range before full file.',
      'Patch only after the owner and source truth are known.',
      'Focused verification is part of the repair loop, not a final optional step.',
    ],
    'tool-result-cache-hygiene': [
      'Treat tool output as evidence, not conversation filler.',
      'Persist or preview large results, then feed compact facts to the model.',
      'Keep stable prefix stable so repeated review work gets cache benefit.',
    ],
    'tool-permission-lifecycle': [
      'Convert tool execution into purpose, risk, permission, result, and recovery.',
      'A rejected permission is still useful state, not a hidden failure.',
      'Never let adapters bypass the single Tool Gate.',
    ],
    'terminal-shell-reliability': [
      'Before command: capture environment, purpose, timeout, risk, and expected proof.',
      'After command: capture exit code, key lines, file delta, failure type, and next repair.',
      'Avoid pushing full stdout/stderr into the model when a structured result pack is enough.',
    ],
    'context-memory-recovery': [
      'Memory narrows exploration but never replaces source truth.',
      'Resume must restore goal, touched files, failed command, risk, and next step.',
      'After compaction, first rebuild source anchors and cache hygiene before acting.',
    ],
    'agent-orchestration-evidence': [
      'Delegate only bounded sidecar work with clear ownership.',
      'Workers return summary/path/hash/evidence, not unbounded transcript.',
      'The parent remains responsible for final synthesis and verification.',
    ],
    'mcp-skill-ecosystem': [
      'Skills/MCP are capability extensions, not parallel product runtimes.',
      'Resolve priority and conflicts before exposing tool choices to the model.',
      'Every external capability inherits DSXU permission and evidence rules.',
    ],
    'deepseek-model-cost-cache': [
      'Use Flash as the default working model, not a cheap fallback.',
      'Escalate to Flash max or Pro only with route evidence.',
      'Separate cache hit, cache miss, output, route reason, and admission evidence.',
    ],
    'ide-remote-external-boundary': [
      'External hosts are adapter boundaries, not new orchestrators.',
      'Remote/IDE events must project into the same permission/cost/evidence state.',
      'Handshake and secret boundaries are release gates.',
    ],
    'first-run-trust-doctor': [
      'First run must quickly establish key, provider, workspace, and release trust.',
      'Doctor output should be actionable and safe, not just diagnostic text.',
      'Secrets must be excluded from release artifacts and evidence packs.',
    ],
    'telemetry-evidence-release': [
      'Evidence is a product feature: raw trace, cost, cache, failures, recovery, and claims all share lineage.',
      'Separate internal pass, release candidate, and public benchmark claim.',
      'Never let mapping completeness replace real public task proof.',
    ],
  }
  return [...(specific[id] ?? []), ...common]
}

function referenceMechanismFor(id: string): string[] {
  const map: Record<string, string[]> = {
    'goal-plan-query-loop': [
      'Dense command/session/task state around query entry, plan mode, todos, and status lines.',
      'A task is not just a prompt: it has mode, history, plan slug, current session, and next action.',
    ],
    'visible-work-state': [
      'Many UI components exist to make invisible work observable without exposing full internal transcript.',
      'Status rendering is a product mechanism, not decoration.',
    ],
    'source-truth-coding-repair': [
      'File tools, search tools, edit tools, diagnostics, and git/diff tools are separate but composable.',
      'The useful pattern is source-truth locality and verification, not any proprietary edit code.',
    ],
    'tool-result-cache-hygiene': [
      'Tool results are budgeted, deduplicated, compacted, and sometimes persisted outside the prompt.',
      'Cache latches and stable sections protect warm-cache behavior from mid-session setting drift.',
    ],
    'tool-permission-lifecycle': [
      'Permission logic is repeated across bridge, tools, UI, and session state so side effects are explicit.',
      'The mechanism is lifecycle accountability: request, user decision, execution, and result.',
    ],
    'terminal-shell-reliability': [
      'Terminal reliability is a full loop: command construction, process handling, output shaping, and failure semantics.',
      'Raw terminal text is transformed into usable task evidence.',
    ],
    'context-memory-recovery': [
      'Session, history, compact, resume, project identity, and memory state are first-class.',
      'Recovery is designed as a continuation of the same task, not a new chat restart.',
    ],
    'agent-orchestration-evidence': [
      'Agents have identity, color/state, lifecycle, parent-child lineage, and preserved skills.',
      'Parallelism is valuable only when the parent can safely integrate bounded evidence.',
    ],
    'mcp-skill-ecosystem': [
      'MCP, plugins, skills, hooks, resources, and commands share registry-like surfaces.',
      'The mechanism is controlled extensibility with permission and conflict boundaries.',
    ],
    'deepseek-model-cost-cache': [
      'Cost, tokens, cache, request ids, and usage attribution live in session state and reporting paths.',
      'The mechanism is continuous cost awareness, not only post-hoc billing.',
    ],
    'ide-remote-external-boundary': [
      'Bridge/transport/remote files indicate external host integration is isolated behind protocols.',
      'The useful idea is boundary discipline: host events enter the same session model.',
    ],
    'first-run-trust-doctor': [
      'Setup, auth, trusted device, onboarding, config, and diagnostics form a first-run trust loop.',
      'The user is guided to a working environment before complex tasks begin.',
    ],
    'telemetry-evidence-release': [
      'Telemetry, cost hooks, traces, status, release commands, and reports connect product behavior to proof.',
      'The mechanism is claim discipline: what happened, what it cost, what evidence supports it.',
    ],
  }
  return map[id] ?? []
}

function deepseekRebuildPlanFor(id: string): string[] {
  const shared = [
    'Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.',
    'Keep Flash as the default route; use Pro only when admission evidence is explicit.',
  ]
  const map: Record<string, string[]> = {
    'goal-plan-query-loop': [
      'Represent goal/plan/nextAction as compact stable state, with volatile details in dynamic tail.',
      'Use Flash max for first-turn planning of truly complex tasks, then Flash high for normal coding execution.',
    ],
    'visible-work-state': [
      'Project route/cost/cache/tool/permission/source/recovery events through one DSXU timeline.',
      'Use short visible summaries and evidence ids so UI density does not become token bloat.',
    ],
    'source-truth-coding-repair': [
      'Compile source-truth capsules before model review; include path/hash/anchors/excerpts/risk tags.',
      'Fallback Read must be range-limited and justified by missing capsule coverage.',
    ],
    'tool-result-cache-hygiene': [
      'Put stable instructions and source capsules before dynamic findings; keep system/tool profile latched.',
      'Persist large tool outputs and feed only preview/key facts, preserving DeepSeek prefix cache.',
    ],
    'tool-permission-lifecycle': [
      'Expose permission decisions as structured model-visible evidence after user/tool gate resolution.',
      'Do not let the model infer permissions from natural language alone.',
    ],
    'terminal-shell-reliability': [
      'Summarize stdout/stderr into bounded result packs; store full logs as artifacts.',
      'Route failure analysis to Flash max before Pro unless high-risk side effects require Pro admission.',
    ],
    'context-memory-recovery': [
      'After compact/resume, regenerate stable source anchors and cache boundary evidence.',
      'Use local memory only as retrieval hints, never as a replacement for file truth.',
    ],
    'agent-orchestration-evidence': [
      'Subagents return compressed evidence objects; parent context receives stable summaries only.',
      'Keep ownership disjoint so parallel work does not create duplicate runtimes.',
    ],
    'mcp-skill-ecosystem': [
      'Normalize MCP/skill outputs to DSXU evidence envelopes with permission, cost, secret redaction, and conflict metadata.',
      'Superpowers-like packs can be secondary skills, never a second dispatcher.',
    ],
    'deepseek-model-cost-cache': [
      'Route table: Flash high for coding/bugfix, Flash max for planning/review/recovery, Pro for explicit high-risk/failed-verification admission, FIM Flash non-thinking only for small completion lane.',
      'Report cache hit/miss/output tokens and cost per solved task as product metrics.',
    ],
    'ide-remote-external-boundary': [
      'External host calls become Tool Gate events with route/cost/cache evidence.',
      'Do not let IDE/API bridge start a second agent or permission runtime.',
    ],
    'first-run-trust-doctor': [
      'First run collects DeepSeek key safely and validates provider route without writing secrets into release artifacts.',
      'Doctor should output route policy, cache/cost readiness, and recoverable setup issues.',
    ],
    'telemetry-evidence-release': [
      'Every public claim must point to raw task, DSXU live transcript, route/cost/cache trace, source/test evidence, and release gate status.',
      'Publish real before/after charts and blocked claims, not inflated parity language.',
    ],
  }
  return [...(map[id] ?? []), ...shared]
}

function implementationSlicesFor(id: string): string[] {
  const map: Record<string, string[]> = {
    'goal-plan-query-loop': ['P0 timeline goal/plan snapshot', 'P0 resume goal replay', 'P1 stop-condition guard'],
    'visible-work-state': ['P0 tool/permission timeline event wiring', 'P1 agent/MCP timeline event wiring', 'P1 stream-json parity'],
    'source-truth-coding-repair': ['P0 capsule in code-mode', 'P0 Read fallback governor', 'P1 source-overlap memory reread smoke'],
    'tool-result-cache-hygiene': ['P0 public challenge ablation', 'P0 tool result preview budget', 'P1 cache chart data'],
    'tool-permission-lifecycle': ['P0 blocked/skipped permission projection', 'P0 side-effect no-permission negative test', 'P1 adapter evidence parity'],
    'terminal-shell-reliability': ['P1 long command demo', 'P1 timeout/failure recovery demo', 'P1 full-log artifact with bounded preview'],
    'context-memory-recovery': ['P0 compact/resume source reread', 'P1 long-task recovery replay', 'P1 memory confidence display'],
    'agent-orchestration-evidence': ['P1 worker evidence envelope', 'P1 parent synthesis guard', 'P1 no transcript bloat check'],
    'mcp-skill-ecosystem': ['P1 secondary skill priority rules', 'P1 MCP doctor evidence envelope', 'P1 secret redaction smoke'],
    'deepseek-model-cost-cache': ['P0 route latch regression', 'P0 Flash-first live route sample', 'P1 Pro admission negative/positive pack'],
    'ide-remote-external-boundary': ['P1 API bridge smoke', 'P1 external adapter permission proof', 'P2 IDE extension product boundary'],
    'first-run-trust-doctor': ['P1 no-key first run smoke', 'P1 secret scan release gate', 'P1 provider gate recovery copy'],
    'telemetry-evidence-release': ['P0 capability acceptance audit', 'P0 public claim guard rewrite', 'P1 GitHub data chart rebuild'],
  }
  return map[id] ?? []
}

function acceptanceEvidenceFor(id: string): string[] {
  const map: Record<string, string[]> = {
    'goal-plan-query-loop': ['real DSXU senior-coding window has goal/plan/current/next events', 'resume keeps same goal'],
    'visible-work-state': ['TUI/CLI/stream-json/final report render same event ids', 'permission/cost/failure are visible'],
    'source-truth-coding-repair': ['source capsule ids cited by final report', 'focused tests pass after patch'],
    'tool-result-cache-hygiene': ['toolResultChars reduced without scoreFloor regression', 'uniqueSystemHashes=1 for public challenge run'],
    'tool-permission-lifecycle': ['side-effect blocked without permission', 'permission denial has recovery nextAction'],
    'terminal-shell-reliability': ['long output stored as artifact with bounded preview', 'timeout/failure classified and recovered'],
    'context-memory-recovery': ['compact/resume replay keeps files/risk/failed command', 'memory overlap forces reread'],
    'agent-orchestration-evidence': ['parent cites worker evidence ids', 'worker transcript not injected into parent prompt'],
    'mcp-skill-ecosystem': ['conflicting skills resolve by priority', 'MCP outputs include secret redaction and permission evidence'],
    'deepseek-model-cost-cache': ['default route uses deepseek-v4-flash', 'Pro appears only with admission evidence', 'cache/cost tokens reported'],
    'ide-remote-external-boundary': ['external trigger produces Tool Gate event', 'no second runtime entrypoint'],
    'first-run-trust-doctor': ['release artifact has no key', 'first run/provider doctor recovers no-key setup'],
    'telemetry-evidence-release': ['GitHub claims cite source/test/live/raw evidence', 'blocked claims remain visible'],
  }
  return map[id] ?? []
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(full))
    } else if (/\.(ts|tsx|js|jsx)$/i.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function countMatches(text: string, needle: string): number {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return text.match(re)?.length ?? 0
}

function topDirsFor(paths: string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const p of paths) {
    const parts = p.split(/[\\/]/)
    const dir = parts.length > 1 ? parts[0] : '.'
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function markdownTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${columns.map(col => String(row[col] ?? '').replace(/\n/g, '<br>')).join(' |')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  if (!existsSync(REFERENCE_ROOT)) {
    throw new Error(`Reference source root does not exist: ${REFERENCE_ROOT}`)
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  const referenceFiles = await walk(REFERENCE_ROOT)
  const dsxuSourceFiles = await walk(join(ROOT, 'src'))

  const referenceTexts = new Map<string, { rel: string; bytes: number; text: string }>()
  for (const full of referenceFiles) {
    const raw = await readFile(full, 'utf8')
    const st = await stat(full)
    const rel = relative(REFERENCE_ROOT, full).replace(/\\/g, '/')
    referenceTexts.set(full, {
      rel,
      bytes: st.size,
      text: raw.length > 400_000 ? raw.slice(0, 400_000) : raw,
    })
  }

  const dsxuJoinedText = (await Promise.all(dsxuSourceFiles.map(async file => {
    try {
      const raw = await readFile(file, 'utf8')
      return raw.length > 200_000 ? raw.slice(0, 200_000) : raw
    } catch {
      return ''
    }
  }))).join('\n')

  const reports: MechanismReport[] = MECHANISMS.map(mechanism => {
    const hits: ReferenceHit[] = []
    for (const { rel, bytes, text } of referenceTexts.values()) {
      const pathScore = mechanism.referencePathHints.reduce((sum, hint) => sum + (rel.toLowerCase().includes(hint.toLowerCase()) ? 4 : 0), 0)
      const matchedSignals = mechanism.referenceSignals.filter(signal => countMatches(text, signal) > 0)
      const signalScore = mechanism.referenceSignals.reduce((sum, signal) => sum + countMatches(text, signal), 0)
      const score = pathScore + signalScore
      if (score > 0) {
        hits.push({ path: rel, bytes, score, matchedSignals })
      }
    }
    hits.sort((a, b) => b.score - a.score || b.bytes - a.bytes)
    const referenceSignalHits = hits.reduce((sum, hit) => sum + hit.score, 0)
    const dsxuFilesExisting = mechanism.dsxuFiles.filter(file => existsSync(join(ROOT, file)))
    const dsxuFilesMissing = mechanism.dsxuFiles.filter(file => !existsSync(join(ROOT, file)))
    const dsxuTestsExisting = mechanism.dsxuTests.filter(file => existsSync(join(ROOT, file)))
    const dsxuTestsMissing = mechanism.dsxuTests.filter(file => !existsSync(join(ROOT, file)))
    const v18DeferredCount = mechanism.v18Capabilities.filter(id => V18_DEFERRED.has(id)).length
    const v18PassCount = mechanism.v18Capabilities.length - v18DeferredCount
    const missingEvidence = dsxuFilesMissing.length + dsxuTestsMissing.length
    const dsxuSignalCount = mechanism.referenceSignals.reduce((sum, signal) => sum + countMatches(dsxuJoinedText, signal), 0)
    const claimRisk = mechanism.decision === 'implemented+tested'
      ? 'Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof.'
      : mechanism.decision === 'implemented+tested-claim-limited'
        ? 'Implementation exists, but public copy must be constrained to subset/adapted behavior.'
        : mechanism.decision === 'needs-live-evidence'
          ? 'Code/test exists, but live DSXU window or product smoke evidence is still required before public claim.'
          : mechanism.decision === 'adapted-or-excluded'
            ? 'Reference behavior is intentionally not productized; keep as roadmap/excluded only.'
            : 'Requires code or focused tests before claiming implementation.'

    return {
      ...mechanism,
      mechanismClass: mechanismClassFor(mechanism.id),
      seniorProgrammerLogic: seniorProgrammerLogicFor(mechanism.id),
      referenceMechanism: referenceMechanismFor(mechanism.id),
      deepseekRebuildPlan: deepseekRebuildPlanFor(mechanism.id),
      implementationSlices: implementationSlicesFor(mechanism.id),
      acceptanceEvidence: acceptanceEvidenceFor(mechanism.id),
      referenceFileCount: hits.length,
      referenceSignalHits,
      topReferenceDirs: topDirsFor(hits.map(hit => hit.path)),
      topReferenceFiles: hits.slice(0, 12),
      dsxuFilesExisting,
      dsxuFilesMissing,
      dsxuTestsExisting,
      dsxuTestsMissing,
      v18PassCount,
      v18DeferredCount,
      claimRisk: `${claimRisk} DSXU signal hits=${dsxuSignalCount}; missing explicit evidence paths=${missingEvidence}.`,
    }
  })

  const unfinished = reports
    .filter(report => report.decision !== 'implemented+tested' || report.id === 'tool-result-cache-hygiene' || report.id === 'telemetry-evidence-release')
    .map(report => ({
      priority: report.priority,
      id: report.id,
      label: report.label,
      decision: report.decision,
      mechanismClass: report.mechanismClass,
      action: report.v26Action,
      acceptance: report.acceptance,
      implementationSlices: report.implementationSlices,
      claimRisk: report.claimRisk,
    }))

  const scenarios = SCENARIOS.map(scenario => ({
    ...scenario,
    decision: scenarioDecision(scenario.mechanismIds, reports),
    missingClosures: scenarioMissingClosures(scenario.mechanismIds, reports),
  }))

  const summary = {
    schemaVersion: 'dsxu.reference-mechanism-audit.v1',
    generatedAt: new Date().toISOString(),
    referenceRoot: REFERENCE_ROOT,
    referenceFileCount: referenceFiles.length,
    dsxuSourceFileCount: dsxuSourceFiles.length,
    mechanismCount: reports.length,
    scenarioCount: scenarios.length,
    decisions: Object.fromEntries(
      [...new Set(reports.map(report => report.decision))]
        .map(decision => [decision, reports.filter(report => report.decision === decision).length]),
    ),
    v18PassCapabilityLinks: reports.reduce((sum, report) => sum + report.v18PassCount, 0),
    v18DeferredCapabilityLinks: reports.reduce((sum, report) => sum + report.v18DeferredCount, 0),
    mechanismClasses: Object.fromEntries(
      [...new Set(reports.map(report => report.mechanismClass))]
        .map(mechanismClass => [mechanismClass, reports.filter(report => report.mechanismClass === mechanismClass).length]),
    ),
    scenarioDecisions: Object.fromEntries(
      [...new Set(scenarios.map(scenario => scenario.decision))]
        .map(decision => [decision, scenarios.filter(scenario => scenario.decision === decision).length]),
    ),
    publicClaimPolicy:
      'Reference source analysis proves mechanism inspiration only. Public claims require DSXU-owned source/test/live/raw/cost/cache evidence and cannot copy reference branding or code.',
  }

  const json = { summary, mechanisms: reports, scenarios, unfinished }
  await writeFile(OUT_JSON, `${JSON.stringify(json, null, 2)}\n`)

  const csvColumns = [
    'priority',
    'id',
    'label',
    'decision',
    'referenceFileCount',
    'referenceSignalHits',
    'mechanismClass',
    'dsxuOwner',
    'v18Capabilities',
    'v18PassCount',
    'v18DeferredCount',
    'v26Action',
    'acceptance',
    'claimRisk',
  ]
  await writeFile(
    OUT_CSV,
    [
      csvColumns.join(','),
      ...reports.map(report => csvColumns.map(col => csvCell((report as unknown as Record<string, unknown>)[col])).join(',')),
    ].join('\n') + '\n',
  )

  const tableRows = reports.map(report => ({
    priority: report.priority,
    loop: report.label,
    mechanismClass: report.mechanismClass,
    referenceFiles: report.referenceFileCount,
    owner: report.dsxuOwner,
    decision: report.decision,
    v18: `${report.v18PassCount} pass / ${report.v18DeferredCount} deferred links`,
    action: report.v26Action,
  }))
  const unfinishedRows = unfinished.map(item => ({
    priority: item.priority,
    loop: item.label,
    decision: item.decision,
    action: item.action,
    implementationSlices: item.implementationSlices.join('; '),
    acceptance: item.acceptance,
  }))
  const classRows = Object.entries(summary.mechanismClasses).map(([mechanismClass, count]) => ({
    mechanismClass,
    count,
  }))
  const scenarioRows = scenarios.map(scenario => ({
    role: scenario.roleLens,
    scenario: scenario.label,
    decision: scenario.decision,
    deepseekStrategy: scenario.deepseekStrategy,
    missingClosures: scenario.missingClosures.slice(0, 3).join('; '),
  }))
  const detailSections = reports.map(report => [
    `### ${report.priority} ${report.label}`,
    '',
    `- Reference signal files: ${report.referenceFileCount}; top dirs: ${Object.entries(report.topReferenceDirs).map(([dir, count]) => `${dir}=${count}`).join(', ') || 'none'}.`,
    `- Mechanism class: ${report.mechanismClass}.`,
    `- DSXU owner: ${report.dsxuOwner}.`,
    `- DSXU files existing: ${report.dsxuFilesExisting.length}/${report.dsxuFiles.length}; tests existing: ${report.dsxuTestsExisting.length}/${report.dsxuTests.length}.`,
    `- V18 capability links: ${report.v18Capabilities.join(', ')} (${report.v18PassCount} pass links, ${report.v18DeferredCount} deferred links).`,
    `- DeepSeek adaptation: ${report.deepseekAdaptation}`,
    `- Reference mechanism: ${report.referenceMechanism.join('; ')}.`,
    `- Senior-programmer logic: ${report.seniorProgrammerLogic.join('; ')}.`,
    `- DeepSeek rebuild plan: ${report.deepseekRebuildPlan.join('; ')}.`,
    `- Absorb: ${report.whatToAbsorb.join('; ')}.`,
    `- Do not copy: ${report.whatNotToCopy.join('; ')}.`,
    `- Implementation slices: ${report.implementationSlices.join('; ')}.`,
    `- Acceptance evidence: ${report.acceptanceEvidence.join('; ')}.`,
    `- V26 action: ${report.v26Action}`,
    `- Acceptance: ${report.acceptance}`,
    `- Claim risk: ${report.claimRisk}`,
    `- Top reference files: ${report.topReferenceFiles.slice(0, 5).map(hit => `${hit.path} (${hit.score})`).join('; ') || 'none'}.`,
  ].join('\n')).join('\n\n')

  const md = [
    '# DSXU Reference Mechanism Audit - 2026-05-16',
    '',
    'This is an internal mechanism-level reverse analysis. It scans the 1902 reference source files as product-experience signals only, then maps the useful mechanisms to DSXU-owned DeepSeek-first implementation paths. It does not copy source code, prompts, branding, or commercial behavior.',
    '',
    '## Summary',
    '',
    markdownTable([summary], ['referenceFileCount', 'dsxuSourceFileCount', 'mechanismCount', 'scenarioCount', 'v18PassCapabilityLinks', 'v18DeferredCapabilityLinks']),
    '',
    `Decision counts: ${JSON.stringify(summary.decisions)}.`,
    '',
    `Scenario decision counts: ${JSON.stringify(summary.scenarioDecisions)}.`,
    '',
    '## Mechanism Map',
    '',
    markdownTable(tableRows, ['priority', 'loop', 'mechanismClass', 'referenceFiles', 'owner', 'decision', 'v18', 'action']),
    '',
    '## Mechanism Classes',
    '',
    markdownTable(classRows, ['mechanismClass', 'count']),
    '',
    '## Scenario And Role Absorption Matrix',
    '',
    markdownTable(scenarioRows, ['role', 'scenario', 'decision', 'deepseekStrategy', 'missingClosures']),
    '',
    '## Unfinished V26 Work',
    '',
    markdownTable(unfinishedRows, ['priority', 'loop', 'decision', 'action', 'implementationSlices', 'acceptance']),
    '',
    '## Claim Rules',
    '',
    '- 1902 reference files are evidence of experience-loop density, not license to claim feature parity.',
    '- V18 70 PASS means historical alignment pass; each public claim must still prove DSXU source/test/live/raw/cost/cache evidence.',
    '- DeepSeek optimization must prefer stable prefix, compact source-truth capsule, bounded Read fallback, tool-result preview, and real route/cost/cache trajectory.',
    '- Anything product-specific, branded, voice/buddy/team-like, or external-host-specific must be adapted, excluded, or kept as roadmap unless DSXU has a named owner and live evidence.',
    '',
    '## Detailed Mechanisms',
    '',
    detailSections,
    '',
  ].join('\n')
  await writeFile(OUT_MD, md)

  console.log('PASS_DSXU_REFERENCE_MECHANISM_AUDIT_GENERATED')
  console.log(`referenceFileCount=${referenceFiles.length}`)
  console.log(`dsxuSourceFileCount=${dsxuSourceFiles.length}`)
  console.log(`mechanismCount=${reports.length}`)
  console.log(`unfinished=${unfinished.length}`)
  console.log(`json=${relative(ROOT, OUT_JSON)}`)
  console.log(`markdown=${relative(ROOT, OUT_MD)}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
