# DSXU V24 Six-Stage Final Tests - 2026-05-15

Status: PASS_V24_SIX_STAGE_FINAL_TESTS

## Stage Summary

| stage | status | passed | total | durationMs |
| --- | --- | --- | --- | --- |
| function | PASS | 3 | 3 | 22484 |
| experience | PASS | 5 | 5 | 448533 |
| recovery | PASS | 2 | 2 | 2650 |
| performance | PASS | 3 | 3 | 2029 |
| evaluation | PASS | 3 | 3 | 156017 |
| release-closure | PASS | 6 | 6 | 396075 |

## Owner Summary

| owner | status | passed | total | timedOut | liveProvider | durationMs | failedCommands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent lifecycle owner | PASS | 2 | 2 | 0 | 0 | 6662 |  |
| DeepSeek Provider / Route / Cost owner | PASS | 4 | 4 | 0 | 3 | 3694 |  |
| Evidence / Evaluation owner | PASS | 3 | 3 | 0 | 0 | 156017 |  |
| Recovery / Resume owner | PASS | 1 | 1 | 0 | 0 | 233 |  |
| Release / Claim / Clean-export owner | PASS | 6 | 6 | 0 | 0 | 396075 |  |
| Tool Gate / Permission / Adapter owner | PASS | 1 | 1 | 0 | 0 | 16574 |  |
| TUI visible-state / Control-plane owner | PASS | 5 | 5 | 0 | 0 | 448533 |  |

## Test Tier Summary

| testTier | status | passed | total | timedOut | liveProvider | durationMs |
| --- | --- | --- | --- | --- | --- | --- |
| slow | PASS | 8 | 8 | 0 | 0 | 179619 |
| acceptance | PASS | 5 | 5 | 0 | 0 | 448533 |
| live-provider | PASS | 3 | 3 | 0 | 3 | 3561 |
| release-only | PASS | 6 | 6 | 0 | 0 | 396075 |

## Command Evidence

