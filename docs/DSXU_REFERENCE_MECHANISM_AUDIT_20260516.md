# DSXU Reference Mechanism Audit - 2026-05-16

This is an internal mechanism-level reverse analysis. It scans the 1902 reference source files as product-experience signals only, then maps the useful mechanisms to DSXU-owned DeepSeek-first implementation paths. It does not copy source code, prompts, branding, or commercial behavior.

## Summary

| referenceFileCount | dsxuSourceFileCount | mechanismCount | scenarioCount | v18PassCapabilityLinks | v18DeferredCapabilityLinks |
| --- |--- |--- |--- |--- |--- |
| 1902 |2668 |13 |12 |74 |1 |

Decision counts: {"implemented+tested":9,"needs-live-evidence":2,"implemented+tested-claim-limited":2}.

Scenario decision counts: {"claim-limited":6,"implemented+tested":4,"needs-live-evidence":2}.

## Mechanism Map

| priority | loop | mechanismClass | referenceFiles | owner | decision | v18 | action |
| --- |--- |--- |--- |--- |--- |--- |--- |
| P0 |Goal / Plan / Query Loop |cognitive-workflow: goal, source truth, repair, and recovery |1420 |DSXU Query Loop / Entry Composition |implemented+tested |5 pass / 0 deferred links |把 plan/nextAction/stopCondition 接入同一 work-state timeline，并让长任务恢复后先重建目标快照。 |
| P0 |Visible Work-State Projection |trust-and-visibility: user-visible state, evidence, and release confidence |1471 |UI/TUI Visible-State Projection |implemented+tested |5 pass / 0 deferred links |继续把 Tool/Permission/Agent/MCP evidence 接入 work-state timeline，不只停留在 final report。 |
| P0 |Source Truth / Coding Repair |cognitive-workflow: goal, source truth, repair, and recovery |1734 |Source Truth / Code Repair Owner |implemented+tested |14 pass / 0 deferred links |把 source-truth capsule 从 public challenge 推广到常规 code-mode 修复主线，并加 Read fallback governor。 |
| P0 |Tool Result / Cache Hygiene |deepseek-runtime: model routing, context cache, and cost control |1492 |Context Compiler / Token Firewall / DeepSeek Cache Owner |implemented+tested |5 pass / 0 deferred links |完成 ablation rerun，并把 cache miss attribution 接进 GitHub 图表数据。 |
| P0 |Tool / Permission Lifecycle |execution-boundary: tools, permissions, agents, ecosystem, and external hosts |1179 |Tool Gate / Permission Gate |implemented+tested |4 pass / 0 deferred links |把 permission/tool events 全量投影进 work-state timeline；拒绝、blocked、skipped 都不能被包装为 PASS。 |
| P1 |Terminal / Shell Reliability |execution-boundary: tools, permissions, agents, ecosystem, and external hosts |1586 |Terminal Tool Adapter / Result Pack |needs-live-evidence |12 pass / 0 deferred links |补 terminal reliability live demo，覆盖长命令、失败、超时、恢复、结果包。 |
| P0 |Context / Memory / Recovery |cognitive-workflow: goal, source truth, repair, and recovery |1246 |Context Builder / Recovery Mainline |implemented+tested |4 pass / 0 deferred links |把 compact/resume 后的 source reread 与 cache hygiene 纳入 senior-coding window 验收。 |
| P1 |Agent Orchestration / Parent Evidence |execution-boundary: tools, permissions, agents, ecosystem, and external hosts |732 |Agent Lifecycle |implemented+tested-claim-limited |2 pass / 0 deferred links |补 agent parent/worker evidence pack，并接入 visible-state timeline。 |
| P1 |MCP / Skill Ecosystem |execution-boundary: tools, permissions, agents, ecosystem, and external hosts |965 |MCP / Skill Registry |implemented+tested |1 pass / 0 deferred links |补 Superpowers 作为二级技能包的 priority/conflict/routing 任务卡，但不形成第二 skill runtime。 |
| P0 |DeepSeek Model / Cost / Cache |deepseek-runtime: model routing, context cache, and cost control |1506 |DeepSeek Runtime / Cost Evidence |implemented+tested |8 pass / 0 deferred links |继续同步 public challenge 和 capability cost crosswalk；修正任何把 70 PASS 当作公开90能力的 claim。 |
| P1 |IDE / Remote / External Host Boundary |execution-boundary: tools, permissions, agents, ecosystem, and external hosts |1383 |External Host Adapter Boundary |needs-live-evidence |1 pass / 1 deferred links |补 IDE/API bridge product smoke 与 external adapter visible-state evidence。 |
| P1 |First-Run Trust / Doctor / Secret Safety |trust-and-visibility: user-visible state, evidence, and release confidence |1213 |Install / Auth / Doctor |implemented+tested |1 pass / 0 deferred links |最终 fresh install/help/doctor/provider gate smoke 要检查无 key 泄露和首次 key wizard。 |
| P0 |Telemetry / Evidence / Release Gate |trust-and-visibility: user-visible state, evidence, and release confidence |1070 |Evidence / Benchmark / Release |implemented+tested-claim-limited |12 pass / 0 deferred links |修 capability cost crosswalk 的 PASS 等级，补 public challenge ablation 和 GitHub 数据图。 |

