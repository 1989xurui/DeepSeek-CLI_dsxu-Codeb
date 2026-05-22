# DSXU Code V1 Core Execution Plan

Date: 2026-05-18
Scope: core capability only. Commercial/IP cleanup, public release, open-source packaging, and marketing claims are explicitly out of scope for this V1.

## Target

Build DSXU into a DeepSeek V4 Flash / Flash max-effort / Pro hybrid coding and long-running task tool that feels trustworthy to senior engineers.

The goal is not to add more scattered modules. The goal is to make the existing strong pieces enter one default runtime chain:

```text
Model route -> runtime event -> tool result -> permission -> edit lifecycle -> verify/review/rollback -> ledger -> evidence
```

## Real Audit Summary

Commands run during this audit:

| Command | Result |
| --- | --- |
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts` | PASS, 5 tests |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | PASS, 9 tests |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS, scoreFloor 72, evidence files 123, passing gates 37, parse errors 0 |
| `bun run scripts/dsxu-swe-bench-runner.ts --instances "mock-001,mock-002" --timeout 60000` | PASS, internal smoke 2/2 |
| `bun test` | DID NOT NATURALLY FINISH within 5 minutes; process was stopped after timeout |
| `bun run test:six-stage-final` | DID NOT NATURALLY FINISH within 3 minutes; process was stopped after timeout |
| `bun run acceptance:senior-coding-window` | DID NOT NATURALLY FINISH within 3 minutes; process was stopped after timeout |
| `bun run evidence:dashboard` | FAIL, package script missing |

Current judgment:

| Capability | Exists? | Complete? | Audit result |
| --- | --- | --- | --- |
| Runtime Event Schema | Yes | No | `DSXUWorkStateEvent` exists, but it is not yet the single runtime ledger event for tools, model routing, permission, verification, recovery, and cost |
| Tool Result Contract | Yes | No | `ToolCallResult` exists, but legacy `content/isError`, provider tool_result blocks, MCP result shapes, and runtime result types still coexist |
| Verified Edit Lifecycle | Partial | No | Write/Edit call TDD and static analysis hooks, but both are env-gated and rollback is not consistently automatic |
| Mainline Tests | Yes | No | Targeted tests pass; full suite does not complete in the audit window, so mainline trust is not established |
| Long Task Ledger | Partial | No | `progress-ledger`, DAG persist, checkpoints, and session checkpoints exist, but not one durable task ledger |
| Stall + Recovery | Partial | No | Duplicate tool-call storm gate and recovery planners exist, but no single default stall decision table |
| Evidence Workbench | Partial | No | Evidence dashboard exists as a script; it is not yet the everyday operator trust surface |

## 2026-05-18 追加真实审核口径

本节用于回答："上面的判断是否真实审核过代码？"

结论：是基于真实代码检索和关键主链文件读取得出的，但不是声称已经逐行人工读完整个仓库。已审核范围覆盖 DSXU 作为 AI 编程与长时间复杂任务执行工具的核心路径：Prompt 产品纪律、工具结果协议、Write/Edit 后验证、静态分析门、任务账本、压缩恢复、批量工具 gate、GearBox/Recovery、Agent handoff、Evidence dashboard、SWE-bench smoke 边界、package scripts、DeepSeek thinking/model route 相关代码。

| 审核主题 | 已核验代码位置 | 已确认事实 | V1 判断 |
| --- | --- | --- | --- |
| Prompt 产品纪律 | `src/constants/prompts.ts` | 存在 `DSXU_DEEPSEEK_TOOL_USE_FEW_SHOT_GUIDANCE`、`DSXU_PROMPT_GOVERNANCE_CONTRACT`、`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`、DeepSeek V4 模型提示。Prompt 纪律已经很厚。 | V1 不继续堆 prompt。改为 Prompt Diet + Runtime State Card。 |
| 工具结果协议 | `src/dsxu/engine/tool-protocol.ts`、`src/services/tools/toolExecution.ts`、`src/dsxu/engine/tool-types-v1.ts` | `ToolCallResult`、`ToolEvent`、`ToolCallRequest` 已存在；同时 legacy `content/isError`、provider `tool_result`、MCP/runtime 结果形态仍并存。 | V1 必须统一 canonical tool result。 |
| Write/Edit 验证链 | `src/tools/FileEditTool/FileEditTool.ts`、`src/tools/FileWriteTool/FileWriteTool.ts`、`src/coordinator/tdd-gate/post-write-hook.ts`、`src/services/static-analysis/tool-gate.ts` | FileEdit/FileWrite 已调用 `invokeStaticAnalysisToolGate` 与 `invokePostWriteTddGate`；TDD hook 默认由 `DSXU_TDD_POST_WRITE_GATE` 开关决定；SAST gate 默认由 `DSXU_STATIC_ANALYSIS_TOOL_GATE` 开关决定。 | V1 要把它变成默认可见、风险阻断，而不是隐藏 env 功能。 |
| 回滚与验证语义 | `src/dsxu/engine/post-mutation-verification-envelope.ts`、`src/dsxu/engine/code-mode-surgical-loop.ts`、`src/dsxu/engine/adapters/file-edit-adapter.ts` | 存在 rollback availability/envelope；部分路径仍是 `snapshot-suggestion-only`，自动回滚不是全局默认。 | V1 只做安全回滚/显式回滚任务，不做危险全局回滚。 |
| 任务账本与恢复 | `src/dsxu/engine/progress-ledger.ts`、`src/dsxu/engine/query-loop.ts`、`src/dsxu/engine/session.ts`、`src/dsxu/engine/task-control-plane.ts`、`src/coordinator/dag/persist.ts` | ledger、checkpoint、session snapshot、DAG persist 都存在，但不是一个统一 durable task ledger。 | V1 做薄版统一账本，不新增复杂大系统。 |
| 压缩/恢复可信边界 | `src/services/compact/prompt.ts`、`src/dsxu/engine/system-prompt.ts`、`src/dsxu/engine/task-governance.ts` | compact summary 明确要求 `Task-State Snapshot`，且声明 snapshot 只是 navigation，不能作为 PASS evidence。 | V1 要把这个从 prompt 规则升级为 runtime final/edit gate。 |
| 工具批量 gate 与 stall | `src/services/tools/dsxuToolBatchGate.ts`、`src/dsxu/engine/query-loop-gate-state-v1.ts` | 已有 repeated semantic tool gate、read cache gate、post-pass tool block、repeated failed verification block、unsafe same-batch verification block 等。 | V1 不新增更多 gate，而是收敛成统一 decision table。 |
| GearBox/Recovery | `src/dsxu/engine/gear-box.ts`、`src/dsxu/engine/failure-taxonomy.ts`、`src/dsxu/engine/recovery/*` | 已有 retry/replan/rollback/ask-human/abort 决策与齿轮切换。 | V1 要让每次切换有 ledger event 和证据原因。 |
| Agent handoff | `src/tools/AgentTool/prompt.ts`、`src/tools/AgentTool/built-in/verificationAgent.ts`、`src/tools/AgentTool/agentToolUtils.ts` | Agent prompt 已要求 serial worker / parallel fanout、handoff package、owned files、allowed tools、verification evidence、`VERDICT: PASS/FAIL/PARTIAL`。 | V1 只做 runtime schema 校验，不新增 swarm/多层团队模式。 |
| Evidence dashboard | `scripts/dsxu-evidence-dashboard.ts`、`scripts/dsxu-swe-bench-runner.ts`、`src/services/eval/swe-bench/runner.ts` | Dashboard 可运行；SWE runner 默认 `internal-smoke`，`publicBenchmarkClaimAllowed=false`。 | V1 做任务证据包和脚本入口，不把 smoke 当公开成绩。 |
| package scripts | `package.json` | `test:six-stage-final` 与 `acceptance:senior-coding-window` 存在；`evidence:dashboard` 和 `benchmark:swe-bench` 未在 scripts 中找到。 | V1 P0 先补验证入口，否则执行链不可复现。 |
| DeepSeek thinking/model route | `src/constants/prompts.ts`、`src/query.ts`、`src/bootstrap/state.ts`、`src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts`、`scripts/dsxu-v24-senior-coding-window.ts` | 已有 DeepSeek V4 Flash/Pro 文案、thinking config、thinking clear latch、reasoning_content 相关测试迹象；仍需 provider 合同测试证明多轮 tool call projection 完整。 | V1 P0 保留 DeepSeek Thinking + Tool Message Projection。 |

未声称的内容：

1. 未声称 `bun test` 已全绿。当前真实结论是 targeted tests 通过，full suite 在审计窗口内未自然结束。
2. 未声称 SWE-bench 有公开正式成绩。当前真实结论是 internal smoke 通过，不能用于公开 benchmark claim。
3. 未声称 DSXU 已经达到 90+。V1 目标是先修默认主链和证据链，让分数提升有真实依据。
4. 未声称所有功能都要进入 V1。弱模型路线下，V1 必须收敛，不要继续加复杂模块。

## Official DeepSeek Facts That Change V1

Verified from official DeepSeek API docs on 2026-05-18:

| Fact | V1 impact |
| --- | --- |
| Official models are `deepseek-v4-flash` and `deepseek-v4-pro` | Do not advertise Flash-MAX as an official model unless DSXU defines it as a gateway alias |
| `deepseek-v4-flash` and `deepseek-v4-pro` have 1M context and maximum 384K output in the pricing/model table | Stop assuming 128K for V4 Flash; use provider metadata/config and keep old 64K/128K values only for legacy model names |
| Thinking mode defaults to enabled; `reasoning_effort` supports `high` and `max` | "推理前缀" is not the main model补丁 anymore; the runtime must preserve and route native thinking correctly |
| Thinking mode ignores temperature/top_p/presence/frequency penalties | Benchmark/test configs should not rely on temperature for thinking-mode determinism |
| With tool calls in thinking mode, `reasoning_content` must be passed back in subsequent requests or the API can return 400 | The highest priority model-provider work is message projection correctness, especially assistant reasoning + tool_calls + tool results |
| Context caching is enabled by default and cache hit tokens are reported | Cache warmer should focus on stable prefix discipline and measurement, not pretending cache requires a custom API feature |

Sources:
- https://api-docs.deepseek.com/quick_start/pricing/
- https://api-docs.deepseek.com/api/create-chat-completion
- https://api-docs.deepseek.com/guides/thinking_mode
- https://api-docs.deepseek.com/guides/kv_cache

## V1 Non-Goals

Do not do these in V1:

1. Do not add another large module family.
2. Do not add new public benchmark claims.
3. Do not work on commercial/IP cleanup or release packaging.
4. Do not make Claude/GPT comparison claims from smoke results.
5. Do not replace the verified DeepSeek API facts with old 128K assumptions.
6. Do not treat prompt-only rules as sufficient for safety or correctness.
7. Do not add a second evidence dashboard while the existing one is not integrated into runtime.

## 弱模型主链收敛原则

DeepSeek V4 Flash / Flash max-effort / Pro 混合路线的关键不是让模型在每轮看到更多规则，而是让 runtime 把每轮决策压缩到一个小而硬的状态面。GPT-5.5 级模型可以承受厚 prompt、多目标、多工具、多约束并行；弱模型更容易在厚 prompt 下出现遗忘、绕工具、重复验证、误报 PASS、过度发散。

因此 V1 的产品纪律是：

```text
薄 prompt -> 小状态卡 -> 窄工具面 -> 硬证据 -> 可恢复账本 -> 明确 final gate
```

每一轮模型最多应该面对：

| 字段 | 含义 |
| --- | --- |
| STATE | 当前处于 plan/read/edit/verify/review/final/recovery 哪个阶段 |
| ALLOWED_NEXT | 本轮允许的 1-3 个动作 |
| BLOCKED | 当前明确禁止的动作，例如已 PASS 后继续工具、compact 后直接 claim PASS |
| EVIDENCE_REQUIRED | 进入下一阶段需要的证据，例如 tsc/test/lint/source reread |
| RECOVERY_IF_FAILS | 如果失败，runtime 应执行 retry/replan/rollback/escalate/ask-human/abort 中的哪一类 |

这不是新大模块，而是把已有 prompt 纪律、tool gate、ledger、recovery、evidence 统一成弱模型能执行的产品形态。

## 本轮逐项纳入 V1 结论

| # | 优化项 | 代码审核结论 | 是否进入 V1 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | Prompt Diet + Runtime State Card | Prompt 纪律已存在且偏厚。 | 是，P0 | 弱模型不能靠长 prompt 稳定执行，必须 runtime 状态卡化。 |
| 2 | Canonical Tool Result Contract | `ToolCallResult` 已有，但结果形态仍多套并存。 | 是，P0 | 所有 ledger/recovery/evidence 都依赖统一工具结果。 |
| 3 | DeepSeek Thinking + Tool Message Projection | 已有 thinking 相关代码和测试迹象，但 provider 合同需要补强。 | 是，P0 | 这是 DeepSeek V4 tool call 正确性的底座。 |
| 4 | Verified Edit Lifecycle 默认体验 | Write/Edit 已接 TDD/SAST hook，但默认多为 env-gated。 | 是，P0 | 高级程序员信任来自每次写后的可见验证。 |
| 5 | Final Answer Contract | Prompt/test 已有 PASS/FAIL/PARTIAL 纪律。 | 是，P0 | 防止弱模型把未验证工作包装成完成。 |
| 6 | Stage-Scoped Tool Surface | prompt 和 batch gate 已有限制，但每阶段工具面仍可更窄。 | 是，P1 | 降低弱模型工具选择错误率。 |
| 7 | Minimal Durable Task Ledger | ledger/checkpoint/session/DAG persist 都存在但分散。 | 是，P1，薄版 | 长任务恢复需要一个最小统一账本。 |
| 8 | Stall Recovery Decision Table | 多处 gate/recovery 已存在但分散。 | 是，P1 | 把重复失败变成明确动作，不让模型瞎试。 |
| 9 | Agent Handoff Schema Runtime Validation | Agent prompt 已成熟。 | 是，P1 | 只校验 handoff 字段，不扩展 Agent 形态。 |
| 10 | Compact Trust Boundary Runtime Gate | compact prompt 已声明 snapshot 不是 PASS 证据。 | 是，P1 | compact/resume 后必须重新读源和验证。 |
| 11 | Evidence Task Packet | dashboard 脚本已存在。 | 是，P1/P2 | 先做 CLI/JSON 证据包，不急着做完整 UI。 |
| 12 | Light PreEditCheck | 目前主要靠后置 hook 和静态分析。 | 是，P1 | 只查高频低级错，不做重型智能审查。 |
| 13 | TestSkeleton | 可做，但当前不是主链瓶颈。 | 否，P2 | 容易制造形式测试，先把验证链做实。 |
| 14 | BlameContext | 对高级程序员有价值。 | 否，P2/P3 | 容易引入噪声，等默认主链稳定后再做。 |
| 15 | 跨会话经验学习 | experience-store 存在。 | 否，后置 | 没有干净事件账本前，经验可能放大错误。 |
| 16 | 真 SWE-bench 正式跑分 | smoke 边界已实现。 | 否，发布/评估阶段 | V1 保留 mock/real 分层，不宣称正式成绩。 |
| 17 | 更多 Agent 模式 / swarm | Agent prompt 明确只允许 serial worker / parallel fanout。 | 否 | 弱模型下多 Agent 扩张会放大协调错误。 |
| 18 | 更厚 Claude Prompt 吸收 | Claude prompt 已吸收不少。 | 否 | DeepSeek 场景要把 prompt 规则转成 runtime gate。 |

## V1 执行归属：不新增模块，只收敛主链

以下归属用于避免 V1 继续膨胀。所有新增工作都必须挂到现有执行项下面，不允许再开新的大模块族。

| V1 工作 | 归属执行项 | 说明 |
| --- | --- | --- |
| Prompt Diet + Runtime State Card | `P0-0` | 新增为 V1 的产品纪律入口。 |
| Stage-Scoped Tool Surface | `P0-0` + `P0-2` | 由 state card 限制当前阶段工具面；由 tool result contract 保证输出统一。 |
| Final Answer Contract | `P0-0` + `P1-5` + `P1-7` | `finalClaimAllowed` 来自 runtime event/evidence，不来自模型自述。 |
| Compact Trust Boundary | `P0-0` + `P1-6` | compact snapshot 只能恢复方向，不能作为 PASS 证据。 |
| Agent Handoff Schema Validation | `P1-6` | 纳入 long task ledger / stall recovery，不新增 Agent 模式。 |
| Light PreEditCheck | `P0-4` | 纳入 verified edit lifecycle，不单独做大工具系统。 |
| Evidence Task Packet | `P1-7` | 纳入 evidence workbench，不新建第二 dashboard。 |
| Model Route / Flash-MAX Alias | `P0-3` | Flash-MAX 只是 route alias，不是官方模型名。 |
| 跨会话经验学习 | 后置 | 等 event log/ledger 稳定后再做。 |
| TestSkeleton / BlameContext | 后置 | 不是 V1 主链瓶颈。 |
| 正式 SWE-bench | 后置 | V1 只保留 mock/real claim boundary。 |

## Execution Order

### P0-0. Prompt Diet + Runtime State Card

Why first:
This is the product discipline layer for weak models. DSXU already has many strong prompt rules, but DeepSeek Flash should not be asked to remember all of them at once. The runtime must project a small current-state card before action.

Current evidence:
- `src/constants/prompts.ts` contains `DSXU_DEEPSEEK_TOOL_USE_FEW_SHOT_GUIDANCE`.
- `src/constants/prompts.ts` contains `DSXU_PROMPT_GOVERNANCE_CONTRACT`.
- `src/constants/prompts.ts` contains `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`.
- `src/tools/AgentTool/prompt.ts` contains detailed Agent handoff and verification discipline.
- `src/services/compact/prompt.ts` already says task snapshots are navigation only, not PASS evidence.
- `src/services/tools/dsxuToolBatchGate.ts` already emits tool-state messages such as `tool_blocked_after_pass`, `verification_blocked_repeated_failure`, and `read_blocked_after_edit`.

Required work:

| Work item | Required change |
| --- | --- |
| Define `RuntimeStateCard` | Shape: state, allowedNext, blockedActions, evidenceRequired, recoveryIfFails, finalClaimAllowed |
| Project existing gates into the card | Tool batch gate, compact trust boundary, verification state, ledger state, and Agent state should feed one card |
| Shorten model-facing prompt tail | Keep core rules, but move detailed repeated rules into state card and runtime blocks |
| Add final claim bit | `finalClaimAllowed` must be computed from evidence, not model wording |
| Add tests for weak-model readability | Verify a state card never lists more than 3 allowed next actions and never mixes PASS with missing evidence |

Acceptance:

```bash
bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts
bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts
bun test src/dsxu/engine/__tests__/mainline-completion-contract.test.ts
```

Exit condition:
The model receives a compact current-state decision surface instead of a growing pile of prompt obligations.

### P0-1. Fix Verification Entrypoints And Mainline Test Reality

Why first:
If the verification commands are missing, slow, or unclear, every later improvement becomes hard to trust.

Current evidence:
- `evidence:dashboard` package script is missing even though `scripts/dsxu-evidence-dashboard.ts` works.
- `test:six-stage-final` exists but did not complete within 3 minutes.
- `acceptance:senior-coding-window` exists but did not complete within 3 minutes.
- `bun test` did not complete within 5 minutes.

Required work:

| Work item | Required change |
| --- | --- |
| Add missing script aliases | Add `evidence:dashboard` -> `bun run scripts/dsxu-evidence-dashboard.ts` |
| Add benchmark script alias if missing | Add `benchmark:swe-bench` -> `bun run scripts/dsxu-swe-bench-runner.ts` |
| Split slow tests from mainline trust tests | Create or document `test:mainline`, `test:slow`, `test:acceptance` boundaries |
| Make final commands bounded | Each final acceptance command must either finish under a defined timeout or report slow-test classification |
| Produce current failing/slow owner map | Use current logs, not historical claims, to classify owners |

Acceptance:

```bash
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run test:mainline
```

Exit condition:
The team can answer "what is failing or slow?" without running an unbounded full suite.

### P0-2. Canonical Tool Result Contract

Why second:
Tool results are the bloodstream of an agentic coding tool. If results are inconsistent, recovery, verification, ledger, and evidence all become adapters around adapters.

Current evidence:
- `src/dsxu/engine/tool-protocol.ts` defines `ToolCallResult`.
- DSXU adapters such as bash/file-edit/external use `ToolCallResult`.
- Legacy shapes still exist: `content/isError`, provider `tool_result`, MCP results, and other runtime result types.
- `src/dsxu/engine/tool-protocol.ts` also contains mojibake comments, which is a maintainability smell in a protocol file.

Required work:

| Work item | Required change |
| --- | --- |
| Declare canonical shape | Make `ToolCallResult` the internal canonical result for mainline tool execution |
| Fence provider shapes | Provider `tool_result` blocks may exist only at model-message projection boundaries |
| Fence legacy shapes | `content/isError` may exist only in compatibility adapters and tests |
| Add conversion audit | Add tests proving one conversion path from legacy/provider/MCP to `ToolCallResult` |
| Add runtime event emission | Every `ToolCallResult` must be convertible to runtime events and evidence records |
| Clean protocol comments | Fix mojibake in protocol files so maintainers can safely edit the contract |

Acceptance:

```bash
bun test src/dsxu/engine/__tests__/tool-protocol
bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts
rg -n "content: .*isError|isError:|ToolResultBlockParam" src/dsxu/engine src/tools src/services
```

Exit condition:
Mainline uses one result contract. Legacy/provider result shapes are visible only at boundaries.

### P0-3. DeepSeek Thinking + Tool Message Projection

Why third:
For DeepSeek V4, the model-side critical path is not "force fake CoT with a prefix". Native thinking exists. The real risk is losing or incorrectly replaying `reasoning_content` during tool-call turns.

Current evidence:
- DSXU has many provider/message projection layers.
- Official DeepSeek docs require `reasoning_content` to be passed back after tool calls in thinking mode.
- Thinking mode defaults to enabled and can auto-upshift complex agent requests to max effort.

Required work:

| Work item | Required change |
| --- | --- |
| Add provider contract tests | Assistant messages with `content`, `reasoning_content`, and `tool_calls` must round-trip |
| Preserve reasoning for tool turns | If assistant performed tool calls, persist and replay `reasoning_content` in later API requests |
| Drop reasoning when safe | If no tool call occurred, reasoning may be omitted from subsequent context according to provider rules |
| Route effort explicitly | Flash default = `high`; complex/stalled agent tasks = Flash with `reasoning_effort=max`; Pro only for high-value escalation |
| Rename Flash-MAX semantics | Treat "Flash-MAX" as DSXU route alias for `deepseek-v4-flash` + `reasoning_effort=max`, not an official model |
| Disable temperature assumptions | Benchmark configs in thinking mode must not depend on temperature/top_p |

Acceptance:

```bash
bun test src/services/api
bun test src/services/bridge
bun test src/dsxu/engine/__tests__/query-route-verification-v1.test.ts
```

Exit condition:
DeepSeek thinking-mode tool calls can run multi-turn without losing reasoning state or producing provider 400 errors.

### P0-4. Verified Edit Lifecycle As Default Experience

Why fourth:
Senior engineers trust an agent when every write is followed by visible checks, not when the model says it is done.

Current evidence:
- `FileEditTool.ts` and `FileWriteTool.ts` call `invokeStaticAnalysisToolGate`.
- `FileEditTool.ts` and `FileWriteTool.ts` call `invokePostWriteTddGate`.
- `invokePostWriteTddGate` is skipped unless enabled by config/env.
- Static analysis is skipped unless `DSXU_STATIC_ANALYSIS_TOOL_GATE` is enabled.
- Post-mutation verification envelope exists.
- Some rollback logic remains suggestion-only.

Required work:

| Work item | Required change |
| --- | --- |
| Always emit edit lifecycle event | Every Write/Edit emits PreEdit, Mutation, StaticAnalysis, TDD/PostVerify, Review, RollbackAvailability, Evidence events |
| Make gates default-visible | Static analysis and post-mutation verification must be visible by default, even if advisory |
| Risk-based blocking | Blocking should turn on for protected files, test files, package/config files, failed verification after edit, or user-requested strict mode |
| Safe rollback implementation | If old content is available and the write is local, failed blocking verification restores old content or creates an explicit rollback task |
| Preserve current no-loss policy | When rollback could lose user edits, emit manual review instead of destructive rollback |
| Add PreEditCheck | Lightweight check for obvious syntax/import/type signature risks before mutation |

Acceptance:

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts
bun test src/services/static-analysis/__tests__/bridge.test.ts
bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts
bun test src/tools/__tests__
```

Exit condition:
For every code write, the operator can see what changed, what checked it, whether rollback is safe, and what remains unverified.

### P1-5. Runtime Event Schema As Single Ledger Input

Why after tool/edit hardening:
The event schema should describe real execution, not theoretical modules.

Current evidence:
- `src/dsxu/engine/work-state-timeline.ts` defines `DSXUWorkStateEvent`.
- It already supports goal, plan, source truth, tool, permission, failure, recovery, cost, agent, evidence, and next action.
- It is currently better described as a work-state/evidence projection, not the canonical runtime event log.

Required work:

| Work item | Required change |
| --- | --- |
| Promote event source | Use `DSXUWorkStateEvent` or a compatible internal extension as the single runtime event consumed by ledger/evidence |
| Add event emitters | Tool result, permission, model route, verification, rollback, recovery, agent, cost/cache all emit events |
| Add correlation IDs | Every event needs taskId, turnId, toolUseId/modelCallId where applicable |
| Add append-only event log | Persist events as JSONL or equivalent for replay/debug |
| Keep UI projection separate | Work-state timeline remains a projection, not the only source of truth |

Acceptance:

```bash
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts
bun test src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts
bun test src/dsxu/engine/__tests__/visible-shared-owner.test.ts
```

Exit condition:
Evidence, ledger, and UI can all be rebuilt from the same event stream.

### P1-6. Long Task Ledger + Stall Recovery Decision Table

Why this matters:
Long-running coding work fails when the agent loses the thread, loops on tools, forgets verification, or cannot decide whether to retry, replan, rollback, or ask the human.

Current evidence:
- `src/dsxu/engine/progress-ledger.ts` exists.
- DAG persistence exists in `src/coordinator/dag/persist.ts`.
- Coordinator checkpoints exist.
- `buildDsxuIdenticalToolCallStormGate` detects repeated read-only tool calls.
- GearBox and recovery planners exist.

Required work:

| Work item | Required change |
| --- | --- |
| Merge task state | One task ledger should contain goal, plan, current phase, events, checkpoints, verification, recovery decisions, model route, and cost |
| Persist durable checkpoints | Checkpoints must survive process restart for long tasks |
| Define stall types | Duplicate read storm, no diff after N turns, repeated same verification failure, context pressure, cost budget pressure, agent timeout, permission denial loop |
| Define decision table | retry, replan, rollback, escalate Flash max effort, escalate Pro, ask human, abort |
| Bind GearBox to ledger | Gear changes should be evented and justified |
| Bind recovery to evidence | Every recovery decision must show triggering evidence |

Acceptance:

```bash
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts
bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts
bun test src/dsxu/engine/__tests__/query-loop-gear-box-recovery-v1.test.ts
bun test src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts
```

Exit condition:
A 30-60 minute task can be interrupted, resumed, and audited without depending only on raw chat context.

### P1-7. Evidence Workbench, Not Just Dashboard Script

Why last:
Evidence should reflect the real runtime after contracts are stable.

Current evidence:
- `scripts/dsxu-evidence-dashboard.ts` works and produces scoreFloor 72.
- It distinguishes internal smoke from real benchmark evidence.
- It is currently a report script, not a daily trust interface.

Required work:

| Work item | Required change |
| --- | --- |
| Add package script | `evidence:dashboard` must exist |
| Add task evidence packet | For each task: goal, plan, modified files, checks run, check results, rollback availability, model/cost/cache, unresolved risks |
| Add smoke/real labels everywhere | Internal smoke cannot be counted as public benchmark score |
| Add senior-engineer summary | Show risk, unverified areas, next action, and exact commands run |
| Add local history view | Last N task evidence packets should be inspectable |

Acceptance:

```bash
bun run evidence:dashboard
bun run scripts/dsxu-swe-bench-runner.ts --instances "mock-001,mock-002" --timeout 60000
bun run acceptance:senior-coding-window
```

Exit condition:
The evidence surface helps a senior engineer decide whether to trust, review, rerun, or reject the agent's work.

## V1 Priority Table

| Priority | Work | Why |
| --- | --- | --- |
| P0 | Prompt Diet + Runtime State Card | Weak models need a small current-state decision surface, not a thick prompt wall |
| P0 | Verification entrypoints and mainline test reality | Cannot trust anything without bounded, named acceptance commands |
| P0 | Canonical tool result contract | All downstream systems depend on consistent tool outcomes |
| P0 | DeepSeek thinking/tool projection | Official V4 behavior makes reasoning_content replay a provider correctness issue |
| P0 | Verified edit lifecycle default | This is the core coding trust loop |
| P1 | Runtime event schema consolidation | Needed for ledger/evidence/workbench coherence |
| P1 | Long task ledger + stall recovery | Needed for long-running complex tasks |
| P1 | Evidence workbench | Needed for senior-programmer trust and daily use |

## Expected Outcome

After V1, DSXU should not claim "90+" because of module count or smoke tests. It should earn trust through:

1. Runtime State Card that keeps each weak-model turn narrow and evidence-bound.
2. Bounded verification commands.
3. One tool result contract.
4. Correct DeepSeek V4 thinking/tool-call message handling.
5. Visible verified edit lifecycle.
6. Durable task ledger.
7. Explicit stall/recovery decisions.
8. Evidence that separates mock, smoke, and real benchmark results.

The real score lift should come from making existing strengths unavoidable in the default path, not from adding more side modules.
