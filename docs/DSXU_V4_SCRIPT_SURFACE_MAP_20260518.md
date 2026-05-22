# DSXU V4 Script Surface Map - 2026-05-18

Status: PASS_DSXU_V4_SCRIPT_SURFACE_MAP_READY

Command catalog: `docs/generated/DSXU_COMMAND_CATALOG_20260518.json`

## Category Summary

| category | count |
| --- | --- |
| product-runtime | 3 |
| mainline-validation | 15 |
| release-only | 9 |
| owner-review | 12 |
| historical-evidence | 56 |
| internal-benchmark | 4 |
| live-provider | 8 |
| toolchain | 4 |
| supporting-utility | 13 |

## Mainline Aliases

- evidence:dashboard
- benchmark:swe-bench
- health:runtime
- cache:warm

## Public Claim Blocked Scripts

- acl:closure-plan
- acl:preflight
- owner-git:authorization-board
- owner-git:mutation-command-plan
- owner-git:preflight
- owner-git:product-stage-plan
- owner-git:stage-plan
- p12:raw-readiness
- p12:target-collection
- p12:target-contract
- p12:target-discovery
- p12:target-intake

## Release Only Scripts

- clean-export:preflight
- commercial-ip:preflight
- release:blocker-board
- release:clean-export-artifact
- release:closure-batch
- release:final-preflight
- release:fresh-install-smoke
- release:github-launch-pack
- release:post-authorization-plan

## Live Provider Scripts

- live:agent-parent-synthesis-smoke
- live:cache-prefix-smoke
- live:flash-first-recovery-smoke
- live:flash-smoke
- live:planning-flash-max-smoke
- live:pro-planning-smoke
- live:provider-gate
- live:real-task-compare

## Owner Review Scripts

- acl:closure-plan
- acl:preflight
- owner-git:authorization-board
- owner-git:mutation-command-plan
- owner-git:preflight
- owner-git:product-stage-plan
- owner-git:stage-plan
- p12:raw-readiness
- p12:target-collection
- p12:target-contract
- p12:target-discovery
- p12:target-intake

## Rule

The script surface map is a projection of the command catalog. It does not create package entrypoints; it prevents historical, owner-review, release-only, live-provider, and smoke scripts from being described as default product features.