## Mechanism Classes

| mechanismClass | count |
| --- |--- |
| cognitive-workflow: goal, source truth, repair, and recovery |3 |
| trust-and-visibility: user-visible state, evidence, and release confidence |3 |
| deepseek-runtime: model routing, context cache, and cost control |2 |
| execution-boundary: tools, permissions, agents, ecosystem, and external hosts |5 |

## Scenario And Role Absorption Matrix

| role | scenario | decision | deepseekStrategy | missingClosures |
| --- |--- |--- |--- |--- |
| senior feature engineer |AI coding: multi-file feature implementation |claim-limited |Flash max for initial architecture and risk slicing, Flash high for implementation, Pro only after failed verification or high-risk permission evidence. |Telemetry / Evidence / Release Gate: P0 capability acceptance audit; Telemetry / Evidence / Release Gate: P0 public claim guard rewrite; Telemetry / Evidence / Release Gate: P1 GitHub data chart rebuild |
| debugging engineer |AI coding: bugfix with regression guard |claim-limited |Search and diagnostic evidence form source capsule; Flash high repairs; Flash max handles failed verification before Pro admission. |Tool Result / Cache Hygiene: P0 public challenge ablation; Tool Result / Cache Hygiene: P0 tool result preview budget; Tool Result / Cache Hygiene: P1 cache chart data |
| technical lead |Complex task: long-running goal preservation |implemented+tested |Stable goal/plan prefix and dynamic tail keep DeepSeek cache useful while preserving task continuity. | |
| terminal reliability engineer |Terminal operations: command failure and recovery |needs-live-evidence |Bounded command result packs feed Flash max for failure analysis; full logs stay as artifacts. |Terminal / Shell Reliability: P1 long command demo; Terminal / Shell Reliability: P1 timeout/failure recovery demo; Terminal / Shell Reliability: P1 full-log artifact with bounded preview |
| agent lead |Complex task: agent delegation and parent synthesis |claim-limited |Workers return evidence envelopes so parent prompt stays compact and cache-friendly. |Agent Orchestration / Parent Evidence: P1 worker evidence envelope; Agent Orchestration / Parent Evidence: P1 parent synthesis guard; Agent Orchestration / Parent Evidence: P1 no transcript bloat check |
| ecosystem integrator |Ecosystem: MCP/Skill priority and conflict routing |implemented+tested |Skill/MCP results are normalized to DSXU evidence envelopes before entering DeepSeek context. | |
| source-truth engineer |Large repo: source-truth without cache destruction |implemented+tested |Grep/anchor/range Read builds source capsules; full file fallback is bounded and attributed. |Tool Result / Cache Hygiene: P0 public challenge ablation; Tool Result / Cache Hygiene: P0 tool result preview budget; Tool Result / Cache Hygiene: P1 cache chart data |
| release evidence owner |Release: public proof and GitHub claims |claim-limited |Claims cite stable evidence pack, route/cost/cache trace, raw task data, and secret/IP gates. |Telemetry / Evidence / Release Gate: P0 capability acceptance audit; Telemetry / Evidence / Release Gate: P0 public claim guard rewrite; Telemetry / Evidence / Release Gate: P1 GitHub data chart rebuild |
| new user onboarding |First run: DeepSeek key, provider, doctor |implemented+tested |Provider smoke should validate Flash-first routing and avoid logging secrets. | |
| platform integrator |External host: IDE/API/remote boundary |needs-live-evidence |External host calls enter the same DSXU Tool Gate and evidence timeline, not a second orchestrator. |IDE / Remote / External Host Boundary: P1 API bridge smoke; IDE / Remote / External Host Boundary: P1 external adapter permission proof; IDE / Remote / External Host Boundary: P2 IDE extension product boundary |
| DeepSeek runtime engineer |Performance: cost and cache optimization |claim-limited |Stable prefix, route latch, no-Read default, and bounded tool previews improve cost without hiding quality loss. |Tool Result / Cache Hygiene: P0 public challenge ablation; Tool Result / Cache Hygiene: P0 tool result preview budget; Tool Result / Cache Hygiene: P1 cache chart data |
| review lead |Quality: anti-fake completion and evidence discipline |claim-limited |Flash review receives evidence capsules and claim guards, not raw unbounded transcripts. |Telemetry / Evidence / Release Gate: P0 capability acceptance audit; Telemetry / Evidence / Release Gate: P0 public claim guard rewrite; Telemetry / Evidence / Release Gate: P1 GitHub data chart rebuild |

## Unfinished V26 Work

