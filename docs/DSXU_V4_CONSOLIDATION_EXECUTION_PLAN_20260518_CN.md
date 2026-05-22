# DSXU Code V4 收敛执行方案

版本：V4  
日期：2026-05-18  
工作区：`D:\DSXU-code`  
文档性质：AI 编程开发执行文档，不是测试清单、不是路线图、不是单纯验收报告。  
执行原则：先完成 V4 功能与编排收敛，再运行对应硬验收；不新增第二套 runtime，不新增第二套 provider，不新增第二套 ToolBus，不新增第二套 Agent orchestrator，不新增第二套 TUI。  

---

## 0. 文档定位与执行纪律

本文件是给 AI 编程执行者使用的开发执行文档。执行者必须把每个阶段理解为“开发收敛任务”，而不是“先跑测试看看”。测试命令只用于证明该阶段产物已经落入正确 owner，并且没有破坏主链。

V4 的执行顺序固定为：

```text
读取阶段目标
  -> 识别现有 owner
  -> 合并/冻结/删除候选/主链接入
  -> 产出代码或证据文档
  -> 运行本阶段 focused 硬验收
  -> 记录 PASS / FAIL / BLOCKED 和下一步
```

执行者必须遵守以下纪律：

| 纪律 | 说明 |
|---|---|
| 先开发后验收 | P0-P8 的命令是硬验收，不是阶段开发本身。不能只跑测试就宣布阶段完成。 |
| 不用测试替代功能判断 | 测试 PASS 只能证明已覆盖的行为；owner 没合并、runtime 没收束、UI 没接入时不能算完成。 |
| 不新增第二主链 | 缺能力时必须合并到 8 个产品内核，不能新建 provider、ToolBus、Agent、TUI、benchmark runtime。 |
| 不做最小化假收口 | 等价重复要合并或冻结；旧路径不合理就进删除候选；差异能力必须归到命名 owner。 |
| 分层验收 | 小块只跑 focused tests；完成一个大阶段后跑相邻 owner 回归；P8 才跑全量和慢测试。 |
| 证据诚实 | mock、smoke、manifest-ready、readiness 不得写成 public benchmark 或 90/95 claim。 |

V4 的完成定义不是“所有命令跑过”，而是：

1. 8 个产品内核成为默认主链。
2. 冻结/实验/删除候选不再进入默认体验。
3. DeepSeek route/cache/tool/verification/recovery/agent/evidence/TUI 状态同源。
4. H1-H12 全部有代码、证据和硬验收支持。

---

## 1. 目标定义

DSXU Code 的目标不是复刻 Claude Code，而是在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上，通过强编排、工具、权限、上下文、恢复、Agent、成本和证据系统，做出接近或超过 Claude Code 4.7 体验的 AI 编程与复杂任务执行工具。

目标用户是高级程序员。高级程序员需要的不是更多炫技功能，而是以下信任感：

| 信任问题 | DSXU V4 必须给出的答案 |
|---|---|
| 它知道自己在做什么吗？ | 有任务分类、路线、当前目标和下一步 |
| 它知道自己改了什么吗？ | 有 Tool Envelope、文件变更、账本记录 |
| 它验证了吗？ | 有 TDD/SAST/Verify 证据，不允许未验证 PASS |
| 它失败后会乱撞吗？ | 有统一 Recovery Decision |
| 它能长时间执行吗？ | 有 Work Ledger、checkpoint、resume point |
| 它会乱用 Pro 吗？ | Pro 需要证据准入 |
| 它会把 mock 当真成绩吗？ | benchmark 分 internal smoke、comparable、formal |
| 它能解释成本和缓存吗？ | 有 route/cost/cache evidence |

V4 的核心不是增加功能，而是把已有功能收敛为默认主链。

---

## 2. V4 总裁决

| 裁决项 | 结论 |
|---|---|
| 是否继续加功能 | 否。当前瓶颈是收敛，不是能力数量 |
| 是否保留 V1/V2/V3 | 保留，但折叠到 V4 主链中 |
| 是否继续扩展 67 个功能 | 不继续横向扩展，只做归属、冻结、合并和主链接入 |
| 是否重构 Claude 原工具层 | 不做大重构。Claude 工具层保留，做调度面、证据面、可见面收敛 |
| 是否做工具 facade 大瘦身 | 不做破坏性 facade 替换。只做模型可见工具窗口和结果协议收敛 |
| 是否继续堆 prompt | 不继续堆。Prompt 只保留产品纪律，执行纪律交给 runtime gate |
| 是否追求 90% cache hit | 追求，但只能基于 raw trace 声明；先 warm-session 85%+，再争取 90% |
| 是否公开宣称超过 Claude Code | 不能无证据宣称。只允许在成本、上下文、可审计、恢复、证据链维度用真实数据说明 |

一句话：V4 是减法式增强。功能不再扩张，主链必须变硬。

---

## 3. 已审核的真实系统现状

本方案基于只读代码审核和现有文档约束整理：

| 项目 | 真实情况 |
|---|---|
| `src/dsxu/engine` | 563 个文件，约 137,934 行 |
| `src/tools` | 203 个文件，约 53,258 行 |
| `src/services` | 232 个文件，约 65,945 行 |
| `scripts` | 82 个脚本文件 |
| `package.json` scripts | 118 个命令 |
| 贡献规则 | `docs/CONTRIBUTING.md` 明确禁止第二 Query Loop、第二 Tool Gate、第二 MCP/Skill/Plugin runtime、第二 Agent orchestrator、第二 provider runtime |
| 工具面规则 | `docs/TOOL_SURFACE.md` 要求所有工具进入既有 Tool / Permission owner，不允许创建第二运行时 |
| DeepSeek 能力文档 | `docs/DEEPSEEK_V4_CAPABILITIES.md` 已记录 V4 Flash / Pro / thinking / cache / tool / FIM / public claim boundary |

结论：项目已经具备大量能力，也已经意识到复杂度风险。V4 不能再新增横向能力，必须做产品内核收束。

---

## 4. V4 产品内核

V4 只承认 8 个产品内核。任何新增或修改都必须归属其中之一，否则不做。

| # | 产品内核 | 现有 owner | 目标 | 禁止事项 |
|---:|---|---|---|---|
| 1 | Provider Plan | `src/services/api/deepseek-adapter.ts`, `src/utils/model/deepseekV4Control.ts` | DeepSeek 请求体、thinking、模型、成本、缓存、输出限制的唯一事实源 | 禁止第二套 provider request builder |
| 2 | Work Ledger | `src/dsxu/engine/progress-ledger.ts`, `src/dsxu/engine/work-state-timeline.ts` | 长任务状态、checkpoint、当前目标、下一步、阻塞项 | 禁止只靠上下文记忆长任务 |
| 3 | Tool Envelope | `src/Tool.ts`, `src/tools/*`, `src/dsxu/engine/tool-protocol*` | 所有工具结果统一成可投影事件 | 禁止继续扩展 legacy ToolBus |
| 4 | Permission Decision | `src/utils/permissions/*`, `src/components/permissions/*` | side-effect 工具必须有权限判断和拒绝证据 | 禁止 shell 或工具旁路 |
| 5 | Verification Envelope | `FileEditTool`, `FileWriteTool`, `tdd-gate`, `static-analysis`, `verify-gate` | 写后验证、风险分层、最终声明门 | 禁止未验证 PASS |
| 6 | Recovery Decision | `gear-box.ts`, `recovery/*`, `failure-taxonomy` | retry / replan / rollback / abort 统一判断 | 禁止失败后盲目重复工具 |
| 7 | Agent Evidence | `AgentTool/*`, `agent-role-router-v1.ts`, `subagent-protocol.ts` | worker 只交 evidence packet，parent final 只引用证据 | 禁止 worker 口头 PASS 升级为最终成功 |
| 8 | Trust UI | `REPL`, `PromptInputFooter`, message renderers, dashboard | 高级程序员可见的信任状态、下一步、风险和证据 | 禁止底栏噪音刷屏 |

---

## 5. 功能分类裁决

### 5.1 必须进入默认主链

| 功能 | 路径/模块 | V4 处理 |
|---|---|---|
| DeepSeek Provider / 路由 / 成本 / thinking | `deepseek-adapter.ts`, `deepseekV4Control.ts` | 保留为唯一 provider 事实源 |
| Query Loop | `src/query.ts` | 唯一主循环，不再新增 query-loop |
| Source Truth 工具 | Read, Grep, Glob, LSP | 主链读取事实 |
| Edit / Write | `FileEditTool`, `FileWriteTool` | 主链唯一写入 owner |
| Permission Gate | permissions owners | 主链必须保留 |
| Post-mutation verification envelope | `post-mutation-verification-envelope.ts` | 写后统一证据 |
| TDD post-write hook | `coordinator/tdd-gate/post-write-hook.ts` | 低风险 advisory，高风险 blocking |
| Static Analysis Gate | `services/static-analysis/tool-gate.ts` | 风险文件强制，普通文件建议 |
| Verify Gate | `verify-gate.ts` | 接入最终声明门 |
| GearBox / Recovery | `gear-box.ts`, `recovery/*` | 合并为恢复决策表 |
| Agent Evidence | `AgentTool/*`, `agent-role-router-v1.ts` | 只允许 evidence handoff |
| Work Ledger | `progress-ledger.ts`, `work-state-timeline.ts` | 长任务连续性主线 |
| TUI Trust | PromptInputFooter / messages | 只显示高价值状态 |

### 5.2 保留但按需启用

| 功能 | 当前风险 | V4 规则 |
|---|---|---|
| DAG | 容易变成第二执行路径 | 只在复杂多文件、多依赖任务触发 |
| WorkflowTool | 容易变成第二 runtime | 只做 route contract，不独立执行 |
| MCP | 外部系统复杂、权限风险高 | 用户明确或任务必要时启用 |
| SkillTool | 容易污染 prompt 和工具选择 | 只在 registry 命中时启用 |
| Memory / Graph memory | 短任务会污染上下文 | 仅长任务或项目偏好启用 |
| Cache warmer | 有性能价值但不该每轮跑 | 项目启动、长会话、高频仓库启用 |
| Evidence dashboard | 发布和审计有价值 | 不进入普通聊天主链 |
| Benchmark runner | 评估有价值 | 不作为日常开发工具 |
| WebFetch / WebSearch | 查资料有价值 | 编程默认隐藏，明确需要再启用 |
| Schedule / RemoteTrigger | 后台任务风险高 | 默认关闭，用户明确请求才启用 |
| TeamCreate / TeamDelete | 高级 Agent 编排 | 高级实验入口，不默认 |

### 5.3 冻结/实验能力

冻结表示：保留代码和测试，不进默认体验，不继续扩展，不用于公开卖点。

| 功能 | 路径 | 冻结原因 |
|---|---|---|
| Voting / 共识投票 | `src/coordinator/voting/*` | 成本高、延迟高、收益不稳定，不适合默认工程链 |
| Forked Agent / 反事实分支 | `src/dsxu/engine/forked-agent.ts` | 状态、证据、回滚复杂，容易制造分支幻觉 |
| Swarm / 多队友系统 | `src/utils/swarm/*` | tmux/WSL/权限复杂，且 public claim 风险高 |
| Parallel write execution | `parallel-execution-coordinator-v1.ts` | 写操作并发会放大事故 |
| Legacy ToolBus | `src/dsxu/engine/tool-bus/*` | 文件自身标记 legacy，不再扩展 |
| 多版本 Recovery | `recovery-planner.ts`, `recovery-planner-v2.ts`, `recovery-planner-v3.ts` | 决策分散，必须合并 |
| 多套 Prompt stack | `prompt-stack-v1.ts`, `prompt-processing-v1.ts`, `system-prompt-builder-v1.ts` | 容易形成 prompt 叠层，降低 cache hit |
| 多套 productization contract | `reference-*`, `productization-*`, `goal-*` | 作为治理文档/测试，不进 runtime |
| V20/V24/V26 历史脚本 | `scripts/dsxu-v*` | 保留历史证据，不再继续扩张 package scripts |
| public challenge / blocked claim / brand board | claim/brand/release scripts | release sidecar，不是开发主链 |

### 5.4 删除候选池

删除候选不是立即删除。先默认不可见，再跑引用扫描和 focused tests，最后进入 release cleanup。

