# DSXU Blocked Claim Corpus - 2026-05-17

This corpus turns C2/1902 reference-risk rows, V18 capability boundaries, and hard-benchmark gaps into a release-claim safety dataset. It is used to keep GitHub copy, README claims, benchmark charts, and launch material tied to real DSXU evidence.

## Summary

- status: PASS_BLOCKED_CLAIM_CORPUS_GENERATED
- total rows: 958
- C2/1902 blocked rows: 914
- V18 capability claim-limited rows: 44
- hard benchmark blocked rows: 0

## Rules

- Blocked corpus is a release-claim safety artifact, not a feature-completion claim.
- Reference-product parity, public 90/95, external benchmark victory, standalone runtime, and copied brand claims remain blocked without same-task raw evidence.
- V18/V26 capability rows may be used as GitHub copy only within their allowed boundary and only with cited source/test/live/raw/cost evidence.
- Hard benchmark gaps block release claim evidence until rerun evidence shows all expected signals present.

## Source Counts

| source | rows |
| --- | ---: |
| c2-1902 | 914 |
| v18-capability | 44 |

## Top Owner Counts

| owner | rows |
| --- | ---: |
| V20-OGR-06-ui-tui-visible-state | 253 |
| V20-OGR-12-shared-platform-utilities | 242 |
| V20-OGR-03-tool-permission-lifecycle | 101 |
| V20-OGR-04-mcp-skill-plugin-registry | 96 |
| V20-OGR-07-provider-migration-model-cost | 90 |
| V20-OGR-08-cli-command-transport | 60 |
| V20-OGR-05-agent-task-lifecycle | 34 |
| V20-OGR-09-dsxu-engine-mainline | 21 |
| V20-OGR-10-entry-query-tool-composition | 17 |
| Code-mode repair / patch / verification owner | 13 |
| Tool/terminal lifecycle owner | 9 |
| Evidence / benchmark / public challenge owner | 8 |
| Deferred ecosystem boundary owner | 8 |
| Query loop / work-state / runtime owner | 3 |
| DeepSeek runtime / model-cost-cache owner | 3 |

## Sample Rows

| source | rowId | owner | claimRisk | blockedReason |
| --- | --- | --- | --- | --- |
| c2-1902 | assistant/sessionHistory.ts | V20-OGR-07-provider-migration-model-cost | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bootstrap/state.ts | V20-OGR-09-dsxu-engine-mainline | P0 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeApi.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeConfig.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeEnabled.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeMain.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeMessaging.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/bridgeStatusUtil.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/codeSessionApi.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/createSession.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/envLessBridgeConfig.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/inboundAttachments.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/inboundMessages.ts | V20-OGR-06-ui-tui-visible-state | P2 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/initReplBridge.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/pollConfig.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/pollConfigDefaults.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/remoteBridgeCore.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/replBridge.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/replBridgeTransport.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
| c2-1902 | bridge/sessionIdCompat.ts | V20-OGR-04-mcp-skill-plugin-registry | P1 | NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED; C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED |
