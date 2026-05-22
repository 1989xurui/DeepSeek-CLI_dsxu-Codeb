# DSXU Release Gate

This directory is the stable release-facing index. Historical versioned reports remain evidence, but public release decisions should be made from the gates below.

## Required Gates

| Gate | Required Evidence |
|---|---|
| Product claim guard | `release:github-launch-pack` |
| Reference capability-loss board | `evidence:c2-capability-loss-board` |
| Naming governance board | `evidence:naming-governance` |
| Six-stage final tests | `test:six-stage-final` |
| Release/export public surface policy | `open-source-package-gate` manifest ships only release-safe public docs/assets and source files |
| Clean export artifact | `release:clean-export-artifact` |
| Fresh install smoke | `release:fresh-install-smoke` |
| Secret scan | `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT` in clean export evidence |

## Current Decision

The current codebase is suitable as a release-candidate evidence pack and may publish the actual evidenced score floor: `72/95`. V2/V3 finalization closed the runtime/release blockers and moved the dashboard to `blocked=0`. It is still not suitable for a 90/95-point public launch claim or external-comparison claim because `public95ClaimAllowed=false` and same-case external target/reference transcripts are still missing.

Latest internal evidence can be cited only with boundaries: full repo regression is `3075` pass / `1` skip / `0` fail across `434` test files, six-stage final is `22/22`, DSXU release gate tests are `531` pass / `0` fail, the 30.48-minute senior coding window passed with `33` DSXU product-entry runs on Flash-only cost of about `$0.3617`, V2/V3 closed the original `14/14` non-pass finalization subset and imported `30/30` DSXU raw evidence, the real-task hit-rate pack reports `24/24` final PASS with `0%` first-attempt PASS and `100%` second-attempt recovery, and the internal replay hit-rate gate reports `100/100` final PASS. These are DSXU-owned internal product proofs, not external leaderboard claims.

## Latest Gate Snapshot

| Gate | Latest state | Release meaning |
|---|---:|---|
| Full repo regression | 3075 pass / 1 skip / 0 fail | Codebase regression proof. |
| Six-stage final tests | 22/22 PASS | Main release workflow proof. |
| DSXU release gate tests | 531 pass / 0 fail | Release surface and claim-boundary proof after V2/V3 closeout. |
| Training V1 | 23 steps, 13 gates, 0 failed | Internal training/evidence pipeline proof; public claim remains blocked. |
| SWE internal smoke | 5/5 PASS | Internal smoke only; not a public benchmark score. |
| V2/V3 finalization closeout | 14/14 non-pass subset closed; 16/16 remaining raw API baseline captured; 30/30 DSXU raw evidence ready | Runtime/release blocker closure; not an external comparison claim. |
| Evidence dashboard | pass=159, fail=0, blocked=0, claimBlocked=1, notRun=0, scoreFloor=72 | Runtime/release blockers closed; actual score `72/95` can be published; public 90/95 and external comparison claims still blocked. |
| GitHub launch pack | `PASS_GITHUB_ACTUAL_SCORE_RELEASE_READY` | Launch pack can publish the actual score with boundaries; it is not permission for 90/95 or external superiority claims. |
| Clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`; exact zip path, size, and SHA-256 are recorded in `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json` | Release candidate artifact exists and passed secret scan. |
| Fresh install smoke | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`; 8/8 commands passed | Clean export can install dependencies and run help/auth/doctor/provider smoke paths. |
| Brand / compatibility risk board | public surface blockers 0; runtime cleanup candidates 0 | Public release surface is clean for current brand/compatibility policy. |
| Public-comparable SWE lane | `CRASH` in `docs/generated/DSXU_SWE_BENCH_RESULTS_20260520.json` | External/raw-evidence lane is not closed and cannot be cited as score. |

## Hard Rules

- Do publish only the actual evidenced score when `actualScoreClaimAllowed=true`; currently that score is `72/95`.
- Do not publish a 90/95-point claim until the corresponding high-score gate is true.
- Do not publish external superiority claims without same-task external raw transcripts.
- Do not include `.env`, `.dsxu`, `.git`, `node_modules`, `outputs`, or user runtime secrets in release artifacts.
- Do not include internal DSXU audit, owner-review, generated evidence, or local absolute-path material in release artifacts unless it is rewritten into a curated public document.
- Do not ship reference product branding or copied commercial behavior as a DSXU feature.
- Do not let internal historical audit names become public product feature names.
- Public docs should use stable aliases such as `release:*`, `acceptance:*`, `benchmark:*`, and `evidence:*`; historical versioned scripts may remain only as reproducibility shims.
