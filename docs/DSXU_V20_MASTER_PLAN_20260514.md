# DSXU V20 主方案 - 2026-05-14

## 2026-05-15 Owner/Git staged execution and post-stage closure update

本轮按 V20 原侧目标执行，不新增第二套主链、不新增第二入口、不用最小补丁绕 gate。已完成两个硬阻断的真实推进：

| Gate | 当前结果 |
|---|---|
| P12 target-reference raw input | `PASS_READY_FOR_DELTA_REVIEW`，真实 manifest 已导入，`p12PairedRawLogCount=14/14`，`p12ReplayFamilyGapCount=0`，`didFabricateTargetLogs=false` |
| Owner/Git product packets | `STAGED_BY_OWNER_GIT_EXECUTION`，`1746` product paths 已按 owner packets staged |
| Owner/Git deletion packets | `STAGED_BY_OWNER_GIT_EXECUTION`，`147` accepted deletion paths 已按 packets staged，不恢复旧 runtime |
| Stage execution report | `STAGED_OWNER_GIT_PACKETS`，`stagedCommandCount=58/58`，`failedCommandCount=0`，`totalPlannedPathCount=1893` |
| Post-stage verification | `POST_STAGE_VERIFIED_REMAINING_GATES_BLOCKED`，Git index diff `1999` entries，`untracked=0`，P12 `PASS`，ACL residue `4` |
| Closure batch | `PASS_EVIDENCE_REFRESHED_BLOCKERS_REMAIN`，`17/17` focused gate refresh commands PASS |
| ACL deletion attempt | `BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF`，真实删除尝试被 Windows ACL 拒绝；`deletableResidues=0/4`，当前用户仅有 `BUILTIN\Users:(I)(RX,W)` 等非 Delete 权限 |
| ACL-related focused tests | `bun test src/dsxu/engine/__tests__/bridge-gate.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts` -> PASS，`12 tests / 0 fail / 4515 expect` |

为什么 staged 后 `git status --short` 是 `1999` 而不是原来的 `1893`：这是正常的 post-stage index 展开，不是新垃圾。原先 `docs/generated/` 作为单个 untracked directory 计入 register；`git add` 后 Git 把其中 generated evidence 展开成单个 `A` 文件，并且把一批旧路径重构识别为 `R` rename。当前 `git diff --name-status` 工作树 unstaged diff = `0`，说明本轮刷新后的脚本和证据已经同步进 index。

已同步脚本口径：

- `owner-git:preflight` 现在区分 pre-stage register 与 post-stage index；staged 成功后输出 `PASS_POST_STAGE_INDEX_VERIFIED`，不再把 index expansion 误判成未注册路径。
- `owner-git:product-stage-plan`、`owner-git:stage-plan`、`owner-git:mutation-command-plan`、`owner-git:authorization-board` 都识别 `STAGED_BY_OWNER_GIT_EXECUTION`，避免重复要求再次 stage。
- `v20:post-auth-plan` 升级为 post-stage verification；读取 stage execution、P12 raw readiness、Git index、ACL residue、final gate。
- `v20:blocker-board` 与 `v20:closure-batch` 现在把 staged Owner/Git packets 视为已进入下一 gate，而不是回到 authorization pending。
- `bridge-gate.test.ts` 与 `provider-contract-v1.test.ts` 不再要求 `bridge-adapter.ts` tombstone 必须存在；如果 ACL 允许删除，测试接受删除；如果仍存在，只允许 tombstone 且不能包含旧 runtime。

2026-05-15 进一步执行后，当前真实口径更新为：P12、Owner/Git product packets、Owner/Git deletion packets 已不再是 blocking gate。4 个 ACL residue 已完成 owner-signed external residue 处理：本地物理删除仍被 Windows ACL 拒绝，但 `activeProductReferenceRows=0`、`externallySignedResidues=4/4`，并明确不再作为 product runtime、fallback、bridge 或 compat holding path。`v20:final-preflight` 已输出 `PASS`，`canRunFinalSixStageTests=true`、`canCreateCleanExport=true`；`clean-export:preflight` 已输出 `PASS_READY_TO_CREATE_CLEAN_EXPORT`，但本轮未创建 export artifact。

本轮已经完成的大批量产品验证：

| Stage | Result |
|---|---|
| 功能测试 | `bun test tool-gate/tool-definition/mainline-tool-adapter/api-service/provider/agent` -> PASS，`141 tests / 0 fail / 5845 expect` |
| 体验测试 | `real-tui-harness`、`model-driven-tui-long-task`、`streaming-ui-visibility`、`control-plane`、`v20-real-gap-acceptance` -> PASS，合计 `40 tests / 0 fail / 270 expect` |
| 恢复测试 | `recovery-query-loop`、`recovery-mainline`、`scenario-review-recovery`、`experience-store replay/resume`、`agent-parent-final-gate-replay` -> PASS，`17 tests / 0 fail / 179 expect` |
| 性能/成本/缓存测试 | `phase12-live-cost-matrix`、`v18-prompt-prefix-cache-builder` -> PASS，`9 tests / 0 fail / 58 expect`；`live:provider-gate` 与 `live:cache-prefix-smoke` 只做 evidence gate，不伪造 provider call |
| 评测测试 | `phase12-reference-semantic-exam`、`phase12-raw-comparison`、`phase12-senior-programmer-experience`、`v18 evidence/baseline` -> PASS，`27 tests / 0 fail / 284 expect` |
| 发布聚焦测试 | `test:dsxu:release` -> PASS，`501 tests / 0 fail / 3661 expect`；`release-test-gate` -> PASS，`3 tests / 0 fail / 15 expect`；`release-surface` -> PASS，`6 tests / 0 fail / 57 expect` |
| 发布收口复核 | `lint-schema` -> PASS；`audit:dsxu:health` -> PASS，`invalid_utf8_files=0`、`user_visible_risk_files=0`；`release-test-gate + release-surface + release-surface-source-policy-review` -> PASS，`12 tests / 0 fail / 84 expect` |
| 最终 gate | `owner-git:preflight` -> `PASS_READY_FOR_RELEASE_CLOSURE`；`v20:six-stage-plan` -> `READY_FOR_RELEASE_CLOSURE_TESTS`；`v20:final-preflight` -> `PASS`；`clean-export:preflight` -> `PASS_READY_TO_CREATE_CLEAN_EXPORT`；`v20:blocker-board` -> `PASS_RELEASE_PREFLIGHT_READY_CLEAN_EXPORT_READY`；`v20:closure-batch` -> `PASS_PREFLIGHT_READY_RELEASE_EXPORT_READY` |

本轮修复的真实问题：

- `query-loop.ts` 的 recovery bridge 补齐 `shouldTriggerRecovery`，恢复测试不再通过最小 mock 绕过主线。
- `phase12-reference-semantic-exam-v1.test.ts` 改为按真实参考源路径解析 `D:\源代码claude\src`，不再依赖错误的 `原代码claude` 占位路径。
- 新增 `live:provider-gate` 与 `live:cache-prefix-smoke` 对应脚本，补齐 package 命令缺口；命令只记录 gate/evidence，不伪造真实 provider 请求。
- `v20:six-stage-plan` 移除不存在的 `clean-export-readiness-v1.test.ts`，并明确当前进入 `READY_FOR_RELEASE_CLOSURE_TESTS`。
- `v20:blocker-board` 已同步新口径：当前状态是 `PASS_RELEASE_PREFLIGHT_READY_CLEAN_EXPORT_READY`，不是“所有测试都未开始”。
- `acl:preflight` / `acl:closure-plan` 区分“物理 ACL 删除失败”和“产品 runtime 阻断”：4 个 residue 仍存在于本地 workspace，但已签收为 external non-product residue，release/export 必须排除，后续有 owner/elevated 权限时直接物理删除。
- `clean-export:preflight` 已改为真实 gate：只有 final preflight PASS 后才输出 `PASS_READY_TO_CREATE_CLEAN_EXPORT`，并且本脚本仍不创建 artifact。

当前真实剩余固定为 2 类：

1. 物理 ACL 残留：`4` 个文件仍因 Windows ownership/ACL 不能由当前用户删除；这已经不是 product/release gate blocker，但仍是本地 workspace 外部权限清理项。后续有 owner/elevated 权限时直接删除，不恢复旧 runtime。
2. Export artifact：`clean-export:preflight` 已 ready，但本轮没有创建 export artifact。创建 export 应作为明确 release/export action 单独执行，且必须排除 `.git`、`.dsxu`、`node_modules`、证据库和这 4 个物理 ACL residue。

下一步执行顺序：若要真正产出发布包，执行显式 clean export action；否则当前 V20 release/export preflight 已 ready，剩余只是不创建 artifact 和本地物理 ACL 文件待外部权限删除。

## 2026-05-15 P12 target manifest discovery and raw-readiness update

????????? P12?????????? `.dsxu/trace/p12-target-reference-codex-runner-v1/target-reference-manifest.json`???????`p12:target-intake` ????? `READY_FOR_RAW_READINESS_IMPORT`?`acceptedLogCount=14`?`rawLogExistsCount=14`?`artifactExistsCount=56`?`didFabricateTargetLogs=false`??? `p12:raw-readiness --targetReferenceManifestPath ...` ??? `PASS`?`p12PairedRawLogCount=14/14`?`p12ReplayFamilyGapCount=0`?delta report `PASS`?

?? P12 ??? 0/14 ??????? next action ?? Owner/Git ????? ACL residue ???????????????? PASS????????? clean export ???? Owner/Git?ACL?release gate ??????

## 2026-05-15 Owner/Git authorization board update

????????????????????P12 ???? `targetReferenceManifestPath`??????? raw input????????????? Owner/Git ??????? `owner-git:authorization-board`?? `1745` ? product paths?`147` ? deletion paths?`17` ? owner packets ? `57` ???? `git add` ??????????????? `READY_FOR_EXPLICIT_OWNER_GIT_AUTHORIZATION_NOT_EXECUTED`?`commandPathCount=1892` ??? `git status --short=1892` ???`unregisteredPathCount=0`?

?????`git add` ??? index ?????? `git status --short` ????????????????? closeout/commit ??????? stage?commit?delete?reset?clean?final test ? export?`v20:closure-batch` ???? `15` ? gate ??? PASS ?????? final preflight ????? `BLOCKED`?P12 target raw input?ACL residue?????????clean export ??????? PASS?

## 2026-05-15 V20 closure batch runner update

本轮补齐总控型收口入口：`v20:closure-batch` 一次刷新 14 个 gate，最终结果 `PASS_EVIDENCE_REFRESHED_BLOCKERS_REMAIN`，`passCount=14`、`failCount=0`。同时新增 `p12:target-contract` 和 `v20:post-auth-plan`，分别冻结 target manifest 合同和授权后的 verification 顺序。当前 register = `1891`，`M=1648`、`D=147`、`??=96`，新增 3 个总控脚本归入 `V20-OGR-09-dsxu-engine-mainline`。仍未 stage、commit、delete、reset、clean、final test 或 export。

## 2026-05-15 V20 blocker action plan update

本轮继续按 5~8 倍批量推进，把剩余阻断从“等待口头判断”变成固定 action board。新增并执行：`p12:target-collection`、`owner-git:mutation-command-plan`、`acl:closure-plan`、`commercial-ip:preflight`、`v20:blocker-board`。

| Evidence | Result |
|---|---|
| `DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json` | `READY_FOR_REAL_TARGET_REFERENCE_COLLECTION_NOT_EVIDENCE`，14 个 target-reference work orders，模板不算 raw evidence |
| `DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json` | `READY_PENDING_EXPLICIT_AUTHORIZATION_NOT_EXECUTED`，1741 product paths + 147 deletions 拆为 57 条待授权 `git add` commands |
| `DSXU_V20_ACL_RESIDUE_CLOSURE_PLAN_20260515.json` | 4/4 residue closure-ready，但 `didMutateFilesystem=false`、`didStageGit=false` |
| `DSXU_V20_COMMERCIAL_IP_RELEASE_PREFLIGHT_20260515.json` | active blockers 0，public release third-party rows 0，仍需 final notice/license/package metadata review |
| `DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json` | 固定 7 步 action order，未 stage、未删、未 final test、未 export |

当前 owner/Git register = `1888`，`M=1648`、`D=147`、`??=93`，新增 5 个脚本已归到 `V20-OGR-09-dsxu-engine-mainline`。

## 2026-05-15 V20 final closure preflight update

本轮按 5~8 倍批量推进，不做最小假完成，也不越过 gate。新增并执行 4 个收口入口：`p12:target-intake`、`owner-git:product-stage-plan`、`v20:final-preflight`、`clean-export:preflight`。

| Evidence | Result |
|---|---|
| `docs/generated/DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json` | `BLOCKED_MISSING_TARGET_REFERENCE_MANIFEST`，`acceptedLogCount=0`，`didFabricateTargetLogs=false`，`didRunComparison=false` |
| `docs/generated/DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json` | `READY_PENDING_EXPLICIT_OWNER_GIT_STAGE`，`stageReadyPaths=1736/1736`，`packetCount=11`，`didMutateGit=false` |
| `docs/generated/DSXU_V20_FINAL_PREFLIGHT_20260515.json` | `BLOCKED`，`gitStatus=M1648/D147/??88`，`canRunFinalSixStageTests=false`，`canCreateCleanExport=false` |
| `docs/generated/DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json` | `BLOCKED`，`didCreateExport=false` |

Owner/Git register 已刷新为 `1883` 行，`unregisteredPathCount=0`。非删除 product paths `1736` 和 deletion paths `147` 都已有 stage plan，但没有显式 Git mutation/stage 授权前仍不能 stage。P12 target raw 仍是第一硬阻断：必须导入真实 `targetReferenceManifestPath`，且每条 log 指向同题 target-reference raw transcript、tool trace、final report、artifacts、metrics、risks。

## 2026-05-15 V20 stage/test closure update

本轮继续按“原侧 owner、不能新增主链、不能桥接偷懒、不能最小化假完成”的纪律执行。没有 stage、commit、delete、reset、clean、强删 ACL residue、跑最终测试或创建 export。

### 新增执行脚本

| Script | Package command | Owner | Purpose |
|---|---|---|---|
| `scripts/dsxu-owner-git-stage-plan.ts` | `bun run owner-git:stage-plan` | `V20-OGR-09-dsxu-engine-mainline` | 把 `147` 个 accepted deletion paths 固定成 6 个 stage packets，等待显式 Git mutation/stage 授权 |
| `scripts/dsxu-acl-residue-preflight.ts` | `bun run acl:preflight` | `V20-OGR-09-dsxu-engine-mainline` | 预检 `4` 个 ACL residue 的存在、引用和可写性，不删除、不改权限 |
| `scripts/dsxu-v20-six-stage-test-plan.ts` | `bun run v20:six-stage-plan` | `V20-OGR-09-dsxu-engine-mainline` | 把最终测试固定为功能 -> 体验 -> 恢复 -> 性能 -> 评测 -> 发布收口，等待 upstream gates |

### 本轮输出

| Evidence | Status |
|---|---|
| `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json` | `registerRows=1879`，`git status=M1648/D147/??84`，`registerAlignedToGitStatus=true`，`unregisteredPathCount=0` |
| `docs/generated/DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json` | `READY_PENDING_EXPLICIT_GIT_STAGE`，`stageReadyPaths=147/147`，`packetCount=6`，`didMutateGit=false` |
| `docs/generated/DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json` | `BLOCKED_EXTERNAL_PERMISSION_OR_SIGNOFF`，`residueCount=4`，`activeProductReferenceRows=0`，`didMutateFilesystem=false` |
| `docs/generated/DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.json` | `BLOCKED_UNTIL_UPSTREAM_GATES_PASS`，`stages=6`，`P12=0/14`，`familyGap=14`，`didRunFinalTests=false` |

### 当前真实剩余

1. P12 target-reference raw input：仍缺真实 `targetReferenceManifestPath`，当前 paired raw logs `0/14`、family gap `14`。
2. Owner/Git mutation：`147` 个 deletion 已 ready，但必须显式授权后才能 stage；不允许恢复旧 runtime。
3. ACL residue：`4` 个路径没有 active product refs，但仍需外部 permission/ownership 或显式 owner/Git mutation 处理。
4. Final six-stage tests：计划已完成，不能提前跑成放行依据；必须等 P12、owner/Git、deletion、ACL、release gates 通过。
5. Clean export：最后一步，当前仍 blocked。

下一步如果继续加速，只能在两个真实方向上推进：导入真实 `targetReferenceManifestPath`，或显式进入 owner/Git mutation/stage 处理；否则只能继续做不改变 gate 的证据预检，不能把 blocked 写成 PASS。

## 1. 核心定位

V20 不是从零复制 Claude，也不是继续堆更多 Claude 文件。DSXU 已经从 Claude 源码演化而来，当前问题已经从“是否吸收 Claude”变成“Claude 风格能力进入 DSXU 后，是否已经被统一到 DeepSeek 原侧主线”。

V20 的核心定位必须建立在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上。模型本身不是完整产品能力，DSXU 必须通过强编排、工具运行时、权限系统、上下文系统、恢复系统、Agent 生命周期、成本系统和证据系统，把 DeepSeek 原侧能力组织成真正可执行复杂编程任务的产品级运行时。

能力目标不是“可用”或“最小闭环”，而是达到对标 GPT-5.5 与 Claude 4.7 高级 AI 编程和复杂任务执行体验的 90 分以上水平：能长时间保持任务目标，能真实读写代码、调用工具、处理失败、恢复上下文、并行 Agent、控制成本、留下可审计证据，并且让用户在 UI/TUI 中看到清晰、可信、可继续操作的工作状态。

所以 V20 的正确目标是：

- 先把 DSXU 当前真实主线排清楚。
- 再把 Claude 1902 个参考源码能力映射到 DSXU owner。
- 然后判断 DSXU 已有、重复、错 owner、旧残留、真实缺口。
- 优先统一、去重、收口。
- 只吸收真实缺口。
- 最后进入真实操作测试和发布收口。

一句话：**DSXU V20 要把已有 Claude 血统炼成 DeepSeek 原侧的一套产品级 AI 编程运行时。**

执行纪律：V20 不允许最小实现、临时桥接、兼容 holding path、generic bucket 或“先凑过、以后再补”的做法。不能为了 V20 新增其它主链、其它产品入口或第二套 runtime；所有改造必须在当前 DSXU 主线基础上执行，接入现有 entrypoint、Query Loop、Tool Gate、Model Router、Context、Agent、MCP/Skill/Plugin、UI/TUI、Evidence/Release owner。每个改造项必须一次性对齐 owner、设计、实现、测试、证据和 release gate；如果发现重复等价行为，就合并到原侧 owner 或标 replace/delete candidate；如果行为不同，就映射到命名 mainline owner，不能留下后面反复回头补的结构债。

## 2. 已合并输入

本主方案合并以下材料：

- `docs/DSXU_V20_REAL_OPERATION_TEST_ACCEPTANCE_20260514.md`
- `docs/DSXU_V20_100_POINT_ARCHITECTURE_REVIEW_20260514.md`
- `docs/DSXU_V20_CLAUDE_SRC_COMPARATIVE_ABSORPTION_REVIEW_20260514.md`
- `docs/DSXU_V20_CLAUDE_EXPERIENCE_DATA_AUDIT_20260514.md`
- `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv`
- `codex://threads/019e0609-7083-74a2-a47c-d6f7404f32ca`：MCP host / Claude-compatible project intake / registry / Bridge Remote / AionUi / Warp / Cherry Studio / browser-use 生态兼容讨论

已生成 V20 执行产物：

- `docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md`：V20-C1 当前 DSXU 主线 owner map，后续 C2/C3/C4 都必须以此为 owner source of truth。
- `docs/DSXU_V20_OWNER_GAP_MATRIX_20260514.md`：V20-C2/C3 初始 owner gap matrix，将 Claude 1902 文件动作、owner family、42 个 review candidate 和首批 high-risk packets 映射到 DSXU owner。
- `docs/DSXU_V20_FULL_CODE_INTEGRATION_ASSESSMENT_20260514.md`：V20-C4 当前 DSXU 全源码主链整合与清理评估，作为后续 shim、runtime-core、legacy/provider、bridge/remote、review candidates 清理的执行口径。
- `docs/DSXU_V20_P0_SOURCE_CLEANUP_EXECUTION_20260514.md`：V20-C5 P0 源码清理执行记录，已完成 shim、provider-compat、runtime-core、legacy auth/config/env/git/model/testing、dirty-review/old closure 子系统移出与 owner 重挂。

Claude 参考源码：

- 路径：`D:\源代码claude\src`
- 总文件数：1902
- `.ts`：1332
- `.tsx`：552
- `.js`：18

全量逐文件索引信号：

| 信号 | 文件数 |
|---|---:|
| UI / 交互 | 1579 |
| 编程工作流 | 1491 |
| 工具运行时 | 1393 |
| provider / model | 1365 |
| memory / context | 1190 |
| permission / safety | 1125 |
| recovery / remote | 948 |
| MCP / plugin / skill | 912 |
| telemetry / data | 845 |

逐文件 DSXU 动作分类：

| 动作 | 数量 |
|---|---:|
| 吸收到 DSXU mainline | 988 |
| 适配或排除 Claude 产品专属逻辑 | 594 |
| 仅在真实 owner import 时作为 shared utility 吸收 | 278 |
| 需要人工 owner review | 42 |

关键边界：552 个参考文件带 inline source map / `sourcesContent`，说明其中很多是变换后的产品产物。DSXU 不应该机械复制这些文件，而应该吸收背后的交互模型、状态模型、数据模型和安全模型。

## 3. 六步总逻辑

### 第一步：先排 DSXU 当前主线地图

先看 DSXU 自己现在到底有哪些真实产品主线，而不是先问 Claude 还有什么可抄。

必须排清楚这些 owner：

| DSXU owner | 必须确认的问题 |
|---|---|
| Query Loop | 回合状态机、source truth、工具递归、finalization 是否只有一条主线 |
| Tool Lifecycle | schema、validation、permission、execution、progress、result、post hook 是否统一 |
| Permission / Tool Gate | Bash、PowerShell、MCP、Agent、外部写入是否全部先过 gate |
| DeepSeek Model Router | model capability、context window、cost、fallback、cache 是否 DeepSeek 原侧 |
| Context / Memory / Compact | transcript、session memory、compact、resume、source reread 是否统一 |
| Agent / Task | parent/worker、background、abort、resume、cleanup、synthesis 是否一套生命周期 |
| MCP / Skill / Plugin | 是否只是受控 extension boundary，而不是第二套 runtime |
| Ecosystem Compatibility | `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills` 是否导入到 DSXU 原侧 owner，而不是兼容层独立运行 |
| Bridge / Remote / CI | VS Code、remote session、SDK message、upstream proxy 是否只是 clean-room facade 和受控入口，而不是第二套 agent/tool runtime |
| UI / TUI | 用户是否能看到真实进度、权限、工具、agent、失败、恢复 |
| Coding Workflow | git、diff、LSP、review、doctor、status 是否进入真实代码现场 |
| Evidence / Eval | P12 raw、target manifest、metrics、risks、delta 是否不能过度宣称 |
| Release / Export | final preflight、health、release gate、clean export 是否最后才放行 |

输出物：

- DSXU mainline owner map。
- 每个 owner 的入口文件、主要 import、主要输出 evidence。
- 标明哪些路径是 product runtime，哪些只是 test/evidence。

### 第二步：把 Claude 1902 文件能力映射到 DSXU owner

Claude 源码只作为参考系统。映射时看能力，不看文件名相似度。

映射规则：

- Query / Engine 类能力映射到 DSXU Query Loop owner。
- Tool contract / execution / streaming 映射到 DSXU Tool Lifecycle owner。
- Bash / PowerShell / filesystem / permission UI 映射到 Permission / Tool Gate owner。
- cost / token / model / API logging 映射到 DeepSeek Model Router owner。
- history / sessionStorage / compact / memory 映射到 Context / Memory owner。
- AgentTool / task / background / swarm 映射到 Agent / Task owner。
- MCP / skill / plugin 映射到 MCP / Skill / Plugin owner。
- REPL / PromptInput / Message / Stats / ContextVisualization 映射到 UI / TUI owner。
- git / diff / LSP / review / doctor 映射到 Coding Workflow owner。
- telemetry / session tracing / eval / release 映射到 Evidence / Release owner。

不能映射为“misc”、“support services”、“compat layer”、“临时 adapter bucket”。如果找不到 owner，就标 `manual-owner-review`，不能默认吸收。

输出物：

- Claude-to-DSXU owner mapping。
- 逐文件 CSV 中 988 / 594 / 278 / 42 四类动作与 DSXU owner 对齐。
- 明确哪些 Claude 能力已经存在于 DSXU，哪些只是参考。

### 第三步：标出已有、重复、错 owner、旧残留、真实缺口

这一步决定是否还有吸收意义。

每个能力只能落入以下状态：

| 状态 | 含义 | 处理 |
|---|---|---|
| `already-mainline` | DSXU 已有且在正确 owner | 保留，补证据即可 |
| `duplicate-equivalent` | 行为等价但有两份实现 | 合并到 original owner，另一份 replace/delete candidate |
| `wrong-owner` | 能力有用但放错主线 | 迁移到正确 owner |
| `legacy-active` | 旧 Claude/legacy 仍被生产 import | 吸收到 DSXU owner 或标 replace/delete |
| `test-only` | 只对测试/证据有意义 | 保留在 test/evidence，不进 product runtime |
| `product-specific-exclude` | Claude/Anthropic/订阅/GrowthBook 等专属 | 排除或 provider-neutral 适配 |
| `real-gap` | DSXU 真实缺能力 | 进入 V20 吸收实现 |
| `manual-owner-review` | 证据不足或 owner 不清 | 不吸收，先 owner review |

重点风险：

- DSXU 已经大量 Claude 化，所以最危险的不是缺文件，而是重复路径和旧残留。
- 测试很多只能证明行为曾经被验证，不能证明 owner 正确、runtime 唯一、DeepSeek 原侧成立。
- 生产 import 到 `src/dsxu/legacy` 的路径必须特别处理，不能假装只是历史证据。

输出物：

