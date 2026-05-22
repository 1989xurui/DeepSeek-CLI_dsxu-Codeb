# DSXU V20 Deletion Mutation Review - 2026-05-14

## Scope

This review turns deletion-state evidence into a Git mutation queue. It does not stage or commit the deletions. It records that the paths are ready for explicit Git mutation review because active product imports have already been replaced by named DSXU owners.

Input/output:

- Input: `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv`
- Output: `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.csv`

## Decision

All `146` deletion-state paths are `READY_PENDING_GIT_MUTATION_REVIEW`.

| Packet | Count | Mutation decision |
|---|---:|---|
| `V20-OGR-02-delete-old-evidence-review-runtime` | 45 | Keep deleted; old evidence runtime is not product runtime. |
| `V20-OGR-02-delete-old-provider-legacy-harness` | 71 | Keep deleted; old provider harness is not DSXU mainline. |
| `V20-OGR-02-delete-state-owner-review` | 27 | Keep deleted after owner replacement review. |
| `V20-OGR-03-delete-engine-builtin-tools-runtime` | 2 | Keep deleted; mature tools live under `src/tools/*` and Tool Gate. |
| `V20-OGR-04-delete-engine-mcp-client-runtime` | 1 | Keep deleted; MCP runtime owner is `src/services/mcp`. |

## Restore Policy

No deleted file is restored as a compatibility path. If review finds different useful behavior, that behavior must be rebuilt in the named mainline owner:

- Tool behavior -> `V20-OGR-03-tool-permission-lifecycle`
- MCP behavior -> `V20-OGR-04-mcp-skill-plugin-registry`
- Agent behavior -> `V20-OGR-05-agent-task-lifecycle`
- Provider/cost behavior -> `V20-OGR-07-provider-migration-model-cost`
- Evidence/report behavior -> docs/generated or named DSXU evidence owner

## Next Action

The next action is explicit Git mutation review for these `146` paths. Only after that review is accepted should the deletions be staged. Final tests and clean export remain after owner/Git, deletion, ACL, and real-gap closure.