| 类型 | 处理 |
|---|---|
| 未被主链引用的 legacy ToolBus 辅助代码 | 标记 deprecated，禁止新增依赖 |
| 重复 evidence 脚本 | 合并到 command catalog |
| 临时 V20/V24/V26 验证脚本 | 移入 archive 或内部文档，不挂默认 scripts |
| 重复 recovery planner | 保留一个 owner，旧版本迁移测试后删除 |
| 重复 prompt builder | 合并到一个 prompt owner |
| 未被默认工具池使用的实验工具 | 从默认工具池移除，保留显式命令入口 |

---

## 6. DeepSeek 适配原则

DeepSeek V4 Flash / Flash-MAX / Pro 的最佳产品形态不是厚 prompt，而是短 prompt + 强 runtime。

| DeepSeek 特性 | DSXU V4 策略 |
|---|---|
| Flash 成本低 | Flash 作为默认 coding / read / verify 路径 |
| thinking 可用 | 不靠 prompt 假装 CoT，复杂任务用 Flash-MAX thinking |
| Pro 能力强但成本高 | Pro 证据准入，不默认 |
| 1M 上下文 | 用于 source truth / ledger / recovery，不用于无节制堆 prompt |
| KV cache | stable prefix + dynamic tail + tool schema freeze |
| Tool calls | 工具少而准，每轮可见工具 6-12 个 |
| JSON mode | 用于 evidence / judge / envelope |
| FIM | 只用于局部补全，不进入主 query-loop |

### 6.1 模型路线

| 路线 | 模型/模式 | 场景 |
|---|---|---|
| Fast | Flash non-thinking | 普通问答、状态解释、简单读取 |
| Coding | Flash non-thinking 或 thinking-high | 常规 bugfix、功能实现、局部重构 |
| Flash-MAX | Flash thinking-max | 多文件编辑、失败恢复、长上下文归纳 |
| Pro | Pro thinking-high/max | 高风险权限、安全、公开 claim、重复失败、复杂架构评审 |

### 6.2 Pro 准入硬规则

Pro 只有在以下任一条件满足时可启用：

1. Flash 已尝试且失败，并有失败证据。
2. 任务涉及 provider、permission、security、release、benchmark、public claim 等高风险 owner。
3. 用户明确要求高成本模型。
4. 系统检测到重复恢复失败或验证失败。

Pro 启用必须写入 route/cost/cache evidence。

---

## 7. 默认主链编排

### 7.1 默认编程主链

```text
User Intent
  -> Task Classifier
  -> DeepSeek Route Plan
  -> Visible Tool Window
  -> Source Truth Phase
  -> Work Ledger
  -> Mutation Phase
  -> Post-Mutation Gate
  -> Recovery Decision
  -> Final Claim Gate
  -> Trust UI / Evidence Projection
```

### 7.2 阶段说明

| 阶段 | 责任 | 产物 | 不允许 |
|---|---|---|---|
| Task Classifier | 判断问答、简单编辑、复杂任务、长任务、恢复、发布评估 | task kind / risk / route hint | 不允许所有任务都走重规划 |
| Route Plan | 选择 Flash / Flash-MAX / Pro | route decision / cost estimate | 不允许无证据上 Pro |
| Visible Tool Window | 控制模型可见工具 | 6-12 个工具 | 不允许一次暴露所有工具 |
| Source Truth | 读取事实 | file anchors / symbols / tests | 不允许未读源码直接改 |
| Work Ledger | 记录目标和状态 | current goal / edits / blockers | 不允许只靠上下文记忆 |
| Mutation | 执行 Edit/Write | diff / tool result | 不允许绕过权限 |
| Post-Mutation Gate | 写后验证 | verification envelope | 不允许跳过但声称通过 |
| Recovery | 失败决策 | retry/replan/rollback/abort | 不允许盲目重复工具 |
| Final Claim | 最终回答 | verified claim / residual risk | 不允许 mock 或 partial 冒充 PASS |
| Trust UI | 展示状态 | footer / panel / dashboard | 不允许噪音刷屏 |

---

## 8. 可见工具窗口策略

工具实现可以多，但 DeepSeek 每轮看到的工具必须少。

| 场景 | 可见工具 |
|---|---|
| 普通编码 | Read, Grep, Glob, Edit, Write, Bash/PowerShell, Todo |
| 复杂任务 | 普通编码 + LSP, Agent, RunNativeTest |
| 外部资料 | WebFetch, WebSearch 按需加入 |
| MCP 任务 | MCPTool, ListMcpResources, ReadMcpResource 按需加入 |
| 长任务 | TaskCreate, TaskUpdate, SendMessage 按需加入 |
| 发布验证 | Evidence, Benchmark, Health 按需加入 |

硬标准：

1. 默认可见工具不超过 12 个。
2. 写工具永远串行。
3. 并发只允许 read-only 工具。
4. MCP/Skill/Web/Search 不默认进入编码窗口。
5. 工具选择必须写入 route/work ledger 或 tool window evidence。

---

## 9. Prompt 瘦身标准

V4 不继续堆 prompt。Claude prompt 中成熟的产品纪律必须 runtime 化。

| Prompt 规则 | V4 去向 |
|---|---|
| 不许乱改 | Permission Gate + Work Ledger |
| 不许虚报 | Final Claim Gate |
| 必须验证 | Verification Envelope |
| 工具纪律 | Tool schema + Tool Envelope |
| 失败恢复 | Recovery Decision |
| 长任务连续性 | Durable Work Ledger |
| 成本控制 | Provider Route Event |
| 证据展示 | TUI Trust Surface |

### 9.1 Prompt 硬标准

| 标准 | 通过条件 |
|---|---|
| Stable prefix 稳定 | 同一 session 无 owner/tool/source 变化时 stable hash 不漂移 |
| Dynamic tail 有界 | 当前 step、风险、最近证据、下一步进入 tail |
| 不重复注入长规则 | 同一纪律不在 system prompt、tool prompt、footer 三处重复 |
| 不用 prompt 代替 gate | 验证、权限、最终声明必须 runtime 判断 |
| 中文 TUI 不乱码 | UI 默认 ASCII-safe，中文进入正文或详情面板 |

---

## 10. V3 Cache-first 折叠方案

V3 不作为新架构层，而是作为 V4 性能子线。

| 子项 | 操作 | Owner |
|---|---|---|
| StablePrefixLock | stable prefix hash 漂移必须有 reason | `prompt-prefix-cache-evidence.ts` |
| DynamicRuntimeTail | route/context/verify/current step 放到动态尾部 | `query.ts`, `prompt-prefix-cache-builder.ts` |
| ToolSchemaFreeze | tool schema canonical hash session 内稳定 | tool registry owner |
| CacheEpoch | `/new`, `/clear`, `/compact`, model/tool drift 进入 epoch | query/cache owner |
| Append-only Ledger | recovery/tool result/compact append 或显式 epoch | progress ledger |
| Warm Prefix | 只做 idle/dry-run/prefix-only | `cache-warmer.ts` |
| Cache Dashboard | 显示 cold/warm/epoch/unknown drift | evidence dashboard |

### 10.1 Cache 验收标准

| 指标 | 最低通过 | 理想目标 |
|---|---:|---:|
| unknown stable drift | 0 | 0 |
| stable prefix volatile finding | 0 | 0 |
| warm-session cache hit | >= 80% | 88-92% |
| public challenge cache hit | >= 75% | 85%+ |
| p95 latency | 不高于 V2 +5% | 持平或下降 |
| pass rate | 不低于 V2 | 上升 |
| mean cost | 下降 | 下降 25%+ |

---

## 11. 编辑生命周期默认化

### 11.1 风险分层

| 风险层级 | 默认动作 | 示例 |
|---|---|---|
| 低风险 | advisory envelope | 文档、小样式、单文件低影响修改 |
| 中风险 | focused verification | TS/TSX 函数逻辑、测试相关文件 |
| 高风险 | blocking gate | provider、permission、tool、runtime、security、benchmark、release、Agent/MCP/Skill |
| 用户显式跳过 | 允许，但 final 显示 skipped | 用户要求只改不跑测试 |

### 11.2 验收标准

| 标准 | 通过条件 |
|---|---|
| Edit/Write 后必有 envelope | 每次写入产生 post-mutation verification envelope |
| 高风险默认 blocking | 风险 owner 写入失败时阻断 final PASS |
| 普通路径不被拖死 | 低风险不强跑全量测试 |
| skipped 不冒充 PASS | final 明确 verify=skipped 或 partial |
| Final Claim Gate | 最终回答只能引用最新验证状态 |

---

## 12. Recovery Decision Table

V4 不新增 recovery runtime。只把 GearBox、failure taxonomy、verify failure、tool failure 收成一张决策表。

| 失败类型 | 默认动作 | 可升级动作 | 禁止 |
|---|---|---|---|
| 工具参数错误 | repair tool call | retry once | 重复同错超过 2 次 |
| 文件未找到 | re-read source truth | replan | 直接猜路径 |
| 测试失败 | inspect error | focused fix | 跳过测试后 PASS |
| 类型错误 | run focused typecheck | repair imports/types | 大范围盲改 |
| 权限拒绝 | ask user / alternative safe path | abort | 绕过权限 |
| 上下文压力 | compact with anchors | cache epoch | 丢失 source anchors |
| Agent 未给证据 | ask worker for evidence | reject worker PASS | parent 直接采信 |
| 重复失败 | Flash-MAX / Pro admission | rollback/replan | 无限 retry |

### 12.1 Recovery 硬标准

1. 每次失败必须进入 failure taxonomy。
2. 同一工具同一错误最多连续 retry 2 次。
3. recovery 后必须更新 Work Ledger。
4. rollback 必须记录文件和原因。
5. final 必须说明 residual risk。

---

## 13. Agent 编排标准

Agent 是辅助，不是默认主链替代品。

### 13.1 Agent 启用条件

允许启用 Agent：

1. 子任务边界清晰。
2. 写入范围 disjoint。
3. parent 不依赖 worker 才能继续做所有事。
4. worker 可以产出 source/test/evidence packet。

禁止启用 Agent：

1. 单文件简单修改。
2. 写入范围重叠。
3. 任务目标模糊。
4. 只是为了显得高级。
5. 无法验证 worker 输出。

### 13.2 Agent Evidence Packet

worker 返回必须包含：

| 字段 | 要求 |
|---|---|
| objective | 子任务目标 |
| filesRead | 已读文件 |
| filesChanged | 修改文件 |
| commandsRun | 执行命令 |
| verification | PASS / FAIL / PARTIAL / SKIPPED |
| evidencePaths | 证据路径 |
| residualRisk | 剩余风险 |

parent final 只能基于 evidence packet 合成，不得基于 worker 自称成功。

---

## 14. TUI Trust Workbench

TUI 的目标不是显示全部内部状态，而是让高级程序员快速判断能不能信。

### 14.1 默认底栏

底栏最多三行：

```text
DSXU trust: route=Flash | verify=partial | next=focused_test | cost=$0.0003 | cache=93%
Ledger: goal=fix-login-test | step=edit_done | blockers=0
Agent: active=0 | evidence_required=no
```

### 14.2 显示规则

| 内容 | 显示位置 |
|---|---|
| route / verify / next / cost / cache | 底栏 |
| 完整 evidence | dashboard 或详情面板 |
| Agent worker 详情 | Agent panel |
| skipped verification | 底栏必须显示 |
| 错误和阻塞项 | 正文或详情面板 |
| 长 usage evidence | 默认隐藏，可展开 |

### 14.3 中文/乱码规则

1. 底栏优先 ASCII-safe。
2. 中文正文可以显示，但不要用 box drawing 包裹长中文。
3. Windows/PTY resize 场景必须有 ASCII fallback。
4. EvidenceLine 不在普通消息流刷屏。

---

## 15. Benchmark 与 Evidence 分层

V4 必须区分四类证据。

| 层级 | 名称 | 用途 | 是否可公开宣称 |
|---|---|---|---|
| L1 | focused unit/integration test | 验证代码 owner | 否 |
| L2 | internal smoke | 内部主链冒烟 | 否 |
| L3 | comparable benchmark | 同题、固定 manifest、raw trace | 可谨慎说明 |
| L4 | formal benchmark | 官方或公开协议、可复现 | 可公开宣称 |

硬规则：