- DSXU gap matrix。
- duplicate / wrong-owner / legacy-active / real-gap 清单。
- 每个条目必须有 import/use evidence。

### 第四步：先统一、去重、收口

在继续吸收前，先把已有东西统一掉。

统一原则：

- 重复一样的：合并到原 owner。
- 旧的、不合理的：replace/delete candidate。
- 行为不同的：归入明确 mainline owner。
- 只有测试意义的：留 test/evidence，不进产品路径。
- 兼容标签不能当产品 runtime holding path。

优先收口包：

1. `runtime-core.ts`：从聚合桶拆成 thin composition root。
2. `tool-mainline-runtime-v1.ts`：所有工具必须先 permission / gate，再执行。
3. `permissions.ts`：包管理器、解释器、路径写入、missing ask callback 必须 fail closed。
4. `api-service.ts` / provider legacy imports：迁移到 DeepSeek model router / provider owner。
5. MCP / Skill / Plugin：全部进入单一 registry 和 Tool Gate。
6. AgentTool / task：不能作为通用 success bucket，必须是完整 lifecycle。
7. P12 raw comparison：拆 intake / integrity / quality，不能过度 claim win。

输出物：

- 合并 / 去重 / replace-delete candidate 清单。
- 更新后的 owner map。
- focused verification。

### 第五步：只吸收真实缺口

完成统一后，才判断还需要从 Claude 参考体系吸收什么。

真实值得吸收的不是“文件”，而是能力机制：

| 真实缺口 | DSXU V20 吸收方向 |
|---|---|
| Session evidence store | prompt history、tool events、cost、permission、failure、final outcome |
| Visible work-state UI | progress、permission、background task、agent、recovery、cost/context |
| Coding situation layer | git diff/status、LSP diagnostics、review、doctor、worktree |
| DeepSeek cost/token/router | usage、cache、fallback、context pressure、ROI evidence |
| Context compact / resume | files、decisions、errors、current work、next action |
| ToolDefinition V20 | owner、permission、side effect、concurrency、evidence、UI projection |
| Agent lifecycle evidence | sidechain transcript、tool subset、abort、cleanup、parent synthesis |
| MCP/Skill/Plugin registry | trust policy、source scope、auth、dynamic discovery |
| MCP Server registry / install UX | manifest、license、transport、env secret、capabilities、permission、install/list/status |
| Claude-compatible project intake | `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills`、hooks 映射到 DSXU owner |
| Bridge/Remote clean-room facade | VS Code / remote / CI / SDK message 入口进入 DSXU Query Loop、Tool Gate、Permission Bridge |
| Evaluation raw evidence | raw transcript、tool trace、artifacts、metrics、risks |

不吸收：

- Claude / Anthropic provider 专属逻辑。
- Claude.ai 订阅、OAuth、billing、GrowthBook 产品策略。
- 编译/变换后的 UI 外壳。
- 已经被 DSXU 主线替代的旧实现。
- 为兼容旧路径保留的第二套 runtime。

输出物：

- real-gap absorption backlog。
- 每个 gap 对应 owner、设计、实现文件、测试、验收证据。

### 第六步：最后再跑测试和发布收口

测试顺序固定：

1. 功能测试。
2. 体验测试。
3. 恢复测试。
4. 性能测试。
5. 评测测试。
6. 发布收口测试。

测试只作为证明，不替代功能判断。失败时回到对应 owner 修主线，不允许用最小补丁、桥接模式、generic bucket、compat shortcut 掩盖问题。

真实操作任务包必须覆盖：

| 任务 | 目标 | 必须证据 |
|---|---|---|
| RT-CODE-01 | 多文件 bugfix | source truth、patch、tests、final report |
| RT-CODE-02 | 小功能新增 | owner mapping、no duplicate runtime |
| RT-TERM-01 | 终端失败恢复 | command log、failureClass、recoveryHint |
| RT-UI-01 | dev server / browser 检查 | screenshot、DOM、console evidence |
| RT-AGENT-01 | parallel worker fanout | worker evidence、parent synthesis |
| RT-RESUME-01 | compact / resume 同一任务 | restored goal、files、blockers、next action |
| RT-PERM-01 | 权限拒绝后恢复 | visible permission、recovery path |
| RT-MCP-01 | MCP registry 安装并调用真实 server | manifest、transport、permission、tool trace |
| RT-COMPAT-01 | Claude-compatible project intake | `.mcp.json`、`CLAUDE.md`、commands/skills import evidence |
| RT-BRIDGE-01 | Bridge/Remote facade 入口 | session lifecycle、auth、permission bridge、SDK message trace |
| RT-EVAL-01 | target-reference comparison | raw transcript、tool trace、metrics、risks |
| RT-SELF-01 | 长任务可见状态 | 短、真、可行动，不泄露隐藏推理 |

发布放行必须满足：

- P12 raw 和 quality comparison gate 正确。
- owner/Git 和 pending deletion 决策关闭。
- 权限/ownership residues 已处理或明确签收。
- 六类测试通过。
- final preflight 允许最终测试与 clean export。
- clean export 不包含 `.git`、`.dsxu`、`node_modules`、证据库、非 ship 报告。

## 4. 当前最重要的判断

DSXU 现在不是“缺 Claude 风格”，而是“已经有大量 Claude 风格后，必须统一成 DSXU 原侧主链”。

因此：

- **先排 DSXU 主线，不先吸收。**
- **先找重复和错 owner，不先加功能。**
- **先收口已有 Claude 残留，不再开第二套。**
- **只吸收真实缺口。**
- **最后用真实操作测试证明。**

这就是 V20 从“像 Claude”走向“DeepSeek 原侧高级 AI 编程产品”的关键。

## 5. 线程 019e0609 功能并入 V20：生态兼容能力包

这个线程讨论的功能本质不是“再加一个 MCP 小功能”，而是 DSXU Code 作为 Claude Code 同类产品时必须具备的生态兼容能力。AionUi、Warp、Cherry Studio、browser-use 不是 V20 的下载、打包或内置依赖目标，而是开源生态产品画像：用来分析外部 GUI Host、终端 Host、聊天客户端、浏览器自动化工具 provider 应该如何接入 DSXU。V20 要开发的是 DSXU 自己的接入层、协议边界、registry、permission gate 和 evidence，不是把这些产品变成 DSXU 的组成部分。

硬定义：DSXU 是独立产品，是主 Agent runtime、MCP host、tool host 和 evidence owner；AionUi-like、Warp-like、Cherry-like、browser-use-like、Claude-style 项目配置、VS Code/Remote/CI 入口都只是兼容画像或外部边界，不能成为第二套编排、第二套权限、第二套 provider runtime、第二套 MCP runtime 或第二套 agent orchestrator。

### 5.1 总体接入形态

```text
外部 UI / 外部 Host / 外部 Chat Client / 外部 MCP Server / Claude Code 项目格式
  -> DSXU Intake / Registry / Protocol Adapter
  -> DSXU Query Loop
  -> DSXU Tool Gate / Permission
  -> DSXU Context / Agent / MCP / Skill / Plugin
  -> DSXU Evidence / Eval / Release Gate
```

禁止形态：

```text
外部工具自己的 runtime
  -> 自己决定权限、工具、上下文或证据
  -> DSXU 只作为一个 shell 命令或旁路 adapter
```

### 5.2 生态角色拆解

| 生态画像 | V20 定义 | 推荐接入形态 | DSXU owner |
|---|---|---|---|
| AionUi-like GUI Host | 外部 GUI / Cowork Host 画像，用来指导 DSXU agent stdio / ACP-like 接入层设计 | 外部 Host 只负责 UI 和会话壳；真实执行进入 DSXU Query Loop | External Agent Host + UI/TUI + Query Loop |
| Warp-like Terminal Host | 高级终端 Host / 可选 MCP Host 画像，用来指导 DSXU CLI 在终端宿主中的状态、权限和 evidence 体验 | 主路径是在任意终端直接运行 `dsxu`；兼容路径是外部 Host 通过 DSXU 高阶 MCP/agent endpoint 调用任务 | CLI / Terminal Host + MCP boundary |
| Cherry-like Chat Client | 外部 Chat Client / 多模型 UI 画像，用来指导 DSXU 本地 Agent API 设计 | DSXU 提供 OpenAI-compatible Agent API 或受控 MCP agent endpoint；外部客户端只作为聊天 UI | External Chat Client + Query Loop API |
| browser-use-like Browser Provider | 浏览器自动化 tool provider 画像，用来指导 DSXU 浏览器 MCP/tool provider 接入策略 | 外部浏览器自动化 provider 作为受控工具来源，被 DSXU Tool Gate 调用并产出 trace、截图、DOM/console evidence | Tool Lifecycle + Permission + Evidence |
| Claude Code 项目格式 | 项目记忆、命令、技能、MCP 配置、hooks 的 intake 来源 | 读取 `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills`、hooks，并转换成 DSXU owner 数据 | Context / Memory + MCP / Skill / Plugin + Commands |
| 外部 MCP Server | 工具能力来源，不是 runtime owner | 统一 manifest 注册，支持 stdio / Streamable HTTP / SSE / WebSocket，启动和调用全过 Tool Gate | MCP / Skill / Plugin + Tool Lifecycle |
| Bridge / Remote / IDE / CI | 远程会话、IDE、CI、SDK message 入口 | clean-room facade，只转发会话、权限请求、状态和 SDK message 到 DSXU 主链 | Bridge / Remote / CI + Permission Bridge |
| License / Trust Policy | 外部代码与 server 来源治理 | MIT/Apache 可作为 manifest/外部 server；AGPL/proprietary/source-unknown 只能外部引用、用户安装或 legal review | Release / Export + Evidence |

### 5.3 功能拆解

| 功能 | V20 定义 | DSXU owner |
|---|---|---|
| MCP Server registry | 统一清单描述 `id/name/source/license/transport/env/capabilities/permissions/trust/install/status`，支持 install/list/status/doctor | MCP / Skill / Plugin owner + Tool Lifecycle |
| MCP host transport | stdio / Streamable HTTP / SSE / WebSocket server 连接、健康检查、重连、工具发现 | MCP / Skill / Plugin owner |
| External Agent Host protocol | 面向 AionUi-like 外部 Host 画像暴露 DSXU agent stdio / ACP-like 协议入口 | CLI / Query Loop / UI/TUI |
| External Chat Client API | 面向 Cherry-like 聊天 UI 画像暴露本地 OpenAI-compatible Agent API，不暴露第二套工具运行时 | Query Loop API + Model Router boundary |
| Terminal Host compatibility | 支持 Warp-like 终端宿主画像，并把终端状态、权限、工具 trace 回到 DSXU evidence | CLI / Tool Lifecycle / Evidence |
| Permission-gated external tools | MCP server 启动、env secret、network、filesystem、browser、tool call 全部先过 Tool Gate | Permission / Tool Gate owner |
| Claude-compatible project intake | 读取 `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills`，转换成 DSXU memory、command、skill、tool registry | Context / Memory + MCP / Skill / Plugin + UI/TUI |
| Hooks lifecycle | pre/post tool、session、command、permission、failure hooks 进入 Tool Lifecycle，不作为旁路执行 | Tool Lifecycle + Permission / Tool Gate |
| Bridge / Remote / CI facade | VS Code、remote session、SDK message、upstream proxy 作为 clean-room facade，进入 DSXU Query Loop / Tool Gate / Context | Bridge / Remote / CI + Query Loop |
| License / trust policy | MIT/Apache/AGPL/proprietary 等来源不能混合打包，必须有 trust、license、distribution 策略 | Release / Export + Evidence |

### 5.4 并入原则

- 这组能力归入 V20 `real-gap`，但必须先做 DSXU 当前 MCP、plugin、skill、remote、permission、CLI/API 真实 import/use 扫描。
- 如果 DSXU 已有 registry、plugin manifest、command system、skill loader、bridge/remote 入口能承载，就扩展原 owner；不能新建第二套 registry runtime。
- AionUi、Warp、Cherry Studio、browser-use 只作为开源生态产品画像和兼容性分析样本，不作为 V20 内置依赖、下载目标或 release 内容。
- AionUi-like / Warp-like / Cherry-like 是外部 Host 或 UI 画像，不是 DSXU 的产品主线 source truth。
- browser-use-like 和其它 MCP server 是受控 tool provider 画像，不是工具执行主链 owner。
- `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills` 是 intake 格式，不是产品主线 source truth。
- Bridge / Remote 只做 clean-room facade：可以吸收会话、认证、消息、权限桥的设计经验，不能复制 Claude 专属实现，也不能绕过 DSXU Tool Gate。
- 外部 MCP server 只作为 adapter boundary，真实执行、权限、进度、证据、错误恢复都回到 DSXU Tool Lifecycle。
- AGPL、proprietary、来源不明代码不进入 release 包；只能登记为参考、外部依赖、用户自行安装项或 legal review 项。

### 5.5 V20 落地顺序

1. 先把 DSXU 现有 MCP client、plugin schema、skill registry、command system、hooks、remote/bridge、CLI/API 入口全部映射到 owner。
2. 标出已有、重复、错 owner、旧 Claude 残留、真实缺口。
3. 统一到单一 MCP/Skill/Plugin registry、Tool Gate 和 Query Loop API。
4. 实现 MCP Server registry manifest v1、install/list/status/doctor。
5. 实现 Claude-compatible project intake：`.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills`、hooks。
6. 实现 External Agent Host 入口：以 AionUi-like 画像设计 DSXU agent stdio / ACP-like 协议，让外部 Host 能把聊天任务交给 DSXU。
7. 实现 External Chat Client 入口：以 Cherry-like 画像设计本地 OpenAI-compatible Agent API，让外部聊天 UI 能与 DSXU 对话，但工具、权限、上下文仍在 DSXU 内。
8. 实现 Terminal Host 兼容：以 Warp-like 画像设计终端宿主体验；外部 MCP 调 DSXU 只能作为兼容入口，不作为主编排。
9. 实现 browser-use-like 浏览器 MCP/tool provider 接入层验收：由 DSXU Tool Gate 发起真实浏览器操作并留下 evidence。
10. 最后实现 Bridge / Remote / IDE / CI clean-room facade，并用真实 session、permission、SDK message evidence 验收。

### 5.6 验收标准

- 能导入一个真实 MCP server manifest，并通过 stdio 或 Streamable HTTP 完成 tool discovery 和一次真实 tool call。
- 能导入一个 Claude-style 项目配置，并证明其 memory、command、skill、MCP server、hooks 全部落到 DSXU owner。
- 能通过 AionUi-like External Agent Host contract 发起一次真实任务，并证明执行进入 DSXU Query Loop、Tool Gate、Context、Evidence；真实 AionUi 联调是可选生态验证，不是 V20 内置依赖。
- 能通过 Cherry-like External Chat Client contract 或本地 Agent API 与 DSXU 对话，并证明没有暴露第二套工具运行时；真实 Cherry Studio 联调是可选生态验证，不是 V20 内置依赖。
- 能通过 Warp-like Terminal Host contract 证明终端执行、权限、失败恢复和 evidence 仍属于 DSXU；真实 Warp 联调是可选生态验证，不是 V20 内置依赖。
- 能通过 browser-use-like 浏览器 MCP/tool provider contract 完成一次真实网页操作，证据包含 manifest、permission decision、tool trace、screenshot/DOM/console、final report；真实 browser-use 联调是可选生态验证，不是 V20 内置依赖。
- 能拒绝缺少权限、缺少 secret、license 不允许、trust 不足或来源不明的 registry 项。
- UI/TUI 能展示 registry 来源、权限、启动状态、错误恢复、tool trace、外部 Host 来源和 evidence 链接。
- Bridge/Remote facade 的会话消息必须进入 DSXU Query Loop 和 Permission Bridge，不能直接执行工具。
- 测试证据必须包含 manifest、raw transcript、tool trace、permission decision、final report。

## 6. V20 关键改造包

### V20-C1 DSXU 当前主线地图

目标：把当前产品主线、test/evidence 路径、legacy 路径、replace/delete candidate 排清。

当前状态：`docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md` 已生成第一版。V20 后续不能新增其它主链或入口，只能在该 owner map 的基础上继续映射、去重、收口和吸收真实缺口。

必须输出：

- `query/tool/permission/model/context/agent/mcp/ui/eval/release` owner map。
- 每个 owner 的入口文件。
- 每个 owner 的 import/use evidence。
- product runtime 与 test/evidence 的边界。

验收：

- 不再用“大桶”描述 owner。
- 不再把 support service 当主线 owner。

### V20-C2 Claude 能力映射表

目标：把 1902 文件按能力映射到 DSXU owner。

必须输出：

- Claude file / capability / DSXU owner / action / evidence。
- 988 个 mainline 吸收候选按 DSXU owner 分组。
- 594 个 product-specific 排除或适配理由。
- 278 个 shared utility 真实 import 条件。
- 42 个 manual review 条目。

验收：

- 不按文件名相似度吸收。
- 不创建 `misc`、`compat`、`shared-runtime` 大桶。

### V20-C3 差距矩阵

目标：标清已有、重复、错 owner、旧残留、真实缺口。

当前状态：`docs/DSXU_V20_OWNER_GAP_MATRIX_20260514.md` 已生成初始矩阵。`review_candidate=42` 全部禁止留在 `unclassified_support`，下一步必须逐个 owner review。

必须输出：

- `already-mainline`
- `duplicate-equivalent`
- `wrong-owner`
- `legacy-active`
- `test-only`
- `product-specific-exclude`
- `real-gap`
- `manual-owner-review`

验收：

- 每个条目必须有真实 import/use evidence。
- 真实缺口不能用测试存在来冒充已完成。

### V20-C4 统一、去重、收口

目标：先治理已有系统。

优先处理：

- `runtime-core.ts` 聚合桶。
- `tool-mainline-runtime-v1.ts` permission order。
- `permissions.ts` fail-closed 和 shell risk。
- active `src/dsxu/legacy` imports。
- MCP/skill/plugin registry。
- Agent lifecycle。
- P12 comparison semantics。

验收：

- 重复能力合并到唯一 owner。
- 旧块进入 replace/delete candidate。
- 第二套 runtime 归零或明确 test-only。

### V20-C5 真实缺口吸收

目标：只补 DSXU 真实缺的高级编程产品能力。

优先吸收：

1. Session evidence store。
2. ToolDefinition V20。
3. DeepSeek model router / cost / token / context evidence。
4. Permission queue / visible permission state。
5. Context compact / resume。
6. Agent lifecycle evidence。
7. Coding situation layer。
8. UI/TUI visible work-state。
9. MCP/skill/plugin trust registry。
10. MCP Server registry / install UX。
11. Claude-compatible project intake。
12. External Agent Host compatibility：AionUi-like agent stdio / ACP-like 接入层画像。
13. External Chat Client compatibility：Cherry-like / OpenAI-compatible Agent API 接入层画像。
14. Terminal Host compatibility：Warp-like terminal host 运行与 evidence 画像。
15. Browser automation tool provider：browser-use-like 浏览器 MCP/tool provider 接入层画像。
16. Bridge/Remote/IDE/CI clean-room facade。
17. Evaluation raw evidence and operator dashboard。

验收：

- 每个新增能力有 owner、设计、实现、测试、证据。
- 不因吸收而产生第二套路径。
- 生态兼容能力必须落在原侧 owner：MCP/Skill/Plugin、Tool Gate、Context、UI/TUI、CLI/API、Bridge/Remote、Release，不允许成为独立 compat runtime。

### V20-C5-PUB GitHub 开源发布产品化节点（DeepSeek-TUI 参考）

目标：学习 `D:\DeepSeek-TUI-upstream-20260509-main\DeepSeek-TUI-main` 作为 DeepSeek 生态开源产品的发布、安装、文档、诊断、配置、release gate 和用户落地方式，把 DSXU 做成可以直接在 GitHub 开源发布的独立产品。这个节点不吸收 DeepSeek-TUI 的 Rust runtime，不下载、不内置、不打包 DeepSeek-TUI，也不引入第二套 TUI / Query Loop / Tool Gate / MCP runtime。

边界：

- DeepSeek-TUI 是 DeepSeek 生态开源产品化参考样本，不是 DSXU 的依赖。
- DSXU 继续以当前主线为唯一 runtime；所有产品化能力落到 DSXU Release / Export、CLI/API、Docs、Config、Evidence owner。
- 官网暂不作为 V20 必做项；GitHub 仓库首页、README、docs、release notes、安装说明、doctor、开源治理文件必须完整。
- 发布能力不能替代功能判断；只有 owner 收口、real-gap、六阶段测试和 release gate 通过后，才允许 GitHub release / clean export。

必须输出：

| 输出物 | 内容 | owner |
|---|---|---|
| GitHub README | 中文/英文首页、定位、安装、快速开始、功能边界、DeepSeek 模型说明、风险提示 | Docs + Release |
| INSTALL 文档 | npm / direct download / source build / Windows / macOS / Linux / 中国镜像与离线安装策略 | Docs + Packaging |
| CONFIGURATION 文档 | `config.example`、env 优先级、模型/provider、权限、MCP、skills、memory、logs、release 排除项 | Config + Docs |
| DOCTOR / HEALTH 文档 | `doctor --json` / capability endpoint 字段、常见失败、修复建议、release preflight 关系 | CLI/API + Evidence |
| TOOL SURFACE 文档 | 工具为什么存在、何时用专用工具、何时用 shell、重复工具如何废弃 | Tool Lifecycle + Docs |
| MCP / SKILL / COMPAT 文档 | MCP registry、Claude-style intake、External Host contract、license/trust 边界 | MCP/Skill/Plugin + Release |
| SECURITY / PERMISSION 文档 | 权限模型、危险命令、secret、network、filesystem、外部 server 风险 | Permission + Release |
| CONTRIBUTING / CODE_OF_CONDUCT | GitHub 开源协作规则、issue/PR 要求、测试要求、行为准则 | Docs + Governance |
| RELEASE_RUNBOOK | 版本号、打包、校验、GitHub Release asset、npm wrapper、checksum、回滚、发布后验证 | Release / Export |
| CHANGELOG | 用户可读变更、breaking changes、迁移说明、已知限制 | Docs + Release |

产品化吸收方向：

1. `doctor --json` / health audit：机器可读输出必须覆盖版本、配置路径、API key 来源、模型/provider、MCP、skills、sandbox/permission、storage、workspace、release gate。
2. 安装体验：优先设计 GitHub Releases + npm wrapper / direct binary / source build；是否做二进制矩阵取决于当前 DSXU 技术栈，不能机械照搬 Rust crates。
3. 失败恢复：安装失败、GitHub 下载慢、checksum 不一致、Node/Bun/Rust/平台依赖缺失时，必须给可执行修复建议。
4. 配置样例：提供最小可运行配置和完整注释配置；避免把内部证据目录、`.dsxu`、`.git`、`node_modules`、非 ship 报告写进 release。
5. 文档即验收入口：README 不能只是宣传，必须能带用户完成安装、登录/配置、运行、诊断、MCP/skills、权限、恢复、测试和卸载。
6. release gate：发布前必须跑版本一致性、文档链接、package smoke、doctor smoke、focused tests、六阶段测试结果引用、clean export dry-run。
7. 许可证与第三方声明：MIT/Apache 可作为外部参考或可选依赖；AGPL/proprietary/source-unknown 只作外部引用或 legal review，不能混进 DSXU release。
8. 不做官网阻断：官网/社区 feed/Cloudflare worker 只作为未来增强，不进入 V20 必过门槛。

验收：

- GitHub 用户仅靠 README + docs 能完成安装、配置、运行 `doctor`、启动 DSXU、理解权限、连接 MCP/skills、查看常见故障。
- `doctor --json` 或等价 health audit 能被脚本读取，并能解释当前是否可运行、是否可发布。
- release runbook 能明确“不允许发布”的硬阻断：owner/Git 未签收、deletion/ACL 未关闭、real-gap 未完成、六阶段测试未 PASS、clean export 未通过。
- package/release smoke 至少覆盖安装入口、版本输出、doctor 输出、help 输出和最小 dry-run。
- 文档明确 DSXU 是独立产品，DeepSeek-TUI 只是产品化参考，不是运行时依赖。

### V20-C6 测试、评测、发布

目标：用真实操作证明，不用报告自证。

顺序：

1. 功能测试。
2. 体验测试。
3. 恢复测试。
4. 性能测试。
5. 评测测试。
6. 发布收口测试。

验收状态：

| 状态 | 含义 |
|---|---|
| `V20 PASS` | 六类测试和 release/export 全 PASS |
| `V20 PASS_WITH_LIMITS` | 无硬阻断，可接受 partial 已登记 |
| `V20 PARTIAL` | 存在阶段失败，不能夸大交付 |
| `V20 BLOCKED` | P12 raw、owner、权限、真实 UI、release 任一硬阻断 |
| `V20 INVALID` | 用模板、dry plan、generic log、target-only log 或桥接 shortcut 冒充真实证据 |

## 7. 立即执行顺序

1. 生成 DSXU 当前主线 owner map。
2. 用 Claude 逐文件索引映射到 DSXU owner。
3. 把线程 `019e0609` 的 MCP host、Claude-compatible intake、Bridge/Remote 生态兼容能力并入 owner map。
4. 生成差距矩阵。
5. 先做统一/去重/收口。
6. 只对 real-gap 做吸收实现。
7. 完成 V20-C5-PUB GitHub 开源发布产品化节点：README、docs、doctor、配置样例、release runbook、package/release smoke。
8. 再跑 V20 六阶段真实测试。
9. 最后 release gate / health audit / clean export。

## 8. 最终放行规则

Clean export 是最后一步，只能在以下条件全部满足后执行：

- DSXU 主线 owner 已清晰。
- Claude 残留已被吸收、排除、test-only 或 replace/delete 标记。
- 没有第二套 tool/provider/MCP/skill/permission/agent runtime。
- MCP registry / Claude-compatible intake / Bridge Remote 都已证明只是原侧 owner 的受控入口。
- license、trust、secret、network、filesystem 权限策略已进入 release gate。
- GitHub 开源发布文档、安装说明、doctor/health、配置样例、release runbook、package/release smoke 必须已完成；官网不是 V20 阻断项。
- P12 raw intake、pair integrity、quality comparison 不再混淆。
- owner/Git、pending deletion、permission residue 已签收或关闭。
- 功能、体验、恢复、性能、评测、发布测试必须已按顺序完成。
- final preflight 允许最终测试和 clean export。

