# Pipeline support owner review - 20260517

## Decision

- Overall: `PASS`
- Blocked package exposures: 0
- Rule: Pipeline support modules must fold into DSXU owners: Tool Gate / VerificationKernel, Evidence / Release Claim Binder, and DeepSeek route/cost/cache. They must not create package-level product entries, second runtimes, or public claims without raw evidence.

## Package Exposure Check

- PASS: no blocked package scripts are exposed.

## Owner Rows

| id | owner | status | decision | external runtime refs | external script refs | external test refs |
|---|---|---|---|---:|---:|---:|
| `evidence-dashboard` | Evidence / Release Claim Binder | `PASS` | `KEEP_AS_RELEASE_CLAIM_BINDER_INPUT` | 0 | 6 | 0 |
| `cache-warm-planning` | DeepSeek route/cost/cache | `PASS` | `KEEP_AS_DEEPSEEK_CACHE_PLANNING_SUPPORT` | 0 | 2 | 0 |
| `runtime-health` | Release / Tool Gate health evidence | `PASS` | `KEEP_AS_FOCUSED_OWNER_REVIEW_HEALTH_HELPER` | 0 | 6 | 0 |
| `static-analysis-tool-gate` | Tool Gate / VerificationKernel | `PASS` | `KEEP_AS_FILE_WRITE_EDIT_TOOL_GATE_SUPPORT` | 6 | 2 | 3 |
| `tdd-post-mutation-gate` | Tool Gate / VerificationKernel | `PASS` | `KEEP_AS_POST_MUTATION_VERIFICATION_SUPPORT` | 4 | 3 | 4 |
| `post-mutation-envelope` | Tool Gate / VerificationKernel visible evidence | `PASS` | `KEEP_AS_VISIBLE_TOOL_GATE_EVIDENCE_ENVELOPE` | 5 | 1 | 3 |

## Boundaries

- `evidence-dashboard`: Aggregates explicit evidence only; it must not derive scoreFloor from pass rate or promote internal smoke results to public claims.
- `cache-warm-planning`: Default mode is planning/dry-run; no cache-hit improvement or cost-saving claim is allowed without real before/after trajectory evidence.
- `runtime-health`: Focused helper for owner review and preflight. The public release health entry remains audit:dsxu:health, not a second runtime entry.
- `static-analysis-tool-gate`: Static analysis is invoked only through FileWrite/FileEdit Tool Gate evidence and tests; it is not a standalone permission or verification runtime.
- `tdd-post-mutation-gate`: Default semantics are post-mutation verification. Full red/green TDD requires an explicit pre-edit test contract and cannot be claimed from write-after hooks.
- `post-mutation-envelope`: Formats static-analysis and post-mutation outcomes into one evidence envelope; it must remain a projection of Tool Gate state, not a new gate stack.

## External References

### evidence-dashboard