1. mock/smoke 不得写成正式 benchmark。
2. public 90/95 不得无 raw trace 声明。
3. dashboard 分数不得手工抬分。
4. 所有 benchmark 必须记录模型、温度、上下文、成本、cache、wall-clock、验证结果。

---

## 16. 执行阶段

本节是开发执行顺序。每个阶段必须先完成“开发动作”和“产物”，再运行“硬验收”。如果开发动作没有完成，即使验收命令碰巧 PASS，也只能记录为 `verification-only`，不能记录为阶段完成。

### 16.0 阶段完成判定

| 状态 | 含义 |
|---|---|
| `DONE` | 开发动作完成，产物落盘，focused 硬验收 PASS。 |
| `PARTIAL` | 部分开发动作完成，或只完成 focused 验收但产物不完整。 |
| `BLOCKED` | 缺真实输入、权限、raw evidence、owner signoff 或测试失败。 |
| `VERIFICATION_ONLY` | 只跑了测试，没有完成阶段开发产物；不能当阶段完成。 |

### P0：冻结与盘点

开发目标：把 V1/V2/V3/V18/V20/V24/V26 的能力、脚本和实验路径统一压到 V4 八个产品内核，先阻止继续扩张。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| 建立功能归属表 | 生成 `DSXU_V4_FEATURE_OWNER_MAP`，每个默认能力、按需能力、冻结能力、删除候选都必须归入 8 个产品内核之一。 |
| 建立冻结清单 | 生成 `DSXU_V4_FREEZE_REGISTER`，标记 voting、forked agent、swarm、legacy ToolBus、多套 Recovery、多套 Prompt stack 的默认禁用/冻结状态。 |
| 建立脚本分层 | 生成 `DSXU_V4_SCRIPT_SURFACE_MAP`，把 package scripts 分为 product-runtime、mainline-validation、release-only、owner-review、historical-evidence、internal-benchmark、live-provider、toolchain、supporting-utility。 |
| 建立复杂度风险表 | 生成 `DSXU_V4_COMPLEXITY_RISK_REGISTER`，列出第二 runtime/provider/ToolBus/Agent/TUI 风险、当前 owner、处理动作。 |
| 更新执行记录 | 在本文件追加 P0 执行记录：产物路径、当前未闭合风险、下一阶段入口。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| `docs/generated/DSXU_V4_FEATURE_OWNER_MAP_20260518.json` | 机器可读 owner map。 |
| `docs/DSXU_V4_FEATURE_OWNER_MAP_20260518.md` | 人读版 owner map。 |
| `docs/generated/DSXU_V4_FREEZE_REGISTER_20260518.json` | 冻结/实验/删除候选表。 |
| `docs/generated/DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.json` | 第二主链风险表。 |
| `docs/generated/DSXU_COMMAND_CATALOG_20260518.json` | 脚本分层证据。 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/product-core-guard.test.ts
bun run scripts/dsxu-command-catalog.ts
```

### P1：Provider 单事实源

开发目标：让 DeepSeek model/context/thinking/tool/cost/cache 只从一个 provider plan owner 出口产生，不允许 api-service、llm-adapter、model-gateway、query-loop 各自拼请求体。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| 收敛 request body builder | 所有 DeepSeek chat/completions/tool/thinking 请求体必须调用同一组 owner helper；其它路径只能传入 plan 或 normalized request。 |
| 收敛模型能力事实 | `deepseek-v4-flash`、Flash-MAX、Pro、thinking、FIM、context/cost/cache 事实由 canonical owner 输出。 |
| 收敛 Pro 准入 | Pro 必须记录 prior Flash evidence、admission reason、saved task evidence；不能因普通失败或提示词关键词直接升 Pro。 |
| 收敛 usage/cost/cache 投影 | usage normalize 后进入 route/cost/cache trajectory、ledger、Trust UI 和 evidence dashboard。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| provider contract 代码更新 | 没有第二套 DeepSeek request body。 |
| provider owner 证据 | route/cost/cache/proAdmission 能追到 canonical owner。 |
| P1 执行记录 | 记录 touched files、focused tests、仍需 live raw evidence 的项。 |

硬验收：

```bash
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts
bun test src/dsxu/engine/__tests__/model-capability-v1.test.ts
```

### P2：Cache-first 折叠

开发目标：把 V3 Cache-first 方案变成主链策略：StablePrefixLock、DynamicRuntimeTail、ToolSchemaFreeze、CacheEpoch、Warm Prefix 都由 DeepSeek route/cost/cache owner 管理。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| StablePrefixLock | stable prefix hash 漂移必须有 reason；未知 drift 进入风险证据。 |
| DynamicRuntimeTail | route、context pressure、verify state、current step、tool result summary 放到动态尾部。 |
| ToolSchemaFreeze | 会话内工具 schema hash 稳定；工具窗口变化必须有 epoch/reason。 |
| CacheEpoch | 模型、tool schema、system discipline、source capsule 变化必须触发 epoch 解释。 |
| Warm Prefix | 只在 dry-run 或明确长会话场景下使用；不得默认后台调用 provider。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| cache evidence | cold/warm/epoch/stable/dynamic 有结构化证据。 |
| cache dashboard 输入 | dashboard 能看到 cache 状态和风险，不手工抬命中率。 |
| P2 执行记录 | 说明是否 live provider、是否 dry-run、是否有 raw trace。 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts
bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts
bun test src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts
bun run scripts/dsxu-live-cache-prefix-smoke.ts
```

### P3：编辑生命周期默认化

开发目标：让 FileEdit/FileWrite 的默认路径形成 Plan -> Permission -> Edit/Write -> TDD/SAST/Verify -> Recovery/Final Claim Gate，不再出现无验证 PASS。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| Post-mutation envelope | 每次 Edit/Write 后必须产生 verification envelope，至少说明 PASS/PARTIAL/SKIPPED/FAIL。 |
| 风险分层 | 普通路径 advisory；provider/permission/release/security/core owner 风险路径 blocking。 |
| VerifyGate 真实命令 | 不能用 mock score 代替测试命令；没有命令时显示 needs-verification。 |
| Final claim gate | final answer 只能引用真实 verify evidence；skipped 必须可见。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| verification envelope | TDD/SAST/Verify 结果、跳过原因、命令证据可追溯。 |
| final claim policy | 未验证不得 PASS。 |
| P3 执行记录 | 记录哪些路径 advisory、哪些 blocking。 |

硬验收：

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts
bun test src/services/static-analysis/__tests__/bridge.test.ts
bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts
bun test src/dsxu/engine/__tests__/verify-gate.test.ts
```

### P4：Tool / Permission 结果统一

开发目标：宣布 `ToolCallResult` / Tool Envelope 为 canonical contract，legacy/provider/MCP/tool-bus 结果只能在 Tool Gate 边界 normalize。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| ToolResult canonical | 消费方不得直接消费 legacy result shape。 |
| Permission evidence | side-effect、shell、file write、MCP、Agent、Team/Task/RemoteTrigger 都进入 Permission Decision。 |
| Legacy ToolBus 冻结 | legacy ToolBus 只保留历史/ACL residue，禁止新增依赖。 |
| Tool result compact | 长输出 artifact 化或折叠；TUI 只显示短状态和风险。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| tool protocol evidence | provider/MCP/legacy normalize 边界明确。 |
| permission floor evidence | broad allowed tools 不绕过 command-specific permission。 |
| P4 执行记录 | 记录 legacy shape 是否还有 active consumer。 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts
bun test src/tools/__tests__/tool-permission-owner-gate.test.ts
bun test src/dsxu/engine/__tests__/allowed-tools-permission-floor-v1.test.ts
```

### P5：Recovery 决策表

开发目标：把 GearBox、FailureTaxonomy、VerifySummary、ProgressLedger、query-loop recovery 收成一张 Recovery Decision Table，不新增桥接 runtime。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| 失败分类统一 | verify-failure、tool-failure、permission-denied、context-insufficiency、provider-error、repeated-failure 都有明确动作。 |
| 决策动作统一 | retry、replan、rollback、ask-human、abort、escalate-model 必须来自同一 Recovery Decision。 |
| 重复失败保护 | 同类失败超过阈值后不得无限 retry。 |
| Ledger/TUI 投影 | recovery decision 写入 ledger、work-state timeline、final report、TUI compact state。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| Recovery Decision Table | 每类失败有动作、阈值、证据字段。 |
| ledger evidence | recovery decision 可恢复、可审计。 |
| P5 执行记录 | 记录被合并/冻结的旧 recovery 变体。 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/gear-box.test.ts
bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts
bun test src/dsxu/engine/__tests__/recovery-decision.test.ts
bun test src/dsxu/engine/__tests__/query-loop-recovery-bridge-v1.test.ts
```

### P6：Agent Evidence Handoff

开发目标：Agent 只做 serial worker / parallel fanout evidence handoff，不替代主 query-loop，不形成 swarm/manager mesh/agent-of-agents runtime。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| worker evidence packet | worker 输出 scope、changed files、tools、verification、risk、artifact，不直接宣布最终 PASS。 |
| parent final gate | parent final 必须引用 worker evidence packet；未引用则 blocked/partial。 |
| Agent mode 收敛 | parallel 只允许 read-only 或 disjoint owned implementation；写冲突必须 serial。 |
| MCP/Skill 边界 | MCP/Skill 是 registry/tool boundary，不是 standalone runtime。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| agent handoff schema | runtime 可校验，父任务可引用。 |
| boundary board | Agent/MCP/Skill 冲突、绕过、假 PASS 能被拦截。 |
| P6 执行记录 | 记录 blocked guards 和 accepted boundary。 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts
bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts
bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts
bun run scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts
```

### P7：TUI Trust Workbench

开发目标：把 Verification、Recovery、Ledger、Agent Evidence、Route/Cost/Cache、Tool Result 变成默认可见但不刷屏的高级程序员信任界面。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| 底栏降噪 | 默认底栏只显示 route、verification、cost/cache、blocked state 的短摘要。 |
| 详情分流 | 长 evidence、ledger、agent、artifact 进入 detail panel/report，不挤普通聊天区。 |
| EvidenceLine 治理 | `DSXU final usage evidence` 不作为普通聊天消息重复显示。 |
| PTY/中文/ASCII fallback | Windows resize、权限弹窗、长内容、中文输出、边框 fallback 不破坏交互。 |
| 真实窗口回归 | 完成阶段开发后，再跑 senior-coding-window；中断或 partial 不计 PASS。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| Trust UI compact projection | TUI/CLI/stream-json/final report 消费同源状态。 |
| TUI regression evidence | resize、long-output、permission dialog、trust proof 可复跑。 |
| P7 执行记录 | 记录真实窗口是否完整 PASS；被中断必须标记 `ABORTED_NOT_PASS`。 |

硬验收：

```bash
bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts
bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts
bun run acceptance:senior-coding-window
```

### P8：Evidence / Benchmark / Release 收口

开发目标：把 Evidence Workbench、public comparable manifest/raw evidence、release/export public surface、fresh install、secret/brand scans 收成开源发布 gate。

必须完成的开发动作：

| 动作 | 要求 |
|---|---|
| Dashboard 消费最新证据 | dashboard 读取最新 V4/P0-P7 证据，区分 PASS/FAIL/BLOCKED/NOT_RUN。 |
| Public comparable raw evidence | 固定 30-case manifest 后，采集逐题 raw transcript、tool trace、raw API baseline、artifact、final report、cost/cache、Pro admission、failure recovery。 |
| Release public surface | clean export 只 ship public-safe docs/assets/source，不带内部 V* evidence、`.dsxu`、key、absolute local trace。 |
| Fresh install smoke | post-policy clean export 后跑 install/help/doctor/provider gate smoke。 |
| Final claim gate | 90/95、外部胜出、formal SWE-bench 只有 raw evidence 满足时才允许。 |

阶段产物：

| 产物 | 最低要求 |
|---|---|
| refreshed evidence dashboard | scoreFloor 不手工抬分，public claim blocker 可解释。 |
| public comparable raw pack | 30-case raw evidence 或明确仍 blocked。 |
| clean export artifact | post-policy zip + manifest + secret scan。 |
| release runbook update | README/GitHub 文案只引用真实证据。 |
| V4 final record | H1-H12 每项 PASS/PARTIAL/BLOCKED。 |

硬验收：

```bash
bun test
bun run test:six-stage-final
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "sample1,sample2,sample3,sample4,sample5"
```