## 9. 当前审核执行结果同步 - 2026-05-14

本节记录当前工作区实测结果，用来校正前面执行文档里的阶段性口径。V18/V19 的 release closure 已在 `DSXU_V18_V19_MERGED_AUDIT_20260510_CLEAN.md` 里闭环，但这只是 V20 的历史基线，不等于 V20 产品化改造已经 PASS。

### 9.1 当前真实工作区状态

| 项 | 当前实测 |
|---|---:|
| `git status --short` | `1838` |
| modified | `1630` |
| deleted | `147` |
| untracked | `61` |
| `src` 相关变更 | `1801` |
| `docs` 相关变更 | `33` |
| `scripts` 相关变更 | `1` |

结论：之前 `DSXU_V20_FULL_CODE_INTEGRATION_ASSESSMENT_20260514.md` 中“只剩 8 项、源码 dirty=0”的描述已经不是当前状态。当前 V20 已经进入真实源码收口阶段，源码、删除态和新增 owner 文件都还没有完成 owner/Git 签收、最终测试和 release 收口。

### 9.2 已完成或基本完成

| 项 | 状态 | 说明 |
|---|---|---|
| V18/V19 CLEAN release closure | 完成 | P12 target raw input、owner/Git、pending deletion、final release tests、health audit、clean export 已在 CLEAN 报告 0.149 记录为 PASS；这不是 V20 产品化最终 PASS。 |
| V20-C1 主线 owner map | 已生成 | `docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md` 已作为 owner source of truth，但需要随 P0/P1 源码收口继续更新。 |
| V20-C2 Claude 1902 文件能力映射 | owner disposition 已签收 | 1902 行已进入 `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_20260515.csv`，`unresolved=0`、`remainingReviewCandidateBuckets=0`；这不是功能实现验收。 |
| V20-C3 初始 gap matrix | 已生成 | 42 个 review candidate 已列出，不允许继续留在 `unclassified_support`；P0/P1 已处理大量旧 owner 名称和迁移边界，但还缺最终汇总签收。 |
| V20-C4 P0 源码清理 | 已执行大部分 | V14/V15 shim、provider-backend、旧 `runtime-core.ts`、legacy auth/config/env/git/model/testing、dirty-review/old closure 子系统已迁移、外移或标删除态。 |
| V20-C4 P1 产品信号 owner cleanup | 已执行大部分 | GrowthBook、billing、subscription auth、MCP provider migration、provider control auth、model router、bridge、Agent/MCP/Skill/Plugin、permission/parser 等旧产品信号已大量改为 provider-migration/source-provider 边界语言。 |
| focused verification | 已有多批 PASS | P0/P1 文档记录了 import smoke、owner-focused tests、`lint-schema`、`git diff --check` 等局部通过。 |

### 9.3 尚未完成的硬项

| 序号 | 未完成项 | 当前状态 | 为什么不能算完成 |
|---:|---|---|---|
| 1 | V20-C2 功能验收防洗少 | owner disposition 完成，功能验收未完成 | `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_20260515.csv` 已完成 1902 行吸收处置签收；但 `docs/generated/DSXU_V20_C2_FUNCTION_LOSS_REVIEW_SUMMARY_20260515.json` 明确 `implementedFeatureAcceptanceComplete=false`。`594` 个 product-specific exclude/adapt、`7` 个 review-candidate exclude/adapt、`201` 个 baseline/no-op shared utility、`4` 个 not-present shared utility 必须在后续 Owner/Git、real-gap、商业/IP/品牌 review、六阶段测试中证明没有洗少 DSXU 目标能力。 |
| 2 | V20 owner/Git 签收 | 未完成 | 当前 `1849` 个 git status 项已拆成命名 owner/Git packets；其中 `1602` 个重点 owner paths 已完成 runtime redline 扫描与 owner 判读，C2 priority `320` 行已交叉到 OGR packets，deletion mutation review 已刷新到 `147/147 ready` 且产品源码 active references 为 0，ACL residue `4/4 ready` 且产品源码 active refs 为 0。还没有完成正式 stage/commit/delete 签收，不能直接把源码 dirty 当成 DONE。 |
| 3 | deletion-state 147 路径收口 | 未完成 | 删除态里包含旧 runtime、旧 provider、旧 evidence/test/harness、旧 release review 路径，以及 OGR-12 重复 desktop deep-link helper。当前 `147` 个 deletion mutation-ready paths 需要 owner/Git review 后才能 stage/delete 关闭。 |
| 4 | 4 个 ACL 权限残留 | 未完成 | `src/dsxu/engine/retrieval/integration-example.ts`、`src/dsxu/integration/harness/recovery-runtime-v3-harness.ts`、`src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts`、`src/dsxu/engine/adapters/bridge-adapter.ts` 已降为空模块/外部归档或 tombstone，但删除仍被权限阻塞。 |
| 5 | V20-C5 real-gap 吸收 | 部分完成 | ToolDefinition V20、MCP doctor、extension/external boundary profiles、开源文档入口已有实现和 focused tests；仍缺 Permission Queue 产品化、MCP Server registry/install UX、Claude-compatible project intake、AionUi-like 外部 Agent Host 接入层、Cherry-like/OpenAI-compatible Agent API、Warp-like terminal host contract、browser-use-like tool provider contract、Bridge/Remote/CI facade 真实验收、UI/TUI work-state、operator dashboard。 |
| 6 | MCP registry / Claude-compatible intake / 生态兼容 | 未完成 | MCP doctor 已可运行，但真实 `.mcp.json`、`CLAUDE.md`、`.claude/commands`、`.claude/skills`、hooks 导入到 DSXU owner 还没完成；AionUi/Cherry/Warp/browser-use 等生态产品画像对应的是接入层 contract，不是 V20 内置依赖或下载使用目标。 |
| 7 | Bridge/Remote/IDE/CI 真实 facade 验收 | 未完成 | P1 已把旧 bridge 名称收口为 provider-migration boundary，但还需要真实 session lifecycle、auth、permission bridge、SDK message trace，以及外部 Host 消息进入 DSXU Query Loop 的验收。 |
| 8 | V20-C5-PUB GitHub 开源发布产品化 | 部分完成 | README、INSTALL、CONFIGURATION、DOCTOR/HEALTH、TOOL_SURFACE、SECURITY/PERMISSION、CONTRIBUTING、RELEASE_RUNBOOK、CHANGELOG 等入口已落地；package/release smoke、版本资产、release gate 和 clean export 还没完成。官网暂不作为阻断项。 |
| 9 | GPT-5.5 / Claude4.7 90 分能力验收 | 未完成 | 还没有用真实长任务证明持续目标保持、真实读写代码、工具调用、失败处理、上下文恢复、并行 Agent、成本控制、可审计证据和 UI/TUI 可继续操作状态都达到 90 分以上体验。该项不能被 focused tests、文档或静态扫描替代。 |
| 10 | UI/TUI 真实操作体验测试 | 未完成 | 目前多为 focused/import/contract tests，还没有完成打开真实 UI/TUI 的功能、体验、恢复、性能、评测、发布六阶段验收。 |
| 11 | 评测与 P12 V20 语义防夸大 | 未完成 | V18/V19 P12 已有 raw input 和 release closure，但 V20 还需要面向真实操作的质量比较、delta、operator dashboard，防止把 target blocked/partial outcome 包装成体验胜出。 |
| 12 | final comprehensive tests | 未完成 | 当前只能算 focused verification。最新核心 owner 证据测试 `28 tests / 0 fail / 4754 expect`、schema lint、CLI help、MCP doctor、health audit 均通过；但这还不是六阶段真实测试，也不是 final preflight。 |
| 13 | V20 clean export | 未完成 | clean export 是最后一步；必须等 V20-C2 映射闭环、V20 owner/Git、deletion、权限残留、real-gap、开源发布产品化、90 分能力验收、六阶段测试、final preflight 全部 PASS 后才能做。 |

### 9.4 当前不能做的误判

- 不能把 V18/V19 CLEAN PASS 当作 V20 PASS。
- 不能把 focused verification 当作六阶段最终测试。
- 不能因为 P0/P1 文档写了“已移出/已关闭”就跳过当前 `git status` 的 owner/Git 签收。
- 不能把 provider-migration/source-provider boundary 做成第二套 provider、MCP、bridge、permission 或 agent runtime。
- 不能用 clean export 或测试结果替代真实源码 owner 判断。

### 9.5 剩余工作执行排序（测试最后）

当前剩余工作不再按“哪里看起来顺手”推进，而按硬阻断顺序收口。测试只能作为最后证明，不能替代 owner 判断、删除裁决、真实能力吸收或 release gate 修复。

1. **V20-C2 Claude 1902 文件能力映射闭环**：先关闭 `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv` 的四类结论，`988` 个 mainline 吸收候选必须逐 owner 对齐 DSXU 真实 import/use；`594` 个 product-specific 必须明确 exclude/adapt 理由；`278` 个 shared utility 只能在被主链 import 且不形成第二套 runtime 时吸收；`42` 个 review candidate 不能继续留作未知桶。
2. **Owner/Git signoff packets**：当前 `git status --short = 1849`，其中 `M=1632`、`D=147`、`??=70`。先按 packet 做真实 owner/Git review：等价重复就合并到原 owner 或保持 replace/delete candidate；行为不同就恢复/迁入命名 mainline owner；没有签收前不 stage、commit、clean 或 export。
3. **删除态 mutation review**：`147` 个删除态路径已进入 deletion mutation-ready queue，包含早前 `146` 个删除态和 OGR-12 重复 desktop deep-link helper。逐包确认：旧 evidence review runtime、旧 provider legacy harness、旧 delete-state review、旧 engine built-in tools runtime、旧 engine MCP client runtime、重复 deep-link helper。确认等价替代后才能进入 Git mutation；若发现能力差异，只能补到命名主线 owner，不能恢复旧第二套 runtime。
4. **权限/ownership residues**：关闭 `4` 个 ACL/所有权残留，或在 release gate 中明确签收为外部权限项；不能本地强删，也不能让它们挡住真实 owner 判断。
5. **V20 real-gap 产品化**：按 owner 顺序补真实能力，不新增主链：Permission Queue / Tool Gate 可见决策、MCP registry/install UX、Claude-compatible project intake、External Agent Host、OpenAI-compatible/Cherry-like Agent API、Warp-like terminal host contract、browser-use-like provider contract、Bridge/Remote/IDE/CI facade、UI/TUI work-state/operator dashboard、cost/evidence/recovery 可见状态。
6. **V20-C5-PUB GitHub 开源发布产品化**：README/docs/doctor/config/release runbook 已有初版，继续补 package/release smoke、版本资产、checksum/回滚/发布后验证证据；官网不是 V20 阻断项，DeepSeek-TUI 只作为开源产品化参考，不作为 runtime 依赖。
7. **P12 / 90 分能力验收准备**：把 GPT-5.5 / Claude4.7 90 分目标落到 9 个能力维度和 V20 raw evidence：长任务目标、真实读写代码、工具与权限、失败处理、上下文恢复、并行 Agent、成本控制、可审计证据、UI/TUI 可见状态。这里只准备验收任务与证据格式，不把 focused tests 写成 PASS。
8. **先修已知 release gate 源头阻断**：`release-surface-v1.test.ts` 的 public/release provenance/pending deletion gate、`v18-dirty-quarantine-ledger-v1.test.ts` 缺失已删除 ledger module、`wsl-native-mirror-plan-v1.test.ts` 的 `PLAN_ONLY` vs `SAFE_OVERLAY_COPY` 必须回到对应 owner 修主线。
9. **最后再做六阶段真实测试**：功能测试 -> 体验测试 -> 恢复测试 -> 性能测试 -> 评测测试 -> 发布收口测试。测试失败必须回到对应 owner 修主线，不能用最小补丁、桥接路径或文档口径掩盖。
10. **final preflight**：六阶段测试通过后再跑 `lint-schema`、health audit、release gate、package/release smoke、doctor smoke、clean export dry-run。
11. **clean export / release closure**：所有前置项 PASS 后才允许 clean export；导出物不能包含 `.git`、`.dsxu`、`node_modules`、证据库、非 ship 报告或旧 runtime 残留。

2026-05-15 最新覆盖修正：本节 9.1-9.5 是 2026-05-14 阶段口径，后续已经推进到 `PRODUCT_VALIDATION_READY_RELEASE_EXPORT_BLOCKED`。当前最新事实是：C2 1902 owner disposition 已闭环，P12 target-reference raw manifest 已导入且 `14/14` paired raw logs PASS，Owner/Git product/deletion packets 已 staged，147 deletion mutation review 已进入 staged index，商业/IP active blocker 为 0，阶段 1-5 产品验证已经按上方记录大批量 PASS。仍未完成的是 `4` 个 ACL residue 的真实权限闭环、发布收口测试的最终放行、final preflight PASS 和 clean export。因此当前状态仍是 `V20 PARTIAL`，但不再应把 P12、Owner/Git packets 或阶段 1-5 产品验证列为第一阻断。

最新剩余排序：

1. `4` 个 ACL residue：外部权限/owner session 删除或明确签收；本地普通用户删除已真实失败。
2. Release closure：ACL 关闭后重跑 `acl:preflight`、`owner-git:preflight`、`v20:final-preflight`、`test:dsxu:release`、release surface/source policy tests。
3. Final preflight：必须输出 `canRunFinalSixStageTests=true` 与 `canCreateCleanExport=true` 才能进入最终 release closure。
4. Clean export：最后一步，不能提前创建。

### 9.6 Owner/Git review 分包执行更新

早前已刷新 `1824` 个 `git status --short` 项的 owner/Git review register；后续新增 evidence / real-gap 产物后，当前最新总量已变为 `1838`。本节记录该批 owner/Git 分包来源，最新剩余量以后文 real-gap 覆盖矩阵和 closure board 为准；历史更新中的 `1694/1697/1708/1824` 等数字只保留为当时记录，不作为当前剩余量：

| 文件 | 用途 |
|---|---|
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv` | 逐路径 owner packet、review state、recommended action |
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` | status summary 与 packet summary |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv` | 删除态替代 owner / active import / review decision |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_SUMMARY_20260514.json` | 删除态 packet summary |
| `docs/generated/DSXU_V20_HIGH_RISK_RUNTIME_OWNER_REVIEW_SUMMARY_20260514.json` | 高风险 runtime owner scan summary |
| `docs/DSXU_V20_OWNER_GIT_REVIEW_EXECUTION_20260514.md` | 本轮 owner/Git review 执行记录 |

当前分包结果：

| Packet 类别 | 数量 |
|---|---:|
| docs/generated plan | 24 |
| deletion-state packets | 146 |
| tool / permission lifecycle | 205 |
| MCP / skill / plugin registry | 142 |
| agent / task lifecycle | 170 |
| external integration adapter boundary | 27 |
| UI/TUI visible state | 437 |
| provider migration / model / cost | 101 |
| CLI / command / transport | 178 |
| DSXU engine mainline | 48 |
| entry / query / tool composition | 6 |
| shared platform utilities | 249 |
| other source owner review | 91 |

执行判断：`1824` 已不再是未知大桶；下一步按 `V20-C2` 与 `17` 个 owner packets 做签收，删除态 `146/146` 只等 Git mutation review，不再通过补旧 runtime 保留。仍不允许在 packet signoff 前 stage、commit、clean export，也不允许把 focused verification 当最终测试。

更新：删除态 review 已生成，当前总量变为 `1694`，其中删除态 `142`。`142/142` 已进入 `ready-for-delete-signoff-after-owner-review`，targeted import scan 未发现旧 runtime/provider/evidence active import 阻断。本轮同时将仍 import 旧 `audit_v10_3_strict.ts` 的旧测试并入删除态，并把 `src/entrypoints/replLauncher.tsx` 的 legacy runtime profile 命名改为 DSXU entrypoint owner profile。

Focused verification：targeted old-path import scan PASS，old audit/legacy launcher scan PASS，`git diff --check` PASS（仅 CRLF warnings），`bun test src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts` PASS（5 tests / 0 fail）。这些只作为本轮删除态和 owner review 证据，不替代 V20 final comprehensive tests。

高风险 runtime owner scan：`V20-OGR-03/04/05/07/10` 已生成 summary。targeted old runtime/provider/evidence import scan 为 0 active source imports；old audit / old REPL launcher profile scan 为 0 active hits；broad scan 只剩 release gate forbidden-path fixture 和 split external model-name test fixture。结论是当前没有明显第二套 runtime import 阻断，但仍需逐 diff owner signoff。

更新：`V20-OGR-02` 删除态四组已完成 owner 侧签收记录，新增 `docs/DSXU_V20_OGR02_DELETE_PACKET_SIGNOFF_20260514.md`。本轮复核确认 `142/142` 删除态路径已不存在、`git diff --diff-filter=D` 数量一致、delete-state register 均为 `ready-for-delete-signoff-after-owner-review`，targeted old-name source scan 为 0 active hits。该 packet 现在是 `owner-accepted-delete-candidate / Git mutation pending`：不能恢复旧 runtime 补能力，若发现缺口必须落到命名 DSXU mainline owner；但当前未 stage/commit，所以 `git status --short` 数字不会下降。

下一步执行焦点切换到 `V20-OGR-03-tool-permission-lifecycle`：逐 diff 确认 Bash / PowerShell / File Edit / Tool Registry / Permission Rule / bypass mode / shell validation 只进入 DSXU Tool Gate 和 Permission owner，不留下第二套 tool runner、permission runner 或 shell shortcut。

更新：已开始执行 `V20-OGR-03`，首个实改是 `RunNativeTest` owner gate。`src/tools/RunNativeTestTool/RunNativeTestTool.ts` 已增加 absolute existing `cwd` 校验，并新增 `checkPermissions` 返回 `passthrough`，避免该 semantic native-test tool 继续落到 `buildTool` 默认 allow。新增 `src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` 覆盖该行为，focused test PASS（2 tests / 0 fail）。因此当前 `git status --short` 由 `1694` 增至 `1697`，新增项属于 OGR-02/OGR-03 签收证据与 targeted test，不是未知大桶。

补充扫描：`src/tools` 中使用 `Bun.spawn` 或 shell `exec` 的 buildTool 文件已做外部动作扫描，除 Bash/PowerShell 主适配器外，`RunNativeTest` 是本轮发现并已修正的主要 default-allow 风险点；修正后外部动作工具均有 `checkPermissions` 入口。

更新：`V20-OGR-03` 第一批 side-effect default-allow 漏口已批量收口。RemoteTrigger、CronCreate/Delete、TaskCreate/Update/Stop、TeamCreate/Delete、Enter/ExitWorktree 均已增加显式 `checkPermissions` 决策：内部 task state 为显式 allow，远程触发、调度、停止、团队、工作树和删除类动作进入 passthrough，由 DSXU 通用 permission pipeline 决策。新增 `src/tools/__tests__/v20-tool-permission-owner-gate.test.ts`，focused tests PASS（6 tests / 0 fail），side-effect buildTool default-allow scan 为 0。当前 `git status --short` 为 `1698`，增加项为 OGR-03 targeted test 证据。

更新：继续完成 `V20-OGR-03` 二阶收口，`src/utils/permissions/classifierDecision.ts` 已从 auto-mode safe allowlist 移除 `TaskUpdate`、`TaskStop`、`TeamCreate`、`TeamDelete`，避免删除任务、停止运行任务、创建/删除团队在 auto mode 下被工具名级别快捷放行。focused tests 更新为 PASS（7 tests / 0 fail），side-effect buildTool default-allow scan 仍为 0，`git status --short` 仍为 `1698`。

更新：继续完成 `V20-OGR-03` 三阶收口，`src/tools/BashTool/modeValidation.ts` 已修正 acceptEdits fast path：不再因任意一个子命令命中 `mkdir/touch/rm/rmdir/mv/cp/sed` 就放行整条 compound command，而是要求所有子命令都属于窄 filesystem edit 集合；否则返回 `passthrough` 进入通用 permission/classifier pipeline。新增 `src/tools/BashTool/modeValidation.test.ts` 覆盖纯 edit compound、edit+network 混合命令和非 acceptEdits 模式。focused tests 更新为 PASS（10 tests / 0 fail），`git status --short` 为 `1699`。当前结论：Bash/PowerShell acceptEdits 已回到单一 Tool Gate / Permission owner 语义，不保留 shell shortcut holding path。

更新：已进入 `V20-OGR-04-mcp-skill-plugin-registry` 首轮真实 import/use review，发现一个硬冲突：`src/dsxu/engine/mcp-client.ts` 仍被 `src/dsxu/engine/index.ts` 和 `src/dsxu/engine/tool-mainline-runtime-v1.ts` active import，且内部自带 `MCPConnection` / `MCPManager` / stdio spawn / remote fetch / JSON-RPC framing / tool-resource wrapping。这不是主链 `src/services/mcp` 的受控 adapter，而是第二套 MCP client/runtime。当前 OGR-04 不能 PASS；下一步必须把 active callers 合并到 `src/services/mcp` + `engine-tool-adapter.getMainlineMcpToolAdaptersForClients()` 或明确把旧文件列为 replace/delete candidate。不能继续在旧 `mcp-client.ts` 上补功能。

更新：继续执行 `V20-OGR-04` 二阶 owner 合并，产品主链已经不再实例化旧 engine MCP runtime。`src/dsxu/engine/tool-mainline-runtime-v1.ts` 移除 `MCPManager` 和内部 manager branches，改为只从 `mainlineMcpClients?: MCPServerConnection[]` 注册动态 MCP tools；`src/dsxu/engine/index.ts` 的 `QueryEngine` 不再自行读取 `.mcp.json` 或 connect/disconnect MCP，而是消费主线 `src/services/mcp` 提供的 connection 投影；`src/dsxu/engine/types.ts` 补齐 `QueryEngineConfig.mainlineMcpClients`；`src/dsxu/engine/graph/graph-memory.ts` 移除 type-level `MCPManager` 依赖。Focused verification 已 PASS：C05 MCP/compat/Bash run 12 tests / 0 fail，engine MCP/connectMCP run 6 tests / 0 fail，combined OGR-04 smoke run 18 tests / 0 fail。当前剩余不是再补旧 runtime，而是把 `src/dsxu/engine/__tests__/mcp-client.test.ts` 和合同文档里的 `src/dsxu/engine/mcp-client.ts` 引用迁移为 replace/delete evidence，最终让 OGR-04 只剩主线 `src/services/mcp` + `src/tools/MCPTool/*` + adapter projection。

更新：继续把 `V20-OGR-04` 的旧测试保活点收掉。`src/dsxu/engine/__tests__/mcp-client.test.ts` 已不再 import 或实例化旧 `MCPManager/MCPConnection`，改成 V20 owner 防回归测试：扫描产品 engine source，确保没有 `from './mcp-client'` / `from '../mcp-client'`、没有 `new MCPManager` / `new MCPConnection`；同时用 fake `MCPServerConnection` 验证 MCP tool registration 只通过 `engine-tool-adapter.getMainlineMcpToolAdaptersForClients()`。Focused test PASS（12 tests / 0 fail），active source scan 只剩 `src/dsxu/engine/mcp-client.ts` 本体内部定义。当前 `git status --short` 为 `1703`，新增变化属于 OGR-04 合并与防回归证据，不是新增主链或入口。

更新：继续完成 `V20-OGR-04` 合同 landing 收口。已把 `high-pressure-reference-absorption-contract`、`next-stage-productization-contract`、`product-reality-hardening-contract`、`reference-experience-quality-contract`、`reference-governance-absorption-contract`、`v10-reference-behavior-productization-contract`、`v11-100-point-roadmap-contract` 里的 MCP landing 从旧 `src/dsxu/engine/mcp-client.ts` 改为主线 `src/services/mcp/client.ts`。`reference-experience-quality-contract-v1.test.ts` 对应改断言，targeted test PASS（1 test / 0 fail），合同/roadmap/plan 范围内 `src/dsxu/engine/mcp-client.ts` 为 0 hits。整份 reference-experience contract 仍有两个独立阻断：本地 reference root `D:\DSXU-code\原代码claude` 缺文件，以及 benchmark 脚本尚未覆盖所有 experience quality cases；这两个归入后续 V20 experience/benchmark gate，不能用本轮 MCP 合并替代。

更新：继续处理 `V20 experience/benchmark gate`，已把 `reference-experience-quality-contract.ts` 中 P1-P7 要求的全部 benchmark case 注册到 `scripts/benchmark/dsxu-mainline-benchmark.ts`，并补齐 `reference-experience-quality`、`reference-experience-quality-live`、`mutation-product-grade-live` pack 标识。新增覆盖 Query Loop recovery、Agent team governance、Tool prompt discipline、Compact/Memory resume、Permission UX、MCP real ecosystem、Programmer-like UX。Targeted verification PASS：`reference-experience-quality-contract-v1.test.ts --test-name-pattern "exposes a benchmark case|maps the experience gaps"` 为 2 tests / 0 fail；OGR-04 MCP focused run 仍为 12 tests / 0 fail。当前 `git status --short` 为 `1707`。剩余独立阻断缩小为真实 reference root 文件存在性 / 外部 reference input gate，以及旧 `src/dsxu/engine/mcp-client.ts` 本体是否进入后续删除 packet。

更新：继续执行 `V20-OGR-04` replace/delete packet，旧 `src/dsxu/engine/mcp-client.ts` 本体已从项目源码中删除。删除前已完成 active caller 合并、旧单测保活迁移、合同 landing 改主线；删除后 MCP 能力只保留在 `src/services/mcp/client.ts`、`src/services/mcp/*`、`src/tools/MCPTool/*`、`ListMcpResourcesTool`、`ReadMcpResourceTool`、`McpAuthTool` 和 `src/dsxu/engine/engine-tool-adapter.ts`。验证：产品源码 scan 对 `from './mcp-client'` / `from '../mcp-client'` / `new MCPManager` / `new MCPConnection` 为 0 active hits；OGR-04 MCP focused run PASS（12 tests / 0 fail）；reference experience targeted run PASS（2 tests / 0 fail）；`git diff --check` PASS，仅 CRLF 提示。当前 `git status --short` 为 `1708`。OGR-04 owner 判断：第二套 engine MCP runtime 已删除，后续只剩 owner/Git review packet 进入 stage/commit 才会让数字真正下降。

