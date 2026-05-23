# DSXU V24 Six-Stage Final Tests - 2026-05-15

Status: PASS_V24_SIX_STAGE_FINAL_TESTS

## Stage Summary

| stage | status | passed | total | durationMs |
| --- | --- | --- | --- | --- |
| function | PASS | 3 | 3 | 23599 |
| experience | PASS | 5 | 5 | 436687 |
| recovery | PASS | 2 | 2 | 2528 |
| performance | PASS | 3 | 3 | 4670 |
| evaluation | PASS | 3 | 3 | 159441 |
| release-closure | PASS | 6 | 6 | 374532 |

## Owner Summary

| owner | status | passed | total | timedOut | liveProvider | durationMs | failedCommands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent lifecycle owner | PASS | 2 | 2 | 0 | 0 | 6785 |  |
| DeepSeek Provider / Route / Cost owner | PASS | 4 | 4 | 0 | 3 | 6322 |  |
| Evidence / Evaluation owner | PASS | 3 | 3 | 0 | 0 | 159441 |  |
| Recovery / Resume owner | PASS | 1 | 1 | 0 | 0 | 142 |  |
| Release / Claim / Clean-export owner | PASS | 6 | 6 | 0 | 0 | 374532 |  |
| Tool Gate / Permission / Adapter owner | PASS | 1 | 1 | 0 | 0 | 17548 |  |
| TUI visible-state / Control-plane owner | PASS | 5 | 5 | 0 | 0 | 436687 |  |

## Test Tier Summary

| testTier | status | passed | total | timedOut | liveProvider | durationMs |
| --- | --- | --- | --- | --- | --- | --- |
| slow | PASS | 8 | 8 | 0 | 0 | 184024 |
| acceptance | PASS | 5 | 5 | 0 | 0 | 436687 |
| live-provider | PASS | 3 | 3 | 0 | 3 | 6214 |
| release-only | PASS | 6 | 6 | 0 | 0 | 374532 |

## Command Evidence

| stage | id | owner | testTier | liveProvider | durationMs | passed | exitCode | rootCause | nextAction | stdout | stderr |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| function | function-tools-permission-adapter | Tool Gate / Permission / Adapter owner | slow | false | 17548 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\01-function-function-tools-permission-adapter-2026-05-23T17-11-56-431Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\01-function-function-tools-permission-adapter-2026-05-23T17-11-56-431Z.stderr.log |
| function | function-provider-router-cost | DeepSeek Provider / Route / Cost owner | live-provider | true | 1652 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\02-function-function-provider-router-cost-2026-05-23T17-12-13-979Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\02-function-function-provider-router-cost-2026-05-23T17-12-13-979Z.stderr.log |
| function | function-agent-lifecycle | Agent lifecycle owner | slow | false | 4399 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\03-function-function-agent-lifecycle-2026-05-23T17-12-15-631Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\03-function-function-agent-lifecycle-2026-05-23T17-12-15-631Z.stderr.log |
| experience | experience-visible-tui-core | TUI visible-state / Control-plane owner | acceptance | false | 1863 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\04-experience-experience-visible-tui-core-2026-05-23T17-12-20-031Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\04-experience-experience-visible-tui-core-2026-05-23T17-12-20-031Z.stderr.log |
| experience | experience-real-tui-lifecycle | TUI visible-state / Control-plane owner | acceptance | false | 174758 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\05-experience-experience-real-tui-lifecycle-2026-05-23T17-12-21-894Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\05-experience-experience-real-tui-lifecycle-2026-05-23T17-12-21-894Z.stderr.log |
| experience | experience-real-tui-resize | TUI visible-state / Control-plane owner | acceptance | false | 89319 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\06-experience-experience-real-tui-resize-2026-05-23T17-15-16-652Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\06-experience-experience-real-tui-resize-2026-05-23T17-15-16-652Z.stderr.log |
| experience | experience-control-plane-real-gap | TUI visible-state / Control-plane owner | acceptance | false | 2317 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\07-experience-experience-control-plane-real-gap-2026-05-23T17-16-45-971Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\07-experience-experience-control-plane-real-gap-2026-05-23T17-16-45-971Z.stderr.log |
| experience | experience-real-interactive-tui | TUI visible-state / Control-plane owner | acceptance | false | 168430 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\08-experience-experience-real-interactive-tui-2026-05-23T17-16-48-288Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\08-experience-experience-real-interactive-tui-2026-05-23T17-16-48-288Z.stderr.log |
| recovery | recovery-core-query-loop | Recovery / Resume owner | slow | false | 142 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\09-recovery-recovery-core-query-loop-2026-05-23T17-19-36-718Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\09-recovery-recovery-core-query-loop-2026-05-23T17-19-36-718Z.stderr.log |
| recovery | recovery-experience-store-agent-parent | Agent lifecycle owner | slow | false | 2386 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\10-recovery-recovery-experience-store-agent-parent-2026-05-23T17-19-36-860Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\10-recovery-recovery-experience-store-agent-parent-2026-05-23T17-19-36-860Z.stderr.log |
| performance | performance-cost-cache-unit | DeepSeek Provider / Route / Cost owner | slow | false | 108 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\11-performance-performance-cost-cache-unit-2026-05-23T17-19-39-246Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\11-performance-performance-cost-cache-unit-2026-05-23T17-19-39-246Z.stderr.log |
| performance | performance-live-provider-gate | DeepSeek Provider / Route / Cost owner | live-provider | true | 3033 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\12-performance-performance-live-provider-gate-2026-05-23T17-19-39-354Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\12-performance-performance-live-provider-gate-2026-05-23T17-19-39-354Z.stderr.log |
| performance | performance-live-cache-prefix | DeepSeek Provider / Route / Cost owner | live-provider | true | 1529 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\13-performance-performance-live-cache-prefix-2026-05-23T17-19-42-387Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\13-performance-performance-live-cache-prefix-2026-05-23T17-19-42-387Z.stderr.log |
| evaluation | evaluation-p12-raw-readiness | Evidence / Evaluation owner | slow | false | 28431 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\14-evaluation-evaluation-p12-raw-readiness-2026-05-23T17-19-43-916Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\14-evaluation-evaluation-p12-raw-readiness-2026-05-23T17-19-43-916Z.stderr.log |
| evaluation | evaluation-p12-senior-experience | Evidence / Evaluation owner | slow | false | 130878 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\15-evaluation-evaluation-p12-senior-experience-2026-05-23T17-20-12-347Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\15-evaluation-evaluation-p12-senior-experience-2026-05-23T17-20-12-347Z.stderr.log |
| evaluation | evaluation-v18-evidence-pack | Evidence / Evaluation owner | slow | false | 132 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\16-evaluation-evaluation-v18-evidence-pack-2026-05-23T17-22-23-226Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\16-evaluation-evaluation-v18-evidence-pack-2026-05-23T17-22-23-226Z.stderr.log |
| release-closure | release-owner-final-preflight | Release / Claim / Clean-export owner | release-only | false | 282 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\17-release-closure-release-owner-final-preflight-2026-05-23T17-22-23-358Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\17-release-closure-release-owner-final-preflight-2026-05-23T17-22-23-358Z.stderr.log |
| release-closure | release-v20-final-preflight | Release / Claim / Clean-export owner | release-only | false | 237 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\18-release-closure-release-v20-final-preflight-2026-05-23T17-22-23-640Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\18-release-closure-release-v20-final-preflight-2026-05-23T17-22-23-640Z.stderr.log |
| release-closure | release-gate | Release / Claim / Clean-export owner | release-only | false | 361059 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\19-release-closure-release-gate-2026-05-23T17-22-23-877Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\19-release-closure-release-gate-2026-05-23T17-22-23-877Z.stderr.log |
| release-closure | release-clean-export-preflight | Release / Claim / Clean-export owner | release-only | false | 165 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\20-release-closure-release-clean-export-preflight-2026-05-23T17-28-24-936Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\20-release-closure-release-clean-export-preflight-2026-05-23T17-28-24-936Z.stderr.log |
| release-closure | release-surface-tests | Release / Claim / Clean-export owner | release-only | false | 12644 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\21-release-closure-release-surface-tests-2026-05-23T17-28-25-102Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\21-release-closure-release-surface-tests-2026-05-23T17-28-25-102Z.stderr.log |
| release-closure | release-commercial-ip | Release / Claim / Clean-export owner | release-only | false | 145 | true | 0 | passed | no repair needed; keep this command as release evidence | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\22-release-closure-release-commercial-ip-2026-05-23T17-28-37-746Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-six-stage-final-tests\22-release-closure-release-commercial-ip-2026-05-23T17-28-37-746Z.stderr.log |

## Failure Attribution

No failed commands.

## Rule

This runner executes real local tests and live/provider smokes where listed. It does not stage, commit, delete, reset, clean, or create export artifacts.