- script: `scripts/dsxu-legacy-swe-owner-review.ts:49` - `docs/generated/DSXU_EVIDENCE_DASHBOARD_${DATE}.json`,
- script: `scripts/dsxu-pipeline-support-owner-review.ts:36` - artifacts: ['scripts/dsxu-evidence-dashboard.ts'],
- script: `scripts/dsxu-pipeline-support-owner-review.ts:37` - patterns: ['dsxu-evidence-dashboard', 'aggregateEvidence', 'DSXU_EVIDENCE_DASHBOARD_'],
- script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:9` - import { aggregateEvidence } from './dsxu-evidence-dashboard'
- script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:34` - evidenceDashboard: join(GENERATED_DIR, `DSXU_EVIDENCE_DASHBOARD_${DASHBOARD_STAMP}.json`),
- script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:154` - const evidenceDashboard = await aggregateEvidence(GENERATED_DIR, evidencePaths.evidenceDashboard)
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:70` - - `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260517.json`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:265` - scripts/dsxu-evidence-dashboard.ts  ← CREATE: aggregate all evidence JSONs into a dashboard
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:268` - ### 4a. `scripts/dsxu-evidence-dashboard.ts`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:301` - export function aggregateEvidence(): EvidenceDashboard {
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:305` - // 4. Write docs/generated/DSXU_EVIDENCE_DASHBOARD_{date}.json
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:310` - const dashboard = aggregateEvidence();
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:320` - bun run scripts/dsxu-evidence-dashboard.ts
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:548` - "evidence:dashboard": "bun run scripts/dsxu-evidence-dashboard.ts",
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:37` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:49` - `docs/generated/DSXU_EVIDENCE_DASHBOARD_${DATE}.json`,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:38` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:36` - artifacts: ['scripts/dsxu-evidence-dashboard.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:39` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:37` - patterns: ['dsxu-evidence-dashboard', 'aggregateEvidence', 'DSXU_EVIDENCE_DASHBOARD_'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:40` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:9` - import { aggregateEvidence } from './dsxu-evidence-dashboard'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:41` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:34` - evidenceDashboard: join(GENERATED_DIR, `DSXU_EVIDENCE_DASHBOARD_${DASHBOARD_STAMP}.json`),
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:42` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:154` - const evidenceDashboard = await aggregateEvidence(GENERATED_DIR, evidencePaths.evidenceDashboard)
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:43` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:70` - - `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260517.json`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:44` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:265` - scripts/dsxu-evidence-dashboard.ts  ← CREATE: aggregate all evidence JSONs into a dashboard
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:45` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:268` - ### 4a. `scripts/dsxu-evidence-dashboard.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:46` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:301` - export function aggregateEvidence(): EvidenceDashboard {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:47` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:305` - // 4. Write docs/generated/DSXU_EVIDENCE_DASHBOARD_{date}.json
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:48` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:310` - const dashboard = aggregateEvidence();
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:49` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:320` - bun run scripts/dsxu-evidence-dashboard.ts
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:50` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:548` - "evidence:dashboard": "bun run scripts/dsxu-evidence-dashboard.ts",
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:51` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:37` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:49` - `docs/generated/DSXU_EVIDENCE_DASHBOARD_${DATE}.json`,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:52` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:38` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:36` - artifacts: ['scripts/dsxu-evidence-dashboard.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:53` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:39` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:37` - patterns: ['dsxu-evidence-dashboard', 'aggregateEvidence', 'DSXU_EVIDENCE_DASHBOARD_'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:54` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:40` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:9` - import { aggregateEvidence } from './dsxu-evidence-dashboard'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:55` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:41` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:34` - evidenceDashboard: join(GENERATED_DIR, `DSXU_EVIDENCE_DASHBOARD_${DASHBOARD_STAMP}.json`)
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:56` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:42` - - script: `scripts/dsxu-v24-product-benchmark-data-pack.ts:154` - const evidenceDashboard = await aggregateEvidence(GENERATED_DIR, evidencePaths.evidenceD
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:57` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:43` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:70` - - `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260517.json`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:58` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:44` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:265` - scripts/dsxu-evidence-dashboard.ts  ← CREATE: aggregate all evidence JSONs into a dashboard
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:59` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:45` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:268` - ### 4a. `scripts/dsxu-evidence-dashboard.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:60` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:46` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:301` - export function aggregateEvidence(): EvidenceDashboard {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:61` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:47` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:305` - // 4. Write docs/generated/DSXU_EVIDENCE_DASHBOARD_{date}.json
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:62` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:48` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:310` - const dashboard = aggregateEvidence();

### cache-warm-planning

- script: `scripts/dsxu-pipeline-support-owner-review.ts:46` - artifacts: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
- script: `scripts/dsxu-pipeline-support-owner-review.ts:47` - patterns: ['cache-warmer', 'CacheWarmer', 'defaultCacheWarmPrefixes', 'dsxu-cache-warm'],
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:338` - src/services/cache-warmer.ts           ← CREATE: warming logic
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:339` - scripts/dsxu-cache-warm.ts             ← CREATE: CLI entrypoint
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:342` - ### 5a. `src/services/cache-warmer.ts`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:364` - export class CacheWarmer {
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:384` - const warmer = new CacheWarmer(provider);
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:400` - bun run scripts/dsxu-cache-warm.ts --dry-run
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:550` - "cache:warm": "bun run scripts/dsxu-cache-warm.ts"
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:80` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:46` - artifacts: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:81` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:47` - patterns: ['cache-warmer', 'CacheWarmer', 'defaultCacheWarmPrefixes', 'dsxu-cache-warm'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:82` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:338` - src/services/cache-warmer.ts           ← CREATE: warming logic
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:83` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:339` - scripts/dsxu-cache-warm.ts             ← CREATE: CLI entrypoint
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:84` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:342` - ### 5a. `src/services/cache-warmer.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:85` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:364` - export class CacheWarmer {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:86` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:384` - const warmer = new CacheWarmer(provider);
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:87` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:400` - bun run scripts/dsxu-cache-warm.ts --dry-run
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:88` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:550` - "cache:warm": "bun run scripts/dsxu-cache-warm.ts"
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:89` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:80` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:46` - artifacts: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:90` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:81` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:47` - patterns: ['cache-warmer', 'CacheWarmer', 'defaultCacheWarmPrefixes', 'dsxu-cache-warm'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:91` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:82` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:338` - src/services/cache-warmer.ts           ← CREATE: warming logic
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:92` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:83` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:339` - scripts/dsxu-cache-warm.ts             ← CREATE: CLI entrypoint
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:93` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:84` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:342` - ### 5a. `src/services/cache-warmer.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:94` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:85` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:364` - export class CacheWarmer {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:95` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:86` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:384` - const warmer = new CacheWarmer(provider);
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:96` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:87` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:400` - bun run scripts/dsxu-cache-warm.ts --dry-run
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:97` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:88` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:550` - "cache:warm": "bun run scripts/dsxu-cache-warm.ts"
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:98` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:89` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:80` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:46` - artifacts: ['src/services
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:99` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:90` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:81` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:47` - patterns: ['cache-warmer'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:100` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:91` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:82` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:338` - src/services/cache-warmer.ts
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:101` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:92` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:83` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:339` - scripts/dsxu-cache-warm.ts  
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:102` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:93` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:84` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:342` - ### 5a. `src/services/cache-
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:103` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:94` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:85` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:364` - export class CacheWarmer {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:104` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:95` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:86` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:384` - const warmer = new CacheWarm
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:105` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:96` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:87` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:400` - bun run scripts/dsxu-cache-w
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:106` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:97` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:88` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:550` - "cache:warm": "bun run scrip
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:108` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:99` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:90` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:81` - - script: `scripts/dsx
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:109` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:100` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:91` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:82` - - doc: `docs/DSXU_OPT
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:110` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:101` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:92` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:83` - - doc: `docs/DSXU_OPT
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:112` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:103` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:94` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:85` - - doc: `docs/DSXU_OPT

### runtime-health

- script: `scripts/dsxu-dag-owner-review.ts:174` - 'bun run scripts/dsxu-runtime-health.ts',
- script: `scripts/dsxu-dag-owner-review.ts:179` - 'bun run scripts/dsxu-runtime-health.ts',
- script: `scripts/dsxu-legacy-swe-owner-review.ts:178` - 'bun run scripts/dsxu-runtime-health.ts',
- script: `scripts/dsxu-legacy-swe-owner-review.ts:183` - 'bun run scripts/dsxu-runtime-health.ts',
- script: `scripts/dsxu-pipeline-support-owner-review.ts:56` - artifacts: ['src/services/health', 'scripts/dsxu-runtime-health.ts'],
- script: `scripts/dsxu-pipeline-support-owner-review.ts:57` - patterns: ['src/services/health', 'runHealthChecks', 'createDefaultHealthChecks', 'dsxu-runtime-health'],
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:131` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:136` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:86` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:91` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:485` - src/services/health/      ← CREATE directory
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:490` - scripts/dsxu-runtime-health.ts  ← CREATE: CLI entrypoint
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:493` - ### 7a. `src/services/health/contract.ts`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:517` - ### 7b. `src/services/health/checks.ts`
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:534` - bun run scripts/dsxu-runtime-health.ts
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:549` - "health:runtime": "bun run scripts/dsxu-runtime-health.ts",
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:123` - - script: `scripts/dsxu-dag-owner-review.ts:174` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:124` - - script: `scripts/dsxu-dag-owner-review.ts:179` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:125` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:178` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:126` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:183` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:127` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:56` - artifacts: ['src/services/health', 'scripts/dsxu-runtime-health.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:128` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:57` - patterns: ['src/services/health', 'runHealthChecks', 'createDefaultHealthChecks', 'dsxu-runtime-health'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:129` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:131` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:130` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:136` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:131` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:86` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:132` - - doc: `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md:91` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:133` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:485` - src/services/health/      ← CREATE directory
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:134` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:490` - scripts/dsxu-runtime-health.ts  ← CREATE: CLI entrypoint
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:135` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:493` - ### 7a. `src/services/health/contract.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:136` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:517` - ### 7b. `src/services/health/checks.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:137` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:534` - bun run scripts/dsxu-runtime-health.ts
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:138` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:549` - "health:runtime": "bun run scripts/dsxu-runtime-health.ts",
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:139` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:123` - - script: `scripts/dsxu-dag-owner-review.ts:174` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:140` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:124` - - script: `scripts/dsxu-dag-owner-review.ts:179` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:141` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:125` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:178` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:142` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:126` - - script: `scripts/dsxu-legacy-swe-owner-review.ts:183` - 'bun run scripts/dsxu-runtime-health.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:143` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:127` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:56` - artifacts: ['src/services/health', 'scripts/dsxu-runtime-health.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:144` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:128` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:57` - patterns: ['src/services/health', 'runHealthChecks', 'createDefaultHealthChecks', 'dsxu-ru
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:145` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:129` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:76` - - `bun run scripts/dsxu-runtime-health.ts`
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:146` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:130` - - doc: `docs/DSXU_DAG_OWNER_REVIEW_20260517.md:81` - - `bun run scripts/dsxu-runtime-health.ts`

### static-analysis-tool-gate

- runtime: `src/services/health/checks.ts:36` - if (typeof mod.createStaticAnalysisBridge !== 'function') {
- runtime: `src/services/health/checks.ts:37` - throw new Error('createStaticAnalysisBridge missing');
- test: `src/services/static-analysis/__tests__/bridge.test.ts:5` - import { StaticAnalysisBridge, createStaticAnalysisBridge } from '../bridge';
- test: `src/services/static-analysis/__tests__/bridge.test.ts:159` - test('createStaticAnalysisBridge 应该创建实例', () => {
- test: `src/services/static-analysis/__tests__/bridge.test.ts:160` - const bridge = createStaticAnalysisBridge({ enabled: false });
- runtime: `src/tools/FileEditTool/FileEditTool.ts:9` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- runtime: `src/tools/FileEditTool/FileEditTool.ts:793` - const staticGateResult = await invokeStaticAnalysisToolGate({
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:10` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:362` - const staticGateResult = await invokeStaticAnalysisToolGate({
- script: `scripts/dsxu-pipeline-support-owner-review.ts:66` - artifacts: ['src/services/static-analysis/tool-gate.ts', 'src/services/static-analysis/bridge.ts'],
- script: `scripts/dsxu-pipeline-support-owner-review.ts:67` - patterns: ['invokeStaticAnalysisToolGate', 'createStaticAnalysisBridge', 'static-analysis/tool-gate'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:166` - - runtime: `src/services/health/checks.ts:36` - if (typeof mod.createStaticAnalysisBridge !== 'function') {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:167` - - runtime: `src/services/health/checks.ts:37` - throw new Error('createStaticAnalysisBridge missing');
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:168` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:5` - import { StaticAnalysisBridge, createStaticAnalysisBridge } from '../bridge';
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:169` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:159` - test('createStaticAnalysisBridge 应该创建实例', () => {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:170` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:160` - const bridge = createStaticAnalysisBridge({ enabled: false });
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:171` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:9` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:172` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:793` - const staticGateResult = await invokeStaticAnalysisToolGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:173` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:10` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:174` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:362` - const staticGateResult = await invokeStaticAnalysisToolGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:175` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:66` - artifacts: ['src/services/static-analysis/tool-gate.ts', 'src/services/static-analysis/bridge.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:176` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:67` - patterns: ['invokeStaticAnalysisToolGate', 'createStaticAnalysisBridge', 'static-analysis/tool-gate'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:177` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:166` - - runtime: `src/services/health/checks.ts:36` - if (typeof mod.createStaticAnalysisBridge !== 'function') {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:178` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:167` - - runtime: `src/services/health/checks.ts:37` - throw new Error('createStaticAnalysisBridge missing');
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:179` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:168` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:5` - import { StaticAnalysisBridge, createStaticAnalysisBridge } from '../bridge';
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:180` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:169` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:159` - test('createStaticAnalysisBridge 应该创建实例', () => {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:181` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:170` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:160` - const bridge = createStaticAnalysisBridge({ enabled: false });
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:182` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:171` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:9` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:183` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:172` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:793` - const staticGateResult = await invokeStaticAnalysisToolGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:184` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:173` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:10` - import { invokeStaticAnalysisToolGate } from '../../services/static-analysis/tool-gate.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:185` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:174` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:362` - const staticGateResult = await invokeStaticAnalysisToolGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:186` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:175` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:66` - artifacts: ['src/services/static-analysis/tool-gate.ts', 'src/services/static-analysis/bri
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:187` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:176` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:67` - patterns: ['invokeStaticAnalysisToolGate', 'createStaticAnalysisBridge', 'static-analysis/
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:188` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:177` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:166` - - runtime: `src/services/health/checks.ts:36` - if (typeof mod.createStaticAnalysisBri
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:189` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:178` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:167` - - runtime: `src/services/health/checks.ts:37` - throw new Error('createStaticAnalysisB
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:190` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:179` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:168` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:5` - import { StaticAna
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:191` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:180` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:169` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:159` - test('createStat
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:192` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:181` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:170` - - test: `src/services/static-analysis/__tests__/bridge.test.ts:160` - const bridge = c
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:193` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:182` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:171` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:9` - import { invokeStaticAnalysisT
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:194` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:183` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:172` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:793` - const staticGateResult = awa

### tdd-post-mutation-gate

- test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:4` - import { TddGate, invokePostWriteTddGate } from '../post-write-hook';
- test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:58` - const gate = new TddGate();
- test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:70` - const result = await invokePostWriteTddGate(
- test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:91` - const result = await invokePostWriteTddGate(
- runtime: `src/tools/FileEditTool/FileEditTool.ts:7` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- runtime: `src/tools/FileEditTool/FileEditTool.ts:803` - const tddGateResult = await invokePostWriteTddGate({
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:8` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:372` - const tddGateResult = await invokePostWriteTddGate({
- script: `scripts/dsxu-pipeline-support-owner-review.ts:76` - artifacts: ['src/coordinator/tdd-gate/post-write-hook.ts', 'src/coordinator/tdd-gate/index.ts'],
- script: `scripts/dsxu-pipeline-support-owner-review.ts:77` - patterns: ['invokePostWriteTddGate', 'TddGate', 'coordinator/tdd-gate/post-write-hook'],
- script: `scripts/dsxu-root-tdd-owner-review.ts:33` - 'src/coordinator/tdd-gate/post-write-hook.ts',
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:164` - ### 2a. Add `TddGate.invoke()` call after Write/Edit
- doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:171` - const tddGate = new TddGate(config);
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:209` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:4` - import { TddGate, invokePostWriteTddGate } from '../post-write-hook';
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:210` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:58` - const gate = new TddGate();
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:211` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:70` - const result = await invokePostWriteTddGate(
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:212` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:91` - const result = await invokePostWriteTddGate(
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:213` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:7` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:214` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:803` - const tddGateResult = await invokePostWriteTddGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:215` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:8` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:216` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:372` - const tddGateResult = await invokePostWriteTddGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:217` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:76` - artifacts: ['src/coordinator/tdd-gate/post-write-hook.ts', 'src/coordinator/tdd-gate/index.ts'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:218` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:77` - patterns: ['invokePostWriteTddGate', 'TddGate', 'coordinator/tdd-gate/post-write-hook'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:219` - - script: `scripts/dsxu-root-tdd-owner-review.ts:33` - 'src/coordinator/tdd-gate/post-write-hook.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:220` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:164` - ### 2a. Add `TddGate.invoke()` call after Write/Edit
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:221` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:171` - const tddGate = new TddGate(config);
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:222` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:209` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:4` - import { TddGate, invokePostWriteTddGate } from '../post-write-hook';
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:223` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:210` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:58` - const gate = new TddGate();
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:224` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:211` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:70` - const result = await invokePostWriteTddGate(
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:225` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:212` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:91` - const result = await invokePostWriteTddGate(
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:226` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:213` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:7` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:227` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:214` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:803` - const tddGateResult = await invokePostWriteTddGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:228` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:215` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:8` - import { invokePostWriteTddGate } from '../../coordinator/tdd-gate/post-write-hook.js'
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:229` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:216` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:372` - const tddGateResult = await invokePostWriteTddGate({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:230` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:217` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:76` - artifacts: ['src/coordinator/tdd-gate/post-write-hook.ts', 'src/coordinator/tdd-gate/index
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:231` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:218` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:77` - patterns: ['invokePostWriteTddGate', 'TddGate', 'coordinator/tdd-gate/post-write-hook'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:232` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:219` - - script: `scripts/dsxu-root-tdd-owner-review.ts:33` - 'src/coordinator/tdd-gate/post-write-hook.ts',
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:233` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:220` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:164` - ### 2a. Add `TddGate.invoke()` call after Write/Edit
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:234` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:221` - - doc: `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md:171` - const tddGate = new TddGate(config);
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:236` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:223` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:209` - - test: `src/coordinator/tdd-gate/__tests__/gate.test.ts:4` - import { TddGate, invoke

### post-mutation-envelope

- test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:3` - buildPostMutationVerificationEnvelope,
- test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:9` - const envelope = buildPostMutationVerificationEnvelope({
- test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:42` - const envelope = buildPostMutationVerificationEnvelope({
- runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationVerificationEnvelope !== 'function') {
- runtime: `src/tools/FileEditTool/FileEditTool.ts:4` - buildPostMutationVerificationEnvelope,
- runtime: `src/tools/FileEditTool/FileEditTool.ts:821` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:5` - buildPostMutationVerificationEnvelope,
- runtime: `src/tools/FileWriteTool/FileWriteTool.ts:389` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- script: `scripts/dsxu-pipeline-support-owner-review.ts:87` - patterns: ['buildPostMutationVerificationEnvelope', 'dsxu.post-mutation-verification.v1'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:252` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:3` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:253` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:9` - const envelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:254` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:42` - const envelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:255` - - runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationVerificationEnvelope !== 'function') {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:256` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:4` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:257` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:821` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:258` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:5` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:259` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:389` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:260` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:87` - patterns: ['buildPostMutationVerificationEnvelope', 'dsxu.post-mutation-verification.v1'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:261` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:252` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:3` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:262` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:253` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:9` - const envelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:263` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:254` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:42` - const envelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:264` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:255` - - runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationVerificationEnvelope !== 'function') {
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:265` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:256` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:4` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:266` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:257` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:821` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:267` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:258` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:5` - buildPostMutationVerificationEnvelope,
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:268` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:259` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:389` - const verificationEnvelope = buildPostMutationVerificationEnvelope({
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:269` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:260` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:87` - patterns: ['buildPostMutationVerificationEnvelope', 'dsxu.post-mutation-verification.v1'],
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:270` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:263` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:252` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:3` - bu
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:271` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:264` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:253` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:9` - co
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:272` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:265` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:254` - - test: `src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts:42` - c
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:273` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:266` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:255` - - runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationV
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:274` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:267` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:256` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:4` - buildPostMutationVerificationE
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:275` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:268` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:257` - - runtime: `src/tools/FileEditTool/FileEditTool.ts:821` - const verificationEnvelope =
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:276` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:269` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:258` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:5` - buildPostMutationVerificatio
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:277` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:270` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:259` - - runtime: `src/tools/FileWriteTool/FileWriteTool.ts:389` - const verificationEnvelope
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:278` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:271` - - doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:260` - - script: `scripts/dsxu-pipeline-support-owner-review.ts:87` - patterns: ['buildPostMu
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:288` - - doc: `docs/DSXU_V26_MASTER_PLAN_20260515.md:3513` - \\| Static analysis / TDD \\| `invokeStaticAnalysisToolGate`、`invokePostWriteTddGate`、`buildPostMutationVerificationEnvelope` 只通过 FileWrite/FileEdit Tool Gate 进入主线；默认 T
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:289` - - generated-evidence: `docs/generated/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.json:2777` - "excerpt": "- runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationVerificationEnvelope !== 'fu
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:290` - - generated-evidence: `docs/generated/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.json:2783` - "excerpt": "- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:255` - - runtime: `src/services/health/checks.ts:28` 
- doc: `docs/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.md:291` - - generated-evidence: `docs/generated/DSXU_PIPELINE_SUPPORT_OWNER_REVIEW_20260517.json:3257` - "excerpt": "\"excerpt\": \"- runtime: `src/services/health/checks.ts:28` - if (typeof envelope.buildPostMutationVerificationE

## Next Action

Proceed to next owner packet or real-window/final test gates; keep deletion or package exposure changes behind explicit owner/Git authorization.
