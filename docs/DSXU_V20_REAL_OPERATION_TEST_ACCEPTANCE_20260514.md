# DSXU V20 真实操作测试验收文档与标准（2026-05-14）

## 1. 定位

V20 是 DSXU 在 V18/V19 CLEAN 收口之后进入的真实测试验收层。它不重新定义架构，也不替代已经完成的 owner/Git、P12 raw、release gate 和 clean export 结论；它的职责是用真实操作证明 DSXU 是否已经达到目标体验。

本轮测试顺序固定为：

1. 功能测试
2. 体验测试
3. 恢复测试
4. 性能测试
5. 评测测试
6. 发布收口测试

测试只作为证明，不替代功能判断。如果测试失败，必须回到对应主线 owner 修复，再重跑该阶段；不得用最小补丁、桥接模式、兼容拖尾、generic bucket 或第二套 runtime 掩盖失败。

## 2. 总目标

V20 验收的目标不是“测试数量多”，而是证明 DSXU 在真实编程和复杂任务中具备接近成熟 AI 编程产品的体验闭环：

| 能力域 | V20 验收目标 |
|---|---|
| 真实编程任务 | 能完成多文件理解、定位、修改、验证、报告，不靠 dry plan 冒充完成 |
| 复杂任务执行 | 能拆解长任务、保持上下文、恢复失败、继续执行并给出证据 |
| UI/TUI 体验 | 用户能看见等待、进度、权限、工具、Agent、错误与恢复状态 |
| 自言自语/过程可见 | 只展示可见工作状态和下一步，不泄露隐藏推理，不用空泛自述替代证据 |
| 工具生命周期 | Read/Edit/Bash/PowerShell/MCP/Browser/Agent 都走同一 tool lifecycle/evidence |
| 权限与安全 | 权限拒绝、风险命令、外部写入、网络/浏览器动作都有可见 gate |
| Agent 编排 | serial worker / parallel fanout 有父级 synthesis 和 worker evidence |
| 成本与路由 | Flash-first、Flash-MAX/Pro 准入、cache/usage/ROI 可审计 |
| 评测与发布 | raw evidence、target-reference、release gate、clean export 全链路可复核 |

## 3. 关键边界

### 3.1 真实操作优先

V20 必须包含真实操作测试，而不是只跑 unit tests：

- 必须打开真实 UI/TUI 或浏览器页面进行体验观察。
- 必须执行真实代码修改或真实项目任务，不能只用 mock prompt。
- 必须记录命令、日志、截图或 transcript、tool trace、final report。
- 失败、PARTIAL、用户中断、权限拒绝都必须保留证据。

### 3.2 “自言自语”定义

这里的“自言自语”不是隐藏推理链展示。V20 只验收用户可见的工作状态表达：

| 允许 | 禁止 |
|---|---|
| “我正在读取相关文件并确认 owner 边界” | 输出隐藏推理链或内部思维全文 |
| “当前卡在权限确认，下一步需要用户授权或改走只读路径” | 用长篇自述替代工具证据 |
| “测试失败在 X owner，先修复再重跑” | 明明失败却用总结话术包装成 PASS |
| “Agent worker 仍在运行，父级等待 evidence” | 猜测后台结果或直接生成 final |

验收标准：可见状态必须短、真实、可行动，并能被 tool trace/evidence 对上。

### 3.3 类 Claude 编程体验对标

V20 可以把成熟 AI 编程产品体验作为语义参考，但不得复制实现或制造第二套架构。对标的是用户体验能力：

- 长任务能保持目标，不被旧 topic 污染。
- 修改代码前能读真实 source truth。
- 大改动能拆解、执行、验证、恢复。
- 工具失败后不胡说，进入恢复路径。
- UI 能显示进度、权限、后台 Agent、测试结果和下一步。
- final answer 必须引用证据，不把计划当完成。

## 4. 测试前置门槛

进入 V20 测试前必须满足：

