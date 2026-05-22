# DSXU `andrej-karpathy-skills` 吸收审计与方案 - 2026-05-17

## 1. 结论

`D:/DSXU-external-analysis/andrej-karpathy-skills` 适合 DSXU，但适合方式不是“接入一个新 Skill / 新插件 / 新运行时”，而是把它抽象成 DSXU 自有的高级编程行为纪律，压回已有主链：

`CLI/TUI/API -> query-loop/work-state -> Action Contract -> Tool Gate/Permission -> code-mode surgical loop -> VerificationKernel/Evidence -> final report`

它最有价值的不是代码实现，而是四个行为约束：

1. 先暴露假设、歧义、取舍，再动手。
2. 不做投机抽象、不加第二套 runtime、不为单用例造层。
3. 改动必须手术式收口，每个 touched file 都能回到用户目标、owner、风险和验证。
4. 把任务转成可验证目标，失败后循环修复，不能用“看起来完成”替代证据。

这和 DSXU 目标一致，但必须按 DeepSeek-first 与 DSXU owner 方式吸收。不能把外部仓库的 `CLAUDE.md`、Cursor 规则或插件 metadata 直接放进 DSXU 产品面，避免品牌、商业、生态主链混乱。

## 2. 审计范围

外部文件已读：

| 文件 | 判断 |
| --- | --- |
| `README.md` / `README.zh.md` | 四原则说明、安装说明、品牌/生态引用，适合抽象，不适合原样进入产品。 |
| `CLAUDE.md` | 行为准则主体，适合转成 DSXU Action Contract 字段。 |
| `EXAMPLES.md` | 很有价值，给出隐藏假设、过度抽象、顺手重构、目标不清的反例。 |
| `CURSOR.md` / `.cursor/rules/karpathy-guidelines.mdc` | 适合提醒 DSXU 做“规则接入边界”，不适合复制 Cursor 规则。 |
| `skills/karpathy-guidelines/SKILL.md` | MIT skill metadata，但对 DSXU 来说不应作为一级技能运行时。 |
| `.claude-plugin/marketplace.json` | 只作为外部插件样本，不能进入 DSXU public claim。 |

DSXU 对应 owner 已核对：

| DSXU owner | 现有证据 |
| --- | --- |
| Action Contract | `src/dsxu/engine/action-contract.ts` 已有 goal、allowedFiles、nextTool、verificationCommand、fallbackPlan、scope fence、Product Core Guard 投影。 |
| Work-State Timeline | `src/dsxu/engine/work-state-timeline.ts` 已有 goal、plan、source_truth、tool、permission、failure、recovery、cost、agent、evidence、next_action。 |
| Product Core Guard | `src/dsxu/engine/workspace-policy.ts` 已有核心路径写/执行保护。 |
| Surgical Loop | `src/dsxu/engine/code-mode-surgical-loop.ts`、`blast-radius.ts`、`post-mutation-verification-envelope.ts` 已承载源码真值、影响面、写后验证。 |
| Verification / GoStop | `verify-gate.ts`、`go-stop-decision.ts`、`release-test-gate.ts` 已有测试/发布 gate。 |

## 3. 吸收判定

| 外部原则 | DSXU 裁决 | 原因 |
| --- | --- | --- |
| Think Before Coding | `P0 absorb` | DSXU 需要把假设、歧义、取舍、pushback 写成 Action Contract / work-state 字段。 |
| Simplicity First | `P0 adapt` | DSXU 用户明确要求不能“最小/偷懒”，所以这里不能理解成轻量实现；应翻译成“不加投机层、不加第二套 runtime、不做无 owner 重构”。 |
| Surgical Changes | `P0 absorb` | 与 DSXU owner 收口完全一致；需要加强 touched-file -> user request -> owner -> test 的证据链。 |
| Goal-Driven Execution | `P0 absorb` | 与 VerificationKernel / GoStop 一致；需要把 success criteria 变成复杂任务开工前硬字段。 |
| Claude/Cursor/Plugin 安装方式 | `exclude/adapted` | 这是别的产品生态入口。DSXU 只能学习机制，不能复制品牌入口或形成第二技能主链。 |

## 4. 不适合直接接入的内容

