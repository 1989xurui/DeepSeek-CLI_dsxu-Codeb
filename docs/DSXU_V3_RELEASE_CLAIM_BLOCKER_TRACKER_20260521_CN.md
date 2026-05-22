# DSXU V3 Release Claim Blocker Tracker - 2026-05-21

## Status

`READY_RELEASE_CLAIM_BLOCKER_TRACKER`

## Current Dashboard

| Metric | Value |
| --- | --- |
| trustState | evidence-incomplete |
| pass/fail/blocked/claimBlocked/info | 159/0/0/1/144 |
| publicComparableMissingCases | 0 |
| externalComparisonPendingCount | 1 |
| claimBlockedGateNames | DSXU_SWE_BENCH_RESULTS_20260520 |

## Closed Evidence

P12 target/reference readiness is PASS: p12Status=PASS, pairedRawLogCount=14/14.

P12 target/reference readiness is closed only for the P12 raw-readiness lane; it is not a substitute for public-comparable same-case targetReferenceTranscriptPath evidence.

## Remaining Public-Comparable External Target Evidence

Current rawRoot: `.dsxu/trace/public-comparable-raw-evidence`

| Case | Case Dir | Missing External Target Fields |
| --- | --- | --- |
| permission-deny-replan | `.dsxu/trace/public-comparable-raw-evidence/permission-deny-replan` | targetReferenceTranscriptPath |
| powershell-encoded-deny | `.dsxu/trace/public-comparable-raw-evidence/powershell-encoded-deny` | targetReferenceTranscriptPath |
| grep-glob-tool-choice | `.dsxu/trace/public-comparable-raw-evidence/grep-glob-tool-choice` | targetReferenceTranscriptPath |
| governance-query-recovery-live | `.dsxu/trace/public-comparable-raw-evidence/governance-query-recovery-live` | targetReferenceTranscriptPath |
| governance-skills-selection-live | `.dsxu/trace/public-comparable-raw-evidence/governance-skills-selection-live` | targetReferenceTranscriptPath |
| todo-task-closeout | `.dsxu/trace/public-comparable-raw-evidence/todo-task-closeout` | targetReferenceTranscriptPath |
| permission-matrix-contract | `.dsxu/trace/public-comparable-raw-evidence/permission-matrix-contract` | targetReferenceTranscriptPath |
| compact-state-preservation | `.dsxu/trace/public-comparable-raw-evidence/compact-state-preservation` | targetReferenceTranscriptPath |
| product-workflow-recovery-live | `.dsxu/trace/public-comparable-raw-evidence/product-workflow-recovery-live` | targetReferenceTranscriptPath |
| product-multifile-bugfix-live | `.dsxu/trace/public-comparable-raw-evidence/product-multifile-bugfix-live` | targetReferenceTranscriptPath |
| product-multistep-feature-live | `.dsxu/trace/public-comparable-raw-evidence/product-multistep-feature-live` | targetReferenceTranscriptPath |
| product-feature-tests-live | `.dsxu/trace/public-comparable-raw-evidence/product-feature-tests-live` | targetReferenceTranscriptPath |
| product-review-fix-live | `.dsxu/trace/public-comparable-raw-evidence/product-review-fix-live` | targetReferenceTranscriptPath |
| product-compact-resume-edit-live | `.dsxu/trace/public-comparable-raw-evidence/product-compact-resume-edit-live` | targetReferenceTranscriptPath |
| product-compact-two-phase-live | `.dsxu/trace/public-comparable-raw-evidence/product-compact-two-phase-live` | targetReferenceTranscriptPath |
| product-permission-deny-replan-live | `.dsxu/trace/public-comparable-raw-evidence/product-permission-deny-replan-live` | targetReferenceTranscriptPath |
| product-agent-worker-longrun-live | `.dsxu/trace/public-comparable-raw-evidence/product-agent-worker-longrun-live` | targetReferenceTranscriptPath |
| product-agent-failure-correction-live | `.dsxu/trace/public-comparable-raw-evidence/product-agent-failure-correction-live` | targetReferenceTranscriptPath |
| product-real-mcp-task-live | `.dsxu/trace/public-comparable-raw-evidence/product-real-mcp-task-live` | targetReferenceTranscriptPath |
| product-reality-large-feature-live | `.dsxu/trace/public-comparable-raw-evidence/product-reality-large-feature-live` | targetReferenceTranscriptPath |
| product-reality-review-fix-live | `.dsxu/trace/public-comparable-raw-evidence/product-reality-review-fix-live` | targetReferenceTranscriptPath |
| product-reality-second-failure-live | `.dsxu/trace/public-comparable-raw-evidence/product-reality-second-failure-live` | targetReferenceTranscriptPath |
| product-review-to-fix-live | `.dsxu/trace/public-comparable-raw-evidence/product-review-to-fix-live` | targetReferenceTranscriptPath |
| v8-real-review-fix | `.dsxu/trace/public-comparable-raw-evidence/v8-real-review-fix` | targetReferenceTranscriptPath |
| mutation-query-orphan-tool-use-deny-pass-live | `.dsxu/trace/public-comparable-raw-evidence/mutation-query-orphan-tool-use-deny-pass-live` | targetReferenceTranscriptPath |
| tool-prompt-read-edit-cache-golden | `.dsxu/trace/public-comparable-raw-evidence/tool-prompt-read-edit-cache-golden` | targetReferenceTranscriptPath |
| mutation-tool-prompt-read-edit-cache-live | `.dsxu/trace/public-comparable-raw-evidence/mutation-tool-prompt-read-edit-cache-live` | targetReferenceTranscriptPath |
| mutation-real-mcp-resource-guided-fix-live | `.dsxu/trace/public-comparable-raw-evidence/mutation-real-mcp-resource-guided-fix-live` | targetReferenceTranscriptPath |
| experience-permission-ux-live | `.dsxu/trace/public-comparable-raw-evidence/experience-permission-ux-live` | targetReferenceTranscriptPath |
| experience-agent-team-governance-live | `.dsxu/trace/public-comparable-raw-evidence/experience-agent-team-governance-live` | targetReferenceTranscriptPath |

## Public 95 Claim Boundary

| Field | Value |
| --- | --- |
| actualScoreClaimAllowed | true |
| actualScorePublicWording | DSXU public challenge score floor is 72/95 on the fixed evidenced task pack. |
| public95ClaimAllowed | false |
| scoreFloor | 72 |
| status | PASS_GITHUB_ACTUAL_SCORE_RELEASE_READY |
| blockedReason | actual score wording is allowed; keep 90/95/superiority claims disabled until the higher threshold and external evidence pass. |

## Next Actions

- Collect same-case external target/reference transcript files for 30 public-comparable case(s).
- Place each target/reference transcript in the matching caseDir using one of the requiredPerCaseFileCandidates names.
- Rerun: bun run evidence:public-comparable-raw
- Rerun: bun run release:github-launch-pack && bun run evidence:dashboard
- Do not fabricate target/reference logs and do not convert DSXU/raw-API evidence into target/reference evidence.

## Safeguards

- This tracker is a release-claim blocker tracker, not runtime evidence and not a score source.
- P12 readiness can close P12 raw-readiness but cannot unlock public-comparable external comparison without same-case targetReferenceTranscriptPath evidence.
- A PASS public-comparable raw import permits DSXU/raw-API evidence claims only; external comparison requires target/reference evidence.
- Actual score wording is allowed only when actualScoreClaimAllowed=true; do not round scoreFloor upward.
- Public 90/95/superiority claims stay blocked while scoreFloor and external comparison boundaries are not satisfied.
