# Disabled Tungsten tool owner/Git review - 20260517

## Decision

- Packet: `V26-RD-tungsten-disabled-tool-owner-review`
- Status: `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`
- Target owner: `src/tools/TungstenTool`
- Replacement owner: `DSXU Tool Gate / terminal visible-state owners`
- Runtime references: 0
- Test references: 0
- Doc/generated references: 26
- Replacement evidence count: 5

## Rule

Review only. Disabled Tungsten must not be registered as a product tool. Runtime/test references must stay at zero before owner/Git replacement deletion.

## Runtime References

- None found.

## Test References

- None found.

## Doc / Generated References

- doc: `docs/DSXU_V20_MASTER_PLAN_20260514.md:1230` - - `TungstenTool` 不是 V20 产品能力，已显式标为 `DSXU Disabled Recovery Stub`，`isEnabled=false`，permission 永远 deny；后续 owner/Git review 应将其作为 replace/delete review candidate 或外部恢复构建专属项处理，不能作为隐藏 terminal runtime 留在主链。
- doc: `docs/DSXU_V20_OWNER_GIT_REVIEW_EXECUTION_20260514.md:914` - - `TungstenTool` 显式定性为 `DSXU Disabled Recovery Stub`，`isEnabled=false`，permission deny，具备 outputSchema 和 runtimeMetadata。
- doc: `docs/DSXU_V20_OWNER_GIT_REVIEW_EXECUTION_20260514.md:915` - - `src/Tool.ts` 删除 “TungstenTool doesn't define outputSchema” 的例外 TODO，避免旧 disabled stub 继续影响 Tool contract 设计。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3187` - 本节处理 Tool/Permission 主线中的另一个历史残留：`src/tools/TungstenTool/*`。结论不是直接删除，而是先关闭产品工具 registry 暴露，再把剩余 UI/state/tmux 引用做成阻断型 owner review。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3191` - \| registry closure \| `src/tools.ts` 移除 `TungstenTool` import 和 `process.env.USER_TYPE === 'ant' ? [TungstenTool] : []` 注册路径；禁用 stub 不再进入 `getAllBaseTools()`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3194` - \| owner review packet \| 新增 `scripts/dsxu-tungsten-disabled-tool-owner-review.ts`，生成 `docs/generated/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.json` 与 `docs/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.md`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3201` - \| `bun run scripts/dsxu-tungsten-disabled-tool-owner-review.ts` \| 9.60 初跑为 `BLOCKED_BY_RUNTIME_REFERENCES`，`runtimeReferenceCount=35`；9.61 复跑已降为 `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3202` - \| `rg "TungstenTool\|\[TungstenTool\]\|from './tools/TungstenTool" src/tools.ts src/constants/tools.ts src/dsxu/engine/__tests__/tool-definition-owner.test.ts` \| no matches；主工具 registry/test claim 已闭合。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3208` - 本节继续 9.60，不新增入口，不保留旧兼容面，把已经退出产品工具面的 Tungsten UI/state/tmux 残留全部收口到 DSXU terminal visible-state / Tool Gate 主线。`src/tools/TungstenTool/*` 本身仍不删除，等待显式 owner/Git mutation authorization。
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3212` - \| AppState cleanup \| `src/state/AppStateStore.ts` 移除 `tungstenActiveSession`、`tungstenLast*`、`tungstenPanel*` 状态字段；`src/state/onChangeAppState.ts` 移除旧 `USER_TYPE === 'ant'` 持久化分支；`src/utils/config.ts` 移除 `tungstenPanelVi
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3213` - \| UI cleanup \| `src/components/agents/ToolSelector.tsx`、`src/components/PromptInput/PromptInput.tsx`、`src/screens/REPL.tsx` 已不再 import/render `TungstenTool` 或 `TungstenLiveMonitor`，footer 不再暴露旧 tmux panel。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3215` - \| owner review packet \| `scripts/dsxu-tungsten-disabled-tool-owner-review.ts` 更新为 ready 口径；生成的 `docs/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.md` 与 JSON 显示 runtime/test references 均为 0。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3221` - \| `bun run scripts/dsxu-tungsten-disabled-tool-owner-review.ts` \| `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，`docReferenceCount=26`；doc/generated refs 会随本轮记录浮动，不影响 runtim
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3222` - \| `rg "Tungsten\\|tungsten\\|tmux panel\\|TungstenTool\\|TungstenLiveMonitor" src scripts package.json` \| 只剩 owner review script 与 `src/tools/TungstenTool/*` candidate owner 文件；产品 runtime 不再引用。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3224` - 当前裁决：Tungsten 线已经从“runtime 阻断”推进到“owner/Git replace/delete review ready”。下一步只能在明确 owner/Git mutation 授权后删除 `src/tools/TungstenTool/*`，否则继续作为历史源文件候选保留；不得重新作为 terminal runtime、permission runtime 或 README 卖点。
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.csv:7` - "product:V20-OGR-03-tool-permission-lifecycle:4","product","V20-OGR-03-tool-permission-lifecycle","40","git add -- ""src/tools/SkillTool/SkillTool.ts"" ""src/tools/SkillTool/UI.tsx"" ""src/tools/SleepTool/prompt.ts"" ""s
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json:60` - "command": "git add -- \"src/tools/SkillTool/SkillTool.ts\" \"src/tools/SkillTool/UI.tsx\" \"src/tools/SleepTool/prompt.ts\" \"src/tools/SyntheticOutputTool/SyntheticOutputTool.ts\" \"src/tools/TaskCreateTool/constants.t
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.csv:207` - "M","src/tools/TungstenTool/TungstenTool.ts","V20-OGR-03-tool-permission-lifecycle","high-risk-owner-review-required","prove-tool-permission-path-enters-single-tool-gate","previous-register","true"
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv:347` - "M","src/tools/TungstenTool/TungstenTool.ts","V20-OGR-03-tool-permission-lifecycle","high-risk-owner-review-required","prove-tool-permission-path-enters-single-tool-gate"
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv:352` - "M","src/tools/TungstenTool/TungstenTool.ts","V20-OGR-03-tool-permission-lifecycle","high-risk-owner-review-required","prove-tool-permission-path-enters-single-tool-gate","previous-register"
- generated-evidence: `docs/generated/DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.csv:44` - warning: in the working copy of 'src/tools/TungstenTool/TungstenTool.ts', LF will be replaced by CRLF the next time Git touches it
- generated-evidence: `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260515.csv:1258` - "V20-OGR-03-tool-permission-lifecycle","src/tools/TungstenTool/TungstenTool.ts","M","high-risk-owner-review-required","yes","no","1","yes","no","0","","OWNER_REDLINE_CLEAR_PENDING_GIT_SIGNOFF"
- generated-evidence: `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.csv:4268` - "src\tools\TungstenTool\TungstenTool.ts","12","stub_or_incomplete","OWNER_REVIEW","stub_or_deferred_owner_review","tool-lifecycle","classify as implemented, test-only, release-excluded, or required V24 owner work","owner
- generated-evidence: `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.csv:7256` - "src\dsxu\engine\__tests__\tool-definition-owner.test.ts","239","stub_or_incomplete","INFO_REVIEW","test_or_evidence_context_not_product_runtime","test-evidence-harness","keep as evidence/test context unless imported by 
- generated-evidence: `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.json:47112` - "path": "src\\tools\\TungstenTool\\TungstenTool.ts",
- generated-evidence: `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.json:79988` - "excerpt": "expect(tungsten?.owner).toBe('DSXU Disabled Recovery Stub')"

## Replacement Evidence

- `src/tools.ts`
- `src/constants/tools.ts`
- `src/dsxu/engine/__tests__/tool-definition-owner.test.ts`
- `src/tools/__tests__/tool-registry-simple-mode.test.ts`
- `src/tools/__tests__/tool-permission-owner-gate.test.ts`

## Next Action

owner/Git may approve replacement deletion or keep this packet as historical source only; do not stage/delete without explicit owner/Git mutation authorization
