# DSXU V24 Fresh Install Release Smoke - 2026-05-15

Status: PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE

Export dir: D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-22T00-01-03-492Z

Commands: 8/8

## Command Evidence

| id | passed | exitCode | durationMs | stdout | stderr |
| --- | --- | --- | --- | --- | --- |
| fresh-bun-install | true | 0 | 11162 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-bun-install-2026-05-22T00-01-56-967Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-bun-install-2026-05-22T00-01-56-967Z.stderr.log |
| product-help | true | 0 | 1499 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-help-2026-05-22T00-02-08-129Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-help-2026-05-22T00-02-08-129Z.stderr.log |
| slash-help-print | true | 0 | 108 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\slash-help-print-2026-05-22T00-02-09-628Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\slash-help-print-2026-05-22T00-02-09-628Z.stderr.log |
| auth-login-no-key-guidance | true | 0 | 1502 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-no-key-guidance-2026-05-22T00-02-09-736Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-no-key-guidance-2026-05-22T00-02-09-736Z.stderr.log |
| auth-login-key-wizard-stdin | true | 0 | 1423 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-key-wizard-stdin-2026-05-22T00-02-11-238Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\auth-login-key-wizard-stdin-2026-05-22T00-02-11-238Z.stderr.log |
| product-doctor | true | 0 | 3624 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-doctor-2026-05-22T00-02-12-661Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\product-doctor-2026-05-22T00-02-12-661Z.stderr.log |
| mcp-doctor-json | true | 0 | 1374 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\mcp-doctor-json-2026-05-22T00-02-16-285Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\mcp-doctor-json-2026-05-22T00-02-16-285Z.stderr.log |
| fresh-provider-gate | true | 0 | 490 | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-provider-gate-2026-05-22T00-02-17-659Z.stdout.log | D:\DSXU-code\.dsxu\trace\v24-fresh-install-release-smoke\fresh-provider-gate-2026-05-22T00-02-17-659Z.stderr.log |

## Rule

This smoke runs from the clean export directory after a fresh dependency install. It does not stage, commit, delete, reset, or mutate source workspace files.
