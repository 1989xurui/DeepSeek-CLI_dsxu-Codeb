# DSXU Code Product Docs

DSXU Code is a DeepSeek-first AI coding CLI/TUI for long-running engineering tasks. The public product story must be evidence-backed: Flash-first routing, real tool execution, permission visibility, recovery, Agent/MCP ownership, cost reporting, and release hygiene are claims only when they have source truth, tests, live/TUI traces, and release evidence.

## Current Public Status

| Area | Status |
|---|---|
| Release posture | Open-source product release review is allowed; public score and external superiority wording remain disabled. |
| Current launch gate | `PASS_GITHUB_OPEN_SOURCE_PRODUCT_RELEASE_READY`; publish product capabilities only, with no score or external-win wording. |
| Current score floor | Internal audit evidence only; not a public/community selling point |
| Full repo regression | `3075` pass / `1` skip / `0` fail across `434` test files |
| Six-stage tests | `22/22` command batches passed |
| DSXU release gate tests | `531` pass / `0` fail after V2/V3 finalization closeout |
| TUI acceptance | `7/7` scenarios passed |
| Senior coding window | `30.48` minutes, `33` DSXU product-entry runs, `32` structured review rounds, final fixture test passed, Flash-only, about `$0.3617` |
| Training V1 reality run | PASS, `23` steps, `13` gates passed, `0` failed, `publicClaimAllowed=false` |
| Training V2 evidence flywheel | PASS internal flywheel; evidence/trajectory plumbing only, not a public training-quality claim |
| Latest real-task hit-rate pack | `24/24` final PASS, `0%` first-attempt PASS, `100%` second-attempt recovery, Flash-only, `64.1%` cache hit |
| Internal replay hit-rate gate | `100/100` final PASS, `100%` tool hit, `100%` recovery success, `80.7%` average cache hit, `9/9` justified Pro admissions |
| SWE internal smoke | `5/5` internal smoke instances passed; public SWE score remains blocked |
| V10 final reality evidence | reachability, golden replay 77 cases, ablation, long task, provider dry smoke, agent/tool pairing, cache/cost, localized feedback, TUI trust surface, final dashboard all PASS |
| V2/V3 finalization closeout | Original `14/14` non-pass subset closed, remaining `16/16` raw API baseline captured, `30/30` DSXU raw evidence ready |
| Cache live A/B | `PASS_CACHE_LIVE_AB`; repeated stable-prefix lane hit `99.6%` on rounds 2/3, internal tuning proof only |
| P12 raw readiness | PASS, `14/14` paired raw logs for the P12 readiness lane |
| Evidence dashboard | `trust=ready-for-release-review`, productReleaseAllowed=`true`, externalClaimAllowed=`false`, releaseClaimAllowed=`false` |
| Public comparable DSXU lane | `30/30` DSXU raw evidence ready; external target/reference transcripts still missing, so external comparison remains blocked |
| V8/V10 final acceptance | PASS for DSXU-owned final reality lanes; public external benchmark remains blocked until paired target/reference evidence exists |
| Release/export public surface policy | Focused release-surface tests pass; public docs/assets are separated from internal audit/generated evidence docs |
| Clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`; exact zip path, size, and SHA-256 are recorded in `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json`; secret scan PASS |
| Fresh install smoke | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`; 8/8 commands passed from the clean export |
| Brand / compatibility risk board | `DONE_EVIDENCED`; public surface blockers `0`, runtime cleanup candidates `0` |

## Claim Rules

- Allowed: DeepSeek-first, Flash-first, release-candidate/product-release review, evidence-backed demo pack, release/export public surface policy, real TUI acceptance, senior coding window, training/evidence pipeline proof, DSXU release gate proof, and internal replay/SWE-smoke evidence with explicit claim boundaries.
- Blocked: public score wording from internal score-floor evidence, rounded-up completion scores, external product/model superiority, copied reference feature parity, brand compatibility claims, or any claim not backed by DSXU-owned evidence.
- Blocked: public SWE benchmark score; the latest SWE public-comparable lane is a blocked/crashed raw-evidence candidate, not a result.
- Separate benchmark workstream: the 30-case DSXU raw lane is ready, but same-case external target/reference transcripts must be collected before any external comparison claim.
- Roadmap-only: VS Code/API bridge, Desktop/App suite, Voice/Buddy/Team, full external benchmark claims, and complete first-run key wizard until release evidence closes them.

## Stable Reading Order

1. Public product overview: `README.md`
2. Product docs: `docs/product/README.md`
3. GitHub open-source release page draft: `docs/product/OPEN_SOURCE_RELEASE_PAGE_20260521_CN.md`
4. Release gate: `docs/release/README.md`
5. Evidence index: `docs/evidence/README.md`
6. Public function/test matrix: `docs/product/DSXU_PUBLIC_FEATURE_TEST_MATRIX_20260522_CN.md`
7. Stable commands: `release:*`, `acceptance:*`, `benchmark:*`, and `evidence:*`

Historical versioned documents remain audit evidence. They should not be copied wholesale into GitHub-facing product pages.

Public product docs should prefer stable capability terms such as work-state timeline, DeepSeek route meter, tool lifecycle evidence, release claim guard, and reference capability-loss board. Historical version names are allowed only inside evidence references.
