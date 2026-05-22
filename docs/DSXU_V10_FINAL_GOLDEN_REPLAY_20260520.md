# DSXU V10 Final Golden Replay

Status: PASS_V10_FINAL_GOLDEN_REPLAY

Cases: 77

| bucket | total | pass | fail |
|---|---:|---:|---:|
| chinese-intent | 12 | 12 | 0 |
| no-edit | 6 | 6 | 0 |
| single-file-edit | 8 | 8 | 0 |
| debug-repair | 8 | 8 | 0 |
| multi-file-refactor | 8 | 8 | 0 |
| long-task | 8 | 8 | 0 |
| agent-evidence | 6 | 6 | 0 |
| benchmark-evidence | 6 | 6 | 0 |
| permission-security-release | 6 | 6 | 0 |
| ecosystem-boundary | 4 | 4 | 0 |
| feature-deletion | 5 | 5 | 0 |

| id | bucket | status | taskType | workflow | route | tools | blockers |
|---|---|---|---|---|---|---:|---|
| cn-long-task | chinese-intent | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| cn-benchmark | chinese-intent | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| cn-review | chinese-intent | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| cn-refactor | chinese-intent | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| cn-debug | chinese-intent | PASS | debug | recovery | failed_verification_flash_thinking_max | 16 | none |
| cn-search | chinese-intent | PASS | search | observe | lightweight_flash_non_thinking | 8 | none |
| cn-explain | chinese-intent | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| cn-edit | chinese-intent | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| cn-release-security | chinese-intent | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| cn-cost-route | chinese-intent | PASS | review | review | review_flash_thinking_max | 12 | none |
| cn-tool-permission | chinese-intent | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| cn-no-edit-analysis | chinese-intent | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-1 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-2 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-3 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-4 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-5 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| no-edit-6 | no-edit | PASS | explain | observe | lightweight_flash_non_thinking | 4 | none |
| single-file-edit-1 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-2 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-3 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-4 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-5 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-6 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-7 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| single-file-edit-8 | single-file-edit | PASS | single_file_edit | plan_execute_verify | coding_flash_thinking_high | 12 | none |
| debug-repair-1 | debug-repair | PASS | debug | recovery | failed_verification_flash_thinking_max | 16 | none |
| debug-repair-2 | debug-repair | PASS | debug | recovery | high_risk_pro_thinking_max_requires_approval | 24 | none |
| debug-repair-3 | debug-repair | PASS | debug | recovery | recovery_flash_thinking_max | 16 | none |
| debug-repair-4 | debug-repair | PASS | debug | recovery | failed_verification_flash_thinking_max | 16 | none |
| debug-repair-5 | debug-repair | PASS | debug | recovery | high_risk_pro_thinking_max_requires_approval | 24 | none |
| debug-repair-6 | debug-repair | PASS | debug | recovery | recovery_flash_thinking_max | 16 | none |
| debug-repair-7 | debug-repair | PASS | debug | recovery | failed_verification_flash_thinking_max | 16 | none |
| debug-repair-8 | debug-repair | PASS | debug | recovery | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-1 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-2 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-3 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-4 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-5 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-6 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-7 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| multi-file-refactor-8 | multi-file-refactor | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| long-task-1 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-2 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-3 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-4 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-5 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-6 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-7 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| long-task-8 | long-task | PASS | long_task | long_task | recovery_flash_thinking_max | 24 | none |
| agent-evidence-1 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| agent-evidence-2 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| agent-evidence-3 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| agent-evidence-4 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| agent-evidence-5 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| agent-evidence-6 | agent-evidence | PASS | long_task | long_task | high_risk_pro_thinking_max_requires_approval | 24 | none |
| benchmark-evidence-1 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| benchmark-evidence-2 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| benchmark-evidence-3 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| benchmark-evidence-4 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| benchmark-evidence-5 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| benchmark-evidence-6 | benchmark-evidence | PASS | benchmark | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-1 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-2 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-3 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-4 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-5 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| permission-release-6 | permission-security-release | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |
| ecosystem-boundary-1 | ecosystem-boundary | PASS | search | observe | high_risk_pro_thinking_max_requires_approval | 24 | none |
| ecosystem-boundary-2 | ecosystem-boundary | PASS | search | observe | high_risk_pro_thinking_max_requires_approval | 24 | none |
| ecosystem-boundary-3 | ecosystem-boundary | PASS | search | observe | high_risk_pro_thinking_max_requires_approval | 24 | none |
| ecosystem-boundary-4 | ecosystem-boundary | PASS | search | observe | high_risk_pro_thinking_max_requires_approval | 24 | none |
| feature-deletion-single-file-parser-001 | feature-deletion | PASS | debug | recovery | recovery_flash_thinking_max | 16 | none |
| feature-deletion-multi-file-cost-ledger-002 | feature-deletion | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| feature-deletion-api-tool-schema-003 | feature-deletion | PASS | debug | recovery | recovery_flash_thinking_max | 16 | none |
| feature-deletion-tui-state-004 | feature-deletion | PASS | multi_file_refactor | plan_execute_verify | high_risk_pro_thinking_max_requires_approval | 24 | none |
| feature-deletion-security-claim-005 | feature-deletion | PASS | review | review | high_risk_pro_thinking_max_requires_approval | 22 | none |

Blockers: none

Rule: Golden replay is an internal deterministic DSXU contract suite. It verifies routing and tool-window shape, not model quality or public benchmark rank.
