# DSXU Brand and Compatibility Risk Board

Generated at: 2026-05-17T00:00:00.000Z

This board classifies legacy provider, reference-brand, and compatibility call-sites. It does not delete or rewrite files. Product release can use it to decide what stays as DSXU-owned compatibility evidence and what needs owner cleanup.

## Summary

- Status: DONE_EVIDENCED
- Scanned files: 3570
- Occurrences: 6097
- Public surface blockers: 0
- Runtime cleanup candidates: 0
- Build-time DCE review: 280

## Disposition Counts

| Disposition | Count |
|---|---:|
| allowed-provider-compat-boundary | 338 |
| allowed-source-truth-evidence | 5398 |
| build-time-dce-review | 280 |
| test-evidence-allowed | 81 |

## Review Queue

| Disposition | Kind | Location | Match | Reason |
|---|---|---|---|---|
| build-time-dce-review | legacy-user-type-gate | src/bootstrap/state.ts:1575 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/cli/print.ts:506 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/cli/update.ts:302 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/commit-push-pr.ts:75 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/commit.ts:15 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/context/context-noninteractive.ts:17 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/cost/cost.ts:26 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/cost/index.ts:18 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/createMovedToPluginCommand.ts:63 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/feedback/index.ts:22 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/files/index.ts:7 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/init.ts:231 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/init.ts:247 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:94 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:117 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:139 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:230 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:1489 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:2231 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:2235 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:2847 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:3090 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:3114 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/insights.ts:3157 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/tag/index.ts:7 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/thinkback-play/thinkback-play.ts:13 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands/version.ts:17 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands.ts:48 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/commands.ts:336 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/components/MemoryUsageIndicator.tsx:8 | USER_TYPE is a build-time const[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/components/MemoryUsageIndicator.tsx:15 | USER_TYPE is a build-time const[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/components/permissions/hooks.ts:142 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/components/permissions/hooks.ts:169 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/betas.ts:32 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/keys.ts:6 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/oauth.ts:153 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:133 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:146 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:729 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:733 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:772 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:806 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:809 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/prompts.ts:812 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/constants/tools.ts:27 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useAfterFirstRender.ts:7 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useIssueFlagBanner.ts:96 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useIssueFlagBanner.ts:100 | USER_TYPE is a compile-time const[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useIssueFlagBanner.ts:102 | USER_TYPE is a compile-time const[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useIssueFlagBanner.ts:109 | USER_TYPE is a compile-time const[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/useManagePlugins.ts:200 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/hooks/usePromptSuggestion.ts:151 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/ink/termio/osc.ts:428 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/keybindings/loadUserBindings.ts:8 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/query/config.ts:61 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/query.ts:4742 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/datadog.ts:206 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:153 | USER_TYPE is '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:162 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:201 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:233 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:257 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:431 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:465 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:471 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:502 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:521 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:528 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:551 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:562 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:594 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:652 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:931 | USER_TYPE !== '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:957 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/featureFlags.ts:971 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/firstPartyEventLogger.ts:122 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/firstPartyEventLogger.ts:187 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/firstPartyEventLogger.ts:202 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/firstPartyEventLogger.ts:288 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |
| build-time-dce-review | legacy-user-type-gate | src/services/analytics/firstPartyEventLogger.ts:317 | USER_TYPE === '[legacy-user-type] | legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config |

## Safeguards

- public release files must not contain reference brand tokens
- legacy USER_TYPE gates are review debt unless proven build-time-only
- provider compatibility wording is allowed only inside DSXU-owned compatibility or source-truth evidence boundaries
- generated reports redact exact reference matches before human-readable publication
- this board does not delete, stage, or rewrite files; it creates owner review evidence
