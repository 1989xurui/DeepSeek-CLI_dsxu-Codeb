# DSXU V24 最终执行方案：DeepSeek 原侧 95 分高级编程体验收口

日期：2026-05-15
目标版本：V24
适用范围：`D:\DSXU-code` 当前主线、V18/V19 CLEAN 总账、V20 owner/Git 与 Claude 1902 映射证据、DeepSeek 官方接口能力层。

## 0. 最终排板口径

V24 最终版不再把重点放在“继续增加更多功能想法”上，而是把 DSXU 已经形成的大系统压成可证明、可发布、可对比、可挑战的开源产品闭环。

当前仓库排除 `.git`、`.dsxu`、`node_modules` 后约 `2873` 个可发布面文件，`src` 最大集中在 `utils`、`dsxu`、`components`、`services`、`commands`、`tools`。这说明 DSXU 当前不是功能少，而是必须做产品证明层：证明这些能力已经统一、可运行、可恢复、可展示、可发布。

V24 最终执行原则：

- 先固化总账，再处理 runtime/stub redline，再做 DeepSeek 原生合同。
- 先证明单主线和真实能力，再做 GitHub 卖点和公开数据。
- 先做 IDE/API bridge 的协议和 smoke，不先铺大而全插件工程。
- 不新增 Voice/Buddy/Team、DesktopExecutor、App suite 大壳、OpenClaw/Hermes 具体接入，除非它们先证明能提升复杂任务成功率并落回现有 owner。
- 任何公开卖点必须有证据文件、测试命令、raw transcript、截图或可复现 demo。

V24 最终先后顺序：

1. `V24_BASELINE_AUDIT`
2. `V24_RUNTIME_STUB_REDLINE`
3. `V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE`
4. `V24_DEEPSEEK_RUNTIME_CONTRACT`
5. `V24_WORK_STATE_TIMELINE_ACCEPTANCE`
6. `V24_C2_FEATURE_ACCEPTANCE_MATRIX`
7. `V24_ECOSYSTEM_COMPATIBILITY_PACK`
8. `V24_IDE_API_BRIDGE_ACCEPTANCE`
9. `V24_REAL_OPERATION_EVIDENCE`
10. `V24_PUBLIC_CHALLENGE_REPORT`
11. `V24_PRODUCT_DATA_PACK`
12. `V24_95_SCORECARD`
13. clean export artifact + fresh install smoke

## 1. 总判断

V24 不是继续堆一个新层，也不是把 V20 的报告换个名字。V24 的任务是把 DSXU 从“证据闭环和 owner 签收基本成立”推进到“真实复杂编程体验可证明达到 95 分”的阶段。

当前最重要的事实是：

| 项 | 当前判断 |
|---|---|
| DeepSeek 官方接口能力层 | DSXU 已有基础：V4 Flash/Pro 路由、thinking/non-thinking、FIM、prefix/cache、usage/cost、tool call 适配都已有主线代码。 |
| V18/V19 CLEAN | 主目标和原侧原则已明确：参考成熟语义，但只能落回 DSXU 单主线，不复制原实现，不新增第二套 runtime。 |
| V20 owner/Git | Product packets 与 deletion packets 已 staged；final preflight 已 PASS；clean export preflight 已 ready。 |
| V20 C2 Claude 1902 | 1902 个参考文件 owner-disposition 已完成，但这只证明“归属/排除/适配决策”，不证明“所有体验能力已经被真实实现和验收”。 |
| V20 真实测试 | release gate 和多批测试已通过，但性能、真实窗口体验、长任务恢复、公开任务挑战还不足以支撑 95 分公开能力宣称。 |
| 当前 Git/workspace | 2026-05-15 最新复核：`git status --short=2064`，index paths=2024，unstaged paths=35，untracked paths=32；4 个 ACL 物理残留仍只能外部权限处理。 |

因此 V24 的正确口径是：

- V20 解决了“能不能发布前收口”的大部分 gate。
- V24 解决“这个产品是否真的像高级程序员一样可长期执行复杂任务”的能力证明。
- C2 不能再只算文件吸收，要转成 feature acceptance。
- DeepSeek 不能只算 provider adapter，要转成原生能力调度系统。
- 生态兼容不能算接入第三方产品，要做 DSXU 独立产品的兼容入口和统一注册格式。
- 公开测试不能只写 readiness，要真实执行、保留 raw evidence、承认失败。

## 2. V24 目标

V24 的目标是让 DSXU 基于 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型，达到对标 GPT-5.5 与 Claude 4.7 高级 AI 编程和复杂任务执行体验的 95 分水平。

95 分不是口号，必须同时满足：

| 能力域 | 95 分标准 |
|---|---|
| 目标保持 | 45 分钟以上复杂任务不丢目标、不被旧上下文污染，恢复后能重建任务状态。 |
| 真读真改 | 修改前读 source truth，修改后验证，不用计划冒充完成。 |
| 工具运行时 | Read/Edit/Bash/PowerShell/MCP/Browser/Agent 都进统一 tool lifecycle 和 permission gate。 |
| DeepSeek 原生调度 | Flash-first、Pro 高风险准入、thinking trajectory、FIM、prefix/cache、cost ROI 都可审计。 |
| UI/TUI 体验 | 用户能看到当前目标、计划、工具、权限、失败、恢复、Agent、成本和下一步。 |
| Agent 并行 | 支持 serial worker / parallel fanout，父级只整合真实 worker evidence。 |
| 恢复能力 | 工具失败、测试失败、上下文压缩、权限拒绝、provider 错误都进入 named recovery path。 |
| 生态兼容 | MCP、Claude-style project files、外部 agent host、browser-use 类能力都进入 DSXU owner，不形成第二套 runtime。 |
| 公开挑战 | 用公开任务或可复核任务包挑战，输出 raw transcript、patch、tests、metrics、risks。 |
| 发布可信 | clean export、license/notice、商业/IP/品牌风险、ACL 残留排除都有证据。 |

## 3. DeepSeek 官方接口能力层：V24 需要用到什么

DSXU 当前已有 DeepSeek 控制层，但 V24 要把它从“能发请求”升级为“任务级模型作战系统”。

官方接口边界以 DeepSeek 文档为准：

