# DSXU V20 P1 Product Signal Owner Cleanup

Date: 2026-05-14

Scope: continue `docs/DSXU_V20_MASTER_PLAN_20260514.md` after P0 source cleanup. The rule remains original-side closure: keep one DSXU mainline, absorb useful behavior into the correct owner, and remove or externalize old duplicate shells instead of preserving compatibility holding paths.

## 1. ANT-only Signal

- `ANT-ONLY` / `ANT_ONLY` / `ant-only` source signal: 0.
- Hard-coded old product condition `"external" === 'ant'`: 0.
- Retained DSXU-only behavior is now explicit DSXU internal behavior or disabled behind existing build/runtime gates.

## 2. Feature Flags Owner

Moved the remote config / kill-switch implementation into the DSXU feature-flags owner.

- `src/services/analytics/growthbook.ts` moved to `src/services/analytics/featureFlags.ts`.
- 119 import/use sites changed from `analytics/growthbook.js` to `analytics/featureFlags.js`.
- Caller-facing API renamed to provider-neutral names:
  - `initializeFeatureFlags`
  - `resetFeatureFlags`
  - `refreshFeatureFlagsAfterAuthChange`
  - `onFeatureFlagsRefresh`
  - `hasFeatureFlagEnvOverride`
  - `getAllFeatureFlags`
  - `getFeatureFlagConfigOverrides`
  - `setFeatureFlagConfigOverride`
  - `clearFeatureFlagConfigOverrides`

Closed old caller API names:

- `initializeGrowthBook`: 0
- `onGrowthBookRefresh`: 0
- `GrowthBookUserAttributes`: 0
- `analytics/growthbook.js`: 0
- `growthbook.ts` / `growthbook.js` path references: 0

Remaining `GrowthBook/growthbook` hits are implementation or evidence-only: vendor SDK implementation, generated telemetry schema, test deny-list, or self-hosted environment allow-list. They are not product caller paths.

## 3. Billing And Entitlement Owner

Moved billing access out of generic utilities and into the existing auth/service owner.

- `src/utils/billing.ts` moved to `src/services/auth/dsxuBillingAccess.ts`.
- All imports now target the auth/service owner.
- Product-facing helper names were replaced:
  - `hasProviderConsoleBillingAccess`
  - `hasProviderSubscriptionBillingAccess`
  - `hasDsxuProviderBillingAccess`
  - `setMockProviderBillingAccessOverride`

Closed old compatibility helper names:

- `hasLegacyCloudBillingAccess`: 0
- `hasDSXUAiBillingAccess`: 0
- `hasConsoleBillingAccess`: 0
- `hasDsxuBillingAccess`: 0
- `setMockBillingAccessOverride`: 0
- `src/utils/billing.js`: 0

## 4. Provider Subscription Auth Naming

Renamed subscription-account detection to a single provider-auth owner API.

- `isProviderSubscriptionAccount` is now the main predicate.
- Old caller names are closed:
  - `isLegacyCloudSubscriber`: 0
  - `isDSXUAISubscriber`: 0
  - `isCompatCloudSubscriber`: 0
  - `getCompatOAuthTokens`: 0
  - `getCompatOAuthAccountInfo`: 0
  - `getCompatProviderApiKeyWithSource`: 0

Removed unused old subscription config residue:

- `hasAvailableSubscription`: 0
- `subscriptionUpsellShownCount`: 0
- `recommendedSubscription`: 0

## 5. Provider OAuth UI Naming

Cleaned the non-MCP OAuth login UI path so it no longer exposes a legacy-cloud product subject where the real behavior is provider subscription authentication.

- `ConsoleOAuthFlow` state and props now use `loginWithProviderCloud` / `setLoginWithProviderCloud`.
- `LEGACY_CLOUD_LOGIN_METHOD` was renamed to `PROVIDER_SUBSCRIPTION_LOGIN_METHOD`.
- User-facing login copy now says provider subscription entitlement/account.
- `OAuthService.startOAuthFlow` no longer accepts the old `loginWithClaudeAi` compatibility option fallback; callers must use `loginWithProviderCloud`.
- CLI login handler now passes `loginWithProviderCloud` directly instead of the old dynamic compatibility request flag.
- Teleport login remediation now uses provider subscription account wording and the same provider subscription login method constant.

## 6. MCP Provider Migration Owner

Closed the MCP legacy-cloud cleanup item by mapping real source-provider protocol values into one explicit provider-migration adapter owner. The DSXU runtime stays under MCP/Skill/Plugin, Tool Gate, and DSXU Provider settings; provider migration is no longer represented as a second MCP runtime or separate permission surface.

- `src/constants/legacyProviderProtocol.ts` was moved to `src/constants/providerMigrationProtocol.ts`.
- `src/services/mcp/legacyRemoteMcpProvider.ts` was moved to `src/services/mcp/providerConnectorMigration.ts`.
- MCP permission relay no longer constructs provider-channel capability keys locally; provider migration capability/method constants now come from `providerMigrationProtocol`.
- `DSXU_ENABLE_LEGACY_*_MCP` was replaced by `DSXU_ENABLE_PROVIDER_MIGRATION_MCP` as the explicit migration gate.
- Old MCP code-surface scan is closed for the active MCP owner paths:
  - `LEGACY_*` / `legacy` / `legacy provider` / `legacy connector`: 0 in `src/services/mcp`, `src/components/mcp`, and `src/constants/providerMigrationProtocol.ts`.
  - `provider-migration-migration`: 0.
  - `isolatedLegacyShell`: 0.
  - `compatibility values` / `compatibility path`: 0.
  - `V18 ownership marker`: 0.

Retained source-provider wire strings are adapter protocol values only: transport names, channel methods, header names, and SDK metadata keys. Product runtime callers now route through DSXU MCP Provider policy, channel gates, connection manager, and tool lifecycle.

## 7. Provider Control Auth And Command Boundaries

Closed a second product-signal cluster where provider OAuth token access, config/env access, and model-router provider-prefix checks were still exposed through old compatibility names. The behavior remains provider-control / provider-migration boundary behavior, but callers no longer import compatibility-named helpers.