---

## 17. 总硬验收标准

V4 只有在全部满足时才算完成：

| 编号 | 硬标准 | 通过条件 |
|---:|---|---|
| H1 | 不新增第二 runtime | 无第二 Query Loop / Tool Gate / Permission Gate / MCP runtime / Agent orchestrator / provider runtime |
| H2 | 主链测试通过 | `bun test` 通过或失败项全部归属明确且非 V4 引入 |
| H3 | Provider 单事实源 | DeepSeek model/context/thinking/tool/cost/cache 事实一致 |
| H4 | Cache 不退化 | stable drift = 0，warm-session cache hit >= 80% |
| H5 | 写后验证存在 | Edit/Write 后有 verification envelope |
| H6 | 未验证不 PASS | final answer 能显示 PASS / PARTIAL / SKIPPED / FAIL |
| H7 | Recovery 不死循环 | 同类失败最多 retry 2 次，之后 replan/rollback/abort |
| H8 | Agent 不虚报 | parent final 只能引用 worker evidence packet |
| H9 | TUI 不刷屏 | 默认底栏不显示长 evidence，不破坏正文可读性 |
| H10 | benchmark 不虚报 | mock/smoke 不作为正式成绩 |
| H11 | package scripts 不继续膨胀 | 新脚本必须归类并有 owner |
| H12 | 发布声明有证据 | 任何 90/95、超过 Claude、SWE-bench 成绩必须有 raw trace |

---

## 18. 不应做的事

1. 不继续增加通用模块。
2. 不新增第二套 ProviderGateway。
3. 不新增第二套 ToolBus。
4. 不新增第二套 Agent 团队系统。
5. 不把 Swarm 默认化。
6. 不把 Forked Agent 默认化。
7. 不把 Voting 共识默认化。
8. 不把 WorkflowTool 做成独立 runtime。
9. 不把 MCP/Skill 默认暴露给所有编码任务。
10. 不把 Graph Memory 默认注入所有 prompt。
11. 不把 prompt 规则当作 runtime 安全保证。
12. 不把 internal smoke 写成公开 benchmark。
13. 不手工把 dashboard 分数改成 90+。
14. 不为了 cache hit 删除 source truth、permission 或 verification。

---

## 19. V4 完成后的预期状态

| 维度 | 当前问题 | V4 后目标 |
|---|---|---|
| 功能数量 | 功能多、入口多、脚本多 | 8 个产品内核收敛 |
| 默认主链 | 多能力分散 | 一条默认编程主链 |
| 工具选择 | 模型可能看到太多工具 | 场景化 6-12 个可见工具 |
| Prompt | 容易厚重 | prompt 瘦身，纪律 runtime 化 |
| Cache | 证据存在但未完全主链化 | stable prefix + dynamic tail |
| 验证 | TDD/SAST/Verify 分散 | verification envelope + final claim gate |
| Recovery | GearBox/Recovery 分散 | decision table |
| Agent | worker 证据边界需要硬化 | evidence packet + parent gate |
| TUI | 信息多时噪音大 | trust footer + detail panel |
| Benchmark | smoke/formal 容易混淆 | 分层证据，禁止虚报 |

---

## 20. 最终结论

DSXU V4 的最优方向不是新增第 68 个功能，而是把已有能力折叠成一条强主链：

```text
Task Classifier
  -> DeepSeek Route Plan
  -> Visible Tool Window
  -> Source Truth
  -> Work Ledger
  -> Permission + Tool Envelope
  -> Edit/Write
  -> Verification Envelope
  -> Recovery Decision
  -> Agent Evidence if needed
  -> Final Claim Gate
  -> Trust UI / Evidence Dashboard
```

冻结 Voting、Forked Agent、Swarm、Legacy ToolBus、多套 Recovery、多套 Prompt Stack，不是削弱 DSXU，而是让 DeepSeek 模型在更窄、更硬、更可验证的轨道上运行。

V4 的成功标准不是“功能更多”，而是：

1. 默认链更短。
2. 模型看到的工具更少。
3. 写后验证更硬。
4. 失败恢复更可控。
5. 长任务状态更可恢复。
6. TUI 更可信。
7. benchmark 更诚实。
8. 成本/cache/证据更透明。

这才是适合 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型的 DSXU 最优收敛方案。

---

## 21. V4 真实完成度审核结果（2026-05-19）

本节记录对 V4 当前状态的复核结果。结论必须区分“文档完成”和“代码完成”。

### 21.1 总体裁决

| 项 | 当前状态 | 判断 |
|---|---|---|
| V4 文档 | 已形成标准 AI 开发执行文档 | 完成 |
| V4 代码实现 | 仅部分基础模块存在，未全量主链收敛 | 未完成 |
| 8 个产品内核 | 文档定义完成，代码 owner 多数存在 | 部分完成 |
| 冻结/实验能力 | 文档写清楚，但未全部加默认不可见或 freeze guard | 未完成 |
| 命中率组件 | cache builder / evidence / dynamic-tail focused tests 通过 | 基础完成 |
| 命中率主链化 | `query.ts` 已记录 evidence，但仍偏观测层，不是完整治理层 | 部分完成 |
| 90% 命中率 | 无全场景真实证明 | 未完成 |

当前裁决：**V4 不是已经完成的实现，而是已经完成的收敛执行文档。代码层仍需按 P0-P8 落地。**

### 21.2 已运行的 focused cache 审核

审核命令：

```bash
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts
```

结果：

```text
15 pass
0 fail
105 expect() calls
```

该结果只证明 cache 治理组件基础可用，不证明 V4 命中率目标已经在真实默认主链达成。

### 21.3 结构完成度审核

| 产品内核 | 当前判断 | 说明 |
|---|---|---|
| Provider Plan | 接近完成 | `deepseek-adapter.ts` 与 `deepseekV4Control.ts` 已经是较强事实源 |
| Work Ledger | 部分完成 | `progress-ledger.ts` 与 `work-state-timeline.ts` 存在，但仍需确认默认主链全量投影 |
| Tool Envelope | 部分完成 | tool protocol / evidence pack 存在，但 legacy ToolBus 仍在 |
| Permission Decision | 基础完成 | 权限体系成熟，可作为主链内核 |
| Verification Envelope | 部分完成 | Edit/Write 后已有 post-mutation envelope，但 final claim gate 仍需确认全量接入 |
| Recovery Decision | 未完成收敛 | GearBox 与多版本 recovery 并存，仍需合并成唯一决策表 |
| Agent Evidence | 部分完成 | Agent evidence packet 存在，但 parent final gate 仍需硬化 |
| Trust UI | 部分完成 | 已做降噪基础，但仍需完整 trust workbench 收口 |

结构评分：

| 维度 | 分数 |
|---|---:|
| V4 方案结构 | 8.8 / 10 |
| 当前代码收敛实现 | 5.5 / 10 |

主要结构风险：

| 风险 | 证据/说明 | 必须动作 |
|---|---|---|
| Recovery 多套并存 | `recovery-planner.ts`、`recovery-planner-v2.ts`、`recovery-planner-v3.ts` 仍同时存在 | 合并为一个 Recovery Decision Table |
| Legacy ToolBus 未退出 | `src/dsxu/engine/tool-bus/*` 仍保留 legacy 文件 | 停止新增依赖，进入冻结/删除候选 |
| Scripts 过多 | `package.json` scripts 约 118 个 | 分 dev / release / benchmark / debug / internal |
| 冻结只是文档裁决 | Voting / Forked / Swarm 未全部加默认不可见 guard | 建立 freeze register 和默认不可见策略 |
| V4 文档状态 | 当前文件在 git 中是未跟踪新文件 | 纳入正式执行文档或明确为草案 |

### 21.4 命中率完成度审核

已经完成的基础：

| 能力 | 状态 |
|---|---|
| Stable prefix / dynamic tail 分析器 | 已有 |
| Prompt prefix cache evidence | 已有 |
| Query 主链 cache evidence 记录 | 已有 |
| DeepSeek usage cache token 读取 | 已有 |
| Focused cache tests | 通过 |

仍未完成的主链化问题：

| 问题 | 说明 | 风险 |
|---|---|---|
| evidence 偏旁路 | `recordDSXUQueryPromptPrefixCacheEvidence()` 记录证据，但不阻断、不重排 prompt | 只能观测，不能保证命中率 |
| `fullSystemPrompt` 每轮构造 | `query.ts` 仍构造 `fullSystemPrompt` 并加入动态上下文 | 动态内容可能影响真实 provider prefix |
| dynamic system context 仍在系统 prompt 内 | `Context Window & Hygiene`、`DSXU Model Route Evidence` 通过 `appendSystemContext()` 加入 | 需要证明它们位于 dynamic boundary 后 |
| CacheEpoch 不够硬 | 当前更多是计划/evidence 字段 | 未知 drift 不一定阻断 |
| 真实 90% 未证明 | 历史数据有 65.4%、66.8%、75.3%，也有部分 warm run 90%+ | 不能声明全局 90% |

命中率评分：

| 维度 | 分数 |
|---|---:|
| cache 基础能力 | 7.0 / 10 |
| cache 主链完成度 | 5.5 / 10 |
| 真实 90% 达成度 | 4.0 / 10 |

当前可诚实声明：

1. DSXU 已有 cache prefix / dynamic tail / cache evidence 基础设施。
2. focused cache tests 已通过。
3. 历史数据证明部分 warm session 可以达到 90%+。
4. public challenge / cost-quality 当前更接近 65-75% 真实趋势。

当前禁止声明：

1. 禁止声明 V4 命中率化已完成。
2. 禁止声明全局 90% cache hit 已达成。
3. 禁止用局部 warm run 代表所有场景。
4. 禁止把 evidence 记录等同于 provider 请求结构已经完全 cache-safe。

### 21.5 V4 剩余关键工作

| 优先级 | 工作 | 验收目标 |
|---|---|---|
| P0 | 将 V4 文档纳入正式执行状态 | 文件被跟踪或明确标记为草案 |
| P0 | 生成功能 owner map / freeze register / script surface map | 所有功能归属 8 内核或冻结/删除候选 |
| P0 | Voting / Forked / Swarm / Legacy ToolBus 默认不可见 | 默认主链不暴露、不调用、不宣传 |
| P0 | Query 主链 cache hard gate | unknown stable drift 可见，必要时阻断 |
| P1 | 审计 `fullSystemPrompt` stable/dynamic 实际请求结构 | 动态内容不污染 stable prefix |
| P1 | 增加真实 trace 聚合器 | 输出 stablePrefixHash 唯一性、cacheHitRatePct、miss 原因 |
| P1 | 命中率 benchmark 分层 | cold / warm / public challenge / long task 分开统计 |
| P1 | Recovery 多版本合并 | 一个默认 Recovery Decision Table |
| P2 | package scripts 分层降噪 | public scripts 可控 |
| P2 | TUI trust 展示 cache 状态 | 用户可见真实 cache/cost，不刷内部日志 |

### 21.6 V4 真实状态结论

当前真实状态：

```text
V4 文档完成。
V4 方向正确。
V4 基础模块部分存在。
V4 默认主链收敛未完成。
V4 命中率治理未完成。
V4 90% 命中率没有全场景真实证明。
```

下一步不应继续新增能力，而应执行 P0-P2：

1. 结构上先冻结实验能力并建立 owner map。
2. 命中率上把 cache evidence 从观测层推进到主链治理层。
3. 验证上用真实 trace 聚合，而不是只看 focused unit tests。

---

## 22. V4 历史执行记录（需按 2026-05-19 审核复核）

说明：以下记录保留 2026-05-18 的阶段执行结果，用于追溯当时的 focused tests、触达文件和阶段裁决。  
但 2026-05-19 的真实完成度审核已经裁定：这些记录不能单独证明 V4 已真完成。  
后续判断 V4 是否完成，必须优先使用第 21 节的真实完成度审核和第 17 节 H1-H12 硬验收标准。

### 22.1 P0 冻结与盘点 - 历史记录：DONE - 2026-05-18

本轮按 V4 开发文档执行 P0，不是只跑验收。P0 的开发目标是先阻止继续扩张，把现有 V1/V2/V3/V18/V20/V24/V26 能力、脚本和实验路径压到 8 个 V4 产品内核，并形成后续 P1-P8 可执行的 owner 证据。

