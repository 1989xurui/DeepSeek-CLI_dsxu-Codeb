# DSXU V20 Deletion Git Mutation Signoff - 2026-05-15

本记录把 `147` 个 deletion-state paths 从“ready for review”推进为“Git mutation review 已接受”。它仍然不 stage、不 commit、不 reset、不 clean，也不恢复旧 runtime；真实 `git status --short` 数字只有在后续显式 Git mutation/stage 后才会下降。

生成文件：

- `docs/generated/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_SUMMARY_20260515.json`

## Signoff 结果

| 项 | 数量 |
|---|---:|
| deletion rows | 147 |
| accepted keep-deleted rows | 147 |
| active product reference rows | 0 |
| test/evidence reference rows | 1 |

## Delete packet

| Packet | Rows | Signoff |
|---|---:|---|
| `V20-OGR-02-delete-old-evidence-review-runtime` | 45 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |
| `V20-OGR-02-delete-old-provider-legacy-harness` | 71 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |
| `V20-OGR-02-delete-state-owner-review` | 27 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |
| `V20-OGR-03-delete-engine-builtin-tools-runtime` | 2 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |
| `V20-OGR-04-delete-engine-mcp-client-runtime` | 1 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |
| `V20-OGR-12-delete-duplicate-desktop-deeplink-helper` | 1 | `ACCEPT_KEEP_DELETED_APPROVED_FOR_STAGE_WHEN_GIT_MUTATION_ALLOWED` |

## Replacement owner

| Replacement owner | Rows |
|---|---:|
| `V20-OGR-03-tool-permission-lifecycle` | 8 |
| `V20-OGR-04-mcp-skill-plugin-registry` | 4 |
| `V20-OGR-05-agent-task-lifecycle` | 7 |
| `V20-OGR-07-provider-migration-model-cost` | 72 |
| `V20-OGR-09-dsxu-engine-mainline-or-evidence-owner` | 55 |
| `V20-OGR-12-shared-platform-utilities` | 1 |

## 裁决

1. 这 `147` 条删除态没有 active product source reference。
2. 等价旧行为已经由命名 DSXU owner 承接，或只保留为 evidence/test 删除策略。
3. 如果后续发现差异且有价值的行为，只能重建到命名 DSXU owner，不能恢复旧文件作为 compatibility holding path。
4. 当前已完成 Git mutation review signoff；实际 stage/removal 必须等显式 Git mutation/stage 操作许可。

下一步进入 `4` 个 ACL residue 的外部权限/owner signoff，然后推进 real-gap acceptance 剩余项。