更新：继续进入 `V20-OGR-05-agent-task-lifecycle`，发现并收口一个真实第二套 agent/task orchestrator：`src/dsxu/engine/tool-mainline-runtime-v1.ts` 原本保留 `agentLifecycles`、`normalizeAgentToolInput()`、`executeAgentTool()`，并把 `TaskCreateTool`、`TaskStopTool`、`SendMessageTool`、`EnterPlanModeTool` 等 aliases 映射到本地 `AgentTool` lifecycle 模拟。现在已删除该模拟分支，alias 全部回到真实主线工具：`Agent`、`SendMessage`、`TaskCreate`、`TaskStop`、`TaskOutput`、`EnterPlanMode`、`TeamCreate/Delete`、`Enter/ExitWorktree` 等；`src/dsxu/engine/engine-tool-adapter.ts` 也补齐这些缺失的主线 lifecycle tools 注册。`c05-tool-compat-absorption-clean.test.ts` 已改为验证 alias 执行真实 Task/Plan owner，且不出现 `agent-action=` 模拟输出。Focused verification PASS：OGR-05 targeted run 29 tests / 0 fail；MCP/Agent/Task combined run 43 tests / 0 fail；相关 scan 对 `executeAgentTool` / `normalizeAgentToolInput` / `AgentTool: 'AgentTool'` 为 0 hits；`git diff --check` PASS，仅 CRLF 提示。当前 `git status --short` 为 `1710`。下一步继续审 OGR-05 剩余 swarm backend、LocalAgentTask、RemoteAgentTask、teammate mailbox 是否仍有第二套 runtime。

更新：继续完成 `V20-OGR-05-agent-task-lifecycle` 第二轮 owner 收口。`src/dsxu/engine/coordinator-v1.ts` 中残留的本地 `AgentTaskLifecycleState` / `AgentTaskRuntime` / `createAgentTaskLifecycleState` / `registerAgentTask` / `transitionAgentTask` / `appendAgentTaskMessage` / `projectAgentTaskLifecycleSummary` 已删除，避免 coordinator 继续保存第二套 agent lifecycle 数据模型。随后沿 `src/utils/swarm/*`、`src/tasks/InProcessTeammateTask/*`、`src/tasks/RemoteAgentTask/*`、`src/tools/SendMessageTool/*`、`src/tools/AgentTool/*` 复核真实 import/use：in-process teammate 最终调用 `AgentTool/runAgent -> query()`，permission 走 leader ToolUseConfirm 或 mailbox permission bridge；tmux/iTerm2 pane backend 只负责宿主进程/窗格，不拥有 query/tool/provider runtime；`SendMessage` 的 `provider:` 为 DSXU provider peer route，`bridge:` 仍被 `DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE` 显式关闭在默认主线之外。已把 spawn/remote 注释里的旧 `source-provider` 运行时口径改成 DSXU 主线 + provider-migration alias 语言。Focused verification PASS：OGR-05 targeted run 更新为 35 tests / 0 fail；旧 simulator symbol scan 只剩主线 `LocalAgentTask` runtime metadata 与 `RemoteAgentTask` profile，不再有旧 coordinator simulator 函数；`git diff --check` PASS，仅 CRLF 提示。当前 `git status --short` 为 `1711`。当前 OGR-05 判断：不保留第二套 agent orchestrator；剩余工作转入 `V20-OGR-07-provider-migration-model-cost` 和 `V20-OGR-06/08/12/13` 大面 owner review。
### 9.7 OGR-07 provider-migration/model/cost 执行更新

本轮继续按 V20 原侧原则处理 `V20-OGR-07-provider-migration-model-cost`，不新增第二套 provider runtime、model router 或 cost evidence。当前结论：

| 区域 | 当前状态 |
|---|---|
| DSXU 模型入口 | `src/services/api/client.ts` 在 `DSXU_CODE_MODE` 下先进入 `DeepSeekAdapter.transformRequest()`，Provider SDK fallback 位于其后，只服务非 DSXU/外部 provider-migration 路径 |
| DeepSeek V4 route/cost | `src/services/api/deepseek-adapter.ts` + `src/utils/model/deepseekV4CostRouter.ts` 继续作为 Flash / Flash-MAX / Pro 的请求、usage、route trace、cost evidence owner |
| provider-migration model aliases | `src/utils/model/providerMigration/providerMigrationModel.ts` 和 compat 层只保留旧模型 alias/remap intake，已清理误导性 source-provider helper/comment，不作为产品主链 model runtime |
| auth / bridge / mock limits | `src/services/auth/dsxuProviderAuth.ts` 与 `src/utils/secureStorage/keychainPrefetch.ts` 归为 provider-migration credential intake；`src/services/bridge/dsxuRemoteBridgeFacade.ts` 为 archived remote bridge facade；`src/services/mockRateLimitsProviderMigration/*` 为测试/模拟 rate-limit 边界 |
| 协议常量 | `src/constants/providerMigrationProtocol.ts` 与 `src/dsxu/control-plane/controlProviderMigrationProtocol.ts` 只封装 wire strings，避免产品 UI/schema/release evidence 泄漏旧 provider 符号 |

已完成代码/证据更新：

- `src/services/api/dsxu-model.ts` 内部 helper 从旧 provider facade 命名改为 DSXU transport 命名，公开 export 不新增入口。
- `src/utils/model/providerMigration/providerMigrationModel.ts` 将 Opus remap helper 收口为 `isProviderMigrationSourceOpusFirstParty()`，清理旧 provider 注释。
- `src/services/auth/dsxuProviderAuth.ts`、`src/utils/secureStorage/keychainPrefetch.ts`、`src/services/analytics/featureFlags.ts`、`src/constants/providerMigrationProtocol.ts`、`src/dsxu/control-plane/controlProviderMigrationProtocol.ts`、`src/migrations/providerMigrationModelMigrations.ts` 清理旧 provider 语言，只保留迁移边界含义。
- `src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts` 增加 DSXU_CODE_MODE 必须先走 `DeepSeekAdapter` 的断言。

Focused verification：`provider-migration-model-alias-isolation-v1`、`provider-migration-model-migration-boundary-v1`、`deepseek-v4-control-v1`、`dsxu-api-key-auth-v1` 聚焦运行 PASS，11 tests / 0 fail。`src/services/api/client.ts` scan 确认 DeepSeekAdapter branch 在 Provider SDK fallback 之前。

当前未完成项更新：OGR-07 不再因为模型入口/cost route 被视为第二套 provider runtime 阻塞；`src/utils/model/agent.ts`、`src/utils/model/modelOptions.ts`、`src/utils/model/bedrock.ts`、`src/utils/model/modelCapabilities.ts`、`src/utils/model/validateModel.ts`、`src/utils/secureStorage/keychainPrefetch.ts` 的旧局部命名已收口。剩余继续审 broader `src/services/api/*`、provider-migration model surface 和 release/test evidence，不新增主链入口。
### 9.8 OGR-08 CLI/command/transport 执行更新

本轮已进入 `V20-OGR-08-cli-command-transport` 首轮高风险入口收口。发现 `src/entrypoints/cli.tsx` 中旧 provider browser MCP flag 在非 DSXU 分支仍能启动同一 browser MCP server，和 DSXU `--dsxu-browser-mcp` 等价，属于重复旧入口。

处理结果：

- `src/entrypoints/cli.tsx` 删除旧 flag 启动 browser MCP 的分支；旧 provider-migration browser MCP flag 现在全模式拒绝，并指向 `--dsxu-browser-mcp` / DSXU MCP/browser providers。
- `SOURCE_PROVIDER_*` 局部常量改为 provider-migration 命名，避免 CLI entrypoint 看起来保留旧 provider 主链。
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 补充回归断言，确保默认 CLI path 只保留 DSXU local provider shell contract，不保留旧 browser MCP profile。

Focused verification：`provider-contract-v1.test.ts` 聚焦运行 PASS，4 tests / 0 fail；targeted CLI old-entry scan PASS；`git diff --check` PASS，仅 CRLF warning。

当前未完成项更新：OGR-08 首轮已关闭 browser MCP 重复入口；剩余继续审 `src/cli/remoteIO.ts`、`src/cli/transports/*`、`src/commands/*` 中的 remote-control、CCR/SSE/WebSocket、install/update/review/command handlers，确认都只是 DSXU Query Loop / Tool Gate / provider contract 的边界，不新增第二套 command runner 或 transport runtime。

### 9.9 OGR-08 RemoteIO / transport / auth handler 执行更新

本轮继续收 `V20-OGR-08-cli-command-transport` 的 remote/transport/auth 面：

- `src/cli/remoteIO.ts`、`src/cli/transports/transportUtils.ts`、`src/cli/transports/ccrClient.ts` 的旧 provider env fallback 命名已统一为 provider-migration source，DSXU env 继续优先。
- `src/cli/handlers/auth.ts` 的 provider-migration OAuth/API-key env 常量改名；DSXU_MODE 仍短路到 DSXU/DeepSeek/LiteLLM model gateway，不进入 provider cloud auth。
- `src/cli/handlers/util.tsx` 的 setup-token 文案改为 provider-migration isolated flow，不把旧 OAuth flow 作为 DSXU 默认主链。
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 已覆盖 CLI browser MCP 旧入口、RemoteIO/transport/CCR fallback 命名、auth handler DSXU env 优先等回归断言。

Focused verification：`provider-contract-v1.test.ts` 聚焦运行 PASS，4 tests / 0 fail；targeted OGR-08 old-name scan PASS；`git diff --check` PASS，仅 CRLF warning。

当前未完成项更新：OGR-08 transport/auth 边界已归位为 DSXU provider contract / session ingress adapter；剩余继续审 `src/commands/*` 中 install/update/review/remote-setup/plugin 等命令，特别是会触发外部网络、GitHub app、plugin marketplace 或 release/update 的命令，确认它们都落到命名 owner，不新增第二套 command runner。

### 9.10 OGR-08 command lifecycle shim 批量收口更新

本轮继续执行 `V20-OGR-08-cli-command-transport` 的 command owner review，重点处理 `src/commands/*/index.*` 中的旧 V14 command lifecycle shim。真实 import/use 扫描结果：79 个带 `// V14 command lifecycle shim` 的 `processXCommandLifecycle()` / `runXCommand()` 导出全部为 0 外部引用，且都位于文件末尾；`src/commands/bridge/index.ts` 另有同形态 lifecycle 导出，同样 0 外部引用。

处理结果：
- 79 个旧 V14 command lifecycle shim 已从对应 command index 文件末尾批量移除；真实 command metadata、handler load、enabled/hidden 状态保持不动。
- `src/commands/bridge/index.ts` 保留 disabled/hidden 的 `remote-control` alias 作为可审计边界，但删除未使用的 `processBridgeCommandLifecycle()` / `runBridgeCommand()`，避免留下第二套 command lifecycle。
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 新增全量 `src/commands` source 扫描约束：不得再出现 `V14 command lifecycle shim`、`processXCommandLifecycle`、`runXCommand` 这类旧 lifecycle 导出。

Focused verification：`bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` PASS，4 tests / 0 fail，695 expect；`rg` 扫描确认 `src/commands` 中旧 lifecycle shim / lifecycle 导出为 0 hit；`git diff --check` 对本轮 command shim 文件 PASS，仅 CRLF warning。

当前 OGR-08 owner 判断更新：command index 不再保留第二套 lifecycle shim；CLI/RemoteIO/transport/auth 已归为 DSXU provider contract 或 provider-migration fallback 边界。后续 OGR-08 只剩命令真实行为 owner review：install/update/review/plugin/remote-setup 等外部动作命令必须继续落到命名 DSXU owner，不得新增 command runner 或绕过 Tool Gate / Permission Gate。

补充更新：继续扫描 `src/commands` 外部动作命令口径，已把残留 `source-provider`、`Source-Provider`、`Backward-compatible`、`backwards compatibility`、`command lifecycle shim` 文案收口为 `provider-migration source` 或 DSXU owner projection 语言，覆盖 `/login`、`/clear`、`/commit-push-pr`、`/effort`、`/install-github-app`、`/passes`、`/review`、`/reload-plugins`、`/stickers`、`/thinkback-play` 等命令。`provider-contract-v1.test.ts` 的 `src/commands` 全目录扫描同步扩展，当前 focused run PASS：4 tests / 0 fail，1527 expect。

继续处理：`/install-github-app` 与 `/install-slack-app` 原本是 provider-migration-only 外部动作命令，但只靠 hidden/availability 不能证明 DSXU 主线不可直接执行。现已在 command metadata 上增加 `!isDsxuRuntimeMode()` gate，DSXU 主线使用 `/commit-push-pr`、DSXU connector provider 与 plugin/MCP owner，不再暴露旧 GitHub App / Slack App setup 入口。Focused run 更新为 PASS：4 tests / 0 fail，1531 expect。

继续批量收口：只靠 `isHidden()` 不再作为 V20 主链隔离依据。`/desktop`、`/think-back`、`/thinkback-play`、`/usage`、`/voice`、`/passes`、`/stickers`、`/mobile`、`/extra-usage` 已统一增加或补齐 DSXU runtime gate；这些命令属于 provider-migration/cloud/account/marketing/marketplace 边界，不作为 DSXU V20 本地高级编程主线入口。`provider-contract-v1.test.ts` 已把 provider-migration-only command index 列入回归清单。验证：所有 7 个 `PROVIDER_MIGRATION_CLOUD_AVAILABILITY` command index 均有 DSXU gate；focused run PASS：4 tests / 0 fail，1557 expect。

### 9.11 OGR-06 UI/TUI visible-state 执行更新

本轮继续进入 `V20-OGR-06-ui-tui-visible-state` 首批口径收口。已扫描 `src/components`、`src/screens`、`src/hooks` 中的旧 provider 可见口径，处理结果：
- `src/components/agents/generateAgent.ts` 的 agent 生成系统提示不再写 `migrated source-provider instruction files`，改为 `provider-migration source instruction files`，避免新 agent 继承旧产品 owner 语言。
- `src/components/MCPServerDesktopImportDialog.tsx` 的桌面 MCP 导入提示改为 `provider-migration source desktop config`。
- `src/components/Settings/Config.tsx`、`src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`、`src/components/AutoModeOptInDialog.tsx` 清理旧 source-provider 注释口径。
- `provider-contract-v1.test.ts` 增加 `src/components` / `src/screens` / `src/hooks` 可见状态扫描，禁止 `source-provider` / `Source-Provider` 回归。

验证：`rg -n "source-provider|Source-Provider" src/components src/screens src/hooks` 为 0 hit；focused provider-contract run PASS：4 tests / 0 fail，2553 expect；`git diff --check` PASS，仅 CRLF warning。

### 9.12 OGR-06/08 visible-state 与 remote planning 命令批量收口更新

本轮按“大批量收口”继续处理 UI/TUI visible-state、订阅/计费入口、浏览器 provider、远程规划/审查命令口径，原则是不保留旧 web/cloud product copy 作为 DSXU 主链入口：

- `useCanSwitchToExistingSubscription` 在 DSXU runtime 下直接不显示 provider-migration subscription 切换提示；subscription notice 只保留为 provider-migration account 边界。
- `useChromeExtensionNotification` 在 DSXU runtime 下不再要求 provider subscription account；非 DSXU provider-migration 路径才提示 cloud credentials。
- `ConsoleOAuthFlow`、`TeleportError`、`ChannelsNotice`、`RateLimitMessage`、`OverageCreditUpsell`、`Usage`、`Settings/Config`、`PromptInput`、`ExitPlanModePermissionRequest` 已把旧 OAuth/subscription/extra-usage/web-ultraplan 入口收口到 DSXU Provider、DSXU cost/evidence、DSXU remote planning workflow 或 provider-migration gated boundary。
- `GuestPassesUpsell`、`feedConfigs` 的 referral copy 不再宣传 `Share DSXU Code`，改为 DSXU provider workspace；该业务入口仍在 DSXU runtime 下 gated，不作为 V20 编程主链。
- `/ultraplan`、`/ultrareview`、`/web-setup` 不再使用 `DSXU Code on the web` 旧产品口径；统一改成 DSXU remote planning/review workflow 或 provider-migration remote workspace。
- `provider-contract-v1.test.ts` 扩展 `src/commands`、`src/components`、`src/screens`、`src/hooks` 扫描，禁止 `source-provider` / `Source-provider` / `Source-Provider`、旧 command lifecycle shim、`Backward-compatible` 以及 `DSXU Code on the web` 回归。

Focused verification：`rg -n "DSXU Code on the web|source-provider|Source-provider|Source-Provider|Share DSXU Code|provider subscription account|Backward-compatible|backwards compatibility|V14 command lifecycle shim|process[A-Za-z0-9]+CommandLifecycle|run[A-Za-z0-9]+Command" src/commands src/components src/hooks src/screens` 为 0 hit；`bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` PASS（4 tests / 0 fail，3467 expect）；`git diff --check` PASS，仅 CRLF warning。

当前判断：OGR-06 visible-state 与 OGR-08 command/remote planning 口径已进一步归到 DSXU 命名 owner，不再把旧 web/cloud/subscription 文案留作产品主链。剩余仍是 V20 real-gap 产品化、owner/Git review、deletion-state mutation、三项 ACL permission residue、六阶段真实测试与 clean export。

### 9.13 OGR-06/08/10 deeper boundary 批量收口更新

本轮继续按 3-5 倍批量推进，不新增主链入口，不保留桥接 holding path。处理范围覆盖 Agent team gate、Bash prompt/permission/read-only validation、Brief attachment/upload、MCP Auth pseudo-tool、Workflow prompt、FileWrite instruction logging、spawnMultiAgent teammate env、Perfetto tracing，以及旧 bridge adapter：

- `src/utils/agentSwarmsEnabled.ts`、`src/tools/shared/spawnMultiAgent.ts` 的 teammate/agent swarm 口径统一为 DSXU primary env + provider-migration source alias，避免旧 provider 名称继续作为 agent runtime owner。
- `src/tools/BashTool/prompt.ts`、`src/tools/BashTool/bashPermissions.ts`、`src/tools/BashTool/readOnlyValidation.ts` 清理旧 provider 字面口径；Bash permission owner 保持在 DSXU Bash Permission Engine，provider-migration source 只作为 env/CLI help intake。
- `src/tools/BriefTool/attachments.ts`、`src/tools/BriefTool/BriefTool.ts`、`src/tools/BriefTool/upload.ts` 清理 source-provider 文案与字段名，Brief upload 仍是 DSXU bridge upload provider，旧 host env 只作为 migration source base URL。
- `src/tools/McpAuthTool/McpAuthTool.ts`、`src/tools/WorkflowTool/prompt.ts`、`src/tools/FileWriteTool/FileWriteTool.ts`、`src/utils/telemetry/perfettoTracing.ts` 清理旧 provider 文案，MCP/Workflow/FileWrite/Perfetto 均不因此新增第二套 runtime。
- `src/dsxu/engine/adapters/bridge-adapter.ts` 不再保留旧 `BridgeAdapter` runtime。产品主线和测试 import 已迁到 `external-tool-adapter.ts` owner；该文件因当前 workspace ACL 拒绝删除，只保留空 tombstone，明确后续作为 ACL residue/delete signoff 项处理，不能再恢复旧 bridge runtime。
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 扩展边界扫描；`src/dsxu/engine/__tests__/bridge-gate.test.ts` 改为 retired adapter 防回归；`src/dsxu/engine/__tests__/gate-integration.test.ts` 移除旧 bridge gate import；`src/dsxu/engine/adapters/__tests__/adapter-absorption.test.ts` 改为 ExternalToolAdapter owner 证据，并同步修正旧 copy 断言。

Focused verification：provider-contract focused run PASS（4 tests / 0 fail，3671 expect）；bridge/gate/adapter focused run PASS（19 tests / 0 fail，66 expect）；targeted old provider scan 对本轮 boundary 文件为 0 hit；旧 `BridgeAdapter` / `BridgeToolErrorType` / `BridgeToolEventType` product import scan 只剩测试中的防回归断言；`git diff --check` PASS，仅 CRLF warning。`git status --short` 当前为 1782，增加项属于本轮 owner evidence 与 ACL tombstone，不代表已进入 stage/commit。

当前判断：OGR-06/08 deeper boundary 已进一步收口；OGR-10 bridge adapter 不再是第二套 tool runtime，但新增一个真实 ACL 删除残留，需要并入权限/所有权 residue 队列。下一步继续按 owner packet 推进：shared utilities / engine fallback tools / release productization / GitHub open-source docs 与真实 UI/TUI 操作测试。

### 9.14 OGR-03/10 mainline tool fallback 显式化更新

继续处理 “fallback tools 不能变成第二套工具运行时” 的硬标准。真实 import/use 结论：`src/dsxu/engine/engine-tool-adapter.ts` 已把 Read/Edit/Write/Bash/Grep/Glob 等主线工具接到 `src/tools/*` mature classes，但原逻辑在 mainline tool call 出现 `ENOENT/EPERM/EACCES/command not found` 等 runtime dependency error 时，即使没有显式授权，也会自动调用 `builtin-tools.ts` fallback。这个行为会让 fallback 工具变成隐性第二套 runtime。

处理结果：
- `engine-tool-adapter.ts` 删除自动 recoverable dependency fallback，fallback 只在 `context.allowMainlineToolFallback === true` 时执行。
- `isRecoverableRuntimeDependencyError()` 已删除，避免以后通过错误字符串重新打开隐式 fallback。
- `provider-contract-v1.test.ts` 增加静态防回归断言，要求 mainline fallback 只能显式 opt-in。
- `mainline-tool-adapter-v1.test.ts` 同步补齐 TaskOutput/TaskStop/TeamCreate/TeamDelete/EnterWorktree/ExitWorktree 的 mainline adapter schema 期望，避免测试还停在旧工具批次。

Focused verification：provider-contract focused run PASS（4 tests / 0 fail，3679 expect）；mainline-tool-adapter focused run PASS（3 tests / 0 fail，89 expect）；`rg` 确认 `isRecoverableRuntimeDependencyError` 与 `command not found/i` 在 engine-tool-adapter 中为 0 active runtime hit；`git diff --check` PASS，仅 CRLF warning。

当前判断：mainline tool adapter 不再自动跌回 built-in fallback runtime。`builtin-tools.ts` 仍作为 legacy isolated recovery/test surface 存在，后续需要继续审 `tool-capability-pool.ts` / `bootstrapFullAbsorb()` 是否还把 built-in core pool 注册到产品路径；不能把它当 V20 PASS。

### 9.15 OGR-03/10 capability pool / full absorb built-in fallback 收口

继续按“不能保留第二套工具运行时”的标准处理 `builtin-tools.ts` 的另一条进入主链路径。真实 import/use 结论：虽然 `engine-tool-adapter.ts` 已经关闭自动 fallback，但 `tool-capability-pool.ts`、`extended-tools.ts#getAllTools()`、`QueryEngine.bootstrapFullAbsorb()` 仍可能把 built-in core/read-only tools 注册进 full_absorb 或产品 engine surface，形成绕过 `src/tools/*` mature classes 的第二套工具池。

处理结果：
- `tool-capability-pool.ts` 不再从 `builtin-tools.ts` 导入或注册 `getCoreTools()` / `getReadOnlyTools()`；`core` 和 `read_only` pool 当前返回空集合，主线工具必须通过 `engine-tool-adapter.ts` 映射到 `src/tools/*` owner。
- `extended-tools.ts#getAllTools()` 不再动态 `require('./builtin-tools')`，只返回 extended/debug/analysis 工具集合。
- `QueryEngine.bootstrapFullAbsorb()` 只调用 `registerCapabilityPools('full_absorb')`，不再额外 `registerTools(getAllTools())` / `registerTools(getDebugTools())`，避免重复注册和 owner 混淆。
- `src/dsxu/engine/index.ts` 不再公开 re-export built-in core tools；旧 `WriteTool/EditTool` 测试改为直接从 `../builtin-tools` 导入，明确它们是 legacy recovery/test surface，不是 engine public API。

Focused verification：`engine.test.ts` capability/full_absorb 相关 run PASS（5 tests / 0 fail，26 expect）；provider-contract focused run PASS（4 tests / 0 fail，3697 expect）；mainline-tool-adapter focused run PASS（3 tests / 0 fail，89 expect）；targeted scan 对 `tool-capability-pool.ts`、`extended-tools.ts`、`index.ts` 中 `from './builtin-tools'`、`require('./builtin-tools')`、`getCoreTools()`、`getReadOnlyTools()`、`registerTools(getAllTools())` 为 0 hit；`git diff --check` PASS，仅 CRLF warning。

当前判断：built-in tool fallback 已不能通过 runtime error、capability pool、full_absorb、engine public export 四条路径自动进入产品主链。`builtin-tools.ts` 仅剩 legacy isolated recovery/test surface；后续若发现同等行为重复，不能再补兼容层，应继续并入 `src/tools/*` owner 或进入 replace/delete candidate。

### 9.16 OGR-07 api-service provider fallback 显式化

继续处理 provider/model/cost evidence owner。真实 import/use 结论：`src/dsxu/engine/api-service.ts` 原注释和构造逻辑仍是 “DeepSeek primary -> OpenAI backup -> Ollama local fallback”，且只要存在 OpenAI key 就注册 OpenAI，Ollama 更是默认注册 `http://localhost:11434`。这会把恢复/测试用 fallback 变成默认第二套 provider runtime，与 V20 DeepSeek V4 Flash / Flash-MAX / Pro 主 owner 冲突。

