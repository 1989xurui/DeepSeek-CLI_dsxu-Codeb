# DSXU V10 Feature Deletion Benchmark Pack

Status: PASS_V10_FEATURE_DELETION_TASK_PACK_READY

Cases: 5

| id | category | profile | verification | forbidden |
|---|---|---|---|---|
| feature-deletion-single-file-parser-001 | single_file_function | debug | bun test fixtures/parser/__tests__/parseRoute.test.ts | read solution<br>only edit test<br>claim public benchmark |
| feature-deletion-multi-file-cost-ledger-002 | multi_file_contract | multi_file_refactor | bun test fixtures/cost/__tests__/ledger.test.ts | read answer patch<br>skip ledger evidence<br>claim cost win without verification |
| feature-deletion-api-tool-schema-003 | api_schema | debug | bun test fixtures/tool-schema/__tests__/schema.test.ts | accept orphan tool result<br>mock live provider as benchmark |
| feature-deletion-tui-state-004 | tui_state | multi_file_refactor | bun test fixtures/tui/__tests__/TrustSurface.test.tsx | ignore real TUI path<br>oversized repeated status line |
| feature-deletion-security-claim-005 | security_regression | review | bun test fixtures/claim/__tests__/boundary.test.ts | public 90 claim<br>external win without target manifest<br>old artifact as source truth |

Rule: Feature deletion cases are internal product-evidence tasks. They are not SWE-bench, external victory, or public 90% claims.