#### 已完成的开发动作

| 动作 | 状态 | 产物 |
|---|---|---|
| 建立功能归属表 | DONE | `docs/generated/DSXU_V4_FEATURE_OWNER_MAP_20260518.json`, `docs/DSXU_V4_FEATURE_OWNER_MAP_20260518.md` |
| 建立冻结清单 | DONE | `docs/generated/DSXU_V4_FREEZE_REGISTER_20260518.json`, `docs/DSXU_V4_FREEZE_REGISTER_20260518.md` |
| 建立脚本分层 | DONE | `docs/generated/DSXU_COMMAND_CATALOG_20260518.json`, `docs/DSXU_COMMAND_CATALOG_20260518.md`, `docs/generated/DSXU_V4_SCRIPT_SURFACE_MAP_20260518.json`, `docs/DSXU_V4_SCRIPT_SURFACE_MAP_20260518.md` |
| 建立复杂度风险表 | DONE | `docs/generated/DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.json`, `docs/DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.md` |
| 更新执行记录 | DONE | 本节 |

#### P0 产物摘要

| 产物 | 结果 |
|---|---|
| V4 feature owner map | 30 entries；8/8 产品内核均有 owner；default-mainline=22, on-demand=2, frozen-experimental=3, release-only=3 |
| V4 freeze register | 10 entries；覆盖 voting、forked agent、swarm、legacy ToolBus、多套 Recovery、多套 Prompt stack、MCP/Skill standalone runtime、background cache warmer、internal smoke public claim、generic package entrypoint expansion |
| V4 complexity risk register | 9 entries；覆盖 second-provider、second-toolbus、second-agent、second-tui、prompt-stack、script-surface、claim-inflation、verification/recovery 风险 |
| command/script surface map | 118 scripts；product-runtime=3, mainline-validation=12, release-only=9, owner-review=12, historical-evidence=55, internal-benchmark=4, live-provider=8, toolchain=4, supporting-utility=11 |

#### P0 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-command-catalog.test.ts` | PASS；4 tests / 39 expects |
| `bun test src/dsxu/engine/__tests__/product-core-guard.test.ts` | PASS；4 tests / 11 expects |
| `bun run scripts/dsxu-command-catalog.ts` | PASS_DSXU_COMMAND_CATALOG_READY；同时生成 V4 owner/freeze/risk/script-surface 产物 |

#### P0 裁决

P0 状态：DONE。

P0 没有新增 package 主入口，没有新增 runtime/provider/ToolBus/Agent/TUI，也没有把 historical evidence 或 internal smoke 提升成产品能力。后续阶段必须以本轮产物为 owner 边界：P1 进入 Provider 单事实源；P2 进入 Cache-first 折叠；P3 进入编辑生命周期默认化；P4-P8 分别按 V4 阶段继续收束，不得绕过 P0 的 freeze register 和 complexity risk register。

### 22.2 P1 Provider 单事实源 - 历史记录：DONE - 2026-05-18

本轮按 V4 P1 执行 provider owner 收束。目标不是增加 provider 能力，而是消除 DeepSeek chat/tool/thinking request body 的第二拼接点。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| 收敛 request body builder | DONE | 新增 `DeepSeekAdapter.buildDeepSeekChatCompletionBody`、`normalizeDeepSeekProviderTool`、`normalizeDeepSeekToolChoice`；`DeepSeekAdapter.executeRequest` 和 `APIService.callWithFallback` 的 DeepSeek backend 均使用 canonical builder。 |
| 收敛模型能力事实 | DONE | `model-capability-v1` 继续从 `src/utils/model/deepseekV4Control.ts` 投影 DeepSeek V4 Flash/Pro/context/thinking/FIM 事实。 |
| 收敛 Pro 准入 | DONE | P1 未放宽 Pro；现有 model-capability/provider contract 验证继续证明 high budget 不直接触发 Pro，Pro admission 仍由 route evidence 控制。 |
| 收敛 usage/cost/cache 投影 | DONE/PARTIAL | `DeepSeekAdapter` request plan 与 trajectory store 仍是 route/cost/cache 入口；完整 dashboard 消费留到 P8。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/services/api/deepseek-adapter.ts` | 抽出 canonical DeepSeek chat completion body builder，统一 thinking/tool/tool_choice/response_format body。 |
| `src/dsxu/engine/api-service.ts` | DeepSeek backend 改为调用 canonical builder；非 DeepSeek fallback 仍保留为显式 fallback 边界。 |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 增加 APIService 请求体捕获测试，证明 DeepSeek backend 使用 canonical body shape。 |

#### P1 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` | PASS；2 tests / 16 expects |
| `bun test src/dsxu/engine/__tests__/model-capability-v1.test.ts` | PASS；6 tests / 28 expects |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | PASS；11 tests / 4548 expects |

#### P1 裁决

P1 状态：DONE。

P1 没有新增第二 provider runtime，也没有把 external/openai/ollama fallback 变成默认路径。DeepSeek 默认 backend 的 chat/tool/thinking body 现在由 `DeepSeekAdapter` canonical builder 生成；P2 可以在这个基础上继续做 cache-first 折叠和 prefix/tail 证据。

### 22.3 P2 Cache-first 折叠 - 历史记录：DONE - 2026-05-18

本轮按 V4 P2 执行 cache-first 主链收束。目标不是追求虚高命中率，而是让 DeepSeek cache 策略在默认 provider owner 内可解释、可审计、可阻断错误漂移。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| StablePrefixLock | DONE | `buildDSXUPromptPrefixCachePlan` 增加 `stablePrefixLock`；稳定前缀 hash 漂移没有 reason 时进入 blocking guard。 |
| DynamicRuntimeTail | DONE | 现有 dynamic tail 继续承载当前任务、验证、恢复、上下文压力、工具结果等动态状态；测试证明 stable hash 不随动态任务变化。 |
| ToolSchemaFreeze | DONE | cache plan 增加 `toolSchemaFreeze`；工具 schema hash 变化没有 reason 时进入 blocking guard。 |
| CacheEpoch | DONE | cache plan 增加 `cacheEpoch`；model/tool schema/source capsule/system discipline 变化可形成 epoch hash，缺 reason 时阻断。 |
| Warm Prefix | DONE/PARTIAL | `scripts/dsxu-live-cache-prefix-smoke.ts` 证明 source evidence 存在；本轮未调用 provider，不能当 live provider cache 成绩。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/dsxu/engine/prompt-prefix-cache-builder.ts` | 增加 StablePrefixLock、ToolSchemaFreeze、CacheEpoch 三个结构化 P2 产物，并把无 reason 漂移写入 guards。 |
| `src/dsxu/engine/prompt-prefix-cache-evidence.ts` | route trace evidence 增加 stablePrefixLockStatus、toolSchemaFreezeStatus、cacheEpochStatus、cacheEpochHash。 |
| `src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts` | 增加 stable/tool/epoch drift reason 硬验收。 |
| `src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts` | 验证 cache epoch/lock/freeze 状态进入 trace payload。 |

#### P2 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts` | PASS；5 tests / 38 expects |
| `bun test src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts` | PASS；4 tests / 37 expects |
| `bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts` | PASS；2 tests / 12 expects |
| `bun test src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts` | PASS；4 tests / 18 expects |
| `bun run scripts/dsxu-live-cache-prefix-smoke.ts` | DONE_EVIDENCED；sourceEvidenceExists=true；didCallProvider=false |

#### P2 裁决

P2 状态：DONE。

P2 没有新增 cache runtime，没有默认后台调用 provider，也没有把 cacheHitRate 当 90/95 发布硬门。当前完成的是 cache 策略主线化：stable prefix、tool schema、cache epoch 的漂移都必须带 reason，且进入 route trace evidence。真实 provider cache 数据仍归 P8 的 public comparable raw evidence 或后续 live-provider 专项。

### 22.4 P3 编辑生命周期默认化 - 历史记录：DONE - 2026-05-18

本轮按 V4 P3 执行编辑生命周期收束。目标不是新增第二套编辑引擎，而是把 FileWrite/FileEdit 已有的 TDD/SAST/post-mutation verification 证据收成一个可判断 final claim 的 Tool Gate / VerificationKernel envelope。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| FinalClaimPolicy | DONE | `PostMutationVerificationEnvelope` 增加 `finalClaimPolicy`，结论只允许 `READY_FOR_FOCUSED_CLAIM`、`NEEDS_FOCUSED_VERIFICATION`、`NEEDS_REVIEW`、`BLOCKED` 四类。 |
| 未验证不得 PASS | DONE | 只有存在通过的 `post-mutation-verification` gate，且所有记录 gate 都 PASS，`finalClaimAllowed` 才会为 true。 |
| skipped/partial 显性化 | DONE | skipped、partial、non-blocking fail 不会被归成 PASS，会进入 `NEEDS_REVIEW`，并在 lifecycle evidence 阶段显示。 |
| blocking fail 硬阻断 | DONE | blocking fail 进入 `BLOCKED`，保留 rollback 策略和 required evidence。 |
| 新写文件 rollback 边界 | DONE | 新写文件无 old content 时继续显示 `manual-review`，不伪装成可自动 rollback。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/dsxu/engine/post-mutation-verification-envelope.ts` | 增加 final claim policy，统一写后验证、review、rollback、evidence 的裁决口径。 |
| `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` | 增加 blocked、needs verification、needs review、ready claim 四种裁决验收。 |

#### P3 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` | PASS，4 tests / 35 expects |
| `bun test src/dsxu/engine/__tests__/verify-gate.test.ts` | PASS，11 tests / 24 expects |
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts` | PASS，6 tests / 21 expects |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | PASS，12 tests / 33 expects |

#### P3 裁决

P3 状态：DONE。

P3 没有新增 Write/Edit 工具，没有新增权限层，也没有把 advisory envelope 伪装成 full TDD。当前默认链更硬：写后如果没有真实验证证据，只能进入 `NEEDS_FOCUSED_VERIFICATION`；如果证据 skipped/partial，只能进入 `NEEDS_REVIEW`；只有真实 post-mutation verification PASS 后，才允许 final claim 引用该变更为已验证证据。

### 22.5 P4 Tool / Permission 结果统一 - 历史记录：DONE - 2026-05-18

本轮按 V4 P4 执行 Tool / Permission 结果统一。目标不是新增 ToolBus，而是宣布 `ToolCallResult` / Tool Envelope 为 canonical contract：provider message、MCP result、legacy result 只能在 DSXU Tool Gate 边界 normalize，之后 ledger、work-state、recovery、TUI、final report、release evidence 都必须消费 canonical 证据。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| Tool Gate boundary normalizer | DONE | 新增 `normalizeToolResultAtToolGateBoundary`，统一 `native`、`provider_message`、`mcp`、`legacy` 四类输入到 `ToolCallResult`。 |
| Contract evidence 同源 | DONE | boundary normalizer 同时返回 normalization evidence 与 `tool-result-contract` evidence。 |
| Tool lifecycle 归并 | DONE | `src/services/tools/toolLifecycle.ts` 改用统一 boundary normalizer，不再直接拼 provider tool_result contract。 |
| Tool evidence pack contract | DONE | `DsxuToolEvidencePack` 增加 `canonicalResultSchema`、`runtimeEventSchema`、`toolResultBoundaryKind`、`toolResultOutputChars`、`toolResultContractEvidence`。 |
| Work-state 投影 | DONE | tool evidence 投影到 visible state 时携带 canonical/result/runtime/boundary/outputChars，避免 UI/final report 再看 legacy shape。 |
| Legacy active consumer guard | DONE | validator 会拒绝 executed tool evidence 中缺失 canonical schema 的旧形态。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/dsxu/engine/tool-protocol.ts` | 增加 Tool Gate boundary normalizer 和统一 boundary result。 |
| `src/services/tools/toolLifecycle.ts` | 生命周期映射改用统一 Tool Gate boundary normalizer。 |
| `src/dsxu/engine/tool-evidence-pack-v1.ts` | 工具证据包接入 canonical ToolCallResult contract。 |
| `src/dsxu/engine/work-state-timeline.ts` | 可见状态投影显示 canonical tool result contract 关键信息。 |
| `src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts` | 增加 provider/MCP/legacy 统一边界验收。 |
| `src/dsxu/engine/__tests__/tool-evidence-pack-v1.test.ts` | 增加 evidence pack canonical contract 验收。 |

