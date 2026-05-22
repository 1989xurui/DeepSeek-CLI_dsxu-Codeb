# DSXU V20 Real-Gap Acceptance Progress - 2026-05-15

## 2026-05-15 P12 target manifest discovery and raw-readiness update

real-gap ? P12 ??????????????????`.dsxu/trace/p12-target-reference-codex-runner-v1/target-reference-manifest.json`?intake ?? `14` ? target-reference same-task logs?raw-readiness ?? `PASS`?family gap ? `0`???????generic log ? target-only log ???

?? real-gap ??? P12 raw input??????????Owner/Git ?????4 ? ACL residues?????????clean export?

## 2026-05-15 Owner/Git authorization board update

real-gap ????? Owner/Git authorization board ?? focused acceptance ??????? P12 target raw input?????????????????? Owner/Git packets ?????????? owner??? command plan ?????????

???????????P12 ????? `targetReferenceManifestPath`?Owner/Git ?????????4 ? ACL residues ????????? owner/Git ???????? clean export ??????? gate ???

## 2026-05-15 V20 closure batch runner update

本轮补齐总控型收口入口：`v20:closure-batch` 一次刷新 14 个 gate，最终结果 `PASS_EVIDENCE_REFRESHED_BLOCKERS_REMAIN`，`passCount=14`、`failCount=0`。同时新增 `p12:target-contract` 和 `v20:post-auth-plan`，分别冻结 target manifest 合同和授权后的 verification 顺序。当前 register = `1891`，`M=1648`、`D=147`、`??=96`，新增 3 个总控脚本归入 `V20-OGR-09-dsxu-engine-mainline`。仍未 stage、commit、delete、reset、clean、final test 或 export。

## 2026-05-15 blocker action plan update

P12 real-gap 继续推进为真实 collection work：`p12:target-collection` 生成 14 个 work orders 和 manifest template，但 `pairedRawLogCount=0`，不能算 target raw evidence。Owner/Git 和 ACL 也已变成可授权执行计划：57 条 Git command plan、4 条 ACL closure plan。

当前固定顺序：真实 target manifest -> owner/Git mutation/stage -> ACL closure -> final six-stage tests -> clean export。

## 2026-05-15 final closure preflight update

本轮把 P12 raw input、Owner/Git product paths、final preflight、clean export 继续推进为可执行证据。

| Packet | Result |
|---|---|
| P12 target manifest intake | `BLOCKED_MISSING_TARGET_REFERENCE_MANIFEST`，`acceptedLogCount=0`，`didFabricateTargetLogs=false` |
| Owner/Git product stage plan | `READY_PENDING_EXPLICIT_OWNER_GIT_STAGE`，`stageReadyPaths=1736/1736`，`packetCount=11` |
| V20 final preflight | `BLOCKED`，`gates=7`，`canRunFinalSixStageTests=false`，`canCreateCleanExport=false` |
| Clean export preflight | `BLOCKED`，`didCreateExport=false` |

P12 target manifest intake 已明确真实 manifest 合同，但当前没有 `targetReferenceManifestPath`，所以仍不能进入 raw PASS。

## 2026-05-15 stage/test closure update

本轮继续按 V20 目标执行，但没有用本地小补丁替代 gate：

| Packet | Result |
|---|---|
| Owner/Git mutation preflight | `PASS_ALIGNED / BLOCKED_EVIDENCED`，`registerRows=1879`，`registerAlignedToGitStatus=true`，`canStageDeletionPackets=true` |
| Owner/Git deletion stage plan | `READY_PENDING_EXPLICIT_GIT_STAGE`，`stageReadyPaths=147/147`，`packetCount=6`，`didMutateGit=false` |
| ACL residue preflight | `BLOCKED_EXTERNAL_PERMISSION_OR_SIGNOFF`，`residueCount=4`，`existingResidues=4`，`activeProductReferenceRows=0`，`didMutateFilesystem=false` |
| V20 six-stage test plan | `BLOCKED_UNTIL_UPSTREAM_GATES_PASS`，`stages=6`，`P12=0/14`，`familyGap=14`，`deletionStagePlanReady=true`，`aclResidues=4`，`didRunFinalTests=false` |