| Gate | 要求 |
|---|---|
| Git baseline | `git status --short = 0` |
| CLEAN closure | V18/V19 CLEAN 最新结论为 release closure completed |
| P12 raw | paired target raw logs 存在，family gap 为 0 |
| owner board | OGC lanes PASS，release blockers 为空 |
| final preflight | `canRunFinalComprehensiveTests=true`，`canCreateCleanExport=true` |
| export baseline | clean export dir/zip 存在，且不含 `.git`、`.dsxu`、`node_modules`、CLEAN 报告 |

若任一前置门槛失败，不能进入 V20；先回到 release closure 修复。

## 5. V20 测试阶段与验收标准

### 5.1 功能测试

目标：证明核心功能主线成立。

| 子项 | 覆盖范围 | 通过标准 |
|---|---|---|
| Query Loop | topic、intent、plan、gateState、finalization | 不串旧 topic，不无证据 final |
| Tool Lifecycle | Read/Edit/Bash/PowerShell/MCP/LSP/Browser/Workflow | 每次工具调用有 preflight/permission/result/postflight/evidence |
| Permission Gate | 风险命令、外部写、网络、权限拒绝 | 用户可见，拒绝后有 recovery hint |
| Model Router | Flash/Flash-MAX/Pro 路由、cost、cache | 路由理由、usage、ROI 可审计 |
| Context/Compact | source truth、compact/resume、memory | 恢复后必须重读关键 source truth |
| Agent | serial worker / parallel fanout / parent synthesis | 父级不猜结果，必须等 worker evidence |
| Evidence/Report | trace、final patch report、risk、cost | PASS/PARTIAL/FAIL 都有证据 |
| V1 integration | 所有 `*-v1` 主线合同 | V1 入口只接单主线 owner，不保留第二套 runtime |
| V18 coverage | V18 目标项主线化 | V18 目标被 V19/V20 主线证明，不回填旧层 |

建议命令层：

```powershell
bun test src/dsxu/engine/__tests__/tool-evidence-pack-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/owner-git-closure-board-v1.test.ts
```

失败处理：定位到 owner，修主线；不得新增 shortcut adapter。

### 5.2 体验测试

目标：证明真实用户窗口里的体验成立。

| 子项 | 真实操作要求 | 通过标准 |
|---|---|---|
| TUI 打开 | 启动 DSXU TUI，观察欢迎、输入、进度、权限、final | 无乱码、无卡死、状态可见 |
| 权限体验 | 触发读、写、执行、风险命令 | 权限提示清晰，拒绝后恢复 |
| 自言自语可见状态 | 长任务中观察过程更新 | 简短、真实、可行动，不泄露隐藏推理 |
| 工具进度 | Bash/PowerShell/Browser/Agent 执行中观察状态 | 进度不消失，失败不静默 |
| Product-window | 多窗口/后台/权限抢占/冲突 replay | 不污染当前回合，有 recovery evidence |
| Browser/UI | 打开真实 dev server 或测试网页 | 页面可见，截图/状态证据存在 |
| Final 可信度 | 完成后读 final answer | final 只陈述已验证内容，未完成必须 PARTIAL |

建议真实操作包：

```powershell
bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts src/dsxu/engine/__tests__/phase12-product-window-oracle-v1.test.ts src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts
```

人工/浏览器验收必须记录：

- 启动命令
- 截图或 transcript
- 可见状态检查结果
- 权限/失败/恢复路径
- final answer 是否与证据一致

### 5.3 恢复测试

目标：证明 DSXU 遇到失败后不会假装成功。

| 场景 | 通过标准 |
|---|---|
| 权限拒绝 | 工具 evidence 为 blocked/recovering，给出下一步 |
| 命令失败 | 分类 failureClass，不直接 final PASS |
| 测试失败 | 进入 failed verification recovery，不循环空跑 |
| Edit 失败 | source-truth reread 或候选定位，不乱改 |
| Compact/resume | 恢复目标、文件、错误、权限、下一步 |
| Agent PARTIAL | 父级 final 必须标 PARTIAL 或等待 worker evidence |
| Background abort | 不猜结果，不吞掉后台状态 |
| 多文件冲突 | 降级 serial 或 blocked，有 owner 和 recoveryHint |

建议命令层：

