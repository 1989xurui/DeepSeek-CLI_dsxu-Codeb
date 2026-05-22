# DSXU Code 开源发布页草案

DSXU Code 是一个 DeepSeek-first 的 AI 编程 CLI/TUI。它不是只把模型 API 包一层聊天界面，而是在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型之上，增加工程任务真正需要的运行时：源码事实、工具执行、权限门、验证门、恢复循环、长任务账本、Agent/Skill/MCP 边界、成本/缓存轨迹和发布证据。

当前定位：**release-candidate evidence pack**。可以发布为开源候选产品和工程证据系统，主叙事是“DeepSeek-first engineering runtime，内部 reality/evidence 已通过”。不能发布公开 90/95 分能力、外部模型/产品胜出、正式 SWE-bench 成绩。

完整功能与测试证据矩阵见：`docs/product/DSXU_PUBLIC_FEATURE_TEST_MATRIX_20260522_CN.md`。

## 一句话卖点

DSXU Code 让 DeepSeek 不只是回答代码问题，而是按高级程序员工作方式执行任务：先读源码，再做计划，经过工具和权限门执行修改，失败后定位和恢复，最后用真实测试、成本、缓存、trace 和 release gate 证明结果。

## 最新可公开证据

| 证据 | 最新结果 | 能证明什么 |
|---|---:|---|
| 全仓回归 | 3075 pass / 1 skip / 0 fail，434 个测试文件 | 当前代码库基础回归稳定。 |
| 六阶段最终测试 | 22/22 command batches PASS | 功能、体验、恢复、性能、评测、发布收口链路可跑通。 |
| DSXU release gate | 531 pass / 0 fail | V2/V3 finalization closeout 后，release surface、claim boundary、secret/redaction 等发布门禁通过当前检查。 |
| Senior coding window | 30.48 分钟，33 次 DSXU product-entry run，32 轮结构化 review，最终 fixture test 通过 | 证明 DSXU 能维持真实长任务窗口，不只是短 prompt demo。 |
| Senior window 成本 | 全程 `deepseek-v4-flash`，Pro 未使用，约 `$0.3617` | 证明 Flash-first 成本纪律在一个真实长任务窗口中成立。 |
| Training V1 reality run | PASS，23 steps，13 gates，0 failed，`publicClaimAllowed=false` | 证明 DSXU 已有内部 trajectory / evidence / gate 训练数据流水线。 |
| Training V2 evidence flywheel | PASS internal flywheel | 证明 V2 训练/证据流水线入口已经补齐；仍然不是公开训练效果 claim。 |
| V10 final reality evidence | reachability、77 case golden replay、ablation、long task、provider dry smoke、agent/tool pairing、cache/cost、localized feedback、TUI trust surface、final dashboard 全部 PASS | 证明 DSXU-owned final reality 证据链已经成型。 |
| 最新 real-task hit-rate pack | 24/24 final PASS，0% first-attempt PASS，100% second-attempt recovery，Flash-only，64.1% cache hit，$0.198944 total cost | 证明失败恢复和二次收敛能力，但不是外部榜单成绩。 |
| V6 internal replay hit-rate gate | 100/100 final PASS，100% tool hit，100% recovery success，80.7% average cache hit，9/9 Pro admission justified | 证明内部 replay 层的工具命中、恢复和路由审计能力。 |
| SWE internal smoke | 5/5 PASS | 只证明内部评测管道健康，不能写成公开 SWE-bench 成绩。 |
| V2/V3 finalization closeout | 原始 14 个 non-pass 已 14/14 关闭；剩余 16 个 raw API baseline 已 16/16 捕获；30-case DSXU raw evidence ready 30/30 | 证明 runtime/release blocker 已关闭，但不是外部对比成绩。 |
| Cache live A/B | `PASS_CACHE_LIVE_AB`，重复 stable-prefix lane 第 2/3 轮达到 99.6% cache hit | 证明 V3 cache-first 机制在受控重复前缀场景下有效；只作为内部调优证据。 |
| P12 raw readiness | PASS，14/14 paired raw logs | 证明 P12 readiness lane 已闭合。 |
| Evidence dashboard | pass=159，fail=0，blocked=0，claimBlocked=1，notRun=0，scoreFloor=72，releaseClaimAllowed=false | 证明 runtime/release blockers 已清零，同时仍阻断 95/外部对比 claim。 |
| Public-comparable DSXU lane | 30/30 DSXU raw evidence ready | 可以写 DSXU/raw API evidence ready；外部 target/reference transcript 仍缺，不能写外部对比成绩。 |
| Clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`，exact zip path / size / SHA-256 写入 generated evidence，secret scan PASS | 证明当前 release-candidate 发布包已生成且未携带运行时 secret。 |
| Fresh install smoke | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`，8/8 命令通过 | 证明 clean export 包能重新安装依赖并跑通 help/auth/doctor/provider smoke。 |
| Brand / compatibility risk board | public surface blockers 0，runtime cleanup candidates 0 | 证明当前公开面没有品牌/兼容风险阻断。 |

