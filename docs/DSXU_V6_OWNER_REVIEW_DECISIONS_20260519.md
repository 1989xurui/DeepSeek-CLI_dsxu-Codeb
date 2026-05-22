# DSXU V6 Owner Review Decisions - 20260519

- status: `PASS_V6_OWNER_REVIEW_DECISIONS`

This report closes the V6 `classify-before-claim` board into explicit owner review decisions. It does not move files, delete files, stage changes, or promote any row into a public product claim.

## Summary

| metric | value |
|---|---:|
| reviewedUnclassifiedRows | 208 |
| mainlineOwner | 96 |
| releaseOnly | 12 |
| legacy | 24 |
| evidenceOnly | 70 |
| deleteReview | 6 |
| remainingClassifyBeforeClaim | 0 |
| claimAllowedRows | 0 |
| modelPromptAllowedRows | 0 |

## Decision Rules

| decision | count | meaning |
|---|---:|---|
| mainline-owner | 96 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| release-only | 12 | Keep as release/config/documentation surface; do not expose to model prompt or product capability claim. |
| legacy | 24 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| evidence-only | 70 | Keep only as harness/test/evidence source; cannot become a product runtime or GitHub claim. |
| delete-review | 6 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |

## Blockers

- none

## First 80 Reviewed Rows

| path | owner | decision | activeImports | docs | nextAction |
|---|---|---|---:|---:|---|
| `src/commands/bridge/bridge.tsx` | Runtime Service Owner | delete-review | 1 | 10 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/coordinator/dag/persist.ts` | PlanGraph / Work-State Owner | delete-review | 0 | 10 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/coordinator/dag/templates.ts` | PlanGraph / Work-State Owner | delete-review | 0 | 10 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/coordinator/dag/types.ts` | PlanGraph / Work-State Owner | delete-review | 0 | 8 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/services/swe-bench/index.ts` | Evidence / Eval SWE Owner | delete-review | 0 | 9 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/services/swe-bench/types.ts` | Evidence / Eval SWE Owner | delete-review | 2 | 9 | Enter owner/Git mutation review; delete only after replacement evidence and explicit approval. |
| `src/coordinator/roles/contract.ts` | Frozen Agent Role Evidence Owner | legacy | 4 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/roles/index.ts` | Frozen Agent Role Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/roles/message.ts` | Frozen Agent Role Evidence Owner | legacy | 1 | 7 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/roles/orchestrator.ts` | Frozen Agent Role Evidence Owner | legacy | 1 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/roles/README.md` | Frozen Agent Role Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/roles/role-implementations.ts` | Frozen Agent Role Evidence Owner | legacy | 1 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/voting/clusterer.ts` | Frozen Agent Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/voting/contract.ts` | Frozen Agent Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/voting/similarity.ts` | Frozen Agent Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/coordinator/voting/voter.ts` | Frozen Agent Evidence Owner | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/engine/dsxu-retirement-plan.ts` | Query Loop / Execution Contract | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/engine/executor-openhands-adapter.ts` | Query Loop / Execution Contract | legacy | 0 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/engine/full-absorb-executor.ts` | Query Loop / Execution Contract | legacy | 0 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/engine/full-absorb.ts` | Query Loop / Execution Contract | legacy | 1 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/engine/runtime/example.ts` | Query Loop / Execution Contract | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/msa/embedding-ollama.ts` | Owner Review Queue | legacy | 2 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/msa/index.ts` | Owner Review Queue | legacy | 0 | 6 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/network/dsxuRelayProxy.ts` | Owner Review Queue | legacy | 1 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/network/index.ts` | Owner Review Queue | legacy | 0 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/network/proxyEnv.ts` | Owner Review Queue | legacy | 1 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/network/relayPolicy.ts` | Owner Review Queue | legacy | 3 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/local-work/core/task/entities/task.entity.ts` | Owner Review Queue | legacy | 1 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/local-work/core/task/services/task-engine.service.ts` | Owner Review Queue | legacy | 0 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/local-work/infrastructure/config/config.service.ts` | Owner Review Queue | legacy | 0 | 5 | Keep frozen outside default runtime; require explicit owner review before any default exposure. |
| `src/dsxu/control-plane/controlJwt.ts` | Control Plane / Operator State Owner | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/control-plane/controlMain.ts` | Control Plane / Operator State Owner | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/control-plane/controlMessaging.ts` | Control Plane / Operator State Owner | mainline-owner | 3 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/control-plane/inboundControlMessages.ts` | Control Plane / Operator State Owner | mainline-owner | 2 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/control-plane/operatorStateProjection.ts` | Control Plane / Operator State Owner | mainline-owner | 2 | 9 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/accessibility-tree.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/adapters/file-edit-adapter.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 8 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/adr-review.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/brief/brief-generator.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/bug-brain.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/bug-brain/index.ts` | Query Loop / Execution Contract | mainline-owner | 4 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/bug-brain/integration.ts` | Query Loop / Execution Contract | mainline-owner | 3 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/bug-brain/types.ts` | Query Loop / Execution Contract | mainline-owner | 7 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/checks-as-rules.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/circuit-breaker.ts` | Query Loop / Execution Contract | mainline-owner | 3 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/classify/classifier.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/coding-task-runner.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/compact/compact-pipeline.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/debug-tools.ts` | Tool Gate / Tool View | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/effort-routing.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/episode-memory.ts` | Query Loop / Execution Contract | mainline-owner | 3 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/file-watcher.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/formatters.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/frontmatter-parser.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/frontmatter-tool.ts` | Tool Gate / Tool View | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/git-tools.ts` | Tool Gate / Tool View | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/graph/graph-memory.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 8 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/graph/types.ts` | Query Loop / Execution Contract | mainline-owner | 4 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/lifecycle-protocol-manager.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/magic-docs-tool.ts` | Tool Gate / Tool View | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/magic-docs.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory-pipeline.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory-registry.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/episode-memory.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/memory-extractor.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/memory-registry.ts` | Query Loop / Execution Contract | mainline-owner | 4 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/memory-search.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/memory-system.ts` | Query Loop / Execution Contract | mainline-owner | 2 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/types.ts` | Query Loop / Execution Contract | mainline-owner | 7 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/unified-memory-manager.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/memory/utils.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/model-gateway-client.ts` | DeepSeek Provider / Cost Cache | mainline-owner | 1 | 6 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/model-limits.ts` | DeepSeek Provider / Cost Cache | mainline-owner | 4 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/parallel-tools.ts` | Tool Gate / Tool View | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/patch-engine.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/profiles/index.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/prompt-cache-break-detection.ts` | DeepSeek Provider / Cost Cache | mainline-owner | 2 | 4 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/prompt-profile.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 4 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/prompt-section-router.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 4 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
| `src/dsxu/engine/proxy-budget-guard.ts` | Query Loop / Execution Contract | mainline-owner | 1 | 5 | Keep under named DSXU owner; bind future claims to source/test/live evidence before release. |