```powershell
bun test src/dsxu/engine/__tests__/recovery-runtime-v3.test.ts src/dsxu/engine/__tests__/recovery-query-loop-v3.test.ts src/dsxu/engine/__tests__/compact-resume-replay-v1.test.ts src/dsxu/engine/__tests__/file-edit-surgical-loop-v19.test.ts src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts
```

### 5.4 性能测试

目标：证明成本、缓存、路由、工具重复和 UI/Agent latency 没有破坏真实体验。

| 子项 | 通过标准 |
|---|---|
| Prompt prefix cache | cache key/命中/失效可解释 |
| Route cache ROI | 成本节省和失败恢复收益可记录 |
| Token/usage | usage 不缺失，不用估算冒充真实 |
| Tool repeat | 重复工具调用有原因，no-evidence action 有计数 |
| TUI latency | 长命令期间 UI 不失联 |
| Agent latency | worker 状态可见，父级等待合理 |
| Benchmark runtime 边界 | 不新增独立 benchmark runtime |

建议命令层：

```powershell
bun test src/dsxu/engine/__tests__/v18-prompt-prefix-cache-evidence-v1.test.ts src/dsxu/engine/__tests__/v18-route-cache-roi-smoke-v1.test.ts src/dsxu/engine/__tests__/v18-route-cache-dynamic-tail-v1.test.ts src/dsxu/engine/__tests__/v19-cost-cache-live-task-evidence-v1.test.ts src/dsxu/engine/__tests__/phase12-live-cost-matrix-v1.test.ts
```

### 5.5 评测测试

目标：证明 raw evidence / target-reference / eval pack 可审计。

| 子项 | 通过标准 |
|---|---|
| P12 raw comparison | target-reference paired logs 为真实 manifest，不能是 template |
| Raw readiness | deferred eval raw/live manifest PASS |
| Delta report | 只按 raw evidence 判定，不用单项分数冒充整体胜出 |
| Evidence eval pack | PASS/PARTIAL/FAIL 有 raw、trace、artifact、metrics、risks |
| Go/Stop | 外部 benchmark/公开宣称必须受 gate 控制 |
| 真实复杂任务 | 至少覆盖代码修复、终端修复、Agent、resume、UI/browser |

建议命令层：

```powershell
bun test src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts src/dsxu/engine/__tests__/v18-evidence-eval-pack-v1.test.ts src/dsxu/engine/__tests__/v18-benchmark-readiness-v1.test.ts src/dsxu/engine/__tests__/v18-go-stop-decision-v1.test.ts src/dsxu/engine/__tests__/real-task-replay-suite-v1.test.ts
```

### 5.6 发布收口测试

目标：证明当前可交付，不把测试包、证据库或历史报告带入 release。

| 子项 | 通过标准 |
|---|---|
| Final preflight | PASS，blockedBy 为空 |
| Release gate | `bun run test:dsxu:release` PASS |
| Health audit | invalid UTF-8 和 user-visible risk 均为 0 |
| Clean export | 只包含 ship 文件和 export manifest |
| Zip 检查 | 不含 `.git`、`.dsxu`、`node_modules`、CLEAN 报告 |
| Git 状态 | 最终 `git status --short = 0` |

建议命令层：

```powershell
bun run test:dsxu:release
bun run audit:dsxu:health --fail-on-user-visible-risk --fail-on-invalid-utf8
```

## 6. V20 真实任务验收包

V20 不只看单元测试，必须至少跑以下真实任务包：

| 包 | 任务 | 必须观察的体验 |
|---|---|---|
| RT-CODE-01 | 多文件 bugfix：读报错、定位、修改、跑测试、报告 | source truth、patch discipline、verification |
| RT-CODE-02 | 新增小功能：改代码、补测试、保持风格 | owner mapping、no duplicate runtime |
| RT-TERM-01 | 终端修复：命令失败、环境诊断、恢复 | shell evidence、failureClass、nextAction |
| RT-UI-01 | 打开本地 dev server/browser 页面并验证 | screenshot/DOM/console evidence |
| RT-AGENT-01 | parallel fanout 两个 worker，父级 synthesis | worker evidence、冲突处理 |
| RT-RESUME-01 | compact/resume 后继续同一任务 | 恢复目标、文件、失败、下一步 |
| RT-PERM-01 | 权限拒绝后继续只读或请求授权 | visible permission + recovery |
| RT-EVAL-01 | 同题 target-reference raw 对照 | raw transcript/tool trace/final report/metrics/risks |
| RT-SELF-01 | 长任务过程可见状态 | 自言自语短、真实、可行动，不泄露隐藏推理 |

