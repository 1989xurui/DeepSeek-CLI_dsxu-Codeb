# DSXU V24 Fresh Install Release Smoke - 2026-05-15

Status: PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE

Export dir: D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-22T00-01-03-492Z

Commands: 8/8

## Command Evidence

| id | passed | exitCode | durationMs | stdout | stderr |
| --- | --- | --- | --- | --- | --- |
| fresh-bun-install | true | 0 | 514 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-bun-install-2026-05-22T03-38-05-641Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-bun-install-2026-05-22T03-38-05-641Z.stderr.log |
| product-help | true | 0 | 1642 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-help-2026-05-22T03-38-06-155Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-help-2026-05-22T03-38-06-155Z.stderr.log |
| slash-help-print | true | 0 | 115 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\slash-help-print-2026-05-22T03-38-07-797Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\slash-help-print-2026-05-22T03-38-07-797Z.stderr.log |
| auth-login-no-key-guidance | true | 0 | 1439 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-no-key-guidance-2026-05-22T03-38-07-912Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-no-key-guidance-2026-05-22T03-38-07-912Z.stderr.log |
| auth-login-key-wizard-stdin | true | 0 | 1452 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-key-wizard-stdin-2026-05-22T03-38-09-352Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-key-wizard-stdin-2026-05-22T03-38-09-352Z.stderr.log |
| product-doctor | true | 0 | 4119 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-doctor-2026-05-22T03-38-10-803Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-doctor-2026-05-22T03-38-10-803Z.stderr.log |
| mcp-doctor-json | true | 0 | 1376 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\mcp-doctor-json-2026-05-22T03-38-14-922Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\mcp-doctor-json-2026-05-22T03-38-14-922Z.stderr.log |
| fresh-provider-gate | true | 0 | 498 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-provider-gate-2026-05-22T03-38-16-298Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-provider-gate-2026-05-22T03-38-16-298Z.stderr.log |

## Rule

This smoke runs from the clean export directory after a fresh dependency install. It does not stage, commit, delete, reset, or mutate source workspace files.
