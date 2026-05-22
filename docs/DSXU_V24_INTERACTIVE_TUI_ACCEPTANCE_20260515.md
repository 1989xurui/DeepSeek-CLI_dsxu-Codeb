# DSXU V24 Interactive TUI Acceptance - 20260515

This report runs the real DSXU TUI through the existing WSL PTY harness and cross-checks it with Flash-first DSXU review.

Status: `PASS_INTERACTIVE_TUI_ACCEPTANCE`

Policy: default model `deepseek-v4-flash`; Pro not run; product entry is `bin/dsxu-code` through WSL PTY.

| id | category | status | ok | c2Loops | transcript |
| --- | --- | --- | --- | --- | --- |
| startup-exit | startup-visible-state | PASS_TUI_EVIDENCED | true | Visible Work-State, Release/Doctor/Install | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-startup-exit.transcript.txt |
| permission-fallback | permission-visible-state | PASS_TUI_EVIDENCED | true | Permission/Safety, Visible Work-State | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-permission-fallback.transcript.txt |
| no-progress-recovery | failure-recovery-negative-path | PASS_NEGATIVE_RECOVERY_EVIDENCED | true | Failure/Recovery, Visible Work-State | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-no-progress-recovery.transcript.txt |
| auto-continue | tool-result-auto-continue | PASS_TUI_EVIDENCED | true | Tool Lifecycle, Failure/Recovery | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-auto-continue.transcript.txt |
| compact-resume | context-resume-source-truth | PASS_TUI_EVIDENCED | true | Context/Memory/Compact, Source Truth/Coding, Failure/Recovery | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-compact-resume.transcript.txt |
| background-task | agent-background-lifecycle | PASS_TUI_EVIDENCED | true | Agent Delegation, Visible Work-State, Telemetry/Evidence | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-background-task.transcript.txt |
| model-task-auth-or-progress | real-model-tui-task | PASS_TUI_EVIDENCED | true | Goal/Session, Model/Cost/Cache, Visible Work-State | D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\v24-model-task-auth-or-progress.transcript.txt |

Command evidence:

- local regression: exit=0, stdout=D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\interactive-tui-local-regression-2026-05-21T23-01-54-573Z.stdout.log
- Flash review: exit=0, trace=D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\flash-review-2026-05-21T23-01-56-317Z.jsonl, costUSD=0.0007389312
- Flash review input: D:\DSXU-code\docs\generated\DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_REVIEW_INPUT_20260515.json
- WSL provider gate: status=READY, evidence=D:\DSXU-code\.dsxu\trace\v24-interactive-tui-acceptance\wsl-live-provider-gate.json

Remaining gates:

- 30-45 minute complex senior-coding task.
- Full C2 15 major loops and 36 secondary loops.
- Agent/MCP/permission/cost public challenge package.
- Six-stage final tests and clean export.
