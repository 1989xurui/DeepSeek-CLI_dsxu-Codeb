# DSXU 全能力真相矩阵 20260519

生成时间：2026-05-19T15:42:45.837Z

本报告由 `scripts/dsxu-capability-truth-matrix.ts` 自动扫描生成。它的目的不是证明“能力完成”，而是把每个文件/能力放到正确证据层级中，防止把默认主链、CLI 脚本、测试合同、文档证据、实验、冻结与历史残留混在一起。

## 输出文件

- JSON 全量矩阵：`docs/generated/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.json`
- CSV 全量矩阵：`docs/generated/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.csv`
- Markdown 摘要：`docs/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.md`

## 分类规则

| 标签 | 含义 |
|---|---|
| default-mainline | 从 DSXU 交互任务主链入口静态可达，属于 prompt -> query -> tool -> verify -> trust/TUI 路径。 |
| app-runtime | 从应用入口静态可达，但不一定进入一次真实编程任务默认链。 |
| cli-script | 位于 `scripts/` 或被 package scripts 调用，用于验收、证据、发布或运维。 |
| test-contract | 测试文件或被测试引用，证明合同存在，但不等同默认体验。 |
| doc-evidence | 文档或 docs/generated 证据引用。 |
| experiment | 包含 experiment/eval/oracle/smoke/reasonix/proof 等实验或研究信号。 |
| frozen | 冻结、禁用、发布治理、IP/品牌/清理类资产。 |
| historical-residue | Vxx 阶段、reference-product/absorption/legacy/archived/兼容残留。 |

## 总览

| 指标 | 数量 |
|---|---:|
| 扫描文件总数 | 3246 |
| 默认主链 | 1387 |
| App runtime 可达 | 1988 |
| CLI 脚本 | 565 |
| 测试合同 | 676 |
| 文档证据 | 334 |
| 实验 | 115 |
| 冻结 | 35 |
| 历史残留 | 683 |
| 未归类 | 206 |

## 主分类分布

| 主分类 | 数量 |
|---|---:|
| app-runtime | 601 |
| cli-script | 450 |
| default-mainline | 1387 |
| doc-evidence | 290 |
| experiment | 23 |
| frozen | 2 |
| historical-residue | 73 |
| test-contract | 214 |
| unclassified | 206 |

## 能力分布 Top 20

| 能力域 | 文件数 |
|---|---:|
| core-or-unclear | 778 |
| test-contract | 394 |
| tui-visible-state | 334 |
| tool-system | 287 |
| generated-evidence | 175 |
| cli-command-surface | 165 |
| mcp-skill-workflow | 163 |
| documentation | 159 |
| provider-model-cost-cache | 146 |
| agent-task-orchestration | 128 |
| context-memory-compact | 120 |
| permission-safety | 115 |
| release-governance-cli | 85 |
| configuration | 53 |
| query-loop-default-runtime | 36 |
| evidence-benchmark-cli | 28 |
| recovery-rollback | 27 |
| verification-quality-gates | 24 |
| evidence-release-benchmark | 16 |
| remote-bridge-transport | 13 |

## 风险提示

- default-mainline 是静态可达性，不等同 live provider 成功；公开能力声明仍需 live/benchmark 证据。
- test-contract 和 doc-evidence 不能直接当作默认用户体验完成证明。
- historical-residue 文件不一定有问题，但必须避免被模型或文档误读为当前默认能力。
- experiment/frozen 能力应通过显式开关或 owner 文档管理，不应自动进入 DeepSeek Flash 默认工具面。
- 脚本证据多代表验收/发布/分析面，不代表一次真实 prompt 到 final 的主链体验。

## 高信号样本矩阵

> 全量逐文件矩阵请看 CSV/JSON。下面只展示默认主链、冻结、历史残留、未归类等高信号样本，避免 Markdown 文件过大。

