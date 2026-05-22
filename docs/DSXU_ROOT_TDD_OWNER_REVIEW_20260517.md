# Root TDD owner/Git replace-delete review - 20260517

## Decision

- Packet: `V26-RD-root-tdd-owner-review`
- Status: `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`
- Target owner: `src/tdd.ts`
- Replacement owner: `Tool Gate / TDD post-mutation verification owner`
- Runtime references: 0
- Test references: 0
- Doc/generated references: 5
- Replacement evidence count: 7

## Rule

Review only. Root src/tdd.ts is a toy/demo helper and must not be treated as a DSXU TDD product entry. TDD behavior belongs to coordinator/tdd-gate and Tool Gate post-mutation evidence.

## Runtime References

- None found.

## Test References

- None found.

## Doc / Generated References

- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3145` - 本节继续处理“新增/历史小模块是否又形成多层入口”的问题。扫描发现顶层 `src/tdd.ts` 是历史 toy helper：没有 import/use 引用，语义也不属于当前 DSXU TDD 主线。真正的 TDD/post-mutation owner 已经是 `src/coordinator/tdd-gate`、`src/dsxu/engine/post-mutation-verification-envelope.ts`、Fi
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3150` - \| import/use 事实 \| `runtimeReferenceCount=0`，`testReferenceCount=0`；只剩本轮 V26/owner-review 文档引用，`src/tdd.ts` 不能再被当作产品 TDD 入口或 README 卖点。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3152` - \| mutation plan \| `authorizationRequired=true`，`doNotRunAutomatically=true`；候选为 `src/tdd.ts`，但本轮不删除、不 stage、不 commit、不 clean。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3159` - \| `bun build src/tdd.ts --target=bun` \| build 能通过，但这只证明文件可解析；不能证明它是产品能力。 \|
- doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3161` - 当前裁决：`src/tdd.ts` 已从“可能被误读的 TDD 入口”降为 replace/delete candidate。删除仍需 owner/Git mutation authorization；未授权前只保留为历史源文件，不进入公开 claim。

## Replacement Evidence

- `src/coordinator/tdd-gate/post-write-hook.ts`
- `src/coordinator/tdd-gate/gate.ts`
- `src/coordinator/tdd-gate/__tests__/gate.test.ts`
- `src/dsxu/engine/post-mutation-verification-envelope.ts`
- `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts`
- `src/tools/FileWriteTool/FileWriteTool.ts`
- `src/tools/FileEditTool/FileEditTool.ts`

## Owner/Git Mutation Plan

- Authorization required: yes
- Mutation type: delete root toy TDD helper or retain as historical source only
- Delete candidates:
  - `src/tdd.ts`
- Do not run automatically: true

Pre-mutation verification:
- `bun run scripts/dsxu-root-tdd-owner-review.ts`
- `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts`

Post-mutation verification:
- `rg "src/tdd.ts|handleEdgeCases|getCorrectResult|TDD门功能|TDD闂" src scripts package.json --glob "!scripts/dsxu-root-tdd-owner-review.ts"`
- `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts`

## Next Action

owner/Git may approve replacement deletion or keep this packet as historical source only; do not stage/delete without explicit owner/Git mutation authorization