1. 不新增 `karpathy-guidelines` 作为 DSXU 一级 Skill。原因：会和现有 SkillRouter / MCP Registry / Action Contract 产生优先级冲突。
2. 不把 `CLAUDE.md` 作为 DSXU 项目配置文件。原因：这是外部产品命名和行为面，不是 DSXU-owned contract。
3. 不复制 Cursor `alwaysApply` 规则。原因：DSXU 已有 query-loop / Tool Gate / work-state，同样规则必须由 DSXU 主链投影。
4. 不在 GitHub README 写“Karpathy/Claude/Cursor 能力”。可以写“DSXU source-truth、scope-fence、verification-first coding discipline”，但要绑定真实证据。

## 5. DSXU 最优吸收方案

### P0-1 Action Contract v3：假设/取舍/成功标准进入同一合约

在现有 `src/dsxu/engine/action-contract.ts` 内扩展，不新建运行时：

| 字段 | 用途 |
| --- | --- |
| `assumptions` | 记录模型准备采用的解释，避免静默猜测。 |
| `ambiguities` | 记录高风险歧义；若无法从代码/上下文确认，必须 ask/block。 |
| `tradeoffs` | 记录为何选择当前方案，尤其是成本、复杂度、风险。 |
| `successCriteria` | 任务完成的可验证判断，不能只写“make it work”。 |
| `scopeFenceReason` | allowedFiles 的原因，防止范围随意扩大。 |

验收：

