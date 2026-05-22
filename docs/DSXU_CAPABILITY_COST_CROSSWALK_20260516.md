# DSXU Capability Cost Crosswalk - 20260516

Source workbook: `C:\Users\h\Downloads\DSXU_CLI_V8*_V9.xlsx`

## Summary

| totalRows | passRows | deferredRows | publicClaimAllowedRows | publicChallengeScoreFloor | publicChallengeCacheHitRatePct | publicChallengeToolResultChars |
| --- | --- | --- | --- | --- | --- | --- |
| 82 | 70 | 12 | 47 | 72 | 65.4 | 0 |

## Layer Counts

| layer | count |
| --- | --- |
| baseline-workflow | 23 |
| direct-cost | 12 |
| indirect-cost | 21 |
| eval-proof | 14 |
| deferred-gap | 12 |

## Public Claim Rule

Historical capability/cost claims are usable only when tied to DSXU owner evidence plus latest public challenge route/cost/cache/trajectory evidence; deferred rows remain blocked.

## Crosswalk

| id | domain | capability | status | layer | owner | evidenceExists | publicClaim | contribution |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S00 | product-scope | DSXU CLI = DeepSeek V4 Code/Terminal orchestration enhancer | PASS | baseline-workflow | Query loop / work-state / runtime owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| S01 | product-mode | Cold Mode | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| M01 | model-adapter | DeepSeek V4 Flash/Pro Adapter | PASS | direct-cost | DeepSeek runtime / model-cost-cache owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| M02 | model-adapter | Thinking Mode / Effort control | PASS | direct-cost | DeepSeek runtime / model-cost-cache owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| M03 | model-adapter | ReasoningStateManager | PASS | direct-cost | DeepSeek runtime / model-cost-cache owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| M04 | model-adapter | Tool Calls support | PASS | baseline-workflow | DeepSeek runtime / model-cost-cache owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| M05 | model-adapter | JSON Output mode | PASS | baseline-workflow | DeepSeek runtime / model-cost-cache owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| M06 | model-adapter | Context Cache hit planning | PASS | direct-cost | DeepSeek runtime / model-cost-cache owner | true | true | Keeps stable prefix/cache planning visible; the current mainline now wires no-Read source capsule and cache attribution into public challenge. |
| C01 | core-runtime | CLI Main Chain | PASS | baseline-workflow | Query loop / work-state / runtime owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| C03 | core-runtime | Task Timeline Renderer | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C04 | core-runtime | PermissionGate | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C05 | core-runtime | IntentRouter | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C07 | core-runtime | ContextCompiler | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Compiles source truth into compact capsules so DeepSeek Flash does not repeatedly ingest full files. |
| C08 | core-runtime | TokenFirewall | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Limits large tool-result feedback and forces raw-read fallback to be bounded and attributable. |
| C09 | core-runtime | CostRouter | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Keeps Flash as default and admits Pro only with explicit route evidence. |
| C10 | core-runtime | PlanGraph | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C11 | core-runtime | ToolBus | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C12 | core-runtime | VerificationKernel | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C13 | core-runtime | Snapshot/Rollback | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C14 | core-runtime | FailureTaxonomy | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C15 | core-runtime | TraceLogger | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C16 | core-runtime | CostReporter | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Turns usage/cache/cost into reportable product metrics instead of hidden logs. |
| A01 | code-mode | RepoProbe | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A02 | code-mode | RepoIndex | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A03 | code-mode | LSP/AST Locator | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A04 | code-mode | Error Parser | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A05 | code-mode | Bug Locator Ensemble | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A06 | code-mode | CodeContextPack | PASS | indirect-cost | Code-mode repair / patch / verification owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| A07 | code-mode | Patch Planner | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A08 | code-mode | Unified Diff Generator | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A09 | code-mode | Patch Applier | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A10 | code-mode | Test Runner | PASS | indirect-cost | Code-mode repair / patch / verification owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| A11 | code-mode | Code RepairLoop | PASS | indirect-cost | Code-mode repair / patch / verification owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| A15 | code-mode | FinalPatchReport | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A16 | code-mode | Internal Code-10/30 Runner | PASS | eval-proof | Code-mode repair / patch / verification owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| B01 | terminal-mode | ShellStateManager | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B02 | terminal-mode | EnvironmentProbe | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B03 | terminal-mode | CommandPlanner | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B04 | terminal-mode | SafeShellExecutor | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B05 | terminal-mode | OutputSummarizer | PASS | indirect-cost | Tool/terminal lifecycle owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| B06 | terminal-mode | FileSystemState | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B07 | terminal-mode | CommandVerifier | PASS | indirect-cost | Tool/terminal lifecycle owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| B08 | terminal-mode | ScriptSynthesizer | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B09 | terminal-mode | Terminal FailureRepairLoop | PASS | indirect-cost | Tool/terminal lifecycle owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| B10 | terminal-mode | TimeoutGuard | PASS | indirect-cost | Tool/terminal lifecycle owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| B11 | terminal-mode | ArtifactChecker | PASS | baseline-workflow | Tool/terminal lifecycle owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| B12 | terminal-mode | TerminalBench Subset Adapter | PASS | eval-proof | Tool/terminal lifecycle owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| B13 | terminal-mode | Internal Terminal-10/30 Runner | PASS | eval-proof | Tool/terminal lifecycle owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| B14 | terminal-mode | TerminalResultPackager | PASS | indirect-cost | Tool/terminal lifecycle owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| E01 | evaluation-reporting | Baseline Runner | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E02 | evaluation-reporting | Ablation Runner | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E03 | evaluation-reporting | Cost Eval Reporter | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E04 | evaluation-reporting | Failure Reporter | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E05 | evaluation-reporting | Trace Collector | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E06 | evaluation-reporting | Go/Stop Decision | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| R01 | benchmark-map | Terminal-Bench 2.0 | DEFERRED_NOT_PASS | deferred-gap | Evidence / benchmark / public challenge owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| R02 | benchmark-map | Internal Code-30 | DEFERRED_NOT_PASS | deferred-gap | Evidence / benchmark / public challenge owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| S02 | product-mode | BenchMax Mode | DEFERRED_NOT_PASS | deferred-gap | Query loop / work-state / runtime owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| M07 | model-adapter | FIM local completion | PASS | direct-cost | DeepSeek runtime / model-cost-cache owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| C02 | core-runtime | Interactive Session | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C06 | core-runtime | SkillRouter core edition | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| C17 | core-runtime | LocalMemory Lite | PASS | direct-cost | Query loop / work-state / runtime owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| C18 | core-runtime | Anti-Rationalization Guard | PASS | indirect-cost | Query loop / work-state / runtime owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| A12 | code-mode | RegressionGuard Lite | PASS | indirect-cost | Code-mode repair / patch / verification owner | true | true | Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context. |
| A13 | code-mode | Patch Candidate Search | PASS | baseline-workflow | Code-mode repair / patch / verification owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| A14 | code-mode | Pro Reviewer | PASS | direct-cost | Code-mode repair / patch / verification owner | true | true | Directly reduces spend or controls expensive model/tool behavior in the main workflow. |
| A17 | code-mode | SWE Smoke Runner | PASS | eval-proof | Code-mode repair / patch / verification owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| E07 | evaluation-reporting | Mini Report Generator | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| R03 | benchmark-map | SWE Pro | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| R04 | benchmark-map | SWE Verified | DEFERRED_NOT_PASS | deferred-gap | Evidence / benchmark / public challenge owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| R05 | benchmark-map | BFCL V4 | DEFERRED_NOT_PASS | deferred-gap | Evidence / benchmark / public challenge owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| R06 | benchmark-map | BrowseComp-Lite | DEFERRED_NOT_PASS | deferred-gap | Evidence / benchmark / public challenge owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| R07 | benchmark-map | OSWorld-Lite | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| R08 | benchmark-map | Toolathlon | PASS | eval-proof | Evidence / benchmark / public challenge owner | true | true | Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports. |
| PZ01 | paused-module | OpenClaw Adapter | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| PZ02 | paused-module | Hermes Adapter | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| PZ03 | paused-module | BrowserExecutor | PASS | baseline-workflow | Deferred ecosystem boundary owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| PZ04 | paused-module | DesktopExecutor | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| PZ05 | paused-module | Application templates | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| PZ06 | paused-module | VS Code plugin/API platform | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
| PZ07 | paused-module | Multi-Agent Swarm/Coordinator | PASS | baseline-workflow | Deferred ecosystem boundary owner | true | false | Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim. |
| PZ08 | paused-module | Voice/Buddy/Team/Bridge | DEFERRED_NOT_PASS | deferred-gap | Deferred ecosystem boundary owner | true | false | Not counted as PASS; remains a raw-evidence or product-surface gap. |
