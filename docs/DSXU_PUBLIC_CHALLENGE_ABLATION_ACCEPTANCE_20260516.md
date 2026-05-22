# DSXU Public Challenge Ablation Acceptance - 2026-05-16

Status: `PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE`

This report closes E02 as a same-task before/after ablation acceptance. It does not create an external benchmark runtime and does not claim external comparison win.

## Before / After

| metric | before | after | delta |
|---|---:|---:|---:|
| scoreFloor | 72 | 72 | 0 |
| totalCostUSD | 0.0716986596 | 0.0089982368 | -0.0627004228 |
| costSavingsPct | 0 | 87.4 | 87.4 |
| cacheHitRatePct | 45.5 | 66.8 | 21.3 |
| readToolCallCount | 28 | 0 | -28 |
| toolResultChars | 316381 | 0 | -316381 |
| proRequestCount | 6 | 0 | -6 |
| maxUniqueSystemHashCount | 2 | 1 | -1 |

## Gates

| gate | pass |
|---|---:|
| sameReviewIds | true |
| afterAllPassed | true |
| scoreFloorNotLower | true |
| costReduced | true |
| cacheHitRateNotLower | true |
| readToolCallsReduced | true |
| toolResultCharsReduced | true |
| proUsageRemoved | true |
| systemPromptStable | true |

## Claim Boundary

- ablationRunnerAllowed: `true`
- observedCacheTrendAllowed: `true`
- highCacheRoiAllowed: `false`
- externalComparisonAllowed: `false`
- public90Allowed: `false`

Blocked claims:

- Do not claim external comparison win without same-task target-reference raw transcripts and target manifest intake.
- Do not claim public 90% top-tier coding/complex-task ability from this internal ablation board.
- Do not claim high-cache ROI until the public challenge lane reaches the configured cache target with repeated evidence.
- Do not claim copied reference-product parity, standalone benchmark runtime, or standalone tool/provider/MCP runtime.

## Evidence

- currentPackage: `docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json`
- currentPackageStatus: `PASS_PUBLIC_CHALLENGE_PACKAGE_READY`
- before trajectories: `.dsxu/trace/v24-public-challenge-package/flash-public-claim-guard-review-2026-05-16T02-30-16-637Z.trajectory.jsonl`, `.dsxu/trace/v24-public-challenge-package/flash-senior-coding-experience-review-2026-05-16T02-30-58-996Z.trajectory.jsonl`, `.dsxu/trace/v24-public-challenge-package/flash-release-ecosystem-review-2026-05-16T02-31-44-887Z.trajectory.jsonl`
- after trajectories: `.dsxu/trace/v24-public-challenge-package/flash-public-claim-guard-review-2026-05-16T15-40-15-148Z.trajectory.jsonl`, `.dsxu/trace/v24-public-challenge-package/flash-senior-coding-experience-review-2026-05-16T15-40-50-357Z.trajectory.jsonl`, `.dsxu/trace/v24-public-challenge-package/flash-release-ecosystem-review-2026-05-16T15-41-34-585Z.trajectory.jsonl`
