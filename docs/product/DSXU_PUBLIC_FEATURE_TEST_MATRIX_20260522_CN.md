# DSXU Code 公开功能与测试证据矩阵 - 2026-05-22

本页用于 GitHub 开源发布说明。它只描述 DSXU 自有实现、DeepSeek-first 优化、内部 reality/evidence 结果和 release-candidate 能力边界；不声明外部模型/产品胜出，不声明公开 90/95 分能力，不把内部 smoke 当正式公开 benchmark。

## 1. 产品定位

DSXU Code 是一个 DeepSeek-first AI 编程 CLI/TUI。它不是只调 DeepSeek API 的聊天壳，而是在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型之上，增加真实工程任务需要的运行时：

- 源码事实与 source capsule：先定位、再范围读取、再编辑，避免无边界读文件。
- 工具与权限门：Read/Edit/Write/Bash/PowerShell/MCP/Skill/Agent 都进入 DSXU Tool Gate / Permission Gate。
- 验证与恢复：写后验证、失败分类、重试、replan、rollback、final evidence。
- 长任务账本：目标、计划、工具结果、成本、缓存、失败、恢复和下一步可审计。
- TUI 信任界面：展示真实工作状态，不用假进度包装结果。
- 证据与发布门：测试、raw evidence、成本、缓存、secret scan、clean export、claim guard 共同决定公开声明。

## 2. DeepSeek 专属优化

| 优化 | 做了什么 | 作用 | 当前证据 |
|---|---|---|---|
| Flash-first 路由 | 默认 DeepSeek Flash；复杂规划、失败恢复或高风险审查才允许 Flash-MAX/Pro admission。 | 控制成本，避免 Pro 常驻。 | senior window 全程 Flash，Pro 未使用；V6 9/9 Pro admissions justified。 |
| Thinking / tool-call 合同 | DeepSeek thinking、tool_calls、JSON output、provider body builder 收束到 DSXU provider 合同。 | 防止多处拼请求体导致 tool replay 失败。 | provider contract / live tool-call replay PASS。 |
| Stable prefix / dynamic tail | 把稳定系统前缀与动态任务尾部分离，减少 DeepSeek 前缀缓存破坏。 | 提高重复任务和长任务的缓存复用。 | `PASS_CACHE_LIVE_AB`，受控 stable-prefix 第 2/3 轮 99.6% cache hit。 |
| Source capsule / no-Read default | 大文件先搜索定位，再使用 bounded range；工具结果落 artifact。 | 降低 token、工具回灌和缓存污染。 | source/cache acceptance、ablation、V3 cache-first evidence。 |
| Route/cost/cache trajectory | 记录 route reason、模型、成本、cache hit/miss、Pro admission。 | 可解释为什么用 Flash 或 Pro，防止成本失控。 | Evidence dashboard cost/cache coverage ready。 |
| Cache-safe tool output | 长 stdout、Read、agent transcript 不直接塞回模型上下文。 | 保护上下文质量和 cache 命中。 | tool-result hygiene ablation：cost 和 tool-result chars 大幅下降。 |

## 3. 功能面：DSXU 当前能做什么

| 功能组 | 代表能力 | 对用户的作用 | 证据口径 |
|---|---|---|---|
| CLI/TUI 主入口 | `dsxu-code`、print mode、interactive TUI、doctor/provider gate。 | 在终端中运行真实 AI 编程任务。 | product entry / help / doctor / provider smoke。 |
| Query loop / PlanGraph | 目标、计划、当前动作、verification、recovery、final report。 | 让模型不是只聊天，而是按工程流程推进。 | V4/V5/V8 default-chain reachability。 |
| DeepSeek runtime | Flash/Flash-MAX/Pro 路由、thinking、tool-call、JSON、cache/cost。 | 把 DeepSeek 模型能力变成可审计工程 runtime。 | provider contract、V6/V10 evidence。 |
| 工具系统 | 47 个工具目录，包括 FileRead/Edit/Write、Bash、PowerShell、Grep、Glob、LSP、MCP、Skill、Agent、Todo、RunNativeTest、CollectEvidence。 | AI 能真实读写代码、运行命令、调用 MCP/Skill、收集证据。 | 400+ 源码测试文件、release gate 531 pass。 |
| Permission Gate | shell、文件、网络、敏感路径、副作用动作的可见审批与 deny。 | 防止误删、越权执行、隐藏副作用。 | permission/tool adapter/release tests PASS。 |
| Verified Edit Lifecycle | 写后 TDD/SAST/verification envelope、risk、final claim gate。 | 代码改动必须被验证，不能只说“改好了”。 | FileWrite/FileEdit gate tests，release gate PASS。 |
| Recovery / GearBox | 失败分类、retry/replan/rollback/ask/abort、恢复证据。 | 命令或测试失败后能定位和修复。 | real-task 24/24 final PASS，100% second-attempt recovery。 |
| Context / Memory / Compact | source truth guard、memory 只做导航、compact resume。 | 长任务不靠旧聊天记忆误导编辑。 | compact/source/recovery tests 与 V3 cache-first evidence。 |
| Agent / Task / Team | worker evidence envelope、parent synthesis guard、fanout 边界。 | 并行/子任务只回传结构化证据，避免 transcript 爆炸。 | Agent/MCP/Skill boundary acceptance PASS。 |
| MCP / Skill ecosystem | MCP doctor、skill priority/conflict、registry boundary。 | 生态工具可以接入，但不能形成第二 runtime。 | MCP/Skill boundary evidence、release claim guard。 |
| TUI Trust Surface | visible state、scroll/resize、permission prompt、background task、evidence line。 | 用户能看到真实进度、阻断和恢复状态。 | interactive TUI acceptance 7/7，PTY/TUI evidence。 |
| Benchmark / Evidence | raw transcript、tool trace、metrics、risk、final report、dashboard。 | 所有卖点必须可追溯，防止假完成。 | 450 generated evidence files，dashboard 159 PASS gates。 |
| Training / feedback | localized feedback、trajectory dataset、training V1/V2 flywheel。 | 把失败点转成可复盘轨迹和改进数据。 | training V1/V2 PASS，public claim disabled。 |
| Release / security | clean export、fresh install、secret scan、brand/IP claim boundary。 | 支持开源发布，不把 secret 和内部审计直接打包。 | clean export artifact PASS，fresh install smoke 8/8，release gate 531 pass。 |

## 4. 项目规模与测试覆盖面

| 项目 | 数量 | 含义 |
|---|---:|---|
| `src` 源码文件 | 2833 | 产品、工具、TUI、runtime、证据和测试入口。 |
| TypeScript/TSX 源文件 | 2800 | 主实现以 TS/TSX 为主。 |
| 源码测试文件 | 400 | `src` 内测试覆盖 query loop、tools、provider、TUI、agent、release 等。 |
| 全仓测试文件 | 434 | 最新 full regression 覆盖范围。 |
| `src/dsxu/engine` 文件 | 599 | DSXU engine、runtime、evidence、recovery、benchmark、release owner。 |
| `src/dsxu/engine` 测试文件 | 318 | DSXU 核心 owner 的主要验收面。 |
| 工具目录 | 47 | 真实工具能力面，包括文件、shell、MCP、Skill、Agent、native test、evidence。 |
| scripts 文件 | 183 | 验收、证据、release、benchmark、training、preflight。 |
| package scripts | 148 | 用户/维护者入口；command catalog 将其分为 product-runtime、mainline-validation、release-only、owner-review、historical-evidence 等。 |
| generated evidence 文件 | 450 | 机器可读证据、仪表盘、raw/import/report、release/preflight。 |

## 5. 测试类型、数量与证明能力

