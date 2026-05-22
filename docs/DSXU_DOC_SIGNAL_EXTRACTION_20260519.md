# DSXU V7 Doc Signal Extraction - 20260519

- status: `PASS_DSXU_DOC_SIGNAL_EXTRACTION`

This registry converts historical/current docs into structured signals. It never places historical raw documents into the default prompt and never promotes extracted signals into public claims by itself.

## Summary

| metric | value |
|---|---:|
| docCount | 401 |
| signalCount | 3136 |
| p0DocCount | 328 |
| p0DocsWithSignals | 328 |
| promptAllowedSignals | 7 |
| claimAllowedSignals | 0 |
| archiveAfterExtractionSignals | 2589 |

## By Category

- release-claim-boundary: 645
- agent-skill-mcp: 511
- deepseek-routing-cost-cache: 380
- scenario-replay: 346
- context-memory-ledger: 264
- verification-recovery: 257
- tui-trust-surface: 237
- benchmark-hit-rate: 198
- prompt-discipline: 157
- tool-protocol: 141

## Blockers

- none

## First 40 Signals

| sourceDoc | category | targetOwner | promptAllowed | claimAllowed |
|---|---|---|---:|---:|
| `docs/BENCHMARK.md` | prompt-discipline | Prompt Section Router / Prompt Input Allowlist | true | false |
| `docs/BENCHMARK.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/BENCHMARK.md` | verification-recovery | VerificationKernel / Recovery Decision | false | false |
| `docs/BENCHMARK.md` | context-memory-ledger | PlanGraph / Work-State Ledger | false | false |
| `docs/BENCHMARK.md` | deepseek-routing-cost-cache | DeepSeek Route / Cost / Cache Owner | false | false |
| `docs/BENCHMARK.md` | benchmark-hit-rate | Evidence / Benchmark Owner | false | false |
| `docs/BENCHMARK.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/BENCHMARK.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/BENCHMARK.md` | tui-trust-surface | TUI Trust Surface | false | false |
| `docs/BENCHMARK.md` | scenario-replay | Scenario Replay Bank | false | false |
| `docs/CONFIGURATION.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/CONFIGURATION.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/CONFIGURATION.md` | verification-recovery | VerificationKernel / Recovery Decision | false | false |
| `docs/CONFIGURATION.md` | context-memory-ledger | PlanGraph / Work-State Ledger | false | false |
| `docs/CONFIGURATION.md` | deepseek-routing-cost-cache | DeepSeek Route / Cost / Cache Owner | false | false |
| `docs/CONFIGURATION.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/CONFIGURATION.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/CONFIGURATION.md` | tui-trust-surface | TUI Trust Surface | false | false |
| `docs/CONTRIBUTING.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/CONTRIBUTING.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/CONTRIBUTING.md` | tool-protocol | Tool Gate / Tool View | false | false |
| `docs/CONTRIBUTING.md` | deepseek-routing-cost-cache | DeepSeek Route / Cost / Cache Owner | false | false |
| `docs/CONTRIBUTING.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/CONTRIBUTING.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/CONTRIBUTING.md` | scenario-replay | Scenario Replay Bank | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | prompt-discipline | Prompt Section Router / Prompt Input Allowlist | true | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | tool-protocol | Tool Gate / Tool View | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | verification-recovery | VerificationKernel / Recovery Decision | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | context-memory-ledger | PlanGraph / Work-State Ledger | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | deepseek-routing-cost-cache | DeepSeek Route / Cost / Cache Owner | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | benchmark-hit-rate | Evidence / Benchmark Owner | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | release-claim-boundary | Release Claim Binder | false | false |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | scenario-replay | Scenario Replay Bank | false | false |
| `docs/DOCTOR_HEALTH.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/DOCTOR_HEALTH.md` | agent-skill-mcp | Agent Evidence / MCP Skill Registry | false | false |
| `docs/DOCTOR_HEALTH.md` | tool-protocol | Tool Gate / Tool View | false | false |
| `docs/DOCTOR_HEALTH.md` | deepseek-routing-cost-cache | DeepSeek Route / Cost / Cache Owner | false | false |