- `getCompatProviderAccessToken` -> `getProviderControlAccessToken`.
- `getCompatProviderTokens` -> `getProviderControlTokens`.
- `clearCompatProviderTokenCache` -> `clearProviderControlTokenCache`.
- `getCompatProviderBearerHeaders` -> `getProviderControlBearerHeaders`.
- `getCompatProviderBetaHeaders` -> `getProviderControlBetaHeaders`.
- `handleCompatProviderAuth401Error` -> `handleProviderControlAuth401Error`.

Touched callers include API bootstrap, HTTP/fast mode, MCP channel/provider-migration discovery, settings/remote-managed policy sync, team memory sync, voice, teleport, browser provider MCP, upgrade/logout/channel notices, and background remote preconditions.

Command runtime profiles now describe non-DSXU remote/provider behavior as provider-migration boundaries instead of legacy isolation buckets for `/cost`, `/extra-usage`, `/rename`, `/ultrareview`, login, upgrade, MCP add, and remote setup. This keeps old remote/provider paths out of the DSXU default runtime without inventing a second command owner.

RemoteTrigger migration code was also moved from `legacyRemoteTriggerProvider.ts` to `providerMigrationRemoteTriggerProvider.ts`; `RemoteTriggerTool` now calls `callProviderMigrationRemoteTriggerProvider` behind the existing explicit migration flag, while DSXU mode remains owned by `DSXU Remote Session Provider`.

The env/config boundary now uses provider-migration owner names:

- `getLegacyProviderConfigHomeDir` -> `getProviderMigrationHomeDir`.
- `isLegacyProviderServiceShellAllowed` -> `isProviderMigrationServiceShellAllowed`.
- `getCompatProviderConfigHomeDir` -> `getProviderMigrationConfigHomeDir`.
- `getCompatCodeEnv` -> `getProviderMigrationCodeEnv`.
- `isCompatCodeSimpleEnvTruthy` -> `isProviderMigrationCodeSimpleEnvTruthy`.
- `shouldCompatMaintainProjectWorkingDir` -> `shouldProviderMigrationMaintainProjectWorkingDir`.
- `getCompatVertexRegionForModel` -> `getProviderMigrationVertexRegionForModel`.

The model-router compatibility helper names were also closed:

- `supportsCompatProviderThinking` -> `supportsProviderMigrationThinking`.
- `supportsCompatAdaptiveThinking` -> `supportsProviderMigrationAdaptiveThinking`.
- `hasCompatProviderModelPrefix` -> `hasProviderMigrationModelPrefix`.
- `withCompatProviderModelPrefix` -> `withProviderMigrationModelPrefix`.
- `getCompatProviderInsightsAnalysisModel` -> `getProviderMigrationInsightsAnalysisModel`.

Focused production scan is closed for:

- `getCompatProvider` / `CompatProvider` / `compat provider`: 0 in `src` excluding generated types.
- `getLegacyProviderConfigHomeDir` / `isLegacyProviderServiceShellAllowed`: 0.
- `isolatedLegacyShell`, `Legacy Cloud`, `legacy cloud`, `old cloud MCP`: 0.
- `legacyIsolation`: 0 in command/service/utils runtime profiles.

## 8. Model Router Provider-Migration Owner

Closed the active model-router cleanup item by absorbing old model alias projection into the provider-migration owner instead of leaving a root-level compatibility helper.

- `src/utils/model/legacyModelCompat.ts` was moved to `src/utils/model/providerMigration/providerMigrationModelCompat.ts`.
- `src/utils/model/compat/` no longer contains active model-router files.
- `src/dsxu/engine/context-window-manager-v1.ts` now imports context-window overrides from `src/utils/model/providerMigration/providerMigrationContextWindowManager.ts`, not `src/dsxu/legacy`.
- `COMPATIBILITY_MAPPING` / `isCompatibilityModel` were renamed to `PROVIDER_MIGRATION_MODEL_MAPPING` / `isProviderMigrationMappedModel` in the DSXU engine.
- Hidden source-provider aliases now emit `projection_only=true` provider-migration evidence rather than a product compatibility runtime label.
- API error handling and WebFetch preapproved source-provider hosts now use provider-migration/source-token constant names while preserving the real external wire/env strings.

Closed old active model-router names:

- `legacyModelCompat` / `LegacyModelCompat` / `LEGACY_MODEL_COMPAT`: 0 in active source.
- `model/compat`: 0 in active model/API/tool owner paths.
- model-router `isCompat*`, `Compat*`, and `COMPAT_*`: 0 in `src/utils/model/providerMigration`, `src/utils/model/aliases.ts`, `src/utils/model/dsxuModel.ts`, `src/utils/extraUsage.ts`, `src/utils/pdfUtils.ts`, `src/dsxu/engine/model-config.ts`, `src/dsxu/engine/llm-adapter.ts`, `src/services/api/errors.ts`, `src/services/api/withRetry.ts`, and WebFetch/WebSearch owner paths.

One empty file remains blocked by ACL, not by product ownership:

- `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` contains only `export {}`.
- A copy exists at `D:\DSXU-code-quarantine\V20-old-source-20260514\src\dsxu\legacy\testing\legacyProviderMockRateLimits.ts`.
- `Move-Item` / `Remove-Item` still return permission denial, so this stays an external permission residue and not a runtime owner.

## 9. Rate-Limit Mock Provider-Migration Owner

Closed the active mock rate-limit compatibility folder by moving its real support behavior under a provider-migration mock owner.

- `src/services/mockRateLimitsCompat/legacyProviderMockRateLimits.ts` -> `src/services/mockRateLimitsProviderMigration/providerMigrationMockRateLimits.ts`.
- `src/services/mockRateLimitsCompat/legacyProviderRateLimitClaim.ts` -> `src/services/mockRateLimitsProviderMigration/providerMigrationRateLimitClaim.ts`.
- `src/services/mockRateLimits.ts` remains the single facade for `/mock-limits`; it now exports from the provider-migration mock owner.
- `src/services/rateLimitMocking.ts` imports `isProviderMigrationHighTierRateLimitClaim` and keeps the high-tier fallback simulation behind the existing mock-rate-limit path.