#### P4 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts` | PASS，14 tests / 104 expects |
| `bun test src/dsxu/engine/__tests__/tool-evidence-pack-v1.test.ts` | PASS，2 tests / 10 expects |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | PASS，10 tests / 74 expects |
| `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts` | PASS，3 tests / 13 expects |

#### P4 裁决

P4 状态：DONE。

P4 没有新增第二套 ToolBus，也没有让 MCP/provider/legacy 结果直接进入主链。当前结果路径更硬：四类工具结果只允许在 Tool Gate boundary normalize，执行后的 evidence pack 必须带 canonical schema；缺 canonical schema 的 executed tool evidence 会被 validator 标为无效，不能进入 release/final claim。

### 22.6 P5 Recovery 决策表 - 历史记录：DONE - 2026-05-18

本轮按 V4 P5 执行 Recovery 决策表收束。目标不是新增恢复 runtime，也不是做桥接适配，而是把 GearBox、FailureTaxonomy、VerifySummary、ProgressLedger 已有能力收成同一张 recovery decision table：失败必须有 action、ledger event、resume point、final claim 阻断。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| Recovery Decision Table | DONE | 在 `progress-ledger.ts` 增加 `RECOVERY_DECISION_TABLE`，覆盖 13 类 stall/failure signal。 |
| Stall 信号扩展 | DONE | 扩展 `tool_failure`、`validation_failure`、`timeout`、`workspace_boundary`、`model_failure`，让 FailureTaxonomy 不再散落在外。 |
| VerifySummary 收束 | DONE | `projectVerificationRecoveryDecision` 继续把 verification failure 写入 ledger + stall decision，阻断 final claim。 |
| FailureTaxonomy 收束 | DONE | 新增 `projectFailureRecoveryDecision`，把 normalized failure 直接归入 Recovery Decision Table。 |
| Ledger 记录 | DONE | 新增 `recordFailureRecoveryDecision`，失败决策写入同一 runtime event ledger，并保持可恢复状态。 |
| TUI/final report 投影 | DONE | 继续复用 `buildLongTaskLedgerProjection` 与 work-state timeline，不新增 UI 状态源。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/dsxu/engine/progress-ledger.ts` | 增加 Recovery Decision Table、FailureRecovery projection、failure decision ledger record。 |
| `src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | 增加 13 类信号覆盖、FailureTaxonomy -> recovery table -> ledger 验收。 |

#### P5 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，28 tests / 149 expects |
| `bun test src/dsxu/engine/__tests__/gear-box.test.ts` | PASS，11 tests / 29 expects |
| `bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts` | PASS，5 tests / 13 expects |
| `bun test src/dsxu/engine/__tests__/controlled-failure-taxonomy.test.ts` | PASS，1 test / 7 expects |

#### P5 裁决

P5 状态：DONE。

P5 没有新增第二套 recovery runtime。当前失败恢复更硬：verification failure、tool failure、permission loop、timeout、workspace boundary、context/cost pressure、agent timeout、tool result growth 都通过同一张 Recovery Decision Table 形成动作，并写入 ProgressLedger。只要 recovery/stall 仍存在，final claim 不允许通过。

### 22.7 P6 Agent Evidence Handoff - 历史记录：DONE - 2026-05-18

本轮按 V4 P6 执行 Agent/MCP/Skill 边界收束。目标不是新增 Agent runtime，而是保证 Agent 只作为 serial worker / bounded parallel fanout 的 evidence handoff；父任务最终只能引用 worker envelope，不允许 uncited transcript、swarm、standalone MCP/Skill runtime 进入主链。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| Agent worker envelope runtime validation | DONE | 新增 `validateDSXUAgentWorkerEvidenceEnvelope`，运行时检查 summary、owned scope、output path/hash、evidence id、parent citation、transcript budget。 |
| Parent synthesis guard | DONE | `buildDSXUAgentMcpSkillBoundaryBoard` 复用 runtime validation，父 final 没引用 worker evidence 时阻断 PASS。 |
| Transcript bloat guard | DONE | worker 返回 raw transcript 超过预算会被判为 boundary violation，不能当 handoff proof。 |
| Skill priority/conflict | DONE | 保持二级技能包 priority/conflict/discarded evidence 规则，不让 skill 覆盖 DSXU 主链。 |
| MCP adapter boundary | DONE | MCP 只作为 Tool Gate governed adapter intake，schema/redaction/doctor/permission boundary 缺失时阻断。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/dsxu/engine/agent-mcp-skill-boundary-board.ts` | 增加 agent worker evidence envelope runtime validation，并接入 boundary board。 |
| `src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | 增加 runtime envelope validation 与 transcript budget 验收。 |

#### P6 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | PASS，6 tests / 30 expects |
| `bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts` | PASS，1 test / 10 expects |
| `bun test src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts` | PASS，5 tests / 31 expects |
| `bun run scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts` | PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE，readyGuards=0，blockedGuards=8 |

#### P6 裁决

P6 状态：DONE。

P6 没有新增 agent orchestrator、swarm、manager mesh 或 standalone MCP/Skill runtime。当前 Agent/MCP/Skill 能力只能以 DSXU-owned evidence envelope、Tool Gate boundary、permission boundary、priority/conflict evidence 进入主链；uncited worker final、raw transcript bloat、standalone runtime claim 都会被阻断。

### 22.8 P7 TUI Trust Workbench - 历史记录：DONE - 2026-05-18

本轮按 V4 P7 执行 Trust UI 收束。目标不是新增第二套 TUI，而是把 Verification、Recovery、Ledger、Agent Evidence、Route/Cost/Cache、Tool Result 作为同源 trust projection 做短显示；长 evidence 进入 panel/report，不重复刷普通聊天区。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| Trust line compact cap | DONE | 新增 `compactDsxuTrustLine`，Trust footer/panel 行默认截断，避免窗口缩放或长 scope 导致刷屏。 |
| EvidenceLine suppression | DONE | `SystemTextMessage` 继续压制 `DSXU final usage evidence:`，并新增压制 `Evidence: deepseek-v4-flash | cost=... | cache=...` 这类模型成本/cache短证据行。 |
| Ledger/Agent/Proof panel 短显示 | DONE | 现有 `buildDsxuTrustPanelLines` 的 ledger、agent、proof 行统一走 compact cap。 |
| 真实 PTY resize 验收 | DONE | 只跑 P7 相关真实窗口场景，避免整份慢测试重复；trust proof、permission dialog、long content sticky bottom 均通过。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `src/components/PromptInput/PromptInputFooter.tsx` | Trust status/panel 统一短显示。 |
| `src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | 增加长 trust row 截断验收。 |
| `src/components/messages/SystemTextMessage.tsx` | 压制 DSXU evidence/cost/cache 行，避免普通聊天重复显示。 |
| `src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | 增加 `Evidence: deepseek-v4-flash | cost=... | cache=...` suppression 验收。 |

#### P7 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，7 tests / 26 expects |
| `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS，4 tests / 4 expects |
| `bun test src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts` | PASS，4 tests / 15 expects |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps DSXU trust proof"` | PASS，1 test / 21 expects，真实 PTY resize |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps permission review visible"` | PASS，1 test / 20 expects，真实 PTY resize |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps long-content TUI output pinned"` | PASS，1 test / 19 expects，真实 PTY resize |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts` | NOT_RUN_FULL，整文件慢测超过 120 秒预算，本阶段按 P7 相关场景分层验收，不把 timeout 当 PASS。 |

#### P7 裁决

P7 状态：DONE。

P7 没有新增第二套 TUI，也没有把 evidence 当普通聊天消息重复展示。当前 Trust UI 更接近高级程序员工作台：底栏短显示，ledger/agent/proof 进入 compact panel，模型 cost/cache evidence 不刷屏；真实 PTY resize 场景证明长内容、权限弹窗和 trust proof 不再因为窗口缩放丢失关键状态。

### 22.9 P8-A Evidence Dashboard / Release Trust Panel - 历史记录：PARTIAL - 2026-05-18

本轮按 V4 P8 执行第一段 Evidence Dashboard / Release Trust Panel 收口。目标不是把 V4 收束伪装成公开 benchmark，也不是手工抬高 scoreFloor，而是让 Evidence Dashboard 能读取 P0-P8 的工程收束状态，并在 Release Trust Panel 中明确区分：P0-P7 主链收束已完成，P8 的 dashboard intake 已完成，但公开对比 raw evidence、clean export、fresh install、final claim gate 仍未完成。

#### 已完成的开发动作

| 动作 | 状态 | 说明 |
|---|---|---|
| V4 consolidation evidence schema | DONE/PARTIAL | 新增 `dsxu.v4.consolidation-status.v1` 证据格式，记录 P0-P8 expected/completed stage、owner、evidence files、verification commands；P8 当前标记为 PARTIAL。 |
| Evidence dashboard intake | DONE | `scripts/dsxu-evidence-dashboard.ts` 增加 `v4Consolidation` 聚合，不把它计成 benchmark passRate，也不改 scoreFloor。 |
| Release Trust Panel 投影 | DONE | `releaseTrustPanel` 增加 `v4ConsolidationReady`，与 `mainlineAliasesReady`、public comparable missing cases、blocked gates 同屏显示。 |
| Claim boundary 保留 | DONE | `V4 consolidation` 只能支持 GitHub 工程结构/主链收束说明；公开 benchmark、90/95 对标、外部比较仍需 paired raw evidence、cost/cache、score protocol。 |
| Dashboard 单测 | DONE | 新增测试证明 V4 consolidation status 会显示为 ready，但不会生成 benchmarkResults，也不会自动允许 public claim。 |

#### Touched files

| 文件 | 目的 |
|---|---|
| `scripts/dsxu-evidence-dashboard.ts` | Evidence Workbench 读取 V4 consolidation status，并投影到 release trust panel。 |
| `scripts/__tests__/dsxu-evidence-dashboard.test.ts` | 增加 V4 consolidation 证据不冒充 public benchmark 的硬验收。 |
| `docs/generated/DSXU_V4_CONSOLIDATION_STATUS_20260518.json` | P0-P8 机器可读执行状态。 |
| `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json` | 最新 Evidence Workbench 输出。 |

#### P8 focused 硬验收

| 命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，7 tests / 33 expects |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS；scoreFloor=72，trust=release-blocked，v4ConsolidationReady=false，publicComparableMissingCases=30 |

#### P8-A 裁决

P8 状态：PARTIAL/BLOCKED。

P8-A 没有新增 benchmark runtime、release runtime 或 README 卖点生成器。当前 Evidence Workbench 更诚实：V4 P0-P7 主链收束和 P8 dashboard intake 可以被 dashboard 读取；但系统仍不会把 internal smoke、manifest-ready、V4 engineering consolidation 当成 public benchmark 或 90/95 claim。当前真实剩余阻断仍是 P8-B public comparable raw evidence 30 cases、P8-C release claim blocker、P8-D clean export artifact、P8-E fresh install/help/doctor/provider gate smoke、以及 86 个 NOT_RUN evidence 不能进入 GitHub claim。
### 22.10 P8-B Release Gate / Clean Export / Fresh Install - 历史记录：DONE - 2026-05-18

本轮按 V4 开发文档继续执行 P8 release closure。目标不是新增发布入口，也不是把内部 smoke 写成公开榜单，而是把工程收束结果落到真实 release gate、clean export artifact 和 fresh install smoke。

#### 已完成的开发/收口动作

| 动作 | 状态 | 说明 |
|---|---|---|
| Six-stage final release gate | DONE | `bun run test:six-stage-final` 已通过，20/20 commands PASS。覆盖 function、experience、recovery、performance、evaluation、release-closure 六阶段。 |
| Tool/Permission release blocker | DONE | PowerShell permission fast-path 归入现有 Tool Gate / PowerShell adapter owner；不新增权限层。 |
| Provider release blocker | DONE | API service / provider contract 统一到 canonical DeepSeek tool request body；不新增 provider runtime。 |
| Agent lifecycle release blocker | DONE | Agent worktree cleanup 归入现有 worktree owner，使用 bounded no-prompt git cleanup；slow owner 测试显式使用 slow timeout；Agent 临时 worktree fixture 从 `.dsxu/trace` 移到 `tmp`，避免证据库承载活跃 git worktree。 |
| Clean export artifact | DONE | `bun run release:clean-export-artifact` 已创建 zip，secret scan PASS。 |
| Fresh install/help/doctor/provider smoke | DONE | `bun run release:fresh-install-smoke` 已通过，8/8 commands PASS。 |
| Evidence dashboard status | DONE | `docs/generated/DSXU_V4_CONSOLIDATION_STATUS_20260518.json` 更新为 P0-P8 completed；仍保留 public benchmark/90/95 claim 边界。 |