## V1 + V2 让 DSXU 变成了什么

V1 和 V2 的价值不是继续堆功能，而是把参考产品中“像高级程序员一样工作”的通用机制折叠进 DSXU 自有主链。

### V1：主链收敛版 DSXU

V1 把原来分散的能力压成一条默认工程链路：

```text
模型路由
→ Runtime State Card
→ 工具结果
→ 权限
→ 写入生命周期
→ 验证 / 审查 / 回滚
→ 长任务账本
→ 证据包
```

V1 的核心吸收点：

- **Runtime State Card**：每轮只给模型当前状态、允许动作、阻断动作和需要的证据，避免厚 prompt 失控。
- **Canonical Tool Result**：工具结果必须结构化，才能进入 evidence、recovery、ledger。
- **Verified Edit Lifecycle**：写代码后必须有验证、风险、回滚和 final claim gate。
- **Long Task Ledger**：长任务不能只靠聊天上下文，必须有可恢复账本。
- **Recovery Decision**：失败后明确 retry、replan、rollback、ask human、abort 或模型升级。
- **Evidence Packet**：每个 PASS 都要能回指命令、文件、trace、成本、缓存和风险。

### V2：把能力变成默认可信体验

V2 继续做 owner-folded 收束，不新增第二套 runtime/provider/permission/TUI：

- **模型事实单源**：DeepSeek V4 Flash / Flash-MAX / Pro 的上下文、thinking、路由和成本口径收束到统一事实源。
- **ProviderGateway 单一路径**：DeepSeek thinking + tool-call replay 通过同一 provider 边界，减少请求体漂移。
- **默认编辑生命周期**：FileWrite/FileEdit 进入 TDD/SAST/Verification envelope，跳过验证不能写成 PASS。
- **Command Catalog**：脚本入口被分类为 product-runtime、mainline-validation、release-only、owner-review、historical-evidence 等，避免 100+ scripts 变成第二产品表面。
- **Evidence Workbench**：默认短输出展示 scoreFloor、trust、actionItems、dataStillNeeded，完整 JSON 留给审计。
- **TUI trust surface**：真实 PTY resize、permission review、scrollback anchor、compact evidence line 都进入 focused 验收。
- **Brand / claim / release hygiene**：公开文档不能带未授权品牌、公开胜出、mock 冒充 benchmark 等风险。

## V18 能力池带来的产品卖点

V18 的价值是能力池，不是所有能力都可以无边界宣传。当前口径是：82 项历史能力里，67 项适合 DSXU 当前 DeepSeek-first 产品方向；其中已完成/可回归能力进入卖点，边界能力和 deferred 能力不写成 full feature。

适合 GitHub 的 V18 卖点组：

- **DeepSeek V4 Flash/Pro adapter**：支持 DeepSeek-first 模型调用、thinking、tool call、JSON output、route/cost/cache 证据。
- **CostRouter / CostReporter**：默认 Flash，Pro 需要 admission evidence；成本、缓存、route reason 可审计。
- **ContextCompiler / TokenFirewall**：压缩 source capsule、限制大工具输出，降低上下文膨胀。
- **PermissionGate / ToolBus**：工具执行、Bash/PowerShell、MCP/Skill/Agent 都必须走 DSXU-owned gate。
- **PlanGraph / VerificationKernel / RegressionGuard**：计划、执行、验证、失败恢复、回归保护进入同一工程链路。
- **TraceLogger / Evidence Reporter**：运行过程留下 source/test/live/raw/cost/cache 证据。
- **Snapshot / Rollback / FailureTaxonomy**：失败不隐藏，进入分类、恢复和可回滚流程。
- **LocalMemory Lite**：记忆只做导航，不替代当前 source truth。

V18 不应公开夸大的能力：

