# DSXU V26 Naming Governance Board - 20260515

Status: PASS_NAMING_GOVERNANCE_READY

## Summary

| key | value |
| --- | --- |
| scannedFiles | 2964 |
| filesWithNamingSignals | 407 |
| productRuntimeSourceRows | 0 |
| productEvidenceSourceRows | 35 |
| testEvidenceSourceRows | 79 |
| integrationHarnessRows | 27 |
| renameCandidates | 0 |
| packageScriptsWithHistoricalSignals | 45 |
| packageScriptsMissingStableAlias | 0 |
| publicAssetRenameCandidates | 0 |
| aclResidueRows | 3 |

## By Surface

| surface | count |
| --- | --- |
| historical-evidence | 213 |
| test-evidence-source | 79 |
| automation-script | 40 |
| product-evidence-source | 35 |
| integration-evidence-harness | 27 |
| other | 9 |
| acl-residue | 3 |
| package-entry | 1 |

## By Severity

| severity | count |
| --- | --- |
| allowed-evidence | 213 |
| historical-test-copy | 79 |
| evidence-content-review | 35 |
| historical-harness-copy | 27 |
| historical-script-shim | 23 |
| watch-script-copy | 17 |
| ok | 9 |
| acl-external-closure | 3 |
| stable-alias-audited | 1 |

## Package Script Alias Status

| script | hasStableAlias | command |
| --- | --- | --- |
| owner-git:authorization-board | yes | bun run scripts/dsxu-v20-owner-git-authorization-board.ts |
| v20:six-stage-plan | yes | bun run scripts/dsxu-v20-six-stage-test-plan.ts |
| v20:final-preflight | yes | bun run scripts/dsxu-v20-final-preflight.ts |
| v20:blocker-board | yes | bun run scripts/dsxu-v20-blocker-action-board.ts |
| v20:closure-batch | yes | bun run scripts/dsxu-v20-closure-batch-runner.ts |
| v20:post-auth-plan | yes | bun run scripts/dsxu-v20-post-authorization-verification-plan.ts |
| v24:batch | yes | bun run scripts/dsxu-v24-execution-batch.ts |
| v24:live-acceptance | yes | bun run scripts/dsxu-v24-live-acceptance-router.ts |
| v24:completed-reacceptance | yes | bun run scripts/dsxu-v24-completed-reacceptance.ts |
| v24:interactive-tui-acceptance | yes | bun run scripts/dsxu-v24-interactive-tui-acceptance.ts |
| v24:c2-loop-acceptance | yes | bun run scripts/dsxu-v24-c2-loop-real-acceptance.ts |
| v24:public-challenge | yes | bun run scripts/dsxu-v24-public-challenge-package.ts |
| v24:product-benchmark-data | yes | bun run scripts/dsxu-v24-product-benchmark-data-pack.ts |
| v24:six-stage-final-tests | yes | bun run scripts/dsxu-v24-six-stage-final-tests.ts |
| v24:clean-export-artifact | yes | bun run scripts/dsxu-v24-clean-export-artifact.ts |
| v24:fresh-install-release-smoke | yes | bun run scripts/dsxu-v24-fresh-install-release-smoke.ts |
| v24:github-launch-pack | yes | bun run scripts/dsxu-v24-github-open-source-launch-pack.ts |
| v24:complex-task | yes | bun run scripts/dsxu-v24-complex-task-acceptance.ts |
| v24:c2-1902-evidence-join | yes | bun run scripts/dsxu-v24-c2-1902-full-evidence-join.ts |
| v24:section45-audit | yes | bun run scripts/dsxu-v24-section45-experience-loop-audit.ts |
| v24:senior-coding-window | yes | bun run scripts/dsxu-v24-senior-coding-window.ts |
| v26:c2-capability-loss-board | yes | bun run scripts/dsxu-v26-c2-capability-loss-board.ts |
| v26:naming-governance | yes | bun run scripts/dsxu-v26-naming-governance-board.ts |
| evidence:c2-capability-loss-board | yes | bun run scripts/dsxu-v26-c2-capability-loss-board.ts |
| evidence:naming-governance | yes | bun run scripts/dsxu-v26-naming-governance-board.ts |
| evidence:c2-1902-join | yes | bun run scripts/dsxu-v24-c2-1902-full-evidence-join.ts |
| evidence:experience-loop-audit | yes | bun run scripts/dsxu-v24-section45-experience-loop-audit.ts |
| evidence:completed-reacceptance | yes | bun run scripts/dsxu-v24-completed-reacceptance.ts |
| evidence:execution-batch | yes | bun run scripts/dsxu-v24-execution-batch.ts |
| release:github-launch-pack | yes | bun run scripts/dsxu-v24-github-open-source-launch-pack.ts |
| release:clean-export-artifact | yes | bun run scripts/dsxu-v24-clean-export-artifact.ts |
| release:fresh-install-smoke | yes | bun run scripts/dsxu-v24-fresh-install-release-smoke.ts |
| release:final-preflight | yes | bun run scripts/dsxu-v20-final-preflight.ts |
| release:blocker-board | yes | bun run scripts/dsxu-v20-blocker-action-board.ts |
| release:closure-batch | yes | bun run scripts/dsxu-v20-closure-batch-runner.ts |
| release:post-authorization-plan | yes | bun run scripts/dsxu-v20-post-authorization-verification-plan.ts |
| test:six-stage-final | yes | bun run scripts/dsxu-v24-six-stage-final-tests.ts |
| test:six-stage-plan | yes | bun run scripts/dsxu-v20-six-stage-test-plan.ts |
| benchmark:product-data | yes | bun run scripts/dsxu-v24-product-benchmark-data-pack.ts |
| benchmark:public-challenge | yes | bun run scripts/dsxu-v24-public-challenge-package.ts |
| acceptance:interactive-tui | yes | bun run scripts/dsxu-v24-interactive-tui-acceptance.ts |
| acceptance:senior-coding-window | yes | bun run scripts/dsxu-v24-senior-coding-window.ts |
| acceptance:c2-loop | yes | bun run scripts/dsxu-v24-c2-loop-real-acceptance.ts |
| acceptance:live | yes | bun run scripts/dsxu-v24-live-acceptance-router.ts |
| acceptance:complex-task | yes | bun run scripts/dsxu-v24-complex-task-acceptance.ts |