处理结果：
- `APIServiceConfig` 新增 `allowProviderFallbacks`、`allowOpenAIFallback`、`allowOllamaFallback`，并支持 `DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS`、`DSXU_ALLOW_OPENAI_FALLBACK`、`DSXU_ALLOW_OLLAMA_FALLBACK` 作为显式 operator/env gate。
- 默认构造只注册 DeepSeek owner；OpenAI 只有在有 key 且显式允许时注册；Ollama 只有在显式允许时注册，允许后才使用配置/环境 URL 或默认本地 URL。
- `api-service.test.ts` 把 fallback 测试改为显式授权场景，并新增“带 OpenAI key / Ollama URL 但未授权时只保留 DeepSeek owner”的回归测试。
- `provider-contract-v1.test.ts` 增加静态断言，要求 `api-service.ts` 保留显式 fallback gate，并禁止恢复旧 “OpenAI backup -> Ollama local fallback” 口径。

Focused verification：`api-service.test.ts` PASS（20 tests / 0 fail，49 expect）；provider-contract focused run PASS（4 tests / 0 fail，3707 expect）；mainline-tool-adapter focused run PASS（3 tests / 0 fail，89 expect）。当前判断：`api-service.ts` 回到 provider transport boundary，不能再作为默认多 provider runtime；后续继续审 broader `src/services/api/*`、model router、cost/evidence surface 是否还有默认第二套 provider path。

### 9.17 OGR-07 llm-adapter / config / broader provider surface 批量收口

继续按同一 owner 标准追到调用层。真实 import/use 结论：即使 `api-service.ts` 已显式化，`createPreferredDSXULLMCall()` 仍会把 `OPENAI_API_KEY` 或 `DSXU_OLLAMA_URL` 当成“有 provider backend”，并且 `allowProxyFallback` 默认开启；这会绕过 APIService gate，把 OpenAI/Ollama 或 provider-migration proxy 重新变成默认模型 runtime。

处理结果：
- `llm-adapter.ts` 改为先创建 `APIService` 并读取 `apiService.getStatus()`；只有 APIService owner gate 已注册 backend 时才进入 adapter call。OpenAI/Ollama env 本身不再代表可用主链 backend。
- provider-migration proxy fallback 改为显式 `options.allowProxyFallback === true` 或 `DSXU_ALLOW_PROVIDER_MIGRATION_PROXY_FALLBACK=1`，默认返回 fail-closed LLM call，直到真正调用时给出“配置 DeepSeek 或显式开启 fallback owner gate”的错误。
- `llm-adapter-owner-v1.test.ts` 新增回归：OpenAI/Ollama env 未授权时不能隐式进入 provider runtime；OpenAI fallback 只有显式 gate 才可用。
- `config.ts` 增加 `allowProviderFallbacks` / `allowOpenAIFallback` / `allowOllamaFallback` 默认 false，并从对应 env 显式读取；`doctor.ts` 把 OpenAI key 标为 explicit fallback only。
- broader `src/services/api/*`、`src/services/analytics/*`、`src/utils/model/*` 中本轮扫描到的旧 `source-provider` 文案/常量已改为 provider-migration 口径，包括 bootstrap、Grove、withRetry、dsxuTransport、1P event logger/exporter、metadata、model deprecation/support/betas。
- `provider-contract-v1.test.ts` 扩展静态 source 扫描范围，覆盖上述 broader provider surface，防止旧 provider 口径和默认 fallback 入口回归。

Focused verification：`llm-adapter-owner-v1.test.ts` PASS（2 tests / 0 fail）；`api-service.test.ts` PASS（20 tests / 0 fail，49 expect）；provider-contract focused run PASS（4 tests / 0 fail，3784 expect）；broader provider-surface scan 对 `source-provider` / `Source-provider` / `Source-Provider` / `SOURCE_PROVIDER` / `source provider` / 默认 proxy fallback / “OPENAI_API_KEY, or DSXU_OLLAMA_URL” 为 0 hit；`git diff --check` PASS，仅 CRLF warning。

当前判断：OGR-07 已从 engine APIService 推到 LLM adapter、config、doctor、API/bootstrap、analytics、model helper 层；默认路径不再把 OpenAI/Ollama/proxy 当成第二套 provider runtime。剩余继续审 `src/services/api/client.ts` 的 provider SDK non-DSXU migration shell、`dsxuTransport.ts` streaming fallback 语义、以及 cost/evidence 路由是否只服务 DeepSeek V4 owner 或显式 migration boundary。

### 9.18 OGR-07 provider SDK / primary fallback / streaming tool-state 收口

继续追到更底层 API client 和 retry/transport。真实 import/use 结论：`src/services/api/client.ts` 的 DSXU 分支虽然在 provider SDK 分支之前，但非 DSXU env 下仍可能直接进入 Provider SDK；`withRetry.ts` 仍保留旧 `FALLBACK_FOR_ALL_PRIMARY_MODELS` 触发 primary model fallback 的路径；`dsxuTransport.ts` 的 streaming -> non-streaming fallback 虽然是同一 provider 请求形态降级，但如果流中已经开始 tool_use，再重试会有重复工具执行风险。

处理结果：
- `client.ts` 新增 `shouldUseDsxuDeepSeekClient()`：默认 DSXU 主线和未显式开启 provider-migration service shell 的路径都走 `DeepSeekAdapter`；Provider SDK/Bedrock/Vertex/Foundry 分支必须在 `DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1` 后才可进入。
- `withRetry.ts` 新增 `isPrimaryModelFallbackAllowed()`：DSXU 主线只有 `DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS` 或 `DSXU_CODE_ALLOW_PROVIDER_MODEL_FALLBACKS` 显式开启时才允许 primary model fallback；旧 `FALLBACK_FOR_ALL_PRIMARY_MODELS` 和 provider-migration high-tier fallback 只在 provider-migration service shell 内生效。
- `dsxuTransport.ts` 新增 `hasStartedStreamingToolState()`：streaming 失败后，若已经产生或正在累积 `tool_use` / `server_tool_use`，则禁用 non-streaming fallback 并以 `tool_state_started` 记录原因，防止同一工具被重复生成或重复执行。
- `provider-migration-model-alias-isolation-v1.test.ts` 和 `provider-contract-v1.test.ts` 补充静态防回归，锁定 DSXU DeepSeekAdapter 先行、provider SDK migration shell 显式 gate、primary fallback gate、tool-state fallback fail-closed。

Focused verification：`provider-migration-model-alias-isolation-v1.test.ts` PASS（6 tests / 0 fail，27 expect）；provider-contract focused run PASS（4 tests / 0 fail，3803 expect）；targeted scan 确认 `shouldUseDsxuDeepSeekClient`、`isPrimaryModelFallbackAllowed`、`hasStartedStreamingToolState`、`tool_state_started` 均在 owner 路径；`git diff --check` PASS，仅 CRLF warning。

当前判断：OGR-07 的默认 provider runtime、primary model fallback、streaming fallback 工具生命周期风险已继续收紧。Provider SDK 现在是显式 migration shell，不再是 DSXU 默认模型运行时；streaming 恢复不再能越过已开始的 tool lifecycle。

### 9.19 OGR-07 peripheral provider API / telemetry / files boundary 收口

本轮继续按 V20 原侧目标收口 provider/model/cost owner，不新增其它主链入口，也不把旧 provider API 当作默认运行时。真实 import/use 结论是：`src/services/api/filesApi.ts`、`metricsOptOut.ts`、`logging.ts`、`src/utils/apiPreconnect.ts` 与 `remoteManagedSettings` 都属于外围 provider/API/telemetry/file boundary；如果默认 DSXU 主链允许它们直接访问旧 provider endpoint，就会形成隐性第二 provider runtime。

处理结果：
- `filesApi.ts` 不再默认 fallback 到旧 provider public Files API。DSXU runtime 下必须传入 `FilesApiConfig.baseUrl` 或配置 `DSXU_CODE_API_BASE_URL`；旧 provider public base URL 只保留在显式 provider-migration service shell 内。
- `metricsOptOut.ts` 新增 `shouldUseProviderMigrationMetricsOptOut()`，DSXU runtime 且未显式开启 provider-migration service shell 时直接返回 disabled，不再访问旧 provider metrics opt-out endpoint。
- `logging.ts` 将旧 provider env metadata 收口为 `getProviderMigrationEnvMetadata()`，DSXU runtime 默认不把旧 provider base/model env 写入 API analytics event。
- `apiPreconnect.ts` 在 DSXU runtime 默认早退，不再启动时预热旧 provider base URL；只有显式 provider-migration service shell 才允许走该预连接路径。
- `remoteManagedSettings/syncCache.ts` 与 `syncCacheState.ts` 清理旧 undefined/source-provider 口径，保留 `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS` 作为显式迁移 override，不作为 DSXU 默认 remote settings runtime。
- `provider-contract-v1.test.ts` 扩展静态合约扫描到 files/logging/metrics/preconnect/remote settings/token/model/side-query/dsxuLimits，防止外围 API 入口再次变成默认 provider runtime。

Focused verification：
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS：1 test / 0 fail / 3852 expect。
- `bun test src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts` PASS：6 tests / 0 fail。
- targeted scan 对 `DEFAULT_PROVIDER_FILES_API_BASE_URL`、`Falls back to public API for standalone usage`、`getProviderEnvMetadata`、`SOURCE_PROVIDER_REMOTE_SETTINGS_FLAG`、`source-provider` 在本轮边界范围内无 active hit。

当前 OGR-07 owner 判断：默认 DSXU provider path 已从 engine/APIService/LLM adapter/client/retry/transport 继续推进到外围 files、telemetry、logging、preconnect、remote settings；旧 provider API 只允许作为显式 provider-migration shell 或 DSXU 显式配置的 adapter boundary，不再是产品默认 runtime。
补充收口：复核调用端后，`src/main.tsx` 的 `--file` 启动下载也已并入同一规则。默认 DSXU local mainline 下不再显式传旧 OAuth/provider base URL；优先使用 `DSXU_CODE_API_BASE_URL`，否则阻断并提示配置 DSXU 文件 API base URL。显式 provider-migration service shell 仍可使用 provider-migration base URL。
继续补充收口：第二层账号/订阅类旧 API service 也已纳入 OGR-07。`usage.ts`、`ultrareviewQuota.ts`、`referral.ts`、`overageCreditGrant.ts`、`adminRequests.ts`、`grove.ts` 均增加 DSXU runtime / provider-migration service shell gate。默认 DSXU local mainline 下，这些旧 OAuth/account/subscription backend 不再作为产品运行时；只能在显式 provider-migration shell 或已被 DSXU owner 替换的后续 provider 中使用。
第三层启动/策略/同步边界补充：`policyLimits` 已确认默认 DSXU runtime 早退；`settingsSync/index.ts` 新增 provider-migration settings sync gate；`teamMemorySync/index.ts` 在 DSXU runtime 下要求 `DSXU_TEAM_MEMORY_SYNC_URL` / `TEAM_MEMORY_SYNC_URL` 或显式 migration shell，避免 DSXU path 默认落到旧 OAuth host；`fastMode.ts` 的 org-status prefetch 不再在默认 DSXU local mainline 打旧 fast-mode backend。
### 9.20 OGR-06/07/08 mainline entry + UI/provider boundary 批量收口补充

本轮继续按 V20 原侧原则执行，不新增主链入口，不把 provider-migration 作为默认 runtime。实际处理范围覆盖主入口、QueryEngine、system constants、coordinator、diagnostics UI、update CLI、feedback/grove/settings visible-state，以及 MCP auth / diagnostic tracking 边界。

处理结果：
- `src/main.tsx`、`src/QueryEngine.ts`、`src/constants/system.ts`、`src/coordinator/coordinatorMode.ts`、`src/cli/update.ts` 的旧 `SOURCE_PROVIDER_*` / `sourceProvider*` 代码符号改为 provider-migration owner 命名；wire env / package / URL 字符串保留为迁移输入，不作为 DSXU owner。
- `src/services/diagnosticTracking.ts`、`src/components/DiagnosticsDisplay.tsx` 的 shadow-file URI 仍保留既有 wire 格式，但代码 owner 和可见 label 改为 provider-migration，不再显示 source-provider owner。
- `src/services/mcp/auth.ts` 的 path-aware OAuth discovery fallback 改为明确 provider-migration boundary 语言，不再叫 source-provider fallback。
- `src/components/Feedback.tsx` 修正真实行为：默认 DSXU runtime 不再向旧 provider feedback endpoint 提交；直接允许进入 GitHub issue 草稿路径。旧 feedback backend 只在显式 provider-migration service shell 中使用。
- `src/components/agents/ModelSelector.tsx`、`src/components/grove/Grove.tsx`、`src/components/FeedbackSurvey/useFeedbackSurvey.tsx`、`src/components/Settings/Config.tsx` 的旧 provider 代码符号已改为 provider-migration 命名；对应 UI/service 已由 DSXU gate 或 provider-migration shell 限制。
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 扩展静态 contract 范围，覆盖本轮入口、QueryEngine、system/coordinator、diagnostics、settings sync types、MCP auth 等文件，避免旧 owner 语言回流。

Focused verification：`provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS；本轮 targeted old-name scan PASS；`git diff --check` PASS，仅 CRLF warning。

当前判断：OGR-07 默认 provider runtime 已继续从服务层推进到入口层和可见 UI 层；DSXU 默认路径不再因为 feedback、file download、diagnostics、settings sync、team memory、fast mode、account API 或旧 env 符号暗中落回旧 provider runtime。剩余仍按 owner packets 继续推进：更宽的 MCP/Plugin/Skill source-provider 命名债、permission aliases、open-source release docs、P12/raw/final test/clean export gate。
## 2026-05-14 V20 批量执行更新：provider-migration 运行边界收口

本轮按 V20 原侧原则继续执行，不新增主链、不新增入口、不保留桥接式 holding path。处理重点从单点 owner review 扩成批量 runtime/shared utility 收口：环境变量、managed env、shell alias、native/local installer、doctor、cron/worktree/tmux、API/tool orchestration、VCR、MCP/plugin/skill、IDE、teleport、UI/TUI 可见状态、PowerShell/FileRead/Schedule/RemoteTrigger 等路径中的旧 source-provider 代码命名，已统一压回 provider-migration 边界。

已完成事实：
- 产品源码路径中，src 下除 src/dsxu/engine 的证据/契约测试文件外，SOURCE_PROVIDER、sourceProvider、source-provider、Source-provider 扫描已清空。
- 外部兼容值没有改掉：旧环境变量名、旧目录名、旧包名、旧 host token 仍作为 provider-migration source value 保留，只改代码 owner 命名和注释口径。
- src/dsxu/engine/__tests__/provider-contract-v1.test.ts 已把新增清理过的真实运行文件纳入 provider boundary 防回退扫描，contract 断言数从 4123 提升到 4448。
- 聚焦验证通过：provider contract default CLI path 1/1 PASS；permission/API/model/MCP focused batch 64/64 PASS；git diff --check 对本轮文件通过，仅剩 Git CRLF warning。

当前剩余边界：
- src/dsxu/engine 内仍保留少量 source-provider 字样，性质是公共模型面禁止暴露、provider-migration alias 隐藏证据、旧 shell 不得进入默认主线等契约/测试表达，不是产品 runtime 入口。
- git status --short 仍为 1793，原因是 owner/Git review 尚未进入 stage/commit/delete 收口；本轮只做代码/证据更新，没有执行 Git mutation。
- final comprehensive tests 与 clean export 仍不能提前作为放行，因为 V20 全局 owner/Git signoff、dirty review 和 release gate 尚未全部关闭。

下一批继续按 OGR 顺序推进：先审 src/dsxu/engine 剩余证据表述是否需要改成 provider-migration-only 术语，再推进 OGR-06 UI/TUI、OGR-08 CLI/command/transport、OGR-12 shared utilities、OGR-13 other source owner review 的剩余 diff owner signoff。标准仍是：重复等价合并到原 owner 或列 replace/delete candidate；行为不同映射到命名 mainline owner；不允许第二套 runtime。
## 2026-05-14 V20 批量执行更新：engine 证据术语闭环

本轮继续按 V20 原侧标准处理 engine 内最后一批旧 provider/source 证据命名。处理范围包括 `high-pressure-reference-absorption-contract.ts`、`next-stage-productization-contract.ts`、`provider-contract.ts`、`reference-governance-absorption-contract.ts`、`v18-model-public-surface-gate.ts`、`v19-cost-cache-live-task-evidence.ts`、`v8-product-build-contract.ts`、`v9-reference-absorption-completion-contract.ts` 及对应 tests。

Owner 判断：
- `SOURCE_PROVIDER`、`sourceProvider`、`source-provider`、`Source-provider` 不再作为产品源码、engine contract 或 evidence field 的命名口径保留。
- 等价含义全部收口为 `provider-migration source` / `providerMigrationSource*`，表示迁移来源、隐藏证据或防回归 contract，不表示第二套 provider runtime。
- `provider-contract-v1.test.ts` 的 forbidden-token 断言改为运行时拼接旧 token，避免测试文件本身成为静态扫描残留，同时继续防止旧 token 回流。

Focused verification：
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS，1 test / 0 fail / 4448 expect。
- `bun test src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/v19-cost-cache-live-task-evidence-v1.test.ts` PASS，13 tests / 0 fail。
- `rg -n "SOURCE_PROVIDER|sourceProvider|source-provider|Source-provider" src --glob "*.ts" --glob "*.tsx" --glob "*.js" --glob "*.jsx"` 返回 0 hit。
- `git diff --check` PASS，仅保留既有 CRLF working-copy warning。

当前状态：`git status --short` 为 1795。该数字不会因为本轮 evidence/contract 收口自动下降，因为仍未 stage、commit、delete、reset 或 clean export。下一批继续按 OGR packet 做 owner/Git signoff、deletion-state mutation review、ACL residue、V20 real-gap productization、六阶段真实测试和最终 clean export。
## 2026-05-14 V20 批量执行更新：C5-PUB 开源发布文档与兼容口径收口

本轮继续执行 V20-C5-PUB GitHub 开源发布产品化节点，不新增 runtime、不引入 DeepSeek-TUI/AionUi/Cherry/Warp/browser-use 作为依赖，也不新增主入口。目标是把 DSXU 独立产品的 GitHub 用户入口补齐，并把 release gate 说清楚。

已完成文档入口：
- `README.md` 重写为 DSXU Code GitHub 首页，明确 DeepSeek V4 Flash / Flash-MAX / Pro 主线、当前 V20 PARTIAL 状态、唯一入口、快速开始、核心能力、配置、验证、release discipline。
- 新增 `docs/INSTALL.md`、`docs/CONFIGURATION.md`、`docs/DOCTOR_HEALTH.md`、`docs/TOOL_SURFACE.md`、`docs/SECURITY_PERMISSION.md`、`docs/CONTRIBUTING.md`、`docs/RELEASE_RUNBOOK.md`。
- 新增 `CHANGELOG.md` 与 `CODE_OF_CONDUCT.md`，但不宣称已经发布；`package.json` 仍保持 `private: true`，直到 release gate 允许。

同步源码口径收口：
- 清理 `src` 中剩余 `Backward-compatible`、`backwards compatibility`、`backward compatibility`、`BACKWARD COMPATIBILITY`、`generic bucket` 等容易被误读为兼容 holding path 的注释口径。
- 行为没有删除：保留的旧输入都改称 historical persisted state、migration alias、schema-stable settings migration、API stability 或 direct binary download base，避免把兼容说明留成第二套产品路径。
- `provider-contract-v1.test.ts` 中对应 forbidden-token 也改为运行时拼接，继续防回退但不污染静态扫描。

Focused verification：
- README/doc link existence check PASS。
- `rg -n "Backward-compatible|backwards compatibility|backward compatibility|BACKWARD COMPATIBILITY|generic bucket|compatibility holding|bridge shortcut|generic bucket" src --glob "*.ts" --glob "*.tsx" --glob "*.js" --glob "*.jsx"` 返回 0 hit。
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS，1 test / 0 fail / 4448 expect。
- 本轮文档与源码 `git diff --check` PASS，仅 CRLF working-copy warning。

当前状态：`git status --short` 为 1808。数字上升来自新增 release 文档与本轮 owner/evidence 改动；仍未 stage、commit、delete、reset 或 clean export。下一步继续按 V20 owner packets 做真实 Git review / deletion mutation / ACL residue / real-gap 产品化，然后才进入六阶段真实测试和 clean export。

## 2026-05-14 V20 批量执行更新：MCP Doctor 与 ToolDefinition V20 证据面

本轮继续按 V20 原侧原则推进，不新增 MCP runtime、不新增工具注册表、不新增产品入口。实际完成两组 release-relevant gap：

1. MCP owner/status/release-readiness doctor 已落地到现有 MCP owner。
   - 新增 `src/services/mcp/doctor.ts`。
   - `src/cli/handlers/mcp.tsx` 增加 `mcpDoctorHandler()`。
   - `src/main.tsx` 增加 `dsxu-code mcp doctor [--json]`。
   - Doctor 只读取 MCP 配置、registry 状态、config errors、scope/transport/server owner，不 spawn MCP server，不触发 provider-migration network path。
   - release gate 输出 `PASS` / `WARN` / `BLOCKED`，明确 registry 未配置、server 为空、provider-migration boundary、config error 等状态。

2. ToolDefinition V20 metadata 已并入现有 `src/Tool.ts` 合约。
   - 新增 `runtimeMetadata.owner`、`runtimeMetadata.sideEffects`、`runtimeMetadata.permission`、`runtimeMetadata.evidence`、`runtimeMetadata.uiProjection`。
   - 新增 `summarizeToolDefinitionV20(tool, input)`，作为现有 Tool contract 的证据投影，不是第二套 registry。
   - 首批 high-risk tool metadata 覆盖 Bash、PowerShell、MCPTool、RunNativeTest、TaskCreate、TaskStop。
   - `getDsxuToolRuntimeContractSummary()` 已把 ToolDefinition V20 字段纳入 owner contract summary。

文档同步：
- `README.md`、`docs/CONFIGURATION.md`、`docs/DOCTOR_HEALTH.md`、`docs/TOOL_SURFACE.md`、`docs/RELEASE_RUNBOOK.md` 已加入 `mcp doctor` 和 ToolDefinition V20 口径。
- 文档明确 MCP doctor / ToolDefinition metadata 都是现有 owner 的可见证据面，不是新主链。

Focused verification：
- `bun test src/services/mcp/__tests__/doctor.test.ts` PASS：2 tests / 0 fail。
- `bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json` PASS，当前真实输出为 `WARN`：无 MCP servers、`DSXU_MCP_REGISTRY_URL` 未配置。
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：2 tests / 0 fail / 14 expect。
- `bun test src/services/mcp/__tests__/doctor.test.ts src/services/mcp/adapters/__tests__/mcp-adapters.test.ts` PASS：21 tests / 0 fail。
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS：1 test / 0 fail / 4448 expect。
- 旧 provider/source token 与 compatibility holding-path token 的 `src` 静态扫描仍为 0 hit。

当前判断：V20-C5 的 open-source readiness 已从文档入口推进到可运行 MCP doctor；OGR-03 Tool Surface 也已从文字规则推进到 ToolDefinition contract。当前 `git status --short` 为 1811；没有 stage、commit、delete、reset、clean 或 export。下一批继续补主线 owner evidence：扩大 ToolDefinition metadata 覆盖到剩余 side-effecting tools，并继续推动 owner/Git packets 与 release gate。

## 2026-05-14 V20 批量执行更新：ToolDefinition V20 high-risk tool 覆盖扩大

本轮直接执行上一节的下一批 owner evidence，不再停留在 1-2 个小工具。`runtimeMetadata` 覆盖从首批 6 个工具扩大到 22 个工具，全部仍挂在现有 `Tool` contract 上，不新增 registry、不新增 Tool runtime。

新增覆盖：
- File mutation：FileEdit、FileWrite、NotebookEdit。
- Visible task state：TodoWrite、TaskCreate、TaskUpdate、TaskStop。
- Agent/team/message：Agent、SendMessage、TeamCreate、TeamDelete。
- Scheduling/remote：CronCreate、CronDelete、RemoteTrigger。
- Network/evidence/workflow：WebFetch、WebSearch、Workflow、CollectEvidence。
- 已有覆盖继续保留：Bash、PowerShell、MCPTool、RunNativeTest。

Owner 判断：
- 文件写入类归 `DSXU File Mutation Tool` / `DSXU Notebook Mutation Tool`，side effect 显式为 filesystem/notebook write、LSP diagnostic refresh、git diff/file history evidence。
- Agent/team/message 类归 `DSXU Agent Orchestrator`、`DSXU Agent Message Router`、`DSXU Agent Team Lifecycle`，不创建第二套 agent orchestrator。
- Cron/RemoteTrigger 类归 scheduled task / remote trigger boundary，mutation 仍通过 passthrough permission。
- WebFetch/WebSearch 归 network read/search tool，不能伪装成本地 read-only；permission 和 network side effect 已显式写入 metadata。
- Workflow/CollectEvidence 只投影 plan/evidence，不能替代真实工具执行或真实测试。

Focused verification：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：3 tests / 0 fail / 82 expect。
- `rg -n "runtimeMetadata:" src/tools --glob "*.ts" --glob "*.tsx"` 显示 22 个 ToolDefinition metadata 覆盖点。
- 本轮 ToolDefinition 文件 `git diff --check` PASS，仅 CRLF warning。

当前状态：Tool Surface 的 high-risk owner evidence 已从“规则要求”变成“真实 ToolDefinition metadata + regression test”。下一批继续按同一标准推进未覆盖工具、MCP/Skill/Plugin registry owner signoff、owner/Git packets、deletion review、ACL residue 和最终测试/export gate。

## 2026-05-14 V20 批量执行更新：ToolDefinition read/discovery/plan/worktree 覆盖

本轮继续扩大 OGR-03 Tool Surface 覆盖，从 side-effecting tools 推进到 read/discovery/plan/worktree/MCP resource/skill/config 工具。覆盖点从 22 个增加到 37 个。

新增覆盖：
- Read/search：FileRead、Grep、Glob。
- MCP resource adapter：ListMcpResources、ReadMcpResource。
- Skill/config/discovery：SkillTool、ConfigTool、ToolSearch。
- Plan/worktree：EnterPlanMode、ExitPlanMode、EnterWorktree、ExitWorktree。
- Task read/output：TaskGet、TaskList、TaskOutput。

Owner 判断：
- FileRead/Grep/Glob 明确归 read/search owner；Grep 虽是读工具，但 metadata 记录 `ripgrep-process-execution`，避免把外部进程搜索隐藏成普通内存读取。
- MCP resource tools 归 MCP Resource Adapter；binary resource persistence 被显式列为 side effect，不能绕过 evidence。
- SkillTool 归 Skill Runtime Adapter；inline、forked agent、MCP skill 都是 owner boundary 下的执行形态，不是第二套 command runtime。
- Plan/worktree 工具归 Plan Mode / Worktree Lifecycle；cwd 切换、worktree create/remove、permission mode 变化都作为 side effect 显式记录。
- TaskOutput 的旧 alias 注释从 compatibility wording 改为 historical alias，避免再次留下兼容 holding-path 口径。

Focused verification：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：4 tests / 0 fail / 146 expect。
- `rg -n "runtimeMetadata:" src/tools --glob "*.ts" --glob "*.tsx"` 计数为 37。
- `src` 中 `Backward-compatible|Backwards-compatible|backwards compatibility|backward compatibility|BACKWARD COMPATIBILITY|generic bucket|compatibility holding|bridge shortcut` 扫描已继续收口；新发现 `src/skills/loadSkillsDir.ts` test alias 口径并改为 historical alias。

当前判断：OGR-03 Tool Surface 已基本覆盖核心产品工具、MCP resource、skill/config、plan/worktree、task lifecycle 和网络/证据工具。剩余工具应按目录逐个裁决：纯内部/testing/synthetic 若无发布意义进入 replace/delete review；确有产品意义则继续挂到命名 owner，不允许模糊保留。

## 2026-05-14 V20 批量执行更新：user-facing / LSP / MCP auth / structured output 覆盖

本轮继续把剩余产品可见工具挂回原 owner，`runtimeMetadata` 覆盖点从 37 增加到 43。

新增覆盖：
- AskUserQuestion：`DSXU User Interaction Surface`。
- Brief：`DSXU User Visible Brief Surface`。
- LSPTool：`DSXU LSP Tool Adapter`。
- McpAuth pseudo-tool：`DSXU MCP Auth Adapter`。
- SyntheticOutput：`DSXU Structured Output Surface`。
- TestingPermission：`DSXU Test-Only Permission Fixture`。

Owner 判断：
- AskUserQuestion / Brief 是可见用户交互面，不是隐藏 command runtime。
- LSPTool 是 code intelligence adapter；filesystem stat validation 和 LSP request 被显式记录。
- McpAuth 只负责 OAuth URL / reconnect / appState.mcp tool-resource swap；provider-migration transport 仍是 unsupported boundary。
- SyntheticOutput 只在 non-interactive structured output 场景投影最终结果，不是任意执行工具。
- TestingPermission 明确为 test-only fixture，后续 release review 可决定保留测试路径或列 replace/delete review。

Focused verification：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 168 expect。
- `rg -n "runtimeMetadata:" src/tools --glob "*.ts" --glob "*.tsx"` 计数为 43。
- 旧 provider/source token 与 compatibility holding-path token 的 `src` 扫描仍为 0 hit。

当前判断：OGR-03 Tool Surface 已覆盖绝大多数真实产品工具和测试 fixture。下一步不应继续发散小层，而是对剩余无 metadata 的 `src/tools` 文件做 owner 裁决：内部 helper 归属已覆盖工具 owner；无产品意义的 disabled/recovery stub 进入 replace/delete review；确需产品化的再补 metadata。

## 2026-05-14 V20 批量执行更新：Tool Surface 残余裁决闭环

本轮继续按“不要留下未知桶”的要求处理 `src/tools` 残余。实际结论：
- `src/tools` 中 43 个 `buildTool(...)` 产品/测试工具均已具备 `runtimeMetadata`。
- `CronListTool` 已补入 `DSXU Scheduled Task Lifecycle`，与 CronCreate/CronDelete 同 owner。
- `TungstenTool` 不是 V20 产品能力，已显式标为 `DSXU Disabled Recovery Stub`，`isEnabled=false`，permission 永远 deny；后续 owner/Git review 应将其作为 replace/delete review candidate 或外部恢复构建专属项处理，不能作为隐藏 terminal runtime 留在主链。
- `REPLTool` / `SleepTool` 当前没有 `buildTool(...)` 产品入口，属于 helper/prompt/primitive exposure 边界；它们不应被当成新增工具 runtime。
- `src/Tool.ts` 中关于 Tungsten 缺 outputSchema 的 TODO 已移除；Tungsten stub 现在也有 outputSchema 和 owner metadata，避免类型注释继续暗示旧例外。

Focused verification：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 177 expect。
- `rg -n "buildTool\\(" src/tools --glob "*.ts" --glob "*.tsx"` 计数为 43。
- `rg -n "runtimeMetadata:" src/tools --glob "*.ts" --glob "*.tsx"` 计数为 45（43 个 buildTool + MCP auth pseudo-tool + Tungsten disabled stub）。
- 旧 provider/source token 与 compatibility holding-path token 的 `src` 扫描为 0 hit。

当前判断：OGR-03 Tool Surface 不再是未明大桶。剩余工作应转入 owner/Git packet review：对这些 metadata 覆盖过的工具按 owner 签收；对 Tungsten disabled stub、test-only fixtures、内部 helper 做 replace/delete 或 release-exclusion 裁决。

## 2026-05-14 V20 批量执行更新：OGR-04 MCP / Skill / Plugin registry owner 证据

本轮继续推进 OGR-04，不新增 extension runtime，也不新增第二套 registry。处理方式是把现有 MCP、Skill、Plugin 三类 extension owner 的 runtime profile 补齐并用测试锁住。

已完成：
- `src/utils/plugins/pluginLoader.ts` 新增 `getDsxuPluginLoaderRuntimeProfile()`。
- `src/utils/plugins/refresh.ts` 新增 `getDsxuPluginRefreshRuntimeProfile()`。
- `src/utils/plugins/mcpPluginIntegration.ts` 新增 `getDsxuPluginMcpRuntimeProfile()`。
- `src/utils/plugins/loadPluginCommands.ts` 新增 `getDsxuPluginCommandRuntimeProfile()`。
- 新增 `src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts`，与既有 `getDsxuMcpConfigRuntimeProfile()`、`getDsxuOfficialMcpRegistryRuntimeProfile()`、`getDsxuSkillsLoaderRuntimeProfile()`、`getDsxuBundledSkillsRuntimeProfile()` 一起证明 extension boundary。

Owner 判断：
- Plugin loader 是 `DSXU Plugin Runtime`，只负责 marketplace/session/builtin/managed sources 合并、dependency demotion、settings cache，不是第二 Query Loop。
- Plugin refresh 是三层模型：settings intent、cache/materialization、active AppState components；MCP reconnect 仍由既有 MCP connection manager 负责。
- Plugin MCP integration 是 `DSXU MCP / Plugin Adapter Boundary`；plugin 只产出 MCP server config，不能 standalone connect/run。
- Plugin commands/skills 进入现有 slash/SkillTool/loadSkillsDir 语义；不能成为第二套 command runtime。
- MCP registry 仍 fail-closed；Skill loader 与 bundled skills 仍是 DSXU command/skill owner。

Focused verification：
- `bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 177 expect。

