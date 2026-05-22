# DSXU Public Comparable Benchmark Manifest - 2026-05-18

Status: PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY

This is a fixed comparable manifest, not a benchmark result. It defines the task set, raw evidence fields, scoring rubric, and claim boundaries required before GitHub can show public comparison charts.

## Run Policy

- Default model: deepseek-v4-flash
- Pro admission: Pro is allowed only when route/admission evidence says Flash cannot safely finish the current case.
- Public claim: This manifest enables comparable evidence collection. It is not a public leaderboard result.
- Target/reference: External superiority claims require same-task target/reference raw transcript, tool trace, final report, artifacts, metrics, and risk notes.

## Counts

| metric |value |
| --- |--- |
| cases |30 |
| category:permission |5 |
| category:feature |6 |
| category:recovery |6 |
| category:agent |4 |
| category:bugfix |4 |
| category:review |5 |
| model:deepseek-v4-pro |3 |
| model:deepseek-v4-flash |27 |

## Required Raw Evidence Fields

| field |requiredFor |reason |
| --- |--- |--- |
| rawTranscriptPath |all |auditable model/tool conversation, including failures |
| toolTracePath |dsxu-run |DSXU tool and permission evidence |
| rawApiResponsePath |raw-api-baseline |same-task raw DeepSeek API baseline response |
| targetReferenceTranscriptPath |external-target-reference |paired external target/reference comparison only |
| finalReportPath |all |final claim must point to a task report |
| artifactDir |all |patches, stdout/stderr, screenshots, and generated outputs |
| firstAttemptPass |all |GitHub data chart: first-attempt success rate |
| secondAttemptPass |all |GitHub data chart: recovery after one failure |
| finalPass |all |final task pass rate |
| costUsd |all |DeepSeek cost transparency |
| wallClockMs |all |operator time cost |
| cacheHitRatePct |all |DeepSeek cache behavior, trend only |
| proAdmissionCount |all |Flash-first policy proof |
| failureRecoveryEvents |all |failure-to-fix evidence, not hidden failure |
| unavailableToolUseCount |dsxu-run |forbidden or unavailable tool discipline evidence |
| executionVisibilityBlockedCount |dsxu-run |visible-intent/tool-batch gate evidence |
| noToolUnsupportedClaimCount |dsxu-run |zero-tool lane hallucinated workspace/source claim guard |
| toolBudgetExceededCount |dsxu-run |tool-window budget discipline evidence |
| readBudgetExceededCount |dsxu-run |read-budget discipline evidence |
| shellBudgetExceededCount |dsxu-run |shell-budget discipline evidence |
| toolResultChars |dsxu-run |tool-result bloat control |
| artifactLogSizeBytes |all |release artifact/log size visibility |

## Cases