剩余硬阻断仍是固定顺序：真实 `targetReferenceManifestPath` 或显式 owner/Git mutation/stage 决策 -> ACL residue 外部/显式处理 -> 六阶段真实测试 -> final preflight -> clean export。

本记录继续推进 V20 real-gap acceptance。它不是最终六阶段测试，也不是 release PASS；它只说明当前真实缺口中哪些 focused acceptance 入口已经跑通，哪些仍需要最终验收。

生成文件：

- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_PROGRESS_20260515.json`
- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_PACKETS_20260515.csv`

## 上游 gate 状态

| Gate | 当前状态 |
|---|---|
| Owner/Git packets | `DONE_SIGNOFF_EXECUTION_STATES` |
| `147` deletion mutation review | `DONE_ACCEPT_KEEP_DELETED_NOT_STAGED` |
| `4` ACL residue | `DONE_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |
| real-gap acceptance | `FOCUSED_ACCEPTANCE_PROGRESS_NOT_FINAL_PASS` |

## Focused acceptance

| Packet | Result |
|---|---|
| MCP / external / remote lifecycle | PASS，`9 tests / 0 fail / 82 expect` |
| browser / dev-server / cost evidence | PASS，`8 tests / 0 fail / 164 expect` |
| real-task replay / remote network | PASS，`3 tests / 0 fail / 46 expect` |
| extension / control-plane stage | PASS，`2 tests / 0 fail / 19 expect` |
| terminal / TUI reliability full group | PARTIAL，`9 pass / 1 fail / 144 expect`，失败点为 WSL `$HOME` 探测冷启动/忙碌时被 `SIGTERM` 杀掉 |
| TUI WSL exit smoke fix | PASS，`1 test / 0 fail / 15 expect` |
| project intake / external host / chat API / operator dashboard owner contract | PASS，`3 tests / 0 fail / 26 expect` |
| external / extension / visible owner regression | PASS，`6 tests / 0 fail / 37 expect` |
| provider/API fallback owner regression | PASS，`22 tests / 0 fail / 51 expect` |
| P12 raw comparison / raw evidence readiness gate | PASS，`17 tests / 0 fail / 203 expect`，耗时约 `123s`；继续证明 target manifest 导入、wrong-side/dry-plan block、family coverage 与 readiness gate 没有坏 |
| P12 raw-readiness CLI help | PASS，`bun run p12:raw-readiness --help` |
| P12 raw-readiness CLI current evidence | BLOCKED_EVIDENCED，`p12PairedRawLogCount=0`、`p12MinimumPairedRawLogsForPass=14`、`p12ReplayFamilyGapCount=14`、`nextAction=collect-target-reference-raw-logs` |
| control-plane export + real-gap regression | PASS，`14 tests / 0 fail / 74 expect` |
| Owner/Git mutation preflight | PASS_ALIGNED / BLOCKED_EVIDENCED，`registerRows=1876`、`canStageDeletionPackets=true`、`deletionMutationReadyPaths=147`、`aclResidueRows=4`、`p12PairedRawLogCount=0/14` |

## 修复

`src/dsxu/integration/harness/real-tui-harness.ts` 已把 WSL home 探测从单次 `5s` 硬失败改为 `3` 次 `15s` 重试，并在最终失败时返回结构化 `spawn_failed` evidence。这样真实 TUI 可用时继续跑，不可用时也有可审计失败，而不是未归类异常。

## 仍未最终完成

| Gap | 状态 |
|---|---|
| Project intake / External Agent Host / External Chat-Agent API / Operator Dashboard | 已有 focused owner contract；不是最终六阶段 PASS |
| P12 target raw manifest | 仍缺真实 `targetReferenceManifestPath`，不能用模板、generic log 或 target-only log 替代 |
| final six-stage acceptance | 仍等待 release gates 与显式 Git mutation/stage 决策 |

裁决：real-gap focused acceptance 已把 project intake、external host、chat/agent API、operator dashboard 四块从未知缺口推进为命名 owner contract；P12 target raw manifest 仍是外部输入硬阻断。focused acceptance 不能替代功能测试、体验测试、恢复测试、性能测试、评测测试和发布收口测试。
