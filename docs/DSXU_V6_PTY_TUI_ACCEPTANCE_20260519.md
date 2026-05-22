# DSXU V6 PTY/TUI Acceptance

- status: `PASS_V6_PTY_TUI_ACCEPTANCE`
- owner: `TUI Trust Surface / PTY Harness`
- claimBoundary: This is real PTY harness acceptance for resize, scrollback, permission dialog, and compact trust evidence. It is not a visual/manual product signoff by itself.

## Scenarios

| scenario | status | blockers | evidence |
|---|---|---|---|
| v6-long-content-sticky-bottom-resize | PASS | none | transcript=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-long-content-sticky-bottom-resize.transcript.txt<br>trace=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-long-content-sticky-bottom-resize.trace.jsonl<br>resizeEvents=5<br>elapsedMs=17836 |
| v6-scrollback-resize-position | PASS | none | transcript=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-scrollback-resize-position.transcript.txt<br>trace=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-scrollback-resize-position.trace.jsonl<br>resizeEvents=5<br>elapsedMs=20699 |
| v6-permission-dialog-after-resize | PASS | none | transcript=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-permission-dialog-after-resize.transcript.txt<br>trace=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-permission-dialog-after-resize.trace.jsonl<br>resizeEvents=5<br>elapsedMs=78522 |
| v6-trust-proof-after-resize | PASS | none | transcript=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-trust-proof-after-resize.transcript.txt<br>trace=//wsl.localhost/Ubuntu/home/xurui/.dsxu/trace/v18-tui/v6-trust-proof-after-resize.trace.jsonl<br>resizeEvents=5<br>elapsedMs=18763 |

## Blockers

- none
