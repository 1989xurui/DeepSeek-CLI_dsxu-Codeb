# DSXU GitHub Open Source Launch Pack - 2026-05-15

Status: PASS_GITHUB_OPEN_SOURCE_PRODUCT_RELEASE_READY

Release recommendation: publish the open-source product capability pack; omit public score and external superiority claims

## Product Positioning

- DSXU Code is a DeepSeek-first open-source AI coding CLI/TUI for long-running engineering tasks.
- The product value is a dense engineering loop across goal retention, real file edits, permissions, tools, recovery, agents, cost controls, evidence, and release gates.
- The current public-safe claim is an open-source product release pack. Public score, external comparison, and leaderboard-style claims remain disabled by product policy until explicitly re-enabled with paired raw evidence.

## Data Charts

![DSXU routing mix](assets/dsxu-routing-mix.svg)

![DSXU acceptance evidence](assets/dsxu-acceptance-evidence.svg)

![DSXU release readiness](assets/dsxu-release-readiness.svg)

![DSXU public challenge ablation](assets/dsxu-public-challenge-ablation.svg)

## Public Claims Allowed

- Product release gate: open-source product capabilities may be published when productReleaseAllowed=true; public score and external-victory wording remain disabled.
- Flash-first routing catalog: 94/98 fixed cases default to deepseek-v4-flash.
- Six-stage final tests: 22/22 command batches passed.
- Real TUI acceptance: 7/7 scenarios passed, including permission fallback, recovery, background tasks, and model-task visibility.
- V2 runtime trust evidence: 4/4 focused checks passed for TUI resize, permission dialog stability, scrollback anchoring, and query-loop durable ledger.
- C2 public-claim boundary: 914 rows closed as DSXU-owned generic experience evidence, while reference-product parity remains forbidden.
- C2 owner implementation acceptance: 1096 implemented+tested, 601 adapted/excluded, 205 no-loss baseline, 0 needs real code/test.
- DeepSeek trajectory evidence: 3/3 Flash reviews include redacted request/tool/usage/cache trajectory paths.
- Public challenge ablation: score floor held 72->72; cost fell 0.0716986596->0.0089982368 USD; toolResultChars fell 316381->0.
- Senior coding window: 30.48 minutes, 33 DSXU dispatches, 32 sustained review rounds.
- Clean export: 14.71 MB zip, secret scan=PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT.
- Fresh install smoke: 28/28 passed, including no-key first-run guidance, help, doctor, MCP doctor, and provider gate checks.

## Public Claims Blocked

- Do not publish public score wording in this release: scoreFloor=72/95 is retained as internal evidence only; public95ClaimAllowed=false and actualScoreClaimAllowed=false.
- Do not claim high-cache ROI yet: ablation improved cache hit rate, but the dedicated high-cache ROI claim remains blocked until repeated public challenge evidence reaches the configured target.
- Do not claim external model/product superiority yet: fixed public tasks exist, but same-task external raw transcripts are not sufficient for a public win/loss claim.
- Do not describe the 1902 reference-file map as copied code, brand compatibility, or feature parity. It is only DSXU-owned experience-loop absorption and owner acceptance evidence.

## Data Still Needed

- none for product release when productReleaseAllowed=true; public score/external claims intentionally disabled
- same-task external comparison raw transcript/tool trace/final report evidence
- repeated cache ROI evidence before high-cache savings claim

## GitHub README Sections

- Product positioning: DeepSeek-first AI coding CLI/TUI for long-running engineering tasks.
- Core capabilities: Flash-first cost routing, real tool execution, permission and visible state, recovery and resume, agent lifecycle, MCP/skill registry, and evidence reports.
- Data pack: routing distribution, six-stage tests, TUI scenarios, senior coding window, clean export, and fresh install smoke.
- Cost evidence: show same-task ablation data as cost/tool-result reduction with quality held, not as a 95-point or external comparison claim.
- Install pack: copy `.env.example`, set `DSXU_API_KEY` or `DEEPSEEK_API_KEY`; first run without a key should guide users through `auth login`.
- Honest boundary: publish evidenced product capabilities only; do not write public scores, external superiority, or leaderboard-style claims.

## Evidence Files

- productBenchmark: D:\DSXU-code\docs\generated\DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json
- publicChallenge: D:\DSXU-code\docs\generated\DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json
- seniorWindow: D:\DSXU-code\docs\generated\DSXU_V24_SENIOR_CODING_WINDOW_20260515.json
- sixStage: D:\DSXU-code\docs\generated\DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json
- cleanExport: D:\DSXU-code\docs\generated\DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json
- freshSmoke: D:\DSXU-code\docs\generated\DSXU_FRESH_INSTALL_WINDOWS_SMOKE_20260522.json
- c2Loop: D:\DSXU-code\docs\generated\DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_20260515.json
- c2Closure: D:\DSXU-code\docs\generated\DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json
- c2OwnerAcceptance: D:\DSXU-code\docs\generated\DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json
- tui: D:\DSXU-code\docs\generated\DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json
- publicChallengeAblation: D:\DSXU-code\docs\generated\DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json
- finalPreflight: D:\DSXU-code\docs\generated\DSXU_V20_FINAL_PREFLIGHT_20260515.json
- v2RuntimeTrust: D:\DSXU-code\docs\generated\DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json
- publicComparableManifest: D:\DSXU-code\docs\generated\DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json
- publicComparableRawEvidence: D:\DSXU-code\docs\generated\DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json