每个真实任务必须输出：

- task id
- prompt
- start/end time
- UI/TUI/browser evidence
- command/tool trace
- changed files
- verification command
- final status: PASS / PARTIAL / FAIL
- risks
- cost/usage if available

## 7. V18 全功能与 V1 整合标准

### 7.1 V18 全功能

V18 不按旧实现逐字回填，但 V18 目标必须被 V20 验收覆盖。每个 V18 目标项必须落到一种状态：

| 状态 | 含义 |
|---|---|
| PASS_MAINLINE | 已由当前主线功能和真实测试证明 |
| PASS_SUPERSEDED | 旧实现不保留，但目标已由 V19/V20 主线替代 |
| PARTIAL_REAL_GAP | 有主线能力，但真实操作样本不足 |
| BLOCKED_OWNER | owner 不清或需要功能修复 |
| REMOVED_WITH_REPLACEMENT | 旧路径可删/已删，替代证据齐 |

V20 不接受 `UNKNOWN`。如果出现 UNKNOWN，必须回到 owner review。

### 7.2 V1 整合

所有 `*-v1` 入口都必须满足：

- 有明确 mainline owner。
- 有 import/use evidence。
- 不创建第二套 runtime。
- 不以兼容 label 作为产品路径。
- 测试和 harness 输出统一 evidence。
- 与 V18/V19 CLEAN 目标不冲突。

V1 整合失败的常见判定：

- 只在测试里存在，产品主线未引用。
- 功能等价但保留两份实现。
- 新增 facade 绕过 Tool Gate/Permission Gate。
- UI/Agent/Browser/MCP 走了独立生命周期。

## 8. V20 总验收分级

| 等级 | 条件 |
|---|---|
| V20 PASS | 六阶段全部 PASS，真实任务包全部 PASS/PARTIAL 可解释，release/export 仍 PASS |
| V20 PASS_WITH_LIMITS | 六阶段无 BLOCKED，但真实任务存在可接受 PARTIAL，已登记下一阶段 |
| V20 PARTIAL | 有阶段失败但不影响 release artifact，需修复后重跑该阶段 |
| V20 BLOCKED | 真实 UI/真实任务/P12 raw/release gate 任一硬阻断失败 |
| V20 INVALID | 用模板、dry plan、generic log、target-only log 或隐藏桥接替代真实测试 |

## 9. 最终报告格式

V20 测试完成后必须输出：

| 字段 | 要求 |
|---|---|
| baseline | commit、git status、export artifact |
| stage summary | 六阶段 PASS/PARTIAL/FAIL |
| real operation evidence | UI/TUI/browser/transcript/trace 路径 |
| coding task result | changed files、verification、final report |
| recovery result | failureClass、recoveryHint、rerun outcome |
| performance result | cache、cost、route、latency |
| eval result | raw comparison、delta、target-reference integrity |
| release result | release gate、health audit、zip boundary |
| final decision | V20 PASS / PASS_WITH_LIMITS / PARTIAL / BLOCKED / INVALID |

## 10. 当前建议执行顺序

1. 锁定 baseline：`git status --short`、commit、export zip。
2. 运行功能测试包。
3. 打开 TUI/browser 做体验测试，并记录截图/transcript。
4. 运行恢复测试包。
5. 运行性能/成本测试包。
6. 运行评测测试包，复核 target-reference raw evidence。
7. 运行发布收口测试。
8. 生成 V20 final acceptance report。

这份 V20 文档是测试验收标准，不是测试结果。正式测试必须按真实执行输出 PASS/PARTIAL/FAIL。