- DeepSeek API 总入口：[DeepSeek API Docs](https://api-docs.deepseek.com/zh-cn/)
- Chat Completion 参数与 tools：[创建对话补全](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)
- 思考模式与工具回传：[思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode)
- Function Calling / strict mode：[Function Calling](https://api-docs.deepseek.com/zh-cn/guides/tool_calls)
- KV Cache：[KV Cache](https://api-docs.deepseek.com/zh-cn/guides/kv_cache)
- Prefix Completion：[前缀续写](https://api-docs.deepseek.com/zh-cn/guides/chat_prefix_completion)
- FIM Completion：[FIM 补全](https://api-docs.deepseek.com/zh-cn/guides/fim_completion)
- Anthropic API 兼容边界：[Anthropic API](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)
- Claude Code 接入参考：[Claude Code](https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code)

### 3.1 已有基础

当前 DSXU 已有这些基础：

| 文件 | 已有能力 |
|---|---|
| `src/utils/model/deepseekV4Control.ts` | V4 Flash/Pro model spec、1M context、384K chat output、FIM 4K、pricing、route role、route reason、max token clamp。 |
| `src/utils/model/deepseekV4CostRouter.ts` | route input/env/params 统一，Flash/Pro thinking/non-thinking 决策，reasoning effort 默认。 |
| `src/services/api/deepseek-adapter.ts` | DeepSeek request plan、thinking 参数、reasoning_content 转换、tool_choice 转换、prompt_cache usage、streaming thinking delta、tool XML fallback。 |
| `src/services/api/deepseek-fim.ts` | FIM lane 基础。 |
| `src/services/cache-stats.ts` | prompt_cache_hit_tokens / prompt_cache_miss_tokens 记录。 |
| `scripts/benchmark/dsxu-mainline-benchmark.ts` | 多路由基准入口和任务矩阵雏形。 |

### 3.2 V24 必须补强的接口纪律

| DeepSeek 能力 | V24 改造要求 |
|---|---|
| Thinking + tools | 建立 `DeepSeekTrajectoryStore`：每轮 assistant 的 `reasoning_content`、tool calls、tool results、下一轮回传状态要成对保存，避免 400 或丢思考轨迹。 |
| Tool calls | 建立 `DeepSeekToolSubsetRouter`：官方 tools 数量有限，V24 必须按任务动态裁剪工具集合，不把全量工具塞给模型。 |
| Strict tool schema | 建立 `ToolSchemaStrictnessGate`：高风险工具和 MCP 工具必须 object parameters、required 全字段、`additionalProperties=false`，不合格不进入 provider request。 |
| Prefix/cache | 建立 `DeepSeekCachePrefixPlanner`：稳定系统提示、owner map、工具 schema 放 prefix；动态任务、文件 diff、最新观察放 tail；每次记录 hit/miss ROI。 |
| FIM | FIM 只做小范围 non-thinking edit lane，不能替代主 query loop 或复杂任务规划。 |
| JSON output | 只用于 verifier/classifier/report schema，不用于绕过真实工具执行。 |
| Anthropic API 兼容 | 只作为外部兼容 facade，不允许把 Anthropic/Claude 产品 runtime 带回 DSXU 主线。 |
| Pricing | 价格证据必须带 source date；到 2026-05-31 后 Pro 折扣假设必须重新审计。 |

## 4. V18/V19/V20 未完成项并入 V24

### 4.1 V18/V19 CLEAN 剩余口径

V18/V19 已经把核心原则写清楚：V18 管目标，V19 管设计。V24 继续继承，不再回填 V18 旧实现。

仍需并入 V24 的项：

| 来源 | 未完成/需升级项 | V24 处理 |
|---|---|---|
| V18 外部评测项 | Terminal-Bench、SWE Verified、BFCL、BrowseComp 等只有 readiness/guard，不是 raw live pass。 | 进入 V24-F 公开挑战任务包。 |
| V18 产品扩展项 | OpenClaw/Hermes/DesktopExecutor/VS Code/Voice/Buddy/Bridge 等不能为了清零新增 runtime。 | 只保留生态兼容能力口，不做第二产品壳。 |
| V19 主线纪律 | 不能最小实现、不能桥接模式、不能 generic bucket。 | V24 每个任务必须写 owner、入口、evidence、release gate。 |
| Phase 12 | P12 raw 已导入，但只能证明对齐输入，不等于公开胜出。 | V24 继续做 raw delta review 和公开任务挑战。 |

### 4.2 V20 主线地图是否统一

结论：owner 层面基本统一，产品体验层还没有完全证明。

证据：

- `docs/generated/DSXU_V20_FINAL_PREFLIGHT_20260515.json`：`status=PASS`，`canRunFinalSixStageTests=true`，`canCreateCleanExport=true`。
- `docs/generated/DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json`：P12、owner/Git、deletion、ACL、final tests、clean export 都进入可执行口径。
- `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_20260515.json`：1902 文件 owner-disposition 完成，unresolved=0。
- `docs/generated/DSXU_V20_C2_FUNCTION_LOSS_REVIEW_SUMMARY_20260515.json`：明确 `implementedFeatureAcceptanceComplete=false`。

V24 判断：

| 层 | 状态 |
|---|---|
| Owner map | 基本统一。 |
| Git/index 收口 | 已 staged，未 commit/export。 |
| Product runtime 唯一性 | 大体成立，但 V24 还要用运行测试证明没有第二套 tool/agent/MCP/provider runtime。 |
| 体验能力吸收 | 未完成。C2 是归属签收，不是功能全验收。 |
| 高级程序员体验 | 未达到 95 分证据要求。 |

### 4.3 V20 生态兼容能力包是否完成

结论：没有完成，只完成了方向和边界。

V20 已经明确要考虑 MCP host、Claude-compatible project intake、registry、Bridge Remote、AionUi、Warp、Cherry Studio、browser-use 等生态，但这不是“下载接入第三方产品”，而是 DSXU 独立产品要具备兼容入口。

V24 要把生态兼容包拆成五个正式能力：

| 能力 | V24 定义 |
|---|---|
| MCP registry intake | 支持读取 `.mcp.json`、MCP server manifest、工具 schema，统一进 DSXU MCP/Skill/Plugin Registry。 |
| Claude-style project intake | 读取 `CLAUDE.md`、`.claude/commands`、`.claude/skills` 的项目语义，但转换成 DSXU.md / DSXU skill/command owner，不保留 Claude 产品路径。 |
| External agent host | 给 AionUi 类外部 UI/agent host 调 DSXU CLI/API 的入口，但所有执行仍走 DSXU Query Loop / Tool Gate / Evidence。 |
| Terminal host compatibility | 给 Warp 类 terminal/AI shell 调用 DSXU 的 stream-json/CLI contract。 |
| Browser automation provider | 给 browser-use 类能力一个受控 tool provider，进入 permission/evidence，不变成独立 Browser runtime。 |

### 4.4 C2 1902 文件吸收真正缺什么

C2 快，是因为它完成的是 owner-disposition，不是逐功能实现。V24 必须把 C2 提升为最重要工作：吸收 Claude 1902 的“高级程序员体验闭环密度”，再按 DeepSeek 原侧重新产品化。

本轮重新扫描结论：

| 项 | Claude `D:\源代码claude\src` | DSXU `D:\DSXU-code\src` | 判断 |
|---|---:|---:|---|
| 源码文件数 | 1902 | 2650 | DSXU 已大量 Claude 化，并新增 DSXU engine/evidence/control-plane。 |
| 12 类体验信号命中合计 | 12786 | 18211 | DSXU 信号更多，但不等于体验已验收。 |
| 4 类以上体验信号文件 | 1576 | 2191 | 两边都是高密度体验系统，不是单点算法项目。 |
| 6 类以上体验信号文件 | 1228 | 1740 | DSXU 需要把高密度信号收成真实体验闭环。 |

按体验信号域重新统计：

| 体验信号域 | Claude 文件命中 | DSXU 文件命中 | V24 判断 |
|---|---:|---:|---|
| Query / Loop / Session | 1772 | 2413 | DSXU 有更厚的 query/session 信号，但必须证明不串 topic、不假 final。 |
| Visible Work State | 1505 | 1875 | UI/TUI 信号仍在，V24 要做真实窗口体验和 timeline。 |
| Tool Lifecycle | 1274 | 1881 | 工具信号更多，必须证明都走 Tool Gate，不形成第二 executor。 |
| Permission / Safety | 753 | 1140 | 权限信号保留，必须证明 IDE/MCP/Browser/Agent 也进同一权限主线。 |
| Context / Memory / Compact | 911 | 1374 | compact/resume/memory 信号强，需长任务 replay 验证。 |
| Agent / Task Lifecycle | 745 | 1202 | Agent 信号增强，必须验证 parent synthesis 只引用 worker evidence。 |
| MCP / Plugin / Skill | 760 | 858 | 生态底座存在，但发布级 registry/intake 还没完成。 |
| Model / Cost / Cache | 1088 | 1474 | DeepSeek 原生优势在这里，必须做 cost/cache/FIM/thinking 数据化。 |
| Recovery / Failure | 1039 | 1586 | 恢复信号足，但要证明失败后不会空转或假 PASS。 |
| Coding Workflow | 1343 | 1839 | 代码工作流信号强，必须用真实 patch/tests 验收。 |
| Remote / IDE / API | 1324 | 1810 | 底座强，但 VS Code/API bridge 仍未产品化。 |
| Telemetry / Evidence | 272 | 759 | DSXU 证据层更强，应转成 GitHub 数据卖点。 |

关键文件对照：

| 体验核心 | Claude 文件 | DSXU 当前对应 | 判断 |
|---|---|---|---|
| Query loop | `query.ts` 1612 行 | `src/dsxu/engine/query-loop.ts` 1980 行 | DSXU 已主线化，但需真实长任务验收。 |
| Query engine | `QueryEngine.ts` 1234 行 | `src/QueryEngine.ts` 1237 行 | 基本保留，需 DeepSeek 路由/恢复验收。 |
| Tool contract | `Tool.ts` 754 行 | `src/Tool.ts` 900 行 | 保留并扩展，需 schema strictness。 |
| Tool pool | `tools.ts` 373 行 | `src/tools.ts` 487 行 | 保留并扩展，需 tool subset router。 |
| Tool execution | `services/tools/toolExecution.ts` 1651 行 | `tool-mainline-runtime-v1.ts` 423 行 | DSXU 已改 owner，需确认功能未被压扁。 |
| Bash/PowerShell | `BashTool` 1084 / `PowerShellTool` 959 行 | DSXU 1118 / 1030 行 | 基本保留，需权限/失败恢复验收。 |
| Agent | `AgentTool.tsx` 1320 行 | DSXU 1501 行 | 保留并增强，需 parent evidence。 |
| Prompt input | `PromptInput.tsx` 2213 行 | DSXU 2233 行 | 保留，需真实输入/权限/状态体验验收。 |
| REPL | `REPL.tsx` 4745 行 | DSXU 5381 行 | 保留并增强，需窗口体验验收。 |
| Compact | `compact.ts` 1581 行 | DSXU 1708 行 | 保留，需长任务 resume。 |
| Session memory | `sessionMemory.ts` 433 行 | DSXU 457 行 | 保留，需 source-truth reread。 |
| MCP client | `client.ts` 3087 行 | DSXU 3108 行 | 保留，需发布级 MCP intake/doctor。 |
| Skill registry | `loadSkillsDir.ts` 982 行 | `skills-registry-v1.ts` 597 行 | DSXU 收敛为 registry，需功能验收而非行数判断。 |
| Remote bridge | `bridge/replBridge.ts` 2267 行 | `dsxuRemoteBridgeFacade.ts` 486 行 | DSXU 已瘦身为 facade，需 IDE/API smoke 证明不丢体验。 |

必须承认的缺口：

| Bucket | 数量 | V24 风险 |
|---|---:|---|
| `adapt_or_exclude_product_specific` | 594 | 需要抽查并证明没有把有价值的 UX/恢复/遥测能力当产品专属丢掉。 |
| `review_candidate` | 42 | 虽已 owner 签收，但要转成 real behavior acceptance。 |
| `shared_utility_baseline_or_noop` | 201 | baseline/no-op 不是功能等价。 |
| `shared_utility_not_present` | 4 | 需要确认是否确实不需要，不能静默丢功能。 |

V24 不再问“文件是否吸收”，只问：

- 这个文件背后的用户体验机制是什么？
- DSXU 是否已有同等机制？
- 这个机制是否进入正确 owner？
- 是否有真实窗口或真实任务证据？
- 如果排除，是否有商业/IP/品牌/产品差异理由？

### 4.5 Claude 高级程序员体验闭环密度：V24 必须全量重建

Claude 1902 最有价值的不是某个单点算法，而是把高级程序员工作方式拆成大量小闭环，并让这些闭环在 UI、工具、权限、上下文、恢复、Agent、成本、证据之间互相咬合。V24 必须把这些闭环基于 DeepSeek 调成适合 DSXU 的产品形态。

V24 不复制 Claude 文件，不保留 Claude 品牌和产品专属逻辑；V24 要吸收下面 15 条体验闭环：

| 编号 | Claude 体验闭环 | DSXU / DeepSeek 化目标 | 验收证据 |
|---:|---|---|---|
| 1 | Goal / Intent / Session Loop | 目标、用户意图、topic boundary、session state 进入 DSXU Query Loop。 | 同窗口 topic replay、长任务目标保持。 |
| 2 | Visible Work-State Loop | 用户看到目标、计划、工具、权限、失败、恢复、成本、下一步。 | TUI/CLI/stream-json timeline 截图或 transcript。 |
| 3 | Tool Lifecycle Loop | 工具从 schema、验证、权限、执行、progress、结果、posthook 全链路。 | Tool evidence pack、strict schema gate、tool result pairing。 |
| 4 | Permission / Safety Loop | 风险命令、写文件、MCP、IDE、Browser、Agent 都进同一权限主线。 | permission replay、拒绝后 recovery。 |
| 5 | Source Truth / Coding Loop | 读真实文件、定位、patch、diff、test、final report，不用计划冒充完成。 | 真实 patch + test + final evidence。 |
| 6 | Plan / Todo / Task Loop | 计划不是文案，必须有 active task、状态变化、完成前验证。 | task timeline、todo evidence、未验证不得 complete。 |
| 7 | Agent Delegation Loop | worker 有边界、有证据，父级 synthesis 不猜结果。 | serial/parallel fanout replay、worker evidence。 |
| 8 | Context / Memory / Compact Loop | compact/resume 后保留目标、文件、失败、权限、下一步，并重读 source truth。 | 45 分钟长任务 replay、resume source reread。 |
| 9 | Failure / Recovery Loop | 工具失败、测试失败、provider 错误、权限拒绝、上下文溢出都有 named recovery。 | failure taxonomy、MTTR、recovery transcript。 |
| 10 | Model / Cost / Cache Loop | Flash-first、Pro rescue、thinking/FIM/cache/usage 变成任务级 ROI。 | DeepSeek route trace、cache hit/miss、cost per solved task。 |
| 11 | MCP / Skill / Plugin Loop | 外部工具、skill、plugin 只进统一 registry 和 Tool Gate。 | MCP intake、skill selection、doctor、secret redaction。 |
| 12 | IDE / Remote / API Loop | VS Code/API/外部 host 只是入口，执行仍走 DSXU 单主线。 | IDE bridge smoke、diff/permission/timeline。 |
| 13 | Browser / External Action Loop | browser-use 类能力作为受控 provider，不独立 runtime。 | browser task transcript、permission/evidence。 |
| 14 | Telemetry / Evidence / Report Loop | 每个 PASS/PARTIAL/FAIL 都有 trace、metrics、风险、成本。 | product data pack、public claim guard。 |
| 15 | Release / Doctor / Install Loop | 发布包可安装、可 doctor、可 clean export、可复现 demo。 | clean export + fresh install smoke。 |

15 条大闭环不是上限，而是 owner 分组。V24-C2 的最低验收要继续拆到 36 条二级体验闭环，确保 Claude 1902 里真正有价值的高级程序员工作方式没有被压缩丢失：

| 编号 | 二级体验闭环 | DSXU owner / 验收方向 |
|---:|---|---|
| 1 | 用户意图澄清与任务边界 | Query Loop 记录目标、约束、不可做事项，恢复后不漂移。 |
| 2 | 仓库快速定向 | Source Truth owner 输出入口、目录、关键文件、风险面，而不是凭记忆改。 |
| 3 | 真实 import/use 证据 | Owner/Git 审核只接受真实引用链，不接受命名相似判断。 |
| 4 | 活动计划状态 | Work-State timeline 显示当前步骤、完成步骤、阻塞步骤。 |
| 5 | Todo 完成前验证 | 计划项必须绑定工具结果、测试或文件证据，不能只改状态。 |
| 6 | 文件定位与编辑边界 | Patch 前读上下文，改动只落到 named owner，不制造旁路文件。 |
| 7 | Diff 风险说明 | 修改后输出行为影响、兼容风险、测试缺口。 |
| 8 | 工具 schema 选择 | Tool Subset Router 按任务裁剪工具，不把全量工具塞给模型。 |
| 9 | 工具参数严格校验 | ToolSchemaStrictnessGate 拒绝不完整或高风险参数。 |
| 10 | Bash/PowerShell 生命周期 | shell adapter 记录命令、cwd、退出码、失败恢复、权限理由。 |
| 11 | 写文件权限链 | Edit/Move/Delete 进入同一 Permission Gate 和 Evidence。 |
| 12 | 高风险/破坏性命令防线 | 删除、reset、清理、导出必须有 owner/Git 或 release gate。 |
| 13 | MCP server intake | MCP manifest、schema、secret、permission、doctor 统一注册。 |
| 14 | Skill/command intake | 项目技能和命令转成 DSXU registry，不保留第三方产品路径。 |
| 15 | Browser/external action | 浏览器动作是受控 tool provider，带权限、截图、raw transcript。 |
| 16 | IDE/API 入口 | VS Code/API/外部 host 只作为入口，执行仍进 Query Loop/Tool Gate。 |
| 17 | Agent 分工边界 | parent 给 worker 明确 owner、写入范围和验收输出。 |
| 18 | Agent 证据合成 | parent final 只引用 worker 真实 evidence，不把猜测当事实。 |
| 19 | 并发取消/恢复 | worker 失败、取消、超时后进入 named recovery。 |
| 20 | Context compact | 压缩保留目标、约束、文件、失败、权限、下一步。 |
| 21 | Resume source reread | 恢复后必须重读关键 source truth，避免旧上下文污染。 |
| 22 | 失败分类 | 工具、测试、provider、权限、上下文、数据缺口分开归因。 |
| 23 | 测试失败修复路径 | 测试失败先定位 owner 和失败语义，再改代码。 |
| 24 | Provider retry/escalation | Flash/Pro 升档有理由、成本和失败记录。 |
| 25 | Thinking trajectory 回传 | DeepSeek thinking + tools 多轮不丢 reasoning/tool pair。 |
| 26 | FIM 小编辑 lane | FIM 只做小范围补全，不绕过主 query loop。 |
| 27 | Cache/prefix ROI | 记录 hit/miss、成本、稳定 prefix 和动态 tail。 |
| 28 | 成本可见 | 用户能看到模型、token、cache、route、成本趋势。 |
| 29 | 进度可见 | 长任务 30 秒内有真实状态更新，不输出隐藏推理链。 |
| 30 | UI/TUI 输入体验 | prompt、权限、diff、错误、继续操作不互相遮挡。 |
| 31 | Final answer 证据化 | final 只说完成、未完成、验证、风险、下一步，不假 PASS。 |
| 32 | Telemetry/report | PASS/PARTIAL/FAIL 都有 metrics、trace、risk、cost。 |
| 33 | Public challenge packaging | 公开任务保留 raw transcript、patch、tests、失败归因。 |
| 34 | 性能与体验数据 | p50/p95、长任务耗时、cache ROI、恢复耗时进入产品数据包。 |
| 35 | License/IP/brand guard | 吸收机制，不复制品牌、订阅、专利、产品专属实现。 |
| 36 | Release/install/doctor | clean export、fresh install、help、doctor、provider gate 可复现。 |

V24 对 C2 的最终定义：

- `owner-disposition` 已完成，不再重复做文件归属。
- `experience-loop-density acceptance` 未完成，必须作为 V24 核心目标执行。
- 每条 Claude 体验闭环和 36 条二级闭环都必须落到 DSXU named owner、DeepSeek route/evidence、真实测试或发布数据。
- 如果 DSXU 已有同等能力，补真实体验证据；如果能力被压扁，回到原 owner 合并重构；如果是产品专属或商业/IP/品牌风险，提炼机制并排除原实现。

## 5. V24 架构改造主线

V24 不新增其它主链与入口。所有新能力必须挂回现有 owner。

### V24-0 Baseline Audit and Runtime/Stub Redline

目标：先把当前事实固定下来，再动 DeepSeek runtime、IDE/API、生态兼容和公开测试。这个阶段不是补功能，而是防止假完成、重复 runtime、stub API、旧品牌痕迹和未证实卖点继续混入 V24。

任务：

1. 生成 `V24_BASELINE_AUDIT`：汇总 V18 70 PASS / 12 未覆盖、V20 final preflight、C2 feature loss、Git/index、ACL residue、clean export readiness、DeepSeek docs snapshot。
2. 生成 `V24_RUNTIME_STUB_REDLINE`：扫描 product runtime 中的 `not implemented`、stub、placeholder、TODO、deferred、旧 bridge、SDK/MCP 未暴露工具、旧产品命名痕迹。
3. 对 `src/entrypoints/agentSdkTypes.ts`、`src/entrypoints/mcp.ts`、`src/services/mcp/vscodeSdkMcp.ts`、`src/services/bridge/*`、`src/dsxu/control-plane/*` 做 API/IDE/MCP 发布级边界裁决。
4. 对 `src/dsxu/legacy`、`providerMigration`、`bridge-adapter`、`api-microcompact-bridge` 做 import/use owner 复核，只允许 evidence/test/facade，不允许变成 product runtime。
5. 输出可执行 redline：必须修复、允许作为内部 shim、仅测试证据、release exclude、后续路线图。

验收：

- 所有 stub/TODO 被分类，不把未实现 API 当发布卖点。
- 所有旧品牌/第三方产品痕迹有 release 裁决。
- 所有 runtime entrypoint 均映射到 Query Loop、Tool Gate、Model Router、Context、Agent、MCP、Evidence、UI/TUI owner。
- 后续 V24 任务只能引用这个 baseline，不再口头重判。

### V24-A DeepSeek Runtime Contract

目标：把 DeepSeek 能力变成可审计的任务运行时。

任务：

1. 建立 `DeepSeekTrajectoryStore`：记录 thinking trajectory、tool call pair、usage、cache、route reason、failure recovery。
2. 建立 `DeepSeekToolSubsetRouter`：按 workflow、risk、permission、MCP server、UI availability 裁剪工具集合。
3. 建立 `ToolSchemaStrictnessGate`：所有高风险/外部工具进入 provider 前做 schema strict 审核。
4. 建立 `DeepSeekCachePrefixPlanner`：输出 prefix/tail 分区、cache hit/miss 证据、ROI 建议。
5. 建立 `DeepSeekFimEditLane`：限制 FIM 只处理小范围 edit proposal，不绕过 query loop。
6. 建立 `DeepSeekCostLatencyMeter`：每轮记录模型、token、cache hit/miss、cost、latency、route escalation。

验收：

- thinking + tools 连续多轮不丢 `reasoning_content`。
- tools subset 不超过官方限制且每个工具 schema 严格。
- stable prefix 二次运行必须记录 cache ROI。
- Pro 只在规划、审查、失败恢复、高风险综合等节点升档。

### V24-B Senior Programmer Work-State

目标：让 DSXU 在窗口里像高级程序员一样可见、可信、可继续。

任务：

1. 建立统一 work-state timeline：目标、当前计划、读过的 source truth、改动文件、工具状态、权限、失败、恢复、成本、下一步。
2. TUI/CLI/stream-json 输出同一状态，不各写一套。
3. 长任务每 30 秒以内有真实状态更新，不输出隐藏推理链。
4. 失败时显示 owner、失败工具、已验证事实、下一步 recovery path。
5. Agent worker 状态可见，父级 synthesis 必须引用 worker evidence。

验收：

- 用户能在 DSXU 窗口判断“现在在做什么、为什么卡住、下一步是什么”。
- final answer 不复述计划，只陈述完成/未完成/证据/风险。
- 恢复后能继续同一个任务，不需要用户重新解释目标。

### V24-C C2 Experience Loop Density Acceptance

目标：把 Claude 1902 owner-disposition 转成高级程序员体验闭环密度验收。这是 V24 最重要工作之一，不是辅助审计。

任务：

1. 生成 `V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE`：按 15 条大闭环和 36 条二级体验闭环重新读取 Claude 1902 与 DSXU 当前主线信号。
2. 对 988 mainline absorption 做闭环验收：每个 owner 至少覆盖 query/tool/permission/context/agent/model/ui/evidence/IDE/API/release 的真实路径。
3. 对 594 product-specific exclusions 做能力损失审计：只排除品牌、订阅、专利或产品专属；通用体验机制必须进入 DSXU owner。
4. 对 278 shared utilities 分三类验收：import/use keep、baseline/noop、not-present；baseline/noop 不等于 feature parity。
5. 对 42 review candidates 做行为复核：35 mapped owner 和 7 exclude/adapt 都要有理由、证据、风险。
6. 对 `toolExecution` 瘦身、remote bridge 瘦身、skill registry 重写等高风险差异做功能不丢失审计。
7. 输出 `V24_C2_FEATURE_ACCEPTANCE_MATRIX` 和 `V24_C2_EXPERIENCE_LOOP_DENSITY_SCORECARD`。

验收：

- 15 条体验闭环都有 DSXU 真实行为证明。
- 没有因为商业/IP/品牌排除而丢掉通用体验能力。
- 没有把 reference-only 文件当成 runtime。
- 没有把“DSXU 信号更多”误判成“体验闭环已完成”。
- GitHub 卖点只引用已经通过 experience-loop-density acceptance 的能力。

### V24-D Ecosystem Compatibility Capability Pack

目标：让 DSXU 可接生态，但仍是独立产品。

任务：

1. MCP package：manifest intake、server install metadata、tool schema verification、permission/evidence。
2. Claude-style project package：`CLAUDE.md` / commands / skills 导入为 DSXU project context，不保留 Claude 品牌入口。
3. External host package：提供 CLI / stream-json / local API contract，让 AionUi 类 host 能调用 DSXU。
4. Terminal host package：提供 Warp 类 terminal 的 command/event contract。
5. Browser provider package：browser-use 类自动化作为 DSXU tool provider，走 permission gate。
6. Commercial/IP package：所有外部名称只在兼容说明和测试夹具里出现；产品 UI/发布包不带第三方品牌暗示。

验收：

- 每个生态入口都进入 MCP/Skill/Plugin Registry、Tool Gate、Evidence。
- 没有 `compat runtime`、`bridge runtime`、`external runtime` 独立执行主线。
- 外部产品只作为兼容对象，不作为 DSXU 发布依赖。

### V24-E Unified Runtime Cleanliness

目标：确认 DSXU 现在真的是一个系统，不是多个旧系统拼在一起。

任务：

1. 重新扫 `src` product imports：query loop、tool lifecycle、permission、agent、MCP、provider、context 不能有第二套入口。
2. 对 `src/dsxu/legacy`、`bridge`、`remote`、`compat`、`runtime-core`、`api-service`、SDK generated/stub 文件和 MCP entrypoint TODO 做 import/use owner 复核。
3. 删除/迁移候选必须按 staged owner/Git 结果继续，不强删 ACL 残留。
4. 生成 V24 runtime uniqueness report 和 stub redline delta。

验收：

- Product runtime entrypoint 唯一。
- Tool execution 只经 Tool Gate。
- Provider request 只经 DeepSeek runtime contract。
- MCP/Skill 只经 registry。
- Agent 只经 task lifecycle。

### V24-F Public Challenge Harness

目标：挑战公开任务，证明 DSXU 不是只在本地自证。

任务包分三层：

| 层 | 任务 | 标准 |
|---|---|---|
| Tier 0 内部公开夹具 | 用公开小型 repo/issue 重放，保存 patch/tests/raw transcript。 | 10 个任务，至少 9 个通过。 |
| Tier 1 编程公开任务 | SWE-bench Verified 子集、真实 GitHub issue 子集、终端任务子集。 | 10 个任务，至少 8 个通过，失败必须归因。 |
| Tier 2 复杂体验任务 | 45-90 分钟长任务，包含读取、改动、测试、失败恢复、成本控制。 | 3 个任务，全部保留 timeline/evidence。 |
| Tool benchmark | MCP/tool/function calling/schema/tool result pairing。 | 20 个工具回合，0 个无证据 final。 |
| Browser/Terminal task | 浏览器或 TUI 真实操作。 | 5 个任务，有截图/transcript。 |

公开挑战不允许：

- 用 readiness 当 PASS。
- 用 target-only logs 当 paired logs。
- 用 dry plan 当成功。
- 删除失败样本。
- 手动替模型完成关键代码。

### V24-G Performance and Experience Scorecard

目标：把“体验不像高级程序员”的问题量化。

指标：

| 指标 | V24 门槛 |
|---|---|
| 长任务目标保持 | 3 个 45 分钟以上任务，恢复后目标一致。 |
| Tool success evidence | 关键工具调用 100% 有 preflight/result/postflight。 |
| Recovery MTTR | 可恢复失败 90% 在 2 个回合内进入明确 recovery path。 |
| Cache ROI | 稳定 prefix 场景二次运行记录 cache hit/miss，并输出 ROI。 |
| Cost discipline | Flash-first 默认，Pro 升档必须有 route reason。 |
| UI state freshness | 长任务 30 秒内有真实可见状态更新。 |
| Patch correctness | 公开任务 patch 测试通过率达到目标。 |
| False completion | 0 个“计划/意图/未运行测试”被写成 PASS。 |
| Release hygiene | clean export 可创建，且不含 `.git`、`.dsxu`、`node_modules`、证据库和 ACL residue。 |

### V24-H Release and Open Source Readiness

目标：DSXU 可作为 DeepSeek 生态开源产品发布。

任务：

1. 创建 clean export artifact。
2. 复核 package name、binary、README、license、notice。
3. 删除或隔离商业/IP/品牌风险。
4. 发布包不带 `.git`、`.dsxu`、`node_modules`、证据库、ACL residue。
5. 安装 smoke：fresh clone/install/run/help/doctor/live provider gate。
6. 文档说明 DeepSeek API 配置、MCP 配置、项目上下文、权限策略、成本控制、公开挑战复现。

验收：

- clean export 可复核。
- 新环境能启动 DSXU。
- 不需要 Claude 源码目录或第三方产品目录。
- 文档不声称未证明的 benchmark 结果。

### V24-I GitHub 开源产品卖点与对比数据包

目标：让 DSXU 发布到 GitHub 时不是只给功能列表，而是给可复核的数据、对比、截图、raw evidence 和卖点素材。

这不是营销文案先行，而是产品证明先行。README、官网材料、release notes 只能引用这里已经生成的数据，不允许把 readiness、计划、局部单测包装成公开卖点。

任务：

1. 生成 `V24_PRODUCT_SELLING_POINTS.md`：整理 DSXU 能公开讲的真实卖点、不能宣称的边界、DeepSeek 原生优势。
2. 生成 `V24_PRODUCT_BENCHMARK_DATA_PACK`：功能、体验、恢复、性能、成本、公开挑战、发布包体积等数据。
3. 生成 `V24_COMPARISON_MATRIX`：与普通 CLI Chat、通用 API wrapper、Claude-style coding tool、DeepSeek-TUI 类产品做能力维度对比；只比较公开可验证能力，不写贬损性或未经证明的结论。
4. 生成 `README_RELEASE_SECTION`：把数据转换成 GitHub README 可直接使用的产品说明、安装、快速开始、能力表、限制说明。
5. 生成 `DEMO_SCENARIO_PACK`：至少 5 个可复现 demo，包括代码修复、终端任务、MCP 工具、权限拒绝恢复、成本/cache 可视化。
6. 生成 `PUBLIC_CLAIM_GUARD`：每个公开卖点必须指向 evidence file、test command、raw transcript 或 screenshot。

建议公开卖点：

| 卖点 | 证明方式 |
|---|---|
| DeepSeek 原生 AI 编程运行时 | V4 Flash/Pro route、thinking/FIM/cache/cost evidence。 |
| 证据优先的代码修改闭环 | patch、test、trace、final report、risk。 |
| 单主线 Tool Gate | Read/Edit/Bash/PowerShell/MCP/Browser/Agent 统一 permission/evidence。 |
| 可恢复长任务 | compact/resume、failure taxonomy、source truth reread。 |
| 可见工作状态 | TUI/CLI/stream-json timeline、permission、agent、cost。 |
| 低成本策略 | Flash-first、Pro rescue、cache ROI、cost per solved task。 |
| 生态兼容入口 | MCP、project context、external host、terminal/browser provider 进入统一 registry。 |
| 开源发布洁净度 | clean export、license/notice、install smoke。 |

对比数据必须包含：

| 数据 | 发布用途 |
|---|---|
| 功能测试通过率 | 证明核心能力不是概念。 |
| 复杂任务完成率 | 证明能完成真实工程任务。 |
| 平均修复轮次 | 展示高级程序员体验。 |
| 失败恢复成功率 | 展示可靠性。 |
| Flash/Pro 使用比例 | 展示成本控制。 |
| cache hit/miss 与节省估算 | 展示 DeepSeek 原生优势。 |
| 工具调用成功率 | 展示 Tool Gate 稳定性。 |
| 权限拒绝恢复样例 | 展示安全与可控。 |
| 长任务 resume 成功率 | 展示上下文能力。 |
| clean export 大小与安装 smoke | 展示开源产品质量。 |

验收：

- 每个 GitHub 卖点都有证据链接。
- 每个对比数据都有采集脚本或 raw evidence。
- README 不出现未完成 benchmark 宣称。
- 数据表区分 `PASS`、`PARTIAL`、`NOT_YET_CLAIMED`。

### V24-J IDE/API Bridge Productization

目标：把当前已有 control-plane / MCP / SDK / remote facade 底座，产品化为 DSXU 的 IDE/API Bridge 能力，重点是 VS Code 插件/API bridge，但不能新增第二套 query loop、permission runtime、tool executor 或 evidence schema。

当前判断：

- DSXU 已有 control-plane、permission bridge、MCP 入口、SDK 类型、remote/network facade 和 VS Code MCP 通知痕迹。
- 这些只能证明“底座存在”，不能证明 VS Code 插件/API bridge 成品已完成。
- V24-J 要把 PZ06 从 `defer-product-essential` 推进到真实产品能力。

任务：

1. 定义 `DSXU_IDE_BRIDGE_PROTOCOL`：workspace、open file、selection、diagnostics、terminal、git diff、permission request、tool result、timeline event。
2. 建立 VS Code extension package 或最小可发布插件壳：只作为 UI/入口，不拥有执行 runtime。
3. 建立 local DSXU bridge server / stream-json contract：VS Code、外部 IDE、AionUi 类 host 都通过同一 contract 调用 DSXU。
4. 将 IDE 文件 edit 变成 DSXU Tool Gate 行为：diff preview、accept/reject、rollback、post-edit verification。
5. 将 IDE 权限弹窗接回 `permissionControlBridge`，拒绝后进入 DSXU recovery path。
6. 将 IDE timeline 映射到统一 Work-State：目标、工具、Agent、测试、成本、失败、下一步。
7. 建立 install/auth/reconnect/doctor smoke：新 VS Code 环境安装插件后能启动 DSXU、连接项目、完成一次真实代码修改。
8. 清理旧产品痕迹：协议、日志、client name、UI 文案不得残留第三方品牌暗示。

验收：

- VS Code 插件/API bridge 能完成真实小型代码任务：读文件、修改、展示 diff、请求权限、运行测试、显示 final evidence。
- IDE 入口与 CLI/TUI 使用同一 Query Loop、Tool Gate、Permission、Evidence。
- 断线重连后能恢复 session state。
- 发布包里不需要 Claude 源码目录或第三方产品目录。
- 未完成前只能公开写 `IDE/API bridge foundation`，不能写 `VS Code extension completed`。

## 6. 执行顺序

V24 按以下顺序执行，不能小步绕 gate，也不能先测试再补功能判断。

| 顺序 | 阶段 | 目标 | 输出 |
|---:|---|---|---|
| 0 | Baseline Audit | 固定 V18/V19/V20/V24 当前事实、DeepSeek docs snapshot、git/index、C2 feature loss。 | `V24_BASELINE_AUDIT` |
| 1 | Runtime / Stub Redline | 先扫第二 runtime、stub、TODO、旧品牌、SDK/MCP/API 未完成边界。 | `V24_RUNTIME_STUB_REDLINE` |
| 2 | Claude Experience Density Rebaseline | 重新按 15 条大闭环和 36 条二级闭环读取 Claude 1902 与 DSXU 主线，不把文件归属当体验完成。 | `V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE` |
| 3 | DeepSeek Runtime Contract | thinking/tools/schema/cache/FIM/cost/latency 全部原生化。 | `V24_DEEPSEEK_RUNTIME_CONTRACT` |
| 4 | Senior Work-State | DSXU 窗口/TUI/CLI/stream-json 可见状态闭环。 | `V24_WORK_STATE_TIMELINE_ACCEPTANCE` |
| 5 | C2 Experience Loop Acceptance | 1902 映射转真实体验闭环验收，不把 owner signoff 当 feature parity。 | `V24_C2_FEATURE_ACCEPTANCE_MATRIX` + `V24_C2_EXPERIENCE_LOOP_DENSITY_SCORECARD` |
| 6 | Ecosystem Capability Pack | MCP/project/external host/terminal/browser 兼容入口，仍进 DSXU owner。 | `V24_ECOSYSTEM_COMPATIBILITY_PACK` |
| 7 | IDE/API Bridge MVP | 先做 IDE bridge protocol、local API、diff/permission/timeline smoke，再做插件壳。 | `V24_IDE_API_BRIDGE_ACCEPTANCE` |
| 8 | Real Operation Suite | 功能、体验、恢复、性能、评测、发布六阶段真实测试。 | `V24_REAL_OPERATION_EVIDENCE` |
| 9 | Public Challenge Harness | 公开任务挑战，保存 raw transcript、patch、tests、metrics、失败归因。 | `V24_PUBLIC_CHALLENGE_REPORT` |
| 10 | GitHub Product Data Pack | 开源卖点、对比数据、README、demo、public claim guard。 | `V24_PRODUCT_DATA_PACK` |
| 11 | 95 Score Gate | 汇总 100 分制评分，低于 95 不宣称达标。 | `V24_95_SCORECARD` |
| 12 | Clean Export + Install Smoke | 显式 release/export action，fresh install/run/help/doctor/provider gate。 | clean export artifact |

## 7. V24 100 分评分模型

| 维度 | 分值 | 通过标准 |
|---|---:|---|
| DeepSeek 原生运行时 | 10 | thinking/tools/cache/FIM/cost/schema 全部可审计。 |
| 单主线架构 | 9 | 无第二套 query/tool/permission/agent/MCP/provider runtime。 |
| 高级编程工作流 | 11 | 多文件理解、改动、测试、报告闭环。 |
| UI/TUI 可见体验 | 9 | 状态、权限、失败、恢复、Agent、成本可见。 |
| Context/Recovery | 8 | 长任务、compact、resume、失败恢复有效。 |
| Agent 并行 | 7 | worker evidence、父级 synthesis、取消/恢复明确。 |
| 生态兼容 | 7 | MCP/project/host/terminal/browser 入口统一进 owner。 |
| IDE/API Bridge | 6 | VS Code/API bridge 产品化，仍复用单主线 runtime。 |
| C2 体验闭环密度验收 | 15 | 1902 映射背后的 15 条大闭环和 36 条二级闭环不假完成、不丢机制。 |
| 公开挑战与产品数据 | 10 | 公开任务 raw evidence、GitHub 卖点数据和对比表达达标。 |
| 发布可信 | 8 | clean export、license/notice、安装 smoke、风险说明。 |

达标线：

- 95 分以上：可以宣称 V24 目标达成。
- 90-94 分：只能宣称 V20+ 强化版，不能宣称 95 分。
- 80-89 分：能力可用但体验不够高级。
- 低于 80 分：回到 owner 改造，不进入公开挑战宣称。

硬性一票否决：

- 出现第二套 product runtime。
- 出现未验证 final PASS。
- 公开挑战伪造 raw evidence。
- release 包含不应发布的 `.git`、`.dsxu`、`node_modules`、证据库或第三方品牌误导。
- DeepSeek 官方接口关键约束不满足。

## 8. 本轮立即执行清单

下一轮不应再做小补丁，应一次性推进以下批量工作：

1. 新建 V24 baseline audit 脚本：汇总 V18/V19/V20 状态、C2 体验闭环缺口、DeepSeek docs snapshot、git/index 状态。
2. 新建 runtime/stub redline 扫描：query/tool/permission/agent/MCP/provider/product entrypoints、SDK stub、MCP TODO、旧品牌痕迹、bridge/facade 边界。
3. 新建 C2 experience density rebaseline：按 15 条大闭环和 36 条二级闭环重新扫描 Claude 1902 与 DSXU 主线，输出真实差距。
4. 新建 DeepSeek runtime contract 审计：检查 thinking+tools、reasoning_content 回传、tool schema strictness、cache prefix、FIM、cost/latency 边界。
5. 新建 work-state timeline acceptance：统一 TUI/CLI/stream-json 状态，不泄露隐藏推理。
6. 新建 C2 experience acceptance matrix：把 1902 文件 owner-disposition 转成行为域、窗口体验和真实任务验收。
7. 新建 ecosystem capability pack 文档与接口合同：MCP、Claude-style project intake、external host、terminal host、browser provider。
8. 新建 IDE/API bridge MVP plan：DSXU IDE bridge protocol、local API、VS Code smoke、权限、diff、timeline、doctor smoke。
9. 新建 real operation suite runner：功能、体验、恢复、性能、评测、发布六阶段。
10. 新建 public challenge plan：定义任务来源、通过标准、raw evidence 格式和失败归因。
11. 新建 GitHub product data pack：卖点、对比数据、README 发布区、demo 场景、public claim guard。
12. 新建 95 scorecard gate：所有 V24 evidence 汇总成分数，不够 95 不宣称达标。
13. 最后执行 clean export + fresh install smoke。

这些工作允许新增脚本、测试和文档，但必须挂回现有 owner，不允许新增第二主链、第二入口、桥接 holding path 或 generic bucket。

### 8.1 本轮 V24 批量执行结果

已执行命令：

```powershell
bun run v24:batch
```

本轮不是最小验收，而是一次性推进前 6 个 V24 evidence gate：

| Gate | 输出 | 当前状态 | 下一步 |
|---|---|---|---|
| `V24_BASELINE_AUDIT` | `docs/generated/DSXU_V24_BASELINE_AUDIT_20260515.json` | `PASS_BASELINE_FIXED_WITH_OPEN_GATES` | 只固定事实，不宣称 95 分。 |
| `V24_RUNTIME_STUB_REDLINE` | `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.json` | `OPEN_REDLINE_REVIEW_REQUIRED` | 按 owner 处理 7462 条 redline review 输入。 |
| `V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE` | `docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json` | `PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU` | 15 条大闭环、36 条二级闭环和 30-45 分钟真实 senior-coding window 已完成第一轮真实验收；仍缺固定 benchmark、六阶段测试和 clean export。 |
| `V24_C2_FEATURE_ACCEPTANCE_MATRIX` | `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json` | `PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH` | 51/51 体验闭环矩阵已有真实 DSXU 行为证据。 |
| `V24_DEEPSEEK_RUNTIME_CONTRACT` | `docs/generated/DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_20260515.json` | `SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED` | 做 thinking/tools/cache/FIM/cost 的 raw trace，不用信号数冒充验收。 |
| `V24_WORK_STATE_TIMELINE_ACCEPTANCE` | `docs/generated/DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_20260515.json` | `SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED` | 跑真实窗口或 stream-json 体验证据。 |

当前真实数字：

| 项 | 数值 |
|---|---:|
| publish surface files | 2891 |
| DSXU `src` source files | 2650 |
| Claude reference `src` files | 1902 |
| `git status --short` | 2064 |
| staged/index paths | 2024 |
| unstaged paths | 35 |
| untracked paths | 32 |
| runtime/stub redline rows | 7462 |
| redline `BLOCKER_REVIEW` rows | 115 |
| redline `OWNER_REVIEW` rows | 5896 |
| redline `RELEASE_COPY_REVIEW` rows | 55 |
| redline `INFO_REVIEW` rows | 1396 |
| C2 primary loops | 15 |
| C2 secondary loops | 36 |
| C2 acceptance matrix rows | 51 |

Redline owner packet 排序：

| Owner | Total | Blocker | Owner Review | Release Copy | 首要动作 |
|---|---:|---:|---:|---:|---|
| `cli-command-transport` | 717 | 26 | 688 | 1 | 证明 CLI/entrypoint 只投射到单主线，不形成第二 runtime。 |
| `ui-tui-work-state` | 833 | 24 | 796 | 3 | 证明窗口状态、prompt、REPL、可见状态闭环。 |
| `model-router-cost` | 790 | 8 | 779 | 0 | 证明 provider/cache/cost 是 DeepSeek 主线，不是迁移残留。 |
| `tool-lifecycle` | 758 | 7 | 704 | 11 | 证明工具只进 Tool Gate，stub/test-only 明确分流。 |
| `mcp-skill-registry` | 538 | 7 | 521 | 5 | 证明 registry/intake，不留 standalone MCP/skill runtime。 |
| `config-settings` | 461 | 7 | 443 | 2 | 证明配置、环境、auth/settings 只是主线输入，不是旁路。 |
| `api-contract-types` | 85 | 5 | 80 | 0 | 证明 SDK/schema/API contract 不自带执行 runtime。 |
| `coding-workflow` | 85 | 5 | 73 | 3 | 证明读写 diff/test 都进 coding workflow 和 Tool Gate。 |
| `query-loop` | 63 | 5 | 58 | 0 | 证明 query/session/topic 仍是唯一编排入口。 |
| `hook-lifecycle` | 36 | 5 | 31 | 0 | 证明 hooks 只是 lifecycle extension，不绕过权限和证据。 |

本轮已把 `source-owner-review` 从 3326 条拆到 0 条，不再保留 generic bucket。`test-evidence-harness=1164` 和 `evidence-automation=136` 被明确为证据/测试上下文，不按 product runtime 失败处理；`TODO` 词碰撞 96 条已单独标记为 `todo_word_collision_not_incomplete_claim`，不再当作未实现功能。

本轮明确不能宣称：

- 不能宣称 C2 1902 已逐文件逐行为 feature parity；但 1902 文件 owner/evidence join 和 51 条体验闭环行为矩阵已完成第一轮真实验收。
- 不能宣称 DeepSeek runtime contract 已产品级通过；现在是 source signal present，仍缺 raw behavior trace。
- 不能宣称 UI/TUI 高级体验最终 95 分通过；已有真实 TUI 证据和 30-45 分钟 senior-coding window，但仍缺固定 benchmark、六阶段测试、clean export 和 fresh install 复核。
- 不能进入最终全量测试或 clean export；最终测试只能在长窗口、公开 benchmark 数据包和 release gate 关闭后作为证明。

下一步硬顺序：

1. 建固定公开 benchmark / product demo 数据包，保留 raw transcript、patch、tests、metrics、失败归因。
2. 跑六阶段最终测试：功能测试 -> 体验测试 -> 恢复测试 -> 性能测试 -> 评测测试 -> 发布收口测试。
3. 显式创建 clean export artifact，再做 fresh install / help / doctor / provider gate smoke。

## 9. 当前不能宣称的事情

为了避免假完成，以下结论当前不能宣称：

- 不能说 C2 1902 已经逐文件逐行为 feature parity。可以说 1902 文件 owner/evidence join 已闭环，51 条体验闭环行为矩阵已通过第一轮真实验收。
- 不能说 Claude 高级程序员体验已经最终完全吸收。可以说 15 条大闭环、36 条二级闭环和 30-45 分钟 senior-coding window 已有第一轮真实代码/测试/live/Flash 证据；仍缺固定 benchmark、六阶段测试和 release 复核。
- 不能说 V20 生态兼容能力包已完成。只能说方向和边界已定义。
- 不能说 DSXU 已经 95 分。现在缺固定公开 benchmark 对比数据、六阶段最终测试、clean export artifact 和 fresh install/release smoke。
- 不能说 VS Code plugin/API bridge 已完成。现在只有 control-plane/MCP/SDK/remote 底座和 focused evidence。
- 不能说 GitHub 卖点数据已完成。现在需要 V24-I 生成对比数据包和 README claim guard。
- 不能说性能测试充分。当前性能证据偏轻，V24 必须补 p50/p95、cache ROI、route ratio、long-run cost。
- 不能说 clean export 已产出。当前是 ready，不是 artifact created。

## 10. 最终目标形态

V24 完成后，DSXU 应该是：

- 一个 DeepSeek 原生 AI 编程产品，不是 Claude 文件复制品。
- 一个单主线 runtime：Query Loop、Tool Gate、Model Router、Context、Agent、MCP、Evidence、UI/TUI 都有明确 owner。
- 一个能真实操作代码、恢复失败、并行处理、控制成本、留下证据的高级程序员工作台。
- 一个能被 AionUi/终端/外部 UI/MCP/browser provider 调用的独立产品，而不是依赖那些产品。
- 一个能通过 VS Code/API Bridge 进入 IDE，但仍复用 DSXU 单主线 runtime 的产品。
- 一个在 GitHub 上有真实卖点、真实对比数据、真实 demo 和 public claim guard 的开源项目。
- 一个能挑战公开任务、承认失败、给出 raw evidence 的可审计系统。
- 一个可发布的 DeepSeek 生态开源项目。

V24 的一句话标准：

**基于 DeepSeek 官方接口能力，把 DSXU 变成一个可发布、可挑战、可复核、单主线、95 分级的高级 AI 编程与复杂任务执行系统。**

## 11. V24 真实验收纪律：所有 PASS 必须回测

从本节开始，V24 的验收口径升级为“真实能力验收”，不再接受仅由文档、静态扫描、本地单元测试、owner-disposition、一次模型回答或 readiness 报告构成的最终 PASS。上述证据仍然有价值，但只能作为准备证据、回归证据或辅助证据，不能替代 DSXU 产品入口、DeepSeek 大模型、真实工具调用、真实窗口/stream-json 体验、真实失败恢复和真实 raw evidence。

### 11.1 PASS 重新定义

V24 任一能力域要宣称 PASS，必须同时满足：

| 要求 | 验收标准 |
|---|---|
| 产品入口真实 | 通过 `dsxu-code` / `dsxu` 产品入口运行，不只直接 import 内部函数。 |
| DeepSeek 真实模型 | 默认必须 Flash-first，主要使用 `deepseek-v4-flash`；Pro 不是默认验收模型，只能在高风险权限/安全、复杂规划、失败恢复、Flash 验证失败或 Flash 与 source truth 冲突后按 admission reason 启用。 |
| 真实工具链 | Read/Edit/Bash/PowerShell/MCP/Browser/Agent 等按能力域进入统一 Tool Gate、Permission Gate、Evidence，不允许绕过。 |
| 真实交互窗口 | 必须打开 DSXU 真实交互 TUI/窗口运行任务；`-p`、stream-json、脚本 smoke 只能算自动化证据，不能替代体验验收。 |
| 真实 raw evidence | 保留 stream-json transcript、tool trace、model usage、cost/cache、final result、failure/recovery 记录。 |
| 本地回归证据 | 对应单测/集成测试要能复跑，证明实现没有退化。 |
| 源码真相复核 | 模型判断必须被 source truth 与测试结果校验；模型误判不能直接成为 FAIL 或 PASS。 |
| 负例/恢复 | 关键能力至少包含一个失败或拒绝路径，证明系统不会假完成。 |
| 可复核输出 | 生成 `docs/generated` 或 `.dsxu/trace` 证据，说明命令、时间、输入、输出、风险和下一步。 |

本轮已经出现一个必须吸收的教训：`v24-dsxu-flash-read-pbt-smoke-20260515-rerun.jsonl` 通过 DSXU + DeepSeek Flash + Read 工具真实运行，但 Flash 对 `runPbt()` 是否具备真实 runner 的判断出现误判；随后曾人工用 `v24-dsxu-pro-pbt-source-truth-review-20260515.jsonl` 做复核。这个 Pro trace 只能作为历史纠偏证据，不能成为 V24 默认验收口径。V24 正式纪律已改为 Flash-first 真实调度：先跑 source truth、本地回归、Flash primary；只有 Flash retry 后仍冲突，且显式启用 `DSXU_V24_ALLOW_PRO_RESCUE=1`，才允许 Pro rescue。默认验收必须采用“三方证据”：Flash live trace + source truth + 本地可复跑测试；Pro 只作为被记录的成本路由救援。

### 11.2 已通过项必须回测

历史上 V18/V19/V20/V24 已标 PASS、READY、DONE、SIGNOFF 的项目，V24 不能直接继承为最终 PASS，必须按下列层级回测：

| 历史状态 | V24 处理 |
|---|---|
| 文档 PASS | 转为待回测，不进入 95 分。 |
| 静态扫描 PASS | 只证明结构存在，必须补产品入口行为证据。 |
| owner/Git signoff PASS | 只证明归属/去重成立，必须补真实能力验收。 |
| 本地单测 PASS | 只证明实现片段可运行，必须补 DSXU 产品入口 + DeepSeek live smoke。 |
| readiness PASS | 只证明条件具备，必须补真实 raw run。 |
| live trace PASS | 需要 source truth 与本地回归交叉验证，防止模型误判。 |

V24 最终测试顺序保持：功能测试 -> 体验测试 -> 恢复测试 -> 性能测试 -> 评测测试 -> 发布收口测试。测试只作为证明，不替代功能判断；但任何最终 PASS 都必须至少落入这一条链路中的一个真实验收包。

### 11.3 真实交互体验验收：必须打开 DSXU

V24 目标不是“命令能跑”，而是 DSXU 像高级程序员一样协作、执行、恢复和解释。因此所有核心能力最终都必须经过真实交互体验验收：打开 `dsxu` / `dsxu-code` 的实际 TUI 或窗口，在用户可见界面里运行复杂任务，而不是只看脚本输出。

真实交互验收必须覆盖：

| 体验点 | 验收标准 |
|---|---|
| 启动体验 | 从真实终端/窗口启动 DSXU，进入当前仓库，能看到正确模型、权限模式、工具/技能状态和工作目录。 |
| 目标保持 | 进行 30-45 分钟复杂任务时，DSXU 不丢目标、不反复问已知问题、不把旧计划当完成。 |
| 可见工作状态 | 用户能在窗口里看到当前目标、计划、正在做什么、调用了什么工具、失败在哪里、下一步是什么。 |
| 高级程序员感 | 真实读代码、定位 owner、做取舍、合并重复、修失败、解释风险，而不是机械跑命令或堆报告。 |
| 权限与安全 | 文件写入、命令、MCP、Browser、Agent 等风险动作必须有可见权限/策略行为，不能无声绕过。 |
| 失败恢复 | 故意制造测试失败、命令失败、权限拒绝、上下文中断，观察 DSXU 是否能恢复并继续目标。 |
| 成本路由 | 默认 Flash-first；窗口/trace 能显示或记录 route reason、usage、cache、cost；Pro 只在准入条件下使用。 |
| Agent 协作 | 如果使用 Agent，窗口/trace 必须显示 worker 边界、结果、父级整合和证据来源。 |
| 长上下文恢复 | compact/resume 后必须重新抓 source truth，恢复目标、文件、风险和下一步。 |
| 可继续操作 | 任务结束时用户应能清楚知道完成了什么、还剩什么、如何继续，而不是只得到一句 PASS。 |

真实交互验收产物必须包括：

1. 交互启动命令和环境记录。
2. TUI/窗口截图或终端录制摘要。
3. 对应 raw transcript / stream-json / `.dsxu/trace` 证据。
4. 用户可见状态观察记录：计划、工具、权限、失败、恢复、成本、下一步。
5. 与本地测试和 source truth 的交叉验证。
6. 体验评分与问题清单：低于 95 分的体验点必须回到 V24 backlog，不能标最终 PASS。

`bun run v24:live-acceptance` 这类脚本是必要的自动化验收，但只覆盖产品入口和模型/工具 raw trace；真实高级体验必须再跑 TUI/窗口任务。后续 V24 应新增 `V24_INTERACTIVE_TUI_ACCEPTANCE`，专门记录真实交互测试任务、体验问题、截图/录制、修复项和回测结果。

### 11.4 C2 Claude 1902 的真实验收要求

C2 Claude 1902 文件能力映射不能再只看“文件是否归属到 DSXU owner”。Claude 高级程序员体验的价值在体验闭环密度，所以 V24 必须把 1902 文件背后的能力拆成真实任务验收：

| C2 体验闭环 | 真实验收要求 |
|---|---|
| Goal / Session Loop | 真实长任务里保持目标、约束、下一步，不因中断或上下文压缩漂移。 |
| Visible Work-State Loop | UI/TUI 或 stream-json 能看到计划、工具、权限、失败、恢复、成本、下一步。 |
| Tool Lifecycle Loop | 工具 schema、权限、执行、结果、posthook、evidence 成对出现。 |
| Permission / Safety Loop | 拒绝、允许、权限桥、visible projection 都进入单一 Permission/Tool Gate。 |
| Source Truth / Coding Loop | 真实读文件、改文件、跑测试、修失败，不用计划冒充完成。 |
| Plan / Todo / Task Loop | Todo 状态必须随真实工作变化，未验证不得 complete。 |
| Agent Delegation Loop | Agent/worker 有边界、有证据，parent synthesis 只整合真实 worker output。 |
| Context / Memory / Compact Loop | compact/resume 后能重建目标、文件、风险和下一步，并重新读 source truth。 |
| Failure / Recovery Loop | 工具失败、测试失败、provider 失败、权限拒绝都有 named recovery。 |
| Model / Cost / Cache Loop | Flash-first、Pro rescue、thinking、FIM、cache、usage/cost 都有任务级 trace。 |
| MCP / Skill / Plugin Loop | 外部工具只进统一 registry 和 Tool Gate，不形成 standalone runtime。 |
| IDE / Remote / API Loop | VS Code/API/外部 host 只做入口，执行仍走 DSXU 单主线。 |
| Browser / External Action Loop | browser provider 作为受控 tool，不绕过权限和证据。 |
| Telemetry / Evidence / Report Loop | 每个 PASS/PARTIAL/FAIL 都有 raw transcript、metrics、risk。 |
| Release / Doctor / Install Loop | clean export、fresh install、doctor、help、demo 都可复跑。 |

每条 C2 闭环必须至少有：

1. 一个 DeepSeek live DSXU 产品入口任务。
2. 一个真实 TUI/窗口交互任务，观察用户可见体验是否像高级程序员协作。
3. 一个本地回归或集成测试。
4. 一个 raw evidence 路径。
5. 一个失败/恢复或边界负例。
6. 一个 owner 映射说明，证明没有第二套 runtime。

### 11.5 V24 后续执行顺序更新

后续执行不再先追求“报告数量增加”，而是按真实验收价值排序：

1. 先建立 `V24_REAL_ACCEPTANCE_REPLAY_REGISTER`：把 V18/V19/V20/V24 已标 PASS/READY/DONE 的项目列出，标记是否已有 DSXU + DeepSeek live trace、source truth、本地回归、失败恢复和 raw evidence。
2. 对 C2 15 条大闭环和 36 条二级闭环逐条补真实验收包，先做 Goal/Visible Work-State/Tool/Permission/Source Truth/Context Recovery/Model Cost/Agent。
3. `V24_INTERACTIVE_TUI_ACCEPTANCE` 已新增并完成第一轮真实 TUI 验收：真实打开 DSXU TUI，覆盖启动、权限可见性、失败恢复、工具结果 auto-continue、compact resume、后台任务和模型任务；后续继续扩展到 30-45 分钟复杂高级编程任务。
4. 修复 `package.json` 中指向缺失脚本的 live 命令，不能让发布产品带断裂入口。
5. 对当前 runtime/stub redline 的 blocker owner 继续真实收口，优先 SDK/API contract、CLI command transport、UI/TUI work-state、model-router-cost、tool-lifecycle、MCP/skill registry。
6. 只有当真实验收包覆盖核心能力后，再进入六阶段完整测试和 clean export。
7. 所有 live 验收必须通过 route-controlled runner，例如 `bun run v24:live-acceptance`；禁止直接把 `--model deepseek-v4-pro` 当默认验收手段。任何 Pro 调用必须写入 admission reason、Flash 尝试证据、成本证据和是否救回任务。

### 11.6 当前新增真实验收证据

| 证据 | 状态 | 结论 |
|---|---|---|
| `.dsxu/trace/v24-live-dsxu/v24-dsxu-flash-read-pbt-smoke-20260515.jsonl` | FAIL_EVIDENCED | 产品入口参数错误：`--output-format=stream-json` 需要 `--verbose`。保留为入口负例。 |
| `.dsxu/trace/v24-live-dsxu/v24-dsxu-flash-read-pbt-smoke-20260515-rerun.jsonl` | PASS_WITH_MODEL_JUDGMENT_RISK | DSXU + DeepSeek Flash + Read 工具 + usage/cost/cache 成功，但模型对 PBT runner 真实性误判。 |
| `.dsxu/trace/v24-live-dsxu/v24-dsxu-pro-pbt-source-truth-review-20260515.jsonl` | HISTORICAL_EXCEPTION_NOT_DEFAULT_ACCEPTANCE | 曾用于纠正 Flash 误判；不作为 V24 默认验收口径，后续必须 Flash-first 并由路由门决定 Pro admission。 |
| `docs/generated/DSXU_V24_LIVE_ACCEPTANCE_ROUTER_20260515.json` | PASS_FLASH_FIRST_EVIDENCED | `bun run v24:live-acceptance` 真实执行 DSXU 产品入口，默认 `deepseek-v4-flash`，`proWasRun=false`，Flash 判断与 source truth 和本地回归一致。 |
| `bun test src/services/pbt/__tests__/pbt.test.ts src/services/mutation/__tests__/mutation.test.ts src/coordinator/tdd-gate/__tests__/runner.test.ts` | PASS_LOCAL_REGRESSION | 37 tests / 0 fail；只能证明本地实现回归，不单独构成 V24 最终验收。 |
| `bun run v24:completed-reacceptance` | PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE | 对已完成验收的 PBT real runner、mutation real runner、TDD gate real runner 重新执行真实调度验收：source truth=true、本地回归=true、Flash live=true、`proWasRun=false`。 |
| `docs/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.md` / `docs/generated/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.json` | PASS_EVIDENCE_RECORDED | 已记录 3 条 Flash live traces、local regression、live provider gate、V24 batch replay、产品 help entry；该证据仍不替代 `V24_INTERACTIVE_TUI_ACCEPTANCE`。 |
| `bun run v24:interactive-tui-acceptance` | PASS_INTERACTIVE_TUI_ACCEPTANCE | 真实 WSL PTY 打开 DSXU TUI，7 个场景通过，WSL provider gate=READY，本地回归通过，Flash-first 复核通过，`proWasRun=false`。 |
| `docs/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md` / `docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json` | PASS_EVIDENCE_RECORDED | 已记录 7 条 TUI transcript/trace/lifecycle evidence，并生成 compact Flash review input，避免模型读取超大 raw transcript 时误失败。 |
| `bun run v24:c2-loop-acceptance` | PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH | C2 15 条大闭环和 36 条二级闭环全部绑定真实行为证据；6 组 focused regression 全部 exit=0；DeepSeek Flash 复核通过；`proWasRun=false`。 |
| `docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md` / `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json` | PASS_EVIDENCE_RECORDED | 已记录 51/51 rows、Flash review trace、command stdout/stderr、compact review input；完整 raw evidence 留在 `.dsxu/trace/v24-c2-loop-real-acceptance/*`。 |
| `bun run clean-export:preflight` | PASS_READY_TO_CREATE_CLEAN_EXPORT | release/export gate 仍可放行，`canCreateCleanExport=true`、`didCreateExport=false`、`blockers=0`；本轮只做 preflight，没有创建导出包。 |

这些证据把 PBT/mutation/TDD gate 从“本地实现已补”推进为“已有第一组 DSXU + DeepSeek live 复核样本”，把真实 TUI 交互补成第一轮产品入口体验证据，并把 C2 owner-disposition 推进为 51/51 行为证据矩阵通过。2026-05-15 后续已补 30-45 分钟 senior-coding window；结论仍不能宣称 V24 全面达标，因为还缺固定公开 benchmark、六阶段最终测试和发布包。

### 11.7 已完成项回测结论

2026-05-15 本轮已按“Flash-first、产品入口、source truth、本地回归、raw evidence”标准重测当前已完成验收项：

| 能力项 | 回测结论 | 证据 |
|---|---|---|
| PBT real runner | `PASS_FLASH_FIRST_REACCEPTED` | `.dsxu/trace/v24-completed-reacceptance/flash-pbt-real-runner-2026-05-15T05-58-35-539Z.jsonl` |
| Mutation real runner | `PASS_FLASH_FIRST_REACCEPTED` | `.dsxu/trace/v24-completed-reacceptance/flash-mutation-real-runner-2026-05-15T05-58-35-544Z.jsonl` |
| TDD gate real runner | `PASS_FLASH_FIRST_REACCEPTED` | `.dsxu/trace/v24-completed-reacceptance/flash-tdd-gate-real-runner-2026-05-15T05-58-35-548Z.jsonl` |
| Provider gate / V24 batch / product help | `PASS_COMMAND_EVIDENCE` | `docs/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.md` |

本轮没有调用 Pro。成本路由符合 V24 纪律：默认使用 `deepseek-v4-flash`，只有 Flash 与 source truth 冲突且显式启用 rescue 时才允许 Pro。当前 3 个 completed feature 不需要 Pro rescue。

仍然未覆盖的 gate：固定公开 benchmark / product demo 对比数据、Agent/MCP/权限/恢复/性能/发布包完整链路的六阶段最终测试和 clean export。因此本轮不能把 95 分目标标为达成。

### 11.8 真实 TUI 交互验收结论

2026-05-15 本轮已新增并执行 `V24_INTERACTIVE_TUI_ACCEPTANCE`，不是只跑 `-p` 或 stream-json。验收通过真实 WSL PTY 启动 `bin/dsxu-code`，采集 transcript、trace、lifecycle，并用 `deepseek-v4-flash` 读取 compact review input 做复核。Pro 未调用。

| 场景 | 状态 | 覆盖能力 |
|---|---|---|
| startup-exit | `PASS_TUI_EVIDENCED` | 启动体验、可见工作状态、release/doctor/install 基础入口。 |
| permission-fallback | `PASS_TUI_EVIDENCED` | 权限提示、fallback bar、visible permission state。 |
| no-progress-recovery | `PASS_NEGATIVE_RECOVERY_EVIDENCED` | 无进展/卡住状态可见、stall trace、恢复路径。 |
| auto-continue | `PASS_TUI_EVIDENCED` | tool result auto-continue、query_loop owner、无手动 continue 依赖。 |
| compact-resume | `PASS_TUI_EVIDENCED` | compact/resume 后 source truth gate、provider preflight、恢复继续。 |
| background-task | `PASS_TUI_EVIDENCED` | Agent/background task pill、lifecycle evidence、用户可见状态。 |
| model-task-auth-or-progress | `PASS_TUI_EVIDENCED` | 真实模型任务入口、目标输入、TUI 任务进展/提示恢复。 |

证据路径：

- `docs/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md`
- `docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json`
- `docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_REVIEW_INPUT_20260515.json`
- `.dsxu/trace/v24-interactive-tui-acceptance/*`

本轮结论：真实 TUI 交互 gate 第一轮通过，覆盖 7 个场景和 11 个 C2 体验闭环；这比之前的自动化 live smoke 更接近高级程序员体验验收。

仍不能宣称 V24 95 分最终达成，因为还缺：

1. 固定公开 benchmark / product demo 对比数据。
2. Agent/MCP/permission/cost public challenge package 的可比较数据。
3. 六阶段最终测试和 clean export。

### 11.9 C2 体验闭环全量行为矩阵验收结论

2026-05-15 本轮已执行 `bun run v24:c2-loop-acceptance`，把 C2 从“1902 文件 owner-disposition 已闭环”推进到“体验闭环行为证据矩阵已闭环”。该验收不是只看文件归属，也不是只看文档，而是把 15 条大闭环和 36 条二级闭环分别绑定到 DSXU TUI/product entry、focused regression、DeepSeek Flash review 和 raw evidence。

验收结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH` |
| Primary loops | 15/15 `PASS_BEHAVIOR_EVIDENCE_LINKED` |
| Secondary loops | 36/36 `PASS_BEHAVIOR_EVIDENCE_LINKED` |
| Total rows | 51/51 `PASS_BEHAVIOR_EVIDENCE_LINKED` |
| Focused regression | 6/6 command batches exit=0 |
| DeepSeek review | `deepseek-v4-flash` 复核通过，costUSD=0.0015664208 |
| Pro usage | 未调用 Pro，`proWasRun=false` |
| Runtime policy | 未新增第二套 runtime；证据归入 Query Loop、Tool Gate、Permission Gate、Agent/MCP/Skill、Model/Cost、Evidence、Release owner |

6 组回归证据覆盖：

1. `core-query-context-regression`
2. `tool-permission-regression`
3. `agent-mcp-skill-regression`
4. `model-cost-cache-regression`
5. `external-release-regression`
6. `api-remote-evidence-regression`

证据路径：

- `docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md`
- `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json`
- `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_REVIEW_INPUT_20260515.json`
- `.dsxu/trace/v24-c2-loop-real-acceptance/*`

本轮结论：C2 “体验闭环密度吸收”不再停留在文件映射层，已经具备第一轮全量行为矩阵 PASS，并且后续 30-45 分钟 senior-coding window 已补齐。它仍不等于 V24 95 分最终达成，因为 95 分还要求固定公开挑战数据、六阶段最终测试、clean export 和 fresh install/release 复核。

### 11.10 公开挑战与 GitHub 产品数据包验收结论

2026-05-15 本轮已执行 `bun run v24:public-challenge`，把当前 V24 证据整理成 GitHub 开源发布可用的产品 claim guard 和公开挑战证据包。该验收不是最终 clean export，也不是最终 95 分宣称；它的作用是证明当前可以公开展示哪些能力、哪些 claim 必须继续挡住。

本轮中途先发现两个真实问题，并已在同轮修复：

1. `runQuery()` 原实现会先 `for await` 消费一次完整 query loop，再创建第二个 generator 取返回值，导致模型调用双执行、成本和延迟翻倍。已修成单 generator pass，并新增 `query-loop-run-query-v1.test.ts` 证明 `llmCall` 只调用一次。
2. release provenance 测试旧假设要求 review debt 必须大于 0；当前发布面更干净时 review debt 可以为 0。已改为允许 harness 为 0，同时新增样本测试证明非 source-truth provenance reference 仍会被抓成 review。

验收结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_PUBLIC_CHALLENGE_PACKAGE_READY` |
| Command batches | 4/4 pass |
| Flash reviews | 3/3 pass |
| C2 behavior matrix | 51/51 pass |
| TUI replay | pass |
| Completed reacceptance | pass |
| Clean export preflight | ready; export not created |
| Flash score floor | 82 |
| Flash review total cost | 0.021319888800000002 USD |
| Pro usage | 未调用 Pro，`proWasRun=false` |

本轮允许进入 GitHub/README 的卖点：

- Flash-first DSXU 产品入口证据可展示，当前包不需要 Pro。
- C2 experience-loop behavior matrix 已有 51/51 行为证据。
- 真实 TUI replay 覆盖启动、权限可见性、失败恢复、compact resume、后台任务和模型任务进展。
- Clean export preflight ready，且本轮明确 `didCreateExport=false`，没有提前创建导出包。
- release public-surface gates 已能识别 V24 source-truth docs，不把 source-truth 文档误当 public product claim。

仍然禁止宣称：

- 不能宣称 V24 最终 95 分已经达成。
- 不能宣称独立 benchmark superiority；还需要固定公开任务包和可比较数据。
- 不能宣称嵌入第三方产品 runtime；生态兼容只能表述为 DSXU-owned intake/host contracts。
- 不能宣称 clean export artifact/fresh install 已完成；本轮只是 preflight ready。

证据路径：

- `docs/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.md`
- `docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json`
- `.dsxu/trace/v24-public-challenge-package/*`
- `src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts`

本轮结论：公开挑战/产品数据包 gate 已通过，且过程中修掉了一个真实成本 bug。V24 仍未进入最终 95，因为还缺固定公开 benchmark 对比数据、六阶段最终测试、clean export artifact 和 fresh install/release smoke。

### 11.11 V24 复杂任务验收包

2026-05-15 新增 `bun run v24:complex-task`，用于把“高级程序员复杂任务体验”从单点验收推进到组合验收包。它一次性重放：

1. Query Loop 单次执行/成本回归，证明 `runQuery()` 不再双跑 generator、不重复触发模型调用。
2. Release surface 回归，证明 V24 source-truth 文档不会被误判为 public claim，但非 source-truth provenance 仍会被 review gate 捕获。
3. `bun run v24:public-challenge`，重放 completed reacceptance、真实 TUI、C2 行为矩阵、clean-export preflight 和公开产品 claim guard。
4. 两轮 DeepSeek `deepseek-v4-flash` 复核：source-truth complex-task review 与 public-benchmark readiness review。

本节点的纪律：

- 默认只用 `deepseek-v4-flash`；Pro 不作为验收默认路径，只有 Flash 冲突或明确 rescue 证据时才允许进入。
- 通过标准是 `PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY`，不是最终 95 分达成。
- 如果重放窗口没有达到连续 30-45 分钟真实高级编程交互，不允许把 `continuousWindowSatisfied` 写成 true。
- 不创建 clean export artifact，不做 Git stage/delete/commit，不把本地回归冒充最终发布验收。

新增证据路径：

- `scripts/dsxu-v24-complex-task-acceptance.ts`
- `docs/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.md`
- `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json`
- `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_REVIEW_INPUT_20260515.json`
- `.dsxu/trace/v24-complex-task-acceptance/*`

本轮已执行结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY` |
| Command batches | 3/3 pass |
| DeepSeek Flash reviews | 2/2 pass |
| Public challenge replay | pass |
| Pro usage | 未调用 Pro，`proWasRun=false` |
| Flash review cost | 0.010050964000000003 USD |
| Replay window | 465709 ms，未达到 30-45 分钟连续窗口 |
| `continuousWindowSatisfied` | `false` |
| `final95ClaimAllowed` | `false` |
| Flash score floor | 72 |

本节点把公开挑战包、C2 行为矩阵、真实 TUI、completed reacceptance、clean-export preflight 和关键源码回归合成到一个复杂任务验收包里。结论是：复杂任务组合验收包已通过，但最终 95 分仍被正确挡住，不能提前宣称完成。

该节点完成后，30-45 分钟真实高级编程任务窗口已由 `V24_SENIOR_CODING_WINDOW` 补齐；下一步仍是固定公开 benchmark 对比数据 -> 六阶段最终测试 -> clean export artifact -> fresh install/release smoke。

### 11.12 C2 1902 Full Evidence Join

2026-05-15 新增并执行 `bun run v24:c2-1902-evidence-join`，把 Claude `D:\源代码claude\src` 的 1902 个真实源码文件从“owner-disposition 已签收”推进为可审计的全量证据表。这里的 1902 是文件数，不是 CSV 行数，也不是抽象能力条目：

`referencePath -> DSXU owner -> DSXU actual files -> import/use evidence -> test evidence -> live/TUI/API evidence -> disposition`

执行结果：

| 项 | 结果 |
|---|---|
| 总文件数 | 1902 |
| 输出状态 | `GENERATED_FULL_JOIN_WITH_1902_REFERENCE_SOURCE_FILES` |
| 实际参考源码文件数 | 1902 |
| signoff 唯一参考文件数 | 1902 |
| missing reference source files | 0 |
| extra reference source files | 0 |
| C2 loop 行为矩阵 | `PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH`，51/51 |
| owner catalog 缺失 | 0 |
| behavior-linked owner 测试证据缺失 | 0 |
| absorbed into DSXU mainline | 988 |
| product-specific adapt/exclude | 594 |
| product-specific 且 DSXU 直接路径存在 | 545 |
| shared utility total | 278 |
| shared utility imported keep | 73 |
| shared utility baseline/no-new-absorption | 201 |
| shared utility reference-only/no-absorption | 4 |

证据路径：

- `scripts/dsxu-v24-c2-1902-full-evidence-join.ts`
- `docs/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.md`
- `docs/generated/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json`
- `docs/generated/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.csv`

本节点的结论必须保持严格：

- `C2 owner-disposition` 已闭环，不等于 1902 个参考源码文件的所有行为都已 feature parity。
- 594 个 product-specific 文件仍是适配/排除审查，不允许因为 545 个 DSXU 直接路径存在就自动判为吸收完成。
- 278 个 shared utility 必须继续按 imported keep / baseline / reference-only 分层，不能变成第二套 shared runtime。
- 已用 30-45 分钟真实 DSXU senior-coding window 验证长任务目标保持、真实读写、失败恢复、成本路由和用户可见 CLI evidence；最终发布级体验仍需六阶段测试和 clean export 复核。

### 11.13 4.5 Claude 1902 体验闭环密度真实审计

2026-05-15 已执行 `bun run v24:section45-audit`。本节点按 V24 4.5 的真实标准重审：代码证据、测试证据、live/TUI/API 证据、C2 1902 文件 join、C2 51 行体验矩阵、public challenge、complex-task，并用 DSXU 产品入口 + `deepseek-v4-flash` 做只读复核。

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_SECTION_4_5_CODE_TEST_LIVE_AUDIT_WITH_LONG_WINDOW_BLOCKER` |
| 4.5 大闭环 | 15/15 pass |
| C2 1902 文件核对 | 1902/1902，missing=0，extra=0 |
| C2 行为矩阵 | 51/51 pass |
| Public challenge package | `PASS_PUBLIC_CHALLENGE_PACKAGE_READY` |
| Complex task pack | `PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY` |
| Release surface regression | pass |
| 脚本发布面品牌/IP gate | pass；新增验收脚本不再直写参考品牌词 |
| DeepSeek 调度 | Flash-first，`proWasRun=false` |
| 4.5 Flash review cost | 0.005676328 USD |
| Complex task Flash cost | 0.0276526096 USD |
| `continuousWindowSatisfied` | `false` |
| `final95ClaimAllowed` | `false` |

本轮发现并修复的真实问题：

1. 新增 C2/4.5 验收脚本把参考产品名直接写进 `scripts/`，触发 release surface blocker。已改成 reference source 口径和动态标签；canonical docs 可以保留审计背景，发布脚本不能带品牌词。
2. `docs/generated/DSXU_V24_*` 原来在 open-source package manifest 中被默认 `ship`。已改为 canonical planning/generated evidence，clean export 必须 rewrite-or-exclude，避免公开发布包带历史参考词。
3. `completed-reacceptance` 曾把整个 `v24:batch` 当作 completed feature gate，形成循环依赖。已改为 context-only final-gate snapshot；已完成功能复验只看 source truth、本地回归、Flash live、provider gate、product help。
4. C2 agent/MCP/skill 回归在 Windows 上被 Bun 默认 5 秒 per-test timeout 误伤。已给 C2 回归批次显式 `--timeout=60000`，真实 git worktree/MCP 测试仍会失败，但不再被不合理默认超时误判。

证据路径：

- `docs/DSXU_V24_SECTION_4_5_EXPERIENCE_LOOP_AUDIT_20260515.md`
- `docs/generated/DSXU_V24_SECTION_4_5_EXPERIENCE_LOOP_AUDIT_20260515.json`
- `docs/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.md`
- `docs/generated/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json`
- `docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md`
- `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json`
- `docs/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.md`
- `docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json`
- `docs/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.md`
- `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json`

当前可以宣称：

- C2 1902 已完成“文件级 owner-disposition + owner 证据 join + 51 行体验闭环行为矩阵”的第一轮真实验收。
- Claude 高级程序员体验闭环密度的 15 条大闭环已在 DSXU 主线找到代码、测试和 live/TUI/API 证据，并通过 Flash-first 复核。
- 当前 public challenge package 可以作为 GitHub 产品数据包的内部证据基础，但仍不能宣称公开 benchmark 胜出。

当前仍不能宣称：

- 不能宣称 V24 已达到 95 分。
- 不能宣称所有 1902 个参考源码文件都逐行为 feature parity。
- 可以宣称 30-45 分钟 senior-coding window 已完成第一轮真实验收；不能把它单独等同于 V24 95 分最终达成。
- 不能宣称 clean export artifact、fresh install、六阶段最终测试已完成。

下一步固定顺序：

1. 建固定公开 benchmark / product demo 数据包，区分 `PASS`、`PARTIAL`、`NOT_YET_CLAIMED`。
2. 跑六阶段最终测试：功能测试 -> 体验测试 -> 恢复测试 -> 性能测试 -> 评测测试 -> 发布收口测试。
3. 显式执行 clean export artifact + fresh install/release smoke。

### 11.14 本轮人工复核口径

2026-05-15 复核 `D:\源代码claude\src`，确认参考源是 1902 个真实源码文件，不是 1902 行。当前 V24 证据已证明：

- C2 1902 文件级 owner-disposition、owner 证据 join、DSXU actual file 映射、import/use/test/live/TUI/API 证据链已生成，`missingReferenceSourceFiles=0`，`extraReferenceSourceFiles=0`。
- 15 条大体验闭环和 36 条二级体验闭环已进入 DSXU owner 行为矩阵，`PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH`，51/51 pass。
- 4.5 审计已用 `deepseek-v4-flash` 复核，`proWasRun=false`，证明当前遵守 Flash-first 调度纪律。
- release surface、public surface、open-source package gate 已识别 V24 generated evidence 不能默认 ship，clean export 必须 rewrite-or-exclude。

当前 V24 仍不能宣称“全量完成”：

- 1902 文件已经完成 owner/evidence join，不等于逐文件逐行为 feature parity。
- 4.5 已完成第一轮真实代码/测试/live/TUI/API 审计，并已补齐 30-45 分钟 senior-coding window；但这仍不等于 V24 95 分最终发布验收。
- 旧 complex-task pack 的 `continuousWindowSatisfied=false` 已由 `DSXU_V24_SENIOR_CODING_WINDOW_20260515` 纠正为 `continuousWindowSatisfied=true`；`final95ClaimAllowed` 仍为 false。
- `git status --short=2064` 仍未进入最终 clean state；后续必须通过 owner/Git signoff、明确 deletion/release 操作和 clean export 收口。

因此，V24 对 “Claude 高级程序员体验闭环密度” 的正确状态是：已经全量重建为 DSXU 的 15+36 闭环验收模型，并完成第一轮真实证据验收和 30-45 分钟 senior-coding window；但还没有完成最终 95 分产品级证明。下一步必须进入固定公开 benchmark / product demo 数据包、六阶段最终测试和 release/export 收口。

### 11.15 30-45 分钟真实 Senior-Coding Window

2026-05-15 已新增并执行 `bun run v24:senior-coding-window`。该节点不是短 smoke，也不是文档复核，而是通过 DSXU 产品入口 `src/entrypoints/dsxu-code.tsx -p --output-format stream-json` 使用 `deepseek-v4-flash` 连续运行真实高级编程窗口。

执行方式：

- 创建隔离 fixture 工程：`.dsxu/trace/v24-senior-coding-window/workspace-2026-05-15T10-00-38-910Z`。
- 先运行 failing test，确认初始失败。
- 让 DSXU 自己读取 source/test、执行 Edit/Write/Bash、修复 model routing / evidence visibility / recovery summary bug。
- 修复后重跑 fixture test，5/5 pass。
- 在同一窗口继续执行 22 轮 sustained review，覆盖 query loop、Tool Gate、Permission Gate、DeepSeek cost/cache、Agent/MCP/Skill、TUI work-state、release/export 等体验闭环。

结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU` |
| 实际时长 | 1,828,589 ms，约 30.48 分钟 |
| Continuous 30-45 minute window | `true` |
| DSXU product-entry runs | 23 |
| Sustained review rounds | 22 |
| 初始 failing test | captured |
| DSXU source edit | true |
| 最终 fixture test | pass |
| Tool use counts | Bash=9, Glob=100, Read=165, Edit=2, Write=1, Grep=40 |
| Model route | `deepseek-v4-flash` |
| Pro usage | `false` |
| Flash cost | 0.3128853504000001 USD |
| Final 95 claim allowed | `false` |

本轮还发现一个真实权限边界问题：`dontAsk` 会把 Edit/Write/Bash 变成拒绝路径，因此第一轮窗口只得到正确补丁建议但不能执行写入/测试。正式窗口改为“隔离 `.dsxu` fixture only 的 `bypassPermissions` 准入”，并把该准入写入 evidence。这个结论进入 V24 后续设计：真实 coding window 需要明确的权限准入包，不能用 `dontAsk` 假装自动执行。

证据路径：

- `scripts/dsxu-v24-senior-coding-window.ts`
- `docs/DSXU_V24_SENIOR_CODING_WINDOW_20260515.md`
- `docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json`
- `.dsxu/trace/v24-senior-coding-window/*`

本节点完成后，V24 剩余硬顺序变为：

1. 固定公开 benchmark / product demo 对比数据。
2. 六阶段最终测试：功能测试 -> 体验测试 -> 恢复测试 -> 性能测试 -> 评测测试 -> 发布收口测试。
3. clean export artifact。
4. fresh install / help / doctor / provider gate smoke。

### 11.16 固定公开 Benchmark / Product Demo 数据包与六阶段最终测试

2026-05-15 已新增并执行 `bun run v24:product-benchmark-data` 与 `bun run v24:six-stage-final-tests`。本节点按 GitHub 开源发布需要，把“产品卖点”改成可验证数据，不允许把未达标能力写成宣传口径。

公开数据包结果：

| 项 | 结果 |
|---|---|
| 数据包状态 | `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY` |
| 固定 benchmark cases | 98 |
| 固定 public demo tasks | 10 |
| 默认 Flash 路由 | 94/98 |
| Pro 路由 | 4/98，只能由 admission evidence 触发 |
| 当前 public challenge scoreFloor | 72/95 |
| 95 分公开宣称 | `false` |

六阶段最终测试结果：

| 阶段 | 结果 |
|---|---|
| 总状态 | `PASS_V24_SIX_STAGE_FINAL_TESTS` |
| 命令批次 | 20/20 pass |
| 功能测试 | 3/3 pass |
| 体验测试 | 3/3 pass |
| 恢复测试 | 2/2 pass |
| 性能测试 | 3/3 pass |
| 评测测试 | 3/3 pass |
| 发布收口测试 | 6/6 pass |

本轮真实修复：

- `product-runtime-owner-map-v1` 增加了产品主入口 owner map，证明产品入口仍走 `src/entrypoints/dsxu-code.tsx -> src/entrypoints/cli.tsx / src/cli/print.ts -> src/QueryEngine.ts -> src/query.ts`，`src/dsxu/engine/query-loop.ts` 只属于 V24 harness/engine evidence，不是第二套产品 query runtime。
- `v24:interactive-tui-acceptance` 增加了 Windows PTY transient spawn retry 和 canonical evidence mirror，避免把 `OSError(5)` 误判成产品体验失败。
- 六阶段 runner 和 release gate 改为 `./src/...` 路径，避免 Bun 在旧 export/outputs 目录里扫描历史源码副本。

证据路径：

- `docs/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.md`
- `docs/generated/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json`
- `docs/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.md`
- `docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json`

### 11.17 Clean Export、Fresh Install 与 DeepSeek Key 安全边界

2026-05-15 已新增并执行 `bun run v24:clean-export-artifact` 与 `bun run v24:fresh-install-release-smoke`。这一步只创建发布候选 artifact，不 stage、不 commit、不删除源工作区文件。

Clean export 结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED` |
| zip | `D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-15T13-07-39-589Z.zip` |
| zip size | 15,601,850 bytes，约 14.88 MiB |
| sha256 | `fd12531cf9b987545287170b2d23bfe64d4e1470b20923f59ced169d97cdd1cd` |
| exported files | 2,940 |
| secret scan | `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT` |
| 检测到本机环境密钥名 | `DEEPSEEK_API_KEY` |
| export 内匹配真实密钥值 | 0 |
| forbidden path matches | 0 |

Fresh install smoke 结果：

| 项 | 结果 |
|---|---|
| 总状态 | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE` |
| 命令批次 | 7/7 pass |
| 覆盖 | fresh `bun install --frozen-lockfile`、product help、slash help、无 key `auth login` 提示、doctor、MCP doctor、provider gate |

发布包安全结论：

- 发布包不应包含用户真实 DeepSeek key。本轮 secret scan 在当前环境存在 `DEEPSEEK_API_KEY` 的情况下扫描 export，`matchedEnvSecretNames=[]`。
- `.env`、`.dsxu`、`.git`、`node_modules`、`outputs` 不进入 zip；`.env.example` 可以保留，用于首次配置说明。
- 当前首次启动不会内置任何 key；无 key 时 `auth login` 会提示使用 `DSXU_API_KEY`、`DEEPSEEK_API_KEY`、`DSXU_DEEPSEEK_API_KEY` 或 `LITELLM_BASE_URL` 配置模型访问。
- 已新增 DSXU 原侧首次 key wizard：TTY 下 `dsxu-code auth login` 会提示粘贴 DeepSeek key 并保存到 DSXU managed local key；脚本/CI 使用 `dsxu-code auth login --api-key-stdin` 从 stdin 导入；非交互无 key 时仍输出 guidance，不会卡住 fresh install smoke。当前可宣传为“first-run key setup + no-key guidance”，但真实 provider 验证仍以 `doctor` / provider gate / live task 证据为准。

证据路径：

- `docs/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.md`
- `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json`
- `docs/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.md`
- `docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json`

### 11.18 GitHub 开源发布卖点、图表与诚实发布 Gate

2026-05-15 已新增并执行 `bun run v24:github-launch-pack`。本节点生成 GitHub README 可用的产品定位、卖点、功能说明、优势说明、数据图和证据索引，同时强制把未达标口径标为 blocked。

GitHub launch pack 结果：

| 项 | 结果 |
|---|---|
| 总状态 | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM` |
| GitHub evidence pack | ready |
| 95 分公开发布宣称 | blocked |
| 当前 scoreFloor | 72/95 |
| 六阶段测试 | 20/20 pass |
| TUI 场景 | 7/7 pass |
| Senior coding window | 30.48 分钟，23 次 DSXU 调度，22 轮持续审核 |
| C2 文件映射 | 1902 |
| C2 行为闭环 | 51 |
| Clean export | 14.88 MiB zip，secret scan pass |
| Fresh install smoke | 7/7 pass |

已生成数据图（公开资产名已按 V26 命名治理改为稳定 DSXU 产品名，V24 仅保留为历史证据文件名）：

- `docs/assets/dsxu-routing-mix.svg`
- `docs/assets/dsxu-acceptance-evidence.svg`
- `docs/assets/dsxu-release-readiness.svg`

允许公开写的卖点：

- DeepSeek-first AI coding CLI/TUI，默认 `deepseek-v4-flash`，只在 admission evidence 满足时进入 Pro。
- 长任务闭环：目标保持、真实读写、权限/可见状态、恢复/续跑、Agent lifecycle、MCP/skill registry、成本记录、证据报告、发布 gate。
- 可展示固定数据：98 个路由/benchmark case、10 个 public demo task、20/20 六阶段批次、7/7 TUI 场景、30.48 分钟 senior coding window、14.88 MiB clean export、7/7 fresh install smoke。

禁止公开写的卖点：

- 不能宣称已经达到 95 分，因为 `final95ClaimAllowed=false`。
- 不能宣称外部产品/模型胜出，因为同题外部 raw transcript 对比证据不足。
- 不能把 reference 1902 文件写成复制、兼容或品牌卖点，只能写成“高级程序员体验闭环被吸收到 DSXU owner 证据体系”。

当前发布判断：

- 可以保留为 release-candidate evidence pack。
- 不能以“95 分达标产品”发布到 GitHub。
- 若要公开发布，只能用保守口径：开源预览 / release candidate / evidence-backed demo pack，并明确 95 分公开挑战还在 blocked。

证据路径：

- `docs/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md`
- `docs/generated/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json`

V24 当前剩余硬顺序更新为：

1. 提升 public challenge scoreFloor，从 72/95 推到 >=95，且保持 Flash-first/Pro-admission 纪律。
2. 补真实外部同题 raw transcript 对比，或删除任何外部胜负口径。
3. 重跑 clean export artifact / fresh install smoke，把新增 key wizard 带入 release artifact。
4. 重跑 `v24:public-challenge` 与 `v24:github-launch-pack`，只有 `public95ClaimAllowed=true` 时才允许正式 GitHub 95 分发布。
