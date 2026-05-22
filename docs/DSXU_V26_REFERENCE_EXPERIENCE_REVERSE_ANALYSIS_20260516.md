# DSXU V26 Reference Experience Reverse Analysis - 2026-05-16

目标：从本地 1902 个参考源码文件反推“高级程序员体验闭环密度”，只吸收通用机制，不复制源码、prompt、品牌文案或商业专属实现。

Status: PASS_REFERENCE_1902_REVERSE_ANALYSIS_GENERATED
Reference source files: 1902

## 1. 安全边界

- 允许：抽象机制，例如可见工作状态、工具/权限生命周期、source truth 修复、上下文恢复、Agent 父子证据、MCP/Skill registry、成本/缓存证据。
- 禁止：复制参考源码、UI 文案、prompt 文案、品牌词、订阅/商业专属逻辑、第二套 runtime。
- GitHub 只能声明 DSXU 自有实现与证据，不能声明参考产品 parity。

## 2. 目录信号

| directory | files |
| --- | --- |
| utils | 564 |
| components | 389 |
| commands | 207 |
| tools | 184 |
| services | 130 |
| hooks | 104 |
| ink | 96 |
| bridge | 31 |
| constants | 21 |
| skills | 20 |
| cli | 19 |
| keybindings | 14 |
| tasks | 12 |
| migrations | 11 |
| types | 11 |
| context | 9 |
| entrypoints | 8 |
| memdir | 8 |
| buddy | 6 |
| state | 6 |

## 3. 能力闭环映射

| family | label | referenceFiles | dsxuOwner | dsxuFilesFound | testsFound | liveEvidenceFound | implementationDecision | githubClaim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goal-plan-query-loop | Goal / Plan / Query Loop | 573 | DSXU Query Loop / Entry Composition | 5/5 | 3/3 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| visible-work-state | Senior Visible Work-State | 559 | UI/TUI Visible Work-State Projection | 6/6 | 4/4 | 2/2 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| tool-permission-lifecycle | Tool / Permission Lifecycle | 369 | Tool Gate / Permission Gate | 6/6 | 4/4 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| source-truth-repair | Source Truth Repair Loop | 149 | Source Truth / Coding Repair | 6/6 | 3/3 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| terminal-shell-reliability | Terminal / Shell Reliability | 134 | Terminal Tool Adapter / Result Pack | 4/4 | 3/3 | 1/1 | needs stronger live evidence | roadmap or internal evidence only; do not claim public parity |
| context-memory-recovery | Context / Memory / Recovery | 138 | Context Builder / Recovery Mainline | 5/5 | 4/4 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| agent-orchestration | Agent Orchestration / Parent Evidence | 171 | Agent Lifecycle | 5/5 | 3/3 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| mcp-skill-ecosystem | MCP / Skill Ecosystem | 191 | MCP / Skill Registry | 6/6 | 4/4 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| model-cost-cache | DeepSeek Model / Cost / Cache | 123 | DeepSeek Runtime / Cost Evidence | 6/6 | 4/4 | 2/2 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| ide-remote-bridge | IDE / Remote / External Host Boundary | 141 | External Host Adapter Boundary | 5/5 | 3/3 | 1/1 | needs stronger live evidence | roadmap or internal evidence only; do not claim public parity |
| first-run-trust | First-Run Trust / Doctor | 125 | Install / Auth / Doctor | 5/5 | 2/3 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |
| telemetry-evidence-release | Telemetry / Evidence / Release Gate | 125 | Evidence / Release | 5/5 | 2/3 | 1/1 | implemented+tested | claim DSXU-owned mechanism with evidence, not reference parity |

## 4. C2/V26 证据对齐

| metric | value |
| --- | --- |
| C2 owner acceptance status | PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED |
| C2 rows | 1902 |
| implemented+tested | 1096 |
| adapted/excluded | 601 |
| no-loss baseline | 205 |
| needs real code/test | 0 |
| public challenge score floor | 72 |
| public 95 claim allowed | false |

## 5. 本轮落地

- 新增 DSXU 原创 `src/dsxu/engine/work-state-timeline.ts`：把目标、计划、source truth、工具、权限、失败、恢复、成本、证据和 next action 组成一个可测试的 visible-state projection contract。
- 新增 `src/dsxu/engine/__tests__/work-state-timeline.test.ts`：验证完整 senior coding loop 能 PASS，假完成/权限不可见/失败无恢复会被 guards 阻断，且该文件不拥有第二套 tool/query/provider runtime。

## 6. 下一步

- Keep work-state timeline as DSXU-owned projection contract; wire new live/TUI evidence to this contract before public 95 claims.
- Promote terminal/shell reliability and IDE/remote bridge from partial live evidence to product benchmark rows.
- Keep Pro admission evidence-bound; default public demos should remain Flash-first unless failed verification or high-risk gates require Pro.
- Do not claim reference product parity; publish DSXU-owned mechanism evidence and raw benchmark data only.