| priority | loop | decision | action | implementationSlices | acceptance |
| --- |--- |--- |--- |--- |--- |
| P0 |Tool Result / Cache Hygiene |implemented+tested |完成 ablation rerun，并把 cache miss attribution 接进 GitHub 图表数据。 |P0 public challenge ablation; P0 tool result preview budget; P1 cache chart data |同题 before/after 显示 cost、toolResultChars、cacheHitRate、scoreFloor；score 不下降才允许写优化卖点。 |
| P1 |Terminal / Shell Reliability |needs-live-evidence |补 terminal reliability live demo，覆盖长命令、失败、超时、恢复、结果包。 |P1 long command demo; P1 timeout/failure recovery demo; P1 full-log artifact with bounded preview |真实 DSXU 窗口能展示 shell state before/after、failureType、recoveryAction、artifact path。 |
| P1 |Agent Orchestration / Parent Evidence |implemented+tested-claim-limited |补 agent parent/worker evidence pack，并接入 visible-state timeline。 |P1 worker evidence envelope; P1 parent synthesis guard; P1 no transcript bloat check |父任务 final 不能引用未验证 worker 成功；子任务 transcript 不进入主线程长上下文。 |
| P1 |IDE / Remote / External Host Boundary |needs-live-evidence |补 IDE/API bridge product smoke 与 external adapter visible-state evidence。 |P1 API bridge smoke; P1 external adapter permission proof; P2 IDE extension product boundary |外部 host 调用仍能看到 permission/cost/evidence；未做 smoke 前不当核心卖点。 |
| P0 |Telemetry / Evidence / Release Gate |implemented+tested-claim-limited |修 capability cost crosswalk 的 PASS 等级，补 public challenge ablation 和 GitHub 数据图。 |P0 capability acceptance audit; P0 public claim guard rewrite; P1 GitHub data chart rebuild |70 PASS 不再等于完整功能 PASS；GitHub 只写真实验收卖点和真实数值。 |

## Claim Rules

- 1902 reference files are evidence of experience-loop density, not license to claim feature parity.
- V18 70 PASS means historical alignment pass; each public claim must still prove DSXU source/test/live/raw/cost/cache evidence.
- DeepSeek optimization must prefer stable prefix, compact source-truth capsule, bounded Read fallback, tool-result preview, and real route/cost/cache trajectory.
- Anything product-specific, branded, voice/buddy/team-like, or external-host-specific must be adapted, excluded, or kept as roadmap unless DSXU has a named owner and live evidence.

## Detailed Mechanisms

### P0 Goal / Plan / Query Loop

- Reference signal files: 1420; top dirs: utils=410, components=244, commands=207, tools=155, services=106, hooks=71, ink=37, bridge=30.
- Mechanism class: cognitive-workflow: goal, source truth, repair, and recovery.
- DSXU owner: DSXU Query Loop / Entry Composition.
- DSXU files existing: 7/7; tests existing: 3/3.
- V18 capability links: S00, C01, C05, C10, C18 (5 pass links, 0 deferred links).
- DeepSeek adaptation: 把目标、计划、当前行动和停止条件压缩进稳定任务状态；DeepSeek Flash 默认执行，复杂规划升 Flash max，不靠 Pro 常驻。
- Reference mechanism: Dense command/session/task state around query entry, plan mode, todos, and status lines.; A task is not just a prompt: it has mode, history, plan slug, current session, and next action..
- Senior-programmer logic: Keep the user goal stable across long turns and compaction.; Turn vague work into an executable plan graph with stop conditions.; Update nextAction only when source/test evidence changes, not after narration.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Represent goal/plan/nextAction as compact stable state, with volatile details in dynamic tail.; Use Flash max for first-turn planning of truly complex tasks, then Flash high for normal coding execution.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 任务目标在每轮都可恢复; 计划变更必须留下状态原因; 下一步动作和停止条件进入 final report.
- Do not copy: 参考产品命令名、品牌 prompt、商业模式字段.
- Implementation slices: P0 timeline goal/plan snapshot; P0 resume goal replay; P1 stop-condition guard.
- Acceptance evidence: real DSXU senior-coding window has goal/plan/current/next events; resume keeps same goal.
- V26 action: 把 plan/nextAction/stopCondition 接入同一 work-state timeline，并让长任务恢复后先重建目标快照。
- Acceptance: 真实 DSXU 复杂任务窗口中，每轮都能看到 goal/plan/currentAction/nextAction/finalEvidence。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=66404; missing explicit evidence paths=0.
- Top reference files: screens/REPL.tsx (1237); main.tsx (899); cli/print.ts (800); components/PromptInput/PromptInput.tsx (715); services/api/claude.ts (682).

### P0 Visible Work-State Projection