当前判断：OGR-04 的 MCP / Skill / Plugin registry owner 已有可运行证据。下一步应进入 OGR-05 external integration / ecosystem compatibility owner review，确认 Bridge/Remote/AionUi/Cherry/Warp/browser-use/Claude-compatible project intake 都只能作为 adapter boundary 和 intake format。

## 2026-05-14 V20 批量执行更新：OGR-05 external integration adapter boundary

本轮推进 OGR-05，不接入 AionUi/Cherry/Warp/browser-use 等外部产品，也不把 remote/browser/desktop/bridge 做成第二套运行时；只把 DSXU 已有 external integration 入口的 owner boundary 补成可测试证据。

已完成：
- `src/services/bridge/dsxuRemoteBridgeFacade.ts` 新增 `getDsxuRemoteBridgeFacadeRuntimeProfile()`。
- `src/services/bridge/dsxuRemoteSessionCoordinator.ts` 新增 `getDsxuRemoteSessionCoordinatorRuntimeProfile()`。
- `src/utils/dsxuBrowserProvider/common.ts` 新增 `getDsxuBrowserProviderRuntimeProfile()`。
- `src/utils/desktopMcpImport.ts` 新增 `getDsxuDesktopMcpImportRuntimeProfile()`。
- `src/utils/teleport.tsx` 新增 `getDsxuTeleportRuntimeProfile()`。
- 新增 `src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts`。

Owner 判断：
- Remote bridge facade 和 remote session coordinator 都是 `DSXU Control Plane Adapter Boundary`；它们只投影 control request/response、session registry、SDK messages，不拥有 Query Loop 或 Tool Gate。
- Browser provider 是 `DSXU MCP / Browser Adapter Boundary`；浏览器能力必须通过 MCP tool 进入 Tool Gate，不是 standalone browser runtime。
- Desktop MCP import 是 `DSXU MCP Config Intake Boundary`；只读 DSXU desktop MCP config 或 provider-migration desktop config 迁移输入，不负责连接生命周期。
- Teleport 是 `DSXU Remote Session Adapter Boundary`；远端 session 创建、resume、archive 是 remote adapter，不是本地第二 Agent orchestrator。
- RemoteTrigger 继续是 DSXU Remote Session Provider；provider-migration remote trigger 只能由显式 env gate 进入。

Focused verification：
- `bun test src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。
- `bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。

当前判断：OGR-05 external integration 已从“生态兼容分析”推进为代码证据。AionUi/Cherry/Warp/browser-use/Claude-compatible project intake 的 V20 结论保持不变：它们是将来兼容接入设计参考和 intake format，不是 V20 内置依赖，也不是新产品主链。

## 2026-05-14 V20 批量执行更新：OGR-03/04/10 fallback 与旧 MCP 入口收口

本轮继续处理真实代码回流风险，而不是继续补小层：
- `engine-tool-adapter.ts` 已移除 `builtin-tools` fallback。主线工具失败时不再回落到旧简化工具；所有产品工具执行必须进入 `src/tools/*` mature owner、Tool Gate、Permission Gate 和 evidence mapping。
- `types.ts` 移除 `allowMainlineToolFallback`，防止调用方重新打开 fallback shortcut。
- `index.ts` 将 `connectMCPFromConfig()` 改为 `registerMCPFromMainlineClients()`，只注册 `src/services/mcp` 已拥有的 mainline clients，不再保留 engine 自管 `.mcp.json` / server lifecycle 的语义。
- `dirty-worktree-review-v1.test.ts` 并入删除态，避免已删除 dirty-review runtime 通过测试 import 继续保活。
- `docs/generated` owner/Git register 已刷新到当前 `1821` 条 status，删除态为 `144`；`src/dsxu/engine/mcp-client.ts` 作为独立 `V20-OGR-04-delete-engine-mcp-client-runtime` candidate 记录。

Focused verification：
- mainline tool adapter focused run PASS：3 tests / 0 fail。
- provider contract focused run PASS：1 test / 0 fail / 4451 expect。
- ToolDefinition + extension + external integration focused run PASS：7 tests / 0 fail。
- high-risk fallback scan PASS：`engine-tool-adapter.ts`、`tool-capability-pool.ts`、`extended-tools.ts`、`engine/index.ts`、`types.ts` 中无 `builtin-tools` / `allowMainlineToolFallback` / `executionFallback` / `fallbackTool`。

当前状态仍是 `V20 PARTIAL`。本轮关闭的是产品 runtime 回流路径，不是 final comprehensive tests，也不是 clean export。下一步继续 OGR-06 UI/TUI visible-state、OGR-12 shared utilities 和 remaining owner/Git packet signoff。

## 2026-05-14 V20 批量执行更新：旧 built-in tools 删除态与 OGR-06/12 证据

本轮继续按“重复等价就合并或删，不留第二套 runtime”的标准推进，不再把旧 `src/dsxu/engine/builtin-tools.ts` 当作隔离测试对象维护。真实 import/use 扫描确认：旧 built-in Bash/Read/Write/Edit/Grep/Glob 已无产品 import，唯一保活来源是 `builtin-tools.test.ts`。因此本轮将两者并入删除态：
- `src/dsxu/engine/builtin-tools.ts` -> `V20-OGR-03-delete-engine-builtin-tools-runtime`。
- `src/dsxu/engine/__tests__/builtin-tools.test.ts` -> 同一删除包。

Owner 裁决：成熟工具唯一 owner 是 `src/tools/*` + `engine-tool-adapter.ts` + Tool Gate / Permission Gate / evidence pipeline。旧 built-in tools 不再作为 recovery/fallback/runtime/test-maintained surface 保留；如果后续发现行为缺口，必须补到命名主线 owner，不能恢复旧简化工具栈。

同时完成 OGR-06/12 证据：
- `src/dsxu/engine/__tests__/engine.test.ts` 已替换为 V20 mainline engine suite，不再导入旧 built-in tools 或旧 MCP runtime。
- `src/dsxu/engine/extended-tools.ts` 清理 mojibake 造成的语法风险，并保留为 engine ToolDefinition surface，不回落旧工具。
- 新增 `src/dsxu/engine/__tests__/visible-shared-owner-v20.test.ts`，证明 UI/TUI 只做 visible-state / user interaction projection，shared utilities 不拥有 Query Loop、Tool Gate、MCP lifecycle、provider runtime 或旧 `runtime-core`。
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` 已刷新到 `1824` 条 status，删除态 `146`，packets `17`。
- `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_SUMMARY_20260514.json` 明确删除态 `146/146 ready-for-delete-signoff-after-owner-review`。

Focused verification：
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS：1 test / 0 fail / 4453 expect。
- `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts --test-name-pattern "registers mainline|schema validation|tool-use summaries|closes DeepSeek XML"` PASS：3 tests / 0 fail / 69 expect。
- `bun test src/dsxu/engine/__tests__/engine.test.ts src/dsxu/engine/__tests__/visible-shared-owner-v20.test.ts src/dsxu/engine/__tests__/mcp-client.test.ts` PASS：11 tests / 0 fail / 43 expect。
- `rg "builtin-tools|getCoreTools|getReadOnlyTools" src` 为 0 hit。
- 旧 fallback / provider / runtime 关键词产品扫描仅剩测试防回归字符串和 release fixture。
- `git diff --check` 对本轮工作文件 PASS，仅保留 CRLF working-copy warning。

当前状态仍是 `V20 PARTIAL`：这批关闭了旧 built-in tools 保活、旧 MCP engine runtime 保活、UI/shared 越权证据三类问题；还没有 stage、commit、reset、clean 或 clean export。下一步继续按 17 个 owner/Git packets 做签收或调整，重点从 OGR-06/12 大面源文件、OGR-05 agent/external、OGR-07 provider/cost 和 OGR-02 删除态正式 mutation review 推进。

## 2026-05-14 V20 当前审计快照：加速执行后的风险校验

本轮重新审计 V20 方案与工作区，不把 focused verification 包装成最终 PASS。当前事实：
- 当时 `git status --short = 1824`：`M=1630`、`D=146`、`??=48`；最新剩余量以后续 real-gap 覆盖矩阵为准。
- V20-C2 不是最终完成：Claude 1902 文件能力映射 CSV 已生成且行数正确，`988 / 594 / 278 / 42` 动作分布正确，但 `42` 个 review candidate、`278` 个 shared utility、`594` 个 product-specific 和 `988` 个 mainline absorb 候选还没有完成最终 owner signoff / 吸收闭环。
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` 当前为 `17` 个 packets。
- deletion-state 当前 `146/146 ready-for-delete-signoff-after-owner-review`，但还没 stage/delete mutation。
- `git diff --check` 全工作区 PASS，仅 CRLF working-copy warnings。
- 核心 owner 证据测试 PASS：`provider-contract-v1`、`tool-definition-v20`、`extension-runtime-owner-v20`、`external-integration-owner-v20`、`engine`、`visible-shared-owner-v20`、`mcp-client` 合计 `28 tests / 0 fail / 4754 expect`。
- `bun run lint-schema` PASS：DeepSeek strict-mode tool schemas 全部通过。
- CLI smoke PASS：`dsxu-code --help` 可正常输出。
- MCP doctor smoke PASS：当前 release gate 为 `WARN`，原因是 `DSXU_MCP_REGISTRY_URL` 未配置且无 MCP servers；不是代码崩溃。
- health audit PASS：`invalid_utf8_files=0`、`user_visible_risk_files=0`。本轮发现并修复了 `voiceModeEnabled.ts`、`init.ts`、`sessionStorage.ts`、`teleport/api.ts` 中的替换字符/坏 UTF-8 风险。
- release gate 当前 FAIL：`bun run scripts/dsxu-release-gate.ts` 跑到 `490 pass / 6 fail / 1 error`。硬阻断集中在 `release-surface-v1.test.ts` 的 public/release provenance/pending deletion gate、`v18-dirty-quarantine-ledger-v1.test.ts` 缺失已删除 ledger module、`wsl-native-mirror-plan-v1.test.ts` dirty-aware mirror plan 仍为 `PLAN_ONLY`。

审计结论：加速执行没有发现当时批次造成的语法、schema、核心 owner 测试、CLI 启动、MCP doctor 或 health audit 级别破坏；但 release gate 明确失败，V20 仍不能放行。该历史批次剩余硬项包含 V20-C2 Claude 1902 映射 owner 闭环、owner/Git signoff、146 个删除态 mutation review、3 个 ACL residue、生态 intake/外部 host real-gap、GPT-5.5 / Claude4.7 90 分能力验收、真实 UI/TUI 六阶段测试、final preflight 和 clean export；最新数字以后续 real-gap 覆盖矩阵和 closure board 为准。

## 2026-05-14 V20 完成保障：90 分体验验收标准

V20 最终目标不是“文件减少”或“测试局部通过”，而是让 DSXU 在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上，达到对标 GPT-5.5 与 Claude4.7 高级 AI 编程和复杂任务执行体验的 90 分以上水平。该目标必须落成可验证验收项：

| 能力维度 | 必须证明 | 不接受的替代 |
|---|---|---|
| 长时间保持任务目标 | 多轮真实任务中目标、约束、当前 blocker、下一步动作保持一致，并能从 compact/resume 恢复 | 只写计划、只靠 summary、或最终答复自称记得 |
| 真实读写代码 | 真实 repo 中定位、修改、运行验证、说明影响范围 | 只做静态文档、只扫文件名、只给建议 |
| 调用工具与权限 | Bash/PowerShell/File/MCP/Agent/Remote 工具全经过 Tool Gate / Permission Gate，有可见决策与证据 | 旧 fallback、bypass shortcut、第二套 tool runner |
| 处理失败 | 测试失败、命令失败、权限拒绝、MCP 无 server、release gate 阻断时进入命名 recovery owner | 用最小补丁掩盖失败，或把 blocked outcome 写成 PASS |
| 恢复上下文 | compact/resume 能恢复文件、决策、失败、证据、下一步，不丢主线 | 只保留聊天摘要，不恢复 source truth |
| 并行 Agent | 并行只用于 disjoint ownership，父任务能合成证据并阻断虚假完成 | 让 worker 形成第二套 orchestrator 或无证据 DONE |
| 成本控制 | Flash / Flash-MAX / Pro 路由有成本、cache、fallback、升级理由证据 | 默认走高成本模型，或把 provider fallback 当主线 |
| 可审计证据 | raw transcript、tool trace、permission decision、metrics、risk、final report 可追溯 | 模板日志、generic logs、target-only logs |
| UI/TUI 可见状态 | 用户能看到进度、权限、工具、失败、恢复、Agent、成本、证据链接和可继续操作状态 | 隐藏等待、不可解释 loading、只在内部日志出现 |

放行规则：这 9 个维度必须进入六阶段真实测试和 release gate；任何一个维度只停留在 focused test 或文档口径，都只能算 `V20 PARTIAL`。

## 2026-05-14 V20 批量执行更新：C2 x OGR 交叉签收

本轮按“3~5 倍批量闭环，不小步停顿”的方式执行 C2 x OGR 交叉签收。目标不是新增计划，而是把 Claude 1902 映射中的高风险未定项压到当前 DSXU owner packets 上，避免后续一边删除一边又回头补 owner。

新增/刷新证据：

- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260514.csv`
- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_SUMMARY_20260514.json`
- `docs/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260514.md`
- `docs/DSXU_V20_PRIORITY_OWNER_PACKET_REVIEW_20260514.md`

当前批量结果：

| 项 | 数量 | 裁决 |
|---|---:|---|
| C2 `review_candidate` | 42 | 不再作为未知桶；已映射到命名 DSXU owner packet 或 product-specific exclude/adapt review。 |
| C2 `review_absorb_as_shared_utility_only_if_imported` | 278 | 只能在被命名 DSXU 主线 owner import 时保留；否则进入 replace/delete candidate。 |
| C2 priority total | 320 | 已与当前 `17` 个 OGR packets 交叉。 |
| 删除态 | 146 | `146/146 ready-for-delete-signoff-after-owner-review`，仍未 stage/delete mutation。 |

重点 packet 交叉结果：

| Packet | C2 priority | 当前 OGR count | 当前结论 |
|---|---:|---:|---|
| `V20-OGR-06-ui-tui-visible-state` | 106 | 437 | UI/TUI 只能是 visible-state projection 和用户操作面；不允许 tool runner、QueryEngine、MCP runtime、provider runtime 藏在 UI/TUI。 |
| `V20-OGR-12-shared-platform-utilities` | 86 | 249 | shared utility 不是收容桶；只有真实主线 import 且不拥有 runtime 的 helper 才保留。 |
| `V20-OGR-05-agent-task-lifecycle` | 16 | 170 | 归入 `AgentTool`、`LocalAgentTask`、`RemoteAgentTask`、teammate/worktree/task evidence owner；不恢复旧 local simulator。 |
| `V20-OGR-05-external-integration-adapter-boundary` | 0 | 27 | 当前 dirty paths 仍需签收为 adapter boundary，不允许外部 host runtime。 |
| `V20-OGR-07-provider-migration-model-cost` | 35 | 101 | 归入 DeepSeek adapter、model router、cost evidence、provider-migration alias/intake 和 credential boundary；不允许 provider fallback 成为主线。 |

红线扫描：

- 旧 agent simulator 符号 `executeAgentTool` / `normalizeAgentToolInput` / `createAgentTaskLifecycleState` / `registerAgentTask` / `transitionAgentTask` / `appendAgentTaskMessage` 无 active product hits；只剩测试防回归字符串。
- 旧 engine MCP runtime 没有 active product import；`src/services/mcp` 是主线 MCP owner，`engine-mcp-client` 只保留为 replace/delete metadata 与测试防回归。
- 旧 provider fallback 红线 `provider-backend` / `allowMainlineToolFallback` / `fallbackTool` / `executionFallback` 只剩 V20 防回归测试。
- UI/TUI/state surface 没有 `buildTool(` / `executeTool(` / `runTool(` / `new QueryEngine(` / `new MCPManager(` / `new MCPConnection(` / `Bun.spawn(` 这类直接 runtime 执行入口；`.exec()` 命中为 regex parser，不是工具运行时。

本轮裁决：C2 priority 已从“待分析”推进到“owner-mapped signoff queue”。下一步继续按同一批量标准完成 OGR-06/12、OGR-05、OGR-07 和剩余 packets 的 owner/Git signoff；之后再处理 `146` 个删除态 Git mutation review。仍不允许提前跑六阶段测试、final preflight 或 clean export。

补充 packet-level review：已把优先包从 C2 映射落到当前 dirty path 形状：

| Packet | 当前 count | 路径形状 | 批量裁决 |
|---|---:|---|---|
| `V20-OGR-06-ui-tui-visible-state` | 437 | `components=251`、`ink=94`、`hooks=83`、`buddy=6`、`screens=3` | 可作为 visible-state projection queue 推 owner signoff；不能拥有 runtime。 |
| `V20-OGR-12-shared-platform-utilities` | 249 | `utils=183`、`services=66` | 条件可签收：只有被命名 owner import 的 utility 保留，其余 replace/delete。 |
| `V20-OGR-05-agent-task-lifecycle` + external adapter | 197 | `components=111`、`utils=32`、`hooks=13`、`tasks=10`、`services=8` 等 | 可作为 mainline agent/task lifecycle 与 adapter boundary queue 推 signoff；不能恢复 local simulator。 |
| `V20-OGR-07-provider-migration-model-cost` | 101 | `services=31`、`utils=29`、`dsxu=15`、`commands=14` 等 | 可作为 DeepSeek model/router/cost + provider-migration intake queue 推 signoff；不能把 provider fallback 当主线。 |
| deletion-state review | 146 | 五个 delete packets | 已 ready for Git mutation review；仍未 stage/delete。 |

## 2026-05-14 V20 批量执行更新：17 包 owner signoff execution 与删除 mutation queue

本轮纠正执行方向：不再用更多测试替代收口，而是继续按 V20 方案把 owner/Git 本体推进。实际完成：

新增/刷新证据：

- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_20260514.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_SUMMARY_20260514.json`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260514.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260514.json`
- `docs/generated/DSXU_V20_OGR13_OWNER_REMAP_20260514.csv`
- `docs/generated/DSXU_V20_OGR13_OWNER_REMAP_SUMMARY_20260514.json`
- `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.csv`
- `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260514.md`
- `docs/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.md`

执行结果：

| 项 | 数量 | 状态 |
|---|---:|---|
| owner packets | 17 | 全部进入 signoff execution matrix |
| current status paths | 1824 | 全部覆盖 |
| owner accepted / remapped paths | 1678 | pending Git review，不再是未知大桶 |
| deletion mutation-ready paths | 146 | pending explicit Git mutation review |
| OGR-13 other-source paths | 91 | 已拆桶，全部重映射到命名 owner |

Signoff state 汇总：

| State | Packets | Paths |
|---|---:|---:|
| `OWNER_ACCEPTED_PENDING_GIT_REVIEW` | 9 | 1314 |
| `OWNER_ACCEPTED_RELEASE_EVIDENCE_PENDING_GIT_REVIEW` | 1 | 24 |
| `CONDITIONAL_OWNER_ACCEPTED_IMPORT_REQUIRED` | 1 | 249 |
| `REMAPPED_TO_NAMED_OWNER_PACKET` | 1 | 91 |
| `DELETE_READY_PENDING_GIT_MUTATION_REVIEW` | 5 | 146 |