## Product/Public Rename Candidates

| path | surface | severity | filenameHits | lineHits |
| --- | --- | --- | --- | --- |
| src/dsxu/engine/baseline-failure-reporter.ts | product-evidence-source | evidence-content-review |  | 5 |
| src/dsxu/engine/benchmark-readiness.ts | product-evidence-source | evidence-content-review |  | 7 |
| src/dsxu/engine/code-terminal-runner.ts | product-evidence-source | evidence-content-review |  | 7 |
| src/dsxu/engine/controlled-failure-taxonomy.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/cost-cache-live-task-evidence.ts | product-evidence-source | evidence-content-review |  | 16 |
| src/dsxu/engine/eval-baseline-manifest.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/evidence-eval-pack.ts | product-evidence-source | evidence-content-review |  | 11 |
| src/dsxu/engine/go-stop-decision.ts | product-evidence-source | evidence-content-review |  | 11 |
| src/dsxu/engine/goal-driven-optimization-contract.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/goal-roadmap-contract.ts | product-evidence-source | evidence-content-review |  | 11 |
| src/dsxu/engine/high-pressure-reference-absorption-contract.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/live-real-task-compare.ts | product-evidence-source | evidence-content-review |  | 4 |
| src/dsxu/engine/model-public-surface-gate.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/next-stage-productization-contract.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/open-source-package-gate.ts | product-evidence-source | evidence-content-review |  | 7 |
| src/dsxu/engine/phase12-experience-oracle.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/product-reality-hardening-contract.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/proprietary-code-risk-gate.ts | product-evidence-source | evidence-content-review |  | 4 |
| src/dsxu/engine/public-surface-clean-gate.ts | product-evidence-source | evidence-content-review |  | 7 |
| src/dsxu/engine/real-gap-acceptance.ts | product-evidence-source | evidence-content-review |  | 12 |
| src/dsxu/engine/real-task-route-plan.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/engine/reference-absorption-completion-contract.ts | product-evidence-source | evidence-content-review |  | 19 |
| src/dsxu/engine/reference-behavior-productization-contract.ts | product-evidence-source | evidence-content-review |  | 25 |
| src/dsxu/engine/reference-experience-quality-contract.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/reference-governance-absorption-contract.ts | product-evidence-source | evidence-content-review |  | 10 |
| src/dsxu/engine/release-provenance-gate.ts | product-evidence-source | evidence-content-review |  | 4 |
| src/dsxu/engine/release-test-gate.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/route-cache-roi-smoke.ts | product-evidence-source | evidence-content-review |  | 4 |
| src/dsxu/engine/semantic-tool-trace.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/stage-close-readiness.ts | product-evidence-source | evidence-content-review |  | 19 |
| src/dsxu/engine/terminal-hit-rate.ts | product-evidence-source | evidence-content-review |  | 3 |
| src/dsxu/engine/ui-shell-manifest.ts | product-evidence-source | evidence-content-review |  | 3 |
| src/dsxu/engine/verify-review-chain.ts | product-evidence-source | evidence-content-review |  | 1 |
| src/dsxu/engine/wsl-execution-placement.ts | product-evidence-source | evidence-content-review |  | 3 |
| src/dsxu/engine/wsl-native-mirror-plan.ts | product-evidence-source | evidence-content-review |  | 2 |
| src/dsxu/integration/harness/v10-context-budget-v1-harness.ts | acl-residue | acl-external-closure | v10 | 0 |
| src/dsxu/integration/harness/v10-longtask-stability-v1-harness.ts | acl-residue | acl-external-closure | v10 | 0 |
| src/dsxu/integration/harness/v10-model-gateway-v1-harness.ts | acl-residue | acl-external-closure | v10 | 0 |

## Rules

- Historical V18/V19/V20/V24/V26 evidence files may keep their names for traceability.
- Product runtime source and public product docs should use capability names, not historical version names.
- Test evidence, integration harnesses, and evidence generators may retain historical evidence IDs when they are required for reproducibility and do not create runtime entrypoints.
- Package scripts should expose stable aliases such as `release:*`, `acceptance:*`, `benchmark:*`, and `evidence:*`; old `v24:*` aliases can remain as reproducibility shims.
- Public assets should not carry Vxx names once they are linked from README.

## Files

- CSV: D:\DSXU-code\docs\generated\DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.csv
- JSON: D:\DSXU-code\docs\generated\DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.json