Closed old active mock-rate-limit names:

- `mockRateLimitsCompat`: 0 in active source.
- `legacyProviderMockRateLimits` / `legacyProviderRateLimitClaim`: 0 in active source.
- `isCompatHighTierRateLimitClaim`: 0 in active source.
- `LEGACY_RATE_LIMIT_*` / `LEGACY_HEADERLESS_*`: 0 in the provider-migration mock owner.

## 10. Carrier And Release-Gate Provider-Migration Owner

Closed several active carrier surfaces that were still using compatibility/legacy owner names while carrying real DSXU behavior.

- `src/utils/commitAttributionCompat.ts` was moved to `src/utils/commitAttributionProviderMigration.ts`.
- Commit attribution now imports `getProviderMigrationDsxuContribution`, `getProviderMigrationSourceEntrypoint`, `isProviderMigrationInternalModelRepoRemote`, and `sanitizeProviderMigrationModelName`.
- `/security-review` and other moved-to-plugin commands now describe the non-DSXU marketplace as a provider-migration source marketplace; DSXU mode still emits only DSXU plugin install instructions.
- `/install-slack-app` now uses `PROVIDER_MIGRATION_SLACK_APP_URL` and provider-migration Slack app wording.
- V18 proprietary/public-surface gates no longer expose `compat` buckets or `compat*JustifiedCount` fields; the evidence bucket is `provider_migration`, with `providerMigrationModelAliasJustifiedCount` and `providerMigrationProtocolJustifiedCount`.
- `v18-open-source-package-gate.ts` and its focused test were restored because release-surface and source-policy modules still import them; this is release/clean-export owner code, not old runtime junk.

Closed old active carrier names:

- `commitAttributionCompat`: 0.
- `getCompatDsxuContribution` / `getCompatLegacyEntrypoint` / `isCompatInternalModelRepoRemote` / `sanitizeCompatModelName`: 0.
- `legacy provider marketplace` / `legacy Slack migration` / `legacyPolicy`: 0 in the touched command/profile owners.
- `compatModelAliasJustifiedCount` / `compatProtocolJustifiedCount` / `isHiddenCompat*`: 0 in the touched V18 release gates and release-surface tests.

The broad `release-surface-v1` suite is still not a final-release PASS signal in the current dirty workspace: after restoring the package gate, focused package/source-policy tests pass, but the aggregate release-surface suite still reports existing global release review debt (`publicSurfaceReviewCount=405`, release provenance `reviewCount=14`). This is not being hidden by test rewrites.

## 11. Settings/Team-Memory Provider-Migration Carrier

Closed source-provider endpoint naming in settings sync, team memory sync, and remote-managed settings without changing the active DSXU owner.

- Settings sync uses `PROVIDER_MIGRATION_SETTINGS_SYNC_PATH` for the external source endpoint while DSXU settings ownership remains in the sync adapter.
- Settings sync key constants now use provider-migration source names instead of legacy-provider token names.
- Team memory sync uses `PROVIDER_MIGRATION_CODE_API_SEGMENT`, `PROVIDER_MIGRATION_TEAM_MEMORY_PATH`, and `providerMigrationEndpointPath`.
- Remote managed settings exposes `providerMigrationOverride` and the new `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS=1` flag.
- The old `DSXU_ENABLE_LEGACY_CLAUDE_REMOTE_SETTINGS=1` spelling is no longer accepted in active eligibility gating; use `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS=1`.

Closed old active sync-carrier names in the touched owners:

- `LEGACY_SETTINGS_SYNC_PATH`: 0.
- `LEGACY_TEAM_MEMORY_PATH` / `LEGACY_CODE_API_SEGMENT`: 0.
- `LEGACY_PROVIDER_TOKEN` / `LEGACY_CONFIG_DIR` / `LEGACY_INSTRUCTION_FILE`: 0 in settings sync types.
- `legacyEndpointPath` / `legacyOverride`: 0 in the touched sync/remote-managed profiles.
- `legacy provider endpoint` / `legacy provider settings`: 0 in the touched sync/remote-managed profile text.

## 12. Runtime Intake/Auth Provider-Migration Boundary

Closed the next active source-provider carrier batch without creating a new runtime path.

- `src/utils/instructionFiles.ts` now exposes `providerMigrationInstructions` and `PROVIDER_MIGRATION_INSTRUCTIONS_ENV`; source-provider instruction files are recognized only when the explicit provider-migration flag is set.
- `src/localRecoveryCli.ts` now names its external SDK/auth-token input as source-provider/provider-migration boundary data.
- Bundled skills and the DSXU guide agent now describe source-provider docs, API aliases, and scheduled-agent imports as provider-migration intake only; DSXU mode remains owned by DSXU API, Agent Runtime, MCP, and Remote Session Provider owners.
- CLI auth, provider auth, keychain prefetch, Settings UI, Bash permission allow-list, read-only validation, and teleport environment/API headers now use source-provider/provider-migration owner names while preserving the real external wire/env/header strings.
- Env compatibility, init, main entrypoint, update, and CCR transport now expose source-provider/provider-migration names for old env/header/package inputs while keeping DSXU as the default CLI/TUI mainline.
- The old provider remote trigger flag spelling is no longer accepted; the only active flag is `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_TRIGGER`.
- The old provider service-shell flag spellings are no longer accepted; the only active flag is `DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL`.

Closed old active names in this batch:

- `legacyProviderInstructions` / `LEGACY_PROVIDER_INSTRUCTION*` / `DSXU_LEGACY_INSTRUCTIONS_ENV`: 0 in `src/utils/instructionFiles.ts`.
- `LEGACY_API_SKILL_NAME` / `LEGACY_AGENT_SDK_PACKAGE` / `LEGACY_PROVIDER_SDK_IMPORT`: 0 in `src/skills/bundled/dsxuApi.ts`.
- `LEGACY_CLOUD_CONFIG_TYPE` / `isLegacyScheduleMigrationEnabled` / `DSXU_ENABLE_LEGACY_REMOTE_TRIGGER` literal: 0 in `src/skills/bundled/scheduleRemoteAgents.ts`.
- `legacyAgentType` / `legacyDocsPolicy`: 0 in `src/tools/AgentTool/built-in/dsxuCodeGuideAgent.ts`.
- `LEGACY_PROVIDER_API_KEY_ENV` / `LEGACY_CLOUD_AUTH_SOURCE` / `legacy_cloud`: 0 in `src/cli/handlers/auth.ts`.
- `LEGACY_PROVIDER_*` / `LEGACY_CLOUD_*` / `LEGACY_OAUTH_*` auth constants: 0 in `src/services/auth/dsxuProviderAuth.ts`.
- `clearLegacyApiKeyPrefetch` / `getLegacyApiKeyPrefetchResult`: 0 in the auth/keychain prefetch owner path.
- `LEGACY_BETA_HEADER` / `LEGACY_VERSION_HEADER` / `LEGACY_CLOUD_KIND`: 0 in `src/utils/teleport/api.ts` and `src/utils/teleport/environments.ts`.
- `LEGACY_PROVIDER_SCOPE_PREFIX` / `LEGACY_PROVIDER_TOKEN` / `LEGACY_CODE_ENV_PREFIX` / `legacyCodeEnv`: 0 in update and CCR transport owner paths.
- `DSXU_LEGACY_CODE_ENV_PREFIX` / `dsxuLegacyCodeEnv` / `DSXU_LEGACY_PROVIDER_SUBSCRIPTION_OPTION` / `LEGACY_CLOUD_MCP_TIMEOUT_MS`: 0 in `src/main.tsx`.
- `LEGACY_PRODUCT_NAME` / `LEGACY_CONFIG_ENV` / `legacyModelPrefix`: 0 in `src/utils/envCompat.ts`.

Remaining source-provider wording in the touched permission owner is now normalized to historical/fallback terminology, not source-provider runtime ownership.

## 13. Active Entrypoint/Control Provider-Migration Closure

Closed the active entrypoint/control/runtime intake batch so old compatibility names no longer define a product runtime owner. Real external source-provider wire strings are still preserved where required, but only as provider-migration intake values behind DSXU-owned gates.

- `src/dsxu/control-plane/controlCompatProtocol.ts` was moved to `src/dsxu/control-plane/controlProviderMigrationProtocol.ts`.
- `src/utils/configCompat.ts` was moved to `src/utils/configProviderMigration.ts`.
- `src/migrations/dsxuLegacyModelMigrations.ts` was moved to `src/migrations/providerMigrationModelMigrations.ts`.
- The model-migration boundary test was moved from `legacy-provider-model-migration-boundary-v1.test.ts` to `provider-migration-model-migration-boundary-v1.test.ts`.
- `src/entrypoints/init.ts` and `src/main.tsx` now use `shouldLoadProviderMigrationServiceShell()` / `blockProviderMigrationServiceShell()` instead of legacy shell gate names.
- `src/main.tsx` now uses source-provider constants for the old desktop/VSCODE/cloud subscription aliases; the DSXU default CLI/TUI remains the single entrypoint.
- `src/cli/print.ts` now uses `DSXU_PROVIDER_MIGRATION_*` control-plane constants and `providerMigrationOAuth` for the control-channel OAuth flow.
- `src/utils/env.ts`, `src/utils/nativeInstaller/download.ts`, `src/utils/doctorDiagnostic.ts`, and native installer comments now use source-provider/provider-migration naming for external fallback locations.
- `src/tools/BriefTool/*` and `src/utils/conversationRecovery.ts` now use `BRIEF_TOOL_ALIAS_NAME` for the `Brief` alias instead of a legacy owner label.
- Environment and permission owners now use source-provider names for external fallback values: `constants/system.ts`, `managedEnvConstants.ts`, `remoteIO.ts`, `transportUtils.ts`, `QueryEngine.ts`, `coordinatorMode.ts`, `services/tools/toolOrchestration.ts`, `services/vcr.ts`, `utils/swarm/spawnUtils.ts`, `FileEditTool/constants.ts`, and `utils/permissions/filesystem.ts`.
- Plugin marketplace reservation code now uses source-provider marketplace names rather than legacy vendor owner names; the real reserved marketplace strings are preserved.
- V18 release/public/provenance gates now use `SOURCE_REFERENCE_*` constants for original-source detection; no product runtime gate is named as a legacy product owner.
- Entrypoint/remote IO comments and error text now describe source-provider/provider-migration boundaries, not legacy or compatibility runtime paths. Remaining `forwards-compat` mentions are schema-version tolerance notes, not product owner labels.

Closed old active names in this batch:

- `controlCompatProtocol` / `configCompat`: 0 in active source.
- `DSXU_COMPAT_*` / `COMPAT_1M`: 0 in active source.
- `shouldLoadLegacyProviderServiceShell` / `populateLegacyOAuthAccountInfoIfAllowed`: 0 in active source.
- `dsxuLegacyModelMigrations` / `runLegacyProvider*` / `shouldSkipLegacyProviderMigration`: 0 in active source.
- `compatOAuth` / `compat_oauth_authenticate` / `compat sync_plugin_install`: 0 in active source.
- `LEGACY_BRIEF_TOOL_NAME`: 0 in active source.
- `LEGACY_PRODUCT` / `LEGACY_REFERENCE_*` / `LEGACY_VENDOR_*` owner constants: 0 in active source after release-gate terminology rename.
- `LEGACY_CODE_ENV_PREFIX` / `legacyCodeEnv` / `LEGACY_BASH_ENV_PREFIX` / `legacyBashEnv`: 0 in active source.
- `LEGACY_CONFIG_FOLDER_PERMISSION_PATTERN` / `GLOBAL_LEGACY_CONFIG_FOLDER_PERMISSION_PATTERN`: 0 in active source.
- `LEGACY_BROWSER_MCP_FLAG` / `LEGACY_TOOL_CONCURRENCY_ENV` / `LEGACY_RUNTIME_MARKER_ENV`: 0 in active source.
- Targeted non-gate scan for entry/env/permission/plugin/source-provider owners now leaves only `forwards-compat` schema comments in `src/utils/plugins/schemas.ts`.