| 文件 | 能力域 | 主分类 | 标签 | 建议 |
|---|---|---|---|---|
| `README.md` | core-or-unclear | unclassified | - | 未归类或弱证据；需要 owner 判断是否保留、接入、冻结或删除。 |
| `bunfig.toml` | core-or-unclear | unclassified | - | 未归类或弱证据；需要 owner 判断是否保留、接入、冻结或删除。 |
| `docs/DEEPSEEK_V4_CAPABILITIES.md` | documentation | test-contract | test-contract<br>doc-evidence<br>historical-residue | 保留为测试合同；若声称产品能力，必须补默认链可达性证据。 |
| `docs/DSXU_ARCHIVE_WATCHLIST_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_BLOCKED_CLAIM_CORPUS_20260517.md` | documentation | doc-evidence | doc-evidence<br>frozen | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md` | documentation | test-contract | test-contract<br>doc-evidence<br>historical-residue | 保留为测试合同；若声称产品能力，必须补默认链可达性证据。 |
| `docs/DSXU_KARPATHY_SKILLS_ABSORPTION_PLAN_20260517.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_REFERENCE_MECHANISM_AUDIT_20260516.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_REFERENCE_SCENARIO_CONVERGENCE_20260516.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>frozen | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_V18_V19_MERGED_AUDIT_20260510_CLEAN.md` | documentation | test-contract | test-contract<br>doc-evidence<br>historical-residue | 保留为测试合同；若声称产品能力，必须补默认链可达性证据。 |
| `docs/DSXU_V1_CORE_EXECUTION_PLAN_20260518.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V1_CORE_EXECUTION_PLAN_20260518_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V1_OPTIMIZATION_PLAN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_100_POINT_ARCHITECTURE_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_ACL_RESIDUE_REVIEW_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_ACL_RESIDUE_SIGNOFF_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_BATCH_CLOSURE_BOARD_20260514.md` | documentation | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_V20_C2_FULL_OWNER_EXECUTION_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_C2_OGR_CROSS_SIGNOFF_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_CLAUDE_EXPERIENCE_DATA_AUDIT_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_CLAUDE_SRC_COMPARATIVE_ABSORPTION_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_CLOSURE_BOARD_20260515.md` | documentation | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_COMMERCIAL_IP_BRAND_RELEASE_GATE_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_DELETION_MUTATION_REVIEW_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_EXTERNAL_VISIBLE_STATE_OWNER_REVIEW_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_FALSE_COMPLETION_AUDIT_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_FULL_CODE_INTEGRATION_ASSESSMENT_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_MASTER_PLAN_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OGR02_DELETE_PACKET_SIGNOFF_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OGR12_SHARED_UTILITY_IMPORT_USE_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_GAP_MATRIX_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_GIT_REVIEW_EXECUTION_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_REFRESH_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_ADJUDICATION_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_UPDATE_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_P0_SOURCE_CLEANUP_EXECUTION_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_P1_PRODUCT_SIGNAL_OWNER_CLEANUP_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_PRIORITY_OWNER_PACKET_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_REAL_GAP_ACCEPTANCE_PROGRESS_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_REAL_GAP_PRODUCTIZATION_REVIEW_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_REAL_OPERATION_TEST_ACCEPTANCE_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V20_RELEASE_SURFACE_OWNER_EXECUTION_20260514.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_EXECUTION_BATCH_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_EXECUTION_PLAN_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>experiment<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>experiment<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_SECTION_4_5_EXPERIENCE_LOOP_AUDIT_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V24_SENIOR_CODING_WINDOW_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.md` | documentation | cli-script | cli-script<br>doc-evidence<br>frozen<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V26_MASTER_PLAN_20260515.md` | documentation | cli-script | cli-script<br>test-contract<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_20260515.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_20260516.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V2_EXECUTION_PLAN_20260518_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V3_CACHE_FIRST_EXECUTION_PLAN_20260518_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_CONSOLIDATION_EXECUTION_PLAN_20260518_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_FEATURE_OWNER_MAP_20260518.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_FOCUSED_REAUDIT_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_FREEZE_REGISTER_20260518.md` | documentation | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V4_SCRIPT_SURFACE_MAP_20260518.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_EXECUTION_PLAN_20260519_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_CLAIM_BOUNDARY_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_EXPERIENCE_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_MAINLINE_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_PHASE0_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_RELEASE_GATES_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_PHASE0_REPLAY_REGRESSION_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V5_REPLAY_BANK_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_CONTEXT_PRESSURE_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_COST_TO_VERIFIED_COMPLETION_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_DEEPSEEK_NATIVE_ENGINEERING_RUNTIME_20260519_CN.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V6_DEEPSEEK_PROVIDER_PROBE_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_EXECUTION_PLAN_20260519_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_HIT_RATE_REPORT_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_INDEPENDENT_COMPLETION_AUDIT_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_LEDGER_RESUME_SMOKE_20260519.md` | documentation | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_LIVE_TOOL_CALL_REPLAY_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_OWNER_CLEANUP_CHECK_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_PROMPT_DIET_REPORT_20260519.md` | documentation | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/DSXU_V6_PTY_TUI_ACCEPTANCE_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_REPLAY_BANK_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V6_TUI_SNAPSHOT_20260519.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/DSXU_V7_FINAL_CLOSURE_BOARD_20260519.md` | documentation | doc-evidence | doc-evidence<br>frozen | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md` | documentation | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_ARCHIVE_WATCHLIST_20260519.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_BLOCKED_CLAIM_CORPUS_20260517.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.json` | generated-evidence | test-contract | test-contract<br>doc-evidence<br>historical-residue | 保留为测试合同；若声称产品能力，必须补默认链可达性证据。 |
| `docs/generated/DSXU_KARPATHY_SKILLS_ABSORPTION_AUDIT_20260517.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_LEGACY_SWE_OWNER_REVIEW_20260517.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_REFERENCE_MECHANISM_AUDIT_20260516.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_BACKLOG_20260516.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_REFERENCE_SCENARIO_CONVERGENCE_20260516.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_TUNGSTEN_DISABLED_TOOL_OWNER_REVIEW_20260517.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>frozen | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V20_ACL_RESIDUE_CLOSURE_PLAN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_ACL_RESIDUE_REVIEW_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_ACL_RESIDUE_SIGNOFF_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_BATCH_CLOSURE_BOARD_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_C2_FULL_OWNER_EXECUTION_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_C2_FUNCTION_LOSS_REVIEW_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_C2_OGR_CROSS_SIGNOFF_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V20_CLOSURE_BATCH_RUN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V20_CLOSURE_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_COMMERCIAL_IP_RELEASE_PREFLIGHT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_DELETION_GIT_MUTATION_SIGNOFF_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_EXTERNAL_VISIBLE_STATE_OWNER_REVIEW_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_FINAL_PREFLIGHT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_HIGH_RISK_RUNTIME_OWNER_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_LIVE_CACHE_PREFIX_SMOKE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_LIVE_PROVIDER_GATE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_MCP_DOCTOR_REAL_GAP_SMOKE_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>experiment<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OGR01_DOCS_RELEASE_EVIDENCE_SIGNOFF_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OGR12_SHARED_UTILITY_IMPORT_USE_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OGR13_OWNER_REMAP_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_AUTHORIZATION_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_COMMAND_PLAN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_ADJUDICATION_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_RUNTIME_REDLINE_REVIEW_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_EXECUTION_UPDATE_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_P12_TARGET_MANIFEST_CONTRACT_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_P12_TARGET_MANIFEST_DISCOVERY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_POST_AUTHORIZATION_VERIFICATION_PLAN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_PROJECT_INTAKE_OWNER_REVIEW_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_PROGRESS_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_REAL_GAP_PRODUCTIZATION_REVIEW_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_RELEASE_SURFACE_OWNER_EXECUTION_SUMMARY_20260514.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_BASELINE_AUDIT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_REVIEW_INPUT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_COMPLETED_REACCEPTANCE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_REVIEW_INPUT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_EXECUTION_BATCH_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>experiment<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_REVIEW_INPUT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_LIVE_ACCEPTANCE_ROUTER_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json` | generated-evidence | cli-script | cli-script<br>test-contract<br>doc-evidence<br>experiment<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_REDLINE_OWNER_PACKET_TRIAGE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_REFERENCE_EXPERIENCE_DENSITY_REBASELINE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_RUNTIME_STUB_REDLINE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_SECTION_4_5_EXPERIENCE_LOOP_AUDIT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_SECTION_4_5_EXPERIENCE_LOOP_AUDIT_REVIEW_INPUT_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V26_C2_CAPABILITY_LOSS_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V26_NAMING_GOVERNANCE_BOARD_20260515.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_20260515.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>experiment<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_20260516.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V4_CONSOLIDATION_STATUS_20260518.json` | generated-evidence | doc-evidence | doc-evidence<br>historical-residue | 历史/吸收/兼容残留；建议归档或加 owner 注释，避免被误认为当前能力。 |
| `docs/generated/DSXU_V4_FEATURE_OWNER_MAP_20260518.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
| `docs/generated/DSXU_V4_FREEZE_REGISTER_20260518.json` | generated-evidence | doc-evidence | doc-evidence<br>frozen<br>historical-residue | 冻结或发布治理资产；默认链不要引入，除非有明确 owner 和验收。 |
| `docs/generated/DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.json` | generated-evidence | cli-script | cli-script<br>doc-evidence<br>historical-residue | 保留为证据/运维脚本；不要让模型默认规划时把它当 runtime 能力。 |
