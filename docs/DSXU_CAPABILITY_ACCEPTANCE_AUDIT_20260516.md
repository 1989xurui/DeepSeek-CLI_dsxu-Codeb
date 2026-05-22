# DSXU Capability Acceptance Audit - 2026-05-16

This audit reclassifies the historical V18/V19 82 capability table. `70 PASS` means historical alignment pass; it is not automatically a full product-function acceptance or public benchmark claim.

## Summary

| totalRows | historicalPassRows | fullyImplementedTestedRows | liveWindowNeededRows | subsetOrAdaptedRows | evalCoordinateOnlyRows | deferredRows | needsRealFunctionalAcceptanceRows | strictPublicClaimAllowedRows | dsxuSuitableRows | dsxuUnsuitableForCurrentReleaseRows |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| 82 |70 |59 |0 |8 |3 |12 |0 |38 |67 |15 |

## DSXU Fit Tiers

| fitTier | count |
| --- |--- |
| workflow-sellable-now |21 |
| public-sellable-now |38 |
| sellable-with-boundary |8 |
| deferred-or-not-suitable-now |12 |
| benchmark-coordinate-only |3 |

## Rows That Must Not Be Treated As Full Feature PASS

| id | capability | decision | evidence | fitTier | nextAction |
| --- |--- |--- |--- |--- |--- |
| A16 |Internal Code-10/30 Runner |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| B12 |TerminalBench Subset Adapter |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| B13 |Internal Terminal-10/30 Runner |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| R01 |Terminal-Bench 2.0 |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| R02 |Internal Code-30 |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| S02 |BenchMax Mode |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| M07 |FIM local completion |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| A14 |Pro Reviewer |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| A17 |SWE Smoke Runner |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| R03 |SWE Pro |guard-or-eval-coordinate-only |guard-only |benchmark-coordinate-only |放入公开挑战/benchmark 数据包；等待同题 raw run 后再升级 claim。 |
| R04 |SWE Verified |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| R05 |BFCL V4 |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| R06 |BrowseComp-Lite |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| R07 |OSWorld-Lite |guard-or-eval-coordinate-only |guard-only |benchmark-coordinate-only |放入公开挑战/benchmark 数据包；等待同题 raw run 后再升级 claim。 |
| R08 |Toolathlon |guard-or-eval-coordinate-only |guard-only |benchmark-coordinate-only |放入公开挑战/benchmark 数据包；等待同题 raw run 后再升级 claim。 |
| PZ01 |OpenClaw Adapter |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| PZ02 |Hermes Adapter |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| PZ03 |BrowserExecutor |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| PZ04 |DesktopExecutor |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| PZ05 |Application templates |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| PZ06 |VS Code plugin/API platform |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |
| PZ07 |Multi-Agent Swarm/Coordinator |adapted/subset+tested |source+tests+live |sellable-with-boundary |补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。 |
| PZ08 |Voice/Buddy/Team/Bridge |deferred-not-pass |deferred |deferred-or-not-suitable-now |保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。 |

## Rules

- `implemented+tested` can support DSXU-owned release evidence, but public 90% ability still requires public challenge raw proof.
- `implemented+tested-needs-live-window` must go through real DSXU TUI/CLI/API workflow acceptance.
- `adapted/subset+tested` can be sold only under DSXU-owned constrained wording.
- `guard-or-eval-coordinate-only` is not a benchmark pass.
- `deferred-not-pass` remains roadmap/gap and must not enter PASS copy.
