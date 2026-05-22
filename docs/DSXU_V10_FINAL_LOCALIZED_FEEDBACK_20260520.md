# DSXU V10 Final Localized Feedback

Status: PASS_V10_FINAL_LOCALIZED_FEEDBACK

| line | feedback |
|---:|---|
| 1 | command: bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts |
| 2 | score: 58; failedAttempts: 2 |
| 3 | top finding: P1 tool result backflow breaks cache locality |
| 4 | local detail: large read output is repeatedly returned to the dynamic prompt tail |
| 5 | repair hint: store the long output as artifact and keep a bounded preview in the next turn |
| 6 | localized files: src/dsxu/engine/route-cache-dynamic-tail.ts, src/dsxu/engine/prompt-prefix-cache-builder.ts |
| 7 | next action: artifact the large tool result, rebuild source capsule, then rerun focused verification |

Ledger events: 3

Blockers: none

Rule: Localized feedback is a compact recovery envelope for failed verification. It is written to the existing ledger and does not create another recovery runtime.
