# DSXU V26 Master Plan - 2026-05-15

## Latest Execution Record - 2026-05-17 20x control/env boundary batch 14

This batch continued the same DSXU-owned cleanup discipline and focused on boundaries that were still real runtime/caller surfaces, not historical evidence. It did not rename compatibility env strings, did not change wire values, did not add an entrypoint, and did not alter DeepSeek routing.

| Scope | Result |
|---|---|
| control-plane protocol owner | `dsxu/control-plane/controlProviderMigrationProtocol.ts` now exposes `ARCHIVED_CONTROL_*`, `archivedControlCodeEnv`, and `isArchivedControlCloudMcpTransport` as canonical names. Previous `DSXU_PROVIDER_MIGRATION_*` names remain only as compatibility aliases inside that one boundary. |
| CLI control projection | `cli/print.ts` now imports archived control names directly, so SDK/CLI event projection no longer reads as a second provider-migration control runtime. |
| fast/thinking hidden helpers | `providerMigrationFastMode.ts` and `providerMigrationThinking.ts` now expose archived helper names first; `fastMode.ts` and `thinking.ts` import those canonical names. |
| model alias facade | `utils/model/aliases.ts` removed unused provider-migration alias re-exports after repo-wide import/use checks showed no callers. |
| env facade cleanup | Runtime callers now import `isArchivedServiceShellAllowed` and `getArchivedHomeDir` directly from `envUtils.ts`; unused provider-migration re-exports were removed from `envUtils.ts` / `envCompat.ts`. |
| board precision | `brand-compat-risk-board.ts` now treats the control protocol file, DSXU risk/scanner files, and explicit `DSXU_ALLOW/ENABLE_PROVIDER_MIGRATION_*` env gates as compatibility boundaries instead of runtime cleanup debt. This prevents the scanner from penalizing the very gates that keep archived behavior isolated. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts --timeout 20000` | 11 pass / 0 fail / 69 expects. |
| `bun test src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/services/mcp/__tests__/doctor.test.ts` | 28 pass / 0 fail / 4593 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=5926`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=151`. |
| `git diff --check -- <batch files>` | PASS; only existing CRLF normalization warnings were printed. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 356 to 151 in this batch. Remaining candidates are now thin and scattered across harness/source-truth, generated scripts, and low-count runtime helpers; they require file-by-file owner judgment, not global replacement. `git status --short` remains 2431; no stage, commit, delete, reset, clean, or evidence-directory removal was performed.

## Latest Execution Record - 2026-05-17 20x public docs boundary batch 13

This batch cleaned ordinary user/release documentation wording without touching source-truth V18/V19/V20/V24/V26 evidence or generated audit artifacts. Real env variable names were preserved because they are compatibility inputs, not product claims.

| Scope | Result |
|---|---|
| configuration docs | `docs/CONFIGURATION.md` now describes fallback gates as archived-provider boundaries while preserving real `DSXU_ALLOW_PROVIDER_MIGRATION_*` env names. |
| doctor/install/release docs | `docs/DOCTOR_HEALTH.md`, `docs/INSTALL.md`, and `docs/RELEASE_RUNBOOK.md` now avoid presenting provider-migration fallback as a normal DSXU product path. |

Verification:

| Command | Result |
|---|---|
| `rg -n "provider[-_ ]?migration|ProviderMigration|PROVIDER_MIGRATION" docs\CONFIGURATION.md docs\DOCTOR_HEALTH.md docs\RELEASE_RUNBOOK.md docs\SECURITY_PERMISSION.md docs\INSTALL.md` | Only real compatibility env variable names remain in `docs/CONFIGURATION.md`. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=5985`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=356`. |
| `git diff --check -- <batch docs>` | PASS; only existing CRLF normalization warnings were printed. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 362 to 356 in this batch. Real compatibility env variable names are preserved; they must not be renamed in docs unless the runtime env contract changes. `git status --short` remains 2431; no stage, commit, delete, reset, clean, or evidence-directory removal was performed.

## Latest Execution Record - 2026-05-17 20x model facade boundary batch 12

This batch continued the same owner rule for the model/cost route surface: DSXU public callers should depend on DeepSeek/archived canonical names, while old provider-family symbols stay confined to hidden compatibility modules or tests. No model route, pricing, admission rule, or DeepSeek default was changed.

| Scope | Result |
|---|---|
| model hidden boundary | `providerMigrationModel.ts` now exposes `isArchivedHighTierModelTarget` and `getArchivedThirdPartyFallbackModelSuggestion` as canonical hidden-boundary helpers, with previous provider-migration helper names retained only as aliases inside the hidden module. |
| model public facade | `utils/model/model.ts` now exports archived model helpers first and no longer re-exports provider-migration helper names from the public facade. |
| internal callers | `migrateLegacyOpusToCurrent.ts`, `api/withRetry.ts`, `api/errors.ts`, `status.tsx`, `validateModel.ts`, and `rateLimitMocking.ts` now import archived helper names directly. |
| wording cleanup | LLM adapter/model-config warnings describe archived model mapping instead of active provider migration, while DeepSeek direct call and route selection remain unchanged. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 24 pass / 0 fail / 4589 expects. |
| `bun test src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 95 pass / 0 fail / 1080 expects. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=5988`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=362`. |
| `git diff --check -- <batch files>` | PASS; only existing CRLF normalization warnings were printed. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 370 to 362 in this batch. This was a facade cleanup, not a provider-route change. `git status --short` remains 2431; no stage, commit, delete, reset, clean, or evidence-directory removal was performed.

## Latest Execution Record - 2026-05-17 20x archived protocol owner batch 11

This batch corrected the archived MCP/protocol owner boundary instead of continuing shallow string cleanup. The protocol adapter now exposes archived canonical names first and keeps previous `PROVIDER_MIGRATION_*` symbols only as compatibility aliases inside the single DSXU-owned protocol file. Runtime callers now import archived names directly where possible, and the brand risk board no longer misclassifies import-path-only references to the archived protocol adapter as runtime cleanup debt.

| Scope | Result |
|---|---|
| protocol owner | `constants/providerMigrationProtocol.ts` now defines `ARCHIVED_*`, `archivedMcpEvent`, `isArchivedMcpTransport`, and `getArchivedMcpRuntimeProfile` as canonical exports. Old provider-migration names remain aliases only for compatibility. |
| MCP runtime callers | `cli/handlers/mcp.tsx`, `services/mcp/client.ts`, `channelNotification.ts`, `providerConnectorMigration.ts`, `types.ts`, `config.ts`, `doctor.ts`, `useManageMCPConnections.ts`, `channelPermissions.ts`, `components/mcp/MCPRemoteServerMenu.tsx`, `MCPSettings.tsx`, and SDK schemas now import archived protocol names directly. |
| adjacent runtime profiles | `/passes`, `/stickers`, login runtime profile, OAuth comments, LLM adapter warnings, model config lifecycle, and Grove path imports now use archived wording where the behavior is already isolated from DSXU default runtime. |
| risk-board precision | `brand-compat-risk-board.ts` now treats `providerMigrationProtocol.ts` as the DSXU-owned archived compatibility boundary and skips import-path-only matches for archived protocol imports. This avoids false runtime-cleanup debt after callers have already moved to archived canonical symbols. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 105 pass / 0 fail / 5602 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=5993`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=370`. |
| `git diff --check -- <batch files>` | PASS; only existing CRLF normalization warnings were printed. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 464 to 370 in this batch. This was not a new bridge and not a second protocol layer: it made the existing DSXU-owned archived protocol adapter explicit as the only compatibility boundary. `git status --short` remains 2431; no stage, commit, delete, reset, clean, or evidence-directory removal was performed.

## Latest Execution Record - 2026-05-17 20x caller/projection boundary batch 10

This batch continues the V26 rule that cleanup must strengthen the DSXU-owned mainline instead of creating another layer. It only touched caller/projection names, comments, and unused compatibility aliases where the current behavior is already owned by DSXU. It did not change protocol wire values, persisted env strings, permission semantics, provider routing, MCP runtime behavior, or generated evidence contracts.

| Scope | Result |
|---|---|
| install/MCP/hints callers | `install-slack-app.ts`, `mcp/addCommand.ts`, `desktopMcpImport.ts`, and `dsxuCodeHints.ts` now describe old provider inputs as archived override/intake boundaries rather than active migration runtime. |
| permission/config projection | `FileEditTool/constants.ts`, `envUtils.ts`, `markdownConfigLoader.ts`, `messages.ts`, and `permissions/permissionSetup.ts` now use archived local names while preserving required compatibility aliases and persisted paths. |
| telemetry/VCR/session boundaries | `pluginOptionsStorage.ts`, `bigqueryExporter.ts`, `tmuxSocket.ts`, `user.ts`, `teleport.tsx`, `api/client.ts`, and `api/grove.ts` now label retained old service-shell values as archived-only inputs. |
| startup/provider/policy/session callers | `main.tsx`, `mcp/dsxuProvider.ts`, `marketplaceManager.ts`, `policyLimits/index.ts`, `SessionMemory/prompts.ts`, and `tips/tipRegistry.ts` now expose archived override/intake wording at the caller boundary without changing DSXU default product flow. |
| stale compatibility aliases | `configProviderMigration.ts` removed unused `PROVIDER_MIGRATION_*` re-export aliases and `getProviderMigrationMemoryFile` after import/use checks showed no repo callers. Retained compatibility values remain only where callers or persisted state still need them. |

Verification:

| Command | Result |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 105 pass / 0 fail / 5602 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6085`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=464`. |
| `git diff --check -- <batch files>` | PASS; only existing CRLF normalization warnings were printed. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 516 to 464 in this batch. `git status --short` remains 2431 because this was owner-source/report cleanup only: no stage, no commit, no delete, no reset, no clean, and no evidence-directory removal. Remaining candidates are now concentrated in protocol constants, control-plane protocol files, public-surface scanners, risk gates, and tests/generated evidence. Those require explicit owner review or scanner classification updates, not blind replacement.

## Latest Execution Record - 2026-05-17 20x caller/projection boundary batch 9

This batch continues the same rule: resolve runtime/caller wording where DSXU already owns the behavior, and leave protocol constants, risk gates, scanners, and generated evidence alone. It does not add a new main chain, does not create a bridge shortcut, and does not change persisted compatibility env strings.

| Scope | Result |
|---|---|
| startup and remote boundary logs | `entrypoints/init.ts` now describes the old upstream proxy as an archived source shell and keeps remote/session routing owned by the DSXU provider contract. The contract test was updated to enforce the new archived wording. |
| model-update notifications | `hooks/notifs/useModelMigrationNotifications.tsx` now uses archived remap local names while preserving the existing persisted timestamp keys and opt-out env spelling. |
| remote managed settings service | `services/remoteManagedSettings/index.ts` now labels the retained endpoint path as archived and exposes `archivedBoundary` in the runtime profile instead of a generic migration bucket. |
| remote trigger and SendMessage bridge | `RemoteTriggerTool.ts` and `SendMessageTool.ts` now describe old remote/bridge paths as archived override work; default DSXU local Agent/SendMessage continuation remains the product path. |
| sandbox/VCR/telemetry compatibility | `sandbox-adapter.ts`, `vcr.ts`, `firstPartyEventLoggingExporter.ts`, and `mcp/auth.ts` now use archived local names for retained old config dir/env/instrumentation compatibility values. |

Verification:

| Command | Result |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 105 pass / 0 fail / 5602 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6136`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=516`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 543 to 516 in this batch. `git status --short` remains 2431 because this is source/report owner cleanup only: no stage, no commit, no delete, no reset, no evidence-directory removal.

## Latest Execution Record - 2026-05-17 20x runtime caller projection batch 8

This batch continues V26 cleanup at caller/projection level only. It does not change external protocol values, persisted env keys, or wire headers; it renames DSXU-side runtime callers so old provider behavior is visible as archived compatibility rather than a second active provider/runtime path.

| Scope | Result |
|---|---|
| teleport/session API callers | `utils/teleport/api.ts` and `utils/teleport/environments.ts` now use archived local names for retained old beta/version/environment headers while preserving the actual protocol header strings. |
| rate limit and model thinking callers | `services/rateLimitMocking.ts`, `utils/thinking.ts`, `utils/fastMode.ts`, `utils/model/modelOptions.ts`, and `utils/model/validateModel.ts` now import old-provider helpers under archived local names. DSXU Flash/Flash-MAX/Pro routing behavior was not changed. |
| remote settings and account APIs | `services/remoteManagedSettings/syncCache.ts`, `services/api/adminRequests.ts`, `services/api/metricsOptOut.ts`, and `services/api/withRetry.ts` now describe archived service-shell/metrics/fallback gates through archived caller names. Persisted env strings remain stable for explicit legacy overrides. |
| analytics/status/skills projection | `services/analytics/featureFlags.ts`, `services/analytics/metadata.ts`, `utils/status.tsx`, `utils/statusNoticeDefinitions.tsx`, and `skills/loadSkillsDir.ts` now keep DSXU-owned projection names at the call site while mapping to generated telemetry fields or archived compatibility inputs where required. |
| marketplace compatibility boundary | `utils/plugins/officialMarketplaceGcs.ts` now labels the old marketplace download endpoint as archived provider compatibility at the local constant layer; extraction safety and host values were not changed. |
| contract test sync | `provider-contract-v1.test.ts` now asserts the archived metrics opt-out gate name instead of requiring the old provider-migration function name. This keeps the test enforcing DSXU local-provider blocking without reintroducing old active runtime wording. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 103 pass / 0 fail / 5589 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6164`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=543`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 620 to 543 in this batch. `git status --short` remains 2431 because no files were staged, committed, deleted, reset, or cleaned. Remaining candidates are now heavier in protocol constants, risk gates, public-surface scanners, generated evidence, and compatibility source modules; the next batch should continue only through safe caller/projection aliases or explicit owner review packets.

## Latest Execution Record - 2026-05-17 20x SDK/MCP projection boundary batch 7

This batch continues V26 owner-side closure without changing protocol wire values, without adding a second MCP/runtime/provider layer, and without touching generated evidence by blind replacement. It targeted projection/caller files that were still exposing provider-migration wording even though the runtime behavior is DSXU-owned with archived compatibility.

| Scope | Result |
|---|---|
| SDK schema projection | `entrypoints/sdk/coreSchemas.ts` now exposes `McpArchivedProxyServerConfigSchema` as the DSXU-owned schema name and keeps the previous schema export only as a compatibility alias. Status descriptions now reference archived constants through archived local names. |
| MCP type projection | `services/mcp/types.ts` now exposes `McpArchivedProxyServerConfig` / `McpArchivedProxyServerConfigSchema` first, with the previous type/schema kept as aliases. The main `McpServerConfigSchema` now consumes the archived schema. |
| MCP settings UI | `components/mcp/MCPSettings.tsx` now imports `McpArchivedProxyServerConfig` directly instead of importing the old type and renaming it at the call site. |
| MCP doctor/config/connection | `services/mcp/doctor.ts`, `config.ts`, `client.ts`, `channelPermissions.ts`, `channelNotification.ts`, `useManageMCPConnections.ts`, and `providerConnectorMigration.ts` now use archived helper names for archived connector gates and channel capability checks. |
| MCP provider policy | `services/mcp/dsxuProvider.ts` now exposes `isArchivedMcpEnabled` / `getArchivedMcpDisabledReason` first, retains old names only as compatibility aliases, and reports `archivedConnectors` in the runtime policy. |
| settings boundary | `settings/constants.ts`, `settings/types.ts`, and `settings/managedPath.ts` now use archived names for old schema URL, managed path, and memory-excludes compatibility settings. |
| startup/workflow callers | `main.tsx` now imports `isArchivedMcpEnabled` directly, so startup MCP discovery reads as DSXU mainline plus archived opt-in rather than a second provider runtime. |

Verification:

| Command | Result |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 13 pass / 0 fail / 82 expects. |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` | 92 pass / 0 fail / 5520 expects. |
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 105 pass / 0 fail / 5602 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6243`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=620`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 672 to 620 in this batch. No files were staged, committed, deleted, reset, or cleaned. Remaining high-count files are now mostly explicit protocol adapters, risk gates, public-surface scanners, and generated evidence; those require owner review or scanner classification changes, not blind text replacement.

## Latest Execution Record - 2026-05-17 20x MCP/model/worktree boundary batch 6

This batch continues the same owner-side rule: keep DSXU mainline ownership visible, keep archived inputs as archived, and do not touch protocol/risk/test/generated evidence by blind replacement. The edits stayed in runtime callers and compatibility helper wrappers.

| Scope | Result |
|---|---|
| MCP headers helper | `headersHelper.ts` now uses archived local env names for retained old MCP helper aliases while preserving DSXU primary `DSXU_CODE_MCP_SERVER_*` context. |
| insights command | `insights.ts` now calls `getArchivedInsightsAnalysisModel`, uses archived config-home aliasing outside DSXU runtime, and names the internal old S3 report bucket as archived. |
| worktree runtime | `worktree.ts` now uses archived local names for old runtime dir, internal repo detection, and tmux env aliases; DSXU runtime still writes under `.dsxu`. |
| agent model caller | `model/agent.ts` imports old-provider agent helpers under archived local names so the DSXU model caller does not read as a second active provider runtime. |
| insights helper module | `providerMigrationInsightsModel.ts` now exposes `getArchivedInsightsAnalysisModel` first; the old export remains only as compatibility alias. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/services/mcp/__tests__/doctor.test.ts` | 20 pass / 0 fail / 92 expects. |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 103 pass / 0 fail / 5589 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6294`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=672`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 705 to 672 in this batch. No files were staged, committed, deleted, reset, or cleaned. Next high-value work should avoid protocol/risk/gate/generated files and focus on remaining runtime callers such as SDK schema projection aliases, MCP type projection aliases, print/control-plane import aliases, and explicit compatibility helper modules only where a safe archived alias exists.

## Latest Execution Record - 2026-05-17 20x archived model-boundary owner batch 5

This batch extends the previous archived-boundary cleanup into the model/cost/cache compatibility owner. It does not change DSXU public model routing, does not promote Pro, and does not add a second provider runtime. Old model/provider strings remain only as hidden compatibility input, protocol data, or explicit alias exports.

| Scope | Result |
|---|---|
| model allowlist boundary | `modelAllowlist.ts` now calls archived prefix helpers; `providerMigrationModelAllowlist.ts` exposes archived helper names first and keeps old names only as aliases. |
| model alias boundary | `aliases.ts` consumes `ARCHIVED_MODEL_ALIASES` / `ARCHIVED_MODEL_FAMILY_ALIASES`; old alias exports remain compatibility-only for hidden migration paths and tests. |
| tool-search/model validation boundary | `providerMigrationToolSearchModel.ts` and `validateModel.ts` now use archived local names for unsupported old tool-reference patterns and old custom model env probing. |
| Bedrock compatibility boundary | `bedrock.ts` now treats old Bedrock prefixes/base-url env as archived-source compatibility values, not active DSXU public model owner names. |
| context upgrade path | `contextWindowUpgradeCheck.ts` now calls `getArchivedContextUpgradeSuggestion`, preserving the old exported name only at the provider-compat boundary. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts` | 18 pass / 0 fail / 79 expects. |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 103 pass / 0 fail / 5589 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6325`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=705`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 728 to 705 in this model-boundary batch. No files were staged, committed, deleted, reset, or cleaned. Remaining cleanup should stay packetized around explicit compatibility aliases, protocol modules, source-risk scanners, tests, and generated evidence.

## Latest Execution Record - 2026-05-17 20x archived-boundary owner batch 4

This batch continues owner-side closure under the same V26 rule: no new main chain, no extra runtime layer, no hidden bridge, and no shortcut compatibility path. The scope stayed inside already-owned DSXU runtime/tool/config/plugin/model-cache boundaries and renamed retained old-source inputs as archived-boundary data instead of active runtime owners.

| Scope | Result |
|---|---|
| user-visible tool profile boundary | `BriefTool`, Brief upload, and Brief attachment runtime profiles now expose `archivedSource*` policy/env fields instead of `providerMigration*` profile fields. The actual DSXU env and retained old env string values remain unchanged as migration inputs. |
| Agent and Config tool boundary | `AgentTool`, `runAgent`, `agentMemorySnapshot`, and `ConfigTool` now use archived local names for remote-agent isolation, omitted old instruction context, project config fallback, and old auth probe names. Remote isolation remains opt-in and out of the default DSXU schema. |
| WebFetch/docs compatibility boundary | `WebFetchTool/preapproved.ts`, `releaseNotes.ts`, and `dsxuCodeGuideAgent.ts` now keep old docs/changelog hosts as archived-source compatibility references, not DSXU runtime routing. |
| tool/service/config/plugin profiles | `toolOrchestration`, `teamMemorySync`, `markdownConfigLoader`, `pluginLoader`, `installedPluginsManager`, and `validatePlugin` now use archived local names for retained old env/path/manifest inputs while preserving DSXU-owned runtime paths. |
| prompt-cache/model caller boundary | `providerMigrationPromptCacheEnv.ts` now exposes archived helper names first; `dsxuTransport` and `promptCacheBreakDetection` call the archived names while old exports remain only as compatibility aliases. |
| Task output normalization | `utils/api.ts` now treats old `agentId`/`bash_id` tool-output fields as archived input normalization, not a separate product runtime. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/extended-tools.test.ts src/dsxu/engine/__tests__/tool-use-summary-governance-v1.test.ts src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 132 pass / 0 fail / 5839 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6350`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=728`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 836 to 728 before this record was added. The old names left in source are now concentrated in explicit compatibility aliases, hidden env names, provider protocol/model compatibility modules, risk gates, tests, and generated evidence. No files were staged, committed, deleted, reset, or cleaned.

## Latest Execution Record - 2026-05-17 20x archived-boundary owner batch 3

This batch continues owner-side closure while preserving the V26 product rule: no new main chain, no extra runtime layer, and no shortcut compatibility path. It targeted user-visible and runtime-adjacent archived-source paths that were still named like active provider-migration owners.

| Scope | Result |
|---|---|
| CLI/UI archived inputs | `entrypoints/cli.tsx`, `Messages.tsx`, `Settings/Config.tsx`, `DiagnosticsDisplay.tsx`, `ModelSelector.tsx`, `builtInAgents.ts`, `voice.ts`, `upgrade.tsx`, and `commit-push-pr.ts` now use DSXU/archived names for retained old env/flag/tool/reviewer aliases. |
| feedback and privacy surfaces | `submitTranscriptShare.ts` now refuses archived cloud transcript sharing in default DSXU runtime unless the explicit archived service shell gate is allowed; `Grove.tsx` no longer exposes old external terms/privacy URLs in DSXU UI text and links. |
| local/native install path | `localInstaller.ts` now uses `dsxu-code` for DSXU local wrapper creation and local-install existence checks instead of always targeting the archived source bin; native lock/download internals use archived names for retained old bucket/process compatibility. |
| model/tool helper boundary | `context-window-manager-v1.ts`, `advisor.ts`, `WebSearchTool.ts`, `WebFetchTool/utils.ts`, `sessionTitle.ts`, `toolUseSummaryGenerator.ts`, `dateTimeParser.ts`, `teleport.tsx`, `shell/prefix.ts`, and `rename/generateSessionName.ts` now call archived helper names instead of pulling provider-migration names into runtime callers. |
| compatibility exports | Provider-migration helper modules now expose archived helper names first while retaining old exports only as explicit compatibility aliases. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 111 pass / 0 fail / 5625 expects. |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/extended-tools.test.ts src/dsxu/engine/__tests__/tool-use-summary-governance-v1.test.ts src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 132 pass / 0 fail / 5839 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6457`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=836`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 918 to 836 in this batch. No files were staged, committed, deleted, reset, or cleaned. The next owner batch should focus on remaining runtime-callers under command availability, cloud-only command indexes, legacy model command helpers, plugin/marketplace compatibility, and explicit source-risk gates, with protocol/risk/generated evidence still excluded from blind replacement.

## Latest Execution Record - 2026-05-17 20x archived-boundary owner batch 2

This batch keeps the same V26 rule: no new main chain, entrypoint, runtime, provider path, permission path, MCP path, bridge path, or compatibility holding path. The work only moved confirmed old-source local owner names into DSXU archived-boundary names while preserving protocol strings, hidden compatibility aliases, risk scanners, generated evidence, and tests where those strings are evidence.

| Scope | Result |
|---|---|
| config and long-context boundary | `configProviderMigration.ts`, `config.ts`, and `DsxuLongContextNotice.tsx` now use archived memory/config helper names internally; old exports remain only as explicit boundary aliases. |
| API/service shell boundary | `grove.ts`, `usage.ts`, `referral.ts`, `ultrareviewQuota.ts`, `overageCreditGrant.ts`, `filesApi.ts`, and `settingsSync/index.ts` moved local helper names from migration-owner wording to archived account/files/settings-sync gates. |
| MCP/plugin/team/env boundary | `mcp/utils.ts`, `plugins/schemas.ts`, `swarm/spawnUtils.ts`, `teamMemorySync/index.ts`, `authFileDescriptor.ts`, and `ShellSnapshot.ts` use archived local constants for retained source-compatible paths and env markers. |
| startup/update/transport/tool paths | `system.ts`, `betas.ts`, `update.ts`, `ccrClient.ts`, `coordinatorMode.ts`, `apiPreconnect.ts`, `toolOrchestration.ts`, and `cleanup.ts` now keep old strings only as archived-source values, not as product owner names. |
| test sync | `provider-contract-v1.test.ts` now asserts the archived owner names for CCR/source-token, Files API, and settings-sync gates so tests do not pull old owner naming back into runtime code. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts` | 111 pass / 0 fail / 5629 expects. |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 111 pass / 0 fail / 5625 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6540`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=918`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from 1029 to 918 in this batch. No files were staged, committed, deleted, reset, or cleaned. Remaining occurrences are increasingly concentrated in explicit protocol/risk/test/generated-evidence/compat modules and must continue by owner review, not blind replacement.

## Latest Execution Record - 2026-05-17 20x auth/model/runtime owner batch

This batch continues V26 owner-side cleanup without adding a new main chain, entrypoint, provider runtime, permission runtime, MCP runtime, bridge runtime, or compatibility holding path. Runtime callers move to DSXU/archived owner names; old provider-migration names remain only where they are explicit protocol constants, public-surface/risk gates, tests, generated evidence, or compatibility aliases.

| Scope | Result |
|---|---|
| auth/keychain/env boundary | `dsxuProviderAuth.ts`, `keychainPrefetch.ts`, and `envUtils.ts` now use archived-owner helpers for old source API key, OAuth, service-shell, and config-home paths; old exports are retained only as boundary aliases. |
| model compatibility boundary | `providerMigrationModelCompat.ts`, `aliases.ts`, `providerMigrationModel.ts`, `providerMigrationModelOptions.ts`, `providerMigrationBetas.ts`, `providerMigrationEffort.ts`, and runtime callers now use archived source alias names internally while preserving explicit old alias exports for hidden migration gates and tests. |
| runtime callers | `dsxuModel.ts`, `model-config.ts`, `llm-adapter.ts`, `MagicDocs`, `FileReadTool`, `pdfUtils`, `statuslineSetup`, `dsxuCodeGuideAgent`, `extraUsage`, and `scheduleRemoteAgents` were moved off old local owner names where behavior is already DSXU-owned. |
| diagnostics/env/permission side paths | `diagnosticTracking.ts`, `managedEnv.ts`, `fastMode.ts`, and `channelPermissions.ts` now use archived local names for old source/shadow/remote capability paths; protocol constants themselves were not renamed. |
| feedback surface | `Feedback.tsx` now avoids archived small-model title generation and archived feedback submission in default DSXU runtime unless the explicit archived service shell gate is allowed. |
| test sync | `provider-contract-v1.test.ts` was updated to assert the new archived fast-mode gate name so the owner test no longer pulls old naming back into runtime code. |

Verification:

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts` | 119 pass / 0 fail / 5664 expects. |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS. |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`; `scannedFileCount=2999`; `occurrenceCount=6654`; `publicSurfaceBlockerCount=0`; `runtimeCleanupCandidateCount=1029`. |
| `bun run scripts\dsxu-health-audit.ts` | PASS; `invalid_utf8_files=0`; `user_visible_risk_files=0`. |

Current decision: public surface blockers remain 0, and runtime cleanup candidates dropped from the previous recorded 1119 to 1029 in this batch. No files were staged, committed, deleted, reset, or cleaned. The remaining high-count files are mostly explicit protocol/risk/public-surface/test/generated-evidence owner files and must continue through owner review, not blind global replacement.

## 最新执行记录 - 2026-05-17 20x batch continuation

本批继续按 owner 级收口执行，不新增主链、入口、runtime、bridge 或兼容 holding path；只处理已确认属于 DSXU 主线运行路径的局部命名、runtime profile、skill/agent/tool/env 投影口径。协议常量、风险扫描器、历史 evidence、generated board 不做全局硬替换，避免把“可识别旧输入”的职责误删。

| 范围 | 执行结果 |
|---|---|
| bundled skills | `scheduleRemoteAgents.ts`、`dsxuApi.ts` 的本地 provider-migration 命名收口为 archived/source-alias 口径；DSXU 模式仍走 DSXU Remote Session Provider、DeepSeek API skill 和 DSXU Agent runtime。 |
| API logging / QueryEngine | `logging.ts` 的 archived env metadata 只在 service-shell allowed 时投影；`QueryEngine.ts` 的旧 env helper 收口为 archived env helper，不改变 transcript flush / cowork 兼容边界。 |
| hooks / IDE / agent loader | `hooks.ts`、`ide.ts`、`loadAgentsDir.ts` 将旧 hook env、IDE source extension、agent omit-instruction 和 remote-isolation 本地命名收口为 archived；默认 DSXU agent 仍只允许 worktree isolation，remote 仍是显式 archived gate。 |
| init / remote trigger / env / config | `init.ts`、`RemoteTriggerTool.ts`、`env.ts`、`managedEnvConstants.ts`、`config.ts` 将可安全合并的 service-shell、remote trigger、config/memory/env 本地命名改成 archived owner 口径；旧 env 字符串只作为显式隔离 gate 保留。 |
| compat boundary helpers | `envCompat.ts`、`envUtils.ts`、`permissionRuleParser.ts` 改为 archived 内部实现名，并保留旧导出作为边界 alias；调用点优先使用 DSXU/archived owner 口径，不生成第二套 env 或 permission runtime。 |
| test sync | `provider-contract-v1.test.ts` 同步断言新的 archived owner 函数，防止测试继续要求旧 provider-migration 命名回流。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\provider-migration-model-alias-isolation-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts src\tools\__tests__\tool-registry-simple-mode.test.ts` | 107 pass / 0 fail / 5612 expects。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS。 |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`；`occurrenceCount=7050`；`publicSurfaceBlockerCount=0`；`runtimeCleanupCandidateCount=1119`。 |
| `bun run scripts\dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS；`invalid_utf8_files=0`；`user_visible_risk_files=0`。 |

当前裁决：本批把 `runtimeCleanupCandidateCount` 从上一轮 `1318` 继续降到 `1119`，公开面 blocker 仍为 0。未 stage、未 commit、未 delete、未 reset。剩余 1119 不能用全局替换处理，下一批只进入 `configProviderMigration/RemoteTrigger provider file/model compat/auth boundary` 等明确边界 owner；`providerMigrationProtocol`、`controlProviderMigrationProtocol`、risk gate、历史 evidence 继续保留检测职责。

## 最新执行记录 - 2026-05-17

本轮按 20x batch closure 继续执行 brand/compat/source-owner 收口，只处理 DSXU-owned runtime/profile/UI 文案和本地 owner 命名，不改底层 wire/env 值、协议常量、历史 evidence 或 generated board。

| 范围 | 执行结果 |
|---|---|
| instruction files | `instructionFiles.ts` 从 `providerMigrationInstructions` / `PROVIDER_MIGRATION_*` 本地 owner 命名收口为 `archivedInstructions` / `ARCHIVED_*`，旧 instruction 文件只在显式 `DSXU_ENABLE_PROVIDER_MIGRATION_INSTRUCTIONS` 下作为 archived intake。 |
| API client/errors | `api/client.ts`、`api/errors.ts` 将 archived SDK packages、headers、env、fallback/high-tier helpers 用 import alias 和 local archived names 收口；默认 `shouldUseDsxuDeepSeekClient()` 仍优先 DSXU DeepSeekAdapter。 |
| service-shell guards | admin/grove/files/metrics/usage/referral/ultrareview/logging/withRetry/apiPreconnect/Feedback/teamMemory/settingsSync/fastMode/keychain prefetch 改用 `isArchivedServiceShellAllowed` 本地 alias；功能仍是同一个 DSXU deny-by-default service-shell gate。 |
| SendMessage bridge | `SendMessageTool` 与 prompt 的 bridge flag/function 收口为 archived bridge naming，`provider:` 继续走 DSXU provider backend，`bridge:` 仍显式 opt-in。 |
| memory/settings UI | `MemoryFileSelector.tsx` 与 `settingsSync/types.ts` 将旧 instruction/config 文件名常量改为 archived source names，避免 UI/schema 把历史来源写成 DSXU 主链。 |
| remote IO / commands | `remoteIO.ts`、`ccrClient.ts`、`transportUtils.ts`、login/review/rename/remote-setup/cost/extra-usage/commit-push-pr 等 runtime profile 字段从 provider-migration policy/isolation/notes 收口为 archived policy/isolation/notes。 |
| installer / permission / doctor | `github-app.ts`、`nativeInstaller/installer.ts`、`shellConfig.ts`、`autoUpdater.ts`、`doctorDiagnostic.ts`、`permissions/filesystem.ts` 将 archived source alias、安装包、GitHub workflow carrier、权限目录和 doctor 检测的本地 owner 命名收口；实际旧 CLI/env/package 字符串只保留为 archived uninstall/import/permission boundary。 |
| test sync | `provider-contract-v1.test.ts` 与 `provider-migration-model-alias-isolation-v1.test.ts` 同步新的 archived owner assertions，防止测试继续要求旧命名回流。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\provider-migration-model-alias-isolation-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts src\tools\__tests__\tool-registry-simple-mode.test.ts` | 107 pass / 0 fail / 5612 expects。 |
| `bun test src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts` | 99 pass / 0 fail / 5581 expects。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS；真实 CLI help 启动正常。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS；doctor CLI help 启动正常。 |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7271`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=1318`。 |
| `bun run scripts\dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：本批没有新增入口、没有新增 runtime、没有删除文件、没有 stage/commit。`runtimeCleanupCandidateCount` 从 1562 降到 1318，公开面 blocker 仍为 0。剩余 1318 需要按 owner 分类继续处理：协议常量保留、hidden compat module 审核、engine 风险门维持检测职责、历史 tests/fixtures/generated evidence 不做全局替换。

目标：把 V18/V19/V20/V24 的能力、证据、未完成项和发布要求统一收口成一个可发布、可挑战、可复核的 DeepSeek-first 开源 AI 编程产品方案。V26 不再继续堆版本层，也不复制参考产品源码、文字、品牌或商业实现；V26 只吸收通用体验机制，并落回 DSXU 自有 owner、DeepSeek 调度、Tool Gate、Permission Gate、Evidence 和发布体系。

## 1. 当前真实状态

| 来源 | 已完成 | 没有完成 / 不能宣称 |
|---|---|---|
| V18/V19 CLEAN | 82 项对齐中 `70 PASS / 0 FAIL / 12 未覆盖`；P0 shell/test/evidence、交互、FIM、Agent、浏览器主链证据已补齐大部分。 | 12 个 deferred 未覆盖仍不能当 PASS：`R01/R02/S02/R04/R05/R06` 等外部/扩大评测缺 raw live；`PZ01/PZ02/PZ04/PZ05/PZ06/PZ08` 等扩展入口缺主线产品实现或仍需 deferred。Phase 12 仍有广域手工/多窗口 replay 和对照 raw evidence 残留。 |
| V20 owner/Git / C2 | C2 1902 文件 owner-disposition 已闭环；P12、Owner/Git product/deletion packets 后续已推进；V20 final preflight、clean export preflight 在后续证据中已被覆盖。 | C2 不能宣称逐文件逐行为 feature parity。`594` 个 product-specific adapt/exclude、`278` 个 shared utility 仍是能力损失/吸收审计重点。生态兼容能力包仍只是方向与边界，不是完整产品能力。4 个 ACL 物理残留仍是本地外部权限项。 |
| V24 真实能力证明 | `C2_LOOP_REAL_ACCEPTANCE=51/51`；六阶段最终测试 `20/20`；TUI 场景 `7/7`；Senior coding window `30.48 min`；clean export artifact 已创建且 secret scan pass；fresh install smoke `7/7`；首次 key wizard 已落到 `auth login` / `--api-key-stdin`。 | 新口径下仍 blocked：公开复杂任务 `scoreFloor=72`，尚未达到对标 GPT-5.5 / Claude 4.7 编程与复杂任务能力 `90% 左右`；外部同题 raw transcript 不足，不能宣称外部胜出。新增 key wizard 还需要进入重建 release artifact 与 public challenge/launch pack 复核。 |
| GitHub open-source pack | 已生成产品定位、数据图、证据文件和 release-candidate 口径。 | 不能高粉低能：不能写“已达到对标 90% 能力”、不能写“领先外部产品”、不能把参考 1902 文件写成复制/品牌兼容卖点；cache 命中率只写真实值和优化趋势。 |

结论：DSXU 当前不是功能少，而是已经吸收很多但还没完成产品级统一。V26 的核心任务是把这些能力压成稳定主线、真实体验、公开数据和干净发布面。

## 2. V26 总目标

V26 的一句话目标：

**基于 DeepSeek Flash-first 调度，把 DSXU 做成一个能长时间像高级程序员一样读代码、改代码、跑工具、处理失败、控制成本、留下证据，并能用公开数据证明能力的开源 AI 编程产品。**

V26 完成标准：

| 维度 | V26 新标准 |
|---|---|
| 能力 | 真实复杂任务可以连续 30-45 分钟以上运行，能读写代码、运行工具、恢复失败、生成 patch/test/risk/cost/evidence；公开挑战目标是达到 GPT-5.5 / Claude 4.7 编程与复杂任务能力 `90% 左右`。 |
| 体验 | TUI/CLI 能让用户看清目标、计划、当前动作、权限、工具、失败、恢复、成本和下一步；体验闭环尽量接近高级程序员工作方式的 `100% 体感`。 |
| DeepSeek | 默认 `deepseek-v4-flash`，Pro 只在 admission evidence 满足时使用；所有 route/cost/cache/latency 可审计。 |
| 结构 | 不新增第二套 query/runtime/tool/provider/MCP/agent；所有入口回到 DSXU owner。 |
| 证据 | 每个卖点必须有 source truth、raw transcript、tool trace、测试结果、成本和失败样本。 |
| 发布 | clean export 不带 `.git`、`.dsxu`、`node_modules`、证据库、真实 key；fresh install/help/doctor/provider gate 可复跑。 |
| 公开 | GitHub README 只写证据支持的卖点；对标 90% 能力、接近 100% 体验、外部胜出都必须由公开 benchmark/raw logs 支撑。 |

## 3. V18 功能如何变成 DSXU 卖点

V18 的价值不是旧实现，而是目标清单。V26 要把 V18 70 PASS 变成公开卖点卡，但必须区分“已可卖点”和“只能 roadmap”。

| 卖点组 | 来源能力 | V26 公开口径 |
|---|---|---|
| DeepSeek 原生路由 | V18 `M01/M02/M06/C09/C16/M07` | Flash-first、Pro admission、context cache、prefix/cache、usage/cost 报告。必须配成本图和 route evidence。 |
| 真实编码闭环 | V18 `A01-A15` | Repo probe/index、LSP/AST locator、patch planner/applier、test runner、repair loop、final patch report。必须配真实 senior coding window。 |
| 终端/工具智能 | V18 `B01-B14` | Shell state、command plan、safe shell、output summary、artifact checker、terminal failure repair、result pack。必须配 Terminal ResultPack。 |
| 权限与证据 | V18 `C03/C04/C11/C12/C14/C15/C18/E05` | Permission gate、tool lifecycle、verification kernel、failure taxonomy、trace collector、anti-rationalization guard。必须配拒绝/恢复负例。 |
| 交互与恢复 | V18 `C02/C07/C10/C13/C17` | TUI interaction、context compiler、plan graph、snapshot/rollback、local memory。必须配 multi-window/resume replay。 |
| Agent 能力 | V18 `PZ07` | serial worker / parallel fanout，不做角色大会式 swarm；父级只引用 worker evidence。 |
| 浏览器/外部动作 | V18 `PZ03` | browser/dev-server proof 与 screenshot/evidence，不做独立 browser runtime。 |

V18 不能公开写成完成的项：

- `R01/R02/S02/R04/R05/R06`：Terminal-Bench、Internal Code-30、BenchMax、SWE Verified、BFCL、BrowseComp-Lite 仍缺完整 raw live/public evidence。
- `PZ01/PZ02/PZ04/PZ05/PZ06/PZ08`：外部执行、工具生态、Desktop、App suite、VS Code/API、Voice/Buddy/Team/Bridge 仍是 deferred 或 productization backlog。

## 4. Reference 1902 如何安全吸收

V26 必须继续反向分析本地参考源码树的 1902 个源码文件，但原则是机制吸收，不是代码吸收；公开发布文档不得暴露参考产品品牌或本地原始路径。

禁止：

- 不复制源码、prompt 文案、UI 文案、品牌名、商业接入逻辑。
- 不把参考产品专属文件写成 DSXU 兼容卖点。
- 不为了清零建立 compat runtime、bridge runtime、第二 executor 或第二 query loop。

允许：

- 提炼通用体验机制：状态可见、权限流程、工具生命周期、失败恢复、任务计划、上下文恢复、成本显示、证据报告。
- 落回 DSXU 自己的 owner：Query Loop、Tool Gate、Permission Gate、Model Router、Context、Agent、MCP/Skill Registry、UI/TUI、Evidence、Release。
- 用 DeepSeek 原生调度重新实现：Flash-first、Pro admission、thinking/tool pair、FIM/cache/cost。

当前 1902 吸收风险重点：

| 类别 | 数量 | V26 动作 |
|---|---:|---|
| absorbed_into_dsxu_mainline | 988 | 抽查 import/use/test/live evidence，确认没有只做归属、没做行为。 |
| product_specific_adapt_or_exclude | 594 | 二次能力损失审核：排除品牌/订阅/专属逻辑可以，但通用 UX/恢复/遥测机制必须吸收。 |
| shared utility total | 278 | 73 imported keep 可保留；201 baseline/no-new-absorption 和 4 reference-only 要确认确实不影响 DSXU 体验。 |
| review candidate | 42 | 不能留未知桶；每个要归 owner、吸收、排除或删除候选。 |

V26 要输出一张新总表：

`reference file -> capability loop -> DSXU owner -> DSXU implementation file -> import/use evidence -> live/TUI evidence -> public claim status`

## 5. V26 应该拉到极致的 8 个吸引点

这是 DSXU 真正能吸引开源用户的地方。不能平均用力，必须把下面几项做到极致。

### 5.1 低成本高级编程：Flash-first cost-per-solved-task

用户最容易感知的差异不是“模型名”，而是同样任务多少钱、多久、是否成功。DSXU 应把 DeepSeek Flash-first 做成核心卖点：

- 94/98 默认 Flash 只是起点，不是终点。
- 每个任务输出 cost、latency、cache hit、route reason、是否触发 Pro。
- 公布 cost-per-solved-task，而不是只公布 token。
- Pro 只做审查、失败救援、高风险综合，不能变成默认烧钱。

极致标准：用户能看到“这次复杂修复用了多少钱、为什么没用 Pro、什么时候才值得升级 Pro”。

### 5.2 可见工作状态：Senior Programmer Work-State Timeline

高级程序员体验的关键是用户知道它在做什么。V26 要把目标、计划、工具、权限、失败、恢复、成本、证据统一成一条 timeline。

必须做到：

- TUI/CLI/stream-json 同一套 state，不各写一套。
- 每次工具调用都有 purpose、risk、permission、result、evidence。
- 失败不隐藏：显示失败类型、恢复动作和下一步。
- final answer 不只说完成，还要列 patch/test/risk/cost/evidence。

极致标准：用户看 DSXU 工作时，不像看黑盒模型，而像看一个高级工程师在可视化执行任务。

### 5.3 Source Truth Repair Loop

DSXU 必须把“读真实代码 -> 定位 -> 修改 -> 测试 -> 失败恢复 -> 证据报告”做成最强闭环。

重点：

- 默认先读 source truth，不猜。
- 不把计划当完成。
- 不让模型误判替代本地测试。
- 修复失败后必须有 named recovery path。
- 多文件改动必须有 blast radius 和 focused verification。

极致标准：复杂 bugfix 任务中，DSXU 的行为像高级程序员，而不是聊天机器人。

### 5.4 统一 Tool / Permission / MCP / Agent Runtime

DSXU 最大风险是工具、MCP、Agent、Browser、IDE 各自形成一套小 runtime。V26 必须把统一 runtime 做成卖点。

必须做到：

- Core tools、MCP tools、Browser provider、IDE/API、Agent worker 全部进入同一 Tool Gate。
- 权限、schema、执行、posthook、evidence 一套流程。
- MCP registry / skill registry 不只是加载配置，而是能做 schema verification、secret redaction、doctor、permission mapping。
- Agent parent final 只能引用 worker evidence。

极致标准：外部生态可以接入，但执行主线永远是 DSXU 自己的。

### 5.5 长任务恢复和上下文可靠性

很多 AI 编程工具弱在长任务漂移。DSXU 要把恢复能力做成硬卖点：

- compact/resume 后重新读 source truth。
- 保存目标、约束、文件、失败、测试、下一步。
- 多窗口/同窗口 topic boundary 不污染。
- 工具拒绝、文件缺失、命令失败后不自言自语空转。

极致标准：30-45 分钟任务不是演示，而是常态能力。

### 5.6 公开挑战与数据图

GitHub 用户不信口号，只看可复跑数据。V26 要做 public challenge pack：

- 固定 20-30 个复杂公开 demo task。
- 每个任务保留 raw transcript、patch、tests、metrics、risk。
- 输出图：success rate、cost、latency、route ratio、failure recovery、cache ROI。
- 明确 PASS/PARTIAL/FAIL，不藏失败。

极致标准：别人 clone 后能复跑同样 challenge，看到同样证据结构。

### 5.7 Fresh Install / First-Run Trust

开源产品第一印象很重要。V26 必须补完整首次体验：

- 安装后 `dsxu doctor` 解释环境、key、模型、MCP、权限、风险。
- 首次无 key 时有交互式 key wizard：粘贴 key、保存到本地安全位置、验证、展示 cost policy。
- 发布包 secret scan 证明不带用户 key。
- `.env.example` 和 README 清楚说明。

极致标准：用户第一次运行不迷路、不泄密、不需要读一堆审计报告。

### 5.8 产品主线洁净

现在文件名和文档版本太多，长期会拖慢开发。V26 必须治理：

- 产品源码不要继续新增 `v18-* / v20-* / v24-*` 命名。
- 版本号只留在 evidence、audit、archive。
- 新功能文件用能力名：`work-state-timeline`、`deepseek-route-meter`、`tool-lifecycle-evidence`、`mcp-intake-registry`。
- 文档分层：
  - `docs/product/`：GitHub 用户文档。
  - `docs/evidence/YYYY-MM-DD/`：证据报告。
  - `docs/archive/v18-v24/`：历史方案。
  - `docs/release/`：发布 runbook、claim guard、secret scan。
- 脚本分层：
  - `scripts/acceptance/`
  - `scripts/benchmark/`
  - `scripts/release/`
  - `scripts/audit/`

极致标准：用户和开发者看到的是一个产品，不是 V18/V19/V20/V24 报告堆。

## 6. V26 执行排序

### V26-0：命名和发布面治理

目标：先止住版本号扩散。

动作：

1. 建立 `docs/product`、`docs/evidence`、`docs/archive`、`docs/release` 目录规划。
2. 只移动/归档文档和脚本入口，不改历史证据含义。
3. 产品源码新增能力一律用能力名，不再用 Vxx 命名。
4. 更新 README claim guard：当前只能 release candidate，不能宣称已达到对标 90% 能力或外部胜出。

验收：

- GitHub 用户入口不出现一堆 V18/V20/V24 报告。
- 历史审计仍可追溯。

### V26-1：C2 1902 二次能力损失审核

目标：防止“吸收太快”导致功能洗少。

动作：

1. 重新扫描 1902 文件，按 `components / hooks / commands / tools / services / utils / ink / tasks / context / memdir` 分类。
2. 对 `594 product-specific` 做能力损失审计：只排除品牌/订阅/商业专属，提取通用 UX/恢复/遥测机制。
3. 对 `278 shared utility` 做 import/use 决策：keep、mainline utility、reference-only、delete candidate。
4. 输出 `C2_CAPABILITY_LOSS_AND_ABSORPTION_BOARD`。

验收：

- 每个高价值机制都有 DSXU owner 或明确排除理由。
- public claim 只引用已实现并验收的 DSXU 能力。

### V26-2：Senior Programmer Work-State Timeline

目标：把高级程序员体验做出来。

动作：

1. 统一 TUI、CLI、stream-json 的 task state。
2. 增加 timeline event：goal、plan、tool、permission、failure、recovery、cost、agent、evidence、nextAction。
3. 在 30-45 分钟复杂任务中展示真实状态，不只是最终报告。
4. 补多窗口/同窗口 replay：topic boundary、permission screen、compact resume、background task。

验收：

- 真实 TUI 复杂任务体验闭环评分达到对标口径：能力约 `90%`，体验接近高级程序员体感。
- 用户能从界面判断 DSXU 当前正在做什么、为什么这样做、是否还可信。

### V26-3：DeepSeek Runtime Excellence

目标：把 DeepSeek 变成 DSXU 独有优势。

动作：

1. 建 `DeepSeekTrajectoryStore`：thinking/tool/result/usage/cache 成对保存。
2. 建 `DeepSeekToolSubsetRouter`：按任务动态裁剪工具集合。
3. 建 `ToolSchemaStrictnessGate`：MCP/高风险工具 schema 不合格不进入 provider request。
4. 建 `DeepSeekCostLatencyMeter`：cost、latency、cache hit/miss、route escalation。
5. 建 `ProAdmissionPolicy`：Flash retry、source truth 冲突、高风险审查、失败救援才准入 Pro。

验收：

- 每个公开 demo 都有 route/cost/cache/latency 图。
- Pro 使用比例低且理由清楚。

### V26-4：Tool / Permission / Recovery 主线加固

目标：统一工具执行体验。

动作：

1. Core tools、MCP、Browser、IDE/API、Agent worker 共用 tool lifecycle evidence。
2. 权限拒绝必须进入 recovery path。
3. shell/task/file/browser 操作都有 artifact checker 和 result pack。
4. 失败分类输出进入 final report。

验收：

- 真实拒绝、真实失败、真实恢复都能复跑。
- 不存在 standalone runtime。

### V26-5：生态兼容能力包

目标：DSXU 独立产品具备接入层，不内置第三方产品。

动作：

1. MCP registry intake：`.mcp.json`、server manifest、schema verification、secret redaction、doctor。
2. Project context intake：读取参考风格项目说明、commands、skills，但转成 DSXU project context，不保留品牌入口。
3. External agent host/API：AionUi/Cherry/Warp 这类外部 host 可调用 DSXU CLI/API，但执行仍走 DSXU 主线。
4. IDE/API bridge：PZ06 升为产品入口设计，复用同一 query-loop、permission、tool lifecycle、evidence。
5. Browser provider：browser-use 类能力作为受控 tool provider。

验收：

- 每个生态入口都有 doctor、permission、evidence。
- 没有第二套 compat runtime。

### V26-6：First-Run Trust 和开源发布产品化

目标：让 GitHub 用户第一次使用就信任。

动作：

1. 完成交互式 key wizard：无 key -> 粘贴 -> 保存 -> 验证 -> doctor summary。
2. README 写清 DeepSeek key 配置、成本策略、Flash-first 默认、Pro admission。
3. 产品 help、doctor、mcp doctor、provider gate 从 clean export 复跑。
4. secret scan 作为 release 必跑。

验收：

- fresh install 用户不用读内部审计文档也能跑起来。
- 发布包不含真实 key。

### V26-7：Public Challenge 90% 数据包

目标：把当前 `scoreFloor=72` 提升到对标 GPT-5.5 / Claude 4.7 编程与复杂任务能力 `90% 左右`的公开口径，同时用真实体验闭环证明高级程序员体感。

动作：

1. 固定 20-30 个公开复杂任务，覆盖 bugfix、refactor、tests、terminal repair、agent synthesis、MCP/browser、long resume。
2. 每个任务跑 DSXU live，保存 raw transcript、tool trace、patch、tests、metrics、risk。
3. 外部胜负口径只在有同题 raw transcript 时开启；没有则只写 DSXU 自测。
4. 生成 GitHub 数据图：success rate、cost、latency、route mix、cache ROI、failure recovery。

验收：

- 对标 90% 能力 claim / 体验闭环 claim 只能在 raw evidence 完整后打开；旧脚本字段如 `public95ClaimAllowed` 只作为历史 gate 名称保留，不代表 V26 继续使用 95 硬阈值。
- 不隐藏失败样本。

### V26-8：Final Release Gate

目标：正式发布前最后放行。

动作：

1. 重跑六阶段最终测试。
2. 重建 clean export artifact。
3. 重跑 fresh install/help/doctor/provider gate smoke。
4. 重跑 GitHub launch pack。
5. 只有公开复杂任务、真实体验闭环、raw evidence、失败样本、成本/cache 证据都满足新口径，才发布对标 90% 能力口径；否则只发 release candidate。

验收：

- release zip、sha256、secret scan、fresh install evidence、README claim guard 全部一致。

## 7. 不做什么

V26 明确不做这些：

- 不复制参考源码或品牌文案。
- 不为了补 PZ 项做空 adapter。
- 不把外部产品打包进 DSXU。
- 不把 V18/V20/V24 历史报告直接搬进 GitHub README。
- 不用 Pro 堆成本刷测试。
- 不用 dry plan、readiness、owner-disposition 冒充能力完成。
- 不在没有 raw transcript 的情况下宣称外部胜出。

## 8. 最终吸引点总结

DSXU 要吸引开源用户，最应该打的是这句话：

**一个 DeepSeek-first、Flash-first、证据化、低成本、可恢复、可审计、能真实改代码和跑工具的 AI 编程 TUI/CLI。**

最强卖点顺序：

1. 低成本完成复杂编程任务：cost-per-solved-task。
2. 高级程序员式可见工作状态：work-state timeline。
3. 真实 source truth repair loop：读、改、测、修、报。
4. 统一工具/权限/MCP/Agent runtime：生态可接入但主线不分裂。
5. 长任务恢复：compact/resume 后不丢目标。
6. 公开可复跑挑战：不靠口号，靠 raw evidence。
7. 安装可信：无 key 不泄露，有 wizard，有 doctor，有 secret scan。

V26 的成功不是“文件更多”，而是用户第一次 clone、配置 DeepSeek key、跑一个复杂任务时，能明显感觉到：DSXU 不是聊天壳，而是在用可见、可审计、可恢复的工程流程工作。

## 9. Execution Update 2026-05-15

本轮已开始执行 V26，不做破坏性移动、不删除旧证据、不 stage/commit。先完成 V26-0 与 V26-1 的第一批硬输出。

### 9.1 V26-0 产品/发布/证据入口

新增稳定入口：

| 路径 | 用途 |
|---|---|
| `docs/product/README.md` | GitHub-facing 产品文档入口，只写证据支持的产品口径。 |
| `docs/release/README.md` | 发布 gate 入口，说明当前只能 release candidate，不能宣称已达到对标 90% 能力或外部胜出。 |
| `docs/evidence/README.md` | 证据索引入口，后续新证据按日期归档，历史 V18/V20/V24 保持可追溯。 |

本轮规则：历史 V18/V19/V20/V24 文档仍保留原位，不在本批次强行移动，避免打断已有证据引用。后续产品页不得直接堆历史审计报告。

### 9.2 V26-1 C2 1902 二次能力损失板

新增脚本入口：

| 命令 | 作用 |
|---|---|
| `bun run v26:c2-capability-loss-board` | 读取 V24 C2 1902 full evidence join、C2 loop acceptance，生成 V26 能力损失审计板。 |

生成证据：

| 路径 | 用途 |
|---|---|
| `docs/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.md` | 人读版执行队列。 |
| `docs/generated/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.json` | 机器可读汇总。 |
| `docs/generated/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.csv` | 1902 行逐文件队列。 |

执行结果：

| 项 | 数值 |
|---|---:|
| total rows | 1902 |
| product-specific rows | 594 |
| product-specific rows with DSXU direct path | 545 |
| shared utility rows | 278 |
| P0 review rows | 170 |
| P1 review rows | 494 |
| P0/P1 high-priority review rows | 664 |
| blocked public claim rows | 914 |
| existing owner-evidence claimable rows | 988 |
| C2 loop acceptance | 51/51 |

按能力闭环拆分：

| V26 能力闭环 | rows | product-specific | shared utility |
|---|---:|---:|---:|
| Visible Work-State | 1579 | 534 | 181 |
| Tool / Permission Lifecycle | 1520 | 543 | 214 |
| Source Truth / Coding Loop | 1516 | 537 | 227 |
| Context / Memory / Recovery | 1394 | 506 | 178 |
| Model / Cost / Cache | 1464 | 580 | 197 |
| MCP / Skill / Ecosystem | 912 | 442 | 98 |

当前结论：

- C2 1902 不能再只说“已吸收”。正确口径是：`988` 行可在已有 owner evidence 下谨慎引用；`914` 行仍不能变成公开卖点。
- `594` product-specific 行不是要复制，而是要判断其中是否包含通用 UX、恢复、遥测、权限、工具、上下文机制；通用机制必须落回 DSXU owner。
- `278` shared utility 行不能变成第二套 shared runtime；baseline/no-op 需要证明没有体验损失。
- 下一步必须先处理 P0/P1 owner 队列，优先顺序为：Visible Work-State -> Tool/Permission -> Source Truth Repair -> DeepSeek Runtime -> Context Recovery -> MCP/Skill Ecosystem。

### 9.3 下一批执行顺序

1. 从 `docs/generated/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.csv` 抽取 P0/P1 rows，按 owner 做第一批实现/验收决策。
2. 按本轮 owner priority matrix 执行，不再凭感觉挑文件：

| owner | rows | P0 | P1 | blocked claim |
|---|---:|---:|---:|---:|
| `V20-OGR-12-shared-platform-utilities` | 242 | 40 | 89 | 242 |
| `V20-OGR-06-ui-tui-visible-state` | 682 | 33 | 157 | 253 |
| `V20-OGR-03-tool-permission-lifecycle` | 310 | 33 | 57 | 101 |
| `V20-OGR-04-mcp-skill-plugin-registry` | 185 | 20 | 65 | 96 |
| `V20-OGR-07-provider-migration-model-cost` | 141 | 18 | 45 | 90 |
| `V20-OGR-08-cli-command-transport` | 176 | 8 | 43 | 60 |
| `V20-OGR-09-dsxu-engine-mainline` | 21 | 7 | 13 | 21 |
| `V20-OGR-10-entry-query-tool-composition` | 34 | 6 | 8 | 17 |

3. 第一批实现顺序采用“基础 owner + 体验 owner”并行推进：`OGR-12 shared utilities` 清掉假 baseline/utility loss；`OGR-06 visible state` 补高级程序员可见体验；`OGR-03 tool/permission` 补统一工具和权限负例。
4. 对每个 P0/P1 row 只允许三类结论：`absorb-generic-mechanism`、`exclude-proprietary-or-brand-specific`、`prove-no-loss-with-dsxu-evidence`。
5. 结论为吸收的能力必须进入 DSXU 产品源码 owner，不允许增加 Vxx 命名产品文件。
6. 结论为排除的能力必须写明商业/IP/品牌/产品专属原因，不能用“已有 baseline”糊掉。

### 9.4 V26-0 命名治理升级：全量历史 V* 扫描

用户指出仓库内不止 `V18/V19/V20/V24`，还有其它 `V*` 历史阶段名。本轮已把命名治理脚本升级为扫描 `V6` 到 `V26` / `v6` 到 `v26` 的历史阶段名，同时避开普通 `-v1` contract/test 版本号，防止误杀正常测试版本。

新增脚本入口：

| 命令 | 作用 |
|---|---|
| `bun run v26:naming-governance` | 历史 V* / C2 / OGR / P12 / reference brand 命名治理审计。 |
| `bun run evidence:naming-governance` | 稳定证据别名，后续产品/发布文档使用这个别名。 |

生成证据：

| 路径 | 用途 |
|---|---|
| `docs/DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.md` | 人读版命名治理板。 |
| `docs/generated/DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.json` | 机器可读汇总。 |
| `docs/generated/DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.csv` | 文件级命名信号清单。 |

执行结果：

| 项 | 数值 |
|---|---:|
| scanned files | 2964 |
| files with naming signals | 520 |
| product source rows | 249 |
| rename candidates | 0 |
| package scripts with historical signals | 45 |
| package scripts missing stable alias | 0 |
| public asset rename candidates | 0 |
| ACL residue rows | 3 |

本轮已完成：

- 给历史 `v20:*` / `v24:*` 脚本补稳定能力别名，例如 `release:*`、`acceptance:*`、`benchmark:*`、`evidence:*`、`test:*`。
- 旧 `v20:*` / `v24:*` 保留为可复现 historical shim，不进入 GitHub-facing 产品文档。
- 命名治理板现在能看见 `V6/V7/V8/V9/V10/V11/V12/V14/V18/V19/V20/V24/V26` 等历史阶段信号，而不是只看 V18/V20/V24。
- GitHub launch pack 的公开图表已从 `dsxu-v24-*` 改为稳定产品资产名：`dsxu-routing-mix.svg`、`dsxu-acceptance-evidence.svg`、`dsxu-release-readiness.svg`。
- 公开图表文案也已去掉 `V24/C2` 等内部批次词，改成 routing、acceptance evidence、release readiness、reference mapping、experience-loop checks 等能力名。
- 旧 `dsxu-v24-*` 图表已从 `docs/assets` 移到 `docs/evidence/assets/legacy-v24/`，作为历史证据保留，不再作为公开产品资产。
- `src/dsxu/engine/__tests__` 和 `src/tools/__tests__` 中可安全先改的历史阶段测试文件名已迁到能力名，运行脚本和 release gate 引用已同步。
- 改名后验收：`bun test` 37 个 engine 改名测试文件 -> `168 pass / 0 fail / 1511 expect`；`tool-permission-owner-gate + RunNativeTestTool` -> `9 pass / 0 fail / 28 expect`。
- 零引用产品侧文件名残留已先改能力名：`dsxu-retirement-plan.ts`、`five-task-release-gate.ts`、`provider-service-shell-policy.ts`、`skill-goal-trigger.ts`、`shell-gate.ts`。
- 有真实引用的 `src/dsxu/engine/v7/v8/v9/v10/v11/v18/v19/v20*.ts` 已按能力名迁移，并同步 `src` / `scripts` / `package.json` import/use 路径。
- `v6-mainline-completion-contract.ts` 和对应测试已补入治理范围并迁到 `mainline-completion-contract.ts` / `mainline-completion-contract.test.ts`。
- 迁移后验收：45 个相关测试文件 -> `202 pass / 0 fail / 1665 expect`；V6/release/query focused 复核 -> `56 pass / 0 fail / 451 expect`。
- 迁移过程中发现 `go-stop-decision` BOM/mojibake 归一化样本问题，已把归一化改成短前缀剥离到首个 JSON 起点，避免证据 JSON 因历史编码前缀失败。
- 最后 3 个 `v10-*` harness 无 active import/use，但 Windows ACL 拒绝重命名；本轮已移除旧 wrapper export 行为，改成 `export {}` tombstone，并写入 ACL signoff。`acl:preflight` / `acl:closure-plan` 均为 `PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME`，7/7 ACL residues signed external, activeProductReferenceRows=0。
- 命名治理现在已无普通文件名级 rename candidate：`renameCandidates=0`，剩余 3 行归类为 `acl-residue / acl-external-closure`。

当前仍未完成：

- `src` 中仍有 `249` 个 product-source content-review rows，主要是测试标题、证据路径、历史 trace/runs 名、owner packet 名和审计语义，不等同于公开产品命名泄露；后续只按 public surface / product UX / release docs 优先清理。
- `src/dsxu/integration/harness/v10-context-budget-v1-harness.ts`、`v10-longtask-stability-v1-harness.ts`、`v10-model-gateway-v1-harness.ts` 仍因 Windows ACL 不能物理改名/删除；当前行为已降为 tombstone，权限允许后删除，不允许恢复 wrapper/runtime。
- 历史 evidence 文档允许保留 V* 名称，不能为了好看破坏审计链。

下一批命名治理顺序：

1. 已完成 public assets：公开资产目录只保留稳定 DSXU 产品名，V24 图表归档到 evidence。
2. package scripts 已有稳定别名；后续产品文档只引用稳定别名。
3. 文件名级命名治理已收口；3 个 ACL harness 只等外部权限删除，不再是本地改名任务。
4. 下一步进入 content-review / public surface：不按“文件名垃圾”处理，而按 public surface、GitHub README、release/export、真实 UI/TUI 文案四条线清理。

### 9.5 V-only naming cleanup update - 2026-05-15

本轮按最新执行边界收窄：只处理 `V/v` 历史版本/阶段命名；不处理非 V 的 owner、packet、benchmark、reference 或其它结构名。历史证据文件、历史 trace/runs 路径和可复现实验脚本可以保留 V 名称，但产品运行时、公开 README、公开资产和新产品能力名不能继续扩散历史阶段名。

已完成：

| 项目 | 结果 |
|---|---:|
| product runtime source V/v rows | 33 -> 0 |
| stable public/evidence index V/v rows | 6 -> 0 |
| rename candidates | 0 |
| package scripts missing stable alias | 0 |
| public asset rename candidates | 0 |
| focused tests | 22 pass / 0 fail |
| naming governance | PASS_NAMING_GOVERNANCE_READY |

本轮实际改动：

- `ToolDefinitionV20` 等运行时 API 已改为 owner/capability 命名，不保留兼容别名。
- `V6/V7/V8` completion/productization/product-build contracts 已改成 mainline/productization/product-build 能力名。
- `V18` Code/Terminal runner 的导出类型、常量和 builder 函数已改为能力名；历史 case id 和 `.dsxu` evidence path 只作为证据输入保留。
- `V18` provider migration shell policy 导出名已改成 provider migration service shell policy。
- 产品源码里的 `V10/V12/V13/V14/V15/V18/V20` 注释、提示和 owner 文案已改成能力/owner 文案。
- 命名治理脚本已只扫描历史 `V6-V26 / v6-v26`，并排除真实技术版本误报，例如 JavaScript engine `V8`、API/model/provider 真实版本、Node 版本和长行生成物。
- `runner / compare / smoke / placement / mirror-plan / semantic-tool-trace` 这类读取历史 evidence 的文件归入 product-evidence-source，不再当作第二套 product runtime。

当前允许保留：

- `productEvidenceSourceRows=35`：证据 runner、raw compare、smoke、历史报告读取器等，只能作为 evidence/repro source，不能作为公开产品功能名。
- `testEvidenceSourceRows=79`、`integrationHarnessRows=27`：测试和 harness 可保留历史阶段名用于复现，但新增测试应优先用能力名。
- `packageScriptsWithHistoricalSignals=45`：旧 `v*:*` 脚本只作为 historical shim，公开文档必须用稳定 alias。

下一步只在需要时继续处理 V/v public-surface 文案或证据归档，不再把非 V 名称混进本轮命名治理。


### 9.6 First-Run Key Wizard 与发布复核 - 2026-05-15

本轮已按 V26-6 落地主线首用体验，不新增第二套 auth/runtime：

| 项目 | 结果 |
|---|---|
| `auth login` TTY wizard | 已接入 DSXU Code mode：无 key 且为 TTY 时提示粘贴 DeepSeek key，保存为 DSXU managed local key。 |
| `auth login --api-key-stdin` | 已接入脚本/CI 安全导入路径，从 stdin 读取，不通过命令行参数暴露 key。 |
| 非交互无 key guidance | 保留：无 TTY / 无 key 时只输出配置说明，不阻塞 fresh install smoke。 |
| `auth status --json` | 已能识别 `DSXU managed local key`。 |
| focused auth test | `bun test src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` -> 2 pass / 0 fail。 |
| isolated wizard smoke | 临时 `DSXU_CONFIG_DIR` + `bun --no-env-file` 验证无 key guidance 与 `--api-key-stdin` 保存链路。 |

发布复核已重跑：

| gate | 结果 |
|---|---|
| 六阶段最终测试 | `PASS_V24_SIX_STAGE_FINAL_TESTS`，20/20。 |
| clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`，最新 zip `D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-15T17-58-03-248Z.zip`，secret scan pass。 |
| fresh install smoke | 已从 7 项扩为 8 项，新增 `auth-login-key-wizard-stdin`；结果 `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`，8/8。 |
| public challenge | `PASS_PUBLIC_CHALLENGE_PACKAGE_READY`，但 `scoreFloor=72`。 |
| GitHub launch pack | 旧脚本输出仍为 `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM` / `public95ClaimAllowed=false`；按 V26 新口径理解为：对标 90% 能力 claim 和外部胜出 claim 仍未放行，`githubOpenSourcePackReady=true`。 |

当前真实结论：

- DSXU 已具备 release-candidate 发布证据包：可导出、可 fresh install、无真实 key 泄漏、首用 key 配置路径可复跑。
- 仍不能宣称已达到对标 90% 能力，因为 public challenge scoreFloor 仍为 72。
- 72 分的主因已经不是 key wizard，而是公开 claim 仍缺外部同题 raw transcript、IDE/API bridge 成品化证据，以及 C2 1902 中仍有 `914` 行不能转成公开卖点。
- 下一步若继续冲 95，不应再改小补丁，而应进入 V26-2/V26-5/V26-7：Work-State Timeline 真实 UI 体验、IDE/API bridge 产品化 smoke、公开复杂任务 raw comparison 数据包。

### 9.7 V18 70 PASS 工作流融合复核后的 6 项不合理收口 - 2026-05-16

本节把 2026-05-16 对 `DSXU_CLI_V8拆分_必做关键与达标后再做_V9.xlsx`、V18/V19 CLEAN、V24/V26 证据和源码聚焦测试的复核结果纳入 V26。结论是：V18 70 PASS 大部分已经进入 DSXU 主工作流，确实增强了 DeepSeek Flash-first 编程、终端、工具、权限、恢复、证据和 TUI 可见状态；但下面 6 项不能继续靠口头解释或小补丁绕过，必须作为 V26 正式收口项处理。

复核命令和当前结果：

| 验证面 | 命令/证据 | 结果 |
|---|---|---|
| V18/DeepSeek/工具主链聚焦测试 | `bun test src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/benchmark-runner-route-v1.test.ts src/dsxu/engine/__tests__/query-route-verification-v1.test.ts src/dsxu/engine/__tests__/edit-convergence-gate-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts --path-ignore-patterns=outputs` | 145 pass / 0 fail |
| V18 readiness/eval/stage 真实文件名补测 | `bun test ./src/dsxu/engine/__tests__/benchmark-readiness.test.ts ./src/dsxu/engine/__tests__/eval-baseline-manifest.test.ts ./src/dsxu/engine/__tests__/evidence-eval-pack.test.ts ./src/dsxu/engine/__tests__/stage-close-readiness.test.ts --path-ignore-patterns=outputs` | 18 pass / 0 fail |
| governance/product reality/control plane | `provider-contract`、`reference-governance`、`product-reality`、`goal-driven`、`control-plane` 聚焦测试 | 27 pass / 0 fail |
| C2 1902 join | `bun run evidence:c2-1902-join` | 1902/1902 mapped |
| C2 capability loss | `bun run evidence:c2-capability-loss-board` | OPEN，914 blocked public claim rows |
| 产品 benchmark data pack | `bun run benchmark:product-data` | PASS，但 `final95ClaimAllowed=false` |

#### 9.7.1 不合理点 1：70 PASS 不能等价于对标 90% 公开能力

处理意见：V18 70 PASS 只能证明主链能力已融合，不证明公开复杂编程/复杂任务能力达到 GPT-5.5 / Claude 4.7 的 `90% 左右`，也不证明外部榜单胜出。V26 必须把“内部 PASS”“release candidate”“public 90 ability claim / experience-density claim”拆成三个 gate，禁止在 README、launch pack、产品图表里把 70 PASS 写成对标能力达成。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-7 Public Challenge 90% 数据包 | 把 `scoreFloor=72` 作为当前真实基线，继续补固定公开复杂任务、raw transcript、tool trace、patch/test/cost/risk 数据。 | 只有 score floor 推到 `90 左右`、固定任务集 raw evidence 完整、失败样本公开时，才允许写“对标 GPT-5.5 / Claude 4.7 编程与复杂任务能力 90% 左右”。 |
| V26-8 Final Release Gate | README / launch pack 只写 release-candidate 已证实能力，不写对标能力达成。 | launch pack 中不出现无证据的“90% 能力已达成”“外部胜出”“cache ROI 达标”口径。 |

禁止替代：不能用本地 focused PASS、dry plan、owner disposition、C2 join 数字替代公开挑战数据。

#### 9.7.2 不合理点 2：C2 1902 映射完成不等于全部吸收完成

处理意见：`evidence:c2-1902-join` 证明 1902 个参考源文件都有 DSXU owner/disposition，不等于所有高级程序员体验闭环都已经产品化。当前 `V26_C2_CAPABILITY_LOSS_BOARD` 仍显示 `914` 行不能转成公开卖点，这是 V26-1 的核心硬工作。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-1 C2 1902 二次能力损失审计 | 按 P0/P1 owner 队列处理 `594 product-specific` 与 `278 shared utility`：通用 UX/恢复/遥测/权限/工具/上下文机制必须落回 DSXU owner；品牌、订阅、商业专属逻辑明确 exclude。 | 每个 P0/P1 row 只能落到 `absorb-generic-mechanism`、`exclude-proprietary-or-brand-specific`、`prove-no-loss-with-dsxu-evidence` 三种结论之一。 |
| V26-2/V26-3/V26-4/V26-5 | 把吸收结论分别落到 work-state timeline、DeepSeek runtime、tool/permission/recovery、MCP/skill ecosystem。 | 对应能力有 DSXU 实际文件、import/use、focused test、live/TUI/API evidence。 |

禁止替代：不能把 `1902/1902 mapped` 写成 feature parity；不能复制参考产品源码、文案、品牌或商业入口。

#### 9.7.3 不合理点 3：CLEAN 报告部分 V18 测试命令名过时

处理意见：功能测试存在且通过，但文档里仍有旧命令名，例如 `v18-benchmark-readiness-v1.test.ts` 这类路径已经迁移为能力命名文件。这个问题会让 owner review 和后续自动验收误判。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-0 Naming Governance | 建立 V18/V19 CLEAN 命令引用表：历史命令 -> 当前真实能力文件 -> 稳定 script alias。 | CLEAN / V26 / release runbook 中所有可执行命令都能直接跑通或明确标记为 historical evidence。 |
| V26-8 Final Release Gate | final test runner 读取真实文件名，不再依赖过时 V18 路径。 | `bun test` 不出现“filter did not match any test files”的文档命令。 |

禁止替代：不能只在最终回复里解释“文件改名了”；必须在方案/证据索引里给真实命令。

#### 9.7.4 不合理点 4：release evidence 聚合口径滞后

处理意见：六阶段测试、clean export artifact、fresh install smoke 已有 2026-05-15 PASS 证据，但 `product-benchmark-data-pack` / `public-challenge-package` 仍保留旧 remaining gate 和 `cleanExportArtifactCreated=false`。这会让产品卖点和发布状态出现自相矛盾。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-8 Final Release Gate | 让 product benchmark data pack、public challenge package、GitHub launch pack 统一读取最新 six-stage、clean export、fresh install evidence。 | `cleanExportArtifactCreated=true` 时必须带 zip path、sha256、secret scan、fresh install smoke；remaining gate 只保留真实未完成项。 |
| V26-7 Public Challenge | 即使 release gates PASS，对标 90% 能力 claim / 体验闭环 claim 仍由 raw benchmark/product demo 数据单独控制。 | release-ready 与 public benchmark-ready 分离展示，不互相冒充。 |

禁止替代：不能因为 clean export PASS 就自动宣称对标能力达成；也不能因为旧 `public95` gate blocked 就忽略已有 release PASS 证据。

#### 9.7.5 不合理点 5：`outputs/...clean-export...` 旧导出副本污染测试发现

处理意见：源码主链测试通过，但默认测试发现会扫到 `outputs` 里的旧 clean export 副本，并触发旧断言失败。这个问题不是主链功能失败，但会破坏“开源用户 clone 后一键测试”的可信体验。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-0 Naming / Source Hygiene | 明确 `outputs`、release artifacts、历史导出副本不是源码测试输入；测试配置和 release runbook 默认忽略这些目录。 | 不带手工补充参数时，标准测试不会扫描旧导出副本。 |
| V26-8 Final Release Gate | clean export 只能输出到源仓库外部 release artifact 目录，源仓库内只保留必要证据索引。 | fresh install smoke 在导出目录跑；源码仓库测试不被导出副本污染。 |

禁止替代：不能把旧导出副本里的失败当成当前源码失败；也不能靠每次人工记住 `--path-ignore-patterns=outputs` 维持。

#### 9.7.6 不合理点 6：R01/R02/S02/R04/R05/R06 缺 raw live，不能用 readiness 冒充

处理意见：这 6 项是打榜/公开卖点的硬证据缺口，不是普通功能小缺口。V18 表格把它们放在路线/评测面，CLEAN 已明确不能用 dry plan、readiness、模板日志、target-only logs 顶替。

处理方案：

| owner | 动作 | 验收 |
|---|---|---|
| V26-7 Public Challenge 90% 数据包 | 为 R01/R02/S02/R04/R05/R06 建立同一 raw evidence schema：DSXU raw transcript、target/reference raw transcript、tool trace、final report、artifacts、metrics、risks、cost。 | 每个 claim 必须能追到同题 raw input/output；没有 target raw 时只能写 DSXU 自测，不写外部胜出。 |
| V26-3 DeepSeek Runtime Excellence | raw live 任务必须真实走 DeepSeek Flash-first 调度，Pro 只在 admission evidence 满足时进入。 | route/cost/cache/latency/pro-admission evidence 完整。 |

禁止替代：不能用 generic logs、collection template、target-only logs、dry report、手写分数代替 paired raw logs。

#### 9.7.7 本 6 项的执行排序

为了避免继续小步补丁，V26 后续按下面顺序处理：

1. 先修 release/test truth：清理过时测试命令引用、隔离 `outputs` 测试污染、统一 release evidence 聚合。
2. 再修 capability truth：继续处理 C2 914 blocked public claim rows，优先 P0/P1 owner 队列。
3. 再修 public benchmark truth：补 R01/R02/S02/R04/R05/R06 raw live/paired evidence。
4. 最后才重跑六阶段、clean export、fresh install、launch pack，并决定是否允许对标 90% 能力 claim / 体验闭环 claim；旧 `public95ClaimAllowed` 字段只作为历史 gate 名称。

本节裁决：V18 70 PASS 已经能证明 DSXU 主链变强；但 V26 的对标 90% 能力目标与接近高级程序员体感目标，必须以这 6 项全部收口为前提。任何“少做测试、先发布对标达成口径”或“用映射完成替代体验完成”的做法都不符合 V26。

### 9.8 V26 10x 批量执行记录 - 2026-05-16

本节开始执行“每一步完成后同步执行记录”的纪律。V26 后续不再把已定义 gate 拆成新的小层；每轮只允许推进真实 blocker、同步证据、跑标准或完整验收。

本轮固定顺序：

1. release/test truth 聚合：让 product benchmark、public challenge、GitHub launch pack 统一读取最新 six-stage、clean export、fresh install evidence。
2. source hygiene：阻断 `outputs` 旧 clean export 副本污染源码测试发现，不能靠人工每次补参数。
3. capability truth：继续处理 C2 914 blocked public claim rows，优先 P0/P1 owner 队列。
4. public benchmark truth：补 R01/R02/S02/R04/R05/R06 raw live/paired evidence。
5. final release truth：最后才重跑六阶段测试、clean export、fresh install、launch pack，并决定是否允许对标 90% 能力 claim / 体验闭环 claim；旧 `public95ClaimAllowed` 字段只作为历史 gate 名称。

本轮已执行：

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| release/test truth 聚合 | DONE | `scripts/dsxu-v24-product-benchmark-data-pack.ts` 与 `scripts/dsxu-v24-public-challenge-package.ts` 已改为读取 six-stage、clean export、fresh install 证据；不再把已 PASS 的 release gates 写成 remaining blocker。 | 首轮 `bun run benchmark:product-data` -> PASS；`cleanExportArtifactCreated=true`，带 zip path/sha256。首轮 `bun run benchmark:public-challenge` -> PASS，`releaseGatesPass=true`，`scoreFloor=72`，Flash cost `0.0297841152`。C2 closure 接入后已重跑，remaining 只剩公开 raw score / paired comparison / 新对标口径。 |
| `outputs` 测试污染隔离 | DONE | `bunfig.toml` 已加入测试忽略 `outputs/**`；不靠人工每次补 CLI 参数。 | 不带人工 ignore 参数重跑主链 focused test：`145 pass / 0 fail / 1283 expect`，旧 clean export 副本未污染源码测试发现。 |
| GitHub launch pack 同步 | DONE | launch pack 已重跑，继续使用稳定产品资产名和真实 release evidence。 | `bun run release:github-launch-pack` -> `githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`，`scoreFloor=72`。 |
| C2 914 public-claim boundary | DONE | 新增 `scripts/dsxu-v26-c2-public-claim-closure.ts`，把 V26 capability-loss board、V20 final signoff、C2 loop acceptance、experience-density rebaseline 合并成公开声明边界签收；接入 product benchmark、public challenge、GitHub launch pack。 | `bun run evidence:c2-public-claim-closure` -> `PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED`，`914/914` prior blocked rows closed，`referenceFeatureParityClaimAllowed=false`，`dsxuGenericExperienceClaimAllowed=true`。重跑 `benchmark:product-data` / `benchmark:public-challenge` / `release:github-launch-pack` 后，C2 不再出现在 remaining final claim gates。 |
| second QueryEngine / recovery legacy surface | DONE | `src/dsxu/engine/index.ts` 的旧 engine package class 从 `QueryEngine` 改为 `EngineHarness`，产品入口继续只使用根 `src/QueryEngine.ts`；`src/dsxu/engine/recovery/index.ts` 不再 re-export v2/legacy planner/factory，只公开 v3 mainline surface。 | Focused tests：`engine.test.ts`、`p0-3-core-gaps.test.ts`、`skills-failure-path.test.ts`、`skills-integration.test.ts`、`recovery-mainline-v3.test.ts`、`product-runtime-owner-map-v1.test.ts` -> `43 pass / 0 fail`；`query-loop-run-query-v1.test.ts`、`query-route-verification-v1.test.ts`、`engine.test.ts` -> `14 pass / 0 fail`。 |
| public challenge source-truth refresh | DONE | Flash review prompts 已改读 V26 9.8、C2 public-claim closure、clean export artifact、fresh install smoke、DeepSeek route/cost 源码与 recovery mainline，不再以旧 V24 plan blocker 为主证据。 | 重跑 `bun run benchmark:public-challenge` -> PASS，`scoreFloor=72`，`c2PublicClaimBoundaryClosed=true`，`releaseGatesPass=true`，Flash cost `0.0310011072`。三项 review 分数为 public claim guard `72`、senior coding `82`、release ecosystem `93`；当前最低分仍由 R01/R02/S02/R04/R05/R06 raw live / paired evidence 缺口决定。 |
| raw live / final release | NEXT | 本轮没有用小补丁冒充 R01/R02/S02/R04/R05/R06 raw live 或外部同题 target comparison。 | 下一批进入 public benchmark truth：补固定任务 raw live/paired evidence；最终六阶段/clean export 只在这些真实 blocker 推进后重跑。 |

### 9.9 V26 10x 批量执行记录 - DeepSeek runtime / recovery / GitHub OSS metadata

本批继续按“先处理问题，最后全面测试”的顺序推进。没有把 public 95 写成已完成，也没有用模板日志替代 raw benchmark truth。

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| V26-3 DeepSeekTrajectoryStore | DONE | 新增 `src/services/api/deepseek-trajectory-store.ts`，并接入 `src/services/api/deepseek-adapter.ts`。真实 DeepSeek adapter 请求会在显式设置 `DSXU_DEEPSEEK_TRAJECTORY_FILE` 时记录 request plan、message/tool-result summary、JSON/stream response、usage/cache/route/request id；只保存 hash、长度、结构和 usage，不保存 prompt、reasoning 原文、tool result 原文或 key。 | `bun test src/services/api/deepseek-trajectory-store.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts` -> 29 pass / 0 fail。 |
| Public challenge trajectory evidence | DONE | `scripts/dsxu-v24-public-challenge-package.ts` 每个 Flash review 现在都会设置 `DSXU_DEEPSEEK_TRAJECTORY_FILE`，并把 trajectory path 写入 public challenge JSON。 | 重跑 `bun run benchmark:public-challenge` -> PASS，3/3 Flash reviews 带 trajectory path，`totalFlashCostUSD=0.021044234400000004`，`scoreFloor=72`。 |
| V26-4 QueryEngine recovery mainline consumption | DONE | `src/QueryEngine.ts` 在 `error_max_turns`、`error_max_budget_usd`、`error_max_structured_output_retries`、`error_during_execution` 四类产品主入口终止错误中消费 `createDSXURecoveryMainlineBundle`，把 recovery v3 planner/tool 决策写入 result `errors[]` 证据；没有新建第二套 recovery loop。 | `bun test src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts ...` 聚合 focused batch -> 37 pass / 0 fail。Flash senior-coding review 分数从 78/82 区间提升到 88。 |
| GitHub OSS metadata baseline | DONE | `package.json` 从本地占位 `999.0.0-local/private=true` 改为开源候选 `0.1.0/private=false`，补 `description`、`license=Apache-2.0`、`repository`、`bugs`、`homepage`，新增 `LICENSE`。 | 重跑 `bun run release:github-launch-pack` -> `githubOpenSourcePackReady=true`，release ecosystem Flash review 分数提升到 92；仍禁止宣称 95。实际 GitHub org/repo URL 发布前可按最终仓库名替换。 |
| Product/launch pack sync | DONE | `scripts/dsxu-v24-product-benchmark-data-pack.ts` 和 `scripts/dsxu-v24-github-open-source-launch-pack.ts` 已读取 trajectory review count，把 DeepSeek trajectory evidence 纳入产品卖点和 launch metrics。 | `bun run benchmark:product-data` -> PASS，`deepSeekTrajectoryReviewCount=3/3`；`bun run release:github-launch-pack` -> `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`public95ClaimAllowed=false`，`scoreFloor=72`。 |
| P12 raw readiness hard gate | DONE_CURRENT_BLOCKER_RECONFIRMED | 执行 `bun run p12:raw-readiness`，没有导入或伪造 target-reference raw logs。 | 结果 `status=BLOCKED`，`p12PairedRawLogCount=0`，`p12MinimumPairedRawLogsForPass=14`，`p12ReplayFamilyGapCount=14`，`nextAction=collect-target-reference-raw-logs`；blockers 列出 14 个 RT same-task target-reference raw log 缺口。 |
| Raw evidence gate regression | DONE | 针对 P12 raw comparison 和 raw evidence readiness register 跑 focused regression，确认 dry plan、generic logs、wrong-side manifest、collection template 都不能冒充 PASS。 | `bun test src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts` -> 17 pass / 0 fail / 203 expect。 |
| Public 90 raw benchmark truth | NEXT | 本批没有伪造 R01/R02/S02/R04/R05/R06 raw live 或外部同题 target transcript。 | 当前真实 remaining 只剩两项：`public challenge scoreFloor toward 90 with fixed raw task data`；`same-task external/target raw transcript evidence before any superiority claim`。 |

### 9.10 V26 C2 owner implementation acceptance - 2026-05-16

本节把 9.2 的 C2 1902 二次能力损失板升级成更硬的 owner implementation acceptance。它不是再新增一个概念层，而是把原 `public-claim closure` 继续压实成每个 owner 的实现/验收裁决，防止把“公开声明边界已关闭”误读成“1902 文件全部 feature parity”。

固定优先顺序：

1. Visible Work-State
2. Tool/Permission
3. Source Truth Repair
4. DeepSeek Runtime
5. Context Recovery
6. MCP/Skill Ecosystem

每个 C2 row 只允许四种结论：

| conclusion | 含义 | public claim |
|---|---|---|
| `implemented+tested` | DSXU named owner 已有行为证据、测试证据、live/TUI/API 证据。 | 只能宣称 DSXU-owned generic mechanism，不能宣称参考产品 feature parity。 |
| `adapted/excluded` | 品牌、订阅、商业专属、产品专属行为已排除或 DSXU 化适配。 | 不能作为功能等价卖点。 |
| `no-loss baseline` | shared utility 已签收为 baseline/no-new-absorption 或 reference-only no-loss。 | 不能包装成新增产品能力。 |
| `needs real code/test` | 缺真实 DSXU code/test/live evidence。 | 必须先实现或补真实验收。 |

本轮已执行：

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| C2 owner implementation acceptance script | DONE | 新增 `scripts/dsxu-v26-c2-owner-implementation-acceptance.ts`，读取 C2 capability-loss board、V20 final absorption signoff、C2 public-claim closure，生成 owner implementation acceptance JSON/CSV/Markdown。 | `bun run evidence:c2-owner-implementation-acceptance` -> `PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED`。 |
| package script entry | DONE | 新增 `v26:c2-owner-implementation-acceptance` 与 `evidence:c2-owner-implementation-acceptance`。 | 后续可复跑，不靠手工表格。 |
| 1902 四类裁决 | DONE | 输出 `docs/generated/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json`、`.csv` 与 `docs/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.md`。 | `1902/1902` rows resolved：`implemented+tested=1096`，`adapted/excluded=601`，`no-loss baseline=205`，`needs real code/test=0`。 |
| 六闭环 owner matrix | DONE | 按 Visible Work-State -> Tool/Permission -> Source Truth Repair -> DeepSeek Runtime -> Context Recovery -> MCP/Skill Ecosystem 输出 loop acceptance order。 | 所有 loop 的 `needsRealCodeTest=0`；但 `referenceFeatureParityClaimAllowed=false`，`public95ClaimAllowed=false`。 |
| product benchmark / public challenge / launch pack 接入 | DONE | `scripts/dsxu-v24-product-benchmark-data-pack.ts`、`scripts/dsxu-v24-public-challenge-package.ts`、`scripts/dsxu-v24-github-open-source-launch-pack.ts` 已读取 C2 owner implementation acceptance。Flash review prompt 已澄清 `pro_needed` 只表示当前包必须立即升级 Pro 才能判断，不能把未来优化项误记成 Pro required。 | 复跑 `bun run benchmark:public-challenge` -> `PASS_PUBLIC_CHALLENGE_PACKAGE_READY`，`scoreFloor=72`，Flash cost `0.0460576816`；`bun run benchmark:product-data` -> `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY`；`bun run release:github-launch-pack` -> `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`。 |

裁决口径：

- C2 owner implementation acceptance 已完成，说明 1902 行没有继续停在未知 owner 或 generic bucket。
- 这不等于参考产品完整功能复刻；`601` 行明确是 adapted/excluded，`205` 行只是 no-loss baseline。
- V26 仍不能公开宣称对标 90% 能力或外部胜出；下一步仍是 public benchmark truth：固定公开复杂任务 raw live、同题 target/reference raw transcript、成本/失败/恢复/patch/test 证据。
 
### 9.11 V26 reference experience reverse analysis + work-state timeline - 2026-05-16

本轮按“反向分析 1902 文件 -> 抽象通用机制 -> 落回 DSXU owner -> 实现/验收”的路径推进，不复制参考源码、prompt、品牌文案或商业专属行为。

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| 1902 文件反向分析 | DONE | 新增 `scripts/dsxu-v26-reference-experience-reverse-analysis.ts`，直接扫描 `D:\源代码claude\src` 的 1902 个源码文件，按 12 个高级程序员体验闭环重建信号分布，并对齐 DSXU owner、真实文件、测试和 live evidence。 | `bun run v26:reference-experience-reverse-analysis` -> `PASS_REFERENCE_1902_REVERSE_ANALYSIS_GENERATED`，输出 `docs/DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_20260516.md`、JSON、CSV。 |
| 可见高级程序员工作状态 | DONE | 新增 `src/dsxu/engine/work-state-timeline.ts`，把 goal、plan、source truth、tool、permission、failure、recovery、cost、agent、evidence、nextAction 统一成 DSXU-owned visible-state projection contract。它只投影状态，不执行 tool、query、provider、MCP 或 shell。 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` PASS：完整 senior coding loop 可 PASS；失败无恢复、权限不可见、缺 source truth、缺 cost/nextAction 会被 guard 阻断；源码不含第二 runtime 入口。 |
| 参考源路径修正 | DONE | `reference-experience-quality-contract-v1.test.ts` 不再只认旧的仓库内镜像路径，同时支持当前真实外部参考路径 `D:\源代码claude\src`。 | Focused batch：`work-state-timeline` + `phase12-senior-programmer-experience` + `reference-experience-quality-contract` -> `11 pass / 0 fail / 172 expect`。 |

反向分析得到的 12 个闭环中，当前可作为 DSXU-owned mechanism 证据引用的是：Goal/Plan/Query Loop、Visible Work-State、Tool/Permission、Source Truth Repair、Context/Recovery、Agent、MCP/Skill、DeepSeek Cost/Cache、First-Run Trust、Evidence/Release。仍只能作为 roadmap/internal evidence 的是：Terminal/Shell Reliability 需要更强 live product benchmark；IDE/Remote/External Host Boundary 需要真实 host/API/IDE bridge live evidence。

裁决：这轮不是“文件名映射完成”，而是把参考源里最有价值的体验密度落成 DSXU 原创主线能力。下一步若继续推进对标 90% 能力与接近高级程序员体感，优先补 Terminal/Shell 和 IDE/Remote 两个 partial live evidence，再进入固定 public benchmark raw task pack。

### 9.12 GPT-5.5 reverse-analysis actionable plan + cache-hit optimization - 2026-05-16

本节把 9.11 的反向分析从“发现”升级成“可执行方案”。结论不是只有 `DSXU-owned visible-state projection` 一个建议；它只是总线。真正要做的是把 1902 参考源码里体现的高级程序员体验闭环，基于 DeepSeek Flash-first 调度重建成 DSXU 自有产品能力。

硬边界：
- 不复制参考源码、prompt、UI 文案、品牌、商业专属行为或专利风险实现。
- 不新增第二套 query/tool/provider/MCP/agent/runtime。
- 所有能力必须落回 DSXU owner、Tool Gate、Permission Gate、DeepSeek route/cost/cache、TUI/CLI visible state 和 Evidence/Release。
- 公开 GitHub 只能写有 raw evidence 支撑的卖点；旧字段 `public95ClaimAllowed=false` 时不得宣称对标 90% 能力或外部胜出。

#### 9.12.1 12 个体验闭环的实施裁决

| loop | DSXU owner | 当前裁决 | 下一步动作 | 验收 |
|---|---|---|---|---|
| Goal / Plan / Query Loop | DSXU Query Loop / Entry Composition | implemented+tested | 把复杂任务目标、计划变更、下一步统一输出到 work-state timeline | senior coding window 中每轮都有 goal/plan/nextAction |
| Visible Work-State | UI/TUI Visible-State Projection | implemented+tested, 但未全量接产品 UI | 将 `work-state-timeline` 接入 CLI/TUI stream/final report | TUI/CLI/stream-json 三端同一状态字段 |
| Tool / Permission Lifecycle | Tool Gate / Permission Gate | implemented+tested | 每次工具调用显示 purpose、risk、permission、result、evidence | 拒绝/恢复负例可见，side-effect 无 permission 不得 PASS |
| Source Truth Repair | Source Truth / Coding Repair | implemented+tested | 所有复杂任务默认 source reread -> patch -> focused test -> report | 不能用计划替代代码/测试证据 |
| Terminal / Shell Reliability | Terminal Adapter / Result Pack | needs stronger live evidence | 建 terminal live benchmark：Windows/PowerShell/WSL、失败分类、输出摘要、恢复路径 | Terminal ResultPack 有 raw command/stdout/stderr/exit/failure taxonomy |
| Context / Memory / Recovery | Context Builder / Recovery Mainline | implemented+tested | compact/resume 后强制重读 source truth，保留失败和下一步 | resume replay 里不丢 goal、files、failed command、risk |
| Agent Orchestration | Agent Lifecycle | implemented+tested | 父级只引用 worker evidence，worker ownership 必须显式 | parent final 不能引用未验证 worker 成功 |
| MCP / Skill Ecosystem | MCP / Skill Registry | implemented+tested | registry 增强 schema verification、secret redaction、doctor、permission mapping | MCP/skill 接入仍走 Tool Gate，不形成 standalone runtime |
| Model / Cost / Cache | DeepSeek Runtime / Cost Evidence | implemented+tested, cache ROI 待优化 | 优化 public challenge stable prefix / dynamic tail / cache ROI board | public challenge cache hit 从 26.4%/41.1% 继续提升，尽量接近 DeepSeek 官方高命中表现，但不设 70/100 release 死线 |
| IDE / Remote / External Host | External Host Adapter Boundary | needs stronger live evidence | 做 API/IDE/remote host boundary smoke，不嵌入第三方产品 | host/API/IDE live evidence 存在前只能 roadmap |
| First-Run Trust / Doctor | Install / Auth / Doctor | implemented+tested | 首次 key wizard、doctor、provider gate 输出成本策略和安全存储说明 | fresh install smoke + no-key/key-stdin 流程通过 |
| Evidence / Release Gate | Evidence / Release | implemented+tested | GitHub pack 增加数据图、claim guard、secret/IP scan、release provenance | clean export/fresh install/release pack 证据一致 |

#### 9.12.2 V18 -> DSXU 卖点组的可做事项

| V18 卖点组 | 当前能公开写 | 还要补强 |
|---|---|---|
| DeepSeek 原生路由 | Flash-first、Pro admission、cost evidence | 增加 route mix、cache ROI、cost-per-solved-task 图 |
| 真实编码闭环 | 30.48 min senior coding window、failed-to-pass test | 增加固定 20-30 个公开复杂任务 raw transcript |
| 终端/工具智能 | shell/tool lifecycle 有测试证据 | 补 Terminal ResultPack live benchmark，不再只靠 readiness |
| 权限与证据 | Permission Gate、Tool lifecycle、anti-fake PASS guard | 增加拒绝/恢复/side-effect 负例展示 |
| 交互与恢复 | TUI replay、compact/resume/recovery evidence | 接入 `work-state-timeline`，形成统一可见工作状态 |
| Agent 能力 | evidence-only worker / parent synthesis | 强化 worker ownership、disjoint scope、verifier rejection |
| 浏览器/外部动作 | browser/dev-server screenshot/evidence | 只做 DSXU-owned adapter boundary，不做独立 browser runtime |

#### 9.12.3 DeepSeek 成本路由主线裁决

当前主线已经统一：

`inferDeepSeekV4RouteInput` -> `decideDeepSeekV4Route` -> `resolveDeepSeekV4CostRoute` -> `DeepSeekAdapter.resolveRequestPlanForBaseUrl` -> `normalizeUsage` / `DeepSeekTrajectoryStore` / evidence pack。

当前统计：
- product benchmark catalog：`98` cases。
- route mix：`94` Flash / `4` Pro，Flash ratio `95.9%`，Pro ratio `4.1%`。
- senior coding window：`30.48 min`，Flash-only cost `$0.3128853504`，Pro used `false`。
- public challenge Flash reviews：`3/3` 有 trajectory path，总 cost `$0.0460576816`。
- focused cost-route tests：`34 pass / 0 fail / 309 expect`。

路由策略裁决：
- 普通 coding / feature / bugfix：`deepseek-v4-flash` non-thinking。
- repo understanding / requiresReasoning：Flash thinking high。
- planning / review / recovery：Flash thinking max。
- failed verification / high-risk permission / FIM：Pro gate，必须有 admission evidence。

保留风险：
- `model-routing-control.ts` 里仍有 provider profile / fallback chain 表达，它必须继续作为 projection / planning facade，不得变成第二套 provider runtime。
- trajectory store 当前是 env-gated；这保护隐私和成本，但默认可观测性不够强。公开 demo 应显式开启 trajectory evidence。

#### 9.12.4 Cache-hit optimization plan

当前命中率分层：

| evidence | cache hit result | 裁决 |
|---|---:|---|
| controlled recovery task | 85.3% | 机制有效 |
| controlled Flash-only feature task | 86.5% | 机制有效 |
| live provider cache-prefix ingest | 98.7% | prefix payload 可行 |
| public challenge 3 Flash reviews aggregate | 26.4% | 不达标，不能作为公开命中率卖点 |

优化目标：
- P0：public challenge 先证明公开复杂编程/复杂任务能力达到对标 GPT-5.5 / Claude 4.7 的 `90% 左右`水平；当前 `scoreFloor=72` 仍需继续补真实任务与体验证据。
- P1：体验闭环密度尽量接近高级程序员工作方式的 `100% 体感`，重点看目标保持、读写代码、工具调用、失败恢复、上下文恢复、成本可见、证据可追溯，而不是只看单个分数。
- P2：cache hit 不设 100% 硬要求，也不把 70% 当 release 死线；以 DeepSeek 官方高命中表现作为优化方向，真实目标是尽可能提高命中率、降低 toolResultChars 和成本，同时不牺牲 source truth、测试、失败证据和任务质量。
- P3：每个公开 demo 输出 `hit/miss/output/cost/routeReason/cacheROI`，并明确哪些是已达成卖点，哪些只是优化趋势。

实施动作：
1. 将 public challenge prompt 拆成稳定 prefix 与动态 tail：稳定 prefix 放系统规则、claim guard、输出 schema、DSXU owner 约束；动态 tail 只放本轮文件列表、任务 ID 和少量变化参数。
2. 对 `scripts/dsxu-v24-public-challenge-package.ts` 增加 cache summary 聚合：per review hit rate、aggregate hit rate、miss source、route reason、cost delta。
3. 对 `DeepSeekTrajectoryStore` 的 public challenge 使用场景增加 summary index：不保存 raw prompt，只保存 stablePrefixHash、dynamicTailHash、messageCount、toolResultCount、cacheHit/Miss。
4. 增加 `cache-regression guard`：同类 public review 若 stablePrefixHash 频繁变化，直接标记 `CACHE_PREFIX_UNSTABLE`，不得写成命中率优化完成。
5. 对 Pro admission 建 ROI board：Pro 节点必须有 prior Flash attempt、admission reason、saved-task evidence；无 saved-task evidence 的非安全 Pro route 进入 demotion candidate。
6. GitHub 数据图只展示真实指标：route mix、cache hit rate、cost-per-solved-task、score floor、failure recovery，不展示目标值冒充结果。

禁止替代：
- 不得用 controlled harness 的 85%-98% 命中率替代 public challenge 26.4%。
- 不得把 “trajectory path 存在” 写成 “成本优化达标”。
- 不得为提高命中率而减少真实 source truth、测试或失败证据。

#### 9.12.5 Visible-state projection 不是单点功能，而是产品总线

`work-state-timeline` 的定位：
- 它不执行工具、不调模型、不做 provider routing、不连接 MCP，不是第二套 runtime。
- 它把 DSXU 主线已有行为投影成统一 operator contract。
- 它应该成为 TUI/CLI/stream-json/final report 的共同状态层。

接入顺序：
1. CLI/stream-json：输出 `goal/plan/currentAction/toolState/permissionState/costState/evidence/nextAction`。
2. TUI：把 permission、tool progress、failure/recovery、cost/cache 命中率接入同一 timeline。
3. final report：输出 patch/test/risk/cost/evidence，不只写“完成”。
4. public challenge：每个 raw task 必须带 timeline summary。

验收：
- failure without recovery guard 必须阻断 PASS。
- side-effect tool without visible permission guard 必须阻断 PASS。
- source truth missing 必须阻断 coding PASS。
- cost/route missing 时不能进入公开成本卖点。

#### 9.12.6 下一步固定执行顺序

1. 先做 `Visible Work-State product wiring`：把 `work-state-timeline` 接到 CLI/TUI/stream-json/final report。
2. 再做 `Cache-hit public challenge optimization`：目标是尽可能提升真实 public challenge cache hit、降低工具结果膨胀和成本，同时保留真实 raw evidence；cache 不能成为牺牲质量的死指标。
3. 再做 `Terminal/Shell Reliability live benchmark`：补 Terminal ResultPack。
4. 再做 `IDE/API/Remote Host Boundary smoke`：只做 DSXU-owned adapter boundary，不接第三方产品 runtime。
5. 再做 `20-30 fixed public raw tasks`：每个任务包含 transcript、tool trace、patch/test、cost/cache、timeline、failure/recovery。
6. 最后才重跑六阶段测试、clean export、fresh install、GitHub launch pack，并重新判断公开对标口径：能力是否达到 `90% 左右`，体验闭环是否接近高级程序员体感，cache/cost 是否有真实可解释优化。

本节裁决：V26 的下一轮不是继续加小层，而是把已经确认的 12 个闭环压成三条产品主线：`visible-state`、`DeepSeek cost/cache route`、`terminal/IDE live evidence`。完成这些之前，DSXU 可以发布 release candidate 和真实卖点，但不能发布“对标 GPT-5.5 / Claude 4.7 编程与复杂任务能力 90% 左右已达成”、也不能发布外部胜出口径。

### 9.13 V26 visible-state product wiring execution - 2026-05-16

本节承接 9.12.6 的第一硬顺序：先做 `Visible Work-State product wiring`，并把 DeepSeek route/cost/cache/trajectory、Tool/Permission/Agent/MCP evidence 统一投影到 DSXU-owned work-state timeline。执行边界仍然不变：它只做产品可见状态投影，不执行工具、不调模型、不连接 MCP、不创建第二套 runtime。

本轮已执行：

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| final report timeline wiring | DONE | `src/dsxu/engine/code-mode-surgical-loop.ts` 的 `DSXUFinalPatchReport` 新增 `workStateTimeline`，`buildDSXUFinalPatchReport` 现在会把 source truth、focused verification、permission visibility、DeepSeek route/cost/cache、agent evidence、MCP/skill evidence、final evidence、next action 统一投影。 | final report 不再只有“PASS/summary”，而是带可审计 timeline；缺 route/cost/cache 时 timeline 为 `NEEDS_WORK_STATE_TIMELINE_EVIDENCE`，不能冒充公开成本卖点。 |
| DeepSeek route/cost/cache query projection | DONE | `src/query.ts` 的 final usage evidence system message 新增 `work_state_timeline_status` / `work_state_guards`，由同一个 `buildDSXUWorkStateTimeline` 生成。 | 主 query / stream / CLI/TUI 消费原有 system info message 时能看到同一口径的 route/cost/cache 状态；usage 缺失时 guard 为 blocked，不写成 READY。 |
| Tool/Permission/Agent/MCP projection contract | DONE_BASELINE | final report timeline 支持 `permissionEvidence`、`agentEvidence`、`mcpEvidence`、`trajectoryEvidence` 输入；默认代码修复路径会投影 Tool Gate verification、Permission Gate scoped mutation、Evidence/Release。 | 已有测试覆盖 agent/MCP evidence 进入 timeline；后续真实 Agent/MCP runtime 只需要把现有 owner evidence 传入，不允许新建 runtime 或桥接桶。 |
| work-state guard hardening | DONE | `src/dsxu/engine/work-state-timeline.ts` 增加 `requiresToolState` 控制，并把 blocked/skipped permission/cost 视为不可 READY。 | side-effect path 的 permission blocked、cost/cache blocked 都不能得到 `PASS_WORK_STATE_TIMELINE_READY`。 |
| public API export | DONE | `src/dsxu/engine/index.ts` 导出 `buildDSXUFinalReportWorkStateTimeline`。 | 后续 CLI/TUI/benchmark/release pack 可复用同一 helper，不需要复制状态构建逻辑。 |

本轮验收：

```text
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts src/dsxu/engine/__tests__/phase12-senior-programmer-experience-v1.test.ts
=> 10 pass / 0 fail / 137 expect

bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts src/dsxu/engine/__tests__/query-route-verification-v1.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts
=> 63 pass / 0 fail / 462 expect

bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts
=> 46 pass / 0 fail / 424 expect
```

本节裁决：
- 已完成：final report 和主 query final usage 进入同一 work-state projection；DeepSeek route/cost/cache 缺失会阻断 timeline READY；Tool/Permission/Agent/MCP evidence 有统一投影入口。
- 未完成：TUI 视觉面板和 stream-json 独立字段还没有做结构化展示；当前它们通过已有 system info/final report 口径间接可见。下一步应把 timeline summary 接到 TUI/CLI 显示层和 stream-json result metadata，而不是再新增状态结构。
- 下一硬顺序：`Cache-hit public challenge optimization`，目标是从 public challenge 26.4%/41.1% 的真实基线继续提升命中率、降低工具结果膨胀和成本，同时保留真实 source truth、tool trace、failure/recovery、cost evidence；不把固定 70/100 当 release 死线。

### 9.14 V26 public challenge cache-hit optimization execution - 2026-05-16

本节执行 9.12.6 的第二硬顺序：优化 public challenge 的 Flash cache hit，不允许用 controlled harness 的 85%-98% 命中率冒充 public challenge 结果，也不允许为了命中率减少 source truth 或真实 review 任务。

本轮已执行：

| step | 状态 | 真实改动 | 验收口径 |
|---|---|---|---|
| stable prefix / dynamic tail split | DONE | `scripts/dsxu-v24-public-challenge-package.ts` 新增 `PUBLIC_CHALLENGE_STABLE_PREFIX`，三条 Flash review 共用同一套 V26 claim guard、Flash-first、no parity/no copied behavior、JSON-only、evidence-only 公共规则；每个任务的文件清单、schema、审查焦点保留在 dynamic tail。 | 后续真实跑 public challenge 时，三条 review 的 `stablePrefixHash` 应相同，`dynamicTailHash` 应随任务变化；不能靠删任务内容提高命中率。 |
| cache summary product metric | DONE | public challenge JSON/Markdown 新增 `flashCacheSummary`：reviewCount、hit/miss/output tokens、total cost、cacheHitRatePct、targetHitRatePct、targetMet、stable/dynamic hash 数量。 | GitHub 卖点只能展示真实跑出来的 `cacheHitRatePct` 与优化趋势；不能把未达成的 cache ROI 写成达标。 |
| prompt profile evidence | DONE | 每条 `flashReview` 新增 `promptProfile`，记录 stablePrefixHash、dynamicTailHash、stablePrefixChars、dynamicTailChars。 | 可以审计缓存稳定性；如果 stable hash 不唯一，说明 prompt 仍污染 stable prefix。 |
| build-level script check | DONE | 使用 Bun build 对 public challenge 脚本做构建检查，未执行真实 API review。 | `bun build scripts/dsxu-v24-public-challenge-package.ts --target=bun --outdir .dsxu/trace/v26-public-challenge-build-check` -> PASS。 |

本轮验收：

```text
bun test src/services/api/deepseek-trajectory-store.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts
=> 14 pass / 0 fail / 93 expect
```

本节裁决：
- 已完成：public challenge 已具备真实 cache metric 输出和稳定 prefix 结构。
- 已重跑真实 DeepSeek public challenge API；`flashCacheSummary.cacheHitRatePct=35`，只能作为真实基线和优化趋势，不能宣称 cache ROI 达标。
- 下一硬顺序：继续定位 public challenge cache miss 来源；若继续优化 dynamic tail，必须保留 source truth、tool trace、failure/recovery、cost evidence。

#### 9.14.1 真实 public challenge rerun 结果 - 2026-05-16

本节已按真实 DeepSeek Flash-first 调度重跑，不使用模拟数据：

```text
bun run benchmark:public-challenge
=> PASS_PUBLIC_CHALLENGE_PACKAGE_READY
=> commandPass=true, flashPass=true, c2Pass=true, releaseGatesPass=true
=> scoreFloor=72
=> totalFlashCostUSD=0.04017008240000001
=> flashCacheSummary.cacheHitRatePct=35
=> flashCacheSummary.targetMet=false
=> uniqueStablePrefixHashes=1, uniqueDynamicTailHashes=3
```

真实结论：
- C2 loop 已从上一轮 `OPEN_C2_LOOP_REVIEW_REQUIRED / 42/51` 修复为 `PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH / 51/51`。
- stable prefix 结构生效：三条 Flash review 的 stable hash 已统一为 1 个。
- cache hit 从上一轮真实 rerun 的 28.3% 提升到 35%，但仍不能作为 GitHub 公开“高命中率/缓存 ROI 已达标”卖点；后续目标是尽量接近 DeepSeek 官方高命中表现，同时不牺牲任务质量。
- `docs/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.md` 和 `docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json` 已更新真实结果；当前 package ready 仅表示 public challenge evidence pack 可用，不表示 final 95 或外部胜出。

本轮额外修复：
- `src/dsxu/engine/public-surface-clean-gate.ts` 和 `src/dsxu/engine/proprietary-code-risk-gate.ts` 已把 V26 文档/生成证据纳入 canonical source-truth 识别，避免 V26 审核证据被误判成 release public-surface blocker。
- `scripts/dsxu-v26-reference-experience-reverse-analysis.ts` 去掉默认参考源路径里的品牌硬编码；真实参考源必须通过 `DSXU_REFERENCE_SRC_ROOT` 显式传入。
- `scripts/dsxu-v24-public-challenge-package.ts` 已修正 C2 claim：只有最新 C2 loop PASS 时才允许写 `51/51`，OPEN 时进入 blocked claim。

追加验收：

```text
bun test --timeout=60000 src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts
=> 16 pass / 0 fail / 100 expect

bun run v24:c2-loop-acceptance
=> PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH, primaryPassed=15, secondaryPassed=36, totalPassed=51
```

#### 9.14.2 DeepSeek route false-trigger fix and real rerun - 2026-05-16

本节按当前硬顺序先处理 DeepSeek route/cost/cache 的误触发问题：FIM/Pro 不能因为 evidence pack、工具结果、历史报告或 public challenge 文本里出现 `FIM` / `completion` / `Pro` 字样就被触发。FIM 只允许通过显式 FIM lane 或 `allowTextFimInference` 打开；主 query 默认按当前 task-specific intent 判定。

本轮真实改动：

| step | 状态 | 改动 | 裁决 |
|---|---|---|---|
| FIM text inference guard | DONE | `src/utils/model/deepseekV4Control.ts` 新增 route intent 提取与 `allowTextFimInference`；默认不从普通用户 prompt / evidence pack 推断 FIM。 | public challenge prompt 里即使含 FIM 证据文本，也只按 `Task-specific review packet` 判定为 review/recovery。 |
| normal coding route | DONE | 普通 `bugfix` / `feature` / `coder` 从 `coding_flash_non_thinking` 调整为 `coding_flash_thinking_high`。 | 保持 Flash-first，同时提升普通工程任务的成功率预期。 |
| failed verification route | DONE | `failedVerification` 从直接 Pro 调整为 `failed_verification_flash_thinking_max`。 | 失败后先 Flash max 诊断/修复；Pro 只保留给 high-risk permission 或显式 admission evidence。 |
| FIM model default | DONE | `src/services/api/deepseek-fim.ts` 默认 FIM model 改为 `deepseek-v4-flash`。 | FIM 是独立 non-thinking completion lane，不再默认 Pro。 |
| Pro admission evidence | DONE | 高风险权限仍走 `high_risk_pro_thinking_max_requires_approval`，并保留 `DSXU_ROUTE_MODEL_UPGRADE_DISABLED` baseline 保护。 | Pro gate 仍存在，但必须有明确 admission evidence。 |

本轮验收：

```text
bun test src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/real-task-route-plan.test.ts
=> 35 pass / 0 fail / 224 expect

bun test src/dsxu/engine/__tests__/benchmark-runner-route-v1.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/services/api/deepseek-trajectory-store.test.ts
=> 31 pass / 0 fail / 176 expect

bun test src/dsxu/engine/__tests__/cold-mode-cost-planning-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts
=> 9 pass / 0 fail / 74 expect

bun test src/dsxu/engine/__tests__/query-route-verification-v1.test.ts src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts
=> 48 pass / 0 fail / 387 expect
```

真实 DeepSeek public challenge rerun：

```text
bun run benchmark:public-challenge
=> PASS_PUBLIC_CHALLENGE_PACKAGE_READY
=> scoreFloor=72
=> totalFlashCostUSD=0.0463137304
=> modelUsage=deepseek-v4-flash only across 3/3 reviews
=> flashCacheSummary.cacheHitRatePct=41.1
=> flashCacheSummary.targetMet=false
=> uniqueStablePrefixHashes=1, uniqueDynamicTailHashes=3
```

本节裁决：

- 已完成：FIM/Pro 误触发已关闭；public challenge 三条真实 review 不再出现非预期 Pro。
- 已改善：成本从上轮含 Pro 的 `$0.1069228494` 降到本轮 Flash-only `$0.0463137304`。
- 未完成：cache hit 仍只有 `41.1%`，只能写真实值和优化方向；不能写成 GitHub 缓存 ROI 达标卖点。
- 下一步：继续做 DeepSeek 特点对应的 cache-hit 优化，重点是 source truth pack / dynamic tail / tool-result bloat / JSON-only single-turn / warm prefix，而不是再改第二套路由。

#### 9.14.3 DeepSeek cache-hit 对应优化审计与下一步方案 - 2026-05-16

本节承接 9.14.2：误触发已处理，接下来只优化 DeepSeek 官方自动上下文缓存能真实命中的部分。DeepSeek cache 的核心不是“我们记录了 stable hash 就算命中”，而是模型请求里真实公共前缀必须保持一致；thinking / tool 调用 / 多轮 Read 会把大量工具结果追加进后续请求，形成新的动态上下文。

本轮真实轨迹审计：

| review | requests | tool results | tool result chars | cache hit | cache miss | conclusion |
|---|---:|---:|---:|---:|---:|---|
| flash-public-claim-guard-review | 4 | 8 | 160743 | 52480 | 102394 | 多轮 Read 把 source truth 原文回灌进上下文，miss 大于 hit |
| flash-senior-coding-experience-review | 5 | 20 | 304521 | 103424 | 121458 | 复杂体验审查最重，工具结果体积是主要 miss 来源 |
| flash-release-ecosystem-review | 3 | 4 | 103738 | 43264 | 62139 | stable prefix 有效，但动态工具结果仍拖低命中 |

当前已有 V18/V26 成本功能可复用，不能重建第二套路由：

| capability | existing owner | 当前结论 |
|---|---|---|
| route policy | `src/utils/model/deepseekV4Control.ts` | 已统一为 Flash-first：coding=Flash thinking high，failed verification=Flash max，Pro 只保留 high-risk/admission |
| FIM lane | `src/services/api/deepseek-fim.ts` | 已改为 Flash non-thinking completion lane；主 query 默认不会从普通文本推断 FIM |
| prefix evidence | `src/dsxu/engine/prompt-prefix-cache-evidence.ts` | 已能记录 stable/dynamic hash、miss budget、volatile findings |
| dynamic-tail risk board | `src/dsxu/engine/route-cache-dynamic-tail.ts` | 已能发现 stable hash 变化、warm cache <80%、工具/动态尾部风险 |
| route cache ROI board | `src/dsxu/engine/route-cache-roi-smoke.ts` | 已能判断 Pro demotion / keep-Pro safety / cache ROI claim 是否允许 |
| trajectory evidence | `src/services/api/deepseek-trajectory-store.ts` | 已有 redacted 轨迹，能记录 request/messages/tool result chars/usage/cost |

下一步执行顺序：

1. `public challenge source-truth compact pack`：把 public challenge 的 source truth 从“让模型多轮 Read 大文件”改成“预生成可审计 compact evidence pack + 文件 hash/anchor/path”，原始文件仍保留在 trace，但默认不回灌全文。验收：每条 review 的 toolResultChars 下降至少 60%，source truth claim 仍有 path/hash/anchor。
2. `single-turn JSON review mode`：public challenge review 默认走 JSON-only single-turn；只有 source truth 缺失或 schema 不完整时才允许一次 Read。验收：requests 从 3-5 降到 1-2；cache hit、toolResultChars、cost 有真实改善且 score 不下降时，才能公开写“cache/cost 优化有效”。
3. `stable pack purity gate`：generated metrics、当前 run cost、timestamp、trace path 只能进入 dynamic tail，不能进入 stable pack。验收：跨 rerun 的 stablePrefixHash 不变化；dynamicTailHash 可以变化。
4. `cache miss attribution report`：把 trajectory 的 `systemHashes / toolResultChars / cacheHit / cacheMiss / routeReasons` 写入 public challenge package。验收：GitHub 卖点可以展示真实成本下降和未达标项，不能只展示平均数。
5. `warm-prefix experiment`：可以做独立 warm-prefix smoke，但必须单独记账，不能把 warmup 成功当成任务成功。验收：warmup 成本、任务成本、命中率分开输出。

本节裁决：
- 当前 DSXU 成本路由主线是统一的，误触发已收口，V18 成本能力也已经在主线 owner 上。
- 当前未达标点不是“模型选择表再改一次”，而是 public challenge 的 source truth 输入方式让工具结果膨胀，破坏了 DeepSeek 自动前缀缓存。
- 下一轮必须优先做 compact evidence pack + single-turn JSON review mode；完成后再重跑真实 DeepSeek public challenge。未证明 cache hit、toolResultChars、cost 和质量同时改善之前，不允许把缓存 ROI 作为 GitHub 达标卖点。

#### 9.14.4 V18 70 PASS 成本优化交叉审计补记 - 2026-05-16

本节补正 9.14.3 的口径：上一节只合并了已经落到主线 owner 的 route / cost / cache / trajectory 能力，没有逐项把 V18 `70 PASS` 的成本贡献拆开。现在重新按 `DSXU_CLI_V8拆分_必做关键与达标后再做_V9.xlsx` 和 V18/V19 CLEAN 的 82 项对齐表交叉审计。

口径澄清：
- Excel 原始目标表是 `82` 项：当前必做 sheet `57` 项，达标后再做 sheet `25` 项。
- CLEAN 的 `70 PASS / 0 FAIL / 12 未覆盖` 是后续 V18/V19 映射闭环结果，不等于 Excel 当前 sheet 的 `57` 项。
- 这 70 PASS 里不是每一项都直接降成本；它们分成“直接成本控制”“间接减少返工成本”“质量/生态/评测坐标”三类。

成本贡献分层：

| layer | V18 能力代表 | 对 DSXU 成本的真实作用 | 当前裁决 |
|---|---|---|---|
| 直接成本控制 | `S01 Cold Mode`, `M01/M02/M03/M06`, `C07 ContextCompiler`, `C08 TokenFirewall`, `C09 CostRouter`, `C16 CostReporter`, `M07 FIM`, `C17 LocalMemory`, `A14 Pro Reviewer` | 决定 Flash-first、thinking effort、Pro admission、上下文裁剪、缓存命中、成本记录 | 已进入主线；误触发已修，但 public challenge cache hit 仍未达标 |
| 间接减少返工成本 | `C03 Timeline`, `C04 PermissionGate`, `C10 PlanGraph`, `C11 ToolBus`, `C12 VerificationKernel`, `C13 Rollback`, `C14 FailureTaxonomy`, `A10 Test Runner`, `A11 RepairLoop`, `B07 CommandVerifier`, `B09 Terminal FailureRepairLoop` | 减少错误工具调用、盲重试、无效验证、自言自语和失败扩散 | 已增强 DSXU 主工作流，但需要继续把 timeline 投影和 route/cost/cache 放到同一 visible-state |
| 评测/卖点约束 | `E01/E02/E03/E05/E06`, `A16`, `B12/B13/B14` | 让成本可对比、可复测、可进入 GitHub 图表；不直接省钱，但防止高分低能 | 已有 evidence pack；公开卖点必须用真实 rerun 数据 |
| 暂不计入成本达标 | `R01/R02/S02/R04/R05/R06/PZ01/PZ02/PZ04/PZ05/PZ06/PZ08` | 多为外部 benchmark、生态适配或后续扩展；不能拿来证明当前成本达标 | 仍按 deferred/roadmap，不参与 cache/cost 优化达标结论 |

对 9.14.3 的修正结论：
- public challenge 命中率低并不是 V18 成本能力没有融合；相反，路由、成本记录、cache evidence、trajectory 都已经在主线。
- 当前瓶颈是 V18 中 `C07 ContextCompiler`、`C08 TokenFirewall`、`M06 Context Cache` 没有充分作用到 public challenge 的真实 review 输入：模型仍通过多轮 `Read` 把大块 source truth 作为工具结果塞回上下文。
- 下一轮优化必须把 V18 直接成本能力一起用上：`ContextCompiler` 生成 compact source-truth pack，`TokenFirewall` 限制工具结果回灌，`Context Cache` 保持 stable prefix，`CostRouter/CostReporter` 输出真实命中率，`Ablation Runner` 对比优化前后成本。

下一步新增验收：
1. `capability cost crosswalk report`：生成历史 70 PASS -> cost contribution -> DSXU owner -> current evidence -> public claim allowed 的交叉表。
2. `ContextCompiler + TokenFirewall public challenge wiring`：public challenge 默认用 compact pack，工具 Read 作为 fallback，不再是主路径。
3. `Ablation rerun`：同一 3 条 public challenge 分别跑 before/after，输出 cost、cache hit、toolResultChars、scoreFloor；只有 score 不降且 cache hit 达标，才能把优化写成卖点。

本节裁决：是的，V18 成本能力必须纳入命中率优化；9.14.3 已指出技术瓶颈，但还不够完整。V26 从下一步开始按 V18 成本能力交叉表执行，不能只凭 DeepSeek 官方特性做单点调参。

#### 9.14.5 Reference 1902 context/cache 机制反向分析后的 DSXU 操作清单 - 2026-05-16

本节只吸收通用工程机制，不复制参考源码、品牌、文案或商业实现。针对“模型多轮 Read 大文件，工具结果回灌太大，破坏 DeepSeek 前缀缓存”的问题，参考源码体现出的思考方式不是让模型更聪明地硬吃全文，而是把上下文治理拆成多个小闭环。

参考机制抽象：

| mechanism | 参考源码信号 | DSXU 对应原则 |
|---|---|---|
| search/range before whole-file read | Read 工具有 offset/limit、文件大小/token 上限、超限时要求范围读取或搜索 | DSXU public review 不能默认让模型读大文件全文；应先给 compact evidence pack 和 anchors |
| repeated-read dedup | 相同文件/范围且 mtime 未变时返回 unchanged stub | DSXU 已有 read_cache_hit，但 public challenge 仍因多文件多轮 Read 产生新动态尾部 |
| tool result collapse | search/read/list/bash 在 UI 里折叠成摘要，保留可见进度 | DSXU visible-state 应展示“读了哪些证据”，不把全文当 UI 或 final report 卖点 |
| large result preview/persist | 大 Bash/WebFetch 结果持久化到文件，只回传短 preview | DSXU 已有 toolResultStorage；但 Read 被视为自限工具，不走通用持久化，所以 public review 要用 source-truth compact pack 替代多轮 Read |
| microcompact / tool-result clearing | 旧工具结果可清理，最近 N 个保留；cache warm 时尽量用 cache-editing，不直接破坏前缀 | DeepSeek 没有同款 cache-edit API 时，DSXU 要用“稳定前缀 + 动态尾部 + 单轮 JSON”降低 miss，而不是幻想 API 会自动修复动态工具结果 |
| cache/header latch | 会话级 cache 相关选项一旦开启就 latch，避免中途设置变化打断缓存 | DSXU 的 route profile、thinking mode、tool schema、stable pack 也必须 latch 到 run 级别 |
| token/cost attachment | 每轮记录 input/output/cache read/cache create，Agent 进度显示 token/tool count | DSXU 已有 trajectory/cost，但 public package 还缺 toolResultChars 与 miss attribution 的正式卖点表 |
| agent/shell summary handoff | 背景 Agent/Shell 完成后只回传 summary、usage、output path | DSXU public challenge 应引用 report/path/hash/anchor，而不是要求 reviewer 读取所有 raw transcript |

DSXU 当前不是没有这些能力，而是没有把它们压到同一条 public challenge 审查路径：

| area | current state | missing closure |
|---|---|---|
| Read dedup | 已有 `file_unchanged` stub 和测试 | 只处理重复同范围读取，不能解决不同文件/多轮 evidence Read 膨胀 |
| tool result budget | 已有 per-message aggregate budget 和 persisted preview | Read 被排除在通用持久化外；public review 仍可能每轮塞入 25k-token 级别 Read 结果 |
| microcompact | 已有 time-based/cached microcompact 框架 | public challenge max-turns 短时间连续运行，不会自然触发 time-based clearing；cached path 不能作为 DeepSeek 公开缓存卖点前提 |
| stable evidence pack | 已有 pack 和 stablePrefixHash | prompt 仍要求“First Read generated pack”，导致 pack 内容进入 tool_result，而不是直接作为稳定模型输入被复用 |
| trajectory | 已记录 request/messages/toolResultChars/cache hit/miss | package 里还没正式输出 miss attribution 表，GitHub 图表不能只展示总命中率 |

可实施操作，按硬顺序执行：

1. `P0 public-review no-Read-by-default`：把 stable evidence pack 的 compact JSON 摘要直接放入 stable prefix；public review 默认不开放 `Read`，只在 source gap fallback lane 开放一次范围读取。验收：requests <= 2，toolResultChars 下降 >= 60%。
2. `P0 source-truth capsule builder`：对每个 sourceTruthRef 生成 `path/hash/lineCount/anchors/excerptBudget/riskTags`，并给每个 claim 绑定 capsule id。验收：review JSON 的 evidence 必须引用 capsule id，不允许裸称 “read source”。
3. `P0 Read fallback governor`：如果必须 Read，只允许 anchor 附近 offset/limit，不允许全文 Read；大文件读取必须先 Grep/anchor 定位。验收：单次 Read result <= 8k tokens，超过则 FAIL_CACHE_HYGIENE。
4. `P0 cache-miss attribution output`：public challenge package 增加 `requests/toolResults/toolResultChars/systemHashes/cacheRead/cacheMiss/routeReasons` 表。验收：GitHub 图表能解释为什么省钱或为什么未达标。
5. `P1 route-profile latch`：一个 public challenge run 内 model、thinking、tool list、stable prompt sections 不允许中途变化。验收：trajectory 中 `uniqueSystemHashes=1`，除显式 fallback 外 routeReason 不漂移。
6. `P1 capability cost crosswalk report`：把历史 70 PASS 拆成 direct/indirect/eval 三类，绑定 DSXU owner 和当前证据。验收：每个 GitHub 成本卖点必须能回指到历史 capability + DSXU source/test/live evidence。
7. `P1 ablation rerun`：同一 3 条 public review 跑 before/after，对比 scoreFloor、cost、cacheHitRate、toolResultChars。验收：score 不降、source truth 不减少、toolResultChars/cost/cacheHit 有真实改善，才允许把 cache/cost 写成“优化有效”；不把固定 70% 当 release 死线。

V26 当前仍未完成项，按真实阻断排序：

1. 公开复杂编程/复杂任务能力仍未达到对标 GPT-5.5 / Claude 4.7 的 `90% 左右`口径；当前公开挑战 floor 仍是 `72`，只能作为真实基线。
2. 体验闭环还未用新标准证明接近高级程序员 `100% 体感`：需要真实 DSXU TUI/CLI 窗口、长时间任务、失败恢复、成本/证据可见来回测。
3. cache hit 当前真实 rerun 为 `41.1%`，不能写成“高命中率/缓存 ROI 达标”；但 cache 是性能优化指标，不是固定 70/100 的 release 死线。
4. `public-review no-Read-by-default` 未实现。
5. `source-truth capsule builder` 已在 9.24 推广到常规 code-mode。
6. `Read fallback governor` 已在 9.24 完成，同一 Read owner 只做 bounded fallback。
7. `cache miss attribution report` 未正式进入 public challenge package。
8. `capability cost crosswalk report` 已生成；后续只需在 ablation/public challenge 更新后重跑同步真实成本值。
9. `ablation rerun` 未跑，无法证明优化前后质量不降、成本下降、命中率改善。
10. 同题外部 raw target transcripts 仍不足，不能宣称外部胜出。
11. V18 的 12 个 deferred 未覆盖项仍不能当 PASS。
12. TUI/stream-json 的 work-state timeline 直接结构化展示仍需继续接入；当前部分路径通过 system info/final report 间接可见。
13. GitHub launch pack 的最终数据图和卖点必须等上面真实 rerun 达标后重建，不能提前美化。

本节裁决：参考源码处理这个问题的核心是“源事实可追溯，但模型输入要被编译、预算化、摘要化、可回退”，不是“让模型无限 Read”。DSXU 应用到 DeepSeek 时必须更激进，因为 DeepSeek 上下文缓存依赖真实公共前缀一致；因此 V26 下一步不能再只改路由表，必须先完成 public review 的 no-Read 默认路径、source-truth capsule 和 ablation rerun。

### 9.15 V26 全域高级程序员体验闭环专项 - 2026-05-16

本节把 9.14.5 从 context/cache 单点扩展为全域机制吸收。目标不是复刻参考产品，也不是复制 1902 文件里的源码、品牌、prompt 或商业逻辑；目标是把“高级程序员工作方式”抽象成 DSXU 自有闭环，并按 DeepSeek Flash-first、成本路由、上下文缓存、TUI 可见状态和真实证据体系重新实现。

当前真实审计事实：

| item | 当前事实 | 裁决 |
|---|---|---|
| reference source | `D:\源代码claude\src` 当前可见源码文件 `1902` 个 | 只做机制反向分析，不做源码/品牌/文案复制 |
| DSXU source | `D:\DSXU-code\src` 当前源码文件 `2672` 个 | 文件更多不等于体验更强，必须看主线闭环密度和真实验收 |
| C2 owner implementation acceptance | `1902/1902` resolved：`implemented+tested=1096`，`adapted/excluded=601`，`no-loss baseline=205`，`needs real code/test=0` | 说明 owner/disposition 已闭合；不等于 feature parity，也不等于公开能力 90% 已达成 |
| public challenge | `scoreFloor=72`，Flash-only cost `$0.0463137304`，`cacheHitRatePct=41.1%` | 仍不能公开宣称已达到 GPT-5.5 / Claude 4.7 编程与复杂任务能力 `90% 左右`；cache 只能写真实优化趋势，不能写高命中率达标 |
| release claim | 旧证据字段仍可能叫 `public95ClaimAllowed=false` | V26 口径改为：能力公开挑战冲 `90% 左右`，体验闭环尽量接近高级程序员 `100% 体感`；GitHub 只写真实已验收卖点 |

参考 1902 文件信号按 12 个高级程序员体验闭环重建，不再只看单个文件名或单点功能：

| loop | referenceFiles | DSXU owner | 当前裁决 | V26 必须补强的点 |
|---|---:|---|---|---|
| Goal / Plan / Query Loop | 573 | DSXU Query Loop / Entry Composition | implemented+tested | 把目标、计划、当前行动、停止条件、final evidence 全部进入 work-state timeline；复杂任务不能只靠最终 summary |
| Visible Work-State | 559 | UI/TUI Visible Work-State Projection | implemented+tested | TUI、CLI、stream-json、final report 必须同一份状态投影；不能让用户看不见工具、权限、成本、失败、恢复和下一步 |
| Tool / Permission Lifecycle | 369 | Tool Gate / Permission Gate | implemented+tested | 权限判断、工具执行、adapter、visible-state、evidence 必须走同一主线；禁止第二套 permission runtime |
| Source Truth / Coding Repair | 149 | Source Truth / Coding Repair | implemented+tested | Search/Grep -> anchor/range Read -> patch -> focused verify -> report 形成默认路径；全文 Read 只能 fallback |
| Terminal / Shell Reliability | 134 | Terminal Tool Adapter / Result Pack | needs stronger live evidence | 增强长命令、失败归因、重试预算、后台/超时、编码边界和结果包的真实 demo 证据 |
| Context / Memory / Recovery | 138 | Context Builder / Recovery Mainline | implemented+tested | 把 compact、resume、failure taxonomy、checkpoint、cache hygiene 压进真实长任务窗口和 public challenge |
| Agent Orchestration | 171 | Agent Lifecycle | implemented+tested | 父任务只接收子任务 summary/path/hash/evidence，不回灌长 transcript；禁止第二套 agent orchestrator |
| MCP / Skill Ecosystem | 191 | MCP / Skill Registry | implemented+tested | Superpowers/AionUi/Cherry/Warp/browser-use 只作为兼容设计输入；DSXU 只保留自有 registry、priority、conflict、permission boundary |
| DeepSeek Model / Cost / Cache | 123 | DeepSeek Runtime / Cost Evidence | implemented+tested | Flash-first、thinking effort、Pro admission、FIM lane、cache attribution、cost report 必须统一；当前 cache 41.1% 未达标 |
| IDE / Remote / External Host Boundary | 141 | External Host Adapter Boundary | needs stronger live evidence | VS Code/API bridge、remote trigger、desktop host 只能作为 adapter boundary；缺成品化 smoke 前不能当核心卖点 |
| First-Run Trust / Doctor | 125 | Install / Auth / Doctor | implemented+tested | 首次 key wizard、secret scan、doctor、provider gate 必须进入 fresh install/release artifact 回测 |
| Telemetry / Evidence / Release Gate | 125 | Evidence / Release | implemented+tested | raw trace、cost、cache、failure/recovery、secret scan、clean export、GitHub chart 必须同源，不能手工美化 |

高级程序员体验不是“模型回答更长”，而是以下 12 个 DSXU-owned 机制咬合：

1. `Goal/Plan Loop`：每个复杂任务都有目标快照、计划图、当前行动、停止条件和可审计结论；长时间任务中断后可恢复到同一目标。
2. `Source Truth Loop`：先搜索和定位，再范围读取，再修改，再 focused verify；不能让模型靠大段上下文猜。
3. `Tool/Permission Loop`：先判风险和权限，再展示给用户，再执行，再把结构化结果投影到 timeline。
4. `Context/Cache Loop`：稳定前缀、动态尾部、source capsule、Read fallback、microcompact、cache miss attribution 一起工作。
5. `Recovery Loop`：失败必须分类、给出恢复动作、保留 retry budget 和 rollback/patch evidence；不能用“重新试一次”冒充恢复。
6. `Agent Loop`：并行 Agent 只处理边界清晰的 sidecar work，返回 evidence summary；父任务负责合成，不新增 agent 主链。
7. `MCP/Skill Loop`：所有外部技能、MCP、生态接入只进 DSXU registry，按优先级、冲突规则、权限边界调度。
8. `Terminal Loop`：命令执行前有环境/风险判断，执行后有退出码、stdout/stderr、超时、失败原因、下一步。
9. `DeepSeek Route Loop`：默认 Flash；普通 coding/bugfix 使用 Flash thinking high；失败验证先 Flash max；Pro 只由高风险或明确 admission evidence 触发；FIM 独立 Flash non-thinking lane。
10. `Visible-State Loop`：用户在 TUI/CLI/stream-json/final report 中看见目标、计划、工具、权限、成本、证据、失败、恢复、下一步。
11. `Evidence/Release Loop`：每个公开卖点都能回指 source/test/live/raw/cost/cache evidence；没有真实数据就只能写 roadmap。
12. `First-Run Trust Loop`：安装、key、doctor、provider gate、secret scan、fresh smoke 是发布前置，不是发布后补丁。

结合 DeepSeek 特点，DSXU 必须做的专项优化如下：

| priority | action | 实施含义 | 验收口径 |
|---|---|---|---|
| P0 | `public-review no-Read-by-default` | public challenge 默认使用 compact source-truth capsule，不再让模型多轮 Read 大文件 | requests <= 2，toolResultChars 下降 >= 60%，scoreFloor 不下降 |
| P0 | `source-truth capsule builder` | 为每个 claim 生成 path/hash/anchor/excerptBudget/riskTags，review evidence 引用 capsule id | 不允许裸称 read source；每条 claim 可回指 capsule |
| P0 | `Read fallback governor` | fallback Read 只能 anchor/range，且必须先 Grep/定位；禁止全文 Read 成为主路径 | 单次 Read <= 8k tokens，超限 FAIL_CACHE_HYGIENE |
| P0 | `DeepSeek cache attribution package` | public challenge 输出 requests、toolResultChars、cache hit/miss、routeReason、system hash | GitHub 图表能解释成本、命中率趋势和优化空间；cache 不作为固定 70/100 死线 |
| P0 | `capability cost crosswalk report` | 把历史 70 PASS 中 direct/indirect/eval 成本能力绑定到 DSXU owner 与证据 | 每个成本卖点必须能回指 historical capability + DSXU source/test/live evidence |
| P0 | `Visible-state product wiring` | TUI/CLI/stream-json/final report 使用同一 work-state timeline metadata | 真实 DSXU 窗口中能看见目标、工具、权限、成本、失败、恢复、下一步 |
| P1 | `terminal reliability live demo` | 增加长命令、失败、超时、恢复、结果包的公开 demo 任务 | terminal shell reliability 从 needs stronger live evidence 转为 implemented+tested |
| P1 | `agent parent/worker evidence pack` | 父子任务只回传 evidence summary/path/hash，防止 transcript 膨胀 | Agent 复杂任务有父任务合成报告和成本/工具证据 |
| P1 | `MCP/Skill conflict-priority pack` | Superpowers 等二级技能包只作为补充；DSXU registry 决定主次优先级和冲突处理 | 无第二套 skill runtime；冲突时可解释为什么选/拒绝 |
| P1 | `IDE/API bridge product smoke` | VS Code/API bridge 作为 external adapter boundary 做 smoke，不进核心 runtime | 通过 adapter boundary 证据后才允许写生态扩展卖点 |
| P1 | `long-task recovery replay` | 30-45 分钟 senior-coding window 加入中断/恢复/失败修复/成本记录 | 真实 DeepSeek Flash-first 调度，不用简单脚本冒充体验 |
| P2 | `GitHub launch data pack rebuild` | 达到新口径后重建 README、卖点图、成本图、公开挑战数据 | 不达公开能力 `90% 左右`、体验闭环未接近高级程序员体感时，不写对标达成 claim；cache 只写真实值和优化趋势 |
| P2 | `six-stage final test + clean export` | 功能、体验、恢复、性能、评测、发布收口测试最后跑 | 只作为证明，不替代功能判断 |

V26 后续执行排序必须改成：

1. 先做 `public-review no-Read-by-default`、`source-truth capsule builder`、`Read fallback governor`，解决 DeepSeek cache miss 的根因。
2. 同批补 `capability cost crosswalk report` 和 `cache miss attribution package`，把历史 70 PASS 的成本/命中率能力真正接进 public challenge。
3. 再做 `Visible-state product wiring`，让真实 DSXU TUI/CLI/stream-json 显示高级程序员式工作状态。
4. 再做 terminal、agent、MCP/Skill、IDE/API bridge 的 live evidence 补强，优先清掉 `needs stronger live evidence`。
5. 再跑 30-45 分钟真实 DSXU senior-coding window：默认 `deepseek-v4-flash`，只有明确 admission 才能 Pro；必须包含读代码、改代码、失败恢复、测试、成本、cache、final report，用来证明体验闭环接近高级程序员体感。
6. 再跑 public challenge ablation：同题 before/after，对比 scoreFloor、体验闭环、cost、cacheHitRate、toolResultChars；目标是能力公开挑战冲 `90% 左右`，cache 尽量优化且质量不降。
7. 最后才做六阶段最终测试、clean export、fresh install/help/doctor/provider gate smoke、GitHub launch pack rebuild。

当前不能写成完成的硬阻断：

1. 公开复杂编程/复杂任务能力尚未达到对标 GPT-5.5 / Claude 4.7 的 `90% 左右`目标；当前公开挑战 floor 仍是 `72`。
2. 体验方面尚未用新标准证明接近高级程序员 `100% 体感`；需要真实 DSXU 窗口、长时间任务、失败恢复、成本/证据可见来回测。
3. cache hit 当前真实值 `41.1%`，不能写成“高命中率/缓存 ROI 达标”；但 cache 是尽可能优化的性能指标，不是固定 70/100 的硬阻断。
4. public review 默认 no-Read 未实现。
5. source-truth capsule builder 已在 9.24 完成常规 code-mode 接入。
6. Read fallback governor 已在 9.24 完成。
7. capability cost crosswalk report 已生成；下一步随 public challenge ablation 继续重跑同步。
8. cache miss attribution package 未正式进入 public challenge。
9. terminal shell reliability 与 IDE/remote bridge 仍是 stronger live evidence，不是最终卖点。
10. 外部同题 raw target transcripts 仍不足，不能宣称外部胜出。
11. V18 12 个 deferred 未覆盖项仍不能算 PASS。

本节裁决：V26 的核心不再是继续增加小层，而是把 1902 文件反向分析出的“体验闭环密度”压成 DSXU 自有主线机制。对 DeepSeek 来说，最重要的改造顺序是先让模型输入变轻、稳定、可追溯，再让 TUI/CLI 真实可见，最后用 public challenge 和 30-45 分钟真实 senior-coding window 证明“编程与复杂任务能力约 90% 对标、体验闭环接近高级程序员体感”。未完成这些前，不能发布对标达成 claim，也不能把参考产品 parity 写成卖点。

### 9.16 主链命名与 source-truth capsule 执行记录 - 2026-05-16

本轮先纠正命名纪律：新增执行件不再使用新的 `VXX` 文件名或脚本名。历史 V18/V20/V24/V26 只能作为既有证据来源和计划上下文；新的主链产物使用稳定产品名。

已执行：

| item | 状态 | 真实改动 | 验收结果 |
|---|---|---|---|
| 主链命名纠偏 | DONE | 临时 VXX 命名已撤回，正式执行件为 `scripts/dsxu-capability-cost-crosswalk.ts`；输出为 `DSXU_CAPABILITY_COST_CROSSWALK_*`；package scripts 新增 `capability:cost-crosswalk` / `evidence:capability-cost-crosswalk`。 | 未新增 `VXX` 命名脚本或输出文件；历史能力表只作为 source workbook 和能力 ID 来源。 |
| source-truth capsule builder | DONE | `scripts/dsxu-v24-public-challenge-package.ts` 的 stable evidence pack 升级为 source-truth capsule：每个 sourceTruthRef 带 `path/hash/lineCount/anchors/capsuleId/excerptBudget/riskTags/fallbackReadPolicy/anchorCapsules`。 | `bun build scripts/dsxu-v24-public-challenge-package.ts --target=bun` PASS。 |
| public-review no-Read-by-default | DONE | public challenge Flash review 默认关闭工具：`--tools ""`，prompt 改为使用 embedded source-truth capsule，不再要求 `First Read`。 | 真实 `bun run benchmark:public-challenge` PASS；3/3 review `readToolCallCount=0`、`toolResultChars=0`。 |
| cache miss attribution package | DONE | public challenge 输出 `requests/toolResults/toolResultChars/maxToolResultChars/systemHashes/cacheRead/cacheMiss/routeReasons`，并明确 cache hit 是优化指标，不是固定 release gate。 | route-profile latch 后最新真实值：`totalFlashCostUSD=0.0099985424`，`cacheHitRatePct=65.4%`，`routeReasons=review_flash_thinking_max`，`uniqueSystemHashes=1`，`toolResultChars=0`。 |
| capability cost crosswalk | DONE | 新增稳定主链证据脚本 `scripts/dsxu-capability-cost-crosswalk.ts`，把历史 82 项能力拆成成本/能力 owner 交叉表。 | `bun run capability:cost-crosswalk` PASS；`82 total / 70 PASS / 12 deferred`，direct-cost `12`，indirect-cost `21`，eval-proof `14`，publicClaimAllowed `47`。 |
| route-profile latch | DONE | 在现有 QueryEngine DeepSeek 路由入口加入显式 run-level latch：仅当环境变量 `DSXU_DEEPSEEK_ROUTE_WORKFLOW_KIND` / `DSXU_DEEPSEEK_ROUTE_ROLE` 存在且合法时覆盖自动推断；public challenge 固定为 `review/reviewer`。 | Focused route tests `34 pass / 0 fail`；重跑 `bun run benchmark:public-challenge` 后 `routeReasons=review_flash_thinking_max`、`uniqueSystemHashes=1`、`cacheHitRatePct=65.4%`、`totalFlashCostUSD=0.0099985424`、`readToolCallCount=0`、`toolResultChars=0`。 |
| visible-state cost/cache projection | DONE | `src/dsxu/engine/work-state-timeline.ts` 的 cost event 增加 `cacheHitInputTokens/cacheMissInputTokens/outputTokens/cacheHitRatePct/toolResultChars/capsuleId`；`src/query.ts` 的 final usage evidence 投影 route profile latch、cache hit rate 和 token 结构。 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/query-route-verification-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts` -> `37 pass / 0 fail`；再次重跑 `benchmark:public-challenge` PASS，`totalFlashCostUSD=0.0098987224`、`cacheHitRatePct=65.4%`、`toolResultChars=0`。 |

最新 public challenge 真实裁决：

- `scoreFloor` 仍为 `72`，不能宣称已经达到对标 GPT-5.5 / Claude 4.7 编程与复杂任务能力 `90% 左右`。
- no-Read/source capsule、route-profile latch 与 visible-state cost/cache projection 已真实生效，工具结果回灌从旧轨迹里的大块 Read 结果降为 `0`，成本从上一轮 `$0.0463137304` 级别降到 `$0.0098987224`，cache 命中率从 `41.1%` 提升到 `65.4%`。但 cache 仍低于 70 参考线，且 70 不是 release gate，只能写真实值和优化趋势，不能写成高命中率已达标。
- release gates 仍为 PASS，但 release-ready 不能替代 public benchmark-ready。

下一步顺序：

1. `ablation rerun`：同一 3 条 public review 对比优化前后 cost、toolResultChars、cacheHitRate、scoreFloor；只在 score 不降且 source truth 不减少时写成成本优化卖点。
2. `visible-state product wiring` 继续推进到 Tool/Permission/Agent/MCP evidence：source capsule 和 route/cost/cache 已接入，下一步补工具权限与 agent/MCP evidence 的同一 timeline 投影。
3. 再进入 30-45 分钟真实 senior-coding window 和公开复杂任务 raw benchmark；最后才重建 GitHub launch pack、六阶段最终测试和 clean export。
### 9.17 V26 双轨深度审计与专项优化执行板 - 2026-05-16

本节纠正前面“1902 文件对比偏文件信号、70 PASS 口径过宽”的问题。V26 后续不再把“文件映射完成”或“历史 PASS”当作真实功能完成。当前拆成两条并行主线：

1. `70 项继续做真实功能验收`：把 V18/V19 的 `70 PASS` 拆成真实功能验收等级。
2. `1902 文件反向机制分析`：不是复制参考源码，也不是数文件，而是抽象“高级程序员体验闭环密度”，再结合 DeepSeek Flash-first、thinking、FIM、cache、cost 调成 DSXU 自有实现。

新增稳定产物，未新增新的 VXX 主链命名：

| artifact | 用途 | 输出 |
|---|---|---|
| `scripts/dsxu-capability-acceptance-audit.ts` | 重新裁决 82 项/70 PASS 的真实验收等级，防止假 PASS。 | `docs/DSXU_CAPABILITY_ACCEPTANCE_AUDIT_20260516.md` / `docs/generated/DSXU_CAPABILITY_ACCEPTANCE_AUDIT_20260516.json` |
| `scripts/dsxu-reference-mechanism-audit.ts` | 扫描 `D:\源代码claude\src` 1902 个源码文件，但输出机制分类、工作逻辑、DeepSeek 重构和 DSXU 执行切片。 | `docs/DSXU_REFERENCE_MECHANISM_AUDIT_20260516.md` / `docs/generated/DSXU_REFERENCE_MECHANISM_AUDIT_20260516.json` |

#### 9.17.1 70 项真实功能验收裁决

最新 `capability acceptance audit` 结果：

| total | historical PASS | implemented+tested | needs live window | adapted/subset | eval coordinate only | deferred | strict public claim allowed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 82 | 70 | 48 | 11 | 8 | 3 | 12 | 33 |

裁决含义：

- `implemented+tested=48`：可以作为 DSXU 自有 release evidence，但仍不能直接等于公开 90% 对标能力。
- `needs live window=11`：主要是 terminal/shell 真实体验、ablation runner 等，必须进入真实 DSXU TUI/CLI/API 窗口验收。
- `adapted/subset=8`：例如 Code-10/Terminal-10、FIM 小编辑 lane、Pro reviewer、browser proof、agent fanout，只能按 DSXU 自有边界写，不能写成完整外部功能或参考产品 parity。
- `eval coordinate only=3`：`R03/R07/R08` 只是评测/体验坐标，不能写成 SWE/OSWorld/Toolathlon 外部 benchmark PASS。
- `deferred=12`：仍然不能算 PASS，包括 `R01/R02/S02/R04/R05/R06/PZ01/PZ02/PZ04/PZ05/PZ06/PZ08`。

V26 规则：以后 GitHub 卖点、README、产品图、public challenge 包，只能使用 `strict public claim allowed` 的能力，并且必须回指 DSXU source/test/live/raw/cost/cache evidence。

#### 9.17.2 1902 文件机制反向分析，不再是文件对比

最新 `reference mechanism audit` 事实：

| reference files | DSXU source files | mechanism loops | decision |
|---:|---:|---:|---|
| 1902 | 2658 | 13 | `implemented+tested=9`、`needs-live-evidence=2`、`implemented+tested-claim-limited=2` |

这 1902 文件的价值不是“文件多”，而是把高级程序员工作方式拆成大量小闭环。V26 把它归为 4 类 13 个机制：

| class | loops | DSXU 重构原则 |
|---|---|---|
| cognitive-workflow | Goal/Plan、Source Truth/Coding Repair、Context/Memory/Recovery | 目标稳定、先定位再读取、失败后恢复到同一任务，不靠长上下文猜测。 |
| trust-and-visibility | Visible Work-State、First-Run Trust、Telemetry/Evidence/Release | 用户能看到目标、工具、权限、成本、失败、恢复、证据和下一步；公开 claim 必须可追溯。 |
| execution-boundary | Tool/Permission、Terminal/Shell、Agent、MCP/Skill、IDE/Remote | 所有外部能力只走 DSXU Tool Gate / registry / adapter boundary，不产生第二套 runtime。 |
| deepseek-runtime | Tool Result/Cache Hygiene、DeepSeek Model/Cost/Cache | Flash-first、稳定前缀、source capsule、bounded Read fallback、tool preview、真实成本/缓存轨迹。 |

#### 9.17.3 一个个机制怎么学习并改造成 DSXU

| loop | 参考机制抽象 | DeepSeek 化重构 | V26 可执行专项 |
|---|---|---|---|
| Goal / Plan / Query Loop | 任务不是 prompt，而是 goal、mode、history、plan、nextAction 的连续状态。 | goal/plan/nextAction 作为 compact stable state；复杂规划 Flash max，执行 Flash high。 | timeline goal/plan snapshot；resume goal replay；stop-condition guard。 |
| Visible Work-State | UI 不是装饰，是把看不见的工作状态变成可继续操作的产品机制。 | route/cost/cache/tool/permission/source/recovery 统一投影，减少长文本解释。 | tool/permission timeline；agent/MCP timeline；stream-json parity。 |
| Source Truth / Coding Repair | search/grep/read/edit/diff/diagnostic 分离但组合，默认先定位再改。 | source-truth capsule，fallback Read 必须 range-limited。 | code-mode capsule；Read fallback governor；source-overlap memory reread smoke。 |
| Tool Result / Cache Hygiene | 大工具结果预算化、去重、压缩、落盘，保护 warm cache。 | stable prefix + dynamic tail；tool preview 替代全文回灌；cache miss attribution。 | public challenge ablation；tool preview budget；cache chart data。 |
| Tool / Permission Lifecycle | 工具执行是 request -> decision -> execution -> result，不是黑箱。 | 权限结果变结构化 evidence 给模型；真实执行仍走 DSXU Tool Gate。 | blocked/skipped projection；side-effect negative test；adapter evidence parity。 |
| Terminal / Shell Reliability | 命令前有目的/风险/环境，命令后有 exit/key lines/delta/failure/repair。 | stdout/stderr 变 bounded result pack；完整日志落 artifact。 | long command demo；timeout/failure recovery demo；bounded preview artifact。 |
| Context / Memory / Recovery | session/history/compact/resume 是同一个任务的延续。 | memory 只缩窄探索，不替代 source truth；compact 后重建 source anchors/cache。 | compact/resume source reread；long-task recovery replay；memory confidence display。 |
| Agent Orchestration | agent 有边界、身份、父子 lineage 和 evidence handoff。 | worker 只回 summary/path/hash/evidence，不回灌长 transcript。 | worker evidence envelope；parent synthesis guard；no transcript bloat check。 |
| MCP / Skill Ecosystem | plugin/skill/MCP 是受控扩展面，有 registry、priority、conflict。 | Superpowers 等只能作二级 skill pack，仍走 DSXU registry 和 Tool Gate。 | secondary skill priority rules；MCP doctor evidence envelope；secret redaction smoke。 |
| DeepSeek Model / Cost / Cache | cost/token/cache/request id 是持续状态，不是事后账单。 | Flash high 用于 coding/bugfix，Flash max 用于 planning/review/recovery，Pro 仅 admission，FIM 是 Flash non-thinking 小 lane。 | route latch regression；Flash-first live sample；Pro admission positive/negative pack。 |
| IDE / Remote / External Boundary | bridge/remote/transport 是边界，不是第二编排器。 | IDE/API/remote host 事件进入同一 Tool Gate、cost/cache/evidence。 | API bridge smoke；external adapter permission proof；IDE product boundary。 |
| First-Run Trust / Doctor | setup/auth/doctor/trusted/onboarding 是发布体验的一部分。 | 第一次运行安全填 DeepSeek key；doctor 解释 provider、cache、cost、恢复路径。 | no-key first-run smoke；secret scan release gate；provider gate recovery copy。 |
| Telemetry / Evidence / Release | evidence 是产品功能，claim 要和 raw trace/cost/cache/failure/source/test 同源。 | public claim 必须绑定 DSXU raw/live/cost/cache；不能用映射完成替代能力完成。 | capability acceptance audit；public claim guard rewrite；GitHub data chart rebuild。 |

#### 9.17.4 当前未完成专项优化排序

按“先处理问题，最后测试”的顺序：

1. `P0 public challenge ablation`：同题 before/after 对比 `scoreFloor/cost/cacheHitRate/toolResultChars`，证明 no-Read/source capsule/cache hygiene 质量不降、成本下降。
2. `P0 tool/permission timeline wiring`：把 Tool/Permission/Agent/MCP evidence 继续接入 work-state timeline，而不是只在 final report 里出现。
3. `P0 capability public claim rewrite`：用 `DSXU_CAPABILITY_ACCEPTANCE_AUDIT` 替换 70 PASS 粗口径；README/GitHub 只写 33 个 strict public claim allowed 能力。
4. `P1 terminal reliability live demo`：补长命令、失败、超时、恢复、结果包、bounded preview 的真实 DSXU 窗口证据。
5. `P1 agent parent/worker evidence pack`：子任务不回灌长 transcript，父任务只引用 evidence envelope。
6. `P1 MCP/Skill priority-conflict pack`：Superpowers/AionUi/Cherry/Warp/browser-use 只作为生态兼容设计输入，DSXU 自有 registry 决定优先级和冲突处理。
7. `P1 IDE/API bridge product smoke`：只做 adapter boundary，未 live smoke 前不当核心卖点。
8. `P1 30-45 minute senior-coding window`：真实 DSXU TUI/CLI，默认 DeepSeek Flash，覆盖读代码、改代码、失败恢复、测试、成本/cache、final report。
9. `P2 GitHub launch data pack rebuild`：只有真实数据通过后再生成卖点图、对比图、README 文案。
10. `P2 final six-stage tests / clean export / fresh install smoke`：最后证明，不替代前面的功能判断。

本节裁决：V26 的重点不是再补“小层”，而是把 1902 文件反向得到的高级程序员体验闭环，压成 DSXU 自有主线机制；再用 70 项真实功能验收板约束卖点口径。未完成上述专项前，不允许宣称达到 GPT-5.5 / Claude 4.7 编程与复杂任务 `90% 左右`；可以只写真实已验收能力和真实优化趋势。

### 9.18 V26 深化裁决：67 项适合 DSXU，1902 机制扩展到角色/场景矩阵 - 2026-05-16

本节回应两个核心问题：

1. `33` 不是“只有 33 项合适”，而是“33 项可作为严格公开卖点候选”。实际适合 DSXU 的能力是 `67/82`，只是公开口径和验收状态不同。
2. `1902 文件` 不能只归成 13 个机制。13 个是底层机制 loop；真正用于产品改造时，还必须投影到 AI 编程能力、复杂任务执行能力、终端可靠性、Agent 协作、生态接入、发布证据等角色/场景。

#### 9.18.1 82 项/70 PASS 再裁决：哪些合适 DSXU

最新 `DSXU_CAPABILITY_ACCEPTANCE_AUDIT` 重新分层：

| fit tier | rows | 是否适合 DSXU | 公开口径 |
|---|---:|---|---|
| `public-sellable-now` | 33 | 是，当前最适合做 GitHub 卖点。 | 可写，但必须回指 DSXU source/test/live/raw/cost/cache evidence。 |
| `workflow-sellable-now` | 15 | 是，适合作为 DSXU 主工作流能力。 | 可写成工作流功能，不写成成本/榜单/外部胜出。 |
| `sellable-with-boundary` | 8 | 是，但必须限定为 DSXU 子集/适配。 | 只能写 DSXU-owned bounded feature，不能扩大成完整外部功能。 |
| `product-fit-after-live-window` | 11 | 是，但还缺真实窗口验收。 | 先做 TUI/CLI/API live evidence，再进公开卖点。 |
| `benchmark-coordinate-only` | 3 | 适合作为评测坐标，不适合作为当前功能卖点。 | 只能写 roadmap/challenge target，不写 PASS。 |
| `deferred-or-not-suitable-now` | 12 | 当前不进入 release 卖点。 | deferred/roadmap，不能进 PASS copy。 |

总负责人裁决：

- `67` 项适合 DSXU 当前产品方向：`33 + 15 + 8 + 11`。
- `33` 项是严格公开卖点候选，不是全部价值。
- `15` 项 workflow-sellable-now 应该进入 README 功能说明，例如 CLI 主链、JSON/tool support、repo probe/index、patch/report 等基础工作流能力；它们不一定是“成本卖点”，但会让 DSXU 变强。
- `8` 项 adapted/subset 也有价值，例如 FIM 小编辑 lane、Pro reviewer admission、Browser proof、Agent fanout、Code-10/Terminal-10 子集；但必须写清楚边界。
- `11` 项最应该下一轮补真实体验：主要是 terminal/shell 的 command plan、environment、output summary、filesystem delta、failure repair、timeout、artifact/result pack，以及 ablation runner。
- `3` 项 eval coordinate 和 `12` 项 deferred 不进入当前卖点。

#### 9.18.2 1902 机制不是只有 13 个，13 是底层 loop

当前 1902 反向分析有三层：

| layer | 数量 | 含义 |
|---|---:|---|
| mechanism classes | 4 | cognitive workflow、trust/visibility、execution boundary、DeepSeek runtime。 |
| mechanism loops | 13 | Goal/Plan、Visible State、Source Truth、Tool Result/Cache、Tool/Permission、Terminal、Context/Recovery、Agent、MCP/Skill、DeepSeek Cost、IDE/Remote、First Run、Evidence/Release。 |
| scenario/role matrix | 12 | 把 13 个 loop 组合成真实 AI 编程与复杂任务执行场景。 |

所以不是“只有 13 个功能”，而是 `13 个底层机制` 组合出 `12 个真实场景/角色`。DSXU 要吸收的是组合能力，不是逐文件搬功能。

#### 9.18.3 AI 编程与复杂任务执行能力的 12 个场景矩阵

| role / scenario | 当前裁决 | 还缺什么 |
|---|---|---|
| senior feature engineer / multi-file feature | `claim-limited` | 需要 public challenge ablation、telemetry claim rewrite、tool/cache evidence。 |
| debugging engineer / bugfix regression | `claim-limited` | 需要 source capsule 推广到常规 code-mode、Read fallback governor、ablation。 |
| technical lead / long-running goal preservation | `implemented+tested` | 后续在 30-45 分钟真实窗口回测。 |
| terminal reliability engineer / command failure recovery | `needs-live-evidence` | 长命令、超时、失败、恢复、artifact preview 的真实 DSXU 窗口证据。 |
| agent lead / delegation and parent synthesis | `claim-limited` | worker evidence envelope、parent synthesis guard、no transcript bloat check。 |
| ecosystem integrator / MCP-Skill routing | `implemented+tested` | 下一步补 Superpowers 二级 skill priority/conflict 任务卡。 |
| source-truth engineer / large repo without cache destruction | `implemented+tested` | 继续补 code-mode capsule 和 fallback governor。 |
| release evidence owner / public proof | `claim-limited` | GitHub 数据图和 claim guard 必须用真实 ablation/public challenge 数值重建。 |
| new user onboarding / first-run provider trust | `implemented+tested` | 最终 release artifact 里重跑 no-key/key wizard/doctor smoke。 |
| platform integrator / IDE-API boundary | `needs-live-evidence` | API bridge smoke、external adapter permission proof、不能形成第二 runtime。 |
| DeepSeek runtime engineer / cost-cache optimization | `claim-limited` | 同题 ablation 证明 score 不降、cost/toolResult/cache 改善。 |
| review lead / anti-fake completion | `claim-limited` | 70 PASS 粗口径改写，公开 claim 只用严格证据。 |

当前未完全吸收完整的不是 13 个机制本身，而是这些组合场景里的 `8` 个现实闭环：

1. public challenge ablation。
2. code-mode source capsule 普及。
3. Read fallback governor。
4. terminal reliability live demo。
5. agent parent/worker evidence envelope。
6. MCP/Skill priority-conflict pack。
7. IDE/API external adapter smoke。
8. GitHub claim/data chart rebuild。

#### 9.18.4 结合 DeepSeek 的重构原则

DSXU 不复制参考产品源码、文案、品牌、商业逻辑；只吸收通用工作机制，然后按 DeepSeek 特点重构：

- `Flash-first`：大多数 coding/bugfix/verification 走 `deepseek-v4-flash`；复杂 planning/review/recovery 用 Flash max；Pro 只在高风险、失败验证、明确 admission evidence 时触发。
- `source capsule`：把 source truth 编译成 path/hash/anchor/excerpt/riskTags，减少多轮大 Read。
- `bounded tool evidence`：工具输出是 evidence，不是聊天填充；长 stdout/stderr/full transcript 落 artifact，只给模型 bounded preview。
- `stable prefix + dynamic tail`：目标、策略、source capsule 放稳定前缀；最新发现、失败、下一步放动态尾部。
- `visible-state projection`：用户在 TUI/CLI/stream-json/final report 里看到同一份目标、工具、权限、成本、失败、恢复、证据。
- `claim discipline`：任何卖点必须回指 source/test/live/raw/cost/cache evidence；没有真实数据就写 roadmap，不写达成。

#### 9.18.5 下一步执行排序

先处理问题，最后测试：

1. `public challenge ablation`：锁定同题 3 条 review，生成 before/after cost、cache、toolResultChars、scoreFloor 对比。
2. `capability public claim rewrite`：用 fit tier 替换旧 70 PASS 粗口径，形成 GitHub 卖点白名单。
3. `source capsule + Read fallback governor`：把 public challenge 已验证的 no-Read 思路推广到常规 code-mode。
4. `tool/permission/agent/MCP timeline wiring`：让高级程序员工作状态在产品界面真实可见。
5. `terminal reliability live demo`：已由 9.22 补真实 terminal/TUI live evidence；后续只随最终六阶段回归。
6. `agent evidence envelope + MCP skill priority`：把 claim-limited 场景转成可验收证据。
7. `IDE/API smoke`：只做 adapter boundary，不做第二 runtime。
8. `30-45 minute real DSXU senior-coding window`：用 DeepSeek Flash 默认调度真实做复杂任务。
9. `GitHub launch pack rebuild`：只写 33 个严格公开卖点 + 15 个工作流能力 + 8 个边界能力 + 真实图表。
10. `six-stage final tests / clean export / fresh install smoke`：最后证明，不替代前面功能判断。

### 9.19 V26 67 项适配明细与 1902 反向场景扩展池 - 2026-05-16

本节把 9.18 的总数继续压成可执行明细。裁决口径如下：

- `67/82` 是适合 DSXU 当前 DeepSeek-first 产品方向的能力池。
- `48/67` 已是 `implemented+tested`，后续只进入六阶段回归和 release evidence 同步。
- `19/67` 仍需继续收口：其中 `8` 个是 `adapted/subset+tested`，需要边界文案、live 示例和不能夸大的公开 claim；`11` 个是 `implemented+tested-needs-live-window`，需要真实 DSXU TUI/CLI/API 窗口验收。
- 当前没有 `needs-real-functional-acceptance` 行，但这不等于可以直接发布 90% 对标 claim；公开挑战和 30-45 分钟 senior-coding window 仍要补。

#### 9.19.1 67 项适合 DSXU 的完成/未完成裁决

| tier | rows | 完成状态 | 还差什么 |
|---|---:|---|---|
| `public-sellable-now` | 33 | `33/33 implemented+tested` | 最终六阶段回归；GitHub 只按真实 source/test/live/raw/cost/cache evidence 写卖点。 |
| `workflow-sellable-now` | 15 | `15/15 implemented+tested` | 最终六阶段回归；可写工作流能力，不能写成榜单/外部胜出。 |
| `sellable-with-boundary` | 8 | `8/8 adapted/subset+tested` | 需要 claim-limited 文案、live 示例、边界说明；不能写 full external feature。 |
| `product-fit-after-live-window` | 11 | `11/11 implemented+tested-needs-live-window` | 必须进入真实 DSXU TUI/CLI/API 窗口、terminal demo、ablation 或 senior-coding window。 |

#### 9.19.2 48 项已完成能力：只做回归，不再反复重判

| id | 功能 | owner | 验收口径 |
|---|---|---|---|
| S00 | DSXU CLI = DeepSeek V4 Code/Terminal orchestration enhancer | Query loop / work-state / runtime owner | 工作流卖点；随最终六阶段测试回归。 |
| S01 | Cold Mode | Query loop / work-state / runtime owner | 严格公开卖点候选；需引用成本/路由真实证据。 |
| M01 | DeepSeek V4 Flash/Pro Adapter | DeepSeek runtime / model-cost-cache owner | 严格公开卖点候选；Flash-first、Pro admission 必须有轨迹证据。 |
| M02 | Thinking Mode / Effort control | DeepSeek runtime / model-cost-cache owner | 严格公开卖点候选；thinking 路由需有 route reason。 |
| M03 | ReasoningStateManager | DeepSeek runtime / model-cost-cache owner | 严格公开卖点候选；随 DeepSeek trajectory 回归。 |
| M04 | Tool Calls support | DeepSeek runtime / model-cost-cache owner | 工作流卖点；不得写成无限工具 runtime。 |
| M05 | JSON Output mode | DeepSeek runtime / model-cost-cache owner | 工作流卖点；需在 API/TUI 输出保持 schema。 |
| M06 | Context Cache hit planning | DeepSeek runtime / model-cost-cache owner | 严格公开卖点候选；只写真实 cache 值和优化趋势。 |
| C01 | CLI Main Chain | Query loop / work-state / runtime owner | 工作流卖点；随最终六阶段测试回归。 |
| C02 | Interactive Session | Query loop / work-state / runtime owner | 严格公开卖点候选；需 senior-coding window 回测。 |
| C03 | Task Timeline Renderer | Query loop / work-state / runtime owner | 严格公开卖点候选；继续接 Tool/Permission/Agent/MCP evidence。 |
| C04 | PermissionGate | Query loop / work-state / runtime owner | 严格公开卖点候选；权限必须只进 DSXU Tool Gate。 |
| C05 | IntentRouter | Query loop / work-state / runtime owner | 严格公开卖点候选；FIM/Pro 不得误触发。 |
| C06 | SkillRouter core edition | Query loop / work-state / runtime owner | 严格公开卖点候选；生态技能必须二级优先级/冲突规则。 |
| C07 | ContextCompiler | Query loop / work-state / runtime owner | 严格公开卖点候选；9.24 已推广 source capsule 到常规 code-mode。 |
| C08 | TokenFirewall | Query loop / work-state / runtime owner | 严格公开卖点候选；防止工具结果膨胀破坏 DeepSeek cache。 |
| C09 | CostRouter | Query loop / work-state / runtime owner | 严格公开卖点候选；必须显示 route/cost/cache trajectory。 |
| C10 | PlanGraph | Query loop / work-state / runtime owner | 严格公开卖点候选；目标/计划/停止条件要可恢复。 |
| C11 | ToolBus | Query loop / work-state / runtime owner | 严格公开卖点候选；不允许第二套工具 runtime。 |
| C12 | VerificationKernel | Query loop / work-state / runtime owner | 严格公开卖点候选；测试只证明，不替代功能判断。 |
| C13 | Snapshot/Rollback | Query loop / work-state / runtime owner | 严格公开卖点候选；恢复证据进入 timeline/final report。 |
| C14 | FailureTaxonomy | Query loop / work-state / runtime owner | 严格公开卖点候选；失败分类要能驱动 repair。 |
| C15 | TraceLogger | Query loop / work-state / runtime owner | 严格公开卖点候选；trace 不泄露 secret。 |
| C16 | CostReporter | Query loop / work-state / runtime owner | 严格公开卖点候选；GitHub 图表只用真实成本。 |
| C17 | LocalMemory Lite | Query loop / work-state / runtime owner | 严格公开卖点候选；memory 不能替代 source truth。 |
| C18 | Anti-Rationalization Guard | Query loop / work-state / runtime owner | 严格公开卖点候选；防假完成、防夸大 claim。 |
| A01 | RepoProbe | Code-mode repair / patch / verification owner | 工作流卖点；随最终六阶段测试回归。 |
| A02 | RepoIndex | Code-mode repair / patch / verification owner | 工作流卖点；随最终六阶段测试回归。 |
| A03 | LSP/AST Locator | Code-mode repair / patch / verification owner | 工作流卖点；优先定位再读取。 |
| A04 | Error Parser | Code-mode repair / patch / verification owner | 工作流卖点；失败修复闭环输入。 |
| A05 | Bug Locator Ensemble | Code-mode repair / patch / verification owner | 工作流卖点；需和 source capsule 结合。 |
| A06 | CodeContextPack | Code-mode repair / patch / verification owner | 严格公开卖点候选；9.24 已转 source capsule。 |
| A07 | Patch Planner | Code-mode repair / patch / verification owner | 工作流卖点；不能跳过 owner/risk。 |
| A08 | Unified Diff Generator | Code-mode repair / patch / verification owner | 工作流卖点；随最终六阶段测试回归。 |
| A09 | Patch Applier | Code-mode repair / patch / verification owner | 工作流卖点；需权限/side-effect evidence。 |
| A10 | Test Runner | Code-mode repair / patch / verification owner | 严格公开卖点候选；功能测试阶段回归。 |
| A11 | Code RepairLoop | Code-mode repair / patch / verification owner | 严格公开卖点候选；真实 bugfix window 回测。 |
| A12 | RegressionGuard Lite | Code-mode repair / patch / verification owner | 严格公开卖点候选；避免修一处坏一处。 |
| A13 | Patch Candidate Search | Code-mode repair / patch / verification owner | 工作流卖点；用于多方案选择。 |
| A15 | FinalPatchReport | Code-mode repair / patch / verification owner | 工作流卖点；final report 必须回指证据。 |
| B04 | SafeShellExecutor | Tool/terminal lifecycle owner | 工作流卖点；shell 必须有权限和 bounded output。 |
| B07 | CommandVerifier | Tool/terminal lifecycle owner | 严格公开卖点候选；真实 terminal demo 回测。 |
| E01 | Baseline Runner | Evidence / benchmark / public challenge owner | 严格公开卖点候选；用于自有 baseline，不冒充外部榜单。 |
| E03 | Cost Eval Reporter | Evidence / benchmark / public challenge owner | 严格公开卖点候选；生成真实成本图。 |
| E04 | Failure Reporter | Evidence / benchmark / public challenge owner | 严格公开卖点候选；失败也要可复盘。 |
| E05 | Trace Collector | Evidence / benchmark / public challenge owner | 严格公开卖点候选；secret scan 必须过。 |
| E06 | Go/Stop Decision | Evidence / benchmark / public challenge owner | 严格公开卖点候选；阻断条件不能被测试覆盖。 |
| E07 | Mini Report Generator | Evidence / benchmark / public challenge owner | 严格公开卖点候选；README/launch pack 引用真实证据。 |

#### 9.19.3 8 项边界能力：不是没用，但不能夸大

| id | 功能 | 当前裁决 | 必须补的验收 |
|---|---|---|---|
| A16 | Internal Code-10/30 Runner | `adapted/subset+tested` | 只写 DSXU 内部 coding subset；补 live 示例和数据边界。 |
| B12 | TerminalBench Subset Adapter | `adapted/subset+tested` | 只写 subset adapter；不能写 Terminal-Bench 2.0 PASS。 |
| B13 | Internal Terminal-10/30 Runner | `adapted/subset+tested` | 只写内部 terminal task runner；补真实窗口失败恢复样例。 |
| M07 | FIM local completion | `adapted/subset+tested` | 只写 DeepSeek Flash non-thinking 小编辑 lane；不得误触发主 query。 |
| A14 | Pro Reviewer | `adapted/subset+tested` | 只写 Pro admission reviewer；默认不能全量 Pro。 |
| A17 | SWE Smoke Runner | `adapted/subset+tested` | 只写 smoke runner；不能写 SWE Verified PASS。 |
| PZ03 | BrowserExecutor | `adapted/subset+tested` | 只写 browser proof/adapter boundary；需要真实 browser smoke。 |
| PZ07 | Multi-Agent Swarm/Coordinator | `adapted/subset+tested` | 只写 DSXU agent fanout/coordinator；需要 parent/worker evidence envelope。 |

#### 9.19.4 11 项需要真实窗口验收：67 项里最该先补的硬项

| id | 功能 | owner | 真实验收要求 |
|---|---|---|---|
| B01 | ShellStateManager | Tool/terminal lifecycle owner | 在真实 DSXU 窗口显示 shell cwd/env/state delta。 |
| B02 | EnvironmentProbe | Tool/terminal lifecycle owner | 真实探测 Node/Bun/Git/OS/key/provider，输出 doctor evidence。 |
| B03 | CommandPlanner | Tool/terminal lifecycle owner | 命令前显示目的、风险、预期输出和失败分支。 |
| B05 | OutputSummarizer | Tool/terminal lifecycle owner | 长 stdout/stderr 只给 bounded preview，完整日志落 artifact。 |
| B06 | FileSystemState | Tool/terminal lifecycle owner | 命令前后文件变化可见，避免静默污染工作区。 |
| B08 | ScriptSynthesizer | Tool/terminal lifecycle owner | 真实生成并运行小脚本，失败能修复，不走伪成功。 |
| B09 | Terminal FailureRepairLoop | Tool/terminal lifecycle owner | 故意制造失败，证明诊断、修复、重跑和 final evidence。 |
| B10 | TimeoutGuard | Tool/terminal lifecycle owner | 长命令 timeout 可取消/恢复/摘要，不让 UI 卡死。 |
| B11 | ArtifactChecker | Tool/terminal lifecycle owner | 验证生成文件、报告、trace、图表真实存在且可打开。 |
| B14 | TerminalResultPackager | Tool/terminal lifecycle owner | 形成 exit code、key lines、artifact path、risk 的结构化结果包。 |
| E02 | Ablation Runner | Evidence / benchmark / public challenge owner | 同题 before/after 对比 score、cost、cache、toolResultChars，质量不降才写优化。 |

#### 9.19.5 1902 反向分析还能继续挖的 DSXU 场景/功能

除 13 个底层 loop 和 12 个角色矩阵外，作为 DSXU 总负责人还应该继续从“高级程序员体验闭环密度”反向吸收以下场景。它们不是要求复制参考产品，而是把通用机制改造成 DSXU-owned、DeepSeek-first 能力。

| priority | 场景/功能 | 对 DSXU 的价值 | 实施边界 |
|---|---|---|---|
| P0 | `Impact Radar` 变更影响雷达 | 改代码前自动列出受影响入口、测试、配置、文档和风险，让 AI 像高级工程师先看 blast radius。 | 只用 DSXU repo index/LSP/test map；不新增第二套 planner。 |
| P0 | `Source Capsule for Code Mode` 常规编程 source capsule | 把 public challenge 的 no-Read 成功经验推广到普通 feature/bugfix，减少大文件 Read 和工具回灌。 | path/hash/anchor/excerpt/riskTags 必须可追溯；Read 只做 fallback。 |
| P0 | `Read Fallback Governor` 读取治理器 | 规定先 Grep/定位，再 range Read；单次读取超预算必须失败或落盘预览。 | 不能为了 cache 命中牺牲 source truth。 |
| P0 | `Evidence-Driven Review` 证据驱动代码审查 | review 不只说意见，而是绑定文件、行号、风险、测试和修复候选。 | 输出 DSXU 自有 review schema，不复制参考产品文案。 |
| P0 | `Human Signoff Checkpoints` 人类签收断点 | 对删除、权限、外部执行、Pro 升级、release claim 做明确签收，避免 AI 自己越权。 | 只做 DSXU Tool Gate / Permission Gate / owner review。 |
| P1 | `Failure Museum` 失败样本库 | 把失败命令、失败测试、修复方式沉淀成可检索 repair pattern，提高长期任务恢复。 | 只保存摘要、hash、路径、原因；不塞长 transcript。 |
| P1 | `Test Selection Intelligence` 测试选择智能 | 根据 touched files、owner、风险自动建议最小必要测试和最终完整测试顺序。 | 测试策略进入 timeline；不能用少量测试替代最终验收。 |
| P1 | `Cost Simulator Before Run` 运行前成本预估 | 执行复杂任务前估算 Flash/Pro、tool result、cache 影响，帮助用户决策。 | 默认 Flash；Pro 只给 admission reason。 |
| P1 | `Agent Merge Arbiter` 多 Agent 合并仲裁 | worker 并行后，父任务只看 evidence envelope、冲突文件和测试结果，避免 transcript 爆炸。 | 不新增 agent runtime；接现有 agent/tool lifecycle。 |
| P1 | `Workspace Hygiene Board` 工作区卫生板 | 把 dirty、generated、evidence、release、permission residue 分 owner 展示，避免越清越乱。 | 不自动 delete/stage；只做 owner/Git packet。 |
| P1 | `Dependency Drift Doctor` 依赖漂移诊断 | 检查 package、lockfile、runtime、平台差异，解释为什么本机/CI 失败。 | doctor evidence 进入 first-run/release gate。 |
| P1 | `Provider Health Lane` DeepSeek provider 健康通道 | 显示 key、quota、latency、route、cache、error retry，避免用户不知道模型有没有真调用。 | 不打印 secret；只输出 masked evidence。 |
| P1 | `TUI Operator Ergonomics` 真实操作体验密度 | 折叠工具块、状态条、成本条、失败恢复按钮、证据链接，让用户像看高级程序员工作。 | 必须与 stream-json/final report 同源，不做 UI 假状态。 |
| P1 | `Benchmark Rubric Builder` 公开挑战 rubric 生成器 | 给每个 public task 生成评分 rubrics、source truth、risks、success criteria，避免高粉低能。 | 评分必须可复跑，不用自夸 prompt。 |
| P2 | `Repo Playbook Memory` 项目手册记忆 | 每个 repo 沉淀构建、测试、发布、风格、风险，长任务不从零开始。 | memory 只做导航，不替代当前 source truth。 |
| P2 | `Release Evidence Storyboard` 发布证据故事板 | GitHub README、图表、demo、claim 统一从真实 evidence pack 出，不手写夸张卖点。 | public95 claim 未达成时只能写当前真实分数和趋势。 |
| P2 | `External Adapter Contract Kit` 外部生态接入契约 | 为 AionUi/Cherry/Warp/browser-use/IDE/API 这类生态准备统一 adapter contract。 | 只是兼容层设计；DSXU 仍独立产品，不下载/内置对方产品。 |
| P2 | `Long-Horizon Recovery Drill` 长时间任务恢复演练 | 人为压缩/中断/恢复任务，证明目标、计划、source anchors、成本、失败记录能恢复。 | 必须在真实 DSXU 窗口执行，不用纯脚本冒充体验。 |

追加场景池。以下 `49` 个不是马上全部实现，而是 V26/V27 之间用于判断“高级程序员体验闭环密度”是否还缺口的候选。P0 优先进入执行，P1 进入验收设计，P2 进入发布/生态路线图。

| priority | 场景/功能 | 对 DSXU 的价值 | 实施边界 |
|---|---|---|---|
| P0 | `Requirement Contract Extractor` 需求契约抽取 | 把用户自然语言拆成目标、非目标、验收、风险、停止条件，减少长任务跑偏。 | 接 Query loop / PlanGraph；不新增第二套任务编排。 |
| P0 | `Acceptance Ladder` 分层验收梯 | 把“功能判断、focused test、真实窗口、六阶段最终测试、发布 claim”分层，避免用小测试冒充完成。 | 写入 Evidence owner；测试只作为证明。 |
| P0 | `Risk Budget Gate` 风险预算门 | 大改前估算 blast radius、删除风险、权限风险、Pro 成本风险。 | 只做 gate evidence，不自动阻塞用户明确签收。 |
| P0 | `Owner Boundary Resolver` owner 边界解析 | 遇到重复实现先判定唯一 owner，防止第二套 runtime、第二套 permission、第二套 provider。 | 复用 V20/OGR owner map。 |
| P0 | `Duplicate Behavior Merger` 重复行为合并器 | 等价重复就合并或标 replace/delete candidate，避免历史脏块拖慢收尾。 | 不自动 delete/stage；进入 owner/Git packet。 |
| P0 | `Dead Path Tombstone Review` 死路径墓碑审查 | 判断旧入口、shim、compat path 是否仍被 import/use；无用则进入删除 review。 | 只产证据，不越权清理。 |
| P0 | `Dependency Entry Map` 依赖入口地图 | 识别每个能力真正入口、调用链、测试链、发布链，减少“功能在但没融合到工作流”。 | 使用 rg/import graph/package scripts，不新增框架。 |
| P0 | `Source Truth Freshness Guard` 源事实新鲜度守卫 | memory/summary/old report 命中时要求重新验证关键文件 mtime/hash，防止旧证据误导。 | memory 只导航，不替代当前 source truth。 |
| P0 | `Patch Completeness Judge` 补丁完整性裁决 | 判断改动是否只是最小补丁、是否漏测试/文档/owner/visible-state。 | 输出 checklist，不要求过度设计。 |
| P0 | `Test Failure Triage Router` 测试失败分流器 | 失败后自动判断是代码错、测试错、环境错、flaky、依赖漂移还是权限问题。 | 接 FailureTaxonomy / VerificationKernel。 |
| P0 | `UI State Truth Sync` UI 状态同源同步 | TUI、CLI、stream-json、final report 展示同一份 goal/tool/cost/evidence 状态。 | 不做 UI 假状态；必须来自 work-state timeline。 |
| P0 | `Route Intent Lock` 路由意图锁 | 一次任务内 workflowKind/role/model/thinking 不漂移，避免 prompt 文本误触发 Pro/FIM。 | 接 DeepSeek route latch；允许显式 admission。 |
| P1 | `Multi-Model Disagreement Gate` 多模型分歧门 | Flash 结论低信心或高风险时，用 Pro/reviewer 做明确分歧裁决，而不是常驻 Pro。 | Pro 只按 admission evidence。 |
| P1 | `Cache Warmup Planner` 缓存预热规划 | 对长任务固定 stable prefix、source capsule 和工具列表，提高 DeepSeek 前缀缓存稳定性。 | cache 是优化指标，不是硬发布 gate。 |
| P1 | `Tool Output Budget Broker` 工具输出预算代理 | 给 Read/Grep/Bash/Web/Agent 输出设置预算，超限转 artifact+preview。 | 不能减少 source truth，只改变传递形态。 |
| P1 | `Long Stdout Artifact Splitter` 长输出落盘拆分 | 长命令输出拆成 full log、preview、key lines、risk tags，提升 UI 可读性。 | 接 TerminalResultPackager。 |
| P1 | `Command Replay Capsule` 命令复跑胶囊 | 每个关键命令记录 cwd/env/argv/exit/key output，方便用户和 CI 复跑。 | secret/env 必须 redaction。 |
| P1 | `Side Effect Ledger` 副作用账本 | 记录文件写入、外部网络、权限请求、进程启动、删除候选，提升可审计性。 | 不作为第二权限系统；投影 Tool Gate evidence。 |
| P1 | `Secret Lifecycle Guard` key 生命周期守卫 | 首次 key 输入、配置、doctor、release scan、日志 redaction 形成闭环。 | 不打印、不保存明文到 evidence。 |
| P1 | `Release Artifact Provenance` 发布包来源链 | clean export、zip、sha256、secret scan、fresh install smoke 都有来源链。 | release-ready 不能替代 public benchmark-ready。 |
| P1 | `README Claim Linter` README 卖点校验 | README/图表/卖点只能引用 strict public claim allowed 和真实 evidence。 | 未达 90% 不写达到对标。 |
| P1 | `Public Demo Script Runner` 公开 demo 脚本运行器 | 为 GitHub 提供可复跑 demo：任务、命令、截图、成本、失败恢复。 | demo 不允许人工美化结果。 |
| P1 | `Benchmark Anti-Gaming Guard` 榜单防作弊守卫 | 防止用模板、target-only、generic logs、controlled harness 冒充公开能力。 | 与 public challenge raw evidence 同源。 |
| P1 | `User Interruption Recovery` 用户中断恢复 | 用户插话、改目标、暂停、恢复时，系统能重建目标和当前行动。 | 接 conversation state，不吞掉新指令。 |
| P1 | `Conversation Compression Audit` 对话压缩审计 | context compaction 后检查目标、owner、pending risk、nextAction 是否保留。 | 压缩摘要不能替代 source truth。 |
| P1 | `Progress Staleness Detector` 进度陈旧检测 | 长时间重复“继续执行”时检测是否只补文档、没有推进 gate。 | 输出 blocked reason 和下一硬输入。 |
| P1 | `Error Message Translator` 错误信息翻译器 | 把堆栈/编译/测试/权限错误翻译成 owner、原因、修复候选。 | 保留原始错误 path/hash。 |
| P1 | `Local Index Refresh Policy` 本地索引刷新策略 | dirty/mtime/import 变化后只刷新相关索引，兼顾速度和 source truth。 | 不用过期索引做最终判断。 |
| P1 | `Code Style Inference` 代码风格推断 | 修改前学习邻近文件风格、测试风格、命名和错误处理模式。 | 不引入新抽象，优先现有风格。 |
| P1 | `Generated File Policy` 生成文件策略 | 区分源码、生成物、证据、release artifact、外部副本，避免项目越做越乱。 | 清理必须走 owner/Git review。 |
| P1 | `Dependency Upgrade Planner` 依赖升级规划 | 升级前评估 lockfile、API breaking、测试范围、rollback。 | 不自动升级，除非任务要求。 |
| P1 | `Cross Platform Shell Plan` 跨平台 shell 计划 | PowerShell/Bash/cmd 差异进入命令计划，避免 Windows 下脚本误判。 | 本机先按 PowerShell 真实验证。 |
| P1 | `Browser/GUI Action Recorder` 浏览器/GUI 动作记录 | 真实 UI 测试时记录页面、操作、截图、失败点和 artifact。 | 不用纯脚本冒充体验测试。 |
| P1 | `MCP Capability Negotiation` MCP 能力协商 | 接入 MCP/Skill 前明确能力、权限、成本、冲突和 fallback。 | DSXU registry 决定，不让外部工具自成 runtime。 |
| P1 | `Skill Shadowing Detector` 技能遮蔽检测 | 检查二级技能包是否覆盖主技能、抢路由、绕过权限。 | Superpowers 等只能二级补充。 |
| P1 | `Provider Fallback Diagnosis` provider fallback 诊断 | DeepSeek 请求失败时区分 key/quota/network/rate/model/JSON/tool 问题。 | 不静默切 Pro 或其它 provider。 |
| P1 | `Cost Quality Pareto Board` 成本质量帕累托板 | 展示同题 Flash/Flash max/Pro 的质量、成本、cache、耗时权衡。 | 只能用真实 raw run，不用理论值。 |
| P2 | `Team Mode Handoff Packet` 团队交接包 | 把长任务状态交给另一个人/agent：目标、证据、风险、下一步。 | 不复制完整 transcript。 |
| P2 | `API Consumer Contract Tests` API 消费者契约测试 | 对外 API/bridge 提供 contract smoke，证明生态集成不破主链。 | 只验证边界，不做完整 IDE 产品。 |
| P2 | `Plugin Safety Manifest` 插件安全清单 | 每个插件/skill 声明权限、命令、网络、文件范围、secret policy。 | 接 Permission Gate。 |
| P2 | `Data Retention Privacy View` 数据保留/隐私视图 | 用户能看到哪些 trace/evidence/log 被保存、是否含敏感信息。 | 默认 redaction，release scan 必须过。 |
| P2 | `Offline Low Network Mode` 弱网/离线模式 | provider 不可用时仍能做 repo scan、plan、local tests、evidence prep。 | 不伪造模型结果。 |
| P2 | `Release Regression Story` 发布回归故事 | 发布前给出从功能、体验、恢复、性能、评测、发布六阶段到 claim 的故事线。 | 故事线只能引用真实 evidence。 |
| P2 | `Onboarding Tutorial Harness` 新手教程 harness | 第一次使用引导 key、doctor、小任务、成本显示、失败恢复。 | 不做营销落地页，直接可操作。 |
| P2 | `Capability Decay Monitor` 能力衰减监控 | 定期检测历史 PASS 是否因代码变化、API变化、测试缺失而降级。 | 自动化只报告，不自动改代码。 |
| P2 | `Long-Term Evidence Archive` 长期证据归档 | 把 raw logs、trace、reports、metrics 分层归档，release/export 不带内部证据库。 | 遵守 .gitignore 和 secret scan。 |
| P2 | `Maintainer Review Queue` 维护者审查队列 | 对 owner packets、delete candidates、permission residues 形成审查队列。 | 不自动 stage/delete。 |
| P2 | `Open Source Issue Reproducer` 开源 issue 复现器 | GitHub issue 输入后生成复现步骤、环境、最小测试、修复候选。 | 只对用户授权 repo 操作。 |
| P2 | `Community Benchmark Importer` 社区 benchmark 导入器 | 让用户导入公开任务并生成 DSXU raw proof，不把外部 benchmark 当已通过。 | 必须保留 target/source manifests。 |

第二追加场景池。以下 `107` 个继续从高级程序员体验、AI 编程能力、复杂任务执行、DeepSeek 成本/缓存/路由、开源发布可信度反向扩展。它们全部记录为候选，不替代当前 P0 硬顺序；后续执行时必须先查是否已有 DSXU owner，能合并就合并，不能形成第二套主链。

| priority | 场景/功能 | 对 DSXU 的价值 | 实施边界 |
|---|---|---|---|
| P0 | `Architecture Drift Sentinel` 架构漂移哨兵 | 持续检查新增代码是否偏离 DSXU 主链、owner map 和单一 runtime 原则。 | 只输出 evidence 和 owner 建议，不自动重构。 |
| P0 | `Mainline Entry Audit` 主入口审计 | 确认 CLI/TUI/API/agent/tool 调用最终进入同一 query-loop 和 Tool Gate。 | 禁止新增旁路入口；新入口必须投影到现有主链。 |
| P0 | `Runtime Singularity Guard` 单一运行时守卫 | 防止 provider、permission、MCP、agent、tool 出现第二套运行时。 | 用 import/use 证据判断，不靠目录名猜测。 |
| P0 | `Permission Path Proof` 权限路径证明 | 每个有副作用动作都能追到 permission request、decision、execution、visible-state。 | 不做本地 shortcut permission。 |
| P0 | `Provider Route Truth Table` provider 路由真值表 | 明确 Flash、Flash thinking、Flash max、Pro、FIM 的触发条件和负例。 | Pro/FIM 必须显式 lane 或 admission evidence。 |
| P0 | `Cache-Safe Context Packager` 缓存安全上下文包 | 把 source、goal、plan、evidence 编译成稳定前缀和动态尾部。 | 不能为了 cache 删掉必要 source truth。 |
| P0 | `Tool Call Causality Chain` 工具调用因果链 | 让每次工具调用都有 reason、input summary、permission、output preview、follow-up。 | 工具输出大块内容落 artifact。 |
| P0 | `Failure-to-Fix Loop Proof` 失败到修复闭环证明 | 证明失败不是被掩盖，而是分类、定位、修复、重测、报告。 | 必须有失败前后 evidence。 |
| P0 | `Edit Intent Ledger` 编辑意图账本 | 每个文件改动都有意图、owner、风险、测试和回滚口径。 | 不生成冗长注释；记录进 evidence。 |
| P0 | `Import Use Evidence Join` import/use 证据联表 | 把候选文件按真实引用、执行入口、测试覆盖判断去留。 | 不能用“看起来旧”直接删除。 |
| P0 | `Owner Test Obligation Map` owner 测试义务图 | owner 变更自动映射最少测试、体验测试和最终回归。 | 测试建议不替代人工判断。 |
| P0 | `Release Claim Evidence Binder` 发布声明证据绑定器 | 每个 README 卖点绑定 source/test/live/raw/cost/cache 证据。 | 没证据的只写 roadmap。 |
| P0 | `High-Risk Mutation Gate` 高风险变更门 | 删除、权限、外部执行、provider、release、成本路由变更必须过 gate。 | gate 只要求签收，不替用户决定。 |
| P0 | `Source Diff Semantic Classifier` diff 语义分类器 | 区分功能、重构、删除、证据、生成物、文档，减少 dirty 混乱。 | 不自动 stage/commit。 |
| P0 | `Live Session Truth Recorder` 真实会话记录器 | 真实 DSXU 窗口测试时记录 route、tools、cost、cache、failures、screenshots。 | 不记录 secret，不把脚本测试冒充体验。 |
| P0 | `Model Admission Ledger` 模型升级账本 | 记录为什么从 Flash 升到 Flash max 或 Pro，事后可审计。 | 默认 Flash；Pro 不常驻。 |
| P0 | `User Goal Invariant Guard` 用户目标不变量守卫 | 长任务中持续检查是否仍服务原目标，避免越做越偏。 | 新用户指令优先，变更要留下原因。 |
| P0 | `Worktree Dirty Attribution` 工作区 dirty 归因 | 把 dirty 分成源码、生成物、证据、删除态、权限残留、外部副本。 | 不清理，只生成 owner packets。 |
| P0 | `Evidence Freshness Expiry` 证据新鲜度过期 | 旧测试、旧报告、旧 source hash 过期后要求重跑或降级 claim。 | 过期是风险提示，不自动删证据。 |
| P0 | `Benchmark Pairing Contract` benchmark 配对契约 | DSXU raw 与 target raw 必须同题、同输入、同指标，防止假对比。 | target manifest 缺失时不能宣称胜出。 |
| P1 | `Code Review Severity Calibrator` 审查严重度校准 | 把 findings 分 P0/P1/P2/P3，避免把风格问题当阻断。 | 只用于 review 输出，不替代测试。 |
| P1 | `Refactor Scope Negotiator` 重构范围协商器 | 大重构前明确必须改、可延后、不应碰的边界。 | 用户要求果断时仍需 owner/risk 证据。 |
| P1 | `API Surface Diff` API 表面差异 | 变更导出 API、CLI flags、JSON schema 时输出兼容影响。 | 不引入新 bridge runtime。 |
| P1 | `Config Schema Doctor` 配置 schema 诊断 | 检查配置字段、默认值、迁移、错误提示是否一致。 | 不保存 key 明文。 |
| P1 | `Env Repro Snapshot` 环境复现快照 | 记录 OS、shell、node/bun、git、provider、env redaction，方便复跑。 | secret redaction 必须默认开启。 |
| P1 | `CI Matrix Planner` CI 矩阵规划 | 根据变更范围建议本地/CI/跨平台测试矩阵。 | 不强制跑全量，最终阶段再全量。 |
| P1 | `Flaky Test Quarantine Advisor` flaky 测试隔离建议 | 标记偶发失败、环境失败、真实回归，避免误修。 | 不自动跳过测试。 |
| P1 | `Golden Output Validator` 黄金输出校验 | 对 JSON/report/README/chart 输出做结构和关键字段校验。 | 不把 snapshot 当唯一真理。 |
| P1 | `Snapshot Review Assistant` 快照审查助手 | 快照变化时解释变更原因和风险，避免无脑更新。 | 不自动接受 snapshot。 |
| P1 | `Test Data Minimizer` 测试数据最小化 | 把大 fixture 缩成最小可复现样本，降低 token/IO 成本。 | 不丢失覆盖目标。 |
| P1 | `Migration Safety Net` 迁移安全网 | 数据/配置/状态迁移前后有验证和 rollback。 | 只对 DSXU 自有数据结构。 |
| P1 | `Async Race Risk Scanner` 异步竞态风险扫描 | 查找并发 agent/tool/UI 状态更新中的 race 风险。 | 输出风险和测试建议。 |
| P1 | `Error Boundary Coverage Map` 错误边界覆盖图 | UI/TUI/API/CLI 的错误路径都有用户可理解输出。 | 不吞原始错误。 |
| P1 | `State Machine Visualizer` 状态机可视化 | 把 query、tool、permission、agent、recovery 状态画成可审计流。 | 使用 existing timeline，不另建状态机。 |
| P1 | `Dataflow Trace Capsule` 数据流 trace 胶囊 | 关键数据从输入到输出的字段变化可追踪。 | 大 trace 落 artifact。 |
| P1 | `Config Drift Comparator` 配置漂移对比 | 比较默认配置、用户配置、环境变量、运行时覆盖。 | 不泄露 secret。 |
| P1 | `Package Script Intent Catalog` package scripts 意图目录 | 解释 build/test/benchmark/release 脚本各自用途和风险。 | 不替用户执行高风险脚本。 |
| P1 | `Monorepo Owner Radar` monorepo owner 雷达 | 多包仓库中找到真正 owner、入口和测试。 | 不用文件夹名替代 import/use。 |
| P1 | `Build Cache Diagnosis` 构建缓存诊断 | 判断慢构建来自依赖、缓存、TS/Bun、生成物还是 IO。 | 性能数据必须真实测量。 |
| P1 | `Dependency Vulnerability Context` 依赖漏洞上下文 | 漏洞不只报 CVE，还判断是否在 DSXU runtime path。 | 不自动升级。 |
| P1 | `CLI Command Discoverability Map` CLI 可发现性地图 | 用户能从 help 看到常用命令、风险命令和 doctor 路径。 | help 文案必须与实际命令一致。 |
| P1 | `Help Text Truth Checker` help 文案真值检查 | 检查 README/help/doctor 与实际 flags、默认值、限制一致。 | 不写营销式虚假能力。 |
| P1 | `Doctor Recommendation Ranker` doctor 建议排序 | provider/key/env/cache/permission 问题按最可能原因排序。 | 不隐藏低概率但高风险问题。 |
| P1 | `First Failure Capture` 首次失败捕获 | 保留第一次失败的命令、错误和上下文，避免后续重跑覆盖根因。 | 原始日志 redaction 后落 artifact。 |
| P1 | `Retry Policy Explainer` retry 策略解释 | 模型/API/工具重试时解释原因、次数、退避和成本影响。 | 不无限重试。 |
| P1 | `Network Tool Risk Lens` 网络工具风险镜 | 外部访问前说明域名、目的、隐私、失败 fallback。 | 网络结果不能替代本地 source truth。 |
| P1 | `File Watcher Change Journal` 文件变化日志 | 长任务期间记录用户/工具/生成物分别改了什么。 | 不 revert 用户改动。 |
| P1 | `Local Benchmark Sandbox` 本地 benchmark 沙箱 | benchmark 在隔离目录跑，避免污染主工作区。 | 不清理 evidence 目录。 |
| P1 | `Performance Regression Budget` 性能回归预算 | 为关键路径设定耗时、token、tool calls、cost 预算。 | 预算超出是风险，不代表功能失败。 |
| P1 | `Memory Growth Watch` 内存增长观察 | 长会话和大仓库任务观察内存/缓存增长。 | 只记录指标，不做侵入 profiler。 |
| P1 | `Token Budget Heatmap` token 预算热图 | 显示 system/source/tool/history 哪部分吃 token。 | 只用聚合统计，不保存敏感 prompt。 |
| P1 | `Prompt Section Profiler` prompt 分段剖析 | 分析 stable prefix、dynamic tail、tool results 对成本/cache 的影响。 | 不泄露完整 prompt。 |
| P1 | `Tool Latency Dashboard` 工具延迟面板 | 展示慢工具、失败工具、重试和 artifact 输出。 | UI 展示来自真实 event。 |
| P1 | `UI Blocking Operation Alert` UI 阻塞操作提醒 | 长命令/大文件/网络请求前显示预计风险和取消路径。 | 不阻断用户明确执行。 |
| P1 | `Terminal Session Bookmark` 终端会话书签 | 用户能回到关键命令、失败点、修复点和 artifact。 | 书签引用结构化 result pack。 |
| P1 | `Test Fixture Provenance` 测试 fixture 来源 | fixture 从哪里来、覆盖什么、是否过期可追踪。 | 不把隐私数据放 fixture。 |
| P1 | `Mock vs Real Boundary Checker` mock/real 边界检查 | 明确哪些测试是 mock，哪些是真实 API/TUI/terminal。 | mock 不能冒充 live evidence。 |
| P1 | `Golden Path Demo Builder` 黄金路径 demo 构建 | 生成最能展示 DSXU 价值的可复跑 demo。 | demo 必须可失败可复盘。 |
| P1 | `Edge Case Miner` 边界案例挖掘 | 从失败、issue、测试缺口中生成边界用例。 | 不堆无意义测试。 |
| P1 | `Error Recovery Playbook` 错误恢复手册 | 常见 provider/tool/test/env 失败给出修复路径。 | 进入 doctor/help，不替代真实修复。 |
| P1 | `Rollback Simulation` 回滚模拟 | 大变更前模拟如何撤销、保留证据、恢复测试。 | 不执行 destructive reset。 |
| P1 | `Patch Review Packetizer` 补丁审查包 | 把 diff、风险、测试、owner、evidence 打包给 reviewer。 | 不自动 approve。 |
| P1 | `Multi-Step Command Plan` 多步命令计划 | 一串命令前先展示依赖关系、失败分支和产物。 | 执行仍逐步记录 exit code。 |
| P1 | `Artifact Integrity Diff` artifact 完整性 diff | 对报告、图表、zip、trace 生成 hash 和差异摘要。 | 不把 artifact 当源码。 |
| P1 | `Log Redaction Verifier` 日志脱敏验证 | 扫描 logs/evidence/report 是否含 key、token、私有路径。 | release gate 必跑。 |
| P1 | `Provider Cost Forecast` provider 成本预测 | 执行前估算 token/cost/cache，执行后对比真实值。 | 预测不作为卖点。 |
| P1 | `Pro Escalation Review Board` Pro 升级审查板 | 汇总每次 Pro admission 的原因、收益、成本和是否必要。 | 默认 Flash，不把 Pro 作为常规路径。 |
| P1 | `Flash Quality Drift Monitor` Flash 质量漂移监控 | 同题周期性跑 Flash，发现质量下降或路由误判。 | 不用单次失败否定模型。 |
| P1 | `JSON Schema Repair Loop` JSON schema 修复闭环 | 模型 JSON 输出坏时自动解释 schema 错误并重试。 | 重试次数和成本可见。 |
| P1 | `Tool Schema Compatibility Audit` 工具 schema 兼容审计 | tool input/output schema 变更影响 query/agent/MCP。 | 不破坏现有 tool contracts。 |
| P1 | `MCP Version Negotiation Matrix` MCP 版本协商矩阵 | 不同 MCP server 能力、版本、权限、fallback 可见。 | MCP 仍走 DSXU registry。 |
| P1 | `Skill Capability Shadow Map` skill 能力遮蔽图 | 检查技能间命名、优先级、权限冲突。 | 二级技能不能覆盖主链。 |
| P1 | `Plugin Trust Score` 插件信任评分 | 基于权限、命令、网络、维护状态给插件风险分。 | 不做绝对安全承诺。 |
| P1 | `Browser Action Safety Plan` 浏览器动作安全计划 | 浏览器操作前说明页面、点击、输入、隐私和截图证据。 | 不操作未授权账号/数据。 |
| P1 | `GUI Test Screenshot Index` GUI 测试截图索引 | UI 测试产生截图、步骤、断言和失败点索引。 | 截图不含敏感信息。 |
| P1 | `External API Rate Limit Planner` 外部 API 限流规划 | 对 DeepSeek/MCP/外部 API 的 rate limit 和 retry 做计划。 | 不绕过平台限制。 |
| P1 | `Long Task Milestone Reporter` 长任务里程碑报告 | 长任务每个阶段输出进度、证据、剩余 gate 和风险。 | 不用空进度代替真实推进。 |
| P2 | `Maintainer Onboarding Playbook` 维护者上手手册 | 新维护者能理解主链、证据、发布、权限和测试。 | 文档必须随代码证据更新。 |
| P2 | `Contributor Task Triage` 贡献任务分诊 | 把 issue/PR 分成 good first issue、bug、feature、release gate。 | 不自动指派人。 |
| P2 | `Issue-to-Test Pipeline` issue 到测试流水线 | 用户报 bug 后生成复现、测试、修复、回归路径。 | 不能伪造复现。 |
| P2 | `PR Review Evidence Bot` PR 证据机器人 | PR 自动汇总 touched owner、tests、risk、claim impact。 | 不自动合并。 |
| P2 | `Release Note Truth Sync` release note 真值同步 | release note 只写已验收能力和真实风险。 | 不写夸张营销句。 |
| P2 | `Roadmap Claim Boundary` roadmap 声明边界 | 区分已完成、实验中、路线图、不会做。 | roadmap 不进 PASS。 |
| P2 | `Demo Dataset Curator` demo 数据集整理 | 选择能展示 DSXU 价值且可公开的数据。 | 不含私密代码/secret。 |
| P2 | `Public Metrics Dashboard` 公开指标面板 | 展示成本、cache、成功率、失败恢复、测试覆盖趋势。 | 指标必须可复跑。 |
| P2 | `Docs Example Runner` 文档示例运行器 | README/docs 中命令和示例定期真实运行。 | 示例失败要阻断发布文案。 |
| P2 | `Tutorial Failure Recovery` 教程失败恢复 | 新手教程中故意失败一次，展示 DSXU 修复能力。 | 失败要真实可复现。 |
| P2 | `Multi-Language Repo Guide` 多语言仓库指南 | JS/TS/Python/Go/Rust 等仓库如何 probe/test/build。 | 先从已有 repo evidence 推导。 |
| P2 | `Windows macOS Linux Parity Board` 跨平台一致性板 | 明确 Windows/PowerShell 与 Unix shell 差异和测试状态。 | 不声明未测试平台。 |
| P2 | `Enterprise Policy Adapter` 企业策略适配 | 让企业配置禁用网络、限制工具、指定 provider。 | 只是 policy layer，不改核心 runtime。 |
| P2 | `Audit Log Exporter` 审计日志导出 | 导出结构化审计日志供企业/开源维护者复核。 | 默认 redaction。 |
| P2 | `Privacy Redaction Policy Editor` 隐私脱敏策略编辑 | 用户可配置路径、环境变量、日志字段的脱敏规则。 | 不能降低默认安全。 |
| P2 | `Offline Evidence Review` 离线证据审查 | 没有 API 时仍可审查已有 trace/report/source。 | 不生成模型新结论。 |
| P2 | `Community Skill Marketplace Contract` 社区技能市场契约 | 第三方 skill 如何声明能力、权限、版本、冲突。 | DSXU registry 统一治理。 |
| P2 | `Integration Certification Pack` 集成认证包 | 外部 adapter 必须通过权限、成本、secret、fallback smoke。 | 不背书第三方产品。 |
| P2 | `Plugin Regression Farm` 插件回归农场 | 多插件组合时跑冲突/权限/性能回归。 | 只针对用户安装插件。 |
| P2 | `Cross-Provider Comparison Harness` 跨 provider 对比 harness | 同题比较 DeepSeek Flash/Pro 和其它可选 provider 的成本/质量。 | 默认 DeepSeek；外部 provider 只作用户配置。 |
| P2 | `Local Model Adapter Boundary` 本地模型适配边界 | 本地模型可作为实验 provider，但不绕过 DSXU route/cost/evidence。 | 不影响 DeepSeek-first 主定位。 |
| P2 | `Self-Hosted Runner Guide` 自托管 runner 指南 | 开源用户能在自己机器复跑 benchmark/demo。 | 不附带用户 key。 |
| P2 | `Telemetry Opt-In Center` telemetry opt-in 中心 | 用户明确选择是否上传匿名指标。 | 默认本地，不强制上传。 |
| P2 | `Accessibility Review Assistant` 可访问性审查助手 | TUI/UI 的可读性、键盘操作、颜色对比进入验收。 | 先做本地检查和截图证据。 |
| P2 | `Internationalization Smoke` 多语言 smoke | 中文/英文输出、错误、help、README 关键路径可用。 | 不做低质量机翻发布。 |
| P2 | `License Compliance Evidence` 许可证合规证据 | 开源发布前检查依赖许可证、参考机制非复制、品牌风险。 | 不提供法律意见，只做证据清单。 |
| P2 | `Patent Brand Risk Scanner` 专利/品牌风险扫描 | 检查文案、命名、代码是否误用参考品牌或商业实现。 | 只做风险提示。 |
| P2 | `Security Threat Model Lite` 轻量威胁模型 | 对 key、tool execution、MCP、browser、artifact 做 threat model。 | 高风险进入 release blocker。 |
| P2 | `Disaster Recovery Drill` 灾难恢复演练 | 模拟 evidence 丢失、API 失败、工作区混乱后的恢复。 | 不使用 destructive git reset。 |
| P2 | `Capability Portfolio Scoring` 能力组合评分 | 按用户价值、实现状态、验收成本、卖点价值给能力排序。 | 排序不代表已完成。 |

#### 9.19.6 1902 反向机制千项场景 Backlog - 2026-05-16

用户要求继续试探“是否还能扩展到 1000 个”。裁决：`1000` 个独立大功能不合理，但 `1000` 个可筛选的机制吸收微场景/验收场景合理。V26 不把主文档塞成 1000 行，而是生成结构化附录，后续按 P0/P1/P2、owner 和 evidence gate 筛选执行。

已生成稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `scripts/dsxu-reference-scenario-backlog.ts` | 20 个机制域 × 10 个角色视角 × 5 个任务阶段，生成 1000 个 DSXU-owned 候选场景。 | `bun build scripts/dsxu-reference-scenario-backlog.ts --target=bun` PASS。 |
| `bun run reference:scenario-backlog` | 生成千项 backlog JSON/CSV/Markdown。 | `PASS_DSXU_REFERENCE_SCENARIO_BACKLOG_GENERATED`，`totalRows=1000`。 |
| `docs/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.md` | 人读版完整 1000 行附录。 | 只作为候选池，不作为完成 claim。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.json` | 机器可读执行池。 | `P0=220`、`P1=360`、`P2=420`。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.csv` | 可筛选表格。 | 用于后续 owner/evidence 分批执行。 |

千项 backlog 的构成：

| 轴 | 数量 | 示例 |
|---|---:|---|
| mechanism areas | 20 | Goal Contract、Source Truth、Impact、Tool Lifecycle、Permission、Terminal、Failure、Verification、Context/Cache、Model/Cost、Visible State、Agent、MCP/Skill、Provider Health、Workspace Hygiene、Release Evidence、Benchmark、Security、Open Source、External Adapter。 |
| role lenses | 10 | senior feature engineer、debugging engineer、technical lead、terminal operator、release owner、security reviewer、performance engineer、ecosystem integrator、new user operator、maintainer reviewer。 |
| phase patterns | 5 | preflight/plan、execution/action、failure/diagnosis、recovery/retry、proof/release evidence。 |

执行规则：

1. 千项 backlog 是候选池，不是 1000 个完成项，也不是公开卖点。
2. 执行前必须先查现有 DSXU owner：能合并就合并，不能形成第二套 runtime、第二套 permission、第二套 provider、第二套 MCP/skill 编排。
3. P0 只代表优先分析，不代表马上全做；仍按当前硬顺序先补 `19` 个 V18/70 真实验收缺口，再做 P0 场景筛选。
4. public claim 只能从 strict evidence 中来；千项 backlog 不能直接进入 README 卖点。
5. DeepSeek 调度仍是 Flash-first；Pro 需要明确 admission evidence。

### 9.20 V26 千项场景极限判断与 DSXU owner 收敛审计 - 2026-05-16

本节回答“1000 是不是极限、是否还需要继续更深”。裁决如下：

1. `1000` 不是理论极限。只要继续增加角色、阶段、机制域、验收模式，就可以生成 `2000/5000/10000` 个组合。
2. 但 `1000` 已经进入实用饱和区。继续堆数量会让大量场景只是同一机制的换角色/换阶段表达，发现新主线的收益很低。
3. 对 DSXU 当前目标而言，更深的意义不是继续扩表，而是把 `1000` 行合并到现有 owner、现有缺口和真实验收路径里。
4. 因此 V26 后续不再追求更多行数；后续追求的是 `P0 220` 行的 owner 收敛、重复合并、真实代码/测试/live evidence。

#### 9.20.1 千项 Backlog 分布

`docs/generated/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.json` 最新事实：

| total | P0 | P1 | P2 | mechanism areas | roles | phases |
|---:|---:|---:|---:|---:|---:|---:|
| 1000 | 220 | 360 | 420 | 20 | 10 | 5 |

按机制类：

| class | rows | 收敛判断 |
|---|---:|---|
| cognitive-workflow | 200 | 已有 DSXU 主链 owner；重点是 source capsule、goal invariant、failure recovery 的真实窗口证明。 |
| execution-boundary | 350 | 已有 Tool/Permission/Agent/MCP/External 边界 owner；重点是不能形成第二套 runtime。 |
| trust-and-visibility | 350 | 已有 work-state、release、benchmark、open-source owner；重点是公开 claim 与真实 evidence 同源。 |
| deepseek-runtime | 100 | 已有 route/cost/cache owner；重点是 Flash-first、route latch、cache attribution 和 Pro admission。 |

#### 9.20.2 DSXU 当前 owner 覆盖审计

本轮用 `rg --files src/dsxu/engine` 和 `rg --files src/dsxu/engine/__tests__` 对 1000 行所需 owner 做覆盖审计。结论：20 个机制域都有 DSXU 现有 owner 文件或测试入口，不需要新增第二套主链。

| backlog area | DSXU owner 状态 | 代表性文件/测试 | 裁决 |
|---|---|---|---|
| Goal Contract / Stop Conditions | 已有主链 | `src/query.ts`、`src/QueryEngine.ts`、`src/dsxu/engine/work-state-timeline.ts` | 合并进 Query loop / PlanGraph。 |
| Source Truth / Capsule | 已推广到常规 code-mode | `src/dsxu/engine/code-mode-surgical-loop.ts`、`src/dsxu/engine/__tests__/code-mode-source-cache-governor.test.ts`、`DSXU_SOURCE_CACHE_ACCEPTANCE_20260516` | 见 9.24：source capsule、Read fallback governor、Impact Radar、Evidence-Driven Review 已有 PASS 证据；后续随最终六阶段回归。 |
| Impact / Blast Radius | 已有证据基础 | `context-owner-rule-v1.ts`、`product-runtime-owner-map-v1.test.ts` | 合并到 owner map / import-use evidence。 |
| Tool Lifecycle / Causality | 已有主链 | `tool-gate-v1.ts`、`tool-mainline-runtime-v1.ts`、`tool-lifecycle-contract-v1.test.ts` | 不新增 tool runtime。 |
| Permission / Human Signoff | 已有主链 | `permissions.ts`、`permission-usability.ts`、`permissions.test.ts` | 不新增 permission bridge shortcut。 |
| Terminal / Shell Reliability | 代码、测试和 terminal/TUI live evidence 已补 | `code-terminal-runner.ts`、`tui-terminal-reliability-pack-v1.test.ts`、`DSXU_TERMINAL_LIVE_ACCEPTANCE_20260516` | 已由 9.22 关闭 live 阻断；B12/B13 保持边界声明。 |
| Failure / Repair Loop | 已有主链 | `failure-taxonomy.ts`、`controlled-failure-taxonomy.ts`、`controlled-failure-taxonomy.test.ts` | 需要真实失败恢复窗口回测。 |
| Test Selection / Verification | 已有主链 | `release-test-gate.ts`、`VerificationKernel` 相关测试、`benchmark-readiness.test.ts` | 聚合到测试选择和六阶段最终测试。 |
| Context / Cache Hygiene | 已接 code-mode source/cache acceptance | `prompt-prefix-cache-builder.ts`、`route-cache-dynamic-tail.ts`、`code-mode-source-cache-governor.test.ts` | Read fallback governor 已完成；仍需 EP-05 public challenge ablation 证明真实成本/质量趋势。 |
| Model Route / Cost Evidence | 已有主链 | `deepseekV4Control.ts`、`deepseekV4CostRouter.ts`、`deepseek-trajectory-store.ts` | 继续保持 Flash-first 和 route latch。 |
| Visible Work-State Projection | 已有主链 | `work-state-timeline.ts`、`work-state-timeline.test.ts` | 继续接 Tool/Permission/Agent/MCP evidence。 |
| Agent / Worker Handoff | 已有主链，claim-limited | `forked-agent.ts`、`subagent-protocol.ts`、`agent-parent-final-gate-replay-v1.test.ts` | 补 worker evidence envelope。 |
| MCP / Skill Ecosystem | 已有主链 | `skills-registry-v1.ts`、`skill-governance-v1.ts`、`mcp-client.test.ts` | 补 priority/conflict/live evidence。 |
| Provider Health / First Run | 已有主链 | `doctor.ts`、`live-provider-gate-v1.test.ts`、`wave5-doctor.test.ts` | release 前重跑 no-key/key/doctor smoke。 |
| Workspace Hygiene / Dirty Attribution | 已有策略 | `workspace-policy.ts`、owner/Git packet scripts | 不自动 clean；只走 owner/Git review。 |
| Release Evidence / Claim Guard | 已有主链 | `release-provenance-gate.ts`、`release-surface-source-policy-review-v1.ts` | 继续严格 claim guard。 |
| Benchmark / Public Challenge Proof | 已有主链，仍缺外部 raw | `benchmark-readiness.ts`、`raw-evidence-readiness-register-v1.ts` | 不能宣称外部胜出。 |
| Security / Privacy / Secret Safety | 已有 release gate 基础 | `open-source-package-gate.ts`、release/secret scan scripts | release/export 前必须扫描。 |
| Open Source Product / Maintainer Flow | 已有主线 | `open-source-core.ts`、`open-source-package-gate.ts` | GitHub pack 只写真实证据。 |
| External Adapter / IDE / Browser Boundary | 有边界代码，仍需 live smoke | `adapters/external-tool-adapter.ts`、`external-integration-owner.test.ts` | 只做 adapter boundary，不做第二 runtime。 |

#### 9.20.3 与 V26 已记录缺口合并后的执行包

1000 行不应该产生 1000 个任务。合并后只保留 `8` 个执行包：

| packet | 吸收来源 | 当前状态 | 下一步 |
|---|---|---|---|
| `EP-01 Source Truth + Cache` | Source Truth、Context/Cache、Model Route、Benchmark | 已在 9.24 推广到常规 code-mode；Impact Radar/Evidence-Driven Review 已接同一 owner | 后续只随最终六阶段回归；DeepSeek 成本质量转入 EP-05 ablation。 |
| `EP-02 Visible State + Tool/Permission` | Visible State、Tool Lifecycle、Permission、Side-effect Ledger | timeline 基线已完成 | 把 Tool/Permission/Agent/MCP evidence 全部投影到同一 timeline。 |
| `EP-03 Terminal Live Acceptance` | Terminal、Failure、Verification、Provider Health | 已在 9.22 补真实 terminal/TUI live evidence；B12/B13 保留边界 claim | 后续只随最终六阶段回归，不再作为 live 阻断。 |
| `EP-04 Agent/MCP/Skill Boundary` | Agent、MCP/Skill、External Adapter | 有实现和测试，但 claim-limited | 补 worker evidence envelope、skill priority/conflict、MCP doctor smoke。 |
| `EP-05 DeepSeek Cost Quality` | Model Route、Context Cache、Provider Health、Performance | Flash-first 成本路线已通，cache 有真实优化趋势 | 做 before/after ablation 和 Cost Quality Pareto Board。 |
| `EP-06 Release Claim + Open Source` | Release Evidence、Security、Open Source、README Claim Linter | release evidence 基线已通，public 90 claim 未达 | 重建 GitHub launch pack，只写真实卖点和图表。 |
| `EP-07 Workspace/Owner/Git Hygiene` | Workspace Hygiene、Impact、Owner Boundary、Duplicate Merger | owner map 有基础，dirty/review 仍需流程签收 | 用 owner/Git packets 处理，不自动 stage/delete。 |
| `EP-08 External Benchmark/Adapter Proof` | Benchmark Pairing、External Adapter、IDE/API、Browser/GUI | 当前仍缺同题 target raw 和 live smoke | 只做 adapter smoke 与 target manifest intake，不宣称胜出。 |

#### 9.20.4 最终裁决

- 不建议继续扩到 2000+。可以做到，但大多数会变成组合膨胀，对达到 90% 编程/复杂任务能力没有直接帮助。
- 当前最有意义的是从 `P0=220` 里筛到上述 `8` 个执行包，再回到 `19` 个 V18/70 真实验收缺口。
- DSXU 当前不是缺“想法数量”：常规 code-mode source capsule/Read fallback/Impact Radar/Evidence-Driven Review 已在 9.24 补证据；剩余硬缺口转为 public challenge ablation、target raw、agent/MCP evidence envelope 和 GitHub claim 数据重建；terminal reliability demo 已在 9.22 补证据。
- 所以 V26 后续硬顺序不变：先处理问题，再测试；先 owner 合并，再实现；先真实证据，再公开卖点。

#### 9.20.5 更新后的执行顺序

1. `EP-02 Visible State + Tool/Permission`：Tool/Permission/Agent/MCP evidence 同源 timeline。
2. `EP-05 DeepSeek Cost Quality`：public challenge ablation 与成本质量帕累托。
3. `EP-04 Agent/MCP/Skill Boundary`：worker envelope、skill priority/conflict、MCP doctor smoke。
4. `EP-08 External Benchmark/Adapter Proof`：target manifest、external adapter live smoke。
5. `EP-06 Release Claim + Open Source`：README/GitHub 图表/claim guard 重建。
6. `EP-07 Workspace/Owner/Git Hygiene`：owner/Git packets，不自动 clean。
7. `EP-01 Source Truth + Cache`：只随最终六阶段回归，不再作为当前实现阻断。
8. 最后再跑 30-45 分钟 senior-coding window、六阶段最终测试、clean export、fresh install smoke。

### 9.21 V26 174 + 1000 场景合并执行记录 - 2026-05-16

本节把 9.19.5 的 `174` 个反向吸收场景、9.19.6 的 `1000` 个机制吸收 backlog、以及 67/82 能力验收缺口合并成可执行收敛板。目标是执行 EP 包，不再扩展数量。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `scripts/dsxu-reference-scenario-convergence.ts` | 读取 V26 174 场景、1000 backlog、capability acceptance audit，合并到 8 个执行包。 | `bun build scripts/dsxu-reference-scenario-convergence.ts --target=bun` PASS。 |
| `bun run reference:scenario-convergence` | 生成合并执行板。 | `PASS_DSXU_REFERENCE_SCENARIO_CONVERGENCE_GENERATED`。 |
| `docs/DSXU_REFERENCE_SCENARIO_CONVERGENCE_20260516.md` | 人读版 8 包执行板。 | `sourceRows=1174`，`rowsFrom174=174`，`rowsFrom1000=1000`。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_CONVERGENCE_20260516.json` | 机器可读执行板。 | `P0=257`、`P1=451`、`P2=466`。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_CONVERGENCE_20260516.csv` | 可筛选表格。 | 用于后续 owner/evidence 分批执行。 |

合并结果：

| packet | status | 174 rows | 1000 rows | P0 | P1 | P2 | capability gaps | 下一步 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `EP-01 Source Truth + Cache` | accepted-core | 61 | 150 | 72 | 94 | 45 | 0 | 9.24 已完成常规 code-mode source capsule、Read fallback governor、Impact Radar、Evidence-Driven Review；后续随最终六阶段回归。 |
| `EP-02 Visible State + Tool/Permission` | ready-for-execution | 14 | 189 | 83 | 81 | 39 | 0 | Tool/Permission/Agent/MCP evidence 进入同一 work-state timeline。 |
| `EP-03 Terminal Live Acceptance` | ready-for-execution | 15 | 151 | 62 | 72 | 32 | 2 | 已补 B01/B02/B03/B05/B06/B08/B09/B10/B11/B14 live evidence；B12/B13 只保留 boundary claim。 |
| `EP-04 Agent/MCP/Skill Boundary` | ready-for-execution | 12 | 100 | 0 | 48 | 64 | 1 | 补 PZ07 agent fanout/coordinator 的 evidence envelope。 |
| `EP-05 DeepSeek Cost Quality` | ready-for-execution | 28 | 100 | 26 | 57 | 45 | 2 | 补 M07 FIM 小编辑 lane 与 A14 Pro reviewer admission 的边界/live 证据。 |
| `EP-06 Release Claim + Open Source` | ready-for-execution | 21 | 155 | 3 | 49 | 124 | 0 | GitHub launch pack 只引用真实 strict claims 和真实图表。 |
| `EP-07 Workspace/Owner/Git Hygiene` | needs-owner-review | 13 | 50 | 6 | 25 | 32 | 0 | 继续 owner/Git packets，不自动 stage/delete/clean。 |
| `EP-08 External Benchmark/Adapter Proof` | needs-live-evidence | 10 | 105 | 5 | 25 | 85 | 4 | 补 A16/E02/A17/PZ03 的真实评测、browser/adapter smoke 和 target manifest 边界。 |

owner 覆盖裁决：

- 8 个 EP 包的代表性 source 文件和 test 文件均存在；当前不是缺 owner，而是缺 live/evidence/claim 收口。
- 174 + 1000 合并后不产生新主链，不新增 runtime，不新增 permission/provider/MCP/skill 编排。
- 后续执行以 EP 包为单位；不能按 1174 行逐项开坑。

focused 验证：

| command | 结果 | 覆盖 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/context-hygiene-v1.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts src/dsxu/engine/__tests__/permissions.test.ts src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts src/dsxu/engine/__tests__/code-terminal-runner.test.ts src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/open-source-package-gate.test.ts` | `78 pass / 0 fail / 537 expect()` | EP-01 source/cache、EP-02 visible-state/tool/permission、EP-03 terminal baseline、EP-04 agent/skill、EP-05 DeepSeek route、EP-06 open-source gate。 |

当前硬顺序更新：

1. `EP-02 Visible State + Tool/Permission`：同源 timeline 投影。
2. `EP-05 DeepSeek Cost Quality`：FIM/Pro admission、public challenge ablation、成本质量图。
3. `EP-04 Agent/MCP/Skill Boundary`：agent evidence envelope 与 skill priority/conflict。
4. `EP-08 External Benchmark/Adapter Proof`：target manifest、browser/adapter smoke，不宣称外部胜出。
5. `EP-06 Release Claim + Open Source`：GitHub launch pack 重建。
6. `EP-07 Workspace/Owner/Git Hygiene`：owner/Git review packets。
7. `EP-01 Source Truth + Cache`：只随最终六阶段回归。
8. 最后进入 30-45 分钟 senior-coding window、六阶段最终测试、clean export、fresh install smoke。

### 9.22 EP-03 Terminal Live Acceptance 执行记录 - 2026-05-16

本节执行 9.21 的第一硬顺序：`EP-03 Terminal Live Acceptance`。目标不是再补单元测试，而是补真实 terminal/TUI/live evidence，并让 B01-B14 回到能力验收表。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `scripts/dsxu-terminal-live-acceptance.ts` | 跑真实 TUI terminal pack + 10 个内部 terminal live cases，输出 B01-B14 能力签收。 | `bun build scripts/dsxu-terminal-live-acceptance.ts --target=bun` PASS。 |
| `bun run terminal:live-acceptance` | 执行 EP-03 live acceptance。 | `PASS_TERMINAL_LIVE_ACCEPTANCE`，`capabilities=12`，`internalCases=10`。 |
| `docs/DSXU_TERMINAL_LIVE_ACCEPTANCE_20260516.md` | 人读版 terminal live acceptance。 | 记录 B01/B02/B03/B05/B06/B08/B09/B10/B11/B14 为 `implemented+live-evidenced`；B12/B13 为 `boundary+live-evidenced`。 |
| `docs/generated/DSXU_TERMINAL_LIVE_ACCEPTANCE_20260516.json` | 机器可读验收结果。 | `terminalLiveAcceptance=true`，`terminalBench2ClaimAllowed=false`，`internalTerminalSubsetClaimAllowed=true`。 |
| `.dsxu/trace/terminal-live-acceptance-20260516/` | raw terminal/TUI evidence。 | 包含 `tui-terminal-reliability-pack.json`、`terminal-reliability-replay.trace.json`、`terminal-live-artifact.json`、`terminal-long-output.log`、toolchain/permission/dev-server traces。 |

能力签收：

| id | capability | status | 边界 |
|---|---|---|---|
| B01 | ShellStateManager | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B02 | EnvironmentProbe | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B03 | CommandPlanner | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B05 | OutputSummarizer | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B06 | FileSystemState | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B08 | ScriptSynthesizer | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B09 | Terminal FailureRepairLoop | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B10 | TimeoutGuard | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B11 | ArtifactChecker | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |
| B12 | TerminalBench Subset Adapter | `boundary+live-evidenced` | 只允许写 DSXU terminal subset adapter；不能写 Terminal-Bench 2.0 PASS。 |
| B13 | Internal Terminal-10/30 Runner | `boundary+live-evidenced` | 只允许写 internal Terminal-10 style live smoke；Terminal-30/public score 仍 gated。 |
| B14 | TerminalResultPackager | `implemented+live-evidenced` | DSXU-owned terminal live evidence。 |

重跑 `bun run capability:acceptance-audit` 后新口径：

| total | historical PASS | implemented+tested | live-window-needed | adapted/subset | eval-coordinate | deferred | strict public claim | DSXU suitable |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 82 | 70 | 58 | 1 | 8 | 3 | 12 | 37 | 67 |

裁决：

- EP-03 已从 `needs-live-evidence` 推进到 `ready-for-execution`；剩余 B12/B13 是边界声明，不是 live 阻断。
- `liveWindowNeededRows` 从 `11` 降到 `1`，剩余唯一项是 `E02 Ablation Runner`，归到 `EP-08 External Benchmark/Adapter Proof`。
- 仍不能写 Terminal-Bench 2.0 PASS、Terminal-30 PASS 或外部 benchmark 胜出。

收敛板同步：

| packet | status | capability gaps |
|---|---|---|
| `EP-03 Terminal Live Acceptance` | `ready-for-execution` | `B12/B13` boundary-only。 |
| `EP-08 External Benchmark/Adapter Proof` | `needs-live-evidence` | `A16/E02/A17/PZ03`。 |

下一硬顺序改为：

1. `EP-02 Visible State + Tool/Permission`：Tool/Permission/Agent/MCP evidence 同源 timeline。
2. `EP-05 DeepSeek Cost Quality`：FIM/Pro admission、public challenge ablation、成本质量图。
3. `EP-04 Agent/MCP/Skill Boundary`：agent evidence envelope 与 skill priority/conflict。
4. `EP-08 External Benchmark/Adapter Proof`：A16/E02/A17/PZ03、target manifest、browser/adapter smoke。
5. `EP-01 Source Truth + Cache`：只随最终六阶段回归。

### 9.23 V26 当前执行顺序总表 - 2026-05-16

1. `EP-01 Source Truth + Cache`：已在 9.24 完成常规 code-mode source capsule、Read fallback governor、Impact Radar、Evidence-Driven Review；后续只做最终回归。
2. `EP-02 Visible State + Tool/Permission`：下一硬动作。Tool/Permission/Agent/MCP evidence 同源投影，避免 final report 与 TUI/CLI 状态分裂。
3. `EP-05 DeepSeek Cost Quality`：M07 FIM 小编辑 lane、A14 Pro reviewer admission、public challenge ablation、成本质量图。
4. `EP-04 Agent/MCP/Skill Boundary`：PZ07 agent fanout/coordinator 的 evidence envelope、MCP/Skill priority/conflict。
5. `EP-08 External Benchmark/Adapter Proof`：A16/E02/A17/PZ03 的真实评测、browser/adapter smoke、target manifest；不宣称外部胜出。
6. `EP-06 Release Claim + Open Source`：GitHub launch pack、README claim linter、产品卖点图表，只引用真实 strict claims。
7. `EP-07 Workspace/Owner/Git Hygiene`：owner/Git packets，不自动 stage/delete/clean。
8. 最后跑 30-45 分钟真实 senior-coding window、public challenge ablation 汇总、六阶段最终测试、clean export、fresh install smoke。

### 9.24 EP-01 Source Truth + Cache 执行记录 - 2026-05-16

本节执行 9.23 的 `EP-01 Source Truth + Cache`。目标不是再做一个 context runtime，而是把 public challenge 已验证的 source capsule/no-Read 思路推广到常规 code-mode，并把 Impact Radar、Evidence-Driven Review 绑定到同一个 code-mode owner。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/code-mode-surgical-loop.ts` | 在原 code-mode owner 内新增 `sourceTruthCapsules`、`readFallbackPolicy`、`buildDSXUCodeSourceTruthCapsules`、`decideDSXUReadFallback`、`buildDSXUCodeImpactRadar`、`buildDSXUEvidenceDrivenReview`。 | 不新增第二套 query/context/review runtime；仍由 code-mode surgical loop 和现有 `blast-radius.ts` owner 承担。 |
| `src/tools/FileReadTool/prompt.ts` | Read 工具补充 code-mode cache hygiene 纪律：有 source capsule 时 Read 只能作为大文件 fallback，必须 anchor/range bounded。 | 同一 Read owner 提示，不新增工具。 |
| `src/dsxu/engine/__tests__/code-mode-source-cache-governor.test.ts` | 覆盖 source capsule、Read fallback governor、stable prefix、Impact Radar、Evidence-Driven Review。 | `5 pass / 0 fail`。 |
| `scripts/dsxu-source-cache-acceptance.ts` | 生成 EP-01 source/cache acceptance 证据。 | `bun build scripts/dsxu-source-cache-acceptance.ts --target=bun` PASS；`bun run source:cache-acceptance` -> `PASS_SOURCE_CACHE_ACCEPTANCE`。 |
| `docs/DSXU_SOURCE_CACHE_ACCEPTANCE_20260516.md` | 人读版 EP-01 证据。 | `capsules=2`、`rawChars=23169`、`packedChars=1360`、`toolResultCharsAvoided=21809`、`compressionRatio=0.059`、`stablePrefixHashUnchanged=true`。 |
| `docs/generated/DSXU_SOURCE_CACHE_ACCEPTANCE_20260516.json` | 机器可读 EP-01 证据。 | full Read 被 `BLOCK_FULL_FILE_READ`；未定位 range Read 被 `BLOCK_UNLOCATED_LARGE_READ`；定位后的 bounded range Read 被 `ALLOW_BOUNDED_READ`；over-budget range 被 `BLOCK_OVER_BUDGET_READ`。 |

能力裁决：

| capability | status | 证据 |
|---|---|---|
| Source Capsule for Code Mode | `implemented+tested+accepted` | `path/hash/lineCount/anchors/excerptBudget/riskTags/fallbackReadPolicy` 已进入 `DSXUCodeContextPack`。 |
| Read Fallback Governor | `implemented+tested+accepted` | 大文件禁止全文 Read；range Read 需要 locator/source-capsule anchor；单次 fallback 受 `maxLinesPerRead=160` 与 `maxApproxTokensPerRead=8000` 约束。 |
| Cache-Safe Prefix Layout | `implemented+tested+accepted` | source capsule 可放 stable prefix；动态任务变化只改变 dynamic tail hash。源码 `sha256` 不再被误判为 random volatile id。 |
| Impact Radar | `implemented+tested+accepted` | 复用 `blast-radius.ts` 的依赖图和 affected tests，输出 recommended focused verification。 |
| Evidence-Driven Review | `implemented+tested+accepted` | review finding 必须绑定 capsule id、path、line、risk、verification；失败 verification 会阻断 PASS。 |

focused 验证：

| command | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/code-mode-source-cache-governor.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/file-read-cache-progress-v1.test.ts src/dsxu/engine/__tests__/blast-radius.test.ts` | `35 pass / 0 fail / 126 expect()` |
| `bun run source:cache-acceptance` | `PASS_SOURCE_CACHE_ACCEPTANCE` |

### 9.26 EP-05 DeepSeek Cost Quality 执行记录 - 2026-05-16

本节执行 `EP-05 DeepSeek Cost Quality`。目标不是把 DeepSeek 成本写成宣传口号，而是把 Flash-first、thinking/non-thinking、Pro admission、cache hit/miss、cost-per-solved-task、public challenge 分数边界放进同一张可复核 Pareto board。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/deepseek-cost-quality-board.ts` | 纯裁决模块：汇总 scenario、turn、Flash/Pro route mix、cache hit/miss/output tokens、actual cost、Pro-only baseline、savings、Pro admission violations、public 90/cache claim boundary。 | 不调 provider，不执行工具，不创建第二 router。 |
| `src/dsxu/engine/__tests__/deepseek-cost-quality-board.test.ts` | 验证 Flash-first cost claim、Pro admission claim、public 90 阻断、high cache ROI 阻断、无证 Pro usage 阻断。 | `2 pass / 0 fail`。 |
| `scripts/dsxu-deepseek-cost-quality-acceptance.ts` | 生成 EP-05 cost-quality acceptance；读取 public challenge 证据，合并 controlled local harness route/cache evidence 和 live provider cache prefix smoke（若存在）。 | `bun run deepseek:cost-quality` -> `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE`。 |
| `docs/DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_20260516.md` | 人读版成本质量裁决板。 | `flashTurnRatioPct=90`、`savingsVsProOnlyPct=63.6`、`cacheHitRatePct=74.5`、`public90ClaimAllowed=false`、`cacheHighRoiClaimAllowed=false`。 |
| `docs/generated/DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_20260516.json/csv` | 机器可读/表格版 evidence。 | 4 scenarios：controlled Pro rescue、Flash-only feature、public challenge Flash review、live provider cache prefix smoke。 |
| `package.json` | 新增稳定脚本 `deepseek:cost-quality` 与 `evidence:deepseek-cost-quality`。 | 后续 release evidence 可直接重跑。 |

能力裁决：

| capability | status | 证据 |
|---|---|---|
| Flash-first route/cost claim | `implemented+tested+accepted` | 10 turns 中 90% 为 Flash/Flash-MAX；actual cost `$0.014807454` vs Pro-only `$0.040681157`，节省 `63.6%`。 |
| Pro admission discipline | `implemented+tested+accepted-with-boundary` | Pro 只允许作为 evidence rescue path：必须有 prior Flash attempt、admission reason、saved-task evidence；无证 Pro 会被 board 阻断。 |
| Cache hit/cost evidence | `implemented+tested+trend-only` | aggregate cache hit `74.5%`，但 public challenge lane 为 `65.4% < 70`，所以 GitHub 只能写 observed metric / optimization trend，不写 high cache ROI claim。 |
| Public 90 ability claim | `blocked-by-evidence` | 当前 public challenge scoreFloor 仍为 `72`；不能宣称对标 GPT-5.5 / Claude 4.7 编程复杂任务能力 90%。 |
| Route/cost/cache owner unity | `implemented+tested+accepted` | `deepseekV4Control`、`deepseekV4CostRouter`、`DeepSeekAdapter`、`DeepSeekTrajectoryStore`、`final-report-usage-evidence` 和 board 走同一 V4 route/cost 口径。 |

focused 验证：

| command | 结果 |
|---|---|
| `bun build src/dsxu/engine/deepseek-cost-quality-board.ts --target=bun --outdir .dsxu/trace/deepseek-cost-quality-board-build-check` | PASS |
| `bun build scripts/dsxu-deepseek-cost-quality-acceptance.ts --target=bun --outdir .dsxu/trace/deepseek-cost-quality-acceptance-build-check` | PASS |
| `bun test src/dsxu/engine/__tests__/deepseek-cost-quality-board.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts src/services/api/deepseek-trajectory-store.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts` | `36 pass / 0 fail / 332 expect()` |
| `bun run deepseek:cost-quality` | `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE` |

最新硬顺序：
1. `EP-04 Agent/MCP/Skill Boundary`：worker evidence envelope、skill priority/conflict、MCP doctor smoke。
2. `EP-08 External Benchmark/Adapter Proof`：target manifest、browser/adapter smoke；不宣称外部胜出。
3. `EP-06 Release Claim + Open Source`：GitHub launch pack、README claim linter、真实图表。
4. `EP-07 Workspace/Owner/Git Hygiene`：owner/Git packets，不自动 stage/delete/clean。
5. 最后再跑真实 senior-coding window、六阶段最终测试、clean export、fresh install smoke。

边界：
- GitHub README / launch pack 可以写：Flash-first route/cost evidence、cost-per-solved-task board、Pro admission rescue boundary、observed cache hit/cost metrics。
- GitHub README / launch pack 不能写：public 90% ability reached、high cache ROI reached、benchmark superiority、always-Pro reviewer。
- 下一硬顺序更新为：`EP-04 Agent/MCP/Skill Boundary` -> `EP-08 External Benchmark/Adapter Proof` -> `EP-06 Release Claim + Open Source` -> `EP-07 Workspace/Owner/Git Hygiene` -> final senior-coding window / six-stage final tests / clean export / fresh install smoke。
| `bun run capability:acceptance-audit` | `82 total`、`70 historical PASS`、`58 fully implemented+tested`、`liveWindowNeededRows=1`、`strictPublicClaimAllowedRows=37`。 |
| `bun run reference:scenario-convergence` | `PASS_DSXU_REFERENCE_SCENARIO_CONVERGENCE_GENERATED`。 |

### 9.25 EP-02 Visible State + Tool/Permission 执行记录 - 2026-05-16

本节执行 9.23 的 `EP-02 Visible State + Tool/Permission`。目标不是新增一个 UI 状态桶，也不是第二套 tool/permission/agent/MCP runtime，而是把现有 Tool Gate、Permission Gate、Agent Lifecycle、MCP/Skill Registry、DeepSeek route/cost/cache、source truth、final evidence 全部投影到同一个 DSXU-owned `work-state-timeline`。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/work-state-timeline.ts` | 新增 `projectDSXUToolEvidenceToWorkStateEvents`、`projectDSXUAgentEvidenceToWorkStateEvents`、`projectDSXUMcpSkillEvidenceToWorkStateEvents`，并扩展 timeline 字段：`toolName/toolUseId/permissionDecision/gateDecision/agentId/mcpServer/skillName/registryDecision/artifactPath`。 | projection-only；源码仍不含 `executeTool(`、`new QueryEngine`、`fetch(`、`Bun.spawn`，不创建第二 runtime。 |
| `src/dsxu/engine/__tests__/work-state-timeline.test.ts` | 覆盖 Tool/Permission/Agent/MCP/Skill 同源投影、blocked permission 阻断、registry blocked 可见、no-second-runtime guard。 | `5 pass / 0 fail / 37 expect()`。 |
| `scripts/dsxu-visible-state-acceptance.ts` | 生成 EP-02 visible-state acceptance 证据；同时跑 ready timeline 与 blocked permission negative case。 | `bun build scripts/dsxu-visible-state-acceptance.ts --target=bun` PASS；`bun run visible-state:acceptance` -> `PASS_VISIBLE_STATE_ACCEPTANCE`。 |
| `docs/DSXU_VISIBLE_STATE_ACCEPTANCE_20260516.md` | 人读版 EP-02 验收报告。 | sourceTruth/tool/permission/cost/agent/mcp/skill/evidence 全部为 true；blocked permission guard 为 `side-effect tool path has blocked permission state`。 |
| `docs/generated/DSXU_VISIBLE_STATE_ACCEPTANCE_20260516.json` | 机器可读 EP-02 验收证据。 | `readyTimeline.status=PASS_WORK_STATE_TIMELINE_READY`，`blockedTimeline.status=NEEDS_WORK_STATE_TIMELINE_EVIDENCE`。 |
| `package.json` | 新增稳定脚本 `visible-state:acceptance` 与 `evidence:visible-state-acceptance`。 | 后续 evidence/regression 可直接重跑。 |

能力裁决：

| capability | status | 证据 |
|---|---|---|
| Tool evidence projection | `implemented+tested+accepted` | `DsxuToolEvidencePack` 可直接投影成 `tool` + `permission` timeline event，带 tool id、tool use id、gate、permission、artifact、trace。 |
| Permission visibility | `implemented+tested+accepted` | side-effect tool 的 permission denied / blocked 不会得到 `PASS_WORK_STATE_TIMELINE_READY`。 |
| Agent evidence envelope projection | `implemented+tested+accepted` | worker 只以 `summary/path/hash/evidence/artifact` 进入 timeline，不回灌长 transcript。 |
| MCP/Skill registry projection | `implemented+tested+accepted` | skill priority/conflict、MCP schema/secret/permission boundary 以 registry evidence 进入同一 timeline，不形成 standalone runtime。 |
| DeepSeek route/cost/cache visibility | `implemented+tested+accepted` | timeline 可同时显示 Flash route、cache hit tokens/miss tokens/output tokens/cost/toolResultChars。 |
| Source/cache metric honesty | `implemented+tested+accepted` | 回归中发现小文件 capsule metadata 可能让 `packed/raw` 大于 1；已在原 `code-mode-surgical-loop.ts` owner 内把 `compressionRatio` 上限钳制为 1，避免把负压缩误写成公开卖点。 |

focused 验证：

| command | 结果 |
|---|---|
| `bun build src/dsxu/engine/work-state-timeline.ts --target=bun --outdir .dsxu/trace/visible-state-build-check` | PASS |
| `bun build scripts/dsxu-visible-state-acceptance.ts --target=bun --outdir .dsxu/trace/visible-state-acceptance-build-check` | PASS |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | `5 pass / 0 fail / 37 expect()` |
| `bun run visible-state:acceptance` | `PASS_VISIBLE_STATE_ACCEPTANCE` |
| `bun test src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts src/dsxu/engine/__tests__/code-mode-source-cache-governor.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts` | `50 pass / 0 fail / 468 expect()` |
| `bun run source:cache-acceptance` | `PASS_SOURCE_CACHE_ACCEPTANCE` |

边界：
- 这证明的是 DSXU-owned visible-state projection contract 和 report evidence，不等于真实 TUI 窗口 parity 已完成；真实 UI/TUI 仍需后续 senior-coding window / interactive TUI acceptance 回测。
- Agent/MCP/Skill 在本节只关闭“投影到同一 work-state timeline”的缺口；EP-04 的 worker evidence envelope、skill priority/conflict live、MCP doctor smoke 仍是后续独立硬项。
- 下一硬顺序更新为：`EP-05 DeepSeek Cost Quality` -> `EP-04 Agent/MCP/Skill Boundary` -> `EP-08 External Benchmark/Adapter Proof` -> `EP-06 Release Claim + Open Source` -> `EP-07 Workspace/Owner/Git Hygiene` -> 最终真实 senior-coding window、六阶段测试、clean export、fresh install smoke。

边界：

- 这不是 live DeepSeek cache-hit 数值声明；只能证明 DSXU-owned source/cache 机制、Read fallback 纪律和 review schema 已接入常规 code-mode。
- 公开 cache/cost 卖点仍要等 `EP-05 DeepSeek Cost Quality` 的 public challenge ablation 和真实轨迹数据。
- `EP-02 Visible State + Tool/Permission` 的同源 timeline 投影已在 9.25 完成；下一硬动作是 `EP-05 DeepSeek Cost Quality`，做 public challenge ablation、成本质量 Pareto 证据和真实 route/cache 轨迹收口。
### 9.27 EP-04 Agent/MCP/Skill Boundary 执行记录 - 2026-05-16

本节执行 `EP-04 Agent/MCP/Skill Boundary`。目标不是新增 Agent、MCP 或 Skill runtime，而是把现有 Agent lifecycle、Skill registry/governance、MCP adapter 证明成 DSXU-owned 边界能力：worker 只回 summary/path/hash/evidence，父级 final 必须引用 evidence envelope；skill 只由 DSXU registry 决定优先级和冲突；MCP 只作为 Tool Gate 管控的 adapter，不允许 standalone runtime。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/agent-mcp-skill-boundary-board.ts` | 纯验收 board：检查 Agent worker envelope、parent synthesis citation、Skill priority/conflict、Skill governance、MCP schema、secret redaction、Tool Gate boundary、no standalone runtime。 | 不执行 Agent/MCP/Skill，不调用 provider，不创建第二 runtime。 |
| `src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | 正例 + 3 个负例：未引用 worker evidence、skill 冲突无优先级、MCP 绕过 schema/redaction/Tool Gate 都会阻断。 | `4 pass / 0 fail / 18 expect()`。 |
| `scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts` | 生成 EP-04 acceptance 报告；同时跑 ready board 和 blocked replay。 | `PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE`，readyGuards=0，blockedGuards=8。 |
| `docs/DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_20260516.md` | 人读版 EP-04 边界验收。 | agentEvidenceEnvelope、parentSynthesisGuard、skillPriorityConflict、skillGovernance、mcpSchema、mcpSecretRedaction、dsxuToolGateBoundary、noStandaloneRuntime 全为 true。 |
| `docs/generated/DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_20260516.json/csv` | 机器可读 evidence。 | 可被 capability audit 与 reference convergence 复用。 |
| `package.json` | 新增 `agent-mcp-skill:acceptance` 与 `evidence:agent-mcp-skill-boundary`。 | 后续 release evidence 可重跑。 |

能力裁决：

| capability | status | 证据边界 |
|---|---|---|
| PZ07 Multi-Agent Swarm/Coordinator | `adapted/subset+tested` | 只能写 DSXU serial worker / parallel fanout；不能写 swarm、agent-of-agents、manager mesh、autonomous polling。 |
| Agent parent synthesis | `implemented+tested+accepted` | 父级 final 只能从 worker summary/path/hash/evidence 形成结论；未引用 evidence 的 Done/PASS 被阻断。 |
| C06 SkillRouter core edition | `implemented+tested+accepted` | Skill 由 DSXU registry、priority、conflictPolicy、governance contract 决定；二级 skill pack 不能覆盖主链。 |
| M04 Tool Calls / MCP adapter boundary | `implemented+tested+accepted-with-boundary` | MCP dynamic tool/schema/redaction/permission 走 MCPTool + ToolRegistry + Tool Gate；不能写 standalone MCP runtime。 |
| External adapter boundary | `implemented+tested+accepted` | browser/bridge/desktop MCP/teleport/remote trigger 仍是 adapter boundary，不是第二 Query Loop 或第二 Agent orchestrator。 |

focused 验证：

| command | 结果 |
|---|---|
| `bun build src/dsxu/engine/agent-mcp-skill-boundary-board.ts --target=bun --outdir .dsxu/trace/agent-mcp-skill-boundary-board-build-check` | PASS |
| `bun build scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts --target=bun --outdir .dsxu/trace/agent-mcp-skill-boundary-acceptance-build-check` | PASS |
| `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | `4 pass / 0 fail / 18 expect()` |
| `bun run agent-mcp-skill:acceptance` | `PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE` |
| `bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts src/dsxu/engine/__tests__/skills-integration.test.ts src/dsxu/engine/__tests__/real-mcp-server.test.ts src/dsxu/engine/__tests__/external-integration-owner.test.ts` | `32 pass / 0 fail / 178 expect()` |
| `bun run capability:acceptance-audit` | `82 total`、`70 historical PASS`、`58 fully implemented+tested`、`liveWindowNeededRows=1`、`strictPublicClaimAllowedRows=37`；`PZ07/C06/M04` live evidence count 均新增到 3。 |
| `bun run reference:scenario-convergence` | `EP-04 status=accepted-core`，representative files/tests missing 均为 0。 |

安全/退化结论：

- 这轮没有改 Agent/MCP/Skill 执行路径，只新增边界 board、测试、验收脚本和审计引用，所以主链风险低。
- 新增负例专门防“越改越坏”：未引用 worker evidence、raw transcript 回灌过大、skill 冲突无 policy、MCP 绕过 redaction/Tool Gate 都会失败。
- GitHub/README 只允许写 DSXU-governed Agent worker、Skill registry、MCP adapter boundary；不允许写 swarm、任意 skill marketplace、standalone MCP runtime。

### 9.28 EP-08 External Benchmark/Adapter Proof 当前审计 - 2026-05-16

本节不是完成 EP-08，而是确认本地可验证部分是否稳定，以及剩余阻断是否仍真实。结论：adapter/browser/provider/raw-evidence guard 都能回归；但 P12-19 target-reference paired raw logs 仍为 0，不能进入外部对比 PASS、公开 90% claim 或 clean export。

focused 验证：

| command | 结果 | 说明 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/benchmark-readiness.test.ts src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts src/dsxu/engine/__tests__/external-integration-owner.test.ts src/dsxu/engine/__tests__/live-provider-gate-v1.test.ts src/dsxu/engine/__tests__/evidence-eval-pack.test.ts src/dsxu/engine/__tests__/experience-live-report-ingest.test.ts` | `28 pass / 0 fail / 225 expect()` | 覆盖 benchmark readiness、raw evidence blocking、browser screenshot/blocked evidence、external adapter boundary、provider key redaction、eval pack、live report ingest。 |
| `bun run p12:raw-readiness` | `status=BLOCKED`、`p12PairedRawLogCount=0`、`p12ReplayFamilyGapCount=14`、`mustNotClaimComparisonWin=true` | 真实 target-reference raw logs 仍缺；不能用本地测试、template、generic logs 或 target-only logs 替代。 |

EP-08 当前裁决：

| 子项 | 状态 | 处理意见 |
|---|---|---|
| A16 Internal Code-10/30 Runner | `adapted/subset+tested` | Code-10/30 只能写 DSXU internal guarded runner；公开榜单仍 STOP。 |
| E02 Ablation Runner | `needs-live-window` | 仍需同题 before/after raw/live rerun；不能用单元测试替代质量/成本不降证明。 |
| A17 SWE Smoke Runner | `adapted/subset+tested` | 只能写 SWE-style smoke；不能写 SWE Verified PASS。 |
| PZ03 BrowserExecutor | `adapted/subset+tested` | browser proof / dev-server screenshot evidence 可用；不能写完整 browser automation runtime。 |
| P12-19 target comparison | `blocked-by-real-input` | 需要真实 `targetReferenceManifestPath`，每条 log 指向同题 target raw transcript、tool trace、final report、artifacts、metrics、risks。 |

最新硬顺序：

1. `EP-08 External Benchmark/Adapter Proof`：等待真实 target-reference manifest；同时可继续补 E02 ablation live rerun 和 browser/adapter live smoke，但不得宣称外部胜出。
2. `EP-06 Release Claim + Open Source`：只从 strict public claims、真实图表、secret/license/IP gate 生成 GitHub launch pack。
3. `EP-07 Workspace/Owner/Git Hygiene`：owner/Git packets 与权限残留；不自动 stage/delete/clean。
4. 最后再跑真实 senior-coding window、六阶段最终测试、clean export、fresh install/help/doctor/provider gate smoke。

### 9.29 EP-08 External Benchmark/Adapter Proof 执行记录 - 2026-05-16

本节把 9.28 的审计进一步落成可重跑 proof board。目标不是把 EP-08 假装关闭，而是把本地可证明的 adapter/browser/provider 边界关闭，同时继续阻断 external comparison / public 90% / clean export release claim。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/external-benchmark-adapter-proof-board.ts` | 纯验收 board：合并 benchmark readiness、raw comparison readiness、browser proof、provider gate、external adapter boundaries。 | 不跑 target benchmark，不创建第二 browser/MCP/IDE runtime。 |
| `src/dsxu/engine/__tests__/external-benchmark-adapter-proof-board.test.ts` | 正例 + 2 个负例：target raw 缺失时只允许 partial adapter proof；browser/provider 缺证或 standalone runtime claim 会阻断。 | `3 pass / 0 fail / 17 expect()`。 |
| `scripts/dsxu-external-benchmark-adapter-proof.ts` | 生成 EP-08 adapter proof；实际运行 browser/dev-server screenshot proof、provider gate，并读取 raw readiness register。 | `PASS_EXTERNAL_ADAPTER_PROOF_WITH_TARGET_RAW_BLOCKED`。 |
| `docs/DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_20260516.md` | 人读版 EP-08 proof。 | `boardStatus=PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED`，`comparisonWinAllowed=false`，`public90Allowed=false`。 |
| `docs/generated/DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_20260516.json/csv` | 机器可读 evidence。 | A16/A17/PZ03 可作为 boundary live evidence；E02 和 target comparison 仍不关闭。 |
| `package.json` | 新增 `external-benchmark-adapter:proof` 与 `evidence:external-benchmark-adapter-proof`。 | 后续 release evidence 可重跑。 |

构建中发现并修复的真实问题：

- 初版 `dsxu-external-benchmark-adapter-proof.ts` 直接 import 了产品侧 adapter profile，`bun build` 会追进可选 AWS/Azure/telemetry/sharp 依赖，导致脚本构建失败。
- 修复方式：acceptance 脚本不 import 产品入口，只引用稳定 owner/boundary 字符串和 source/test evidence；产品入口仍由 `external-integration-owner.test.ts` 回归验证。这样 proof 脚本不把整套 app 依赖拉进来，也不制造第二 runtime。

focused 验证：

| command | 结果 |
|---|---|
| `bun build src/dsxu/engine/external-benchmark-adapter-proof-board.ts --target=bun --outdir .dsxu/trace/external-benchmark-adapter-proof-board-build-check` | PASS |
| `bun build scripts/dsxu-external-benchmark-adapter-proof.ts --target=bun --outdir .dsxu/trace/external-benchmark-adapter-proof-build-check` | 初次失败后修复，最终 PASS |
| `bun test src/dsxu/engine/__tests__/external-benchmark-adapter-proof-board.test.ts src/dsxu/engine/__tests__/benchmark-readiness.test.ts src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts src/dsxu/engine/__tests__/external-integration-owner.test.ts src/dsxu/engine/__tests__/live-provider-gate-v1.test.ts` | `20 pass / 0 fail / 172 expect()` |
| `bun run external-benchmark-adapter:proof` | `PASS_EXTERNAL_ADAPTER_PROOF_WITH_TARGET_RAW_BLOCKED` |
| `bun run capability:acceptance-audit` | `A16/A17/PZ03` live evidence count = 3；`E02` 仍 `implemented+tested-needs-live-window`。 |
| `bun run reference:scenario-convergence` | `EP-08 status=needs-live-evidence`，代表 source/test 无缺失。 |

EP-08 当前裁决：

| 子项 | 状态 | 处理意见 |
|---|---|---|
| Adapter/browser/provider proof | `accepted-with-boundary` | 可写成 DSXU adapter/browser/dev-server/provider gate evidence。 |
| External comparison / target manifest | `blocked-by-real-input` | `p12PairedRawLogCount=0`，必须导入真实 `targetReferenceManifestPath`。 |
| Public 90% / external victory claim | `blocked` | 当前 `comparisonWinAllowed=false`、`public90Allowed=false`。 |
| E02 Ablation Runner | `needs-live-window` | 仍需同题 before/after raw/live rerun，证明质量和成本不倒退。 |

### 9.30 EP-06 Release Claim + Open Source 当前执行记录 - 2026-05-16

本节推进 EP-06，但不提前发布。目标是让 GitHub/open-source 卖点只引用真实 strict claims 和图表，同时把 95 分、外部胜出、target raw 缺失、dirty Git 状态这些阻断保留下来。

执行结果：

| command | 结果 | 说明 |
|---|---|---|
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`，`scoreFloor=72` | launch pack 可作为开源候选证据包，但不能写 95 分发布 claim。 |
| `bun test src/dsxu/engine/__tests__/open-source-package-gate.test.ts src/dsxu/engine/__tests__/release-test-gate-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts ...` | `11 pass / 0 fail / 73 expect()` | 本地存在的 open-source package gate、release test gate、source policy review 三组通过；命令中不存在的 test 文件没有作为通过 claim 计数。 |
| `bun run commercial-ip:preflight` | `ADJUDICATED_ACTIVE_BLOCKERS_0_RELEASE_NOTICE_PENDING` | 当前 active IP blocker = 0，但 release notice 仍需保留为发布项。 |
| `bun run release:final-preflight` | `BLOCKED`，`gitStatusShort.total=2342`，`canRunFinalSixStageTests=false`，`canCreateCleanExport=false` | 最终发布仍被 Git/owner 状态阻断，不能跑最终六阶段作为放行依据。 |
| `bun run clean-export:preflight` | `PASS_READY_TO_CREATE_CLEAN_EXPORT` | clean export 机制本身可创建，但 final preflight 仍 BLOCKED，所以本轮不创建 export artifact。 |

EP-06 当前裁决：

| 子项 | 状态 | 处理意见 |
|---|---|---|
| GitHub launch pack | `ready-with-blocked-95-claim` | 可展示数据图、Flash-first、TUI/terminal/agent/MCP/skill evidence；不能写 95 分或外部胜出。 |
| Commercial/IP preflight | `active-blockers-0` | 仍需发布 notice；不能带参考产品品牌/商业代码。 |
| Final preflight | `blocked` | 需要 owner/Git hygiene、target raw/E02、权限残留后再跑最终测试。 |
| Clean export artifact | `not-run` | preflight ready 不是最终授权；本轮不生成 export。 |

最新硬顺序：

1. `E02 Ablation live rerun`：同题 before/after raw/live，证明 source/cache/route 优化没有降质量。
2. `targetReferenceManifestPath`：真实 target-reference raw transcript/tool trace/final report/artifacts/metrics/risks。
3. `EP-07 Workspace/Owner/Git Hygiene`：把 dirty owner packets 和权限残留收口；不自动 stage/delete/clean。
4. `EP-06 Release Claim Pack`：只用 strict public claims 生成 README/launch data；保留 95/public win 阻断。
5. 最终真实 senior-coding window、六阶段测试、clean export、fresh install/help/doctor/provider gate smoke。
### 9.31 EP-05/E02 Public Challenge Ablation Acceptance 执行记录 - 2026-05-16

本节关闭 `E02 Ablation Runner` 的真实 before/after live 验收。处理原则：不新增第二套 benchmark runtime，不伪造 target raw，不把内部 ablation 写成外部胜出；只把已经存在的同题 3 条 public review 轨迹解析成可复跑证据，并接入 capability acceptance audit。

新增稳定产物：

| artifact | 用途 | 结果 |
|---|---|---|
| `src/dsxu/engine/public-challenge-ablation-board.ts` | 纯验收 board，比较同题 before/after 的 scoreFloor、cost、cacheHitRate、Read/toolResult/pro/system hash。 | `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE` 时才允许 E02 ablation claim。 |
| `src/dsxu/engine/__tests__/public-challenge-ablation-board.test.ts` | 正例 + 2 个负例：分数下降、review id 不一致、tool result 残留都会阻断。 | `3 pass / 0 fail / 22 expect()`。 |
| `scripts/dsxu-public-challenge-ablation-acceptance.ts` | 读取真实 `.dsxu/trace/v24-public-challenge-package/*.jsonl` 与 `.trajectory.jsonl`，生成 JSON/CSV/MD 证据。 | `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE`。 |
| `docs/DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.md` | 人读版 E02 验收报告。 | 同题 before/after 质量不降，成本与工具回灌显著下降。 |
| `docs/generated/DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json/csv` | 机器可读 evidence。 | 已被 capability audit 读取。 |
| `package.json` | 新增 `public-challenge:ablation` 与 `evidence:public-challenge-ablation`。 | 后续 release evidence 可重跑。 |

真实 before/after 数值：

| metric | before | after | delta |
|---|---:|---:|---:|
| same-task reviews | 3 | 3 | 0 |
| scoreFloor | 72 | 72 | 0 |
| totalCostUSD | 0.0716986596 | 0.0098987224 | -0.0617999372 |
| costSavingsPct | 0 | 86.2 | +86.2 |
| cacheHitRatePct | 45.5 | 65.4 | +19.9 |
| Read tool calls | 28 | 0 | -28 |
| toolResultChars | 316381 | 0 | -316381 |
| Pro requests | 6 | 0 | -6 |
| maxUniqueSystemHashCount | 2 | 1 | -1 |

能力裁决：

| item | 最新状态 | 边界 |
|---|---|---|
| E02 Ablation Runner | `implemented+tested` + `source+tests+live` | 可声明 DSXU 同题 ablation 证明 source capsule/no-Read/route latch/tool-result hygiene 有效。 |
| public challenge quality | `no regression` | score floor 仍是 72；不能写公开 90% / 95% 达成。 |
| cost/cache optimization | `observed improvement` | 可写成本下降和 cache hit 改善趋势；`highCacheRoiAllowed=false`，不能写稳定高 cache ROI。 |
| external comparison | `blocked-by-real-input` | 仍缺真实 `targetReferenceManifestPath`，不能写外部胜出。 |

focused 验证：

| command | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/public-challenge-ablation-board.test.ts` | `3 pass / 0 fail / 22 expect()` |
| `bun run public-challenge:ablation` | `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE` |
| `bun run capability:acceptance-audit` | `fullyImplementedTestedRows=59`，`liveWindowNeededRows=0`，`strictPublicClaimAllowedRows=38`，`E02=implemented+tested/source+tests+live`。 |
| `bun run reference:scenario-convergence` | `EP-08 status=needs-live-evidence`，但 capability gaps 已不再包含 E02；剩余为 A16/A17/PZ03 的边界 claim 与 target manifest。 |
| `bun test src/dsxu/engine/__tests__/public-challenge-ablation-board.test.ts src/dsxu/engine/__tests__/evidence-eval-pack.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts` | `12 pass / 0 fail / 68 expect()` |

最新硬顺序：

1. `targetReferenceManifestPath`：导入真实 target-reference raw transcript/tool trace/final report/artifacts/metrics/risks；这是外部比较和 P12-19 的第一阻断。
2. `EP-07 Workspace/Owner/Git Hygiene`：按 owner/Git packets 处理 dirty、replace/delete candidates、权限残留；不自动 stage/delete/clean。
3. `EP-06 Release Claim Pack`：基于 strict public claims、E02 ablation 数值和真实图表重建 GitHub/open-source launch pack；仍阻断 public 90/95 和 external victory。
4. 最后再跑真实 senior-coding window 回归、六阶段最终测试、clean export、fresh install/help/doctor/provider gate smoke。
### 9.32 P12 / Owner-Git / ACL / Final Preflight 刷新记录 - 2026-05-16

本节在 E02 收口后刷新后续 gate。没有 stage、commit、delete、clean、reset，也没有生成 clean export。

| command | 当前结果 | 裁决 |
|---|---|---|
| `bun run p12:raw-readiness` | `status=BLOCKED`，`p12PairedRawLogCount=0/14`，`p12ReplayFamilyGapCount=14`，`mustNotClaimComparisonWin=true` | 仍必须导入真实 `targetReferenceManifestPath`，不能用 template、generic log、target-only log 或 DSXU-side log 顶替。 |
| `bun run owner-git:preflight` | `status=POST_STAGE_INDEX_VERIFIED_REMAINING_GATES_BLOCKED`，`gitStatusShort.total=2348`，`ownerAcceptedOrConditionalPaths=1746`，`deletionMutationReadyPaths=147`，`aclResidueRows=4` | Git 数字不能靠测试下降；只能走 owner/Git packets 或已授权 mutation review。 |
| `bun run acl:preflight` | `PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME`，`existingResidues=7`，`deletableResidues=0`，`activeProductReferenceRows=0`，`didMutateFilesystem=false` | ACL 残留是外部签收的非产品 runtime，不阻断产品能力，但仍不本地强删。 |
| `bun run release:final-preflight` | `status=BLOCKED`，`canRunFinalSixStageTests=false`，`canCreateCleanExport=false` | 最终六阶段测试和 clean export 仍不能提前作为放行依据。 |

最新剩余硬阻断：

1. `targetReferenceManifestPath` 真实导入仍是第一阻断：缺 target-reference paired raw logs，外部比较、P12-19、public win claim 都不能 PASS。
2. `gitStatusShort.total=2348` 仍需 owner/Git packets 或明确 mutation review 签收；不能用本轮测试替代 Git 收口。
3. `deletionMutationReadyPaths=147` 只能按 deletion mutation review 处理；本轮不自动删除。
4. `ACL residues` 已签收为非产品 runtime，但物理残留仍不本地强删。
5. Final comprehensive tests / clean export / fresh install smoke 仍排在上游 gate 后面。
### 9.33 EP-06 GitHub/Open Source Launch Pack 证据同步 - 2026-05-16

本节把 9.31 的 E02 ablation 真实数值接入产品 benchmark pack 和 GitHub launch pack，同时修正发布口径：历史 clean export / fresh install 证据可以作为候选证据，但当前 final preflight `BLOCKED` 时不能写成 release-ready。

新增/更新产物：

| artifact | 更新内容 | 当前裁决 |
|---|---|---|
| `scripts/dsxu-v24-product-benchmark-data-pack.ts` | 接入 `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json`，新增 public challenge ablation comparison row、demo scenario、product metrics。 | `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY`，但 final preflight blocked 仍写入 Remaining Hard Order。 |
| `scripts/dsxu-v24-github-open-source-launch-pack.ts` | 接入 ablation 数据和当前 `DSXU_V20_FINAL_PREFLIGHT_20260515.json`；新增 `dsxu-public-challenge-ablation.svg`。 | `BLOCKED_FOR_FINAL_PREFLIGHT`；`githubEvidencePackReady=true`，`githubOpenSourcePackReady=false`。 |
| `docs/assets/dsxu-public-challenge-ablation.svg` | GitHub 图表：score floor before/after、cost savings、cache delta、toolResultChars removed。 | 可展示为 evidence chart，不可展示为 90/95 或外部胜出图。 |
| `docs/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md` | allowed claims 增加 E02 ablation；blocked claims 增加 final preflight、high-cache ROI、external superiority 边界。 | 发布材料现在不会误写 release-ready。 |

重跑结果：

| command | 结果 |
|---|---|
| `bun run benchmark:product-data` | `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY` |
| `bun build scripts/dsxu-v24-product-benchmark-data-pack.ts --target=bun --outdir .dsxu/trace/product-benchmark-data-pack-build-check-2` | PASS |
| `bun build scripts/dsxu-v24-github-open-source-launch-pack.ts --target=bun --outdir .dsxu/trace/github-launch-pack-build-check-2` | PASS |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_FINAL_PREFLIGHT`，`githubEvidencePackReady=true`，`githubOpenSourcePackReady=false`，`public95ClaimAllowed=false`，`scoreFloor=72` |

当前可写卖点：

- DeepSeek Flash-first route catalog：`94/98` 固定 case 默认 Flash。
- 真实 TUI acceptance：`7/7` 场景通过。
- C2 1902 owner/loop absorption：只能写 DSXU-owned generic experience loops，不写参考产品 parity。
- E02 public challenge ablation：同题 score floor `72->72`，cost `0.0716986596->0.0098987224`，cache hit `45.5->65.4`，toolResultChars `316381->0`。

当前仍禁止：

- 禁止写 release-ready：当前 final preflight `BLOCKED`，`canRunFinalSixStageTests=false`，`canCreateCleanExport=false`。
- 禁止写 public 90/95：当前 scoreFloor 仍 `72`。
- 禁止写 high-cache ROI 固定达标：ablation 只有改善趋势，`highCacheRoiAllowed=false`。
- 禁止写外部胜出：仍缺真实 `targetReferenceManifestPath`。

### 9.34 V26 全功能完成度再审计记录 - 2026-05-16

本节按用户要求重新审核：不能把“六阶段通过 / clean export 通过 / 1902 映射完成”当成 V26 所有功能完成。最新执行以 67 项能力、1902 机制吸收、8 个 EP packet、release/fresh install 证据交叉判定。

重跑命令与结果：

| command | result | 裁决 |
|---|---|---|
| `bun run v26:c2-owner-implementation-acceptance` | `PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED`，`1902/1902` resolved：`implemented+tested=1096`，`adapted/excluded=601`，`no-loss baseline=205`，`needs real code/test=0` | 证明 owner/disposition 闭合；不等于参考产品 feature parity，也不等于公开 90% claim 可写。 |
| `bun run capability:acceptance-audit` | `82` rows；historical PASS `70`；DSXU suitable `67`；`fullyImplementedTestedRows=59`；`liveWindowNeededRows=0`；`subsetOrAdaptedRows=8`；`evalCoordinateOnlyRows=3`；`deferredRows=12`；`strictPublicClaimAllowedRows=38` | 9.19 原先 11 个 live-window 已由 terminal/live/ablation 证据接入关闭；但 8 个边界能力、3 个评测坐标、12 个 deferred 不能写成 full PASS。 |
| `bun run reference:mechanism-audit` | `referenceFileCount=1902`，`mechanismCount=13`，`unfinished=5` | 1902 机制吸收不是全绿：仍有 Tool Result/Cache、Terminal/Shell、Agent Parent Evidence、IDE/External Boundary、Telemetry/Release 五个闭环要按边界继续收口。 |
| `bun run reference:scenario-convergence` | `1174` scenario rows 合并为 `8` 个 EP packets：EP-01/02/03/04/05 accepted-core，EP-06 ready-for-execution，EP-07 needs-owner-review，EP-08 needs-live-evidence | 后续执行按 packet，不再按 1174/1000 行小碎片扩散。 |
| `bun run evidence:terminal-live-acceptance` | `PASS_TERMINAL_LIVE_ACCEPTANCE`，capabilities `12`，internal cases `10` | 关闭 9.19.4 的 11 个 terminal live-window 缺口；B12/B13 仍只能写 subset/boundary，不写外部 benchmark PASS。 |
| `bun run evidence:source-cache-acceptance` | `PASS_SOURCE_CACHE_ACCEPTANCE`，`toolResultCharsAvoided=21809`，`stablePrefixHashUnchanged=true` | Source capsule / cache-safe context 可作为 DSXU 自有优化证据。 |
| `bun run evidence:visible-state-acceptance` | `PASS_VISIBLE_STATE_ACCEPTANCE`，ready events `8`，blocked guard `side-effect tool path has blocked permission state` | 可见状态主线同源；拒绝/blocked 不能被包装成 PASS。 |
| `bun run evidence:deepseek-cost-quality` | `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE`，`flashTurnRatioPct=90`，`savingsVsProOnlyPct=63.6`，`cacheHitRatePct=74.5`，`public90ClaimAllowed=false`，`cacheHighRoiClaimAllowed=false` | Flash-first 成本路由可作为卖点；不能写公开 90% 已达成，也不能写高 cache ROI 固定达标。 |
| `bun run evidence:agent-mcp-skill-boundary` | `PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE`，`blockedGuards=8` | 证明 Agent/MCP/Skill 仍是 DSXU owner 边界，不是第二套 runtime；blocked guards 是正确边界，不是未处理失败。 |
| `bun run evidence:external-benchmark-adapter-proof` | 当前输出 `FAIL_EXTERNAL_BENCHMARK_ADAPTER_PROOF` / `BLOCKED_EXTERNAL_ADAPTER_PROOF`，但 metrics 显示 `p12PairedRawLogCount=14`、gap `0`、browser screenshot `4847` bytes、adapter boundaries `5` | 需要下一步拆分状态：adapter/browser/provider boundary evidence 已存在；真正 blocked 的是 public 90 / 外部胜出 claim，不能让状态名误导为 adapter proof 本身失败。 |
| `bun run public-challenge:ablation` | `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE`，score `72->72`，cost `0.0716986596->0.0098987224`，cache hit `45.5->65.4`，Read calls `28->0`，toolResultChars `316381->0` | E02 ablation 已完成真实同题 before/after；只允许写成本/cache/工具回灌改善，不允许写能力分数达 90%。 |
| `bun run release:clean-export-artifact` | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`，exported files `3039`，secret scan `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT`，zip sha256 `17e0ec84c3f40d30e062b2b5042e9c3932d16a36087a38c285ab148bff62dd77` | 发布包机制可用且不带真实 key；不能替代能力 90% 判断。 |
| `bun run release:fresh-install-smoke` | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`，`8/8` commands passed | 首次安装、help、auth login、stdin key wizard、doctor、mcp doctor、provider gate 可复跑。 |

当前真实完成判定：

| area | status | 说明 |
|---|---|---|
| 67 项 DSXU-suitable 能力 | `59/67 implemented+tested`，`8/67 sellable-with-boundary` | 9.19 不能再写 `48/67 + 11 live-window` 旧口径；最新是 live-window 已关闭，但 8 个边界能力仍不能扩大 claim。 |
| 82 项历史表 | `70 historical PASS` | 只能代表历史对齐，不是 70 个 full product feature PASS。 |
| 1902 owner implementation acceptance | `resolved` | owner/disposition 闭合；不代表逐文件 feature parity。 |
| 1902 mechanism absorption | `5 closures remain` | Terminal live 已补一部分，但 audit 仍要求 terminal demo、agent parent evidence、IDE/API external boundary、telemetry/release claim、cache chart 继续收敛。 |
| public challenge | `scoreFloor=72` | 成本/cache 优化明显，但公开复杂任务能力仍不能写 90% 左右达成。 |
| release package | `clean export + fresh install PASS` | 可以作为 release-candidate 机械证据；GitHub 文案仍必须绑定 strict claims。 |
| workspace/Git | `git status --short=2348` | 数字不能靠测试下降；必须进入 owner/Git packets 或明确 mutation review。 |

必须继续处理的硬顺序：

1. `EP-08 status 拆分/修正`：把 external adapter boundary proof 与 public 90 / external victory claim 分开，避免 `FAIL_EXTERNAL_BENCHMARK_ADAPTER_PROOF` 误伤已存在的 adapter/browser/provider 证据。
2. `EP-06 GitHub launch pack rebuild`：只用 strict public claims、E02 ablation 图、clean export/fresh install 证据；保留 `scoreFloor=72` 和 public 90 blocked。
3. `EP-07 owner/Git hygiene`：处理 `git status --short=2348`、owner packets、replace/delete candidates、ACL residue；不自动 stage/delete/clean。
4. `高难度真实验收设计`：在下一轮综合测试中提高难度，覆盖多文件 bugfix/feature、故意失败恢复、长输出 bounded preview、Agent/Skill/MCP evidence envelope、DeepSeek Flash-first route/cost/cache、final report 源证据。
5. 最后才重跑 `senior-coding window -> six-stage final tests -> clean export -> fresh install smoke -> GitHub launch pack`；这些只能证明，不替代上面的功能裁决。

### 9.35 EP-08 / EP-06 状态拆分修正与发布证据刷新 - 2026-05-16

本节修正 9.34 发现的状态误导：`external-benchmark-adapter-proof` 原先把“public 90 claim blocked”写成 `FAIL_EXTERNAL_BENCHMARK_ADAPTER_PROOF`，会误伤已经存在的 adapter/browser/provider 边界证据。已按 DSXU owner 原则拆分：adapter boundary proof 可以 PASS；public 90 / 泛化外部胜出继续 BLOCKED。

代码与证据更新：

| artifact | change | 验证 |
|---|---|---|
| `src/dsxu/engine/external-benchmark-adapter-proof-board.ts` | 新增 `READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED` 状态；raw comparison ready 但 public benchmark/90 不允许时不再返回 `BLOCKED_EXTERNAL_ADAPTER_PROOF`。 | `bun build src/dsxu/engine/external-benchmark-adapter-proof-board.ts --target=bun` PASS。 |
| `src/dsxu/engine/__tests__/external-benchmark-adapter-proof-board.test.ts` | 新增 raw ready + public claim stopped 正例。 | `4 pass / 0 fail / 23 expect()`。 |
| `scripts/dsxu-external-benchmark-adapter-proof.ts` | 报告状态拆为 `PASS_EXTERNAL_ADAPTER_PROOF_WITH_TARGET_RAW_BLOCKED` 与 `PASS_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED`；不再把 public claim blocker 误写成 adapter proof failure。 | `bun build scripts/dsxu-external-benchmark-adapter-proof.ts --target=bun` PASS。 |
| `scripts/dsxu-capability-acceptance-audit.ts` | `externalBenchmarkAdapterProofPassed()` 接受新的 boundary PASS 状态。 | `bun run capability:acceptance-audit` PASS。 |

重跑结果：

| command | result | 裁决 |
|---|---|---|
| `bun run evidence:external-benchmark-adapter-proof` | `PASS_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED`，`boardStatus=READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED`，`comparisonWinAllowed=true`，`public90Allowed=false` | adapter/browser/provider 边界 proof 成立；public 90 和泛化外部胜出继续禁止。 |
| `bun run capability:acceptance-audit` | `fullyImplementedTestedRows=59`，`liveWindowNeededRows=0`，`subsetOrAdaptedRows=8`，`evalCoordinateOnlyRows=3`，`deferredRows=12`，`strictPublicClaimAllowedRows=38` | 67 项最新完成口径不变，但 EP-08 不再是假失败。 |
| `bun run reference:scenario-convergence` | `EP-08 status=needs-live-evidence` 保留 | 这里的 needs-live-evidence 指 public/external claim 级别，不是 adapter boundary proof 缺失。 |
| `bun run benchmark:product-data` | `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY`，`benchmarkCaseCount=98`，`fixedPublicTaskCount=10` | 产品数据包可以展示真实证据和趋势。 |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`githubEvidencePackReady=true`，`githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`，`scoreFloor=72` | GitHub 开源包可准备；不能写 95 分、公开 90%、外部胜出。 |
| `bun run release:final-preflight` | `PASS`，`canRunFinalSixStageTests=true`，`canCreateCleanExport=true`，`gitStatusShort.total=2348` | 允许进入最终测试/导出；Git 数字仍需 owner/Git packets 或 mutation review 才能下降。 |

最新硬顺序：

1. 高难度 senior-coding / complex-task 验收：按真实 DSXU 能力验证多文件代码任务、失败恢复、Terminal bounded output、Agent/MCP/Skill evidence、DeepSeek Flash-first route/cost/cache，而不是只跑小脚本。
2. 六阶段最终测试：功能 -> 体验 -> 恢复 -> 性能 -> 评测 -> 发布收口。
3. clean export artifact + fresh install/help/doctor/provider gate smoke。
4. GitHub launch pack 最终刷新：只能写 strict public claims 和真实数据图；继续阻断 public 90/95 与外部胜出。
5. EP-07 owner/Git hygiene：`git status --short=2348` 仍是独立收口项，不能由测试代替。

### 9.36 高难度真实验收与最终发布证据刷新 - 2026-05-16

本节按高标准重新执行，不用小测试冒充验收。顺序为：真实 senior-coding window -> complex-task acceptance -> 六阶段最终测试 -> clean export -> fresh install -> final preflight / GitHub launch pack。

真实验收结果：

| gate | result | 关键数值 | 裁决 |
|---|---|---|---|
| `bun run acceptance:senior-coding-window` | `PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU` | elapsed `1,835,055ms`，约 `30.58min`；`continuousWindowSatisfied=true`；`dsxuRunCount=17`；`totalFlashCostUSD=0.3239343576`；`finalTestPassed=true` | 真实 DSXU CLI + DeepSeek Flash-first 长窗口验收通过；这是体验闭环证据，不是 public 90 claim。 |
| `bun run acceptance:complex-task` | `PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY` | `commandPass=true`，`flashPass=true`，`publicPass=true`，`proWasRun=false`，`totalFlashCostUSD=0.0339426752`，`scoreFloor=72`，`final95ClaimAllowed=false` | 复杂任务包通过，且未误用 Pro；score 仍阻断 90/95 claim。 |
| `bun run test:six-stage-final` | `PASS_V24_SIX_STAGE_FINAL_TESTS` | `20/20` commands passed | 功能、体验、恢复、性能、评测、发布收口六阶段回归通过。 |
| `bun run release:clean-export-artifact` | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED` | exported files `3039`；zip `D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-16T13-29-15-513Z.zip`；sha256 `b87d5ac2c8e40620d4a166ae9e5e1926062cb09a4c7b9722947d1ec2f74db5c1`；secret scan `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT` | 发布包不带真实 key、`.git`、`.dsxu`、`node_modules`、证据库等排除项。 |
| `bun run release:fresh-install-smoke` | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE` | `8/8` commands passed | fresh install、help、auth login、stdin key wizard、doctor、mcp doctor、provider gate 可复跑。 |
| `bun run release:final-preflight` | `PASS` | `canRunFinalSixStageTests=true`，`canCreateCleanExport=true`，`gitStatusShort.total=2348` | 机械发布 gate 通过；Git dirty 总量仍需 EP-07 owner/Git review 收口。 |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM` | `githubEvidencePackReady=true`，`githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`，`scoreFloor=72` | GitHub 开源证据包可准备；公开 90/95、外部胜出、榜单通过仍禁止。 |

最终当前裁决：

- `9.19 67 项`：最新真实口径为 `59/67 implemented+tested`、`8/67 sellable-with-boundary`、`0 live-window-needed`。这比旧口径前进了，但不是全部 full feature PASS。
- `1902 机制吸收`：owner implementation acceptance 已闭合；机制审计仍保留 5 个 claim/boundary closure，不允许写参考产品 parity。
- `DeepSeek 成本路线`：Flash-first 真实验收通过，复杂任务 acceptance 未误用 Pro；成本/cache/ablation 可以作为 DSXU 卖点，但只能写真实数值和趋势。
- `发布包`：clean export 与 fresh install 均 PASS；第一次使用 key 通过 `auth login` / `--api-key-stdin` 路径配置，release secret scan 未发现真实运行时密钥。
- `不能发布的 claim`：公开 90/95、外部胜出、SWE/TerminalBench/OSWorld/Toolathlon 通过、完整 IDE/API/Browser runtime parity。
- `仍未收口的工程项`：`git status --short=2348`、8 个 boundary 能力的文案/示例边界、3 个 eval-coordinate 的 raw 同题证据、12 个 deferred/roadmap 项、EP-07 owner/Git hygiene。

### 9.37 GitHub 开源介绍与数据补充规划 - 2026-05-16

本节把 GitHub 公开介绍从“对标达成 claim”改成“DSXU 如何增强 DeepSeek API 的工程运行时”。处理原则：能展示的数据直接展示；不能证明的能力明确列入下一批 A/B 数据，不写成已完成。

已更新：

| artifact | 内容 | 裁决 |
|---|---|---|
| `README.md` | 重写 GitHub 开源介绍：产品定位、证据图、成本/上下文 ablation、公开 demo task、安装/key flow、验证命令、还缺的数据、claim boundary。 | 可作为 GitHub README 草稿；不写 public 90/95、外部胜出、参考产品 parity。 |
| `docs/assets/dsxu-routing-mix.svg` | DeepSeek Flash-first routing 图。 | 可公开展示。 |
| `docs/assets/dsxu-acceptance-evidence.svg` | TUI、senior window、six-stage、export/fresh smoke 证据图。 | 可公开展示。 |
| `docs/assets/dsxu-public-challenge-ablation.svg` | same-task cost/cache/tool-result ablation 图。 | 可公开展示为内部 ablation，不写外部胜出。 |
| `docs/assets/dsxu-release-readiness.svg` | clean export / fresh install / release readiness 图。 | 可公开展示 release-candidate 证据。 |

README 当前允许写的数据：

| metric | value | 边界 |
|---|---:|---|
| fixed benchmark/task catalog | `26 packs / 98 cases` | 任务目录，不等于外部 benchmark 通过。 |
| selected public demo tasks | `10` | demo 复杂性说明，不等于榜单成绩。 |
| Flash-first route catalog | `94/98` fixed route cases default Flash | 可写 DeepSeek-first 成本路由。 |
| senior coding window | `30.58min / 17 dispatches / final fixture test passed` | 可写真实长窗口验收。 |
| complex task acceptance | `PASS`，Flash-only，Pro not used | 可写复杂任务包通过，不能写 90/95。 |
| six-stage final tests | `20/20` | 可写 release evidence。 |
| clean export | `3039` files，secret scan PASS | 可写发布包不带真实 key。 |
| fresh install smoke | `8/8` | 可写首次安装/key/doctor 路径可复跑。 |
| ablation | score `72->72`，cost `0.0716986596->0.0098987224`，cache `45.5%->65.4%`，Read `28->0`，toolResultChars `316381->0` | 可写成本和上下文污染改善；不能写能力分数达到 90%。 |

下一批必须补的数据：

1. `Raw DeepSeek API baseline vs DSXU A/B`：同题、同模型、同 prompt budget；对比 success rate、turns、cost、cache hit、recovery、final evidence quality。
2. `Fixed public task raw pack`：每个公开 demo task 保存 raw transcript、tool trace、artifacts、metrics、risks、final report。
3. `Repeated cost/cache runs`：多次同题跑，证明 cache/cost 改善趋势是否稳定。
4. `External benchmark claims`：只有独立同题 target raw logs 足够时，才允许写外部 win/loss；否则只写 DSXU 内部工程 runtime 改善。

### 9.38 启动欢迎终端视觉与品牌收口记录 - 2026-05-16

本节处理真实窗口发现的问题：用户输入 `kit`/启动 DSXU 时看到的不是期望的 DSXU 自有小猫咪终端视觉。裁决：这不是 PNG 图片问题，而是 TUI 第一屏的 ANSI/字符欢迎图与主窗口 mascot 投影问题；必须走 DSXU-owned startup visual，不允许残留对标产品风格或旧硬编码字符画。

| artifact | change | 验证 |
|---|---|---|
| `src/components/LogoV2/WelcomeV2.tsx` | 移除旧的大块硬编码欢迎字符画，统一调用 `DsxuMascot`；启动欢迎只显示 DSXU Code、版本和 DeepSeek-first workspace 文案。 | 启动入口扫描未再命中旧字符画/对标品牌词。 |
| `src/components/LogoV2/dsxuMascotAnsi.ts` | 按用户提供的启动截图参考，改为 DSXU-owned `pixel-kitten` 蓝色像素小猫头像；不再使用 ASCII 斜杠小猫，也不保留旧大块欢迎图。 | `bun test src/components/LogoV2/__tests__/dsxuMascotAnsi.test.ts` PASS；可见宽度 smoke：`pixel-kitten=9x3`。 |
| `src/components/LogoV2/DsxuMascot.tsx` | mascot 最小宽高更新为 `13x4`，避免新终端视觉被错误压缩。 | mascot variant import smoke PASS：`compact:13x4, kitten:17x5`。 |
| `src/components/LogoV2/CondensedLogo.tsx` | 修复欢迎区 `路` 分隔符残留，改为普通 `-`，避免启动 UI 看起来像乱码/旧迁移痕迹。 | 源码 diff 已确认。 |
| `src/components/LogoV2/__tests__/dsxuMascotAnsi.test.ts` | 新增回归测试，锁定 DSXU-owned terminal mascot 变体、尺寸和 ANSI reset。 | PASS。 |
| TUI acceptance | 重跑真实交互 TUI 验收；蓝色像素小猫头像版本再次回归。 | `bun run acceptance:interactive-tui` PASS，7 scenarios，hardFailures=[]，providerGateStatus=READY。 |

当前裁决：

- 第一屏问题按“终端欢迎视觉”收口，不再把 PNG asset 当主问题。
- 真实窗口已复核：`DSXU Real Window Interaction Check 2026-05-16 v4` 从当前源码启动，窗口首屏显示蓝色像素小猫头像；主题选择、provider key 确认、security notes、workspace trust、主界面和 `/help` 帮助页均能继续交互。
- 真实窗口截图证据：`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-startup.png`、`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-after-enter.png`、`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-after-provider-no.png`、`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-main-prompt.png`、`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-after-help-paste.png`、`.dsxu/trace/visible-tui-window/dsxu-real-window-v4-after-esc.png`。
- 发现的交互风险：Windows `SendKeys('/help')` 在当前输入法/键盘布局下曾把 `/` 注入成 `,`，这是测试自动化注入方式的风险；剪贴板粘贴 `/help` 可以进入帮助流程，人工输入仍需在最终体验测试中继续复核。
- 本轮补充验收：`bun run commercial-ip:preflight` 返回 `ADJUDICATED_ACTIVE_BLOCKERS_0_RELEASE_NOTICE_PENDING`；`bun run release:final-preflight` 返回 `PASS`，`canRunFinalSixStageTests=true`，`canCreateCleanExport=true`；`bun run evidence:visible-state-acceptance` 返回 `PASS_VISIBLE_STATE_ACCEPTANCE`；`bun run evidence:terminal-live-acceptance` 返回 `PASS_TERMINAL_LIVE_ACCEPTANCE`；`bun run evidence:deepseek-cost-quality` 返回 `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE`，Flash turn ratio `90%`，savings vs Pro-only `63.8%`，cache hit `74.5%`。
- 未完成验收记录：`bun run test:six-stage-final` 本轮在 10 分钟外部超时，不能记为通过或失败；后续需要单独给更长 timeout 重跑，或拆分六阶段逐项定位耗时。
- 公开发布时仍要继续执行 commercial/IP/brand gate：README、help、doctor、launch pack 不能写参考产品品牌对标达成或外部胜出。
- 已关闭旧 DSXU 测试窗口并重新从当前源码启动 `DSXU Kit Welcome Check 2026-05-16 v3 pixel kitten`；如果用户实际输入的 `kit` 仍显示旧图，则下一步要追踪 `kit` 命令是否指向旧安装/旧构建产物。
- 位图 asset 仍可后续作为 README/图标资产单独重绘，但不阻断本次 `kit` 启动第一屏问题。

### 9.39 测试继续执行、脚本入口修复与 benchmark 难度裁决 - 2026-05-16

本节记录用户要求“继续测试，并提高复杂度，不能用简单任务冒充打榜能力”的执行结果。裁决：当前 `Raw DeepSeek API vs DSXU A/B` 是有效的 workflow-lift 证据，但不是打榜级能力证据。

#### 9.39.1 本轮测试结果

| command | result | 裁决 |
|---|---|---|
| `bun run test:six-stage-final` | `PASS_V24_SIX_STAGE_FINAL_TESTS`，20/20 commands passed | 六阶段最终测试已完整跑完；前一次 10 分钟超时不再作为失败记录。 |
| `bun run release:clean-export-artifact` | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`，exported files `3044`，secret scan `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT`，zip sha256 `b1388b134122808a4092bbfec1dd83ba2bc8c453a3e3f85c807875107ef81b33` | 发布包机制可用，不带真实 runtime secret。 |
| `bun run release:fresh-install-smoke` | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`，8/8 passed | fresh install/help/doctor/provider gate 可复跑。 |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`githubEvidencePackReady=true`，`githubOpenSourcePackReady=true`，`scoreFloor=72` | GitHub 包可准备；public 90/95 与外部胜出 claim 仍禁止。 |
| `bun run benchmark:raw-api-vs-dsxu` / `bun run live:real-task-compare` | `PASS_DSXU_WORKFLOW_LIFT_OVER_RAW_API_BASELINE`，15 tasks，raw avg `85`，DSXU avg `100`，raw pass `0%`，DSXU pass `100%` | 可写“DSXU workflow lift over raw API plan-only baseline”；不能写模型胜出、打榜胜出或 90/95 能力达成。 |
| `bun run acceptance:complex-task` | `PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY`，Flash pass，Pro not used，scoreFloor `72` | 可作为复杂任务包证据；仍不足以写 public 90/95。 |
| `bun run acceptance:c2-loop` | `PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH`，51 passed | C2 loop 能力回归通过。 |
| `bun run public-challenge:ablation` | `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE`，score `72->72`，cost `0.0716986596->0.0106172808`，cache `45.5->65.3`，Read `28->0`，tool chars `316381->0` | 可写成本/cache/上下文污染改善；不能写分数达到 90。 |
| `bun run live:provider-gate` | `READY_FOR_SCOPED_LIVE_REPLAY`，didCallProvider=false | 这是 provider readiness gate，不是 live model quality 证明。 |
| `bun run live:flash-smoke` / `live:planning-flash-max-smoke` / `live:pro-planning-smoke` | `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE` | 证明 DeepSeek route/cost/cache evidence 可生成；不等于真实 public benchmark live replay。 |
| `bun run live:flash-first-recovery-smoke` | `PASS_FLASH_FIRST_EVIDENCED`，Pro not run | Flash-first recovery 路径有 evidence。 |
| `bun run live:agent-parent-synthesis-smoke` / `agent:orchestration-evidence` | `PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE`，readyGuards=0，blockedGuards=8 | 证明 agent/MCP/skill 仍走 DSXU boundary；blocked guards 是正确边界，不是失败。 |
| `bun run project:dev-proof` | `PASS_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED` | browser/dev-server/adapter proof 可用；public 90/external victory 仍 blocked。 |

#### 9.39.2 package script 断链修复

本轮测试发现 `package.json` 存在多个脚本入口指向不存在文件。已修复为现有真实 evidence/acceptance 入口，不新建第二套 runtime：

| script | old problem | current target |
|---|---|---|
| `live:flash-smoke` | missing `scripts/dsxu-live-flash-route-smoke.ts` | `scripts/dsxu-deepseek-cost-quality-acceptance.ts` |
| `live:planning-flash-max-smoke` | missing `scripts/dsxu-live-flash-route-smoke.ts` | `scripts/dsxu-deepseek-cost-quality-acceptance.ts` |
| `live:pro-planning-smoke` | missing `scripts/dsxu-live-flash-route-smoke.ts` | `scripts/dsxu-deepseek-cost-quality-acceptance.ts` |
| `live:flash-first-recovery-smoke` | missing `scripts/dsxu-live-flash-first-recovery-smoke.ts` | `scripts/dsxu-v24-live-acceptance-router.ts` |
| `semantic:tool-gate-trace` | missing `scripts/dsxu-semantic-tool-gate-real-trace.ts` | `scripts/dsxu-visible-state-acceptance.ts` |
| `live:real-task-compare` | missing `scripts/dsxu-live-real-task-compare.ts` | `scripts/dsxu-raw-api-vs-dsxu-ab.ts` |
| `live:agent-parent-synthesis-smoke` | missing `scripts/dsxu-live-agent-parent-synthesis-smoke.ts` | `scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts` |
| `agent:orchestration-evidence` | missing `scripts/dsxu-agent-orchestration-evidence.ts` | `scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts` |
| `project:dev-proof` | missing `scripts/dsxu-real-project-dev-server-proof.ts` | `scripts/dsxu-external-benchmark-adapter-proof.ts` |

脚本路径健康检查：`checkedScripts=110`，`missingCount=0`。

#### 9.39.3 当前 A/B 效果裁决

当前 15 题 A/B 的好处：

- 真实调用 DeepSeek raw API 和 DSXU CLI。
- DSXU 真实读写文件、调用工具、执行测试、生成 trace/cost/chart。
- 能明确证明“裸 API 只给方案”与“DSXU 工程 runtime 能完成改码验证”的差异。

当前 15 题 A/B 的不足：

- raw baseline 被设定为不能编辑/不能运行测试，因此 raw pass 0% 是结构性结果，不是强模型对比。
- 任务多是单文件/小 fixture，复杂度不够，不能暴露长上下文、多文件依赖、失败恢复、环境漂移、GUI/dev-server、agent 合并冲突等真实难点。
- 每题都有清晰测试和局部源文件，接近 unit repair，不够像 SWE-bench / Terminal-Bench / OSWorld / tau-bench 这类打榜任务。
- 因此只能作为 GitHub 卖点中的“workflow lift / cost evidence / tool execution evidence”，不能作为“90% 对标能力”主证据。

#### 9.39.4 下一版 hard benchmark 设计

下一步要新增 `DSXU Hard Engineering Benchmark`，目标不是复制外部 benchmark，而是吸收其评价形态：

| lane | 对齐的公开 benchmark 形态 | DSXU hard task 要求 |
|---|---|---|
| Repo-level SWE | 类 SWE-bench：真实 issue、仓库级 patch、隐藏测试、跨文件影响 | 8-12 文件、多模块 bugfix/feature、隐藏断言、不能只改测试。 |
| Terminal/DevOps | 类 Terminal-Bench：沙箱终端、命令失败、验证脚本、artifact | 长 stdout、失败命令、timeout、dev-server、日志落盘、恢复重跑。 |
| Tool/User Policy | 类 tau-bench：多轮用户、工具调用、政策约束、状态数据库 | 权限/成本/claim policy 不能越界，工具调用后状态必须正确。 |
| GUI/Product | 类 OSWorld：真实窗口、跨应用/浏览器/截图、执行式评分 | TUI 可见窗口 + browser/dev-server 截图 + 输入/粘贴/中断恢复。 |

Hard benchmark 必须增加的指标：

- `endToEndPassRate`：最终隐藏测试/验收通过率。
- `firstAttemptPassRate`：第一次方案是否一次过。
- `repairLoopSuccessRate`：故意失败后能否诊断、改、重跑。
- `toolCallEfficiency`：工具调用数、Read 字符、artifact 化比例。
- `costPerSolvedTask`：每个成功任务真实 cost。
- `cacheStability`：stable prefix 是否保持、tool result 是否膨胀。
- `visibleStateCompleteness`：TUI/CLI/final report 是否同源展示状态。
- `claimHonesty`：不能把失败、边界、blocked gate 写成 PASS。

执行原则：

- 默认 `deepseek-v4-flash`；只有高风险 review、失败恢复、规划 admission 才能触发更强模型。
- 必须保留 raw transcripts、tool trace、artifacts、metrics、risks、final report。
- 不能把 internal fixture 说成外部榜单成绩；如果要写外部 benchmark，需要真实 target manifest 和同题 raw logs。

### 9.40 DSXU Hard Engineering Benchmark 真实执行记录 - 2026-05-17

本节把 9.39.4 的 hard benchmark 设计落成可复跑脚本与真实测试结果。目标不是伪造外部榜单，而是用更接近公开 agent benchmark 形态的内部任务证明 DSXU workflow runtime 的价值：同一 DeepSeek Flash 模型下，raw API baseline 只能一次性替换可见源码；DSXU 可以读代码、跑隐藏测试、修复失败、重跑验证、留下 trace/cost/evidence。

#### 9.40.1 新增产物

| artifact | 用途 | 验证 |
|---|---|---|
| `scripts/dsxu-hard-engineering-benchmark.ts` | 9 类 hard engineering benchmark：repo-SWE、terminal/devops、tool-policy、visible-state、DeepSeek route/cache、context recovery、agent merge、MCP/Skill boundary、release claim evidence。 | `bun build scripts/dsxu-hard-engineering-benchmark.ts --target=bun` PASS。 |
| `package.json` | 新增 `benchmark:hard-engineering` 与 `evidence:hard-engineering`，并修复历史 package script 断链。 | package script path health check：`checked=112`、`missing=[]`。 |
| `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.json` | 机器可读 raw vs DSXU 结果、trace path、cost、tool counts、final test log。 | 最新生成时间 `2026-05-16T17:06:21.801Z`。 |
| `docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.md` | GitHub/报告可读版。 | 写明 internal benchmark boundary，不写外部榜单成绩。 |
| `docs/assets/dsxu-hard-engineering-benchmark.svg` | 公开图表草案。 | 展示 raw pass rate 与 DSXU pass rate，不展示外部胜出。 |

#### 9.40.2 最终真实运行结果

最终命令：`bun run benchmark:hard-engineering`

| metric | value | 裁决 |
|---|---:|---|
| status | `PASS_DSXU_HARD_ENGINEERING_LIFT` | 内部 hard-task workflow lift 成立。 |
| total tasks | `9` | 覆盖代码修复、终端恢复、权限/claim、可见状态、DeepSeek 路由、上下文恢复、Agent、MCP/Skill、发布证据。 |
| raw API pass rate | `0%` | raw baseline 允许一次性替换源码，但不能读隐藏测试、运行命令或 repair loop。 |
| DSXU pass rate | `100%` | 9/9 隐藏测试 + 静态信号验收通过。 |
| raw average score | `57.8` | raw 有部分源码替换能力，但隐藏要求不稳。 |
| DSXU average score | `100` | DSXU 在本内部 hard benchmark 上完整通过。 |
| raw total cost | `$0.0017567256` | 单次 API 输出成本低，但不能闭环验证。 |
| DSXU total cost | `$0.0730550856` | 成本更高，换来真实读写、测试、失败恢复和证据。 |
| public90Allowed | `false` | 不能写公开 90/95 或外部胜出。 |
| externalBenchmarkClaimAllowed | `false` | 不能写 SWE-bench / Terminal-Bench / OSWorld / tau-bench 成绩。 |

#### 9.40.3 9 类任务明细

| lane | task | raw | DSXU | 关键验收 |
|---|---|---:|---:|---|
| repo-SWE | `repo-swe-checkout-pricing` | fail / score 50 | pass / score 100 | 多文件 checkout、unknown SKU、bundle、coupon cap、receipt evidence。 |
| terminal/devops | `terminal-devops-result-recovery` | fail / score 50 | pass / score 100 | bounded preview、artifact path、timeout/command_failed、retry plan。 |
| tool-policy | `tool-policy-claim-permission` | fail / score 60 | pass / score 100 | delete signoff、target raw gate、score floor、secret redaction。 |
| visible-state | `visible-product-timeline` | fail / score 70 | pass / score 100 | sorted timeline、bounded detail、canonical projection、blocked state。 |
| DeepSeek runtime | `deepseek-route-cost-cache` | fail / score 60 | pass / score 100 | Flash non-thinking default、Pro admission、FIM lane lock、cache hit rate。 |
| context recovery | `context-recovery-source-truth` | fail / score 60 | pass / score 100 | goal/nextAction retention、stale source hash、memory is not source truth。 |
| agent coordination | `agent-merge-evidence-envelope` | fail / score 50 | pass / score 100 | evidence envelope、transcript stripping、conflict detection、cost/test summary。 |
| MCP/Skill | `mcp-skill-priority-boundary` | fail / score 70 | pass / score 100 | primary priority、secondary conflict、unsafe disabled、Tool Gate boundary。 |
| release evidence | `release-claim-evidence-binder` | fail / score 50 | pass / score 100 | full evidence chain、target manifest gate、no parity overclaim、claim-limited README output。 |

#### 9.40.4 执行中发现并修正的问题

| issue | 处理 |
|---|---|
| 初版 4 题太窄，只证明 workflow lift，不足以代表“高级程序员式复杂任务”。 | 扩展到 9 类 hard tasks，覆盖 V18/V26 的核心闭环。 |
| 初版 hard benchmark status 只要 DSXU 比 raw 高就写 PASS，容易掩盖 partial gaps。 | 改成三态：全部通过才 `PASS_DSXU_HARD_ENGINEERING_LIFT`；部分通过为 `PARTIAL_DSXU_HARD_ENGINEERING_LIFT_WITH_GAPS`；否则 BLOCKED。 |
| 静态验收器误判 Map 型 conflict detection、projector 内 bounded detail、primary priority 实现。 | 修正验收器，仍以 hidden test + 静态信号双重判定。 |
| release claim 任务暴露出品牌/IP风险：即使有 target manifest，输出也不能带 GPT/Claude/95% 这类过界文案。 | 加严 hidden test，最终 DSXU 自动修正并通过；公开 README 只能写 DSXU-owned internal evidence。 |

#### 9.40.5 GitHub 卖点边界

允许写：

- DSXU 提供 DeepSeek-first 工程 runtime：读代码、跑命令、修复失败、复测、记录成本和证据。
- 内部 hard engineering benchmark：9/9 DSXU pass，raw API one-shot baseline 0/9 pass，成本约 `$0.073`。
- 这证明的是 workflow lift，不是模型本体胜出。

不允许写：

- 不允许写公开 90/95 已达成。
- 不允许写外部 benchmark 胜出或通过。
- 不允许写参考品牌 parity 或用参考品牌名字做卖点。
- 不允许把 internal fixture 图表包装成外部榜单。

下一步：把 `docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.md` 与 `docs/assets/dsxu-hard-engineering-benchmark.svg` 接入 GitHub launch pack/README 的“内部可复跑证据”区，同时继续保留 public90/external benchmark claim blocked。

### 9.41 C2/1902 数据资产化与 DeepSeek-first 机制吸收补充 - 2026-05-17

本节补充用户要求的 C2/1902 深度分析口径：1902 不是“已经照搬完成”的功能清单，也不是公开 parity 证据，而是一个可以继续沉淀为 DSXU 产品能力、测试资产、风险门和公开 claim 边界的数据资产池。执行时必须继续遵守：不复制参考源码、prompt、品牌、商业行为；只吸收通用机制，并落回 DSXU 自有 owner、DeepSeek 调度、Tool Gate、Permission Gate、visible-state 和 evidence/release。

#### 9.41.1 C2/1902 数据含义与可资产化方向

| 数据 | 当前含义 | 应转成 DSXU 什么资产 |
|---|---|---|
| `1902 reference files` | 参考产品体验闭环密度样本，不是功能 parity 证据。 | 机制域/角色/场景 taxonomy、体验密度 heatmap、反向场景生成器。 |
| `1096 implemented+tested` | DSXU 已有 owner/test/live 证据的通用机制。 | GitHub strict claims 候选、回归测试入口、owner evidence index。 |
| `601 adapted/excluded` | 品牌、商业、订阅、专属 runtime 或不适合 DeepSeek-first 的逻辑。 | 商业/IP 风险负样本库、release claim linter、禁止吸收清单。 |
| `205 no-loss baseline` | DSXU 不需要新增吸收的 baseline，当前主线无明显能力损失。 | no-loss baseline 证据，防止后续重复实现或引入第二套 runtime。 |
| `594 product-specific` | 最容易产生商标、品牌、商业行为、闭源产品承诺风险。 | public surface redaction 规则、brand/IP scan cases、adapter/exclude policy。 |
| `278 shared utility` | 最容易被误判为“通用就要照搬”的工具类/辅助逻辑。 | shared utility import/use gate：只有真实 owner 调用、测试和价值证据才吸收。 |
| `914 prior blocked public claim rows` | 历史上不能公开夸大的 claim 风险。 | README claim linter、release evidence binder、public claim stop gate。 |
| `13 mechanism classes / 12 scenario roles` | 高级程序员体验闭环抽象池。 | benchmark task generator、TUI/live验收矩阵、DeepSeek route/cache/cost 测试矩阵。 |

#### 9.41.2 值得继续学习并产品化的核心机制

这些机制适合 DSXU，但必须用 DeepSeek-first 方式重构，不能照搬参考产品实现：

| 机制 | DSXU 应吸收的产品形态 | DeepSeek-first 调整 |
|---|---|---|
| 目标/计划/当前动作持续可见 | `work-state-timeline` 成为 TUI/CLI/stream-json/final report 同源状态。 | stable prefix 保存 goal/plan；动态尾部只放当前 step/风险/nextAction。 |
| 工具调用前后有意图、风险、结果、证据 | Tool result pack：purpose、permission、exit/status、preview、artifact、next。 | 长输出落 artifact，只给模型 key lines，保护前缀缓存。 |
| 失败不隐藏，进入 repair loop | FailureTaxonomy -> RepairLoop -> focused test -> final evidence。 | Flash 默认诊断；失败复杂或高风险时 Flash-MAX/Pro admission。 |
| 大文件不反复 Read | Source capsule：path/hash/anchor/excerpt/riskTags；Read 只做 fallback。 | 减少 tool result 回灌，提升 DeepSeek cache 稳定性。 |
| 子 agent 不回灌长 transcript | worker 只回 summary/path/hash/evidence/cost/test。 | 父级上下文只保留 evidence envelope，避免 transcript bloat。 |
| 权限是结构化状态 | permission decision 进入 visible-state 和 final report。 | 模型不能凭自然语言猜权限，必须读 Tool Gate evidence。 |
| TUI 是工作状态投影 | TUI 显示 goal/current/tool/permission/cost/failure/recovery，而非装饰。 | TUI 事件与 final JSON 同源，减少 UI 假状态。 |
| release claim 绑定证据 | 每个卖点必须绑定 source/test/live/raw/cost/cache/release gate。 | public 90/95、外部胜出、parity claim 默认 blocked。 |

#### 9.41.3 还可以继续从 C2/1902 挖出的数据产品

| 数据产品 | 用途 | 验收方式 |
|---|---|---|
| Experience Density Heatmap | 看 DSXU 哪些体验闭环密度低：visible-state、terminal、agent、MCP、release。 | 每个 owner 有 source/test/live/raw/cost evidence，否则不能进入卖点。 |
| Mechanism-to-Test Matrix | 每个机制绑定至少一个 focused test、一个负例、一个 live/window 或 evidence script。 | 防止“文档说吸收了，代码没验收”。 |
| Blocked Claim Corpus | 把 914 blocked rows 转成 README/launch pack 的禁止语料。 | README/文档生成后自动扫描品牌、parity、外部胜出、90/95 误写。 |
| Shared Utility Absorption Gate | 278 shared utility 只有 import/use + owner value + test evidence 才能保留。 | 没有真实调用价值的进入 no-loss baseline 或 replace/delete review。 |
| Product-specific Exclusion Map | 594 product-specific 只保留通用机制，不保留品牌/商业/专属 runtime。 | release preflight 输出 exclude/adapt 解释，不让历史参考语义外露。 |
| Scenario Generator | 用 13 机制类 × 12 角色生成复杂任务和真实 TUI 验收任务。 | 任务必须包含失败、权限、工具、成本、恢复、final report。 |
| DeepSeek Cache Stress Pack | 专测大 Read、长 stdout、tool result bloat、source capsule 对 cache 的影响。 | 输出 cache hit/miss、cost、tool chars、score 不下降。 |
| Agent Evidence Envelope Pack | 专测子 agent 并行、冲突、回传摘要、父级引用 evidence。 | 父级 final 未引用 worker evidence 必须失败。 |
| Release Claim Binder Pack | 专测 GitHub 卖点是否每条都回指 source/test/live/raw/cost。 | 缺任何关键证据或出现品牌/parity 词时阻断。 |
| Workspace/Core Safety Pack | 专测用户项目与 DSXU core 隔离，防误改产品核心代码。 | FileEdit/Bash/Agent/MCP/Skill 写 DSXU install root 必须被拒。 |

#### 9.41.4 C2/1902 对 V26 后续执行的硬要求

1. `1096 implemented+tested` 只能作为 DSXU-owned mechanism evidence，不允许升级成参考产品 parity。
2. `601 adapted/excluded` 必须继续服务商业/IP 风险控制；其中任何通用机制若要吸收，必须重新落 DSXU owner，不得恢复品牌/商业专属路径。
3. `278 shared utility` 不能因为“通用”就保留；必须按真实 import/use、owner value、测试证据决定 keep / no-loss baseline / replace-delete。
4. `914 prior blocked public claim rows` 要进入 README claim linter 和 release claim binder，不允许人工绕过。
5. 公开复核能力必须另建同题 raw evidence pack：DSXU raw transcript、target/reference raw transcript、tool trace、final report、artifacts、metrics、risks、cost 和 scorer。
6. DeepSeek 默认仍是 Flash；Flash-MAX/Pro 只在 admission evidence 明确时使用。C2/1902 不能成为“默认上 Pro”的理由。
7. 所有新增体验能力必须投影到 TUI/CLI/stream-json/final report，不能只在 docs 或 generated evidence 中存在。
8. Hard benchmark、public challenge、README 图表必须引用最新复跑结果；若最新 evidence 是 PARTIAL，则公开文案必须写 PARTIAL 或 blocked，不能沿用旧 PASS。

#### 9.41.5 下一步执行顺序

| 顺序 | 动作 | 目的 |
|---:|---|---|
| 1 | 修复 hard benchmark 当前 `release-claim-evidence-binder` 的 `no parity overclaim` 信号缺口，并重跑 `benchmark:hard-engineering`。 | 先把内部 hard benchmark 恢复到真实全绿，再接 GitHub 图表。 |
| 2 | 把 `Blocked Claim Corpus` 接入 README/launch pack 生成与 release preflight。 | 防止 914 历史风险行重新变成公开夸大文案。 |
| 3 | 把 `Workspace/Core Safety Pack` 做成 Product Core Guard 验收。 | 防止用户项目操作误写 DSXU 核心代码。 |
| 4 | 用 `13 mechanism classes / 12 scenario roles` 生成下一批真实 TUI senior-coding window 任务。 | 找交互 bug，而不是只跑脚本。 |
| 5 | 建立 Public Reproducible Evidence Pack v1。 | 为未来 public 90 左右能力 claim 准备可复核数据，而不是靠内部口号。 |

### 9.42 Release Claim Binder / Blocked Corpus / Product Core Guard 执行记录 - 2026-05-17

本轮按 9.41 的硬顺序先修公开声明证据缺口，再接 blocked claim corpus 和 Workspace/Core Safety Pack。执行口径仍是：不把 C2/1902 映射当参考产品 parity；不把 70 PASS 当完整公开能力 claim；所有 GitHub 卖点必须回指 source/test/live/raw/cost/cache evidence。

#### 9.42.1 hard benchmark release-claim-evidence-binder 信号缺口

| 项 | 结果 |
|---|---|
| 问题 | 完整 hard benchmark 最新总报告仍是 `PARTIAL_DSXU_HARD_ENGINEERING_LIFT_WITH_GAPS`，唯一失败任务为 `release-claim-evidence-binder`；其功能测试已过，但源码里仍残留外部品牌/parity/percent claim token，导致 `no parity overclaim` 信号缺失。 |
| 修复 | `scripts/dsxu-hard-engineering-benchmark.ts` 将 release claim 任务要求收紧：README 不能夸大，`src/claim.ts` 本身也不能在 string/comment/regex 中残留外部品牌、parity、percent claim token；推荐正向 DSXU-owned evidence allowlist。 |
| 工程化 | hard benchmark 增加 `DSXU_HARD_BENCHMARK_TASK` 单题过滤，输出带任务后缀，不覆盖完整 9 题总报告。 |
| 真实复跑 | `DSXU_HARD_BENCHMARK_TASK=release-claim-evidence-binder bun run scripts/dsxu-hard-engineering-benchmark.ts`。 |
| 复跑结果 | `PASS_DSXU_HARD_ENGINEERING_LIFT`，`totalTasks=1`，raw pass rate `0%`，DSXU pass rate `100%`，raw score `60`，DSXU score `100`。 |
| 信号 | `evidence binding`、`target manifest gate`、`no parity overclaim`、`claim limited README` 全部出现。 |
| 证据 | `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.json`、`docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.md`。 |
| 边界 | 本轮关闭 release-claim 单题缺口；完整 9 题 hard benchmark 总报告仍需后续全量复跑，不能用单题 PASS 冒充全量 PASS。 |

#### 9.42.2 Blocked Claim Corpus

| 项 | 结果 |
|---|---|
| 新增脚本 | `scripts/dsxu-blocked-claim-corpus.ts`。 |
| npm/bun 入口 | `evidence:blocked-claim-corpus`。 |
| 输入 | C2 owner implementation acceptance、V18 capability acceptance audit、hard benchmark 总报告和单题 override proof。 |
| 输出 | `docs/generated/DSXU_BLOCKED_CLAIM_CORPUS_20260517.json`、`docs/generated/DSXU_BLOCKED_CLAIM_CORPUS_20260517.csv`、`docs/DSXU_BLOCKED_CLAIM_CORPUS_20260517.md`。 |
| 当前结果 | `PASS_BLOCKED_CLAIM_CORPUS_GENERATED`，总 rows `958`。 |
| 分布 | C2/1902 blocked rows `914`；V18 capability claim-limited rows `44`；hard benchmark blocked rows `0`（release-claim 单题 targeted proof 已覆盖旧缺口）。 |
| 作用 | GitHub README、launch pack、benchmark 图表、release note 只能从 allowed boundary 写卖点；reference parity、public 90/95、外部胜出、standalone runtime、品牌复制类 claim 必须保持 blocked。 |

#### 9.42.3 Product Core Guard / Workspace-Core Safety Pack

| 项 | 结果 |
|---|---|
| 主实现 | `src/dsxu/engine/workspace-policy.ts` 增加 `evaluateProductCoreGuard`、`getProductCoreGuardRootsFromEnv`、`isProductCoreGuardBypassed`。 |
| 真实接入 | `src/utils/permissions/filesystem.ts` 的 `checkPathSafetyForAutoEdit` 已接 Product Core Guard；FileEdit/FileWrite 写入检查会走同一安全路径。 |
| 保护根 | `DSXU_PRODUCT_CORE_ROOT`、`DSXU_INSTALL_ROOT`、`DSXU_PRODUCT_CORE_ROOTS`。 |
| 允许边界 | read 允许；write/execute 默认阻断；仅 `DSXU_ALLOW_PRODUCT_CORE_MUTATION=1` 或 `DSXU_DEV_ALLOW_CORE_MUTATION=1` 显式开发 override 可放行。 |
| 测试 | `src/dsxu/engine/__tests__/product-core-guard.test.ts`。 |
| focused 验证 | Product Core Guard 4 pass；合并 visible-state、cost-quality、agent/MCP/skill、external adapter、public ablation focused suite 后 22 pass / 0 fail / 128 expects。 |

#### 9.42.4 当前未做完的真实边界

1. 完整 9 题 hard benchmark 全量复跑本轮被 20 分钟上限中断；已终止残留 benchmark `bun test` 进程，后续要用更长上限或分 lane 批量跑，不能把单题 PASS 写成全量 PASS。
2. Blocked Claim Corpus 已生成，但还没接入 README/launch pack 生成器和 release preflight 的自动扫描。
3. Product Core Guard 已接 FileEdit/FileWrite 安全检查；Bash/PowerShell/Agent/MCP/Skill 对产品核心根的显式写/执行投影，还要继续接到各自 Tool Gate evidence。
4. 下一步继续：把 blocked corpus 接入 GitHub launch pack / release preflight，再扩展 Workspace/Core Safety Pack 到 Bash/PowerShell/Agent/MCP/Skill，最后再跑真实 TUI senior-coding window 和六阶段最终测试。

### 9.43 TUI 长内容缩放/resize sticky-bottom 体验修复 - 2026-05-17

用户真实窗口反馈：内容变多后，终端窗口放大/缩小或字体缩放时，视图没有回到底部，容易一直顶在前面内容，影响高级程序员式实时跟随体验。

| 项 | 结果 |
|---|---|
| 根因 | `useVirtualScroll` 在 terminal columns 变化时会冻结旧 mounted range 两帧以降低 resize 卡顿；但它没有区分“用户主动查看历史”和“ScrollBox 正 sticky 到底部”。sticky 到底部时也冻结旧 range，会导致 resize/zoom 后尾部没有立即挂载，用户看到旧内容。 |
| 修复 | `src/hooks/useVirtualScroll.ts` 增加 `getResizeFrozenRange` 与 `isEffectivelyStickyScroll`：只有用户真实离开底部阅读历史时才冻结旧 range；即使 sticky flag 被空滚动/终端事件打断，只要视图位置仍在底部，也按 bottom-follow 处理，resize 后直接走 tail range。 |
| 测试 | `src/hooks/__tests__/useVirtualScroll-resize.test.ts` 验证 sticky bottom 不冻结、scrollback 阅读态才冻结、视觉底部但 flag 断开的情况仍按 sticky 处理、主动向上滚动不被抢回底部。 |
| focused 验证 | `bun test src/hooks/__tests__/useVirtualScroll-resize.test.ts`：4 pass / 0 fail。 |
| 真实窗口 smoke | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "starts the real WSL TUI"`：1 pass / 0 fail，确认真实 TUI 可启动、显示欢迎/提示、发送 `/exit` 并干净退出。 |
| 边界 | sticky-bottom resize 逻辑已修；下一节已把 real TUI harness 扩展为 PTY rows/cols ioctl 长内容 resize 专测，避免只靠逻辑单测覆盖体验问题。 |

### 9.44 Real TUI PTY Resize 高级体验回归 - 2026-05-17

本节回应真实窗口反馈：“内容一多就弹到前面，不能固定在下面，操作体验差”；随后又复现了更具体的问题：用户正在中间阅读 scrollback 时放大/缩小窗口，TUI 会自动跳到头部。V26 不再只做启动 smoke，而是把长内容、窗口缩放、贴底、中段阅读、权限、恢复、背景任务等高级体验纳入真实 TUI harness。

| 项 | 结果 |
|---|---|
| harness 扩展 | `src/dsxu/integration/harness/real-tui-harness.ts` 增加 `longContentResizeReplay`、`scrollbackResizeReplay` 与 `resizeSequence`，通过 PTY `TIOCSWINSZ` ioctl 真实设置 rows/cols，并向进程发送 `SIGWINCH`。 |
| 长内容注入 | `src/screens/REPL.tsx` 增加 `DSXU_CODE_TUI_HARNESS_LONG_CONTENT_RESIZE`，在真实 REPL 内注入 180 行工作状态/工具证据/权限/成本/恢复/agent/release 相关长内容，并记录 lifecycle trace；`DSXU_CODE_TUI_HARNESS_SCROLLBACK_RESIZE` 会把视图定位到中段后再执行 resize。 |
| sticky-bottom 专测 | `src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts` 新增 `long-content-resize-sticky-bottom`：真实启动 TUI，注入长内容，连续切换 `18x80 -> 34x140 -> 14x62 -> 30x118`，要求 resize 后仍看到 tail marker 与 prompt。 |
| middle-scrollback 专测 | `src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts` 新增 `middle-scrollback-resize-anchor`：真实启动 TUI，注入长内容，先离开底部到中段阅读，再执行同一组 PTY resize；要求 resize 后仍看到中段行，不能出现 `ROW_001` 头部，也不能跳到 tail。 |
| permission-review 组合专测 | `src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts` 新增 `permission-review-after-long-content-resize`：真实启动 TUI，先注入长内容并执行 PTY resize，再触发权限审核 replay；要求审核面板、proceed question、fallback bar 和 resize 后的 review 状态都可见，不能因为长内容或缩放导致审核入口消失。 |
| 产品修复 | `src/ink/components/ScrollBox.tsx` 记录非 sticky 阅读位置与 maxScroll，显式 `scrollTo` 会清掉旧 virtual-scroll clamp；`src/ink/render-node-to-output.ts` 在 resize 时按旧/新 maxScroll 保持中段锚点，并让 ScrollBox full render path 进入 viewport clip；`src/ink/dom.ts` 增加对应 DOM scroll state。 |
| permission regression 修复 | 用户反馈 resize 修复后执行过程里“需要弹出审核时不见了”。复测发现审核面板实际已经渲染，但组合 harness 仍只等待普通底部 prompt，长内容/缩放后会把可交互的 permission review 误判成不可输入状态；`src/dsxu/integration/harness/real-tui-harness.ts` 已把 permission dialog/fallback 也作为可交互状态，并补充 `sawPermissionDialog`、`sawPermissionProceedQuestion`、`sawPermissionDialogAfterResize` 三个真实可见性信号。 |
| sticky targeted 验证 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps long-content TUI output pinned"`：1 pass / 0 fail / 18 expects，耗时约 19.97s。 |
| middle targeted 验证 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"`：1 pass / 0 fail / 16 expects，耗时约 18.92s。 |
| permission targeted 验证 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "permission review visible"`：1 pass / 0 fail / 17 expects，耗时约 19.93s。 |
| 全量真实 TUI 回归 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts`：12 pass / 0 fail / 185 expects，覆盖启动、显式退出、权限提示、无进度恢复、模型任务认证/进度、工具结果自动继续、compact 恢复、背景任务 pill、长内容 sticky resize、permission review after resize、中段 scrollback resize。 |
| 配套 focused 回归 | `bun test src/ink/__tests__/render-node-scroll-resize.test.ts src/hooks/__tests__/useVirtualScroll-resize.test.ts`：7 pass / 0 fail / 8 expects。 |
| 当前裁决 | 本轮已修复并用真实 PTY resize 证明：底部跟随不会 resize 后滞留旧内容；用户在中段阅读时放大/缩小窗口不会自动跳头或跳尾；长内容/缩放后触发权限审核也必须保持可见、可退出、可继续交互。后续若再出现“放大/缩小后顶到前面”或“审核弹层不见”，应先查看 `long-content-resize-sticky-bottom`、`permission-review-after-long-content-resize`、`middle-scrollback-resize-anchor` transcript/trace，而不是继续补文档。 |

### 9.45 DSXU_V1_OPTIMIZATION_PLAN 并入 V26 待处理审计 - 2026-05-17

本节按用户要求，在继续测试前审计 `docs/DSXU_V1_OPTIMIZATION_PLAN.md`。裁决：V1 计划不能重新变成一条新主链；它只作为 V26 的历史优化输入。已经被 V20/V24/V26 吸收的项不重复做，仍缺真实实现或公开入口的项并入 V26 待处理队列。

#### 9.45.1 总体裁决

| 类别 | 数量 | 裁决 |
|---|---:|---|
| 已吸收/已有证据 | 9 | 继续随 V26 回归，不单独开 V1 任务。 |
| 部分吸收，需要 V26 收口 | 15 | 合并到现有 owner：Tool Gate、Action Contract、Context/Cache、Evidence、Release Claim、Experience。 |
| 明确未完成，需要先处理 | 6 | 进入 V26 测试前问题队列，优先处理真实 runtime defect 和 public surface 缺口。 |
| 不做/保持非目标 | 0 | V1 non-goals 全部保留为 V26 边界，不写成产品能力。 |

#### 9.45.2 30 项逐项裁决

| V1 # | V26 裁决 | 证据/现状 | V26 待处理动作 |
|---:|---|---|---|
| 1 | `OPEN-P0` | `src/services/contextCollapse` 目录不存在，但 `src/query.ts`、context 命令、TokenWarning 等仍在 `feature('CONTEXT_COLLAPSE')` 下 dynamic require。 | 增加缺失模块 guard/no-op fallback 或彻底把旧 contextCollapse runtime gate 收回，防止 feature 打开即 runtime crash。 |
| 2 | `OPEN-P0-SMALL` | `src/tools.ts` 仍重复检查 `DSXU_CODE_SIMPLE` 两次，第二项应为 provider-migration alias 或移除。 | 合并重复 simple-mode 判断，补 focused test，避免旧 provider alias 文案假通过。 |
| 3 | `ABSORBED` | `RunNativeTestTool`、`CollectEvidenceTool`、semantic tool trace、query verification 路径已存在；V20/V26 有 owner gate 和测试证据。 | 保留进入最终六阶段；不再回到模拟 verification。 |
| 4 | `ABSORBED` | `TOOL_SURFACE.md` 和 tool-definition owner tests 已覆盖 RunNativeTest/CollectEvidence。 | 最终测试只证明，不替代功能判断。 |
| 5 | `PARTIAL-REPLACE` | `scripts/regression-check.ts` 不存在；但已有 `benchmark:hard-engineering`、`test:six-stage-final`、`evidence:*`。 | 不新增第二套 runner；增加一个 V26 regression rollup/README 命令索引，把固定本地场景、route/cost/failure category 汇总到现有 evidence 体系。 |
| 6 | `PARTIAL-PUBLIC-DOC` | `docs/BENCHMARK.md` 不存在；已有 hard benchmark/product benchmark/public challenge 文档。 | 增加公开 `docs/BENCHMARK.md` 索引页，只引用真实 raw/cost/cache/score 证据，不写外部胜出或 90/95 达成。 |
| 7 | `PARTIAL-P0` | Work-state timeline、Tool Gate、Product Core Guard 已有，但“写前短 Action Contract”未作为所有写路径统一前置契约。 | 做 DSXU Action Contract v2：目标、允许文件、下一工具、验证命令、失败回退进入 visible-state。 |
| 8 | `PARTIAL-P0` | FileEdit/FileWrite 已接 Product Core Guard；Bash/PowerShell/Agent/MCP/Skill 对写/执行的 scope 投影仍在 9.42.4 未完成。 | 把 Action Contract scope 与 Product Core Guard 投影到 shell/agent/MCP/skill evidence，不新增第二套 permission runtime。 |
| 9 | `PARTIAL` | `transaction-manager.ts` 和 rollback tests 存在；默认自动 rollback 仍需谨慎，agent-owned changed-file ledger/live proof 不完整。 | 只允许当前 agent action 内文件回滚；补 changed-file ledger + rollback drill evidence。 |
| 10 | `OPEN-P1` | `docs/DEEPSEEK_V4_CAPABILITIES.md` 不存在；V26 分散记录了能力/成本/cache 口径。 | 新增官方来源核验版 DeepSeek capability truth doc；实现时必须查官方文档，不用旧记忆写 1M/384K 等可能变动事实。 |
| 11 | `PARTIAL` | query prompt-too-long/413 recovery 有实现和合同测试；缺真实 provider 413/live 复核。 | 加 DeepSeek prompt-too-long compatibility focused/live test，证明 compact/retry 不丢 source truth。 |
| 12 | `PARTIAL` | `autoCompact.ts` 已 model-aware effective window + env percent override，但仍主要是固定 buffer。 | 设计 strategy-based threshold，不牺牲 DeepSeek cache-safe prefix。 |
| 13 | `PARTIAL` | compact tests 存在，但未形成 70/85/95/99 context pressure matrix。 | 加 context pressure regression matrix，接入 V26 regression rollup。 |
| 14 | `PARTIAL` | source truth、timeline、compact/resume 已有；P0/P1/P2 context priority label 未全局统一。 | 统一 context priority labels：任务、最新错误、active plan、verification state 固定，旧 tool history 可 compact。 |
| 15 | `PARTIAL` | recovery/bug-brain/telemetry 有 frequency 概念；UI/TUI 自适应 warning 不完整。 | repeated failure warning 投影到 visible-state，不变成自言自语噪声。 |
| 16 | `PARTIAL` | `experience-store.ts` 有 confidence/source/createdAt；expiry 在 memory/search 等处有实现但 experience-store 本身未统一。 | 给 experience-store 加 expiry/staleness 降级；memory 仍只能导航，不能替代 source truth。 |
| 17 | `ABSORBED` | coding profile/tool visibility 已由 tool surface、semantic tools、DSXU profile 处理。 | 随 final regression。 |
| 18 | `PARTIAL` | `gear-box.ts` 和 query-loop gear-box tests 存在。 | 把 gear-box 与 DeepSeek route/admission、Action Contract、recovery visible-state 重新对齐，不能成为第二套路由。 |
| 19 | `PARTIAL-P0` | complexity/classifier 模块很多，但写操作复杂度尚未统一驱动 Action Contract。 | 单文件低风险走轻契约；多文件/高风险必须 Action Contract + verification。 |
| 20 | `PARTIAL` | 工具 schema 和 prompts 有结构，但 high-risk Edit/Agent 参数模板不完整。 | 为 Edit/Write/Agent 增加高风险参数模板和缺参 guard，绑定 Tool Gate evidence。 |
| 21 | `PARTIAL-PUBLIC-DOC` | benchmark scripts 记录 model/route/cost；缺统一 public sampling policy 文档。 | 合入 `docs/BENCHMARK.md`，明确 model id、thinking、temperature、route decision、raw log。 |
| 22 | `PARTIAL` | naming governance、providerMigration owner 已做大量收口；仍有 provider-named feature gates/public surface 风险。 | 继续 feature gate audit：运行时 DSXU-owned，兼容层只保留必要 alias。 |
| 23 | `OPEN-P1` | `USER_TYPE === 'ant'` call sites 仍大量存在；不能批删。 | 生成 USER_TYPE call-site 分类板：build-time DCE、compat、runtime path、cleanup candidate。 |
| 24 | `P2-CANDIDATE` | 没有独立 PreEditCheck；已有 source capsule/impact radar/verification guard。 | 后续作为 Edit preflight helper，先不阻塞当前 P0。 |
| 25 | `P2-CANDIDATE` | 没有独立 TestSkeleton helper。 | 后续并入 Test Selection Intelligence，不新增模板垃圾。 |
| 26 | `P2-CANDIDATE` | 没有独立 BlameContext helper。 | 后续并入 risk/owner review evidence，避免每次编辑前过重。 |
| 27 | `PARTIAL` | work-state timeline 有 goal/plan/nextAction；“每 5 步总结”不是统一机制。 | 做 long-task milestone policy：按真实阶段/风险触发，不按机械 5 步制造噪声。 |
| 28 | `PARTIAL` | cost/quality/benchmark evidence 有，但 local quality telemetry summary 未形成用户可读板。 | 汇总 edit pass rate、verification pass rate、repair turns、重复失败到 GitHub/internal metrics。 |
| 29 | `PARTIAL` | usage/cost/cache tokens 已记录；gateway id/model fingerprint 只能在 provider 暴露时记录。 | 在 trajectory schema 中补 optional gateway/model fingerprint，禁止伪造。 |
| 30 | `PARTIAL` | V26 文档已有大量决策记录；代码关键点 ADR/decision comments 没有统一格式。 | 对 routing/verification/cache/permission 核心决策补轻量 ADR，不写空注释。 |

#### 9.45.3 测试前 V26 新增待处理排序

1. `P0-runtime-defect`：处理 `contextCollapse` missing runtime path 和 `DSXU_CODE_SIMPLE` duplicate check。  
2. `P0-write-safety-contract`：把 Action Contract v2 与 Product Core Guard scope 接到 Edit/Write/Bash/PowerShell/Agent/MCP/Skill 的同一 Tool Gate evidence。  
3. `P0-verification-integrity`：确认 RunNativeTest/CollectEvidence/final report 仍只作为真实验证证据，不被 simulated PASS 或小测试冒充。  
4. `P1-public-doc-truth`：新增 `docs/BENCHMARK.md` 与 `docs/DEEPSEEK_V4_CAPABILITIES.md`，前者引用现有真实证据，后者实现时必须以官方 DeepSeek 文档核验。  
5. `P1-context-pressure`：补 context pressure matrix 与 prompt-too-long/413 compatibility evidence。  
6. `P1-brand-compat-risk`：分类 `USER_TYPE === 'ant'` call sites 和 provider-named feature gates，不能批删，也不能带品牌风险进入 GitHub 发布面。  
7. `P2-engineering-polish`：PreEditCheck、TestSkeleton、BlameContext、local quality telemetry、light ADR 作为后续产品体验增强，不阻塞当前 P0 收口。

当前裁决：V1 文档内容有价值，但 V26 不能按 V1 重新开新版本线。真正需要立刻做的是 1、2、7、8、19、23 这些会影响 runtime 稳定、写入安全、品牌/公开风险的项；其余已经吸收或应作为 P1/P2 产品化增强排队。
### 9.46 V1 P0 runtime defect 执行记录 - 2026-05-17

本轮按 9.45 的排序先处理测试前硬缺口，不新增 V1/VXX 主链，不新增第二套 context 或 tool runtime。

| 项 | 执行结果 |
|---|---|
| V1 #1 contextCollapse missing runtime path | 已补 `src/services/contextCollapse/index.ts`、`operations.ts`、`persist.ts`。当前裁决不是恢复旧 collapse 主链，而是 DSXU runtime guard：`isContextCollapseEnabled()` 固定返回 false，让 autocompact/microcompact 继续作为上下文 owner；query、setup、resume、context command、TokenWarning 的 dynamic require 不再因为目录缺失崩溃。 |
| V1 #2 simple-mode duplicate check | `src/tools.ts` 已把重复 `DSXU_CODE_SIMPLE || DSXU_CODE_SIMPLE` 收口为 `isDsxuCodeEnvTruthy('SIMPLE')`，同一入口同时支持 DSXU env 与 provider-migration alias。`getDsxuToolRegistryRuntimeProfile().simpleModeEnv` 已去重。 |
| 相邻重复判断 | `DSXU_CODE_VERIFY_PLAN` 的重复判断同步收口为 `isDsxuCodeEnvTruthy('VERIFY_PLAN')`，避免同类假别名证据继续残留。 |
| 测试证据 | `bun test src/services/contextCollapse/contextCollapseFallback.test.ts`：4 pass / 0 fail / 7 expects。 |
| 工具注册 focused 证据 | `bun test src/tools/__tests__/tool-registry-simple-mode.test.ts`：2 pass / 0 fail / 4 expects。 |
| 相邻 owner 回归 | `bun test src/services/contextCollapse/contextCollapseFallback.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts src/tools/__tests__/tool-permission-owner-gate.test.ts`：11 pass / 0 fail / 29 expects。 |
| build smoke 说明 | `bun build src/query.ts --target=bun` 仍被既有 optional/dynamic modules 阻断，包括 `cachedMicrocompact.js`、`snipCompact.js`、`protectedNamespace.js`、`sharp`、`@aws-sdk/client-bedrock`、`@azure/identity`、OpenTelemetry exporters 等；本轮新增的 `contextCollapse` 路径不再出现在缺失列表。 |

当前裁决：9.45 的 `P0-runtime-defect` 已完成代码与 focused 回归；下一步继续按 9.45.3 处理 `P0-write-safety-contract`，把 Action Contract v2 / Product Core Guard scope 投影到 Edit/Write/Bash/PowerShell/Agent/MCP/Skill 的同一 Tool Gate evidence。
### 9.47 V1 P0 write-safety / verification-integrity 执行记录 - 2026-05-17

本轮继续执行 9.45.3，不新增第二套 permission/runtime。Action Contract 只作为 DSXU Tool Gate / Product Core Guard / visible-state 的写操作合约证据。

| 项 | 执行结果 |
|---|---|
| Action Contract v2 | 新增 `src/dsxu/engine/action-contract.ts`，定义 `dsxu.action-contract.v2`：goal、allowedFiles、nextTool、verificationCommand、fallbackPlan、riskLevel、Tool Gate owner。 |
| 写操作复杂度 | `classifyDSXUWriteOperationComplexity` 区分 single-file low-risk 与 multi-file / permission / tool / query-loop / Agent / MCP / Skill / provider / release / product-core / external / destructive 高风险路径；高风险必须带 contract。 |
| scope enforcement | `evaluateDSXUActionContractScope` 对目标路径做 allowedFiles scope fence 判定；越界写入返回 `block + deny`，不允许 shell/script/agent/adapter 绕过。 |
| Product Core Guard 优先级 | Product Core Guard decision 可以传入 Action Contract scope evaluator；只要 product-core guard 阻断，合约本身允许也必须 block。 |
| visible-state 投影 | `projectDSXUActionContractToWorkStateEvent` 把 contract/scope/gate decision 投影成 permission event，归属 `Tool Gate`，供 TUI/CLI/final report 同源展示。 |
| prompt governance | `src/constants/prompts.ts` 的 DSXU Prompt Governance Contract 增加 `Write Action Contract` 节，要求 Edit/Write/Bash/PowerShell/Agent/MCP/Skill 写入、执行或状态 mutation 前保持 goal/scope/nextTool/verification/fallback。 |
| focused tests | `bun test src/dsxu/engine/__tests__/action-contract.test.ts`：5 pass / 0 fail / 17 expects。 |
| adjacent owner tests | `bun test src/dsxu/engine/__tests__/product-core-guard.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts`：9 pass / 0 fail / 48 expects。 |
| prompt contract test | `bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts -t "default mainline prompt exposes"`：1 pass / 0 fail / 14 expects。 |
| verification integrity tests | `bun test src/tools/RunNativeTestTool/RunNativeTestTool.test.ts src/dsxu/engine/__tests__/semantic-tool-layer-v1.test.ts`：7 pass / 0 fail / 31 expects；`bun test src/dsxu/engine/__tests__/query-route-verification-v1.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts`：11 pass / 0 fail / 54 expects。 |

当前裁决：9.45.3 的 `P0-runtime-defect`、`P0-write-safety-contract`、`P0-verification-integrity` 已完成 focused 代码收口和相邻 owner 回归。剩余按顺序转入 `P1-public-doc-truth`、`P1-context-pressure`、`P1-brand-compat-risk`，最后再做真实窗口和六阶段完整测试。

### 9.48 P1 public-doc-truth / context-pressure / brand-compat-risk 执行记录 - 2026-05-17

本轮继续按 9.45.3 的顺序处理三个 P1，不新增 VXX 主链，不新增第二套 context/provider/permission/runtime。目标是把 GitHub 发布面、DeepSeek 官方能力真值、高压上下文恢复、品牌/兼容风险全部接回现有 evidence/release owner。

| 项 | 执行结果 |
|---|---|
| P1-public-doc-truth | 新增 `docs/BENCHMARK.md`，把 hard engineering benchmark、raw API vs DSXU、product benchmark data pack、public challenge、blocked claim corpus、capability acceptance/cost crosswalk 统一成公开证据索引。文档明确：没有同题 target/reference raw transcript、tool trace、final report、artifacts、metrics、risks 和 scorer 时，不允许写外部榜单胜出、品牌 parity 或固定百分比能力 claim。 |
| DeepSeek capability truth | 新增 `docs/DEEPSEEK_V4_CAPABILITIES.md`，只引用 DeepSeek 官方文档入口：chat completion、thinking mode、JSON output、function calling、FIM completion、context caching、pricing/cache pricing。DSXU 解释层保持 Flash-first；Flash thinking/Flash-MAX/Pro 必须有 admission reason；cache hit rate 是优化指标，不是硬发布 gate。 |
| P1-context-pressure | 新增 `src/dsxu/engine/context-pressure-matrix.ts`，把原来 query prompt 的 70/85 桶扩成 `<70`、`70-84`、`85-94`、`95-98`、`>=99`。`src/query.ts` 的 `buildDsxuContextBudgetSystemContext` 已接入同一决策矩阵，继续归属 Query Recovery / Prompt Cache owner，不形成第二套 context runtime。 |
| prompt-too-long / 413 compatibility | context-pressure 矩阵现在显式输出 `promptTooLongCompatibility`、`cachePolicy`、`sourceTruthReread`。95/99 压力下要求 source capsule、tool-result artifact preview、route/cache latch、reactive compact recovery，不能用 compacted memory 替代 source truth。 |
| P1-brand-compat-risk | 新增 `src/dsxu/engine/brand-compat-risk-board.ts` 和 `scripts/dsxu-brand-compat-risk-board.ts`，生成 `docs/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md` 与 `docs/generated/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.json`。分类只做 owner review evidence，不自动删除、不 stage、不 rewrite。 |
| brand board 最新结果 | `PASS_DSXU_BRAND_COMPAT_RISK_BOARD_GENERATED`；`status=DONE_EVIDENCED`；`scannedFileCount=2977`；`occurrenceCount=8576`；`publicSurfaceBlockerCount=0`；`runtimeCleanupCandidateCount=2602`。结论：公开发布面当前没有 blocker，但运行时/CLI 文本里还有大量 provider-migration 命名 cleanup candidate，后续要按 owner 合并，不可写成卖点。 |
| release-surface 修复 | 相邻回归发现 `scripts/dsxu-hard-engineering-benchmark.ts` 的测试 fixture 直接写了参考品牌 token，`docs/DSXU_V1_OPTIMIZATION_PLAN.md` 也有直写；已改为中性 reference-product/运行时构造 fixture，保留反过度 claim 测试，不把品牌词带进 release surface。 |
| npm 入口 | `package.json` 新增 `evidence:brand-compat-risk`，用于后续 release preflight / GitHub launch pack 前先看品牌兼容风险板。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/public-doc-truth.test.ts src/dsxu/engine/__tests__/context-pressure-matrix.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts` | 8 pass / 0 fail / 42 expects。 |
| `bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts -t "context"` | 3 pass / 0 fail / 27 expects。 |
| `bun test src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts` | 11 pass / 0 fail / 73 expects。 |
| 合并 focused 回归：`public-doc-truth` + `context-pressure` + `brand-compat` + `release-surface` + `model-public-surface` | 20 pass / 0 fail / 116 expects。 |

当前裁决：`P1-public-doc-truth`、`P1-context-pressure`、`P1-brand-compat-risk` 已完成代码/文档/证据/相邻 release 回归。不能把 `runtimeCleanupCandidateCount=2602` 当失败，也不能当卖点；它是下一轮 owner cleanup 队列。下一步按 V26 剩余顺序进入 P2 engineering polish 或真实窗口/六阶段最终测试前的 runtime cleanup owner 分批收口。

### 9.49 新增 pipeline 模块主链融合收口 - 2026-05-17

本节处理用户追问的“新增 TDD / SWE / DAG / dashboard / cache / health 模块是否又形成多层入口”。裁决：这些模块不能作为第二套主链、第二套 benchmark、第二套 verification runtime 或独立产品入口保留；有价值的部分必须并入现有 owner。

| 项目 | 收口结果 |
|---|---|
| 总原则 | 只保留 `CLI/TUI/API -> query-loop/work-state -> PlanGraph/context/recovery -> DeepSeek route/cost/cache -> Tool Gate/Permission -> tools -> VerificationKernel/Evidence/Release -> visible-state/final report` 这一条主链。 |
| package 独立入口 | 已移除新增的 `benchmark:swe-bench`、`evidence:dashboard`、`health:runtime`、`cache:warm` 脚本入口，避免把内部证据模块包装成产品主入口。 |
| Write/Edit 后置验证 | 新增 `src/dsxu/engine/post-mutation-verification-envelope.ts`，把 FileWrite/FileEdit 的 static analysis 与 post-mutation verification 合成 `Tool Gate / VerificationKernel` evidence envelope；blocking 失败会输出 owner、file、rollback strategy、failed gates、nextAction，不再只是抛一个散乱 error。 |
| TDD hook 语义 | `invokePostWriteTddGate` 默认从 `full-test` 改为 `post-mutation-verification`，避免写后再跑“红绿 TDD”这种语义错误；只有显式 `mode: full-test` 或环境变量指定时才跑完整 TDD runner。 |
| SWE owner | `src/services/eval/swe-bench` 现在区分 `internal-smoke` 和 `real-benchmark`。内部 smoke 明确 `publicBenchmarkClaimAllowed=false`；真实 benchmark claim 必须另有固定 manifest、raw transcript、rubric 和 paired evidence。 |
| SWE judge | `SweBenchJudge` 已禁止用 patch 相似度替代测试通过；`patchMatch=1` 但 `testsPassed=false` 时仍为 `FAIL`。 |
| Evidence dashboard | `scripts/dsxu-evidence-dashboard.ts` 改为 release-claim binder input：只聚合显式 `scoreFloor/score_floor`，不再用 passRate 推导分数；同时排除自引用 dashboard 和旧 mock SWE 结果对 benchmark passRate 的污染。 |
| Product data pack 融合 | `benchmark:product-data` 已调用 `aggregateEvidence()`，把 dashboard 作为产品证据包的一部分，而不是独立入口。 |
| Cache warm | `CacheWarmer` 默认 `planning` dry-run，不做 provider 调用，不产生 cache 命中改善 claim；只有显式 execute 且有真实 trajectory before/after 时才能写优化效果。 |
| Runtime health | health check 改为检查主线 Tool Gate post-mutation verification、static analysis bridge、public challenge evidence，不再把 DAG/TDD/SWE 独立模块当产品主入口健康条件。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 9 pass / 0 fail / 34 expects。 |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | 9 pass / 0 fail / 23 expects。 |
| `bun run scripts/dsxu-swe-bench-runner.ts --instances mock-001,mock-002 --timeout 60000` | `INTERNAL_SMOKE_OK`，`publicBenchmarkClaimAllowed=false`。 |
| `bun run scripts/dsxu-cache-warm.ts` | `owner=DeepSeek route/cost/cache`，`mode=planning`，`estimatedSavingsUsd=0`，不产生 cache claim。 |
| `bun run scripts/dsxu-evidence-dashboard.ts` | `scoreFloor=72`，`parseErrors=0`，旧 mock SWE 不再进入 benchmark passRate。 |
| `bun run benchmark:product-data` | `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY`，dashboard 已作为产品证据包输入。 |
| `bun run scripts/dsxu-runtime-health.ts` | `overall=PASS`，health 只验证主线能力与 public challenge evidence。 |
| `bun test src/tools/__tests__/tool-permission-owner-gate.test.ts src/dsxu/engine/__tests__/action-contract.test.ts src/dsxu/engine/__tests__/product-core-guard.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts` | 19 pass / 0 fail / 83 expects。 |
| `bun test src/dsxu/engine/__tests__/public-doc-truth.test.ts src/dsxu/engine/__tests__/context-pressure-matrix.test.ts src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts --timeout 30000` | 20 pass / 0 fail / 116 expects；默认 5s 下 `phase 10 focused-close audit` 会因大范围扫描超时，30s owner timeout 下通过。 |

当前裁决：这批新增模块不再作为“新层”推进；它们已经被压回 Tool Gate、VerificationKernel、Evidence/Release、DeepSeek route/cost/cache owner。后续如果继续处理 DAG 或旧 `src/services/swe-bench`，必须做 import/use owner 归并或 replace/delete review，不能新增第三套 benchmark/runtime。

### 9.50 DAG / legacy SWE owner 继续收口 - 2026-05-17

本节继续 9.49 的硬边界处理，重点是两个仍可能被误用成第二套主链的目录：`src/coordinator/dag` 和 `src/services/swe-bench`。

| 项目 | import/use 事实 | 本轮处理 |
|---|---|---|
| `src/coordinator/dag` | 真实引用只剩 DAG 单元测试、旧优化文档、历史 owner mutation preflight 记录；已不在 health/mainline。 | `runDag()` 和 `PersistentDagRunner` 在没有显式 executor 时不再返回 “Real executor not yet wired” 的伪成功结果，而是失败并说明必须走现有 query-loop / PlanGraph / Tool Gate runtime，或提供明确 harness executor。 |
| `planExecuteVerifyDag` | 当前仍是模板能力，不是产品运行时。 | 保留为 harness/template evidence；不能写成 DSXU 已有第二套 DAG coordinator。后续若要产品化，必须并入现有 PlanGraph/work-state，而不是另起 coordinator。 |
| `src/services/swe-bench` | 9.53 后 runtime/test 引用均为 0；与 `src/services/eval/swe-bench` 重复，仅剩历史文档/审查证据引用。 | 旧 runner 输出曾增加 `publicBenchmarkClaimAllowed=false` 和 claim boundary；当前裁决升级为 replace/delete candidate，不再作为 test-only compatibility 或产品入口保留。 |
| `src/services/eval/swe-bench` | 作为当前 evidence/public challenge benchmark owner。 | 继续保留 real-benchmark / internal-smoke 边界；patch similarity 不再替代 testsPassed。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` | 21 pass / 0 fail / 50 expects。新增断言：无 executor 时不能伪成功。 |
| `bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 22 pass / 0 fail / 62 expects。新增断言：legacy runner 输出只能是 internal evidence。 |
| `node -e "...package scripts check..."` | `benchmark:swe-bench/evidence:dashboard/health:runtime/cache:warm` 均为 `null`，确认没有重新暴露独立入口。 |

当前裁决：DAG 和 legacy SWE 不再能制造“看起来跑通”的假主链证据。剩余如果继续推进，应做两件事：一是把 `planExecuteVerifyDag` 真正并入现有 PlanGraph/work-state 后再宣称产品能力；二是把旧 `src/services/swe-bench` 按 owner/Git review 标成 replace/delete candidate，不进入 GitHub 卖点。

### 9.51 planExecuteVerifyDag 并入 work-state 投影 - 2026-05-17

本节完成 9.50 的第一项剩余动作：`planExecuteVerifyDag` 不再只是孤立 DAG 模板，也不形成第二套 coordinator runtime；它现在只能作为现有 work-state / PlanGraph 可见计划证据。

| 项目 | 执行结果 |
|---|---|
| Work-state 投影 | `src/dsxu/engine/work-state-timeline.ts` 新增 `projectDSXUPlanTemplateToWorkStateEvents()`，输入结构化 plan template nodes，输出 `plan` + `evidence` 两类 work-state event。 |
| 主链边界 | 该投影只生成 visible-state evidence；不执行工具、不 new QueryEngine、不 fetch、不 spawn。执行仍归 query-loop、Tool Gate、VerificationKernel。 |
| DAG 连接方式 | `planExecuteVerifyDag()` 的 nodes 通过 `projectDSXUPlanTemplateToWorkStateEvents()` 投影到 timeline；这证明 DAG template 已被 work-state 吸收为计划结构证据，而不是第二套执行器。 |
| public claim 边界 | 只能写“DSXU 可把 P/E/V 计划结构投影到可见工作状态”，不能写“DSXU 有独立 DAG agent runtime”。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` | 27 pass / 0 fail / 93 expects。新增断言：PEV 模板进入 work-state，且不出现 `Real executor not yet wired`。 |
| `bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 22 pass / 0 fail / 62 expects。legacy SWE 仍只能作为 internal evidence。 |

当前裁决：`planExecuteVerifyDag` 的产品化已完成到“work-state/PlanGraph visible evidence”层。下一步不是再加 DAG 执行器，而是继续处理旧 `src/services/swe-bench` 的 owner/Git replace-delete review，或进入真实窗口/六阶段最终测试前的综合回归。

### 9.52 legacy SWE owner/Git replace-delete review - 2026-05-17

本节处理 9.51 留下的第二个硬动作：旧 `src/services/swe-bench` 不再作为产品 benchmark/runtime 入口推进，必须按真实 import/use 证据进入 owner/Git replace-delete review。处理原则是只做审查包和证据，不 stage、不 commit、不 delete、不 clean。

| 项目 | 执行结果 |
|---|---|
| replace/delete 判断器 | 新增 `src/dsxu/engine/replace-delete-owner-review.ts`，只根据 runtime references、replacement evidence、public claim boundary 三类硬信号裁决 `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW` 或 blocked，不做文件 mutation。 |
| 旧 SWE 审查脚本 | 新增 `scripts/dsxu-legacy-swe-owner-review.ts`，扫描 `src`、`scripts`、`docs`、`package.json` 中对 `src/services/swe-bench` / `../swe-bench` / legacy runner API 的引用，生成 JSON/Markdown 审查包。 |
| 真实 import/use 结论 | `runtimeReferenceCount=0`、`testReferenceCount=0`；旧 owner 只剩文档/历史 generated evidence 引用。 |
| 替代 owner | `src/services/eval/swe-bench` 是当前 Evidence / benchmark / public challenge owner；替代证据包括 `runner.ts`、`judge.ts`、`bridge.ts`、`__tests__/runner.test.ts`、内部 smoke 结果和 evidence dashboard。 |
| 公开 claim 边界 | 旧 owner 和新 owner 都不能把 internal smoke 写成公开 SWE-bench 分数、外部对比或 release claim；公开 claim 仍需要 fixed manifest、raw transcript、rubric、paired evidence、cost/cache/failure report。 |
| 生成证据 | `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json` 与 `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md`。 |
| 当前裁决 | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`。下一步只能由 owner/Git 明确批准删除旧 owner、迁移 test-only compatibility，或要求继续保留；本轮没有删除任何文件。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts` | 3 pass / 0 fail / 9 expects；无 test-only 引用时 nextAction 收紧为 historical source / delete authorization。 |
| `bun run scripts/dsxu-legacy-swe-owner-review.ts` | `status=READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，`docReferenceCount=10`。 |
| `bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 22 pass / 0 fail / 62 expects。 |
| `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts` | 29 pass / 0 fail / 99 expects。 |
| `bun run scripts/dsxu-runtime-health.ts` | `overall=PASS`。 |

当前裁决：旧 `src/services/swe-bench` 已从“可能误用的第二套 benchmark runtime”降为可审查的 replace/delete candidate。它不再进入 GitHub 卖点，也不再进入 release claim。下一步如果继续收口，应进入 owner/Git mutation authorization：批准后迁移或删除旧 test-only compatibility；未批准前保持现状并进入真实窗口/六阶段测试前的 owner packet 队列。

### 9.53 legacy SWE helper semantic absorption - 2026-05-17

继续 9.52 的 owner/Git 收口，本节不删除旧文件，而是先确认旧 `src/services/swe-bench/index.ts` 中有价值的 helper 语义已经并入新 owner，避免后续删除时丢掉测试/报告能力。

| 旧能力 | 新 owner 吸收结果 |
|---|---|
| 示例任务构造 | `src/services/eval/swe-bench/runner.ts` 新增 `createInternalSweSmokeTask()`，生成 DSXU-owned internal smoke task；real benchmark mode 仍只作为候选，不能自动公开 claim。 |
| task validation | `src/services/eval/swe-bench/contract.ts` 新增 `validateSweTask()`，在进入 evidence 前检查 id、repo、baseCommit、problemStatement、difficulty、languages、multiFile、testPatch。 |
| 报告统计 | `src/services/eval/swe-bench/__tests__/contract.test.ts` 覆盖 `generateDetailedReport()` 的 passAt1、difficulty、language 聚合，确认报告语义在 eval evidence owner 内。 |
| 旧 test-only compatibility | `src/services/__tests__/swe-bench.test.ts` 已迁移到新 `src/services/eval/swe-bench` owner，只验证迁移后的 task 构造、校验、internal smoke、报告聚合和 claim-safe output path。 |
| owner review replacement evidence | `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md` 已更新为 `replacementEvidenceCount=8`，包含新 `contract.ts` 和 `contract.test.ts`。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun test src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 5 pass / 0 fail / 24 expects。 |
| `bun run scripts/dsxu-legacy-swe-owner-review.ts` | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，`docReferenceCount=10`，`replacementEvidenceCount=8`。 |
| `bun test src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 10 pass / 0 fail / 44 expects。 |
| `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts` | 3 pass / 0 fail / 9 expects。 |

当前裁决：legacy SWE 的可用语义已经被新 eval owner 吸收，旧目录没有 runtime/test 引用，且不再承载公开 claim。剩余动作只剩 owner/Git 明确 mutation authorization 后的删除；未授权前不能为了降低 `git status` 直接删。

### 9.54 legacy SWE owner/Git mutation plan ready - 2026-05-17

继续 9.53 的收口，本节把旧 SWE 的删除动作固化为 owner/Git mutation plan，但仍不执行删除。这样后续如果 owner/Git 明确授权，不需要再临时猜测删哪些文件、跑哪些验证。

| 项目 | 当前结果 |
|---|---|
| active doc truth | `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md` 已改为只把 `src/services/eval/swe-bench` 写成 DSXU-owned SWE evaluation owner；旧 `src/services/swe-bench` 只作为 replace/delete candidate，不再写成 active adapter/runtime。 |
| owner review state | `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json` 最新为 `runtimeReferenceCount=0`、`testReferenceCount=0`、`replacementEvidenceCount=8`；只剩文档/历史 generated evidence 引用，后续审查包交叉引用会让 doc count 浮动，不影响 runtime/test closure。 |
| mutation candidates | `src/services/swe-bench/index.ts`、`src/services/swe-bench/runner.ts`、`src/services/swe-bench/types.ts`。 |
| preserve owner | `src/services/eval/swe-bench`，包含 `runner.ts`、`judge.ts`、`bridge.ts`、`contract.ts`、`contract.test.ts`、`runner.test.ts`。 |
| mutation authorization | `authorizationRequired=true`，`doNotRunAutomatically=true`；本轮未删除、未 stage、未 commit、未 clean。 |
| pre-mutation verification | `bun run scripts/dsxu-legacy-swe-owner-review.ts`；`bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts`；`bun run scripts/dsxu-runtime-health.ts`。 |
| post-mutation verification | 删除授权后必须复查 `rg "../swe-bench|src/services/swe-bench|SWEBenchRunner|createSWEBenchRunner|runSWEBenchTask|runSWEBenchBatch|generateSWEBenchReport" src scripts package.json`，再跑 SWE owner tests 和 runtime health。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-legacy-swe-owner-review.ts` | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`；doc/generated refs only。 |
| `bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts src/services/__tests__/swe-bench.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/eval/swe-bench/__tests__/runner.test.ts` | 13 pass / 0 fail / 53 expects。 |
| `bun run scripts/dsxu-runtime-health.ts` | `overall=PASS`。 |

当前裁决：旧 SWE 的 owner/Git mutation plan 已 ready，但删除仍等待明确授权。未授权前继续做真实窗口/六阶段测试或处理下一个 owner packet；不要通过本地强删来降低 `git status`。

### 9.55 DAG owner/Git replace-delete review - 2026-05-17

本节按 9.54 之后的 owner packet 顺序处理旧 `src/coordinator/dag`。目标不是新增 DAG runtime，而是确认它已经从产品主链退到 harness-only / historical source，并把真正有价值的 PEV 可见性归到 DSXU work-state / PlanGraph owner。

| 项目 | 执行结果 |
|---|---|
| work-state 断开旧 import | `src/dsxu/engine/__tests__/work-state-timeline.test.ts` 不再 import `planExecuteVerifyDag`，改用 DSXU-owned PEV fixture 验证 `projectDSXUPlanTemplateToWorkStateEvents()`。 |
| active doc truth | `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md` 的 DAG 段落已从“新增/使用 DAG runner 模板”改为“PlanGraph / Work-State PEV Projection”；旧 DAG 只作为 replace/delete candidate 或 harness-only historical source。 |
| owner review packet | 新增 `scripts/dsxu-dag-owner-review.ts`，生成 `docs/generated/DSXU_DAG_OWNER_REVIEW_20260517.json` 和 `docs/DSXU_DAG_OWNER_REVIEW_20260517.md`。 |
| import/use 结论 | `runtimeReferenceCount=0`、`testReferenceCount=0`；旧 DAG 目录外只剩 docs/generated historical review evidence。 |
| replacement owner | `src/dsxu/engine/work-state-timeline.ts` / PlanGraph / Work-State，执行仍归 query-loop、Tool Gate、VerificationKernel。 |
| mutation candidates | `src/coordinator/dag/index.ts`、`types.ts`、`templates.ts`、`runner.ts`、`persist.ts`、`__tests__/dag.test.ts`、`__tests__/persist.test.ts`。 |
| mutation authorization | `authorizationRequired=true`，`doNotRunAutomatically=true`；本轮未删除、未 stage、未 commit、未 clean。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-dag-owner-review.ts` | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，`docReferenceCount=21`。 |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts src/coordinator/dag/__tests__/dag.test.ts src/coordinator/dag/__tests__/persist.test.ts src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts` | 30 pass / 0 fail / 102 expects。 |
| `bun run scripts/dsxu-runtime-health.ts` | `overall=PASS`。 |

当前裁决：旧 DAG owner 与旧 SWE owner 一样，已经具备 owner/Git replace-delete review 条件；但删除必须等明确 mutation authorization。未授权前它们只能作为历史审查包/候选，不得回到产品 runtime、README 卖点或 release claim。
### 9.56 pipeline support owner review - 2026-05-17

本节继续 9.55 之后的 owner packet 收口，处理最近新增的 evidence dashboard、cache warm、runtime health、TDD/static-analysis/post-mutation envelope。裁决口径：这些只能并入 DSXU 现有 owner，不能成为新的 package 产品入口、第二套 verification runtime、第二套 provider/cache runtime 或 GitHub 卖点捷径。

| 项目 | 当前裁决 |
|---|---|
| owner review packet | 新增 `scripts/dsxu-pipeline-support-owner-review.ts`，生成 `docs/generated/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.json` 与 `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md`。 |
| package exposure | `benchmark:swe-bench`、`evidence:dashboard`、`health:runtime`、`cache:warm` 均未暴露为 package scripts；避免把内部证据脚本包装成主入口。 |
| Evidence dashboard | `scripts/dsxu-evidence-dashboard.ts` 保留为 Evidence / Release Claim Binder input；只聚合显式证据，不能从 passRate 推导 scoreFloor，不能把 internal smoke 变成 public claim。 |
| Cache warm | `src/services/cache-warmer.ts` 与 `scripts/dsxu-cache-warm.ts` 保留为 DeepSeek route/cost/cache planning support；默认 dry-run，`estimatedSavingsUsd=0`，没有 before/after trajectory 时不能写 cache 命中率或成本节省 claim。 |
| Runtime health | `src/services/health/*` 与 `scripts/dsxu-runtime-health.ts` 保留为 focused owner-review health helper；公开 release health 入口仍是 `audit:dsxu:health`，不新增第二套 runtime health 产品入口。 |
| Static analysis / TDD | `invokeStaticAnalysisToolGate`、`invokePostWriteTddGate`、`buildPostMutationVerificationEnvelope` 只通过 FileWrite/FileEdit Tool Gate 进入主线；默认 TDD 语义是 post-mutation verification，不把写后 hook 夸成完整红绿 TDD。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-pipeline-support-owner-review.ts` | `overall=PASS`，`failedItems=[]`，`warnItems=[]`，`blockedPackageExposure=[]`。 |
| `bun run scripts/dsxu-evidence-dashboard.ts` | `scoreFloor=72`，`Evidence files=112`，`Parse errors=0`。 |
| `bun run scripts/dsxu-cache-warm.ts` | `owner=DeepSeek route/cost/cache`，`mode=planning`，`dryRun=true`，`estimatedSavingsUsd=0`。 |
| `bun run scripts/dsxu-runtime-health.ts` | `overall=PASS`。 |

当前裁决：pipeline support 已压回 Tool Gate / VerificationKernel、Evidence / Release Claim Binder、DeepSeek route/cost/cache 三个 owner；不进入 README full feature claim，也不作为新主链继续扩层。后续若要删除或改 package 暴露，仍必须走 owner/Git mutation authorization。

### 9.57 release health encoding cleanup - 2026-05-17

本节处理严格 release health audit 发现的真实编码问题。问题不是功能主链缺失，而是开源发布可信度风险：测试源码里存在 invalid UTF-8 与 replacement glyph，会让 health gate 失败，也会让 GitHub 代码阅读体验显得不专业。

| 项目 | 执行结果 |
|---|---|
| 初始严格 health audit | `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` 失败：`invalid_utf8_files=1`，`user_visible_risk_files=2`。 |
| 修复范围 | `src/dsxu/engine/__tests__/go-stop-decision.test.ts` 重写为合法 UTF-8；`src/dsxu/engine/__tests__/product-build-contract.test.ts` 与 `src/dsxu/engine/__tests__/productization-contract.test.ts` 移除坏字节路径 literal，改成 ASCII historical fixture path。 |
| 语义保持 | 三个测试仍读取同一类 historical ops doc，仍验证 Go/Stop、product-build、productization contract；没有降低功能验收，只去掉坏编码输入。 |
| focused tests | `bun test src/dsxu/engine/__tests__/go-stop-decision.test.ts src/dsxu/engine/__tests__/product-build-contract.test.ts src/dsxu/engine/__tests__/productization-contract.test.ts`：13 pass / 0 fail / 148 expects。 |
| strict health audit | `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8`：`invalid_utf8_files=0`，`user_visible_risk_files=0`，`ok=true`。 |

当前裁决：release health 的编码风险已从 blocker 降为 PASS evidence。该修复只清理测试源码坏字节，不改变 DSXU 主链、不新增入口、不影响 evidence 目录。
### 9.58 root TDD toy helper owner review - 2026-05-17

本节继续处理“新增/历史小模块是否又形成多层入口”的问题。扫描发现顶层 `src/tdd.ts` 是历史 toy helper：没有 import/use 引用，语义也不属于当前 DSXU TDD 主线。真正的 TDD/post-mutation owner 已经是 `src/coordinator/tdd-gate`、`src/dsxu/engine/post-mutation-verification-envelope.ts`、FileWrite/FileEdit Tool Gate。

| 项目 | 当前裁决 |
|---|---|
| owner review packet | 新增 `scripts/dsxu-root-tdd-owner-review.ts`，生成 `docs/generated/DSXU_ROOT_TDD_OWNER_REVIEW_20260517.json` 与 `docs/DSXU_ROOT_TDD_OWNER_REVIEW_20260517.md`。 |
| import/use 事实 | `runtimeReferenceCount=0`，`testReferenceCount=0`；只剩本轮 V26/owner-review 文档引用，`src/tdd.ts` 不能再被当作产品 TDD 入口或 README 卖点。 |
| replacement owner | `src/coordinator/tdd-gate/post-write-hook.ts`、`src/coordinator/tdd-gate/gate.ts`、`src/dsxu/engine/post-mutation-verification-envelope.ts`、FileWrite/FileEdit Tool Gate。 |
| mutation plan | `authorizationRequired=true`，`doNotRunAutomatically=true`；候选为 `src/tdd.ts`，但本轮不删除、不 stage、不 commit、不 clean。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-root-tdd-owner-review.ts` | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，doc refs only。 |
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` | 7 pass / 0 fail / 28 expects。 |
| `bun build src/tdd.ts --target=bun` | build 能通过，但这只证明文件可解析；不能证明它是产品能力。 |

当前裁决：`src/tdd.ts` 已从“可能被误读的 TDD 入口”降为 replace/delete candidate。删除仍需 owner/Git mutation authorization；未授权前只保留为历史源文件，不进入公开 claim。
### 9.59 local recovery CLI DeepSeek-owned provider cleanup - 2026-05-17

本节继续收口 `V20-OGR-05 external-integration-adapter-boundary` 的遗留风险。`src/localRecoveryCli.ts` 没有产品 runtime 引用，但仍保留旧 source-provider SDK/auth-token 动态导入边界；这会让 GitHub 开源发布面产生品牌/商业兼容风险，也不符合 DeepSeek-first 目标。

| 项目 | 执行结果 |
|---|---|
| provider cleanup | `src/localRecoveryCli.ts` 移除旧 source-provider SDK 动态导入和旧 auth-token env，改成 DSXU-owned `createDeepSeekRecoveryClient()`。 |
| DeepSeek path | 本地恢复 CLI 现在通过 `fetch(${baseURL}/chat/completions)` 调用 DeepSeek-compatible chat completion；key 只接受 `DSXU_API_KEY`、`DEEPSEEK_API_KEY`、`DSXU_DEEPSEEK_API_KEY`。 |
| default model | 无显式模型时默认 `deepseek-v4-flash`，与 DSXU Flash-first 目标一致；Pro/其它模型仍需显式 env/flag。 |
| base URL | 只保留 `DEEPSEEK_BASE_URL`、`DSXU_DEEPSEEK_BASE_URL`、`DSXU_CODE_API_BASE_URL`，不再从旧 provider env 取 baseURL。 |
| public boundary | `src/localRecoveryCli.ts` 仍不是 package 产品入口；它只是本地 recovery fallback source，不能写成主 CLI/TUI 能力或独立 provider runtime。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun build src/localRecoveryCli.ts --target=bun` | PASS，确认恢复 CLI 可解析并构建。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 10 pass / 0 fail / 4522 expects；新增断言确认 local recovery CLI 不含旧 provider SDK/auth token。 |
| `bun src/localRecoveryCli.ts --help` | PASS，显示 DSXU local recovery help。 |
| `bun src/localRecoveryCli.ts --version` | PASS，显示 `999.0.0-local (DSXU Code local recovery)`。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | PASS，`publicSurfaceBlockerCount=0`；runtime cleanup candidates 仍需后续 owner packets。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：local recovery 面已经从 provider-migration brand risk 改回 DSXU/DeepSeek-owned fallback。后续仍需继续处理 brand-compat board 的 runtime cleanup candidates，但不能通过新增桥接 runtime 或兼容层来绕开主链。
### 9.60 disabled Tungsten tool registry closure - 2026-05-17

本节处理 Tool/Permission 主线中的另一个历史残留：`src/tools/TungstenTool/*`。结论不是直接删除，而是先关闭产品工具 registry 暴露，再把剩余 UI/state/tmux 引用做成阻断型 owner review。

| 项目 | 执行结果 |
|---|---|
| registry closure | `src/tools.ts` 移除 `TungstenTool` import 和 `process.env.USER_TYPE === 'ant' ? [TungstenTool] : []` 注册路径；禁用 stub 不再进入 `getAllBaseTools()`。 |
| agent/tool constants | `src/constants/tools.ts` 移除 async-agent blocked-list 中的 Tungsten 说明；既然不再注册成产品工具，就不应继续作为工具面例外解释。 |
| owner metadata test | `src/dsxu/engine/__tests__/tool-definition-owner.test.ts` 移除 Tungsten disabled stub 的 owner metadata claim；避免测试继续把它当工具面成员。 |
| owner review packet | 新增 `scripts/dsxu-tungsten-disabled-tool-owner-review.ts`，生成 `docs/generated/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.json` 与 `docs/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.md`。 |
| 当前阻断 | 9.60 初始 owner review 曾为 `BLOCKED_BY_RUNTIME_REFERENCES`；已由 9.61 继续处理并升级为 `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`。 |

focused 验证：
| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts src/tools/__tests__/tool-permission-owner-gate.test.ts` | 12 pass / 0 fail / 194 expects。 |
| `bun run scripts/dsxu-tungsten-disabled-tool-owner-review.ts` | 9.60 初跑为 `BLOCKED_BY_RUNTIME_REFERENCES`，`runtimeReferenceCount=35`；9.61 复跑已降为 `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`。 |
| `rg "TungstenTool|\[TungstenTool\]|from './tools/TungstenTool" src/tools.ts src/constants/tools.ts src/dsxu/engine/__tests__/tool-definition-owner.test.ts` | no matches；主工具 registry/test claim 已闭合。 |

当前裁决：本节记录初始 registry closure。9.61 已完成 UI/state/tmux runtime remap；Tungsten 现在只剩 owner/Git replace/delete review，不得恢复为 terminal runtime。

### 9.61 disabled Tungsten runtime reference closure - 2026-05-17

本节继续 9.60，不新增入口，不保留旧兼容面，把已经退出产品工具面的 Tungsten UI/state/tmux 残留全部收口到 DSXU terminal visible-state / Tool Gate 主线。`src/tools/TungstenTool/*` 本身仍不删除，等待显式 owner/Git mutation authorization。

| 项目 | 执行结果 |
|---|---|
| AppState cleanup | `src/state/AppStateStore.ts` 移除 `tungstenActiveSession`、`tungstenLast*`、`tungstenPanel*` 状态字段；`src/state/onChangeAppState.ts` 移除旧 `USER_TYPE === 'ant'` 持久化分支；`src/utils/config.ts` 移除 `tungstenPanelVisible` 配置字段。 |
| UI cleanup | `src/components/agents/ToolSelector.tsx`、`src/components/PromptInput/PromptInput.tsx`、`src/screens/REPL.tsx` 已不再 import/render `TungstenTool` 或 `TungstenLiveMonitor`，footer 不再暴露旧 tmux panel。 |
| terminal wording remap | `src/history.ts`、`src/utils/tmuxSocket.ts`、`src/utils/transcriptSearch.ts`、`src/utils/sessionStorage.ts` 将旧 Tungsten 注释 remap 为 DSXU-managed terminal session 语义，保留通用 tmux isolation 能力，不把它伪装成 product tool。 |
| owner review packet | `scripts/dsxu-tungsten-disabled-tool-owner-review.ts` 更新为 ready 口径；生成的 `docs/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.md` 与 JSON 显示 runtime/test references 均为 0。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-tungsten-disabled-tool-owner-review.ts` | `READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW`，`runtimeReferenceCount=0`，`testReferenceCount=0`，`docReferenceCount=26`；doc/generated refs 会随本轮记录浮动，不影响 runtime/test closure。 |
| `rg "Tungsten\|tungsten\|tmux panel\|TungstenTool\|TungstenLiveMonitor" src scripts package.json` | 只剩 owner review script 与 `src/tools/TungstenTool/*` candidate owner 文件；产品 runtime 不再引用。 |

当前裁决：Tungsten 线已经从“runtime 阻断”推进到“owner/Git replace/delete review ready”。下一步只能在明确 owner/Git mutation 授权后删除 `src/tools/TungstenTool/*`，否则继续作为历史源文件候选保留；不得重新作为 terminal runtime、permission runtime 或 README 卖点。

### 9.62 auth handler provider-migration wording cleanup - 2026-05-17

本节继续 brand/compat risk 收口，目标不是删除非 DSXU 模式的历史 OAuth/env 读取，而是把运行时命名从“provider migration 主线”改成 DSXU-owned 的 archived cloud auth/source env 边界。DSXU Code 默认路径仍是 DeepSeek/DSXU model access：`DSXU_API_KEY`、`DEEPSEEK_API_KEY`、`DSXU_DEEPSEEK_API_KEY`、`LITELLM_BASE_URL` 或本地保存 key。

| 项目 | 执行结果 |
|---|---|
| auth runtime wording | `src/cli/handlers/auth.ts` 将 `PROVIDER_MIGRATION_*` auth 常量改为 `ARCHIVED_*` 命名；用户可见错误从 `Provider migration OAuth scopes...` 改为 `Archived cloud OAuth scopes...`。 |
| setup-token wording | `src/cli/handlers/util.tsx` 将 setup-token 起始提示从 `provider-migration setup-token flow` 改为 `archived cloud setup-token flow`，明确 DSXU 默认使用 DeepSeek/DSXU key。 |
| DSXU key path | `auth login --api-key-stdin`、TTY 首次 key、`auth status` 仍走 DSXU/DeepSeek 主线；不新增 provider runtime，不改变 Flash-first 成本路由。 |
| contract test | `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 同步断言 auth handler 使用 `ARCHIVED_SOURCE_API_KEY_ENV` 和 `archived source API key env`。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2598` 降到 `2584`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | 12 pass / 0 fail / 4527 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2584`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |
| `bun build src/cli/handlers/auth.ts --target=bun` | not accepted as focused evidence：direct bundle pulls optional/generated dependencies such as OpenTelemetry exporters, AWS SDK, sharp, fflate and generated `.js` dynamic requires; failure is repo-level optional dependency resolution, not an auth handler regression. |

当前裁决：auth handler 的 DSXU default path 保持 DeepSeek-first；旧 cloud OAuth/env 读取被降级为 archived boundary，不再作为 DSXU 产品主线命名。下一步继续按 brand-compat board 的高价值 runtime cleanup candidates 分批处理，不能把 2585 个候选当作一次性大桶乱改。

### 9.63 command surface archived-provider wording cleanup - 2026-05-17

本节继续 9.62，把多个 hidden command / setup wizard 的用户可见旧迁移文案降级为 archived boundary。底层兼容常量和非 DSXU 迁移协议没有被删除；本轮只处理命令描述、提示、错误文案和 setup wizard 文案，避免开源用户把历史 provider path 误解为 DSXU 主线能力。

| 范围 | 执行结果 |
|---|---|
| hidden remote commands | `src/commands/bridge-kick.ts`、`src/commands/desktop/index.ts`、`src/commands/mobile/index.ts`、`src/commands/review.ts` 的用户可见描述改为 archived/DSXU review/workbench 口径。 |
| hidden Slack/GitHub setup | `src/commands/install-slack-app/*` 与 `src/commands/install-github-app/*` 的 setup、success、existing-workflow、manual-help 文案改为 archived setup / DSXU workflow template 口径。 |
| provider contract test | `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` 同步检查 hidden setup command 使用 archived wording，不再要求 provider-migration user copy。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2584` 降到 `2565`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts` | 12 pass / 0 fail / 4527 expects。 |
| `rg "Provider-migration Slack app\|provider-migration Slack app\|Provider-migration GitHub App\|provider-migration workflow file\|provider-migration source action docs\|provider-migration desktop handoff\|Provider-migration mobile\|provider-migration remote review workflow\|Archived provider-migration bridge" src/commands src/cli` | no matches。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2565`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：命令面旧品牌/旧迁移用户文案已进一步收口；这不是删除功能，而是把隐藏兼容路径从“产品能力表述”改成 archived boundary。下一步继续优先处理 DSXU runtime 默认路径里的 provider/cost/MCP/remote visible wording，底层 wire values 只能在明确 adapter owner 中保留。

### 9.64 cost / effort command archived wording cleanup - 2026-05-17

本节继续成本路由与 effort 控制的用户可见口径收口。目标是让 `/cost`、`/effort`、passes 相关 runtime profile 显示 DSXU-owned cost/effort 主线，而不是把历史迁移 alias 写成产品能力。没有改 DeepSeek Flash/Pro 路由逻辑，也没有新增成本 runtime。

| 范围 | 执行结果 |
|---|---|
| effort command | `src/commands/effort/effort.tsx` 将 `provider-migration effort env alias` 改为 `archived effort env alias`；仍明确 `DSXU_CODE_EFFORT_LEVEL` 会覆盖本 session。 |
| cost runtime profile | `src/commands/cost/cost.ts` 将 provider subscriber/command wording 改为 archived boundary；`formatTotalCost()` 仍是单一 session cost source。 |
| passes profile | `src/commands/passes/index.ts` 将 referral eligibility wording 改为 archived source boundary，不改变 DSXU runtime 行为。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2565` 降到 `2559`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `rg "provider-migration effort env alias\|provider migration subscriber\|provider migration command mode\|provider-migration source referral\|Provider migration subscriber" src/commands src/dsxu/engine/__tests__` | no matches。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 10 pass / 0 fail / 4522 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2559`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：成本/effort 用户面继续统一到 DSXU-owned 口径；历史 env alias 只作为 archived compatibility 提示，不进入 GitHub 卖点。

### 9.65 remote bridge disabled-message wording cleanup - 2026-05-17

本节继续 remote/control-plane 用户可见禁用消息收口。`src/services/bridge/dsxuRemoteBridgeFacade.ts` 是 DSXU Remote Bridge Facade，不是第二套 query/tool runtime；默认禁用消息不应再把历史 bridge shell 写成产品面。

| 范围 | 执行结果 |
|---|---|
| runtime profile | `provider-migration bridge shell returns archived/disabled messages` 改为 `archived bridge shell returns disabled messages`。 |
| disabled reason | `getBridgeDisabledReason()` 改为 `Archived bridge shell is disabled; DSXU provider contract owns remote routing.` |
| peer session error | `postInterDSXUMessage()` 改为 `Archived bridge peer sessions are disabled; use provider: routing.` |
| source boundary reason | archived source reason 改为 `archived source boundary`。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2559` 降到 `2554`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/network-facade-v1.test.ts` | 26 pass / 0 fail / 4577 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2554`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：remote bridge 默认禁用路径继续是 DSXU provider contract boundary；旧 bridge shell 只作为 archived source boundary，不再进入可见产品语言。

### 9.66 login / remote setup / voice command archived wording cleanup - 2026-05-17

本节继续命令发现面收口，处理 `/login`、`/web-setup`、`/voice` 及 login 运行时 profile 的旧迁移账户/远程工作区/voice isolation 文案。DSXU runtime 默认仍是 DeepSeek/DSXU model access 和 local Remote Session Provider。

| 范围 | 执行结果 |
|---|---|
| login command | 非 DSXU 隐藏路径文案从 provider migration account 改为 archived cloud account；DSXU runtime 仍显示 `Configure DSXU model provider credentials`。 |
| remote setup | 非 DSXU 隐藏 web setup 描述改为 archived remote workspace；runtime profile 改为 archived feature/policy boundary。 |
| voice command | voice 描述和未启用提示改为 archived-cloud isolated；仍要求配置 DSXU voice provider。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2554` 降到 `2545`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `rg "provider migration account\|provider-migration remote workspace\|provider-migration-isolated\|provider-migration feature flag\|provider migration remote login" src/commands src/dsxu/engine/__tests__` | no matches。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts` | 20 pass / 0 fail / 4563 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2545`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：登录、远程 setup、voice 命令面继续归入 DSXU-owned 产品语言；历史非 DSXU 路径只保留 archived cloud/source boundary，不进入公开卖点。

### 9.67 MCP archived-boundary wording cleanup - 2026-05-17

本节处理 MCP/Skill 生态可见边界文案。MCP 是 DSXU 独立产品能力，默认 owner 必须是 DSXU MCP config/provider/registry；历史 connector/wire path 只能以 archived boundary 存在，不能被读成默认 MCP runtime。

| 范围 | 执行结果 |
|---|---|
| MCP provider policy | `src/services/mcp/dsxuProvider.ts` 的 disabled reason 改为 `Archived MCP provider is disabled in DSXU runtime...`。 |
| MCP doctor | `provider-migration-boundary` owner string 改为 `archived-boundary`；warnings/notes 改成 archived boundary。 |
| headers/channel/helper | `headersHelper`、`channelNotification`、`useManageMCPConnections` 的用户可见 alias/auth/resource 错误改成 archived wording。 |
| MCP client/config/debug | `client.ts`、`config.ts`、`providerConnectorMigration.ts`、`utils.ts`、`types.ts` 将 connector/log/debug/user-facing labels 从 provider migration 改成 archived connector/config；保留底层 `PROVIDER_MIGRATION_*` 常量作为 wire/compat adapter。 |
| brand board | `runtimeCleanupCandidateCount` 从 `2545` 降到 `2514`；`publicSurfaceBlockerCount=0` 保持不变。 |

focused 验证：

| 命令 | 结果 |
|---|---|
| `rg "Provider migration MCP\|provider migration MCP\|provider-migration-boundary\|Provider-migration MCP\|provider migration alias\|provider migration connector\|provider migration authentication\|provider migration channels\|provider migration service" src/services/mcp src/dsxu/engine/__tests__` | no matches。 |
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/extension-runtime-owner.test.ts` | 13 pass / 0 fail / 4547 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2514`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：MCP 默认路径继续是 DSXU-owned；历史 connector 只作为 archived boundary / explicit migration adapter，不进入 README 卖点或默认 runtime。

### 9.68 command / remote / API archived wording batch - 2026-05-17

本节继续执行 V26 brand/compat 收口：只处理默认运行时文案、runtime profile、错误消息、调试文本和注释；不删除文件、不 stage、不改底层 wire/env 常量，不让历史迁移路径变成 DSXU 第二套 provider/runtime/MCP 主线。

| 范围 | 执行结果 |
|---|---|
| command surface | `createMovedToPluginCommand`、`mcp/addCommand`、`reviewRemote`、`stickers`、`thinkback`、`remote-setup/api`、`rename`、`commit-push-pr` 等历史文案改为 archived boundary。 |
| remote transport/API | `remoteIO`、`ccrClient`、`adminRequests`、`bootstrap`、`referral`、`PromptSuggestion`、`remoteManagedSettings`、`tips`、`dumpPrompts`、`api/client`、`featureFlags`、`api/logging` 等默认 DSXU 主线文案改为 archived/DSXU-owned。 |
| auth/diagnostic/compact | `dsxuProviderAuth`、`diagnosticTracking`、`rateLimitMocking`、`mockRateLimits`、`oauth/client`、`microCompact`、`api/dsxuTransport`、`withRetry`、`promptCacheBreakDetection` 改成 archived boundary 口径。 |
| focused verification | provider/remote/release contract 均通过，brand board `runtimeCleanupCandidateCount` 从 `2491` 降到 `2444`，`publicSurfaceBlockerCount=0`。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/network-facade-v1.test.ts` | 26 pass / 0 fail / 4577 expects。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 21 pass / 0 fail / 4595 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2444`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：这些修改不是“删功能”，而是把历史迁移/兼容能力从产品主线文案中剥离，只保留显式 archived adapter boundary；GitHub 卖点不得引用这些 archived 文案。

### 9.69 MCP / CLI entry / config safety archived wording batch - 2026-05-17

本节继续处理源码层高命中候选：MCP channel/auth/config、`main.tsx` CLI/TUI 入口、MCP remote server menu、配置/权限/指令文件/TeamMemory/SettingsSync 等。处理目标仍是单一 DSXU 主线：DeepSeek-first query loop、Tool Gate、MCP registry、provider route/cost/cache evidence 不被历史迁移命名污染。

| 范围 | 执行结果 |
|---|---|
| MCP ecosystem | `channelPermissions`、`channelNotification`、`auth`、`config`、`providerConnectorMigration`、`client`、`xaaIdpLogin`、`utils`、`useManageMCPConnections`、`vscodeSdkMcp` 文案统一为 archived boundary；`dsxuProvider` runtime policy 的非默认分支改为 `archived-migration`。 |
| tool execution profile | `toolExecution` 的 MCP server type profile 从 `provider-migration-dsxuai-proxy` 改成 `archived-dsxuai-proxy`，避免产品面出现旧 provider proxy 名称。 |
| CLI/TUI entry | `main.tsx` 中用户可见错误、warning、help description、debug text、注释从 provider migration 改为 archived/DSXU-owned；不改 env 协议常量。 |
| MCP UI | `MCPRemoteServerMenu` 中 DSXU mode 的 connector auth/clear-auth 提示改为 archived connector boundary，并继续引导用户使用 DSXU MCP Provider settings。 |
| config / instruction / permission | `effort`、`config`、`instructionFiles`、`permissions/filesystem`、`teamMemorySync`、`settingsSync`、`remoteManagedSettings`、`policyLimits`、`analytics` 注释和 runtime 文案改为 archived/source boundary。 |
| focused verification | MCP doctor、provider contract、mainline tool adapter、release surface 均通过；brand board 最终到 `runtimeCleanupCandidateCount=2279`，`publicSurfaceBlockerCount=0`。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/extension-runtime-owner.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` | 95 pass / 0 fail / 5545 expects。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 99 pass / 0 fail / 5581 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=8252`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2279`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：源码默认产品面已经进一步归到 DSXU-owned archived boundary 口径。剩余 `runtimeCleanupCandidateCount` 主要集中在 intentionally retained `PROVIDER_MIGRATION_*` wire/env/constants、测试 fixture、历史 evidence、generated docs 和 owner-review debt；这些不能用简单文本替换处理，下一步必须按 import/use owner 和协议边界逐个裁决。

### 9.70 skills / tools / native installer archived wording batch - 2026-05-17

本节继续把高可见的 tool/skill/native installer 面收口到 DSXU-owned 口径。原则不变：保留显式 migration env/flag/wire 常量，但产品提示、tool metadata、skill prompt 和运行时 profile 不再把历史 provider path 写成默认能力。

| 范围 | 执行结果 |
|---|---|
| RemoteTrigger | `RemoteTriggerTool` 的 sideEffects/evidence/error/profile 从 provider migration 改为 archived isolation；默认仍是 DSXU Remote Session Provider。 |
| SendMessage | `SendMessageTool` 的 schema description、runtime profile、permission denial、bridge ask message 从 provider-migration bridge 改为 archived bridge boundary；`provider:` 仍归 DSXU provider backend。 |
| Agent frontmatter | `AgentTool/loadAgentsDir` 中 remote isolation / omit instruction 注释改为 archived-gated，保持 default DSXU 只允许 worktree isolation。 |
| schedule skill | `scheduleRemoteAgents` 的 connector、remote agent、scheduled dashboard、setup notes、runtime profile 文案改为 DSXU/archived boundary，避免把 scheduled agents 写成历史 provider 执行。 |
| native/hooks/notifs | native installer、hooks、MCP connectivity notification 的历史 source/alias 文案改为 archived source/alias。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 99 pass / 0 fail / 5581 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=8214`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2238`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：本批继续减少产品可见旧口径，没有新增入口、没有新增 runtime、没有删除文件。剩余高计数文件中大量命中来自 `PROVIDER_MIGRATION_*` 常量名、测试名、fixture、协议适配器和风险闸本身；下一步必须分 owner 判断哪些是必须保留的 wire boundary，哪些可以重命名或进入 replace/delete review。

### 9.71 UI / tool / settings / plugin archived wording batch - 2026-05-17

本节继续按 V26 brand/compat 收口执行，不新增其它主链、入口、provider runtime、permission runtime 或 MCP/skill runtime。处理口径仍是：DeepSeek/DSXU 默认产品面必须清楚，历史迁移、兼容、协议、wire/env 只能作为 archived boundary 或显式 adapter，不进入 GitHub 卖点和默认 TUI/CLI 体验。

| 范围 | 执行结果 |
|---|---|
| UI / command surface | `commands.ts`、`constants/github-app.ts`、`DesktopHandoff`、`TeleportError`、`Usage`、`ConsoleOAuthFlow`、`Onboarding` 等用户可见或准用户可见文案改为 DSXU/archived 口径。 |
| Agent / tool prompts | `AgentTool`、`RemoteTriggerTool`、`WorkflowTool`、`McpAuthTool`、`BriefTool`、`PowerShellTool`、`BashTool`、`FileReadTool`、`FileEditTool`、`FileWriteTool`、`ToolSearchTool`、`ScheduleCronTool` 等 prompt/profile/error/comment 收口为 archived boundary。 |
| settings / permissions / plugins | settings schema、MDM constants、permission loader/parser/setup/result、plugin loader/marketplace/GCS/zip cache/validation 等历史 source/alias 文案改为 archived source/alias，不改变底层兼容协议常量。 |
| MCP / skill UI | `MCPTool` UI、collapse classifier、desktop MCP import、managed connections 等边界文案继续归到 DSXU MCP registry 和 archived connector boundary。 |
| test sync | `mainline-tool-adapter-v1.test.ts` 同步 expectation：远程 Agent shell 文案从旧迁移口径改为 archived gate；`runAgent.ts` 中 sub-agent thinking 注释也从旧 source mode 改为 archived source mode。 |
| brand board | 本节两批后 `runtimeCleanupCandidateCount` 从 `2238` 降到 `2082`；`publicSurfaceBlockerCount=0` 保持不变。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts` | 101 pass / 0 fail / 5594 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=8059`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2082`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：这批不是删除功能，也不是轻量补丁；它把已经在 DSXU 主线吸收的能力从旧品牌/旧 provider 口径中剥离出来，保证默认用户体验、release claim、GitHub 文案只呈现 DSXU-owned DeepSeek-first 能力。剩余 `2082` 个 cleanup candidates 需要继续按 owner 拆分：保留必要 wire/env/protocol 边界，重命名可安全改名的源码文案，历史 fixture/generated/evidence 进入 owner/Git review，不用全局替换掩盖所有权。

### 9.72 entry / protocol / provider-alias archived wording batch - 2026-05-17

本节继续执行 11x batch closure，重点处理默认入口、protocol adapter profile、provider alias block reason、SendMessage bridge prompt、tool registry profile、optional SDK error、tool-search debug、managed env 注释等高命中候选。仍然只改 DSXU-owned 文案和 runtime profile；没有移动目录、没有删除文件、没有 stage/commit，也没有改动必须保留的 wire/env 常量值。

| 范围 | 执行结果 |
|---|---|
| SendMessage / REPL bridge | SendMessage prompt 中 `bridge:` 行、bridge note、cross-session 指引从旧迁移口径改为 archived migration；`useReplBridge` profile 明确 default mainline 不导入 archived bridge code。 |
| CLI / browser MCP / Chrome provider | `src/entrypoints/cli.tsx` 的旧 browser MCP flag 错误提示改为 archived browser MCP path；Chrome extension notification 不再要求旧 cloud credentials，而是 DSXU cloud credentials。 |
| Tool registry / optional SDK / Fennec migration | simple-mode profile 从旧 alias 改为 archived alias；optional SDK fallback error 改为 archived provider SDK；Fennec/Opus migration runtime profile 改为 archived alias intake disabled。 |
| provider contract / alias | provider bridge block reason 和 alias command block message 改为 archived bridge opt-in；default DSXU provider contract 仍然 deny-by-default，remote shell 不进入默认主线。 |
| protocol / entry / managed env | archived protocol runtime profile、formal entrypoint comments、init comments、managed env/embedded tools/privacy/system-init 等从旧迁移口径改为 archived boundary。 |
| test sync | `tool-registry-simple-mode.test.ts` 与 `provider-contract-v1.test.ts` 同步检查 archived wording，避免测试继续要求旧品牌文本。 |
| brand board | 本节两批后 `runtimeCleanupCandidateCount` 从 `2082` 降到 `2025`；`publicSurfaceBlockerCount=0` 保持不变。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts` | 103 pass / 0 fail / 5598 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7998`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2025`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：默认入口、SendMessage/bridge、tool registry、provider alias、MCP protocol profile 的旧口径已进一步归档。剩余 cleanup candidates 主要分三类：测试/fixture 中刻意保留的隔离证明、DSXU engine 风险闸/contract 文案、以及底层 archived-protocol 命名模块和 wire/env 常量。下一步只能按 owner 决策继续重命名或进入 replace/delete review，不能用一次性全局替换破坏协议兼容。

### 9.73 source comments / mainline absorption archived wording batch - 2026-05-17

本节继续处理“默认源树读起来像旧产品”的问题，范围集中在 comments、runtime profile、mainline absorption message、formal DSXU entrypoint、managed env / privacy / system-init 说明。处理目标仍然是让 DSXU 的主链叙事统一：DeepSeek-first、本地编码 CLI/TUI、Tool Gate、DSXU provider contract、MCP registry 和 evidence timeline，而不是旧 provider shell。

| 范围 | 执行结果 |
|---|---|
| formal entry / init | `entrypoints/dsxu-code.tsx` 和 `entrypoints/init.ts` 注释从旧 shell 改为 archived shell，不改变启动行为。 |
| protocol adapter | archived protocol constants 的 runtime profile 改成 DSXU archived MCP adapter，仍保留底层 wire 常量。 |
| QueryEngine / skill loading | cowork memory、plugin seed、desktop restart、skills path 等 source comments 归档到 archived wording。 |
| env / privacy / system-init | managed env、privacy level、native pid lock、system-init wire projection 等说明改为 archived boundary，保持 DSXU env 优先。 |
| mainline absorption | `src/dsxu/engine/index.ts` 的 full-absorb action/message 从旧 full-absorb bridge 改为 archived full-absorb bridge。 |
| brand board | 本节后 `runtimeCleanupCandidateCount` 从 `2025` 降到 `2022`；`publicSurfaceBlockerCount=0` 保持不变。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/services/mcp/__tests__/doctor.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts` | 103 pass / 0 fail / 5598 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7999`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=2022`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

旁路发现：尝试额外跑 `src/dsxu/engine/__tests__/full-absorb.test.ts` 时，它因既有 `Cannot find module '../full-absorb'` 失败；该测试入口不是本批改动引入，也未被计入本节放行验证。后续若要把 full-absorb 测试纳入标准回归，需要先 owner 判定：是补回 DSXU-owned module、改测 `engine/index.ts` 主入口，还是把旧测试列入 replace/delete review。

当前裁决：本节继续降低旧口径密度，但不假装已完成所有品牌/兼容债。下一步应从剩余 `2022` 中分 owner 处理：model archived-compat 真实兼容模块、DSXU engine 风险闸/contract、tests/fixture/generated evidence 三类必须分开，不能混成一个全局替换动作。

### 9.74 engine contract / model compat / collaboration archived wording batch - 2026-05-17

本节继续执行 10x/11x batch closure，处理范围比 9.71-9.73 更偏 owner contract 和协作长任务链路：DSXU engine contract、public surface/risk gate、model compat comments/profile、shell/env/secure storage、teammate/task/swarm/teleport/worktree 注释。原则不变：只收口 DSXU-owned wording 和 hidden/runtime profile；不删除文件、不改底层 wire/env 常量值、不新增入口、不新增 runtime。

| 范围 | 执行结果 |
|---|---|
| engine contract | `background-governance-contract`、`entrypoint-policy`、`high-pressure-reference-absorption-contract`、`mainline-completion-contract`、`productization-contract`、`product-build-contract`、`reference-absorption-completion-contract`、`reference-governance-absorption-contract`、`release-test-gate` 的旧迁移措辞改成 archived/explicit-flag 口径。 |
| public surface / risk gate | `model-public-surface-gate` 将隐藏 provenance 从旧 provider-only 口径改为 `archived-only`；proprietary/public clean gate 文案同步为 archived hidden boundary，避免 release claim 误读。 |
| model compat / shell / env | shellConfig、pdf/concurrent/subprocess env、Bedrock/model comments、model deprecation/provider comments、secure storage/keychain、sandbox、providerMigration model/betas/options 中的旧 source 描述改为 archived source。 |
| collaboration / long task | teammate/task/mailbox/swarm/teleport/tmux/perfetto/undercover/worktree 注释和 teleport runtime risk control 改成 DSXU/archived 口径，长任务协作仍走 DSXU Agent/permission/evidence 主链。 |
| test sync | `release-surface-v1.test.ts`、`mainline-completion-contract.test.ts`、`reference-absorption-completion-contract.test.ts` 同步 archived provenance/acceptance 断言。 |
| brand board | 本节后 `runtimeCleanupCandidateCount` 从 `2022` 降到 `1950`；`publicSurfaceBlockerCount=0` 保持不变。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/tools/__tests__/tool-registry-simple-mode.test.ts` | 31 pass / 0 fail / 4643 expects。 |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/mainline-completion-contract.test.ts` | 104 pass / 0 fail / 5687 expects。 |
| `bun run scripts/dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7907`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=1950`。 |
| `bun run scripts/dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前剩余 owner 分层：

| owner/path cluster | 当前判断 |
|---|---|
| `src/main.tsx` | 主要是拆字 wire/env 常量、导入名、服务壳 gate 和 runtime alias；不能全局替换，下一步要按 startup owner 判断哪些能改成 archived helper 名，哪些必须保留协议兼容。 |
| `src/services/auth/dsxuProviderAuth.ts`、`src/services/mcp/*`、`src/components/mcp/*` | MCP/auth connector boundary，需继续按 DSXU MCP registry / archived connector 分层，避免破坏真实 MCP auth/error 流。 |
| `src/utils/model/providerMigration/*` | 真实隐藏兼容模块；可继续清理注释和隐藏描述，但函数/文件名/常量需 owner review 后再决定是否重命名。 |
| tests/fixtures/generated evidence | 主要用于证明隔离、旧路径不进入公开面；不应为了降计数直接删或重写历史 evidence。 |

当前裁决：V26 brand/compat 收口继续有效，公开面 blocker 仍为 0；但 `git status --short` 仍为 `2431`，因为本轮没有执行 Git mutation、删除、stage 或 commit。下一批应优先处理 `src/services/auth`、`src/services/mcp`、`src/components/mcp` 的 runtime/profile/error 文案，再回到 `src/main.tsx` 做 startup owner 命名裁决。
### 9.75 MCP connector / startup archived owner naming batch - 2026-05-17

本节继续按 V26 brand/compat 收口执行，目标不是追求 `runtimeCleanupCandidateCount=0`，而是把真实产品主链从历史迁移命名里剥离出来：默认 DSXU CLI/TUI、DeepSeek provider、Tool Gate、MCP registry、visible-state/report 只能呈现 DSXU-owned 能力；底层 wire/env/protocol 常量保留为 archived boundary，不做破坏性重命名。

| 范围 | 执行结果 |
|---|---|
| MCP archived connector owner | `providerConnectorMigration.ts` 的内部导出从 `fetchProviderMigrationMcpConfigsIfEligible` / `clearProviderMigrationMcpConfigsCache` / `markProviderMigrationMcpConnected` / `hasProviderMigrationMcpEverConnected` 收口为 `fetchArchivedMcpConfigsIfEligible` / `clearArchivedMcpConfigsCache` / `markArchivedMcpConnected` / `hasArchivedMcpEverConnected`；保留协议常量 alias，避免破坏 wire/env 边界。 |
| MCP config / connection manager | `config.ts` 与 `useManageMCPConnections.ts` 改用 archived connector 本地变量和 `dedupArchivedMcpServers`；连接统计从 `providerMigration` 收口到 `archivedConnectors`，避免把旧迁移路径写成默认产品能力。 |
| MCP client | `client.ts` 将 proxy fetch、transport 判断、metadata 常量在本地改成 archived 命名；底层 `PROVIDER_MIGRATION_*` 常量只作为协议 alias 使用。 |
| MCP TUI visible state | `MCPSettings.tsx` / `MCPListPanel.tsx` 的 tab 与本地变量从 `Provider connector migration` 收口为 `Archived connectors`，真实窗口里不再把旧 connector path 当作 DSXU 主链。 |
| startup mainline | `main.tsx` 的 archived env helper、remote shell gate、MCP promise、timeout、dedup 和 login 本地变量改成 archived 命名；真实 env 值、flag 值和 migration import 只通过 alias 保留。 |
| test sync | `provider-contract-v1.test.ts` 同步默认 CLI path expectation，从旧 helper 名更新到 `shouldLoadArchivedServiceShell` / `ARCHIVED_CODE_ENV_PREFIX` / `archivedCodeEnv`。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS；CLI help 真实启动，未出现 import/runtime 崩溃。 |
| `bun test src\services\mcp\__tests__\doctor.test.ts src\dsxu\engine\__tests__\extension-runtime-owner.test.ts src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts` | 102 pass / 0 fail / 5606 expects。 |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7600`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=1646`。 |
| `bun run scripts\dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：本批没有新增入口、没有新增 runtime、没有删除文件、没有 stage/commit。`git status --short` 仍不会因为这类 owner cleanup 自动下降；下降必须进入 owner/Git mutation review。下一批优先级为 `src/cli/print.ts` 的 control-plane visible-state 命名收口、`src/services/auth/dsxuProviderAuth.ts` 的 provider auth 边界裁决，以及 `src/utils/model/providerMigration/*` 的 hidden compat owner 审核。  

### 9.76 CLI print / effort / channel owner naming batch - 2026-05-17

本节继续执行 20x batch closure，优先处理最新 brand board 里的高命中 runtime/public path：`src/cli/print.ts`、`src/utils/effort.ts`、`src/components/EffortCallout.tsx`、`src/services/mcp/channelNotification.ts`。处理原则保持不变：不新增入口、不新增 runtime、不删除文件、不改 wire/env 值；只把 DSXU 默认 CLI/TUI、control-plane visible-state、effort routing、MCP channel notification 的本地 owner 命名收口到 archived boundary。

| 范围 | 执行结果 |
|---|---|
| CLI print control-plane | `print.ts` 的 control-plane OAuth、MCP transport、channel capability、archived env helper、service shell gate 本地命名从 provider-migration 收口为 archived alias；stream-json / SDK control path 仍走同一 DSXU print loop，没有新增控制面入口。 |
| Effort routing | `utils/effort.ts` 将公开导出从 `getProviderMigrationDefaultEffortConfig` / `isProviderMigrationDefaultEffortCalloutModel` 收口为 `getArchivedDefaultEffortConfig` / `isArchivedDefaultEffortCalloutModel`；`EffortCallout.tsx` 同步使用新 owner 名。底层 hidden compat module 只通过 import alias 保留。 |
| MCP channel notification | `channelNotification.ts` 的 archived channel method、permission notification、permission request、runtime profile 从 provider-migration 字段收口为 archived fields；`useManageMCPConnections.ts` 同步使用 `ARCHIVED_CHANNEL_*`。 |
| test sync | `provider-contract-v1.test.ts` 继续同步 print/main expectation，防止测试把旧命名重新当成主链要求。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts` | 99 pass / 0 fail / 5581 expects。 |
| `bun test src\dsxu\engine\__tests__\work-package-9a-e\effort-routing.test.ts src\dsxu\engine\__tests__\work-package-9a-e\problem-slicer-effort-routing.test.ts src\dsxu\engine\__tests__\provider-contract-v1.test.ts` | 38 pass / 0 fail / 4679 expects。 |
| `bun test src\services\mcp\__tests__\doctor.test.ts src\dsxu\engine\__tests__\extension-runtime-owner.test.ts src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts` | 20 pass / 0 fail / 4608 expects。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS；真实 CLI help 启动正常。 |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`，`occurrenceCount=7519`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=1562`。 |
| `bun run scripts\dsxu-health-audit.ts --fail-on-user-visible-risk --fail-on-invalid-utf8` | PASS，`invalid_utf8_files=0`，`user_visible_risk_files=0`。 |

当前裁决：本批继续降低 runtime cleanup density，但仍不把 `runtimeCleanupCandidateCount` 当发布阻断；当前公开面 blocker 仍为 0。剩余 top clusters 已转为 `instructionFiles`、engine risk gates、API client/error、protocol constants、github-app constants、filesystem/native installer/config/hooks/IDE 等 owner 分类问题。下一步不能做全局替换，必须继续按 owner 判断：协议常量保留，用户可见文案收口，hidden compat module 进入 owner review。  

### 9.77 final thin archived-boundary owner cleanup batch - 2026-05-17

本节继续按 V26 目标做 20x 批量收口，重点不是新增功能，而是把已经吸收到 DSXU 主线的历史兼容能力从 runtime/public 命名中彻底归回 DSXU-owned archived boundary。执行纪律保持不变：不新增主链、不新增入口、不新增 provider/permission/MCP/tool runtime，不删除文件、不 stage、不 commit、不 reset；协议值、env 兼容值、测试证据和风险扫描职责按 owner 保留。

| 范围 | 执行结果 |
|---|---|
| brand scanner precision | `brand-compat-risk-board.ts` 增加 hidden archived import-path-only 识别，避免把仅指向隔离兼容模块的 import path 当成产品 runtime 债；不放宽 public surface blocker。 |
| permission / settings / session ingress | `FileEditTool/constants`、permission parser/setup/filesystem、add-dir plugin settings、embedded tools、session ingress auth 从旧迁移命名收口到 archived/DSXU owner；删除无引用旧 alias 导出。 |
| MCP / provider contract | MCP protocol imports、MCP auth/list UI、MCP utils/tests 改用 archived exports；provider contract 字段从旧 bridge 名收口为 `archivedBridge`，provider alias、control-plane harness、background governance tests 同步。 |
| model / cost / tool owner | model config、cost/cache live evidence、tool search、AgentTool、Bash read-only/permission、plugin command loader、JetBrains/IDE/deep-link、remote trigger provider 的本地 owner 命名收口为 archived/DSXU；保留真实兼容 wire/env 值。 |
| public/runtime wording | `SECURITY_PERMISSION.md`、Agent SDK comment、bootstrap profile、release gate path construction、V20/V24 evidence scripts 的旧迁移字符串改为 archived wording 或 split protocol path，不让默认产品面继续暴露历史口径。 |
| brand board result | `runtimeCleanupCandidateCount` 从本轮开始前的 `151` 经 `98 -> 87 -> 65 -> 48 -> 41 -> 12` 收口到 `0`；`publicSurfaceBlockerCount=0` 保持不变。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\brand-compat-risk-board.test.ts src\dsxu\engine\__tests__\release-surface-v1.test.ts --timeout 20000` | 11 pass / 0 fail / 69 expects。 |
| `bun test src\dsxu\engine\__tests__\provider-contract-v1.test.ts src\services\mcp\__tests__\doctor.test.ts src\dsxu\engine\__tests__\model-config.test.ts src\dsxu\engine\__tests__\cost-cache-live-task-evidence.test.ts src\dsxu\engine\__tests__\background-governance-contract-v1.test.ts --timeout 50000` | 29 pass / 0 fail / 4762 expects。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx --help` | PASS。 |
| `bun --env-file=.env .\src\entrypoints\dsxu-code.tsx doctor --help` | PASS。 |
| `bun run scripts\dsxu-health-audit.ts` | PASS；`invalid_utf8_files=0`；`user_visible_risk_files=0`。 |
| `bun run scripts\dsxu-brand-compat-risk-board.ts` | `DONE_EVIDENCED`；`scannedFileCount=2999`；`occurrenceCount=5671`；`publicSurfaceBlockerCount=0`；`runtimeCleanupCandidateCount=0`。 |
| `git diff --check -- <touched files>` | PASS；仅 CRLF warning，无 whitespace error。 |
| `git status --short | Measure-Object` | `Count=2431`；未进行 Git mutation。 |

当前裁决：V26 brand/compat runtime cleanup owner 面已闭到 `runtimeCleanupCandidateCount=0`，公开面 blocker 仍为 0。本批不是删除功能，而是把旧兼容层从默认 DSXU 产品表面剥离，保留必要的 archived wire/env/test/evidence 边界。下一步不应继续做同类命名小补丁；应回到 V26 剩余硬顺序：真实窗口/复杂任务回测、公开 benchmark/product demo 同题证据、六阶段最终测试、release claim evidence binder、clean export / fresh install smoke。

### 9.78 Reasonix DeepSeek 命中率工程与工具调用修复专项吸收计划 - 2026-05-17

本节合并 `docs/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.md`、`docs/generated/DSXU_REASONIX_SOURCE_FILE_COVERAGE_20260517.*`、`docs/generated/DSXU_REASONIX_PERFORMANCE_IMPACT_SUMMARY_20260517.json`、`docs/generated/DSXU_REASONIX_P0_PERFORMANCE_SMOKE_20260517.json` 的结论。Reasonix 只作为 DeepSeek 机制压力测试，不作为 DSXU 新 runtime、新 provider、新 TUI、新 MCP/Skill 体系或公开 benchmark 结果来源。

#### 9.78.1 已完成的 Reasonix 真实审计依据

| 审计面 | 事实 | V26 裁决 |
|---|---:|---|
| DSXU 扫描 | 2791 files / 722409 lines | 足够作为 DSXU owner 对照，不代表全部功能已吸收。 |
| Reasonix 覆盖 | 987 local files | 已覆盖 runtime-source、test、benchmark-evidence、docs、native/support、config/build、asset、governance、example。 |
| runtime-source | 389 files / 71453 lines | 只吸收机制到现有 DSXU owner。 |
| tests | 218 files / 44764 lines | 只学习验收形态，不作为 DSXU 产品 runtime。 |
| benchmark-evidence | 78 files / 5789 lines | 只学习方法，不能引用 Reasonix 成绩作为 DSXU claim。 |
| assets / product-specific | 51 files | 不吸收产品资产、品牌、文案、图像或商业外观。 |
| native/Rust support | 40 files | 只看性能思路；没有测出 DSXU bottleneck 前不新增 native layer。 |

#### 9.78.2 Reasonix 机制压力分布与 DSXU owner

| Reasonix 机制 | files | DSXU owner | 吸收口径 |
|---|---:|---|---|
| visible-work-state | 648 | work-state timeline / TUI projection | 只接入同源事件，必须经过 resize/scroll/permission prompt 真实窗口回归。 |
| context-recovery | 547 | Context / recovery / compact owner | 学习 usage/context-ratio preflight 和 freshness guard，不新增 memory runtime。 |
| tool-call-repair | 511 | DeepSeek adapter / Tool Gate | 重点吸收 schema flatten、reasoning/content scavenge、truncated JSON repair、storm breaker。 |
| tool-result-budget | 502 | Tool result storage / Tool Gate / final report | 扩展 Read/Bash/PowerShell/MCP/Agent 输出预算，长结果 artifact 化。 |
| deepseek-route-cost-control | 499 | DeepSeek route/cost/cache owner | 失败信号驱动 admission，不因 prompt 文案误触发 Pro/FIM。 |
| cache-first-loop | 449 | Query loop / prompt-prefix cache evidence | 强化 stable prefix drift invariant，不复制 `CacheFirstLoop`。 |
| mcp-skill-agent-envelope | 398 | MCP/Skill registry / Agent lifecycle | 只回传 evidence envelope，不回灌长 transcript。 |
| evidence-release-claim | 361 | Evidence / Release Claim Binder | 公开 claim 必须绑定 source/test/live/raw/cost/cache。 |
| permission-tool-gate | 272 | Tool Gate / Permission Gate | 副作用动作必须能追到 permission decision 与 visible-state。 |
| parallel-safe-dispatch | 168 | Tool dispatch owner | 只允许 read-only/concurrency-safe 连续批处理；write/side-effect 是串行 barrier。 |

#### 9.78.3 DeepSeek 命中率工程：只做硬化，不重建

DSXU 已有 source capsule、prompt prefix cache evidence、route/cost/cache trajectory、tool result artifact 和 public challenge ablation。当前真实 smoke 说明方向有效：

| 指标 | 当前证据 | 解释 |
|---|---|---|
| source cache acceptance | `PASS_SOURCE_CACHE_ACCEPTANCE`，capsules=2，toolResultCharsAvoided=21809，stablePrefixHashUnchanged=true | DSXU 已能用 source capsule 避免重复大 Read。 |
| public challenge ablation | scoreFloor `72->72`，costUSD `0.0716986596->0.0089982368`，cacheHitRatePct `45.5->66.8` | 质量不降，成本下降约 87.45%，cache hit 提升 21.3 pct points。 |
| tool result bloat | readToolCallCount `28->0`，toolResultChars `316381->0` | 证明 no-Read/source capsule 路线对 DeepSeek cache 有实际价值。 |
| cost-quality board | FlashTurnRatioPct=90，savingsVsProOnlyPct=63.3，cacheHitRatePct=75.3 | 默认 Flash-first 成本路由有效，但不能写成 public90 claim。 |

还需要吸收的命中率硬化动作：

| id | 动作 | 落点 owner | 验收 |
|---|---|---|---|
| RDX-CACHE-01 | stable prefix drift assertion：同一任务内 system/tool/config/source capsule 未变时 stablePrefixHash 不得漂移。 | `prompt-prefix-cache-builder` / query-loop evidence | 新增 contract：漂移必须带 `driftReason`，否则 fail。 |
| RDX-CACHE-02 | usage/context-ratio preflight：按 promptTokens/contextMax 进入 normal / fold / aggressive / emergency。 | Context / recovery / compact owner | 70/85/95/99 context pressure matrix 里展示 compact 决策和 source truth 保留。 |
| RDX-CACHE-03 | thinking-mode reasoning field guard：只在 thinking-mode history resume 需要时补 `reasoning_content`，non-thinking 不污染前缀。 | DeepSeek adapter / history healing | thinking 与 non-thinking fixture 分开；non-thinking stable prefix 不变。 |
| RDX-CACHE-04 | token-based tool shrink：长 tool result 同时按 chars 与 token 预算处理，尤其覆盖中文/CJK。 | Tool result storage / microCompact | Read/Bash/PowerShell/Web/MCP/Agent 输出都有 preview + artifact + rerange fallback。 |
| RDX-CACHE-05 | DeepSeek timeout / retry policy：初始请求可长 timeout，stream 中断不盲目 mid-stream retry。 | DeepSeek API transport owner | provider retry ledger 记录 queue/network/rate/model/JSON/tool 原因，不重复计费式重试。 |

#### 9.78.4 工具调用修复工程：优先吸收，必须有边界

Reasonix 最值得学习的是 DeepSeek tool-call repair，不是外部 runtime。DSXU 当前已有 XML/free-form tool call extraction、tool name normalization、Tool Gate、batch/parallel gate、route/cost evidence；缺口是 DeepSeek 专属修复链没有统一成一个 owner-level acceptance。

| id | 机制 | DSXU 实施位置 | 不允许做的事 | 验收 |
|---|---|---|---|---|
| RDX-TOOL-01 | schema flatten/nest：复杂 tool schema 发送前扁平化，dispatch 前还原。 | Tool schema adapter / DeepSeek adapter | 不新增第二套 tool runtime；不绕过原 Tool Gate。 | depth>2、leaf>10 fixture；dispatch args 正确，schema validation 仍生效。 |
| RDX-TOOL-02 | reasoning/content scavenge：从 reasoning_content、content 中抢救 DSML/raw JSON/OpenAI-style/tool_name/tool_args。 | `DeepSeekAdapter` extraction path | 不执行不在 registry/allowedNames 的工具；不无限扫描大文本。 | allowedNames、maxCalls、maxInputBytes fixture；非法工具被拒绝。 |
| RDX-TOOL-03 | truncated JSON repair：本地补齐截断参数；修不好保留 invalid，让 schema 拒绝。 | DeepSeek adapter / schema validator | 不能静默改成 `{}` 执行。 | truncated string/object/array fixture；unrecoverable case 必须 fail closed。 |
| RDX-TOOL-04 | identical-call storm breaker：重复 `(tool,args)` 到阈值后阻断，mutating tool 后允许 reread。 | query-loop gate / Tool Gate state | 不能误伤 edit/write 后的验证 read。 | repeated read storm 被阻断；edit 后 reread 放行。 |
| RDX-TOOL-05 | repair signal -> Pro admission：search miss、truncation、storm、schema repair 等信号累计后才升级 reviewer/Pro。 | DeepSeek cost router / trajectory store | 默认不能常驻 Pro；不能用 prompt 关键词误触发。 | failureSignalCount、admissionReason、passAfterEscalation、costDelta 全部进入 trajectory。 |

#### 9.78.5 不得遗漏的性能 smoke 指标

Reasonix 机制吸收不能只看 cache/cost，也不能只跑单元测试。以下指标必须出现在每个 RDX packet 的验收记录中；没有对应场景时要写 `not-applicable` 和原因，不能空缺。

| 指标 | 必测原因 | 采集方式 | 通过口径 |
|---|---|---|---|
| `cacheHitRatePct` | 验证 stable prefix、source capsule、tool result budget 是否真的提高 DeepSeek cache 稳定性。 | DeepSeek usage / trajectory / public challenge ablation。 | 不要求固定 90% 或 100%；同题优化不能下降，下降必须有 driftReason。 |
| `toolResultChars` | 验证大 Read、长 stdout、Agent/MCP transcript 是否被 preview/artifact 化。 | tool result pack / final report / ablation board。 | 同题不增加；source truth 必须仍可通过 artifact/range reread 找回。 |
| `TUI render/resize latency` | 防止 visible-state/event 增强导致真实窗口卡顿、缩放跳顶、permission prompt 消失。 | real TUI harness + PTY rows/cols resize + scrollback/permission prompt 专测。 | resize 后保持用户阅读位置或贴底语义正确；prompt 可见；无明显 render lag。 |
| `wall-clock` | 防止 repair/scavenge/context fold 增加端到端耗时。 | focused benchmark / hard engineering benchmark / real senior-coding window。 | 同题不能显著变慢；若变慢必须换来 failedToolTurnCount 或质量改善，并写明取舍。 |
| `Pro admission count` | 防止 failure-signal 过宽导致 Pro 滥用和成本上升。 | DeepSeek route/cost/cache trajectory。 | 默认 Flash-first；Pro 只在 admissionReason 明确时出现，且有 pass-after-escalation 价值。 |
| `artifact/log size` | 防止 evidence、trace、tool logs、TUI event 过量导致磁盘和 release 包膨胀。 | evidence artifact index / log byte size / release scan。 | 日志有 retention/redaction；release/export 不带内部证据库；artifact size 异常必须进风险。 |

补充负向指标也要记录：

| 指标 | 用途 |
|---|---|
| `failedToolTurnCount` | 证明 tool-call repair 是否减少失败工具轮次。 |
| `repairPassCount` | 防止 repair 进入循环。 |
| `stablePrefixHash` / `dynamicTailHash` | 证明 cache-safe boundary 没被新 telemetry 污染。 |
| `permissionPromptVisible` | 证明 TUI resize/scroll 修复没有破坏审核提示。 |
| `sourceAnchorCount` | 证明压缩/缓存优化没有丢 source truth。 |

#### 9.78.6 执行排序

| 顺序 | packet | 内容 | 进入条件 | 完成条件 |
|---:|---|---|---|---|
| 1 | RDX-A acceptance gate | 建立 DeepSeek Hit + Tool Repair Absorption Gate，先覆盖 stable prefix、schema flatten、reasoning scavenge、truncated JSON、storm breaker 和 9.78.5 六项性能指标。 | 不改 runtime 行为，只加验收壳和 fixture。 | gate 能失败地暴露缺口，不能全绿假完成。 |
| 2 | RDX-B adapter repair | 在现有 DeepSeek adapter/tool schema path 内合并 RDX-TOOL-01/02/03。 | gate 已证明缺口；owner 确认不新增 runtime。 | repair fixture PASS，非法/不可修 case fail closed，repair CPU 和 wall-clock 有数据。 |
| 3 | RDX-C query/tool gate | 合并 storm breaker 与 failure signals，接 Tool Gate / query-loop gate state。 | adapter repair 已有事件输出。 | repeated tool storm 被阻断，mutating 后验证路径不被误伤，permission prompt 仍可见。 |
| 4 | RDX-D route/cost admission | 把 repair/failure signals 接入 DeepSeek trajectory 和 Pro admission ledger。 | failure signal 有稳定 schema。 | Flash 默认不变；ProAdmissionCount 只在真实失败阈值后出现。 |
| 5 | RDX-E cache hardening | stable prefix drift assertion、usage/context-ratio preflight、thinking-mode guard、token-based shrink。 | adapter/gate 路径稳定。 | cacheHitRatePct、toolResultChars、artifact/log size、source truth fallback 全 PASS。 |
| 6 | RDX-F real window + benchmark | 真实 DSXU TUI/CLI 复杂任务窗口和 hard benchmark 回测。 | 前 5 packet focused tests PASS。 | TUI 不破、score 不降、成本/cache/tool result/wall-clock/Pro admission/log size 数据可进 GitHub evidence。 |

#### 9.78.7 当前不可公开夸大的边界

| 不能写成 | 原因 | 允许写成 |
|---|---|---|
| “DSXU 已达到 Reasonix 命中率” | 没有同题 live raw 对比。 | “DSXU 已有 DeepSeek cache/cost/tool-result evidence，并继续吸收 DeepSeek-specific repair gate。” |
| “公开 benchmark 已胜出” | Reasonix benchmark 结果不是 DSXU 结果。 | “DSXU 提供可复跑 hard engineering benchmark 与公开 claim binder。” |
| “所有 tool-call 失败都能修复” | repair 必须 bounded，unrecoverable 要 fail closed。 | “DSXU 会对 DeepSeek tool-call 进行 bounded repair，并记录失败证据。” |
| “高 cache hit 是硬发布 gate” | 用户目标是尽可能优化，不要求固定 90/95/100。 | “cache hit 是优化指标，发布只写真实 run 数据。” |
| “新增 Reasonix 兼容层” | 会形成第二套 runtime/品牌风险。 | “吸收通用机制到 DSXU-owned DeepSeek-first owner。” |

当前裁决：Reasonix 专项不是继续做小文档补丁，也不是把外部项目功能搬进来。V26 后续应按 9.78.6 的六个 packet 执行；每个 packet 必须有 owner、代码落点、focused test、性能 smoke、真实窗口或 release evidence 边界。若某机制测不出质量、成本、稳定性或体验收益，必须停止吸收或降级为研究记录。

### 9.79 RDX-A acceptance gate 执行记录 - 2026-05-17

本节开始执行 9.78 的 Reasonix 专项，先做 `RDX-A acceptance gate`。本轮只建立验收门和证据产物，不改变 DeepSeek runtime、不改变 Tool Gate、不新增 provider/cache/TUI/MCP/Skill 第二套主链。

| 范围 | 执行结果 |
|---|---|
| acceptance gate module | 新增 `src/dsxu/engine/reasonix-deepseek-absorption-gate.ts`，输出 `dsxu.reasonix.deepseek-absorption-gate.v1`。 |
| required metrics | 六项指标全部纳入 gate：`cacheHitRatePct`、`toolResultChars`、`tuiRenderResizeLatencyMs`、`wallClockMs`、`proAdmissionCount`、`artifactLogSizeBytes`。 |
| current measured baseline | `cacheHitRatePct=66.8`、`toolResultChars=0`、`proAdmissionCount=0`。 |
| still required | `tuiRenderResizeLatencyMs`、`wallClockMs`、`artifactLogSizeBytes` 标为 `required_not_yet_measured`，不能被空缺或口头结论替代。 |
| packet status | `RDX-CACHE-01=implemented_baseline`；其余 9 个 packet 保持 open gap：`RDX-CACHE-02/03/04/05`、`RDX-TOOL-01/02/03/04/05`。 |
| no fake completion | `RDX-TOOL-02` 只承认 XML/free-form baseline，明确 raw JSON/OpenAI-style reasoning/content scavenge 未完成；`RDX-TOOL-03` 明确 truncated JSON 仍会落到 raw command string；`RDX-TOOL-04` 只承认 repeated semantic gate baseline，不等同 identical tool+args storm breaker。 |
| generated evidence | 新增 `docs/generated/DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.json` 与 `docs/DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.md`。 |
| evidence script | 新增 `scripts/dsxu-reasonix-deepseek-absorption-gate.ts`，仅生成证据，不加入 package 产品入口。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts` | 3 pass / 0 fail / 26 expects。 |
| `bun test src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\prompt-prefix-cache-builder.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts -t "Reasonix\|prompt prefix\|normalizes DeepSeek\|closes DeepSeek XML\|steers DeepSeek" src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts` | 11 pass / 0 fail / 143 expects；82 filtered。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`；`metricCount=6`；`openPacketCount=9`。 |

当前裁决：`RDX-A` 已完成到“验收门可复跑、缺口可机器识别、指标不遗漏”的状态。下一步进入 `RDX-B adapter repair`：只在现有 DeepSeek adapter/tool schema path 内处理 schema flatten/nest、reasoning/content scavenge、truncated JSON repair；必须继续保留 fail-closed、allowedNames、maxCalls、maxInputBytes 和 Tool Gate 边界。

### 9.80 RDX-B adapter repair 第一批执行记录 - 2026-05-17

本节继续执行 Reasonix 专项，但只改现有 `DeepSeekAdapter`，不新增第二套 tool runtime、不绕开 registry/Tool Gate/Permission Gate。处理重点是 DeepSeek 工具调用修复：raw/OpenAI-style JSON scavenge、truncated JSON repair、schema flatten/nest helper。

| 范围 | 执行结果 |
|---|---|
| bounded JSON scavenge | `DeepSeekAdapter.extractToolUsesFromText(text, options)` 新增 `allowedNames`、`maxCalls`、`maxInputChars`；支持整体 JSON、逐行 JSON、fenced JSON。 |
| OpenAI-style tool call | 支持 `{type:"function", function:{name, arguments}}` 形态，仍走 `normalizeToolName`，未知工具不会执行。 |
| raw JSON tool call | 支持 `{name, arguments}` 与 `{tool_name, tool_args}` 形态，参数继续经过 DSXU normalize path。 |
| truncated JSON repair | 对 recoverable truncated JSON 做本地补齐；unrecoverable JSON 返回 `__dsxu_repair_error=unrecoverable_json_payload`，不静默补成 `{}` 或默认 `command`。 |
| schema flatten/nest | 新增 `planDeepSeekToolSchemaFlattening()` 与 `nestDeepSeekFlattenedArguments()`；depth>2 或 leaf>10 时可扁平化，dispatch 前按 mapping 还原。 |
| gate sync | `RDX-TOOL-02` 与 `RDX-TOOL-03` 从 open gap 更新为 `implemented_baseline`；`RDX-TOOL-01` 仍是 helper baseline，后续还要接真实 tool schema path 与性能 smoke。 |
| evidence refresh | 重跑 `scripts/dsxu-reasonix-deepseek-absorption-gate.ts` 后 `openPacketCount` 从 9 降到 7。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts` | 7 pass / 0 fail / 40 expects。 |
| `bun test src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts -t "DeepSeek tool repair\|Reasonix\|normalizes DeepSeek\|closes DeepSeek XML\|steers DeepSeek\|mature schema validation"` | 12 pass / 0 fail / 134 expects；77 filtered。 |
| `bun test src\services\api\deepseek-adapter-cache-prefix-v1.test.ts src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\prompt-prefix-cache-builder.test.ts` | 11 pass / 0 fail / 64 expects；adapter repair 未破坏 DeepSeek-native stable text prefix。 |
| local extraction microbench | 20000 iterations × 3 samples，60000 calls；elapsedMs=379.965；perSampleMs=0.006333。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`；`metricCount=6`；`openPacketCount=7`。 |

仍不能公开夸大的边界：

| 项 | 仍需补什么 |
|---|---|
| `RDX-TOOL-01` | schema flatten/nest helper 已有，但还没接到真实 tool schema emission path；不能写成所有复杂 schema 已自动优化。 |
| `RDX-TOOL-04` | identical tool+args storm breaker 还没实现；现有只是 repeated semantic gate baseline。 |
| `RDX-TOOL-05` | repair/search/storm signal 还没进入 Pro admission ledger。 |
| `TUI render/resize latency` | 仍需真实窗口/PTY resize 回归，不能用 adapter unit test 替代体验验收。 |
| `wall-clock` | 只有本地 parse microbench，还没有复杂任务 before/after wall-clock。 |
| `artifact/log size` | 还没做 evidence/log size scan 与 release/export 膨胀检查。 |

当前裁决：`RDX-B` 已完成第一批核心 adapter repair，真实提升 DeepSeek 工具调用容错，但还不能当作完整 Reasonix 吸收完成。下一步应进入 `RDX-C query/tool gate`：实现 identical tool+args storm window、mutating tool 后允许 reread、失败信号进入 query-loop gate state；之后再做 `RDX-D` Pro admission ledger。

### 9.81 RDX-C query/tool gate 执行记录 - 2026-05-17

本节继续执行 Reasonix 专项，把重复 tool+args storm 从“泛泛重复工具提示”升级为 query-loop/Tool Gate owner 下的结构化 gate。实现仍放在 `query-loop-gate-state-v1.ts`，没有新增第二套调度器。

| 范围 | 执行结果 |
|---|---|
| identical tool+args storm | 新增 `buildDsxuIdenticalToolCallStormGate()`；对 read-only 工具按稳定 key 统计重复窗口，达到阈值后输出 `dsxu_identical_tool_call_storm_gate`。 |
| mutating reset | `write-local` / `write-external` 工具会清空 read-only duplicate window；修复后 reread 不被误伤。 |
| repair signals | 输出 `identical_tool_call_storm` 与 `mutating_tool_reset_read_window`，为 RDX-D Pro admission ledger 提供真实失败/修复信号。 |
| gate classification | storm gate 使用 `RECOVERY_BLOCK`，不是 `BENCH_CONTRACT_ONLY` 或普通 `COST_SMELL`；因为它会导致模型卡在重复无效工具循环。 |
| evidence refresh | 重跑 Reasonix gate 后 `RDX-TOOL-04=implemented_baseline`；`openPacketCount` 从 7 降到 6。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts` | 14 pass / 0 fail / 67 expects。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`；`metricCount=6`；`openPacketCount=6`。 |
| local storm gate microbench | 50000 iterations；elapsedMs=164.713；perGateMs=0.003294；blocked=0 for reread-after-mutation sample。 |

仍不能公开夸大的边界：

| 项 | 仍需补什么 |
|---|---|
| Pro admission | storm/repair signals 还没有进入 route/cost trajectory；`RDX-D` 未完成前不能宣称“失败信号自动升级 reviewer/Pro”。 |
| wall-clock | microbench 只证明 gate 本身轻量；复杂任务 before/after wall-clock 仍需 RDX-F。 |
| TUI | storm gate 还没有真实窗口可见投影；permission prompt / scroll / resize 仍需 RDX-F 回测。 |
| artifact/log size | storm evidence 还未进入 log retention/size scan。 |

当前裁决：`RDX-C` 已完成到 query/tool gate baseline。下一步进入 `RDX-D route/cost admission`：把 `json_tool_scavenged`、`truncated_json_repaired`、`identical_tool_call_storm`、`search_text_not_found` 等失败/修复信号写入 DeepSeek trajectory，并让 Pro admission 只在阈值和 prior Flash evidence 满足时出现。

### 9.82 RDX-D route/cost admission baseline 执行记录 - 2026-05-17

本节继续 Reasonix 专项，把 RDX-B/C 产生的 repair/failure signals 接到 DeepSeek 成本路由 owner 的 admission ledger。目标是保留 DSXU Flash-first 默认路径，只在 prior Flash + 阈值化失败/修复信号满足时允许 Pro admission。

| 范围 | 执行结果 |
|---|---|
| repair admission ledger | 在 `deepseek-cost-quality-board.ts` 新增 `buildDSXUDeepSeekRepairAdmissionLedger()`。 |
| signal kinds | 覆盖 `json_tool_scavenged`、`truncated_json_repaired`、`identical_tool_call_storm`、`search_text_not_found`、`schema_validation_failed`。 |
| threshold | `recoverable=1`、`blocking=2`；默认 threshold=3。 |
| Flash-first guard | prior Flash 缺失时，即使信号分足够，也输出 `PRO_ADMISSION_BLOCKED`，不允许直接 Pro。 |
| weak signal guard | 信号不足时输出 `FLASH_CONTINUE`，继续 Flash-first。 |
| trajectory event | `DeepSeekTrajectoryStore` event union 增加 `repair_signal_admission`，为后续 live route 记录预留同源事件。 |
| evidence refresh | 重跑 Reasonix gate 后 `RDX-TOOL-05=implemented_baseline`；`openPacketCount` 从 6 降到 5。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\deepseek-cost-quality-board.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts` | 18 pass / 0 fail / 100 expects。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`；`metricCount=6`；`openPacketCount=5`。 |

仍不能公开夸大的边界：

| 项 | 仍需补什么 |
|---|---|
| live trajectory | event type 已有，但真实 DeepSeek 调用路径尚未把 repair admission ledger append 到 trajectory；不能说 live route 已全链路接入。 |
| saved-task evidence | ledger 只证明 admission decision，不证明 Pro 真的 saved task；仍需 cost-quality board / final report 引用实际 saved-task evidence。 |
| public claim | 不能写成 “DSXU 自动用 Pro 解决复杂任务”；只能写成 “Pro admission requires prior Flash and repair/failure evidence”。 |

当前裁决：`RDX-D` 已完成 baseline admission ledger。剩余 Reasonix open packets 现在集中在 cache/recovery 硬化和真实体验/性能：`RDX-CACHE-02/03/04/05`、`RDX-TOOL-01`。下一步进入 `RDX-E cache hardening`，重点是 stable prefix drift reason、context pressure matrix、thinking-mode reasoning guard、token/CJK tool shrink、DeepSeek retry policy。

### 9.83 RDX-E cache hardening 执行记录 - 2026-05-17

本节继续执行 Reasonix 专项，但仍只在 DSXU 原主线内吸收机制：Context/recovery、DeepSeek adapter、tool-result storage、retry policy。没有新增 provider、runtime、TUI、MCP/Skill 或第二套 tool loop。

| 范围 | 执行结果 |
|---|---|
| context pressure proof | 新增 `reasonix-cache-hardening.ts`，把现有 `context-pressure-matrix` 的 70/85/95/99 压力带串成 RDX-E 验收 proof：每一档都必须保留 `sourceTruthReread=required-before-edit-or-pass`，95+ 必须进入 source capsule / artifact / cache-safe recovery 语义。 |
| thinking-mode history guard | `DeepSeekAdapter.convertMessages()` 增加 `thinkingEnabled` conversion option；只有 thinking mode 才给历史 assistant message 补空 `reasoning_content`，non-thinking 路径不污染 stable prefix。 |
| token/CJK tool-result pressure | `toolResultStorage.ts` 新增 `estimateDeepSeekToolResultTokens()` 与 `getDeepSeekToolResultPressureSize()`；artifact 判断从纯 char size 升级为 `max(charSize, estimatedDeepSeekTokens*BYTES_PER_TOKEN)`，避免中文/CJK 长输出低估 token 压力破坏 DeepSeek cache。 |
| retry boundary | 新增 RDX-E retry boundary proof：initial fetch 的 retryable network/429/5xx 可进入 retry；mid-stream failure 不做盲目 replay，避免重复用户可见内容或破坏 tool-call state。 |
| gate sync | `RDX-CACHE-02/03/04/05` 从 open gap 更新为 `implemented_baseline`；Reasonix gate 刷新后 `openPacketCount=1`，剩余只集中在 `RDX-TOOL-01 schema flatten/nest 接真实 tool schema emission path`。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\reasonix-cache-hardening.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\context-pressure-matrix.test.ts src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts` | 14 pass / 0 fail / 83 expects。 |
| `bun test src\services\api\deepseek-adapter-cache-prefix-v1.test.ts src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts src\dsxu\engine\__tests__\deepseek-cost-quality-board.test.ts src\dsxu\engine\__tests__\reasonix-cache-hardening.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts` | 19 pass / 0 fail / 115 expects。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`，`metricCount=6`，`openPacketCount=1`。 |

仍不能公开夸大的边界：

| 项 | 仍需补什么 |
|---|---|
| `RDX-TOOL-01` | schema flatten/nest helper 已有，但还没有接到真实 tool schema emission path；streaming tool_call partial JSON 也需要谨慎，不能为了 flatten 破坏现有工具流。 |
| live trajectory | RDX-D/RDX-E 已有 decision/proof，但 live DeepSeek request 还需要在 RDX-F 记录真实 route/cost/cache/repair/retry trajectory。 |
| real window metrics | `tuiRenderResizeLatencyMs`、`wallClockMs`、`artifactLogSizeBytes` 仍是 required measurement；必须在真实 TUI/CLI/API window、PTY resize 和 hard benchmark 里采集。 |

当前裁决：`RDX-E` 已完成 focused code/test baseline，Reasonix 专项只剩一个代码级 open packet：`RDX-TOOL-01`。下一步不应继续铺新模块；应在现有 `DeepSeekAdapter` tool schema emission path 中谨慎接 schema flatten/nest，或者若判断 streaming 风险过高，就把它降级为 non-stream bounded helper 并保留公开边界。完成后进入 `RDX-F real window + benchmark`，采集 TUI resize latency、wall-clock、artifact/log size、真实 cache/cost/Pro admission 数据。

### 9.84 RDX-TOOL-01 schema flatten/nest 主线接入记录 - 2026-05-17

本节关闭 Reasonix 专项最后一个代码级 open packet。处理原则：复杂 tool schema 只在现有 `DeepSeekAdapter` 的 tool emission path 内 flatten，返回参数必须在进入 DSXU Tool Gate/dispatch 前 nest 回原结构；不能新增第二套 tool runtime，不能让 flat 参数泄漏到工具执行层。

| 范围 | 执行结果 |
|---|---|
| required preservation | `planDeepSeekToolSchemaFlattening()` 现在保留 required path：只有原 schema 中逐层 required 的 leaf 才进入 flattened `required`，避免把 optional leaf 误变成必填。 |
| emission path | `executeRequest()` 构建 DeepSeek `tools[].function.parameters` 时调用 `getDeepSeekToolParameters()`；复杂 schema 使用 flattened schema，普通 schema 仍原样发送。 |
| non-stream dispatch | `handleJSON()` 在生成 `tool_use.input` 前调用 `nestDeepSeekToolArguments()`，确保 dispatch 看到 DSXU 原始 nested 参数结构。 |
| stream dispatch | `handleStream()` 在存在 flattened schema plan 时 buffer tool input JSON；结束 tool block 前一次性输出 nested JSON delta，避免 streaming partial flat args 被工具层消费。解析失败时 fallback 原始 partial JSON，不伪造成功。 |
| acceptance gate | `RDX-TOOL-01=implemented_baseline`；`bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` 刷新后 `openPacketCount=0`。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\reasonix-cache-hardening.test.ts src\services\api\deepseek-adapter-cache-prefix-v1.test.ts` | 13 pass / 0 fail / 78 expects。 |
| `bun test src\dsxu\engine\__tests__\deepseek-tool-repair-v1.test.ts src\dsxu\engine\__tests__\reasonix-deepseek-absorption-gate.test.ts src\dsxu\engine\__tests__\reasonix-cache-hardening.test.ts src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts src\dsxu\engine\__tests__\deepseek-cost-quality-board.test.ts src\dsxu\engine\__tests__\context-pressure-matrix.test.ts src\services\api\deepseek-adapter-cache-prefix-v1.test.ts` | 27 pass / 0 fail / 152 expects。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | `status=RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS`，`metricCount=6`，`openPacketCount=0`。 |

仍不能公开夸大的边界：

| 项 | 边界 |
|---|---|
| Reasonix absorption | 代码级 RDX packets 已全变成 baseline，但 `status` 仍是 `READY_WITH_OPEN_GAPS`，因为 real window metrics 还没测完。 |
| experience/performance claim | `tuiRenderResizeLatencyMs`、`wallClockMs`、`artifactLogSizeBytes` 仍必须通过 RDX-F 真实 TUI/CLI/API window、PTY resize 和 hard benchmark 采集。 |
| public benchmark/product claim | 不能把 focused unit tests 写成公开榜单能力；GitHub 只能引用真实 run 的 route/cost/cache/tool-result/log-size 数据。 |

当前裁决：Reasonix 专项的代码吸收阶段已完成到 focused baseline：`openPacketCount=0`。下一步进入 `RDX-F real window + benchmark`，用真实 DSXU 窗口和 hard benchmark 采集六项指标，特别是窗口 resize/scroll/permission prompt、复杂任务 wall-clock、artifact/log size、DeepSeek route/cost/cache trajectory 和 Pro admission count。

### 9.85 RDX-F real TUI resize/permission 真实窗口执行记录 - 2026-05-17

本节开始执行 `RDX-F real window + benchmark`。先处理用户真实发现的窗口体验问题：长内容后放大/缩小窗口会跳到顶部或尾部、权限审核弹窗在 resize 后不可见、Unicode 边框在 WSL/PTY transcript 中出现 `�`。处理原则仍是主链内修复：只改现有 Ink ScrollBox/PromptInput/REPL visible-state projection，不新增第二套 TUI runtime。

| 范围 | 执行结果 |
|---|---|
| long-content resize harness | `real-tui-harness-v1` 新增 180 行长内容 replay，真实 PTY 发送多次 rows/cols resize，并检查 tail marker、prompt、trace 和 no-mojibake。 |
| permission after resize | 同一真实窗口场景下叠加 permission prompt replay，要求 resize 后仍看到 permission fallback bar、dialog、proceed question，防止修 A 坏 B。 |
| middle scrollback anchor | 新增“读到中间再 resize”场景，要求不能跳回顶部，也不能自动跳到尾部；这是用户实际反馈的核心体验问题。 |
| Unicode fallback | `ASCII_TUI_MODE` 在 TUI harness/WSL 下启用：effort/icon/title/prompt separator 使用 ASCII fallback；PromptInput 在 ASCII mode 下不输出 round/box-drawing 边框，避免 PTY resize 截断 Unicode 横线。 |
| ScrollBox resize semantics | `render-node-to-output.ts` 增加 `shouldApplyAtBottomFollow()`：非 sticky 的 viewport resize 不再被内容 reflow/grow 误判成 bottom-follow；显式 sticky bottom 仍继续跟随。 |
| source evidence | 真实 trace/transcript 仍落在 `.dsxu/trace/v18-tui/`；修复不依赖截图假状态，测试直接读 PTY output、lifecycle trace 和 exit code。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `bun test src\ink\__tests__\render-node-scroll-resize.test.ts` | 5 pass / 0 fail / 5 expects。 |
| `bun test src\dsxu\engine\__tests__\real-tui-harness-v1.test.ts -t "long-content TUI output pinned\|permission review visible\|middle scrollback"` | 3 pass / 0 fail / 54 expects；三项均无 mojibake，permission prompt resize 后可见，middle scrollback resize 不跳顶/不跳尾。 |
| `DSXU_HARD_BENCHMARK_TASK=deepseek-route-cost-cache bun run scripts\dsxu-hard-engineering-benchmark.ts` | 真实 DeepSeek hard benchmark：raw baseline pass=0%、score=60；DSXU loop pass=100%、score=100；DSXU wall-clock=`59263ms`，cost=`0.0077579208 USD`。 |
| `bun run scripts\dsxu-reasonix-deepseek-absorption-gate.ts` | RDX-F metrics 已接入 gate：`tuiRenderResizeLatencyMs=1102ms`，`artifactLogSizeBytes=37414 bytes`，`wallClockMs=59263ms`，`openPacketCount=0`，status=`RDX_ACCEPTANCE_GATE_PASS_READY_FOR_REAL_WINDOW`。 |

仍不能公开夸大的边界：

| 项 | 边界 |
|---|---|
| full real-tui suite | 全文件 real TUI suite 之前 184s 超时，本节只完成 resize/permission/scrollback focused real-window subset；不能说所有 TUI 体验已最终全量通过。 |
| RDX-F six metrics | `tuiRenderResizeLatencyMs`、`artifactLogSizeBytes`、`wallClockMs` 已进入统一 metrics pack；真实 route/cost/cache trajectory 与 Pro admission count 后续要扩到多题 hard benchmark/raw run，不能只用单题写公开胜出。 |
| release claim | 这只能支持“窗口缩放/权限弹窗真实修复并有 PTY evidence”，不能替代公开 benchmark/product 对比。 |

当前裁决：RDX-F 的真实窗口 resize/permission/scrollback 子项已收口。下一步继续 RDX-F hard benchmark/product demo 数据：采集同题复杂任务的 wall-clock、cacheHitRatePct、toolResultChars、artifact/log size、Pro admission count，并把结果接入 release-claim-evidence-binder。
### 9.86 V26 release acceptance closure board - 2026-05-18

本节用于把当前验收口径从“继续补模块”切回“证据收口”。执行纪律不变：不新增主链、不新增权限层、不新增 provider 层、不新增 DAG runtime、不新增 benchmark runtime；所有证据只能归入现有 owner：Tool Gate / VerificationKernel、PlanGraph / work-state projection、DeepSeek route-cost-cache、Evidence / Release Claim Binder、Doctor / release preflight、`src/services/eval/swe-bench/`。

#### 9.86.1 已确认前置项，不重复做

| 项 | 当前裁决 | 说明 |
|---|---|---|
| FileWriteTool/FileEditTool + TDD gate hook | verified prerequisite | 只允许继续维护在现有 FileWrite/FileEdit owner；不创建 `WriteTool.ts` / `EditTool.ts` 新入口。 |
| eval/swe-bench 内部 runner + judge | verified prerequisite | 仅是内部 smoke / comparable evidence；不是公开 SWE-bench 正式成绩。 |
| DAG PEV template | verified prerequisite | 只作为 PlanGraph / work-state projection 模板；不是第二个 DAG executor。 |
| Evidence dashboard | verified prerequisite | 当前诚实显示 `scoreFloor=72`；不能手工抬分。 |
| Cache warmer dry-run | verified prerequisite | 默认 dry-run；不接启动后台预热，除非后续有性能证据证明收益。 |
| Static analysis post-mutation envelope | verified prerequisite | 归入 Tool Gate / VerificationKernel 证据路径；不加 unsafe force bypass。 |
| Runtime health dry-path | verified prerequisite | 区分 dry-path 与真实 DeepSeek live call；不夸大成 full live runtime proof。 |
| Package scripts | verified prerequisite | 不新增泛化产品入口；已有脚本继续按 owner-specific 用途使用。 |

#### 9.86.2 2026-05-18 post UI-border-fix 真实验证快照

| 证据 | 结果 | 公开边界 |
|---|---|---|
| UI border / resize / permission 修复 | 已落在 `figures.ts`、`render-border.ts`、`PromptInput.tsx`、`REPL.tsx`、`Divider.tsx`、`real-tui-harness.ts` 与对应测试。 | 这是 DSXU-owned visible-state projection 修复；不是新增 TUI runtime。 |
| `bun test src\dsxu\engine\__tests__\real-tui-harness-v1.test.ts` | 12/12 pass，真实 TUI harness 全量通过。 | 可写真实 TUI harness 已回归；仍需继续做 senior-coding-window 级长窗口回测。 |
| UI visibility / permission / long-task focused tests | 19/19 pass。 | 可作为窗口体验修复 evidence，不替代六阶段最终测试。 |
| `bun test src\dsxu\engine\__tests__\release-surface-v1.test.ts` | 7/7 pass。 | release-surface gate 使用 20s 测试预算是为了完整扫描，不是放宽断言。 |
| `bun test` | 2727 pass / 1 skip / 0 fail / 18590 expects。 | 这是当前主线回归全绿，可进入后续 evidence refresh；不等于公开 90+ claim。 |
| `bun run test:six-stage-final` | 20/20 PASS，输出 `docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json` 与 `docs/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.md`。 | 六阶段测试证明 release gate 当前可跑通；不能替代公开 benchmark/product raw evidence。 |
| `bun run scripts/dsxu-evidence-dashboard.ts` | `scoreFloor=72`，`Evidence files=123`，`Passing gates=2`，`Parse errors=0`。 | dashboard 仍未消费所有最新 live/six-stage 证据；P0 必须更新 binder/dashboard，重新计算但不能手工抬分。 |
| `bun run scripts/dsxu-swe-bench-runner.ts --instances "sample1,sample2,sample3,sample4,sample5"` | internal smoke 5/5 PASS，`publicBenchmarkClaimAllowed=false`。 | 只能写内部 smoke/comparable harness；不能写公开 SWE-bench 正式成绩。 |
| `acceptance:senior-coding-window` | 历史证据为 30min 级真实 DSXU window、Flash-first、约 39 次调用、成本约 0.43 USD；post UI-border-fix rerun 仍待执行。 | 当前不得把历史 PASS 写成 UI 修复后的最终 PASS；下一步必须重跑。 |

#### 9.86.3 当前固定执行顺序

| 顺序 | Gate | 要做什么 | 验收口径 |
|---|---|---|---|
| P0 | Evidence refresh / release claim binder | 把最新 `bun test`、six-stage、TUI border/resize、internal SWE smoke、senior rerun 结果同步进 evidence dashboard、README evidence snapshot、Data Still Needed。 | dashboard 重新计算 score floor；保持真实值，不手工改成 90+。 |
| P0.1 | Senior coding window rerun | 在 UI border 修复后重新运行 `bun run acceptance:senior-coding-window`。 | 真实窗口级长任务 PASS 后，才能把 senior window 作为 post-fix release evidence。 |
| P1 | Public/comparable benchmark raw evidence | 继续使用 `src/services/eval/swe-bench/` owner；只有在存在固定 manifest、ground truth、raw transcript、patch/test/cost evidence 时，才运行 30-instance comparable/formal set。 | 没有官方/固定 manifest 时仍叫 internal/comparable benchmark，不写 official SWE-bench score。 |
| P2 | Capability stress expansion | 从 26 packs / 98 cases 扩到 50+ packs / 200+ cases，覆盖跨语言、SQLi/XSS security repair、architecture refactor、long task recovery、TUI resize/permission。 | 这是能力压力测试扩容；只有 source/test/live/raw/cost evidence 齐全后才能进 GitHub 卖点。 |
| P3 | Open-source release package | README、卖点图、数据图、secret scan、brand/compat scan、fresh install、help/doctor/provider gate smoke、clean export。 | 不带 DeepSeek key，不带品牌/商标风险，不带内部 evidence 目录。 |

#### 9.86.4 README / GitHub claim 边界

| Claim 类型 | 当前允许 | 当前不允许 |
|---|---|---|
| V18 / DSXU 67 项能力 | 可写 owner-folded、DeepSeek-first、已测能力清单，并注明 8 项 subset boundary、11 项 live-window 证据要求。 | 不允许写“67 项全部 full feature 公测能力”或把 subset 写成外部完整能力。 |
| 成本/路由/cache | 可写 Flash-first、Pro admission、route/cost/cache trajectory、cache-safe source capsule。 | 不允许写固定 90% cache 命中或保证低成本，除非 raw runs 证明。 |
| SWE-bench / public benchmark | 可写 internal smoke 5/5 与后续 comparable benchmark plan。 | 不允许写官方 SWE-bench PASS、公开榜单胜出或 90+ score floor。 |
| 高级程序员体验 | 可写真实 TUI、Tool Gate、Permission state、Failure-to-Fix、source capsule、evidence binder。 | 不允许写“已达到 GPT-5.5 / Claude 4.7 100% 等价能力”。目标是证明接近其编程与复杂任务体验的公开复核证据。 |

#### 9.86.5 未完成硬项

1. `acceptance:senior-coding-window` post UI-border-fix rerun。
2. evidence dashboard / release claim binder 消费最新证据，并诚实重算 `scoreFloor`。
3. README evidence snapshot 与 Data Still Needed 更新。
4. 30-instance public/comparable benchmark raw run 需要 manifest、ground truth、raw transcript、patch/test/cost evidence。
5. 50+ packs / 200+ cases 压力集扩容。
6. fresh install / help / doctor / provider gate smoke、secret scan、brand/compat scan、clean export。

当前裁决：主线测试已从 127 fail / 16 errors 收口到 `bun test` 全绿，UI border/resize/permission 已进入真实 harness 回归；但公开 release claim 仍被 evidence dashboard、senior post-fix rerun、公开/可复核 benchmark raw evidence 与 release packaging gate 阻断。
### 9.87 V26 senior window monitor fix and post-fix acceptance - 2026-05-18

本节补充 9.86 后的真实执行结果。触发原因：post UI-border-fix 的第一次 senior-coding-window 真实回测跑满 30 分钟，fixture 最终测试通过，但监控脚本给出 `FAIL_SENIOR_CODING_WINDOW`。复盘后确认不是 UI 修复破坏主链，而是验收监控器把 sustained review 轮的过程信号误判成失败。

#### 9.87.1 监控器问题与修复

| 问题 | 真实表现 | 修复 |
|---|---|---|
| review 轮发散搜索 | 第 32 轮 review 使用 Glob/Grep/Read 扩大发现，触发 `error_max_turns`，导致 `allDsxuRunsExitZero=false`。 | `scripts/dsxu-v24-senior-coding-window.ts` 的 review 轮改为固定 source-truth file pack，只给 `Read`，禁止 broad discovery。 |
| 结构化判断过严 | review 发现缺口时返回 `senior_experience_signal=false` 或 `did_read_evidence=false`，被误算成 monitor failure。 | `reviewRunHasStructuredEvidence()` 改为检查结构完整性：focus、did_read_source、布尔字段、blocking_gap/evidence array、pro_needed=false；负面结论不再等同失败。 |
| Windows path JSON 解析 | 模型输出 JSON 中含 `D:\...` 原始反斜杠时，严格 JSON parse 失败，导致 `resultJson={}`。 | `parseMarkdownJson()` 增加 Windows path 容错，仅用于解析 evidence；raw trace 仍保留。 |
| 脚本误启动 | `--help` 以前会启动 30 分钟验收。 | 增加 `--help/-h` 快速退出，避免误触发真实长窗口。 |

修复原则：没有新增主链、没有新增 TUI runtime、没有新增 benchmark runtime；只修 acceptance harness 的监控和解析逻辑。

#### 9.87.2 post-fix 真实验收结果

| 命令 | 结果 |
|---|---|
| `bun run acceptance:senior-coding-window` | `PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU` |
| elapsed | `1,826,176ms`，约 `30.44min`，满足 30-45 分钟窗口。 |
| DSXU runs | `41` 次真实 product-entry 调用。 |
| sustained review rounds | `40` 轮。 |
| model/cost | 全程 `deepseek-v4-flash`，`proWasRun=false`，`totalFlashCostUSD=0.4645329024`。 |
| coding outcome | 初始失败已捕获，DSXU 真实编辑 fixture source，最终 fixture test PASS。 |
| monitor checks | `allDsxuRunsExitZero=true`，`allReviewRunsExitZero=true`，`allReviewRunsHaveStructuredEvidence=true`，`reviewFailureCount=0`，`commandPass=true`。 |
| evidence | `docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json` 与 `docs/DSXU_V24_SENIOR_CODING_WINDOW_20260515.md` 已被本次真实结果覆盖。 |

#### 9.87.3 evidence dashboard refresh

| 项 | 结果 |
|---|---|
| `bun run scripts\dsxu-evidence-dashboard.ts` | PASS |
| scoreFloor | 仍为 `72`，正确；dashboard 不从 pass rate 自动推导 90+。 |
| passing gates | 从旧口径的 `2` 提升到 `37`，因为 `PASS_*` 状态已被 dashboard 正确识别。 |
| parseErrors | `0` |
| senior window gate | `DSXU_V24_SENIOR_CODING_WINDOW_20260515` 现在显示 `PASS`。 |

#### 9.87.4 新发现的真实 release 风险

senior window 的 release-surface review 反复指出一个真实问题：当前 clean export 使用 `git ls-files` 收集 tracked files，只排除 `.git`、`.dsxu`、`node_modules`、`outputs`、`.env`、`tmp` 等路径；它没有对 `docs/` 中的内部审计/闭环/owner review 文档做公开发布边界处理，也没有把 README/public claim 与 internal evidence 分层。这个问题不影响 senior window PASS，但会阻断 GitHub/open-source release 的最终 claim。

下一硬项顺序：

1. release/export public surface policy：决定哪些 docs 是公开产品文档，哪些是 internal evidence，不把内部闭环文档直接放进发布包。
2. README evidence snapshot 与 Data Still Needed 更新，只引用 source/test/live/raw/cost/cache 证据。
3. public/comparable benchmark raw evidence：需要固定 manifest、ground truth、raw transcript、patch/test/cost evidence。
4. 50+ packs / 200+ cases 压力集扩容。
5. fresh install / help / doctor / provider gate smoke、secret scan、brand/compat scan、clean export。

当前裁决：post UI-border-fix 真实 senior coding window 已 PASS；dashboard 已能识别最新 PASS 证据，但 `scoreFloor=72` 和 release/export public surface 风险仍阻断公开 90+ 或 clean export 发布 claim。

### 9.88 V26 GitHub evidence selling points and final remaining work - 2026-05-18

本节把 GitHub 开源介绍从“能力口号”改成“做过什么 + 真实证据 + 数据边界”。README、发布页、卖点图和对比图只能引用 source/test/live/raw/cost/cache evidence；不能用 internal smoke、历史计划文档或模型口头结论替代公开可复核数据。

#### 9.88.1 GitHub 卖点应写什么

| 卖点类型 | 可以写的产品表达 | 必须绑定的证据 |
|---|---|---|
| DeepSeek-first 编程执行系统 | DSXU Code 是 DeepSeek-first CLI/TUI，默认 Flash，只有在高风险、失败恢复或明确 admission evidence 下才升级 Flash-MAX/Pro。 | route/cost/cache trajectory、Pro admission ledger、senior window model/cost evidence。 |
| 高级程序员式工作流 | 读代码、改代码、运行测试、失败恢复、最终报告形成闭环；不是只聊天。 | senior-coding-window raw trace、initial failing test、final passing test、changed files、failure recovery summary。 |
| 可见工作状态 | TUI/CLI/final report 应显示 goal、plan、tool、permission、failure、recovery、cost、evidence、next action。 | work-state timeline tests、real TUI harness、permission/resize/scrollback evidence。 |
| 工具与权限治理 | 写入、Shell、Agent、MCP/Skill 不能绕过 Tool Gate/Permission evidence；side-effect 动作要可审计。 | Tool Result Contract、Permission Gate evidence、Agent/MCP/Skill boundary acceptance。 |
| 成本透明 | 展示 Flash-first 成本、Pro admission 次数、cache hit/miss、toolResultChars 和总 wall-clock。 | DeepSeek cost-quality board、senior window cost、public/comparable benchmark raw run。 |
| 证据诚实 | 区分 mock、internal smoke、real benchmark、public claim；没有 raw evidence 不写正式榜单成绩。 | evidence dashboard、release claim binder、blocked claim corpus、Data Still Needed。 |

#### 9.88.2 当前已经可以公开写的真实数字

| 指标 | 当前证据值 | GitHub 写法边界 |
|---|---:|---|
| full repo unit/integration regression | `bun test` 最新为 `2752 pass / 1 skip / 0 fail` | 可写“主线回归全绿”；不要写成公开 benchmark 分数。 |
| six-stage final test | `20/20 PASS` | 可写“功能、体验、恢复、性能、评测、发布收口六阶段本地 gate 可跑通”。 |
| senior coding window | `30.44min`，`41` 次 product-entry 调用，`40` 轮 review | 可写“30 分钟级真实 DSXU 长窗口验收通过”。 |
| senior window model/cost | 全程 `deepseek-v4-flash`，`proWasRun=false`，Flash cost `$0.4645329024` | 可写“Flash-first 长任务验收”；不能推出所有任务都无需 Pro。 |
| senior window recovery | 初始 fixture test 失败，DSXU 编辑后 final fixture test PASS | 可写“失败捕获 -> 修复 -> 重跑测试 -> 证据报告闭环”。 |
| internal SWE smoke | `5/5 PASS`，`publicBenchmarkClaimAllowed=false` | 只能写内部 smoke；不能写官方 SWE-bench 成绩。 |
| evidence dashboard | `scoreFloor=72`，passing gates `37`，parseErrors `0` | 必须诚实展示 `72`；不能从 pass rate 手工抬到 90+。 |

#### 9.88.3 公开 benchmark / 产品对比必须补采的数据

GitHub 数据图和卖点图至少需要以下字段；没有字段就写入 Data Still Needed，不允许补口号。

| 数据 | 含义 | 当前状态 |
|---|---|---|
| fixed public/comparable manifest | 固定题集、输入、ground truth、评分规则 | 未完成；必须先建 manifest。 |
| raw transcript | 每题 DSXU 原始调用、工具调用、模型输出、失败恢复 | 未完成；必须保存 raw evidence。 |
| firstAttemptSuccessRate | 首次尝试直接通过率 | 未完成；internal smoke 不能代替。 |
| secondAttemptSuccessRate | 一次失败后第二轮恢复通过率 | 未完成；需要 per-case retry/recovery raw run。 |
| finalPassRate | 最终通过率 | 未完成；必须从 fixed manifest 计算。 |
| avgCostUsd / p95CostUsd | 平均成本和高分位成本 | 未完成；必须按 case 聚合。 |
| avgWallClockMs / p95WallClockMs | 平均耗时和高分位耗时 | 未完成；必须按 case 聚合。 |
| proAdmissionCount | Pro/高档模型升级次数 | 未完成；必须证明默认 Flash，不是全量 Pro。 |
| cacheHitRatePct | DeepSeek cache 命中趋势 | 未完成；只写真实趋势，不写固定保证。 |
| toolResultChars / artifactLogSizeBytes | 工具结果膨胀和证据产物体积 | 未完成；用于证明 source capsule / artifact 化是否有效。 |
| failureRecoveryRate | 失败分类、修复、重测成功率 | 未完成；必须有失败前后 evidence。 |

#### 9.88.4 最后剩余工作顺序

| 顺序 | 工作 | 验收出口 |
|---|---|---|
| 1 | Core Mainline Convergence Pack：Runtime State Card、Tool Result Contract、DeepSeek thinking/tool-call projection、Verified Edit visibility、Runtime Event Schema、Long Task Ledger、Stall Recovery Table、task evidence packet。 | 不新增主链；全部折叠进现有 owner；`bun test` 和 focused owner tests 继续全绿。 |
| 2 | release/export public surface policy：区分 public docs 与 internal evidence docs，避免 GitHub 包带出内部 V18/V19/V20/V24/V26 闭环文档。 | clean export 只包含源码、公开文档、必要配置和 release-safe assets；不带 `.env`、key、内部 evidence、品牌风险文档。 |
| 3 | README / GitHub evidence snapshot：把 9.88.2 的真实数字写成可复核表，把 9.88.3 写成 Data Still Needed。 | README 每个卖点都有 source/test/live/raw/cost/cache evidence 链接；没有证据的写 roadmap 或 Data Still Needed。 |
| 4 | public/comparable benchmark raw run：固定 manifest 后运行 30+ case，采集 first/second/final pass、cost、wall-clock、cache、Pro admission、failure recovery。 | 输出 JSON/CSV/Markdown 和数据图；仍需标明是否 official 或 comparable。 |
| 5 | 50+ packs / 200+ cases stress expansion：跨语言、安全修复、架构重构、长任务恢复、TUI resize/permission、工具膨胀、Agent envelope。 | 只把 source/test/live/raw/cost evidence 齐的能力写进 GitHub 卖点。 |
| 6 | final release gate：fresh install、first-run key/doctor、help、provider gate、secret scan、brand/compat scan、clean export、six-stage、senior spot rerun。 | 所有 gate PASS 后才允许 GitHub release claim；`scoreFloor` 仍按 evidence dashboard 真实值。 |

当前裁决：GitHub 卖点可以开始写，但只能写“已做过并有证据的能力”。真正能支撑开源发布吸引力的数据，还缺 fixed manifest 下的 first/second/final pass rate、成本、耗时、cache、Pro admission、失败恢复和 raw transcript。下一步优先级仍是 core mainline convergence 与 release public surface policy，而不是手工抬分或扩大口号。

### 9.89 V26 P0 core mainline convergence 执行记录 - 2026-05-18

本节记录“核心主链可信体验收束”的第一批 P0 执行结果。执行纪律：不新增主链、不新增 runtime、不新增 permission/provider/DAG/benchmark engine；全部折叠回现有 owner。

#### 9.89.1 本批已收束 owner

| owner | 本次收束 | 结论 |
|---|---|---|
| Work-state timeline / visible-state projection | 增加 Runtime State Card、task evidence packet、ToolCallResult -> work-state 投影；同一张卡片展示 state、risk、allowedNext、blockedActions、evidenceRequired、recoveryIfFails。 | 只是可见状态投影，不执行工具，不成为第二 runtime。 |
| Tool Result Contract / Tool Gate boundary | 增加 canonical ToolCallResult 边界识别、provider tool_result block 归一化、MCP result 归一化和 normalization evidence。 | provider/MCP/legacy 结果只在 Tool Gate 边界被收束，不允许各自形成独立运行时。 |
| Post-mutation verification envelope | Write/Edit 后验证信封新增 visibleByDefault、lifecycle、reviewRequired、finalClaimAllowed=false；skipped/partial gates 不能伪装成已完成。 | Verified Edit Lifecycle 进入默认可见证据，但 post-mutation envelope 不能单独放行最终 claim。 |
| Long Task Ledger / Stall Recovery | progress ledger 增加统一事件账本、stall signals、stall recovery decision；支持 retry/replan/rollback/ask-human/abort 的明确决策记录。 | 长任务不再只靠口头状态；停滞必须留下可恢复、可审计决策。 |
| DeepSeek thinking/tool-call projection | non-thinking route 不再携带 assistant reasoning_content；thinking mode 保留 reasoning_content + tool_calls + tool_result projection。 | 保护 DeepSeek Flash 默认路径的 cache/消息整洁度，thinking 只在显式路由启用。 |

#### 9.89.2 focused 验证结果

| 验证命令 | 结果 | 证明范围 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | `8 pass / 0 fail` | Runtime State Card、tool/permission/agent/MCP/skill evidence projection、task evidence packet。 |
| `bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` | `3 pass / 0 fail` | Write/Edit 后验证信封可见性、skipped gate 边界、final claim 阻断。 |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | `21 pass / 0 fail` | 长任务 ledger、event append、stall decision、resume summary。 |
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` | `13 pass / 0 fail` | Tool Result Contract 边界归一化、DeepSeek thinking/non-thinking tool-call message 投影。 |
| `bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts src/dsxu/engine/__tests__/query-loop-gear-box-recovery-v1.test.ts` | `9 pass / 0 fail` | 新 ledger/stall 记录没有破坏现有 Recovery/GearBox 联动。 |
| P0 owner combined focused set | `45 pass / 0 fail` | visible-state、tool protocol、post-mutation verification、long-task ledger、DeepSeek adapter 一起运行无冲突。 |
| `bun test` | `2766 pass / 1 skip / 0 fail` | 全仓主链回归仍全绿；本批 P0 owner 收束没有引入跨 owner 回归。 |

#### 9.89.3 当前裁决

P0 core mainline convergence 第一批已完成代码与 focused owner 验证。它把 V26 中反复出现的 `Runtime Event Schema`、`Tool Result Contract`、`Verified Edit visibility`、`Long Task Ledger`、`Stall Recovery Table`、`DeepSeek thinking/tool-call projection` 先收成同一条可信体验主线。

这不是最终发布 PASS。后续仍需：

1. 继续跑 full `bun test`、six-stage、senior-coding-window spot rerun，确认没有跨 owner 回归。
2. 处理 release/export public surface policy，区分 public docs 与 internal evidence docs。
3. 更新 README / GitHub evidence snapshot，只引用真实 source/test/live/raw/cost/cache evidence。
4. 补 fixed manifest 的 public/comparable benchmark raw run，采集 first/second/final pass、成本、耗时、cache、Pro admission、failure recovery、raw transcript。

### 9.90 V26 release/export public surface policy 执行记录 - 2026-05-18

本节继续执行 9.88.4 的第二项：release/export public surface policy。执行纪律：不新增发布引擎、不新增 package entrypoint、不删除/移动内部 evidence；只把发布边界折叠进已有 `open-source-package-gate` 与 clean export artifact owner。

#### 9.90.1 本批已收束 owner

| owner | 本次收束 | 结论 |
|---|---|---|
| `open-source-package-gate.ts` | clean export manifest 增加稳定分类：`public-release-document`、`canonical-planning-source`、`internal-generated-evidence`；新增 `shouldShipCleanExportManifestEntry()`，只有 `present && releasePolicy=ship` 才进入 clean export。 | `docs/DSXU_*` 与 `docs/generated/*` 默认作为 source-side internal evidence，必须 rewrite/exclude；`docs/BENCHMARK.md`、`docs/INSTALL.md`、`docs/release/README.md`、`docs/product/README.md`、`docs/assets/*` 等 curated public docs/assets 才默认 ship。 |
| `dsxu-v24-clean-export-artifact.ts` | clean export artifact 不再只靠路径黑名单复制 `git ls-files`；先构建 open-source package gate manifest，再只复制 `ship` 项，并输出 `releaseSurfacePolicy` 统计。 | 内部审计/闭环/owner review/generated evidence 即使 tracked，也不会默认进入 GitHub 发布包。 |
| release-surface tests | 增加 internal evidence docs 排除测试；验证 source policy review 仍要求 rewrite/exclude 显式签收。 | 策略是 release owner 的硬边界，不是 README 文案。 |

#### 9.90.2 focused 验证结果

| 验证命令 | 结果 | 证明范围 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/open-source-package-gate.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts` | `16 pass / 0 fail` | public docs 与 internal evidence docs 分层、release-surface aggregate、source policy review manifest 边界。 |
| `bun build scripts/dsxu-v24-clean-export-artifact.ts --target=bun --outdir %TEMP%/dsxu-clean-export-build-check` | PASS | clean export artifact 脚本编译通过；本次没有运行脚本创建发布包。 |
| `bun test` | `2767 pass / 1 skip / 0 fail` | 本次 release/export public surface policy 未引入跨 owner 回归。 |
| `bun run test:six-stage-final` | `20/20 PASS` | 六阶段最终验收链仍可跑通；本命令耗时较长，后续不再每个小块重复运行。 |

#### 9.90.3 当前裁决

release/export public surface policy 已接入代码和 focused tests。它解决 9.87 senior window 反复指出的真实风险：clean export 不能把内部 V18/V19/V20/V24/V26 闭环文档、generated evidence、owner review、benchmark raw evidence 默认带进 GitHub 发布包。

这仍不是最终 clean export PASS。本批没有创建 zip，没有运行 fresh install smoke。后续仍需：

1. 跑完整 release chain：`test:six-stage-final`、clean export artifact、fresh install/help/doctor/provider gate smoke。
2. 检查 README / GitHub evidence snapshot 只引用 public-safe docs 和可复核 evidence 摘要。
3. 跑 secret scan、brand/compat scan，确认发布包不带 DeepSeek key、内部绝对路径、品牌风险或 unsupported public claim。
4. 在 fixed manifest 下补 public/comparable benchmark raw run，生成 first/second/final pass、cost、wall-clock、cache、Pro admission、failure recovery 数据图。

#### 9.90.4 后续测试纪律

后续执行不再每个小修都跑 full `bun test` 或六阶段最终测试。默认节奏改为：

1. 单个 owner 内部修改：只跑该 owner 的 focused tests、编译检查或脚本 dry-run。
2. 一个 P0 批次完成后：跑相邻 owner 回归，确认没有破坏主链边界。
3. 完成一大块功能、改 release/export/permission/provider/query-loop 主链、或准备更新公开 claim 时：再跑 full `bun test`。
4. 只有进入 release gate、README/GitHub evidence、clean export、fresh install 或真实窗口验收时，才跑 `test:six-stage-final`、senior window、fresh install 等慢测试。

原则：测试要证明功能，不替代功能；减少重复全量测试，把时间优先放在功能收口和 owner 融合上。

### 9.91 V26 README / GitHub evidence snapshot 收口 - 2026-05-18

本节执行 9.88.4 的第三项：README / GitHub evidence snapshot。执行纪律：只更新公开文档口径，不把内部 evidence 文档搬成卖点，不新增发布入口，不跑重复全量测试。

#### 9.91.1 本批已更新文件

| 文件 | 更新内容 | 结论 |
|---|---|---|
| `README.md` | Evidence Snapshot 更新为当前真实口径：`bun test 2767 pass / 1 skip / 0 fail`、senior window `30.44min / 41 product-entry calls / 40 review rounds / Flash-only / about $0.4645`、six-stage `20/20 PASS`、release/export public surface policy PASS；clean export/fresh install 降级为“旧 artifact 曾 PASS，但必须在新 public surface policy 后重跑”。 | README 不再把旧 clean export 当最终 GitHub 发布包。 |
| `docs/product/README.md` | Current Public Status 同步 senior window 和 release/export public surface policy；clean export/fresh install 标记为 post-policy rerun pending。 | 产品页只写 release-candidate，不写 final 95 或最终 release package。 |
| `docs/release/README.md` | Required Gates 增加 release/export public surface policy；Current Decision 说明 clean export/fresh install 必须 post-policy rerun；Hard Rules 增加禁止发布包携带 internal audit/generated evidence/local absolute-path material。 | release gate 口径与代码策略一致。 |
| `docs/BENCHMARK.md` | 更新日期；加入 release/export public surface policy 作为非 benchmark score 的发布边界证据；声明 post-policy clean export/fresh install 需重跑。 | benchmark 页不把 release policy 当榜单分数。 |

#### 9.91.2 轻量检查结果

| 检查 | 结果 |
|---|---|
| README / product / release / benchmark claim grep | 找到的 `90/95` 均为 blocked claim 口径。 |
| stale evidence grep | 未再发现 `Clean export \| 3039`、`Senior coding window \| 30.58`、`Senior coding window \| 30.48`、旧 `7/7` / `8/8` fresh install smoke 作为当前最终口径。 |

#### 9.91.3 当前裁决

GitHub-facing 文档已从“旧 artifact 已 PASS”改为“release-candidate evidence + post-policy export rerun pending”。这比继续堆卖点更安全：当前能公开写的是 DSXU-owned workflow、Flash-first、tool/permission/recovery/cost/evidence/release policy；不能公开写最终 90/95、外部胜出、正式 SWE-bench、或最终 GitHub release package。

后续剩余硬项：

1. 创建 fixed public/comparable benchmark manifest，明确 task、input、ground truth、rubric、raw transcript、cost/cache/failure 字段。
2. 基于 manifest 跑 raw run，生成 first/second/final pass、cost、wall-clock、cache、Pro admission、failure recovery 数据。
3. 用 post-policy clean export 脚本创建新 artifact，再跑 fresh install/help/doctor/provider gate smoke。
4. 最后再跑 release gate 慢测试链，不在中间小修中重复跑全量。

### 9.92 V26 public/comparable benchmark manifest 收口 - 2026-05-18

本节执行 9.91.3 的第一项：fixed public/comparable benchmark manifest。执行纪律：不新增 benchmark runtime、不新增 package entrypoint、不调用模型、不产生跑分 claim；只把公开可复核测试的题集、证据字段和声明边界折叠进现有 benchmark/evidence owner。

#### 9.92.1 本批已生成产物

| 产物 | 用途 | 结论 |
|---|---|---|
| `scripts/dsxu-public-comparable-benchmark-manifest.ts` | 从现有 `scripts/benchmark/dsxu-mainline-benchmark.ts` owner 读取 task/case 与 route expectation，生成固定 30-case manifest。 | 只是 collection contract，不是新评测引擎。 |
| `docs/generated/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json` | 机器可读 manifest，包含 30 个 case、required raw evidence 字段、route/cost/cache/failure 字段、claim boundary。 | 可作为后续 raw run 输入；不能写成 public score。 |
| `docs/generated/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.csv` | 可筛选表格，用于 reviewer/owner 逐题确认。 | 方便人工审查，不替代 raw evidence。 |
| `docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md` | 人读版 manifest，说明 run policy、counts、required raw evidence fields 与 case list。 | 可在公开文档中引用为“已固定题集”，不能引用为“已跑分”。 |

#### 9.92.2 manifest 覆盖口径

| 指标 | 当前值 | 边界 |
|---|---:|---|
| total cases | 30 | 固定题集已存在；raw transcript/tool trace/artifact/report/cost/cache 仍未采集。 |
| feature | 6 | 覆盖普通 feature/code-mode 主线。 |
| bugfix | 4 | 覆盖真实修复、工具读取、MCP/resource-guided fix 等路径。 |
| review | 5 | 覆盖 review -> fix、权限/孤儿 tool use 等路径。 |
| recovery | 6 | 覆盖 compact、失败恢复、二次失败等路径。 |
| permission | 5 | 覆盖拒绝、replan、PowerShell deny、permission matrix。 |
| agent | 4 | 覆盖 agent/longrun/failure-correction 等路径。 |
| expected DeepSeek Flash | 27 | 保持 Flash-first；不是全量 Pro。 |
| expected DeepSeek Pro | 3 | 仅高风险 review/permission admission 路径；后续 raw run 必须记录 admission reason。 |

#### 9.92.3 必采 raw evidence 字段

后续每个 case 必须采集：`rawTranscriptPath`、`toolTracePath`、`rawApiResponsePath`、`finalReportPath`、`artifactDir`、`firstAttemptPass`、`secondAttemptPass`、`finalPass`、`costUsd`、`wallClockMs`、`cacheHitRatePct`、`proAdmissionCount`、`failureRecoveryEvents`、`toolResultChars`、`artifactLogSizeBytes`。如要写外部对比，还必须额外提供同题 `targetReferenceTranscriptPath`、target tool trace、target final report、target artifacts、metrics 与 risk notes。

#### 9.92.4 测试纪律更新

本批没有跑 full `bun test`、six-stage 或 senior window，因为它只生成 manifest/文档，没有改 runtime、permission、provider、query-loop 或 release artifact。后续默认节奏继续执行 9.90.4：单 owner 改动只跑 focused 验证；完成一整块功能或进入 release/README/public claim 前，才跑 full `bun test`；真实窗口、six-stage、fresh install 只在 release gate 或 live evidence 阶段运行。

#### 9.92.5 轻量验证结果

| 验证 | 结果 | 说明 |
|---|---|---|
| manifest JSON parse/count check | PASS：`caseCount=30`，required fields `16`，category counts 为 permission 5 / feature 6 / recovery 6 / agent 4 / bugfix 4 / review 5。 | 验证固定题集和必采字段，不是跑分。 |
| `bun build scripts/dsxu-public-comparable-benchmark-manifest.ts --target=bun` | PASS | 只验证 manifest 生成脚本可编译，不调用模型、不跑 benchmark。 |

#### 9.92.6 当前裁决

public/comparable benchmark 的第一步已经从“空泛计划”变成固定 30-case manifest。下一步不是继续写口号，而是按这个 manifest 做真实 raw run，逐题生成 DSXU transcript、raw API baseline、tool trace、artifact、final report、first/second/final pass、cost、wall-clock、cache、Pro admission 与 failure recovery 数据。只有这批 raw evidence 完成后，GitHub 才能画首次成功率、二次恢复率、最终通过率、成本和耗时图。

### 9.93 V26 public/comparable raw evidence readiness 与 dashboard truth 收口 - 2026-05-18

本节继续 9.92，不直接跑 live benchmark，而是先把“manifest-ready 不等于 benchmark PASS”的口径接入现有 Evidence Workbench / raw evidence readiness owner。执行纪律：不新增 benchmark runtime、不新增 package entrypoint、不调用 DeepSeek、不跑 full `bun test`；只做证据口径和 focused 验证。

#### 9.93.1 本批已收束 owner

| owner | 本次收束 | 结论 |
|---|---|---|
| `raw-evidence-readiness-register-v1.ts` | 增加 `buildPublicComparableRawEvidenceReadiness()`，对 30-case manifest 与后续 raw evidence manifest 做逐题字段裁决。 | manifest 只能进入 `collect-public-comparable-raw-evidence`，不能变成 public benchmark PASS。 |
| `dsxu-evidence-dashboard.ts` | 遇到 `dsxu.public-comparable-benchmark-manifest.v1` 时，gate 状态强制 `NOT_RUN`，并写入 `publicComparableReadiness`。 | dashboard 不再把 `PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY` 当作普通 PASS gate。 |
| focused tests | 增加 dashboard 防误报测试；raw readiness 增加 public comparable 三种裁决：manifest-only、字段不完整、DSXU/raw API 完整但 target-reference 未补。 | 证明 public comparable、external comparison、internal smoke 三个层级不会混在一起。 |

#### 9.93.2 当前 dashboard truth

| 指标 | 当前值 | 含义 |
|---|---:|---|
| `scoreFloor` | 72 | dashboard 继续诚实显示旧 public challenge floor；没有因为 manifest 或 smoke 手工抬分。 |
| evidence files | 125 | dashboard 识别当前 generated evidence 文件。 |
| passing gates | 38 | manifest-ready 没有计入 PASS；这是修正后的真实口径。 |
| parse errors | 0 | 证据 JSON 可解析。 |
| public comparable case count | 30 | 固定题集存在。 |
| public comparable ready cases | 0 | 尚未采集逐题 raw evidence。 |
| public comparable missing cases | 30 | 每题仍缺 DSXU transcript、raw API baseline、tool trace、artifact、final report、成本、cache、Pro admission、failure recovery 等字段。 |
| `publicBenchmarkClaimAllowed` | false | 不能写公开 benchmark 成绩。 |
| `externalComparisonClaimAllowed` | false | 不能写同题外部对比胜出。 |

#### 9.93.3 focused 验证结果

| 验证 | 结果 | 说明 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts` | `10 pass / 0 fail` | 只验证 raw evidence readiness 和 dashboard truth，不跑全量。 |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS：`scoreFloor=72`、`Evidence files=125`、`Passing gates=38`、`Parse errors=0`。 | 实际 generated dashboard 已刷新。 |

#### 9.93.4 当前裁决

现在 GitHub 数据链的状态更干净：固定题集已存在，但 dashboard 会明确显示它仍是 `NOT_RUN/raw evidence pending`。下一步真正产生卖点图的数据，必须执行 30-case raw evidence collection：每题至少包含 DSXU raw transcript、raw DeepSeek API baseline、tool trace、artifact、final report、first/second/final pass、cost、wall-clock、cache、Pro admission、failure recovery。外部同题对比还要额外导入 target/reference raw evidence；否则只能写 DSXU vs raw API baseline 或 internal comparable，不得写外部胜出。