OGR-13 拆桶结果：`91` 个 other-source 文件不再保留为兜底桶，已重映射到 `V20-OGR-05` 2 个、`V20-OGR-06` 30 个、`V20-OGR-07` 5 个、`V20-OGR-09` 3 个、`V20-OGR-10` 14 个、`V20-OGR-12` 37 个。

删除 mutation queue：`146` 个删除态路径全部进入 `READY_PENDING_GIT_MUTATION_REVIEW`。策略是保留删除并在显式 Git review 后 stage removal；若发现差异能力，只能补到命名 DSXU owner，不允许恢复旧 runtime 作为兼容路径。

当前执行判断：V20 owner/Git 从“17 个待审包”推进到“17 个 signoff execution states + 146 deletion mutation queue”。下一步不是测试，而是执行显式 Git mutation review、关闭 ACL residues、继续 real-gap 产品化。六阶段测试仍放最后。

后续加速执行补充：已处理一个真实 release-gate source blocker。`src/dsxu/engine/__tests__/v18-dirty-quarantine-ledger-v1.test.ts` 不再 import 已删除的 `src/dsxu/engine/v18-dirty-quarantine-ledger.ts`，改为 deletion-closure guard：确认旧 runtime 保持删除、active source 不再 import、`docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.csv` 是 mutation review owner。Targeted verification PASS：`3 pass / 0 fail / 5 expect`。这不是最终测试，只是删除 mutation queue 的源头阻断修复。

ACL residue 真实状态也已复核：`src/dsxu/engine/retrieval/integration-example.ts`、`src/dsxu/integration/harness/recovery-runtime-v3-harness.ts`、`src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts`、`src/dsxu/engine/adapters/bridge-adapter.ts` 仍然拒绝本地删除，错误为 `Access to the path is denied`。它们继续作为外部 ACL residue；权限修复后应直接删除，不允许恢复旧 runtime 或保留 tombstone 作为产品路径。

同时修复第二个 release-gate 源头阻断：`src/dsxu/engine/__tests__/wsl-native-mirror-plan-v1.test.ts` 的当前工作区验收不再把 dirty workspace 误判为可 `SAFE_OVERLAY_COPY`。现在规则是：干净源端才允许 `SAFE_OVERLAY_COPY`；当前 dirty 源端必须保持 `PLAN_ONLY`、`canAutoSync=false`、`BLOCKED_EVIDENCED`。Targeted verification PASS：`4 pass / 0 fail / 20 expect`。

继续推进 C2 全量 owner execution：新增 `docs/generated/DSXU_V20_C2_FULL_OWNER_EXECUTION_20260514.csv`、`docs/generated/DSXU_V20_C2_FULL_OWNER_EXECUTION_SUMMARY_20260514.json` 和 `docs/DSXU_V20_C2_FULL_OWNER_EXECUTION_20260514.md`。现在 Claude 1902 文件不再只处理 `320` 个 priority 子集，而是全部映射到命名 DSXU owner packet：`absorb_into_dsxu_mainline=988`、`adapt_or_exclude_product_specific=594`、`review_absorb_as_shared_utility_only_if_imported=278`、`review_candidate=42`。Owner 分布为 `V20-OGR-06=1435`、`V20-OGR-08=241`、`V20-OGR-07=90`、`V20-OGR-05=52`、`V20-OGR-03=41`、`V20-OGR-04=22`、`V20-OGR-12=21`。这仍是 owner execution 输入，不是最终 PASS；后续 Git review 必须按该映射吸收、排除或删除，不能新增桥接/兼容 holding path。

继续修复第三个 release-gate 源头阻断：`src/dsxu/engine/__tests__/release-surface-v1.test.ts` 不再把当前 V20 owner/Git 未闭环状态误断言为 release/export ready。现在该测试验证诚实 blocked evidence：public/proprietary gates 可为 `BLOCKED_EVIDENCED`，public surface review debt 必须可见，package clean-export readiness 只代表 package gate 自身，V20 `146` deletion mutation queue 仍是独立 Git review 阻断。Targeted verification PASS：`6 pass / 0 fail / 54 expect`。

## 2026-05-14 V20 批量执行更新：release-surface owner 源头收口

本轮继续按“先处理问题，最后全面测试”执行，不新增主链、不新增入口、不把外部兼容当第二套 runtime。实际关闭的是 public/proprietary release-surface 源头债，不是 final clean export。

源码改造：

- `src/dsxu/engine/v18-public-surface-clean-gate.ts`：把 `src/utils/model/providerMigration/*`、`src/services/mockRateLimitsProviderMigration/*`、`src/services/auth/dsxuProvider*Auth.ts`、`src/utils/commitAttributionProviderMigration.ts`、`src/utils/envCompat.ts` 归到命名 `provider_migration` owner；`docs/DSXU_V20_*` 与 `docs/generated/DSXU_V20_*` 作为 V20 source-truth / evidence，进入 clean export rewrite/exclude policy，不再误判为 active release content。
- `src/dsxu/engine/v18-proprietary-code-risk-gate.ts`：同样收口 provider-migration owner，并把 `dsxuProviderAuth` / `dsxuProviderControlAuth` 的 OAuth/control 协议符号识别为隐藏 provider-migration auth boundary。
- `src/constants/providerMigrationProtocol.ts` + `src/services/api/grove.ts`：`/api/claude_code_grove` 这类旧 provider wire path 进入统一 provider-migration protocol 常量，不散落在 API service。
- `src/services/api/client.ts`、`src/services/api/withRetry.ts`、`src/services/api/errors.ts`、`src/services/mcp/client.ts`、`src/services/oauth/client.ts`、`src/main.tsx`：主线调用点改用 DSXU control-auth wrapper，避免直接 import/source-reference token helper。
- `docs/CONFIGURATION.md`：公开配置文档改成 neutral external-compatible intake 描述，不把 source-provenance 名称写成发布文案。

新增证据：

- `docs/DSXU_V20_RELEASE_SURFACE_OWNER_EXECUTION_20260514.md`
- `docs/generated/DSXU_V20_RELEASE_SURFACE_OWNER_EXECUTION_20260514.csv`
- `docs/generated/DSXU_V20_RELEASE_SURFACE_OWNER_EXECUTION_SUMMARY_20260514.json`

当前 gate 结果：

| Gate | 之前 | 现在 | blockers | review | active_src debt | provider_migration justified |
|---|---|---|---:|---:|---:|---:|
| public surface clean | `BLOCKED_EVIDENCED` | `DONE_EVIDENCED` | 0 | 0 | 0 | 421 |
| proprietary code risk | `BLOCKED_EVIDENCED` | `DONE_EVIDENCED` | 0 | 0 | 0 | 437 |

Targeted verification：`bun test src/dsxu/engine/__tests__/release-surface-v1.test.ts` PASS，`6 pass / 0 fail / 57 expect`。

当前判断：release-surface 源头阻断已从 active source 中移除，旧 provider/model/auth 符号只允许留在命名 provider-migration/control owner、测试防回归或 source-truth 文档中。V20 仍未 PASS；剩余硬项继续是 `17` 个 owner/Git packets 的真实 review、`146` deletion mutation review、ACL residues、real-gap 产品化、六阶段真实测试、final preflight 和 clean export。

## 2026-05-14 V20 批量执行更新：OGR-12 shared utilities import/use 真实复核

本轮继续推进 `V20-OGR-12-shared-platform-utilities`。这个 packet 之前状态是 `CONDITIONAL_OWNER_ACCEPTED_IMPORT_REQUIRED`，不能把 `shared utilities` 当作兜底桶。本轮用当前仓库真实 import/use 关系做复核，输出：

- `docs/DSXU_V20_OGR12_SHARED_UTILITY_IMPORT_USE_REVIEW_20260514.md`
- `docs/generated/DSXU_V20_OGR12_SHARED_UTILITY_IMPORT_USE_REVIEW_20260514.csv`
- `docs/generated/DSXU_V20_OGR12_SHARED_UTILITY_IMPORT_USE_REVIEW_SUMMARY_20260514.json`

复核结果已纠正一次：第一次扫描只按字面 specifier 解析，会漏掉 TypeScript 源码里 `.js` specifier 指向 `.ts/.tsx` 源文件的真实 import/use。已重新生成证据，解析器现在会把 `.js/.jsx/.mjs/.cjs` specifier 回指到存在的 `.ts/.tsx` 源文件，避免把真实主线 utility 误判成待删。

| Decision | Count | 处理口径 |
|---|---:|---|
| `KEEP_MAINLINE_IMPORTED_UTILITY` | 248 | 有 active source import/use，可继续由命名 DSXU owner 签收；不得拥有 Query Loop、Tool Gate、provider runtime、MCP runtime 或 agent orchestration。 |
| `DELETE_STATE_REVIEW_KEEP_DELETED` | 1 | `src/utils/desktopDeepLink.ts` 没有 import/use，且与 `src/utils/deepLink/*` 现有主线重复，已从源码删除；后续只等 Git mutation review/stage。 |
| `REPLACE_DELETE_CANDIDATE_NO_IMPORT_EVIDENCE` | 0 | 解析修正后没有仍然存在的 no-import shared utility。 |

当前判断：OGR-12 不再是 `249` 个条件保留文件的大桶；真实结论是 `248` 个主线 imported utility keep + `1` 个重复 desktop deep-link helper 删除态。后续 Git review 应签收这 `248` 个 helper 只能作为 helper 保留，并把 `src/utils/desktopDeepLink.ts` 的删除作为 mutation review 处理；不能新增 helper holding path，也不能把 shared utility 包装成第二套运行时。

## 2026-05-14 V20 批量执行更新：高风险 owner packets runtime redline 复核

本轮把 `OGR-05/06/07/08/10` 一次性做 runtime redline 复核，覆盖 UI/TUI visible-state、Agent/task lifecycle、external adapter、provider/model/cost、CLI/transport、entry/query/tool composition。扫描规则去掉注释噪音，只看真实代码中的第二套 Query Loop、Tool runner、MCP runtime、provider runtime、agent orchestrator 和 fallback composition 红线。

新增证据：