| 测试/证据类型 | 最新结果 | 证明什么 | 公开边界 |
|---|---:|---|---|
| 全仓回归 | 3075 pass / 1 skip / 0 fail，434 个测试文件 | 当前代码库基础回归稳定。 | 产品稳定性证据，不是榜单。 |
| 六阶段最终测试 | 22/22 command batches PASS | 功能、体验、恢复、性能、评测、发布收口链路可跑通。 | release-candidate 证据。 |
| DSXU release gate | 531 pass / 0 fail | release surface、claim boundary、secret/redaction、owner gate 当前通过。 | 不是 public 95 证明。 |
| Senior coding window | 30.48 分钟，33 次 DSXU product-entry runs，32 轮 review，最终 fixture test 通过 | 长任务窗口、真实运行、修复与最终验证能力。 | Flash-only 内部长任务证据。 |
| Senior window 成本 | 全程 DeepSeek Flash，约 `$0.3617`，Pro 未使用 | Flash-first 成本纪律在长任务中成立。 | 单次窗口成本证据。 |
| Real-task hit-rate pack | 24/24 final PASS，0% first-attempt PASS，100% second-attempt recovery，Flash-only，64.1% cache hit，$0.198944 | 失败恢复和二次收敛能力。 | 内部 product proof，不是外部榜单。 |
| V6 replay hit-rate | 100/100 final PASS，100% tool hit，100% recovery success，80.7% avg cache hit，9/9 Pro admission justified | 内部 replay 层的工具命中、恢复和路由审计。 | 内部 replay，不等于真实外部 benchmark。 |
| V2/V3 finalization | 原始 14 non-pass 已 14/14 关闭；剩余 16 raw API baseline 已 16/16 捕获；30/30 DSXU raw evidence ready | public-comparable DSXU lane raw evidence 已闭合。 | 缺 target/reference transcript，不能写外部对比。 |
| V3 cache live A/B | `PASS_CACHE_LIVE_AB`；受控 stable-prefix 第 2/3 轮 99.6% hit | DeepSeek prefix cache 在重复稳定前缀下真实生效。 | 内部调优证据，不代表所有任务 99.6%。 |
| V10 final reality | reachability、77-case golden replay、ablation、long task、provider dry smoke、agent/tool pairing、cache/cost、localized feedback、TUI trust surface、final dashboard 全 PASS | DSXU-owned final reality 证据链已成型。 | 不声明外部胜出。 |
| Interactive TUI acceptance | 7/7 scenarios PASS | TUI 可见状态、权限、恢复、compact、background 体验可回放。 | 真实 UI/TUI 体验证据。 |
| Training V1/V2 | V1 PASS 23 steps / 13 gates / 0 failed；V2 PASS internal flywheel | trajectory/evidence/feedback 数据流已可跑。 | 不声明训练模型效果。 |
| SWE internal smoke | 5/5 PASS | 内部 SWE-style 评测管道健康。 | 不能写正式 SWE-bench 成绩。 |
| Clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`；exact zip path / size / SHA-256 写入 generated evidence；secret scan PASS | 发布包可生成，且不带运行时 secret。 | 发布包装证据，不是能力榜单。 |
| Fresh install smoke | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`；8/8 commands PASS | clean export 可重新安装并跑通 help/auth/doctor/provider smoke。 | 安装可用性证据。 |
| Brand / compatibility risk board | public surface blockers 0；runtime cleanup candidates 0 | 当前公开面没有品牌/兼容风险阻断。 | release hygiene 证据。 |
| Evidence dashboard | 304 gates，159 PASS，0 FAIL，0 BLOCKED，1 CLAIM_BLOCKED，144 INFO | runtime/release blockers 已清零，仍阻断外部/95 claim。 | claim guard 仍生效。 |
| Evidence coverage | source/test 27、live 15、raw 15、cost 74、cache 75 evidence files ready | source/test/live/raw/cost/cache 各证据面均有可读文件。 | 证据覆盖，不是外部胜出。 |

## 6. 开源页可以写的卖点

1. DSXU 是 DeepSeek-first engineering runtime，不是普通聊天壳。
2. 默认 Flash-first，Pro admission 有证据；长任务窗口已证明 Flash 成本可控。
3. 真实工具链进入权限门和验证门，支持读写代码、shell、MCP、Skill、Agent、native test、evidence。
4. source truth + source capsule + bounded read 降低上下文污染。
5. recovery loop 能把失败推进到二次收敛，real-task pack 已有 24/24 final PASS 与 100% second-attempt recovery。
6. TUI 信任界面能展示真实状态、阻断、权限、恢复、成本和证据。
7. V2/V3 已把 30-case DSXU raw evidence 做到 ready 30/30。
8. V3 cache-first 有真实 DeepSeek live A/B 证据，重复 stable-prefix lane 可达到 99.6% cache hit。
9. release gate 与 evidence dashboard 会主动阻断未证明的 90/95、外部对比和 SWE-bench claim。
10. release-candidate 包已生成 clean export artifact，并通过 secret scan 与 fresh install smoke。

## 7. 仍不能写的内容

- 不能写已经达到公开 90/95 分。
- 不能写超过任何外部闭源模型或产品。
- 不能写正式 SWE-bench / Terminal-Bench / BFCL 成绩。
- 不能把 DSXU raw evidence 当成 target/reference transcript。
- 不能把 cache live A/B 的单一 stable-prefix 99.6% 写成所有任务命中率。
- 不能把 V18/V20/V24/V26 历史审计名当成公开产品功能名。

## 8. Release-candidate 当前状态与后续

已完成：

1. 当前 public docs/evidence 已重新生成 launch pack。
2. clean export artifact 已生成，secret scan PASS。
3. fresh install smoke 已从 clean export 跑通 8/8。
4. runtime health dry-path PASS。
5. evidence dashboard 刷新后仍保持 159 PASS、0 blocked、1 claimBlocked。

后续只剩两类工作：

1. 若要正式 GitHub tag/release：做 maintainer owner review，确认 release artifact、README、assets、license、install path 和 changelog。
2. 若要外部 benchmark/90+ 声明：继续补 same-case target/reference transcripts 和公开评分协议；当前不能把 30/30 DSXU raw lane 写成外部对比成绩。
