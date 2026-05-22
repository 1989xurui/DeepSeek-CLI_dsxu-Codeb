# DSXU Source Cache Acceptance - 20260516

Status: PASS_SOURCE_CACHE_ACCEPTANCE

## Result

- capsules: 2
- rawChars: 23169
- packedChars: 1360
- toolResultCharsAvoided: 21809
- compressionRatio: 0.059
- noReadDefault: true
- stablePrefixHashUnchanged: true
- dynamicTailHashChanged: true
- impactRadarStatus: IMPACT_RADAR_READY
- affectedTests: src/checkout.test.ts
- evidenceReviewStatus: EVIDENCE_REVIEW_READY
- evidenceReviewFindings: 5

## Read Fallback Decisions

| case | status | allowed | requested | recommended | tokens |
| --- | --- | --- | --- | --- | --- |
| full-read | BLOCK_FULL_FILE_READ | false | -:- | 1:160 | 5745 |
| unlocated-range | BLOCK_UNLOCATED_LARGE_READ | false | 1:160 | 1:160 | 1760 |
| bounded-range | ALLOW_BOUNDED_READ | true | 1:160 | 1:160 | 1760 |
| over-budget | BLOCK_OVER_BUDGET_READ | false | 1:400 | 1:160 | 4400 |

## Boundary

- This is DSXU code-mode source/cache mechanics evidence.
- It does not claim a live DeepSeek cache-hit percentage.
- Large-file Read remains fallback-only and must be locator/range bounded.
- Impact Radar and Evidence-Driven Review are schema evidence over the same code-mode owner, not a second reviewer runtime.