## 14. Provider-Migration Bridge Owner Closure

Closed the next bridge/remote owner batch by making the source-provider bridge an explicit provider-migration boundary, not a second runtime or compatibility holding path.

- `src/dsxu/engine/provider-contract.ts` now exposes `providerMigrationBridge` instead of `legacyBridge`.
- The primary and only product-runtime opt-in flag is `DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE`; the old source-provider bridge alias was removed from the active SendMessage path.
- `SendMessageTool` routes `provider:` through the DSXU provider backend by default; `bridge:` remains hidden behind the provider-migration bridge gate and never owns the Agent/tool runtime.
- `useReplBridge`, `dsxuRemoteBridgeFacade`, `BridgeAdapter`, OAuth, Brief upload, bridge-kick, and control-plane harness text now describe provider-migration bridge boundaries instead of legacy bridge runtime ownership.
- `QueryEngine.executeFullAbsorbOnce()` and `executeAllContentOnce()` now emit DSXU-native full-absorb status and `providerMigrationBridges` frozen evidence, not `legacyBridges`.
- The active source scan for `legacy bridge`, `legacy_bridge`, `legacyBridge`, `legacyBridges`, `legacyOptInRules`, and direct `DSXU_ENABLE_LEGACY_BRIDGE` literals returns 0 matches.

This keeps Bridge/Remote as a controlled owner entry and migration facade only. It does not create a new mainline, new product entrypoint, or bridge-owned tool/agent runtime.

## 15. Agent/MCP/Skill/Plugin Owner Closure

Closed the next Agent/MCP/Skill/Plugin owner batch without adding another mainline, shortcut runtime, or compatibility holding path.

- `Task` remains the external source-provider wire alias only through `SOURCE_AGENT_TOOL_ALIAS_NAME`; Agent orchestration stays owned by the DSXU AgentTool runtime.
- Remote Agent isolation is gated by `ENABLE_PROVIDER_MIGRATION_REMOTE_AGENT`; the old source-provider remote-agent alias was removed from the active Agent schema/load path.
- Built-in Agent profiles, verification-agent browser MCP fallback text, system-init SDK wire projection, and QueryEngine permission-denial text now use source-provider/provider-migration ownership language.
- SkillTool remote-skill loading now applies DSXU substitution values once; the duplicate replacement pass was removed instead of preserved as a local shortcut.
- MCP collapse/auth/plugin surfaces now describe source-provider hosted connectors, provider-migration remote MCP shells, and flat pre-versioned plugin cache/manifest layouts without naming a second MCP or plugin runtime.
- `skills-registry-v1.ts` now owns the deterministic critical-skill projection for `batch`, `debug`, `simplify`, and `verify`; this closes the missing registry-level `executeSkill` gap without routing around MCP / Skill Registry through another executor.
- `RemoteTriggerTool` now uses `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_TRIGGER` as the only active product-runtime migration gate; the old source-provider env spelling was removed.
- Brief, Config voice, Agent SDK env, source-provider instruction-context import, desktop handoff, and MCP auth wording now describe DSXU/provider-migration ownership instead of an active legacy owner.
- Compact, tool execution, usage, and bootstrap surfaces now refer to main compaction, source-wire derived fields, provider plan usage, and source-provider bootstrap boundaries; they no longer present fallback behavior as a legacy runtime.
- Brief attachment/upload runtime profiles, REPL/ToolSearch/Cron prompts, Shell/ShellSnapshot markers, Team/Spawn agent text, FileRead/Edit/Write telemetry text, Desktop handoff, GitHub workflow setup, Effort command, MCP desktop import, stickers command, SessionMemory prompt, generated-agent instructions, managed env, hooks, task/team mailbox, and telemetry comments now use source-provider/provider-migration wording where the path is migration input.
- Targeted active-source scan for old Agent/MCP/Skill/Plugin owner labels returns 0 matches for the closed patterns: `sdkCompatToolName`, `LEGACY_AGENT_TOOL_NAME`, `isLegacyRemoteAgentIsolationEnabled`, `ENABLE_LEGACY_REMOTE_AGENT`, `legacy browser MCP`, `legacyAliases`, `cleanupLegacyCache`, `getLegacyCachePath`, `legacyManifestPath`, `legacy cache`, `legacy manifest`, `legacy plugin metadata`, `legacy mcpServers`, `legacy package layout`, and `legacy known_marketplaces`.
- Targeted active-source scan for the second provider-migration surface batch also returns 0 matches for: `DSXU_ENABLE_LEGACY_DSXU_REMOTE_TRIGGER`, `LEGACY_AGENT_SDK_DISABLE_BUILTIN_AGENTS_ENV`, `legacyInstructionContextField`, `legacy DSXU_CODE_BRIEF`, `legacy-gated`, `legacy-only`, `legacy connector shells`, `legacy isolated`, and `legacy-isolated`.
- Targeted active-source scan for compact/tool/usage/bootstrap fallback wording returns 0 matches for: `legacy compact`, `legacy compaction`, `Backfill legacy`, `Show legacy plan usage limits`, and `skips legacy first-party bootstrap API`.
- Targeted active-source scan for the third product-surface wording batch returns 0 matches for: `legacyUploadEnv`, `legacyBaseUrlEnv`, `legacy alias`, `legacy DSXU`, `legacy always-load`, `legacy behavior`, `legacy instruction`, `legacy agent-id`, `DSXU/legacy`, `LEGACY_RUNTIME_MARKER_ENV`, `LEGACY_SESSION_ID_ENV`, `tengu_write_legacy_instruction`, `legacy-isolated`, `legacy-only`, `legacy connector shells`, `remote/legacy`, `legacy merchandise`, `Legacy Merch`, `legacy non-DSXU`, and `legacy desktop config`.

This batch keeps Agent as the orchestrator owner, MCP / Skill Registry as the skill-runtime owner, and Plugin Loader/Operations as the plugin-boundary owner. Existing source-provider file formats and wire names are accepted only as migration input.