- Reference signal files: 1471; top dirs: components=389, utils=363, tools=139, services=106, hooks=104, commands=102, ink=96, bridge=25.
- Mechanism class: trust-and-visibility: user-visible state, evidence, and release confidence.
- DSXU owner: UI/TUI Visible-State Projection.
- DSXU files existing: 6/6; tests existing: 4/4.
- V18 capability links: C02, C03, C04, C15, C16 (5 pass links, 0 deferred links).
- DeepSeek adaptation: 把 DeepSeek route/cost/cache、tool permission、source evidence 统一显示，避免用户只能看到长文本回答。
- Reference mechanism: Many UI components exist to make invisible work observable without exposing full internal transcript.; Status rendering is a product mechanism, not decoration..
- Senior-programmer logic: Make invisible cognitive work visible: current goal, files, tool, permission, cost, failure, recovery.; Show progress without flooding the user with raw transcripts.; Use one projection for TUI, CLI, stream-json, and final report.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Project route/cost/cache/tool/permission/source/recovery events through one DSXU timeline.; Use short visible summaries and evidence ids so UI density does not become token bloat.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 工具、权限、失败、恢复、成本、下一步全部可见; UI 和 final report 使用同一状态投影; 长任务状态可继续操作.
- Do not copy: 参考产品视觉资产、品牌 UI 文案、语音/伙伴形象.
- Implementation slices: P0 tool/permission timeline event wiring; P1 agent/MCP timeline event wiring; P1 stream-json parity.
- Acceptance evidence: TUI/CLI/stream-json/final report render same event ids; permission/cost/failure are visible.
- V26 action: 继续把 Tool/Permission/Agent/MCP evidence 接入 work-state timeline，不只停留在 final report。
- Acceptance: TUI/CLI/stream-json/final report 四端字段一致，side-effect 无权限不可 READY。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=47596; missing explicit evidence paths=0.
- Top reference files: utils/messages.ts (1700); screens/REPL.tsx (1276); utils/sessionStorage.ts (760); cli/print.ts (724); services/api/claude.ts (499).

### P0 Source Truth / Coding Repair

- Reference signal files: 1734; top dirs: utils=564, components=321, commands=207, tools=184, services=130, hooks=74, ink=60, bridge=26.
- Mechanism class: cognitive-workflow: goal, source truth, repair, and recovery.
- DSXU owner: Source Truth / Code Repair Owner.
- DSXU files existing: 6/6; tests existing: 4/4.
- V18 capability links: A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A15 (14 pass links, 0 deferred links).
- DeepSeek adaptation: DeepSeek 前缀缓存要求输入稳定，因此 source truth 必须被编译成 capsule；全文 Read 只能是范围化 fallback。
- Reference mechanism: File tools, search tools, edit tools, diagnostics, and git/diff tools are separate but composable.; The useful pattern is source-truth locality and verification, not any proprietary edit code..
- Senior-programmer logic: Search before Read, anchor before range, range before full file.; Patch only after the owner and source truth are known.; Focused verification is part of the repair loop, not a final optional step.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Compile source-truth capsules before model review; include path/hash/anchors/excerpts/risk tags.; Fallback Read must be range-limited and justified by missing capsule coverage.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 先搜索定位再范围读取; 重复读取去重; patch 前后都必须有 focused verification; 失败要回到 source truth 而不是空转复跑.
- Do not copy: 参考产品私有文件格式、内部 prompt、商业编辑策略名.
- Implementation slices: P0 capsule in code-mode; P0 Read fallback governor; P1 source-overlap memory reread smoke.
- Acceptance evidence: source capsule ids cited by final report; focused tests pass after patch.
- V26 action: 把 source-truth capsule 从 public challenge 推广到常规 code-mode 修复主线，并加 Read fallback governor。
- Acceptance: 复杂代码任务默认 search -> anchor/range read -> patch -> focused test；全文件 Read 必须带 fallback reason 和预算。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=59198; missing explicit evidence paths=0.
- Top reference files: utils/attachments.ts (703); utils/sessionStorage.ts (643); utils/fileHistory.ts (517); tools/FileReadTool/FileReadTool.ts (473); main.tsx (464).

### P0 Tool Result / Cache Hygiene

- Reference signal files: 1492; top dirs: utils=564, components=292, tools=184, services=130, commands=86, ink=45, hooks=44, bridge=25.
- Mechanism class: deepseek-runtime: model routing, context cache, and cost control.
- DSXU owner: Context Compiler / Token Firewall / DeepSeek Cache Owner.
- DSXU files existing: 5/6; tests existing: 4/4.
- V18 capability links: M06, C07, C08, C09, C16 (5 pass links, 0 deferred links).
- DeepSeek adaptation: 把稳定前缀、动态尾部、source capsule、tool preview、trajectory attribution 绑定，尽量提高 DeepSeek cache 命中并保留真实数值。
- Reference mechanism: Tool results are budgeted, deduplicated, compacted, and sometimes persisted outside the prompt.; Cache latches and stable sections protect warm-cache behavior from mid-session setting drift..
- Senior-programmer logic: Treat tool output as evidence, not conversation filler.; Persist or preview large results, then feed compact facts to the model.; Keep stable prefix stable so repeated review work gets cache benefit.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Put stable instructions and source capsules before dynamic findings; keep system/tool profile latched.; Persist large tool outputs and feed only preview/key facts, preserving DeepSeek prefix cache.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 大工具结果预览/落盘; microcompact 清旧工具结果; cache latch 避免 mid-session profile 漂移; cache miss attribution 解释为什么没命中.
- Do not copy: 参考产品特定 cache header、商业实验开关名.
- Implementation slices: P0 public challenge ablation; P0 tool result preview budget; P1 cache chart data.
- Acceptance evidence: toolResultChars reduced without scoreFloor regression; uniqueSystemHashes=1 for public challenge run.
- V26 action: 完成 ablation rerun，并把 cache miss attribution 接进 GitHub 图表数据。
- Acceptance: 同题 before/after 显示 cost、toolResultChars、cacheHitRate、scoreFloor；score 不下降才允许写优化卖点。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=30289; missing explicit evidence paths=1.
- Top reference files: services/compact/compact.ts (595); services/mcp/auth.ts (486); services/api/claude.ts (468); utils/analyzeContext.ts (422); utils/auth.ts (373).

