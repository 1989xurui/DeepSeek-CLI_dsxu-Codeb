# DSXU V20 C2 x OGR Cross Signoff - 2026-05-14

## Scope

This record closes the first batch of V20-C2 x current worktree cross-signoff. It is not a final release PASS and it does not stage, commit, delete, clean, or export. Its purpose is to turn the remaining C2 priority buckets into named DSXU owner packets before deletion mutation review and final testing.

Inputs:

- `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv`
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv`
- `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv`
- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260514.csv`
- `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_SUMMARY_20260514.json`

## C2 Priority Result

| C2 bucket | Count | Batch decision |
|---|---:|---|
| `review_candidate` | 42 | No longer treated as unknown. Mapped to named DSXU owner packet or product-specific exclude/adapt review. |
| `review_absorb_as_shared_utility_only_if_imported` | 278 | Retain only if imported by a named DSXU mainline owner; otherwise mark replace/delete candidate. |
| Total | 320 | Cross-signed against current OGR packet map. |

Decision split:

| Decision | Count |
|---|---:|
| `map_to_named_dsxu_owner_for_absorption_review` | 35 |
| `retain_only_if_dsxu_mainline_imported_else_replace_delete_candidate` | 278 |
| `adapt_or_exclude_product_specific_after_owner_review` | 7 |

## Priority Packet Mapping

| Owner packet | C2 priority count | Current OGR packet count | Signoff decision |
|---|---:|---:|---|
| `V20-OGR-06-ui-tui-visible-state` | 106 | 437 | UI/TUI remains projection and operator state. No tool runner, query engine, MCP runtime, or provider runtime can live here. Shared utilities are retained only when imported by visible-state owner. |
| `V20-OGR-12-shared-platform-utilities` | 86 | 249 | Shared utility bucket is conditional. Keep only stable utilities with real owner imports; product-specific or unused helpers become replace/delete candidates. |
| `V20-OGR-05-agent-task-lifecycle` | 16 | 170 | Agent/task items map to mainline `AgentTool`, `LocalAgentTask`, `RemoteAgentTask`, teammate/worktree lifecycle, and task evidence owner. No local simulator or second orchestrator. |
| `V20-OGR-05-external-integration-adapter-boundary` | 0 | 27 | No direct C2 priority items in this pass, but current dirty paths still require signoff as adapter boundary only. No external host runtime is allowed. |
| `V20-OGR-07-provider-migration-model-cost` | 35 | 101 | Provider/model/cost items map to DeepSeek adapter, model router, cost evidence, provider-migration alias/intake, and credential boundary. No provider fallback can be mainline. |
| `V20-OGR-08-cli-command-transport` | 12 | 178 | CLI/transport review candidates map to entry/query/transport owner, not a separate runtime. |
| `V20-OGR-03-tool-permission-lifecycle` | 12 | 205 | Shared helpers only survive behind Tool Gate / Permission owner. |
| `V20-OGR-04-mcp-skill-plugin-registry` | 11 | 142 | Shared helpers only survive behind `src/services/mcp`, skill loader, or plugin registry owner. |
| `V20-OGR-13-other-source-owner-review` | 42 | 91 | Items not landing in the focused packets require explicit owner mapping before absorption. |

## Runtime Redline Scan

Targeted scan results for this batch:

| Redline | Result | Interpretation |
|---|---|---|
| Old agent simulator symbols: `executeAgentTool`, `normalizeAgentToolInput`, `createAgentTaskLifecycleState`, `registerAgentTask`, `transitionAgentTask`, `appendAgentTaskMessage` | No active product hits. Only `agent-action=` guard strings remain in tests. | OGR-05 does not retain the deleted local simulator path. |
| Old engine MCP runtime: `engine/mcp-client`, `MCPManager`, `MCPConnection` | Active hits are `src/services/mcp` mainline owner, test guard strings, and replace/delete metadata. | OGR-04 deletion candidate is not restored; MCP runtime owner is `src/services/mcp`. |
| Old provider fallback redlines: `provider-backend`, `allowMainlineToolFallback`, `fallbackTool`, `executionFallback` | Hits are V20 guard tests only. | OGR-07 does not expose old provider fallback as product mainline. |
| UI/TUI direct runtime execution: `buildTool(`, `executeTool(`, `runTool(`, `new QueryEngine(`, `new MCPManager(`, `new MCPConnection(`, `Bun.spawn(` | No product execution hits under UI/state surfaces. Regex `.exec()` parser calls are not runtime execution. | OGR-06 remains visible-state projection and user interaction. |

## Deletion Mutation Review Queue

The deletion-state register remains ready but not mutated through Git:

| Delete packet | Count | Decision |
|---|---:|---|
| `V20-OGR-02-delete-old-evidence-review-runtime` | 45 | Ready for delete signoff after owner review. |
| `V20-OGR-02-delete-old-provider-legacy-harness` | 71 | Ready for delete signoff after owner review. |
| `V20-OGR-02-delete-state-owner-review` | 27 | Ready for delete signoff after owner review. |
| `V20-OGR-03-delete-engine-builtin-tools-runtime` | 2 | Ready for delete signoff after owner review. |
| `V20-OGR-04-delete-engine-mcp-client-runtime` | 1 | Ready for delete signoff after owner review. |
| Total | 146 | Mutation pending; do not restore old runtimes. |

Rule: if an old deleted path contains equivalent behavior, keep the mainline replacement and close the deletion in Git review. If it contains different useful behavior, reimplement that behavior in the named DSXU owner packet. Do not recover old runtime files as compatibility holding paths.

## Current Gate

This batch upgrades C2 priority closure from "unknown bucket" to "owner-mapped signoff queue." It does not mark V20 PASS. Remaining order:

1. Finish packet signoff for OGR-06/12, OGR-05, OGR-07, and the rest of the 17 packets.
2. Then process the 146 deletion-state paths through explicit Git mutation review.
3. Then close ACL residues and V20 real-gap productization.
4. Only after that run six-stage real tests, final preflight, and clean export.