## 15.1 Command/Product/Model Permission Owner Tightening

Closed the next broad residual batch in one pass. This was not a local shortcut layer: each change either removed an equivalent old alias from the active gate or renamed source-provider intake under its real owner.

- GitHub App setup, existing workflow/secret UI, success text, mobile/slack migration commands, desktop handoff, passes, remote setup, and review/ultrareview now describe provider-migration/source-provider ownership rather than a live legacy product path.
- Agent remote isolation, RemoteTrigger provider migration, and SendMessage bridge routing no longer accept old `LEGACY_*` env aliases in product runtime gates. Only the explicit provider-migration flags remain.
- Feedback transcript share, Grove terms links, policy limits, remote managed settings, desktop MCP import, embedded tools, managed env, cron/task config, plugin manifest/loader validation, diagnostics display/tracking, and memory selector were renamed to source-provider/provider-migration boundary language while preserving real external file/protocol strings.
- Model routing wrappers now use source-provider/provider-migration naming instead of `getLegacyProvider*`, `legacyCompat`, or legacy custom-model env variable names. The DSXU public model route stays DeepSeek-first.
- Permission rule parsing now exposes `normalizeSourceProviderToolName` / `getSourceProviderToolNames`; old tool-name intake remains inside Tool Gate canonicalization, not a second permission runtime.
- Targeted scan for the closed active-source patterns returns 0 matches for: `LEGACY_REMOTE_AGENT`, `LEGACY_DSXU_REMOTE_TRIGGER`, `LEGACY_BRIDGE`, `LEGACY_DEFAULT_AGENT_MODEL`, `getLegacy`, `LegacyAgent`, `legacyCompat`, `legacyCustomModel`, `legacy-provider`, `legacy version`, `Legacy OAuth`, `Legacy GitHub`, `legacy referral`, `legacy workflow`, `legacy marketplace sync`, `legacy config aliases`, `legacy memory files`, `legacy desktop MCP`, `legacyEntrypointEnv`, `DSXU_LEGACY_CONFIG_DIRECTORIES`, `legacy-provider-code`, `normalizeLegacyToolName`, `getLegacyToolNames`, and `LEGACY_TOOL_NAME_ALIASES`.

Remaining broad `legacy` hits after this batch are technical compatibility terms or true historical data parsers: shell grammar/security syntax, old transcript migration, old config backup migration, plugin marketplace package names, IDE extension paths, and explicit providerMigration model-family comments where the term describes upstream model history rather than DSXU runtime ownership.

## 15.2 Source-Provider Residual Boundary Cleanup

Closed another broad residual batch without introducing a new mainline, bridge layer, or compatibility holding path. The rule for this pass was: rename source-provider intake under the real DSXU owner, remove dead product branches, and keep only real persisted/file-format compatibility terms.

- Env/key boundary constants for Agent SDK version, Bedrock base URL, session ingress tokens, plan-mode opt-in, tmux prompt-history, OAuth subprocess/teleport tokens, schema URLs, memory-exclude setting names, and hint tags now use source-provider/provider-migration owner names.
- Grove notice config now uses an explicit `SOURCE_PROVIDER_GROVE_PATH`; the endpoint string remains external provider API input, not a Grove-owned runtime.
- `LegacyProviderError` was collapsed into `SourceProviderError`, and the old internal good-feedback dead branch in `getAutoRunCommand()` was removed instead of kept as a dormant command path.
- Agent swarms, feature-flag override, cloud auth status, first-party provider URL, PDF support, onboarding API-key protection, retry fallback, microcompact, Magic Docs, Brief upload, Insights temp/report upload, concurrent sessions, config, browser-provider fallback sockets, transcript recovery, hook template substitution, and permission-rule loading now describe historical/source-provider intake rather than active legacy ownership.
- Clear command shims, Thinkback marketplace identifiers, Experience self-RAG compatibility, old-code peer addresses, managed plugin metadata, plugin-agent loading, official marketplace startup/GCS mirror paths, marketplace deprecation guidance, worktree cleanup patterns, MDM policy keys, channel notification capability text, and native installer lock cleanup now use mainline/source-provider/historical owner language.
- API request compatibility parameters, remote managed settings override gating, instruction-file selectors, cleanup package prefixes, IDE/JetBrains/local installer paths, hook/plugin placeholders, worktree tmux envs, sandbox config dirs, managed-settings paths, telemetry/exporter endpoints, Bash/PowerShell fallback comments, old transcript/attachment readers, Git proxy parsing, MCP enum parsing, task ownership, and session tracing now use source-provider/historical/fallback owner language.
- The old `DSXU_ENABLE_LEGACY_*_REMOTE_SETTINGS` spelling is no longer accepted in active eligibility gating. Remote managed settings override now requires `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS`.
- Provider-migration instruction files, bridge contract evidence, remote-trigger scheduling, and service-shell policy no longer accept hidden old env aliases assembled through string concatenation. Each now requires its explicit `DSXU_ENABLE_PROVIDER_MIGRATION_*` or `DSXU_ALLOW_PROVIDER_MIGRATION_*` flag.
- Persisted strings such as `legacyOpusMigrationTimestamp` and external source-provider schema/env values were intentionally preserved as data compatibility. They are not owner names and must not be renamed on disk without a config migration.
- Targeted scan for the closed residual patterns returns 0 active source matches for old env constants, old schema constant names, old source-provider boundary comments, old dead-branch labels, old socket fallback variable names, and old hook/recovery helper names.
- Targeted scan for the closed command/plugin/native residual patterns returns 0 active source matches for old command-file labels, source-provider marketplace labels, official marketplace `LEGACY_*` constants, old worktree/control comments, old MDM/channel wording, and old native-lock cleanup wording.
- Targeted scan for the closed API/env/IDE/installer/plugin/hook/worktree/sandbox/telemetry/Bash/PowerShell/session residual patterns returns 0 active source matches.
- Broad non-test `legacy/Legacy/LEGACY` hits across `src/commands`, `src/components`, `src/services`, `src/tools`, and `src/utils` are now 1. The only remaining hit is the persisted config key `legacyOpusMigrationTimestamp` in `src/utils/configProviderMigration.ts`; this is data compatibility, not a runtime owner, and must not be renamed without an explicit config migration.

