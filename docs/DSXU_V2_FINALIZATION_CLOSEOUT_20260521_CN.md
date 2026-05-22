# DSXU V2 Finalization 与 Public-Comparable 收口记录 - 2026-05-21

## 范围

本记录覆盖 V2 剩余主问题：

1. 原始 14 个 non-pass replay case 的 Finalization Runtime Gate 收口。
2. 后续 public-comparable 剩余 16 个 case 的 DSXU lane 补跑。
3. 30 个 case 的 raw API baseline 与 raw evidence import 收口。
4. Evidence dashboard 对旧中间 rerun 失败报告的 supersede 投影收口。

## 最新证据

| 类型 | 路径 | 状态 |
| --- | --- | --- |
| 14-case finalization subset | `docs/generated/DSXU_PUBLIC_COMPARABLE_DSXU_LANE_FINALIZATION_RERUN47_FULL_14_AGENT_FINAL_20260521.json` | PASS 14/14 |
| 剩余 7 个复杂 case 修复批次 | `docs/generated/DSXU_PUBLIC_COMPARABLE_DSXU_LANE_RERUN51_FIX7_FINAL_20260521.json` | PASS 7/7 |
| 剩余 16 个 raw API baseline | `docs/generated/DSXU_PUBLIC_COMPARABLE_RAW_API_BASELINE_REMAINING_16_RERUN51_20260521.json` | PASS 16/16 |
| 30-case raw evidence import | `docs/generated/DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_FULL_30_RERUN51_20260521.json` | PASS 30/30 ready |
| 30-case raw evidence manifest | `docs/generated/DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_FULL_30_RERUN51_20260521.json` | written |
| Evidence dashboard | `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260521.json` | blocked=0, claimBlocked=2, publicComparableMissingCases=0 |

## 结果

| 指标 | 值 |
| --- | ---: |
| 原始 V2 non-pass replay case | 14 |
| RERUN47 通过 case | 14 / 14 |
| RERUN48 剩余 16 初跑通过 case | 9 / 16 |
| RERUN51 复杂修复批次通过 case | 7 / 7 |
| Raw API baseline 补齐 case | 30 / 30 |
| Raw evidence imported case | 30 / 30 |
| Raw evidence ready case | 30 / 30 |
| Raw evidence partial case | 0 |
| Raw evidence missing case | 0 |
| Evidence dashboard blocked gate | 0 |
| Evidence dashboard claim blocked gate | 2 |
| Runtime Finalization Gate 未解决项 | 0 |
| Release/export preflight blocker | 0 |
| P12 target/reference readiness | PASS, 14/14 paired raw logs |
| Agent/team 结构性未解决项 | 0 |
| 允许 DSXU public-comparable raw evidence 声明 | True |
| 允许外部对比声明 | False |

## 本轮修复的真实问题

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 复杂 product/reality/review lane 被 V7 missing-doc 牵走 | 隔离 worktree 未复制 `*_20260519_CN.md` 支持证据，且 copy 规则只匹配 `20260519.md` | 复杂 lane 复制完整 V7 支持证据；compact two-phase 仍单独保持目标文档缺失 fixture |
| apiMicrocompact 类 case 过度跑 broad baseline | 只有 pattern hint，缺少 exact focused verifier 优先级 | 增加 exact apiMicrocompact lane plan，优先 `bun test test/apiMicrocompact.test.ts` |
| `product-review-to-fix-live` 缺少明确可修复 fixture | generic prompt 没有稳定 review 缺陷，模型被 broad test 噪音带走 | seed HTML escaping review mismatch，并增加 exact focused verifier `bun test test/html.test.js` |
| exact plan 被 generic `bun test --bail` 规则覆盖 | 工具合同没有说明 exact plan 优先 | 增加 exact-plan precedence rule |
| dashboard 仍被旧中间 rerun 失败报告阻塞 | Evidence dashboard 没有把最终 30/30 raw evidence import PASS 投影为旧 DSXU lane rerun 的 supersede 证据 | 增加 public-comparable DSXU lane supersession：有 full raw evidence import PASS 时，旧 PARTIAL/BLOCKED/FAIL rerun 降级为 INFO；无 final import PASS 时仍保持 BLOCKED |
| 旧 partial raw evidence import 仍作为 claim blocker | 两个 RERUN47 partial import 报告已经被 FULL_30_RERUN51 PASS 覆盖，但 dashboard 仍按 PARTIAL 映射为 CLAIM_BLOCKED | 增加 partial import supersession：有更新的 full import PASS 时旧 partial import 降级为 INFO；没有更新 full import PASS 时仍保持 CLAIM_BLOCKED |
| P12 target/reference readiness 原先未接入 | discovery 已找到 canonical target-reference manifest，但 intake/raw-readiness 没有带 `targetReferenceManifestPath` 参数 | 使用 `.dsxu/trace/p12-target-reference-codex-runner-v1/target-reference-manifest.json` 跑 intake 与 raw readiness，P12 PASS 14/14 |
| release/export preflight 原先 BLOCKED | final preflight 依赖 P12 readiness；P12 未闭合时 clean export 不允许 | P12 PASS 后重跑 `release:final-preflight` 与 `clean-export:preflight`，两者均 PASS/READY |

