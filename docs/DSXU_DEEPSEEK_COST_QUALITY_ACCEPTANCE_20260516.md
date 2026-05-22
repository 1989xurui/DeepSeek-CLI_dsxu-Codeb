# DSXU DeepSeek Cost Quality Acceptance - 20260516

Status: PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE

## Board

- scenarios: 4
- solvedScenarioCount: 4
- totalTurnCount: 10
- flashTurnRatioPct: 90
- proTurnRatioPct: 10
- cacheHitRatePct: 75.3
- totalCostUsd: 0.013906969
- proOnlyCostUsd: 0.037872826
- savingsVsProOnlyPct: 63.3
- public90ClaimAllowed: false
- cacheHighRoiClaimAllowed: false
- flashFirstCostClaimAllowed: true
- proAdmissionClaimAllowed: true

## Scenario Rows

| id | source | solved | turns | flash % | pro % | cache hit % | cost | pro-only | savings % | claim |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| v19_phase5_fresh_non22_bugfix_recovery | controlled-local-harness | true | 4 | 75 | 25 | 85.3 | 0.00381858 | 0.007122038 | 46.4 | ALLOWED |
| v19_phase5_flash_only_success_non22_feature | controlled-local-harness | true | 3 | 100 | 0 | 86.5 | 0.00106624 | 0.00317695 | 66.4 | ALLOWED |
| public-challenge-flash-review | public-challenge | true | 1 | 100 | 0 | 66.8 | 0.008998237 | 0.027519028 | 67.3 | TREND_ONLY |
| v19_phase5_live_provider_cache_prefix_billing | live-provider | true | 2 | 100 | 0 | 98.7 | 0.000023912 | 0.00005481 | 56.4 | ALLOWED |

## Allowed Claims

- Flash-first route/cost claim allowed: 90% turns on Flash/Flash-MAX; cost $0.013906969 vs Pro-only $0.037872826.
- Pro admission claim allowed for evidenced rescue nodes only: every Pro turn has prior Flash attempt, admission reason, and saved-task evidence.

## Trend-Only / Blocked Claims

- Cache optimization is trend-only: aggregate hit rate 75.3%; use observed values, not a high-ROI claim.
- Public 90% top-tier coding/complex-task ability claim remains blocked until fixed raw task score floor reaches around 90.
- Do not claim public 90% coding/complex-task ability from this board.
- Do not claim high cache ROI; publish exact observed cache hit rates and before/after trend only.

## Boundary

- This board proves DSXU DeepSeek route/cost/cache evidence, not public 90% ability.
- Cache hit rate is reported as an observed metric and trend unless the public/live scenario reaches the target with stable prefix evidence.
- Pro use is sellable only as an admission-controlled rescue path with prior Flash attempt and saved-task evidence.
