# DSXU V7 Runtime Reachability Map - 20260519

- status: `PASS_DSXU_RUNTIME_REACHABILITY_MAP`

This map audits only the 98 `mainline-owner` rows from the V6 owner review board. Mainline owner means "owned by DSXU", not automatically "public product claim ready".

## Summary

| level | count |
|---|---:|
| R0 | 0 |
| R1 | 0 |
| R2 | 96 |
| R3 | 0 |
| R4 | 0 |

publicClaimAllowedRows: 0

## Blockers

- none

## First 80 Rows

| path | owner | reachability | activeImports | tests | publicClaimAllowed |
|---|---|---|---:|---:|---:|
| `src/dsxu/control-plane/controlJwt.ts` | Control Plane / Operator State Owner | R2 | 1 | 0 | false |
| `src/dsxu/control-plane/controlMain.ts` | Control Plane / Operator State Owner | R2 | 1 | 0 | false |
| `src/dsxu/control-plane/controlMessaging.ts` | Control Plane / Operator State Owner | R2 | 3 | 0 | false |
| `src/dsxu/control-plane/inboundControlMessages.ts` | Control Plane / Operator State Owner | R2 | 2 | 0 | false |
| `src/dsxu/control-plane/operatorStateProjection.ts` | Control Plane / Operator State Owner | R2 | 2 | 0 | false |
| `src/dsxu/engine/accessibility-tree.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/adapters/file-edit-adapter.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/adr-review.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/brief/brief-generator.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/bug-brain.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/bug-brain/index.ts` | Query Loop / Execution Contract | R2 | 4 | 0 | false |
| `src/dsxu/engine/bug-brain/integration.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/bug-brain/types.ts` | Query Loop / Execution Contract | R2 | 7 | 0 | false |
| `src/dsxu/engine/checks-as-rules.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/circuit-breaker.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/classify/classifier.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/coding-task-runner.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/compact/compact-pipeline.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/debug-tools.ts` | Tool Gate / Tool View | R2 | 2 | 0 | false |
| `src/dsxu/engine/effort-routing.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/episode-memory.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/file-watcher.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/formatters.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/frontmatter-parser.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/frontmatter-tool.ts` | Tool Gate / Tool View | R2 | 1 | 0 | false |
| `src/dsxu/engine/git-tools.ts` | Tool Gate / Tool View | R2 | 1 | 0 | false |
| `src/dsxu/engine/graph/graph-memory.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/graph/types.ts` | Query Loop / Execution Contract | R2 | 4 | 0 | false |
| `src/dsxu/engine/lifecycle-protocol-manager.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/magic-docs-tool.ts` | Tool Gate / Tool View | R2 | 1 | 0 | false |
| `src/dsxu/engine/magic-docs.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory-pipeline.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory-registry.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/memory/episode-memory.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory/memory-extractor.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory/memory-registry.ts` | Query Loop / Execution Contract | R2 | 4 | 0 | false |
| `src/dsxu/engine/memory/memory-search.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory/memory-system.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/memory/types.ts` | Query Loop / Execution Contract | R2 | 7 | 0 | false |
| `src/dsxu/engine/memory/unified-memory-manager.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/memory/utils.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/model-gateway-client.ts` | DeepSeek Provider / Cost Cache | R2 | 1 | 0 | false |
| `src/dsxu/engine/model-limits.ts` | DeepSeek Provider / Cost Cache | R2 | 4 | 0 | false |
| `src/dsxu/engine/parallel-tools.ts` | Tool Gate / Tool View | R2 | 1 | 0 | false |
| `src/dsxu/engine/patch-engine.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/profiles/index.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/prompt-cache-break-detection.ts` | DeepSeek Provider / Cost Cache | R2 | 2 | 0 | false |
| `src/dsxu/engine/prompt-profile.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/prompt-section-router.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/proxy-budget-guard.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/recovery/types.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/repo-brain.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/retry.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/reviewer-subagent.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/runtime/index.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/runtime/persist/adapter.ts` | Query Loop / Execution Contract | R2 | 7 | 0 | false |
| `src/dsxu/engine/runtime/persist/filesystem-adapter.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/runtime/persist/memory-adapter.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/runtime/session/model.ts` | DeepSeek Provider / Cost Cache | R2 | 7 | 0 | false |
| `src/dsxu/engine/runtime/task/runner.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/session-adapter.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/session-os-control.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/session-output.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/session-state.ts` | Query Loop / Execution Contract | R2 | 6 | 0 | false |
| `src/dsxu/engine/session.ts` | Query Loop / Execution Contract | R2 | 4 | 0 | false |
| `src/dsxu/engine/slash-commands.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/streaming.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/task-queue.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/telemetry.ts` | Query Loop / Execution Contract | R2 | 2 | 0 | false |
| `src/dsxu/engine/token-estimator.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/tool-bus/middleware.ts` | Tool Gate / Tool View | R2 | 1 | 0 | false |
| `src/dsxu/engine/tool-bus/types.ts` | Tool Gate / Tool View | R2 | 7 | 0 | false |
| `src/dsxu/engine/transaction-manager.ts` | Query Loop / Execution Contract | R2 | 3 | 0 | false |
| `src/dsxu/engine/ui-shell-contract-registry.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/verify-review-chain.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/worktree-orchestrator.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/dsxu/engine/wsl-execution-placement.ts` | Query Loop / Execution Contract | R2 | 1 | 0 | false |
| `src/services/embedding/chunker.ts` | Source Truth / Search Owner | R2 | 1 | 0 | false |
| `src/services/embedding/contract.ts` | Source Truth / Search Owner | R2 | 4 | 0 | false |
| `src/services/embedding/store.ts` | Source Truth / Search Owner | R2 | 1 | 0 | false |