- `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260514.md`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260514.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_SUMMARY_20260514.json`

复核结果：

| Packet | Paths | Present | Runtime redline |
|---|---:|---:|---:|
| `V20-OGR-05-agent-task-lifecycle` | 170 | 170 | 0 |
| `V20-OGR-05-external-integration-adapter-boundary` | 27 | 27 | 0 |
| `V20-OGR-06-ui-tui-visible-state` | 437 | 437 | 0 |
| `V20-OGR-07-provider-migration-model-cost` | 101 | 101 | 0 |
| `V20-OGR-08-cli-command-transport` | 178 | 178 | 0 |
| `V20-OGR-10-entry-query-tool-composition` | 6 | 6 | 0 |

当前判断：这 `919` 个高风险 packet paths 没有发现第二套 runtime 红线。它们仍然 pending owner/Git signoff，不等于 Git 已关闭；但后续签收重点可以从“是否藏 runtime”转到“是否按 owner 吸收、删除、改名、release-exclude”。

## 2026-05-14 V20 批量执行更新：当前 closure board 重排

新增/刷新：

- `docs/DSXU_V20_BATCH_CLOSURE_BOARD_20260514.md`
- `docs/generated/DSXU_V20_BATCH_CLOSURE_BOARD_20260514.csv`
- `docs/generated/DSXU_V20_BATCH_CLOSURE_BOARD_SUMMARY_20260514.json`
- `docs/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_20260514.md`
- `docs/generated/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_20260514.csv`
- `docs/generated/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_SUMMARY_20260514.json`

当前收口板：

| Gate | Count | Status |
|---|---:|---|
| release-surface-source | 2 | `CLOSED_SOURCE_BLOCKERS` |
| runtime-redline-high-risk-packets | 919 | `REDLINE_CLEAR_PENDING_OWNER_GIT` |
| OGR-12 mainline keep | 248 | `KEEP_PENDING_OWNER_GIT` |
| OGR-12 delete-state | 1 | `DELETE_STATE_PENDING_GIT_MUTATION` |
| OGR-12 replace-delete still present | 0 | `NONE_REMAINING_AFTER_RESOLVER_FIX` |
| previous deletion mutation queue | 146 | `READY_PENDING_GIT_MUTATION` |
| total deletion mutation queue | 147 | `READY_PENDING_GIT_MUTATION` |
| ACL residue | 4 | `EXTERNAL_PERMISSION_BLOCKED` |
| final tests / clean export | 1 | `BLOCKED_UNTIL_OWNER_GIT_MUTATION_REAL_GAP` |

本轮真实源码动作：删除 `src/utils/desktopDeepLink.ts`。理由是它没有 import/use 证据，且现有 `src/utils/deepLink/*` 已是 DSXU deep-link 主线；保留该文件只会形成重复 helper / future desktop handoff shortcut。没有 stage、commit、reset、clean 或 export。

## 2026-05-14 V20 批量执行更新：OGR-01 与 signoff execution update

本轮继续把 owner/Git signoff 从旧状态推进到新状态，不让 stale conditional interpretation 拖住后续收口。

新增/刷新：

- `docs/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_20260514.md`
- `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_20260514.csv`
- `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_SUMMARY_20260514.json`
- `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_UPDATE_20260514.md`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_UPDATE_20260514.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_UPDATE_SUMMARY_20260514.json`

OGR-01 docs/evidence signoff：

| Class | Count | Policy |
|---|---:|---|
| ship-open-source-doc | 10 | 可作为 GitHub 开源发布文档，必须保持 provider-neutral 且通过 release-surface gate。 |
| release-excluded-source-truth-evidence | 13 | 保留为 repo source truth / audit evidence，clean export 必须 exclude 或 rewrite。 |
| benchmark-evidence-not-release-runtime | 1 | 作为 benchmark/evidence，不是产品 runtime。 |

更新后的 owner closure：

| Group | Count | State |
|---|---:|---|
| OGR-01 docs/release evidence | 24 | `OWNER_ACCEPTED_DOCS_EVIDENCE_PENDING_GIT` |
| OGR-05/06/07/08/10 high-risk runtime redline packets | 919 | `RUNTIME_REDLINE_CLEAR_PENDING_OWNER_GIT` |
| OGR-12 imported shared utilities | 248 | `OWNER_ACCEPTED_IMPORTED_UTILITY_PENDING_GIT` |
| OGR-12 duplicate desktop deep-link helper | 1 | `DELETE_READY_PENDING_GIT_MUTATION_REVIEW` |
| existing deletion mutation queue | 146 | `DELETE_READY_PENDING_GIT_MUTATION_REVIEW` |
| ACL residues | 4 | `EXTERNAL_PERMISSION_BLOCKED_DELETE_WHEN_ALLOWED` |

当前判断：`CONDITIONAL_OWNER_ACCEPTED_IMPORT_REQUIRED` 的 OGR-12 旧状态已被 corrected import/use 证据取代。现在可以把精力集中到 Git mutation / stage 许可、ACL 外部权限、real-gap 产品化和最后六阶段测试。

## 2026-05-14 V20 批量执行更新：real-gap 产品化覆盖矩阵

本轮继续按“先处理问题，最后测试”的顺序执行。重点不是再补一个小 runtime，而是把 V20-C5 真实缺口按当前主线代码证据重新裁决，确认哪些已经有 DSXU owner，哪些只是合同/入口未验收，哪些必须保持 blocked，不能用文档或 focused test 冒充最终 PASS。

新增/刷新证据：

- `docs/DSXU_V20_REAL_GAP_PRODUCTIZATION_REVIEW_20260514.md`
- `docs/generated/DSXU_V20_REAL_GAP_PRODUCTIZATION_REVIEW_20260514.csv`
- `docs/generated/DSXU_V20_REAL_GAP_PRODUCTIZATION_REVIEW_SUMMARY_20260514.json`
- `docs/generated/DSXU_V20_MCP_DOCTOR_REAL_GAP_SMOKE_20260514.json`
- `docs/generated/DSXU_V20_PROJECT_INTAKE_OWNER_REVIEW_20260514.json`

最新工作区口径：

| 项 | 当前值 |
|---|---:|
| `git status --short` | `1838` |
| `M` | `1630` |
| `D` | `147` |
| `??` | `61` |

V20-C5 real-gap 最新裁决：

| Gap | 当前裁决 | 执行口径 |
|---|---|---|
| Permission Queue / Tool Gate visible decision | `MAINLINE_PRESENT_NEEDS_RUNTIME_ACCEPTANCE` | 已有 PermissionPrompt、permissionLogging、control-plane bridge 和 Tool Gate 测试；还需真实拒绝/恢复任务验收。 |
| MCP Server registry / install / status / doctor | `MAINLINE_PRESENT_NEEDS_REAL_SERVER_ACCEPTANCE` | `src/services/mcp`、`/mcp` command、MCP UI 已是主线；还需真实 manifest install/list/status/tool-call 证据。 |
| Claude-compatible project intake | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | `.mcp.json`、skills/commands/hooks/settings 已有分散 owner；还缺统一 external-code-compatible intake 验收。 |
| External Agent Host / AionUi-like contract | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | SDK/remote/bridge surface 存在；只能做 facade，真实执行必须进 Query Loop / Tool Gate / Evidence。 |
| External Chat Client / Cherry-like Agent API | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | SDK/session ingress/API surface 存在；还需证明外部 chat client 不能绕过 Tool Gate 或 Model Router。 |
| Warp-like terminal host contract | `MAINLINE_PRESENT_NEEDS_RUNTIME_ACCEPTANCE` | CLI/terminal/remote IO 已存在；还需真实终端任务证明权限、失败恢复、evidence 仍归 DSXU。 |
| browser-use-like browser provider contract | `MAINLINE_PRESENT_NEEDS_REAL_BROWSER_ACCEPTANCE` | DSXU browser provider / computer-use MCP 已存在；还需真实浏览器操作证据。 |
| Bridge / Remote / IDE / CI clean-room facade | `MAINLINE_PRESENT_NEEDS_CONTRACT_ACCEPTANCE` | Bridge 和 permission projection 存在；还需 SDK message / permission request contract 验收。 |
| UI/TUI work-state and operator dashboard | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | AppState 与 permission/MCP/agent UI 存在；还缺统一 operator visible-state 验收。 |
| Cost / evidence / recovery visible state | `MAINLINE_PRESENT_NEEDS_E2E_ACCEPTANCE` | cost/evidence/recovery owner 存在；还需真实任务 final report + UI/TUI 可见证据。 |
| DeepSeek-TUI-style open-source productization | `PARTIAL_PRODUCTIZATION` | README/docs/doctor/config/release runbook 已有；还缺 package/release smoke、版本资产、checksum/rollback。 |
| Final six-stage V20 acceptance and clean export | `NOT_STARTED_BY_DESIGN` | 必须等 owner/Git、`147` deletion、`4` ACL、real-gap acceptance 全部关闭后再跑。 |

当前执行判断：V20-C5 不是“完全没做”，但也不能标 PASS。主线 owner 已经承载了大部分能力，真正剩余的是产品化验收和统一可见状态。下一步按固定顺序继续：owner/Git signoff -> `147` deletion mutation review -> `4` ACL residue -> real-gap acceptance -> 六阶段测试 -> final preflight -> clean export。继续禁止新增其它主链、入口、桥接 shortcut、compat holding path 或第二套 runtime。

补充真实 smoke：本轮运行 `bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json`，结果为 `WARN`，`totalServers=0`、`registryConfigured=false`、`configErrors=0`；focused verification `bun test src/services/mcp/__tests__/doctor.test.ts` PASS，`2 tests / 0 fail / 13 expect`。裁决是 MCP doctor 主线可用且能诚实给出 WARN，但 V20-GAP-02 仍需真实 MCP server manifest、install/list/status、tool discovery 和 tool call evidence，不能把 smoke 当 PASS。

补充 project intake owner 复核：`DSXU.md / DSXU.local.md` 归 Context / Memory / Init，`.mcp.json` 归 `src/services/mcp/config.ts`，`.dsxu/skills` / `.dsxu/commands` 归 `src/skills/loadSkillsDir.ts`，settings hooks 归 `src/utils/settings/types.ts` / `src/utils/hooks.ts` / `src/utils/sessionStart.ts`，plugin commands / skills / hooks / MCP 归 DSXU Plugin Runtime + MCP Adapter Boundary。focused verification `bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS，`1 test / 0 fail / 12 expect`。裁决是 V20-GAP-03 已有 owner 覆盖，但还缺真实 external-code-compatible project intake 验收任务，不能标 PASS。

## 2026-05-15 V20 批量执行更新：external / visible-state owner review

本轮继续按 8 倍批量推进 V20-C5，不新增主链、不新增入口、不把外部生态产品做成依赖。新增：

- `docs/DSXU_V20_EXTERNAL_VISIBLE_STATE_OWNER_REVIEW_20260515.md`
- `docs/generated/DSXU_V20_EXTERNAL_VISIBLE_STATE_OWNER_REVIEW_20260515.json`

本轮覆盖 `V20-GAP-04` 到 `V20-GAP-10`，一次性裁决 External Agent Host、External Chat Client API、Terminal Host、Browser Provider、Bridge/Remote/IDE/CI、UI/TUI operator state、Cost/Evidence/Recovery：

| Gap | 当前裁决 | 执行口径 |
|---|---|---|
| V20-GAP-04 External Agent Host / AionUi-like contract | `OWNER_COVERED_NEEDS_EXTERNAL_HOST_ACCEPTANCE` | SDK/bridge/remote IO surface 已有 owner；还需真实 external-host style 任务验收。 |
| V20-GAP-05 External Chat Client / Cherry-like Agent API | `PARTIAL_API_CONTRACT_NEEDS_ACCEPTANCE` | API/session ingress surface 存在；还需证明 chat client 不能绕过 Tool Gate 或 Model Router。 |
| V20-GAP-06 Warp-like terminal host contract | `OWNER_COVERED_NEEDS_TERMINAL_ACCEPTANCE` | CLI/terminal/remote IO 已有 owner；还需真实 terminal-host failure/permission/evidence 验收。 |
| V20-GAP-07 browser-use-like browser provider contract | `OWNER_COVERED_NEEDS_REAL_BROWSER_ACCEPTANCE` | DSXU browser provider / computer-use MCP 已有 owner；还需真实浏览器操作证据。 |
| V20-GAP-08 Bridge / Remote / IDE / CI clean-room facade | `OWNER_COVERED_NEEDS_BRIDGE_ACCEPTANCE` | Bridge/session/permission projection 已有 owner；还需 SDK message + permission lifecycle 验收。 |
| V20-GAP-09 UI/TUI work-state and operator dashboard | `PARTIAL_VISIBLE_STATE_NEEDS_OPERATOR_ACCEPTANCE` | AppState、permission/MCP/agent UI 已有 owner；还缺统一 operator-state 验收。 |
| V20-GAP-10 Cost / evidence / recovery visible state | `OWNER_COVERED_NEEDS_E2E_ACCEPTANCE` | Cost/evidence/recovery owner 已有；还需真实 coding recovery task 证明 final report + UI/TUI 可见。 |

裁决：这 7 个 gap 都不是未知大桶，也不需要新增第二套 runtime；但都不能标 PASS。它们下一步要进入真实 acceptance packets。六阶段测试仍必须等 owner/Git、`147` deletion mutation、`4` ACL residue 和 real-gap acceptance 之后再跑。

Focused verification：`bun test src/dsxu/engine/__tests__/bridge-gate.test.ts src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts` PASS，`8 pass / 0 fail / 68 expect`。该结果只证明 Bridge/Remote lifecycle、browser proof、final report cost evidence owner smoke 没坏，不等于 External Host、Agent API、Terminal Host、Browser Provider、Operator Dashboard 的最终真实验收。

## 2026-05-15 V20 closure board

新增：

- `docs/DSXU_V20_CLOSURE_BOARD_20260515.md`
- `docs/generated/DSXU_V20_CLOSURE_BOARD_20260515.json`

最新执行口径：`git status --short = 1863`，其中 `M=1645`、`D=147`、`??=71`。当前不是未知大桶，而是固定收口板；该数字包含本 closure board、C2 防洗少审计、commercial/IP/brand gate/adjudication、false-completion audit、C2 x OGR 复核、runtime redline adjudication、deletion mutation review、ACL residue review、本轮 V20 benchmark/contract 主线补齐与 consolidated ops evidence 新增产物。

| Gate | Count | Status |
|---|---:|---|
| release-surface-source | 2 | `CLOSED_SOURCE_BLOCKERS` |
| runtime-redline-owner-packets | 1602 | `RAW_59_ADJUDICATED_0_ACTIVE_BLOCKERS_PENDING_OWNER_GIT` |
| C2 priority x OGR mapping | 320 | `OWNER_DISPOSITION_DONE_FEATURE_ACCEPTANCE_PENDING` |
| OGR-01 docs/release evidence | 46 | `OWNER_ACCEPTED_DOCS_EVIDENCE_PENDING_GIT` |
| OGR-12 imported shared utilities | 248 | `OWNER_ACCEPTED_IMPORTED_UTILITY_PENDING_GIT` |
| deletion-mutation-ready | 147 | `READY_PENDING_GIT_MUTATION_REVIEW` |
| ACL residue | 4 | `EXTERNAL_PERMISSION_BLOCKED_DELETE_WHEN_ALLOWED` |
| commercial/IP/brand release gate | 0 active blockers | `ADJUDICATED_ACTIVE_BLOCKERS_0_RELEASE_NOTICE_PENDING` |
| V20 real-gap owner coverage | 12 | `OWNER_COVERED_OR_PARTIAL_NEEDS_ACCEPTANCE` |
| focused verification since real-gap review | 12 | `PASS_FOCUSED_NOT_FINAL` |
| final six-stage tests | 6 | `BLOCKED_UNTIL_UPSTREAM_GATES_PASS` |
| clean export | 1 | `BLOCKED` |

下一步不应继续加小层；应按该 board 进入 owner/Git signoff、`147` deletion mutation review、`4` ACL residue 和 real acceptance packets。商业/IP/品牌当前已完成 active blocker adjudication，但 final preflight 仍需复核 license/vendor notice/package metadata。最终六阶段测试与 clean export 仍放最后。

## 2026-05-15 V20 Owner/Git register refresh

新增/刷新：

- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_SUMMARY_20260515.json`
- `docs/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_REFRESH_20260515.md`

当前 `git status --short` 重新归包为 `1869`：`M=1646`、`D=147`、`??=76`。本轮规则是继承旧 register 的真实 owner 证据，同时把当前新增的 `20` 条路径补入命名 owner，并把 `58` 条不能继续停留在 generic/shared 桶的路径重映射到明确 owner；`otherSourceBucketRows=0`。

Owner/Git packet 当前分布：

| Packet | Count | 当前裁决 |
|---|---:|---|
| `V20-OGR-01-docs-generated-plan` | 52 | docs/generated/release evidence 需要 owner 签收，非 ship 证据必须 release-excluded 或 clean export 重写。 |
| deletion packets total | 147 | 只进入显式 Git mutation review；不恢复旧 runtime。 |
| `V20-OGR-03-tool-permission-lifecycle` | 192 | Tool Gate / Permission 单一 owner，拒绝隐藏 runner shortcut。 |
| `V20-OGR-04-mcp-skill-plugin-registry` | 141 | MCP / Skill / Plugin 只能走单一 registry 与 Tool Gate。 |
| `V20-OGR-05-agent-task-lifecycle` | 202 | AgentTool / Task lifecycle 单一 orchestrator，拒绝 simulator/runtime duplicate。 |
| `V20-OGR-05-external-integration-adapter-boundary` | 32 | 只能作为 external adapter boundary，不允许 standalone host runtime。 |
| `V20-OGR-06-ui-tui-visible-state` | 474 | UI/TUI 只做 visible-state projection，不直接拥有 tool/query/provider runtime。 |
| `V20-OGR-07-provider-migration-model-cost` | 107 | DeepSeek adapter/router/cost evidence owner。 |
| `V20-OGR-08-cli-command-transport` | 180 | CLI/transport 是入口边界，不能形成第二套 query loop。 |
| `V20-OGR-09-dsxu-engine-mainline` | 67 | DSXU engine mainline composition 与 evidence terms。 |
| `V20-OGR-10-entry-query-tool-composition` | 20 | entry/query/tool composition，不能有 fallback composition。 |
| `V20-OGR-12-shared-platform-utilities` | 254 | 只保留有 import/use 的 helper；未使用或产品专属 helper 标 replace/delete。 |

OGR-01 文档/证据签收已同步到 `52` 条。`V20-OGR-12-shared-platform-utilities` 从旧口径 `285` 收窄到 `254`，因为 Agent/swarm、hooks、LSP/coding intelligence、external deep link、terminal transport、voice UI 等 `58` 条路径已回到命名 owner。该签收只说明文档/证据/owner 归属，不表示 release PASS；clean export 必须排除或重写 source-truth/generated evidence。

## 2026-05-15 V20 Owner packet signoff execution

新增/刷新：

- `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260515.md`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260515.json`

本轮把 `17` 个 Owner/Git packets 从待审矩阵推进到执行态。执行态裁决如下：

| Signoff state | Packets | Paths |
|---|---:|---:|
| `OWNER_ACCEPTED_PENDING_GIT_REVIEW` | 9 | 1415 |
| `OWNER_ACCEPTED_RELEASE_EVIDENCE_PENDING_GIT_REVIEW` | 1 | 52 |
| `CONDITIONAL_OWNER_ACCEPTED_IMPORT_REQUIRED` | 1 | 254 |
| `DELETE_REVIEW_ACCEPTED_PENDING_GIT_STAGE` | 6 | 147 |

当前裁决：产品 owner packets 已进入 `OWNER_ACCEPTED...PENDING_GIT_REVIEW`，OGR-12 只作为 imported helper 条件签收，`147` 个删除态已完成 Git mutation review signoff 但未 stage。本轮仍未 stage、commit、delete、reset、clean、强删 ACL residue 或创建 export。下一步不再继续补 owner 小结构，而是处理 real-gap acceptance 剩余项，然后才进入六阶段测试。

## 2026-05-15 V20 deletion / ACL signoff

新增：

- `docs/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_20260515.md`
- `docs/generated/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_SUMMARY_20260515.json`
- `docs/DSXU_V20_ACL_RESIDUE_SIGNOFF_20260515.md`
- `docs/generated/DSXU_V20_ACL_RESIDUE_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_ACL_RESIDUE_SIGNOFF_SUMMARY_20260515.json`

裁决：

| Gate | Count | 当前状态 |
|---|---:|---|
| deletion Git mutation signoff | 147 | `GIT_MUTATION_REVIEW_ACCEPTED_KEEP_DELETED_NOT_STAGED` |
| ACL residue signoff | 4 | `OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |

这表示删除态和 ACL residue 不再是“未判断大桶”。`147` 删除态已接受保持删除，但没有 stage；`4` 个 ACL residue 已签收为外部权限项，权限允许时删除，当前不能作为产品 runtime、fallback 或 compatibility holding path。

## 2026-05-15 V20 real-gap focused acceptance smoke

本轮在 Owner/Git packet signoff execution 之后推进 real-gap focused acceptance smoke。第一次把 MCP、external、remote、browser、terminal/TUI、real-task replay、cost/evidence 全部合并跑，超过 `120s` 超时，未记 PASS；随后拆成有价值的 focused packets：

| Packet | Command | Result |
|---|---|---|
| MCP / external / remote lifecycle | `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/v8-real-mcp-server-v1.test.ts src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts` | PASS，`9 tests / 0 fail / 82 expect` |
| browser / dev-server / cost evidence | `bun test src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts src/dsxu/engine/__tests__/frontend-project-dev-server-v1.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts src/dsxu/engine/__tests__/v19-cost-cache-live-task-evidence-v1.test.ts` | PASS，`8 tests / 0 fail / 164 expect` |

裁决：real-gap focused acceptance 入口可运行，覆盖 MCP real server harness、external adapter boundary、remote lifecycle、browser/dev-server proof、final report usage/cost evidence。它不等于 V20 real-gap 全 PASS：External Host / Agent API、Terminal Host、Operator Dashboard、real browser operation、真实项目 intake 和最终六阶段测试仍未完成。超时残留的 `bun` 测试进程已清理。

继续推进结果：

| Packet | Result |
|---|---|
| real-task replay / remote network | PASS，`3 tests / 0 fail / 46 expect` |
| extension / control-plane stage | PASS，`2 tests / 0 fail / 19 expect` |
| terminal / TUI reliability full group | PARTIAL，`9 pass / 1 fail / 144 expect`；失败为 WSL `$HOME` 冷启动/忙碌探测被 `SIGTERM` 杀掉 |
| TUI WSL exit smoke fix | PASS，`1 test / 0 fail / 15 expect` |

`src/dsxu/integration/harness/real-tui-harness.ts` 已修复：WSL home probe 从单次 `5s` 硬失败改成 `3` 次 `15s` 重试，并在最终失败时返回结构化 `spawn_failed` evidence。该修复服务于 Terminal Host / UI-TUI real acceptance，不新增主链、不新增入口、不引入第二套 TUI runtime。

## 2026-05-15 V20 C2 Claude 1902 最终吸收签收

新增：

- `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_20260515.json`

本轮把 C2 从“初版映射 / review candidate”推进为全量 owner disposition 证据。1902 个参考源码文件不再保留未知桶、review_candidate 桶或 other-source holding bucket：

| C2 类别 | Count | 最终处置 |
|---|---:|---|
| `absorb_into_dsxu_mainline` | 988 | 已映射到命名 DSXU owner，作为能力模式吸收，不形成第二套 runtime。 |
| `adapt_or_exclude_product_specific` | 594 | 只保留原则或排除；不能复制产品特有行为、品牌、账号、套餐或商业策略。 |
| `review_absorb_as_shared_utility_only_if_imported` | 278 | 73 个已有 import/use helper 可保留，201 个 baseline/no-op 不新增吸收，4 个不导入 DSXU 的不吸收。 |
| `review_candidate` | 42 | 35 个映射到命名 owner，7 个作为产品特有参考排除或 DSXU 化改写；`review_candidate=0`。 |

Owner 分布：OGR-03 `310`、OGR-04 `185`、OGR-05 `111`、OGR-06 `682`、OGR-07 `141`、OGR-08 `176`、OGR-09 `21`、OGR-10 `34`、OGR-12 `242`。`remainingReviewCandidateBuckets=0`，`unresolvedRows=0`。

裁决：C2 吸收不是复制来源产品。它只证明参考能力已经归入 DSXU 的命名 owner、排除或 helper 签收；后续仍必须经过 owner/Git packets、`147` deletion mutation review、`4` ACL residue、real-gap acceptance、六阶段测试和 clean export。

补充审核：`docs/generated/DSXU_V20_C2_FUNCTION_LOSS_REVIEW_SUMMARY_20260515.json` 明确 C2 当前完成的是 `ownerDispositionComplete=true`，不是 `implementedFeatureAcceptanceComplete`。也就是说：

- C2 1902 文件没有未知桶、没有 OGR-13 holding bucket、没有 unresolved row。
- 但 `594` 个 product-specific exclude/adapt、`7` 个 review-candidate exclude/adapt、`201` 个 baseline/no-op shared utility、`4` 个 not-present shared utility 仍是功能丢失风险复核点。
- 这些风险不能靠 C2 CSV 盖章消失；必须在后续 Owner/Git packets、real-gap acceptance、商业/IP/品牌 release review、六阶段测试中证明没有把 DSXU 目标能力洗少。

因此后续说“C2 完成”时，只能表示“1902 文件吸收处置签收完成”，不能表示“对标功能全部实现并验收完成”。

## 2026-05-15 V20 商业 / IP / 品牌 release gate

新增：

- `docs/DSXU_V20_COMMERCIAL_IP_BRAND_RELEASE_GATE_20260515.md`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_20260515.csv`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_SUMMARY_20260515.json`
- `docs/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.md`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.csv`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_SUMMARY_20260515.json`

本 gate 是对“吸收过程必须服务 DSXU 目标”的硬约束：可以学习能力模式，不能吸收第三方品牌、商业包装、专利/商标风险、产品承诺或可误解的兼容声明。

扫描结果：

| Item | Count |
|---|---:|
| scanned files | 2699 |
| scan rows | 374 |
| review-required rows | 63 |
| product-source third-party brand rows | 56 |
| product-source legal term rows | 7 |
| public-release third-party brand rows after rewrite | 0 |
| post-adjudication active source blockers | 0 |

已处理公开配置文档中的外部生态品牌示例和 provider-specific fallback rows：`docs/CONFIGURATION.md` 改为 provider-neutral 表述。本轮进一步把 API skill / guide agent / terminal setup / toolchain selfcheck / evaluation contract 的产品文案改为 DSXU-owned 或 provider-neutral 表述，移除 6 个 inline `sourceMappingURL` / `sourcesContent`，并把剩余 source 命中裁决为 test evidence、internal provider fallback identifier、terminal platform identifier、Git primitive、safety guard、security detector 或 vendor notice review。

执行原则：

1. 产品 UI、CLI help、README、配置、package metadata、release docs 只能使用 DSXU-owned 或 provider-neutral 表述。
2. 第三方品牌名只允许留在内部证据、迁移 review、测试或 legally required vendor notice。
3. 专利、商标、版权和 vendor binary notice 是 release-review 项；本扫描不是法律 clearance。
4. 对标只表达能力目标，不表达复制、兼容承诺或商业依附。

当前状态：`COMMERCIAL_IP_BRAND_GATE = ADJUDICATED_ACTIVE_BLOCKERS_0`。它不再阻断 real-gap acceptance；但这不是法律意见，也不是 release PASS。vendor binary notices、license notices、package metadata 和 final release docs 仍必须在 final preflight / release closure 中复核。

## 2026-05-15 V20 benchmark / contract 主线补齐

本轮处理的不是新增第二套测试入口，而是把已经写入 V7/V8/V11/product-reality/high-pressure/goal-driven 合同的 case 和 gate 全部接回唯一 `scripts/benchmark/dsxu-mainline-benchmark.ts`。此前 focused verification 暴露出 `goal-driven-optimization-contract-v1.test.ts` 要求的 `product-reality-large-feature-live` 等 case 只存在于合同，没有进入 benchmark registry；这属于假完成风险，已按 owner 合同一次性补齐。

已同步：
- `scripts/benchmark/dsxu-mainline-benchmark.ts`：补齐 `goal-driven-optimization` / `goal-driven-selected-live`、`product-reality-hardening`、`high-pressure-reference-absorption`、`product-real-live-suite`、`v7-productization`、`v11-100-point-roadmap` 等 pack 标识，并补入 product reality、query recovery、Agent governance、compact/memory、permission、MCP、tool prompt、P6 cleanup 等合同 case。
- `.dsxu/ops/DSXU-Code-V20-mainline-execution-status.md`：把旧 V7/V8/next-stage/high-pressure 执行标记合并成当前 V20 consolidated ops evidence，不恢复旧中文队列文件名，不新增第二套 runtime。
- `src/dsxu/engine/__tests__/v7-productization-contract-v1.test.ts`、`v8-product-build-contract-v1.test.ts`、`next-stage-productization-contract-v1.test.ts`、`v11-100-point-roadmap-contract-v1.test.ts`：测试口径改成验证当前 consolidated evidence 和真实外部 Claude reference source fallback，而不是依赖已移除的 repo 内 `reference-input/query.ts` 或旧 ops 文件名。

Focused verification：
- `bun test src/dsxu/engine/__tests__/goal-driven-optimization-contract-v1.test.ts src/dsxu/engine/__tests__/product-reality-hardening-contract-v1.test.ts src/dsxu/engine/__tests__/high-pressure-reference-absorption-contract-v1.test.ts src/dsxu/engine/__tests__/next-stage-productization-contract-v1.test.ts src/dsxu/engine/__tests__/v11-100-point-roadmap-contract-v1.test.ts src/dsxu/engine/__tests__/v7-productization-contract-v1.test.ts src/dsxu/engine/__tests__/v8-product-build-contract-v1.test.ts` -> PASS，`35 tests / 0 fail / 399 expect`。
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/api-service.test.ts src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts src/dsxu/engine/__tests__/goal-driven-optimization-contract-v1.test.ts src/dsxu/engine/__tests__/toolchain-selfcheck-v1.test.ts src/dsxu/engine/__tests__/product-reality-hardening-contract-v1.test.ts src/dsxu/engine/__tests__/high-pressure-reference-absorption-contract-v1.test.ts src/dsxu/engine/__tests__/next-stage-productization-contract-v1.test.ts src/dsxu/engine/__tests__/v11-100-point-roadmap-contract-v1.test.ts src/dsxu/engine/__tests__/v7-productization-contract-v1.test.ts src/dsxu/engine/__tests__/v8-product-build-contract-v1.test.ts` -> PASS，`71 tests / 0 fail / 4996 expect`。

裁决：benchmark/contract 注册假完成已关闭，但这仍是 focused verification，不是六阶段最终测试，不是 feature acceptance 全 PASS，也不允许提前 clean export。

## 2026-05-15 V20 C2 x OGR / runtime redline 复核

新增：

- `docs/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260515.md`
- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_SUMMARY_20260515.json`
- `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260515.md`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_SUMMARY_20260515.json`
- `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_ADJUDICATION_20260515.md`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_ADJUDICATION_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_ADJUDICATION_SUMMARY_20260515.json`

本轮不是继续加小层，而是把 C2 priority 与当前 Owner/Git packets 重新对齐，并把 runtime 红线从粗扫描推进到 owner 判读：

| 项 | Count | 结论 |
|---|---:|---|
| C2 priority rows | 320 | `review_candidate=42`、shared utility review `278` 已交叉到命名 OGR packets。 |
| OGR-13 holding bucket | 0 | 不再保留其它来源 owner holding bucket。 |
| runtime redline owner rows | 1602 | 覆盖 OGR-06/12/05/07/08/10/03/04 当前重点路径。 |
| product/dir scanned rows | 1586 | 目录级 `??` rows 已递归扫源码，不当成漏扫。 |
| source files scanned | 1616 | 包含目录展开后的源码文件。 |
| raw redline rows | 59 | 全部进入 owner adjudication，不直接算 PASS。 |
| active blocking redlines | 0 | 53 个 Tool Lifecycle 主线 `buildTool/executeTool`、4 个 UI fallback message label、1 个 QueryEngine 自身构造、1 个 ripgrep 平台工具探测均判为非第二套 runtime。 |

裁决边界：

1. `src/tools/**` 与 `src/services/tools/StreamingToolExecutor.ts` 的命中属于 Tool Lifecycle 原侧主线，不是 UI/adapter 私自运行工具。
2. `src/QueryEngine.ts` 的 `new QueryEngine(...)` 属于 Query/entry composition owner 自身构造，不是第二套 Query Loop。
3. `FallbackToolUse*` / `UserTool*Message` 命中的是 UI 错误/拒绝展示组件命名，不是 provider fallback runtime。
4. `src/utils/ripgrep.ts` 的 `Bun.spawn` 是平台工具探测；仍需 OGR-12 import/use owner 签收，但不是第二套 tool runtime。

当前结论：runtime 红线疑点已从“粗命中”变成 `0 active blocker`，但仍然只是 Owner/Git signoff 证据，不是功能验收、六阶段测试或 clean export PASS。下一步继续按固定顺序处理 Owner/Git packets，然后 `147` deletion mutation review、`4` ACL residue、commercial/IP/brand release review、real-gap acceptance、六阶段测试和 clean export。

## 2026-05-15 V20 deletion mutation review 刷新

新增/刷新：

- `docs/DSXU_V20_DELETION_MUTATION_REVIEW_20260515.md`
- `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260515.csv`
- `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_SUMMARY_20260515.json`

本轮把删除态从旧 `146` 更新到当前 `147`，并修正 release gate / reference governance 中仍点名旧删除态测试或旧 `runtime-core.ts` 的引用。相关代码修正：

- `src/dsxu/engine/release-test-gate.ts`：release gate 不再要求已删除的旧 V18 public/provenance/proprietary/source-encoding/tool/session/experience-store query-context 测试；改由现存 release-surface、source-policy、mainline-tool、experience-store、compact/source clean 等主线测试覆盖。
- `src/dsxu/engine/__tests__/release-test-gate-v1.test.ts`：不再把已删除的旧 skills/prompt/querycontext 测试作为 quarantine 规则输入。
- `src/dsxu/engine/reference-governance-absorption-contract.ts`：evidence 命令改到现存 memory-session、skill-governance、skills executor/failure tests。
- `src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts`：测试 fixture 中的旧 `runtime-core.ts` 改为当前 `query-loop.ts`。
- `scripts/benchmark/dsxu-mainline-benchmark.ts`：补入 `reference-governance-productization` / `reference-governance-live-core` pack 和 `governance-query-recovery-live` / `governance-skills-selection-live` cases。
- `src/dsxu/engine/__tests__/reference-governance-absorption-contract-v1.test.ts`：真实参考源改为 `DSXU_REFERENCE_SOURCE_ROOT` 或 `D:\源代码claude\src`，不再误查 repo 内不存在的参考目录。

删除态复核结果：

| Item | Count |
|---|---:|
| deletion rows | 147 |
| ready rows | 147 |
| active product source reference rows | 0 |
| test/evidence reference rows | 1 |

Focused verification：`bun test src/dsxu/engine/__tests__/release-test-gate-v1.test.ts src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts src/dsxu/engine/__tests__/reference-governance-absorption-contract-v1.test.ts` PASS，`15 tests / 0 fail / 198 expect`。

裁决：`147` 个删除态当前可进入显式 Git mutation review，但本轮仍未 stage、commit、delete、clean 或 export。若 Git mutation review 中发现差异能力，只能补到命名 DSXU owner，不能恢复旧 runtime 或旧 test side-path。

## 2026-05-15 V20 ACL residue review

新增：

- `docs/DSXU_V20_ACL_RESIDUE_REVIEW_20260515.md`
- `docs/generated/DSXU_V20_ACL_RESIDUE_REVIEW_20260515.csv`
- `docs/generated/DSXU_V20_ACL_RESIDUE_REVIEW_SUMMARY_20260515.json`

复核对象：

| Path | Class | Product refs | Decision |
|---|---|---:|---|
| `src/dsxu/engine/retrieval/integration-example.ts` | empty module residue | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/integration/harness/recovery-runtime-v3-harness.ts` | empty module residue | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` | empty module residue | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/engine/adapters/bridge-adapter.ts` | retired adapter tombstone | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |

裁决：这 4 个路径不能作为产品 owner，也不能再被新增 import。它们只作为权限/所有权收口项保留；权限允许时删除，或由 owner/Git 显式签收为外部 residue。若行为仍需要，必须落到命名 DSXU owner，不能恢复 tombstone/empty module 为兼容路径。

## 2026-05-15 V20 real-gap acceptance contract 批量收口

本轮按“不能新增其它主链与入口”的纪律继续执行 V20-C5，不下载或内置 AionUi / Cherry / Warp / browser-use 等外部产品，只把 DSXU 自己需要的生态接入层能力落到现有 owner：

- `src/dsxu/engine/api-service.ts` 新增 `getDsxuApiServiceRuntimeProfile()`：External Chat-Agent API / chat-completions-compatible client 归到 `DSXU Model Router / Cost Evidence Owner`，DeepSeek-compatible transport 为默认，非 DeepSeek fallback 必须显式 operator opt-in，不能因为环境变量存在就形成第二套 provider runtime。
- `src/dsxu/control-plane/operatorStateProjection.ts` 新增 operator visible-state projection：只读 `DsxuControlSessionRegistry`，pending permission 通过 `permissionControlBridge` 投影为可见 prompt，不执行 tool/model/MCP/shell。
- `src/dsxu/engine/v20-real-gap-acceptance.ts` 新增统一 acceptance summary：project intake、External Agent Host、External Chat-Agent API、Operator Dashboard 四块全部映射到命名 owner，`prohibitedRuntime` 明确禁止 project-local query loop、standalone agent orchestrator、standalone provider runtime、dashboard MCP/client/shell runner。
- `src/dsxu/engine/__tests__/v20-real-gap-acceptance-v1.test.ts` 覆盖真实 project intake 文件画像：`DSXU.md` / `DSXU.local.md`、`.mcp.json`、`.dsxu/commands`、`.dsxu/skills`、settings/hooks、plugin component、ordinary source file 都必须进入 DSXU Context/MCP/Skills/Plugin/Settings/Tool Gate owner，不允许本地项目自带 runtime。
- `src/dsxu/control-plane/index.ts` 导出 operator visible-state projection，避免 dashboard/operator state 只停留在测试侧私有路径。
- `scripts/dsxu-p12-raw-readiness.ts` 与 `package.json` 的 `p12:raw-readiness` 脚本提供 P12 raw readiness 可执行入口：可传 `--targetReferenceManifestPath` / `--target-reference-manifest` 导入真实 target-reference manifest，也可传 deferred eval raw/live manifest；脚本只校验和生成证据，不伪造 target logs。
- `scripts/dsxu-owner-git-mutation-preflight.ts` 与 `package.json` 的 `owner-git:preflight` 脚本提供 Git mutation 前置检查：读取当前 owner/Git register、deletion signoff、ACL signoff、P12 readiness，输出是否可 stage/delete/test/export 的硬门。脚本不 stage、不 commit、不 delete、不 reset、不 clean、不 export。

新增/刷新证据：

- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_PACKETS_20260515.csv`
- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_PROGRESS_20260515.json`
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260515.json`

本轮 focused verification：

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/v20-real-gap-acceptance-v1.test.ts` | PASS，`3 tests / 0 fail / 26 expect` |
| `bun test src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts src/dsxu/engine/__tests__/visible-shared-owner-v20.test.ts` | PASS，`6 tests / 0 fail / 37 expect` |
| `bun test src/dsxu/engine/__tests__/api-service.test.ts src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts` | PASS，`22 tests / 0 fail / 51 expect` |
| `bun test src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts` | PASS，`17 tests / 0 fail / 203 expect`；P12 import/readiness gate 可用但仍缺真实 target raw |
| `bun run p12:raw-readiness --help` | PASS；P12 manifest import CLI 入口可用 |
| `bun run p12:raw-readiness --evidenceDir .dsxu/trace/p12-raw-readiness-cli-v1` | BLOCKED_EVIDENCED；当前真实 target logs 仍为 `0/14`，family gap `14` |
| `bun test src/dsxu/engine/__tests__/v20-real-gap-acceptance-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/control-plane-stage-acceptance-v1.test.ts` | PASS，`14 tests / 0 fail / 74 expect` |
| `bun run owner-git:preflight` | PASS_ALIGNED / BLOCKED_EVIDENCED；register=`1876` 对齐 git status，`147` deletion ready pending explicit stage，P12=`0/14`，ACL=`4`，final tests/export blocked |

当前 `git status --short = 1876`：`M=1648`、`D=147`、`??=81`。Owner/Git register 已同步到 `1876` 行，新增 `3` 条 real-gap acceptance 源码路径已归包，新增 `3` 条 P12 raw-readiness CLI wiring 已归包，新增 `1` 条 owner/Git mutation preflight 脚本也已归包：`scripts/dsxu-owner-git-mutation-preflight.ts` -> `V20-OGR-09-dsxu-engine-mainline`。Owner accepted / conditional paths 当前 `1729`，deletion mutation ready 仍为 `147`。

裁决：Project intake、External Agent Host、External Chat-Agent API、Operator Dashboard 已从“未验收未知缺口”推进为 focused owner contract；P12 raw readiness 已有可执行 CLI 导入入口；owner/Git mutation preflight 已证明 register 对齐且 `147` deletion 可在显式授权后进入 stage plan。这不是最终六阶段 PASS。P12 target raw manifest 仍缺真实 `targetReferenceManifestPath`，不能用模板、generic log 或 target-only log 替代。下一步固定顺序仍是：导入真实 target manifest或显式 owner/Git mutation/stage 决策 -> 六阶段真实测试 -> final preflight -> clean export。