#### P8-B 真实证据

| 证据 | 结果 |
|---|---|
| `docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json` | `PASS_V24_SIX_STAGE_FINAL_TESTS`，20/20 PASS。 |
| `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json` | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`，exportedFileCount=2869，zipSizeBytes=14547793，secretScanStatus=PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT。 |
| `docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json` | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`，8/8 PASS。 |

#### P8-B 裁决

P8 工程收束状态：DONE。

V4 可以支持 GitHub 工程卖点：owner-folded 主链、六阶段 release gate、clean export artifact、fresh install/help/doctor/provider smoke、secret scan PASS。

仍不能支持公开 90/95、外部 benchmark 胜出或正式 SWE/Terminal 榜单 claim。那些必须继续依赖 paired raw comparable evidence、score protocol、cost/cache/failure-recovery 全链路包。

---

## 23. V4 上线验收视角功能完成度复审（2026-05-19）

### 23.1 复审口径

本节不是从“是否有模块/测试/文档”角度审核，而是从 **默认主链上线验收** 角度审核：

- 高级程序员真实使用时，默认路径是否稳定、可信、少打扰。
- DeepSeek V4 Flash / Flash-MAX / Pro 混合路由是否真正进入主链，而不是只在局部测试或脚本中存在。
- 命中率、验证、恢复、Agent handoff、Evidence 是否能支撑“接近或超过 Claude Code 4.7 体验”的产品声明。
- 冻结/实验能力是否被默认隔离，避免 67+ 功能继续放大复杂度。

结论先行：**V4 方案文档已经成型，但代码侧只能判定为 Architecture-ready / Delivery-partial。不能直接声明 V4 已完成，也不能声明 90% 命中率已经达标。**

### 23.2 功能完成度矩阵

状态定义：

| 状态 | 含义 |
|---|---|
| DONE | 默认主链已有明确实现，并有测试或运行证据支持。 |
| PARTIAL | 能力存在，但不是单一路径、不是默认强制、或证据不足。 |
| NOT_DONE | 方案存在，代码主链未形成。 |
| RISK | 有实现，但可能增加复杂度、误触发、或影响高级程序员体验。 |
| HISTORICAL_ONLY | 历史记录显示做过，但需要重新跑当前代码确认。 |

| # | 能力域 | 真实状态 | 代码/现象依据 | 上线判断 | 需要补齐 |
|---:|---|---|---|---|---|
| 1 | DeepSeek Provider 路由 | PARTIAL | `query.ts` 已接入 `decideDeepSeekV4Route`，`deepseek-adapter.ts` 有 thinking/cache 字段处理。 | 路由主干存在。 | 每次发布前必须跑 provider contract，确认模型名、thinking、cache、上下文窗口、输出上限都是真实 API 行为。 |
| 2 | Flash / Flash-MAX / Pro 混合策略 | PARTIAL | `deepseekV4Control.ts` 有 workflow/route 判断，`query.ts` 有 thinking override。 | 有策略，不等于产品稳定分层。 | 把“何时升 Pro、何时禁止升 Pro、何时 Flash-only”写成硬路由表，并落入 Evidence。 |
| 3 | Prompt 瘦身与动态尾部 | PARTIAL | `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`、prompt-prefix-cache builder/evidence 已存在，相关测试通过。 | 缓存基础正确。 | 还缺默认主链的稳定前缀漂移审计，不能只靠单元测试证明长期命中率。 |
| 4 | 命中率优化 | PARTIAL | cache evidence、route cache dynamic tail、reasonix cache hardening 测试存在且通过。 | 能证明机制存在。 | 不能证明 90% 命中率已达标；必须输出冷/热会话分层曲线、stablePrefixHash 漂移次数、dynamicTail 变化原因。 |
| 5 | 工具窗口瘦身 | PARTIAL / RISK | `allowedTools`、filtered tools、benchmark allowedTools 已存在；但 `dsxuTransport.ts` 仍保留 schema 搜索可见性逻辑。 | 还不是全局硬帽。 | 默认 coding turn 必须输出 visibleToolCount，并保证主链可见工具 <=12；实验/MCP 长尾工具只能搜索后临时启用。 |
| 6 | Source Truth 主链 | PARTIAL | Read/Grep/Glob/LSP 存在，final gates 有 source/evidence 约束。 | 方向对。 | 需要“编辑前必须有来源证据”的统一 runtime gate，覆盖 Edit/Write/Notebook/脚本写入等路径。 |
| 7 | 默认编辑生命周期 | PARTIAL | `FileEditTool.ts`、`FileWriteTool.ts` 已接 post-mutation verification envelope。 | 核心写入路径已有门。 | 还要确认所有写路径都走 envelope；TDD/SAST/Review/Rollback 需要串成统一 lifecycle，不应分散在多个模块各自判断。 |
| 8 | Verification 默认阻断 | PARTIAL | query final gate、post-edit verify gate、parent-final gate 多处存在。 | 防虚报能力明显增强。 | 需要统一 `onFailure=block` 的默认配置来源；不能靠多处 final gate 分散兜底。 |
| 9 | Recovery / GearBox | PARTIAL / RISK | GearBox、verify-gate、final gate、recovery 相关逻辑存在。 | 能恢复，但不够单一。 | 建立统一 FailureTaxonomy + decision table；旧 recovery/forked/counterfactual 只能实验开关，不进默认主链。 |
| 10 | Durable Task Ledger | PARTIAL | progress-ledger、work-state timeline、runtime card 测试存在。 | 有账本雏形。 | 需要变成唯一任务账本：计划、工具事件、验证结果、恢复决策、成本路由都写同一 ledger。 |
| 11 | Agent Evidence | PARTIAL | `agentEvidencePacketSchema`、parent-final evidence gate、AgentTool 证据包逻辑存在。 | Agent 可信度开始可控。 | worker 输出必须统一 evidence envelope；父 Agent 只消费结构化证据，不消费自然语言承诺。 |
| 12 | Skills / MCP / Agent 边界 | PARTIAL / RISK | MCP、Skill、Agent 能力存在，但功能面很宽。 | 能力强，风险也高。 | 默认只保留 coding mainline；skills/MCP 通过搜索启用；swarm/team/voting/forked 默认冻结。 |
| 13 | TUI 信任界面 | PARTIAL | TUI footer/message 抑制、EvidenceLine、runtime card 方向存在；截图显示过密。 | 功能有，审美和信息层级不够。 | 底部只显示三类信息：模型/验证/下一步；详细 evidence 默认折叠，避免高级程序员被噪音干扰。 |
| 14 | Benchmark 分层 | PARTIAL | smoke/mock、dashboard、历史证据存在。 | 可内部验证。 | 必须明确 mock/smoke/internal/public 四层，不得把内部 smoke 当公开成绩。 |
| 15 | V4 历史完成记录 | HISTORICAL_ONLY | Section 22 有 P0-P8 历史 DONE/PARTIAL。 | 不能直接当当前完成证据。 | 需要在当前分支重新跑 H1-H12 和 V4 gate，更新结果后再改状态。 |
| 16 | 冻结/实验能力 | PARTIAL / RISK | `forked-agent`、`swarm`、`voting`、legacy tool-bus 仍可搜索到代码路径。 | 不是删除，而是边界未完全收敛。 | 冻结能力必须有 runtime guard、配置默认 off、测试证明默认主链不会进入。 |
| 17 | 发布可信度 | PARTIAL | clean export/fresh install 历史记录存在。 | 发布工程有基础。 | 仍被真实 benchmark、API contract、主链回归、冻结边界卡住。 |

### 23.3 上线阻断项

这些不是“可选优化”，而是 V4 如果要对外说稳定、高命中、接近 Claude Code 体验前必须解决的阻断项：

| 阻断项 | 当前风险 | 必须验收 |
|---|---|---|
| 默认可见工具过多 | 弱模型在工具面过宽时命中率下降，且 TUI/协议复杂度上升。 | coding 默认主链 `visibleToolCount <= 12`，并写入 Evidence。 |
| 命中率没有真实曲线 | 目前只能证明缓存机制存在，不能证明 90% 达标。 | 至少 20 个真实任务输出 cold/warm cache hit 曲线、stable prefix 漂移、route 分布。 |
| Recovery 多路径并存 | GearBox、verify-gate、final gate、legacy recovery 容易互相覆盖。 | 单一 FailureTaxonomy + decision table，所有恢复动作写 ledger。 |
| Agent 证据未完全结构化 | worker 自然语言汇报仍可能污染父任务判断。 | worker 必须返回 evidence envelope；父任务未收到 envelope 不允许 PASS。 |
| 冻结能力没有硬隔离 | forked/swarm/voting 等能力仍存在代码入口，可能误进默认链。 | 默认配置下测试证明不会进入；只有实验 flag 才可用。 |
| Prompt 仍可能变厚 | 继续堆规则会降低 Flash 命中率和缓存稳定性。 | 系统 prompt 只保留原则和协议；动态状态全部进 ledger/evidence/runtime card。 |
| TUI 信息层级不清 | EvidenceLine/Trust footer 信息过密，降低高级程序员信任感。 | 默认一行信任摘要 + 一行下一步；详细信息可展开。 |

### 23.4 V4 需要新增到验收标准的硬指标

V4 原计划已经有结构和模块，但还需要以下硬指标，否则“完成”没有产品意义：

| 指标 | 最低通过线 | 目标线 | 采集位置 |
|---|---:|---:|---|
| 默认可见工具数 | <=12 | 6-10 | Tool window evidence |
| Warm cache hit | >=80% | 88-92% | DeepSeek usage + cache evidence |
| Stable prefix 漂移 | 0 次未知漂移 | 0 次 | prefix hash ledger |
| 未验证完成声明 | 0 次 | 0 次 | final gate |
| 写入路径 verification envelope 覆盖率 | 100% 核心写入路径 | 100% 全写入路径 | Edit/Write/Notebook/Shell write gate |
| Agent 无证据 PASS | 0 次 | 0 次 | parent-final gate |
| Frozen feature 默认误入 | 0 次 | 0 次 | freeze guard tests |
| Recovery 决策无 ledger | 0 次 | 0 次 | recovery decision table |
| Public benchmark claim | 禁止 | L4 才允许 | benchmark gate |

### 23.5 对 V4 的专业裁决

| 维度 | 评分 | 说明 |
|---|---:|---|
| 架构方向 | 8.5/10 | 路由、缓存、证据、验证、Agent、TUI 方向正确。 |
| 默认主链收敛 | 5.8/10 | 能力多，但还没有全部收束成单一稳定路径。 |
| DeepSeek 命中率工程 | 5.5/10 | 机制存在，真实 90% 还没有证据。 |
| 高级程序员体验 | 6.2/10 | 信任组件有了，但 TUI 与工具面还偏重。 |
| 发布可信度 | 6.8/10 | 有历史 release/smoke 证据，但还不能承载公开性能声明。 |
| 综合实现完成度 | 5.8/10 | V4 文档完成，代码主链仍是 PARTIAL。 |

最终判断：

> V4 不应该再新增大模块。下一步不是扩功能，而是把已有能力压成一条 DeepSeek 友好的默认主链：小工具窗口、稳定 prompt 前缀、统一 ledger、统一 verification lifecycle、统一 recovery decision、结构化 Agent evidence、可折叠 TUI 信任界面。

### 23.6 V4 后续执行顺序调整

在继续任何发布/IP/商业化动作前，V4 后续应按以下顺序收口：

1. **工具窗口硬帽**：默认 coding turn 可见工具 <=12，并把 visibleToolCount 写入 Evidence。
2. **Prompt / Cache 命中率治理**：输出 stablePrefixHash、dynamicTailHash、cold/warm hit 曲线。
3. **统一编辑生命周期**：Edit/Write/Notebook/Shell write 全部进入 verification envelope。
4. **统一 Recovery 决策表**：GearBox、verify-gate、rollback、replan、abort 只走一个 decision table。
5. **Agent Evidence Envelope**：worker 不提交结构化证据，parent 不允许 PASS。
6. **冻结实验能力**：forked/swarm/voting/legacy tool-bus 默认 off，并有测试证明主链不进入。
7. **TUI 信任界面瘦身**：默认只显示模型、验证、下一步；详细证据折叠。
8. **真实任务命中率包**：至少 20 个真实 coding/long-task trace，作为 V4 是否达标的唯一依据。