## 已验证命令

| 命令 | 结果 |
| --- | --- |
| `bun test scripts\__tests__\dsxu-public-comparable-dsxu-lane.test.ts` | 43 pass |
| `bun test src\dsxu\engine\__tests__\semantic-tool-layer-v1.test.ts` | 10 pass |
| `bun test src\tools\RunNativeTestTool\RunNativeTestTool.test.ts` | 7 pass |
| `bun test test\apiMicrocompact.test.ts` | 4 pass |
| `bun test test\html.test.js` | 1 pass |
| `bun test scripts\__tests__\dsxu-evidence-dashboard.test.ts` | 13 pass |
| `bun run scripts/dsxu-public-comparable-dsxu-lane.ts --case <7 fix cases> ... RERUN51 ...` | PASS 7/7 |
| `bun run scripts/dsxu-public-comparable-raw-api-baseline.ts --case <remaining 16> ...` | PASS 16/16 |
| `bun run scripts/dsxu-public-comparable-raw-evidence.ts ... FULL_30_RERUN51 ...` | PASS, ready 30/30 |
| `bun run scripts/dsxu-evidence-dashboard.ts --json` before release preflight refresh | blocked=0; publicComparableMissingCases=0; external target evidence still needed |
| `bun run test:dsxu:release` | 531 pass, 0 fail |
| `bun run p12:target-discovery` | READY_TARGET_REFERENCE_MANIFEST_DISCOVERED, canonicalAcceptedLogCount=14 |
| `bun run p12:target-intake -- --targetReferenceManifestPath .dsxu\trace\p12-target-reference-codex-runner-v1\target-reference-manifest.json` | READY_FOR_RAW_READINESS_IMPORT, acceptedLogCount=14 |
| `bun run p12:raw-readiness -- --targetReferenceManifestPath .dsxu\trace\p12-target-reference-codex-runner-v1\target-reference-manifest.json` | PASS, p12Status=PASS, deferredEvalStatus=PASS |
| `bun run release:final-preflight` | PASS, canRunFinalSixStageTests=true, canCreateCleanExport=true |
| `bun run clean-export:preflight` | PASS_READY_TO_CREATE_CLEAN_EXPORT |
| `bun test ./src/dsxu/engine/__tests__/release-test-gate-v1.test.ts ./src/dsxu/engine/__tests__/release-surface-v1.test.ts ./src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts` | 13 pass |
| `bun run commercial-ip:preflight` | activeReviewRequiredRows=0 |
| `bun run evidence:dashboard` after P12/final preflight | blocked=0, claimBlocked=2 |

## 硬边界

这次可以声明的是：DSXU lane 的 30 个 public-comparable case 已有完整 raw evidence，且 raw evidence import ready 30/30。旧的中间 rerun 失败报告已经被最终通过证据 supersede，不再作为 V2 runtime finalization blocker。P12 target/reference readiness 也已用真实 manifest 通过 14/14。

仍然不能声明的是：

- 不能声明已经超过 Claude / GPT。
- 不能声明 external comparison 已完成。
- 不能把 DSXU lane raw evidence 等同于 target/reference transcript。
- 不能把本地 isolated replay 等同于公开 SWE-bench 官方成绩。
- 不能声明 public-comparable 30-case external comparison 已完成。

原因：`externalComparisonClaimAllowed=false`，public-comparable 30-case 仍缺同题 `targetReferenceTranscriptPath`；同时 `public95ClaimAllowed=false`，scoreFloor 仍为 72。

## 硬结论

V2 剩余主问题已经从 14-case finalization subset 扩展收口到 30-case public-comparable raw evidence ready，并完成 dashboard 对旧中间证据的投影收口。P12 target/reference readiness 与 clean export preflight 已闭合。下一阶段不应继续扩 V2 runtime gate，应聚焦 public-comparable 30-case external target/reference transcript 采集与 public 95 claim 数据边界。
