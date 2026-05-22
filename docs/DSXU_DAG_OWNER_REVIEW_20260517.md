# DAG owner/Git replace-delete review - 20260517

## Decision

- Packet: `V26-RD-dag-owner-review`
- Status: `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`
- Target owner: `src/coordinator/dag`
- Replacement owner: `PlanGraph / Work-State owner`
- Candidate files: `src/coordinator/dag/index.ts`, `src/coordinator/dag/types.ts`, `src/coordinator/dag/templates.ts`, `src/coordinator/dag/runner.ts`, `src/coordinator/dag/persist.ts`, `src/coordinator/dag/__tests__/dag.test.ts`, `src/coordinator/dag/__tests__/persist.test.ts`
- Runtime references: 0
- Test references: 0
- Doc/generated references: 76
- Replacement evidence count: 4

## Owner Rule

Review only. DAG template behavior must be absorbed into DSXU work-state/PlanGraph evidence; do not stage, commit, delete, or clean files without explicit owner/Git mutation authorization.

## Runtime References

- None found outside the legacy owner.

## Test References

- None.

## Doc / Generated References

- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:29` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:29` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinato
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:32` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:31` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:31` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanG
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:32` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:37` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:34` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:42` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/service
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:35` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:44` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:70` - "excerpt": "本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/s
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:36` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:45` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:82` - "excerpt": "当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExe
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:37` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:46` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:88` - "excerpt": "当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible ev
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:39` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:41` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git revi
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:42` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:50` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:68` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/service
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:51` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:74` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVe
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:52` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:80` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:53` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:92` - "excerpt": "本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:54` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:116` - "excerpt": "当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `s
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:55` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:146` - "excerpt": "当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:56` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:158` - "excerpt": "\"excerpt\": \"本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\",",
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:57` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:164` - "excerpt": "\"excerpt\": \"当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:58` - - generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:170` - "excerpt": "\"excerpt\": \"当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/servic
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:231` - src/coordinator/dag/
- doc: `docs/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.md:287` - \| `src/coordinator/dag` \| Keep only as historical/harness evidence unless owner/Git approves delete; product PEV belongs to PlanGraph/work-state. \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3371` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3375` - \| `src/coordinator/dag` \| 真实引用只剩 DAG 单元测试、旧优化文档、历史 owner mutation preflight 记录；已不在 health/mainline。 \| `runDag()` 和 `PersistentDagRunner` 在没有显式 executor 时不再返回 “Real executor not yet wired” 的伪成功结果，而是失败并说明必须走现有 query-loop /
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3376` - \| `planExecuteVerifyDag` \| 当前仍是模板能力，不是产品运行时。 \| 保留为 harness/template evidence；不能写成 DSXU 已有第二套 DAG coordinator。后续若要产品化，必须并入现有 PlanGraph/work-state，而不是另起 coordinator。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3384` - \| `bun test src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` \| 21 pass / 0 fail / 50 expects。新增断言：无 executor 时不能伪成功。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3388` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candidate，不进入 GitHub 卖点。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3390` - ### 9.51 planExecuteVerifyDag 并入 work-state 投影 - 2026-05-17
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3392` - 本节完成 9.50 的第一项剩余动作：`planExecuteVerifyDag` 不再只是孤立 DAG 模板，也不形成第二套 coordinator runtime；它现在只能作为现有 work-state / PlanGraph 可见计划证据。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3398` - \| DAG 连接方式 \| `planExecuteVerifyDag()` 的 nodes 通过 `projectDSXUPlanTemplateToWorkStateEvents()` 投影到 timeline；这证明 DAG template 已被 work-state 吸收为计划结构证据，而不是第二套执行器。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3405` - \| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` \| 27 pass / 0 fail / 93 expects。新增断言：PEV 模板进入 work-state，且不出现 `Re
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3408` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3430` - \| `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` \| 2
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3482` - 本节按 9.54 之后的 owner packet 顺序处理旧 `src/coordinator/dag`。目标不是新增 DAG runtime，而是确认它已经从产品主链退到 harness-only / historical source，并把真正有价值的 PEV 可见性归到 DSXU work-state / PlanGraph owner。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3486` - \| work-state 断开旧 import \| `src/dsxu/engine/__tests__/work-state-timeline.test.ts` 不再 import `planExecuteVerifyDag`，改用 DSXU-owned PEV fixture 验证 `projectDSXUPlanTemplateToWorkStateEvents()`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3491` - \| mutation candidates \| `src/coordinator/dag/index.ts`、`types.ts`、`templates.ts`、`runner.ts`、`persist.ts`、`__tests__/dag.test.ts`、`__tests__/persist.test.ts`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3498` - \| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts` \| 3
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:64` - "excerpt": "- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:70` - "excerpt": "- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:32` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 Plan
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:76` - "excerpt": "- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:82` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:88` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 ow
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:94` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete r
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:100` - "excerpt": "- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:70` - \"excerpt\": \"本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\",",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:106` - "excerpt": "- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:82` - \"excerpt\": \"当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-s
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:112` - "excerpt": "- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:88` - \"excerpt\": \"当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:124` - "excerpt": "本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:136` - "excerpt": "当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candidate，不进入 GitHub 
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:142` - "excerpt": "当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:190` - "excerpt": "\"excerpt\": \"- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\",",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:196` - "excerpt": "\"excerpt\": \"- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:202` - "excerpt": "\"excerpt\": \"- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git r
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:208` - "excerpt": "\"excerpt\": \"本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\",",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:214` - "excerpt": "\"excerpt\": \"当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candid
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:220` - "excerpt": "\"excerpt\": \"当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。\",",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:226` - "excerpt": "\"excerpt\": \"\\\"excerpt\\\": \\\"本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\\\",\",",
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:232` - "excerpt": "\"excerpt\": \"\\\"excerpt\\\": \\\"当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 
- generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:238` - "excerpt": "\"excerpt\": \"\\\"excerpt\\\": \\\"当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:742` - "src/coordinator/dag/__tests__/dag.test.ts","199","Agent / task lifecycle owner","context-recovery;parallel-safe-dispatch;visible-work-state","review-replace-delete-or-archived-boundary","possible-old-or-second-layer-can
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:743` - "src/coordinator/dag/__tests__/persist.test.ts","84","Agent / task lifecycle owner","context-recovery;visible-work-state","review-replace-delete-or-archived-boundary","possible-old-or-second-layer-candidate;shell-side-ef
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:744` - "src/coordinator/dag/index.ts","14","Agent / task lifecycle owner","no-direct-reasonix-overlap","review-replace-delete-or-archived-boundary","possible-old-or-second-layer-candidate;shell-side-effect-gate-check","?? owner
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:745` - "src/coordinator/dag/persist.ts","231","Agent / task lifecycle owner","context-recovery;evidence-release-claim;permission-tool-gate;tool-call-repair;visible-work-state","review-replace-delete-or-archived-boundary","possi
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:746` - "src/coordinator/dag/runner.ts","230","Agent / task lifecycle owner","context-recovery;evidence-release-claim;parallel-safe-dispatch;permission-tool-gate;visible-work-state","review-replace-delete-or-archived-boundary","
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:747` - "src/coordinator/dag/templates.ts","112","Agent / task lifecycle owner","context-recovery","review-replace-delete-or-archived-boundary","possible-old-or-second-layer-candidate;shell-side-effect-gate-check","?? owner/Git 
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv:748` - "src/coordinator/dag/types.ts","43","Agent / task lifecycle owner","context-recovery;visible-work-state","review-replace-delete-or-archived-boundary","possible-old-or-second-layer-candidate;pro-admission-boundary-check;s
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6663` - "path":  "src/coordinator/dag/__tests__/dag.test.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6672` - "path":  "src/coordinator/dag/__tests__/persist.test.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6681` - "path":  "src/coordinator/dag/index.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6690` - "path":  "src/coordinator/dag/persist.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6699` - "path":  "src/coordinator/dag/runner.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6708` - "path":  "src/coordinator/dag/templates.ts",
- generated-evidence: `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json:6717` - "path":  "src/coordinator/dag/types.ts",
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json:555` - "path": "src/coordinator/dag/__tests__/dag.test.ts"
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json:559` - "path": "src/coordinator/dag/index.ts"
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json:563` - "path": "src/coordinator/dag/templates.ts"

## Replacement Evidence

- `src/dsxu/engine/work-state-timeline.ts`
- `src/dsxu/engine/__tests__/work-state-timeline.test.ts`
- `docs/DSXU_V26_MASTER_PLAN_20260515.md`
- `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json`

## Owner/Git Mutation Plan

- Authorization required: yes
- Mutation type: delete legacy DAG owner or retain as harness-only historical source
- Delete candidates:
  - `src/coordinator/dag/index.ts`
  - `src/coordinator/dag/types.ts`
  - `src/coordinator/dag/templates.ts`
  - `src/coordinator/dag/runner.ts`
  - `src/coordinator/dag/persist.ts`
  - `src/coordinator/dag/__tests__/dag.test.ts`
  - `src/coordinator/dag/__tests__/persist.test.ts`
- Preserve owner: `src/dsxu/engine/work-state-timeline.ts`
- Do not run automatically: true

Pre-mutation verification:
- `bun run scripts/dsxu-dag-owner-review.ts`
- `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts`
- `bun run scripts/dsxu-runtime-health.ts`

Post-mutation verification:
- `rg "coordinator/dag|planExecuteVerifyDag|PersistentDagRunner|runDag|linearDag|mapReduceDag|debateDag" src scripts package.json --glob "!scripts/dsxu-dag-owner-review.ts"`
- `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts`
- `bun run scripts/dsxu-runtime-health.ts`

## Next Action

owner/Git may approve replacement deletion or keep this packet as historical source only; do not stage/delete without explicit owner/Git mutation authorization
