# DSXU V24 Completed Reacceptance - 20260515

This report retests V24 completed function claims under the updated real acceptance standard.

Status: `PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE`

Policy: Flash-first, Pro not run. Interactive TUI acceptance remains a separate required gate.

| id | status | sourceTruth | localRegressionPass | flashLivePass | proWasRun |
| --- | --- | --- | --- | --- | --- |
| pbt-real-runner | PASS_FLASH_FIRST_REACCEPTED | true | true | true | false |
| mutation-real-runner | PASS_FLASH_FIRST_REACCEPTED | true | true | true | false |
| tdd-gate-real-runner | PASS_FLASH_FIRST_REACCEPTED | true | true | true | false |

Command evidence:

- local regression: exit=0, stdout=D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\local-real-runner-regression-2026-05-16T15-36-09-950Z.stdout.log
- live provider gate: exit=0, stdout=D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\live-provider-gate-2026-05-16T15-36-22-675Z.stdout.log
- v24 batch replay: exit=0, stdout=D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\v24-batch-replay-2026-05-16T15-36-22-932Z.stdout.log
- product help entry: exit=0, stdout=D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\product-entry-help-2026-05-16T15-36-55-724Z.stdout.log

Flash live traces:

- flash-pbt-real-runner: D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\flash-pbt-real-runner-2026-05-16T15-36-11-694Z.jsonl; costUSD=0.0013394248000000001
- flash-mutation-real-runner: D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\flash-mutation-real-runner-2026-05-16T15-36-11-707Z.jsonl; costUSD=0.0001803312
- flash-tdd-gate-real-runner: D:\DSXU-code\.dsxu\trace\v24-completed-reacceptance\flash-tdd-gate-real-runner-2026-05-16T15-36-11-716Z.jsonl; costUSD=0.00019685680000000003
