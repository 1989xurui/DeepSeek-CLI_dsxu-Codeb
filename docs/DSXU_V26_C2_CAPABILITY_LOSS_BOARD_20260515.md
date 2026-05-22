# DSXU V26 C2 Capability Loss Board - 20260515

Status: OPEN_V26_C2_CAPABILITY_LOSS_REVIEW_REQUIRED

## Why This Exists

V26 must not treat C2 1902 owner-disposition as feature parity. This board turns the 1902-file join into an execution queue for capability-loss review: product-specific rows, shared utilities, and review candidates are mapped to DSXU owners, capability loops, public claim status, and required V26 actions.

## Summary

| key | value |
| --- | --- |
| rows | 1902 |
| productSpecificRows | 594 |
| productSpecificRowsWithDirectDsxuPath | 545 |
| sharedUtilityRows | 278 |
| highPriorityReviewRows | 664 |
| blockedPublicClaimRows | 914 |
| c2LoopStatus | PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH |
| c2LoopPassedRows | 51 |

## By Risk Priority

| priority | count |
| --- | --- |
| P3 | 1103 |
| P1 | 494 |
| P0 | 170 |
| P2 | 135 |

## By Public Claim Status

| status | count |
| --- | --- |
| CLAIMABLE_ONLY_WITH_EXISTING_OWNER_EVIDENCE | 988 |
| NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED | 594 |
| NOT_CLAIMABLE_AS_FEATURE_UNTIL_IMPORT_USE_OR_NO_LOSS_PROVEN | 278 |
| NOT_CLAIMABLE_UNTIL_OWNER_DECISION_CLOSED | 42 |

## Capability Loop Coverage

| loop | label | v26Owner | rows | productSpecificRows | sharedUtilityRows |
| --- | --- | --- | --- | --- | --- |
| visible-work-state | Visible Work-State | V26-2 Senior Programmer Work-State Timeline | 1579 | 534 | 181 |
| tool-permission-lifecycle | Tool / Permission Lifecycle | V26-4 Tool / Permission / Recovery Mainline | 1520 | 543 | 214 |
| source-truth-coding | Source Truth / Coding Loop | V26-4 Source Truth Repair Loop | 1516 | 537 | 227 |
| context-memory-recovery | Context / Memory / Recovery | V26-2/V26-4 Long Task Recovery | 1394 | 506 | 178 |
| model-cost-cache | Model / Cost / Cache | V26-3 DeepSeek Runtime Excellence | 1464 | 580 | 197 |
| mcp-skill-ecosystem | MCP / Skill / Ecosystem | V26-5 Ecosystem Compatibility Capability Pack | 912 | 442 | 98 |

## Owner Priority Matrix

| ownerPacket | rows | p0 | p1 | p2 | p3 | productSpecific | sharedUtility | blockedPublicClaim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V20-OGR-12-shared-platform-utilities | 242 | 40 | 89 | 28 | 85 | 127 | 103 | 242 |
| V20-OGR-06-ui-tui-visible-state | 682 | 33 | 157 | 57 | 435 | 143 | 104 | 253 |
| V20-OGR-03-tool-permission-lifecycle | 310 | 33 | 57 | 11 | 209 | 89 | 12 | 101 |
| V20-OGR-04-mcp-skill-plugin-registry | 185 | 20 | 65 | 11 | 89 | 85 | 11 | 96 |
| V20-OGR-07-provider-migration-model-cost | 141 | 18 | 45 | 24 | 54 | 50 | 37 | 90 |
| V20-OGR-08-cli-command-transport | 176 | 8 | 43 | 0 | 125 | 48 | 3 | 60 |
| V20-OGR-09-dsxu-engine-mainline | 21 | 7 | 13 | 1 | 0 | 21 | 0 | 21 |
| V20-OGR-10-entry-query-tool-composition | 34 | 6 | 8 | 2 | 18 | 13 | 3 | 17 |
| V20-OGR-05-agent-task-lifecycle | 111 | 5 | 17 | 1 | 88 | 18 | 5 | 34 |