This keeps the original-side owner model intact: old inputs are absorbed at the owning parser/config/tool boundary, while equivalent duplicate behavior is removed or named as a replace/delete candidate instead of becoming a parallel runtime.

## 16. Register Snapshot

`docs/generated/DSXU_V20_SOURCE_CLEANUP_REGISTER_20260514.csv` was rebuilt after this batch.

| Category | Count | Status |
|---|---:|---|
| `p0-permission-delete-residue` | 3 | ACL-blocked empty files, external permission closure only |
| `p1-product-specific-signal-ANT-ONLY` | 0 | Closed |
| `p1-product-specific-signal-GrowthBook` | 103 | Vendor implementation/generated/test/env evidence only; old caller path closed |
| `p1-product-specific-signal-billing` | 161 | Real DSXU cost/provider entitlement surface; owner moved to auth/service and cost ledger paths |
| `p1-product-specific-signal-subscription` | 424 | Broad metadata term; actionable old aliases are closed |

The billing/subscription broad counts are not deletion counts. They include real provider-auth metadata, UI state, SDK schema, rate-limit messaging, and cost ledger text. Closure criterion is no duplicate runtime owner and no old compatibility entrypoint.

## 17. Focused Verification

| Verification | Result |
|---|---|
| Import `src/services/analytics/featureFlags.ts` | PASS |
| Import `src/services/auth/dsxuBillingAccess.ts` | PASS |
| Import `src/services/auth/dsxuProviderAuth.ts` | PASS |
| Import `src/components/ConsoleOAuthFlow.tsx` / `src/services/oauth/index.ts` | PASS |
| Import `src/cli/handlers/auth.ts` / `src/components/TeleportError.tsx` | PASS |
| Import MCP provider-migration owner set: `providerMigrationProtocol.ts`, `dsxuProvider.ts`, `channelNotification.ts`, `channelPermissions.ts`, `providerConnectorMigration.ts`, `config.ts`, `client.ts`, `MCPRemoteServerMenu.tsx` | PASS |
| Import provider-control owner set: `dsxuProviderControlAuth.ts`, API bootstrap, HTTP/fast mode, MCP provider/channel modules, remote-managed settings, policy limits | PASS |
| Import command boundary set: `/cost`, `/extra-usage`, `/rename`, `/ultrareview`, login, upgrade, MCP add, remote setup API | PASS |
| Import env/model owner set: `envUtils.ts`, `main.tsx`, `entrypoints/init.ts`, `dsxuProviderAuth.ts`, `mcp/auth.ts`, `thinking.ts`, `modelAllowlist.ts`, `insights.ts` | PASS |
| Import RemoteTrigger provider-migration owner set: `RemoteTriggerTool.ts`, `providerMigrationRemoteTriggerProvider.ts` | PASS |
| Import provider-migration model-router set: `model.ts`, `modelOptions.ts`, `providerMigrationModel.ts`, `providerMigrationModelCompat.ts`, `model-config.ts`, `llm-adapter.ts`, `errors.ts`, `dsxuTransport.ts`, `WebFetchTool/preapproved.ts` | PASS |
| Import provider-migration rate-limit mock owner set: `mockRateLimits.ts`, `rateLimitMocking.ts`, `providerMigrationMockRateLimits.ts`, `providerMigrationRateLimitClaim.ts` | PASS |
| Import provider-migration carrier set: `commitAttribution.ts`, `commitAttributionProviderMigration.ts`, `createMovedToPluginCommand.ts`, `install-slack-app.ts`, V18 proprietary/public/package gates | PASS |
| Import sync carrier set: `settingsSync/index.ts`, `settingsSync/types.ts`, `teamMemorySync/index.ts`, `teamMemorySync/types.ts`, `remoteManagedSettings/syncCache.ts`, `remoteManagedSettings/index.ts` | PASS |
| Import runtime intake/auth boundary set: `auth.ts`, `dsxuProviderAuth.ts`, `keychainPrefetch.ts`, `readOnlyValidation.ts`, `bashPermissions.ts`, `Settings/Config.tsx`, `teleport/api.ts`, `teleport/environments.ts`, `instructionFiles.ts`, bundled DSXU API/schedule skills, DSXU guide agent | PASS |
| Import entry/transport boundary set: `envCompat.ts`, `entrypoints/init.ts`, `cli/update.ts`, `cli/transports/ccrClient.ts`, `main.tsx` | PASS |
| Import `src/main.tsx`, `src/screens/REPL.tsx`, `src/cli/print.ts` | PASS |
| Import active entry/control owner set: `entrypoints/init.ts`, `main.tsx`, `cli/print.ts`, `utils/env.ts`, `nativeInstaller/download.ts`, `BriefTool`, `conversationRecovery.ts` | PASS |
| Import env/permission/plugin owner set: `system.ts`, `managedEnvConstants.ts`, `permissions/filesystem.ts`, `plugins/schemas.ts`, `remoteIO.ts`, `transportUtils.ts`, `QueryEngine.ts`, `toolOrchestration.ts`, `swarm/spawnUtils.ts`, `FileEditTool/constants.ts` | PASS |
| Import final non-gate source-provider owner set: `system.ts`, `permissions/filesystem.ts` | PASS |
| `bun test src/dsxu/engine/__tests__/control-plane-stage-acceptance-v1.test.ts src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts` | PASS, 9 tests |
| `bun test src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts` | PASS, 14 tests |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | PASS, 22 tests |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts src/dsxu/engine/__tests__/v6-mainline-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v9-reference-absorption-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v10-reference-behavior-productization-contract-v1.test.ts` | PASS, 36 tests |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/v6-mainline-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v9-reference-absorption-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v10-reference-behavior-productization-contract-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | PASS, 28 tests |
| `bun test src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/v6-mainline-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v9-reference-absorption-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v10-reference-behavior-productization-contract-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | PASS, 36 tests |
| `bun test src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | PASS, 2 tests |
| Import provider-migration bridge owner set: `provider-contract.ts`, `provider-alias.ts`, `SendMessageTool`, `SendMessageTool/prompt.ts`, `dsxuRemoteBridgeFacade.ts`, `useReplBridge.tsx`, `bridge-adapter.ts` | PASS |
| `bun test src/dsxu/engine/__tests__/engine.test.ts -t "full absorb\|all content"` | PASS, 3 tests |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/background-governance-contract-v1.test.ts src/dsxu/engine/__tests__/v6-mainline-completion-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/network-facade-v1.test.ts src/dsxu/engine/__tests__/bridge-gate.test.ts` | PASS, 130 tests |
| Active source scan for `legacy bridge`, `legacy_bridge`, `legacyBridge`, `legacyBridges`, `legacyOptInRules`, direct `DSXU_ENABLE_LEGACY_BRIDGE` | PASS, 0 active source matches |
| `bun test src/dsxu/engine/__tests__/critical-skills-runtime-v1-clean.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts src/dsxu/engine/__tests__/skills-integration.test.ts src/dsxu/engine/__tests__/mcp-client.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts` | PASS, 135 tests |
| Import Agent/MCP/Skill/Plugin owner set: `skills-registry-v1.ts`, `AgentTool`, `loadAgentsDir`, `SkillTool`, `MCPTool/classifyForCollapse`, `McpAuthTool`, `pluginLoader`, `pluginOperations` | PASS |
| Targeted Agent/MCP/Skill/Plugin old-owner scan | PASS, 0 active source matches |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/skills-integration.test.ts src/dsxu/engine/__tests__/mcp-client.test.ts` | PASS, 125 tests |
| Import provider-migration surface set: `RemoteTriggerTool`, `RemoteTriggerTool/prompt`, `builtInAgents`, `runAgent`, `BriefTool`, `ConfigTool`, voice command, desktop deep link, tips registry | PASS |
| Targeted provider-migration surface old-owner scan | PASS, 0 active source matches |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts` | PASS, 92 tests |
| Import compact/tool/usage/bootstrap surface set: `sessionMemoryCompact`, `autoCompact`, `toolExecution`, `usage` command, `api/bootstrap` | PASS |
| Targeted compact/tool/usage/bootstrap fallback old-owner scan | PASS, 0 active source matches |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts` | PASS, 96 tests |
| Import product-surface wording set: Brief attachment/upload, Agent prompt, REPL constants, ToolSearch, Cron prompt, SpawnMultiAgent, Shell/ShellSnapshot, DesktopHandoff, FileWrite/Edit/Read limits, command/provider text, managed env, task/team/telemetry surfaces | PASS |
| Targeted product-surface wording old-owner scan | PASS, 0 active source matches |
| Import expanded product/model/permission owner set: GitHub setup, review/remote setup, feedback/terms, diagnostics, Agent/RemoteTrigger/SendMessage, managed env/config/plugin/model/permission owners | PASS, 47 modules |
| Import post-permission-rename owner set: permission parser, hooks, messages, permission setup, Agent/RemoteTrigger/SendMessage, model owner wrappers | PASS, 15 modules |
| Targeted extended old-owner scan for env aliases, model wrapper names, product wording, plugin/config wording, and permission parser names | PASS, 0 active source matches |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts` after extended owner tightening | PASS, 96 tests |
| Import residual source-provider boundary set: Grove, hints, errors/http/user, Bedrock/teammate/session/tmux/teleport/subprocess, settings/config, agent swarms, feature flags, auto-run issue, cloud auth, providers/PDF/onboarding/retry/compact/MagicDocs/Brief/Insights, browser provider, recovery, hooks, permission setup/loader | PASS, 33 modules |
| Targeted residual old-owner scan for closed env constants, dead product branches, source-provider boundary comments, schema names, socket fallback helpers, and hook/recovery helper names | PASS, 0 active source matches |
| Import command/plugin/native residual set: clear commands, thinkback-play, self-rag, peer address, managed/load plugin agents, official marketplace startup/GCS, marketplace manager, worktree, session ingress, MDM/settings types, native PID lock | PASS, 15 modules |
| Targeted command/plugin/native residual old-owner scan | PASS, 0 active source matches |
| Import final source-provider/fallback residual set: API, remote-managed settings, memory selector, IDE/local installer/hooks/worktree/sandbox owners, Bash/PowerShell fallback surfaces, messages/session storage, permissions/settings parsing | PASS, 19 modules |
| Import hidden-alias removal set: schedule remote agents, service-shell policy, env compat, instruction files, provider contract, provider alias | PASS, 6 modules |
| Targeted final residual old-owner scan | PASS, 0 active source matches for closed patterns |
| Broad non-test `legacy/Legacy/LEGACY` scan after residual boundary cleanup | PASS, 1 remaining data-compatibility hit: `legacyOpusMigrationTimestamp` |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts` after final residual cleanup | PASS, 92 tests |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/v9-reference-absorption-completion-contract-v1.test.ts` after hidden-alias removal | PASS, 24 tests |
| `bun run lint-schema` | PASS |
| `git diff --check` | PASS, Git CRLF warnings only |

The broad `src/dsxu/engine/__tests__/engine.test.ts` file is still not a final release signal: when run whole, it exposes existing unrelated GearBox state and Counterfactual branch error-count failures. The provider/bridge/full-absorb focused owner tests above pass and should be used as this batch's verification evidence.

## 18. Next Batch

Next executable cleanup should target remaining real old-language surfaces, not add new layers:

1. Continue the broad source-provider scan by owner family instead of generic buckets: GitHub/plugin marketplace residuals, command availability, evidence-only release gates, P12 raw intake, and V20 test readiness.
2. GrowthBook remaining rows should stay implementation evidence or generated schema, not caller debt.
3. Continue owner review for remaining plan items in `DSXU_V20_MASTER_PLAN_20260514.md`: provider-compatible intake, P12 raw intake, release gates, and final V20 test packets.
4. After owner surfaces stabilize, run V20 tests in order: functional, experience/UI, recovery, performance, eval, release closure.