这 8 项完成前，V4 的状态应标记为：

```text
V4_STATUS = LAUNCH_ACCEPTANCE_CLOSED_ENGINEERING_ONLY
PUBLIC_CLAIM_ALLOWED = false
BENCHMARK_CLAIM_ALLOWED = false
CACHE_90_CLAIM_ALLOWED = false
```

### 23.8 2026-05-19 默认主链复审收口记录

本轮不是把 V4 改成完成，而是先把 8 个上线验收阻断中的前 6 个从“有模块/有测试”推进到“默认主链有证据”。

| 阻断 | owner | 本轮处理 | focused 验收 | 状态 |
|---|---|---|---|---|
| 工具窗口硬帽 | Tool Window / Query Loop | 默认 selector 增加 `visibleToolHardCap`，GearBox 升档只能影响排序/评分，不能冲破默认可见工具硬帽；`tool_subset_selected` 事件和 long-task ledger 同时记录 `visibleToolCount`、`visibleToolHardCap`、`withinVisibleToolHardCap`。 | `bun test src/dsxu/engine/__tests__/engine.test.ts` PASS；`bun test src/dsxu/engine/__tests__/work-package-e/query-loop-profile.test.ts` PASS。 | DONE |
| Prompt / Cache 命中率治理 | DeepSeek Prompt/Cache Governance | cache break 不再只是 `console.warn`；显著 cache read drop 会写入 `cost-cache` ledger event，并带 `claimBoundary=cache-hit-rate-is-observed-evidence-not-a-v4-completion-claim`，避免把 dry-run 或局部命中率误写成 V4 达标。 | `bun test src/dsxu/engine/__tests__/engine.test.ts` PASS；`bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts` PASS。 | PARTIAL-DONE：治理证据已进主链；20+ real task hit-rate pack 仍未完成。 |
| 统一编辑生命周期 | Tool Gate / VerificationKernel | FileWrite/FileEdit 已有 post-mutation verification envelope；本轮继续把 `NotebookEditTool` 和 `BashTool` 的内部 simulated sed 写入接入同一套 envelope，并把 `finalClaimAllowed/reviewRequired/rollback/nextAction` 写回模型可见 tool result，避免 notebook/shell write 绕过默认编辑生命周期。 | `bun test src/dsxu/engine/__tests__/v4-edit-lifecycle.test.ts` PASS；`bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` PASS。 | DONE |
| 统一 Recovery 决策表 | Recovery / GearBox | GearBox 不再保留私有 verify recovery 分支；`reportVerificationSummary()` 通过 `projectVerificationRecoveryDecision()` 消费 `RECOVERY_DECISION_TABLE`，并在返回决策 metadata 中保留 `sourceRecoveryDecisionTable=true` 和 `dsxu.stall-recovery-decision.v1` envelope。 | `bun test src/dsxu/engine/__tests__/gear-box.test.ts` PASS；`bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` PASS；`bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts` PASS；`bun test src/dsxu/engine/__tests__/verify-gate.test.ts` PASS。 | DONE |
| Agent Evidence Envelope | Agent Evidence / MCP Skill boundary owner | 已有 agent boundary board、parent final gate replay、query-loop final gate、prompt governance gate。本轮按 V4 口径复审：无 summary/path/hash/evidence citation、partial evidence、raw transcript bloat、fake Done/PASS 都不能进入 parent PASS；有 cited concrete worker evidence 或 honest PARTIAL 才允许继续。 | `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` PASS；`bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts` PASS；`bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts -t "parent final gate"` PASS；`bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts -t "Agent parent final gate"` PASS。 | DONE：既有实现经 V4 复审签收。 |
| 冻结实验能力 | V4 Product Core Guard / Command Catalog | freeze register 明确冻结/默认关闭 voting、forked branch、swarm/team mesh、legacy ToolBus、多 recovery planner、多 prompt stack、standalone MCP/Skill runtime、background cache warmer、internal smoke-as-public-benchmark、generic package entrypoint expansion；Agent 模式测试把 swarm/debate/remote/fork/sendmessage 请求归一到 serial worker / parallel fanout；Tool Protocol 测试证明默认不进入产品 ToolBus。 | `bun test scripts/__tests__/dsxu-command-catalog.test.ts` PASS；`bun run scripts/dsxu-command-catalog.ts` PASS；`bun test src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts` PASS；`bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "Tool Protocol"` PASS。 | DONE |
| Evidence Workbench 防假完成 | Evidence / Release Claim Binder | `docs/generated/DSXU_V4_CONSOLIDATION_STATUS_20260518.json` 的 `launchAcceptanceStatus=DELIVERY_PARTIAL` 和 `v4HardBlockerClosure=6/8` 现在会让 dashboard 显示 `v4Consolidation=BLOCKED`，不再因为 P0-P8 旧阶段完成而显示 V4 完成。 | `bun run scripts/dsxu-evidence-dashboard.ts` PASS；`bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` PASS。 | DONE |

仍未关闭的上线验收阻断：

1. TUI 信任界面瘦身：真实窗口仍要证明默认只显示短 trust summary / next action，详细证据折叠，且 resize/弹窗/长输出不破坏交互。
2. 真实任务命中率包：至少 20 个真实 coding/long-task trace；输出 cold/warm cache、route、cost、toolResultChars、失败恢复，不允许用 dry-run 或 mock 代替。

更新后的状态：

```text
V4_STATUS = LAUNCH_ACCEPTANCE_CLOSED_ENGINEERING_ONLY
V4_LAUNCH_BLOCKERS_CLOSED = 8 / 8
PUBLIC_CLAIM_ALLOWED = false
BENCHMARK_CLAIM_ALLOWED = false
CACHE_90_CLAIM_ALLOWED = false
```

### 23.11 2026-05-19 V4 上线验收最终状态更正

本节为当前文件的最终裁决，覆盖 23.8/23.9 中保留的 7/8 历史状态。23.10 已关闭真实任务命中率包，`docs/generated/DSXU_V4_CONSOLIDATION_STATUS_20260518.json` 也已同步为 `launchAcceptanceStatus=PASS` 与 `v4HardBlockerClosure.closed=8/8`。Evidence Dashboard 复核结果为：

```text
v4Consolidation=PASS
completed=9/9
launch=8/8
missing=none
blocked=none
```

当前最终状态：

```text
V4_STATUS = LAUNCH_ACCEPTANCE_CLOSED_ENGINEERING_ONLY
V4_LAUNCH_BLOCKERS_CLOSED = 8 / 8
PUBLIC_CLAIM_ALLOWED = false
BENCHMARK_CLAIM_ALLOWED = false
CACHE_90_CLAIM_ALLOWED = false
```

仍然不能公开宣称的内容：

- 不能宣称外部公开 benchmark 已通过。
- 不能宣称 90/95 对标能力已经被公开协议证明。
- 不能宣称 cache 命中率 90% 已达标；当前真实聚合观察值是 64.9%。
- 不能把 internal smoke、历史 trace、dry-run 或 mock evidence 写成 GitHub 公开成绩。

下一步如果进入 GitHub 发布，需要优先处理 release claim blocker、公共同题 paired raw evidence、secret scan、fresh install、README claim binder 和最终分层发布测试。

### 23.10 2026-05-19 真实任务命中率包复审收口

本节关闭 V4 上线验收视角第 8 个 blocker：真实任务命中率包。这里的处理不是新增 benchmark runtime，也不是把内部 smoke 包装成公开榜单，而是由 Evidence / Release Claim Binder owner 聚合已经存在的真实 DSXU stream-json raw trace、final test artifact、cost/cache/tool usage 证据，形成可复核的内部上线验收包。

| 阻断 | owner | 本轮处理 | focused 验收 | 状态 |
|---|---|---|---|---|
| 真实任务命中率包 | Evidence / Release Claim Binder | 新增 `scripts/dsxu-v4-real-task-hit-rate-pack.ts`，只读取既有真实 raw trace 报告：`DSXU_HARD_ENGINEERING_BENCHMARK_20260517.json` 与 `DSXU_RAW_API_VS_DSXU_AB_20260516.json`。每个 case 必须有 DSXU raw transcript、final stdout/stderr artifact、stream-json result、usage/modelUsage/cache 字段；不足 20 个 trace-backed case 时直接 BLOCKED。 | `bun test scripts/__tests__/dsxu-v4-real-task-hit-rate-pack.test.ts` PASS；`bun run scripts/dsxu-v4-real-task-hit-rate-pack.ts` PASS。输出 `docs/generated/DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.json`、`.csv` 与 `docs/DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.md`。 | DONE |

真实聚合结果：

| 指标 | 结果 | 公开口径 |
|---|---:|---|
| trace-backed cases | 24 | 可写为内部 V4 上线验收样本量，不可写成公开榜单规模。 |
| finalPassRatePct | 95.8 | 可写为内部真实 trace 聚合结果，不可写成外部对标 95 分。 |
| secondAttemptRecoveryRatePct | 95.8 | 可写失败恢复链路样本结果，需同时保留 case 级 raw evidence。 |
| observed cacheHitRatePct | 64.9 | 只能写观察值与优化趋势，不能写 90% cache 命中已达标。 |
| totalCostUsd | 0.176034 | 可用于 GitHub 成本透明卖点，但必须说明样本与日期。 |
| totalToolResultChars | 163134 | 可用于工具结果压力与 artifact 化分析。 |
| proAdmissionCount | 0 | 可写 Flash-first 内部样本结果，不可推导所有复杂任务都无需 Pro。 |

最终状态：

```text
V4_STATUS = LAUNCH_ACCEPTANCE_CLOSED_ENGINEERING_ONLY
V4_LAUNCH_BLOCKERS_CLOSED = 8 / 8
PUBLIC_CLAIM_ALLOWED = false
BENCHMARK_CLAIM_ALLOWED = false
CACHE_90_CLAIM_ALLOWED = false
```

裁决：V4 的默认主链上线验收 blocker 已从工程侧关闭 8/8，但这不等于 GitHub 公开发布、外部 benchmark、90/95 对标声明已经放行。公开发布仍需走 release claim binder、fresh install、secret scan、公开可复跑对比协议与最终分层测试。

### 23.9 2026-05-19 TUI 信任界面真实窗口复审收口

本轮继续按 V4 默认主链上线验收口径处理第 7 个 blocker：TUI 信任界面瘦身。这里不把组件存在当完成，也不把单元测试当真实体验证明；必须覆盖真实 PTY 窗口缩放、长内容、权限审核框、滚动位置和短 evidence 显示。

| 阻断 | owner | 本轮处理 | focused 验收 | 状态 |
|---|---|---|---|---|
| TUI 信任界面瘦身 | Trust UI owner | 复审 `PromptInputFooter`、`SystemTextMessage` 与真实 TUI harness。默认聊天区继续抑制 `DSXU final usage evidence:` 和短 `Evidence: deepseek... cost/cache` 行；底栏 trust line 保持短显示，ledger/agent/proof 进入 compact 行；真实 PTY resize 证明长内容不抢顶、trust proof 不刷屏、权限审核框和边框缩放后仍可见，中间 scrollback 阅读位置不会被强制拉到顶部或尾部。 | `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` PASS；`bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` PASS；`bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "resize"` PASS，4 tests / 77 expects，真实 PTY resize。 | DONE |

仍未关闭的上线验收阻断：

1. 真实任务命中率包：至少 20 个真实 coding/long-task trace；输出 cold/warm cache、route、cost、toolResultChars、失败恢复，不允许用 dry-run 或 mock 替代。

更新后的状态：

```text
V4_STATUS = LAUNCH_ACCEPTANCE_CLOSED_ENGINEERING_ONLY
V4_LAUNCH_BLOCKERS_CLOSED = 8 / 8
PUBLIC_CLAIM_ALLOWED = false
BENCHMARK_CLAIM_ALLOWED = false
CACHE_90_CLAIM_ALLOWED = false
```
