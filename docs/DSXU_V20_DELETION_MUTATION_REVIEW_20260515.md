# DSXU V20 Deletion Mutation Review - 2026-05-15

本记录刷新当前 `147` 个 deletion-state paths。它不 stage、不 commit、不恢复旧 runtime；只确认删除态是否仍可进入显式 Git mutation review。

## Result

| Item | Count |
|---|---:|
| Total deletion rows | 147 |
| Ready rows | 147 |
| Active product source reference rows | 0 |
| Test/evidence reference rows | 1 |

## By Delete Packet

| Delete packet | Count | Active product refs | Test/evidence refs | Ready rows |
|---|---:|---:|---:|---:|
| `V20-OGR-02-delete-old-evidence-review-runtime` | 45 | 0 | 1 | 45 |
| `V20-OGR-02-delete-old-provider-legacy-harness` | 71 | 0 | 0 | 71 |
| `V20-OGR-02-delete-state-owner-review` | 27 | 0 | 0 | 27 |
| `V20-OGR-03-delete-engine-builtin-tools-runtime` | 2 | 0 | 0 | 2 |
| `V20-OGR-04-delete-engine-mcp-client-runtime` | 1 | 0 | 0 | 1 |
| `V20-OGR-12-delete-duplicate-desktop-deeplink-helper` | 1 | 0 | 0 | 1 |

## Replacement Owner Policy

| Replacement owner | Count |
|---|---:|
| `V20-OGR-03-tool-permission-lifecycle` | 8 |
| `V20-OGR-04-mcp-skill-plugin-registry` | 4 |
| `V20-OGR-05-agent-task-lifecycle` | 7 |
| `V20-OGR-07-provider-migration-model-cost` | 72 |
| `V20-OGR-09-dsxu-engine-mainline-or-evidence-owner` | 55 |
| `V20-OGR-12-shared-platform-utilities` | 1 |

## Rule

等价旧行为保持删除并由现有主线 owner 承接；如果发现不同且有价值的行为，只能重建到命名 DSXU owner，不能恢复旧文件作为 compatibility holding path。测试/证据文件可以证明旧路径应删除，但产品源码不能继续依赖旧路径。

Evidence files:

- `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260515.csv`
- `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_SUMMARY_20260515.json`
