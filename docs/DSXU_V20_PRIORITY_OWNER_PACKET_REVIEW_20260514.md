# DSXU V20 Priority Owner Packet Review - 2026-05-14

## Batch Purpose

This is the packet-level follow-up to `docs/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260514.md`. It applies the C2 priority mapping to the current dirty owner packets that were explicitly prioritized: OGR-06/12, OGR-05, OGR-07, then deletion mutation review.

No staging, committing, deleting, cleaning, or export was performed.

## Packet Decisions

| Packet | Current count | Shape | Decision | Remaining action |
|---|---:|---|---|---|
| `V20-OGR-06-ui-tui-visible-state` | 437 | `components=251`, `ink=94`, `hooks=83`, `buddy=6`, `screens=3` | Owner review accepted as visible-state projection queue. | Sign off path groups after confirming no UI/TUI direct tool/query/MCP/provider runtime entry. |
| `V20-OGR-12-shared-platform-utilities` | 249 | `utils=183`, `services=66` | Conditional accept. | Keep only utility code imported by named owners; unused or product-specific helpers become replace/delete candidates. |
| `V20-OGR-05-agent-task-lifecycle` + external adapter | 197 | `components=111`, `utils=32`, `hooks=13`, `tasks=10`, `services=8`, plus smaller task/command/state paths | Owner review accepted as mainline agent/task lifecycle and adapter boundary queue. | Sign off against `AgentTool`, `LocalAgentTask`, `RemoteAgentTask`, teammate/worktree/task evidence owners; external integrations stay adapter-only. |
| `V20-OGR-07-provider-migration-model-cost` | 101 | `services=31`, `utils=29`, `dsxu=15`, `commands=14`, plus constants/types/query/CLI/cost files | Owner review accepted as DeepSeek model/router/cost boundary queue. | Sign off only where default DSXU path enters DeepSeek adapter/router/cost evidence; provider-migration aliases remain intake/compat boundary only. |
| deletion-state review | 146 | `45 + 71 + 27 + 2 + 1` across five delete packets | Ready for Git mutation review, not yet mutated. | Close through explicit Git review after packet signoff. Do not restore old runtime files. |

## Cross-Signoff Rules Applied

1. `review_candidate` is not allowed to remain an unknown bucket.
2. Shared utilities are not an owner by themselves; they must be imported by a named owner.
3. UI/TUI can project state and collect user decisions, but cannot own tool execution, model routing, MCP lifecycle, or agent orchestration.
4. Agent/task lifecycle can use panes, teammates, mailbox permission, worktrees, and remote tasks, but cannot recreate the deleted local simulator or a second orchestrator.
5. Provider/cost work must land in DeepSeek adapter/router/cost evidence or provider-migration alias/intake. Provider fallback cannot become mainline.
6. Deleted old runtimes are not compatibility paths. If a missing behavior is discovered, it must be rebuilt in the named DSXU owner.

## Redline Evidence

- Old agent simulator active product scan: no active hits for `executeAgentTool`, `normalizeAgentToolInput`, `createAgentTaskLifecycleState`, `registerAgentTask`, `transitionAgentTask`, or `appendAgentTaskMessage`.
- Old engine MCP runtime scan: no active product import of deleted `engine/mcp-client`; `src/services/mcp` remains the MCP owner.
- Old provider fallback scan: only V20 guard tests reference `provider-backend`, `allowMainlineToolFallback`, `fallbackTool`, or `executionFallback`.
- UI/TUI direct runtime scan: no direct `buildTool(`, `executeTool(`, `runTool(`, `new QueryEngine(`, `new MCPManager(`, `new MCPConnection(`, or `Bun.spawn(` under UI/state surfaces.

## Current Status

These priority packets are now review-ready as named owner queues, not unknown work. They are not final PASS until the remaining 17 packets, deletion mutation review, ACL residues, real-gap productization, six-stage tests, release gate, and clean export all close.