## Next Owner Slices

| ownerPacket | rows | p0 | p1 | productSpecific | sharedUtility | blockedPublicClaim |
| --- | --- | --- | --- | --- | --- | --- |
| V20-OGR-12-shared-platform-utilities | 242 | 40 | 89 | 127 | 103 | 242 |
| V20-OGR-06-ui-tui-visible-state | 682 | 33 | 157 | 143 | 104 | 253 |
| V20-OGR-03-tool-permission-lifecycle | 310 | 33 | 57 | 89 | 12 | 101 |
| V20-OGR-04-mcp-skill-plugin-registry | 185 | 20 | 65 | 85 | 11 | 96 |
| V20-OGR-07-provider-migration-model-cost | 141 | 18 | 45 | 50 | 37 | 90 |
| V20-OGR-08-cli-command-transport | 176 | 8 | 43 | 48 | 3 | 60 |
| V20-OGR-09-dsxu-engine-mainline | 21 | 7 | 13 | 21 | 0 | 21 |
| V20-OGR-10-entry-query-tool-composition | 34 | 6 | 8 | 13 | 3 | 17 |

## Top P0/P1 Review Rows

| priority | referencePath | disposition | owner | loops | publicClaimStatus |
| --- | --- | --- | --- | --- | --- |
| P0 | utils/sessionStorage.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | screens/REPL.tsx | product_specific_adapt_or_exclude | V20-OGR-06-ui-tui-visible-state | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/messages.ts | product_specific_adapt_or_exclude | V20-OGR-06-ui-tui-visible-state | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | cli/print.ts | product_specific_adapt_or_exclude | V20-OGR-08-cli-command-transport | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | main.tsx | product_specific_adapt_or_exclude | V20-OGR-09-dsxu-engine-mainline | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/attachments.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | services/mcp/client.ts | product_specific_adapt_or_exclude | V20-OGR-04-mcp-skill-plugin-registry | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | bootstrap/state.ts | product_specific_adapt_or_exclude | V20-OGR-09-dsxu-engine-mainline | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | components/PromptInput/PromptInput.tsx | product_specific_adapt_or_exclude | V20-OGR-06-ui-tui-visible-state | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | services/mcp/auth.ts | product_specific_adapt_or_exclude | V20-OGR-04-mcp-skill-plugin-registry | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/auth.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | commands/plugin/ManagePlugins.tsx | product_specific_adapt_or_exclude | V20-OGR-04-mcp-skill-plugin-registry | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/plugins/marketplaceManager.ts | product_specific_adapt_or_exclude | V20-OGR-04-mcp-skill-plugin-registry | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | tools/BashTool/bashPermissions.ts | product_specific_adapt_or_exclude | V20-OGR-03-tool-permission-lifecycle | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | components/LogSelector.tsx | product_specific_adapt_or_exclude | V20-OGR-06-ui-tui-visible-state | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/permissions/filesystem.ts | product_specific_adapt_or_exclude | V20-OGR-03-tool-permission-lifecycle | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/nativeInstaller/installer.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/ide.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | utils/config.ts | product_specific_adapt_or_exclude | V20-OGR-12-shared-platform-utilities | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |
| P0 | entrypoints/sdk/coreSchemas.ts | product_specific_adapt_or_exclude | V20-OGR-08-cli-command-transport | visible-work-state;tool-permission-lifecycle;source-truth-coding;context-memory-recovery;model-cost-cache;mcp-skill-ecosystem | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED |

## Rules

- Do not copy reference source, prompt text, UI copy, brand names, or commercial logic.
- Product-specific rows can only contribute generic DSXU mechanisms after owner review.
- Shared utility baseline/no-op rows must prove no DSXU behavior loss; otherwise implement a DSXU-owned equivalent.
- Public GitHub claims can only cite rows with DSXU implementation, tests, and live/TUI/API evidence.

## Files

- CSV: D:\DSXU-code\docs\generated\DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.csv
- JSON: D:\DSXU-code\docs\generated\DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.json
