# DSXU V24 Execution Batch - 20260515

## Scope

This batch executes the first V24 gates in evidence mode:

1. V24 baseline audit.
2. Runtime/stub redline.
3. Claude 1902 experience-density rebaseline.
4. C2 experience acceptance matrix.
5. DeepSeek runtime contract audit.
6. Work-state timeline acceptance audit.

It does not delete files, clean the workspace, run final tests, commit, export, or claim V24 95 score.

## Baseline

| Item | Value |
|---|---:|
| Publish surface files | 2891 |
| DSXU source files | 2650 |
| Claude source files | 1902 |
| git status --short | 2024 |
| staged paths | 2024 |
| unstaged paths | 12 |
| untracked paths | 0 |

## Runtime / Stub Redline

| Item | Value |
|---|---:|
| Redline rows | 7462 |
| Status | OPEN_REDLINE_REVIEW_REQUIRED |

The redline is review evidence, not automatic deletion. Any duplicate runtime or old compatibility path must be merged into the original owner or remain a replace/delete candidate.

### Redline Owner Packets

| Owner | Total | Blocker | Owner Review | Release Copy | Info | Top Disposition |
|---|---:|---:|---:|---:|---:|---|
| cli-command-transport | 717 | 26 | 688 | 1 | 2 | runtime_duplication_pressure_review:564 |
| ui-tui-work-state | 833 | 24 | 796 | 3 | 10 | runtime_duplication_pressure_review:505 |
| model-router-cost | 790 | 8 | 779 | 0 | 3 | runtime_duplication_pressure_review:411 |
| tool-lifecycle | 758 | 7 | 704 | 11 | 36 | runtime_duplication_pressure_review:375 |
| mcp-skill-registry | 538 | 7 | 521 | 5 | 5 | runtime_duplication_pressure_review:434 |
| config-settings | 461 | 7 | 443 | 2 | 9 | runtime_duplication_pressure_review:280 |
| api-contract-types | 85 | 5 | 80 | 0 | 0 | runtime_duplication_pressure_review:67 |
| coding-workflow | 85 | 5 | 73 | 3 | 4 | runtime_duplication_pressure_review:27 |
| query-loop | 63 | 5 | 58 | 0 | 0 | runtime_duplication_pressure_review:45 |
| hook-lifecycle | 36 | 5 | 31 | 0 | 0 | runtime_duplication_pressure_review:30 |
| agent-task-lifecycle | 108 | 4 | 101 | 0 | 3 | runtime_duplication_pressure_review:90 |
| release-doctor | 75 | 4 | 70 | 1 | 0 | runtime_duplication_pressure_review:69 |

## C2 Experience Density

| Item | Claude | DSXU |
|---|---:|---:|
| Source files | 1902 | 2650 |
| 12-category signal hits | 12786 | 18211 |
| >=4 signal files | 1576 | 2191 |
| >=6 signal files | 1228 | 1740 |
| Primary loops needing compressed/no-signal review | 0 | 0 |
| Secondary loops needing compressed/no-signal review | 0 | 0 |

Conclusion: DSXU has dense Claude-like signals, but V24 acceptance still requires real behavior evidence for each loop. Signal counts do not equal feature parity.

## Contract Matrices

| Matrix | Rows | Status |
|---|---:|---|
| C2 experience acceptance | 51 | OPEN_BEHAVIOR_EVIDENCE_REQUIRED |
| DeepSeek runtime contract | 6 | SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED |
| Work-state timeline acceptance | 6 | SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED |

## Outputs

- `D:\DSXU-code\docs\generated\DSXU_V24_BASELINE_AUDIT_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_BASELINE_AUDIT_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_RUNTIME_STUB_REDLINE_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_RUNTIME_STUB_REDLINE_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_C2_SECONDARY_LOOP_REBASELINE_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_REDLINE_OWNER_PACKET_TRIAGE_20260515.json`
- `D:\DSXU-code\docs\generated\DSXU_V24_REDLINE_OWNER_PACKET_TRIAGE_20260515.csv`
- `D:\DSXU-code\docs\generated\DSXU_V24_EXECUTION_BATCH_20260515.json`