```powershell
bun test src/dsxu/engine/__tests__/action-contract.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

### P0-2 Simplicity Guard：从“少写代码”改成“无投机层/无第二运行时”

放入现有 Product Core Guard / replace-delete owner 证据，不做新 linter runtime：

| 检查 | 阻止的问题 |
| --- | --- |
| single-use abstraction smell | 为单一用例造 class/factory/registry。 |
| duplicate runtime smell | 新增 provider/tool/permission/MCP/agent 主链。 |
| speculative option smell | 加未要求的配置、fallback、兼容桶。 |
| ownerless module smell | 文件存在但无 import/use owner 或测试义务。 |

验收：

```powershell
bun test src/dsxu/engine/__tests__/product-core-guard.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts
```

### P0-3 Surgical Scope Ledger：每个 touched file 都有 owner 和理由

在 final patch report / post-mutation verification envelope 里补充：

| 证据 | 用途 |
| --- | --- |
| `requestedChangeId` | 对应用户目标。 |
| `owner` | 对应 DSXU 主链 owner。 |
| `whyTouched` | 为什么必须改这个文件。 |
| `verificationBinding` | 哪个测试/真实窗口/报告证明它没坏。 |
| `unrelatedChangeRisk` | 是否存在顺手改动风险。 |

验收：

```powershell
bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts src/dsxu/engine/__tests__/blast-radius.test.ts
```

### P0-4 Goal-Driven Execution：成功标准先行，测试只作证明

把 success criteria 作为复杂任务/多文件写入/发布 claim 的开工条件：

| 场景 | 处理 |
| --- | --- |
| bugfix | 必须有复现/失败信号/修复后验证。 |
| feature | 必须有 user-visible 行为和 owner/test。 |
| refactor | 必须有 before/after 行为不变证据。 |
| release claim | 必须绑定 source/test/live/raw/cost/cache。 |

验收：

```powershell
bun test src/dsxu/engine/__tests__/go-stop-decision.test.ts src/dsxu/engine/__tests__/verify-gate.test.ts src/dsxu/engine/__tests__/release-test-gate-v1.test.ts
```

### P1-5 TUI/CLI 可见化：不是最终报告才看见

把 Action Contract v3 的 assumptions/tradeoffs/successCriteria/scope ledger 投影到 work-state timeline。用户在真实窗口里应看到：

1. 当前目标。
2. 当前解释/假设。
3. 为什么不走更复杂方案。
4. 将要改哪些 owner。
5. 成功标准是什么。
6. 失败后怎么恢复。

验收：

```powershell
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts
```

并进入真实 DSXU TUI senior-coding window 回测，不允许只用单元测试冒充体验。

## 6. 与 DSXU 原目标的冲突处理

| 可能冲突 | DSXU 处理口径 |
| --- | --- |
| 外部原则说 minimum code | DSXU 不做轻量偷懒。翻译为“范围合适、owner 清楚、不加多余层、不漏验证”。 |
| 外部原则偏 caution over speed | DSXU 仍要果断执行。只有高风险歧义才 ask；普通任务用显式假设继续推进。 |
| 外部项目是 Claude/Cursor 生态 | DSXU 只吸收机制，不吸收品牌、不复制配置文件、不形成生态依赖。 |
| 外部项目是 prompt/rule 文件 | DSXU 不把 prompt 当功能完成；必须落到 code owner、tests、live evidence。 |

## 7. 执行顺序

1. `Action Contract v3`：补 assumptions / ambiguities / tradeoffs / successCriteria。
2. `Work-State Projection`：把 v3 合约投影到 TUI/CLI/final report 同源状态。
3. `Simplicity Guard`：补 speculative abstraction / duplicate runtime / ownerless module smell。
4. `Surgical Scope Ledger`：final report 和 post-mutation envelope 绑定 touched file 证据。
5. `Goal-Driven Gate`：GoStop / release claim / VerificationKernel 强制 success criteria。
6. `Real Senior-Coding Window`：用真实 DSXU 窗口跑复杂任务，看是否真的减少错误假设、过度抽象、顺手乱改、假完成。

## 8. 公开卖点边界

可以写：

- DSXU 有 source-truth first、scope fence、Tool Gate、VerificationKernel 和 work-state timeline。
- DSXU 在复杂编程任务前显示目标、范围、风险、成功标准和验证路径。
- DSXU 把“少做错事”作为高级编程体验的一部分：不加第二运行时、不做无 owner 代码、不把小测试当发布证明。

不能写：

- 不能写 DSXU 内置了 `andrej-karpathy-skills`。
- 不能写 DSXU 是 Claude/Cursor 插件兼容产品。
- 不能把外部 guideline 当成 DSXU 已完成能力。
- 不能把“simple”写成“轻量实现/最小验收”。

## 9. 当前状态

| 项 | 状态 |
| --- | --- |
| 外部文件审计 | 完成 |
| DSXU owner 映射 | 完成 |
| 是否适合 DSXU | 适合，作为行为纪律吸收 |
| 是否适合新增 runtime/Skill | 不适合 |
| 是否已完成代码吸收 | 未全部完成；现有 DSXU 已有基础，但 Action Contract v3、Simplicity Guard、Surgical Scope Ledger 仍需执行 |
| 是否可作为 GitHub 卖点 | 只能写 DSXU 自有机制，不能引用外部品牌 claim |

## 10. 机制级矩阵：不是轻量校验

为避免只停留在“四条原则”的浅层判断，已把外部样本拆成 32 个 DSXU 可验收行为点，输出到：

`docs/generated/DSXU_KARPATHY_SKILLS_MECHANISM_MATRIX_20260517.csv`

分布：

| 领域 | 行数 | 对 DSXU 的意义 |
| --- | ---: | --- |
| Think Before Coding | 8 | 处理隐藏假设、歧义、隐私/规模/性能解释，避免模型自作主张。 |
| Simplicity First | 8 | 翻译成 DSXU 的 owner 边界、无第二 runtime、无投机层、重复行为合并。 |
| Surgical Changes | 8 | 控制改动范围、changed-line 归因、Product Core Guard、blast radius。 |
| Goal-Driven Execution | 8 | 成功标准、失败复现、repair loop、final evidence、公开 claim 边界。 |
| Brand/License Risk | 2 | 控制品牌、插件、MIT 复用边界。 |

当前更细裁决：

| 状态 | 含义 |
| --- | --- |
| `implemented-partial` | DSXU 已有主链能力，但还要把证据投影补齐。 |
| `partial-existing` | DSXU 有相关 owner/测试，但还没形成强制验收纪律。 |
| `needs-code-or-test` | 不是要新增 runtime，而是要在既有 owner 内补字段、检查或测试。 |
| `needs-review` | 发布/许可证/品牌风险，需要 release claim binder 处理。 |

优先级：

1. `P0`：进入下一轮代码吸收，必须走现有 owner。
2. `P1`：进入真实 senior-coding window 和六阶段测试。
3. `P2`：只作为体验优化，不阻塞主线。

这张矩阵明确说明：`andrej-karpathy-skills` 不是“已经吸收完成”的 claim，而是一组可以压进 DSXU 主链的高价值行为验收项。执行时仍遵守原原则：不新增其它主链、不新增 skill runtime、不复制品牌配置、不用轻量测试冒充完整验收。