### P0 Tool / Permission Lifecycle

- Reference signal files: 1179; top dirs: utils=305, commands=207, components=205, tools=184, services=81, hooks=35, bridge=31, skills=16.
- Mechanism class: execution-boundary: tools, permissions, agents, ecosystem, and external hosts.
- DSXU owner: Tool Gate / Permission Gate.
- DSXU files existing: 6/6; tests existing: 4/4.
- V18 capability links: C04, C11, B04, B07 (4 pass links, 0 deferred links).
- DeepSeek adaptation: 权限不交给模型凭感觉判断；模型只看到结构化 permission evidence，真实执行仍走 DSXU Tool Gate。
- Reference mechanism: Permission logic is repeated across bridge, tools, UI, and session state so side effects are explicit.; The mechanism is lifecycle accountability: request, user decision, execution, and result..
- Senior-programmer logic: Convert tool execution into purpose, risk, permission, result, and recovery.; A rejected permission is still useful state, not a hidden failure.; Never let adapters bypass the single Tool Gate.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Expose permission decisions as structured model-visible evidence after user/tool gate resolution.; Do not let the model infer permissions from natural language alone.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 权限请求必须说明目的、风险和结果; 工具执行状态进入 UI; 拒绝后给可恢复路径.
- Do not copy: 参考产品权限文案、品牌安全策略名.
- Implementation slices: P0 blocked/skipped permission projection; P0 side-effect no-permission negative test; P1 adapter evidence parity.
- Acceptance evidence: side-effect blocked without permission; permission denial has recovery nextAction.
- V26 action: 把 permission/tool events 全量投影进 work-state timeline；拒绝、blocked、skipped 都不能被包装为 PASS。
- Acceptance: side-effect tool 无 visible permission 时 guard 阻断；用户能看到拒绝后下一步。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=55159; missing explicit evidence paths=0.
- Top reference files: utils/messages.ts (1071); services/tools/toolExecution.ts (796); screens/REPL.tsx (785); utils/permissions/permissions.ts (666); cli/print.ts (615).

### P1 Terminal / Shell Reliability

- Reference signal files: 1586; top dirs: utils=564, components=221, commands=207, tools=184, services=130, ink=71, hooks=69, bridge=24.
- Mechanism class: execution-boundary: tools, permissions, agents, ecosystem, and external hosts.
- DSXU owner: Terminal Tool Adapter / Result Pack.
- DSXU files existing: 4/4; tests existing: 3/3.
- V18 capability links: B01, B02, B03, B05, B06, B08, B09, B10, B11, B12, B13, B14 (12 pass links, 0 deferred links).
- DeepSeek adaptation: Shell 输出必须先结构化摘要，再给模型；长输出落盘并带 preview，避免破坏 DeepSeek 前缀缓存。
- Reference mechanism: Terminal reliability is a full loop: command construction, process handling, output shaping, and failure semantics.; Raw terminal text is transformed into usable task evidence..
- Senior-programmer logic: Before command: capture environment, purpose, timeout, risk, and expected proof.; After command: capture exit code, key lines, file delta, failure type, and next repair.; Avoid pushing full stdout/stderr into the model when a structured result pack is enough.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Summarize stdout/stderr into bounded result packs; store full logs as artifacts.; Route failure analysis to Flash max before Pro unless high-risk side effects require Pro admission.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 命令前风险/目的/环境快照; 命令后退出码、关键行、文件 delta、失败分类; 超时和重试预算可见.
- Do not copy: 参考产品终端 UI 细节、私有 shell telemetry.
- Implementation slices: P1 long command demo; P1 timeout/failure recovery demo; P1 full-log artifact with bounded preview.
- Acceptance evidence: long output stored as artifact with bounded preview; timeout/failure classified and recovered.
- V26 action: 补 terminal reliability live demo，覆盖长命令、失败、超时、恢复、结果包。
- Acceptance: 真实 DSXU 窗口能展示 shell state before/after、failureType、recoveryAction、artifact path。
- Claim risk: Code/test exists, but live DSXU window or product smoke evidence is still required before public claim. DSXU signal hits=22914; missing explicit evidence paths=0.
- Top reference files: utils/hooks.ts (565); tools/BashTool/bashSecurity.ts (334); utils/bash/ast.ts (320); tools/BashTool/bashPermissions.ts (282); tools/PowerShellTool/PowerShellTool.tsx (280).

### P0 Context / Memory / Recovery

- Reference signal files: 1246; top dirs: utils=326, commands=207, components=201, services=130, tools=102, hooks=67, ink=39, bridge=29.
- Mechanism class: cognitive-workflow: goal, source truth, repair, and recovery.
- DSXU owner: Context Builder / Recovery Mainline.
- DSXU files existing: 5/5; tests existing: 5/5.
- V18 capability links: C13, C14, C17, C18 (4 pass links, 0 deferred links).
- DeepSeek adaptation: 记忆只做只读缩窄和恢复提示，不能替代 source truth；compact 后第一轮要重建稳定前缀和 source anchors。
- Reference mechanism: Session, history, compact, resume, project identity, and memory state are first-class.; Recovery is designed as a continuation of the same task, not a new chat restart..
- Senior-programmer logic: Memory narrows exploration but never replaces source truth.; Resume must restore goal, touched files, failed command, risk, and next step.; After compaction, first rebuild source anchors and cache hygiene before acting.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: After compact/resume, regenerate stable source anchors and cache boundary evidence.; Use local memory only as retrieval hints, never as a replacement for file truth.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: resume 后保留目标、失败命令、文件风险; memory 必须有来源、时间、置信度; source overlap 时强制重读.
- Do not copy: 参考产品会话格式、专有记忆文件名.
- Implementation slices: P0 compact/resume source reread; P1 long-task recovery replay; P1 memory confidence display.
- Acceptance evidence: compact/resume replay keeps files/risk/failed command; memory overlap forces reread.
- V26 action: 把 compact/resume 后的 source reread 与 cache hygiene 纳入 senior-coding window 验收。
- Acceptance: 恢复任务不能丢 goal/files/failed command/risk；memory 不能绕过源码重读。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=44083; missing explicit evidence paths=0.
- Top reference files: utils/sessionStorage.ts (1074); bridge/bridgeMain.ts (894); main.tsx (712); screens/REPL.tsx (704); services/compact/compact.ts (541).

### P1 Agent Orchestration / Parent Evidence

- Reference signal files: 732; top dirs: utils=222, components=140, tools=100, services=69, commands=32, hooks=29, bridge=20, skills=15.
- Mechanism class: execution-boundary: tools, permissions, agents, ecosystem, and external hosts.
- DSXU owner: Agent Lifecycle.
- DSXU files existing: 5/5; tests existing: 3/3.
- V18 capability links: PZ07, C12 (2 pass links, 0 deferred links).
- DeepSeek adaptation: Agent 返回 summary/path/hash/evidence，不回灌长 transcript；父任务合成时保持 DeepSeek stable prefix。
- Reference mechanism: Agents have identity, color/state, lifecycle, parent-child lineage, and preserved skills.; Parallelism is valuable only when the parent can safely integrate bounded evidence..
- Senior-programmer logic: Delegate only bounded sidecar work with clear ownership.; Workers return summary/path/hash/evidence, not unbounded transcript.; The parent remains responsible for final synthesis and verification.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Subagents return compressed evidence objects; parent context receives stable summaries only.; Keep ownership disjoint so parallel work does not create duplicate runtimes.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 并行只给边界清晰的 sidecar work; 父任务必须引用子任务 evidence; worker 输出不直接污染主上下文.
- Do not copy: 参考产品 agent 名称、团队/角色品牌设定.
- Implementation slices: P1 worker evidence envelope; P1 parent synthesis guard; P1 no transcript bloat check.
- Acceptance evidence: parent cites worker evidence ids; worker transcript not injected into parent prompt.
- V26 action: 补 agent parent/worker evidence pack，并接入 visible-state timeline。
- Acceptance: 父任务 final 不能引用未验证 worker 成功；子任务 transcript 不进入主线程长上下文。
- Claim risk: Implementation exists, but public copy must be constrained to subset/adapted behavior. DSXU signal hits=39136; missing explicit evidence paths=0.
- Top reference files: tools/AgentTool/AgentTool.tsx (821); utils/tasks.ts (589); main.tsx (556); utils/swarm/inProcessRunner.ts (544); utils/sessionStorage.ts (512).

### P1 MCP / Skill Ecosystem

- Reference signal files: 965; top dirs: utils=267, commands=207, components=150, services=87, tools=75, hooks=40, bridge=22, skills=20.
- Mechanism class: execution-boundary: tools, permissions, agents, ecosystem, and external hosts.
- DSXU owner: MCP / Skill Registry.
- DSXU files existing: 6/6; tests existing: 4/4.
- V18 capability links: C06 (1 pass links, 0 deferred links).
- DeepSeek adaptation: 生态能力只通过 DSXU-owned registry 调度；skills/MCP 结果先结构化、授权、预算化，再给 DeepSeek。
- Reference mechanism: MCP, plugins, skills, hooks, resources, and commands share registry-like surfaces.; The mechanism is controlled extensibility with permission and conflict boundaries..
- Senior-programmer logic: Skills/MCP are capability extensions, not parallel product runtimes.; Resolve priority and conflicts before exposing tool choices to the model.; Every external capability inherits DSXU permission and evidence rules.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Normalize MCP/skill outputs to DSXU evidence envelopes with permission, cost, secret redaction, and conflict metadata.; Superpowers-like packs can be secondary skills, never a second dispatcher.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 技能选择、优先级和冲突规则; secret redaction 和 doctor; 外部 server 只作为 adapter boundary.
- Do not copy: 参考产品 marketplace 文案、第三方品牌承诺、插件商业策略.
- Implementation slices: P1 secondary skill priority rules; P1 MCP doctor evidence envelope; P1 secret redaction smoke.
- Acceptance evidence: conflicting skills resolve by priority; MCP outputs include secret redaction and permission evidence.
- V26 action: 补 Superpowers 作为二级技能包的 priority/conflict/routing 任务卡，但不形成第二 skill runtime。
- Acceptance: 冲突时可解释选择/拒绝；MCP/skill 接入仍走 Tool Gate。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=36237; missing explicit evidence paths=0.
- Top reference files: commands/plugin/ManagePlugins.tsx (1337); utils/plugins/pluginLoader.ts (1135); services/mcp/client.ts (1057); services/mcp/config.ts (1018); cli/print.ts (881).