| stage | id | owner | testTier | liveProvider | durationMs | passed | exitCode | rootCause | nextAction | stdout | stderr |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| function | function-tools-permission-adapter | Tool Gate / Permission / Adapter owner | slow | false | 16574 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\01-function-function-tools-permission-adapter-2026-05-21T22-54-14-465Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\01-function-function-tools-permission-adapter-2026-05-21T22-54-14-465Z.stderr.log |
| function | function-provider-router-cost | DeepSeek Provider / Route / Cost owner | live-provider | true | 1665 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\02-function-function-provider-router-cost-2026-05-21T22-54-31-038Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\02-function-function-provider-router-cost-2026-05-21T22-54-31-038Z.stderr.log |
| function | function-agent-lifecycle | Agent lifecycle owner | slow | false | 4245 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\03-function-function-agent-lifecycle-2026-05-21T22-54-32-703Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\03-function-function-agent-lifecycle-2026-05-21T22-54-32-703Z.stderr.log |
| experience | experience-visible-tui-core | TUI visible-state / Control-plane owner | acceptance | false | 1540 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\04-experience-experience-visible-tui-core-2026-05-21T22-54-36-948Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\04-experience-experience-visible-tui-core-2026-05-21T22-54-36-948Z.stderr.log |
| experience | experience-real-tui-lifecycle | TUI visible-state / Control-plane owner | acceptance | false | 181039 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\05-experience-experience-real-tui-lifecycle-2026-05-21T22-54-38-488Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\05-experience-experience-real-tui-lifecycle-2026-05-21T22-54-38-488Z.stderr.log |
| experience | experience-real-tui-resize | TUI visible-state / Control-plane owner | acceptance | false | 78247 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\06-experience-experience-real-tui-resize-2026-05-21T22-57-39-527Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\06-experience-experience-real-tui-resize-2026-05-21T22-57-39-527Z.stderr.log |
| experience | experience-control-plane-real-gap | TUI visible-state / Control-plane owner | acceptance | false | 3122 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\07-experience-experience-control-plane-real-gap-2026-05-21T22-58-57-774Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\07-experience-experience-control-plane-real-gap-2026-05-21T22-58-57-774Z.stderr.log |
| experience | experience-real-interactive-tui | TUI visible-state / Control-plane owner | acceptance | false | 184585 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\08-experience-experience-real-interactive-tui-2026-05-21T22-59-00-896Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\08-experience-experience-real-interactive-tui-2026-05-21T22-59-00-896Z.stderr.log |
| recovery | recovery-core-query-loop | Recovery / Resume owner | slow | false | 233 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\09-recovery-recovery-core-query-loop-2026-05-21T23-02-05-482Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\09-recovery-recovery-core-query-loop-2026-05-21T23-02-05-482Z.stderr.log |
| recovery | recovery-experience-store-agent-parent | Agent lifecycle owner | slow | false | 2417 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\10-recovery-recovery-experience-store-agent-parent-2026-05-21T23-02-05-715Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\10-recovery-recovery-experience-store-agent-parent-2026-05-21T23-02-05-715Z.stderr.log |
| performance | performance-cost-cache-unit | DeepSeek Provider / Route / Cost owner | slow | false | 133 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\11-performance-performance-cost-cache-unit-2026-05-21T23-02-08-132Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\11-performance-performance-cost-cache-unit-2026-05-21T23-02-08-132Z.stderr.log |
| performance | performance-live-provider-gate | DeepSeek Provider / Route / Cost owner | live-provider | true | 559 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\12-performance-performance-live-provider-gate-2026-05-21T23-02-08-265Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\12-performance-performance-live-provider-gate-2026-05-21T23-02-08-265Z.stderr.log |
| performance | performance-live-cache-prefix | DeepSeek Provider / Route / Cost owner | live-provider | true | 1337 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\13-performance-performance-live-cache-prefix-2026-05-21T23-02-08-824Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\13-performance-performance-live-cache-prefix-2026-05-21T23-02-08-824Z.stderr.log |
| evaluation | evaluation-p12-raw-readiness | Evidence / Evaluation owner | slow | false | 27446 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\14-evaluation-evaluation-p12-raw-readiness-2026-05-21T23-02-10-161Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\14-evaluation-evaluation-p12-raw-readiness-2026-05-21T23-02-10-161Z.stderr.log |
| evaluation | evaluation-p12-senior-experience | Evidence / Evaluation owner | slow | false | 128337 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\15-evaluation-evaluation-p12-senior-experience-2026-05-21T23-02-37-607Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\15-evaluation-evaluation-p12-senior-experience-2026-05-21T23-02-37-607Z.stderr.log |
| evaluation | evaluation-v18-evidence-pack | Evidence / Evaluation owner | slow | false | 234 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\16-evaluation-evaluation-v18-evidence-pack-2026-05-21T23-04-45-945Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\16-evaluation-evaluation-v18-evidence-pack-2026-05-21T23-04-45-945Z.stderr.log |
| release-closure | release-owner-final-preflight | Release / Claim / Clean-export owner | release-only | false | 432 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\17-release-closure-release-owner-final-preflight-2026-05-21T23-04-46-180Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\17-release-closure-release-owner-final-preflight-2026-05-21T23-04-46-180Z.stderr.log |
| release-closure | release-v20-final-preflight | Release / Claim / Clean-export owner | release-only | false | 332 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\18-release-closure-release-v20-final-preflight-2026-05-21T23-04-46-612Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\18-release-closure-release-v20-final-preflight-2026-05-21T23-04-46-612Z.stderr.log |
| release-closure | release-gate | Release / Claim / Clean-export owner | release-only | false | 382280 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\19-release-closure-release-gate-2026-05-21T23-04-46-945Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\19-release-closure-release-gate-2026-05-21T23-04-46-945Z.stderr.log |
| release-closure | release-clean-export-preflight | Release / Claim / Clean-export owner | release-only | false | 165 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\20-release-closure-release-clean-export-preflight-2026-05-21T23-11-09-225Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\20-release-closure-release-clean-export-preflight-2026-05-21T23-11-09-225Z.stderr.log |
| release-closure | release-surface-tests | Release / Claim / Clean-export owner | release-only | false | 12711 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\21-release-closure-release-surface-tests-2026-05-21T23-11-09-391Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\21-release-closure-release-surface-tests-2026-05-21T23-11-09-391Z.stderr.log |
| release-closure | release-commercial-ip | Release / Claim / Clean-export owner | release-only | false | 155 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\22-release-closure-release-commercial-ip-2026-05-21T23-11-22-102Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\22-release-closure-release-commercial-ip-2026-05-21T23-11-22-102Z.stderr.log |

## Failure Attribution

No failed commands.

## Rule

This runner executes real local tests and live/provider smokes where listed. It does not stage, commit, delete, reset, clean, or create export artifacts.
