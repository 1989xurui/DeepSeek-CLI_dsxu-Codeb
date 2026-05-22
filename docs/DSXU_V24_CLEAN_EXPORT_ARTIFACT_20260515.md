# DSXU V24 Clean Export Artifact - 2026-05-15

Status: PASS_CLEAN_EXPORT_ARTIFACT_CREATED

Export dir: D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-22T00-01-03-492Z

Zip: D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-22T00-01-03-492Z.zip

Zip SHA256: 05d5baea52b0714ec125a2f2e6dcf74848d402ae84c5e02a9bd6a2732ce4b5e3

Files: 3122

Zip bytes: 15124683

## Secret Scan

Status: PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT

Active env secret names checked: DEEPSEEK_API_KEY

Matched env secret names in export: none

## Release Surface Policy

Status: PASS_RELEASE_SURFACE_POLICY_APPLIED

Candidate files: 3824

Shipped files: 3122

Excluded files: 702

Internal evidence excluded: 625

Public docs/assets shipped: 17

### Sample Excluded Internal Evidence

- docs/DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_20260516.md
- docs/DSXU_ARCHIVE_WATCHLIST_20260519.md
- docs/DSXU_BLOCKED_CLAIM_CORPUS_20260517.md
- docs/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md
- docs/DSXU_CACHE_HIT_CLOSURE_20260521_CN.md
- docs/DSXU_CAPABILITY_ACCEPTANCE_AUDIT_20260516.md
- docs/DSXU_CAPABILITY_COST_CROSSWALK_20260516.md
- docs/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.md
- docs/DSXU_CLAIM_BOUNDARY_GATE_20260519.md
- docs/DSXU_COMMAND_CATALOG_20260518.md
- docs/DSXU_DAG_OWNER_REVIEW_20260517.md
- docs/DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_20260516.md
- docs/DSXU_DELETE_REVIEW_BOARD_20260519.md
- docs/DSXU_DOC_SIGNAL_EXTRACTION_20260519.md
- docs/DSXU_DOCS_TRUTH_REGISTRY_20260519.md
- docs/DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_20260516.md
- docs/DSXU_FINAL_REALITY_RUN_PLAN_20260520_CN.md
- docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache-visible-product-timeline-release-claim-evidence-binder.md
- docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache.md
- docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.md
- docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.md
- docs/DSXU_KARPATHY_SKILLS_ABSORPTION_PLAN_20260517.md
- docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md
- docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md
- docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md
- docs/DSXU_PROMPT_INPUT_ALLOWLIST_20260519.md
- docs/DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.md
- docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md
- docs/DSXU_RAW_API_VS_DSXU_AB_20260516.md
- docs/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.md

## Required Exclusions

- .git
- .dsxu
- node_modules
- outputs
- .env/.env.* except .env.example
- .trash
- .dsevo
- tmp
- internal DSXU planning/audit/owner-review docs
- docs/generated evidence corpus

## Gate Evidence

- clean export preflight: PASS_READY_TO_CREATE_CLEAN_EXPORT
- six-stage final tests: PASS_V24_SIX_STAGE_FINAL_TESTS
- product benchmark/demo data: PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY

## Rule

This script creates a release artifact outside the source tree by default. It does not stage, commit, delete, reset, clean source files, or include local evidence/dependency directories.
