# Legacy SWE owner/Git replace-delete review - 20260517

## Decision

- Packet: `V26-RD-legacy-swe-owner-review`
- Status: `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`
- Target owner: `src/services/swe-bench`
- Replacement owner: `src/services/eval/swe-bench`
- Candidate files: `src/services/swe-bench/index.ts`, `src/services/swe-bench/runner.ts`, `src/services/swe-bench/types.ts`
- Runtime references: 0
- Test references: 0
- Doc/generated references: 31
- Replacement evidence count: 8

## Owner Rule

Review only. Equivalent duplicate behavior must be merged into the replacement owner or left as replace/delete candidate; do not stage, commit, delete, or clean files without explicit owner/Git mutation authorization.

## Runtime References

- None found outside the legacy owner.

## Test References

- None.

## Doc / Generated References

- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:29` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:30` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:32` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-s
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:31` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:33` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:37` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git revi
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:42` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:44` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:70` - "excerpt": "本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:45` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:82` - "excerpt": "当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:46` - - generated-evidence: `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json:88` - "excerpt": "当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-be
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2972` - 当前裁决：这批新增模块不再作为“新层”推进；它们已经被压回 Tool Gate、VerificationKernel、Evidence/Release、DeepSeek route/cost/cache owner。后续如果继续处理 DAG 或旧 `src/services/swe-bench`，必须做 import/use owner 归并或 replace/delete review，不能新增第三套 benchmark/runtim
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2982` - \| `src/services/swe-bench` \| 9.53 后 runtime/test 引用均为 0；与 `src/services/eval/swe-bench` 重复，仅剩历史文档/审查证据引用。 \| 旧 runner 输出曾增加 `publicBenchmarkClaimAllowed=false` 和 claim boundary；当前裁决升级为 replace/delete candidate，不再作为 test-o
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candidate，不进入 GitHub 卖点。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3017` - 本节处理 9.51 留下的第二个硬动作：旧 `src/services/swe-bench` 不再作为产品 benchmark/runtime 入口推进，必须按真实 import/use 证据进入 owner/Git replace-delete review。处理原则是只做审查包和证据，不 stage、不 commit、不 delete、不 clean。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3022` - \| 旧 SWE 审查脚本 \| 新增 `scripts/dsxu-legacy-swe-owner-review.ts`，扫描 `src`、`scripts`、`docs`、`package.json` 中对 `src/services/swe-bench` / `../swe-bench` / legacy runner API 的引用，生成 JSON/Markdown 审查包。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3038` - 当前裁决：旧 `src/services/swe-bench` 已从“可能误用的第二套 benchmark runtime”降为可审查的 replace/delete candidate。它不再进入 GitHub 卖点，也不再进入 release claim。下一步如果继续收口，应进入 owner/Git mutation authorization：批准后迁移或删除旧 test-only compatibility；未批准前保持现状并
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3042` - 继续 9.52 的 owner/Git 收口，本节不删除旧文件，而是先确认旧 `src/services/swe-bench/index.ts` 中有价值的 helper 语义已经并入新 owner，避免后续删除时丢掉测试/报告能力。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3068` - \| active doc truth \| `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md` 已改为只把 `src/services/eval/swe-bench` 写成 DSXU-owned SWE evaluation owner；旧 `src/services/swe-bench` 只作为 replace/delete candidate，不再写成 active adapter/runti
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3070` - \| mutation candidates \| `src/services/swe-bench/index.ts`、`src/services/swe-bench/runner.ts`、`src/services/swe-bench/types.ts`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3074` - \| post-mutation verification \| 删除授权后必须复查 `rg "../swe-bench\|src/services/swe-bench\|SWEBenchRunner\|createSWEBenchRunner\|runSWEBenchTask\|runSWEBenchBatch\|generateSWEBenchReport" src scripts package.json`，再跑 SWE owner tests 
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:68` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2976` - 本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:74` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:2993` - 当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 ow
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:80` - "excerpt": "- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3013` - 当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete r
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:92` - "excerpt": "本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。",
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:116` - "excerpt": "当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candidate，不进入 GitHub 
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:146` - "excerpt": "当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。",
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:158` - "excerpt": "\"excerpt\": \"本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。\",",
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:164` - "excerpt": "\"excerpt\": \"当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candid
- generated-evidence: `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json:170` - "excerpt": "\"excerpt\": \"当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。\",",
- generated-evidence: `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_20260515.csv:197` - "src/services/swe-bench/runner.ts","DeepSeek","1","product-source","configured-provider-brand-review","allowed-provider-reference-review"

## Replacement Evidence

- `src/services/eval/swe-bench/runner.ts`
- `src/services/eval/swe-bench/judge.ts`
- `src/services/eval/swe-bench/bridge.ts`
- `src/services/eval/swe-bench/contract.ts`
- `src/services/eval/swe-bench/__tests__/contract.test.ts`
- `src/services/eval/swe-bench/__tests__/runner.test.ts`
- `docs/generated/DSXU_SWE_INTERNAL_SMOKE_RESULTS_20260517.json`
- `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260517.json`

## Owner/Git Mutation Plan

- Authorization required: yes
- Mutation type: delete legacy owner
- Delete candidates:
  - `src/services/swe-bench/index.ts`
  - `src/services/swe-bench/runner.ts`
  - `src/services/swe-bench/types.ts`
- Preserve owner: `src/services/eval/swe-bench`
- Do not run automatically: true

Pre-mutation verification:
- `bun run scripts/dsxu-legacy-swe-owner-review.ts`
- `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts`
- `bun run scripts/dsxu-runtime-health.ts`

Post-mutation verification:
- `rg "../swe-bench|src/services/swe-bench|SWEBenchRunner|createSWEBenchRunner|runSWEBenchTask|runSWEBenchBatch|generateSWEBenchReport" src scripts package.json --glob "!scripts/dsxu-legacy-swe-owner-review.ts"`
- `bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts`
- `bun run scripts/dsxu-runtime-health.ts`

## Next Action

owner/Git may approve replacement deletion or keep this packet as historical source only; do not stage/delete without explicit owner/Git mutation authorization