### P0 DeepSeek Model / Cost / Cache

- Reference signal files: 1506; top dirs: utils=564, components=301, services=130, tools=120, commands=105, hooks=59, ink=46, bridge=28.
- Mechanism class: deepseek-runtime: model routing, context cache, and cost control.
- DSXU owner: DeepSeek Runtime / Cost Evidence.
- DSXU files existing: 5/5; tests existing: 4/4.
- V18 capability links: M01, M02, M03, M06, M07, C09, C16, A14 (8 pass links, 0 deferred links).
- DeepSeek adaptation: Flash-first 是产品核心；普通 coding/bugfix 默认 Flash thinking high，review/recovery Flash max，Pro 只由 admission evidence 触发，FIM 独立 Flash non-thinking lane。
- Reference mechanism: Cost, tokens, cache, request ids, and usage attribution live in session state and reporting paths.; The mechanism is continuous cost awareness, not only post-hoc billing..
- Senior-programmer logic: Use Flash as the default working model, not a cheap fallback.; Escalate to Flash max or Pro only with route evidence.; Separate cache hit, cache miss, output, route reason, and admission evidence.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Route table: Flash high for coding/bugfix, Flash max for planning/review/recovery, Pro for explicit high-risk/failed-verification admission, FIM Flash non-thinking only for small completion lane.; Report cache hit/miss/output tokens and cost per solved task as product metrics.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 成本/usage 按任务归因; cache read/miss/output token 拆开; 模型升级要有理由.
- Do not copy: 参考产品模型名、商业限额逻辑、供应商私有 header.
- Implementation slices: P0 route latch regression; P0 Flash-first live route sample; P1 Pro admission negative/positive pack.
- Acceptance evidence: default route uses deepseek-v4-flash; Pro appears only with admission evidence; cache/cost tokens reported.
- V26 action: 继续同步 public challenge 和 capability cost crosswalk；修正任何把 70 PASS 当作公开90能力的 claim。
- Acceptance: 所有公开成本卖点都有 route/cost/cache trajectory；默认大部分使用 deepseek-v4-flash。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=45837; missing explicit evidence paths=0.
- Top reference files: services/api/claude.ts (1119); utils/auth.ts (655); services/mcp/auth.ts (496); main.tsx (459); utils/analyzeContext.ts (456).

### P1 IDE / Remote / External Host Boundary

- Reference signal files: 1383; top dirs: utils=400, components=237, commands=207, tools=117, services=105, hooks=67, ink=59, bridge=31.
- Mechanism class: execution-boundary: tools, permissions, agents, ecosystem, and external hosts.
- DSXU owner: External Host Adapter Boundary.
- DSXU files existing: 5/5; tests existing: 3/3.
- V18 capability links: PZ03, PZ06 (1 pass links, 1 deferred links).
- DeepSeek adaptation: IDE/API/remote 只做 DSXU adapter boundary，不能绕过 query loop、Tool Gate、cost evidence。
- Reference mechanism: Bridge/transport/remote files indicate external host integration is isolated behind protocols.; The useful idea is boundary discipline: host events enter the same session model..
- Senior-programmer logic: External hosts are adapter boundaries, not new orchestrators.; Remote/IDE events must project into the same permission/cost/evidence state.; Handshake and secret boundaries are release gates.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: External host calls become Tool Gate events with route/cost/cache evidence.; Do not let IDE/API bridge start a second agent or permission runtime.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 远程/IDE 状态有 handshake、权限和结果投影; host adapter 不成为第二 runtime.
- Do not copy: 参考产品远程服务、认证协议、商业 bridge 文案.
- Implementation slices: P1 API bridge smoke; P1 external adapter permission proof; P2 IDE extension product boundary.
- Acceptance evidence: external trigger produces Tool Gate event; no second runtime entrypoint.
- V26 action: 补 IDE/API bridge product smoke 与 external adapter visible-state evidence。
- Acceptance: 外部 host 调用仍能看到 permission/cost/evidence；未做 smoke 前不当核心卖点。
- Claim risk: Code/test exists, but live DSXU window or product smoke evidence is still required before public claim. DSXU signal hits=32529; missing explicit evidence paths=0.
- Top reference files: bridge/replBridge.ts (558); main.tsx (491); screens/REPL.tsx (417); services/mcp/client.ts (356); utils/ide.ts (351).