| id |category |expectedModel |workflowKind |routeReason |allowedTools |promptHash |
| --- |--- |--- |--- |--- |--- |--- |
| permission-deny-replan |permission |deepseek-v4-pro |review |high_risk_pro_thinking_max_requires_approval |default-mainline-tool-gate |8de2d7546addb60f |
| powershell-encoded-deny |permission |deepseek-v4-flash |generic_chat |lightweight_flash_non_thinking |Grep |49adf240038a1b5f |
| grep-glob-tool-choice |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |dc8da8fea289ae65 |
| governance-query-recovery-live |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |3cd0489653c6a42d |
| governance-skills-selection-live |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |c40de0a293c8d6c6 |
| todo-task-closeout |agent |deepseek-v4-flash |planning |recovery_flash_thinking_max |TaskCreate |5b0dedee6abdf8e9 |
| permission-matrix-contract |permission |deepseek-v4-flash |generic_chat |lightweight_flash_non_thinking |Grep |5f2ae9e250c36e9e |
| compact-state-preservation |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |02cb1e8ffc2f8740 |
| product-workflow-recovery-live |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |815958ee00a42f83 |
| product-multifile-bugfix-live |bugfix |deepseek-v4-flash |bugfix |coding_flash_thinking_high |default-mainline-tool-gate |40924aad3b1646a7 |
| product-multistep-feature-live |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |5eb03ff64d49e495 |
| product-feature-tests-live |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |9043841ba1afea3f |
| product-review-fix-live |review |deepseek-v4-flash |review |review_flash_thinking_max |default-mainline-tool-gate |c5823f94398cdd22 |
| product-compact-resume-edit-live |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |39296589369f4eda |
| product-compact-two-phase-live |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |2a796fe6cc14ba60 |
| product-permission-deny-replan-live |permission |deepseek-v4-pro |review |high_risk_pro_thinking_max_requires_approval |default-mainline-tool-gate |6fd940a2a99f2de1 |
| product-agent-worker-longrun-live |agent |deepseek-v4-flash |planning |recovery_flash_thinking_max |Agent,SendMessage,Read,RunNativeTest,CollectEvidence,TaskCreate,TaskUpdate |d6687fdbb49dd7c7 |
| product-agent-failure-correction-live |agent |deepseek-v4-flash |planning |recovery_flash_thinking_max |Agent,SendMessage,Read,RunNativeTest,CollectEvidence,TaskCreate,TaskUpdate |d8593f7ac9c826fc |
| product-real-mcp-task-live |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |0fe29d6fa3ae3074 |
| product-reality-large-feature-live |feature |deepseek-v4-flash |feature |coding_flash_thinking_high |default-mainline-tool-gate |de78e35c66cb55bd |
| product-reality-review-fix-live |review |deepseek-v4-flash |review |review_flash_thinking_max |default-mainline-tool-gate |b4455b92cd62b66b |
| product-reality-second-failure-live |recovery |deepseek-v4-flash |recovery |recovery_flash_thinking_max |default-mainline-tool-gate |d8617579100df2e2 |
| product-review-to-fix-live |review |deepseek-v4-flash |review |review_flash_thinking_max |default-mainline-tool-gate |24850c59738d76ce |
| v8-real-review-fix |review |deepseek-v4-flash |review |review_flash_thinking_max |default-mainline-tool-gate |97391f14691af5a4 |
| mutation-query-orphan-tool-use-deny-pass-live |review |deepseek-v4-flash |review |review_flash_thinking_max |default-mainline-tool-gate |705f97e5bd34109a |
| tool-prompt-read-edit-cache-golden |bugfix |deepseek-v4-flash |bugfix |coding_flash_thinking_high |default-mainline-tool-gate |cf628831d82fa51d |
| mutation-tool-prompt-read-edit-cache-live |bugfix |deepseek-v4-flash |bugfix |coding_flash_thinking_high |default-mainline-tool-gate |96dba26cba786d5e |
| mutation-real-mcp-resource-guided-fix-live |bugfix |deepseek-v4-flash |bugfix |coding_flash_thinking_high |default-mainline-tool-gate |0c80b9e8191a179b |
| experience-permission-ux-live |permission |deepseek-v4-pro |review |high_risk_pro_thinking_max_requires_approval |default-mainline-tool-gate |1866d597a935d355 |
| experience-agent-team-governance-live |agent |deepseek-v4-flash |planning |recovery_flash_thinking_max |TaskCreate,SendMessage,TaskUpdate |bf14d9d34753f132 |

## Data Still Needed

- DSXU raw run transcript for each case
- raw DeepSeek API baseline transcript for each case
- optional external target/reference raw manifest for external comparison claims
- per-case firstAttemptPass, secondAttemptPass, finalPass, costUsd, wallClockMs, cacheHitRatePct, proAdmissionCount, failureRecoveryEvents, tool discipline counts, budget overrun counts, toolResultChars, artifactLogSizeBytes
- aggregate charts for first/second/final pass, cost, wall-clock, cache, Pro admissions, and recovery rate
