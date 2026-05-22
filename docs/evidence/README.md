# DSXU Evidence Index

This directory is the stable place for future dated evidence packs. Existing generated reports currently remain in `docs/generated` to preserve references and avoid destructive moves during the current release cleanup.

## Evidence Discipline

- Evidence may mention historical version names.
- Product docs should use capability names instead of version names.
- A PASS must have source truth, runnable tests, raw transcript or tool trace, and a clear release/claim decision.
- Owner-disposition is not feature parity.
- Readiness is not live acceptance.
- Live model judgment is not enough without source truth and local regression.

## Current High-Value Evidence

| Evidence | Meaning |
|---|---|
| `evidence:c2-1902-join` | 1902-file owner/evidence join; not feature parity. |
| `evidence:c2-capability-loss-board` | Capability-loss review queue for product-specific/shared utility rows. |
| `evidence:naming-governance` | Historical version naming governance board. |
| `acceptance:c2-loop` | 51/51 experience-loop behavior acceptance. |
| `acceptance:senior-coding-window` | 30.48-minute real senior-coding window evidence: 33 DSXU product-entry runs, 32 structured review rounds, final fixture test passed, Flash-only, about $0.3617. |
| `test:six-stage-final` | 22/22 command batches passed across function, experience, recovery, performance, evaluation, and release-closure stages. |
| `test:dsxu:release` | 531 pass / 0 fail release-surface and claim-boundary proof after V2/V3 closeout. |
| `training:v1` | PASS, 23 steps, 13 gates passed, 0 failed; internal training/evidence pipeline only. |
| `training:v2` | PASS internal evidence flywheel; uses DSXU evidence/trajectory plumbing and remains non-public-claim evidence. |
| `v2/v3 finalization closeout` | `PASS_30_CASE_PUBLIC_COMPARABLE_RAW_EVIDENCE_READY`; original 14 non-pass subset closed 14/14, remaining 16 raw API baseline captured 16/16, 30/30 DSXU raw evidence ready. |
| `cache:live-ab` | `PASS_CACHE_LIVE_AB`; controlled repeated stable-prefix lane reached 99.6% cache hit after warmup, internal tuning proof only. |
| `public feature/test matrix` | `docs/product/DSXU_PUBLIC_FEATURE_TEST_MATRIX_20260522_CN.md` summarizes DSXU functions, DeepSeek-specific optimization, test counts, and claim boundaries for GitHub release pages. |
| `benchmark:swe-bench` internal smoke | 5/5 internal smoke passed; not a public SWE benchmark score. |
| `benchmark:swe-bench --mode public-comparable` | Latest candidate is blocked/crashed in `docs/generated/DSXU_SWE_BENCH_RESULTS_20260520.json`; it is not public score evidence. |
| `evidence:dashboard` | `trust=evidence-incomplete`, pass=159, fail=0, blocked=0, claimBlocked=1, notRun=0, scoreFloor=72, releaseClaimAllowed=false. |
| `release:github-launch-pack` | GitHub claim guard; currently blocks 95-point public claim. |
| `release:clean-export-artifact` | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`; exact zip path, size, and SHA-256 are recorded in `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json`; secret scan PASS. |
| `release:fresh-install-smoke` | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`; 8/8 commands passed from the clean export. |
| `evidence:brand-compat-risk` | `DONE_EVIDENCED`; public surface blockers 0 and runtime cleanup candidates 0 after the current public docs and scan-rule cleanup. |