### P1 First-Run Trust / Doctor / Secret Safety

- Reference signal files: 1213; top dirs: utils=325, components=235, commands=207, services=130, tools=74, hooks=59, ink=35, bridge=24.
- Mechanism class: trust-and-visibility: user-visible state, evidence, and release confidence.
- DSXU owner: Install / Auth / Doctor.
- DSXU files existing: 4/5; tests existing: 1/2.
- V18 capability links: E06 (1 pass links, 0 deferred links).
- DeepSeek adaptation: 首次使用必须安全填写 DeepSeek key；release pack 不能泄露 key，provider gate 要能解释 Flash-first 策略。
- Reference mechanism: Setup, auth, trusted device, onboarding, config, and diagnostics form a first-run trust loop.; The user is guided to a working environment before complex tasks begin..
- Senior-programmer logic: First run must quickly establish key, provider, workspace, and release trust.; Doctor output should be actionable and safe, not just diagnostic text.; Secrets must be excluded from release artifacts and evidence packs.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: First run collects DeepSeek key safely and validates provider route without writing secrets into release artifacts.; Doctor should output route policy, cache/cost readiness, and recoverable setup issues.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 安装后即能自检; secret redaction 是 release gate; provider/key 错误有恢复路径.
- Do not copy: 参考产品账号体系、遥测服务、品牌授权流.
- Implementation slices: P1 no-key first run smoke; P1 secret scan release gate; P1 provider gate recovery copy.
- Acceptance evidence: release artifact has no key; first run/provider doctor recovers no-key setup.
- V26 action: 最终 fresh install/help/doctor/provider gate smoke 要检查无 key 泄露和首次 key wizard。
- Acceptance: 发布包不含用户 key；首次运行能引导 DEEPSEEK_API_KEY；doctor 输出可恢复建议。
- Claim risk: Can support DSXU-owned internal/release evidence; public 90 claim still requires public challenge raw proof. DSXU signal hits=21340; missing explicit evidence paths=2.
- Top reference files: utils/auth.ts (725); services/mcp/auth.ts (627); utils/plugins/installedPluginsManager.ts (321); commands/install-github-app/install-github-app.tsx (320); main.tsx (305).

### P0 Telemetry / Evidence / Release Gate

- Reference signal files: 1070; top dirs: utils=564, commands=207, services=130, tools=38, components=32, ink=19, .=13, hooks=11.
- Mechanism class: trust-and-visibility: user-visible state, evidence, and release confidence.
- DSXU owner: Evidence / Benchmark / Release.
- DSXU files existing: 5/5; tests existing: 3/3.
- V18 capability links: A16, A17, E01, E02, E03, E04, E05, E06, E07, R03, R07, R08 (12 pass links, 0 deferred links).
- DeepSeek adaptation: 所有 public claim 必须绑定 raw task、route/cost/cache、failure/recovery、source/test/live evidence；不能用映射完成替代能力完成。
- Reference mechanism: Telemetry, cost hooks, traces, status, release commands, and reports connect product behavior to proof.; The mechanism is claim discipline: what happened, what it cost, what evidence supports it..
- Senior-programmer logic: Evidence is a product feature: raw trace, cost, cache, failures, recovery, and claims all share lineage.; Separate internal pass, release candidate, and public benchmark claim.; Never let mapping completeness replace real public task proof.; Observe: gather the smallest source-truth signal that can answer the next question.; Orient: decide owner, risk, blast radius, and what evidence is needed before changing behavior.; Decide: choose one mainline action, not a compatibility holding path.; Act: execute through the named DSXU owner and keep side effects attributable.; Verify: run focused proof, record failure/recovery, and expose next action..
- DeepSeek rebuild plan: Every public claim must point to raw task, DSXU live transcript, route/cost/cache trace, source/test evidence, and release gate status.; Publish real before/after charts and blocked claims, not inflated parity language.; Use DSXU-owned source/test/live evidence; do not copy reference code, prompt, brand, or private service behavior.; Keep Flash as the default route; use Pro only when admission evidence is explicit..
- Absorb: 证据同源; claim guard; benchmark 和 release 分开; 没有 raw 对照就不宣称外部胜出.
- Do not copy: 参考产品榜单表述、商业宣传 claim、未授权 benchmark 名义.
- Implementation slices: P0 capability acceptance audit; P0 public claim guard rewrite; P1 GitHub data chart rebuild.
- Acceptance evidence: GitHub claims cite source/test/live/raw evidence; blocked claims remain visible.
- V26 action: 修 capability cost crosswalk 的 PASS 等级，补 public challenge ablation 和 GitHub 数据图。
- Acceptance: 70 PASS 不再等于完整功能 PASS；GitHub 只写真实验收卖点和真实数值。
- Claim risk: Implementation exists, but public copy must be constrained to subset/adapted behavior. DSXU signal hits=12843; missing explicit evidence paths=0.
- Top reference files: utils/telemetry/instrumentation.ts (187); utils/telemetry/perfettoTracing.ts (98); utils/telemetry/sessionTracing.ts (75); utils/releaseNotes.ts (56); hooks/useVoice.ts (51).