- Terminal-Bench、SWE Verified、BFCL、BrowseComp、VS Code plugin/API platform、Desktop/Voice/Team 等仍属于 deferred/roadmap 或边界能力。
- internal smoke 不能写成公开 benchmark。
- feature parity 不能写成对标闭源产品复制。

## V4 到 V6 的核心产品内核

### V4：减法式增强，收束成 8 个产品内核

V4 的重点是“不再扩张功能，而是把产品内核变硬”：

1. **Provider Plan**：DeepSeek 请求体、thinking、模型、成本、缓存、输出限制的唯一事实源。
2. **Work Ledger**：目标、计划、阶段、工具、验证、恢复、成本、风险进入长任务账本。
3. **Tool Envelope**：工具调用必须有原因、权限、结果、artifact、错误、后续动作。
4. **Permission Decision**：副作用动作必须可见、可审计、可阻断。
5. **Verification Envelope**：写后验证、风险分层、最终声明门。
6. **Recovery Decision**：GearBox、failure taxonomy、verify failure、tool failure 收成决策表。
7. **Agent Evidence**：worker 只交 evidence packet，parent final 只引用证据。
8. **Trust UI**：TUI 只投影真实状态，不做假进度或装饰。

### V5：DeepSeek-native route / context / cache / replay

V5 的价值是让 DSXU 更贴 DeepSeek：

- Active Frame 默认 query 投影。
- Semantic Code Graph 用于 edit source/test 选择。
- V5-native replay trace，用于验证路由、工具窗口、上下文和 recovery 是否真实进入默认链。
- 继续保持 Flash-first，复杂或失败恢复才考虑 Flash-MAX / Pro admission。

### V6：DeepSeek-native engineering runtime

V6 的价值是把 DeepSeek 调用从 API 调用升级成工程 runtime：

- DeepSeek provider 合同测试。
- Agent evidence handoff。
- Tool/Permission/Provider/Context/Recovery owner 分类。
- Prompt 瘦身，避免 Skill/MCP/Swarm 长段落泄漏到默认 prompt。
- MCP/Skill/Swarm 作为能力边界，不能成为第二 runtime。
- 内部 replay hit-rate gate：100/100 final PASS，100% tool hit，100% recovery success，80.7% average cache hit，9/9 Pro admissions justified。

## 高级程序员体验体现在哪里

DSXU 的高级体验不是靠一句“更聪明”，而是靠闭环密度：

- 它知道当前目标、阶段、允许动作和阻断动作。
- 它不会在验证缺失时直接说完成。
- 它可以把失败定位成具体 owner、命令、文件和下一步。
- 它会把大输出变成 artifact + preview，减少上下文污染。
- 它把权限、工具、成本、缓存、Agent handoff、TUI 状态投影到同一证据流。
- 它在长任务中保留 ledger 和 recovery decision，而不是只靠聊天历史。
- 它让 release claim 由 evidence dashboard 决定，而不是由模型语气决定。

## 当前不能公开宣称的内容

DSXU 当前不能公开写：

- 已达到 90/95 分公开能力。
- 已超过任何外部模型或闭源产品。
- 已有正式 SWE-bench / Terminal-Bench / BFCL 等公开成绩。
- internal replay、mock、dry-run 等同于公开 benchmark。
- 任何 copied brand、commercial behavior、closed-product parity。

当前真实边界：

- `scoreFloor=72`
- `releaseClaimAllowed=false`
- `blocked=0`
- `claimBlocked=1`
- public-comparable DSXU raw evidence 已 ready 30/30。
- 外部 target/reference transcript 仍缺，不能写外部比较。

## 推荐 GitHub 发布文案

> DSXU Code is a DeepSeek-first AI coding CLI/TUI that turns raw model calls into an evidence-backed engineering runtime. It routes mostly through DeepSeek Flash, executes tools behind permission gates, records source-truth and verification evidence, recovers from failed commands/tests, and keeps long-running work visible through a trust-oriented TUI.

中文口径：

> DSXU Code 是 DeepSeek-first 的 AI 编程 CLI/TUI。它把 DeepSeek 模型能力放进真实工程运行时：源码事实、工具门、权限门、验证门、恢复循环、长任务账本、Agent/Skill/MCP 边界、成本/缓存证据和发布 claim guard。它现在适合作为开源 release-candidate 产品发布，但不会把内部 smoke 或未配对的公开对比写成夸大成绩。
